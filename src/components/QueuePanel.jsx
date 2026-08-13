import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { fmtTime } from '../lib/lrcParser.js';
import { artUrl } from '../lib/thumb.js';

/** Up Next panel — local queue, or the live online/drive session when one is on air. */
export default function QueuePanel() {
  const playlist = useStore((s) => s.playlist);
  const currentIndex = useStore((s) => s.live?.currentSongIndex ?? 0);
  const fillQueueAndPlay = useStore((s) => s.fillQueueAndPlay);
  const isAdmin = useStore((s) => s.isAdmin);
  const searchQuery = useStore((s) => s.searchQuery);
  const view = useStore((s) => s.view);
  const likedIds = useStore((s) => s.likedIds);
  const recentIds = useStore((s) => s.recentIds);
  const toggleLike = useStore((s) => s.toggleLike);
  const inLive = useStore((s) => s.inLive);
  const onlineList = useStore((s) => s.onlinePlaylist);
  const onlineIdx = useStore((s) => s.onlineIdx);
  const onlineNow = useStore((s) => s.onlineNow);
  const playOnlineAt = useStore((s) => s.playOnlineAt);
  const onlineResults = useStore((s) => s.onlineResults);
  const searchOnline = useStore((s) => s.searchOnline);
  const playOnline = useStore((s) => s.playOnline);
  const backToLive = useStore((s) => s.backToLive);
  const mood = useStore((s) => s.mood);
  const refreshJordan = useStore((s) => s.refreshJordan);

  const q = searchQuery.trim().toLowerCase();
  const matchesQ = (t) =>
    !q || (t.title + ' ' + (t.artist || '') + ' ' + (t.album || '')).toLowerCase().includes(q);

  // Explore → pull a fresh trending batch the first time the tab opens
  useEffect(() => {
    if (view === 'explore' && onlineResults.length === 0) searchOnline('trending romantic songs');
  }, [view, onlineResults.length, searchOnline]);

  const rows = useMemo(() => {
    // EXPLORE — online trending / search hits
    if (view === 'explore') {
      return (q
          ? onlineResults.filter((r) => (r.title + ' ' + (r.channel || '')).toLowerCase().includes(q))
          : onlineResults)
        .slice(0, 15)
        .map((r) => ({ key: r.videoId, track: { ...r, coverUrl: r.thumb }, online: true, fromSearch: true }));
    }

    const byId = new Map(playlist.map((t, i) => [t.id, i]));

    // LIKED — your saved songs, live or not
    if (view === 'liked') {
      return playlist
        .filter((t) => likedIds.includes(t.id) && matchesQ(t))
        .map((t) => ({ key: t.id, track: t, index: byId.get(t.id), online: false, fromSearch: false }));
    }

    // HISTORY — what you have heard, live or not
    if (view === 'history') {
      return recentIds
        .map((id) => playlist[byId.get(id)])
        .filter(Boolean)
        .filter(matchesQ)
        .map((t) => ({ key: t.id, track: t, index: byId.get(t.id), online: false, fromSearch: false }));
    }

    // LIVE / HOME / RADIO — the room's queue as it airs
    if (onlineNow) {
      let list = onlineList.slice();
      if (q) list = list.filter((t) => (t.title + ' ' + (t.artist || '')).toLowerCase().includes(q));
      return list.map((t, index) => ({ key: t.id || t.videoId || index, track: t, index, online: true, fromSearch: false }));
    }

    let list = playlist.slice();
    if (!inLive && view === 'home') list = list.filter((_, i) => i !== currentIndex);
    if (q) list = list.filter(matchesQ);
    return list.map((t) => ({ key: t.id, track: t, index: byId.get(t.id), online: false, fromSearch: false }));
  }, [playlist, view, likedIds, recentIds, q, inLive, currentIndex, onlineNow, onlineList, onlineResults]);

  const head = view === 'explore'
    ? 'EXPLORE · TRENDING'
    : onlineNow
      ? (mood ? `${mood.toUpperCase()} · ON AIR` : 'ONLINE · ON AIR')
      : ({
          home: 'NEXT UP',
          radio: 'ON AIR · NOW',
          liked: 'LIKED SONGS',
          history: 'RECENTLY PLAYED'
        }[view] || 'NEXT UP');

  const empty = {
    liked: 'No liked songs yet — tap the ♥ to save one here',
    history: 'Nothing played yet — the radio will fill this up',
    explore: 'No trending hits right now — try a search in the top bar',
    home: 'No songs found for your search',
    radio: 'No songs found for your search'
  }[view] || 'No songs found for your search';

  return (
    <>
      <div className="queue-head">
        <span>{head}</span>
        <span className="pill">{rows.length} {rows.length === 1 ? 'song' : 'songs'}
          {onlineNow && mood === 'jordan-core' && (
            <button
              className="q-refresh"
              title="Check for newly added Drive songs"
              aria-label="Refresh Drive songs"
              onClick={refreshJordan}
            >
              <i className="fa-solid fa-rotate" />
            </button>
          )}
        </span>
      </div>
      {view === 'radio' && !inLive && (
        <button className="q-live-cta" onClick={backToLive}>
          <i className="fa-solid fa-tower-broadcast" /> You're off air — back to the live lounge
        </button>
      )}
      <div className="queue-list">
        {rows.length === 0 && <div className="q-empty">{empty}</div>}
        {rows.map(({ key, track: t, index: i, online, fromSearch }) => {
          const isCurrent = online && !fromSearch ? i === onlineIdx : i === currentIndex;
          return (
            <div
              key={key}
              className={`q-item ${isCurrent ? 'playing' : ''}`}
              onClick={() => (online && fromSearch ? playOnline(t) : online ? playOnlineAt(i) : fillQueueAndPlay(i))}
            >
              <div className="q-thumb">
                <img
                  loading="lazy"
                  src={artUrl(t.coverUrl)}
                  alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="q-meta">
                <div className="q-title">{t.title}</div>
                <div className="q-artist">{t.artist}</div>
              </div>
              <span className="q-dur">{t.duration ? fmtTime(t.duration) : '▶'}</span>
              <button
                className={`q-heart ${likedIds.includes(t.id) ? 'liked' : ''}`}
                aria-label="Like"
                onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }}
              >
                <i className={`fa-solid ${likedIds.includes(t.id) ? 'fa-heart' : 'fa-heart'}`}
                  style={likedIds.includes(t.id) ? {} : { opacity: 0.55 }} />
              </button>
            </div>
          );
        })}
      </div>
      {isAdmin && view === 'home' && <div className="q-up-next">↑ click a song to put it on air for everyone</div>}
    </>
  );
}