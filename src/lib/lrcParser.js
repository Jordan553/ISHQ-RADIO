/**
 * LRC lyric parser — supports [mm:ss.xx] (and [mm:ss]) timestamps,
 * metadata tags ([ti:], [ar:], [offset:...]) and multiple timestamps
 * per line. Handles Hindi / Urdu / mixed-script content natively.
 */

export function parseLrc(text) {
  const meta = {};
  const lines = [];
  if (!text) return { meta, lines };

  const lineRe = /^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // metadata tag, e.g. [ti:Song] / [offset:500]
    const metaMatch = line.match(/^\[(ti|ar|al|by|re|ve|offset):(.*)\]$/i);
    if (metaMatch) {
      const [, key, value] = metaMatch;
      if (key.toLowerCase() === 'offset') meta.offset = parseFloat(value) || 0;
      else meta[key.toLowerCase()] = value.trim();
      continue;
    }

    // extract every timestamp on the line
    const stamps = [];
    let rest = line;
    let m;
    while ((m = rest.match(lineRe))) {
      const [, mm, ss, frac] = m;
      let seconds = parseInt(mm, 10) * 60 + parseFloat(ss);
      if (frac) {
        const padded = frac.padEnd(3, '0');
        seconds += parseFloat(`0.${padded}`);
      }
      stamps.push(seconds);
      rest = rest.slice(m[0].length);
    }
    if (!stamps.length) continue;

    const text_ = rest.trim();
    for (const t of stamps) {
      lines.push({ time: t + (meta.offset || 0) / 1000, text: text_ });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return { meta, lines };
}

/**
 * Index of the active line at a given time (last line whose time <= t).
 */
export function activeLineIndex(lines, t, hint = 0) {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** seconds -> "m:ss" */
export function fmtTime(sec, showTenth = false) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const tenth = showTenth ? `.${Math.floor((sec % 1) * 10)}` : '';
  return `${m}:${String(s).padStart(2, '0')}${tenth}`;
}

/* ------------------------------ lyric sync nudging ------------------------------ */
/* Some YouTube copies have a longer intro than the LRC timestamps (and the Drive
 * master). Every track can carry a manual offset that is remembered across
 * sessions — the theater nudger writes it, every lyric surface reads it. */
const KEY = 'ishq.lyricOffsets';

function offsetMap() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function lyricOffset(trackId) {
  if (!trackId) return 0;
  return offsetMap()[trackId] || 0;
}

export function setLyricOffset(trackId, offset, reset = false) {
  if (!trackId) return;
  const map = offsetMap();
  if (reset || offset === 0) delete map[trackId];
  else {
    map[trackId] = Math.max(-10, Math.min(10, Math.round(offset * 100) / 100));
  }
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* storage full */ }
}

/* ------------------------------ word-level karaoke ------------------------------ */
/* A line's words are assumed to be sung evenly across the line's duration.
 * Returns [{ word, start }] so a renderer can light up each word in turn. */
export function wordTimings(lineTime, nextLineTime, text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const start = lineTime;
  const end = nextLineTime != null && nextLineTime > lineTime ? nextLineTime : lineTime + 3;
  const dur = Math.max(0.45, end - start);
  return words.map((word, i) => ({ word, start: start + (dur / words.length) * i }));
}