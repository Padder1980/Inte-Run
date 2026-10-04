import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePlan, secondaryRaceWindow } from "../src/plan/generate-plan.ts";
import { taperFor } from "../src/science/taper.ts";
import { RACE_DISTANCES_M } from "../src/domain/units.ts";
import type { Athlete, Goal, PlannedWeek, RaceDistanceKey, Session } from "../src/domain/types.ts";

/**
 * STAGE B7 — A B-RACE: A SMALLER RACE INSIDE THE PLAN (PLAN.md: "a secondary race inside the plan reshapes its
 * fortnight through the engine").
 *
 * The week before is the engine's own easier week, race week keeps one sharpener and puts the race on the day,
 * the two days after it are rest and a 25-minute recovery jog — and the goal race, its week and its taper are
 * untouched. Everything here runs the real engine over a grid, and asks the questions in calendar dates, the way
 * a runner would ("what am I doing the day after my 10K?"), because this engine's history has a race-eve rule
 * that was only ever tested inside one week and was wrong across the boundary.
 */

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const dow = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
const mondayOf = (iso: string) => addDays(iso, -dow(iso));

const athlete = (o: Partial<Athlete> = {}): Athlete => ({ daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
  experience: "recreational", includeStrength: true, returningFromInjury: false, weeklyVolumeKmCurrent: 40, age: 40, ...o } as Athlete);
const TT: Record<string, number> = { "5k": 1500, "10k": 3100, half: 6600, marathon: 14400 };
/** Goal races on four different weekdays: Sunday, Saturday, Monday, Wednesday. */
const RACE_DAYS = ["2027-01-10", "2027-01-09", "2027-01-11", "2027-01-13"];
const goal = (distance: RaceDistanceKey, raceDateIso: string): Goal =>
  ({ distance, targetTimeSeconds: TT[distance]!, raceDateIso, startDateIso: "2026-08-24" } as Goal);

/** Every session with its real date. */
const byDate = (weeks: PlannedWeek[]) => weeks.flatMap((w) =>
  w.sessions.map((s) => ({ iso: addDays(mondayOf(w.startDateIso), s.dayOfWeek), s, w })));
const isHard = (s: Session) => s.intensity === "hard" || s.type === "threshold" || s.type === "race-specific";
/** Pairs of consecutive DATES that both hold a hard session, across week boundaries. */
const adjacentHard = (weeks: PlannedWeek[]) => {
  const hard = new Set(byDate(weeks).filter((x) => isHard(x.s)).map((x) => x.iso));
  return [...hard].filter((iso) => hard.has(addDays(iso, 1))).map((iso) => iso + "+" + addDays(iso, 1));
};
const isQuality = (s: Session) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific";

/** Each goal × race weekday, with B-races at the first, middle and last day the window allows (Sunday-aligned
 *  where possible) and at the shortest and longest distance it allows. */
function* grid() {
  for (const distance of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[]) {
    for (const raceIso of RACE_DAYS) {
      const g = goal(distance, raceIso);
      const a = athlete();
      const base = generatePlan(a, g);
      const win = secondaryRaceWindow(base.weeks, g);
      if (!win) continue;
      const span = Math.round((Date.parse(win.toIso) - Date.parse(win.fromIso)) / 864e5);
      const days = [win.fromIso, addDays(win.fromIso, Math.floor(span / 2)), win.toIso];
      const dists = [...new Set([win.distances[0]!, win.distances[win.distances.length - 1]!])];
      for (const day of days) for (const d of dists) yield { g, a, base, win, sr: { distance: d, dateIso: day } };
    }
  }
}

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: with no B-race the plan is exactly what it was", () => {
  // PLAN.md B7 E: "Option absent → generator unchanged." Asked of whole plans, not of a field.
  for (const distance of ["5k", "half", "marathon"] as RaceDistanceKey[]) {
    const g = goal(distance, "2027-01-10");
    const a = generatePlan(athlete(), g), b = generatePlan(athlete(), g, {}), c = generatePlan(athlete(), g, { secondaryRace: undefined });
    for (const p of [b, c]) assert.deepEqual({ ...p, createdAtIso: "" }, { ...a, createdAtIso: "" }, distance + ": an absent B-race changed the plan");
    assert.ok(a.weeks.every((w) => !("secondaryRace" in w)), "a plan with no B-race carries the mark");
  }
});

test("BLOCKER: the window — shorter than the goal, from week 2, never in the taper or within three days of race week", () => {
  let checked = 0;
  for (const distance of ["1mile", "5k", "10k", "half", "marathon"] as RaceDistanceKey[]) {
    for (const raceIso of RACE_DAYS) {
      const g = goal(distance, raceIso);
      const p = generatePlan(athlete(), g);
      const win = secondaryRaceWindow(p.weeks, g);
      const shorter = (Object.keys(RACE_DISTANCES_M) as RaceDistanceKey[]).filter((k) => RACE_DISTANCES_M[k] < RACE_DISTANCES_M[distance]);
      if (!shorter.length) { assert.equal(win, null, distance + ": a window with nothing shorter than the goal"); continue; }
      assert.ok(win, distance + " " + raceIso + ": no window at all on a five-month block");
      assert.deepEqual(win.distances, shorter, "the window offers a distance that is not shorter than the goal");
      assert.equal(win.fromIso, mondayOf(p.weeks[1]!.startDateIso), "the window does not open in week 2");
      const lastBuild = [...p.weeks].slice(0, -1).reverse().find((w) => w.phase !== "taper")!;
      assert.ok(win.toIso <= addDays(mondayOf(lastBuild.startDateIso), 6), "the window reaches into the taper");
      assert.ok(win.toIso <= addDays(mondayOf(raceIso), -3), "the window ends inside three days of race week");
      // Runna's rule, which the taper delivers: never within a week of the goal race.
      assert.ok(Date.parse(raceIso) - Date.parse(win.toIso) >= 7 * 864e5, distance + ": a B-race allowed within a week of the goal");
      checked++;
    }
  }
  assert.ok(checked >= 16, "the grid checked only " + checked + " windows");
});

test("BLOCKER: outside the window nothing changes — re-break: a B-race in the taper", () => {
  // ⚠️ PLAN.md's OWN RE-BREAK: place the B-race in the taper. The taper is the goal race's.
  for (const distance of ["10k", "half", "marathon"] as RaceDistanceKey[]) {
    const g = goal(distance, "2027-01-10");
    const base = generatePlan(athlete(), g);
    const win = secondaryRaceWindow(base.weeks, g)!;
    const taperDay = addDays(mondayOf(base.weeks.find((w) => w.phase === "taper")!.startDateIso), 6);
    const tooLong = (Object.keys(RACE_DISTANCES_M) as RaceDistanceKey[]).find((k) => RACE_DISTANCES_M[k] >= RACE_DISTANCES_M[distance])!;
    const cases = [
      { distance: win.distances[0]!, dateIso: taperDay },                 // in the taper
      { distance: win.distances[0]!, dateIso: addDays(win.toIso, 1) },     // a day past the window
      { distance: win.distances[0]!, dateIso: addDays(win.fromIso, -1) },  // week 1
      { distance: tooLong, dateIso: win.fromIso },                         // not shorter than the goal
    ];
    for (const sr of cases) {
      const p = generatePlan(athlete(), g, { secondaryRace: sr });
      assert.deepEqual(p.weeks, base.weeks, distance + ": a B-race of " + JSON.stringify(sr) + " outside the window changed the plan");
    }
  }
});

test("BLOCKER: only the weeks around the B-race change — the goal race's week is byte-identical, and the taper still cuts", () => {
  let n = 0;
  for (const { g, a, base, sr } of grid()) {
    const p = generatePlan(a, g, { secondaryRace: sr });
    const who = g.distance + " " + g.raceDateIso + " B " + sr.distance + " " + sr.dateIso;
    const ri = p.weeks.findIndex((w) => mondayOf(w.startDateIso) === mondayOf(sr.dateIso));
    assert.ok(ri >= 1, who + ": the B-race found no week");
    p.weeks.forEach((w, i) => {
      if (i >= ri - 1 && i <= ri + 1) return;
      assert.deepEqual(w, base.weeks[i], who + ": week " + w.index + " changed, far from the B-race");
    });
    const last = p.weeks.length - 1;
    assert.deepEqual(p.weeks[last], base.weeks[last], who + ": the goal race's week changed");
    assert.ok(!p.weeks[last]!.secondaryRace, who + ": the goal race's week is marked as a B-race week");
    // The taper still cuts (test/generate-plan.test.ts's own measure: last full taper week against the peak).
    // ⚠️ AGAINST THE SAME PLAN WITHOUT THE B-RACE, NOT 30% FLAT: some plans sit under 30% with no B-race at all
    // (this grid's 10K at 29.8%; the progression audit's minimum is 21%, notes/plan-audits.md), and a B-race
    // in week 2 cannot be blamed for that. The claim is that a B-race never deepens the problem: the cut never
    // falls, and never under 30% where it was at least that.
    // ⚠️⚠️ AND AGAINST THE PLAN'S OWN DESIGNED PEAK. A B-race in the last week before the taper takes the place of
    // that week's training, which is often the block's biggest: measured, a marathon's cut read 38.6% -> 29.3%
    // with a 1-mile race on the last day the window allows, against "the biggest week left" — while not one taper
    // week got any heavier. The taper is the goal race's and must be untouched (PLAN.md B7 B), so that is the
    // claim: every taper week is no heavier than it was, and the cut against the peak the plan was built to reach
    // still clears 30% wherever it did.
    const cutOf = (ws: PlannedWeek[], peakFrom: PlannedWeek[]) => {
      const peak = Math.max(...peakFrom.filter((w) => !w.sessions.some((s) => s.type === "race")).map((w) => w.plannedDistanceMeters));
      const tw = ws.filter((w) => w.phase === "taper");
      const lastFull = tw.length > 1 ? tw[tw.length - 2]! : tw[0]!;
      return 1 - lastFull.plannedDistanceMeters / peak;
    };
    p.weeks.forEach((w, i) => {
      if (w.phase === "taper") assert.ok(w.plannedDistanceMeters <= base.weeks[i]!.plannedDistanceMeters, who + ": taper week " + w.index + " got heavier");
    });
    const was = cutOf(base.weeks, base.weeks), now = cutOf(p.weeks, base.weeks);
    assert.ok(now >= was - 1e-9, who + ": the B-race shrank the taper cut from " + was.toFixed(3) + " to " + now.toFixed(3));
    if (was >= 0.30) assert.ok(now >= 0.30, who + ": the taper cut fell under 30%");
    n++;
  }
  assert.ok(n >= 60, "the grid built only " + n + " plans");
});

test("BLOCKER: no hard day is ever put next to another, across week boundaries", () => {
  for (const { g, a, base, sr } of grid()) {
    const p = generatePlan(a, g, { secondaryRace: sr });
    const had = new Set(adjacentHard(base.weeks));
    const added = adjacentHard(p.weeks).filter((x) => !had.has(x));
    assert.deepEqual(added, [], g.distance + " B " + sr.distance + " " + sr.dateIso + ": hard days placed side by side");
  }
});

test("BLOCKER: the fortnight's shape — an easier week, one sharpener, the race at its own pace, then rest and a jog", () => {
  for (const { g, a, base, sr } of grid()) {
    const p = generatePlan(a, g, { secondaryRace: sr });
    const who = g.distance + " B " + sr.distance + " " + sr.dateIso;
    const ri = p.weeks.findIndex((w) => mondayOf(w.startDateIso) === mondayOf(sr.dateIso));
    const before = p.weeks[ri - 1]!, rw = p.weeks[ri]!;
    // The week before: the engine's own easier week (unless it is already a recovery week), and marked.
    assert.equal(before.secondaryRace?.role, "before", who);
    if (!before.isDeload) assert.ok(before.plannedDistanceMeters < base.weeks[ri - 1]!.plannedDistanceMeters || before.qualitySessionCount < base.weeks[ri - 1]!.qualitySessionCount,
      who + ": the week before the B-race is not easier");
    // ...and its long run is still its longest run, on both rulers (the owner's rule; keepLongRunLongest).
    const long = before.sessions.find((s) => s.type === "long");
    if (long) for (const s of before.sessions.filter((x) => x !== long && ["easy", "recovery", "strides"].includes(x.type))) {
      assert.ok((s.estimatedDistanceMeters ?? 0) <= (long.estimatedDistanceMeters ?? 0) && (s.trainingDistanceMeters ?? 0) <= (long.trainingDistanceMeters ?? 0),
        who + ": " + s.title + " is longer than the long run in the week before the B-race");
    }
    // Race week: the race on its day, at the runner's predicted pace for THAT distance, and one hard session at most.
    assert.equal(rw.secondaryRace?.role, "race", who);
    const days = byDate(p.weeks);
    const race = days.filter((x) => x.s.type === "race" && x.iso === sr.dateIso);
    assert.equal(race.length, 1, who + ": not exactly one race on the B-race's day");
    const metres = RACE_DISTANCES_M[sr.distance];
    const pace = p.paces.predictedRaceTimes[sr.distance] / (metres / 1000);
    const rep = race[0]!.s.steps.find((st) => st.kind === "rep")!;
    assert.equal(rep.distanceMeters, metres, who + ": the race is not its own distance");
    assert.ok(rep.targetPaceSecPerKm!.minSecPerKm < pace && rep.targetPaceSecPerKm!.maxSecPerKm > pace,
      who + ": the B-race is not paced at the runner's predicted pace for its distance");
    assert.ok(rw.sessions.filter(isQuality).length <= 1, who + ": race week keeps more than one sharpener");
    // Nothing hard the day before; nothing the day after; a 25-minute recovery jog the day after that.
    const on = (iso: string) => days.filter((x) => x.iso === iso).map((x) => x.s);
    assert.ok(!on(addDays(sr.dateIso, -1)).some((s) => ["threshold", "vo2", "race-specific", "long", "strength"].includes(s.type)),
      who + ": something hard the day before the B-race");
    assert.ok(on(addDays(sr.dateIso, 1)).every((s) => s.type === "rest"), who + ": the day after the B-race is not rest");
    const jog = on(addDays(sr.dateIso, 2));
    assert.ok(jog.length === 1 && jog[0]!.type === "recovery" && Math.round(jog[0]!.estimatedDurationSeconds / 60) === 25,
      who + ": two days after the B-race is not a 25-minute recovery jog");
    // Easy and long running in race week are cut by the B distance's own race-week multiplier.
    const m = taperFor(sr.distance).volumeMultiplierByWeek.at(-1)!;
    for (const s of rw.sessions.filter((x) => (x.type === "easy" || x.type === "long") && x.dayOfWeek < dow(sr.dateIso))) {
      const was = base.weeks[ri]!.sessions.find((b) => b.id === s.id);
      if (was) assert.equal(s.estimatedDurationSeconds, Math.round(was.estimatedDurationSeconds * m), who + ": " + s.title + " was not cut by the race-week multiplier");
    }
    // Seven days a week, in order, and the week's figures its own.
    for (const w of [before, rw, p.weeks[ri + 1]].filter(Boolean) as PlannedWeek[]) {
      const ds = [...new Set(w.sessions.map((s) => s.dayOfWeek))];
      if (mondayOf(w.startDateIso) === w.startDateIso) assert.equal(ds.length, 7, who + ": week " + w.index + " lost a day");
      assert.deepEqual(w.sessions.map((s) => s.dayOfWeek), [...w.sessions.map((s) => s.dayOfWeek)].sort((x, y) => x - y));
      assert.equal(w.qualitySessionCount, w.sessions.filter(isQuality).length, who + ": week " + w.index + "'s quality count is stale");
    }
  }
});

test("BLOCKER: the easier week before a B-race keeps its long run the longest run — the cases that broke it", () => {
  // ⚠️ FOUND BY THE AUDIT'S B-RACE AXIS: easeWeek trims the long run by a fifth and easy running by a seventh, and
  // turns the demoted session into an easy run of 70% of ITS length — so in slow, low-mileage plans the week before
  // a B-race came out with an easy run longer than its long run (148 such weeks became 217 across the audit's grid,
  // worst 1.33x). The grid above never meets those plans, so they are named here: slow 5K runners on three days,
  // with the one race shorter than a 5K, a mile.
  let met = 0;
  for (const tenK of [2400, 3000, 3600]) for (const days of [3, 5]) {
    const a = athlete({ daysPerWeek: days, recent: { distanceMeters: 10000, timeSeconds: tenK }, weeklyVolumeKmCurrent: undefined, includeStrength: false });
    const g = { distance: "5k", targetTimeSeconds: 1500, raceDateIso: "2027-01-10", startDateIso: "2026-08-03" } as Goal;
    const base = generatePlan(a, g);
    const win = secondaryRaceWindow(base.weeks, g)!;
    const mid = addDays(win.fromIso, Math.floor((Date.parse(win.toIso) - Date.parse(win.fromIso)) / 864e5 / 2));
    const sr = { distance: "1mile" as RaceDistanceKey, dateIso: addDays(mid, (7 - ((new Date(mid + "T00:00:00Z").getUTCDay()) % 7)) % 7) };
    const p = generatePlan(a, g, { secondaryRace: sr });
    const before = p.weeks.find((w) => w.secondaryRace?.role === "before")!;
    const long = before.sessions.find((s) => s.type === "long");
    if (!long) continue;
    met++;
    for (const s of before.sessions.filter((x) => x !== long && ["easy", "recovery", "strides"].includes(x.type)))
      assert.ok((s.estimatedDistanceMeters ?? 0) <= (long.estimatedDistanceMeters ?? 0) && (s.trainingDistanceMeters ?? 0) <= (long.trainingDistanceMeters ?? 0),
        tenK + "s/" + days + "d: " + s.title + " (" + s.estimatedDistanceMeters + " m) is longer than the long run (" + long.estimatedDistanceMeters + " m) the week before a mile race");
  }
  assert.ok(met >= 4, "only " + met + " of the named cases have a long run the week before");
});

test("BLOCKER: a young runner's B-race stays inside their limits", () => {
  // A 14-year-old's goal is already inside the youth ceilings, and a B-race is shorter than it — but the week
  // holding the race must also stay under the weekly ceiling the plan was held to.
  const a = athlete({ age: 14, weeklyVolumeKmCurrent: 20, daysPerWeek: 4 });
  const g = goal("10k", "2027-01-10");
  const base = generatePlan(a, g);
  const win = secondaryRaceWindow(base.weeks, g)!;
  const p = generatePlan(a, g, { secondaryRace: { distance: "5k", dateIso: addDays(win.fromIso, 6 + 7 * 4) } });
  const km = (w: PlannedWeek) => w.sessions.reduce((t, s) => t + (s.estimatedDistanceMeters ?? 0) / 1000, 0);
  const peak = Math.max(...base.weeks.map(km));
  for (const w of p.weeks) assert.ok(km(w) <= peak + 0.05, "week " + w.index + " of a 14-year-old's plan grew past its own biggest week with a B-race");
  assert.ok(p.weeks.some((w) => w.secondaryRace?.role === "race"), "the young runner's B-race was not placed at all");
});
