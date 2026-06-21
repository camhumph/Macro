// Serverless token exchange for Strava OAuth (Vercel / Netlify Node function).
// Keeps your client_secret server-side. Set env vars:
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
// Deploy this file, then put the resulting URL (e.g.
//   https://your-app.vercel.app/api/strava-token) into Macro's Strava settings.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ message: 'POST only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const params = {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
  };
  if (body.code) { params.code = body.code; params.grant_type = 'authorization_code'; }
  else if (body.refresh_token) { params.refresh_token = body.refresh_token; params.grant_type = 'refresh_token'; }
  else { res.status(400).json({ message: 'Provide code or refresh_token' }); return; }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ message: 'token exchange failed', error: String(e) });
  }
}
