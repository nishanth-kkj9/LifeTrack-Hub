/**
 * Core Tracking Types for LifeTrack-Hub
 * Supports habit scoring, adaptive scheduling, and multi-dimensional tracking
 * Compatible with Firestore schema and mobile/desktop sync
 */

// ============ HABIT CORE TYPES ============

export enum HabitScheduleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM_PATTERN = 'CUSTOM_PATTERN', // e.g., "3 days on, 2 days off"
  CUSTOM_DATES = 'CUSTOM_DATES', // Specific dates only
}

export enum HabitStatus {
  COMPLETED = 'COMPLETED',           // Habit was completed on this date
  FAILED = 'FAILED',                 // Habit was not completed on due date
  DUE = 'DUE',                       // Habit is due today but not completed
  NOT_DUE = 'NOT_DUE',               // Habit is not scheduled for this date
  SKIPPED = 'SKIPPED',               // Intentionally skipped (vacation mode)
}

export interface HabitSchedule {
  type: HabitScheduleType;
  startDate: Date;
  endDate?: Date;
  
  // For WEEKLY
  daysOfWeek?: number[];  // 0-6 (Sun-Sat)
  timesPerWeek?: number;  // If not specific days
  
  // For MONTHLY
  daysOfMonth?: number[];  // 1-31
  timesPerMonth?: number;
  weekPatterns?: {        // "2nd Monday", "last Friday"
    week: 1 | 2 | 3 | 4 | 5; // 1-4, or 5 for last
    dayOfWeek: number;        // 0-6
  }[];
  
  // For CUSTOM_PATTERN
  pattern?: string;  // e.g., "3-2" = 3 days on, 2 days off
  
  // For CUSTOM_DATES
  specificDates?: Date[];
}

export interface HabitScore {
  currentStrength: number;        // 0-100 scale
  longestStreak: number;          // Days
  currentStreak: number;          // Days
  completionRate: number;         // 0-100 percentage
  backlogDays: number;            // Negative means behind
  
  // Scoring components
  scoringFormula: {
    completionBonus: number;      // +0.5 per completion
    missedDayPenalty: number;     // -1.0 per missed day
    decayRate: number;            // How fast strength decays (0-1)
    streakMultiplier: number;     // Bonus for consecutive days
  };
  
  lastScoredAt: Date;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category?: string;              // fitness, productivity, health, etc
  color?: string;                 // Hex color for UI
  icon?: string;                  // Icon name
  
  schedule: HabitSchedule;
  frequency: {
    timesPerSession: number;      // How many times to complete
    sessionDurationMinutes?: number;
  };
  
  // Tracking data
  score: HabitScore;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  
  // Streak data (cached)
  streakData: StreakData;
  
  // Settings
  reminderTime?: string;          // HH:mm format
  reminderDays?: number[];        // Only remind on specific days
  notificationEnabled: boolean;
  widgetVisible: boolean;
}

export interface StreakData {
  current: Streak;
  longest: Streak;
  allStreaks: Streak[];           // Cached for performance
  lastUpdated: Date;
}

export interface Streak {
  startDate: Date;
  endDate: Date;
  durationInDays: number;
  type: 'COMPLETED' | 'WITH_NON_DUE_DAYS';  // Include non-due days
}

// ============ COMPLETION TRACKING ============

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedDate: Date;
  completedTimestamp: Date;
  numTimesCompleted: number;      // Support partial completions
  notes?: string;
  energyLevel?: number;           // 1-5
  difficulty?: number;            // 1-5 (how hard was it)
}

export interface VacationPeriod {
  id: string;
  habitId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  preserveStreak: boolean;        // Don't break streak during vacation
}

// ============ ADAPTIVE SCHEDULING ============

export interface AdaptiveScheduleData {
  deviationFromSchedule: number;  // -5 (backlog) to +3 (ahead)
  backlogDays: number[];          // Dates with backlog
  nextDueDate: Date;
  suggestedCompletionDate: Date;  // Next available non-due day
  habitStatus: HabitStatus;
}

export interface ScheduleComputation {
  habitId: string;
  referenceDate: Date;
  periodStart: Date;
  periodEnd: Date;
  computedAt: Date;
  status: HabitStatus;
  deviation: number;
}

// ============ MULTI-DIMENSIONAL METRICS ============

export interface DailyMetrics {
  id: string;
  userId: string;
  date: Date;
  
  // Mood & Energy
  mood: number;                   // 1-5
  energy: number;                 // 1-5
  stress: number;                 // 1-5
  happiness: number;              // 1-5
  
  // Sleep
  sleepDuration: number;          // hours
  sleepQuality: number;           // 1-5
  sleepNotes?: string;
  
  // Fitness
  weight?: number;                // kg/lbs
  steps?: number;
  caloriesIntake?: number;
  workoutDone: boolean;
  workoutIntensity?: number;      // 1-5
  macros?: {
    carbs: number;
    protein: number;
    fat: number;
  };
  
  // Health
  symptoms: string[];             // headache, cold, etc
  medicationTaken?: string[];
  waterIntake?: number;           // glasses/liters
  
  // Productivity
  focusHours: number;
  tasksCompleted: number;
  screenTime: number;             // minutes
  
  // Social
  socialHours: number;
  socialActivity: string[];
  
  // Environment
  location?: string;
  weather?: string;
  timezone?: string;
  
  // Notes
  mainAccomplishment?: string;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricCorrelation {
  metric1: string;
  metric2: string;
  correlationCoefficient: number; // -1 to +1
  dataPointsUsed: number;
  calculatedAt: Date;
}

// ============ ANALYTICS ============

export interface HabitAnalytics {
  habitId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Statistics
  totalCompletions: number;
  totalDueDates: number;
  completionPercentage: number;
  missedDates: number;
  
  // Streaks
  longestStreak: Streak;
  currentStreak: Streak;
  averageStreakLength: number;
  
  // Trends
  weeklyCompletionTrend: number[];     // Last 4-12 weeks
  monthlyCompletionTrend: number[];    // Last 3-12 months
  
  // Patterns
  bestDayOfWeek: number;               // 0-6
  bestTimeOfDay?: string;
  consistencyScore: number;            // 0-100
  
  // Correlations with metrics
  correlationsWithMetrics: MetricCorrelation[];
}

export interface OverallAnalytics {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Summary
  totalHabits: number;
  activeHabits: number;
  overallCompletionRate: number;
  
  // Top performers
  bestPerformingHabits: Array<{
    habitId: string;
    name: string;
    completionRate: number;
  }>;
  
  // Needs improvement
  improvementAreas: Array<{
    habitId: string;
    name: string;
    completionRate: number;
    reason: string;
  }>;
  
  // Weekly summary
  weeklyHighlights: string[];
  
  // Insights
  insights: string[];
  recommendations: string[];
}

// ============ SYNC & OFFLINE ============

export interface SyncData {
  habitId: string;
  lastSyncedAt: Date;
  pendingChanges: boolean;
  conflictData?: {
    local: Habit;
    remote: Habit;
    resolvedAt?: Date;
  };
}

export interface OfflineQueue {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'HABIT' | 'COMPLETION' | 'METRIC';
  entityId: string;
  payload: any;
  createdAt: Date;
  synced: boolean;
}

// ============ NOTIFICATIONS ============

export interface HabitReminder {
  id: string;
  habitId: string;
  time: string;                   // HH:mm format
  daysOfWeek?: number[];          // Empty = every day
  enabled: boolean;
  notificationType: 'PUSH' | 'EMAIL' | 'IN_APP';
  lastSentAt?: Date;
}

// ============ EXPORT & IMPORT ============

export interface ExportFormat {
  habits: Habit[];
  completions: HabitCompletion[];
  metrics: DailyMetrics[];
  metadata: {
    exportedAt: Date;
    exportedBy: string;
    version: string;
  };
}
