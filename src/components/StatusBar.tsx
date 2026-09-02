import React from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';

interface StatusBarProps {
  statusMessage: string;
  isBusy: boolean;
  latencyMs: number;
  rowCount: number;
  theme: 'dark' | 'light';
}

export const StatusBar: React.FC<StatusBarProps> = ({
  statusMessage,
  isBusy,
  latencyMs,
  rowCount,
  theme,
}) => {
  const isDark = theme === 'dark';

  return (
    <footer
      className={`border-t px-6 py-2 flex items-center justify-between text-xs transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}
    >
      <div className="flex items-center space-x-2 truncate">
        {isBusy ? (
          <Activity className="w-3.5 h-3.5 text-blue-500 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        )}
        <span className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {statusMessage}
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <span className={`text-[10px] hidden md:inline-block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          💡 Hold <kbd className={`px-1 py-0.5 rounded border font-mono text-[9px] ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}>Ctrl</kbd> + Drag / Wheel to Pan Table
        </span>

        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>DuckDB Vector In-Memory</span>
        </div>

        <span>•</span>

        <span className={`font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {rowCount > 0 ? `${rowCount.toLocaleString()} rows` : '0 rows'} | {latencyMs.toFixed(1)} ms
        </span>
      </div>
    </footer>
  );
};