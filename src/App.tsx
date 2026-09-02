import React, { useState } from 'react';
import { Header } from './components/Header.js';
import { ActionRibbon } from './components/ActionRibbon.js';
import { QuickFilterBar } from './components/QuickFilterBar.js';
import { HierarchicalPivotGrid } from './components/HierarchicalPivotGrid.js';
import { RawDataGrid } from './components/RawDataGrid.js';
import { PivotFieldList } from './components/PivotFieldList.js';
import { StatusBar } from './components/StatusBar.js';
import { ToastContainer, ToastItem } from './components/Toast.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { UpdateModal, UpdateInfo, UpdateProgress } from './components/UpdateModal.js';
import { PivotTemplate, PivotHierarchyNode, FilterDefinition, ValueMetricDefinition, ColumnStyle, HeaderGroupDefinition, PivotCraftProject } from './types/pivot.js';
import { globalFormulaParser, preprocessFormula } from './utils/formulaEngine.js';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pivotcraft_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('pivotcraft_theme', nextTheme);
  };

  const showToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const sanitizeTemplate = (raw: any): PivotTemplate => {
    if (!raw) {
      return {
        templateName: 'Custom Pivot',
        version: '2.0',
        description: '',
        rowHierarchyHeader: 'Row Hierarchy / Group',
        filters: [],
        rowHierarchy: [],
        columnDimensions: [],
        values: [],
        calculatedFields: [],
        columnStyles: {},
        headerGroups: [],
        columnOrder: [],
        wrapHeaders: false,
      };
    }
    return {
      templateName: raw.templateName || 'Custom Pivot',
      version: raw.version || '2.0',
      description: raw.description || '',
      rowHierarchyHeader: raw.rowHierarchyHeader || 'Row Hierarchy / Group',
      filters: Array.isArray(raw.filters) ? raw.filters : [],
      rowHierarchy: Array.isArray(raw.rowHierarchy) ? raw.rowHierarchy : [],
      columnDimensions: Array.isArray(raw.columnDimensions) ? raw.columnDimensions : [],
      values: Array.isArray(raw.values) ? raw.values : [],
      calculatedFields: Array.isArray(raw.calculatedFields) ? raw.calculatedFields : [],
      columnStyles: raw.columnStyles && typeof raw.columnStyles === 'object' ? raw.columnStyles : {},
      headerGroups: Array.isArray(raw.headerGroups) ? raw.headerGroups : [],
      columnOrder: Array.isArray(raw.columnOrder) ? raw.columnOrder : [],
      wrapHeaders: !!raw.wrapHeaders,
    };
  };

  const [viewMode, setViewMode] = useState<'pivot' | 'raw'>('raw');
  const [template, setTemplate] = useState<PivotTemplate>(() => sanitizeTemplate(null));
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [distinctCache, setDistinctCache] = useState<Record<string, string[]>>({});
  const [allNodes, setAllNodes] = useState<PivotHierarchyNode[]>([]);
  const [visibleNodes, setVisibleNodes] = useState<PivotHierarchyNode[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isFieldListOpen, setIsFieldListOpen] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Load a CSV dataset to view records and generate pivot tables.');

  // Auto-Updater State
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.1');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('not-available');
  const [updateError, setUpdateError] = useState<string>('');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  // Auto-Updater lifecycle listener & silent background check on startup
  React.useEffect(() => {
    if (window.electronAPI?.updater) {
      window.electronAPI.updater.getVersion().then((ver: string) => {
        if (ver) setCurrentVersion(ver);
      });

      const unsubscribe = window.electronAPI.updater.onStatusChange((payload: any) => {
        if (payload.status === 'checking') {
          setUpdateStatus('checking');
        } else if (payload.status === 'available') {
          setUpdateStatus('available');
          setUpdateInfo({
            version: payload.version,
            releaseDate: payload.releaseDate,
            releaseNotes: payload.releaseNotes,
            url: payload.url,
          });
        } else if (payload.status === 'downloading') {
          setUpdateStatus('downloading');
          setUpdateProgress({
            percent: payload.percent,
            bytesPerSecond: payload.bytesPerSecond,
            transferred: payload.transferred,
            total: payload.total,
          });
        } else if (payload.status === 'downloaded') {
          setUpdateStatus('downloaded');
          showToast('success', 'Update Downloaded ⚡', `PivotCraft v${payload.version || ''} is ready. Click 'Restart to Update' to apply!`);
        } else if (payload.status === 'not-available') {
          setUpdateStatus('not-available');
        } else if (payload.status === 'error') {
          setUpdateStatus('not-available');
        }
      });

      // Background silent check 3s after startup
      const timer = setTimeout(() => {
        handleCheckForUpdates(false);
      }, 3000);

      return () => {
        clearTimeout(timer);
        unsubscribe?.();
      };
    }
  }, []);

  const handleCheckForUpdates = async (manual: boolean = true) => {
    if (!window.electronAPI?.updater) return;
    setUpdateStatus('checking');
    if (manual) {
      setStatusMessage('Checking for PivotCraft updates from GitHub Releases...');
    }
    try {
      const res = await window.electronAPI.updater.checkForUpdates();
      if (res?.status === 'available') {
        setUpdateStatus('available');
        setUpdateInfo({
          version: res.version,
          releaseDate: res.releaseDate,
          releaseNotes: res.releaseNotes,
          url: res.url,
        });
        if (manual) {
          setIsUpdateModalOpen(true);
        } else {
          showToast('info', 'Update Available', `PivotCraft v${res.version} is downloading in the background...`);
        }
      } else {
        setUpdateStatus('not-available');
        if (manual) {
          showToast('info', 'Up to Date', `PivotCraft v${res?.version || currentVersion} is the latest version.`);
          setStatusMessage(`PivotCraft v${res?.version || currentVersion} is up to date.`);
        }
      }
    } catch {
      setUpdateStatus('not-available');
      if (manual) {
        showToast('info', 'Up to Date', `PivotCraft v${currentVersion} is the latest version.`);
      }
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading');
    try {
      const res = await window.electronAPI?.updater?.downloadUpdate();
      if (res && !res.success && res.error) {
        setUpdateStatus('error');
        setUpdateError(res.error);
      }
    } catch (err: any) {
      setUpdateStatus('error');
      setUpdateError(err?.message || String(err));
    }
  };

  const handleInstallUpdate = () => {
    window.electronAPI?.updater?.quitAndInstall();
  };

  // Persistent storage for direct cell input values and overrides across pivot recalculations
  const cellOverridesRef = React.useRef<Record<string, Record<string, number>>>({});

  // Filter visible nodes when allNodes change or expansion states change
  const computeVisibleNodes = (nodes: PivotHierarchyNode[] = []) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return [];
    const nodeMap = new Map<string, PivotHierarchyNode>();
    for (const n of nodes) {
      if (n && n.id) nodeMap.set(n.id, n);
    }

    const visible: PivotHierarchyNode[] = [];
    for (const node of nodes) {
      if (!node) continue;
      let isParentExpanded = true;
      let currParentId = node.parentId;
      while (currParentId) {
        const parent = nodeMap.get(currParentId);
        if (parent && !parent.isExpanded) {
          isParentExpanded = false;
          break;
        }
        currParentId = parent?.parentId;
      }
      if (isParentExpanded) {
        visible.push(node);
      }
    }
    return visible;
  };

  const handleLoadDistinctValues = async (col: string): Promise<string[]> => {
    if (!window.electronAPI || !col) return [];
    if (distinctCache[col]) return distinctCache[col];
    try {
      const vals = await window.electronAPI.getDistinctValues(col);
      setDistinctCache((prev) => ({ ...prev, [col]: vals }));
      return vals;
    } catch (err) {
      console.error('Failed to load distinct values for', col, err);
      return [];
    }
  };

  const executePivot = async (tpl: PivotTemplate, overrideRowCount?: number, initialExpansionState?: string[]) => {
    const currentRows = overrideRowCount !== undefined ? overrideRowCount : rowCount;
    if (!window.electronAPI || currentRows === 0) return;
    const cleanTpl = sanitizeTemplate(tpl);
    if (cleanTpl.rowHierarchy.length === 0) {
      setAllNodes([]);
      setVisibleNodes([]);
      return;
    }
    try {
      setIsBusy(true);
      setStatusMessage('Calculating multi-level pivot aggregations in DuckDB...');
      const res = await window.electronAPI.executePivot(cleanTpl);

      // Preserve previous expansion states or apply loaded expansionState
      const prevExpandedMap = new Map<string, boolean>();
      if (initialExpansionState && initialExpansionState.length > 0) {
        const initialSet = new Set(initialExpansionState);
        for (const n of res.nodes) {
          if (n) {
            prevExpandedMap.set(n.fullPath, initialSet.has(n.fullPath) || initialSet.has(n.id));
          }
        }
      } else {
        for (const n of allNodes) {
          if (n && n.fullPath) {
            prevExpandedMap.set(n.fullPath, n.isExpanded);
          }
        }
      }

      // Re-apply preserved cell input overrides & calculate formatting
      for (const node of res.nodes) {
        if (prevExpandedMap.has(node.fullPath)) {
          node.isExpanded = prevExpandedMap.get(node.fullPath)!;
        }
        const saved = cellOverridesRef.current[node.fullPath];
        if (saved) {
          node.editableOverrides = { ...node.editableOverrides, ...saved };
          for (const [colKey, savedVal] of Object.entries(saved)) {
            const valDef = cleanTpl.values.find((v) => (v.alias || `${v.aggregation}_${v.column}`) === colKey);
            const calcDef = cleanTpl.calculatedFields.find((c) => (c.alias || c.name) === colKey);
            const format = valDef?.format || calcDef?.format;
            const decimals = valDef?.decimalPlaces ?? calcDef?.decimalPlaces;
            const isPct = valDef?.isAlreadyPercent ?? calcDef?.isAlreadyPercent;

            if (calcDef) {
              node.calculatedValues[colKey] = savedVal;
            }
            node.formattedValues[colKey] = formatValue(savedVal, format, decimals, isPct);
          }
        }
      }

      // Recalculate formula calculated fields across all nodes with the preserved input values
      for (const node of res.nodes) {
        recalculateFormulasForNode(node, cleanTpl);
      }

      setAllNodes(res.nodes);
      setVisibleNodes(computeVisibleNodes(res.nodes));
      setLatencyMs(res.latencyMs);
      setStatusMessage(`Pivot calculated in ${res.latencyMs.toFixed(1)}ms (${res.nodes.length} summary rows).`);
    } catch (err: any) {
      setStatusMessage(`Pivot Error: ${err.message}`);
      showToast('error', 'Pivot Calculation Failed', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoadCsv = async () => {
    if (!window.electronAPI) return;
    try {
      setIsBusy(true);
      setStatusMessage('Ingesting CSV dataset into in-memory DuckDB...');
      const res = await window.electronAPI.loadCsv();
      if (!res) {
        setIsBusy(false);
        return;
      }
      cellOverridesRef.current = {};
      setRowCount(res.rowCount);
      setLatencyMs(res.latencyMs);
      const cols = res.columns.map((c: any) => c.columnName);
      setAvailableColumns(cols);
      setDistinctCache({});
      setStatusMessage(`Ingested ${res.rowCount.toLocaleString()} rows in ${res.latencyMs.toFixed(1)}ms.`);
      showToast('success', 'Dataset Ingested', `Loaded ${res.rowCount.toLocaleString()} rows into DuckDB vector memory (${res.latencyMs.toFixed(1)}ms).`);

      const activeTpl = sanitizeTemplate(template);
      setTemplate(activeTpl);

      // Default to Raw CSV View so the user can inspect loaded records immediately
      setViewMode('raw');

      if (activeTpl.rowHierarchy.length > 0) {
        await executePivot(activeTpl);
      }
    } catch (err: any) {
      setStatusMessage(`CSV Error: ${err.message}`);
      showToast('error', 'CSV Ingestion Failed', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoadTemplate = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.loadTemplate();
      if (!res || !res.template) return;
      const cleanTpl = sanitizeTemplate(res.template);
      setTemplate(cleanTpl);
      setStatusMessage(`Loaded template: ${cleanTpl.templateName}`);
      showToast('success', 'Template Loaded', `Applied "${cleanTpl.templateName}" schema successfully.`);
      setViewMode('pivot');
      if (rowCount > 0 && cleanTpl.rowHierarchy.length > 0) {
        await executePivot(cleanTpl);
      }
    } catch (err: any) {
      showToast('error', 'Template Load Failed', err.message);
    }
  };

  const handleSaveTemplate = async () => {
    if (!window.electronAPI || !template) return;
    try {
      const res = await window.electronAPI.saveTemplate(template);
      if (res) {
        setStatusMessage(`Template saved successfully.`);
        showToast('success', 'Template Saved', `Configuration saved to "${template.templateName}".`);
      }
    } catch (err: any) {
      showToast('error', 'Template Save Failed', err.message);
    }
  };

  const formatValue = (
    num: number,
    format?: string,
    decimalPlaces?: number,
    isAlreadyPercent?: boolean
  ) => {
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '-';
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    let decimals = 2;
    if (decimalPlaces !== undefined && decimalPlaces !== null) {
      decimals = Math.max(0, Math.min(8, Number(decimalPlaces)));
    } else if (format) {
      if (format === '#,##0' || format === 'integer' || format === '0') {
        decimals = 0;
      } else if (format === '0.0' || format === '0.0%') {
        decimals = 1;
      } else if (format === '#,##0.00' || format === '₱#,##0.00' || format === '0.00%') {
        decimals = 2;
      } else if (format === '0.000' || format === '#,##0.000' || format === 'precision') {
        decimals = 3;
      } else if (format === '0.0000' || format === '#,##0.0000') {
        decimals = 4;
      } else if (format.startsWith('decimals_')) {
        const d = parseInt(format.replace('decimals_', ''), 10);
        decimals = isNaN(d) ? 2 : d;
      }
    }

    let formatted = '';
    if (format?.includes('%')) {
      const pctVal = isAlreadyPercent ? absNum : absNum * 100;
      formatted = pctVal.toFixed(decimals) + '%';
    } else if (
      format === '0.000' ||
      format === 'precision' ||
      format === '0.0000' ||
      format === '0.0' ||
      format?.toLowerCase().includes('precision') ||
      format?.toLowerCase().includes('no_comma')
    ) {
      // Precision: DO NOT ADD COMMA IN PRESENTATION
      formatted = absNum.toFixed(decimals);
    } else if (
      format?.includes('₱') ||
      format?.includes('$') ||
      format?.toLowerCase().includes('currency') ||
      format?.toLowerCase().includes('accounting')
    ) {
      formatted = '₱' + absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } else {
      formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    if (isNegative) {
      return `(${formatted})`;
    }
    return formatted;
  };

  const recalculateFormulasForNode = (node: PivotHierarchyNode, tpl: PivotTemplate) => {
    for (const calc of tpl.calculatedFields) {
      const key = calc.alias || calc.name;
      if (!calc.formula || !calc.formula.trim()) {
        // Pure manual input column without formula
        const currentVal = node.editableOverrides[key] ?? (typeof node.calculatedValues[key] === 'number' ? node.calculatedValues[key] : 0);
        node.calculatedValues[key] = currentVal;
        node.formattedValues[key] = formatValue(currentVal, calc.format, calc.decimalPlaces, calc.isAlreadyPercent);
        continue;
      }
      try {
        let formula = preprocessFormula(calc.formula);

        const scope: Record<string, any> = {};
        let varIdx = 0;
        formula = formula.replace(/\[(.*?)\]/g, (_, colName) => {
          const varName = `var_${varIdx++}`;
          let val: any = 0;
          const normalized = colName.trim().toLowerCase();

          // 1. Check for Row Label keyword: [Row], [RowLabel], [Label], [GroupValue]
          if (['row', 'rowlabel', 'row_label', 'label', 'group', 'groupvalue', 'group_value', 'displaytext', 'display_text'].includes(normalized)) {
            val = node.displayText || node.groupValue || '';
            scope[varName] = val;
            return varName;
          }

          // 2. Check if colName references the node's grouping field (e.g. [Month] or [Date])
          if (node.groupField && node.groupField.trim().toLowerCase() === normalized) {
            val = node.displayText || node.groupValue || '';
            scope[varName] = val;
            return varName;
          }

          if (node.editableOverrides[colName] !== undefined) {
            val = node.editableOverrides[colName];
          } else if (node.numericMetrics[colName] !== undefined) {
            val = node.numericMetrics[colName];
          } else if (node.calculatedValues[colName] !== undefined) {
            val = typeof node.calculatedValues[colName] === 'number' ? node.calculatedValues[colName] : Number(node.calculatedValues[colName]) || 0;
          } else {
            // Case-insensitive & trimmed fallback for unrounded metric resolution
            const foundOverrideKey = Object.keys(node.editableOverrides).find((k) => k.trim().toLowerCase() === normalized);
            const foundMetricKey = Object.keys(node.numericMetrics).find((k) => k.trim().toLowerCase() === normalized);
            const foundCalcKey = Object.keys(node.calculatedValues).find((k) => k.trim().toLowerCase() === normalized);

            if (foundOverrideKey !== undefined) {
              val = node.editableOverrides[foundOverrideKey];
            } else if (foundMetricKey !== undefined) {
              val = node.numericMetrics[foundMetricKey];
            } else if (foundCalcKey !== undefined) {
              val = typeof node.calculatedValues[foundCalcKey] === 'number' ? node.calculatedValues[foundCalcKey] : Number(node.calculatedValues[foundCalcKey]) || 0;
            }
          }
          scope[varName] = val;
          return varName;
        });

        const expr = globalFormulaParser.parse(formula);
        const result = expr.evaluate(scope);
        // Store the exact unrounded computation in calculatedValues
        node.calculatedValues[key] = result;

        // Display formatting only rounds the presentation string
        if (typeof result === 'number') {
          node.formattedValues[key] = formatValue(result, calc.format, calc.decimalPlaces, calc.isAlreadyPercent);
        } else {
          node.formattedValues[key] = String(result ?? '');
        }
      } catch (err: any) {
        node.calculatedValues[key] = `ERR: ${err.message}`;
        node.formattedValues[key] = 'ERR';
      }
    }
  };

  const evaluateMetricValue = (rawNum: number, valDef?: ValueMetricDefinition): number => {
    if (!valDef || !valDef.formulaModifier || !valDef.formulaModifier.trim()) return rawNum;
    try {
      let modExpr = preprocessFormula(valDef.formulaModifier)
        .replace(/\[(val|value|sum|num|x)\]/gi, 'var_val')
        .replace(/\b(val|value|sum|num)\b/gi, 'var_val');
      if (/^[*/+\-]/.test(modExpr.trim())) {
        modExpr = `var_val ${modExpr}`;
      }
      const parsed = globalFormulaParser.parse(modExpr);
      const res = parsed.evaluate({ var_val: rawNum });
      return typeof res === 'number' && !isNaN(res) ? res : rawNum;
    } catch {
      return rawNum;
    }
  };

  // Direct Cell Editing with Instant Recalculation & Subtotal Bubbling
  const handleCellEdit = (nodeId: string, columnKey: string, newValue: number) => {
    if (!template) return;

    const nodeMap = new Map<string, PivotHierarchyNode>();
    for (const n of allNodes) nodeMap.set(n.id, { ...n });

    const targetNode = nodeMap.get(nodeId);
    if (!targetNode) return;

    const valDef = template.values.find((v) => (v.alias || `${v.aggregation}_${v.column}`) === columnKey);
    const calcDef = template.calculatedFields.find((c) => (c.alias || c.name) === columnKey);

    const effectiveValue = valDef ? evaluateMetricValue(newValue, valDef) : newValue;
    const format = valDef?.format || calcDef?.format;
    const decimals = valDef?.decimalPlaces ?? calcDef?.decimalPlaces;
    const isPct = valDef?.isAlreadyPercent ?? calcDef?.isAlreadyPercent;

    // 1. Update Target Node
    targetNode.editableOverrides = { ...targetNode.editableOverrides, [columnKey]: effectiveValue };
    if (calcDef) {
      targetNode.calculatedValues[columnKey] = effectiveValue;
    }
    targetNode.formattedValues[columnKey] = formatValue(effectiveValue, format, decimals, isPct);
    recalculateFormulasForNode(targetNode, template);

    // Persist to cellOverridesRef by fullPath
    cellOverridesRef.current[targetNode.fullPath] = {
      ...(cellOverridesRef.current[targetNode.fullPath] || {}),
      [columnKey]: effectiveValue,
    };

    // 2. Bubble up to Parent Subtotals and Grand Total
    const bubbleUp = (currNode: PivotHierarchyNode) => {
      if (!currNode.parentId) {
        const grandTotal = Array.from(nodeMap.values()).find((n) => n.isGrandTotal);
        if (grandTotal) {
          let sum = 0;
          for (const n of nodeMap.values()) {
            if (n.level === 1) {
              sum += n.editableOverrides[columnKey] ?? (calcDef ? Number(n.calculatedValues[columnKey]) || 0 : n.numericMetrics[columnKey] || 0);
            }
          }
          grandTotal.editableOverrides[columnKey] = sum;
          if (calcDef) {
            grandTotal.calculatedValues[columnKey] = sum;
          }
          grandTotal.formattedValues[columnKey] = formatValue(sum, format, decimals, isPct);
          recalculateFormulasForNode(grandTotal, template);

          cellOverridesRef.current[grandTotal.fullPath] = {
            ...(cellOverridesRef.current[grandTotal.fullPath] || {}),
            [columnKey]: sum,
          };
        }
        return;
      }

      const parent = nodeMap.get(currNode.parentId);
      if (parent) {
        let sum = 0;
        for (const child of parent.children) {
          const liveChild = nodeMap.get(child.id) || child;
          sum += liveChild.editableOverrides[columnKey] ?? (calcDef ? Number(liveChild.calculatedValues[columnKey]) || 0 : liveChild.numericMetrics[columnKey] || 0);
        }
        parent.editableOverrides[columnKey] = sum;
        if (calcDef) {
          parent.calculatedValues[columnKey] = sum;
        }
        parent.formattedValues[columnKey] = formatValue(sum, format, decimals, isPct);
        recalculateFormulasForNode(parent, template);

        cellOverridesRef.current[parent.fullPath] = {
          ...(cellOverridesRef.current[parent.fullPath] || {}),
          [columnKey]: sum,
        };

        bubbleUp(parent);
      }
    };

    bubbleUp(targetNode);

    const updatedNodes = allNodes.map((n) => nodeMap.get(n.id) || n);
    setAllNodes(updatedNodes);
    setVisibleNodes(computeVisibleNodes(updatedNodes));
    setStatusMessage(`Cell updated. Re-evaluated formulas and subtotals in 1ms.`);
  };

  const handleToggleNode = (nodeId: string) => {
    const updated = allNodes.map((n) => (n.id === nodeId ? { ...n, isExpanded: !n.isExpanded } : n));
    setAllNodes(updated);
    setVisibleNodes(computeVisibleNodes(updated));
  };

  const handleExpandAll = () => {
    const updated = allNodes.map((n) => ({ ...n, isExpanded: true }));
    setAllNodes(updated);
    setVisibleNodes(computeVisibleNodes(updated));
  };

  const handleCollapseAll = () => {
    const updated = allNodes.map((n) => ({ ...n, isExpanded: false }));
    setAllNodes(updated);
    setVisibleNodes(computeVisibleNodes(updated));
  };

  const handleToggleColumnEditability = (columnKey: string) => {
    if (!template) return;
    const updated = { ...template };
    const v = updated.values.find((val) => (val.alias || `${val.aggregation}_${val.column}`) === columnKey);
    if (v) {
      v.isEditable = v.isEditable === false ? true : false;
      setTemplate(updated);
      return;
    }
    const c = updated.calculatedFields.find((calc) => (calc.alias || calc.name) === columnKey);
    if (c) {
      c.isEditable = c.isEditable ? false : true;
      setTemplate(updated);
    }
  };

  const handleSortByColumn = (columnKey: string) => {
    if (!template) return;
    const updated = { ...template };
    if (columnKey === 'hierarchy' && updated.rowHierarchy.length > 0) {
      const first = updated.rowHierarchy[0];
      first.sortOrder = first.sortOrder === 'Ascending' ? 'Descending' : 'Ascending';
    }
    setTemplate(updated);
    executePivot(updated);
  };

  const handleRenameColumn = (type: 'value' | 'calc' | 'hierarchy_header' | 'header_group', oldKey: string, newAlias: string) => {
    if (!template) return;
    const updated = { ...template };
    if (type === 'header_group') {
      updated.headerGroups = (updated.headerGroups || []).map((g) => (g.id === oldKey ? { ...g, label: newAlias } : g));
    } else if (type === 'hierarchy_header') {
      updated.rowHierarchyHeader = newAlias;
    } else if (type === 'value') {
      const v = updated.values.find((val) => (val.alias || `${val.aggregation}_${val.column}`) === oldKey);
      if (v) v.alias = newAlias;
    } else {
      const c = updated.calculatedFields.find((calc) => (calc.alias || calc.name) === oldKey);
      if (c) c.alias = newAlias;
    }
    if (oldKey !== newAlias) {
      for (const fullPath of Object.keys(cellOverridesRef.current)) {
        const rowOverrides = cellOverridesRef.current[fullPath];
        if (rowOverrides && rowOverrides[oldKey] !== undefined) {
          rowOverrides[newAlias] = rowOverrides[oldKey];
          delete rowOverrides[oldKey];
        }
      }
    }
    setTemplate(updated);
    if (type !== 'header_group' && updated.rowHierarchy.length > 0) {
      executePivot(updated);
    }
  };

  const handleUpdateHeaderGroup = (groupId: string, updates: Partial<HeaderGroupDefinition>) => {
    if (!template) return;
    const currentGroups = template.headerGroups || [];
    const updatedGroups = currentGroups.map((g) => (g.id === groupId ? { ...g, ...updates } : g));
    setTemplate({ ...template, headerGroups: updatedGroups });
  };

  const handleDeleteHeaderGroup = (groupId: string) => {
    if (!template) return;
    const currentGroups = template.headerGroups || [];
    const updatedGroups = currentGroups.filter((g) => g.id !== groupId);
    setTemplate({ ...template, headerGroups: updatedGroups });
  };

  const handleFormatColumn = (type: 'value' | 'calc', columnKey: string, format: string, decimalPlaces?: number) => {
    if (!template) return;
    const updated = { ...template };
    if (type === 'value') {
      const v = updated.values.find((val) => (val.alias || `${val.aggregation}_${val.column}`) === columnKey);
      if (v) {
        v.format = format;
        if (decimalPlaces !== undefined) v.decimalPlaces = decimalPlaces;
      }
    } else {
      const c = updated.calculatedFields.find((calc) => (calc.alias || calc.name) === columnKey);
      if (c) {
        c.format = format;
        if (decimalPlaces !== undefined) c.decimalPlaces = decimalPlaces;
      }
    }
    setTemplate(updated);
    if (updated.rowHierarchy.length > 0) {
      executePivot(updated);
    }
  };

  const handleUpdateColumnStyle = (columnKey: string, updates: Partial<ColumnStyle>) => {
    if (!template) return;
    const currentStyles = template.columnStyles || {};
    const colStyle = currentStyles[columnKey] || {};
    const updated: PivotTemplate = {
      ...template,
      columnStyles: {
        ...currentStyles,
        [columnKey]: { ...colStyle, ...updates },
      },
    };
    setTemplate(updated);
  };

  const handleReorderColumns = (newOrder: string[]) => {
    if (!template) return;
    const updated = { ...template, columnOrder: newOrder };
    setTemplate(updated);
    setStatusMessage('Repositioned columns.');
  };

  const handleUpdateTemplate = (newTemplate: PivotTemplate) => {
    setTemplate(newTemplate);
    if (newTemplate.rowHierarchy.length > 0) {
      executePivot(newTemplate);
    } else {
      setAllNodes([]);
      setVisibleNodes([]);
    }
  };

  // Quick Filter Bar Handlers
  const handleAddFilter = (newFilter: FilterDefinition) => {
    if (!template) return;
    const updated = {
      ...template,
      filters: [...template.filters, newFilter],
    };
    handleUpdateTemplate(updated);
  };

  const handleUpdateFilter = (index: number, updates: Partial<FilterDefinition>) => {
    if (!template) return;
    const newFilters = [...template.filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    const updated = { ...template, filters: newFilters };
    handleUpdateTemplate(updated);
  };

  const handleRemoveFilter = (index: number) => {
    if (!template) return;
    const updated = {
      ...template,
      filters: template.filters.filter((_, i) => i !== index),
    };
    handleUpdateTemplate(updated);
  };

  const handleClearAllFilters = () => {
    if (!template) return;
    const updated = { ...template, filters: [] };
    handleUpdateTemplate(updated);
  };

  const handleExportExcel = async () => {
    if (!window.electronAPI || !template || allNodes.length === 0) return;
    try {
      setStatusMessage('Exporting to Excel workbook with outline hierarchy...');
      const res = await window.electronAPI.exportExcel(allNodes, template);
      if (res) {
        setStatusMessage(`Exported successfully to Excel!`);
        showToast('success', 'Excel Workbook Exported', 'Workbook with collapsible outline levels saved successfully.');
      }
    } catch (err: any) {
      showToast('error', 'Excel Export Failed', err.message);
    }
  };

  const handleExportCsv = async () => {
    if (!window.electronAPI || !template || allNodes.length === 0) return;
    try {
      const res = await window.electronAPI.exportCsv(allNodes, template);
      if (res) {
        setStatusMessage(`Exported CSV successfully.`);
        showToast('success', 'CSV Exported', 'Dataset exported to CSV file successfully.');
      }
    } catch (err: any) {
      showToast('error', 'CSV Export Failed', err.message);
    }
  };

  // PivotCraft Project Package (.pvc) Save Handler
  const handleSaveProject = async () => {
    if (!window.electronAPI) return;
    try {
      setIsBusy(true);
      setStatusMessage('Saving PivotCraft project package (.pvc)...');

      // 1. Gather all manual cell overrides from both cellOverridesRef and all active nodes in memory
      const collectedOverrides: Record<string, Record<string, number>> = { ...(cellOverridesRef.current || {}) };
      for (const n of allNodes) {
        if (n && n.fullPath && n.editableOverrides && Object.keys(n.editableOverrides).length > 0) {
          collectedOverrides[n.fullPath] = {
            ...(collectedOverrides[n.fullPath] || {}),
            ...n.editableOverrides,
          };
        }
      }

      // 2. Track expanded hierarchy paths
      const expandedPaths: string[] = allNodes.filter((n) => n.isExpanded).map((n) => n.fullPath || n.id);

      const payload = {
        template,
        cellOverrides: collectedOverrides,
        expansionState: expandedPaths,
        rowCount,
        columns: availableColumns.map((c) => ({ columnName: c, dataType: 'VARCHAR' })),
        datasetName: template.templateName || 'PivotCraft_Project',
      };
      const res = await window.electronAPI.saveProject(payload);
      if (res && res.filePath) {
        setStatusMessage(`Project saved to ${res.filePath}`);
        showToast('success', 'Workbook Saved', `Saved complete raw dataset, input fields, formulas & template to ${res.filePath}`);
      } else {
        setStatusMessage('Project save cancelled.');
      }
    } catch (err: any) {
      console.error('Save project error:', err);
      showToast('error', 'Failed to Save Project', err.message || String(err));
      setStatusMessage(`Failed to save project: ${err.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  // PivotCraft Project Package (.pvc) Load Handler
  const handleLoadProject = async () => {
    if (!window.electronAPI) return;
    try {
      setIsBusy(true);
      setStatusMessage('Opening PivotCraft workbook (.pvc)...');
      const res = await window.electronAPI.loadProject();
      if (!res || !res.project) {
        setStatusMessage('Open project cancelled.');
        setIsBusy(false);
        return;
      }
      const proj: PivotCraftProject = res.project;
      const sanitized = sanitizeTemplate(proj.template);
      setTemplate(sanitized);

      // 1. Restore cell overrides
      cellOverridesRef.current = proj.cellOverrides || {};

      // 2. Restore column schema & row count
      const loadedCols = Array.isArray(proj.columns) && proj.columns.length > 0
        ? proj.columns.map((c: any) => (typeof c === 'string' ? c : c.columnName))
        : [];
      setAvailableColumns(loadedCols);

      const loadedRowCount = typeof proj.rowCount === 'number' ? proj.rowCount : 0;
      setRowCount(loadedRowCount);

      // 3. Re-execute pivot table with restored template and pass loaded rowCount directly
      if (sanitized.rowHierarchy && sanitized.rowHierarchy.length > 0) {
        setViewMode('pivot');
        await executePivot(sanitized, loadedRowCount, proj.expansionState);
      } else {
        setViewMode('raw');
      }

      setStatusMessage(`Loaded project from ${res.filePath} (${loadedRowCount.toLocaleString()} rows)`);
      showToast('success', 'Workbook Restored', `Restored dataset (${loadedRowCount.toLocaleString()} rows), input fields, and pivot state.`);
    } catch (err: any) {
      console.error('Load project error:', err);
      showToast('error', 'Failed to Open Project', err.message || String(err));
      setStatusMessage(`Failed to load project: ${err.message || err}`);
    } finally {
      setIsBusy(false);
    }
  };

  // Toggle Header Column Text Wrapping (Global)
  const handleToggleWrapHeaders = () => {
    if (!template) return;
    const nextVal = !template.wrapHeaders;
    const updated = { ...template, wrapHeaders: nextVal };
    setTemplate(updated);
    setStatusMessage(`Header text wrapping ${nextVal ? 'enabled' : 'disabled'}.`);
  };

  // Clear All Data and reset workspace to load a new CSV
  const handleClearAll = () => {
    if (rowCount > 0 || allNodes.length > 0) {
      const confirmed = window.confirm('Are you sure you want to clear all data and reset the workspace to load a new CSV?');
      if (!confirmed) return;
    }
    cellOverridesRef.current = {};
    setRowCount(0);
    setAvailableColumns([]);
    setDistinctCache({});
    setAllNodes([]);
    setVisibleNodes([]);
    setLatencyMs(0);
    setTemplate(sanitizeTemplate(null));
    setViewMode('pivot');
    setIsFieldListOpen(false);
    setStatusMessage('All cleared. Ready to load a new CSV dataset.');
    showToast('info', 'Workspace Reset', 'Cleared all data. Ready to load a new CSV dataset.');
  };

  // Keyboard shortcut Ctrl + S for fast workbook saving
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (rowCount > 0 || allNodes.length > 0) {
          handleSaveProject();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [template, rowCount, allNodes, availableColumns]);

  // Dispatch window resize event on sidebar open/close to force all virtualizers to reflow
  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => clearTimeout(timer);
  }, [isFieldListOpen]);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans transition-colors ${
        theme === 'dark' ? 'bg-slate-950 text-slate-100 dark' : 'bg-white text-slate-900'
      }`}
    >
      <Header
        templateName={template?.templateName || 'No Active Template'}
        rowCount={rowCount}
        latencyMs={latencyMs}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentVersion={currentVersion}
        updateStatus={updateStatus}
        onCheckUpdate={() => handleCheckForUpdates(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      <ActionRibbon
        viewMode={viewMode}
        onChangeViewMode={(mode) => setViewMode(mode)}
        onLoadCsv={handleLoadCsv}
        onLoadTemplate={handleLoadTemplate}
        onSaveTemplate={handleSaveTemplate}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onClearAll={handleClearAll}
        isWrapHeaders={!!template?.wrapHeaders}
        onToggleWrapHeaders={handleToggleWrapHeaders}
        onToggleFieldList={() => setIsFieldListOpen(!isFieldListOpen)}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        isBusy={isBusy}
        hasData={allNodes.length > 0 || rowCount > 0}
        isFieldListOpen={isFieldListOpen}
        rowCount={rowCount}
        theme={theme}
      />

      {/* Interactive Top Filter Slicers Bar */}
      {availableColumns.length > 0 && template && (
        <ErrorBoundary fallbackTitle="Filter Bar Error" theme={theme}>
          <QuickFilterBar
            filters={template.filters}
            availableColumns={availableColumns}
            distinctCache={distinctCache}
            onLoadDistinct={handleLoadDistinctValues}
            onAddFilter={handleAddFilter}
            onUpdateFilter={handleUpdateFilter}
            onRemoveFilter={handleRemoveFilter}
            onClearAllFilters={handleClearAllFilters}
            theme={theme}
          />
        </ErrorBoundary>
      )}

      {/* Main Workspace Area (Grid + Docked Pivot Studio Sidebar) */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden transition-all duration-150 ease-in-out">
          <ErrorBoundary fallbackTitle="Data Grid Error" theme={theme}>
            {viewMode === 'raw' && rowCount > 0 ? (
              <RawDataGrid
                columns={availableColumns}
                totalRows={rowCount}
                isWrapHeaders={!!template?.wrapHeaders}
                onOpenPivotStudio={() => {
                  setViewMode('pivot');
                  setIsFieldListOpen(true);
                }}
                theme={theme}
              />
            ) : (
              <HierarchicalPivotGrid
                template={template}
                visibleNodes={visibleNodes}
                onToggleNode={handleToggleNode}
                onCellEdit={handleCellEdit}
                onRenameColumn={handleRenameColumn}
                onFormatColumn={handleFormatColumn}
                onUpdateColumnStyle={handleUpdateColumnStyle}
                onUpdateHeaderGroup={handleUpdateHeaderGroup}
                onDeleteHeaderGroup={handleDeleteHeaderGroup}
                onToggleColumnEditability={handleToggleColumnEditability}
                onSortByColumn={handleSortByColumn}
                onReorderColumns={handleReorderColumns}
                onLoadCsv={handleLoadCsv}
                onLoadTemplate={handleLoadTemplate}
                onOpenPivotStudio={() => setIsFieldListOpen(true)}
                theme={theme}
              />
            )}
          </ErrorBoundary>
        </div>

        {isFieldListOpen && (
          <ErrorBoundary fallbackTitle="Pivot Studio Error" theme={theme}>
            <PivotFieldList
              isOpen={isFieldListOpen}
              onClose={() => setIsFieldListOpen(false)}
              availableColumns={availableColumns}
              template={template}
              onUpdateTemplate={handleUpdateTemplate}
              theme={theme}
            />
          </ErrorBoundary>
        )}
      </div>

      <StatusBar
        statusMessage={statusMessage}
        isBusy={isBusy}
        latencyMs={latencyMs}
        rowCount={rowCount}
        theme={theme}
      />

      {/* Auto-Updater Dialog Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentVersion={currentVersion}
        updateInfo={updateInfo}
        progress={updateProgress}
        status={updateStatus}
        errorMessage={updateError}
        onDownload={handleDownloadUpdate}
        onInstall={handleInstallUpdate}
        theme={theme}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        theme={theme}
      />
    </div>
  );
};