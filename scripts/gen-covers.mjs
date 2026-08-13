/**
 * Generates romantic red/black cover art SVGs for every track in the playlist.
 * Usage: node scripts/gen-covers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const playlistPath = join(root, 'public', 'data', 'playlist.json');
const outDir = join(root, 'public', 'assets', 'covers');

const raw = JSON.parse(readFileSync(playlistPath, 'utf-8'));
const playlist = Array.isArray(raw) ? raw : (raw.playlist || []);

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coverSvg(track, idx) {
  const hues = [
    ['#43101c', '#1c070d', '#0a0306', '#ff5a6e', '#8f0f2c'],
    ['#4a0d1f', '#200710', '#0a0204', '#ffb199', '#6d0a24'],
    ['#3d1220', '#1a080e', '#080203', '#ff8fa0', '#b31333'],
    ['#3f1020', '#1a0710', '#070103', '#ff7d8c', '#c41a3c'],
    ['#33101c', '#15060c', '#070204', '#ff4d63', '#6b0c22'],
    ['#4c1222', '#1f0810', '#080205', '#ff6b7d', '#a30f2e'],
    ['#3c1120', '#190710', '#070103', '#ff8295', '#a31331'],
    ['#451020', '#1d070f', '#090204', '#ff4e65', '#7f0d28'],
    ['#3a0f1e', '#17060d', '#070204', '#ff6d85', '#991130'],
    ['#4e1123', '#20070f', '#090104', '#ff90a2', '#b41234'],
  ];
  const [c0, c1, c2, hot, deep] = hues[idx % hues.length];
  const initial = track.title.charAt(0).toUpperCase();
  const album = (track.album || 'ISHQ RADIO').toUpperCase().slice(0, 12);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <defs>
    <radialGradient id="bg" cx="50%" cy="32%" r="92%">
      <stop offset="0%" stop-color="${c0}"/>
      <stop offset="52%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </radialGradient>
    <linearGradient id="fx" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${hot}"/>
      <stop offset="55%" stop-color="#ff2a4b"/>
      <stop offset="100%" stop-color="${deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff2a4b" stop-opacity=".5"/>
      <stop offset="100%" stop-color="#ff2a4b" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="252" r="185" fill="url(#glow)" filter="url(#soft)"/>
  <circle cx="300" cy="252" r="150" fill="none" stroke="url(#fx)" stroke-width="2" opacity=".35"/>
  <circle cx="300" cy="252" r="140" fill="none" stroke="#ffffff" stroke-width="1" opacity=".12" stroke-dasharray="2 8"/>
  <text x="300" y="284" font-family="Georgia, serif" font-style="italic" font-size="128" fill="url(#fx)" text-anchor="middle">${escapeXml(initial)}</text>
  <text x="300" y="328" font-family="Georgia, serif" font-size="26" letter-spacing="9" fill="#f5eff1" text-anchor="middle" opacity=".88">${escapeXml(album)}</text>
  <text x="300" y="352" font-family="Georgia, serif" font-size="13" letter-spacing="4" fill="#9a8f94" text-anchor="middle">ISHQ RADIO</text>
  <path d="M300 514 c-57 -47 -104 -84 -104 -135 a56 56 0 0 1 104 -36 a56 56 0 0 1 104 36 c0 51 -47 88 -104 135 z" fill="url(#fx)"/>
  <circle cx="300" cy="50" r="3" fill="${hot}" opacity=".9"/>
  <circle cx="94" cy="138" r="2" fill="${hot}" opacity=".5"/>
  <circle cx="508" cy="108" r="2.5" fill="${hot}" opacity=".4"/>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
let n = 0;
for (const [i, t] of playlist.entries()) {
  const file = join(outDir, `${t.id}.svg`);
  writeFileSync(file, coverSvg(t, i));
  n++;
}
console.log(`Generated ${n} covers -> ${outDir}`);
