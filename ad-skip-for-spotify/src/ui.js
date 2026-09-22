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
