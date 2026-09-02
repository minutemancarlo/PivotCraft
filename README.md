# PivotCraft ⚡ (Electron + React + TypeScript + DuckDB)
**High-Performance Desktop CSV Pivot Engine & Excel Template Studio**

A native desktop application built with **Electron**, **React 18**, **TypeScript**, **Tailwind CSS**, and **DuckDB (In-Memory Vector Engine)** designed to process, aggregate, filter, and calculate 500,000+ row CSV datasets in milliseconds.

---

## 🌟 Features

1. **Sub-Second Vectorized Pivot Engine (DuckDB)**:
   - In-memory DuckDB streaming ingestion via `read_csv_auto`.
   - Vectorized `GROUP BY GROUPING SETS` queries computing multi-level hierarchies, subtotals, and grand totals in < 300ms for 500k rows.

2. **Excel PivotTable Reverse-Engineering Analyzer (OpenXML)**:
   - Deeply inspects Excel `.xlsx` PivotTables and PivotCache.
   - Extracts active Row Fields, Values, Slicers, and Calculated Field Formulas directly into a reusable `.json` template.
   - Filters out ghost/inactive cache columns (e.g. `MTD_INT_EXP_PHP_NEGATIVE`).

3. **High-Performance Virtualized Hierarchical TreeGrid**:
   - Smooth 60 FPS scrolling powered by `@tanstack/react-virtual`.
   - Expand & Collapse tree toggles (`▼` / `►`, Expand All, Collapse All).
   - Double-click or right-click to **Inline Rename Column Headers** and change number formats (Currency, Standard Numbers, Percentages, Decimals).
   - Dynamic global scenario parameters (e.g., Tax Rate %, Target Margin) with live in-memory recalculation.
   - Dedicated editable cells for audit review notes and manual adjustments.

4. **Multi-Format Export**:
   - **Excel (.xlsx)**: Generates workbooks with native collapsible outline levels (`[-]`/`[+]`), styled headers, and formatting.
   - **CSV**: Tabular and hierarchical CSV export.
   - **Template Sync**: Saves modified aliases, formats, and input parameters directly back to JSON.

---

## 🚀 How to Run

```powershell
cd C:\Users\Anubis\.gemini\antigravity\scratch\PivotCraft-Electron
npm.cmd run dev
```

**Quick Testing Out of the Box:**
1. Click **"📂 Load CSV Dataset"** and choose `samples/sales_50k.csv` (or any 500k-row CSV).
2. Click **"📄 Upload JSON Template"** and choose `samples/sample_template.json`.
3. Try the **Scenario Parameters** bar (e.g., adjust *Tax Rate (%)* or *Target Margin* and press **Enter** or **⚡ Recalculate**).
4. Click **"📊 Export Excel (.xlsx)"** to verify the collapsible Excel workbook output.
5. Click **"🔍 Analyze Excel Pivot (.xlsx)"** on any existing Excel workbook to extract its active PivotTable layout into a template!