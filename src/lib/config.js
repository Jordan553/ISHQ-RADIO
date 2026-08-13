/**
 * ISHQ RADIO — global configuration.
 * Edit this file to point the app at your own Google Drive / Firebase setup.
 */

export const CONFIG = {
  appName: 'ISHQ RADIO',
  tagline: 'Live Together. Feel the Love.',

  /** Publicly shared Google Drive folder that holds the songs. */
  driveFolderId: '1W1EvARtm0fED7VG3MzBRBTSPMo1aRCeV',

  /** Passcode the host must enter to unlock global broadcast controls. */
  hostPasscode: 'ishq',

  /**
   * Firebase Realtime Database — for true cross-device live sync.
   * NOTE: replace the placeholder values below with your project's config
   * (Firebase Console > Project settings). Until then the provider fails
   * cleanly and the app falls back to BroadcastChannel + localStorage
   * (instant sync across tabs on the same machine).
   */
  firebase: {
    enabled: true,
    config: {
      apiKey: 'YOUR_API_KEY',
      authDomain: 'YOUR_PROJECT.firebaseapp.com',
      databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
      projectId: 'YOUR_PROJECT',
      storageBucket: 'YOUR_PROJECT.appspot.com',
      messagingSenderId: '1234567890',
      appId: 'YOUR_APP_ID'
    },
    paths: {
      state: 'ishq/liveState',
      presence: 'ishq/presence',
      reactions: 'ishq/reactions',
      dedications: 'ishq/dedications'
    }
  },

  /** Sanity limits for the sync engine. */
  sync: {
    driftThresholdSec: 1.5, // hard-resync when clock drifts beyond this
    driftCheckEveryMs: 8000,
    presenceTtlMs: 35000,
    presenceTickMs: 10000
  },

  /** Time (ms) of local manual playback before a nudge reminder appears. */
  manualNudgeMs: 90000
};

/** Simple localStorage helper that never throws. */
export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};