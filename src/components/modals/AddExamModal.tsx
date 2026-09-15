import React, { useState } from 'react';
import { X, Plus, Trash2, GraduationCap } from 'lucide-react';
import { ExamReminder, ExamTopic } from '../../types/index.ts';

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExam: (exam: ExamReminder) => void;
}

export const AddExamModal: React.FC<AddExamModalProps> = ({
  isOpen,
  onClose,
  onAddExam,
}) => {
  const [subject, setSubject] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [examDate, setExamDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [examTime, setExamTime] = useState('09:00');
  const [roomOrVenue, setRoomOrVenue] = useState('');
  const [targetScore, setTargetScore] = useState('90% (A)');
  const [topicInput, setTopicInput] = useState('');
  const [topics, setTopics] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAddTopic = () => {
    if (!topicInput.trim()) return;
    setTopics((prev) => [...prev, topicInput.trim()]);
    setTopicInput('');
  };

  const handleRemoveTopic = (index: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    const newExam: ExamReminder = {
      id: `exam-${Date.now()}`,
      subject: subject.trim(),
      courseCode: courseCode.trim() || undefined,
      examDate,
      examTime,
      roomOrVenue: roomOrVenue.trim() || undefined,
      targetScore: targetScore.trim() || undefined,
      status: 'studying',
      topics: topics.map((t, idx) => ({
        id: `topic-${Date.now()}-${idx}`,
        title: t,
        completed: false,
      })),
      createdAt: Date.now(),
    };

    onAddExam(newExam);
    onClose();

    // Reset
    setSubject('');
    setCourseCode('');
    setRoomOrVenue('');
    setTopics([]);
  };

  return (
    <div
      id="add-exam-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="add-exam-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Add Exam Reminder</h2>
          </div>
          <button
            id="close-add-exam-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="exam-subject-input" className="block text-xs font-bold text-slate-700 mb-1">
                Subject / Course Name *
              </label>
              <input
                id="exam-subject-input"
                type="text"
                required
                placeholder="e.g. Data Structures & Algorithms"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="exam-code-input" className="block text-xs font-bold text-slate-700 mb-1">
                Course Code
              </label>
              <input
                id="exam-code-input"
                type="text"
                placeholder="e.g. CS 210"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exam-date-input" className="block text-xs font-bold text-slate-700 mb-1">
                Exam Date *
              </label>
              <input
                id="exam-date-input"
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="exam-time-input" className="block text-xs font-bold text-slate-700 mb-1">
                Start Time
              </label>
              <input
                id="exam-time-input"
                type="time"
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exam-venue-input" className="block text-xs font-bold text-slate-700 mb-1">
                Room / Venue / Platform
              </label>
              <input
                id="exam-venue-input"
                type="text"
                placeholder="e.g. Science Hall 102"
                value={roomOrVenue}
                onChange={(e) => setRoomOrVenue(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="exam-target-score-input" className="block text-xs font-bold text-slate-700 mb-1">
                Target Score / Grade
              </label>
              <input
                id="exam-target-score-input"
                type="text"
                placeholder="e.g. 95% (A+) or Pass"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Syllabus Topics */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Syllabus Topics & Chapters to Cover
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                id="exam-topic-quick-input"
                type="text"
                placeholder="e.g. Chapter 4: Dynamic Programming"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-3 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl"
              >
                Add
              </button>
            </div>

            {topics.length > 0 && (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {topics.map((top, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    <span className="truncate text-slate-700">{top}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              id="submit-create-exam-btn"
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
            >
              Save Exam Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
