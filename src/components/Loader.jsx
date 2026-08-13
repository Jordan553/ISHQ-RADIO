import { useStore } from '../store/useStore.js';

/** Branded loading screen, then a tappable gate if autoplay is blocked. */
export default function Loader() {
  const ready = useStore((s) => s.ready);
  const joinNeeded = useStore((s) => s.joinNeeded);
  const trackError = useStore((s) => s.trackError);
  const joinLive = useStore((s) => s.joinLive);
  const listeners = useStore((s) => s.listeners);
  const playlist = useStore((s) => s.playlist);
  const onlineNow = useStore((s) => s.onlineNow);
  const liveIdx = useStore((s) => s.live?.currentSongIndex) || 0;
  const current = onlineNow || playlist[liveIdx];

  if (trackError) {
    return (
      <div className="loader">
        <div className="loader-logo">
          <div className="loader-heart"><i className="fa-solid fa-heart-broken" /></div>
          <div className="loader-brand">ISHQ <em>RADIO</em></div>
          <p style={{ color: '#f5b148', fontSize: 13, maxWidth: 320, textAlign: 'center' }}>
            {trackError}
          </p>
        </div>
      </div>
    );
  }

  if (joinNeeded) {
    return (
      <div className="join-gate show">
        <div className="loader-logo">
          <div className="loader-heart"><i className="fa-solid fa-heart" /></div>
          <div className="loader-brand">ISHQ <em>RADIO</em></div>
          <p>Join the lounge<br /><span style={{ fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 400, color: 'var(--muted)', letterSpacing: 2 }}>
            RADIO STARTS WITH ONE TAP
          </span></p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-ui)', marginTop: -8 }}>
            {listeners} {listeners === 1 ? 'soul' : 'souls'} already listening
            <br />
            {current?.title || ''} — playing right now
          </p>
        </div>
        <button className="join-btn" onClick={joinLive}>
          <i className="fa-solid fa-play" /> Enter the Lounge
        </button>
      </div>
    );
  }

  return (
    <div className={`loader ${ready ? 'done' : ''}`}>
      <div className="loader-logo">
        <div className="loader-heart"><i className="fa-solid fa-heart" /></div>
        <div className="loader-brand">ISHQ <em>RADIO</em></div>
        <div className="loader-tag">Live Together · Feel the Love</div>
      </div>
      <div className="loader-bars">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  );
}