import { useStore } from '../store/useStore.js';
import PlayerProgress from './PlayerProgress.jsx';
import StageLyric from './StageLyric.jsx';
import { proxiedStreamUrl, toStreamUrl } from '../lib/drive.js';
import { artUrl } from '../lib/thumb.js';

/** The hero stage: LIVE header, artwork, track info and Saloon transport. */
export default function NowPlaying({ compact = false }) {
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const current = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const loadingTrack = useStore((s) => s.loadingTrack);
  const audioPlaying = useStore((s) => s.audioPlaying);
  const toggleLocalPlay = useStore((s) => s.toggleLocalPlay);
  const localNext = useStore((s) => s.localNext);
  const localPrev = useStore((s) => s.localPrev);
  const isRepeat = useStore((s) => s.isRepeat);
  const toggleRepeat = useStore((s) => s.toggleRepeat);
  const inLive = useStore((s) => s.inLive);
  const listeners = useStore((s) => s.listeners);
  const likedIds = useStore((s) => s.likedIds);
  const toggleLike = useStore((s) => s.toggleLike);
  const openSettings = useStore((s) => s.openSettings);
  const openTheater = useStore((s) => s.openTheater);
  const dedications = useStore((s) => s.social?.dedications || []);

  if (!current) return null;
  const src = artUrl(current.coverUrl);
  const liked = likedIds.includes(current.id);
  const dlHref = proxiedStreamUrl(current.audioUrl ?? current.driveId) ||
    toStreamUrl(current.audioUrl ?? current.driveId) || '#';
  const songDedi = [...dedications].reverse().find((d) => d.trackId && d.trackId === current.id) ||
    dedications[dedications.length - 1];

  return (
    <section className="now-playing">
      <div className="now-head">
        <span className="live-chip big"><span className="dot" /> LIVE</span>
        <span className="online-count hearts-now">
          <i className="fa-solid fa-heart" style={{ fontSize: 11.5 }} />
          {listeners} hearts listening now
        </span>
      </div>

      <div className="art-wrap" id="artwrap">
        <div className="art-glow" />
        <div className={`vinyl ${loadingTrack ? 'switching' : ''} ${audioPlaying ? '' : 'paused'}`}>
          <div className="vinyl-disc" />
          <div className="artwork">
            {src && <img src={src} alt={`${current.title} cover art`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          </div>
        </div>
      </div>

      <div className="stage-lyric-holder"><StageLyric /></div>

      <div className="track-info">
        <span className="eyebrow">{current.album || 'ISHQ RADIO'} · {current.genre || 'Live'}</span>
        <h1 className="track-title">{current.title}</h1>
        <p className="track-artist">
          {current.artist}
        </p>
        {songDedi && (
          <p className="song-dedication" key={songDedi.id}>
            <i className="fa-solid fa-envelope" /> “{songDedi.text}”
          </p>
        )}
      </div>

      <PlayerProgress />

      <div className="controls">
        <span className="ctrl-group ctrl-side">
          <button className={`ctrl-btn ${liked ? 'liked' : ''}`} onClick={() => toggleLike(current.id)} aria-label="Like" title="Like">
            <i className={`fa-solid ${liked ? 'fa-heart' : 'fa-heart'}`} />
          </button>
          <a className="ctrl-btn" href={dlHref} download aria-label="Download" title="Download">
            <i className="fa-solid fa-download" />
          </a>
        </span>
        <span className="ctrl-group ctrl-transport">
          <button className="ctrl-btn" onClick={localPrev} aria-label="Previous">
            <i className="fa-solid fa-backward-step" />
          </button>
          <button
            className={`play-btn ${audioPlaying ? 'playing' : ''}`}
            onClick={toggleLocalPlay}
            aria-label={audioPlaying ? 'Pause' : 'Play'}
            disabled={loadingTrack}
          >
            {loadingTrack ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <i className={`fa-solid ${audioPlaying ? 'fa-pause' : 'fa-play'}`} style={audioPlaying ? {} : { marginLeft: 4 }} />
            )}
          </button>
          <button className="ctrl-btn" onClick={localNext} aria-label="Next">
            <i className="fa-solid fa-forward-step" />
          </button>
        </span>
        <span className="ctrl-group ctrl-side">
          <button className={`ctrl-btn ${isRepeat ? 'on' : ''}`} onClick={toggleRepeat} aria-label="Repeat" title="Repeat">
            <i className="fa-solid fa-repeat" />
          </button>
          <button className="ctrl-btn" onClick={openSettings} aria-label="More" title="More">
            <i className="fa-solid fa-ellipsis" />
          </button>
        </span>
      </div>

      <div className="player-extras">
        <div className={`sync-status ${inLive ? 'live' : 'manual'}`}>
          <i className={`fa-solid ${inLive ? 'fa-link' : 'fa-user-clock'}`} />
          {inLive ? 'Synced with the live radio' : 'Out of sync — manual mode'}
        </div>
        {loadingTrack && <span className="pill"><i className="fa-solid fa-spinner fa-spin" /> buffering</span>}
        <button className="theater-open-btn" onClick={openTheater} aria-label="Open theater mode" title="Theater — cinema scene with beat lyrics">
          <i className="fa-solid fa-expand" /> Theater
        </button>
      </div>

      {!compact && <small className="room-note">
        <i className="fa-solid fa-headphones" style={{ marginRight: 6 }} />
        the whole room hears the exact same note
      </small>}
    </section>
  );
}