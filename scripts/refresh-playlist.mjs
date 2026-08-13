/**
 * Refreshes public/data/playlist.json from the shared Google Drive folder.
 *
 * 1) Read the folder (public link, no auth needed) and collect file id + name.
 * 2) Keep any hand-written metadata/lyrics for files that still exist,
 *    and append new files as new tracks.
 *
 * Usage:
 *   node scripts/refresh-playlist.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER_ID = process.env.ISHQ_DRIVE_FOLDER_ID || '1W1EvARtm0fED7VG3MzBRBTSPMo1aRCeV';
const playlistPath = join(root, 'public', 'data', 'playlist.json');

const AUDIO_EXT = /\.(opus|mp3|m4a|ogg|wav)$/i;

async function listFolder(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
  const res = await fetch(url);
  const html = await res.text();
  const re = /id="entry-([A-Za-z0-9_-]+)"[^>]*>[\s\S]*?flip-entry-title">\s*([^<]+?)\s*<\/div>/g;
  const files = [];
  let m;
  while ((m = re.exec(html))) files.push({ fileId: m[1], name: m[2].trim() });
  return files.filter((f) => AUDIO_EXT.test(f.name));
}

function trackFromFile(file, index) {
  const name = file.name.replace(AUDIO_EXT, '').trim();
  let [title = name, artist = 'Unknown Artist'] = name.split(/\s*[-–]\s*/);
  return {
    id: slug(title) || `track-${index + 1}`,
    title: title.trim(),
    artist: (artist || 'Unknown Artist').trim(),
    album: 'ISHQ RADIO Lounge',
    genre: 'Romantic',
    coverUrl: `assets/covers/${slug(title) || `track-${index + 1}`}.svg`,
    driveId: file.fileId,
    lyricsUrl: '',
    backgroundUrl: '',
    duration: 0,
    order: index + 1,
    isLive: index === 0,
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const files = await listFolder(FOLDER_ID);
if (!files.length) {
  console.error('No audio files found in folder. Is the folder shared publicly?');
  process.exit(1);
}

let playlist = [];
if (existsSync(playlistPath)) {
  try {
    const raw = JSON.parse(readFileSync(playlistPath, 'utf-8'));
    playlist = Array.isArray(raw) ? raw : (raw.playlist || []);
  } catch { playlist = []; }
}

const byName = new Map(playlist.map((t) => [t.title.toLowerCase(), t]));
const next = files.map((f, i) => {
  const base = f.name.replace(AUDIO_EXT, '').trim();
  const prev = byName.get(base.toLowerCase());
  const fresh = trackFromFile(f, i);
  return {
    ...fresh,
    ...(prev ? { coverUrl: prev.coverUrl, lyrics: prev.lyrics, lyricsUrl: prev.lyricsUrl } : {}),
  };
});

// drop tracks whose file was removed
const existingNames = new Set(files.map((f) => f.name.replace(AUDIO_EXT, '').trim().toLowerCase()));
const kept = playlist.filter((t) => existingNames.has(t.title.toLowerCase()));
const merged = [...kept, ...next];
const seen = new Set();
const playlistFinal = merged.filter((t) => (seen.has(t.title.toLowerCase()) ? false : (seen.add(t.title.toLowerCase()), true)));

writeFileSync(playlistPath, JSON.stringify({ playlist: playlistFinal }, null, 2) + '\n');
console.log(`Refreshed ${playlistFinal.length} tracks (folder had ${files.length} audio files).`);
console.log(files.map((f) => `  - ${f.name}`).join('\n'));
