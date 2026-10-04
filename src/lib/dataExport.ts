import { UserAppData, Task, Transaction, Habit, DailyLifeMetric } from '../types/index.ts';

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
 * Converts array of object records to CSV format string
 */
export function convertToCsv(records: Record<string, any>[]): string {
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
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Export full application data backup as JSON file
 */
export function exportAppDataJson(appData: UserAppData) {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `LifeTrack_Hub_Backup_${dateStr}.json`;
  const jsonContent = JSON.stringify(appData, null, 2);
  downloadFile(filename, jsonContent, 'application/json');
}

/**
 * Export Habits history to CSV
 */
export function exportHabitsCsv(habits: Habit[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const records = habits.map((h) => ({
    ID: h.id,
    Name: h.name,
    Category: h.category || 'General',
    TargetDaysPerWeek: h.targetDaysPerWeek,
    CurrentStreak: h.streak,
    BestStreak: h.bestStreak,
    CompletedCount: h.completedDates?.length || 0,
    CompletedDates: (h.completedDates || []).join('; '),
    ScheduleType: h.scheduleType || 'daily',
    CreatedAt: new Date(h.createdAt).toISOString(),
  }));

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_Habits_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Export Tasks to CSV
 */
export function exportTasksCsv(tasks: Task[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const records = tasks.map((t) => ({
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
  const dateStr = new Date().toISOString().split('T')[0];
  const records = transactions.map((tx) => ({
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
  const dateStr = new Date().toISOString().split('T')[0];
  const records = (metrics || []).map((m) => ({
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
    WorkoutDone: m.workoutDone ? 'Yes' : 'No',
    JournalNotes: m.journalNotes || '',
    UpdatedAt: new Date(m.updatedAt).toISOString(),
  }));

  const csv = convertToCsv(records);
  downloadFile(`LifeTrack_DailyMetrics_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
}

/**
 * Imports JSON backup file and parses as UserAppData
 */
export function parseAppDataJsonFile(file: File): Promise<UserAppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure');
        }
        resolve(parsed as UserAppData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
