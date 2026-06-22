# Putting Macro online (accounts, cloud save, friend codes)

By default Macro is fully on-device. Turning on **cloud sync** lets you:

- **Sign in** with an email + password and have your account saved online.
- **Sync across devices** — open Macro on another phone/computer, sign in, and
  your training history is there.
- **Add friends by code** — every account gets a short code (e.g. `K7P2QX`).
  Share it and friends add you to their leaderboard. There's no public
  directory: only people who have your code can find you.

This uses **Firebase** on the **free Spark plan** — no credit card, and it never
sleeps (so the app is always reachable). The whole config is client-side and
safe to embed; security is enforced by the database rules below, not secrecy.

> If you skip this, nothing changes — Macro keeps working offline and you can
> still add friends with the share **link**.

---

## 1. Create a Firebase project (free)

1. Go to <https://console.firebase.google.com> and **Add project**.
2. Name it (e.g. `macro`). You can **disable Google Analytics** — not needed.

## 2. Turn on Email/Password sign-in

1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → enable **Email/Password** → **Save**.

## 3. Create the database

1. Left menu → **Build → Firestore Database → Create database**.
2. Choose a location, start in **Production mode** (we set rules next).
3. Open the **Rules** tab, replace everything with this, and **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Your own account: only you can read or write it.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Friend look-ups: anyone signed in can fetch a profile *by its exact
    // code*, but nobody can list/enumerate the collection (no directory).
    match /friends/{code} {
      allow get:   if request.auth != null;
      allow list:  if false;
      allow write: if request.auth != null
                   && request.resource.data.owner == request.auth.uid;
    }
  }
}
```

## 4. Register a Web App and copy the config

1. Project **Overview** (gear) → **Project settings**.
2. Under **Your apps**, click the **`</>`** (Web) icon, give it a nickname,
   **Register app** (you can skip Hosting).
3. You'll see a snippet like:

```js
const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "macro-xxxx.firebaseapp.com",
  projectId: "macro-xxxx",
  storageBucket: "macro-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

Copy that whole `{ … }` block.

## 5. Connect Macro

1. Open Macro → tap your avatar → **Goals & Profile** (or **Settings**).
2. Scroll to **Account & Cloud sync → Set up cloud sync**.
3. Paste the config block, tap **Save & connect**.
4. **Create account** with an email + password. Done — your data now syncs, and
   your **friend code** appears in the same panel.

### Add a friend
Get their 6-character code, then **Settings → Account → Add a friend by code**
(or the **＋ Add friend** button on the Compete tab). They appear on your
leaderboard, and refresh whenever you sync.

---

### Notes & limits
- The free tier is generous (tens of thousands of reads/writes per day) — far
  more than a personal app + a few friends will use.
- Friends see only your **training stats** (workouts, weight trend, level) —
  never your food diary, which stays private to your account.
- Your sign-in session is remembered on each device; offline edits sync up the
  next time you're online.
- Macro must be served over **HTTPS** for sign-in to work (Vercel, Netlify,
  GitHub Pages and Firebase Hosting all qualify).
