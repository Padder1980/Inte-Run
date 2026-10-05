import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePlan, longRunRangeFor, VOLUME_GROWTH, CHALLENGING_FELL_BACK, GROWTH_FELL_BACK, longCapNote } from "../src/plan/generate-plan.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";
import type { Athlete, Goal, PlannedWeek, RaceDistanceKey } from "../src/domain/types.ts";

/**
 * STAGE B8 — TRAINING PREFERENCE DIALS (PLAN.md: "three dials that each move one named constant, offered only where
 * the plan can honour them"): how fast mileage grows (VOLUME_GROWTH), how many hard days (qualitySessionsThisWeek),
 * and how long the long run may get (longRunMaxMinutes). Every claim is asked of the real engine over a grid.
 */

const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
const goal = (distance: RaceDistanceKey, raceDateIso = "2027-03-07"): Goal =>
  ({ distance, targetTimeSeconds: TT[distance]!, raceDateIso, startDateIso: "2026-08-03" } as Goal);
const athlete = (o: Partial<Athlete> = {}): Athlete => ({ daysPerWeek: 5, recent: { distanceMeters: 10000, timeSeconds: 3000 },
  experience: "recreational", includeStrength: false, returningFromInjury: false, ...o } as Athlete);
const race = (w: PlannedWeek) => w.sessions.some((s) => s.type === "race");
const full = (ws: PlannedWeek[]) => ws.filter((w, i) => i > 0 && !race(w));
const peakKm = (ws: PlannedWeek[]) => Math.max(...full(ws).map((w) => w.plannedDistanceMeters)) / 1000;
const weekOneKm = (ws: PlannedWeek[]) => (ws.find((w) => !w.isDeload && !race(w))?.plannedDistanceMeters ?? 0) / 1000;
const hardTotal = (ws: PlannedWeek[]) => ws.reduce((n, w) => n + w.qualitySessionCount, 0);
const longestLong = (ws: PlannedWeek[]) => Math.max(0, ...ws.flatMap((w) => w.sessions).filter((s) => s.type === "long")
  .map((s) => Math.round(s.estimatedDurationSeconds / 60)));
const taperCut = (ws: PlannedWeek[], peakFrom: PlannedWeek[]) => {
  const tw = ws.filter((w) => w.phase === "taper");
  const lastFull = tw.length > 1 ? tw[tw.length - 2]! : tw[0]!;
  return 1 - lastFull.plannedDistanceMeters / 1000 / peakKm(peakFrom);
};
/** Weeks with an easy run longer than the long run, on either ruler — the owner's rule that the long run is the longest. */
const easyOverLong = (ws: PlannedWeek[]) => ws.filter((w) => {
  const l = w.sessions.find((s) => s.type === "long");
  return !!l && w.sessions.some((s) => s !== l && (s.type === "easy" || s.type === "recovery" || s.type === "strides") &&
    ((s.estimatedDistanceMeters ?? 0) > (l.estimatedDistanceMeters ?? 0) || (s.trainingDistanceMeters ?? 0) > (l.trainingDistanceMeters ?? 0)));
}).length;
const breaches = (p: ReturnType<typeof generatePlan>) => p.weeks.filter((w) => !race(w)).filter((w) => {
  const d = computeDistribution(w.sessions);
  return d.totalSeconds > 0 && !honoursModel(d, p.intensityModel);
}).length;

function* grid(days = [4, 5, 6], vols: (number | undefined)[] = [undefined, 30, 50, 80]) {
  for (const dist of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[])
    for (const d of days) for (const vol of vols) for (const raceDate of ["2026-12-20", "2027-03-07"])
      yield { who: `${dist}/${d}d/vol=${vol ?? "unset"}/${raceDate}`, g: goal(dist, raceDate), a: athlete({ daysPerWeek: d, ...(vol ? { weeklyVolumeKmCurrent: vol } : {}) }) };
}

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: every dial's default IS the plan as it was — byte-identical across the grid", () => {
  let n = 0;
  for (const { who, g, a } of grid()) {
    const plain = generatePlan(a, g);
    const explicit = generatePlan({ ...a, volumeGrowth: "progressive", hardDays: "balanced", longRunMaxMinutes: undefined }, g);
    assert.deepEqual({ ...explicit, athlete: null, createdAtIso: "" }, { ...plain, athlete: null, createdAtIso: "" }, who + ": the defaults changed the plan");
    n++;
  }
  assert.ok(n >= 90, "only " + n + " plans compared");
});

test("BLOCKER: how fast mileage grows — the peak's height above what they run, in order, never below it", () => {
  // PLAN.md's own re-break: set Steady to 0.9, and the block peaks under the mileage the runner already runs.
  assert.ok(VOLUME_GROWTH.progressive === 1.25, "the default growth moved");
  assert.ok(VOLUME_GROWTH.progressive > VOLUME_GROWTH.gradual && VOLUME_GROWTH.gradual > VOLUME_GROWTH.steady && VOLUME_GROWTH.steady >= 1,
    "the growth values are not in order, or one peaks below what the runner already runs");
  const ratios: Record<string, number[]> = { progressive: [], gradual: [], steady: [] };
  let changed = 0, n = 0, steppedBack = 0;
  for (const { who, g, a } of grid([4, 5, 6], [30, 50, 80])) {
    const stated = a.weeklyVolumeKmCurrent!;
    const base = generatePlan(a, g);
    for (const v of ["gradual", "steady"] as const) {
      const p = generatePlan({ ...a, volumeGrowth: v }, g);
      n++;
      // ⚠️ A STEP BACK IS SAID, NEVER SILENT. Where less growth would shallow the taper or lift week one past its
      // guard, the plan grows by the next step up (and says which); all the way back means the default plan itself.
      const note = p.notes.find((x) => x === GROWTH_FELL_BACK.gradual || x === GROWTH_FELL_BACK.progressive);
      if (note) steppedBack++;
      if (note === GROWTH_FELL_BACK.progressive) assert.deepEqual(p.weeks, base.weeks, who + " " + v + ": stepped all the way back, yet not the usual plan");
      if (note === GROWTH_FELL_BACK.gradual) {
        assert.equal(v, "steady", who + ": only Steady can step back to Gradual");
        assert.deepEqual(p.weeks, generatePlan({ ...a, volumeGrowth: "gradual" }, g).weeks, who + ": stepped back to Gradual, yet not the Gradual plan");
      }
      if (JSON.stringify(p.weeks) !== JSON.stringify(base.weeks)) changed++;
      else assert.equal(note, GROWTH_FELL_BACK.progressive, who + " " + v + ": the dial changed nothing and did not say why");
      // ⚠️⚠️ WHAT THE DIAL MOVES IS THE PEAK'S HEIGHT ABOVE WHAT THEY RUN NOW — measured, not assumed. Growth from
      // week one to the peak is NOT reliably smaller: a 10K at 30 km on 5 days went 27.2 -> 38.3 km (progressive)
      // and 22.7 -> 32.4 km (steady), the fit taking both ends down together; and where a plan cannot reach the
      // stated mileage at all (a 5K at 50 km on 4 days peaks at 49.5 km whatever is asked) the peak stays and
      // week one rises toward what they run — 40.5, 43.6, 45.9 km. So the claims are the peak never rises with
      // less growth, and the 1.10x guardrail on week one holds wherever the default holds it. The app's question
      // is worded for what it does: how much the weekly mileage grows by the peak.
      // ⚠️ AND A PLAN THAT CANNOT REACH WHAT THEY RUN AT ALL IS THE EXCEPTION, MEASURED: a 5K on 5 days stated at
      // 80 km tops out near 58 km whatever is asked, and a flatter ramp makes its early weeks the bigger ones —
      // peak 57.6 (progressive), 59.2, 59.8 km. Still far under what they run. So: never above BOTH the default
      // plan's peak and the dial's own target.
      assert.ok(peakKm(p.weeks) <= Math.max(peakKm(base.weeks), stated * VOLUME_GROWTH[v]) + 0.05,
        who + " " + v + ": asking for less growth took the peak above the default's and its own target");
      if (weekOneKm(base.weeks) <= stated * 1.10) assert.ok(weekOneKm(p.weeks) <= stated * 1.10, who + " " + v + ": week one past 1.10x");
      // The taper still cuts at least as much against the plan's own peak.
      assert.ok(taperCut(p.weeks, p.weeks) >= Math.min(0.30, taperCut(base.weeks, base.weeks)) - 1e-9, who + " " + v + ": the taper cut shrank");
      ratios[v]!.push(peakKm(p.weeks) / stated);
    }
    ratios.progressive!.push(peakKm(base.weeks) / stated);
  }
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const m = { progressive: median(ratios.progressive!), gradual: median(ratios.gradual!), steady: median(ratios.steady!) };
  assert.ok(m.progressive > m.gradual && m.gradual > m.steady, "the dial does not order the peak: " + JSON.stringify(m));
  assert.ok(m.steady >= 1, "a Steady block peaks under what the runner already runs: " + m.steady.toFixed(2));
  // Every non-default value changes the plan, except where it had to step all the way back — and those are few.
  assert.ok(changed + steppedBack >= n && steppedBack <= n * 0.15, changed + " of " + n + " changed, " + steppedBack + " stepped back");
  // ⚠️ AND IT IS ONLY READ WITH A STATED MILEAGE — without one there is nothing to grow from, and the app hides it.
  const a = athlete();
  assert.deepEqual(generatePlan({ ...a, volumeGrowth: "steady" }, goal("half")).weeks, generatePlan(a, goal("half")).weeks,
    "the growth dial changed a plan with no stated mileage");
});

test("BLOCKER: how many hard days — Comfortable keeps one outside the peak; Challenging adds one or says why not", () => {
  let added = 0, fellBack = 0, n = 0;
  for (const { who, g, a } of grid([5, 6, 7])) {
    const base = generatePlan(a, g);
    const comf = generatePlan({ ...a, hardDays: "comfortable" }, g);
    for (const w of comf.weeks) if (w.phase !== "peak" && !race(w)) assert.ok(w.qualitySessionCount <= 1, who + ": a comfortable plan has two hard days in " + w.phase);
    assert.ok(hardTotal(comf.weeks) <= hardTotal(base.weeks), who + ": comfortable added hard days");
    assert.ok(breaches(comf) <= breaches(base), who + ": comfortable put a week under the intensity floor");
    const hard = generatePlan({ ...a, hardDays: "challenging" }, g);
    n++;
    if (hard.notes.includes(CHALLENGING_FELL_BACK)) {
      fellBack++;
      // Fell back: exactly the balanced plan, with the reason on it.
      assert.deepEqual(hard.weeks, base.weeks, who + ": a challenging plan that fell back is not the balanced one");
    } else {
      added++;
      // Accepted: more hard days, only in the base, and no week newly under the intensity floor.
      assert.ok(hardTotal(hard.weeks) > hardTotal(base.weeks), who + ": challenging was accepted without a single extra hard day");
      hard.weeks.forEach((w, i) => {
        if (w.qualitySessionCount > base.weeks[i]!.qualitySessionCount) assert.equal(w.phase, "base", who + ": challenging added a hard day outside the base");
      });
      assert.ok(breaches(hard) <= breaches(base), who + ": challenging put a week under the intensity floor");
    }
  }
  assert.ok(added > n / 2 && fellBack > 0, "challenging added hard days in " + added + " of " + n + " and fell back in " + fellBack);
  // A four-day week, a young runner and a recovery week keep their one hard day whatever the dial says.
  for (const a of [athlete({ daysPerWeek: 4 }), athlete({ age: 15 })]) {
    const g = goal("10k");
    assert.deepEqual(generatePlan({ ...a, hardDays: "challenging" }, g).weeks, generatePlan(a, g).weeks, "challenging changed a plan it cannot honour");
  }
});

test("BLOCKER: how long the long run may get — every choice exactly as offered, never below the race's floor, never longer than it was", () => {
  let offered = 0, between = 0;
  for (const { who, g, a } of grid([4, 5, 6], [undefined, 50])) {
    const r = longRunRangeFor(a, g);
    const free = generatePlan(a, g);
    const natural = longestLong(free.weeks);
    const shortest = longestLong(generatePlan({ ...a, longRunMaxMinutes: 1 }, g).weeks);
    assert.ok(r, who + ": not offered on the main track");
    if (!r.choices.length) continue;
    offered++;
    assert.equal(r.maxMinutes, natural, who + ": the range does not end at the plan's own longest long run");
    assert.equal(r.minMinutes, r.choices[0], who + ": the range's shortest is not its first choice");
    assert.ok(r.choices.every((c, i) => c <= natural - 5 && (i === 0 || c > r.choices[i - 1]!)), who + ": choices out of order or at the top: " + r.choices);
    // ⚠️ EVERY CHOICE THE PICKER OFFERS IS DELIVERED AS OFFERED — no note, the long run at the choice.
    for (const c of r.choices) {
      const p = generatePlan({ ...a, longRunMaxMinutes: c }, g);
      const got = longestLong(p.weeks);
      assert.ok(got <= c && got >= c - 2, who + ": the " + c + "-minute choice delivered a " + got + "-minute long run");
      assert.ok(!p.notes.some((n) => n.startsWith("You asked for long runs")), who + ": the " + c + "-minute choice came with a note");
    }
    // Any other cap (a saved one, after the plan changed): never under the floor, never over the plan without it,
    // and never changed without saying so. ⚠️ AND WHATEVER IS DELIVERED KEEPS THE THREE THINGS A SHORTER LONG RUN CAN
    // BREAK no worse than the plan without it: the easy running, the first week, and the long run as the longest run.
    const stated = a.weeklyVolumeKmCurrent ?? 0;
    for (let c = shortest - 10; c < natural; c += 5) {
      const p = generatePlan({ ...a, longRunMaxMinutes: c }, g);
      const got = longestLong(p.weeks);
      assert.ok(breaches(p) <= breaches(free), who + ": a " + c + "-minute cap put a week under the intensity floor");
      assert.ok(easyOverLong(p.weeks) <= easyOverLong(free.weeks), who + ": a " + c + "-minute cap made an easy run longer than the long run");
      if (stated) assert.ok(weekOneKm(p.weeks) <= Math.max(stated * 1.10, weekOneKm(free.weeks)) + 1e-9,
        who + ": a " + c + "-minute cap made week one " + weekOneKm(p.weeks).toFixed(1) + " km");
      assert.ok(got >= Math.min(shortest, natural) - 1 && got <= natural, who + ": a " + c + "-minute cap delivered " + got);
      if (got > c + 1 || (c >= shortest && got < c - 2)) {
        between++;
        assert.ok(p.notes.some((n) => n.startsWith("You asked for long runs of up to " + c + " minutes. Your longest is " + got + " minutes")),
          who + ": a " + c + "-minute cap delivered " + got + " without saying so");
      }
    }
    // Above the plan's own longest, the plan as it was.
    assert.deepEqual(generatePlan({ ...a, longRunMaxMinutes: r.maxMinutes + 60 }, g).weeks, free.weeks, who + ": a cap above the plan changed it");
  }
  // Measured 32 of this grid's 48, with 50 choices between them: the rest are pinned at the race's floor, where a cap
  // could change nothing.
  assert.ok(offered >= 24, "the long-run dial was offered on only " + offered + " plans of the grid");
  // ⚠️ THE LIMIT IS THE RUNNER'S: where a cap does not hold, a shorter long run that does comes before a longer one.
  // Measured on this plan: 65-69 hold, 70-81 do not (the fit lands on a bigger first week), 82 and up hold again;
  // a search that only looked up turned a 75-minute limit into an 85-minute long run.
  const a75 = athlete({ daysPerWeek: 6, weeklyVolumeKmCurrent: 50 }), g75 = goal("5k", "2026-12-20");
  const p75 = generatePlan({ ...a75, longRunMaxMinutes: 75 }, g75);
  assert.ok(longestLong(p75.weeks) <= 75, "a 75-minute limit gave a " + longestLong(p75.weeks) + "-minute long run while a shorter one holds");
  assert.ok(p75.notes.includes(longCapNote(75, longestLong(p75.weeks), "weekOne")), "the lowered limit is not explained: " + p75.notes.filter((n) => /asked/.test(n)));
  assert.ok(!longRunRangeFor(a75, g75)!.choices.some((c) => c >= 70 && c <= 81), "the picker offers a cap that does not hold");
  // ⚠️ NEVER LONGER: where the race's floor sits over the absolute ceiling the natural peak IS the ceiling, and a cap
  // used to lift the long run to the floor — 146 against 145 minutes, measured on a slow half.
  const slow = athlete({ recent: { distanceMeters: 5000, timeSeconds: 1500 } });
  for (const dist of ["half", "marathon"] as RaceDistanceKey[]) {
    const g = goal(dist, "2027-01-10");
    assert.ok(longestLong(generatePlan({ ...slow, longRunMaxMinutes: 1 }, g).weeks) <= longestLong(generatePlan(slow, g).weeks),
      dist + ": a cap made the long run longer");
  }
  // Not offered where it would change nothing, nor on the tracks with their own ladders and ceilings.
  assert.equal(longRunRangeFor(athlete({ experience: "beginner" }), goal("10k")), null, "offered to a beginner");
  assert.equal(longRunRangeFor(athlete({ age: 15 }), goal("10k")), null, "offered to a young runner");
  // ⚠️ AND NOT READ THERE: a cap saved before the runner moved onto one of those tracks changes nothing, and no note
  // names a setting they cannot see.
  for (const a of [athlete({ experience: "beginner" }), athlete({ age: 15 }), athlete({ runWalk: true })]) {
    const g = goal("10k");
    const p = generatePlan({ ...a, longRunMaxMinutes: 30 }, g);
    assert.deepEqual(p.weeks, generatePlan(a, g).weeks, "a hidden long-run cap changed the plan");
    assert.ok(!p.notes.some((n) => n.startsWith("You asked for long runs")), "a note about a hidden long-run cap");
  }
});

test("BLOCKER: a cap too short for the plan's easy running is lifted, and the runner is told — the picker never offers it", () => {
  // Measured on test/session-library.test.ts's own sweep: a 5K on three days with no stated mileage, its long run
  // capped at the race's floor (50 minutes), put a build week at 67.1% easy — under the pyramidal floor.
  const a = athlete({ daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 18 * 60 + 20 }, includeStrength: true });
  const race = (weeks: number) => new Date(Date.UTC(2026, 6, 27) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const g = { distance: "5k", targetTimeSeconds: 1200, raceDateIso: race(20), startDateIso: "2026-07-27" } as Goal;
  const p = generatePlan({ ...a, longRunMaxMinutes: 50 }, g);
  const given = longestLong(p.weeks);
  assert.ok(given > 50, "a cap that breaks the intensity floor was kept");
  assert.ok(p.notes.includes(longCapNote(50, given, "easy")), "the cap was lifted without telling the runner: " + p.notes.filter((n) => /asked/.test(n)));
  assert.ok(breaches(p) <= breaches(generatePlan(a, g)), "the lifted cap still leaves a week under the floor");
  // No cap can be honoured there, so the picker has nothing to offer (the app hides it unless one is saved).
  assert.deepEqual(longRunRangeFor(a, g)?.choices, [], "the picker offers caps this plan cannot honour");
  // Where it is offered, its shortest value holds as it is.
  const a2 = { ...a, weeklyVolumeKmCurrent: 30 };
  const g2 = { ...g, raceDateIso: race(12) };
  const r = longRunRangeFor(a2, g2)!;
  assert.ok(r && r.choices.length, "the second fixture offers no long-run dial");
  const shortest = generatePlan({ ...a2, longRunMaxMinutes: r.minMinutes }, g2);
  assert.ok(!shortest.notes.some((n) => /You asked for long runs/.test(n)), "the picker's own shortest offer is lifted");
  assert.ok(longestLong(shortest.weeks) <= r.minMinutes, "the picker's shortest offer is not what the plan delivers");
});
