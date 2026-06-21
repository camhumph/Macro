/* ============================================================
   Macro — Strava connection (OAuth + activity import)
   The client_secret never lives in the app. A tiny serverless
   function (you deploy) exchanges/refreshes tokens. See
   STRAVA-SETUP.md. Config + tokens are stored on this device only.
   ============================================================ */
window.App = window.App || {};

App.Strava = (function () {
  const Store = App.Store, UI = App.UI;
  const KEY = 'macro_strava';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function cfg() { return load(); }
  function configured() { const s = load(); return !!(s.clientId && s.endpoint); }
  function connected() { return !!load().refreshToken; }
  function redirectUri() { return location.origin + location.pathname; }
  function setConfig(clientId, endpoint) { const s = load(); s.clientId = (clientId || '').trim(); s.endpoint = (endpoint || '').trim(); save(s); }

  function connect() {
    const s = load();
    if (!s.clientId || !s.endpoint) { UI.toast('Add your Strava Client ID + endpoint first'); return; }
    const url = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(s.clientId)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri())}` +
      `&approval_prompt=auto&scope=activity:read_all&state=strava`;
    location.href = url;
  }

  async function post(payload) {
    const s = load();
    const r = await fetch(s.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return r.json();
  }
  async function exchange(code) {
    const s = load();
    const d = await post({ code });
    if (!d || !d.access_token) throw new Error(d && d.message ? d.message : 'token exchange failed');
    s.accessToken = d.access_token; s.refreshToken = d.refresh_token; s.expiresAt = d.expires_at;
    s.athlete = d.athlete ? `${d.athlete.firstname || ''} ${d.athlete.lastname || ''}`.trim() : '';
    save(s); return true;
  }
  async function ensure() {
    const s = load();
    if (!s.refreshToken) throw new Error('not connected');
    if (s.accessToken && s.expiresAt && s.expiresAt > Date.now() / 1000 + 120) return s.accessToken;
    const d = await post({ refresh_token: s.refreshToken });
    if (!d || !d.access_token) throw new Error('token refresh failed');
    s.accessToken = d.access_token; s.refreshToken = d.refresh_token || s.refreshToken; s.expiresAt = d.expires_at;
    save(s); return s.accessToken;
  }

  async function sync() {
    const token = await ensure();
    const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', { headers: { Authorization: 'Bearer ' + token } });
    const acts = await r.json();
    if (!Array.isArray(acts)) throw new Error(acts && acts.message ? acts.message : 'could not fetch activities');
    return importActs(acts);
  }

  function importActs(acts) {
    let n = 0;
    acts.filter(a => /run/i.test(a.type || a.sport_type || '')).forEach(a => {
      const dk = (a.start_date_local || a.start_date || '').slice(0, 10);
      if (!dk) return;
      const miles = (a.distance || 0) / 1609.34;
      const min = (a.moving_time || 0) / 60;
      Store.saveWorkout(dk, {
        dateKey: dk, isRun: true, done: true, source: 'strava', dayName: a.name || 'Run',
        run: { type: 'easy', miles: Math.round(miles * 10) / 10, paceSec: (min && miles) ? min * 60 / miles : 0, paceLabel: '' },
        actual: { miles: Math.round(miles * 100) / 100, min: Math.round(min) },
      });
      n++;
    });
    updateMileage();
    const s = load(); s.lastSync = Date.now(); save(s);
    return n;
  }

  function updateMileage() {
    const st = Store.get();
    const start = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return Store.todayKey(d); })();
    let total = 0, longest = 0;
    Object.values(st.workoutLogs).forEach(l => {
      if (l.isRun && l.actual && l.dateKey >= start) { total += l.actual.miles || 0; longest = Math.max(longest, l.actual.miles || 0); }
    });
    const r = Store.profile().running || {};
    Store.setProfile({ running: Object.assign({}, r, {
      weeklyMileage: Math.round(total / 4) || r.weeklyMileage,
      longestRun: Math.round(longest) || r.longestRun,
    }) });
  }

  function disconnect() {
    const s = load();
    localStorage.setItem(KEY, JSON.stringify({ clientId: s.clientId, endpoint: s.endpoint }));
  }

  // On load: complete the OAuth redirect if present.
  function init() {
    const params = new URLSearchParams(location.search);
    if (params.get('state') === 'strava' && params.get('code')) {
      const code = params.get('code');
      history.replaceState({}, '', redirectUri());
      exchange(code)
        .then(() => { UI.toast('Strava connected ✅', 'good'); if (App.Router) App.Router.refresh(); })
        .catch(e => UI.toast('Strava: ' + e.message));
    }
  }

  return { cfg, configured, connected, setConfig, connect, sync, disconnect, init, redirectUri };
})();
