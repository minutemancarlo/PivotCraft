import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  CheckSquare,
  Square,
  Type,
  Edit2,
  Check,
} from 'lucide-react';
import { PivotTemplate, HierarchyDefinition, ValueMetricDefinition, CalculatedFieldDefinition, FilterDefinition, HeaderGroupDefinition } from '../types/pivot.js';

interface PivotFieldListProps {
  isOpen: boolean;
  onClose: () => void;
  availableColumns: string[];
  template: PivotTemplate;
  onUpdateTemplate: (newTemplate: PivotTemplate) => void;
  theme?: 'dark' | 'light';
}

export const PivotFieldList: React.FC<PivotFieldListProps> = ({
  isOpen,
  onClose,
  availableColumns,
  template,
  onUpdateTemplate,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'rows' | 'values' | 'calcs' | 'bands' | 'filters'>('rows');
  const [searchTerm, setSearchTerm] = useState('');

  // Safe defaults for all template collections
  const rowHierarchy = Array.isArray(template?.rowHierarchy) ? template.rowHierarchy : [];
  const values = Array.isArray(template?.values) ? template.values : [];
  const calculatedFields = Array.isArray(template?.calculatedFields) ? template.calculatedFields : [];
  const filters = Array.isArray(template?.filters) ? template.filters : [];
  const headerGroups = Array.isArray(template?.headerGroups) ? template.headerGroups : [];
  const columnStyles = template?.columnStyles && typeof template.columnStyles === 'object' ? template.columnStyles : {};

  // New Calculated Field State
  const [calcName, setCalcName] = useState('');
  const [calcFormula, setCalcFormula] = useState('');
  const [calcFormat, setCalcFormat] = useState('#,##0');
  const [calcDecimals, setCalcDecimals] = useState<number>(2);
  const [calcIsAlreadyPercent, setCalcIsAlreadyPercent] = useState<boolean>(false);
  const [calcIsEditable, setCalcIsEditable] = useState<boolean>(false);
  const [calcShowTotal, setCalcShowTotal] = useState<boolean>(true);
  const [editingCalcIdx, setEditingCalcIdx] = useState<number | null>(null);
  const [editCalcName, setEditCalcName] = useState('');
  const [editCalcFormula, setEditCalcFormula] = useState('');
  const [editCalcFormat, setEditCalcFormat] = useState('#,##0');
  const [editCalcDecimals, setEditCalcDecimals] = useState<number>(2);
  const [editCalcIsAlreadyPercent, setEditCalcIsAlreadyPercent] = useState<boolean>(false);
  const [editCalcIsEditable, setEditCalcIsEditable] = useState<boolean>(false);
  const [editCalcShowTotal, setEditCalcShowTotal] = useState<boolean>(true);

  // Header Bands (Super-Headers) State
  const [bandLabel, setBandLabel] = useState('');
  const [bandColumns, setBandColumns] = useState<string[]>([]);
  const [bandBgColor, setBandBgColor] = useState('#FEF3C7');
  const [bandTextColor, setBandTextColor] = useState('#78350F');
  const [bandIsBold, setBandIsBold] = useState(true);
  const [bandIsItalic, setBandIsItalic] = useState(false);
  const [bandTextAlign, setBandTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [editBandLabel, setEditBandLabel] = useState('');
  const [editBandColumns, setEditBandColumns] = useState<string[]>([]);
  const [editBandBgColor, setEditBandBgColor] = useState('#FEF3C7');
  const [editBandTextColor, setEditBandTextColor] = useState('#78350F');
  const [editBandIsBold, setEditBandIsBold] = useState(true);
  const [editBandIsItalic, setEditBandIsItalic] = useState(false);
  const [editBandTextAlign, setEditBandTextAlign] = useState<'left' | 'center' | 'right'>('center');

  // New Filter State
  const [newFilterCol, setNewFilterCol] = useState(availableColumns[0] || '');
  const [newFilterOp, setNewFilterOp] = useState<FilterDefinition['operator']>('Equals');
  const [newFilterVal, setNewFilterVal] = useState('');
  const [newFilterVal2, setNewFilterVal2] = useState('');

  if (!isOpen) return null;

  const filteredColumns = availableColumns.filter((c) =>
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Click Whole Chip Handler
  const handleChipClick = (col: string) => {
    if (activeTab === 'values') {
      addValueField(col);
    } else if (activeTab === 'filters') {
      setNewFilterCol(col);
    } else {
      addRowField(col);
    }
  };

  // Row Hierarchy Operations
  const addRowField = (col: string) => {
    if (rowHierarchy.some((r) => r.column === col)) return;
    const updated: PivotTemplate = {
      ...template,
      rowHierarchy: [
        ...rowHierarchy,
        { column: col, alias: col, sortOrder: 'Ascending', subtotal: true, format: 'none' },
      ],
    };
    onUpdateTemplate(updated);
  };

  const removeRowField = (index: number) => {
    const updated = {
      ...template,
      rowHierarchy: rowHierarchy.filter((_, i) => i !== index),
    };
    onUpdateTemplate(updated);
  };

  const updateRowField = (index: number, updates: Partial<HierarchyDefinition>) => {
    const newRows = [...rowHierarchy];
    newRows[index] = { ...newRows[index], ...updates };
    onUpdateTemplate({ ...template, rowHierarchy: newRows });
  };

  const moveRowField = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= rowHierarchy.length) return;
    const newRows = [...rowHierarchy];
    const temp = newRows[index];
    newRows[index] = newRows[newIdx];
    newRows[newIdx] = temp;
    onUpdateTemplate({ ...template, rowHierarchy: newRows });
  };

  const toggleRowSort = (index: number) => {
    const newRows = [...rowHierarchy];
    newRows[index].sortOrder = newRows[index].sortOrder === 'Ascending' ? 'Descending' : 'Ascending';
    onUpdateTemplate({ ...template, rowHierarchy: newRows });
  };

  const toggleRowSubtotal = (index: number) => {
    const newRows = [...rowHierarchy];
    newRows[index].subtotal = !newRows[index].subtotal;
    onUpdateTemplate({ ...template, rowHierarchy: newRows });
  };

  // Value Metric Operations (Default SUM format is standard #,##0)
  const addValueField = (col: string) => {
    const alias = `${col}_Sum`;
    const currentStyles = columnStyles;
    const updated: PivotTemplate = {
      ...template,
      values: [
        ...values,
        {
          column: col,
          aggregation: 'SUM',
          alias,
          format: '#,##0',
          decimalPlaces: 0,
          isAlreadyPercent: false,
          isEditable: true,
          showTotal: true,
        },
      ],
      columnStyles: {
        ...currentStyles,
        [alias]: { ...(currentStyles[alias] || {}), showTotal: true },
      },
    };
    onUpdateTemplate(updated);
  };

  const removeValueField = (index: number) => {
    const updated = {
      ...template,
      values: values.filter((_, i) => i !== index),
    };
    onUpdateTemplate(updated);
  };

  const updateValueField = (index: number, updates: Partial<ValueMetricDefinition>) => {
    const newValues = [...values];
    newValues[index] = { ...newValues[index], ...updates };
    const valKey = newValues[index].alias || `${newValues[index].aggregation}_${newValues[index].column}`;
    const currentStyles = columnStyles;
    const colStyle = currentStyles[valKey] || {};
    onUpdateTemplate({
      ...template,
      values: newValues,
      columnStyles: {
        ...currentStyles,
        ...(updates.showTotal !== undefined ? { [valKey]: { ...colStyle, showTotal: updates.showTotal } } : {}),
      },
    });
  };

  // Calculated Field Operations
  const handleAddCalculatedField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcName.trim()) return;

    const isManualInputOnly = !calcFormula.trim();
    const newCalc: CalculatedFieldDefinition = {
      name: calcName.trim(),
      alias: calcName.trim(),
      formula: calcFormula.trim(),
      format: calcFormat,
      decimalPlaces: calcDecimals,
      isAlreadyPercent: calcIsAlreadyPercent,
      isEditable: isManualInputOnly ? true : calcIsEditable,
      showTotal: calcShowTotal,
    };

    const currentStyles = columnStyles;
    onUpdateTemplate({
      ...template,
      calculatedFields: [...calculatedFields, newCalc],
      columnStyles: {
        ...currentStyles,
        [newCalc.alias || newCalc.name]: { ...(currentStyles[newCalc.alias || newCalc.name] || {}), showTotal: calcShowTotal },
      },
    });

    setCalcName('');
    setCalcFormula('');
    setCalcIsAlreadyPercent(false);
    setCalcIsEditable(false);
    setCalcShowTotal(true);
  };

  const handleStartEditCalc = (idx: number) => {
    const c = calculatedFields[idx];
    if (!c) return;
    setEditingCalcIdx(idx);
    setEditCalcName(c.alias || c.name);
    setEditCalcFormula(c.formula || '');
    setEditCalcFormat(c.format || '#,##0');
    setEditCalcDecimals(c.decimalPlaces !== undefined ? c.decimalPlaces : (c.format === '#,##0' ? 0 : 2));
    setEditCalcIsAlreadyPercent(!!c.isAlreadyPercent);
    setEditCalcIsEditable(!!c.isEditable);
    setEditCalcShowTotal(c.showTotal !== false && (columnStyles[c.alias || c.name]?.showTotal !== false));
  };

  const handleSaveEditCalc = (idx: number) => {
    if (!editCalcName.trim()) return;
    const isManualInputOnly = !editCalcFormula.trim();
    const newCalcs = [...calculatedFields];
    const key = editCalcName.trim();
    newCalcs[idx] = {
      ...newCalcs[idx],
      name: key,
      alias: key,
      formula: editCalcFormula.trim(),
      format: editCalcFormat,
      decimalPlaces: editCalcDecimals,
      isAlreadyPercent: editCalcIsAlreadyPercent,
      isEditable: isManualInputOnly ? true : editCalcIsEditable,
      showTotal: editCalcShowTotal,
    };
    const currentStyles = columnStyles;
    onUpdateTemplate({
      ...template,
      calculatedFields: newCalcs,
      columnStyles: {
        ...currentStyles,
        [key]: { ...(currentStyles[key] || {}), showTotal: editCalcShowTotal },
      },
    });
    setEditingCalcIdx(null);
  };

  const removeCalculatedField = (index: number) => {
    onUpdateTemplate({
      ...template,
      calculatedFields: calculatedFields.filter((_, i) => i !== index),
    });
    if (editingCalcIdx === index) {
      setEditingCalcIdx(null);
    }
  };

  // Header Band (Super-Header) Operations
  const handleAddHeaderBand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bandLabel.trim() || bandColumns.length === 0) return;
    const newBand: HeaderGroupDefinition = {
      id: `band_${Date.now()}`,
      label: bandLabel.trim(),
      columnKeys: bandColumns,
      bgColor: bandBgColor,
      textColor: bandTextColor,
      isBold: bandIsBold,
      isItalic: bandIsItalic,
      textAlign: bandTextAlign,
    };
    onUpdateTemplate({
      ...template,
      headerGroups: [...headerGroups, newBand],
    });
    setBandLabel('');
    setBandColumns([]);
  };

  const handleStartEditBand = (band: HeaderGroupDefinition) => {
    setEditingBandId(band.id);
    setEditBandLabel(band.label);
    setEditBandColumns([...band.columnKeys]);
    setEditBandBgColor(band.bgColor || '#FEF3C7');
    setEditBandTextColor(band.textColor || '#78350F');
    setEditBandIsBold(band.isBold !== false);
    setEditBandIsItalic(!!band.isItalic);
    setEditBandTextAlign(band.textAlign || 'center');
  };

  const handleSaveEditBand = (id: string) => {
    if (!editBandLabel.trim() || editBandColumns.length === 0) return;
    const updated = headerGroups.map((b) =>
      b.id === id
        ? {
            ...b,
            label: editBandLabel.trim(),
            columnKeys: editBandColumns,
            bgColor: editBandBgColor,
            textColor: editBandTextColor,
            isBold: editBandIsBold,
            isItalic: editBandIsItalic,
            textAlign: editBandTextAlign,
          }
        : b
    );
    onUpdateTemplate({ ...template, headerGroups: updated });
    setEditingBandId(null);
  };

  const handleDeleteBand = (id: string) => {
    onUpdateTemplate({
      ...template,
      headerGroups: headerGroups.filter((b) => b.id !== id),
    });
    if (editingBandId === id) setEditingBandId(null);
  };

  // Filter Operations
  const handleAddFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterCol) return;

    const newFilter: FilterDefinition = {
      column: newFilterCol,
      operator: newFilterOp,
      value: newFilterVal,
      value2: newFilterVal2,
      isEnabled: true,
    };

    onUpdateTemplate({
      ...template,
      filters: [...filters, newFilter],
    });

    setNewFilterVal('');
    setNewFilterVal2('');
  };

  const removeFilter = (index: number) => {
    onUpdateTemplate({
      ...template,
      filters: template.filters.filter((_, i) => i !== index),
    });
  };

  const toggleFilter = (index: number) => {
    const newFilters = [...template.filters];
    newFilters[index].isEnabled = !newFilters[index].isEnabled;
    onUpdateTemplate({ ...template, filters: newFilters });
  };

    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('pivotcraft_sidebar_width');
    return saved ? Math.max(340, Math.min(650, parseInt(saved, 10))) : 420;
  });
  const resizingRef = React.useRef<{ startX: number; startW: number } | null>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { startX: e.clientX, startW: sidebarWidth };

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = resizingRef.current.startX - moveEvt.clientX;
      const newW = Math.max(320, Math.min(650, resizingRef.current.startW + delta));
      setSidebarWidth(newW);
      window.dispatchEvent(new Event('resize'));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      localStorage.setItem('pivotcraft_sidebar_width', String(sidebarWidth));
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const cardBg = isDark
    ? 'bg-slate-800/90 border-slate-700'
    : 'bg-white border-slate-200 shadow-sm';

  const formBg = isDark
    ? 'bg-slate-950 border-slate-800'
    : 'bg-slate-50 border-slate-200';

  const inputBg = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-slate-300 text-slate-900 shadow-sm';

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className={`shrink-0 border-l flex flex-col h-full min-h-0 relative select-text transition-colors duration-150 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
      }`}
    >
      {/* Left Edge Resize Handle */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 group flex items-center justify-center hover:bg-sky-500/20 transition-colors select-none"
        title="Drag to resize Pivot Studio sidebar"
      >
        <div className="w-[2px] h-8 rounded-full bg-slate-600 group-hover:bg-sky-400 transition-colors" />
      </div>

      {/* Sidebar Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between transition-colors shrink-0 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-sky-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Pivot Studio</h2>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded transition cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Collapse Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Available Columns Palette */}
      <div
        className={`p-4 border-b transition-colors ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Available Columns (Click to Add to {activeTab === 'values' ? 'Values' : 'Rows'})
          </span>
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {availableColumns.length} fields
          </span>
        </div>
        <input
          type="text"
          placeholder="Search columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-sky-500 mb-2.5 ${inputBg}`}
        />
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {filteredColumns.length === 0 ? (
            <span className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              No columns detected. Load a CSV first.
            </span>
          ) : (
            filteredColumns.map((col) => {
              const isAddedToRows = rowHierarchy.some((r) => r.column === col);
              const isAddedToVals = values.some((v) => v.column === col);

              return (
                <button
                  key={col}
                  onClick={() => handleChipClick(col)}
                  title={`Click to add "${col}" to ${activeTab === 'values' ? 'Values' : 'Rows'}`}
                  className={`border rounded-full px-3 py-1 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer shadow-sm ${
                    isAddedToRows
                      ? isDark
                        ? 'bg-sky-950/70 border-sky-600 text-sky-300 hover:bg-sky-900/80'
                        : 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
                      : isAddedToVals
                      ? isDark
                        ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 hover:bg-emerald-900/80'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm'
                  }`}
                >
                  <Plus className="w-3 h-3 text-slate-400" />
                  <span>{col}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Pivot Zone Tabs */}
      <div
        className={`flex border-b text-xs font-semibold transition-colors ${
          isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          onClick={() => setActiveTab('rows')}
          className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
            activeTab === 'rows'
              ? isDark
                ? 'border-sky-500 text-sky-400 bg-slate-800/40'
                : 'border-sky-600 text-sky-700 bg-white shadow-sm'
              : isDark
              ? 'border-transparent text-slate-400 hover:text-slate-200'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🪜 Rows ({rowHierarchy.length})
        </button>
        <button
          onClick={() => setActiveTab('values')}
          className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
            activeTab === 'values'
              ? isDark
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-emerald-600 text-emerald-700 bg-white shadow-sm'
              : isDark
              ? 'border-transparent text-slate-400 hover:text-slate-200'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          📊 Values ({values.length})
        </button>
        <button
          onClick={() => setActiveTab('calcs')}
          className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
            activeTab === 'calcs'
              ? isDark
                ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                : 'border-amber-600 text-amber-700 bg-white shadow-sm'
              : isDark
              ? 'border-transparent text-slate-400 hover:text-slate-200'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🧮 Formulas ({calculatedFields.length})
        </button>
        <button
          onClick={() => setActiveTab('bands')}
          className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
            activeTab === 'bands'
              ? isDark
                ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
                : 'border-indigo-600 text-indigo-700 bg-white shadow-sm'
              : isDark
              ? 'border-transparent text-slate-400 hover:text-slate-200'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🏷️ Bands ({headerGroups.length})
        </button>
        <button
          onClick={() => setActiveTab('filters')}
          className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
            activeTab === 'filters'
              ? isDark
                ? 'border-purple-500 text-purple-400 bg-slate-800/40'
                : 'border-purple-600 text-purple-700 bg-white shadow-sm'
              : isDark
              ? 'border-transparent text-slate-400 hover:text-slate-200'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          🗂️ Filters ({filters.length})
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {/* 1. ROWS HIERARCHY TAB */}
        {activeTab === 'rows' && (
          <div className="space-y-3">
            <div className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Organize nesting levels, configure <strong>text/date/number formatting</strong>, sorting, and subtotals.
            </div>

            {rowHierarchy.length === 0 ? (
              <div
                className={`p-4 border border-dashed rounded-lg text-center text-xs ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-500'
                }`}
              >
                No row hierarchy fields added. Click any column chip above to add it to Rows.
              </div>
            ) : (
              rowHierarchy.map((r, idx) => (
                <div
                  key={r.column}
                  className={`border rounded-lg p-3 flex flex-col space-y-2.5 ${cardBg}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col flex-1 mr-2 min-w-0">
                      <div className="flex items-center space-x-2 w-full">
                        <span
                          className={`w-5 h-5 text-xs font-bold rounded flex items-center justify-center shrink-0 ${
                            isDark ? 'bg-sky-600/20 text-sky-400' : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={r.alias || r.column}
                          onChange={(e) => updateRowField(idx, { alias: e.target.value })}
                          className={`bg-transparent border-b border-transparent hover:border-slate-400 focus:border-sky-500 text-xs font-bold outline-none w-full truncate ${
                            isDark ? 'text-slate-100' : 'text-slate-900'
                          }`}
                          title="Click to rename row header"
                        />
                      </div>
                      <span className={`text-[10px] ml-7 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Original column: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>"{r.column}"</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => moveRowField(idx, 'up')}
                        disabled={idx === 0}
                        className={`p-1 disabled:opacity-30 cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveRowField(idx, 'down')}
                        disabled={idx === template.rowHierarchy.length - 1}
                        className={`p-1 disabled:opacity-30 cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeRowField(idx)}
                        className="p-1 text-red-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Row Formatting Selector */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`block text-[10px] mb-1 flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <Type className="w-3 h-3 text-sky-500" />
                        <span>Row Format / Case:</span>
                      </label>
                      <select
                        value={r.format || 'none'}
                        onChange={(e) => updateRowField(idx, { format: e.target.value })}
                        className={`w-full border rounded px-2 py-1 font-medium outline-none text-xs ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-sky-300'
                            : 'bg-slate-50 border-slate-300 text-sky-700'
                        }`}
                      >
                        <option value="none">Default (Original)</option>
                        <option value="uppercase">UPPERCASE</option>
                        <option value="lowercase">lowercase</option>
                        <option value="capitalize">Title Case / Capitalized</option>
                        <option value="date_ymd">Date: YYYY-MM-DD</option>
                        <option value="date_month_year">Date: Month Year (Jan 2024)</option>
                        <option value="date_quarter">Date: Quarter (Q1 2024)</option>
                        <option value="date_year">Date: Year Only (YYYY)</option>
                        <option value="#,##0">Standard Number (#,##0)</option>
                        <option value="₱#,##0.00">Peso Currency (₱#,##0.00)</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Sort Order:</label>
                      <select
                        value={r.sortOrder || 'Ascending'}
                        onChange={(e) => updateRowField(idx, { sortOrder: e.target.value as any })}
                        className={`w-full border rounded px-2 py-1 outline-none text-xs ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-200'
                            : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="Ascending">Ascending (O/N ➔ 1Y, 1 ➔ 10, A ➔ Z)</option>
                        <option value="Descending">Descending (1Y ➔ O/N, 10 ➔ 1, Z ➔ A)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subtotal & Total Word Options */}
                  <div className={`pt-2 border-t flex items-center justify-between flex-wrap gap-2 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                    <button
                      onClick={() => toggleRowSubtotal(idx)}
                      className={`flex items-center space-x-1.5 text-xs cursor-pointer ${
                        isDark ? 'text-slate-300 hover:text-emerald-400' : 'text-slate-700 hover:text-emerald-600'
                      }`}
                    >
                      {r.subtotal ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>Include Subtotal</span>
                    </button>

                    <button
                      onClick={() => updateRowField(idx, { appendTotalWord: r.appendTotalWord === false ? true : false })}
                      className={`flex items-center space-x-1.5 text-xs cursor-pointer ${
                        isDark ? 'text-slate-300 hover:text-amber-400' : 'text-slate-700 hover:text-amber-600'
                      }`}
                      title="When checked, subtotal displays 'USD Total'. When unchecked, displays 'USD'."
                    >
                      {r.appendTotalWord !== false ? <CheckSquare className="w-3.5 h-3.5 text-amber-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>Append "Total" to label</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. VALUES & METRICS TAB */}
        {activeTab === 'values' && (
          <div className="space-y-3">
            <div className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Configure aggregations, display formatting, and <strong>cell editability</strong>.
            </div>

            {values.length === 0 ? (
              <div
                className={`p-4 border border-dashed rounded-lg text-center text-xs ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-500'
                }`}
              >
                No value metrics selected. Click any column chip above to aggregate it.
              </div>
            ) : (
              values.map((v, idx) => (
                <div key={idx} className={`border rounded-lg p-3 space-y-2.5 ${cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col flex-1 mr-2 min-w-0">
                      <input
                        type="text"
                        value={v.alias || `${v.aggregation}_${v.column}`}
                        onChange={(e) => updateValueField(idx, { alias: e.target.value })}
                        className={`bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-500 text-xs font-bold outline-none w-full truncate ${
                          isDark ? 'text-slate-100' : 'text-slate-900'
                        }`}
                        title="Click to rename metric"
                      />
                      <span className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Source field: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>"{v.column}"</strong> ({v.aggregation})
                      </span>
                    </div>

                    <button onClick={() => removeValueField(idx)} className="text-red-500 hover:text-red-400 p-1 cursor-pointer shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Aggregation:</label>
                      <select
                        value={v.aggregation}
                        onChange={(e) => updateValueField(idx, { aggregation: e.target.value as any })}
                        className={`w-full border rounded px-2 py-1 font-semibold outline-none text-xs ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-emerald-400'
                            : 'bg-slate-50 border-slate-300 text-emerald-700'
                        }`}
                      >
                        <option value="SUM">SUM</option>
                        <option value="COUNT">COUNT</option>
                        <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                        <option value="AVERAGE">AVERAGE</option>
                        <option value="MIN">MIN</option>
                        <option value="MAX">MAX</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Format:</label>
                      <select
                        value={v.format || '#,##0'}
                        onChange={(e) => updateValueField(idx, { format: e.target.value })}
                        className={`w-full border rounded px-2 py-1 outline-none text-xs ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-200'
                            : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="#,##0">Number (#,##0)</option>
                        <option value="₱#,##0.00">Peso (₱#,##0.00)</option>
                        <option value="0.0%">Percent (0.0%)</option>
                        <option value="0.000">Precision: No Commas (0.000)</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Display Decimals <span className="text-[9px] opacity-75">(Display Only)</span>:
                      </label>
                      <select
                        value={v.decimalPlaces !== undefined ? v.decimalPlaces : (v.format === '#,##0' ? 0 : 2)}
                        onChange={(e) => updateValueField(idx, { decimalPlaces: parseInt(e.target.value, 10) })}
                        className={`w-full border rounded px-2 py-1 outline-none text-xs ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-sky-300'
                            : 'bg-slate-50 border-slate-300 text-sky-700'
                        }`}
                        title="Display formatting only; calculations always preserve full unrounded precision"
                      >
                        <option value={0}>0 (1234)</option>
                        <option value={1}>1 (1234.5)</option>
                        <option value={2}>2 (1234.56)</option>
                        <option value={3}>3 (1234.567)</option>
                        <option value={4}>4 (1234.5678)</option>
                        <option value={5}>5 (1234.56789)</option>
                        <option value={6}>6 (1234.567890)</option>
                      </select>
                    </div>
                  </div>

                  {/* Percentage multiplier option */}
                  {(v.format?.includes('%') || v.format === '0.0%') && (
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id={`val-pct-${idx}`}
                        checked={!!v.isAlreadyPercent}
                        onChange={(e) => updateValueField(idx, { isAlreadyPercent: e.target.checked })}
                        className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                      />
                      <label htmlFor={`val-pct-${idx}`} className={`text-[11px] cursor-pointer ${isDark ? 'text-amber-300 font-medium' : 'text-amber-800 font-medium'}`}>
                        Values already multiplied by 100 (e.g. 15 = 15%)
                      </label>
                    </div>
                  )}

                  {/* Additional Value Formula / Modifier */}
                  <div className="pt-1">
                    <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Additional Formula / Modifier (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. [val] * 1.12 or [val] / 1000"
                      value={v.formulaModifier || ''}
                      onChange={(e) => updateValueField(idx, { formulaModifier: e.target.value })}
                      className={`w-full border rounded px-2.5 py-1 text-xs font-mono outline-none focus:border-amber-500 ${
                        isDark ? 'bg-slate-950 border-slate-700 text-amber-400' : 'bg-white border-slate-300 text-amber-700'
                      }`}
                    />
                    <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Apply formula to aggregated result (e.g. <code className="font-mono text-amber-500">[val] * 1.12</code> for +12% tax, or <code className="font-mono text-amber-500">/ 1000</code>)
                    </span>
                  </div>

                  {/* Total & Cell Editing Toggles */}
                  <div className={`pt-2 border-t flex flex-col space-y-2 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                    <label className={`text-xs flex items-center space-x-2 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <input
                        type="checkbox"
                        checked={v.showTotal !== false && (columnStyles[v.alias || `${v.aggregation}_${v.column}`]?.showTotal !== false)}
                        onChange={(e) => updateValueField(idx, { showTotal: e.target.checked })}
                        className="w-3.5 h-3.5 accent-sky-500 rounded cursor-pointer"
                      />
                      <span>Show Total in Column (Grand Total / Subtotals)</span>
                    </label>

                    <label className={`text-xs flex items-center space-x-2 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <input
                        type="checkbox"
                        checked={v.isEditable !== false}
                        onChange={(e) => updateValueField(idx, { isEditable: e.target.checked })}
                        className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                      />
                      <span className="font-semibold text-emerald-500">Allow Direct Cell Editing</span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. CALCULATED FIELDS TAB */}
        {activeTab === 'calcs' && (
          <div className="space-y-4">
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Create dynamic formula columns (e.g. <code className="text-sky-500 font-mono">[Revenue] - [Cost]</code>).
            </div>

            {/* Existing Calculated Fields */}
            {calculatedFields.length === 0 ? (
              <div
                className={`p-3 border border-dashed rounded-lg text-center text-xs ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-500'
                }`}
              >
                No custom formulas created yet. Use the form below to add calculated fields.
              </div>
            ) : (
              calculatedFields.map((c, idx) => {
                const isEditingThis = editingCalcIdx === idx;

                if (isEditingThis) {
                  return (
                    <div key={idx} className={`border rounded-lg p-3 space-y-2.5 shadow-lg ${
                      isDark ? 'bg-slate-950 border-amber-500/80' : 'bg-white border-amber-400'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500">Edit Formula</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleSaveEditCalc(idx)}
                            className="p-1 bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer font-bold"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingCalcIdx(null)}
                            className={`p-1 cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Column Name / Alias:</label>
                        <input
                          type="text"
                          value={editCalcName}
                          onChange={(e) => setEditCalcName(e.target.value)}
                          className={`w-full border rounded px-2 py-1 text-xs outline-none focus:border-amber-500 ${inputBg}`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Formula Expression <span className="text-emerald-500 font-semibold">(Optional for Manual Cell Input)</span>:
                          </label>
                        </div>
                        {/* Quick Function Chips */}
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {['ABS', 'ROUND', 'IF', 'IFERROR', 'DAYSINMONTH', 'DAY', 'DAYS', 'MAX', 'MIN', 'AVG', 'POW', '[Row]'].map((fn) => (
                            <button
                              key={fn}
                              type="button"
                              onClick={() => {
                                const addition = fn.startsWith('[') ? fn : `${fn}()`;
                                setEditCalcFormula((prev) => (prev ? `${prev} + ${addition}` : addition));
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer border ${
                                fn === 'DAYSINMONTH' || fn === '[Row]'
                                  ? isDark
                                    ? 'bg-amber-950/60 border-amber-600 text-amber-300 hover:bg-amber-900'
                                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                  : isDark
                                  ? 'bg-slate-900 border-slate-700 text-sky-400 hover:bg-slate-800 hover:border-sky-500'
                                  : 'bg-slate-100 border-slate-300 text-sky-700 hover:bg-slate-200 hover:border-sky-500'
                              }`}
                              title={fn === '[Row]' ? 'Insert [Row] label' : `Insert ${fn}() function`}
                            >
                              {fn}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. [Revenue] / DAYSINMONTH([Row]) or ROUND([Total] * 1.12, 2)"
                          value={editCalcFormula}
                          onChange={(e) => setEditCalcFormula(e.target.value)}
                          className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-500 ${
                            isDark ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-300 text-amber-700'
                          }`}
                        />
                        <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          💡 Functions supported: <code className="font-mono text-amber-400">DAYSINMONTH([Row])</code>, <code className="font-mono text-sky-400">ROUND(x, n)</code>, <code className="font-mono text-sky-400">IF(cond, a, b)</code>, <code className="font-mono text-sky-400">IFERROR(x, fallback)</code>, <code className="font-mono text-sky-400">DAY()</code>, <code className="font-mono text-sky-400">ABS()</code>, etc.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Format:</label>
                          <select
                            value={editCalcFormat}
                            onChange={(e) => setEditCalcFormat(e.target.value)}
                            className={`w-full border rounded px-2 py-1 text-xs outline-none ${inputBg}`}
                          >
                            <option value="#,##0">Number (#,##0)</option>
                            <option value="₱#,##0.00">Peso (₱#,##0.00)</option>
                            <option value="0.0%">Percentage (0.0%)</option>
                            <option value="0.000">Precision: No Commas (0.000)</option>
                            <option value="text">Text Result</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Display Decimals <span className="text-[9px] opacity-75">(Display Only)</span>:
                          </label>
                          <select
                            value={editCalcDecimals}
                            onChange={(e) => setEditCalcDecimals(parseInt(e.target.value, 10))}
                            className={`w-full border rounded px-2 py-1 text-xs outline-none ${inputBg}`}
                            title="Display formatting only; calculations always preserve full unrounded precision"
                          >
                            <option value={0}>0 (1234)</option>
                            <option value={1}>1 (1234.5)</option>
                            <option value={2}>2 (1234.56)</option>
                            <option value={3}>3 (1234.567)</option>
                            <option value={4}>4 (1234.5678)</option>
                            <option value={5}>5 (1234.56789)</option>
                            <option value={6}>6 (1234.567890)</option>
                          </select>
                        </div>
                      </div>

                      {/* Percentage Multiplier option in edit */}
                      {(editCalcFormat?.includes('%') || editCalcFormat === '0.0%') && (
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="checkbox"
                            id={`edit-calc-pct-${idx}`}
                            checked={editCalcIsAlreadyPercent}
                            onChange={(e) => setEditCalcIsAlreadyPercent(e.target.checked)}
                            className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                          />
                          <label htmlFor={`edit-calc-pct-${idx}`} className={`text-[11px] cursor-pointer ${isDark ? 'text-amber-300 font-medium' : 'text-amber-800 font-medium'}`}>
                            Result already multiplied by 100 (e.g. 15 = 15%)
                          </label>
                        </div>
                      )}

                      {/* Allow Direct Cell Input / Editing Toggle in Edit Form */}
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          type="checkbox"
                          id={`edit-calc-editable-${idx}`}
                          checked={editCalcIsEditable}
                          onChange={(e) => setEditCalcIsEditable(e.target.checked)}
                          className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                        />
                        <label htmlFor={`edit-calc-editable-${idx}`} className={`text-[11px] cursor-pointer font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Allow Direct Cell Input / Editing (Interactive Field in Grid)
                        </label>
                      </div>

                      {/* Show Total in Column in Edit Form */}
                      <div className="flex items-center space-x-2 pt-0.5">
                        <input
                          type="checkbox"
                          id={`edit-calc-showtotal-${idx}`}
                          checked={editCalcShowTotal}
                          onChange={(e) => setEditCalcShowTotal(e.target.checked)}
                          className="w-3.5 h-3.5 accent-sky-500 rounded cursor-pointer"
                        />
                        <label htmlFor={`edit-calc-showtotal-${idx}`} className={`text-[11px] cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Show Total in Column (Grand Total & Subtotals)
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveEditCalc(idx)}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-1 rounded text-xs transition cursor-pointer"
                      >
                        Save Formula Updates
                      </button>
                    </div>
                  );
                }

                const isTotalHidden = c.showTotal === false || columnStyles[c.alias || c.name]?.showTotal === false;

                return (
                  <div key={idx} className={`border rounded-lg p-3 space-y-1.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-amber-500">{c.alias || c.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            isDark
                              ? 'text-slate-400 bg-slate-900 border-slate-800'
                              : 'text-slate-600 bg-slate-100 border-slate-200'
                          }`}
                        >
                          {c.format === '₱#,##0.00' ? '₱ Peso' : c.format === '0.0%' ? '%' : 'Number'} ({c.decimalPlaces !== undefined ? `${c.decimalPlaces} dec` : '2 dec'})
                        </span>
                        {c.isEditable && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold">
                            ✏️ Editable
                          </span>
                        )}
                        {isTotalHidden && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold">
                            🚫 Totals Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartEditCalc(idx)}
                          className={`p-1 cursor-pointer ${isDark ? 'text-slate-400 hover:text-amber-400' : 'text-slate-500 hover:text-amber-600'}`}
                          title="Edit Formula"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeCalculatedField(idx)}
                          className="text-red-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Delete Formula"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`border rounded px-2.5 py-1 text-xs font-mono truncate ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {c.formula && c.formula.trim() ? (
                        c.formula
                      ) : (
                        <span className="italic text-emerald-500 font-sans font-medium">
                          📝 Interactive Cell Input Field (No formula)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Add New Calculated Field Form */}
            <form onSubmit={handleAddCalculatedField} className={`border rounded-lg p-3.5 space-y-3 ${formBg}`}>
              <span className={`text-xs font-bold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                + Add Calculated / Custom Input Column
              </span>

              <div>
                <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Column Name / Alias:</label>
                <input
                  type="text"
                  placeholder="e.g. Net Profit, Target Rate, or Manual Adj"
                  value={calcName}
                  onChange={(e) => setCalcName(e.target.value)}
                  className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-amber-500 ${inputBg}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Formula Expression <span className="text-emerald-500 font-semibold">(Optional for Manual Cell Input)</span>:
                  </label>
                </div>
                {/* Quick Function Chips */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {['ABS', 'ROUND', 'IF', 'IFERROR', 'DAYSINMONTH', 'DAY', 'DAYS', 'MAX', 'MIN', 'AVG', 'POW', '[Row]'].map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => {
                        const addition = fn.startsWith('[') ? fn : `${fn}()`;
                        setCalcFormula((prev) => (prev ? `${prev} + ${addition}` : addition));
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer border ${
                        fn === 'DAYSINMONTH' || fn === '[Row]'
                          ? isDark
                            ? 'bg-amber-950/60 border-amber-600 text-amber-300 hover:bg-amber-900'
                            : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                          : isDark
                          ? 'bg-slate-900 border-slate-700 text-sky-400 hover:bg-slate-800 hover:border-sky-500'
                          : 'bg-slate-100 border-slate-300 text-sky-700 hover:bg-slate-200 hover:border-sky-500'
                      }`}
                      title={fn === '[Row]' ? 'Insert [Row] label' : `Insert ${fn}() function`}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. [Revenue] / DAYSINMONTH([Row]) or ROUND([Total] * 1.12, 2)"
                  value={calcFormula}
                  onChange={(e) => setCalcFormula(e.target.value)}
                  className={`w-full border rounded px-2.5 py-1 text-xs font-mono outline-none focus:border-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-300 text-amber-700'
                  }`}
                />
                <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  💡 Functions supported: <code className="font-mono text-amber-400">DAYSINMONTH([Row])</code>, <code className="font-mono text-sky-400">ROUND(x, n)</code>, <code className="font-mono text-sky-400">IF(cond, a, b)</code>, <code className="font-mono text-sky-400">IFERROR(x, fallback)</code>, <code className="font-mono text-sky-400">DAY()</code>, <code className="font-mono text-sky-400">ABS()</code>, etc. (Leave blank for pure cell input)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Format:</label>
                  <select
                    value={calcFormat}
                    onChange={(e) => setCalcFormat(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1 text-xs outline-none ${inputBg}`}
                  >
                    <option value="#,##0">Number (#,##0)</option>
                    <option value="₱#,##0.00">Peso (₱#,##0.00)</option>
                    <option value="0.0%">Percentage (0.0%)</option>
                    <option value="0.000">Precision: No Commas (0.000)</option>
                    <option value="text">Text Result</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Display Decimals <span className="text-[9px] opacity-75">(Display Only)</span>:
                  </label>
                  <select
                    value={calcDecimals}
                    onChange={(e) => setCalcDecimals(parseInt(e.target.value, 10))}
                    className={`w-full border rounded px-2.5 py-1 text-xs outline-none ${inputBg}`}
                    title="Display formatting only; calculations always preserve full unrounded precision"
                  >
                    <option value={0}>0 (1234)</option>
                    <option value={1}>1 (1234.5)</option>
                    <option value={2}>2 (1234.56)</option>
                    <option value={3}>3 (1234.567)</option>
                    <option value={4}>4 (1234.5678)</option>
                    <option value={5}>5 (1234.56789)</option>
                    <option value={6}>6 (1234.567890)</option>
                  </select>
                </div>
              </div>

              {/* Percentage Multiplier option in add */}
              {(calcFormat?.includes('%') || calcFormat === '0.0%') && (
                <div className="flex items-center space-x-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="new-calc-pct"
                    checked={calcIsAlreadyPercent}
                    onChange={(e) => setCalcIsAlreadyPercent(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                  />
                  <label htmlFor="new-calc-pct" className={`text-[11px] cursor-pointer ${isDark ? 'text-amber-300 font-medium' : 'text-amber-800 font-medium'}`}>
                    Result already multiplied by 100 (e.g. 15 = 15%)
                  </label>
                </div>
              )}

              {/* Allow Direct Cell Input / Editing Toggle in Add Form */}
              <div className="flex items-center space-x-2 pt-0.5">
                <input
                  type="checkbox"
                  id="new-calc-editable"
                  checked={calcIsEditable}
                  onChange={(e) => setCalcIsEditable(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                />
                <label htmlFor="new-calc-editable" className={`text-[11px] cursor-pointer font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  Allow Direct Cell Input / Editing (Interactive Field in Grid)
                </label>
              </div>

              {/* Show Total in Column in Add Form */}
              <div className="flex items-center space-x-2 pt-0.5">
                <input
                  type="checkbox"
                  id="new-calc-showtotal"
                  checked={calcShowTotal}
                  onChange={(e) => setCalcShowTotal(e.target.checked)}
                  className="w-3.5 h-3.5 accent-sky-500 rounded cursor-pointer"
                />
                <label htmlFor="new-calc-showtotal" className={`text-[11px] cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Show Total in Column (Grand Total & Subtotals)
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 rounded text-xs transition cursor-pointer"
              >
                Add Calculated Column
              </button>
            </form>
          </div>
        )}

        {/* 4. HEADER BANDS / SUPER-HEADERS TAB */}
        {activeTab === 'bands' && (
          <div className="space-y-4">
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Group multiple columns under a shared merged banner / super-header label with custom background and font styling.
            </div>

            {/* Existing Bands */}
            {headerGroups.length === 0 ? (
              <div
                className={`p-3 border border-dashed rounded-lg text-center text-xs ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-500'
                }`}
              >
                No header bands created yet. Use the form below to create a super-header group.
              </div>
            ) : (
              headerGroups.map((b) => {
                const isEditingThis = editingBandId === b.id;

                if (isEditingThis) {
                  return (
                    <div
                      key={b.id}
                      className={`border rounded-lg p-3.5 space-y-3 shadow-lg ${
                        isDark ? 'bg-slate-950 border-indigo-500/80' : 'bg-white border-indigo-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-500">Edit Header Band</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleSaveEditBand(b.id)}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer font-bold"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingBandId(null)}
                            className={`p-1 cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Banner Label:</label>
                        <input
                          type="text"
                          value={editBandLabel}
                          onChange={(e) => setEditBandLabel(e.target.value)}
                          className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-indigo-500 ${inputBg}`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Covered Columns (Select at least one):</label>
                        <div className={`border rounded p-2 max-h-32 overflow-y-auto space-y-1 ${inputBg}`}>
                          {[
                            ...values.map((v) => v.alias || `${v.aggregation}_${v.column}`),
                            ...calculatedFields.map((c) => c.alias || c.name),
                          ].map((colKey) => {
                            const isChecked = editBandColumns.includes(colKey);
                            return (
                              <label key={colKey} className={`flex items-center space-x-2 text-xs cursor-pointer ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditBandColumns([...editBandColumns, colKey]);
                                    } else {
                                      setEditBandColumns(editBandColumns.filter((k) => k !== colKey));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                                />
                                <span className="font-mono">{colKey}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Color styling */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Banner Background:</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={editBandBgColor}
                              onChange={(e) => setEditBandBgColor(e.target.value)}
                              className="w-7 h-7 rounded border border-slate-600 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={editBandBgColor}
                              onChange={(e) => setEditBandBgColor(e.target.value)}
                              className={`flex-1 border rounded px-2 py-1 text-xs font-mono outline-none ${inputBg}`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Text Color:</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={editBandTextColor}
                              onChange={(e) => setEditBandTextColor(e.target.value)}
                              className="w-7 h-7 rounded border border-slate-600 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={editBandTextColor}
                              onChange={(e) => setEditBandTextColor(e.target.value)}
                              className={`flex-1 border rounded px-2 py-1 text-xs font-mono outline-none ${inputBg}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Alignment and Font Weight */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-3">
                          <label className={`text-xs flex items-center space-x-1.5 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            <input
                              type="checkbox"
                              checked={editBandIsBold}
                              onChange={(e) => setEditBandIsBold(e.target.checked)}
                              className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                            />
                            <span className="font-bold">Bold</span>
                          </label>

                          <label className={`text-xs flex items-center space-x-1.5 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            <input
                              type="checkbox"
                              checked={editBandIsItalic}
                              onChange={(e) => setEditBandIsItalic(e.target.checked)}
                              className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                            />
                            <span className="italic">Italic</span>
                          </label>
                        </div>

                        <div className="flex items-center space-x-1">
                          {['left', 'center', 'right'].map((al) => (
                            <button
                              key={al}
                              type="button"
                              onClick={() => setEditBandTextAlign(al as any)}
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold cursor-pointer ${
                                editBandTextAlign === al
                                  ? 'bg-indigo-600 text-white'
                                  : isDark
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {al[0]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveEditBand(b.id)}
                        disabled={!editBandLabel.trim() || editBandColumns.length === 0}
                        className={`w-full font-bold py-2 rounded-md text-xs transition-colors cursor-pointer ${
                          !editBandLabel.trim() || editBandColumns.length === 0
                            ? isDark
                              ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                              : 'bg-slate-200 text-slate-400 border border-slate-300/80 cursor-not-allowed'
                            : isDark
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:bg-indigo-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:bg-indigo-800'
                        }`}
                      >
                        Save Band Updates
                      </button>
                    </div>
                  );
                }

                const alignIcon = b.textAlign === 'left' ? '⬅️' : b.textAlign === 'right' ? '➡️' : '↔️';

                return (
                  <div key={b.id} className={`border rounded-lg p-3 space-y-1.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          style={{ backgroundColor: b.bgColor || '#FEF3C7', color: b.textColor || '#78350F' }}
                          className={`text-xs px-2.5 py-0.5 rounded border border-black/10 ${b.isBold !== false ? 'font-bold' : ''} ${b.isItalic ? 'italic' : ''}`}
                        >
                          {b.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {b.columnKeys.length} col{b.columnKeys.length > 1 ? 's' : ''} ({alignIcon})
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartEditBand(b)}
                          className={`p-1 cursor-pointer ${isDark ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}
                          title="Edit Band"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBand(b.id)}
                          className="text-red-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Delete Band"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {b.columnKeys.map((k) => (
                        <span
                          key={k}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* Add New Header Band Form */}
            <form onSubmit={handleAddHeaderBand} className={`border rounded-lg p-3.5 space-y-3 ${formBg}`}>
              <span className={`text-xs font-bold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                + Add Super-Header / Group Banner
              </span>

              <div>
                <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Banner Label:</label>
                <input
                  type="text"
                  placeholder="e.g. Comparison between Actual FTP, Q1 Performance"
                  value={bandLabel}
                  onChange={(e) => setBandLabel(e.target.value)}
                  className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-indigo-500 ${inputBg}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select Columns to Cover:</label>
                <div className={`border rounded p-2 max-h-32 overflow-y-auto space-y-1 ${inputBg}`}>
                  {[
                    ...values.map((v) => v.alias || `${v.aggregation}_${v.column}`),
                    ...calculatedFields.map((c) => c.alias || c.name),
                  ].map((colKey) => {
                    const isChecked = bandColumns.includes(colKey);
                    return (
                      <label key={colKey} className={`flex items-center space-x-2 text-xs cursor-pointer ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBandColumns([...bandColumns, colKey]);
                            } else {
                              setBandColumns(bandColumns.filter((k) => k !== colKey));
                            }
                          }}
                          className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                        />
                        <span className="font-mono">{colKey}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Color Styling */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Banner Background:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={bandBgColor}
                      onChange={(e) => setBandBgColor(e.target.value)}
                      className="w-7 h-7 rounded border border-slate-600 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={bandBgColor}
                      onChange={(e) => setBandBgColor(e.target.value)}
                      className={`flex-1 border rounded px-2 py-1 text-xs font-mono outline-none ${inputBg}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Text Color:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={bandTextColor}
                      onChange={(e) => setBandTextColor(e.target.value)}
                      className="w-7 h-7 rounded border border-slate-600 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={bandTextColor}
                      onChange={(e) => setBandTextColor(e.target.value)}
                      className={`flex-1 border rounded px-2 py-1 text-xs font-mono outline-none ${inputBg}`}
                    />
                  </div>
                </div>
              </div>

              {/* Alignment and Font Weight */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-3">
                  <label className={`text-xs flex items-center space-x-1.5 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
                      type="checkbox"
                      checked={bandIsBold}
                      onChange={(e) => setBandIsBold(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                    />
                    <span className="font-bold">Bold</span>
                  </label>

                  <label className={`text-xs flex items-center space-x-1.5 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
                      type="checkbox"
                      checked={bandIsItalic}
                      onChange={(e) => setBandIsItalic(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-500 rounded cursor-pointer"
                    />
                    <span className="italic">Italic</span>
                  </label>
                </div>

                <div className="flex items-center space-x-1">
                  {['left', 'center', 'right'].map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => setBandTextAlign(al as any)}
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold cursor-pointer ${
                        bandTextAlign === al
                          ? 'bg-indigo-600 text-white'
                          : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {al[0]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!bandLabel.trim() || bandColumns.length === 0}
                className={`w-full font-bold py-2 rounded-md text-xs transition-colors cursor-pointer ${
                  !bandLabel.trim() || bandColumns.length === 0
                    ? isDark
                      ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 border border-slate-300/80 cursor-not-allowed'
                    : isDark
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:bg-indigo-700'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:bg-indigo-800'
                }`}
              >
                + Add Header Band
              </button>
            </form>
          </div>
        )}

        {/* 5. CONDITION FILTERS TAB */}
        {activeTab === 'filters' && (
          <div className="space-y-3.5">
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Apply conditions and filters across any dataset field.
            </div>

            {/* Existing Filters */}
            {filters.length === 0 ? (
              <div
                className={`p-3 border border-dashed rounded-lg text-center text-xs ${
                  isDark ? 'bg-slate-950/60 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-500'
                }`}
              >
                No active condition filters. Use the form below to add filters.
              </div>
            ) : (
              filters.map((f, idx) => (
                <div key={idx} className={`border rounded-lg p-3 flex items-center justify-between ${cardBg}`}>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={f.isEnabled}
                      onChange={() => toggleFilter(idx)}
                      className="accent-purple-500 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{f.column}</span>{' '}
                      <span className="text-purple-500 font-semibold">{f.operator}</span>{' '}
                      <span className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>"{f.value}"</span>
                    </div>
                  </div>
                  <button onClick={() => removeFilter(idx)} className="text-red-500 hover:text-red-400 p-1 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {/* Add New Filter */}
            <form onSubmit={handleAddFilter} className={`border rounded-lg p-3.5 space-y-2.5 ${formBg}`}>
              <span className={`text-xs font-bold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                + Add Condition Filter
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Column:</label>
                  <select
                    value={newFilterCol}
                    onChange={(e) => setNewFilterCol(e.target.value)}
                    className={`w-full border rounded px-2 py-1 outline-none ${inputBg}`}
                  >
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Operator:</label>
                  <select
                    value={newFilterOp}
                    onChange={(e) => setNewFilterOp(e.target.value as any)}
                    className={`w-full border rounded px-2 py-1 text-purple-500 font-semibold outline-none ${inputBg}`}
                  >
                    <option value="Equals">Equals</option>
                    <option value="NotEquals">Does Not Equal</option>
                    <option value="GreaterThan">Greater Than (&gt;)</option>
                    <option value="GreaterThanOrEqual">Greater Than or Equal (&gt;=)</option>
                    <option value="LessThan">Less Than (&lt;)</option>
                    <option value="LessThanOrEqual">Less Than or Equal (&lt;=)</option>
                    <option value="Contains">Contains Text</option>
                    <option value="StartsWith">Starts With</option>
                    <option value="EndsWith">Ends With</option>
                    <option value="Between">Between</option>
                    <option value="IsBlank">Is Blank / Empty</option>
                    <option value="IsNotBlank">Is Not Blank</option>
                  </select>
                </div>
              </div>

              {newFilterOp !== 'IsBlank' && newFilterOp !== 'IsNotBlank' && (
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Value:</label>
                  <input
                    type={/date|time|day|month|year|created|timestamp|valdate|maturity/i.test(newFilterCol) ? 'date' : 'text'}
                    placeholder="Filter value..."
                    value={newFilterVal}
                    onChange={(e) => setNewFilterVal(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-purple-500 ${inputBg}`}
                  />
                </div>
              )}

              {newFilterOp === 'Between' && (
                <div>
                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Second Value:</label>
                  <input
                    type={/date|time|day|month|year|created|timestamp|valdate|maturity/i.test(newFilterCol) ? 'date' : 'text'}
                    placeholder="Upper bound value..."
                    value={newFilterVal2}
                    onChange={(e) => setNewFilterVal2(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1 text-xs outline-none focus:border-purple-500 ${inputBg}`}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 rounded text-xs transition cursor-pointer"
              >
                Apply Filter
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};