import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { PivotTemplate, PivotCraftProject } from '../../src/types/pivot.js';
import { DuckDbPivotEngine } from './duckdbEngine.js';

export class ProjectManager {
  public async saveProject(
    duckdbEngine: DuckDbPivotEngine,
    payload: {
      template: PivotTemplate;
      cellOverrides: Record<string, Record<string, number>>;
      columnWidths?: Record<string, number>;
      expansionState?: string[];
      datasetName?: string;
      rowCount: number;
      columns: Array<{ columnName: string; dataType: string }>;
    },
    filePath: string
  ): Promise<void> {
    const tempParquet = path.join(
      app.getPath('temp'),
      `pivotcraft_dump_${Date.now()}_${Math.random().toString(36).substring(7)}.parquet`
    );
    const sanitizedTemp = tempParquet.replace(/\\/g, '/');

    // 1. Export in-memory DuckDB table to compressed Parquet file
    await duckdbEngine.exec(`COPY source_data TO '${sanitizedTemp}' (FORMAT PARQUET, COMPRESSION ZSTD);`);

    // 2. Read compressed Parquet file
    const parquetBuffer = await fs.promises.readFile(tempParquet);
    const parquetBase64 = parquetBuffer.toString('base64');

    // 3. Clean up temp parquet file
    try {
      await fs.promises.unlink(tempParquet);
    } catch {}

    const projectPackage: PivotCraftProject = {
      format: 'PivotCraft_Workbook',
      version: '1.0',
      savedAt: new Date().toISOString(),
      datasetName: payload.datasetName || 'PivotCraft_Project',
      template: payload.template,
      cellOverrides: payload.cellOverrides || {},
      columnWidths: payload.columnWidths || {},
      expansionState: payload.expansionState || [],
      rowCount: payload.rowCount,
      columns: payload.columns || [],
      parquetData: parquetBase64,
    };

    await fs.promises.writeFile(filePath, JSON.stringify(projectPackage, null, 2), 'utf8');
  }

  public async loadProject(
    duckdbEngine: DuckDbPivotEngine,
    filePath: string
  ): Promise<PivotCraftProject> {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const projectPackage: PivotCraftProject = JSON.parse(raw);

    if (projectPackage.parquetData) {
      const tempParquet = path.join(
        app.getPath('temp'),
        `pivotcraft_restore_${Date.now()}_${Math.random().toString(36).substring(7)}.parquet`
      );
      const sanitizedTemp = tempParquet.replace(/\\/g, '/');
      const buffer = Buffer.from(projectPackage.parquetData, 'base64');
      await fs.promises.writeFile(tempParquet, buffer);

      // Restore table in in-memory DuckDB
      await duckdbEngine.exec(`CREATE OR REPLACE TABLE source_data AS SELECT * FROM read_parquet('${sanitizedTemp}');`);

      try {
        await fs.promises.unlink(tempParquet);
      } catch {}
    }

    return projectPackage;
  }
}
