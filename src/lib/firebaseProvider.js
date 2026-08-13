/**
 * Firebase Realtime Database provider for the sync engine.
 * Enabled by setting CONFIG.firebase.enabled = true in src/lib/config.js
 * and running `npm i firebase`.
 *
 * Presence: each tab reports a heartbeat under ishq/presence/<tabId> with
 * onDisconnect() cleanup, giving a real listener count across devices.
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, onDisconnect } from 'firebase/database';
import { CONFIG, storage } from './config.js';

export function connect(engine, fb) {
  const app = initializeApp(fb.config);
  const db = getDatabase(app);
  const { paths } = CONFIG.firebase;

  const stateRef = ref(db, paths.state);
  const presenceRef = ref(db, `${paths.presence}/${engine.tabId}`);

  engine.firebaseDb = db;

  onValue(stateRef, (snap) => {
    const val = snap.val();
    if (val) {
      engine.state = { ...engine.state, ...val };
      engine.persist();
      engine.emit('global', engine.state);
    } else {
      // no global state yet on firebase — seed it as the host
      update(stateRef, engine.state);
    }
  });

  // presence heartbeat
  const heartbeat = () => {
    set(presenceRef, Date.now());
    onDisconnect(presenceRef).remove();
  };
  heartbeat();
  setInterval(heartbeat, CONFIG.sync.presenceTickMs);

  const countRef = ref(db, paths.presence);
  onValue(countRef, (snap) => {
    const v = snap.val();
    const n = v ? Object.keys(v).length : 1;
    engine.emit('presence', n);
  });

  // host writes go straight to the database
  const writeHost = (patch) => {
    const now = Date.now();
    update(stateRef, { ...patch, updatedBy: 'host', updatedAt: now });
    const pos = engine.globalPosition();
    storage.set('ishq.live.written', { pos, at: now });
  };
  engine.firebaseWriteHost = writeHost;
}