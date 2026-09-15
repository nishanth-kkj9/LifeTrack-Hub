import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ExamReminder, ExamTopic, ExamStatus } from '../../types/index.ts';

interface ExamsViewProps {
  exams: ExamReminder[];
  onAddExam: (exam: ExamReminder) => void;
  onUpdateExam: (exam: ExamReminder) => void;
  onDeleteExam: (id: string) => void;
  onOpenAddExamModal: () => void;
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  exams,
  onUpdateExam,
  onDeleteExam,
  onOpenAddExamModal,
}) => {
  const [now, setNow] = useState(Date.now());
  const [expandedExamIds, setExpandedExamIds] = useState<Record<string, boolean>>({});
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedExamIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateCountdown = (examDate: string, examTime: string) => {
    const target = new Date(`${examDate}T${examTime || '09:00'}`).getTime();
    const diff = target - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, hasPassed: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds, hasPassed: false };
  };

  const handleToggleTopic = (exam: ExamReminder, topicId: string) => {
    const updatedTopics = exam.topics.map((t) =>
      t.id === topicId ? { ...t, completed: !t.completed } : t
    );
    const allDone = updatedTopics.length > 0 && updatedTopics.every((t) => t.completed);
    onUpdateExam({
      ...exam,
      topics: updatedTopics,
      status: allDone ? 'ready' : exam.status === 'ready' ? 'reviewing' : exam.status,
    });
  };

  const handleAddTopic = (exam: ExamReminder) => {
    const title = (newTopicInputs[exam.id] || '').trim();
    if (!title) return;

    const newTopic: ExamTopic = {
      id: `top-${Date.now()}`,
      title,
      completed: false,
    };

    onUpdateExam({
      ...exam,
      topics: [...exam.topics, newTopic],
    });

    setNewTopicInputs((prev) => ({ ...prev, [exam.id]: '' }));
  };

  const handleDeleteTopic = (exam: ExamReminder, topicId: string) => {
    onUpdateExam({
      ...exam,
      topics: exam.topics.filter((t) => t.id !== topicId),
    });
  };

  const handleStatusChange = (exam: ExamReminder, status: ExamStatus) => {
    onUpdateExam({ ...exam, status });
  };

  // Sort exams chronologically
  const sortedExams = [...exams].sort((a, b) => {
    const timeA = new Date(`${a.examDate}T${a.examTime || '09:00'}`).getTime();
    const timeB = new Date(`${b.examDate}T${b.examTime || '09:00'}`).getTime();
    return timeA - timeB;
  });

  return (
    <div id="exams-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Exams & Academic Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time exam countdowns, syllabus checklists, and schedule tracking.
          </p>
        </div>

        <button
          id="exams-add-exam-btn"
          onClick={onOpenAddExamModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Exam</span>
        </button>
      </div>

      {/* Exam Cards Grid */}
      {sortedExams.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No exam reminders yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Add your midterms, finals, quizzes, or certification test dates to start live countdowns.
          </p>
          <button
            onClick={onOpenAddExamModal}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add an Exam</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedExams.map((exam) => {
            const cd = calculateCountdown(exam.examDate, exam.examTime);
            const isExpanded = !!expandedExamIds[exam.id];
            const coveredTopics = exam.topics.filter((t) => t.completed).length;
            const syllabusProgress =
              exam.topics.length > 0 ? Math.round((coveredTopics / exam.topics.length) * 100) : 0;

            return (
              <div
                key={exam.id}
                id={`exam-card-${exam.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Main Card Header */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Subject & Meta */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">{exam.subject}</h2>
                        {exam.courseCode && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {exam.courseCode}
                          </span>
                        )}
                        <select
                          id={`exam-status-select-${exam.id}`}
                          value={exam.status}
                          onChange={(e) => handleStatusChange(exam, e.target.value as ExamStatus)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-md cursor-pointer border-0 ${
                            exam.status === 'ready'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exam.status === 'reviewing'
                              ? 'bg-violet-100 text-violet-800'
                              : exam.status === 'studying'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="studying">Studying</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="ready">Ready to Ace</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {exam.examDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {exam.examTime}
                        </span>
                        {exam.roomOrVenue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {exam.roomOrVenue}
                          </span>
                        )}
                        {exam.targetScore && (
                          <span className="flex items-center gap-1 text-indigo-700 font-semibold">
                            <Target className="w-3.5 h-3.5 text-indigo-500" />
                            Target: {exam.targetScore}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Live Countdown Clock & Actions */}
                    <div className="flex items-center gap-3 self-start lg:self-center">
                      {/* Live Ticking Countdown Box */}
                      <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl flex items-center gap-2 font-mono text-center shadow-xs">
                        {cd.hasPassed ? (
                          <span className="text-xs font-bold text-slate-400">Exam completed</span>
                        ) : (
                          <>
                            <div>
                              <span className="text-base font-black text-amber-400">{cd.days}</span>
                              <span className="text-[10px] block text-slate-400">DAYS</span>
                            </div>
                            <span className="text-slate-500 text-sm">:</span>
                            <div>
                              <span className="text-base font-black text-white">{cd.hours}</span>
                              <span className="text-[10px] block text-slate-400">HRS</span>
                            </div>
                            <span className="text-slate-500 text-sm">:</span>
                            <div>
                              <span className="text-base font-black text-white">{cd.minutes}</span>
                              <span className="text-[10px] block text-slate-400">MIN</span>
                            </div>
                            <span className="text-slate-500 text-sm">:</span>
                            <div>
                              <span className="text-base font-black text-emerald-400">
                                {cd.seconds < 10 ? `0${cd.seconds}` : cd.seconds}
                              </span>
                              <span className="text-[10px] block text-slate-400">SEC</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Expand / Collapse Topics */}
                      <button
                        id={`exam-expand-btn-${exam.id}`}
                        onClick={() => toggleExpand(exam.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="View Topics"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Delete Exam */}
                      <button
                        id={`exam-delete-btn-${exam.id}`}
                        onClick={() => onDeleteExam(exam.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Delete exam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Syllabus Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span className="font-semibold text-slate-700">
                        Syllabus Covered: {coveredTopics} of {exam.topics.length} topics
                      </span>
                      <span className="font-bold text-indigo-600">{syllabusProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${syllabusProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Topics Checklist and Search Study Guide */}
                {isExpanded && (
                  <div className="border-t border-slate-150 bg-slate-50/60 p-5 space-y-5">
                    {/* Topics Checklist */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Syllabus Topics Checklist
                      </h3>

                      {exam.topics.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No topics added yet. Add key chapters below.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {exam.topics.map((topic) => (
                            <div
                              key={topic.id}
                              id={`topic-item-${topic.id}`}
                              className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs hover:border-slate-300 transition"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                  onClick={() => handleToggleTopic(exam, topic.id)}
                                  className="text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                                >
                                  {topic.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                                  ) : (
                                    <Circle className="w-4 h-4" />
                                  )}
                                </button>
                                <span
                                  className={`truncate font-medium text-slate-800 ${
                                    topic.completed ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {topic.title}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteTopic(exam, topic.id)}
                                className="text-slate-400 hover:text-rose-500 p-0.5 ml-2"
                                title="Remove topic"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Topic Input */}
                      <div className="flex items-center gap-2 mt-3 max-w-md">
                        <input
                          id={`exam-add-topic-input-${exam.id}`}
                          type="text"
                          placeholder="Add syllabus topic / chapter..."
                          value={newTopicInputs[exam.id] || ''}
                          onChange={(e) =>
                            setNewTopicInputs((prev) => ({ ...prev, [exam.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTopic(exam);
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => handleAddTopic(exam)}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                        >
                          Add Topic
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
