import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProvider } from '@/ai';
import {
  releaseLocalConversation,
} from '@/ai/local';
import type { ChatMessage } from '@/ai/types';
import { pickImage } from '@/attachments/files';
import { Banner } from '@/components/Banner';
import { ChatInput } from '@/components/ChatInput';
import { IconButton } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { MessageBubble } from '@/components/MessageBubble';
import {
  clearAllConversations,
  ensureConversation,
  touchConversation,
} from '@/db/conversations';
import {
  insertMessage,
  listMessages,
  setMessageStatus,
  updateMessageContent,
  type MessageRow,
} from '@/db/messages';
import { useAiStatus } from '@/hooks/useAiStatus';
import {
  MAX_RECORDING_MS,
  useVoiceRecorder,
} from '@/hooks/useVoiceRecorder';
import { useSettings } from '@/settings/SettingsContext';
import { buildSystemPrompt } from '@/settings/storage';
import { useTheme } from '@/theme';
import { confirmAction, showMessage } from '@/utils/confirm';

/** Streamed content is written to SQLite at most this often. */
const DB_WRITE_THROTTLE_MS = 500;
/** The app has a single chat; all messages belong to this conversation. */
const id = 'main';

export const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: 'Plan my priorities', prompt: 'Help me plan my priorities for today. Ask what I need to get done, then make a realistic schedule.' },
  { label: 'Check my habits', prompt: 'Help me review my habits for today. Ask what I have completed and encourage me to choose one next step.' },
  { label: 'What is my next task?', prompt: 'Help me identify the best next task to work on today.' },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const { settings, ready } = useSettings();
  const { problem, modelStatus } = useAiStatus();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const messagesListRef = useRef<FlatList<MessageRow>>(null);
  const [input, setInput] = useState('');
  const draft = typeof prompt === 'string' ? prompt : input;
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{
    uri: string;
    durationMs: number;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  // Model "Auto" routed the last reply to (cloud only).
  const [lastModel, setLastModel] = useState<string | null>(null);
  const voice = useVoiceRecorder();

  const abortRef = useRef<AbortController | null>(null);
  const lastDbWriteRef = useRef(0);
  const provider = useMemo(
    () => (ready ? getProvider(settings) : null),
    [ready, settings]
  );

  // ── Load messages on focus (also after "Clear chat" in settings) and fail
  // any 'pending' rows left over from a killed run ──
  useFocusEffect(
    useCallback(() => {
      // Mid-generation the on-screen state is newer than the DB; keep it.
      if (abortRef.current) return;
      (async () => {
        await ensureConversation(id);
        const rows = await listMessages(id);
        const fixed = await Promise.all(
          rows.map(async (m) => {
            if (m.status === 'pending') {
              await setMessageStatus(m.id, 'error', 'Generation interrupted.');
              return { ...m, status: 'error' as const, error: 'Generation interrupted.' };
            }
            return m;
          })
        );
        setMessages(fixed);
      })();
    }, [])
  );

  /** Write streamed content to the DB, throttled; final write on done. */
  const persistContent = useCallback(
    (messageId: string, content: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastDbWriteRef.current < DB_WRITE_THROTTLE_MS) return;
      lastDbWriteRef.current = now;
      void updateMessageContent(messageId, content);
    },
    []
  );

  const updateRow = useCallback((row: MessageRow) => {
    setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
  }, []);

  /**
   * Run one generation for `assistantRow`.
   * `history` = prior done messages plus the new user message, in order.
   */
  const runGeneration = useCallback(
    async (assistantRow: MessageRow, history: ChatMessage[]) => {
      if (!provider) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);

      let content = '';
      let streamTimer: ReturnType<typeof setTimeout> | undefined;
      const flushStream = () => {
        if (streamTimer) clearTimeout(streamTimer);
        streamTimer = undefined;
        const snapshot = content;
        setMessages(prev => prev.map(m => m.id === assistantRow.id ? { ...m, content: snapshot } : m));
        persistContent(assistantRow.id, snapshot);
      };
      try {
        await provider.generate(history, {
          systemPrompt: buildSystemPrompt(settings),
          signal: controller.signal,
          conversationId: id,
          onModel: (m) => setLastModel(m),
          onReset: () => {
            if (streamTimer) clearTimeout(streamTimer);
            streamTimer = undefined;
            content = '';
            setMessages(prev => prev.map(m => m.id === assistantRow.id ? { ...m, content: '' } : m));
            persistContent(assistantRow.id, '', true);
          },
          onToken: (t) => {
            content += t;
            if (!streamTimer) streamTimer = setTimeout(flushStream, 50);
          },
        });
      } catch (e) {
        if (streamTimer) clearTimeout(streamTimer);
        if (!controller.signal.aborted) {
          const errText =
            e instanceof Error ? e.message : 'Generation failed.';
          await setMessageStatus(assistantRow.id, 'error', errText);
          updateRow({ ...assistantRow, content, status: 'error', error: errText });
          setGenerating(false);
          abortRef.current = null;
          return;
        }
        // Aborted mid-flight: fall through and keep the partial content.
      }

      if (streamTimer) clearTimeout(streamTimer);
      persistContent(assistantRow.id, content, true);
      await setMessageStatus(assistantRow.id, 'done');
      await updateMessageContent(assistantRow.id, content);
      updateRow({ ...assistantRow, content, status: 'done', error: null });
      await touchConversation(id);
      setGenerating(false);
      abortRef.current = null;
    },
    [provider, settings, persistContent, updateRow]
  );

  const attachImage = useCallback(async () => {
    try {
      const uri = await pickImage();
      if (uri) setPendingImage(uri);
    } catch (e) {
      showMessage('Unable to attach image', e instanceof Error ? e.message : 'Please try again.');
    }
  }, []);

  const startRecording = useCallback(() => {
    voice.start().catch((e) => showMessage('Unable to record', e instanceof Error ? e.message : 'Please try again.'));
  }, [voice]);

  const finishRecording = useCallback(async () => {
    try {
      const done = await voice.stop();
      if (done) setPendingAudio(done);
    } catch (e) {
      showMessage('Unable to save recording', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [voice]);

  const cancelRecording = useCallback(() => {
    voice.cancel().catch(() => {});
  }, [voice]);

  // Finish (keep) the recording automatically when it hits the cap.
  const autoStoppedRef = useRef(false);
  useEffect(() => {
    if (!voice.recording) {
      autoStoppedRef.current = false;
      return;
    }
    if (voice.durationMs >= MAX_RECORDING_MS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      void finishRecording();
    }
  }, [voice.recording, voice.durationMs, finishRecording]);

  const send = useCallback(async () => {
    const text = draft.trim();
    const image = pendingImage;
    const audio = pendingAudio;
    if ((!text && !image && !audio) || !provider || generating) return;
    if (typeof prompt === 'string') router.setParams({ prompt: undefined });
    setGenerating(true);
    await ensureConversation(id);

    const userRow = await insertMessage({
      conversation_id: id,
      role: 'user',
      content: text,
      status: 'done',
      error: null,
      provider: provider.id,
      image_uri: image,
      audio_uri: audio?.uri ?? null,
    });
    const assistantRow = await insertMessage({
      conversation_id: id,
      role: 'assistant',
      content: '',
      status: 'pending',
      error: null,
      provider: provider.id,
      image_uri: null,
      audio_uri: null,
    });
    setInput('');
    setPendingImage(null);
    setPendingAudio(null);
    setMessages((prev) => [...prev, userRow, assistantRow]);

    await touchConversation(id);

    const history: ChatMessage[] = [
      ...messages
        .filter(
          (m) =>
            m.status === 'done' &&
            (m.content.length > 0 || m.image_uri || m.audio_uri)
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
          imageUri: m.image_uri ?? undefined,
          audioUri: m.audio_uri ?? undefined,
        })),
      {
        role: 'user',
        content: text,
        imageUri: image ?? undefined,
        audioUri: audio?.uri ?? undefined,
      },
    ];
    await runGeneration(assistantRow, history);
  }, [draft, pendingImage, pendingAudio, provider, generating, messages, prompt, router, runGeneration]);

  const retry = useCallback(
    async (row: MessageRow) => {
      if (generating) return;
      const idx = messages.findIndex((m) => m.id === row.id);
      if (idx < 0) return;
      const history: ChatMessage[] = messages
        .slice(0, idx)
        .filter(
          (m) =>
            m.status === 'done' &&
            (m.content.length > 0 || m.image_uri || m.audio_uri)
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
          imageUri: m.image_uri ?? undefined,
          audioUri: m.audio_uri ?? undefined,
        }));
      const pendingRow: MessageRow = { ...row, status: 'pending', error: null };
      await setMessageStatus(row.id, 'pending', null);
      updateRow(pendingRow);
      await runGeneration(pendingRow, history);
    },
    [generating, messages, runGeneration, updateRow]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    confirmAction('Clear chat?', 'All messages will be deleted and the AI memory reset.', 'Clear', async () => {
      await clearAllConversations();
      await releaseLocalConversation(id);
      await ensureConversation(id);
      // Reset only after the engine has released its memory.
      setMessages([]);
      setPendingImage(null);
      setPendingAudio(null);
    });
  }, []);

  const openSettings = () => router.push('/chat-settings' as Href);
  const chooseSuggestion = (suggestion: string) => {
    if (typeof prompt === 'string') router.setParams({ prompt: undefined });
    setInput(suggestion);
  };

  // ── Banner / send gating ────────────────────────────────────────────────
  const banner = problem ? (
    <Banner
      text={problem}
      actionLabel="Open Settings"
      onPress={openSettings}
    />
  ) : null;
  const sendDisabled = problem !== null;

  // Status dot + line under the title: green when ready, amber while the
  // local model is loading/downloading, red otherwise.
  const providerLabel =
    settings.provider === 'cloud'
      ? lastModel
        ? `Gemini · ${lastModel}`
        : 'Gemini · Cloud'
      : 'Local AI';
  const modelLoading =
    problem === 'Loading the local model...' || modelStatus.state === 'loading';
  let statusText = `${providerLabel} · not ready`;
  let statusColor = theme.danger;
  if (problem === null) {
    statusText = providerLabel;
    statusColor = theme.success;
  } else if (modelLoading || modelStatus.state === 'downloading') {
    statusText = modelLoading ? 'Loading model...' : `${providerLabel} · not ready`;
    statusColor = theme.warning;
  }

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <IconButton icon="chevron-back" label="Back to Home" onPress={() => router.navigate('/' as Href)} style={styles.chatHeaderIcon} />
        <View style={styles.avatarWrap} accessibilityLabel={`Nova AI status: ${statusText}`}>
          <View style={[styles.avatar, { backgroundColor: theme.buttonSecondary }]}>
            <Ionicons name="hardware-chip-outline" size={18} color={theme.text} />
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: theme.background }]} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Nova AI</Text>
            <View style={[styles.previewBadge, { backgroundColor: theme.buttonSecondary }]}><Text style={[styles.previewText, { color: theme.textSecondary }]}>PREVIEW</Text></View>
          </View>
          <Text numberOfLines={1} style={[styles.assistantSubtitle, { color: theme.textSecondary }]}>Daily planning assistant</Text>
        </View>
        <IconButton icon="refresh-outline" label="Clear chat" onPress={clearChat} disabled={generating || messages.length === 0} style={styles.chatHeaderIcon} />
      </View>
      {banner}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.welcomeBubble, { backgroundColor: theme.assistantBubble, borderColor: theme.border }]}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>
              Hello! I am Nova, your Planova planning assistant. How can I help you plan your schedule, review habits, or structure your day?
            </Text>
          </View>
          <Text style={[styles.welcomeTime, { color: theme.textSecondary }]}>Just now</Text>
          <View style={styles.emptySpacer} />
          <View style={[styles.suggestionBar, { borderColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
              {SUGGESTIONS.map((suggestion) => (
                <SmoothPressable
                  key={suggestion.label}
                  disabled={problem !== null}
                  onPress={() => chooseSuggestion(suggestion.prompt)}
                  style={[styles.chip, { backgroundColor: theme.buttonSecondary }, problem !== null && styles.chipDisabled]}
                >
                  <Text numberOfLines={1} style={{ color: theme.text, fontSize: 9, fontWeight: '600' }}>{suggestion.label}</Text>
                </SmoothPressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        <FlatList
          ref={messagesListRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => messagesListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onRetry={item.role === 'assistant' ? retry : undefined}
            />
          )}
        />
      )}
      <ChatInput
        value={draft}
        placeholder="Ask Nova about your day..."
        showTools={false}
        onChange={(value) => {
          if (typeof prompt === 'string') router.setParams({ prompt: undefined });
          setInput(value);
        }}
        onSend={() => { void send().catch((error) => { setGenerating(false); showMessage('Unable to send message', error instanceof Error ? error.message : 'Please try again.'); }); }}
        onStop={stop}
        disabled={sendDisabled}
        generating={generating}
        imageUri={pendingImage}
        onPickImage={provider ? attachImage : undefined}
        onRemoveImage={() => setPendingImage(null)}
        audio={pendingAudio}
        onRemoveAudio={() => setPendingAudio(null)}
        recording={voice.recording}
        recordingMs={voice.durationMs}
        onStartRecording={provider ? startRecording : undefined}
        onStopRecording={finishRecording}
        onCancelRecording={cancelRecording}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatHeaderIcon: { width: 36, height: 36, borderRadius: 18 },
  avatarWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusDot: { position: 'absolute', right: 0, bottom: 1, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 15, fontWeight: '700' },
  previewBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  previewText: { fontSize: 8, fontWeight: '700' },
  assistantSubtitle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  empty: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 8,
  },
  welcomeBubble: { alignSelf: 'flex-start', maxWidth: '84%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, borderTopLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 10, marginHorizontal: 14 },
  welcomeText: { fontSize: 12, lineHeight: 18 },
  welcomeTime: { fontSize: 8, marginTop: 5, marginHorizontal: 17 },
  emptySpacer: { flex: 1 },
  suggestionBar: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  chips: {
    flexDirection: 'row',
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 14,
  },
  chip: {
    minHeight: 27,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  chipDisabled: { opacity: 0.5 },
  list: { paddingTop: 12, paddingBottom: 12 },
});
