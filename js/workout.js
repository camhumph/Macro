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
  // Progression increment per training status (returning lifters regain
  // strength fast — "muscle memory" — so jumps are bigger early).
  const STATUS_INC = { beginner: 5, returning: 10, intermediate: 5, advanced: 2.5 };
  function progressionInc(type) {
    const base = STATUS_INC[Store.profile().lifterStatus] || 5;
    return type === 'acc' ? Math.max(2.5, base / 2) : base;
  }

  // Conservative first-attempt working weights (lb) for un-anchored lifts that
  // can't be derived from your other lifts. The coach starts you light to build up.
  const START_DEFAULTS = {
    lateral:10, cableLat:10, rearDelt:10, facepull:25,
    bbCurl:30, inclineCurl:15, hammerCurl:20, preacher:25,
    pushdown:30, ropePush:30, skull:30,
    legCurl:50, legExt:50, calfStand:90, calfSeat:45,
    legPress:135, hackSquat:90, bulgarian:25, walkLunge:25, hipThrust:95,
    latPull:70, csRow:70, seatedRow:70, tbar:45, cableFly:15,
    dbBench:35, inclineDB:30, dbOHP:25, pullup:0, weightedDip:0,
  };
  function round5(x) { return Math.max(0, Math.round(x / 5) * 5); }
  function repNum(reps, fallback) { const m = String(reps || '').match(/\d+/); return m ? +m[0] : fallback; }
  // Suggest a starting weight + a target to work up to for a lift with no history.
  function startEstimate(key, reps) {
    const r = repNum(reps, 8);
    const p = predict(key, r);                          // from your other lifts via strength ratios
    if (p && p.working > 0) { const cap = round5(p.working); return { start: Math.max(round5(p.working * 0.9), 5), target: cap, basis: p.basis }; }
    if (key in START_DEFAULTS) {                         // sensible beginner load, scaled to bodyweight
      const bw = Store.latestWeight() || 170;
      const w = round5(START_DEFAULTS[key] * UI.clamp(bw / 170, 0.7, 1.4));
      return { start: w, target: null, basis: 'a conservative starting load' };
    }
    return null;
  }

  function makeInstance(ex, bias) {
    const scheme = DATA.repScheme(ex.type, bias);
    const reps = ex.editedReps ? ex.reps : (ex.reps || scheme.reps);
    const setCount = ex.type === 'cond' ? 1 : (ex.sets || 3);
    const hist = Store.exerciseHistory(ex.key);
    let suggest = '', lastNote = null, startHint = null;
    if (hist.length) {
      const last = hist[0];
      lastNote = `Last: ${last.weight} lb × ${last.reps}`;
      suggest = last.weight;
      if (scheme.high && last.reps >= scheme.high) suggest = +last.weight + progressionInc(ex.type);
    } else if (ex.type === 'main' || ex.type === 'acc') {
      startHint = startEstimate(ex.key, reps);
      if (startHint) suggest = startHint.start;
    }
    return {
      key: ex.key, name: ex.name, type: ex.type, reps, rir: scheme.rir || '', editedReps: !!ex.editedReps,
      muscle: ex.muscle || null, group: ex.group || null, mj: !!ex.mj, stretch: !!ex.stretch, lp: !!ex.lp,
      suggest, lastNote, startHint,
      sets: Array.from({ length: setCount }, () => ({ weight: suggest, reps: '', done: false }))
    };
  }

  // Multi-joint first ordering (lower CNS fatigue on the big lifts), then pair
  // ONLY antagonist *isolations* into supersets. Heavy compounds are never
  // supersetted — they run as straight sets with full rest so force output and
  // technique don't degrade (axial/CNS fatigue), per current hypertrophy science.
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
      // accessory ↔ accessory antagonist pairs only (no main lifts back-to-back)
      if (want && a.type === 'acc') for (let k = i + 1; k < ordered.length; k++) {
        if (!used[k] && ordered[k].type === 'acc' && ordered[k].group === want) { j = k; break; }
      }
      if (j >= 0) { const lab = String.fromCharCode(65 + letter++); a.ss = lab + '1'; ordered[j].ss = lab + '2'; used[j] = true; out.push(a, ordered[j]); }
      else out.push(a);
    }
    return out;
  }

  /* ---------- session variation (accessories rotate; anchors stay) ---------- */
  // Interchangeable accessory pools — same muscle/role, swapped session-to-session
  // for fresh stimulus. Heavy compounds are intentionally excluded so you can
  // progressively overload them. Members must be real keys in DATA.ALL.
  const VARIANT_POOLS = [
    ['lateral', 'cableLat'],
    ['facepull', 'rearDelt'],
    ['bbCurl', 'inclineCurl', 'hammerCurl', 'preacher'],
    ['pushdown', 'ropePush', 'skull'],
    ['inclineDB', 'dbBench', 'cableFly'],
    ['csRow', 'seatedRow', 'tbar'],
    ['legPress', 'hackSquat', 'bulgarian', 'walkLunge'],
    ['legExt', 'legPress'],
    ['legCurl'],
    ['calfStand', 'calfSeat'],
    ['cableCrunch', 'legRaise', 'abWheel', 'pallof', 'russian'],
  ];
  const POOL_OF = {};
  VARIANT_POOLS.forEach(pool => pool.forEach(k => { POOL_OF[k] = pool; }));

  // Rotate each accessory to a fresh variant based on a session seed, keeping the
  // programmed set count and avoiding duplicating a movement already in the day.
  function applyVariation(defs, seed) {
    const usedKeys = new Set(defs.map(d => d.key));
    return defs.map(d => {
      if (d.type !== 'acc') return d;                 // anchors & compounds untouched
      const pool = POOL_OF[d.key];
      if (!pool || pool.length < 2) return d;
      const base = pool.indexOf(d.key);
      let chosen = d.key;
      for (let s = 0; s < pool.length; s++) {
        const cand = pool[(base + seed + s) % pool.length];
        if (cand === d.key) { chosen = cand; break; }
        if (!usedKeys.has(cand)) { chosen = cand; break; }
      }
      usedKeys.delete(d.key); usedKeys.add(chosen);
      const repl = DATA.ALL[chosen]; if (!repl) return d;
      return Object.assign({}, repl, { sets: d.sets || repl.sets });   // keep programmed volume
    });
  }

  function resolveDef(entry) {
    if (entry.custom) return { key: entry.key, name: entry.name || entry.custom.name, type: entry.custom.type || 'acc', sets: entry.sets || 3, reps: entry.reps || entry.custom.reps, editedReps: !!entry.reps };
    const base = DATA.ALL[entry.key];
    if (!base) return null;
    const d = Object.assign({}, base);
    if (entry.sets) d.sets = entry.sets;
    if (entry.name) d.name = entry.name;
    if (entry.reps) { d.reps = entry.reps; d.editedReps = true; }
    return d;
  }

  function build(dateKey) {
    dateKey = dateKey || Store.todayKey();
    const existing = Store.workoutLog(dateKey);
    const week = Store.weekFor(dateKey);
    const pl = App.Goals.plan();
    const bias = pl.bias;
    const dow = new Date(dateKey + 'T00:00:00').getDay();
    const rotation = (DATA.SPLITS[pl.split] || DATA.SPLITS.upperlower).rotation;
    const mode = Store.profile().scheduleMode || 'flexible';
    const choice = Store.getDayChoice(dateKey);   // manual override / adapt for this day

    let dayType, deload = false;
    const isRunChoice = choice && (choice.type || '').startsWith('run:');
    const isChoice = choice && (DATA.DAYS[choice.type] || (choice.type || '').startsWith('rt_'));

    // Marathon / race training: running plan drives the day (unless the user
    // explicitly switched to a lifting/rest day).
    if (App.Running && App.Running.active(Store.profile()) && (isRunChoice || !choice)) {
      const overrideType = isRunChoice ? choice.type.slice(4) : null;
      const rx = App.Running.rxFor(Store.profile(), dateKey, overrideType);
      if (rx.type === 'rest') return { dateKey, week, isRun: false, dayType: 'rest', dayName: 'Rest / Recovery', exercises: [], bias: pl.bias };
      if (existing && existing.isRun && existing.run && existing.run.type === rx.type) return existing;
      return { dateKey, week, isRun: true, dayType: 'run_' + rx.type, dayName: rx.name,
               run: rx, planTitle: pl.title, exercises: [], done: false, actual: {} };
    }

    if (isChoice) {
      dayType = choice.type; deload = choice.deload;
    } else if (mode === 'flexible') {
      // Adaptive: next workout follows what you ACTUALLY trained last — so if you
      // switch today's session, the rotation continues from there onward. Missing
      // a day never desyncs you; once you start today it pins.
      dayType = existing ? existing.dayType : nextInRotation(rotation);
    } else {
      dayType = DATA.buildSchedule(pl.split, pl.days, pl.cardio)[dow];
    }

    // resolve routine vs built-in day
    let routine = null, dayName, baseDefs;
    if ((dayType || '').startsWith('rt_')) {
      routine = Store.getRoutine(dayType);
      if (!routine) { dayType = 'rest'; }
      else { dayName = routine.name; baseDefs = routine.exercises.map(resolveDef).filter(Boolean); }
    }
    const day = routine ? null : (DATA.DAYS[dayType] || DATA.DAYS.rest);
    if (!routine) { dayName = day.name; baseDefs = day.exercises; }

    if (existing && existing.dayType === dayType) return existing;

    const ov = Store.getProgramOverride(dayType);
    let defs = ov ? ov.map(resolveDef).filter(Boolean) : baseDefs;
    // Fresh accessory variation each session (anchors/compounds stay for overload).
    let varied = false;
    if (!ov && !routine && Store.profile().varyWorkouts !== false) {
      const newDefs = applyVariation(defs, Store.trainingDates().length);
      varied = newDefs.some((d, i) => d.key !== defs[i].key);
      defs = newDefs;
    }
    let exercises = defs.map(ex => makeInstance(ex, bias));
    if (!ov && !routine) exercises = arrange(exercises);   // MJ-first + isolation supersets for default templates
    if (deload) exercises.forEach(ex => {
      if (ex.type === 'cond') return;
      if (ex.sets.length > 2) ex.sets.pop();   // trim a set
      ex.rir = '3–4 RIR · deload';
    });
    // Final-set intensity techniques — ISOLATIONS only. Heavy compounds are never
    // taken to failure (CNS/axial fatigue without extra strength benefit).
    if (!deload && Store.profile().intensityTech && (bias === 'hypertrophy' || bias === 'power')) {
      const TECH = ['Rest-pause', 'Drop set', '3–5s eccentric'];
      let i = 0;
      exercises.forEach(ex => { if (ex.type === 'acc') { ex.finisher = TECH[i % TECH.length]; i++; } });
    }
    return { dateKey, week, bias, planTitle: pl.title, dayType, dayName, exercises, customized: !!ov, switched: !!choice, deload, isRoutine: !!routine, varied };
  }

  function persist() { if (current) Store.saveWorkout(current.dateKey, current); }

  // Write the current exercise list back as the override for this day type
  // so the change carries forward to every future day of the same type.
  function syncOverride() {
    const list = current.exercises.map(ex => {
      const known = DATA.ALL[ex.key];
      const sets = ex.type === 'cond' ? 1 : ex.sets.length;
      if (!known) return { key: ex.key, custom: { name: ex.name, type: ex.type, reps: ex.reps }, sets };
      const entry = { key: ex.key, sets };
      if (ex.name !== known.name) entry.name = ex.name;       // edited name (e.g. box height)
      if (ex.editedReps) entry.reps = ex.reps;                // edited reps/target
      return entry;
    });
    Store.setProgramOverride(current.dayType, list);
  }

  /* ---------- render ---------- */
  function render(container, dateKey) {
    current = build(dateKey);
    if (current.isRun) { renderRun(container); return; }
    const isTraining = current.exercises.length > 0;

    if (!isTraining) { container.innerHTML = restCard(); wireRest(container); return; }

    let html = `
      <div class="spread" style="margin-bottom:12px">
        <div>
          <div class="pill accent">Week ${current.week}</div>
          <div class="pill" style="margin-left:6px">${UI.esc(App.Goals.biasLabel(current.bias))}</div>
          ${current.switched ? '<div class="pill orange" style="margin-left:6px">↺ Switched</div>' : ''}
          ${current.varied ? '<div class="pill" style="margin-left:6px">↻ Fresh variation</div>' : ''}
          ${current.customized ? '<div class="pill" style="margin-left:6px">✎ Custom</div>' : ''}
        </div>
        <div class="row" style="gap:8px">
          ${editMode ? '' : '<button class="btn small ghost" id="wk-switch">🔄 Switch</button>'}
          <button class="btn small ghost" id="wk-${editMode ? 'info' : 'edit'}">${editMode ? 'Notes ▸' : '✏️ Edit'}</button>
        </div>
      </div>
      <h2 style="margin:4px 2px 10px;font-size:21px;letter-spacing:-.4px">${UI.esc(current.dayName)}</h2>
      ${editMode ? '' : `<div class="btn-row" style="margin-bottom:12px"><button class="btn ghost small" id="wk-plates">🏋️ Plates</button><button class="btn ghost small" id="wk-shuffle">🎲 Shuffle workout</button></div>`}
    `;

    if (editMode) html += recoBanner();
    if (!editMode) {
      if (current.deload) html += `<div class="banner info" style="margin-bottom:12px"><span class="b-ico">🪫</span><div><b>Deload day</b>Reduced volume and lighter effort (leave 3–4 reps in reserve). Use it to recover while keeping the groove.</div></div>`;
      html += volumeWarn();
      html += weakBanner();
      if (current.exercises.some(e => e.ss)) html += `<div class="banner info" style="margin-bottom:12px"><span class="b-ico">🔁</span><div><b>Isolation supersets</b>Pairs marked A1/A2… are antagonist <i>isolations</i> — run them back-to-back. Heavy compounds stay as straight sets with full rest.</div></div>`;
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
  function finisherHint(t) {
    return t === 'Rest-pause' ? 'to failure, rest 15s, rep out again ×2.'
      : t === 'Drop set' ? 'to failure, drop ~25% load, continue.'
      : 'lower under control for 3–5 seconds each rep.';
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
        <div class="set-row ${s.pr ? 'pr' : ''}">
          <div class="set-no">${s.pr ? '🏆' : si + 1}</div>
          <div class="mini"><input type="number" inputmode="decimal" placeholder="${ex.suggest || '—'}" value="${s.weight !== '' ? s.weight : ''}" data-ex="${i}" data-set="${si}" data-fld="weight"><span>lb</span></div>
          <div class="mini"><input type="number" inputmode="numeric" placeholder="reps" value="${s.reps !== '' ? s.reps : ''}" data-ex="${i}" data-set="${si}" data-fld="reps"><span>×</span></div>
          <button class="check ${s.done ? 'on' : ''}" data-ex="${i}" data-set="${si}">
            <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
          </button>
        </div>`).join('');
    }
    const meta = `${ex.type === 'cond' ? '' : setCount + ' sets × '}${UI.esc(ex.reps)}${ex.rir ? ` · ${UI.esc(ex.rir)}` : ''}`;
    // Sliding proximity-to-failure + long-length coaching by exercise role.
    let cue = '';
    if (ex.type === 'main') cue = 'Heavy compound — leave 1–2 reps in reserve and pause in the stretch. Don\'t take these to failure.';
    else if (ex.lp) cue = 'Last set to failure, then add lengthened partials in the stretch.';
    else if (ex.stretch) cue = 'Control the stretch — load the muscle at its longest length; final set 0–1 RIR.';
    else if (ex.type === 'acc') cue = 'Push the last set to 0–1 reps in reserve.';
    const startLine = (!ex.lastNote && ex.startHint)
      ? `<div class="last-hint suggest">${ex.startHint.start > 0 ? `Start ~${ex.startHint.start} lb` : 'Start with bodyweight'}${ex.startHint.target ? ` · work up toward ~${ex.startHint.target} lb` : ''} <span class="muted">(${UI.esc(ex.startHint.basis)} — adjust to your real strength)</span></div>`
      : '';
    return `
    <div class="ex-card ${cardDone ? 'done' : ''}">
      <div class="ex-head">
        <div>
          <h3>${ex.ss ? `<span class="ss-chip">${ex.ss}</span>` : ''}${UI.esc(ex.name)}${ex.stretch ? ' <span class="stretch-tag">stretch</span>' : ''}</h3>
          <div class="ex-meta">${meta}</div>
        </div>
        <div class="row" style="gap:8px;align-items:center">
          ${ex.type !== 'cond' ? `<button class="icon-btn" data-swapex="${i}" title="Swap" style="width:30px;height:30px;color:var(--faint);font-size:15px">⇄</button>` : ''}
          <span class="ex-tag ${tag.cls}">${tag.txt}</span>
        </div>
      </div>
      ${inner}
      ${ex.finisher ? `<div class="last-hint"><span class="fin-badge">🔥 Final set: ${ex.finisher}</span> ${finisherHint(ex.finisher)}</div>` : ''}
      ${cue ? `<div class="last-hint suggest">${cue}</div>` : ''}
      ${ex.lastNote ? `<div class="last-hint">${UI.esc(ex.lastNote)} · <span class="suggest">target ${ex.suggest || '—'} lb</span></div>` : (startLine || (ex.type !== 'cond' ? `<div class="last-hint">First time — log it to start tracking.</div>` : ''))}
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
    return `<div class="banner warn" style="margin-bottom:12px"><span class="b-ico">⚠️</span><div><b>High session volume</b>${over.map(([m, n]) => `${n} sets ${m}`).join(', ')} — past ~8 hard sets for one muscle in a session is junk volume: fatigue with little extra growth.</div></div>`;
  }

  // Surface the biggest lagging muscle with a one-tap accessory add.
  function weakBanner() {
    const ws = App.Workout.weakSpots ? App.Workout.weakSpots() : [];
    if (!ws.length) return '';
    const have = new Set(current.exercises.map(e => e.key));
    const top = ws.find(w => (w.suggest || []).some(k => !have.has(k)));
    if (!top) return '';
    const pick = top.suggest.find(k => !have.has(k));
    const ex = DATA.ALL[pick]; if (!ex) return '';
    return `<div class="banner info" style="margin-bottom:12px"><span class="b-ico">🎯</span><div><b>Weak point: ${UI.esc(top.muscle)}</b>Only ~${top.sets} hard sets/week lately (aim 10–20). Bring it up — <button class="link" data-quickadd="${pick}" style="color:var(--accent);font-weight:700">add ${UI.esc(ex.name)} ▸</button></div></div>`;
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
        <button class="btn small" data-edit="${i}">✎ Edit</button>
        <button class="btn small" data-swap="${i}">⇄ Swap</button>
        ${ex.type === 'cond' ? '' : `<button class="btn small" data-sets="${i}" data-d="-1">− set</button><button class="btn small" data-sets="${i}" data-d="1">＋ set</button>`}
      </div>
    </div>`;
  }

  // Edit an exercise's name, reps/target and set count (e.g. box-jump height).
  function editDetailsSheet(i, c) {
    const ex = current.exercises[i];
    UI.modal(`
      <h2>Edit exercise</h2>
      ${UI.field('Name', `<input class="input" id="ed-name" value="${UI.esc(ex.name)}">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Reps / target</label><input class="input" id="ed-reps" value="${UI.esc(ex.reps)}" placeholder="e.g. 8–10 or 30 in"></div>
        ${ex.type === 'cond' ? '' : `<div class="field" style="margin:0"><label>Sets</label><input class="input" id="ed-sets" type="number" min="1" max="8" value="${ex.sets.length}"></div>`}
      </div>
      <button class="btn primary" id="ed-save">Save</button>
    `, (m, close) => {
      m.querySelector('#ed-save').onclick = () => {
        ex.name = m.querySelector('#ed-name').value.trim() || ex.name;
        const newReps = m.querySelector('#ed-reps').value.trim();
        if (newReps && newReps !== ex.reps) { ex.reps = newReps; ex.editedReps = true; }
        const setsEl = m.querySelector('#ed-sets');
        if (setsEl) {
          const n = UI.clamp(+setsEl.value || ex.sets.length, 1, 8);
          while (ex.sets.length < n) ex.sets.push({ weight: ex.suggest || '', reps: '', done: false });
          ex.sets.length = n;
        }
        close(); persist(); syncOverride(); render(c, current.dateKey); UI.toast('Updated', 'good');
      };
    });
  }

  /* ---------- run session render ---------- */
  function renderRun(container) {
    const r = current.run, pl = App.Running.plan(Store.profile());
    const days = App.Running.daysToRace();
    const a = current.actual || {};
    container.innerHTML = `
      <div class="spread" style="margin-bottom:12px">
        <div>
          <div class="pill accent">${pl.phase} · Wk ${pl.weekIndex}</div>
          <div class="pill" style="margin-left:6px">${pl.dist.name}</div>
        </div>
        <button class="btn small ghost" id="wk-switch">🔄 Switch</button>
      </div>
      <h2 style="margin:4px 2px 6px;font-size:22px;letter-spacing:-.4px">${UI.esc(r.name)}</h2>
      <p class="muted" style="margin:0 0 14px;font-size:13px">${UI.esc(r.detail)}</p>

      ${runSuggestionHTML()}

      <div class="card">
        <div class="ring-wrap">
          <div style="flex:1;display:flex;flex-direction:column;gap:14px">
            <div class="spread"><span class="muted">Target pace</span><b style="font-size:18px">${r.paceLabel} <span class="muted" style="font-size:13px">/mi</span></b></div>
            <div class="spread"><span class="muted">Distance</span><b style="font-size:18px">${r.miles} mi</b></div>
            <div class="spread"><span class="muted">Est. time</span><b style="font-size:18px">${App.Running.paceStr(r.paceSec * r.miles)}</b></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <b>Log your run</b>
        <div class="inline-fields" style="margin-top:12px">
          <div class="field" style="margin:0"><label>Distance (mi)</label><input class="input" id="run-mi" type="number" inputmode="decimal" value="${a.miles||r.miles}"></div>
          <div class="field" style="margin:0"><label>Time (min)</label><input class="input" id="run-min" type="number" inputmode="decimal" value="${a.min||''}" placeholder="min"></div>
        </div>
        <div id="run-pace" class="last-hint" style="margin-top:8px"></div>
      </div>

      <button class="btn ${current.done?'':'primary'}" id="run-done" style="margin-top:14px">${current.done?'✓ Run logged':'Complete run'}</button>
      ${days!=null ? `<p class="muted center" style="font-size:12px;margin-top:14px">${days} days to race · goal ${App.Running.paceStr(pl.goalPaceSec)}/mi pace</p>` : ''}
    `;
    const mi = container.querySelector('#run-mi'), min = container.querySelector('#run-min');
    const showPace = () => {
      const d = +mi.value, t = +min.value;
      container.querySelector('#run-pace').textContent = (d > 0 && t > 0) ? `Your pace: ${App.Running.paceStr(t*60/d)} /mi` : '';
    };
    mi.addEventListener('input', showPace); min.addEventListener('input', showPace); showPace();
    container.querySelector('#wk-switch').onclick = () => switchSheet(container);
    const swap = container.querySelector('#run-swap');
    if (swap) swap.onclick = () => { Store.setDayChoice(current.dateKey, 'run:' + swap.dataset.to, false); renderRun(container); UI.toast('Run updated', 'good'); };
    container.querySelector('#run-done').onclick = () => {
      current.done = !current.done;
      current.actual = { miles: +mi.value || r.miles, min: +min.value || 0 };
      persist();
      UI.toast(current.done ? 'Run logged 🏃' : 'Marked incomplete', 'good');
      renderRun(container);
    };
  }

  function runSuggestionHTML() {
    const s = App.Running.suggestion();
    const cls = s.tone === 'bad' ? 'warn' : s.tone === 'warn' ? 'warn' : s.tone === 'good' ? 'good' : 'info';
    const ico = s.tone === 'bad' ? '🚑' : s.tone === 'warn' ? '⚠️' : s.tone === 'good' ? '✅' : '🧭';
    return `<div class="banner ${cls}" style="margin-bottom:14px"><span class="b-ico">${ico}</span><div><b>${UI.esc(s.title)}</b>${UI.esc(s.text)}${s.swapTo ? ` <button class="link" id="run-swap" data-to="${s.swapTo}" style="color:var(--accent);font-weight:700">Switch to ${s.swapTo} ▸</button>` : ''}</div></div>`;
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
        // Snapshot prior bests BEFORE marking done (current log is live by reference).
        let prevBest = 0, prevMaxW = 0;
        if (!set.done && (ex.type === 'main' || ex.type === 'acc')) {
          const hist = Store.exerciseHistory(ex.key);
          prevBest = hist.reduce((mx, h) => Math.max(mx, epley1RM(h.weight, h.reps)), 0);
          prevMaxW = hist.reduce((mx, h) => Math.max(mx, h.weight), 0);
        }
        set.done = !set.done;
        let prMsg = null;
        if (set.done) {
          if (set.weight === '' && ex.suggest) set.weight = ex.suggest;
          if (set.reps === '' && ex.type !== 'cond') { const m = String(ex.reps).match(/\d+/); set.reps = m ? +m[0] : 10; }
          if ((ex.type === 'main' || ex.type === 'acc') && set.weight > 0 && set.reps > 0) {
            const e1 = epley1RM(+set.weight, +set.reps);
            if (prevBest > 0 && e1 > prevBest + 0.01) { set.pr = '1RM'; prMsg = `🏆 Estimated 1RM PR — ${set.weight} × ${set.reps}`; }
            else if (prevMaxW > 0 && +set.weight > prevMaxW) { set.pr = 'weight'; prMsg = `🏆 Weight PR — ${set.weight} lb`; }
            else set.pr = null;
          }
        } else { set.pr = null; }
        persist();
        render(container, current.dateKey);
        if (set.done) {
          if (prMsg) UI.toast(prMsg, 'good');
          else UI.toast('Set logged', 'good');
          const p = Store.profile();
          if (p.restTimerOn && ex.type !== 'cond' && App.Timer) App.Timer.start(p.restTimer || 120);
        } else { App.Timer && App.Timer.stop(); }
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
    const plates = container.querySelector('#wk-plates');
    if (plates) plates.addEventListener('click', () => {
      const firstMain = current.exercises.find(e => e.type === 'main');
      plateSheet(firstMain && firstMain.suggest ? firstMain.suggest : 135);
    });
    container.querySelectorAll('[data-quickadd]').forEach(b => b.addEventListener('click', () => quickAdd(b.dataset.quickadd, container)));
    container.querySelectorAll('[data-swapex]').forEach(b => b.addEventListener('click', () => swapSheet(+b.dataset.swapex, container)));
    const shuf = container.querySelector('#wk-shuffle');
    if (shuf) shuf.addEventListener('click', () => shuffleSession(container));
  }

  // Add a weak-point accessory to this day (sticks for future sessions of this type).
  function quickAdd(key, c) {
    const def = DATA.ALL[key]; if (!def) return;
    current.exercises.push(makeInstance(def, current.bias));
    current.customized = true; rebalance(); persist(); syncOverride();
    render(c, current.dateKey);
    UI.toast(def.name + ' added to bring up your weak point', 'good');
  }

  /* ---------- choose / switch today's workout ---------- */
  const SWITCH_GROUPS = [
    { label: 'Push / Pull / Legs', items: ['push', 'pull', 'legs'] },
    { label: 'Upper / Lower', items: ['upperA', 'lowerA', 'upperB', 'lowerB'] },
    { label: 'Full Body', items: ['fullA', 'fullB', 'fullC'] },
    { label: 'Other', items: ['conditioning', 'rest'] },
  ];
  // The day AFTER whatever you last actually trained (within this split's
  // rotation). Switching a day therefore carries the rotation forward from it.
  function nextInRotation(rotation) {
    const logs = Store.allWorkoutLogs();   // completed sessions, newest first
    for (const l of logs) {
      const idx = rotation.indexOf(l.dayType);
      if (idx >= 0) return rotation[(idx + 1) % rotation.length];
    }
    return rotation[0];
  }
  // Next workout in the rotation (what "adaptive" recommends today).
  function nextRotationType() {
    const pl = App.Goals.plan();
    const rot = (DATA.SPLITS[pl.split] || DATA.SPLITS.upperlower).rotation;
    return nextInRotation(rot);
  }

  /* ---------- forward plan (adaptive calendar) ---------- */
  function dayTypeName(t) {
    if (!t || t === 'rest') return 'Rest';
    if (t === 'conditioning') return 'Conditioning';
    if (String(t).startsWith('rt_')) { const r = Store.getRoutine(t); return r ? r.name : 'Routine'; }
    return (DATA.DAYS[t] && DATA.DAYS[t].name) || t;
  }
  // Project the upcoming days into a concrete plan. Honors days you've already
  // trained and any day you've switched, and continues the rotation from there —
  // so switching a day (or an exercise, which changes that day type everywhere)
  // ripples forward automatically.
  function projectPlan(days) {
    days = days || 21;
    const pl = App.Goals.plan();
    const rotation = (DATA.SPLITS[pl.split] || DATA.SPLITS.upperlower).rotation;
    const mode = Store.profile().scheduleMode || 'flexible';
    const wk = DATA.buildSchedule(pl.split, pl.days, pl.cardio);   // weekday → type
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let ri = rotation.indexOf(nextInRotation(rotation)); if (ri < 0) ri = 0;
    for (let i = 0; i < days; i++) {
      const dt = new Date(today); dt.setDate(today.getDate() + i);
      const dk = Store.todayKey(dt), wd = dt.getDay();
      const choice = Store.getDayChoice(dk);
      const log = Store.workoutLog(dk);
      const trained = !!(log && (log.exercises || []).some(e => (e.sets || []).some(s => s.done)));
      let type, src;
      if (choice) { type = choice.type; src = 'choice'; if (rotation.includes(type)) ri = rotation.indexOf(type) + 1; }
      else if (i === 0 && log) { type = log.dayType; src = trained ? 'done' : 'today'; if (rotation.includes(type)) ri = rotation.indexOf(type) + 1; }
      else if (i === 0) { type = mode === 'flexible' ? rotation[ri % rotation.length] : wk[wd]; src = 'today'; if (rotation.includes(type)) ri = rotation.indexOf(type) + 1; }
      else {
        if (mode === 'flexible') {
          if (wk[wd] === 'rest') type = 'rest';
          else if (wk[wd] === 'conditioning') type = 'conditioning';
          else { type = rotation[ri % rotation.length]; ri++; }
        } else type = wk[wd];
        src = 'plan';
      }
      out.push({
        dateKey: dk, date: dt, weekday: wd, type, name: dayTypeName(type),
        rest: (!type || type === 'rest'), trained, isToday: i === 0,
        choice: !!choice, deload: !!(choice && choice.deload),
        count: ((DATA.DAYS[type] && DATA.DAYS[type].exercises) || []).length,
      });
    }
    return out;
  }
  // Pick / switch the workout for a specific date (used by the calendar).
  function planDaySheet(dateKey, cb) {
    const cur = Store.getDayChoice(dateKey);
    const d = new Date(dateKey + 'T00:00:00');
    const label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    UI.modal(`
      <h2>${label}</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Pick this day's workout. The days after it shift to follow.</p>
      ${SWITCH_GROUPS.map(g => `
        <div class="meal-head"><b>${g.label}</b><span></span></div>
        ${g.items.map(k => { const day = DATA.DAYS[k]; const sub = k === 'rest' ? 'Recovery' : k === 'conditioning' ? 'Cardio' : `${(day.exercises || []).length} exercises`;
          return `<div class="search-result ${cur && cur.type === k ? 'me' : ''}" data-pick="${k}"><div class="sr-main"><b>${UI.esc(day.name)}</b><small>${sub}</small></div><div style="color:var(--accent);font-size:20px">${cur && cur.type === k ? '✓' : '→'}</div></div>`; }).join('')}`).join('')}
      ${Store.routines().length ? `<div class="meal-head"><b>My Routines</b><span></span></div>${Store.routines().map(r => `<div class="search-result ${cur && cur.type === r.id ? 'me' : ''}" data-pick="${r.id}"><div class="sr-main"><b>${UI.esc(r.name)}</b><small>${r.exercises.length} exercises</small></div><div style="color:var(--accent);font-size:20px">→</div></div>`).join('')}` : ''}
      ${cur ? `<button class="btn ghost" id="pd-clear" style="margin-top:10px">↺ Back to automatic</button>` : ''}
    `, (m, close) => {
      m.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { Store.setDayChoice(dateKey, el.dataset.pick, false); close(); if (cb) cb(); });
      const cl = m.querySelector('#pd-clear'); if (cl) cl.onclick = () => { Store.clearDayChoice(dateKey); close(); if (cb) cb(); };
    });
  }
  // A session that avoids a sore area.
  function complementFor(soreArea) {
    if (soreArea === 'legs') return 'upperA';
    if (soreArea === 'upper') return 'legs';
    if (soreArea === 'push') return 'pull';
    if (soreArea === 'pull') return 'push';
    return 'conditioning';
  }

  function switchSheet(container) {
    const cur = current ? current.dayType : null;
    const next = nextRotationType();
    const nextName = DATA.DAYS[next].name;
    const runner = App.Running && App.Running.active();
    const RUN_TYPES = [['easy','Easy Run'],['long','Long Run'],['tempo','Tempo'],['interval','Intervals'],['recovery','Recovery']];
    UI.modal(`
      <h2>Today's workout</h2>
      <p class="muted" style="margin:-8px 0 14px;font-size:13px">Pick what to train today, or let it adapt to how you feel. This only changes today.</p>

      ${runner ? `
        <div class="meal-head"><b>Runs</b><span>tap to set today</span></div>
        ${RUN_TYPES.map(([t, l]) => `<div class="search-result" data-run="${t}"><div class="sr-main"><b>${l}</b><small>${App.Running.paceStr(App.Running.plan().paces[t === 'long' ? 'long' : t === 'tempo' ? 'tempo' : t === 'interval' ? 'interval' : t === 'recovery' ? 'recovery' : 'easy'])} /mi</small></div><div style="color:var(--accent);font-size:22px">→</div></div>`).join('')}
      ` : `
        <div class="meal-head"><b>Recommended</b><span></span></div>
        <div class="search-result rec" data-day="${next}">
          <div class="sr-main"><b>${UI.esc(nextName)}</b><small>Next up in your rotation</small></div>
          <div style="color:var(--accent);font-size:22px">→</div>
        </div>`}

      <div class="meal-head"><b>Adjust for how you feel</b><span></span></div>
      <div class="search-result" data-adapt="deload"><div class="sr-main"><b>Sore or tired — go lighter</b><small>Deload: fewer sets, leave 3–4 reps in reserve</small></div><div style="font-size:20px">🪫</div></div>
      <div class="search-result" data-sore="legs"><div class="sr-main"><b>Legs are sore — train upper</b><small>Switch to an upper-body session</small></div><div style="font-size:20px">💪</div></div>
      <div class="search-result" data-sore="upper"><div class="sr-main"><b>Upper is sore — train legs</b><small>Switch to a leg session</small></div><div style="font-size:20px">🦵</div></div>
      <div class="search-result" data-day="conditioning"><div class="sr-main"><b>Active recovery</b><small>Easy cardio / conditioning instead</small></div><div style="font-size:20px">🏃</div></div>
      <div class="search-result" data-day="rest"><div class="sr-main"><b>Take a rest day</b><small>Full recovery</small></div><div style="font-size:20px">🛌</div></div>

      ${Store.routines().length ? `<div class="meal-head"><b>My Routines</b><span></span></div>
        ${Store.routines().map(r => `<div class="search-result ${r.id === cur ? 'me' : ''}" data-day="${r.id}">
          <div class="sr-main"><b>${UI.esc(r.name)}</b><small>${r.exercises.length} exercises · your routine</small></div>
          <button class="icon-btn" data-rtdel="${r.id}" style="width:30px;height:30px;color:var(--faint);font-size:18px">×</button>
        </div>`).join('')}` : ''}
      <button class="btn ghost" id="sw-newroutine" style="margin-top:8px">＋ Create a routine</button>

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
      <button class="btn ghost" id="sw-reset" style="margin-top:10px">Use the scheduled / next workout</button>
    `, (m, close) => {
      const choose = (type, deload) => { Store.setDayChoice(current.dateKey, type, deload); close(); render(container, current.dateKey); UI.toast(deload ? 'Deload day set' : 'Workout set', 'good'); };
      m.querySelectorAll('[data-day]').forEach(el => el.onclick = (e) => { if (e.target.closest('[data-rtdel]')) return; choose(el.dataset.day, false); });
      m.querySelectorAll('[data-run]').forEach(el => el.onclick = () => choose('run:' + el.dataset.run, false));
      m.querySelectorAll('[data-sore]').forEach(el => el.onclick = () => choose(complementFor(el.dataset.sore), false));
      m.querySelectorAll('[data-rtdel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); Store.removeRoutine(b.dataset.rtdel); close(); switchSheet(container); });
      m.querySelector('[data-adapt="deload"]').onclick = () => choose(next, true);
      m.querySelector('#sw-newroutine').onclick = () => { close(); routineBuilder(container); };
      m.querySelector('#sw-reset').onclick = () => { Store.clearDayChoice(current.dateKey); close(); render(container, current.dateKey); UI.toast('Reset'); };
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
    container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editDetailsSheet(+b.dataset.edit, container));
    container.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => swapSheet(+b.dataset.swap, container));
    container.querySelectorAll('[data-sets]').forEach(b => b.onclick = () => changeSets(+b.dataset.sets, +b.dataset.d, container));
    const add = container.querySelector('#wk-add'); if (add) add.onclick = () => picker('add', null, container);
    const reset = container.querySelector('#wk-reset'); if (reset) reset.onclick = () => resetDay(container);
    const done = container.querySelector('#wk-doneedit'); if (done) done.onclick = () => { editMode = false; render(container, current.dateKey); UI.toast('Routine updated', 'good'); };
    const info = container.querySelector('#wk-info'); if (info) info.onclick = coachSheet;
  }

  // Re-order MJ-first and re-pair antagonist supersets after an edit, so the
  // rest of the session automatically adjusts around a change.
  function rebalance() {
    current.exercises.forEach(e => { delete e.ss; });
    current.exercises = arrange(current.exercises);
  }
  function removeExercise(i, c) {
    if (current.exercises.length <= 1) return UI.toast('Keep at least one exercise');
    current.exercises.splice(i, 1); rebalance(); persist(); syncOverride(); render(c, current.dateKey);
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
    current.customized = true; rebalance(); persist(); syncOverride();
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
    current.exercises[i] = inst;
    rebalance();                       // auto-adjust ordering + supersets around the swap
    current.customized = true; persist(); syncOverride(); render(c, current.dateKey);
    UI.toast('Swapped — session rebalanced', 'good');
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

  // Generic exercise picker → calls onPick(def). Reused by edit, routines.
  function libraryPicker(title, onPick) {
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
      <h2>${title}</h2>
      <input class="input" id="lib-q" placeholder="Search exercises…" autocomplete="off">
      <button class="btn ghost small" id="lib-custom" style="margin-top:10px;width:100%">✏️ Add a custom exercise</button>
      <div id="lib-list" style="margin-top:12px">${list}</div>
    `, (m, close) => {
      m.querySelectorAll('[data-key]').forEach(el => el.onclick = () => { const def = DATA.ALL[el.dataset.key]; close(); onPick(def); });
      m.querySelector('#lib-custom').onclick = () => { close(); customExercise(onPick); };
      m.querySelector('#lib-q').addEventListener('input', e => {
        const t = e.target.value.toLowerCase();
        m.querySelectorAll('#lib-list .search-result').forEach(el => el.style.display = el.textContent.toLowerCase().includes(t) ? '' : 'none');
        m.querySelectorAll('#lib-list .meal-head').forEach(h => h.style.display = t ? 'none' : '');
      });
    });
  }
  function picker(mode, idx, c) {
    libraryPicker(mode === 'swap' ? 'Swap exercise' : 'Add exercise', def => mode === 'swap' ? swapExercise(idx, def, c) : addExerciseByDef(def, c));
  }

  // Smart swap suggestions: closest variants first, then same-muscle options.
  function suggestSwaps(ex) {
    const out = [], seen = new Set([ex.key]);
    const add = k => { if (!seen.has(k) && DATA.ALL[k]) { seen.add(k); out.push(k); } };
    if (ex.type === 'cond') {
      Object.values(DATA.ALL).forEach(o => { if (o.type === 'cond') add(o.key); });
      return out.filter(k => k !== ex.key).slice(0, 8);
    }
    (POOL_OF[ex.key] || []).forEach(add);                 // direct variants
    const muscle = ex.muscle || DATA.MUSCLE[ex.key];
    const cat = (DATA.ALL[ex.key] || {}).cat;
    Object.values(DATA.ALL).forEach(o => { if (o.type !== 'cond' && muscle && o.muscle === muscle && o.type === ex.type) add(o.key); });
    Object.values(DATA.ALL).forEach(o => { if (o.type !== 'cond' && muscle && o.muscle === muscle) add(o.key); });
    Object.values(DATA.ALL).forEach(o => { if (o.type !== 'cond' && !muscle && o.cat === cat) add(o.key); });
    return out.slice(0, 8);
  }
  function swapSheet(i, c) {
    const ex = current.exercises[i];
    const sugg = suggestSwaps(ex);
    const have = new Set(current.exercises.map(e => e.key));
    const row = k => {
      const d = DATA.ALL[k];
      return `<div class="search-result" data-swapkey="${k}">
        <div class="food-thumb">${CAT_EMOJI[d.cat] || '🏋️'}</div>
        <div class="sr-main"><b>${UI.esc(d.name)}</b><small>${typeLabel(d.type)}${d.stretch ? ' · stretch' : ''}${have.has(k) ? ' · already today' : ''}</small></div>
        <div style="color:var(--accent);font-size:22px">⇄</div></div>`;
    };
    UI.modal(`
      <h2>Swap ${UI.esc(ex.name)}</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Alternatives that train the same muscle. Your sets, reps and progress target carry over.</p>
      <div class="meal-head"><b>Suggested swaps</b><span></span></div>
      ${sugg.length ? sugg.map(row).join('') : '<p class="muted" style="padding:10px 4px">No close matches — browse the full library.</p>'}
      <button class="btn ghost" id="sw-rand" style="margin-top:12px">🎲 Shuffle this one</button>
      <button class="btn ghost" id="sw-lib" style="margin-top:10px">Browse full library ▸</button>
    `, (m, close) => {
      m.querySelector('#sw-rand').onclick = () => { close(); shuffleOne(i, c); };
      m.querySelectorAll('[data-swapkey]').forEach(el => el.onclick = () => { const def = DATA.ALL[el.dataset.swapkey]; close(); swapExercise(i, def, c); });
      m.querySelector('#sw-lib').onclick = () => { close(); picker('swap', i, c); };
    });
  }

  /* ---------- shuffle (random re-roll, this session only — not pinned) ---------- */
  // A different variant from the pool (or a same-muscle suggestion), avoiding
  // anything already in today's session.
  function rerollKey(curKey, used, ex) {
    const pool = POOL_OF[curKey];
    let opts = pool ? pool.filter(k => k !== curKey && !used.has(k)) : [];
    if (!opts.length && ex) opts = suggestSwaps(ex).filter(k => !used.has(k));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }
  // Swap in a new exercise for THIS session without pinning it as the day's
  // override — so automatic per-session variation keeps working next time.
  function replaceForToday(i, key) {
    const old = current.exercises[i];
    current.exercises[i] = makeInstance(Object.assign({}, DATA.ALL[key], { sets: old.sets.length }), current.bias);
  }
  function shuffleOne(i, c) {
    const ex = current.exercises[i];
    if (ex.sets.some(s => s.done)) return UI.toast('Already logged — use ⇄ to swap');
    const used = new Set(current.exercises.map(e => e.key));
    const key = rerollKey(ex.key, used, ex);
    if (!key) return UI.toast('No alternative found for that one');
    replaceForToday(i, key);
    rebalance(); persist(); render(c, current.dateKey);
    UI.toast('🎲 Swapped in ' + DATA.ALL[key].name, 'good');
  }
  function shuffleSession(c) {
    const used = new Set(current.exercises.map(e => e.key));
    let changed = 0;
    current.exercises.forEach((ex, idx) => {
      if (ex.type !== 'acc' || ex.sets.some(s => s.done)) return;   // keep anchors & logged work
      const key = rerollKey(ex.key, used);
      if (!key) return;
      used.delete(ex.key); used.add(key);
      replaceForToday(idx, key); changed++;
    });
    if (!changed) return UI.toast('Nothing to shuffle — accessories are logged or fixed');
    rebalance(); persist(); render(c, current.dateKey);
    UI.toast('🎲 Shuffled ' + changed + ' exercise' + (changed > 1 ? 's' : ''), 'good');
  }

  function customExercise(onPick) {
    UI.modal(`
      <h2>Custom exercise</h2>
      ${UI.field('Name', `<input class="input" id="cx-name" placeholder="e.g. Landmine Press">`)}
      ${UI.field('Type', `<select class="input" id="cx-type">
        <option value="main">Main lift (heavy)</option>
        <option value="acc" selected>Accessory</option>
        <option value="abs">Core / abs</option>
        <option value="cond">Cardio / conditioning</option>
      </select>`)}
      <button class="btn primary" id="cx-go">Add</button>
    `, (m, close) => {
      m.querySelector('#cx-go').onclick = () => {
        const name = m.querySelector('#cx-name').value.trim();
        if (!name) return UI.toast('Name it first');
        const type = m.querySelector('#cx-type').value;
        close();
        onPick({ key: 'custom_' + Date.now(), name, type, sets: type === 'cond' ? 1 : 3, reps: type === 'cond' ? '20–30 min' : undefined });
      };
    });
  }

  /* ---------- routine builder (reusable user templates) ---------- */
  function routineBuilder(container, existing) {
    const draft = existing ? existing.exercises.map(e => ({ ...e })) : [];
    let name = existing ? existing.name : '';
    const open = () => {
      UI.modal(`
        <h2>${existing ? 'Edit' : 'New'} routine</h2>
        ${UI.field('Name', `<input class="input" id="rt-name" placeholder="e.g. My Push Day" value="${UI.esc(name)}">`)}
        <div id="rt-list">${draft.length ? draft.map((e, i) => {
          const def = DATA.ALL[e.key] || e.custom || {};
          return `<div class="search-result"><div class="sr-main"><b>${UI.esc((def.name) || e.key)}</b><small>${e.sets || 3} sets</small></div><button class="icon-btn" data-rtrm="${i}" style="width:30px;height:30px;color:var(--bad)">×</button></div>`;
        }).join('') : '<p class="muted" style="text-align:center;padding:14px">No exercises yet.</p>'}</div>
        <button class="btn" id="rt-add" style="margin-top:8px">＋ Add exercise</button>
        <button class="btn primary" id="rt-save" style="margin-top:12px">Save routine</button>
      `, (m, close) => {
        m.querySelector('#rt-name').addEventListener('input', e => name = e.target.value);
        m.querySelectorAll('[data-rtrm]').forEach(b => b.onclick = () => { draft.splice(+b.dataset.rtrm, 1); close(); open(); });
        m.querySelector('#rt-add').onclick = () => { name = m.querySelector('#rt-name').value; close(); libraryPicker('Add to routine', def => { draft.push(def.key && DATA.ALL[def.key] ? { key: def.key, sets: def.sets || 3 } : { key: def.key, custom: { name: def.name, type: def.type, reps: def.reps }, sets: def.sets || 3 }); open(); }); };
        m.querySelector('#rt-save').onclick = () => {
          name = m.querySelector('#rt-name').value.trim();
          if (!name) return UI.toast('Name it first');
          if (!draft.length) return UI.toast('Add at least one exercise');
          if (existing) { existing.name = name; existing.exercises = draft; Store.save(); }
          else Store.addRoutine(name, draft);
          close(); UI.toast('Routine saved', 'good');
          if (container) switchSheet(container);
        };
      });
    };
    open();
  }

  /* ---------- plate calculator ---------- */
  const PLATES = [45, 35, 25, 10, 5, 2.5];
  function plateSheet(startWeight) {
    UI.modal(`
      <h2>Plate calculator</h2>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Target weight</label><input class="input" id="pc-w" type="number" inputmode="decimal" value="${startWeight || 135}"></div>
        <div class="field" style="margin:0"><label>Bar</label><select class="input" id="pc-bar"><option value="45">45 lb</option><option value="35">35 lb</option><option value="15">15 lb</option><option value="0">none</option></select></div>
      </div>
      <div class="card" id="pc-out"></div>
    `, (m) => {
      const calc = () => {
        const target = +m.querySelector('#pc-w').value || 0;
        const bar = +m.querySelector('#pc-bar').value;
        let perSide = (target - bar) / 2;
        if (perSide < 0) { m.querySelector('#pc-out').innerHTML = `<span class="muted">Target is below the bar weight.</span>`; return; }
        const used = []; let rem = perSide;
        PLATES.forEach(pl => { while (rem >= pl - 1e-9) { used.push(pl); rem = +(rem - pl).toFixed(2); } });
        const counts = {};
        used.forEach(p => counts[p] = (counts[p] || 0) + 1);
        m.querySelector('#pc-out').innerHTML = `
          <div class="spread"><b>Per side</b><span class="muted">${perSide} lb</span></div>
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">
            ${used.length ? Object.keys(counts).map(p => `<span class="pill accent">${counts[p]} × ${p}</span>`).join('') : '<span class="muted">Just the bar</span>'}
          </div>
          ${rem > 0 ? `<div class="last-hint">${rem} lb/side not reachable with standard plates</div>` : ''}`;
      };
      m.querySelector('#pc-w').addEventListener('input', calc);
      m.querySelector('#pc-bar').addEventListener('change', calc);
      calc();
    });
  }

  function coachSheet() {
    const pl = App.Goals.plan();
    UI.modal(`<h2>Training notes</h2>
      <div class="card" style="line-height:1.55">
        <b>${UI.esc(pl.title)}</b><br>
        <span class="muted">Emphasis: ${UI.esc(App.Goals.biasLabel(pl.bias))}. <b>Double progression</b> — work to the top of the rep range across all sets, then add a little weight and drop back to the bottom. Heavy compounds stop 1–2 reps shy of failure; isolations earn the last rep.</span>
      </div>
      <div class="card" style="margin-top:12px;line-height:1.5">
        <b>How it's programmed</b>
        <ul class="guide-list">
          <li><b>Anchors stay, accessories rotate.</b> Big compounds repeat so you can add weight every week; isolations rotate variants each session for fresh stimulus.</li>
          <li><b>Volume:</b> 12–20 hard sets per muscle per week (synergists count ½), spread over ~2 sessions. Past ~8 sets for one muscle in a day is junk volume.</li>
          <li><b>Order:</b> compounds first while you're fresh; only antagonist isolations superset — never heavy lifts back-to-back.</li>
          <li><b>Long muscle lengths:</b> control and pause the stretch (incline curl, overhead triceps, RDL, deep squats); add lengthened partials past failure where flagged.</li>
          <li><b>Proximity to failure:</b> compounds 1–2 RIR, isolations 0–1 RIR — failure techniques live on isolations only.</li>
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
    // Every selectable strength movement the user has logged (not just the core E set).
    Object.values(DATA.ALL).forEach(ex => {
      if (ex.type === 'cond' || ex.cat === 'Cardio') return;
      const b = best1RM(ex.key); if (!b) return;
      out.push({ key: ex.key, name: ex.name, oneRM: b.oneRM,
        e5: weightForReps(b.oneRM, 5), e8: weightForReps(b.oneRM, 8), e10: weightForReps(b.oneRM, 10), e12: weightForReps(b.oneRM, 12), from: b.from });
    });
    out.sort((a, b) => b.oneRM - a.oneRM);
    return out;
  }

  /* ============================================================
     WEAK-POINT ANALYSIS — fractional weekly volume per muscle
     Direct sets count 1.0, synergist sets 0.5 (junk-volume aware).
     ============================================================ */
  function weeklyVolumeByMuscle(days) {
    days = days || 21;
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - days);
    const vol = {};
    Store.allWorkoutLogs().forEach(log => {
      if (!log || !log.dateKey || log.isRun) return;
      if (new Date(log.dateKey + 'T00:00:00') < cutoff) return;
      (log.exercises || []).forEach(ex => {
        const done = (ex.sets || []).filter(s => s.done).length;
        if (!done) return;
        const prim = (DATA.ALL[ex.key] && DATA.ALL[ex.key].muscle) || DATA.MUSCLE[ex.key];
        if (prim) vol[prim] = (vol[prim] || 0) + done;
        (DATA.SECONDARY[ex.key] || []).forEach(m => { vol[m] = (vol[m] || 0) + done * 0.5; });
      });
    });
    const weeks = days / 7;
    Object.keys(vol).forEach(k => { vol[k] = Math.round(vol[k] / weeks * 10) / 10; });
    return vol;   // { muscle: sets/week }
  }

  // Muscles tracked for weak-point flagging, and good accessory fixes for each.
  const TRACKED = ['chest', 'back', 'quads', 'hamstrings', 'side delts', 'rear delts', 'biceps', 'triceps', 'calves'];
  const MUSCLE_FIX = {
    chest:['inclineDB','cableFly'], back:['csRow','seatedRow'],
    quads:['legExt','legPress'], hamstrings:['legCurl','rdl'],
    'side delts':['lateral','cableLat'], 'rear delts':['facepull','rearDelt'],
    biceps:['inclineCurl','hammerCurl'], triceps:['pushdown','skull'], calves:['calfStand','calfSeat'],
  };
  // Returns lagging muscles (under ~10 effective sets/wk), worst first. Quiet until
  // there's enough history to judge (≥6 sessions), so beginners aren't nagged.
  function weakSpots() {
    if (Store.trainingDates().length < 6) return [];
    const vol = weeklyVolumeByMuscle(21);
    const TARGET = 10;
    const out = [];
    TRACKED.forEach(m => {
      const v = vol[m] || 0;
      if (v < TARGET) out.push({ muscle: m, sets: v, deficit: TARGET - v, suggest: MUSCLE_FIX[m] || [] });
    });
    return out.sort((a, b) => b.deficit - a.deficit);
  }

  return { build, render, epley1RM, weightForReps, best1RM, predict, estimatedLifts, anchorOneRM, startEstimate, weeklyVolumeByMuscle, weakSpots, projectPlan, dayTypeName, planDaySheet };
})();
