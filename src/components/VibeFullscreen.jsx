import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import PlayerProgress from './PlayerProgress.jsx';
import BeatLyrics from './BeatLyrics.jsx';
import { fmtTime } from '../lib/lrcParser.js';

/**
 * Vibe Fullscreen — the online song's video fills the whole screen
 * (softly blurred so it stays cinematic, not a raw upload), with a
 * floating glass control bar. Same single yt-player; the app UI is
 * hidden beneath so the video is the star.
 */
export default function VibeFullscreen() {
  const open = useStore((s) => s.vibeFsOpen);
  const close = useStore((s) => s.closeVibeFs);
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
  const vibeFsVideo = useStore((s) => s.vibeFsVideo);
  const vibeLoadVisuals = useStore((s) => s.vibeLoadVisuals);

  // keep the muted visuals in step when the song changes (Next/Prev/live)
  useEffect(() => {
    if (open) vibeLoadVisuals();
  }, [open, track?.id, vibeLoadVisuals]);

  useEffect(() => {
    document.body.classList.toggle('vibe-fs', open);
    return () => document.body.classList.remove('vibe-fs');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // real browser fullscreen — same proven pattern as theater
    const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    req?.call(document.documentElement).catch?.();
    const onFsChange = () => {
      if (!document.fullscreenElement) close();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') close();
      if (e.key === ' ') { e.preventDefault(); toggleLocalPlay(); }
      if (e.key === 'ArrowRight') localNext();
      if (e.key === 'ArrowLeft') localPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, toggleLocalPlay, localNext, localPrev]);

  if (!open || !track) return null;

  return (
    <div id="vibe-fs" className="vibe-fs open" role="dialog" aria-modal="true" aria-label="Vibe fullscreen">
      <div className="vibe-fs-top">
        <span className="live-chip"><span className="dot" /> LIVE</span>
        <span className="vibe-fs-title">{track.title} — {track.artist}</span>
        {vibeFsVideo && <span className="vibe-fs-note">visuals · audio from Drive</span>}
      </div>

      <BeatLyrics showMeta={false} />

      <div className="vibe-fs-bar">
        <div className="vibe-fs-progress"><PlayerProgress /></div>
        <div className="vibe-fs-controls">
          <button className="ctrl-btn" onClick={localPrev} aria-label="Previous">
            <i className="fa-solid fa-backward-step" />
          </button>
          <button className="play-btn" onClick={toggleLocalPlay} aria-label={audioPlaying ? 'Pause' : 'Play'}>
            <i className={`fa-solid ${audioPlaying ? 'fa-pause' : 'fa-play'}`} style={audioPlaying ? {} : { marginLeft: 4 }} />
          </button>
          <button className="ctrl-btn" onClick={localNext} aria-label="Next">
            <i className="fa-solid fa-forward-step" />
          </button>
          {!inLive && (
            <button className="btn-live" onClick={backToLive}><i className="fa-solid fa-rotate-left" /> Back to Live</button>
          )}
          <span className="vibe-fs-time">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
          <button className="icon-btn" onClick={close} aria-label="Close fullscreen vibe" title="Close (Esc)">
            <i className="fa-solid fa-compress" />
          </button>
        </div>
      </div>
    </div>
  );
}