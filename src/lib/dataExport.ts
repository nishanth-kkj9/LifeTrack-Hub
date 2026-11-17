import { UserAppData, Task, Transaction, Habit, DailyLifeMetric } from '../types/index.ts';
import { sanitizeUserAppData } from './firebase.ts';
import { isActive } from './entity.ts';
import { getLocalDateString } from './dateUtils.ts';
import { getHabitStats } from './habitScoring.ts';

/**
 * Triggers browser download of text content as file
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * SECURITY: neutralize CSV formula injection. Cells starting with = + - @ (or tab/CR)
 * are executed as formulas by Excel/Sheets; prefixing a single quote forces literal text.
 */
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Converts array of object records to CSV format string
 */
export function convertToCsv(records: Record<string, unknown>[]): string {
  if (!records || records.length === 0) return '';
  const headers = Object.keys(records[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  // Data rows
  records.forEach((row) => {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${sanitizeCsvCell(String(val)).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Export full application data backup as JSON file
 */
export function exportAppDataJson(appData: UserAppData) {
  const dateStr = getLocalDateString();
  const filename = `LifeTrack_Hub_Backup_${dateStr}.json`;
  const activeSnapshot: UserAppData = {
    ...appData,
    tasks: (appData.tasks || []).filter(isActive),
    transactions: (appData.transactions || []).filter(isActive),
    ...(appData.recurringTransactions !== undefined
      ? { recurringTransactions: appData.recurringTransactions.filter(isActive) }
      : {}),
    exams: (appData.exams || []).filter(isActive),
    habits: (appData.habits || []).filter(isActive),
    notes: (appData.notes || []).filter(isActive),
    dailyMetrics: (appData.dailyMetrics || []).filter(isActive),
  };
  const jsonContent = JSON.stringify(activeSnapshot, null, 2);
  downloadFile(filename, jsonContent, 'application/json');
}

/**
 * Export Habits history to CSV
 */
export function exportHabitsCsv(habits: Habit[], todayStr: string = getLocalDateString()) {
  const records = (habits || []).filter(isActive).map((h) => {
    let createdAtIso = '';
    if (typeof h.createdAt === 'number' && Number.isFinite(h.createdAt)) {
      const dt = new Date(h.createdAt);
      if (!Number.isNaN(dt.getTime())) {
        createdAtIso = dt.toISOString();
      }
    }

    const stats = getHabitStats(h, todayStr);
    const vacationSummary = Array.isArray(h.vacationPeriods)
      ? h.vacationPeriods
          .filter((v) => v && v.startDate && v.endDate)
          .map((v) =>
            v.reason ? `${v.startDate}..${v.endDate} (${v.reason})` : `${v.startDate}..${v.endDate}`
          )
          .join('; ')
      : '';
    const notesSummary =
      h.notes && typeof h.notes === 'object' && !Array.isArray(h.notes)
        ? Object.entries(h.notes)
            .filter(([, text]) => typeof text === 'string' && text.trim().length > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, text]) => `${d}: ${text}`)
            .join(' | ')
        : '';

    return {
      ID: h.id,
      Name: h.name,
      Category: h.category || 'General',
      TargetDaysPerWeek: h.targetDaysPerWeek,
      CurrentStreak: stats.currentStreak,
      BestStreak: stats.bestStreak,
      CompletedCount: h.completedDates?.length || 0,
      CompletedDates: (h.completedDates || []).join('; '),
      ScheduleType: h.scheduleType || 'daily',
      VacationPeriods: vacationSummary,
      Notes: notesSummary,
      CreatedAt: createdAtIso,
    };
  });

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_Habits_${todayStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Export Tasks to CSV
 */
export function exportTasksCsv(tasks: Task[]) {
  const dateStr = getLocalDateString();
  const records = (tasks || []).filter(isActive).map((t) => ({
    ID: t.id,
    Title: t.title,
    Category: t.category,
    Priority: t.priority,
    DueDate: t.dueDate,
    DueTime: t.dueTime || '',
    Status: t.completed ? 'Completed' : 'Pending',
    EstimatedMinutes: t.estimatedMinutes || 0,
    Starred: t.isStarred ? 'Yes' : 'No',
    SubtaskCount: t.subtasks?.length || 0,
    Tags: (t.tags || []).join('; '),
    CreatedAt: new Date(t.createdAt).toISOString(),
  }));

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_Tasks_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Export Transactions to CSV
 */
export function exportTransactionsCsv(transactions: Transaction[]) {
  const dateStr = getLocalDateString();
  const records = (transactions || []).filter(isActive).map((tx) => ({
    ID: tx.id,
    Title: tx.title,
    Type: tx.type,
    Amount: tx.amount,
    Category: tx.category,
    Date: tx.date,
    PaymentMethod: tx.paymentMethod,
    Notes: tx.notes || '',
    CreatedAt: new Date(tx.createdAt).toISOString(),
  }));

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_Transactions_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Export Daily Life Metrics to CSV
 */
export function exportDailyMetricsCsv(metrics: DailyLifeMetric[]) {
  const dateStr = getLocalDateString();
  const records = (metrics || []).filter(isActive).map((m) => ({
    ID: m.id,
    Date: m.date,
    SleepHours: m.sleepHours ?? '',
    SleepQuality: m.sleepQuality ?? '',
    EnergyLevel: m.energyLevel ?? '',
    MoodLevel: m.moodLevel ?? '',
    StressLevel: m.stressLevel ?? '',
    WaterLitres: m.waterLitres ?? '',
    StepsCount: m.stepsCount ?? '',
    FocusHours: m.focusHours ?? '',
    WorkoutDone: m.workoutDone === true ? 'Yes' : m.workoutDone === false ? 'No' : '',
    JournalNotes: m.journalNotes || '',
    UpdatedAt: typeof m.updatedAt === 'number' && Number.isFinite(m.updatedAt) ? new Date(m.updatedAt).toISOString() : '',
  }));

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_DailyMetrics_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Imports JSON backup file and parses as UserAppData
 */
export function parseAppDataJsonFile(file: File): Promise<UserAppData> {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error('Backup file exceeds the 2 MB limit.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure');
        }
        const { data } = sanitizeUserAppData(parsed);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
