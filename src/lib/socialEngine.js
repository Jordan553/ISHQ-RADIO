/**
 * Social engine — heart reactions, Dil Ki Line dedications and the
 * "Listening Now" activity feed.
 *
 * Same provider pattern as the sync engine:
 *  - "firebase"  : Realtime Database (ishq/reactions, ishq/dedications).
 *                  Works with placeholder creds; if the app can't reach
 *                  Firebase it silently falls back to:
 *  - "broadcast" : BroadcastChannel + localStorage — instant across tabs
 *                  on the same machine.
 *
 * All writes are best-effort; the UI stays instant and optimistic.
 */

import { CONFIG, storage, resolveFirebaseConfig } from './config.js';

const BC_NAME = 'ishq-social-v1';
const LOCAL_KEY = 'ishq.social.v1';

const NAMES = ['Riya', 'Aman', 'Zara', 'Meera', 'Kabir', 'Sana', 'Vivaan', 'Aisha', 'Rohan', 'Ananya', 'Kush', 'Priya', 'Dev', 'Ira', 'Arjun', 'Noor'];
const CITIES = ['Delhi', 'Mumbai', 'Jaipur', 'Lucknow', 'Kolkata', 'Pune', 'Hyderabad', 'Chandigarh', 'Kochi', 'Indore', 'Bhopal'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class SocialEngine {
  constructor() {
    this.tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    this.displayName = pick(NAMES);
    this.city = pick(CITIES);
    this.provider = 'broadcast';
    this.bc = null;
    this.handlers = {};
    this._lastActivityAt = 0;
  }

  on(type, fn) {
    (this.handlers[type] ||= new Set()).add(fn);
    return () => this.handlers[type]?.delete(fn);
  }
  emit(type, payload) {
    for (const fn of this.handlers[type] || []) fn(payload);
  }

  init() {
    this.teardown();
    if (resolveFirebaseConfig()) this.connectFirebase();
    this.connectBroadcast(); // always keep tab-level sync
    this.emit('activity', {
      id: this.tabId + '-here',
      text: `${this.displayName} from ${this.city} joined the lounge`,
      kind: 'join', at: Date.now()
    });
  }

  async connectFirebase() {
    try {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getDatabase, ref, push, onChildAdded, onDisconnect } = await import('firebase/database');
      const app = getApps().length ? getApp() : initializeApp(resolveFirebaseConfig());
      const db = getDatabase(app);
      const { paths } = CONFIG.firebase;
      if (!paths.reactions || !paths.dedications) throw new Error('social paths not configured');

      const reactionsRef = ref(db, paths.reactions);
      onChildAdded(reactionsRef, (snap) => {
        const v = snap.val();
        if (v && v.id && v.id !== this.tabId) this.emit('reaction', v);
      });
      const dedicationsRef = ref(db, paths.dedications);
      onChildAdded(dedicationsRef, (snap) => {
        const v = snap.val();
        if (v && v.id && v.id !== this.tabId) this.emit('dedication', v);
      });

      const presenceRef = ref(db, `${paths.presence}/${this.tabId}`);
      push(reactionsRef, null); // prove connectivity (no-op write)
      onDisconnect(presenceRef).remove();
      presenceRef.off?.();

      this.provider = 'firebase';
      this.db = db;
      this.reactionsRef = reactionsRef;
      this.dedicationsRef = dedicationsRef;
    } catch {
      this.provider = 'broadcast'; // placeholder creds / offline — tabs still sync
    }
  }

  connectBroadcast() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(BC_NAME);
      this.bc.onmessage = (e) => {
        const d = e.data;
        if (!d?.type) return;
        if (d.type === 'reaction') this.emit('reaction', d.payload);
        if (d.type === 'dedication') this.emit('dedication', d.payload);
        if (d.type === 'activity') this.emit('activity', d.payload);
      };
    }
    this.onStorage = (e) => {
      if (e.key === LOCAL_KEY && e.newValue) {
        try {
          for (const item of JSON.parse(e.newValue)) {
            if (item.type === 'reaction') this.emit('reaction', item.payload);
            if (item.type === 'dedication') this.emit('dedication', item.payload);
          }
        } catch { /* noop */ }
      }
    };
    window.addEventListener('storage', this.onStorage);
  }

  teardown() {
    this.bc?.close();
    this.bc = null;
    window.removeEventListener?.('storage', this.onStorage);
  }

  /** Persist locally too (keeps cross-tab history after refresh). */
  _storeLocal(items) {
    const prev = storage.get(LOCAL_KEY, []) || [];
    storage.set(LOCAL_KEY, [...items, ...prev].slice(0, 30));
  }

  sendReaction(emoji) {
    const payload = {
      id: this.tabId,
      emoji,
      name: this.displayName,
      city: this.city,
      at: Date.now()
    };
    // optimistic local echo + cross-tab echo
    this.emit('reaction', payload);
    this._fwd('reaction', payload);
    this._storeLocal([{ type: 'reaction', payload }]);
    if (this.provider === 'firebase' && this.reactionsRef) {
      try { push(this.reactionsRef, payload); } catch { /* offline */ }
    }
  }

  sendDedication(text, trackId = '') {
    const clean = String(text).trim().slice(0, 140);
    if (!clean) return;
    const payload = { id: this.tabId, text: clean, at: Date.now(), trackId };
    this.emit('dedication', payload);
    this._fwd('dedication', payload);
    this._storeLocal([{ type: 'dedication', payload }]);
    if (this.provider === 'firebase' && this.dedicationsRef) {
      try { push(this.dedicationsRef, payload); } catch { /* offline */ }
    }
  }

  /** Throttled ambient feed entry, e.g. "{n} people joined just now". */
  makeActivity(text, kind = 'join') {
    const now = Date.now();
    if (now - this._lastActivityAt < 4000) return;
    this._lastActivityAt = now;
    const payload = { id: `${this.tabId}-${now}`, text, kind, at: now };
    this.emit('activity', payload);
    this._fwd('activity', payload);
  }

  _fwd(type, payload) {
    this.bc?.postMessage({ type, payload });
  }
}

export const socialEngine = new SocialEngine();