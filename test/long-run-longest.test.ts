import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Athlete, Goal, Plan, PlannedWeek, Session } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
// ⚠️ The engine's OWN definition of a week's intensity, never a second one rolled here. CLAUDE.md
// records the progression audit's first instrument reading hard minutes off step-level `targetRpe`
// and reporting the taper at 0.0% hard as a result.
import * as intensity from "../src/science/intensity-distribution.ts";

/**
 * ⚠️ THE LONG RUN IS THE LONGEST EASY RUN OF ITS WEEK, AND UNTIL 2026-08-20 NOTHING ASSERTED IT.
 *
 * The owner reported it from his own phone after a field test: "the long run is meant to be the
 * longest run of the week". Reproduced to the digit — 5 km goal, 4 days, recreational, returning from
 * a break, 19:54 anchor, race 2026-11-29 — his week 2 read
 *   tempo 50′/10.5 km · moderate 37′/7.5 km · recovery 33′/5.4 km · LONG RUN 33′/6.1 km,  header 24.8 km
 * and weeks 1–4 were ALL inverted while weeks 5–14 were clean: the first month, which is where a
 * runner decides whether to trust the plan at all.
 *
 * The cause was two ramps that never looked at each other — `startLong` (peakLong × 0.55, or × 0.42
 * when returning from a break) against `EASY_START_FRAC` (0.80) — with the long run built first and
 * `buildWeek` never comparing the two numbers. Measured over 112,640 delivered weeks before the fix:
 * the long run was NOT the longest easy run of its week in 18.09% of them on distance and 16.88% on
 * the clock, rising to 42.20% of 5 km weeks; the beginner track, which nobody had measured, was at
 * 26.85%. A defect at that rate shipped for months behind a green suite because no test asked the
 * question the runner asks.
 *
 * ⚠️ IT IS ABOUT THE EASY RUNS, NOT EVERY RUN, and that is a coaching statement rather than a
 * convenience — see `enforceLongRunIsLongest`. A threshold session comes out of the library at a fixed
 * length with a warm-up and cool-down on top and cannot move; measured after the fix, a quality
 * session is still the biggest thing in its week on the whole-outing ruler in 15.56% of weeks and on
 * counted training distance in 1.19%, and in EVERY remaining case the offender is a quality session
 * (threshold 10,516 · vo2 3,742 · race-specific 4,060, and zero easy / recovery / strides runs).
 * Before the fix an ordinary easy run was the offender in 18,545 weeks.
 *
 * ⚠️ EVERY THRESHOLD BELOW IS SET FROM A MEASUREMENT RECORDED BESIDE IT, and every guard in this file
 * was watched failing against a deliberate re-break before it was believed.
 */

const AEROBIC = new Set<Session["type"]>(["easy", "long", "recovery", "strides"]);
const RUN = new Set<Session["type"]>(["easy", "long", "recovery", "strides", "threshold", "vo2", "race-specific", "race"]);
const mins = (s: Session) => (s.estimatedDurationSeconds ?? 0) / 60;
/** The WHOLE outing, which is the figure on the session card the runner reads. */
const km = (s: Session) => (s.estimatedDistanceMeters ?? 0) / 1000;
const RACE_KM: Record<Goal["distance"], number> = { "1mile": 1.609, "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };
const TT: Record<string, number> = { "5k": 1134, "10k": 2500, half: 5600, marathon: 12000 };

type Case = { who: string; distance: Goal["distance"]; plan: Plan };

/**
 * The sweep. Built once and shared, because every guard below asks a different question of the same
 * plans and generating them twice is the slow half.
 *
 * ⚠️ THE AXES ARE NOT DECORATION — each is here because a deliberate re-break escaped without it.
 *  - SLOW ANCHORS (30:00 / 35:00 5 km) and THREE-DAY WEEKS: CLAUDE.md records
 *    `test/session-library.test.ts`'s own sweep using a single 18:20 athlete, and the pocket this fix
 *    touches lives at 30:00–35:00 on three days a week.
 *  - A FAST ANCHOR (18:00) WITH A HIGH STATED VOLUME: that is where the long-run ceiling binds, and it
 *    is the exact profile (`5k / 3d / 18:00 / vol=60`) whose long run ran to 4.55x its own race
 *    distance when the lift's clamp was removed.
 *  - SEVEN DAYS: the seventh day is a recovery jog, which is the only routine source of a `recovery`
 *    session outside the rotation — drop `recovery` from the comparison set and 468 weeks invert.
 *  - `returningFromBreak` BOTH WAYS: it starts the long-run ramp at 0.42 rather than 0.55, which is
 *    the owner's own case and the worst one.
 *  - A MID-WEEK START, so `applyPartialFirstWeek` genuinely fires, and BOTH a Sunday and a MONDAY
 *    race, so `applyRaceDay`'s cross-week eve rule fires. Those transforms run after the weeks are
 *    built, and CLAUDE.md records 969 profiles once being handed a first week that a pre-transform
 *    check had passed. Drop `strides` from the comparison set and the non-edge weeks move by 0.22%
 *    while the edge weeks move by 9.65% — so a sweep that skipped them would barely notice.
 */
let sweepCache: Case[] | null = null;
function sweep(): Case[] {
  if (sweepCache) return sweepCache;
  const out: Case[] = [];
  // ⚠️⚠️ THE NEAR RACE DATE WAS ADDED WITH THE BLOCK-LENGTH CAP (2026-09-01), AND WITHOUT IT THIS
  // SWEEP LOST A WHOLE CLASS. Weeks are placed backwards from race Monday, so a runway LONGER than the
  // distance's cap makes the plan start on a Monday and `startDateIso` is never honoured — which means
  // `applyPartialFirstWeek` never fires and the "plans start mid-week" vacuity check below went to
  // ZERO. The 2027 dates are ~27 weeks out, past every cap; 2026-11-08 is ~10.6 weeks out, inside all
  // of them, so those plans genuinely begin on the Wednesday and carry a trimmed first week.
  for (const raceDateIso of ["2027-03-07", "2027-03-08", "2026-11-08"]) // Sunday, Monday, near Sunday
    for (const distance of ["5k", "10k", "half", "marathon"] as const)
      for (const days of [3, 4, 5, 6, 7])
        for (const t5 of [1080, 1500, 1800, 2100])
          for (const experience of ["recreational", "competitive"] as const)
            for (const vol of [null, 25, 60])
              for (const ret of [false, true]) {
                const athlete: Athlete = {
                  daysPerWeek: days,
                  recent: { distanceMeters: 5000, timeSeconds: t5 },
                  experience,
                  includeStrength: false,
                  returningFromBreak: ret,
                  longRunDay: 6,
                  ...(vol ? { weeklyVolumeKmCurrent: vol } : {}),
                };
                const goal: Goal = { distance, targetTimeSeconds: TT[distance]!, raceDateIso, startDateIso: "2026-08-26" };
                out.push({
                  who: `${distance}/${days}d/5k=${(t5 / 60).toFixed(0)}min/${experience}/vol=${vol}/ret=${ret}/race=${raceDateIso}`,
                  distance,
                  plan: generatePlan(athlete, goal),
                });
              }
  sweepCache = out;
  return out;
}

/** Beginners run a different builder (`buildBeginnerWeek`) off a different ramp, so they are a
 *  separate arm — and only the goals `GOAL_BY_STATUS` actually offers a beginner are swept, because
 *  CLAUDE.md records a previous sweep reporting on runners who cannot exist. */
function beginnerSweep(): Case[] {
  const out: Case[] = [];
  for (const raceDateIso of ["2027-01-10", "2027-03-07"])
    for (const distance of ["5k", "10k", "half"] as const)
      for (const days of [2, 3, 4])
        // ⚠️ 18:00 IS IN HERE ON PURPOSE. It is not a plausible beginner, and it is the only profile
        // that reaches the beginner cap's own floor: a 5 km endpoint of ~11 minutes on a deload week
        // beside a "10′ easy + gentle pickups" that BUILDS to 11 minutes. Floor that cap at 10 rather
        // than 8 and exactly six weeks in the full sweep invert.
        for (const t5 of [1080, 1500, 1800, 2100])
          for (const runWalk of [false, true]) {
            if (runWalk && distance === "half") continue;   // run–walk is status "new": 5 km / 10 km only
            const athlete: Athlete = {
              daysPerWeek: days,
              recent: { distanceMeters: 5000, timeSeconds: t5 },
              experience: "beginner",
              includeStrength: false,
              longRunDay: 6,
              ...(runWalk ? { runWalk: true } : {}),
            };
            out.push({
              who: `beginner/${distance}/${days}d/5k=${(t5 / 60).toFixed(0)}min/rw=${runWalk}`,
              distance,
              plan: generatePlan(athlete, { distance, targetTimeSeconds: TT[distance]!, raceDateIso, startDateIso: "2026-08-26" }),
            });
          }
  return out;
}

/** The question the runner asks, of one week: is the long run the biggest of my easy runs? */
function inversion(w: PlannedWeek): { by: string; long: Session; other: Session } | null {
  const long = w.sessions.find((s) => s.type === "long");
  if (!long) return null;                     // a week with no long run cannot have a longest one
  const others = w.sessions.filter((s) => s !== long && AEROBIC.has(s.type));
  if (!others.length) return null;
  for (const [ruler, f] of [["on the clock", mins], ["on the ground", km]] as const) {
    const worst = others.reduce((b, s) => (f(s) > f(b) ? s : b), others[0]!);
    if (f(worst) > f(long) + 1e-9) return { by: ruler, long, other: worst };
  }
  return null;
}

const describe = (s: Session) => `${s.title} ${mins(s).toFixed(0)}min/${km(s).toFixed(1)}km`;

test("BLOCKER: the long run is the longest easy run of its week, on the clock and on the ground", () => {
  const cases = sweep();
  let weeks = 0;
  const bad: string[] = [];
  for (const c of cases) {
    for (const w of c.plan.weeks) {
      weeks++;
      const inv = inversion(w);
      if (inv) bad.push(`${c.who} wk${w.index} ${inv.by}: LONG ${describe(inv.long)} beaten by ${describe(inv.other)}`);
    }
  }
  // ⚠️ A GUARD OVER A COLLECTION IS ONLY AS GOOD AS THE COLLECTION. Measured on THIS sweep: 1,920
  // plans, 54,720 weeks, and 9,810 of them inverted before the fix. The size assertions below are
  // there so that a sweep which quietly shrinks to nothing cannot report success.
  assert.ok(cases.length > 500, `only ${cases.length} plans swept`);
  assert.ok(weeks > 10_000, `only ${weeks} weeks swept`);
  assert.equal(bad.length, 0, `${bad.length} of ${weeks} weeks put a longer easy run than the long run:\n  ${bad.slice(0, 8).join("\n  ")}`);
});

test("BLOCKER: ...and on the beginner track, whose long run comes off a different ramp", () => {
  const cases = beginnerSweep();
  let weeks = 0, withLong = 0;
  const bad: string[] = [];
  for (const c of cases) {
    for (const w of c.plan.weeks) {
      weeks++;
      if (w.sessions.some((s) => s.type === "long")) withLong++;
      const inv = inversion(w);
      if (inv) bad.push(`${c.who} wk${w.index} ${inv.by}: LONG ${describe(inv.long)} beaten by ${describe(inv.other)}`);
    }
  }
  // Measured on this arm: 120 plans, 2,880 weeks, 1,656 of them carrying a long run (the run–walk
  // plans carry none, by construction), and 399 inverted before the fix.
  assert.ok(cases.length > 40, `only ${cases.length} beginner plans swept`);
  assert.ok(withLong > 500, `only ${withLong} beginner weeks carry a long run — the sweep proves nothing`);
  assert.equal(bad.length, 0, `${bad.length} of ${weeks} beginner weeks are inverted:\n  ${bad.slice(0, 8).join("\n  ")}`);
});

test("a beginner's midweek runs keep their own ramp — the beginner fix lifts the long run, it does not trim the week", () => {
  // ⚠️ THE INVARIANT ALONE CANNOT SEE THIS, and that is why the guard exists. `enforceLongRunIsLongest`
  // asks whether a floor binds by comparing it with the long run ACTUALLY DELIVERED; written the
  // obvious way — against `ctx.longMin` — the test is unsatisfiable on the beginner track, because
  // there `longMin` carries the block's ENDPOINT rather than this week's length. The lift then never
  // fires and the cap silently does the whole job instead: measured, the invariant still reads 0.00%
  // while the shortest midweek beginner run falls from 23.0 minutes to 12.0 and 222 of 2,304 midweek
  // runs are pushed under 21.5.
  //
  // That is the wrong answer, not merely a different one. `beginnerRun`'s own note says so: "ONLY THE
  // LONG RUN IS EVENT-AWARE. The midweek runs stay on their original gentle ramp: what a new runner
  // needs on a Tuesday is the habit." Capping them makes the midweek run event-aware — shorter before a
  // 5 km than before a half — which is the documented decision reversed.
  //
  // The ramp is `lerp(22, 38, f)`, and the `ease` multiplier only applies on a deload or in the taper,
  // so 22 minutes is the floor by construction on any other week. 21.5 allows for rounding.
  let mids = 0, shortest = Infinity, who = "";
  for (const c of beginnerSweep()) {
    c.plan.weeks.forEach((w, i) => {
      if (i === 0 || w.isDeload || w.phase === "taper" || w.sessions.some((s) => s.type === "race")) return;
      const long = w.sessions.find((s) => s.type === "long");
      if (!long) return;
      for (const s of w.sessions) {
        if (s === long || !AEROBIC.has(s.type)) continue;
        mids++;
        if (mins(s) < shortest) { shortest = mins(s); who = `${c.who} wk${w.index} ${describe(s)}`; }
      }
    });
  }
  assert.ok(mids > 500, `only ${mids} beginner midweek runs measured`);
  assert.ok(shortest >= 21.5, `a beginner midweek run is down to ${shortest.toFixed(0)} min (${who}) — measured 23.0 both before and after the fix, and 12.0 when the lift stops firing`);
});

test("a run–walk plan contains no long run at all, so the invariant is vacuous there — checked, not assumed", () => {
  // ⚠️ THE EXEMPTION IS ASSERTED RATHER THAN TRUSTED. `assembleRunWalk` has one exit and types every
  // session `easy`, so a run–walk beginner has no `long` session for the guard above to reason about —
  // which means those plans pass it for free. If that ever changes, the sweep above must start
  // covering them, and this is what will say so.
  const rw = beginnerSweep().filter((c) => c.who.includes("rw=true"));
  assert.ok(rw.length > 8, `only ${rw.length} run–walk plans swept`);
  for (const c of rw) {
    const longs = c.plan.weeks.flatMap((w) => w.sessions.filter((s) => s.type === "long"));
    assert.equal(longs.length, 0, `${c.who} carries ${longs.length} long-run sessions; the exemption above no longer holds`);
    const runs = c.plan.weeks.flatMap((w) => w.sessions.filter((s) => RUN.has(s.type)));
    assert.ok(runs.length > 20, `${c.who} has only ${runs.length} runs — a plan that builds nothing proves nothing`);
  }
});

test("the long-run ladder never steps backwards", () => {
  // ⚠️ THIS IS THE ONE THE RUNNING MAXIMUM EXISTS FOR, and it fails silently without it: lifting each
  // week on its own merits makes the long run shrink whenever the next week happens to need less.
  // Measured, dropping the running maximum sends 3,900 of 50,240 week-to-week transitions backwards.
  let transitions = 0, backwards = 0, worst = 1, worstWho = "";
  const examples: string[] = [];
  for (const c of sweep()) {
    const full = c.plan.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
    for (let i = 1; i < full.length; i++) {
      const a = full[i - 1]!, b = full[i]!;
      // Deloads and the taper are deliberately smaller, so a step down into or out of one is correct.
      if (a.isDeload || b.isDeload || a.phase === "taper" || b.phase === "taper") continue;
      const la = a.sessions.find((s) => s.type === "long"), lb = b.sessions.find((s) => s.type === "long");
      if (!la || !lb || mins(la) <= 0) continue;
      transitions++;
      const r = mins(lb) / mins(la);
      if (r < 0.999) { backwards++; if (examples.length < 6) examples.push(`${c.who} wk${a.index}->${b.index}: ${mins(la).toFixed(0)}min -> ${mins(lb).toFixed(0)}min`); }
      if (r > worst) { worst = r; worstWho = `${c.who} wk${a.index}->${b.index}`; }
    }
  }
  assert.ok(transitions > 5000, `only ${transitions} transitions measured`);
  assert.equal(backwards, 0, `${backwards} of ${transitions} long runs got SHORTER than the week before:\n  ${examples.join("\n  ")}`);
  // ⚠️ THE JUMP HALF OF THIS GUARD MOVED OUT, AND ITS COMMENT USED TO BE WRONG. It said "measured
  // 1.20x before the fix and 1.23x after", and 1.23 was measured on ADJACENT pairs only — this loop
  // skips any pair touching a deload, so it could not see the jump a runner actually meets, which
  // spans one. On the spanning definition the same code measured 1.3585x on this very sweep, above
  // this test's own 1.30 bar. Three agents reported 1.23x, 1.3038x and 1.3220x for one build and all
  // three were right about different transitions. The jump now has its own guard below, which
  // measures BOTH definitions and names them; `backwards` is what this one is for.
  assert.ok(worst < 1.30, `a long run jumped ${worst.toFixed(2)}x between adjacent weeks (${worstWho})`);
});

test("BLOCKER: a lift never builds a week-on-week jump tail — measured on BOTH definitions", () => {
  // ⚠️ THE FIRST VERSION OF THE LIFT BUILT A TAIL THAT HAD NEVER EXISTED, AND THE AGGREGATE GOT
  // BETTER WHILE IT DID — which is exactly how a tail hides. On the 3,600-plan audit grid, transitions
  // over the evidence report's 1.10 guardrail went 6.22% -> 4.78% while the >1.25 bucket went 0 -> 33
  // and the worst transition 1.2250 -> 1.3220. `LONG_LIFT_STEP_MAX` closes it.
  //
  // ⚠️ TWO DEFINITIONS, BOTH ASSERTED, BECAUSE PICKING ONE IS HOW THE FIGURE CAME TO BE REPORTED THREE
  // DIFFERENT WAYS. Measured on THIS sweep (1,920 plans):
  //                      ADJACENT (pairs touching an eased week skipped)   SPANNING (consecutive
  //                                                                        NON-EASED weeks, so a jump
  //                                                                        may cross a deload)
  //   base, unfixed        1.0698   (0 over 1.10)                          1.1250   (312 over 1.10, 0 over 1.15)
  //   fix, unclamped       1.2250   (142 over 1.10, 30 over 1.15)          1.3585   (450 over 1.10, 59 over 1.15, 9 over 1.25)
  //   fix, clamped 1.10    1.1001   (5 over 1.10)                          1.1250   (235 over 1.10, 0 over 1.15)
  // The SPANNING one is what the runner meets — their long run went 53 minutes, then an easy week,
  // then 72 — and it is the one the adjacent-only loop above is structurally unable to see.
  //
  // ⚠️ THE BARS ARE THE UNFIXED ENGINE'S OWN WORST CASES PLUS A HAIR, not round numbers: the clamp
  // cannot go below them, because it only ever limits a LIFT and never shortens a long run the ramp
  // itself asked for. 1.1250 is that floor on the spanning ruler.
  const eased = (w: PlannedWeek) => !!w.isDeload || w.phase === "taper";
  const adj: number[] = [], span: number[] = [];
  // Running maxima, not Math.max over the growing array — that is quadratic and cost this guard four
  // seconds of a suite people run constantly.
  let maxAdj = 0, maxSpan = 0, adjWho = "", spanWho = "";
  let reachedTheCase = false;
  for (const c of sweep()) {
    // The discriminating profile, named so this guard cannot go vacuous if the sweep is ever trimmed.
    if (/^5k\/3d\/5k=25min\/recreational\/vol=25\/ret=false/.test(c.who)) reachedTheCase = true;
    const full = c.plan.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
    for (let i = 1; i < full.length; i++) {
      const a = full[i - 1]!, b = full[i]!;
      if (eased(a) || eased(b)) continue;
      const la = a.sessions.find((s) => s.type === "long"), lb = b.sessions.find((s) => s.type === "long");
      if (!la || !lb || mins(la) <= 0) continue;
      const r = mins(lb) / mins(la);
      if (r > maxAdj) { maxAdj = r; adjWho = `${c.who} wk${a.index}->${b.index} ${mins(la).toFixed(0)}->${mins(lb).toFixed(0)}min`; }
      adj.push(r);
    }
    let prev = 0, prevIdx = -1;
    for (let i = 0; i < c.plan.weeks.length; i++) {
      const w = c.plan.weeks[i]!;
      const l = w.sessions.find((s) => s.type === "long");
      if (!l) continue;
      if (i === 0 || i === c.plan.weeks.length - 1 || eased(w)) continue;
      if (prev > 0) {
        const r = mins(l) / prev;
        if (r > maxSpan) { maxSpan = r; spanWho = `${c.who} wk${prevIdx + 1}->${i + 1} ${prev.toFixed(0)}->${mins(l).toFixed(0)}min`; }
        span.push(r);
      }
      prev = mins(l); prevIdx = i;
    }
  }
  assert.ok(reachedTheCase, "the sweep no longer contains 5k/3d/25min/recreational/vol=25 — the profile whose long run jumped 1.3585x");
  assert.ok(adj.length > 10000 && span.length > 20000, `too few transitions: ${adj.length} adjacent, ${span.length} spanning`);
  const worstAdj = maxAdj, worstSpan = maxSpan;
  assert.ok(worstAdj < 1.11,
    `a long run jumped ${worstAdj.toFixed(4)}x between adjacent weeks (${adjWho}) — measured 1.1001 with the clamp and 1.2250 without it`);
  assert.ok(worstSpan < 1.13,
    `a long run jumped ${worstSpan.toFixed(4)}x across consecutive non-eased weeks (${spanWho}) — measured 1.1250 with the clamp, 1.3585 without it, and 1.1250 on the unfixed engine`);
  assert.equal(span.filter((r) => r > 1.15).length, 0,
    `${span.filter((r) => r > 1.15).length} of ${span.length} spanning transitions exceed 1.15x — 59 do without the clamp, 0 on the unfixed engine`);
  // ⚠️ AND THE CONSTANT ITSELF, so LOOSENING it fails even on a grid that happens not to reach the
  // tail. A bar that depends on the sweep reaching the worst case is a bar that goes quiet when
  // somebody trims the sweep.
  const src = readFileSync(fileURLToPath(new URL("../src/plan/generate-plan.ts", import.meta.url)), "utf8");
  const m = src.match(/^const LONG_LIFT_STEP_MAX = ([\d.]+);/m);
  assert.ok(m, "LONG_LIFT_STEP_MAX is gone — every lift is unbounded again");
  assert.ok(Number(m![1]) <= 1.10 + 1e-9,
    `LONG_LIFT_STEP_MAX has been loosened to ${m![1]} — the evidence report's single-session guardrail is 1.10`);
});

test("a deload's and the taper's long run is never LIFTED — the cut they exist to make survives", () => {
  // ⚠️ LIFTING AN EASED WEEK UNDOES ITS WHOLE PURPOSE, and it is the most tempting simplification in
  // `enforceLongRunIsLongest` because it would take the belt out of the code. Measured with the
  // `eased` test removed: the long run entering a deload goes from at most 0.71x the week before it to
  // exactly 1.00x in ALL 768 deload pairs and all 128 taper pairs, and the mean deload cut collapses
  // from 27.0% to 10.7% with a 10th percentile of MINUS 1.3% — deloads bigger than the week before.
  let deloadPairs = 0, taperPairs = 0, worstD = 0, worstT = 0, whoD = "", whoT = "";
  for (const c of sweep()) {
    const full = c.plan.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
    for (let i = 1; i < full.length; i++) {
      const prev = full[i - 1]!, w = full[i]!;
      const lp = prev.sessions.find((s) => s.type === "long"), lw = w.sessions.find((s) => s.type === "long");
      if (!lp || !lw || mins(lp) <= 0) continue;
      const r = mins(lw) / mins(lp);
      if (w.isDeload && !prev.isDeload && prev.phase !== "taper") {
        deloadPairs++;
        if (r > worstD) { worstD = r; whoD = `${c.who} wk${prev.index}->${w.index} ${mins(lp).toFixed(0)}->${mins(lw).toFixed(0)}min`; }
      }
      if (w.phase === "taper" && prev.phase !== "taper" && !prev.isDeload) {
        taperPairs++;
        if (r > worstT) { worstT = r; whoT = `${c.who} wk${prev.index}->${w.index} ${mins(lp).toFixed(0)}->${mins(lw).toFixed(0)}min`; }
      }
    }
  }
  assert.ok(deloadPairs > 200, `only ${deloadPairs} deload entries measured`);
  assert.ok(taperPairs > 50, `only ${taperPairs} taper entries measured`);
  // 0.75 and 0.85: measured worst 0.71 and 0.80 with the rule in place, 1.00 and 1.00 without it.
  assert.ok(worstD < 0.75, `a deload's long run was ${worstD.toFixed(2)}x the week before — the cut has been lifted away (${whoD})`);
  assert.ok(worstT < 0.85, `the taper's long run was ${worstT.toFixed(2)}x the week before — the cut has been lifted away (${whoT})`);
});

test("the lift is clamped to the plan's own peak long run — no long run outgrows its event", () => {
  // ⚠️ NOTHING CHECKED THE LONG-RUN DISTANCE CEILING BEFORE THIS. `Math.max(1, vScale)` on `peakLong`
  // is one-way on purpose (a marathoner stating 30 km/week once got a 10.3 km longest run when that
  // rule was absent), so a fix for the inversion must lift TOWARD the destination the plan already
  // chose and never past it. Measured: removing the clamp takes a 5 km plan's longest long run from
  // 3.80x its race distance to 4.55x — a 22.5 km long run before a 5 km race — and puts 504 plans over
  // `LONG_ABS_CEILING_MIN`.
  //
  // The bounds are the measured envelope, which is IDENTICAL before and after the fix: it widens
  // nothing. `LONG_ABS_CEILING_MIN` is mirrored here in minutes; the two claims are independent, so a
  // change that slips past one still has to pass the other.
  //
  // ⚠️ THE DISCLOSED COST, RECONCILED — THREE AGENTS REPORTED THREE COUNTS AND ALL THREE WERE RIGHT
  // ABOUT THEIR OWN GRID. The lift puts more plans into a `LONG_CAP_KM` overshoot pocket that already
  // existed (`peakLong` takes `max(longFloorMin, …)` OUTSIDE the cap, so the cap is exceeded whenever
  // the distance floor is higher than it): reported as 230 -> 261, then 345 -> 349, and measured here
  // on a 3,600-plan grid with the engine's own tables read from the source rather than typed from
  // memory as **225 -> 253**. The reproducible figures are the ones that do not depend on the grid:
  // the WORST overshoot is identical before and after (+9.5%), the longest long run per distance is
  // identical to three decimals, and `LONG_ABS_CEILING_MIN` breaches stay at 0. Nothing gets worse;
  // more plans reach a ceiling that was already being exceeded. Quote a count only with its grid.
  //
  // ⚠️ AND THE SECOND DISCLOSED COST REPRODUCES EXACTLY: the biggest week sits in build or peak in
  // 98.2% of plans unfixed and 96.9% fixed, by the repo's own unmodified tools/audit-progression.mjs.
  // Lifting a base week can make it the plan's biggest. No test guards it; that tool reports it.
  const MAX_OVER_RACE: Record<string, number> = { "5k": 3.85, "10k": 2.35, half: 1.50, marathon: 0.90 };
  const ABS_CEILING_MIN: Record<string, number> = { "5k": 90, "10k": 110, half: 145, marathon: 240 };
  let plans = 0;
  for (const c of [...sweep(), ...beginnerSweep()]) {
    const longs = c.plan.weeks.flatMap((w) => w.sessions.filter((s) => s.type === "long"));
    if (!longs.length) continue;
    plans++;
    const maxKm = Math.max(...longs.map(km)), maxMin = Math.max(...longs.map(mins));
    const ratio = maxKm / RACE_KM[c.distance]!;
    assert.ok(ratio <= MAX_OVER_RACE[c.distance]!, `${c.who}: longest long run ${maxKm.toFixed(1)} km is ${ratio.toFixed(2)}x the race distance`);
    assert.ok(maxMin <= ABS_CEILING_MIN[c.distance]! + 0.5, `${c.who}: longest long run ${maxMin.toFixed(0)} min is over the ${ABS_CEILING_MIN[c.distance]} min ceiling`);
  }
  assert.ok(plans > 500, `only ${plans} plans carried a long run`);
});

test("the sweep really contains the cases that make this hard", () => {
  // ⚠️ EVERY GUARD ABOVE IS ONLY AS GOOD AS WHAT THE SWEEP HAPPENS TO BUILD, so the hard cases are
  // enumerated rather than hoped for. Each of these is a flavour that beat an earlier version of the
  // fix, with the count that break produced beside it.
  let strides = 0, recovery = 0, moderate = 0, noLongRun = 0, partialFirst = 0, mondayRaceEve = 0;
  for (const c of sweep()) {
    if (c.plan.weeks[0]!.startDateIso === "2026-08-26") partialFirst++;
    for (const w of c.plan.weeks) {
      const long = w.sessions.find((s) => s.type === "long");
      if (!long) noLongRun++;
      for (const s of w.sessions) {
        if (s === long) continue;
        // `easyRun(p, m, true)` and `easyHillStrides` are typed `strides`: drop that type from the
        // comparison set and 480 ordinary weeks invert on the clock, plus a further 494 of the 5,120
        // week-1-and-race-week ones — 9.65% of them, against 0.43% elsewhere.
        if (s.type === "strides") strides++;
        // The seventh day's jog and the rotation's own `recoveryRun`: drop `recovery` from the
        // comparison set and 468 weeks invert on the clock, 41 on distance.
        if (s.type === "recovery") recovery++;
        // `moderateRun` runs the WHOLE session at threshold + 60 s/km, covering 1.09x the ground per
        // minute — which is how a week can invert on distance while the clock looks fine.
        if (/moderate/i.test(s.title)) moderate++;
      }
      if (w.sessions.some((s) => /shakeout/i.test(s.title))) mondayRaceEve++;
    }
  }
  assert.ok(strides > 100, `only ${strides} strides-flavoured easy runs in the sweep`);
  assert.ok(recovery > 100, `only ${recovery} recovery jogs in the sweep`);
  assert.ok(moderate > 100, `only ${moderate} moderate-gear runs in the sweep`);
  assert.ok(noLongRun > 20, `only ${noLongRun} weeks with no long run — the vacuous branch of the invariant is never exercised`);
  assert.ok(partialFirst > 100, `only ${partialFirst} plans start mid-week, so applyPartialFirstWeek barely fires`);
  assert.ok(mondayRaceEve > 20, `only ${mondayRaceEve} pre-race shakeouts — applyRaceDay's cross-week eve rule is not being exercised`);
});

test("the owner's own plan: weeks 1-4 were inverted and are now clean, and weeks 5-14 are untouched", () => {
  // The profile reproduced to the digit from his screenshot (5 km goal, 4 days, recreational,
  // returning from a break, 19:54 anchor, long run Sunday, race 2026-11-29): week 2 read
  // "25′ continuous tempo 50′/10.5k · 37′ moderate 37′/7.5k · 33′ recovery 33′/5.4k · LONG 33′/6.1k"
  // with a 24.8 km header. This is the regression case, kept as the shape of the report rather than
  // as a set of exact numbers — the session rotation is allowed to change, the invariant is not.
  const athlete: Athlete = {
    daysPerWeek: 4,
    recent: { distanceMeters: 5000, timeSeconds: 1194 },
    experience: "recreational",
    includeStrength: false,
    returningFromBreak: true,
    longRunDay: 6,
  };
  const p = generatePlan(athlete, { distance: "5k", targetTimeSeconds: 1134, raceDateIso: "2026-11-29", startDateIso: "2026-08-24" });
  assert.ok(p.weeks.length >= 13, `expected a 13-week-plus block, got ${p.weeks.length}`);
  const bad = p.weeks.filter((w) => inversion(w) !== null).map((w) => w.index);
  assert.deepEqual(bad, [], `his own plan still inverts in weeks ${bad.join(", ")}`);
  // ⚠️ AND THE FIX IS A LIFT, NOT A TRIM. His first four weeks each gained a longer long run; the
  // block total moved 373.6 -> 376.9 km, i.e. it grew by 0.9%. A fix that reached 0% inversion by
  // shortening his easy runs across the block would satisfy the assertion above and be the wrong
  // answer, so the direction is asserted too: over the whole sweep, long-run minutes rise 2.99% while
  // easy-run minutes fall 2.71% and the block itself is within a quarter of a percent of its old size.
  const w2 = p.weeks[1]!;
  const long2 = w2.sessions.find((s) => s.type === "long")!;
  assert.ok(mins(long2) >= 37, `his week 2 long run is ${mins(long2).toFixed(0)} min; before the fix it was 33 and the moderate run beside it was 37`);
});

test("the invariant is reached by GROWING the long run, not by shrinking the week", () => {
  // ⚠️ THE OTHER WAY TO 0% IS TO CAP THE EASY RUNS EVERYWHERE, and it was measured on this same sweep
  // by disabling the lift: easy-run minutes fall 6.76% instead of 2.98%, and weeks under the pyramidal
  // easy floor go 98 -> 101. Removing easy running does not remove easy minutes from a week; it removes
  // them from the intensity model's denominator, which is precisely how that floor breaks. Over the
  // full audit grid the lift keeps the block's size: distance -0.22%, running minutes -0.23%, long-run
  // minutes +2.99%, easy-run minutes -2.71%.
  let longMin = 0, easyMin = 0, easyRuns = 0;
  for (const c of sweep()) {
    for (const w of c.plan.weeks) {
      for (const s of w.sessions) {
        if (s.type === "long") longMin += mins(s);
        else if (AEROBIC.has(s.type)) { easyMin += mins(s); easyRuns++; }
      }
    }
  }
  assert.ok(easyRuns > 20_000, `only ${easyRuns} easy runs measured`);
  // ⚠️ THE LOWER BOUND IS THE LOAD-BEARING HALF and it is where the margin is. An upper bound tight
  // enough to reject cap-only would sit a fraction above the shipped value — far too tight to survive an
  // innocent session-library change, and the sort of threshold that gets relaxed rather than
  // investigated. The cap-only direction is guarded by the easy floor below and by
  // `test/session-library.test.ts`'s own intensity sweep instead.
  //
  // ⚠️⚠️ RE-MEASURED WITH THE BLOCK-LENGTH CAP AND THE GEOMETRIC LONG-RUN LADDER (2026-09-01), AND BOTH
  // STATES MOVED DOWN TOGETHER — which is why the floor moves rather than the claim. A geometric ramp
  // grows by a constant PERCENTAGE, so its absolute steps are smaller early than a linear ramp's; the
  // mid-block long runs are shorter and the block's long-run share falls with them. Measured on this
  // sweep (127,988 easy runs):
  //
  //     with the lift   |  no enforcement at all  |  separation
  //         0.7383      |         0.6896          |   4.9 points   (was 0.7647 / 0.7203 = 4.4)
  //
  // So the lift is doing MORE work than before, not less, and the floor sits between the two states.
  const share = longMin / easyMin;
  assert.ok(share > 0.71, `long-run minutes are only ${(share * 100).toFixed(2)}% of the other easy running — measured 73.83% with the lift and 68.96% with no enforcement, so the long run is not being grown`);

  // ⚠️ AND THE EASY RUNS KEEP THEIR OWN RAMP, which is the falsifiable half. `buildWeek` sizes an easy
  // run as min(95, baseMin x vScale) x easyRamp x taperMult, with the shortest slot at baseMin 40 and
  // `EASY_START_FRAC` = 1 / PEAK_VOLUME_MULTIPLIER = 0.80 — so with no stated volume, outside a deload
  // and outside the taper, no easy run can be under 40 x 0.80 = 32 minutes. Measured: 32.0 both before
  // and after the fix, and 28.0 with the lift disabled so the cap does the work (66 of 17,600 pushed
  // under). This is the main track's version of the beginner midweek guard above.
  let shortest = Infinity, who = "";
  for (const c of sweep()) {
    if (!c.who.includes("vol=null")) continue;                 // vScale is 1 only when nothing is stated
    c.plan.weeks.forEach((w, i) => {
      if (i === 0 || w.isDeload || w.phase === "taper" || w.sessions.some((s) => s.type === "race")) return;
      for (const s of w.sessions) {
        if (s.type !== "easy" && s.type !== "strides") continue;
        if (mins(s) < shortest) { shortest = mins(s); who = `${c.who} wk${w.index} ${describe(s)}`; }
      }
    });
  }
  assert.ok(Number.isFinite(shortest), "no unstated-volume easy runs measured");
  assert.ok(shortest >= 31.5, `an easy run is down to ${shortest.toFixed(0)} min (${who}) — the ramp's own floor is 40 x 0.80 = 32, so the week is being trimmed to reach the invariant`);
});

test("capping the easy runs is the belt, not the mechanism — the pyramidal easy floor does not get worse", () => {
  // ⚠️ THIS IS THE RISK CLAUDE.MD WARNS ABOUT MOST LOUDLY in this area, so it is measured rather than
  // argued. Measured on this sweep: 99 breaches with no enforcement, 98 with the fix (slightly better,
  // because a lifted long run adds easy minutes to the denominator), and 101 with the lift disabled so
  // the cap does all the work.
  // ⚠️ THE MARGIN IS TWO WEEKS, WHICH IS THIN, AND THAT IS STATED RATHER THAN HIDDEN. A failure here is
  // a signal to find out which weeks moved and why — not to raise the number. The breaching pocket is
  // pre-existing and documented: three- and four-day 5 km blocks for slow runners, where one
  // library-length quality session is simply a large share of a small week.
  const { computeDistribution, honoursModel } = intensity;
  let weeks = 0, breaches = 0, worst = 1, who = "";
  for (const c of sweep()) {
    c.plan.weeks.forEach((w, i) => {
      if (i === 0 || w.sessions.some((s) => s.type === "race")) return;   // both are fragments by construction
      const d = computeDistribution(w.sessions);
      if (!d || !Number.isFinite(d.easy) || d.totalSeconds <= 0) return;
      weeks++;
      if (!honoursModel(d, c.plan.intensityModel)) breaches++;
      if (d.easy < worst) { worst = d.easy; who = `${c.who} wk${w.index}`; }
    });
  }
  assert.ok(weeks > 20_000, `only ${weeks} weeks measured`);
  assert.ok(breaches <= 99, `${breaches} of ${weeks} weeks are under the pyramidal easy floor; the unenforced plan measures 99 and the fix 98`);
  // The worst single week is identical before and after the fix — it is not made deeper, only no worse.
  assert.ok(worst > 0.52, `the worst easy fraction is ${(worst * 100).toFixed(1)}% (${who}); it measured 53.0% both before and after the fix`);
});
