import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['duckdb', 'adm-zip', 'exceljs', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 5173,
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/dist-electron/**', '**/.system_generated/**', '**/*.zip'],
    },
  },
});