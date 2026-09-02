import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, FileSpreadsheet, GripVertical } from 'lucide-react';

interface RawDataGridProps {
  columns: string[];
  totalRows: number;
  onOpenPivotStudio: () => void;
  theme?: 'dark' | 'light';
  isWrapHeaders?: boolean;
}

export const RawDataGrid: React.FC<RawDataGridProps> = ({
  columns,
  totalRows,
  onOpenPivotStudio,
  theme = 'light',
  isWrapHeaders = false,
}) => {
  const isDark = theme === 'dark';
  const [rows, setRows] = useState<any[]>([]);
  const [orderedColumns, setOrderedColumns] = useState<string[]>(columns);
  const [draggedRawCol, setDraggedRawCol] = useState<string | null>(null);
  const [dragOverRawCol, setDragOverRawCol] = useState<string | null>(null);
  const [dropRawPosition, setDropRawPosition] = useState<'left' | 'right'>('left');

  useEffect(() => {
    setOrderedColumns(columns);
  }, [columns]);

  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(500);
  const [sortCol, setSortCol] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingColRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const startResize = (e: React.MouseEvent, key: string, currentW: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = { key, startX: e.clientX, startW: currentW };

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingColRef.current) return;
      const delta = moveEvt.clientX - resizingColRef.current.startX;
      const newW = Math.max(70, resizingColRef.current.startW + delta);
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

  const parentRef = useRef<HTMLDivElement>(null);

  const fetchPageData = async (targetPage: number, sortColumn?: string, sortDirection: 'ASC' | 'DESC' = 'ASC') => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      const offset = targetPage * pageSize;
      const res = await window.electronAPI.getRawData(offset, pageSize, sortColumn, sortDirection);
      setRows(res.rows || []);
    } catch (err: any) {
      console.error('Failed to fetch raw data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData(page, sortCol, sortDir);
  }, [page, pageSize, sortCol, sortDir]);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      const nextDir = sortDir === 'ASC' ? 'DESC' : 'ASC';
      setSortDir(nextDir);
      setPage(0);
    } else {
      setSortCol(colName);
      setSortDir('ASC');
      setPage(0);
    }
  };

  const filteredRows = filterQuery
    ? rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(filterQuery.toLowerCase()))
      )
    : rows;

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 25,
  });

  useEffect(() => {
    if (!parentRef.current) return;
    const ro = new ResizeObserver(() => {
      rowVirtualizer.measure();
    });
    ro.observe(parentRef.current);
    return () => ro.disconnect();
  }, [rowVirtualizer]);

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

  const totalPages = Math.ceil(totalRows / pageSize);
  const totalColsWidth = orderedColumns.reduce((sum, col) => sum + (colWidths[col] || 160), 0);
  const totalGridWidth = 56 + totalColsWidth + 32;

  const handleRawDrop = (targetCol: string) => {
    if (!draggedRawCol || draggedRawCol === targetCol) {
      setDraggedRawCol(null);
      setDragOverRawCol(null);
      return;
    }
    const currentOrder = [...orderedColumns];
    const fromIdx = currentOrder.indexOf(draggedRawCol);
    const toIdx = currentOrder.indexOf(targetCol);
    if (fromIdx === -1 || toIdx === -1) return;

    currentOrder.splice(fromIdx, 1);
    let insertIdx = currentOrder.indexOf(targetCol);
    if (dropRawPosition === 'right') {
      insertIdx += 1;
    }
    currentOrder.splice(insertIdx, 0, draggedRawCol);
    setOrderedColumns(currentOrder);
    setDraggedRawCol(null);
    setDragOverRawCol(null);
  };

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden select-text transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Filter & Pagination Bar */}
      <div
        className={`border-b px-4 py-2 flex items-center justify-between text-xs transition-colors shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search loaded page..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className={`border rounded pl-8 pr-3 py-1 text-xs outline-none focus:border-sky-500 w-56 ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-300 text-slate-900 shadow-sm'
              }`}
            />
          </div>

          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            Showing <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{page * pageSize + 1}</strong> -{' '}
            <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>
              {Math.min((page + 1) * pageSize, totalRows).toLocaleString()}
            </strong>{' '}
            of <strong className="text-sky-500">{totalRows.toLocaleString()}</strong> rows
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0 || isLoading}
            className={`p-1 disabled:opacity-30 rounded transition cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            Page <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{page + 1}</strong> of{' '}
            <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{totalPages || 1}</strong>
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1 || isLoading}
            className={`p-1 disabled:opacity-30 rounded transition cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className={`h-4 w-[1px] mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

          <button
            onClick={onOpenPivotStudio}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1 rounded text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Create Pivot Table</span>
          </button>
        </div>
      </div>

      {/* Unified Scroll Container (Horizontal & Vertical) */}
      <div
        ref={parentRef}
        onMouseDown={handleGridMouseDown}
        className={`flex-1 overflow-x-auto overflow-y-auto min-h-0 min-w-0 ${
          isPanning ? 'cursor-grabbing select-none' : isCtrlDown ? 'cursor-grab' : ''
        }`}
      >
        <div style={{ minWidth: `${totalGridWidth}px`, width: `${totalGridWidth}px` }}>
          {/* Sticky Grid Headers */}
          <div
            style={{ minWidth: `${totalGridWidth}px` }}
            className={`border-b ${isWrapHeaders ? 'flex items-stretch min-h-[36px] h-auto py-0' : 'flex items-center h-9'} px-4 text-xs font-bold sticky top-0 z-10 shadow-sm transition-colors ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            <div
              className={`w-14 min-w-[56px] pr-2 border-r ${isWrapHeaders ? 'py-2 flex items-start' : ''} ${
                isDark ? 'text-slate-500 border-slate-800/80' : 'text-slate-400 border-slate-300'
              }`}
            >
              #
            </div>
            {orderedColumns.map((col) => {
              const colW = colWidths[col] || 160;
              const isBeingDragged = draggedRawCol === col;
              const isDragOver = dragOverRawCol === col && !isBeingDragged;

              return (
                <div
                  key={col}
                  draggable={!resizingColRef.current}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', col);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedRawCol(col);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    setDragOverRawCol(col);
                    setDropRawPosition(e.clientX < midpoint ? 'left' : 'right');
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverRawCol === col) {
                      setDragOverRawCol(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleRawDrop(col);
                  }}
                  onDragEnd={() => {
                    setDraggedRawCol(null);
                    setDragOverRawCol(null);
                  }}
                  style={{ width: `${colW}px`, minWidth: `${colW}px`, maxWidth: `${colW}px` }}
                  onClick={() => handleSort(col)}
                  className={`px-2 flex ${isWrapHeaders ? 'items-start py-2' : 'items-center'} justify-between border-r cursor-grab active:cursor-grabbing transition-all group relative select-none font-bold ${
                    isDark ? 'border-slate-800/80 hover:bg-slate-800/60' : 'border-slate-300 hover:bg-slate-200/60'
                  } ${
                    isBeingDragged ? 'opacity-30 bg-sky-500/10 border-dashed border-sky-400' : ''
                  } ${
                    isDragOver
                      ? dropRawPosition === 'left'
                        ? 'border-l-4 border-l-sky-500 bg-sky-500/15'
                        : 'border-r-4 border-r-sky-500 bg-sky-500/15'
                      : ''
                  }`}
                  title="Drag column header to reposition"
                >
                  <div className={`flex ${isWrapHeaders ? 'items-start' : 'items-center'} space-x-1 min-w-0 flex-1`}>
                    <GripVertical className="w-3 h-3 text-slate-400/40 group-hover:text-slate-400 cursor-grab shrink-0 -ml-0.5 transition" />
                    <span className={`${isWrapHeaders ? 'whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] leading-snug min-w-0' : 'truncate whitespace-nowrap'} group-hover:text-sky-500 flex-1 min-w-0`}>
                      {col}
                    </span>
                  </div>
                  <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-sky-500 ml-1 opacity-0 group-hover:opacity-100 transition shrink-0" />

                  {/* Resize Drag Handle */}
                  <div
                    onMouseDown={(e) => startResize(e, col, colW)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/60 z-20 transition"
                    title="Drag to resize column"
                  />
                </div>
              );
            })}
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
              const row = filteredRows[virtualRow.index];
              if (!row) return null;
              const globalRowIdx = page * pageSize + virtualRow.index + 1;

              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    minWidth: `${totalGridWidth}px`,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`flex items-center px-4 text-xs border-b transition-colors font-mono ${
                    isDark
                      ? 'border-slate-800/50 hover:bg-slate-900/60 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div
                    className={`w-14 min-w-[56px] text-[11px] pr-2 border-r ${
                      isDark ? 'text-slate-500 border-slate-800/40' : 'text-slate-400 border-slate-200'
                    }`}
                  >
                    {globalRowIdx}
                  </div>
                  {orderedColumns.map((col) => {
                    const val = row[col];
                    const isNum = typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)));
                    const numVal = isNum ? Number(val) : NaN;
                    const isNegative = !isNaN(numVal) && numVal < 0;
                    
                    let display = val !== null && val !== undefined ? String(val) : '';
                    if (isNegative) {
                      display = `(${Math.abs(numVal).toLocaleString('en-US', { maximumFractionDigits: 4 })})`;
                    }

                    const colW = colWidths[col] || 160;

                    return (
                      <div
                        key={col}
                        style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                        className={`px-3 truncate border-r ${
                          isNum ? 'text-right' : 'text-left'
                        } ${
                          isDark ? 'border-slate-800/40' : 'border-slate-200'
                        } ${isNegative ? (isDark ? 'text-rose-400 font-semibold' : 'text-rose-600 font-semibold') : ''}`}
                      >
                        {display}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};