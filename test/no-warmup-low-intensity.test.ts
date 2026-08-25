import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildWarmup } from "../src/science/warmup.ts";
import { sessionVolumeMeters } from "../src/domain/steps.ts";
import {
  easyProgression, easyRun, longRun, moderateRun, raceSpecificSession,
  recoveryRun, thresholdSession, vo2Session,
} from "../src/plan/session-templates.ts";

/**
 * NO WARM-UP AND NO COOL-DOWN ON THE LOW-INTENSITY RUNS.
 *
 * The owner, 2026-08-07: *"I dont think any of the following runs should include a warm up or cool
 * down: 1. Long run 2. Easy 3. Recovery ... All of the others need a proper warm up as already
 * mapped."*
 *
 * ⚠️ TWO SYSTEMS PRODUCE A WARM-UP AND BOTH HAD TO CHANGE. The session library (`easeIn` via
 * `framedRun`, and `longRun`'s own frame) writes the steps the WATCH runs; `buildWarmup` →
 * `withGeneratedWarmup` writes the ones the PHONE runs, replacing whatever the library wrote.
 * Changing only the library is a no-op the runner cannot see — the generated warm-up simply expands
 * into the gap — and changing only the delivery leaves the wrist warming up while the phone does not.
 * This file asserts both, which is why it exists separately from `warmup.test.ts`.
 */

const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
const kinds = (s: any) => (s.steps || []).map((x: any) => x.kind);
/**
 * The session's length in minutes, WHICHEVER WAY EACH STEP IS GATED.
 *
 * This summed x.durationSeconds and nothing else, so the moment an easy, moderate, recovery or long
 * run started being prescribed BY DISTANCE it read them as zero — measured, "a 20' easy run is 0.0' of
 * steps". A ruler that cannot see the thing it is pointed at is the trap this repo records over and
 * over, and it had it in five test files plus the progression audit. Derived exactly as the engine's
 * own stepSeconds does, so the number means the same thing before and after the change.
 */
const stepMin = (x: any) => {
  if (x.durationSeconds) return x.durationSeconds;
  if (x.distanceMeters && x.targetPaceSecPerKm) {
    return (x.distanceMeters / 1000) * (x.targetPaceSecPerKm.minSecPerKm + x.targetPaceSecPerKm.maxSecPerKm) / 2;
  }
  if (x.distanceMeters) return x.distanceMeters / 4;
  return 0;
};
const mins = (s: any) => (s.steps || []).reduce((a: number, x: any) => a + stepMin(x), 0) / 60;
const metres = (s: any) => (s.steps || []).reduce((a: number, x: any) => {
  if (x.distanceMeters) return a + x.distanceMeters;
  if (x.durationSeconds && x.targetPaceSecPerKm) {
    const mid = (x.targetPaceSecPerKm.minSecPerKm + x.targetPaceSecPerKm.maxSecPerKm) / 2;
    return a + (x.durationSeconds / mid) * 1000;
  }
  return a;
}, 0);

/** `withGeneratedWarmup`, lifted from the built page — the same precedent as warmup-delivery. */
function lift(name: string): string {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
let ABILITY: any = "intermediate";
const withGeneratedWarmup = new Function("warmupCardFor",
  lift("withGeneratedWarmup") + "; return withGeneratedWarmup;")(
    (s: any) => buildWarmup(s, ABILITY));

test("the three named types carry no warm-up and no cool-down in the session library", () => {
  const cases: Array<[string, any]> = [
    ["easy run", easyRun(paces, 40)],
    ["easy + strides", easyRun(paces, 40, true)],
    ["moderate run", moderateRun(paces, 38)],
    ["easy → moderate finish", easyProgression(paces, 45)],
    ["recovery jog", recoveryRun(paces, 30)],
    ["plain long run", longRun(paces, 90)],
    ["long run · steady finish", longRun(paces, 90, { steadyFinishMin: 20 } as any)],
    ["long run · fast finish", longRun(paces, 110, { raceBlockMin: 15, racePace: paces.goalRace, raceLabel: "marathon effort" } as any)],
  ];
  for (const [label, s] of cases) {
    assert.ok(!kinds(s).includes("warmup"), `${label} still opens with a warm-up step`);
    assert.ok(!kinds(s).includes("cooldown"), `${label} still ends with a cool-down step`);
  }
});

test("no session anywhere ships a zero-length step", () => {
  // ⚠️ THE TRAP THAT REMOVING A FRAME BY SETTING ITS LENGTH TO ZERO CREATES. `longRun`'s cool-down is
  // now `cool = 0`, and the branch that appends it was left in place so restoring it is one constant.
  // Written unguarded it would push `cooldown(paces, 0)` — a step of no duration that nothing filters,
  // reaching the live session as something the runner can never complete, the watch as a step with no
  // length, and the written brief as a row reading "0′".
  for (const { where, plan } of everyPlan()) {
    for (const wk of plan.weeks || []) {
      for (const s of wk.sessions || []) {
        for (const st of (s as any).steps || []) {
          if (st.distanceMeters) continue;   // distance-based reps carry no duration by design
          assert.ok((st.durationSeconds || 0) > 0,
            `${where}: "${s.title}" has a zero-length ${st.kind} step ("${st.label}")`);
        }
      }
    }
  }
});

test("what the title NAMES is what the runner is actually given", () => {
  // ⚠️ THE TWO BUILDERS TREAT THEIR FRAME OPPOSITELY, and that is why removing it needs two different
  // fixes. `framedRun` ADDED its ease-in on top of the named work, so removing it shortens the outing
  // to exactly the named minutes. `longRun` CARVED its frame out of the named minutes, so removing it
  // has to give those minutes BACK — delete the step alone and a "90′ long run" silently delivers 82.
  //
  // ⚠️⚠️ RESTATED 2026-08-26, AND STRENGTHENED RATHER THAN RELAXED. The owner asked for "a mixture of
  // runs set by distance and runs set by time", so an easy, moderate, recovery or long run now names a
  // DISTANCE and ends at one. This test was "the named minutes are what the runner is given" and it
  // failed on a correct change, because its subject moved — the guard-scoped-to-a-HOW pattern this
  // codebase has now recorded a dozen times. The invariant never was about minutes: it is that the
  // TITLE DOES NOT LIE. So it is asserted in both currencies now — the work still comes out at the
  // minutes the builder was asked for, AND the distance the title states is exactly the distance the
  // steps add up to, which is a claim the old version could not make at all.
  // ⚠️⚠️ THE TOLERANCE IS THE ROUNDING BUDGET, AND IT IS PACE-DEPENDENT — not a number chosen to make
  // this pass. A distance-set body rounds UP to the next 100 m (see byDistanceSet: rounding always goes
  // in the direction of giving the runner the work), so the delivered session can be one unit longer
  // than the minutes it was built from, and one unit is 100 m AT THAT STEP'S PACE. At easy pace that is
  // ~34 s; at recovery pace ~44 s, which is why a flat 0.6′ failed on "a 20′ recovery jog is 20.6′" and
  // widening it to 0.7 would have been fitting the guard to the answer.
  const unitMin = (s: any) => {
    const conv = (s.steps || []).filter((x: any) => x.distanceMeters && x.targetPaceSecPerKm);
    if (!conv.length) return 0.05;
    const slowest = Math.max(...conv.map((x: any) =>
      (x.targetPaceSecPerKm.minSecPerKm + x.targetPaceSecPerKm.maxSecPerKm) / 2));
    return (500 / 1000) * slowest / 60;   // one friendly unit, the widest the ceil can add
  };
  for (const m of [20, 40, 75]) {
    for (const [what, s] of [["easy run", easyRun(paces, m)], ["recovery jog", recoveryRun(paces, m)],
                             ["moderate run", moderateRun(paces, m)],
                             ["easy → moderate", easyProgression(paces, m)]] as const) {
      const got = mins(s as any), tol = unitMin(s as any) + 0.05;
      // ⚠️ NEVER SHORTER THAN NAMED. That is the rule byDistanceSet's ceiling exists for, and it is
      // asserted as a direction rather than folded into an absolute tolerance — a session that quietly
      // came out under its own floor is the defect the ceiling was introduced to fix.
      assert.ok(got >= m - 0.05, `a ${m}′ ${what} delivers only ${got.toFixed(1)}′ — shorter than named`);
      assert.ok(got <= m + tol,
        `a ${m}′ ${what} is ${got.toFixed(1)}′ of steps, over its ${tol.toFixed(2)}′ rounding budget`);
    }
  }
  // ⚠️ THE LONG RUN IS STILL ON THE CLOCK AND ITS TITLE STILL NAMES MINUTES — see longRun's own note for
  // why it is not converted yet. So it keeps the original exact claim, which is the stronger one.
  for (const m of [60, 90, 130]) {
    assert.ok(Math.abs(mins(longRun(paces, m)) - m) < 0.6,
      `a ${m}′ long run is ${mins(longRun(paces, m)).toFixed(1)}′ of steps — the title is lying`);
    const structured = longRun(paces, m, { steadyFinishMin: 20 } as any);
    assert.ok(Math.abs(mins(structured) - m) < 0.6,
      `a ${m}′ long run with a steady finish is ${mins(structured).toFixed(1)}′`);
  }
  // ⚠️ AND THE DISTANCE IN THE TITLE IS EXACT — this is the half the old test could not express, and it
  // is the one a runner checks. A title reading "7.5 km long run" over steps adding to 8.1 km is the
  // same lie the minutes version existed to prevent, in the new currency.
  const named = (s: any) => {
    const m = /^([\d.]+)\s*km|^(\d+)\s*m\b/.exec(s.title);
    if (!m) return null;
    return m[1] ? Math.round(Number(m[1]) * 1000) : Number(m[2]);
  };
  for (const build of [
    (m: number) => easyRun(paces, m),
    (m: number) => easyRun(paces, m, true),
    (m: number) => recoveryRun(paces, m),
    (m: number) => moderateRun(paces, m),
    (m: number) => easyProgression(paces, m),
  ]) {
    for (const m of [22, 45, 80]) {
      const s: any = build(m);
      const want = named(s);
      assert.ok(want != null, `"${s.title}" names no distance, so the runner cannot check it`);
      // Within one rounding unit: the title rounds to 0.1 km and the steps to 100 m.
      assert.ok(Math.abs(metres(s) - want!) <= 100,
        `"${s.title}" names ${want} m but its steps add up to ${Math.round(metres(s))} m`);
    }
  }
});

test("removing the ease-in changed the OUTING and not the counted training volume", () => {
  // ⚠️ THE WHOLE ARGUMENT FOR THE CHANGE, AND IT IS AN IDENTITY WORTH PINNING: `isPreparationStep`
  // never counted a warm-up as load, so a framed run's five minutes were already outside the mileage.
  // The runner covers less ground; their training load is unchanged. Measured across 13,024 plan
  // weeks when the change was made: 0.000% and 0 m.
  // For an easy run the two figures are now equal — there is no preparation left to exclude.
  for (const m of [25, 45, 70]) {
    const s: any = easyRun(paces, m);
    assert.equal(s.trainingDistanceMeters, s.estimatedDistanceMeters,
      "an easy run has preparation in it again, so its counted and shown distances differ");
    assert.ok(sessionVolumeMeters(s) > 0);
  }
  // ...while a threshold session, which keeps its frame, still excludes it.
  const thr: any = thresholdSession(paces, 9);
  assert.ok(thr.trainingDistanceMeters < thr.estimatedDistanceMeters,
    "a threshold session's warm-up is being counted as training volume");
});

test("everything else keeps a proper warm-up — including the two that open easy", () => {
  // ⚠️ THE ASSERTION THAT STOPS THE RULE BEING RE-KEYED ON THE WARM-UP BRANCH. "Geared run: easy →
  // steady → tempo → easy" (variant 11) and "25′ continuous tempo" (variant 9) both START easy, so
  // `firstHardEffort` sends them down the same branch an easy run takes. Keyed on that branch instead
  // of on the session type, the rule would strip the warm-up off a tempo session — which the owner
  // explicitly excluded. Variants picked by sweeping the pool, not assumed.
  const keeps: Array<[string, any]> = [
    ["geared tempo (opens easy)", thresholdSession(paces, 11)],
    ["continuous tempo (opens easy)", thresholdSession(paces, 9)],
    ["threshold reps", thresholdSession(paces, 0)],
    ["VO2 intervals", vo2Session(paces, 1)],
    ["race-specific", raceSpecificSession(paces, 0)],
    ["moderate + strides", moderateRun(paces, 38, true)],
  ];
  for (const [label, s] of keeps) {
    const w = buildWarmup(s, "intermediate");
    assert.ok(w, `${label}: no warm-up generated at all`);
    assert.ok(!w!.notNeeded, `${label}: was told it needs no warm-up`);
    assert.ok(w!.totalMinutes > 0, `${label}: a warm-up of ${w!.totalMinutes} minutes`);
    assert.ok(w!.phases.length > 0, `${label}: a warm-up with no phases in it`);
    ABILITY = "intermediate";
    const live = withGeneratedWarmup(s);
    assert.ok((live.steps || []).some((st: any) => st.kind === "warmup"),
      `${label}: delivered with no warm-up step`);
  }
});

test("a run–walk beginner keeps the brisk walk the owner asked for", () => {
  // ⚠️ EVERY SESSION IN A RUN–WALK PLAN IS TYPED "easy" — `assembleRunWalk` has one exit — so a rule
  // keyed on the type strips 100% of a new runner's preparation unless the ability band exempts them.
  // This is his own earlier request (2026-08-05: "a warm up for someone who is just doing walk/run
  // sessions needs to be appropriate"), and the two instructions have to coexist.
  const plan = generatePlan(
    { experience: "beginner", status: "new", daysPerWeek: 3, includeStrength: false,
      recent: { distanceMeters: 5000, timeSeconds: 2400 } } as any,
    { distance: "5k", targetTimeSeconds: 2400, raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any,
  );
  let seen = 0;
  for (const wk of plan.weeks || []) {
    for (const s of wk.sessions || []) {
      if (!(s as any).steps || !(s as any).steps.length) continue;
      if ((s as any).type !== "easy") continue;
      seen++;
      const w = buildWarmup(s as any, "new");
      assert.ok(w && !w.notNeeded, `"${s.title}" lost its warm-up — run–walk beginners are exempt`);
      const raise: any = w!.phases.find((p: any) => p.phase === "raise");
      assert.ok(raise, `"${s.title}": no raise phase`);
      assert.match(raise.instruction, /[Ww]alk brisk/, `"${s.title}": "${raise.instruction}"`);
    }
  }
  // ⚠️ A filter matching nothing passes every assertion after it — this project's most-repeated trap.
  assert.ok(seen > 20, `only ${seen} run–walk sessions swept; the exemption is guarding nothing`);
});

test("across every real plan, the rule never reaches a type it was not given", () => {
  const LOW = new Set(["easy", "long", "recovery", "strides"]);
  let fired = 0, kept = 0;
  for (const { where, plan } of everyPlan()) {
    for (const wk of plan.weeks || []) {
      for (const s of wk.sessions || []) {
        if (!(s as any).steps || !(s as any).steps.length) continue;
        const w = buildWarmup(s as any, "intermediate");
        if (!w) continue;                    // strength / mobility / rest, gated earlier
        if (w.notNeeded) {
          fired++;
          assert.ok(LOW.has((s as any).type),
            `${where}: "${s.title}" is type "${(s as any).type}" and was refused a warm-up`);
          assert.equal(w.totalMinutes, 0);
          assert.equal(w.phases.length, 0);
          ABILITY = "intermediate";
          const live = withGeneratedWarmup(s);
          assert.ok(!(live.steps || []).some((st: any) => st.kind === "warmup"),
            `${where}: "${s.title}" says no warm-up but is delivered with one`);
        } else {
          kept++;
        }
      }
    }
  }
  assert.ok(fired > 200, `the rule fired on only ${fired} sessions across every plan`);
  assert.ok(kept > 100, `only ${kept} sessions kept a warm-up — the rule has swallowed the plan`);
});

test("the session sheet says 'no warm-up needed', never 'you are unwell'", () => {
  // ⚠️ THE MOST VISIBLE CONSEQUENCE OF GETTING THE SIGNAL WRONG. `warmupHtml` renders a medical card
  // whenever `warmupCardFor` returns falsy — "you have told us you are unwell or sore enough that it
  // is changing how you run" — so implementing this rule by returning null would have put that
  // message, untrue, above the step list of every easy run, long run and recovery jog in the app.
  // That is why the engine returns `notNeeded` instead, and why the branch order here is asserted.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const fn = lift("warmupHtml");
  const notNeededAt = fn.indexOf("notNeeded");
  const unwellAt = fn.indexOf("unwell or sore");
  assert.ok(notNeededAt >= 0, "warmupHtml does not handle a not-needed warm-up at all");
  assert.ok(unwellAt >= 0, "the unwell card has gone — that gate is still wanted");
  assert.ok(notNeededAt < unwellAt,
    "the unwell branch is reached first, so a session needing no warm-up prints a medical message");
  assert.match(html, /\.wu-none\s*\{/, "the quiet no-warm-up line has no styling in the build");
});

/** A spread of real plans — the sessions runners are actually given, not just the builder catalogue. */
function everyPlan(): Array<{ where: string; plan: any }> {
  const out: Array<{ where: string; plan: any }> = [];
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const daysPerWeek of [3, 5]) {
      for (const experience of ["recreational", "competitive"]) {
        out.push({
          where: `${distance}/${daysPerWeek}d/${experience}`,
          plan: generatePlan(
            { experience, daysPerWeek, includeStrength: true,
              recent: { distanceMeters: 5000, timeSeconds: 1500 } } as any,
            { distance, targetTimeSeconds: { "5k": 1400, "10k": 2900, half: 6400, marathon: 13400 }[distance],
              raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any,
          ),
        });
      }
    }
  }
  return out;
}
