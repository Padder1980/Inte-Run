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
  for (let raceShift = 0; raceShift < 7; raceShift++) {
    for (let longDay = 0; longDay < 7; longDay++) {
      const raceIso = shiftIso(goal.raceDateIso, raceShift);
      const p = generatePlan({ ...athlete, longRunDay: longDay }, { ...goal, raceDateIso: raceIso });
      const wk = p.weeks.at(-1)!;
      const dow = (new Date(raceIso + "T00:00:00Z").getUTCDay() + 6) % 7;
      const race = wk.sessions.find((s) => s.type === "race");
      assert.ok(race, `race missing (shift ${raceShift}, longDay ${longDay})`);
      assert.equal(race!.dayOfWeek, dow, `race on wrong day (shift ${raceShift}, longDay ${longDay})`);
      const after = wk.sessions.filter((s) => s.dayOfWeek > dow && s.type !== "rest");
      assert.equal(after.length, 0, `session after the race (shift ${raceShift}, longDay ${longDay})`);
      const hardEve = wk.sessions.filter(
        (s) => s.dayOfWeek === dow - 1 &&
          ["threshold", "vo2", "race-specific", "long", "strength"].includes(s.type),
      );
      assert.equal(hardEve.length, 0,
        `hard session the day before the race (shift ${raceShift}, longDay ${longDay}): ` +
        hardEve.map((s) => s.title).join());
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

test("the volume model only ever builds a plan UP, never down", () => {
  // ⚠️ THE CENTRAL INVARIANT, and it is a coaching rule before it is a coding one. buildWeek scales
  // the easy runs and the long run; the quality sessions come from the library at full prescribed
  // length and do not move. So a smaller week is not a gentler week — it is the SAME hard sessions
  // on a thinner aerobic base, which is how runners get hurt, and arithmetically it drove the easy
  // fraction under the intensity model's floor in 175 of 23040 measured weeks.
  //
  // So a runner who states LESS than their plan naturally builds gets that plan untouched, and the
  // mismatch is answered by assessFeasibility's warning rather than by quietly shrinking the block.
  const natural = generatePlan(runner(undefined), goal);
  for (const stated of [10, 25, 40, 60, 80]) {
    const p = generatePlan(runner(stated), goal);
    assert.ok(peakKm(p) >= peakKm(natural) - 0.01,
      `stating ${stated}km/wk SHRANK the plan: ${peakKm(natural).toFixed(1)} -> ${peakKm(p).toFixed(1)}km`);
  }
  // And below the natural size it is a strict no-op, not merely a non-shrink.
  assert.equal(
    JSON.stringify(generatePlan(runner(40), goal).weeks),
    JSON.stringify(natural.weeks),
    "a stated mileage under the plan's own size must leave it byte-identical",
  );
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
