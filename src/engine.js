(function (root) {
  'use strict';
  const unwrap = track => track?.contextTrack || track || {};
  const itemOf = state => unwrap(state?.item || state?.track);
  const contextOf = state => state?.context_uri || state?.contextUri || state?.context?.uri || '';
  const identity = state => `${itemOf(state).uri || ''}|${itemOf(state).uid || ''}`;
  function nextInPlaylist(state, queue, player) {
    const context = contextOf(state);
    // Albums and Liked Songs also provide ordered track queues in Spotify.
    const isTrackList = /^spotify:(?:user:[^:]+:)?playlist:/.test(context) ||
      /^spotify:album:/.test(context) || /^spotify:(?:user:[^:]+:)?collection(?::|$)/.test(context);
    if (!isTrackList) return null;
    const restrictions = state?.restrictions;
    if (restrictions?.disallowSkippingNextReasons?.length || restrictions?.disallow_skipping_next_reasons?.length) return null;
    const entries = queue?.nextTracks ?? queue?.next_tracks ?? state?.nextTracks ?? state?.next_tracks;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const entry = entries?.[0];
    const next = unwrap(entry);
    if (entry && (!/^spotify:track:/.test(next.uri || '') || entry.provider === 'autoplay' || entry.blocked?.length || entry.removed?.length)) return null;
    if (next.metadata?.is_ad === 'true') return null;
    return { context, uri: next.uri, uid: next.uid || undefined };
  }
  function create(spice, getEnabled, report = () => {}, now = () => performance.now()) {
    let last = null, handled = false, stopPosition = 0, pending = null;
    function tick() {
      if (!getEnabled()) { pending = null; handled = false; return; }
      const player = spice.Player;
      try {
        const state = player.data;
        const item = itemOf(state);
        const key = identity(state);
        const position = player.getProgress();
        const duration = player.getDuration();
        if (pending?.phase === 'advance') {
          const action = pending;
          const changed = key !== action.from || position < action.position - 2000;
          if (changed && /^spotify:track:/.test(item.uri || '') && (!action.next.uri || action.next.uri === item.uri)) {
            pending = null;
            last = key;
            handled = false;
            if (!player.isPlaying()) player.play();
            report('Next track started');
          } else if (changed || now() - action.started > 5000) {
            pending = null;
            report('Could not confirm the next track');
          }
          return;
        }
        if (key !== last) { last = key; handled = false; pending = null; }
        if (!/^spotify:track:/.test(item.uri || '') || item.metadata?.is_ad === 'true') { pending = null; return; }
        if (!Number.isFinite(position) || !Number.isFinite(duration)) return;
        if (handled && position < stopPosition - 2000) handled = false;
        if (pending) {
          const action = pending;
          if (player.isPlaying()) {
            if (now() - action.started > 3000) { pending = null; report('Could not confirm pause'); }
            return;
          }
          pending = null;
          const next = action.next;
          if (!next || contextOf(state) !== next.context) {
            report('Playback paused'); return;
          }
          // Select the queued track inside its original list, as a track-row
          // play action does. Do not fall back to the native next command.
          pending = { phase: 'advance', started: now(), from: key, position, next };
          const request = pending;
          const result = player.playUri(next.context, {}, {
            skipTo: { uri: next.uri, ...(next.uid ? { uid: next.uid } : {}) },
            seekTo: 0, paused: false
          });
          Promise.resolve(result).catch(error => {
            if (pending !== request) return;
            pending = null;
            console.warn('[Ad Skip] Track selection failed', error);
            report('Could not select the next track');
          });
          return;
        }
        if (handled || !player.isPlaying() || state?.is_buffering || state?.isBuffering) return;
        const remaining = duration - position;
        if (position <= 0 || remaining <= 0 || remaining > 2000) return;
        handled = true;
        stopPosition = position;
        pending = { phase: 'pause', started: now(), next: nextInPlaylist(state, spice.Queue, player) };
        player.pause();
      } catch (error) {
        pending = null;
        console.warn('[Ad Skip]', error);
        report('Could not read playback state');
      }
    }
    return { tick };
  }
  const api = { create, nextInPlaylist };
  if (typeof module !== 'undefined') module.exports = api;
  else root.AdSkipDesktopEngine = api;
})(globalThis);
