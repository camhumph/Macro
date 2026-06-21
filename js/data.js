/* ============================================================
   Macro — static data: food DB, 8-week program, strength model
   ============================================================ */
window.App = window.App || {};

App.DATA = (function () {

  /* ---------- FOOD DATABASE ----------
     Macros are per the listed `serving`. Quantity scales linearly.
     cal = calories, p = protein(g), c = carbs(g), f = fat(g)         */
  const FOODS = [
    // --- Common items ---
    { id:'shake',  name:'Protein Shake (milk, whey, banana, PB)', emoji:'🥤', serving:'1 blender', cal:735, p:60, c:62, f:30, tags:['shake','breakfast','protein'] },
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

    // --- Ground beef by lean ratio (per 4 oz raw, as labeled on the pack) ---
    { id:'gb_937', name:'Ground Beef 93/7', emoji:'🥩', serving:'4 oz raw', cal:170, p:22, c:0, f:8,  tags:['ground beef','beef','protein','lean'] },
    { id:'gb_9010',name:'Ground Beef 90/10', emoji:'🥩', serving:'4 oz raw', cal:200, p:23, c:0, f:11, tags:['ground beef','beef','protein'] },
    { id:'gb_8515',name:'Ground Beef 85/15', emoji:'🥩', serving:'4 oz raw', cal:240, p:21, c:0, f:17, tags:['ground beef','beef','protein'] },
    { id:'gb_8020',name:'Ground Beef 80/20', emoji:'🥩', serving:'4 oz raw', cal:290, p:19, c:0, f:23, tags:['ground beef','beef','protein'] },
    { id:'gt_937', name:'Ground Turkey 93/7', emoji:'🦃', serving:'4 oz raw', cal:170, p:22, c:0, f:9,  tags:['ground turkey','turkey','protein','lean'] },
    { id:'gt_991', name:'Ground Turkey 99/1 (breast)', emoji:'🦃', serving:'4 oz raw', cal:120, p:26, c:0, f:2, tags:['ground turkey','turkey','protein','lean'] },

    // --- More common staples ---
    { id:'milk2',  name:'2% Milk', emoji:'🥛', serving:'1 cup', cal:122, p:8, c:12, f:5, tags:['dairy','drink'] },
    { id:'milkskim',name:'Skim Milk', emoji:'🥛', serving:'1 cup', cal:83, p:8, c:12, f:0, tags:['dairy','drink'] },
    { id:'eggwhite',name:'Egg Whites', emoji:'🥚', serving:'1/2 cup (4 whites)', cal:65, p:13, c:1, f:0, tags:['protein','breakfast','lean'] },
    { id:'cottage',name:'Cottage Cheese (low-fat)', emoji:'🧀', serving:'1 cup', cal:180, p:24, c:8, f:5, tags:['protein','dairy'] },
    { id:'brice',  name:'Brown Rice (cooked)', emoji:'🍚', serving:'1 cup', cal:215, p:5, c:45, f:1.8, tags:['carbs'] },
    { id:'chthigh',name:'Chicken Thigh (cooked)', emoji:'🍗', serving:'6 oz', cal:310, p:46, c:0, f:13, tags:['protein'] },
    { id:'sirloin',name:'Sirloin Steak', emoji:'🥩', serving:'6 oz', cal:330, p:46, c:0, f:15, tags:['protein','beef'] },
    { id:'tuna',   name:'Canned Tuna (in water)', emoji:'🐟', serving:'1 can (5 oz)', cal:120, p:26, c:0, f:1, tags:['protein','lean'] },
    { id:'bacon',  name:'Bacon', emoji:'🥓', serving:'2 slices', cal:80, p:6, c:0, f:6, tags:['protein','fat'] },
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
      name:'Lower A — Squat Focus',
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
    // Push / Pull / Legs (6-day split). Long-muscle-length emphasis.
    push: {
      name:'Push — Chest, Shoulders, Triceps',
      exercises:[ E.inclineBB, E.ohp, E.inclineDB, E.lateral, E.pushdown ]
    },
    pull: {
      name:'Pull — Back, Rear Delts, Biceps',
      exercises:[ E.pullup, E.bbRow, E.csRow, E.facepull, E.inclineCurl ]
    },
    legs: {
      name:'Legs — Quads, Hamstrings, Calves',
      exercises:[ E.squat, E.rdl, E.legPress, E.legCurl, E.calfStand, E.cableCrunch ]
    },
    // Full-body (3-day split). Big compounds first, one stretch-focused accessory.
    fullA: {
      name:'Full Body A',
      exercises:[ E.squat, E.flatBench, E.bbRow, E.lateral, E.legRaise ]
    },
    fullB: {
      name:'Full Body B',
      exercises:[ E.rdl, E.ohp, E.pullup, E.inclineCurl, E.calfStand ]
    },
    fullC: {
      name:'Full Body C',
      exercises:[ E.frontSquat, E.inclineDB, E.csRow, E.pushdown, E.cableCrunch ]
    },
    conditioning: {
      name:'Conditioning',
      exercises:[
        { key:'inclineWalk', name:'Incline Treadmill / Stair Climb', type:'cond', sets:1, reps:'30–45 min @ 12% incline' },
        { key:'ruck',        name:'Weighted Ruck / Hike Prep',       type:'cond', sets:1, reps:'45–60 min w/ pack' },
        { key:'abWheel2',    name:'Ab Wheel Rollout',                type:'abs',  sets:3, reps:'10–12' },
      ]
    },
    rest: { name:'Rest / Recovery', exercises:[] }
  };

  /* ---------- SPLITS & SCHEDULE ---------- */
  const SPLITS = {
    fullbody:   { name:'Full Body',  rotation:['fullA','fullB','fullC'],          defaultDays:3 },
    upperlower: { name:'Upper/Lower', rotation:['upperA','lowerA','upperB','lowerB'], defaultDays:4 },
    ppl:        { name:'Push/Pull/Legs', rotation:['push','pull','legs'],         defaultDays:6 },
  };
  // Preferred training weekdays for N days/week (1=Mon … 6=Sat, 0=Sun).
  const DAY_PATTERNS = { 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,4,6], 6:[1,2,3,4,5,6] };

  // Build a weekday→dayType map from split, days/week, and cardio volume.
  function buildSchedule(split, days, cardio) {
    const cfg = SPLITS[split] || SPLITS.upperlower;
    const rot = cfg.rotation;
    days = days || cfg.defaultDays;
    const pat = DAY_PATTERNS[days] || DAY_PATTERNS[4];
    const map = { 0:'rest', 1:'rest', 2:'rest', 3:'rest', 4:'rest', 5:'rest', 6:'rest' };
    pat.forEach((d, i) => { map[d] = rot[i % rot.length]; });
    const restDays = [1, 2, 3, 4, 5, 6, 0].filter(d => map[d] === 'rest');
    const cc = cardio === 'high' ? 2 : cardio === 'moderate' ? 1 : 0;
    restDays.slice(0, cc).forEach(d => { map[d] = 'conditioning'; });
    return map;
  }

  /* ---------- REP RULES by training bias (with RIR / proximity-to-failure) ---------- */
  // bias: 'strength' | 'power' | 'hypertrophy' | 'endurance'
  function repScheme(exType, bias) {
    const M = {
      strength:    { main:{reps:'4–6', low:4, high:6, rir:'1–2 RIR'},  acc:{reps:'6–8',  low:6,  high:8,  rir:'1–2 RIR'} },
      power:       { main:{reps:'5–8', low:5, high:8, rir:'1–3 RIR'},  acc:{reps:'8–12', low:8,  high:12, rir:'1–2 RIR'} },
      hypertrophy: { main:{reps:'6–10',low:6, high:10,rir:'1–2 RIR'},  acc:{reps:'10–15',low:10, high:15, rir:'0–2 RIR'} },
      endurance:   { main:{reps:'12–15',low:12,high:15,rir:'1–2 RIR'}, acc:{reps:'15–20',low:15, high:20, rir:'0–1 RIR'} },
    };
    const t = M[bias] || M.hypertrophy;
    if (exType === 'main') return { sets:null, ...t.main };
    if (exType === 'acc')  return { sets:null, ...t.acc };
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

  /* ---------- biomechanics metadata (volume counting, supersets, stretch) ---------- */
  // primary muscle (for per-muscle volume counting)
  const MUSCLE = {
    inclineBB:'chest', flatBench:'chest', inclineDB:'chest', dbBench:'chest', weightedDip:'chest', cableFly:'chest',
    ohp:'delts', lateral:'side delts', cableLat:'side delts', facepull:'rear delts', rearDelt:'rear delts',
    pullup:'back', latPull:'back', bbRow:'back', csRow:'back', tbar:'back', seatedRow:'back',
    bbCurl:'biceps', inclineCurl:'biceps', preacher:'biceps', hammerCurl:'biceps',
    pushdown:'triceps', skull:'triceps', ropePush:'triceps',
    squat:'quads', frontSquat:'quads', legPress:'quads', hackSquat:'quads', legExt:'quads', bulgarian:'quads', walkLunge:'quads',
    rdl:'hamstrings', legCurl:'hamstrings', hipThrust:'glutes',
    calfStand:'calves', calfSeat:'calves',
    boxJump:'power', broadJump:'power',
    legRaise:'core', cableCrunch:'core', plank:'core', abWheel:'core', abWheel2:'core', russian:'core', deadbug:'core',
  };
  // antagonist group, for agonist-antagonist paired sets (supersets)
  const GROUP = {
    inclineBB:'horizPush', flatBench:'horizPush', inclineDB:'horizPush', dbBench:'horizPush', weightedDip:'horizPush', cableFly:'horizPush',
    ohp:'vertPush', bbRow:'horizPull', csRow:'horizPull', tbar:'horizPull', seatedRow:'horizPull',
    pullup:'vertPull', latPull:'vertPull',
    bbCurl:'biceps', inclineCurl:'biceps', preacher:'biceps', hammerCurl:'biceps',
    pushdown:'triceps', skull:'triceps', ropePush:'triceps',
    squat:'quad', frontSquat:'quad', legPress:'quad', hackSquat:'quad', legExt:'quad', bulgarian:'quad', walkLunge:'quad',
    rdl:'ham', legCurl:'ham',
  };
  const ANTAG = { horizPush:'horizPull', horizPull:'horizPush', vertPush:'vertPull', vertPull:'vertPush', quad:'ham', ham:'quad', biceps:'triceps', triceps:'biceps' };
  // exercises that load the muscle hard at long lengths (stretch-mediated hypertrophy)
  const STRETCH = new Set(['inclineBB','inclineDB','dbBench','cableFly','rdl','legCurl','squat','frontSquat','bulgarian','walkLunge','legPress','inclineCurl','skull','ropePush','latPull','pullup','calfSeat','calfStand']);
  // exercises where lengthened partials past failure add useful volume
  const LP = new Set(['lateral','cableLat','legExt','calfStand','calfSeat','pushdown','ropePush','bbCurl','rearDelt','facepull']);
  Object.keys(ALL).forEach(k => {
    const ex = ALL[k];
    ex.muscle = MUSCLE[k] || null;
    ex.group = GROUP[k] || null;
    ex.mj = ex.type === 'main';            // multi-joint compound
    ex.stretch = STRETCH.has(k);
    ex.lp = LP.has(k);
  });

  const CAT_ORDER = ['Chest','Back','Shoulders','Arms','Legs','Core','Power','Cardio','Other'];
  function exLibrary() {
    const groups = {};
    Object.values(ALL).forEach(ex => { (groups[ex.cat] = groups[ex.cat] || []).push(ex); });
    return CAT_ORDER.filter(c => groups[c]).map(c => ({ cat:c, items:groups[c] }));
  }

  return { FOODS, foodById, E, DAYS, SPLITS, buildSchedule, repScheme, RATIOS, ANTAG, ALL, exLibrary, CAT_ORDER };
})();
