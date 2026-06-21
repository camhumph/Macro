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

  function plan(profile) {
    profile = profile || Store.profile();
    const r = get(profile);
    const dist = DISTANCES[r.distance] || DISTANCES.full;
    const goalPaceSec = r.goalTimeSec ? r.goalTimeSec / dist.mi : 0;
    const P = paces(goalPaceSec);
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
             weekMileage, longRun, runsPerWeek: r.runsPerWeek || 4, sched: schedule(r.runsPerWeek || 4) };
  }

  // weekday(0=Sun) -> run type
  function schedule(rpw) {
    if (rpw <= 3) return { 0:'long', 1:'rest', 2:'tempo', 3:'rest', 4:'easy', 5:'rest', 6:'rest' };
    if (rpw === 4) return { 0:'long', 1:'rest', 2:'tempo', 3:'easy', 4:'rest', 5:'easy', 6:'rest' };
    if (rpw === 5) return { 0:'long', 1:'rest', 2:'tempo', 3:'easy', 4:'interval', 5:'rest', 6:'easy' };
    return { 0:'long', 1:'easy', 2:'tempo', 3:'easy', 4:'interval', 5:'rest', 6:'easy' };
  }

  function prescriptionFor(profile, dateKey) {
    const pl = plan(profile);
    const dow = new Date(dateKey + 'T00:00:00').getDay();
    const type = pl.sched[dow] || 'rest';
    if (type === 'rest') return { type: 'rest', name: 'Rest / Recovery' };
    let miles, paceKey, name, detail;
    if (type === 'long')      { miles = pl.longRun; paceKey = 'long'; name = `Long Run — ${miles} mi`; detail = 'Conversational effort. Stay relaxed and build endurance.'; }
    else if (type === 'tempo')   { miles = Math.max(4, Math.round(pl.weekMileage * 0.18)); paceKey = 'tempo'; name = `Tempo — ${miles} mi`; detail = 'Comfortably hard at threshold. e.g. 1 mi easy, middle at tempo, 1 mi easy.'; }
    else if (type === 'interval'){ miles = Math.max(3, Math.round(pl.weekMileage * 0.15)); paceKey = 'interval'; name = `Intervals — ${miles} mi`; detail = 'e.g. 6×800m at interval pace with equal jog recovery + warmup/cooldown.'; }
    else                         { miles = Math.max(3, Math.round(pl.weekMileage * 0.16)); paceKey = 'easy'; name = `Easy Run — ${miles} mi`; detail = 'Relaxed aerobic miles. Keep it easy.'; }
    return { type, name, miles, paceKey, paceSec: pl.paces[paceKey], paceLabel: paceStr(pl.paces[paceKey]), detail };
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
      const read = () => ({
        distance: m.querySelector('#rs-dist').value,
        raceDate: m.querySelector('#rs-date').value,
        goalTimeSec: hmsToSec(m.querySelector('#rs-h').value, m.querySelector('#rs-m').value, 0),
        weeklyMileage: +m.querySelector('#rs-wk').value || 15,
        longestRun: +m.querySelector('#rs-long').value || 6,
        runsPerWeek: +m.querySelector('#rs-rpw').value || 4,
        experience: m.querySelector('#rs-exp').value,
      });
      const preview = () => {
        const prof = Object.assign({}, Store.profile(), { running: read() });
        const pl = plan(prof);
        m.querySelector('#rs-preview').innerHTML = pl.goalPaceSec
          ? `<div class="spread"><b>Goal pace</b><span class="muted">${paceStr(pl.goalPaceSec)} /mi</span></div>
             <div class="spread" style="margin-top:6px"><b>This week</b><span class="muted">${pl.weekMileage} mi · long run ${pl.longRun} mi</span></div>
             <div class="spread" style="margin-top:6px"><b>To race</b><span class="muted">${pl.weeksToRace} weeks · ${pl.phase} phase</span></div>`
          : `<span class="muted">Enter a goal time to see your paces.</span>`;
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
        <div class="spread" style="margin-top:10px"><span class="muted">Goal time pace</span><b>${paceStr(pl.goalPaceSec)} /mi</b></div>
        <div class="spread" style="margin-top:6px"><span class="muted">This week</span><b>${pl.weekMileage} mi · long ${pl.longRun} mi</b></div>
      </div>
      <div class="card" style="margin-top:14px">
        <b>Your pace zones</b>
        <div style="margin-top:8px">${row('Recovery','recovery')}${row('Easy','easy')}${row('Long run','long')}${row('Marathon/Race','race')}${row('Tempo','tempo')}${row('Intervals','interval')}</div>
      </div>
      <button class="btn" id="rc-setup" style="margin-top:14px">Edit race setup</button>`;
  }

  return { DISTANCES, plan, prescriptionFor, paceStr, hmsToSec, weeksToRace, daysToRace, get, active, setupSheet, planCard };
})();
