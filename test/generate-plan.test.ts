import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

const athlete: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 },
  experience: "recreational",
  includeStrength: true,
  returningFromInjury: true,
};

const goal: Goal = {
  distance: "half",
  targetTimeSeconds: 5400,
  raceDateIso: "2027-09-05", // a Sunday
  startDateIso: "2026-07-23",
};

const plan = generatePlan(athlete, goal);
const runSessions = (w: PlannedWeek) => w.sessions.filter((s) => s.estimatedDistanceMeters);
const isHard = (s: Session) =>
  s.intensity === "hard" || s.type === "threshold" || s.type === "race-specific";

test("phases appear in order base → build → peak → taper", () => {
  const order = ["base", "build", "peak", "taper"];
  let cursor = 0;
  for (const w of plan.weeks) {
    const pos = order.indexOf(w.phase);
    assert.ok(pos >= cursor, `phase ${w.phase} out of order at week ${w.index}`);
    cursor = pos;
  }
  assert.equal(plan.weeks[0]!.phase, "base");
  assert.equal(plan.weeks.at(-1)!.phase, "taper");
});

test("structured length is bounded and the last week holds the race week", () => {
  assert.ok(plan.weeks.length <= 40, "half-marathon plan bounded at 40 structured weeks");
  // race 2027-09-05 (Sun) → race-week Monday is 2027-08-30
  assert.equal(plan.weeks.at(-1)!.startDateIso, "2027-08-30");
});

test("a long runway maps to a full-length plan, not a short capped block", () => {
  // ~58 weeks out → a substantial plan (well beyond the old 20-week cap), spanning the runway.
  assert.ok(plan.weeks.length >= 30, `expected a long plan, got ${plan.weeks.length}`);
  // The bulk of the extra time is aerobic base, not stretched-out specific work.
  const base = plan.weeks.filter((w) => w.phase === "base").length;
  const build = plan.weeks.filter((w) => w.phase === "build").length;
  assert.ok(base > build, "surplus time should extend the base, not the build");
  assert.ok(build <= 10, "the specific build stays concentrated");
});

test("every week has exactly one long run — except race week, which has the race", () => {
  const raceWeek = plan.weeks.at(-1)!;
  for (const w of plan.weeks) {
    const longs = w.sessions.filter((s) => s.type === "long");
    if (w === raceWeek) {
      // The race replaces the long run. Prescribing both would be asking for a long run on, or
      // days after, the goal race — which is exactly what the plan used to do.
      assert.equal(longs.length, 0, "race week should not also carry a long run");
      continue;
    }
    assert.equal(longs.length, 1, `week ${w.index} long-run count`);
  }
});

test("race day is in the plan, on the real date, with nothing after it", () => {
  const raceWeek = plan.weeks.at(-1)!;
  const races = raceWeek.sessions.filter((s) => s.type === "race");
  assert.equal(races.length, 1, "exactly one race");
  const race = races[0]!;
  // It lands on the actual race date, not merely somewhere in the last week.
  const raceDow = (new Date(goal.raceDateIso + "T00:00:00Z").getUTCDay() + 6) % 7;
  assert.equal(race.dayOfWeek, raceDow, "race sits on its real weekday");
  assert.ok(race.estimatedDistanceMeters! > 21000, "the race covers the race distance");
  // Nothing is prescribed after you have raced.
  const after = raceWeek.sessions.filter((s) => s.dayOfWeek > raceDow && s.type !== "rest");
  assert.equal(after.length, 0, `nothing after race day, found ${after.map((s) => s.type).join()}`);
  // And nothing hard the day before it.
  const eve = raceWeek.sessions.filter((s) => s.dayOfWeek === raceDow - 1);
  const hardEve = eve.filter((s) => ["threshold", "vo2", "race-specific", "long", "strength"].includes(s.type));
  assert.equal(hardEve.length, 0, `nothing hard the day before, found ${hardEve.map((s) => s.type).join()}`);
});

test("race day survives EVERY race weekday and long-run day", () => {
  // 6 of these 49 combinations used to put a VO2 session the day before the goal race.
  //
  // ⚠️ THIS TEST WORKS IN CALENDAR DATES, NOT IN DAY-OF-WEEK INDICES, and that is the whole point.
  // It used to look for the eve at `dayOfWeek === dow - 1` INSIDE THE FINAL WEEK — which is the same
  // assumption applyRaceDay itself was making, so the test could only ever agree with the bug. For a
  // MONDAY race `dow - 1` is -1 and the real eve is the previous week's Sunday, so both the rule and
  // its guard quietly skipped it, and a marathon shipped with a 98-minute long run the day before
  // the race. A guard that shares the implementation's frame of reference is not a guard: flatten to
  // dates and ask the question the runner would ask — "what am I doing the day before my race?"
  const HARD = ["threshold", "vo2", "race-specific", "long", "strength"];
  for (let raceShift = 0; raceShift < 7; raceShift++) {
    for (let longDay = 0; longDay < 7; longDay++) {
      const raceIso = shiftIso(goal.raceDateIso, raceShift);
      const p = generatePlan({ ...athlete, longRunDay: longDay }, { ...goal, raceDateIso: raceIso });
      const where = `(shift ${raceShift}, longDay ${longDay})`;

      // Every session in the plan, keyed by the real date it falls on.
      const byDate = new Map<string, typeof p.weeks[number]["sessions"]>();
      for (const w of p.weeks) {
        for (const s of w.sessions) {
          const iso = shiftIso(w.startDateIso, s.dayOfWeek);
          const list = byDate.get(iso) ?? [];
          list.push(s);
          byDate.set(iso, list);
        }
      }

      const onRaceDay = (byDate.get(raceIso) ?? []).filter((s) => s.type !== "rest");
      assert.equal(onRaceDay.length, 1, `race day should hold exactly the race ${where}`);
      assert.equal(onRaceDay[0]!.type, "race", `race missing on its own date ${where}`);

      // Nothing after the race, anywhere in the plan — not merely nothing later in that week.
      const after = [...byDate.entries()]
        .filter(([iso]) => iso > raceIso)
        .flatMap(([, ss]) => ss)
        .filter((s) => s.type !== "rest");
      assert.equal(after.length, 0, `session after the race ${where}: ${after.map((s) => s.title).join()}`);

      // The day before, wherever it lives — including in the PREVIOUS week for a Monday race.
      const eve = (byDate.get(shiftIso(raceIso, -1)) ?? []).filter((s) => HARD.includes(s.type));
      assert.equal(eve.length, 0,
        `hard session the day before the race ${where}: ${eve.map((s) => s.title).join()}`);
    }
  }
});

/** Shift a yyyy-mm-dd string by whole days without timezone drift. */
function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test("the taper is present with correct length for a half marathon", () => {
  const taperWeeks = plan.weeks.filter((w) => w.phase === "taper");
  assert.equal(taperWeeks.length, 2);
});

test("no two hard sessions land on adjacent days", () => {
  for (const w of plan.weeks) {
    const hardDays = w.sessions
      .filter(isHard)
      .map((s) => s.dayOfWeek)
      .sort((a, b) => a - b);
    for (let i = 1; i < hardDays.length; i++) {
      assert.ok(
        hardDays[i]! - hardDays[i - 1]! >= 2,
        `week ${w.index} has adjacent hard days ${hardDays}`,
      );
    }
  }
});

test("a long base opens with a pure-aerobic foundation, then one quality — never two", () => {
  // The very first week is a foundation week: easy running, no quality yet.
  assert.equal(plan.weeks[0]!.qualitySessionCount, 0);
  // No base week ever carries two quality sessions (the intensity comes in the build).
  for (const w of plan.weeks.filter((w) => w.phase === "base")) {
    assert.ok(w.qualitySessionCount <= 1, `base week ${w.index} has >1 quality`);
  }
  // But quality does appear later in the base.
  assert.ok(plan.weeks.some((w) => w.phase === "base" && w.qualitySessionCount === 1));
});

test("the long run progresses then backs off into the taper", () => {
  const buildPeak = plan.weeks.filter(
    (w) => w.phase === "build" || w.phase === "peak" || w.phase === "base",
  );
  const longestNonTaper = Math.max(...buildPeak.map((w) => longMinutes(w)));
  // The race week has no long run any more — the race is there instead — so the wind-down is
  // measured on the last week that still has one.
  const lastLongWeek = [...plan.weeks].reverse().find((w) => w.sessions.some((s) => s.type === "long"))!;
  assert.ok(longMinutes(lastLongWeek) < longestNonTaper, "the last long run should be reduced vs peak");
  // Peak long run should be materially longer than the first week's.
  assert.ok(longestNonTaper > longMinutes(plan.weeks[0]!) * 1.3);
});

test("weekly intensity distribution stays pyramidal-ish (plenty of easy)", () => {
  // Sample a representative build week.
  const buildWeek = plan.weeks.find((w) => w.phase === "build" && !w.isDeload)!;
  const dist = computeDistribution(buildWeek.sessions);
  assert.ok(dist.easy >= 0.6, `easy fraction ${dist.easy.toFixed(2)} too low`);
  assert.ok(honoursModel(dist, "pyramidal"));
});

test("strength eases from 2×/week to 1× near the race when enabled", () => {
  const strengthCount = (w: PlannedWeek) => w.sessions.filter((s) => s.type === "strength").length;
  const mainWeek = plan.weeks.find((w) => w.phase === "build" && !w.isDeload)!;
  assert.equal(strengthCount(mainWeek), 2);
  const raceWeek = plan.weeks.at(-1)!;
  assert.ok(strengthCount(raceWeek) <= 1, "strength reduced near the race");
});

test("plans without strength omit strength sessions and say so", () => {
  const noStrength = generatePlan({ ...athlete, includeStrength: false }, goal);
  const total = noStrength.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "strength");
  assert.equal(total.length, 0);
  assert.ok(noStrength.notes.some((n) => n.toLowerCase().includes("strength is off")));
});

function longMinutes(w: PlannedWeek): number {
  const long = w.sessions.find((s) => s.type === "long")!;
  return Math.round(long.estimatedDurationSeconds / 60);
}

// ---- volume model ---------------------------------------------------------
// Added 2026-08-01 after an elite coach said weekly mileage "looks a little on the low side".
// The cause was not a wrong number: there was no volume model at all. Athlete.weeklyVolumeKmCurrent
// existed and was read nowhere, so every runner training for a given distance got the same plan.

const peakKm = (p: { weeks: PlannedWeek[] }) =>
  Math.max(...p.weeks.map((w) => w.plannedDistanceMeters)) / 1000;

const runner = (weeklyVolumeKmCurrent?: number): Athlete => ({
  daysPerWeek: 6,
  recent: { distanceMeters: 10000, timeSeconds: 1920 },
  experience: "competitive",
  includeStrength: false,
  returningFromInjury: false,
  ...(weeklyVolumeKmCurrent ? { weeklyVolumeKmCurrent } : {}),
});

test("weekly volume follows the runner's actual mileage", () => {
  const low = generatePlan(runner(40), goal);
  const mid = generatePlan(runner(80), goal);
  const high = generatePlan(runner(120), goal);
  assert.ok(peakKm(low) < peakKm(mid), `40km runner (${peakKm(low).toFixed(0)}) should peak below 80km runner (${peakKm(mid).toFixed(0)})`);
  assert.ok(peakKm(mid) < peakKm(high), `80km runner (${peakKm(mid).toFixed(0)}) should peak below 120km runner (${peakKm(high).toFixed(0)})`);
});

test("the peak week lands near 25% above what the runner already does", () => {
  // The progression rule: build above where they are, but not wildly. Mileage is paired with
  // ability here on purpose — the plan is built in MINUTES, so a fast runner covers far more
  // ground in the same session, and a stated mileage only moves the plan once it exceeds what
  // that runner's sessions already cover (see the "only ever builds up" test below).
  const paced = (days: number, tenKSec: number, experience: Athlete["experience"], weeklyVolumeKmCurrent: number): Athlete => ({
    daysPerWeek: days,
    recent: { distanceMeters: 10000, timeSeconds: tenKSec },
    experience,
    includeStrength: false,
    returningFromInjury: false,
    weeklyVolumeKmCurrent,
  });
  const cases = [
    [5, 3000, "recreational", 55],
    [5, 2400, "recreational", 70],
    [6, 1920, "competitive", 80],
    [6, 1920, "competitive", 100],
  ] as const;
  for (const [days, tenK, experience, stated] of cases) {
    const p = generatePlan(paced(days, tenK, experience, stated), goal);
    const ratio = peakKm(p) / stated;
    assert.ok(ratio > 1.05 && ratio < 1.5,
      `${stated}km/wk at ${tenK / 60}min 10k over ${days} days peaks at ${peakKm(p).toFixed(0)}km — ratio ${ratio.toFixed(2)} outside 1.05–1.5`);
  }
});

test("week one is anchored to the mileage the runner actually stated", () => {
  // ⚠️ THE CENTRAL INVARIANT, and it is a coaching rule before it is a coding one. The evidence
  // spec says it three times: "Never jump an athlete to the bottom of a band", "If current tolerated
  // volume is below the band, start from current load", "Set week one near the athlete's recent
  // baseline. Do not jump to band minimum."
  //
  // The first cut of the volume model could only build UP, so it set a peak destination and left the
  // START where it had always been: a half-marathon runner answering 10, 25 or 40 km/week got a
  // byte-identical plan opening at 35.5 km, and 60% of all non-beginner answers changed nothing at
  // all. Starting BELOW what they stated is fine and safe — the spec's whole concern is the jump
  // upward — so this asserts a ceiling, not a band.
  const week1Km = (p: { weeks: PlannedWeek[] }) => p.weeks[0]!.plannedDistanceMeters / 1000;
  const paced = (days: number, tenKSec: number, experience: Athlete["experience"], vol: number): Athlete => ({
    daysPerWeek: days,
    recent: { distanceMeters: 10000, timeSeconds: tenKSec },
    experience,
    includeStrength: true,
    returningFromInjury: false,
    weeklyVolumeKmCurrent: vol,
  });
  const cases = [
    [5, 3000, "recreational", 25],
    [5, 3000, "recreational", 40],
    [4, 2700, "recreational", 30],
    [5, 2400, "recreational", 55],
    [6, 1920, "competitive", 80],
  ] as const;
  for (const [days, tenK, experience, stated] of cases) {
    const w1 = week1Km(generatePlan(paced(days, tenK, experience, stated), goal));
    assert.ok(w1 <= stated * 1.10,
      `${stated}km/wk over ${days} days opens at ${w1.toFixed(1)}km — ${(w1 / stated).toFixed(2)}x stated, above the 1.10 guardrail`);
  }
});

test("the stated mileage actually changes the plan, in both directions", () => {
  // The failure this guards is silence: a question that is asked, stored, and then ignored. Before
  // week-one anchoring, every stated value at or below the plan's natural size produced the same
  // bytes as leaving the box empty.
  const blank = JSON.stringify(generatePlan(runner(undefined), goal).weeks);
  for (const stated of [25, 45, 120]) {
    assert.notEqual(JSON.stringify(generatePlan(runner(stated), goal).weeks), blank,
      `stating ${stated}km/wk produced the same plan as saying nothing`);
  }
  assert.ok(peakKm(generatePlan(runner(30), goal)) < peakKm(generatePlan(runner(90), goal)),
    "a 30km/wk runner should not peak at or above a 90km/wk runner");
});

test("saying you run MORE never hands you a smaller plan", () => {
  // ⚠️ MONOTONICITY. The intensity back-off used to take one coarse step toward 1
  // (`scale + (1 - scale) / 2`), which overshot the entire safe interval — for one measured runner
  // the smallest safe scale was 0.481 and the step landed on 0.730. Which side of that jump you
  // landed on was not monotone in the stated mileage, so answering 30 km/week produced a plan 32%
  // smaller than answering 29, and on the form's own 5 km spinner one click UP shrank the first week
  // by more than 10% in 20 of 96 configurations. A runner cannot trust a question that punishes them
  // for a bigger honest answer.
  // The bar is a CLIFF, not perfect monotonicity: plans are built in whole minutes and the scale
  // search is discrete, so ±2% wobble between adjacent answers is inherent (the unscaled engine has
  // it too, at 1%). Measured across 256 configurations x 60 stated values — proper bisection: worst
  // drop 2%. The single coarse step it replaced: worst drop 19%.
  const cases = [
    // ⚠️ THE FIRST TWO ROWS WERE CHOSEN BY SEARCH, not by taste. Restoring the coarse single step
    // makes them fail (week one drops 17% between stating 21 and 22 km/week, and 13% between 26 and
    // 27) while the shipped bisection holds them at 0%. My first three hand-picked rows all passed
    // under the broken version — a test written from intuition about where a bug "should" show up
    // guards nothing. Slower runners on four days are the ones this bit, because they are where the
    // intensity check actually binds.
    ["5k", 4, 2100, "competitive", 4, 1200],
    ["half", 4, 2100, "competitive", 5, 5400],
    ["half", 5, 1500, "recreational", 6, 6300],
    ["marathon", 4, 1800, "recreational", 6, 14400],
  ] as const;
  for (const [distance, days, fiveK, experience, longRunDay, target] of cases) {
    const week1 = (v: number) => generatePlan(
      { daysPerWeek: days, recent: { distanceMeters: 5000, timeSeconds: fiveK }, experience,
        includeStrength: true, returningFromInjury: false, longRunDay, weeklyVolumeKmCurrent: v },
      { ...goal, distance, targetTimeSeconds: target },
    ).weeks[0]!.plannedDistanceMeters / 1000;
    let prev = week1(12);
    for (let v = 13; v <= 70; v++) {
      const cur = week1(v);
      assert.ok(cur >= prev * 0.97,
        `${distance} ${days}d/${fiveK}s: stating ${v}km/wk gives a first week ${(100 * (1 - cur / prev)).toFixed(0)}% ` +
        `SMALLER than stating ${v - 1}km/wk (${prev.toFixed(1)} -> ${cur.toFixed(1)}km)`);
      prev = cur;
    }
  }
});

test("a smaller stated mileage never shortens the long run", () => {
  // ⚠️ vScale reaches only the long run and the easy runs; easy runs stop at 20 minutes and quality
  // never moves, so once it was allowed to cut the long run EVERY further unit of shrink came out of
  // that one session. Measured: a marathon runner stating 30 km/week was given a longest run of
  // 10.3 km against 22.6 km unstated, and a half-marathoner 8.8 km for a 21.1 km race — shorter than
  // the midweek workout beside it. The long run answers the RACE, not the week, so it grows with a
  // bigger mileage and is never cut by a smaller one. The intensity guard cannot see this: a shorter
  // long run removes easy minutes proportionally, so the ratio stays healthy while the plan rots.
  const longestKm = (v?: number) => Math.max(...generatePlan(runner(v), goal).weeks
    .flatMap((w) => w.sessions.filter((s) => s.type === "long")
      .map((s) => (s.estimatedDistanceMeters ?? 0) / 1000)));
  const natural = longestKm(undefined);
  for (const stated of [5, 10, 15, 20, 25, 30, 40, 60]) {
    assert.ok(longestKm(stated) >= natural - 0.05,
      `stating ${stated}km/wk cut the longest run from ${natural.toFixed(1)} to ${longestKm(stated).toFixed(1)}km`);
  }
  assert.ok(longestKm(140) > natural, "a much bigger mileage should still lengthen the long run");
});

test("a half-marathon block builds past the race distance — and the clock still wins", () => {
  // ⚠️ The plan is built in MINUTES, so before the distance floor everyone got the same 110-minute
  // long run and it covered whatever their pace covered: 22.4 km for a 1:25 runner, 12.8 km for a
  // 2:30 one — 61% of the race they were about to attempt. The evidence report's half-marathon row
  // is "Moderate; >21 km associated with faster performance" (Fokkema 2020, n=997), so exceeding the
  // race distance is the supported target for a HALF. It is not universal: that same table stops the
  // marathon at 28–35 km and a half beginner at 12–18 km, both under their race distance.
  const halfRunner = (fiveKSec: number, experience: Athlete["experience"]): Athlete => ({
    daysPerWeek: 5,
    recent: { distanceMeters: 5000, timeSeconds: fiveKSec },
    experience,
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
  });
  const longest = (a: Athlete) => {
    const longs = generatePlan(a, { ...goal, distance: "half", targetTimeSeconds: 6600 }).weeks
      .flatMap((w) => w.sessions.filter((s) => s.type === "long"));
    return {
      km: Math.max(...longs.map((s) => (s.estimatedDistanceMeters ?? 0) / 1000)),
      min: Math.max(...longs.map((s) => s.estimatedDurationSeconds / 60)),
    };
  };
  // Anyone who can cover it inside the time ceiling should be taken past 21.1 km.
  for (const fiveK of [1080, 1200, 1400, 1500]) {
    const { km } = longest(halfRunner(fiveK, "recreational"));
    assert.ok(km > 21.1, `a ${fiveK}s 5 km runner peaks at ${km.toFixed(1)}km — short of the race distance`);
  }
  // ⚠️ And the ceiling is what stops that becoming absurd. Reaching 21.1 km takes a 2:30 half runner
  // 182 minutes; they get as far as 145 minutes carries them and no further. Time on feet is the
  // injury currency — a three-hour long run before a HALF is a worse error than a short one.
  for (const fiveK of [1900, 2100, 2400]) {
    const { km, min } = longest(halfRunner(fiveK, "recreational"));
    assert.ok(min <= 145 + 0.5, `a ${fiveK}s 5 km runner is sent out for ${min.toFixed(0)} minutes`);
    assert.ok(km > 15, `a ${fiveK}s 5 km runner peaks at only ${km.toFixed(1)}km`);
  }
});

test("a marathon block stops well short of the race distance, at every ability", () => {
  // ⚠️ THE OPPOSITE RULE TO THE HALF, and deliberately so. The evidence report's marathon row is
  // 24–32 km (Intermediate) / 28–35 km (Advanced) for a 42.2 km race, noting ">35 km benefit
  // uncertain in recreational cohort". Nobody runs the race distance in training for a marathon.
  //
  // A minutes-based cap gets this wrong at BOTH ends. Slow runners were topping out at 19.3 km —
  // under the "<25 km associated with slower performance" threshold — while a 2:30 marathoner on high
  // mileage rode the three-hour cap to a **44.4 km** long run, longer than the race itself. Three
  // hours is a sane amount of time; at 4:00/km it is an insane distance.
  const marathoner = (fiveKSec: number, experience: Athlete["experience"], vol?: number): Athlete => ({
    daysPerWeek: 5,
    recent: { distanceMeters: 5000, timeSeconds: fiveKSec },
    experience,
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
    ...(vol ? { weeklyVolumeKmCurrent: vol } : {}),
  });
  const longestKm = (a: Athlete) => Math.max(...generatePlan(a,
    { ...goal, distance: "marathon", targetTimeSeconds: 14400 }).weeks
    .flatMap((w) => w.sessions.filter((s) => s.type === "long")
      .map((s) => (s.estimatedDistanceMeters ?? 0) / 1000)));

  // Nobody, however fast or however high their mileage, is sent past the Advanced band.
  for (const fiveK of [840, 900, 1080, 1260]) {
    for (const vol of [undefined, 120, 250]) {
      const km = longestKm(marathoner(fiveK, "competitive", vol));
      assert.ok(km <= 36, `a ${fiveK}s 5 km runner on ${vol ?? "unstated"} km/wk peaks at ${km.toFixed(1)}km`);
      assert.ok(km < 42.2, `longest run ${km.toFixed(1)}km is at or beyond the race distance`);
    }
  }
  // And nobody, however slow, is left under the threshold the report ties to a slower marathon.
  for (const fiveK of [1700, 1900, 2100]) {
    const km = longestKm(marathoner(fiveK, "recreational"));
    assert.ok(km >= 25, `a ${fiveK}s 5 km runner peaks at only ${km.toFixed(1)}km`);
  }
});

test("scaling down never buys volume with intensity", () => {
  // ⚠️ WHY THE SCALE-DOWN IS SAFE AT ALL. Quality sessions come from the library at a fixed length,
  // so shrinking a plan shrinks only the easy running around them and the hard fraction climbs by
  // arithmetic. That is what made an earlier attempt put 175 of 23040 weeks under the easy floor,
  // and why the model refused to scale down at all for a day. Two things fix it: fewer key days in a
  // smaller week, and generatePlan checking the result rather than assuming it. The check is what
  // makes this hold even if the session library changes underneath it.
  for (const stated of [10, 15, 20, 25, 30, 40]) {
    const scaled = generatePlan(runner(stated), goal);
    const natural = generatePlan(runner(undefined), goal);
    const worstOf = (p: typeof scaled) => Math.min(...p.weeks
      .filter((w) => !w.sessions.some((s) => s.type === "race"))
      .map((w) => computeDistribution(w.sessions))
      .filter((d) => d.totalSeconds > 0)
      .map((d) => d.easy));
    assert.ok(worstOf(scaled) >= Math.min(0.68, worstOf(natural)) - 0.005,
      `stating ${stated}km/wk drove a week to ${(worstOf(scaled) * 100).toFixed(1)}% easy ` +
      `(unscaled worst ${(worstOf(natural) * 100).toFixed(1)}%)`);
  }
});

test("a runner who does not state their mileage gets the plan unchanged", () => {
  // The volume model must be strictly opt-in: blank means "not sure", not "zero".
  const stated = generatePlan(runner(undefined), goal);
  const zero = generatePlan({ ...runner(undefined), weeklyVolumeKmCurrent: 0 }, goal);
  assert.equal(peakKm(stated).toFixed(2), peakKm(zero).toFixed(2), "0 and undefined must mean the same");
});

test("absurd mileage cannot produce an absurd plan", () => {
  // A mistyped 500 must not yield four-hour long runs; a mistyped 3 must not yield jogging.
  const silly = generatePlan(runner(500), goal);
  const longestMin = Math.max(...silly.weeks.flatMap((w) =>
    w.sessions.filter((s) => s.type === "long").map((s) => s.estimatedDurationSeconds / 60)));
  assert.ok(longestMin <= 150, `long run ${longestMin.toFixed(0)} min exceeds the half-marathon ceiling`);
  const tiny = generatePlan(runner(3), goal);
  const shortestEasy = Math.min(...tiny.weeks.flatMap((w) =>
    w.sessions.filter((s) => s.type === "easy").map((s) => s.estimatedDurationSeconds / 60)));
  assert.ok(shortestEasy >= 20, `easy run ${shortestEasy.toFixed(0)} min is below the floor`);
});
