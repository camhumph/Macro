/* ============================================================
   Macro — state store (localStorage), profile, helpers
   ============================================================ */
window.App = window.App || {};

App.Store = (function () {
  const KEY = 'macro_state_v1';

  function todayKey(d) {
    d = d || new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function defaultState() {
    const start = todayKey();
    return {
      onboarded:false,
      profile:{
        name:'Athlete',
        heightIn:72,            // 6'0"
        startWeight:150,
        startDate:start,
        climbDate:'2026-08-15', // mid-August 15k climb
        goalGain:10,            // target lbs over 8 weeks
        // Macro targets — 3,200 cal lean bulk, high protein to keep abs
        cal:3200, protein:180, carbs:417, fat:90,
        weighInTime:'20:00',
        reminders:true,
      },
      workoutLogs:{},  // dateKey -> { week, phase, dayType, dayName, exercises:[...] }
      foodLogs:{},     // dateKey -> [ entries ]
      weightLogs:[],   // [ { date, weight } ] sorted by date
      pantry:[],       // scanned/saved foods you draw portions from
      programOverrides:{}, // dayType -> [ {key, sets, custom?} ] custom routine
      lastAdjustWeek:0 // last week we auto-adjusted calories
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // shallow-merge to survive added fields across versions
      const d = defaultState();
      return Object.assign(d, parsed, { profile: Object.assign(d.profile, parsed.profile || {}) });
    } catch (e) {
      console.warn('state load failed', e);
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('save failed', e); }
  }

  function get() { return state; }
  function profile() { return state.profile; }

  function setProfile(patch) { Object.assign(state.profile, patch); save(); }

  /* ---------- program timing ---------- */
  function dayDiff(a, b) {
    const ms = (new Date(b+'T00:00:00')) - (new Date(a+'T00:00:00'));
    return Math.floor(ms / 86400000);
  }
  // Returns current program week (1-based, clamped 1..8) for a given date.
  function weekFor(dateKey) {
    dateKey = dateKey || todayKey();
    const diff = dayDiff(state.profile.startDate, dateKey);
    const w = Math.floor(diff / 7) + 1;
    return Math.max(1, Math.min(8, w));
  }
  function daysUntilClimb(dateKey) {
    return dayDiff(dateKey || todayKey(), state.profile.climbDate);
  }
  function daysIntoProgram(dateKey) {
    return Math.max(0, dayDiff(state.profile.startDate, dateKey || todayKey()));
  }

  /* ---------- weight ---------- */
  function logWeight(weight, dateKey) {
    dateKey = dateKey || todayKey();
    const existing = state.weightLogs.find(w => w.date === dateKey);
    if (existing) existing.weight = weight;
    else state.weightLogs.push({ date:dateKey, weight });
    state.weightLogs.sort((a,b) => a.date < b.date ? -1 : 1);
    save();
  }
  function weightToday() {
    const t = todayKey();
    const e = state.weightLogs.find(w => w.date === t);
    return e ? e.weight : null;
  }
  function latestWeight() {
    return state.weightLogs.length ? state.weightLogs[state.weightLogs.length-1].weight : state.profile.startWeight;
  }

  /* ---------- food ---------- */
  function foodLog(dateKey) {
    dateKey = dateKey || todayKey();
    return state.foodLogs[dateKey] || [];
  }
  function addFood(entry, dateKey) {
    dateKey = dateKey || todayKey();
    if (!state.foodLogs[dateKey]) state.foodLogs[dateKey] = [];
    entry.id = 'e' + Date.now() + Math.floor(Math.random()*999);
    entry.ts = Date.now();
    state.foodLogs[dateKey].push(entry);
    save();
    return entry;
  }
  function updateFood(entryId, patch, dateKey) {
    dateKey = dateKey || todayKey();
    const e = (state.foodLogs[dateKey] || []).find(x => x.id === entryId);
    if (e) { Object.assign(e, patch); save(); }
    return e;
  }
  function removeFood(entryId, dateKey) {
    dateKey = dateKey || todayKey();
    const arr = state.foodLogs[dateKey] || [];
    state.foodLogs[dateKey] = arr.filter(e => e.id !== entryId);
    save();
  }
  function dayTotals(dateKey) {
    const arr = foodLog(dateKey);
    return arr.reduce((t,e) => {
      t.cal += e.cal||0; t.protein += e.protein||0; t.carbs += e.carbs||0; t.fat += e.fat||0;
      return t;
    }, { cal:0, protein:0, carbs:0, fat:0 });
  }

  /* ---------- pantry (scanned / saved foods you draw portions from) ---------- */
  function pantry() { return state.pantry; }
  function addPantry(item) {
    item.id = 'pn' + Date.now() + Math.floor(Math.random()*999);
    item.createdAt = Date.now();
    state.pantry.unshift(item);
    save();
    return item;
  }
  function updatePantry(id, patch) {
    const it = state.pantry.find(p => p.id === id);
    if (it) { Object.assign(it, patch); save(); }
    return it;
  }
  function removePantry(id) {
    state.pantry = state.pantry.filter(p => p.id !== id);
    save();
  }

  /* ---------- program overrides (custom routine per day type) ---------- */
  function getProgramOverride(dayType) { return state.programOverrides[dayType] || null; }
  function setProgramOverride(dayType, list) { state.programOverrides[dayType] = list; save(); }
  function clearProgramOverride(dayType) { delete state.programOverrides[dayType]; save(); }

  /* ---------- workouts ---------- */
  function workoutLog(dateKey) {
    dateKey = dateKey || todayKey();
    return state.workoutLogs[dateKey] || null;
  }
  function saveWorkout(dateKey, log) {
    state.workoutLogs[dateKey] = log;
    save();
  }
  // All logged sets for a given exercise key, newest first.
  function exerciseHistory(exKey) {
    const out = [];
    Object.keys(state.workoutLogs).forEach(dk => {
      const log = state.workoutLogs[dk];
      (log.exercises||[]).forEach(ex => {
        if (ex.key !== exKey) return;
        (ex.sets||[]).forEach(s => {
          if (s.done && s.weight > 0 && s.reps > 0) out.push({ date:dk, weight:+s.weight, reps:+s.reps });
        });
      });
    });
    out.sort((a,b) => a.date < b.date ? 1 : -1);
    return out;
  }

  function resetAll() { state = defaultState(); save(); }

  return {
    KEY, todayKey, get, save, profile, setProfile,
    weekFor, daysUntilClimb, daysIntoProgram, dayDiff,
    logWeight, weightToday, latestWeight,
    foodLog, addFood, updateFood, removeFood, dayTotals,
    pantry, addPantry, updatePantry, removePantry,
    getProgramOverride, setProgramOverride, clearProgramOverride,
    workoutLog, saveWorkout, exerciseHistory,
    resetAll,
  };
})();
