/* ============================================================
   Macro — running / race training engine
   Builds a paced, periodized plan toward a goal race + time.
   ============================================================ */
window.App = window.App || {};

App.Running = (function () {
  const Store = App.Store, UI = App.UI;

  const DISTANCES = {
    '5k':   { mi: 3.107,  name: '5K' },
    '10k':  { mi: 6.214,  name: '10K' },
    'half': { mi: 13.109, name: 'Half Marathon' },
    'full': { mi: 26.219, name: 'Marathon' },
  };
  const PEAK_LONG = { '5k': 6,  '10k': 10, 'half': 14, 'full': 20 };
  const PEAK_WEEK = { '5k': 25, '10k': 35, 'half': 45, 'full': 55 };
  const TAPER     = { '5k': 1,  '10k': 1,  'half': 2,  'full': 3 };

  function get(profile) { return (profile || Store.profile()).running || {}; }
  function paceStr(sec) {
    if (!sec || !isFinite(sec)) return '--';
    sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function hmsToSec(h, m, s) { return (+h || 0) * 3600 + (+m || 0) * 60 + (+s || 0); }
  function weeksToRace(profile) {
    const r = get(profile);
    if (r.raceDate) { const d = Store.dayDiff(Store.todayKey(), r.raceDate); return Math.max(0, Math.ceil(d / 7)); }
    return 12;
  }
  function daysToRace(profile) {
    const r = get(profile);
    return r.raceDate ? Store.dayDiff(Store.todayKey(), r.raceDate) : null;
  }

  // Pace zones (sec/mi) derived from goal race pace — research-informed offsets.
  function paces(goalPaceSec) {
    return {
      race:     goalPaceSec,
      easy:     goalPaceSec + 75,
      long:     goalPaceSec + 60,
      tempo:    Math.max(150, goalPaceSec - 18),
      interval: Math.max(140, goalPaceSec - 45),
      recovery: goalPaceSec + 95,
    };
  }

  /* ---------- VDOT (Daniels–Gilbert) ---------- */
  function vdotFromRace(distMi, timeSec) {
    if (!distMi || !timeSec) return null;
    const t = timeSec / 60;                          // minutes
    const v = (distMi * 1609.34) / t;                // m/min
    const pctMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
    const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
    return vo2 / pctMax;
  }
  // pace (sec/mi) to run at a given fraction of VO2max for a VDOT score
  function paceForVdot(vdot, pct) {
    const vo2 = vdot * pct;
    const a = 0.000104, b = 0.182258, c = -4.60 - vo2;
    const disc = b * b - 4 * a * c; if (disc < 0) return null;
    const v = (-b + Math.sqrt(disc)) / (2 * a);      // m/min
    if (v <= 0) return null;
    return (1609.34 / v) * 60;                        // sec/mi
  }
  const ZONE_PCT = { recovery: 0.66, easy: 0.70, long: 0.70, marathon: 0.84, race: 0.84, tempo: 0.88, interval: 0.975, rep: 1.10 };
  function pacesFromVdot(vdot) {
    const out = {};
    Object.keys(ZONE_PCT).forEach(k => { out[k] = paceForVdot(vdot, ZONE_PCT[k]); });
    return out;
  }
  // Riegel race-time prediction: T2 = T1 * (D2/D1)^1.06
  function riegel(t1Sec, d1Mi, d2Mi) { return t1Sec * Math.pow(d2Mi / d1Mi, 1.06); }

  function plan(profile) {
    profile = profile || Store.profile();
    const r = get(profile);
    const dist = DISTANCES[r.distance] || DISTANCES.full;
    const goalPaceSec = r.goalTimeSec ? r.goalTimeSec / dist.mi : 0;

    // VDOT from a recent race → physiologically accurate paces + prediction
    let vdot = null, predictedSec = null, goalGapSec = null;
    if (r.raceVdotDist && r.raceVdotTime) {
      const rd = DISTANCES[r.raceVdotDist];
      if (rd) {
        vdot = vdotFromRace(rd.mi, r.raceVdotTime);
        predictedSec = riegel(r.raceVdotTime, rd.mi, dist.mi);
        if (r.goalTimeSec) goalGapSec = r.goalTimeSec - predictedSec; // <0 = goal harder than predicted
      }
    }
    const P = vdot ? pacesFromVdot(vdot) : paces(goalPaceSec);
    const wRem = weeksToRace(profile);
    const total = Math.max(wRem, r.planWeeks || 16);
    const taperWeeks = TAPER[r.distance] || 2;
    const buildWeeks = Math.max(1, total - taperWeeks);
    const weekIndex = Math.min(total, total - wRem + 1);   // 1-based week in the block
    const phase = wRem <= taperWeeks ? 'Taper' : weekIndex <= total * 0.45 ? 'Base' : weekIndex <= total * 0.8 ? 'Build' : 'Peak';

    const startMi = Math.max(8, r.weeklyMileage || 15);
    const peakMi = PEAK_WEEK[r.distance] || 50;
    const startLong = Math.max(4, r.longestRun || 6);
    const peakLong = PEAK_LONG[r.distance] || 20;
    const prog = UI.clamp((weekIndex - 1) / Math.max(1, buildWeeks - 1), 0, 1);

    let weekMileage, longRun;
    if (phase === 'Taper') {
      const f = wRem === 1 ? 0.4 : wRem === 2 ? 0.6 : 0.75;
      weekMileage = Math.round(peakMi * f);
      longRun = Math.round(peakLong * (wRem === 1 ? 0.35 : 0.6));
    } else {
      weekMileage = Math.round(startMi + (peakMi - startMi) * prog);
      longRun = Math.round(startLong + (peakLong - startLong) * prog);
      if (weekIndex % 4 === 0) { weekMileage = Math.round(weekMileage * 0.8); longRun = Math.round(longRun * 0.75); } // cutback
    }
    longRun = Math.min(longRun, peakLong);

    return { dist, goalPaceSec, paces: P, weeksToRace: wRem, total, phase, weekIndex,
             weekMileage, longRun, runsPerWeek: r.runsPerWeek || 4, sched: schedule(r.runsPerWeek || 4),
             vdot: vdot ? Math.round(vdot) : null, predictedSec, goalGapSec };
  }
  function hms(sec) {
    if (sec == null) return '--';
    sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  // weekday(0=Sun) -> run type
  function schedule(rpw) {
    if (rpw <= 3) return { 0:'long', 1:'rest', 2:'tempo', 3:'rest', 4:'easy', 5:'rest', 6:'rest' };
    if (rpw === 4) return { 0:'long', 1:'rest', 2:'tempo', 3:'easy', 4:'rest', 5:'easy', 6:'rest' };
    if (rpw === 5) return { 0:'long', 1:'rest', 2:'tempo', 3:'easy', 4:'interval', 5:'rest', 6:'easy' };
    return { 0:'long', 1:'easy', 2:'tempo', 3:'easy', 4:'interval', 5:'rest', 6:'easy' };
  }

  // Build the prescription for a given run type from a plan.
  function buildRx(pl, type) {
    if (type === 'rest') return { type: 'rest', name: 'Rest / Recovery' };
    let miles, paceKey, name, detail;
    if (type === 'long')          { miles = pl.longRun; paceKey = 'long'; name = `Long Run — ${miles} mi`; detail = 'Conversational effort. Stay relaxed and build endurance.'; }
    else if (type === 'tempo')    { miles = Math.max(4, Math.round(pl.weekMileage * 0.18)); paceKey = 'tempo'; name = `Tempo — ${miles} mi`; detail = 'Comfortably hard at threshold. e.g. 1 mi easy, middle at tempo, 1 mi easy.'; }
    else if (type === 'interval') { miles = Math.max(3, Math.round(pl.weekMileage * 0.15)); paceKey = 'interval'; name = `Intervals — ${miles} mi`; detail = 'e.g. 6×800m at interval pace with equal jog recovery + warmup/cooldown.'; }
    else if (type === 'recovery') { miles = Math.max(2, Math.round(pl.weekMileage * 0.10)); paceKey = 'recovery'; name = `Recovery — ${miles} mi`; detail = 'Very easy shakeout to flush the legs.'; }
    else                          { miles = Math.max(3, Math.round(pl.weekMileage * 0.16)); paceKey = 'easy'; name = `Easy Run — ${miles} mi`; detail = 'Relaxed aerobic miles. Keep it easy.'; }
    return { type, name, miles, paceKey, paceSec: pl.paces[paceKey], paceLabel: paceStr(pl.paces[paceKey]), detail };
  }
  // Prescription for a date (optionally forcing a run type).
  function rxFor(profile, dateKey, overrideType) {
    const pl = plan(profile);
    const type = overrideType || pl.sched[new Date(dateKey + 'T00:00:00').getDay()] || 'rest';
    return buildRx(pl, type);
  }
  function prescriptionFor(profile, dateKey) { return rxFor(profile, dateKey); }

  /* ---------- analysis from actual logged runs ---------- */
  function dateNDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return Store.todayKey(d); }
  function runHistory(days) {
    const start = dateNDaysAgo(days), st = Store.get();
    return Object.values(st.workoutLogs)
      .filter(l => l.isRun && l.done && l.dateKey >= start)
      .map(l => ({ date: l.dateKey, miles: (l.actual && l.actual.miles) || (l.run && l.run.miles) || 0, min: (l.actual && l.actual.min) || 0, type: (l.run && l.run.type) || 'easy' }))
      .sort((a, b) => a.date < b.date ? -1 : 1);
  }
  function analysis(profile) {
    const pl = plan(profile);
    const last7 = runHistory(7), last28 = runHistory(28);
    const week7Mi = last7.reduce((s, r) => s + r.miles, 0);
    const hardMi = last7.filter(r => ['tempo', 'interval', 'race'].includes(r.type)).reduce((s, r) => s + r.miles, 0);
    const longThisWeek = last7.some(r => r.miles >= pl.longRun * 0.8);
    const daysSince = last28.length ? Store.dayDiff(last28[last28.length - 1].date, Store.todayKey()) : null;
    return {
      week7Mi: Math.round(week7Mi), avg4wkMi: Math.round((last28.reduce((s, r) => s + r.miles, 0)) / 4),
      longestRecent: Math.round(last28.reduce((m, r) => Math.max(m, r.miles), 0)),
      longThisWeek, hardShare: week7Mi > 0 ? hardMi / week7Mi : 0, daysSince,
      behindMi: Math.round(Math.max(0, pl.weekMileage - week7Mi)), runs7: last7.length,
      weekTarget: pl.weekMileage, longTarget: pl.longRun, phase: pl.phase,
    };
  }

  // What should I run today? Considers schedule, what you've already done, and load.
  function suggestion(profile) {
    profile = profile || Store.profile();
    const today = Store.todayKey();
    const rx = rxFor(profile, today);
    const an = analysis(profile);
    const acwr = (App.Workload && App.Workload.acwr().ratio) || 0;
    const dow = new Date(today + 'T00:00:00').getDay();
    if (acwr > 1.5) return { title: 'Recovery recommended', tone: 'bad', swapTo: 'recovery', text: `Your load ratio is ${acwr} (high). Make today a very easy recovery run or rest, even if something harder is scheduled.` };
    if (rx.type !== 'rest' && (rx.type === 'tempo' || rx.type === 'interval') && an.hardShare > 0.45)
      return { title: 'Keep it easy today', tone: 'warn', swapTo: 'easy', text: `~${Math.round(an.hardShare * 100)}% of this week's miles have been hard. Keep ~80% easy — swap this for an easy run.` };
    if (rx.type === 'rest' && !an.longThisWeek && [5, 6, 0].includes(dow))
      return { title: 'Long run is due', tone: 'info', swapTo: 'long', text: `You haven't done your long run (${an.longTarget} mi) this week — today is a good day for it.` };
    if (rx.type !== 'rest' && an.behindMi > 6)
      return { title: 'Catch-up run', tone: 'info', text: `You're ${an.behindMi} mi under this week's ${an.weekTarget} mi target — today's ${rx.name.toLowerCase()} helps you catch up.` };
    if (an.daysSince != null && an.daysSince >= 3 && rx.type === 'rest')
      return { title: 'Time to run', tone: 'info', swapTo: 'easy', text: `It's been ${an.daysSince} days since your last run — an easy run keeps your aerobic base.` };
    return { title: rx.type === 'rest' ? 'Rest day' : 'On plan', tone: 'good', text: rx.type === 'rest' ? 'Recovery is part of the plan — take it easy today.' : `Today's ${rx.name} fits your ${an.phase.toLowerCase()} phase. Hit the target pace and effort.` };
  }

  // Running insights for the Coach card.
  function runInsights(profile) {
    const an = analysis(profile), out = [];
    const sug = suggestion(profile);
    out.push({ icon: '🏃', tone: sug.tone, title: sug.title, text: sug.text });
    if (an.runs7 === 0 && an.daysSince != null) out.push({ icon: '📅', tone: 'warn', title: 'No runs this week', text: 'Consistency drives endurance gains — get an easy run in to stay on track for your race.' });
    else if (an.week7Mi > an.weekTarget * 1.25) out.push({ icon: '🛑', tone: 'warn', title: 'Mileage spike', text: `You're at ${an.week7Mi} mi vs a ${an.weekTarget} mi target — big jumps raise injury risk. Hold steady.` });
    return out.slice(0, 2);
  }

  function active(profile) { return ((profile || Store.profile()).goals || []).includes('marathon') && get(profile).goalTimeSec > 0; }

  /* ---------- race setup questionnaire ---------- */
  function setupSheet(onDone) {
    const r = get();
    const gt = r.goalTimeSec || 0, gh = Math.floor(gt / 3600), gm = Math.floor((gt % 3600) / 60);
    const distOpt = (k, l) => `<option value="${k}" ${r.distance === k ? 'selected' : ''}>${l}</option>`;
    UI.modal(`
      <h2>Race setup</h2>
      <p class="muted" style="margin:-8px 0 14px;font-size:13px">Tell me about your running and your race so I can build a paced, periodized plan.</p>
      ${UI.field('Race distance', `<select class="input" id="rs-dist">${distOpt('5k','5K')}${distOpt('10k','10K')}${distOpt('half','Half Marathon')}${distOpt('full','Marathon')}</select>`)}
      ${UI.field('Race date', `<input class="input" id="rs-date" type="date" value="${r.raceDate || ''}">`)}
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Goal finish time</label>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Hours</label><input class="input" id="rs-h" type="number" inputmode="numeric" value="${gh || ''}" placeholder="3"></div>
        <div class="field" style="margin:0"><label>Minutes</label><input class="input" id="rs-m" type="number" inputmode="numeric" value="${gm || ''}" placeholder="45"></div>
      </div>
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Recent race (for VDOT — optional but recommended)</label>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Distance</label><select class="input" id="rs-rvd"><option value="">—</option>${['5k','10k','half','full'].map(k=>`<option value="${k}" ${r.raceVdotDist===k?'selected':''}>${DISTANCES[k].name}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><label>Time (mm or h:mm)</label><input class="input" id="rs-rvt" placeholder="20:00 or 1:45:00" value="${r.raceVdotTime?hms(r.raceVdotTime):''}"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Weekly mileage now</label><input class="input" id="rs-wk" type="number" inputmode="decimal" value="${r.weeklyMileage || ''}" placeholder="15"></div>
        <div class="field" style="margin:0"><label>Longest recent run (mi)</label><input class="input" id="rs-long" type="number" inputmode="decimal" value="${r.longestRun || ''}" placeholder="6"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Runs / week</label><select class="input" id="rs-rpw">${[3,4,5,6].map(n=>`<option value="${n}" ${(r.runsPerWeek||4)===n?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><label>Experience</label><select class="input" id="rs-exp">${['beginner','intermediate','advanced'].map(e=>`<option value="${e}" ${(r.experience||'intermediate')===e?'selected':''}>${e[0].toUpperCase()+e.slice(1)}</option>`).join('')}</select></div>
      </div>
      <div class="card" id="rs-preview" style="margin-bottom:14px"></div>
      <button class="btn primary" id="rs-save">Save race plan</button>
    `, (m, close) => {
      const parseTime = s => {
        const p = String(s || '').trim().split(':').map(Number);
        if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
        if (p.length === 2) return p[0]*60 + p[1];
        return 0;
      };
      const read = () => ({
        distance: m.querySelector('#rs-dist').value,
        raceDate: m.querySelector('#rs-date').value,
        goalTimeSec: hmsToSec(m.querySelector('#rs-h').value, m.querySelector('#rs-m').value, 0),
        weeklyMileage: +m.querySelector('#rs-wk').value || 15,
        longestRun: +m.querySelector('#rs-long').value || 6,
        runsPerWeek: +m.querySelector('#rs-rpw').value || 4,
        experience: m.querySelector('#rs-exp').value,
        raceVdotDist: m.querySelector('#rs-rvd').value,
        raceVdotTime: parseTime(m.querySelector('#rs-rvt').value),
      });
      const preview = () => {
        const prof = Object.assign({}, Store.profile(), { running: read() });
        const pl = plan(prof);
        const feas = pl.goalGapSec == null ? '' :
          pl.goalGapSec < -120 ? `<div class="last-hint" style="color:var(--bad)">⚠️ Goal is ${hms(-pl.goalGapSec)} faster than your fitness predicts (${hms(pl.predictedSec)}). Ambitious — train consistently.</div>` :
          pl.goalGapSec > 120 ? `<div class="last-hint suggest">You're predicted to run ${hms(pl.predictedSec)} — your goal looks comfortably achievable.</div>` :
          `<div class="last-hint suggest">Goal is right around your predicted ${hms(pl.predictedSec)} — realistic with good training.</div>`;
        m.querySelector('#rs-preview').innerHTML = (pl.goalPaceSec || pl.vdot)
          ? `${pl.vdot ? `<div class="spread"><b>VDOT</b><span class="muted">${pl.vdot}</span></div>` : ''}
             ${pl.goalPaceSec ? `<div class="spread" style="margin-top:6px"><b>Goal pace</b><span class="muted">${paceStr(pl.goalPaceSec)} /mi</span></div>` : ''}
             <div class="spread" style="margin-top:6px"><b>This week</b><span class="muted">${pl.weekMileage} mi · long run ${pl.longRun} mi</span></div>
             <div class="spread" style="margin-top:6px"><b>To race</b><span class="muted">${pl.weeksToRace} weeks · ${pl.phase} phase</span></div>
             ${feas}`
          : `<span class="muted">Enter a goal time or recent race to see your paces.</span>`;
      };
      m.querySelectorAll('select,input').forEach(el => el.addEventListener('input', preview));
      preview();
      m.querySelector('#rs-save').onclick = () => {
        Store.setProfile({ running: read() });
        const goals = Store.profile().goals || [];
        if (!goals.includes('marathon')) Store.setProfile({ goals: [...goals, 'marathon'] });
        close(); UI.toast('Race plan saved 🏃', 'good'); onDone && onDone();
      };
    });
  }

  function planCard() {
    const pl = plan();
    if (!pl.goalPaceSec) return `<div class="card"><b>Race Training</b><div class="muted" style="margin-top:6px">Set up your race to get paces and a plan.</div><button class="btn small" id="rc-setup" style="margin-top:10px;width:auto">Race setup</button></div>`;
    const P = pl.paces;
    const row = (l, k) => `<div class="spread" style="padding:7px 0;border-bottom:1px solid var(--line)"><span class="muted">${l}</span><b>${paceStr(P[k])} /mi</b></div>`;
    return `
      <div class="card">
        <div class="spread"><b>${pl.dist.name} plan</b><span class="pill accent">${pl.weeksToRace} wks · ${pl.phase}</span></div>
        ${pl.vdot ? `<div class="spread" style="margin-top:10px"><span class="muted">VDOT · predicted</span><b>${pl.vdot} · ${hms(pl.predictedSec)}</b></div>` : ''}
        <div class="spread" style="margin-top:${pl.vdot?6:10}px"><span class="muted">Goal time pace</span><b>${paceStr(pl.goalPaceSec)} /mi</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">This week</span><b>${pl.weekMileage} mi · long ${pl.longRun} mi</b></div>
      </div>
      <div class="card" style="margin-top:14px">
        <b>Your pace zones</b>
        <div style="margin-top:8px">${row('Recovery','recovery')}${row('Easy','easy')}${row('Long run','long')}${row('Marathon/Race','race')}${row('Tempo','tempo')}${row('Intervals','interval')}</div>
      </div>
      <button class="btn" id="rc-setup" style="margin-top:14px">Edit race setup</button>`;
  }

  return { DISTANCES, plan, prescriptionFor, rxFor, buildRx, analysis, suggestion, runInsights, paceStr, hms, hmsToSec, weeksToRace, daysToRace, get, active, setupSheet, planCard, vdotFromRace };
})();
