import { useEffect, useRef } from 'react';

/**
 * Cinematic Night ambience — a rain-soaked futuristic rooftop, brightened
 * and alive: drifting aurora ribbons, animated nebula haze, lightning,
 * rain pulsing with the music, rim glows, lit windows + rising embers.
 * Switches in as the background whenever bgTheme === 'cinema'.
 */
export default function CinemaBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rand = (a, b) => a + Math.random() * (b - a);

    const resize = () => {
      // replaced elements keep intrinsic size — never rely on inset-only CSS;
      // fall back to viewport if layout hasn't settled yet
      const cw = canvas.clientWidth || window.innerWidth;
      const ch = canvas.clientHeight || window.innerHeight;
      w = Math.max(1, cw);
      h = Math.max(1, ch);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    // re-check on the first few frames — the browser may size us late
    let checks = 0;
    const lateCheck = setInterval(() => {
      if (++checks > 6) { clearInterval(lateCheck); return; }
      resize();
    }, 150);

    const drops = Array.from({ length: 210 }, () => ({
      x: rand(0, 1), y: rand(0, 1),
      len: rand(14, 30), speed: rand(0.01, 0.025),
      angle: 0.18 + rand(-0.02, 0.02) // wind slant
    }));

    const clouds = Array.from({ length: 5 }, () => ({
      x: rand(0, 1), y: rand(0.05, 0.5),
      s: rand(0.7, 1.4), v: rand(0.004, 0.012)
    }));

    const dust = Array.from({ length: 60 }, () => ({
      x: rand(0, 1), y: rand(0, 1),
      r: rand(0.6, 1.8), v: rand(0.002, 0.008), tw: rand(0, 6.3)
    }));

    const embers = Array.from({ length: 22 }, () => ({
      x: rand(0, 1), y: rand(0.4, 1),
      vx: rand(-0.12, 0.12), vy: rand(-0.35, -0.12),
      r: rand(1, 2.6), hue: Math.random() < 0.5 ? 210 : 350
    }));

    let audioLevel = 0;
    let flash = 0.95;               // opening bolt crack right on entry
    let nextStrike = 700 + Math.random() * 900;
    let ema = 0.08;                 // rolling energy average for beat spikes
    let lastBeat = 0;
    let beatPulse = 0;              // 1 → 0 decay after each hit
    const born = performance.now(); // entrance timeline (ms)

    const readAnalyser = () => {
      try {
        const s = window.__ishqAudio?.sample?.();
        audioLevel = s && s.ok ? s.level : 0;
      } catch { audioLevel = 0; }
    };

    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      readAnalyser();
      const sec = t / 1000;
      const age = t - born;
      const intro = Math.min(1, age / 1800);      // 0 → 1 over the first ~2s
      const energy = Math.max(audioLevel * (0.35 + 0.65 * intro), 0.06 + 0.04 * Math.sin(sec * 1.1));

      // beat detection — spikes above the rolling average crack lightning
      // and push the whole scene into a soft fade with the music
      const nowMs = performance.now();
      ema = ema * 0.9 + audioLevel * 0.1;
      if (audioLevel > Math.max(ema * 1.35, 0.13) && nowMs - lastBeat > 380) {
        lastBeat = nowMs;
        flash = Math.max(flash, rand(0.55, 0.85));
        beatPulse = 1;
      }
      beatPulse *= 0.86;
      const beatKick = beatPulse * 0.5;

      // lightning scheduling — stormy opening, calmer afterwards
      nextStrike -= 16;
      if (nextStrike <= 0) {
        flash = Math.max(flash, rand(0.85, 1.15));
        nextStrike = age < 3000
          ? 900 + Math.random() * 1600
          : 5200 + Math.random() * 7200;
      }
      flash *= 0.92;

      // sky — deep night with slow hue drift
      const hueShift = (sec * 6) % 360;
      const sky = ctx2d.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, `hsl(${(224 + hueShift * 0.05) % 360}, 55%, 12%)`);
      sky.addColorStop(0.55, `hsl(${(255 + hueShift * 0.08) % 360}, 48%, 9%)`);
      sky.addColorStop(1, '#07060c');
      ctx2d.fillStyle = sky;
      ctx2d.fillRect(0, 0, w, h);

      // nebula clouds — big soft drifting color pools
      for (let i = 0; i < 3; i++) {
        const nx = w * (0.3 + 0.4 * Math.sin(sec * (0.05 + i * 0.02) + i * 2.1));
        const ny = h * (0.22 + 0.2 * Math.sin(sec * 0.07 + i * 1.3));
        const nr = Math.max(w, h) * (0.4 + 0.12 * Math.sin(sec * 0.3 + i));
        const nh = (hueShift + 200 + i * 40) % 360;
        const g = ctx2d.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0, `hsla(${nh}, 85%, ${46 + energy * 14}%, ${0.16 + energy * 0.1 + beatKick * 0.14})`);
        g.addColorStop(0.6, `hsla(${(nh + 60) % 360}, 75%, 32%, 0.07)`);
        g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(0, 0, w, h);
      }

      // hazy cloud streaks drifting across the scene
      for (const cl of clouds) {
        cl.x += cl.v * 0.016;
        if (cl.x > 1.3) cl.x = -0.3;
        const cw2 = w * 0.55 * cl.s, ch2 = h * 0.08 * cl.s;
        const cg = ctx2d.createLinearGradient(cl.x * w - cw2, 0, cl.x * w + cw2, 0);
        cg.addColorStop(0, 'rgba(160,175,215,0)');
        cg.addColorStop(0.5, `rgba(160,175,215,${0.08 + energy * 0.05})`);
        cg.addColorStop(1, 'rgba(160,175,215,0)');
        ctx2d.fillStyle = cg;
        ctx2d.beginPath();
        ctx2d.ellipse(cl.x * w, cl.y * h + Math.sin(sec * 0.3 + cl.x * 9) * h * 0.02, cw2, ch2, 0, 0, Math.PI * 2);
        ctx2d.fill();
      }

      // aurora ribbons — two wavy translucent bands
      for (let a = 0; a < 2; a++) {
        const ay = h * (0.12 + a * 0.18) + Math.sin(sec * 0.4 + a * 1.7) * h * 0.05;
        const ah = (hueShift + 110 + a * 90) % 360;
        ctx2d.beginPath();
        ctx2d.moveTo(0, ay);
        for (let x = 0; x <= w; x += 40) {
          ctx2d.lineTo(x, ay + Math.sin(x / w * 6.3 + sec * 0.6 + a * 2.4) * h * 0.06);
        }
        const ag = ctx2d.createLinearGradient(0, ay - h * 0.09, 0, ay + h * 0.09);
        ag.addColorStop(0, `hsla(${ah}, 95%, 62%, 0)`);
        ag.addColorStop(0.5, `hsla(${ah}, 95%, 62%, ${0.10 + energy * 0.08 + beatKick * 0.12})`);
        ag.addColorStop(1, `hsla(${ah}, 95%, 62%, 0)`);
        ctx2d.strokeStyle = ag;
        ctx2d.lineWidth = h * 0.08;
        ctx2d.stroke();
      }

      // distant horizon — soft haze where the skyline used to be
      const hz = ctx2d.createLinearGradient(0, h * 0.62, 0, h);
      hz.addColorStop(0, 'rgba(10, 10, 18, 0)');
      hz.addColorStop(1, 'rgba(8, 8, 15, 0.6)');
      ctx2d.fillStyle = hz;
      ctx2d.fillRect(0, h * 0.62, w, h * 0.38);

      // blue rim glow — left combatant
      let g = ctx2d.createRadialGradient(w * 0.16, h * 0.42, 0, w * 0.16, h * 0.42, w * 0.5);
      g.addColorStop(0, `rgba(47,110,255,${0.14 + energy * 0.12 + flash * 0.05 + beatKick * 0.12})`);
      g.addColorStop(1, 'rgba(47,110,255,0)');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, 0, w, h);

      // red rim glow — right combatant
      g = ctx2d.createRadialGradient(w * 0.84, h * 0.4, 0, w * 0.84, h * 0.4, w * 0.5);
      g.addColorStop(0, `rgba(255,42,75,${0.14 + energy * 0.12 + flash * 0.05 + beatKick * 0.12})`);
      g.addColorStop(1, 'rgba(255,42,75,0)');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, 0, w, h);

      // lightning illumination (white flash + blue halo)
      if (flash > 0.02) {
        ctx2d.fillStyle = `rgba(216,225,255,${flash * 0.16})`;
        ctx2d.fillRect(0, 0, w, h);
        g = ctx2d.createRadialGradient(w * 0.55, 0, 0, w * 0.55, 0, w * 0.55);
        g.addColorStop(0, `rgba(190,210,255,${flash * 0.12})`);
        g.addColorStop(1, 'rgba(190,210,255,0)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(0, 0, w, h);
        ctx2d.strokeStyle = `rgba(226,234,255,${flash})`;
        ctx2d.lineWidth = 2;
        ctx2d.beginPath();
        let bx = w * 0.55, by = 0;
        ctx2d.moveTo(bx, by);
        while (by < h * 0.38) {
          by += rand(0.02, 0.05) * h;
          bx += rand(-0.03, 0.03) * w;
          ctx2d.lineTo(bx, by);
        }
        ctx2d.stroke();
      }

      // rain — speed & count pulse with music
      const rainBoost = 1 + energy;
      ctx2d.lineWidth = 1.1;
      ctx2d.strokeStyle = `rgba(190,205,235,${0.34 + energy * 0.22 + beatKick * 0.35})`;
      ctx2d.beginPath();
      for (const d of drops) {
        d.y += d.speed * rainBoost * (h / 900);
        d.x += d.speed * d.angle * rainBoost * (h / 900);
        if (d.y > 1.05) { d.y = -0.05; d.x = rand(0, 1.05); }
        if (d.x > 1.1) d.x = -0.05;
        ctx2d.moveTo(d.x * w, d.y * h);
        ctx2d.lineTo(d.x * w - d.angle * d.len, d.y * h - d.len);
      }
      ctx2d.stroke();

      // low volumetric fog bands
      for (let i = 0; i < 3; i++) {
        const fy = h * (0.72 + i * 0.1);
        g = ctx2d.createRadialGradient(w * (0.3 + i * 0.2), fy, 0, w * (0.3 + i * 0.2), fy, w * 0.45);
        g.addColorStop(0, 'rgba(130,140,185,0.09)');
        g.addColorStop(1, 'rgba(130,140,185,0)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(0, 0, w, h);
      }

      // wet rooftop reflection shimmer at the lower edge
      g = ctx2d.createLinearGradient(0, h * 0.88, 0, h);
      g.addColorStop(0, 'rgba(47,110,255,0)');
      g.addColorStop(0.5, `rgba(90,120,255,${0.05 + energy * 0.06})`);
      g.addColorStop(1, `rgba(255,60,90,${0.04 + energy * 0.05})`);
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, h * 0.88, w, h * 0.12);

      // entrance bloom — warm pulse that settles as the storm takes over
      if (intro < 1) {
        const bg = ctx2d.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.62);
        bg.addColorStop(0, `rgba(255, 60, 90, ${(1 - intro) * 0.16})`);
        bg.addColorStop(1, 'rgba(255, 60, 90, 0)');
        ctx2d.fillStyle = bg;
        ctx2d.fillRect(0, 0, w, h);
      }

      // drifting embers / sparks rising (energy crackle)
      for (const e of embers) {
        e.x += (e.vx * 0.002 + Math.sin(sec * 0.8 + e.r * 7) * 0.0003) * (1 + energy);
        e.y += e.vy * 0.002 * (1 + energy);
        if (e.y < -0.02 || e.x < -0.05 || e.x > 1.05) { e.x = rand(0, 1); e.y = rand(0.9, 1); }
        ctx2d.fillStyle = `hsla(${e.hue}, 90%, 68%, ${0.5 + energy * 0.4})`;
        ctx2d.beginPath();
        ctx2d.arc(e.x * w, e.y * h, e.r * (0.8 + energy * 0.6), 0, Math.PI * 2);
        ctx2d.fill();
      }
    // floating dust — slow drifting motes, twinkle with the music
      ctx2d.fillStyle = '#cdd8ff';
      for (const d of dust) {
        d.x += d.v * 0.016 * (1 + energy);
        d.y += Math.sin(sec * 0.5 + d.tw) * 0.00012;
        if (d.x > 1.05) d.x = -0.05;
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(sec * (1.2 + d.tw) + d.tw * 3));
        ctx2d.globalAlpha = twinkle * (0.25 + energy * 0.3);
        ctx2d.beginPath();
        ctx2d.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(lateCheck);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} id="fx" aria-hidden="true" />;
}