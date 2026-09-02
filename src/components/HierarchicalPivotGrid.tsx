import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Percent,
  Hash,
  ArrowUpDown,
  Edit,
  Lock,
  Eye,
  EyeOff,
  FolderOpen,
  FileText,
  Layers,
  GripVertical,
  WrapText,
} from 'lucide-react';
import { PivotTemplate, PivotHierarchyNode, ColumnStyle, HeaderGroupDefinition } from '../types/pivot.js';
import { RenameModal } from './RenameModal.js';

interface HierarchicalPivotGridProps {
  template: PivotTemplate | null;
  visibleNodes: PivotHierarchyNode[];
  onToggleNode: (nodeId: string) => void;
  onCellEdit: (nodeId: string, columnKey: string, newValue: number) => void;
  onRenameColumn: (columnType: 'value' | 'calc' | 'hierarchy_header' | 'header_group', oldKey: string, newAlias: string) => void;
  onFormatColumn: (columnType: 'value' | 'calc', columnKey: string, format: string, decimalPlaces?: number) => void;
  onUpdateColumnStyle?: (columnKey: string, updates: Partial<ColumnStyle>) => void;
  onUpdateHeaderGroup?: (groupId: string, updates: Partial<HeaderGroupDefinition>) => void;
  onDeleteHeaderGroup?: (groupId: string) => void;
  onToggleColumnEditability: (columnKey: string) => void;
  onSortByColumn: (columnKey: string) => void;
  onReorderColumns?: (newOrder: string[]) => void;
  onLoadCsv: () => void;
  onLoadTemplate: () => void;
  onOpenPivotStudio: () => void;
  theme?: 'dark' | 'light';
}

export const HierarchicalPivotGrid: React.FC<HierarchicalPivotGridProps> = ({
  template,
  visibleNodes,
  onToggleNode,
  onCellEdit,
  onRenameColumn,
  onFormatColumn,
  onUpdateColumnStyle,
  onUpdateHeaderGroup,
  onDeleteHeaderGroup,
  onToggleColumnEditability,
  onSortByColumn,
  onReorderColumns,
  onLoadCsv,
  onLoadTemplate,
  onOpenPivotStudio,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const parentRef = useRef<HTMLDivElement>(null);

  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: 'value' | 'calc' | 'hierarchy_header' | 'header_group'; key: string; alias: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ nodeId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingColRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Column drag and drop repositioning state
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right'>('left');

  const startResize = (e: React.MouseEvent, key: string, currentW: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = { key, startX: e.clientX, startW: currentW };

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingColRef.current) return;
      const delta = moveEvt.clientX - resizingColRef.current.startX;
      const newW = Math.max(80, resizingColRef.current.startW + delta);
      setColWidths((prev) => ({ ...prev, [resizingColRef.current!.key]: newW }));
    };

    const onMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Close header options menu on outside click or Escape key
  useEffect(() => {
    if (!activeMenuKey) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.column-options-menu') && !target.closest('.column-menu-trigger')) {
        setActiveMenuKey(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuKey(null);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenuKey]);


  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);

  // Track Ctrl key state globally
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.ctrlKey) setIsCtrlDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || !e.ctrlKey) setIsCtrlDown(false);
    };
    const onBlur = () => setIsCtrlDown(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Ctrl + Drag mouse handler
  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-resize-handle]')) return;

    if ((e.ctrlKey || e.button === 1) && parentRef.current) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startScrollLeft: parentRef.current.scrollLeft,
        startScrollTop: parentRef.current.scrollTop,
      };

      const onMouseMove = (moveEvt: MouseEvent) => {
        if (!panStartRef.current || !parentRef.current) return;
        const dx = moveEvt.clientX - panStartRef.current.startX;
        const dy = moveEvt.clientY - panStartRef.current.startY;
        parentRef.current.scrollLeft = panStartRef.current.startScrollLeft - dx;
        parentRef.current.scrollTop = panStartRef.current.startScrollTop - dy;
      };

      const onMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  // Ctrl + Wheel listener for horizontal scrolling without browser zoom
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        el.scrollLeft += delta * 1.5;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ResizeObserver to reflow virtualizer on container size changes
  useEffect(() => {
    if (!parentRef.current) return;
    const ro = new ResizeObserver(() => {
      rowVirtualizer.measure();
    });
    ro.observe(parentRef.current);
    return () => ro.disconnect();
  }, [rowVirtualizer]);

  if (!template || visibleNodes.length === 0) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 text-center select-none transition-colors ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div
          className={`w-16 h-16 border rounded-2xl flex items-center justify-center mb-5 shadow-xl ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <Layers className="w-8 h-8 text-sky-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Welcome to PivotCraft</h2>
        <p className={`text-sm max-w-md mb-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Load your CSV dataset (up to 5,000,000+ rows) to view the raw data and build instant multi-level pivot tables.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-xl w-full">
          <button
            onClick={onLoadCsv}
            className={`border rounded-xl p-6 text-left transition group cursor-pointer shadow-md ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/50'
                : 'bg-white hover:bg-slate-100 border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center mb-3.5 group-hover:scale-110 transition">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold mb-1 group-hover:text-blue-500 transition ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              1. Load CSV Dataset
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Stream 500k+ rows directly into DuckDB in milliseconds and explore the raw data grid.
            </p>
          </button>

          <button
            onClick={onLoadTemplate}
            className={`border rounded-xl p-6 text-left transition group cursor-pointer shadow-md ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 hover:border-sky-500/50'
                : 'bg-white hover:bg-slate-100 border-slate-200 hover:border-sky-300'
            }`}
          >
            <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-lg flex items-center justify-center mb-3.5 group-hover:scale-110 transition">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold mb-1 group-hover:text-sky-500 transition ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              2. Upload JSON Template
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Apply a pre-configured pivot schema, custom formulas, and aggregation rules.
            </p>
          </button>
        </div>
      </div>
    );
  }

  const metricColumns = (template.values || []).map((v) => ({
    type: 'value' as const,
    key: v.alias || `${v.aggregation}_${v.column}`,
    header: v.alias || `${v.aggregation}_${v.column}`,
    format: v.format,
    decimalPlaces: v.decimalPlaces,
    isEditable: v.isEditable !== false,
    showTotal: v.showTotal !== false,
  }));

  const calcColumns = (template.calculatedFields || []).map((c) => ({
    type: 'calc' as const,
    key: c.alias || c.name,
    header: c.alias || c.name,
    format: c.format,
    decimalPlaces: c.decimalPlaces,
    isEditable: c.isEditable === true,
    showTotal: c.showTotal !== false,
  }));

  const baseColumns = [...metricColumns, ...calcColumns];
  let allColumns = baseColumns;
  if (template.columnOrder && template.columnOrder.length > 0) {
    const orderMap = new Map<string, number>();
    template.columnOrder.forEach((k, idx) => orderMap.set(k, idx));
    allColumns = [...baseColumns].sort((a, b) => {
      const idxA = orderMap.has(a.key) ? orderMap.get(a.key)! : 9999;
      const idxB = orderMap.has(b.key) ? orderMap.get(b.key)! : 9999;
      return idxA - idxB;
    });
  }
  const hierarchyHeader = template.rowHierarchyHeader || 'Row Hierarchy / Group';

  const handleStartEditing = (node: PivotHierarchyNode, colKey: string, currentVal: number) => {
    setEditingCell({ nodeId: node.id, colKey });
    setEditValue(String(currentVal));
  };

  const handleCommitEdit = (nodeId: string, colKey: string) => {
    const num = parseFloat(editValue.replace(/[^0-9.-]+/g, ''));
    if (!isNaN(num)) {
      onCellEdit(nodeId, colKey, num);
    }
    setEditingCell(null);
  };

  const hierarchyWidth = colWidths['hierarchy'] || 340;
  const totalColumnsWidth = allColumns.reduce((sum, col) => sum + (colWidths[col.key] || 160), 0);
  const totalGridWidth = hierarchyWidth + totalColumnsWidth + 32;

  const headerGroups = template?.headerGroups || [];
  const hasHeaderGroups = headerGroups.length > 0;

  // Segment columns into groups or singles for the super header band
  const headerBandSegments: Array<
    | {
        type: 'group';
        group: HeaderGroupDefinition;
        columns: typeof allColumns;
        totalWidth: number;
      }
    | {
        type: 'single';
        column: (typeof allColumns)[0];
        width: number;
      }
  > = [];

  if (hasHeaderGroups) {
    let i = 0;
    while (i < allColumns.length) {
      const col = allColumns[i];
      const group = headerGroups.find((g) => g.columnKeys && g.columnKeys.includes(col.key));
      if (group) {
        const groupCols = [col];
        let width = colWidths[col.key] || 160;
        let next = i + 1;
        while (next < allColumns.length && group.columnKeys.includes(allColumns[next].key)) {
          groupCols.push(allColumns[next]);
          width += colWidths[allColumns[next].key] || 160;
          next++;
        }
        headerBandSegments.push({
          type: 'group',
          group,
          columns: groupCols,
          totalWidth: width,
        });
        i = next;
      } else {
        headerBandSegments.push({
          type: 'single',
          column: col,
          width: colWidths[col.key] || 160,
        });
        i++;
      }
    }
  }

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative select-text transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      {/* Scrollable Grid Container for Both Horizontal & Vertical Navigation */}
      <div
        ref={parentRef}
        onMouseDown={handleGridMouseDown}
        className={`flex-1 overflow-x-auto overflow-y-auto min-h-0 min-w-0 ${
          isPanning ? 'cursor-grabbing select-none' : isCtrlDown ? 'cursor-grab' : ''
        }`}
      >
        <div style={{ minWidth: `${totalGridWidth}px`, width: `${totalGridWidth}px` }}>
          {/* Unified Sticky Header Container */}
          <div className="sticky top-0 z-20 shadow-sm" style={{ minWidth: `${totalGridWidth}px` }}>
            {/* Top Super-Header Row / Header Band Row */}
            {hasHeaderGroups && (
              <div
                style={{ minWidth: `${totalGridWidth}px` }}
                className={`border-b flex items-center h-8 px-4 text-xs transition-colors ${
                  isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50 border-slate-300'
                }`}
              >
                {/* Hierarchy Column Super-Header Spacer */}
                <div
                  style={{ width: `${hierarchyWidth}px`, minWidth: `${hierarchyWidth}px` }}
                  className={`pr-4 h-full flex items-center border-r select-none ${
                    isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-300 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Categories & Metrics</span>
                </div>

                {/* Metric Column Bands & Groups */}
                {headerBandSegments.map((seg, sIdx) => {
                  if (seg.type === 'group') {
                    const g = seg.group;
                    const alignClass =
                      g.textAlign === 'left' ? 'justify-start text-left' : g.textAlign === 'right' ? 'justify-end text-right' : 'justify-center text-center';
                    const isMenuOpen = activeMenuKey === `group_${g.id}`;

                    return (
                      <div
                        key={g.id || sIdx}
                        style={{
                          width: `${seg.totalWidth}px`,
                          minWidth: `${seg.totalWidth}px`,
                          backgroundColor: g.bgColor || (isDark ? '#1e293b' : '#fef3c7'),
                          color: g.textColor || (isDark ? '#fef08a' : '#78350f'),
                        }}
                        className={`h-full px-3 flex items-center ${alignClass} border-r relative group select-none ${
                          isMenuOpen ? 'z-[60]' : ''
                        } ${
                          g.isBold !== false ? 'font-bold' : 'font-normal'
                        } ${g.isItalic ? 'italic' : ''} ${
                          isDark ? 'border-slate-800/80 shadow-inner' : 'border-slate-300 shadow-sm'
                        }`}
                      >
                        <span
                          onDoubleClick={() => setRenameTarget({ type: 'header_group', key: g.id, alias: g.label })}
                          className="truncate flex-1 cursor-pointer tracking-wide"
                          title="Double-click to rename group banner label"
                        >
                          {g.label}
                        </span>

                        <button
                          onClick={() => setActiveMenuKey(isMenuOpen ? null : `group_${g.id}`)}
                          className={`column-menu-trigger p-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer shrink-0 ml-1.5 ${
                            isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-black/10'
                          }`}
                          title="Header Band styling & options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Header Band Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            className={`column-options-menu absolute top-full right-0 mt-1 border rounded-lg shadow-2xl py-1.5 w-64 z-[100] text-xs font-normal text-left ${
                              isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                            }`}
                          >
                            <button
                              onClick={() => {
                                setActiveMenuKey(null);
                                setRenameTarget({ type: 'header_group', key: g.id, alias: g.label });
                              }}
                              className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                                isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span>✏️ Rename Label...</span>
                            </button>

                            <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                            {/* Background Presets */}
                            <div className="px-3 py-1.5 space-y-1">
                              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Banner Background:</div>
                              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                {[
                                  { label: 'Cream / Yellow', bg: '#fef3c7' },
                                  { label: 'Sky Blue', bg: '#dbeafe' },
                                  { label: 'Mint Green', bg: '#d1fae5' },
                                  { label: 'Rose Pink', bg: '#ffe4e6' },
                                  { label: 'Purple', bg: '#f3e8ff' },
                                  { label: 'Dark Slate', bg: '#1e293b' },
                                  { label: 'Navy', bg: '#1e3a8a' },
                                ].map((item) => (
                                  <button
                                    key={item.label}
                                    onClick={() => onUpdateHeaderGroup?.(g.id, { bgColor: item.bg })}
                                    title={item.label}
                                    style={{ backgroundColor: item.bg }}
                                    className={`w-4 h-4 rounded-full border cursor-pointer hover:scale-110 transition ${
                                      g.bgColor === item.bg ? 'ring-2 ring-sky-400 border-white' : 'border-slate-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Font Color Presets */}
                            <div className="px-3 py-1.5 space-y-1">
                              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Font Color:</div>
                              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                {[
                                  { label: 'Dark Amber', color: '#78350f' },
                                  { label: 'Navy Blue', color: '#1e40af' },
                                  { label: 'Dark Green', color: '#065f46' },
                                  { label: 'Rose', color: '#9f1239' },
                                  { label: 'Purple', color: '#6b21a8' },
                                  { label: 'White', color: '#ffffff' },
                                  { label: 'Black', color: '#000000' },
                                ].map((item) => (
                                  <button
                                    key={item.label}
                                    onClick={() => onUpdateHeaderGroup?.(g.id, { textColor: item.color })}
                                    title={item.label}
                                    style={{ backgroundColor: item.color }}
                                    className={`w-4 h-4 rounded-full border cursor-pointer hover:scale-110 transition ${
                                      g.textColor === item.color ? 'ring-2 ring-sky-400 border-white' : 'border-slate-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Align & Emphasis */}
                            <div className="px-3 py-1.5 flex items-center justify-between border-t border-slate-700/50">
                              <span className="text-[10px] text-slate-400">Align:</span>
                              <div className="flex items-center space-x-1">
                                {['left', 'center', 'right'].map((al) => (
                                  <button
                                    key={al}
                                    onClick={() => onUpdateHeaderGroup?.(g.id, { textAlign: al as any })}
                                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold cursor-pointer ${
                                      (g.textAlign || 'center') === al
                                        ? 'bg-sky-600 text-white'
                                        : isDark
                                        ? 'bg-slate-800 text-slate-400'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {al[0]}
                                  </button>
                                ))}
                                <button
                                  onClick={() => onUpdateHeaderGroup?.(g.id, { isBold: g.isBold === false ? true : false })}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                    g.isBold !== false ? 'bg-sky-600 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  B
                                </button>
                                <button
                                  onClick={() => onUpdateHeaderGroup?.(g.id, { isItalic: !g.isItalic })}
                                  className={`px-1.5 py-0.5 rounded text-[10px] italic font-serif cursor-pointer ${
                                    g.isItalic ? 'bg-sky-600 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  I
                                </button>
                              </div>
                            </div>

                            <div className="border-t border-slate-700/50 pt-1">
                              <button
                                onClick={() => {
                                  onDeleteHeaderGroup?.(g.id);
                                  setActiveMenuKey(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 flex items-center space-x-2 cursor-pointer font-semibold"
                              >
                                <span>🗑️ Remove Header Band</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Single ungrouped column spacer
                    return (
                      <div
                        key={seg.column.key}
                        style={{ width: `${seg.width}px`, minWidth: `${seg.width}px` }}
                        className={`h-full border-r ${isDark ? 'border-slate-800/80' : 'border-slate-300'}`}
                      />
                    );
                  }
                })}
              </div>
            )}

            {/* Clean Table Header */}
            {(() => {
              const hasAnyWrappedHeader = template?.wrapHeaders || Object.values(template?.columnStyles || {}).some((s) => s.wrapHeader);
              const hierStyle = template?.columnStyles?.['hierarchy'] || {};
              const hierShouldWrap = hierStyle.wrapHeader || template?.wrapHeaders;

              return (
                <div
                  style={{ minWidth: `${totalGridWidth}px` }}
                  className={`border-b ${hasAnyWrappedHeader ? 'flex items-stretch min-h-[40px] h-auto py-0' : 'flex items-center h-10'} px-4 text-xs font-bold transition-colors ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                >
                  {/* Row Hierarchy Header (With Resize Handle) */}
                  <div
                    style={{
                      width: `${hierarchyWidth}px`,
                      minWidth: `${hierarchyWidth}px`,
                      maxWidth: `${hierarchyWidth}px`,
                    }}
                    className={`pr-4 flex ${hierShouldWrap ? 'items-start py-2' : 'items-center'} justify-between border-r group relative select-none font-bold ${
                      activeMenuKey === 'hierarchy' ? 'z-[60]' : ''
                    } ${
                      isDark ? 'border-slate-800/80 text-slate-300' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    <span
                      onDoubleClick={() => setRenameTarget({ type: 'hierarchy_header', key: 'rowHierarchyHeader', alias: hierarchyHeader })}
                      className={`cursor-pointer hover:text-sky-500 text-left flex-1 min-w-0 ${
                        hierShouldWrap
                          ? 'whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-snug'
                          : 'truncate whitespace-nowrap'
                      }`}
                      title="Double click to rename Row Hierarchy header"
                    >
                      {hierarchyHeader}
                    </span>

                    <div className="flex items-center space-x-1 shrink-0 ml-1.5">
                      <button
                        onClick={() => onSortByColumn('hierarchy')}
                        className={`p-0.5 rounded transition cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-sky-400' : 'text-slate-500 hover:text-sky-600'
                        }`}
                        title="Toggle Sort A-Z / Z-A"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuKey(activeMenuKey === 'hierarchy' ? null : 'hierarchy');
                        }}
                        className={`column-menu-trigger p-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer ${
                          isDark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-900'
                        }`}
                        title="Hierarchy options & cell styling"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Hierarchy Menu */}
                    {activeMenuKey === 'hierarchy' && (
                      <div
                        className={`column-options-menu absolute top-full left-0 mt-1 border rounded-lg shadow-2xl py-1.5 w-64 z-[100] text-xs font-normal text-left ${
                          isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setActiveMenuKey(null);
                            setRenameTarget({ type: 'hierarchy_header', key: 'rowHierarchyHeader', alias: hierarchyHeader });
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                            isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span>✏️ Rename Header...</span>
                        </button>

                        <button
                          onClick={() => {
                            onUpdateColumnStyle?.('hierarchy', { wrapHeader: !hierStyle.wrapHeader });
                            setActiveMenuKey(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer ${
                            hierStyle.wrapHeader ? 'text-sky-400 font-semibold' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <WrapText className="w-3.5 h-3.5" />
                            <span>Wrap Header Text</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${hierStyle.wrapHeader ? 'bg-sky-500/20 text-sky-400' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}`}>
                            {hierStyle.wrapHeader ? 'ON' : 'OFF'}
                          </span>
                        </button>

                        <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Cell Styling & Aesthetics
                        </div>

                        <button
                          onClick={() => onUpdateColumnStyle?.('hierarchy', { alwaysParentheses: !hierStyle.alwaysParentheses })}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer ${
                            hierStyle.alwaysParentheses ? 'text-amber-500 font-semibold' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                          }`}
                        >
                          <span>Enclose Non-Zero Labels in ( )</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${hierStyle.alwaysParentheses ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      {hierStyle.alwaysParentheses ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Cell Background */}
                  <div className="px-3 py-1.5 space-y-1">
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cell Background:</div>
                    <div className="flex items-center space-x-1.5">
                      {[
                        { label: 'Default', bg: '' },
                        { label: 'Slate', bg: '#1e293b' },
                        { label: 'Emerald', bg: '#064e3b' },
                        { label: 'Blue', bg: '#0c4a6e' },
                        { label: 'Purple', bg: '#581c87' },
                        { label: 'Amber', bg: '#78350f' },
                        { label: 'Rose', bg: '#881337' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => onUpdateColumnStyle?.('hierarchy', { cellBgColor: item.bg || undefined })}
                          title={`Background: ${item.label}`}
                          style={{ backgroundColor: item.bg || (isDark ? '#0f172a' : '#f1f5f9') }}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            hierStyle.cellBgColor === item.bg ? 'ring-2 ring-sky-400 border-white' : 'border-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Cell Font Color */}
                  <div className="px-3 py-1.5 space-y-1">
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cell Font Color:</div>
                    <div className="flex items-center space-x-1.5">
                      {[
                        { label: 'Default', color: '' },
                        { label: 'Emerald', color: '#10b981' },
                        { label: 'Sky', color: '#38bdf8' },
                        { label: 'Purple', color: '#c084fc' },
                        { label: 'Amber', color: '#fbbf24' },
                        { label: 'Rose', color: '#f43f5e' },
                        { label: 'White', color: '#ffffff' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => onUpdateColumnStyle?.('hierarchy', {
                            cellTextColor: item.color || undefined,
                          })}
                          title={`Color: ${item.label}`}
                          style={{ backgroundColor: item.color || (isDark ? '#94a3b8' : '#334155') }}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            hierStyle.cellTextColor === item.color ? 'ring-2 ring-sky-400 border-white' : 'border-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bold / Italic */}
                  <div className="px-3 py-1.5 flex items-center justify-between border-t border-slate-700/50">
                    <span className="text-[10px] text-slate-400">Emphasis:</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onUpdateColumnStyle?.('hierarchy', { isBold: !hierStyle.isBold })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          hierStyle.isBold ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                      >
                        B
                      </button>
                      <button
                        onClick={() => onUpdateColumnStyle?.('hierarchy', { isItalic: !hierStyle.isItalic })}
                        className={`px-2 py-0.5 rounded text-[10px] italic font-serif cursor-pointer ${
                          hierStyle.isItalic ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                      >
                        I
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Resize Drag Handle */}
              <div
                onMouseDown={(e) => startResize(e, 'hierarchy', hierarchyWidth)}
                className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/60 z-30 transition"
                title="Drag to resize column width"
              />
            </div>

            {/* Dynamic Metric & Calculated Column Headers (With Drag-to-Reposition & Resize Handles) */}
        {allColumns.map((col) => {
          const colW = colWidths[col.key] || 160;
          const colStyle = template.columnStyles?.[col.key] || {};
          const shouldWrap = !!(colStyle.wrapHeader || template?.wrapHeaders);
          const isBeingDragged = draggedColKey === col.key;
          const isDragOver = dragOverColKey === col.key && !isBeingDragged;

          return (
            <div
              key={col.key}
              draggable={!resizingColRef.current}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', col.key);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedColKey(col.key);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = e.currentTarget.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                setDragOverColKey(col.key);
                setDropPosition(e.clientX < midpoint ? 'left' : 'right');
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverColKey === col.key) {
                  setDragOverColKey(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedColKey || draggedColKey === col.key) {
                  setDraggedColKey(null);
                  setDragOverColKey(null);
                  return;
                }
                const currentOrder = allColumns.map((c) => c.key);
                const fromIdx = currentOrder.indexOf(draggedColKey);
                const toIdx = currentOrder.indexOf(col.key);
                if (fromIdx === -1 || toIdx === -1) return;

                const newOrder = [...currentOrder];
                newOrder.splice(fromIdx, 1);
                let insertIdx = newOrder.indexOf(col.key);
                if (dropPosition === 'right') {
                  insertIdx += 1;
                }
                newOrder.splice(insertIdx, 0, draggedColKey);

                onReorderColumns?.(newOrder);
                setDraggedColKey(null);
                setDragOverColKey(null);
              }}
              onDragEnd={() => {
                setDraggedColKey(null);
                setDragOverColKey(null);
              }}
              style={{
                width: `${colW}px`,
                minWidth: `${colW}px`,
                maxWidth: `${colW}px`,
              }}
              className={`px-2 flex ${shouldWrap ? 'items-start py-2' : 'items-center'} ${
                colStyle.textAlign === 'left' ? 'justify-start' : colStyle.textAlign === 'center' ? 'justify-center' : 'justify-end'
              } space-x-1 border-r relative group select-none font-bold cursor-grab active:cursor-grabbing transition-all ${
                activeMenuKey === col.key ? 'z-[60]' : ''
              } ${
                isDark ? 'border-slate-800/80 text-slate-300' : 'border-slate-300 text-slate-700'
              } ${
                isBeingDragged ? 'opacity-30 bg-sky-500/10 border-dashed border-sky-400' : ''
              } ${
                isDragOver
                  ? dropPosition === 'left'
                    ? 'border-l-4 border-l-sky-500 bg-sky-500/15'
                    : 'border-r-4 border-r-sky-500 bg-sky-500/15'
                  : ''
              }`}
              title="Drag column header left/right to reposition"
            >
              {/* Drag Handle Icon */}
              <GripVertical className="w-3 h-3 text-slate-400/40 group-hover:text-slate-400 cursor-grab shrink-0 -ml-0.5 transition" />

              {col.isEditable ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mr-0.5" title="Direct Cell Editing Enabled" />
              ) : null}

              <span
                onDoubleClick={() => setRenameTarget({ type: col.type, key: col.key, alias: col.header })}
                className={`cursor-pointer hover:text-sky-500 font-bold flex-1 min-w-0 ${
                  shouldWrap
                    ? 'whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-snug'
                    : 'truncate whitespace-nowrap'
                } ${
                  colStyle.textAlign === 'left' ? 'text-left' : colStyle.textAlign === 'center' ? 'text-center' : 'text-right'
                }`}
                title="Double click to rename (or drag to reorder)"
              >
                {col.header}
              </span>

              {/* Menu Trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuKey(activeMenuKey === col.key ? null : col.key);
                }}
                className={`column-menu-trigger p-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer shrink-0 ${
                  isDark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Resize Drag Handle */}
              <div
                onMouseDown={(e) => startResize(e, col.key, colW)}
                onClick={(e) => e.stopPropagation()}
                className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/60 z-30 transition"
                title="Drag to resize column width"
              />

              {/* Column Options Menu */}
              {activeMenuKey === col.key && (
                <div
                  className={`column-options-menu absolute top-full right-0 mt-1 border rounded-lg shadow-2xl py-1.5 w-64 z-[100] text-xs font-normal text-left ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveMenuKey(null);
                      setRenameTarget({ type: col.type, key: col.key, alias: col.header });
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span>✏️ Rename Column...</span>
                  </button>

                  <button
                    onClick={() => {
                      onUpdateColumnStyle?.(col.key, { wrapHeader: !colStyle.wrapHeader });
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer ${
                      colStyle.wrapHeader ? 'text-sky-400 font-semibold' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <WrapText className="w-3.5 h-3.5" />
                      <span>Wrap Header Text</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        colStyle.wrapHeader ? 'bg-sky-500/20 text-sky-400' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {colStyle.wrapHeader ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onToggleColumnEditability(col.key);
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-emerald-500 font-semibold flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                    }`}
                  >
                    {col.isEditable ? <Lock className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
                    <span>{col.isEditable ? 'Disable Cell Input Field' : 'Enable Cell Input Field'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const currentShowTotal = colStyle.showTotal !== false && col.showTotal !== false;
                      onUpdateColumnStyle?.(col.key, { showTotal: !currentShowTotal });
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {colStyle.showTotal === false || col.showTotal === false ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-sky-500" />
                      )}
                      <span>{colStyle.showTotal === false || col.showTotal === false ? 'Show Total in Column' : 'Hide Total in Column'}</span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        colStyle.showTotal === false || col.showTotal === false
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      {colStyle.showTotal === false || col.showTotal === false ? 'OFF' : 'ON'}
                    </span>
                  </button>

                  <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Number Format
                  </div>
                  <button
                    onClick={() => {
                      onFormatColumn(col.type, col.key, '#,##0', 0);
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 text-sky-500" />
                    <span>Number: Whole (#,##0)</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormatColumn(col.type, col.key, '₱#,##0.00', 2);
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-emerald-500 font-bold">₱</span>
                    <span>Peso Currency (₱#,##0.00)</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormatColumn(col.type, col.key, '0.0%', 1);
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5 text-amber-500" />
                    <span>Percentage (0.0%)</span>
                  </button>
                  <button
                    onClick={() => {
                      onFormatColumn(col.type, col.key, '0.000', 3);
                      setActiveMenuKey(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 cursor-pointer ${
                      isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 text-purple-500" />
                    <span>Precision: No Commas (0.000)</span>
                  </button>

                  <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Decimal Places
                  </div>
                  <div className="px-3 py-1 flex items-center space-x-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                      const currDec = col.decimalPlaces !== undefined ? col.decimalPlaces : (col.format === '#,##0' ? 0 : 2);
                      const isSelected = currDec === d;
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            onFormatColumn(col.type, col.key, col.format || '#,##0', d);
                            setActiveMenuKey(null);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-xs'
                              : isDark
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={`Force ${d} decimal place${d === 1 ? '' : 's'}`}
                        >
                          .{d}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Cell Styling & Aesthetics
                  </div>

                  {/* Always Enclose in Parentheses */}
                  <button
                    onClick={() => {
                      onUpdateColumnStyle?.(col.key, { alwaysParentheses: !colStyle.alwaysParentheses });
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer ${
                      colStyle.alwaysParentheses ? 'text-amber-500 font-semibold' : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-xs">( )</span>
                      <span>Enclose Non-Zero Cells in ( )</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colStyle.alwaysParentheses ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      {colStyle.alwaysParentheses ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Cell Background */}
                  <div className="px-3 py-1.5 space-y-1">
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cell Background:</div>
                    <div className="flex items-center space-x-1.5">
                      {[
                        { label: 'Default', bg: '' },
                        { label: 'Slate', bg: '#1e293b' },
                        { label: 'Emerald', bg: '#064e3b' },
                        { label: 'Blue', bg: '#0c4a6e' },
                        { label: 'Purple', bg: '#581c87' },
                        { label: 'Amber', bg: '#78350f' },
                        { label: 'Rose', bg: '#881337' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => onUpdateColumnStyle?.(col.key, { cellBgColor: item.bg || undefined })}
                          title={`Background: ${item.label}`}
                          style={{ backgroundColor: item.bg || (isDark ? '#0f172a' : '#f1f5f9') }}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            colStyle.cellBgColor === item.bg ? 'ring-2 ring-sky-400 border-white' : 'border-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Cell Font Color */}
                  <div className="px-3 py-1.5 space-y-1">
                    <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cell Font Color:</div>
                    <div className="flex items-center space-x-1.5">
                      {[
                        { label: 'Default', color: '' },
                        { label: 'Emerald', color: '#10b981' },
                        { label: 'Sky', color: '#38bdf8' },
                        { label: 'Purple', color: '#c084fc' },
                        { label: 'Amber', color: '#fbbf24' },
                        { label: 'Rose', color: '#f43f5e' },
                        { label: 'White', color: '#ffffff' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => onUpdateColumnStyle?.(col.key, {
                            cellTextColor: item.color || undefined,
                          })}
                          title={`Color: ${item.label}`}
                          style={{ backgroundColor: item.color || (isDark ? '#94a3b8' : '#334155') }}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            colStyle.cellTextColor === item.color ? 'ring-2 ring-sky-400 border-white' : 'border-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Text Alignment & Emphasis */}
                  <div className="px-3 py-1.5 flex items-center justify-between border-t border-slate-700/50">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onUpdateColumnStyle?.(col.key, { textAlign: 'left' })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          colStyle.textAlign === 'left' ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                        title="Align Left"
                      >
                        L
                      </button>
                      <button
                        onClick={() => onUpdateColumnStyle?.(col.key, { textAlign: 'center' })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          colStyle.textAlign === 'center' ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                        title="Align Center"
                      >
                        C
                      </button>
                      <button
                        onClick={() => onUpdateColumnStyle?.(col.key, { textAlign: 'right' })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          !colStyle.textAlign || colStyle.textAlign === 'right' ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                        title="Align Right"
                      >
                        R
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onUpdateColumnStyle?.(col.key, { isBold: !colStyle.isBold })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          colStyle.isBold ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        onClick={() => onUpdateColumnStyle?.(col.key, { isItalic: !colStyle.isItalic })}
                        className={`px-2 py-0.5 rounded text-[10px] italic font-serif cursor-pointer ${
                          colStyle.isItalic ? 'bg-sky-600 text-white' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                        }`}
                        title="Italic"
                      >
                        I
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  })()}
</div>

          {/* Virtualized Rows Container */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              minWidth: `${totalGridWidth}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const node = visibleNodes[virtualRow.index];
              if (!node) return null;

              const isGrandTotal = node.isGrandTotal;
              const isSubtotal = node.isSubtotal;
              const indentPx = Math.max(0, node.level - 1) * 20;

              const hierColStyle = template.columnStyles?.['hierarchy'] || {};
              let hierDisplayText = node.displayText;
              if (hierColStyle.alwaysParentheses && hierDisplayText && !hierDisplayText.startsWith('(')) {
                hierDisplayText = `(${hierDisplayText})`;
              }

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    minWidth: `${totalGridWidth}px`,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`flex items-center px-4 text-xs border-b transition-colors ${
                  isGrandTotal
                    ? isDark
                      ? 'bg-slate-800/95 font-bold text-slate-100 border-t-2 border-slate-600 border-b-2 border-slate-700 shadow-sm'
                      : 'bg-slate-200/95 font-bold text-slate-950 border-t-2 border-slate-400 border-b-2 border-slate-300 shadow-sm'
                    : isSubtotal
                    ? isDark
                      ? 'bg-slate-900/90 font-semibold text-slate-200 border-slate-800/60'
                      : 'bg-slate-100 font-semibold text-slate-800 border-slate-200'
                    : isDark
                    ? 'hover:bg-slate-900/50 text-slate-300 border-slate-800/40'
                    : 'hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {/* Row Hierarchy Cell */}
                <div
                  style={{
                    width: `${hierarchyWidth}px`,
                    minWidth: `${hierarchyWidth}px`,
                    paddingLeft: `${indentPx}px`,
                    backgroundColor: hierColStyle.cellBgColor || undefined,
                    color: hierColStyle.cellTextColor || undefined,
                  }}
                  className={`pr-4 flex items-center space-x-2 truncate border-r ${
                    hierColStyle.isBold ? 'font-bold' : ''
                  } ${hierColStyle.isItalic ? 'italic' : ''} ${
                    isDark ? 'border-slate-800/40' : 'border-slate-200'
                  }`}
                >
                  {!node.isLeaf && !isGrandTotal ? (
                    <button
                      onClick={() => onToggleNode(node.id)}
                      className={`w-4 h-4 flex items-center justify-center rounded cursor-pointer ${
                        isDark ? 'text-sky-400 hover:bg-slate-700/60' : 'text-sky-600 hover:bg-slate-200'
                      }`}
                    >
                      {node.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className={`truncate ${node.groupValue === '(blank)' ? (isDark ? 'italic text-slate-500' : 'italic text-slate-400') : ''}`}>
                    {hierDisplayText}
                  </span>
                </div>

                {/* Value & Calculated Cells */}
                {allColumns.map((col) => {
                  const colStyle = template.columnStyles?.[col.key] || {};
                  const isEditing = editingCell?.nodeId === node.id && editingCell?.colKey === col.key;
                  const rawNumVal = node.editableOverrides?.[col.key] ?? node.numericMetrics?.[col.key];
                  const calcVal = node.calculatedValues?.[col.key];
                  const numericVal = rawNumVal !== undefined
                    ? rawNumVal
                    : (typeof calcVal === 'number' ? calcVal : (calcVal !== undefined && !isNaN(Number(calcVal)) ? Number(calcVal) : null));

                  const isNegative = typeof numericVal === 'number' && !isNaN(numericVal) && numericVal < 0;
                  const isNumeric = typeof numericVal === 'number' && !isNaN(numericVal);
                  const isZero = isNumeric && Math.abs(numericVal) < 1e-9;

                  const targetDec = col.decimalPlaces !== undefined ? col.decimalPlaces : (col.format === '#,##0' ? 0 : 2);
                  let formattedVal =
                    node.formattedValues?.[col.key] ??
                    (typeof calcVal === 'number'
                      ? (isNegative
                        ? `(${Math.abs(calcVal).toLocaleString('en-US', { minimumFractionDigits: targetDec, maximumFractionDigits: targetDec })})`
                        : calcVal.toLocaleString('en-US', { minimumFractionDigits: targetDec, maximumFractionDigits: targetDec }))
                      : calcVal) ??
                    (node.numericMetrics?.[col.key] !== undefined
                      ? (isNegative
                        ? `(${Math.abs(node.numericMetrics[col.key]).toLocaleString('en-US', { minimumFractionDigits: targetDec, maximumFractionDigits: targetDec })})`
                        : node.numericMetrics[col.key].toLocaleString('en-US', { minimumFractionDigits: targetDec, maximumFractionDigits: targetDec }))
                      : '-');

                  const isTotalRow = isGrandTotal || isSubtotal;
                  const isTotalHidden = colStyle.showTotal === false || col.showTotal === false;

                  if (isTotalRow && isTotalHidden) {
                    formattedVal = '-';
                  }

                  const isZeroFormatted =
                    (isTotalHidden && isTotalRow) ||
                    isZero ||
                    formattedVal === '-' ||
                    formattedVal === '0' ||
                    formattedVal === '0.00' ||
                    formattedVal === '₱0.00' ||
                    formattedVal === '0.0%' ||
                    formattedVal === '0.000';

                  // Additional aesthetics: Enclose in parentheses ONLY IF NOT ZERO and NOT HIDDEN TOTAL
                  if (!isZeroFormatted && !isTotalHidden && colStyle.alwaysParentheses && formattedVal && formattedVal !== '-' && !formattedVal.startsWith('(')) {
                    formattedVal = `(${formattedVal})`;
                  }

                  const isEditableCell = col.isEditable && !isGrandTotal && (!isSubtotal || !isTotalHidden);
                  const colW = colWidths[col.key] || 160;

                  return (
                    <div
                      key={col.key}
                      style={{
                        width: `${colW}px`,
                        minWidth: `${colW}px`,
                        backgroundColor: isZeroFormatted ? undefined : colStyle.cellBgColor || undefined,
                        color: isZeroFormatted ? undefined : isNegative ? undefined : colStyle.cellTextColor || undefined,
                      }}
                      className={`px-3 ${
                        colStyle.textAlign === 'left' ? 'text-left' : colStyle.textAlign === 'center' ? 'text-center' : 'text-right'
                      } truncate border-r font-mono ${
                        !isZeroFormatted && colStyle.isBold ? 'font-bold' : ''
                      } ${!isZeroFormatted && colStyle.isItalic ? 'italic' : ''} ${
                        isDark ? 'border-slate-800/40' : 'border-slate-200'
                      }`}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCommitEdit(node.id, col.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(node.id, col.key);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className={`w-full border rounded px-2 py-0.5 text-xs font-bold text-right outline-none shadow-lg ${
                            isDark
                              ? 'bg-slate-950 border-emerald-500 text-emerald-400'
                              : 'bg-white border-emerald-500 text-emerald-700'
                          }`}
                        />
                      ) : isEditableCell ? (
                        <div
                          onClick={() => handleStartEditing(node, col.key, numericVal ?? 0)}
                          className={`cursor-pointer border rounded px-1.5 py-0.5 transition flex items-center ${
                            colStyle.textAlign === 'left' ? 'justify-start' : colStyle.textAlign === 'center' ? 'justify-center' : 'justify-end'
                          } space-x-1 ${
                            isNegative
                              ? isDark
                                ? 'text-rose-400 font-semibold hover:bg-rose-950/40 border-transparent hover:border-rose-700/60'
                                : 'text-rose-600 font-semibold hover:bg-rose-50 border-transparent hover:border-rose-300'
                              : isDark
                              ? 'hover:bg-emerald-950/40 hover:text-emerald-400 border-transparent hover:border-emerald-700/60'
                              : 'hover:bg-emerald-50 hover:text-emerald-700 border-transparent hover:border-emerald-300'
                          }`}
                          title="Click to edit cell and recalculate"
                        >
                          <span className="truncate">{formattedVal}</span>
                        </div>
                      ) : (
                        <span className={isNegative ? (isDark ? 'text-rose-400 font-semibold' : 'text-rose-600 font-semibold') : ''}>
                          {formattedVal}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Rename Modal */}
      {renameTarget && (
        <RenameModal
          isOpen={Boolean(renameTarget)}
          currentName={renameTarget.alias}
          onSave={(newName) => onRenameColumn(renameTarget.type, renameTarget.key, newName)}
          onClose={() => setRenameTarget(null)}
          theme={theme}
        />
      )}
    </div>
  );
};