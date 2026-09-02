import React, { useState } from 'react';
import { Filter, Plus, X, CheckCircle2, Circle } from 'lucide-react';
import { FilterDefinition } from '../types/pivot.js';
import { SmartFilterInput } from './SmartFilterInput.js';

interface QuickFilterBarProps {
  filters: FilterDefinition[];
  availableColumns: string[];
  distinctCache: Record<string, string[]>;
  onLoadDistinct: (col: string) => Promise<string[]>;
  onAddFilter: (filter: FilterDefinition) => void;
  onUpdateFilter: (index: number, updates: Partial<FilterDefinition>) => void;
  onRemoveFilter: (index: number) => void;
  onClearAllFilters: () => void;
  theme: 'dark' | 'light';
}

export const QuickFilterBar: React.FC<QuickFilterBarProps> = ({
  filters,
  availableColumns,
  distinctCache,
  onLoadDistinct,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearAllFilters,
  theme,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCol, setSelectedCol] = useState(availableColumns[0] || '');
  const [selectedOp, setSelectedOp] = useState<FilterDefinition['operator']>('In');
  const [filterVal, setFilterVal] = useState('');
  const [filterVal2, setFilterVal2] = useState('');

  const isDark = theme === 'dark';

  const handleCreateFilter = () => {
    if (!selectedCol) return;
    onAddFilter({
      column: selectedCol,
      operator: selectedOp,
      value: filterVal,
      value2: filterVal2,
      isEnabled: true,
    });
    setFilterVal('');
    setFilterVal2('');
    setIsAdding(false);
  };

  if (availableColumns.length === 0) return null;

  return (
    <div
      className={`border-b px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}
    >
      <div className="flex items-center flex-wrap gap-2">
        <div className={`flex items-center space-x-1.5 font-semibold mr-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          <Filter className="w-3.5 h-3.5 text-purple-500" />
          <span>Filter Slicers:</span>
        </div>

        {/* Active Filter Chips */}
        {filters.map((f, idx) => (
          <div
            key={idx}
            className={`flex items-center space-x-1.5 border rounded-lg px-2.5 py-1 transition shadow-sm ${
              f.isEnabled
                ? isDark
                  ? 'bg-slate-800/90 border-purple-500/60 text-slate-200'
                  : 'bg-white border-purple-300 text-slate-900 shadow-sm'
                : isDark
                ? 'bg-slate-950/50 border-slate-800 text-slate-500 opacity-60'
                : 'bg-slate-200/60 border-slate-300 text-slate-400 opacity-60'
            }`}
          >
            {/* Toggle Enable/Disable */}
            <button
              onClick={() => onUpdateFilter(idx, { isEnabled: !f.isEnabled })}
              className="text-purple-500 hover:text-purple-400 cursor-pointer"
              title={f.isEnabled ? 'Filter is active (Click to disable)' : 'Filter is disabled (Click to enable)'}
            >
              {f.isEnabled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Column Name */}
            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{f.column}</span>

            {/* Operator Dropdown */}
            <select
              value={f.operator}
              onChange={(e) => onUpdateFilter(idx, { operator: e.target.value as any })}
              className={`border rounded px-1.5 py-0.5 text-[11px] font-semibold outline-none cursor-pointer ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-purple-300'
                  : 'bg-slate-50 border-slate-300 text-purple-700'
              }`}
            >
              <option value="In">Multi-Select (In)</option>
              <option value="Equals">Equals (=)</option>
              <option value="NotEquals">Not Equals (!=)</option>
              <option value="GreaterThan">&gt;</option>
              <option value="GreaterThanOrEqual">&gt;=</option>
              <option value="LessThan">&lt;</option>
              <option value="LessThanOrEqual">&lt;=</option>
              <option value="Between">Between</option>
              <option value="Contains">Contains</option>
              <option value="StartsWith">Starts With</option>
              <option value="IsBlank">Blank</option>
              <option value="IsNotBlank">Not Blank</option>
            </select>

            {/* Smart Value Input */}
            <SmartFilterInput
              column={f.column}
              operator={f.operator}
              value={f.value}
              value2={f.value2}
              onChange={(val, val2) => onUpdateFilter(idx, { value: val, value2: val2 })}
              distinctCache={distinctCache}
              onLoadDistinct={onLoadDistinct}
              theme={theme}
            />

            {/* Delete Filter */}
            <button
              onClick={() => onRemoveFilter(idx)}
              className={`p-0.5 rounded cursor-pointer transition ml-1 ${
                isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-600'
              }`}
              title="Remove filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add Slicer Inline Form */}
        {isAdding ? (
          <div
            className={`flex items-center space-x-1.5 border rounded-lg px-2 py-1 shadow-lg ${
              isDark ? 'bg-slate-950 border-purple-500' : 'bg-white border-purple-400 shadow-md'
            }`}
          >
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className={`border rounded px-2 py-0.5 text-[11px] outline-none cursor-pointer ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <select
              value={selectedOp}
              onChange={(e) => setSelectedOp(e.target.value as any)}
              className={`border rounded px-1.5 py-0.5 text-[11px] font-semibold outline-none cursor-pointer ${
                isDark ? 'bg-slate-900 border-slate-700 text-purple-300' : 'bg-slate-50 border-slate-300 text-purple-700'
              }`}
            >
              <option value="In">Multi-Select (In)</option>
              <option value="Equals">Equals (=)</option>
              <option value="NotEquals">Not Equals (!=)</option>
              <option value="GreaterThan">&gt;</option>
              <option value="LessThan">&lt;</option>
              <option value="Between">Between</option>
              <option value="Contains">Contains</option>
              <option value="StartsWith">Starts With</option>
              <option value="IsBlank">Blank</option>
              <option value="IsNotBlank">Not Blank</option>
            </select>

            <SmartFilterInput
              column={selectedCol}
              operator={selectedOp}
              value={filterVal}
              value2={filterVal2}
              onChange={(val, val2) => {
                setFilterVal(val);
                if (val2 !== undefined) setFilterVal2(val2);
              }}
              distinctCache={distinctCache}
              onLoadDistinct={onLoadDistinct}
              theme={theme}
            />

            <button
              onClick={handleCreateFilter}
              className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer transition ml-1"
            >
              Apply
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className={`p-0.5 cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setSelectedCol(availableColumns[0] || '');
              setSelectedOp('In');
              setIsAdding(true);
            }}
            className={`border border-dashed text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-purple-500 text-purple-300'
                : 'bg-white hover:bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Filter Slicer</span>
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <button
          onClick={onClearAllFilters}
          className={`text-xs transition cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-600'
          }`}
        >
          Clear All ({filters.length})
        </button>
      )}
    </div>
  );
};