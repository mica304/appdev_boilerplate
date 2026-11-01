import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SmoothPressable } from '@/components/SmoothPressable';
import {
  DEFAULT_HABITS,
  habitColorsForTheme,
  loadCompletedHabits,
  loadHabits,
  saveCompletedHabits,
} from '@/home/habits';
import type { Habit } from '@/home/habits';
import { showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';

const DAILY_TASK_TOTAL = 16;
const INITIAL_TASKS_LEFT = 15;

const HOME_HABIT_ORDER = ['walk', 'exercise', 'skincare'];

const NOTIFICATION_ITEMS = [
  {
    id: 'daily-progress',
    title: 'Daily Progress',
    description: '1 of 2 priorities completed today.',
    time: 'Just now',
    icon: 'sparkles',
    iconColor: '#80C98A',
  },
  {
    id: 'pending-priority',
    title: 'Pending Priority',
    description: '“Finish Q3 Report” is still pending.',
    time: 'Today',
    icon: 'time-outline',
    iconColor: '#80C98A',
  },
  {
    id: 'habits-reminder',
    title: 'Habits Reminder',
    description: '5 habits left to complete today.',
    time: 'Today',
    icon: 'checkmark-done-outline',
    iconColor: '#80C98A',
  },
] as const;

const AI_ACTIONS = [
  {
    label: 'Plan my priorities',
    prompt: 'Help me plan my priorities for today. Ask what I need to get done, then make a realistic schedule.',
  },
  {
    label: 'Check my habits',
    prompt: 'Help me review my habits for today. Ask what I have completed and encourage me to choose one next step.',
  },
  {
    label: '1-hour focus block',
    prompt: 'Help me set up a focused one-hour work block. Ask what task I want to work on, then make a simple timed plan.',
  },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const COLORS = useMemo(() => habitColorsForTheme(theme), [theme]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [completedHabits, setCompletedHabits] = useState<string[]>([]);
  const [habitsReady, setHabitsReady] = useState(false);
  const [savingHabits, setSavingHabits] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadHabits(), loadCompletedHabits()])
        .then(([savedHabits, completed]) => {
          if (!active) return;
          setHabits(savedHabits);
          const habitIds = new Set(savedHabits.map((habit) => habit.id));
          setCompletedHabits(completed.filter((id) => habitIds.has(id)));
        })
        .catch((error: unknown) => {
          if (active) {
            showMessage(
              'Unable to load habits',
              error instanceof Error ? error.message : 'Please try again.'
            );
          }
        })
        .finally(() => {
          if (active) setHabitsReady(true);
        });
      StatusBar.setBarStyle(theme.statusBar);
      return () => {
        active = false;
        StatusBar.setBarStyle(theme.statusBar);
      };
    }, [theme.statusBar])
  );

  const tasksLeft = Math.max(0, INITIAL_TASKS_LEFT - completedHabits.length);
  const progress = Math.min(
    100,
    Math.round(((DAILY_TASK_TOTAL - tasksLeft) / DAILY_TASK_TOTAL) * 100)
  );
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  }, []);
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
    []
  );
  const homeHabits = useMemo(() => {
    const preferred = HOME_HABIT_ORDER
      .map((id) => habits.find((habit) => habit.id === id))
      .filter((habit): habit is Habit => habit !== undefined);
    const remaining = habits.filter((habit) => !HOME_HABIT_ORDER.includes(habit.id));
    return [...preferred, ...remaining].slice(0, 3);
  }, [habits]);

  const openHabits = () => router.push('/habits' as Href);

  const toggleHabit = async (id: string) => {
    if (!habitsReady || savingHabits) return;
    const next = completedHabits.includes(id)
      ? completedHabits.filter((habitId) => habitId !== id)
      : [...completedHabits, id];
    setSavingHabits(true);
    try {
      await saveCompletedHabits(next);
      setCompletedHabits(next);
    } catch (error) {
      showMessage(
        'Unable to save habit',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSavingHabits(false);
    }
  };

  const openChat = (prompt?: string) => {
    if (prompt) {
      router.push({ pathname: '/chat', params: { prompt } });
    } else {
      router.push('/chat' as Href);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.brand}>mica</Text>
            <Text style={styles.todayLabel}>{todayLabel}</Text>
          </View>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setNotificationsVisible(true)}
            style={styles.headerButton}
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
            <View style={styles.notificationDot} />
          </SmoothPressable>
        </View>

        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`Daily Pulse, ${progress}% complete, ${tasksLeft} tasks left. Open habits.`}
          onPress={openHabits}
          style={styles.pulseCard}
        >
          <View style={styles.pulseTop}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Daily Pulse</Text>
              <Text style={styles.secondaryText}>{tasksLeft} tasks remaining today</Text>
            </View>
            <View style={styles.progressCircle}>
              <Svg width={52} height={52} viewBox="0 0 52 52" style={styles.progressRing}>
                <Circle cx={26} cy={26} r={22} fill="none" stroke={COLORS.divider} strokeWidth={4} />
                <Circle
                  accessibilityLabel={`${progress}% complete`}
                  cx={26}
                  cy={26}
                  r={22}
                  fill="none"
                  stroke={COLORS.accent}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - progress / 100)}
                  rotation={-90}
                  origin="26, 26"
                />
              </Svg>
              <View style={styles.progressCircleInner}>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            </View>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.progressTrack}
          >
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.pulseFooter}>
            <View style={styles.pulseFooterLabel}>
              <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.accent} />
              <Text style={styles.pulseFooterText}>{tasksLeft} items left to plan</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={COLORS.secondary} />
          </View>
        </SmoothPressable>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="heart-outline" size={19} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Habits</Text>
            <View style={styles.habitCountBadge}>
              <Text style={styles.habitCountText}>
                {homeHabits.filter((habit) => completedHabits.includes(habit.id)).length}/{homeHabits.length}
              </Text>
            </View>
          </View>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="See all habits"
            onPress={openHabits}
            hitSlop={8}
          >
            <Text style={styles.linkText}>See all</Text>
          </SmoothPressable>
        </View>

        <View style={styles.habitsCard}>
          {homeHabits.map((habit, index) => {
            const completed = completedHabits.includes(habit.id);
            return (
              <SmoothPressable
                key={habit.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${habit.title}, ${habit.time}`}
                accessibilityState={{ checked: completed, disabled: !habitsReady || savingHabits }}
                disabled={!habitsReady || savingHabits}
                onPress={() => void toggleHabit(habit.id)}
                style={[
                  styles.habitRow,
                  index < homeHabits.length - 1 && styles.habitDivider,
                  completed && styles.habitDone,
                ]}
              >
                <View style={[styles.checkCircle, completed && styles.checkedCircle]}>
                  {completed && <Ionicons name="checkmark" size={16} color={COLORS.background} />}
                </View>
                <View style={styles.habitTextBlock}>
                  <Text style={[styles.habitTitle, completed && styles.completedText]}>
                    {habit.title}
                  </Text>
                  <View style={styles.timeRow}>
                    <Text style={styles.habitTime}>{habit.time}</Text>
                    {habit.id === 'walk' && <Text style={styles.nextTag}>NEXT</Text>}
                  </View>
                </View>
              </SmoothPressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="hardware-chip-outline" size={18} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Nova AI Assistant</Text>
          </View>
        </View>

        <View style={styles.assistantCard}>
          <View style={styles.assistantIntro}>
            <View style={styles.assistantIcon}>
              <Ionicons name="hardware-chip-outline" size={21} color={COLORS.accent} />
            </View>
            <View style={styles.assistantCopy}>
              <Text style={styles.assistantTitle}>Plan your day with Nova</Text>
              <Text style={styles.assistantDescription}>
                Ask about your remaining priorities, track habit consistency, or get
                suggestions for focus blocks.
              </Text>
            </View>
          </View>
          <View style={styles.actionChips}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionChipList}>
              {AI_ACTIONS.map((action) => (
                <SmoothPressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={() => openChat(action.prompt)}
                  style={styles.actionChip}
                >
                  <Text style={styles.actionText}>{action.label}</Text>
                  <Ionicons name="arrow-forward" size={12} color={COLORS.accent} />
                </SmoothPressable>
              ))}
            </ScrollView>
          </View>
          <SmoothPressable
            accessibilityRole="button"
            onPress={() => openChat()}
            style={styles.openChatButton}
          >
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.background} />
            <Text style={styles.openChatText}>Open Chat with Nova</Text>
          </SmoothPressable>
        </View>
      </ScrollView>

      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.notificationOverlay}>
          <Pressable
            onPress={() => setNotificationsVisible(false)}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.notificationScrim} />
          </Pressable>
          <View style={styles.notificationPosition}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={[styles.notificationSheet, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.notificationHeaderTitle}>
                  <Ionicons name="notifications-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.notificationHeaderText}>Notifications</Text>
                </View>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications"
                  onPress={() => setNotificationsVisible(false)}
                  style={styles.notificationClose}
                >
                  <Ionicons name="close" size={17} color={COLORS.secondary} />
                </SmoothPressable>
              </View>

              <View style={[styles.notificationList, { backgroundColor: COLORS.surfaceRaised }]}>
                {NOTIFICATION_ITEMS.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.notificationItem,
                      index < NOTIFICATION_ITEMS.length - 1 && styles.notificationItemDivider,
                    ]}
                  >
                    <View style={styles.notificationIcon}>
                      <Ionicons name={item.icon as any} size={16} color={item.iconColor} />
                    </View>
                    <View style={styles.notificationDetails}>
                      <Text style={styles.notificationTitle}>{item.title}</Text>
                      <Text style={styles.notificationDescription}>{item.description}</Text>
                      <Text style={styles.notificationTime}>{item.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ReturnType<typeof habitColorsForTheme>) {
  const COLORS = colors;
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30, gap: 18 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  brandBlock: { flex: 1 },
  greeting: { color: COLORS.secondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.15 },
  brand: { color: COLORS.text, fontSize: 27, fontWeight: '900', letterSpacing: -1.2, lineHeight: 29 },
  todayLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  notificationOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  notificationScrim: {
    flex: 1,
  },
  notificationPosition: {
    position: 'absolute',
    right: 16,
    top: 58,
  },
  notificationSheet: {
    width: 330,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  notificationHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationHeaderText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  notificationClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: {
    borderRadius: 17,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 70,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  notificationItemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  notificationIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDetails: { flex: 1 },
  notificationTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  notificationDescription: {
    color: COLORS.secondary,
    fontSize: 10,
    lineHeight: 14,
  },
  notificationTime: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },
  pulseCard: {
    minHeight: 154,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    backgroundColor: COLORS.surface,
    shadowColor: '#08060C',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  pulseTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  secondaryText: { color: COLORS.secondary, fontSize: 11 },
  progressCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
  },
  progressCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 9, borderRadius: 6, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill: { height: '100%', minWidth: 9, borderRadius: 6, backgroundColor: COLORS.accent },
  pulseFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
    marginTop: 13,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseFooterLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseFooterText: { color: COLORS.secondary, fontSize: 10, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  habitCountBadge: { minWidth: 27, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceRaised },
  habitCountText: { color: COLORS.accent, fontSize: 9, fontWeight: '800' },
  linkText: { color: COLORS.accent, fontSize: 11, fontWeight: '700' },
  habitsCard: {
    overflow: 'hidden',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: '#08060C',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  habitRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
  habitDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  habitDone: { backgroundColor: COLORS.surfaceRaised },
  checkCircle: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCircle: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  habitTextBlock: { flex: 1, gap: 4 },
  habitTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  completedText: { textDecorationLine: 'line-through', color: COLORS.secondary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  habitTime: { color: COLORS.secondary, fontSize: 10 },
  nextTag: { color: COLORS.accent, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  assistantCard: {
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    backgroundColor: COLORS.surface,
    shadowColor: '#08060C',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  assistantIntro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assistantIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
  },
  assistantCopy: { flex: 1, paddingTop: 2 },
  assistantTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  assistantDescription: { color: COLORS.secondary, fontSize: 10, lineHeight: 15 },
  actionChips: { marginHorizontal: -16, marginTop: 15 },
  actionChipList: { gap: 8, paddingHorizontal: 16 },
  actionChip: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  openChatButton: {
    minHeight: 46,
    marginTop: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  openChatText: { color: COLORS.background, fontSize: 12, fontWeight: '800' },
  });
}
