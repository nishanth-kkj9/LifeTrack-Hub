import React, { useState } from 'react';
import { X, FileText, Pin } from 'lucide-react';
import { QuickNote } from '../../types/index.ts';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote: (note: QuickNote) => void;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  onAddNote,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Formulas');
  const [pinned, setPinned] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const note: QuickNote = {
      id: `note-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      category: category.trim(),
      pinned,
      updatedAt: Date.now(),
    };

    onAddNote(note);
    onClose();

    // Reset
    setTitle('');
    setContent('');
    setPinned(false);
  };

  return (
    <div
      id="add-note-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="add-note-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Add Scratchpad Note / Formula</h2>
          </div>
          <button
            id="close-add-note-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="note-title-input" className="block text-xs font-bold text-slate-700 mb-1">
              Title *
            </label>
            <input
              id="note-title-input"
              type="text"
              required
              placeholder="e.g. Quadratic Formula, Emergency Fund Rule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="note-category-select" className="block text-xs font-bold text-slate-700 mb-1">
              Category
            </label>
            <select
              id="note-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Formulas">Formulas & Math</option>
              <option value="Finance">Finance Rules</option>
              <option value="Study">Study Key Points</option>
              <option value="General">General / Scratchpad</option>
            </select>
          </div>

          <div>
            <label htmlFor="note-content-input" className="block text-xs font-bold text-slate-700 mb-1">
              Note Content *
            </label>
            <textarea
              id="note-content-input"
              rows={4}
              required
              placeholder="Write formulas, steps, or reminders here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="note-pinned-checkbox"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
            <label htmlFor="note-pinned-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1">
              <Pin className="w-3 h-3 text-amber-500" />
              <span>Pin this note to the top</span>
            </label>
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
              id="submit-create-note-btn"
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
            >
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
