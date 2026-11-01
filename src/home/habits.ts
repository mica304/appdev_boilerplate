import Storage from 'expo-sqlite/kv-store';
import type { Theme } from '@/theme';

export const HABIT_LIST_STORAGE_KEY = 'home_habit_list_v1';
export const HABIT_COMPLETIONS_STORAGE_KEY = 'home_habits_v1';

export const HABIT_COLORS = {
  background: '#050806',
  surface: 'rgba(15, 39, 27, 0.96)',
  surfaceRaised: 'rgba(35, 72, 48, 0.88)',
  divider: 'rgba(147, 190, 151, 0.18)',
  border: 'rgba(147, 190, 151, 0.25)',
  accent: '#80C98A',
  text: '#EDF5EC',
  secondary: '#A4BAA8',
  muted: '#78917E',
};

export function habitColorsForTheme(theme: Theme) {
  return {
    background: theme.background,
    surface: theme.card,
    surfaceRaised: theme.surfaceRaised,
    divider: theme.divider,
    border: theme.border,
    accent: theme.tint,
    text: theme.text,
    secondary: theme.textSecondary,
    muted: theme.muted,
  };
}

export interface Habit {
  id: string;
  title: string;
  time: string;
}

export const DEFAULT_HABITS: Habit[] = [
  { id: 'drink-water', title: 'Drink 2L water a day', time: '7:00 AM' },
  { id: 'walk', title: 'Walking', time: '9:00 AM' },
  { id: 'exercise', title: 'Exercise 15 mins a day', time: '5:30 PM' },
  { id: 'skincare', title: 'Skin care routine', time: '8:00 PM' },
  { id: 'relaxing', title: 'Relaxing', time: '9:00 PM' },
];

export async function loadHabits(): Promise<Habit[]> {
  const saved = await Storage.getItem(HABIT_LIST_STORAGE_KEY);
  if (!saved) return DEFAULT_HABITS;

  const parsed: unknown = JSON.parse(saved);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'title' in item &&
        typeof item.title === 'string' &&
        'time' in item &&
        typeof item.time === 'string'
    )
  ) {
    throw new Error('Saved habit list has an invalid format.');
  }
  return parsed;
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await Storage.setItemAsync(HABIT_LIST_STORAGE_KEY, JSON.stringify(habits));
}

export async function loadCompletedHabits(): Promise<string[]> {
  const saved = await Storage.getItem(HABIT_COMPLETIONS_STORAGE_KEY);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Saved habit completion data has an invalid format.');
  }
  return parsed;
}

export async function saveCompletedHabits(ids: string[]): Promise<void> {
  await Storage.setItemAsync(HABIT_COMPLETIONS_STORAGE_KEY, JSON.stringify(ids));
}
