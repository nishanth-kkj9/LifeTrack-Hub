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
    <div id="notes-view-container" className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-b from-white to-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Notes & Scratchpad</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly store key math equations, formulas, takeaways, and lecture thoughts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="notes-search-input"
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white w-40 sm:w-52 min-h-[36px] font-medium text-slate-800"
            />
          </div>

          <button
            id="notes-add-note-btn"
            onClick={onOpenAddNoteModal}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs hover:shadow-sm min-h-[36px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200 space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-700">No notes found</p>
            <p className="text-xs text-slate-400 mt-0.5">Keep track of handy formulas or revision checklists here.</p>
          </div>
          <button
            type="button"
            onClick={onOpenAddNoteModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              id={`note-card-${note.id}`}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group hover:shadow-xs ${
                note.pinned
                  ? 'bg-amber-50/40 border-amber-200 shadow-2xs hover:border-amber-300'
                  : 'bg-white border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-indigo-950 transition-colors">
                    {note.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        note.pinned
                          ? 'text-amber-700 bg-amber-100/80 shadow-2xs'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={note.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed line-clamp-6">
                  {note.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase tracking-wider">
                  {note.category || 'General'}
                </span>

                <button
                  onClick={() => handleCopy(note)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer font-medium"
                  title="Copy text"
                >
                  {copiedId === note.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
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
