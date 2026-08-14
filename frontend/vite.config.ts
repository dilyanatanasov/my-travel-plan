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
  build: {
    /**
     * Never inline flag SVGs as data URIs. Vite's default inlines any asset
     * under 4KB, which swept ~350 small flags from flag-icons into the main
     * CSS file and roughly quadrupled it — every visitor would download every
     * flag up front. Kept as separate files, the browser fetches only the
     * flags actually shown. `undefined` keeps the default for everything else.
     */
    assetsInlineLimit: (filePath) =>
      filePath.includes('flag-icons') ? false : undefined,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    /**
     * Proxy the API through the dev server so the frontend can call a relative
     * /api. Without this the API base URL has to be an absolute host baked
     * into the bundle, which breaks the moment the page is opened from
     * anything other than the machine running it — on a phone, "localhost" is
     * the phone. Going through the same origin also means no CORS and no
     * cross-site cookie rules to satisfy.
     *
     * Target is the compose service name, since Vite runs inside the network.
     */
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
    watch: {
      // Filesystem events do not cross a Windows/macOS Docker bind mount, so
      // without polling the container never sees host edits and HMR silently
      // serves stale modules until the container is restarted.
      usePolling: true,
      interval: 300,
    },
  },
});
