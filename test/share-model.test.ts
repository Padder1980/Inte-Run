import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE SHARE CARD'S DATA LAYER — THE MODEL, THE VERDICT'S CONFIDENCE, ELIGIBILITY AND PRIVACY.
 *
 * ⚠️ NOTHING PINNED ANY OF THIS BEFORE. test/share-studio.test.ts asserts UI wiring — delegated
 * handlers, a display:none file input, aria-modal, 44px targets — and not one of its guards touches the
 * model, so every field mapping in it could drift silently inside a 22,000-line template literal with no
 * typechecking and no linting. That is the exact condition CLAUDE.md records as the reason eight silent
 * defects once sat behind 437 green tests.
 *
 * ⚠️ THE FIXTURES CARRY THE HARD SHAPES, NOT THE TIDY ONE. The commissioned pack's reference values are
 * a clean six-kilometre easy run with measured splits, a valid band and a place name — and this project
 * has twice certified a layout against a fixture no plan produces. The five shapes that break the naive
 * mapping are all here: a treadmill run (no distance, no route, no splits), a watch run (no cadence, no
 * route timestamps, no recoverable start time), an all-estimated run (the false-accusation case), a
 * part-estimated run (the case that still reaches a pace branch) and an interval run (no band at all).
 *
 * Every guard below was watched failing against a deliberate re-break before it was believed. The count
 * is in the phase report.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** Lift a function out of the built page, brace-matched. */
function lift(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
/**
 * Lift a top-level const, bracket-matched to its own semicolon.
 * ⚠️ lift() cannot reach a const, and several of the things this file has to execute are data rather
 * than code — the metric ladder, the template list, the redaction radius.
 */
function liftConst(name: string): string {
  const html = page();
  const at = html.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < html.length; i++) {
    const c = html[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return html.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}

const CONSTS = ["SHARE_MODEL_VERSION", "SHARE_TEMPLATES", "SHARE_TEMPLATE_LABEL",
  "RUN_METRIC_LADDER", "RD_MONTHS", "PRIV_RADIUS_M", "SHARE_PRIV_STORE", "SHARE_PRIV_MAX",
  "SHARE_EVEN_SPREAD_S", "SHARE_METRIC_MAX", "SHARE_CROP0", "SHARE_ASPECTS", "SHARE_EXPORT",
  // ⚠️ SHARE_NEEDS_PHOTO AND RUN_HARD_TYPES ARE BOTH GONE FROM THE APP, and this list failing loudly is
  // how that was noticed rather than left behind. The first was the reason three of the four templates
  // refused a run with no photograph, which ruling 7 removed; the second was a second list of hard
  // session types beside SESSION_EFFORT, which is the drift that put a rust ground under a tempo.
  "SESSION_EFFORT"];
const FNS = ["fmtPace", "rdCue", "rdWell", "runEvidenceConfidence", "runAnalysis", "runVerdict",
  "rdMetresBetween", "redactRouteEnds", "runRoutePresentation", "loadSharePriv", "saveSharePriv",
  "sharePrivacyFor", "sharePrivacyLocked", "setSharePrivacy", "runMetricLadder", "runStartMsKnown",
  "rdWhenText", "rdDateText", "shareTemplateStates", "shareTemplateFor", "shareEvidenceLine", "shareFileName",
  "shareProgressionClaim", "shareMetricPool", "shareMetricsChosen",
  "shareCropKey", "shareCropRead", "shareCropWrite", "sharePhotoView", "shareCropSig",
  "shareCardModel", "shareKey", "shareRouteOn", "shareCardOpts", "shareCardKey", "shareAspect",
  // ⚠️ THE ONE MAPPING FROM A RUN TO ITS EFFORT BAND, AND effortOf UNDER IT. The card's ground is the
  // session's own colour when there is no photograph, and it must be the SAME answer the Logbook row and
  // the debrief chip give — so the model reads runEffort rather than reconstructing the intensity here.
  "runEffort", "effortOf", "sessionEffort"];

/** A stand-in for the browser's localStorage: enough for the per-run privacy store to be exercised. */
function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    _map: m,
  };
}

type Env = {
  [k: string]: any;
  setPrivacy: (p: any) => void;
  setSharePrivStore: (s: any) => void;
  getSharePrivStore: () => any;
  setPhoto: (p: any) => void;
  setCard: (c: any) => void;
  store: ReturnType<typeof fakeStore>;
};

/** The real functions, running, with the app's globals declared inside the sandbox so they can be set. */
function env(): Env {
  const store = fakeStore();
  const body =
    CONSTS.map(liftConst).join("\n") + "\n" +
    'let PRIVACY = { ends: false, map: false };\n' +
    'let SHAREPRIV = {};\n' +
    'let SPHOTO = null;\n' +
    'let SCARD = { aspect: "story", template: null, routeOn: null, key: null, file: null, pending: 0, metrics: null };\n' +
    FNS.map(lift).join("\n") + "\n" +
    "return { " + FNS.join(", ") + ", RUN_METRIC_LADDER, SHARE_TEMPLATES, SHARE_MODEL_VERSION," +
    " SHARE_METRIC_MAX, SHARE_CROP0, SHARE_ASPECTS, SHARE_EXPORT," +
    " setPrivacy: (p) => { PRIVACY = p; }," +
    " setSharePrivStore: (s) => { SHAREPRIV = s; }, getSharePrivStore: () => SHAREPRIV," +
    " setPhoto: (p) => { SPHOTO = p; }, setCard: (c) => { SCARD = c; }, getCard: () => SCARD };";
  // ⚠️ THE REAL TABLE, LIFTED, NOT A COPY OF IT. A hand-written stand-in here said "Recovery jog" where
  // the app says "Recovery" and carried a race row the app does not have — so a guard on the card's own
  // activity line would have been checking this file against itself. The label the card prints has to
  // come from the build, like every other value in here.
  const SESSION_LABEL = new Function("return " + liftConst("SESSION_LABEL")
    .replace(/^const SESSION_LABEL = /, "").replace(/;$/, ""))() as Record<string, string>;
  const out = new Function("SESSION_LABEL", "maxHrEstimate", "esc", "state", "localStorage", body)(
    SESSION_LABEL, () => 190, (s: any) => String(s), { logged: [] }, store,
  ) as Env;
  out.store = store;
  return out;
}

// ---- fixtures ------------------------------------------------------------------------------------

const ROUTE = (() => {
  // A there-and-back along a river path, ~2.6 km of points, enough to survive 250 m end redaction.
  const pts: any[] = [];
  for (let i = 0; i < 60; i++) pts.push({ lat: 54.7768 + i * 0.0004, lng: -1.5757 + i * 0.00012, t: i * 30 });
  for (let i = 59; i >= 0; i--) pts.push({ lat: 54.7768 + i * 0.0004, lng: -1.5751 + i * 0.00012, t: 1800 + (59 - i) * 30 });
  return pts;
})();

/**
 * ⚠️ THE ID IS A CLOCK READING, NOT A LABEL, AND A FIXTURE THAT FORGETS THAT IS IMPOSSIBLE DATA.
 * liveRunRecord stamps id: "run-" + Date.now() and dateIso: todayIso() in one object literal, one line
 * apart, so a real run's id and its date always agree — and runStartMsKnown reads the time of day back
 * out of the id. A hand-picked id of run-1755500000000 beside dateIso 2026-08-18 says August 2025 and
 * August 2026 at once, which is a shape no builder can produce; three guards then read the 2025 out of
 * the id and reported it as a defect in the code. Derived from one stated instant instead.
 * ⚠️ NOON UTC, SO THE UTC DATE HOLDS IN EVERY TIMEZONE the suite might be run in — an 07:39 local start
 * is the previous UTC day east of +8, and the year of a card is not a thing that should depend on where
 * the machine is.
 */
const REF_END_MS = Date.UTC(2026, 7, 18, 12, 0, 4);   // the moment the finish screen stamped the id
const REF_SEC = 1864;
const REF_ID = "run-" + REF_END_MS;
const REF_D = (() => {
  const d = new Date(REF_END_MS - REF_SEC * 1000);    // when the runner set off, in local time
  return d.getDate() + " Aug · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
})();

/** The pack's own reference run: 5.51 km in 31:04 at 5:38/km, target 5:20–5:50/km. */
function refRun(over: any = {}): any {
  return {
    id: REF_ID, t: "40′ easy + strides", type: "easy",
    d: REF_D, dateIso: "2026-08-18",
    dist: "5.51 km", distKm: 5.51, time: "31:04", sec: REF_SEC, pace: "5:38 /km", avgPaceSec: 338,
    splits: [{ km: 1, sec: 351 }, { km: 2, sec: 337 }, { km: 3, sec: 336 }, { km: 4, sec: 333 }, { km: 5, sec: 334 }],
    pband: { minSecPerKm: 320, maxSecPerKm: 350 }, pwin: { s: 0, e: 5510 }, pmix: null,
    rband: { min: 2, max: 4 }, rpe: 3, anchor: 1500, pmodel: "3",
    elevGain: 11, avgHr: 148, maxHr: 163, cadence: 158, kcal: null,
    route: ROUTE, place: "Durham, County Durham, England",
    steps: [{ tag: "Work", lab: "40′ easy", tgt: "5:20–5:50/km", rec: "" }],
    ...over,
  };
}
/** Every split estimated: the pocketed-phone case, and the false accusation this phase exists to remove. */
const allEstRun = () => refRun({ id: "run-2", splits: refRun().splits.map((s: any) => ({ ...s, est: true })) });
/** Two of five estimated: still reaches a pace branch, so the badge is drawn with the qualification. */
const partEstRun = () => refRun({
  id: "run-3",
  splits: [{ km: 1, sec: 351, est: true }, { km: 2, sec: 337 }, { km: 3, sec: 336 },
           { km: 4, sec: 333 }, { km: 5, sec: 334, est: true }],
});
/** A treadmill run: a real clock, deliberately no distance, no route and no splits. */
const treadmillRun = () => ({
  id: "run-4", t: "Treadmill easy", type: "easy", d: "18 Aug · 06:02", dateIso: "2026-08-18",
  dist: "0.00 km", distKm: 0, time: "34:00", sec: 2040, pace: "— /km", avgPaceSec: 0,
  splits: [], route: [], indoor: true, elevGain: 0, avgHr: 141, maxHr: null, cadence: null, kcal: null,
  pband: null, pwin: null, pmix: null, rband: { min: 2, max: 4 }, rpe: 3, steps: [],
});
/** A wrist run: a UUID id (so no start time), no cadence, no route timestamps, calories instead. */
const watchRun = (over: any = {}) => refRun({
  id: "9E1C3A62-7B41-4E0A-9C77-1D2F0B8A5E33", cadence: null, kcal: 402,
  route: ROUTE.map((p) => ({ lat: p.lat, lng: p.lng })),
  ...over,
});
/**
 * A run that STARTED on one UTC day and FINISHED on the next: 23:20 to 00:20 UTC.
 * ⚠️ THE ONE SHAPE THAT SEPARATES THE RUN'S TWO POSSIBLE DATES. dateIso is todayIso() — UTC — read at the
 * same moment as the id, so it is the FINISH date; derive completedAt from the start instead and the card
 * says 18 August while its own filename says the 17th.
 */
const midnightRun = () => refRun({
  id: "run-" + Date.UTC(2026, 7, 18, 0, 20, 0), sec: 3600, time: "60:00", dateIso: "2026-08-18",
});
/** An interval session: paceStampFor deliberately gives it no band at all. */
const intervalRun = () => refRun({
  id: "run-6", t: "10 × 1′ hard / 1′ jog", type: "vo2",
  pband: null, pwin: null, pmix: "reps", rband: { min: 6, max: 8 }, rpe: 7,
  splits: [{ km: 1, sec: 420 }, { km: 2, sec: 400 }, { km: 3, sec: 410 }, { km: 4, sec: 405 }],
});

/**
 * ⚠️ THE FRAMING IS NO LONGER ON THE PHOTOGRAPH — IT IS A MAP KEYED BY (template, aspect). One shared
 * {ox, oy, k} silently reframed the runner's picture when they switched shape or style, so the geometry
 * moved into SPHOTO.crops and the model hands each card its own view of the same bitmap. A fixture
 * carrying ox/oy/k here would be a fixture no picker produces.
 */
const PHOTO = { id: "p1", bitmap: null, w: 1200, h: 1800, crops: {} as Record<string, any> };
const photo = (crops?: Record<string, any>) =>
  ({ id: "p1", bitmap: null, w: 1200, h: 1800, crops: crops || {} });

// ---- the verdict's confidence --------------------------------------------------------------------

test("BLOCKER: a run the app never measured is not accused of missing its target", () => {
  // ⚠️ THE DEFECT, MEASURED. Six kilometres run dead centre of the band with the phone in a pocket
  // produce est splits; judged() rightly refuses to score an estimate, so inBand came out 0 while n was
  // 6, pct computed as a confident 0%, and the ladder fell through to its last branch — "Off the brief
  // today", "Most kilometres were quicker than the target" — about a run in which NOT ONE kilometre had
  // been measured. The studio would have set that in capitals on a picture that leaves the phone.
  const E = env();
  const run = allEstRun();
  const a = E.runAnalysis(run);
  assert.equal(a.n, 5, "the estimated splits are being dropped rather than kept and marked");
  assert.equal(a.judgedN, 0, "an estimated split is being judged");
  assert.equal(a.estN, 5, "the estimated splits are not being counted");
  const v = E.runVerdict(run, a);
  assert.equal(v.state, "insufficientData", "a run with nothing measured still gets a pace verdict");
  assert.equal(v.confidence, "low");
  assert.ok(!/quicker than the target|slower than the target|Off the brief/i.test(
    v.headline + " " + v.body.join(" ") + " " + v.watch.join(" ")),
    "the run is still accused: " + v.headline + " | " + v.watch.join(" "));
  // And the chip that put it in the largest type on the panel is gone with it.
  assert.deepEqual(v.chips.filter((c: any) => c.k === "In range"), [],
    "'In range 0%' is still shown for a run with no measured kilometre");
});

test("BLOCKER: the same run measured is judged exactly as before", () => {
  // ⚠️ THE OTHER DIRECTION, AND IT IS WHAT MAKES THE FIX SAFE. Nothing about a run with judged
  // kilometres may move — the ladder's thresholds are untouched and the numerator was always judged-only.
  const E = env();
  const run = refRun();
  const a = E.runAnalysis(run);
  assert.equal(a.judgedN, 5);
  assert.equal(a.inBand, 4, "the reference run's fourth-of-five arithmetic changed");
  const v = E.runVerdict(run, a);
  assert.equal(v.state, "achieved");
  assert.equal(v.headline, "Steady and controlled");
  assert.equal(v.confidence, "high");
  assert.deepEqual(v.chips.filter((c: any) => c.k === "In range").map((c: any) => c.v), ["80%"]);
});

test("confidence is derived from the measurement, not from how the run went", () => {
  const E = env();
  const conf = (run: any) => E.runVerdict(run, E.runAnalysis(run)).confidence;
  assert.equal(conf(refRun()), "high", "a fully measured run is not high confidence");
  assert.equal(conf(allEstRun()), "low", "a wholly estimated run is not low confidence");
  assert.equal(conf(partEstRun()), "medium", "a part-estimated run is not hedged");
  assert.equal(conf(intervalRun()), "low", "a session with no band claims confidence");
  assert.equal(conf(treadmillRun()), "low", "a run with no splits claims confidence");
  // Fewer than three measured kilometres is an anecdote, not a pattern.
  assert.equal(conf(refRun({ splits: [{ km: 1, sec: 337 }, { km: 2, sec: 336 }] })), "medium");
  // More invented than measured: the verdict would be describing the estimate.
  assert.equal(conf(refRun({ splits: [{ km: 1, sec: 337 }, { km: 2, sec: 336, est: true }, { km: 3, sec: 334, est: true }] })), "low");
});

test("the receiver's own stamp can only ever demote high to medium", () => {
  // ⚠️ IT IS THE WEAKEST OF THE THREE SIGNALS AND MUST BEHAVE LIKE IT. Absent on every watch run, every
  // treadmill run and every run recorded before it existed — so it may hedge a confident card and must
  // never be able to suppress a verdict or to invent a reassurance.
  const E = env();
  const conf = (run: any) => E.runVerdict(run, E.runAnalysis(run)).confidence;
  assert.equal(conf(refRun({ gpsq: undefined })), "high", "an absent stamp is being read as a problem");
  // 5% of 5.51 km is 276 m: a real blackout, and enough to move a split boundary by a third of a km.
  assert.equal(conf(refRun({ gpsq: { pedoM: 400 } })), "medium", "step-counted ground is not hedging the claim");
  assert.equal(conf(refRun({ gpsq: { pedoM: 10 } })), "high", "a trivial pedometer credit is demoting a good run");
  assert.equal(conf(refRun({ gpsq: { reseeds: 9 } })), "medium", "an unsettled start is not hedging the claim");
  assert.equal(conf(refRun({ gpsq: { reseeds: 2 } })), "high", "an ordinary settle is demoting a good run");
  // It cannot reach "low" from any stamp value at all.
  for (const q of [{ pedoM: 99999 }, { reseeds: 999 }, { pedoM: 99999, reseeds: 999 }]) {
    assert.notEqual(conf(refRun({ gpsq: q })), "low", "the stamp can suppress a verdict: " + JSON.stringify(q));
  }
});

test("every branch of the verdict carries a confidence, so a new one cannot ship without it", () => {
  // ⚠️ A DERIVED GUARD, NOT A COUNT. The card gates its capitalised claim on this field, so a branch
  // added later without it would be read as confident by omission — which is the silent direction.
  const fn = lift("runVerdict");
  const returns = [...fn.matchAll(/return \{[^\n]*/g)].map((m) => m[0]);
  assert.ok(returns.length >= 9, "expected the verdict ladder's returns, found " + returns.length);
  const bare = returns.filter((r) => !/confidence:/.test(r));
  assert.deepEqual(bare, [], "these verdict branches return no confidence: " + bare.join(" || "));
});

test("the receiver's quality is actually recorded, or confidence could never see it", () => {
  // ⚠️ THE COMPUTED-AND-DISCARDED TRAP. LIVE.gpsDiag and LIVE.pedo are torn down with the session and
  // parked in a GLOBAL for the support screen, so nothing on a stored run could say how well it was
  // measured. A confidence term reading a field nothing writes is the fault this phase is fixing
  // elsewhere, repeated.
  const rec = lift("liveRunRecord");
  assert.match(rec, /gpsq: liveGpsQuality\(\)/, "the run record carries no measurement-quality stamp");
  const q = lift("liveGpsQuality");
  assert.match(q, /p\.credited/, "pedometer-credited ground is not recorded");
  assert.match(q, /d\.reseeds/, "anchor re-seeds are not recorded");
  assert.match(q, /Object\.keys\(q\)\.length \? q : undefined/,
    "an empty stamp is stored rather than left absent, so unknown would read as good");
  assert.match(lift("runEvidenceConfidence"), /run\.gpsq/, "confidence never reads the stamp");
});

// ---- discomfort ----------------------------------------------------------------------------------

test("BLOCKER: something writes run.pain, and the safety rule it guards is kept", () => {
  // ⚠️ IT WAS READ IN THREE PLACES AND WRITTEN IN NONE, so runVerdict's highest-precedence branch was
  // unreachable and the card's only rule for keeping a private disclosure off a shared picture guarded a
  // field nothing set. Deleting the reads would have deleted the rule; the answer is a writer.
  const html = page();
  const writers = [...html.matchAll(/\.pain = /g)].map((m) => m[0]);
  assert.ok(writers.length >= 2, "nothing assigns run.pain — the safety branch is unreachable again");
  // Asked in the one block that already asks the runner about this run, and reachable from both screens.
  assert.match(lift("rpeAskHtml"), /painAskHtml\(sm\)/, "the discomfort question is not asked");
  assert.match(lift("viewRunDetail"), /rpeAskHtml\(run\)/, "it cannot be answered from the Logbook");
  assert.match(lift("viewLiveComplete"), /rpeAskHtml\(sm\)/, "it cannot be answered on the finish screen");
  // It survives the finish screen's save, the same way rpe and note do.
  assert.match(lift("liveRunRecord"), /pain: typeof sm\.pain === "boolean" \? sm\.pain : undefined/,
    "an answer given before Save is thrown away, or a non-answer is stored as false");
});

test("the discomfort question has three states, so silence is never read as 'no'", () => {
  // ⚠️ THE weeklyVolumeKm LESSON. A pre-selected "No" is an answer nobody gave, on every run in the
  // store — and every run recorded before today is correctly absent rather than silently fine.
  const build = new Function("return " + lift("painAskHtml"))() as (sm: any) => string;
  const on = (h: string) => [...h.matchAll(/data-pain="(\d)"[^>]*class="on"/g)].map((m) => m[1]);
  assert.deepEqual(on(build({})), [], "an unanswered run pre-selects an answer");
  assert.deepEqual(on(build({ pain: false })), ["0"], "answering 'no' is not remembered");
  assert.deepEqual(on(build({ pain: true })), ["1"], "answering 'yes' is not remembered");
  assert.ok(!/Noted/.test(build({ pain: false })), "the acknowledgement shows for a 'no'");
  assert.match(build({ pain: true }), /stays off anything you share/,
    "a runner who discloses is not told the card will withhold it");
});

test("BLOCKER: a run with disclosed discomfort publishes no verdict", () => {
  const E = env();
  E.setPhoto(PHOTO);
  const run = refRun({ pain: true });
  const m = E.shareCardModel(run, { photo: PHOTO });
  assert.equal(m.pill, null, "the card prints a verdict for a run somebody disclosed discomfort on");
  // The verdict itself still exists — the debrief needs it; it is the CARD that withholds it.
  const v = E.runVerdict(run, E.runAnalysis(run));
  assert.equal(v.state, "caution");
  assert.equal(v.headline, "Let’s look after that".replace("’", "'"));
});

test("the private answers never reach the card", () => {
  // ⚠️ THE EFFORT RATING IS IN THE SAME CLASS AS THE DISCOMFORT ANSWER AND THE RUNNER'S WHY: something
  // they told the app about themselves. It is the last rung of the shared metric ladder, so the card's
  // "take the next available metric" rule would have published it the day a run had no elevation, heart
  // rate, cadence or calories.
  const E = env();
  const bare = { rpe: 7 };
  assert.deepEqual(E.runMetricLadder(bare, true), [], "RPE reaches the share ladder");
  assert.deepEqual(E.runMetricLadder(bare, false).map((m: any) => m.key), ["rpe"],
    "RPE has been dropped from the debrief as well");
  const m = E.shareCardModel(refRun({ elevGain: 0, avgHr: null, maxHr: null, cadence: null, kcal: null, rpe: 9 }),
    { photo: PHOTO });
  assert.ok(!/RPE|\b9\b/.test(JSON.stringify(m.metrics)), "the effort rating is on the card: " + JSON.stringify(m.metrics));
});

// ---- the canonical model -------------------------------------------------------------------------

test("the model carries the contract's fields, mapped off the real record", () => {
  const E = env();
  const m = E.shareCardModel(refRun(), { photo: PHOTO, aspect: "story" });
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.activityId, REF_ID);
  assert.equal(m.sessionType, "easy");
  assert.equal(m.sessionLabel, "Easy run", "the card's activity line is the plan's title, not the kind");
  assert.equal(m.sessionTitle, "40′ easy + strides");
  assert.match(m.completedAt, /^2026-08-18T/, "a phone run's own instant is not recovered");
  // ⚠️ AND ITS DATE IS THE RUN'S OWN DATE, WHICHEVER SIDE OF MIDNIGHT UTC THE RUNNER SET OFF. dateIso is
  // read from the same clock as the id, so the two cannot disagree unless this field is derived from the
  // START — and shareFileName cuts its date out of here, so that disagreement is a card printing one day
  // and its file naming another. midnightRun is the only fixture where the two differ.
  for (const r of [refRun(), midnightRun(), watchRun()]) {
    const cm = E.shareCardModel(r, {});
    assert.equal(String(cm.completedAt).slice(0, 10), r.dateIso,
      "completedAt names a different day from the record: " + cm.completedAt + " vs " + r.dateIso);
  }
  assert.equal(m.coarseLocation, "Durham", "the whole geocoded string is being published");
  assert.equal(m.units, "metric");
  assert.equal(m.distance, 5.51);
  assert.equal(m.durationSeconds, 1864);
  assert.equal(m.averagePace, 338);
  assert.equal(m.elevationGain, 11);
  assert.equal(m.averageHeartRate, 148);
  assert.equal(m.cadence, 158);
  assert.equal(m.calories, undefined, "a phone run reports calories it never measured");
  assert.equal(m.splits.length, 5);
  assert.equal(m.verifiedMilestone, undefined, "a milestone is claimed with no source to verify it");
  // ⚠️ THE TWO BAND SHAPES ARE NAMED APART. pband is {minSecPerKm,maxSecPerKm} and rband is {min,max};
  // unifying them is how "NaN:NaN–NaN:NaN /km" once shipped to a runner's screen.
  assert.deepEqual(m.target, {
    paceMinSecPerKm: 320, paceMaxSecPerKm: 350, windowStartM: 0, windowEndM: 5510,
    mix: undefined, rpeMin: 2, rpeMax: 4,
  });
  assert.equal(m.verdict.status, "achieved");
  assert.equal(m.verdict.confidence, "high");
  assert.equal(m.verdict.shortTitle, "STEADY AND CONTROLLED");
  assert.equal(m.verdict.evidenceLine, "4 of 5 km inside 5:20–5:50/km");
});

test("a missing value is absent from the model, never zero", () => {
  // ⚠️ "Never display missing data as zero" starts in the model. elevGain is stored as 0 by both
  // builders and avgPaceSec is 0 rather than null when the distance is unknown, so the two fields that
  // most need a gate are the two that look like measurements.
  const E = env();
  const m = E.shareCardModel(treadmillRun(), {});
  for (const k of ["distance", "averagePace", "elevationGain", "cadence", "calories", "target"]) {
    assert.equal(m[k], undefined, k + " is present on a run that has no such value");
  }
  assert.equal(m.durationSeconds, 2040, "the one thing a treadmill run does measure is missing");
  assert.equal(m.averageHeartRate, 141);
  // ⚠️ SWEPT OVER THE MEASUREMENTS AND EVERYTHING PRINTED, NOT OVER THE WHOLE OBJECT. A blanket search
  // for ":0," reports a.n, a.inBand, a.fastest and a.slowest — counts of how much was judged, which are
  // legitimately zero on a run with no splits and are what the renderer GATES on rather than draws. A
  // ruler that cannot tell a count from a caption fails on a correct model, and the obvious way to make
  // it pass is to stop asserting; this asks the runner's question instead, of every value and every
  // string a template puts on the picture.
  const MEASURES = ["distance", "durationSeconds", "averagePace", "elevationGain",
    "averageHeartRate", "cadence", "calories"];
  for (const run of [treadmillRun(), refRun({ elevGain: 0, avgHr: null, cadence: null, kcal: null })]) {
    const cm = E.shareCardModel(run, {});
    for (const k of MEASURES) assert.notEqual(cm[k], 0, k + " is carried as a zero rather than left absent");
    const printed = [...cm.metrics, ...cm.stats].map((x: any) => String(x.v));
    for (const v of printed) {
      assert.ok(!/^0+(\.0+)?$/.test(v), "a zero is printed where nothing was measured: " + printed.join(" | "));
    }
  }
});

test("the three supporting metrics reflow rather than print a value nobody measured", () => {
  const E = env();
  // The brief's default trio: time, average pace, elevation.
  assert.deepEqual(E.shareCardModel(refRun(), {}).metrics.map((x: any) => x.k), ["TIME", "AVG PACE", "ELEV"]);
  // No elevation: fall through the existing relevance ladder rather than leaving a hole.
  assert.deepEqual(E.shareCardModel(refRun({ elevGain: 0 }), {}).metrics.map((x: any) => x.k),
    ["TIME", "AVG PACE", "AVG HR"]);
  assert.deepEqual(E.shareCardModel(refRun({ elevGain: 0, avgHr: null }), {}).metrics.map((x: any) => x.k),
    ["TIME", "AVG PACE", "CADENCE"]);
  // A watch run has calories and no cadence; a phone run the other way round.
  assert.deepEqual(E.shareCardModel(watchRun({}), {}).metrics.map((x: any) => x.k), ["TIME", "AVG PACE", "ELEV"]);
  // Nothing at all in the ladder: two metrics, not a third column with a dash in it.
  const two = E.shareCardModel(refRun({ elevGain: 0, avgHr: null, maxHr: null, cadence: null, kcal: null }), {});
  assert.deepEqual(two.metrics.map((x: any) => x.k), ["TIME", "AVG PACE"]);
  // A treadmill run knows its clock and nothing else about pace.
  assert.deepEqual(E.shareCardModel(treadmillRun(), {}).metrics.map((x: any) => x.k), ["TIME", "AVG HR"]);
  // ⚠️ ONE LADDER, READ BY BOTH SURFACES. The relevance rules the brief points at ("use average HR,
  // cadence or calories according to existing relevance rules") lived inside rdMetricsHtml and the card
  // could not reach them, so the card had no third metric at all. A second copy would drift within a
  // release and teach the runner two different orders for the same run.
  assert.match(lift("rdMetricsHtml"), /runMetricLadder\(run, false\)/,
    "the debrief no longer reads the shared ladder, so the card and the screen can drift");
  // ⚠️ THE CARD READS IT THROUGH shareMetricPool NOW, AND THE CHAIN IS WHAT IS ASSERTED. The metrics
  // editor needed the whole pool rather than its head, so the ladder climb moved one function outwards —
  // and there are two links to keep: the pool must be the ladder, and the model must go through the
  // pool. Pinning the model's own text alone would pass the day somebody gave the picker its own list.
  assert.match(lift("shareMetricPool"), /runMetricLadder\(run, true\)/,
    "the card's metric pool no longer reads the shared ladder");
  assert.match(lift("shareMetricsChosen"), /shareMetricPool\(run\)/,
    "the chosen metrics no longer come from the pool");
  assert.match(lift("shareCardModel"), /shareMetricsChosen\(run, opt\.metrics\)/,
    "the model builds its metric row by hand again instead of asking the pool");
  // ⚠️ AND RPE IS UNREACHABLE THROUGH THE POOL, which is the safety half of the same chain. The effort
  // rating is something the runner told the app about themselves; the picker offering it would publish
  // it. Measured on a run carrying one: it is in the debrief's ladder and absent from the card's.
  const withRpe = refRun({ rpe: 7 });
  assert.ok(E.runMetricLadder(withRpe, false).some((x: any) => x.key === "rpe"),
    "the debrief lost the effort rating");
  assert.ok(!E.shareMetricPool(withRpe).some((x: any) => x.key === "rpe"),
    "the share card's metric picker offers the runner's own effort rating");
});

test("BLOCKER: the metric picker offers only what the run recorded, at most three, never fewer than one", () => {
  // ⚠️ THE DEFAULT IS THE POOL'S HEAD, AND THAT IS WHY THE VERIFIED RENDERS ARE UNCHANGED. A runner who
  // never opens the tool must get a byte-identical card to the one the reference comparison was signed
  // off against, so the picker changes WHICH three, never the ordering or the drawing.
  const E = env();
  const run = refRun();
  const pool = E.shareMetricPool(run).map((x: any) => x.key);
  assert.deepEqual(E.shareMetricsChosen(run, null).map((x: any) => x.key), pool.slice(0, 3),
    "the default is no longer the pool's own head");
  assert.equal(E.SHARE_METRIC_MAX, 3);
  // A pick is honoured, in the order it is given, and capped.
  assert.deepEqual(E.shareMetricsChosen(run, ["elev", "avgHr"]).map((x: any) => x.key), ["elev", "avgHr"]);
  assert.deepEqual(E.shareMetricsChosen(run, ["time", "pace", "elev", "avgHr"]).map((x: any) => x.key).length, 3,
    "more than three numbers reached the row");
  // ⚠️ A KEY WITH NO VALUE IS DROPPED, NEVER PRINTED EMPTY, and a pick that survives to nothing falls
  // back to the default rather than rendering a card with no row at all. "Never display missing data as
  // zero" has to hold for whatever a caller hands the model, not only for what the studio can produce.
  const flat = refRun({ elevGain: 0, avgHr: null, maxHr: null, cadence: null, kcal: null });
  assert.deepEqual(E.shareMetricsChosen(flat, ["elev", "time"]).map((x: any) => x.key), ["time"],
    "a metric the run never recorded reached the row");
  assert.deepEqual(E.shareMetricsChosen(flat, ["elev", "cadence"]).map((x: any) => x.key),
    E.shareMetricsChosen(flat, null).map((x: any) => x.key),
    "a pick that survives to nothing left the card with no supporting numbers");
  // And the pick is a visible decision, so it has to move the cache key or Share hands over the old card.
  E.setPhoto(photo());
  E.setCard({ aspect: "story", template: "moment", routeOn: true, key: null, file: null, pending: 0, metrics: null });
  const before = E.shareCardKey(run);
  E.setCard({ aspect: "story", template: "moment", routeOn: true, key: null, file: null, pending: 0,
    metrics: ["time", "pace", "avgHr"] });
  assert.notEqual(E.shareCardKey(run), before, "changing the chosen numbers does not invalidate the cache");
});

test("BLOCKER: the framing is kept per template AND per aspect", () => {
  // ⚠️ THE DEFECT THIS FIXES, IN ONE SENTENCE: one shared {ox, oy, k} meant switching Story to Feed, or
  // The Moment to The Progression, silently reframed the runner's photograph — and it could not be
  // otherwise, because the two shapes crop along different edges and the four templates put their type in
  // four different places.
  const E = env();
  const run = refRun();
  assert.equal(E.shareCropKey("moment", "story"), "moment:story");
  assert.notEqual(E.shareCropKey("moment", "story"), E.shareCropKey("moment", "feed"));
  assert.notEqual(E.shareCropKey("moment", "story"), E.shareCropKey("progression", "story"));
  // ⚠️ ONE SLOT PER (TEMPLATE, ASPECT), AND A SHARED SLOT IS THE FAULT THIS GUARDS. Eight slots, all
  // distinct, is the claim — a count alone is satisfied by four aliases of three.
  const keys = ["moment", "execution", "progression", "route"]
    .flatMap((t) => ["story", "feed"].map((a) => E.shareCropKey(t, a)));
  assert.equal(new Set(keys).size, 8, "two framing slots collide: " + keys.join(", "));
  assert.equal(E.shareCropKey("moment", "feed"), "moment:feed");
  // and an unknown shape still lands on the story's slot rather than minting one of its own
  assert.equal(E.shareCropKey("moment", "portrait"), "moment:story");
  // A framing set on one slot does not reach any other.
  const p = photo({ "moment:story": { ox: 0.2, oy: 0.8, k: 2.5 } });
  E.setPhoto(p);
  const a = E.shareCardModel(run, { aspect: "story", template: "moment", photo: p });
  assert.equal(a.photo.ox, 0.2); assert.equal(a.photo.oy, 0.8); assert.equal(a.photo.k, 2.5);
  const b = E.shareCardModel(run, { aspect: "feed", template: "moment", photo: p });
  assert.deepEqual([b.photo.ox, b.photo.oy, b.photo.k], [0.5, 0.5, 1],
    "the feed post inherited the story's framing");
  const c = E.shareCardModel(run, { aspect: "story", template: "progression", photo: p });
  assert.deepEqual([c.photo.ox, c.photo.oy, c.photo.k], [0.5, 0.5, 1],
    "a second template inherited the first one's framing");
  // ⚠️ AND THE MODEL MAY NOT CREATE A SLOT. It is called on every preview frame and on every encode, so a
  // read that lazily wrote would fill the store with entries nothing has edited.
  assert.deepEqual(Object.keys(p.crops), ["moment:story"], "reading a framing created one");
  // ⚠️ AND THE FIT IS PART OF THE FRAMING, SO IT PERSISTS PER SHAPE TOO. A runner who turns Fill on for a
  // panorama on the feed has not asked for their story card to be cropped as well.
  E.shareCropWrite("moment", "feed").fill = true;
  assert.equal(E.shareCardModel(run, { aspect: "feed", template: "moment", photo: p }).photo.fill, true);
  assert.equal(E.shareCardModel(run, { aspect: "story", template: "moment", photo: p }).photo.fill, false,
    "turning Fill on for the feed turned it on for the story too");
  // shareCropWrite is the editing path, and it is the one that creates.
  const made = E.shareCropWrite("route", "feed");
  assert.deepEqual([made.ox, made.oy, made.k], [0.5, 0.5, 1]);
  assert.ok(Object.keys(p.crops).indexOf("route:feed") >= 0, "the editing path did not create its slot");
  // ⚠️ SHARE_CROP0 IS SHARED, SO NOTHING MAY WRITE THROUGH IT. A renderer treating m.photo as scratch
  // space would otherwise move every untouched card's default framing at once.
  assert.notEqual(b.photo, E.SHARE_CROP0);
  assert.deepEqual([E.SHARE_CROP0.ox, E.SHARE_CROP0.oy, E.SHARE_CROP0.k], [0.5, 0.5, 1]);
  // Every framing is in the cache key, or an export hands over the previous crop.
  E.setCard({ aspect: "story", template: "moment", routeOn: true, key: null, file: null, pending: 0, metrics: null });
  const k0 = E.shareCardKey(run);
  E.shareCropWrite("moment", "story").ox = 0.31;
  assert.notEqual(E.shareCardKey(run), k0, "moving the framing does not invalidate the cache");
});

test("a watch run maps without a per-source branch, except where the data genuinely differs", () => {
  const E = env();
  const m = E.shareCardModel(watchRun(), { photo: PHOTO });
  // ⚠️ NO START TIME IS RECOVERABLE — the id is a UUID, and runStartMs's 09:00 fallback exists for
  // Strava, where something must be sent. Printing it would put a time on a run nobody recorded one for.
  assert.equal(m.completedAt, "2026-08-18", "an invented time of day is on the card");
  assert.equal(m.cadence, undefined, "a wrist run reports a cadence the watch never sends");
  assert.equal(m.calories, 402);
  assert.equal(m.verdict.status, "achieved", "a wrist run is judged differently from a phone run");
});

test("the evidence line's arithmetic closes over every split", () => {
  // ⚠️ THE BADGE'S PERCENTAGE IS TAKEN OVER EVERY KILOMETRE. So a line quoting only the measured ones
  // reads as contradicting the badge above it, with nothing to explain the gap — naming what happened to
  // the rest is what makes the pair coherent, and it is a fact rather than a hedge.
  const E = env();
  const line = (run: any) => E.shareEvidenceLine(E.runAnalysis(run));
  assert.equal(line(refRun()), "4 of 5 km inside 5:20–5:50/km");
  assert.equal(line(partEstRun()), "3 of 3 measured km inside 5:20–5:50/km · 2 estimated");
  assert.equal(line(allEstRun()), "", "a run with nothing measured still quotes an adherence figure");
  assert.equal(line(intervalRun()), "", "a session with no band still quotes a target");
  // A window that excludes the warm-up: the unjudged kilometres are named rather than implied.
  const tempo = refRun({ pwin: { s: 2000, e: 5510 } });
  assert.equal(line(tempo), "3 of 3 measured km inside 5:20–5:50/km · 2 outside the target stretch");
  const a = E.runAnalysis(tempo);
  assert.equal(a.judgedN + a.estN + (a.n - a.judgedN - a.estN), a.n, "the split accounting does not close");
});

test("BLOCKER: a low-confidence verdict never becomes a badge, in either direction", () => {
  const E = env();
  const pill = (run: any) => E.shareCardModel(run, { photo: PHOTO }).pill;
  assert.equal(pill(allEstRun()), null, "a run the app never measured wears a verdict badge");
  assert.equal(pill(intervalRun()), null, "a session with no band wears a verdict badge");
  assert.equal(pill(treadmillRun()), null, "a run with no splits wears a verdict badge");
  // More invented than measured still reaches a PACE branch — the ladder read one in-band kilometre of
  // three as 33% and answered "Off the brief today" — and that is the branch that must not be badged.
  // ⚠️ THE PRECONDITION IS "IT REACHED A PACE BRANCH", NOT A NAMED OUTCOME. Written as
  // state === "achieved" this could never pass and could never discriminate: see the sweep below.
  const mostlyEst = refRun({ splits: [{ km: 1, sec: 337 }, { km: 2, sec: 336, est: true }, { km: 3, sec: 334, est: true }] });
  const mv = E.runVerdict(mostlyEst, E.runAnalysis(mostlyEst));
  assert.equal(mv.confidence, "low");
  assert.ok(mv.state !== "insufficientData" && mv.state !== "caution",
    "the fixture no longer reaches a pace branch, so it cannot discriminate: " + mv.state);
  assert.equal(pill(mostlyEst), null, "a verdict badge is drawn from mostly invented kilometres");
  // ⚠️ AND THE CELEBRATORY DIRECTION THE BRIEF WORRIES ABOUT IS UNREACHABLE BY ARITHMETIC, WHICH IS WORTH
  // PINNING RATHER THAN ASSUMING. "achieved" needs inBand/n >= 70%, and low confidence off the est route
  // needs estN >= judgedN — but inBand can only count judged rows, so n >= 2 * inBand and the percentage
  // cannot exceed 50. Every reachable low-confidence pace branch is therefore an ACCUSATION, which is the
  // fault the preflight measured and the opposite of the one the brief names. Swept rather than argued.
  let sawLowPace = 0, sawAchievedLow = 0;
  const KINDS = [{ sec: 335 }, { sec: 335, est: true }, { sec: 400 }, { sec: 400, est: true }];
  const walk = (splits: any[]) => {
    if (splits.length) {
      const run = refRun({ splits: splits.map((s, i) => ({ km: i + 1, ...s })), pwin: { s: 0, e: splits.length * 1000 } });
      const v = E.runVerdict(run, E.runAnalysis(run));
      if (v.confidence === "low") {
        if (v.state === "achieved") sawAchievedLow++;
        if (v.state !== "insufficientData") { sawLowPace++; assert.equal(pill(run), null, "a low-confidence verdict is badged: " + JSON.stringify(splits)); }
      }
    }
    if (splits.length >= 5) return;
    for (const k of KINDS) walk(splits.concat([k]));
  };
  walk([]);
  assert.equal(sawAchievedLow, 0, "a celebratory verdict is reachable from low-confidence evidence");
  assert.ok(sawLowPace > 20, "the sweep found almost no low-confidence pace branches, so it proves little: " + sawLowPace);
  // Medium is drawn, because the claim can be made if it says so.
  assert.ok(pill(partEstRun()), "a part-estimated run withholds a verdict it is entitled to state");
  assert.ok(pill(refRun()), "a fully measured run withholds its verdict");
});

// ---- template eligibility ------------------------------------------------------------------------

test("BLOCKER: every ineligible template says what it needs, in words", () => {
  // ⚠️ A GREYED-OUT TILE ON ITS OWN TELLS THE RUNNER THE APP IS BROKEN. studioRouteHtml already records
  // the remedy for exactly this, and it is the looks-live-does-nothing class shipped three times.
  const E = env();
  for (const run of [refRun(), treadmillRun(), intervalRun(), allEstRun()]) {
    for (const photo of [null, PHOTO]) {
      const a = E.runAnalysis(run);
      const pres = E.runRoutePresentation(run, E.sharePrivacyFor(run));
      const st = E.shareTemplateStates(run, a, pres, { photo });
      assert.deepEqual(Object.keys(st).sort(), ["execution", "moment", "progression", "route"]);
      for (const id of Object.keys(st)) {
        if (st[id].ok) { assert.equal(st[id].why, "", id + " is eligible and still carries a reason"); continue; }
        assert.ok(st[id].why.length > 12, id + " is hidden with no reason: " + JSON.stringify(st[id]));
        assert.match(st[id].why, /\.$/, id + "'s reason is not a sentence: " + st[id].why);
      }
    }
  }
});

test("BLOCKER: no template is gated on a photograph, and every gate is a fact about the run", () => {
  // ⚠️⚠️ THIS TEST USED TO ASSERT THE OPPOSITE, AND THE OWNER OVERRULED IT (ruling 7, 2026-08-20). It
  // required moment, execution and progression to be REFUSED without a photograph, which is what limited
  // the session-colour ground he had just asked for to one template of four: a runner who added no
  // photograph was offered a single card. The reason that gate was once defensible is that the upper half
  // of a photo template with no photograph was empty; the session ground and its contour lines fill it
  // now, so the gate had nothing left to protect.
  // ⚠️ IT IS RESTATED RATHER THAN DELETED, AND THE NEW CLAIM IS STRICTLY STRONGER: eligibility must be
  // IDENTICAL with and without a photograph. A one-directional check ("all four are offered with no
  // photograph") would pass while a photograph secretly made a template ineligible; deepEqual on the
  // whole answer cannot.
  const E = env();
  const states = (run: any, photo: any) =>
    E.shareTemplateStates(run, E.runAnalysis(run), E.runRoutePresentation(run, E.sharePrivacyFor(run)), { photo });
  const noPhoto = states(refRun(), null);
  for (const id of ["moment", "execution", "progression", "route"]) {
    assert.equal(noPhoto[id].ok, true, id + " is refused for the pack's own reference run with no photograph");
  }
  assert.deepEqual(noPhoto, states(refRun(), PHOTO),
    "a photograph changes which templates this run can fill");
  // ⚠️ AND NO REASON ANYWHERE MAY ASK FOR A PHOTOGRAPH, on any run, which is what stops the gate coming
  // back for one template. Swept over every run shape the fixtures carry, both with and without a photo.
  const runs: [string, any][] = [["reference", refRun()], ["treadmill", treadmillRun()],
    ["interval", intervalRun()], ["no band", refRun({ pband: null, pwin: null, pmix: null })],
    ["two splits", refRun({ splits: [{ km: 1, sec: 300 }, { km: 2, sec: 302 }] })]];
  for (const [name, run] of runs) {
    for (const photo of [null, PHOTO]) {
      const st = states(run, photo);
      for (const id of ["moment", "execution", "progression", "route"]) {
        assert.ok(!/photo/i.test(st[id].why || ""),
          name + "/" + id + " still asks for a photograph: " + st[id].why);
      }
    }
    // ⚠️ AND THE MOMENT IS ALWAYS DRAWABLE FOR A RUN THE APP WOULD STORE, because its only gate is that
    // there is a headline fact — a distance, or failing that a time. A treadmill run has a time.
    assert.equal(states(run, null).moment.ok, true, name + " cannot draw The Moment");
  }
  // ⚠️ THE MOMENT'S GATE IS REAL, THOUGH, AND THIS IS THE ONE RUN THAT TRIPS IT: neither a distance nor a
  // time is the only way any template is refused now, and it is what keeps template: null reachable.
  const empty = refRun({ distKm: 0, dist: "0 km", time: "" });
  const st = states(empty, PHOTO);
  assert.equal(st.moment.ok, false, "a run with no distance and no time is still offered a headline card");
  assert.match(st.moment.why, /distance/i, "the reason does not name what is missing: " + st.moment.why);
});

test("BLOCKER: The Execution is hidden for a repetition session, and says why", () => {
  // ⚠️ THE OWNER'S RULING (2026-08-18): eligible only where the target can be judged against the splits
  // that actually exist, which are 1000 m cuts. Nothing per-repetition is persisted on any stored run on
  // either device, and paceStampFor deliberately answers pband: null, pmix: "reps" for these sessions.
  // Drawing it would mean inventing a band or labelling kilometre splits as repetitions.
  const E = env();
  const run = intervalRun();
  const st = E.shareTemplateStates(run, E.runAnalysis(run), E.runRoutePresentation(run, E.sharePrivacyFor(run)), { photo: PHOTO });
  assert.equal(st.execution.ok, false, "an interval session is offered a target-band chart");
  assert.match(st.execution.why, /repetition/i, "the reason does not name what makes it ineligible");
  // Never faked: the model carries no target for it either.
  assert.equal(E.shareCardModel(run, { photo: PHOTO }).target, undefined, "a target band is invented");
  // And a bandless non-interval run is refused for its own, different reason.
  const noBand = refRun({ pband: null, pwin: null, pmix: null });
  const st2 = E.shareTemplateStates(noBand, E.runAnalysis(noBand), E.runRoutePresentation(noBand, E.sharePrivacyFor(noBand)), { photo: PHOTO });
  assert.equal(st2.execution.ok, false);
  assert.match(st2.execution.why, /no prescribed pace/i);
});

test("The Progression needs three MEASURED splits, not three splits", () => {
  // ⚠️ AN ESTIMATED SPLIT IS THE ELAPSED STRETCH DIVIDED EVENLY, so every bar drawn from one is the same
  // length by construction — three of them would draw a flat, confident, invented progression.
  const E = env();
  const prog = (run: any) =>
    E.shareTemplateStates(run, E.runAnalysis(run), E.runRoutePresentation(run, E.sharePrivacyFor(run)), { photo: PHOTO }).progression;
  assert.equal(prog(refRun()).ok, true);
  assert.equal(prog(allEstRun()).ok, false, "a wholly estimated run is offered a progression story");
  assert.match(prog(allEstRun()).why, /estimated/i, "the reason does not say the splits were estimated");
  assert.equal(prog(refRun({ splits: refRun().splits.slice(0, 2) })).ok, false);
  assert.equal(prog(refRun({ splits: refRun().splits.slice(0, 3) })).ok, true);
  // Exactly three measured plus two estimated is enough: the three are real.
  assert.equal(prog(partEstRun()).ok, true);
});

test("The Route Poster asks the post-privacy geometry, never run.route", () => {
  // ⚠️ ASKING run.route IS HOW A TEMPLATE OFFERS ITSELF AND THEN DRAWS NOTHING. A route the runner has
  // hidden, or one trimmed until fewer than two points survive, cannot be built from.
  const E = env();
  const route = (run: any) =>
    E.shareTemplateStates(run, E.runAnalysis(run), E.runRoutePresentation(run, E.sharePrivacyFor(run)), { photo: PHOTO }).route;
  assert.equal(route(refRun()).ok, true);
  assert.equal(route(treadmillRun()).ok, false, "an indoor session is offered a route poster");
  assert.match(route(treadmillRun()).why, /indoor/i);
  assert.equal(route(refRun({ route: [] })).ok, false);
  E.setPrivacy({ ends: false, map: true });
  assert.equal(route(refRun()).ok, false, "a hidden route is still offered as artwork");
  assert.match(route(refRun()).why, /hidden/i);
  assert.match(lift("shareTemplateStates"), /pres\.route/, "eligibility reads the raw route again");
});

test("BLOCKER: eligibility cannot be relaxed by the SHAPE, only by the run", () => {
  // ⚠️ THE PHOTOGRAPH GATE WAS ASPECT-DEPENDENT FOR A DAY AND IS NOT ANY MORE. The withdrawn transparent
  // output carried no photograph by construction, so it relaxed the gate for three templates — and while
  // that was true of it, it was also the one thing in this function that could make the same run offer
  // different templates depending on which chip was selected. Both shapes are photo-carrying now, so the
  // answer must not depend on the aspect at all: what a run can honestly say is a fact about the RUN.
  const E = env();
  const run = refRun();
  const a = E.runAnalysis(run), pres = E.runRoutePresentation(run, E.sharePrivacyFor(run));
  for (const aspect of E.SHARE_ASPECTS) {
    const bare = E.shareTemplateStates(run, a, pres, { photo: null, aspect: aspect });
    const shot = E.shareTemplateStates(run, a, pres, { photo: photo(), aspect: aspect });
    assert.deepEqual(bare, E.shareTemplateStates(run, a, pres, { photo: null, aspect: "story" }),
      aspect + " answers a different eligibility from a story card for the same run and no photograph");
    assert.deepEqual(shot, E.shareTemplateStates(run, a, pres, { photo: photo(), aspect: "story" }),
      aspect + " answers a different eligibility from a story card for the same run with a photograph");
  }
  // ⚠️ AND SINCE RULING 7 THE PHOTOGRAPH DOES NOT BITE AT ALL, WHICH MAKES THIS CLAIM SHARPER RATHER
  // THAN WEAKER: the answer may not depend on the aspect OR on the picture, so one comparison covers
  // both axes at once. The requirement it replaces — that three templates demand a photograph — is the
  // one the owner removed, and the test above is where its replacement lives.
  for (const aspect of E.SHARE_ASPECTS) {
    assert.deepEqual(E.shareTemplateStates(run, a, pres, { photo: null, aspect: aspect }),
      E.shareTemplateStates(run, a, pres, { photo: photo(), aspect: "story" }),
      aspect + " answers a different eligibility depending on the shape or the photograph");
  }
});

test("BLOCKER: the poster is handed the photograph the runner chose, on every shape", () => {
  // ⚠️ THE OWNER'S RULING OF 2026-08-20 REVERSES THE PACK ON THIS ONE TEMPLATE: "I want them to be able
  // to add a photo to any of the cards that you have created". The pack calls the poster "route-led,
  // photo-free" and the model used to hand it null by name. There must now be NO per-template branch at
  // all, or the next template added inherits whichever half was written first.
  const E = env();
  const run = refRun();
  for (const aspect of E.SHARE_ASPECTS) {
    for (const t of ["moment", "execution", "progression", "route"]) {
      const m = E.shareCardModel(run, { aspect: aspect, template: t, photo: photo() });
      assert.ok(m.photo && m.photo.id === photo().id,
        t + " on a " + aspect + " card was not handed the runner's photograph");
    }
    // ⚠️ AND PHOTO-OPTIONAL MEANS THE MATTE GROUND SURVIVES. With no picture the poster still draws, and
    // m.photo has to be absent rather than an empty view, because shareDrawBody's topographic ground and
    // the whole luminance solver are gated on exactly that field.
    const bare = E.shareCardModel(run, { aspect: aspect, template: "route", photo: null });
    assert.equal(bare.photo, null, "a poster with no photograph carries a photo field anyway");
    assert.equal(bare.template, "route");
  }
});

test("the template falls through to one that can be drawn", () => {
  const E = env();
  const model = (run: any, opt: any) => E.shareCardModel(run, opt);
  assert.equal(model(refRun(), { photo: PHOTO }).template, "moment", "The Moment is not the default");
  // ⚠️ AND IT IS THE DEFAULT WITH NO PHOTOGRAPH TOO, WHICH IS THE CHANGE RULING 7 MADE. This line used to
  // require the POSTER here, because moment/execution/progression were refused without a picture — so the
  // pack's own "default, most broadly useful card" was unreachable for anybody who did not add one.
  assert.equal(model(refRun(), {}).template, "moment", "with no photo the default is not The Moment");
  // ⚠️ A TREADMILL RUN NOW GETS A CARD RATHER THAN THE PLACEHOLDER: no route, no photograph, and The
  // Moment still draws it on the session ground. Only a run with neither a distance nor a time reaches
  // null, which is what keeps sharePlaceholderCard reachable at all.
  assert.equal(model(treadmillRun(), {}).template, "moment", "a treadmill run is left with no card");
  // ⚠️ AND REACHING null NOW TAKES A RUN THAT FAILS ALL FOUR GATES, WHICH IS WORTH KNOWING BEFORE
  // ASSERTING IT. Written with only the headline removed this line measured "execution": The Execution
  // and The Progression are gated on the SPLITS, not on the hero, so a run with no distance and no time
  // but five measured kilometres still fills them. The placeholder is for a record with nothing in it.
  assert.equal(model(refRun({ distKm: 0, dist: "0 km", time: "", splits: [], route: [],
    pband: null, pwin: null, pmix: null }), { photo: PHOTO }).template, null,
    "a run with no distance, no time, no splits and no route is given a template it cannot fill");
  // An asked-for template that has become ineligible does not survive.
  assert.equal(model(intervalRun(), { photo: PHOTO, template: "execution" }).template, "moment",
    "an ineligible template stays selected");
  assert.equal(model(refRun(), { photo: PHOTO, template: "progression" }).template, "progression",
    "an eligible request is overridden");
  // Every id in the fall-through order is a real template with a label.
  const labels = new Function("return " + liftConst("SHARE_TEMPLATE_LABEL").replace(/^const [A-Z_]+ = /, "").replace(/;$/, ""))();
  for (const id of E.SHARE_TEMPLATES) assert.ok(labels[id], "no label for template " + id);
});

// ---- per-run share privacy -----------------------------------------------------------------------

test("BLOCKER: hidden start and finish defaults on for a run nobody has adjusted", () => {
  // ⚠️ THE DEFAULT WAS OFF, SO A FIRST-TIME SHARER'S CARD CARRIED THEIR FRONT DOOR. The owner's ruling
  // is per-run and safe-by-default, without flipping the global — which would retroactively trim the
  // debrief map of every run every existing runner has ever logged.
  const E = env();
  const sp = E.sharePrivacyFor(refRun());
  assert.equal(sp.ends, true, "an untouched run does not redact its ends");
  assert.equal(sp.map, false, "an untouched run hides its whole route");
  assert.equal(sp.loc, false);
  assert.equal(sp.date, false);
  // And the redaction genuinely happens rather than being recorded and ignored.
  const pres = E.runRoutePresentation(refRun(), sp);
  assert.equal(pres.redacted, true, "the default is set and not applied");
  assert.ok(pres.route.length < ROUTE.length, "the line was not trimmed");
  assert.match(lift("shareCardModel"), /runRoutePresentation\(run, sp\)/,
    "the card resolves privacy without the per-run record");
});

test("BLOCKER: the global setting is a floor — a card can be more private, never less", () => {
  // ⚠️ WRITTEN AS AN OVERRIDE INSTEAD OF A FLOOR, A STORED { ends: false } WOULD UN-REDACT A CARD FOR
  // SOMEBODY WHOSE WHOLE APP IS SET TO REDACT. That is a privacy regression against today's behaviour
  // rather than the improvement this is meant to be.
  const E = env();
  E.setSharePrivStore({ [REF_ID]: { ends: false, map: false } });
  assert.equal(E.sharePrivacyFor(refRun()).ends, false, "an explicit choice is not honoured");
  E.setPrivacy({ ends: true, map: false });
  assert.equal(E.sharePrivacyFor(refRun()).ends, true, "the global is being overridden by the card");
  E.setPrivacy({ ends: false, map: true });
  assert.equal(E.sharePrivacyFor(refRun()).map, true, "a globally hidden route is shown on the card");
  // And the studio says so rather than looking inert.
  assert.equal(E.sharePrivacyLocked("ends"), false);
  E.setPrivacy({ ends: true, map: true });
  assert.equal(E.sharePrivacyLocked("ends"), true);
  assert.equal(E.sharePrivacyLocked("map"), true);
  assert.equal(E.sharePrivacyLocked("date"), false, "a share-only switch claims to be globally locked");
  const sw = lift("studioSwitch");
  assert.match(sw, /aria-disabled="true" disabled/, "a locked switch is not actually disabled");
  assert.match(sw, /Route privacy/, "a locked switch does not say where to change it");
  assert.match(lift("studioClick"), /aria-disabled"\) === "true"\) return/,
    "a disabled privacy switch still writes on tap");
});

test("the place and the date are switchable on their own", () => {
  // ⚠️ UNTIL NOW THE ONLY WAY TO WITHHOLD THE TOWN WAS TO HIDE THE WHOLE ROUTE, so a runner who wanted
  // the shape of their run shown but not where they live could not say so. There was no date control at all.
  const E = env();
  const base = E.shareCardModel(refRun(), { photo: PHOTO });
  assert.equal(base.coarseLocation, "Durham");
  assert.match(base.meta, /Durham/);
  assert.match(base.meta, /18 Aug 2026/);
  E.setSharePrivStore({ [REF_ID]: { loc: true } });
  const noLoc = E.shareCardModel(refRun(), { photo: PHOTO });
  assert.equal(noLoc.coarseLocation, undefined, "the place is still on the card");
  assert.ok(!/Durham/.test(JSON.stringify(noLoc)), "the place survives elsewhere in the model");
  assert.match(noLoc.meta, /18 Aug 2026/, "hiding the place took the date with it");
  E.setSharePrivStore({ [REF_ID]: { date: true } });
  const noDate = E.shareCardModel(refRun(), { photo: PHOTO });
  assert.equal(noDate.completedAt, "", "the date is still on the card");
  assert.ok(!/2026/.test(noDate.meta), "the date survives in the meta line: " + noDate.meta);
  assert.match(noDate.meta, /Durham/, "hiding the date took the place with it");
  assert.deepEqual(noDate.privacy, { route: true, ends: true, location: false, date: true });
  // All four switches are rendered, and each is a real control.
  const rows = lift("studioPrivHtml");
  for (const k of ["ends", "map", "loc", "date"]) {
    assert.match(rows, new RegExp('studioSwitch\\("' + k + '"'), "no switch for " + k);
  }
  assert.match(rows, /apply to this card only/i, "the runner is not told whose setting these are");
});

test("the per-run store is bounded and survives a round trip", () => {
  const E = env();
  E.setSharePrivStore({});
  E.setSharePrivacy(refRun(), "loc", true);
  assert.deepEqual(E.getSharePrivStore()[REF_ID], { loc: true });
  assert.equal(JSON.parse(E.store.getItem("interun_shareprivacy_v1")!)[REF_ID].loc, true);
  // ⚠️ KEYED ON RUN IDS, WHICH KEEP COMING. interun_runs holds 50 and interun_hist_v1 is uncapped, so an
  // unpruned store keyed by run id grows for ever — and losing a record costs nothing worse than the safe
  // default returning.
  const many: any = {};
  for (let i = 0; i < 200; i++) many["run-" + i] = { loc: true };
  E.setSharePrivStore(many);
  E.setSharePrivacy(refRun(), "date", true);
  const kept = Object.keys(E.getSharePrivStore()).length;
  assert.ok(kept <= 61, "the store is unbounded: " + kept + " records");
  assert.ok(E.getSharePrivStore()[REF_ID], "the record just written was pruned");
  // A run with no id cannot mint a key.
  E.setSharePrivStore({});
  E.setSharePrivacy({}, "loc", true);
  assert.deepEqual(E.getSharePrivStore(), {}, "a run with no id writes a record anyway");
});

test("BLOCKER: every visible decision is in the cache key", () => {
  // ⚠️ THIS FUNCTION'S OWN HEADER RECORDS A KEY MISSING ONE HANDING OVER THE PRE-BUILT CARD WITHOUT THE
  // RUNNER'S PHOTOGRAPH — and that the fault is unreproducible until you know a cache exists at all.
  const E = env();
  const run = refRun();
  const keys = new Set<string>();
  const snap = () => { keys.add(E.shareCardKey(run)); return E.shareCardKey(run); };
  const base = snap();
  for (const [k, v] of [["ends", false], ["map", true], ["loc", true], ["date", true]] as const) {
    E.setSharePrivStore({ [run.id]: { [k]: v } });
    assert.notEqual(E.shareCardKey(run), base, "the key ignores the " + k + " switch");
    snap();
  }
  E.setSharePrivStore({});
  const c = E.getCard(); c.template = "progression";
  assert.notEqual(E.shareCardKey(run), base, "the key ignores which template is being drawn");
  c.template = null;
  // The confidence decides whether a badge is drawn, and nothing else in the key would move with it.
  const hedged = partEstRun(); hedged.id = run.id;
  assert.notEqual(E.shareCardKey(hedged), base, "the key ignores the verdict's confidence");
  assert.match(lift("shareCardKey"), /v\.state \+ ":" \+ v\.confidence/, "the confidence is not keyed");
});

// ---- the export filename -------------------------------------------------------------------------

test("BLOCKER: the export filename is non-sensitive and honours the date switch", () => {
  // ⚠️ EVERY EXPORT USED THE SAME FIXED NAME, so two runs saved to one folder collided. And hiding the
  // date on the card has to hide it here too — the spec's own rule is that hidden metadata may not
  // appear in accessibility labels, filenames, EXIF or analytics.
  const E = env();
  const name = (run: any, opt: any = {}) => E.shareFileName(E.shareCardModel(run, opt));
  assert.equal(name(refRun()), "InteRun-2026-08-18-Easy-run-5.51km.jpg");
  // Two different runs on one day do not collide.
  assert.notEqual(name(refRun()), name(refRun({ distKm: 8.2, dist: "8.20 km" })));
  assert.notEqual(name(refRun()), name(refRun({ type: "long", t: "Long run" })));
  E.setSharePrivStore({ [REF_ID]: { date: true } });
  const hidden = name(refRun());
  assert.ok(!/2026|08-18/.test(hidden), "the hidden date is in the filename: " + hidden);
  assert.equal(hidden, "InteRun-Easy-run-5.51km.jpg");
  // ⚠️ AND THE FILENAME HONOURS THE SWITCH ITSELF, not merely because the model blanked the date above it.
  // TWO gates hold this rule — shareCardModel returns no completedAt when the date is hidden, and
  // shareFileName re-checks privacy.date — and a guard on the composed outcome cannot see either of them
  // being deleted. Measured: removing the filename's own check failed nothing at all in this file.
  assert.equal(E.shareFileName({ sessionLabel: "Easy run", completedAt: "2026-08-18T12:00:04.000Z",
    distance: 5.51, privacy: { date: true } }), "InteRun-Easy-run-5.51km.jpg",
    "the filename prints a date the card is hiding");
  E.setSharePrivStore({});
  // ⚠️ NO RUN ID. It is a millisecond timestamp, so it would put the time of day into the name of a card
  // whose date the runner may have just hidden.
  for (const n of [name(refRun()), name(watchRun()), name(treadmillRun())]) {
    assert.ok(!(new RegExp(String(REF_END_MS).slice(0, 9) + "|9E1C3A62", "i")).test(n), "the run id is in the filename: " + n);
    assert.ok(!/07:39|0739|Durham/i.test(n), "a time of day or a place is in the filename: " + n);
    assert.match(n, /^InteRun-[A-Za-z0-9.\-]+\.jpg$/, "the filename is not a safe simple name: " + n);
  }
  assert.equal(name(treadmillRun()), "InteRun-2026-08-18-Easy-run.jpg", "a zero distance is in the name");
  // And the export path actually uses it, from the model it drew.
  const prep = lift("prepareShareCard");
  assert.match(prep, /canvasToShareFile\(c, shareFileName\(m\)\)/,
    "the export is still a fixed filename, or the name no longer comes from the model that drew it");
  assert.ok(!/interun-run\.jpg/.test(page()), "the old fixed filename is still in the build");
  // ⚠️ AND THE NAME'S EXTENSION IS THE ENCODER'S OWN, NOT A LITERAL BESIDE IT. Named separately the two
  // agree until somebody adds a second format, and the failure is a file whose name says one thing and
  // whose bytes say another — invisible to a dimension test and to a pixel test alike.
  assert.match(lift("shareFileName"), /SHARE_EXPORT\.ext/,
    "the filename's extension is written out rather than taken from the encoder's own record");
  assert.equal(E.SHARE_EXPORT.ext, "jpg");
  assert.equal(E.SHARE_EXPORT.mime, "image/jpeg");
});

// ---- the brand mark ------------------------------------------------------------------------------

test("BLOCKER: the real vector can be loaded as an image at all", () => {
  // ⚠️ WITHOUT xmlns IT IS NOT SVG WHEN PARSED AS A STANDALONE DOCUMENT. Inline in HTML the parser knows
  // from the tag name; through a data: URI it does not, the load fails and onerror fires. So the
  // canonical mark could not be composited into an export, and the only route to the logo in a picture
  // was to re-draw it by hand in canvas paths — which is how the card's badge came to carry a gradient,
  // a glow and a gloss the real mark does not have.
  // ⚠️ EVERY COPY OF IT IN THE BUILD, DERIVED, NOT THE FIRST ONE. There are two: the splash markup the
  // build interpolates, and BRAND_SVG, the runtime string it emits from the same constant with
  // JSON.stringify — and BRAND_SVG is the only one an exporter can reach, because BRAND_MARK is a
  // build-time constant that does not exist at runtime at all. Checking html.indexOf's first hit would
  // pass while a hand-written second copy sat below it, which is how the card came to draw its own badge.
  const html = page();
  const marks = [...html.matchAll(/<svg[^>]*aria-label=\\?"Inte-Run\\?"/g)].map((m) => m[0]);
  assert.ok(marks.length >= 2, "expected the splash markup and the runtime string, found " + marks.length);
  for (const tag of marks) {
    assert.match(tag, /xmlns=\\?"http:\/\/www\.w3\.org\/2000\/svg\\?"/,
      "a copy of the brand mark has no namespace, so it cannot be loaded through a data: URI: " + tag);
    assert.match(tag, /viewBox=\\?"0 0 120 120\\?"/, "the mark's own geometry changed with the attribute");
  }
  // MEASURED in a real browser against this served build (scratchpad/share/work/mark.mjs, and
  // mark-composite.png beside it): with the namespace stripped the load fails; as shipped it decodes at
  // 104x104, composites over a bitmap, survives getImageData — so the canvas is NOT tainted — and
  // toBlob("image/jpeg", 0.92) returns 6,133 bytes. A tainted canvas would make toBlob refuse and the
  // runner would lose their photograph at the moment they tapped Share.
  assert.match(html, /const BRAND_SVG = "<svg /, "the runtime handle is no longer emitted from the constant");
});

// ---- what the two shipped templates read off the model -------------------------------------------

test("BLOCKER: the adherence count uses the judged denominator, and is absent when nothing was judged", () => {
  // ⚠️ THE POSTER PRINTS "N OF M / KM ON TARGET", which is the one column a map app cannot draw — so the
  // denominator has to be the kilometres the target was actually applied to. A threshold session's
  // warm-up and cool-down sit outside the prescribed window and are deliberately unscored, and an
  // estimated split is refused outright: "5 of 8" where three were never judged reads as three failures.
  const E = env();
  const run = refRun();
  const a = E.runAnalysis(run);
  const m = E.shareCardModel(run, { aspect: "story", template: "route", routeOn: true, photo: null });
  assert.deepEqual(m.adherence, { inBand: a.inBand, judged: a.judgedN });
  assert.equal(m.adherence.judged, 5, "the reference run's judged count changed");
  assert.notEqual(a.judgedN, run.splits.length + 1, "the denominator is the raw split count");
  // A run with a band but nothing measurable against it carries no count at all, never a zero.
  const est = E.shareCardModel(allEstRun(), { aspect: "story", template: "route", routeOn: true, photo: null });
  assert.equal(est.adherence, undefined, "an all-estimated run published an adherence count");
  const tread = E.shareCardModel(treadmillRun(), { aspect: "story", template: "moment", routeOn: false, photo: PHOTO });
  assert.equal(tread.adherence, undefined, "a run with no band published an adherence count");
  // And it is the analysis's own arithmetic, not a second count: judged rows agree with the field.
  assert.equal(a.rows.filter((r: any) => r.judged).length, m.adherence.judged);
});

test("BLOCKER: the card's date carries no time of day, and the switch still hides it", () => {
  // ⚠️ BOTH REFERENCES SHOW A DATE AND NEITHER SHOWS A CLOCK TIME. The date says when the run happened;
  // the time of day says when this person leaves their house, on a picture that leaves the phone.
  const E = env();
  const run = refRun();
  const m = E.shareCardModel(run, { aspect: "story", template: "moment", routeOn: true, photo: PHOTO });
  assert.equal(m.dateLabel, "18 Aug 2026");
  assert.ok(!/\d\d:\d\d/.test(m.dateLabel), "a time of day reached the card's date line");
  // rdWhenText still carries the time for the debrief, so the split did not change the other surface.
  assert.match(E.rdWhenText(run), /18 Aug 2026 at \d\d:\d\d/);
  assert.ok(E.rdWhenText(run).startsWith(E.rdDateText(run)), "the two date strings have drifted apart");
  // A watch run has no recoverable start time, so both answer the stored date and neither invents one.
  assert.equal(E.rdDateText(watchRun()), "18 Aug 2026");
  assert.equal(E.rdWhenText(watchRun()), "18 Aug 2026");
  // The date switch hides it here exactly as it hides it from meta and from the filename.
  E.setSharePrivStore({ [REF_ID]: { date: true } });
  const hidden = E.shareCardModel(run, { aspect: "story", template: "moment", routeOn: true, photo: PHOTO });
  assert.equal(hidden.dateLabel, "");
  assert.ok(!/2026/.test(hidden.meta), "the date survived in meta");
  assert.ok(!/2026/.test(E.shareFileName(hidden)), "the date survived in the filename");
});

test("BLOCKER: the poster's route is not optional, whatever the switch says", () => {
  // ⚠️ ONE FIELD THE TEMPLATE MUST NOT HAVE TO DECIDE FOR ITSELF. shareRouteOn() defaults to "off when a
  // photograph has been chosen", which is right for The Moment's small inset and would hand the poster an
  // empty field under a distance hero — the route IS the poster, so the model forces it there.
  // ⚠️ AND ITS PHOTOGRAPH IS NO LONGER FORCED TO null: see the poster's own photo test above for the
  // owner's ruling. What is asserted here is the route, which that ruling did not touch.
  const E = env();
  const run = refRun();
  const poster = E.shareCardModel(run, { aspect: "story", template: "route", routeOn: false, photo: PHOTO });
  assert.equal(poster.template, "route");
  assert.ok(poster.route && poster.route.length >= 2, "the poster was handed no route");
  // The Moment with the same options keeps the photograph and honours the route switch.
  // ⚠️ THE SAME BITMAP, NOT THE SAME OBJECT. sharePhotoView hands each card a fresh view carrying that
  // card's own framing, so identity is the wrong invariant now — what matters is that the picture
  // survives and that nothing downstream can write back through it into the store.
  const moment = E.shareCardModel(run, { aspect: "story", template: "moment", routeOn: false, photo: PHOTO });
  assert.ok(moment.photo && moment.photo.id === PHOTO.id, "The Moment lost its photograph");
  assert.notEqual(moment.photo, PHOTO, "the card was handed the store's own photograph object to write through");
  assert.equal(moment.route, null, "The Moment ignored the route switch");
  // ⚠️ AND PRIVACY STILL WINS OVER THE FORCED ROUTE. Hiding the map makes the poster ineligible rather
  // than letting it offer itself and draw nothing.
  E.setSharePrivStore({ [REF_ID]: { map: true } });
  const hiddenMap = E.shareCardModel(run, { aspect: "story", template: "route", routeOn: true, photo: PHOTO });
  assert.equal(hiddenMap.route, null, "a hidden route still reached the poster");
  assert.equal(hiddenMap.eligibility.route.ok, false, "the poster is still offered with no route");
  assert.notEqual(hiddenMap.template, "route", "the poster was drawn with nothing to draw");
});

test("the route the poster normalises is already redacted, and the redaction is measurable", () => {
  // ⚠️ "Apply the same route redaction used elsewhere in the app BEFORE normalisation/rendering." The
  // poster centres and scales what it is given, so a full route handed over here would be normalised
  // with the runner's front door in it and the ends merely covered by markers.
  const E = env();
  const run = refRun();
  const safe = E.shareCardModel(run, { aspect: "story", template: "route", routeOn: true, photo: null });
  E.setSharePrivStore({ [REF_ID]: { ends: false } });
  const full = E.shareCardModel(run, { aspect: "story", template: "route", routeOn: true, photo: null });
  assert.equal(full.route.length, run.route.length, "the ends-visible card is not the whole route");
  assert.ok(safe.route.length < full.route.length - 10,
    "hiding the ends removed only " + (full.route.length - safe.route.length) + " points");
  assert.notDeepEqual(safe.route[0], full.route[0], "the redacted route still starts where the run did");
  assert.notDeepEqual(safe.route[safe.route.length - 1], full.route[full.route.length - 1],
    "the redacted route still ends where the run did");
});
