import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, RaceDistanceKey, Session, TrainingPaces } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { MAX_STRUCTURED_WEEKS } from "../src/plan/periodization.ts";
import { assessTrainingFlags } from "../src/adapt/training-flags.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import {
  computeDistribution,
  honoursModel,
} from "../src/science/intensity-distribution.ts";
import {
  QUALITY_FORMAT_IDS,
  contHillSprints,
  easyHillStrides,
  easyRun,
  raceSpecificSession,
  taperSession,
  thresholdSession,
  vo2Session,
} from "../src/plan/session-templates.ts";

const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 18 * 60 + 20 });

const competitive: Athlete = {
  daysPerWeek: 6,
  recent: { distanceMeters: 5000, timeSeconds: 18 * 60 + 20 },
  experience: "competitive",
  includeStrength: true,
  returningFromInjury: false,
};

function goalFor(distance: RaceDistanceKey, weeks: number): Goal {
  const race = new Date(Date.UTC(2026, 6, 27) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  return { distance, targetTimeSeconds: 80 * 60, raceDateIso: race, startDateIso: "2026-07-27" };
}

// ---- the pace ladder ------------------------------------------------------

test("the seven training gears are strictly ordered, fastest to slowest", () => {
  for (const t of [1000, 1260, 1500, 1800, 2400]) {
    const p = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: t });
    const ladder: Array<[string, { minSecPerKm: number; maxSecPerKm: number }]> = [
      ["rep", p.rep], ["vo2", p.vo2], ["cv", p.cv], ["threshold", p.threshold],
      ["tempo", p.tempo], ["steady", p.steady], ["aerobic", p.aerobic], ["easy", p.easy],
    ];
    for (let i = 1; i < ladder.length; i++) {
      const [prevName, prev] = ladder[i - 1]!;
      const [name, cur] = ladder[i]!;
      assert.ok(
        cur.minSecPerKm > prev.minSecPerKm,
        `5k=${t}s: ${name} (${cur.minSecPerKm}) should be slower than ${prevName} (${prev.minSecPerKm})`,
      );
    }
  }
});

test("every band is a real range, and none is absurd", () => {
  const p = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  for (const [name, b] of Object.entries(p)) {
    if (typeof b !== "object" || b === null || !("minSecPerKm" in b)) continue;
    const r = b as { minSecPerKm: number; maxSecPerKm: number };
    assert.ok(r.maxSecPerKm > r.minSecPerKm, `${name} band is inverted or zero-width`);
    assert.ok(r.minSecPerKm > 100 && r.maxSecPerKm < 1200, `${name} band is off the scale`);
  }
});

// ---- format hygiene -------------------------------------------------------

const ALL_IDS = [...QUALITY_FORMAT_IDS.threshold, ...QUALITY_FORMAT_IDS.vo2, ...QUALITY_FORMAT_IDS.race];

test("format ids are unique across every pool", () => {
  assert.equal(new Set(ALL_IDS).size, ALL_IDS.length, "duplicate format id");
});

test("the library is genuinely large", () => {
  assert.ok(QUALITY_FORMAT_IDS.threshold.length >= 20, `threshold pool is only ${QUALITY_FORMAT_IDS.threshold.length}`);
  assert.ok(QUALITY_FORMAT_IDS.vo2.length >= 20, `vo2 pool is only ${QUALITY_FORMAT_IDS.vo2.length}`);
  assert.ok(QUALITY_FORMAT_IDS.race.length >= 5, `race pool is only ${QUALITY_FORMAT_IDS.race.length}`);
});

// Every format is built for every phase it claims, so a broken builder cannot hide behind the
// rotation only reaching it in one plan shape out of eighty.
test("every format builds a sane session in each phase it claims", () => {
  const seen = new Set<string>();
  for (const phase of ["base", "build", "peak", "taper"] as const) {
    for (let v = 0; v < 60; v++) {
      for (const s of [
        thresholdSession(paces, v, { phase, competitive: true }),
        vo2Session(paces, v, { phase, competitive: true }),
        raceSpecificSession(paces, v, { phase, competitive: true }),
      ]) {
        seen.add(s.title);
        assert.ok(s.steps.length >= 3, `${s.title}: too few steps`);
        assert.ok(
          s.estimatedDurationSeconds >= 15 * 60 && s.estimatedDurationSeconds <= 150 * 60,
          `${s.title}: implausible duration ${Math.round(s.estimatedDurationSeconds / 60)}′`,
        );
        assert.ok(s.targetRpe!.min >= 1 && s.targetRpe!.max <= 10, `${s.title}: bad RPE band`);
        // Warm-up first, cool-down last — the live runtime and the coach both assume this shape.
        assert.equal(s.steps[0]!.kind, "warmup", `${s.title}: does not open with a warm-up`);
        assert.equal(s.steps.at(-1)!.kind, "cooldown", `${s.title}: does not close with a cool-down`);
        for (const st of s.steps) {
          assert.ok(
            st.durationSeconds !== undefined || st.distanceMeters !== undefined,
            `${s.title}: step "${st.label}" has neither a duration nor a distance`,
          );
        }
      }
    }
  }
  assert.ok(seen.size >= 45, `only ${seen.size} distinct sessions reachable across all phases`);
});

// ---- the selector ---------------------------------------------------------

test("the taper session is chosen by id, never by array position", () => {
  // The regression this guards: the taper used to be `vo2Session(p, 3)`, so inserting any VO2
  // format above index 3 silently changed the race-week session of every plan ever generated.
  assert.equal(taperSession(paces).title, "10 × 1′ hard / 1′ easy");
  for (const dist of ["5k", "10k", "half", "marathon"] as const) {
    const plan = generatePlan(competitive, goalFor(dist, 16));
    const last = plan.weeks.at(-1)!;
    const quality = last.sessions.filter((s) => s.type === "vo2" || s.type === "threshold");
    for (const q of quality) {
      assert.equal(q.title, "10 × 1′ hard / 1′ easy", `${dist}: taper session drifted`);
    }
  }
});

test("a recreational runner is never given a competitive-only session", () => {
  const recreational: Athlete = { ...competitive, experience: "recreational" };
  const plan = generatePlan(recreational, goalFor("half", 24));
  const titles = new Set(plan.weeks.flatMap((w) => w.sessions.map((s) => s.title)));
  for (const t of [
    "6 × 8′ threshold / 2′ jog",
    "Ladder: 1–2–3–4–3–2–1 km / equal jog",
    "20 × 200 m on / 200 m off — continuous",
    "5 km time trial — or race a parkrun",
  ]) {
    assert.ok(!titles.has(t), `recreational plan contains competitive-only session "${t}"`);
  }
});

test("someone returning from injury is never given maximal hill sprints", () => {
  const returning: Athlete = { ...competitive, returningFromInjury: true };
  const plan = generatePlan(returning, goalFor("half", 24));
  const titles = plan.weeks.flatMap((w) => w.sessions.map((s) => s.title));
  for (const t of titles) {
    assert.ok(!/hill sprints/i.test(t), `returning-from-injury plan contains "${t}"`);
  }
});

test("a deload week never draws a big session", () => {
  const plan = generatePlan(competitive, goalFor("half", 28));
  for (const w of plan.weeks.filter((x) => x.isDeload)) {
    for (const s of w.sessions.filter((x) => x.type === "threshold" || x.type === "vo2")) {
      assert.ok(
        s.estimatedDurationSeconds <= 75 * 60,
        `deload week ${w.index} has a ${Math.round(s.estimatedDurationSeconds / 60)}′ "${s.title}"`,
      );
    }
  }
});

// ---- what the runner actually receives ------------------------------------

test("the longest plan a runner can get delivers real variety, not the same sessions on a loop", () => {
  // ⚠️⚠️ THE BARS CAME DOWN WITH THE BLOCK-LENGTH CAP (2026-09-01), AND THE RATIO IS WHAT CARRIES THE
  // CLAIM. Asking for 35 weeks now yields the half's own 20-week cap, so there are fewer quality slots
  // to be various across: measured 27 slots, 21 distinct, worst repeat 3 — against 30/25/5 before.
  // A count bar is really a statement about plan LENGTH; what this test is about is whether the library
  // rotates, so the ratio is asserted too and it is the stronger claim (21/27 = 0.78).
  const plan = generatePlan(competitive, goalFor("half", 35));
  assert.equal(plan.weeks.length, MAX_STRUCTURED_WEEKS.half,
    "the fixture no longer builds the longest possible half block");
  const quality = plan.weeks.flatMap((w) =>
    w.sessions.filter((s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific"));
  const distinct = new Set(quality.map((s) => s.title));
  assert.ok(quality.length >= 25,
    `only ${quality.length} quality sessions in a ${plan.weeks.length}-week plan`);
  assert.ok(
    distinct.size >= 20,
    `${quality.length} quality slots but only ${distinct.size} distinct sessions`,
  );
  assert.ok(distinct.size / quality.length >= 0.7,
    `${distinct.size} distinct of ${quality.length} slots — the rotation is looping rather than rotating`);
  // No single session should dominate.
  const counts = new Map<string, number>();
  for (const s of quality) counts.set(s.title, (counts.get(s.title) ?? 0) + 1);
  const worst = Math.max(...counts.values());
  assert.ok(worst <= 5, `"${[...counts].find(([, n]) => n === worst)![0]}" appears ${worst} times`);
});

test("the peak block does not repeat one race-pace session every week", () => {
  const plan = generatePlan(competitive, goalFor("half", 30));
  const peak = plan.weeks.filter((w) => w.phase === "peak")
    .flatMap((w) => w.sessions.filter((s) => s.type === "race-specific").map((s) => s.title));
  assert.ok(peak.length >= 3, "expected several peak weeks");
  assert.ok(new Set(peak).size >= Math.min(3, peak.length), `peak race sessions repeat: ${peak.join(" | ")}`);
});

test("every format is reachable by some real plan", () => {
  const seen = new Set<string>();
  // ⚠️⚠️ THE RUNWAY AXIS WAS WIDENED WHEN THE BLOCK WAS CAPPED, AND THE REASON IS THE ROTATION SEED.
  // `rot` is `ordinalInPhase + phaseTotal + daysPerWeek + DISTANCE_SEED`, so what reaches new formats
  // is a new PHASE LENGTH. Capping collapsed 22, 24, 26, 30 and 35 weeks onto the same block for every
  // distance, so five grid points became one and coverage fell 95% -> 93%. Adding the SHORTER runways
  // (which the caps do not collapse) restores the distinct phase lengths and coverage returns to 95%.
  // ⚠️ Widening the ABILITY axis was measured and does nothing — the seed does not read the runner's
  // paces, so 5 abilities reach exactly the same formats as 1.
  for (const dist of ["1mile", "5k", "10k", "half", "marathon"] as const) {
    for (const weeks of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 30, 35]) {
      for (const days of [3, 4, 5, 6, 7]) {
        for (const experience of ["recreational", "competitive"] as const) {
          const ath: Athlete = { ...competitive, daysPerWeek: days, experience };
          for (const w of generatePlan(ath, goalFor(dist, weeks)).weeks) {
            for (const s of w.sessions) seen.add(s.title);
          }
        }
      }
    }
  }
  // Title-based, because that is what the runner sees. Anything unreachable is dead code.
  const built = new Set<string>();
  for (const phase of ["base", "build", "peak"] as const) {
    for (let v = 0; v < 60; v++) {
      built.add(thresholdSession(paces, v, { phase, competitive: true }).title);
      built.add(vo2Session(paces, v, { phase, competitive: true }).title);
      built.add(raceSpecificSession(paces, v, { phase, competitive: true }).title);
    }
  }
  // Exhaustive coverage is neither possible nor wanted — a 12-week plan should not use 25 different
  // threshold sessions, and which formats a finite matrix of plans happens to land on shifts
  // whenever any one of them is retagged. What must hold is that the library is not carrying dead
  // weight: nearly all of it is used by the plans people actually build.
  //
  // The complement of this test is "every format builds a sane session in each phase it claims",
  // which drives the selectors directly and so proves each format is reachable in principle.
  const unreachable = [...built].filter((t) => !seen.has(t));
  const coverage = 1 - unreachable.length / built.size;
  assert.ok(
    coverage >= 0.95,
    `only ${(coverage * 100).toFixed(0)}% of the library is used by any real plan; unused: ${unreachable.join(" | ")}`,
  );
});

// ---- the traps -------------------------------------------------------------

test("a maximal session carries a maximal effort band", () => {
  // race-specific is in the flags engine's RPE_TYPES. A parkrun honestly reported as 10/10 against
  // a {4,5} band is read as "much harder than intended" — two of them and the app proposes easing
  // the whole plan off on the evidence of two races.
  let found = false;
  for (let v = 0; v < 40; v++) {
    const s = raceSpecificSession(paces, v, { phase: "peak", competitive: true });
    if (/time trial|parkrun/i.test(s.title)) {
      found = true;
      assert.ok(s.targetRpe!.max >= 10, `"${s.title}" has RPE max ${s.targetRpe!.max}, not maximal`);
      assert.equal(s.intensity, "hard");
    }
  }
  assert.ok(found, "the 5 km time trial was never selected");
});

test("multi-gear sessions really do contrast two paces", () => {
  // The library's whole point is sessions that a single-pace format cannot express. This asserts
  // they exist and that the contrast is real — a "threshold then CV" block whose two paces differ by two
  // seconds would be a session in name only.
  //
  // The rendering side of this is structureRows() in web/app.ts, which splits a run of reps at any
  // change of pace so every band gets its own row and chip.
  let contrasted = 0;
  for (let v = 0; v < 60; v++) {
    for (const s of [
      thresholdSession(paces, v, { phase: "peak", competitive: true }),
      vo2Session(paces, v, { phase: "peak", competitive: true }),
      thresholdSession(paces, v, { phase: "build", competitive: true }),
      vo2Session(paces, v, { phase: "build", competitive: true }),
    ]) {
      const mins = s.steps.filter((st) => st.kind === "rep" && st.targetPaceSecPerKm)
        .map((st) => st.targetPaceSecPerKm!.minSecPerKm);
      if (new Set(mins).size < 2) continue;
      contrasted++;
      assert.ok(
        Math.max(...mins) - Math.min(...mins) >= 8,
        `"${s.title}" claims two gears but they differ by under 8 s/km`,
      );
    }
  }
  assert.ok(contrasted >= 5, `only ${contrasted} multi-gear sessions in the whole library`);
});

test("effort-only steps (hills) carry an effort band and no pace", () => {
  for (let v = 0; v < 60; v++) {
    for (const s of [
      vo2Session(paces, v, { phase: "base", competitive: true }),
      thresholdSession(paces, v, { phase: "base", competitive: true }),
    ]) {
      for (const st of s.steps) {
        if (st.kind !== "rep" || st.targetPaceSecPerKm) continue;
        assert.ok(st.targetRpe, `"${s.title}": step "${st.label}" has neither a pace nor an effort`);
      }
    }
  }
});

test("EVERY week honours the intensity model, across the whole product", () => {
  // This used to fail. Two causes, both fixed:
  //  1. computeDistribution charged a quality session's whole duration to one bucket, so a 55'
  //     threshold session counted 55' of "moderate" when 30' of it is warm-up, jog recoveries and
  //     cool-down. Accounting is per-step now.
  //  2. Four runs a week cannot carry two quality sessions outside the peak block — it leaves one
  //     easy run and the long run to hold up the whole aerobic base.
  // Measured before: 61 of 2816 weeks under the floor. After: none.
  //
  // ⚠️ THE STATED-MILEAGE AXIS IS PART OF THIS SWEEP, and it is here because leaving it out let a
  // regression through. When the volume model was added, this athlete never set
  // weeklyVolumeKmCurrent, so the whole new dimension was untested and the suite stayed green while
  // low stated mileages put 175 of 23040 weeks under the floor — the plan was being scaled DOWN,
  // which shrinks the easy running while the library-prescribed quality sessions stay exactly as
  // long. generatePlan only builds UP now; this axis is what holds it to that.
  const TARGET: Record<string, number> = { "5k": 1200, "10k": 2500, half: 5400, marathon: 11400 };
  let checked = 0;
  for (const dist of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[]) {
    for (const days of [3, 4, 5, 6]) {
      for (const experience of ["recreational", "competitive"] as const) {
        for (const weeks of [12, 20, 28]) {
        for (const vol of [undefined, 20, 40, 70, 120]) {
          const ath: Athlete = { ...competitive, daysPerWeek: days, experience, ...(vol ? { weeklyVolumeKmCurrent: vol } : {}) };
          const plan = generatePlan(ath, { ...goalFor(dist, weeks), targetTimeSeconds: TARGET[dist]! });
          for (const w of plan.weeks) {
            // ⚠️ The race week is exempt, and only the race week. It contains the goal race — a
            // hard effort over the full race distance — so of course it is not pyramidal. Judging
            // race week against a training distribution would be judging the race as if it were a
            // workout. Every OTHER week, including the rest of the taper, still has to hold.
            if (w.sessions.some((s) => s.type === "race")) continue;
            const d = computeDistribution(w.sessions);
            if (d.totalSeconds === 0) continue;
            checked++;
            assert.ok(
              honoursModel(d, plan.intensityModel),
              `${dist} ${days}d ${experience} ${weeks}wk vol=${vol ?? "unset"} week ${w.index} (${w.phase}): ` +
              `${(d.easy * 100).toFixed(1)}% easy breaks ${plan.intensityModel}`,
            );
          }
        }
        }
      }
    }
  }
  assert.ok(checked > 1500, `only ${checked} weeks checked`);
});

test("a quality session's warm-up and recoveries count as easy running", () => {
  // The accounting change, asserted directly: a threshold session is far from uniformly moderate.
  const plan = generatePlan(competitive, goalFor("half", 20));
  const thr = plan.weeks.flatMap((w) => w.sessions).find((s) => s.type === "threshold")!;
  const d = computeDistribution([thr]);
  assert.ok(d.easy > 0.25, `a threshold session counted only ${(d.easy * 100).toFixed(0)}% easy running`);
  assert.ok(d.moderate > 0.2, `a threshold session counted only ${(d.moderate * 100).toFixed(0)}% moderate`);
  // And the total is preserved — the split must not invent or lose training time.
  assert.ok(
    Math.abs(d.totalSeconds - thr.estimatedDurationSeconds) < 2,
    `split total ${d.totalSeconds} vs session ${thr.estimatedDurationSeconds}`,
  );
});

test("no session dwarfs the race it prepares for", () => {
  // "2 × 5 km at goal race pace" is a fine half-marathon session and an absurd 5 km one — ten
  // kilometres at race effort for a five-kilometre race. Race-pace volume is gated on event length.
  const TARGET: Record<string, number> = { "5k": 1200, "10k": 2500, half: 5400, marathon: 11400 };
  const MAX_RATIO: Record<string, number> = { "5k": 4.5, "10k": 2.5, half: 1.5, marathon: 1.0 };
  for (const dist of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[]) {
    for (const weeks of [14, 22, 30]) {
      const plan = generatePlan(competitive, { ...goalFor(dist, weeks), targetTimeSeconds: TARGET[dist]! });
      for (const s of plan.weeks.flatMap((w) => w.sessions)) {
        if (!["threshold", "vo2", "race-specific"].includes(s.type)) continue;
        const ratio = s.estimatedDurationSeconds / TARGET[dist]!;
        assert.ok(
          ratio <= MAX_RATIO[dist]!,
          `${dist}: "${s.title}" is ${Math.round(s.estimatedDurationSeconds / 60)}′, ` +
          `${ratio.toFixed(1)}× a ${Math.round(TARGET[dist]! / 60)}′ race`,
        );
      }
    }
  }
});

test("adding a moderate gear does not shift the intensity distribution", () => {
  // moderateRun is deliberately bucketed "easy". Re-bucketing it as "moderate" would drop a build
  // week's easy fraction by several points and the plan would read as mis-periodised when it is not.
  //
  // NOTE the bound here is the WHOLE PLAN, not each week. A handful of five-day build weeks with two
  // quality sessions sit a little under the per-week floor, and did so long before this library
  // existed (measured: 6 of 35 weeks, unchanged by these additions) — that is a periodisation
  // question about two-quality weeks, not a session-library one.
  const recreational: Athlete = { ...competitive, daysPerWeek: 5, experience: "recreational", returningFromInjury: true };
  const plan = generatePlan(recreational, goalFor("half", 30));
  const whole = computeDistribution(plan.weeks.flatMap((w) => w.sessions));
  assert.ok(
    honoursModel(whole, plan.intensityModel),
    `plan-wide easy fraction ${whole.easy.toFixed(3)} breaks ${plan.intensityModel}`,
  );
  // And every moderate run really does land in the easy bucket.
  const mods = plan.weeks.flatMap((w) => w.sessions).filter((s) => /moderate/.test(s.title));
  assert.ok(mods.length > 0, "no moderate runs generated");
  for (const m of mods) assert.equal(m.intensity, "easy", `"${m.title}" is bucketed ${m.intensity}`);
});

test("moderate and progression runs stay honestly easy", () => {
  // They are typed "easy", which puts them in the flags engine's PACE_TYPES. If their whole-run
  // average sits outside the band the plan judges them against, two in a row raise a false flag.
  //
  // ⚠️ THIS USED TO ASSERT `s.targetRpe.max <= 4` — THE SESSION'S DECLARED BAND — AND THAT WAS THE
  // WRONG HALF, in the direction that CAUSES the false flag this test exists to prevent. `assemble`
  // now spans every session's band to its hardest step, because a session declaring "meant to feel
  // about 3-4" while carrying RPE 9 strides makes an honest 5 read as "much harder than intended":
  // measured through the real `assessTrainingFlags`, two such ratings produce an rpe-high flag and a
  // suggestion to re-anchor the runner SLOWER. A narrow band is the false-positive machine.
  //
  // The invariant that was worth protecting is that the RUN ITSELF is easy, whatever brief accents it
  // carries — so it is asserted on the run's own body steps, which is where "moderate" is a claim
  // about the running rather than about a label. Strides and hill sprints are excluded by name: they
  // are seconds of neuromuscular work, not the session's gear.
  const plan = generatePlan(competitive, goalFor("half", 24));
  const runs = plan.weeks.flatMap((w) => w.sessions)
    .filter((s) => /moderate|→ moderate finish/.test(s.title));
  assert.ok(runs.length > 0, "no moderate runs were generated at all");
  for (const s of runs) {
    assert.equal(s.intensity, "easy", `"${s.title}" is bucketed ${s.intensity}`);
    const body = (s.steps ?? []).filter(
      (st) => st.kind === "steady" && !/stride|sprint/i.test(st.label ?? ""),
    );
    assert.ok(body.length > 0, `"${s.title}" has no body step to judge`);
    for (const st of body) {
      assert.ok((st.targetRpe?.max ?? 0) <= 4,
        `"${s.title}" runs its own body at RPE up to ${st.targetRpe?.max} — that is not a moderate run`);
    }
    // ...and the declared band must still SPAN what the session contains, or the flags engine is
    // judging the runner against an expectation the session does not meet.
    const hardest = (s.steps ?? []).reduce((m: number, st) => Math.max(m, st.targetRpe?.max ?? 0), 0);
    assert.ok(s.targetRpe!.max >= hardest,
      `"${s.title}" declares RPE up to ${s.targetRpe!.max} but contains a step at ${hardest}`);
  }
});

test("a session's estimated distance is never zero when it has paced running", () => {
  for (let v = 0; v < 40; v++) {
    for (const s of [
      thresholdSession(paces, v, { phase: "build", competitive: true }),
      vo2Session(paces, v, { phase: "build", competitive: true }),
    ] as Array<Omit<Session, "id" | "dayOfWeek" | "source">>) {
      assert.ok(
        (s.estimatedDistanceMeters ?? 0) > 3000,
        `"${s.title}" estimates only ${Math.round(s.estimatedDistanceMeters ?? 0)}m`,
      );
    }
  }
});

/**
 * ⚠️⚠️ A SESSION NEVER DECLARES ITSELF EASIER THAN ITS OWN HARDEST STEP.
 *
 * This is not a labelling nicety. `plannedRpeBandOf` stamps the declared band onto every logged run as
 * `rband`, and `assessTrainingFlags`' `classifyRpe` fires when the runner's honest rating reaches
 * `band.max + 1` — so a session that says "meant to feel about 2-3" while carrying RPE 9 strides turns
 * an honest answer into evidence for easing the whole plan off. Measured through the real engine: two
 * honestly-rated hill-sprint days at RPE 6 against a {2,3} band produced an rpe-high flag with mean
 * deviation 3 and a suggestion to RE-ANCHOR A 25:00 5 km RUNNER TO 27:00.
 *
 * ⚠️ IT WAS EIGHT TITLE FAMILIES, NOT ONE, AND ~14% OF ALL SESSIONS. Measured across 27,462 generated
 * sessions before the fix: "easy + strides" declared 2-3 and contained 9 (x818), "moderate + strides"
 * 3-4 against 9 (x830), "easy -> steady finish" 2-3 against 5 (x783), "easy + gentle pickups" 2-3
 * against 5 (x765), "easy -> moderate finish" 2-3 against 4 (x552), the goal-pace-then-threshold long
 * run 4-5 against 7 (x70), "threshold, then hills" 6-7 against 10 (x45) and "N x N km, then hill
 * sprints" 8-9 against 10 (x4).
 *
 * ⚠️ FIXED IN `assemble`, WHICH IS THE ONE CONSTRUCTION POINT, so no builder can forget it — and it is
 * what `plannedRpeBandOf`'s own fallback already did for a session that declares no band at all.
 * Only the TOP moves; the floor stays where the builder put it, because a session containing ten
 * seconds of maximal work is still an easy run and its floor is what says so.
 */
test("BLOCKER: no session declares a band narrower than its own hardest step", () => {
  let inspected = 0;
  const offenders: string[] = [];
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    // ⚠️ THE DAY-COUNT AXIS WAS WIDENED WHEN THE BLOCK WAS CAPPED (2026-09-01). Every plan is now
    // shorter, so the same grid inspected 12,540 sessions against this test's own 15,000 floor — and
    // the floor is what stops the sweep going vacuous, so widening the grid is the fix rather than
    // lowering it. Adding the two missing day-counts restores it without weakening anything.
    for (const daysPerWeek of [3, 4, 5, 6, 7]) {
      for (const timeSeconds of [1100, 1500, 2100]) {
        for (const experience of ["beginner", "recreational", "competitive"] as const) {
          for (const runWalk of experience === "beginner" ? [false, true] : [false]) {
            const athlete = {
              daysPerWeek, recent: { distanceMeters: 5000, timeSeconds }, experience, runWalk,
              includeStrength: true, includeMobility: true, longRunDay: 6,
              returningFromInjury: false, weeklyVolumeKmCurrent: 40,
            } as Athlete;
            const goal = {
              distance, raceDateIso: "2027-06-06", targetTimeSeconds: 3600,
            } as Goal;
            let plan;
            try { plan = generatePlan(athlete, goal, { startDateIso: "2026-09-07" }); } catch { continue; }
            for (const week of plan.weeks) {
              for (const s of week.sessions) {
                const steps = s.steps ?? [];
                if (!s.targetRpe || !steps.length) continue;
                inspected++;
                const hardest = steps.reduce((m, st) => Math.max(m, st.targetRpe?.max ?? 0), 0);
                if (hardest > s.targetRpe.max) {
                  offenders.push(`"${s.title}" declares up to ${s.targetRpe.max}, contains ${hardest}`);
                }
              }
            }
          }
        }
      }
    }
  }
  // ⚠️ The sweep must be big enough to contain the eight families that were broken. Before the fix it
  // found 3,867 offenders of 27,462 sessions; a sweep that measured a handful would have found none of
  // them and reported clean.
  assert.ok(inspected > 15000, `only ${inspected} sessions inspected — the sweep cannot see the class`);
  assert.deepEqual([...new Set(offenders)].slice(0, 12), [],
    `${offenders.length} sessions declare themselves easier than they are`);
});

test("BLOCKER: an honestly-rated easy session with brief hard work does not propose slowing the plan", () => {
  // The chain end to end, driven rather than reasoned: build the session the library really builds,
  // stamp its band the way the app really stamps it, and hand two of them to the real flags engine.
  // ⚠️ AND IT ASSERTS BOTH DIRECTIONS. A band that spans must still leave the flag able to fire — a
  // fix that simply switched the RPE flag off for these sessions would pass a one-sided guard.
  const p = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  const withAccents = [
    easyRun(p, 45, true),
    easyHillStrides(p, 45, 6),
    contHillSprints(p, 30, 4),
  ];
  for (const s of withAccents) {
    const band = s.targetRpe!;
    const hardest = (s.steps ?? []).reduce((m: number, st) => Math.max(m, st.targetRpe?.max ?? 0), 0);
    assert.ok(band.max >= hardest, `"${s.title}" declares up to ${band.max}, contains ${hardest}`);
    const rate = (rpe: number) => assessTrainingFlags(
      [1, 2].map((i) => ({ id: "r" + i, type: s.type, distKm: 8, reportedRpe: rpe, plannedRpe: band })),
      { currentRecent5kSeconds: 1500 },
    );
    // An honest rating a few points above the floor is what a runner really gives an easy run that
    // contains strides. It must not become evidence.
    for (const honest of [4, 5, 6]) {
      const out = rate(honest);
      assert.deepEqual(out.flags, [],
        `"${s.title}": an honest RPE ${honest} raised ${out.flags.map((f) => f.kind).join("/")} ` +
        `and proposed ${out.suggestion ? out.suggestion.action : "nothing"}`);
    }
    // ...and the flag is still alive: nobody rates a mostly-easy run 10 unless something is wrong.
    const extreme = rate(10);
    assert.ok(extreme.flags.some((f) => f.kind === "rpe-high"),
      `"${s.title}": the RPE flag can no longer fire at all, which trades one defect for another`);
  }
});
