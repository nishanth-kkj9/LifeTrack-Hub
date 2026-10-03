import React, { useState, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  User as UserIcon,
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserAppData } from '../../types/index.ts';
import { Button } from '../ui/Button.tsx';

interface SettingsViewProps {
  currentUser: User | null;
  isCloudSynced: boolean;
  appData: UserAppData;
  onLogin: () => void;
  onLogout: () => void;
  onRestoreData: (data: UserAppData) => void;
  onResetData: () => void;
  onForceSync?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  isCloudSynced,
  appData,
  onLogin,
  onLogout,
  onRestoreData,
  onResetData,
  onForceSync,
}) => {
  const [copiedUid, setCopiedUid] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export JSON backup
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifetrack_hub_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.tasks)) {
          onRestoreData(parsed);
          setSyncStatusMsg('Data imported successfully!');
          setTimeout(() => setSyncStatusMsg(null), 3000);
        } else {
          setSyncStatusMsg('Invalid backup format.');
        }
      } catch (err) {
        console.error('Failed to parse backup:', err);
        setSyncStatusMsg('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleCopyUid = () => {
    if (currentUser?.uid) {
      navigator.clipboard.writeText(currentUser.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Settings & Synchronization
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Account sync, cloud database status, and backup data management.
            </p>
          </div>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Cloud Sync & Account Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-600" />
              <span>Firebase Cloud Synchronization</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sync tasks, habits, transactions, and notes across all your devices in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                isCloudSynced
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCloudSynced ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{isCloudSynced ? 'Connected' : 'Local Storage Only'}</span>
            </span>
          </div>
        </div>

        {currentUser ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-12 h-12 rounded-full border border-slate-300 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {currentUser.displayName || 'Signed In User'}
                </p>
                <p className="text-xs text-slate-500">{currentUser.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-mono text-slate-400">UID:</span>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="text-[11px] font-mono text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    {copiedUid ? 'Copied!' : `${currentUser.uid.slice(0, 10)}...`}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onForceSync && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={onForceSync}
                >
                  Sync Now
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Sign in with Google</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Enable multi-device sync, cloud backup, and seamless Android sync.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<LogIn className="w-4 h-4" />}
              onClick={onLogin}
            >
              Sign In with Google
            </Button>
          </div>
        )}

        {/* Database & Architecture info */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Firestore Database:</span>
            </span>
            <span className="font-mono text-slate-800 font-semibold">
              ai-studio-a7fbef00-eef0-48a1-a3ab-2cd9aa399fbd
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Project ID:</span>
            </span>
            <span className="font-mono text-slate-800">galvanic-oarlock-43skh</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>Multi-Platform Sync:</span>
            </span>
            <span className="text-emerald-700 font-semibold">Web + Android + Desktop KMP</span>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">Data Management & Backup</h2>
        <p className="text-xs text-slate-500">
          Export your complete productivity data as a standard JSON backup, or restore from a previous file.
        </p>

        <div className="flex items-center gap-3 flex-wrap pt-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportJson}
          >
            Export JSON Backup
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON Backup
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />

          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-4 h-4 text-rose-600" />}
            onClick={() => setResetConfirmOpen(true)}
            className="text-rose-600 hover:bg-rose-50"
          >
            Reset Data
          </Button>
        </div>

        {/* Reset Confirmation */}
        {resetConfirmOpen && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to reset your local data?</p>
                <p className="mt-0.5 text-rose-700">
                  This will reload default starter items. If signed in, your cloud backup will be updated.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onResetData();
                  setResetConfirmOpen(false);
                }}
              >
                Yes, Reset All Data
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* App Information */}
      <div className="text-center py-4 text-xs text-slate-400">
        LifeTrack Hub • Personal Operating System • Phase 3A
      </div>
    </div>
  );
};
