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
      <div class="segment" id="st-seg">
        <button data-seg="strength">Strength</button>
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
      else if (which === 'predict') predict(body);
      else if (which === 'compete') App.Leaderboard.render(body);
      else program(body);
    };
    seg.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.seg));
    show(startSeg);
    startSeg = 'strength';
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
      ${lifts.map(l => `
        <div class="card" style="margin-bottom:12px">
          <div class="spread">
            <b style="font-size:16px">${UI.esc(l.name)}</b>
            <div class="pill accent">${UI.round(l.oneRM)} lb 1RM</div>
          </div>
          <div class="grid-2" style="margin-top:12px">
            ${repTile('5 reps', l.e5)}${repTile('8 reps', l.e8)}
            ${repTile('10 reps', l.e10)}${repTile('12 reps', l.e12)}
          </div>
          <div class="last-hint">Best set: ${l.from.weight} lb × ${l.from.reps}</div>
        </div>`).join('')}
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
