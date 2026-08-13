import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';

/**
 * Mobile swipe gestures — the pocket radio remote.
 *  left  → next song (leave sync)
 *  right → previous song
 *  up    → fullscreen lyrics
 *  down  → close fullscreen lyrics
 */
export function useSwipe() {
  const start = useRef(null);

  useEffect(() => {
    const get = () => useStore.getState();
    const onStart = (e) => {
      const t = e.target;
      if (t.closest('input, textarea, .rail-card')) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const onEnd = (e) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x;
      const dy = e.changedTouches[0].clientY - start.current.y;
      const dur = Date.now() - start.current.t;
      start.current = null;
      if (dur > 1200) return;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 60) return;
      const s = get();
      if (ax > ay) {
        if (dx < 0) s.localNext();
        else s.localPrev();
      } else if (dy < 0) {
        s.openTheater();
      } else {
        s.closeTheater();
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);
}