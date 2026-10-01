import express, { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const apiRouter = express.Router();
apiRouter.use(express.json());

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function logSafeGeminiDiagnostic(endpoint: string, model: string, error: any) {
  const status = error?.status || error?.code || (error?.message?.includes('401') ? 401 : 500);
  const reason = error?.error?.details?.[0]?.reason || (error?.message?.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ? 'ACCESS_TOKEN_TYPE_UNSUPPORTED' : 'SERVICE_ERROR');
  const authMode = process.env.GEMINI_API_KEY?.startsWith('AQ.') ? 'AI_STUDIO_USER_KEY' : (process.env.GEMINI_API_KEY ? 'API_KEY' : 'NONE');

  // Log safe diagnostic metadata without exposing API keys, tokens, or auth headers
  console.info(`[Gemini Diagnostics] endpoint="${endpoint}" model="${model}" sdkVersion="2.25.0" authMode="${authMode}" status=${status} reason="${reason}"`);
}

function generateHeuristicSubtasks(title: string, description?: string, category?: string) {
  const cleanTitle = title.trim();
  const lower = cleanTitle.toLowerCase();

  if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test') || lower.includes('study') || lower.includes('revision')) {
    return [
      { title: `Review core formulas and syllabus concepts for ${cleanTitle}`, estimatedMinutes: 30 },
      { title: `Solve 3-5 previous year practice questions (PYQs)`, estimatedMinutes: 45 },
      { title: `Create active-recall flashcards / summary cheat sheet`, estimatedMinutes: 25 },
      { title: `Take a 20-minute timed self-mock assessment`, estimatedMinutes: 20 },
    ];
  }

  if (lower.includes('code') || lower.includes('project') || lower.includes('build') || lower.includes('app') || lower.includes('dev') || lower.includes('bug')) {
    return [
      { title: `Define specifications and test criteria for ${cleanTitle}`, estimatedMinutes: 20 },
      { title: `Implement core logic and modules`, estimatedMinutes: 50 },
      { title: `Run unit tests and verify edge cases`, estimatedMinutes: 25 },
      { title: `Document changes and finalize code review`, estimatedMinutes: 15 },
    ];
  }

  if (lower.includes('assignment') || lower.includes('homework') || lower.includes('lab') || lower.includes('record')) {
    return [
      { title: `Review problem statement and grading criteria`, estimatedMinutes: 15 },
      { title: `Draft complete solutions and source code`, estimatedMinutes: 45 },
      { title: `Validate results and write lab observation / report`, estimatedMinutes: 30 },
      { title: `Format according to submission guidelines and submit`, estimatedMinutes: 15 },
    ];
  }

  if (lower.includes('presentation') || lower.includes('slide') || lower.includes('pitch') || lower.includes('talk')) {
    return [
      { title: `Structure outline and main talking points`, estimatedMinutes: 25 },
      { title: `Design clean slides with diagrams and metrics`, estimatedMinutes: 45 },
      { title: `Rehearse presentation delivery and timing`, estimatedMinutes: 20 },
      { title: `Prepare anticipated Q&A answers`, estimatedMinutes: 15 },
    ];
  }

  if (lower.includes('buy') || lower.includes('purchase') || lower.includes('order') || lower.includes('shop')) {
    return [
      { title: `Compare prices, reviews, and specifications`, estimatedMinutes: 20 },
      { title: `Check current budget allowance and payment methods`, estimatedMinutes: 10 },
      { title: `Place order and save receipt / warranty info`, estimatedMinutes: 10 },
    ];
  }

  // Default structured decomposition
  return [
    { title: `Gather required materials and research for ${cleanTitle}`, estimatedMinutes: 20 },
    { title: `Complete primary milestone for ${cleanTitle}`, estimatedMinutes: 45 },
    { title: `Review results against requirements`, estimatedMinutes: 20 },
    { title: `Finalize details and wrap up`, estimatedMinutes: 15 },
  ];
}

// 1. Fast AI Task Breakdown with resilient fallback
apiRouter.post('/gemini/breakdown', async (req: Request, res: Response) => {
  const { title, description, category } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert productivity coach. Break down the following task into 3 to 5 logical, clear, actionable subtasks.
Task: "${title}"
${description ? `Details: "${description}"` : ''}
${category ? `Category: "${category}"` : ''}

Respond ONLY with a valid JSON array of objects with the exact schema:
[
  { "title": "Subtask title", "estimatedMinutes": 25 }
]
Do not wrap in markdown quotes or codeblocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    let rawText = response.text || '';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let subtasks = [];
    try {
      subtasks = JSON.parse(rawText);
    } catch {
      subtasks = rawText.split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 5)
        .map(line => ({
          title: line.replace(/^[-*0-9.)\s]+/, '').trim(),
          estimatedMinutes: 20
        }));
    }

    if (Array.isArray(subtasks) && subtasks.length > 0) {
      return res.json({ subtasks });
    }
  } catch (error: any) {
    console.warn('Gemini breakdown service note (using resilient heuristic engine):', error?.message || error);
  }

  const fallbackSubtasks = generateHeuristicSubtasks(title, description, category);
  return res.json({ subtasks: fallbackSubtasks });
});

// 2. Financial Spending Insights & Advice
apiRouter.post('/gemini/finance-insights', async (req: Request, res: Response) => {
  const { transactions, budget, totalIncome, totalExpense } = req.body;
  const inc = Number(totalIncome) || 0;
  const exp = Number(totalExpense) || 0;
  const bgt = Number(budget) || 0;

  try {
    const ai = getGeminiClient();
    const prompt = `Analyze this personal finance snapshot:
- Total Income: $${inc}
- Total Expense: $${exp}
- Monthly Budget: $${bgt}
- Recent Transactions (up to 15):
${JSON.stringify((transactions || []).slice(0, 15), null, 2)}

Provide a concise, highly practical financial diagnosis in valid JSON with:
{
  "healthStatus": "Healthy" | "Attention Needed" | "Over Budget",
  "summary": "1-2 sentence overall review of spending habits and budget health",
  "recommendations": ["Direct tip 1", "Direct tip 2", "Direct tip 3"],
  "topSavingsOpportunity": "1 specific category or habit where the user can save the most money immediately"
}
Ensure the output is clean JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    let rawText = response.text || '';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini finance insights note (using rule-based analysis):', error?.message || error);
  }

  // Resilient heuristic financial diagnosis
  const isOverBudget = bgt > 0 && exp > bgt;
  const isHighSpend = inc > 0 && exp > inc * 0.8;
  const healthStatus = isOverBudget ? 'Over Budget' : isHighSpend ? 'Attention Needed' : 'Healthy';

  return res.json({
    healthStatus,
    summary: isOverBudget
      ? `Total expenses ($${exp.toLocaleString()}) have surpassed your monthly budget target of $${bgt.toLocaleString()}. Immediate spending adjustments recommended.`
      : `Spending is currently at $${exp.toLocaleString()} against an income of $${inc.toLocaleString()}, maintaining a positive cash-flow margin.`,
    recommendations: [
      'Audit recurring digital subscriptions and cancel unused memberships',
      'Maintain an automated 20% transfer to emergency liquid savings',
      'Set weekly discretionary dining and entertainment caps'
    ],
    topSavingsOpportunity: 'Review top 3 highest recent expenses and evaluate discretionary alternatives.'
  });
});

// 3. Search-Grounded Exam Study Guide using gemini-3.8-flash
apiRouter.post('/gemini/study-guide', async (req: Request, res: Response) => {
  const { subject, topics, examDate, targetGrade } = req.body;
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Research high-yield revision topics and authoritative study strategies for an upcoming exam in: "${subject}".
Topics/Syllabus: ${(topics || []).join(', ') || 'General curriculum'}
Exam Date: ${examDate || 'Soon'}
Target: ${targetGrade || 'A / High score'}

Provide an actionable, structured exam study roadmap including:
1. High-Yield Key Concepts & Core Formulas / Definitions
2. Active Recall & Practice Questions to test comprehension
3. Recommended authoritative study resources / references
4. A countdown revision strategy (spaced repetition advice)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
    console.warn('Gemini study guide note (using structured syllabus generator):', error?.message || error);
  }

  const topicList = (topics || []).length > 0 ? (topics || []).join(', ') : 'Core modules and foundational theories';
  return res.json({
    guide: `### Comprehensive Revision Blueprint: ${subject}\n\n` +
      `**Target Goal:** ${targetGrade || 'A Grade / Distinction'} | **Exam Timeline:** ${examDate || 'Upcoming Session'}\n\n` +
      `#### 1. High-Yield Focus Modules\n` +
      `- **Key Scope:** ${topicList}\n` +
      `- **Core Formulas & Definitions:** Master primary theorems, state diagrams, and mathematical derivations from standard VTU CBCS model question papers.\n\n` +
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
      { title: 'VTU CBCS Syllabus Portal', uri: 'https://vtu.ac.in/cbcs-syllabus' }
    ]
  });
});

// 4. Master High-Thinking Planner using gemini-3.8-flash
apiRouter.post('/gemini/deep-plan', async (req: Request, res: Response) => {
  const { tasks, exams, finances, habits, userQuery } = req.body;

  try {
    const ai = getGeminiClient();
    const context = `
Current Active Tasks:
${JSON.stringify((tasks || []).slice(0, 10).map((t: any) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate, completed: t.completed })), null, 2)}

Upcoming Exams:
${JSON.stringify((exams || []).slice(0, 5).map((e: any) => ({ subject: e.subject, date: e.date, status: e.status, topicsCount: e.topics?.length })), null, 2)}

Habits to maintain:
${JSON.stringify((habits || []).slice(0, 6).map((h: any) => ({ name: h.name, streak: h.streak })), null, 2)}

Finances:
Total Expense: $${finances?.totalExpense || 0}, Budget: $${finances?.budget || 0}

User Query/Focus: "${userQuery || 'Create a comprehensive, stress-managed master schedule and priority roadmap balancing my upcoming exams, urgent tasks, and daily routine.'}"
`;

    const prompt = `You are a high-level executive cognitive planner and academic/life strategist.
Evaluate all aspects of the user's workload, upcoming exam pressure, urgent deadlines, and habits:
${context}

Provide a deep, multi-phase master action plan:
1. **Critical Path & Immediate Triage**: What MUST be done today vs what can be deferred.
2. **Academic Exam Prep Matrix**: Day-by-day revision slots using spaced repetition.
3. **Daily Rhythm & Energy Management**: Time blocks for deep work, habit maintenance, and cognitive recovery.
4. **Financial & Task Checklist**: Quick 10-minute administrative wins to remove mental friction.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    if (response.text) {
      return res.json({ plan: response.text });
    }
  } catch (error: any) {
    console.warn('Gemini deep plan note (using structured executive planner):', error?.message || error);
  }

  const activeTaskCount = (tasks || []).filter((t: any) => !t.completed).length;
  const examCount = (exams || []).length;

  return res.json({
    plan: `### Executive Action Plan & Focus Roadmap\n\n` +
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
      `- Clear zero-cost small tasks in quick 5-minute sprints to build momentum.`
  });
});

// 5. Real-Time VTU Student Result & Marksheet AI Parser
apiRouter.post('/vtu/parse-marksheet', async (req: Request, res: Response) => {
  const { rawText, usnHint } = req.body;
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_INPUT',
      message: 'Marksheet text is required for parsing.',
      requiresManualVerification: true,
    });
  }

  const usnMatch = rawText.match(/\b([1-4][A-Z]{2}\d{2}[A-Z]{2}\d{3})\b/i);
  const detectedUsn = usnMatch ? usnMatch[1].toUpperCase() : (usnHint ? usnHint.toUpperCase() : undefined);

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
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    let textOut = response.text || '';
    textOut = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(textOut);
    if (parsed && Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
      return res.json({ success: true, data: parsed });
    }
  } catch (error: any) {
    logSafeGeminiDiagnostic('/vtu/parse-marksheet', 'gemini-3.8-flash', error);
  }

  // Section 15: Data-Safe Academic Parse Failure — NEVER fabricate grades, marks, or SGPA
  return res.json({
    success: false,
    errorCode: 'MARKSHEET_PARSE_FAILED',
    message: 'The marksheet could not be reliably parsed from the provided input text. Please enter subject marks manually.',
    partialData: detectedUsn ? { usn: detectedUsn } : {},
    requiresManualVerification: true,
  });
});

