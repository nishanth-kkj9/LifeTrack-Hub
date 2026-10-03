import React, { useState } from 'react';
import {
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { ExamReminder, VtuProfile, Task } from '../../types/index.ts';
import { ExamsView } from './ExamsView.tsx';
import { VtuHubView } from './VtuHubView.tsx';
import { Button } from '../ui/Button.tsx';

interface AcademicsViewProps {
  exams: ExamReminder[];
  vtuProfile?: VtuProfile;
  tasks?: Task[];
  initialSubTab?: 'exams' | 'vtu';
  onUpdateVtuProfile?: (profile: VtuProfile) => void;
  onAddExam?: (exam: ExamReminder) => void;
  onUpdateExam?: (exam: ExamReminder) => void;
  onOpenAddExamModal: () => void;
  onDeleteExam: (examId: string) => void;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  exams,
  vtuProfile,
  tasks = [],
  initialSubTab = 'exams',
  onUpdateVtuProfile,
  onAddExam,
  onUpdateExam,
  onOpenAddExamModal,
  onDeleteExam,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'exams' | 'vtu'>(initialSubTab);

  return (
    <div id="academics-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Academics Header with Segmented Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Academics & Study Hub
              </h1>
              <p className="text-xs text-slate-500">
                Exam countdowns, syllabus tracking, CBCS grading, and VTU engineering tools.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              id="subtab-academics-exams"
              onClick={() => setActiveSubTab('exams')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'exams'
                  ? 'bg-white text-indigo-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Exams & Study</span>
              {exams.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">
                  {exams.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="subtab-academics-vtu"
              onClick={() => setActiveSubTab('vtu')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'vtu'
                  ? 'bg-white text-indigo-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-indigo-600" />
              <span>VTU Hub (CBCS)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                Scheme
              </span>
            </button>
          </div>

          {activeSubTab === 'exams' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={onOpenAddExamModal}
            >
              Add Exam
            </Button>
          )}
        </div>
      </div>

      {/* Content Section */}
      {activeSubTab === 'exams' ? (
        <ExamsView
          exams={exams}
          onAddExam={onAddExam || (() => {})}
          onUpdateExam={onUpdateExam || (() => {})}
          onOpenAddExamModal={onOpenAddExamModal}
          onDeleteExam={onDeleteExam}
        />
      ) : (
        <VtuHubView
          profile={vtuProfile}
          onUpdateProfile={onUpdateVtuProfile}
        />
      )}
    </div>
  );
};
