import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  GraduationCap,
  RotateCcw,
  Code,
  Layers,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Task } from '../../types/index.ts';
import { TASK_TEMPLATES, TaskTemplate, triggerStreakCelebration } from '../../lib/todoUtils.ts';

interface TaskTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTasks: (tasks: Task[]) => void;
}

export const TaskTemplatesModal: React.FC<TaskTemplatesModalProps> = ({
  isOpen,
  onClose,
  onImportTasks,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate>(TASK_TEMPLATES[0]);
  const [importedId, setImportedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl: TaskTemplate) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newTasks: Task[] = tpl.tasks.map((t, idx) => ({
      id: `task-tpl-${Date.now()}-${idx}`,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      dueDate: todayStr,
      completed: false,
      estimatedMinutes: t.estimatedMinutes,
      actualMinutes: 0,
      tags: t.tags,
      status: 'todo',
      subtasks: t.subtasks.map((sub, sIdx) => ({
        id: `st-tpl-${Date.now()}-${idx}-${sIdx}`,
        title: sub,
        completed: false,
        estimatedMinutes: Math.round(t.estimatedMinutes / t.subtasks.length) || 20,
      })),
      createdAt: Date.now() + idx,
    }));

    onImportTasks(newTasks);
    triggerStreakCelebration();
    setImportedId(tpl.id);
    setTimeout(() => {
      setImportedId(null);
      onClose();
    }, 1200);
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-indigo-600" />;
      case 'RotateCcw':
        return <RotateCcw className="w-5 h-5 text-emerald-600" />;
      case 'Code':
        return <Code className="w-5 h-5 text-amber-600" />;
      default:
        return <Layers className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Productivity Templates & Sprints</h2>
              <p className="text-xs text-slate-500">
                1-click import field-tested task structures and checklists.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TASK_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => setSelectedTemplate(tpl)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                selectedTemplate.id === tpl.id
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  {getTemplateIcon(tpl.icon)}
                </div>
                <h3 className="font-black text-xs text-slate-900 leading-tight">{tpl.name}</h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>{tpl.tasks.length} tasks</span>
                <span className="capitalize">{tpl.category}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Template Preview */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">{selectedTemplate.name}</h3>
              <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
            </div>

            <button
              onClick={() => handleApplyTemplate(selectedTemplate)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {importedId === selectedTemplate.id ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Imported!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Import {selectedTemplate.tasks.length} Tasks</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2.5">
            {selectedTemplate.tasks.map((t, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{t.title}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    ~{t.estimatedMinutes}m
                  </span>
                </div>
                {t.description && <p className="text-[11px] text-slate-500">{t.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-400">
                  {t.subtasks.map((sub, sIdx) => (
                    <span key={sIdx} className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      • {sub}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
