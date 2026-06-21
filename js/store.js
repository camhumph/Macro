/* ============================================================
   Macro — state store (localStorage), profile, helpers
   ============================================================ */
window.App = window.App || {};

App.Store = (function () {
  const KEY = 'macro_state_v1';      // legacy single-profile key (migrated)
  const APP_KEY = 'macro_app_v1';    // multi-profile container

  function todayKey(d) {
    d = d || new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  const AVATARS = ['💪','🔥','⚡','🦍','🐺','🦅','🏔️','🚀','🥇','😤','🦬','🐉'];
  const COLORS  = ['#c6ff3a','#ff7a3c','#3ad0ff','#ff5d73','#41d693','#b18cff','#ffd23c','#ff4fa3'];

  function defaultState() {
    const start = todayKey();
    return {
      onboarded:false,
      profile:{
        name:'Athlete',
        emoji:'💪', color:'#c6ff3a',
        sex:'male', age:25, heightIn:70, startWeight:160,
        activity:'moderate',
        goals:['physique'],     // selected goal paths
        running:{ distance:'full', raceDate:'', goalTimeSec:0, weeklyMileage:15, longestRun:6, runsPerWeek:4, experience:'intermediate' },
        dietPhase:'auto',       // 'auto' | 'bulk' | 'cut' | 'maintain'
        split:'auto',           // 'auto' | 'fullbody' | 'upperlower' | 'ppl'
        daysPerWeek:0,          // 0 = derive from split
        scheduleMode:'flexible',// 'flexible' (next-in-rotation, adapts) | 'fixed' (weekday-based)
        startDate:start,
        targetDate:'',          // optional event/target date
        // Nutrition targets (derived from goals + stats; editable)
        cal:2600, protein:160, carbs:300, fat:70,
        customMacros:false,     // true once the user hand-edits macros
        // Weight goal (0 = auto from goals/phase; >0 = you chose it)
        goalWeight:0,
        // Derived weight goal (filled by Goals.recompute)
        weightDir:1, weeklyRate:0.6, targetWeight:165,
        weighInTime:'20:00',
        reminders:true,
        restTimer:120,          // seconds rest between sets
        restTimerOn:true,
        waterGoal:8,            // cups/day
      },
      workoutLogs:{},  // dateKey -> { week, phase, dayType, dayName, exercises:[...] }
      foodLogs:{},     // dateKey -> [ entries ]
      water:{},        // dateKey -> cups
      meals:[],        // saved meals: [ { id, name, items:[entry], emoji } ]
      exerciseLogs:{}, // dateKey -> [ { id, name, cal } ] calories burned
      routines:[],     // user-built routines: [ { id, name, exercises:[{key,sets,custom?}] } ]
      weightLogs:[],   // [ { date, weight } ] sorted by date
      pantry:[],       // scanned/saved foods you draw portions from
      programOverrides:{}, // dayType -> [ {key, sets, custom?} ] custom routine
      dayChoices:{},   // dateKey -> dayType (manually chosen workout for a day)
      lastAdjustWeek:0 // last week we auto-adjusted calories
    };
  }

  function mergeProfile(parsed) {
    const d = defaultState();
    return Object.assign(d, parsed, { profile: Object.assign(d.profile, parsed.profile || {}) });
  }

  // multi-profile container { v, activeId, order:[id], profiles:{ id: state } }
  let container = loadContainer();
  let state = container.profiles[container.activeId];

  function loadContainer() {
    try {
      const rawApp = localStorage.getItem(APP_KEY);
      if (rawApp) {
        const c = JSON.parse(rawApp);
        Object.keys(c.profiles).forEach(id => { c.profiles[id] = mergeProfile(c.profiles[id]); });
        if (!c.order) c.order = Object.keys(c.profiles);
        if (!c.profiles[c.activeId]) c.activeId = c.order[0];
        return c;
      }
      const rawOld = localStorage.getItem(KEY);    // migrate legacy single profile
      if (rawOld) {
        const old = mergeProfile(JSON.parse(rawOld));
        const id = 'p' + Date.now();
        return { v:1, activeId:id, order:[id], profiles:{ [id]:old } };
      }
    } catch (e) { console.warn('container load failed', e); }
    const id = 'p1';
    return { v:1, activeId:id, order:[id], profiles:{ [id]: defaultState() } };
  }

  function save() {
    try { localStorage.setItem(APP_KEY, JSON.stringify(container)); }
    catch (e) { console.warn('save failed', e); }
  }

  function get() { return state; }
  function profile() { return state.profile; }

  function setProfile(patch) { Object.assign(state.profile, patch); save(); }

  /* ---------- profile management ---------- */
  function profiles() {
    return container.order.map(id => {
      const p = container.profiles[id].profile;
      return { id, name:p.name, emoji:p.emoji || '💪', color:p.color || '#c6ff3a', active:id === container.activeId };
    });
  }
  function activeId() { return container.activeId; }
  function switchProfile(id) {
    if (container.profiles[id]) { container.activeId = id; state = container.profiles[id]; save(); }
  }
  function createProfile(name, emoji, color) {
    const id = 'p' + Date.now();
    const st = defaultState();
    st.profile.name = name || 'Athlete';
    st.profile.emoji = emoji || AVATARS[container.order.length % AVATARS.length];
    st.profile.color = color || COLORS[container.order.length % COLORS.length];
    container.profiles[id] = st; container.order.push(id); container.activeId = id; state = st; save();
    return id;
  }
  function updateProfileMeta(id, patch) {
    const st = container.profiles[id];
    if (st) { Object.assign(st.profile, patch); save(); }
  }
  function deleteProfile(id) {
    if (container.order.length <= 1) return false;
    delete container.profiles[id];
    container.order = container.order.filter(x => x !== id);
    if (container.activeId === id) { container.activeId = container.order[0]; state = container.profiles[container.activeId]; }
    save(); return true;
  }
  function importAsNewProfile(obj) {
    const st = mergeProfile(obj); st.onboarded = true;
    const id = 'p' + Date.now();
    container.profiles[id] = st; container.order.push(id); save();
    return id;
  }
  // [{ id, meta:{name,emoji,color}, state }] for leaderboard computation
  function allProfilesData() {
    return container.order.map(id => {
      const p = container.profiles[id].profile;
      return { id, meta:{ name:p.name, emoji:p.emoji || '💪', color:p.color || '#c6ff3a' }, state:container.profiles[id] };
    });
  }

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
  // Days until the optional target date (null if none set).
  function daysUntilTarget(dateKey) {
    const d = state.profile.targetDate || state.profile.climbDate;
    if (!d) return null;
    return dayDiff(dateKey || todayKey(), d);
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

  /* ---------- water ---------- */
  function water(dateKey) { return state.water[dateKey || todayKey()] || 0; }
  function addWater(cups, dateKey) {
    dateKey = dateKey || todayKey();
    state.water[dateKey] = Math.max(0, (state.water[dateKey] || 0) + cups);
    save();
    return state.water[dateKey];
  }

  /* ---------- exercise / cardio calories burned ---------- */
  function exerciseLog(dateKey) { return state.exerciseLogs[dateKey || todayKey()] || []; }
  function exerciseCals(dateKey) { return exerciseLog(dateKey).reduce((s, e) => s + (e.cal || 0), 0); }
  function addExerciseCal(name, cal, dateKey) {
    dateKey = dateKey || todayKey();
    if (!state.exerciseLogs[dateKey]) state.exerciseLogs[dateKey] = [];
    state.exerciseLogs[dateKey].push({ id: 'x' + Date.now(), name, cal });
    save();
  }
  function removeExerciseCal(id, dateKey) {
    dateKey = dateKey || todayKey();
    state.exerciseLogs[dateKey] = (state.exerciseLogs[dateKey] || []).filter(e => e.id !== id);
    save();
  }

  /* ---------- user-built routines ---------- */
  function routines() { return state.routines; }
  function getRoutine(id) { return state.routines.find(r => r.id === id) || null; }
  function addRoutine(name, exercises) {
    const r = { id: 'rt_' + Date.now(), name, exercises };
    state.routines.push(r); save(); return r;
  }
  function removeRoutine(id) { state.routines = state.routines.filter(r => r.id !== id); save(); }

  /* ---------- saved meals (combos of foods) ---------- */
  function meals() { return state.meals; }
  function addMeal(name, items, emoji) {
    const m = { id: 'm' + Date.now(), name, emoji: emoji || '🍱', items: items.map(it => ({ ...it })) };
    state.meals.unshift(m); save(); return m;
  }
  function removeMeal(id) { state.meals = state.meals.filter(m => m.id !== id); save(); }

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

  /* ---------- per-day workout choice (manually picked / adapted) ---------- */
  function getDayChoice(dateKey) {
    const c = state.dayChoices[dateKey || todayKey()];
    if (!c) return null;
    return typeof c === 'string' ? { type: c, deload: false } : c;
  }
  function setDayChoice(dateKey, dayType, deload) {
    dateKey = dateKey || todayKey();
    state.dayChoices[dateKey] = { type: dayType, deload: !!deload };
    delete state.workoutLogs[dateKey];   // start the chosen session fresh
    save();
  }
  function clearDayChoice(dateKey) {
    dateKey = dateKey || todayKey();
    delete state.dayChoices[dateKey];
    delete state.workoutLogs[dateKey];
    save();
  }
  // All completed sessions (lifting or runs), newest first.
  function allWorkoutLogs() {
    return Object.keys(state.workoutLogs)
      .map(dk => state.workoutLogs[dk])
      .filter(log => (log.isRun && log.done) || (log.exercises || []).some(ex => (ex.sets || []).some(s => s.done)))
      .sort((a, b) => a.dateKey < b.dateKey ? 1 : -1);
  }

  // Dates with a completed lifting session (≥1 done set, not rest/cardio), sorted.
  function trainingDates() {
    return Object.keys(state.workoutLogs).filter(dk => {
      const log = state.workoutLogs[dk];
      if (!log || log.dayType === 'rest' || log.dayType === 'conditioning') return false;
      return (log.exercises || []).some(ex => (ex.sets || []).some(s => s.done));
    }).sort();
  }

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

  // Reset the ACTIVE profile back to a fresh state.
  function resetAll() {
    state = defaultState();
    container.profiles[container.activeId] = state;
    save();
  }

  // Replace the ACTIVE profile's data from a backup object (used by Restore).
  function importState(obj) {
    if (!obj || typeof obj !== 'object' || !obj.profile) throw new Error('Not a valid Macro backup');
    state = mergeProfile(obj);
    container.profiles[container.activeId] = state;
    save();
  }

  // Ask the browser to keep our data durable (reduces iOS eviction).
  function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }

  return {
    KEY, APP_KEY, AVATARS, COLORS, todayKey, get, save, profile, setProfile,
    profiles, activeId, switchProfile, createProfile, updateProfileMeta, deleteProfile, importAsNewProfile, allProfilesData,
    weekFor, daysUntilTarget, daysIntoProgram, dayDiff,
    logWeight, weightToday, latestWeight,
    foodLog, addFood, updateFood, removeFood, dayTotals,
    water, addWater, meals, addMeal, removeMeal, allWorkoutLogs,
    exerciseLog, exerciseCals, addExerciseCal, removeExerciseCal,
    routines, getRoutine, addRoutine, removeRoutine,
    pantry, addPantry, updatePantry, removePantry,
    getProgramOverride, setProgramOverride, clearProgramOverride,
    getDayChoice, setDayChoice, clearDayChoice, trainingDates,
    importState, requestPersist,
    workoutLog, saveWorkout, exerciseHistory,
    resetAll,
  };
})();
