import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

/**
 * "Build your own run", measured in kilometres as well as minutes.
 *
 * His request after building a session on a real day: *"i chose to do an easy run and it would only
 * let me choose it in terms of minutes. I want to be able to either choose it by length of time as it
 * is now or by distance e.g. being able to choose a 6[k]m easy if i want to"*.
 *
 * ⚠️ THIS TEST READS THE BUILT `web/app.html`, because `buildCustomSession` is web-layer code — the
 * same precedent as `warmup-delivery`, `home-screen-chrome` and `ios-input-zoom`. Run `node web/app.ts`
 * first. A src-only test cannot see any of the four defects below, every one of which was live in a
 * green suite and found by driving the real screen in a browser.
 */
function lift(names: string[]): string {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

/** The plan the fake `extraRep` serves representatives from. */
let REP: Record<string, any> = {};

const api = new Function(
  "extraRep", "builderUsesReps", "SESSION_LABEL", "TODAY_DOW", "isoAdd",
  lift(["stepSecs", "buildCustomSession", "builderCanUseDistance", "builderKmFromMinutes", "builderMinutesFromKm"]) +
  "; return { buildCustomSession, builderCanUseDistance, builderKmFromMinutes, builderMinutesFromKm };",
)(
  (t: string) => REP[t] || null,
  (t: string) => ["threshold", "vo2", "race-specific"].includes(t),
  { easy: "Easy run", long: "Long run", recovery: "Recovery" },
  0,
  (iso: string) => new Date(iso + "T00:00:00Z"),
);

const { buildCustomSession, builderCanUseDistance, builderKmFromMinutes, builderMinutesFromKm } = api;

const secs = (s: any) => (s.steps || []).reduce((a: number, x: any) => a + (x.durationSeconds || 0), 0);
/** The distance the app itself prints on the chip. */
const km = (s: any) => (s.estimatedDistanceMeters || 0) / 1000;

/** A real plan, so the representatives are the ones a runner is actually offered. */
function planFor(opts: { experience: string; status?: string; daysPerWeek: number; distance: any }) {
  return generatePlan(
    { experience: opts.experience, status: opts.status, daysPerWeek: opts.daysPerWeek, includeStrength: false,
      recent: { distanceMeters: 5000, timeSeconds: 25 * 60 } } as any,
    { distance: opts.distance, targetTimeSeconds: 25 * 60, raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any,
  );
}

/** Fill REP with one representative per type, the way `extraRep` does from the live plan. */
function seedReps(plan: any) {
  REP = {};
  for (const wk of plan.weeks || [])
    for (const s of wk.sessions || [])
      if (s.steps && s.steps.length && !REP[s.type]) REP[s.type] = s;
}

seedReps(planFor({ experience: "recreational", daysPerWeek: 5, distance: "10k" }));

test("a distance-dialled run comes out at the distance the runner asked for", () => {
  // ⚠️ THE DISTANCE MEANS THE WHOLE OUTING, because the minutes beside it on the same control always
  // have. The first cut sized only the steady body, so 6 km built a 6.7 km session — defensible as the
  // plan generator's named-time rule, and wrong here, because one segmented control would then have
  // held two different meanings with nothing on screen saying so.
  for (const type of ["easy", "long", "recovery"]) {
    if (!REP[type]) continue;
    for (const want of [3, 6, 10, 16]) {
      const s = buildCustomSession({ id: "t", type, unit: "dist", distKm: want, durMin: 40 });
      assert.ok(s, type + " built nothing at " + want + " km");
      assert.ok(Math.abs(km(s) - want) < 0.15,
        type + " asked for " + want + " km and delivered " + km(s).toFixed(2) + " km");
    }
  }
});

test("the title names what was asked for, in the unit it was asked in", () => {
  const d = buildCustomSession({ id: "t", type: "easy", unit: "dist", distKm: 6, durMin: 40 });
  const t = buildCustomSession({ id: "t", type: "easy", unit: "time", distKm: null, durMin: 40 });
  assert.match(d.title, /^6 km /, "distance run titled: " + d.title);
  assert.match(t.title, /^40′ /, "timed run titled: " + t.title);
  // ⚠️ Never the minutes for a distance run: the minutes move with the runner's paces, so the session
  // would silently rename itself after a fitness re-anchor.
  assert.doesNotMatch(d.title, /′/, "a distance run must not be titled in minutes: " + d.title);
});

test("switching units is lossless in both directions", () => {
  // ⚠️ BOTH DIRECTIONS. The first cut only converted minutes into kilometres, and only when the
  // distance was empty. After dialling 7.5 km and switching back, the stepper read 40' beside a chip
  // reading 47' . 7.5 km — two numbers on one screen disagreeing about the same run.
  for (const type of ["easy", "long", "recovery"]) {
    if (!REP[type]) continue;
    for (const durMin of [20, 40, 75]) {
      const timed = buildCustomSession({ id: "t", type, unit: "time", distKm: null, durMin });
      const seeded = builderKmFromMinutes({ type, durMin, unit: "dist" });
      // The seed rounds to the stepper's own 0.5 km granularity — that is the only loss allowed.
      assert.ok(Math.abs(seeded - km(timed)) <= 0.26,
        type + " " + durMin + "' is " + km(timed).toFixed(2) + " km but seeded as " + seeded);

      const back = builderMinutesFromKm({ type, durMin, unit: "dist", distKm: seeded });
      const asDist = buildCustomSession({ id: "t", type, unit: "dist", distKm: seeded, durMin });
      // ...and back rounds to the duration stepper's 5-minute granularity.
      assert.ok(Math.abs(back - secs(asDist) / 60) <= 3,
        type + " " + seeded + " km is " + (secs(asDist) / 60).toFixed(1) + "' but seeded as " + back + "'");
    }
  }
});

test("dialling a bigger distance always gives a bigger run", () => {
  // Monotonicity, because the conversion subtracts the fixed steps' distance and a sign error there
  // would still produce plausible-looking single values.
  for (const type of ["easy", "long", "recovery"]) {
    if (!REP[type]) continue;
    let prev = 0;
    for (const want of [2, 3, 4, 5, 6, 8, 10, 12, 15, 20]) {
      const s = buildCustomSession({ id: "t", type, unit: "dist", distKm: want, durMin: 40 });
      const got = secs(s);
      assert.ok(got > prev, type + ": " + want + " km is not longer than the step before it");
      prev = got;
    }
  }
});

test("an absurdly short ask still leaves real running in it", () => {
  // A distance smaller than the warm-up already covers must not produce a warm-up and nothing else.
  const s = buildCustomSession({ id: "t", type: "easy", unit: "dist", distKm: 0.2, durMin: 40 });
  const body = (s.steps || []).filter((x: any) => x.kind !== "warmup" && x.kind !== "cooldown");
  const bodySec = body.reduce((a: number, x: any) => a + (x.durationSeconds || 0), 0);
  assert.ok(bodySec >= 240, "only " + bodySec + "s of running left in a 0.2 km ask");
});

test("training distance is recomputed, never inherited", () => {
  // ⚠️ `Object.assign({}, rep, ...)` carried the representative's own trainingDistanceMeters through
  // unchanged, so a 20-minute custom run and a 60-minute one reported the same training distance.
  // Nothing on the page reads it today — which is exactly why a wrong value could sit there for good.
  const short = buildCustomSession({ id: "t", type: "easy", unit: "time", distKm: null, durMin: 20 });
  const long = buildCustomSession({ id: "t", type: "easy", unit: "time", distKm: null, durMin: 70 });
  assert.ok(long.trainingDistanceMeters > short.trainingDistanceMeters * 1.5,
    "training distance did not move with duration: " + short.trainingDistanceMeters + " vs " + long.trainingDistanceMeters);
  // And it excludes the preparation, so it is always under the whole-outing figure.
  for (const s of [short, long])
    assert.ok(s.trainingDistanceMeters < s.estimatedDistanceMeters,
      "training distance is not below the outing: " + s.trainingDistanceMeters + " / " + s.estimatedDistanceMeters);
});

test("a session with no paced body is never offered in kilometres", () => {
  // ⚠️ THE GATE, AND IT IS THE ONE THAT MATTERS MOST. The conversion sizes the steady step at the
  // runner's own pace, so a session without one has nothing to convert with — and buildCustomSession
  // falls back to the minutes, leaving someone who dialled 6 km with whatever duration was last set
  // and no sign anything was ignored. A run-walk beginner's session is exactly that: run/walk cycles
  // by feel, deliberately without paces.
  const before = REP;
  try {
    REP = {
      byFeel: { type: "byFeel", steps: [
        { kind: "warmup", durationSeconds: 300 },
        { kind: "rep", durationSeconds: 90 },
        { kind: "recovery", durationSeconds: 90 },
      ], estimatedDurationSeconds: 480, estimatedDistanceMeters: 900 },
    };
    assert.equal(builderCanUseDistance("byFeel"), false, "offered kilometres for a session with no paces");
  } finally { REP = before; }

  // ...while every paced continuous type in a real plan is offered it.
  for (const type of ["easy", "long", "recovery"])
    if (REP[type]) assert.equal(builderCanUseDistance(type), true, type + " should be dialable in km");
});

test("run-walk plans really do produce sessions with no paced body", () => {
  // The gate above is only worth having if the shape it guards against is one the app can reach.
  // ⚠️ Assert the sweep SAW something — a filter that matches nothing passes every assertion after it.
  const plan = planFor({ experience: "beginner", status: "new", daysPerWeek: 3, distance: "5k" });
  let seen = 0, unpaced = 0;
  for (const wk of plan.weeks || [])
    for (const s of wk.sessions || []) {
      if (!s.steps || !s.steps.length) continue;
      seen++;
      if (!s.steps.some((x: any) => x.kind === "steady" && x.targetPaceSecPerKm)) unpaced++;
    }
  assert.ok(seen > 20, "the beginner sweep measured almost nothing: " + seen + " sessions");
  assert.ok(unpaced > 0, "no unpaced session found in a beginner plan — the gate guards nothing");
});

test("a stale distance cannot survive a switch back to time", () => {
  // builderParams is the single normalisation point; assert the shape it produces rather than trusting
  // three call sites to remember. A session built with unit "time" must ignore any distKm left behind.
  const withStale = buildCustomSession({ id: "t", type: "easy", unit: "time", distKm: null, durMin: 40 });
  const clean = buildCustomSession({ id: "t", type: "easy", durMin: 40 });
  assert.equal(secs(withStale), secs(clean));
  assert.match(withStale.title, /^40′ /);
});

test("the reps types are untouched by any of this", () => {
  // Distance never reaches a reps-based session, so those must build exactly as before.
  seedReps(planFor({ experience: "recreational", daysPerWeek: 5, distance: "10k" }));
  for (const type of ["threshold", "vo2"]) {
    if (!REP[type]) continue;
    assert.equal(builderUsesRepsCheck(type), true);
    const a = buildCustomSession({ id: "t", type, reps: 5 });
    const b = buildCustomSession({ id: "t", type, reps: 5, unit: "dist", distKm: 12 });
    assert.equal(secs(a), secs(b), type + " changed when a distance was passed to a reps session");
  }
});

function builderUsesRepsCheck(t: string) { return ["threshold", "vo2", "race-specific"].includes(t); }

test("the paces the builder reads are the ones the engine derives", () => {
  // Guards the fixture, not the feature: if `extraRep` ever stopped returning paced steps this whole
  // file would go quietly green on sessions it never actually converted.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 25 * 60 });
  assert.ok(paces.easy.minSecPerKm > 0 && paces.easy.maxSecPerKm > paces.easy.minSecPerKm);
  assert.ok(Object.keys(REP).length >= 3, "only " + Object.keys(REP).length + " representative types seeded");
});
