/**
 * A7 — STANDALONE STRENGTH PROGRAMMES.
 *
 * A programme is 4–12 weeks of blocks that progress — technique, loading, heavy, easing off every
 * fourth week — with an A/B(/C) rotation so two sessions in one week are not the same lifts. Its
 * sessions are DERIVED into EXTRA rather than stored there, so Today, the calendar, the session
 * sheet, the reminders and the watch payload all work through the path they already had; and while
 * one is running the plan schedules no strength of its own, so nobody is asked to lift twice.
 *
 * ⚠️⚠️ THE MOST VALUABLE FINDING HERE WAS A SWEEP THAT MEASURED NOTHING AND REPORTED CLEAN. A probe
 * comparing the card's set count against the built session's said "0 mismatches" across 288 cases —
 * and every one of those sessions had ZERO exercises, because the probe's fixture omitted
 * sessionsPerWeek, rotationIndex answered NaN, and `all[(NaN + i) % n]` is undefined for every slot.
 * The comparison was skipped 288 times and the zero read as a pass. With the shape fixed the two
 * genuinely disagreed in BOTH directions (a 20-minute advanced heavy week is prescribed 3 sets and
 * delivered 2; a 60-minute intermediate technique week is prescribed 2 and delivered 3), which is
 * what programmeWeekFor exists to reconcile. Both halves are guarded below: the sweep asserts it was
 * not vacuous, and pickForSlot refuses a non-finite rotation outright.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildPlanSummary } from "../src/view/plan-summary.ts";
import { strengthSessionsFor } from "../src/domain/strength-days.ts";
import { buildStrength } from "../src/strength/builder.ts";
import {
  buildProgrammeSession, programmeWeek, programmeWeekFor, programmeWeeks, programmeWeeksFor,
  isDeloadWeek, rotationIndex, rotationLabel, rotationSize,
  DELOAD_EVERY, PROGRAMME_WEEKS_MIN, PROGRAMME_WEEKS_MAX, PROGRAMME_SESSIONS_MAX,
  type ProgrammePrefs,
} from "../src/strength/programme.ts";
import type { Athlete, Goal, RaceDistanceKey } from "../src/domain/types.ts";

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
function constOf(name: string): string {
  const m = new RegExp("^const " + name + " = [^\\n]+$", "m").exec(APP);
  assert.ok(m, "const " + name + " is not declared on one line in the built page");
  return m![0]!;
}
function appBlock(): string {
  const blocks = [...APP.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const b = blocks.find((x) => x.includes("function progExtras("));
  assert.ok(b, "no emitted script block defines progExtras");
  return nocomment(b!);
}

const START = "2026-09-21";
const KIT = ["dumbbell", "kettlebell", "barbell", "bench", "box"] as ProgrammePrefs["equipment"];
const prefs = (o: Partial<ProgrammePrefs> = {}): ProgrammePrefs => ({
  sessionsPerWeek: 2, minutes: 45, level: "intermediate", goal: "running", equipment: KIT, ...o,
});

function athlete(o: Partial<Athlete> = {}): Athlete {
  return {
    daysPerWeek: 5, experience: "recreational", includeStrength: true,
    recent: { distanceMeters: 5000, timeSeconds: 1500 },
    longRunDay: 6, ...o,
  } as Athlete;
}
function goal(dist: RaceDistanceKey, raceDateIso: string): Goal {
  return { distance: dist, raceDateIso, startDateIso: START, targetTimeSeconds: dist === "5k" ? 1450 : dist === "10k" ? 3000 : dist === "half" ? 6600 : 14000 } as Goal;
}
/** The nth day on or after an ISO date. */
const nthDay = (iso: string, n: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
/** The day after an ISO date. */
const nextDay = (iso: string) => new Date(new Date(iso + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10);
/** The Monday on or before an ISO date. */
function monday(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------------------------------------
// 1. The blocks: what they prescribe, and what the runner is actually given
// ------------------------------------------------------------------------------------------------

test("BLOCKER: the blocks progress and every fourth week eases off", () => {
  const ws = programmeWeeks(12, "intermediate");
  assert.equal(ws.length, 12);
  assert.deepEqual(ws.map((w) => w.block),
    ["technique", "technique", "loading", "loading", "loading", "heavy", "heavy", "heavy", "heavy", "heavy", "heavy", "heavy"],
    "technique 1-2, loading 3-5, heavy 6+");
  // The reps get harder and never go back.
  const repRank: Record<string, number> = { "8–12": 0, "6–8": 1, "3–6": 2 };
  ws.forEach((w, i) => {
    if (i) assert.ok(repRank[w.reps]! >= repRank[ws[i - 1]!.reps]!,
      "week " + w.week + " went backwards: " + ws[i - 1]!.reps + " -> " + w.reps);
  });
  // ⚠️ THE DELOAD IS A DIP IN THE LOAD, NOT A CHANGE OF BLOCK. A week that dropped back to the
  // previous block's reps would be a different training week, not an easier version of this one.
  const deloads = ws.filter((w) => w.isDeload);
  assert.deepEqual(deloads.map((w) => w.week), [4, 8, 12], "every " + DELOAD_EVERY + "th week");
  deloads.forEach((w) => {
    assert.equal(w.reps, programmeWeek(w.week - 1, "intermediate").reps,
      "week " + w.week + " changed block as well as easing off");
    assert.ok(w.sets <= programmeWeek(w.week - 1, "intermediate").sets, "an ease-off week never adds a set");
  });
  assert.equal(isDeloadWeek(4), true);
  assert.equal(isDeloadWeek(5), false);
  assert.equal(isDeloadWeek(0), false, "there is no week zero to ease off");
});

test("BLOCKER: an ease-off week drops the load below the block it sits in", () => {
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    for (const w of [4, 8, 12]) {
      const here = programmeWeek(w, level);
      const prev = programmeWeek(w - 1, level);
      assert.ok(here.load && prev.load, "both weeks carry a load");
      const num = (s: string) => Number((s.match(/\d+/) || ["0"])[0]);
      assert.ok(num(here.load!) < num(prev.load!),
        level + " week " + w + ": " + prev.load + " -> " + here.load + " is not a drop");
    }
  }
});

test("BLOCKER: the card reports what the runner is actually given, at every length and level", () => {
  // ⚠️ THIS SWEEP EXISTS BECAUSE ITS FIRST VERSION WAS VACUOUS -- see the file header. `graded`
  // counts the cases where a main lift was genuinely produced and a comparison genuinely happened;
  // without it a builder returning nothing passes every assertion below.
  let graded = 0, built = 0;
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    for (const minutes of [20, 30, 45, 60] as const) {
      for (const g of ["running", "allRound"] as const) {
        for (const spw of [1, 2, 3]) {
          for (let w = 1; w <= 12; w++) {
            for (const slot of [0, 1, 2]) {
              const pf = prefs({ level, minutes, goal: g, sessionsPerWeek: spw });
              const s = buildProgrammeSession({ week: w, slot, prefs: pf });
              built++;
              assert.ok(s.exercises.length > 0,
                "empty session: " + [level, minutes, g, spw, w, slot].join("/"));
              const main = s.exercises.find((e) => e.loadPercent1RM);
              if (!main) continue;
              const card = programmeWeekFor(w, pf);
              graded++;
              assert.equal(main.sets, card.sets,
                "card says " + card.sets + " sets, session gives " + main.sets
                + " at " + [level, minutes, g, spw, "wk" + w].join("/"));
              assert.equal(main.reps, card.reps, "card and session disagree about reps");
            }
          }
        }
      }
    }
  }
  assert.ok(built >= 1000, "the sweep only built " + built + " sessions");
  assert.ok(graded >= 1000, "the sweep compared only " + graded + " cases -- it proved almost nothing");
});

test("BLOCKER: programmeWeeksFor is programmeWeekFor for every week, so one overview cannot disagree with the card", () => {
  const pf = prefs({ minutes: 60, level: "intermediate" });
  const all = programmeWeeksFor(8, pf);
  assert.equal(all.length, 8);
  all.forEach((w, i) => assert.deepEqual(w, programmeWeekFor(i + 1, pf),
    "week " + (i + 1) + " of the overview is not what the card would show"));
  // And it clamps rather than throwing on an impossible length.
  assert.equal(programmeWeeksFor(1, pf).length, PROGRAMME_WEEKS_MIN);
  assert.equal(programmeWeeksFor(99, pf).length, PROGRAMME_WEEKS_MAX);
});

// ------------------------------------------------------------------------------------------------
// 2. The rotation
// ------------------------------------------------------------------------------------------------

test("BLOCKER: two sessions in one week are different lifts, and the rotation carries across weeks", () => {
  const pf = prefs({ sessionsPerWeek: 2 });
  const ids = (w: number, s: number) => buildProgrammeSession({ week: w, slot: s, prefs: pf }).exercises.map((e) => e.id).join(",");
  assert.notEqual(ids(1, 0), ids(1, 1), "A and B are the same session");
  assert.equal(rotationSize(1), 2);
  assert.equal(rotationSize(2), 2);
  assert.equal(rotationSize(3), 3);
  assert.equal(rotationSize(4), 3);
  // ⚠️ COUNTED ACROSS THE WHOLE PROGRAMME, NOT RESTARTED EACH WEEK. At one session a week a
  // per-week count would give session A every single week for the length of the programme.
  assert.deepEqual([1, 2, 3, 4].map((w) => rotationLabel(w, 0, 1)), ["A", "B", "A", "B"]);
  assert.deepEqual([1, 2].flatMap((w) => [0, 1].map((s) => rotationLabel(w, s, 2))), ["A", "B", "A", "B"]);
  assert.deepEqual([0, 1, 2].map((s) => rotationLabel(1, s, 3)), ["A", "B", "C"]);
});

test("BLOCKER: a non-finite rotation falls back to the shipped order rather than emptying the session", () => {
  // ⚠️⚠️ THE FAILURE THIS PREVENTS IS TOTAL AND SILENT: all[(NaN + i) % n] is undefined for every i,
  // so every slot comes back empty and the builder returns a session with NO EXERCISES -- a card
  // promising forty-five minutes of lifting with nothing on it, and nothing thrown to say so. The
  // rotation comes off a stored record, so a record written before that field existed, or restored
  // from an older backup, is exactly how NaN gets here.
  assert.equal(rotationIndex(1, 0, NaN), 0);
  assert.equal(rotationIndex(1, 0, undefined as unknown as number), 0);
  const bad = buildProgrammeSession({ week: 1, slot: 0, prefs: { ...prefs(), sessionsPerWeek: undefined as unknown as number } });
  assert.ok(bad.exercises.length > 0, "an unreadable rotation emptied the session");
  const good = buildProgrammeSession({ week: 1, slot: 0, prefs: prefs({ sessionsPerWeek: 1 }) });
  assert.deepEqual(bad.exercises.map((e) => e.id), good.exercises.map((e) => e.id),
    "the fallback is not the shipped order");
});

test("BLOCKER: a programme session never carries the plan's plyometric dose", () => {
  // The plyometric contacts are prescribed against the RUNNING week's tolerance for them; a
  // standalone programme has no running week to hang that judgement off.
  for (let w = 1; w <= 12; w++) {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      const s = buildProgrammeSession({ week: w, slot: 0, prefs: prefs({ level }) });
      assert.equal(s.exercises.some((e) => e.contacts), false,
        "week " + w + " (" + level + ") carries jumps");
    }
  }
});

test("BLOCKER: the card and the sheet's overview both report what the builder will deliver", () => {
  /**
   * ⚠⚠ THE CARD IS A PROMISE ABOUT THE SESSION THE RUNNER IS ABOUT TO DO, AND THE BLOCK TABLE IS
   * NOT IT. programmeWeek answers what the block prescribes; the runner's own minutes then move it
   * in both directions (a 20-minute advanced heavy week is prescribed 3 sets and delivered 2; a
   * 60-minute intermediate technique week is prescribed 2 and delivered 3). Reading the table would
   * put "3 x 3-6" on a card over a session giving two sets -- and the sweep above, which compares
   * programmeWeekFor against the builder, cannot see that, because it never opens the card.
   */
  const card = fnOf("progCardHtml");
  assert.ok(/RC\.programmeWeekFor\(/.test(card),
    "the card reads the block table rather than what this runner will be given");
  assert.equal(/RC\.programmeWeek\(/.test(card), false,
    "the card still has a path to the block table, which is the number that can be wrong");
  const sheet = fnOf("renderProgSheet");
  assert.ok(/RC\.programmeWeeksFor\(/.test(sheet),
    "the create sheet's overview reads the block table rather than what this runner will be given");
  assert.equal(/RC\.programmeWeeks\(/.test(sheet), false,
    "the overview still has a path to the block table");
  // Both must be handed this runner's OWN answers, or they report a different runner's session.
  assert.ok(/progPrefs\(/.test(card), "the card does not pass the programme's own preferences");
  assert.ok(/minutes: base\.minutes/.test(sheet) && /level: base\.level/.test(sheet),
    "the overview does not pass the runner's own minutes and level");
});

test("BLOCKER: pickForSlot refuses a non-finite rotation on its own, not because its caller happens to", () => {
  /**
   * ⚠⚠ BELT AND BRACES HIDES THE BRACE YOU ARE TESTING. Both rotationIndex and pickForSlot refuse a
   * non-finite rotation, so removing pickForSlot's guard changed nothing measurable through
   * buildProgrammeSession -- watched escaping. This drives buildStrength directly, which is the only
   * way to hold one brace while the other is broken.
   */
  const pf = prefs();
  const good = buildStrength({ phase: "base", maintenance: false, prefs: pf, competitive: false, plyo: false,
    intent: { reps: "8\u201312", intent: "light", load: "70%", sets: 2 }, rotate: 0 });
  assert.ok(good.exercises.length > 0, "the control built nothing, so this proves nothing");
  for (const rot of [NaN, undefined as unknown as number, Infinity, -1]) {
    const bad = buildStrength({ phase: "base", maintenance: false, prefs: pf, competitive: false, plyo: false,
      intent: { reps: "8\u201312", intent: "light", load: "70%", sets: 2 }, rotate: rot });
    assert.ok(bad.exercises.length > 0, "rotate=" + String(rot) + " emptied the session");
  }
  assert.deepEqual(
    buildStrength({ phase: "base", maintenance: false, prefs: pf, competitive: false, plyo: false,
      intent: { reps: "8\u201312", intent: "light", load: "70%", sets: 2 }, rotate: NaN }).exercises.map((e) => e.id),
    good.exercises.map((e) => e.id), "an unreadable rotation is not the shipped order");
});

// ------------------------------------------------------------------------------------------------
// 3. The plan steps aside
// ------------------------------------------------------------------------------------------------

test("BLOCKER: a running programme suppresses the plan's own strength in every week, at every answer", () => {
  const weeks = [
    { phase: "base", isDeload: false, ordinalInPhase: 1 },
    { phase: "build", isDeload: false, ordinalInPhase: 2 },
    { phase: "build", isDeload: true, ordinalInPhase: 3 },
    { phase: "peak", isDeload: false, ordinalInPhase: 1 },
    { phase: "taper", isDeload: false, ordinalInPhase: 1 },
  ] as const;
  for (const w of weeks) {
    for (const strength of [undefined, { sessionsPerWeek: 2, minutes: 45, level: "intermediate", goal: "running", equipment: [] }] as const) {
      for (const experience of ["beginner", "recreational", "competitive"] as const) {
        const base = { includeStrength: true, strength, experience, daysPerWeek: 5 } as Parameters<typeof strengthSessionsFor>[0];
        assert.ok(strengthSessionsFor(base, w) >= 0);
        assert.equal(strengthSessionsFor({ ...base, strengthProgramme: { active: true } }, w), 0,
          "the plan still schedules strength in a " + w.phase + " week while a programme is running");
      }
    }
  }
  // ⚠️ AND AN ENDED PROGRAMME GIVES THEM BACK. The flag is what the store's status resolves to, so a
  // programme that has finished must not keep suppressing the plan for the rest of the block.
  const w0 = weeks[0];
  const a = { includeStrength: true, experience: "recreational", daysPerWeek: 5 } as Parameters<typeof strengthSessionsFor>[0];
  assert.ok(strengthSessionsFor({ ...a, strengthProgramme: { active: false } }, w0) > 0);
});

test("BLOCKER: the plan SAYS it has stepped aside, and says it only when it has", () => {
  const race = "2027-02-14";
  const g = goal("half", race);
  const withProg = generatePlan(athlete({ strengthProgramme: { active: true } }), g);
  const without = generatePlan(athlete(), g);
  const note = (p: typeof withProg) => (p.notes || []).find((n) => /strength programme is running/i.test(n));
  assert.ok(note(withProg), "no note explaining why the plan has no strength in it");
  assert.equal(note(without), undefined, "the programme note appears on a plan with no programme");
  assert.ok((without.notes || []).some((n) => /^Strength:/.test(n)), "the ordinary strength note is gone");
  // The note has to be true: nothing of the plan's own may remain.
  assert.equal(withProg.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "strength").length, 0);
  assert.ok(without.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "strength").length > 0,
    "the control plan has no strength either, so this proves nothing");
  // ⚠️ AND THE APP RENDERS IT. viewPlan shows ONE note, chosen by a regex over the engine's wording;
  // a note the engine writes and the screen filters out is the computed-and-discarded trap.
  const vp = fnOf("viewPlan");
  assert.ok(/strength programme is running/.test(vp),
    "viewPlan's note filter does not admit the programme note, so it is written and never shown");
});

// ------------------------------------------------------------------------------------------------
// 4. Placement — legality across every long-run day, distance and race weekday
// ------------------------------------------------------------------------------------------------

type Placer = {
  place: (p: Record<string, unknown>, week: number, wkStart: string) => Array<string | null>;
  info: (iso: string) => { long: boolean; race: boolean; quality: boolean; run: boolean; strength: boolean };
};
/** progDayInfo / progDayScore / progPlaceWeek, lifted and executed against a REAL generated plan. */
function loadPlacer(plan: ReturnType<typeof buildPlanSummary>, noEveRule = false): Placer {
  let body = [
    fnOf("progDayInfo"), fnOf("progDayScore"), fnOf("progPlaceWeek"),
    fnOf("isQualityType"), fnOf("genDay"),
  ].join("\n");
  if (noEveRule) {
    const line = "if (heavy && next.long) score += 100;";
    assert.ok(body.includes(line), "progDayScore no longer carries the long-run eve rule this control removes");
    body = body.replace(line, "");
  }
  const ctx = {
    PLAN: plan,
    PRIMARY_TYPES: { easy: 1, long: 1, recovery: 1, threshold: 1, vo2: 1, "race-specific": 1, strides: 1, race: 1 },
    isoAdd: (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; },
    state: { dayOverride: {} },
    RC: { PROGRAMME_SESSIONS_MAX, programmeWeek },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "const {PLAN, PRIMARY_TYPES, isoAdd, state, RC} = ctx;\n" + body
    + "\nreturn { place: progPlaceWeek, info: progDayInfo };");
  return factory(ctx) as Placer;
}

test("BLOCKER: placement never fights the running, across every long-run day, distance and race weekday", () => {
  const dists: RaceDistanceKey[] = ["5k", "10k", "half", "marathon"];
  // Measured per sessions-per-week, because that is the axis the answer depends on -- and against a
  // CONTROL placer with the eve rule deleted, because a bare percentage cannot tell a rule that is
  // working from a rule that never had anything to decide.
  const seen: Record<string, { n: number; eveLong: number; eveQual: number }> = {};
  const ctrl: Record<string, { n: number; eveLong: number }> = {};
  let weeksChecked = 0, unplaceable = 0, sawRaceEve = 0;
  for (const dist of dists) {
    for (let longDay = 0; longDay < 7; longDay++) {
      for (let raceDow = 0; raceDow < 7; raceDow++) {
        // A race date whose weekday is raceDow, roughly four months out.
        const base = new Date("2027-02-01T00:00:00Z");
        base.setUTCDate(base.getUTCDate() + ((raceDow - ((base.getUTCDay() + 6) % 7)) + 7) % 7);
        const plan = buildPlanSummary(athlete({ longRunDay: longDay }), goal(dist, base.toISOString().slice(0, 10)));
        const placer = loadPlacer(plan);
        const control = loadPlacer(plan, true);
        // ⚠⚠ THE LAST WEEK IS IN THE SWEEP BECAUSE WITHOUT IT THE RACE-EVE BAN IS UNTESTABLE.
        // Weeks 1 and 6 of a four-month block contain neither race day nor its eve, so deleting the
        // ban outright passed every assertion here -- the fixture-too-kind trap, in the one test
        // whose subject is race day. Measured escaping before this line was added.
        for (const spw of [1, 2, 3, 4]) {
          for (const week of [1, 6, plan.weeks.length]) {
            const wkStart = plan.weeks[Math.min(week, plan.weeks.length) - 1]!.startIso;
            const heavy = programmeWeek(week, "intermediate").block === "heavy";
            const arg = { sessionsPerWeek: spw, level: "intermediate" };
            const dates = placer.place(arg, week, wkStart);
            weeksChecked++;
            seen[spw] = seen[spw] || { n: 0, eveLong: 0, eveQual: 0 };
            ctrl[spw] = ctrl[spw] || { n: 0, eveLong: 0 };
            for (let d = 0; d < 7; d++) {
              const iso = nthDay(wkStart, d);
              if (placer.info(nextDay(iso)).race) sawRaceEve++;
            }
            const used: Record<string, number> = {};
            dates.forEach((iso) => {
              if (!iso) { if (week !== plan.weeks.length) unplaceable++; return; }
              const here = placer.info(iso);
              const next = placer.info(nextDay(iso));
              // ---- the HARD bans, which may never be broken -------------------------------------
              assert.equal(here.long, false, "placed on the long-run day: " + [dist, longDay, raceDow, iso].join("/"));
              assert.equal(here.race, false, "placed on race day: " + iso);
              assert.equal(here.strength, false, "placed on a day already carrying strength: " + iso);
              assert.equal(next.race, false, "placed the day before the race: " + iso);
              assert.equal(used[iso], undefined, "two programme sessions on " + iso);
              used[iso] = 1;
              if (week === plan.weeks.length) return;   // race week counts for the bans, not the rates
              seen[spw]!.n++;
              if (heavy && next.long) seen[spw]!.eveLong++;
              if (heavy && next.quality) seen[spw]!.eveQual++;
            });
            if (week === plan.weeks.length) continue;
            control.place(arg, week, wkStart).forEach((iso) => {
              if (!iso) return;
              ctrl[spw]!.n++;
              if (heavy && control.info(nextDay(iso)).long) ctrl[spw]!.eveLong++;
            });
          }
        }
      }
    }
  }
  assert.ok(weeksChecked >= 2000, "only " + weeksChecked + " weeks swept");
  assert.ok(sawRaceEve > 50,
    "the sweep never once offered a day adjacent to race day, so the race-eve ban is untested");
  assert.equal(unplaceable, 0, "some weeks had no legal day at all");
  /**
   * ⚠️⚠️ THE EVE OF THE LONG RUN IS SOFT, AND THE MEASUREMENT IS THE WHOLE ARGUMENT. Banning the
   * long-run day, race day, race eve, the long-run eve AND every quality eve leaves fewer than four
   * placeable days in a seven-day week, and the runner may ask for four sessions -- the identical
   * arithmetic strengthDaysFor already records. So it is scored heavily rather than refused, and
   * measured against a control with the score deleted the shape is exact:
   *
   *   sessions/week | shipped eve-of-long | control
   *              1  |          0.0%       |  23.2%
   *              2  |          0.0%       |  25.0%
   *              3  |          0.0%       |  16.7%
   *              4  |         12.5%       |  12.5%
   *
   * At one, two and three sessions a week the eve of the long run is NEVER used; at four it is
   * unavoidable and the rule changes nothing, because by then there is nothing left to choose.
   * An aggregate percentage would have hidden both halves of that.
   */
  [1, 2, 3].forEach((spw) => {
    assert.ok(seen[spw]!.n > 100, "only " + seen[spw]!.n + " placements at " + spw + " a week");
    assert.equal(seen[spw]!.eveLong, 0,
      "a heavy session landed the day before the long run at " + spw + " sessions a week, where there was room not to");
    assert.ok(ctrl[spw]!.eveLong / ctrl[spw]!.n > 0.1,
      "the control placer avoids the long-run eve anyway, so this proves nothing about the rule");
  });
  assert.equal(seen[4]!.eveLong, ctrl[4]!.eveLong,
    "four sessions a week is the case where the rule has nothing left to give -- if it now differs, the bans have changed");
  /**
   * ⚠️ AND THE TWO SOFT BANS ARE NOT EQUAL: what the long-run rule buys is paid for in quality eves.
   * At three a week the shipped placer uses a quality eve 16.7% of the time and the control never
   * does -- it takes the long-run eve instead. When something has to give, it gives on the smaller
   * session, which is the trade the score's own comment states.
   */
  assert.ok(seen[3]!.eveQual > 0, "the long-run rule is not costing anything, so it is not binding");
});

test("BLOCKER: a heavy week avoids the eve of the long run where an easier week need not bother", () => {
  // The discriminating case, rather than an aggregate: the SAME week, placed heavy and not heavy.
  const plan = buildPlanSummary(athlete({ longRunDay: 6 }), goal("half", "2027-02-14"));
  const placer = loadPlacer(plan);
  const wkStart = plan.weeks[3]!.startIso;
  const heavy = placer.place({ sessionsPerWeek: 4, level: "intermediate" }, 6, wkStart);
  const light = placer.place({ sessionsPerWeek: 4, level: "intermediate" }, 1, wkStart);
  const eveOfLong = (iso: string | null) => {
    if (!iso) return false;
    return placer.info(new Date(new Date(iso + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)).long;
  };
  assert.equal(heavy.filter(eveOfLong).length, 0, "a heavy week put a session the day before the long run");
  assert.ok(light.length === 4 && heavy.length === 4, "both weeks placed four sessions");
});

// ------------------------------------------------------------------------------------------------
// 5. The EXTRA derivation: skipped, moved, and never stored
// ------------------------------------------------------------------------------------------------

type ProgApi = {
  extras: () => Array<Record<string, unknown>>;
  skip: (id: string) => void;
  move: (id: string, iso: string) => void;
  active: () => Record<string, unknown> | null;
  store: Record<string, string>;
};
function loadProgApi(plan: ReturnType<typeof buildPlanSummary>, rec: Record<string, unknown>): ProgApi {
  const body = [
    constOf("PROG_KEY"),
    fnOf("loadProg"), fnOf("saveProg"), fnOf("progEndIso"), fnOf("progActive"),
    fnOf("progDayInfo"), fnOf("progDayScore"), fnOf("progPlaceWeek"),
    fnOf("progSkip"), fnOf("progMove"), fnOf("progExtras"),
    fnOf("isQualityType"), fnOf("genDay"),
  ].join("\n");
  const store: Record<string, string> = { "interun_prog_v1": JSON.stringify(rec) };
  const ctx = {
    PLAN: plan,
    PRIMARY_TYPES: { easy: 1, long: 1, recovery: 1, threshold: 1, vo2: 1, "race-specific": 1, strides: 1, race: 1 },
    isoAdd: (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; },
    todayIso: () => "2026-09-21",
    state: { dayOverride: {} },
    RC: { PROGRAMME_SESSIONS_MAX, programmeWeek },
    localStorage: {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "const {PLAN, PRIMARY_TYPES, isoAdd, todayIso, state, RC, localStorage} = ctx;\n" + body
    + "\nreturn { extras: progExtras, skip: progSkip, move: progMove, active: progActive };");
  return { ...(factory(ctx) as Omit<ProgApi, "store">), store };
}
const REC = {
  id: "77", name: "8-week strength programme", startIso: "2026-09-21", weeks: 8,
  sessionsPerWeek: 2, minutes: 45, level: "intermediate", goal: "running",
  equipment: KIT, skipped: {}, status: "active",
};

test("BLOCKER: the derivation gives every week its sessions, and a removed one stays removed", () => {
  const plan = buildPlanSummary(athlete(), goal("half", "2027-02-14"));
  const api = loadProgApi(plan, REC);
  const all = api.extras();
  assert.equal(all.length, 16, "8 weeks x 2 sessions");
  const perWeek: Record<string, number> = {};
  all.forEach((e) => { perWeek[String(e.pw)] = (perWeek[String(e.pw)] || 0) + 1; });
  assert.deepEqual(Object.values(perWeek), [2, 2, 2, 2, 2, 2, 2, 2]);
  all.forEach((e) => {
    assert.equal(e.id, "p77-w" + e.pw + "-s" + e.ps, "an id that cannot be resolved back to its week and slot");
    assert.equal(e.prog, "77");
    assert.equal(e.type, "strength");
    assert.ok(typeof e.date === "string" && (e.date as string) >= "2026-09-21");
  });
  // ⚠️ THE ID IS DETERMINISTIC, WHICH IS WHAT MAKES A SKIP AND A MOVE SURVIVE A REBUILD. Two
  // derivations of the same record must agree exactly, or nothing keyed on an id means anything.
  assert.deepEqual(api.extras(), all, "two derivations of one record disagree");
  const victim = String(all[0]!.id);
  api.skip(victim);
  const after = api.extras();
  assert.equal(after.length, 15);
  assert.equal(after.some((e) => e.id === victim), false, "a removed session came back");
});

test("BLOCKER: a runner's own placement is kept, stays in its week, and swaps rather than doubling up", () => {
  const plan = buildPlanSummary(athlete(), goal("half", "2027-02-14"));
  const api = loadProgApi(plan, REC);
  const wk1 = api.extras().filter((e) => e.pw === 1);
  assert.equal(wk1.length, 2);
  const a = String(wk1[0]!.id), aDate = String(wk1[0]!.date), bDate = String(wk1[1]!.date);
  assert.notEqual(aDate, bDate);

  // A day inside the week is honoured.
  api.move(a, "2026-09-23");
  assert.equal(api.extras().find((e) => e.id === a)!.date, "2026-09-23");

  // ⚠️ OUTSIDE ITS OWN WEEK IT IS REFUSED, and that is structural rather than fussy: the programme is
  // blocks of weeks, so a session dragged into the next one would leave a week with three sessions
  // and a week with one, both at the wrong block's prescription.
  api.move(a, "2026-10-01");
  assert.equal(api.extras().find((e) => e.id === a)!.date, aDate, "a move out of the week was honoured");

  // ⚠️ AND A MOVE ONTO A DAY THE PROGRAMME ALREADY USES SWAPS -- which is what the session sheet's
  // own copy promises ("if a run is already there, the two will swap") and what moveSession does for
  // a plan session. Without it both of the week's sessions land on one day.
  api.move(a, bDate);
  const swapped = api.extras().filter((e) => e.pw === 1);
  assert.equal(swapped.find((e) => e.id === a)!.date, bDate);
  assert.equal(swapped.find((e) => e.id !== a)!.date, aDate, "the session that did not move did not give way");
  const dates = api.extras().map((e) => e.date);
  assert.equal(new Set(dates).size, dates.length, "two programme sessions on one day");
});

test("BLOCKER: an ended or expired programme derives nothing AND stops suppressing the plan", () => {
  const plan = buildPlanSummary(athlete(), goal("half", "2027-02-14"));
  assert.equal(loadProgApi(plan, { ...REC, status: "ended" }).extras().length, 0);
  assert.equal(loadProgApi(plan, { ...REC, startIso: "2026-01-05" }).extras().length, 0,
    "a programme whose last week is in the past still derives sessions");
  assert.equal(loadProgApi(plan, { ...REC, weeks: 8, startIso: "2026-08-10" }).extras().length > 0, true,
    "a programme part-way through derives its remaining weeks");
  /**
   * ⚠️⚠️ THE CONSEQUENCE WITH TEETH IS THE SUPPRESSION, NOT THE DERIVATION, AND ONLY THIS HALF CAN
   * FAIL. progExtras skips any week already past on its own, so deleting the expiry check changes
   * nothing it produces -- watched escaping. What the check actually holds is progActive, which
   * applyProfile reads to set strengthProgramme.active: without it a programme that finished in
   * March keeps the plan's own strength sessions suppressed for the rest of the runner's life.
   */
  assert.notEqual(loadProgApi(plan, REC).active(), null,
    "the live control does not report itself active, so the two checks below prove nothing");
  assert.equal(loadProgApi(plan, { ...REC, startIso: "2026-01-05" }).active(), null,
    "a programme that ran out months ago still suppresses the plan's strength");
  assert.equal(loadProgApi(plan, { ...REC, startIso: "2026-09-21", status: "ended" }).active(), null,
    "an ended programme still suppresses the plan's strength");
});

// ------------------------------------------------------------------------------------------------
// 6. The wiring: derived not stored, routed not fallen through, reachable not orphaned
// ------------------------------------------------------------------------------------------------

test("BLOCKER: a derived session is never written to the extras store", () => {
  // ⚠️ IF IT WERE, A PROGRAMME WOULD DOUBLE ON EVERY REBUILD: loadExtra concatenates the derived
  // sessions onto the stored ones, so a stored copy of a derived row is a second copy of every
  // session -- and it would outlive the programme that produced it, un-removable.
  const save = fnOf("saveExtra");
  assert.ok(/!e\.prog/.test(save), "saveExtra does not strip derived rows");
  const load = fnOf("loadExtra");
  assert.ok(/!e\.prog/.test(load), "loadExtra does not strip derived rows from what it read back");
  assert.ok(/progExtras\(\)/.test(load), "loadExtra does not derive the programme's sessions");
});

test("BLOCKER: extraSession routes a programme row before anything else can claim it", () => {
  // ⚠️ A programme row carries type "strength" and would otherwise fall through to buildCustomSession,
  // which resolves a type to THE PLAN'S representative session of it -- so every week of a twelve-week
  // programme would render as the plan's own strength session, with none of the block progression
  // that is the entire point.
  const fn = fnOf("extraSession");
  const routed = fn.indexOf("if (e.prog) return progSession(e);");
  const workout = fn.indexOf("if (e.workoutId)");
  const custom = fn.indexOf("buildCustomSession");
  assert.ok(routed > 0, "extraSession does not route a programme row");
  assert.ok(workout > 0 && custom > 0, "extraSession no longer has the branches this ordering is about");
  assert.ok(routed < workout && routed < custom, "a programme row can be claimed by another branch first");
});

test("BLOCKER: removing a programme session records a skip rather than deleting a derived row", () => {
  const fn = fnOf("removeExtra");
  assert.ok(/progSkip\(/.test(fn),
    "removeExtra does not record a skip, so the next rebuild derives the session straight back");
});

test("BLOCKER: the re-derivation runs on every plan change, and cannot run before EXTRA exists", () => {
  // ⚠️ THE FLAG IS THE BOOT ORDER, NOT DEFENCE. adoptPlan is reached from a top-level recompute()
  // thousands of lines above `let EXTRA`, so the boot call would read it in its temporal dead zone.
  const adopt = fnOf("adoptPlan");
  assert.ok(/refreshProgExtras\(\)/.test(adopt), "a plan change does not re-derive the programme");
  const refresh = fnOf("refreshProgExtras");
  assert.ok(/EXTRA_READY/.test(refresh), "refreshProgExtras is not gated on EXTRA being initialised");
  // ⚠️ AND BEFORE THE TWO SYNCS, or iOS holds reminders and the wrist holds a schedule for sessions
  // that have just moved.
  const at = adopt.indexOf("refreshProgExtras()");
  const rem = adopt.indexOf("syncNativeReminders");
  const watch = adopt.indexOf("syncWatch");
  assert.ok(at > 0 && rem > 0 && watch > 0, "adoptPlan no longer has the calls this ordering is about");
  assert.ok(at < rem && at < watch, "the programme is re-derived after the reminders and the watch were sent");
});

test("BLOCKER: the day picker moves a programme session instead of writing an override nobody reads", () => {
  // ⚠️⚠️ THE DEFECT THIS PINS WAS REAL AND SHIPPED-SHAPED: a programme session is DATED, not
  // week-and-day, so moveSession cannot move it -- and it did not refuse, it wrote a dayOverride
  // nothing reads. Tapping a day rescheduled nothing, left a dead override behind, and closed the
  // sheet as though it had worked. Sixteen of them on one screen.
  const wire = fnOf("wireSheet");
  const at = wire.indexOf("data-moveto");
  assert.ok(at > 0, "wireSheet no longer wires the day picker");
  const block = wire.slice(at);
  const routed = block.indexOf("progMove(");
  const fallback = block.indexOf("moveSession(");
  assert.ok(routed > 0, "the day picker cannot move a programme session");
  assert.ok(fallback > 0, "the day picker no longer moves a plan session either");
  assert.ok(routed < fallback, "moveSession claims a programme session before progMove can");
  assert.ok(/progExtraOf\(/.test(block), "the handler does not ask whether this session is a programme's");
});

test("BLOCKER: every control the programme card and its sheet render is reached by a handler", () => {
  // The invented-identifier trap: a builder can render a perfectly good button wired to nothing, and
  // it builds, typechecks and passes every other test in this repo.
  const block = appBlock();
  const builders = ["progCardHtml", "renderProgSheet"].map(fnOf).join("\n");
  const ids = [...builders.matchAll(/id="([a-zA-Z][\w-]*)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 4, "only " + ids.length + " ids found -- the sweep is looking at the wrong thing");
  ids.forEach((id) => {
    assert.ok(new RegExp('\\$\\("' + id + '"\\)').test(block),
      "nothing ever looks up #" + id + ", so it is a control wired to nothing");
  });
  const data = [...builders.matchAll(/data-(prog[a-z]*)="/g)].map((m) => m[1]!);
  assert.ok(data.length >= 2, "the option rows carry no data attribute");
  [...new Set(data)].forEach((d) => {
    assert.ok(new RegExp('\\[data-' + d + '\\]').test(block) || new RegExp("dataset\\." + d).test(block),
      "nothing reads data-" + d);
  });
});

test("BLOCKER: every function the programme's own code calls exists in the built page", () => {
  // ⚠️ THE INVENTED-IDENTIFIER TRAP, EIGHT TIMES IN THIS REPO'S HISTORY AND TWICE IN THIS FEATURE.
  // A5's own stage shipped `sheetBody()` and `sheetOv()` -- two helpers that do not exist -- and the
  // sheet opened showing the menu it came from, with nothing thrown.
  const block = appBlock();
  const defined = new Set([...block.matchAll(/^function ([a-zA-Z_$][\w$]*)\(/gm)].map((m) => m[1]!));
  const consts = new Set([...block.matchAll(/^(?:const|let|var) ([a-zA-Z_$][\w$]*)\s*=/gm)].map((m) => m[1]!));
  const GLOBALS = new Set(["Number", "String", "Boolean", "Array", "Object", "Math", "Date", "JSON",
    "parseInt", "parseFloat", "isNaN", "isFinite", "setTimeout", "clearTimeout", "setInterval",
    "clearInterval", "requestAnimationFrame", "encodeURIComponent", "decodeURIComponent", "Set",
    "Map", "Promise", "RegExp", "Error", "Intl", "fetch", "alert", "confirm", "prompt", "if", "for",
    "while", "switch", "catch", "return", "typeof", "function", "new", "await", "of", "in"]);
  const names = ["progCardHtml", "openProgSheet", "renderProgSheet", "startProgramme", "endProgramme",
    "progDefaultPrefs", "progBlockLabel", "progExtras", "progSession", "progMove", "progSkip",
    "progPlaceWeek", "progDayScore", "progDayInfo", "refreshProgExtras", "progExtraOf", "weekMondayOf"];
  const missing: string[] = [];
  names.forEach((n) => {
    const body = fnOf(n);
    // Strings carry class names and copy, not code -- and this repo has watched a sweep report
    // var(--rest) inside a style attribute as an undefined function.
    const code = body.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
    [...code.matchAll(/(?<![.\w$])([a-zA-Z_$][\w$]*)\s*\(/g)].forEach((m) => {
      const c = m[1]!;
      if (GLOBALS.has(c) || defined.has(c) || consts.has(c) || c === n) return;
      missing.push(n + " calls " + c + "()");
    });
  });
  assert.deepEqual([...new Set(missing)], [], "a control wired to a function that does not exist");
});
