/* ============================================================
   Macro — stats: strength estimates + extrapolation + program map
   ============================================================ */
window.App = window.App || {};

App.Stats = (function () {
  const { DATA } = App;
  const Store = App.Store, UI = App.UI, W = App.Workout;

  function page(container) {
    const lifts = W.estimatedLifts();
    container.innerHTML = `
      <div class="segment" id="st-seg">
        <button data-seg="strength" class="on">Strength</button>
        <button data-seg="predict">Predict</button>
        <button data-seg="program">Program</button>
      </div>
      <div id="st-body"></div>
    `;
    const body = container.querySelector('#st-body');
    const seg = container.querySelector('#st-seg');
    const show = (which) => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.seg === which));
      if (which === 'strength') strength(body);
      else if (which === 'predict') predict(body);
      else program(body);
    };
    seg.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.seg));
    show('strength');
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

  /* ---------- Program: 8-week map ---------- */
  function program(body) {
    const curWeek = Store.weekFor();
    const rows = [];
    for (let w = 1; w <= 8; w++) {
      const phase = DATA.phaseForWeek(w);
      const main = phase === 1 ? '8–10 reps' : '6–8 reps';
      const acc = phase === 1 ? '10–12' : '12–15';
      rows.push(`
        <div class="list-row">
          <div class="lr-l">
            <b>Week ${w} ${w===curWeek?'<span class="pill accent" style="margin-left:6px">now</span>':''}</b>
            <small>Phase ${phase} · mains ${main} · accessories ${acc}</small>
          </div>
          <div class="pill ${phase===1?'':'orange'}">${phase===1?'Volume':'Heavy'}</div>
        </div>`);
    }
    body.innerHTML = `
      <div class="card">
        <h2 style="margin:4px 0 12px;font-size:17px">8-Week Block · Upper/Lower</h2>
        ${rows.join('')}
      </div>
      <div class="card" style="margin-top:14px;line-height:1.55">
        <b>Weekly split</b>
        <div class="muted" style="margin-top:8px">
          Mon — Upper A (push)<br>Tue — Lower A (squat + punt power)<br>Wed — Rest + eat<br>
          Thu — Upper B (pull)<br>Fri — Lower B (hinge + single leg)<br>Sat — Climb conditioning<br>Sun — Rest + eat
        </div>
      </div>
      <div class="card" style="margin-top:14px;line-height:1.55">
        <b>Why this works for you</b>
        <div class="muted" style="margin-top:8px">Upper-body hypertrophy drives the "ripped in a shirt" look — lateral raises, incline press and pull-ups widen the frame. Plyos keep your legs explosive for punting. Saturday incline/ruck work builds the engine for a 15k climb. Abs every session + a lean-bulk surplus keeps them visible.</div>
      </div>`;
  }

  return { page };
})();
