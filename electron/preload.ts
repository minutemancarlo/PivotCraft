import { contextBridge, ipcRenderer } from 'electron';
import { PivotTemplate, PivotCraftProject } from '../src/types/pivot.js';

export const electronAPI = {
  getDefaultTemplate: (): Promise<PivotTemplate> => ipcRenderer.invoke('pivot:getDefaultTemplate'),
  loadCsv: (filePath?: string): Promise<{ filePath: string; rowCount: number; columns: any[]; latencyMs: number } | null> =>
    ipcRenderer.invoke('pivot:loadCsv', filePath),
  getDistinctValues: (column: string, limit?: number): Promise<string[]> =>
    ipcRenderer.invoke('pivot:getDistinctValues', column, limit),
  getRawData: (offset?: number, limit?: number, sortColumn?: string, sortDir?: 'ASC' | 'DESC') =>
    ipcRenderer.invoke('pivot:getRawData', offset, limit, sortColumn, sortDir),
  loadTemplate: (): Promise<{ filePath: string; template: PivotTemplate } | null> =>
    ipcRenderer.invoke('pivot:loadTemplate'),
  saveTemplate: (templateOrPayload: PivotTemplate | { template: PivotTemplate; defaultPath?: string }): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke('pivot:saveTemplate', templateOrPayload),
  saveProject: (payload: any): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke('pivot:saveProject', payload),
  loadProject: (): Promise<{ filePath: string; project: PivotCraftProject } | null> =>
    ipcRenderer.invoke('pivot:loadProject'),
  executePivot: (template: PivotTemplate) => ipcRenderer.invoke('pivot:execute', template),
  exportExcel: (nodes: any[], template: PivotTemplate) => ipcRenderer.invoke('pivot:exportExcel', nodes, template),
  exportCsv: (nodes: any[], template: PivotTemplate) => ipcRenderer.invoke('pivot:exportCsv', nodes, template),
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    openUrl: (url: string) => ipcRenderer.invoke('updater:open-url', url),
    onStatusChange: (callback: (data: any) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('updater:status', subscription);
      return () => {
        ipcRenderer.removeListener('updater:status', subscription);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);