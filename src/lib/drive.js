/**
 * Google Drive helpers — convert any Drive reference into a direct
 * streaming URL, and list a public folder's files via the Drive API.
 *
 * IMPORTANT: we stream from drive.usercontent.google.com directly.
 * drive.google.com/uc redirects through a URI lacking Access-Control-Allow-Origin,
 * and Chromium's ORB (opaque response blocking) rejects the octet-stream body
 * of no-cors media fetches. Because of these, the preferred path is the
 * same-origin `/drive` proxy (vite dev server / server.mjs) — moves nothing
 * cross-origin, so CORS and ORB never apply. The direct usercontent URL is
 * kept as an automatic fallback (works in Firefox/Safari, and in Chrome on
 * hosts that allow byte range CORS).
 */

const ID_RE = /[-\w]{25,}/;
const DRIVE_CONTENT = 'https://drive.usercontent.google.com/download';

function driveStreamUrl(id) {
  return `${DRIVE_CONTENT}?id=${id}&export=download`;
}

/**
 * Normalise any of these into a direct stream URL:
 *   "1bMJYYdavQhgAK-N9Z0svzgLjR3kXmp2t"                     (raw file id)
 *   "https://drive.google.com/file/d/ID/view?usp=sharing"   (share link)
 *   "https://drive.google.com/uc?export=download&id=ID"     (legacy link)
 * Anything else is returned unchanged (regular https URL).
 */
export function toStreamUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes('drive.google.com') || trimmed.includes('usercontent.google.com')) {
    const id = trimmed.match(ID_RE)?.[0];
    if (id) return driveStreamUrl(id);
    return trimmed;
  }

  // raw file id (no URL separators -> cannot be a regular link)
  if (!/[\/:?#]/.test(trimmed) && ID_RE.test(trimmed)) {
    return driveStreamUrl(trimmed);
  }

  return trimmed;
}

/**
 * Same-origin proxy path served by the app server (vite dev / server.mjs).
 * The proxy relays Google's byte-range responses, so playback, seeking and
 * duration all work in every browser — nothing leaves the origin, so
 * Chromium's ORB and Drive's missing preflight support never matter.
 * Returns null when `input` is not a Google Drive reference.
 */
export function proxiedStreamUrl(input) {
  const direct = toStreamUrl(input);
  if (!direct) return null;
  if (!direct.startsWith(DRIVE_CONTENT)) return null;
  let id;
  try { id = new URL(direct).searchParams.get('id'); } catch { return null; }
  if (!id) return null;
  return `/drive?id=${encodeURIComponent(id)}&export=download`;
}

/** Thumbnail for a Drive image id (used if you store covers on Drive). */
export function toThumbUrl(fileId, size = 512) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * List files inside a PUBLIC folder using the Drive API v3.
 * Requires an API key (Google Cloud Console > Credentials).
 * Used by the Settings "sync from Drive" flow if a key is configured.
 */
export async function listFolderFiles(folderId, apiKey) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents`,
    fields: 'files(id,name,mimeType,size)',
    pageSize: '100'
  });
  if (apiKey) params.set('key', apiKey);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.files || [];
}