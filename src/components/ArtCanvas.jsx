import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { artUrl } from '../lib/thumb.js';

/**
 * Cinematic art canvas — the current cover blown up, blurred into a
 * slow Ken Burns drift. Powers Party mode (behind the whole UI) and
 * the fullscreen lyrics backdrop.
 */
export default function ArtCanvas({ className = '' }) {
  const ref = useRef(null);
  const src = useStore((s) => {
    const t = s.onlineNow || s.playlist[s.live?.currentSongIndex];
    if (!t?.coverUrl) return '';
    return artUrl(t.coverUrl);
  });

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let img = null;
    let raf = 0;
    let t0 = performance.now();
    const start = src ? Math.random() * 1000 : 0;

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => { img = imgEl; };
    if (src) imgEl.src = src;

    const resize = () => {
      cv.width = Math.max(1, cv.clientWidth);
      cv.height = Math.max(1, cv.clientHeight);
      cv.width *= Math.min(window.devicePixelRatio || 1, 2);
      cv.height *= Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const frame = (now) => {
      const t = (now - t0) / 1000 + start;
      raf = requestAnimationFrame(frame);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!img) {
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.75);
        const hue = ((t * 14) + (src ? 340 : 250)) % 360;
        g.addColorStop(0, `hsla(${hue}, 80%, 45%, 0.55)`);
        g.addColorStop(0.55, `hsla(${(hue + 70) % 360}, 75%, 28%, 0.4)`);
        g.addColorStop(1, 'rgba(8, 6, 12, 0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        return;
      }
      const iw = img.naturalWidth || 320, ih = img.naturalHeight || 180;
      const scale = Math.max(W / iw, H / ih) * (1.08 + Math.sin(t * 0.13) * 0.07);
      const dw = iw * scale, dh = ih * scale;
      const panX = Math.sin(t * 0.07) * (dw - W) * 0.5;
      const panY = Math.cos(t * 0.09) * (dh - H) * 0.5;
      ctx.save();
      ctx.filter = 'blur(16px) saturate(1.4) brightness(1.02)';
      ctx.drawImage(img, (W - dw) / 2 + panX, (H - dh) / 2 + panY, dw, dh);
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [src]);

  return <canvas ref={ref} className={`art-canvas ${className}`} aria-hidden="true" />;
}