import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '2mb' }));

// Allow configurable Gemini model via environment variable with standard default
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Rate Limiter: In-memory sliding window (30 requests/min per IP)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

// Periodic cleanup of expired rate limit keys
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'anonymous-client';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before sending more AI requests.',
      retryAfterSeconds: retryAfter,
    });
  }

  record.count += 1;
  next();
}

apiRouter.use(rateLimiter);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'lifetrack-hub-backend',
      },
    },
  });
}

function logSafeGeminiDiagnostic(endpoint: string, model: string, error: any) {
  const status = error?.status || error?.code || (error?.message?.includes('401') ? 401 : 500);
  const reason =
    error?.error?.details?.[0]?.reason ||
    (error?.message?.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')
      ? 'ACCESS_TOKEN_TYPE_UNSUPPORTED'
      : 'SERVICE_ERROR');
  const authMode = process.env.GEMINI_API_KEY?.startsWith('AQ.')
    ? 'AI_STUDIO_USER_KEY'
    : process.env.GEMINI_API_KEY
    ? 'API_KEY'
    : 'NONE';

  console.info(
    `[Gemini Diagnostics] endpoint="${endpoint}" model="${model}" authMode="${authMode}" status=${status} reason="${reason}"`
  );
}

function generateHeuristicSubtasks(title: string, description?: string, category?: string) {
  const cleanTitle = (title || 'Task').trim();
  const lower = cleanTitle.toLowerCase();

  if (
    lower.includes('exam') ||
    lower.includes('quiz') ||
    lower.includes('test') ||
    lower.includes('study') ||
    lower.includes('revision')
  ) {
    return [
      { title: `Review core formulas and syllabus concepts for ${cleanTitle}`, estimatedMinutes: 30 },
      { title: `Solve 3-5 previous year practice questions (PYQs)`, estimatedMinutes: 45 },
      { title: `Create active-recall flashcards / summary cheat sheet`, estimatedMinutes: 25 },
      { title: `Take a 20-minute timed self-mock assessment`, estimatedMinutes: 20 },
    ];
  }

  if (
    lower.includes('code') ||
    lower.includes('project') ||
    lower.includes('build') ||
    lower.includes('app') ||
    lower.includes('dev') ||
    lower.includes('bug')
  ) {
    return [
      { title: `Define specifications and test criteria for ${cleanTitle}`, estimatedMinutes: 20 },
      { title: `Implement core logic and modules`, estimatedMinutes: 50 },
      { title: `Run unit tests and verify edge cases`, estimatedMinutes: 25 },
      { title: `Document changes and finalize code review`, estimatedMinutes: 15 },
    ];
  }

  if (
    lower.includes('assignment') ||
    lower.includes('homework') ||
    lower.includes('lab') ||
    lower.includes('record')
  ) {
    return [
      { title: `Review problem statement and grading criteria`, estimatedMinutes: 15 },
      { title: `Draft complete solutions and source code`, estimatedMinutes: 45 },
      { title: `Validate results and write lab observation / report`, estimatedMinutes: 30 },
      { title: `Format according to submission guidelines and submit`, estimatedMinutes: 15 },
    ];
  }

  return [
    { title: `Gather required materials and research for ${cleanTitle}`, estimatedMinutes: 20 },
    { title: `Complete primary milestone for ${cleanTitle}`, estimatedMinutes: 45 },
    { title: `Review results against requirements`, estimatedMinutes: 20 },
    { title: `Finalize details and wrap up`, estimatedMinutes: 15 },
  ];
}

// 1. Fast AI Task Breakdown with resilient fallback
apiRouter.post('/gemini/breakdown', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { title, description, category } = req.body;
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required and must be a non-empty string' });
    }

    const safeTitle = title.trim().slice(0, 300);
    const safeDesc = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
    const safeCat = typeof category === 'string' ? category.trim().slice(0, 50) : '';

    try {
      const ai = getGeminiClient();
      const prompt = `You are an expert productivity coach. Break down the following task into 3 to 5 logical, actionable subtasks.
Task: "${safeTitle}"
${safeDesc ? `Details: "${safeDesc}"` : ''}
${safeCat ? `Category: "${safeCat}"` : ''}

Respond ONLY with a valid JSON array of objects with the exact schema:
[
  { "title": "Subtask title", "estimatedMinutes": 25 }
]
Do not wrap in markdown quotes or codeblocks.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      let rawText = response.text || '';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      let subtasks: any[] = [];
      try {
        subtasks = JSON.parse(rawText);
      } catch {
        subtasks = rawText
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .slice(0, 5)
          .map((line) => ({
            title: line.replace(/^[-*0-9.)\s]+/, '').trim(),
            estimatedMinutes: 20,
          }));
      }

      if (Array.isArray(subtasks) && subtasks.length > 0) {
        return res.json({ subtasks });
      }
    } catch (error: any) {
      logSafeGeminiDiagnostic('/gemini/breakdown', GEMINI_MODEL, error);
    }

    const fallbackSubtasks = generateHeuristicSubtasks(safeTitle, safeDesc, safeCat);
    return res.json({ subtasks: fallbackSubtasks });
  } catch (outerErr: any) {
    console.error('Unhandled error in /gemini/breakdown:', outerErr);
    return res.status(500).json({ error: 'Failed to process task breakdown' });
  }
});

// 2. Financial Spending Insights & Advice with accurate cash-flow evaluation
apiRouter.post('/gemini/finance-insights', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { transactions, budget, totalIncome, totalExpense, currencySymbol } = req.body;
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const inc = Math.max(0, Number(totalIncome) || 0);
    const exp = Math.max(0, Number(totalExpense) || 0);
    const bgt = Math.max(0, Number(budget) || 0);
    const curr = typeof currencySymbol === 'string' && currencySymbol.trim() ? currencySymbol.trim() : '₹';

    try {
      const ai = getGeminiClient();
      const prompt = `Analyze this student/personal finance snapshot:
- Total Income: ${curr}${inc}
- Total Expense: ${curr}${exp}
- Monthly Budget Target: ${curr}${bgt}
- Recent Transactions (up to 15):
${JSON.stringify(safeTransactions.slice(0, 15), null, 2)}

Provide a concise, highly practical financial diagnosis in valid JSON with:
{
  "healthStatus": "Healthy" | "Attention Needed" | "Over Budget",
  "summary": "1-2 sentence overall review of spending habits and budget health. If income is 0 and expenses exist, explicitly state the deficit.",
  "recommendations": ["Direct tip 1", "Direct tip 2", "Direct tip 3"],
  "topSavingsOpportunity": "1 specific category or habit where the user can save money immediately"
}
Ensure output is clean JSON only.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      let rawText = response.text || '';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(rawText);
      if (parsed && parsed.healthStatus && parsed.summary) {
        return res.json(parsed);
      }
    } catch (error: any) {
      logSafeGeminiDiagnostic('/gemini/finance-insights', GEMINI_MODEL, error);
    }

    // Accurate Rule-Based Financial Assessment
    let healthStatus: 'Healthy' | 'Attention Needed' | 'Over Budget' = 'Healthy';
    let summary = '';
    const recommendations: string[] = [];

    if (exp > 0 && inc === 0) {
      healthStatus = 'Over Budget';
      summary = `Total expenses are ${curr}${exp.toLocaleString()} with zero recorded income, creating a negative cash flow. Immediate spending controls or income logging required.`;
      recommendations.push('Log all allowance or earnings sources to establish a true baseline');
      recommendations.push('Freeze non-essential discretionary spending until income is recorded');
      recommendations.push('Set a strict daily spending limit to curb outflows');
    } else if (bgt > 0 && exp > bgt) {
      healthStatus = 'Over Budget';
      summary = `Total expenses (${curr}${exp.toLocaleString()}) have surpassed your monthly budget limit of ${curr}${bgt.toLocaleString()} by ${curr}${(exp - bgt).toLocaleString()}. Spending reductions recommended.`;
      recommendations.push('Review top expense categories and pause non-urgent purchases');
      recommendations.push('Audit recurring subscription payments');
      recommendations.push('Adjust budget categories to align with realistic semester expenses');
    } else if (inc > 0 && exp > inc) {
      healthStatus = 'Over Budget';
      summary = `Spending (${curr}${exp.toLocaleString()}) exceeds your income (${curr}${inc.toLocaleString()}) by ${curr}${(exp - inc).toLocaleString()}, resulting in an operational deficit.`;
      recommendations.push('Prioritize essential food and academic needs only');
      recommendations.push('Eliminate high-cost dining and delivery orders this week');
      recommendations.push('Build a modest emergency cushion once cash-flow stabilizes');
    } else if (inc > 0 && exp > inc * 0.8) {
      healthStatus = 'Attention Needed';
      summary = `Spending (${curr}${exp.toLocaleString()}) has utilized ${Math.round((exp / inc) * 100)}% of your available income (${curr}${inc.toLocaleString()}), leaving minimal buffer.`;
      recommendations.push('Maintain at least 15-20% savings buffer before month end');
      recommendations.push('Track micro-expenses (snacks, travel) which quietly add up');
      recommendations.push('Cap weekend entertainment spending');
    } else if (inc === 0 && exp === 0) {
      healthStatus = 'Healthy';
      summary = 'No expenses or income logged yet. Add your initial semester budget and transactions to begin tracking.';
      recommendations.push('Log your monthly allowance or stipend');
      recommendations.push('Set realistic monthly budget caps');
      recommendations.push('Categorize regular college expenses');
    } else {
      healthStatus = 'Healthy';
      const net = inc - exp;
      summary = `Spending (${curr}${exp.toLocaleString()}) is well balanced against your income (${curr}${inc.toLocaleString()}), maintaining a healthy net surplus of ${curr}${net.toLocaleString()}.`;
      recommendations.push('Transfer 20% of remaining surplus into liquid savings or investments');
      recommendations.push('Continue monitoring weekly category thresholds');
      recommendations.push('Plan ahead for upcoming semester exam registration or course fees');
    }

    return res.json({
      healthStatus,
      summary,
      recommendations,
      topSavingsOpportunity: 'Review your top 3 largest transactions to identify discretionary savings.',
    });
  } catch (outerErr: any) {
    console.error('Unhandled error in /gemini/finance-insights:', outerErr);
    return res.status(500).json({ error: 'Failed to generate financial insights' });
  }
});

// 3. Search-Grounded Exam Study Guide
apiRouter.post('/gemini/study-guide', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { subject, topics, examDate, targetGrade } = req.body;
    if (typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({ error: 'Subject is required and must be a non-empty string' });
    }

    const safeSubject = subject.trim().slice(0, 200);
    const safeTopics: string[] = Array.isArray(topics)
      ? topics.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
      : typeof topics === 'string' && topics.trim().length > 0
      ? [topics.trim()]
      : [];
    const safeExamDate = typeof examDate === 'string' ? examDate.trim().slice(0, 50) : 'Upcoming';
    const safeTargetGrade = typeof targetGrade === 'string' ? targetGrade.trim().slice(0, 50) : 'A / Distinction';

    try {
      const ai = getGeminiClient();
      const prompt = `Research high-yield revision topics and authoritative study strategies for an upcoming university exam in: "${safeSubject}".
Topics/Syllabus: ${safeTopics.join(', ') || 'Standard academic curriculum'}
Exam Date: ${safeExamDate}
Target: ${safeTargetGrade}

Provide an actionable, structured exam study roadmap including:
1. High-Yield Key Concepts & Core Formulas / Definitions
2. Active Recall & Practice Questions to test comprehension
3. Recommended authoritative study resources / references
4. A countdown revision strategy (spaced repetition advice)`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const guide = response.text || 'Study guide generated successfully.';
      const searchChunks = (response.candidates?.[0]?.groundingMetadata as any)?.groundingChunks || [];
      const sources = searchChunks
        .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
        .map((chunk: any) => ({
          title: chunk.web.title,
          uri: chunk.web.uri,
        }))
        .slice(0, 5);

      return res.json({ guide, sources });
    } catch (error: any) {
      logSafeGeminiDiagnostic('/gemini/study-guide', GEMINI_MODEL, error);
    }

    const topicList = safeTopics.length > 0 ? safeTopics.join(', ') : 'Core modules and foundational theories';
    return res.json({
      guide:
        `### Comprehensive Revision Blueprint: ${safeSubject}\n\n` +
        `**Target Goal:** ${safeTargetGrade} | **Exam Timeline:** ${safeExamDate}\n\n` +
        `#### 1. High-Yield Focus Modules\n` +
        `- **Key Scope:** ${topicList}\n` +
        `- **Core Formulas & Definitions:** Master primary theorems, state diagrams, and mathematical derivations from standard university model question papers.\n\n` +
        `#### 2. Active Recall & Self-Testing\n` +
        `- Solve at least 3 previous 3-year exam papers under timed 3-hour examination conditions.\n` +
        `- Practice explaining core concepts using Feynman technique without looking at notes.\n\n` +
        `#### 3. 7-Day Spaced Repetition Schedule\n` +
        `- **Days 1-2:** Intensive concept synthesis and high-yield question mapping.\n` +
        `- **Days 3-4:** Problem solving, code/circuit trace, and formula drill.\n` +
        `- **Days 5-6:** Full mock test review and CIE mark gap remediation.\n` +
        `- **Day 7:** Lightweight review, formula sheet glance, and rest.`,
      sources: [
        { title: 'VTU Model Question Papers & Scheme', uri: 'https://vtu.ac.in/model-question-paper' },
        { title: 'VTU CBCS Syllabus Portal', uri: 'https://vtu.ac.in/cbcs-syllabus' },
      ],
    });
  } catch (outerErr: any) {
    console.error('Unhandled error in /gemini/study-guide:', outerErr);
    return res.status(500).json({ error: 'Failed to generate study guide' });
  }
});

// 4. Master High-Thinking Planner
apiRouter.post('/gemini/deep-plan', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object' });
    }

    const { tasks, exams, finances, habits, userQuery } = req.body;
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeExams = Array.isArray(exams) ? exams : [];
    const safeHabits = Array.isArray(habits) ? habits : [];
    const safeFinances = finances && typeof finances === 'object' ? finances : {};
    const safeUserQuery =
      typeof userQuery === 'string' && userQuery.trim().length > 0
        ? userQuery.trim().slice(0, 500)
        : 'Create a comprehensive, stress-managed master schedule and priority roadmap balancing my upcoming exams, urgent tasks, and daily routine.';

    try {
      const ai = getGeminiClient();
      const context = `
Current Active Tasks:
${JSON.stringify(
  safeTasks
    .slice(0, 10)
    .map((t: any) => ({ title: t?.title, priority: t?.priority, dueDate: t?.dueDate, completed: t?.completed })),
  null,
  2
)}

Upcoming Exams:
${JSON.stringify(
  safeExams
    .slice(0, 5)
    .map((e: any) => ({ subject: e?.subject, date: e?.date || e?.examDate, status: e?.status })),
  null,
  2
)}

Habits to maintain:
${JSON.stringify(
  safeHabits.slice(0, 6).map((h: any) => ({ name: h?.name, streak: h?.streak })),
  null,
  2
)}

Finances:
Total Expense: ${safeFinances?.totalExpense || 0}, Budget: ${safeFinances?.budget || 0}

User Focus: "${safeUserQuery}"
`;

      const prompt = `You are a high-level executive cognitive planner and academic strategist.
Evaluate all aspects of the user's workload, upcoming exam pressure, urgent deadlines, and habits:
${context}

Provide a deep, multi-phase master action plan:
1. **Critical Path & Immediate Triage**: What MUST be done today vs what can be deferred.
2. **Academic Exam Prep Matrix**: Day-by-day revision slots using spaced repetition.
3. **Daily Rhythm & Energy Management**: Time blocks for deep work, habit maintenance, and cognitive recovery.
4. **Quick Administrative Wins**: Fast 10-minute tasks to remove mental friction.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      if (response.text) {
        return res.json({ plan: response.text });
      }
    } catch (error: any) {
      logSafeGeminiDiagnostic('/gemini/deep-plan', GEMINI_MODEL, error);
    }

    const activeTaskCount = safeTasks.filter((t: any) => !t?.completed).length;
    const examCount = safeExams.length;

    return res.json({
      plan:
        `### Executive Action Plan & Focus Roadmap\n\n` +
        `**Current Workload:** ${activeTaskCount} pending tasks | ${examCount} scheduled examinations\n\n` +
        `#### 1. Critical Path & Immediate Triage (Next 24 Hours)\n` +
        `- Prioritize top urgent tasks due within 48 hours.\n` +
        `- Delegate or reschedule non-essential administrative items.\n` +
        `- Lock in one 90-minute uninterrupted deep-work block this morning.\n\n` +
        `#### 2. Academic Exam Preparation Matrix\n` +
        `- Allocate 2 hours daily specifically for high-yield exam question papers.\n` +
        `- Apply active recall instead of passive reading to increase retention by up to 50%.\n\n` +
        `#### 3. Daily Rhythm & Energy Optimization\n` +
        `- **Morning (8:00 - 11:30 AM):** Deep analytical tasks, mathematics, and code.\n` +
        `- **Afternoon (2:00 - 4:30 PM):** Revision, assignments, and documentation.\n` +
        `- **Evening (7:00 - 9:00 PM):** Light review, habit tracking, and relaxation.\n\n` +
        `#### 4. Quick Administrative Wins\n` +
        `- Clear zero-cost small tasks in quick 5-minute sprints to build momentum.`,
    });
  } catch (outerErr: any) {
    console.error('Unhandled error in /gemini/deep-plan:', outerErr);
    return res.status(500).json({ error: 'Failed to generate deep action plan' });
  }
});

// 5. Real-Time VTU Student Result & Marksheet AI Parser
apiRouter.post('/vtu/parse-marksheet', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object.',
        requiresManualVerification: true,
      });
    }

    const { rawText, usnHint } = req.body;
    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_INPUT',
        message: 'Marksheet text is required for parsing.',
        requiresManualVerification: true,
      });
    }

    const safeUsnHint = typeof usnHint === 'string' ? usnHint.trim().slice(0, 20) : undefined;
    const usnMatch = rawText.match(/\b([1-4][A-Z]{2}\d{2}[A-Z]{2}\d{3})\b/i);
    const detectedUsn = usnMatch
      ? usnMatch[1].toUpperCase()
      : safeUsnHint
      ? safeUsnHint.toUpperCase()
      : undefined;

    try {
      const ai = getGeminiClient();
      const prompt = `You are a specialized Visvesvaraya Technological University (VTU) Academic Marks & Student Record Parser.
Extract real-time student details, examination session, and individual subject marks from the provided raw VTU result text or marksheet.

Raw VTU text:
"""
${rawText.slice(0, 4000)}
"""
${detectedUsn ? `Target USN hint: "${detectedUsn}"` : ''}

Extract and return ONLY a valid JSON object matching this schema:
{
  "usn": "1XX##XX### (uppercase VTU USN format)",
  "studentName": "Full Name as printed on VTU portal",
  "fatherName": "Father's/Guardian's Name or empty string",
  "collegeName": "College Name as printed on VTU portal",
  "semester": 1 to 8 (integer),
  "resultDate": "e.g. June/July 2024 Exam",
  "sgpa": number (e.g. 8.75),
  "subjects": [
    {
      "code": "VTU course code e.g. BCS301, 21CS32, 21CSL35",
      "name": "Full subject name",
      "credits": number,
      "cieMarks": number,
      "seeMarks": number,
      "totalMarks": number,
      "gradeLetter": "O" | "A+" | "A" | "B+" | "B" | "C" | "P" | "F",
      "gradePoint": number,
      "result": "PASS" | "FAIL"
    }
  ]
}
If marks or data are not present in the input text, DO NOT fabricate them. Ensure output is strict valid JSON without code blocks.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      let textOut = response.text || '';
      textOut = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(textOut);
      if (parsed && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
        return res.json({ success: true, data: parsed });
      }
    } catch (error: any) {
      logSafeGeminiDiagnostic('/vtu/parse-marksheet', GEMINI_MODEL, error);
    }

    return res.json({
      success: false,
      errorCode: 'MARKSHEET_PARSE_FAILED',
      message:
        'The marksheet could not be reliably parsed from the provided input text. Please enter subject marks manually.',
      partialData: detectedUsn ? { usn: detectedUsn } : {},
      requiresManualVerification: true,
    });
  } catch (outerErr: any) {
    console.error('Unhandled error in /vtu/parse-marksheet:', outerErr);
    return res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to process marksheet parsing request',
    });
  }
});
