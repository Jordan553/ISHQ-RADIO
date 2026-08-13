/**
 * Live sync engine — the single source of truth for the radio.
 *
 * One global "live state" (song, isPlaying, startedAt, offset) lives here.
 * Every client computes its exact playback position from the server clock:
 *
 *     position = liveState.currentTimeOffset + (now - liveState.startedAt)/1000
 *
 * Providers (hot-swappable):
 *   - "broadcast" (default): localStorage + BroadcastChannel — instant sync
 *     across tabs/windows on the same machine, works without any account.
 *   - "firebase"   : real cross-device sync for all listeners (enable in
 *     src/lib/config.js and `npm i firebase`). Same clean API.
 *
 * Host actions mutate the state here; listeners follow it automatically.
 */

import { CONFIG, storage } from './config.js';

const BC_NAME = 'ishq-live-v1';
const STATE_KEY = 'ishq.live.state.v2';
const PRESENCE_KEY = 'ishq.live.presence.v1';
const MANUAL_KEY = 'ishq.manual.v1';

class SyncEngine {
  constructor() {
    this.playlist = [];
    this.state = null;
    this.provider = 'broadcast';
    this.bc = null;
    this.tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.handlers = {};
    this.presenceTimer = null;
    this.lastBound = -1;
  }

  /** Subscribe to sync events: ('global' | 'presence' | 'manual', handler). */
  on(type, fn) {
    (this.handlers[type] ||= new Set()).add(fn);
    return () => this.handlers[type]?.delete(fn);
  }

  emit(type, payload) {
    for (const fn of this.handlers[type] || []) fn(payload);
  }

  /** Seed with the playlist; load persisted state or build a fresh one. */
  init(playlist) {
    this.playlist = playlist || [];
    this.state = storage.get(STATE_KEY) || this.initialState();

    // validate against the playlist in case tracks were removed
    const idx = this.playlist.findIndex((t) => t.id === this.state.currentTrackId);
    if (idx === -1 && this.playlist.length) {
      this.state.currentTrackId = this.playlist[0].id;
      this.state.currentSongIndex = 0;
      this.state.currentTimeOffset = 0;
    }

    if (!this.state.startedAt) this.state.startedAt = Date.now(); // first visitor seeds the clock
    this.persist();

    this.connectProvider();
    this.startPresence();
    return this.state;
  }

  initialState() {
    return {
      currentTrackId: this.playlist[0]?.id || null,
      currentSongIndex: 0,
      videoId: this.playlist[0]?.videoId || null,
      isPlaying: true,
      startedAt: Date.now(),
      currentTimeOffset: 0,
      volume: 0.85,
      isShuffle: false,
      isRepeat: false,
      updatedBy: 'host',
      updatedAt: Date.now(),
      liveListenerCount: 1
    };
  }

  persist() {
    storage.set(STATE_KEY, this.state);
  }

  /* ------------------------------------------------ provider */
  connectProvider() {
    this.teardownProvider();
    if (CONFIG.firebase.enabled) {
      this.provider = 'firebase';
      import('./firebaseProvider.js').then((mod) =>
        mod.connect(this, CONFIG.firebase)
      ).catch((e) => {
        console.warn('Firebase provider failed, falling back to broadcast.', e);
        this.connectBroadcast();
      });
    } else {
      this.connectBroadcast();
    }
  }

  teardownProvider() {
    if (this.bc) {
      this.bc.onmessage = null;
      this.bc.close();
      this.bc = null;
    }
    window.removeEventListener?.('storage', this.onStorage);
  }

  connectBroadcast() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(BC_NAME);
      this.bc.onmessage = (e) => {
        if (e.data?.type === 'state') this.receiveGlobal(e.data.state, e.data.silent);
        if (e.data?.type === 'ping') this.postPong();
      };
    }
    this.onStorage = (e) => {
      if (e.key === STATE_KEY && e.newValue) {
        try { this.receiveGlobal(JSON.parse(e.newValue), true); } catch { /* noop */ }
      }
      if (e.key === PRESENCE_KEY) this.emit('presence', this.countListeners());
    };
    window.addEventListener('storage', this.onStorage);
  }

  postPong() {
    if (this.bc) this.bc.postMessage({ type: 'state', state: this.state, silent: true });
  }
  /* ------------------------------------------------ receiving */

  /**
   * Ingest a global state from the provider.
   * `hard` — true when it comes from storage/refetch (silent resync);
   * we always re-apply to live-mode clients.
   */
  receiveGlobal(next, hard = false) {
    if (!next || !next.currentTrackId) return;
    const prev = this.state;
    const changed =
      prev.currentTrackId !== next.currentTrackId ||
      prev.isPlaying !== next.isPlaying ||
      Math.abs(prev.currentTimeOffset - next.currentTimeOffset) > 0.25;

    this.state = { ...this.state, ...next };
    this.persist();
    if (changed || hard) this.emit('global', this.state);
  }

  /* ------------------------------------------------ position math */
  /** Exact global playback position (seconds) right now. */
  globalPosition(now = Date.now()) {
    if (!this.state) return 0;
    if (!this.state.isPlaying) return this.state.currentTimeOffset || 0;
    return (this.state.currentTimeOffset || 0) + (now - this.state.startedAt) / 1000;
  }

  /** How far (in seconds) a listener that resyncs right now must seek. */
  positionAt(now = Date.now()) {
    return Math.max(0, this.globalPosition(now));
  }

  /* ------------------------------------------------ host actions */
  /**
   * Host-only. Applies a patch atomically while keeping the clock
   * continuous: every write recalibrates `startedAt` so no listener
   * ever sees the timeline jump.
   */
  hostPatch(patch) {
    const now = Date.now();
    const s = { ...this.state };

    if (patch.currentTrackId !== undefined && patch.currentTrackId !== s.currentTrackId) {
      s.currentTrackId = patch.currentTrackId;
      s.currentSongIndex = Math.max(
        0,
        this.playlist.findIndex((t) => t.id === patch.currentTrackId)
      );
      s.videoId = this.playlist[s.currentSongIndex]?.videoId || patch.videoId || null;
      s.currentTimeOffset = 0;
      s.isPlaying = patch.isPlaying ?? true;
      s.startedAt = now;
      s.updatedBy = 'host';
      s.updatedAt = now;
      this.state = s;
      this.persist();
      this.broadcast();
      this.emit('global', this.state);
      return;
    }

    if (patch.songIndex !== undefined) {
      const t = this.playlist[patch.songIndex];
      if (t) {
        s.currentTrackId = t.id;
        s.currentSongIndex = patch.songIndex;
        s.videoId = t.videoId || null;
        s.currentTimeOffset = 0;
        s.isPlaying = patch.isPlaying ?? true;
        s.startedAt = now;
        s.updatedAt = now;
        this.state = s;
        this.persist();
        this.broadcast();
        this.emit('global', this.state);
      }
      return;
    }

    if (patch.videoId !== undefined && patch.videoId !== s.videoId) {
      // host put an arbitrary YouTube video on air (search pick, etc.)
      s.videoId = patch.videoId;
      s.currentTimeOffset = 0;
      s.isPlaying = patch.isPlaying ?? true;
      s.startedAt = now;
      s.updatedAt = now;
    }

    if (patch.isPlaying !== undefined && patch.isPlaying !== s.isPlaying) {
      const pos = s.isPlaying
        ? this.globalPosition(now)        // was playing -> freeze at current pos
        : s.currentTimeOffset;            // was paused  -> resume from frozen pos
      s.isPlaying = patch.isPlaying;
      s.currentTimeOffset = pos;
      s.startedAt = now;
      s.updatedAt = now;
    }

    if (patch.currentTimeOffset !== undefined) {
      s.currentTimeOffset = Math.max(0, patch.currentTimeOffset);
      s.startedAt = now;
      s.updatedAt = now;
    }

    if (patch.volume !== undefined) s.volume = patch.volume;

    this.state = s;
    this.persist();
    this.broadcast();
    this.emit('global', this.state);
  }

  broadcast() {
    if (this.bc) this.bc.postMessage({ type: 'state', state: this.state });
  }

  /** First visitor: claim host duties for the session. */
  get isHostClaimed() {
    return storage.get('ishq.host.claimed', false);
  }
  claimHost() {
    if (!storage.get('ishq.host.claimed', false)) storage.set('ishq.host.claimed', true);
  }

  /* ------------------------------------------------ listeners */
  startPresence() {
    const tick = () => {
      const now = Date.now();
      const map = storage.get(PRESENCE_KEY, {});
      map[this.tabId] = now;
      for (const k of Object.keys(map)) if (now - map[k] > CONFIG.sync.presenceTtlMs) delete map[k];
      storage.set(PRESENCE_KEY, map);
      this.emit('presence', this.countListeners());
    };
    tick();
    this.presenceTimer = setInterval(tick, CONFIG.sync.presenceTickMs);
  }

  countListeners() {
    const map = storage.get(PRESENCE_KEY, {});
    const now = Date.now();
    return Object.values(map).filter((t) => now - t < CONFIG.sync.presenceTtlMs).length || 1;
  }
}

export const syncEngine = new SyncEngine();