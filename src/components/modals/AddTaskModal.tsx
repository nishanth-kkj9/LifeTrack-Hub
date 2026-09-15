import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Tag,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  RotateCcw,
} from 'lucide-react';
import {
  Task,
  TaskPriority,
  TaskCategory,
  TaskRecurrence,
  Subtask,
} from '../../types/index.ts';
import { generateTaskSubtasks } from '../../lib/apiClient.ts';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Task) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [dueTime, setDueTime] = useState('18:00');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [recurring, setRecurring] = useState<TaskRecurrence>('none');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; estimatedMinutes?: number }>>([]);
  const [isAiBreakingDown, setIsAiBreakingDown] = useState(false);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `st-${Date.now()}-${prev.length}`, title: subtaskInput.trim(), estimatedMinutes: 20 },
    ]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddTag = () => {
    const clean = tagInput.replace(/^#/, '').trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAiBreakdown = async () => {
    if (!title.trim()) return;
    try {
      setIsAiBreakingDown(true);
      const generated = await generateTaskSubtasks(title, description, category);
      if (generated && generated.length > 0) {
        setSubtasks((prev) => [
          ...prev,
          ...generated.map((g, idx) => ({
            id: `ai-st-${Date.now()}-${idx}`,
            title: g.title,
            estimatedMinutes: g.estimatedMinutes || 20,
          })),
        ]);
      }
    } catch (err) {
      console.error('AI breakdown error:', err);
    } finally {
      setIsAiBreakingDown(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      completed: false,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      actualMinutes: 0,
      tags: tags.length > 0 ? tags : undefined,
      recurring: recurring !== 'none' ? recurring : undefined,
      status: 'todo',
      subtasks: subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        completed: false,
        estimatedMinutes: s.estimatedMinutes || 20,
      })),
      createdAt: Date.now(),
    };

    onAddTask(newTask);
    onClose();
    // reset form
    setTitle('');
    setDescription('');
    setTags([]);
    setSubtasks([]);
  };

  return (
    <div
      id="add-task-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="add-task-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900">Create New Task</h2>
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
              Productivity
            </span>
          </div>
          <button
            id="close-add-task-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="task-title-input" className="block text-xs font-bold text-slate-700 mb-1">
              Task Title *
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              placeholder="e.g. Complete Calculus Problem Set 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-desc-input" className="block text-xs font-bold text-slate-700 mb-1">
              Details / Notes (Optional)
            </label>
            <textarea
              id="task-desc-input"
              rows={2}
              placeholder="Key instructions, formulas, reference links, or criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
            />
          </div>

          {/* Priority and Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority-select" className="block text-xs font-bold text-slate-700 mb-1">
                Priority
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="urgent">🔴 Urgent (P1)</option>
                <option value="high">🟠 High (P2)</option>
                <option value="medium">🟡 Medium (P3)</option>
                <option value="low">🟢 Low (P4)</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-category-select" className="block text-xs font-bold text-slate-700 mb-1">
                Category
              </label>
              <select
                id="task-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
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
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-date-input" className="block text-xs font-bold text-slate-700 mb-1">
                Due Date
              </label>
              <input
                id="task-date-input"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="task-time-input" className="block text-xs font-bold text-slate-700 mb-1">
                Due Time (Optional)
              </label>
              <input
                id="task-time-input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Estimate & Recurrence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimated Duration (mins)
              </label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recurrence Rule
              </label>
              <select
                value={recurring}
                onChange={(e) => setRecurring(e.target.value as TaskRecurrence)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every Day</option>
                <option value="weekdays">Every Weekday</option>
                <option value="weekly">Every Week</option>
                <option value="monthly">Every Month</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tg) => (
                <span
                  key={tg}
                  className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-1"
                >
                  #{tg}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tg)}
                    className="hover:text-indigo-900 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tag (e.g. #exam, #prep)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl cursor-pointer"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Subtasks with AI Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Subtask Steps (Optional)</label>
              {title.trim() && (
                <button
                  type="button"
                  onClick={handleAiBreakdown}
                  disabled={isAiBreakingDown}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isAiBreakingDown ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                  )}
                  <span>AI Breakdown</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                id="task-subtask-quick-input"
                type="text"
                placeholder="Add step..."
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl cursor-pointer"
              >
                Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200"
                  >
                    <span className="truncate text-slate-700 font-medium">{st.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-task-btn"
              className="px-5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
