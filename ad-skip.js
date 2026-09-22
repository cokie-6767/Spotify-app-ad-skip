// Ad Skip for Spotify Desktop 1.2.4 — Spicetify extension
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

(() => {
const desktopStorage = {
  async get(key) { const value = localStorage.getItem('ad-skip-desktop-' + key); return { [key]: value ? JSON.parse(value) : undefined }; },
  async set(values) { for (const [key, value] of Object.entries(values)) localStorage.setItem('ad-skip-desktop-' + key, JSON.stringify(value)); }
};
(() => {
  'use strict';
  globalThis.AdSkipDesktopPosition = (host, shadow) => {
    const KEY = 'spotifyEndGuardPosition';
    const open = shadow.getElementById('open');
    const header = shadow.getElementById('drag-handle');
    let position = { x: Math.max(0, window.innerWidth - 52), y: 80 };
    let drag = null;
    let suppressClickUntil = 0;
    let touched = false;
    const clamp = (n, max) => Math.min(Math.max(0, n), Math.max(0, max));
    function layout() {
      const rect = host.getBoundingClientRect();
      host.style.right = 'auto';
      host.style.left = `${clamp(position.x, window.innerWidth - rect.width)}px`;
      host.style.top = `${clamp(position.y, window.innerHeight - rect.height)}px`;
    }
    function save() {
      desktopStorage.set({ [KEY]: position }).catch(() => {});
    }
    for (const handle of [open, header]) {
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.isPrimary === false || event.target.closest('#close')) return;
        const rect = host.getBoundingClientRect();
        drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: rect.left, y: rect.top, moved: false };
        touched = true;
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        const rect = host.getBoundingClientRect();
        position = {
          x: clamp(drag.x + dx, window.innerWidth - rect.width),
          y: clamp(drag.y + dy, window.innerHeight - rect.height)
        };
        layout();
        event.preventDefault();
      });
      const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (drag.moved) {
          suppressClickUntil = performance.now() + 500;
          save();
        }
        drag = null;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
      handle.addEventListener('lostpointercapture', finish);
      handle.addEventListener('click', event => {
        if (event.detail !== 0 && performance.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    }
    window.addEventListener('resize', layout);
    desktopStorage.get(KEY).then(result => {
      const saved = result[KEY];
      if (!touched && Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) position = { x: saved.x, y: saved.y };
      layout();
    }).catch(() => {});
    layout();
    return { layout };
  };
})();

})();

(() => {
  'use strict';
  if (typeof document === 'undefined') return;
  let attempts = 0;
  function start() {
    const spice = globalThis.Spicetify;
    if (!document.body || !spice?.Player?.origin || !spice.Player.getProgress || !spice.Player.playUri || !spice.Player.play) {
      if (++attempts < 120) setTimeout(start, 500);
      else console.warn('[Ad Skip] Spicetify Player unavailable. Reapply Spicetify after checking version compatibility.');
      return;
    }
    if (document.getElementById('ad-skip-desktop')) return;
    const KEY = 'ad-skip-desktop-settings-v1';
    let settings = { enabled: true, panelHidden: false };
    try { settings = { ...settings, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
    settings = { enabled: settings.enabled !== false, panelHidden: settings.panelHidden === true };
    let saveState = 'Saved';
    const host = document.createElement('div');
    host.id = 'ad-skip-desktop';
    host.style.cssText = 'position:fixed;right:16px;top:80px;z-index:2147483647';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
    :host{all:initial}[hidden]{display:none!important}section{box-sizing:border-box;width:240px;max-width:100vw;padding:12px 14px;border:1px solid #555;border-radius:12px;background:#191919;color:#eee;font:13px/1.6 system-ui;box-shadow:0 4px 20px #0006}header{display:flex;align-items:center;justify-content:space-between;font-weight:700;cursor:move;touch-action:none;user-select:none}label{display:block;margin-top:12px}button{background:#333;color:white;border:1px solid #666;border-radius:6px;padding:4px 8px;cursor:pointer;font:16px system-ui}p{margin:8px 0 0;color:#bbb;font-size:12px}#open{width:36px;height:36px;border-radius:50%;background:#191919;cursor:grab;touch-action:none;user-select:none}input{width:52px;padding:4px;background:#333;color:#fff;border:1px solid #777;border-radius:4px}
    input[type="checkbox"]{width:auto;accent-color:#1ed760}
    </style><button id="open" hidden title="Click for settings; drag to move" aria-label="Open Ad Skip settings">⚙</button><section id="panel" aria-label="Ad Skip settings"><header id="drag-handle">Ad Skip for Spotify<button id="close" aria-label="Close">×</button></header><label><input id="enabled" type="checkbox"> Enable Ad Skip</label><p id="applied" aria-live="polite"></p></section>`;
    document.body.append(host);
    const ui = id => shadow.getElementById(id);
    const mover = globalThis.AdSkipDesktopPosition(host, shadow);
    function render() {
      ui('panel').hidden = settings.panelHidden;
      ui('open').hidden = !settings.panelHidden;
      ui('enabled').checked = settings.enabled;
      ui('applied').textContent = `${settings.enabled ? 'On · 2 seconds before the end' : 'Off'} · ${saveState}`;
      mover.layout();
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(settings)); saveState = 'Saved'; }
      catch { saveState = 'Save failed; active for this session'; }
      render();
    }
    ui('enabled').addEventListener('change', () => {
      settings.enabled = ui('enabled').checked;
      engine.tick();
      save();
    });
    for (const name of ['open', 'close']) ui(name).addEventListener('click', () => {
      settings.panelHidden = name === 'close'; save(); ui(settings.panelHidden ? 'open' : 'enabled').focus();
    });
    const engine = AdSkipDesktopEngine.create(spice, () => settings.enabled, message => {
      // Keep technical playback details out of the small settings panel.
      host.dataset.lastStatus = message;
    });
    const timer = setInterval(engine.tick, 100);
    const events = ['onprogress', 'onplaypause', 'songchange'];
    for (const event of events) spice.Player.addEventListener(event, engine.tick);
    document.addEventListener('visibilitychange', engine.tick);
    window.addEventListener('pagehide', () => {
      clearInterval(timer);
      for (const event of events) spice.Player.removeEventListener(event, engine.tick);
      document.removeEventListener('visibilitychange', engine.tick);
    }, { once: true });
    render();
  }
  start();
})();
