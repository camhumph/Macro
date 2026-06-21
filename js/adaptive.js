/* ============================================================
   Macro — Adaptive TDEE (dynamic maintenance from real data)
   Estimates true maintenance calories by comparing logged intake
   against the weight trend over a rolling window (MacroFactor-style),
   instead of relying only on a static Mifflin–St Jeor estimate.
   ============================================================ */
window.App = window.App || {};

App.Adaptive = (function () {
  const Store = App.Store;
  const KCAL_PER_LB = 3500;

  function dateNDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n); return Store.todayKey(d);
  }
  function dayNum(dateKey) { return Math.round(new Date(dateKey + 'T00:00:00').getTime() / 86400000); }

  // least-squares slope (y per x) → lb per day
  function slope(points) {
    const n = points.length; if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    points.forEach(p => { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; });
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    return (n * sxy - sx * sy) / denom;
  }

  // Returns { tdee, days, slopePerWeek } or null if not enough data.
  function maintenance(windowDays) {
    windowDays = windowDays || 21;
    const st = Store.get();
    const start = dateNDaysAgo(windowDays);
    const today = Store.todayKey();

    // daily intake on days actually logged (>0 cal)
    const intakeDays = Object.keys(st.foodLogs || {})
      .filter(d => d >= start && d <= today)
      .map(d => ({ d, cal: (st.foodLogs[d] || []).reduce((s, e) => s + (e.cal || 0), 0) }))
      .filter(x => x.cal > 0);
    if (intakeDays.length < 10) return null;          // need a meaningful sample
    const avgIntake = intakeDays.reduce((s, x) => s + x.cal, 0) / intakeDays.length;

    // weight trend over the window
    const wpts = (st.weightLogs || []).filter(w => w.date >= start).map(w => ({ x: dayNum(w.date), y: w.weight }));
    if (wpts.length < 2) return null;
    const spanDays = wpts[wpts.length - 1].x - wpts[0].x;
    if (spanDays < 7) return null;                    // need at least a week of weigh-ins
    const m = slope(wpts);                            // lb/day
    if (m == null) return null;

    const tdee = Math.round(avgIntake - m * KCAL_PER_LB);
    if (tdee < 1000 || tdee > 6000) return null;      // sanity guard
    return { tdee, days: intakeDays.length, slopePerWeek: +(m * 7).toFixed(2), avgIntake: Math.round(avgIntake) };
  }

  return { maintenance };
})();
