/**
 * Artwork URL resolver — routes YouTube thumbnails through our own
 * /yt-thumb proxy (browsers often fail hotlinking i.ytimg.com), keeps
 * local assets/ paths for everything else.
 */
const YT_RE = /^https:\/\/(www\.)?(i|img)?\.?ytimg\.com\/vi\/([\w-]+)\/(\w+)\.jpg/;

export function artUrl(src) {
  const s = String(src || '').trim();
  if (!s) return '';
  const m = s.match(YT_RE);
  if (m) return `/yt-thumb?id=${m[3]}&size=${m[4]}`;
  if (s.startsWith('http')) return s;
  return `assets/${s.replace(/^(\.\/|assets\/)/, '')}`;
}