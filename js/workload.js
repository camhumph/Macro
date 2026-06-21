/* ============================================================
   Macro — ACWR workload monitor (acute:chronic ratio, EWMA)
   Tracks training load to flag overreaching / undertraining,
   per current sports-science (EWMA over rolling 7d vs 28d).
   ============================================================ */
window.App = window.App || {};

App.Workload = (function () {
  const Store = App.Store, UI = App.UI;

  // internal load (arbitrary units) for a saved session
  function loadFor(log) {
    if (!log) return 0;
    if (log.isRun && log.done) {
      const min = (log.actual && log.actual.min) || (log.run ? log.run.miles * 9 : 0);
      const f = { easy:1, long:1.2, tempo:2, interval:3, race:2.2, recovery:0.8 }[log.run && log.run.type] || 1;
      return min * f;
    }
    let vol = 0;
    (log.exercises || []).forEach(ex => (ex.sets || []).forEach(s => { if (s.done) vol += (s.weight * s.reps) || (s.reps * 20) || 0; }));
    return vol / 100;
  }

  function acwr() {
    const st = Store.get();
    const today = new Date();
    let acute = 0, chronic = 0;
    const la = 2 / (7 + 1), lc = 2 / (28 + 1);
    for (let i = 34; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const load = loadFor(st.workoutLogs[Store.todayKey(d)]);
      acute = load * la + acute * (1 - la);
      chronic = load * lc + chronic * (1 - lc);
    }
    const ratio = chronic > 0 ? acute / chronic : 0;
    return { acute: Math.round(acute), chronic: Math.round(chronic), ratio: +ratio.toFixed(2) };
  }

  function zone(r) {
    if (!r) return { label: 'Building baseline', cls: '' };
    if (r < 0.8)  return { label: 'Undertraining', cls: 'info' };
    if (r <= 1.3) return { label: 'Sweet spot', cls: 'good' };
    if (r <= 1.5) return { label: 'Caution', cls: 'warn' };
    return { label: 'High injury risk', cls: 'bad' };
  }

  function card() {
    const a = acwr();
    if (!a.ratio) return '';
    const z = zone(a.ratio);
    const col = a.ratio > 1.5 ? 'var(--bad)' : a.ratio > 1.3 ? 'var(--accent-2)' : 'var(--accent)';
    return `
      <div class="card" style="margin-top:14px">
        <div class="spread"><b>Training load · ACWR</b><span class="pill ${z.cls==='good'?'accent':z.cls==='warn'||z.cls==='bad'?'orange':''}">${a.ratio} · ${z.label}</span></div>
        <div class="bar-track" style="margin-top:10px"><div class="bar-fill" style="width:${UI.clamp(a.ratio/2*100,2,100)}%;background:${col}"></div></div>
        <div class="last-hint">Acute (7-day) ${a.acute} vs chronic (28-day) ${a.chronic} load. Sweet spot 0.8–1.3; ease off above 1.5 to cut injury risk.</div>
      </div>`;
  }

  return { acwr, zone, card };
})();
