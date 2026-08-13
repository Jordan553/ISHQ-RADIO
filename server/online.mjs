/**
 * Online search & stream — YouTube via yt-dlp, proxied through our own
 * origin so the browser never touches Google cross-origin (ORB/CORS-safe).
 *
 *   GET /search-online?q=<query>            -> JSON results (flat, fast)
 *   GET /stream-online?id=<videoId>         -> piped audio with Range support
 *
 * Used by both the express-style prod server (server.mjs) and the vite
 * dev middleware (vite.config.js).
 */

import { spawn } from 'node:child_process';
import https from 'node:https';
import { createHash } from 'node:crypto';

const YTDLP = process.env.YTDLP || 'yt-dlp';
const RESOLVE_TTL_MS = 10 * 60 * 1000;   // keep resolved URLs fresh-ish
const RESOLVE_TIMEOUT_MS = 25000;

const urlCache = new Map(); // videoId -> { url, at }

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`yt-dlp timed out (${timeoutMs}ms)`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`yt-dlp exited ${code}: ${err.slice(0, 300)}`));
    });
  });
}

/** Search YouTube, returning lightweight results without downloading. */
export async function searchOnline(q, limit = 6) {
  const out = await run([
    '--flat-playlist',
    '--skip-download',
    '--no-warnings',
    '--dump-single-json',
    `ytsearch${Math.min(10, Math.max(1, limit))}:${String(q).slice(0, 120)}`
  ], 30000);

  const json = JSON.parse(out);
  const entries = Array.isArray(json) ? json : (json.entries || []);
  return entries
    .filter((e) => e && e.id && e.title)
    .slice(0, limit)
    .map((e) => ({
      videoId: e.id,
      title: e.title,
      channel: e.channel || e.uploader || 'YouTube',
      duration: e.duration || 0,
      thumb: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`
    }));
}

/** Resolve a video id to a direct audio URL (cached). */
export async function resolveStreamUrl(videoId) {
  const hit = urlCache.get(videoId);
  if (hit && Date.now() - hit.at < RESOLVE_TTL_MS) return hit.url;

  const url = await run([
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--no-warnings',
    '-g',
    '--no-playlist',
    `https://www.youtube.com/watch?v=${videoId}`
  ], RESOLVE_TIMEOUT_MS);

  if (/^https?:\/\//.test(url)) {
    urlCache.set(videoId, { url, at: Date.now() });
    return url;
  }
  throw new Error('no audio url resolved');
}

/** iTunes artwork + clean title fallback (no API key needed). */
async function itunesArt(q) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(String(q).slice(0, 80))}&media=music&limit=1&entity=song`
    );
    const j = await res.json();
    const r = j.results?.[0];
    if (!r) return null;
    return {
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName || r.primaryGenreName || '',
      art: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb')
    };
  } catch {
    return null;
  }
}

/** Loose title similarity so we don't pair a wrong YouTube hit. */
function titleSim(a, b) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').trim();
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.8;
  const aW = A.split(' ').filter(Boolean);
  const hits = aW.filter((w) => B.includes(w)).length;
  return hits / Math.max(aW.length, B.split(' ').filter(Boolean).length);
}

/** Strip release noise from a YT title before similarity matching. */
function scrubTitle(t) {
  return String(t)
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[-|·—_.]/g, ' ')
    .replace(/lyrics|official (video|song|audio)|video song|full (song|video|audio)|hd|4k|4k60|1080p|60fps|t-series|tseries/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enrich a raw Drive file name into playable metadata:
 * YouTube match (videoId + HD thumb) verified by title similarity,
 * with an iTunes artwork fallback. Cached in memory.
 */
export async function enrichTrack(q, cacheMs = 6 * 60 * 60 * 1000) {
  const qk = String(q).trim();
  const cached = enrichCache.get(qk);
  if (cached && Date.now() - cached.at < cacheMs) return cached.meta;
  if (enrichInflight.has(qk)) return enrichInflight.get(qk);

  const job = (async () => {
    const meta = { enriched: false };
    try {
      const clean = qk.replace(/\.(mp3|m4a|wav|flac|opus|aac)$/i, '').replace(/[_-]+/g, ' ');
      const hits = await searchOnline(clean, 4).catch(() => []);
      let best = null;
      for (const h of hits) {
        if (!h.videoId) continue;
        const src = scrubTitle(h.title);
        // prefer the shortest verified match — usually the official cut,
        // not remix/lyrics/cover floods
        if (src && (!best || src.length < best.src.length)) {
          best = titleSim(clean, src) >= 0.55 ? { ...h, src } : best;
          if (best && src.length <= clean.length) break;
        }
      }
      if (best) {
        meta.videoId = best.videoId;
        meta.title = best.title;
        meta.artist = best.channel || '';
        meta.duration = best.duration || 0;
        meta.thumb = `https://i.ytimg.com/vi/${best.videoId}/mqdefault.jpg`;
        meta.thumbHd = `https://i.ytimg.com/vi/${best.videoId}/maxresdefault.jpg`;
        meta.enriched = true;
      }
      if (!meta.videoId) {
        const it = await itunesArt(clean).catch(() => null);
        if (it) {
          meta.title = it.title || clean;
          meta.artist = it.artist || '';
          meta.album = it.album || '';
          meta.art = it.art || '';
          meta.enriched = meta.enriched || Boolean(it.art);
        }
      }
    } catch { /* keep raw */ }
    meta.title = meta.title || qk.replace(/\.(mp3|m4a|wav|flac|opus|aac)$/i, '');
    enrichCache.set(qk, { meta, at: Date.now() });
    enrichInflight.delete(qk);
    return meta;
  })();

  enrichInflight.set(qk, job);
  return job;
}

// in-memory caches
const enrichCache = new Map();
const enrichInflight = new Map();

/** Round-trip helper: proxy a youtube audio URL to the client (byte-range friendly). */
function pipeRange(req, res, upstream) {
  const out = https.request(
    new URL(upstream),
    {
      method: req.method,
      headers: {
        Range: req.headers.range,
        Accept: '*/*',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
      }
    },
    (up) => {
      const h = { 'Content-Type': up.headers['content-type'] || 'audio/mpeg', 'Cache-Control': 'no-store' };
      if (up.headers['content-length']) h['Content-Length'] = up.headers['content-length'];
      if (up.headers['content-range']) h['Content-Range'] = up.headers['content-range'];
      if (up.headers['accept-ranges']) h['Accept-Ranges'] = up.headers['accept-ranges'];
      res.writeHead(up.statusCode, h);
      up.pipe(res);
    }
  );
  out.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Online stream relay error');
  });
  out.end();
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

const AUDIO_EXT = /\.(opus|mp3|m4a|ogg|wav)$/i;

/* ----------------------------------------------------------------
   YouTube thumbnail proxy — browsers often fail to hotlink i.ytimg.com
   (network policy / hotlink blocks). We fetch it server-side, cache it,
   and fall back across thumbnail sizes until one exists.
   ---------------------------------------------------------------- */
const THUMB_SIZES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];
const thumbCache = new Map(); // "id|size" -> Buffer

async function fetchThumb(id, size) {
  const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36',
      Accept: 'image/*'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

function writeImg(res, buf) {
  if (!buf) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('thumb not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(buf);
}

/* ----------------------------------------------------------------
   LRCLIB lyrics — synchronized (LRC) + plain lyrics for a track.
   Keyless, CORS-free (we call it from the server), cached 24h.
   Exact /api/get first when we know the duration, then /api/search
   ranked by title/artist similarity + duration closeness.
   ---------------------------------------------------------------- */
const LRCLIB = 'https://lrclib.net/api';
const LRC_UA = 'ISHQ-Radio/1.0 (radio dashboard; contact: dev@ishq.in)';
const lrcCache = new Map();   // "title|artist" -> { at, hit }
const lrcInflight = new Map();// "title|artist" -> Promise

async function lrcFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': LRC_UA,
      Accept: 'application/json',
      'Accept-Language': 'en,hi'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  return res.json();
}

function pickLrcHit(hits, title, artist, duration) {
  const want = scrubTitle(title).toLowerCase();
  const wantArtist = String(artist || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').trim();
  let best = null;
  let bestScore = 0;
  for (const h of hits) {
    if (!h || h.instrumental) continue;
    const src = scrubTitle(h.trackName || h.name || '').toLowerCase();
    const sim = titleSim(want, src);
    if (sim < 0.55) continue;
    let score = sim;
    if (wantArtist && (h.artistName || '').toLowerCase().includes(wantArtist)) score += 0.15;
    const dur = Number(h.duration) || 0;
    if (Number(duration) > 0 && dur > 0) {
      const diff = Math.abs(dur - Number(duration));
      if (diff <= 3) score += 0.2;
      else if (diff > 12) score -= 0.1;
    }
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

async function lrclibLookup(qk, title, artist, duration) {
  const cached = lrcCache.get(qk);
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) return cached.hit;
  if (lrcInflight.has(qk)) return lrcInflight.get(qk);

  const job = (async () => {
    let hit = null;
    try {
      if (Number(duration) > 0) {
        const u = new URL(LRCLIB + '/get');
        u.searchParams.set('track_name', title);
        u.searchParams.set('artist_name', artist || '');
        u.searchParams.set('duration', Math.round(Number(duration)));
        hit = await lrcFetch(u);
      }
      if (!hit) {
        const u = new URL(LRCLIB + '/search');
        u.searchParams.set('track_name', title);
        u.searchParams.set('artist_name', artist || '');
        const hits = (await lrcFetch(u)) || [];
        hit = pickLrcHit(hits, title, artist, duration);
      }
    } catch { hit = null; }
    lrcCache.set(qk, { hit, at: Date.now() });
    lrcInflight.delete(qk);
    return hit;
  })();

  lrcInflight.set(qk, job);
  return job;
}

const jordanCache = { at: 0, data: null };

/**
 * List a PUBLIC Google Drive folder (no API key needed) by scraping the
 * embedded folder view, the same trick scripts/refresh-playlist.mjs uses.
 * Optional: an *.json file inside the folder acts as metadata —
 * { file: "<filename>", title, artist }[] — everything else is derived
 * from the file name.
 */
async function listDriveFolder(folderId) {
  const res = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36' } }
  );
  if (!res.ok) throw new Error(`folder view ${res.status}`);
  const html = await res.text();
  const re = /id="entry-([A-Za-z0-9_-]+)"[^>]*>[\s\S]*?flip-entry-title">\s*([^<]+?)\s*<\/div>/g;
  const files = [];
  let m;
  while ((m = re.exec(html))) files.push({ fileId: m[1], name: m[2].trim() });
  return files;
}

function trackFromDriveFile(f, meta) {
  const title = (meta?.title || f.name.replace(AUDIO_EXT, '')).trim();
  const artist = (meta?.artist || (title.includes(' - ') ? title.split(' - ')[1].trim() : 'Jordan Core')).trim();
  return {
    id: `jordan-${f.fileId}`,
    title,
    artist,
    album: 'Jordan Core',
    genre: 'Jordan Core',
    coverUrl: '',
    driveId: f.fileId,
    videoId: null,
    lyricsUrl: '',
    backgroundUrl: '',
    duration: 0,
    order: 0,
    isLive: false
  };
}

/** GET /jordan/playlist — files from the Jordan Core Drive folder (cached).
 *  Sources, in order:
 *   1. a hand-maintained playlist JSON (public/data/jordan-playlist.json,
 *      or the path in ISHQ_JORDAN_FILE) — the easy "add/remove songs" flow
 *   2. the Drive folder itself (scrape, then Drive API when ?key= given
 *      or ISHQ_DRIVE_KEY set) */
/* Your Jordan Core folder — the ONLY source. Anything you drop in
 * here (mp3/m4a/opus/wav/ogg) is fetched automatically and enriched
 * from YouTube/iTunes. Old default folder retired. */
const JORDAN_FOLDER = '1W1EvARtm0fED7VG3MzBRBTSPMo1aRCeV';
const JORDAN_TTL_MS = 30_000;

async function listDriveApi(folderId, apiKey) {
  const out = [];
  let token = '';
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    u.searchParams.set('key', apiKey);
    if (token) u.searchParams.set('pageToken', token);
    const r = await fetch(u);
    if (!r.ok) throw new Error(`Drive API ${r.status}`);
    const d = await r.json();
    out.push(...(d.files || []));
    token = d.nextPageToken || '';
  } while (token);
  return out;
}

async function jordanPlaylist(req) {
  const fresh = req ? new URL(req.url, 'http://localhost').searchParams.get('fresh') === '1' : false;
  if (!fresh && Date.now() - jordanCache.at < JORDAN_TTL_MS && jordanCache.data) return jordanCache.data;
  const folderId = process.env.ISHQ_JORDAN_FOLDER || JORDAN_FOLDER;
  const apiKey = process.env.ISHQ_DRIVE_KEY
    || (req ? new URL(req.url, 'http://localhost').searchParams.get('key') : null);

  let files = [];
  let apiError = null;
  if (apiKey) {
    try {
      files = (await listDriveApi(folderId, apiKey)).map((f) => ({ fileId: f.id, name: f.name })); // authoritative, full pagination
    } catch (e) { apiError = e.message; }
  }
  if (!files.length) { // keyless scrape fallback (can truncate on big folders)
    try {
      files = await listDriveFolder(folderId);
    } catch (e) { apiError = e.message; }
  }

  if (!files.length) {
    throw new Error(apiError || 'folder is empty — share it "Anyone with the link → Viewer"');
  }

  const tracks = files
    .filter((f) => AUDIO_EXT.test(f.name))
    .map((f) => trackFromDriveFile(f));
  jordanCache.data = tracks;
  return tracks;
}

/** Route handler usable by node http server + vite middleware. */
export function onlineRoutes(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/jordan/playlist' && (req.method || 'GET') === 'GET') {
    jordanPlaylist(req)
      .then((tracks) => sendJson(res, 200, { results: tracks }))
      .catch((e) => sendJson(res, 502, { error: e.message }));
    return true;
  }

  /* Drive library — the whole app's music source. Supports ?check=1
   * (cheap hash of the listing, for the client's 60s sync polling). */
  if (p === '/drive/playlist' && (req.method || 'GET') === 'GET') {
    const check = url.searchParams.get('check') === '1';
    jordanPlaylist(req)
      .then((tracks) => {
        if (check) {
          const hash = createHash('sha1')
            .update(tracks.map((t) => `${t.driveId}|${t.title}`).join('\n'))
            .digest('hex');
          return sendJson(res, 200, { check: 1, hash, count: tracks.length });
        }
        sendJson(res, 200, { results: tracks });
      })
      .catch((e) => sendJson(res, 502, { error: e.message }));
    return true;
  }

  if (p === '/jordan/enrich' && (req.method || 'GET') === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    if (!q) return sendJson(res, 400, { error: 'missing q' });
    enrichTrack(q)
      .then((meta) => sendJson(res, 200, { results: meta }))
      .catch((e) => sendJson(res, 502, { error: e.message }));
    return true;
  }

  if (p === '/search-online' && (req.method || 'GET') === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    if (!q) return sendJson(res, 400, { error: 'missing q' });
    searchOnline(q)
      .then((results) => sendJson(res, 200, { results }))
      .catch((e) => sendJson(res, 502, { error: e.message }));
    return true;
  }

  if (p === '/stream-online' && (req.method || 'GET') === 'GET') {
    const id = String(url.searchParams.get('id') || '');
    if (!id || !/^[\w-]{6,20}$/.test(id)) {
      sendJson(res, 400, { error: 'bad id' });
      return true;
    }
    resolveStreamUrl(id)
      .then((u) => pipeRange(req, res, u))
      .catch(() => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Online stream unavailable — retry in a moment');
      });
    return true;
  }

  if (p === '/lyrics' && (req.method || 'GET') === 'GET') {
    let title = String(url.searchParams.get('title') || '').trim();
    const artist = String(url.searchParams.get('artist') || '').trim();
    const duration = Number(url.searchParams.get('duration')) || 0;
    if (!title) return sendJson(res, 400, { error: 'missing title' });
    title = title.replace(/\.(mp3|m4a|wav|flac|opus|aac)$/i, '').trim();
    if (artist) { // Drive titles like "Aap Is Dhoop Mein - Gulzar" — drop the artist suffix
      const esc = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`\\s*[-–·|]\\s*${esc}\\s*$`, 'i'), '').trim();
    }
    title = title.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!title) return sendJson(res, 400, { error: 'missing title' });
    const qk = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    lrclibLookup(qk, title, artist, duration)
      .then((hit) => {
        if (!hit) return sendJson(res, 200, { hit: null });
        sendJson(res, 200, {
          hit: {
            source: 'lrclib',
            trackName: hit.trackName || hit.name || title,
            artistName: hit.artistName || artist || '',
            albumName: hit.albumName || '',
            duration: hit.duration || 0,
            instrumental: Boolean(hit.instrumental),
            syncedLyrics: hit.syncedLyrics || '',
            plainLyrics: hit.plainLyrics || ''
          }
        });
      })
      .catch((e) => sendJson(res, 502, { error: e.message }));
    return true;
  }

  if (p === '/yt-thumb' && (req.method || 'GET') === 'GET') {
    const id = String(url.searchParams.get('id') || '').trim();
    if (!/^[\w-]{6,20}$/.test(id)) return sendJson(res, 400, { error: 'bad id' });
    const wanted = String(url.searchParams.get('size') || 'mqdefault').trim();
    const order = THUMB_SIZES.includes(wanted)
      ? [wanted, ...THUMB_SIZES.filter((s) => s !== wanted)]
      : THUMB_SIZES;
    (async () => {
      for (const size of order) {
        const key = `${id}|${size}`;
        if (thumbCache.has(key)) return writeImg(res, thumbCache.get(key));
        const buf = await fetchThumb(id, size).catch(() => null);
        if (buf) {
          thumbCache.set(key, buf);
          return writeImg(res, buf);
        }
      }
      writeImg(res, null);
    })();
    return true;
  }

  return false;
}