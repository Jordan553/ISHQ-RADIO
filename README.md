# इश्क़ — ISHQ Radio

A beautiful, zero-backend radio player for a shared YouTube playlist — with real cross-device sync that works on **any static host** (Netlify, GitHub Pages, Vercel, ...).

## Run locally

```bash
bun server.mjs
```

Open **http://localhost:4173** (on the same Wi-Fi, other devices can open `http://<your-ip>:4173`).

> Only requires [Bun](https://bun.sh). No `npm install` needed. Or drop the 4 files on any static host.

## How it works

- **Syncs automatically** — every open copy of the app joins the same room (via the free PeerJS cloud). The first device becomes the DJ; all others hear the exact same song at the exact same second.
- **Next / prev anywhere** — any device's skip advances the station for everyone; play/pause is shared too.
- **Self-healing** — if the DJ closes the tab, the next device takes over and playback never stops.
- The playlist is read live from YouTube, so songs you add join the rotation automatically.
- Footer badge shows **SYNCED** (green) when other listeners are connected, **SOLO** otherwise.
- **Fullscreen button** — expand/restore for a clean full-screen radio look.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell (UI, controls, fullscreen button) |
| `style.css` | The look — dark glass, ambient album-art glow, drifting इश्क़ glyphs |
| `script.js` | Player + peer-to-peer sync client (PeerJS) |
| `server.mjs` | Optional local file server (Bun, zero dependencies) |
