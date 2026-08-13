/**
 * ISHQ Radio production server — serves dist/ plus the same-origin
 * Google Drive relay (same contract as the vite dev proxy).
 *
 *   npm run build && npm start        →  http://localhost:4173
 *
 * The relay is what makes Drive playback bulletproof: the browser never
 * touches Google cross-origin, so Chromium's ORB and Drive's missing
 * preflight support are irrelevant. Byte ranges (seeking) pass through.
 */

import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { onlineRoutes } from './server/online.mjs';

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

const DRIVE_HOST = 'drive.usercontent.google.com';

function proxyDrive(req, res) {
  const suffix = req.url.slice('/drive'.length);
  const outbound = https.request(
    {
      hostname: DRIVE_HOST,
      path: `/download${suffix}`,
      method: req.method,
      headers: {
        Range: req.headers.range || 'bytes=0-',
        Accept: '*/*',
        Connection: 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept-Encoding': 'identity'
      }
    },
    (up) => {
      const h = { 'Cache-Control': 'no-store' };
      if (up.headers['content-type']) h['Content-Type'] = up.headers['content-type'];
      if (up.headers['content-length']) h['Content-Length'] = up.headers['content-length'];
      if (up.headers['content-range']) h['Content-Range'] = up.headers['content-range'];
      if (up.headers['accept-ranges']) h['Accept-Ranges'] = up.headers['accept-ranges'];
      res.writeHead(up.statusCode, h);
      up.pipe(res);
    }
  );
  outbound.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Drive relay error');
  });
  outbound.end();
}

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

  if (onlineRoutes(req, res)) return;
  if (pathname.startsWith('/drive')) return proxyDrive(req, res);
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