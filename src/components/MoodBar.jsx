import { useStore } from '../store/useStore.js';
import { MOODS } from '../lib/moods.js';

/**
 * Mood chips — Love / Breakup / Rain / Night / Chill / Romance / Jordan Core.
 * Online moods stream through the normal YouTube flow; Jordan Core loads
 * the dedicated Google Drive collection. The player itself never changes.
 */
export default function MoodBar() {
  const mood = useStore((s) => s.mood);
  const moodBusy = useStore((s) => s.moodBusy);
  const playMood = useStore((s) => s.playMood);

  return (
    <div className="mood-bar" role="tablist" aria-label="Moods">
      <span className="mood-label"><i className="fa-solid fa-sliders" /> MOOD</span>
      <div className="mood-chips">
        {MOODS.map((m) => {
          const active = mood === m.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              className={`mood-chip ${active ? 'active' : ''} ${m.drive ? 'jordan' : ''}`}
              onClick={() => playMood(m.id)}
              disabled={moodBusy && !active}
            >
              <i className={`fa-solid ${m.icon}`} />
              <span>{m.label}</span>
              {moodBusy && active && <i className="fa-solid fa-spinner fa-spin mood-spin" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}