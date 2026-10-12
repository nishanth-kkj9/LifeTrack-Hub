import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Application-level ErrorBoundary (stability backstop).
 *
 * Without this, ANY render-time exception (e.g. corrupted persisted data,
 * a null entry inside appData.tasks, a bad JSON import) unmounts the entire
 * React tree and leaves the user with a permanent white screen — empirically
 * reproduced: localStorage `{ "tasks": [null] }` → TypeError → 0 bytes rendered.
 *
 * The fallback offers two recovery paths:
 *  1. Reload (transient error / already-fixed data)
 *  2. Quarantine-and-reload: move the corrupted local dataset aside (recoverable
 *     backup key) and restart clean.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crashed:', error, info?.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearLocalData = () => {
    try {
      const raw = localStorage.getItem('lifetrack_app_data_v1');
      if (raw) {
        // Keep a recoverable copy — never hard-delete user data during recovery.
        localStorage.setItem('lifetrack_app_data_v1_crash_backup', raw);
        localStorage.removeItem('lifetrack_app_data_v1');
      }
    } catch (e) {
      console.warn('[ErrorBoundary] Failed to quarantine local data:', e);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-xl" aria-hidden="true">
              ⚠️
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">LifeTrack Hub hit an unexpected error</h1>
              <p className="text-xs text-slate-500">The interface stopped rendering to prevent data corruption.</p>
            </div>
          </div>

          <pre className="text-[11px] leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-32 text-slate-600 whitespace-pre-wrap break-words">
            {String(this.state.error?.message || this.state.error)}
          </pre>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={this.handleClearLocalData}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-bold hover:bg-red-50 transition cursor-pointer"
            >
              Reset local data & reload
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            "Reset local data" keeps a recoverable copy under{' '}
            <code className="font-mono">lifetrack_app_data_v1_crash_backup</code> in this browser.
            Cloud-synced data (if signed in) is untouched.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
