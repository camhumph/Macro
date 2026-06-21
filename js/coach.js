/* ============================================================
   Macro — Coach insights
   Synthesizes workload (ACWR), weight trend, adaptive metabolism,
   nutrition adherence and readiness into prioritized guidance.
   ============================================================ */
window.App = window.App || {};

App.Coach = (function () {
  const Store = App.Store, UI = App.UI;

  function strip(s) { return String(s || '').replace(/<\/?b>/g, ''); }

  function avgMacro(field, days) {
    const st = Store.get();
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const arr = st.foodLogs[Store.todayKey(d)] || [];
      const tot = arr.reduce((s, e) => s + (e[field] || 0), 0);
      if (tot > 0) out.push(tot);
    }
    return out.length ? out.reduce((a, b) => a + b, 0) / out.length : null;
  }

  // Ordered list of {icon, tone, title, text}. Highest priority first.
  function insights() {
    const out = [];
    const p = Store.profile();
    const pl = App.Goals.plan();

    // 0) Running guidance first when race training is active
    if (App.Running && App.Running.active()) {
      (App.Running.runInsights() || []).forEach(i => out.push(i));
    }

    // 1) Workload safety (ACWR)
    const a = App.Workload.acwr();
    if (a.ratio > 1.5) out.push({ icon:'🚑', tone:'bad', title:'Back off — load spiked', text:`Your acute:chronic load ratio is ${a.ratio} (high-risk zone). Take an easy day or a deload to dodge injury; ramp back up gradually.` });
    else if (a.ratio && a.ratio < 0.8 && a.chronic > 0) out.push({ icon:'📈', tone:'info', title:'Room to build', text:`Training load is low (${a.ratio}). You can safely add a little volume or intensity this week.` });

    // 2) Weight trend vs goal
    const wa = App.Weight.analysis();
    if (wa.status === 'low') out.push({ icon:'🍽️', tone:'warn', title:'Nutrition tweak', text:strip(wa.advice) });
    else if (wa.status === 'high') out.push({ icon:'⚖️', tone:'warn', title:'Ease the rate', text:strip(wa.advice) });
    else if (wa.status === 'good' && a.ratio <= 1.5) out.push({ icon:'✅', tone:'good', title:'On track', text:strip(wa.advice) });

    // 3) Adaptive metabolism divergence
    const m = App.Adaptive.maintenance();
    if (m) {
      const used = pl.tdee;
      const diff = m.tdee - used;
      if (Math.abs(diff) >= 200 && !pl.adaptive) out.push({ icon:'🧮', tone:'info', title:'Metabolism update', text:`Your data shows maintenance near ${m.tdee} cal (${diff>0?'higher':'lower'} than the estimate). Targets are adjusting to your real numbers.` });
    }

    // 4) Protein adherence (last 7 days)
    const protAvg = avgMacro('protein', 7);
    if (protAvg != null && protAvg < p.protein * 0.85) out.push({ icon:'🥩', tone:'warn', title:'Protein is short', text:`You've averaged ${Math.round(protAvg)}g protein vs a ${p.protein}g target. Anchor every meal with a protein source.` });

    // 5) Hydration
    if ((p.waterGoal || 0) > 0 && Store.water() === 0 && new Date().getHours() >= 12) out.push({ icon:'💧', tone:'info', title:'Hydrate', text:`No water logged yet today. Aim for ${p.waterGoal} cups — it supports performance and recovery.` });

    // 6) Weigh-in nudge (keeps adaptive targets accurate)
    if (Store.weightToday() == null) out.push({ icon:'⚖️', tone:'info', title:'Weigh in', text:'Log today\'s weight so your adaptive targets stay accurate.' });

    if (!out.length) out.push({ icon:'💪', tone:'good', title:'Dialed in', text:'Everything looks on track. Show up, log your work, and progress where you can.' });
    return out.slice(0, 4);
  }

  function card() {
    const list = insights();
    return `
      <div class="section-title"><h2>Coach</h2></div>
      <div class="card" style="padding:6px 16px">
        ${list.map((x, i) => `
          <div class="coach-row ${i ? 'div' : ''}">
            <div class="coach-ic ${x.tone}">${x.icon}</div>
            <div class="coach-tx"><b>${UI.esc(x.title)}</b><small>${UI.esc(x.text)}</small></div>
          </div>`).join('')}
      </div>`;
  }

  return { insights, card };
})();
