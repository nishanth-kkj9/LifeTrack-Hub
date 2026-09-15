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
  return new GoogleGenAI({ apiKey });
}

// 1. Fast AI Task Breakdown using gemini-3.1-flash-lite
apiRouter.post('/gemini/breakdown', async (req: Request, res: Response) => {
  try {
    const { title, description, category } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const ai = getGeminiClient();
    const prompt = `You are an expert productivity coach. Break down the following task into 3 to 6 logical, clear, actionable subtasks.
Task: "${title}"
${description ? `Details: "${description}"` : ''}
${category ? `Category: "${category}"` : ''}

Respond ONLY with a valid JSON array of objects with the exact schema:
[
  { "title": "Subtask title", "estimatedMinutes": 25 }
]
Do not wrap in markdown quotes or codeblocks if possible, or provide valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
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

    return res.json({ subtasks });
  } catch (error: any) {
    console.error('Error in /gemini/breakdown:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate task breakdown' });
  }
});

// 2. Financial Spending Insights & Advice using gemini-3.1-flash-lite
apiRouter.post('/gemini/finance-insights', async (req: Request, res: Response) => {
  try {
    const { transactions, budget, totalIncome, totalExpense } = req.body;
    const ai = getGeminiClient();

    const prompt = `Analyze this personal finance snapshot:
- Total Income: $${totalIncome || 0}
- Total Expense: $${totalExpense || 0}
- Monthly Budget: $${budget || 0}
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
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    let rawText = response.text || '';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch {
      return res.json({
        healthStatus: totalExpense > budget ? 'Attention Needed' : 'Healthy',
        summary: rawText.slice(0, 200),
        recommendations: [
          'Audit recurring subscriptions and monthly memberships',
          'Allocate at least 20% of net balance to an emergency fund',
          'Establish weekly spend thresholds for dining and groceries'
        ],
        topSavingsOpportunity: 'Review discretionary spending and compare with monthly targets'
      });
    }
  } catch (error: any) {
    console.error('Error in /gemini/finance-insights:', error);
    return res.status(500).json({ error: error?.message || 'Failed to analyze finances' });
  }
});

// 3. Search-Grounded Exam Study Guide using gemini-3.5-flash with Google Search
apiRouter.post('/gemini/study-guide', async (req: Request, res: Response) => {
  try {
    const { subject, topics, examDate, targetGrade } = req.body;
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

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
      model: 'gemini-3.5-flash',
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
    console.error('Error in /gemini/study-guide:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate study guide' });
  }
});

// 4. Master High-Thinking Planner using gemini-3.1-pro-preview with ThinkingLevel.HIGH
apiRouter.post('/gemini/deep-plan', async (req: Request, res: Response) => {
  try {
    const { tasks, exams, finances, habits, userQuery } = req.body;
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
2. **Academic Exam Prep Matrix**: Day-by-day revision slots using spaced repetition and the Feynman technique.
3. **Daily Rhythm & Energy Management**: Time blocks for deep work, habit maintenance, and cognitive recovery.
4. **Financial & Task Checklist**: Quick 10-minute administrative wins to remove mental friction.

Be specific, realistic, and inspiring.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    return res.json({
      plan: response.text || 'Plan generated successfully.',
    });
  } catch (error: any) {
    console.error('Error in /gemini/deep-plan:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate deep master plan' });
  }
});

// 5. Real-Time VTU Student Result & Marksheet AI Parser using gemini-3.1-flash-lite
apiRouter.post('/vtu/parse-marksheet', async (req: Request, res: Response) => {
  try {
    const { rawText, usnHint } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Marksheet text is required' });
    }

    const ai = getGeminiClient();
    const prompt = `You are a specialized Visvesvaraya Technological University (VTU) Academic Marks & Student Record Parser.
Extract real-time student details, examination session, and individual subject marks from the provided raw VTU result text or marksheet.

Raw VTU text:
"""
${rawText.slice(0, 4000)}
"""
${usnHint ? `Target USN hint: "${usnHint}"` : ''}

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
      "credits": number (typically 4 for theory, 3 for electives, 1.5 for lab, 1 for mandatory non-credit/ethics),
      "cieMarks": number (internal marks, 0-50),
      "seeMarks": number (external exam marks, 0-50 or 0-100 scaled to 50),
      "totalMarks": number (0-100),
      "gradeLetter": "O" | "A+" | "A" | "B+" | "B" | "C" | "P" | "F",
      "gradePoint": number (0-10),
      "result": "PASS" | "FAIL"
    }
  ]
}
If any specific detail is missing from the text, infer it logically based on VTU 2022/2021 CBCS grading rules. Ensure output is strict valid JSON without code blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    let textOut = response.text || '';
    textOut = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(textOut);
      return res.json({ success: true, data: parsed });
    } catch {
      return res.json({ success: false, raw: textOut });
    }
  } catch (error: any) {
    console.error('Error in /vtu/parse-marksheet:', error);
    return res.status(500).json({ error: error?.message || 'Failed to parse VTU marksheet' });
  }
});

