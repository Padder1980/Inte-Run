import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { easyHillStrides } from "../src/plan/session-templates.ts";
import type { SessionContent } from "../src/plan/session-templates.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";

/**
 * HILL SPRINTS ARE A WEEKLY STAPLE, NOT A ROTATION FLAVOUR.
 *
 * Short maximal hill sprints are the cheapest neuromuscular work there is - ten seconds, no aerobic
 * cost, and the gradient caps the speed so the forces stay low - and their whole value is FREQUENCY.
 * They were one of EIGHT easy-run flavours, so a runner met them about one easy run in eight:
 * measured on a real 17-week block, six sessions in the whole plan, clustered in weeks 1-2 and 9-10.
 * As an occasional novelty they do nothing at all.
 *
 * ⚠️ EVERY CLAIM HERE IS DRIVEN THROUGH `generatePlan` AND READ OFF REAL SESSIONS. A source-text
 * assertion would prove the dose function exists, which is a different claim from a runner meeting
 * the sprints - and this repo has shipped that exact gap (a marathon-prediction correction that was
 * written, tested, documented and called by nothing).
 *
 * ⚠️ AND HILL WORK IS IDENTIFIED STRUCTURALLY, NEVER BY TITLE. A hill repetition carries NO pace by
 * design, because pace up a hill is a function of the gradient. Matching /hill/i on a title would go
 * stale silently the first time a format was renamed.
 */

const athlete = (over: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1500 },
  experience: "recreational",
  includeStrength: true,
  includeMobility: true,
  longRunDay: 6,
  ...over,
} as Athlete);

const goal = (over: Partial<Goal> = {}): Goal => ({
  distance: "half",
  raceDateIso: "2027-03-07",
  targetTimeSeconds: 6300,
  ...over,
} as Goal);

const plan = (a: Athlete = athlete(), g: Goal = goal()) =>
  generatePlan(a, g, { startDateIso: "2026-09-07" }).weeks;

/** A repetition with no pace target IS hill work. The structural test, not the title. */
const unpacedReps = (s: SessionContent) =>
  (s.steps ?? []).filter((st) => st.kind === "rep" && st.targetPaceSecPerKm == null).length;
const pacedReps = (s: SessionContent) =>
  (s.steps ?? []).filter((st) => st.kind === "rep" && st.targetPaceSecPerKm != null).length;
/**
 * The sprint day specifically: a non-quality running session carrying unpaced reps.
 *
 * ⚠️ BOTH TYPES, BECAUSE THE TWO TRACKS TYPE IT DIFFERENTLY AND BOTH ARE RIGHT. `easyHillStrides` is
 * typed "strides", the non-beginner convention it shares with easy + strides; `contHillSprints` is
 * typed "easy", because a beginner's version IS an easy run with a few sprints in it and that is how it
 * is titled. Keying on either type alone silently measures one track and reports on both.
 */
const sprintDay = (w: PlannedWeek) =>
  w.sessions.find((s) => (s.type === "strides" || s.type === "easy") && unpacedReps(s) > 0);
const hillWeek = (w: PlannedWeek) => w.sessions.some((s) => unpacedReps(s) > 0);
const eligible = (w: PlannedWeek) => !w.isDeload && w.phase !== "taper";

test("BLOCKER: hill sprints reach the great majority of eligible weeks, at every day-count", () => {
  // The whole point of the change. Before it, measured, a runner met them in about one easy run in
  // eight. The bar is set BELOW what every swept configuration delivers and far above the old
  // behaviour, so it discriminates: measured 13/18 at three running days and 17/18 at six.
  // ⚠️ SEVEN DAYS IS IN THE SWEEP, and leaving it out let a real defect escape: `pickSprintSlot`
  // excludes the seventh-day recovery jog, and a re-break that made it eligible had the slot point at
  // a day the gate then suppresses — so a 7-day runner lost the sprint day ENTIRELY, with a plausible
  // frequency everywhere else. The form offers 3 to 7 and buildWeek delivers six runs plus a jog.
  for (const daysPerWeek of [3, 4, 5, 6, 7]) {
    for (const distance of ["5k", "10k", "half", "marathon"] as const) {
      const weeks = plan(athlete({ daysPerWeek }), goal({ distance }));
      const elig = weeks.filter(eligible);
      const withHills = elig.filter(hillWeek).length;
      assert.ok(elig.length >= 12, `${distance}/${daysPerWeek}d: only ${elig.length} eligible weeks to judge`);
      assert.ok(withHills / elig.length >= 0.6,
        `${distance}/${daysPerWeek}d: hill work in only ${withHills} of ${elig.length} eligible weeks — ` +
        "the staple has gone back to being a rotation flavour");
    }
  }
});

test("BLOCKER: the dose is introduced small and built, never handed out at full size", () => {
  // Connective tissue adapts more slowly than the cardiovascular system, so the number of contacts is
  // what earns its way up - never the effort of each one. A fixed dose is the defect: it either starts
  // a new runner at the maintenance load or never reaches it.
  const weeks = plan();
  const doses = weeks.filter(eligible)
    .map((w) => { const s = sprintDay(w); return s ? unpacedReps(s) : null; })
    .filter((n): n is number => n != null);
  assert.ok(doses.length >= 8, `only ${doses.length} sprint days to read a progression from`);
  const first = doses[0]!;
  const last = doses[doses.length - 1]!;
  assert.ok(first <= 3, `the first sprint day already prescribes ${first} sprints`);
  assert.ok(last >= 6, `the dose never reaches the maintenance load — it settles at ${last}`);
  assert.ok(last > first, "the dose does not build at all");
  // Monotone: it climbs and then holds, it never falls back.
  for (let i = 1; i < doses.length; i++) {
    assert.ok(doses[i]! >= doses[i - 1]!,
      `the dose went backwards: ${doses[i - 1]} → ${doses[i]} at sprint day ${i + 1}`);
  }
});

test("BLOCKER: no sprints on a deload, in the taper, or for a runner returning from injury", () => {
  // Each refusal is one the easy-run flavours already honour, and the returning one is the reason that
  // rule exists at all - tissue is what is still healing.
  const weeks = plan();
  for (const w of weeks) {
    if (w.isDeload) assert.equal(sprintDay(w), undefined, `week ${w.index} is a deload and carries the sprint day`);
    if (w.phase === "taper") assert.equal(sprintDay(w), undefined, `week ${w.index} is a taper week and carries the sprint day`);
  }
  const returning = plan(athlete({ returningFromInjury: true }));
  const anySprintDay = returning.filter((w) => sprintDay(w) !== undefined);
  assert.equal(anySprintDay.length, 0,
    `a runner returning from injury was given the sprint day in ${anySprintDay.length} weeks`);
});

test("BLOCKER: the sprints are HELD through the sharpening phase, not dropped at the end of build", () => {
  // A block that removes its neuromuscular work exactly when the racing starts spends its last month
  // losing what it built. The old gate was base/build only.
  const weeks = plan();
  const peak = weeks.filter((w) => w.phase === "peak" && eligible(w));
  assert.ok(peak.length >= 2, `only ${peak.length} eligible peak weeks to judge`);
  const withHills = peak.filter(hillWeek).length;
  assert.ok(withHills >= Math.ceil(peak.length * 0.6),
    `hill work survives in only ${withHills} of ${peak.length} eligible peak weeks`);
});

test("BLOCKER: a week whose quality session is already hill work does not also get the sprint day", () => {
  // Five quality formats are hill sessions, up to 10 x 50 m maximal reps - the heaviest connective-
  // tissue load in the library. A week that draws one and ALSO gets the sprint day asks the same
  // tissue twice. The sprint day is the smaller dose, so it gives way.
  let checked = 0;
  for (const daysPerWeek of [4, 5, 6]) {
    for (const distance of ["5k", "10k", "half"] as const) {
      for (const w of plan(athlete({ daysPerWeek }), goal({ distance }))) {
        const qualityHill = w.sessions.some(
          (s) => (s.type === "vo2" || s.type === "threshold") && unpacedReps(s) > 0,
        );
        if (!qualityHill) continue;
        checked++;
        assert.equal(sprintDay(w), undefined,
          `${distance}/${daysPerWeek}d week ${w.index}: a hill quality session AND the sprint day`);
      }
    }
  }
  assert.ok(checked >= 3,
    `the sweep found only ${checked} weeks with a hill quality session — it cannot see the defect`);
});

test("BLOCKER: relaxed strides survive the sprint day, at every day-count", () => {
  // ⚠️ THIS IS THE REGRESSION THE CHANGE ACTUALLY SHIPPED ONCE. The sprint day took the first easy
  // slot every week, so a plan could contain NO relaxed-strides session anywhere - and
  // `sessionLibrary`'s representative for "Easy + Strides" in the build-your-own picker then becomes
  // the maximal hill-sprint session, handing a runner who asked for strides a set of sprints.
  // Measured on a 4-day 5 km block before the fix: 24 strides-typed sessions, not one of them strides.
  // ⚠️ The 4-day case is the discriminating one and a 3-day fixture cannot see it: the rotation index
  // is `index + ei` and the pool is EIGHT long while deloads fall every FOUR weeks, so for an odd `ei`
  // the strides position aliases exactly onto the deload weeks, where the pool has no strides in it.
  for (const daysPerWeek of [3, 4, 5, 6]) {
    const weeks = plan(athlete({ daysPerWeek }), goal({ distance: "5k" }));
    const realStrides = weeks.flatMap((w) => w.sessions)
      .filter((s) => s.type === "strides" && pacedReps(s) > 0);
    assert.ok(realStrides.length >= 1,
      `${daysPerWeek}d: the plan contains no relaxed-strides session at all, so the custom-run ` +
      "picker's representative for Easy + Strides can only be a hill-sprint session");
  }
});

test("the builder's default dose is the maintenance load, so every existing caller is unchanged", () => {
  // The rep count became a parameter. Its default has to be what the constant was, or every other
  // caller's session quietly changed size.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  const dflt = easyHillStrides(paces, 40);
  assert.equal(unpacedReps(dflt), 6, "the default dose is no longer the 6-sprint maintenance load");
  assert.equal(unpacedReps(easyHillStrides(paces, 40, 2)), 2, "the dose parameter is not honoured");
  assert.equal(unpacedReps(easyHillStrides(paces, 40, 9)), 9, "the dose parameter is capped somewhere it should not be");
});

/**
 * THE BEGINNER TRACK GETS THEM TOO — it had no neuromuscular work of any kind.
 *
 * ⚠️ MEASURED BEFORE THIS: 0 sessions containing an unpaced repetition across a real 26-week beginner
 * block, at either beginner status. The track is NOT bare — it has progressions, explore runs and
 * "easy + gentle pickups", which is already a light fartlek — so the thing genuinely missing was force
 * production, which is the cheapest thing to give a new runner and the one their stride most needs.
 */

const beginner = (over: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 4,
  recent: { distanceMeters: 5000, timeSeconds: 2250 },
  experience: "beginner",
  runWalk: false,
  includeStrength: true,
  includeMobility: true,
  longRunDay: 6,
  returningFromInjury: false,
  ...over,
} as Athlete);

const begPlan = (over: Partial<Athlete> = {}, distance: Goal["distance"] = "10k") =>
  generatePlan(beginner(over), goal({ distance, targetTimeSeconds: 3300 }), { startDateIso: "2026-09-07" }).weeks;

test("BLOCKER: a continuous beginner meets hill sprints most weeks, where they met none at all", () => {
  for (const distance of ["5k", "10k", "half"] as const) {
    const weeks = begPlan({}, distance);
    const elig = weeks.filter(eligible);
    const withHills = elig.filter(hillWeek).length;
    assert.ok(elig.length >= 10, `${distance}: only ${elig.length} eligible weeks to judge`);
    assert.ok(withHills / elig.length >= 0.8,
      `${distance} beginner: hill work in only ${withHills} of ${elig.length} eligible weeks`);
  }
});

test("BLOCKER: a beginner's dose is smaller and slower to build than the main track's", () => {
  // The effort of one sprint is the same at every level. What a new runner cannot absorb is the NUMBER
  // of them, so the beginner starts at ONE and settles at FOUR where the main track goes 2 to 6.
  const doses = begPlan().filter(eligible)
    .map((w) => { const s = sprintDay(w); return s ? unpacedReps(s) : null; })
    .filter((n): n is number => n != null);
  assert.ok(doses.length >= 8, `only ${doses.length} beginner sprint days to read a progression from`);
  assert.equal(doses[0], 1, `a beginner's first sprint day prescribes ${doses[0]} sprints, not one`);
  const peak = Math.max(...doses);
  assert.equal(peak, 4, `a beginner's dose settles at ${peak}, not four`);
  for (let i = 1; i < doses.length; i++) {
    assert.ok(doses[i]! >= doses[i - 1]!, `the beginner dose went backwards at sprint day ${i + 1}`);
  }
  // And it must genuinely be gentler than the main track, not merely different.
  const mainDoses = plan().filter(eligible)
    .map((w) => { const s = sprintDay(w); return s ? unpacedReps(s) : null; })
    .filter((n): n is number => n != null);
  assert.ok(Math.max(...mainDoses) > peak,
    "the beginner's settled dose is not smaller than the main track's");
  assert.ok(mainDoses[0]! > doses[0]!, "the beginner does not start smaller than the main track");
});

test("BLOCKER: a run-walk beginner gets none, and that is the scoping decision", () => {
  // ⚠️ A DELIBERATE NARROWING OF THE METHOD, RECORDED AS ONE. A run-walk beginner cannot yet run
  // twenty minutes without stopping, which is below the lowest tier any of this is written for; their
  // plan is already interval-shaped and their first job is to become a continuous runner. There is no
  // run-walk hill format, so this is a scope boundary rather than an oversight — and it is the owner's
  // to overturn, which is why it is asserted rather than left to be discovered.
  const weeks = begPlan({ runWalk: true, daysPerWeek: 3 });
  const withHills = weeks.filter(hillWeek);
  assert.equal(withHills.length, 0,
    `a run-walk beginner was given hill sprints in ${withHills.length} weeks`);
  // ...and their plan is still a run-walk plan, so nothing was quietly swapped out from under them.
  const runWalkish = weeks.flatMap((w) => w.sessions).filter((s) => /run.walk/i.test(s.title ?? ""));
  assert.ok(runWalkish.length >= 10, "the run-walk beginner's own sessions have gone missing");
});

test("BLOCKER: no beginner sprints on a deload, in the taper, or when returning", () => {
  for (const w of begPlan()) {
    if (w.isDeload) assert.equal(sprintDay(w), undefined, `beginner week ${w.index} is a deload and has sprints`);
    if (w.phase === "taper") assert.equal(sprintDay(w), undefined, `beginner week ${w.index} is a taper week and has sprints`);
  }
  const ret = begPlan({ returningFromInjury: true }).filter((w) => sprintDay(w) !== undefined);
  assert.equal(ret.length, 0, `a returning beginner was given sprints in ${ret.length} weeks`);
});

test("BLOCKER: the beginner sprint session is the length its title claims", () => {
  // ⚠️ ITS SIBLING SHIPPED THIS DEFECT. `contPickups` added the pickups ON TOP of the named minutes and
  // delivered exactly one minute more than its title at every duration — visible on the owner's own
  // screen, "25′ easy + gentle pickups" with a chip reading 26 min. A beginner reading "30 minutes" and
  // running 34 is the same defect with more of it, so every added second — the sprints AND the
  // walk-backs — comes out of the easy portion.
  let checked = 0;
  for (const distance of ["5k", "10k", "half"] as const) {
    for (const w of begPlan({}, distance)) {
      const s = sprintDay(w);
      if (!s) continue;
      const named = Number(/^(\d+)/.exec(s.title ?? "")?.[1]);
      assert.ok(Number.isFinite(named), `no minute count in the title: ${s.title}`);
      const secs = (s.steps ?? []).reduce((t, st) => t + (st.durationSeconds ?? 0), 0);
      checked++;
      assert.ok(Math.abs(secs / 60 - named) <= 0.5,
        `${distance} week ${w.index}: "${s.title}" delivers ${(secs / 60).toFixed(1)} minutes`);
    }
  }
  assert.ok(checked >= 15, `only ${checked} beginner sprint sessions checked`);
});

test("BLOCKER: the sprint day is the same length as the easy runs beside it", () => {
  // ⚠️ COMPARED AGAINST THE **TIMED** SIBLINGS, AND EXACTLY. A first version compared against any easy
  // sibling with a five-minute tolerance derived from `roundMinutes` — and a five-minute tolerance is
  // wide enough to hide a drift: re-broken by giving `beginnerRun` its own lerp(26, 42, f), the sprint
  // day came out 25′ beside a 28′ run and the guard passed. The sibling flavours that go through
  // `roundMinutes` from the same `beginnerEasyMin` must match to the MINUTE, so that is the claim; the
  // distance-set `easyRun` flavour is the only one that legitimately differs and it is excluded by
  // asking for a minute figure in the title.
  let exact = 0;
  for (const w of begPlan()) {
    const s = sprintDay(w);
    if (!s) continue;
    // ⚠️ THE MINUTE PRIME IS PART OF THE MATCH. /^(\d+)/ alone reads the "2" out of "2.3 km easy run"
    // and then compares a distance against a duration — measured, it reported a real drift where there
    // was none, which is a ruler fault dressed as a defect.
    const MINS = /^(\d+)\u2032/;
    const named: number = Number(MINS.exec(s.title ?? "")?.[1]);
    assert.ok(Number.isFinite(named), `the sprint session's title has no minute figure: ${s.title}`);
    for (const o of w.sessions) {
      if (o === s || o.type !== "easy") continue;
      const sib: number = Number(MINS.exec(o.title ?? "")?.[1]);
      if (!Number.isFinite(sib)) continue; // a distance-set sibling — no minute figure to compare
      exact++;
      assert.equal(named, sib,
        `week ${w.index}: "${s.title}" beside "${o.title}" — the two builders no longer share one ` +
        "definition of how long a beginner's ordinary run is");
    }
  }
  assert.ok(exact >= 6, `only ${exact} timed siblings to compare against — the sweep cannot see a drift`);
});

test("the sprint day is in the same range as the distance-set easy runs beside it", () => {
  // One definition of a continuous beginner's non-long run length, read by both builders. A second copy
  // would be two answers to one question, and the day they drifted the sprint day would silently be a
  // different length from the easy run next to it — with nothing failing.
  let compared = 0;
  for (const w of begPlan()) {
    const s = sprintDay(w);
    if (!s) continue;
    const others = w.sessions.filter(
      (o) => o !== s && o.type === "easy" && (o.steps ?? []).length > 0,
    );
    for (const o of others) {
      // ⚠️ READ THE ENGINE'S OWN FIGURE, NOT A SUM OF durationSeconds. Some easy runs are set by
      // DISTANCE now, so a step-duration sum reads them as zero minutes — measured, "the sprint day is
      // 25′ beside a 0′ easy run", which is the ruler failing and not the plan. `assemble` derives
      // estimatedDurationSeconds gate-agnostically, so it is the same answer every model sees.
      const a = s.estimatedDurationSeconds ?? 0;
      const b = o.estimatedDurationSeconds ?? 0;
      assert.ok(a > 0 && b > 0, `week ${w.index}: a session reports no duration at all`);
      compared++;
      // ⚠️ THE TOLERANCE IS ONE ROUNDING UNIT, DERIVED AND NOT PICKED. `roundMinutes` takes a timed
      // beginner run UP to the next multiple of five (the owner's ruling), and the sprint day goes
      // through it while CONT_FLAVOURS[0] — the standard easyRun — does not. So a legitimate gap of up
      // to four minutes exists between two sessions built from the same minute count, and anything
      // beyond five means the sprint day is being sized from a different ramp: a fixed length or the
      // long run's would show as ten minutes or more. Measured on week 2: 25′ against 23′.
      assert.ok(Math.abs(a - b) <= 5 * 60 + 1,
        `week ${w.index}: the sprint day is ${(a / 60).toFixed(0)}′ beside a ${(b / 60).toFixed(0)}′ easy run — ` +
        "further apart than the multiple-of-five rounding can explain");
    }
  }
  assert.ok(compared >= 8, `only ${compared} same-week comparisons available`);
});

test("BLOCKER: the beginner track still carries no threshold, VO2 or race-specific session", () => {
  // ⚠️ THE DOCUMENTED DESIGN RULE, AND ADDING SPRINTS MUST NOT HAVE BREACHED IT. A beginner's
  // progression is deliberately gentle and quality-free; hill sprints are neuromuscular work with
  // near-zero aerobic cost, which is precisely why they are the one thing that can be added here.
  for (const runWalk of [false, true]) {
    for (const w of begPlan({ runWalk, daysPerWeek: runWalk ? 3 : 4 })) {
      assert.equal(w.qualitySessionCount ?? 0, 0, `beginner week ${w.index} reports a quality session`);
      const quality = w.sessions.filter(
        (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
      );
      assert.deepEqual(quality.map((s) => s.title), [],
        `beginner week ${w.index} carries a quality session`);
    }
  }
});

test("BLOCKER: the sprint day is not the recovery day after a hard session", () => {
  // ⚠️⚠️ IT WAS, SYSTEMATICALLY. The sprint day used to be the FIRST easy day, and relative to the long
  // run quality sits at rel 2 and 4 while EASY_REL opens at rel 3 — directly between them. Measured
  // over 1,232 sprint days across 72 profiles: 74% fell the day AFTER a quality session, 18% between
  // two of them, and 83% shared the day with a strength session. The day after hard work is a recovery
  // day; the week's only maximal neuromuscular work is the one thing that undoes what it is for.
  // After choosing the slot by distance instead of position: 20% / 1% / 0%.
  //
  // ⚠️ NO SLOT IS CLEAR — three hard days in seven means every easy day touches something — so this is
  // a least-bad bound and not a clean one. The bar is set between the two measured states, well above
  // what the code delivers and far below what it delivered before, so it discriminates.
  let total = 0, afterQuality = 0, betweenTwo = 0, withStrength = 0, afterLong = 0;
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const daysPerWeek of [4, 5, 6]) {
      for (const timeSeconds of [1100, 1500, 2100]) {
      for (const experience of ["recreational", "competitive"] as const) {
        const weeks = plan(
          athlete({ daysPerWeek, experience, recent: { distanceMeters: 5000, timeSeconds } }),
          goal({ distance }));
        for (const w of weeks) {
          const sp = w.sessions.find((s) => (s.type === "strides" || s.type === "easy") && unpacedReps(s) > 0);
          if (!sp) continue;
          const d = (sp as { dayOfWeek: number }).dayOfWeek;
          const on = (dd: number) => w.sessions.filter(
            (s) => (s as { dayOfWeek: number }).dayOfWeek === ((dd % 7) + 7) % 7);
          const hard = (dd: number) => on(dd).some(
            (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific");
          total++;
          if (hard(d - 1)) afterQuality++;
          if (hard(d - 1) && hard(d + 1)) betweenTwo++;
          if (on(d).some((s) => s.type === "strength")) withStrength++;
          // ⚠️ THE LONG RUN COUNTS AS HARD WORK FOR "THE DAY AFTER" TOO, and leaving it out of this
          // check let a re-break that dropped it from the slot scorer escape entirely. The day after
          // the week's biggest session is its most important recovery day.
          if (on(d - 1).some((s) => s.type === "long")) afterLong++;
        }
      }
      }
    }
  }
  assert.ok(total >= 500, `only ${total} sprint days measured — the sweep cannot see the pattern`);
  const pc = (n: number) => Math.round((100 * n) / total);
  assert.ok(pc(afterQuality) <= 40,
    `${pc(afterQuality)}% of sprint days are the day after a quality session (was 74% when the slot ` +
    "was simply the first easy day)");
  assert.ok(pc(betweenTwo) <= 8,
    `${pc(betweenTwo)}% of sprint days sit between two quality sessions (was 18%)`);
  assert.ok(pc(withStrength) <= 20,
    `${pc(withStrength)}% of sprint days share the day with a strength session (was 83%)`);
  assert.equal(afterLong, 0,
    `${pc(afterLong)}% of sprint days are the day after the long run — the week's biggest recovery day`);
});
