/* ============================================================
   Macro — rest timer (Hevy-style) between sets
   ============================================================ */
window.App = window.App || {};

App.Timer = (function () {
  let interval = null, remaining = 0, host = null;

  function ensureHost() {
    host = document.getElementById('rest-timer');
    if (!host) {
      host = document.createElement('div');
      host.id = 'rest-timer';
      host.className = 'rest-timer hidden';
      document.body.appendChild(host);
    }
    return host;
  }

  function fmt(s) { const m = Math.floor(s / 60), sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}`; }

  function draw() {
    ensureHost().innerHTML = `
      <button class="rt-btn" data-d="-15">−15</button>
      <div class="rt-mid"><b id="rt-time">${fmt(remaining)}</b><span>Rest</span></div>
      <button class="rt-btn" data-d="15">+15</button>
      <button class="rt-skip" id="rt-skip">Skip</button>`;
    host.querySelectorAll('[data-d]').forEach(b => b.onclick = () => bump(+b.dataset.d));
    host.querySelector('#rt-skip').onclick = stop;
  }

  function tick() {
    remaining--;
    const t = document.getElementById('rt-time');
    if (t) t.textContent = fmt(Math.max(0, remaining));
    if (remaining <= 0) { done(); }
  }

  function done() {
    clearInterval(interval); interval = null;
    beep(); if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    const t = document.getElementById('rt-time'); if (t) t.textContent = 'Go!';
    setTimeout(hide, 1200);
  }

  function start(seconds) {
    if (!seconds) return;
    remaining = seconds;
    ensureHost().classList.remove('hidden');
    draw();
    clearInterval(interval);
    interval = setInterval(tick, 1000);
  }
  function bump(d) { remaining = Math.max(5, remaining + d); const t = document.getElementById('rt-time'); if (t) t.textContent = fmt(remaining); }
  function stop() { clearInterval(interval); interval = null; hide(); }
  function hide() { if (host) host.classList.add('hidden'); }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.42);
    } catch (e) {}
  }

  return { start, stop };
})();
