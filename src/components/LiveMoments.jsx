import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { REACTIONS } from '../lib/moods.js';

const FEED_ICONS = { react: 'fa-heart', dedication: 'fa-envelope', join: 'fa-right-to-bracket', listening: 'fa-headphones' };

/**
 * Live Moments — heart reactions (floating bubbles), Dil Ki Line
 * anonymous dedications, and the Listening Now activity feed.
 */
export default function LiveMoments() {
  const social = useStore((s) => s.social);
  const sendReaction = useStore((s) => s.sendReaction);
  const sendDedication = useStore((s) => s.sendDedication);
  const [line, setLine] = useState('');
  const [, setTick] = useState(0);

  // prune stale bubbles + keep the feed freshly alive
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const bubbles = social.reactions.filter((r) => now - r.at < 5200);

  const submitLine = (e) => {
    e.preventDefault();
    if (!line.trim()) return;
    sendDedication(line);
    setLine('');
  };

  return (
    <div className="rail-card live-moments">
      <div className="lc-head lm-head">
        <span><span className="lc-dot live" /> LIVE MOMENTS</span>
        <span className="lm-hint">react · dedicate · feel</span>
      </div>

      <div className="lm-reacts">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="lm-reaction"
            aria-label={`react ${emoji}`}
            onClick={() => sendReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form className="lm-dedicate" onSubmit={submitLine}>
        <input
          className="lm-input"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="Dil Ki Line — send an anonymous dedication…"
          maxLength={90}
          aria-label="Write a dedication"
        />
        <button type="submit" className="lm-send" aria-label="Send dedication">
          <i className="fa-solid fa-paper-plane" />
        </button>
      </form>

      <div className="lm-dedi-feed">
        {social.dedications.slice().reverse().slice(0, 2).map((d) => (
          <p className="lm-dedi" key={d.id}>
            <i className="fa-solid fa-quote-left" /> {d.text}
          </p>
        ))}
      </div>

      <div className="lm-feed">
        {social.activity.slice().reverse().slice(0, 4).map((a, i) => (
          <div className="lm-feed-item" key={a.id} style={{ animationDelay: `${i * 120}ms` }}>
            <i className={`fa-solid ${FEED_ICONS[a.kind] || 'fa-headphones'}`} />
            <span>{a.text}</span>
          </div>
        ))}
      </div>

      {bubbles.length > 0 && (
        <div className="lm-bubbles" aria-hidden="true">
          {bubbles.map((r, i) => (
            <span
              key={r.bid}
              className="lm-bubble"
              style={{
                '--drift': `${(i % 3) * 30 - 30}px`,
                '--rise': `${340 + (i % 4) * 40}px`,
                animationDelay: `${Math.max(0, (now - r.at) / 1000 - 0.1) * -1}s`
              }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}