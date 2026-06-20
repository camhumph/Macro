/* ============================================================
   Macro — app shell: router, dashboard, onboarding, settings
   ============================================================ */
window.App = window.App || {};

(function () {
  const Store = App.Store, UI = App.UI;

  const TITLES = {
    today: ['Today', "Let's get to work."],
    food:  ['Fuel', 'Eat like it\'s your job.'],
    weight:['Weigh-In', 'Track the trend.'],
    stats: ['Progress', 'Numbers don\'t lie.'],
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
    const phase = App.DATA.phaseForWeek(week);
    const climb = Store.daysUntilClimb();
    const t = Store.dayTotals();
    const remaining = Math.max(0, p.cal - t.cal);
    const gained = Store.latestWeight() - p.startWeight;

    const hour = new Date().getHours();
    const greet = hour < 11 ? 'Good morning' : hour < 17 ? 'Afternoon' : 'Evening';

    let dueBanner = '';
    if (App.Reminders.isDue()) {
      dueBanner = `<div class="banner warn"><span class="b-ico">⚖️</span><div><b>Weigh-in time</b>It's past ${App.Weight.fmtTime(p.weighInTime)} — step on the scale.</div>
        <button class="btn small primary" id="db-weigh" style="margin-left:auto">Log</button></div>`;
    }

    view.innerHTML = `
      ${dueBanner}
      <div class="hero">
        <div class="eyebrow">Week ${week} / 8 · Phase ${phase} ${phase===1?'· Volume':'· Heavy'}</div>
        <h1>${greet}.</h1>
        <p>${climb>0 ? `${climb} days until the 15k climb. ${gained>=0?'+':''}${UI.round(gained,1)} lb so far.` : 'Climb week — show up shredded.'}</p>
        <div class="countdown">
          <div class="cd-box"><b>${climb}</b><span>days to climb</span></div>
          <div class="cd-box"><b>${gained>=0?'+':''}${UI.round(gained,1)}</b><span>lb gained</span></div>
          <div class="cd-box"><b>${Store.latestWeight()}</b><span>current lb</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="spread" style="margin-bottom:12px">
          <b>Today's Fuel</b>
          <span class="pill ${remaining>0?'orange':'accent'}">${remaining>0?UI.round(remaining)+' cal to go':'target hit ✓'}</span>
        </div>
        <div class="macro-bars">
          ${UI.macroBar('Protein', t.protein, p.protein, 'var(--protein)')}
          ${UI.macroBar('Carbs', t.carbs, p.carbs, 'var(--carbs)')}
          ${UI.macroBar('Fat', t.fat, p.fat, 'var(--fat)')}
        </div>
        <button class="btn small ghost" id="db-food" style="width:100%;margin-top:14px">Open food log ▸</button>
      </div>

      <div class="section-title"><h2>Today's Session</h2><span class="link" id="db-stats">Stats ▸</span></div>
      <div id="db-workout"></div>
    `;

    App.Workout.render(view.querySelector('#db-workout'));

    const wb = view.querySelector('#db-weigh');
    if (wb) wb.onclick = () => Router.go('weight');
    view.querySelector('#db-food').onclick = () => Router.go('food');
    view.querySelector('#db-stats').onclick = () => Router.go('stats');
  }

  /* ---------- Settings sheet ---------- */
  function settings() {
    const p = Store.profile();
    UI.modal(`
      <h2>Profile & Goals</h2>
      ${UI.field('Name', `<input class="input" id="s-name" value="${UI.esc(p.name)}">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Start weight (lb)</label><input class="input" id="s-sw" type="number" value="${p.startWeight}"></div>
        <div class="field" style="margin:0"><label>Goal gain (lb)</label><input class="input" id="s-gg" type="number" value="${p.goalGain}"></div>
      </div>
      ${UI.field('Climb date', `<input class="input" id="s-climb" type="date" value="${p.climbDate}">`)}

      <div class="divider"></div>
      <b>Daily Macro Targets</b>
      <div class="inline-fields" style="margin:12px 0 14px">
        <div class="field" style="margin:0"><label>Calories</label><input class="input" id="s-cal" type="number" value="${p.cal}"></div>
        <div class="field" style="margin:0"><label>Protein g</label><input class="input" id="s-p" type="number" value="${p.protein}"></div>
      </div>
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Carbs g</label><input class="input" id="s-c" type="number" value="${p.carbs}"></div>
        <div class="field" style="margin:0"><label>Fat g</label><input class="input" id="s-f" type="number" value="${p.fat}"></div>
      </div>

      <div class="divider"></div>
      <div class="list-row">
        <div class="lr-l"><b>Weigh-in reminder</b><small>Get nagged daily</small></div>
        <div class="switch ${p.reminders?'on':''}" id="s-rem"></div>
      </div>
      ${UI.field('Reminder time', `<input class="input" id="s-time" type="time" value="${p.weighInTime}">`)}

      <div class="divider"></div>
      <b>Data & Backup</b>
      <p class="muted" style="margin:6px 0 12px;font-size:12.5px;line-height:1.5">On iPhone, the Home-Screen app and Safari keep <b>separate</b> data. Always use this installed app, and back up regularly so nothing is lost.</p>
      <div class="btn-row" style="margin-top:0">
        <button class="btn" id="s-export">⬆️ Export backup</button>
        <button class="btn" id="s-import">⬇️ Import / Restore</button>
      </div>

      <button class="btn primary" id="s-save" style="margin-top:18px">Save</button>
      <button class="btn ghost danger" id="s-reset" style="margin-top:10px">Reset all data</button>
      <p class="muted center" style="font-size:12px;margin-top:14px">Macro — your data lives only on this device.</p>
    `, (m, close) => {
      const rem = m.querySelector('#s-rem');
      rem.onclick = () => rem.classList.toggle('on');
      m.querySelector('#s-export').onclick = exportBackup;
      m.querySelector('#s-import').onclick = importBackup;
      m.querySelector('#s-save').onclick = async () => {
        const wantRem = rem.classList.contains('on');
        Store.setProfile({
          name: m.querySelector('#s-name').value.trim() || 'Athlete',
          startWeight: +m.querySelector('#s-sw').value || p.startWeight,
          goalGain: +m.querySelector('#s-gg').value || p.goalGain,
          climbDate: m.querySelector('#s-climb').value || p.climbDate,
          cal: +m.querySelector('#s-cal').value || p.cal,
          protein: +m.querySelector('#s-p').value || p.protein,
          carbs: +m.querySelector('#s-c').value || p.carbs,
          fat: +m.querySelector('#s-f').value || p.fat,
          weighInTime: m.querySelector('#s-time').value || p.weighInTime,
          reminders: wantRem,
        });
        if (wantRem) await App.Reminders.requestPermission();
        App.Reminders.start();
        close();
        setProfileInitial();
        Router.refresh();
        UI.toast('Saved ✅','good');
      };
      m.querySelector('#s-reset').onclick = () => {
        if (confirm('Erase all workouts, food and weight history? This cannot be undone.')) {
          Store.resetAll(); close(); location.reload();
        }
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
    UI.modal(`
      <h2>Welcome to Macro 💥</h2>
      <p class="muted" style="margin-top:-8px">Your no-excuses 8-week coach: build muscle, keep the abs, summit the climb. Let's set the basics.</p>
      ${UI.field('Your name', `<input class="input" id="o-name" placeholder="First name">`)}
      <div class="inline-fields" style="margin-bottom:14px">
        <div class="field" style="margin:0"><label>Current weight (lb)</label><input class="input" id="o-sw" type="number" value="150"></div>
        <div class="field" style="margin:0"><label>Goal gain (lb)</label><input class="input" id="o-gg" type="number" value="10"></div>
      </div>
      ${UI.field('Climb / event date', `<input class="input" id="o-climb" type="date" value="${p.climbDate}">`)}
      ${UI.field('Daily weigh-in reminder', `<input class="input" id="o-time" type="time" value="20:00">`)}
      <button class="btn primary" id="o-start">Start my 8 weeks</button>
      <p class="muted center" style="font-size:12px;margin-top:12px">Targets default to 3,200 cal · 180g protein — tweak anytime in Profile.</p>
    `, (m, close) => {
      // not dismissible by backdrop on first run
      document.getElementById('modal-host').onclick = null;
      m.querySelector('#o-start').onclick = async () => {
        Store.setProfile({
          name: m.querySelector('#o-name').value.trim() || 'Athlete',
          startWeight: +m.querySelector('#o-sw').value || 150,
          goalGain: +m.querySelector('#o-gg').value || 10,
          climbDate: m.querySelector('#o-climb').value || p.climbDate,
          weighInTime: m.querySelector('#o-time').value || '20:00',
          startDate: Store.todayKey(),
        });
        Store.get().onboarded = true; Store.save();
        // seed first weigh-in
        Store.logWeight(+m.querySelector('#o-sw').value || 150);
        await App.Reminders.requestPermission();
        App.Reminders.start();
        close();
        setProfileInitial();
        Router.go('today');
        UI.toast('Let\'s build. 💪','good');
      };
    });
  }

  function setProfileInitial() {
    const n = (Store.profile().name || '?').trim();
    document.getElementById('profile-initial').textContent = (n[0] || '?').toUpperCase();
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
    document.getElementById('profile-btn').onclick = settings;

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
