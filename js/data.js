/* ============================================================
   Macro — static data: food DB, 8-week program, strength model
   ============================================================ */
window.App = window.App || {};

App.DATA = (function () {

  /* ---------- FOOD DATABASE ----------
     Macros are per the listed `serving`. Quantity scales linearly.
     cal = calories, p = protein(g), c = carbs(g), f = fat(g)         */
  const FOODS = [
    // --- The breakfast shake (coach's orders) ---
    { id:'shake',  name:'Mass Breakfast Shake', emoji:'🥤', serving:'1 blender (milk+2 scoops+banana+2 tbsp PB)', cal:735, p:60, c:62, f:30, tags:['shake','breakfast','protein'] },
    { id:'oatmeal',name:'Oatmeal (cooked)', emoji:'🥣', serving:'1 cup', cal:158, p:6, c:27, f:3, tags:['breakfast','carbs'] },

    // --- Liquids / staples ---
    { id:'milk',   name:'Whole Milk', emoji:'🥛', serving:'1 cup (240ml)', cal:150, p:8, c:12, f:8, tags:['dairy','drink'] },
    { id:'whey',   name:'Whey Protein', emoji:'💪', serving:'1 scoop (32g)', cal:120, p:24, c:3, f:1.5, tags:['protein','supplement'] },
    { id:'pb',     name:'Peanut Butter', emoji:'🥜', serving:'1 tbsp', cal:95, p:4, c:3, f:8, tags:['fat','spread'] },
    { id:'banana', name:'Banana', emoji:'🍌', serving:'1 medium', cal:105, p:1.3, c:27, f:0.4, tags:['fruit','carbs'] },
    { id:'eggs',   name:'Eggs (large)', emoji:'🥚', serving:'1 egg', cal:72, p:6, c:0.4, f:5, tags:['protein','breakfast'] },
    { id:'olive',  name:'Olive Oil', emoji:'🫒', serving:'1 tbsp', cal:119, p:0, c:0, f:14, tags:['fat'] },
    { id:'avocado',name:'Avocado', emoji:'🥑', serving:'1/2 fruit', cal:120, p:1.5, c:6, f:11, tags:['fat'] },
    { id:'almonds',name:'Almonds', emoji:'🌰', serving:'1 oz (23 nuts)', cal:164, p:6, c:6, f:14, tags:['fat','snack'] },
    { id:'gyogurt',name:'Greek Yogurt (plain)', emoji:'🍦', serving:'1 cup', cal:150, p:25, c:9, f:4, tags:['protein','dairy'] },

    // --- Carbs ---
    { id:'wrice',  name:'White Rice (cooked)', emoji:'🍚', serving:'1 cup', cal:205, p:4, c:45, f:0.4, tags:['carbs'] },
    { id:'clrice', name:'Cilantro Lime Rice', emoji:'🍚', serving:'1 cup', cal:210, p:4, c:44, f:4, tags:['carbs','mealprep'] },
    { id:'pasta',  name:'Pasta (cooked)', emoji:'🍝', serving:'1 cup', cal:220, p:8, c:43, f:1.3, tags:['carbs'] },
    { id:'bread',  name:'Whole Wheat Bread', emoji:'🍞', serving:'1 slice', cal:80, p:4, c:14, f:1, tags:['carbs'] },
    { id:'sweetp', name:'Sweet Potato', emoji:'🍠', serving:'1 medium', cal:112, p:2, c:26, f:0.1, tags:['carbs'] },

    // --- Proteins / mains ---
    { id:'chicken',name:'Chicken Breast (cooked)', emoji:'🍗', serving:'6 oz', cal:280, p:53, c:0, f:6, tags:['protein','mealprep'] },
    { id:'beef90', name:'Lean Ground Beef 90/10', emoji:'🥩', serving:'6 oz cooked', cal:310, p:46, c:0, f:14, tags:['protein'] },
    { id:'salmon', name:'Salmon', emoji:'🐟', serving:'6 oz', cal:350, p:40, c:0, f:21, tags:['protein','fat'] },
    { id:'orangec',name:'Orange Chicken (Panda)', emoji:'🍱', serving:'1 serving (5.7oz)', cal:490, p:25, c:51, f:23, tags:['takeout'] },
    { id:'texmex', name:'Tex-Mex Chicken', emoji:'🌮', serving:'6 oz', cal:300, p:40, c:6, f:12, tags:['mealprep','protein'] },
    { id:'chickpm',name:'Chicken Parmesan', emoji:'🧀', serving:'1 serving', cal:450, p:38, c:25, f:22, tags:['dinner'] },
    { id:'lomeinb',name:'Beef Lo Mein', emoji:'🍜', serving:'1 cup', cal:310, p:14, c:40, f:11, tags:['takeout','dinner'] },
    { id:'lomeinc',name:'Chicken Lo Mein', emoji:'🍜', serving:'1 cup', cal:290, p:16, c:40, f:8, tags:['takeout','dinner'] },
    { id:'pbar',   name:'Protein Bar', emoji:'🍫', serving:'1 bar', cal:220, p:20, c:22, f:8, tags:['snack','protein'] },

    // --- Subway footlongs ---
    { id:'sub_club',name:'Subway Footlong — All-American Club', emoji:'🥪', serving:'12 inch', cal:700, p:48, c:90, f:22, tags:['subway','takeout'] },
    { id:'sub_ital',name:'Subway Footlong — Spicy Italian (5 meat)', emoji:'🥪', serving:'12 inch', cal:960, p:40, c:92, f:48, tags:['subway','takeout'] },

    // --- Chipotle build-a-bowl ---
    { id:'chp_rice', name:'Chipotle — White Rice', emoji:'🌯', serving:'1 scoop (4oz)', cal:210, p:4, c:40, f:4, tags:['chipotle'] },
    { id:'chp_beans',name:'Chipotle — Black Beans', emoji:'🌯', serving:'1 scoop (4oz)', cal:130, p:8, c:22, f:1.5, tags:['chipotle'] },
    { id:'chp_steak',name:'Chipotle — Double Steak', emoji:'🌯', serving:'2 scoops (8oz)', cal:300, p:42, c:2, f:13, tags:['chipotle','protein'] },
    { id:'chp_pastor',name:'Chipotle — Chicken al Pastor (double)', emoji:'🌯', serving:'2 scoops (8oz)', cal:400, p:42, c:8, f:22, tags:['chipotle','protein'] },
    { id:'chp_cheese',name:'Chipotle — Cheese', emoji:'🧀', serving:'1 scoop (1oz)', cal:110, p:6, c:1, f:9, tags:['chipotle'] },
  ];

  const foodById = {};
  FOODS.forEach(f => foodById[f.id] = f);

  /* ---------- 8-WEEK PROGRAM ----------
     4-day Upper/Lower split. Day templates reference a weekday slot.
     repScheme is resolved by phase in workout.js.                     */

  // Reusable exercise definitions. `key` is the stable id used for history.
  const E = {
    // Upper compounds (anchor: bench)
    inclineBB:   { key:'inclineBB',  name:'Incline Barbell Press', type:'main', sets:4, ratio:0.82, anchor:'bench' },
    flatBench:   { key:'flatBench',  name:'Flat Barbell Bench',    type:'main', sets:4, ratio:1.00, anchor:'bench' },
    ohp:         { key:'ohp',        name:'Overhead Press',        type:'main', sets:4, ratio:0.63, anchor:'bench' },
    bbRow:       { key:'bbRow',      name:'Barbell Row',           type:'main', sets:4, ratio:0.95, anchor:'bench' },
    pullup:      { key:'pullup',     name:'Weighted Pull-ups',     type:'main', sets:4 },
    latPull:     { key:'latPull',    name:'Lat Pulldown',          type:'main', sets:3 },
    csRow:       { key:'csRow',      name:'Chest-Supported Row',   type:'acc',  sets:3 },
    inclineDB:   { key:'inclineDB',  name:'Incline DB Press',      type:'acc',  sets:3 },
    // Upper accessories
    lateral:     { key:'lateral',    name:'Lateral Raises',        type:'acc',  sets:4 },
    bbCurl:      { key:'bbCurl',     name:'Barbell Curl',          type:'acc',  sets:3 },
    inclineCurl: { key:'inclineCurl',name:'Incline DB Curl',       type:'acc',  sets:3 },
    pushdown:    { key:'pushdown',   name:'Cable Tricep Pushdown', type:'acc',  sets:3 },
    skull:       { key:'skull',      name:'Skull Crushers',        type:'acc',  sets:3 },
    facepull:    { key:'facepull',   name:'Face Pulls',            type:'acc',  sets:3 },
    // Lower compounds (anchor: squat)
    squat:       { key:'squat',      name:'Back Squat',            type:'main', sets:4, ratio:1.00, anchor:'squat' },
    frontSquat:  { key:'frontSquat', name:'Front Squat',           type:'main', sets:4, ratio:0.85, anchor:'squat' },
    rdl:         { key:'rdl',        name:'Romanian Deadlift',     type:'main', sets:4, ratio:1.10, anchor:'squat' },
    // Lower accessories
    legPress:    { key:'legPress',   name:'Leg Press',             type:'acc',  sets:3 },
    bulgarian:   { key:'bulgarian',  name:'Bulgarian Split Squat', type:'acc',  sets:3 },
    legCurl:     { key:'legCurl',    name:'Lying Leg Curl',        type:'acc',  sets:3 },
    calfStand:   { key:'calfStand',  name:'Standing Calf Raise',   type:'acc',  sets:4 },
    calfSeat:    { key:'calfSeat',   name:'Seated Calf Raise',     type:'acc',  sets:4 },
    // Plyo / conditioning
    boxJump:     { key:'boxJump',    name:'Box Jumps (48")',       type:'plyo', sets:3, reps:'3' },
    broadJump:   { key:'broadJump',  name:'Broad Jumps',           type:'plyo', sets:3, reps:'3' },
    // Abs / core
    legRaise:    { key:'legRaise',   name:'Hanging Leg Raises',    type:'abs',  sets:3, reps:'12–15' },
    cableCrunch: { key:'cableCrunch',name:'Cable Crunch',          type:'abs',  sets:3, reps:'12–15' },
    plank:       { key:'plank',      name:'Weighted Plank',        type:'abs',  sets:3, reps:'45–60s' },
    abWheel:     { key:'abWheel',    name:'Ab Wheel Rollout',      type:'abs',  sets:3, reps:'10–12' },
  };

  // Four training days. Order matters (plyo before legs).
  const DAYS = {
    upperA: {
      name:'Upper A — Push Focus',
      exercises:[ E.inclineBB, E.ohp, E.pullup, E.bbRow, E.lateral, E.bbCurl, E.pushdown, E.legRaise ]
    },
    lowerA: {
      name:'Lower A — Squat + Punt Power',
      exercises:[ E.boxJump, E.squat, E.rdl, E.legPress, E.calfStand, E.cableCrunch ]
    },
    upperB: {
      name:'Upper B — Pull Focus',
      exercises:[ E.flatBench, E.latPull, E.csRow, E.inclineDB, E.lateral, E.inclineCurl, E.skull, E.cableCrunch ]
    },
    lowerB: {
      name:'Lower B — Hinge + Single Leg',
      exercises:[ E.broadJump, E.frontSquat, E.rdl, E.bulgarian, E.legCurl, E.calfSeat, E.legRaise ]
    },
    conditioning: {
      name:'Climb Conditioning (Optional)',
      exercises:[
        { key:'inclineWalk', name:'Incline Treadmill / Stair Climb', type:'cond', sets:1, reps:'30–45 min @ 12% incline' },
        { key:'ruck',        name:'Weighted Ruck / Hike Prep',       type:'cond', sets:1, reps:'45–60 min w/ pack' },
        { key:'abWheel2',    name:'Ab Wheel Rollout',                type:'abs',  sets:3, reps:'10–12' },
      ]
    },
    rest: { name:'Rest / Recovery + Eat', exercises:[] }
  };

  // Weekly schedule by JS weekday index (0=Sun ... 6=Sat).
  // Mon Upper A, Tue Lower A, Wed rest, Thu Upper B, Fri Lower B,
  // Sat climb conditioning, Sun rest. Heavy emphasis = upper hypertrophy.
  const SCHEDULE = {
    1:'upperA', 2:'lowerA', 3:'rest', 4:'upperB', 5:'lowerB', 6:'conditioning', 0:'rest'
  };

  /* ---------- PHASE / REP RULES ---------- */
  function phaseForWeek(week) {
    return week <= 4 ? 1 : 2;  // weeks 1–4 volume, 5–8 heavy overload
  }
  function repScheme(exType, phase) {
    if (exType === 'main') return phase === 1 ? { sets:null, reps:'8–10', low:8, high:10 }
                                              : { sets:null, reps:'6–8',  low:6, high:8 };
    if (exType === 'acc')  return phase === 1 ? { sets:null, reps:'10–12', low:10, high:12 }
                                              : { sets:null, reps:'12–15', low:12, high:15 };
    return { reps:null }; // plyo/abs/cond use their own preset reps
  }

  /* ---------- STRENGTH RATIOS for cross-exercise prediction ---------- */
  // Used by workout.js. Anchor groups: 'bench' (upper) and 'squat' (lower).
  const RATIOS = {};
  Object.values(E).forEach(ex => { if (ex.ratio) RATIOS[ex.key] = { ratio:ex.ratio, anchor:ex.anchor, name:ex.name }; });

  /* ---------- EXERCISE LIBRARY (for swapping / adding / cardio) ---------- */
  // Cardio / conditioning options the user can swap in or dial up/down.
  const CARDIO = {
    inclineWalk:{ key:'inclineWalk', name:'Incline Treadmill / Stair Climb', type:'cond', sets:1, reps:'30–45 min @ 12%' },
    ruck:       { key:'ruck',        name:'Weighted Ruck / Hike Prep',       type:'cond', sets:1, reps:'45–60 min w/ pack' },
    abWheel2:   { key:'abWheel2',    name:'Ab Wheel Rollout',                type:'abs',  sets:3, reps:'10–12' },
    stairmaster:{ key:'stairmaster', name:'StairMaster',                     type:'cond', sets:1, reps:'20–30 min' },
    bikeZ2:     { key:'bikeZ2',      name:'Stationary Bike (Zone 2)',        type:'cond', sets:1, reps:'30–40 min easy' },
    rowInt:     { key:'rowInt',      name:'Rowing Intervals',                type:'cond', sets:1, reps:'8 × 250m' },
    jogEasy:    { key:'jogEasy',     name:'Easy Jog',                        type:'cond', sets:1, reps:'20–30 min' },
    jumpRope:   { key:'jumpRope',    name:'Jump Rope',                       type:'cond', sets:1, reps:'10–15 min' },
  };
  // Extra strength alternatives for swapping.
  const EXTRA = {
    dbBench:     { key:'dbBench',     name:'Flat Dumbbell Press',  type:'main', sets:4 },
    weightedDip: { key:'weightedDip', name:'Weighted Dips',        type:'main', sets:3 },
    cableFly:    { key:'cableFly',    name:'Cable Fly',            type:'acc',  sets:3 },
    hackSquat:   { key:'hackSquat',   name:'Hack Squat',           type:'main', sets:4 },
    legExt:      { key:'legExt',      name:'Leg Extension',        type:'acc',  sets:3 },
    hipThrust:   { key:'hipThrust',   name:'Barbell Hip Thrust',   type:'main', sets:3 },
    walkLunge:   { key:'walkLunge',   name:'Walking Lunge',        type:'acc',  sets:3 },
    cableLat:    { key:'cableLat',    name:'Cable Lateral Raise',  type:'acc',  sets:3 },
    rearDelt:    { key:'rearDelt',    name:'Rear Delt Fly',        type:'acc',  sets:3 },
    hammerCurl:  { key:'hammerCurl',  name:'Hammer Curl',          type:'acc',  sets:3 },
    ropePush:    { key:'ropePush',    name:'Rope Pushdown',        type:'acc',  sets:3 },
    preacher:    { key:'preacher',    name:'Preacher Curl',        type:'acc',  sets:3 },
    tbar:        { key:'tbar',        name:'T-Bar Row',            type:'main', sets:3 },
    seatedRow:   { key:'seatedRow',   name:'Seated Cable Row',     type:'acc',  sets:3 },
    russian:     { key:'russian',     name:'Russian Twist',        type:'abs',  sets:3, reps:'15–20' },
    deadbug:     { key:'deadbug',     name:'Dead Bug',             type:'abs',  sets:3, reps:'10–12' },
  };

  // Master lookup of everything selectable, keyed.
  const ALL = Object.assign({}, E, EXTRA, CARDIO);

  // Category for the picker.
  const CAT = {
    inclineBB:'Chest', flatBench:'Chest', inclineDB:'Chest', dbBench:'Chest', weightedDip:'Chest', cableFly:'Chest',
    ohp:'Shoulders', lateral:'Shoulders', facepull:'Shoulders', cableLat:'Shoulders', rearDelt:'Shoulders',
    pullup:'Back', latPull:'Back', bbRow:'Back', csRow:'Back', tbar:'Back', seatedRow:'Back',
    bbCurl:'Arms', inclineCurl:'Arms', pushdown:'Arms', skull:'Arms', hammerCurl:'Arms', ropePush:'Arms', preacher:'Arms',
    squat:'Legs', frontSquat:'Legs', rdl:'Legs', legPress:'Legs', bulgarian:'Legs', legCurl:'Legs',
    calfStand:'Legs', calfSeat:'Legs', hackSquat:'Legs', legExt:'Legs', hipThrust:'Legs', walkLunge:'Legs',
    boxJump:'Power', broadJump:'Power',
    legRaise:'Core', cableCrunch:'Core', plank:'Core', abWheel:'Core', abWheel2:'Core', russian:'Core', deadbug:'Core',
    inclineWalk:'Cardio', ruck:'Cardio', stairmaster:'Cardio', bikeZ2:'Cardio', rowInt:'Cardio', jogEasy:'Cardio', jumpRope:'Cardio',
  };
  Object.keys(ALL).forEach(k => { ALL[k].cat = CAT[k] || 'Other'; });

  const CAT_ORDER = ['Chest','Back','Shoulders','Arms','Legs','Core','Power','Cardio','Other'];
  function exLibrary() {
    const groups = {};
    Object.values(ALL).forEach(ex => { (groups[ex.cat] = groups[ex.cat] || []).push(ex); });
    return CAT_ORDER.filter(c => groups[c]).map(c => ({ cat:c, items:groups[c] }));
  }

  return { FOODS, foodById, E, DAYS, SCHEDULE, phaseForWeek, repScheme, RATIOS, ALL, exLibrary, CAT_ORDER };
})();
