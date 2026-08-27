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

test("every event tapers for the days the evidence asks, on every race weekday", () => {
  // ⚠️ MEASURED IN CALENDAR DAYS BEFORE THE RACE, not in weeks — the same lesson as the race-eve
  // test. Taper weeks are Monday-aligned and the last one IS race week, so "weeks: 1" is not seven
  // days: it is 0–6 depending on the weekday, zero for a Monday race. The 5K and 10K shipped that
  // way for months while this suite said the taper was fine, because no test ever asked the
  // runner's question: "how many days before my race does the plan ease off?" The evidence window
  // is 7–14 days for 5K/10K/half and 14–21 for the marathon.
  const WINDOW: Record<string, [number, number]> = {
    "5k": [7, 14], "10k": [7, 14], half: [7, 14], marathon: [14, 21],
  };
  const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (let rs = 0; rs < 7; rs++) {
      const raceIso = shiftIso("2027-03-01", rs); // 2027-03-01 is a Monday
      const p = generatePlan({ ...athlete, returningFromInjury: false },
        { distance, raceDateIso: raceIso, targetTimeSeconds: TT[distance]!, startDateIso: "2026-08-03" });
      const firstTaper = p.weeks.find((w) => w.phase === "taper")!;
      const days = Math.round((Date.parse(raceIso) - Date.parse(firstTaper.startDateIso)) / 86_400_000);
      const [lo, hi] = WINDOW[distance]!;
      assert.ok(days >= lo && days <= hi,
        `${distance} racing ${raceIso}: ${days} days of taper, outside ${lo}–${hi}`);
      // Intensity is retained: every taper week still carries quality (race week carries the race).
      for (const w of p.weeks.filter((x) => x.phase === "taper")) {
        assert.ok(w.sessions.some((s) => ["threshold", "vo2", "race-specific", "race"].includes(s.type)),
          `${distance} racing ${raceIso}: taper week ${w.index} lost its intensity`);
      }
    }
  }
});

test("the taper genuinely cuts the week, not just the long run", () => {
  // ⚠️ volumeMultiplierByWeek used to reach ONLY longRunMinutes. The easy runs kept their full
  // length, and because the taper drops the second quality session, the backfilled easy day made
  // easy volume RISE into the taper — the 10K's last full week measured within 1% of peak, and the
  // delivered cut was 18–39% against the evidence's 41–60%. The multiplier now reaches the easy
  // runs, so the last full taper week must sit well under peak.
  const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    const p = generatePlan({ ...athlete, returningFromInjury: false },
      { distance, raceDateIso: "2027-03-07", targetTimeSeconds: TT[distance]!, startDateIso: "2026-08-03" });
    const peakKm2 = Math.max(...p.weeks
      .filter((w) => !w.sessions.some((s) => s.type === "race"))
      .map((w) => w.plannedDistanceMeters)) / 1000;
    const taperWeeks = p.weeks.filter((w) => w.phase === "taper");
    const lastFull = taperWeeks.length > 1 ? taperWeeks[taperWeeks.length - 2]! : taperWeeks[0]!;
    const cut = 1 - lastFull.plannedDistanceMeters / 1000 / peakKm2;
    assert.ok(cut >= 0.30,
      `${distance}: last full taper week only ${(cut * 100).toFixed(0)}% below peak — barely a taper`);
    assert.ok(cut <= 0.60, `${distance}: taper cut ${(cut * 100).toFixed(0)}% — past the evidence window`);
  }
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
  const longest = (v?: number) => {
    const longs = generatePlan(runner(v), goal).weeks
      .flatMap((w) => w.sessions.filter((s) => s.type === "long"));
    return {
      km: Math.max(...longs.map((s) => (s.estimatedDistanceMeters ?? 0) / 1000)),
      min: Math.max(...longs.map((s) => s.estimatedDurationSeconds / 60)),
    };
  };
  const natural = longest(undefined);
  for (const stated of [5, 10, 15, 20, 25, 30, 40, 60]) {
    const got = longest(stated);
    // ⚠️ MINUTES are the hard invariant — peakLong's Math.max(1, vScale) enforces it structurally.
    // Distance gets a small tolerance, NOT because the rule is soft but because a down-scaled
    // plan's long run carries smaller work doses (the caps scale with the plan), and swapping a
    // few race-pace minutes back to easy pace covers ~200m less ground in the same time. That
    // composition wobble is not the 10.3km collapse this test exists to prevent.
    assert.ok(got.min >= natural.min - 0.5,
      `stating ${stated}km/wk cut the longest run from ${natural.min.toFixed(0)} to ${got.min.toFixed(0)} minutes`);
    assert.ok(got.km >= natural.km - Math.max(0.05, natural.km * 0.02),
      `stating ${stated}km/wk cut the longest run from ${natural.km.toFixed(1)} to ${got.km.toFixed(1)}km`);
  }
  assert.ok(longest(140).km > natural.km, "a much bigger mileage should still lengthen the long run");
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

test("a beginner's long run knows what race they entered", () => {
  // ⚠️ IT DID NOT. `buildBeginnerWeek` was handed `longMin: 0` and never read `goal.distance`, so the
  // long run came off one hardcoded ramp and topped out at 46 minutes for every goal there is. A
  // "building the habit" runner on a 28-week HALF MARATHON plan progressed 2.9 km → 4.4 km and was
  // then sent to run 21.1 km — a 5.0x jump against the report's 1.10 single-session guardrail — and
  // the ladder was byte-identical whether the goal was a 5 km or a marathon.
  const beginner = (distance: Goal["distance"], runWalk: boolean): Athlete => ({
    daysPerWeek: 4,
    recent: { distanceMeters: 5000, timeSeconds: 2250 },
    experience: "beginner",
    runWalk,
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
  });
  const target: Record<string, number> = { "5k": 3300, "10k": 3300, half: 9900, marathon: 21600 };
  const ladder = (distance: Goal["distance"], runWalk: boolean) =>
    generatePlan(beginner(distance, runWalk), { ...goal, distance, targetTimeSeconds: target[distance]! })
      .weeks
      .filter((w) => !w.sessions.some((s) => s.type === "race"))
      .map((w) => Math.max(0, ...w.sessions.map((s) => (s.estimatedDistanceMeters ?? 0) / 1000)))
      .filter((km) => km > 0);

  // The whole defect in one assertion: the goal has to change the longest run.
  const longest = (d: Goal["distance"]) => Math.max(...ladder(d, false));
  assert.ok(longest("5k") < longest("10k"), "a 10 km beginner should out-run a 5 km beginner");
  assert.ok(longest("10k") < longest("half"), "a half beginner should out-run a 10 km beginner");

  // A beginner half reaches the report's own Beginner band (12–18 km). It stays UNDER the race
  // distance on purpose — that band is deliberately short of 21.1 km, unlike the recreational one.
  assert.ok(longest("half") >= 12, `beginner half peaks at ${longest("half").toFixed(1)}km, under the 12–18 km band`);
  assert.ok(longest("half") < 21.1, "a beginner should not be rehearsing the whole half marathon");

  // ⚠️ AND THE RAMP MUST STAY GENTLE — this is the half the fix could easily have broken. Ramping
  // linearly to the new endpoint front-loaded the growth and put a 17% jump at week 5 (3.5 → 4.1 km);
  // the ramp is geometric so every step is the same small percentage. Compared against the running
  // maximum, so a deload dip and its rebound are not counted as a spike.
  // 5 km / 10 km / half only: "building the habit" is not offered a marathon.
  for (const distance of ["5k", "10k", "half"] as const) {
    const rungs = ladder(distance, false);
    let prevMax = 0;
    for (const [i, km] of rungs.entries()) {
      if (prevMax > 0) {
        assert.ok(km <= prevMax * 1.105,
          `${distance} beginner week ${i + 1}: ${prevMax.toFixed(1)} → ${km.toFixed(1)}km is a ` +
          `${(100 * (km / prevMax - 1)).toFixed(0)}% jump, past the 10% single-session guardrail`);
      }
      prevMax = Math.max(prevMax, km);
    }
  }

  // ⚠️ The run–walk track has to move with the goal too — it was stuck at 2.9 km for everything. Only
  // 5 km and 10 km are compared, because those are the only goals it can HAVE: `GOAL_BY_STATUS` in
  // web/app.ts offers "just getting started" (the run-walk status) 5 km and 10 km only, on the
  // deliberate product rule that you finish one of those before entering a half. An earlier version
  // of this test compared 5 km against a half and was asserting on a combination no user can reach.
  const rwLongest = (d: Goal["distance"]) => Math.max(...ladder(d, true));
  assert.ok(rwLongest("10k") > rwLongest("5k") * 1.15,
    `run-walk ladder barely moves with the goal: 5k ${rwLongest("5k").toFixed(1)}km vs 10k ${rwLongest("10k").toFixed(1)}km`);
});

test("the taper survives a high stated mileage", () => {
  // ⚠️ THE 95-MINUTE EASY CAP SWALLOWED THE TAPER. Multiplying before the clamp meant that once
  // baseMin x vScale sat above 95, the taper multiplier still landed above 95 and the clamp erased
  // it: a 120 km/week marathoner's first taper week was byte-identical to peak week (three 95-minute
  // easy runs), and the taper the evidence asks for was delivered to unstated-volume runners and
  // silently withheld from exactly the high-mileage runners the volume model was built for. Also the
  // same trap CLAUDE.md records twice already: every taper test used the fixture athlete with no
  // stated volume, so the suite stayed green — a sweep blind to a new axis is not a guard.
  const big: Athlete = {
    daysPerWeek: 6,
    recent: { distanceMeters: 5000, timeSeconds: 1050 },
    experience: "competitive",
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
    weeklyVolumeKmCurrent: 120,
  };
  const p = generatePlan(big, { ...goal, distance: "marathon", targetTimeSeconds: 9900, raceDateIso: "2027-03-07" });
  const maxEasy = (w: PlannedWeek) => Math.max(0, ...w.sessions
    .filter((s) => s.type === "easy" || s.type === "recovery")
    .map((s) => s.estimatedDurationSeconds / 60));
  const taperIdx = p.weeks.findIndex((w) => w.phase === "taper");
  const peakWeek = p.weeks.slice(0, taperIdx)
    .reduce((a, b) => (b.plannedDistanceMeters > a.plannedDistanceMeters ? b : a));
  const firstTaper = p.weeks[taperIdx]!;
  assert.ok(maxEasy(firstTaper) < maxEasy(peakWeek) - 1,
    `first taper week's easy runs (${maxEasy(firstTaper).toFixed(0)}min) did not shrink from peak (${maxEasy(peakWeek).toFixed(0)}min)`);
  // And the last full taper week delivers a real cut. The bound is lower than the unstated-volume
  // test's 30% on purpose: quality sessions do not scale with volume, so at high mileage they are a
  // larger untapered share and the deliverable cut for a 0.65-multiplier week is smaller.
  const taperWeeks = p.weeks.filter((w) => w.phase === "taper");
  const lastFull = taperWeeks[taperWeeks.length - 2]!;
  const cut = 1 - lastFull.plannedDistanceMeters / peakWeek.plannedDistanceMeters;
  assert.ok(cut >= 0.20,
    `high-mileage last full taper week only ${(cut * 100).toFixed(0)}% below peak`);
});

test("a clamped one-week taper still gives race week the race-week depth", () => {
  // ⚠️ THE LAST MULTIPLIER BELONGS TO RACE WEEK, WHATEVER GOT CLAMPED. A 4-week runway clamps the
  // taper to one week (periodization: structuredWeeks - 3) and that week IS race week — but
  // start-aligned indexing handed it mult[0], the gentle 0.72 lead-in, instead of the race-week
  // 0.55. Measured: a runner entering a 10 km four weeks out got a race-week long run 20% LONGER
  // than before the taper fix existed. Constant-free assertion: the race-week long run must be the
  // SAME whether the taper was clamped to one week or given its full two, because both are
  // peakLong x the race-week multiplier.
  const runnerA: Athlete = {
    daysPerWeek: 5,
    recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational",
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 2, // mid-week long run so it survives race-day placement on a Sunday race
  };
  const longMin = (raceIso: string) => {
    const p = generatePlan(runnerA,
      { distance: "10k", raceDateIso: raceIso, targetTimeSeconds: 3000, startDateIso: "2026-08-03" });
    const raceWeek = p.weeks[p.weeks.length - 1]!;
    const long = raceWeek.sessions.find((s) => s.type === "long");
    return long ? Math.round(long.estimatedDurationSeconds / 60) : null;
  };
  const clamped = longMin("2026-08-30"); // 4-week runway -> 1 taper week
  const full = longMin("2026-10-04");    // 9-week runway -> full 2-week taper
  assert.ok(clamped !== null && full !== null, "race-week long run missing from a probe plan");
  assert.ok(Math.abs(clamped! - full!) <= 1,
    `clamped race week runs a ${clamped}min long run; a full taper's race week runs ${full}min — the clamp changed the race-week depth`);
});

test("the long run reads like a session — real doses, in the right phases only", () => {
  // Elite-coach feedback: "how long do you run easy for, then how long do you steady for, over the
  // course of 32km?" Before this the structure was token — a 20-minute steady finish in build, a
  // capped 30-minute block in peak, identical every week — and a 5K plan's PEAK long run carried up
  // to 25 minutes AT 5K PACE inside an easy run, which nobody can run as prescribed.
  const runnerFor = (distance: Goal["distance"]): Athlete => ({
    daysPerWeek: 5,
    recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational",
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
  });
  const target: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
  const planFor = (distance: Goal["distance"]) => generatePlan(runnerFor(distance),
    { distance, raceDateIso: "2027-04-04", targetTimeSeconds: target[distance]!, startDateIso: "2026-08-03" });

  const marathonPlan = planFor("marathon");
  const longOf = (w: PlannedWeek) => w.sessions.find((s) => s.type === "long");

  // 1. Peak long runs carry a REAL race-pace dose: at least 20% of the run not at easy pace.
  const peakWeeks = marathonPlan.weeks.filter((w) => w.phase === "peak" && !w.isDeload);
  assert.ok(peakWeeks.length >= 2, "need peak weeks to judge");
  for (const w of peakWeeks) {
    const L = longOf(w)!;
    const total = L.steps.reduce((m, st) => m + (st.durationSeconds ?? 0), 0);
    const work = L.steps
      .filter((st) => (st.targetRpe?.min ?? 0) >= 4)
      .reduce((m, st) => m + (st.durationSeconds ?? 0), 0);
    assert.ok(work >= total * 0.2,
      `peak week ${w.index} long run "${L.title}" carries only ${Math.round(work / 60)}min of work in ${Math.round(total / 60)}`);
  }

  // 2. Base, deload and taper long runs stay PLAIN — structure on an eased week defeats the ease.
  for (const w of marathonPlan.weeks) {
    if (!(w.phase === "base" || w.phase === "taper" || w.isDeload)) continue;
    const L = longOf(w);
    if (!L) continue;
    const hot = L.steps.filter((st) => (st.targetRpe?.min ?? 0) >= 4);
    assert.equal(hot.length, 0,
      `${w.phase}${w.isDeload ? " deload" : ""} week ${w.index} long run has work blocks: ${hot.map((s) => s.label).join()}`);
  }

  // 3. Variety: the build+peak long runs are not one shape stamped out weekly.
  const titles = new Set(marathonPlan.weeks
    .filter((w) => (w.phase === "build" || w.phase === "peak") && !w.isDeload)
    .map((w) => longOf(w)?.title.replace(/^\d+′ /, "") ?? ""));
  assert.ok(titles.size >= 3, `only ${titles.size} long-run shapes across build+peak: ${[...titles].join(" | ")}`);

  // 4. Every dose is governed — the review found the progressive was the ONLY ungoverned format:
  //    a 3-day/week 4-hour marathoner drew 57 minutes at race pace after 79 aerobic, double what
  //    the same plan allowed its fast-finish sibling. No single work step may exceed 45 minutes,
  //    and at 4 days or fewer, 30.
  const threeDay = generatePlan({ ...runnerFor("marathon"), daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 2400 } },
    { distance: "marathon", raceDateIso: "2026-10-25", targetTimeSeconds: 23040, startDateIso: "2026-08-03" });
  for (const p of [marathonPlan, threeDay]) {
    const few = p === threeDay;
    for (const w of p.weeks) {
      const L = longOf(w);
      if (!L) continue;
      for (const st of L.steps) {
        const rpeMin = st.targetRpe?.min ?? 0;
        if (rpeMin < 4) continue;
        const mins = (st.durationSeconds ?? 0) / 60;
        assert.ok(mins <= (few ? 30.5 : 45.5),
          `week ${w.index} long run "${L.title}" holds a ${Math.round(mins)}min work step at ${few ? 3 : 5} days/week`);
      }
    }
  }

  // 5. The session's intended-effort band spans its hardest step, or the debrief calls a perfect
  //    execution overcooked and two of those raise a false ease-off flag.
  for (const w of marathonPlan.weeks) {
    const L = longOf(w);
    if (!L) continue;
    const stepMax = Math.max(...L.steps.map((st) => st.targetRpe?.max ?? 0));
    assert.ok((L.targetRpe?.max ?? 0) >= stepMax,
      `week ${w.index} "${L.title}": session band tops at ${L.targetRpe?.max} but a step reaches ${stepMax}`);
  }

  // 6. 5K and 10K long runs never carry goal-race pace — the long run is aerobic support there,
  //    and race pace lives in the interval sessions.
  for (const distance of ["5k", "10k"] as const) {
    const p = planFor(distance);
    const paces = p.paces;
    for (const w of p.weeks) {
      const L = longOf(w);
      if (!L) continue;
      for (const st of L.steps) {
        if (!st.targetPaceSecPerKm) continue;
        assert.ok(st.targetPaceSecPerKm.minSecPerKm >= paces.goalRace.minSecPerKm + 5 ||
                  (st.durationSeconds ?? 0) < 300,
          `${distance} week ${w.index} long run holds ${Math.round((st.durationSeconds ?? 0) / 60)}min near goal-race pace: "${st.label}"`);
      }
    }
  }
});

test("a plan that cannot reach the stated mileage says so, and says WHY", () => {
  // ⚠️ Silently under-delivering is the worst of both worlds: the runner believes the plan reflects
  // their answer, and the honest explanation never reaches them. Two causes, two DIFFERENT answers,
  // and conflating them gives bad advice — a naive "you need doubles" note fired on 247 of 560
  // plans under 105 km/week, most of them three- and four-day weeks where the right advice is the
  // opposite: run more DAYS before running twice in one.
  const big = (daysPerWeek: number, vol: number): Athlete => ({
    daysPerWeek,
    recent: { distanceMeters: 5000, timeSeconds: 1020 },
    experience: "competitive",
    includeStrength: false,
    returningFromInjury: false,
    longRunDay: 6,
    weeklyVolumeKmCurrent: vol,
  });
  const notesFor = (a: Athlete) => generatePlan(a,
    { distance: "marathon", raceDateIso: "2027-04-04", targetTimeSeconds: 9000, startDateIso: "2026-08-03" }).notes;
  const doubles = (ns: string[]) => ns.some((n) => /second run in the day/.test(n));
  const addDay = (ns: string[]) => ns.some((n) => /Adding a day/.test(n));

  // At the six-day ceiling with a mileage the plan cannot fit: the doubles explanation.
  const saturated = notesFor(big(6, 160));
  assert.ok(doubles(saturated), "a 160km/wk six-day runner must be told why the plan stops short");
  assert.ok(!addDay(saturated), "telling someone already on six days to add a day is nonsense");
  // ⚠️ And it must say doubles are a COACHED decision — the evidence report reserves them for
  // "verified high-performance athletes with extensive history and professional oversight" and
  // forbids unlocking them from self-selection, so the app explains rather than schedules.
  assert.ok(saturated.some((n) => /coached decision/.test(n)));

  // Below the ceiling on few days: the honest answer is more days, never doubles.
  const fewDays = notesFor(big(3, 90));
  assert.ok(addDay(fewDays), "a three-day runner asking for 90km/wk should be pointed at frequency");
  assert.ok(!doubles(fewDays), "a three-day runner must never be told to run twice in a day");

  // A plan that CAN deliver says nothing — the note is an explanation, not decoration.
  assert.equal(notesFor(big(6, 60)).filter((n) => doubles([n]) || addDay([n])).length, 0,
    "a plan that reaches its target must not apologise for anything");
});

test("asking for seven days gets seven days — and the seventh is a recovery jog", () => {
  // ⚠️ THE FORM OFFERS 3–7 AND THE GENERATOR BUILT 6. A runner who chose seven got six and was
  // never told, while assessFeasibility's daysFactor DID count the seventh (0.8 + 0.06 × (days − 3)
  // = 0.98 at six, 1.04 at seven) — so the goal projection was ~6% more optimistic on the strength
  // of a day the plan never gave them. Promising on a day you do not deliver is the worst of both.
  const RUN = ["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific"];
  const runnerOn = (daysPerWeek: number): Athlete => ({
    daysPerWeek,
    recent: { distanceMeters: 5000, timeSeconds: 1020 },
    experience: "competitive",
    includeStrength: true,
    returningFromInjury: false,
    longRunDay: 6,
  });
  const buildWeekOf = (daysPerWeek: number) => {
    const p = generatePlan(runnerOn(daysPerWeek),
      { distance: "marathon", raceDateIso: "2027-04-04", targetTimeSeconds: 9000, startDateIso: "2026-08-03" });
    return p.weeks.find((w) => w.phase === "build" && !w.isDeload)!;
  };
  for (const days of [4, 5, 6, 7]) {
    const runs = buildWeekOf(days).sessions.filter((s) => RUN.includes(s.type));
    assert.equal(runs.length, days, `asked for ${days} running days, got ${runs.length}`);
  }
  // ⚠️ The seventh is a RECOVERY jog, not a fourth 45-minute easy run: seven days means no rest day,
  // and the extra session exists for circulation on tired legs, not more aerobic volume.
  const seven = buildWeekOf(7).sessions.filter((s) => RUN.includes(s.type));
  const rec = seven.filter((s) => s.type === "recovery");
  assert.equal(rec.length, 1, "a seven-day week must carry exactly one recovery jog");
  assert.ok(rec[0]!.estimatedDurationSeconds / 60 <= 35,
    `the recovery jog is ${Math.round(rec[0]!.estimatedDurationSeconds / 60)}min — that is another easy run`);
  // A seven-day week is genuinely bigger than a six-day one, which is the whole point.
  //
  // ⚠️ MEASURED IN TRAINING MINUTES, NOT KILOMETRES, AND THAT IS A STRENGTHENING RATHER THAN A
  // RELAXATION. This assertion read `plannedDistanceMeters` and passed on a 0.7 km margin — 1% — in
  // a quantity dominated by which quality format the rotation happened to draw, and a format's cost
  // in ground covered carries no information about its training load: "4 x 10' tempo" is 16.0 km and
  // "Descending fartlek: 5-4-3-2-1'" is 11.4 km, and the seventh day only adds a 27-minute recovery
  // jog, so one swing of that slot is larger than the thing being measured. Swept over 32
  // configurations (4 distances x 4 abilities x 2 experience levels) the claim is true in
  // **28 of 32 in kilometres, worst ratio 0.967**, and **32 of 32 in minutes, worst ratio 1.000** —
  // so it was never reliably true in km and this fixture simply picked one of the 28.
  //
  // Minutes are also the currency the plan is BUILT in: `PEAK_LONG_MIN`, `LONG_CEILING_MIN`,
  // `easyCapMin` and `longRunMinutes` are all minutes, and kilometres are a display unit derived
  // from them by the runner's own pace. Asserting in km measures the pace as much as the plan.
  const loadMin = (d: number) => {
    const w = buildWeekOf(d);
    let sec = 0;
    for (const s of w.sessions) {
      if (!RUN.includes(s.type)) continue;
      const steps = s.steps ?? [];
      if (!steps.length) { sec += s.estimatedDurationSeconds; continue; }
      for (const st of steps) {
        if (st.durationSeconds) { sec += st.durationSeconds; continue; }
        if (st.distanceMeters && st.targetPaceSecPerKm) {
          const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
          sec += (st.distanceMeters / 1000) * mid; continue;
        }
        if (st.distanceMeters) sec += st.distanceMeters / 4;   // effort-only, the engine's own figure
      }
    }
    return sec / 60;
  };
  // ⚠️ AND SWEPT ACROSS ABILITIES RATHER THAN ASSERTED ON ONE RUNNER, because the answer depends on
  // whether the runner is already at the engine's per-session ceilings. Measured on this fixture's
  // own settings, the seventh day's contribution to training time is:
  //
  //     5k 17:00   -0.27 min      5k 20:00   +1.56 min      5k 30:00   +17.90 min
  //     5k 18:00   +0.49 min      5k 25:00   +4.59 min
  //
  // A 17:00 runner's week is saturated — `LONG_CEILING_MIN` and the 95-minute easy cap are both
  // binding — so a seventh day REDISTRIBUTES the same total across one more run rather than adding
  // to it, and one swing of the quality rotation (16.0 km for "4 x 10' tempo" against 11.4 km for a
  // descending fartlek) is larger than the 27-minute recovery jog the day contributes. That is
  // correct behaviour: the ceilings exist so that asking for more days cannot push a runner past
  // what a single session should be. What the engine guarantees is therefore MORE RUNS and no
  // MATERIALLY less training time, and those are what this asserts.
  const runsOf = (d: number) => buildWeekOf(d).sessions.filter((s) => RUN.includes(s.type)).length;
  assert.ok(runsOf(7) > runsOf(6), `seven days must carry more RUNS than six — got ${runsOf(7)} vs ${runsOf(6)}`);
  assert.ok(loadMin(7) >= loadMin(6) * 0.99,
    `seven days must not carry materially less training time than six — got ${loadMin(7).toFixed(1)}min vs ${loadMin(6).toFixed(1)}min`);
  // Across the ability range the seventh day genuinely adds, and it adds MOST for the runners whose
  // sessions are nowhere near the ceilings. A regression that made the extra day cosmetic for
  // everybody would pass the two assertions above and fail this one.
  const addedAt = (fiveK: number) => {
    const wk = (d: number) => {
      const plan = generatePlan({ ...runnerOn(d), recent: { distanceMeters: 5000, timeSeconds: fiveK } },
        { distance: "marathon", raceDateIso: "2027-04-04", targetTimeSeconds: 9000, startDateIso: "2026-08-03" });
      const w = plan.weeks.find((x) => x.phase === "build" && !x.isDeload)!;
      let sec = 0;
      for (const ss of w.sessions) {
        if (!RUN.includes(ss.type)) continue;
        const steps = ss.steps ?? [];
        if (!steps.length) { sec += ss.estimatedDurationSeconds; continue; }
        for (const st of steps) {
          if (st.durationSeconds) { sec += st.durationSeconds; continue; }
          if (st.distanceMeters && st.targetPaceSecPerKm) {
            const m = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
            sec += (st.distanceMeters / 1000) * m; continue;
          }
          if (st.distanceMeters) sec += st.distanceMeters / 4;
        }
      }
      return sec / 60;
    };
    return wk(7) - wk(6);
  };
  assert.ok(addedAt(1800) > 10,
    `for a runner well clear of the ceilings the seventh day must add real training time — added ${addedAt(1800).toFixed(1)}min`);
  // ⚠️ And mobility survives: a seven-day week has no free day, so `find` returned undefined and
  // mobility silently vanished for the runners carrying the most load.
  assert.ok(buildWeekOf(7).sessions.some((s) => s.type === "mobility"),
    "mobility disappeared from the seven-day week");
  // Beginners are capped by their own track, whatever they ask for.
  const beg = generatePlan({ ...runnerOn(7), experience: "beginner" },
    { distance: "marathon", raceDateIso: "2027-04-04", targetTimeSeconds: 9000, startDateIso: "2026-08-03" });
  const begRuns = beg.weeks[10]!.sessions.filter((s) => RUN.includes(s.type)).length;
  assert.ok(begRuns <= 4, `a beginner asking for 7 days got ${begRuns} runs`);
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
