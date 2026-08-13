import { useStore } from '../store/useStore.js';
import MoodBar from './MoodBar.jsx';

const NAV = [
  { key: 'home', icon: 'fa-solid fa-house', label: 'Home' },
  { key: 'explore', icon: 'fa-solid fa-compass', label: 'Explore' },
  { key: 'radio', icon: 'fa-solid fa-tower-broadcast', label: 'Radio', live: true },
  { key: 'liked', icon: 'fa-solid fa-heart', label: 'Liked' },
  { key: 'history', icon: 'fa-solid fa-clock-rotate-left', label: 'History' }
];

export default function Sidebar() {
  const setDrawer = useStore((s) => s.setDrawer);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const setRailTab = useStore((s) => s.setRailTab);
  const listeners = useStore((s) => s.listeners);
  const netStatus = useStore((s) => s.netStatus);
  const inLive = useStore((s) => s.inLive);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  const click = (item) => {
    setDrawer(false);
    setRailTab('queue');
    setView(item.key);
  };

  return (
    <>
      {drawerOpen && <div className="drawer-overlay show" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <span className="brand-heart"><i className="fa-solid fa-heart" /></span>
            <span className="brand-text">ISHQ<em>RADIO</em></span>
          </a>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <a
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              href="#"
              onClick={(e) => { e.preventDefault(); click(item); }}
            >
              <i className={item.icon} />
              {item.label}
              {item.live && <span className="nav-live">LIVE</span>}
            </a>
          ))}
        </nav>

        <MoodBar />

        <div className="side-footer">
          <div className="conn-status">
            <span className={`conn-dot ${netStatus === 'synced' ? 'ok' : 'warn'}`} />
            {netStatus === 'resyncing' ? 'Resyncing with live radio…' : inLive ? 'Live Sync Active' : 'Manual mode'}
            <span className="conn-souls">{listeners} {listeners === 1 ? 'soul' : 'souls'}</span>
          </div>
          <p>Made with ♥ for lovers · ISHQ RADIO</p>
        </div>
      </aside>
    </>
  );
}