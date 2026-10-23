import React, { useState, useMemo, useRef } from 'react';
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
  BookOpen,
  Lightbulb,
  Sigma,
  CheckSquare,
  ArrowUpDown,
  Clock,
} from 'lucide-react';
import { QuickNote } from '../../types/index.ts';

interface NotesViewProps {
  notes: QuickNote[];
  onAddNote: (note: QuickNote) => void;
  onUpdateNote: (note: QuickNote) => void;
  onDeleteNote: (id: string) => void;
  onOpenAddNoteModal: () => void;
}

const DEFAULT_CATEGORIES = [
  { id: 'Formulas', label: 'Formulas & Math', icon: Sigma },
  { id: 'Study', label: 'Study & Exams', icon: BookOpen },
  { id: 'Ideas', label: 'Ideas & Thoughts', icon: Lightbulb },
  { id: 'Checklist', label: 'Checklists', icon: CheckSquare },
  { id: 'General', label: 'General', icon: FileText },
];

function formatNoteRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countWords(str: string): number {
  if (!str) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onOpenAddNoteModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'words'>('updated');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick inline capture scratchpad state
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickContent, setQuickContent] = useState('');
  const [quickCategory, setQuickCategory] = useState('Formulas');
  const [quickPinned, setQuickPinned] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  // In-card editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // High-level statistics
  const stats = useMemo(() => {
    const total = notes.length;
    const pinned = notes.filter((n) => n.pinned).length;
    const totalWords = notes.reduce((sum, n) => sum + countWords(n.content), 0);
    const categorySet = new Set(notes.map((n) => n.category || 'General'));
    return { total, pinned, totalWords, categoryCount: categorySet.size };
  }, [notes]);

  // Dynamic category list combining presets + existing user categories
  const categoriesList = useMemo(() => {
    const existing = new Set<string>();
    notes.forEach((n) => {
      if (n.category) existing.add(n.category);
    });
    DEFAULT_CATEGORIES.forEach((c) => existing.add(c.id));
    return Array.from(existing);
  }, [notes]);

  // Copy handler with temporary feedback
  const handleCopy = (note: QuickNote) => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePin = (note: QuickNote) => {
    onUpdateNote({ ...note, pinned: !note.pinned, updatedAt: Date.now() });
  };

  // Inline Quick Capture submission
  const handleSaveQuickNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim() && !quickContent.trim()) return;

    const titleToUse =
      quickTitle.trim() ||
      quickContent.trim().split('\n')[0].slice(0, 40) ||
      'Untitled Note';

    const newNote: QuickNote = {
      id: `note-${Date.now()}`,
      title: titleToUse,
      content: quickContent.trim(),
      category: quickCategory || 'General',
      pinned: quickPinned,
      updatedAt: Date.now(),
    };

    onAddNote(newNote);
    setQuickTitle('');
    setQuickContent('');
    setQuickPinned(false);
    setIsQuickCaptureOpen(false);
  };

  // In-card edit mode handlers
  const handleStartEditing = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditCategory(note.category || 'General');
  };

  const handleSaveCardEdit = (noteId: string) => {
    const existing = notes.find((n) => n.id === noteId);
    if (!existing) return;

    onUpdateNote({
      ...existing,
      title: editTitle.trim() || existing.title,
      content: editContent.trim(),
      category: editCategory.trim() || 'General',
      updatedAt: Date.now(),
    });
    setEditingNoteId(null);
  };

  const handleCancelCardEdit = () => {
    setEditingNoteId(null);
  };

  // Filtered & sorted notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        const matchesSearch =
          note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (note.category && note.category.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'all' || (note.category || 'General') === selectedCategory;

        const matchesPin = !onlyPinned || note.pinned;

        return matchesSearch && matchesCategory && matchesPin;
      })
      .sort((a, b) => {
        // Pinned notes always surface first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'words') {
          return countWords(b.content) - countWords(a.content);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, searchTerm, selectedCategory, onlyPinned, sortBy]);

  return (
    <div id="notes-view-container" className="space-y-6 pb-16 animate-fadeIn">
      {/* 1. Executive Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Notes & Scratchpad
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Capture mathematical formulas, lecture takeaways, revision points, and quick ideas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="notes-search-input"
              type="text"
              placeholder="Search scratchpad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8.5 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white w-44 sm:w-60 min-h-[38px] font-medium text-slate-800 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Note Button */}
          <button
            id="notes-add-note-btn"
            type="button"
            onClick={onOpenAddNoteModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs min-h-[38px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Strip (Zero-Pill Architecture) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Total Notes</p>
          <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.total}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Pinned to Top</p>
          <p className="text-lg font-bold text-amber-700 font-mono tabular-nums mt-0.5">
            {stats.pinned}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Total Words</p>
          <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.totalWords.toLocaleString()}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">Topics & Categories</p>
          <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.categoryCount}
          </p>
        </div>
      </div>

      {/* 3. Inline Quick-Capture Scratchpad Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200">
        {!isQuickCaptureOpen ? (
          <div
            onClick={() => {
              setIsQuickCaptureOpen(true);
              setTimeout(() => quickInputRef.current?.focus(), 50);
            }}
            className="flex items-center justify-between p-3.5 sm:p-4 text-xs text-slate-400 hover:text-slate-600 bg-slate-50/60 hover:bg-slate-50 transition cursor-text"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span>Capture a quick thought, formula, or code snippet...</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              Click to write
            </span>
          </div>
        ) : (
          <form onSubmit={handleSaveQuickNote} className="p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <input
                ref={quickInputRef}
                type="text"
                placeholder="Note title (e.g. Fourier Transform, Exam Formula)..."
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="w-full text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsQuickCaptureOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              placeholder="Write or paste your formula, explanation, or quick takeaway..."
              value={quickContent}
              onChange={(e) => setQuickContent(e.target.value)}
              className="w-full text-xs font-mono text-slate-800 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white resize-y leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium text-[11px]">Category:</span>
                <div className="flex items-center gap-1">
                  {['Formulas', 'Study', 'Ideas', 'Checklist', 'General'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setQuickCategory(cat)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                        quickCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickCaptureOpen(false);
                    setQuickTitle('');
                    setQuickContent('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
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
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 p-1 bg-slate-100 rounded-xl max-w-full">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Notes ({notes.length})
          </button>

          {categoriesList.map((cat) => {
            const count = notes.filter((n) => (n.category || 'General') === cat).length;
            if (count === 0 && !DEFAULT_CATEGORIES.some((d) => d.id === cat)) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Pin Filter & Sort Dropdown */}
        <div className="flex items-center gap-2 self-start md:self-auto text-xs">
          <button
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
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {searchTerm ? 'No matching notes found' : 'No notes in this category'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? `No notes match "${searchTerm}". Try another keyword or clear the search.`
                : 'Capture key formulas, exam derivations, and quick ideas to keep them accessible anytime.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Clear Search
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
            const words = countWords(note.content);
            const relativeTime = formatNoteRelativeTime(note.updatedAt);

            return (
              <div
                key={note.id}
                id={`note-card-${note.id}`}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group hover:shadow-xs ${
                  note.pinned
                    ? 'bg-amber-50/30 border-amber-200/90 shadow-2xs hover:border-amber-300'
                    : 'bg-white border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300'
                }`}
              >
                {isEditing ? (
                  /* In-place Card Editing Form */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="Note title"
                    />

                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="Formulas">Formulas & Math</option>
                      <option value="Study">Study & Exams</option>
                      <option value="Ideas">Ideas & Concepts</option>
                      <option value="Checklist">Checklists</option>
                      <option value="General">General</option>
                    </select>

                    <textarea
                      rows={5}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-y"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelCardEdit}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
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
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-slate-950 transition-colors">
                          {note.title}
                        </h3>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
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
                            type="button"
                            onClick={() => handleStartEditing(note)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Edit note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Content with monospace formula accent */}
                      <div className="text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed line-clamp-6 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/80">
                        {note.content}
                      </div>
                    </div>

                    {/* Unboxed Metadata Footer (Section 1A Compliant) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">
                          {note.category || 'General'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{words} words</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {relativeTime}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(note)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer font-medium"
                        title="Copy text"
                      >
                        {copiedId === note.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Copied</span>
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
    </div>
  );
};
