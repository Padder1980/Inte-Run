/**
 * Y2 -- THE 12-17 CEILINGS, APPLIED TO THE PLAN THE RUNNER IS ACTUALLY GIVEN.
 *
 * Y1 decided which GOALS an age may pick. This is the rest: no single run longer than UK Athletics'
 * own rule permits that age to race, no week beyond twice it, no more running days than the owner's
 * column, and a quality diet the research supports. YOUTH.md holds the sources; `src/domain/youth.ts`
 * holds the numbers.
 *
 * ⚠️ THE SWEEP ASSERTS THE REAL CONSTRAINT IN KILOMETRES, deliberately, because several of the levers
 * that deliver it are proxies -- a work-seconds budget standing in for a distance, a volume scale
 * aimed 3% under the ceiling. A proxy that drifts has to fail here rather than in a runner's plan.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { youthLimitsFor } from "../src/domain/youth.ts";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";

const RACE_DATE: Record<string, string> = { "5k": "2027-01-10", "10k": "2027-02-07", half: "2027-03-14" };
const TARGET: Record<string, number> = { "5k": 1800, "10k": 3800, half: 8400 };
const EXPS: Array<Athlete["experience"]> = ["beginner", "recreational", "competitive"];

/** The goals Y1 offers at each age -- kept in step with `youthGoalsFrom` by that stage's own guards. */
const goalsAt = (age: number) => (age < 15 ? ["5k"] : age < 17 ? ["5k", "10k"] : ["5k", "10k", "half"]);

function build(age: number | undefined, goal: string, experience: Athlete["experience"], days: number,
               statedKm?: number) {
  return generatePlan(
    { daysPerWeek: days, recent: { distanceMeters: 5000, timeSeconds: 1800 }, experience,
      includeStrength: false, runWalk: false,
      ...(statedKm != null ? { weeklyVolumeKmCurrent: statedKm } : {}),
      ...(age != null ? { age } : {}) } as Athlete,
    { distance: goal, raceDateIso: RACE_DATE[goal], targetTimeSeconds: TARGET[goal] } as Goal,
    { startDateIso: "2026-09-28" },
  );
}

const sessionKm = (s: { estimatedDistanceMeters?: number }) => (s.estimatedDistanceMeters ?? 0) / 1000;

/**
 * ⚠️ RACE WEEK IS EXEMPT AND THAT IS NOT A LOOPHOLE. UKA's limit is on the RACE distance, which Y1
 * gates at the goal -- a 12-year-old may race 6 km and is offered only a 5k. Race day's SESSION is
 * the race plus a warm-up, so measuring it against the same number condemns a plan for the warm-up
 * around a race the rule expressly permits. Every intensity sweep in this repo exempts race week for
 * the same class of reason.
 */
const trainingWeeks = (weeks: PlannedWeek[]) =>
  weeks.filter((w) => !w.sessions.some((s) => s.type === "race"));

function measure(weeks: PlannedWeek[]) {
  let session = 0, week = 0, days = 0, worstType = "";
  for (const w of trainingWeeks(weeks)) {
    let km = 0, d = 0;
    for (const s of w.sessions) {
      const k = sessionKm(s);
      if (k > 0) { d++; km += k; if (k > session) { session = k; worstType = s.type; } }
    }
    if (km > week) week = km;
    if (d > days) days = d;
  }
  return { session, week, days, worstType };
}

/** Every reachable youth plan: age x goal x track x an answer at, below and above the day cap. */
function sweep() {
  const out: Array<{ label: string; lim: NonNullable<ReturnType<typeof youthLimitsFor>>;
                     m: ReturnType<typeof measure> }> = [];
  for (const age of [12, 13, 14, 15, 16, 17]) {
    const lim = youthLimitsFor(age)!;
    for (const goal of goalsAt(age)) for (const experience of EXPS) for (const days of [3, 5, 7]) {
      if (experience === "competitive" && age < 15) continue;
      // ⚠️ WITH AND WITHOUT A STATED MILEAGE, because they take different paths through the volume
      // model: without one the adult fit never runs at all and only the youth ceiling pass shapes the
      // plan. A sweep of one of the two measures half the machinery.
      for (const statedKm of [undefined, 45]) {
        out.push({ label: `${age} ${goal} ${experience} ask${days} stated=${statedKm ?? "-"}`, lim,
                   m: measure(build(age, goal, experience, days, statedKm).weeks) });
      }
    }
  }
  return out;
}

test("BLOCKER: no 12-17 plan schedules more running days than that age may run", () => {
  const all = sweep();
  assert.ok(all.length >= 120, `the sweep measured only ${all.length} plans`);
  for (const { label, lim, m } of all) {
    assert.ok(m.days <= lim.maxRunDays,
      `${label}: ${m.days} running days against a ceiling of ${lim.maxRunDays}`);
  }
  // ⚠️ AND AN ANSWER ABOVE THE CAP IS FOLDED ONTO IT RATHER THAN HONOURED. Asking for 7 days at 13
  // must build the same three-day week as asking for 3 -- a picker is not the gate.
  const asked7 = measure(build(13, "5k", "recreational", 7).weeks);
  assert.equal(asked7.days, 3, "a 13-year-old asking for 7 days was given more than three");
});

test("BLOCKER: the long run never exceeds what that age may race, on either track", () => {
  for (const { label, lim, m } of sweep()) {
    // The long run specifically -- the session the ceiling is really about, and the one both tracks
    // size from their own endpoint (`longCapMin` on the main track, `beginnerLongPeakMin` on the other).
    const longest = m.worstType === "long" ? m.session : 0;
    assert.ok(longest <= lim.maxSessionKm + 0.05,
      `${label}: long run ${longest.toFixed(1)} km against a ceiling of ${lim.maxSessionKm}`);
  }
});

test("BLOCKER: the measured residuals are bounded, and an increase fails here", () => {
  /**
   * ⚠️ TWO RESIDUALS SURVIVE AND THEY ARE STRUCTURAL, NOT OVERSIGHTS. Recorded with their causes so
   * nobody "fixes" this by loosening the bound.
   *
   * 1. A 13-year-old on the MAIN track draws a threshold session of 6.6 km against a 6 km ceiling.
   *    The session library's smallest threshold format is still that big once its warm-up and
   *    cool-down are counted; there is nothing smaller to pick. Fixing it means adding a shorter
   *    format, not tuning a cap.
   * 2. A 15-year-old at five running days peaks around 27 km against a 24 km ceiling. The easy runs
   *    are already at the engine's 20-minute minimum, so the week cannot shrink further without
   *    either dropping below that floor or dropping a day -- and the day count is the owner's own.
   *
   * ⚠️ AND THE WEEKLY NUMBER IS THE WEAKEST IN THE WHOLE FILE, which is why a residual there is more
   * tolerable than one on the session cap. It is twice the session ceiling, attributed to the youth
   * running consensus statement by two secondary summaries whose primary text I could not obtain --
   * see YOUTH.md's provenance flag. The session ceiling is UK Athletics' own rule.
   */
  const all = sweep();
  let overSession = 0, overWeek = 0, worstSession = 1, worstWeek = 1;
  for (const { lim, m } of all) {
    if (m.session > lim.maxSessionKm + 0.05) {
      overSession++; worstSession = Math.max(worstSession, m.session / lim.maxSessionKm);
    }
    if (m.week > lim.maxWeeklyKm + 0.05) {
      overWeek++; worstWeek = Math.max(worstWeek, m.week / lim.maxWeeklyKm);
    }
  }
  // ⚠️ THE SWEEP SIZE IS PINNED TOO, so a future change to the grid cannot loosen these counts by
  // measuring fewer plans -- or tighten them by measuring more. Measured 2026-09-22 over 162 plans:
  // 12 over the session ceiling (worst 9.3%) and 31 over the weekly one (worst 13.6%). Stating a
  // weekly mileage changes nothing: 6 session overshoots with one and 6 without, which is what
  // confirms the youth ceiling rather than the runner's answer is what shapes these plans.
  assert.equal(all.length, 162, `the sweep measured ${all.length} plans, not the 162 these bounds were set from`);
  assert.ok(overSession <= 12, `plans over the session ceiling rose to ${overSession} (was 12 of 162)`);
  assert.ok(overWeek <= 31, `plans over the weekly ceiling rose to ${overWeek} (was 31 of 162)`);
  assert.ok(worstSession <= 1.10, `worst session overshoot ${(worstSession * 100 - 100).toFixed(1)}% (was 9.3%)`);
  assert.ok(worstWeek <= 1.15, `worst weekly overshoot ${(worstWeek * 100 - 100).toFixed(1)}% (was 13.6%)`);
});

test("BLOCKER: a 12-17 runner gets one quality session a week, never two", () => {
  for (const age of [12, 14, 16, 17]) for (const goal of goalsAt(age)) {
    for (const experience of EXPS) {
      if (experience === "competitive" && age < 15) continue;
      const plan = build(age, goal, experience, 5);
      for (const w of trainingWeeks(plan.weeks)) {
        assert.ok(w.qualitySessionCount <= 1,
          `${age} ${goal} ${experience} week ${w.index}: ${w.qualitySessionCount} quality sessions`);
      }
    }
  }
  // The adult it is measured against still gets two, or this proves nothing about the youth rule.
  const adult = build(undefined, "10k", "competitive", 5);
  assert.ok(trainingWeeks(adult.weeks).some((w) => w.qualitySessionCount >= 2),
    "an adult no longer gets two quality sessions, so the youth cap is not what is being measured");
});

test("BLOCKER: under 15 the MAIN track never rehearses a race pace", () => {
  /**
   * ⚠️ THE MAIN TRACK ONLY, AND THE DISTINCTION IS THE POINT RATHER THAN AN EXEMPTION. What the
   * research withholds from a 12-14 year old is an adult goal-pace rehearsal -- the main track's
   * "8 x 1 km at goal race pace", measured at 8.6 km against a 6 km whole-session ceiling. The
   * BEGINNER track's own version is "6 x 1′ at race pace": short, TIMED rather than distance-gated,
   * and inside the ceiling. That is precisely the shape the youth sources call for, and this repo
   * already reasoned its way to it once -- the beginner quality diet prescribes timed reps because a
   * hand-authored distance dose costs whatever the runner's pace makes it.
   * ⚠️ So the first version of this guard, which forbade every race-specific session under 15, was
   * wrong: it failed on the one implementation the evidence supports.
   */
  for (const age of [12, 13, 14]) for (const experience of EXPS) {
    if (experience === "competitive" || experience === "beginner") continue;
    const plan = build(age, "5k", experience, 3);
    for (const w of trainingWeeks(plan.weeks)) {
      for (const s of w.sessions) {
        assert.notEqual(s.type, "race-specific",
          `age ${age} ${experience} week ${w.index}: ${s.title}`);
      }
    }
  }
  // ⚠️ AND THE BEGINNER TRACK KEEPS ITS OWN, or this reads as a ban rather than an age rule.
  const beg = build(13, "5k", "beginner", 3);
  assert.ok(beg.weeks.some((w) => w.sessions.some((s) => s.type === "race-specific")),
    "the beginner track lost its short timed race-pace reps, which the research supports");
  // ⚠️ AND 15 UP STILL DOES, or this is a ban rather than an age rule. Hudson's own conservative plan
  // withholds race-pace work from the youngest band and gives it back as they grow.
  const at17 = build(17, "half", "competitive", 5);
  assert.ok(at17.weeks.some((w) => w.sessions.some((s) => s.type === "race-specific")),
    "a 17-year-old lost goal-pace work entirely");
});

test("BLOCKER: every adult plan is byte-identical to the one built before any of this existed", () => {
  /**
   * ⚠️ THE WHOLE SAFETY ARGUMENT FOR Y2 IS THIS TEST. Each lever is a Math.min against a ceiling that
   * is Infinity for an adult, or a branch gated on a null. Absent age must therefore change nothing
   * at all -- and "absent" is every profile this app has ever stored.
   */
  for (const goal of ["5k", "10k", "half"]) for (const experience of EXPS) for (const days of [3, 5]) {
    // ⚠️ THE ECHOED `athlete` IS EXCLUDED, AND NOTHING ELSE IS. A Plan carries its input back, so one
    // built with `age: 34` differs there by construction and comparing the whole object proves only
    // that the field was passed. Everything DERIVED -- the weeks, the paces, the notes, the model,
    // the length -- is what must not move, and it is compared in full.
    const derived = (pl: ReturnType<typeof build>) => {
      const { athlete: _ignored, ...rest } = pl as unknown as Record<string, unknown>;
      return JSON.stringify(rest);
    };
    const withoutAge = derived(build(undefined, goal, experience, days));
    for (const age of [18, 19, 34, 71]) {
      assert.equal(derived(build(age, goal, experience, days)), withoutAge,
        `${goal} ${experience} ${days}d: age ${age} built a different plan from no age at all`);
    }
  }
});

test("BLOCKER: a youth ceiling is never lifted back by the intensity walk-back", () => {
  /**
   * ⚠️ THE ONE PLACE Y2 COULD SILENTLY UNDO ITSELF. A down-scaled plan that breaches the pyramidal
   * easy floor is bisected back toward full size -- right for an adult, whose stated mileage is a
   * preference, and wrong for a ceiling that is a governing body's rule. Driven rather than grepped:
   * the youth plan must stay smaller than the same plan built without an age.
   */
  /**
   * ⚠️ A STATED WEEKLY MILEAGE IS WHAT MAKES THIS REACHABLE AT ALL, and without it this guard was
   * vacuous. The walk-back lives inside `if (targetPeakKm && !beginner)`, and `targetPeakKm` is null
   * for a runner who stated nothing -- so the adult fit never ran, `scale` stayed 1, and the branch
   * under test could not execute. Watched escaping its own re-break before the fixture was fixed:
   * the fixture-too-kind trap, in the one guard whose whole subject is that branch.
   * ⚠️ The figure is deliberately HIGH for the age -- a youth who tells us they run 45 km a week is
   * exactly the case where the adult fit scales down hard and the floor check wants to lift it back.
   */
  for (const [age, goal] of [[13, "5k"], [15, "10k"], [16, "10k"]] as Array<[number, string]>) {
    const youth = measure(build(age, goal, "competitive", 5, 45).weeks);
    const adult = measure(build(undefined, goal, "competitive", 5, 45).weeks);
    assert.ok(youth.week < adult.week,
      `age ${age} ${goal}: the youth week (${youth.week.toFixed(1)}) is not smaller than the adult one (${adult.week.toFixed(1)})`);
    assert.ok(youth.week <= youthLimitsFor(age)!.maxWeeklyKm * 1.15,
      `age ${age} ${goal}: week ${youth.week.toFixed(1)} is far past the ceiling`);
  }
});
