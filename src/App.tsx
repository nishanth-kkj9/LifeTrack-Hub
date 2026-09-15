import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  subscribeToUserDoc,
  saveUserDataToCloud,
  loadLocalData,
  saveLocalData,
} from './lib/firebase.ts';
import {
  UserAppData,
  Task,
  Transaction,
  ExamReminder,
  Habit,
  QuickNote,
  BudgetSettings,
} from './types/index.ts';
import { Header } from './components/Header.tsx';
import { Navigation, ActiveTab } from './components/Navigation.tsx';
import { OverviewView } from './components/views/OverviewView.tsx';
import { TasksView } from './components/views/TasksView.tsx';
import { FinancesView } from './components/views/FinancesView.tsx';
import { ExamsView } from './components/views/ExamsView.tsx';
import { HabitsView } from './components/views/HabitsView.tsx';
import { NotesView } from './components/views/NotesView.tsx';
import { VtuHubView } from './components/views/VtuHubView.tsx';
import { INITIAL_VTU_PROFILE } from './lib/vtuData.ts';
import { VtuProfile } from './types/index.ts';
import { AddTaskModal } from './components/modals/AddTaskModal.tsx';
import { AddTransactionModal } from './components/modals/AddTransactionModal.tsx';
import { AddExamModal } from './components/modals/AddExamModal.tsx';
import { AddNoteModal } from './components/modals/AddNoteModal.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Core Application Data State
  const [appData, setAppData] = useState<UserAppData>(() => loadLocalData());

  // Modal Open States
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);

  // Status message / toast for auth / sync
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsCloudSynced(true);
        // Subscribe to user Firestore doc
        const unsubsDoc = subscribeToUserDoc(
          user.uid,
          (cloudData) => {
            setAppData(cloudData);
            saveLocalData(cloudData);
          },
          (err) => {
            console.error('Cloud sync error:', err);
            setIsCloudSynced(false);
          }
        );
        return () => unsubsDoc();
      } else {
        setIsCloudSynced(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Persist data helper (local and cloud)
  const commitAppData = useCallback(
    (updater: (prev: UserAppData) => UserAppData) => {
      setAppData((prev) => {
        const next = updater(prev);
        saveLocalData(next);

        if (currentUser) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            saveUserDataToCloud(currentUser.uid, next)
              .then(() => setIsCloudSynced(true))
              .catch((err) => {
                console.error('Failed to sync to cloud:', err);
                setIsCloudSynced(false);
              });
          }, 400);
        }
        return next;
      });
    },
    [currentUser]
  );

  // Authentication Handlers
  const handleLogin = async () => {
    try {
      setSyncNotice('Connecting to Google...');
      const user = await loginWithGoogle();
      if (user) {
        setSyncNotice(`Signed in as ${user.displayName || user.email}! Cloud sync active.`);
        setTimeout(() => setSyncNotice(null), 3500);
      }
    } catch (err: any) {
      console.error('Login prompt failed:', err);
      setSyncNotice(
        'Note: If popups are restricted in this preview window, open the app in a new tab to sign in with Google. All features remain fully saved locally!'
      );
      setTimeout(() => setSyncNotice(null), 7000);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setIsCloudSynced(false);
      setSyncNotice('Signed out. Switched to browser local storage.');
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Task Operations
  const handleToggleTask = (taskId: string) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? Date.now() : undefined,
              subtasks: !t.completed
                ? t.subtasks.map((s) => ({ ...s, completed: true }))
                : t.subtasks,
            }
          : t
      ),
    }));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const handleAddTask = (newTask: Task) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  const handleClearCompletedTasks = () => {
    commitAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => !t.completed),
    }));
  };

  // Finances Operations
  const handleAddTransaction = (newTx: Transaction) => {
    commitAppData((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));
  };

  const handleDeleteTransaction = (txId: string) => {
    commitAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== txId),
    }));
  };

  const handleUpdateBudget = (newBudget: BudgetSettings) => {
    commitAppData((prev) => ({
      ...prev,
      budget: newBudget,
    }));
  };

  // Exams Operations
  const handleAddExam = (newExam: ExamReminder) => {
    commitAppData((prev) => ({
      ...prev,
      exams: [...prev.exams, newExam],
    }));
  };

  const handleUpdateExam = (updatedExam: ExamReminder) => {
    commitAppData((prev) => ({
      ...prev,
      exams: prev.exams.map((e) => (e.id === updatedExam.id ? updatedExam : e)),
    }));
  };

  const handleDeleteExam = (examId: string) => {
    commitAppData((prev) => ({
      ...prev,
      exams: prev.exams.filter((e) => e.id !== examId),
    }));
  };

  // Habits Operations
  const handleToggleHabitDate = (habitId: string, dateStr: string) => {
    commitAppData((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        const alreadyDone = h.completedDates.includes(dateStr);
        const nextDates = alreadyDone
          ? h.completedDates.filter((d) => d !== dateStr)
          : [...h.completedDates, dateStr];

        // Recompute streak
        const sorted = [...nextDates].sort().reverse();
        let streak = 0;
        let checkDate = new Date();
        const todayStr = checkDate.toISOString().split('T')[0];

        // Check if completed today or yesterday
        if (sorted.includes(todayStr)) {
          streak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = checkDate.toISOString().split('T')[0];
          if (sorted.includes(yesterdayStr)) {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }

        if (streak > 0) {
          while (true) {
            const iso = checkDate.toISOString().split('T')[0];
            if (sorted.includes(iso)) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        return {
          ...h,
          completedDates: nextDates,
          streak,
          bestStreak: Math.max(h.bestStreak, streak),
        };
      }),
    }));
  };

  const handleAddHabit = (newHabit: Habit) => {
    commitAppData((prev) => ({
      ...prev,
      habits: [...prev.habits, newHabit],
    }));
  };

  const handleDeleteHabit = (habitId: string) => {
    commitAppData((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== habitId),
    }));
  };

  // Notes Operations
  const handleAddNote = (newNote: QuickNote) => {
    commitAppData((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
    }));
  };

  const handleUpdateNote = (updatedNote: QuickNote) => {
    commitAppData((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)),
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    commitAppData((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
  };

  const handleUpdateVtuProfile = (updatedProfile: VtuProfile) => {
    commitAppData((prev) => ({
      ...prev,
      vtuProfile: updatedProfile,
    }));
  };

  const handleAddExamFromVtuSubject = (subjectCode: string, subjectName: string) => {
    const existing = appData.exams.find((e) => e.courseCode === subjectCode);
    if (existing) {
      setActiveTab('exams');
      return;
    }

    const defaultDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const newExam: ExamReminder = {
      id: `exam-vtu-${Date.now()}`,
      subject: subjectName,
      courseCode: subjectCode,
      examDate: defaultDate,
      examTime: '09:30',
      roomOrVenue: 'VTU Exam Hall',
      targetScore: '85% (A+)',
      status: 'studying',
      topics: [
        { id: `top-${Date.now()}-1`, title: 'Module 1: Fundamental Concepts & Theorems', completed: true },
        { id: `top-${Date.now()}-2`, title: 'Module 2: Core Analysis & Design', completed: false },
        { id: `top-${Date.now()}-3`, title: 'Module 3: Advanced Architectures & Algorithms', completed: false },
        { id: `top-${Date.now()}-4`, title: 'Module 4: Practical Applications & Case Studies', completed: false },
        { id: `top-${Date.now()}-5`, title: 'Module 5: Emerging Trends & Standard Protocols', completed: false },
      ],
      createdAt: Date.now(),
    };

    commitAppData((prev) => ({
      ...prev,
      exams: [newExam, ...prev.exams],
    }));
    setActiveTab('exams');
  };

  // Stats for badge
  const activeTasksCount = appData.tasks.filter((t) => !t.completed).length;
  const nowTime = Date.now();
  const urgentExamsCount = appData.exams.filter((e) => {
    const examMs = new Date(`${e.examDate}T${e.examTime || '09:00'}`).getTime();
    const diffDays = (examMs - nowTime) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* App Header */}
      <Header
        user={currentUser}
        isCloudSynced={isCloudSynced}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeTasksCount={activeTasksCount}
      />

      {/* Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        badgeCounts={{
          tasks: activeTasksCount,
          urgentExams: urgentExamsCount,
        }}
      />

      {/* Sync / Notification Alert Banner */}
      {syncNotice && (
        <div
          id="sync-notice-banner"
          className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 text-xs font-semibold text-indigo-900 flex items-center justify-between transition-all"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span>{syncNotice}</span>
            <button
              onClick={() => setSyncNotice(null)}
              className="text-indigo-600 hover:text-indigo-800 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content-view" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'overview' && (
          <OverviewView
            tasks={appData.tasks}
            transactions={appData.transactions}
            budget={appData.budget}
            exams={appData.exams}
            habits={appData.habits}
            vtuProfile={appData.vtuProfile || INITIAL_VTU_PROFILE}
            onNavigateTab={setActiveTab}
            onToggleTask={handleToggleTask}
            onToggleHabitToday={(id) =>
              handleToggleHabitDate(id, new Date().toISOString().split('T')[0])
            }
            onOpenAddTaskModal={() => setIsAddTaskOpen(true)}
            onOpenAddTransactionModal={() => setIsAddTxOpen(true)}
            onOpenAddExamModal={() => setIsAddExamOpen(true)}
          />
        )}

        {activeTab === 'vtu' && (
          <VtuHubView
            vtuProfile={appData.vtuProfile || INITIAL_VTU_PROFILE}
            onUpdateVtuProfile={handleUpdateVtuProfile}
            onAddExamFromSubject={handleAddExamFromVtuSubject}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={appData.tasks}
            onToggleTask={handleToggleTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
            onImportTasks={(newTasks) =>
              commitAppData((prev) => ({
                ...prev,
                tasks: [...newTasks, ...prev.tasks],
              }))
            }
            onOpenAddTaskModal={() => setIsAddTaskOpen(true)}
            onClearCompletedTasks={handleClearCompletedTasks}
          />
        )}

        {activeTab === 'finances' && (
          <FinancesView
            transactions={appData.transactions}
            budget={appData.budget}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateBudget={handleUpdateBudget}
            onOpenAddTransactionModal={() => setIsAddTxOpen(true)}
          />
        )}

        {activeTab === 'exams' && (
          <ExamsView
            exams={appData.exams}
            onAddExam={handleAddExam}
            onUpdateExam={handleUpdateExam}
            onDeleteExam={handleDeleteExam}
            onOpenAddExamModal={() => setIsAddExamOpen(true)}
          />
        )}

        {activeTab === 'habits' && (
          <HabitsView
            habits={appData.habits}
            onToggleHabitDate={handleToggleHabitDate}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
          />
        )}

        {activeTab === 'notes' && (
          <NotesView
            notes={appData.notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onOpenAddNoteModal={() => setIsAddNoteOpen(true)}
          />
        )}
      </main>

      {/* Global Modals */}
      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAddTask={handleAddTask}
      />

      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        onAddTransaction={handleAddTransaction}
      />

      <AddExamModal
        isOpen={isAddExamOpen}
        onClose={() => setIsAddExamOpen(false)}
        onAddExam={handleAddExam}
      />

      <AddNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        onAddNote={handleAddNote}
      />
    </div>
  );
}
