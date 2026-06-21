/* ============================================================
   Macro — goals & nutrition engine
   Pick one or more paths; the app derives calories, macros,
   a weight goal, training emphasis, and eating guidance.
   ============================================================ */
window.App = window.App || {};

App.Goals = (function () {
  const Store = App.Store, UI = App.UI;

  /* ---------- goal paths ----------
     calAdj   = % adjustment to maintenance calories
     dir      = weight direction (+1 gain, 0 maintain, -1 lose)
     rate     = target weekly change as a fraction of bodyweight
     proteinPerLb / fatPerLb = macro targets per lb bodyweight
     bias     = training rep emphasis  cardio = weekly cardio volume  */
  const GOALS = {
    physique:     { key:'physique',     name:'Build Muscle',   emoji:'🧱', short:'Add lean size',
                    blurb:'Hypertrophy training in a controlled surplus to add muscle.',
                    calAdj:0.12,  dir:1,  rate:0.004,  proteinPerLb:1.0, fatPerLb:0.35, bias:'hypertrophy', cardio:'low' },
    strength:     { key:'strength',     name:'Get Stronger',   emoji:'🏋️', short:'Maximize force',
                    blurb:'Heavy, low-rep compound work near maintenance to build strength.',
                    calAdj:0.06,  dir:1,  rate:0.002,  proteinPerLb:1.0, fatPerLb:0.35, bias:'strength',    cardio:'low' },
    conditioning: { key:'conditioning', name:'Conditioning',   emoji:'🏃', short:'Build your engine',
                    blurb:'Mixed cardio and circuits to raise work capacity and endurance.',
                    calAdj:0.0,   dir:0,  rate:0,      proteinPerLb:0.8, fatPerLb:0.30, bias:'endurance',   cardio:'high' },
    leanness:     { key:'leanness',     name:'Lose Fat',       emoji:'📉', short:'Get leaner',
                    blurb:'A moderate deficit with high protein to drop fat and keep muscle.',
                    calAdj:-0.20, dir:-1, rate:0.0065, proteinPerLb:1.1, fatPerLb:0.35, bias:'hypertrophy', cardio:'moderate' },
  };
  const GOAL_ORDER = ['physique','strength','conditioning','leanness'];

  const ACTIVITY = {
    sedentary:{ f:1.2,   label:'Sedentary — desk job, little exercise' },
    light:    { f:1.375, label:'Light — train 1–3×/week' },
    moderate: { f:1.55,  label:'Moderate — train 3–5×/week' },
    high:     { f:1.725, label:'High — train 6–7×/week' },
    athlete:  { f:1.9,   label:'Athlete — twice-daily / physical job' },
  };
  const CARDIO_RANK = { low:0, moderate:1, high:2 };

  /* ---------- maintenance (Mifflin-St Jeor TDEE) ---------- */
  function tdee(profile, weight) {
    const kg = (weight || profile.startWeight || 160) / 2.2046;
    const cm = (profile.heightIn || 70) * 2.54;
    const age = +profile.age || 25;
    const bmr = 10 * kg + 6.25 * cm - 5 * age + (profile.sex === 'female' ? -161 : 5);
    return bmr * (ACTIVITY[profile.activity] ? ACTIVITY[profile.activity].f : 1.55);
  }

  /* ---------- combine selected goals ---------- */
  function combine(keys) {
    const sel = (keys && keys.length ? keys : ['physique']).map(k => GOALS[k]).filter(Boolean);
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const calAdj = avg(sel.map(g => g.calAdj));
    const dirSum = sel.reduce((a, g) => a + g.dir, 0);
    const dir = dirSum > 0 ? 1 : dirSum < 0 ? -1 : 0;
    const rate = dir === 0 ? 0 : avg(sel.filter(g => g.dir !== 0).map(g => g.rate)) || 0;
    const proteinPerLb = Math.max(...sel.map(g => g.proteinPerLb));
    const fatPerLb = Math.max(...sel.map(g => g.fatPerLb));
    const cardio = sel.reduce((a, g) => CARDIO_RANK[g.cardio] > CARDIO_RANK[a] ? g.cardio : a, 'low');
    // rep emphasis: strength wins for mains; else hypertrophy; else endurance
    const has = k => sel.some(g => g.key === k);
    const bias = has('strength') ? (has('physique') ? 'power' : 'strength')
               : (has('physique') || has('leanness')) ? 'hypertrophy' : 'endurance';
    return { calAdj, dir, rate, proteinPerLb, fatPerLb, cardio, bias, keys: sel.map(g => g.key) };
  }

  function horizonWeeks(profile) {
    if (profile.targetDate) {
      const d = Store.dayDiff(Store.todayKey(), profile.targetDate);
      if (d > 6) return Math.max(1, Math.round(d / 7));
    }
    return 8;
  }

  /* ---------- the plan ---------- */
  function plan(profile, weight) {
    profile = profile || Store.profile();
    weight = weight || Store.latestWeight();
    const c = combine(profile.goals);
    const tdeeVal = tdee(profile, weight);
    const cal = Math.max(1200, Math.round(tdeeVal * (1 + c.calAdj) / 10) * 10);
    const protein = Math.round(c.proteinPerLb * weight);
    const fat = Math.round(c.fatPerLb * weight);
    const carbs = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
    const weeklyRate = c.dir === 0 ? 0 : +(c.rate * weight).toFixed(1);
    const horizon = horizonWeeks(profile);
    const targetWeight = c.dir === 0 ? Math.round(weight) : Math.round(weight + c.dir * weeklyRate * horizon);
    return {
      tdee: Math.round(tdeeVal), cal, protein, carbs, fat,
      dir: c.dir, weeklyRate, targetWeight, horizon, bias: c.bias, cardio: c.cardio,
      keys: c.keys, title: titleFor(c.keys), guide: guideFor(c, weeklyRate),
    };
  }

  function titleFor(keys) {
    if (keys.length === 1) return GOALS[keys[0]].name;
    return keys.map(k => GOALS[k].short).join(' + ');
  }

  function biasLabel(bias) {
    return bias === 'strength' ? 'Heavy strength (low reps)'
      : bias === 'power' ? 'Strength + size (4–8 reps)'
      : bias === 'hypertrophy' ? 'Hypertrophy (8–15 reps)'
      : 'Endurance + circuits (higher reps)';
  }

  function guideFor(c, weeklyRate) {
    const g = [];
    if (c.dir > 0) g.push(`Eat in a surplus — aim to gain about ${weeklyRate} lb/week. If the scale stalls, add ~250 cal.`);
    else if (c.dir < 0) g.push(`Eat in a moderate deficit — aim to lose about ${weeklyRate} lb/week. Keep protein high to hold muscle.`);
    else g.push(`Eat around maintenance — bodyweight should stay roughly stable while you recomposition.`);
    g.push(`Hit your protein target every day: spread it across 3–4 meals (lean meats, eggs, dairy, whey).`);
    if (c.cardio !== 'low') g.push(`Fuel cardio with whole-food carbs (oats, rice, potatoes, fruit) around your sessions.`);
    else g.push(`Build plates around a protein source, a dense carb, and a portion of healthy fat.`);
    if (c.dir < 0) g.push(`Lean on high-volume, filling foods (vegetables, lean protein) to manage hunger.`);
    else if (c.dir > 0) g.push(`If eating enough is hard, use liquid calories — milk, shakes, nut butters.`);
    return g;
  }

  /* ---------- recompute & persist into the active profile ---------- */
  function recompute() {
    const p = Store.profile();
    const pl = plan(p);
    const patch = { weightDir: pl.dir, weeklyRate: pl.weeklyRate, targetWeight: pl.targetWeight };
    if (!p.customMacros) { patch.cal = pl.cal; patch.protein = pl.protein; patch.carbs = pl.carbs; patch.fat = pl.fat; }
    Store.setProfile(patch);
    return pl;
  }

  /* ---------- reusable UI pieces ---------- */
  function goalChips(selected) {
    const sel = selected || [];
    return `<div class="goal-grid" id="goal-grid">${GOAL_ORDER.map(k => {
      const g = GOALS[k]; const on = sel.includes(k);
      return `<button type="button" class="goal-chip ${on ? 'on' : ''}" data-goal="${k}">
        <span class="gc-emoji">${g.emoji}</span><b>${g.name}</b><small>${g.short}</small></button>`;
    }).join('')}</div>`;
  }
  function wireGoalChips(root, arr) {
    root.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => {
      const k = b.dataset.goal, i = arr.indexOf(k);
      if (i >= 0) { if (arr.length > 1) arr.splice(i, 1); }   // keep at least one
      else arr.push(k);
      b.classList.toggle('on', arr.includes(k));
    });
  }
  function sexSelect(v) {
    return `<select class="input" id="g-sex">
      <option value="male" ${v==='male'?'selected':''}>Male</option>
      <option value="female" ${v==='female'?'selected':''}>Female</option></select>`;
  }
  function activitySelect(v) {
    return `<select class="input" id="g-act">${Object.keys(ACTIVITY).map(k =>
      `<option value="${k}" ${k===(v||'moderate')?'selected':''}>${ACTIVITY[k].label}</option>`).join('')}</select>`;
  }

  function planSummary(pl) {
    const dirTxt = pl.dir > 0 ? `Gain to ${pl.targetWeight} lb` : pl.dir < 0 ? `Cut to ${pl.targetWeight} lb` : `Maintain ~${pl.targetWeight} lb`;
    const rate = pl.dir === 0 ? 'hold weight' : `${pl.weeklyRate} lb/week`;
    return `
      <div class="card">
        <div class="spread"><b>${UI.esc(pl.title)}</b><span class="pill accent">${pl.cal} cal/day</span></div>
        <div class="macro-row" style="margin-top:12px">
          ${macroPill('Protein', pl.protein)}${macroPill('Carbs', pl.carbs)}${macroPill('Fat', pl.fat)}
        </div>
        <div class="divider"></div>
        <div class="spread"><span class="muted">Weight goal</span><b>${dirTxt}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Target rate</span><b>${rate}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Training</span><b>${biasLabel(pl.bias)}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Maintenance</span><b>~${pl.tdee} cal</b></div>
      </div>`;
  }
  function macroPill(name, g) {
    return `<div class="macro-pill"><b>${g}g</b><small>${name}</small></div>`;
  }
  function guideCard(pl) {
    return `<div class="card"><b>What to eat</b><ul class="guide-list">${pl.guide.map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>`;
  }

  return { GOALS, GOAL_ORDER, ACTIVITY, tdee, plan, recompute, biasLabel,
           goalChips, wireGoalChips, sexSelect, activitySelect, planSummary, guideCard };
})();
