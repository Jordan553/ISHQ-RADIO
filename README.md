# ISHQ Radio

A pocket Bollywood radio — a single page that plays a curated playlist, stays
in sync across your open tabs, and breathes with the music.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production:

```bash
npm run build && npm start   # http://localhost:4173  (port via $PORT)
```

## What it does

- **Playlist from Google Drive** — `data/playlist.json` in this repo is
  mirrored to Drive; the app fetches it (retry-safe) and resolves each track's
  Drive file ID / share link into a stream.
- **Same-origin Drive relay** — `/drive?id=…` (vite dev proxy / `server.mjs`)
  pipes Google's byte-range responses through your own origin. Google serves
  Drive files as `application/octet-stream`; Chromium's ORB blocks such
  cross-origin media and Drive rejects the CORS preflight a Range request
  triggers — so direct links are unreliable in Chrome. Through the relay,
  playback, seeking, duration and the WebAudio visualiser all work. The
  engine automatically falls back to the direct link if the relay is missing
  (Firefox/Safari tolerate it).
- **Live sync across tabs** — BroadcastChannel: the now-playing track, moment
  of the song, queue and playback state stay aligned between every open tab;
  an interval checks the leader's clock and nudges followers back in sync.
- **WebAudio visualiser** — EQ ring and background petals driven by a real
  AnalyserNode for same-origin streams; ambient mode when CORS blocks the
  data. Unlocks on the first tap.
- **The gate** — a keypad entry screen; passcode `ishq` (change it in
  `src/lib/config.js`). Autoplay is attempted straight away and the keypad
  doubles as the fallback unlock.
- **Auto-generated cover art** — brand-gradient covers rendered locally per
  song; replace with your own images in `playlist.json` any time.
- Fullscreen lyrics mode, live joined-time clock, auto-advance with a "bones"
  end card, and volume/seek controls throughout.

## Playlist format (`data/playlist.json`)

```jsonc
[
  {
    "title": "Tum Hi Ho",
    "artist": "Arijit Singh · Aashiqui 2",
    "driveId": "1bMJYYdavQhgAK-N9Z0svzgLjR3kXmp2t",   // file id, share link, or https URL
    "className": "slate"                                // cover gradient mood
  }
]
```

`npm run refresh:playlist` (+ a Drive API key in the Settings panel) can sync
a folder's files into the playlist.

## Deploying

- With a server: `npm run build && npm start` — serves the app **and** the
  `/drive` relay. Recommended: playback is guaranteed in every browser.
- Static host (Netlify, GitHub Pages…): the app builds and runs; the direct
  Drive fallback is used, which Chrome may refuse.

Stack: React 18 + Vite + zustand, Firebase listener count, zero other
dependencies.