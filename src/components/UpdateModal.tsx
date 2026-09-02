import React from 'react';
import { Download, RefreshCw, ExternalLink, X, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  url?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  errorMessage?: string;
  onDownload: () => void;
  onInstall: () => void;
  theme?: 'dark' | 'light';
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  updateInfo,
  progress,
  status,
  errorMessage,
  onDownload,
  onInstall,
  theme = 'dark',
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bps: number) => {
    if (!bps || isNaN(bps)) return '0 KB/s';
    if (bps > 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
    return (bps / 1024).toFixed(0) + ' KB/s';
  };

  const renderReleaseNotes = () => {
    if (!updateInfo?.releaseNotes) {
      return <p className="italic text-xs opacity-75">No release notes provided for this version.</p>;
    }
    if (typeof updateInfo.releaseNotes === 'string') {
      return (
        <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans opacity-90">
          {updateInfo.releaseNotes}
        </div>
      );
    }
    if (Array.isArray(updateInfo.releaseNotes)) {
      return (
        <div className="space-y-2 text-xs">
          {updateInfo.releaseNotes.map((noteItem, idx) => (
            <div key={idx}>
              <div className="font-bold text-sky-400">v{noteItem.version}</div>
              <div className="whitespace-pre-wrap opacity-90">{noteItem.note}</div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-all ${
          isDark
            ? 'bg-slate-900 border-slate-700/70 text-slate-100 shadow-slate-950/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Software Update</h3>
              <p className="text-[11px] opacity-70">
                Current Version: <span className="font-mono font-semibold">v{currentVersion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Version banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="text-xs font-semibold text-sky-400 flex items-center space-x-1.5">
                <span>New Release Available</span>
              </div>
              <div className="text-lg font-extrabold tracking-tight mt-0.5 font-mono text-emerald-400">
                v{updateInfo?.version || 'Latest'}
              </div>
              {updateInfo?.releaseDate && (
                <div className="text-[10px] opacity-60 mt-0.5">
                  Published: {new Date(updateInfo.releaseDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </div>
              )}
            </div>
            {updateInfo?.url && (
              <button
                onClick={() => window.electronAPI?.updater?.openUrl(updateInfo.url!)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 border transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
                }`}
              >
                <span>GitHub Release</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Release Notes */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">What's New:</h4>
            <div
              className={`p-3.5 rounded-xl border max-h-48 overflow-y-auto custom-scrollbar ${
                isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {renderReleaseNotes()}
            </div>
          </div>

          {/* Progress Bar (if downloading) */}
          {status === 'downloading' && progress && (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-sky-400 font-semibold flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Downloading update...</span>
                </span>
                <span className="font-mono">
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)} ({progress.percent.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                />
              </div>
              <div className="text-[11px] text-right opacity-60 font-mono">
                Speed: {formatSpeed(progress.bytesPerSecond)}
              </div>
            </div>
          )}

          {/* Downloaded State */}
          {status === 'downloaded' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center space-x-2.5 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Update downloaded and verified. Restart the app to finish installation.</span>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start space-x-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Update Failed</p>
                <p className="text-[11px] opacity-90 mt-0.5">{errorMessage || 'Unable to download the update package.'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            {status === 'downloaded' ? 'Install on Next Quit' : 'Remind Me Later'}
          </button>

          <div className="flex items-center space-x-2">
            {status === 'downloaded' ? (
              <button
                onClick={onInstall}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center space-x-1.5 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart & Install Now</span>
              </button>
            ) : status === 'downloading' ? (
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-sky-700/50 text-sky-200 text-xs font-semibold flex items-center space-x-1.5 cursor-not-allowed opacity-75"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading ({progress ? progress.percent.toFixed(0) : 0}%)</span>
              </button>
            ) : (
              <button
                onClick={onDownload}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-950/40 flex items-center space-x-1.5 cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Update</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
