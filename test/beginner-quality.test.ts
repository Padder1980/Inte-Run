// THE BEGINNER TRACK'S RACE-SPECIFIC PROGRESSION (owner, 2026-09-01: "i want to follow the books
// recommendation")
//
// ⚠️⚠️ WHAT THIS REPLACED. Until now `buildBeginnerWeek` produced ZERO quality sessions — no threshold,
// no VO2, no race-pace work, in any week of any beginner plan — and it was a documented design decision
// with a guard holding it in place. The owner met it in his own plan and reported it: "building the
// habit", easy pace 5:40, a 5 km goal of 19:50, and "the plan it produces doesnt appear to have any form
// of hard session". Reproduced exactly: fifteen weeks, zero quality sessions, and the whole block used
// TWO pace bands — 5:26–5:55 easy and 4:43–4:59 for a steady finish — while he would have to race at
// 3:58. He never once ran within 45 s/km of his goal pace before race day.
//
// ⚠️ AND THE DEFECT WAS NOT THE CONSERVATISM, IT WAS THAT TWO MODULES DISAGREED ABOUT ONE RUNNER.
// `assessFeasibility` returns verdict "achievable" for that goal — 4.7% needed, 11.6% realistic in 14
// weeks — so the app promised a time it then built a plan incapable of delivering.
//
// WHAT THE BOOK PRESCRIBES, transcribed from the plates rather than the prose:
//   * "10K Level 1" states the rule most plainly: ONE quality session a week, every week, support work
//     running "from the fast end downward" (1500m, then 3K, then 5K), GOAL pace arriving only in the
//     final specific block, and race week run FASTER than race pace.
//   * "5K Level 1" gives the sequence: three weeks of nothing, fartlek growing by duration, hill
//     repetitions by effort, then flat intervals, then true 5K-pace work with reps lengthening as they
//     thin (12 × 400m → 6 × 800m → 5 × 1K).
//   * ⚠️ THE ch11 "FRESHMAN PLAN" IS THE CALIBRATION POINT and it is the most conservative thing in the
//     book: twelve weeks for a runner brand new to structured training, carrying **hill sprints and
//     fartlek and nothing else** — no intervals, no threshold, no goal-pace work, no long run — with the
//     fartlek at 5 km pace throughout rather than 1500m.
//
// Our runner sits between the two: Level 1 opens at a FOUR-MILE long run, which is at or above where
// this track finishes for a 5 km. So the diet is Freshman-weighted with Level 1's sharp end.
//
// MEASURED ON THE SWEEP BELOW (96 plans, 1,920 weeks, 1,384 quality sessions):
//   quality per week            max 1, and 0 weeks carry two
//   first quality session       lands at 25.0%–33.3% of the block
//   worst easy fraction         85.9% against the 68% floor, 0 model breaches (race week exempt)
//   distance-based reps         0 — every beginner rep is timed
//   goal-pace work outside peak 0
//   longest quality session     21 minutes of its own steps
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";

const TT: Record<string, number> = { "5k": 1500, "10k": 3200, half: 7500 };
const START = "2026-09-07"; // a Monday
const QUALITY = new Set(["threshold", "vo2", "race-specific"]);

const raceIso = (weeks: number): string => {
  const d = new Date(START + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

type Opts = { dist?: string; days?: number; secs?: number; weeks?: number; runWalk?: boolean; returning?: boolean };

function plan(o: Opts = {}) {
  const dist = o.dist ?? "5k";
  const athlete = {
    daysPerWeek: o.days ?? 4,
    recent: { distanceMeters: 5000, timeSeconds: o.secs ?? 1249 },
    experience: "beginner",
    includeStrength: true,
    includeMobility: true,
    returningFromInjury: false,
    returningFromBreak: o.returning ?? false,
    runWalk: o.runWalk ?? false,
    longRunDay: 6,
  } as unknown as Athlete;
  const goal = {
    distance: dist,
    targetTimeSeconds: TT[dist]!,
    raceDateIso: raceIso(o.weeks ?? 18),
  } as unknown as Goal;
  return generatePlan(athlete, goal, { startDateIso: START });
}

const qualityOf = (w: PlannedWeek): Session[] => w.sessions.filter((s) => QUALITY.has(s.type));
const isRaceWeek = (w: PlannedWeek): boolean => w.sessions.some((s) => s.type === "race");

/** The grid every sweep below shares. */
function* sweep() {
  for (const dist of ["5k", "10k", "half"]) {
    for (const days of [3, 4]) {
      // ⚠️ The ability axis matters here in a way it does not for the main track: a beginner's anchor
      // may be a SEEDED time (2250 for "building", 2700 for "new"), so the doses have to be sane for a
      // 20:49 runner and a 45:00 one alike.
      for (const secs of [1249, 1800, 2250, 2700]) {
        for (const weeks of [14, 18, 22, 28]) {
          yield { who: `${dist}/${days}d/${secs}s/${weeks}wk`, dist, p: plan({ dist, days, secs, weeks }) };
        }
      }
    }
  }
}

test("BLOCKER: a beginner never gets more than ONE quality session in a week", () => {
  // ⚠️ Hudson's 10K Level 1 is explicit — one a week, every week — and it is also this engine's own rule
  // at four running days or fewer, where a work-carrying long run already caps quality at one. A
  // beginner week has FOUR runs at most: long, quality, sprint day, easy.
  let weeks = 0;
  let withQuality = 0;
  for (const { who, p } of sweep()) {
    for (const w of p.weeks) {
      weeks++;
      const q = qualityOf(w);
      if (q.length) withQuality++;
      assert.ok(q.length <= 1,
        `${who} week ${w.index} carries ${q.length} quality sessions: ${q.map((s) => s.title).join(" | ")}`);
      assert.equal(w.qualitySessionCount, q.length,
        `${who} week ${w.index}: qualitySessionCount says ${w.qualitySessionCount}, the sessions say ${q.length}`);
    }
  }
  assert.ok(weeks > 1500, `only ${weeks} beginner weeks swept`);
  // ⚠️ And the sweep must contain the thing it is about, or every assertion above is vacuous.
  assert.ok(withQuality > 1000, `only ${withQuality} beginner weeks carry a quality session`);
});

test("BLOCKER: the introductory period carries none at all", () => {
  // ⚠️ THE BOOK'S OWN SHAPE. Level 1 gives three weeks of twelve (25%) and the Freshman Plan six of
  // twelve (50%). Ours is the more forward of the two because unlike the Freshman Plan our runner has a
  // race to reach — but the first quarter is easy running and hill sprints only, and that is also what
  // makes a pace band safe later: `autoPace` recalibrates a seeded anchor from the runner's FIRST
  // continuous run, so by the time any fast running is prescribed the paces come from a real one.
  const fracs: number[] = [];
  for (const { who, p } of sweep()) {
    const first = p.weeks.findIndex((w) => qualityOf(w).length > 0);
    assert.ok(first > 0, `${who}: no quality session anywhere in the plan`);
    const frac = (first + 1) / p.weeks.length;
    fracs.push(frac);
    assert.ok(frac >= 0.2,
      `${who}: the first quality session is week ${first + 1} of ${p.weeks.length} (${(frac * 100).toFixed(0)}%) ` +
      "— inside the introductory period");
  }
  // Measured 0.250–0.333. A ceiling as well as a floor: an introduction that never arrives is the
  // defect being fixed.
  assert.ok(Math.max(...fracs) <= 0.45,
    `the first quality session lands as late as ${(Math.max(...fracs) * 100).toFixed(0)}% into the block`);
});

test("BLOCKER: goal race pace appears ONLY in the specific block, and the fartlek comes first", () => {
  // ⚠️ "FROM THE FAST END DOWNWARD" is Hudson's 10K Level 1 in one phrase: 1500m pace, then 3K, then 5K,
  // with goal pace arriving only in the final specific block. Ours is fartlek at 5 km effort (`vo2`)
  // through base and build, then goal pace in the peak — and the taper goes back to the fartlek, because
  // both his Level 1 plans run race week FASTER than race pace.
  let goalPace = 0;
  let fartlek = 0;
  for (const { who, p } of sweep()) {
    let sawFast = false;
    for (const w of p.weeks) {
      for (const s of qualityOf(w)) {
        const atGoal = s.type === "race-specific";
        if (atGoal) {
          goalPace++;
          assert.equal(w.phase, "peak",
            `${who} week ${w.index} (${w.phase}): goal-pace work "${s.title}" outside the specific block`);
          assert.ok(sawFast,
            `${who} week ${w.index}: goal-pace work arrived before any faster support work — the ` +
            "progression is meant to come down from the fast end, not start at race pace");
        } else {
          fartlek++;
          sawFast = true;
        }
      }
    }
  }
  assert.ok(goalPace > 100, `only ${goalPace} goal-pace sessions swept`);
  assert.ok(fartlek > 500, `only ${fartlek} support sessions swept`);
});

test("BLOCKER: every beginner rep is TIMED, never a distance", () => {
  // ⚠️⚠️ MEASURED, NOT PREFERRED. A hand-authored distance dose costs whatever the runner's pace makes
  // it, and our beginners span a very wide range. Against a 17-minute work budget: 6 × 400m at goal pace
  // fits a 19:50 5 km runner (15.2′) and even 8 × 200m OVERFLOWS for a 62:00 10 km runner (17.1′).
  // Hudson prescribes by distance because his Level 1 runners are far more alike than ours, and he uses
  // time himself where it matters ("15 × 1 min. @ 5K pace", 10K Level 1 week 7).
  let reps = 0;
  for (const { who, p } of sweep()) {
    for (const w of p.weeks) {
      for (const s of qualityOf(w)) {
        for (const st of s.steps ?? []) {
          if (st.kind !== "rep") continue;
          reps++;
          assert.equal(st.distanceMeters, undefined,
            `${who} week ${w.index} "${s.title}": a rep is prescribed by distance (${st.distanceMeters} m)`);
          assert.ok((st.durationSeconds ?? 0) > 0,
            `${who} week ${w.index} "${s.title}": a rep has no duration`);
        }
      }
    }
  }
  assert.ok(reps > 5000, `only ${reps} beginner reps swept`);
});

test("BLOCKER: the hill-repetition variant is prescribed by EFFORT, with no pace band", () => {
  // ⚠️ Pace up a hill is a function of the gradient — this engine has always prescribed hill work by
  // effort — and for a beginner it is the safest session in the set, because it is the one that cannot
  // be wrong about their fitness. Hudson's Level 1 week 7 says "@ 3K effort", not a pace.
  let seen = 0;
  for (const { who, p } of sweep()) {
    for (const w of p.weeks) {
      for (const s of qualityOf(w)) {
        if (!/hills/.test(s.title)) continue;
        seen++;
        for (const st of s.steps ?? []) {
          if (st.kind !== "rep") continue;
          assert.equal(st.targetPaceSecPerKm, undefined,
            `${who} week ${w.index} "${s.title}": a hill rep carries a pace band`);
        }
      }
    }
  }
  assert.ok(seen > 50, `only ${seen} hill-repetition sessions swept — the variant may have stopped appearing`);
});

test("BLOCKER: the easy floor holds on every beginner week", () => {
  // ⚠️ A beginner week is small — measured 127 minutes at peak for a 20:49 runner — so a quality session
  // is a larger share of it than on the main track. Race week is exempt and only race week: it contains
  // the goal race, a maximal effort over the full distance, and judging it against a training
  // distribution would be judging the race as if it were a workout.
  let checked = 0;
  let worst = 1;
  for (const { who, p } of sweep()) {
    for (const w of p.weeks) {
      if (isRaceWeek(w)) continue;
      const d = computeDistribution(w.sessions);
      if (!d.totalSeconds) continue;
      checked++;
      worst = Math.min(worst, d.easy);
      assert.ok(honoursModel(d, p.intensityModel),
        `${who} week ${w.index} (${w.phase}): ${(d.easy * 100).toFixed(1)}% easy breaks ${p.intensityModel}`);
    }
  }
  assert.ok(checked > 1400, `only ${checked} weeks measured`);
  // Measured 85.9%. The bar is well under it and well over the 68% floor, so it discriminates.
  assert.ok(worst >= 0.75,
    `worst beginner easy fraction is ${(worst * 100).toFixed(1)}% — the quality session has grown too big`);
});

test("BLOCKER: a run–walk beginner and a returning beginner get none", () => {
  // ⚠️ THE SAME SCOPING DECISION AS THE HILL-SPRINT STAPLE, and for the same reason: somebody who cannot
  // yet run twenty minutes continuously is below the lowest tier the book addresses, and their plan is
  // already interval-shaped. Hudson's Freshman Plan — for a runner brand new to structured training —
  // still assumes continuous easy runs of three miles.
  // ⚠️ AND COMING BACK FROM A BREAK IS NOT THE MOMENT TO MEET FAST RUNNING FOR THE FIRST TIME.
  for (const dist of ["5k", "10k"]) {
    const rw = plan({ dist, days: 3, runWalk: true });
    for (const w of rw.weeks) {
      assert.equal(qualityOf(w).length, 0,
        `run–walk ${dist} week ${w.index}: "${qualityOf(w).map((s) => s.title).join(" | ")}"`);
    }
    assert.ok(rw.weeks.length > 10, `the run–walk ${dist} fixture built only ${rw.weeks.length} weeks`);
  }
  for (const dist of ["5k", "half"]) {
    const ret = plan({ dist, returning: true });
    for (const w of ret.weeks) {
      assert.equal(qualityOf(w).length, 0,
        `returning ${dist} week ${w.index}: "${qualityOf(w).map((s) => s.title).join(" | ")}"`);
    }
    assert.ok(ret.weeks.length > 10, `the returning ${dist} fixture built only ${ret.weeks.length} weeks`);
  }
});

test("BLOCKER: the hill-sprint staple survives every quality week — the day moves, it is not lost", () => {
  // ⚠️ Hudson never puts hill sprints on the quality day: Level 1 hangs them off the Monday, Thursday or
  // Saturday easy run. So the sprint slot moves to the SECOND easy day when a quality session takes the
  // first, and dropping them instead would undo the weekly staple the previous change measured in.
  const unpaced = (s: Session) =>
    (s.steps ?? []).filter((st) => st.kind === "rep" && st.targetPaceSecPerKm == null).length;
  const sprintDay = (w: PlannedWeek) =>
    w.sessions.find((s) => (s.type === "easy" || s.type === "strides") && unpaced(s) > 0);
  let qualityWeeks = 0;
  let withSprints = 0;
  for (const { p } of sweep()) {
    for (const w of p.weeks) {
      if (w.isDeload || w.phase === "taper") continue; // the staple is off on an eased week by design
      if (qualityOf(w).length === 0) continue;
      qualityWeeks++;
      if (sprintDay(w)) withSprints++;
    }
  }
  assert.ok(qualityWeeks > 400, `only ${qualityWeeks} non-eased beginner quality weeks swept`);
  assert.ok(withSprints / qualityWeeks >= 0.9,
    `the sprint day appears in only ${withSprints} of ${qualityWeeks} quality weeks — it is being ` +
    "dropped rather than moved");
});

test("BLOCKER: the owner's own plan reaches its goal race pace before race day", () => {
  // ⚠️ HIS EXACT REPORT, AS A GUARD. "building the habit", easy pace 5:40 (which the wizard back-
  // calculates to a 20:49 5 km), goal 19:50. Before this change the fastest pace prescribed anywhere in
  // the block was 4:43/km against a 3:58/km race pace — a 45 s/km gap he would meet for the first time
  // on the start line.
  const p = plan({ dist: "5k", days: 4, secs: 1249, weeks: 15 });
  const goal = p.paces.goalRace;
  let fastest = Infinity;
  let where = "";
  for (const w of p.weeks) {
    for (const s of w.sessions) {
      if (s.type === "race") continue; // the race itself proves nothing about the training
      for (const st of s.steps ?? []) {
        const b = st.targetPaceSecPerKm;
        if (b && b.minSecPerKm < fastest) { fastest = b.minSecPerKm; where = `week ${w.index} "${s.title}"`; }
      }
    }
  }
  assert.ok(fastest <= goal.maxSecPerKm,
    `the fastest pace prescribed in training is ${fastest}s/km (${where}) against a goal race pace of ` +
    `${goal.minSecPerKm}–${goal.maxSecPerKm}s/km — he never runs at race pace before race day`);
  const totalQuality = p.weeks.reduce((a, w) => a + w.qualitySessionCount, 0);
  assert.ok(totalQuality >= 8,
    `his plan carries only ${totalQuality} quality sessions across ${p.weeks.length} weeks`);
});
