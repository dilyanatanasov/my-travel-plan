import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Filesystem events do not cross a Windows/macOS Docker bind mount, so
      // without polling the container never sees host edits and HMR silently
      // serves stale modules until the container is restarted.
      usePolling: true,
      interval: 300,
    },
  },
});
