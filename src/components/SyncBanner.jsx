import { useStore } from '../store/useStore.js';

/** "Out of Sync" pill with the one-tap Back-to-Live return. */
export default function SyncBanner() {
  const inLive = useStore((s) => s.inLive);
  const manualReason = useStore((s) => s.manualReason);
  const backToLive = useStore((s) => s.backToLive);

  if (inLive) return null;

  return (
    <div className="sync-banner show" role="status">
      <div className="sb-icon"><i className="fa-solid fa-user-clock" /></div>
      <div className="sb-text">
        <strong>Out of Sync · Manual Mode</strong>
        <span>{manualReason || 'You are listening on your own.'}</span>
      </div>
      <button className="btn-live" onClick={backToLive}>
        <i className="fa-solid fa-rotate-left" /> Back to Live
      </button>
    </div>
  );
}