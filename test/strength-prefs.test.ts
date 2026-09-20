/**
 * STRENGTH PREFERENCES: THE QUESTIONS RUNNA ASKS, AND A PLAN THAT ANSWERS THEM.
 *
 * Stage A3. The app asked one Yes/No and built two fixed sessions of seven fixed exercises under a
 * literal "45 minutes" that, measured against the rests it prescribes, takes about sixty-seven. Runna
 * asks for a number up to four, a length, a level, a focus and an equipment list. This file is the
 * evidence that each of those five answers reaches the plan, and — the claim that matters most — that
 * a runner who has answered NONE of them still gets exactly the plan they had yesterday.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Athlete, Goal, RaceDistanceKey, StrengthPrefs } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildPlanSummary } from "../src/view/plan-summary.ts";
import { STRENGTH_MAX_PER_WEEK, strengthSessionsFor } from "../src/domain/strength-days.ts";
import { EQUIPMENT, EXERCISES, canDo } from "../src/strength/library.ts";
import { MAINTENANCE_MIN_FRAC, STRENGTH_LEVELS, STRENGTH_GOALS, STRENGTH_MINUTES, buildStrength } from "../src/strength/builder.ts";
import { RACE_DISTANCES_M } from "../src/domain/units.ts";

const START = "2026-09-07"; // a Monday, so no pro-rata first week muddies a comparison
const DISTANCES: RaceDistanceKey[] = ["5k", "10k", "half", "marathon"];

function raceDateFor(startIso: string, weeks: number): string {
  const d = new Date(startIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7 - 1);
  return d.toISOString().slice(0, 10);
}
const goalFor = (distance: RaceDistanceKey, fiveK: number, weeks: number): Goal => ({
  distance,
  targetTimeSeconds: fiveK * (RACE_DISTANCES_M[distance] / 5000) ** 1.06,
  raceDateIso: raceDateFor(START, weeks),
  startDateIso: START,
});
const runner = (o: Partial<Athlete> & { fiveK: number }): Athlete => ({
  daysPerWeek: o.daysPerWeek ?? 5,
  recent: { distanceMeters: 5000, timeSeconds: o.fiveK },
  experience: o.experience ?? "recreational",
  includeStrength: true,
  longRunDay: 6,
  ...o,
});
const prefs = (o: Partial<StrengthPrefs> = {}): StrengthPrefs => ({
  sessionsPerWeek: 2, minutes: 45, level: "intermediate", goal: "running", equipment: [], ...o,
});

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/**
 * ⚠️ ANCHORED TO THE START OF A LINE. The app markup contains accept="image/*" — an unbalanced
 * comment opener mid-line — so an unanchored sweep opens there and eats 10,382 characters of live
 * code. CLAUDE.md records that measurement; every guard file here carries the same anchored form.
 */
const nocomment = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");
/** One function of the built page, brace-matched. A character window is not a function. */
function fnOf(name: string): string {
  const at = APP.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return nocomment(APP.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}

type Wk = { index: number; phase: string; isDeload: boolean; sessions: Array<{ type: string; dayOfWeek: number; estimatedDurationSeconds: number; exercises?: Array<{ id: string; contacts?: number; restSeconds?: number }> }> };
const strengthOf = (w: Wk) => w.sessions.filter((s) => s.type === "strength");
const planHash = (p: { weeks: unknown[] }) => createHash("sha256").update(JSON.stringify(p.weeks)).digest("hex");

// ---------------------------------------------------------------------------------------------
// 1. The property that protects every runner who has not answered
// ---------------------------------------------------------------------------------------------

test("BLOCKER: with no preferences the plan still builds the session, and places it, exactly as it shipped", () => {
  // ⚠️⚠️ THE weeklyVolumeKm: 30 RULE. That field sat in the stored profile at a number nobody chose
  // and, the day something started reading it, would have rebuilt every existing runner's block on
  // the first boot after the update with no tap: measured then, a half-marathon peak week 55 -> 40 km
  // and a competitive marathoner's long run halved. A brand-new key cannot be pre-filled from
  // history, so ABSENT has to keep meaning exactly what it meant before the key existed.
  //
  // ⚠️ THE SHIPPED SESSION IS WRITTEN OUT HERE RATHER THAN HASHED. A golden hash fails on any engine
  // change at all, so its failures mean "something moved" rather than "something is wrong" — which is
  // how a baseline gets re-blessed without being read (CLAUDE.md records rejecting exactly that for
  // the share card). And comparing the legacy path against itself proves nothing: the first version
  // of this test built the same athlete twice, once with `strength: undefined`, which the code
  // handles on the same branch. Restated as the list, the order, the sets, the reps, the load and the
  // two days — the things a runner would notice.
  const heavyWeek = (p: { weeks: unknown[] }) => (p.weeks as Wk[]).find((w) => w.phase === "build" && !w.isDeload)!;
  for (const longRunDay of [0, 2, 3, 6]) {
    const a = runner({ fiveK: 1500, longRunDay });
    const plan = generatePlan(a, goalFor("half", 1500, 18));
    const w = heavyWeek(plan);
    const st = strengthOf(w);
    assert.equal(st.length, 2, "a build week no longer carries the two strength sessions it shipped with");
    // Placement: the first quality day and the first easy day, relative to the long run.
    assert.deepEqual(st.map((s) => s.dayOfWeek).sort((x, y) => x - y),
      [(longRunDay + 2) % 7, (longRunDay + 3) % 7].sort((x, y) => x - y),
      "the shipped placement moved for a runner who answered nothing");
    for (const s of st) {
      assert.deepEqual((s.exercises ?? []).map((e) => e.id),
        ["squat", "splitSquat", "rdl", "calf", "soleus", "stepUp", "plank", "pogo", "boxjump"],
        "the shipped exercise list changed for a runner who answered nothing");
      const by = Object.fromEntries((s.exercises ?? []).map((e) => [e.id, e as Record<string, unknown>]));
      assert.equal(by.squat!.sets, 3); assert.equal(by.squat!.reps, "3–6 (heavy)");
      assert.equal(by.squat!.loadPercent1RM, "80%+"); assert.equal(by.stepUp!.loadPercent1RM, undefined);
      assert.equal(by.calf!.reps, "8–12"); assert.equal(by.plank!.sets, 2);
      assert.equal(s.estimatedDurationSeconds, 45 * 60, "the shipped 45-minute label changed");
    }
    // And an explicitly-undefined preference object is the same state as no key at all — which is
    // what a stored profile written before this stage produces.
    assert.equal(planHash(generatePlan({ ...a, strength: undefined }, goalFor("half", 1500, 18))),
      planHash(plan), "an undefined preference object is not the same as no preference object");
  }
});

test("BLOCKER: the count rule reproduces the two literals it replaced, phase for phase", () => {
  // The old rules, written out here as the thing being reproduced rather than imported — a guard
  // comparing the new code against itself proves nothing.
  const legacyMain = (phase: string, isDeload: boolean, ord: number) =>
    phase === "taper" ? (ord === 1 ? 1 : 0) : (phase === "peak" || isDeload) ? 1 : 2;
  const legacyBeginner = (phase: string, isDeload: boolean, days: number) =>
    days >= 4 && !(isDeload || phase === "taper") ? 2 : 1;
  for (const phase of ["base", "build", "peak", "taper"] as const) {
    for (const isDeload of [false, true]) {
      for (const ordinalInPhase of [1, 2, 3]) {
        for (const daysPerWeek of [3, 4, 6]) {
          const wk = { phase, isDeload, ordinalInPhase };
          assert.equal(
            strengthSessionsFor({ includeStrength: true, experience: "recreational", daysPerWeek }, wk),
            legacyMain(phase, isDeload, ordinalInPhase),
            "the main-track legacy rule drifted at " + phase + "/" + isDeload + "/" + ordinalInPhase);
          assert.equal(
            strengthSessionsFor({ includeStrength: true, experience: "beginner", daysPerWeek }, wk),
            legacyBeginner(phase, isDeload, daysPerWeek),
            "the beginner legacy rule drifted at " + phase + "/" + daysPerWeek);
        }
      }
    }
  }
  // ⚠️ AND OFF MEANS OFF, WITH OR WITHOUT AN ANSWER. Zero sessions and includeStrength: false have to
  // be the same answer, or the old switch and the new count could disagree about one runner.
  for (const p of [undefined, prefs({ sessionsPerWeek: 3 })]) {
    assert.equal(strengthSessionsFor(
      { includeStrength: false, experience: "recreational", daysPerWeek: 5, strength: p },
      { phase: "build", isDeload: false, ordinalInPhase: 1 }), 0, "the off switch was ignored");
  }
  assert.equal(strengthSessionsFor(
    { includeStrength: true, experience: "recreational", daysPerWeek: 5, strength: prefs({ sessionsPerWeek: 0 }) },
    { phase: "build", isDeload: false, ordinalInPhase: 1 }), 0, "zero sessions a week still built one");
});

test("BLOCKER: an answer of two reproduces the shipped counts in every phase, so migrating the old Yes moves nobody", () => {
  // ⚠️ THIS IS WHY THE PEAK RULE IS max(1, req - 1) CAPPED AT TWO RATHER THAN min(req, 2). The old
  // control was a boolean and the plan it built carries two sessions in base and build and ONE in
  // peak; a flat cap at two would have quietly added a peak session to every runner whose Yes became
  // a 2. Peak drops one relative to base and build — which is the coaching reason the old literal
  // hardcoded — and the arithmetic falls out of it.
  const two = prefs({ sessionsPerWeek: 2 });
  for (const phase of ["base", "build", "peak", "taper"] as const) {
    for (const isDeload of [false, true]) {
      for (const ordinalInPhase of [1, 2]) {
        const wk = { phase, isDeload, ordinalInPhase };
        const a = { includeStrength: true, experience: "recreational" as const, daysPerWeek: 5 };
        assert.equal(strengthSessionsFor({ ...a, strength: two }, wk), strengthSessionsFor(a, wk),
          "an answer of two differs from the shipped Yes at " + phase + "/" + isDeload + "/" + ordinalInPhase);
      }
    }
  }
  // Monotone in the answer: asking for more never delivers less, in any phase.
  for (const phase of ["base", "build", "peak", "taper"] as const) {
    for (const isDeload of [false, true]) {
      let prev = -1;
      for (let n = 0; n <= STRENGTH_MAX_PER_WEEK; n++) {
        const got = strengthSessionsFor(
          { includeStrength: true, experience: "recreational", daysPerWeek: 5, strength: prefs({ sessionsPerWeek: n }) },
          { phase, isDeload, ordinalInPhase: 1 });
        assert.ok(got >= prev, "asking for " + n + " delivers fewer than asking for " + (n - 1) + " in " + phase);
        prev = got;
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// 2. The plan built from the answers
// ---------------------------------------------------------------------------------------------

test("BLOCKER: every week delivers the count the one definition asks for, at every long-run day and distance", () => {
  let weeks = 0;
  for (const distance of DISTANCES) {
    for (const longRunDay of [0, 1, 2, 3, 4, 5, 6]) {
      for (const sessionsPerWeek of [0, 1, 2, 3, 4]) {
        const a = runner({ fiveK: 1500, longRunDay, strength: prefs({ sessionsPerWeek }) });
        const plan = generatePlan(a, goalFor(distance, 1500, 18));
        for (const w of plan.weeks as Wk[]) {
          // Race week is the race; applyRaceDay clears everything after it, so the count rule does
          // not describe it.
          if (w.index === plan.weeks.length) continue;
          const want = strengthSessionsFor(a, { phase: w.phase as never, isDeload: w.isDeload, ordinalInPhase: ordinalOf(plan.weeks as Wk[], w) });
          assert.equal(strengthOf(w).length, want,
            distance + " lrd" + longRunDay + " n" + sessionsPerWeek + " week " + w.index + " built " + strengthOf(w).length + " strength sessions, not " + want);
          weeks++;
        }
      }
    }
  }
  assert.ok(weeks >= 2000, "the sweep proves little at " + weeks + " weeks");
});

/** The week's 1-based position within its phase — what the taper rule reads. */
function ordinalOf(weeks: Wk[], w: Wk): number {
  let n = 0;
  for (const x of weeks) { if (x.phase === w.phase) n++; if (x === w) break; }
  return n;
}

test("BLOCKER: the session fits the time the runner said they had", () => {
  // ⚠️ THE OLD LABEL WAS A DECORATION. A literal minutes = maintenance ? 30 : 45 sat beside a fixed
  // list of seven exercises plus the plyometric dose; at the rests that session prescribes it takes
  // about sixty-seven minutes. Somebody who tells us they have thirty cannot be handed that.
  //
  // ⚠️ THE ANSWER IS A CEILING, WHICH IS WHY THE TWO DIRECTIONS ARE JUDGED DIFFERENTLY. Over is a
  // session the runner cannot finish; under is a session that ended. A beginner's whole spine at two
  // sets is thirty-three minutes, and padding it to reach a forty-five-minute answer would be
  // inventing work to match a number.
  const derived: Record<string, number> = {};
  let n = 0, shortest = 1;
  for (const minutes of STRENGTH_MINUTES) {
    for (const level of STRENGTH_LEVELS) {
      for (const goal of STRENGTH_GOALS) {
        for (const experience of ["recreational", "competitive"] as const) {
          const a = runner({ fiveK: 1500, experience, strength: prefs({ sessionsPerWeek: 3, minutes, level: level.id, goal: goal.id, equipment: [...EQUIPMENT] }) });
          const plan = generatePlan(a, goalFor("half", 1500, 18));
          for (const w of plan.weeks as Wk[]) {
            const maintenance = w.phase === "peak" || w.phase === "taper";
            const want = maintenance ? Math.round(minutes * MAINTENANCE_MIN_FRAC) : minutes;
            for (const s of strengthOf(w)) {
              const got = Math.round(s.estimatedDurationSeconds / 60);
              assert.ok(got - want <= 3,
                minutes + "min/" + level.id + "/" + goal.id + " week " + w.index + " built a " + got + "-minute session against a " + want + "-minute ceiling");
              shortest = Math.min(shortest, got / want);
              if (!maintenance && experience === "recreational") derived[minutes + "/" + level.id + "/" + goal.id + "/" + w.phase] = got;
              n++;
            }
          }
        }
      }
    }
  }
  assert.ok(n > 200, "the sweep proves little at " + n + " sessions");
  // ⚠️ THE FLOOR IS A MEASUREMENT, NOT A TASTE. Swept over 1,800 reachable combinations of length,
  // level, focus, phase, maintenance, experience and kit, the lowest fill is 55.4% and the worst
  // overshoot 1.83 minutes — the longest answer at the lowest set count, where the whole spine is
  // genuinely used up. A bound chosen to make today's output pass would sit just under whatever came
  // out; this one is the measured extreme with the case named beside it.
  assert.ok(shortest >= 0.5, "a session came in at " + Math.round(shortest * 100) + "% of the time asked for");

  // ⚠️ AND THE ANSWER GENUINELY MOVES THE SESSION, or the question is decoration of a different kind.
  // Monotone: more time never builds a shorter session, at every level, focus and phase.
  const keys = new Set(Object.keys(derived).map((k) => k.split("/").slice(1).join("/")));
  assert.ok(keys.size >= 12, "only " + keys.size + " level/focus/phase combinations were measured");
  for (const k of keys) {
    let prev = 0, moved = false;
    for (const m of STRENGTH_MINUTES) {
      const got = derived[m + "/" + k];
      if (got == null) continue;
      assert.ok(got >= prev, k + ": asking for " + m + " minutes built a shorter session than asking for less");
      if (got > prev && prev > 0) moved = true;
      prev = got;
    }
    assert.ok(moved, k + ": every length answer built the same session, so the question changes nothing");
  }
});

test("BLOCKER: a short session drops sets, never movements — three lifts is the floor", () => {
  // ⚠️ THE SETS GIVE WAY BEFORE THE MOVEMENTS DO, and without that rule a thirty-minute ADVANCED
  // build session comes out as ONE exercise: measured, "squat x4" plus the jumps, 23 minutes. Four
  // sets of a squat is not a strength session for a runner. Squat, single-leg and hinge are the three
  // the spine opens with and the three that have to survive; the set count is what the clock takes.
  // Measured across 1,440 reachable combinations the floor is exactly three; with the set cap removed
  // it is one.
  let fewest = 99, at = "";
  for (const minutes of STRENGTH_MINUTES) {
    for (const level of STRENGTH_LEVELS) {
      for (const goal of STRENGTH_GOALS) {
        for (const experience of ["recreational", "competitive"] as const) {
          for (const kit of [[], ["dumbbell", "bench"], [...EQUIPMENT]]) {
            const a = runner({ fiveK: 1500, experience, strength: prefs({ sessionsPerWeek: 2, minutes, level: level.id, goal: goal.id, equipment: kit as never }) });
            for (const w of generatePlan(a, goalFor("half", 1500, 18)).weeks as Wk[]) {
              for (const s of strengthOf(w)) {
                const lifts = (s.exercises ?? []).filter((e) => e.contacts == null).length;
                if (lifts < fewest) { fewest = lifts; at = minutes + "/" + level.id + "/" + goal.id + "/" + w.phase + "/" + kit.length + "kit"; }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(fewest >= 3, "a session came down to " + fewest + " exercises at " + at);
});

test("BLOCKER: an hour buys a longer session than half an hour, not the same one", () => {
  // ⚠️ THE DISCRIMINATING CASE, FOUND BY SWEEPING RATHER THAN CHOSEN. Most combinations run out of
  // spine or sit at a set count the clock cannot move, so the grid minimum barely separates the two
  // (3.3 minutes against 1.2). Intermediate, running focus, technique phase is where it bites: the
  // whole spine at two sets is thirty minutes, so without the clock raising the set count a runner
  // who says they have an hour gets the same thirty-minute session as one who says they have half.
  const at = (minutes: number) => buildStrength({
    phase: "base", maintenance: false, competitive: false, plyo: false,
    prefs: prefs({ sessionsPerWeek: 2, minutes, level: "intermediate", goal: "running", equipment: [...EQUIPMENT] }),
  });
  const half = at(30), hour = at(60);
  const topSets = (b: { exercises: Array<{ sets: number }> }) => Math.max(...b.exercises.map((e) => e.sets));
  assert.equal(topSets(half), 2, "the thirty-minute session no longer sits at two sets");
  assert.ok(topSets(hour) > topSets(half),
    "an hour prescribes " + topSets(hour) + " sets, the same as half an hour — the length answer stops at the exercise count");
  assert.ok(hour.seconds / 60 >= 45,
    "an hour built a " + Math.round(hour.seconds / 60) + "-minute session with room to spare");
});

test("BLOCKER: nothing is prescribed that the runner does not have", () => {
  const kits: Array<{ owned: string[]; label: string }> = [
    { owned: [], label: "nothing ticked" },
    { owned: ["bodyweight"], label: "bodyweight" },
    { owned: ["bands"], label: "a band" },
    { owned: ["dumbbell", "bench"], label: "dumbbells and a bench" },
    { owned: ["barbell", "box", "pullUpBar"], label: "a barbell, a box and a bar" },
  ];
  for (const kit of kits) {
    for (const level of STRENGTH_LEVELS) {
      const a = runner({ fiveK: 1500, strength: prefs({ sessionsPerWeek: 4, minutes: 60, level: level.id, goal: "allRound", equipment: kit.owned as never }) });
      const plan = generatePlan(a, goalFor("half", 1500, 18));
      let seen = 0;
      for (const w of plan.weeks as Wk[]) {
        for (const s of strengthOf(w)) {
          for (const e of s.exercises ?? []) {
            const d = EXERCISES[e.id];
            assert.ok(d, "the plan prescribed " + e.id + ", which is not in the catalogue");
            assert.ok(canDo(d!, kit.owned as never, level.id),
              kit.label + " at " + level.id + " was prescribed " + e.id + " (" + d!.equipment.join("/") + ", " + d!.minLevel + ")");
            seen++;
          }
        }
      }
      assert.ok(seen > 0, kit.label + " at " + level.id + " produced no exercises at all");
    }
  }
});

test("BLOCKER: heavy legs never sit the day before the long run or the day before the first quality session", () => {
  // ⚠️ THE APP'S OWN PUBLISHED RULE, which Ask Alfie has been giving runners for a year: "Put it on a
  // quality day or after an easy run, not the day before a hard session." Sharing a hard day is the
  // point; the evening before is what spends the same legs twice.
  const QUALITY = new Set(["threshold", "vo2", "race-specific"]);
  /** How far after the long run a day falls, which is the order the week is actually built in. */
  const rel = (d: number, longRunDay: number) => (d - longRunDay + 7) % 7;
  let checked = 0, eves = 0;
  for (const longRunDay of [0, 1, 2, 3, 4, 5, 6]) {
    for (const sessionsPerWeek of [1, 2, 3, 4]) {
      for (const distance of DISTANCES) {
        const a = runner({ fiveK: 1500, longRunDay, strength: prefs({ sessionsPerWeek }) });
        const plan = generatePlan(a, goalFor(distance, 1500, 18));
        const longEve = (longRunDay + 6) % 7;
        for (const w of plan.weeks as Wk[]) {
          if (w.index === plan.weeks.length) continue; // race week: applyRaceDay owns it
          const heavy = w.phase === "build";
          // ⚠️ FIRST IN TRAINING ORDER, NOT THE LOWEST WEEKDAY NUMBER — a fact about the built week
          // rather than about the placement constants. With a Thursday long run the quality days are
          // Saturday and Monday, and the week's FIRST hard session is the Saturday.
          const quality = w.sessions.filter((s) => QUALITY.has(s.type)).map((s) => s.dayOfWeek)
            .sort((x, y) => rel(x, longRunDay) - rel(y, longRunDay));
          const qEve = quality.length ? (quality[0]! + 6) % 7 : -1;
          const perDay = new Map<number, number>();
          for (const s of strengthOf(w)) {
            assert.notEqual(s.dayOfWeek, longRunDay,
              "lrd" + longRunDay + " week " + w.index + " put strength on the long-run day");
            if (heavy) {
              assert.notEqual(s.dayOfWeek, longEve,
                "lrd" + longRunDay + " week " + w.index + " put a heavy session the day before the long run");
              assert.notEqual(s.dayOfWeek, qEve,
                "lrd" + longRunDay + " week " + w.index + " put a heavy session the day before the first quality session");
              eves++;
            }
            perDay.set(s.dayOfWeek, (perDay.get(s.dayOfWeek) ?? 0) + 1);
            checked++;
          }
          for (const [d, n] of perDay) {
            assert.equal(n, 1, "lrd" + longRunDay + " week " + w.index + " stacked " + n + " strength sessions on day " + d);
          }
        }
      }
    }
  }
  assert.ok(checked > 500, "the sweep proves little at " + checked + " sessions");
  assert.ok(eves > 100, "only " + eves + " heavy sessions were reached — the eve rule is barely exercised");
});

test("BLOCKER: the weekly plyometric dose stays inside the evidenced band however many sessions are asked for", () => {
  // Bands from the commissioned handoff: 60-100 ground contacts a week developing, 100-150 trained.
  // ⚠️ THE CAP IS ON THE NUMBER OF SESSIONS CARRYING THE DOSE, NOT ON THE DOSE ITSELF. Four sessions
  // each carrying the shipped dose is 180 contacts; scaling every one of them down instead would give
  // four token plyometric sessions rather than two real ones.
  for (const [experience, band] of [["recreational", [60, 100]], ["competitive", [100, 150]]] as const) {
    for (const sessionsPerWeek of [2, 3, 4]) {
      const a = runner({ fiveK: 1500, experience, strength: prefs({ sessionsPerWeek, minutes: 60, equipment: [...EQUIPMENT] }) });
      const plan = generatePlan(a, goalFor("half", 1500, 20));
      const build = (plan.weeks as Wk[]).filter((w) => w.phase === "build" && !w.isDeload);
      assert.ok(build.length >= 3, "only " + build.length + " loading build weeks — the sweep proves little");
      for (const w of build) {
        const withPlyo = strengthOf(w).filter((s) => (s.exercises ?? []).some((e) => e.contacts != null));
        assert.ok(withPlyo.length <= 2,
          "week " + w.index + " put jumps in " + withPlyo.length + " sessions at " + sessionsPerWeek + " a week");
        const c = strengthOf(w).reduce((a2, s) => a2 + (s.exercises ?? []).reduce((x, e) => x + (e.contacts ?? 0), 0), 0);
        assert.ok(c >= band[0] && c <= band[1],
          experience + " at " + sessionsPerWeek + "/week, build week " + w.index + " delivers " + c + " contacts, outside " + band[0] + "-" + band[1]);
      }
    }
  }
});

test("rest is prescribed on every exercise a preference-driven session builds, and on none the legacy path builds", () => {
  // ⚠️ REST IS PART OF THE PRESCRIPTION AND IT IS WHAT MAKES THE DURATION HONEST. It is also the field
  // that must NOT appear on a legacy session: gaining one would change what its "45 minutes" means
  // for a runner who answered nothing.
  const withPrefs = generatePlan(runner({ fiveK: 1500, strength: prefs() }), goalFor("half", 1500, 18));
  const legacy = generatePlan(runner({ fiveK: 1500 }), goalFor("half", 1500, 18));
  let a = 0, b = 0;
  for (const w of withPrefs.weeks as Wk[]) for (const s of strengthOf(w)) for (const e of s.exercises ?? []) {
    assert.ok(typeof e.restSeconds === "number" && e.restSeconds > 0, e.id + " carries no rest");
    a++;
  }
  for (const w of legacy.weeks as Wk[]) for (const s of strengthOf(w)) for (const e of s.exercises ?? []) {
    assert.equal(e.restSeconds, undefined, "a legacy session gained a rest figure on " + e.id);
    b++;
  }
  assert.ok(a > 20 && b > 20, "one of the two paths produced almost nothing (" + a + "/" + b + ")");
});

// ---------------------------------------------------------------------------------------------
// 3. The questions on screen
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the form offers exactly the answers the plan tells apart, and nothing clamps them on the way in", () => {
  // ⚠️ THE DAYS QUESTION'S OWN RULING, APPLIED AGAIN. The picker offered a beginner 5, 6 and 7 while
  // the generator built 4, so the preview sheet said "Nothing about your plan changes" and was right.
  const q = fnOf("strengthQHtml");
  assert.match(q, /RC\.STRENGTH_MAX_PER_WEEK/, "the sessions picker types its own ceiling instead of asking the engine");
  assert.match(q, /RC\.STRENGTH_MINUTES\.map/, "the lengths on offer are typed rather than read from the engine");
  assert.match(q, /RC\.STRENGTH_LEVELS\.map/, "the levels on offer are typed rather than read from the engine");
  assert.match(q, /RC\.STRENGTH_GOALS\.map/, "the focus options are typed rather than read from the engine");
  assert.match(q, /RC\.EQUIPMENT\.map/, "the equipment list is typed rather than read from the engine");

  // ⚠️ AND THE ANSWER REACHES THE ENGINE RAW. Athlete carries what the runner said; what a week can
  // honour is strengthSessionsFor's job. test/running-days.test.ts pins the same rule for run days.
  const ap = fnOf("applyProfile");
  assert.doesNotMatch(ap, /strength:\s*RC\.strengthSessionsFor/, "the web layer is clamping the answer before the engine sees it");
  assert.match(ap, /if \(sPrefs\) ath\.strength = sPrefs;/, "preferences no longer reach the engine");
  const of$ = fnOf("strengthPrefsOf");
  assert.match(of$, /p\.strengthDays == null\) return null/,
    "an unanswered profile now produces a preference object, which moves every existing plan");
});

test("BLOCKER: the four detail questions are hidden where their answers reach nothing", () => {
  // A twenty-minute bodyweight routine is what both beginner tracks build, so length, level and
  // equipment change nothing there — and with no sessions asked for there is nothing to describe.
  const sync = fnOf("syncStrength");
  assert.match(sync, /isBeginnerStatus/, "a beginner status no longer hides the detail questions");
  assert.match(sync, /n > 0 && !beginner/, "the detail block no longer depends on a session being asked for");
  assert.match(sync, /strBegNote/, "nothing says why the questions are missing");
  // ⚠️ AND IT IS CALLED FROM BOTH PLACES THAT CAN CHANGE THE ANSWER. syncStatus is how a status card
  // changes the track; bindSegButtons is how the count changes. A control rebuilt or revealed by one
  // and not the other is the looks-live-does-nothing class this project has shipped three times.
  assert.match(fnOf("syncStatus"), /syncStrength\(\)/, "changing status leaves the detail block stale");
  assert.match(fnOf("bindSegButtons"), /"strength" \|\| s\.dataset\.set === "strlevel"/,
    "picking a number no longer reveals or hides the detail questions");
});

test("BLOCKER: the preview can see a strength session change shape, not only the tally", () => {
  // ⚠️ THIS SCREEN HAS SHIPPED THE SAME FALSEHOOD TWICE — once on the days question and once on the
  // strength toggle, both reported by the owner. Answering the length, level or equipment questions
  // can leave the number of sessions exactly where it was while replacing what is in them.
  const imp = fnOf("profileImpact");
  assert.match(imp, /Each strength session/, "the preview has no row for the session itself");
  assert.match(imp, /Strength & mobility sessions/, "the preview lost its session-count row");
  // ⚠️⚠️ AND IT MUST READ RAW. PLAN.weeks is a display summary whose sessions carry no exercises —
  // proved below rather than asserted — so a row counting them off PLAN compares nothing to nothing,
  // reports them equal, and prints "Your plan comes out the same either way". That is what the first
  // cut of this row did, and driving the screen is the only thing that found it: the guard itself
  // passed, because it measured the right computation on a source the screen does not use.
  const summary = buildPlanSummary(runner({ fiveK: 1500 }), goalFor("half", 1500, 18)) as unknown as { weeks: Wk[] };
  const anySummaryStrength = summary.weeks.flatMap((w) => strengthOf(w)).filter((s) => s.exercises != null);
  assert.equal(anySummaryStrength.length, 0,
    "the plan summary now carries exercises, so this guard no longer means anything — re-check what profileImpact reads");
  assert.match(imp, /strengthShape\(RAW\.weeks\)/, "the preview reads its live session shape from the display summary");
  assert.match(imp, /strengthShape\(out\.raw && out\.raw\.weeks\)/, "the preview reads its new session shape from the display summary");
  // Driven, with the real engine: the two things that row reports must genuinely move.
  const at = (n: number, minutes: number) => {
    const plan = generatePlan(runner({ fiveK: 1500, strength: prefs({ sessionsPerWeek: n, minutes }) }), goalFor("half", 1500, 18));
    const mid = (plan.weeks as Wk[])[Math.floor(plan.weeks.length / 2)]!;
    const s = strengthOf(mid)[0];
    return { count: mid.sessions.filter((x) => x.type === "strength" || x.type === "mobility").length,
      shape: s ? Math.round(s.estimatedDurationSeconds / 60) + "/" + (s.exercises ?? []).length : "" };
  };
  assert.notEqual(at(1, 45).count, at(4, 45).count, "sessions a week does not move the count row");
  assert.notEqual(at(2, 30).shape, at(2, 60).shape, "the length answer does not move the session row");
});

test("BLOCKER: the stored answer keeps its meaning, and the old Yes still means two", () => {
  // ⚠️ THE SAME DRAFT KEY CHANGED FROM A FLAG TO A COUNT. Seeding it from `strength ? 1 : 0` would
  // have silently halved a wizard runner's strength week, because "1" meant Yes yesterday and means
  // one session today. Both ends had to move in the same breath.
  const app = nocomment(APP);
  assert.doesNotMatch(app, /strength: profile\.strength \? "1" : "0"/,
    "the draft is still seeded with the old boolean, which now reads as one session a week");
  assert.match(app, /strength: String\(strengthDaysOf\(profile\)\)/, "the draft is no longer seeded from the count");
  const days = fnOf("strengthDaysOf");
  assert.match(days, /p\.strength\) \? 2 : 0/, "a legacy Yes no longer maps to the two sessions it used to build");
  // The boolean every other reader still uses is derived from the count, so off is off either way.
  assert.match(fnOf("draftFromForm"), /strength: strengthDays > 0/, "includeStrength is no longer derived from the count");
  // And the new fields are part of what defines a plan, or the journal would record a block it cannot rebuild.
  const fields = app.slice(app.indexOf("const PLAN_PROF_FIELDS"), app.indexOf("const PLAN_PROF_FIELDS") + 500);
  for (const f of ["strengthDays", "strengthMin", "strengthLevel", "strengthGoal", "strengthKit"]) {
    assert.ok(fields.includes('"' + f + '"'), f + " is missing from PLAN_PROF_FIELDS");
  }
});
