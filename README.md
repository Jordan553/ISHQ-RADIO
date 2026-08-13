# ✨ ISHQ Radio

A live romantic music lounge for the web — plays a curated Bollywood playlist,
stays in sync across every open tab, and breathes with the music.

> **Live together. Feel the love.** ❤️

---

## Features

- **Drive-powered music** — the whole playlist lives in a public Google Drive
  folder; any `.mp3`/`.m4a`/`.opus`/`.ogg`/`.wav` you drop in is picked up and
  enriched (YouTube match, artwork) automatically.
- **Same-origin relay** — `/drive`, `/search-online`, `/stream-online`,
  `/lyrics` and `/yt-thumb` are proxied through your own origin, so playback,
  seeking and the visualiser work in *every* browser (Chromium's ORB never
  gets a say).
- **Vibe mode** — ambient blurred video wall in the lounge, and a cinematic
  **fullscreen** mode: crystal-clear video, auto-hiding controls, keyboard
  shortcuts (Space / ← / → / L / Esc).
- **Word-by-word karaoke lyrics** — synced LRC (LRCLIB) with a lyric-sync
  nudger (−/+0.25s per track), static lyric fallbacks, and quote cards for
  tracks that have no lyrics anywhere.
- **Live sync across tabs** — BroadcastChannel keeps now-playing, the moment
  of the song, the queue and playback state aligned between every open tab.
- **Moods** — 12 curated moods (plus your own custom ones) that flip the room
  and the playlist; "Jordan Core" is the dedicated Drive library.
- **WebAudio visualiser** — EQ ring and background petals driven by a real
  `AnalyserNode`; ambient mode when CORS blocks the data.
- **Fullscreen theater** — big karaoke lyrics mode with its own time-shift
  nudge.
- **Auto-advance** with a "bones" end card, live joined-time clock, WebRTC
  presence-style "now listening" hearts.

## Stack

React 18 · Vite · Zustand · Firebase (optional presence) · zero other runtime
dependencies. Server: plain Node (`node:http`), binary-free — runs on any
Node host *or* Cloudflare Pages Functions.

## Get started

```bash
npm install
npm run dev          # http://localhost:5173 (vite + relay middleware)
```

Production:

```bash
npm run build
npm start            # http://localhost:4173  (port via $PORT)
```

Scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the relay baked in |
| `npm run build` | Production bundle → `dist/` |
| `npm start` | Node server: `dist/` + all relay routes |
| `npm run refresh:playlist` | Rebuild `public/data/playlist.json` from Drive |
| `npm run gen:covers` | Regenerate cover art |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ISHQ_DRIVE_KEY` | for Drive API listing | Google Drive API key (folder listing via the API — full pagination) |
| `ISHQ_JORDAN_FOLDER` | no (default set) | Drive folder id of the music library |
| `PORT` | no | Server port (default `4173`) |
| `HOST` | no | Bind host (default `0.0.0.0`) |

A local `.env` file is read by `server.mjs`; it is git-ignored — never commit
keys.

## Project layout

```
src/
  App.jsx               app shell: gate, overlays, vibe layer
  components/           TopBar, Sidebar, MoodBar, NowPlaying, LyricsPanel…
  store/useStore.js     zustand store — playlist, playback, vibe, moods, sync
  lib/                  audioEngine, syncEngine, ytPlayer, lrcParser, lyrics,
                        drive, moods, config…
  hooks/                useClock, useLrc, useSwipe
  styles/               style.css, player.css, lyrics.css, skin-spotify.css
server/
  relay.mjs             binary-free, runtime-agnostic relay (Node + Cloudflare)
  node-relay.mjs        Node adapter for relay.mjs
functions/[[path]].js   Cloudflare Pages Functions entry (same relay)
server.mjs              production Node server (dist/ + relay)
```

## Deploying

### Cloudflare Pages (free, always-on, no credit card)

1. Push this repo to GitHub.
2. `dash.cloudflare.com` → **Compute** → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → pick the repo.
3. Build command: `npm ci && npm run build`
   Build output directory: `dist`
4. Settings → **Environment variables**: add `ISHQ_DRIVE_KEY` and
   `ISHQ_JORDAN_FOLDER`, then redeploy.
5. Done — `https://<project>.pages.dev`, with auto-deploys on every push.

### Own server (VPS / home box)

```bash
git clone <repo> && cd ishq-radio
npm ci && npm run build
cat > .env <<'EOF'
ISHQ_DRIVE_KEY=your_key
ISHQ_JORDAN_FOLDER=your_folder_id
EOF
npm start
```

Put nginx (or Caddy) in front for TLS; keep byte-range support enabled
(`proxy_http_version 1.1`) so seeking keeps working.

### Why not a pure static host?

The app needs its same-origin relays (Drive audio, YouTube search/stream,
LRCLIB lyrics). Static-only hosts (GitHub Pages…) work only if the heavy
relay routes are provided elsewhere — that's what `functions/[[path]].js`
gives you for free on Cloudflare.

---

Made with ❤ — live together, feel the love.