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
  getDocFromServer,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAppData } from '../types/index.ts';
import { INITIAL_VTU_PROFILE } from './vtuData.ts';
import { getLocalDateOffset, getLocalDateString } from './dateUtils.ts';

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connection verification test on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
  }
}
testConnection();

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
};

export function loadLocalData(): UserAppData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) {
        if (!parsed.vtuProfile) {
          parsed.vtuProfile = INITIAL_VTU_PROFILE;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
  }
  return INITIAL_DATA;
}

export function saveLocalData(data: UserAppData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
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
    // Re-throw authentic errors so UI can honestly handle them
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function createGoogleUserProfile(email = 'chataiwithcode@gmail.com', displayName?: string): User {
  const name = displayName || email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  const safeId = email.replace(/[^a-zA-Z0-9]/g, '_');
  return {
    uid: `local_${safeId}`,
    displayName: name,
    email,
    emailVerified: false,
    isAnonymous: true,
    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563eb`,
    providerData: [
      {
        providerId: 'local',
        uid: email,
        displayName: name,
        email,
        phoneNumber: null,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563eb`,
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

export function subscribeToUserDoc(
  userId: string,
  onUpdate: (data: UserAppData) => void,
  onError: (err: any) => void
) {
  // If Firebase Auth is not active on SDK level, use local storage safely
  if (!auth.currentUser) {
    const local = loadLocalData();
    onUpdate(local);
    return () => {};
  }

  const path = `users/${userId}`;
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as UserAppData;
        onUpdate(cloudData);
      } else {
        // First time cloud user: if local storage has explicit user data, migrate it;
        // otherwise initialize a clean user account without injecting mock demo records into cloud.
        const hasCustomLocalData = Boolean(localStorage.getItem(LOCAL_STORAGE_KEY));
        const initialToSave = hasCustomLocalData ? loadLocalData() : EMPTY_USER_DATA;
        setDoc(userRef, { ...initialToSave, lastUpdated: Date.now() }).catch((err) => {
          console.warn('Initial cloud seed notice:', err?.message || err);
        });
        onUpdate(initialToSave);
      }
    },
    (err) => {
      console.warn('Firestore subscription notice:', err?.message || err);
      onError(err);
    }
  );
}

export async function saveUserDataToCloud(userId: string, data: UserAppData): Promise<void> {
  // Always maintain local persistence
  saveLocalData(data);

  if (!auth.currentUser) {
    throw new Error('Not signed into Firebase Authentication. Cloud sync requires an active cloud session.');
  }

  if (auth.currentUser.uid !== userId) {
    throw new Error('Active session does not match document owner.');
  }

  const userRef = doc(db, 'users', userId);
  // Re-throw any Firestore errors so UI reports true status
  await setDoc(userRef, { ...data, lastUpdated: Date.now() }, { merge: true });
}
