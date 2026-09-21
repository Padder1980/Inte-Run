/**
 * A8 — STRENGTH REACHES STRAVA AS "WEIGHT TRAINING".
 *
 * A finished strength session can now reach Strava, using the SAME device-key connection and the SAME
 * auto-send switch a run already uses (test/strava-connect.test.ts, test/strava-payload.test.ts cover
 * those) — but it must never be silently filed as a Run, which is what every deployed Worker before
 * this stage would have done with it, because "sport_type" was hardcoded to "Run" in both upload
 * shapes.
 *
 * ⚠️ THE HANDSHAKE IS THE WHOLE FEATURE. A client and a Worker are deployed independently (the app
 * ships over the air; the Worker is deployed by hand — see CLAUDE.md's Strava chapter), so a runner
 * can easily be running a NEW client against an OLD Worker. /strava/status now carries `sportTypes`,
 * naming what THIS Worker's code understands, and every path that could send a strength session reads
 * it before sending anything — failing closed (nothing sent) rather than open (sent as a Run) when the
 * field is missing or does not list "WeightTraining".
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { SPORT_TYPES, resolveSportType } from "../alfie-proxy/src/strava.ts";

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const WORKER = readFileSync(new URL("../alfie-proxy/src/strava.ts", import.meta.url), "utf8");

/**
 * ⚠️ ANCHORED TO THE START OF A LINE. The app markup contains accept="image/*" — an unbalanced
 * comment opener mid-line — so an unanchored sweep opens there and eats 10,382 characters of live
 * code. Every guard file in this repo that reads web/app.html carries this same anchored form.
 */
const nocomment = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");

/** One function of the built page, brace-matched. A character window is not a function. */
function fnOf(name: string): string {
  const at = APP.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return nocomment(APP.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}

/** The same, for the Worker's own TS source — "async function" or "function", brace-matched. */
function wfnOf(name: string): string {
  let at = WORKER.indexOf("async function " + name + "(");
  if (at < 0) at = WORKER.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in alfie-proxy/src/strava.ts");
  let d = 0;
  for (let i = WORKER.indexOf("{", at); i < WORKER.length; i++) {
    if (WORKER[i] === "{") d++;
    else if (WORKER[i] === "}") { d--; if (!d) return nocomment(WORKER.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}

// -------------------------------------------------------------------------------------------------
// 1. resolveSportType / SPORT_TYPES — driven directly, no KV, no network
// -------------------------------------------------------------------------------------------------

test("BLOCKER: resolveSportType defaults absent to Run and refuses anything unrecognised", () => {
  // ⚠️ ABSENT MEANS Run, AND THAT IS NOT A NEW BEHAVIOUR. Every run this Worker has ever uploaded left
  // this field unset, so this is what every existing caller already gets — nothing here can move a run.
  assert.equal(resolveSportType(undefined), "Run");
  assert.equal(resolveSportType(null), "Run");
  assert.equal(resolveSportType(""), "Run");
  assert.equal(resolveSportType("Run"), "Run");
  assert.equal(resolveSportType("WeightTraining"), "WeightTraining");
  assert.equal(resolveSportType("Ride"), null, "an unrecognised sport type was silently accepted");
  assert.equal(resolveSportType(0), null, "a non-string, non-empty value was silently accepted");
  // Strava's own enum is case-sensitive, and treating "run" as valid would let a client that got the
  // case wrong through, which is exactly the kind of drift the handshake exists to catch loudly.
  assert.equal(resolveSportType("run"), null, "case is not significant, and it must be");
});

test("SPORT_TYPES names exactly the two activity types this app can ever produce", () => {
  assert.deepEqual([...SPORT_TYPES].sort(), ["Run", "WeightTraining"]);
});

// -------------------------------------------------------------------------------------------------
// 2. upload() — refuses before building either shape, and neither hardcodes "Run" any more
// -------------------------------------------------------------------------------------------------

test("BLOCKER: neither upload shape hardcodes sport_type: \"Run\" any more", () => {
  const body = wfnOf("upload");
  assert.ok(!/form\.append\("sport_type", "Run"\)/.test(body), "the gpx branch still hardcodes Run");
  assert.ok(!/sport_type: "Run",/.test(body), "the manual branch still hardcodes Run");
  assert.match(body, /form\.append\("sport_type", sportType\)/, "the gpx branch does not use the resolved sport type");
  assert.match(body, /sport_type: sportType,/, "the manual branch does not use the resolved sport type");
});

test("BLOCKER: an unrecognised sport type is refused before either upload shape starts building a request", () => {
  const body = wfnOf("upload");
  const refuse = body.indexOf("if (!sportType)");
  const gpx = body.indexOf('run.kind === "gpx"');
  const formBuild = body.indexOf("new FormData()");
  assert.ok(refuse > 0, "upload() no longer refuses an unresolved sport type at all");
  assert.ok(refuse < gpx, "the refusal happens after the gpx branch has already been reached");
  assert.ok(refuse < formBuild, "the refusal happens after a request has already started being built");
});

test("BLOCKER: an unrecognised sport type is refused (400), driven directly against the real gate", () => {
  // The client-facing half of the same claim: resolveSportType is what upload()'s refusal is built on,
  // so this proves the gate itself rather than merely where it sits in the source.
  for (const bad of ["Ride", "Swim", "run", "WEIGHTTRAINING", 42, {}]) {
    assert.equal(resolveSportType(bad), null, JSON.stringify(bad) + " should have been refused and was not");
  }
});

test("a client-supplied description keeps the app's own attribution; a blank one falls back to it alone", () => {
  const body = wfnOf("upload");
  assert.match(body, /"Recorded with Inte-Run\."/, "the attribution line is gone entirely");
  assert.match(body, /extra \? extra \+ " Recorded with Inte-Run\." : "Recorded with Inte-Run\."/,
    "a supplied description line does not keep the app's own attribution alongside it");
});

// -------------------------------------------------------------------------------------------------
// 3. /strava/status — sportTypes rides on EVERY reply, connected or not
// -------------------------------------------------------------------------------------------------

test("BLOCKER: every /strava/status reply carries sportTypes, whatever the connection state", () => {
  // ⚠️ THIS IS THE HANDSHAKE THE WHOLE STAGE DEPENDS ON. sportTypes is a fact about the deployed
  // Worker's own code, not about any one runner's connection, so it must appear whether or not this
  // device is connected — an old, already-deployed Worker simply never sends the field at all.
  const body = wfnOf("status");
  const replies = (body.match(/Response\.json\(/g) || []).length;
  const withSportTypes = (body.match(/sportTypes: SPORT_TYPES/g) || []).length;
  assert.ok(replies >= 4, "expected at least four distinct replies from status() (not configured / bad key / not linked / bad record / connected)");
  assert.equal(withSportTypes, replies, "a /strava/status reply is missing sportTypes — a client asking that branch cannot learn what this Worker supports");
});

// -------------------------------------------------------------------------------------------------
// 4. Client: strengthStravaPayload — driven against the real functions, not a hand-modelled copy
// -------------------------------------------------------------------------------------------------

/**
 * strSessionVolumeKg and strengthStravaPayload, lifted and executed against the REAL A6 engine (a real
 * sumVolumeKg, not a stub — the "a probe that supplies its own dependency measures a strictly easier
 * program" trap this repo's own tests already name). slogAll is stubbed with an in-memory rows array,
 * the same shape slogForSession reads.
 */
function loadStravaPayload() {
  const body = [fnOf("strParseSet"), fnOf("slogForSession"), fnOf("strSessionVolumeKg"), fnOf("strengthStravaPayload")].join("\n");
  const store: { d: string; s: string; x: string; i: number; w?: string; r?: string }[] = [];
  const ctx = {
    slogAll: () => ({ rows: store, bests: {}, meta: {} }),
    RC: { sumVolumeKg: (sets: { w: number | null; r: number | null }[]) => {
      let v = 0;
      for (const s of sets) if (s.w != null && s.w > 0 && s.r != null && s.r > 0) v += s.w * s.r;
      return v;
    } },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "const slogAll = ctx.slogAll, RC = ctx.RC;" + body + "\nreturn strengthStravaPayload;");
  return { strengthStravaPayload: factory(ctx) as (row: Record<string, unknown>) => any, store };
}

test("BLOCKER: the payload is always manual, marked WeightTraining, indoor, with no distance", () => {
  // ⚠️ ALWAYS MANUAL, NEVER GPX -- a squat has no route, so there is nothing to draw and nothing to
  // fabricate one from. Same rule runStravaPayload states for a run with no trace.
  const { strengthStravaPayload } = loadStravaPayload();
  const row = { d: "2026-09-08", s: "s1", at: Date.parse("2026-09-08T18:00:00Z"), sets: 9, ex: 3, min: 45, t: "Push day" };
  const p = strengthStravaPayload(row);
  assert.equal(p.kind, "manual", "a strength session must never be sent as a GPX");
  assert.equal(p.sportType, "WeightTraining");
  assert.equal(p.trainer, true, "not marked as an indoor effort");
  assert.equal(p.distanceM, 0, "a distance was invented for a session that has none");
  assert.equal(p.name, "Push day");
});

test("the description names the duration, the exercise and set counts, and the kg lifted when there is any", () => {
  const { strengthStravaPayload, store } = loadStravaPayload();
  store.push({ d: "2026-09-08", s: "s1", x: "squat", i: 0, w: "60", r: "5" });   // 300 kg
  store.push({ d: "2026-09-08", s: "s1", x: "squat", i: 1, w: "60", r: "5" });   // 300 kg
  store.push({ d: "2026-09-01", s: "s0", x: "squat", i: 0, w: "999", r: "9" });  // a different session — must not leak in
  const row = { d: "2026-09-08", s: "s1", at: Date.now(), sets: 2, ex: 1, min: 30, t: "Legs" };
  const p = strengthStravaPayload(row);
  assert.match(p.description, /30 min/);
  assert.match(p.description, /1 exercise/);
  assert.match(p.description, /2 sets/);
  assert.match(p.description, /600 kg lifted/, "the volume did not sum both sets, or it leaked in from a different session");
});

test("a session with nothing weighed omits the kg line rather than claiming 0 kg lifted", () => {
  const { strengthStravaPayload } = loadStravaPayload(); // empty store — a bodyweight-only session
  const row = { d: "2026-09-08", s: "s1", at: Date.now(), sets: 4, ex: 2, min: 20, t: "Mobility" };
  const p = strengthStravaPayload(row);
  assert.doesNotMatch(p.description, /kg lifted/, "0 kg lifted was printed for a session with nothing to weigh");
});

test("a session with no recorded title falls back to a plain name, never a blank one", () => {
  const { strengthStravaPayload } = loadStravaPayload();
  const row = { d: "2026-09-08", s: "s1", at: Date.now(), sets: 1, ex: 1, min: 20 };
  const p = strengthStravaPayload(row);
  assert.equal(p.name, "Strength training");
});

test("elapsedSec and startMs are never built from a session that recorded zero minutes", () => {
  const { strengthStravaPayload } = loadStravaPayload();
  const at = Date.parse("2026-09-08T18:30:00Z");
  const row = { d: "2026-09-08", s: "s1", at, sets: 1, ex: 1, min: 0 };
  const p = strengthStravaPayload(row);
  assert.equal(p.elapsedSec, 60, "Strava's own elapsed_time floor is 1 second, and this sent 0");
  assert.equal(p.startMs, at - 60000, "the derived start did not use the same clamped minutes as elapsedSec");
});

test("the start is derived from when Finish was tapped, minus the session's own named length", () => {
  // ⚠️ startLocal MUST NOT BE CHECKED AGAINST A HARDCODED UTC DATE — this project's own repeated
  // lesson. Under TZ=Pacific/Kiritimati (UTC+14) an 18:30 UTC moment is already the next LOCAL day, so
  // a first version of this test asserting "2026-09-08T..." failed under that timezone while the code
  // was correct. What is actually promised is that startLocal is built from LOCAL getters on startMs —
  // so it is compared against exactly that computation, which holds under any timezone the suite runs
  // in, and separately checked to carry no Z or offset (the one thing that would make it NOT local).
  const { strengthStravaPayload } = loadStravaPayload();
  const at = Date.parse("2026-09-08T18:30:00Z");
  const row = { d: "2026-09-08", s: "s1", at, sets: 1, ex: 1, min: 45 };
  const p = strengthStravaPayload(row);
  assert.equal(p.startMs, at - 45 * 60000);
  const ld = new Date(p.startMs);
  const p2 = (n: number) => (n < 10 ? "0" + n : String(n));
  const expected = ld.getFullYear() + "-" + p2(ld.getMonth() + 1) + "-" + p2(ld.getDate()) +
    "T" + p2(ld.getHours()) + ":" + p2(ld.getMinutes()) + ":" + p2(ld.getSeconds());
  assert.equal(p.startLocal, expected, "startLocal is not built from local-time getters on startMs");
  assert.doesNotMatch(p.startLocal, /Z$|[+-]\d\d:\d\d$/, "startLocal carries a timezone marker, so Strava will not read it as local");
});

test("BLOCKER: the dedupe handle is stable across a retry, derived from the row's own (date, session) identity", () => {
  // Strava answers "duplicate of activity N" for a repeated external_id — the same id twice must be
  // the same string, or a retry after a lost reply appears twice in the runner's training log.
  const { strengthStravaPayload } = loadStravaPayload();
  const row = { d: "2026-09-08", s: "w3d2-strength", at: Date.now(), sets: 1, ex: 1, min: 20 };
  const p1 = strengthStravaPayload(row);
  const p2 = strengthStravaPayload(row);
  assert.equal(p1.externalId, p2.externalId);
  assert.equal(p1.externalId, "strength-2026-09-08-w3d2-strength");
});

// -------------------------------------------------------------------------------------------------
// 5. The handshake gate, driven — this is the "re-broken" guard PLAN.md's D bullet asks for
// -------------------------------------------------------------------------------------------------

function loadGate(cfg: Record<string, unknown>) {
  const src = [fnOf("stravaConnected"), fnOf("stravaCanWeightTraining")].join("\n");
  const ctx = { stravaCfg: () => cfg };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx", "const stravaCfg = ctx.stravaCfg;" + src + "\nreturn stravaCanWeightTraining;");
  return factory(ctx) as () => boolean;
}

test("BLOCKER: the handshake refuses to send when the server has never confirmed WeightTraining", () => {
  // An OLD, already-deployed Worker: connected, but its /strava/status reply has never carried
  // sportTypes at all (the field did not exist before this stage) — this is the deploy-skew case
  // PLAN.md's E bullet names, and the whole reason the gate exists.
  assert.equal(loadGate({ connected: true, key: "k" })(), false,
    "sent to a Worker that has never said it understands WeightTraining");
  // Connected and refreshed, but the reply's own list does not include WeightTraining (a rollback, or
  // a partial rollout of just the Run-only fix).
  assert.equal(loadGate({ connected: true, key: "k", sportTypes: ["Run"] })(), false,
    "sent to a Worker whose sportTypes list does not include WeightTraining");
  // Not connected at all — refused whatever sportTypes claims, because there is no token to upload with.
  assert.equal(loadGate({ connected: false, key: "k", sportTypes: ["Run", "WeightTraining"] })(), false,
    "sent while not connected to Strava at all");
  // The real, upgraded case — the one path that must actually work.
  assert.equal(loadGate({ connected: true, key: "k", sportTypes: ["Run", "WeightTraining"] })(), true,
    "refused to send even though the Worker has confirmed support");
});

test("stravaRefresh reads sportTypes straight off the server's own reply, and fails safe to an empty list", () => {
  const src = fnOf("stravaRefresh");
  assert.match(src,
    /c\.sportTypes = \(r\.json && Array\.isArray\(r\.json\.sportTypes\)\) \? r\.json\.sportTypes : \[\]/,
    "sportTypes is not read from the status reply, or a malformed one is not treated as empty");
});

// -------------------------------------------------------------------------------------------------
// 6. The auto-send hook — the same switch as a run, gated on the handshake, never resent
// -------------------------------------------------------------------------------------------------

test("BLOCKER: strengthMaybeAutoSend is gated on the shared switch AND the handshake, and never resends", () => {
  const src = fnOf("strengthMaybeAutoSend");
  assert.match(src, /if \(!row \|\| row\.strava\) return;/, "a session already tried can be sent again");
  assert.match(src, /if \(!stravaAutoSend\(\) \|\| !stravaCanWeightTraining\(\)\) return;/,
    "auto-send is not gated on both the shared switch and the handshake");
  assert.ok(src.indexOf("row.strava") < src.indexOf("stravaAutoSend()"),
    "the already-tried check does not run before the settings/handshake check");
});

test("strengthMaybeAutoSend uses the SAME setting as a run's own auto-send, not a second switch", () => {
  // ⚠️ CLAUDE.md already records this exact mistake once for Strava's own auto-send setting: a second
  // store for one preference is how the two come to disagree about what the runner actually chose.
  const src = fnOf("strengthMaybeAutoSend");
  assert.doesNotMatch(src, /interun_str.*auto|strengthAutoSend/i,
    "a strength-only auto-send setting was introduced instead of reusing stravaAutoSend()");
});

test("BLOCKER: strFinish offers the session to Strava after marking it done, and before the screen repaints", () => {
  const src = fnOf("strFinish");
  assert.match(src, /strengthMaybeAutoSend\(row\)/, "strFinish no longer offers the session to Strava at all");
  assert.match(src, /t: S\.sess\.title/, "the session's own title is not stamped onto the completion row");
  const sdone = src.indexOf("sdoneMark(");
  const auto = src.indexOf("strengthMaybeAutoSend(row)");
  const paint = src.indexOf("strPaintPlayer();");
  assert.ok(sdone > 0 && sdone < auto, "the session is offered to Strava before it has even been marked finished");
  assert.ok(auto > 0 && auto < paint, "the screen repaints before the sending state has been set, so it is never shown");
});

test("strengthSendSession never produces a pending state — a manual activity settles synchronously", () => {
  // Unlike a GPX upload (async, polled via stravaCheckPending), Strava's manual-activity endpoint
  // answers in the same request. A pending branch here would be dead code implying machinery that
  // does not exist for this shape.
  const src = fnOf("strengthSendSession");
  assert.doesNotMatch(src, /pending/i, "strengthSendSession has grown a pending state with nothing to poll it");
  assert.match(src, /strengthStravaPayload\(row\)/, "the session is not built through the one payload function");
  assert.match(src, /sdoneSave\(row\)/, "the send result is never persisted");
});

// -------------------------------------------------------------------------------------------------
// 7. The "Session done" screen — absent, not disabled, exactly like the run's own equivalent
// -------------------------------------------------------------------------------------------------

function loadDoneHtml() {
  const body = [fnOf("strengthStravaControlHtml"), fnOf("strPlayerDoneHtml")].join("\n");
  const ctx: { SPLAY: unknown; gate: boolean; esc: (x: unknown) => string; ICON: Record<string, string>;
    stravaCanWeightTraining?: () => boolean } = {
    SPLAY: null, gate: false,
    esc: (x: unknown) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    ICON: { share: "<svg/>" },
  };
  ctx.stravaCanWeightTraining = () => ctx.gate;
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "let SPLAY = ctx.SPLAY;" +
    "const esc = ctx.esc, ICON = ctx.ICON, stravaCanWeightTraining = ctx.stravaCanWeightTraining;" +
    body +
    "\nreturn (s) => { SPLAY = s; return strPlayerDoneHtml(); };");
  return { render: factory(ctx) as (s: Record<string, unknown>) => string, ctx };
}

test("BLOCKER: no Strava control at all while the handshake has not confirmed WeightTraining", () => {
  // ⚠️ ABSENT, NOT DISABLED — same rule stravaRunButtonHtml states for a run: a greyed-out button on
  // the one screen a runner is looking at right after finishing advertises a feature that is not there.
  const { render, ctx } = loadDoneHtml();
  ctx.gate = false;
  const out = render({ logged: 2, sdoneRow: { d: "2026-09-08", s: "s1" } });
  assert.doesNotMatch(out, /strStvSend|stv-done|On Strava/, "a Strava control appeared despite the gate refusing it");
});

test("once the gate is open: a fresh session offers Send to Strava, a sent one links to the real activity", () => {
  const { render, ctx } = loadDoneHtml();
  ctx.gate = true;
  const fresh = render({ logged: 2, sdoneRow: { d: "2026-09-08", s: "s1" } });
  assert.match(fresh, /id="strStvSend"[^d][^>]*>[^<]*Send to Strava/, "no live send button offered once the gate is open");

  const sent = render({ logged: 2, sdoneRow: { d: "2026-09-08", s: "s1", strava: { state: "done", id: "999" } } });
  assert.match(sent, /https:\/\/www\.strava\.com\/activities\/999/, "a completed send does not link to the real activity");
  assert.match(sent, /On Strava/);

  const sending = render({ logged: 2, sdoneRow: { d: "2026-09-08", s: "s1", strava: { state: "sending" } } });
  assert.match(sending, /id="strStvSend" disabled/, "a session mid-send is not shown as disabled");

  const err = render({ logged: 2, sdoneRow: { d: "2026-09-08", s: "s1", strava: { state: "error", msg: "No connection." } } });
  assert.match(err, /Try Strava again/, "an error state offers no way to retry");
  assert.match(err, /No connection\./, "the error message is dropped");
});

test("the manual send button is wired exactly like the run's own equivalent — never while disabled", () => {
  const src = fnOf("wireStrengthPlayerBody");
  assert.match(src, /if \(stvSend && !stvSend\.disabled\) stvSend\.onclick/,
    "the send button is wired even while it is disabled and mid-send");
  assert.match(src, /strengthSendSession\(S\.sdoneRow/, "the button does not send the session it was rendered for");
});
