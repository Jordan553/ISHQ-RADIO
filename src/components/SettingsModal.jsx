import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { fmtTime } from '../lib/lrcParser.js';

/** Settings modal — settings, info, and the Host (admin) control panel. */
export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const isAdmin = useStore((s) => s.isAdmin);
  const unlockAdmin = useStore((s) => s.unlockAdmin);
  const lockAdmin = useStore((s) => s.lockAdmin);
  const hostPlayPause = useStore((s) => s.hostPlayPause);
  const hostStep = useStore((s) => s.hostStep);
  const hostSeek = useStore((s) => s.hostSeek);
  const setLiveTrack = useStore((s) => s.setLiveTrack);
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);
  const listeners = useStore((s) => s.listeners);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const isShuffle = useStore((s) => s.isShuffle);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const isRepeat = useStore((s) => s.isRepeat);
  const toggleRepeat = useStore((s) => s.toggleRepeat);
  const netStatus = useStore((s) => s.netStatus);
  const bgTheme = useStore((s) => s.bgTheme);
  const setBgTheme = useStore((s) => s.setBgTheme);

  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const tryUnlock = () => {
    if (!unlockAdmin(pass)) setErr('try ishq');
    else setErr('');
  };

  if (!open) return null;
  const track = (useStore.getState().onlineNow) || playlist[live?.currentSongIndex];

  return (
    <div className="modal-wrap show" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2><i className="fa-solid fa-gear" /> ISHQ RADIO</h2>
          <button className="icon-btn" onClick={close} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="modal-body">
          {/* ---------- sound ---------- */}
          <div className="setting-group">
            <h3><i className="fa-solid fa-volume-high" /> Sound</h3>
            <div className="setting-row">
              <span className="row-label">Volume</span>
              <input type="range" min={0} max={1} step={0.01} value={volume}
                style={{ width: 160 }}
                onChange={(e) => setVolume(parseFloat(e.target.value))} />
            </div>
            <div className="setting-row">
              <span className="row-label">Shuffle <small>local queue order</small></span>
              <label className="switch">
                <input type="checkbox" checked={isShuffle} onChange={toggleShuffle} />
                <span className="track" />
              </label>
            </div>
            <div className="setting-row">
              <span className="row-label">Repeat <small>loop the current song</small></span>
              <label className="switch">
                <input type="checkbox" checked={isRepeat} onChange={toggleRepeat} />
                <span className="track" />
              </label>
            </div>
          </div>

          {/* ---------- ambience ---------- */}
          <div className="setting-group">
            <h3><i className="fa-solid fa-wand-magic-sparkles" /> Ambience & Appearance</h3>
            <div className="setting-row">
              <span className="row-label">Background mood</span>
              <div className="vibe-pills">
                <button className={`vibe-pill ${bgTheme === 'romantic' ? 'active' : ''}`} onClick={() => setBgTheme('romantic')}>
                  <i className="fa-solid fa-heart" /> Romantic
                </button>
                <button className={`vibe-pill ${bgTheme === 'cinema' ? 'active' : ''}`} onClick={() => setBgTheme('cinema')}>
                  <i className="fa-solid fa-bolt" /> Cinematic
                </button>
                <button className={`vibe-pill ${bgTheme === 'theater' ? 'active' : ''}`} onClick={() => setBgTheme('theater')}>
                  <i className="fa-solid fa-music" /> Theater
                </button>
              </div>
            </div>
          </div>

          {/* ---------- live status ---------- */}
          <div className="setting-group">
            <h3><i className="fa-solid fa-tower-broadcast" /> Live Status</h3>
            <div className="setting-row">
              <span className="row-label">Synced listeners</span>
              <span className="pill"><i className="fa-solid fa-users" /> {listeners}</span>
            </div>
            <div className="setting-row">
              <span className="row-label">Connection</span>
              <span className={`pill ${netStatus === 'synced' ? '' : ''}`}>
                <i className={`fa-solid ${netStatus === 'synced' ? 'fa-link' : 'fa-bolt'}`} />
                {netStatus === 'resyncing' ? ' resyncing' : ' broadcast channel'}
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
              Every listener hears the same song at the same timestamp. Manual controls
              pull you out of sync — <b>Back to Live</b> rejoins instantly.
            </p>
          </div>

          {/* ---------- host controls ---------- */}
          <div className="setting-group">
            <h3><i className="fa-solid fa-crown" /> Host Controls</h3>
            {!isAdmin ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="text-input"
                  type="password"
                  placeholder="host passcode"
                  value={pass}
                  onChange={(e) => { setPass(e.target.value); setErr(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
                />
                <button className="btn btn-primary" onClick={tryUnlock}>Unlock</button>
              </div>
            ) : (
              <>
                <div className="admin-status on">
                  <i className="fa-solid fa-tower-broadcast" />
                  Host mode active — your changes go on air for everyone
                </div>
                <div className="host-grid" style={{ marginTop: 10 }}>
                  <button className="btn btn-primary" onClick={hostPlayPause}>
                    <i className={`fa-solid ${live?.isPlaying ? 'fa-pause' : 'fa-play'}`} />
                    {live?.isPlaying ? 'Pause radio' : 'Start radio'}
                  </button>
                  <button className="btn" onClick={() => hostStep(-1)}><i className="fa-solid fa-backward-step" /> Previous</button>
                  <button className="btn" onClick={() => hostStep(1)}><i className="fa-solid fa-forward-step" /> Next</button>
                  <button className="btn" onClick={lockAdmin}><i className="fa-solid fa-lock" /> Lock</button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="setting-row">
                    <span className="row-label">Global seek <small>broadcast to everyone</small></span>
                    <span className="pill">{fmtTime(currentTime)}</span>
                  </div>
                  <input
                    className="text-input host-track-select"
                    type="range"
                    min={0}
                    max={duration > 0 ? duration : 1}
                    step={0.5}
                    value={Math.min(currentTime, duration > 0 ? duration : 1)}
                    onChange={(e) => hostSeek(parseFloat(e.target.value))}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="setting-row">
                    <span className="row-label">Put a song on air</span>
                    <span className="pill">{track?.title}</span>
                  </div>
                  <select
                    className="text-input host-track-select"
                    style={{ marginTop: 8 }}
                    value={track?.id}
                    onChange={(e) => setLiveTrack(e.target.value)}
                  >
                    {playlist.map((t) => (
                      <option key={t.id} value={t.id} style={{ background: '#16110f' }}>
                        {t.title} — {t.artist}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {err && <p style={{ color: '#f5b148', fontSize: 11.5, marginTop: 8 }}>{err}</p>}
          </div>

          {/* ---------- about ---------- */}
          <div className="setting-group about">
            <h3><i className="fa-solid fa-heart" style={{ color: 'var(--red-soft)' }} /> ISHQ RADIO</h3>
            <p className="about-heartline">Made with ♥ for lovers</p>
            <p className="about-line">Live together · Feel the love</p>
          </div>
        </div>
      </div>
    </div>
  );
}