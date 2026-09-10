import { createRequire } from 'module';
import fs from 'fs';
import {
  PivotTemplate,
  PivotHierarchyNode,
  HeaderGroupDefinition,
  resolveTotalMode,
  getColumnDecimals,
} from '../../src/types/pivot.js';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

export function getExcelColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

export class PivotExporter {
  public async exportToExcel(
    nodes: PivotHierarchyNode[],
    template: PivotTemplate,
    outputPath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PivotCraft';
    workbook.lastModifiedBy = 'PivotCraft';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Pivot Summary', {
      views: [{ showGridLines: true }],
    });

    const hierStyle = template.columnStyles?.['hierarchy'] || {};
    const hierHeader = hierStyle.headerParentheses
      ? `(${template.rowHierarchyHeader || 'Hierarchy / Group'})`
      : (template.rowHierarchyHeader || 'Hierarchy / Group');

    const columns: Array<{
      key: string;
      header: string;
      format?: string;
      decimalPlaces?: number;
      isAlreadyPercent?: boolean;
      isNumeric: boolean;
    }> = [
      { key: 'hierarchy', header: hierHeader, isNumeric: false },
    ];

    const dataColumns: Array<{
      key: string;
      header: string;
      format?: string;
      decimalPlaces?: number;
      isAlreadyPercent?: boolean;
      isNumeric: boolean;
    }> = [];

    for (const val of template.values) {
      const key = val.alias || `${val.aggregation}_${val.column}`;
      const colStyle = template.columnStyles?.[key] || {};
      const header = colStyle.headerParentheses ? `(${key})` : key;
      dataColumns.push({ key, header, format: val.format, decimalPlaces: val.decimalPlaces, isAlreadyPercent: val.isAlreadyPercent, isNumeric: true });
    }

    for (const calc of template.calculatedFields) {
      const key = calc.alias || calc.name;
      const colStyle = template.columnStyles?.[key] || {};
      const header = colStyle.headerParentheses ? `(${key})` : key;
      dataColumns.push({ key, header, format: calc.format, decimalPlaces: calc.decimalPlaces, isAlreadyPercent: calc.isAlreadyPercent, isNumeric: true });
    }

    // Sort data columns if template has custom columnOrder
    if (template.columnOrder && template.columnOrder.length > 0) {
      const orderMap = new Map<string, number>();
      template.columnOrder.forEach((k, idx) => orderMap.set(k, idx));
      dataColumns.sort((a, b) => {
        const idxA = orderMap.has(a.key) ? orderMap.get(a.key)! : 9999;
        const idxB = orderMap.has(b.key) ? orderMap.get(b.key)! : 9999;
        return idxA - idxB;
      });
    }

    columns.push(...dataColumns);

    // 1. Add Header Rows (Super-Header Band Row + Main Header Row)
    const headerGroups = template.headerGroups || [];
    const hasHeaderGroups = headerGroups.length > 0;

    if (hasHeaderGroups) {
      // Find disjoint contiguous segments for super-headers to avoid overlapping merge errors
      interface HeaderSpan {
        startCol: number; // 1-indexed column in Excel
        endCol: number;
        group: HeaderGroupDefinition | null;
      }

      const spans: HeaderSpan[] = [];
      let currentGroup: HeaderGroupDefinition | null = null;
      let spanStart = 1;

      for (let c = 1; c < columns.length; c++) {
        const key = columns[c].key;
        const matched: HeaderGroupDefinition | null = headerGroups.find((g) => g.columnKeys && g.columnKeys.includes(key)) || null;

        if (c === 1) {
          currentGroup = matched;
          spanStart = 1;
        } else {
          const prevId = currentGroup ? currentGroup.id : null;
          const currId = matched ? matched.id : null;
          if (prevId !== currId) {
            spans.push({
              startCol: spanStart + 1, // Excel 1-indexed
              endCol: c,
              group: currentGroup,
            });
            currentGroup = matched;
            spanStart = c;
          }
        }
      }
      if (columns.length > 1) {
        spans.push({
          startCol: spanStart + 1,
          endCol: columns.length,
          group: currentGroup,
        });
      }

      const superHeaderData: any[] = new Array(columns.length).fill('');
      for (const span of spans) {
        if (span.group) {
          superHeaderData[span.startCol - 1] = span.group.label;
        }
      }

      const superHeaderRow = worksheet.addRow(superHeaderData);
      superHeaderRow.height = 24;

      for (const span of spans) {
        if (span.group) {
          const g = span.group;
          if (span.startCol < span.endCol) {
            worksheet.mergeCells(1, span.startCol, 1, span.endCol);
          }

          const bgHex = (g.bgColor || '#FEF3C7').replace('#', '').toUpperCase();
          const fontHex = (g.textColor || '#78350F').replace('#', '').toUpperCase();

          for (let sc = span.startCol; sc <= span.endCol; sc++) {
            const cell = superHeaderRow.getCell(sc);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF' + bgHex },
            };
            cell.font = {
              bold: g.isBold !== false,
              italic: !!g.isItalic,
              color: { argb: 'FF' + fontHex },
            };
            cell.alignment = {
              horizontal: g.textAlign || 'center',
              vertical: 'middle',
            };
          }
        }
      }
    }

    // Main Column Headers Row
    const headerRow = worksheet.addRow(columns.map((c) => c.header));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.height = 24;

    // Apply header alignment & text wrapping
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const colStyle = template.columnStyles?.[col.key] || {};
      const shouldWrap = colStyle.wrapHeader || template.wrapHeaders;
      const cell = headerRow.getCell(c + 1);
      cell.alignment = {
        horizontal: colStyle.textAlign || (c === 0 ? 'left' : 'right'),
        vertical: 'middle',
        wrapText: !!shouldWrap,
      };
    }

    // 2. Add Data Rows
    const dataRowNumbers: number[] = [];
    const nodeRowMap = new Map<PivotHierarchyNode, number>();

    for (const node of nodes) {
      const indent = ' '.repeat(Math.max(0, node.level - 1) * 3);
      const hierColStyle = template.columnStyles?.['hierarchy'] || {};
      let hierDisplayText = node.displayText;
      if (hierColStyle.alwaysParentheses && hierDisplayText && !hierDisplayText.startsWith('(')) {
        hierDisplayText = `(${hierDisplayText})`;
      }
      const rowData: any[] = [indent + hierDisplayText];

      for (let c = 1; c < columns.length; c++) {
        const col = columns[c];
        const colStyle = template.columnStyles?.[col.key] || {};
        const isTotalRow = node.isGrandTotal || node.isSubtotal;
        const isTotalHidden = colStyle.showTotal === false;

        if (isTotalRow && isTotalHidden) {
          rowData.push(null);
        } else if (col.isNumeric) {
          const rawNum = node.editableOverrides[col.key] ?? node.numericMetrics[col.key] ?? node.calculatedValues[col.key];
          let numVal: number = 0;
          if (rawNum !== null && rawNum !== undefined && (rawNum as any) !== '') {
            const parsed = typeof rawNum === 'number' ? rawNum : Number(rawNum);
            if (typeof parsed === 'number' && isFinite(parsed) && !isNaN(parsed)) {
              numVal = parsed;
            }
          }
          rowData.push(numVal);
        } else {
          const val = node.formattedValues[col.key] ?? node.calculatedValues[col.key] ?? '';
          rowData.push(String(val));
        }
      }

      const row = worksheet.addRow(rowData);
      nodeRowMap.set(node, row.number);
      if (!node.isGrandTotal) {
        dataRowNumbers.push(row.number);
      }

      // Set Excel outline level for grouping safely
      if (node.level > 1) {
        row.outlineLevel = Math.min(node.level - 1, 7);
      }

      const isBoldRow = node.isGrandTotal || node.isSubtotal;
      if (node.isGrandTotal) {
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
      } else if (node.isSubtotal) {
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
      }

      // Hierarchy cell styling
      const hierCell = row.getCell(1);
      const hierText = String(rowData[0] ?? '').trim();
      const hierEnclosed = hierText.startsWith('(') && hierText.endsWith(')');
      if (hierEnclosed) {
        hierCell.font = {
          ...(hierCell.font || {}),
          bold: isBoldRow || hierCell.font?.bold,
          color: { argb: 'FFFF0000' },
        };
      }

      // Format numeric & styled cells
      for (let c = 1; c < columns.length; c++) {
        const col = columns[c];
        const colStyle = template.columnStyles?.[col.key] || {};
        const cell = row.getCell(c + 1);
        const cellVal = rowData[c];
        const numVal = typeof cellVal === 'number' ? cellVal : null;
        const isZero = numVal !== null && Math.abs(numVal) < 1e-9;
        const isNegative = numVal !== null && numVal < 0;
        const wrapParen = !!colStyle.alwaysParentheses;
        const isEnclosedInParen =
          isNegative ||
          wrapParen ||
          (typeof cellVal === 'string' && cellVal.trim().startsWith('(') && cellVal.trim().endsWith(')'));

        if (colStyle.textAlign) {
          cell.alignment = { horizontal: colStyle.textAlign };
        } else {
          cell.alignment = { horizontal: 'right' };
        }

        if (col.isNumeric && cellVal !== null) {
          const dec = typeof col.decimalPlaces === 'number' ? col.decimalPlaces : (col.format === '0.000' ? 3 : col.format === '#,##0' ? 0 : 2);
          const zeros = dec > 0 ? '.' + '0'.repeat(dec) : '';
          const currSymbol = col.format?.includes('$') ? '$' : '₱';

          if (col.format?.includes('₱') || col.format?.includes('$')) {
            cell.numFmt = wrapParen
              ? `[Red]("${currSymbol}"#,##0${zeros});[Red]("${currSymbol}"#,##0${zeros});"-"`
              : `"${currSymbol}"#,##0${zeros};[Red]("${currSymbol}"#,##0${zeros});"-"`;
          } else if (col.format?.includes('%')) {
            if (col.isAlreadyPercent) {
              cell.numFmt = wrapParen
                ? `[Red](0${zeros}"%");[Red](0${zeros}"%");"-"`
                : `0${zeros}"%";[Red](0${zeros}"%");"-"`;
            } else {
              cell.numFmt = wrapParen
                ? `[Red](0${zeros}%);[Red](0${zeros}%);"-"`
                : `0${zeros}%;[Red](0${zeros}%);"-"`;
            }
          } else if (col.format === '0.000' || col.format === 'precision' || col.format === '0.0000') {
            cell.numFmt = wrapParen
              ? `[Red](0${zeros});[Red](0${zeros});"-"`
              : `0${zeros};[Red](0${zeros});"-"`;
          } else {
            cell.numFmt = wrapParen
              ? `[Red](#,##0${zeros});[Red](#,##0${zeros});"-"`
              : `#,##0${zeros};[Red](#,##0${zeros});"-"`;
          }

          // Output Excel formula on Grand Total cells for formula columns
          if (node.isGrandTotal && dataRowNumbers.length > 0) {
            const calcDef = template.calculatedFields?.find(
              (calc) => (calc.alias || calc.name) === col.key
            );
            const hasFormula = Boolean(calcDef && calcDef.formula && calcDef.formula.trim());
            const isPct = Boolean(
              col.format?.includes('%') ||
              col.isAlreadyPercent ||
              calcDef?.format?.includes('%') ||
              calcDef?.isAlreadyPercent
            );
            const totalMode = calcDef ? (calcDef.totalMode || resolveTotalMode(calcDef)) : 'sum';

            if (hasFormula && !isPct && totalMode !== 'avg' && totalMode !== 'min' && totalMode !== 'max') {
              const colLetter = getExcelColumnLetter(c + 1);
              const formulaStr = this.buildGrandTotalFormula(colLetter, nodes, nodeRowMap, dataRowNumbers, dec);
              if (formulaStr) {
                cell.value = {
                  formula: formulaStr,
                  result: numVal ?? 0,
                };
              }
            }
          }
        }

        // Font & font color: when value is enclosed in (), it MUST be in red font color
        const shouldBeBold = isBoldRow || !!colStyle.isBold;
        const shouldBeItalic = !!colStyle.isItalic;

        if (isEnclosedInParen && !isZero) {
          cell.font = {
            ...(cell.font || {}),
            bold: shouldBeBold,
            italic: shouldBeItalic,
            color: { argb: 'FFFF0000' },
          };
        } else if (colStyle.cellTextColor && !isZero && cellVal !== null) {
          const hex = colStyle.cellTextColor.replace('#', '').toUpperCase();
          cell.font = {
            ...(cell.font || {}),
            bold: shouldBeBold,
            italic: shouldBeItalic,
            color: { argb: 'FF' + hex },
          };
        } else if (shouldBeBold || shouldBeItalic) {
          cell.font = {
            ...(cell.font || {}),
            bold: shouldBeBold,
            italic: shouldBeItalic,
          };
        }

        // Only apply custom cell background color if NOT zero
        if (!isZero && cellVal !== null && colStyle.cellBgColor) {
          const hex = colStyle.cellBgColor.replace('#', '').toUpperCase();
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
        }
      }

      // Border styling for Grand Total
      if (node.isGrandTotal) {
        row.eachCell((cell: any) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'double' },
          };
        });
      }
    }

    // Auto fit column widths safely
    for (let c = 1; c <= columns.length; c++) {
      const col = worksheet.getColumn(c);
      let maxLen = 12;
      col.eachCell({ includeEmpty: false }, (cell: any) => {
        let text = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object' && 'result' in cell.value) {
            text = String(cell.value.result ?? '');
          } else {
            text = String(cell.value);
          }
        }
        if (text.length > maxLen) maxLen = text.length;
      });
      col.width = Math.min(Math.max(maxLen + 3, 14), 50);
    }

    await workbook.xlsx.writeFile(outputPath);
  }

  private buildGrandTotalFormula(
    colLetter: string,
    nodes: PivotHierarchyNode[],
    nodeRowMap: Map<PivotHierarchyNode, number>,
    dataRowNumbers: number[],
    dec: number
  ): string | null {
    if (dataRowNumbers.length === 0) return null;

    const hasSubtotals = nodes.some((n) => !n.isGrandTotal && n.isSubtotal);

    // If there are no subtotals (single-level hierarchy or flat list), all data rows are contiguous
    if (!hasSubtotals) {
      const firstRow = dataRowNumbers[0];
      const lastRow = dataRowNumbers[dataRowNumbers.length - 1];
      return `SUMPRODUCT(ROUND(${colLetter}${firstRow}:${colLetter}${lastRow}, ${dec}))`;
    }

    // When subtotals exist:
    // Check if root nodes (level 1) are contiguous (e.g. child rows are collapsed)
    const rootNodes = nodes.filter((n) => !n.isGrandTotal && n.level === 1);
    const rootRows = rootNodes
      .map((n) => nodeRowMap.get(n))
      .filter((r): r is number => typeof r === 'number');

    if (rootRows.length > 0) {
      const firstRoot = rootRows[0];
      const lastRoot = rootRows[rootRows.length - 1];
      const isContiguous = lastRoot - firstRoot + 1 === rootRows.length;
      if (isContiguous) {
        return `SUMPRODUCT(ROUND(${colLetter}${firstRoot}:${colLetter}${lastRoot}, ${dec}))`;
      }

      // If root rows are not contiguous (expanded child rows exist),
      // sum the root rows individually if <= 30 to avoid exceeding formula limits
      if (rootRows.length <= 30) {
        return rootRows.map((r) => `ROUND(${colLetter}${r}, ${dec})`).join(' + ');
      }
    }

    // Default fallback: contiguous data rows
    const firstRow = dataRowNumbers[0];
    const lastRow = dataRowNumbers[dataRowNumbers.length - 1];
    return `SUMPRODUCT(ROUND(${colLetter}${firstRow}:${colLetter}${lastRow}, ${dec}))`;
  }

  public async exportToCsv(
    nodes: PivotHierarchyNode[],
    template: PivotTemplate,
    outputPath: string
  ): Promise<void> {
    const hierCols = ['Hierarchy_Level', 'Group_Field', 'Group_Value', template.rowHierarchyHeader || 'Display_Header'];
    const dataCols: Array<{ key: string; isCalc: boolean; showTotal?: boolean }> = [];

    for (const val of template.values) {
      const key = val.alias || `${val.aggregation}_${val.column}`;
      dataCols.push({ key, isCalc: false, showTotal: val.showTotal });
    }
    for (const calc of template.calculatedFields) {
      const key = calc.alias || calc.name;
      dataCols.push({ key, isCalc: true, showTotal: calc.showTotal });
    }

    if (template.columnOrder && template.columnOrder.length > 0) {
      const orderMap = new Map<string, number>();
      template.columnOrder.forEach((k, idx) => orderMap.set(k, idx));
      dataCols.sort((a, b) => {
        const idxA = orderMap.has(a.key) ? orderMap.get(a.key)! : 9999;
        const idxB = orderMap.has(b.key) ? orderMap.get(b.key)! : 9999;
        return idxA - idxB;
      });
    }

    const columns: string[] = [...hierCols, ...dataCols.map((d) => d.key)];
    const lines: string[] = [columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')];

    for (const node of nodes) {
      const row: string[] = [
        String(node.level),
        node.groupField,
        node.groupValue,
        node.displayText,
      ];

      for (const d of dataCols) {
        const key = d.key;
        const colStyle = template.columnStyles?.[key] || {};
        const isTotalRow = node.isGrandTotal || node.isSubtotal;
        const isTotalHidden = colStyle.showTotal === false || d.showTotal === false;

        if (isTotalRow && isTotalHidden) {
          row.push('');
        } else if (d.isCalc) {
          const calcVal = node.calculatedValues[key];
          if (typeof calcVal === 'number' && calcVal < 0) {
            row.push(`(${Math.abs(calcVal)})`);
          } else {
            row.push(calcVal !== null && calcVal !== undefined ? String(calcVal) : '');
          }
        } else {
          const num = node.editableOverrides[key] ?? node.numericMetrics[key] ?? 0;
          if (typeof num === 'number' && num < 0) {
            row.push(`(${Math.abs(num)})`);
          } else {
            row.push(String(num));
          }
        }
      }

      lines.push(row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
    }

    await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf8');
  }
}