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
