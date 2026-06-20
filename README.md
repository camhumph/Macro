# Macro — Your 8-Week Shred Coach 💥

A no-excuses iPhone app that runs in Safari (installable to your Home Screen — no App Store needed). Built for one mission: **build muscle, keep the abs, and summit a 15k climb in mid-August looking ripped.**

It's a fully offline Progressive Web App — all your data stays on your phone.

## What it does

| Feature | What you get |
|---|---|
| **🏋️ Daily workout generator** | Your 8-week Upper/Lower split, auto-built for today. Phase 1 (Wk 1–4, volume 8–10 reps) → Phase 2 (Wk 5–8, heavy 6–8 reps). Box jumps for punt power, abs every session, Saturday climb conditioning. |
| **✅ Checkable sets** | Log weight × reps per set, tap to check it off. It remembers and suggests progressive-overload targets next time. |
| **📈 Strength extrapolation** | Estimates your 1-rep max (Epley) from your best set and predicts what you can lift at any rep range — *and* on lifts you haven't maxed, using strength ratios. |
| **🍽️ Macro tracker (MyFitnessPal-style)** | Tracks calories + protein/carbs/fat toward your 3,200-cal lean-bulk target. Tells you **how much more to eat today** and warns you if you're falling behind. |
| **🔍 Food search & 📷 photo** | Built-in database including your staples — Chipotle double-steak bowls, Subway footlongs, the Mass Breakfast Shake, orange chicken, lo mein. Snap a photo or enter custom macros. |
| **⚖️ 8 PM weigh-in reminder** | Nags you to weigh in nightly. Adds a **recurring iPhone Calendar reminder** (.ics) so it actually fires. Charts your trend vs your goal line. |
| **⚙️ Auto-adjusting plan** | If the scale stalls below 1 lb/week, it automatically bumps your calorie target and tells you to eat more. Gaining too fast? It tells you to ease off to protect the abs. |
| **🗻 Climb countdown** | Days-to-climb front and center, with conditioning work to build the engine for 15k. |

## Install on your iPhone

1. Host the folder (see below) and open the URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Open **Macro** from your Home Screen — it runs full-screen like a native app, even offline.
4. On first launch, allow notifications and tap **📅 Add daily reminder to iPhone Calendar** on the Weigh-In tab for a reliable 8 PM nudge.

## Hosting (pick one)

It's all static files — no build step, no server code.

- **GitHub Pages:** push this repo, enable Pages on the branch → done. Free HTTPS.
- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop the folder.
- **Local test:** `python3 -m http.server 8080` then open `http://localhost:8080`.

> A secure context (HTTPS or `localhost`) is required for the installable PWA + service worker + camera.

## Tech

Vanilla HTML/CSS/JS, zero dependencies, zero build. Everything persists in `localStorage`. Files:

```
index.html        app shell + iPhone/PWA meta
styles.css        dark athletic design system
manifest.json     PWA manifest      sw.js  offline service worker
js/data.js        food DB, 8-week program, strength ratios
js/store.js       state + persistence + program timing
js/workout.js     workout generation + 1RM model + extrapolation
js/food.js        macro tracker, search, photo capture
js/weight.js      weigh-ins, trend chart, auto-adjustment
js/reminders.js   notifications + .ics calendar reminder
js/stats.js       strength estimates, predictor, program map
js/ui.js          shared UI helpers     js/app.js  router + dashboard
```

Now go eat. Let's get to work. 💪
