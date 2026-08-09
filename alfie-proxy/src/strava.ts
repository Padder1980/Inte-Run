/**
 * Strava, held server-side.
 *
 * ⚠️ WHY THIS IS NOT IN THE APP. Pushing a run to Strava needs the client SECRET to exchange an
 * authorisation code for tokens, and that secret authorises the app to act on a runner's Strava
 * account — it behaves like a password. InteRun is a public static page on GitHub Pages and a native
 * app whose strings anyone can read, so neither can hold it. It lives here and nowhere else.
 *
 * ⚠️ AND NEITHER SIDE OF THE APP EVER SEES A STRAVA TOKEN. The obvious design hands the access token
 * back to the page after the OAuth dance and lets the page upload directly. That puts a live
 * credential for somebody's Strava account into localStorage on a public origin, where every backup
 * export, every screenshot of the storage inspector and every future XSS carries it away. Instead the
 * page holds a DEVICE KEY it generated itself, the Worker maps that key to the tokens, and the tokens
 * never cross the wire to the client. A leaked device key is revocable and useless against Strava
 * directly; a leaked refresh token is neither.
 *
 * The device key is hashed before it is used as a KV key, so a dump of the store yields nothing that
 * can be replayed.
 */

/** The subset of Cloudflare's KV binding this file uses — declared locally so the Worker needs no
 *  extra type dependency (the repo's `npx tsc --noEmit` does not cover alfie-proxy/). */
type KVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type StravaEnv = {
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  STRAVA?: KVLike;
};

const AUTHORIZE = "https://www.strava.com/oauth/authorize";
const TOKEN = "https://www.strava.com/api/v3/oauth/token";
const DEAUTHORIZE = "https://www.strava.com/oauth/deauthorize";
const API = "https://www.strava.com/api/v3";

/**
 * ⚠️ activity:write AND NOTHING ELSE. It is the only scope that permits an upload or a manual
 * activity, and it is the whole job. Asking for `activity:read_all` as well — which every tutorial
 * does — would hand this Worker the runner's entire private training history, including their privacy
 * zones, to push one run. A consent screen listing what it does not need is how a runner learns to
 * stop reading them.
 */
const SCOPE = "activity:write";

type Stored = {
  access: string;
  refresh: string;
  /** Unix seconds, from Strava's own expires_at. */
  expiresAt: number;
  athleteId: number | null;
  athleteName: string;
  scope: string;
};

/** ⚠️ Never log or echo a device key. The hash is what the store is keyed on. */
async function keyHash(deviceKey: string): Promise<string> {
  const bytes = new TextEncoder().encode("interun-strava:" + deviceKey);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A device key is 32 bytes of base64url from the page. Reject anything else before it reaches KV. */
function validDeviceKey(dk: string | null): dk is string {
  return !!dk && /^[A-Za-z0-9_-]{32,86}$/.test(dk);
}

function randomToken(bytes = 16): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/**
 * The page the runner lands on when Strava sends them back. It is the only user interface this Worker
 * has, so it has to stand on its own: no external stylesheet, no font, and one instruction.
 */
function resultPage(title: string, detail: string, ok: boolean): Response {
  const body = '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(title) + ' · Inte-Run</title>' +
    '<style>:root{color-scheme:light dark}' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;' +
    'font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
    'background:#0c2b28;color:#f4faf8}' +
    '.c{max-width:22rem;text-align:center}' +
    '.m{width:56px;height:56px;border-radius:16px;margin:0 auto 20px;display:grid;place-items:center;' +
    'font-size:28px;background:' + (ok ? "#14463f" : "#3a1f1f") + '}' +
    'h1{font-size:1.35rem;margin:0 0 10px;letter-spacing:-0.01em}' +
    'p{margin:0;opacity:.8}</style>' +
    '<div class="c"><div class="m">' + (ok ? "✓" : "!") + '</div>' +
    '<h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(detail) + '</p></div>';
  return new Response(body, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function configured(env: StravaEnv): boolean {
  return !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET && env.STRAVA);
}

/**
 * Step one: send the runner to Strava.
 *
 * ⚠️ THE DEVICE KEY DOES NOT TRAVEL THROUGH STRAVA. `state` round-trips through Strava's servers and
 * lands in a redirect URL, browser history and any log in between, so it carries a single-use nonce
 * instead, valid for ten minutes, which this Worker maps back to the device key itself. That also
 * makes the callback CSRF-resistant: a code delivered without a nonce we issued is refused.
 */
async function start(url: URL, env: StravaEnv): Promise<Response> {
  if (!configured(env)) return resultPage("Not set up yet", "This Inte-Run server has no Strava credentials configured.", false);
  const dk = url.searchParams.get("dk");
  if (!validDeviceKey(dk)) return resultPage("Something went wrong", "That link is missing its device key. Start again from the app.", false);

  const nonce = randomToken();
  await env.STRAVA!.put("nonce:" + nonce, await keyHash(dk), { expirationTtl: 600 });

  // The callback must be on this Worker's own origin, which is also what the owner registers with
  // Strava as the Authorization Callback Domain — derived, so it can never drift out of step.
  const redirect = url.origin + "/strava/callback";
  const to = AUTHORIZE + "?client_id=" + encodeURIComponent(env.STRAVA_CLIENT_ID!) +
    "&redirect_uri=" + encodeURIComponent(redirect) +
    "&response_type=code&approval_prompt=auto&scope=" + encodeURIComponent(SCOPE) +
    "&state=" + encodeURIComponent(nonce);
  return new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store" } });
}

async function exchange(env: StravaEnv, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID!,
    client_secret: env.STRAVA_CLIENT_SECRET!,
    ...params,
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("token " + res.status);
  return res.json();
}

/**
 * Step two: Strava sends the runner back with a code.
 *
 * ⚠️ THE GRANTED SCOPE IS CHECKED, NOT ASSUMED. Strava's consent screen lets the runner untick the
 * permission and continue, which returns a perfectly valid token that cannot upload anything. Storing
 * it would report "Connected" and then fail on every run with an authorisation error, which reads as a
 * bug in the app rather than a decision they made thirty seconds earlier.
 */
async function callback(url: URL, env: StravaEnv): Promise<Response> {
  if (!configured(env)) return resultPage("Not set up yet", "This Inte-Run server has no Strava credentials configured.", false);

  if (url.searchParams.get("error")) {
    return resultPage("Not connected", "Strava was not given permission, so nothing has changed. You can try again from Inte-Run.", false);
  }
  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");
  if (!code || !nonce) return resultPage("Something went wrong", "Strava did not send back what we expected. Try again from Inte-Run.", false);

  const nonceKey = "nonce:" + nonce;
  const hash = await env.STRAVA!.get(nonceKey);
  if (!hash) return resultPage("That link has expired", "Connecting has to be finished within ten minutes. Start again from Inte-Run.", false);
  await env.STRAVA!.delete(nonceKey);  // single use

  let tok: any;
  try {
    tok = await exchange(env, { code, grant_type: "authorization_code" });
  } catch {
    return resultPage("Strava could not confirm it", "Strava refused the connection. Nothing has been saved. Try again from Inte-Run.", false);
  }

  const scope = String(url.searchParams.get("scope") || tok.scope || "");
  if (!/activity:write/.test(scope)) {
    return resultPage("Permission not given",
      "Inte-Run needs permission to upload activities, and that box was left unticked. Nothing has been saved — try again and leave it on.", false);
  }

  const athlete = tok.athlete || {};
  const record: Stored = {
    access: String(tok.access_token || ""),
    refresh: String(tok.refresh_token || ""),
    expiresAt: Number(tok.expires_at) || 0,
    athleteId: Number(athlete.id) || null,
    athleteName: String(athlete.firstname || "").trim(),
    scope,
  };
  if (!record.access || !record.refresh) {
    return resultPage("Strava could not confirm it", "The reply from Strava was incomplete. Nothing has been saved.", false);
  }
  await env.STRAVA!.put("tok:" + hash, JSON.stringify(record));

  return resultPage("Strava connected",
    "You can close this and go back to Inte-Run. Your runs can now be sent to Strava.", true);
}

/**
 * A usable access token, refreshed if it is close to expiry.
 * ⚠️ Strava access tokens last six hours, and the refresh token can be ROTATED on refresh — writing
 * the new one back is not optional. Keeping the old one works until the moment it doesn't, and then
 * the runner is silently disconnected with no way to tell why.
 */
async function accessToken(env: StravaEnv, hash: string): Promise<Stored | null> {
  const raw = await env.STRAVA!.get("tok:" + hash);
  if (!raw) return null;
  let rec: Stored;
  try { rec = JSON.parse(raw) as Stored; } catch { return null; }

  const now = Math.floor(Date.now() / 1000);
  if (rec.expiresAt - now > 300) return rec;

  let tok: any;
  try {
    tok = await exchange(env, { grant_type: "refresh_token", refresh_token: rec.refresh });
  } catch {
    return null;
  }
  if (!tok.access_token) return null;
  rec.access = String(tok.access_token);
  rec.refresh = String(tok.refresh_token || rec.refresh);
  rec.expiresAt = Number(tok.expires_at) || 0;
  await env.STRAVA!.put("tok:" + hash, JSON.stringify(rec));
  return rec;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Push one run.
 *
 * ⚠️ TWO SHAPES, DECIDED BY THE DATA — and the app has already decided which. A run with timed route
 * points arrives as GPX and becomes a real activity with a map, splits and pace. A run without one
 * arrives as `manual` and is created from its real totals. This Worker must never turn one into the
 * other: the rule the app enforces (see runStravaPayload in web/app.ts) is that a run's missing half
 * is never invented, and a server that quietly filled it in would break that where nobody could see.
 */
async function upload(request: Request, env: StravaEnv, headers: Record<string, string>): Promise<Response> {
  if (!configured(env)) return Response.json({ error: "not configured" }, { status: 503, headers });

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400, headers }); }

  const dk = String(body.dk || "");
  if (!validDeviceKey(dk)) return Response.json({ error: "no device key" }, { status: 400, headers });
  const hash = await keyHash(dk);
  const rec = await accessToken(env, hash);
  if (!rec) return Response.json({ error: "not connected" }, { status: 401, headers });

  const run = body.run || {};
  const name = String(run.name || "Run").slice(0, 120);
  const auth = { authorization: "Bearer " + rec.access };
  // Every activity says where it came from. Strava shows it on the activity, and it is how the owner
  // can tell an Inte-Run upload from one his watch sent independently.
  const description = "Recorded with Inte-Run.";

  if (run.kind === "gpx") {
    const gpx = String(run.gpx || "");
    if (gpx.length < 80) return Response.json({ error: "empty gpx" }, { status: 400, headers });
    if (gpx.length > 4_000_000) return Response.json({ error: "gpx too large" }, { status: 413, headers });

    const form = new FormData();
    form.append("file", new Blob([gpx], { type: "application/gpx+xml" }), "interun.gpx");
    form.append("data_type", "gpx");
    form.append("sport_type", "Run");
    form.append("name", name);
    form.append("description", description);
    // ⚠️ external_id is Strava's own dedupe handle. With the run's id on it, the same run sent twice
    // comes back as "duplicate of activity N" instead of appearing twice in somebody's training log.
    if (run.externalId) form.append("external_id", String(run.externalId).slice(0, 64));

    const res = await fetch(API + "/uploads", { method: "POST", headers: auth, body: form });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: stravaError(json, res.status) }, { status: 502, headers });

    const uploadId = String(json.id_str || json.id || "");
    const settled = await pollUpload(uploadId, auth);
    return Response.json({ ...settled, uploadId }, { headers });
  }

  // A manual activity. ⚠️ start_date_local is LOCAL time and Strava does not guess it, so the app
  // sends its own — a server has no way to know which timezone the runner ran in.
  const form = new URLSearchParams({
    name,
    sport_type: "Run",
    start_date_local: String(run.startLocal || new Date(Number(run.startMs) || Date.now()).toISOString().replace(/\.\d{3}Z$/, "Z")),
    elapsed_time: String(Math.max(1, Math.round(Number(run.elapsedSec) || 0))),
    description,
    trainer: run.trainer ? "1" : "0",
  });
  const dist = Math.round(Number(run.distanceM) || 0);
  if (dist > 0) form.append("distance", String(dist));

  const res = await fetch(API + "/activities", {
    method: "POST",
    headers: { ...auth, "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: stravaError(json, res.status) }, { status: 502, headers });
  return Response.json({ ok: true, activityId: json.id ? String(json.id) : null, manual: true }, { headers });
}

/**
 * An upload is asynchronous. Strava's own guidance is a one-second-or-longer poll and a mean
 * processing time under two seconds, so this waits a short while and then hands the job back to the
 * app rather than holding a request open — "Strava is still processing it" is a true answer, and a
 * Worker that blocks for a minute is not.
 */
async function pollUpload(uploadId: string, auth: Record<string, string>): Promise<any> {
  if (!uploadId) return { error: "Strava accepted the file but did not say where it went." };
  for (let i = 0; i < 7; i++) {
    await sleep(i === 0 ? 1200 : 1500);
    const res = await fetch(API + "/uploads/" + encodeURIComponent(uploadId), { headers: auth });
    const j: any = await res.json().catch(() => ({}));
    if (j && j.activity_id) return { ok: true, activityId: String(j.activity_id) };
    if (j && j.error) {
      // ⚠️ A DUPLICATE IS NOT A FAILURE. Strava reports "duplicate of activity 123" when the run is
      // already there — which is exactly what a retry, or a watch that already synced it, produces.
      // Reporting that as an error teaches the runner to tap again, which cannot ever help.
      const dup = /duplicate of activity (\d+)/i.exec(String(j.error));
      if (dup) return { ok: true, duplicate: true, activityId: dup[1] };
      return { error: String(j.error).replace(/<[^>]+>/g, "").slice(0, 200) };
    }
  }
  return { ok: true, pending: true };
}

function stravaError(json: any, status: number): string {
  if (status === 401) return "Strava no longer accepts this connection — reconnect in Inte-Run.";
  if (status === 429) return "Strava is rate-limiting uploads. Try again in a few minutes.";
  const msg = json && (json.message || json.error);
  return msg ? String(msg).slice(0, 200) : "Strava refused the upload (" + status + ").";
}

/** Where a finished upload got to, for the app to finish a job this Worker handed back as pending. */
async function uploadStatus(url: URL, env: StravaEnv, headers: Record<string, string>): Promise<Response> {
  if (!configured(env)) return Response.json({ error: "not configured" }, { status: 503, headers });
  const dk = url.searchParams.get("dk");
  const id = url.searchParams.get("id");
  if (!validDeviceKey(dk) || !id) return Response.json({ error: "bad request" }, { status: 400, headers });
  const rec = await accessToken(env, await keyHash(dk));
  if (!rec) return Response.json({ error: "not connected" }, { status: 401, headers });

  const res = await fetch(API + "/uploads/" + encodeURIComponent(id), { headers: { authorization: "Bearer " + rec.access } });
  const j: any = await res.json().catch(() => ({}));
  if (j && j.activity_id) return Response.json({ ok: true, activityId: String(j.activity_id) }, { headers });
  if (j && j.error) {
    const dup = /duplicate of activity (\d+)/i.exec(String(j.error));
    if (dup) return Response.json({ ok: true, duplicate: true, activityId: dup[1] }, { headers });
    return Response.json({ error: String(j.error).replace(/<[^>]+>/g, "").slice(0, 200) }, { headers });
  }
  return Response.json({ ok: true, pending: true }, { headers });
}

/** Is this device connected, and to whom? Never returns a token. */
async function status(url: URL, env: StravaEnv, headers: Record<string, string>): Promise<Response> {
  if (!configured(env)) return Response.json({ connected: false, configured: false }, { headers });
  const dk = url.searchParams.get("dk");
  if (!validDeviceKey(dk)) return Response.json({ connected: false, configured: true }, { headers });
  const raw = await env.STRAVA!.get("tok:" + (await keyHash(dk)));
  if (!raw) return Response.json({ connected: false, configured: true }, { headers });
  let rec: Stored;
  try { rec = JSON.parse(raw) as Stored; } catch { return Response.json({ connected: false, configured: true }, { headers }); }
  return Response.json({
    connected: true,
    configured: true,
    name: rec.athleteName,
    canWrite: /activity:write/.test(rec.scope || ""),
  }, { headers });
}

/**
 * Disconnect.
 * ⚠️ IT TELLS STRAVA, NOT JUST ITSELF. Deleting our copy would leave Inte-Run listed in the runner's
 * Strava settings as an app with write access forever — a disconnect that leaves the permission
 * standing is not a disconnect. The local record goes either way, so a failed deauthorise still
 * disconnects rather than trapping them in a half state.
 */
async function disconnect(request: Request, env: StravaEnv, headers: Record<string, string>): Promise<Response> {
  if (!configured(env)) return Response.json({ ok: true }, { headers });
  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const dk = String(body.dk || "");
  if (!validDeviceKey(dk)) return Response.json({ error: "no device key" }, { status: 400, headers });

  const hash = await keyHash(dk);
  const raw = await env.STRAVA!.get("tok:" + hash);
  await env.STRAVA!.delete("tok:" + hash);
  if (raw) {
    try {
      const rec = JSON.parse(raw) as Stored;
      await fetch(DEAUTHORIZE, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: rec.access }).toString(),
      });
    } catch { /* the local record is already gone, which is the part that matters */ }
  }
  return Response.json({ ok: true }, { headers });
}

/**
 * The Strava half of the Worker. Returns null for anything that is not a /strava/ path, so the
 * Alfie route keeps the root to itself and the app's existing proxy setting is untouched.
 */
export async function stravaRoute(
  request: Request,
  env: StravaEnv,
  headers: Record<string, string>,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.startsWith("/strava")) return null;

  // The two browser-facing routes are top-level navigations, not fetches — no CORS involved.
  if (path === "/strava/start" && request.method === "GET") return start(url, env);
  if (path === "/strava/callback" && request.method === "GET") return callback(url, env);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (path === "/strava/status" && request.method === "GET") return status(url, env, headers);
  if (path === "/strava/upload-status" && request.method === "GET") return uploadStatus(url, env, headers);
  if (path === "/strava/upload" && request.method === "POST") return upload(request, env, headers);
  if (path === "/strava/disconnect" && request.method === "POST") return disconnect(request, env, headers);
  return Response.json({ error: "no such route" }, { status: 404, headers });
}
