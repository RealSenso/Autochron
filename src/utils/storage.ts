import { UserScheduleData, FixedAnchor, MealConfig, EverymanSleepConfig, DynamicTask, PomodoroConfig, WeeklyChore } from '../types';
import { getTodayStr } from './timeUtils';

const STORAGE_KEY = 'everyman_chronoscheduler_data_v1';

export const DEFAULT_FIXED_ANCHORS: FixedAnchor[] = [];

export const DEFAULT_MEAL_CONFIG: MealConfig = {
  breakfast: {
    enabled: true,
    name: 'Breakfast',
    windowStart: '07:30',
    windowEnd: '10:00',
    durationMinutes: 60,
  },
  lunch: {
    enabled: true,
    name: 'Lunch',
    windowStart: '12:30',
    windowEnd: '14:00',
    durationMinutes: 60,
  },
  snacks: {
    enabled: true,
    name: 'Snacks',
    windowStart: '16:30',
    windowEnd: '18:00',
    durationMinutes: 60,
  },
  dinner: {
    enabled: true,
    name: 'Dinner',
    windowStart: '19:30',
    windowEnd: '21:00',
    durationMinutes: 60,
  },
};

export const DEFAULT_SLEEP_CONFIG: EverymanSleepConfig = {
  enabled: true,
  coreSleepStart: '01:00',
  coreSleepDurationMinutes: 210, // 3.5 hrs = 210 mins (01:00 AM - 04:30 AM)
  napsCount: 3,
  napDurationMinutes: 30,
  preferredNapTimes: ['08:30', '13:30', '18:30'],
};

export const DEFAULT_DYNAMIC_TASKS: DynamicTask[] = [];

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  autoFillRemainingSlots: true,
  defaultSubject: 'Deep Study / Skill Focus',
};

export const DEFAULT_WEEKLY_CHORES: WeeklyChore[] = [
  {
    id: 'chore-1',
    title: 'Laundry & Ironing',
    durationMinutes: 60,
    priority: 'medium',
    category: 'Home & Life',
    notes: 'Washing, drying, and folding weekly clothes',
  },
  {
    id: 'chore-2',
    title: 'Weekly Expense & Budget Audit',
    durationMinutes: 30,
    priority: 'high',
    category: 'Finance',
    notes: 'Review transactions and track monthly goals',
  },
  {
    id: 'chore-3',
    title: 'Deep Room Cleaning & Desk Reset',
    durationMinutes: 45,
    priority: 'medium',
    category: 'Home & Life',
    notes: 'Disinfect surfaces and organize study workspace',
  },
];

import { DEFAULT_HABIT_MODEL } from './habitML';

export const DEFAULT_USER_DATA: UserScheduleData = {
  fixedAnchors: DEFAULT_FIXED_ANCHORS,
  oneTimeCommitments: [],
  mealConfig: DEFAULT_MEAL_CONFIG,
  sleepConfig: DEFAULT_SLEEP_CONFIG,
  dynamicTasks: DEFAULT_DYNAMIC_TASKS,
  weeklyChores: DEFAULT_WEEKLY_CHORES,
  decompressionMinutes: 45,
  pomodoroConfig: DEFAULT_POMODORO_CONFIG,
  scheduledEvents: {},
  habitModel: DEFAULT_HABIT_MODEL,
};

/**
 * Loads user schedule data from localStorage, falling back to defaults if missing or corrupted
 */
export function loadUserData(): UserScheduleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_DATA;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_USER_DATA,
      ...parsed,
      fixedAnchors: parsed.fixedAnchors || DEFAULT_FIXED_ANCHORS,
      oneTimeCommitments: parsed.oneTimeCommitments || [],
      mealConfig: { ...DEFAULT_MEAL_CONFIG, ...parsed.mealConfig },
      sleepConfig: { ...DEFAULT_SLEEP_CONFIG, ...parsed.sleepConfig },
      dynamicTasks: parsed.dynamicTasks || DEFAULT_DYNAMIC_TASKS,
      weeklyChores: parsed.weeklyChores || DEFAULT_WEEKLY_CHORES,
      decompressionMinutes: parsed.decompressionMinutes ?? 45,
      pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG, ...parsed.pomodoroConfig },
      scheduledEvents: parsed.scheduledEvents || {},
      habitModel: parsed.habitModel || DEFAULT_HABIT_MODEL,
    };
  } catch (err) {
    console.error('Failed to parse localStorage data, restoring defaults:', err);
    return DEFAULT_USER_DATA;
  }
}

/**
 * Saves user schedule data to browser localStorage
 */
export function saveUserData(data: UserScheduleData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

/**
 * Clears stored schedule data
 */
export function clearUserData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
}

/**
 * Triggers browser download of user schedule configuration as JSON file
 */
export function exportUserDataAsJSON(data: UserScheduleData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kitose_schedule_backup_${getTodayStr()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
