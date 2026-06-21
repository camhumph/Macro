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
    marathon:     { key:'marathon',     name:'Race Training',  emoji:'🏃', short:'Run a race',
                    blurb:'A paced, periodized plan toward a goal race time. Set up your race below.',
                    calAdj:0, dir:0, rate:0, proteinPerLb:0.8, fatPerLb:0.3, bias:'endurance', cardio:'high' },
  };
  const GOAL_ORDER = ['physique','strength','conditioning','leanness','marathon'];

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

  // default split when the user hasn't chosen one ('auto')
  function defaultSplit(keys, cardio) {
    if (keys.length === 1 && keys[0] === 'conditioning') return 'fullbody';
    if (cardio === 'high') return 'fullbody';
    return 'upperlower';
  }

  function horizonWeeks(profile) {
    if (profile.targetDate) {
      const d = Store.dayDiff(Store.todayKey(), profile.targetDate);
      if (d > 6) return Math.max(1, Math.round(d / 7));
    }
    return 8;
  }

  /* ---------- the plan ---------- */
  // Bulking pace (fraction of bodyweight gained per week).
  const GAIN_RATES = { lean: 0.002, moderate: 0.004, aggressive: 0.0075, max: 0.012 };

  // Expected lean fraction of weight gained, from surplus research
  // (Garthe/Sanchez/Helms): slower gain → more of it is lean.
  function leanFraction(ratePctPerWeek) {
    return UI.clamp(0.85 - 0.818 * (ratePctPerWeek - 0.16), 0.5, 0.9);
  }
  // Composition of expected weight gain for the active plan.
  function composition(profile, weight) {
    const pl = plan(profile, weight);
    if (pl.dir <= 0) return null;
    const w = weight || Store.latestWeight();
    const ratePct = (pl.weeklyRate / w) * 100;
    const leanPct = leanFraction(ratePct);
    return {
      weeklyRate: pl.weeklyRate, leanPct: Math.round(leanPct * 100), fatPct: Math.round((1 - leanPct) * 100),
      // glycogen + creatine water is a one-time front-loaded bump (not ongoing)
      waterLb: weight ? Math.round(UI.clamp(w * 0.03, 4, 9)) : 6,
    };
  }
  function gainRateSelect(v) {
    const o = [['lean','Lean (~0.2%/wk · most muscle)'],['moderate','Moderate (~0.4%/wk)'],['aggressive','Aggressive (~0.75%/wk)'],['max','Max (~1.2%/wk · most fat)']];
    return `<select class="input" id="g-rate">${o.map(([k,l]) => `<option value="${k}" ${k===(v||'moderate')?'selected':''}>${l}</option>`).join('')}</select>`;
  }

  // Diet phase can override the goal-derived calorie direction.
  const PHASE = {
    bulk:     { calAdj: 0.12,  dir: 1,  rate: 0.004, name: 'Bulk' },
    cut:      { calAdj: -0.20, dir: -1, rate: 0.0065, proteinPerLb: 1.1, name: 'Cut' },
    maintain: { calAdj: 0,     dir: 0,  rate: 0,     name: 'Maintain' },
  };

  function plan(profile, weight) {
    const usingActive = !profile;                     // real plan vs a preview with a built profile
    profile = profile || Store.profile();
    weight = weight || Store.latestWeight();
    const c = combine(profile.goals);
    // apply diet phase override (cut / bulk / maintain) on top of training goals
    const ph = profile.dietPhase && PHASE[profile.dietPhase] ? PHASE[profile.dietPhase] : null;
    if (ph) {
      c.calAdj = ph.calAdj; c.dir = ph.dir; c.rate = ph.rate;
      if (ph.proteinPerLb) c.proteinPerLb = Math.max(c.proteinPerLb, ph.proteinPerLb);
    }
    // Maintenance: prefer the data-driven Adaptive TDEE once we have enough
    // logged intake + weight history; otherwise fall back to Mifflin–St Jeor.
    let tdeeVal = tdee(profile, weight), adaptive = false;
    if (usingActive && App.Adaptive) {
      const m = App.Adaptive.maintenance();
      if (m) { tdeeVal = m.tdee; adaptive = true; }
    }
    // Bulking pace: a chosen gain rate sets the surplus precisely.
    if (c.dir > 0 && !(+profile.goalWeight > 0)) {
      const fr = GAIN_RATES[profile.gainRate] || GAIN_RATES.moderate;
      c.rate = fr;
      c.calAdj = (fr * weight * 3500 / 7) / tdeeVal;   // surplus → calorie adjustment
    }
    let cal = Math.max(1200, Math.round(tdeeVal * (1 + c.calAdj) / 10) * 10);
    let protein = Math.round(c.proteinPerLb * weight);
    const fat = Math.round(c.fatPerLb * weight);
    let carbs = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
    let weeklyRate = c.dir === 0 ? 0 : +(c.rate * weight).toFixed(1);
    const horizon = horizonWeeks(profile);
    let dir = c.dir;
    let targetWeight = c.dir === 0 ? Math.round(weight) : Math.round(weight + c.dir * weeklyRate * horizon);
    let customGoal = false;

    // Manual goal weight: you choose the target; calories + rate follow it.
    const gw = +profile.goalWeight;
    if (gw && gw > 0 && Math.abs(gw - weight) >= 0.5) {
      customGoal = true;
      targetWeight = Math.round(gw);
      dir = gw > weight ? 1 : -1;
      let rate = Math.abs(gw - weight) / horizon;          // lb/week to hit it in the window
      rate = Math.min(rate, 0.012 * weight);               // cap ~1.2% bodyweight/week
      weeklyRate = +rate.toFixed(1);
      const dailyAdjust = Math.max(-800, Math.min(500, dir * rate * 3500 / 7));
      cal = Math.max(1200, Math.round((tdeeVal + dailyAdjust) / 10) * 10);
      const ppl = dir < 0 ? Math.max(c.proteinPerLb, 1.1) : c.proteinPerLb;
      protein = Math.round(ppl * weight);
      carbs = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
    } else if (gw && gw > 0) {
      // goal essentially reached
      customGoal = true; targetWeight = Math.round(gw); dir = 0; weeklyRate = 0;
      cal = Math.max(1200, Math.round(tdeeVal / 10) * 10);
      carbs = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
    }

    const split = (profile.split && profile.split !== 'auto') ? profile.split : defaultSplit(c.keys, c.cardio);
    const days = profile.daysPerWeek || App.DATA.SPLITS[split].defaultDays;
    return {
      tdee: Math.round(tdeeVal), cal, protein, carbs, fat,
      dir, weeklyRate, targetWeight, horizon, bias: c.bias, cardio: c.cardio, customGoal, adaptive,
      split, days, splitName: App.DATA.SPLITS[split].name,
      phase: customGoal ? 'Goal weight' : (ph ? ph.name : 'Auto'),
      keys: c.keys, title: titleFor(c.keys), guide: guideFor({ ...c, dir }, weeklyRate),
    };
  }

  function phaseSelect(v) {
    const opts = [['auto','Auto (from goals)'],['bulk','Bulk (surplus)'],['maintain','Maintain'],['cut','Cut (deficit)']];
    return `<select class="input" id="g-phase">${opts.map(([k,l]) => `<option value="${k}" ${k===(v||'auto')?'selected':''}>${l}</option>`).join('')}</select>`;
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
        <div style="margin-top:6px"><span class="pill ${pl.dir<0?'orange':''}">${pl.dir>0?'🔼 Bulk':pl.dir<0?'🔽 Cut':'➖ Maintain'}${pl.phase!=='Auto'?' · '+pl.phase:''}</span></div>
        <div class="macro-row" style="margin-top:12px">
          ${macroPill('Protein', pl.protein)}${macroPill('Carbs', pl.carbs)}${macroPill('Fat', pl.fat)}
        </div>
        <div class="divider"></div>
        <div class="spread"><span class="muted">Weight goal</span><b>${dirTxt}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Target rate</span><b>${rate}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Split</span><b>${pl.splitName} · ${pl.days}×/wk</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Emphasis</span><b>${biasLabel(pl.bias)}</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">Maintenance${pl.adaptive ? ' <span class="pill accent" style="font-size:10px;padding:1px 6px">adaptive</span>' : ''}</span><b>~${pl.tdee} cal</b></div>
      </div>
      ${compositionCard(pl)}`;
  }
  function compositionCard(pl) {
    if (pl.dir <= 0) return '';
    const w = Store.latestWeight();
    const ratePct = (pl.weeklyRate / w) * 100;
    const lean = Math.round(leanFraction(ratePct) * 100);
    return `<div class="card" style="margin-top:14px">
      <b>Projected gain composition</b>
      <div class="macro-row" style="margin-top:12px">
        <div class="macro-pill"><b>${lean}%</b><small>Lean</small></div>
        <div class="macro-pill"><b>${100 - lean}%</b><small>Fat</small></div>
      </div>
      <div class="last-hint">At ~${pl.weeklyRate} lb/week, roughly ${lean}% of each pound is lean mass — faster gain means more fat. The first 1–2 weeks also add several lb of glycogen + creatine water (not fat), so don't panic at the early scale jump.</div>
    </div>`;
  }

  function splitSelect(v) {
    const S = App.DATA.SPLITS;
    return `<select class="input" id="g-split">
      <option value="auto" ${!v||v==='auto'?'selected':''}>Auto (recommended)</option>
      ${Object.keys(S).map(k => `<option value="${k}" ${k===v?'selected':''}>${S[k].name}</option>`).join('')}
    </select>`;
  }
  function daysSelect(v) {
    return `<select class="input" id="g-days">
      <option value="0" ${!v?'selected':''}>Auto</option>
      ${[2,3,4,5,6].map(n => `<option value="${n}" ${+v===n?'selected':''}>${n} days / week</option>`).join('')}
    </select>`;
  }
  function macroPill(name, g) {
    return `<div class="macro-pill"><b>${g}g</b><small>${name}</small></div>`;
  }
  function guideCard(pl) {
    return `<div class="card"><b>What to eat</b><ul class="guide-list">${pl.guide.map(x => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>`;
  }

  return { GOALS, GOAL_ORDER, ACTIVITY, tdee, plan, recompute, biasLabel, composition, leanFraction,
           goalChips, wireGoalChips, sexSelect, activitySelect, splitSelect, daysSelect, phaseSelect, gainRateSelect, planSummary, guideCard };
})();
