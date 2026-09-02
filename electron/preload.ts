import { contextBridge, ipcRenderer } from 'electron';
import { PivotTemplate } from '../src/types/pivot.js';

export const electronAPI = {
  getDefaultTemplate: (): Promise<PivotTemplate> => ipcRenderer.invoke('pivot:getDefaultTemplate'),
  loadCsv: (filePath?: string) => ipcRenderer.invoke('pivot:loadCsv', filePath),
  getDistinctValues: (column: string, limit?: number): Promise<string[]> =>
    ipcRenderer.invoke('pivot:getDistinctValues', column, limit),
  getRawData: (offset?: number, limit?: number, sortColumn?: string, sortDir?: 'ASC' | 'DESC') =>
    ipcRenderer.invoke('pivot:getRawData', offset, limit, sortColumn, sortDir),
  loadTemplate: () => ipcRenderer.invoke('pivot:loadTemplate'),
  saveTemplate: (template: PivotTemplate) => ipcRenderer.invoke('pivot:saveTemplate', template),
  saveProject: (payload: any) => ipcRenderer.invoke('pivot:saveProject', payload),
  loadProject: () => ipcRenderer.invoke('pivot:loadProject'),
  executePivot: (template: PivotTemplate) => ipcRenderer.invoke('pivot:execute', template),
  exportExcel: (nodes: any[], template: PivotTemplate) => ipcRenderer.invoke('pivot:exportExcel', nodes, template),
  exportCsv: (nodes: any[], template: PivotTemplate) => ipcRenderer.invoke('pivot:exportCsv', nodes, template),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);