import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Sparkles,
  Calendar,
  Clock,
  Tag,
  AlertCircle,
  ArrowRight,
  Zap,
  Check,
} from 'lucide-react';
import { Task, TaskPriority, TaskCategory } from '../../types/index.ts';
import { parseNaturalLanguageTask, ParsedTaskInput } from '../../lib/todoUtils.ts';

interface QuickAddBarProps {
  onAddTask: (task: Task) => void;
  onOpenAdvancedModal?: () => void;
  defaultCategory?: TaskCategory;
}

export const QuickAddBar: React.FC<QuickAddBarProps> = ({
  onAddTask,
  onOpenAdvancedModal,
  defaultCategory = 'study',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ParsedTaskInput | null>(null);
  const [flashCreated, setFlashCreated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse natural language as user types
  useEffect(() => {
    if (!inputValue.trim()) {
      setParsedPreview(null);
      return;
    }
    const parsed = parseNaturalLanguageTask(inputValue);
    setParsedPreview(parsed);
  }, [inputValue]);

  // Global keyboard shortcut: Press 'Q' when not in an input to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'q' || e.key === 'Q') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const parsed = parsedPreview || parseNaturalLanguageTask(inputValue);

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: parsed.title || inputValue.trim(),
      category: parsed.category || defaultCategory,
      priority: parsed.priority || 'medium',
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      completed: false,
      subtasks: [],
      tags: parsed.tags.length > 0 ? parsed.tags : undefined,
      estimatedMinutes: parsed.estimatedMinutes || 25,
      actualMinutes: 0,
      isStarred: false,
      recurring: parsed.recurring !== 'none' ? parsed.recurring : undefined,
      status: 'todo',
      createdAt: Date.now(),
    };

    onAddTask(newTask);
    setInputValue('');
    setParsedPreview(null);
    setFlashCreated(true);
    setTimeout(() => setFlashCreated(false), 2000);
  };

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'low':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="relative w-full">
      <form
        onSubmit={handleCreateTask}
        className={`relative bg-white rounded-2xl border transition-all duration-200 shadow-xs ${
          isFocused
            ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-md'
            : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center px-4 py-3 gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            {flashCreated ? (
              <Check className="w-4 h-4 text-emerald-600 animate-bounce" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Quick capture: e.g. Finish Calculus set tomorrow 5pm #study p1 ~45m (Press 'Q')"
            className="flex-1 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-hidden font-medium"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {inputValue.trim() ? (
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>Add Task</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                <kbd className="font-mono font-bold">Q</kbd>
                <span>quick add</span>
              </div>
            )}
          </div>
        </div>

        {/* Live NLP Parsed Token Preview Strip */}
        {parsedPreview && inputValue.trim() && (
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Detected:</span>
              </span>

              {/* Title Cleaned */}
              <span className="font-bold text-slate-900 max-w-[200px] truncate bg-white px-2 py-0.5 rounded-md border border-slate-200">
                "{parsedPreview.title || inputValue.trim()}"
              </span>

              {/* Due Date */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>{parsedPreview.dueDate}</span>
                {parsedPreview.dueTime && <span>@{parsedPreview.dueTime}</span>}
              </span>

              {/* Priority */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase border ${getPriorityBadgeClass(
                  parsedPreview.priority
                )}`}
              >
                <AlertCircle className="w-3 h-3" />
                <span>{parsedPreview.priority}</span>
              </span>

              {/* Category */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium capitalize">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>{parsedPreview.category}</span>
              </span>

              {/* Duration Estimate */}
              {parsedPreview.estimatedMinutes && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[11px] font-mono font-medium">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>~{parsedPreview.estimatedMinutes}m</span>
                </span>
              )}

              {/* Tags */}
              {parsedPreview.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]"
                >
                  #{tag}
                </span>
              ))}

              {/* Recurrence */}
              {parsedPreview.recurring !== 'none' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[10px] capitalize">
                  ↻ {parsedPreview.recurring}
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-400 hidden md:inline">
              Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">Enter ↵</kbd> to save
            </span>
          </div>
        )}
      </form>
    </div>
  );
};
