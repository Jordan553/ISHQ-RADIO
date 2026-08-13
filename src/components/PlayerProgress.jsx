import { useStore } from '../store/useStore.js';
import { fmtTime } from '../lib/lrcParser.js';

/**
 * Shared seek slider — dragging it moves you into manual mode.
 * (Hosts can seek globally from the Host Controls panel instead.)
 */
export default function PlayerProgress() {
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);
  const localSeek = useStore((s) => s.localSeek);

  const max = duration > 0 ? duration : 1;
  const pct = Math.min(100, (currentTime / max) * 100);

  const onInput = (e) => localSeek(parseFloat(e.target.value));

  return (
    <div className="progress-row">
      <span className="time-lbl">{fmtTime(currentTime)}</span>
      <input
        id="seek"
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={Math.min(currentTime, max)}
        style={{ '--fill': `${pct}%` }}
        aria-label="Seek"
        onInput={onInput}
        onChange={onInput}
      />
      <span className="time-lbl right">{fmtTime(duration)}</span>
    </div>
  );
}