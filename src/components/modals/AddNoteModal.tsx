import React, { useState, useMemo } from 'react';
import { X, FileText, Pin } from 'lucide-react';
import { QuickNote } from '../../types/index.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import {
  getNoteCategories,
  NEW_CATEGORY_OPTION_VALUE,
  MAX_NOTE_CATEGORY_LENGTH,
  validateNewNoteCategory,
} from '../../lib/noteCategories.ts';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote: (note: QuickNote) => void;
  notes?: QuickNote[];
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  onAddNote,
  notes = [],
}) => {
  const { containerRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Formulas');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  const categoryOptions = useMemo(() => {
    const base = getNoteCategories(notes);
    const seenLower = new Set(base.map((c) => c.id.toLowerCase()));
    const merged = [...base];
    for (const custom of customCategories) {
      const trimmed = custom.trim();
      if (trimmed && !seenLower.has(trimmed.toLowerCase())) {
        seenLower.add(trimmed.toLowerCase());
        merged.push({ id: trimmed, label: trimmed });
      }
    }
    return merged;
  }, [notes, customCategories]);

  if (!isOpen) return null;

  const handleConfirmNewCategory = (): string | null => {
    const res = validateNewNoteCategory(newCategoryInput, categoryOptions);
    if (!res.ok) {
      setCategoryError(res.error);
      return null;
    }
    setCustomCategories((prev) => [...prev, res.category]);
    setCategory(res.category);
    setNewCategoryInput('');
    setCategoryError(null);
    setIsAddingCategory(false);
    return res.category;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle && !trimmedContent) {
      setFormError('Please enter a title or note content.');
      return;
    }

    let resolvedCategory = category;
    if (isAddingCategory) {
      const addedCat = handleConfirmNewCategory();
      if (!addedCat) return;
      resolvedCategory = addedCat;
    }

    const finalTitle =
      trimmedTitle || trimmedContent.split('\n')[0].slice(0, 40) || 'Untitled Note';

    const now = Date.now();
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 8)}`;

    const note: QuickNote = {
      id: `note-${uuid}`,
      title: finalTitle,
      content: trimmedContent,
      category: resolvedCategory.trim() || 'General',
      pinned,
      createdAt: now,
      contentUpdatedAt: now,
      updatedAt: now,
    };

    onAddNote(note);
    onClose();

    // Reset
    setTitle('');
    setContent('');
    setCategory('Formulas');
    setIsAddingCategory(false);
    setNewCategoryInput('');
    setCategoryError(null);
    setFormError(null);
    setPinned(false);
  };

  return (
    <div
      id="add-note-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-note-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        id="add-note-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 id="add-note-modal-title" className="text-base font-bold text-slate-900">
              Add Scratchpad Note
            </h2>
          </div>
          <button
            id="close-add-note-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="note-title-input" className="block text-xs font-bold text-slate-700 mb-1">
              Title
            </label>
            <input
              id="note-title-input"
              type="text"
              placeholder="e.g. Quadratic Formula, Emergency Fund Rule"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="note-category-select"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Category
            </label>
            <select
              id="note-category-select"
              value={isAddingCategory ? NEW_CATEGORY_OPTION_VALUE : category}
              onChange={(e) => {
                const val = e.target.value;
                if (val === NEW_CATEGORY_OPTION_VALUE) {
                  setIsAddingCategory(true);
                  setCategoryError(null);
                } else {
                  setIsAddingCategory(false);
                  setNewCategoryInput('');
                  setCategoryError(null);
                  setCategory(val);
                }
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
              <option value={NEW_CATEGORY_OPTION_VALUE}>+ New category...</option>
            </select>

            {isAddingCategory && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    id="note-new-category-input"
                    type="text"
                    maxLength={MAX_NOTE_CATEGORY_LENGTH}
                    placeholder="New category (max 24 chars)"
                    value={newCategoryInput}
                    onChange={(e) => {
                      setNewCategoryInput(e.target.value);
                      if (categoryError) setCategoryError(null);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    id="note-new-category-add-btn"
                    type="button"
                    onClick={handleConfirmNewCategory}
                    className="px-2.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    id="note-new-category-cancel-btn"
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryInput('');
                      setCategoryError(null);
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {categoryError && (
                  <p className="text-[11px] font-medium text-rose-600">{categoryError}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="note-content-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Note Content
            </label>
            <textarea
              id="note-content-input"
              rows={4}
              placeholder="Write formulas, steps, or reminders here..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (formError) setFormError(null);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
            />
            {formError && <p className="text-[11px] font-medium text-rose-600 mt-1">{formError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="note-pinned-checkbox"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
            <label
              htmlFor="note-pinned-checkbox"
              className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1"
            >
              <Pin className="w-3 h-3 text-amber-500" />
              <span>Pin this note to the top</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
