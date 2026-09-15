import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Tag,
  AlertCircle,
  Filter,
  Star,
  Play,
  Sparkles,
  LayoutList,
  Kanban,
  Grid2X2,
  CalendarDays,
  CheckCheck,
  Flame,
  Layers,
  ArrowUpDown,
  MoreVertical,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  Task,
  Subtask,
  TaskPriority,
  TaskCategory,
  TaskStatus,
} from '../../types/index.ts';
import { QuickAddBar } from '../todo/QuickAddBar.tsx';
import { TaskDetailDrawer } from '../todo/TaskDetailDrawer.tsx';
import { PomodoroFocusModal } from '../todo/PomodoroFocusModal.tsx';
import { KanbanBoardView } from '../todo/KanbanBoardView.tsx';
import { EisenhowerMatrixView } from '../todo/EisenhowerMatrixView.tsx';
import { DailyScheduleView } from '../todo/DailyScheduleView.tsx';
import { TaskTemplatesModal } from '../todo/TaskTemplatesModal.tsx';
import {
  playTaskCompleteSound,
  triggerTaskConfetti,
  triggerStreakCelebration,
} from '../../lib/todoUtils.ts';

interface TasksViewProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenAddTaskModal: () => void;
  onClearCompletedTasks: () => void;
  onAddTask?: (task: Task) => void;
  onImportTasks?: (tasks: Task[]) => void;
}

type ViewMode = 'list' | 'kanban' | 'matrix' | 'schedule';
type FilterKey = 'all' | 'today' | 'upcoming' | 'urgent' | 'starred' | 'study' | 'work' | 'finance' | 'completed';
type GroupByKey = 'date' | 'priority' | 'category' | 'none';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onOpenAddTaskModal,
  onClearCompletedTasks,
  onAddTask,
  onImportTasks,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [groupBy, setGroupBy] = useState<GroupByKey>('date');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});

  // Active Modals & Drawer State
  const [activeDetailTask, setActiveDetailTask] = useState<Task | null>(null);
  const [activeFocusTask, setActiveFocusTask] = useState<Task | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Batch Multi-Selection State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, boolean>>({});

  const todayStr = new Date().toISOString().split('T')[0];

  const handleCreateTask = (task: Task) => {
    if (onAddTask) {
      onAddTask(task);
    } else {
      onUpdateTask(task);
    }
  };

  const handleImportBatch = (newTasks: Task[]) => {
    if (onImportTasks) {
      onImportTasks(newTasks);
    } else {
      newTasks.forEach((t) => onUpdateTask(t));
    }
  };

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleToggleSubtask = (task: Task, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
    if (!task.subtasks.find((s) => s.id === subtaskId)?.completed) {
      playTaskCompleteSound();
    }
    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
      completed: allDone ? true : task.completed,
      status: allDone ? 'done' : task.status,
    });
  };

  const handleAddManualSubtask = (task: Task, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const title = (newSubtaskTitles[task.id] || '').trim();
    if (!title) return;

    const newSub: Subtask = {
      id: `manual-st-${Date.now()}`,
      title,
      completed: false,
      estimatedMinutes: 20,
    };

    onUpdateTask({
      ...task,
      subtasks: [...task.subtasks, newSub],
    });

    setNewSubtaskTitles((prev) => ({ ...prev, [task.id]: '' }));
    setExpandedTaskIds((prev) => ({ ...prev, [task.id]: true }));
  };

  const handleDeleteSubtask = (task: Task, subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTask({
      ...task,
      subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
    });
  };

  const handleToggleStar = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTask({
      ...task,
      isStarred: !task.isStarred,
    });
  };

  const handleDirectToggleTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !task.completed;
    if (nextCompleted) {
      playTaskCompleteSound();
      triggerTaskConfetti();
    }
    onUpdateTask({
      ...task,
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
      status: nextCompleted ? 'done' : 'todo',
      subtasks: nextCompleted
        ? task.subtasks.map((s) => ({ ...s, completed: true }))
        : task.subtasks,
    });
  };

  // Productivity Metrics
  const activeTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const todayDueTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === todayStr),
    [tasks, todayStr]
  );
  const todayCompleted = useMemo(
    () => todayDueTasks.filter((t) => t.completed).length,
    [todayDueTasks]
  );
  const dailyTarget = 5;
  const dailyProgressPercent = Math.min(
    100,
    Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100)
  );

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (task.tags && task.tags.some((tg) => tg.toLowerCase().includes(searchTerm.toLowerCase())));

      if (!matchesSearch) return false;

      if (activeFilter === 'today') {
        return task.dueDate === todayStr && !task.completed;
      }
      if (activeFilter === 'upcoming') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        return task.dueDate >= todayStr && task.dueDate <= nextWeekStr && !task.completed;
      }
      if (activeFilter === 'urgent') {
        return (task.priority === 'urgent' || task.priority === 'high') && !task.completed;
      }
      if (activeFilter === 'starred') {
        return task.isStarred && !task.completed;
      }
      if (activeFilter === 'study') {
        return task.category === 'study' && !task.completed;
      }
      if (activeFilter === 'work') {
        return task.category === 'work' && !task.completed;
      }
      if (activeFilter === 'finance') {
        return task.category === 'finance' && !task.completed;
      }
      if (activeFilter === 'completed') {
        return task.completed;
      }
      return !task.completed; // 'all' active
    });
  }, [tasks, searchTerm, activeFilter, todayStr]);

  // Grouping for List View
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return [{ groupName: 'All Matching Tasks', tasks: filteredTasks }];
    }

    if (groupBy === 'date') {
      const groups: Record<string, Task[]> = {
        'Overdue': [],
        'Today': [],
        'Tomorrow': [],
        'This Week': [],
        'Later / Someday': [],
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

      filteredTasks.forEach((t) => {
        if (t.completed) {
          if (!groups['Completed']) groups['Completed'] = [];
          groups['Completed'].push(t);
        } else if (t.dueDate < todayStr) {
          groups['Overdue'].push(t);
        } else if (t.dueDate === todayStr) {
          groups['Today'].push(t);
        } else if (t.dueDate === tomorrowStr) {
          groups['Tomorrow'].push(t);
        } else if (t.dueDate <= endOfWeekStr) {
          groups['This Week'].push(t);
        } else {
          groups['Later / Someday'].push(t);
        }
      });

      return Object.entries(groups)
        .filter(([_, groupList]) => groupList.length > 0)
        .map(([groupName, groupList]) => ({ groupName, tasks: groupList }));
    }

    if (groupBy === 'priority') {
      const order: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
      const labels: Record<TaskPriority, string> = {
        urgent: '🔴 Urgent Priority (P1)',
        high: '🟠 High Priority (P2)',
        medium: '🔵 Medium Priority (P3)',
        low: '⚪ Low Priority (P4)',
      };

      return order
        .map((p) => ({
          groupName: labels[p],
          tasks: filteredTasks.filter((t) => t.priority === p),
        }))
        .filter((g) => g.tasks.length > 0);
    }

    if (groupBy === 'category') {
      const cats: TaskCategory[] = ['study', 'work', 'project', 'finance', 'personal', 'health', 'other'];
      return cats
        .map((c) => ({
          groupName: c.toUpperCase(),
          tasks: filteredTasks.filter((t) => t.category === c),
        }))
        .filter((g) => g.tasks.length > 0);
    }

    return [{ groupName: 'Tasks', tasks: filteredTasks }];
  }, [filteredTasks, groupBy, todayStr]);

  // Batch Selection Handlers
  const toggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleSelectAllFiltered = () => {
    const next: Record<string, boolean> = {};
    filteredTasks.forEach((t) => {
      next[t.id] = true;
    });
    setSelectedTaskIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds({});
  };

  const selectedCount = Object.values(selectedTaskIds).filter(Boolean).length;

  const handleBatchMarkComplete = () => {
    const selectedIds = Object.keys(selectedTaskIds).filter((id) => selectedTaskIds[id]);
    if (selectedIds.length === 0) return;
    playTaskCompleteSound();
    triggerTaskConfetti();

    selectedIds.forEach((id) => {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        onUpdateTask({
          ...task,
          completed: true,
          completedAt: Date.now(),
          status: 'done',
        });
      }
    });
    handleDeselectAll();
    setIsBatchMode(false);
  };

  const handleBatchRescheduleToday = () => {
    const selectedIds = Object.keys(selectedTaskIds).filter((id) => selectedTaskIds[id]);
    selectedIds.forEach((id) => {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        onUpdateTask({
          ...task,
          dueDate: todayStr,
        });
      }
    });
    handleDeselectAll();
    setIsBatchMode(false);
  };

  const handleBatchDelete = () => {
    const selectedIds = Object.keys(selectedTaskIds).filter((id) => selectedTaskIds[id]);
    selectedIds.forEach((id) => onDeleteTask(id));
    handleDeselectAll();
    setIsBatchMode(false);
  };

  return (
    <div id="tasks-master-view-container" className="space-y-5 pb-16">
      {/* 1. PRODUCTIVITY COMMAND BANNER */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Tasks & Todo Workspace
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
              {activeTasks.length} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl">
            Streamline your daily workflows, time-block study milestones, and break big goals down with AI assistance.
          </p>
        </div>

        {/* Daily Velocity & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Goal Badge */}
          <div className="bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/80 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Flame className="w-4 h-4 fill-amber-500" />
              <span className="text-xs font-black text-slate-900">
                {completedTasks.length}/{tasks.length} Done
              </span>
            </div>
            <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${dailyProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Templates Trigger */}
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Import task templates"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Templates</span>
          </button>

          {/* Clear Completed */}
          {completedTasks.length > 0 && (
            <button
              id="tasks-clear-completed-btn"
              onClick={onClearCompletedTasks}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Clear Done ({completedTasks.length})
            </button>
          )}

          {/* New Task Advanced Modal */}
          <button
            id="tasks-add-task-btn"
            onClick={onOpenAddTaskModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* 2. NATURAL LANGUAGE QUICK ADD BAR */}
      <QuickAddBar onAddTask={handleCreateTask} onOpenAdvancedModal={onOpenAddTaskModal} />

      {/* 3. VIEW MODE & FILTER TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Layout View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { mode: 'list', label: 'List', icon: LayoutList },
            { mode: 'kanban', label: 'Kanban', icon: Kanban },
            { mode: 'matrix', label: 'Matrix', icon: Grid2X2 },
            { mode: 'schedule', label: 'Schedule', icon: CalendarDays },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode as ViewMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === v.mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side: Group By, Batch Select, Search */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'list' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Group:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-hidden"
              >
                <option value="date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="category">Category</option>
                <option value="none">No Grouping</option>
              </select>
            </div>
          )}

          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              if (isBatchMode) handleDeselectAll();
            }}
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition cursor-pointer ${
              isBatchMode
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isBatchMode ? 'Cancel Batch' : 'Batch Select'}
          </button>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs Strip (for list and overview) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: `Active (${activeTasks.length})` },
          { key: 'today', label: `Due Today (${todayDueTasks.filter((t) => !t.completed).length})` },
          { key: 'upcoming', label: 'Next 7 Days' },
          { key: 'urgent', label: '🔴 Urgent / High' },
          { key: 'starred', label: '⭐ Starred' },
          { key: 'study', label: 'Study' },
          { key: 'work', label: 'Work' },
          { key: 'finance', label: 'Finance' },
          { key: 'completed', label: `Completed (${completedTasks.length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key as FilterKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeFilter === f.key
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* BATCH ACTION BAR (if batch mode active) */}
      {isBatchMode && (
        <div className="bg-indigo-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold bg-indigo-800 px-2.5 py-1 rounded-lg">
              {selectedCount} Selected
            </span>
            <button
              onClick={handleSelectAllFiltered}
              className="text-indigo-200 hover:text-white underline cursor-pointer"
            >
              Select All ({filteredTasks.length})
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-indigo-200 hover:text-white underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleBatchMarkComplete}
              disabled={selectedCount === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </button>

            <button
              onClick={handleBatchRescheduleToday}
              disabled={selectedCount === 0}
              className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Move to Today</span>
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={selectedCount === 0}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. VIEW CONTENT (Switch between List, Kanban, Matrix, Schedule) */}

      {/* A. KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <KanbanBoardView
          tasks={filteredTasks}
          onUpdateTask={onUpdateTask}
          onSelectTask={(task) => setActiveDetailTask(task)}
          onOpenQuickAddWithStatus={(status) => {
            const newTask: Task = {
              id: `task-${Date.now()}`,
              title: 'New Kanban Item',
              category: 'study',
              priority: 'medium',
              dueDate: todayStr,
              completed: status === 'done',
              status,
              subtasks: [],
              createdAt: Date.now(),
            };
            onUpdateTask(newTask);
            setActiveDetailTask(newTask);
          }}
          onStartFocus={(task) => setActiveFocusTask(task)}
        />
      )}

      {/* B. EISENHOWER MATRIX VIEW */}
      {viewMode === 'matrix' && (
        <EisenhowerMatrixView
          tasks={tasks}
          onUpdateTask={onUpdateTask}
          onSelectTask={(task) => setActiveDetailTask(task)}
          onOpenQuickAddWithPriority={(priority) => {
            const newTask: Task = {
              id: `task-${Date.now()}`,
              title: `New P${priority === 'urgent' ? 1 : priority === 'high' ? 2 : 3} Target`,
              category: 'study',
              priority,
              dueDate: todayStr,
              completed: false,
              status: 'todo',
              subtasks: [],
              createdAt: Date.now(),
            };
            onUpdateTask(newTask);
            setActiveDetailTask(newTask);
          }}
        />
      )}

      {/* C. DAILY SCHEDULE VIEW */}
      {viewMode === 'schedule' && (
        <DailyScheduleView
          tasks={tasks}
          onUpdateTask={onUpdateTask}
          onSelectTask={(task) => setActiveDetailTask(task)}
          onStartFocus={(task) => setActiveFocusTask(task)}
        />
      )}

      {/* D. LIST VIEW (Default High-Density Interactive List) */}
      {viewMode === 'list' && (
        <div>
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No tasks match your filters</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeFilter === 'completed'
                  ? 'No completed tasks yet. Finish a task or checklist step to see it recorded here!'
                  : 'Start typing in the quick capture bar above to add a new task, or explore templates.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsTemplatesModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
                >
                  Browse Templates
                </button>
                <button
                  onClick={onOpenAddTaskModal}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Create Custom Task
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedTasks.map((group) => (
                <div key={group.groupName} className="space-y-2.5">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {group.groupName}
                    </h2>
                    <span className="text-[11px] font-bold text-slate-400">
                      {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  {/* Tasks in Group */}
                  <div className="space-y-2.5">
                    {group.tasks.map((task) => {
                      const isExpanded = !!expandedTaskIds[task.id];
                      const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
                      const subtaskProgress =
                        task.subtasks.length > 0
                          ? Math.round((completedSubtasks / task.subtasks.length) * 100)
                          : 0;
                      const isOverdue = !task.completed && task.dueDate < todayStr;
                      const isDueToday = !task.completed && task.dueDate === todayStr;
                      const isSelected = !!selectedTaskIds[task.id];

                      return (
                        <div
                          key={task.id}
                          id={`task-card-${task.id}`}
                          onClick={() => {
                            if (isBatchMode) {
                              setSelectedTaskIds((prev) => ({
                                ...prev,
                                [task.id]: !prev[task.id],
                              }));
                            } else {
                              setActiveDetailTask(task);
                            }
                          }}
                          className={`bg-white rounded-2xl border transition-all duration-150 cursor-pointer ${
                            task.completed
                              ? 'border-slate-200/80 bg-slate-50/40 opacity-75'
                              : isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-500/10 shadow-xs'
                              : isOverdue
                              ? 'border-rose-300 shadow-2xs hover:border-rose-400'
                              : task.priority === 'urgent'
                              ? 'border-slate-200 border-l-4 border-l-rose-500 hover:border-slate-300 shadow-2xs'
                              : task.priority === 'high'
                              ? 'border-slate-200 border-l-4 border-l-amber-500 hover:border-slate-300 shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div className="p-4 sm:p-4.5 flex items-start gap-3.5">
                            {/* Selection or Checkbox */}
                            {isBatchMode ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => toggleSelectTask(task.id, e as any)}
                                className="mt-1 w-4 h-4 rounded text-indigo-600 cursor-pointer"
                              />
                            ) : (
                              <button
                                onClick={(e) => handleDirectToggleTask(task, e)}
                                className="mt-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer shrink-0"
                                title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                            )}

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`text-sm font-bold text-slate-900 ${
                                    task.completed ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {task.title}
                                </span>

                                {/* Priority Badge */}
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    task.priority === 'urgent'
                                      ? 'bg-rose-100 text-rose-700'
                                      : task.priority === 'high'
                                      ? 'bg-amber-100 text-amber-800'
                                      : task.priority === 'medium'
                                      ? 'bg-indigo-50 text-indigo-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {task.priority}
                                </span>

                                {/* Category */}
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">
                                  {task.category}
                                </span>

                                {/* Status */}
                                {task.status && task.status !== 'todo' && task.status !== 'done' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 uppercase">
                                    {task.status.replace('_', ' ')}
                                  </span>
                                )}

                                {/* Overdue / Due Today Warnings */}
                                {isOverdue && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                                    Overdue
                                  </span>
                                )}
                                {isDueToday && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                    Today
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <p className="text-xs text-slate-500 mb-2 leading-relaxed line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Metadata Strip */}
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1 font-medium text-slate-600">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{task.dueDate}</span>
                                  {task.dueTime && <span>@{task.dueTime}</span>}
                                </span>

                                {task.estimatedMinutes && (
                                  <span className="flex items-center gap-1 font-mono text-slate-500">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>~{task.estimatedMinutes}m</span>
                                  </span>
                                )}

                                {(task.tags || []).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold"
                                  >
                                    #{t}
                                  </span>
                                ))}

                                {task.subtasks.length > 0 && (
                                  <span className="font-medium text-slate-600">
                                    {completedSubtasks}/{task.subtasks.length} steps ({subtaskProgress}%)
                                  </span>
                                )}
                              </div>

                              {/* Subtask Progress Bar */}
                              {task.subtasks.length > 0 && (
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2 max-w-md">
                                  <div
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${subtaskProgress}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Actions Right Side */}
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Star Pin */}
                              <button
                                onClick={(e) => handleToggleStar(task, e)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  task.isStarred
                                    ? 'text-amber-500 hover:text-amber-600'
                                    : 'text-slate-300 hover:text-amber-500'
                                }`}
                                title={task.isStarred ? 'Unpin task' : 'Star / Pin task'}
                              >
                                <Star className={`w-4 h-4 ${task.isStarred ? 'fill-amber-400' : ''}`} />
                              </button>

                              {/* Start Focus Button */}
                              {!task.completed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFocusTask(task);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                  title="Launch Pomodoro focus timer"
                                >
                                  <Play className="w-3 h-3 fill-indigo-700" />
                                  <span className="hidden sm:inline">Focus</span>
                                </button>
                              )}

                              {/* Expand Subtasks Accordion */}
                              {task.subtasks.length > 0 && (
                                <button
                                  onClick={(e) => toggleExpand(task.id, e)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title={isExpanded ? 'Hide steps' : 'View steps'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTask(task.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Subtasks Checklist Section */}
                          {isExpanded && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="border-t border-slate-150 bg-slate-50/60 p-4 sm:p-5 rounded-b-2xl space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Subtasks ({completedSubtasks}/{task.subtasks.length})
                                </h3>
                                <span className="text-xs text-slate-400 font-mono">
                                  {task.subtasks.reduce(
                                    (sum, s) => sum + (s.estimatedMinutes || 20),
                                    0
                                  )}{' '}
                                  mins total estimate
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {task.subtasks.map((subtask) => (
                                  <div
                                    key={subtask.id}
                                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs hover:border-slate-300 transition"
                                  >
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                      <button
                                        onClick={(e) => handleToggleSubtask(task, subtask.id, e)}
                                        className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                                      >
                                        {subtask.completed ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                                        ) : (
                                          <Circle className="w-4 h-4" />
                                        )}
                                      </button>
                                      <span
                                        className={`truncate font-medium text-slate-800 ${
                                          subtask.completed ? 'line-through text-slate-400' : ''
                                        }`}
                                      >
                                        {subtask.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {subtask.estimatedMinutes && (
                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                          ~{subtask.estimatedMinutes}m
                                        </span>
                                      )}
                                      <button
                                        onClick={(e) => handleDeleteSubtask(task, subtask.id, e)}
                                        className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                                        title="Remove subtask"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Add Step Input */}
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  placeholder="Add another step..."
                                  value={newSubtaskTitles[task.id] || ''}
                                  onChange={(e) =>
                                    setNewSubtaskTitles((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddManualSubtask(task, e);
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={(e) => handleAddManualSubtask(task, e)}
                                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TASK DETAIL DRAWER */}
      <TaskDetailDrawer
        task={activeDetailTask}
        isOpen={!!activeDetailTask}
        onClose={() => setActiveDetailTask(null)}
        onUpdateTask={(updated) => {
          onUpdateTask(updated);
          setActiveDetailTask(updated);
        }}
        onDeleteTask={(taskId) => {
          onDeleteTask(taskId);
          setActiveDetailTask(null);
        }}
        onStartFocus={(task) => {
          setActiveDetailTask(null);
          setActiveFocusTask(task);
        }}
      />

      {/* 6. POMODORO FOCUS MODAL */}
      <PomodoroFocusModal
        task={activeFocusTask}
        isOpen={!!activeFocusTask}
        onClose={() => setActiveFocusTask(null)}
        onUpdateTask={onUpdateTask}
      />

      {/* 7. TASK TEMPLATES MODAL */}
      <TaskTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onImportTasks={handleImportBatch}
      />
    </div>
  );
};
