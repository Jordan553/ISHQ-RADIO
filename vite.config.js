import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { onlineRoutes } from './server/online.mjs';

/** Dev middleware for the online (YouTube) search + stream routes,
 *  mirroring what server.mjs exposes in production. */
const onlineRelayPlugin = {
  name: 'online-relay',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const handled = onlineRoutes(req, res);
      if (!handled) next();
    });
  }
};

export default defineConfig({
  plugins: [react(), onlineRelayPlugin],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  server: {
    host: true,
    // Same-origin relay for Google Drive audio (see src/lib/drive.js).
    // Structure: /drive?id=FILE_ID&export=download  ->  /download?id=FILE_ID&export=download
    proxy: {
      '/drive': {
        target: 'https://drive.usercontent.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/drive/, '/download')
      }
    }
  }
});