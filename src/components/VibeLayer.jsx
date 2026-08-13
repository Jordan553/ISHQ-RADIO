import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';

/**
 * Immersive Vibe — when an online song is playing, its actual YouTube
 * video is revealed beneath the app, blurred into a living color field
 * that breathes with the music. The veil keeps the edges cinematic and
 * the UI readable. Toggled from the Vibe pill in the top bar.
 */
export default function VibeLayer() {
  const vibe = useStore((s) => s.vibe);
  const onlineNow = useStore((s) => s.onlineNow);

  useEffect(() => {
    document.body.classList.toggle('vibe', !!vibe);
  }, [vibe]);

  useEffect(() => {
    document.body.classList.toggle('vibe-online', !!onlineNow && !!vibe);
  }, [onlineNow, vibe]);

  if (!vibe || !onlineNow) return null;
  return <div className="vibe-veil" aria-hidden="true" />;
}