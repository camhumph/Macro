/* ============================================================
   Macro — weigh-ins: logging, trend chart, auto-adjustment
   ============================================================ */
window.App = window.App || {};

App.Weight = (function () {
  const Store = App.Store, UI = App.UI;

  /* ---------- analysis: weekly rate + target band ---------- */
  function analysis() {
    const logs = Store.get().weightLogs;
    const p = Store.profile();
    const start = logs.length ? logs[0].weight : p.startWeight;
    const latest = logs.length ? logs[logs.length-1].weight : p.startWeight;

    // weekly rate from a 7-day regression-ish: compare avg of last 3 vs prior window
    let weeklyRate = null;
    if (logs.length >= 2) {
      const first = logs[0], last = logs[logs.length-1];
      const days = Store.dayDiff(first.date, last.date) || 1;
      weeklyRate = (last.weight - first.weight) / days * 7;
    }
    // last-7-days rate (more responsive)
    let rate7 = null;
    if (logs.length >= 2) {
      const lastDate = logs[logs.length-1].date;
      const weekAgo = logs.filter(l => Store.dayDiff(l.date, lastDate) >= 6);
      const ref = weekAgo.length ? weekAgo[weekAgo.length-1] : logs[0];
      const days = Store.dayDiff(ref.date, lastDate) || 1;
      rate7 = (logs[logs.length-1].weight - ref.weight) / days * 7;
    }

    // Target band depends on the goal direction (gain / maintain / lose).
    const dir = p.weightDir || 0;
    const want = p.weeklyRate || 0;   // magnitude lb/week
    let status = 'unknown', advice = '';
    const r = rate7 != null ? rate7 : weeklyRate;
    const signed = dir >= 0 ? want : -want;   // expected signed rate
    if (r != null) {
      if (dir === 0) {
        if (Math.abs(r) <= 0.4) { status = 'good'; advice = `Bodyweight is stable (${r >= 0 ? '+' : ''}${r.toFixed(1)} lb/wk), which is on plan for a recomposition. Keep training hard and hold calories.`; }
        else if (r > 0.4) { status = 'high'; advice = `Trending up ${r.toFixed(1)} lb/wk. If you'd rather stay flat, trim ~150–200 cal.`; }
        else { status = 'low'; advice = `Trending down ${Math.abs(r).toFixed(1)} lb/wk. If you'd rather hold, add ~150–200 cal.`; }
      } else if (dir > 0) {
        if (r < want - 0.25) { status = 'low'; advice = `Gaining ${r.toFixed(1)} lb/wk, under your ${want} lb/wk target. Add ~250 cal — extra carbs or a protein shake.`; }
        else if (r > want + 0.6) { status = 'high'; advice = `Gaining ${r.toFixed(1)} lb/wk, faster than your ${want} lb/wk target. Trim ~200–250 cal to keep the gain lean.`; }
        else { status = 'good'; advice = `On target at ${r.toFixed(1)} lb/wk. Hold calories and keep progressing your lifts.`; }
      } else {
        if (-r < want - 0.25) { status = 'low'; advice = `Losing ${Math.abs(r).toFixed(1)} lb/wk, slower than your ${want} lb/wk target. Trim ~200 cal or add activity.`; }
        else if (-r > want + 0.6) { status = 'high'; advice = `Losing ${Math.abs(r).toFixed(1)} lb/wk, faster than your ${want} lb/wk target. Add ~200 cal to protect muscle.`; }
        else { status = 'good'; advice = `On target at ${Math.abs(r).toFixed(1)} lb/wk loss. Keep protein high and lifts heavy to hold muscle.`; }
      }
    } else {
      advice = `Log your weight daily. After about a week the trend tells you whether to adjust calories.`;
    }
    return { start, latest, gained: latest - start, weeklyRate, rate7, status, advice, dir, want, signed };
  }

  // Auto-adjust calories once per week if the trend is off target.
  function maybeAutoAdjust() {
    const a = analysis();
    const week = Store.weekFor();
    const st = Store.get();
    const p = Store.profile();
    if (p.customMacros || st.weightLogs.length < 4 || st.lastAdjustWeek === week) return null;
    if (a.status === 'low' && a.dir >= 0) {
      Store.setProfile({ cal: p.cal + 250, carbs: p.carbs + 60 });
      st.lastAdjustWeek = week; Store.save();
      return `Calories raised to ${Store.profile().cal} (+250) — the trend was under your weight target.`;
    }
    if (a.status === 'low' && a.dir < 0) {
      Store.setProfile({ cal: Math.max(1200, p.cal - 200), carbs: Math.max(0, p.carbs - 50) });
      st.lastAdjustWeek = week; Store.save();
      return `Calories lowered to ${Store.profile().cal} (−200) — fat loss had stalled.`;
    }
    return null;
  }

  /* ---------- page ---------- */
  function page(container) {
    const a = analysis();
    const logged = Store.weightToday();
    const p = Store.profile();

    let banner = '';
    const adj = maybeAutoAdjust();
    if (adj) banner = `<div class="banner warn"><span class="b-ico">⚙️</span><div><b>Plan updated</b>${adj}</div></div>`;

    const days = Store.daysUntilTarget();
    const deltaClass = a.gained > 0 ? 'delta-up' : a.gained < 0 ? 'delta-bad' : '';
    container.innerHTML = `
      ${banner}
      <div class="hero">
        <div class="eyebrow">Bodyweight</div>
        <h1>${a.latest} <span style="font-size:18px;color:var(--muted)">lb</span></h1>
        <p><span class="${deltaClass}">${a.gained>=0?'+':''}${UI.round(a.gained,1)} lb</span> since start · goal ${p.targetWeight} lb</p>
        <div class="countdown">
          <div class="cd-box"><b>${a.rate7!=null?(a.rate7>=0?'+':'')+a.rate7.toFixed(1):'—'}</b><span>lb / week</span></div>
          <div class="cd-box"><b>${p.targetWeight}</b><span>goal lb</span></div>
          <div class="cd-box"><b>${days != null ? days : '—'}</b><span>${days != null ? 'days to target' : 'no target'}</span></div>
        </div>
      </div>

      <button class="btn ${logged?'':'primary'}" id="w-log" style="margin-top:14px">
        ${logged ? `✓ Logged today: ${logged} lb (tap to edit)` : '⚖️ Log this morning\'s weight'}
      </button>

      <div class="section-title"><h2>Trend</h2><span class="muted" style="font-size:12px">${Store.get().weightLogs.length} entries</span></div>
      <div class="card">${chart()}</div>

      <div class="banner ${a.status==='good'?'good':a.status==='unknown'?'info':'warn'}" style="margin-top:14px">
        <span class="b-ico">${a.status==='good'?'✅':a.status==='high'?'🚦':a.status==='low'?'📉':'💡'}</span>
        <div><b>Coach read</b>${a.advice}</div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="list-row" style="border:none;padding:6px 0">
          <div class="lr-l"><b>Reminder to weigh in</b><small>Daily at ${fmtTime(p.weighInTime)} · weigh first thing, after the bathroom</small></div>
        </div>
        <button class="btn small ghost" id="w-cal" style="width:100%">📅 Add daily reminder to iPhone Calendar</button>
      </div>
    `;

    container.querySelector('#w-log').onclick = () => logSheet(container);
    container.querySelector('#w-cal').onclick = () => App.Reminders.downloadICS();
  }

  function logSheet(container) {
    const cur = Store.weightToday() || Store.latestWeight();
    UI.modal(`
      <h2>Morning Weigh-In</h2>
      <p class="muted" style="margin-top:-8px">Weigh yourself right after waking, before eating.</p>
      ${UI.field('Weight (lb)', `<input class="input" id="w-val" type="number" inputmode="decimal" step="0.1" value="${cur}">`)}
      <button class="btn primary" id="w-save">Save</button>
    `, (m) => {
      const inp = m.querySelector('#w-val');
      setTimeout(()=>{ inp.focus(); inp.select(); }, 200);
      m.querySelector('#w-save').onclick = () => {
        const v = parseFloat(inp.value);
        if (!v || v < 50 || v > 500) return UI.toast('Enter a real weight');
        Store.logWeight(v);
        UI.closeModal();
        page(container);
        UI.toast('Weight logged ⚖️','good');
      };
    });
  }

  /* ---------- SVG line chart ---------- */
  function chart() {
    const logs = Store.get().weightLogs;
    const p = Store.profile();
    if (logs.length < 2) {
      return `<div class="empty"><div class="big">📈</div>Log at least 2 days to see your trend line.</div>`;
    }
    const W = 600, H = 200, pad = 30;
    const xs = logs.map(l => new Date(l.date+'T00:00:00').getTime());
    const ys = logs.map(l => l.weight);
    // include goal line into range
    const goal = p.targetWeight || p.startWeight;
    const minY = Math.min(...ys, p.startWeight, goal) - 2;
    const maxY = Math.max(...ys, goal) + 2;
    const minX = xs[0], maxX = xs[xs.length-1] || minX+1;
    const sx = t => pad + (maxX===minX?0:(t-minX)/(maxX-minX))*(W-2*pad);
    const sy = w => H-pad - (w-minY)/(maxY-minY)*(H-2*pad);

    const path = logs.map((l,i) => `${i?'L':'M'}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(' ');
    const area = `${path} L${sx(maxX).toFixed(1)},${H-pad} L${sx(minX).toFixed(1)},${H-pad} Z`;
    const goalY = sy(goal);
    const dots = logs.map((l,i)=>`<circle cx="${sx(xs[i]).toFixed(1)}" cy="${sy(ys[i]).toFixed(1)}" r="3.2" fill="var(--accent)"/>`).join('');

    return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(198,255,58,.28)"/><stop offset="1" stop-color="rgba(198,255,58,0)"/>
      </linearGradient></defs>
      <line x1="${pad}" y1="${goalY}" x2="${W-pad}" y2="${goalY}" stroke="var(--accent-2)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".7"/>
      <text x="${W-pad}" y="${goalY-6}" fill="var(--accent-2)" font-size="11" text-anchor="end">goal ${goal}</text>
      <path d="${area}" fill="url(#wg)"/>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div class="chart-legend"><span><i class="dot" style="background:var(--accent)"></i>Bodyweight</span><span><i class="dot" style="background:var(--accent-2)"></i>${p.targetWeight} lb goal</span></div>`;
  }

  function fmtTime(t) {
    const [h,m] = t.split(':').map(Number);
    const ap = h>=12?'PM':'AM'; const h12 = ((h+11)%12)+1;
    return `${h12}:${String(m).padStart(2,'0')} ${ap}`;
  }

  return { page, analysis, maybeAutoAdjust, fmtTime };
})();
