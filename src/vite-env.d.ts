/// <reference types="vite/client" />
import { electronAPI } from '../electron/preload.js';

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
