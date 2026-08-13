import { useState } from 'react';
import { useStore } from '../store/useStore.js';

/** Floating vibe card — volume, background ambience, collapse. */
export default function VibeWidget() {
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const bgTheme = useStore((s) => s.bgTheme);
  const setBgTheme = useStore((s) => s.setBgTheme);
  const [open, setOpen] = useState(true);

  const name = bgTheme === 'cinema' ? 'Cinematic Night' : 'Chill Romantic';
  const icon = bgTheme === 'cinema' ? 'fa-bolt' : 'fa-heart';

  return (
    <div className={`vibe-widget ${open ? '' : 'collapsed'}`}>
      <div className="vibe-head">
        <span className="vibe-label">VIBE</span>
        <span className="vibe-name"><i className={`fa-solid ${icon}`} /> {name}</span>
        <button className="vibe-collapse" aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen(!open)}>
          <i className={`fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
        </button>
      </div>
      {open && (
        <div className="vibe-body">
          <div className="vibe-row">
            <i className="fa-solid fa-volume-high" />
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))} aria-label="Volume" />
            <span className="vibe-pct">{Math.round(volume * 100)}</span>
          </div>
          <div className="vibe-switch">
            <span className="vibe-switch-label">Ambience</span>
            <div className="vibe-pills">
              <button className={`vibe-pill ${bgTheme === 'romantic' ? 'active' : ''}`} onClick={() => setBgTheme('romantic')}>
                <i className="fa-solid fa-heart" /> Romantic
              </button>
              <button className={`vibe-pill ${bgTheme === 'cinema' ? 'active' : ''}`} onClick={() => setBgTheme('cinema')}>
                <i className="fa-solid fa-bolt" /> Cinema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}