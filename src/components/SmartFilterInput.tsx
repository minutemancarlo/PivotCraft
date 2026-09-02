import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { FilterDefinition } from '../types/pivot.js';

interface SmartFilterInputProps {
  column: string;
  operator: FilterDefinition['operator'];
  value: string;
  value2?: string;
  onChange: (value: string, value2?: string) => void;
  distinctCache?: Record<string, string[]>;
  onLoadDistinct?: (col: string) => Promise<string[]>;
  theme?: 'dark' | 'light';
}

export const SmartFilterInput: React.FC<SmartFilterInputProps> = ({
  column,
  operator,
  value,
  value2,
  onChange,
  distinctCache = {},
  onLoadDistinct,
  theme = 'dark',
}) => {
  const [distinctValues, setDistinctValues] = useState<string[]>(distinctCache[column] || []);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const isDateCol = /date|time|day|month|year|created|timestamp|valdate|maturity/i.test(column);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (distinctCache[column]) {
        setDistinctValues(distinctCache[column]);
      } else if (onLoadDistinct && column) {
        const vals = await onLoadDistinct(column);
        if (isMounted) {
          setDistinctValues(vals);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [column, distinctCache, onLoadDistinct]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (operator === 'IsBlank' || operator === 'IsNotBlank') {
    return null;
  }

  const inputBg = isDark
    ? 'bg-slate-950 border-slate-700 text-slate-200'
    : 'bg-white border-slate-300 text-slate-900 shadow-sm';

  // 1. Multi-Select Dropdown (Operator === 'In') - Supported for BOTH Date and Non-Date Columns
  if (operator === 'In') {
    const selectedList = value
      ? value.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

    const toggleItem = (itemVal: string) => {
      let nextList: string[];
      if (selectedList.includes(itemVal)) {
        nextList = selectedList.filter((v) => v !== itemVal);
      } else {
        nextList = [...selectedList, itemVal];
      }
      onChange(nextList.join(', '));
    };

    const handleSelectAll = () => {
      onChange(distinctValues.join(', '));
    };

    const handleClearAll = () => {
      onChange('');
    };

    const filteredDistinct = distinctValues.filter((v) =>
      v.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`border hover:border-purple-500 rounded px-2.5 py-0.5 text-xs flex items-center space-x-1.5 min-w-[130px] justify-between cursor-pointer ${inputBg}`}
        >
          <span className="truncate max-w-[100px]">
            {selectedList.length === 0
              ? 'Select values...'
              : selectedList.length === 1
              ? selectedList[0]
              : `${selectedList.length} selected`}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>

        {isOpen && (
          <div
            className={`absolute top-7 left-0 w-60 border rounded-lg shadow-2xl z-50 p-2 text-xs space-y-1.5 ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
            }`}
          >
            {/* Search within dropdown */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className={`w-full border rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-purple-500 ${
                  isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-purple-400 hover:text-purple-300 cursor-pointer font-semibold"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-slate-300 cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Scrollable Items List */}
            <div className="max-h-44 overflow-y-auto space-y-1 pt-1">
              {filteredDistinct.length === 0 ? (
                <div className="text-center py-2 text-slate-500 text-xs">No matching values</div>
              ) : (
                filteredDistinct.map((val) => {
                  const isChecked = selectedList.includes(val);
                  return (
                    <label
                      key={val}
                      className={`flex items-center space-x-2 px-2 py-1 rounded cursor-pointer transition ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(val)}
                        className="accent-purple-500 rounded cursor-pointer"
                      />
                      <span className="truncate">{val}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Date Picker (For Equals, NotEquals, Between, GreaterThan, LessThan on date columns)
  if (isDateCol) {
    if (operator === 'Between') {
      return (
        <div className="flex items-center space-x-1">
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value, value2)}
            className={`border rounded px-2 py-0.5 text-xs outline-none focus:border-purple-500 ${inputBg}`}
          />
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>to</span>
          <input
            type="date"
            value={value2 || ''}
            onChange={(e) => onChange(value, e.target.value)}
            className={`border rounded px-2 py-0.5 text-xs outline-none focus:border-purple-500 ${inputBg}`}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1">
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`border rounded px-2 py-0.5 text-xs outline-none focus:border-purple-500 ${inputBg}`}
        />
        {distinctValues.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
            title="Pick from dataset values"
            className={`border rounded px-1 py-0.5 text-[10px] outline-none cursor-pointer ${inputBg}`}
          >
            <option value="">Choose...</option>
            {distinctValues.slice(0, 30).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // 3. Single-Select Dropdown
  if ((operator === 'Equals' || operator === 'NotEquals') && distinctValues.length > 0) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`border rounded px-2 py-0.5 text-xs outline-none focus:border-purple-500 max-w-[150px] cursor-pointer ${inputBg}`}
      >
        <option value="">(Select value)</option>
        {distinctValues.map((v) => (
          <option key={v} value={v}>
            {v || '(Blank)'}
          </option>
        ))}
      </select>
    );
  }

  // 4. Between
  if (operator === 'Between') {
    return (
      <div className="flex items-center space-x-1">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value, value2)}
          placeholder="Min..."
          className={`w-16 border rounded px-1.5 py-0.5 text-xs outline-none focus:border-purple-500 ${inputBg}`}
        />
        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>to</span>
        <input
          type="text"
          value={value2 || ''}
          onChange={(e) => onChange(value, e.target.value)}
          placeholder="Max..."
          className={`w-16 border rounded px-1.5 py-0.5 text-xs outline-none focus:border-purple-500 ${inputBg}`}
        />
      </div>
    );
  }

  // 5. Standard Text / Number Input
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter value..."
      className={`border rounded px-2 py-0.5 text-xs outline-none focus:border-purple-500 w-28 ${inputBg}`}
    />
  );
};