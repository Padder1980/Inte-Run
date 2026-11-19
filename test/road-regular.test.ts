// STAGES.md §10 PIECE 3 — REGULAR AND COMPETITIVE RUNNERS GET ROADS, AND THE RACE BLOCK A CHECKPOINT EVERY FOUR WEEKS
// (owner, 2026-11-18, decision 3: "yes to all five, build it"). The engine half:
//   * placement — coming back (injury or a break) at Rebuild; otherwise Base where the runway or the climb calls for
//     it, else a race-only road; a 12-17 runner still has none;
//   * Base built FROM THE MILEAGE THEY STATE by the main track's own week builder, aimed at the race block's own first
//     week (and a returner's Rebuild: the same builder, easy running only);
//   * the race block cut into blocks of four (consecutive race entries) — one block to the engine, byte for byte;
//   * volume carries across every boundary, the easy floor holds, and a week already run never changes.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan, mainFoundationNeed, type RoadStage } from "../src/plan/generate-plan.ts";
import { schedulesRecoveryWeeks } from "../src/plan/generate-plan.ts";
import { RACE_BLOCK_WEEKS, taperWeeksFor } from "../src/plan/periodization.ts";
import { BLOCK_MAX_WEEKS, BLOCK_WEEKS, type RoadProposal, raceBlockSplit, roadFor, roadStartFor } from "../src/plan/road.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";

const START = "2026-11-23"; // a Monday
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const QUALITY = new Set(["threshold", "vo2", "race-specific"]);
const RUN = new Set(["long", "easy", "recovery", "strides", "threshold", "vo2", "race-specific"]);
const AEROBIC = new Set(["long", "easy", "recovery", "strides"]);
const minsOf = (w: PlannedWeek, set: Set<string>) =>
  w.sessions.filter((s) => set.has(s.type)).reduce((m, s) => m + s.estimatedDurationSeconds / 60, 0);
const longMin = (w: PlannedWeek) => {
  const l = w.sessions.find((s) => s.type === "long");
  return l ? Math.round(l.estimatedDurationSeconds / 60) : 0;
};
const isRaceWeek = (w: PlannedWeek) => w.sessions.some((s) => s.type === "race");
/** The first full training week — the week a plan's opening is read on (generate-plan.ts weekOneKmOf). */
const weekOneKm = (ws: PlannedWeek[]) => (ws.find((w) => !w.isDeload && !isRaceWeek(w))?.plannedDistanceMeters ?? 0) / 1000;
const TT: Record<string, number> = { "5k": 1320, "10k": 2700, half: 5700, marathon: 12600 };

function runner(o: { days?: number; secs?: number; vol?: number; ret?: 0 | 1 | 2; exp?: "recreational" | "competitive" } = {}): Athlete {
  const a = {
    daysPerWeek: o.days ?? 4, recent: { distanceMeters: 5000, timeSeconds: o.secs ?? 1350 }, experience: o.exp ?? "recreational",
    includeStrength: true, returningFromInjury: o.ret === 1, returningFromBreak: o.ret === 2, runWalk: false, longRunDay: 6,
  } as Athlete;
  if (o.vol) a.weeklyVolumeKmCurrent = o.vol;
  return a;
}
const race = (distance: string, weeks: number): Goal =>
  ({ distance, targetTimeSeconds: TT[distance]!, raceDateIso: add(START, weeks * 7 - 1) }) as Goal;
const roadPlan = (athlete: Athlete, goal: Goal, prop: Pick<RoadProposal, "stages" | "rampWeeks" | "destWeeks">) =>
  generatePlan(athlete, goal, { startDateIso: START, road: { stages: prop.stages, rampWeeks: prop.rampWeeks, destWeeks: prop.destWeeks } });

type Case = { who: string; athlete: Athlete; goal: Goal; prop: RoadProposal; p: ReturnType<typeof generatePlan>; vol: number };
let SWEEP: Case[] | null = null;
/** Every road roadFor lays for regular and competitive runners across distances, abilities, days, mileage, comebacks and
 *  runways (built once, shared by the guards below). */
function sweep(): Case[] {
  if (SWEEP) return SWEEP;
  SWEEP = [];
  for (const dist of ["5k", "10k", "half", "marathon"]) for (const secs of [1080, 1650, 2100]) for (const days of [3, 4, 6])
    for (const vol of [0, 15, 40]) for (const ret of [0, 1, 2] as const) for (const wk of [14, 24, 36]) {
      const athlete = runner({ days, secs, vol, ret, exp: secs === 1080 ? "competitive" : "recreational" });
      const goal = race(dist, wk);
      const prop = roadFor(athlete, goal, START);
      if (!prop) continue;
      SWEEP.push({ who: `${dist} ${secs}s ${days}d ${vol}km ret${ret} ${wk}w`, athlete, goal, prop, p: roadPlan(athlete, goal, prop), vol });
    }
  return SWEEP;
}

test("BLOCKER: a regular or competitive runner is placed — coming back at Rebuild, otherwise at Base or a race-only road", () => {
  assert.equal(roadStartFor(runner({ ret: 1 })), "rebuild", "back from an injury");
  assert.equal(roadStartFor(runner({ ret: 2 })), "rebuild", "back from a break");
  assert.equal(roadStartFor(runner()), "base");
  assert.equal(roadStartFor(runner({ exp: "competitive" })), "base");
  assert.equal(roadStartFor({ ...runner(), age: 15 }), null, "a 12-17 runner is not placed (their ceilings are a separate review)");
  const kinds = (p: RoadProposal | null) => (p ? p.stages.map((s) => s.kind.slice(0, 2) + s.weeks).join(" ") : null);
  // Far from the race, no stated mileage: Base blocks, then the book's race block in blocks of four.
  assert.equal(kinds(roadFor(runner(), race("half", 24), START)), "ba4 ba4 ra4 ra4 ra4 ra4");
  // Too few spare weeks for a Base worth calling one: a race-only road — the longer block today's engine lays.
  const only = roadFor(runner(), race("half", 18), START)!;
  assert.equal(kinds(only), "ra4 ra4 ra4 ra4 ra2");
  assert.equal(only.startStage, "race");
  // Coming back: Rebuild first, and Base with the spare weeks.
  assert.equal(kinds(roadFor(runner({ ret: 1 }), race("half", 24), START)), "re4 ba4 ra4 ra4 ra4 ra4");
  assert.equal(kinds(roadFor(runner({ ret: 2 }), race("half", 18), START)), "re4 ra4 ra4 ra4 ra2");
  // Coming back with too little time: the race block is the part shortened, never the Rebuild, and the proposal says so.
  const short = roadFor(runner({ ret: 1 }), race("half", 14), START)!;
  assert.equal(short.stages[0]!.kind, "rebuild");
  assert.equal(short.stages[0]!.weeks, 4);
  assert.ok(short.shortWeeks > 0);
  assert.equal(short.stages.reduce((n, s) => n + s.weeks, 0), 14, "the road still fills the runway");
  // A race-only road with no checkpoint in it is no road.
  assert.equal(roadFor(runner(), race("10k", 4), START), null);
});

test("BLOCKER: the race block is today's main-track plan for the same weeks, byte for byte — its blocks of four built as one", () => {
  let n = 0, raceOnly = 0;
  for (const { who, athlete, goal, p } of sweep()) {
    const blk = p.weeks.filter((w) => w.stage === "race");
    // A race-only road starts on the runner's own day, as today's plan does; otherwise the block starts on its Monday.
    const from = blk.length === p.weeks.length ? START : blk[0]!.startDateIso;
    if (blk.length === p.weeks.length) raceOnly++;
    const today = generatePlan(athlete, goal, { startDateIso: from });
    assert.equal(blk.length, today.weeks.length, who);
    blk.forEach((w, i) => {
      const { index: _a, stage: _b, ...mine } = w;
      const { index: _c, ...theirs } = today.weeks[i]!;
      assert.deepEqual(mine, theirs, `${who}: race-block week ${i + 1} differs from today's main track`);
    });
    n++;
  }
  assert.ok(n > 800, `only ${n} roads`);
  assert.ok(raceOnly > 50, `only ${raceOnly} race-only roads — a race-only road IS today's plan, with checkpoints`);
});

test("BLOCKER: a checkpoint every four weeks inside the race block — never in the taper, never more than six weeks apart", () => {
  assert.deepEqual(raceBlockSplit(16, "half"), [4, 4, 4, 4]);
  assert.deepEqual(raceBlockSplit(14, "10k"), [4, 4, 4, 2]);
  assert.deepEqual(raceBlockSplit(12, "5k"), [4, 4, 4]);
  assert.deepEqual(raceBlockSplit(20, "marathon"), [4, 4, 4, 4, 4]);
  assert.deepEqual(raceBlockSplit(4, "5k"), [4], "too short for a checkpoint: one entry");
  for (const dist of ["1mile", "5k", "10k", "half", "marathon"] as const) for (let n = 1; n <= 30; n++) {
    const b = raceBlockSplit(n, dist);
    assert.equal(b.reduce((a, x) => a + x, 0), n, `${dist} ${n}: ${b}`);
    // Every checkpoint is four weeks after the last, and none falls inside the taper.
    b.slice(0, -1).forEach((x) => assert.equal(x, BLOCK_WEEKS, `${dist} ${n}: ${b}`));
    const lastCut = n - b[b.length - 1]!;
    if (b.length > 1) assert.ok(lastCut <= n - taperWeeksFor(n, dist), `${dist} ${n}: a checkpoint in the taper (${b})`);
    assert.ok(b[b.length - 1]! <= BLOCK_MAX_WEEKS, `${dist} ${n}: ${b[b.length - 1]} weeks without a checkpoint`);
  }
  // On every road: the race entries ARE raceBlockSplit of the race block, and where the runner keeps recovery weeks each
  // race-block checkpoint lands on the block's own lighter week — the week for the test.
  let checked = 0;
  for (const { who, athlete, goal, prop, p } of sweep()) {
    const entries = prop.stages.filter((s) => s.kind === "race").map((s) => s.weeks);
    assert.deepEqual(entries, raceBlockSplit(entries.reduce((a, x) => a + x, 0), goal.distance), who);
    if (!schedulesRecoveryWeeks(athlete, goal)) continue;
    const blk = p.weeks.filter((w) => w.stage === "race");
    let at = 0;
    for (const e of entries.slice(0, -1)) {
      at += e;
      // A race block that opens part-way through a week counts that week; its own lighter weeks are 4, 8, 12 of it.
      assert.ok(blk[at - 1]!.isDeload, `${who}: the checkpoint after race week ${at} is not on a lighter week`);
      checked++;
    }
  }
  assert.ok(checked > 1500, `only ${checked} race-block checkpoints checked`);
});

test("BLOCKER: Base starts from the mileage the runner states — its first week within 1.10x of that, or of today's plan's", () => {
  let n = 0, roadWithin = 0, todayWithin = 0, worstRoad = 0, worstToday = 0, low = 0;
  for (const { who, athlete, goal, prop, p, vol } of sweep()) {
    if (!vol || prop.stages[0]!.kind === "race") continue;
    const today = generatePlan(athlete, goal, { startDateIso: START });
    const mine = weekOneKm(p.weeks), theirs = weekOneKm(today.weeks);
    // ⚠️ THE FOUNDATION STARTS FROM THEM, NOT FROM THE RACE BLOCK: a runner stating well under what the race block opens
    // with starts nearer their own mileage than the race block would (the per-run floors keep many above it — a 20-minute
    // run cannot shrink — so "nearer", not "at"). Measured 161 of 161; a Base that ignored the stated mileage opens AT the
    // race block's week, and fails every one.
    const raceW1 = weekOneKm(p.weeks.filter((w) => w.stage === "race"));
    if (vol * 1.25 < raceW1) {
      low++;
      assert.ok(Math.abs(mine - vol) < Math.abs(raceW1 - vol),
        `${who}: the road opens at ${mine.toFixed(1)} km — no nearer the stated ${vol} than the race block's ${raceW1.toFixed(1)}`);
    }
    // ⚠️ THE BIGGER OF THE TWO, NOT TODAY'S ALONE: a longer block starts lower on its ramp, so today's plan can open UNDER
    // what the runner says they run (a returner at 40 km a week: 34.6 km), and a road opening at their own 40 is the
    // evidence's "week one near the recent baseline", not a jump. Where the per-run floors put both above the stated
    // mileage (a small week cannot shrink a 20-minute run), the road is held to today's plan's own first week.
    // ⚠️ 1.12, AND THE TWO POINTS ARE THE QUALITY ROTATION, MEASURED: one profile (a 5 km runner at 15 km a week on four
    // days) opens Base on the library's 65-minute threshold session (16.9 km) where today's plan opens on its 56-minute
    // one (15.2 km) — and today's own second week is that same 65-minute session, at 17.6 km. Worst 1.112.
    assert.ok(mine <= Math.max(vol, theirs) * 1.12 + 1e-9,
      `${who}: the road opens at ${mine.toFixed(1)} km — stated ${vol}, today's plan ${theirs.toFixed(1)}`);
    n++;
    if (mine <= vol * 1.10) roadWithin++;
    if (theirs <= vol * 1.10) todayWithin++;
    worstRoad = Math.max(worstRoad, mine / vol);
    worstToday = Math.max(worstToday, theirs / vol);
  }
  assert.ok(n > 300, `only ${n} roads with a stated mileage and a foundation`);
  assert.ok(low > 100, `only ${low} runners stating well under the race block's opening`);
  // Week one lands within 1.10x of the stated mileage at least as often as today's plan, and its worst case is smaller.
  assert.ok(roadWithin >= todayWithin, `${roadWithin} of ${n} within 1.10x on a road, ${todayWithin} on today's plan`);
  assert.ok(worstRoad <= worstToday, `worst first week ${worstRoad.toFixed(2)}x stated on a road, ${worstToday.toFixed(2)}x today`);
});

test("BLOCKER: a regular runner's Rebuild is easy running only, and Base brings one quality session a week back", () => {
  let reb = 0, base = 0, baseWithQ = 0, sprints = 0, plainBase = 0, worstReb = 0;
  for (const { who, p } of sweep()) for (const w of p.weeks) {
    if (w.stage === "rebuild") {
      reb++;
      // ⚠️ NEVER BIGGER THAN THE RACE BLOCK IT LEADS TO: the hard session's day is an easy run of the ground that session
      // would have covered. Measured 1.094 at worst; a full-length easy run in its place measured 1.237 (a fast runner on
      // three days at 40 km a week, 47.4 km of Rebuild before a 39.9 km race week). Read against the race block's first
      // week WITH a hard session — the same shape: a marathon's race block opens with quality-free weeks, and on six days
      // those carry five runs (the main track's easy-day list has four slots, pre-existing), where Rebuild rightly has six.
      const raceW1 = (p.weeks.find((x) => x.stage === "race" && !x.isDeload && x.qualitySessionCount >= 1 && !isRaceWeek(x))
        ?.plannedDistanceMeters ?? 0) / 1000;
      // ⚠️ AND AS MANY RUNS AS THE RUNNER'S OTHER WEEKS: the hard session's day is a run, not a gap — measured before, a
      // six-day runner's Rebuild had five (the stand-in was drawn from the four easy-day slots).
      const raceQ = p.weeks.find((x) => x.stage === "race" && !x.isDeload && x.qualitySessionCount >= 1 && !isRaceWeek(x));
      if (!w.isDeload && raceQ) assert.equal(w.sessions.filter((s) => RUN.has(s.type)).length,
        raceQ.sessions.filter((s) => RUN.has(s.type)).length, `${who}: Rebuild week ${w.index} has a different number of runs`);
      if (!w.isDeload && raceW1 > 0) {
        worstReb = Math.max(worstReb, w.plannedDistanceMeters / 1000 / raceW1);
        assert.ok(w.plannedDistanceMeters / 1000 <= raceW1 * 1.10,
          `${who}: Rebuild week ${w.index} is ${(w.plannedDistanceMeters / 1000).toFixed(1)} km, the race block opens at ${raceW1.toFixed(1)}`);
      }
      assert.equal(w.sessions.filter((s) => QUALITY.has(s.type)).length, 0, `${who}: Rebuild week ${w.index} carries a hard session`);
      // No strides, no hill sprints, no moderate gear: every running step is easy (RPE 3 at most).
      for (const s of w.sessions.filter((s) => RUN.has(s.type)))
        for (const st of s.steps ?? []) assert.ok((st.targetRpe?.max ?? 0) <= 3,
          `${who}: Rebuild week ${w.index}'s "${s.title}" asks for RPE ${st.targetRpe?.max}`);
    }
    if (w.stage === "base" && !w.isDeload) {
      base++;
      const q = w.sessions.filter((s) => QUALITY.has(s.type)).length;
      assert.ok(q <= 1, `${who}: Base week ${w.index} carries ${q} hard sessions`);
      if (q === 1) baseWithQ++;
      // Hill sprints: the main track's weekly staple — withheld from a runner coming back, as in their race block.
      if (!p.athlete.returningFromInjury && !p.athlete.returningFromBreak) {
        plainBase++;
        if (w.sessions.some((s) => (s.type === "easy" || s.type === "strides") &&
          (s.steps ?? []).some((st) => st.kind === "rep" && st.targetPaceSecPerKm == null))) sprints++;
      }
    }
  }
  assert.ok(reb > 200 && base > 1000, `only ${reb} Rebuild and ${base} Base weeks`);
  assert.ok(worstReb > 0.9, `a Rebuild that never reaches its race block's size (${worstReb.toFixed(2)}) measured nothing`);
  // One quality session a week from Base's first week (decision 1); a week too small for one inside the easy floor
  // carries none — measured rare, never the rule.
  assert.ok(baseWithQ >= base * 0.9, `only ${baseWithQ} of ${base} Base weeks carry their quality session`);
  assert.ok(sprints > plainBase * 0.3, `hill sprints in only ${sprints} of ${plainBase} Base weeks`);
});

test("BLOCKER: volume carries across every boundary — the long run always, the week like for like where the road fits", () => {
  let joins = 0, worstLong = 0, worstLike = 0;
  for (const { who, prop, p } of sweep()) {
    for (let i = 1; i < p.weeks.length; i++) {
      const w = p.weeks[i]!;
      if (w.isDeload || isRaceWeek(w)) continue;
      const before = p.weeks.slice(0, i).filter((x) => !x.isDeload).pop();
      if (!before || before.stage === w.stage || !longMin(before) || !longMin(w)) continue;
      joins++;
      worstLong = Math.max(worstLong, longMin(w) / longMin(before));
      assert.ok(longMin(w) <= Math.floor(longMin(before) * 1.10),
        `${who}: the long run jumps ${longMin(before)} → ${longMin(w)} minutes into ${w.stage} (week ${w.index})`);
      if (prop.shortWeeks > 0) continue;
      // LIKE FOR LIKE: the easy running where both weeks carry the same hard sessions; the whole week where the race
      // block opens with fewer (a long race block's own quality-free opening turns a hard session into an easy run).
      const r = w.qualitySessionCount < before.qualitySessionCount
        ? minsOf(w, RUN) / minsOf(before, RUN) : minsOf(w, AEROBIC) / minsOf(before, AEROBIC);
      worstLike = Math.max(worstLike, r);
      // Measured 1.110 (the rounding of whole-minute runs); a foundation aimed at the book's block instead of the one it
      // joins measured 1.338, and one too short for the climb 1.405.
      assert.ok(r <= 1.12, `${who}: the week jumps ${r.toFixed(3)}x into ${w.stage} (week ${w.index})`);
    }
  }
  assert.ok(joins > 1000, `only ${joins} boundaries`);
  assert.ok(worstLong > 1.0 && worstLike > 1.0, "a sweep with no step measured nothing");
});

test("BLOCKER: a regular runner's foundation never breaks the easy floor", () => {
  // ⚠️ THE SWEEP, AND THE RUNNERS WHERE IT BITES: very low mileage on three days, where one library-length hard session is a
  // large share of a small week. Measured with the "too small for its hard session" rule switched off: 40 of 28,123 Base weeks
  // under the floor (a 5 km runner at 8 km a week: 67.6% easy against 68%) — none of them in the sweep's own grid.
  const small = [8, 12].flatMap((vol) => [0, 1].flatMap((ret) => [20, 30].map((wk) => {
    const athlete = runner({ vol, ret: ret as 0 | 1, days: 3, secs: 1900 }), goal = race("5k", wk);
    const prop = roadFor(athlete, goal, START)!;
    return { who: `5k 1900s 3d ${vol}km ret${ret} ${wk}w`, p: roadPlan(athlete, goal, prop) };
  })));
  let weeks = 0;
  for (const { who, p } of [...sweep(), ...small]) for (const w of p.weeks) {
    if (w.stage === "race") continue;
    const d = computeDistribution(w.sessions);
    if (!d.totalSeconds) continue;
    weeks++;
    assert.ok(honoursModel(d, p.intensityModel), `${who}: ${w.stage} week ${w.index} is ${(d.easy * 100).toFixed(1)}% easy`);
  }
  assert.ok(weeks > 5000, `only ${weeks} foundation weeks`);
});

test("BLOCKER: a week already run never changes when a later checkpoint is answered", () => {
  for (const [athlete, goal] of [[runner({ ret: 1, vol: 20, days: 4 }), race("half", 30)], [runner({ vol: 25, days: 5 }), race("10k", 30)]] as const) {
    const prop = roadFor(athlete, goal, START)!;
    const st = prop.stages;
    const laid = roadPlan(athlete, goal, prop);
    const firstKind = st[0]!.kind;
    const raceEntries = st.filter((s) => s.kind === "race");
    const found = st.filter((s) => s.kind !== "race");
    const total = (xs: RoadStage[]) => xs.reduce((n, s) => n + s.weeks, 0);
    const relay = (f: RoadStage[], raceWeeks: number): RoadStage[] =>
      [...f, ...raceBlockSplit(raceWeeks, goal.distance).map((w) => ({ kind: "race" as const, weeks: w }))];
    const F = total(found), R = total(raceEntries);
    const a0 = found[0]!.weeks;
    // The answers the app records (roadAnswered): a week more takes from the next Base block, then the race block.
    // ⚠️ A week more of one Base block before another changes NO session — consecutive Base blocks are one stretch of
    // Base to the engine — so only an answer that changes the next week's stage is expected to change the next week.
    const variants: Array<{ why: string; stages: RoadStage[]; same: number; changes: boolean }> = [
      { why: `one more week of ${firstKind}`, same: a0, changes: found[1]!.kind !== firstKind,
        stages: relay([{ ...found[0]!, weeks: a0 + 1 }, { ...found[1]!, weeks: found[1]!.weeks - 1 }, ...found.slice(2)], R) },
      { why: "easing back after the first block", same: a0, changes: true,
        stages: relay([found[0]!, { kind: "rebuild", weeks: 1 }, { ...found[1]!, weeks: found[1]!.weeks - 1 }, ...found.slice(2)], R) },
      { why: "one more week of the last Base block, carried into the race block", same: F, changes: true,
        stages: relay([...found.slice(0, -1), { ...found[found.length - 1]!, weeks: found[found.length - 1]!.weeks + 1 }], R - 1) },
    ];
    for (const v of variants) {
      const p = roadPlan(athlete, goal, { stages: v.stages, rampWeeks: prop.rampWeeks, destWeeks: prop.destWeeks });
      for (let i = 0; i < v.same; i++) assert.deepEqual(p.weeks[i], laid.weeks[i], `${v.why}: week ${i + 1}, already run, changed`);
      if (v.changes) assert.notDeepEqual(p.weeks[v.same], laid.weeks[v.same], `${v.why}: the week after the checkpoint did not change`);
      else assert.deepEqual(p.weeks, laid.weeks, `${v.why}: a block boundary inside Base changed a session`);
    }
  }
});

test("the climb is measured honestly, and a runway that cannot hold it before even the shortest race block lays no road", () => {
  // A runner already running what the race block opens with needs no foundation; one stating far less needs weeks.
  assert.equal(mainFoundationNeed(runner({ vol: 40, days: 5 }), race("10k", 30)), 0);
  assert.ok(mainFoundationNeed(runner({ vol: 15, days: 6 }), race("marathon", 30)) >= 8);
  // A marathon fourteen weeks away on 15 km a week: the climb does not fit before a four-week race block. No road — the
  // runner keeps today's plan (measured with a cut foundation: 55 → 83 minutes into the race block).
  assert.equal(roadFor(runner({ vol: 15, days: 6, secs: 1080, exp: "competitive" }), race("marathon", 14), START), null);
  // ⚠️ AND NO BASE SQUEEZED IN FRONT OF A SHORTENED RACE BLOCK where today's own longer block needs no climb: a 5 km runner at
  // 20 km a week on six days, fourteen weeks out, needs three weeks of climb before the book's 12-week block but none before
  // today's 14-week one (it opens lower on its ramp) — so that block, as a race-only road, with nothing to tick. Measured: 8 of
  // 1,152 such runners; without it each got a Base and a shortened race block to tick.
  const near = roadFor(runner({ vol: 20, secs: 1650, days: 6 }), race("5k", 14), START)!;
  assert.equal(near.startStage, "race");
  assert.equal(near.shortWeeks, 0);
  assert.equal(near.stages.reduce((n, s) => n + s.weeks, 0), 14);
});
