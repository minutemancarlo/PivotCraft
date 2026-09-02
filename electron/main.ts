import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
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

// ---------------------------------------------------------------------------
// Auto-Updater Configuration, Silent Background Download & IPC Handlers
// ---------------------------------------------------------------------------
function isNewerVersion(latest: string, current: string): boolean {
  if (!latest || !current) return false;
  const cleanL = latest.replace(/^v/, '').trim();
  const cleanC = current.replace(/^v/, '').trim();
  if (cleanL === cleanC) return false;

  const lParts = cleanL.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanC.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(lParts.length, cParts.length);
  for (let i = 0; i < len; i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

// Download silently in background once update is detected
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let downloadedInstallerPath: string | null = null;
let isSilentDownloading = false;

autoUpdater.on('checking-for-update', () => {
  win?.webContents.send('updater:status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  const currentVer = app.getVersion();
  if (isNewerVersion(info.version, currentVer)) {
    win?.webContents.send('updater:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  } else {
    win?.webContents.send('updater:status', {
      status: 'not-available',
      version: currentVer,
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  win?.webContents.send('updater:status', {
    status: 'not-available',
    version: info?.version || app.getVersion(),
  });
});

autoUpdater.on('error', (err) => {
  console.warn('autoUpdater notice:', err?.message || err);
});

autoUpdater.on('download-progress', (progressObj) => {
  win?.webContents.send('updater:status', {
    status: 'downloading',
    percent: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  win?.webContents.send('updater:status', {
    status: 'downloaded',
    version: info.version,
  });
});

async function downloadReleaseAssetSilently(releaseData: any) {
  if (isSilentDownloading || downloadedInstallerPath) return;
  const assets = releaseData.assets || [];
  const installer = assets.find((a: any) => a.name.endsWith('.exe')) || assets.find((a: any) => a.name.endsWith('.msi'));
  if (!installer) return;

  try {
    isSilentDownloading = true;
    const dest = path.join(app.getPath('temp'), installer.name);
    const resp = await fetch(installer.browser_download_url, { headers: { 'User-Agent': 'PivotCraft-Updater' } });
    if (!resp.ok || !resp.body) {
      isSilentDownloading = false;
      return;
    }

    const totalBytes = Number(resp.headers.get('content-length') || installer.size || 0);
    let transferred = 0;
    const fileStream = fs.createWriteStream(dest);
    let lastTime = Date.now();
    let bytesSinceLast = 0;

    const reader = resp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        transferred += value.length;
        bytesSinceLast += value.length;

        const now = Date.now();
        if (now - lastTime >= 400) {
          const bps = (bytesSinceLast / (now - lastTime)) * 1000;
          win?.webContents.send('updater:status', {
            status: 'downloading',
            percent: totalBytes > 0 ? (transferred / totalBytes) * 100 : 0,
            bytesPerSecond: bps,
            transferred,
            total: totalBytes,
          });
          lastTime = now;
          bytesSinceLast = 0;
        }
      }
    }
    fileStream.end();
    downloadedInstallerPath = dest;
    isSilentDownloading = false;

    win?.webContents.send('updater:status', {
      status: 'downloaded',
      version: (releaseData.tag_name || '').replace(/^v/, ''),
    });
  } catch (err) {
    console.warn('Fallback silent download error:', err);
    isSilentDownloading = false;
  }
}

ipcMain.handle('updater:check', async () => {
  const currentVer = app.getVersion();
  try {
    if (!app.isPackaged) {
      // In development or local unpacked mode, check GitHub Releases directly
      const res = await fetch('https://api.github.com/repos/minutemancarlo/PivotCraft/releases/latest', {
        headers: { 'User-Agent': 'PivotCraft-Updater' },
      });
      if (!res.ok) {
        return { status: 'not-available', version: currentVer };
      }
      const data = await res.json();
      const latestTag = (data.tag_name || '').replace(/^v/, '');
      if (isNewerVersion(latestTag, currentVer)) {
        downloadReleaseAssetSilently(data);
        return {
          status: 'available',
          version: latestTag,
          releaseNotes: data.body,
          releaseDate: data.published_at,
          url: data.html_url,
        };
      }
      return { status: 'not-available', version: currentVer };
    }

    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo && isNewerVersion(result.updateInfo.version, currentVer)) {
      return {
        status: 'available',
        version: result.updateInfo.version,
        releaseNotes: result.updateInfo.releaseNotes,
        releaseDate: result.updateInfo.releaseDate,
      };
    }
    return { status: 'not-available', version: currentVer };
  } catch (err: any) {
    // If electron-updater encounters an error (e.g. running an MSI install), fallback to GitHub API
    try {
      const res = await fetch('https://api.github.com/repos/minutemancarlo/PivotCraft/releases/latest', {
        headers: { 'User-Agent': 'PivotCraft-Updater' },
      });
      if (res.ok) {
        const data = await res.json();
        const latestTag = (data.tag_name || '').replace(/^v/, '');
        if (isNewerVersion(latestTag, currentVer)) {
          downloadReleaseAssetSilently(data);
          return {
            status: 'available',
            version: latestTag,
            releaseNotes: data.body,
            releaseDate: data.published_at,
            url: data.html_url,
          };
        }
        return { status: 'not-available', version: currentVer };
      }
    } catch {
      // ignore fallback error
    }
    return { status: 'not-available', version: currentVer };
  }
});

ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('updater:quit-and-install', () => {
  if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
    if (downloadedInstallerPath.endsWith('.msi')) {
      spawn('msiexec.exe', ['/i', downloadedInstallerPath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    }
    app.quit();
  } else {
    autoUpdater.quitAndInstall(false, true);
  }
});

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('updater:open-url', (_, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});