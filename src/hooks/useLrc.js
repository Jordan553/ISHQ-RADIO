import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import { fetchLrc } from '../lib/lyrics.js';

/**
 * Resolve timed lyrics for a track — static map first, LRCLIB via the
 * server relay otherwise. Deduped in-flight at the lib level; this hook
 * only fires once per track (status guard in the store).
 */
export function useLrc(track) {
  const trackId = track?.id;
  const meta = useStore((s) => (trackId ? s.tracksMeta[trackId] : null));

  useEffect(() => {
    if (!track || !trackId) return;
    const rec = useStore.getState().tracksMeta[trackId];
    if (rec?.lrc || ['loading', 'missing', 'error'].includes(rec?.status)) return;
    useStore.setState((s) => ({
      tracksMeta: { ...s.tracksMeta, [trackId]: { ...s.tracksMeta[trackId], status: 'loading' } }
    }));
    fetchLrc(track).then(({ lrc, status }) => {
      useStore.setState((s) => ({
        tracksMeta: {
          ...s.tracksMeta,
          [trackId]: { lrc: lrc || s.tracksMeta[trackId]?.lrc || null, status }
        }
      }));
    });
  }, [track, trackId]);

  return meta;
}