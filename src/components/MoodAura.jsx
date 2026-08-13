import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { sceneFor, SCENE_META } from '../lib/scenes.js';

/** Simple red-tinted particle canvas: rain streaks or rose petals. */
function ParticleCanvas({ type, slow }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isRain = type === 'rain';
    const N = isRain ? 90 : 34;
    const P = [];
    for (let i = 0; i < N; i++) {
      P.push({
        x: Math.random(), y: Math.random(),
        v: (0.25 + Math.random() * 0.55) * (isRain ? 1 : 0.45),
        len: isRain ? 8 + Math.random() * 14 : 5 + Math.random() * 7,
        sway: isRain ? Math.random() * Math.PI * 2 : Math.random() * Math.PI * 2,
        swayV: isRain ? 1.2 + Math.random() : 0.4 + Math.random() * 0.8,
        o: 0.12 + Math.random() * 0.25,
        r: 1.5 + Math.random() * 2.5
      });
    }
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    let t0 = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const speed = slow ? 0.45 : 1;
      ctx.clearRect(0, 0, w, h);
      for (const p of P) {
        p.y += p.v * dt * speed * 0.018;
        p.sway += p.swayV * dt;
        const sx = p.x + Math.sin(p.sway) * 0.012;
        if (isRain) {
          ctx.strokeStyle = `rgba(190, 210, 235, ${p.o})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx * w, p.y * h);
          ctx.lineTo(sx * w - p.len * 0.25, p.y * h + p.len);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(255, 90, 110, ${p.o})`;
          ctx.shadowColor = 'rgba(255, 42, 75, 0.6)';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.ellipse(sx * w, p.y * h, p.r, p.r * 0.6, Math.sin(p.sway) * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        if (p.y > 1.06) { p.y = -0.06; p.x = Math.random(); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onHide = () => { if (document.hidden) { cancelAnimationFrame(raf); } };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [type, slow]);

  return <canvas ref={ref} className="aura-canvas" aria-hidden="true" />;
}

/** Light scenes — pure CSS glow layers. */
function LightScene({ scene }) {
  return (
    <div className={`aura-lights aura-${scene}`} aria-hidden="true">
      {scene === 'candles' && (
        <>
          <span className="candle" style={{ left: '14%', bottom: 0 }} />
          <span className="candle" style={{ left: '30%', bottom: 0, animationDelay: '0.7s' }} />
          <span className="candle" style={{ left: '58%', bottom: 0, animationDelay: '1.3s' }} />
          <span className="candle" style={{ left: '78%', bottom: 0, animationDelay: '0.4s' }} />
          <span className="candle" style={{ left: '90%', bottom: 0, animationDelay: '1.9s' }} />
        </>
      )}
      {scene === 'city' && (
        <>
          {[12, 27, 41, 63, 74, 88, 22, 49, 68, 83, 7, 35, 55, 92].map((l, i) => (
            <span key={i} className="bokeh" style={{ left: `${l}%`, bottom: `${(i * 13) % 60}%`, animationDelay: `${i * 0.4}s` }} />
          ))}
        </>
      )}
      {scene === 'sunset' && (
        <>
          <span className="sun-orb" />
          <span className="sun-haze" />
        </>
      )}
      {scene === 'moonlight' && (
        <>
          <span className="moon-orb" />
          <span className="moon-haze" />
        </>
      )}
    </div>
  );
}

/**
 * Auto Romantic Visuals — a dim ambient layer behind everything that
 * shifts with the active mood: rain, candles, city lights, sunset,
 * moonlight or falling rose petals. Midnights are slower and softer.
 */
export default function MoodAura() {
  const mood = useStore((s) => s.mood);
  const midnight = useStore((s) => s.midnight);
  const [scene, setScene] = useState(() => sceneFor(null, false));
  const key = sceneFor(mood, midnight);

  useEffect(() => {
    const t = setTimeout(() => setScene(key), key === scene ? 0 : 60);
    return () => clearTimeout(t);
  }, [key]);

  const meta = SCENE_META[scene] || {};
  const active = Boolean(mood) || midnight;
  if (!active) return null;

  return (
    <div className={`mood-aura active${midnight ? ' slow' : ''}`} data-scene={scene} key={scene} aria-hidden="true">
      {meta.canvas ? <ParticleCanvas type={scene} slow={midnight} /> : <LightScene scene={scene} />}
    </div>
  );
}