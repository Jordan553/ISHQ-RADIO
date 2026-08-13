import { useEffect, useRef, useState } from 'react';

/**
 * Beat detector — streams the audio analyser and fires a `beat` tick
 * whenever the energy spikes above its rolling average (with a short
 * refractory window so one hit = one beat). `energy` stays in a ref
 * (updated per frame, no re-renders); `beat` is a counter you can use
 * as an effect dependency or subscribe to via `onBeat`.
 */
export function useBeat() {
  const [beat, setBeat] = useState(0);
  const energyRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let ema = 0.08;
    let lastHit = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      let lvl = 0;
      try {
        const s = window.__ishqAudio?.sample?.();
        lvl = s && s.ok ? s.level : 0;
      } catch { lvl = 0; }
      ema = ema * 0.9 + lvl * 0.1;
      energyRef.current = lvl;
      const now = performance.now();
      if (lvl > Math.max(ema * 1.35, 0.13) && now - lastHit > 360) {
        lastHit = now;
        setBeat((b) => b + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { beat, energyRef };
}
