// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const adminRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(adminRoot),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4174,
  },
  build: {
    outDir: resolve(adminRoot, 'dist'),
    emptyOutDir: true,
  },
});
