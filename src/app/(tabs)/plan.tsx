import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SmoothPressable } from '@/components/SmoothPressable';
import { CollapsibleDeleteRow, useDeleteUndo } from '@/components/DeleteUndo';
import { TimeWheelPicker } from '@/components/TimeWheelPicker';
import { habitColorsForTheme } from '@/home/habits';
import { loadPlanTasks, savePlanTasks, type PlanTask } from '@/home/plan';
import { showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';

type TaskKind = PlanTask['kind'];
type AlarmSound = NonNullable<PlanTask['alarmSound']>;
type ReminderLead = NonNullable<PlanTask['remindBefore']>;

function currentTimestamp() {
  return Date.now();
}

function createTaskId() {
  return `${currentTimestamp()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateInput(key: string) {
  const [year, month, day] = key.split('-');
  return `${month}/${day}/${year}`;
}

function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return dateKey(date);
}

function parseTimeInput(value: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]), period: match[3].toUpperCase() as 'AM' | 'PM' };
}

function formatTimeInput(hour: number, minute: number, period: 'AM' | 'PM') {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function MyPlanScreen() {
  const theme = useTheme();
  const COLORS = useMemo(() => ({
    ...habitColorsForTheme(theme),
    raised: theme.surfaceRaised,
    teal: theme.tint,
    warning: theme.warning,
    ink: theme.background,
    danger: theme.danger,
  }), [theme]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const router = useRouter();
  const { quickAdd } = useLocalSearchParams<{ quickAdd?: string }>();
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const tasksRef = useRef(tasks);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const showUndo = useDeleteUndo();

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [prioritiesOnly, setPrioritiesOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [now, setNow] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorKind, setEditorKind] = useState<TaskKind>('priority');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [dateDraft, setDateDraft] = useState(selectedDate);
  const [dateInputDraft, setDateInputDraft] = useState(formatDateInput(selectedDate));
  const [rewardDraft, setRewardDraft] = useState('');
  const [alarmSound, setAlarmSound] = useState<AlarmSound>('bell');
  const [remindBefore, setRemindBefore] = useState<ReminderLead>('15m');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeDraft, setTimeDraft] = useState('');

  useEffect(() => {
    let active = true;
    void loadPlanTasks()
      .then((saved) => {
        const currentTime = Date.now();
        const cleaned = saved.map((task) =>
          task.snoozedUntil !== null && task.snoozedUntil <= currentTime
            ? { ...task, snoozedUntil: null }
            : task
        );
        if (active) {
          setTasks(cleaned);
          tasksRef.current = cleaned;
        }
        if (cleaned.some((task, index) => task.snoozedUntil !== saved[index].snoozedUntil)) {
          void savePlanTasks(cleaned);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          showMessage('Unable to load MyPlan', error instanceof Error ? error.message : 'Please try again.');
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const initialRefresh = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 30_000);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, []);

  const selected = dateFromKey(selectedDate);
  const monthLabel = selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dateLabel = selected.toLocaleDateString('en-US', { weekday: 'long' });
  const days = getMonthDates(selected);
  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter((task) => task.date === selectedDate || !!needle)
      .filter((task) => !prioritiesOnly || task.kind === 'priority' || !!needle)
      .filter((task) => !needle || task.title.toLowerCase().includes(needle));
  }, [prioritiesOnly, query, selectedDate, tasks]);
  const pendingTasks = visibleTasks.filter((task) => !task.completed);
  const completedTasks = visibleTasks.filter((task) => task.completed);
  const priorityFormValid = titleDraft.trim().length > 0 && parseDateInput(dateInputDraft) !== null;
  const scheduleFormValid = titleDraft.trim().length > 0 && parseDateInput(dateInputDraft) !== null && parseTimeInput(timeDraft) !== null;
  const parsedTime = parseTimeInput(timeDraft) ?? { hour: 9, minute: 0, period: 'AM' as const };

  const commitTasks = async (next: PlanTask[]) => {
    setSaving(true);
    try {
      await savePlanTasks(next);
      setTasks(next);
      tasksRef.current = next;
    } catch (error) {
      showMessage('Unable to save task', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const moveDate = (direction: -1 | 1) => {
    const targetMonth = selected.getMonth() + direction;
    const next = new Date(selected.getFullYear(), targetMonth, 1);
    setSelectedDate(dateKey(next));
  };

  const openEditor = useCallback((kind: TaskKind, task?: PlanTask) => {
    setPrioritiesOnly(kind === 'priority');
    setEditorKind(kind);
    setEditingId(task?.id ?? null);
    setTitleDraft(task?.title ?? '');
    setDateDraft(task?.date ?? selectedDate);
    setDateInputDraft(task ? formatDateInput(task.date) : kind === 'priority' ? '' : formatDateInput(selectedDate));
    setRewardDraft(task?.reward ?? '');
    setAlarmSound(task?.alarmSound ?? 'bell');
    setRemindBefore(task?.remindBefore ?? '15m');
    setCalendarMonth(dateFromKey(task?.date ?? selectedDate));
    setCalendarVisible(false);
    setTimePickerVisible(false);
    setTimeDraft(task?.time ?? (kind === 'schedule' ? '9:00 AM' : ''));
    setEditorVisible(true);
  }, [selectedDate]);

  useEffect(() => {
    if (quickAdd !== 'priority' && quickAdd !== 'schedule') return;
    const timer = setTimeout(() => {
      openEditor(quickAdd);
      router.setParams({ quickAdd: undefined });
    }, 0);
    return () => clearTimeout(timer);
  }, [openEditor, quickAdd, router]);

  const saveEditor = () => {
    const title = titleDraft.trim();
    const savedDate = parseDateInput(dateInputDraft);
    if (!title) {
      showMessage('Task name required', 'Enter a name before saving this task.');
      return;
    }
    if (editorKind === 'schedule' && !parseTimeInput(timeDraft)) {
      showMessage('Invalid start time', 'Choose or enter a valid time, such as 09:00 AM.');
      return;
    }
    if (!savedDate || !/^\d{4}-\d{2}-\d{2}$/.test(savedDate) || Number.isNaN(dateFromKey(savedDate).getTime())) {
      showMessage('Invalid date', 'Enter a valid date in MM/DD/YYYY format.');
      return;
    }
    const planDetails = editorKind === 'priority'
      ? { reward: rewardDraft.trim(), alarmSound, remindBefore }
      : { reward: undefined, alarmSound, remindBefore };
    const next = editingId
      ? tasks.map((task) => task.id === editingId
        ? { ...task, title, date: savedDate, time: timeDraft.trim(), kind: editorKind, ...planDetails }
        : task)
      : [{
          id: createTaskId(),
          title,
          date: savedDate,
          time: timeDraft.trim(),
          kind: editorKind,
          completed: false,
          snoozedUntil: null,
              ...planDetails,
        }, ...tasks];
    setEditorVisible(false);
    setCalendarVisible(false);
            setTimePickerVisible(false);
    void commitTasks(next);
  };

  const toggleCompleted = (task: PlanTask) => {
    void commitTasks(tasks.map((item) => item.id === task.id
      ? { ...item, completed: !item.completed, snoozedUntil: null }
      : item));
  };

  const snooze = (task: PlanTask) => {
    const timestamp = currentTimestamp();
    const snoozedUntil = task.snoozedUntil !== null && task.snoozedUntil > timestamp
      ? null
      : timestamp + 15 * 60 * 1000;
    void commitTasks(tasks.map((item) => item.id === task.id ? { ...item, snoozedUntil } : item));
  };

  const deleteTask = () => {
    if (!editingId || deletingTaskId !== null || saving) return;
    setEditorVisible(false);
    setCalendarVisible(false);
    setTimePickerVisible(false);
    setDeletingTaskId(editingId);
  };

  const finishDeleteTask = async (task: PlanTask) => {
    const previousTasks = tasksRef.current;
    const removedIndex = previousTasks.findIndex((item) => item.id === task.id);
    if (removedIndex < 0) {
      setDeletingTaskId(null);
      return;
    }
    const nextTasks = previousTasks.filter((item) => item.id !== task.id);
    setSaving(true);
    setTasks(nextTasks);
    tasksRef.current = nextTasks;
    try {
      await savePlanTasks(nextTasks);
      showUndo(`Deleted ${task.title}`, async () => {
        const restoredTasks = [...tasksRef.current];
        restoredTasks.splice(Math.min(removedIndex, restoredTasks.length), 0, task);
        await savePlanTasks(restoredTasks);
        setTasks(restoredTasks);
        tasksRef.current = restoredTasks;
      });
    } catch (error) {
      setTasks(previousTasks);
      tasksRef.current = previousTasks;
      showMessage('Unable to delete task', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDeletingTaskId(null);
      setSaving(false);
    }
  };

  const selectCalendarDate = (date: Date) => {
    const key = dateKey(date);
    setDateDraft(key);
    setDateInputDraft(formatDateInput(key));
    setCalendarVisible(false);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Ionicons name="search-outline" size={18} color={COLORS.secondary} />
          <TextInput
            accessibilityLabel="Search past errands"
            placeholder="Search past errands..."
            placeholderTextColor={COLORS.muted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={[
              styles.searchInput,
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            ]}
            underlineColorAndroid="transparent"
            selectionColor={COLORS.accent}
            returnKeyType="search"
          />
          {!!query && (
            <SmoothPressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
            </SmoothPressable>
          )}
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.calendarCard}>
          <View style={styles.dateHeader}>
            <SmoothPressable accessibilityLabel="Previous date" onPress={() => moveDate(-1)} style={styles.arrowButton}>
              <Ionicons name="chevron-back" size={21} color={COLORS.text} />
            </SmoothPressable>
            <View style={styles.dateCenter}>
              <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
              <Text style={styles.weekdayLabel}>{dateLabel}</Text>
              <Text style={styles.dayLabel}>{selected.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
            </View>
            <SmoothPressable accessibilityLabel="Next date" onPress={() => moveDate(1)} style={styles.arrowButton}>
              <Ionicons name="chevron-forward" size={21} color={COLORS.text} />
            </SmoothPressable>
          </View>

          <View style={styles.monthGrid}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.monthWeekday}>{day}</Text>)}
            {days.map((day, index) => {
              const key = dateKey(day);
              const active = key === selectedDate;
              const inMonth = day.getMonth() === selected.getMonth();
              if (!inMonth) return <View key={`${key}-${index}`} style={styles.monthDay} />;
              return (
                <SmoothPressable key={`${key}-${index}`} accessibilityLabel={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} accessibilityState={{ selected: active }} onPress={() => setSelectedDate(key)} style={[styles.monthDay, active && styles.monthDayActive]}>
                  <Text style={[styles.monthDayText, active && styles.monthDayTextActive]}>{day.getDate()}</Text>
                </SmoothPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filterBar}>
          <SmoothPressable accessibilityRole="tab" accessibilityState={{ selected: prioritiesOnly }} onPress={() => setPrioritiesOnly(true)} style={[styles.filterOption, prioritiesOnly && styles.filterSelected]}>
            <Ionicons name="gift-outline" size={14} color={prioritiesOnly ? COLORS.ink : COLORS.secondary} />
            <Text style={[styles.filterText, prioritiesOnly && styles.filterTextSelected]}>Top Priorities</Text>
          </SmoothPressable>
          <SmoothPressable accessibilityRole="tab" accessibilityState={{ selected: !prioritiesOnly }} onPress={() => setPrioritiesOnly(false)} style={[styles.filterOption, !prioritiesOnly && styles.filterSelected]}>
            <Ionicons name="calendar-outline" size={14} color={!prioritiesOnly ? COLORS.ink : COLORS.secondary} />
            <Text style={[styles.filterText, !prioritiesOnly && styles.filterTextSelected]}>Schedule</Text>
          </SmoothPressable>
        </View>

        <View style={styles.actionRow}>
          <SmoothPressable onPress={() => openEditor('priority')} style={styles.actionButton} accessibilityLabel="Add priority">
            <Ionicons name="add" size={16} color={COLORS.text} />
            <Text style={styles.actionText}>Add Priority</Text>
          </SmoothPressable>
          <SmoothPressable onPress={() => openEditor('schedule')} style={styles.actionButton} accessibilityLabel="Add schedule">
            <Ionicons name="time-outline" size={15} color={COLORS.text} />
            <Text style={styles.actionText}>Add Schedule</Text>
          </SmoothPressable>
        </View>

        {!ready ? (
          <ActivityIndicator color={COLORS.accent} style={styles.loading} />
        ) : (
          <>
            {pendingTasks.map((task) => (
              <CollapsibleDeleteRow
                key={task.id}
                collapsing={deletingTaskId === task.id}
                onCollapsed={() => void finishDeleteTask(task)}
              >
                <View style={styles.taskCard}>
                  <SmoothPressable accessibilityRole="checkbox" accessibilityLabel={`Complete ${task.title}`} accessibilityState={{ checked: false, disabled: saving }} disabled={saving} onPress={() => toggleCompleted(task)} style={styles.checkButton}>
                    <View style={styles.emptyCheck} />
                  </SmoothPressable>
                  <View style={styles.taskBody}>
                    <View style={styles.taskTitleRow}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {!!task.time && (
                        <View style={styles.timeBadge}>
                          <Ionicons name="notifications-outline" size={12} color={COLORS.warning} />
                          <Text style={styles.timeBadgeText}>{task.time}</Text>
                        </View>
                      )}
                      <SmoothPressable accessibilityLabel={`Edit ${task.title}`} onPress={() => openEditor(task.kind, task)} style={styles.editButton}>
                        <Ionicons name="pencil" size={13} color={COLORS.secondary} />
                      </SmoothPressable>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="gift-outline" size={13} color={COLORS.secondary} />
                      <Text style={styles.detailText}>{task.reward ? `Reward: ${task.reward}` : task.kind === 'priority' ? 'Top priority' : 'Scheduled task'}</Text>
                      {query.trim() !== '' && task.date !== selectedDate && <Text style={styles.snoozeNote}>{dateFromKey(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>}
                      {task.snoozedUntil !== null && task.snoozedUntil > now && <Text style={styles.snoozeNote}>Until {formatTime(new Date(task.snoozedUntil))}</Text>}
                    </View>
                    <View style={styles.taskActions}>
                      <SmoothPressable disabled={saving} onPress={() => toggleCompleted(task)} style={styles.completeButton}>
                        <Text style={styles.completeText}>Complete Task</Text>
                      </SmoothPressable>
                      <SmoothPressable disabled={saving} onPress={() => snooze(task)} style={styles.snoozeButton}>
                        <Ionicons name="time-outline" size={13} color={COLORS.secondary} />
                        <Text style={styles.snoozeText}>{task.snoozedUntil !== null && task.snoozedUntil > now ? 'Undo Snooze' : 'Snooze 15m'}</Text>
                      </SmoothPressable>
                    </View>
                  </View>
                </View>
              </CollapsibleDeleteRow>
            ))}

            {completedTasks.map((task) => (
              <CollapsibleDeleteRow
                key={task.id}
                collapsing={deletingTaskId === task.id}
                onCollapsed={() => void finishDeleteTask(task)}
              >
                <View style={styles.completedCard}>
                  <SmoothPressable accessibilityRole="checkbox" accessibilityLabel={`Mark ${task.title} incomplete`} accessibilityState={{ checked: true, disabled: saving }} disabled={saving} onPress={() => toggleCompleted(task)} style={styles.checkButton}>
                    <View style={styles.doneCheck}><Ionicons name="checkmark" size={15} color={COLORS.teal} /></View>
                  </SmoothPressable>
                  <View style={styles.completedBody}>
                    <View style={styles.taskTitleRow}>
                      <Text style={styles.completedTitle}>{task.title}</Text>
                      <SmoothPressable accessibilityLabel={`Edit ${task.title}`} onPress={() => openEditor(task.kind, task)} style={styles.editButton}><Ionicons name="pencil" size={13} color={COLORS.secondary} /></SmoothPressable>
                    </View>
                    <View style={styles.rewardBadge}>
                      <Ionicons name="gift-outline" size={14} color={COLORS.teal} />
                      <Text style={styles.rewardText}>Unlocked: Guilt-free reading time</Text>
                    </View>
                  </View>
                </View>
              </CollapsibleDeleteRow>
            ))}

            {visibleTasks.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name={query ? 'search-outline' : 'calendar-clear-outline'} size={24} color={COLORS.muted} />
                <Text style={styles.emptyTitle}>{query ? 'No matching tasks' : 'Nothing planned yet'}</Text>
                <Text style={styles.emptyCopy}>{query ? 'Try another search.' : 'Add a priority or schedule to get started.'}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={editorVisible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => { setEditorVisible(false); setCalendarVisible(false); }}>
        {editorKind === 'priority' ? (
          <KeyboardAvoidingView style={styles.priorityBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
            <SmoothPressable accessibilityLabel="Close new priority form" onPress={() => { setEditorVisible(false); setCalendarVisible(false); }} style={styles.priorityScrim} />
            <View style={styles.prioritySheet}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.priorityContent}>
                <Text accessibilityRole="header" style={styles.priorityTitle}>{editingId ? 'Edit Plan' : 'New Plan'}</Text>
                <Text style={styles.prioritySubtitle}>{editingId ? 'Update your plan details' : 'Add a new item to your day'}</Text>

                <Text style={styles.priorityLabel}>TITLE</Text>
                <TextInput placeholder="e.g. Finish presentation" placeholderTextColor={COLORS.secondary} value={titleDraft} onChangeText={setTitleDraft} style={[styles.priorityInput, styles.titleInput]} returnKeyType="next" />

                <Text style={styles.priorityLabel}>REWARD WHEN DONE</Text>
                <TextInput placeholder="e.g. Watch an episode, take a walk..." placeholderTextColor={COLORS.secondary} value={rewardDraft} onChangeText={setRewardDraft} style={styles.priorityInput} returnKeyType="next" />

                <Text style={styles.priorityLabel}>DUE DATE</Text>
                <View style={styles.dateInputRow}>
                  <TextInput accessibilityLabel="Due date, month day year" placeholder="mm/dd/yyyy" placeholderTextColor={COLORS.secondary} value={dateInputDraft} onChangeText={setDateInputDraft} style={[styles.priorityInput, styles.dateTextInput]} keyboardType="numbers-and-punctuation" returnKeyType="done" />
                  <SmoothPressable accessibilityRole="button" accessibilityLabel="Choose due date" onPress={() => setCalendarVisible((visible) => !visible)} style={styles.calendarButton}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.secondary} />
                  </SmoothPressable>
                </View>

                {calendarVisible && (
                  <View style={styles.datePicker}>
                    <View style={styles.datePickerHeader}>
                      <SmoothPressable accessibilityLabel="Previous month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.datePickerArrow}><Ionicons name="chevron-back" size={17} color={COLORS.text} /></SmoothPressable>
                      <Text style={styles.datePickerMonth}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                      <SmoothPressable accessibilityLabel="Next month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.datePickerArrow}><Ionicons name="chevron-forward" size={17} color={COLORS.text} /></SmoothPressable>
                    </View>
                    <View style={styles.datePickerGrid}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.datePickerWeekday}>{day}</Text>)}
                      {getMonthDates(calendarMonth).map((day, index) => {
                        const selectedDay = dateKey(day) === dateDraft;
                        const inMonth = day.getMonth() === calendarMonth.getMonth();
                        return (
                          <SmoothPressable key={`${dateKey(day)}-${index}`} accessibilityLabel={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: selectedDay }} onPress={() => selectCalendarDate(day)} style={[styles.datePickerDay, selectedDay && styles.datePickerDaySelected]}>
                            <Text style={[styles.datePickerDayText, !inMonth && styles.datePickerOutside, selectedDay && styles.datePickerDayTextSelected]}>{day.getDate()}</Text>
                          </SmoothPressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Text style={styles.priorityLabel}>ALARM SOUND</Text>
                <View style={styles.choiceRow}>
                  {(['none', 'bell', 'chime', 'pulse'] as const).map((choice) => (
                    <SmoothPressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: alarmSound === choice }} onPress={() => setAlarmSound(choice)} style={[styles.choiceButton, alarmSound === choice && styles.choiceButtonSelected]}>
                      <Text style={[styles.choiceText, alarmSound === choice && styles.choiceTextSelected]}>{choice === 'none' ? 'None' : choice[0].toUpperCase() + choice.slice(1)}</Text>
                    </SmoothPressable>
                  ))}
                </View>

                <Text style={styles.priorityLabel}>REMIND BEFORE</Text>
                <View style={styles.choiceRow}>
                  {(['5m', '10m', '15m', '30m', '1hr'] as const).map((choice) => (
                    <SmoothPressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: remindBefore === choice }} onPress={() => setRemindBefore(choice)} style={[styles.choiceButton, styles.reminderButton, remindBefore === choice && styles.choiceButtonSelected]}>
                      <Text style={[styles.choiceText, remindBefore === choice && styles.choiceTextSelected]}>{choice}</Text>
                    </SmoothPressable>
                  ))}
                </View>

                <View style={styles.priorityActions}>
                  {editingId && <SmoothPressable accessibilityLabel="Delete plan" onPress={deleteTask} style={styles.deleteButton}><Ionicons name="trash-outline" size={17} color={COLORS.danger} /></SmoothPressable>}
                  <SmoothPressable disabled={saving || !priorityFormValid} onPress={saveEditor} style={[styles.addPlanButton, (saving || !priorityFormValid) && styles.addPlanButtonDisabled]}>
                    <Text style={styles.addPlanText}>{saving ? 'Saving...' : editingId ? 'Save Plan' : 'Add Plan'}</Text>
                  </SmoothPressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <KeyboardAvoidingView style={styles.priorityBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
            <SmoothPressable accessibilityLabel="Close new schedule form" onPress={() => { setEditorVisible(false); setTimePickerVisible(false); }} style={styles.priorityScrim} />
            <View style={[styles.prioritySheet, styles.scheduleSheet]}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.priorityContent}>
                <Text accessibilityRole="header" style={styles.priorityTitle}>{editingId ? 'Edit Plan' : 'New Plan'}</Text>
                <Text style={styles.prioritySubtitle}>{editingId ? 'Update your plan details' : 'Add a new item to your day'}</Text>

                <Text style={styles.priorityLabel}>TITLE</Text>
                <TextInput placeholder="e.g. Doctor appointment" placeholderTextColor={COLORS.secondary} value={titleDraft} onChangeText={setTitleDraft} style={[styles.priorityInput, styles.titleInput]} returnKeyType="next" />

                <Text style={styles.priorityLabel}>DATE</Text>
                <View style={styles.dateInputRow}>
                  <TextInput accessibilityLabel="Schedule date, month day year" placeholder="mm/dd/yyyy" placeholderTextColor={COLORS.secondary} value={dateInputDraft} onChangeText={setDateInputDraft} style={[styles.priorityInput, styles.dateTextInput]} keyboardType="numbers-and-punctuation" returnKeyType="done" />
                  <SmoothPressable accessibilityRole="button" accessibilityLabel="Choose schedule date" accessibilityState={{ expanded: calendarVisible }} onPress={() => setCalendarVisible((visible) => !visible)} style={styles.calendarButton}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.secondary} />
                  </SmoothPressable>
                </View>

                {calendarVisible && (
                  <View style={styles.datePicker}>
                    <View style={styles.datePickerHeader}>
                      <SmoothPressable accessibilityLabel="Previous month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.datePickerArrow}><Ionicons name="chevron-back" size={17} color={COLORS.text} /></SmoothPressable>
                      <Text style={styles.datePickerMonth}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                      <SmoothPressable accessibilityLabel="Next month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.datePickerArrow}><Ionicons name="chevron-forward" size={17} color={COLORS.text} /></SmoothPressable>
                    </View>
                    <View style={styles.datePickerGrid}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.datePickerWeekday}>{day}</Text>)}
                      {getMonthDates(calendarMonth).map((day, index) => {
                        const selectedDay = dateKey(day) === dateDraft;
                        const inMonth = day.getMonth() === calendarMonth.getMonth();
                        return (
                          <SmoothPressable key={`${dateKey(day)}-${index}`} accessibilityLabel={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected: selectedDay }} onPress={() => selectCalendarDate(day)} style={[styles.datePickerDay, selectedDay && styles.datePickerDaySelected]}>
                            <Text style={[styles.datePickerDayText, !inMonth && styles.datePickerOutside, selectedDay && styles.datePickerDayTextSelected]}>{day.getDate()}</Text>
                          </SmoothPressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Text style={styles.priorityLabel}>START TIME</Text>
                <View style={styles.dateInputRow}>
                  <Text style={[styles.priorityInput, styles.dateTextInput]}>{timeDraft || 'Select time'}</Text>
                  <SmoothPressable accessibilityRole="button" accessibilityLabel={timePickerVisible ? 'Close time picker' : 'Choose start time'} accessibilityState={{ expanded: timePickerVisible }} onPress={() => setTimePickerVisible((visible) => !visible)} style={styles.calendarButton}>
                    <Ionicons name="time-outline" size={16} color={COLORS.secondary} />
                  </SmoothPressable>
                </View>

                {timePickerVisible && (
                  <TimeWheelPicker
                    value={parsedTime}
                    onChange={({ hour, minute, period }) => setTimeDraft(formatTimeInput(hour, minute, period))}
                    colors={COLORS}
                  />
                )}

                <Text style={styles.priorityLabel}>ALARM SOUND</Text>
                <View style={styles.choiceRow}>
                  {(['none', 'bell', 'chime', 'pulse'] as const).map((choice) => (
                    <SmoothPressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: alarmSound === choice }} onPress={() => setAlarmSound(choice)} style={[styles.choiceButton, alarmSound === choice && styles.choiceButtonSelected]}>
                      <Text style={[styles.choiceText, alarmSound === choice && styles.choiceTextSelected]}>{choice === 'none' ? 'None' : choice[0].toUpperCase() + choice.slice(1)}</Text>
                    </SmoothPressable>
                  ))}
                </View>

                <Text style={styles.priorityLabel}>REMIND BEFORE</Text>
                <View style={styles.choiceRow}>
                  {(['5m', '10m', '15m', '30m', 'off'] as const).map((choice) => (
                    <SmoothPressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: remindBefore === choice }} onPress={() => setRemindBefore(choice)} style={[styles.choiceButton, styles.reminderButton, remindBefore === choice && styles.choiceButtonSelected]}>
                      <Text style={[styles.choiceText, remindBefore === choice && styles.choiceTextSelected]}>{choice === 'off' ? 'Off' : choice}</Text>
                    </SmoothPressable>
                  ))}
                </View>

                <View style={styles.priorityActions}>
                  {editingId && <SmoothPressable accessibilityLabel="Delete schedule" onPress={deleteTask} style={styles.deleteButton}><Ionicons name="trash-outline" size={17} color={COLORS.danger} /></SmoothPressable>}
                  <SmoothPressable disabled={saving || !scheduleFormValid} onPress={saveEditor} style={[styles.addPlanButton, (saving || !scheduleFormValid) && styles.addPlanButtonDisabled]}>
                    <Text style={styles.addPlanText}>{saving ? 'Saving...' : editingId ? 'Save Plan' : 'Add Plan'}</Text>
                  </SmoothPressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof habitColorsForTheme> & { raised: string; teal: string; warning: string; ink: string; danger: string }) {
  const COLORS = colors;
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  searchBox: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: 'transparent' },
  searchBoxFocused: { borderColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginTop: 12, marginHorizontal: -18 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 13, paddingVertical: 9, paddingHorizontal: 0, borderWidth: 0, backgroundColor: 'transparent' },
  calendarCard: {
    marginTop: 14,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 8,
  },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrowButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { alignItems: 'center' },
  monthLabel: { color: COLORS.accent, fontSize: 10, fontWeight: '700' },
  weekdayLabel: { color: COLORS.text, fontSize: 21, lineHeight: 26, fontWeight: '800' },
  dayLabel: { color: COLORS.secondary, fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  monthWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: COLORS.secondary, fontSize: 10, paddingVertical: 5 },
  monthDay: { width: `${100 / 7}%`, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthDayActive: { backgroundColor: COLORS.accent, borderRadius: 16 },
  monthDayText: { color: COLORS.text, fontSize: 12 },
  monthDayTextActive: { color: COLORS.ink, fontWeight: '800' },
  outsideMonth: { color: COLORS.muted },
  filterBar: { height: 42, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 23, flexDirection: 'row', padding: 4, marginTop: 14 },
  filterOption: { flex: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  filterSelected: { backgroundColor: COLORS.accent },
  filterText: { color: COLORS.secondary, fontSize: 11, fontWeight: '600' },
  filterTextSelected: { color: COLORS.ink, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 18 },
  actionButton: { flex: 1, height: 34, borderRadius: 19, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  loading: { marginTop: 28 },
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: 10 },
  checkButton: { width: 30, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  emptyCheck: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: COLORS.muted },
  taskBody: { flex: 1, minWidth: 0 },
  taskTitleRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  timeBadge: { height: 20, paddingHorizontal: 6, gap: 3, borderRadius: 10, backgroundColor: COLORS.raised, flexDirection: 'row', alignItems: 'center' },
  timeBadgeText: { color: COLORS.warning, fontSize: 9, fontWeight: '700' },
  editButton: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.raised },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, minHeight: 16 },
  detailText: { color: COLORS.secondary, fontSize: 11, flexShrink: 1 },
  snoozeNote: { color: COLORS.warning, fontSize: 10, marginLeft: 'auto' },
  taskActions: { flexDirection: 'row', gap: 7, marginTop: 8 },
  completeButton: { flex: 1, minHeight: 31, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  completeText: { color: COLORS.ink, fontSize: 11, fontWeight: '700' },
  snoozeButton: { flex: 1, minHeight: 31, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  snoozeText: { color: COLORS.secondary, fontSize: 10, fontWeight: '600' },
  completedCard: { minHeight: 108, flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 20, backgroundColor: COLORS.raised, marginTop: 1, marginBottom: 10 },
  doneCheck: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  completedBody: { flex: 1, minWidth: 0 },
  completedTitle: { flex: 1, color: COLORS.secondary, fontSize: 14, fontWeight: '700', textDecorationLine: 'line-through' },
  rewardBadge: { minHeight: 31, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 10, borderRadius: 17, backgroundColor: COLORS.raised, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 13 },
  rewardText: { color: COLORS.teal, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  emptyCopy: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.56)', justifyContent: 'center', padding: 20 },
  priorityBackdrop: { flex: 1, justifyContent: 'flex-end' },
  priorityScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.56)' },
  prioritySheet: { width: '100%', height: '73%', maxHeight: '86%', minHeight: 500, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 34, paddingBottom: 26 },
  scheduleSheet: { height: '60%', minHeight: 430, paddingTop: 34 },
  priorityContent: { paddingBottom: 2 },
  priorityTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  prioritySubtitle: { color: COLORS.secondary, fontSize: 10, fontWeight: '500', marginTop: 6, marginBottom: 18 },
  priorityLabel: { color: COLORS.secondary, fontSize: 9, fontWeight: '700', marginTop: 13, marginBottom: 7 },
  priorityInput: { minHeight: 37, borderRadius: 22, paddingHorizontal: 14, backgroundColor: COLORS.surface, color: COLORS.text, fontSize: 11, fontWeight: '500' },
  titleInput: { borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: 'transparent' },
  dateInputRow: { minHeight: 37, flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: COLORS.surface },
  dateTextInput: { flex: 1, backgroundColor: 'transparent' },
  calendarButton: { width: 42, height: 37, alignItems: 'center', justifyContent: 'center' },
  datePicker: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: COLORS.raised },
  datePickerHeader: { height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerArrow: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  datePickerMonth: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  datePickerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  datePickerWeekday: { width: `${100 / 7}%`, color: COLORS.muted, fontSize: 9, textAlign: 'center', paddingVertical: 5 },
  datePickerDay: { width: `${100 / 7}%`, height: 29, alignItems: 'center', justifyContent: 'center' },
  datePickerDaySelected: { borderRadius: 15, backgroundColor: COLORS.accent },
  datePickerDayText: { color: COLORS.text, fontSize: 10 },
  datePickerDayTextSelected: { color: COLORS.ink, fontWeight: '700' },
  datePickerOutside: { color: COLORS.muted },
  choiceRow: { flexDirection: 'row', gap: 7 },
  choiceButton: { flex: 1, minWidth: 0, height: 30, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  reminderButton: { height: 30 },
  choiceButtonSelected: { backgroundColor: COLORS.accent },
  choiceText: { color: COLORS.secondary, fontSize: 9, fontWeight: '600' },
  choiceTextSelected: { color: COLORS.ink, fontWeight: '700' },
  priorityActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  addPlanButton: { flex: 1, height: 43, borderRadius: 24, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  addPlanButtonDisabled: { opacity: 0.65 },
  addPlanText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  editor: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  editorHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  editorTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { color: COLORS.secondary, fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  formInput: { minHeight: 43, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, fontSize: 13 },
  editorActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  deleteButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(181, 72, 63, 0.16)', marginRight: 'auto' },
  cancelButton: { height: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  cancelText: { color: COLORS.secondary, fontSize: 12, fontWeight: '600' },
  saveButton: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  saveText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  });
}