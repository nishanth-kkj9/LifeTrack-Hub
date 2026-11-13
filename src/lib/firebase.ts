import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  UserAppData,
  Task,
  Transaction,
  ExamReminder,
  Habit,
  QuickNote,
  BudgetSettings,
  DailyLifeMetric,
} from '../types/index.ts';
import { INITIAL_VTU_PROFILE } from './vtuData.ts';
import { getLocalDateOffset, getLocalDateString } from './dateUtils.ts';
import { purgeOldTombstones } from './entity.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  // SECURITY: never embed user PII (email/uid) into thrown error strings —
  // they surface in UI toasts, console logs and crash reports.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Firestore Error [${operationType}] ${path ?? '(unknown path)'}:`, message);
  throw new Error(`Firestore ${operationType} failed: ${message}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const LOCAL_STORAGE_KEY = 'lifetrack_app_data_v1';
export const LEGACY_STORAGE_KEY = 'lifetrack_hub_local_data_v1';

export function clearLocalData(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem('lifetrack_local_user');
  } catch (e) {
    console.warn('Failed to clear local storage:', e);
  }
}

export const INITIAL_DATA: UserAppData = {
  tasks: [
    {
      id: 'task-1',
      title: 'Submit Calculus Assignment 4',
      description: 'Finish problems 12 through 20 on multivariable integration.',
      category: 'study',
      priority: 'high',
      dueDate: getLocalDateOffset(1),
      dueTime: '18:00',
      completed: false,
      subtasks: [
        { id: 'st-1', title: 'Review double integrals theorem', completed: true, estimatedMinutes: 20 },
        { id: 'st-2', title: 'Solve problems 12 to 16', completed: false, estimatedMinutes: 45 },
        { id: 'st-3', title: 'Typeset or scan solutions to PDF', completed: false, estimatedMinutes: 15 },
      ],
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'task-2',
      title: 'Pay Apartment Electricity & Internet Bill',
      description: 'Check billing portal and send transfer before late fee kicks in.',
      category: 'finance',
      priority: 'urgent',
      dueDate: getLocalDateString(),
      dueTime: '20:00',
      completed: false,
      subtasks: [
        { id: 'st-4', title: 'Verify meter reading amount', completed: true, estimatedMinutes: 5 },
        { id: 'st-5', title: 'Execute bank online payment', completed: false, estimatedMinutes: 5 },
      ],
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'task-3',
      title: 'Prepare flashcards for Biology midterm',
      description: 'Cellular respiration, photosynthesis cycle, and enzyme kinetics.',
      category: 'study',
      priority: 'medium',
      dueDate: getLocalDateOffset(2),
      completed: false,
      subtasks: [
        { id: 'st-6', title: 'Digest chapter 8 summary', completed: true, estimatedMinutes: 30 },
        { id: 'st-7', title: 'Generate 25 Anki digital flashcards', completed: false, estimatedMinutes: 30 },
      ],
      createdAt: Date.now() - 14400000,
    },
    {
      id: 'task-4',
      title: 'Grocery restock: Protein, produce, oats',
      description: 'Weekly healthy meal-prep essentials.',
      category: 'personal',
      priority: 'low',
      dueDate: getLocalDateOffset(1),
      completed: true,
      completedAt: Date.now() - 1800000,
      subtasks: [
        { id: 'st-8', title: 'Check fridge inventory', completed: true, estimatedMinutes: 5 },
        { id: 'st-9', title: 'Buy spinach, chicken breast, Greek yogurt', completed: true, estimatedMinutes: 25 },
      ],
      createdAt: Date.now() - 28800000,
    }
  ],
  transactions: [
    {
      id: 'tx-1',
      title: 'Part-time Tutoring Stipend',
      amount: 450,
      type: 'income',
      category: 'Salary & Wages',
      date: getLocalDateOffset(-2),
      paymentMethod: 'Bank Transfer',
      notes: 'Bi-weekly calculus tutoring sessions payout',
      createdAt: Date.now() - 2 * 86400000,
    },
    {
      id: 'tx-2',
      title: 'Monthly Textbooks & Lab Workbook',
      amount: 78.50,
      type: 'expense',
      category: 'Books & Supplies',
      date: getLocalDateOffset(-3),
      paymentMethod: 'Card',
      notes: 'Required lab manual for Chemistry',
      createdAt: Date.now() - 3 * 86400000,
    },
    {
      id: 'tx-3',
      title: 'Weekly Grocery Haul',
      amount: 64.20,
      type: 'expense',
      category: 'Groceries',
      date: getLocalDateOffset(-1),
      paymentMethod: 'Card',
      notes: 'Weekly fresh food supplies',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'tx-4',
      title: 'Campus Dining Lunch & Coffee',
      amount: 14.75,
      type: 'expense',
      category: 'Food & Dining',
      date: getLocalDateString(),
      paymentMethod: 'Online Wallet',
      notes: 'Library study session fuel',
      createdAt: Date.now() - 10000000,
    },
  ],
  budget: {
    monthlyBudget: 800,
    savingsGoal: 200,
  },
  exams: [
    {
      id: 'exam-1',
      subject: 'Data Structures & Algorithms',
      courseCode: 'CS 210',
      examDate: getLocalDateOffset(4),
      examTime: '09:00',
      roomOrVenue: 'Hall B - Tech Center',
      targetScore: '92% (A)',
      status: 'studying',
      topics: [
        { id: 'top-1', title: 'Binary Search Trees & AVL rotations', completed: true },
        { id: 'top-2', title: 'Graph Traversals (BFS, DFS, Dijkstra)', completed: true },
        { id: 'top-3', title: 'Dynamic Programming (Knapsack, Memoization)', completed: false },
        { id: 'top-4', title: 'Hash Table Collisions & Time Complexity', completed: false },
      ],
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'exam-2',
      subject: 'General Chemistry II',
      courseCode: 'CHEM 102',
      examDate: getLocalDateOffset(9),
      examTime: '13:30',
      roomOrVenue: 'Science Annex 104',
      targetScore: '88% (A-)',
      status: 'reviewing',
      topics: [
        { id: 'top-5', title: 'Chemical Equilibrium & Le Chatelier', completed: true },
        { id: 'top-6', title: 'Acid-Base Titrations & Buffers', completed: true },
        { id: 'top-7', title: 'Thermodynamics & Gibbs Free Energy', completed: false },
      ],
      createdAt: Date.now() - 2 * 86400000,
    },
    {
      id: 'exam-3',
      subject: 'Microeconomics Principles',
      courseCode: 'ECON 101',
      examDate: getLocalDateOffset(14),
      examTime: '11:00',
      roomOrVenue: 'Online LMS Lockdown Browser',
      targetScore: '95% (A+)',
      status: 'not_started',
      topics: [
        { id: 'top-8', title: 'Supply, Demand, and Price Elasticity', completed: false },
        { id: 'top-9', title: 'Consumer Surplus & Deadweight Loss', completed: false },
        { id: 'top-10', title: 'Monopolies and Oligopoly Game Theory', completed: false },
      ],
      createdAt: Date.now() - 3 * 86400000,
    },
  ],
  habits: [
    {
      id: 'habit-1',
      name: 'Active Study (2+ Hours)',
      category: 'Study',
      targetDaysPerWeek: 6,
      completedDates: [
        getLocalDateOffset(-3),
        getLocalDateOffset(-2),
        getLocalDateOffset(-1),
        getLocalDateString(),
      ],
      streak: 4,
      bestStreak: 12,
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: 'habit-2',
      name: 'Track Every Dollar Spent',
      category: 'Finance',
      targetDaysPerWeek: 7,
      completedDates: [
        getLocalDateOffset(-2),
        getLocalDateOffset(-1),
        getLocalDateString(),
      ],
      streak: 3,
      bestStreak: 21,
      createdAt: Date.now() - 15 * 86400000,
    },
    {
      id: 'habit-3',
      name: 'Physical Workout / 7K Steps',
      category: 'Health',
      targetDaysPerWeek: 5,
      completedDates: [
        getLocalDateOffset(-1),
        getLocalDateString(),
      ],
      streak: 2,
      bestStreak: 7,
      createdAt: Date.now() - 8 * 86400000,
    },
    {
      id: 'habit-4',
      name: 'Drink 2 Liters Water',
      category: 'Health',
      targetDaysPerWeek: 7,
      completedDates: [
        getLocalDateOffset(-1),
        getLocalDateString(),
      ],
      streak: 2,
      bestStreak: 14,
      createdAt: Date.now() - 12 * 86400000,
    },
  ],
  notes: [
    {
      id: 'note-1',
      title: 'Calculus Integration by Parts Formula',
      content: '∫ u dv = uv - ∫ v du.\nLIATE rule for choosing u:\nL: Logarithmic\nI: Inverse trigonometric\nA: Algebraic\nT: Trigonometric\nE: Exponential',
      category: 'Formulas',
      pinned: true,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: 'note-2',
      title: '50/30/20 Budgeting Rule',
      content: '• 50% Needs (Rent, utilities, basic groceries)\n• 30% Wants (Dining out, entertainment, shopping)\n• 20% Financial Goals (Emergency savings, tuition debt repayment)',
      category: 'Finance',
      pinned: true,
      updatedAt: Date.now() - 172800000,
    }
  ],
  vtuProfile: INITIAL_VTU_PROFILE,
  version: 1,
  lastUpdated: Date.now(),
};

export const EMPTY_USER_DATA: UserAppData = {
  tasks: [],
  transactions: [],
  budget: {
    monthlyBudget: 0,
    savingsGoal: 0,
  },
  exams: [],
  habits: [],
  notes: [],
  vtuProfile: INITIAL_VTU_PROFILE,
  version: 1,
  lastUpdated: 0,
};

/**
 * Known seed item IDs shipped with demo sample data.
 */
export const SEED_IDS = new Set<string>([
  'task-1', 'task-2', 'task-3', 'task-4',
  'tx-1', 'tx-2', 'tx-3', 'tx-4',
  'exam-1', 'exam-2', 'exam-3',
  'habit-1', 'habit-2', 'habit-3', 'habit-4',
  'note-1', 'note-2',
  'top-1', 'top-2', 'top-3', 'top-4', 'top-5', 'top-6', 'top-7', 'top-8', 'top-9', 'top-10',
  'st-1', 'st-2', 'st-3', 'st-4', 'st-5', 'st-6', 'st-7', 'st-8', 'st-9'
]);

/**
 * Checks if the dataset contains genuine user-created content (items with non-seed IDs).
 * Toggling completion state on a demo item does NOT classify it as user-created.
 */
export function hasUserCreatedContent(data: UserAppData | null | undefined): boolean {
  if (!data) return false;
  const hasTask = Array.isArray(data.tasks) && data.tasks.some((t) => t && t.id && !t.deletedAt && !SEED_IDS.has(t.id));
  const hasTx = Array.isArray(data.transactions) && data.transactions.some((tx) => tx && tx.id && !tx.deletedAt && !SEED_IDS.has(tx.id));
  const hasExam = Array.isArray(data.exams) && data.exams.some((e) => e && e.id && !e.deletedAt && !SEED_IDS.has(e.id));
  const hasHabit = Array.isArray(data.habits) && data.habits.some((h) => h && h.id && !h.deletedAt && !SEED_IDS.has(h.id));
  const hasNote = Array.isArray(data.notes) && data.notes.some((n) => n && n.id && !n.deletedAt && !SEED_IDS.has(n.id));
  const hasMetric = Array.isArray(data.dailyMetrics) && data.dailyMetrics.some((m) => m && !m.deletedAt);
  return hasTask || hasTx || hasExam || hasHabit || hasNote || hasMetric;
}

/**
 * Merges two entity arrays by ID keeping the item with the newer updatedAt timestamp.
 * Preserves recent tombstones (deletedAt) so stale devices observe deletions,
 * and garbage-collects tombstones older than 30 days.
 */
export function mergeArraysById<T extends { id: string; updatedAt?: number; deletedAt?: number }>(
  cloudItems: T[] = [],
  localItems: T[] = [],
  now: number = Date.now()
): T[] {
  const map = new Map<string, T>();

  for (const item of cloudItems) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }

  for (const localItem of localItems) {
    if (localItem && localItem.id) {
      const existing = map.get(localItem.id);
      if (!existing) {
        map.set(localItem.id, localItem);
      } else {
        const localTime = localItem.updatedAt || 0;
        const cloudTime = existing.updatedAt || 0;
        if (localTime > cloudTime) {
          map.set(localItem.id, localItem);
        } else if (localTime === cloudTime && localItem.deletedAt && !existing.deletedAt) {
          map.set(localItem.id, localItem);
        }
      }
    }
  }

  return purgeOldTombstones(Array.from(map.values()), now);
}

/**
 * Merges cloud snapshot and local data without replacing whole arrays with stale copies.
 */
export function mergeUserAppData(cloudData: UserAppData, localData: UserAppData, now: number = Date.now()): UserAppData {
  const isLocalNewer = (localData.lastUpdated || 0) > (cloudData.lastUpdated || 0);
  return {
    ...cloudData,
    tasks: mergeArraysById(cloudData.tasks, localData.tasks, now),
    transactions: mergeArraysById(cloudData.transactions, localData.transactions, now),
    exams: mergeArraysById(cloudData.exams, localData.exams, now),
    habits: mergeArraysById(cloudData.habits, localData.habits, now),
    notes: mergeArraysById(cloudData.notes, localData.notes, now),
    dailyMetrics: mergeArraysById(cloudData.dailyMetrics || [], localData.dailyMetrics || [], now),
    budget: isLocalNewer ? localData.budget : cloudData.budget,
    vtuProfile: isLocalNewer ? localData.vtuProfile : cloudData.vtuProfile,
    masterPlan: isLocalNewer ? localData.masterPlan : cloudData.masterPlan,
    version: Math.max(cloudData.version || 1, localData.version || 1),
    lastUpdated: Math.max(cloudData.lastUpdated || 0, localData.lastUpdated || 0),
  };
}

/**
 * Demo/sample dataset. NEVER auto-loaded as the default app state anymore:
 * fresh users start empty, and sample data is an explicit user action
 * (Settings → Data Management → "Load Sample Data"). This prevents fictional
 * tasks/transactions from being silently seeded into a signed-in user's cloud doc.
 */
export function getDemoData(): UserAppData {
  return INITIAL_DATA;
}

/**
 * Defensive sanitizer for persisted/imported app data.
 * Coerces required shapes, ensures updatedAt is populated on items, and ensures version number.
 */
export function sanitizeUserAppData(input: any): { data: UserAppData; repaired: boolean } {
  let repaired = false;
  const src = input && typeof input === 'object' ? input : {};

  const cleanArray = <T,>(v: any, ok: (item: any) => boolean, assignDefaults?: (item: any) => any): T[] => {
    if (!Array.isArray(v)) {
      repaired = true;
      return [];
    }
    const out: T[] = [];
    for (const item of v) {
      if (ok(item)) {
        out.push(assignDefaults ? assignDefaults(item) : item);
      } else {
        repaired = true;
      }
    }
    return out;
  };

  const isRecord = (x: unknown): x is Record<string, any> => x !== null && typeof x === 'object';

  const tasks = cleanArray<Task>(
    src.tasks,
    (t) => isRecord(t) && typeof t.id === 'string' && typeof t.title === 'string',
    (t) => ({
      ...t,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : (repaired = true, []),
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : 0,
    })
  );

  const transactions = cleanArray<Transaction>(
    src.transactions,
    (t) => isRecord(t) && typeof t.id === 'string' && typeof t.amount === 'number',
    (t) => ({
      ...t,
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : 0,
    })
  );

  const exams = cleanArray<ExamReminder>(
    src.exams,
    (e) => isRecord(e) && typeof e.id === 'string',
    (e) => ({
      ...e,
      topics: Array.isArray(e.topics) ? e.topics : (repaired = true, []),
      updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : 0,
    })
  );

  const habits = cleanArray<Habit>(
    src.habits,
    (h) => isRecord(h) && typeof h.id === 'string',
    (h) => ({
      ...h,
      completedDates: Array.isArray(h.completedDates) ? h.completedDates : (repaired = true, []),
      updatedAt: typeof h.updatedAt === 'number' ? h.updatedAt : 0,
    })
  );

  const notes = cleanArray<QuickNote>(
    src.notes,
    (n) => isRecord(n) && typeof n.id === 'string',
    (n) => ({
      ...n,
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : 0,
    })
  );

  const dailyMetrics = cleanArray<DailyLifeMetric>(
    src.dailyMetrics,
    (m) => isRecord(m) && typeof m.date === 'string',
    (m) => ({
      ...m,
      id: typeof m.id === 'string' && m.id ? m.id : m.date,
      updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : 0,
    })
  );

  const budget: BudgetSettings =
    isRecord(src.budget) && typeof src.budget.monthlyBudget === 'number'
      ? (src.budget as BudgetSettings)
      : (repaired = true, { monthlyBudget: 0, savingsGoal: 0 });

  const data: UserAppData = {
    ...src,
    tasks,
    transactions,
    exams,
    habits,
    notes,
    dailyMetrics,
    budget,
    vtuProfile: isRecord(src.vtuProfile) ? (src.vtuProfile as UserAppData['vtuProfile']) : INITIAL_VTU_PROFILE,
    version: typeof src.version === 'number' ? src.version : 1,
    lastUpdated: typeof src.lastUpdated === 'number' ? src.lastUpdated : 0,
  };
  return { data, repaired };
}

export const CORRUPT_BACKUP_KEY = 'lifetrack_app_data_v1_corrupt_backup';

export function loadLocalData(): UserAppData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const { data, repaired } = sanitizeUserAppData(parsed);
        if (repaired) {
          console.error('[Data Integrity] Persisted app data was malformed and has been repaired. Original saved to', CORRUPT_BACKUP_KEY);
          try {
            localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
          } catch {
            // quarantine is best-effort
          }
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
  }
  return EMPTY_USER_DATA;
}

export function saveLocalData(data: UserAppData): boolean {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[Persistence] Failed to save to localStorage (quota exceeded?):', e);
    try {
      window.dispatchEvent(new CustomEvent('lifetrack-storage-full'));
    } catch {
      // non-browser context
    }
    return false;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user;
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      console.info('Google sign-in popup was dismissed by the user.');
      return null;
    }
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function createGoogleUserProfile(email = 'local@device.invalid', displayName?: string): User {
  const name = displayName || 'Local User';
  const safeId = email.replace(/[^a-zA-Z0-9]/g, '_');
  return {
    uid: `local_${safeId}`,
    displayName: name,
    email,
    emailVerified: false,
    isAnonymous: true,
    photoURL: null,
    providerData: [
      {
        providerId: 'local',
        uid: email,
        displayName: name,
        email,
        phoneNumber: null,
        photoURL: null,
      },
    ],
    metadata: {},
    phoneNumber: null,
    providerId: 'local',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({
      uid: `local_${safeId}`,
      displayName: name,
      email,
      emailVerified: false,
      isAnonymous: true,
    }),
  } as unknown as User;
}

function hasMergedChanges(cloudData: UserAppData, merged: UserAppData): boolean {
  const serialize = (d: UserAppData) =>
    JSON.stringify({
      tasks: d.tasks,
      transactions: d.transactions,
      exams: d.exams,
      habits: d.habits,
      notes: d.notes,
      dailyMetrics: d.dailyMetrics || [],
      budget: d.budget,
      vtuProfile: d.vtuProfile,
      masterPlan: d.masterPlan,
    });
  return serialize(cloudData) !== serialize(merged);
}

export function subscribeToUserDoc(
  userId: string,
  onUpdate: (data: UserAppData) => void,
  onError: (err: unknown) => void
) {
  if (!auth.currentUser) {
    const local = loadLocalData();
    onUpdate(local);
    return () => {};
  }

  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const { data: sanitizedCloudData } = sanitizeUserAppData(snapshot.data());
        const localData = loadLocalData();
        const merged = mergeUserAppData(sanitizedCloudData, localData);
        saveLocalData(merged);
        onUpdate(merged);

        if (hasMergedChanges(sanitizedCloudData, merged)) {
          const pushDoc: UserAppData = {
            ...merged,
            version: (sanitizedCloudData.version || 1) + 1,
            lastUpdated: Date.now(),
          };
          setDoc(userRef, pushDoc, { merge: true }).catch((err) => {
            console.warn('Reconcile cloud merge notice:', err?.message || err);
          });
        }
      } else {
        const localData = loadLocalData();
        const shouldMigrate = hasUserCreatedContent(localData);
        const initialToSave = shouldMigrate ? localData : EMPTY_USER_DATA;
        const initialDoc: UserAppData = {
          ...initialToSave,
          version: 1,
          lastUpdated: Date.now(),
        };
        setDoc(userRef, initialDoc).catch((err) => {
          console.warn('Initial cloud seed notice:', err?.message || err);
        });
        saveLocalData(initialDoc);
        onUpdate(initialDoc);
      }
    },
    (err) => {
      console.warn('Firestore subscription notice:', err?.message || err);
      onError(err);
    }
  );
}

export async function saveUserDataToCloud(userId: string, data: UserAppData): Promise<void> {
  const nextVersion = (data.version || 1) + 1;
  const dataToSave: UserAppData = {
    ...data,
    version: nextVersion,
    lastUpdated: Date.now(),
  };
  saveLocalData(dataToSave);

  if (!auth.currentUser) {
    throw new Error('Not signed into Firebase Authentication. Cloud sync requires an active cloud session.');
  }

  if (auth.currentUser.uid !== userId) {
    throw new Error('Active session does not match document owner.');
  }

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, dataToSave, { merge: true });
}
