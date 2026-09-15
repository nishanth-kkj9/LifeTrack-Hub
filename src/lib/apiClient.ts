import { Subtask, Transaction, ExamReminder, Habit } from '../types/index.ts';

export interface FinanceInsightResponse {
  healthStatus: 'Healthy' | 'Attention Needed' | 'Over Budget';
  summary: string;
  recommendations: string[];
  topSavingsOpportunity: string;
}

export interface StudyGuideResponse {
  guide: string;
  sources?: Array<{ title: string; uri: string }>;
}

export async function requestTaskBreakdown(
  title: string,
  description?: string,
  category?: string
): Promise<Subtask[]> {
  const response = await fetch('/api/gemini/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, category }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate task breakdown');
  }

  const data = await response.json();
  const rawSubtasks = data.subtasks || [];
  return rawSubtasks.map((item: any, idx: number) => ({
    id: `ai-st-${Date.now()}-${idx}`,
    title: item.title || `Step ${idx + 1}`,
    completed: false,
    estimatedMinutes: item.estimatedMinutes || 25,
  }));
}

export const generateTaskSubtasks = requestTaskBreakdown;

export async function requestFinanceInsights(
  transactions: Transaction[],
  budget: number,
  totalIncome: number,
  totalExpense: number
): Promise<FinanceInsightResponse> {
  const response = await fetch('/api/gemini/finance-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions, budget, totalIncome, totalExpense }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate financial insights');
  }

  return response.json();
}

export async function requestStudyGuide(
  subject: string,
  topics: string[],
  examDate: string,
  targetScore?: string
): Promise<StudyGuideResponse> {
  const response = await fetch('/api/gemini/study-guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject,
      topics,
      examDate,
      targetGrade: targetScore,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate study guide');
  }

  return response.json();
}

export async function requestDeepPlan(params: {
  tasks: any[];
  exams: any[];
  finances: any;
  habits: any[];
  userQuery?: string;
}): Promise<string> {
  const response = await fetch('/api/gemini/deep-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to run master AI planner');
  }

  const data = await response.json();
  return data.plan;
}
