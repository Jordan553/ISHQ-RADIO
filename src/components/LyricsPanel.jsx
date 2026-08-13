import { useStore } from '../store/useStore.js';
import { LyricsView } from './LyricsView.jsx';

export default function LyricsPanel() {
  const playlist = useStore((s) => s.playlist);
  const live = useStore((s) => s.live);
  const onlineNow = useStore((s) => s.onlineNow);
  const track = onlineNow || playlist[live?.currentSongIndex] || playlist[0];
  const openTheater = useStore((s) => s.openTheater);
  const autoScroll = useStore((s) => s.autoScroll);
  const setAutoScroll = useStore((s) => s.setAutoScroll);

  if (!track) return null;

  return (
    <>
      <div className="lyrics-head">
        <div className="lh-title">
          <i className="fa-solid fa-scroll" /> NOW PLAYING · LYRICS
        </div>
        <div className="lyrics-actions">
          <button className={`icon-btn ${autoScroll ? 'on' : ''}`}
            style={{ width: 32, height: 32, fontSize: 12 }}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}>
            <i className="fa-solid fa-align-center" />
          </button>
          <button className="icon-btn"
            style={{ width: 32, height: 32, fontSize: 12 }}
            onClick={openTheater}
            title="Fullscreen lyrics">
            <i className="fa-solid fa-expand" />
          </button>
        </div>
      </div>
      <div className="lyrics-view">
        <LyricsView trackId={track.id} theme="panel" />
      </div>
    </>
  );
}