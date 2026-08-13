import { useEffect } from 'react';
import { useStore } from './store/useStore.js';
import { audioEngine } from './lib/audioEngine.js';
import TopBar from './components/TopBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import LyricsPanel from './components/LyricsPanel.jsx';
import QueuePanel from './components/QueuePanel.jsx';
import YouTubeFrame from './components/YouTubeFrame.jsx';
import { ytPlayer } from './lib/ytPlayer.js';
import FullscreenLyrics from './components/FullscreenLyrics.jsx';
import SyncBanner from './components/SyncBanner.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ToastTray from './components/ToastTray.jsx';
import Loader from './components/Loader.jsx';
import Background from './components/Background.jsx';
import CinemaBackground from './components/CinemaBackground.jsx';
import VibeWidget from './components/VibeWidget.jsx';
import LiveMoments from './components/LiveMoments.jsx';
import LoveLetter from './components/LoveLetter.jsx';
import MoodAura from './components/MoodAura.jsx';
import ArtCanvas from './components/ArtCanvas.jsx';
import BeatLyrics from './components/BeatLyrics.jsx';
import { useClock } from './hooks/useClock.js';
import { useSwipe } from './hooks/useSwipe.js';

const PEOPLE = [
  { i: 'A', h: 342, fall: 66 },
  { i: 'R', h: 350, fall: 62 },
  { i: 'Z', h: 335, fall: 80 },
  { i: 'M', h: 344, fall: 70 }
];

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);
  const ready = useStore((s) => s.ready);
  const railTab = useStore((s) => s.railTab);
  const theaterOpen = useStore((s) => s.theaterOpen);
  const joinNeeded = useStore((s) => s.joinNeeded);
  const bgTheme = useStore((s) => s.bgTheme);
  const dark = useStore((s) => s.dark);
  const listeners = useStore((s) => s.listeners);

  useClock();
  useSwipe();

  useEffect(() => {
    document.body.classList.toggle('light', dark === false);
  }, [dark]);

  const midnight = useStore((s) => s.midnight);
  const checkMidnight = useStore((s) => s.checkMidnight);
  const party = useStore((s) => s.party);
  useEffect(() => {
    checkMidnight();
    const t = setInterval(checkMidnight, 60_000);
    return () => clearInterval(t);
  }, [checkMidnight]);
  useEffect(() => {
    document.body.classList.toggle('midnight', midnight);
  }, [midnight]);
  useEffect(() => {
    document.body.classList.toggle('party', party);
  }, [party]);
  useEffect(() => {
    document.body.classList.toggle('cinema', bgTheme === 'cinema' || bgTheme === 'theater');
  }, [bgTheme]);

  useEffect(() => {
    window.__ishqAudio = audioEngine;
    window.__ishqYt = ytPlayer;
    bootstrap();

    // autoplay attempt — browsers usually block it; the gate handles the rest
    const tryAuto = () => {
      const { inLive, live } = useStore.getState();
      if (inLive && live?.isPlaying) {
        audioEngine.playRaw().catch(() => useStore.setState({ joinNeeded: true }));
      }
    };
    audioEngine.on('ready', tryAuto);
    const t = setTimeout(tryAuto, 2500);
    return () => clearTimeout(t);
  }, [bootstrap]);

  return (
    <>
      <YouTubeFrame />
      {bgTheme === 'cinema' || bgTheme === 'theater' ? (
        <>
          <CinemaBackground />
          {bgTheme === 'theater' && <BeatLyrics />}
        </>
      ) : (
        <>
          <div className="bg-blobs" aria-hidden="true">
            <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
          </div>
          <Background />
        </>
      )}
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <MoodAura />
      {party && <ArtCanvas />}

      <div id="app" className={ready ? 'ready' : ''} data-bg={bgTheme}>
        <TopBar />
        <Sidebar />
        <main className="main">
          <div className="stage">
            <NowPlaying />
          </div>

          <aside className="rail">
            <div className="rail-card rail-tabs-card">
              <div className="rail-tabs">
                <button
                  className={`rail-tab ${railTab === 'lyrics' ? 'active' : ''}`}
                  onClick={() => useStore.setState({ railTab: 'lyrics' })}
                >
                  <i className="fa-solid fa-scroll" style={{ marginRight: 6 }} /> Lyrics
                </button>
                <button
                  className={`rail-tab ${railTab === 'queue' ? 'active' : ''}`}
                  onClick={() => useStore.setState({ railTab: 'queue' })}
                >
                  <i className="fa-solid fa-list-ul" style={{ marginRight: 6 }} /> Next Up
                </button>
              </div>
              <div className="rail-panel">
                {railTab === 'lyrics' ? <LyricsPanel /> : <QueuePanel />}
              </div>
            </div>

            <div className="song-widgets">
              <div className="rail-card listeners-card">
                <div className="lc-row">
                  <div className="avatar-stack">
                    {PEOPLE.map((p) => (
                      <span className="avatar" key={p.i}
                        style={{ background: `linear-gradient(135deg, hsl(${p.h},70%,52%), hsl(${p.fall},65%,30%))` }}>
                        {p.i}
                      </span>
                    ))}
                  </div>
                  <span className="lc-more">+{Math.max(0, listeners - 4)}</span>
                  <span className="lc-online">{listeners} online now</span>
                </div>
              </div>

              <VibeWidget />
              <LiveMoments />
              <LoveLetter />
            </div>
          </aside>
        </main>
      </div>

      <SyncBanner />
      <SettingsModal />
      <ToastTray />
      {!joinNeeded && <FullscreenLyrics />}

      <Loader />
    </>
  );
}