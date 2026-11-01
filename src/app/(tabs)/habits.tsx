import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { CollapsibleDeleteRow, useDeleteUndo } from '@/components/DeleteUndo';
import { TimeWheelPicker } from '@/components/TimeWheelPicker';
import {
  DEFAULT_HABITS,
  habitColorsForTheme,
  loadCompletedHabits,
  loadHabits,
  saveCompletedHabits,
  saveHabits,
  type Habit,
} from '@/home/habits';
import { confirmAction, showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';

function parseTime(value: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.exec(value.trim());
  if (!match) return { hour: 9, minute: 0, period: 'AM' as const };
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    period: match[3].toUpperCase() as 'AM' | 'PM',
  };
}

function formatTime(hour: number, minute: number, period: 'AM' | 'PM') {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function HabitsScreen() {
  const theme = useTheme();
  const COLORS = useMemo(() => habitColorsForTheme(theme), [theme]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const router = useRouter();
  const { quickAdd } = useLocalSearchParams<{ quickAdd?: string }>();
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [completedHabits, setCompletedHabits] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00 AM');
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);
  const habitsRef = useRef(habits);
  const completedHabitsRef = useRef(completedHabits);
  const showUndo = useDeleteUndo();

  React.useEffect(() => {
    habitsRef.current = habits;
    completedHabitsRef.current = completedHabits;
  }, [completedHabits, habits]);

  React.useEffect(() => {
    if (quickAdd !== 'habit') return;
    const timer = setTimeout(() => {
      setTime('09:00 AM');
      setAddVisible(true);
      router.setParams({ quickAdd: undefined });
    }, 0);
    return () => clearTimeout(timer);
  }, [quickAdd, router]);

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
          if (active) setReady(true);
        });
      StatusBar.setBarStyle(theme.statusBar);
      return () => {
        active = false;
      };
    }, [theme.statusBar])
  );

  const toggleHabit = async (id: string) => {
    if (!ready || busy) return;
    const next = completedHabits.includes(id)
      ? completedHabits.filter((habitId) => habitId !== id)
      : [...completedHabits, id];
    setBusy(true);
    try {
      await saveCompletedHabits(next);
      setCompletedHabits(next);
    } catch (error) {
      showMessage(
        'Unable to save habit',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const addHabit = async () => {
    const cleanTitle = title.trim();
    const cleanTime = time.trim();
    if (!cleanTitle || !cleanTime) {
      showMessage('Missing habit details', 'Enter a habit name and time to continue.');
      return;
    }
    if (habits.some((habit) => habit.title.toLocaleLowerCase() === cleanTitle.toLocaleLowerCase())) {
      showMessage('Habit already exists', 'Use a different name for this habit.');
      return;
    }

    const next = [
      ...habits,
      {
        id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: cleanTitle,
        time: cleanTime,
      },
    ];
    setBusy(true);
    try {
      await saveHabits(next);
      setHabits(next);
      setTitle('');
      setTime('09:00 AM');
      setAddVisible(false);
    } catch (error) {
      showMessage(
        'Unable to add habit',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteHabit = (habit: Habit) => {
    confirmAction(
      'Delete habit?',
      `Remove "${habit.title}" from your habits?`,
      'Delete',
      async () => {
        setDeletingHabitId(habit.id);
      }
    );
  };

  const finishDeleteHabit = async (habit: Habit) => {
    const previousHabits = habitsRef.current;
    const previousCompleted = completedHabitsRef.current;
    const removedIndex = previousHabits.findIndex((item) => item.id === habit.id);
    if (removedIndex < 0) {
      setDeletingHabitId(null);
      return;
    }
    const wasCompleted = previousCompleted.includes(habit.id);
    const nextHabits = previousHabits.filter((item) => item.id !== habit.id);
    const nextCompleted = previousCompleted.filter((id) => id !== habit.id);
    setBusy(true);
    setHabits(nextHabits);
    setCompletedHabits(nextCompleted);
    habitsRef.current = nextHabits;
    completedHabitsRef.current = nextCompleted;
    try {
      await saveHabits(nextHabits);
      await saveCompletedHabits(nextCompleted);
      showUndo(`Deleted ${habit.title}`, async () => {
        const restoredHabits = [...habitsRef.current];
        restoredHabits.splice(Math.min(removedIndex, restoredHabits.length), 0, habit);
        const restoredCompleted = wasCompleted
          ? [...completedHabitsRef.current, habit.id]
          : completedHabitsRef.current;
        await saveHabits(restoredHabits);
        await saveCompletedHabits(restoredCompleted);
        setHabits(restoredHabits);
        setCompletedHabits(restoredCompleted);
        habitsRef.current = restoredHabits;
        completedHabitsRef.current = restoredCompleted;
      });
    } catch (error) {
      setHabits(previousHabits);
      setCompletedHabits(previousCompleted);
      habitsRef.current = previousHabits;
      completedHabitsRef.current = previousCompleted;
      showMessage(
        'Unable to delete habit',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setDeletingHabitId(null);
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Habits</Text>
        <Text style={styles.subtitle}>Build consistency one day at a time</Text>

        <View style={styles.listHeader}>
          <View style={styles.listTitle}>
            <Ionicons name="heart-outline" size={18} color={COLORS.accent} />
            <Text style={styles.listTitleText}>Habits</Text>
          </View>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Add a habit"
            disabled={!ready || busy}
            onPress={() => setAddVisible(true)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={16} color={COLORS.text} />
            <Text style={styles.addLabel}>Add</Text>
          </SmoothPressable>
        </View>

        <View style={styles.habitsCard}>
          {habits.length === 0 ? (
            <Text style={styles.emptyText}>No habits yet. Tap Add to create one.</Text>
          ) : (
            habits.map((habit, index) => {
              const completed = completedHabits.includes(habit.id);
              return (
                <CollapsibleDeleteRow
                  key={habit.id}
                  collapsing={deletingHabitId === habit.id}
                  onCollapsed={() => void finishDeleteHabit(habit)}
                >
                  <View
                    style={[
                      styles.habitRow,
                      index < habits.length - 1 && styles.habitDivider,
                      completed && styles.habitCompleted,
                    ]}
                  >
                    <SmoothPressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${habit.title}, ${habit.time}`}
                      accessibilityState={{ checked: completed, disabled: !ready || busy }}
                      disabled={!ready || busy}
                      onPress={() => void toggleHabit(habit.id)}
                      style={styles.habitToggle}
                    >
                      <View style={[styles.checkCircle, completed && styles.checkedCircle]}>
                        {completed && (
                          <Ionicons name="checkmark" size={15} color={COLORS.background} />
                        )}
                      </View>
                      <View style={styles.habitCopy}>
                        <Text style={[styles.habitName, completed && styles.completedName]}>
                          {habit.title}
                        </Text>
                        <Text style={styles.habitTime}>{habit.time}</Text>
                      </View>
                    </SmoothPressable>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${habit.title}`}
                      disabled={!ready || busy || deletingHabitId !== null}
                      onPress={() => deleteHabit(habit)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={15} color={COLORS.muted} />
                    </SmoothPressable>
                  </View>
                </CollapsibleDeleteRow>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={addVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a habit</Text>
            <Text style={styles.inputLabel}>Habit name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Read for 15 minutes"
              placeholderTextColor={COLORS.muted}
              returnKeyType="next"
              maxLength={60}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>Time</Text>
            <TimeWheelPicker
              value={parseTime(time)}
              onChange={({ hour, minute, period }) => setTime(formatTime(hour, minute, period))}
              colors={{
                text: COLORS.text,
                secondary: COLORS.secondary,
                raised: COLORS.surfaceRaised,
                surface: COLORS.surface,
                border: COLORS.divider,
              }}
            />
            <View style={styles.modalButtons}>
              <SmoothPressable
                accessibilityRole="button"
                onPress={() => setAddVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </SmoothPressable>
              <SmoothPressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void addHabit()}
                style={styles.saveButton}
              >
                <Text style={styles.saveLabel}>Add habit</Text>
              </SmoothPressable>
            </View>
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
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: COLORS.secondary, fontSize: 12, marginTop: 5, marginBottom: 24 },
  listHeader: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  listTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  listTitleText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingLeft: 8 },
  addLabel: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  habitsCard: {
    overflow: 'hidden',
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    shadowColor: '#08060C',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  emptyText: { padding: 18, color: COLORS.secondary, fontSize: 12 },
  habitRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center' },
  habitDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  habitCompleted: { backgroundColor: COLORS.surfaceRaised },
  habitToggle: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingLeft: 16,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCircle: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  habitCopy: { flex: 1, gap: 3 },
  habitName: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  completedName: { color: COLORS.secondary, textDecorationLine: 'line-through' },
  habitTime: { color: COLORS.secondary, fontSize: 10 },
  deleteButton: {
    width: 44,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalCard: { borderRadius: 20, padding: 20, backgroundColor: COLORS.surface },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 17 },
  inputLabel: { color: COLORS.secondary, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.divider,
    paddingHorizontal: 12,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    marginBottom: 14,
    fontSize: 13,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
  },
  cancelLabel: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  saveButton: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  saveLabel: { color: COLORS.background, fontSize: 12, fontWeight: '700' },
  });
}
