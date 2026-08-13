import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodeRelay } from './server/node-relay.mjs';

/** Dev middleware for the relay routes, mirroring server.mjs in production. */
const relayPlugin = {
  name: 'relay',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      nodeRelay(req, res).then((handled) => {
        if (!handled) next();
      });
    });
  }
};

export default defineConfig({
  plugins: [react(), relayPlugin],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  server: {
    host: true
  }
});
