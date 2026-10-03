import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckSquare,
  Calendar,
  GraduationCap,
  Wallet,
  Flame,
  FileText,
  Sparkles,
  Plus,
  Play,
  X,
  ArrowRight,
} from 'lucide-react';
import { Task, ExamReminder, Habit, QuickNote } from '../../types/index.ts';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
  onOpenAddTask: () => void;
  onOpenAddTransaction: () => void;
  onOpenAddExam: () => void;
  onOpenAddNote: () => void;
  tasks: Task[];
  exams: ExamReminder[];
  habits: Habit[];
  notes: QuickNote[];
  onToggleTask?: (taskId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenAddTask,
  onOpenAddTransaction,
  onOpenAddExam,
  onOpenAddNote,
  tasks,
  exams,
  habits,
  notes,
  onToggleTask,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Search items and actions
  const trimmed = query.trim().toLowerCase();

  const standardActions = [
    {
      id: 'act-add-task',
      title: 'Create new task',
      category: 'Actions',
      icon: Plus,
      action: () => {
        onClose();
        onOpenAddTask();
      },
    },
    {
      id: 'act-add-tx',
      title: 'Log financial transaction',
      category: 'Actions',
      icon: Wallet,
      action: () => {
        onClose();
        onOpenAddTransaction();
      },
    },
    {
      id: 'act-add-exam',
      title: 'Add exam reminder',
      category: 'Actions',
      icon: GraduationCap,
      action: () => {
        onClose();
        onOpenAddExam();
      },
    },
    {
      id: 'act-add-note',
      title: 'Write quick note',
      category: 'Actions',
      icon: FileText,
      action: () => {
        onClose();
        onOpenAddNote();
      },
    },
    {
      id: 'nav-today',
      title: 'Open Today workspace',
      category: 'Navigation',
      icon: Calendar,
      action: () => {
        onClose();
        onNavigate('today');
      },
    },
    {
      id: 'nav-tasks',
      title: 'Open Tasks workspace',
      category: 'Navigation',
      icon: CheckSquare,
      action: () => {
        onClose();
        onNavigate('tasks');
      },
    },
    {
      id: 'nav-calendar',
      title: 'Open Calendar schedule',
      category: 'Navigation',
      icon: Calendar,
      action: () => {
        onClose();
        onNavigate('calendar');
      },
    },
    {
      id: 'nav-academics',
      title: 'Open Academics & VTU Hub',
      category: 'Navigation',
      icon: GraduationCap,
      action: () => {
        onClose();
        onNavigate('academics');
      },
    },
    {
      id: 'nav-finances',
      title: 'Open Finances & Ledger',
      category: 'Navigation',
      icon: Wallet,
      action: () => {
        onClose();
        onNavigate('finances');
      },
    },
    {
      id: 'nav-habits',
      title: 'Open Habits & Streaks',
      category: 'Navigation',
      icon: Flame,
      action: () => {
        onClose();
        onNavigate('habits');
      },
    },
    {
      id: 'nav-notes',
      title: 'Open Notes & Scratchpad',
      category: 'Navigation',
      icon: FileText,
      action: () => {
        onClose();
        onNavigate('notes');
      },
    },
  ];

  // Search filtered tasks
  const matchedTasks = tasks
    .filter((t) => t.title.toLowerCase().includes(trimmed))
    .slice(0, 4)
    .map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      category: 'Tasks',
      subtitle: `${t.dueDate} · ${t.priority} priority`,
      icon: CheckSquare,
      action: () => {
        onClose();
        onNavigate('tasks');
      },
    }));

  // Search filtered exams
  const matchedExams = exams
    .filter((e) => e.subject.toLowerCase().includes(trimmed) || e.courseCode?.toLowerCase().includes(trimmed))
    .slice(0, 3)
    .map((e) => ({
      id: `exam-${e.id}`,
      title: `${e.courseCode ? e.courseCode + ' - ' : ''}${e.subject}`,
      category: 'Exams',
      subtitle: `Exam on ${e.examDate} @ ${e.examTime}`,
      icon: GraduationCap,
      action: () => {
        onClose();
        onNavigate('academics');
      },
    }));

  // Search filtered notes
  const matchedNotes = notes
    .filter((n) => n.title.toLowerCase().includes(trimmed) || n.content.toLowerCase().includes(trimmed))
    .slice(0, 3)
    .map((n) => ({
      id: `note-${n.id}`,
      title: n.title,
      category: 'Notes',
      subtitle: n.content.slice(0, 45),
      icon: FileText,
      action: () => {
        onClose();
        onNavigate('notes');
      },
    }));

  const allFiltered = trimmed
    ? [...matchedTasks, ...matchedExams, ...matchedNotes, ...standardActions.filter((a) => a.title.toLowerCase().includes(trimmed))]
    : standardActions;

  const handleSelect = (index: number) => {
    if (allFiltered[index]) {
      allFiltered[index].action();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allFiltered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allFiltered.length) % allFiltered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search tasks, exams, or notes..."
            className="flex-1 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] font-mono font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto py-2 px-2 max-h-[360px] divide-y divide-slate-50">
          {allFiltered.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No results matching "{query}"
            </div>
          ) : (
            allFiltered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      {'subtitle' in item && item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0 ml-2">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 font-mono">
          <span>Navigate with ↑ ↓</span>
          <span>Select with ↵</span>
        </div>
      </div>
    </div>
  );
};
