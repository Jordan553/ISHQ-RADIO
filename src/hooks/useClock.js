import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { CONFIG } from '../lib/config.js';

/**
 * Main heartbeat: ticks playback time into state and runs the
 * sync engine's periodic drift correction.
 */
export function useClock() {
  useEffect(() => {
    const drift = setInterval(() => useStore.getState().driftCheck(), CONFIG.sync.driftCheckEveryMs);
    return () => clearInterval(drift);
  }, []);
}

/** Update every intervalMs — for session/playing clocks. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}