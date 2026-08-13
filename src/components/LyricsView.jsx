import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { activeLineIndex } from '../lib/lrcParser.js';
import { fetchLrc } from '../lib/lyrics.js';

/**
 * Shared timed-lyrics list. Renders the LRC lines with the active line
 * highlighted, and auto-centers it inside the scroll container.
 * Used by the rail panel and the fullscreen theater.
 *
 * Lyrics resolution order: hand-tuned static map -> LRCLIB (synced or
 * plain, fetched lazily per track) -> embedded lyricsUrl on the track.
 */

/** Love-letter quotes shown when a track has no lyrics. */
const QUOTES = [
  { text: 'Some songs never leave you — they just wait for the right moment.', by: null },
  { text: 'Where words fail, music speaks.', by: 'Hans Christian Andersen' },
  { text: 'Music is the shorthand of emotion.', by: 'Leo Tolstoy' },
  { text: 'Let the music carry you somewhere your mind cannot go.', by: null },
  { text: 'Ishq ek ehsaas hai jo alfaaz se nahi, awaaz se hota hai.', by: null },
  { text: 'Har gaane mein ek kahani hoti hai — aaj raat woh tumhari hai.', by: null },
  { text: 'Pyaar karna seekho — baaki sab cinema hai.', by: null },
  { text: 'Tumhari awaz sunte hi din shuru hota hai.', by: null },
  { text: 'Two people. One song. Zero words needed.', by: null },
  { text: 'The best love stories are written by instruments.', by: null },
  { text: 'Raat ka saath music ke bina adhoora hai.', by: null },
  { text: 'A song can hold a moment your memory forgot to keep.', by: null }
];
export function LyricsView({ trackId, theme = 'panel', focused = false }) {
  const playlist = useStore((s) => s.playlist);
  const tracksMeta = useStore((s) => s.tracksMeta);
  const onlineNow = useStore((s) => s.onlineNow);
  const currentTime = useStore((s) => s.currentTime);
  const autoScroll = useStore((s) => s.autoScroll);
  const setAutoScroll = useStore((s) => s.setAutoScroll);
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const userScrolledAt = useRef(0);

  const track = playlist.find((t) => t.id === trackId) || (onlineNow?.id === trackId ? onlineNow : null);
  const meta = tracksMeta[trackId];
  const lrc = meta?.lrc;
  const status = meta?.status || 'pending';
  const lines = lrc?.lines || [];
  const synced = lrc?.meta?.synced !== false;
  const idx = synced ? activeLineIndex(lines, currentTime, 0) : -1;

  const quoteRef = useRef(0);
  if (!quoteRef.current) quoteRef.current = 1 + Math.floor(Math.random() * QUOTES.length);

  // lazy LRCLIB lookup — once per track, deduped in-flight (lib-level)
  useEffect(() => {
    if (!track) return;
    const rec = useStore.getState().tracksMeta[trackId];
    if (rec?.lrc || rec?.status === 'loading' || rec?.status === 'missing' || rec?.status === 'error') return;
    useStore.setState((s) => ({ tracksMeta: { ...s.tracksMeta, [trackId]: { ...s.tracksMeta[trackId], status: 'loading' } } }));
    fetchLrc(track).then(({ lrc: hitLrc, status: hitStatus }) => {
      useStore.setState((s) => ({
        tracksMeta: {
          ...s.tracksMeta,
          [trackId]: { lrc: hitLrc || s.tracksMeta[trackId]?.lrc || null, status: hitStatus }
        }
      }));
    });
  }, [track, trackId]);

  // smooth auto-scroll to the active line
  useEffect(() => {
    if (idx < 0 || !activeRef.current || !scrollRef.current) return;
    if (!autoScroll) return;
    if (Date.now() - userScrolledAt.current < 3500 && !focused) return;
    const box = scrollRef.current;
    const el = activeRef.current;
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 1.6;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [idx, autoScroll, focused]);

  const onWheelStop = () => {
    userScrolledAt.current = Date.now();
    if (autoScroll) setAutoScroll(false);
  };

  if (!lines.length) {
    const loading = status === 'pending' || status === 'loading';
    const offline = status === 'error';
    if (loading) {
      return (
        <div className={`lyr-empty ${theme === 'theater' ? 'theme-theater' : ''}`}>
          <i className="fa-solid fa-compact-disc lyr-empty-icon fa-spin" style={{ animationDuration: '1.6s' }} />
          <p className="lyr-empty-title">Hunting synchronized lyrics</p>
          <p className="lyr-empty-hint">Reaching out to the lyric library…</p>
        </div>
      );
    }
    if (offline) {
      return (
        <div className={`lyr-empty ${theme === 'theater' ? 'theme-theater' : ''}`}>
          <i className="fa-solid fa-wifi lyr-empty-icon" />
          <p className="lyr-empty-title">Lyrics service unreachable</p>
          <p className="lyr-empty-hint">Check the connection and try another track.</p>
        </div>
      );
    }
    const q = QUOTES[(quoteRef.current - 1) % QUOTES.length];
    return (
      <div className={`lyr-empty lyr-quote theme-${theme}`} style={theme === 'theater' ? { fontSize: 30, padding: 60 } : {}}>
        <i className="fa-solid fa-music lyr-empty-icon" />
        <i className="fa-solid fa-quote-left" style={{ display: 'block', marginBottom: 16, color: 'var(--red-soft)', fontSize: '0.9em' }} />
        <p className="lq-text">{q.text}</p>
        {q.by && <span className="lq-by">{q.by}</span>}
        <p className="lyr-empty-title">No lyrics for this one</p>
        <p className="lyr-empty-hint">{theme === 'theater' ? 'Let the tune say it.' : 'Enjoy the melody — it is saying plenty.'}</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`lyrics-scroll theme-${theme} ${autoScroll ? 'autoscroll' : ''}`}
      onWheel={onWheelStop}
      onTouchStart={onWheelStop}
    >
      {lines.map((ln, i) => (
        <div
          key={i}
          ref={i === idx ? activeRef : null}
          className={`lyr-line ${i === idx ? 'active' : ''} ${ln.text.startsWith('(') || ln.text.startsWith('♪') ? 'instr' : ''}`}
        >
          {ln.text || '\u00A0'}
        </div>
      ))}
    </div>
  );
}