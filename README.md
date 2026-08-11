# इश्क़ — ISHQ Radio

A beautiful, zero-dependency radio player for a shared YouTube playlist — with real cross-device sync.

## Run

```bash
bun server.mjs
```

Open **http://localhost:4173** (on the same Wi-Fi, other devices can open `http://<your-ip>:4173`).

> Only requires [Bun](https://bun.sh). No npm install needed.

## How it works

- **SOLO by default** — every device plays the shared playlist as its own radio; `next` / `prev` always work for your own player.
- **SYNC button** — press it and your playback joins the station. Everyone who pressed SYNC hears the exact same song at the exact same second. The first one in becomes the DJ (leader); if the DJ leaves, the next synced device takes over automatically.
- **Skip from anywhere** — while synced, `next` / `prev` on any device advances the station for everyone.
- The playlist is read live from YouTube, so songs you add join the rotation automatically.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell (UI, controls, SYNC button) |
| `style.css` | The look — dark glass, ambient album-art glow, drifting इश्क़ glyphs |
| `script.js` | Player + sync client (WebSocket) |
| `server.mjs` | Station server: static files + `/ws` sync channel (Bun, zero dependencies) |
