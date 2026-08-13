import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useLrc } from '../hooks/useLrc.js';
import { activeLineIndex, lyricOffset, setLyricOffset, wordTimings } from '../lib/lrcParser.js';

/**
 * Theater lyrics — big centered lines floating over the cinema scene.
 * The active line is rendered WORD BY WORD: each word lights up the
 * moment it is sung, moving left to right like a karaoke prime. The
 * previous/next lines softly flank it, and a LYRIC SYNC nudger lets
 * the listener shift the whole timeline when a YouTube copy has a
 * different intro — the offset is remembered per track.
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

export default function BeatLyrics({ nudger = false, showMeta = true }) {
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const currentTime = useStore((s) => s.currentTime);

  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const meta = useLrc(track);

  const lines = meta?.lrc?.lines || [];
  const synced = meta?.lrc?.meta?.synced !== false;

  const [off, setOff] = useState(() => lyricOffset(track?.id));

  // reset the nudged offset whenever the track changes
  useEffect(() => {
    setOff(lyricOffset(track?.id));
  }, [track?.id]);

  const nudge = (delta, reset = false) => {
    const next = reset ? 0 : off + delta;
    setLyricOffset(track?.id, next, reset);
    setOff(lyricOffset(track?.id));
  };

  const t = currentTime - off;
  const idx = synced && lines.length ? activeLineIndex(lines, t, 0) : -1;

  const quoteRef = useRef(0);
  if (!quoteRef.current) quoteRef.current = 1 + Math.floor(Math.random() * QUOTES.length);

  if (!track) return null;
  const quote = QUOTES[(quoteRef.current - 1) % QUOTES.length];
  const li = idx >= 0 ? idx : 0;

  const nowLine = lines[li];
  const instr = nowLine && /^[(♪]/.test(nowLine.text);
  const words = nowLine && !instr ? wordTimings(nowLine.time, lines[li + 1]?.time, nowLine.text) : [];

  return (
    <div className="beat-lyrics" aria-hidden="true">
      {showMeta && (
        <div className="bl-meta">
          <span className="bl-live"><span className="dot" /> LIVE</span>
          {track.title} — {track.artist}
        </div>
      )}
      {lines.length ? (
        <div className="bl-lines">
          <div className="bl-line prev">{lines[Math.max(0, li - 1)]?.text || '\u00A0'}</div>
          <div className="bl-line now" key={`${track.id}-${li}`}>
            {words.length ? (
              words.map((w, i) => (
                <span key={`${i}-${w.word}`} className={`bl-word ${t >= w.start ? 'on' : ''}`}>{w.word}</span>
              ))
            ) : (
              nowLine?.text || '\u00A0'
            )}
          </div>
          <div className="bl-line next">{lines[Math.min(lines.length - 1, li + 1)]?.text || '\u00A0'}</div>
        </div>
      ) : !meta || meta?.status === 'loading' || meta?.status === 'pending' ? (
        <div className="bl-loading" key={track.id || 'l'}>
          <i className="fa-solid fa-music" />
          <span>finding lyrics…</span>
        </div>
      ) : (
        <div className="bl-quote" key={track.id || 'q'}>&ldquo;{quote}&rdquo;</div>
      )}

      {nudger && lines.length > 0 && (
        <div className="bl-nudge" onClick={(e) => e.stopPropagation()}>
          <span className="bl-nudge-label">LYRIC SYNC</span>
          <button className="icon-btn" onClick={() => nudge(-0.25)} aria-label="Lyrics earlier (shift back 0.25s)">
            <i className="fa-solid fa-minus" />
          </button>
          <span className={`bl-nudge-val${off > 0 ? ' late' : off < 0 ? ' early' : ''}`}>
            {off > 0 ? '+' : ''}{off.toFixed(2)}s
          </span>
          <button className="icon-btn" onClick={() => nudge(0.25)} aria-label="Lyrics later (shift forward 0.25s)">
            <i className="fa-solid fa-plus" />
          </button>
          <button className="icon-btn" onClick={() => nudge(0, true)} aria-label="Reset lyric sync" title="Reset">
            <i className="fa-solid fa-rotate-left" />
          </button>
        </div>
      )}
    </div>
  );
}