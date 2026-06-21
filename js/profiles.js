/* ============================================================
   Macro — profiles: switch, create, edit, share app & profile
   ============================================================ */
window.App = window.App || {};

App.Profiles = (function () {
  const Store = App.Store, UI = App.UI, LB = App.Leaderboard;

  /* ---------- launch profile selector ("Who's training?") ---------- */
  function launchSelector() {
    const data = Store.allProfilesData();
    let host = document.getElementById('launch');
    if (!host) { host = document.createElement('div'); host.id = 'launch'; host.className = 'launch'; document.body.appendChild(host); }
    host.innerHTML = `
      <div class="launch-inner">
        <div class="launch-logo">M</div>
        <h1>Who's training?</h1>
        <div class="launch-grid">
          ${data.map(p => `<button class="launch-card" data-id="${p.id}">
            <div class="launch-av" style="background:${p.meta.color}">${p.meta.emoji}</div>
            <b>${UI.esc(p.meta.name)}</b><small>Level ${LB.levelOf(p.state).level}</small>
          </button>`).join('')}
          <button class="launch-card" id="launch-new"><div class="launch-av add">＋</div><b>New</b><small>profile</small></button>
        </div>
      </div>`;
    host.classList.remove('hidden');
    host.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { Store.switchProfile(b.dataset.id); App.enterApp(); });
    host.querySelector('#launch-new').onclick = () => newProfile();   // creates → afterProfileChange → enterApp
  }

  /* ---------- profile switcher ---------- */
  function switcher() {
    const data = Store.allProfilesData();
    const me = Store.activeId();
    UI.modal(`
      <h2>Profiles</h2>
      <div id="pf-list">
        ${data.map(p => {
          const lv = LB.levelOf(p.state), m = LB.metrics(p.state);
          return `
          <div class="search-result ${p.id === me ? 'me' : ''}" data-sw="${p.id}">
            <div class="lb-av" style="background:${p.meta.color}">${p.meta.emoji}</div>
            <div class="sr-main"><b>${UI.esc(p.meta.name)}${p.id === me ? ' <span class="muted" style="font-weight:500">· active</span>' : ''}</b><small>Lvl ${lv.level} · ${m.sessions} sessions · ${m.gymStreak}🔥</small></div>
            <button class="icon-btn" data-edit="${p.id}" style="width:32px;height:32px;color:var(--faint)">✎</button>
          </div>`;
        }).join('')}
      </div>
      <button class="btn" id="pf-new" style="margin-top:8px">＋ New profile</button>
      <div class="btn-row">
        <button class="btn ghost" id="pf-share">📤 Share Macro</button>
        <button class="btn ghost" id="pf-settings">⚙️ Goals & Backup</button>
      </div>
    `, (m, close) => {
      m.querySelectorAll('[data-sw]').forEach(el => el.onclick = (e) => {
        if (e.target.closest('[data-edit]')) return;
        Store.switchProfile(el.dataset.sw); close(); App.afterProfileChange();
      });
      m.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { close(); editProfile(b.dataset.edit); });
      m.querySelector('#pf-new').onclick = () => { close(); newProfile(); };
      m.querySelector('#pf-share').onclick = shareApp;
      m.querySelector('#pf-settings').onclick = () => { close(); App.openSettings(); };
    });
  }

  function avatarPicker(selEmoji, selColor) {
    return `
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Avatar</label>
      <div class="av-grid" id="av-emoji">${Store.AVATARS.map(e => `<button type="button" class="av-pick ${e === selEmoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="av-grid" id="av-color" style="margin-top:8px">${Store.COLORS.map(c => `<button type="button" class="av-col ${c === selColor ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
    `;
  }
  function wireAvatar(m, state) {
    m.querySelectorAll('#av-emoji .av-pick').forEach(b => b.onclick = () => { state.emoji = b.dataset.e; m.querySelectorAll('#av-emoji .av-pick').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelectorAll('#av-color .av-col').forEach(b => b.onclick = () => { state.color = b.dataset.c; m.querySelectorAll('#av-color .av-col').forEach(x => x.classList.toggle('on', x === b)); });
  }

  function newProfile() {
    const pick = { emoji: Store.AVATARS[0], color: Store.COLORS[2] };
    const goals = ['physique'];
    UI.modal(`
      <h2>New profile</h2>
      ${UI.field('Name', `<input class="input" id="np-name" placeholder="Name">`)}
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Goal paths</label>
      ${App.Goals.goalChips(goals)}
      <div class="inline-fields" style="margin:14px 0">
        <div class="field" style="margin:0"><label>Current weight (lb)</label><input class="input" id="np-w" type="number" inputmode="decimal" placeholder="lb"></div>
        <div class="field" style="margin:0"><label>Activity</label>${App.Goals.activitySelect('moderate')}</div>
      </div>
      ${avatarPicker(pick.emoji, pick.color)}
      <button class="btn primary" id="np-go" style="margin-top:16px">Create profile</button>
    `, (m, close) => {
      wireAvatar(m, pick);
      App.Goals.wireGoalChips(m, goals);
      m.querySelector('#np-go').onclick = () => {
        const name = m.querySelector('#np-name').value.trim();
        if (!name) return UI.toast('Name it first');
        Store.createProfile(name, pick.emoji, pick.color);
        const w = +m.querySelector('#np-w').value || 160;
        Store.setProfile({ startWeight: w, goals, activity: m.querySelector('#g-act').value });
        Store.logWeight(w);
        App.Goals.recompute();
        close(); App.afterProfileChange(); UI.toast('Profile created', 'good');
      };
    });
  }

  function editProfile(id) {
    const data = Store.allProfilesData().find(p => p.id === id);
    if (!data) return;
    const pick = { emoji: data.meta.emoji, color: data.meta.color };
    UI.modal(`
      <h2>Edit profile</h2>
      ${UI.field('Name', `<input class="input" id="ep-name" value="${UI.esc(data.meta.name)}">`)}
      ${avatarPicker(pick.emoji, pick.color)}
      <button class="btn primary" id="ep-save" style="margin-top:16px">Save</button>
      ${Store.profiles().length > 1 ? `<button class="btn ghost danger" id="ep-del" style="margin-top:10px">Delete profile</button>` : ''}
    `, (m, close) => {
      wireAvatar(m, pick);
      m.querySelector('#ep-save').onclick = () => {
        Store.updateProfileMeta(id, { name: m.querySelector('#ep-name').value.trim() || data.meta.name, emoji: pick.emoji, color: pick.color });
        close(); App.afterProfileChange(); UI.toast('Saved ✅', 'good');
      };
      const del = m.querySelector('#ep-del');
      if (del) del.onclick = () => {
        if (confirm(`Delete ${data.meta.name} and all their data? This cannot be undone.`)) {
          Store.deleteProfile(id); close(); App.afterProfileChange(); UI.toast('Profile deleted');
        }
      };
    });
  }

  /* ---------- sharing ---------- */
  function shareApp() {
    const url = location.href.split('#')[0];
    const payload = { title: 'Macro', text: 'Macro — workout, macro and weight tracking with a leaderboard. Open in Safari → Add to Home Screen:', url };
    if (navigator.share) navigator.share(payload).catch(() => {});
    else if (navigator.clipboard) { navigator.clipboard.writeText(url); UI.toast('Link copied — send it to a friend'); }
    else UI.toast(url);
  }

  function shareProfile() {
    const st = Store.get();
    const m = LB.metrics(st), lv = LB.levelOf(st);
    const json = JSON.stringify(st);
    const summary = `${st.profile.name} on Macro — Level ${lv.level}, ${m.sessions} sessions, ${m.gymStreak}-day streak, ${m.strength} lb total strength. Add me to compare.`;
    UI.modal(`
      <h2>Share your profile</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Send this to a friend — they tap <b>“+ Add friend”</b> and paste it to put you on their leaderboard.</p>
      <div class="card" style="line-height:1.5">${UI.esc(summary)}</div>
      <textarea class="input" id="sp-data" readonly style="height:100px;font-size:11px;font-family:monospace;margin-top:12px">${UI.esc(json)}</textarea>
      <div class="btn-row"><button class="btn primary" id="sp-copy">📋 Copy</button><button class="btn" id="sp-share">Share…</button></div>
    `, (mo) => {
      mo.querySelector('#sp-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(json); UI.toast('Copied ✅', 'good'); }
        catch (e) { const t = mo.querySelector('#sp-data'); t.focus(); t.select(); UI.toast('Select all & copy'); }
      };
      const sh = mo.querySelector('#sp-share');
      if (navigator.share) sh.onclick = () => navigator.share({ title: 'My Macro profile', text: summary + '\n\n' + json }).catch(() => {});
      else sh.style.display = 'none';
    });
  }

  function addFriend() {
    UI.modal(`
      <h2>Add a friend</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Paste the profile they shared (or pick a file). They'll appear on your leaderboard.</p>
      <input type="file" id="af-file" accept="application/json,.json,text/plain" class="input" style="padding:10px">
      <textarea class="input" id="af-data" placeholder="…or paste their profile text" style="height:100px;font-size:11px;font-family:monospace;margin-top:12px"></textarea>
      <button class="btn primary" id="af-go" style="margin-top:12px">Add to leaderboard</button>
    `, (m, close) => {
      const ta = m.querySelector('#af-data');
      m.querySelector('#af-file').onchange = (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => { ta.value = r.result; UI.toast('Loaded — tap Add'); }; r.readAsText(f);
      };
      m.querySelector('#af-go').onclick = () => {
        const raw = ta.value.trim(); if (!raw) return UI.toast('Paste a profile');
        let obj; try { obj = JSON.parse(raw); } catch (e) { return UI.toast('Invalid profile text'); }
        if (!obj.profile) return UI.toast('That isn\'t a Macro profile');
        Store.importAsNewProfile(obj);
        close(); App.Router.refresh(); UI.toast((obj.profile.name || 'Friend') + ' added 🏆', 'good');
      };
    });
  }

  return { launchSelector, switcher, newProfile, editProfile, shareApp, shareProfile, addFriend };
})();
