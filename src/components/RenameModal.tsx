import React, { useState } from 'react';
import { Edit3, X } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  onSave,
  onClose,
  theme = 'dark',
}) => {
  const [name, setName] = useState(currentName);
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`border rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold">Rename Column Header</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Display Name / Alias:
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full border rounded-lg px-3.5 py-2 text-sm font-semibold outline-none focus:border-blue-500 mb-6 ${
              isDark
                ? 'bg-slate-950 border-slate-700 text-sky-400'
                : 'bg-slate-50 border-slate-300 text-blue-600'
            }`}
          />

          <div className="flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};