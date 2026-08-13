import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import { artUrl } from '../lib/thumb.js';
import PlayerProgress from './PlayerProgress.jsx';
import CinemaBackground from './CinemaBackground.jsx';
import BeatLyrics from './BeatLyrics.jsx';
import { fmtTime } from '../lib/lrcParser.js';

/**
 * Fullscreen "theater" — the cinema scene with beat-driven lightning
 * and lyrics that advance on every beat. Compact floating control bar.
 */
export default function FullscreenLyrics() {
  const open = useStore((s) => s.theaterOpen);
  const closeTheater = useStore((s) => s.closeTheater);
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const audioPlaying = useStore((s) => s.audioPlaying);
  const toggleLocalPlay = useStore((s) => s.toggleLocalPlay);
  const localNext = useStore((s) => s.localNext);
  const localPrev = useStore((s) => s.localPrev);
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);
  const backToLive = useStore((s) => s.backToLive);
  const inLive = useStore((s) => s.inLive);

  useEffect(() => {
    if (!open) return;
    // real browser fullscreen — the theater owns the whole screen
    const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    req?.call(document.documentElement).catch?.();
    const onFsChange = () => {
      if (!document.fullscreenElement) closeTheater();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [open, closeTheater]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeTheater();
      if (e.key === ' ') { e.preventDefault(); toggleLocalPlay(); }
      if (e.key === 'ArrowRight') localNext();
      if (e.key === 'ArrowLeft') localPrev();
      if (e.key === 'l' || e.key === 'L') closeTheater();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closeTheater, toggleLocalPlay, localNext, localPrev]);

  if (!open || !track) return null;

  return (
    <div className={`theater open`} role="dialog" aria-modal="true" aria-label="Fullscreen lyrics">
      <CinemaBackground />
      <BeatLyrics nudger />
      <button className="icon-btn theater-close" onClick={closeTheater} aria-label="Close fullscreen lyrics">
        <i className="fa-solid fa-xmark" />
      </button>

      <div className="theater-head">
        <span className="live-chip"><span className="dot" /> LIVE</span>
        {track.coverUrl && (
          <span className="theater-thumb">
            <img
              src={artUrl(track.coverUrl)}
              alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </span>
        )}
        <div className="theater-meta">
          <span className="tt">{track.title}</span>
          <span className="ar">{track.artist}</span>
        </div>
        <div className="theater-count">
          <span className="pill">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
        </div>
      </div>

      <div className="theater-bar">
        <div className="theater-bar-progress"><PlayerProgress /></div>
        <div className="theater-bar-controls">
          <button className="ctrl-btn" onClick={localPrev} aria-label="Previous"><i className="fa-solid fa-backward-step" /></button>
          <button className="play-btn" onClick={toggleLocalPlay} aria-label={audioPlaying ? 'Pause' : 'Play'}>
            <i className={`fa-solid ${audioPlaying ? 'fa-pause' : 'fa-play'}`} style={audioPlaying ? {} : { marginLeft: 4 }} />
          </button>
          <button className="ctrl-btn" onClick={localNext} aria-label="Next"><i className="fa-solid fa-forward-step" /></button>
          {!inLive && (
            <button className="btn-live" onClick={backToLive}><i className="fa-solid fa-rotate-left" /> Back to Live</button>
          )}
          <button className="icon-btn" onClick={closeTheater} aria-label="Back to player" title="Back to player">
            <i className="fa-solid fa-compress" />
          </button>
        </div>
      </div>
    </div>
  );
}