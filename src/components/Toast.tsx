import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  theme: 'dark' | 'light';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss, theme }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const isDark = theme === 'dark';

        let icon = <Info className="w-4 h-4 text-sky-400 shrink-0" />;
        let borderClass = isDark ? 'border-sky-500/50' : 'border-sky-400';
        let bgClass = isDark ? 'bg-slate-900/95 text-slate-100' : 'bg-white text-slate-900 shadow-xl';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          borderClass = isDark ? 'border-emerald-500/50' : 'border-emerald-400';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
          borderClass = isDark ? 'border-amber-500/50' : 'border-amber-400';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
          borderClass = isDark ? 'border-rose-500/50' : 'border-rose-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto border rounded-xl p-3.5 flex items-start space-x-3 shadow-2xl transition-all animate-in slide-in-from-bottom-2 duration-200 ${bgClass} ${borderClass}`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold leading-tight">{toast.title}</h4>
              {toast.message && (
                <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className={`p-1 rounded transition cursor-pointer shrink-0 ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};