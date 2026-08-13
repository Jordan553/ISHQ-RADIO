/**
 * Audio engine — HTML5 <audio> wrapped in a small event library.
 *
 * - Resolves Google Drive references into stream URLs: same-origin `/drive`
 *   proxy first (immune to CORS/ORB), direct usercontent URL as fallback.
 * - Lazily unlocks WebAudio on the first user gesture (autoplay policy)
 *   and wires an AnalyserNode for the visualiser. If the stream is not
 *   CORS-clean (typical for Drive), `analyserOk` flips to false and the
 *   UI degrades to an ambient visual mode.
 */

import { proxiedStreamUrl, toStreamUrl } from './drive.js';

class AudioEngine {
  constructor() {
    this.audio = null;
    this.ctx = null;
    this.analyser = null;
    this.analyserData = null;
    this.analyserOk = false;

    this._handlers = {
      time: new Set(), duration: new Set(), play: new Set(),
      pause: new Set(), ended: new Set(), ready: new Set(),
      error: new Set(), loading: new Set(), unlock: new Set()
    };
    this._currentUrl = null;
    this._retries = 0;
    this._candidates = [];
    this._candidateIdx = 0;
    this._killed = false;   // stop() called — suppress load-error noise
  }

  init() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => this.emit('time', this.audio.currentTime));
    this.audio.addEventListener('durationchange', () => this.emit('duration', this.audio.duration));
    this.audio.addEventListener('play', () => this.emit('play'));
    this.audio.addEventListener('pause', () => this.emit('pause'));
    this.audio.addEventListener('ended', () => this.emit('ended'));
    this.audio.addEventListener('waiting', () => this.emit('loading', true));
    this.audio.addEventListener('playing', () => this.emit('loading', false));
    this.audio.addEventListener('error', () => this.onLoadError());
    this.audio.addEventListener('canplay', () => this.emit('ready'));

    this.setVolume(0.85);
    return this;
  }

  /**
   * Chromium's ORB blocks Google Drive streams outright (octet-stream +
   * no CORS). We therefore try candidate URLs in order — same-origin proxy
   * first, direct usercontent URL second — and only surface an error once
   * both fail.
   */
  onLoadError() {
    if (this._killed) { this._retries = 0; return; } // stopped on purpose — stay silent
    if (this._retries < 2 && this._candidateIdx < this._candidates.length - 1) {
      this._candidateIdx += 1;
      this._retries += 1;
      this._currentUrl = this._candidates[this._candidateIdx];
      this.audio.src = this._currentUrl;
      this.audio.load();
      return;
    }
    this._retries = 0;
    this.emit('error', this.audio.error);
  }

  on(name, fn) {
    this._handlers[name].add(fn);
    return () => this._handlers[name].delete(fn);
  }
  emit(name, ...args) {
    for (const fn of this._handlers[name]) fn(...args);
  }

  /** Must be called from a user gesture (click/tap) to unlock audio. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      const src = this.ctx.createMediaElementSource(this.audio);
      src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
      this.emit('unlock');
    } catch {
      /* analyser unavailable — ambient mode only */
    }
  }

  /** Fetch analyser levels; returns false when CORS blocks the data. */
  sample() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) sum += this.analyserData[i];
    const mean = sum / this.analyserData.length;
    if (!this.analyserOk && mean > 2) this.analyserOk = true;   // data flowing
    if (this.analyserOk && mean < 0.6) this.analyserOk = false; // stalled
    return { data: this.analyserData, ok: this.analyserOk, level: mean / 255 };
  }

  load(track) {
    this._killed = false;
    const direct = toStreamUrl(track.audioUrl ?? track.driveId);
    const proxied = proxiedStreamUrl(track.audioUrl ?? track.driveId);
    this._candidates = [];
    if (proxied) this._candidates.push(proxied);
    if (direct) this._candidates.push(direct);
    this._candidateIdx = 0;
    this._retries = 0;
    this._currentUrl = this._candidates[this._candidateIdx] ?? direct;
    const url = this._currentUrl;
    if (this.audio.src !== url) {
      this.audio.src = url;
      this.audio.load();
    }
  }

  stop() {
    this._killed = true;
    try { this.audio.pause(); } catch { /* not ready */ }
    try {
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch { /* not ready */ }
    this._retries = 0;
    this._candidateIdx = 0;
    this._candidates = [];
    this._currentUrl = null;
  }

  play() {
    return this.audio.play().catch(() => {});
  }
  /** Raw play promise (rejects when autoplay is blocked — lets UI show a gate). */
  playRaw() {
    return this.audio.play();
  }
  pause() {
    this.audio.pause();
  }
  seek(t) {
    if (!Number.isFinite(t) || t < 0) return;
    try { this.audio.currentTime = t; } catch { /* not ready yet */ }
  }
  get time() {
    return this.audio.currentTime || 0;
  }
  get duration() {
    const d = this.audio.duration;
    return Number.isFinite(d) ? d : 0;
  }
  get paused() {
    return this.audio.paused;
  }
  setVolume(v) {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }
}

export const audioEngine = new AudioEngine();