/**
 * ISHQ Radio relay — every backend route the app needs, implemented with
 * plain `fetch` so it runs on ANY runtime:
 *   - Node (server.mjs, vite dev)      via server/node-relay.mjs adapter
 *   - Cloudflare Pages Functions       via functions/[[path]].js
 *
 * No node:* imports, no child processes, no external binaries (yt-dlp was
 * replaced by Invidious public instances — free, keyless, binaryless).
 *
 * Routes:
 *   GET /drive/playlist?check=1      Drive library (JSON) / cheap hash
 *   GET /drive?...                    byte-range proxy to Google Drive audio
 *   GET /jordan/playlist              alias of /drive/playlist
 *   GET /jordan/enrich?q=             YouTube/iTunes metadata enrichment
 *   GET /search-online?q=             YouTube search (flat, fast)
 *   GET /stream-online?id=            resolved audio URL, range-proxied
 *   GET /lyrics?title=&artist=&duration=  LRCLIB lookup (cached)
 *   GET /yt-thumb?id=&size=           thumbnail proxy (cached)
 */

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

/* ----------------------------------------------------------------
   Invidious — keyless YouTube search + direct audio URL resolution.
   Public instances, rotated with a sticky preference for the last
   working one.
   ---------------------------------------------------------------- */
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://iv.ggtyler.dev',
  'https://invidious.f5.si'
];

let invidiousOk = null; // sticky last-working instance

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function invidiousFetch(path, timeoutMs = 12000) {
  const bases = invidiousOk
    ? [invidiousOk, ...shuffle(INVIDIOUS.filter((b) => b !== invidiousOk))]
    : shuffle(INVIDIOUS);
  for (const base of bases) {
    try {
      const res = await fetch(base + path, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) continue; // HTML error page
      const json = await res.json();
      if (json && typeof json === 'object' && json.error) continue; // instance error
      invidiousOk = base;
      return { base, json };
    } catch { /* try next instance */ }
  }
  return null;
}

const searchCache = new Map();   // query -> { at, results }
const searchTTL = 5 * 60 * 1000;

/** Search YouTube via Piped (primary) then Invidious (fallback). */
async function searchYt(q, limit = 6) {
  const qk = String(q).trim();
  const hit = searchCache.get(qk);
  if (hit && Date.now() - hit.at < searchTTL) return hit.results;
  const clean = encodeURIComponent(qk.slice(0, 120));
  let results = null;

  for (const base of pipedBases()) {
    try {
      const res = await fetch(`${base}/search?q=${clean}&filter=videos`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(9000)
      });
      if (!res.ok) continue;
      if (!(res.headers.get('content-type') || '').includes('application/json')) continue;
      const j = await res.json();
      const items = (j.items || []).map((e) => ({
        ...e,
        videoId: e.videoId || String(e.url || '').replace('/watch?v=', '')
      })).filter((e) => e && e.videoId && e.title);
      if (!items.length) continue;
      pipedOk = base;
      results = items.slice(0, limit).map((e) => ({
        videoId: e.videoId,
        title: e.title,
        channel: e.uploaderName || 'YouTube',
        duration: Number(e.duration) || 0,
        thumb: `https://i.ytimg.com/vi/${e.videoId}/mqdefault.jpg`
      }));
      break;
    } catch { /* next */ }
  }

  if (!results) {
    const out = await invidiousFetch(`/api/v1/search?q=${clean}&type=video`);
    if (out && Array.isArray(out.json)) {
      results = out.json
        .filter((e) => e && e.videoId && e.title)
        .slice(0, limit)
        .map((e) => ({
          videoId: e.videoId,
          title: e.title,
          channel: e.author || 'YouTube',
          duration: e.lengthSeconds || 0,
          thumb: `https://i.ytimg.com/vi/${e.videoId}/mqdefault.jpg`
        }));
    }
  }

  if (!results) throw new Error('YouTube search unavailable');
  searchCache.set(qk, { at: Date.now(), results });
  return results;
}

const urlCache = new Map();      // videoId -> { url, at }
const RESOLVE_TTL_MS = 10 * 60 * 1000;

/** Piped API instances — keyless search + stream resolution fallback. */
const PIPED = [
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.ducks.party'
];
let pipedOk = null; // sticky last-working piped instance

function pipedBases() {
  return pipedOk
    ? [pipedOk, ...PIPED.filter((b) => b !== pipedOk)]
    : [...PIPED];
}

/* ----------------------------------------------------------------
   Innertube player API — resolves a direct audio URL WITHOUT any
   external binary. The ANDROID_VR client + a visitorData cookie
   bypasses YouTube's "confirm you're not a bot" gate for datacenter
   IPs. Pure fetch → runs on Node, Vite, and Cloudflare Functions.
   Fallback chain: ANDROID_VR → ANDROID → Piped → Invidious.
   ---------------------------------------------------------------- */
const INNERTUBE = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YT_PLAYER_UA = 'com.google.android.youtube/19.12.37 (Linux; U; Android 10; en_US)';
const YT_VISITOR_UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36';
let visitorData = null;
let visitorAt = 0;
const VISITOR_TTL_MS = 60 * 60 * 1000;

async function getVisitorData() {
  if (visitorData && Date.now() - visitorAt < VISITOR_TTL_MS) return visitorData;
  try {
    const res = await fetch('https://www.youtube.com/', {
      headers: { 'User-Agent': YT_VISITOR_UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(10000)
    });
    const html = await res.text();
    const m = html.match(/"visitorData":"([^"]+)"/);
    if (m?.[1]) {
      visitorData = m[1];
      visitorAt = Date.now();
      return visitorData;
    }
  } catch { /* retry next call */ }
  return visitorData || null;
}

async function innertubeAudio(videoId, clientName, clientVersion, sdk) {
  const vd = await getVisitorData();
  const body = {
    context: {
      client: {
        clientName,
        clientVersion,
        hl: 'en',
        gl: 'US',
        ...(sdk != null ? { androidSdkVersion: sdk } : {}),
        ...(vd ? { visitorData: vd } : {})
      }
    },
    videoId
  };
  const res = await fetch(INNERTUBE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientName === 'IOS'
        ? 'com.google.ios.youtube/19.29.1 (iPhone; U; CPU iPhone OS 17_0 like Mac OS X; en_US)'
        : YT_PLAYER_UA,
      'Accept-Encoding': 'identity'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (j.playabilityStatus?.status !== 'OK') return null;
  const fmts = j.streamingData?.adaptiveFormats || [];
  const audio = fmts
    .filter((f) => f && f.url && String(f.mimeType || '').startsWith('audio/'))
    .sort((a, b) => {
      const score = (f) => (f.bitrate || 0) + (f.itag === 140 ? 1_000_000 : f.itag === 139 ? 500_000 : 0);
      return score(b) - score(a);
    });
  return audio[0]?.url || null;
}

/** Resolve a video id to a direct audio URL (cached 10 min). */
async function resolveStreamUrl(videoId) {
  const hit = urlCache.get(videoId);
  if (hit && Date.now() - hit.at < RESOLVE_TTL_MS) return hit.url;

  let url = null;
  const picks = [];
  for (const c of [
    { n: 'ANDROID_VR', v: '1.61.21', s: 30 },
    { n: 'ANDROID', v: '19.12.37', s: 30 },
    { n: 'IOS', v: '19.29.1', s: null }
  ]) {
    const u = await innertubeAudio(videoId, c.n, c.v, c.s);
    if (u) picks.push(u);
  }
  url = picks.find((u) => /mime=audio%2Fmp4|mime=audio\/mp4|itag=140|itag=139/.test(u))
    || picks[0];

  if (!url) {
    /* Piped instances — some resolve fine from clean IPs. */
    for (const base of pipedBases()) {
      try {
        const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(9000)
        });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) continue;
        const j = await res.json();
        const audio = (j.audioStreams || []).find((f) => f && f.url);
        if (audio?.url) { pipedOk = base; url = audio.url; break; }
      } catch { /* next */ }
    }
  }

  if (!url) throw new Error('no audio url resolved');
  urlCache.set(videoId, { url, at: Date.now() });
  return url;
}

/** iTunes artwork + clean title fallback (no API key needed). */
async function itunesArt(q) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(String(q).slice(0, 80))}&media=music&limit=1&entity=song`,
      { signal: AbortSignal.timeout(8000) }
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

const enrichCache = new Map();    // q -> { at, meta }
const enrichInflight = new Map(); // q -> Promise
const ENRICH_TTL = 6 * 60 * 60 * 1000;

/** Enrich a raw Drive file name into playable metadata. */
async function enrichTrack(q) {
  const qk = String(q).trim();
  const cached = enrichCache.get(qk);
  if (cached && Date.now() - cached.at < ENRICH_TTL) return cached.meta;
  if (enrichInflight.has(qk)) return enrichInflight.get(qk);

  const job = (async () => {
    const meta = { enriched: false };
    try {
      const clean = qk.replace(/\.(mp3|m4a|wav|flac|opus|aac)$/i, '').replace(/[_-]+/g, ' ');
      const hits = await searchYt(clean, 4).catch(() => []);
      let best = null;
      for (const h of hits) {
        if (!h.videoId) continue;
        const src = scrubTitle(h.title);
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

/* ----------------------------------------------------------------
   YouTube thumbnail proxy — hotlinking i.ytimg.com often fails
   (network policy / hotlink blocks). Fetch server-side, cache, and
   fall back across thumbnail sizes until one exists.
   ---------------------------------------------------------------- */
const THUMB_SIZES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];
const thumbCache = new Map(); // "id|size" -> ArrayBuffer

async function fetchThumb(id, size) {
  const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, {
    headers: { 'User-Agent': UA, Accept: 'image/*' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  return res.arrayBuffer();
}

/* ----------------------------------------------------------------
   LRCLIB lyrics — synchronized (LRC) + plain lyrics for a track.
   Keyless, CORS-free (we call it server-side), cached 24h.
   ---------------------------------------------------------------- */
const LRCLIB = 'https://lrclib.net/api';
const LRC_UA = 'ISHQ-Radio/1.0 (radio dashboard; contact: dev@ishq.in)';
const lrcCache = new Map();    // "title|artist" -> { at, hit }
const lrcInflight = new Map(); // "title|artist" -> Promise

async function lrcFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': LRC_UA, Accept: 'application/json', 'Accept-Language': 'en,hi' },
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

/* ----------------------------------------------------------------
   Drive playlist — the app's music source.
   ---------------------------------------------------------------- */
const AUDIO_EXT = /\.(opus|mp3|m4a|ogg|wav)$/i;
const JORDAN_FOLDER = '1W1EvARtm0fED7VG3MzBRBTSPMo1aRCeV';
const jordanCache = { at: 0, data: null };
const JORDAN_TTL_MS = 30_000;

/** List a PUBLIC Drive folder by scraping the embedded folder view. */
async function listDriveFolder(folderId) {
  const res = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`folder view ${res.status}`);
  const html = await res.text();
  const re = /id="entry-([A-Za-z0-9_-]+)"[^>]*>[\s\S]*?flip-entry-title">\s*([^<]+?)\s*<\/div>/g;
  const files = [];
  let m;
  while ((m = re.exec(html))) files.push({ fileId: m[1], name: m[2].trim() });
  return files;
}

/** List a PUBLIC Drive folder via the Drive API (keyed). */
async function listDriveApi(folderId, apiKey) {
  const out = [];
  let token = '';
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    u.searchParams.set('key', apiKey);
    if (token) u.searchParams.set('pageToken', token);
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Drive API ${r.status}`);
    const d = await r.json();
    out.push(...(d.files || []));
    token = d.nextPageToken || '';
  } while (token);
  return out;
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

async function jordanPlaylist(url, env) {
  const fresh = url.searchParams.get('fresh') === '1';
  if (!fresh && Date.now() - jordanCache.at < JORDAN_TTL_MS && jordanCache.data) return jordanCache.data;
  const folderId = env.ISHQ_JORDAN_FOLDER || JORDAN_FOLDER;
  const apiKey = env.ISHQ_DRIVE_KEY || url.searchParams.get('key');

  let files = [];
  let apiError = null;
  if (apiKey) {
    try {
      files = (await listDriveApi(folderId, apiKey)).map((f) => ({ fileId: f.id, name: f.name }));
    } catch (e) { apiError = e.message; }
  }
  if (!files.length) {
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

/* ----------------------------------------------------------------
   Byte-range proxies — Google Drive audio + resolved YouTube audio.
   ---------------------------------------------------------------- */
async function proxyUpstream(request, upstream, forceUA = true) {
  const up = await fetch(upstream, {
    method: request.method,
    headers: {
      Range: request.headers.get('range') || 'bytes=0-',
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      ...(forceUA ? { 'User-Agent': UA } : {}),
      ...(upstream.includes('googleusercontent') ? { Connection: 'keep-alive' } : {})
    }
  });
  const h = new Headers({ 'Cache-Control': 'no-store' });
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = up.headers.get(k);
    if (v) h.set(k, v);
  }
  if (!up.headers.get('content-type')) h.set('Content-Type', 'audio/mpeg');
  return new Response(up.body, { status: up.status, headers: h });
}

/* ----------------------------------------------------------------
   Response helpers
   ---------------------------------------------------------------- */
function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function text(code, body, type = 'text/plain') {
  return new Response(body, { status: code, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
}

async function sha1Hex(seed) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(seed));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ----------------------------------------------------------------
   Main entry — runtime-agnostic request handler.
   Returns a Response, or null if the path isn't a relay route.
   ---------------------------------------------------------------- */
export async function handleRelay(request, env = {}) {
  const url = new URL(request.url);
  const p = url.pathname;
  const m = request.method || 'GET';
  const E = env || {};

  try {
    /* ---- Drive library (the app's music source) ---- */
    if (p === '/drive/playlist' && m === 'GET') {
      const check = url.searchParams.get('check') === '1';
      const tracks = await jordanPlaylist(url, E);
      if (check) {
        const hash = await sha1Hex(tracks.map((t) => `${t.driveId}|${t.title}`).join('\n'));
        return json(200, { check: 1, hash, count: tracks.length });
      }
      return json(200, { results: tracks });
    }

    if (p === '/jordan/playlist' && m === 'GET') {
      const tracks = await jordanPlaylist(url, E);
      return json(200, { results: tracks });
    }

    if (p === '/jordan/enrich' && m === 'GET') {
      const q = String(url.searchParams.get('q') || '').trim();
      if (!q) return json(400, { error: 'missing q' });
      const meta = await enrichTrack(q);
      return json(200, { results: meta });
    }

    /* ---- Drive audio relay: /drive?id=FILE_ID&export=download ---- */
    if (p.startsWith('/drive') && p !== '/drive/playlist') {
      const suffix = p.slice('/drive'.length) + url.search;
      return proxyUpstream(request, 'https://drive.usercontent.google.com/download' + suffix);
    }

    /* ---- Online search ---- */
    if (p === '/search-online' && m === 'GET') {
      const q = String(url.searchParams.get('q') || '').trim();
      if (!q) return json(400, { error: 'missing q' });
      const results = await searchYt(q);
      return json(200, { results });
    }

    /* ---- Online stream (audio, range-proxied) ---- */
    if (p === '/stream-online' && (m === 'GET' || m === 'HEAD')) {
      const id = String(url.searchParams.get('id') || '');
      if (!id || !/^[\w-]{6,20}$/.test(id)) return json(400, { error: 'bad id' });
      const u = await resolveStreamUrl(id);
      return proxyUpstream(request, u);
    }

    /* ---- LRCLIB lyrics ---- */
    if (p === '/lyrics' && m === 'GET') {
      let title = String(url.searchParams.get('title') || '').trim();
      const artist = String(url.searchParams.get('artist') || '').trim();
      const duration = Number(url.searchParams.get('duration')) || 0;
      if (!title) return json(400, { error: 'missing title' });
      title = title.replace(/\.(mp3|m4a|wav|flac|opus|aac)$/i, '').trim();
      if (artist) {
        const esc = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        title = title.replace(new RegExp(`\\s*[-–·|]\\s*${esc}\\s*$`, 'i'), '').trim();
      }
      title = title.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title) return json(400, { error: 'missing title' });
      const qk = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      const hit = await lrclibLookup(qk, title, artist, duration);
      if (!hit) return json(200, { hit: null });
      return json(200, {
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
    }

    /* ---- YouTube thumbnail proxy ---- */
    if (p === '/yt-thumb' && m === 'GET') {
      const id = String(url.searchParams.get('id') || '').trim();
      if (!/^[\w-]{6,20}$/.test(id)) return json(400, { error: 'bad id' });
      const wanted = String(url.searchParams.get('size') || 'mqdefault').trim();
      const order = THUMB_SIZES.includes(wanted)
        ? [wanted, ...THUMB_SIZES.filter((s) => s !== wanted)]
        : THUMB_SIZES;
      for (const size of order) {
        const key = `${id}|${size}`;
        if (thumbCache.has(key)) {
          return new Response(thumbCache.get(key), {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }
          });
        }
        const buf = await fetchThumb(id, size).catch(() => null);
        if (buf) {
          thumbCache.set(key, buf);
          return new Response(buf, {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }
          });
        }
      }
      return text(404, 'thumb not found');
    }
  } catch (e) {
    return json(502, { error: e.message || 'relay error' });
  }

  return null;
}
