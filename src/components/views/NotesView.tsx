import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Pin,
  Copy,
  Check,
  Search,
  X,
  Edit3,
  Sparkles,
  ArrowUpDown,
  Clock,
  Maximize2,
  Archive,
  ArchiveRestore,
  Download,
  ChevronDown,
} from 'lucide-react';
import { QuickNote } from '../../types/index.ts';
import { copyText } from '../../lib/clipboard.ts';
import { exportNotesMarkdown, exportNotesJson } from '../../lib/dataExport.ts';
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
  getNoteDisplayTimestamp,
  formatNoteRelativeTime,
  countNoteWords,
} from '../../lib/noteUtils.ts';
import {
  parseNoteContent,
  toggleChecklistLine,
  getChecklistStats,
  extractTags,
  normalizeForSearch,
} from '../../lib/noteFormat.ts';
import { HighlightedText } from '../notes/HighlightedText.tsx';
import { NoteFormattedContent } from '../notes/NoteFormattedContent.tsx';
import { NoteDetailModal } from '../modals/NoteDetailModal.tsx';

export { getNoteDisplayTimestamp, formatNoteRelativeTime };

const ARCHIVED_TAB_ID = '__archived__';

interface NotesViewProps {
  notes: QuickNote[];
  onAddNote: (note: QuickNote) => void;
  onUpdateNote: (note: QuickNote) => void;
  onDeleteNote: (id: string) => void;
  onOpenAddNoteModal: () => void;
}

const NoteCardPreview: React.FC<{
  noteId: string;
  content: string;
  highlightQuery?: string;
  onOpenDetail: () => void;
  onToggleChecklistLine: (lineIndex: number) => void;
}> = ({ noteId, content, highlightQuery = '', onOpenDetail, onToggleChecklistLine }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => parseNoteContent(content), [content]);
  const [isOverflowing, setIsOverflowing] = useState(
    () => content.split(/\r?\n/).length > 6
  );

  useEffect(() => {
    const checkOverflow = () => {
      const el = previewRef.current;
      if (!el) return;
      if (el.clientHeight > 0) {
        setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
      } else {
        setIsOverflowing(content.split(/\r?\n/).length > 6);
      }
    };

    checkOverflow();
    if (typeof ResizeObserver !== 'undefined' && previewRef.current) {
      const ro = new ResizeObserver(checkOverflow);
      ro.observe(previewRef.current);
      return () => ro.disconnect();
    }
  }, [content]);

  return (
    <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/80">
      <div
        ref={previewRef}
        id={`note-preview-${noteId}`}
        className="text-xs text-slate-600 whitespace-pre-wrap leading-5 line-clamp-6 max-h-[7.5rem] overflow-hidden"
      >
        <NoteFormattedContent
          blocks={blocks}
          onToggleChecklistLine={onToggleChecklistLine}
          compact
          stopClickPropagation
          highlightQuery={highlightQuery}
        />
      </div>
      {isOverflowing && (
        <button
          id={`note-show-more-${noteId}`}
          type="button"
          onClick={onOpenDetail}
          className="mt-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
        >
          Show more
        </button>
      )}
    </div>
  );
};

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onOpenAddNoteModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'words'>('updated');
  const [copyStatus, setCopyStatus] = useState<{ id: string; status: 'copied' | 'failed' } | null>(
    null
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  // Quick inline capture scratchpad state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickCategory, setQuickCategory] = useState('Formulas');
  const [quickCustomCategories, setQuickCustomCategories] = useState<string[]>([]);
  const [isQuickAddingCategory, setIsQuickAddingCategory] = useState(false);
  const [quickNewCategoryInput, setQuickNewCategoryInput] = useState('');
  const [quickCategoryError, setQuickCategoryError] = useState<string | null>(null);
  const [quickPinned, setQuickPinned] = useState(false);
  const [confirmDiscardQuickDraft, setConfirmDiscardQuickDraft] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  // In-card editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [switchEditNoticeNoteId, setSwitchEditNoticeNoteId] = useState<string | null>(null);
  const [detailNoteId, setDetailNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategories, setEditCustomCategories] = useState<string[]>([]);
  const [isEditAddingCategory, setIsEditAddingCategory] = useState(false);
  const [editNewCategoryInput, setEditNewCategoryInput] = useState('');
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const detailNote = useMemo(
    () => notes.find((n) => n.id === detailNoteId) ?? null,
    [notes, detailNoteId]
  );

  // Partition active workspace notes (not archived) from archived notes
  const activeWorkspaceNotes = useMemo(
    () => notes.filter((n) => !n.archived),
    [notes]
  );
  const archivedNotes = useMemo(
    () => notes.filter((n) => Boolean(n.archived)),
    [notes]
  );

  // High-level statistics (excluding archived notes from active workspace stats)
  const stats = useMemo(() => {
    const total = activeWorkspaceNotes.length;
    const pinned = activeWorkspaceNotes.filter((n) => Boolean(n.pinned)).length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStartMs = startOfToday.getTime();
    const updatedToday = activeWorkspaceNotes.filter(
      (n) => getNoteDisplayTimestamp(n) >= todayStartMs
    ).length;
    return { total, pinned, updatedToday };
  }, [activeWorkspaceNotes]);

  // Dynamic category list combining canonical presets + existing user categories
  const tabCategoriesList = useMemo(
    () => getNoteCategories(activeWorkspaceNotes),
    [activeWorkspaceNotes]
  );
  const categoriesList = useMemo(() => getNoteCategories(notes), [notes]);

  const quickCategoryOptions = useMemo(() => {
    const seenLower = new Set(categoriesList.map((c) => c.id.toLowerCase()));
    const merged: NoteCategoryOption[] = [...categoriesList];
    for (const custom of quickCustomCategories) {
      const trimmed = custom.trim();
      if (trimmed && !seenLower.has(trimmed.toLowerCase())) {
        seenLower.add(trimmed.toLowerCase());
        merged.push({ id: trimmed, label: trimmed });
      }
    }
    return merged;
  }, [categoriesList, quickCustomCategories]);

  const editCategoryOptions = useMemo(() => {
    const seenLower = new Set(categoriesList.map((c) => c.id.toLowerCase()));
    const merged: NoteCategoryOption[] = [...categoriesList];
    for (const custom of editCustomCategories) {
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
  }, [categoriesList, editCustomCategories, editCategory]);

  // Copy handler with temporary feedback
  const handleCopy = async (note: QuickNote) => {
    try {
      const ok = await copyText(`${safeNoteText(note.title)}\n\n${safeNoteText(note.content)}`);
      setCopyStatus({ id: note.id, status: ok ? 'copied' : 'failed' });
    } catch {
      setCopyStatus({ id: note.id, status: 'failed' });
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopyStatus(null);
      copyTimerRef.current = null;
    }, 2000);
  };

  const handleTogglePin = (note: QuickNote) => {
    const existingDisplayTs = getNoteDisplayTimestamp(note);
    onUpdateNote(
      touch({
        ...note,
        pinned: !note.pinned,
        ...(existingDisplayTs > 0 ? { contentUpdatedAt: existingDisplayTs } : {}),
      })
    );
  };

  const handleToggleArchive = (note: QuickNote) => {
    const existingDisplayTs = getNoteDisplayTimestamp(note);
    onUpdateNote(
      touch({
        ...note,
        archived: !note.archived,
        ...(existingDisplayTs > 0 ? { contentUpdatedAt: existingDisplayTs } : {}),
      })
    );
  };

  const handleToggleChecklistItem = (note: QuickNote, lineIndex: number) => {
    const rawContent = safeNoteText(note.content);
    const updatedContent = toggleChecklistLine(rawContent, lineIndex);
    if (updatedContent === rawContent) return;
    const existingDisplayTs = getNoteDisplayTimestamp(note);
    onUpdateNote(
      touch({
        ...note,
        content: updatedContent,
        contentUpdatedAt: existingDisplayTs,
      })
    );
  };

  const handleConfirmQuickNewCategory = (): string | null => {
    const res = validateNewNoteCategory(quickNewCategoryInput, quickCategoryOptions);
    if (!res.ok) {
      setQuickCategoryError(res.error);
      return null;
    }
    setQuickCustomCategories((prev) => [...prev, res.category]);
    setQuickCategory(res.category);
    setQuickNewCategoryInput('');
    setQuickCategoryError(null);
    setIsQuickAddingCategory(false);
    return res.category;
  };

  const hasQuickDraftText = quickTitle.trim().length > 0 || quickContent.trim().length > 0;

  const resetAndCloseQuickCapture = () => {
    setIsQuickCaptureOpen(false);
    setQuickTitle('');
    setQuickContent('');
    setQuickPinned(false);
    setIsQuickAddingCategory(false);
    setQuickNewCategoryInput('');
    setQuickCategoryError(null);
    setConfirmDiscardQuickDraft(false);
  };

  const handleRequestCloseQuickCapture = () => {
    if (hasQuickDraftText) {
      setConfirmDiscardQuickDraft(true);
    } else {
      resetAndCloseQuickCapture();
    }
  };

  // Inline Quick Capture submission
  const handleSaveQuickNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = quickTitle.trim();
    const trimmedContent = quickContent.trim();
    if (!trimmedTitle && !trimmedContent) return;

    let resolvedCategory = quickCategory || 'General';
    if (isQuickAddingCategory) {
      const added = handleConfirmQuickNewCategory();
      if (!added) return;
      resolvedCategory = added;
    }

    const titleToUse =
      trimmedTitle || trimmedContent.split('\n')[0].slice(0, 40) || 'Untitled Note';

    const now = Date.now();
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 8)}`;

    const newNote: QuickNote = {
      id: `note-${uuid}`,
      title: titleToUse,
      content: trimmedContent,
      category: resolvedCategory,
      pinned: quickPinned,
      createdAt: now,
      contentUpdatedAt: now,
      updatedAt: now,
    };

    onAddNote(newNote);
    resetAndCloseQuickCapture();
  };

  const handleQuickCaptureKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveQuickNote();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleRequestCloseQuickCapture();
    }
  };

  // In-card edit mode handlers
  const handleStartEditing = (note: QuickNote) => {
    if (editingNoteId && editingNoteId !== note.id) {
      setSwitchEditNoticeNoteId(note.id);
      return;
    }
    setSwitchEditNoticeNoteId(null);
    setEditingNoteId(note.id);
    setEditTitle(safeNoteText(note.title));
    setEditContent(safeNoteText(note.content));
    setEditCategory(safeNoteCategory(note.category));
    setIsEditAddingCategory(false);
    setEditNewCategoryInput('');
    setEditCategoryError(null);
    setEditError(null);
  };

  const handleConfirmEditNewCategory = (): string | null => {
    const res = validateNewNoteCategory(editNewCategoryInput, editCategoryOptions);
    if (!res.ok) {
      setEditCategoryError(res.error);
      return null;
    }
    setEditCustomCategories((prev) => [...prev, res.category]);
    setEditCategory(res.category);
    setEditNewCategoryInput('');
    setEditCategoryError(null);
    setIsEditAddingCategory(false);
    return res.category;
  };

  const handleSaveCardEdit = (noteId: string) => {
    const existing = notes.find((n) => n.id === noteId);
    if (!existing) return;

    const trimmedTitle = editTitle.trim();
    const trimmedContent = editContent.trim();
    if (!trimmedTitle && !trimmedContent) {
      setEditError('Please enter a title or note content.');
      return;
    }

    let resolvedCategory = editCategory.trim() || 'General';
    if (isEditAddingCategory) {
      const added = handleConfirmEditNewCategory();
      if (!added) return;
      resolvedCategory = added;
    }

    const nextTitle =
      trimmedTitle || trimmedContent.split('\n')[0].slice(0, 40) || 'Untitled Note';
    const nextContent = trimmedContent;
    const nextCategory = resolvedCategory;

    const prevTitle = safeNoteText(existing.title);
    const prevContent = safeNoteText(existing.content);
    const prevCategory = safeNoteCategory(existing.category);

    const didContentChange =
      nextTitle !== prevTitle ||
      nextContent !== prevContent ||
      nextCategory !== prevCategory;

    const now = Date.now();
    const existingDisplayTs = getNoteDisplayTimestamp(existing);

    onUpdateNote(
      touch(
        {
          ...existing,
          title: nextTitle,
          content: nextContent,
          category: nextCategory,
          ...(didContentChange
            ? { contentUpdatedAt: now }
            : existingDisplayTs > 0
            ? { contentUpdatedAt: existingDisplayTs }
            : {}),
        },
        now
      )
    );
    setEditingNoteId(null);
    setSwitchEditNoticeNoteId(null);
    setIsEditAddingCategory(false);
    setEditNewCategoryInput('');
    setEditCategoryError(null);
    setEditError(null);
  };

  const handleCancelCardEdit = () => {
    setEditingNoteId(null);
    setSwitchEditNoticeNoteId(null);
    setIsEditAddingCategory(false);
    setEditNewCategoryInput('');
    setEditCategoryError(null);
    setEditError(null);
  };

  // Filtered & sorted notes
  const highlightQuery = searchTerm.trim();

  const filteredNotes = useMemo(() => {
    const normalizedQuery = normalizeForSearch(highlightQuery);
    const normalizedSelectedTag = selectedTag ? normalizeForSearch(selectedTag) : '';

    return notes
      .filter((note) => {
        const titleStr = safeNoteText(note.title);
        const contentStr = safeNoteText(note.content);
        const categoryStr = typeof note.category === 'string' ? note.category : '';
        const tags = extractTags(contentStr);

        const matchesSearch =
          !normalizedQuery ||
          normalizeForSearch(titleStr).includes(normalizedQuery) ||
          normalizeForSearch(contentStr).includes(normalizedQuery) ||
          (categoryStr.length > 0 &&
            normalizeForSearch(categoryStr).includes(normalizedQuery)) ||
          tags.some((tag) => normalizeForSearch(tag).includes(normalizedQuery));

        const isArchived = Boolean(note.archived);
        const matchesArchiveView =
          selectedCategory === ARCHIVED_TAB_ID
            ? isArchived
            : !isArchived &&
              (selectedCategory === 'all' || safeNoteCategory(note.category) === selectedCategory);

        const matchesTag =
          !normalizedSelectedTag ||
          tags.some((tag) => normalizeForSearch(tag) === normalizedSelectedTag);

        const matchesPin = !onlyPinned || Boolean(note.pinned);

        return matchesSearch && matchesArchiveView && matchesTag && matchesPin;
      })
      .sort((a, b) => {
        // Pinned notes always surface first
        const aPinned = Boolean(a.pinned);
        const bPinned = Boolean(b.pinned);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        if (sortBy === 'title') {
          return safeNoteText(a.title).localeCompare(safeNoteText(b.title));
        }
        if (sortBy === 'words') {
          return countNoteWords(b.content) - countNoteWords(a.content);
        }
        return getNoteDisplayTimestamp(b) - getNoteDisplayTimestamp(a);
      });
  }, [notes, highlightQuery, selectedCategory, selectedTag, onlyPinned, sortBy]);

  const hasActiveFilters =
    searchTerm.length > 0 ||
    selectedCategory !== 'all' ||
    selectedTag !== null ||
    onlyPinned;

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedTag(null);
    setOnlyPinned(false);
  };

  return (
    <div id="notes-view-container" className="space-y-5 sm:space-y-6 pb-16 animate-fadeIn">
      {/* 1. Executive Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Notes & Scratchpad
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Capture mathematical formulas, lecture takeaways, revision points, and quick ideas.
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto sm:shrink-0 min-w-0">
          <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0 flex-nowrap min-w-0">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-0 sm:flex-none sm:w-44 lg:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="notes-search-input"
                type="text"
                placeholder="Search scratchpad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8.5 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white w-full min-w-0 min-h-[38px] font-medium text-slate-800 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span
              id="notes-results-count"
              className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0"
            >
              {filteredNotes.length} {filteredNotes.length === 1 ? 'result' : 'results'}
            </span>

            {/* Add Note Button */}
            <button
              id="notes-add-note-btn"
              type="button"
              onClick={onOpenAddNoteModal}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs min-h-[38px] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Note</span>
            </button>
          </div>

          {/* Export notes menu */}
          <div ref={exportMenuRef} className="relative self-end">
            <button
              id="notes-export-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={notes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-xl transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export notes</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div
                id="notes-export-menu"
                role="menu"
                aria-label="Export notes format"
                className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30"
              >
                <button
                  id="notes-export-md-btn"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    exportNotesMarkdown(notes);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <span>Markdown</span>
                  <span className="text-[10px] font-mono text-slate-400">.md</span>
                </button>
                <button
                  id="notes-export-json-btn"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    exportNotesJson(notes);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <span>JSON</span>
                  <span className="text-[10px] font-mono text-slate-400">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Overview Strip (Single compact row on < 640px) */}
      <div id="notes-stats-row" className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="px-2.5 py-2 sm:p-3.5 rounded-xl bg-white border border-slate-200 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Total Notes</p>
          <p className="text-sm sm:text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.total}
          </p>
        </div>
        <div className="px-2.5 py-2 sm:p-3.5 rounded-xl bg-white border border-slate-200 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Pinned</p>
          <p className="text-sm sm:text-lg font-bold text-amber-700 font-mono tabular-nums mt-0.5">
            {stats.pinned}
          </p>
        </div>
        <div className="px-2.5 py-2 sm:p-3.5 rounded-xl bg-white border border-slate-200 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Updated today</p>
          <p className="text-sm sm:text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.updatedToday}
          </p>
        </div>
      </div>

      {/* 3. Inline Quick-Capture Scratchpad Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200">
        {!isQuickCaptureOpen ? (
          <div
            id="notes-quick-capture-trigger"
            onClick={() => {
              setIsQuickCaptureOpen(true);
              setConfirmDiscardQuickDraft(false);
              setTimeout(() => quickInputRef.current?.focus(), 50);
            }}
            className="flex items-center justify-between p-3.5 sm:p-4 text-xs text-slate-400 hover:text-slate-600 bg-slate-50/60 hover:bg-slate-50 transition cursor-text"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">Capture a quick thought, formula, or code snippet...</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
              Click to write
            </span>
          </div>
        ) : (
          <form
            id="notes-quick-capture-form"
            onSubmit={handleSaveQuickNote}
            onKeyDown={handleQuickCaptureKeyDown}
            className="p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <input
                id="notes-quick-title-input"
                ref={quickInputRef}
                type="text"
                placeholder="Note title (e.g. Fourier Transform, Exam Formula)..."
                value={quickTitle}
                onChange={(e) => {
                  setQuickTitle(e.target.value);
                  if (confirmDiscardQuickDraft) setConfirmDiscardQuickDraft(false);
                }}
                className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
              />
              <button
                id="notes-quick-close-btn"
                type="button"
                onClick={handleRequestCloseQuickCapture}
                aria-label="Close quick capture"
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              id="notes-quick-content-input"
              rows={3}
              placeholder="Write or paste your formula, explanation, or quick takeaway..."
              value={quickContent}
              onChange={(e) => {
                setQuickContent(e.target.value);
                if (confirmDiscardQuickDraft) setConfirmDiscardQuickDraft(false);
              }}
              className="w-full text-xs font-mono text-slate-800 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white resize-y leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium text-[11px]">Category:</span>
                <div className="flex flex-wrap items-center gap-1">
                  {quickCategoryOptions.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setQuickCategory(cat.id);
                        setIsQuickAddingCategory(false);
                        setQuickCategoryError(null);
                      }}
                      title={cat.label}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                        !isQuickAddingCategory && quickCategory === cat.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.id}
                    </button>
                  ))}
                  <button
                    id="quick-new-category-btn"
                    type="button"
                    onClick={() => {
                      setIsQuickAddingCategory(true);
                      setQuickCategoryError(null);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                      isQuickAddingCategory
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    + New category...
                  </button>
                </div>

                {isQuickAddingCategory && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      id="quick-new-category-input"
                      type="text"
                      maxLength={MAX_NOTE_CATEGORY_LENGTH}
                      placeholder="Category (max 24)"
                      value={quickNewCategoryInput}
                      onChange={(e) => {
                        setQuickNewCategoryInput(e.target.value);
                        if (quickCategoryError) setQuickCategoryError(null);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 w-36"
                    />
                    <button
                      id="quick-new-category-add-btn"
                      type="button"
                      onClick={handleConfirmQuickNewCategory}
                      className="px-2 py-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickAddingCategory(false);
                        setQuickNewCategoryInput('');
                        setQuickCategoryError(null);
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    {quickCategoryError && (
                      <span className="text-[11px] font-medium text-rose-600">
                        {quickCategoryError}
                      </span>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-1.5 ml-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickPinned}
                    onChange={(e) => setQuickPinned(e.target.checked)}
                    className="w-3.5 h-3.5 text-slate-900 rounded cursor-pointer"
                  />
                  <span>Pin to top</span>
                </label>
              </div>

              {confirmDiscardQuickDraft && (
                <div
                  id="notes-quick-discard-prompt"
                  role="alert"
                  className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"
                >
                  <span className="font-semibold">Discard draft?</span>
                  <div className="flex items-center gap-2">
                    <button
                      id="notes-quick-discard-cancel-btn"
                      type="button"
                      onClick={() => setConfirmDiscardQuickDraft(false)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      Keep writing
                    </button>
                    <button
                      id="notes-quick-discard-confirm-btn"
                      type="button"
                      onClick={resetAndCloseQuickCapture}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  id="notes-quick-cancel-btn"
                  type="button"
                  onClick={handleRequestCloseQuickCapture}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="notes-quick-save-btn"
                  type="submit"
                  disabled={!quickTitle.trim() && !quickContent.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-xs"
                >
                  Save Note
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 4. Category Segmented Controls & Sort Options */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Category Tabs with scroll snap & gradient fade edge */}
        <div
          id="notes-category-tabs-wrapper"
          className="relative min-w-0 flex-1 rounded-xl overflow-hidden bg-slate-100"
        >
          <div
            id="notes-category-tabs-scroll"
            className="flex items-center gap-1 overflow-x-auto p-1 pr-8 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              id="notes-tab-all"
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`snap-start shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Notes ({activeWorkspaceNotes.length})
            </button>

            {tabCategoriesList.map((cat) => {
              const count = activeWorkspaceNotes.filter(
                (n) => safeNoteCategory(n.category).toLowerCase() === cat.id.toLowerCase()
              ).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`snap-start shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.id} ({count})
                </button>
              );
            })}

            <button
              id="notes-tab-archived"
              type="button"
              onClick={() => setSelectedCategory(ARCHIVED_TAB_ID)}
              className={`snap-start shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === ARCHIVED_TAB_ID
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archived ({archivedNotes.length})
            </button>
          </div>
          <div
            id="notes-category-tabs-fade"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-100 via-slate-100/80 to-transparent"
          />
        </div>

        {/* Pin Filter, Tag Filter & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0 text-xs">
          {selectedTag && (
            <button
              id="notes-active-tag-filter"
              type="button"
              onClick={() => setSelectedTag(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer hover:bg-slate-800 transition"
              title="Clear tag filter"
            >
              <span>#{selectedTag}</span>
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            id="notes-pinned-only-btn"
            type="button"
            onClick={() => setOnlyPinned(!onlyPinned)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
              onlyPinned
                ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Pinned Only</span>
          </button>

          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'title' | 'words')}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="updated">Recent updates</option>
              <option value="title">Title (A-Z)</option>
              <option value="words">Word count</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div
          id="notes-empty-state"
          className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-200 space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {hasActiveFilters ? 'No notes match these filters' : 'No notes yet'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting or clearing your active search, category, or pin filter.'
                : 'Capture key formulas, exam derivations, and quick ideas to keep them accessible anytime.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                id="notes-clear-filters-btn"
                type="button"
                onClick={handleClearFilters}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAddNoteModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Note</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const rawContent = safeNoteText(note.content);
            const words = countNoteWords(rawContent);
            const checklistStats = getChecklistStats(rawContent);
            const noteTags = extractTags(rawContent);
            const visibleTags = noteTags.slice(0, 3);
            const relativeTime = formatNoteRelativeTime(getNoteDisplayTimestamp(note));

            return (
              <div
                key={note.id}
                id={`note-card-${note.id}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group hover:shadow-xs min-w-0 ${
                  note.pinned
                    ? 'bg-amber-50/30 border-amber-200/90 shadow-2xs hover:border-amber-300'
                    : 'bg-white border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300'
                }`}
              >
                {isEditing ? (
                  /* In-place Card Editing Form */
                  <div
                    id={`note-edit-form-${note.id}`}
                    className="space-y-3"
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveCardEdit(note.id);
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCancelCardEdit();
                      }
                    }}
                  >
                    <input
                      id={`note-edit-title-${note.id}`}
                      type="text"
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        if (editError) setEditError(null);
                      }}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="Note title"
                    />

                    <div>
                      <select
                        id={`note-edit-category-${note.id}`}
                        value={isEditAddingCategory ? NEW_CATEGORY_OPTION_VALUE : editCategory}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === NEW_CATEGORY_OPTION_VALUE) {
                            setIsEditAddingCategory(true);
                            setEditCategoryError(null);
                          } else {
                            setIsEditAddingCategory(false);
                            setEditNewCategoryInput('');
                            setEditCategoryError(null);
                            setEditCategory(val);
                          }
                        }}
                        className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        {editCategoryOptions.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                        <option value={NEW_CATEGORY_OPTION_VALUE}>+ New category...</option>
                      </select>

                      {isEditAddingCategory && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              id={`edit-new-category-input-${note.id}`}
                              type="text"
                              maxLength={MAX_NOTE_CATEGORY_LENGTH}
                              placeholder="New category (max 24 chars)"
                              value={editNewCategoryInput}
                              onChange={(e) => {
                                setEditNewCategoryInput(e.target.value);
                                if (editCategoryError) setEditCategoryError(null);
                              }}
                              className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900"
                            />
                            <button
                              type="button"
                              onClick={handleConfirmEditNewCategory}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditAddingCategory(false);
                                setEditNewCategoryInput('');
                                setEditCategoryError(null);
                              }}
                              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                          {editCategoryError && (
                            <p className="text-[11px] font-medium text-rose-600">
                              {editCategoryError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <textarea
                      id={`note-edit-content-${note.id}`}
                      rows={5}
                      value={editContent}
                      onChange={(e) => {
                        setEditContent(e.target.value);
                        if (editError) setEditError(null);
                      }}
                      className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-y"
                    />
                    {editError && (
                      <p className="text-[11px] font-medium text-rose-600">{editError}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        id={`note-edit-cancel-${note.id}`}
                        type="button"
                        onClick={handleCancelCardEdit}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        id={`note-edit-save-${note.id}`}
                        type="button"
                        onClick={() => handleSaveCardEdit(note.id)}
                        className="px-3.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Card View Mode */
                  <>
                    <div>
                      {switchEditNoticeNoteId === note.id && (
                        <div
                          id={`note-edit-notice-${note.id}`}
                          role="status"
                          className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-800 flex items-center justify-between gap-2"
                        >
                          <span>Finish editing the other note</span>
                          <button
                            type="button"
                            onClick={() => setSwitchEditNoticeNoteId(null)}
                            className="text-amber-700 hover:text-amber-900 cursor-pointer shrink-0"
                            aria-label="Dismiss notice"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-slate-950 transition-colors min-w-0">
                          <button
                            id={`note-open-title-${note.id}`}
                            type="button"
                            onClick={() => setDetailNoteId(note.id)}
                            className="text-left hover:text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded cursor-pointer break-words"
                          >
                            <HighlightedText
                              text={safeNoteText(note.title)}
                              query={highlightQuery}
                            />
                          </button>
                        </h3>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            id={`note-open-${note.id}`}
                            type="button"
                            onClick={() => setDetailNoteId(note.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Open note"
                            aria-label={`Open ${safeNoteText(note.title) || 'note'}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`note-pin-${note.id}`}
                            type="button"
                            onClick={() => handleTogglePin(note)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              note.pinned
                                ? 'text-amber-700 bg-amber-100/90 shadow-2xs'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title={note.pinned ? 'Unpin note' : 'Pin note to top'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`note-edit-${note.id}`}
                            type="button"
                            onClick={() => handleStartEditing(note)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Edit note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`note-archive-${note.id}`}
                            type="button"
                            onClick={() => handleToggleArchive(note)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              note.archived
                                ? 'text-slate-900 bg-slate-100'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title={note.archived ? 'Unarchive note' : 'Archive note'}
                            aria-label={`${note.archived ? 'Unarchive' : 'Archive'} ${safeNoteText(note.title) || 'note'}`}
                          >
                            {note.archived ? (
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            id={`note-delete-${note.id}`}
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete note"
                            aria-label={`Delete ${safeNoteText(note.title) || 'note'}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Content with exact 6-line clamp, formatted tokens & interactive checklists */}
                      <NoteCardPreview
                        noteId={note.id}
                        content={rawContent}
                        highlightQuery={highlightQuery}
                        onOpenDetail={() => setDetailNoteId(note.id)}
                        onToggleChecklistLine={(lineIdx) =>
                          handleToggleChecklistItem(note, lineIdx)
                        }
                      />

                      {visibleTags.length > 0 && (
                        <div
                          id={`note-tags-${note.id}`}
                          className="flex flex-wrap items-center gap-1.5 mt-2.5"
                        >
                          {visibleTags.map((tag) => {
                            const isTagActive =
                              selectedTag !== null &&
                              normalizeForSearch(selectedTag) === normalizeForSearch(tag);
                            return (
                              <button
                                key={tag}
                                id={`note-tag-${note.id}-${tag}`}
                                type="button"
                                aria-pressed={isTagActive}
                                onClick={() =>
                                  setSelectedTag((prev) =>
                                    prev !== null &&
                                    normalizeForSearch(prev) === normalizeForSearch(tag)
                                      ? null
                                      : tag
                                  )
                                }
                                className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border transition cursor-pointer ${
                                  isTagActive
                                    ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                }`}
                              >
                                #
                                <HighlightedText text={tag} query={highlightQuery} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Card Metadata Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-semibold text-slate-600">
                          <HighlightedText
                            text={safeNoteCategory(note.category)}
                            query={highlightQuery}
                          />
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{words} words</span>
                        {checklistStats.total > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              id={`note-checklist-progress-${note.id}`}
                              className="font-mono tabular-nums font-semibold text-emerald-700"
                            >
                              {checklistStats.done}/{checklistStats.total} done
                            </span>
                          </>
                        )}
                        {relativeTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              id={`note-time-${note.id}`}
                              className="font-mono tabular-nums flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3 text-slate-400" />
                              {relativeTime}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        id={`note-copy-${note.id}`}
                        type="button"
                        onClick={() => void handleCopy(note)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer font-medium shrink-0"
                        title="Copy text"
                      >
                        {copyStatus?.id === note.id && copyStatus.status === 'copied' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Copied</span>
                          </>
                        ) : copyStatus?.id === note.id && copyStatus.status === 'failed' ? (
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
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NoteDetailModal
        note={detailNote}
        notes={notes}
        onClose={() => setDetailNoteId(null)}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
      />
    </div>
  );
};
