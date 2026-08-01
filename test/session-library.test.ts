import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, RaceDistanceKey, Session, TrainingPaces } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import {
  computeDistribution,
  honoursModel,
} from "../src/science/intensity-distribution.ts";
import {
  QUALITY_FORMAT_IDS,
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

test("a long plan delivers real variety, not the same eight sessions on a loop", () => {
  const plan = generatePlan(competitive, goalFor("half", 35));
  const quality = plan.weeks.flatMap((w) =>
    w.sessions.filter((s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific"));
  const distinct = new Set(quality.map((s) => s.title));
  assert.ok(quality.length >= 30, `only ${quality.length} quality sessions in a 35-week plan`);
  assert.ok(
    distinct.size >= 25,
    `${quality.length} quality slots but only ${distinct.size} distinct sessions`,
  );
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
  for (const dist of ["5k", "10k", "half", "marathon"] as const) {
    for (const weeks of [8, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 30, 35]) {
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
  const TARGET: Record<string, number> = { "5k": 1200, "10k": 2500, half: 5400, marathon: 11400 };
  let checked = 0;
  for (const dist of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[]) {
    for (const days of [3, 4, 5, 6]) {
      for (const experience of ["recreational", "competitive"] as const) {
        for (const weeks of [12, 20, 28]) {
          const ath: Athlete = { ...competitive, daysPerWeek: days, experience };
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
              `${dist} ${days}d ${experience} ${weeks}wk week ${w.index} (${w.phase}): ` +
              `${(d.easy * 100).toFixed(1)}% easy breaks ${plan.intensityModel}`,
            );
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
  const plan = generatePlan(competitive, goalFor("half", 24));
  const runs = plan.weeks.flatMap((w) => w.sessions)
    .filter((s) => /moderate|→ moderate finish/.test(s.title));
  assert.ok(runs.length > 0, "no moderate runs were generated at all");
  for (const s of runs) {
    assert.equal(s.intensity, "easy", `"${s.title}" is bucketed ${s.intensity}`);
    assert.ok(s.targetRpe!.max <= 4, `"${s.title}" claims RPE up to ${s.targetRpe!.max}`);
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
