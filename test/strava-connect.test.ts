import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The Strava connection: who holds the secret, who holds the tokens, and what the app is allowed to
 * know. test/strava-payload.test.ts covers turning a run INTO something Strava accepts; this file
 * covers getting it there.
 *
 * ⚠️ THE RULE THIS FILE EXISTS TO ENFORCE: the page never holds a Strava credential. The client secret
 * authorises Inte-Run to act on a runner's account and the refresh token authorises it indefinitely —
 * and this page is public while the native app's strings are readable by anyone who installs it. Both
 * live on the Worker; the page holds only a device key it generated itself, which is revocable and
 * useless against Strava directly.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const worker = () => readFileSync(new URL("../alfie-proxy/src/strava.ts", import.meta.url), "utf8");

function fn(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  const end = html.indexOf("\nfunction ", at + 10);
  return html.slice(at, end > at ? end : at + 4000);
}

// ---- The page -------------------------------------------------------------------------------------

test("⚠️ a manual activity's start is LOCAL time, not UTC", () => {
  // ⚠️ Strava takes start_date_local at its word and no server can know which timezone somebody ran
  // in. Slicing toISOString() — the obvious way — is UTC, which moved every British summer run an
  // hour earlier in the runner's own log, and would be invisible for five months of the year.
  const src = fn("runStravaPayload");
  assert.match(src, /startLocal/, "the payload carries no local start at all");
  for (const getter of ["getFullYear", "getMonth", "getDate", "getHours", "getMinutes", "getSeconds"])
    assert.match(src, new RegExp("ld\\." + getter + "\\(\\)"), "startLocal is not built from local-time getters");
  const localLine = src.split("\n").filter((l) => /startLocal =/.test(l)).join(" ");
  assert.ok(!/toISOString/.test(localLine), "startLocal comes from toISOString, which is UTC");
  assert.ok(!/[+-]\d\d:\d\d|Z"/.test(localLine), "startLocal carries a timezone suffix, so it is not read as local");
});

test("⚠️ a run carries Strava's own dedupe handle", () => {
  // Without external_id the same run sent twice appears twice in somebody's training log. With it,
  // Strava answers "duplicate of activity N" and the app can treat that as already-done.
  const src = fn("runStravaPayload");
  assert.match(src, /externalId = String\(\(run && run\.id\) \|\| ""\)/, "external_id is not the run's own id");
  assert.equal((src.match(/externalId: externalId/g) || []).length, 2,
    "both the GPX and the manual shape must carry it — one of them does not");
});

test("⚠️ the device key is unguessable, and it is not a Strava token", () => {
  const src = fn("stravaDeviceKey");
  assert.match(src, /crypto\.getRandomValues/, "the device key is not from a cryptographic source");
  assert.ok(!/Math\.random/.test(src), "the device key uses Math.random, which is predictable");
  assert.match(src, /new Uint8Array\(32\)/, "the device key is shorter than 32 bytes");
  // ⚠️ THE PAGE MUST NEVER HANDLE A STRAVA TOKEN. If any of this appears here, the design has been
  // inverted back to the version where localStorage on a public origin holds a live credential.
  // ⚠️ Scoped to Strava on purpose: a blanket ban on the string "access_token" matched Mapbox's tile
  // URL parameter, which has nothing to do with any of this — and a guard that fires on unrelated code
  // is a guard somebody deletes.
  const html = page();
  for (const bad of ["refresh_token", "client_secret", "strava.com/oauth", "strava.com/api"])
    assert.ok(!html.includes(bad), "the page handles " + bad + " — that belongs on the server only");
  const stravaLines = html.split("\n").filter((l) => /strava/i.test(l));
  for (const l of stravaLines)
    assert.ok(!/access_token|accessToken/.test(l), "a Strava access token reaches the page: " + l.trim().slice(0, 120));
  // The only strava.com URL the page may build is a link to an activity the runner can open.
  const urls = (html.match(/https:\/\/(www\.)?strava\.com[^"'\s]*/g) || []);
  for (const u of urls)
    assert.match(u, /^https:\/\/www\.strava\.com\/activities\//, "the page reaches Strava directly at " + u);
});

test("⚠️ the device key never travels in a backup", () => {
  // The same rule as the Mapbox token, for a worse reason: whoever held an export containing this
  // could push runs into the runner's Strava account. Also asserted from the other side in
  // test/route-map-cache.test.ts, which owns the exclusion list itself.
  assert.match(page(), /BACKUP_NEVER = \[[^\]]*"interun_strava_v1"/,
    "interun_strava_v1 is swept into every export by the interun_ prefix");
});

test("⚠️ consent opens outside the app, and only over https", () => {
  // ⚠️ Strava's consent screen cannot be shown in our own web view: in the native app that is an
  // unbranded browser with no way back, and a login page inside somebody else's app is the shape of a
  // phishing screen. WebHost routes window.open(_blank) to Safari, so one call serves both.
  const src = fn("stravaConnect");
  assert.match(src, /window\.open\([\s\S]*?, "_blank"\)/, "consent does not open in the system browser");
  assert.ok(!/location\.href *=/.test(src), "consent navigates the app away from itself");
  // The device key rides on that URL, so the server it is sent to must not be plain http.
  assert.match(fn("wireStravaSheet"), /indexOf\("https:\/\/"\) !== 0/, "a http:// server address is accepted");
});

test("⚠️ the server's answer decides whether Strava is connected", () => {
  // A runner can revoke Inte-Run from Strava's own settings page and this page would never hear about
  // it. Trusting what we wrote down when they linked it leaves a button that cannot work.
  assert.match(fn("wireConnectView"), /stravaRefresh\(\)/, "the Connections screen never re-checks");
  assert.match(fn("stravaSendRun"), /r\.status === 401/, "a revoked connection is not noticed on upload");
  // Coming back into view is the ONLY signal that consent succeeded — nothing redirects into the app.
  assert.match(page(), /visibilitychange[^\n]*stravaResume\(\)/, "a pending link is never resolved");
});

test("⚠️ nothing is sent to Strava on its own, and nothing is offered that cannot work", () => {
  const src = fn("stravaRunButtonHtml");
  // ⚠️ ABSENT, NOT DISABLED. A greyed-out Strava button on every run advertises a feature the runner
  // has not set up, on the screen they came to read about their run.
  assert.match(src, /if \(!stravaConnected\(\)\) return "";/, "the button is shown when Strava is not connected");
  // ⚠️ NO AUTOMATIC UPLOAD. Pushing somebody's run into their public training log is theirs to ask
  // for. The only caller of stravaSendRun is a tap.
  const html = page();
  const callers = (html.match(/stravaSendRun\(/g) || []).length;
  assert.equal(callers, 2, "stravaSendRun has calls beyond its definition and the button's onclick");
  assert.match(html, /stvSend\.onclick = \(\) => stravaSendRun/, "the send button is not what triggers a send");
});

test("⚠️ a tester is never shown a box asking for a server address", () => {
  // The same gate as the Mapbox paste field. In the native app with nothing configured the row stays
  // an untappable "Planned", exactly as it read before any of this existed.
  assert.match(fn("stravaDevMode"), /!inNativeApp\(\) \|\| !!stravaBase\(\)/, "the setup field is not gated");
  assert.match(fn("connectView"), /\(stvSetUp \|\| stravaDevMode\(\)\) \? "strava" : null/,
    "the Strava row is tappable for someone who has no server to connect to");
});

// ---- The Worker -----------------------------------------------------------------------------------

test("⚠️ the Worker asks Strava for one permission, not for a training history", () => {
  const src = worker();
  assert.match(src, /const SCOPE = "activity:write"/, "the requested scope is not exactly activity:write");
  // ⚠️ activity:read_all would hand this Worker the runner's whole private history, including their
  // privacy zones, in order to push one run.
  for (const over of ["activity:read_all", "profile:write", "read_all"])
    assert.ok(!new RegExp('"' + over).test(src), "the Worker asks for " + over + ", which it does not need");
});

test("⚠️ the granted scope is checked, not assumed", () => {
  // Strava's consent screen lets the runner untick the permission and continue. That returns a valid
  // token which cannot upload anything — stored, it reports "Connected" and then fails on every run.
  const src = worker();
  const cb = src.slice(src.indexOf("async function callback("));
  const gate = cb.indexOf("activity:write");
  const store = cb.indexOf('put("tok:"');
  assert.ok(gate > 0 && store > gate, "the token is stored before the granted scope is checked");
});

test("⚠️ the device key is hashed before it is used as a store key", () => {
  const src = worker();
  assert.match(src, /crypto\.subtle\.digest\("SHA-256"/, "the device key is not hashed at all");
  // Every read and write of a token must go through the hash, so a dump of the store yields nothing
  // that can be replayed against this Worker.
  const raw = src.split("\n").filter((l) => /"tok:" \+/.test(l))
    .filter((l) => !/\bhash\b|keyHash\(/.test(l));
  assert.deepEqual(raw, [], "a token is filed under something other than the hash");
});

test("⚠️ the device key does not round-trip through Strava", () => {
  // state lands in a redirect URL, browser history and any log in between. It carries a single-use
  // nonce instead, which also makes the callback CSRF-resistant.
  const src = worker();
  const start = src.slice(src.indexOf("async function start("), src.indexOf("async function exchange("));
  assert.match(start, /"nonce:" \+ nonce/, "no nonce is stored for the callback to match");
  assert.match(start, /expirationTtl: 600/, "the nonce never expires");
  assert.match(start, /state=" \+ encodeURIComponent\(nonce\)/, "state carries something other than the nonce");
  assert.ok(!/state=" \+ encodeURIComponent\(dk\)/.test(start), "the device key itself is sent through Strava");
  assert.match(src, /delete\(nonceKey\)/, "the nonce is reusable");
});

test("⚠️ a duplicate is a success, not a failure", () => {
  // Strava answers "duplicate of activity 123" when the run is already there — which is exactly what
  // a retry produces. Reporting it as an error teaches the runner to tap again, which cannot help.
  const src = worker();
  assert.equal((src.match(/duplicate of activity \(\\d\+\)/g) || []).length, 2,
    "the duplicate reply is not recognised on both the poll and the later status check");
  assert.match(src, /ok: true, duplicate: true/, "a duplicate is not reported as a success");
});

test("⚠️ a rotated refresh token is written back", () => {
  // Strava may rotate the refresh token on refresh. Keeping the old one works until it doesn't, and
  // then the runner is silently disconnected with no way to tell why.
  const src = worker();
  const at = src.indexOf("async function accessToken(");
  const body = src.slice(at, src.indexOf("\nconst sleep", at));
  assert.match(body, /rec\.refresh = String\(tok\.refresh_token \|\| rec\.refresh\)/, "the new refresh token is dropped");
  assert.match(body, /put\("tok:" \+ hash, JSON\.stringify\(rec\)\)/, "the refreshed record is never saved");
});

test("⚠️ no route ever hands a Strava token to the client", () => {
  // The whole point of the device-key design. A token in a JSON reply is a token in localStorage.
  const src = worker();
  const replies = src.split("\n").filter((l) => /Response\.json\(/.test(l));
  for (const l of replies)
    assert.ok(!/rec\.|access|refresh/i.test(l), "a reply carries token material: " + l.trim());
  // And the only uses of the stored tokens are an auth header or Strava's own token endpoints.
  const uses = src.split("\n").filter((l) => /rec\.access|rec\.refresh/.test(l))
    .filter((l) => !/authorization|access_token|refresh_token|expiresAt/.test(l));
  assert.deepEqual(uses, [], "a stored token is used somewhere other than an auth header");
});

test("⚠️ disconnecting tells Strava, not just ourselves", () => {
  // Forgetting our own copy would leave Inte-Run standing in the runner's Strava settings with write
  // access to their account forever.
  const src = worker();
  const at = src.indexOf("async function disconnect(");
  const body = src.slice(at, src.indexOf("\nexport async function stravaRoute", at));
  assert.match(body, /fetch\(DEAUTHORIZE/, "the Strava-side authorisation is left standing");
  const del = body.indexOf('delete("tok:"');
  const deauth = body.indexOf("fetch(DEAUTHORIZE");
  assert.ok(del > 0 && del < deauth, "the local record survives a failed deauthorise, trapping a half state");
});

test("⚠️ Alfie keeps the root path", () => {
  // The app POSTs to the bare proxy URL it was given, so moving Alfie to a path would silently break
  // every install already configured. New jobs get a path; the original keeps the root.
  assert.match(worker(), /if \(!path\.startsWith\("\/strava"\)\) return null;/,
    "the Strava router does not hand non-Strava paths back");
  const w = readFileSync(new URL("../alfie-proxy/src/worker.ts", import.meta.url), "utf8");
  const strava = w.indexOf("await stravaRoute(");
  const alfie = w.indexOf('request.method !== "POST"');
  assert.ok(strava > 0 && alfie > strava, "Strava is routed after Alfie has already claimed the request");
});
