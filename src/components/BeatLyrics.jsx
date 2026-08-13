import { useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { useLrc } from '../hooks/useLrc.js';
import { activeLineIndex } from '../lib/lrcParser.js';

/**
 * Theater lyrics — big centered lines floating over the cinema scene.
 * The active line follows the song clock (same sync as the stage line
 * and the rail), with the previous/next lines softly flanking it.
 * Falls back to a love quote when the track has no lyrics.
 */
const QUOTES = [
  'Where words fail, music speaks.',
  'Let the music carry you somewhere your mind cannot go.',
  'Ishq ek ehsaas hai jo alfaaz se nahi, awaaz se hota hai.',
  'Har gaane mein ek kahani hoti hai — aaj raat woh tumhari hai.',
  'Some songs never leave you — they just wait for the right moment.',
  'Pyaar karna seekho — baaki sab cinema hai.',
  'Two people. One song. Zero words needed.'
];

export default function BeatLyrics() {
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const currentTime = useStore((s) => s.currentTime);

  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const meta = useLrc(track);

  const lines = meta?.lrc?.lines || [];
  const synced = meta?.lrc?.meta?.synced !== false;
  const idx = synced && lines.length ? activeLineIndex(lines, currentTime, 0) : -1;

  const quoteRef = useRef(0);
  if (!quoteRef.current) quoteRef.current = 1 + Math.floor(Math.random() * QUOTES.length);

  if (!track) return null;
  const quote = QUOTES[(quoteRef.current - 1) % QUOTES.length];
  const li = idx >= 0 ? idx : 0;

  return (
    <div className="beat-lyrics" aria-hidden="true">
      <div className="bl-meta">
        <span className="bl-live"><span className="dot" /> LIVE</span>
        {track.title} — {track.artist}
      </div>
      {lines.length ? (
        <div className="bl-lines">
          <div className="bl-line prev">{lines[Math.max(0, li - 1)]?.text || '\u00A0'}</div>
          <div className="bl-line now" key={`${track.id}-${li}`}>{lines[li]?.text || '\u00A0'}</div>
          <div className="bl-line next">{lines[Math.min(lines.length - 1, li + 1)]?.text || '\u00A0'}</div>
        </div>
      ) : (
        <div className="bl-quote" key={track.id || 'q'}>&ldquo;{quote}&rdquo;</div>
      )}
    </div>
  );
}