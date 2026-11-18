import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import type { BackupDataCounts } from '../../lib/dataExport.ts';

interface RestoreConfirmDialogProps {
  isOpen: boolean;
  incomingSummary: BackupDataCounts;
  currentSummary: BackupDataCounts;
  onDownloadBackupFirst: () => void;
  onCancel: () => void;
  onConfirmReplace: () => void;
}

function formatSummaryCounts(counts: BackupDataCounts): string {
  const parts = [
    `${counts.tasks} ${counts.tasks === 1 ? 'task' : 'tasks'}`,
    `${counts.habits} ${counts.habits === 1 ? 'habit' : 'habits'}`,
    `${counts.notes} ${counts.notes === 1 ? 'note' : 'notes'}`,
    `${counts.transactions} ${counts.transactions === 1 ? 'transaction' : 'transactions'}`,
    `${counts.exams} ${counts.exams === 1 ? 'exam' : 'exams'}`,
    `${counts.dailyMetrics} ${counts.dailyMetrics === 1 ? 'daily log' : 'daily logs'}`,
  ];
  return parts.join(', ');
}

export const RestoreConfirmDialog: React.FC<RestoreConfirmDialogProps> = ({
  isOpen,
  incomingSummary,
  currentSummary,
  onDownloadBackupFirst,
  onCancel,
  onConfirmReplace,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [downloadedCurrent, setDownloadedCurrent] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDownloadedCurrent(false);
      return;
    }

    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="restore-confirm-title"
        aria-describedby="restore-confirm-desc"
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2 min-w-0">
            <h3 id="restore-confirm-title" className="text-base font-bold text-slate-900">
              Replace your current data with this backup?
            </h3>
            <p id="restore-confirm-desc" className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              It has {formatSummaryCounts(incomingSummary)}. You currently have{' '}
              {formatSummaryCounts(currentSummary)}.
            </p>
            {downloadedCurrent && (
              <p className="text-xs font-semibold text-emerald-700">
                Current backup downloaded.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onDownloadBackupFirst();
              setDownloadedCurrent(true);
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Download current backup first</span>
          </button>

          <div className="flex items-center justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmReplace}
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer shadow-xs"
            >
              Replace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestoreConfirmDialog;
