// Guards for the ideas taken from the commissioned programme-engine handoff
// (`INTERUNENGINEHANDOFF.md`, a Swift specification the owner asked to mine for ideas rather than
// port wholesale: "take the ideas not the swift if we dont need it").
//
// Three ideas are implemented here and each one was chosen because a MEASUREMENT showed the engine
// wanted it, not because the document said so. What the document contributed was the shape of the
// fix and the evidence behind it. Every other idea in the spec was either already honoured under
// another name, deliberately rejected in this repo with reasons on record, or measured and found not
// to be worth its risk — see CLAUDE.md for the full read-across.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, RaceDistanceKey, RecentPerformance } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import {
  QUALITY_WORK_CAP_SEC,
  formatWorkSec,
  raceSpecificSession,
  strengthSession,
  thresholdSession,
  vo2Session,
} from "../src/plan/session-templates.ts";
import {
  MARATHON_CORRECTION_MIN_M,
  deriveTrainingPaces,
  marathonCorrection,
  predictRaceTime,
  predictRaceTimeWithEndurance,
} from "../src/science/paces.ts";
import { assessReadiness } from "../src/readiness/readiness.ts";
import { RACE_DISTANCES_M } from "../src/domain/units.ts";
import { readFileSync } from "node:fs";

const RUN_TYPES = ["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"];
const ALL_DISTANCES = Object.keys(RACE_DISTANCES_M) as RaceDistanceKey[];

/** Training minutes, in the currency the plan is built in and the spec's rule 5 requires. */
function weekMinutes(week: { sessions: Array<Record<string, unknown>> }): number {
  let sec = 0;
  for (const s of week.sessions as Array<{ type: string; steps?: unknown[]; estimatedDurationSeconds: number }>) {
    if (!RUN_TYPES.includes(s.type)) continue;
    const steps = (s.steps ?? []) as Array<{
      kind?: string; durationSeconds?: number; distanceMeters?: number;
      targetPaceSecPerKm?: { minSecPerKm: number; maxSecPerKm: number };
    }>;
    if (!steps.length) { sec += s.estimatedDurationSeconds; continue; }
    for (const st of steps) {
      if (st.kind === "warmup" || st.kind === "cooldown") continue;
      if (st.durationSeconds) { sec += st.durationSeconds; continue; }
      if (st.distanceMeters && st.targetPaceSecPerKm) {
        const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
        sec += (st.distanceMeters / 1000) * mid; continue;
      }
      if (st.distanceMeters) sec += st.distanceMeters / 4;
    }
  }
  return sec / 60;
}

const runner = (o: Partial<Athlete> & { fiveK: number }): Athlete => ({
  daysPerWeek: o.daysPerWeek ?? 5,
  recent: { distanceMeters: 5000, timeSeconds: o.fiveK },
  experience: o.experience ?? "recreational",
  includeStrength: true,
  longRunDay: 6,
  ...o,
});

/** A race date `weeks` after the start, in UTC. The plan's length is set by this and nothing else. */
function raceDateFor(startIso: string, weeks: number): string {
  const d = new Date(startIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7 - 1);
  return d.toISOString().slice(0, 10);
}

const START = "2026-09-07";   // a Monday, so no pro-rata first week muddies a comparison
const goalFor = (distance: RaceDistanceKey, fiveK: number, weeks: number): Goal => ({
  distance,
  targetTimeSeconds: fiveK * (RACE_DISTANCES_M[distance] / 5000) ** 1.06,
  raceDateIso: raceDateFor(START, weeks),
  startDateIso: START,
});

// ---------------------------------------------------------------------------------------------
// 1. The marathon endurance correction
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the endurance correction is an identity at every distance under 30 km", () => {
  // ⚠️ THE POINT OF THE GUARD IS THE DISTANCES IT DOES **NOT** TOUCH. A marathon fix that silently
  // moved the 5 km or half prediction would change `paces.predictedRaceTimes`, the feasibility
  // verdict and every blank-goal derivation for three other events — and nothing else in the suite
  // asserts a marathon time, so it would ship unnoticed. Swept over the real distance table rather
  // than a hand-written list, so a distance added later is covered by construction.
  const recent: RecentPerformance = { distanceMeters: 5000, timeSeconds: 1500 };
  const ctx = { weeklyMinutes: 120, longestRunMinutes: 60 };   // the hungriest band, +6%
  let touched = 0;
  for (const d of ALL_DISTANCES) {
    const base = predictRaceTime(recent, d);
    const corrected = predictRaceTimeWithEndurance(recent, d, ctx);
    if (RACE_DISTANCES_M[d] < MARATHON_CORRECTION_MIN_M) {
      assert.equal(corrected, base, `${d} is under 30 km and must be untouched by the correction`);
    } else {
      touched++;
      assert.ok(corrected > base, `${d} is at or over 30 km and must be corrected upward`);
    }
  }
  assert.ok(touched >= 1, "the sweep found no distance at or above 30 km — it is proving nothing");
});

test("BLOCKER: with no training context the correction cannot fire at all", () => {
  // A caller that cannot answer "how much are they training?" must get the uncorrected answer.
  // Guessing +6% for a 120 km/week runner would be worse than not correcting.
  const recent: RecentPerformance = { distanceMeters: 5000, timeSeconds: 1500 };
  for (const d of ALL_DISTANCES) {
    assert.equal(predictRaceTimeWithEndurance(recent, d), predictRaceTime(recent, d),
      `${d} moved without a context being supplied`);
  }
});

test("the correction is keyed on TRAINING, not on ability, and only ever slows a prediction down", () => {
  // ⚠️ KEYED ON TRAINING IS THE WHOLE IDEA. A fast runner on low mileage is exactly as
  // over-predicted at 42 km as a slow one; what protects you is the volume and the long runs. So a
  // 15:00 5 km runner training 120 minutes a week gets the same correction as a 40:00 one.
  const fast: RecentPerformance = { distanceMeters: 5000, timeSeconds: 900 };
  const slow: RecentPerformance = { distanceMeters: 5000, timeSeconds: 2400 };
  const low = { weeklyMinutes: 120, longestRunMinutes: 60 };
  const ratio = (r: RecentPerformance) =>
    predictRaceTimeWithEndurance(r, "marathon", low) / predictRaceTime(r, "marathon");
  assert.ok(Math.abs(ratio(fast) - ratio(slow)) < 1e-9,
    "the correction differs by ability — it must read training, not pace");

  // Three bands, and the direction is one-way: a correction may slow a prediction, never quicken it.
  assert.equal(marathonCorrection({ weeklyMinutes: 420, longestRunMinutes: 160 }), 0);
  assert.equal(marathonCorrection({ weeklyMinutes: 300, longestRunMinutes: 120 }), 0.03);
  assert.equal(marathonCorrection({ weeklyMinutes: 120, longestRunMinutes: 60 }), 0.06);
  // ⚠️ VOLUME ALONE IS NOT ENOUGH FOR THE ZERO BAND. A runner on 420 minutes a week whose longest
  // run is an hour has the volume and not the durability, and it is the long run that the last
  // 12 km of a marathon asks about.
  assert.equal(marathonCorrection({ weeklyMinutes: 420, longestRunMinutes: 90 }), 0.03,
    "high volume with a short long run must not reach the no-correction band");
  for (const w of [0, 100, 239, 240, 399, 400, 800])
    for (const lr of [0, 60, 149, 150, 300])
      assert.ok(marathonCorrection({ weeklyMinutes: w, longestRunMinutes: lr }) >= 0,
        `a negative correction would make a prediction FASTER (${w} min, ${lr} min long run)`);
});

test("BLOCKER: the endurance correction is REACHABLE — a runner's plan can actually receive it", () => {
  // ⚠️⚠️ I SHIPPED THIS FUNCTION WIRED TO NOTHING, WHICH IS THE COMPUTED-AND-DISCARDED TRAP THIS REPO
  // RECORDS FIVE TIMES OVER (CLASS, MASTERS, PLAN.notes, refreshTypePreview, assessWeeklyJump). It was
  // written, typechecked, unit-tested and pushed, and it changed no plan at all — every existing guard
  // above passes against a function nobody calls. A test that a thing WORKS is not a test that
  // anything USES it.
  //
  // The claim here is end-to-end and in both directions: the engine's derivation must be exported to
  // the app bundle, the app must call it where a blank goal becomes a number, and no blank-goal branch
  // may go back to open-coding a Riegel projection of its own.
  const entry = readFileSync(new URL("../web/entry.ts", import.meta.url), "utf8");
  assert.ok(/deriveGoalTimeSeconds/.test(entry),
    "deriveGoalTimeSeconds is not exported to the app bundle, so the page cannot reach it");

  const app = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");
  const calls = (app.match(/RC\.deriveGoalTimeSeconds\(/g) ?? []).length;
  assert.equal(calls, 1, `the page should reach the engine's derivation through exactly one helper, found ${calls}`);
  const wired = (app.match(/targetS = derivedGoalS\(/g) ?? []).length;
  assert.equal(wired, 2, `both blank-goal branches must use the helper, found ${wired}`);
  // ⚠️ AND NO BRANCH MAY DERIVE A GOAL ITSELF. This is the shape that was there before — an
  // uncorrected Riegel projection assigned straight to the target — and it is what the helper exists
  // to replace, so its return is the thing to forbid rather than the function.
  assert.ok(!/targetS\s*=\s*Math\.round\(RC\.riegelPredict/.test(app),
    "a blank-goal branch open-codes a Riegel projection again, so the correction is bypassed");

  // And the feasibility verdict must read the same corrected prediction, or the app holds two
  // opinions about one marathon: a derived 4:14 target beside "your fitness predicts 3:59".
  const feas = readFileSync(new URL("../src/plan/feasibility.ts", import.meta.url), "utf8");
  assert.ok(/predictRaceTimeWithEndurance/.test(feas),
    "assessFeasibility reads the uncorrected prediction while a derived goal carries the correction");
});

test("an absent longest run reads volume alone rather than assuming the worst", () => {
  // ⚠️ ABSENCE IS NOT ZERO. At setup there is no logged history, so treating "not asked yet" as "their
  // longest run is nothing" would put a 120 km/week runner in the +6% band — over-correcting exactly
  // the runner the correction exists to leave alone. A KNOWN short long run is different: that is real
  // evidence against durability and holds them in the middle band.
  assert.equal(marathonCorrection({ weeklyMinutes: 500 }), 0,
    "a high-volume runner with no long-run figure is being corrected as though they had none");
  assert.equal(marathonCorrection({ weeklyMinutes: 500, longestRunMinutes: 90 }), 0.03,
    "a known short long run must still hold a high-volume runner in the middle band");
  assert.equal(marathonCorrection({ weeklyMinutes: 120 }), 0.06,
    "a low-volume runner with no long-run figure must still be corrected");
});

// ---------------------------------------------------------------------------------------------
// 2. The plyometric dose, and the load as data
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the delivered weekly plyometric dose reaches the evidenced band", () => {
  // ⚠️ THE OLD DOSE WAS A THIRD OF IT AND ONLY A MEASUREMENT COULD SEE THAT, because the count was
  // implied by sets x reps in a prose description rather than stated as a number. Evidence: 31
  // studies and 652 runners — heavy lifting alone moved performance ES -0.47, heavy lifting COMBINED
  // with plyometrics ES -1.04, which is the best-evidenced strength intervention there is for
  // runners. Bands from the handoff: 60-100 contacts a week developing, 100-150 trained.
  const contactsIn = (week: { sessions: Array<{ type: string; exercises?: Array<{ contacts?: number }> }> }) =>
    week.sessions.filter((s) => s.type === "strength")
      .reduce((a, s) => a + (s.exercises ?? []).reduce((x, e) => x + (e.contacts ?? 0), 0), 0);

  for (const [experience, band] of [["recreational", [60, 100]], ["competitive", [100, 150]]] as const) {
    const plan = generatePlan(runner({ fiveK: 1500, experience }), goalFor("half", 1500, 20), { startDateIso: START });
    const loading = plan.weeks.filter((w) => !w.isDeload && w.phase === "build");
    assert.ok(loading.length >= 3, `only ${loading.length} loading build weeks — the sweep proves little`);
    for (const w of loading) {
      const c = contactsIn(w);
      assert.ok(c >= band[0] && c <= band[1],
        `${experience} build week ${w.index} delivers ${c} ground contacts, outside the evidenced ${band[0]}-${band[1]}`);
    }
    // A trained runner must get MORE than a developing one, or the experience input is decoration.
    if (experience === "competitive") {
      const dev = generatePlan(runner({ fiveK: 1500, experience: "recreational" }), goalFor("half", 1500, 20), { startDateIso: START });
      const devWk = dev.weeks.find((w) => !w.isDeload && w.phase === "build")!;
      assert.ok(contactsIn(loading[0]!) > contactsIn(devWk),
        "a trained runner's plyometric dose is no larger than a developing runner's");
    }
  }
});

test("plyometrics stay out of the base phase and out of maintenance weeks, and the load is only claimed where it is meant", () => {
  // The repo's own reasoning, unchanged: jumps are introduced once faster running is tolerated
  // without a delayed reaction, and a maintenance week near the race keeps the load and drops the
  // volume. Raising the DOSE must not smuggle jumps into either.
  const contacts = (phase: "base" | "build" | "peak" | "taper", maint: boolean, competitive: boolean) =>
    (strengthSession(phase, maint, { competitive }).exercises ?? []).reduce((a, e) => a + (e.contacts ?? 0), 0);
  for (const competitive of [false, true]) {
    assert.equal(contacts("base", false, competitive), 0, "the base phase gained plyometrics");
    for (const phase of ["peak", "taper"] as const)
      assert.equal(contacts(phase, true, competitive), 0, `a ${phase} maintenance week gained plyometrics`);
    assert.ok(contacts("build", false, competitive) > 0, "the build phase lost its plyometrics");
  }
  // ⚠️ THE LOAD IS DATA, NOT PROSE, AND ONLY WHERE A LOAD IS GENUINELY PRESCRIBED. It is the one
  // number in the session that decides whether it works: ">= 80% 1RM" improved economy and
  // performance, while submaximal and isometric work produced nothing at all.
  const heavy = strengthSession("build", false, {}).exercises ?? [];
  const loaded = heavy.filter((e) => e.loadPercent1RM);
  assert.ok(loaded.length >= 3, "no barbell lift carries a stated load");
  assert.ok(loaded.every((e) => /80%/.test(e.loadPercent1RM!)),
    "a heavy session's stated load is not the evidenced >= 80% 1RM");
  const technique = strengthSession("base", false, {}).exercises ?? [];
  assert.ok(technique.some((e) => e.loadPercent1RM && !/80%/.test(e.loadPercent1RM)),
    "a technique-phase session claims a heavy load it does not prescribe");
  // A hold or a jump prescribes no percentage of a one-rep max.
  for (const e of heavy)
    if (/plank|hop|jump/i.test(e.name))
      assert.equal(e.loadPercent1RM, undefined, `${e.name} carries a %1RM, which is meaningless for it`);
});

// ---------------------------------------------------------------------------------------------
// 3. The quality-session cost cap
// ---------------------------------------------------------------------------------------------

test("BLOCKER: no quality session costs a runner more than the cap, at any ability", () => {
  // ⚠️ THE DEFECT THIS CATCHES, MEASURED BEFORE THE FIX: a 40:00 5 km runner training three days a
  // week was handed "Ladder: 1-2-3-4-3-2-1 km / equal jog" as one of that week's three runs —
  // **176 minutes**, 16 km of work plus 16 km of jog, LONGER THAN THEIR OWN LONG RUN. It put the
  // week 1.55x over its trailing four-week mean and dropped it to 66% easy, breaching the
  // progression guardrail and the intensity floor at once. A hand-authored format has a fixed
  // structure, so its cost in MINUTES is whatever the runner's own pace makes it.
  let worst = 0;
  let worstWho = "";
  let n = 0;
  for (const fiveK of [900, 1500, 2100, 2400])
    for (const daysPerWeek of [3, 5])
      for (const experience of ["recreational", "competitive"] as const)
        for (const distance of ["5k", "half", "marathon"] as RaceDistanceKey[]) {
  // ⚠️ THERE IS NO `isPartial` FIELD ON `PlannedWeek`, AND AN EARLIER VERSION OF THIS SWEEP FILTERED
  // ON ONE. `PlannedWeek` is `{ index, startDateIso, phase, isDeload, focus, sessions,
  // plannedDistanceMeters, qualitySessionCount }` — so `!w.isPartial` is `!undefined`, always true,
  // and filtered nothing. tsc caught it here; a plain .mjs probe has no typechecking and would not
  // have. What makes the measurement sound instead is starting the plan on a MONDAY: the pro-rata
  // first week exists because `applyPartialFirstWeek` trims week 1 before the start date, and there
  // is nothing to trim when the start date is already the week's Monday.
          const plan = generatePlan(runner({ fiveK, daysPerWeek, experience }), goalFor(distance, fiveK, 20), { startDateIso: START });
          for (const w of plan.weeks) {
            for (const s of w.sessions) {
              if (!["threshold", "vo2", "race-specific"].includes(s.type)) continue;
              n++;
              // The work-and-recovery portion, i.e. everything between the warm-up and cool-down.
              let sec = 0;
              for (const st of s.steps ?? []) {
                if (st.kind === "warmup" || st.kind === "cooldown") continue;
                if (st.durationSeconds) { sec += st.durationSeconds; continue; }
                if (st.distanceMeters && st.targetPaceSecPerKm) {
                  const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
                  sec += (st.distanceMeters / 1000) * mid; continue;
                }
                if (st.distanceMeters) sec += st.distanceMeters / 4;
              }
              if (sec > worst) { worst = sec; worstWho = `${distance} ${daysPerWeek}d ${(fiveK / 60) | 0}min5k ${experience} wk${w.index} "${s.title}"`; }
            }
          }
        }
  assert.ok(n > 500, `only ${n} quality sessions measured — the sweep is too small to prove anything`);
  assert.ok(worst <= QUALITY_WORK_CAP_SEC + 1,
    `a quality session costs ${(worst / 60).toFixed(0)} min against a ${(QUALITY_WORK_CAP_SEC / 60).toFixed(0)} min cap — ${worstWho}`);
  // ⚠️⚠️ AND AN ABSOLUTE BOUND, BECAUSE THE LINE ABOVE SCALES WITH THE CONSTANT IT IS CHECKING.
  // Watched escaping: raising `QUALITY_WORK_CAP_SEC` to 200 minutes let the original 176-minute
  // ladder straight back in and the assertion above still passed, because it compares the outcome to
  // the very number that was loosened. A guard that moves with the thing it guards is not one. The
  // ceiling here is the measured evidence rather than the shipped value: the recorded sweep shows a
  // 90-minute cap already refuses only the three genuinely absurd formats, so any constant above
  // that is knowingly readmitting a session nobody would prescribe.
  const EVIDENCED_CEILING_SEC = 90 * 60;
  assert.ok(QUALITY_WORK_CAP_SEC <= EVIDENCED_CEILING_SEC,
    `the cap is ${(QUALITY_WORK_CAP_SEC / 60).toFixed(0)} min, above the ${EVIDENCED_CEILING_SEC / 60} min the measurement supports`);
  assert.ok(worst <= EVIDENCED_CEILING_SEC,
    `a quality session costs ${(worst / 60).toFixed(0)} min, past the evidenced ceiling — ${worstWho}`);
});

test("BLOCKER: the cap REFUSES a format, and never truncates one — a title may not lie", () => {
  // ⚠️ SHEDDING WOULD DELIVER 1-2-3-4 UNDER A TITLE PROMISING 1-2-3-4-3-2-1, and a title that lies
  // is a defect this repo guards against elsewhere ("what the title NAMES is what the runner is
  // actually given"). So the pool is filtered rather than the session trimmed. The check is that
  // whatever a builder returns is a WHOLE format: its work portion must equal that format's own
  // cost, so no step can have been removed after selection.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 2400 });
  for (const [builder, label] of [[thresholdSession, "threshold"], [vo2Session, "vo2"], [raceSpecificSession, "race-specific"]] as const) {
    for (let v = 0; v < 40; v++) {
      const s = builder(paces, v, { phase: "build", competitive: true });
      let sec = 0;
      for (const st of s.steps ?? []) {
        if (st.kind === "warmup" || st.kind === "cooldown") continue;
        if (st.durationSeconds) { sec += st.durationSeconds; continue; }
        if (st.distanceMeters && st.targetPaceSecPerKm) {
          const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
          sec += (st.distanceMeters / 1000) * mid; continue;
        }
        if (st.distanceMeters) sec += st.distanceMeters / 4;
      }
      assert.ok(sec <= QUALITY_WORK_CAP_SEC + 1,
        `${label} variant ${v} returned a session costing ${(sec / 60).toFixed(0)} min`);
      assert.ok(sec > 0, `${label} variant ${v} returned an empty session — that is truncation, not refusal`);
    }
  }
});

test("BLOCKER: the cap leaves faster runners untouched, and leaves the library varied for slower ones", () => {
  // ⚠️ A CAP THAT STARVES VARIETY HAS TRADED AN ABSURD SESSION FOR A MONOTONOUS BLOCK, and
  // `test/session-library.test.ts` guards variety explicitly. Measured across abilities: at a 70 min
  // cap a 15:00 5 km runner loses nothing and a 40:00 one keeps 46 of 62 formats; at 60 min the
  // slowest keeps 38 of 62, which is a third of the library gone.
  const titlesFor = (fiveK: number) => {
    const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: fiveK });
    const seen = new Set<string>();
    for (const builder of [thresholdSession, vo2Session, raceSpecificSession])
      for (let v = 0; v < 60; v++)
        for (const ctx of [{ phase: "base" }, { phase: "build" }, { phase: "peak" },
                           { phase: "build", competitive: true }, { phase: "peak", competitive: true }] as const)
          seen.add(builder(paces, v, ctx).title);
    return seen;
  };
  const fast = titlesFor(900);
  const slow = titlesFor(2400);
  assert.ok(slow.size >= 25,
    `a 40:00 5 km runner can reach only ${slow.size} distinct quality sessions — the cap has starved the library`);
  // A fast runner's sessions all cost well under the cap, so their pool must be the whole library.
  assert.ok(fast.size >= slow.size,
    "the faster runner reaches fewer formats than the slower one, which inverts the cap's purpose");
});

test("the cap is derived from the constant, not from a second copy of the number", () => {
  // Two owners of one measurement is how they come to disagree. `formatWorkSec` is the one cost
  // function and `QUALITY_WORK_CAP_SEC` the one bound; the selector must read both rather than
  // carrying a literal of its own.
  const src = readFileSync(new URL("../src/plan/session-templates.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function selectFormat("), src.indexOf("export function thresholdSession"));
  assert.ok(/QUALITY_WORK_CAP_SEC/.test(body), "selectFormat does not read the cap constant");
  assert.ok(/formatWorkSec/.test(body), "selectFormat does not use the shared cost function");
  assert.ok(!/\b(?:60|70|75|90)\s*\*\s*60\b/.test(body),
    "selectFormat carries its own copy of the cap in minutes");
  // And the cost function is exported so a guard can measure a format directly rather than
  // re-deriving what a step costs — a re-derivation is a second answer waiting to drift.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  assert.ok(formatWorkSec({ id: "x", title: "x", phases: ["build"],
    build: () => [{ kind: "rep", durationSeconds: 600, targetPaceSecPerKm: paces.threshold }] } as never, paces) === 600,
    "formatWorkSec does not return a step's own duration");
});

// ---------------------------------------------------------------------------------------------
// 4. Rule 4 — the readiness loop has no write path to the fitness anchor
// ---------------------------------------------------------------------------------------------

test("BLOCKER: a readiness result carries nothing that could move a pace or the fitness anchor", () => {
  // ⚠️ THE SPEC'S FOURTH RULE, AND THE ENGINE ALREADY HONOURS IT BY CONSTRUCTION RATHER THAN BY
  // DISCIPLINE — which is worth pinning precisely because nothing was checking it. "A bad night's
  // sleep changes today's session and nothing else. If readiness can lower prescribed paces, the
  // product is broken." The guard is on the RETURN TYPE's own values: a result made only of a band,
  // a score and prose has no mechanism by which it could reach `recent`, a pace band or an anchor.
  const worst = assessReadiness({
    sleepQuality: "poor", soreness: "high", energy: "low", stress: "high",
    motivation: "low", restingHrDelta: 12, illness: true, yesterdayRpe: 10,
  } as never);
  const best = assessReadiness({
    sleepQuality: "good", soreness: "none", energy: "high", stress: "low", motivation: "high",
  } as never);
  for (const r of [worst, best]) {
    // ⚠️ AN ALLOWLIST, NOT A `deepEqual` AGAINST THE OBJECT'S OWN KEYS. The first version of this
    // line compared `Object.keys(r)` against that same list FILTERED BY `k in r`, which is the
    // asserting-a-value-against-itself trap: it holds however many fields the result grows, so a
    // future `suggestedPaceSecPerKm` would have sailed straight through the one check written to
    // stop it. The list is fixed here, so a new field fails until somebody has thought about it.
    const ALLOWED = ["band", "headline", "reasons", "reassurance", "recommendation", "score"];
    for (const k of Object.keys(r))
      assert.ok(ALLOWED.includes(k),
        `readiness returned a field this guard has not considered: "${k}". If it cannot reach a pace, add it to ALLOWED and say why.`);
    for (const [k, v] of Object.entries(r)) {
      // Anything numeric other than the display score would be a candidate for arithmetic on a pace.
      if (typeof v === "number") assert.equal(k, "score", `readiness returns a number called "${k}" — only the display score may be numeric`);
      assert.ok(!/pace|anchor|recent|threshold|vdot|criticalSpeed|band(Min|Max)|secPerKm/i.test(k),
        `readiness returns "${k}", which names part of the fitness anchor`);
    }
  }
  // The two extremes must genuinely differ, or the guard is measuring a constant.
  assert.notEqual(worst.band, best.band, "the fixture does not reach two different bands");
});

test("BLOCKER: the readiness RESULT TYPE declares no field that could carry a pace", () => {
  // ⚠️⚠️ THE BEHAVIOURAL GUARD ABOVE READS `Object.keys(r)`, SO AN OPTIONAL FIELD NOTHING SETS YET IS
  // INVISIBLE TO IT. Watched escaping: adding `suggestedPaceSecPerKm?: number` to `ReadinessResult`
  // passed every value-level check, because an optional field that no code path assigns never
  // appears on the object. A type is a promise about what this loop MAY one day return, and the rule
  // is about what it may return — so the declaration needs its own guard.
  const src = readFileSync(new URL("../src/readiness/readiness.ts", import.meta.url), "utf8");
  const start = src.indexOf("export type ReadinessResult = {");
  assert.ok(start >= 0, "ReadinessResult is no longer declared where this guard looks");
  const decl = src.slice(start, src.indexOf("};", start));
  const fields = [...decl.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]!);
  const ALLOWED = ["band", "score", "headline", "recommendation", "reasons", "reassurance"];
  for (const f of fields)
    assert.ok(ALLOWED.includes(f),
      `ReadinessResult declares "${f}". Rule 4 says this loop changes today's session and nothing else — if this field cannot reach a pace, add it to ALLOWED and say why.`);
  assert.ok(fields.length >= 5, `only ${fields.length} fields parsed out of ReadinessResult — the guard is not reading the declaration`);
});

test("BLOCKER: the readiness module imports nothing that could write the anchor", () => {
  // A structural companion to the behavioural check above: even a future field could not reach the
  // anchor if the module cannot see the modules that own it. Derived from the import list rather
  // than a hand-written ban, so a new import has to be considered.
  const src = readFileSync(new URL("../src/readiness/readiness.ts", import.meta.url), "utf8");
  const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  for (const i of imports)
    assert.ok(!/paces|critical-speed|fitness-profile|two-km-trial|generate-plan|mas/.test(i),
      `readiness imports ${i}, which owns or derives the fitness anchor`);
});

// ---------------------------------------------------------------------------------------------
// 5. The five-rule audit tool must stay honest about what it measures
// ---------------------------------------------------------------------------------------------

test("the five-rule audit measures load in minutes and sets the runway from the race date", () => {
  // ⚠️ BOTH OF THESE WERE INSTRUMENT FAULTS THAT PRODUCED CONFIDENT WRONG NUMBERS. `GenerateOptions`
  // is `{ intensityModel?, startDateIso? }` and nothing else, so an earlier version of this tool
  // passing `{ weeks: 16 }` had it silently ignored and measured the same 40-week plan five times —
  // the tell was every runway reporting an identical breach count. And measuring the 1.30 ceiling in
  // kilometres rather than minutes changed the answer by half.
  const src = readFileSync(new URL("../tools/audit-five-rules.mjs", import.meta.url), "utf8");
  assert.ok(/raceDateIso: raceDate/.test(src), "the audit no longer sets the runway from the race date");
  assert.ok(!/generatePlan\([^)]*\{\s*weeks:/.test(src), "the audit passes a `weeks` option, which does not exist");
  assert.ok(/function weekMinutes/.test(src), "the audit no longer measures load in minutes");
  assert.ok(/if \(i < 4\) continue;/.test(src),
    "the audit no longer requires a full four-week window — a short window measures the opening ramp, not a breach");
});
