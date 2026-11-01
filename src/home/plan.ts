import Storage from 'expo-sqlite/kv-store';

export const PLAN_STORAGE_KEY = 'my_plan_tasks_v1';

export interface PlanTask {
  id: string;
  title: string;
  date: string;
  time: string;
  reward?: string;
  alarmSound?: 'none' | 'bell' | 'chime' | 'pulse';
  remindBefore?: '5m' | '10m' | '15m' | '30m' | '1hr' | 'off';
  kind: 'priority' | 'schedule';
  completed: boolean;
  snoozedUntil: number | null;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultTasks(date = new Date()): PlanTask[] {
  return [
    {
      id: 'finish-q3-report',
      title: 'Finish Q3 Report',
      date: dateKey(date),
      time: '3:00 PM',
      reward: 'Watch 1 ep of The Office',
      alarmSound: 'bell',
      remindBefore: '15m',
      kind: 'priority',
      completed: false,
      snoozedUntil: null,
    },
    {
      id: 'call-mom',
      title: 'Call Mom',
      date: dateKey(date),
      time: '',
      kind: 'priority',
      completed: true,
      snoozedUntil: null,
    },
  ];
}

export async function loadPlanTasks(): Promise<PlanTask[]> {
  const saved = await Storage.getItem(PLAN_STORAGE_KEY);
  if (!saved) return createDefaultTasks();

  const parsed: unknown = JSON.parse(saved);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item && typeof item.id === 'string' &&
        'title' in item && typeof item.title === 'string' &&
        'date' in item && typeof item.date === 'string' &&
        'time' in item && typeof item.time === 'string' &&
        (!('reward' in item) || typeof item.reward === 'string') &&
        (!('alarmSound' in item) || item.alarmSound === 'none' || item.alarmSound === 'bell' || item.alarmSound === 'chime' || item.alarmSound === 'pulse') &&
        (!('remindBefore' in item) || item.remindBefore === '5m' || item.remindBefore === '10m' || item.remindBefore === '15m' || item.remindBefore === '30m' || item.remindBefore === '1hr' || item.remindBefore === 'off') &&
        'kind' in item && (item.kind === 'priority' || item.kind === 'schedule') &&
        'completed' in item && typeof item.completed === 'boolean' &&
        'snoozedUntil' in item &&
        (typeof item.snoozedUntil === 'number' || item.snoozedUntil === null)
    )
  ) {
    throw new Error('Saved MyPlan tasks have an invalid format.');
  }
  return parsed;
}

export async function savePlanTasks(tasks: PlanTask[]): Promise<void> {
  await Storage.setItemAsync(PLAN_STORAGE_KEY, JSON.stringify(tasks));
}