/**
 * ISHQ Radio — tiny static file server (bun, zero dependencies).
 *
 *   bun run server.mjs
 *
 * Serves the app on http://localhost:4173. The app also works on any
 * static host (Netlify, GitHub Pages, ...) — cross-device sync runs
 * peer-to-peer through the free PeerJS cloud, so no backend is needed.
 */

import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = import.meta.dir
const PORT = Number(process.env.PORT) || 4173

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req) {
    const url = new URL(req.url)

    let p = decodeURIComponent(url.pathname)
    if (p === '/') p = '/index.html'
    const file = join(ROOT, normalize(p))
    if (!file.startsWith(ROOT)) return new Response('forbidden', { status: 403 })
    return readFile(file)
      .then((body) => new Response(body, {
        status: 200,
        headers: {
          'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        }
      }))
      .catch(() => new Response('not found', { status: 404 }))
  }
})

console.log(`ISHQ station → http://localhost:${PORT}`)
