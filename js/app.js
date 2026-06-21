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
    const remaining = Math.max(0, p.cal - t.cal);
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
        <div class="lr-l"><b>Rest timer</b><small>Auto-start between sets</small></div>
        <div class="switch ${p.restTimerOn?'on':''}" id="s-rt"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Rest (seconds)</label><input class="input" id="s-rtsec" type="number" value="${p.restTimer||120}"></div>
        <div class="field" style="margin:0"><label>Water goal (cups)</label><input class="input" id="s-water" type="number" value="${p.waterGoal||8}"></div>
      </div>

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
      const rem = m.querySelector('#s-rem'); rem.onclick = () => rem.classList.toggle('on');
      const flex = m.querySelector('#s-flex'); flex.onclick = () => flex.classList.toggle('on');
      const rt = m.querySelector('#s-rt'); rt.onclick = () => rt.classList.toggle('on');
      const custom = m.querySelector('#s-custom');
      custom.onclick = () => { custom.classList.toggle('on'); m.querySelector('#s-macros').classList.toggle('hidden', !custom.classList.contains('on')); };

      // read current form into a temp profile for live plan preview
      const readStats = () => ({
        sex: m.querySelector('#g-sex').value, age:+m.querySelector('#s-age').value || p.age,
        heightIn:+m.querySelector('#s-h').value || p.heightIn, activity:m.querySelector('#g-act').value,
        split:m.querySelector('#g-split').value, daysPerWeek:+m.querySelector('#g-days').value || 0,
        targetDate:m.querySelector('#s-target').value, goals, startWeight:+m.querySelector('#s-sw').value || Store.latestWeight(),
      });
      const drawPlan = () => {
        const pl = App.Goals.plan(Object.assign({}, p, readStats()), +m.querySelector('#s-sw').value || Store.latestWeight());
        m.querySelector('#s-plan').innerHTML = App.Goals.planSummary(pl);
        m.querySelector('#s-guide').innerHTML = App.Goals.guideCard(pl);
      };
      m.querySelector('#s-recalc').onclick = drawPlan;
      m.querySelectorAll('[data-goal], #g-sex, #s-age, #s-h, #s-sw, #g-act, #g-split, #g-days, #s-target').forEach(el => el.addEventListener('change', drawPlan));
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
          scheduleMode: flex.classList.contains('on') ? 'flexible' : 'fixed',
          restTimerOn: rt.classList.contains('on'),
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

      ${UI.field('Name', `<input class="input" id="o-name" placeholder="First name" style="margin-top:14px">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Sex</label>${G.sexSelect('male')}</div>
        <div class="field" style="margin:0"><label>Age</label><input class="input" id="o-age" type="number" placeholder="25"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Height (in)</label><input class="input" id="o-h" type="number" placeholder="70"></div>
        <div class="field" style="margin:0"><label>Weight (lb)</label><input class="input" id="o-sw" type="number" placeholder="160"></div>
      </div>
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
        targetDate:m.querySelector('#o-target').value, goals,
      });
      const w = () => +m.querySelector('#o-sw').value || 160;
      const draw = () => { m.querySelector('#o-plan').innerHTML = App.Goals.planSummary(App.Goals.plan(readP(), w())); };
      m.querySelectorAll('[data-goal], #g-sex, #o-age, #o-h, #o-sw, #g-act, #g-split, #g-days, #o-target').forEach(el => el.addEventListener('change', draw));
      draw();

      m.querySelector('#o-start').onclick = async () => {
        const weight = w();
        Store.setProfile({
          name: m.querySelector('#o-name').value.trim() || 'Athlete',
          goals, sex:m.querySelector('#g-sex').value, age:+m.querySelector('#o-age').value || 25,
          heightIn:+m.querySelector('#o-h').value || 70, activity:m.querySelector('#g-act').value,
          split:m.querySelector('#g-split').value, daysPerWeek:+m.querySelector('#g-days').value || 0,
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
  App.afterProfileChange = () => {
    setProfileInitial();
    App.Reminders.start();
    Router.go('today');
  };

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
    Router.go('today');
    App.Reminders.start();

    if (!Store.get().onboarded) onboard();

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
