import { useEffect, useRef } from 'react';

/**
 * Animated cinematic background:
 *  - floating rose petals (beating petals, sway + spin)
 *  - slow bokeh orbs
 *  - rising embers, tinted by the analyser when available
 * Reacts to music (amplitude) when the analyser can read the stream.
 */
export default function Background() {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    let raf = 0;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a, b) => a + Math.random() * (b - a);

    const petals = Array.from({ length: 14 }, () => ({
      x: rand(0, 1), y: rand(0, 1), size: rand(9, 18),
      sway: rand(0.5, 1.6), speed: rand(0.0004, 0.001),
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.004, 0.004),
      hue: Math.random() < 0.35 ? 340 : 350, phase: rand(0, Math.PI * 2),
      alpha: rand(0.1, 0.32)
    }));

    const orbs = Array.from({ length: 8 }, () => ({
      x: rand(0, 1), y: rand(0, 1), r: rand(60, 220),
      dx: rand(0.00003, 0.00009), dy: rand(0.00002, 0.00007),
      hue: Math.random() < 0.5 ? 350 : 340
    }));

    const embers = Array.from({ length: 16 }, () => ({
      x: rand(0, 1), y: rand(0.2, 1), size: rand(1, 2.2),
      speed: rand(0.00025, 0.0008), alpha: rand(0.08, 0.3), phase: rand(0, Math.PI * 2)
    }));

    let audioLevel = 0;
    const readAnalyser = () => {
      try {
        const mod = window.__ishqAudio;
        if (mod?.sample) {
          const s = mod.sample();
          audioLevel = s && s.ok ? s.level : 0;
        } else audioLevel = 0;
      } catch { audioLevel = 0; }
    };

    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      ctx2d.clearRect(0, 0, w, h);
      readAnalyser();

      // ambient pulse even without music (the lounge never sleeps)
      const pulse = 0.5 + 0.5 * Math.sin(t / 900);
      const energy = Math.max(audioLevel || 0, 0.05 + 0.05 * pulse);

      // orbs
      for (const o of orbs) {
        o.x += o.dx; o.y += o.dy;
        if (o.x < -0.2) o.x = 1.2; if (o.x > 1.2) o.x = -0.2;
        if (o.y < -0.2) o.y = 1.2; if (o.y > 1.2) o.y = -0.2;
        const g = ctx2d.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, o.r);
        g.addColorStop(0, `hsla(${o.hue}, 90%, 55%, ${0.035 + energy * 0.03})`);
        g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(o.x * w - o.r, o.y * h - o.r, o.r * 2, o.r * 2);
      }

      // petals (romantic rose petals drifting)
      for (const p of petals) {
        p.y += p.speed * (1 + energy * 1.4);
        p.x += Math.sin(t / 1200 * p.sway + p.phase) * 0.00035 + 0.00012;
        p.rot += p.rotSpeed * (1 + energy);
        if (p.y > 1.08) { p.y = -0.06; p.x = rand(0, 1); }
        if (p.x > 1.12) p.x = -0.1;
        drawPetal(ctx2d, p.x * w, p.y * h, p.size, p.rot, p.hue, p.alpha * (0.7 + energy * 0.4));
      }

      // embers rising
      for (const e of embers) {
        e.y -= e.speed * (1 + energy * 0.6);
        if (e.y < -0.05) { e.y = 1.05; e.x = rand(0, 1); }
        ctx2d.beginPath();
        ctx2d.arc(e.x * w, e.y * h, e.size, 0, Math.PI * 2);
        ctx2d.fillStyle = `hsla(0, 85%, ${55 + 15 * Math.sin(t / 700 + e.phase)}%, ${e.alpha})`;
        ctx2d.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="fx" aria-hidden="true" />;
}

function drawPetal(ctx, x, y, size, rot, hue, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const grad = ctx.createLinearGradient(-size, 0, size, 0);
  grad.addColorStop(0, `hsla(${hue}, 92%, 60%, ${alpha})`);
  grad.addColorStop(1, `hsla(${hue + 10}, 85%, 42%, ${alpha * 0.85})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.bezierCurveTo(size / 2, -size / 2, size / 2, size / 3, 0, size / 2);
  ctx.bezierCurveTo(-size / 2, size / 3, -size / 2, -size / 2, 0, -size / 2);
  ctx.fill();
  ctx.restore();
}