/* ============================================================
   Macro — app shell: router, dashboard, onboarding, settings
   ============================================================ */
window.App = window.App || {};

(function () {
  const Store = App.Store, UI = App.UI;

  const TITLES = {
    today: ['Today', 'Your training & nutrition'],
    food:  ['Nutrition', 'Calories & macros'],
    weight:['Weigh-In', 'Track your trend'],
    stats: ['Progress', 'Strength, plan & compete'],
  };

  let currentRoute = 'today';

  const Router = {
    go(route) {
      currentRoute = route;
      const view = document.getElementById('view');
      view.scrollTop = 0;
      window.scrollTo(0, 0);

      // appbar
      const [title, sub] = TITLES[route] || TITLES.today;
      document.getElementById('appbar-title').textContent = title;
      document.getElementById('appbar-sub').textContent = sub;

      // tabs
      document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.dataset.route === route));

      if (route === 'today') dashboard(view);
      else if (route === 'food') App.Food.page(view);
      else if (route === 'weight') App.Weight.page(view);
      else if (route === 'stats') App.Stats.page(view);
    },
    refresh() { Router.go(currentRoute); }
  };
  App.Router = Router;

  /* ---------- Today dashboard ---------- */
  function dashboard(view) {
    const p = Store.profile();
    const week = Store.weekFor();
    const pl = App.Goals.plan();
    const target = Store.daysUntilTarget();
    const t = Store.dayTotals();
    const remaining = Math.max(0, p.cal + Store.exerciseCals() - t.cal);
    const cur = Store.latestWeight();
    const toGoal = (p.targetWeight || cur) - cur;

    const hour = new Date().getHours();
    const greet = hour < 11 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    let dueBanner = '';
    if (App.Reminders.isDue()) {
      dueBanner = `<div class="banner warn"><span class="b-ico">⚖️</span><div><b>Weigh-in time</b>It's past ${App.Weight.fmtTime(p.weighInTime)} — log today's weight.</div>
        <button class="btn small primary" id="db-weigh" style="margin-left:auto">Log</button></div>`;
    }

    const goalLine = p.weightDir > 0 ? `${UI.round(Math.abs(toGoal),1)} lb to your goal of ${p.targetWeight} lb`
      : p.weightDir < 0 ? `${UI.round(Math.abs(toGoal),1)} lb to your goal of ${p.targetWeight} lb`
      : `Maintaining around ${p.targetWeight} lb`;

    view.innerHTML = `
      ${dueBanner}
      <div class="hero">
        <div class="eyebrow">${UI.esc(pl.title)} · Week ${week}</div>
        <h1>${greet}.</h1>
        <p>${goalLine}.</p>
        <div class="countdown">
          <div class="cd-box"><b>${cur}</b><span>current lb</span></div>
          <div class="cd-box"><b>${p.targetWeight}</b><span>goal lb</span></div>
          <div class="cd-box"><b>${target != null ? target : '—'}</b><span>${target != null ? 'days to target' : 'no target set'}</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="spread" style="margin-bottom:12px">
          <b>Today's nutrition</b>
          <span class="pill ${remaining>0?'orange':'accent'}">${remaining>0?UI.round(remaining)+' cal left':'target hit ✓'}</span>
        </div>
        <div class="macro-bars">
          ${UI.macroBar('Protein', t.protein, p.protein, 'var(--protein)')}
          ${UI.macroBar('Carbs', t.carbs, p.carbs, 'var(--carbs)')}
          ${UI.macroBar('Fat', t.fat, p.fat, 'var(--fat)')}
        </div>
        <button class="btn small ghost" id="db-food" style="width:100%;margin-top:14px">Open food log ▸</button>
      </div>

      ${App.Coach.card()}
      ${App.Leaderboard.streakCard()}

      <div class="section-title"><h2>Today's Session</h2><span class="link" id="db-stats">Stats ▸</span></div>
      <div id="db-workout"></div>
    `;

    App.Workout.render(view.querySelector('#db-workout'));

    const wb = view.querySelector('#db-weigh');
    if (wb) wb.onclick = () => Router.go('weight');
    view.querySelector('#db-food').onclick = () => Router.go('food');
    view.querySelector('#db-stats').onclick = () => Router.go('stats');
    const sc = view.querySelector('#streak-compete');
    if (sc) sc.onclick = () => App.Stats.open('compete');
  }

  /* ---------- Settings sheet ---------- */
  function settings() {
    const p = Store.profile();
    const G = App.Goals;
    const goals = (p.goals || ['physique']).slice();
    UI.modal(`
      <h2>Goals & Profile</h2>

      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Goal paths (pick any mix)</label>
      ${G.goalChips(goals)}
      <button class="btn ghost small" id="s-race" style="width:100%;margin:12px 0 0">🏃 Race / marathon setup</button>
      ${UI.field('Diet phase', G.phaseSelect(p.dietPhase))}
      ${UI.field('Bulking pace', G.gainRateSelect(p.gainRate))}
      ${UI.field('Lifting experience', `<select class="input" id="g-lifter">${[['beginner','Beginner (new to lifting)'],['returning','Returning / detrained (muscle memory)'],['intermediate','Intermediate'],['advanced','Advanced']].map(([k,l])=>`<option value="${k}" ${k===(p.lifterStatus||'returning')?'selected':''}>${l}</option>`).join('')}</select>`)}

      <div class="divider"></div>
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Your stats</label>
      ${UI.field('Name', `<input class="input" id="s-name" value="${UI.esc(p.name)}">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Sex</label>${G.sexSelect(p.sex)}</div>
        <div class="field" style="margin:0"><label>Age</label><input class="input" id="s-age" type="number" value="${p.age}"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Height (in)</label><input class="input" id="s-h" type="number" value="${p.heightIn}"></div>
        <div class="field" style="margin:0"><label>Current weight (lb)</label><input class="input" id="s-sw" type="number" value="${UI.round(Store.latestWeight())}"></div>
      </div>
      ${UI.field('Goal weight (lb) — leave blank for auto', `<input class="input" id="s-gw" type="number" inputmode="decimal" placeholder="auto" value="${p.goalWeight || ''}">`)}
      ${UI.field('Activity level', G.activitySelect(p.activity))}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Training split</label>${G.splitSelect(p.split)}</div>
        <div class="field" style="margin:0"><label>Days / week</label>${G.daysSelect(p.daysPerWeek)}</div>
      </div>
      <div class="list-row">
        <div class="lr-l"><b>Adaptive schedule</b><small>Always show the next workout — never fall behind if you miss a day</small></div>
        <div class="switch ${p.scheduleMode!=='fixed'?'on':''}" id="s-flex"></div>
      </div>
      ${UI.field('Target date (optional)', `<input class="input" id="s-target" type="date" value="${p.targetDate||''}">`)}

      <div class="divider"></div>
      <div class="spread"><b>Your plan</b><button class="link" id="s-recalc" style="font-size:12px;color:var(--accent)">Recalculate ▸</button></div>
      <div id="s-plan" style="margin-top:10px"></div>
      <div id="s-guide" style="margin-top:12px"></div>

      <div class="divider"></div>
      <div class="list-row">
        <div class="lr-l"><b>Override macros manually</b><small>Stop auto-calculating from goals</small></div>
        <div class="switch ${p.customMacros?'on':''}" id="s-custom"></div>
      </div>
      <div id="s-macros" class="${p.customMacros?'':'hidden'}">
        <div class="inline-fields" style="margin:4px 0 14px">
          <div class="field" style="margin:0"><label>Calories</label><input class="input" id="s-cal" type="number" value="${p.cal}"></div>
          <div class="field" style="margin:0"><label>Protein g</label><input class="input" id="s-p" type="number" value="${p.protein}"></div>
        </div>
        <div class="inline-fields" style="margin-bottom:14px">
          <div class="field" style="margin:0"><label>Carbs g</label><input class="input" id="s-c" type="number" value="${p.carbs}"></div>
          <div class="field" style="margin:0"><label>Fat g</label><input class="input" id="s-f" type="number" value="${p.fat}"></div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="list-row">
        <div class="lr-l"><b>Weigh-in reminder</b><small>Daily nudge to log your weight</small></div>
        <div class="switch ${p.reminders?'on':''}" id="s-rem"></div>
      </div>
      ${UI.field('Reminder time', `<input class="input" id="s-time" type="time" value="${p.weighInTime}">`)}

      <div class="divider"></div>
      <div class="list-row">
        <div class="lr-l"><b>Advanced intensity techniques</b><small>Rest-pause / drop sets / eccentrics on final sets (hypertrophy)</small></div>
        <div class="switch ${p.intensityTech?'on':''}" id="s-itech"></div>
      </div>
      <div class="list-row">
        <div class="lr-l"><b>Fresh variation each session</b><small>Rotate accessory exercises; keep heavy compounds for progressive overload</small></div>
        <div class="switch ${p.varyWorkouts!==false?'on':''}" id="s-vary"></div>
      </div>
      <div class="list-row">
        <div class="lr-l"><b>Rest timer</b><small>Auto-start between sets</small></div>
        <div class="switch ${p.restTimerOn?'on':''}" id="s-rt"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Rest (seconds)</label><input class="input" id="s-rtsec" type="number" value="${p.restTimer||120}"></div>
        <div class="field" style="margin:0"><label>Water goal (cups)</label><input class="input" id="s-water" type="number" value="${p.waterGoal||8}"></div>
      </div>

      <div class="divider"></div>
      <b>Account & Cloud sync</b>
      <div id="s-account" style="margin-top:8px"></div>

      <div class="divider"></div>
      <b>Strava</b>
      <div id="s-strava" style="margin-top:8px"></div>

      <div class="divider"></div>
      <b>Data & Backup</b>
      <p class="muted" style="margin:6px 0 12px;font-size:12.5px;line-height:1.5">On iPhone, the Home-Screen app and Safari keep <b>separate</b> data. Use this installed app and back up regularly.</p>
      <div class="btn-row" style="margin-top:0">
        <button class="btn" id="s-export">⬆️ Export backup</button>
        <button class="btn" id="s-import">⬇️ Import / Restore</button>
      </div>

      <button class="btn primary" id="s-save" style="margin-top:18px">Save</button>
      <button class="btn ghost danger" id="s-reset" style="margin-top:10px">Reset this profile</button>
      <p class="muted center" style="font-size:12px;margin-top:14px">Your data lives only on this device.</p>
    `, (m, close) => {
      G.wireGoalChips(m, goals);
      m.querySelector('#s-race').onclick = () => { close(); App.Running.setupSheet(() => { setProfileInitial(); Router.refresh(); }); };
      renderAccount(m.querySelector('#s-account'));
      renderStrava(m.querySelector('#s-strava'));
      const rem = m.querySelector('#s-rem'); rem.onclick = () => rem.classList.toggle('on');
      const flex = m.querySelector('#s-flex'); flex.onclick = () => flex.classList.toggle('on');
      const rt = m.querySelector('#s-rt'); rt.onclick = () => rt.classList.toggle('on');
      const itech = m.querySelector('#s-itech'); itech.onclick = () => itech.classList.toggle('on');
      const vary = m.querySelector('#s-vary'); vary.onclick = () => vary.classList.toggle('on');
      const custom = m.querySelector('#s-custom');
      custom.onclick = () => { custom.classList.toggle('on'); m.querySelector('#s-macros').classList.toggle('hidden', !custom.classList.contains('on')); };

      // read current form into a temp profile for live plan preview
      const readStats = () => ({
        sex: m.querySelector('#g-sex').value, age:+m.querySelector('#s-age').value || p.age,
        heightIn:+m.querySelector('#s-h').value || p.heightIn, activity:m.querySelector('#g-act').value,
        split:m.querySelector('#g-split').value, daysPerWeek:+m.querySelector('#g-days').value || 0,
        dietPhase:m.querySelector('#g-phase').value, gainRate:m.querySelector('#g-rate').value, goalWeight:+m.querySelector('#s-gw').value || 0,
        targetDate:m.querySelector('#s-target').value, goals, startWeight:+m.querySelector('#s-sw').value || Store.latestWeight(),
      });
      const drawPlan = () => {
        const pl = App.Goals.plan(Object.assign({}, p, readStats()), +m.querySelector('#s-sw').value || Store.latestWeight());
        m.querySelector('#s-plan').innerHTML = App.Goals.planSummary(pl);
        m.querySelector('#s-guide').innerHTML = App.Goals.guideCard(pl);
      };
      m.querySelector('#s-recalc').onclick = drawPlan;
      m.querySelectorAll('[data-goal], #g-sex, #s-age, #s-h, #s-sw, #s-gw, #g-act, #g-split, #g-days, #g-phase, #g-rate, #s-target').forEach(el => el.addEventListener('change', drawPlan));
      drawPlan();

      m.querySelector('#s-export').onclick = exportBackup;
      m.querySelector('#s-import').onclick = importBackup;
      m.querySelector('#s-save').onclick = async () => {
        const wantRem = rem.classList.contains('on');
        const wantCustom = custom.classList.contains('on');
        const newW = +m.querySelector('#s-sw').value || Store.latestWeight();
        Store.setProfile(Object.assign({
          name: m.querySelector('#s-name').value.trim() || 'Athlete',
          goals,
          sex: m.querySelector('#g-sex').value,
          age: +m.querySelector('#s-age').value || p.age,
          heightIn: +m.querySelector('#s-h').value || p.heightIn,
          activity: m.querySelector('#g-act').value,
          split: m.querySelector('#g-split').value,
          daysPerWeek: +m.querySelector('#g-days').value || 0,
          dietPhase: m.querySelector('#g-phase').value,
          gainRate: m.querySelector('#g-rate').value,
          lifterStatus: m.querySelector('#g-lifter').value,
          goalWeight: +m.querySelector('#s-gw').value || 0,
          scheduleMode: flex.classList.contains('on') ? 'flexible' : 'fixed',
          restTimerOn: rt.classList.contains('on'),
          intensityTech: itech.classList.contains('on'),
          varyWorkouts: vary.classList.contains('on'),
          restTimer: +m.querySelector('#s-rtsec').value || 120,
          waterGoal: +m.querySelector('#s-water').value || 8,
          targetDate: m.querySelector('#s-target').value || '',
          weighInTime: m.querySelector('#s-time').value || p.weighInTime,
          reminders: wantRem,
          customMacros: wantCustom,
        }, wantCustom ? {
          cal:+m.querySelector('#s-cal').value || p.cal, protein:+m.querySelector('#s-p').value || p.protein,
          carbs:+m.querySelector('#s-c').value || p.carbs, fat:+m.querySelector('#s-f').value || p.fat,
        } : {}));
        if (Math.abs(newW - Store.latestWeight()) > 0.01) Store.logWeight(newW);
        App.Goals.recompute();
        if (wantRem) await App.Reminders.requestPermission();
        App.Reminders.start();
        close(); setProfileInitial(); Router.refresh();
        UI.toast('Saved', 'good');
      };
      m.querySelector('#s-reset').onclick = () => {
        if (confirm('Erase this profile\'s workouts, food and weight history?')) { Store.resetAll(); close(); location.reload(); }
      };
    });
  }

  /* ---------- Account & Cloud sync settings ---------- */
  function statusLabel() {
    const s = App.Cloud.getStatus();
    return s === 'synced' ? '✅ Synced' : s === 'syncing' ? '↻ Syncing…' : s === 'offline' ? '⚠️ Offline — will sync later' : '';
  }
  function renderAccount(host) {
    const C = App.Cloud;
    if (!C) { host.innerHTML = ''; return; }
    if (!C.configured()) {
      host.innerHTML = `
        <p class="muted" style="margin:0 0 10px;font-size:12.5px;line-height:1.5">Save your account online and sync across devices. One-time free setup with Firebase (no credit card) — see <b>CLOUD-SETUP.md</b>. Until then everything stays safely on this device.</p>
        <button class="btn" id="ac-setup">Set up cloud sync</button>`;
      host.querySelector('#ac-setup').onclick = () => cloudConfigSheet(() => renderAccount(host));
      return;
    }
    if (!C.available()) {
      host.innerHTML = `<p class="muted" style="margin:0;font-size:12.5px">Connecting to the cloud… if this persists you may be offline, or the config needs fixing. <button class="link" id="ac-edit" style="color:var(--accent)">Edit config</button></p>`;
      host.querySelector('#ac-edit').onclick = () => cloudConfigSheet(() => renderAccount(host));
      return;
    }
    const u = C.currentUser();
    if (!u) {
      host.innerHTML = `
        ${UI.field('Username or email', `<input class="input" id="ac-email" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="e.g. cameron">`)}
        ${UI.field('Password', `<input class="input" id="ac-pw" type="password" autocomplete="current-password" placeholder="6+ characters">`)}
        <div class="btn-row" style="margin-top:0"><button class="btn primary" id="ac-in">Sign in</button><button class="btn" id="ac-up">Create account</button></div>
        <button class="link" id="ac-edit" style="color:var(--faint);font-size:12px;margin-top:10px">Edit cloud config</button>`;
      const email = () => host.querySelector('#ac-email').value.trim();
      const pw = () => host.querySelector('#ac-pw').value;
      host.querySelector('#ac-in').onclick = async () => {
        if (!email() || !pw()) return UI.toast('Enter username + password');
        UI.toast('Signing in…');
        try { await C.signIn(email(), pw()); UI.toast('Signed in ✅', 'good'); renderAccount(host); }
        catch (e) { UI.toast(authMsg(e)); }
      };
      host.querySelector('#ac-up').onclick = async () => {
        if (!email() || pw().length < 6) return UI.toast('Username + 6-char password');
        UI.toast('Creating account…');
        try { await C.signUp(email(), pw(), email().indexOf('@') === -1 ? email() : Store.profile().name); UI.toast('Account created ✅', 'good'); renderAccount(host); }
        catch (e) { UI.toast(authMsg(e)); }
      };
      host.querySelector('#ac-edit').onclick = () => cloudConfigSheet(() => renderAccount(host));
      return;
    }
    // signed in
    host.innerHTML = `
      <p class="muted" style="margin:0 0 8px;font-size:13px">Signed in as <b>${UI.esc(u.email || '')}</b>. <span id="ac-st">${statusLabel()}</span></p>
      <div class="card" style="margin:0 0 10px;line-height:1.5">
        <div class="spread"><span class="muted" style="font-size:12px">Your friend code</span><b style="font-family:monospace;letter-spacing:2px;font-size:17px">${UI.esc(C.code() || '······')}</b></div>
        <p class="muted" style="margin:8px 0 0;font-size:12px">Share this code so friends can add you. No public directory — only people with your code can find you.</p>
        <button class="btn ghost" id="ac-copy" style="margin-top:10px">📋 Copy my code</button>
      </div>
      ${UI.field('Add a friend by code', `<input class="input" id="ac-fc" placeholder="e.g. K7P2QX" style="text-transform:uppercase;letter-spacing:2px;font-family:monospace">`)}
      <button class="btn" id="ac-add">Add friend</button>
      <div class="btn-row"><button class="btn ghost" id="ac-sync">↻ Sync now</button><button class="btn ghost danger" id="ac-out">Sign out</button></div>`;
    host.querySelector('#ac-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(C.code() || ''); UI.toast('Code copied ✅', 'good'); } catch (e) { UI.toast(C.code() || ''); }
    };
    host.querySelector('#ac-add').onclick = async () => {
      const v = host.querySelector('#ac-fc').value;
      if (!v.trim()) return UI.toast('Enter their code');
      UI.toast('Looking up…');
      try { const name = await C.addByCode(v); UI.toast(name + ' added 🏆', 'good'); host.querySelector('#ac-fc').value = ''; }
      catch (e) { UI.toast(e.message || 'Not found'); }
    };
    host.querySelector('#ac-sync').onclick = async () => { UI.toast('Syncing…'); try { await C.push(); await C.refreshFriends(); UI.toast('Synced ✅', 'good'); } catch (e) { UI.toast('Sync failed'); } };
    host.querySelector('#ac-out').onclick = async () => { await C.signOut(); UI.toast('Signed out'); renderAccount(host); };
    // live status updates
    C.onChange(() => { const el = host.querySelector('#ac-st'); if (el) el.textContent = statusLabel(); });
  }
  function authMsg(e) {
    const c = (e && e.code) || '';
    if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead';
    if (c.includes('invalid-email')) return 'That email looks invalid';
    if (c.includes('weak-password')) return 'Password needs 6+ characters';
    if (c.includes('wrong-password') || c.includes('invalid-credential')) return 'Wrong email or password';
    if (c.includes('user-not-found')) return 'No account with that email';
    if (c.includes('operation-not-allowed')) return 'Email sign-in isn\'t enabled on the server yet';
    if (c.includes('too-many-requests')) return 'Too many tries — wait a minute and retry';
    if (c.includes('network')) return 'Network error — check your connection';
    return (e && e.message) || 'Something went wrong';
  }
  function cloudConfigSheet(after) {
    const C = App.Cloud;
    const cur = C.getConfig();
    UI.modal(`
      <h2>Cloud setup</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Paste your <b>Firebase web config</b> here (the <code>const firebaseConfig = {…}</code> block from your Firebase project). Full step-by-step is in <b>CLOUD-SETUP.md</b>. This is free and stays online 24/7.</p>
      <textarea class="input" id="cc-data" placeholder='{ "apiKey": "…", "authDomain": "…", "projectId": "…", "appId": "…" }' style="height:150px;font-size:11px;font-family:monospace">${cur ? UI.esc(JSON.stringify(cur, null, 2)) : ''}</textarea>
      <button class="btn primary" id="cc-save" style="margin-top:12px">Save & connect</button>
      ${cur ? `<button class="btn ghost danger" id="cc-clear" style="margin-top:10px">Remove cloud config</button>` : ''}
    `, (m, close) => {
      m.querySelector('#cc-save').onclick = async () => {
        const cfg = C.parseConfig(m.querySelector('#cc-data').value);
        if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId) return UI.toast('That config is missing apiKey / projectId / appId');
        C.setConfig(cfg);
        UI.toast('Connecting…');
        await C.init();
        close(); if (after) after();
      };
      const clr = m.querySelector('#cc-clear');
      if (clr) clr.onclick = () => { if (confirm('Remove cloud config? Your local data stays; cloud sync stops until you set it up again.')) { C.clearConfig(); close(); if (after) after(); } };
    });
  }

  /* ---------- Strava settings ---------- */
  function renderStrava(host) {
    const S = App.Strava; const c = S.cfg();
    if (S.connected()) {
      host.innerHTML = `
        <p class="muted" style="margin:0 0 10px;font-size:13px">Connected${c.athlete ? ' as <b>' + UI.esc(c.athlete) + '</b>' : ''}.${c.lastSync ? ' Last sync ' + new Date(c.lastSync).toLocaleDateString() : ''}</p>
        <div class="btn-row" style="margin-top:0">
          <button class="btn primary" id="sv-sync">↻ Sync runs</button>
          <button class="btn ghost danger" id="sv-disc">Disconnect</button>
        </div>`;
      host.querySelector('#sv-sync').onclick = async () => {
        UI.toast('Syncing…');
        try { const n = await S.sync(); UI.toast(`Imported ${n} run${n===1?'':'s'} 🏃`, 'good'); Router.refresh(); }
        catch (e) { UI.toast('Strava: ' + e.message); }
      };
      host.querySelector('#sv-disc').onclick = () => { S.disconnect(); renderStrava(host); UI.toast('Disconnected'); };
    } else {
      host.innerHTML = `
        <p class="muted" style="margin:0 0 10px;font-size:12.5px;line-height:1.5">Import your runs automatically. Needs a one-time setup (a serverless token endpoint) — see <b>STRAVA-SETUP.md</b>.</p>
        ${UI.field('Strava Client ID', `<input class="input" id="sv-id" value="${UI.esc(c.clientId||'')}" placeholder="e.g. 12345">`)}
        ${UI.field('Token endpoint URL', `<input class="input" id="sv-ep" value="${UI.esc(c.endpoint||'')}" placeholder="https://your-app.vercel.app/api/strava-token">`)}
        <button class="btn primary" id="sv-conn">Connect Strava</button>`;
      host.querySelector('#sv-conn').onclick = () => {
        S.setConfig(host.querySelector('#sv-id').value, host.querySelector('#sv-ep').value);
        if (!App.Strava.configured()) return UI.toast('Enter Client ID + endpoint');
        S.connect();
      };
    }
  }

  /* ---------- Backup: export / import ---------- */
  function exportBackup() {
    const json = JSON.stringify(Store.get());
    UI.modal(`
      <h2>Export Backup</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Save this somewhere safe (email it to yourself, paste into Notes). To move to a new phone or the Home-Screen app, paste it into <b>Import</b> there.</p>
      <textarea class="input" id="bk-data" readonly style="height:130px;font-size:11px;font-family:monospace">${UI.esc(json)}</textarea>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" id="bk-copy">📋 Copy</button>
        <button class="btn" id="bk-file">💾 Download file</button>
      </div>
      <button class="btn ghost" id="bk-share" style="margin-top:10px">Share…</button>
    `, (m, close) => {
      m.querySelector('#bk-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(json); UI.toast('Copied ✅','good'); }
        catch (e) { const ta = m.querySelector('#bk-data'); ta.focus(); ta.select(); UI.toast('Select all & copy'); }
      };
      m.querySelector('#bk-file').onclick = () => {
        const blob = new Blob([json], { type:'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `macro-backup-${Store.todayKey()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      const shareBtn = m.querySelector('#bk-share');
      if (navigator.share) shareBtn.onclick = () => {
        const file = new File([json], `macro-backup-${Store.todayKey()}.json`, { type:'application/json' });
        if (navigator.canShare && navigator.canShare({ files:[file] })) navigator.share({ files:[file], title:'Macro backup' }).catch(()=>{});
        else navigator.share({ title:'Macro backup', text:json }).catch(()=>{});
      };
      else shareBtn.style.display = 'none';
    });
  }

  function importBackup() {
    UI.modal(`
      <h2>Import / Restore</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Paste a backup below, or pick a backup file. This <b>replaces</b> everything currently in the app.</p>
      <input type="file" id="im-file" accept="application/json,.json,text/plain" class="input" style="padding:10px">
      <textarea class="input" id="im-data" placeholder="…or paste backup text here" style="height:120px;font-size:11px;font-family:monospace;margin-top:12px"></textarea>
      <button class="btn primary" id="im-go" style="margin-top:14px">Restore this backup</button>
    `, (m, close) => {
      const ta = m.querySelector('#im-data');
      m.querySelector('#im-file').onchange = (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { ta.value = r.result; UI.toast('File loaded — tap Restore'); };
        r.readAsText(f);
      };
      m.querySelector('#im-go').onclick = () => {
        const raw = ta.value.trim();
        if (!raw) return UI.toast('Paste a backup or pick a file');
        let obj;
        try { obj = JSON.parse(raw); } catch (e) { return UI.toast('That isn\'t valid backup text'); }
        try { Store.importState(obj); } catch (e) { return UI.toast(e.message || 'Invalid backup'); }
        if (confirm('Backup loaded. Reload now to apply?')) location.reload();
        else { close(); Router.refresh(); UI.toast('Restored ✅','good'); }
      };
    });
  }

  /* ---------- Onboarding ---------- */
  function onboard() {
    const p = Store.profile();
    const G = App.Goals;
    const goals = ['physique'];
    UI.modal(`
      <h2>Welcome to Macro</h2>
      <p class="muted" style="margin-top:-8px">Pick what you're training for. The app builds your nutrition and program around it — you can change this anytime.</p>

      <label style="display:block;font-size:12px;color:var(--muted);margin:10px 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Goal paths (pick one or more)</label>
      ${G.goalChips(goals)}
      ${UI.field('Diet phase', G.phaseSelect('auto'))}

      ${UI.field('Name', `<input class="input" id="o-name" placeholder="First name">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Sex</label>${G.sexSelect('male')}</div>
        <div class="field" style="margin:0"><label>Age</label><input class="input" id="o-age" type="number" placeholder="25"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Weight (lb)</label><input class="input" id="o-sw" type="number" placeholder="160"></div>
        <div class="field" style="margin:0"><label>Goal weight (optional)</label><input class="input" id="o-gw" type="number" placeholder="auto"></div>
      </div>
      ${UI.field('Height (in)', `<input class="input" id="o-h" type="number" placeholder="70">`)}
      ${UI.field('Activity level', G.activitySelect('moderate'))}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Training split</label>${G.splitSelect('auto')}</div>
        <div class="field" style="margin:0"><label>Days / week</label>${G.daysSelect(0)}</div>
      </div>
      ${UI.field('Target date (optional)', `<input class="input" id="o-target" type="date">`)}

      <div id="o-plan" style="margin:6px 0 14px"></div>
      <button class="btn primary" id="o-start">Build my plan</button>
    `, (m, close) => {
      document.getElementById('modal-host').onclick = null; // not dismissible on first run
      G.wireGoalChips(m, goals);
      const readP = () => Object.assign({}, p, {
        sex:m.querySelector('#g-sex').value, age:+m.querySelector('#o-age').value || 25,
        heightIn:+m.querySelector('#o-h').value || 70, activity:m.querySelector('#g-act').value,
        split:m.querySelector('#g-split').value, daysPerWeek:+m.querySelector('#g-days').value || 0,
        dietPhase:m.querySelector('#g-phase').value, goalWeight:+m.querySelector('#o-gw').value || 0,
        targetDate:m.querySelector('#o-target').value, goals,
      });
      const w = () => +m.querySelector('#o-sw').value || 160;
      const draw = () => { m.querySelector('#o-plan').innerHTML = App.Goals.planSummary(App.Goals.plan(readP(), w())); };
      m.querySelectorAll('[data-goal], #g-sex, #o-age, #o-h, #o-sw, #o-gw, #g-act, #g-split, #g-days, #g-phase, #o-target').forEach(el => el.addEventListener('change', draw));
      draw();

      m.querySelector('#o-start').onclick = async () => {
        const weight = w();
        Store.setProfile({
          name: m.querySelector('#o-name').value.trim() || 'Athlete',
          goals, sex:m.querySelector('#g-sex').value, age:+m.querySelector('#o-age').value || 25,
          heightIn:+m.querySelector('#o-h').value || 70, activity:m.querySelector('#g-act').value,
          split:m.querySelector('#g-split').value, daysPerWeek:+m.querySelector('#g-days').value || 0,
          dietPhase:m.querySelector('#g-phase').value, goalWeight:+m.querySelector('#o-gw').value || 0,
          startWeight: weight, targetDate: m.querySelector('#o-target').value || '',
          startDate: Store.todayKey(), customMacros:false,
        });
        Store.logWeight(weight);
        App.Goals.recompute();
        Store.get().onboarded = true; Store.save();
        await App.Reminders.requestPermission();
        App.Reminders.start();
        close(); setProfileInitial(); Router.go('today');
        UI.toast('Plan ready', 'good');
        App.Profiles.flushInvite();
        if (goals.includes('marathon')) App.Running.setupSheet(() => Router.refresh());
      };
    });
  }

  function setProfileInitial() {
    const p = Store.profile();
    const el = document.getElementById('profile-initial');
    el.textContent = p.emoji || (p.name || '?').trim()[0].toUpperCase();
    const btn = document.getElementById('profile-btn');
    btn.style.borderColor = p.color || 'var(--line)';
  }

  // expose for other modules
  App.openSettings = settings;
  // Enter the app for the active profile (also hides the launch selector).
  App.enterApp = () => {
    const l = document.getElementById('launch'); if (l) l.classList.add('hidden');
    setProfileInitial();
    App.Reminders.start();
    Router.go('today');
    App.Profiles.flushInvite();   // prompt any pending friend invite now it's visible
  };
  App.afterProfileChange = () => App.enterApp();

  /* ---------- sign-in gate (cloud-first launch) ---------- */
  function authGate() {
    let host = document.getElementById('launch');
    if (!host) { host = document.createElement('div'); host.id = 'launch'; host.className = 'launch'; document.body.appendChild(host); }
    host.classList.remove('hidden');
    let mode = 'in', busy = false, done = false, fellBack = false, view = null;

    const finish = () => {
      if (done) return; done = true;
      if (Store.get().onboarded) App.enterApp();           // hides launch + flushes invites
      else { host.classList.add('hidden'); App.Reminders.start(); onboard(); }
    };
    const offline = () => { if (done) return; fellBack = true; App.Reminders.start(); App.Profiles.launchSelector(); };
    const wireOffline = () => { const o = host.querySelector('#au-offline'); if (o) o.onclick = offline; };

    const spinnerView = (label) => { host.innerHTML = `
      <div class="launch-inner" style="max-width:380px">
        <div class="launch-logo">M</div>
        <h1>Macro</h1>
        <p class="muted" style="margin:-14px 0 18px">${label}</p>
        <div class="spinner" style="margin:0 auto"></div>
        <button class="link" id="au-offline" style="margin-top:24px;color:var(--faint);font-size:12px">Use without an account</button>
      </div>`;
      wireOffline();
    };
    const form = () => {
      view = 'form';
      host.innerHTML = `
        <div class="launch-inner" style="max-width:380px">
          <div class="launch-logo">M</div>
          <h1 style="margin-bottom:8px">${mode === 'up' ? 'Create your account' : 'Welcome back'}</h1>
          <p class="muted" style="margin:0 0 20px">Pick any username (or use an email) and a password — it saves your training to the cloud and lets friends add you.</p>
          <input class="input" id="au-email" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="Username or email" style="text-align:left;margin-bottom:10px">
          <input class="input" id="au-pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" placeholder="Password (6+ characters)" style="text-align:left">
          <div id="au-err" style="color:var(--bad);font-size:13px;margin-top:10px;min-height:17px"></div>
          <button class="btn primary" id="au-go">${mode === 'up' ? 'Create account' : 'Sign in'}</button>
          <button class="btn ghost" id="au-toggle" style="margin-top:10px">${mode === 'up' ? 'I already have an account' : 'Create a new account'}</button>
          <button class="link" id="au-offline" style="margin-top:18px;color:var(--faint);font-size:12px">Use without an account</button>
        </div>`;
      const errEl = host.querySelector('#au-err');
      const go = async () => {
        const id = host.querySelector('#au-email').value.trim();
        const pw = host.querySelector('#au-pw').value;
        if (!id || !pw) { errEl.textContent = 'Enter a username and password'; return; }
        if (mode === 'up' && pw.length < 6) { errEl.textContent = 'Password needs at least 6 characters'; return; }
        busy = true; view = 'busy'; spinnerView(mode === 'up' ? 'Creating account…' : 'Signing in…');
        try {
          if (mode === 'up') await App.Cloud.signUp(id, pw, id.indexOf('@') === -1 ? id : '');
          else await App.Cloud.signIn(id, pw);
          // onAuthStateChanged → onSignedIn → 'synced' → update() → finish()
        } catch (e) { busy = false; form(); host.querySelector('#au-err').textContent = authMsg(e); }
      };
      host.querySelector('#au-go').onclick = go;
      host.querySelector('#au-pw').onkeydown = e => { if (e.key === 'Enter') go(); };
      host.querySelector('#au-toggle').onclick = () => { mode = mode === 'up' ? 'in' : 'up'; form(); };
      wireOffline();
    };

    const update = () => {
      if (done || fellBack || busy) return;
      const C = App.Cloud;
      if (C.currentUser()) { if (C.getStatus() === 'synced') return finish(); if (view !== 'sync') { view = 'sync'; spinnerView('Syncing your data…'); } return; }
      // No user yet. Only show the form once auth has actually resolved as
      // signed-out — avoids a form flash that then jumps to the app.
      if (C.available() && C.authReady()) { if (view !== 'form') form(); }
      else if (view !== 'connect') { view = 'connect'; spinnerView('Connecting…'); }
    };
    App.Cloud.onChange(update);
    update();
    // Never trap the user if the cloud SDK can't load (offline / blocked).
    setTimeout(() => { if (!done && !fellBack && !App.Cloud.authReady() && view !== 'form') { view = 'connect'; spinnerView('Connecting…'); } }, 6000);
  }

  /* ---------- boot ---------- */
  function boot() {
    setProfileInitial();
    document.querySelectorAll('.tab[data-route]').forEach(tab => {
      tab.onclick = () => {
        const r = tab.dataset.route;
        if (r === 'log') return App.Food.searchSheet(); // FAB → quick add food
        Router.go(r);
      };
    });
    document.getElementById('profile-btn').onclick = () => App.Profiles.switcher();

    Store.requestPersist();   // ask iOS/Safari to keep our data durable
    if (App.Strava) App.Strava.init();   // complete Strava OAuth redirect if returning
    if (App.Cloud) App.Cloud.init();     // cloud sync
    Router.go('today');

    // Capture any friend-invite link before showing a screen.
    App.Profiles.captureInvite();

    // Entry. Cloud-first: sign in right away (or create an account). Falls back
    // to the local "Who's training?" picker offline or if you opt out.
    if (App.Cloud && App.Cloud.configured()) {
      authGate();
    } else {
      const anyOnboarded = Store.allProfilesData().some(p => p.state.onboarded);
      if (!anyOnboarded) { App.Reminders.start(); onboard(); }
      else { App.Profiles.launchSelector(); }
    }

    // service worker (offline + installable)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // re-check reminders / refresh when app regains focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { App.Reminders.fire(); if (currentRoute === 'today') Router.refresh(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
