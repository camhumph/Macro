/* ============================================================
   Macro — Cloud sync (Firebase, optional)
   Saves your account to the cloud and lets you add friends by code.
   The Firebase SDK is loaded ONLY when you've pasted a config, so the
   app stays fully offline-first: with no config, this module is inert
   and everything works exactly as before, on-device.
   ============================================================ */
window.App = window.App || {};

App.Cloud = (function () {
  const Store = App.Store;
  const CFG_KEY = 'macro_cloud_cfg';
  const FRIENDS_KEY = 'macro_cloud_friends';     // codes I've added, for refresh
  const SDK = '11.6.1';
  const SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK + '/';
  // Baked-in Firebase project so every device/install is cloud-ready with no
  // setup. The web apiKey is a public client identifier (safe to ship); access
  // is governed by Firestore security rules + Auth, not by hiding this.
  const DEFAULT_CONFIG = {
    apiKey: "AIzaSyCTghYkpuPMFRAiJrS5DQ5Yep6yptHqnMg",
    authDomain: "macro-fabf9.firebaseapp.com",
    projectId: "macro-fabf9",
    storageBucket: "macro-fabf9.firebasestorage.app",
    messagingSenderId: "70174345853",
    appId: "1:70174345853:web:b7f746485683c4ddc27f14",
    measurementId: "G-FZFV6XDZ1P",
  };

  let auth = null, db = null;
  let user = null;            // { uid, email }
  let myCode = null;
  let ready = false;          // SDK loaded + Firebase initialized
  let status = 'idle';        // idle | syncing | synced | offline | error
  let pushTimer = null;
  const listeners = [];

  /* ---------- config (safe to keep client-side; it's not a secret) ---------- */
  function getConfig() { try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); if (c && c.apiKey) return c; } catch (e) {} return DEFAULT_CONFIG; }
  function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  function clearConfig() { localStorage.removeItem(CFG_KEY); }
  function configured() { const c = getConfig(); return !!(c && c.apiKey && c.projectId && c.appId); }

  function available() { return ready && !!auth; }
  function currentUser() { return user; }
  function code() { return myCode; }
  function getStatus() { return status; }
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) {} }); }
  function setStatus(s) { status = s; emit(); }

  /* ---------- parse a pasted Firebase config blob (JS object or JSON) ---------- */
  function parseConfig(raw) {
    raw = (raw || '').trim(); if (!raw) return null;
    // pull the { ... } out of a "const firebaseConfig = { ... };" snippet
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a !== -1 && b !== -1) raw = raw.slice(a, b + 1);
    try { return JSON.parse(raw); } catch (e) {}
    // tolerate JS object literal (unquoted keys, single quotes, trailing commas)
    try {
      const obj = (0, eval)('(' + raw + ')');
      return obj && typeof obj === 'object' ? obj : null;
    } catch (e) { return null; }
  }

  /* ---------- dynamic SDK loader (runs only once, only when configured) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  let sdkPromise = null;
  function loadSdk() {
    if (window.firebase && window.firebase.firestore) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = loadScript(SDK_BASE + 'firebase-app-compat.js')
      .then(() => loadScript(SDK_BASE + 'firebase-auth-compat.js'))
      .then(() => loadScript(SDK_BASE + 'firebase-firestore-compat.js'));
    return sdkPromise;
  }

  let started = false;
  async function init() {
    if (!configured() || started) return;   // inert until set up; bind once
    started = true;
    try {
      await loadSdk();
      const cfg = getConfig();
      const fb = window.firebase;
      if (fb.apps && fb.apps.length) fb.app(); else fb.initializeApp(cfg);
      auth = fb.auth();
      db = fb.firestore();
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
      ready = true;
      Store.onSave(schedulePush);       // push local changes (debounced)
      auth.onAuthStateChanged(async (u) => {
        if (u) { user = { uid: u.uid, email: u.email }; await onSignedIn(); }
        else { user = null; myCode = null; setStatus('idle'); }
        emit();
      });
      emit();
    } catch (e) { ready = false; started = false; setStatus('offline'); }
  }

  /* ---------- auth ---------- */
  async function signUp(email, pw, name) {
    if (!available()) throw new Error('Cloud sync isn\'t set up yet');
    const cred = await auth.createUserWithEmailAndPassword(email.trim(), pw);
    if (name) { try { await cred.user.updateProfile({ displayName: name }); } catch (e) {} Store.setProfile({ name }); }
  }
  async function signIn(email, pw) {
    if (!available()) throw new Error('Cloud sync isn\'t set up yet');
    await auth.signInWithEmailAndPassword(email.trim(), pw);
  }
  async function signOut() { if (auth) await auth.signOut(); }

  /* ---------- friend codes ---------- */
  function genCode() {
    const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  async function claimCode() {
    for (let i = 0; i < 5; i++) {
      const c = genCode();
      try { const snap = await db.collection('friends').doc(c).get(); if (!snap.exists) return c; }
      catch (e) { return c; }
    }
    return genCode();
  }
  function rememberedFriends() { try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]'); } catch (e) { return []; } }
  function rememberFriend(c) { const l = rememberedFriends(); if (!l.includes(c)) { l.push(c); localStorage.setItem(FRIENDS_KEY, JSON.stringify(l)); } }

  /* ---------- sync ---------- */
  async function onSignedIn() {
    setStatus('syncing');
    try {
      const ref = db.collection('users').doc(user.uid);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data();
        myCode = data.code || null;
        if (data.blob) { try { Store.cloudMerge(JSON.parse(data.blob)); } catch (e) {} }
      }
      if (!myCode) myCode = await claimCode();
      // Tag the active profile as the cloud account so we only ever sync it
      // (never a friend's imported profile if the user switches to it).
      Store.get()._cloudUid = user.uid; Store.save();
      await push(true);              // write the merged result back up
      await refreshFriends();
      setStatus('synced');
      if (App.Router) App.Router.refresh();
    } catch (e) { setStatus('offline'); }
  }

  function schedulePush() {
    if (!available() || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(true), 1500);
  }

  async function push() {
    if (!available() || !user) return;
    const st = Store.get(), p = st.profile;
    // Only sync the profile that owns this cloud account, never a friend's.
    if (st._cloudUid && st._cloudUid !== user.uid) return;
    setStatus('syncing');
    try {
      await db.collection('users').doc(user.uid).set({
        email: user.email, code: myCode,
        meta: { name: p.name, emoji: p.emoji, color: p.color },
        blob: JSON.stringify(st), updatedAt: Date.now(),
      }, { merge: true });
      // slim public payload for friend look-ups (no food diary)
      const payload = App.Profiles.friendPayload();
      await db.collection('friends').doc(myCode).set({
        owner: user.uid, code: myCode, name: p.name, emoji: p.emoji, color: p.color,
        blob: JSON.stringify(payload), updatedAt: Date.now(),
      });
      setStatus('synced');
    } catch (e) { setStatus('offline'); }
  }

  async function addByCode(input) {
    if (!available()) throw new Error('Sign in to add friends by code');
    const c = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!c) throw new Error('Enter a friend code');
    if (c === myCode) throw new Error('That\'s your own code');
    const snap = await db.collection('friends').doc(c).get();
    if (!snap.exists) throw new Error('No one found with code ' + c);
    const data = snap.data();
    const payload = data.blob ? JSON.parse(data.blob) : data.payload;
    if (!payload || !payload.profile) throw new Error('That profile looks empty');
    Store.upsertFriend(c, payload);
    rememberFriend(c);
    return payload.profile.name || 'Friend';
  }

  // Mutual add from a shared link: I add them now, and drop a request in their
  // inbox so they auto-add me on their next sync. Mutual leg is best-effort —
  // the one-way add always succeeds.
  async function acceptFriendCode(input) {
    const name = await addByCode(input);
    const c = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    try {
      if (myCode && c && c !== myCode) {
        await db.collection('requests').doc(c + '_' + myCode).set({ toCode: c, fromCode: myCode, ts: Date.now() });
      }
    } catch (e) {}
    return name;
  }

  // Auto-accept anyone who added me via a link (so friendships become mutual).
  async function processInbox() {
    if (!available() || !user || !myCode) return;
    try {
      const q = await db.collection('requests').where('toCode', '==', myCode).get();
      for (const doc of q.docs) {
        const from = doc.data().fromCode;
        try {
          const snap = await db.collection('friends').doc(from).get();
          if (snap.exists) {
            const d = snap.data(); const pl = d.blob ? JSON.parse(d.blob) : d.payload;
            if (pl && pl.profile) { Store.upsertFriend(from, pl); rememberFriend(from); }
          }
          await doc.ref.delete();
        } catch (e) {}
      }
    } catch (e) {}
  }

  async function refreshFriends() {
    if (!available()) return;
    await processInbox();                 // pick up anyone who added me via a link
    const codes = rememberedFriends();
    for (const c of codes) {
      try {
        const snap = await db.collection('friends').doc(c).get();
        if (snap.exists) { const d = snap.data(); const pl = d.blob ? JSON.parse(d.blob) : d.payload; if (pl && pl.profile) Store.upsertFriend(c, pl); }
      } catch (e) {}
    }
    if (App.Router) App.Router.refresh();
  }

  return {
    init, configured, available, currentUser, code, getStatus, onChange,
    getConfig, setConfig, clearConfig, parseConfig,
    signUp, signIn, signOut, addByCode, acceptFriendCode, refreshFriends, push,
  };
})();
