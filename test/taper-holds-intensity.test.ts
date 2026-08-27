// The taper holds INTENSITY and SPECIFICITY and cuts VOLUME — and until 2026-08-27 it held neither
// of the first two, while `src/science/taper.ts`'s own notes promised both.
//
// ⚠️ THE DEFECT WAS A WRITTEN PROMISE THE CODE DID NOT KEEP, so that is what these guards pin.
// `qualityContentsFor`'s taper branch pushed one hardcoded `vo2-10x1` for every distance, so a
// marathon runner who had spent a whole block building goal-pace work was handed one-minute VO2 reps
// for their final fortnight. Measured with the engine's own `computeDistribution` over a 20-week
// block: **0 of 120 taper weeks contained any threshold or race-specific work, and 120 of 120
// contained VO2** — against notes reading "keep marathon-pace touches" and "hold threshold
// intensity". Both were false as delivered.
//
// ⚠️ AND MEASURING IT IS WHERE THIS GOES WRONG. Quality reps carry NO step-level `targetRpe` — the
// SESSION carries {min:8,max:9} and the reps carry nothing — so a filter on step RPE reads a VO2
// session as zero hard minutes and reports "the taper throws away all intensity" about a week that
// plainly contains one. CLAUDE.md records that exact trap from the progression audit; use
// `computeDistribution`, which is the engine's own tested definition, and never roll a second one.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, RaceDistanceKey } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { computeDistribution } from "../src/science/intensity-distribution.ts";
import { taperFor } from "../src/science/taper.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { RACE_DISTANCES_M } from "../src/domain/units.ts";
import { readFileSync } from "node:fs";

const EVENTS: RaceDistanceKey[] = ["5k", "10k", "half", "marathon"];
const QUALITY = ["threshold", "vo2", "race-specific"];
const START = "2026-09-07";   // a Monday, so no pro-rata first week

function raceDate(weeks: number): string {
  const d = new Date(START + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7 - 1);
  return d.toISOString().slice(0, 10);
}
const goalFor = (distance: RaceDistanceKey, fiveK: number, weeks = 20): Goal => ({
  distance,
  targetTimeSeconds: Math.round(fiveK * (RACE_DISTANCES_M[distance] / 5000) ** 1.06),
  raceDateIso: raceDate(weeks),
  startDateIso: START,
});
const runnerOn = (fiveK: number, o: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: fiveK },
  experience: "recreational",
  includeStrength: true,
  longRunDay: 6,
  ...o,
});
const isRaceWeek = (w: PlannedWeek) => w.sessions.some((s) => s.type === "race");
const plan = (distance: RaceDistanceKey, fiveK: number, o: Partial<Athlete> = {}, weeks = 20) =>
  generatePlan(runnerOn(fiveK, o), goalFor(distance, fiveK, weeks), { startDateIso: START });

/** Absolute minutes of moderate-or-hard running, by the engine's own bucketing. */
function nonEasyMinutes(w: PlannedWeek): number {
  const d = computeDistribution(w.sessions);
  if (!d || !Number.isFinite(d.easy) || !d.totalSeconds) return 0;
  return ((d.moderate + d.hard) * d.totalSeconds) / 60;
}

test("BLOCKER: every pre-race taper week carries the work its own event was built around", () => {
  // ⚠️ THE ORIGINAL DEFECT, STATED AS THE RUNNER MEETS IT. A half or marathon taper must contain
  // goal-pace work, because that is the gear the whole block was aimed at and the gear the race is
  // run in. A 5 km or 10 km taper must contain VO2 work, because for those events goal pace IS the
  // interval work — `paces.goalRace` sits on top of threshold/VO2 — and "3 × 10′ at goal race pace"
  // would be thirty minutes at 5 km pace, longer than the race itself.
  for (const distance of EVENTS) {
    const p = plan(distance, 1500);
    const taper = p.weeks.filter((w) => w.phase === "taper" && !isRaceWeek(w));
    assert.ok(taper.length >= 1, `${distance}: no pre-race taper week to inspect`);
    for (const w of taper) {
      const kinds = w.sessions.filter((s) => QUALITY.includes(s.type)).map((s) => s.type);
      assert.ok(kinds.length >= 1, `${distance} taper week ${w.index} has no quality session at all`);
      const wanted = distance === "half" || distance === "marathon" ? "race-specific" : "vo2";
      assert.ok(kinds.includes(wanted),
        `${distance} taper week ${w.index} carries [${kinds.join(", ")}] — it needs ${wanted} work, which is what this event's block was built around`);
    }
  }
});

test("BLOCKER: taper.ts's own notes are true as delivered", () => {
  // ⚠️ THIS IS THE GUARD THE DEFECT NEEDED. The notes promised "keep marathon-pace touches" and
  // "hold threshold intensity" for years while the code delivered one-minute VO2 reps to everybody,
  // and nothing compared the two. The claim is DERIVED from the note's own words rather than from a
  // hand-written table, so rewording a promise without delivering it fails here.
  for (const distance of EVENTS) {
    const note = taperFor(distance).notes.join(" ").toLowerCase();
    // ⚠️⚠️ BIDIRECTIONAL, BECAUSE "THE PROMISE IS KEPT" CAN BE SATISFIED BY DELETING THE PROMISE.
    // Watched escaping: removing "keep marathon-pace touches" from the marathon's note passed every
    // assertion below, since there was then nothing to check. That is the defect in its quietest
    // form — the behaviour and the description drifting apart by dropping the description — so the
    // note must MAKE a specificity claim, and the claim it makes must match what is delivered.
    assert.ok(/vo2|vo₂|threshold|race pace|race-pace|marathon-pace|marathon pace/.test(note),
      `${distance}'s taper note promises nothing about intensity: "${note}". A taper that does not say what work it keeps is a taper nobody can hold to account.`);
    const p = plan(distance, 1500);
    const taperQuality = p.weeks
      .filter((w) => w.phase === "taper")
      .flatMap((w) => w.sessions.filter((s) => QUALITY.includes(s.type)));
    assert.ok(taperQuality.length >= 1, `${distance}: the taper carries no quality session`);
    const types = new Set(taperQuality.map((s) => s.type));

    if (/vo2|vo₂/.test(note))
      assert.ok(types.has("vo2"), `${distance}'s note promises VO2 touches; the taper delivers [${[...types].join(", ")}]`);
    // ⚠️ AND THE OTHER DIRECTION: whatever the taper DELIVERS must be named. A taper quietly switched
    // to race-pace work under a note that only mentions VO2 is the same drift running the other way.
    if (types.has("race-specific"))
      assert.ok(/race pace|race-pace|marathon-pace|marathon pace|threshold/.test(note),
        `${distance}'s taper delivers race-pace work and its note does not mention it: "${note}"`);
    if (types.has("vo2") && !types.has("race-specific"))
      assert.ok(/vo2|vo₂|threshold/.test(note),
        `${distance}'s taper delivers VO2 work and its note does not mention it: "${note}"`);
    if (/race pace|race-pace|marathon-pace|marathon pace/.test(note))
      assert.ok(types.has("race-specific"),
        `${distance}'s note promises race-pace touches; the taper delivers [${[...types].join(", ")}]`);
    // ⚠️ "threshold/VO2" IS A DISJUNCTION AND THE GUARD HAD READ IT AS A CONJUNCTION. The 10k's note
    // says "keep threshold/VO2 intensity", which either kind of work satisfies — demanding threshold
    // there failed on correct code and would have pushed the fix towards giving a 10 km runner a
    // threshold session in race week for the sake of a slash in a sentence.
    const eitherWillDo = /threshold\s*\/\s*vo2|vo2\s*\/\s*threshold/.test(note);
    if (/threshold/.test(note) && !(eitherWillDo && types.has("vo2"))) {
      // ⚠️ SATISFIED IN SUBSTANCE, NOT BY A LABEL. For a half, goal pace sits 5–8 s/km slower than
      // threshold and the two BANDS OVERLAP — measured across abilities — so a goal-pace session IS
      // a threshold session in all but name. Requiring a session literally typed "threshold" would
      // fail on correct code and would push the fix towards a session the event does not want. What
      // the guard checks is that the delivered work really is at or near threshold.
      const hasThresholdLabel = types.has("threshold");
      const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 }, goalFor(distance, 1500));
      const goalIsThresholdish = paces.goalRace.minSecPerKm <= paces.threshold.maxSecPerKm + 2;
      void 0;
      assert.ok(hasThresholdLabel || (types.has("race-specific") && goalIsThresholdish),
        `${distance}'s note promises threshold intensity, and the taper delivers [${[...types].join(", ")}] `
        + `with a goal band of ${paces.goalRace.minSecPerKm}-${paces.goalRace.maxSecPerKm} against a threshold band of `
        + `${paces.threshold.minSecPerKm}-${paces.threshold.maxSecPerKm} s/km — that is not threshold work`);
    }
  }
});

test("BLOCKER: race week keeps the by-id session, and it is the smallest of the taper", () => {
  // ⚠️ TWO SEPARATE REASONS, BOTH LOAD-BEARING. `taperSession` is chosen BY ID rather than by a
  // rotation index because it used to be `vo2Session(p, 3)` — positional, so inserting any format
  // above index 3 silently changed the race-week session of every plan ever generated. Race week is
  // the worst possible week for a surprise. And it must be the SMALLEST dose in the taper, because
  // the evidence has the taper progressive rather than a step: bigger then smaller as the race
  // approaches. A flat taper is the shape the meta-analysis found worse (SMD -0.51).
  for (const distance of EVENTS) {
    const p = plan(distance, 1500);
    const taper = p.weeks.filter((w) => w.phase === "taper");
    const race = taper.find(isRaceWeek);
    assert.ok(race, `${distance}: no race week found in the taper`);
    const raceQuality = race!.sessions.filter((s) => QUALITY.includes(s.type));
    assert.equal(raceQuality.length, 1, `${distance}: race week carries ${raceQuality.length} quality sessions`);
    assert.equal(raceQuality[0]!.title, "10 × 1′ hard / 1′ easy",
      `${distance}: race week's sharpener is "${raceQuality[0]!.title}" — the by-id guarantee is gone`);

    // ⚠️ THE PROGRESSION IS ABOUT THE WEEK'S VOLUME, NOT THIS SESSION'S LENGTH, and asserting the
    // latter failed on correct code: the 10k's pre-race session is a 38-minute Mona fartlek against
    // race week's 44-minute `10 × 1′`, so the SESSION grows while the WEEK falls. Both are fine — the
    // multipliers are what carry the progressive shape, and they are asserted in their own test.
  }
});

test("BLOCKER: the taper's session comes from the peak's pool, and never a big format", () => {
  // ⚠️ THE POOL MUST BE NAMED, NOT LEFT TO A FALLBACK. No quality format lists "taper" in its
  // `phases`, so a `phase: "taper"` filter empties the list and `narrow` silently hands back the
  // WHOLE pool — big formats included. Asking for the peak's pool is both what "hold the
  // specificity" means and the only way the size preference can bind at all.
  const src = readFileSync(new URL("../src/plan/generate-plan.ts", import.meta.url), "utf8");
  const i = src.indexOf('if (wp.phase === "taper") {');
  assert.ok(i > 0, "the taper branch has moved");
  const branch = src.slice(i, src.indexOf('if (wp.phase === "peak")', i));
  assert.ok(/phase: "peak"/.test(branch),
    "the taper branch no longer asks for the peak's pool, so it is relying on narrow() falling back");
  assert.ok(/isDeload: true|avoidBig: true/.test(branch),
    "the taper branch no longer reduces the dose, so it can draw a full-size peak session");

  // And the behavioural half: nothing marked "big" reaches a taper week, at any ability.
  const BIG = new Set(["8 × 1 km at goal race pace / 60″ jog", "4 × 2 km at goal race pace / 90″ jog",
    "2 × 5 km at goal race pace / 5′ jog", "15′ easy → 20′ at goal pace → 10′ threshold",
    "5 km time trial — or race a parkrun"]);
  // ⚠️ THE BAR IS SET FROM WHAT THE SWEEP MEASURES, NOT PICKED. Written at "> 100" against a grid of
  // 4 events x 4 abilities x 2 experience levels it failed at 72 — one or two taper weeks per plan is
  // simply what a plan has. Widening the grid is the fix rather than lowering the bar, because a
  // sweep that only just clears its own floor is one change away from proving nothing.
  let seen = 0;
  for (const distance of EVENTS)
    for (const fiveK of [900, 1500, 2100, 2400])
      for (const daysPerWeek of [3, 5, 6])
      for (const experience of ["recreational", "competitive"] as const) {
        const p = plan(distance, fiveK, { experience, daysPerWeek });
        for (const w of p.weeks.filter((x) => x.phase === "taper"))
          for (const s of w.sessions.filter((x) => QUALITY.includes(x.type))) {
            seen++;
            assert.ok(!BIG.has(s.title),
              `${distance} ${(fiveK / 60) | 0}min ${daysPerWeek}d ${experience}: taper week ${w.index} drew the big format "${s.title}"`);
          }
      }
  assert.ok(seen > 100, `only ${seen} taper quality sessions measured — the sweep proves little`);
});

test("BLOCKER: holding the quality has not stopped the taper cutting the week", () => {
  // ⚠️ THIS IS THE COST THE FIX HAD TO PAY FOR, AND IT IS WHY THE MULTIPLIERS MOVED. A taper session
  // drawn from the peak's pool is bigger than the `vo2-10x1` it replaced — about 24 minutes more for
  // a half — so the delivered volume cut shrank, and the half fell to 29.1% against a 30% floor. The
  // evidence resolves it rather than leaving it: volume falls while intensity is MAINTAINED, and
  // "the volume cut comes entirely out of Z1-Z3". Deepening the lead-in multipliers is that
  // sentence, implemented. If a future change to a taper week eats the margin again, this fails
  // here rather than in a test about something else.
  for (const distance of EVENTS) {
    const p = plan(distance, 1260, { experience: "recreational", returningFromInjury: false });
    const peakKm = Math.max(...p.weeks.filter((w) => !isRaceWeek(w)).map((w) => w.plannedDistanceMeters)) / 1000;
    const taper = p.weeks.filter((w) => w.phase === "taper");
    const lastFull = taper.length > 1 ? taper[taper.length - 2]! : taper[0]!;
    const cut = 1 - lastFull.plannedDistanceMeters / 1000 / peakKm;
    assert.ok(cut >= 0.30 && cut <= 0.60,
      `${distance}: last full taper week cuts ${(cut * 100).toFixed(1)}% — outside the 30-60% window`);
  }
  // ⚠️ AND THE TAPER MUST STAY PROGRESSIVE. A lead-in multiplier deepened past its own race week
  // makes the taper flat, which is the "step" shape the meta-analysis found worse than a progressive
  // one (SMD -0.51). The 5k came within one sweep step of exactly that.
  for (const distance of EVENTS) {
    const m = taperFor(distance).volumeMultiplierByWeek;
    for (let i = 1; i < m.length; i++)
      assert.ok(m[i]! < m[i - 1]!,
        `${distance}: taper multipliers [${m.join(", ")}] do not fall week on week — that is a step, not a taper`);
  }
});

test("the taper's quality is no longer cut far harder than its volume", () => {
  // The shape of the original defect in one number. The evidence has the volume cut coming out of
  // the easy running, so quality should NOT be cut dramatically harder than the week as a whole.
  // Measured before the fix: volume cut 24-33% against quality cut 71-92%, i.e. quality cut 38 to 66
  // points harder. This bounds that gap rather than demanding they match — one quality session in a
  // taper week genuinely is less than the two a peak week carries, and that is correct coaching.
  let worstGap = 0;
  let who = "";
  for (const distance of EVENTS) {
    const p = plan(distance, 1500);
    const pre = p.weeks.filter((w) => w.phase !== "taper" && !w.isDeload);
    const peakV = Math.max(...pre.map((w) => w.plannedDistanceMeters)) / 1000;
    const peakQ = Math.max(...pre.map(nonEasyMinutes));
    for (const w of p.weeks.filter((x) => x.phase === "taper" && !isRaceWeek(x))) {
      const vCut = 100 * (1 - w.plannedDistanceMeters / 1000 / peakV);
      const qCut = 100 * (1 - nonEasyMinutes(w) / peakQ);
      const gap = qCut - vCut;
      if (gap > worstGap) { worstGap = gap; who = `${distance} week ${w.index} (volume -${vCut.toFixed(0)}%, quality -${qCut.toFixed(0)}%)`; }
    }
  }
  assert.ok(worstGap <= 55,
    `quality is cut ${worstGap.toFixed(0)} points harder than volume — ${who}. Before the fix the worst was 66; a regression past 55 means the taper is discarding its quality again.`);
});
