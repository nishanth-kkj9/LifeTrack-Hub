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
  createGoogleUserProfile,
} from './lib/firebase.ts';
import {
  UserAppData,
  Task,
  Transaction,
  ExamReminder,
  Habit,
  QuickNote,
  BudgetSettings,
  VtuProfile,
  DailyLifeMetric,
} from './types/index.ts';
import { Header } from './components/Header.tsx';
import { Navigation, ActiveTab } from './components/Navigation.tsx';
import { TodayView } from './components/views/TodayView.tsx';
import { TasksView } from './components/views/TasksView.tsx';
import { CalendarView } from './components/views/CalendarView.tsx';
import { AcademicsView } from './components/views/AcademicsView.tsx';
import { FinancesView } from './components/views/FinancesView.tsx';
import { HabitsView } from './components/views/HabitsView.tsx';
import { NotesView } from './components/views/NotesView.tsx';
import { InsightsView } from './components/views/InsightsView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { INITIAL_VTU_PROFILE } from './lib/vtuData.ts';
import { AddTaskModal } from './components/modals/AddTaskModal.tsx';
import { AddTransactionModal } from './components/modals/AddTransactionModal.tsx';
import { AddExamModal } from './components/modals/AddExamModal.tsx';
import { AddNoteModal } from './components/modals/AddNoteModal.tsx';
import { AuthorizedDomainModal } from './components/modals/AuthorizedDomainModal.tsx';
import { GoogleSignInModal } from './components/modals/GoogleSignInModal.tsx';
import { CommandPalette } from './components/common/CommandPalette.tsx';
import { PomodoroFocusModal } from './components/todo/PomodoroFocusModal.tsx';
import { TaskDetailDrawer } from './components/todo/TaskDetailDrawer.tsx';
import { getLocalDateString } from './lib/dateUtils.ts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');

  // Core Application Data State
  const [appData, setAppData] = useState<UserAppData>(() => loadLocalData());

  // Modal & Drawer Open States
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isAuthDomainModalOpen, setIsAuthDomainModalOpen] = useState(false);
  const [isGoogleSignInModalOpen, setIsGoogleSignInModalOpen] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState<Task | null>(null);

  // Status message / toast for auth / sync
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    // Restore locally signed-in profile if any
    const savedLocal = localStorage.getItem('lifetrack_local_user');
    if (savedLocal) {
      try {
        setCurrentUser(JSON.parse(savedLocal));
      } catch (e) {
        // ignore parse error
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setIsCloudSynced(true);
        // Subscribe to user Firestore doc
        const unsubsDoc = subscribeToUserDoc(
          user.uid,
          (cloudData) => {
            setAppData(cloudData);
            saveLocalData(cloudData);
          },
          (err) => {
            console.warn('Cloud sync note:', err);
            setIsCloudSynced(false);
          }
        );
        return () => unsubsDoc();
      } else {
        const localOnly = localStorage.getItem('lifetrack_local_user');
        if (!localOnly) {
          setCurrentUser(null);
          setIsCloudSynced(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Force sync immediately
  const handleForceSync = useCallback(() => {
    if (currentUser) {
      setSyncNotice('Syncing with Firestore cloud...');
      saveUserDataToCloud(currentUser.uid, appData)
        .then(() => {
          setIsCloudSynced(true);
          setSyncNotice('Cloud sync complete!');
          setTimeout(() => setSyncNotice(null), 2500);
        })
        .catch((err) => {
          console.error('Manual sync failed:', err);
          setIsCloudSynced(false);
          setSyncNotice('Cloud sync failed. Check network connection.');
          setTimeout(() => setSyncNotice(null), 4000);
        });
    } else {
      setSyncNotice('Sign in with Google to enable cloud sync.');
      setTimeout(() => setSyncNotice(null), 3000);
    }
  }, [currentUser, appData]);

  // Authentication Handlers
  const handleLogin = () => {
    setIsGoogleSignInModalOpen(true);
  };

  const handleSelectGoogleAccount = (email: string, displayName?: string) => {
    const profile = createGoogleUserProfile(email, displayName);
    setCurrentUser(profile);
    setIsCloudSynced(true);
    localStorage.setItem('lifetrack_local_user', JSON.stringify(profile));
    setSyncNotice(`Signed in with Google as ${email}! Multi-device sync active.`);
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const handleTryFirebasePopup = async () => {
    setSyncNotice('Connecting to Google...');
    const user = await loginWithGoogle();
    if (user) {
      setCurrentUser(user);
      setIsCloudSynced(true);
      localStorage.setItem('lifetrack_local_user', JSON.stringify(user));
      setSyncNotice(`Signed in as ${user.displayName || user.email}! Cloud sync active.`);
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('lifetrack_local_user');
      await logoutUser();
      setCurrentUser(null);
      setIsCloudSynced(false);
      setSyncNotice('Signed out. Switched to browser local storage.');
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err) {
      console.warn('Logout notice:', err);
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
    if (selectedDetailTask?.id === updatedTask.id) {
      setSelectedDetailTask(updatedTask);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    if (selectedDetailTask?.id === taskId) {
      setSelectedDetailTask(null);
    }
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
        const currentDates = h.completedDates || [];
        const isDone = currentDates.includes(dateStr);
        const nextCompletedDates = isDone
          ? currentDates.filter((d) => d !== dateStr)
          : [...currentDates, dateStr];

        // Recompute streak
        const sorted = [...nextCompletedDates].sort().reverse();
        let streak = 0;
        let checkDate = new Date();
        const todayStr = getLocalDateString(checkDate);

        if (sorted.includes(todayStr)) {
          streak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = getLocalDateString(checkDate);
          if (sorted.includes(yesterdayStr)) {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }

        if (streak > 0) {
          while (true) {
            const dateIso = getLocalDateString(checkDate);
            if (sorted.includes(dateIso)) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        return {
          ...h,
          completedDates: nextCompletedDates,
          streak,
          bestStreak: Math.max(h.bestStreak || 0, streak),
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

  const handleUpdateHabit = (updatedHabit: Habit) => {
    commitAppData((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)),
    }));
  };

  // Multi-Dimensional Daily Life Metrics Operations
  const handleSaveDailyMetric = (metric: DailyLifeMetric) => {
    commitAppData((prev) => {
      const existing = prev.dailyMetrics || [];
      const filtered = existing.filter((m) => m.date !== metric.date);
      return {
        ...prev,
        dailyMetrics: [metric, ...filtered],
      };
    });
  };

  // Full Data Restoration
  const handleRestoreAppData = (restoredData: UserAppData) => {
    commitAppData((prev) => ({
      ...prev,
      tasks: restoredData.tasks || prev.tasks,
      transactions: restoredData.transactions || prev.transactions,
      budget: restoredData.budget || prev.budget,
      exams: restoredData.exams || prev.exams,
      habits: restoredData.habits || prev.habits,
      notes: restoredData.notes || prev.notes,
      dailyMetrics: restoredData.dailyMetrics || prev.dailyMetrics,
      vtuProfile: restoredData.vtuProfile || prev.vtuProfile,
      lastUpdated: Date.now(),
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

  const handleRestoreData = (restored: UserAppData) => {
    commitAppData(() => restored);
  };

  const handleResetData = () => {
    localStorage.removeItem('lifetrack_hub_local_data_v1');
    const fresh = loadLocalData();
    commitAppData(() => fresh);
  };

  // Focus modal helpers
  const handleOpenFocus = (task?: Task | null) => {
    setFocusTask(task || null);
    setIsFocusModalOpen(true);
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
    <div id="app-root-container" className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* App Header */}
      <Header
        user={currentUser}
        isCloudSynced={isCloudSynced}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeTasksCount={activeTasksCount}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenFocusModal={() => handleOpenFocus(null)}
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
          className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-900 flex items-center justify-between transition-all"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span
              onClick={() => {
                if (syncNotice.includes('Firebase Console') || syncNotice.includes('authorization')) {
                  setIsAuthDomainModalOpen(true);
                }
              }}
              className={syncNotice.includes('authorization') ? 'cursor-pointer underline font-bold' : ''}
            >
              {syncNotice}
            </span>
            <button
              onClick={() => setSyncNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 ml-4 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content-view" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* 1. Today View (Default Landing Operating System) */}
        {(activeTab === 'today' || activeTab === 'overview') && (
          <TodayView
            tasks={appData.tasks}
            habits={appData.habits}
            exams={appData.exams}
            transactions={appData.transactions}
            budget={appData.budget}
            vtuProfile={appData.vtuProfile || INITIAL_VTU_PROFILE}
            onToggleTask={handleToggleTask}
            onToggleHabitToday={(id) =>
              handleToggleHabitDate(id, getLocalDateString())
            }
            onAddTask={handleAddTask}
            onOpenAddTaskModal={() => setIsAddTaskOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenFocusModal={handleOpenFocus}
            onNavigateTab={setActiveTab}
            onSelectTask={(task) => setSelectedDetailTask(task)}
          />
        )}

        {/* 2. Tasks View */}
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

        {/* 3. Calendar View */}
        {activeTab === 'calendar' && (
          <CalendarView
            tasks={appData.tasks}
            exams={appData.exams}
            onToggleTask={handleToggleTask}
            onSelectTask={(task) => setSelectedDetailTask(task)}
            onOpenAddTaskModal={() => setIsAddTaskOpen(true)}
          />
        )}

        {/* 4. Academics View (Unifies Exams & VTU Hub) */}
        {(activeTab === 'academics' || activeTab === 'exams' || activeTab === 'vtu') && (
          <AcademicsView
            exams={appData.exams}
            vtuProfile={appData.vtuProfile || INITIAL_VTU_PROFILE}
            tasks={appData.tasks}
            initialSubTab={activeTab === 'vtu' ? 'vtu' : 'exams'}
            onUpdateVtuProfile={handleUpdateVtuProfile}
            onAddExam={handleAddExam}
            onUpdateExam={handleUpdateExam}
            onOpenAddExamModal={() => setIsAddExamOpen(true)}
            onDeleteExam={handleDeleteExam}
          />
        )}

        {/* 5. Finances View */}
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

        {/* 6. Habits View */}
        {activeTab === 'habits' && (
          <HabitsView
            habits={appData.habits}
            onToggleHabitDate={handleToggleHabitDate}
            onAddHabit={handleAddHabit}
            onDeleteHabit={handleDeleteHabit}
            onUpdateHabit={handleUpdateHabit}
            dailyMetrics={appData.dailyMetrics || []}
            onSaveDailyMetric={handleSaveDailyMetric}
          />
        )}

        {/* 7. Notes View */}
        {activeTab === 'notes' && (
          <NotesView
            notes={appData.notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onOpenAddNoteModal={() => setIsAddNoteOpen(true)}
          />
        )}

        {/* 8. Insights View */}
        {activeTab === 'insights' && (
          <InsightsView
            tasks={appData.tasks}
            habits={appData.habits}
            transactions={appData.transactions}
            budget={appData.budget}
            exams={appData.exams}
            dailyMetrics={appData.dailyMetrics || []}
            onSaveDailyMetric={handleSaveDailyMetric}
            appData={appData}
            onRestoreAppData={handleRestoreAppData}
          />
        )}

        {/* 9. Settings View */}
        {activeTab === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            isCloudSynced={isCloudSynced}
            appData={appData}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onRestoreData={handleRestoreData}
            onResetData={handleResetData}
            onForceSync={handleForceSync}
            onOpenAuthDomainModal={() => setIsAuthDomainModalOpen(true)}
          />
        )}
      </main>

      {/* Global Modals & Overlays */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          setActiveTab(tab as ActiveTab);
          setIsCommandPaletteOpen(false);
        }}
        onOpenAddTask={() => setIsAddTaskOpen(true)}
        onOpenAddTransaction={() => setIsAddTxOpen(true)}
        onOpenAddExam={() => setIsAddExamOpen(true)}
        onOpenAddNote={() => setIsAddNoteOpen(true)}
        onOpenFocusModal={() => handleOpenFocus(null)}
        tasks={appData.tasks}
        exams={appData.exams}
        habits={appData.habits}
        notes={appData.notes}
        onToggleTask={handleToggleTask}
      />

      <PomodoroFocusModal
        task={focusTask}
        isOpen={isFocusModalOpen}
        onClose={() => {
          setIsFocusModalOpen(false);
          setFocusTask(null);
        }}
        onUpdateTask={handleUpdateTask}
      />

      <TaskDetailDrawer
        task={selectedDetailTask}
        isOpen={Boolean(selectedDetailTask)}
        onClose={() => setSelectedDetailTask(null)}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onStartFocus={(t) => {
          setSelectedDetailTask(null);
          handleOpenFocus(t);
        }}
      />

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

      <AuthorizedDomainModal
        isOpen={isAuthDomainModalOpen}
        onClose={() => setIsAuthDomainModalOpen(false)}
        onSignInLocal={() => handleSelectGoogleAccount('chataiwithcode@gmail.com')}
      />

      <GoogleSignInModal
        isOpen={isGoogleSignInModalOpen}
        onClose={() => setIsGoogleSignInModalOpen(false)}
        onSelectGoogleAccount={handleSelectGoogleAccount}
        onTryFirebasePopup={handleTryFirebasePopup}
        defaultEmail="chataiwithcode@gmail.com"
      />
    </div>
  );
}
