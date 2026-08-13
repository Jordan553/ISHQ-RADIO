import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { artUrl } from '../lib/thumb.js';

/** Saloon-style header: brand · search · listeners + Join Room. */
export default function TopBar() {
  const listeners = useStore((s) => s.listeners);
  const setDrawer = useStore((s) => s.setDrawer);
  const openSettings = useStore((s) => s.openSettings);
  const openTheater = useStore((s) => s.openTheater);
  const isAdmin = useStore((s) => s.isAdmin);
  const inLive = useStore((s) => s.inLive);
  const joinLive = useStore((s) => s.joinLive);
  const pushToast = useStore((s) => s.pushToast);
  const playlist = useStore((s) => s.playlist);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearch = useStore((s) => s.setSearch);
  const fillQueueAndPlay = useStore((s) => s.fillQueueAndPlay);
  const liveIndex = useStore((s) => s.live?.currentSongIndex ?? 0);
  const party = useStore((s) => s.party);
  const toggleParty = useStore((s) => s.toggleParty);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);

  const onlineResults = useStore((s) => s.onlineResults);
  const searchOnline = useStore((s) => s.searchOnline);
  const playOnline = useStore((s) => s.playOnline);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  // debounced online search while typing (kept below `q`'s declaration)
  const q = searchQuery.trim().toLowerCase();
  useEffect(() => {
    if (!q) { setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      await searchOnline(q);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, searchOnline]);

  const fmtDur = (s) =>
    s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';

  const matches = q
    ? playlist
        .filter((t) => (t.title + ' ' + (t.artist || '') + ' ' + (t.album || '')).toLowerCase().includes(q))
        .slice(0, 5)
    : [];

  const joinRoom = () => {
    if (inLive) pushToast('You are already in the lounge — enjoying the same note as everyone', 'live');
    else joinLive();
  };

  const avatars = [
    { i: 'A', h: 342, fall: 66 },
    { i: 'R', h: 350, fall: 62 },
    { i: 'Z', h: 335, fall: 80 },
    { i: 'M', h: 344, fall: 70 }
  ];
  const extra = Math.max(0, listeners - 4);

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setDrawer(true)}>
        <i className="fa-solid fa-bars" />
      </button>

      <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
        <span className="brand-heart"><i className="fa-solid fa-heart" /></span>
        <span className="brand-text">ISHQ<em>RADIO</em></span>
      </a>

      <span className="live-chip top-live"><span className="dot" /> LIVE</span>

      <div className="search-box" ref={boxRef}>
        <i className="fa-solid fa-magnifying-glass" />
        <input
          type="text"
          placeholder="Search for songs, artists…"
          value={searchQuery}
          onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          aria-label="Search songs and artists"
        />
        {searchQuery && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>
          <i className="fa-solid fa-xmark" />
        </button>}
        {searchOpen && (matches.length > 0 || onlineResults.length > 0) && (
          <div className="search-results">
            {matches.map((t, i) => (
              <button
                key={t.id}
                className="sr-item"
                onClick={() => {
                  fillQueueAndPlay(playlist.indexOf(t));
                  setSearch('');
                  setSearchOpen(false);
                }}
              >
                <span className="sr-thumb">
                  <img
                    src={artUrl(t.coverUrl)}
                    alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </span>
                <span className="sr-meta">
                  <span className="sr-title">{t.title}</span>
                  <span className="sr-artist">{t.artist}</span>
                </span>
                {playlist.indexOf(t) === liveIndex && <span className="sr-now"><i className="fa-solid fa-volume-high" /></span>}
                <i className="fa-solid fa-play sr-play" />
              </button>
            ))}

            {onlineResults.length > 0 && (
              <>
                <div className="sr-online-label">ONLINE · YOUTUBE</div>
                {onlineResults.map((r) => (
                  <button
                    key={r.videoId}
                    className="sr-item"
                    onClick={() => {
                      playOnline(r);
                      setSearch('');
                      setSearchOpen(false);
                    }}
                  >
                    <span className="sr-thumb online">
                      <img src={artUrl(r.thumb)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </span>
                    <span className="sr-meta">
                      <span className="sr-title">{r.title}</span>
                      <span className="sr-artist">{r.channel}{r.duration ? ` · ${fmtDur(r.duration)}` : ''}</span>
                    </span>
                    <i className="fa-solid fa-play sr-play" />
                  </button>
                ))}
              </>
            )}

            {searching && matches.length === 0 && onlineResults.length === 0 && (
              <div className="sr-empty"><i className="fa-solid fa-spinner fa-spin" /> Searching online…</div>
            )}
          </div>
        )}
        {searchOpen && q && matches.length === 0 && onlineResults.length === 0 && !searching && (
          <div className="search-results"><div className="sr-empty">No matches found</div></div>
        )}
      </div>

      <div className="top-right">
        <div className="listen-together" title={`${listeners} listening right now`}>
          <div className="avatar-stack">
            {avatars.map((a) => (
              <span className="avatar" key={a.i}
                style={{ background: `linear-gradient(135deg, hsl(${a.h},70%,52%), hsl(${a.fall},65%,30%))` }}>
                {a.i}
              </span>
            ))}
            {extra > 0 && <span className="avatar more">+{extra}</span>}
          </div>
          <span className="listen-ct"><strong>{listeners}</strong> listening</span>
        </div>

        <button className="join-room" onClick={joinRoom}>
          <i className="fa-solid fa-users" style={{ fontSize: 12 }} /> Join Room
        </button>

        <button className="icon-btn theater-top-btn" aria-label="Theater mode" title="Theater mode — cinema scene with beat lyrics" onClick={openTheater}>
          <i className="fa-solid fa-expand" />
        </button>

        <button
          className={`icon-btn${party ? ' on' : ''}`}
          aria-label="Party mode"
          title="Party mode — art canvas everywhere"
          onClick={toggleParty}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
        </button>
        <button className="icon-btn" aria-label="Settings" onClick={openSettings}>
          <i className="fa-solid fa-gear" />
        </button>
        {isAdmin && (
          <span className="host-badge" title="Host mode active"><i className="fa-solid fa-crown" /></span>
        )}
      </div>
    </header>
  );
}