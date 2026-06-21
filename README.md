# Macro — Training & Nutrition

A clean, installable iPhone web app (PWA) for goal-based training and nutrition. Open it in Safari, **Add to Home Screen**, and it runs full-screen and offline — no App Store, no account. All data stays on your device.

## Choose your path

Pick one goal or combine several. Macro builds your nutrition and program around the mix:

| Path | Focus | Nutrition | Training |
|---|---|---|---|
| **Build Muscle** | Add lean size | Controlled surplus, high protein | Hypertrophy (8–15 reps) |
| **Get Stronger** | Maximize force | Around maintenance | Heavy compounds (4–6 reps) |
| **Conditioning** | Build your engine | Maintenance, carb-forward | Mixed cardio + circuits |
| **Lose Fat** | Get leaner | Moderate deficit, high protein | Hypertrophy + cardio |

From your goals + stats (sex, age, height, weight, activity) it computes your **maintenance (Mifflin–St Jeor TDEE)**, a **calorie target**, **macro split**, a **weight goal with a weekly rate**, and clear **eating guidance** — all editable.

## Features

- **Daily workout generator** — an Upper/Lower split with rep ranges and cardio volume set by your goals. Check off sets, log weight × reps, and fully customize: swap, add, or remove exercises from a 50+ movement library (changes persist).
- **Strength estimates & prediction** — estimates your 1RM from your best sets and predicts what you can lift on other exercises and rep ranges.
- **Nutrition tracking** — calories + protein/carbs/fat toward your target, with "how much is left today." Search a built-in food database, **scan a nutrition label** (on-device OCR), or **scan a barcode** (Open Food Facts lookup).
- **Pantry & portions** — save a scanned food, then log portions by weight or servings (¼ · ½ · ¾ · 1); the app tracks what's left in the package. Edit any logged entry anytime.
- **Weigh-ins** — daily reminder (with a Calendar backup), a trend chart against your goal line, and automatic calorie adjustment if your trend drifts off target.
- **Profiles, leaderboard & achievements** — separate profiles on the device, add friends by importing the profile they share, and compete on sessions, streaks, strength, volume, and % to goal. Levels and badges included.
- **Backup & restore** — export/import your data so it's never lost (important on iPhone, where the Home-Screen app and Safari keep separate storage).

## Install on iPhone

1. Host the folder (see below) and open the URL in **Safari**.
2. **Share → Add to Home Screen**.
3. Open **Macro** from your Home Screen. Set your goals on first launch.

## Hosting

All static files, no build step.

- **GitHub Pages:** Settings → Pages → deploy from this branch, root folder → `https://<user>.github.io/<repo>/`
- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop the folder
- **Local:** `python3 -m http.server 8080`

A secure context (HTTPS or `localhost`) is required for install, offline, camera, and the scanners.

## Tech

Vanilla HTML/CSS/JS, zero dependencies, zero build. State persists in `localStorage`.

```
index.html  styles.css  manifest.json  sw.js
js/data.js      food DB, exercise library, schedule + rep rules
js/store.js     multi-profile state + persistence
js/goals.js     goals + nutrition (TDEE, macros, weight goal)
js/workout.js   workout generation, logging, editing, 1RM model
js/food.js      nutrition tracking + entry editing
js/scan.js      label OCR + pantry/portions
js/barcode.js   barcode scan + Open Food Facts
js/weight.js    weigh-ins, trend chart, auto-adjust
js/leaderboard.js  levels, leaderboard, achievements
js/profiles.js  profile switching + sharing
js/reminders.js notifications + .ics
js/stats.js     strength, prediction, plan, compete
js/ui.js  js/app.js  shared UI + router/onboarding/settings
```
