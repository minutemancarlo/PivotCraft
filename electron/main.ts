import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DuckDbPivotEngine } from './services/duckdbEngine.js';
import { PivotExporter } from './services/pivotExporter.js';
import { TemplateManager } from './services/templateManager.js';
import { ProjectManager } from './services/projectManager.js';
import { PivotTemplate } from '../src/types/pivot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

// Disable native OS menu bar (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

// Prevent GPU Shader and disk cache access lock collisions on Windows
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

if (!app.isPackaged) {
  const devUserData = path.join(app.getPath('temp'), 'pivotcraft_dev');
  app.setPath('userData', devUserData);
}

let win: BrowserWindow | null = null;

const duckdbEngine = new DuckDbPivotEngine();
const pivotExporter = new PivotExporter();
const templateManager = new TemplateManager();
const projectManager = new ProjectManager();

function createWindow() {
  // When packaged, electron-builder copies icon.png into the Resources folder via extraResources.
  // process.resourcesPath points to that folder both in win-unpacked and in the MSI-installed app.
  // In dev mode, fall back to the public/ directory.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../public/icon.png');

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'PivotCraft ⚡ - Vectorized CSV & Pivot Engine',
    backgroundColor: '#f8fafc',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenu(null);
  win.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const distPath = process.env.DIST || path.join(__dirname, '../dist');
    win.loadFile(path.join(distPath, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// IPC Handlers
ipcMain.handle('pivot:getDefaultTemplate', () => {
  return TemplateManager.createDefaultTemplate();
});

ipcMain.handle('pivot:loadCsv', async (_, filePath?: string) => {
  let targetPath = filePath;
  if (!targetPath) {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Select CSV Dataset',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    targetPath = res.filePaths[0];
  }

  const start = performance.now();
  const rowCount = await duckdbEngine.loadCsv(targetPath);
  const latencyMs = performance.now() - start;
  const columns = await duckdbEngine.getColumns();

  return { filePath: targetPath, rowCount, columns, latencyMs };
});

ipcMain.handle('pivot:getDistinctValues', async (_, column: string, limit = 100) => {
  return await duckdbEngine.getDistinctValues(column, limit);
});

ipcMain.handle('pivot:getRawData', async (_, offset = 0, limit = 1000, sortColumn?: string, sortDir: 'ASC' | 'DESC' = 'ASC') => {
  return await duckdbEngine.getRawData(offset, limit, sortColumn, sortDir);
});

ipcMain.handle('pivot:loadTemplate', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Select Pivot JSON Template',
    filters: [{ name: 'JSON Template', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const template = await templateManager.loadTemplate(filePath);
  return { filePath, template };
});

ipcMain.handle('pivot:saveTemplate', async (_, template: PivotTemplate) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Save Pivot JSON Template',
    filters: [{ name: 'JSON Template', extensions: ['json'] }],
    defaultPath: `${template.templateName.replace(/\s+/g, '_')}.json`,
  });
  if (res.canceled || !res.filePath) return null;
  await templateManager.saveTemplate(template, res.filePath);
  return { filePath: res.filePath };
});

ipcMain.handle('pivot:saveProject', async (_, payload: any) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Save PivotCraft Workbook (.pvc)',
    filters: [
      { name: 'PivotCraft Workbook', extensions: ['pvc', 'pivotcraft'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: `${(payload.datasetName || payload.template?.templateName || 'PivotCraft_Project').replace(/\s+/g, '_')}.pvc`,
  });
  if (res.canceled || !res.filePath) return null;
  await projectManager.saveProject(duckdbEngine, payload, res.filePath);
  return { filePath: res.filePath };
});

ipcMain.handle('pivot:loadProject', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Open PivotCraft Workbook (.pvc)',
    filters: [
      { name: 'PivotCraft Workbook', extensions: ['pvc', 'pivotcraft'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const filePath = res.filePaths[0];
  const project = await projectManager.loadProject(duckdbEngine, filePath);
  
  // Verify restored table in DuckDB and fetch live schema and row count
  try {
    const dbCols = await duckdbEngine.getColumns('source_data');
    const countRes = await duckdbEngine.query('SELECT COUNT(*) as cnt FROM source_data;');
    const actualRowCount = Number(countRes[0]?.cnt || project.rowCount || 0);

    return {
      filePath,
      project: {
        ...project,
        rowCount: actualRowCount,
        columns: dbCols.length > 0 ? dbCols : project.columns,
      },
    };
  } catch (err) {
    console.error('Failed to verify restored source_data table:', err);
    return { filePath, project };
  }
});

ipcMain.handle('pivot:execute', async (_, template: PivotTemplate) => {
  const start = performance.now();
  const nodes = await duckdbEngine.executePivot(template);
  const latencyMs = performance.now() - start;
  return { nodes, latencyMs };
});

ipcMain.handle('pivot:exportExcel', async (_, nodes: any[], template: PivotTemplate) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Export Pivot to Excel (.xlsx)',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    defaultPath: `Pivot_Export_${Date.now()}.xlsx`,
  });
  if (res.canceled || !res.filePath) return null;
  await pivotExporter.exportToExcel(nodes, template, res.filePath);
  return { filePath: res.filePath };
});

ipcMain.handle('pivot:exportCsv', async (_, nodes: any[], template: PivotTemplate) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Export Pivot to CSV',
    filters: [{ name: 'CSV File', extensions: ['csv'] }],
    defaultPath: `Pivot_Export_${Date.now()}.csv`,
  });
  if (res.canceled || !res.filePath) return null;
  await pivotExporter.exportToCsv(nodes, template, res.filePath);
  return { filePath: res.filePath };
});