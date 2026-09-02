import { createRequire } from 'module';
import { Parser } from 'expr-eval';
import { PivotTemplate, PivotHierarchyNode, FilterDefinition, ValueMetricDefinition, CalculatedFieldDefinition } from '../../src/types/pivot.js';
import { createConfiguredParser, preprocessFormula } from '../../src/utils/formulaEngine.js';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');

export class DuckDbPivotEngine {
  private db: any;
  private conn: any;
  private parser: Parser;

  constructor() {
    this.db = new duckdb.Database(':memory:');
    this.conn = this.db.connect();
    this.parser = createConfiguredParser();
  }

  public query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res || []);
      });
    });
  }

  public exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.exec(sql, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async loadCsv(csvFilePath: string, tableName = 'source_data'): Promise<number> {
    const sanitizedPath = csvFilePath.replace(/\\/g, '/').replace(/'/g, "''");
    await this.exec(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${sanitizedPath}', header=true, ignore_errors=true);`);
    const countRes = await this.query(`SELECT COUNT(*) as cnt FROM ${tableName};`);
    return Number(countRes[0]?.cnt || 0);
  }

  public async getColumns(tableName = 'source_data'): Promise<Array<{ columnName: string; dataType: string }>> {
    const rows = await this.query(`DESCRIBE ${tableName};`);
    return rows.map((r) => ({
      columnName: r.column_name,
      dataType: r.column_type,
    }));
  }

  public parseTenorDays(val: string): number | null {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim().toUpperCase();

    if (clean === 'O/N' || clean === 'ON' || clean === 'OVERNIGHT') return 1;
    if (clean === 'T/N' || clean === 'TN') return 2;
    if (clean === 'S/N' || clean === 'SN' || clean === 'SPOT/NEXT') return 3;
    if (clean === 'SPOT' || clean === 'TOD' || clean === 'TOM') return 0.5;

    // Single tenor: e.g. 1D, 2W, 1M, 3M, 6M, 1Y, 2Y, 3Y, 10Y
    const singleMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([DWMY]|DAYS?|WEEKS?|WKS?|MONTHS?|MOS?|MTHS?|YEARS?|YRS?)$/);
    if (singleMatch) {
      const num = parseFloat(singleMatch[1]);
      const unit = singleMatch[2];
      if (unit.startsWith('D')) return num * 1;
      if (unit.startsWith('W')) return num * 7;
      if (unit.startsWith('M')) return num * 30.4375;
      if (unit.startsWith('Y')) return num * 365.25;
    }

    // Tenor range bucket: "O/N to 2W", "1M - 3M", "1Y to 2Y", "1M TO 6M", etc.
    const parts = clean.split(/\s+(?:TO|-)\s+/);
    if (parts.length === 2) {
      const t1 = this.parseTenorDays(parts[0]);
      const t2 = this.parseTenorDays(parts[1]);
      if (t1 !== null && t2 !== null) {
        return t1 + (t2 - t1) * 0.001;
      } else if (t1 !== null) {
        return t1;
      } else if (t2 !== null) {
        return t2;
      }
    }

    return null;
  }

  public parseMonthIndex(val: string): number | null {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim().toLowerCase();
    const months: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12,
    };
    return months[clean] ?? null;
  }

  public parseQuarterIndex(val: string): number | null {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim().toUpperCase();
    const m = clean.match(/^Q([1-4])/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  public compareHierarchyValues(
    aRaw: string | null | undefined,
    bRaw: string | null | undefined,
    sortOrder: 'Ascending' | 'Descending' = 'Ascending'
  ): number {
    const isDesc = sortOrder === 'Descending';
    const a = aRaw !== null && aRaw !== undefined ? String(aRaw).trim() : '';
    const b = bRaw !== null && bRaw !== undefined ? String(bRaw).trim() : '';

    const aIsBlank = !a || a === '(blanks)' || a === '(blank)' || a.toLowerCase() === 'null';
    const bIsBlank = !b || b === '(blanks)' || b === '(blank)' || b.toLowerCase() === 'null';

    // Blanks always sort to the very end
    if (aIsBlank && bIsBlank) return 0;
    if (aIsBlank) return 1;
    if (bIsBlank) return -1;

    // 1. Tenor / Duration comparison (e.g. O/N, 2W, 1M, 3M, 6M, 1Y, 2Y, 3Y or O/N to 2W)
    const tenorA = this.parseTenorDays(a);
    const tenorB = this.parseTenorDays(b);
    if (tenorA !== null && tenorB !== null) {
      return isDesc ? tenorB - tenorA : tenorA - tenorB;
    }

    // 2. Month index comparison (e.g. Jan, Feb, Mar...)
    const monthA = this.parseMonthIndex(a);
    const monthB = this.parseMonthIndex(b);
    if (monthA !== null && monthB !== null) {
      return isDesc ? monthB - monthA : monthA - monthB;
    }

    // 3. Quarter comparison (e.g. Q1, Q2, Q3, Q4)
    const qA = this.parseQuarterIndex(a);
    const qB = this.parseQuarterIndex(b);
    if (qA !== null && qB !== null) {
      return isDesc ? qB - qA : qA - qB;
    }

    // 4. Pure numeric comparison
    const cleanNumA = a.replace(/,/g, '');
    const cleanNumB = b.replace(/,/g, '');
    const numA = Number(cleanNumA);
    const numB = Number(cleanNumB);
    if (cleanNumA !== '' && cleanNumB !== '' && !isNaN(numA) && !isNaN(numB)) {
      return isDesc ? numB - numA : numA - numB;
    }

    // 5. Date comparison
    const dateA = this.parseFlexibleDate(a);
    const dateB = this.parseFlexibleDate(b);
    if (dateA && dateB) {
      return isDesc ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    }

    // 6. Natural Alphanumeric Collator (e.g. "Item 1", "Item 2", "Item 10")
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const cmp = collator.compare(a, b);
    return isDesc ? -cmp : cmp;
  }

  public async getDistinctValues(column: string, limit = 100): Promise<string[]> {
    const sanitizedCol = `"${column.replace(/"/g, '""')}"`;
    const rows = await this.query(`SELECT DISTINCT ${sanitizedCol} as val FROM source_data WHERE ${sanitizedCol} IS NOT NULL LIMIT ${limit};`);
    const values = rows.map((r) => String(r.val));
    values.sort((a, b) => this.compareHierarchyValues(a, b, 'Ascending'));
    return values;
  }

  public async getRawData(
    offset = 0,
    limit = 1000,
    sortColumn?: string,
    sortDir: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ rows: any[]; totalCount: number }> {
    let orderClause = '';
    if (sortColumn) {
      orderClause = `ORDER BY "${sortColumn.replace(/"/g, '""')}" ${sortDir}`;
    }
    const sql = `SELECT * FROM source_data ${orderClause} LIMIT ${limit} OFFSET ${offset};`;
    const rows = await this.query(sql);
    const countRes = await this.query(`SELECT COUNT(*) as cnt FROM source_data;`);
    return {
      rows,
      totalCount: Number(countRes[0]?.cnt || 0),
    };
  }

  private parseFlexibleDate(str: string): Date | null {
    if (!str || str === '(blank)') return null;
    const clean = str.trim();

    // 1. Try DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);

      let day = p1;
      let month = p2 - 1;
      if (p2 > 12 && p1 <= 12) {
        day = p2;
        month = p1 - 1;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // 2. Try YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // 3. Fallback to native Date
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  public formatRowValue(val: any, format?: string): string {
    if (
      val === null ||
      val === undefined ||
      val === '' ||
      String(val).trim() === '' ||
      String(val).toLowerCase() === 'null' ||
      String(val).toLowerCase() === '(blank)' ||
      String(val).toLowerCase() === '(blanks)'
    ) {
      return '(blanks)';
    }
    const str = String(val);
    if (str === '(blanks)' || str === '(blank)' || str === '(Blank)') return '(blanks)';
    if (!format || format === 'none') return str;
    switch (format) {
      case 'uppercase':
        return str.toUpperCase();
      case 'lowercase':
        return str.toLowerCase();
      case 'capitalize':
      case 'titlecase':
        return str.replace(/\b\w/g, (c) => c.toUpperCase());
      case 'date_ymd': {
        const d = this.parseFlexibleDate(str);
        if (!d) return str;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      case 'date_month_year': {
        const d = this.parseFlexibleDate(str);
        return d ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : str;
      }
      case 'date_quarter': {
        const d = this.parseFlexibleDate(str);
        if (!d) return str;
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} ${d.getFullYear()}`;
      }
      case 'date_year': {
        const d = this.parseFlexibleDate(str);
        return d ? String(d.getFullYear()) : str;
      }
      case '₱#,##0.00':
      case '$#,##0.00': {
        const num = parseFloat(str);
        return isNaN(num) ? str : '₱' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      case '#,##0': {
        const num = parseFloat(str);
        return isNaN(num) ? str : num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      }
      default:
        return str;
    }
  }

  public async executePivot(template: PivotTemplate): Promise<PivotHierarchyNode[]> {
    if (!template.rowHierarchy || template.rowHierarchy.length === 0) {
      throw new Error('At least one Row Hierarchy field is required.');
    }

    // Resolve column names case-insensitively against actual table schema in DuckDB
    const dbCols = await this.getColumns();
    const colNameMap = new Map<string, string>();
    for (const c of dbCols) {
      colNameMap.set(c.columnName.toLowerCase().trim(), c.columnName);
    }

    const resolveCol = (colName: string): string => {
      if (!colName) return colName;
      const clean = colName.toLowerCase().trim();
      return colNameMap.get(clean) || colName;
    };

    const resolvedRowHierarchy = template.rowHierarchy.map((r) => ({
      ...r,
      column: resolveCol(r.column),
    }));

    const resolvedValues = (template.values || []).map((v) => ({
      ...v,
      column: resolveCol(v.column),
    }));

    const resolvedFilters = (template.filters || []).map((f) => ({
      ...f,
      column: resolveCol(f.column),
    }));

    const rowCols = resolvedRowHierarchy.map((r) => r.column);
    const whereClause = this.buildWhereClause(resolvedFilters);
    const selectMetrics = this.buildSelectMetrics(resolvedValues);

    // Grouping sets for multi-level hierarchical aggregation
    const groupingSets = ['()'];
    for (let i = 1; i <= rowCols.length; i++) {
      const prefix = rowCols.slice(0, i).map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');
      groupingSets.push(`(${prefix})`);
    }

    const groupByClause = `GROUP BY GROUPING SETS (${groupingSets.join(', ')})`;
    
    // Sort ordering
    const orderItems = resolvedRowHierarchy.map((r) => {
      const dir = r.sortOrder === 'Descending' ? 'DESC' : 'ASC';
      return `"${r.column.replace(/"/g, '""')}" ${dir} NULLS LAST`;
    });
    const orderClause = `ORDER BY ${orderItems.join(', ')}`;

    const selectRowCols = rowCols
      .map((c, i) => `"${c.replace(/"/g, '""')}", GROUPING("${c.replace(/"/g, '""')}") AS "__grp_${i}"`)
      .join(', ');

    const sql = `
      SELECT 
        ${selectRowCols},
        ${selectMetrics}
      FROM source_data
      ${whereClause}
      ${groupByClause}
      ${orderClause};
    `;

    const rawRows = await this.query(sql);

    const nodesByLevel: PivotHierarchyNode[][] = Array.from({ length: rowCols.length + 1 }, () => []);
    let grandTotalNode: PivotHierarchyNode | null = null;
    const nodeMap = new Map<string, PivotHierarchyNode>();
    const nodeParentPathMap = new Map<string, string>();

    let nodeIdCounter = 0;

    for (const row of rawRows) {
      // Calculate level using standard SQL GROUPING() bits: 0 = Grand Total, 1 = Level 1, etc.
      const activeIndices: number[] = [];
      for (let i = 0; i < rowCols.length; i++) {
        if (Number(row[`__grp_${i}`]) === 0) {
          activeIndices.push(i);
        }
      }
      const level = activeIndices.length;

      const rowValues = rowCols.map((c, i) => {
        if (Number(row[`__grp_${i}`]) === 1) return null;
        const val = row[c];
        if (val === null || val === undefined || String(val).trim() === '' || String(val).trim().toLowerCase() === 'null') {
          return '(blanks)';
        }
        return String(val);
      });

      const isGrandTotal = level === 0;
      const isLeaf = level === rowCols.length;
      const isSubtotal = level > 0 && level < rowCols.length;

      let groupField = 'Grand Total';
      let groupValue = 'Grand Total';
      let fullPath = 'Grand Total';
      let currentHierarchy = !isGrandTotal ? template.rowHierarchy[level - 1] : undefined;

      if (!isGrandTotal && currentHierarchy) {
        groupField = currentHierarchy.alias || currentHierarchy.column;
        const rawGroupVal = rowValues[level - 1];
        groupValue = this.formatRowValue(rawGroupVal, currentHierarchy.format);
        fullPath = rowValues
          .slice(0, level)
          .map((v, i) => this.formatRowValue(v, template.rowHierarchy[i]?.format))
          .join(' > ');
      }

      const shouldAppendTotal = currentHierarchy ? currentHierarchy.appendTotalWord !== false : true;
      const displayText = isGrandTotal
        ? 'Grand Total'
        : isSubtotal
          ? (shouldAppendTotal ? `${groupValue} Total` : groupValue)
          : groupValue;

      const node: PivotHierarchyNode = {
        id: `node_${nodeIdCounter++}`,
        level,
        isGrandTotal,
        isSubtotal,
        isLeaf,
        isExpanded: true,
        groupField,
        groupValue,
        displayText,
        fullPath,
        children: [],
        numericMetrics: {},
        calculatedValues: {},
        editableOverrides: {},
        formattedValues: {},
      };

      // Extract numeric values and apply optional formulaModifier
      for (const val of template.values) {
        const metricKey = val.alias || `${val.aggregation}_${val.column}`;
        const rawVal = row[metricKey];
        let numVal = rawVal !== null && rawVal !== undefined ? Number(rawVal) : 0;

        if (val.formulaModifier && val.formulaModifier.trim()) {
          try {
            let modExpr = preprocessFormula(val.formulaModifier)
              .replace(/\[(val|value|sum|num|x)\]/gi, 'var_val')
              .replace(/\b(val|value|sum|num)\b/gi, 'var_val');
            if (/^[*/+\-]/.test(modExpr.trim())) {
              modExpr = `var_val ${modExpr}`;
            }
            const parsed = this.parser.parse(modExpr);
            const res = parsed.evaluate({ var_val: numVal });
            if (typeof res === 'number' && !isNaN(res)) {
              numVal = res;
            }
          } catch (err) {
            console.warn('formulaModifier error:', err);
          }
        }

        node.numericMetrics[metricKey] = numVal;
        node.formattedValues[metricKey] = this.formatValue(numVal, val.format, val.decimalPlaces, val.isAlreadyPercent);
      }

      // Evaluate Calculated Fields
      this.evaluateCalculations(node, template.calculatedFields);

      if (isGrandTotal) {
        grandTotalNode = node;
      } else {
        nodesByLevel[level].push(node);
        nodeMap.set(node.fullPath, node);
      }
    }

    // Attach tree structure (children arrays)
    for (let l = 1; l < rowCols.length; l++) {
      for (const parent of nodesByLevel[l]) {
        parent.children = [];
      }
    }

    for (let l = 2; l <= rowCols.length; l++) {
      for (const child of nodesByLevel[l]) {
        const pathParts = child.fullPath.split(' > ');
        const parentPath = pathParts.slice(0, -1).join(' > ');
        const parent = nodeMap.get(parentPath);
        if (parent) {
          child.parentId = parent.id;
          parent.children.push(child);
        }
      }
    }

    const rootNodes = nodesByLevel[1] || [];

    // Sort hierarchy nodes recursively
    const sortChildrenRecursively = (parentNode: PivotHierarchyNode) => {
      if (!parentNode.children || parentNode.children.length === 0) return;
      const childLevelIdx = parentNode.level; // index in template.rowHierarchy
      const childSort = template.rowHierarchy[childLevelIdx]?.sortOrder || 'Ascending';
      parentNode.children.sort((a, b) => this.compareHierarchyValues(a.groupValue, b.groupValue, childSort));
      for (const child of parentNode.children) {
        sortChildrenRecursively(child);
      }
    };

    for (const root of rootNodes) {
      sortChildrenRecursively(root);
    }

    const resultList: PivotHierarchyNode[] = [];

    const traverse = (current: PivotHierarchyNode) => {
      resultList.push(current);
      for (const child of current.children) {
        traverse(child);
      }
    };

    // Traverse hierarchy branches (Parent totals at the top of their children)
    for (const root of rootNodes) {
      traverse(root);
    }

    // Grand Total is placed at the bottom of the entire table
    if (grandTotalNode) {
      resultList.push(grandTotalNode);
    }

    return resultList;
  }

  public evaluateCalculations(node: PivotHierarchyNode, calculatedFields: CalculatedFieldDefinition[] = []) {
    for (const calc of calculatedFields) {
      const key = calc.alias || calc.name;
      if (!calc.formula || !calc.formula.trim()) {
        // Pure manual input column without formula (defaults to 0 or manual override)
        const val = node.editableOverrides[key] ?? 0;
        node.calculatedValues[key] = val;
        node.formattedValues[key] = this.formatValue(val, calc.format, calc.decimalPlaces, calc.isAlreadyPercent);
        continue;
      }
      try {
        let formula = preprocessFormula(calc.formula);

        // Replace Excel IF(condition, trueVal, falseVal) with ternary (condition ? trueVal : falseVal)
        formula = formula.replace(/\bIF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, '($1 ? $2 : $3)');

        // Replace [Column Name] with variable values
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

        const expr = this.parser.parse(formula);
        const result = expr.evaluate(scope);
        // Store exact unrounded computation in calculatedValues
        node.calculatedValues[key] = result;

        // Display formatting only rounds the presentation string
        if (typeof result === 'number') {
          node.formattedValues[key] = this.formatValue(result, calc.format, calc.decimalPlaces, calc.isAlreadyPercent);
        } else {
          node.formattedValues[key] = String(result ?? '');
        }
      } catch (err: any) {
        node.calculatedValues[key] = `ERR: ${err.message}`;
        node.formattedValues[key] = 'ERR';
      }
    }
  }

  private getDuckDbDateExpr(expr: string): string {
    const raw = `CAST(${expr} AS VARCHAR)`;
    const trimmed = `TRIM(${raw})`;
    const dmy = `NULLIF(REGEXP_EXTRACT(${trimmed}, '^[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}'), '')`;
    const ymd = `NULLIF(REGEXP_EXTRACT(${trimmed}, '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}'), '')`;
    const namedMonth = `NULLIF(REGEXP_EXTRACT(${trimmed}, '^[0-9]{1,2}[-/][A-Za-z]{3,9}[-/][0-9]{2,4}'), '')`;

    return `COALESCE(
      TRY_CAST(${expr} AS DATE),
      CAST(TRY_CAST(${expr} AS TIMESTAMP) AS DATE),
      TRY_CAST(${ymd} AS DATE),
      TRY_STRPTIME(${dmy}, '%d-%m-%Y')::DATE,
      TRY_STRPTIME(${dmy}, '%d/%m/%Y')::DATE,
      TRY_STRPTIME(${dmy}, '%m/%d/%Y')::DATE,
      TRY_STRPTIME(${dmy}, '%m-%d-%Y')::DATE,
      TRY_STRPTIME(${namedMonth}, '%d-%b-%Y')::DATE,
      TRY_STRPTIME(${namedMonth}, '%d-%b-%y')::DATE,
      TRY_STRPTIME(${namedMonth}, '%d-%B-%Y')::DATE,
      TRY_STRPTIME(${namedMonth}, '%d/%b/%Y')::DATE,
      TRY_STRPTIME(${trimmed}, '%Y-%m-%d')::DATE,
      TRY_STRPTIME(${trimmed}, '%d-%m-%Y')::DATE,
      TRY_STRPTIME(${trimmed}, '%d/%m/%Y')::DATE,
      TRY_STRPTIME(${trimmed}, '%m/%d/%Y')::DATE,
      CASE WHEN TRY_CAST(${expr} AS DOUBLE) BETWEEN 30000 AND 60000 THEN (DATE '1899-12-30' + CAST(TRY_CAST(${expr} AS INTEGER) AS INTEGER)) ELSE NULL END
    )`;
  }

  private buildWhereClause(filters: FilterDefinition[] = []): string {
    const activeFilters = filters.filter((f) => f.isEnabled && f.column);
    if (activeFilters.length === 0) return '';

    const conditions: string[] = [];
    for (const f of activeFilters) {
      const col = `"${f.column.replace(/"/g, '""')}"`;
      const val = f.value || '';
      const escapedVal = val.replace(/'/g, "''");

      const colDate = this.getDuckDbDateExpr(col);
      const valDate = this.getDuckDbDateExpr(`'${escapedVal}'`);

      switch (f.operator) {
        case 'Equals':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} = ${valDate})
            OR (${col} = '${escapedVal}')
            OR (CAST(${col} AS VARCHAR) ILIKE '${escapedVal}%')
          )`);
          break;
        case 'NotEquals':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} != ${valDate})
            OR (${colDate} IS NULL AND ${col} != '${escapedVal}')
          )`);
          break;
        case 'GreaterThan':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} > ${valDate})
            OR (${colDate} IS NULL AND ${col} > '${escapedVal}')
          )`);
          break;
        case 'GreaterThanOrEqual':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} >= ${valDate})
            OR (${colDate} IS NULL AND ${col} >= '${escapedVal}')
          )`);
          break;
        case 'LessThan':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} < ${valDate})
            OR (${colDate} IS NULL AND ${col} < '${escapedVal}')
          )`);
          break;
        case 'LessThanOrEqual':
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${colDate} <= ${valDate})
            OR (${colDate} IS NULL AND ${col} <= '${escapedVal}')
          )`);
          break;
        case 'Contains':
          conditions.push(`(CAST(${col} AS VARCHAR) ILIKE '%${escapedVal}%')`);
          break;
        case 'StartsWith':
          conditions.push(`(CAST(${col} AS VARCHAR) ILIKE '${escapedVal}%')`);
          break;
        case 'EndsWith':
          conditions.push(`(CAST(${col} AS VARCHAR) ILIKE '%${escapedVal}')`);
          break;
        case 'IsBlank':
          conditions.push(`(${col} IS NULL OR TRIM(CAST(${col} AS VARCHAR)) = '' OR LOWER(CAST(${col} AS VARCHAR)) = 'null' OR LOWER(CAST(${col} AS VARCHAR)) = '(blanks)' OR LOWER(CAST(${col} AS VARCHAR)) = '(blank)')`);
          break;
        case 'IsNotBlank':
          conditions.push(`(${col} IS NOT NULL AND TRIM(CAST(${col} AS VARCHAR)) != '' AND LOWER(CAST(${col} AS VARCHAR)) != 'null' AND LOWER(CAST(${col} AS VARCHAR)) != '(blanks)' AND LOWER(CAST(${col} AS VARCHAR)) != '(blank)')`);
          break;
        case 'Between': {
          const val2 = (f.value2 || '').replace(/'/g, "''");
          const val2Date = this.getDuckDbDateExpr(`'${val2}'`);
          conditions.push(`(
            (${colDate} IS NOT NULL AND ${valDate} IS NOT NULL AND ${val2Date} IS NOT NULL AND ${colDate} BETWEEN ${valDate} AND ${val2Date})
            OR (${colDate} IS NULL AND ${col} BETWEEN '${escapedVal}' AND '${val2}')
          )`);
          break;
        }
        case 'In': {
          const items = val.split(',').map((v) => v.trim().replace(/'/g, "''")).filter(Boolean);
          if (items.length > 0) {
            const strList = items.map((v) => `'${v}'`).join(', ');
            const numItems = items.map((v) => Number(v)).filter((n) => !isNaN(n));
            const numCondition = numItems.length > 0 ? ` OR TRY_CAST(${col} AS DOUBLE) IN (${numItems.join(', ')})` : '';

            const dateItems = items.filter((v) => /[-/]/.test(v));
            if (dateItems.length > 0) {
              const dateMatches = dateItems.map((v) => {
                const vDate = this.getDuckDbDateExpr(`'${v}'`);
                return `(${colDate} IS NOT NULL AND ${vDate} IS NOT NULL AND ${colDate} = ${vDate})`;
              });
              conditions.push(`(CAST(${col} AS VARCHAR) IN (${strList}) OR ${col} IN (${strList})${numCondition} OR (${dateMatches.join(' OR ')}))`);
            } else {
              conditions.push(`(CAST(${col} AS VARCHAR) IN (${strList}) OR ${col} IN (${strList})${numCondition})`);
            }
          }
          break;
        }
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private buildSelectMetrics(values: ValueMetricDefinition[] = []): string {
    if (values.length === 0) {
      return 'COUNT(*) AS "Total_Count"';
    }

    return values
      .map((val) => {
        const col = `"${val.column.replace(/"/g, '""')}"`;
        const alias = `"${(val.alias || `${val.aggregation}_${val.column}`).replace(/"/g, '""')}"`;

        let aggFunc = `SUM(TRY_CAST(${col} AS DOUBLE))`;
        switch (val.aggregation.toUpperCase()) {
          case 'SUM':
            aggFunc = `SUM(TRY_CAST(${col} AS DOUBLE))`;
            break;
          case 'COUNT':
            aggFunc = `COUNT(${col})`;
            break;
          case 'COUNT_DISTINCT':
            aggFunc = `COUNT(DISTINCT ${col})`;
            break;
          case 'AVERAGE':
          case 'AVG':
            aggFunc = `AVG(TRY_CAST(${col} AS DOUBLE))`;
            break;
          case 'MIN':
            aggFunc = `MIN(TRY_CAST(${col} AS DOUBLE))`;
            break;
          case 'MAX':
            aggFunc = `MAX(TRY_CAST(${col} AS DOUBLE))`;
            break;
        }

        return `${aggFunc} AS ${alias}`;
      })
      .join(', ');
  }

  public formatValue(
    num: number,
    format?: string,
    decimalPlaces?: number,
    isAlreadyPercent?: boolean
  ): string {
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
  }
}