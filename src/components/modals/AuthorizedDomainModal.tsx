import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  HardDrive,
  Info,
} from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import firebaseConfig from '../../../firebase-applet-config.json';

interface AuthorizedDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInLocal?: () => void;
}

export const AuthorizedDomainModal: React.FC<AuthorizedDomainModalProps> = ({
  isOpen,
  onClose,
  onSignInLocal,
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  const handleCopy = () => {
    if (navigator?.clipboard && currentHostname) {
      navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-domain-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-5 my-8 animate-scaleUp text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-domain-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                Authorize Preview Domain in Firebase
              </h2>
              <p className="text-xs text-slate-500">
                Google Sign-In requires your current preview domain to be allowlisted.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Domain Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2">
          <label className="text-xs font-semibold text-slate-600 block">Current Domain to Add:</label>
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-300">
            <code className="text-xs font-mono font-bold text-slate-800 break-all select-all">
              {currentHostname}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
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

        {/* 3 Steps Guide */}
        <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-slate-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-600" />
            <span>How to authorize in 30 seconds:</span>
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
            <li>
              Open Firebase Console Settings:{' '}
              <a
                href={firebaseSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5 hover:text-indigo-800"
              >
                <span>Authentication &gt; Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Scroll down to the <strong>Authorized domains</strong> section and click <strong>Add domain</strong>.</li>
            <li>Paste <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">{currentHostname}</code> and click <strong>Done</strong>.</li>
          </ol>
        </div>

        {/* Local Storage reassurance */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-900">
          <HardDrive className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p>
            <strong>All your data is safe!</strong> LifeTrack Hub automatically saves all tasks, habits, transactions, and VTU calculations locally in your browser. You can continue using all features without signing in.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={firebaseSettingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
            >
              <span>Firebase Settings</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {onSignInLocal && (
              <button
                type="button"
                onClick={() => {
                  onSignInLocal();
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-xs"
              >
                <span>Instant Local Sign-In</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Continue Offline
          </button>
        </div>
      </div>
    </div>
  );
};
