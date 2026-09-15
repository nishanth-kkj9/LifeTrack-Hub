import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Pin,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { QuickNote } from '../../types/index.ts';

interface NotesViewProps {
  notes: QuickNote[];
  onAddNote: (note: QuickNote) => void;
  onUpdateNote: (note: QuickNote) => void;
  onDeleteNote: (id: string) => void;
  onOpenAddNoteModal: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onUpdateNote,
  onDeleteNote,
  onOpenAddNoteModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (note: QuickNote) => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePin = (note: QuickNote) => {
    onUpdateNote({ ...note, pinned: !note.pinned });
  };

  const filteredNotes = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  return (
    <div id="notes-view-container" className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Formulas & Scratchpad</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly store key math equations, exam formulas, study takeaways, and budgeting guidelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="notes-search-input"
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36 sm:w-48"
            />
          </div>

          <button
            id="notes-add-note-btn"
            onClick={onOpenAddNoteModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No notes found</p>
          <p className="text-xs text-slate-400 mt-1">Keep track of handy formulas or revision checklists here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              id={`note-card-${note.id}`}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                note.pinned
                  ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                  : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-900 leading-snug">{note.title}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-1 rounded-md transition cursor-pointer ${
                        note.pinned ? 'text-amber-600 bg-amber-100' : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={note.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                  {note.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {note.category || 'General'}
                </span>

                <button
                  onClick={() => handleCopy(note)}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                  title="Copy text"
                >
                  {copiedId === note.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
