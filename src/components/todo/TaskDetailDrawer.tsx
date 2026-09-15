import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  Trash2,
  Copy,
  Sparkles,
  Play,
  RotateCcw,
  Check,
  Plus,
  Star,
  Layers,
  ChevronDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  Task,
  TaskPriority,
  TaskCategory,
  TaskStatus,
  TaskRecurrence,
  Subtask,
} from '../../types/index.ts';
import { generateTaskSubtasks } from '../../lib/apiClient.ts';
import { playTaskCompleteSound, triggerTaskConfetti } from '../../lib/todoUtils.ts';

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onStartFocus,
}) => {
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedCategory, setEditedCategory] = useState<TaskCategory>('study');
  const [editedPriority, setEditedPriority] = useState<TaskPriority>('medium');
  const [editedStatus, setEditedStatus] = useState<TaskStatus>('todo');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [editedDueTime, setEditedDueTime] = useState('');
  const [editedRecurring, setEditedRecurring] = useState<TaskRecurrence>('none');
  const [editedEstimatedMinutes, setEditedEstimatedMinutes] = useState(25);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskEst, setNewSubtaskEst] = useState(20);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAiBreakingDown, setIsAiBreakingDown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync state when active task changes
  useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
      setEditedDescription(task.description || '');
      setEditedNotes(task.notes || '');
      setEditedCategory(task.category || 'study');
      setEditedPriority(task.priority || 'medium');
      setEditedStatus(task.status || (task.completed ? 'done' : 'todo'));
      setEditedDueDate(task.dueDate || new Date().toISOString().split('T')[0]);
      setEditedDueTime(task.dueTime || '');
      setEditedRecurring(task.recurring || 'none');
      setEditedEstimatedMinutes(task.estimatedMinutes || 25);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleFieldChange = (updates: Partial<Task>) => {
    const updated = { ...task, ...updates };
    onUpdateTask(updated);
  };

  const handleToggleComplete = () => {
    const nextCompleted = !task.completed;
    if (nextCompleted) {
      playTaskCompleteSound();
      triggerTaskConfetti();
    }
    const updated: Task = {
      ...task,
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
      status: nextCompleted ? 'done' : 'todo',
      subtasks: nextCompleted
        ? task.subtasks.map((s) => ({ ...s, completed: true }))
        : task.subtasks,
    };
    onUpdateTask(updated);
  };

  const handleToggleStar = () => {
    handleFieldChange({ isStarred: !task.isStarred });
  };

  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSub: Subtask = {
      id: `st-${Date.now()}-${task.subtasks.length}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      estimatedMinutes: Number(newSubtaskEst) || 20,
    };

    handleFieldChange({
      subtasks: [...task.subtasks, newSub],
    });
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
    handleFieldChange({
      subtasks: updatedSubtasks,
      completed: allDone ? true : task.completed,
      status: allDone ? 'done' : task.status,
    });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    handleFieldChange({
      subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
    });
  };

  const handleAiBreakdown = async () => {
    try {
      setIsAiBreakingDown(true);
      const generated = await generateTaskSubtasks(task.title, task.description, task.category);
      if (generated && generated.length > 0) {
        const newSubs: Subtask[] = generated.map((g, idx) => ({
          id: `ai-st-${Date.now()}-${idx}`,
          title: g.title,
          completed: false,
          estimatedMinutes: g.estimatedMinutes || 20,
        }));
        handleFieldChange({
          subtasks: [...task.subtasks, ...newSubs],
        });
      }
    } catch (err) {
      console.error('AI breakdown error:', err);
    } finally {
      setIsAiBreakingDown(false);
    }
  };

  const handleAddTag = () => {
    const clean = newTagInput.replace(/^#/, '').trim().toLowerCase();
    if (!clean) return;
    const currentTags = task.tags || [];
    if (!currentTags.includes(clean)) {
      handleFieldChange({ tags: [...currentTags, clean] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleFieldChange({
      tags: (task.tags || []).filter((t) => t !== tagToRemove),
    });
  };

  const handleDuplicate = () => {
    const duplicated: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `${task.title} (Copy)`,
      completed: false,
      status: 'todo',
      createdAt: Date.now(),
      subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
    };
    onUpdateTask(duplicated);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const subtaskProgress =
    task.subtasks.length > 0 ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleComplete}
              className={`p-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                task.completed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {task.completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                  <span>Completed</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-slate-400" />
                  <span>Mark Done</span>
                </>
              )}
            </button>

            <button
              onClick={handleToggleStar}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                task.isStarred
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-amber-500'
              }`}
              title={task.isStarred ? 'Unstar task' : 'Star / Pin task'}
            >
              <Star className={`w-4 h-4 ${task.isStarred ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => onStartFocus(task)}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Start Focus</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleDuplicate}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Duplicate task"
            >
              {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                onDeleteTask(task.id);
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Title Editor */}
          <div>
            <textarea
              rows={2}
              value={editedTitle}
              onChange={(e) => {
                setEditedTitle(e.target.value);
                handleFieldChange({ title: e.target.value });
              }}
              placeholder="Task Title..."
              className={`w-full font-black text-lg sm:text-xl text-slate-900 border-none bg-transparent focus:outline-hidden resize-none ${
                task.completed ? 'line-through text-slate-400' : ''
              }`}
            />
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Status
              </label>
              <select
                value={task.status || (task.completed ? 'done' : 'todo')}
                onChange={(e) => {
                  const s = e.target.value as TaskStatus;
                  setEditedStatus(s);
                  handleFieldChange({
                    status: s,
                    completed: s === 'done',
                    completedAt: s === 'done' ? Date.now() : undefined,
                  });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                <option value="todo">📋 To Do</option>
                <option value="in_progress">⚡ In Progress</option>
                <option value="in_review">🔍 In Review</option>
                <option value="done">✅ Done</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => {
                  const p = e.target.value as TaskPriority;
                  setEditedPriority(p);
                  handleFieldChange({ priority: p });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden capitalize"
              >
                <option value="urgent">🔴 Urgent (P1)</option>
                <option value="high">🟠 High (P2)</option>
                <option value="medium">🔵 Medium (P3)</option>
                <option value="low">⚪ Low (P4)</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={task.dueDate}
                onChange={(e) => {
                  setEditedDueDate(e.target.value);
                  handleFieldChange({ dueDate: e.target.value });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            {/* Due Time */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Due Time
              </label>
              <input
                type="time"
                value={task.dueTime || ''}
                onChange={(e) => {
                  setEditedDueTime(e.target.value);
                  handleFieldChange({ dueTime: e.target.value || undefined });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Category / Project
              </label>
              <select
                value={task.category}
                onChange={(e) => {
                  const c = e.target.value as TaskCategory;
                  setEditedCategory(c);
                  handleFieldChange({ category: c });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden capitalize"
              >
                <option value="study">Study</option>
                <option value="work">Work</option>
                <option value="finance">Finance</option>
                <option value="personal">Personal</option>
                <option value="health">Health</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Recurrence */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Repeat Rule
              </label>
              <select
                value={task.recurring || 'none'}
                onChange={(e) => {
                  const r = e.target.value as TaskRecurrence;
                  setEditedRecurring(r);
                  handleFieldChange({ recurring: r !== 'none' ? r : undefined });
                }}
                className="w-full bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden capitalize"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every Day</option>
                <option value="weekdays">Every Weekday (Mon-Fri)</option>
                <option value="weekly">Every Week</option>
                <option value="monthly">Every Month</option>
              </select>
            </div>
          </div>

          {/* Description & Rich Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Notes & Reference Details
            </label>
            <textarea
              rows={4}
              value={editedDescription}
              onChange={(e) => {
                setEditedDescription(e.target.value);
                handleFieldChange({ description: e.target.value });
              }}
              placeholder="Add key criteria, formulas, meeting links, or reference material..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-none text-slate-800"
            />
          </div>

          {/* Subtasks / Checklist Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Subtask Checklist ({completedSubtasks}/{task.subtasks.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  {task.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 20), 0)} mins total estimate
                </p>
              </div>

              {/* AI Breakdown Button */}
              <button
                onClick={handleAiBreakdown}
                disabled={isAiBreakingDown}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAiBreakingDown ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>AI Breakdown</span>
              </button>
            </div>

            {/* Progress Bar */}
            {task.subtasks.length > 0 && (
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            )}

            {/* Subtask Items */}
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleSubtask(subtask.id)}
                      className="text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
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
                      <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                        ~{subtask.estimatedMinutes}m
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Subtask Input */}
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Add subtask step..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="number"
                value={newSubtaskEst}
                onChange={(e) => setNewSubtaskEst(Number(e.target.value))}
                className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-center font-mono focus:outline-hidden"
                placeholder="20m"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Tags & Labels</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-indigo-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  placeholder="+ Add tag (e.g. #exam)"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-100 rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white focus:outline-hidden w-28"
                />
              </div>
            </div>
          </div>

          {/* Time Tracking & Focus Stats */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-white p-4 rounded-2xl border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">
                Deep Work Logged
              </span>
              <span className="font-mono font-black text-sm text-slate-900">
                {task.actualMinutes || 0} mins focus logged
              </span>
            </div>
            <button
              onClick={() => onStartFocus(task)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Pomodoro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
