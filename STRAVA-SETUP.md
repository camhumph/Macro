# Connecting Macro to Strava

Strava's OAuth requires a **client secret** to exchange the login code for an
access token. That secret must never live inside the app (anyone could read
it), so Macro uses a tiny serverless function you deploy once. The app then
calls *your* endpoint, which holds the secret. Tokens are stored only on your
device.

## 1. Register a Strava API application
1. Go to https://www.strava.com/settings/api
2. Create an app. Set **Authorization Callback Domain** to the domain where
   Macro is hosted (e.g. `your-app.vercel.app` or `camhumph.github.io`).
3. Note your **Client ID** and **Client Secret**.

## 2. Deploy the token-exchange function
This repo includes `api/strava-token.js` (a Vercel/Netlify-style function).

**Vercel (easiest):**
1. Import this repo into Vercel (or `vercel deploy`).
2. Add environment variables: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`.
3. Your endpoint will be `https://<your-project>.vercel.app/api/strava-token`.

**Cloudflare Worker (alternative):** create a Worker with:
```js
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const b = await req.json().catch(() => ({}));
    const p = { client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET };
    if (b.code) { p.code = b.code; p.grant_type = 'authorization_code'; }
    else if (b.refresh_token) { p.refresh_token = b.refresh_token; p.grant_type = 'refresh_token'; }
    else return new Response(JSON.stringify({ message: 'missing code' }), { status: 400, headers: cors });
    const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    return new Response(await r.text(), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
```
Set `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` as Worker secrets.

## 3. Connect in Macro
1. Open Macro → profile (avatar) → **Goals & Profile** → **Strava**.
2. Enter your **Client ID** and the **endpoint URL** from step 2.
3. Tap **Connect Strava**, approve, and you're returned to the app.
4. Tap **Sync now** to import your recent runs — they fill your run history
   and update your weekly mileage / longest run for the marathon plan.

> Macro must be served over HTTPS for the OAuth redirect to work.
> Your tokens are kept only in this browser/device; they are not part of the
> profile backup/share.
