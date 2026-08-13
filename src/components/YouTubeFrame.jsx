import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { ytPlayer } from '../lib/ytPlayer.js';

/**
 * Hidden full-screen YouTube iframe player.
 * All visuals live above it (the app's own UI) — the embed is invisible.
 */
export default function YouTubeFrame() {
  const hostRef = useRef(null);
  const initYt = useStore((s) => s.initYt);

  useEffect(() => {
    if (hostRef.current) initYt(hostRef.current);
  }, [initYt]);

  useEffect(() => () => ytPlayer.stop(), []);

  return (
    <div className="yt-frame" aria-hidden="true">
      <div ref={hostRef} className="yt-host" />
    </div>
  );
}