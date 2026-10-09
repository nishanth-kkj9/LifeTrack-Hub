import React from 'react';
import { User } from 'firebase/auth';
import {
  LogIn,
  LogOut,
  Calendar,
  CheckCircle2,
  Search,
  Timer,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  isCloudSynced: boolean;
  onLogin: () => void;
  onLogout: () => void;
  activeTasksCount: number;
  onOpenCommandPalette?: () => void;
  onOpenFocusModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isCloudSynced,
  onLogin,
  onLogout,
  activeTasksCount,
  onOpenCommandPalette,
  onOpenFocusModal,
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
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                LifeTrack Hub
              </span>
              <p className="text-xs text-slate-500 hidden sm:block">
                Tasks · Calendar · Academics · Habits
              </p>
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
          <div className="flex items-center gap-2">
            {/* Quick Search */}
            {onOpenCommandPalette && (
              <button
                type="button"
                id="header-search-button"
                onClick={onOpenCommandPalette}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                aria-label="Open Command Palette (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
                <kbd className="text-[10px] font-mono text-slate-400 bg-white px-1 rounded border border-slate-200">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Quick Focus Mode */}
            {onOpenFocusModal && (
              <button
                type="button"
                id="header-focus-button"
                onClick={onOpenFocusModal}
                className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                title="Focus Timer"
                aria-label="Start Pomodoro Focus"
              >
                <Timer className="w-4 h-4 text-purple-600" />
              </button>
            )}

            {/* Cloud Sync Status */}
            <div
              id="cloud-sync-status-indicator"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700"
              title={
                user && isCloudSynced
                  ? 'Connected to Firebase Firestore. Multi-device sync active.'
                  : user
                  ? 'Active in local mode. Connect to Firebase cloud to sync across devices.'
                  : 'Saving locally in browser storage. Sign in with Google to sync across devices.'
              }
            >
              {user && isCloudSynced ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="hidden lg:inline text-emerald-700 font-medium">Cloud Synced</span>
                </>
              ) : user ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="hidden lg:inline text-amber-700 font-medium">Local Mode</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
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
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer shadow-xs"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
