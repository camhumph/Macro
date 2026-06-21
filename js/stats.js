/* ============================================================
   Macro — stats: strength estimates + extrapolation + program map
   ============================================================ */
window.App = window.App || {};

App.Stats = (function () {
  const { DATA } = App;
  const Store = App.Store, UI = App.UI, W = App.Workout;

  let startSeg = 'strength';
  function open(seg) { startSeg = seg; App.Router.go('stats'); }

  function page(container) {
    container.innerHTML = `
      <div class="segment scroll" id="st-seg">
        <button data-seg="strength">Strength</button>
        <button data-seg="history">History</button>
        <button data-seg="predict">Predict</button>
        <button data-seg="compete">Compete</button>
        <button data-seg="program">Plan</button>
      </div>
      <div id="st-body"></div>
    `;
    const body = container.querySelector('#st-body');
    const seg = container.querySelector('#st-seg');
    const show = (which) => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.seg === which));
      if (which === 'strength') strength(body);
      else if (which === 'history') history(body);
      else if (which === 'predict') predict(body);
      else if (which === 'compete') App.Leaderboard.render(body);
      else program(body);
    };
    seg.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.seg));
    show(startSeg);
    startSeg = 'strength';
  }

  /* ---------- strength standards (1RM / bodyweight) → rank ---------- */
  const RANKS = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
  // male thresholds (1RM ÷ bodyweight) for Beginner..Elite
  const STD = {
    bench:   [0.5, 0.75, 1.0, 1.5, 2.0],
    incline: [0.4, 0.6, 0.85, 1.25, 1.7],
    squat:   [0.75, 1.25, 1.5, 2.0, 2.75],
    front:   [0.6, 1.0, 1.3, 1.75, 2.3],
    ohp:     [0.35, 0.55, 0.8, 1.1, 1.5],
    row:     [0.5, 0.7, 0.95, 1.25, 1.6],
    rdl:     [1.0, 1.4, 1.75, 2.25, 2.75],
  };
  const STD_OF = { flatBench:'bench', inclineBB:'incline', squat:'squat', frontSquat:'front', ohp:'ohp', bbRow:'row', rdl:'rdl' };
  function rankFor(key, oneRM) {
    const s = STD[STD_OF[key]]; if (!s) return null;
    const bw = Store.latestWeight() || 1;
    const female = Store.profile().sex === 'female';
    const ratio = oneRM / bw;
    let idx = 0;
    s.forEach((th, i) => { const t = female ? th * 0.72 : th; if (ratio >= t) idx = i + 1; });
    const next = idx < 5 ? (female ? s[idx] * 0.72 : s[idx]) : null;
    return { name: RANKS[idx], idx, ratio, nextRatio: next };
  }

  /* ---------- Strength: estimated 1RM table ---------- */
  function strength(body) {
    const lifts = W.estimatedLifts();
    if (!lifts.length) {
      body.innerHTML = `<div class="empty"><div class="big">🏋️</div>Log a few working sets and your estimated maxes appear here automatically.</div>`;
      return;
    }
    body.innerHTML = `
      <p class="muted" style="margin:4px 2px 14px;font-size:13px">Estimated 1-rep max (Epley) from your best logged set, plus what you should be able to hit at each rep range.</p>
      ${lifts.map(l => {
        const rk = rankFor(l.key, l.oneRM);
        return `
        <div class="card" style="margin-bottom:12px">
          <div class="spread">
            <b style="font-size:16px">${UI.esc(l.name)}</b>
            <div class="pill accent">${UI.round(l.oneRM)} lb 1RM</div>
          </div>
          ${rk ? `<div class="rank-bar">
            <div class="spread" style="margin-bottom:6px"><span class="rank-chip rk${rk.idx}">${rk.name}</span><span class="muted" style="font-size:12px">${(rk.ratio).toFixed(2)}× bodyweight</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${UI.clamp(rk.idx/5*100,4,100)}%;background:var(--accent)"></div></div>
            ${rk.nextRatio ? `<div class="last-hint">${UI.round(rk.nextRatio*(Store.latestWeight()||1))} lb 1RM for ${RANKS[rk.idx+1]}</div>` : `<div class="last-hint suggest">Elite — top tier 💪</div>`}
          </div>` : ''}
          ${sparkline(l.key)}
          <div class="grid-2" style="margin-top:12px">
            ${repTile('5 reps', l.e5)}${repTile('8 reps', l.e8)}
            ${repTile('10 reps', l.e10)}${repTile('12 reps', l.e12)}
          </div>
          <div class="last-hint">Best set: ${l.from.weight} lb × ${l.from.reps}</div>
        </div>`;
      }).join('')}
    `;
  }

  // Estimated-1RM over time for a lift (best per day) → mini sparkline.
  function liftSeries(key) {
    const byDate = {};
    Store.exerciseHistory(key).forEach(h => {
      const e = h.weight * (1 + Math.min(h.reps, 12) / 30);
      if (!byDate[h.date] || e > byDate[h.date]) byDate[h.date] = e;
    });
    return Object.keys(byDate).sort().map(d => ({ date: d, e: byDate[d] }));
  }
  function sparkline(key) {
    const s = liftSeries(key);
    if (s.length < 2) return '';
    const W = 300, H = 46, pad = 4;
    const ys = s.map(p => p.e), min = Math.min(...ys), max = Math.max(...ys);
    const span = (max - min) || 1;
    const x = i => pad + i / (s.length - 1) * (W - 2 * pad);
    const y = v => H - pad - (v - min) / span * (H - 2 * pad);
    const path = s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.e).toFixed(1)}`).join(' ');
    const up = ys[ys.length - 1] >= ys[0];
    return `<div style="margin-top:12px">
      <div class="spread"><span class="muted" style="font-size:12px">Est. 1RM trend</span><span class="${up?'delta-up':'delta-bad'}" style="font-size:12px">${up?'▲':'▼'} ${UI.round(ys[0])}→${UI.round(ys[ys.length-1])} lb</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:46px;margin-top:4px"><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>
    </div>`;
  }

  /* ---------- History: past sessions ---------- */
  function history(body) {
    const logs = Store.allWorkoutLogs();
    if (!logs.length) {
      body.innerHTML = `<div class="empty"><div class="big">📚</div>Your completed workouts will show up here.</div>`;
      return;
    }
    const fmtDate = dk => { const d = new Date(dk + 'T00:00:00'); return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }); };
    body.innerHTML = `
      <p class="muted" style="margin:4px 2px 14px;font-size:13px">${logs.length} session${logs.length>1?'s':''} logged.</p>
      ${logs.map(log => {
        const doneSets = (log.exercises||[]).flatMap(ex => (ex.sets||[]).filter(s => s.done).map(s => ({ ...s, name:ex.name })));
        const vol = doneSets.reduce((v, s) => v + (s.weight*s.reps||0), 0);
        const prs = doneSets.filter(s => s.pr).length;
        const tops = (log.exercises||[]).filter(ex => ex.sets.some(s=>s.done)).map(ex => {
          const best = ex.sets.filter(s=>s.done).sort((a,b)=>(b.weight*b.reps)-(a.weight*a.reps))[0];
          return best ? `${ex.name} ${best.weight}×${best.reps}` : ex.name;
        });
        return `
        <div class="card" style="margin-bottom:12px">
          <div class="spread">
            <b>${UI.esc(log.dayName || 'Workout')}</b>
            <span class="muted" style="font-size:12px">${fmtDate(log.dateKey)}</span>
          </div>
          <div class="row" style="gap:14px;margin:8px 0 6px">
            <span class="pill">${doneSets.length} sets</span>
            <span class="pill">${UI.round(vol).toLocaleString()} lb volume</span>
            ${prs ? `<span class="pill accent">🏆 ${prs} PR${prs>1?'s':''}</span>` : ''}
          </div>
          <div class="last-hint">${tops.slice(0,6).map(UI.esc).join(' · ')}</div>
        </div>`;
      }).join('')}
    `;
  }
  function repTile(label, v) {
    return `<div class="stat-tile"><div class="v">${UI.round(v)}<span style="font-size:13px;color:var(--muted)"> lb</span></div><div class="l">${label}</div></div>`;
  }

  /* ---------- Predict: cross-exercise extrapolation ---------- */
  function predict(body) {
    const opts = Object.keys(DATA.RATIOS).map(k => `<option value="${k}">${UI.esc(DATA.RATIOS[k].name)}</option>`).join('');
    body.innerHTML = `
      <div class="card">
        <p class="muted" style="margin:0 0 14px;font-size:13px">Pick a lift you <b>haven't maxed</b> — Macro extrapolates it from your other logged lifts using strength ratios.</p>
        ${UI.field('Exercise', `<select class="input" id="pr-ex">${opts}</select>`)}
        ${UI.field('Target reps', `<input class="input" id="pr-reps" type="number" inputmode="numeric" value="8" min="1" max="15">`)}
        <button class="btn primary" id="pr-go">Estimate</button>
      </div>
      <div id="pr-out" style="margin-top:14px"></div>
    `;
    const out = body.querySelector('#pr-out');
    const run = () => {
      const key = body.querySelector('#pr-ex').value;
      const reps = UI.clamp(+body.querySelector('#pr-reps').value || 8, 1, 15);
      const r = W.predict(key, reps);
      if (!r) {
        out.innerHTML = `<div class="banner info"><span class="b-ico">💡</span><div>Not enough data yet. Log some pressing/squatting sets first — then I can predict this lift.</div></div>`;
        return;
      }
      out.innerHTML = `
        <div class="hero">
          <div class="eyebrow">${UI.esc(DATA.RATIOS[key].name)}</div>
          <h1>${UI.round(r.working/2.5)*2.5 || UI.round(r.working)} <span style="font-size:18px;color:var(--muted)">lb × ${reps}</span></h1>
          <p>Estimated ${UI.round(r.oneRM)} lb 1RM · based on ${UI.esc(r.basis)}</p>
        </div>
        <div class="last-hint" style="margin-top:10px;padding:0 4px">Start a little under this and earn the rest. Confirm it next time you train the lift.</div>`;
    };
    body.querySelector('#pr-go').onclick = run;
    run();
  }

  /* ---------- Plan: goals, nutrition, weight goal, split ---------- */
  function program(body) {
    const G = App.Goals;
    const pl = G.plan();
    const sched = DATA.buildSchedule(pl.split, pl.days, pl.cardio);
    const dayName = dt => dt === 'rest' ? 'Rest' : DATA.DAYS[dt].name;
    const labels = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 0:'Sun' };
    const order = [1,2,3,4,5,6,0];
    const volTarget = pl.bias === 'strength' ? '4–6 hard sets per movement per week' : '10–20 hard sets per muscle per week';

    body.innerHTML = `
      ${G.planSummary(pl)}
      <div style="margin-top:14px">${G.guideCard(pl)}</div>

      <div class="card" style="margin-top:14px;line-height:1.5">
        <div class="spread"><b>${pl.splitName} · ${pl.days}×/week</b><span class="muted" style="font-size:12px">${G.biasLabel(pl.bias)}</span></div>
        <div style="margin-top:10px">
          ${order.map(d => `<div class="list-row" style="padding:9px 0"><div class="lr-l"><b>${labels[d]}</b></div><span class="muted">${dayName(sched[d])}</span></div>`).join('')}
        </div>
      </div>

      <div class="card" style="margin-top:14px;line-height:1.55">
        <b>How it's programmed</b>
        <ul class="guide-list">
          <li>Volume target: <b>${volTarget}</b>; cap ~6–8 hard sets per muscle in any one session to avoid junk volume.</li>
          <li>Big multi-joint lifts go first, while you're fresh, for the most strength carryover.</li>
          <li>Antagonist movements are paired into supersets to save time and lift output.</li>
          <li>Stretch-focused exercises load the muscle at long lengths; add lengthened partials past failure where flagged.</li>
          <li>Train each muscle ~2× per week and progress weight or reps when you hit the top of the range.</li>
        </ul>
      </div>

      <button class="btn" id="plan-edit" style="margin-top:14px">Change goals, split & nutrition</button>
    `;
    const e = body.querySelector('#plan-edit');
    if (e) e.onclick = () => App.openSettings();
  }

  return { page, open };
})();
