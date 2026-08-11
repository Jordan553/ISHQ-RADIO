(function () {
  var PLAYLIST = 'PLRrbjdb6KCyM';
  var player = null, apiReady = false, desired = true, errs = 0;

  function $(id) { return document.getElementById(id); }

  /* ---------- cross-device sync (PeerJS room — works on any static host) ---------- */
  var ROOM = 'ishq-radio';
  var S = {
    peer: null, conn: null, conns: [], peers: 0,
    state: 'none', /* none | claiming | leader | connecting | follower */
    leader: false, station: null,
    clientId: 'c' + Math.random().toString(36).slice(2, 9)
  };
  window.__S = S;

  function syncBadge() {
    var on = S.state === 'follower' || (S.state === 'leader' && S.peers > 0);
    var b = $('sync');
    if (!b) return;
    b.textContent = on ? 'SYNCED' : 'SOLO';
    b.classList.toggle('on', on);
  }

  function stationExpected(m) {
    return m.playing ? m.t0 + (Date.now() - m.at) / 1000 : null;
  }

  function isPlaying() {
    try { return player.getPlayerState() === 1; } catch (e) { return false; }
  }

  function stationMsg() {
    var d = player.getVideoData && player.getVideoData();
    if (!d || !d.video_id) return null;
    return JSON.stringify({
      type: 'station', videoId: d.video_id,
      t0: player.getCurrentTime ? player.getCurrentTime() : 0,
      at: Date.now(), playing: isPlaying(), leaderId: S.clientId
    });
  }

  function broadcastStation(except) {
    var body = stationMsg();
    if (!body) return;
    for (var i = 0; i < S.conns.length; i++) {
      var c = S.conns[i];
      if (c !== except && c.open) { try { c.send(body); } catch (e) {} }
    }
  }

  function sendToLeader(m) {
    if (S.conn && S.conn.open) { try { S.conn.send(JSON.stringify(m)); } catch (e) {} }
  }

  function onConnData(conn, raw) {
    var m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m) return;
    if (m.type === 'hello' && S.leader) {
      var body = stationMsg();
      if (body && conn.open) { try { conn.send(body); } catch (e) {} }
      return;
    }
    if (S.leader && m.type === 'cmd') { handleCmd(m.cmd); return; }
    if (!S.leader && m.type === 'station') {
      S.station = m;
      followStation(m);
    }
  }

  /* the room: one device owns the id and is the DJ, everyone else follows */
  function openRoom() {
    if (S.state !== 'none') return;
    S.state = 'claiming';
    var p = new Peer(ROOM);
    S.peer = p;
    p.on('open', function () {
      S.state = 'leader';
      S.leader = true;
      if (apiReady) broadcastStation();
      syncBadge();
    });
    p.on('connection', function (conn) {
      conn.on('data', function (raw) { onConnData(conn, raw); });
      conn.on('close', function () { removeConn(conn); });
      conn.on('error', function () { removeConn(conn); });
      S.conns.push(conn);
      S.peers = S.conns.length;
      syncBadge();
    });
    p.on('error', function (err) {
      if (err.type === 'unavailable-id') {
        /* someone else owns the room — join them as a listener */
        if (S.peer) { try { S.peer.destroy(); } catch (e) {} }
        S.peer = null;
        S.state = 'connecting';
        joinRoom();
      }
    });
  }

  function removeConn(conn) {
    var i = S.conns.indexOf(conn);
    if (i >= 0) S.conns.splice(i, 1);
    S.peers = S.conns.length;
    syncBadge();
  }

  function joinRoom() {
    if (!S.peer) {
      var p = new Peer();
      S.peer = p;
      p.on('error', function () { /* retry cycle below */ });
    }
    var peer = S.peer;
    var started = false;
    var start = function () {
      if (started || S.state !== 'connecting') return;
      started = true;
      var conn = peer.connect(ROOM, { reliable: true });
      S.conn = conn;
      var lost = false;
      var onLost = function () {
        if (lost) return;
        lost = true;
        S.conn = null;
        S.station = null;
        S.leader = false;
        syncBadge();
        if (S.peer) { try { S.peer.destroy(); } catch (e) {} }
        S.peer = null;
        S.state = 'none';
        setTimeout(openRoom, 600 + Math.random() * 2400);
      };
      conn.on('open', function () {
        S.state = 'follower';
        S.leader = false;
        S.joinedAt = Date.now();
        syncBadge();
        try { conn.send(JSON.stringify({ type: 'hello', clientId: S.clientId })); } catch (e) {}
      });
      conn.on('data', function (raw) { onConnData(conn, raw); });
      conn.on('close', onLost);
      conn.on('error', onLost);
    };
    if (peer.id) {
      start();
    } else {
      peer.on('open', start);
    }
  }

  function loadPeerJs() {
    return new Promise(function (res, rej) {
      if (window.Peer) { res(); return; }
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
      s.async = true;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function handleCmd(cmd) {
    if (!apiReady || !player) return;
    if (cmd === 'next' || cmd === 'prev') { skip(cmd); return; }
    if (cmd === 'play') { desired = true; try { player.playVideo(); } catch (e) {} return; }
    if (cmd === 'pause') { desired = false; try { player.pauseVideo(); } catch (e) {} return; }
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

  /* ---------- player ---------- */

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
      if (S.leader) broadcastStation();
      else if (S.state === 'follower' && S.station && !S.station.playing) {
        sendToLeader({ type: 'cmd', cmd: 'play' });
      }
    } else if (e.data === YT.PlayerState.PAUSED) {
      document.body.classList.remove('playing');
      if (S.leader) broadcastStation();
      else if (S.state === 'follower' && S.station && S.station.playing) {
        sendToLeader({ type: 'cmd', cmd: 'pause' });
      }
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
            if (S.state === 'follower' && S.station && S.station.videoId) {
              followStation(S.station);
            } else if (desired) {
              try { player.playVideo(); } catch (e) {}
            }
            if (S.leader) broadcastStation();
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
    if (!S.leader && S.state === 'follower') {
      sendToLeader({ type: 'cmd', cmd: dir });
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

  /* ---------- UI ---------- */

  function toggleFullscreen() {
    var d = document;
    try {
      if (!d.fullscreenElement) {
        if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () {});
        else if (d.documentElement.webkitRequestFullscreen) d.documentElement.webkitRequestFullscreen();
      } else {
        if (d.exitFullscreen) d.exitFullscreen();
        else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
      }
    } catch (e) {}
  }

  function fsIcon() {
    document.body.classList.toggle('fs-on', !!document.fullscreenElement || !!document.webkitFullscreenElement);
  }

  $('play').addEventListener('click', function () {
    if (!apiReady) return;
    desired = !desired;
    try { if (desired) player.playVideo(); else player.pauseVideo(); } catch (e) {}
  });
  $('prev').addEventListener('click', function () { skip('prev'); });
  $('next').addEventListener('click', function () { skip('next'); });
  $('fsbtn').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', fsIcon);
  document.addEventListener('webkitfullscreenchange', fsIcon);
  $('retry').addEventListener('click', function () { errs = 0; init(); });

  setInterval(function () { if (document.visibilityState === 'visible') resync(); }, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });

  /* ---------- sync loops ---------- */

  /* leader heartbeat: keep the station clock fresh */
  setInterval(function () {
    if (S.leader) broadcastStation();
  }, 8000);

  /* play watchdog: retry playVideo until audio actually starts */
  var playRetries = 0;
  setInterval(function () {
    if (!apiReady || !desired) return;
    if (S.state === 'follower' && S.station && S.station.videoId && !S.station.playing) return;
    var st = -1;
    try { st = player.getPlayerState(); } catch (e) {}
    if (st === 1 || st === 3) { playRetries = 0; return; }
    ++playRetries;
    try { player.playVideo(); } catch (e) {}
  }, 2000);

  /* follower drift correction */
  setInterval(function () {
    if (S.state !== 'follower' || !S.station || !S.station.playing) return;
    var exp = stationExpected(S.station);
    if (exp === null) return;
    try {
      var cur = player.getCurrentTime();
      if (Math.abs(cur - exp) > 1.5) player.seekTo(exp, true);
    } catch (e) {}
  }, 10000);

  /* takeover watchdog: leader silent too long -> drop it and try to claim the room */
  setInterval(function () {
    if (S.state !== 'follower') return;
    var silent = S.station ? Date.now() - S.station.at : Date.now() - (S.joinedAt || 0);
    if (silent > 15000) {
      if (S.conn) { try { S.conn.close(); } catch (e) {} }
    }
  }, 5000);

  loadPeerJs().then(openRoom).catch(function () {
    setTimeout(function () {
      loadPeerJs().then(openRoom).catch(function () {});
    }, 30000);
  });

  init();
})();
