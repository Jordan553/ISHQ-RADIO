import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { useBeat } from '../hooks/useBeat.js';
import { fetchLrc } from '../lib/lyrics.js';

/**
 * Theater beat lyrics — big centered lines floating over the scene.
 * Every musical beat advances the active line (karaoke on the pulse).
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
  const tracksMeta = useStore((s) => s.tracksMeta);
  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];

  const [lines, setLines] = useState([]);
  const [li, setLi] = useState(0);
  const quoteRef = useRef(0);
  if (!quoteRef.current) quoteRef.current = 1 + Math.floor(Math.random() * QUOTES.length);

  const { beat } = useBeat();

  // resolve lyrics for the current track (lazy LRCLIB fetch, same as LyricsView)
  useEffect(() => {
    if (!track) return;
    const rec = useStore.getState().tracksMeta[track.id];
    if (rec?.lrc) { setLines(rec.lrc.lines || []); return; }
    if (rec?.status === 'loading' || rec?.status === 'missing' || rec?.status === 'error') return;
    useStore.setState((s) => ({ tracksMeta: { ...s.tracksMeta, [track.id]: { ...s.tracksMeta[track.id], status: 'loading' } } }));
    fetchLrc(track).then(({ lrc }) => {
      setLines(lrc?.lines || []);
      useStore.setState((s) => ({
        tracksMeta: {
          ...s.tracksMeta,
          [track.id]: { lrc: lrc || s.tracksMeta[track.id]?.lrc || null, status: lrc ? 'ok' : 'missing' }
        }
      }));
    });
  }, [track]);

  // restart from the top when the track changes
  useEffect(() => { setLi(0); }, [track?.id]);

  // one line per beat — the lyrics ride the rhythm
  useEffect(() => {
    if (!lines.length || !beat) return;
    setLi((i) => Math.min(i + 1, lines.length - 1));
  }, [beat, lines.length]);

  if (!track) return null;
  const quote = QUOTES[(quoteRef.current - 1) % QUOTES.length];

  return (
    <div className="beat-lyrics" aria-hidden="true">
      <div className="bl-meta">
        <span className="bl-live"><span className="dot" /> BEAT</span>
        {track.title} — {track.artist}
      </div>
      {lines.length ? (
        <div className="bl-lines">
          <div className="bl-line prev">{lines[Math.max(0, li - 1)]?.text || '\u00A0'}</div>
          <div className="bl-line now" key={li}>{lines[li]?.text || '\u00A0'}</div>
          <div className="bl-line next">{lines[Math.min(lines.length - 1, li + 1)]?.text || '\u00A0'}</div>
        </div>
      ) : (
        <div className="bl-quote" key={quoteRef.current}>&ldquo;{quote}&rdquo;</div>
      )}
    </div>
  );
}
