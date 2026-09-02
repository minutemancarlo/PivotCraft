import React from 'react';
import {
  FolderOpen,
  FileText,
  Save,
  PlusSquare,
  MinusSquare,
  FileSpreadsheet,
  Download,
  SlidersHorizontal,
  Table,
  Columns,
  Archive,
  WrapText,
  RotateCcw,
} from 'lucide-react';

interface ActionRibbonProps {
  viewMode: 'pivot' | 'raw';
  onChangeViewMode: (mode: 'pivot' | 'raw') => void;
  onLoadCsv: () => void;
  onLoadTemplate: () => void;
  onSaveTemplate: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onClearAll: () => void;
  isWrapHeaders: boolean;
  onToggleWrapHeaders: () => void;
  onToggleFieldList: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  isBusy: boolean;
  hasData: boolean;
  isFieldListOpen: boolean;
  rowCount: number;
  theme: 'dark' | 'light';
}

export const ActionRibbon: React.FC<ActionRibbonProps> = ({
  viewMode,
  onChangeViewMode,
  onLoadCsv,
  onLoadTemplate,
  onSaveTemplate,
  onSaveProject,
  onLoadProject,
  onClearAll,
  isWrapHeaders,
  onToggleWrapHeaders,
  onToggleFieldList,
  onExpandAll,
  onCollapseAll,
  onExportExcel,
  onExportCsv,
  isBusy,
  hasData,
  isFieldListOpen,
  rowCount,
  theme,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`border-b px-4 py-1.5 flex items-center justify-between shadow-sm transition-colors flex-wrap gap-2 select-none ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50/90 border-slate-200'
      }`}
    >
      {/* Left Command Groups */}
      <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
        {/* Group 1: Data & Workbook Hub */}
        <div
          className={`flex items-center p-0.5 rounded-lg border space-x-1 ${
            isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}
        >
          {/* Load CSV */}
          <button
            onClick={onLoadCsv}
            disabled={isBusy}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
            title="Import Raw CSV Dataset into DuckDB in-memory engine"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Load CSV</span>
          </button>

          {/* Open Workbook (.pvc) */}
          <button
            onClick={onLoadProject}
            disabled={isBusy}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer border ${
              isDark
                ? 'bg-indigo-950/30 hover:bg-indigo-900/50 border-indigo-700/50 text-indigo-300'
                : 'bg-indigo-50/70 hover:bg-indigo-100/90 border-indigo-200 text-indigo-700'
            }`}
            title="Open saved PivotCraft Workbook (.pvc) with dataset, inputs, formulas & layout"
          >
            <Archive className="w-3.5 h-3.5 text-indigo-500" />
            <span>Open Workbook (.pvc)</span>
          </button>

          {/* Save Workbook (.pvc) */}
          <button
            onClick={onSaveProject}
            disabled={isBusy || !hasData}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer border disabled:opacity-40 ${
              isDark
                ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-sm'
                : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-sm'
            }`}
            title="Save complete project package (.pvc) with dataset, manual inputs, and formulas (Ctrl + S)"
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>Save Workbook (.pvc)</span>
          </button>

          {/* Clear All to Load New CSV */}
          <div className={`h-4 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          <button
            onClick={onClearAll}
            disabled={isBusy || (!hasData && rowCount === 0)}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer border disabled:opacity-35 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-rose-950/30 hover:bg-rose-900/50 border-rose-800/40 text-rose-300'
                : 'bg-rose-50/70 hover:bg-rose-100/90 border-rose-200 text-rose-700'
            }`}
            title="Clear current dataset & pivot table, and reset to initial state to load a new CSV"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Clear All</span>
          </button>
        </div>

        {/* Group 2: Template Presets (.json) */}
        <div
          className={`flex items-center p-0.5 rounded-lg border space-x-1 ${
            isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}
        >
          <button
            onClick={onLoadTemplate}
            disabled={isBusy}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer ${
              isDark
                ? 'hover:bg-slate-800 text-slate-300'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Upload Pivot Schema Preset (.json)"
          >
            <FileText className="w-3.5 h-3.5 text-sky-500" />
            <span>Upload Template</span>
          </button>

          <div className={`h-4 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          <button
            onClick={onSaveTemplate}
            disabled={isBusy || !hasData}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-40 ${
              isDark
                ? 'hover:bg-slate-800 text-slate-300'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Save Pivot Schema Preset (.json)"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span>Save Template</span>
          </button>
        </div>

        {/* Group 3: View Mode Switcher */}
        {rowCount > 0 && (
          <div
            className={`flex items-center p-0.5 rounded-lg border space-x-0.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200/60 border-slate-300/80'
            }`}
          >
            <button
              onClick={() => onChangeViewMode('raw')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                viewMode === 'raw'
                  ? isDark
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'bg-white text-sky-700 font-bold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Raw CSV Data</span>
            </button>

            <button
              onClick={() => onChangeViewMode('pivot')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                viewMode === 'pivot'
                  ? isDark
                    ? 'bg-slate-800 text-sky-400 shadow-sm'
                    : 'bg-white text-sky-700 font-bold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Pivot Table</span>
            </button>
          </div>
        )}

        {/* Group 4: Pivot Studio, Header Wrapping & Tree Controls */}
        <div
          className={`flex items-center p-0.5 rounded-lg border space-x-1 ${
            isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}
        >
          {/* Pivot Studio Field List Button */}
          <button
            onClick={onToggleFieldList}
            className={`text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer border ${
              isFieldListOpen
                ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                : isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 text-sky-400 border-slate-700/80'
                : 'bg-sky-50/70 hover:bg-sky-100 text-sky-700 border-sky-200'
            }`}
            title="Open/Close Pivot Studio Field List & Metric Builder"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Pivot Studio</span>
          </button>

          {/* Wrap Headers Toggle */}
          <button
            onClick={onToggleWrapHeaders}
            title="Toggle Multiline Column Header Text Wrapping"
            className={`text-xs font-medium px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer border ${
              isWrapHeaders
                ? isDark
                  ? 'bg-sky-950/50 border-sky-700 text-sky-300'
                  : 'bg-sky-50 border-sky-300 text-sky-700 font-semibold'
                : isDark
                ? 'bg-transparent hover:bg-slate-800/80 border-transparent text-slate-400'
                : 'bg-transparent hover:bg-slate-100 border-transparent text-slate-600'
            }`}
          >
            <WrapText className={`w-3.5 h-3.5 ${isWrapHeaders ? 'text-sky-500' : 'text-slate-400'}`} />
            <span>Wrap Headers</span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                isWrapHeaders
                  ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                  : isDark
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {isWrapHeaders ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Tree Expand / Collapse controls */}
          {viewMode === 'pivot' && (
            <>
              <div className={`h-4 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className="flex items-center space-x-0.5">
                <button
                  onClick={onExpandAll}
                  disabled={!hasData}
                  title="Expand All Hierarchy Groups"
                  className={`disabled:opacity-40 text-xs font-medium px-2 py-1.5 rounded flex items-center space-x-1 transition cursor-pointer ${
                    isDark
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <PlusSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>Expand All</span>
                </button>
                <button
                  onClick={onCollapseAll}
                  disabled={!hasData}
                  title="Collapse All Hierarchy Groups"
                  className={`disabled:opacity-40 text-xs font-medium px-2 py-1.5 rounded flex items-center space-x-1 transition cursor-pointer ${
                    isDark
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <MinusSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Collapse All</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Export Suite */}
      <div
        className={`flex items-center p-0.5 rounded-lg border space-x-1.5 ${
          isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
        }`}
      >
        <button
          onClick={onExportExcel}
          disabled={!hasData || isBusy}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-md flex items-center space-x-2 shadow-sm transition cursor-pointer"
          title="Export pivot table to formatted Excel Workbook (.xlsx) with financial parentheses"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Excel (.xlsx)</span>
        </button>

        <button
          onClick={onExportCsv}
          disabled={!hasData || isBusy}
          className={`border disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition cursor-pointer ${
            isDark
              ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
          }`}
          title="Export pivot table to CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};