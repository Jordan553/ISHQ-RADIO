/**
 * YouTube IFrame Player API wrapper — the single music source for the radio.
 *
 * A hidden full-screen iframe player plays every track; the app's own UI
 * renders above it. Live-mode clients load videos at the exact server
 * timestamp (loadVideoById with startSeconds) and re-seek on drift, while
 * manual-mode playback uses the same player freely.
 *
 * The API script (https://www.youtube.com/iframe_api) is injected once,
 * lazily, the first time the player is mounted.
 */

const API_URL = 'https://www.youtube.com/iframe_api';

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

class YtPlayer {
  constructor() {
    this.player = null;
    this.ready = false;
    this.currentVideoId = null;
    this.currentStart = 0;
    this._pending = null;
    this._apiPromise = null;
    this._handlers = { ready: new Set(), state: new Set(), end: new Set(), error: new Set() };
  }

  on(type, fn) {
    this._handlers[type].add(fn);
    return () => this._handlers[type].delete(fn);
  }
  emit(type, ...args) {
    for (const fn of this._handlers[type]) fn(...args);
  }

  /** Inject the IFrame API bootstrap script once. */
  loadApi() {
    if (window.YT?.Player) return Promise.resolve(true);
    if (this._apiPromise) return this._apiPromise;
    this._apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(true);
      };
      const s = document.createElement('script');
      s.src = API_URL;
      s.async = true;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return this._apiPromise;
  }

  /** Create the hidden player in `container` (a DOM element). */
  async mount(container, onFail) {
    if (this.ready) return true;
    const ok = await this.loadApi();
    if (!ok || !window.YT?.Player) {
      onFail?.();
      return false;
    }
    this.player = new YT.Player(container, {
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          this.ready = true;
          if (this._pending) {
            const p = this._pending;
            this._pending = null;
            this.loadVideo(p.videoId, p.startSeconds);
          }
          this.emit('ready');
        },
        onStateChange: (e) => {
          if (e.data === YT_STATE.ENDED) this.emit('end');
          this.emit('state', e.data);
        },
        onError: (e) => this.emit('error', e.data)
      }
    });
    return true;
  }

  /**
   * Load a video; when the player isn't ready yet the load is queued and
   * applied onReady. `startSeconds` positions the stream for live sync.
   */
  loadVideo(videoId, startSeconds = 0) {
    this.currentVideoId = videoId;
    this.currentStart = Math.max(0, Math.floor(startSeconds) || 0);
    if (!this.ready || !this.player?.loadVideoById) {
      this._pending = { videoId, startSeconds: this.currentStart };
      return;
    }
    this.player.loadVideoById({
      videoId,
      startSeconds: this.currentStart,
      suggestedQuality: 'default'
    });
  }

  /** Re-position (drift correction / back-to-live resync). */
  seek(t) {
    if (this.ready) this.player.seekTo(Math.max(0, t), true);
  }

  play() {
    if (this.ready) this.player.playVideo?.();
  }
  pause() {
    if (this.ready) this.player.pauseVideo?.();
  }
  stop() {
    if (this.ready) this.player.stopVideo?.();
  }
  /** Mute — used for visuals-only playback (local MP3 keeps the audio). */
  mute() {
    if (this.ready) this.player.mute?.();
  }

  time() {
    return this.ready ? this.player.getCurrentTime?.() || 0 : 0;
  }
  duration() {
    const d = this.ready ? this.player.getDuration?.() : 0;
    return Number.isFinite(d) && d > 0 ? d : 0;
  }
  state() {
    return this.ready ? this.player.getPlayerState?.() ?? -1 : -1;
  }
  isPlaying() {
    return this.state() === YT_STATE.PLAYING || this.state() === YT_STATE.BUFFERING;
  }
  setVolume(v) {
    if (this.ready) {
      this.player.unMute?.();
      this.player.setVolume?.(Math.round(Math.min(1, Math.max(0, v)) * 100));
    }
  }
}

export const ytPlayer = new YtPlayer();