import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { habitColorsForTheme } from '@/home/habits';
import { loadPlanTasks, type PlanTask } from '@/home/plan';
import { showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

function getMonthDates(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}

function formatTaskDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getTaskTimeLabel(task: PlanTask) {
  return task.time || (task.kind === 'priority' ? 'Any time' : 'Time not set');
}

export default function HistoryScreen() {
  const theme = useTheme();
  const COLORS = useMemo(() => ({
    ...habitColorsForTheme(theme),
    raised: theme.surfaceRaised,
    teal: theme.tint,
    warning: theme.warning,
    ink: theme.background,
  }), [theme]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const router = useRouter();
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadPlanTasks()
        .then((saved) => {
          if (active) setTasks(saved);
        })
        .catch((error: unknown) => {
          if (active) {
            showMessage('Unable to load history', error instanceof Error ? error.message : 'Please try again.');
          }
        })
        .finally(() => {
          if (active) setReady(true);
        });
      return () => { active = false; };
    }, [])
  );

  const selected = dateFromKey(selectedDate);
  const todayKey = dateKey(new Date());
  const days = getMonthDates(selected);
  const completedCount = tasks.filter((task) => task.completed).length;
  const missedCount = tasks.filter((task) => !task.completed && task.date < todayKey).length;
  const daysLogged = new Set(tasks.map((task) => task.date)).size;
  const dayTasks = tasks
    .filter((task) => task.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const monthLabel = selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daySectionLabel = selectedDate === todayKey ? 'TODAY' : 'SELECTED DAY';

  const moveMonth = (direction: -1 | 1) => {
    setSelectedDate(dateKey(new Date(selected.getFullYear(), selected.getMonth() + direction, 1)));
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>Plan History</Text>
        <Text style={styles.subtitle}>Your past events and tasks</Text>

        <View style={styles.statsRow}>
          <StatCard value={completedCount} label="COMPLETED" color={COLORS.teal} styles={styles} secondary={COLORS.secondary} />
          <StatCard value={missedCount} label="MISSED" color={COLORS.warning} styles={styles} secondary={COLORS.secondary} />
          <StatCard value={daysLogged} label="DAYS LOGGED" color={COLORS.accent} styles={styles} secondary={COLORS.secondary} />
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <SmoothPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={styles.monthArrow}>
              <Ionicons name="chevron-back" size={15} color={COLORS.secondary} />
            </SmoothPressable>
            <View style={styles.calendarTitleBlock}>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <Text style={styles.calendarSubtitle}>{selectedDate === todayKey ? 'Today' : formatTaskDate(selected)}</Text>
            </View>
            <SmoothPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={styles.monthArrow}>
              <Ionicons name="chevron-forward" size={15} color={COLORS.secondary} />
            </SmoothPressable>
          </View>

          <View style={styles.calendarGrid}>
            {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
            ))}
            {days.map((day, index) => {
              const inMonth = day.getMonth() === selected.getMonth();
              if (!inMonth) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const key = dateKey(day);
              const active = key === selectedDate;
              const hasTasks = tasks.some((task) => task.date === key);
              return (
                <SmoothPressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatTaskDate(day)}${hasTasks ? ', has plans' : ''}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(key)}
                  style={[styles.dayCell, active && styles.dayCellSelected]}
                >
                  <Text style={[styles.dayNumber, active && styles.dayNumberSelected]}>{day.getDate()}</Text>
                  {hasTasks && !active && <View style={styles.dayDot} />}
                </SmoothPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.dayHeading}>
          <Text style={styles.dayEyebrow}>{daySectionLabel}</Text>
          <Text style={styles.dayTitle}>{formatTaskDate(selected)}</Text>
        </View>

        {!ready ? (
          <ActivityIndicator color={COLORS.accent} style={styles.loading} />
        ) : dayTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="calendar-outline" size={18} color={COLORS.secondary} /></View>
            <Text style={styles.emptyTitle}>No plans on this day</Text>
            <Text style={styles.emptyDescription}>Select another date to view its history.</Text>
            <SmoothPressable accessibilityRole="button" onPress={() => router.push('/plan' as Href)} style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>Open MyPlan</Text>
            </SmoothPressable>
          </View>
        ) : (
          <View style={styles.taskList}>
            {dayTasks.map((task, index) => (
              <View key={task.id} style={[styles.taskCard, index < dayTasks.length - 1 && styles.taskDivider]}>
                <View style={[styles.taskStatus, task.completed ? styles.taskStatusDone : styles.taskStatusOpen]}>
                  <Ionicons name={task.completed ? 'checkmark' : task.kind === 'schedule' ? 'time-outline' : 'ellipse-outline'} size={15} color={task.completed ? COLORS.teal : COLORS.secondary} />
                </View>
                <View style={styles.taskCopy}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>{task.title}</Text>
                  <Text style={styles.taskMeta}>{task.kind === 'priority' ? 'Priority' : 'Schedule'} · {getTaskTimeLabel(task)}</Text>
                  {!!task.reward && <Text style={styles.taskReward}>Reward: {task.reward}</Text>}
                </View>
                <Text style={[styles.taskState, task.completed ? styles.completedLabel : styles.pendingLabel]}>{task.completed ? 'DONE' : task.date < todayKey ? 'MISSED' : 'PLANNED'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ value, label, color, styles, secondary }: { value: number; label: string; color: string; secondary: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: secondary }]}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof habitColorsForTheme> & { raised: string; teal: string; warning: string; ink: string }) {
  const COLORS = colors;
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 22 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: COLORS.secondary, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 19, marginBottom: 18 },
  statCard: { flex: 1, minHeight: 61, borderRadius: 28, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  statValue: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
  statLabel: { color: COLORS.secondary, fontSize: 7, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  calendarCard: { borderRadius: 20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  calendarHeader: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthArrow: { width: 30, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.raised },
  calendarTitleBlock: { flex: 1, alignItems: 'center' },
  calendarTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  calendarSubtitle: { color: COLORS.secondary, fontSize: 9, marginTop: 3 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, height: 25, color: COLORS.muted, fontSize: 7, fontWeight: '700', textAlign: 'center', textAlignVertical: 'center' },
  dayCell: { width: `${100 / 7}%`, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  dayCellSelected: { backgroundColor: COLORS.accent },
  dayNumber: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  dayNumberSelected: { color: COLORS.ink, fontWeight: '800' },
  dayDot: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.teal },
  dayHeading: { marginTop: 19, marginBottom: 9 },
  dayEyebrow: { color: COLORS.secondary, fontSize: 9, fontWeight: '700' },
  dayTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  loading: { marginTop: 26 },
  emptyCard: { minHeight: 150, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  emptyIcon: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.raised, marginBottom: 8 },
  emptyTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  emptyDescription: { color: COLORS.secondary, fontSize: 9, marginTop: 5, textAlign: 'center' },
  emptyAction: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 17, backgroundColor: COLORS.raised, marginTop: 11 },
  emptyActionText: { color: COLORS.accent, fontSize: 10, fontWeight: '700' },
  taskList: { borderRadius: 18, backgroundColor: COLORS.surface, paddingHorizontal: 13 },
  taskCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  taskStatus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  taskStatusDone: { backgroundColor: COLORS.raised },
  taskStatusOpen: { backgroundColor: COLORS.raised },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  taskTitleDone: { color: COLORS.secondary, textDecorationLine: 'line-through' },
  taskMeta: { color: COLORS.secondary, fontSize: 9, marginTop: 3 },
  taskReward: { color: COLORS.teal, fontSize: 9, marginTop: 3 },
  taskState: { fontSize: 7, fontWeight: '800' },
  completedLabel: { color: COLORS.teal },
  pendingLabel: { color: COLORS.warning },
  });
}