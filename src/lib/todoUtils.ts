import confetti from 'canvas-confetti';
import { Task, TaskPriority, TaskCategory, TaskRecurrence, TaskStatus } from '../types/index.ts';

// =========================================================================
// 1. NATURAL LANGUAGE TASK PARSER (NLP)
// =========================================================================
export interface ParsedTaskInput {
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: TaskPriority;
  category: TaskCategory;
  tags: string[];
  estimatedMinutes?: number;
  recurring: TaskRecurrence;
}

export function parseNaturalLanguageTask(rawInput: string): ParsedTaskInput {
  let text = rawInput.trim();
  const today = new Date();
  
  let targetDate = new Date(today);
  let hasExplicitDate = false;
  let dueTime: string | undefined = undefined;
  let priority: TaskPriority = 'medium';
  let category: TaskCategory = 'study';
  const tags: string[] = [];
  let estimatedMinutes: number | undefined = undefined;
  let recurring: TaskRecurrence = 'none';

  // Extract Tags: #tagname
  const tagMatches = text.match(/#([a-zA-Z0-9_-]+)/g);
  if (tagMatches) {
    tagMatches.forEach((tag) => {
      const cleanTag = tag.slice(1).toLowerCase();
      tags.push(cleanTag);
      // Auto-assign category if matches
      if (['study', 'work', 'personal', 'finance', 'health', 'project'].includes(cleanTag)) {
        category = cleanTag as TaskCategory;
      }
    });
    text = text.replace(/#([a-zA-Z0-9_-]+)/g, '').trim();
  }

  // Extract Priority: p1 / !1 / urgent / p2 / high / p3 / med / p4 / low
  if (/\b(p1|!1|urgent|critical)\b/i.test(text)) {
    priority = 'urgent';
    text = text.replace(/\b(p1|!1|urgent|critical)\b/gi, '').trim();
  } else if (/\b(p2|!2|high)\b/i.test(text)) {
    priority = 'high';
    text = text.replace(/\b(p2|!2|high)\b/gi, '').trim();
  } else if (/\b(p3|!3|medium|med)\b/i.test(text)) {
    priority = 'medium';
    text = text.replace(/\b(p3|!3|medium|med)\b/gi, '').trim();
  } else if (/\b(p4|!4|low)\b/i.test(text)) {
    priority = 'low';
    text = text.replace(/\b(p4|!4|low)\b/gi, '').trim();
  }

  // Extract Duration / Estimates: ~30m, ~1h, 45mins, 2hours
  const estMatch = text.match(/~?(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours)\b/i);
  if (estMatch) {
    const val = parseInt(estMatch[1], 10);
    const unit = estMatch[2].toLowerCase();
    if (unit.startsWith('h')) {
      estimatedMinutes = val * 60;
    } else {
      estimatedMinutes = val;
    }
    text = text.replace(estMatch[0], '').trim();
  }

  // Extract Recurrence: everyday, daily, weekly, every monday
  if (/\b(every\s*day|daily)\b/i.test(text)) {
    recurring = 'daily';
    text = text.replace(/\b(every\s*day|daily)\b/gi, '').trim();
  } else if (/\b(every\s*weekday|weekdays)\b/i.test(text)) {
    recurring = 'weekdays';
    text = text.replace(/\b(every\s*weekday|weekdays)\b/gi, '').trim();
  } else if (/\b(every\s*week|weekly)\b/i.test(text)) {
    recurring = 'weekly';
    text = text.replace(/\b(every\s*week|weekly)\b/gi, '').trim();
  } else if (/\b(every\s*month|monthly)\b/i.test(text)) {
    recurring = 'monthly';
    text = text.replace(/\b(every\s*month|monthly)\b/gi, '').trim();
  }

  // Extract Relative Dates: today, tomorrow, tonight, in X days, next mon/tue/wed...
  if (/\b(today|tonight)\b/i.test(text)) {
    targetDate = new Date(today);
    hasExplicitDate = true;
    text = text.replace(/\b(today|tonight)\b/gi, '').trim();
  } else if (/\b(tomorrow|tmrw)\b/i.test(text)) {
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 1);
    hasExplicitDate = true;
    text = text.replace(/\b(tomorrow|tmrw)\b/gi, '').trim();
  } else if (/\bin\s+(\d+)\s+days?\b/i.test(text)) {
    const daysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      hasExplicitDate = true;
      text = text.replace(daysMatch[0], '').trim();
    }
  } else {
    // Check weekday: next monday, on friday, etc.
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekdays.length; i++) {
      const re = new RegExp(`\\b(next|this|on)?\\s*${weekdays[i]}\\b`, 'i');
      if (re.test(text)) {
        const currentDay = today.getDay();
        let diff = i - currentDay;
        if (diff <= 0) diff += 7;
        targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + diff);
        hasExplicitDate = true;
        text = text.replace(re, '').trim();
        break;
      }
    }
  }

  // Extract Time: at 5pm, @ 17:30, 4:00 pm, 10am
  const timeMatch = text.match(/(?:at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch && (timeMatch[3] || text.includes('at ') || text.includes('@'))) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3]?.toLowerCase();

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      dueTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      text = text.replace(timeMatch[0], '').trim();
    }
  }

  // Default to today if not specified
  if (!hasExplicitDate) {
    targetDate = new Date(today);
  }

  // Clean trailing punctuation or prepositions
  const cleanTitle = text
    .replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const formattedDate = targetDate.toISOString().split('T')[0];

  return {
    title: cleanTitle || rawInput.trim(),
    dueDate: formattedDate,
    dueTime,
    priority,
    category,
    tags,
    estimatedMinutes: estimatedMinutes || 25,
    recurring,
  };
}

// =========================================================================
// 2. WEB AUDIO API SYNTHESIZER (TACTILE SOUNDS & AMBIENCE)
// =========================================================================
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play a tactile, harmonic completion chime (similar to Things 3 / Linear)
export function playTaskCompleteSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Primary Tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.16); // C6

    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Harmonic Sparkle
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now + 0.06); // E6
    gain2.gain.setValueAtTime(0.06, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.4);
  } catch {
    // Graceful fallback if audio is blocked
  }
}

// Play focus session interval chime
export function playFocusBellSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.2);
  } catch {}
}

// Ambient Focus Sound Synthesizer (White Noise / Binaural 40Hz Alpha / Gentle Rain)
export class FocusSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;

  public start(type: 'whitenoise' | 'rain' | 'binaural40' | 'stream', volume: number = 0.2) {
    this.stop();
    try {
      this.ctx = getAudioContext();
      if (!this.ctx) return;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      if (type === 'binaural40') {
        // Binaural 40Hz Gamma Focus Beat (200Hz Left, 240Hz Right)
        const merger = this.ctx.createChannelMerger(2);
        
        const oscLeft = this.ctx.createOscillator();
        oscLeft.type = 'sine';
        oscLeft.frequency.value = 200;

        const oscRight = this.ctx.createOscillator();
        oscRight.type = 'sine';
        oscRight.frequency.value = 240;

        oscLeft.connect(merger, 0, 0);
        oscRight.connect(merger, 0, 1);
        merger.connect(this.gainNode);

        oscLeft.start();
        oscRight.start();
        this.noiseNode = merger;
      } else {
        // Synthesized Pink / Rain Noise buffer
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Apply lowpass/bandpass filter for gentle rain effect
        const filter = this.ctx.createBiquadFilter();
        filter.type = type === 'rain' ? 'lowpass' : type === 'stream' ? 'bandpass' : 'lowpass';
        filter.frequency.value = type === 'rain' ? 800 : type === 'stream' ? 1200 : 1500;

        whiteNoise.connect(filter);
        filter.connect(this.gainNode);
        whiteNoise.start();
        this.noiseNode = whiteNoise;
      }

      this.isPlaying = true;
    } catch {
      this.isPlaying = false;
    }
  }

  public setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  public stop() {
    if (this.noiseNode) {
      try {
        if ('stop' in this.noiseNode) {
          (this.noiseNode as any).stop();
        }
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    this.isPlaying = false;
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}

export const focusSoundEngine = new FocusSoundEngine();

// =========================================================================
// 3. CELEBRATION CONFETTI
// =========================================================================
export function triggerTaskConfetti() {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85, x: 0.5 },
      colors: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'],
      disableForReducedMotion: true,
    });
  } catch {}
}

export function triggerStreakCelebration() {
  try {
    const end = Date.now() + 1000;
    const interval: any = setInterval(() => {
      if (Date.now() > end) {
        return clearInterval(interval);
      }
      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ['#6366f1', '#10b981', '#fbbf24', '#a855f7'],
      });
    }, 200);
  } catch {}
}

// =========================================================================
// 4. PRESET PRODUCTIVITY TASK TEMPLATES
// =========================================================================
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TaskCategory;
  priority: TaskPriority;
  tasks: Array<{
    title: string;
    description?: string;
    category: TaskCategory;
    priority: TaskPriority;
    estimatedMinutes: number;
    subtasks: string[];
    tags: string[];
  }>;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'exam-mastery-sprint',
    name: 'Academic Exam Prep Sprint',
    description: 'Structured 4-step preparation cycle for university midterms and finals.',
    icon: 'GraduationCap',
    category: 'study',
    priority: 'urgent',
    tasks: [
      {
        title: 'Review Course Syllabus & Blueprint Weightage',
        description: 'Map high-weightage modules, identify weak topics, and gather formula sheets.',
        category: 'study',
        priority: 'high',
        estimatedMinutes: 45,
        subtasks: [
          'Highlight top 3 recurring module topics',
          'Consolidate handwritten formula cheat-sheet',
          'Bookmark tricky theorem proofs',
        ],
        tags: ['study', 'examprep', 'revision'],
      },
      {
        title: 'Solve Past 3 Years University Question Papers',
        description: 'Timed practice on previous examination questions under test conditions.',
        category: 'study',
        priority: 'urgent',
        estimatedMinutes: 90,
        subtasks: [
          'Attempt 2023 SEE question paper Section A & B',
          'Check marking scheme against self-solutions',
          'Redo missed numerical questions',
        ],
        tags: ['study', 'pyq', 'practice'],
      },
      {
        title: 'Conduct Final Mock Test & Fast Recap',
        description: 'Rapid flashcard review and summary memory retrieval.',
        category: 'study',
        priority: 'high',
        estimatedMinutes: 60,
        subtasks: [
          'Review all module 1-5 definitions',
          'Practice 2 complex derivation diagrams',
          'Pack exam hall essentials (calculator, ID card, admit pass)',
        ],
        tags: ['study', 'mocktest'],
      },
    ],
  },
  {
    id: 'weekly-sunday-reset',
    name: 'Weekly Productivity Reset',
    description: 'Clear cognitive backlog, organize calendar, review finances, and prep meals.',
    icon: 'RotateCcw',
    category: 'personal',
    priority: 'medium',
    tasks: [
      {
        title: 'Zero Out Digital Inboxes & Class Portals',
        description: 'Archive emails, check assignments due this week, clear download folder.',
        category: 'personal',
        priority: 'medium',
        estimatedMinutes: 30,
        subtasks: [
          'Check college portal / LMS announcements',
          'Clear inbox to 0 unread messages',
          'Organize desktop files into folders',
        ],
        tags: ['reset', 'inboxzero', 'organization'],
      },
      {
        title: 'Weekly Financial Spending Review',
        description: 'Audit card expenses, track budget surplus, set savings targets for the week.',
        category: 'finance',
        priority: 'medium',
        estimatedMinutes: 20,
        subtasks: [
          'Log pending offline cash receipts',
          'Review weekly discretionary budget remaining',
        ],
        tags: ['finance', 'budget'],
      },
      {
        title: 'Schedule Top 3 Priority Milestones for the Week',
        description: 'Time-block deep work sessions on your calendar before Monday begins.',
        category: 'work',
        priority: 'high',
        estimatedMinutes: 25,
        subtasks: [
          'Identify #1 needle-moving task for the week',
          'Block 2-hour morning deep work slots in calendar',
        ],
        tags: ['planning', 'deepwork'],
      },
    ],
  },
  {
    id: 'engineering-project-sprint',
    name: 'Software / Project Build Sprint',
    description: 'Systematic workflow from architecture to clean deployment.',
    icon: 'Code',
    category: 'project',
    priority: 'high',
    tasks: [
      {
        title: 'System Architecture & Schema Design',
        description: 'Define database entities, API contract endpoints, and wireframes.',
        category: 'project',
        priority: 'high',
        estimatedMinutes: 60,
        subtasks: [
          'Draft database schema tables & relations',
          'Define REST/GraphQL API contracts',
          'Create high-fidelity UI component mockups',
        ],
        tags: ['project', 'architecture', 'coding'],
      },
      {
        title: 'Core Backend Logic & Service Implementation',
        description: 'Build backend routes, data validation, and unit test suites.',
        category: 'project',
        priority: 'urgent',
        estimatedMinutes: 120,
        subtasks: [
          'Implement CRUD repository handlers',
          'Add payload validation middleware',
          'Run automated test cases',
        ],
        tags: ['project', 'backend'],
      },
      {
        title: 'Frontend Integration & Production Deployment',
        description: 'Wire state handlers, test edge conditions, and ship build.',
        category: 'project',
        priority: 'high',
        estimatedMinutes: 90,
        subtasks: [
          'Connect UI states with API services',
          'Audit responsive layout on mobile & desktop',
          'Trigger production build verification',
        ],
        tags: ['project', 'frontend', 'shipping'],
      },
    ],
  },
];
