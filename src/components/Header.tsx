import React from 'react';
import { User } from 'firebase/auth';
import {
  LogIn,
  LogOut,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  isCloudSynced: boolean;
  onLogin: () => void;
  onLogout: () => void;
  activeTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isCloudSynced,
  onLogin,
  onLogout,
  activeTasksCount,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <header id="main-header" className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-3">
            <div id="brand-badge" className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">LifeTrack Hub</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Tracker
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Tasks • Finances • Exams • Habits</p>
            </div>
          </div>

          {/* Center Info / Today */}
          <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200/80">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {todayFormatted}
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {activeTasksCount} Pending Tasks
            </span>
          </div>

          {/* Actions & Auth */}
          <div className="flex items-center gap-2.5">
            {/* Cloud Sync Status */}
            <div
              id="cloud-sync-status-indicator"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700"
              title={
                user
                  ? 'Connected to Firebase Firestore. Changes sync in real-time.'
                  : 'Saving locally in browser storage. Sign in with Google to sync across devices.'
              }
            >
              {user ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="hidden lg:inline text-emerald-700 font-medium">Synced</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="hidden lg:inline text-slate-600">Local</span>
                </>
              )}
            </div>

            {/* User Auth Info */}
            {user ? (
              <div id="user-profile-menu" className="flex items-center gap-2 pl-1 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden xl:block text-left text-xs">
                  <p className="font-semibold text-slate-800 truncate max-w-[100px]">
                    {user.displayName?.split(' ')[0] || 'User'}
                  </p>
                </div>
                <button
                  id="user-logout-button"
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="user-login-button"
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
