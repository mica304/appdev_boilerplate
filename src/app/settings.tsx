import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { deleteModel } from '@/ai/local';
import { exportBackup, pickBackup, restoreBackup } from '@/backup/backup';
import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { SmoothPressable } from '@/components/SmoothPressable';
import { clearAllConversations } from '@/db/conversations';
import { PRIVACY_POLICY } from '@/legal/content';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme, type Theme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

/** App-wide (system) settings. Chatbot options live in chat-settings.tsx. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update, reset } = useSettings();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  const run = async (job: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await job(), error: false });
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : 'Something went wrong.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const backup = () =>
    run(async () => `Backup created (${await exportBackup(settings)} messages).`);

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const b = await pickBackup();
      setBusy(false);
      if (!b) return; // picker cancelled
      confirmAction(
        'Restore backup?',
        `This replaces your current chat and settings with the backup from ${new Date(b.createdAt).toLocaleString()} (${b.messages.length} messages).`,
        'Restore',
        () =>
          void (async () => {
            setBusy(true);
            try {
              await restoreBackup(b, update);
              setStatus({ text: 'Backup restored.', error: false });
            } catch (e) {
              setStatus({
                text: e instanceof Error ? e.message : 'Restore failed.',
                error: true,
              });
            } finally {
              setBusy(false);
            }
          })()
      );
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : 'Something went wrong.',
        error: true,
      });
      setBusy(false);
    }
  };

  const resetAllData = () =>
    confirmAction(
      'Reset all data?',
      'This deletes your chat, nickname, settings, API key and the downloaded local model. The app will start again from onboarding.',
      'Reset',
      async () => {
        await clearAllConversations();
        await deleteModel();
        // Settings go back to defaults (onboarded = false), so the root
        // layout switches to the onboarding screen.
        await reset();
      }
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Section
        title="Data"
        theme={theme}
        expanded={dataExpanded}
        onToggle={() => setDataExpanded((expanded) => !expanded)}
      >
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Save your chat and settings to a file, or restore them later. Your
          Gemini API key and the downloaded local model are not included.
        </Text>
        <Button label="Back up data" icon="cloud-upload-outline" onPress={backup} disabled={busy} style={{ marginTop: 12 }} />
        <Button label="Restore from backup" icon="cloud-download-outline" variant="secondary" onPress={restore} disabled={busy} style={{ marginTop: 10 }} />
        {status && (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: status.error ? theme.danger : theme.success,
              marginTop: 8,
            }}
          >
            {status.text}
          </Text>
        )}
      </Section>

      <Section title="About" theme={theme}>
        <Row label="App" value={Constants.expoConfig?.name ?? '-'} theme={theme} />
        <Row label="Version" value={Constants.expoConfig?.version ?? '-'} theme={theme} />
        <DisclosureRow
          label="Privacy Policy"
          expanded={privacyExpanded}
          onPress={() => setPrivacyExpanded((expanded) => !expanded)}
          theme={theme}
        />
        {privacyExpanded && (
          <View style={styles.privacyContent}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Effective {PRIVACY_POLICY.effective}
            </Text>
            {PRIVACY_POLICY.sections.map((section) => (
              <View key={section.heading}>
                <Text style={[styles.privacyHeading, { color: theme.text }]}>{section.heading}</Text>
                {section.body.map((paragraph, index) => (
                  <Text key={index} style={[styles.privacyParagraph, { color: theme.text }]}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
        <LinkRow
          label="Terms & Conditions"
          onPress={() => router.push('/terms' as Href)}
          theme={theme}
        />
      </Section>

      <Button label="Reset all data" icon="trash-outline" variant="destructiveSecondary" onPress={resetAllData} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{value}</Text>
    </View>
  );
}

function DisclosureRow({
  label,
  expanded,
  onPress,
  theme,
}: {
  label: string;
  expanded: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <SmoothPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={[styles.row, styles.linkRow, { backgroundColor: theme.background }]}
    >
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={theme.textSecondary}
      />
    </SmoothPressable>
  );
}

/** Tappable row that navigates to another screen. */
function LinkRow({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <SmoothPressable onPress={onPress} accessibilityRole="link" style={[styles.row, styles.linkRow, { backgroundColor: theme.background }]}>
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  linkRow: { minHeight: 48, alignItems: 'center', marginTop: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10 },
  privacyContent: { paddingHorizontal: 4, paddingTop: 10 },
  privacyHeading: { fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 5 },
  privacyParagraph: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
