/**
 * ISHQ Radio station server (bun, zero dependencies).
 *
 *   bun run server.mjs
 *
 * Serves the static app AND runs the /ws sync channel:
 * every connected client follows one "leader" (the DJ) so all
 * devices hear the same song at the same moment, radio-style.
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

/* ---------------- station state (the radio broadcast) ---------------- */

let station = { videoId: null, t0: 0, at: 0, playing: false, leaderId: null, seq: 0 }
const clients = new Map() // ws -> { id, isLeader }

function broadcast(msg, except) {
  const body = JSON.stringify(msg)
  for (const ws of clients.keys()) {
    if (ws !== except) {
      try { ws.send(body) } catch { /* gone */ }
    }
  }
}

function toStation(m, playing, leaderId) {
  station = {
    videoId: m.videoId,
    t0: Number(m.t) || 0,
    at: Date.now(),
    playing,
    leaderId,
    seq: station.seq + 1
  }
}

/* ---------------- HTTP + WS ---------------- */

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      if (server.upgrade(req)) return
      return new Response('upgrade failed', { status: 400 })
    }

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
  },
  websocket: {
    idleTimeout: 60,
    open(ws) {
      clients.set(ws, { id: null, isLeader: false })
      ws.send(JSON.stringify({ type: 'station', ...station }))
    },
    message(ws, raw) {
      let m
      try { m = JSON.parse(raw) } catch { return }
      if (!m || typeof m !== 'object') return
      const info = clients.get(ws)

      if (m.type === 'claim' && m.clientId && m.videoId) {
        // first synced, playing client becomes the leader (the DJ)
        if (!station.leaderId) {
          toStation(m, true, m.clientId)
          clients.set(ws, { id: m.clientId, isLeader: true })
          broadcast({ type: 'station', ...station }, ws)
        }
      } else if (m.type === 'state' && info && info.isLeader && m.videoId) {
        // only the leader's clock updates the station
        toStation(m, !!m.playing, m.clientId)
        broadcast({ type: 'station', ...station }, ws)
      } else if (m.type === 'cmd' && (m.cmd === 'next' || m.cmd === 'prev')) {
        // any synced listener can request a skip — the DJ (leader) performs it
        for (const [w, inf] of clients) {
          if (inf.isLeader) { try { w.send(JSON.stringify({ type: 'cmd', cmd: m.cmd })) } catch { /* gone */ } }
        }
      } else if (m.type === 'need-station') {
        ws.send(JSON.stringify({ type: 'station', ...station }))
      } else if (m.type === 'leave' && info) {
        // a listener opted out of the sync — step down if they were the DJ
        if (info.isLeader && station.leaderId === info.id) {
          station = { ...station, leaderId: null }
          broadcast({ type: 'station', ...station })
        }
        clients.set(ws, { id: info.id, isLeader: false })
      }
    },
    close(ws) {
      const info = clients.get(ws)
      if (info && info.isLeader && station.leaderId === info.id) {
        // DJ left the station — the next playing client takes over
        station = { ...station, leaderId: null }
        broadcast({ type: 'station', ...station })
      }
      clients.delete(ws)
    }
  }
})

console.log(`ISHQ station → http://localhost:${PORT}`)
