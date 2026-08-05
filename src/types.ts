export type EventCategory =
  | 'core_sleep'
  | 'nap'
  | 'lecture'
  | 'meal'
  | 'task'
  | 'pomodoro_study'
  | 'pomodoro_break'
  | 'transit'
  | 'decompression'
  | 'chore'
  | 'custom';

export interface FixedAnchor {
  id: string;
  title: string;
  type: 'lecture' | 'meal' | 'custom_anchor';
  startTime: string; // "HH:mm" (24h)
  endTime: string;   // "HH:mm" (24h)
  location?: string;
  notes?: string;
  color?: string;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  overrideSleep?: boolean; // Bypasses/suppresses sleep collision rules if checked
  deletedDates?: string[]; // Dates (YYYY-MM-DD) where single instance is deleted/excepted
}

export interface OneTimeCommitment {
  id: string;
  title: string;
  dateStr: string;      // "YYYY-MM-DD"
  startTime: string;    // "HH:mm"
  endTime: string;      // "HH:mm"
  location?: string;
  category?: EventCategory;
  notes?: string;
  color?: string;
  overrideSleep?: boolean;
  isCompleted?: boolean;
}

export interface MealWindow {
  enabled: boolean;
  name: string;
  windowStart: string; // "HH:mm" e.g. "07:30"
  windowEnd: string;   // "HH:mm" e.g. "08:30"
  durationMinutes: number; // e.g. 30
}

export interface MealConfig {
  breakfast: MealWindow;
  lunch: MealWindow;
  snacks: MealWindow;
  dinner: MealWindow;
}

export interface EverymanSleepConfig {
  enabled: boolean;
  coreSleepStart: string; // default "01:00"
  coreSleepDurationMinutes: number; // default 210 = 3.5 hrs
  napsCount: number; // default 3
  napDurationMinutes: number; // default 30
  // Preferred approximate nap center times (in HH:mm)
  preferredNapTimes: string[]; // e.g. ["08:30", "13:30", "18:30"]
}

export interface DynamicTask {
  id: string;
  title: string;
  durationMinutes: number;
  transitBufferBeforeMinutes: number;
  transitBufferAfterMinutes: number;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  isCompleted?: boolean;
  deadline?: string; // "HH:mm" optional target completion time
  notes?: string;
  overrideSleep?: boolean; // Bypasses/suppresses sleep collision rules if checked
  isPinned?: boolean;
  pinnedStartTime?: string;
  pinnedDateStr?: string;
  scheduledStartDate?: string; // "YYYY-MM-DD" optional start date slot
  scheduledEndDate?: string;   // "YYYY-MM-DD" optional end date slot
}

export interface WeeklyChore {
  id: string;
  title: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  notes?: string;
  isScheduled?: boolean;
  assignedDateStr?: string; // "YYYY-MM-DD"
  assignedStartTime?: string; // "HH:mm"
  assignedEndTime?: string;   // "HH:mm"
}

export interface PomodoroConfig {
  autoFillRemainingSlots: boolean;
  defaultSubject: string;
}

export interface CategoryHabitData {
  frictionMultiplier: number; // default 1.0 (e.g. 0.8 to 2.5)
  sampleCount: number;        // total completions tracked
  lastUpdated?: string;       // ISO date
}

export interface UserHabitModel {
  categories: Record<string, CategoryHabitData>;
}

export interface ScheduledEvent {
  id: string;
  title: string;
  category: EventCategory;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  startMinutes: number; // minutes from midnight (0..1439)
  endMinutes: number;   // minutes from midnight (0..1440)
  dateStr: string;      // "YYYY-MM-DD"
  color: string;
  isLocked: boolean;    // Fixed lectures, core sleep are locked
  isPinned?: boolean;   // User pinned via drag and drop or manual lock
  isDraft?: boolean;    // Previewing uncommitted draft
  isCompleted?: boolean;
  status?: 'done' | 'pending' | 'in_progress';
  completedAtMinutes?: number; // Time in mins from midnight when completed
  notes?: string;
  parentTaskId?: string; // If this event was generated from a DynamicTask or WeeklyChore
  parentAnchorId?: string; // If this event was generated from a FixedAnchor
  parentOneTimeId?: string; // If this event was generated from a OneTimeCommitment
  transitType?: 'before' | 'after';
  overrideSleep?: boolean;
  isPast?: boolean;     // True if event ended before current system time
  isChore?: boolean;
  frictionAppliedMinutes?: number; // Minutes added due to Habit ML friction
}

export interface UserScheduleData {
  fixedAnchors: FixedAnchor[];
  oneTimeCommitments?: OneTimeCommitment[];
  mealConfig: MealConfig;
  sleepConfig: EverymanSleepConfig;
  dynamicTasks: DynamicTask[];
  weeklyChores: WeeklyChore[];
  decompressionMinutes?: number; // default 45
  pomodoroConfig: PomodoroConfig;
  scheduledEvents: Record<string, ScheduledEvent[]>; // keyed by dateStr "YYYY-MM-DD"
  // Auto-generated blocks (meals, naps, pomodoro, core sleep, decompression)
  // are rebuilt fresh from config on every regeneration and have no stored
  // identity of their own, so deleting one wouldn't otherwise stick. Keyed
  // by dateStr -> exclusion keys: 'decompression', 'core_sleep',
  // 'meal-<breakfast|lunch|snacks|dinner>', 'nap-<1-based index>', or
  // 'pomo:<startMinutes>-<endMinutes>' for a specific pomodoro block.
  excludedSlots?: Record<string, string[]>;
  habitModel?: UserHabitModel;
  updatedAt?: string;
}

export interface UnscheduledItem {
  type: 'task' | 'nap' | 'meal';
  title: string;
  reason: string;
}

export interface ScheduleGenerationResult {
  events: ScheduledEvent[];
  unscheduledItems: UnscheduledItem[];
  stats: {
    totalSleepMinutes: number;
    totalStudyMinutes: number;
    totalLectureMinutes: number;
    totalMealMinutes: number;
    totalTaskMinutes: number;
    freeMinutes: number;
    utilizationPercent: number;
  };
}
