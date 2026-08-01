// Top-level plan generator: goal + athlete → a periodized plan of weeks and sessions.
//
// It composes the science layer (paces, intensity model, taper) with periodization and the session
// library. Design rules encoded here, all traceable to the research brief:
//  - pyramidal by default (lots of easy, some threshold, little VO2); polarized optional
//  - one quality session/week in base and when returning from injury; two once building
//  - a long run every week, progressing in duration (durability), backing off on deload/taper
//  - hard days never back-to-back
//  - strength 2×/week through base/build, easing to 1× near the race (when enabled)
//  - the plan spans the whole runway: surplus time extends a progressive base (opening with a
//    pure-aerobic foundation block), while build/peak/taper stay concentrated near the race

import type {
  Athlete,
  Goal,
  IntensityModel,
  Phase,
  PlannedWeek,
  Session,
  SessionType,
  TrainingPaces,
} from "../domain/types.ts";
import {
  TID_TARGETS,
  TID_TOLERANCE,
  chooseModel,
  computeDistribution,
  honoursModel,
} from "../science/intensity-distribution.ts";
import { computeMas, masVo2Range } from "../science/mas.ts";
import { deriveTrainingPaces, reconcileVo2, withHrZones } from "../science/paces.ts";
import { taperFor } from "../science/taper.ts";
import { addDays, dayOfWeekMondayZero, daysBetween, isoToday, weeksBetween } from "./dates.ts";
import { type WeekPlan, phaseSchedule, structuredWeekCount } from "./periodization.ts";
import {
  contExplore,
  contPickups,
  contProgression,
  easyHillStrides,
  easyRun,
  generalStrengthSession,
  longRun,
  mobilitySession,
  raceDay,
  raceSpecificSession,
  restDay,
  rwBuildup,
  rwExplore,
  rwLadder,
  rwLong,
  rwSteady,
  type SessionContent,
  strengthSession,
  taperSession,
  moderateRun,
  easyProgression,
  recoveryRun,
  raceIsBig,
  thresholdIsBig,
  thresholdSession,
  vo2IsBig,
  vo2Session,
} from "./session-templates.ts";
import type { FormatCtx } from "./session-templates.ts";

export type GenerateOptions = {
  intensityModel?: IntensityModel;
  startDateIso?: string;
};

const PEAK_LONG_MIN: Record<Goal["distance"], number> = {
  "1mile": 55,
  "5k": 70,
  "10k": 85,
  half: 110,
  marathon: 150,
};

/**
 * Absolute ceiling on a long run, whatever the runner's mileage. Time on feet is the injury
 * currency: a marathoner running 140 km/week still should not be doing four-hour long runs, and
 * the standard advice caps the marathon long run around three hours.
 */
const LONG_CEILING_MIN: Record<Goal["distance"], number> = {
  "1mile": 75,
  "5k": 90,
  "10k": 110,
  half: 145,
  marathon: 180,
};

/**
 * The absolute cap: no long run in any plan exceeds this, whatever drives it.
 *
 * ⚠️ THIS IS A SECOND, HIGHER CEILING AND THE TWO ARE NOT INTERCHANGEABLE. `LONG_CEILING_MIN` caps
 * long runs grown by the VOLUME model, and must stay where it is — a marathoner running 140 km/week
 * should not be doing four-hour long runs just because their mileage is high. This one caps long runs
 * driven by the DISTANCE floor, where the runner is slow rather than high-mileage, and the extra time
 * buys distance they genuinely need rather than volume they already have.
 *
 * Raising `LONG_CEILING_MIN` itself to 240 instead would be a serious bug: `peakLong` is
 * `PEAK_LONG_MIN x vScale`, so a 2:30 marathoner stating a big mileage would scale straight past
 * three hours into a **60 km** long run. The volume cap is what stops that, and it has to keep doing
 * so.
 *
 * The marathon is the only event that needs the headroom. Reaching 25 km — the figure the evidence
 * report ties to a faster marathon ("<25 km slower") — takes a 5:00 runner 3h36 and a 5:30 runner
 * 3h58, both past the three-hour cap, which is why those runners were topping out at 21.3 km and
 * 19.3 km. Owner's decision (2026-08-01), taking the research threshold over the time-on-feet
 * convention with the trade-off stated: a 5:30 marathoner now does a four-hour training run.
 */
const LONG_ABS_CEILING_MIN: Record<Goal["distance"], number> = {
  "1mile": 75,
  "5k": 90,
  "10k": 110,
  half: 145,
  marathon: 240,
};

/**
 * How far the peak long run should reach in DISTANCE, per event and ability.
 *
 * ⚠️ THE PLAN IS BUILT IN MINUTES, WHICH SILENTLY SHORT-CHANGES SLOWER RUNNERS. Everyone got the same
 * `PEAK_LONG_MIN`, so the same 110-minute half-marathon long run covered 22.4 km for a 1:25 runner and
 * **12.8 km for a 2:30 runner** — 61% of the race distance they were about to attempt, and below even
 * the evidence report's Beginner band. Minutes are the right currency for FATIGUE, which is why the
 * ceiling below stays in minutes; but the race is a distance, and durability for it is a distance too.
 *
 * Numbers are the lower edge of the "Event-specific long-run endpoint references" table in
 * `Evidence_Based_Running_Training_Prescription_Engine.html`, mapping InteRun's `recreational` to its
 * Intermediate row and `competitive` to Advanced (5 km 10/14, 10 km 12/16, half 16/20, marathon 24/28).
 *
 * ⚠️ THE HALF IS DELIBERATELY ABOVE ITS BAND FLOOR, at 21.5 km rather than 16. Its Intermediate band
 * is 16–24 km and the report's own evidence note for that row is "Moderate; >21 km associated with
 * faster performance" — Fokkema et al. 2020, n=997, where a longest run beyond 21 km predicted a
 * faster half. So exceeding the race distance is the supported target for a half specifically, and it
 * is what an experienced coach will tell you. It is NOT a universal rule: the same table tops the
 * marathon out at 28–35 km, well under 42.2 km, and puts a half BEGINNER at 12–18 km — under the race
 * distance on purpose. Beginners never reach this code anyway (`buildBeginnerWeek` ignores peakLong).
 *
 * `LONG_CEILING_MIN` still wins, and that is the safety valve: reaching 21.1 km takes a 2:30 runner
 * 182 minutes and a 2:45 runner 201, so they are capped rather than sent out for three hours before a
 * half marathon. They land as close as 145 minutes carries them, which is the honest answer.
 */
/**
 * The UPPER edge of the same endpoint table — no long run should exceed it.
 *
 * ⚠️ A minutes-based cap under-serves slow runners AND over-serves fast ones; `LONG_FLOOR_KM` fixes
 * the first half and this fixes the second. Measured: a 2:30 marathoner stating 120 km/week rode the
 * 180-minute volume cap all the way to a **44.4 km** long run — longer than the race itself, past the
 * Elite band's 40 km, and well past the report's ">35 km benefit uncertain in recreational cohort".
 * Three hours is a sane amount of time; at 4:00/km it is an insane distance.
 *
 * Upper edges, recreational → Intermediate and competitive → Advanced, as for the floor.
 */
const LONG_CAP_KM: Record<Goal["distance"], { recreational: number; competitive: number }> = {
  "1mile": { recreational: 12, competitive: 18 },   // not in the report; scaled from the 5 km row
  "5k": { recreational: 16, competitive: 22 },
  "10k": { recreational: 18, competitive: 26 },
  half: { recreational: 24, competitive: 30 },
  marathon: { recreational: 32, competitive: 35 },
};

/**
 * Where a BEGINNER's long run has to arrive, per event.
 *
 * ⚠️ THE BEGINNER TRACK USED TO IGNORE THE RACE ENTIRELY. `buildBeginnerWeek` was handed `longMin: 0`
 * and never read `goal.distance`, so its long run came from one hardcoded ramp — `lerp(22, 38, f) + 8`
 * — and topped out at **46 minutes for every goal there is**. Measured: a "building the habit" runner
 * on a 28-week HALF MARATHON plan progressed 2.9 km → **4.4 km** and was then sent to run 21.1 km, a
 * 5.0x jump against the report's 1.10 single-session guardrail; the long-run ladder was byte-identical
 * whether the goal was a 5 km or a marathon. A gentle plan is right for a beginner. A plan that never
 * arrives anywhere is not — it is the runner least able to judge the gap who is left to find it on
 * race day.
 *
 * Numbers are the lower edge of the report's **Beginner** row (5 km 6–10, 10 km 8–14, half 12–18,
 * marathon 16–25). Note the beginner half target is deliberately UNDER the race distance, where the
 * recreational one is over it: the report's own row says 12–18 km, and a first-timer's job is to
 * arrive able to finish, not to have rehearsed the whole thing.
 */
const BEGINNER_LONG_KM: Record<Goal["distance"], number> = {
  "1mile": 4,
  "5k": 6,
  "10k": 8,
  half: 12,
  marathon: 16,
};

/**
 * Time-on-feet ceiling for a beginner's long run — lower than the main track's, because the limit for
 * someone new is how long their legs tolerate being on the ground, not what their aerobic system can
 * take. A beginner aiming at a marathon reaches this rather than the 16 km, and that is the honest
 * answer: `assessFeasibility` is what should be arguing with that goal, not the long run.
 */
const BEGINNER_LONG_CEILING_MIN = 135;

const LONG_FLOOR_KM: Record<Goal["distance"], { recreational: number; competitive: number }> = {
  "1mile": { recreational: 8, competitive: 12 },   // not in the report; scaled from the 5 km row
  "5k": { recreational: 10, competitive: 14 },
  "10k": { recreational: 12, competitive: 16 },
  half: { recreational: 21.5, competitive: 22 },
  marathon: { recreational: 25, competitive: 28 },   // 25, not the band floor of 24: "<25 km slower"
};

/**
 * How far below its natural size a plan may be built. Reached only by someone stating a mileage far
 * under what their goal implies. Below it the per-session floors bind anyway — a 20-minute easy run
 * cannot shrink, and the long run does not shrink at all — so lowering this constant buys nothing
 * (measured at 0.45 / 0.35 / 0.25: identical anchoring, identical worst case).
 */
const MIN_VOLUME_SCALE = 0.45;

/**
 * How many weeks of this plan fall under the intensity model's easy floor?
 *
 * ⚠️ The RACE week is exempt, and only the race week — it contains a maximal effort over the race
 * distance, so judging it against a training distribution judges the race as if it were a workout.
 * Same exemption, same reason, as the sweep in test/session-library.test.ts.
 *
 * ⚠️ This returns a COUNT, not a yes/no, because the question that matters is comparative. A handful
 * of configurations (measured: 28 of 1792 weeks, worst 54.5% easy, a 3-day 5 km block for a slow
 * runner) sit under the floor with NO stated volume at all — so an absolute test would condemn the
 * scaled plan for a fault it inherited, and hand the runner back an unscaled plan that breaches just
 * as often. Compare like with like: down-scaling has to be no worse than the plan they would
 * otherwise have received.
 */
function intensityProfile(
  weeks: PlannedWeek[],
  model: IntensityModel,
): { breaches: number; minEasy: number } {
  let breaches = 0;
  let minEasy = 1;
  for (const w of weeks) {
    if (w.sessions.some((s) => s.type === "race")) continue;
    const d = computeDistribution(w.sessions);
    if (d.totalSeconds === 0) continue;
    if (d.easy < minEasy) minEasy = d.easy;
    if (!honoursModel(d, model)) breaches++;
  }
  return { breaches, minEasy };
}

/**
 * The easy fraction no week of a down-scaled plan may fall below.
 *
 * Normally the intensity model's own floor. But a handful of configurations already sit under it
 * before any scaling (measured: 28 of 1792 weeks, worst 54.5% easy — a 3-day 5 km block for a slow
 * runner, where one library-length quality session is simply a large share of a small week). Holding
 * a scaled plan to a standard its own unscaled version fails would condemn it for an inherited
 * fault and hand the runner back a plan that breaches just as often, with their mileage discarded.
 * So the bar is "no deeper than it already was", and in every healthy plan that IS the model floor.
 *
 * ⚠️ It is a FLOOR, not a comparison of minima. Requiring `cand.minEasy >= base.minEasy` sounds
 * equivalent and is not: every down-scale nudges some comfortable week down a little, so a plan
 * going from 80% to 75% easy — both far above the floor — would be rejected. Measured, that turned
 * the fix off for most runners (week-one anchoring fell from 90% back to 78%, and the headline
 * 25 km/week runner was handed the unchanged 35.5 km week again).
 */
function easyFloorFor(model: IntensityModel, base: { minEasy: number }): number {
  return Math.min(TID_TARGETS[model].easy - TID_TOLERANCE, base.minEasy) - 0.005;
}

/**
 * Accept a down-scaled plan only if it is worse than the unscaled one in NEITHER way: no extra weeks
 * under the model's floor, and no week deeper than the unscaled plan's own worst. Either test alone
 * has a measured hole — the count alone lets a shallow breach be swapped for a deep one (54.5% easy
 * became 47.1%), and the depth alone lets the number of breaching weeks drift up (28 became 33).
 */
function noWorse(
  cand: { breaches: number; minEasy: number },
  base: { breaches: number; minEasy: number },
  floor: number,
): boolean {
  return cand.breaches <= base.breaches && cand.minEasy >= floor;
}

/**
 * How much to scale the plan's volume for the runner actually in front of it.
 *
 * ⚠️ Until 2026-08-01 there was NO volume model. Session lengths came from the tables above, keyed
 * on race distance alone, so a 40 km/week runner and a 140 km/week runner training for the same
 * marathon got byte-identical plans — measured: stated volumes of 50, 90 and 140 produced exactly
 * the same peak, mean and long run. `Athlete.weeklyVolumeKmCurrent` existed but was read nowhere.
 * An elite coach's verdict on the result was "total mileage for a competitive runner looks a
 * little on the low side", and he was right for anyone above the reference.
 *
 * A block should build ABOVE where the runner is now, not merely reproduce it, but not by much —
 * PROGRESSION is the ceiling on adaptation. 25% over a block is already brisk beside the usual
 * "add 10% a week, then back off" guidance.
 *
 * Returns 1 (no change at all) when the runner has not told us their mileage, which keeps every
 * existing plan and every existing test exactly as it was.
 */
function targetPeakWeeklyKm(athlete: Athlete): number | null {
  const stated = athlete.weeklyVolumeKmCurrent;
  if (!stated || !Number.isFinite(stated) || stated <= 0) return null;
  // A block should build ABOVE where the runner is now, but not by much — progression is the
  // ceiling on adaptation, and 25% across a whole block is already brisk beside the usual
  // "add 10% a week, then back off" guidance.
  return stated * 1.25;
}

// Day-of-week scheduling (0 = Mon … 6 = Sun) is expressed RELATIVE to the long run, then rotated to
// whatever long-run day the athlete prefers. The offsets below reproduce the proven Sunday-long
// layout (quality Tue/Thu, easy Wed/Fri/Mon/Sat); because every spacing rule — hard days separated,
// hard days never adjacent to the long run — is rotation-invariant, the same rotation honours any
// chosen long-run day while preserving those rules.
const QUALITY_REL = [2, 4]; // days after the long run
const EASY_REL = [3, 5, 1, 6];
const MOB_PREF_REL = [3, 5, 1, 6, 4, 2]; // preferred order for the mobility / free day
const BEG_EASY_REL = [2, 4, 6]; // beginner easy days — a rest day always sits between runs
const BEG_STRENGTH_REL = [1, 5];
const dayRel = (longDay: number, rel: number) => (longDay + rel) % 7;
const longRunDayOf = (a: Athlete) => ((a.longRunDay ?? 6) % 7 + 7) % 7;

export function generatePlan(
  athlete: Athlete,
  goal: Goal,
  options: GenerateOptions = {},
): {
  goal: Goal;
  athlete: Athlete;
  createdAtIso: string;
  intensityModel: IntensityModel;
  paces: TrainingPaces;
  totalWeeks: number;
  weeks: PlannedWeek[];
  notes: string[];
} {
  const startIso = options.startDateIso ?? goal.startDateIso ?? isoToday();
  const raceMonday = addDays(goal.raceDateIso, -dayOfWeekMondayZero(goal.raceDateIso));
  // Count calendar weeks inclusive of the start week and the race week, so week 1 aligns to the
  // Monday of the athlete's start week (its earlier days are trimmed later for a mid-week start).
  const startWeekMonday = addDays(startIso, -dayOfWeekMondayZero(startIso));
  const totalWeeks = Math.max(0, weeksBetween(startWeekMonday, raceMonday) + 1);
  const structuredWeeks = structuredWeekCount(totalWeeks, goal.distance);

  const returning = athlete.returningFromInjury ?? false;
  const model = options.intensityModel ?? chooseModel(athlete);
  const paces = withHrZones(deriveTrainingPaces(athlete.recent, goal), athlete);
  // If the athlete has done a 1 km time trial, anchor VO₂/interval pace to their MAS — a direct,
  // test-based target rather than one projected from their race pace.
  if (athlete.oneKmTrialSeconds && athlete.oneKmTrialSeconds > 0) {
    // Reconciled, not replaced: a poor trial must not hand someone "intervals" slower than their
    // own threshold pace. See reconcileVo2.
    paces.vo2 = reconcileVo2(paces, masVo2Range(computeMas(athlete.oneKmTrialSeconds).masMps));
  }
  const schedule = annotate(phaseSchedule(structuredWeeks, goal.distance, returning));

  const targetPeakKm = targetPeakWeeklyKm(athlete);
  const nonTaperCount = schedule.filter((s) => s.phase !== "taper").length;
  const taper = taperFor(goal.distance);

  // Complete beginners get a gentler, purpose-built progression (run–walk or short easy running,
  // general strength, no intervals) rather than the standard threshold/VO2 structure.
  const beginner = athlete.experience === "beginner";
  const runWalk = athlete.runWalk ?? false;

  // The distance floor in MINUTES for this runner: how long their own easy pace takes to cover the
  // endpoint distance their event and ability call for. Computed once — the paces never change.
  const easySecPerKm = (paces.easy.minSecPerKm + paces.easy.maxSecPerKm) / 2;
  const minutesFor = (km: number) => Math.round((km * easySecPerKm) / 60);
  const abilityKey = athlete.experience === "competitive" ? "competitive" : "recreational";
  const longFloorMin = minutesFor(LONG_FLOOR_KM[goal.distance][abilityKey]);
  // The beginner track's own endpoint, on the same easy-pace conversion.
  const beginnerLongPeakMin = Math.min(
    BEGINNER_LONG_CEILING_MIN,
    minutesFor(BEGINNER_LONG_KM[goal.distance]),
  );
  // The last week that actually trains hard — where the beginner ramp should arrive.
  const lastHardWeek = schedule.reduce(
    (acc, wp, i) => (wp.phase !== "taper" && !wp.isDeload ? i + 1 : acc),
    1,
  );
  const longCapMin = minutesFor(LONG_CAP_KM[goal.distance][abilityKey]);

  const buildAll = (vScale: number): PlannedWeek[] => {
    // ⚠️ THE LONG RUN GROWS WITH MILEAGE BUT IS NEVER CUT BY IT — note the `Math.max(1, vScale)`,
    // which makes the scaling deliberately one-way. The long run answers the RACE, not the week: a
    // runner doing 25 km/week still has to build toward a 17 km long run before a half marathon, and
    // that progression IS the plan. What a smaller week should give up is easy filler and hard days.
    //
    // Letting vScale cut it was measured as destructive, because vScale reaches only the long run and
    // the easy runs — the easy runs stop at 20 minutes and quality never moves at all, so past a
    // modest shrink EVERY further unit came out of the long run alone. A marathon runner stating
    // 30 km/week got a longest run of 10.3 km (22.6 km unstated); a half-marathoner 8.8 km for a
    // 21.1 km race; and in 48 of 144 realistic profiles the "long run" ended up SHORTER than a
    // midweek workout in the same week — precisely the incoherence that made an earlier attempt
    // abandon down-scaling altogether. The intensity guard below cannot catch any of it: a shorter
    // long run removes easy minutes proportionally, so the RATIO stays healthy while the structure
    // falls apart. Measured with this rule, long-run size is identical to not scaling down at all
    // (mean longest-long/race-distance 1.20 either way; inversions 14.3% vs 14.4%), and week-one
    // anchoring still rises from 66% to 79% of profiles.
    // ⚠️ ORDER MATTERS. Cap the VOLUME-driven length first, then let the distance floor lift it, then
    // apply the absolute cap. Taking the floor before the volume cap would let a high-mileage runner
    // ride the higher ceiling and collect a four-hour long run they have not earned.
    const volumeDriven = Math.min(
      LONG_CEILING_MIN[goal.distance],
      Math.round(PEAK_LONG_MIN[goal.distance] * Math.max(1, vScale)),
    );
    // The distance cap is applied last but must never fight the floor — if a runner is slow enough
    // that the floor alone exceeds the cap in minutes, the floor wins and the absolute time ceiling
    // is what holds them. (Cap > floor by construction: every band's upper edge exceeds its lower.)
    const peakLong = Math.min(
      LONG_ABS_CEILING_MIN[goal.distance],
      Math.max(longFloorMin, Math.min(longCapMin, Math.max(longFloorMin, volumeDriven))),
    );
    const startLong = Math.round(peakLong * (returning ? 0.42 : 0.55));
    return schedule.map((wp, i) => {
      const weekIndex = i + 1;
      const startDateIso = addDays(raceMonday, -(structuredWeeks - weekIndex) * 7);
      if (beginner) {
        return buildBeginnerWeek(weekIndex, startDateIso, wp, { athlete, goal, paces, returning, longMin: beginnerLongPeakMin }, lastHardWeek, runWalk);
      }
      // ⚠️ END-ALIGNED: the LAST array entry belongs to race week, whatever got clamped. A short
      // runway clamps the taper (periodization.ts: structuredWeeks - 3), so a 4-week plan has ONE
      // taper week — and that week IS race week. Start-aligned indexing handed it mult[0], the
      // gentle first-week 0.72, instead of the race-week 0.55: measured, a runner entering a 10 km
      // 4 weeks out got a race-week long run 20% LONGER than before this taper existed. Aligning
      // from the end drops the gentle lead-in weeks and keeps the deepest cut on the race,
      // honouring the "last entry = race week" contract in taper.ts on every runway length.
      const mults = taper.volumeMultiplierByWeek;
      const taperMult = wp.phase === "taper"
        ? (mults[mults.length - wp.phaseTotal + wp.ordinalInPhase - 1] ?? mults[mults.length - 1] ?? 0.55)
        : 1;
      const longMin = longRunMinutes(
        wp,
        weekIndex,
        nonTaperCount,
        startLong,
        peakLong,
        taperMult,
      );
      return buildWeek(weekIndex, startDateIso, wp, {
        athlete, goal, paces, returning, longMin, vScale, taperMult,
      });
    });
  };

  // ⚠️ SOLVED BY ITERATION, not by a formula. Build unscaled to learn what THIS plan's natural
  // peak week actually is, then close the gap to the runner's target and rebuild, a few times.
  //
  // Two earlier attempts were wrong. Scaling against fixed reference constants ignored that the
  // natural peak depends on days-per-week as well as race distance. And a single corrective pass
  // does not land, because the week is not linear in the scale: quality sessions are prescribed by
  // the library and do not move at all, and the per-session floors and ceilings bind at the ends —
  // measured, one pass left a 50 km/week runner peaking at 81 km, a 62% jump rather than the 25%
  // intended. Iterating to a fixed point converges where the target is reachable and settles
  // honestly where it is not.
  //
  // ⚠️ Where it settles short is not a bug. Beyond roughly 130 km/week the caps bind because you
  // cannot run that mileage in six single runs — it needs DOUBLES, which the generator cannot
  // schedule yet. Better to hand a high-mileage runner an honest 130 than a fictional 175.
  //
  // Beginners are exempt: their progression is deliberately gentle and volume-independent.
  //
  // ⚠️ IT SCALES DOWN AS WELL AS UP, AND THAT IS THE POINT — a plan is only "built on what you
  // already do" if it starts near what you already do. The evidence spec says so three times over:
  // "Never jump an athlete to the bottom of a band", "If current tolerated volume is below the band,
  // start from current load", "Set week one near the athlete's recent baseline. Do not jump to band
  // minimum." Building UP only, which is what shipped first, meant a half-marathon runner who
  // answered 10, 25 or 40 km/week got a byte-identical plan opening at 35.5 km — 60% of non-beginner
  // answers changed nothing at all, while the question on screen promised otherwise.
  //
  // Scaling down is what BREAKS the easy-fraction floor if done naively (quality keeps its full
  // library length while the easy running shrinks around it), so the floor is enforced here by
  // CONSTRUCTION rather than by a blanket refusal: build the candidate, then check every week
  // against the intensity model, and walk the scale back toward 1 until it passes. A plan that
  // cannot be shrunk safely is simply not shrunk. That makes the invariant impossible to lose to a
  // future change in the session library, which a fixed floor of 1 never guaranteed — it only
  // avoided the question.
  // ⚠️ BUILD THE PLAN THE RUNNER ACTUALLY GETS, transforms and all, and judge THAT. The partial
  // first week and race day are not cosmetic: applyPartialFirstWeek deletes week 1's sessions before
  // the start day, and applyRaceDay clears race eve — both strip EASY running out of a week while
  // leaving its quality session in place. Validating the pre-transform weeks (which is what the
  // first version of this did) measured a plan nobody is ever given: 969 of 52,920 profiles were
  // delivered a first week under the easy floor that the check had passed, and the web layer
  // defaults the start date to today, so a partial first week is the normal case, not an edge one.
  const buildFull = (vScale: number): PlannedWeek[] => {
    const w = buildAll(vScale);
    applyPartialFirstWeek(w, startIso);
    applyRaceDay(w, goal, paces);
    return w;
  };
  // The fixed point is fitted on the FULL weeks only. Race week is a race, and the partial first
  // week is a fragment; neither describes how big this plan is, and letting either into the peak
  // measurement makes the fit chase a number the runner never trains at.
  const fittedPeakKm = (ws: PlannedWeek[]): number => {
    const full = ws.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
    return full.length ? Math.max(...full.map((w) => w.plannedDistanceMeters)) / 1000 : 0;
  };

  const natural = buildFull(1);
  let weeks = natural;
  if (targetPeakKm && !beginner) {
    let scale = 1;
    for (let pass = 0; pass < 5; pass++) {
      const peakKm = fittedPeakKm(weeks);
      if (peakKm <= 0) break;
      const ratio = targetPeakKm / peakKm;
      if (Math.abs(ratio - 1) < 0.03) break;   // within 3% — closer than the input is accurate
      // Clamped so a mistyped mileage cannot produce an absurd plan. The lower bound is generous
      // because the per-session floors (a 20-minute easy run, the long-run floor above) bind long
      // before it does; the upper one matters more, since LONG_CEILING_MIN and the 95-minute easy
      // cap are what actually stop a fictional 250 km/week plan.
      const next = Math.max(MIN_VOLUME_SCALE, Math.min(3, scale * ratio));
      if (Math.abs(next - scale) < 0.01) break;   // the caps are binding; further passes are futile
      scale = next;
      weeks = buildFull(scale);
    }
    // ⚠️ THE INTENSITY FLOOR IS A POST-CONDITION, NOT AN ASSUMPTION — but only for scaling DOWN.
    // Scaling UP adds easy running and nothing else, so it cannot reduce an easy fraction and needs
    // no check; running one anyway is actively harmful, because a plan that already breached at its
    // natural size would be "corrected" back to that same breaching plan with the runner's mileage
    // thrown away (measured: 8 breaching configurations became 15 that way).
    //
    // ⚠️ BISECT — do not take one step toward 1. `scale + (1 - scale) / 2` overshoots the entire safe
    // interval: for one measured runner the smallest safe scale was 0.481, the failing fit was 0.459,
    // and a single step landed on 0.730 — skipping 84% of the usable range. Because which side of
    // that jump you land on is not monotone in the stated mileage, answering 30 km/week produced a
    // 32% SMALLER plan than answering 29, and on the form's own 5 km spinner one click up shrank the
    // first week by more than 10% in 20 of 96 configurations. A runner who says they run more must
    // never be handed less; a proper search on [scale, 1] restores that.
    if (scale < 1) {
      const base = intensityProfile(natural, model);
      const floor = easyFloorFor(model, base);
      const ok = (ws: PlannedWeek[]) => noWorse(intensityProfile(ws, model), base, floor);
      if (!ok(weeks)) {
        let lo = scale;            // known bad (or at least unproven)
        let hi = 1;                // known good: the plan they would otherwise have received
        let best: PlannedWeek[] | null = null;
        for (let i = 0; i < 6 && hi - lo > 0.01; i++) {
          const mid = (lo + hi) / 2;
          const cand = buildFull(mid);
          if (ok(cand)) { hi = mid; best = cand; } else { lo = mid; }
        }
        weeks = best ?? natural;
      }
    }
  }

  return {
    goal,
    athlete,
    createdAtIso: isoToday(),
    intensityModel: model,
    paces,
    totalWeeks,
    weeks,
    notes: buildNotes(athlete, goal, totalWeeks, structuredWeeks, model, weeks),
  };
}

// ---- per-week assembly ----------------------------------------------------

type AnnotatedWeek = WeekPlan & { ordinalInPhase: number; phaseTotal: number };

type WeekContext = {
  athlete: Athlete;
  goal: Goal;
  paces: TrainingPaces;
  returning: boolean;
  longMin: number;
  /** Volume scale for this runner (see volumeScale). Absent means 1 — beginner weeks ignore it. */
  vScale?: number;
  /**
   * This week's taper multiplier (1 outside the taper). ⚠️ It must reach the EASY runs, not only the
   * long run. volumeMultiplierByWeek used to be applied in longRunMinutes alone, so a "taper" week
   * kept its full-length easy runs — and because the taper drops the second quality session, the
   * backfilled easy day meant easy volume actually ROSE into the taper. Measured: the delivered cut
   * was 18–39% against the evidence's 41–60%, and a 10K's last full week ran within 1% of peak.
   */
  taperMult?: number;
};

function buildWeek(
  index: number,
  startDateIso: string,
  wp: AnnotatedWeek,
  ctx: WeekContext,
): PlannedWeek {
  const runningDays = Math.min(6, Math.max(3, ctx.athlete.daysPerWeek));
  const qualityCount = qualitySessionsThisWeek(wp, runningDays, ctx.returning, ctx.vScale ?? 1);
  const easyCount = Math.max(0, runningDays - qualityCount - 1); // minus the long run
  const longDay = longRunDayOf(ctx.athlete);

  const sessions: SessionContent[] = [];
  const dayOf: number[] = [];

  // Long run (on the athlete's chosen day).
  sessions.push(longRunFor(wp.phase, ctx));
  dayOf.push(longDay);

  // Quality sessions — placed relative to the long run so spacing rules hold on any long-run day.
  const qualityContents = qualityContentsFor(wp, index, qualityCount, ctx);
  const qualityDays = QUALITY_REL.map((r) => dayRel(longDay, r));
  qualityContents.forEach((c, qi) => {
    sessions.push(c);
    dayOf.push(qualityDays[qi]!);
  });

  // Easy runs — rotate flavours (plain, strides, hill sprints, explore) so easy days stay fresh.
  const easyDays = EASY_REL.map((r) => dayRel(longDay, r)).slice(0, easyCount);
  // Strides and hill sprints are neuromuscular work with near-zero aerobic cost, but hill sprints
  // in particular are the highest connective-tissue load in the library — tissue adapts more slowly
  // than the cardiovascular system, so they are withheld from anyone coming back from injury.
  const canStride = (wp.phase === "base" || wp.phase === "build") && !wp.isDeload && !ctx.returning;
  easyDays.forEach((d, ei) => {
    // Easy running is where weekly volume actually lives, so it scales with the runner too —
    // bounded so a low-mileage runner still gets a real run and a high-mileage one is not handed
    // a two-hour midweek easy day.
    const baseMin = wp.isDeload ? 35 : ei === easyDays.length - 1 ? 40 : 45;
    // ⚠️ ORDER: clamp the VOLUME-driven length to 95 first, THEN taper, with the 20-minute floor
    // outermost. Multiplying before the clamp let the cap swallow the taper whole for high-mileage
    // runners — at vScale 3, 45 x 3 x 0.8 = 108 still clamps to 95, byte-identical to peak week, so
    // a 120 km/week marathoner's first taper week cut 3% instead of ~25% and race week held three
    // 68-minute easy runs. And the floor must stay outside the taper multiply, or a down-scaled
    // runner's race week produces 11-minute non-runs.
    const minutes = Math.max(20, Math.round(Math.min(95, baseMin * (ctx.vScale ?? 1)) * (ctx.taperMult ?? 1)));
    sessions.push(easyVariant(ctx.paces, minutes, index + ei, canStride));
    dayOf.push(d);
  });

  // Strength (shares days with runs, per the research brief's weekly structure).
  addStrength(wp, ctx, sessions, dayOf);

  // Optional mobility on the first free day.
  const used = new Set(dayOf);
  const freeDay = MOB_PREF_REL.map((r) => dayRel(longDay, r)).find((d) => !used.has(d));
  if (freeDay !== undefined) {
    const mob = mobilitySession();
    sessions.push(mob);
    dayOf.push(freeDay);
    used.add(freeDay);
  }

  // Rest on remaining empty days.
  for (let d = 0; d < 7; d++) {
    if (!used.has(d)) {
      sessions.push(restDay());
      dayOf.push(d);
      used.add(d);
    }
  }

  const finalized = finalize(sessions, dayOf, index);
  const plannedDistanceMeters = finalized.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0);
  const qualitySessionCount = finalized.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  return {
    index,
    startDateIso,
    phase: wp.phase,
    isDeload: wp.isDeload,
    focus: weekFocus(wp, ctx),
    sessions: finalized,
    plannedDistanceMeters: Math.round(plannedDistanceMeters),
    qualitySessionCount,
  };
}

/**
 * Put the goal race on its actual date in the final week, and make the days around it make sense.
 *
 * ⚠️ Before this existed the race was not in the plan AT ALL — `goal.raceDateIso` only aligned the
 * last week to a Monday and printed a date in the header. Whatever the rotation happened to place
 * on race day was prescribed instead. Measured on real plans: a Sunday race got a 51-minute LONG
 * RUN on race day; a Wednesday race got a recovery jog on the day and the long run four days AFTER
 * the race; and 6 of 49 race-day/long-run-day combinations put a 10 x 1' VO2 session the day
 * before. That last one is not untidy, it is a bad prescription.
 *
 * Three rules, in order:
 *   1. Race day IS the race. Whatever sat there is replaced.
 *   2. Nothing follows it. Sessions after race day in that week become rest — you have raced.
 *   3. The day before is a shakeout at most. Any quality session there is replaced by rest.
 * Strength and mobility are cleared from race day and the day before too: nobody lifts the day
 * before a goal race.
 */
function applyRaceDay(weeks: PlannedWeek[], goal: Goal, paces: TrainingPaces): void {
  const last = weeks[weeks.length - 1];
  if (!last) return;
  const raceDow = dayOfWeekMondayZero(goal.raceDateIso);
  // The final week is aligned to the race's own Monday, so the race must fall inside it. If some
  // future change breaks that, do nothing rather than write the race onto the wrong day.
  if (daysBetween(last.startDateIso, goal.raceDateIso) !== raceDow) return;

  const label = RACE_LABELS[goal.distance] ?? goal.distance;

  // ⚠️ THE EVE IS NOT ALWAYS IN THE RACE WEEK. For a MONDAY race raceDow is 0, so `raceDow - 1` is
  // -1 and matches no dayOfWeek at all — while the real day before is the SUNDAY of the PREVIOUS
  // week, which this function never opened. Rule 3 therefore did nothing for one weekday in seven.
  // Measured across 4 events x 7 race weekdays x 7 long-run days: 10 of 196 plans put a
  // HARD_BEFORE_RACE session on race eve and every single one was a Monday race — worst case, a
  // 98-minute LONG RUN the day before a marathon. Resolve the eve as a (week, day) pair; an index
  // into the final week cannot express it.
  const eve: { week: PlannedWeek; dow: number } | null =
    raceDow > 0 ? { week: last, dow: raceDow - 1 }
    : weeks.length > 1 ? { week: weeks[weeks.length - 2]!, dow: 6 }
    : null;

  // ⚠️ Rule 3 has a POSITIVE half: the day before is "a shakeout at most", not a void. Clearing the
  // eve to nothing is what the code used to do, and for a Monday race the session being cleared is
  // the previous week's LONG RUN — so that whole week lost its aerobic backbone and its easy
  // fraction fell to 66.7%, under the intensity floor, in a week that still held a race-specific
  // session. A 20-minute jog the day before a goal race is ordinary practice, keeps the week honest,
  // and is what the rule always claimed to prescribe.
  let clearedEve = false;
  const kept = last.sessions.filter((s) => {
    if (s.dayOfWeek > raceDow) return false;               // rule 2: nothing after the race
    if (s.dayOfWeek === raceDow) return false;             // rule 1: race day is the race
    if (eve && eve.week === last && s.dayOfWeek === eve.dow && HARD_BEFORE_RACE.has(s.type)) {
      clearedEve = true;                                   // rule 3
      return false;
    }
    return true;
  });
  if (clearedEve && eve && !kept.some((s) => s.dayOfWeek === eve.dow)) {
    kept.push(shakeoutSession(paces, last.index, eve.dow));
  }

  const race: Session = {
    ...raceDay(paces, goal.distance, label),
    id: `w${last.index}-d${raceDow}-race`,
    dayOfWeek: raceDow,
    source: "generated",
  };
  const filler: Session[] = [];
  for (let d = 0; d < 7; d++) {
    if (d === raceDow) continue;
    if (kept.some((s) => s.dayOfWeek === d)) continue;
    filler.push({
      ...restDay(),
      id: `w${last.index}-d${d}-rest`,
      dayOfWeek: d,
      source: "generated",
    });
  }
  last.sessions = [...kept, race, ...filler].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  last.plannedDistanceMeters = Math.round(
    last.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
  );
  last.qualitySessionCount = last.sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  // Rule 3, applied across the week boundary for a Monday race. The eve session is replaced by rest
  // rather than dropped, so the week keeps all seven days like every other week in the plan.
  if (eve && eve.week !== last) {
    const w = eve.week;
    let replaced = false;
    w.sessions = w.sessions.flatMap((s) => {
      if (s.dayOfWeek !== eve.dow || !HARD_BEFORE_RACE.has(s.type)) return [s];
      // The first hard session on the eve becomes the shakeout; any others (strength beside a long
      // run) simply go, so the day holds one easy jog rather than a jog plus a lift.
      if (replaced) return [];
      replaced = true;
      return [shakeoutSession(paces, w.index, eve.dow)];
    });
    w.plannedDistanceMeters = Math.round(
      w.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
    );
    w.qualitySessionCount = w.sessions.filter(
      (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
    ).length;
  }
}

/** The day before a goal race: legs turned over, nothing taken out of them. */
function shakeoutSession(paces: TrainingPaces, weekIndex: number, dow: number): Session {
  return {
    ...easyRun(paces, 20),
    title: "Pre-race shakeout",
    id: `w${weekIndex}-d${dow}-shakeout`,
    dayOfWeek: dow,
    source: "generated",
  };
}

/** Session types that must not sit the day before a goal race. */
const HARD_BEFORE_RACE = new Set<SessionType>([
  "threshold", "vo2", "race-specific", "long", "strength",
]);

const RACE_LABELS: Record<string, string> = {
  "1mile": "1 mile", "5k": "5K", "10k": "10K", half: "Half marathon", marathon: "Marathon",
};

const DAY_LABEL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Trim week 1 to a pro-rata partial week when the plan starts mid-week (full weeks follow). */
function applyPartialFirstWeek(weeks: PlannedWeek[], startIso: string): void {
  const w0 = weeks[0];
  if (!w0) return;
  // Week starts are always Mondays; `off` is the start day's position within week 1 (0 = Monday).
  const off = daysBetween(w0.startDateIso, startIso);
  if (off <= 0 || off > 6) return; // starts on the Monday, or a lead-in gap precedes week 1
  const startDOW = dayOfWeekMondayZero(startIso);
  w0.sessions = w0.sessions.filter((s) => s.dayOfWeek >= startDOW);
  w0.startDateIso = startIso;
  w0.plannedDistanceMeters = Math.round(
    w0.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
  );
  w0.qualitySessionCount = w0.sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;
  w0.focus = `Partial first week — picking up from ${DAY_LABEL[startDOW]}. Full weeks begin Monday.`;
}

function finalize(contents: SessionContent[], dayOf: number[], weekIndex: number): Session[] {
  return contents
    .map((c, i) => ({
      ...c,
      id: `w${weekIndex}-d${dayOf[i]}-${c.type}`,
      dayOfWeek: dayOf[i]!,
      source: "generated" as const,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

// ---- beginner assembly ----------------------------------------------------

const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.max(0, Math.min(1, f));

// Rotating pools of beginner session flavours — every run day of the week draws a different one so a
// plan never repeats the same session two days (or two weeks) running.
const RW_FLAVOURS = [rwSteady, rwLadder, rwExplore, rwBuildup];
const CONT_FLAVOURS = [
  (p: TrainingPaces, m: number) => easyRun(p, m, false),
  contPickups,
  contProgression,
  contExplore,
];

// One beginner running session — a run–walk progression, or short continuous easy running for those
// who can already jog. `f` is 0→1 across the plan; runs lengthen and (for run–walk) walks shrink.
// `flavour` selects which format so sessions vary; the weekly long run uses its own long format.
/**
 * Interpolate GEOMETRICALLY, so each step is the same PERCENTAGE bigger than the last.
 *
 * ⚠️ A straight `lerp` front-loads its growth, which is exactly backwards for a beginner. Ramping the
 * long run 30 → 112 minutes linearly over 33 weeks made the early steps the steepest in percentage
 * terms: week 5 went 3.5 km → 4.1 km, a **17% jump**, against the report's 1.10 single-session
 * guardrail — and the runner least able to absorb it is the one four weeks into their first plan.
 * Same start, same destination, constant 4% a week instead.
 */
function geomLerp(from: number, to: number, f: number): number {
  if (from <= 0 || to <= 0) return lerp(from, to, f);
  return from * Math.pow(to / from, f);
}

function beginnerRun(
  paces: TrainingPaces,
  f: number,
  long: boolean,
  runWalk: boolean,
  ease: boolean,
  flavour: number,
  longPeakMin: number,
): SessionContent {
  // ⚠️ ONLY THE LONG RUN IS EVENT-AWARE. The midweek runs stay on their original gentle ramp: what a
  // new runner needs on a Tuesday is the habit, and it is the same habit whatever they have entered.
  // Stretching every session toward the race is how a beginner plan becomes an intermediate one.
  if (runWalk) {
    const runSec = Math.round(lerp(60, 300, f) / 15) * 15; // 1′ → 5′ run
    const walkSec = Math.max(30, Math.round(lerp(90, 45, f) / 15) * 15); // 90″ → 45″ walk
    // ⚠️ `targetRunMin` is the RUNNING minutes, and it aims at the SAME endpoint as the continuous
    // track, not a discounted one. The first version scaled it to 0.75 on the reasoning that a
    // run-walker covers less ground per minute — which is true and points the other way: the walk
    // breaks add time without adding much distance, so covering 8 km takes MORE session, not less.
    // Measured, the discount left a "just getting started" runner at 4.8 km before a 5 km and 6.2 km
    // before a 10 km, both under the report's Beginner bands; at parity they reach 6.2 and 8.2.
    const rwPeak = Math.max(14, longPeakMin);
    let targetRunMin = long ? geomLerp(Math.min(14, rwPeak), rwPeak, f) : lerp(10, 26, f);
    if (ease) targetRunMin *= 0.7;
    const spec = { runSec, walkSec, targetRunMin };
    return long ? rwLong(paces, spec) : RW_FLAVOURS[flavour % RW_FLAVOURS.length]!(paces, spec);
  }
  // The long run ramps from a gentle opening to the event's own endpoint. Starting at 45% of the
  // destination keeps week one where it always was for a short goal, and keeps the week-on-week
  // growth inside the report's 1.10 single-session guardrail for a long one.
  const openMin = Math.min(30, Math.round(longPeakMin * 0.45));
  let minutes = long
    ? Math.round(geomLerp(openMin, longPeakMin, f))
    : Math.round(lerp(22, 38, f));
  if (ease) minutes = Math.round(minutes * 0.75);
  return long ? longRun(paces, minutes) : CONT_FLAVOURS[flavour % CONT_FLAVOURS.length]!(paces, minutes);
}

function beginnerFocus(wp: AnnotatedWeek, runWalk: boolean): string {
  if (wp.isDeload) return "Easy week — let your body adapt and come back stronger";
  if (wp.phase === "taper") return "Ease down — stay fresh for your goal";
  return runWalk
    ? "Run–walk foundation — build the habit and let running feel easy"
    : "Easy aerobic base — steady, comfortable running you can chat through";
}

function buildBeginnerWeek(
  index: number,
  startDateIso: string,
  wp: AnnotatedWeek,
  ctx: WeekContext,
  rampWeeks: number,
  runWalk: boolean,
): PlannedWeek {
  // ⚠️ THE RAMP REACHES ITS ENDPOINT AT THE LAST HARD WEEK — not the last week, and not the last
  // non-taper week either. `structuredWeeks` was the denominator first, so f only hit 1 in race week,
  // which is a taper week and eased by 25%. Switching to the non-taper count was still wrong: the
  // final non-taper week is usually a DELOAD, also eased, so the endpoint landed on a week that then
  // had 25% taken off it. Measured, a beginner 5 km block aimed at 6.0 km and delivered 5.8. Ramp to
  // the last week that is neither taper nor deload, and everything after it eases down FROM the
  // destination rather than toward it.
  const f = Math.min(1, rampWeeks <= 1 ? 0.5 : (index - 1) / (rampWeeks - 1));
  const ease = wp.isDeload || wp.phase === "taper";
  const runningDays = Math.min(runWalk ? 3 : 4, Math.max(2, ctx.athlete.daysPerWeek));
  const longDay = longRunDayOf(ctx.athlete);

  const sessions: SessionContent[] = [];
  const dayOf: number[] = [];

  // The weekly long, gentle session (on the athlete's chosen long-run day).
  sessions.push(beginnerRun(ctx.paces, f, true, runWalk, ease, 0, ctx.longMin));
  dayOf.push(longDay);

  // Other easy days — each draws a different flavour, and the set rotates every week.
  const easyDays = BEG_EASY_REL.map((r) => dayRel(longDay, r)).slice(0, runningDays - 1);
  easyDays.forEach((d, ei) => {
    sessions.push(beginnerRun(ctx.paces, f, false, runWalk, ease, index + ei, ctx.longMin));
    dayOf.push(d);
  });

  // General, gentle strength (no heavy lifting for a brand-new runner) — themed variants rotate.
  if (ctx.athlete.includeStrength) {
    const strengthCount = ctx.athlete.daysPerWeek >= 4 && !ease ? 2 : 1;
    BEG_STRENGTH_REL.map((r) => dayRel(longDay, r)).slice(0, strengthCount).forEach((d, si) => {
      if (!dayOf.includes(d)) {
        sessions.push(generalStrengthSession(index + si));
        dayOf.push(d);
      }
    });
  }

  // Optional mobility on a free day — theme rotates by week.
  const used = new Set(dayOf);
  const mobDay = MOB_PREF_REL.map((r) => dayRel(longDay, r)).find((d) => !used.has(d));
  if (mobDay !== undefined) {
    sessions.push(mobilitySession(index));
    dayOf.push(mobDay);
    used.add(mobDay);
  }

  for (let d = 0; d < 7; d++) {
    if (!used.has(d)) {
      sessions.push(restDay());
      dayOf.push(d);
      used.add(d);
    }
  }

  const finalized = finalize(sessions, dayOf, index);
  const plannedDistanceMeters = finalized.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0);
  return {
    index,
    startDateIso,
    phase: wp.phase,
    isDeload: wp.isDeload,
    focus: beginnerFocus(wp, runWalk),
    sessions: finalized,
    plannedDistanceMeters: Math.round(plannedDistanceMeters),
    qualitySessionCount: 0,
  };
}

function qualitySessionsThisWeek(
  wp: AnnotatedWeek,
  runningDays: number,
  returning: boolean,
  vScale = 1,
): number {
  if (runningDays < 4) return 1; // low frequency → protect easy volume, one quality
  if (wp.isDeload) return 1;
  // ⚠️ A SMALL WEEK CANNOT CARRY TWO KEY DAYS — the same rule as the four-day cap below, measured in
  // volume rather than in days. Quality sessions come from the library at a fixed length whatever the
  // week around them weighs, so shrinking a plan shrinks only the easy running and the hard fraction
  // climbs by pure arithmetic. That is what made scaling down unsafe before: a runner who told us
  // they run 25 km/week got the same two threshold/VO2 sessions as one running 60, on half the base.
  // The evidence spec pairs a smaller week with FEWER key days for exactly this reason (Intermediate
  // 1–2, Advanced 2), and this is that lever. Peak weeks keep their second session: a short sharp
  // overload with the taper behind it is the intent, and volumeScale's own intensity check is what
  // actually guarantees the floor holds.
  if (vScale < 0.9 && wp.phase !== "peak") return Math.min(qualityByPhase(wp, returning), 1);
  // ⚠️ The four-day cap below is a CEILING applied to the phase's own answer, not a short-circuit
  // before it. Returning 1 up here overrode the base phase's pure-aerobic foundation block, which
  // deliberately returns 0 — so a beginner's first weeks gained a quality session they should not
  // have had.
  const byPhase = qualityByPhase(wp, returning);
  // Four runs a week cannot support two quality sessions: it leaves one easy run and the long run
  // to carry all the aerobic volume, and the week's easy fraction collapses towards half — far
  // under any pyramidal or polarized target. Such weeks get their second quality session only in
  // the peak block, where a short, sharp overload is the intent and the taper follows.
  if (runningDays === 4 && wp.phase !== "peak") return Math.min(byPhase, 1);
  return byPhase;
}

function qualityByPhase(wp: AnnotatedWeek, returning: boolean): number {
  switch (wp.phase) {
    case "base": {
      // A long base opens with a pure-aerobic foundation block — consistency and volume before any
      // quality — then settles into one quality session. Short bases carry the single quality throughout.
      const foundationWeeks = wp.phaseTotal >= 8 ? Math.round(wp.phaseTotal * 0.3) : 0;
      return wp.ordinalInPhase <= foundationWeeks ? 0 : 1;
    }
    case "build":
      // Returning athletes add the second quality only in the second half of the build.
      if (returning && wp.ordinalInPhase <= Math.ceil(wp.phaseTotal / 2)) return 1;
      return 2;
    case "peak":
      return 2;
    case "taper":
      return 1;
  }
}

function qualityContentsFor(
  wp: AnnotatedWeek,
  weekIndex: number,
  count: number,
  ctx: WeekContext,
): SessionContent[] {
  const p = ctx.paces;
  const isShortEvent =
    ctx.goal.distance === "5k" || ctx.goal.distance === "10k" || ctx.goal.distance === "1mile";
  const out: SessionContent[] = [];
  // What this week can safely be given. Filtering the format pool by phase is what makes a large
  // session library actually reachable: selection is `variant % pool.length`, so one flat pool
  // longer than the plan leaves formats permanently unused.
  // Rotate by position WITHIN the phase, offset by a per-plan seed.
  //
  // Two problems this solves. Using the raw week index means the pool is walked in steps that skip
  // residues, so a pool longer than the phase leaves formats permanently unused; walking by
  // ordinal-in-phase steps through it one at a time instead. And seeding the start point from the
  // plan's own shape — phase length, training days, and the event being trained for — means two
  // different plans begin at different points in the pool. Across the range of plans people
  // actually build, every format gets used rather than the same prefix every time.
  const DISTANCE_SEED: Record<Goal["distance"], number> = { "1mile": 0, "5k": 2, "10k": 5, half: 8, marathon: 11 };
  const rot = wp.ordinalInPhase + wp.phaseTotal + ctx.athlete.daysPerWeek + DISTANCE_SEED[ctx.goal.distance];
  const EVENT_KM: Record<Goal["distance"], number> = { "1mile": 1.609, "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };
  const fctx: FormatCtx = {
    phase: wp.phase,
    eventKm: EVENT_KM[ctx.goal.distance],
    isDeload: wp.isDeload,
    competitive: ctx.athlete.experience === "competitive",
    returning: ctx.returning,
  };

  if (wp.phase === "taper") {
    // Keep intensity, low volume: a short, sharp session, chosen BY ID. This used to be
    // `vo2Session(p, 3)` — a positional index, so inserting any format above it silently changed
    // the race-week session of every plan ever generated.
    out.push(taperSession(p));
    return out.slice(0, count);
  }
  if (wp.phase === "peak") {
    // The race-pace session is the week's centrepiece, so the supporting one steps back — but only
    // when the centrepiece is itself a big one. Capping it unconditionally made every peak-only big
    // format unreachable, because a peak week always carries two quality sessions.
    const sRot = rot + 5;
    const supportBig = isShortEvent ? vo2IsBig(sRot, fctx) : thresholdIsBig(sRot, fctx);
    const support = count >= 2 && raceIsBig(rot, fctx) && supportBig ? { ...fctx, avoidBig: true } : fctx;
    out.push(raceSpecificSession(p, rot, fctx));
    out.push(isShortEvent ? vo2Session(p, sRot, support) : thresholdSession(p, sRot, support));
    return out.slice(0, count);
  }
  if (wp.phase === "build") {
    if (count >= 2) {
      // Offset the two variants. With the same index, a given threshold format is locked to a given
      // VO2 format for the whole plan whenever the two pools happen to be the same length.
      // One big session a week is the load; two is how people get hurt.
      //
      // The cap applies only when BOTH slots would draw a big format. Capping the VO2 slot whenever
      // the threshold slot happened to be big made every big VO2 format unreachable: the two share
      // a rotation index, so "threshold is big" and "which VO2 format" are perfectly correlated.
      // The two indexes are also offset so a given threshold format is not welded to one VO2 format
      // for the life of the plan.
      const vRot = rot + 5;
      const bothBig = thresholdIsBig(rot, fctx) && vo2IsBig(vRot, fctx);
      out.push(thresholdSession(p, rot, fctx));
      out.push(vo2Session(p, vRot, bothBig ? { ...fctx, avoidBig: true } : fctx));
    } else {
      // Alternate the single quality session week to week.
      out.push(weekIndex % 2 === 0 ? vo2Session(p, rot, fctx) : thresholdSession(p, rot, fctx));
    }
    return out.slice(0, count);
  }
  // base: threshold-led (tempo/cruise/fartlek rotate); introduce VO2 flavour only in the latter part.
  const lateBase = wp.ordinalInPhase > Math.ceil(wp.phaseTotal / 2);
  out.push(lateBase && weekIndex % 2 === 0 ? vo2Session(p, rot, fctx) : thresholdSession(p, rot, fctx));
  return out.slice(0, count);
}

// Rotate easy-run flavours for non-beginners. All stay genuinely easy; strides/hill sprints only in
// base/build (neuromuscular work, near-zero aerobic cost), explore/plain anytime.
function easyVariant(paces: TrainingPaces, minutes: number, idx: number, canStride: boolean): SessionContent {
  const pool: ((p: TrainingPaces, m: number) => SessionContent)[] = canStride
    ? [
        (p, m) => easyRun(p, m, false),
        (p, m) => easyRun(p, m, true),
        (p, m) => easyHillStrides(p, m),
        (p, m) => contExplore(p, m),
        (p, m) => moderateRun(p, m, false),
        (p, m) => moderateRun(p, m, true),
        (p, m) => easyProgression(p, m),
        (p, m) => recoveryRun(p, m),
      ]
    : [
        (p, m) => easyRun(p, m, false),
        (p, m) => contExplore(p, m),
        (p, m) => moderateRun(p, m, false),
        (p, m) => recoveryRun(p, m),
      ];
  return pool[idx % pool.length]!(paces, minutes);
}

function longRunFor(phase: Phase, ctx: WeekContext): SessionContent {
  const min = ctx.longMin;
  if (phase === "peak") {
    // Race-specific work while tired.
    return longRun(ctx.paces, min, {
      raceBlockMin: Math.min(30, Math.round(min * 0.25)),
      racePace: ctx.paces.goalRace,
    });
  }
  if (phase === "build") {
    return longRun(ctx.paces, min, { steadyFinishMin: Math.min(20, Math.round(min * 0.2)) });
  }
  return longRun(ctx.paces, min);
}

function addStrength(
  wp: AnnotatedWeek,
  ctx: WeekContext,
  sessions: SessionContent[],
  dayOf: number[],
): void {
  if (!ctx.athlete.includeStrength) return;
  let count: number;
  if (wp.phase === "taper") count = wp.ordinalInPhase === 1 ? 1 : 0;
  else if (wp.phase === "peak" || wp.isDeload) count = 1;
  else count = 2; // base, build

  const maintenance = wp.phase === "peak" || wp.phase === "taper";
  const longDay = longRunDayOf(ctx.athlete);
  // Pair strength with a quality day and an easy day (so lifting doesn't fall on the long run day).
  const strengthDays = [dayRel(longDay, QUALITY_REL[0]!), dayRel(longDay, EASY_REL[0]!)];
  for (let i = 0; i < count; i++) {
    sessions.push(strengthSession(wp.phase, maintenance));
    dayOf.push(strengthDays[i] ?? strengthDays[0]!);
  }
}

// ---- long-run progression -------------------------------------------------

function longRunMinutes(
  wp: WeekPlan,
  weekIndex: number,
  nonTaperCount: number,
  startLong: number,
  peakLong: number,
  // ⚠️ The RESOLVED multiplier for this week, not the array. Two call sites each indexing
  // volumeMultiplierByWeek is how race week got the wrong entry on clamped runways — buildAll
  // resolves it once, end-aligned, and everything downstream shares the answer.
  taperMult: number,
): number {
  if (wp.phase === "taper") {
    return Math.round(peakLong * taperMult);
  }
  const fraction = nonTaperCount <= 1 ? 1 : (weekIndex - 1) / (nonTaperCount - 1);
  let minutes = startLong + fraction * (peakLong - startLong);
  if (wp.isDeload) minutes *= 0.75;
  return Math.round(minutes);
}

// ---- annotations, focus text, notes --------------------------------------

function annotate(schedule: WeekPlan[]): AnnotatedWeek[] {
  const totals: Record<Phase, number> = { base: 0, build: 0, peak: 0, taper: 0 };
  for (const w of schedule) totals[w.phase]++;
  const seen: Record<Phase, number> = { base: 0, build: 0, peak: 0, taper: 0 };
  return schedule.map((w) => {
    seen[w.phase]++;
    return { ...w, ordinalInPhase: seen[w.phase], phaseTotal: totals[w.phase] };
  });
}

function weekFocus(wp: AnnotatedWeek, ctx: WeekContext): string {
  if (wp.isDeload) return "Deload — recover and absorb training";
  switch (wp.phase) {
    case "base": {
      const foundationWeeks = wp.phaseTotal >= 8 ? Math.round(wp.phaseTotal * 0.3) : 0;
      if (wp.ordinalInPhase <= foundationWeeks) {
        return "Foundation — easy consistency, weekly long run, general strength";
      }
      return ctx.returning
        ? "Aerobic base — rebuild consistency + one quality session"
        : "Aerobic base + one quality session";
    }
    case "build":
      return "Build threshold and VO2, extend the long run";
    case "peak":
      return "Race-specific sharpening";
    case "taper":
      return "Taper — cut volume, keep intensity";
  }
}

function buildNotes(
  athlete: Athlete,
  goal: Goal,
  totalWeeks: number,
  structuredWeeks: number,
  model: IntensityModel,
  weeks: PlannedWeek[],
): string[] {
  const notes: string[] = [];
  const leadIn = totalWeeks - structuredWeeks;
  if (leadIn > 1) {
    const planStart = weeks[0]?.startDateIso ?? goal.startDateIso ?? "";
    notes.push(
      `You have ~${leadIn} weeks before the structured plan begins (${planStart}). Use them to build easy-running consistency and a weekly long run — consistency is the biggest driver of improvement.`,
    );
  }
  notes.push(
    model === "pyramidal"
      ? "Intensity distribution: pyramidal — mostly easy running, a moderate amount of threshold, a little VO2. Individual response matters more than an exact split."
      : "Intensity distribution: polarized — mostly easy plus a focused dose of hard work, minimal middle-ground moderate running.",
  );
  if (athlete.oneKmTrialSeconds && athlete.oneKmTrialSeconds > 0) {
    notes.push(
      "VO₂/interval paces are anchored to your 1 km time-trial (MAS) — a direct, test-based target you can re-test to track progress.",
    );
  }
  if (athlete.returningFromInjury) {
    notes.push(
      "Returning from injury: the early weeks stay deliberately conservative (single quality session, gentle long-run progression). Add the second quality session only once weekly running and the long run feel stable.",
    );
  }
  notes.push(
    athlete.includeStrength
      ? "Strength: 2×/week through base and build (heavy, low volume), easing to 1× maintenance near the race. Plyometrics only once faster running is tolerated without a delayed reaction."
      : "Strength is off. The research supports heavy strength 2×/week for economy and durability — consider enabling it.",
  );
  notes.push(
    "Variety: quality sessions rotate across formats — tempo, cruise intervals, threshold and Mona fartlek, VO₂ intervals, pyramids and hill reps — so the stimulus stays fresh week to week while the training intent stays the same.",
  );
  notes.push(
    "Flexibility: warmups are dynamic (easy jog, drills, strides). Static stretching is optional and targeted — it does not improve running economy.",
  );
  return notes;
}
