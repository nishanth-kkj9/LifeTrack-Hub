export enum HabitScheduleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM_PATTERN = 'CUSTOM_PATTERN',
  CUSTOM_DATES = 'CUSTOM_DATES',
}

export enum HabitStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DUE = 'DUE',
  NOT_DUE = 'NOT_DUE',
  SKIPPED = 'SKIPPED',
}

export interface HabitSchedule {
  type: HabitScheduleType;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
  timesPerWeek?: number;
  daysOfMonth?: number[];
  timesPerMonth?: number;
  pattern?: string;
  specificDates?: string[];
}

export interface HabitScore {
  currentStrength: number;
  longestStreak: number;
  currentStreak: number;
  completionRate: number;
  backlogDays: number;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  category: 'fitness' | 'health' | 'productivity' | 'learning' | 'finance' | 'personal';
  color?: string;
  schedule: HabitSchedule;
  reminderTime?: string;
  notificationEnabled: boolean;
  score: HabitScore;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedDate: string;
  completedTimestamp: string;
  numTimesCompleted: number;
}

export interface DailyMetric {
  id: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  sleepHours: number;
  sleepQuality: number;
  workoutDone: boolean;
  steps: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
