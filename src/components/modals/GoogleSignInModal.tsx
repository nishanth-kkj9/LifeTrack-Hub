import React, { useState } from 'react';
import { X, HardDrive, ShieldCheck } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus.ts';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGoogleAccount: (email: string, displayName?: string) => void;
  onTryFirebasePopup?: () => Promise<void>;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSelectGoogleAccount,
  onTryFirebasePopup,
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const [offlineName, setOfflineName] = useState('');
  const [isPopupLoading, setIsPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleContinueOffline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const label = offlineName.trim() || 'Local User';
    onSelectGoogleAccount('local@device.invalid', label);
    onClose();
  };

  const handlePopupAttempt = async () => {
    if (!onTryFirebasePopup) return;
    try {
      setIsPopupLoading(true);
      setPopupError(null);
      await onTryFirebasePopup();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setPopupError('Sign-in window was closed. Try again or continue offline below.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setPopupError('This preview domain is not allowlisted for Google Sign-In. You can continue offline on this device.');
      } else {
        setPopupError(err?.message || 'Unable to open Google sign-in window.');
      }
    } finally {
      setIsPopupLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-signin-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5 my-8 animate-scaleUp text-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 id="google-signin-modal-title" className="text-lg font-extrabold text-slate-900 tracking-tight">
                Sync & Profile
              </h2>
              <p className="text-xs text-slate-500">Sign in for cloud sync or stay local on this browser</p>
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

        {/* Live Firebase Google Sign-In */}
        {onTryFirebasePopup && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={isPopupLoading}
              onClick={handlePopupAttempt}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <span>{isPopupLoading ? 'Opening Google Sign-In...' : 'Sign in with Google (Cloud Sync)'}</span>
            </button>
            {popupError && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-normal">
                {popupError}
              </p>
            )}
          </div>
        )}

        {/* Honest Offline Mode Option */}
        <form onSubmit={handleContinueOffline} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-800">Continue offline (this device only)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Data stays in your browser storage without uploading to Firebase.
          </p>
          <input
            type="text"
            value={offlineName}
            onChange={(e) => setOfflineName(e.target.value)}
            placeholder="Display name (optional)"
            className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            id="continue-offline-btn"
            type="submit"
            className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Continue offline (this device only)
          </button>
        </form>

        {/* Privacy note */}
        <div className="flex items-center gap-2 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Cloud sync requires a live Google Sign-In session. Offline mode saves only to this browser.
          </span>
        </div>
      </div>
    </div>
  );
};
