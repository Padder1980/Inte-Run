import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

/**
 * ⚠️ GOAL PACE MUST BE MET BEFORE THE PEAK PHASE (2026-08-06 audit).
 *
 * Every race-specific format was `phases: ["peak"]` and the build phase never asked for one, so goal-pace
 * rehearsal was STRUCTURALLY IMPOSSIBLE before the last phase — measured across 768 plans at 0.0% of
 * running time in base and build, for every distance. The build's long runs finished "controlled, not
 * raced" while the function's own doc comment claimed they carried "REAL doses of race-pace work in
 * build/peak". Documented intent and behaviour had silently diverged.
 *
 * ⚠️ SHORT EVENTS ARE DELIBERATELY EXCLUDED and that is not an omission. For a 5 km or 10 km runner
 * `paces.goalRace` sits on top of threshold/VO2 — the interval work already IS the rehearsal. Handing
 * them "3 × 10′ at goal race pace" is thirty minutes at 5 km pace, longer than the race itself, and is
 * the same unrunnable prescription that was removed from short-event long runs.
 */
const RACE_PACE = /race pace|goal pace|race effort|goal effort|marathon effort|marathon pace/i;
const PREP = new Set(["warmup", "cooldown", "recovery"]);

function racePaceSeconds(w: PlannedWeek): number {
  let n = 0;
  for (const s of w.sessions) {
    for (const st of s.steps ?? []) {
      if (PREP.has(st.kind)) continue;
      if (s.type === "race-specific" || RACE_PACE.test(st.label ?? "")) n += st.durationSeconds ?? 0;
    }
  }
  return n;
}

const athlete = (days: number, experience: Athlete["experience"] = "recreational"): Athlete => ({
  daysPerWeek: days,
  recent: { distanceMeters: 10000, timeSeconds: 2400 },
  experience,
  includeStrength: false,
  returningFromInjury: false,
});
const goal = (distance: Goal["distance"], targetTimeSeconds: number): Goal => ({
  distance, targetTimeSeconds, raceDateIso: "2027-03-07", startDateIso: "2026-08-03",
});
const LONG = { half: 6600, marathon: 14400 } as const;

test("a half or marathon block rehearses goal pace during the BUILD, not only at the peak", () => {
  for (const distance of ["half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, LONG[distance]));
      const build = p.weeks.filter((w) => w.phase === "build");
      if (!build.length) continue;
      const secs = build.reduce((a, w) => a + racePaceSeconds(w), 0);
      assert.ok(secs > 0,
        `${distance}/${days}d: not one second at goal pace across ${build.length} build weeks`);
    }
  }
});

test("and a three-day runner gets a real race-pace SESSION, not only a long-run finish", () => {
  // ⚠️ The case the first cut missed. Written as "threshold, plus race-specific if there is room", the
  // race-pace session fell off the end of slice(0, count) on a one-quality week — so the runners with
  // the fewest sessions, who most need the one they get to be specific, were the only ones it never
  // reached.
  for (const distance of ["half", "marathon"] as const) {
    const p = generatePlan(athlete(3), goal(distance, LONG[distance]));
    const build = p.weeks.filter((w) => w.phase === "build");
    const hasSession = build.some((w) => w.sessions.some((s) => s.type === "race-specific"));
    assert.ok(hasSession, `${distance}/3d: goal pace never appears as a session of its own in the build`);
  }
});

test("the build is an INTRODUCTION — the peak still carries clearly more", () => {
  // Otherwise this is a relabelling rather than a progression.
  for (const distance of ["half", "marathon"] as const) {
    const p = generatePlan(athlete(5), goal(distance, LONG[distance]));
    const share = (ph: string) => {
      const ws = p.weeks.filter((w) => w.phase === ph && !w.sessions.some((s) => s.type === "race"));
      return ws.length ? ws.reduce((a, w) => a + racePaceSeconds(w), 0) / ws.length : 0;
    };
    const b = share("build"), pk = share("peak");
    assert.ok(pk > b * 1.5, `${distance}: build ${Math.round(b / 60)}′/wk vs peak ${Math.round(pk / 60)}′/wk — not a step up`);
  }
});

test("the BASE phase still has none of it", () => {
  // Base is for durability. Race pace there would make the whole block a peak phase.
  for (const distance of ["half", "marathon"] as const) {
    const p = generatePlan(athlete(5), goal(distance, LONG[distance]));
    for (const w of p.weeks.filter((w) => w.phase === "base")) {
      assert.equal(racePaceSeconds(w), 0, `${distance}: week ${w.index} of the base carries goal-pace work`);
    }
  }
});

test("a 5k or 10k block is left alone — its goal pace IS its interval work", () => {
  // ⚠️ Guards the exclusion, not just the inclusion. A future change that "fixes" short events by
  // handing them the same formats would prescribe 30 minutes at 5 km pace.
  for (const [distance, tt] of [["5k", 1500], ["10k", 3000]] as const) {
    for (const days of [3, 5]) {
      const p = generatePlan(athlete(days), goal(distance, tt));
      for (const w of p.weeks.filter((w) => w.phase === "build")) {
        assert.equal(w.sessions.filter((s) => s.type === "race-specific").length, 0,
          `${distance}/${days}d: week ${w.index} of the build prescribes a goal-pace session`);
      }
    }
  }
});

test("a deload in the BUILD is never the week goal pace is introduced", () => {
  // ⚠️ Scoped to build deloads on purpose. A PEAK deload does still carry a race-specific session, and
  // that is pre-existing and deliberate: `fctx.isDeload` reaches the format picker, which drops the
  // "big" formats, so the week gets the mild cut-down rather than 2 × 5 km at goal pace. Asserting
  // across every phase — which this test did first — fails on that established behaviour and would have
  // pushed a real design decision over for the sake of a green test.
  for (const distance of ["half", "marathon"] as const) {
    for (const days of [4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, LONG[distance]));
      for (const w of p.weeks.filter((w) => w.isDeload && w.phase === "build")) {
        assert.equal(w.sessions.filter((s) => s.type === "race-specific").length, 0,
          `${distance}/${days}d: build deload week ${w.index} carries a race-pace session`);
      }
    }
  }
});
