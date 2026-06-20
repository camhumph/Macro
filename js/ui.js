/* ============================================================
   Macro — shared UI helpers
   ============================================================ */
window.App = window.App || {};

App.UI = (function () {

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function round(n, d) { const p = Math.pow(10, d||0); return Math.round((+n||0)*p)/p; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    const host = document.getElementById('toast-host');
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' '+kind : '');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.style.transition='opacity .3s'; t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 1900);
  }

  /* ---------- Modal (bottom sheet) ---------- */
  function modal(innerHTML, onMount) {
    const host = document.getElementById('modal-host');
    host.innerHTML = `<div class="modal"><div class="modal-grip"></div>${innerHTML}</div>`;
    host.classList.remove('hidden');
    const close = () => closeModal();
    host.onclick = (e) => { if (e.target === host) close(); };
    if (onMount) onMount(host.querySelector('.modal'), close);
    return close;
  }
  function closeModal() {
    const host = document.getElementById('modal-host');
    host.classList.add('hidden');
    host.innerHTML = '';
    host.onclick = null;
  }

  /* ---------- SVG progress ring ---------- */
  function ring(value, max, label, sub, color) {
    color = color || 'var(--accent)';
    const r = 54, c = 2*Math.PI*r;
    const pct = clamp(max>0 ? value/max : 0, 0, 1.18); // allow slight overflow look
    const dash = Math.min(pct,1) * c;
    const over = value > max;
    return `
    <div class="ring">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--card-2)" stroke-width="12"/>
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="${over?'var(--accent-2)':color}" stroke-width="12"
          stroke-linecap="round" stroke-dasharray="${dash} ${c}" />
      </svg>
      <div class="ring-center">
        <b>${label}</b>
        <small>${sub||''}</small>
      </div>
    </div>`;
  }

  /* ---------- macro bar ---------- */
  function macroBar(name, value, target, color) {
    const pct = clamp(target>0 ? (value/target)*100 : 0, 0, 100);
    return `
    <div class="macro-bar">
      <div class="spread"><b>${name}</b><span>${round(value)} / ${round(target)} g</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }

  /* ---------- bottom-sheet form helpers ---------- */
  function field(label, inputHTML) {
    return `<div class="field"><label>${label}</label>${inputHTML}</div>`;
  }

  return { esc, round, clamp, toast, modal, closeModal, ring, macroBar, field };
})();
