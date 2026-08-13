import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { MOODS } from '../lib/moods.js';

/**
 * Mood chips — every vibe gets a chip; online moods stream through the
 * normal YouTube flow, Jordan Core loads the Drive collection, and the
 * "Custom" chip lets anyone craft their own mood from a free-text vibe.
 */
export default function MoodBar() {
  const mood = useStore((s) => s.mood);
  const moodBusy = useStore((s) => s.moodBusy);
  const playMood = useStore((s) => s.playMood);
  const customMoods = useStore((s) => s.customMoods);
  const addCustomMood = useStore((s) => s.addCustomMood);
  const removeCustomMood = useStore((s) => s.removeCustomMood);

  const [diy, setDiy] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    setDiy(false);
    addCustomMood(t);
  };

  return (
    <div className="mood-bar" role="tablist" aria-label="Moods">
      <span className="mood-label"><i className="fa-solid fa-sliders" /> MOODS</span>
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

        {customMoods.map((m) => {
          const active = mood === m.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              className={`mood-chip custom ${active ? 'active' : ''}`}
              onClick={() => playMood(m.id)}
              disabled={moodBusy && !active}
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              <span>{m.label}</span>
              {moodBusy && active && <i className="fa-solid fa-spinner fa-spin mood-spin" />}
              <span
                className="mood-x"
                role="button"
                aria-label={`Remove ${m.label} mood`}
                onClick={(e) => { e.stopPropagation(); removeCustomMood(m.id); }}
              >
                <i className="fa-solid fa-xmark" />
              </span>
            </button>
          );
        })}

        {diy ? (
          <div className="mood-diy">
            <input
              className="mood-diy-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setDiy(false); }}
              placeholder="your vibe — e.g. monsoon, blue hour…"
              autoFocus
              aria-label="Custom mood name"
            />
            <button className="mood-diy-go" onClick={submit} aria-label="Add mood"><i className="fa-solid fa-plus" /></button>
          </div>
        ) : (
          <button className="mood-chip mood-add" onClick={() => setDiy(true)} disabled={moodBusy}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            <span>Custom</span>
          </button>
        )}
      </div>
    </div>
  );
}