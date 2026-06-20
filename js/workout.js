/* ============================================================
   Macro — workout generation, logging, strength extrapolation
   ============================================================ */
window.App = window.App || {};

App.Workout = (function () {
  const { DATA } = App;
  const Store = App.Store, UI = App.UI;

  /* ---------- build today's session ---------- */
  function build(dateKey) {
    dateKey = dateKey || Store.todayKey();
    const existing = Store.workoutLog(dateKey);
    const week = Store.weekFor(dateKey);
    const phase = DATA.phaseForWeek(week);
    const dow = new Date(dateKey + 'T00:00:00').getDay();
    const dayType = DATA.SCHEDULE[dow];
    const day = DATA.DAYS[dayType];

    if (existing && existing.dayType === dayType) return existing;

    const exercises = day.exercises.map(ex => {
      const scheme = DATA.repScheme(ex.type, phase);
      const reps = ex.reps || scheme.reps;
      const setCount = ex.sets || 3;
      const hist = Store.exerciseHistory(ex.key);
      let suggest = '', lastNote = null;
      if (hist.length) {
        const last = hist[0];
        lastNote = `Last: ${last.weight} lb × ${last.reps}`;
        suggest = last.weight;
        if (scheme.high && last.reps >= scheme.high) suggest = +last.weight + 5; // progressive overload
      }
      return {
        key: ex.key, name: ex.name, type: ex.type, reps, suggest, lastNote,
        sets: Array.from({ length: setCount }, () => ({ weight: suggest, reps: '', done: false }))
      };
    });

    return { dateKey, week, phase, dayType, dayName: day.name, exercises };
  }

  let current = null;

  function persist() { if (current) Store.saveWorkout(current.dateKey, current); }

  /* ---------- render the session into a container ---------- */
  function render(container, dateKey) {
    current = build(dateKey);
    const isTraining = current.dayType !== 'rest';

    if (!isTraining) {
      container.innerHTML = restCard();
      return;
    }

    const phaseLabel = current.phase === 1 ? 'Phase 1 · Volume' : 'Phase 2 · Heavy Overload';
    let html = `
      <div class="spread" style="margin-bottom:12px">
        <div>
          <div class="pill accent">Week ${current.week} / 8</div>
          <div class="pill orange" style="margin-left:6px">${phaseLabel}</div>
        </div>
        <button class="btn small ghost" id="wk-coach">Coach ▸</button>
      </div>
      <h2 style="margin:4px 2px 14px;font-size:21px;letter-spacing:-.4px">${UI.esc(current.dayName)}</h2>
    `;

    current.exercises.forEach((ex, i) => { html += exerciseCard(ex, i); });

    const done = current.exercises.every(ex => ex.sets.some(s => s.done) || ex.type === 'cond');
    html += `<button class="btn ${done ? 'primary' : ''}" id="wk-finish" style="margin-top:6px">${done ? '✓ Session Logged — Nice Work' : 'Finish & Save Session'}</button>`;

    container.innerHTML = html;
    wire(container);
  }

  function exerciseCard(ex, i) {
    const tagClass = ex.type === 'plyo' ? 'plyo' : ex.type === 'abs' ? 'abs' : ex.type === 'main' ? 'main' : '';
    const tagText = ex.type === 'plyo' ? 'Power' : ex.type === 'abs' ? 'Core' : ex.type === 'main' ? 'Main' : ex.type === 'cond' ? 'Cond' : 'Accessory';
    const cardDone = ex.sets.some(s => s.done);
    const setCount = ex.sets.length;

    let inner;
    if (ex.type === 'cond') {
      inner = `
        <div class="set-row" style="margin-top:12px">
          <button class="check ${ex.sets[0].done ? 'on' : ''}" data-ex="${i}" data-set="0">
            <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
          </button>
          <div class="ex-meta" style="margin:0">${UI.esc(ex.reps)}</div>
        </div>`;
    } else {
      inner = ex.sets.map((s, si) => `
        <div class="set-row">
          <div class="set-no">${si + 1}</div>
          <div class="mini"><input type="number" inputmode="decimal" placeholder="${ex.suggest || '—'}" value="${s.weight !== '' ? s.weight : ''}" data-ex="${i}" data-set="${si}" data-fld="weight"><span>lb</span></div>
          <div class="mini"><input type="number" inputmode="numeric" placeholder="reps" value="${s.reps !== '' ? s.reps : ''}" data-ex="${i}" data-set="${si}" data-fld="reps"><span>×</span></div>
          <button class="check ${s.done ? 'on' : ''}" data-ex="${i}" data-set="${si}">
            <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
          </button>
        </div>`).join('');
    }

    return `
    <div class="ex-card ${cardDone ? 'done' : ''}">
      <div class="ex-head">
        <div>
          <h3>${UI.esc(ex.name)}</h3>
          <div class="ex-meta">${ex.type === 'cond' ? '' : setCount + ' sets × '} ${UI.esc(ex.reps)}</div>
        </div>
        <span class="ex-tag ${tagClass}">${tagText}</span>
      </div>
      ${inner}
      ${ex.lastNote ? `<div class="last-hint">${UI.esc(ex.lastNote)} · <span class="suggest">target ${ex.suggest || '—'} lb</span></div>` : (ex.type !== 'cond' ? `<div class="last-hint">First time — log it to start tracking.</div>` : '')}
    </div>`;
  }

  function restCard() {
    const climb = Store.daysUntilClimb();
    return `
    <div class="card center" style="padding:30px 18px">
      <div style="font-size:46px">😮‍💨</div>
      <h2 style="margin:10px 0 4px">Rest & Recover</h2>
      <p class="muted" style="margin:0 0 14px">No lifting today. Growth happens now — <b>so does eating.</b> Hit your 3,200 and sleep 8+ hrs.</p>
      <div class="pill accent">${climb} days to the climb</div>
      <p class="muted" style="font-size:13px;margin-top:16px">Optional: 20–30 min easy walk or mobility. Keep it light — don't burn the calories you're packing on.</p>
    </div>`;
  }

  /* ---------- events ---------- */
  function wire(container) {
    container.querySelectorAll('input[data-fld]').forEach(inp => {
      inp.addEventListener('input', () => {
        const ex = current.exercises[+inp.dataset.ex];
        ex.sets[+inp.dataset.set][inp.dataset.fld] = inp.value === '' ? '' : +inp.value;
        persist();
      });
    });
    container.querySelectorAll('.check').forEach(btn => {
      btn.addEventListener('click', () => {
        const ex = current.exercises[+btn.dataset.ex];
        const set = ex.sets[+btn.dataset.set];
        set.done = !set.done;
        if (set.done) {
          if (set.weight === '' && ex.suggest) set.weight = ex.suggest;
          if (set.reps === '' && ex.type !== 'cond') {
            const m = String(ex.reps).match(/\d+/); set.reps = m ? +m[0] : 10;
          }
        }
        persist();
        render(container, current.dateKey); // re-render to update done styling
        if (set.done) UI.toast('Set logged 💪', 'good');
      });
    });
    const finish = container.querySelector('#wk-finish');
    if (finish) finish.addEventListener('click', () => {
      persist();
      UI.toast('Session saved. Stats updated.', 'good');
      App.Router.go('today');
    });
    const coach = container.querySelector('#wk-coach');
    if (coach) coach.addEventListener('click', coachSheet);
  }

  function coachSheet() {
    const phase = current.phase;
    const msg = phase === 1
      ? `<b>Phase 1 — Volume & Adaptation (Wk 1–4)</b><br>Find your 8–10 rep weights. Every week add <b>2.5–5 lb</b> OR <b>1–2 reps</b>. Box jumps stay low (3×3) so you don't fry your CNS. Hammer lateral raises, incline press & pull-ups — wide shoulders + thick upper chest = the illusion of size even lean.`
      : `<b>Phase 2 — Heavy Overload (Wk 5–8)</b><br>Main compounds drop to <b>6–8 reps</b> — load the plates, chase mechanical tension. Keep curls, triceps & laterals at 12–15 for the pump. Minimal cardio; a light punt/field session 1–2× is fine. Don't burn the calories you're fighting to pack on.`;
    UI.modal(`<h2>Coach</h2><div class="card" style="line-height:1.55">${msg}</div>
      <div class="card" style="margin-top:12px;line-height:1.5">
        <b>Keep the abs 🔥</b><br><span class="muted">You're lean-bulking, not dirty bulking. Hit protein every meal, keep weight gain ~1–1.5 lb/wk. If the scale rockets past 2 lb/wk you'll blur the abs — ease off the extra footlong.</span>
      </div>
      <button class="btn primary" style="margin-top:14px" id="coach-close">Let's get to work</button>`,
      (m, close) => { m.querySelector('#coach-close').onclick = close; });
  }

  /* ============================================================
     STRENGTH MODEL — 1RM estimation + extrapolation
     ============================================================ */
  function epley1RM(weight, reps) { return weight * (1 + Math.min(reps, 12) / 30); }
  function weightForReps(oneRM, reps) { return oneRM / (1 + reps / 30); }

  function best1RM(exKey) {
    const hist = Store.exerciseHistory(exKey);
    if (!hist.length) return null;
    let best = 0, from = null;
    hist.forEach(h => { const e = epley1RM(h.weight, h.reps); if (e > best) { best = e; from = h; } });
    return { oneRM: best, from };
  }

  // Estimate anchor (bench or squat) 1RM from every logged lift in that group.
  function anchorOneRM(anchor) {
    let best = 0, via = null;
    Object.keys(DATA.RATIOS).forEach(key => {
      const r = DATA.RATIOS[key];
      if (r.anchor !== anchor) return;
      const b = best1RM(key);
      if (!b) return;
      const implied = b.oneRM / r.ratio;
      if (implied > best) { best = implied; via = { key, name: r.name, lift: b.oneRM }; }
    });
    return best ? { oneRM: best, via } : null;
  }

  // Predict a target exercise's working weight from your other lifts.
  function predict(targetKey, reps) {
    const r = DATA.RATIOS[targetKey];
    if (!r) return null;
    const own = best1RM(targetKey);
    let oneRM = own ? own.oneRM : null, basis = own ? 'your own logged sets' : null;
    const anc = anchorOneRM(r.anchor);
    if (anc) {
      const fromAnchor = anc.oneRM * r.ratio;
      if (!oneRM || fromAnchor > oneRM) { oneRM = fromAnchor; basis = `your ${anc.via.name}`; }
    }
    if (!oneRM) return null;
    return { oneRM, working: weightForReps(oneRM, reps), reps, basis };
  }

  // List of exercises that have logged data, with estimates.
  function estimatedLifts() {
    const out = [];
    Object.values(DATA.E).forEach(ex => {
      const b = best1RM(ex.key);
      if (!b) return;
      out.push({
        key: ex.key, name: ex.name, oneRM: b.oneRM,
        e5: weightForReps(b.oneRM, 5), e8: weightForReps(b.oneRM, 8),
        e10: weightForReps(b.oneRM, 10), e12: weightForReps(b.oneRM, 12),
        from: b.from
      });
    });
    out.sort((a, b) => b.oneRM - a.oneRM);
    return out;
  }

  return { build, render, epley1RM, weightForReps, best1RM, predict, estimatedLifts, anchorOneRM };
})();
