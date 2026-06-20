/* ============================================================
   Macro — Compete: leaderboard, streaks, levels, achievements
   Pure metric functions operate on any profile's state object,
   so the leaderboard can rank every profile on the device.
   ============================================================ */
window.App = window.App || {};

App.Leaderboard = (function () {
  const Store = App.Store, UI = App.UI;

  /* ---------- metric primitives ---------- */
  function epley(w, r) { return w * (1 + Math.min(r, 12) / 30); }
  function fmt(d) { return Store.todayKey(d); }

  function histFrom(st, key) {
    const out = [];
    Object.values(st.workoutLogs || {}).forEach(log =>
      (log.exercises || []).forEach(ex => {
        if (ex.key !== key) return;
        (ex.sets || []).forEach(s => { if (s.done && s.weight > 0 && s.reps > 0) out.push({ weight:+s.weight, reps:+s.reps }); });
      }));
    return out;
  }
  function best1RM(st, key) { let b = 0; histFrom(st, key).forEach(h => { const e = epley(h.weight, h.reps); if (e > b) b = e; }); return b; }

  function sessionDates(st) {
    return Object.keys(st.workoutLogs || {})
      .filter(dk => (st.workoutLogs[dk].exercises || []).some(ex => (ex.sets || []).some(s => s.done)))
      .sort();
  }
  function totalSets(st) {
    let n = 0;
    Object.values(st.workoutLogs || {}).forEach(log => (log.exercises || []).forEach(ex => (ex.sets || []).forEach(s => { if (s.done) n++; })));
    return n;
  }
  function volume(st) {
    let v = 0;
    Object.values(st.workoutLogs || {}).forEach(log => (log.exercises || []).forEach(ex => (ex.sets || []).forEach(s => { if (s.done && s.weight > 0 && s.reps > 0) v += s.weight * s.reps; })));
    return Math.round(v);
  }
  function strengthScore(st) {
    const bench = Math.max(best1RM(st, 'flatBench'), best1RM(st, 'inclineBB') / 0.82 || 0);
    const squat = Math.max(best1RM(st, 'squat'), best1RM(st, 'frontSquat') / 0.85 || 0);
    return Math.round(bench + squat + best1RM(st, 'ohp') + best1RM(st, 'bbRow') + best1RM(st, 'rdl'));
  }
  function streakOf(dates) {
    const set = new Set(dates);
    let cur = new Date(), streak = 0;
    if (!set.has(fmt(cur))) { cur.setDate(cur.getDate() - 1); if (!set.has(fmt(cur))) return 0; }
    while (set.has(fmt(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    return streak;
  }
  function goalPct(st) {
    const start = st.profile.startWeight;
    const goal = start + (st.profile.goalGain || 10);
    const cur = st.weightLogs.length ? st.weightLogs[st.weightLogs.length - 1].weight : start;
    const denom = (goal - start) || 1;
    return UI.clamp(Math.round((cur - start) / denom * 100), 0, 100);
  }

  function metrics(st) {
    return {
      sessions: sessionDates(st).length,
      gymStreak: streakOf(sessionDates(st)),
      weighStreak: streakOf((st.weightLogs || []).map(w => w.date)),
      volume: volume(st),
      strength: strengthScore(st),
      goalPct: goalPct(st),
      sets: totalSets(st),
    };
  }

  /* ---------- level / XP ---------- */
  function xpOf(st) {
    const m = metrics(st);
    return Math.round(m.sessions * 120 + m.sets * 6 + m.volume / 120 + m.strength * 1.5 + m.weighStreak * 20);
  }
  function levelOf(st) {
    const xp = xpOf(st);
    let lvl = 1, need = 500, acc = 0;
    while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.35); }
    return { level: lvl, xp, into: xp - acc, need, pct: UI.clamp(Math.round((xp - acc) / need * 100), 0, 100) };
  }

  /* ---------- achievements ---------- */
  const RANK_TITLES = ['Rookie','Grinder','Lifter','Beast','Savage','Animal','Machine','Legend'];
  function rankTitle(lvl) { return RANK_TITLES[Math.min(lvl - 1, RANK_TITLES.length - 1)]; }

  function achievements(st) {
    const m = metrics(st);
    const bw = st.weightLogs.length ? st.weightLogs[st.weightLogs.length - 1].weight : st.profile.startWeight;
    const bench = Math.max(best1RM(st, 'flatBench'), best1RM(st, 'inclineBB'));
    const squat = best1RM(st, 'squat');
    const hasPhoto = Object.values(st.foodLogs || {}).some(arr => (arr || []).some(e => e.photo));
    const def = [
      { id:'first',  icon:'🎬', name:'First Rep',      desc:'Log your first set',        ok:m.sets >= 1 },
      { id:'s10',    icon:'🏋️', name:'Showing Up',      desc:'10 gym sessions',           ok:m.sessions >= 10, prog:[m.sessions,10] },
      { id:'s25',    icon:'💼', name:'Committed',       desc:'25 gym sessions',           ok:m.sessions >= 25, prog:[m.sessions,25] },
      { id:'str3',   icon:'🔥', name:'On a Roll',       desc:'3-day gym streak',          ok:m.gymStreak >= 3, prog:[m.gymStreak,3] },
      { id:'str7',   icon:'🔥', name:'Unstoppable',     desc:'7-day gym streak',          ok:m.gymStreak >= 7, prog:[m.gymStreak,7] },
      { id:'sets100',icon:'💯', name:'Century Club',    desc:'100 total sets',            ok:m.sets >= 100, prog:[m.sets,100] },
      { id:'vol10k', icon:'🏗️', name:'Heavy Hauler',    desc:'10,000 lb lifted',          ok:m.volume >= 10000, prog:[m.volume,10000] },
      { id:'vol50k', icon:'🦾', name:'Tonnage',         desc:'50,000 lb lifted',          ok:m.volume >= 50000, prog:[m.volume,50000] },
      { id:'benchbw',icon:'🅱️', name:'Bench Bodyweight',desc:'Bench ≥ your bodyweight',   ok:bench >= bw && bench > 0 },
      { id:'sq15',   icon:'🦵', name:'Squat 1.5×',      desc:'Squat ≥ 1.5× bodyweight',   ok:squat >= bw * 1.5 && squat > 0 },
      { id:'weigh7', icon:'⚖️', name:'Weigh-In Warrior',desc:'7-day weigh-in streak',     ok:m.weighStreak >= 7, prog:[m.weighStreak,7] },
      { id:'scan',   icon:'🏷️', name:'Label Detective', desc:'Save a scanned food',       ok:(st.pantry||[]).length >= 1 },
      { id:'photo',  icon:'📸', name:'Food Blogger',    desc:'Log a meal photo',          ok:hasPhoto },
      { id:'goal',   icon:'🏆', name:'Goal Crusher',    desc:'Reach your goal weight',    ok:m.goalPct >= 100 },
    ];
    return def;
  }

  /* ---------- metric definitions for the leaderboard toggle ---------- */
  const METRICS = [
    { key:'sessions', label:'Sessions', unit:'sessions', icon:'🏋️' },
    { key:'gymStreak',label:'Streak',   unit:'day streak', icon:'🔥' },
    { key:'strength', label:'Strength', unit:'lb total 1RM', icon:'💪' },
    { key:'volume',   label:'Volume',   unit:'lb lifted', icon:'🏗️' },
    { key:'goalPct',  label:'Goal',     unit:'% to goal', icon:'🎯' },
  ];
  function rankAll(metricKey) {
    return Store.allProfilesData()
      .map(p => ({ ...p, m: metrics(p.state) }))
      .map(p => ({ ...p, val: p.m[metricKey] }))
      .sort((a, b) => b.val - a.val);
  }

  /* ---------- streak card (dashboard) ---------- */
  function streakCard() {
    const st = Store.get();
    const m = metrics(st), lv = levelOf(st);
    return `
    <div class="card" style="margin-top:14px">
      <div class="spread">
        <div class="row" style="gap:10px">
          <div class="lvl-badge" style="background:${st.profile.color}">${lv.level}</div>
          <div><b style="font-size:15px">${rankTitle(lv.level)}</b><div class="muted" style="font-size:12px">Level ${lv.level} · ${lv.xp.toLocaleString()} XP</div></div>
        </div>
        <div class="row" style="gap:14px">
          <div class="center"><div style="font-size:20px;font-weight:800">${m.gymStreak}🔥</div><div class="muted" style="font-size:10px">GYM</div></div>
          <div class="center"><div style="font-size:20px;font-weight:800">${m.sessions}</div><div class="muted" style="font-size:10px">SESSIONS</div></div>
        </div>
      </div>
      <div class="bar-track" style="margin-top:12px"><div class="bar-fill" style="width:${lv.pct}%;background:linear-gradient(90deg,${st.profile.color},var(--accent-2))"></div></div>
      <div class="spread" style="margin-top:6px"><span class="muted" style="font-size:11px">${lv.into.toLocaleString()} / ${lv.need.toLocaleString()} XP</span><button class="link" id="streak-compete" style="font-size:12px;color:var(--accent);font-weight:600">Leaderboard ▸</button></div>
    </div>`;
  }

  /* ---------- Compete view (Stats segment) ---------- */
  let curMetric = 'sessions';
  function render(container) {
    const st = Store.get();
    const lv = levelOf(st);
    const ranks = rankAll(curMetric);
    const meta = METRICS.find(x => x.key === curMetric);
    const meId = Store.activeId();
    const ach = achievements(st);
    const got = ach.filter(a => a.ok).length;

    container.innerHTML = `
      <div class="hero">
        <div class="eyebrow">${rankTitle(lv.level)} · Level ${lv.level}</div>
        <h1>${lv.xp.toLocaleString()} <span style="font-size:16px;color:var(--muted)">XP</span></h1>
        <div class="bar-track" style="margin-top:12px"><div class="bar-fill" style="width:${lv.pct}%;background:linear-gradient(90deg,${st.profile.color},var(--accent-2))"></div></div>
        <p style="margin-top:8px">${(lv.need - lv.into).toLocaleString()} XP to level ${lv.level + 1}</p>
      </div>

      <div class="section-title"><h2>Leaderboard</h2><button class="link" id="lb-add">+ Add friend</button></div>
      <div class="segment" id="lb-seg">${METRICS.map(x => `<button data-m="${x.key}" class="${x.key === curMetric ? 'on' : ''}">${x.label}</button>`).join('')}</div>
      <div class="card" style="padding:6px 16px">
        ${ranks.map((p, i) => `
          <div class="lb-row ${p.id === meId ? 'me' : ''}">
            <div class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</div>
            <div class="lb-av" style="background:${p.meta.color}">${p.meta.emoji}</div>
            <div class="lb-name"><b>${UI.esc(p.meta.name)}${p.id === meId ? ' <span class="muted" style="font-weight:500">(you)</span>' : ''}</b><small>${rankTitle(levelOf(p.state).level)}</small></div>
            <div class="lb-val">${(p.val || 0).toLocaleString()}<small>${meta.unit}</small></div>
          </div>`).join('')}
      </div>
      <p class="muted center" style="font-size:12px;margin-top:10px">Compete with friends by adding their shared profile. <button class="link" id="lb-share" style="color:var(--accent)">Share yours ▸</button></p>

      <div class="section-title"><h2>Achievements</h2><span class="muted" style="font-size:12px">${got}/${ach.length}</span></div>
      <div class="badge-grid">
        ${ach.map(a => `
          <div class="badge ${a.ok ? 'on' : ''}">
            <div class="badge-ic">${a.ok ? a.icon : '🔒'}</div>
            <b>${a.name}</b><small>${a.desc}</small>
            ${(!a.ok && a.prog) ? `<div class="bar-track" style="margin-top:6px;height:4px"><div class="bar-fill" style="width:${UI.clamp(a.prog[0]/a.prog[1]*100,0,100)}%;background:var(--accent)"></div></div>` : ''}
          </div>`).join('')}
      </div>
    `;

    container.querySelectorAll('#lb-seg button').forEach(b => b.onclick = () => { curMetric = b.dataset.m; render(container); });
    container.querySelector('#lb-add').onclick = () => App.Profiles.addFriend();
    container.querySelector('#lb-share').onclick = () => App.Profiles.shareProfile();
  }

  return { metrics, levelOf, rankTitle, achievements, streakCard, render, METRICS, strengthScore };
})();
