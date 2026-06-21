/* ============================================================
   Macro — workout generation, logging, editing, extrapolation
   ============================================================ */
window.App = window.App || {};

App.Workout = (function () {
  const { DATA } = App;
  const Store = App.Store, UI = App.UI;

  let current = null;
  let editMode = false;

  /* ---------- build / resolve ---------- */
  function makeInstance(ex, bias) {
    const scheme = DATA.repScheme(ex.type, bias);
    const reps = ex.reps || scheme.reps;
    const setCount = ex.type === 'cond' ? 1 : (ex.sets || 3);
    const hist = Store.exerciseHistory(ex.key);
    let suggest = '', lastNote = null;
    if (hist.length) {
      const last = hist[0];
      lastNote = `Last: ${last.weight} lb × ${last.reps}`;
      suggest = last.weight;
      if (scheme.high && last.reps >= scheme.high) suggest = +last.weight + 5;
    }
    return {
      key: ex.key, name: ex.name, type: ex.type, reps, rir: scheme.rir || '',
      muscle: ex.muscle || null, group: ex.group || null, mj: !!ex.mj, stretch: !!ex.stretch, lp: !!ex.lp,
      suggest, lastNote,
      sets: Array.from({ length: setCount }, () => ({ weight: suggest, reps: '', done: false }))
    };
  }

  // Multi-joint first ordering (lower CNS fatigue on the big lifts), then
  // pair antagonist movements into supersets (AAPS) for efficiency.
  function arrange(list) {
    const tier = e => e.type === 'plyo' ? 0 : e.type === 'main' ? 1 : e.type === 'acc' ? 2 : e.type === 'abs' ? 3 : 4;
    const ordered = list.slice().sort((a, b) => tier(a) - tier(b));
    const used = new Array(ordered.length).fill(false);
    const out = []; let letter = 0;
    for (let i = 0; i < ordered.length; i++) {
      if (used[i]) continue;
      const a = ordered[i]; used[i] = true;
      const want = DATA.ANTAG[a.group];
      let j = -1;
      if (want) for (let k = i + 1; k < ordered.length; k++) {
        if (!used[k] && ordered[k].group === want && ordered[k].type === a.type) { j = k; break; }
      }
      if (j >= 0) { const lab = String.fromCharCode(65 + letter++); a.ss = lab + '1'; ordered[j].ss = lab + '2'; used[j] = true; out.push(a, ordered[j]); }
      else out.push(a);
    }
    return out;
  }

  function resolveDef(entry) {
    if (entry.custom) return { key: entry.key, name: entry.custom.name, type: entry.custom.type || 'acc', sets: entry.sets || 3, reps: entry.custom.reps };
    const base = DATA.ALL[entry.key];
    if (!base) return null;
    return Object.assign({}, base, entry.sets ? { sets: entry.sets } : {});
  }

  function build(dateKey) {
    dateKey = dateKey || Store.todayKey();
    const existing = Store.workoutLog(dateKey);
    const week = Store.weekFor(dateKey);
    const pl = App.Goals.plan();
    const bias = pl.bias;
    const dow = new Date(dateKey + 'T00:00:00').getDay();
    const scheduled = DATA.buildSchedule(pl.split, pl.days, pl.cardio)[dow];
    const chosen = Store.getDayChoice(dateKey);          // manual override for this day
    const dayType = (chosen && DATA.DAYS[chosen]) ? chosen : scheduled;
    const day = DATA.DAYS[dayType];

    if (existing && existing.dayType === dayType) return existing;

    const ov = Store.getProgramOverride(dayType);
    const defs = ov ? ov.map(resolveDef).filter(Boolean) : day.exercises;
    let exercises = defs.map(ex => makeInstance(ex, bias));
    if (!ov) exercises = arrange(exercises);   // MJ-first + supersets for default templates
    return { dateKey, week, bias, planTitle: pl.title, dayType, dayName: day.name, exercises, customized: !!ov, switched: !!chosen };
  }

  function persist() { if (current) Store.saveWorkout(current.dateKey, current); }

  // Write the current exercise list back as the override for this day type
  // so the change carries forward to every future day of the same type.
  function syncOverride() {
    const list = current.exercises.map(ex => {
      const known = DATA.ALL[ex.key];
      const sets = ex.type === 'cond' ? 1 : ex.sets.length;
      return known ? { key: ex.key, sets } : { key: ex.key, custom: { name: ex.name, type: ex.type, reps: ex.reps }, sets };
    });
    Store.setProgramOverride(current.dayType, list);
  }

  /* ---------- render ---------- */
  function render(container, dateKey) {
    current = build(dateKey);
    const isTraining = current.exercises.length > 0;

    if (!isTraining) { container.innerHTML = restCard(); wireRest(container); return; }

    let html = `
      <div class="spread" style="margin-bottom:12px">
        <div>
          <div class="pill accent">Week ${current.week}</div>
          <div class="pill" style="margin-left:6px">${UI.esc(App.Goals.biasLabel(current.bias))}</div>
          ${current.switched ? '<div class="pill orange" style="margin-left:6px">↺ Switched</div>' : ''}
          ${current.customized ? '<div class="pill" style="margin-left:6px">✎ Custom</div>' : ''}
        </div>
        <div class="row" style="gap:8px">
          ${editMode ? '' : '<button class="btn small ghost" id="wk-switch">🔄 Switch</button>'}
          <button class="btn small ghost" id="wk-${editMode ? 'info' : 'edit'}">${editMode ? 'Notes ▸' : '✏️ Edit'}</button>
        </div>
      </div>
      <h2 style="margin:4px 2px 14px;font-size:21px;letter-spacing:-.4px">${UI.esc(current.dayName)}</h2>
    `;

    if (editMode) html += recoBanner();
    if (!editMode) {
      html += volumeWarn();
      if (current.exercises.some(e => e.ss)) html += `<div class="banner info" style="margin-bottom:12px"><span class="b-ico">🔁</span><div><b>Supersets</b>Pairs marked A1/A2, B1/B2… are antagonist supersets — do them back-to-back with short rest.</div></div>`;
    }

    current.exercises.forEach((ex, i) => { html += editMode ? exerciseCardEdit(ex, i) : exerciseCard(ex, i); });

    if (editMode) {
      html += `
        <button class="btn" id="wk-add" style="margin-top:4px">＋ Add exercise</button>
        <button class="btn ghost danger" id="wk-reset" style="margin-top:10px">↺ Reset to default</button>
        <button class="btn primary" id="wk-doneedit" style="margin-top:10px">Done editing</button>`;
    } else {
      const done = current.exercises.every(ex => ex.sets.some(s => s.done) || ex.type === 'cond');
      html += `<button class="btn ${done ? 'primary' : ''}" id="wk-finish" style="margin-top:6px">${done ? '✓ Session logged' : 'Finish & save session'}</button>`;
    }

    container.innerHTML = html;
    editMode ? wireEdit(container) : wire(container);
  }

  function tagFor(type) {
    return type === 'plyo' ? { cls:'plyo', txt:'Power' } : type === 'abs' ? { cls:'abs', txt:'Core' }
      : type === 'main' ? { cls:'main', txt:'Main' } : type === 'cond' ? { cls:'', txt:'Cardio' } : { cls:'', txt:'Accessory' };
  }

  function exerciseCard(ex, i) {
    const tag = tagFor(ex.type);
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
    const meta = `${ex.type === 'cond' ? '' : setCount + ' sets × '}${UI.esc(ex.reps)}${ex.rir ? ` · ${UI.esc(ex.rir)}` : ''}`;
    const cue = ex.lp ? 'Take the last set to failure, then add lengthened partials in the stretch.'
      : ex.stretch ? 'Control the stretch — load the muscle at its longest length.' : '';
    return `
    <div class="ex-card ${cardDone ? 'done' : ''}">
      <div class="ex-head">
        <div>
          <h3>${ex.ss ? `<span class="ss-chip">${ex.ss}</span>` : ''}${UI.esc(ex.name)}${ex.stretch ? ' <span class="stretch-tag">stretch</span>' : ''}</h3>
          <div class="ex-meta">${meta}</div>
        </div>
        <span class="ex-tag ${tag.cls}">${tag.txt}</span>
      </div>
      ${inner}
      ${cue ? `<div class="last-hint suggest">${cue}</div>` : ''}
      ${ex.lastNote ? `<div class="last-hint">${UI.esc(ex.lastNote)} · <span class="suggest">target ${ex.suggest || '—'} lb</span></div>` : (ex.type !== 'cond' ? `<div class="last-hint">First time — log it to start tracking.</div>` : '')}
    </div>`;
  }

  // Per-muscle session volume; warn past ~8 hard sets (junk volume).
  function volumeWarn() {
    const by = {};
    current.exercises.forEach(ex => {
      if (ex.muscle && ex.type !== 'cond' && ex.type !== 'plyo') by[ex.muscle] = (by[ex.muscle] || 0) + ex.sets.length;
    });
    const over = Object.entries(by).filter(([, n]) => n > 8);
    if (!over.length) return '';
    return `<div class="banner warn" style="margin-bottom:12px"><span class="b-ico">⚠️</span><div><b>High session volume</b>${over.map(([m, n]) => `${n} sets ${m}`).join(', ')} — past ~8 hard sets for one muscle in a session adds fatigue with little extra growth.</div></div>`;
  }

  function exerciseCardEdit(ex, i) {
    const tag = tagFor(ex.type);
    return `
    <div class="ex-card">
      <div class="ex-head">
        <div><h3>${UI.esc(ex.name)}</h3><div class="ex-meta">${ex.type === 'cond' ? UI.esc(ex.reps) : ex.sets.length + ' sets × ' + UI.esc(ex.reps)} · ${tag.txt}</div></div>
        <button class="icon-btn" data-rm="${i}" style="width:32px;height:32px;color:var(--bad);border-color:rgba(255,93,93,.3);font-size:18px">✕</button>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn small" data-swap="${i}">⇄ Swap</button>
        ${ex.type === 'cond' ? '' : `<button class="btn small" data-sets="${i}" data-d="-1">− set</button><button class="btn small" data-sets="${i}" data-d="1">＋ set</button>`}
      </div>
    </div>`;
  }

  function recoBanner() {
    const t = current.dayType;
    let tip;
    if (t === 'conditioning') tip = `Conditioning day — steady cardio or intervals. Swap the modality (bike, row, stairs, run) to whatever you prefer.`;
    else if (t.startsWith('upper')) tip = `Keep at least one press and one pull as the backbone of the day; add or swap accessories to target what you want.`;
    else if (t.startsWith('lower')) tip = `Keep a squat or hinge as the main lift; adjust accessories and calves to taste.`;
    else tip = `Add whatever fits your goals. Rep ranges follow your selected training emphasis.`;
    return `<div class="banner info" style="margin-bottom:14px"><span class="b-ico">ℹ️</span><div><b>Notes</b>${tip} <span class="muted">Changes apply to every ${UI.esc(current.dayName)} going forward.</span></div></div>`;
  }

  function restCard() {
    const days = Store.daysUntilTarget();
    return `
    <div class="card center" style="padding:30px 18px">
      <div style="font-size:42px">🛌</div>
      <h2 style="margin:10px 0 4px">Rest Day</h2>
      <p class="muted" style="margin:0 0 14px">No training scheduled. Recovery is when adaptation happens — eat to your target and prioritise sleep.</p>
      ${days != null ? `<div class="pill accent">${days} days to your target</div>` : ''}
    </div>
    <button class="btn primary" id="rest-switch" style="margin-top:14px">🔄 Train something today</button>
    <button class="btn ghost" id="rest-add" style="margin-top:10px">＋ Build a custom session</button>`;
  }

  /* ---------- logging-mode events ---------- */
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
          if (set.reps === '' && ex.type !== 'cond') { const m = String(ex.reps).match(/\d+/); set.reps = m ? +m[0] : 10; }
        }
        persist();
        render(container, current.dateKey);
        if (set.done) UI.toast('Set logged 💪', 'good');
      });
    });
    const finish = container.querySelector('#wk-finish');
    if (finish) finish.addEventListener('click', () => { persist(); UI.toast('Session saved. Stats updated.', 'good'); App.Router.go('today'); });
    const edit = container.querySelector('#wk-edit');
    if (edit) edit.addEventListener('click', () => { editMode = true; render(container, current.dateKey); });
    const info = container.querySelector('#wk-info');
    if (info) info.addEventListener('click', coachSheet);
    const sw = container.querySelector('#wk-switch');
    if (sw) sw.addEventListener('click', () => switchSheet(container));
  }

  /* ---------- choose / switch today's workout ---------- */
  const SWITCH_GROUPS = [
    { label: 'Push / Pull / Legs', items: ['push', 'pull', 'legs'] },
    { label: 'Upper / Lower', items: ['upperA', 'lowerA', 'upperB', 'lowerB'] },
    { label: 'Full Body', items: ['fullA', 'fullB', 'fullC'] },
    { label: 'Other', items: ['conditioning', 'rest'] },
  ];
  function switchSheet(container) {
    const cur = current ? current.dayType : null;
    UI.modal(`
      <h2>Choose today's workout</h2>
      <p class="muted" style="margin:-8px 0 14px;font-size:13px">Pick any session for today — this overrides the schedule for this day only.</p>
      ${SWITCH_GROUPS.map(g => `
        <div class="meal-head"><b>${g.label}</b><span></span></div>
        ${g.items.map(k => {
          const d = DATA.DAYS[k];
          const n = (d.exercises || []).length;
          const sub = k === 'rest' ? 'Recovery day' : k === 'conditioning' ? 'Cardio / conditioning' : `${n} exercises`;
          return `<div class="search-result ${k === cur ? 'me' : ''}" data-day="${k}">
            <div class="sr-main"><b>${UI.esc(d.name)}</b><small>${sub}</small></div>
            <div style="color:var(--accent);font-size:22px">${k === cur ? '✓' : '→'}</div>
          </div>`;
        }).join('')}`).join('')}
      <button class="btn ghost" id="sw-reset" style="margin-top:10px">Use the scheduled workout</button>
    `, (m, close) => {
      m.querySelectorAll('[data-day]').forEach(el => el.onclick = () => {
        Store.setDayChoice(current.dateKey, el.dataset.day);
        close(); render(container, current.dateKey); UI.toast('Workout switched', 'good');
      });
      m.querySelector('#sw-reset').onclick = () => {
        Store.clearDayChoice(current.dateKey);
        close(); render(container, current.dateKey); UI.toast('Back to scheduled');
      };
    });
  }

  function wireRest(container) {
    const sw = container.querySelector('#rest-switch');
    if (sw) sw.addEventListener('click', () => switchSheet(container));
    const add = container.querySelector('#rest-add');
    if (add) add.addEventListener('click', () => { editMode = true; picker('add', null, container); });
  }

  /* ---------- edit-mode events ---------- */
  function wireEdit(container) {
    container.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => removeExercise(+b.dataset.rm, container));
    container.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => picker('swap', +b.dataset.swap, container));
    container.querySelectorAll('[data-sets]').forEach(b => b.onclick = () => changeSets(+b.dataset.sets, +b.dataset.d, container));
    const add = container.querySelector('#wk-add'); if (add) add.onclick = () => picker('add', null, container);
    const reset = container.querySelector('#wk-reset'); if (reset) reset.onclick = () => resetDay(container);
    const done = container.querySelector('#wk-doneedit'); if (done) done.onclick = () => { editMode = false; render(container, current.dateKey); UI.toast('Routine updated', 'good'); };
    const info = container.querySelector('#wk-info'); if (info) info.onclick = coachSheet;
  }

  function removeExercise(i, c) {
    if (current.exercises.length <= 1) return UI.toast('Keep at least one exercise');
    current.exercises.splice(i, 1); persist(); syncOverride(); render(c, current.dateKey);
  }
  function changeSets(i, d, c) {
    const ex = current.exercises[i];
    const n = UI.clamp(ex.sets.length + d, 1, 8);
    if (n > ex.sets.length) ex.sets.push({ weight: ex.suggest || '', reps: '', done: false });
    else ex.sets.length = n;
    persist(); syncOverride(); render(c, current.dateKey);
  }
  function addExerciseByDef(def, c) {
    current.exercises.push(makeInstance(def, current.bias));
    current.customized = true; persist(); syncOverride();
    if (!editMode) editMode = true;
    render(c, current.dateKey);
  }
  function swapExercise(i, def, c) {
    const old = current.exercises[i];
    const inst = makeInstance(def, current.bias);
    if (old.type !== 'cond' && inst.type !== 'cond') {
      const cnt = old.sets.length;
      inst.sets = Array.from({ length: cnt }, () => ({ weight: inst.suggest || '', reps: '', done: false }));
    }
    current.exercises[i] = inst; persist(); syncOverride(); render(c, current.dateKey);
  }
  function resetDay(c) {
    if (!confirm('Reset this day back to the coach\'s default routine?')) return;
    Store.clearProgramOverride(current.dayType);
    const day = DATA.DAYS[current.dayType];
    const exercises = day.exercises.map(ex => makeInstance(ex, current.bias));
    current = Object.assign({}, current, { exercises, customized: false });
    Store.saveWorkout(current.dateKey, current);
    render(c, current.dateKey);
    UI.toast('Reset to default');
  }

  /* ---------- exercise picker ---------- */
  const CAT_EMOJI = { Chest:'🏋️', Back:'🪢', Shoulders:'🤸', Arms:'💪', Legs:'🦵', Core:'🔥', Power:'⚡', Cardio:'🏃', Other:'🏋️' };
  function typeLabel(t) { return t === 'main' ? 'Main' : t === 'abs' ? 'Core' : t === 'plyo' ? 'Power' : t === 'cond' ? 'Cardio' : 'Accessory'; }

  function picker(mode, idx, c) {
    const groups = DATA.exLibrary();
    const list = groups.map(g => `
      <div class="meal-head"><b>${g.cat}</b><span></span></div>
      ${g.items.map(it => `
        <div class="search-result" data-key="${it.key}">
          <div class="food-thumb">${CAT_EMOJI[g.cat] || '🏋️'}</div>
          <div class="sr-main"><b>${UI.esc(it.name)}</b><small>${it.type === 'cond' ? UI.esc(it.reps) : (it.sets || 3) + ' sets · ' + typeLabel(it.type)}</small></div>
          <div style="color:var(--accent);font-size:22px">＋</div>
        </div>`).join('')}
    `).join('');

    UI.modal(`
      <h2>${mode === 'swap' ? 'Swap exercise' : 'Add exercise'}</h2>
      <input class="input" id="lib-q" placeholder="Search exercises…" autocomplete="off">
      <button class="btn ghost small" id="lib-custom" style="margin-top:10px;width:100%">✏️ Add a custom exercise</button>
      <div id="lib-list" style="margin-top:12px">${list}</div>
    `, (m, close) => {
      m.querySelectorAll('[data-key]').forEach(el => el.onclick = () => {
        const def = DATA.ALL[el.dataset.key]; close();
        mode === 'swap' ? swapExercise(idx, def, c) : addExerciseByDef(def, c);
      });
      m.querySelector('#lib-custom').onclick = () => { close(); customExercise(mode, idx, c); };
      m.querySelector('#lib-q').addEventListener('input', e => {
        const t = e.target.value.toLowerCase();
        m.querySelectorAll('#lib-list .search-result').forEach(el => el.style.display = el.textContent.toLowerCase().includes(t) ? '' : 'none');
        m.querySelectorAll('#lib-list .meal-head').forEach(h => h.style.display = t ? 'none' : '');
      });
    });
  }

  function customExercise(mode, idx, c) {
    UI.modal(`
      <h2>Custom exercise</h2>
      ${UI.field('Name', `<input class="input" id="cx-name" placeholder="e.g. Landmine Press">`)}
      ${UI.field('Type', `<select class="input" id="cx-type">
        <option value="main">Main lift (heavy)</option>
        <option value="acc" selected>Accessory</option>
        <option value="abs">Core / abs</option>
        <option value="cond">Cardio / conditioning</option>
      </select>`)}
      <button class="btn primary" id="cx-go">${mode === 'swap' ? 'Swap in' : 'Add'}</button>
    `, (m, close) => {
      m.querySelector('#cx-go').onclick = () => {
        const name = m.querySelector('#cx-name').value.trim();
        if (!name) return UI.toast('Name it first');
        const type = m.querySelector('#cx-type').value;
        const def = { key: 'custom_' + Date.now(), name, type, sets: type === 'cond' ? 1 : 3, reps: type === 'cond' ? '20–30 min' : undefined };
        close();
        mode === 'swap' ? swapExercise(idx, def, c) : addExerciseByDef(def, c);
      };
    });
  }

  function coachSheet() {
    const pl = App.Goals.plan();
    UI.modal(`<h2>Training notes</h2>
      <div class="card" style="line-height:1.55">
        <b>${UI.esc(pl.title)}</b><br>
        <span class="muted">Emphasis: ${UI.esc(App.Goals.biasLabel(pl.bias))}. Progress by adding weight or a rep when you hit the top of the range with good form, leaving the prescribed reps-in-reserve.</span>
      </div>
      <div class="card" style="margin-top:12px;line-height:1.5">
        <b>How exercises are chosen</b>
        <ul class="guide-list">
          <li>Each session balances horizontal + vertical pressing and pulling, so no plane is overworked.</li>
          <li>Multi-joint compounds lead while you're fresh; isolation follows.</li>
          <li>Stretch-biased picks (incline curl, overhead triceps, RDL, deep squats) load the muscle at long lengths for more growth.</li>
          <li>Opposing movements pair into supersets to save time and lift output.</li>
        </ul>
      </div>
      <div class="card" style="margin-top:12px;line-height:1.5">
        <b>Nutrition</b><br>
        <span class="muted">${pl.cal} cal/day · ${pl.protein}g protein · ${pl.carbs}g carbs · ${pl.fat}g fat. ${pl.dir>0?`Target a slight surplus (~${pl.weeklyRate} lb/wk gain).`:pl.dir<0?`Target a moderate deficit (~${pl.weeklyRate} lb/wk loss).`:'Hold around maintenance.'}</span>
      </div>
      <button class="btn primary" style="margin-top:14px" id="coach-close">Done</button>`,
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
  function anchorOneRM(anchor) {
    let best = 0, via = null;
    Object.keys(DATA.RATIOS).forEach(key => {
      const r = DATA.RATIOS[key];
      if (r.anchor !== anchor) return;
      const b = best1RM(key); if (!b) return;
      const implied = b.oneRM / r.ratio;
      if (implied > best) { best = implied; via = { key, name: r.name, lift: b.oneRM }; }
    });
    return best ? { oneRM: best, via } : null;
  }
  function predict(targetKey, reps) {
    const r = DATA.RATIOS[targetKey]; if (!r) return null;
    const own = best1RM(targetKey);
    let oneRM = own ? own.oneRM : null, basis = own ? 'your own logged sets' : null;
    const anc = anchorOneRM(r.anchor);
    if (anc) { const fromAnchor = anc.oneRM * r.ratio; if (!oneRM || fromAnchor > oneRM) { oneRM = fromAnchor; basis = `your ${anc.via.name}`; } }
    if (!oneRM) return null;
    return { oneRM, working: weightForReps(oneRM, reps), reps, basis };
  }
  function estimatedLifts() {
    const out = [];
    Object.values(DATA.E).forEach(ex => {
      const b = best1RM(ex.key); if (!b) return;
      out.push({ key: ex.key, name: ex.name, oneRM: b.oneRM,
        e5: weightForReps(b.oneRM, 5), e8: weightForReps(b.oneRM, 8), e10: weightForReps(b.oneRM, 10), e12: weightForReps(b.oneRM, 12), from: b.from });
    });
    out.sort((a, b) => b.oneRM - a.oneRM);
    return out;
  }

  return { build, render, epley1RM, weightForReps, best1RM, predict, estimatedLifts, anchorOneRM };
})();
