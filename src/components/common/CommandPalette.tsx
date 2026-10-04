import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckSquare,
  Calendar,
  GraduationCap,
  Wallet,
  Flame,
  FileText,
  Plus,
  Play,
  X,
  TrendingUp,
  Settings,
  CalendarDays,
  Timer,
} from 'lucide-react';
import { Task, ExamReminder, Habit, QuickNote } from '../../types/index.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
  onOpenAddTask: () => void;
  onOpenAddTransaction: () => void;
  onOpenAddExam: () => void;
  onOpenAddNote: () => void;
  onOpenFocusModal?: () => void;
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
  onOpenFocusModal,
  tasks,
  exams,
  habits,
  notes,
  onToggleTask,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { containerRef } = useModalFocus<HTMLDivElement>({
    isOpen,
    onClose,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard shortcut Ctrl+K / Cmd+K listener to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
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
      title: 'Create task',
      category: 'Actions',
      icon: Plus,
      action: () => {
        onClose();
        onOpenAddTask();
      },
    },
    {
      id: 'act-focus',
      title: 'Start Focus session',
      category: 'Actions',
      icon: Timer,
      action: () => {
        onClose();
        onOpenFocusModal?.();
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
      icon: CalendarDays,
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
      title: 'Open Finances & Budget',
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
      title: 'Open Notes scratchpad',
      category: 'Navigation',
      icon: FileText,
      action: () => {
        onClose();
        onNavigate('notes');
      },
    },
    {
      id: 'nav-insights',
      title: 'Open Insights & Review',
      category: 'Navigation',
      icon: TrendingUp,
      action: () => {
        onClose();
        onNavigate('insights');
      },
    },
    {
      id: 'nav-settings',
      title: 'Open Settings & Cloud Sync',
      category: 'Navigation',
      icon: Settings,
      action: () => {
        onClose();
        onNavigate('settings');
      },
    },
  ];

  // Dynamic search through app data
  const matchingTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(trimmed) ||
        (t.description && t.description.toLowerCase().includes(trimmed)) ||
        (t.category && t.category.toLowerCase().includes(trimmed)) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(trimmed)))
    )
    .slice(0, 5)
    .map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      subtitle: `${t.category} • ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}`,
      category: 'Tasks',
      icon: CheckSquare,
      action: () => {
        onClose();
        onNavigate('tasks');
      },
    }));

  const matchingExams = exams
    .filter(
      (e) =>
        e.subject.toLowerCase().includes(trimmed) ||
        (e.courseCode && e.courseCode.toLowerCase().includes(trimmed))
    )
    .slice(0, 3)
    .map((e) => ({
      id: `exam-${e.id}`,
      title: e.subject,
      subtitle: `${e.courseCode || 'Exam'} • ${e.examDate}`,
      category: 'Exams',
      icon: GraduationCap,
      action: () => {
        onClose();
        onNavigate('academics');
      },
    }));

  const matchingHabits = habits
    .filter((h) => h.name.toLowerCase().includes(trimmed))
    .slice(0, 3)
    .map((h) => ({
      id: `habit-${h.id}`,
      title: h.name,
      subtitle: `${h.streak || 0} day streak`,
      category: 'Habits',
      icon: Flame,
      action: () => {
        onClose();
        onNavigate('habits');
      },
    }));

  const matchingNotes = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(trimmed) ||
        n.content.toLowerCase().includes(trimmed)
    )
    .slice(0, 3)
    .map((n) => ({
      id: `note-${n.id}`,
      title: n.title,
      subtitle: n.content.slice(0, 40),
      category: 'Notes',
      icon: FileText,
      action: () => {
        onClose();
        onNavigate('notes');
      },
    }));

  const filteredActions = standardActions.filter(
    (act) =>
      act.title.toLowerCase().includes(trimmed) ||
      act.category.toLowerCase().includes(trimmed)
  );

  const allFiltered = trimmed
    ? [...matchingTasks, ...matchingExams, ...matchingHabits, ...matchingNotes, ...filteredActions]
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
        ref={containerRef}
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={allFiltered[selectedIndex] ? `cmd-item-${allFiltered[selectedIndex].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Command search query"
            placeholder="Type a command, search tasks, exams, habits, or notes..."
            className="flex-1 text-sm bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              aria-label="Clear query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] font-mono font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          id="command-palette-list"
          role="listbox"
          aria-label="Command suggestions"
          className="overflow-y-auto py-2 px-2 max-h-[360px] divide-y divide-slate-50"
        >
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
                  id={`cmd-item-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate">{item.title}</p>
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 font-mono">
          <span>Navigate with ↑ ↓</span>
          <span>Select with ↵</span>
        </div>
      </div>
    </div>
  );
};
