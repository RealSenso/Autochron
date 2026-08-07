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
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  color?: string;
  daysOfWeek?: number[];
  overrideSleep?: boolean;
  deletedDates?: string[];
}

export interface OneTimeCommitment {
  id: string;
  title: string;
  dateStr: string;
  startTime: string;
  endTime: string;
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
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
}

export interface MealConfig {
  breakfast: MealWindow;
  lunch: MealWindow;
  snacks: MealWindow;
  dinner: MealWindow;
}

export interface EverymanSleepConfig {
  enabled: boolean;
  coreSleepStart: string;
  coreSleepDurationMinutes: number;
  napsCount: number;
  napDurationMinutes: number;
  preferredNapTimes: string[];
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
  deadline?: string;
  notes?: string;
  overrideSleep?: boolean;
  isPinned?: boolean;
  pinnedStartTime?: string;
  pinnedDateStr?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}

export interface WeeklyChore {
  id: string;
  title: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  notes?: string;
  isScheduled?: boolean;
  assignedDateStr?: string;
  assignedStartTime?: string;
  assignedEndTime?: string;
}

export interface PomodoroConfig {
  autoFillRemainingSlots: boolean;
  defaultSubject: string;
}

export interface CategoryHabitData {
  frictionMultiplier: number;
  sampleCount: number;
  lastUpdated?: string;
}

export interface UserHabitModel {
  categories: Record<string, CategoryHabitData>;
}

export interface ScheduledEvent {
  id: string;
  title: string;
  category: EventCategory;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  dateStr: string;
  color: string;
  isLocked: boolean;
  isPinned?: boolean;
  isDraft?: boolean;
  isCompleted?: boolean;
  status?: 'done' | 'pending' | 'in_progress';
  completedAtMinutes?: number;
  notes?: string;
  parentTaskId?: string;
  parentAnchorId?: string;
  parentOneTimeId?: string;
  transitType?: 'before' | 'after';
  overrideSleep?: boolean;
  isPast?: boolean;
  isChore?: boolean;
  frictionAppliedMinutes?: number;
}

export interface UserScheduleData {
  fixedAnchors: FixedAnchor[];
  oneTimeCommitments?: OneTimeCommitment[];
  mealConfig: MealConfig;
  sleepConfig: EverymanSleepConfig;
  dynamicTasks: DynamicTask[];
  weeklyChores: WeeklyChore[];
  decompressionMinutes?: number;
  pomodoroConfig: PomodoroConfig;
  scheduledEvents: Record<string, ScheduledEvent[]>;
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
