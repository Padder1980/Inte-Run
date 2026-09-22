/**
 * THE 12-17 LIMITS (owner, 21 September 2026).
 *
 * He replaced PLAN.md's under-18 gate with "a fully tailored programme for children between the ages
 * of 12-18 ... in line with a detailed piece of research that you undertake ... Don't just assume that
 * you have the right answer at the first research run, double check what you find".
 *
 * The research, the sources and the table that was discarded as folklore are in YOUTH.md. These guards
 * exist because every number in src/domain/youth.ts is a governing body's competition rule or a
 * measured position stand, not a preference -- so drift is not untidiness here, it is the app coaching
 * a minor toward a race they are not permitted to enter.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  isYouthAge, youthLimitsFor, youthGoalsFrom, clampYouthDays, YOUTH_MIN_AGE, YOUTH_MAX_AGE,
} from "../src/domain/youth.ts";
import { RACE_DISTANCES_M, METRES_PER_KM, type RaceDistanceKey } from "../src/domain/units.ts";

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const nocomment = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");
/** A top-level function's source, brace-matched. A character window is not a function. */
function fn(name: string): string {
  const i = APP.indexOf("\nfunction " + name + "(");
  assert.ok(i >= 0, name + " is not in the built page");
  let d = 0, started = false;
  for (let j = APP.indexOf("{", i); j < APP.length; j++) {
    if (APP[j] === "{") { d++; started = true; }
    else if (APP[j] === "}") { d--; if (started && d === 0) return APP.slice(i, j + 1); }
  }
  throw new Error("unbalanced " + name);
}

const APP_GOALS: RaceDistanceKey[] = ["5k", "10k", "half", "marathon"];
const AGES = [12, 13, 14, 15, 16, 17];

test("BLOCKER: the distance ceilings are UK Athletics' RULE, at every age, and not its recommendation", () => {
  // UKA Rules for Competition TR3 S4, maximum permitted ROAD distance by age on the day.
  const RULE: Record<number, number> = { 12: 6, 13: 6, 14: 8, 15: 12, 16: 16, 17: 25 };
  for (const age of AGES) {
    const lim = youthLimitsFor(age);
    assert.ok(lim, "no limits for age " + age);
    assert.equal(lim!.maxSessionKm, RULE[age], "age " + age + " is not on UKA's rule");
  }
  // ⚠️ AND IT IS THE RULE RATHER THAN THE RECOMMENDATION, WHICH IS THE OWNER'S EXPLICIT CHOICE AND
  // THE ONE A FUTURE READER IS MOST LIKELY TO "CORRECT". The same document recommends 8 km at 15 and
  // 12-14 km at 16-17; encoding those would withhold the half marathon until 18 and reverse his
  // decision. Pinned as an inequality so it cannot drift either way unnoticed.
  assert.ok(youthLimitsFor(15)!.maxSessionKm > 8, "15 has slipped back to the RECOMMENDED 8 km");
  assert.ok(youthLimitsFor(17)!.maxSessionKm > 14, "17 has slipped back to the RECOMMENDED 12-14 km");
});

test("BLOCKER: weekly volume is twice the longest session, and nothing else", () => {
  for (const age of AGES) {
    const lim = youthLimitsFor(age)!;
    assert.equal(lim.maxWeeklyKm, lim.maxSessionKm * 2,
      "age " + age + ": the weekly cap is no longer twice the session cap");
  }
  // The conservative of the two readings in circulation -- see YOUTH.md's provenance flag.
  assert.ok(youthLimitsFor(17)!.maxWeeklyKm < youthLimitsFor(17)!.maxSessionKm * 3,
    "the weekly multiple has been raised to the three the discarded 1987 table uses");
});

test("BLOCKER: the run-day ceiling is the owner's own column", () => {
  const DAYS: Record<number, number> = { 12: 3, 13: 3, 14: 3, 15: 5, 16: 5, 17: 5 };
  for (const age of AGES) assert.equal(youthLimitsFor(age)!.maxRunDays, DAYS[age], "age " + age);
  // Nationwide Children's "only three times per week" under 14 is the load-bearing half.
  for (const age of [12, 13, 14]) assert.equal(youthLimitsFor(age)!.maxRunDays, 3, "under 14 may run more than three times");
});

test("BLOCKER: no goal a 12-17 year old is offered exceeds their own ceiling", () => {
  // ⚠️ DERIVED FROM RACE_DISTANCES_M, NOT FROM A SECOND TABLE OF METRES. A hand-written list here
  // would drift from units.ts and this guard would then agree with the drift.
  for (const age of AGES) {
    const lim = youthLimitsFor(age)!;
    for (const g of youthGoalsFrom(APP_GOALS, age)) {
      const km = RACE_DISTANCES_M[g] / METRES_PER_KM;
      assert.ok(km <= lim.maxSessionKm,
        "age " + age + " is offered " + g + " (" + km + " km) against a ceiling of " + lim.maxSessionKm);
    }
  }
});

test("BLOCKER: the goals offered at each age are exactly the owner's ruling", () => {
  const want: Record<number, RaceDistanceKey[]> = {
    12: ["5k"], 13: ["5k"], 14: ["5k"],
    15: ["5k", "10k"], 16: ["5k", "10k"], 17: ["5k", "10k", "half"],
  };
  for (const age of AGES) {
    assert.deepEqual(youthGoalsFrom(APP_GOALS, age), want[age], "age " + age);
  }
  // ⚠️ A MARATHON AT NO AGE UNDER 18 -- the single most important row, and the one the discarded
  // 1987 table gets wrong (it permits one at 17). UKA's rule allows 25 km at 17; a marathon is 42.195.
  for (const age of AGES) {
    assert.ok(!youthGoalsFrom(APP_GOALS, age).includes("marathon"), "a marathon is offered at " + age);
  }
  // And a half at 17 only -- 21.0975 km fits under 25 and under nothing lower.
  for (const age of [12, 13, 14, 15, 16]) {
    assert.ok(!youthGoalsFrom(APP_GOALS, age).includes("half"), "a half marathon is offered at " + age);
  }
  assert.ok(youthGoalsFrom(APP_GOALS, 17).includes("half"), "17 has lost the half marathon he ruled for");
});

test("BLOCKER: 18 is an adult, and an adult's goals come back untouched", () => {
  assert.equal(YOUTH_MAX_AGE, 17, "the youth band no longer ends at 17");
  assert.equal(YOUTH_MIN_AGE, 12, "the youth band no longer starts at 12");
  for (const age of [18, 19, 21, 35, 64, 90]) {
    assert.equal(isYouthAge(age), false, age + " is being treated as a child");
    assert.deepEqual(youthGoalsFrom(APP_GOALS, age), APP_GOALS, "age " + age + " lost a goal");
    assert.equal(youthLimitsFor(age), null, "age " + age + " has youth limits");
  }
  // ⚠️ AND SO DOES "PREFER NOT TO SAY" -- for now. Absent means adult, which is the hole YOUTH.md
  // section 5.2 names and which the age-assurance question closes. Pinned so that when it is closed,
  // this guard has to be restated deliberately rather than quietly passing either way.
  for (const a of [null, undefined, NaN]) {
    assert.equal(isYouthAge(a as number), false, "an unanswered age is being treated as a child");
    assert.deepEqual(youthGoalsFrom(APP_GOALS, a as number), APP_GOALS);
  }
});

test("BLOCKER: an age below 12 gets the most restrictive row, never an adult plan", () => {
  // The form cannot produce one, but a restored backup or a future birthday field could, and the
  // failure mode of a lower bound would be that the youngest runner in the app is treated as an adult.
  for (const age of [1, 6, 9, 11]) {
    const lim = youthLimitsFor(age);
    assert.ok(lim, "age " + age + " came back as an ADULT");
    assert.equal(lim!.maxSessionKm, youthLimitsFor(12)!.maxSessionKm, "age " + age + " is not clamped to 12");
    assert.deepEqual(youthGoalsFrom(APP_GOALS, age), ["5k"], "age " + age);
  }
});

test("BLOCKER: the ceiling is applied to the caller's own list, so a new goal cannot slip past it", () => {
  // ⚠️ THIS IS WHAT STOPS THE MODULE OWNING A SECOND COPY OF THE APP'S GOAL SET. Hand a list it has
  // never seen and the ceiling still binds; hand it one goal and it does not invent others.
  const withMile: RaceDistanceKey[] = ["1mile", "5k", "10k", "half", "marathon"];
  assert.deepEqual(youthGoalsFrom(withMile, 12), ["1mile", "5k"], "a mile is 1.609 km and must survive at 12");
  assert.deepEqual(youthGoalsFrom(["marathon"], 12), [], "a list of only over-ceiling goals must come back empty");
  assert.deepEqual(youthGoalsFrom([], 30), [], "an empty list must not gain members");
  // Every key in units.ts is classified one way or the other at every youth age -- no silent skips.
  for (const age of AGES) {
    const all = Object.keys(RACE_DISTANCES_M) as RaceDistanceKey[];
    const kept = youthGoalsFrom(all, age);
    for (const k of all) {
      const under = RACE_DISTANCES_M[k] / METRES_PER_KM <= youthLimitsFor(age)!.maxSessionKm;
      assert.equal(kept.includes(k), under, k + " at age " + age);
    }
  }
});

test("BLOCKER: a day answer from anywhere is folded onto what that age may run", () => {
  for (const age of AGES) {
    const cap = youthLimitsFor(age)!.maxRunDays;
    for (const asked of [1, 3, 4, 5, 6, 7, 99]) {
      assert.ok(clampYouthDays(age, asked) <= cap, "age " + age + " kept " + asked + " days");
    }
    assert.equal(clampYouthDays(age, 2), 2, "a smaller answer than the cap must survive");
  }
  for (const age of [18, 40]) assert.equal(clampYouthDays(age, 7), 7, "an adult's answer was clamped");
  assert.equal(clampYouthDays(13, NaN), 3, "a non-finite answer must fall to the cap, never through it");
});

test("BLOCKER: the goal picker asks the engine for the ceiling rather than keeping its own", () => {
  // Driven, not grepped: the real builder with a real age, through the real engine helper.
  // ⚠️ THE REAL ENGINE FUNCTION IS PASSED IN, NOT SERIALISED. Serialising it drops the
  // constants it closes over (RACE_DISTANCES_M, youthLimitsFor), so it throws -- and the first run of
  // this guard therefore measured goalsForAge's old catch instead of the filter, which is how it
  // found that the catch failed OPEN. A lift that omits a dependency measures a strictly easier
  // program; passing the import removes the possibility.
  const build = (age: number | null) => new Function("RC",
    "const RACE_LABEL = { '5k': '5 km', '10k': '10 km', half: 'Half marathon', marathon: 'Marathon' };\n" +
    "const FINISH_LABEL = RACE_LABEL;\n" +
    "const $ = () => null, draft = {}, profile = { age: " + (age == null ? "0" : age) + " };\n" +
    (/const GOAL_BY_STATUS = \{[\s\S]*?\n\};/.exec(APP) || [""])[0] + "\n" +
    nocomment(fn("currentAgeAnswer")) + "\n" + nocomment(fn("goalsForAge")) + "\n" +
    nocomment(fn("goalCardInner")) + "\nreturn goalCardInner;")({ youthGoalsFrom })(
      "regular", { dist: "marathon", date: "2027-05-16", target: "" });
  const at13 = build(13);
  assert.ok(!/value="marathon"/.test(at13), "a 13-year-old is offered a marathon");
  assert.ok(!/value="half"/.test(at13), "a 13-year-old is offered a half marathon");
  assert.ok(/value="5k"/.test(at13), "a 13-year-old is offered nothing at all");
  // ⚠️ AND AN OUT-OF-RANGE STORED GOAL DOES NOT SURVIVE AS THE SELECTED ONE. The runner arrived with
  // "marathon" stored; the picker must fall back rather than render a selected option that is not there.
  assert.ok(/value="5k" selected/.test(at13), "the stored marathon left the dropdown with nothing selected");
  const adult = build(34);
  assert.ok(/value="marathon" selected/.test(adult), "an adult lost the marathon, or lost their selection");
  assert.ok(/value="half"/.test(adult) && /value="10k"/.test(adult), "an adult lost a goal");
  const unknown = build(null);
  assert.ok(/value="marathon"/.test(unknown), "an unanswered age is being treated as a child");
});

test("BLOCKER: age is asked before the goal, and asked exactly once", () => {
  // ⚠️ IT USED TO BE ASKED ON "details", THREE STEPS AFTER THE GOAL -- so the goal picker could not
  // filter on it and a 13-year-old chose a marathon before anyone asked how old they were.
  const ids = nocomment(fn("wizStepIds"));
  for (const m of ids.matchAll(/\[([^\]]*"goal"[^\]]*)\]/g)) {
    const arr = m[1]!;
    assert.ok(arr.indexOf('"level"') >= 0 && arr.indexOf('"level"') < arr.indexOf('"goal"'),
      "a wizard path puts the goal step before the level step: " + arr);
  }
  // Exactly one wizard step renders the age select, and it is the one before the goal.
  const body = nocomment(fn("wizBody"));
  const occurrences = (body.match(/id="s_age"/g) || []).length;
  assert.equal(occurrences, 1, "the wizard asks for age " + occurrences + " times, not once");
  const level = body.indexOf('if (id === "level")');
  const goal = body.indexOf('if (id === "goal")');
  const age = body.indexOf('id="s_age"');
  assert.ok(level >= 0 && goal > level, "the level branch is missing or no longer precedes the goal branch");
  assert.ok(age > level && age < goal, "the age question is no longer inside the level step");
});

test("BLOCKER: the saved goal is filtered too, so the picker is not the only gate", () => {
  // ⚠️ WITHOUT THIS THE WHOLE STAGE IS COSMETIC. goalCardInner decides what is OFFERED; the value that
  // reaches the engine can come from a stored profile, a restored backup, or "Prefer not to say" later
  // becoming a real age. Offering one thing and saving another is the days question's own defect.
  const src = nocomment(fn("draftFromForm"));
  assert.match(src, /goalsForAge\(\[rawGoal\]\)\.length \? rawGoal :/,
    "draftFromForm no longer folds the goal onto what the age allows");
  assert.ok(!/const goalDist = wizFieldVal\("s_dist"\) \|\| profile\.goalDist;/.test(src),
    "the unfiltered goal assignment is back");
  // ⚠️ AND IT TESTS THE RAW ANSWER AGAINST THE AGE CEILING ALONE. Folding it onto
  // goalCfg.dists as well would change what an ADULT saves -- a "new" runner carrying a stored
  // marathon would start saving 5k -- and this stage must leave every adult plan byte-identical.
  assert.ok(!/goalsForAge\(goalCfg\.dists\)\.indexOf/.test(src),
    "the status list is being folded in too, which moves an adult's saved goal");
});
