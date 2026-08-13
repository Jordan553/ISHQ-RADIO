import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { activeLineIndex } from '../lib/lrcParser.js';
import { useLrc } from '../hooks/useLrc.js';

/**
 * The stage karaoke line — ONLY the line that is playing right now,
 * synced to the track clock, fading in below the album art.
 * Silent (no placeholder) until synced lyrics actually arrive.
 */
export default function StageLyric() {
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const currentTime = useStore((s) => s.currentTime);

  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const meta = useLrc(track);

  const lrc = meta?.lrc;
  const lines = lrc?.lines || [];
  const synced = lrc?.meta?.synced !== false;
  const idx = synced && lines.length ? activeLineIndex(lines, currentTime, 0) : -1;

  const shownRef = useRef(-1);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | out | in

  // fresh start per track — no stale line from the previous song
  useEffect(() => {
    shownRef.current = -1;
    setText('');
    setPhase('idle');
  }, [track?.id]);

  // line change: fade the old line out, swap, fade the new one in
  useEffect(() => {
    if (idx < 0 || idx === shownRef.current) return;
    setPhase('out');
    const t = setTimeout(() => {
      shownRef.current = idx;
      setText((lines[idx]?.text || '').trim());
      setPhase('in');
    }, 260);
    return () => clearTimeout(t);
  }, [idx, lines]);

  if (!lines.length || !synced || idx < 0) return null;

  const instr = /^[(♪]/.test(text || lines[idx]?.text);

  return (
    <div className="stage-lyric" aria-live="polite">
      <span className={`sl-text ${phase}${instr ? ' instr' : ''}`}>{text || lines[idx]?.text || '\u00A0'}</span>
    </div>
  );
}