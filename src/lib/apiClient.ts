import { Subtask, Transaction, ExamReminder, Habit } from '../types/index.ts';

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    let clientId = localStorage.getItem('lifetrack_client_instance_id');
    if (!clientId) {
      clientId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('lifetrack_client_instance_id', clientId);
    }
    headers['x-lifetrack-client-id'] = clientId;
  } catch {
    // Non-browser fallback
  }
  return headers;
}

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
  try {
    const response = await fetch('/api/gemini/breakdown', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ title, description, category }),
    });

    if (response.ok) {
      const data = await response.json();
      const rawSubtasks = data.subtasks || [];
      if (Array.isArray(rawSubtasks) && rawSubtasks.length > 0) {
        return rawSubtasks.map((item: any, idx: number) => ({
          id: `ai-st-${Date.now()}-${idx}`,
          title: item.title || `Step ${idx + 1}`,
          completed: false,
          estimatedMinutes: item.estimatedMinutes || 25,
        }));
      }
    }
  } catch (e) {
    console.warn('Network breakdown request error, using client fallback:', e);
  }

  // Client-side fallback if server is offline or unreachable
  return [
    { id: `st-${Date.now()}-1`, title: `Review prerequisites and gather resources for ${title}`, completed: false, estimatedMinutes: 25 },
    { id: `st-${Date.now()}-2`, title: `Execute primary objective for ${title}`, completed: false, estimatedMinutes: 45 },
    { id: `st-${Date.now()}-3`, title: `Verify output and mark completion`, completed: false, estimatedMinutes: 20 },
  ];
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
    headers: getApiHeaders(),
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
    headers: getApiHeaders(),
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
    headers: getApiHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to run master AI planner');
  }

  const data = await response.json();
  return data.plan;
}
