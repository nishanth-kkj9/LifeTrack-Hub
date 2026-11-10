import { Subtask, Transaction, ExamReminder, Habit } from '../types/index.ts';
import { auth } from './firebase.ts';

/**
 * Returns Authorization headers with current user's Firebase ID token.
 * Throws a user-friendly error if the user is not authenticated.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!auth.currentUser) {
    throw new Error('Sign in to use AI features');
  }
  const idToken = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
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
  isFallbackTemplate?: boolean;
}

export interface MarksheetParseResponse {
  success: boolean;
  errorCode?: string;
  message?: string;
  data?: any;
  partialData?: any;
  requiresManualVerification?: boolean;
}

export async function requestTaskBreakdown(
  title: string,
  description?: string,
  category?: string
): Promise<Subtask[]> {
  try {
    if (!auth.currentUser) {
      // Return deterministic heuristic subtasks when operating offline / signed out
      return getOfflineFallbackSubtasks(title);
    }

    const headers = await getAuthHeaders();
    const response = await fetch('/api/gemini/breakdown', {
      method: 'POST',
      headers,
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
  } catch (e: any) {
    console.warn('Task breakdown request fell back to local heuristics:', e?.message || e);
  }

  return getOfflineFallbackSubtasks(title);
}

function getOfflineFallbackSubtasks(title: string): Subtask[] {
  return [
    {
      id: `st-${Date.now()}-1`,
      title: `Review prerequisites and gather resources for ${title}`,
      completed: false,
      estimatedMinutes: 25,
    },
    {
      id: `st-${Date.now()}-2`,
      title: `Execute primary objective for ${title}`,
      completed: false,
      estimatedMinutes: 45,
    },
    {
      id: `st-${Date.now()}-3`,
      title: `Verify output and mark completion`,
      completed: false,
      estimatedMinutes: 20,
    },
  ];
}

export const generateTaskSubtasks = requestTaskBreakdown;

export async function requestFinanceInsights(
  transactions: Transaction[],
  budget: number,
  totalIncome: number,
  totalExpense: number
): Promise<FinanceInsightResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/finance-insights', {
    method: 'POST',
    headers,
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
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/study-guide', {
    method: 'POST',
    headers,
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
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini/deep-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to run master AI planner');
  }

  const data = await response.json();
  return data.plan;
}

export async function requestParseMarksheet(
  rawText: string,
  usnHint?: string
): Promise<MarksheetParseResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/vtu/parse-marksheet', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawText, usnHint }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to parse marksheet');
  }

  return response.json();
}
