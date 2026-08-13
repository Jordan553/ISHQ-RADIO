import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { loveLetter, SHARE_INTENTS } from '../lib/loveLetters.js';

/**
 * Love Letter Generator — a romantic one-liner drawn for the current
 * mood, with copy + WhatsApp/Telegram/X share buttons.
 */
export default function LoveLetter() {
  const mood = useStore((s) => s.mood);
  const pushToast = useStore((s) => s.pushToast);
  const [line, setLine] = useState(null);
  const [used, setUsed] = useState([]);

  const write = () => {
    const next = loveLetter(mood || 'romance', used);
    setUsed((u) => [...u.slice(-5), next]);
    setLine(next);
  };

  const copy = async () => {
    const text = `${line}\n— ISHQ Radio ♥`;
    try {
      await navigator.clipboard.writeText(text);
      pushToast('Love letter copied — dil se bhejo ❤️', 'live');
    } catch {
      pushToast('Copy failed — select the line manually', 'warn');
    }
  };

  return (
    <div className="rail-card love-letter">
      <div className="lc-head">
        <span><i className="fa-solid fa-pen-nib" style={{ color: 'var(--red-soft)', marginRight: 6 }} /> LOVE LETTER</span>
        <span className="lm-hint">one line, from my heart</span>
      </div>

      {line ? (
        <>
          <p className="ll-line" key={line}>
            “{line}”
          </p>
          <div className="ll-row">
            <button className="ll-btn ll-share" onClick={copy}>
              <i className="fa-solid fa-copy" /> Copy
            </button>
            {SHARE_INTENTS.map((s) => (
              <a
                key={s.id}
                className="ll-btn"
                href={s.href(`${line}\n— ISHQ Radio ♥`)}
                target="_blank"
                rel="noreferrer"
                title={`Share on ${s.label}`}
              >
                <i className={s.icon} />
              </a>
            ))}
            <button className="ll-btn" onClick={write} title="Another one" aria-label="Another line">
              <i className="fa-solid fa-shuffle" />
            </button>
          </div>
        </>
      ) : (
        <button className="ll-write" onClick={write}>
          <i className="fa-solid fa-pen-nib" /> Write one for tonight
        </button>
      )}
    </div>
  );
}