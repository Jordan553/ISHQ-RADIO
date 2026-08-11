(function () {
  var PLAYLIST = 'PLRrbjdb6KCyM';
  var player = null, apiReady = false, desired = true, errs = 0;

  function $(id) { return document.getElementById(id); }

  /* ---------- cross-device sync (radio broadcast) ---------- */
  var S = {
    ws: null, connected: false, synced: false, leader: false, station: null,
    clientId: 'c' + Math.random().toString(36).slice(2, 9)
  };
  function syncBadge() {
    var on = S.synced && S.connected;
    var b = $('sync');
    if (b) { b.textContent = on ? 'SYNCED' : 'SOLO'; b.classList.toggle('on', on); }
    var l = $('synclabel');
    if (l) l.textContent = on ? 'SYNCED' : 'SYNC';
    var s = $('syncbtn');
    if (s) s.classList.toggle('on', on);
  }

  function toggleSync() {
    S.synced = !S.synced;
    if (S.synced) {
      if (S.ws && S.ws.readyState === 1) {
        S.ws.send(JSON.stringify({ type: 'need-station' }));
      }
      claimLead();
    } else {
      S.leader = false;
      S.station = null;
      if (S.ws && S.ws.readyState === 1) {
        S.ws.send(JSON.stringify({ type: 'leave' }));
      }
      if (desired && player) {
        try { if (player.getPlayerState && player.getPlayerState() === 2) player.playVideo(); } catch (e) {}
      }
    }
    syncBadge();
  }

  function stationExpected(m) {
    return m.playing ? m.t0 + (Date.now() - m.at) / 1000 : null;
  }

  function followStation(m) {
    if (!player || !apiReady || S.leader) return;
    if (!m.videoId) return;
    var exp = stationExpected(m);
    try {
      var cur = player.getVideoData && player.getVideoData();
      if (!cur || !cur.video_id || cur.video_id !== m.videoId) {
        var list = player.getPlaylist ? player.getPlaylist() : null;
        var idx = -1;
        if (list && list.length) {
          for (var k = 0; k < list.length; k++) {
            if (list[k] === m.videoId) { idx = k; break; }
          }
        }
        if (idx >= 0) {
          player.loadPlaylist({ list: PLAYLIST, listType: 'playlist', index: idx });
        } else {
          player.pauseVideo();
          player.cueVideoById(m.videoId);
        }
      }
      if (exp !== null) player.seekTo(exp, true);
      if (m.playing) { try { player.playVideo(); } catch (e) {} }
      else { try { player.pauseVideo(); } catch (e) {} }
    } catch (e) {}
  }

  function sendClaim() {
    if (!S.ws || S.ws.readyState !== 1 || !player) return;
    var d = player.getVideoData && player.getVideoData();
    if (!d || !d.video_id) return;
    S.ws.send(JSON.stringify({
      type: 'claim', clientId: S.clientId, videoId: d.video_id,
      t: player.getCurrentTime ? player.getCurrentTime() : 0
    }));
  }

  function claimLead() {
    if (!S.synced || !S.connected || !S.station || S.station.leaderId || S.leader) return;
    var d = player.getVideoData && player.getVideoData();
    if (!d || !d.video_id) return;
    var st = -1;
    try { st = player.getPlayerState(); } catch (e) {}
    if (st !== 1) return;
    S.leader = true;
    sendClaim();
  }

  function sendState(playing) {
    if (!S.ws || S.ws.readyState !== 1 || !player) return;
    var d = player.getVideoData && player.getVideoData();
    if (!d || !d.video_id) return;
    S.ws.send(JSON.stringify({
      type: 'state', clientId: S.clientId, videoId: d.video_id,
      t: player.getCurrentTime ? player.getCurrentTime() : 0, playing: playing
    }));
  }

  function connectSync() {
    try {
      var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      S.ws = new WebSocket(proto + location.host + '/ws');
    } catch (e) { syncBadge(); return; }
    S.ws.onopen = function () { S.connected = true; syncBadge(); };
    S.ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'cmd' && (m.cmd === 'next' || m.cmd === 'prev') && S.synced) { skip(m.cmd); return; }
      if (!m || m.type !== 'station') return;
      if (!S.synced) return;
      var wasLeader = S.leader;
      S.station = m;
      S.leader = m.leaderId === S.clientId;
      if (S.leader) {
        if (!wasLeader) sendState(true);
        return;
      }
      followStation(m);
    };
    S.ws.onclose = function () {
      S.connected = false; S.leader = false; S.station = null; syncBadge();
      setTimeout(connectSync, 3000);
    };
    S.ws.onerror = function () { try { S.ws.close(); } catch (e) {} };
  }

  function loadApi() {
    return new Promise(function (res, rej) {
      if (window.YT && YT.Player) { res(); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(); };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { rej(new Error('api')); };
      document.head.appendChild(s);
      setTimeout(function () { rej(new Error('timeout')); }, 10000);
    });
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec <= 0) return '';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    var h = Math.floor(m / 60); m = m % 60;
    return h
      ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
      : m + ':' + String(s).padStart(2, '0');
  }

  function show(cls) { document.body.className = cls; }

  function update() {
    if (!player || !apiReady) return;
    var d = player.getVideoData && player.getVideoData();
    if (!d || !d.video_id) return;
    $('title').textContent = d.title || 'इश्क़';
    $('art').src = 'https://i.ytimg.com/vi/' + d.video_id + '/mqdefault.jpg';
    $('ambientArt').src = 'https://i.ytimg.com/vi/' + d.video_id + '/hqdefault.jpg';
    document.body.classList.add('has-art');
    var list = player.getPlaylist ? player.getPlaylist() : null;
    var i = player.getPlaylistIndex();
    var total = list && list.length ? list.length : 0;
    var dur = player.getDuration ? player.getDuration() : 0;
    $('meta').textContent = (total ? String(i + 1).padStart(2, '0') + ' — ' + total + ' · ' : '') + fmt(dur);
    document.title = d.title ? 'इश्क़ — ' + d.title : 'इश्क़ — ISHQ Radio';
  }

  function onState(e) {
    if (!YT) return;
    if (e.data === YT.PlayerState.PLAYING) {
      document.body.classList.add('playing');
      desired = true;
      update();
      if (S.leader) sendState(true);
      else if (S.synced && S.connected && S.station && !S.station.leaderId) claimLead();
    } else if (e.data === YT.PlayerState.PAUSED) {
      document.body.classList.remove('playing');
      if (S.leader) sendState(false);
    }
  }

  function onErr() {
    errs++;
    if (errs > 4) { show('s-error'); return; }
    try { skip('next'); } catch (e) {}
  }

  function resync() {
    if (!apiReady) return;
    try {
      var i = player.getPlaylistIndex ? player.getPlaylistIndex() : 0;
      player.loadPlaylist({ list: PLAYLIST, listType: 'playlist', index: i });
    } catch (e) {}
  }

  function init() {
    show('s-loading');
    loadApi().then(function () {
      player = new YT.Player('player', {
        width: '640', height: '390',
        playerVars: {
          listType: 'playlist', list: PLAYLIST, loop: 1,
          playsinline: 1, controls: 0, disablekb: 1, rel: 0, iv_load_policy: 3
        },
        events: {
          onReady: function () {
            window.__p = player;
            apiReady = true;
            var n = 0;
            try { n = player.getPlaylist().length; } catch (e) {}
            if (!n) { show('s-empty'); return; }
            $('counts').textContent = n + ' SONGS';
            $('prev').disabled = false;
            $('next').disabled = false;
            show('s-ready');
            if (S.synced && S.station && S.station.videoId) {
              followStation(S.station);
            } else if (desired) {
              try { player.playVideo(); } catch (e) {}
            }
            update();
          },
          onStateChange: onState,
          onError: onErr
        }
      });
    }).catch(function () {
      $('errmsg').textContent = 'Could not load the YouTube player. Check your connection and retry.';
      show('s-error');
    });
  }

  /* skip a track without detaching the playlist */
  function skip(dir) {
    if (!apiReady || !player) return;
    if (S.synced && !S.leader && S.connected && S.station && S.station.leaderId) {
      try { S.ws.send(JSON.stringify({ type: 'cmd', cmd: dir })); } catch (e) {}
      return;
    }
    try {
      var n = player.getPlaylist ? (player.getPlaylist().length || 0) : 0;
      var i = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
      if (n > 0 && i >= 0) {
        var next = (i + (dir === 'next' ? 1 : n - 1)) % n;
        player.loadPlaylist({ list: PLAYLIST, listType: 'playlist', index: next });
      } else if (dir === 'next') {
        player.nextVideo();
      } else {
        player.previousVideo();
      }
    } catch (e) {}
    setTimeout(update, 500);
  }

  $('play').addEventListener('click', function () {
    if (!apiReady) return;
    desired = !desired;
    try { if (desired) player.playVideo(); else player.pauseVideo(); } catch (e) {}
  });
  $('prev').addEventListener('click', function () { skip('prev'); });
  $('next').addEventListener('click', function () { skip('next'); });
  $('syncbtn').addEventListener('click', toggleSync);
  $('retry').addEventListener('click', function () { errs = 0; init(); });

  setInterval(function () { if (document.visibilityState === 'visible') resync(); }, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });

  /* sync loops: leader heartbeat + follower drift correction */
  setInterval(function () {
    if (!S.leader || !S.connected) return;
    var st = -1;
    try { st = player.getPlayerState(); } catch (e) {}
    sendState(st === 1);
  }, 8000);

  /* play watchdog: retry playVideo until audio actually starts */
  var playRetries = 0;
  setInterval(function () {
    if (!apiReady || !desired) return;
    if (S.synced && S.station && S.station.videoId && !S.station.playing) return;
    var st = -1;
    try { st = player.getPlayerState(); } catch (e) {}
    if (st === 1 || st === 3) { playRetries = 0; return; }
    ++playRetries;
    try { player.playVideo(); } catch (e) {}
  }, 2000);
  setInterval(function () {
    if (!S.synced || !S.connected || S.leader || !S.station) return;
    if (!S.station.leaderId) {
      try { if (player.getPlayerState() === 1) claimLead(); } catch (e) {}
      return;
    }
    if (!S.station.playing) return;
    var exp = stationExpected(S.station);
    if (exp === null) return;
    try {
      var cur = player.getCurrentTime();
      if (Math.abs(cur - exp) > 1.5) player.seekTo(exp, true);
    } catch (e) {}
  }, 10000);

  connectSync();
  init();
})();
