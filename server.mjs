/**
 * ISHQ Radio production server — serves dist/ plus the same-origin
 * relay (Drive audio, Drive playlist, YouTube search/stream, LRCLIB
 * lyrics, thumbnails) via server/relay.mjs.
 *
 *   npm run build && npm start     →  http://localhost:4173
 *
 * The relay is what makes playback bulletproof: the browser never
 * touches Google cross-origin, so Chromium's ORB and Drive's missing
 * preflight support are irrelevant. Byte ranges (seeking) pass through.
 */

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { nodeRelay } from './server/node-relay.mjs';

/* Tiny .env loader (no dependency): ISHQ_DRIVE_KEY, ISHQ_JORDAN_FOLDER, PORT, HOST… */
try {
  const envFile = readFileSync(new URL('./.env', import.meta.url), 'utf-8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env — rely on real environment */ }

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const DIST = 'dist';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json'
};

async function serve(dir, pathname, res) {
  const file = join(dir, normalize(pathname));
  if (!file.startsWith(dir)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    /* SPA fallback below */
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (await nodeRelay(req, res)) return;
  if (pathname === '/' || pathname === '/index.html') {
    const body = await readFile(join(DIST, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, must-revalidate' });
    return res.end(body);
  }
  await serve(DIST, pathname, res);
  if (!res.headersSent) {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(await readFile(join(DIST, 'index.html')));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  } else {
    try {
      res.end();
    } catch {
      /* already closed */
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ISHQ Radio → http://localhost:${PORT}`);
});
