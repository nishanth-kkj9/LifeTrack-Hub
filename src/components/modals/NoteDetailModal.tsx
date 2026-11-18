import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Pin, Edit3, Copy, Check, Trash2, Clock, FileText, Archive, ArchiveRestore } from 'lucide-react';
import { QuickNote } from '../../types/index.ts';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import { copyText } from '../../lib/clipboard.ts';
import { touch } from '../../lib/entity.ts';
import {
  getNoteCategories,
  NEW_CATEGORY_OPTION_VALUE,
  MAX_NOTE_CATEGORY_LENGTH,
  validateNewNoteCategory,
  NoteCategoryOption,
} from '../../lib/noteCategories.ts';
import {
  safeNoteText,
  safeNoteCategory,
  safeNoteTimestamp,
  getNoteDisplayTimestamp,
  formatNoteRelativeTime,
  countNoteWords,
} from '../../lib/noteUtils.ts';
import {
  parseNoteContent,
  toggleChecklistLine,
  getChecklistStats,
} from '../../lib/noteFormat.ts';
import { NoteFormattedContent } from '../notes/NoteFormattedContent.tsx';

interface NoteDetailModalProps {
  note: QuickNote | null;
  notes?: QuickNote[];
  onClose: () => void;
  onUpdateNote: (note: QuickNote) => void;
  onDeleteNote: (id: string) => void;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  notes = [],
  onClose,
  onUpdateNote,
  onDeleteNote,
}) => {
  const { containerRef } = useModalFocus<HTMLDivElement>({
    isOpen: Boolean(note),
    onClose,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isRaw, setIsRaw] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setIsRaw(false);
    setIsAddingCategory(false);
    setNewCategoryInput('');
    setCategoryError(null);
    setEditError(null);
    setCopyStatus('idle');
  }, [note?.id]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const base = getNoteCategories(notes);
    const seenLower = new Set(base.map((c) => c.id.toLowerCase()));
    const merged: NoteCategoryOption[] = [...base];
    for (const custom of customCategories) {
      const trimmed = custom.trim();
      if (trimmed && !seenLower.has(trimmed.toLowerCase())) {
        seenLower.add(trimmed.toLowerCase());
        merged.push({ id: trimmed, label: trimmed });
      }
    }
    const currentTrimmed = editCategory.trim();
    if (currentTrimmed && !seenLower.has(currentTrimmed.toLowerCase())) {
      merged.push({ id: currentTrimmed, label: currentTrimmed });
    }
    return merged;
  }, [notes, customCategories, editCategory]);

  if (!note) return null;

  const rawContent = safeNoteText(note.content);
  const parsedBlocks = parseNoteContent(rawContent);
  const checklistStats = getChecklistStats(parsedBlocks);

  const displayTs = getNoteDisplayTimestamp(note);
  const editedRelative = formatNoteRelativeTime(displayTs);
  const createdTs = safeNoteTimestamp(note.createdAt);
  const createdRelative = createdTs > 0 ? formatNoteRelativeTime(createdTs) : '';
  const words = countNoteWords(rawContent);

  const handleTogglePin = () => {
    onUpdateNote(
      touch({
        ...note,
        pinned: !note.pinned,
        ...(displayTs > 0 ? { contentUpdatedAt: displayTs } : {}),
      })
    );
  };

  const handleToggleArchive = () => {
    onUpdateNote(
      touch({
        ...note,
        archived: !note.archived,
        ...(displayTs > 0 ? { contentUpdatedAt: displayTs } : {}),
      })
    );
  };

  const handleToggleChecklistItem = (lineIndex: number) => {
    const updatedContent = toggleChecklistLine(rawContent, lineIndex);
    if (updatedContent === rawContent) return;
    onUpdateNote(
      touch({
        ...note,
        content: updatedContent,
        contentUpdatedAt: displayTs,
      })
    );
  };

  const handleCopy = async () => {
    try {
      const ok = await copyText(`${safeNoteText(note.title)}\n\n${safeNoteText(note.content)}`);
      setCopyStatus(ok ? 'copied' : 'failed');
    } catch {
      setCopyStatus('failed');
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopyStatus('idle');
      copyTimerRef.current = null;
    }, 2000);
  };

  const handleStartEdit = () => {
    setEditTitle(safeNoteText(note.title));
    setEditContent(safeNoteText(note.content));
    setEditCategory(safeNoteCategory(note.category));
    setIsAddingCategory(false);
    setNewCategoryInput('');
    setCategoryError(null);
    setEditError(null);
    setIsEditing(true);
  };

  const handleConfirmNewCategory = (): string | null => {
    const res = validateNewNoteCategory(newCategoryInput, categoryOptions);
    if (!res.ok) {
      setCategoryError(res.error);
      return null;
    }
    setCustomCategories((prev) => [...prev, res.category]);
    setEditCategory(res.category);
    setNewCategoryInput('');
    setCategoryError(null);
    setIsAddingCategory(false);
    return res.category;
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = editTitle.trim();
    const trimmedContent = editContent.trim();
    if (!trimmedTitle && !trimmedContent) {
      setEditError('Please enter a title or note content.');
      return;
    }

    let resolvedCategory = editCategory.trim() || 'General';
    if (isAddingCategory) {
      const added = handleConfirmNewCategory();
      if (!added) return;
      resolvedCategory = added;
    }

    const nextTitle =
      trimmedTitle || trimmedContent.split('\n')[0].slice(0, 40) || 'Untitled Note';
    const nextContent = trimmedContent;
    const nextCategory = resolvedCategory;

    const prevTitle = safeNoteText(note.title);
    const prevContent = safeNoteText(note.content);
    const prevCategory = safeNoteCategory(note.category);

    const didContentChange =
      nextTitle !== prevTitle ||
      nextContent !== prevContent ||
      nextCategory !== prevCategory;

    const now = Date.now();

    onUpdateNote(
      touch(
        {
          ...note,
          title: nextTitle,
          content: nextContent,
          category: nextCategory,
          ...(didContentChange
            ? { contentUpdatedAt: now }
            : displayTs > 0
            ? { contentUpdatedAt: displayTs }
            : {}),
        },
        now
      )
    );
    setIsEditing(false);
  };

  const handleDelete = () => {
    const id = note.id;
    onClose();
    onDeleteNote(id);
  };

  const modalContent = (
    <div
      id="note-detail-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-detail-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        ref={containerRef}
        id="note-detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="note-detail-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug break-words"
              >
                {safeNoteText(note.title)}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {safeNoteCategory(note.category)}
                </span>
                {note.pinned && (
                  <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </span>
                )}
                {note.archived && (
                  <span
                    id="note-detail-archived-badge"
                    className="font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" />
                    Archived
                  </span>
                )}
                <span className="font-mono tabular-nums">{words} words</span>
                {editedRelative && (
                  <span
                    id="note-detail-edited-time"
                    className="font-mono tabular-nums inline-flex items-center gap-1"
                    title={displayTs > 0 ? new Date(displayTs).toLocaleString() : undefined}
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    Updated {editedRelative}
                  </span>
                )}
                {createdRelative && (
                  <span
                    id="note-detail-created-time"
                    className="font-mono tabular-nums"
                    title={createdTs > 0 ? new Date(createdTs).toLocaleString() : undefined}
                  >
                    Created {createdRelative}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            id="close-note-detail-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Editor */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3.5">
            <div>
              <label
                htmlFor="note-detail-edit-title"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Title
              </label>
              <input
                id="note-detail-edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (editError) setEditError(null);
                }}
                placeholder="Note title"
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="note-detail-edit-category"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Category
              </label>
              <select
                id="note-detail-edit-category"
                value={isAddingCategory ? NEW_CATEGORY_OPTION_VALUE : editCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === NEW_CATEGORY_OPTION_VALUE) {
                    setIsAddingCategory(true);
                    setCategoryError(null);
                  } else {
                    setIsAddingCategory(false);
                    setNewCategoryInput('');
                    setCategoryError(null);
                    setEditCategory(val);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
                <option value={NEW_CATEGORY_OPTION_VALUE}>+ New category...</option>
              </select>

              {isAddingCategory && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      id="note-detail-new-category-input"
                      type="text"
                      maxLength={MAX_NOTE_CATEGORY_LENGTH}
                      placeholder="New category (max 24 chars)"
                      value={newCategoryInput}
                      onChange={(e) => {
                        setNewCategoryInput(e.target.value);
                        if (categoryError) setCategoryError(null);
                      }}
                      className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmNewCategory}
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                    <button
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
                htmlFor="note-detail-edit-content"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Content
              </label>
              <textarea
                id="note-detail-edit-content"
                rows={8}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  if (editError) setEditError(null);
                }}
                className="w-full px-3 py-2 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-y"
              />
              {editError && <p className="text-[11px] font-medium text-rose-600 mt-1">{editError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                id="note-detail-cancel-edit-btn"
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="note-detail-save-btn"
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              {checklistStats.total > 0 ? (
                <span
                  id="note-detail-checklist-progress"
                  className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700"
                >
                  {checklistStats.done}/{checklistStats.total} done
                </span>
              ) : (
                <span />
              )}
              <button
                id="note-detail-raw-toggle"
                type="button"
                aria-pressed={isRaw}
                onClick={() => setIsRaw((prev) => !prev)}
                className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                  isRaw
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Raw
              </button>
            </div>

            <div
              id="note-detail-content"
              className={`text-xs sm:text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 max-h-[55vh] overflow-y-auto ${
                isRaw ? 'font-mono' : 'font-sans'
              }`}
            >
              {isRaw ? (
                rawContent
              ) : (
                <NoteFormattedContent
                  blocks={parsedBlocks}
                  onToggleChecklistLine={handleToggleChecklistItem}
                />
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="note-detail-pin-btn"
                  type="button"
                  onClick={handleTogglePin}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    note.pinned
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{note.pinned ? 'Unpin' : 'Pin'}</span>
                </button>

                <button
                  id="note-detail-edit-btn"
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  id="note-detail-archive-btn"
                  type="button"
                  onClick={handleToggleArchive}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    note.archived
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {note.archived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>Unarchive</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </>
                  )}
                </button>

                <button
                  id="note-detail-copy-btn"
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied</span>
                    </>
                  ) : copyStatus === 'failed' ? (
                    <>
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-rose-600 font-bold">Copy failed</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <button
                id="note-detail-delete-btn"
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalContent, document.body)
    : modalContent;
};
