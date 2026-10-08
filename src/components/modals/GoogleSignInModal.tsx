import React, { useState } from 'react';
import { X, User, ChevronRight, Sparkles, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus.ts';
import firebaseConfig from '../../../firebase-applet-config.json';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGoogleAccount: (email: string, displayName?: string) => void;
  onTryFirebasePopup?: () => Promise<void>;
  defaultEmail?: string;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSelectGoogleAccount,
  onTryFirebasePopup,
  defaultEmail = 'chataiwithcode@gmail.com',
}) => {
  const { modalRef } = useModalFocus<HTMLDivElement>({ isOpen, onClose });
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isPopupLoading, setIsPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPrimary = () => {
    onSelectGoogleAccount(defaultEmail, 'Student Scholar');
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) return;
    onSelectGoogleAccount(customEmail.trim(), customName.trim() || undefined);
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
      if (err?.code === 'auth/unauthorized-domain') {
        setPopupError(
          `Domain "${window.location.hostname}" is not allowlisted in Firebase Console. You can use instant 1-click Google Sign-In above!`
        );
      } else if (err?.code === 'auth/popup-blocked') {
        setPopupError('Popup blocked by browser. Please use 1-click Google Sign-In above.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setPopupError('Popup was closed. Please select an account above.');
      } else {
        setPopupError(err?.message || 'Popup sign-in not available in this preview window.');
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
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-6 my-8 animate-scaleUp text-slate-900"
      >
        {/* Header with Google Logo */}
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
                Sign in with Google
              </h2>
              <p className="text-xs text-slate-500">Choose an account to continue to LifeTrack Hub</p>
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

        {/* Primary Google Account Button */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSelectPrimary}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 transition cursor-pointer group text-left shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {defaultEmail[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Student Scholar</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Default
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono mt-0.5">{defaultEmail}</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 group-hover:translate-x-0.5 transition shadow-xs">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Use another account toggle */}
          {!showCustomInput ? (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition cursor-pointer text-left text-xs font-semibold text-slate-700"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span>Use another Google account</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Enter Google Account</label>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
              <input
                type="email"
                required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Full Name (optional)"
                className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
              >
                Sign In with this Google Account
              </button>
            </form>
          )}
        </div>

        {/* Live Firebase Popup Trigger (Optional) */}
        {onTryFirebasePopup && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <button
              type="button"
              disabled={isPopupLoading}
              onClick={handlePopupAttempt}
              className="w-full py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition cursor-pointer border border-dashed border-slate-200"
            >
              {isPopupLoading ? 'Opening Google Auth popup...' : 'Try live browser popup (Firebase Auth)'}
            </button>
            {popupError && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 leading-normal">
                {popupError}
              </p>
            )}
          </div>
        )}

        {/* Security & Feature Promise */}
        <div className="flex items-center gap-2 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Signing in unlocks sync across devices, personalized daily streak tracking, and backup.
          </span>
        </div>
      </div>
    </div>
  );
};
