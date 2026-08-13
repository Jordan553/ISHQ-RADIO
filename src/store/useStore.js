/**
 * Global store — the React face of the sync + audio engines.
 * Keeps UI state (mode, panels, modals) and mirrors the global live state.
 */

import { create } from 'zustand';
import { syncEngine } from '../lib/syncEngine.js';
import { audioEngine } from '../lib/audioEngine.js';
import { ytPlayer } from '../lib/ytPlayer.js';
import { socialEngine } from '../lib/socialEngine.js';
import { parseLrc } from '../lib/lrcParser.js';
import { LYRICS } from '../lib/lyrics.js';
import { CONFIG, storage } from '../lib/config.js';
import { toStreamUrl } from '../lib/drive.js';
import { moodById } from '../lib/moods.js';

export const useStore = create((set, get) => ({
  playlist: [],
  tracksMeta: {},       // trackId -> { lrc: {lines, meta} }
  onlineResults: [],    // online search hits (YouTube)
  onlinePlaylist: [],   // session list of played online tracks
  onlineNow: null,      // online track currently playing (or null)
  onlineIdx: -1,
  mood: null,           // active mood id (love|breakup|…|jordan-core)
  moodReady: false,     // mood queue fetched & playable
  moodBusy: false,      // a mood/suggestion fetch is in flight
  playedOnlineIds: [],  // videoIds played this session (radio memory)
  social: {
    reactions: [],      // recent floating reaction bubbles
    dedications: [],    // Dil Ki Line feed
    activity: []        // Listening Now feed
  },
  midnight: false,      // 11pm–5am dreamy theme active
  ready: false,
  loadingTrack: false,
  trackError: null,
  ytReady: false,        // hidden YouTube iframe player mounted & usable
  ytFailedVideoId: null, // video that errored — skip YT until the track changes
  pendingDriveId: null,  // user clicked an un-enriched drive track — play it as soon as metadata lands
  _enrichFailed: [],    // drive files with no online mirror (never retried forever)
  _activeTrackId: null, // the ONE track on air — guards against double playback
  _syncing: false,       // drive sync poll in flight
  _enriching: false,     // metadata enrichment workers running

  /* ------------------------------ mirror of the global live state */
  live: null,
  listeners: 1,

  /* ------------------------------ local playback mode */
  inLive: true,
  manualReason: null,
  currentTime: 0,
  duration: 0,
  audioPlaying: false,
  volume: storage.get('ishq.volume', 0.85),

  /* ------------------------------ prefs & ui */
  isShuffle: storage.get('ishq.shuffle', false),
  isRepeat: storage.get('ishq.repeat', false),
  isAdmin: storage.get('ishq.admin', false),
  theaterOpen: false,
  party: false,
  settingsOpen: false,
  railTab: 'lyrics',
  drawerOpen: false,
  toasts: [],
  autoScroll: true,
  netStatus: 'synced',

  /* ------------------------------ saloon ui */
  searchQuery: '',
  view: 'home',                 // home | explore | radio | liked | history
  likedIds: storage.get('ishq.liked', []),
  recentIds: [],
  bgTheme: storage.get('ishq.bgTheme', 'romantic'),   // romantic | cinema
  dark: storage.get('ishq.dark', true),

  /* ================================================================ boot */
  async bootstrap() {
    if (booted) return;   // StrictMode dev double-invocation guard
    booted = true;

    let playlist = [];
    let driveOk = false;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}drive/playlist`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.results?.length) { playlist = json.results; driveOk = true; }
    } catch { /* fall through */ }
    if (!playlist.length) {
      set({ trackError: 'Your Drive folder is empty or unreachable - upload songs to your Google Drive folder, then refresh the page.' });
      return;
    }

    const tracksMeta = {};
    for (const t of playlist) {
      const lrcText = LYRICS[t.id] || t.lyrics || null;
      tracksMeta[t.id] = { lrc: lrcText ? parseLrc(lrcText) : null, status: lrcText ? 'ok' : 'pending' };
      if (t.lyricsUrl) {
        fetchLyrics(t.lyricsUrl, (text) => {
          useStore.setState((s) => ({
            tracksMeta: { ...s.tracksMeta, [t.id]: { lrc: parseLrc(text) } }
          }));
        });
      }
    }

    audioEngine.init();
    const live = syncEngine.init(playlist);
    set({ playlist, onlinePlaylist: playlist, tracksMeta, live, recentIds: storage.get('ishq.recent', []), ready: true });

    if (driveOk) {
      get().enrichJordanTracks();
      get().syncDrive(false);
      if (driveSyncTimer) clearInterval(driveSyncTimer);
      const poll = () => { if (document.visibilityState === 'visible' && !get()._syncing) get().syncDrive(false); };
      document.addEventListener('visibilitychange', poll);
      driveSyncTimer = setInterval(poll, 60_000);
    }

    // event wiring
    syncEngine.on('global', (st) => {
      const s = get();
      set({ live: { ...st } });
      if (s.inLive) applyLiveState(st);
    });
    syncEngine.on('presence', (n) => {
      const prev = useStore.getState().listeners;
      set({ listeners: n });
      if (prev > 0 && n > prev) {
        socialEngine.makeActivity(`${n - prev} ${n - prev === 1 ? 'person' : 'people'} joined just now`, 'join');
      }
    });
    syncEngine.on('manual', ({ reason }) => set({ inLive: false, manualReason: reason }));

    audioEngine.on('time', (t) => set({ currentTime: t }));
    audioEngine.on('duration', (d) => set({ duration: d }));
    audioEngine.on('play', () => set({ audioPlaying: true }));
    audioEngine.on('pause', () => set({ audioPlaying: false }));
    audioEngine.on('loading', (l) => set({ loadingTrack: l }));
    audioEngine.on('ready', () => set({ loadingTrack: false }));
    audioEngine.on('error', () => {
      set({ loadingTrack: false });
      pushToast('Track stream failed — check the file has public view access', 'warn');
    });
    audioEngine.on('ended', () => get().onTrackEnded());

    // social engine — reactions / Dil Ki Line / listening feed
    socialEngine.init();
    socialEngine.on('reaction', (r) => {
      pushReaction(r);
      pushActivity(`${r.name} from ${r.city} reacted ${r.emoji}`, 'react');
    });
    socialEngine.on('dedication', (d) => {
      pushDedication(d);
      pushActivity(`"${d.text.slice(0, 30)}${d.text.length > 30 ? '…' : ''}" — ${d.name}`, 'dedication');
    });
    socialEngine.on('activity', (a) => pushActivity(a.text, a.kind));

    get().checkMidnight();

    // join the live timeline
    set({ inLive: true, manualReason: null });
    applyLiveState(syncEngine.state, true);
  },

  /** Called when the current track's audio naturally finishes (audio engine). */
  onTrackEnded() {
    const s = get();
    if (s.onlineNow) {
      const next = s.onlineIdx + 1;
      if (next < s.onlinePlaylist.length) s.playOnlineAt(next);
      else s.autoSuggestNext(); // never-ending radio — find the next vibe
      return;
    }
    if (!s.inLive) { s.localNext(); return; }
    // Live mode: radio should advance. If nobody advanced within 4s,
    // this client keeps the station breathing by advancing globally.
    setTimeout(() => {
      const st = get();
      if (!st.inLive) return;
      const still = st.live?.currentTrackId === s.live?.currentTrackId;
      if (still && st.live?.isPlaying) {
        let next = (st.live.currentSongIndex + 1) % st.playlist.length;
        let guard = 0;
        while (guard++ < st.playlist.length && st.playlist[next]?.driveId && !st.playlist[next]?.videoId) {
          next = (next + 1) % st.playlist.length; // skip drive tracks still getting metadata
        }
        syncEngine.hostPatch({ songIndex: next });
        pushToast('Radio auto-advanced to the next song', 'info');
      }
    }, 4000);
  },

  /** YouTube player finished the current video (only trust real completions). */
  onYtEnded() {
    const d = ytPlayer.duration();
    if (d && ytPlayer.time() < d - 1.2) return; // spurious ENDED during loadVideoById
    this.onTrackEnded();
  },

  /** YouTube embed failed — fall back to the yt-dlp relay for manual audio. */
  onYtError(code) {
    const s = get();
    const vid = ytPlayer.currentVideoId;
    if (!vid || s.ytFailedVideoId === vid) return;
    set({ ytFailedVideoId: vid, loadingTrack: false });
    const online = s.onlineNow;
    if (online && online.videoId === vid && online.audioUrl) {
      playTrack(online, 0, true);
      pushToast('YouTube embed blocked this video — streamed via relay instead', 'warn');
    } else {
      pushToast(`YouTube couldn't play this video (${code})`, 'warn');
    }
  },

  /**
   * Boot the hidden YouTube player (called once by <YouTubeFrame/>).
   * Wires player events into the store and starts the 250ms clock that
   * feeds currentTime/duration for lyrics + progress.
   */
  initYt(containerEl) {
    if (ytStarted) return;
    ytStarted = true;
    ytPlayer.mount(containerEl, () => {
      pushToast('YouTube player unavailable — using MP3 streams', 'warn');
    });
    ytPlayer.on('ready', () => {
      set({ ytReady: true, loadingTrack: false });
      startYtClock();
      // late joiner: apply the live position as soon as the player exists
      const { inLive, live } = get();
      if (inLive && live) applyLiveState(live, true);
    });
    ytPlayer.on('state', (st) => {
      set({ audioPlaying: st === 1 });
      if (st === 1) set({ loadingTrack: false });
    });
    ytPlayer.on('end', () => get().onYtEnded());
    ytPlayer.on('error', (code) => get().onYtError(code));
  },

  /* ================================================================ moods & never-ending radio */

  /**
   * Switch the vibe. Online moods stream from YouTube via the normal
   * search flow; jordan-core loads the dedicated Drive collection.
   * Current player keeps working — the queue is replaced underneath it.
   */
  async playMood(id) {
    const mood = moodById(id);
    if (!mood || get().moodBusy) return;
    const s = get();
    if (s.inLive) s.markManual(`you drifted into the ${mood.label} mood`);
    set({ mood: id, moodReady: false, moodBusy: true, onlineNow: null, onlineIdx: -1 });
    try {
      if (mood.drive) {
        let lib = get().playlist;
        if (!lib.length) {
          await get().syncDrive(true);
          lib = get().playlist;
        }
        if (!lib.length) {
          pushToast('Jordan Core - your Drive folder is empty. Upload songs to it first', 'warn');
          set({ mood: null, moodReady: false });
          return;
        }
        const n = lib.length;
        set({ onlinePlaylist: lib, moodReady: true });
        pushToast(`Jordan Core - ${n} ${n === 1 ? 'song' : 'songs'} from your Drive`, 'live');
        get().playOnlineAt(0);
        get().syncDrive(true);
        return;
      }
      const res = await fetch(`/search-online?q=${encodeURIComponent(mood.query)}`);
      const { results } = await res.json().catch(() => ({}));
      const tracks = (results || []).map(hitToTrack);
      if (!tracks.length) {
        pushToast('No songs found for this mood — try another', 'warn');
        set({ mood: null, moodReady: false });
        return;
      }
      set({ onlinePlaylist: tracks, moodReady: true });
      pushToast(`${mood.label} mood — let the night feel it`, 'live');
      get().playOnlineAt(0);
    } catch {
      set({ mood: null, moodReady: false });
      pushToast('Mood radio unavailable right now — check the connection', 'warn');
    } finally {
      set({ moodBusy: false });
    }
  },

  toggleParty() { set({ party: !get().party }); },

  /**
   * Drive sync — the app's whole music library comes from your Drive
   * folder. CEAP polling every 60s via ?check=1 (server returns just a
   * hash of the listing); when the hash changes the full list is
   * re-fetched and merged without touching what's playing. New uploads
   * appear automatically. force=true always re-fetches the full list.
   */
  async syncDrive(force = false) {
    const s = get();
    if (s._syncing) { if (!force) return; }
    set({ _syncing: true });
    try {
      const res = await fetch(`/drive/playlist${force ? '?fresh=1' : '?check=1'}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        if (force || !get().playlist.length) pushToast(`Drive sync failed: ${data?.error || 'server unreachable'}`, 'warn');
        return;
      }
      if (!force && data.check) {
        if (data.hash === driveHashLast) return; // nothing changed — stay quiet
        driveHashLast = data.hash;
        await get().syncDrive(true);
        return;
      }
      const results = data.results || [];
      const st = useStore.getState();
      const prev = new Map(st.playlist.map((t) => [t.id, t]));
      const merged = results.map((t) => ({ ...(prev.get(t.id) || {}), ...t }));
      driveHashLast = data.hash || driveHashLast;
      const added = merged.length - st.playlist.length;
      const patch = { playlist: merged, onlinePlaylist: merged, _syncing: false };
      if (st.onlineNow) {
        const keep = merged.find((t) => t.id === st.onlineNow.id);
        if (keep) patch.onlineNow = keep;
      }
      set(patch);
      if (added > 0) pushToast(`${added} new ${added === 1 ? 'song' : 'songs'} synced from your Drive`, 'live');
      if (get().onlineNow?.videoId) playTrack(get().onlineNow);
      get().enrichJordanTracks();
    } catch {
      if (force || !get().playlist.length) pushToast('Drive sync failed - check the server', 'warn');
    } finally {
      set({ _syncing: false });
    }
  },

  refreshJordan() { return get().syncDrive(true); },

  /**
   * Drive enrichment — auto-fetch real metadata (title, artist, videoId,
   * HD art) for every Drive file from the internet (YouTube match +
   * iTunes fallback), background, 3 at a time. Tracks that gain a videoId
   * become playable (YouTube) immediately; a track the user clicked
   * (pendingDriveId) is rushed to the front of the queue.
   */
  async enrichJordanTracks() {
    const s = get();
    if (s._enriching) return;
    const failed = new Set(s._enrichFailed || []);
    let needs = (s.playlist || []).filter((t) => t.driveId && !t.videoId && !failed.has(t.id));
    if (!needs.length) return;
    if (s.pendingDriveId) {
      const pi = needs.findIndex((t) => t.id === s.pendingDriveId);
      if (pi > 0) needs = [needs[pi], ...needs.slice(0, pi), ...needs.slice(pi + 1)];
    }
    needs = needs.slice(0, 90);
    set({ _enriching: true });
    const CONC = 3;
    let next = 0;
    const worker = async () => {
      while (true) {
        const idx = next++;
        const track = needs[idx];
        if (!track) return;
        try {
          const res = await fetch(`/jordan/enrich?q=${encodeURIComponent(track.title)}`, {
            signal: AbortSignal.timeout(25000)
          });
          const { results } = await res.json().catch(() => ({}));
          const st = useStore.getState();
          if (!results?.enriched || !results.videoId) {
            // no online mirror — remember, and fall back to the Drive file if needed
            const f = new Set(st._enrichFailed || []);
            let target;
            if (f.has(track.id)) {
              if (st.pendingDriveId === track.id) target = 'pending';
              else if (st.onlineNow?.id === track.id) target = 'onair';
              if (target) {
                set({ pendingDriveId: null });
                pushToast('No online mirror found — playing the Drive file directly', 'info');
                playTrack(track, 0, true);
              }
            } else {
              f.add(track.id);
              set({ _enrichFailed: [...f], _enriching: st._enriching });
            }
            continue;
          }
          const patch = (tr) => ({
            ...tr,
            title: results.title || tr.title,
            artist: results.artist || tr.artist,
            videoId: results.videoId || tr.videoId,
            thumbHd: results.thumbHd || results.thumb || tr.thumbHd || '',
            coverUrl: results.thumb || results.art || tr.coverUrl,
            duration: results.duration || tr.duration
          });
          const stNow = useStore.getState();
          const list = stNow.playlist.map((t) => (t.id === track.id ? patch(t) : t));
          const olist = stNow.onlinePlaylist?.map((t) => (t.id === track.id ? patch(t) : t)) || list;
          const now = stNow.onlineNow?.id === track.id ? patch(stNow.onlineNow) : stNow.onlineNow;
          set({ playlist: list, onlinePlaylist: olist, onlineNow: now, _enriching: stNow._enriching });
          const cur = useStore.getState();
          if (results.videoId && cur.pendingDriveId === track.id) {
            const oi = cur.onlinePlaylist?.findIndex((t) => t.id === track.id) ?? -1;
            if (oi !== -1) {
              set({ pendingDriveId: null });
              pushToast(`"${cur.onlinePlaylist[oi].title}" is ready - playing it now`, 'live');
              cur.playOnlineAt(oi);
              continue;
            }
          }
          if (cur.onlineNow?.id === track.id && results.videoId
              && cur.ytFailedVideoId !== results.videoId) {
            playTrack(cur.onlineNow);
          }
        } catch { /* enrich failed — keep raw Drive entry */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, needs.length) }, worker));
    const left = useStore.getState().playlist.filter((t) => t.driveId && !t.videoId);
    set({ _enriching: false });
    if (left.length) setTimeout(() => get().enrichJordanTracks(), 1500); // keep churning in the background
  },

  /**
   * The never-ending loop: when the online queue runs dry, search again
   * (mood query, or the current song's artist+title), skip everything
   * already played, append fresh picks, keep playing. No repeats, no end.
   */
  async autoSuggestNext() {
    const s = get();
    if (!s.onlineNow || s.moodBusy) return;
    const mood = moodById(s.mood);
    if (mood?.drive) {
      if (s.onlineIdx + 1 < s.onlinePlaylist.length) return s.playOnlineAt(s.onlineIdx + 1);
      pushToast('Jordan Core — end of the collection. Pick a mood to keep it going', 'info');
      return;
    }
    // radio-style suggestions: all-artist when no mood, so a searched song
    // never primes another cover/remix of the same title
    const base = mood?.query || (s.onlineNow ? (s.onlineNow.artist?.trim() || s.onlineNow.title) : '');
    if (!base) return;
    set({ moodBusy: true });
    try {
      const res = await fetch(`/search-online?q=${encodeURIComponent(String(base).slice(0, 100))}`);
      const { results } = await res.json().catch(() => ({}));
      const seen = new Set(get().playedOnlineIds);
      const curTitle = (s.onlineNow?.title || '').toLowerCase().trim();
      const fresh = (results || [])
        .filter((h) => h.videoId && !seen.has(h.videoId))
        .filter((h) => !(curTitle.length > 3 && (h.title || '').toLowerCase().includes(curTitle)))
        .slice(0, 6);
      if (!fresh.length) {
        pushToast('Suggestion well ran dry — replaying your night', 'info');
        set({ moodBusy: false });
        return;
      }
      const tracks = fresh.map(hitToTrack);
      const list = [...get().onlinePlaylist, ...tracks];
      set({ onlinePlaylist: list });
      get().playOnlineAt(get().onlineIdx + 1);
    } catch {
      set({ moodBusy: false });
    }
  },

  /* ================================================================ social */
  sendReaction(emoji) {
    socialEngine.sendReaction(emoji);
  },

  sendDedication(text) {
    const s = get();
    const trackId = s.onlineNow?.id || s.playlist[s.live?.currentSongIndex]?.id || '';
    socialEngine.sendDedication(text, trackId);
  },

  checkMidnight() {
    const h = new Date().getHours();
    const m = h >= 23 || h < 5;
    if (m !== get().midnight) set({ midnight: m });
  },

  /** Periodic drift correction while in live mode. */
  driftCheck() {
    const s = get();
    if (!s.inLive || !s.live?.isPlaying || !s.ytReady) return;
    if (s.ytFailedVideoId && s.ytFailedVideoId === ytPlayer.currentVideoId) return;
    if (!ytPlayer.isPlaying()) { ytPlayer.play(); return; }
    const target = syncEngine.positionAt();
    const gap = Math.abs(ytPlayer.time() - target);
    if (gap > CONFIG.sync.driftThresholdSec) {
      ytPlayer.seek(target);
      set({ currentTime: target });
      useStore.setState((st) => ({ netStatus: gap > 3 ? 'resyncing' : 'synced' }));
    }
  },

  /** Enter the lounge (join gate action): snap to live at the exact position. */
  joinLive() {
    useStore.setState({ joinNeeded: false, onlineNow: null, onlineIdx: -1, mood: null, moodReady: false });
    const { live } = useStore.getState();
    if (live) applyLiveState(live, true);
    set({ inLive: true, manualReason: null, currentTime: nowTime() });
  },

  /* ------------------------------ live sync */
  backToLive() {
    const { live } = get();
    if (!live) { set({ inLive: true, manualReason: null, mood: null, moodReady: false }); return; }
    applyLiveState(live, true);
    set({ inLive: true, manualReason: null, onlineNow: null, onlineIdx: -1, mood: null, moodReady: false, currentTime: nowTime() });
    pushToast('Back to Live — you are synced with everyone', 'live');
  },

  markManual(reason) {
    set({ inLive: false, manualReason: reason });
  },

  /* ================================================================ local controls (manual mode) */
  toggleLocalPlay() {
    const s = get();
    if (s.inLive) s.markManual('you took the controls');
    if (s.ytReady && ytPlayer.currentVideoId) {
      if (ytPlayer.isPlaying()) ytPlayer.pause();
      else ytPlayer.play();
      return;
    }
    if (audioEngine.paused) audioEngine.play();
    else audioEngine.pause();
  },

  localSeek(t) {
    const s = get();
    if (s.inLive) s.markManual('you moved the timeline');
    if (s.ytReady && ytPlayer.currentVideoId) {
      ytPlayer.seek(t);
      set({ currentTime: t });
      return;
    }
    audioEngine.seek(t);
    set({ currentTime: t });
  },

  localNext() {
    const s = get();
    if (s.onlineNow) {
      const n = s.onlinePlaylist.length;
      if (!n) return;
      if (s.onlineIdx + 1 < n) { s.playOnlineAt(s.onlineIdx + 1); return; }
      s.autoSuggestNext(); // end of the queue — pull a fresh batch of the same vibe
      return;
    }
    const n = s.playlist.length;
    if (!n) return;
    if (s.inLive) s.markManual('you skipped ahead');
    playIndexAt(get(), s.live ? (s.live.currentSongIndex + 1) % n : 0);
  },

  /* ================================================================ online search & play (YouTube) */
  async searchOnline(q) {
    const s = get();
    if (!q || !q.trim()) { set({ onlineResults: [] }); return; }
    if (s._onlineAbort) s._onlineAbort.abort();
    const ac = new AbortController();
    s._onlineAbort = ac;
    try {
      const res = await fetch(`/search-online?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      if (!res.ok) { if (get()._onlineAbort === ac) set({ onlineResults: [] }); return; }
      const { results } = await res.json();
      if (get()._onlineAbort === ac) set({ onlineResults: results || [] });
    } catch { /* offline / backend missing — local search only */ }
  },

  playOnlineAt(idx) {
    const s = get();
    const list = s.onlinePlaylist;
    let t = list[idx];
    if (!t) return;
    if (t.driveId && !t.videoId) {
      let p = idx;
      while (p < list.length && list[p].driveId && !list[p].videoId) p++;
      if (p < list.length) {
        t = list[p];
        idx = p;
        pushToast('Some songs are still getting metadata - playing the next ready one', 'info');
      } else {
        set({ pendingDriveId: t.id });
        get().enrichJordanTracks();
        const ready = list.findIndex((x) => x.videoId);
        if (ready > -1) {
          const an = list[ready];
          set({ onlineNow: an, onlineIdx: ready, currentTime: 0, duration: an.duration || 0, loadingTrack: true });
          playTrack(an);
          pushToast('Playing the first ready song - "getting metadata" picks will jump in', 'info');
        } else {
          pushToast('Songs are still getting metadata - they will auto-play in a moment', 'info');
        }
        return;
      }
    }
    const played = t.videoId
      ? [...s.playedOnlineIds.slice(-39), t.videoId]
      : s.playedOnlineIds;
    set({ onlineNow: t, onlineIdx: idx, currentTime: 0, duration: t.duration || 0, loadingTrack: true, playedOnlineIds: played });
    playTrack(t);
    // warm the next online track's resolved stream URL so it starts instantly
    const nxt = list[idx + 1];
    if (nxt?.videoId) fetch(`/stream-online?id=${nxt.videoId}`, { method: 'HEAD' }).catch(() => {});
  },

  /** Play a search hit — full song streamed from YouTube. */
  playOnline(hit) {
    const s = get();
    if (!hit?.videoId) return;
    const track = hitToTrack(hit);
    let list = s.onlinePlaylist;
    let idx = list.findIndex((t) => t.id === track.id);
    if (idx === -1) { list = [...list, track]; idx = list.length - 1; }
    if (s.inLive) s.markManual('you went online');
    set({ onlinePlaylist: list, mood: null, moodReady: false });
    s.playOnlineAt(idx);
    get().fetchSuggestions(track); // auto same-genre queue — Next keeps the vibe going
  },

  /** Load same-genre suggestions for an online track and queue them after it. */
  async fetchSuggestions(track, replace = true) {
    const s = get();
    // radio-style suggestions: search by ARTIST only, so Next gives other
    // songs by that artist — not another cover/remix of the same title
    const base = track?.artist?.trim() || track?.title;
    if (!base) return;
    try {
      const res = await fetch(`/search-online?q=${encodeURIComponent(String(base).slice(0, 100))}`);
      if (!res.ok) return;
      const { results } = await res.json().catch(() => ({}));
      const seen = new Set(get().playedOnlineIds);
      if (track?.videoId) seen.add(track.videoId);
      const curTitle = (track?.title || '').toLowerCase().trim();
      const fresh = (results || [])
        .filter((h) => h.videoId && !seen.has(h.videoId))
        .filter((h) => !(curTitle.length > 3 && (h.title || '').toLowerCase().includes(curTitle)))
        .slice(0, 10);
      if (!fresh.length) return;
      const tracks = fresh.map(hitToTrack);
      if (replace) {
        const list = [track, ...tracks];
        set({ onlinePlaylist: list, onlineIdx: 0 });
      } else {
        set({ onlinePlaylist: [...get().onlinePlaylist, ...tracks] });
      }
    } catch { /* suggestions are best-effort — playback is not interrupted */ }
  },

  /** Leave an online session and return to the shared radio. */
  exitOnline() {
    const s = get();
    set({ onlineNow: null, onlineIdx: -1 });
    if (!s.inLive && s.live) s.backToLive();
  },

  localPrev() {
    const s = get();
    if (s.onlineNow) {
      const n = s.onlinePlaylist.length;
      if (!n) return;
      s.playOnlineAt((s.onlineIdx - 1 + n) % n);
      return;
    }
    const n = s.playlist.length;
    if (!n) return;
    if (s.inLive) s.markManual('you went back');
    playIndexAt(get(), s.live ? (s.live.currentSongIndex - 1 + n) % n : 0);
  },

  fillQueueAndPlay(idx) {
    const s = get();
    const track = s.playlist[idx];
    if (!track) return;
    if (track.driveId && !track.videoId) {
      const st2 = useStore.getState();
      const oi = st2.onlinePlaylist?.findIndex((x) => x.id === track.id) ?? -1;
      if (oi === -1) { pushToast('This song is not in the Drive library yet', 'warn'); return; }
      set({ pendingDriveId: track.id });
      st2.enrichJordanTracks();
      pushToast('Getting metadata for this song - it will auto-play in a moment', 'info');
      return;
    }
    if (idx === s.live?.currentSongIndex && s.inLive) return; // already on the air
    if (s.inLive) s.markManual('you picked a song');
    playIndexAt(get(), idx);
  },

  /* ================================================================ host controls (global) */
  hostPatch(patch) {
    if (get().isAdmin) syncEngine.hostPatch(patch);
  },

  hostPlayPause() {
    if (!get().isAdmin || !get().live) return;
    syncEngine.hostPatch({ isPlaying: !get().live.isPlaying });
  },

  hostStep(dir) {
    const s = get();
    if (!s.isAdmin || !s.playlist.length || !s.live) return;
    const n = s.playlist.length;
    const idx = (s.live.currentSongIndex + dir + n) % n;
    syncEngine.hostPatch({ songIndex: idx });
    pushToast(`Host switched the radio to "${s.playlist[idx].title}"`, 'host');
  },

  hostSeek(t) {
    if (get().isAdmin) syncEngine.hostPatch({ currentTimeOffset: t });
  },

  setLiveTrack(trackId) {
    const s = get();
    if (!s.isAdmin) return;
    const track = s.playlist.find((t) => t.id === trackId);
    syncEngine.hostPatch({ currentTrackId: trackId });
    if (track) pushToast(`Everyone is now listening to "${track.title}"`, 'host');
  },

  unlockAdmin(pass) {
    if (pass === CONFIG.hostPasscode) {
      storage.set('ishq.admin', true);
      set({ isAdmin: true });
      pushToast('Host controls unlocked — your changes broadcast live', 'host');
      return true;
    }
    pushToast('Wrong passcode', 'warn');
    return false;
  },

  lockAdmin() {
    storage.set('ishq.admin', false);
    set({ isAdmin: false });
  },

  /* ================================================================ prefs */
  setVolume(v) {
    audioEngine.setVolume(v);
    ytPlayer.setVolume(v);
    storage.set('ishq.volume', v);
    set({ volume: v });
  },

  toggleShuffle() {
    const v = !get().isShuffle;
    storage.set('ishq.shuffle', v);
    set({ isShuffle: v });
  },

  toggleRepeat() {
    const v = !get().isRepeat;
    storage.set('ishq.repeat', v);
    set({ isRepeat: v });
    audioEngine.audio.loop = v;
  },

  /* ================================================================ ui */
  openTheater() { set({ theaterOpen: true }); },
  closeTheater() { set({ theaterOpen: false }); },
  openSettings() { set({ settingsOpen: true }); },
  closeSettings() { set({ settingsOpen: false }); },
  setRailTab(tab) { set({ railTab: tab }); },
  setDrawer(open) { set({ drawerOpen: open }); },
  setAutoScroll(v) { set({ autoScroll: v }); },
  setView(view) { set({ view }); },
  setSearch(q) { set({ searchQuery: q }); },
  setBgTheme(t) {
    storage.set('ishq.bgTheme', t);
    set({ bgTheme: t });
  },
  setDark(v) {
    storage.set('ishq.dark', v);
    set({ dark: v });
  },
  toggleLike(id) {
    const { likedIds } = get();
    const next = likedIds.includes(id)
      ? likedIds.filter((x) => x !== id)
      : [id, ...likedIds];
    storage.set('ishq.liked', next);
    set({ likedIds: next });
    pushToast(
      next.includes(id) ? 'Added to your liked songs' : 'Removed from liked songs',
      next.includes(id) ? 'live' : 'info'
    );
  },
  notePlayed(id) {
    if (!id) return;
    const recentIds = [id, ...get().recentIds.filter((x) => x !== id)].slice(0, 8);
    storage.set('ishq.recent', recentIds);
    set({ recentIds });
  },
  pushToast(msg, kind = 'info') { pushToast(msg, kind); },
  dismissToast(id) { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); }
}));

if (typeof window !== 'undefined') window.__ishqStore = useStore;

/* ------------------------------------------------------------------ helpers */

let booted = false;
let driveHashLast = '';   // last drive listing hash (from ?check=1) — avoids re-fetching
let driveSyncTimer = null;
let ytStarted = false;
let ytClockTimer = null;

/** Standard track shape for a YouTube search hit. */
function hitToTrack(hit) {
  return {
    id: `yt-${hit.videoId}`,
    title: hit.title,
    artist: hit.channel || 'YouTube',
    album: 'Online',
    genre: 'Online',
    coverUrl: hit.thumb,
    videoId: hit.videoId,
    audioUrl: `/stream-online?id=${hit.videoId}`,
    duration: hit.duration || 0
  };
}

/** Append a floating reaction bubble (kept small, newest last). */
function pushReaction(r) {
  useStore.setState((s) => ({
    social: { ...s.social, reactions: [...s.social.reactions.slice(-7), { ...r, bid: `${r.id}-${r.at}` }] }
  }));
}

/** Append a Dil Ki Line dedication. */
function pushDedication(d) {
  useStore.setState((s) => ({
    social: { ...s.social, dedications: [...s.social.dedications.slice(-4), d] }
  }));
}

/** Append a Listening Now feed item. */
function pushActivity(text, kind = 'join') {
  useStore.setState((s) => ({
    social: { ...s.social, activity: [...s.social.activity.slice(-5), { id: `${Date.now()}-${Math.random()}`, text, kind, at: Date.now() }] }
  }));
}

/** Best available playback clock (YouTube when its player is live, else MP3). */
function nowTime() {
  return ytPlayer.ready ? ytPlayer.time() : audioEngine.time;
}

/** Feed currentTime/duration from the hidden player into the store. */
function startYtClock() {
  if (ytClockTimer) return;
  ytClockTimer = setInterval(() => {
    const s = useStore.getState();
    if (!s.ytReady || !ytPlayer.currentVideoId) return;
    const t = ytPlayer.time();
    const d = ytPlayer.duration();
    if (Math.abs(t - s.currentTime) > 0.03) useStore.setState({ currentTime: t });
    if (d && Math.abs(d - s.duration) > 1) useStore.setState({ duration: d });
  }, 250);
}

async function fetchLyrics(url, onText) {
  const streamUrl = toStreamUrl(url) || url;
  try {
    const res = await fetch(streamUrl);
    if (!res.ok) return;
    onText(await res.text());
  } catch { /* drive CORS — leave inline lyrics */ }
}

function playIndexAt(_s, idx) {
  const s = useStore.getState();
  const track = s.playlist[idx];
  if (!track) return;
  useStore.setState({
    live: { ...s.live, currentTrackId: track.id, currentSongIndex: idx },
    onlineNow: null,
    onlineIdx: -1,
    loadingTrack: true
  });
  playTrack(track, 0);
  useStore.getState().notePlayed(track.id);
}

/**
 * THE single entry point for starting any track. Guarantees:
 *  - only ONE media path ever sounds at a time (audioEngine XOR ytPlayer);
 *  - the same track can never be started twice while it is already on air;
 *  - every previous engine is stopped/cleaned before the new one starts.
 */
function playTrack(track, startSeconds = 0, force = false) {
  const s = useStore.getState();
  if (!track) return;
  const sameId = s._activeTrackId === track.id;
  const ytOnSame = !!track.videoId && ytPlayer.currentVideoId === track.videoId;
  const alreadyAirborne = sameId && (
    (ytOnSame && ytPlayer.isPlaying()) ||
    (!track.videoId && !audioEngine.paused)
  );
  if (!force && alreadyAirborne) return; // keep one instance, never two

  audioEngine.stop();               // kill any audio residue first
  if (ytPlayer.ready) ytPlayer.pause(); // then silence the previous video
  useStore.setState({ _activeTrackId: track.id });

  if (track.videoId && !(s.ytFailedVideoId === track.videoId)) {
    useStore.setState({ loadingTrack: true, ytFailedVideoId: null });
    if (ytPlayer.currentVideoId !== track.videoId) {
      ytPlayer.loadVideo(track.videoId, startSeconds);
    } else {
      if (startSeconds > 1) ytPlayer.seek(startSeconds);
      ytPlayer.play();
    }
    return;
  }
  audioEngine.load(track);
  audioEngine.play();
}

function pushToast(msg, kind = 'info') {
  const id = Date.now() + Math.random();
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, msg, kind }] }));
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
}

/**
 * Apply a global live state to this client's player:
 *  - new video            -> loadVideoById(videoId, elapsed) — exact sync
 *  - force (join/resync)  -> re-load at the current server position
 *  - paused               -> pause; resumed -> play (drift check re-seeks)
 * Tracks without a videoId keep using the MP3/drive engine.
 */
function applyLiveState(live, force = false) {
  const { playlist } = useStore.getState();
  if (!playlist.length || !live) return;
  const idx = Math.max(0, live.currentSongIndex ?? 0);
  const track = playlist[idx] || playlist[0];
  const videoId = live.videoId || track.videoId || null;
  const targetPos = syncEngine.positionAt();

  if (videoId) {
    const loaded = ytPlayer.currentVideoId;
    const trackChanged = loaded !== videoId;
    if (trackChanged || force) {
      audioEngine.stop(); // never leave MP3 audio running beside YouTube
      ytPlayer.loadVideo(videoId, targetPos);
      useStore.setState({
        live: { ...live, currentTrackId: track.id, currentSongIndex: idx },
        loadingTrack: true
      });
      useStore.getState().notePlayed(track.id);
    } else if (force || Math.abs(ytPlayer.time() - targetPos) > CONFIG.sync.driftThresholdSec) {
      ytPlayer.seek(targetPos);
      useStore.setState({ currentTime: targetPos });
    }
    if (live.isPlaying && !ytPlayer.isPlaying()) {
      ytPlayer.play();
    } else if (!live.isPlaying && ytPlayer.isPlaying()) {
      ytPlayer.pause();
      useStore.setState({ currentTime: targetPos });
    }
    return;
  }

  // drive/MP3 fallback for tracks without a YouTube mapping
  const trackChanged = audioEngine._lastUrl !== (track.audioUrl ?? track.driveId);
  if (trackChanged || force) {
    if (ytPlayer.ready) ytPlayer.pause(); // never leave YouTube playing beside MP3 audio
    audioEngine._lastUrl = track.audioUrl ?? track.driveId;
    useStore.setState({ live: { ...live, currentTrackId: track.id, currentSongIndex: idx }, loadingTrack: true });
    audioEngine.load(track);
    useStore.getState().notePlayed(track.id);
  }
  if (force || Math.abs(audioEngine.time - targetPos) > CONFIG.sync.driftThresholdSec) {
    audioEngine.seek(targetPos);
    useStore.setState({ currentTime: targetPos });
  }
  if (live.isPlaying && audioEngine.paused) {
    audioEngine.play();
  } else if (!live.isPlaying && !audioEngine.paused) {
    audioEngine.seek(syncEngine.globalPosition());
    audioEngine.pause();
    useStore.setState({ currentTime: targetPos });
  }
}