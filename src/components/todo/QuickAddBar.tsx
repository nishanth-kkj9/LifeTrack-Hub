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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setInputValue('');
      setParsedPreview(null);
      inputRef.current?.blur();
    }
  };

  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'high':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'medium':
        return 'text-slate-700 bg-slate-50 border-slate-200';
      case 'low':
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="relative w-full">
      <form
        onSubmit={handleCreateTask}
        className={`relative bg-white rounded-xl border transition-all duration-200 shadow-2xs ${
          isFocused
            ? 'border-slate-800 ring-2 ring-slate-800/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center px-3.5 py-2.5 gap-2.5 min-h-[48px]">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 shrink-0">
            {flashCreated ? (
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-slate-600" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            aria-label="Quick add task input"
            placeholder="Quick capture: e.g. Finish Module 2 syllabus tomorrow 5pm #study p1 ~45m"
            className="flex-1 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium min-w-0"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {inputValue.trim() ? (
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs min-h-[36px]"
              >
                <span>Add</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                <kbd className="font-mono font-semibold">Q</kbd>
                <span>quick add</span>
              </div>
            )}
          </div>
        </div>

        {/* Live NLP Parsed Token Preview Strip */}
        {parsedPreview && inputValue.trim() && (
          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-slate-600" />
                <span>Detected:</span>
              </span>

              {/* Title Cleaned */}
              <span className="font-semibold text-slate-900 max-w-[200px] truncate">
                "{parsedPreview.title || inputValue.trim()}"
              </span>

              {/* Due Date */}
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{parsedPreview.dueDate}</span>
                {parsedPreview.dueTime && <span>@{parsedPreview.dueTime}</span>}
              </span>

              {/* Priority */}
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadgeClass(
                  parsedPreview.priority
                )}`}
              >
                <AlertCircle className="w-3 h-3" />
                <span>{parsedPreview.priority}</span>
              </span>

              {/* Category */}
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 capitalize">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>{parsedPreview.category}</span>
              </span>

              {/* Duration Estimate */}
              {parsedPreview.estimatedMinutes && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{parsedPreview.estimatedMinutes}m</span>
                </span>
              )}

              {/* Tags */}
              {parsedPreview.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-slate-500 text-[11px] font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 hidden md:inline">
              Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">Enter ↵</kbd>
            </span>
          </div>
        )}
      </form>
    </div>
  );
};
