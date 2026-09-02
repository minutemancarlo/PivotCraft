import React from 'react';
import { Zap, Database, Layers, Sun, Moon } from 'lucide-react';
import appIcon from '../../public/icon.png';

interface HeaderProps {
  templateName: string;
  rowCount: number;
  latencyMs: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  templateName,
  rowCount,
  latencyMs,
  theme,
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';

  return (
    <header
      className={`px-6 py-3 flex items-center justify-between shadow-sm transition-colors border-b ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <div className="flex items-center space-x-3.5">
        <img
          src={appIcon}
          alt="PivotCraft"
          className="w-8 h-8 rounded-lg shadow-md border border-slate-200/20 object-cover"
        />
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-sm font-bold tracking-tight">PivotCraft</h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isDark
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-sky-50 text-sky-600 border-sky-200'
              }`}
            >
              DUCKDB VECTOR ENGINE
            </span>
          </div>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sub-second Pivot Table extraction &amp; formula calculation for 500k+ data
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* Template Badge */}
        <div
          className={`border rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Template:</span>
          <span className="font-semibold text-sky-500 truncate max-w-[160px]">{templateName}</span>
        </div>

        {/* Rows Badge */}
        <div
          className={`border rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Rows:</span>
          <span className="font-bold text-emerald-500">{rowCount.toLocaleString()}</span>
        </div>

        {/* Latency Badge */}
        <div
          className={`border rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Latency:</span>
          <span className="font-bold text-amber-500">{latencyMs.toFixed(1)} ms</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`border rounded-lg px-2.5 py-1 flex items-center space-x-1.5 text-xs font-semibold transition cursor-pointer ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-indigo-600'
          }`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  );
};