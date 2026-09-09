import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { runningDaysFor, runningDayChoices, clampDayAnswer, RUN_DAY_MIN } from "../src/domain/running-days.ts";
import type { Athlete, RaceDistanceKey } from "../src/domain/types.ts";

/**
 * THE FORM MAY NOT ASK FOR A DAY THE PLAN WILL THROW AWAY.
 *
 * Owner, 2026-09-09: *"ive just changed my training from 4 days per week to 6 and it is saying nothing
 * changes? thats not right"*. It was not wrong — on the beginner track both 4 and 6 build a four-run
 * week, so the preview sheet's "Nothing about your plan changes" was TRUE and unexplained. The picker
 * offered 3-7 to everybody while the generator caps beginners at 4 (3 on run-walk), so three of the
 * five buttons produced the same plan as the fourth.
 *
 * ⚠️ AND THE VOLUME QUESTION'S PRECEDENT WAS ALREADY IN THIS CODEBASE. CLAUDE.md, on that question:
 * "syncStatus() therefore HIDES the question for those statuses — a question whose answer is thrown
 * away is worse than no question." Days per week never got the same treatment.
 */

const SRC = readFileSync(new URL("../src/plan/generate-plan.ts", import.meta.url), "utf8");
const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/**
 * ⚠️ THE BLOCK-COMMENT SWEEP IS ANCHORED TO THE START OF A LINE, AND IT HAS TO BE. The app markup
 * contains accept="image/*" — an unbalanced comment opener mid-line — so an unanchored sweep opens
 * there and closes at the next real terminator, deleting 10,382 characters of live code. CLAUDE.md
 * records that measurement; this guard hit it on its first run and reported the fix as missing.
 */
const nocomment = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");

/** The four status cards the form offers, and the engine track each maps to. */
const TRACKS: Array<{ status: string; experience: Athlete["experience"]; runWalk: boolean }> = [
  { status: "new", experience: "beginner", runWalk: true },
  { status: "building", experience: "beginner", runWalk: false },
  { status: "regular", experience: "recreational", runWalk: false },
  { status: "competitive", experience: "competitive", runWalk: false },
];
const RUNS = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const DISTS: RaceDistanceKey[] = ["5k", "10k", "half", "marathon"];
const RACE: Record<string, string> = { "5k": "2027-01-10", "10k": "2027-02-07", half: "2027-03-14", marathon: "2027-05-16" };
const TGT: Record<string, number> = { "5k": 1500, "10k": 3100, half: 6300, marathon: 13500 };

/** The plan a real runner would get, described by what a week actually contains. */
function shapeOf(t: typeof TRACKS[number], days: number, dist: RaceDistanceKey) {
  const p = generatePlan(
    { experience: t.experience, daysPerWeek: days, recent: { distanceMeters: 5000, timeSeconds: 1500 },
      runWalk: t.runWalk, returningFromInjury: false, returningFromBreak: false, includeStrength: true },
    { distance: dist, raceDateIso: RACE[dist]!, targetTimeSeconds: TGT[dist]! },
    { startDateIso: "2026-09-14" });
  const wks = p.weeks.slice(1, -3).filter((w) => !w.isDeload);
  const runs = Math.max(...wks.map((w) => w.sessions.filter((s) => RUNS.has(s.type)).length));
  const other = Math.max(...wks.map((w) => w.sessions.filter((s) => !RUNS.has(s.type) && s.type !== "rest").length));
  return runs + "r/" + other + "s";
}

/* ------------------------------------------------------------------ THE DERIVED ONE */

test("BLOCKER: every day the picker offers builds a DIFFERENT plan, driven", () => {
  // ⚠️⚠️ THIS IS THE GUARD THAT WOULD HAVE CAUGHT THE REPORTED BUG, and it is derived from the real
  // generator rather than from a table. Two claims, and both matter: nothing offered is a duplicate
  // of another offer (or the runner is asked a question with no effect), and nothing WITHHELD would
  // have built something new (or a real choice has been taken away from them).
  for (const t of TRACKS) {
    const offered = runningDayChoices(t);
    assert.ok(offered.length >= 1, t.status + " is offered nothing at all");

    for (const dist of DISTS) {
      const shape = (d: number) => shapeOf(t, d, dist);

      // (1) Every offered day is distinguishable from every other offered day.
      const seen = new Map<string, number>();
      for (const d of offered) {
        const s = shape(d);
        const dup = seen.get(s);
        assert.equal(dup, undefined,
          `${t.status}/${dist}: ${d} days and ${dup} days build the same plan (${s}) — the picker is `
          + "offering a button that changes nothing, which is the bug this file exists for");
        seen.set(s, d);
      }

      // (2) Nothing withheld above the top offer would have built something new.
      const top = offered[offered.length - 1]!;
      for (const d of [top + 1, top + 2, 7]) {
        if (d <= top) continue;
        assert.equal(shape(d), shape(top),
          `${t.status}/${dist}: ${d} days builds ${shape(d)} where the top offer ${top} builds `
          + `${shape(top)} — a real choice is being withheld from this runner`);
      }
    }
  }
});

test("BLOCKER: the form's own option list is the engine's, not a copy of it", () => {
  // The picker is built from dayChoiceOpts, which asks the engine. A literal list is what shipped.
  const app = nocomment(APP);
  assert.match(app, /seg\("days", dayChoiceOpts\(p\), daySegVal\(p\)\)/,
    "the days picker no longer takes its options from the engine");
  assert.doesNotMatch(app, /seg\("days",\s*\[\[/,
    "the days picker has a hardcoded option list again — the exact shape of the reported bug");
  assert.match(app, /function dayChoiceOpts\(pf\) \{ return RC\.runningDayChoices\(/,
    "dayChoiceOpts is deciding for itself instead of asking the engine");
});

/* ------------------------------------------------ ONE DEFINITION, AND NOT ON THE WAY IN */

test("BLOCKER: the cap has one definition and every engine site reads it", () => {
  const src = nocomment(SRC);
  // ⚠️ THE CAP WAS AN INLINE LITERAL IN FOUR PLACES IN THIS FILE and the UI copied none of them. One
  // of those four drives a sentence the runner READS.
  assert.doesNotMatch(src, /Math\.min\(7,\s*Math\.max\(3,\s*\w+(\.\w+)*\.daysPerWeek\)\)/,
    "the main-track clamp is written out inline again");
  assert.doesNotMatch(src, /Math\.min\(\w+ \? 3 : 4,\s*Math\.max\(2,/,
    "the beginner clamp is written out inline again");
  const calls = (src.match(/runningDaysFor\(/g) || []).length;
  assert.ok(calls >= 4, "expected every clamp site to read the helper, found " + calls);
});

test("BLOCKER: nothing clamps the answer on its way into the engine", () => {
  // ⚠️⚠️ THE TIDY-LOOKING FIX IS WRONG HERE. The beginner strength count reads the RAW answer
  // ("daysPerWeek >= 4"), so run-walk 3 gives 3 runs + 1 strength and 4 gives 3 runs + 2 strength —
  // two different plans. Clamping at the seam would silently take a strength session off every
  // run-walk runner who had answered 4 or more. Athlete carries the ANSWER; runningDaysFor says what
  // the plan does with it.
  assert.notEqual(shapeOf(TRACKS[0]!, 3, "5k"), shapeOf(TRACKS[0]!, 4, "5k"),
    "run-walk 3 and 4 now build the same plan — the strength difference has been clamped away");
  const app = nocomment(APP);
  assert.doesNotMatch(app, /daysPerWeek:\s*RC\.(clampDayAnswer|runningDaysFor)/,
    "the web layer is clamping the answer before handing it to the engine, which changes run-walk plans");
  // And the five raw reads must stay raw.
  const src = nocomment(SRC);
  for (const raw of ["daysPerWeek >= 4", "daysPerWeek <= 4", "> NO_DELOAD_MAX_DAYS"]) {
    assert.ok(src.includes(raw), "a raw read of the answer has been folded into the clamp: " + raw);
  }
});

test("BLOCKER: the helper reproduces both original clamps exactly", () => {
  for (let d = -2; d <= 12; d++) {
    assert.equal(runningDaysFor({ experience: "recreational", runWalk: false, daysPerWeek: d }),
      Math.min(7, Math.max(3, d)), "main track drifted at " + d);
    assert.equal(runningDaysFor({ experience: "beginner", runWalk: false, daysPerWeek: d }),
      Math.min(4, Math.max(2, d)), "continuous beginner drifted at " + d);
    assert.equal(runningDaysFor({ experience: "beginner", runWalk: true, daysPerWeek: d }),
      Math.min(3, Math.max(2, d)), "run-walk drifted at " + d);
  }
});

test("BLOCKER: the clamp folds any stored answer onto the offered set", () => {
  for (const t of TRACKS) {
    const offered = runningDayChoices(t);
    for (const d of [-5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 99, NaN]) {
      const got = clampDayAnswer(t, d);
      assert.ok(offered.includes(got),
        t.status + ": a stored " + d + " folds to " + got + ", which the picker never offers");
    }
    assert.equal(clampDayAnswer(t, NaN), RUN_DAY_MIN, "a non-number must fall to the lowest offer");
  }
});

/* ------------------------------------------------------------------- THE UI'S PROMISES */

test("BLOCKER: every display of the day count shows what the plan will build", () => {
  // ⚠️ The profile row printed the stored number raw, so a beginner storing 6 was told "6 days /
  // week" over a four-run plan. Alfie was sent the same false premise, and the wizard tile printed it
  // as "runs / week".
  const app = nocomment(APP);
  assert.doesNotMatch(app, /\(profile\.daysPerWeek \|\| 0\) \+ " days \/ week"/,
    "the profile row prints the stored answer raw again");
  assert.doesNotMatch(app, /daysPerWeek: profile\.daysPerWeek \|\| null/,
    "Alfie is sent the stored answer raw again, so it answers from a false premise");
  const clamped = (app.match(/dayAnswerOf\(/g) || []).length;
  assert.ok(clamped >= 4, "expected every display to clamp, found " + clamped + " uses");
});

test("BLOCKER: the cap is explained only where it applies, and its number comes from the engine", () => {
  const app = nocomment(APP);
  const note = app.slice(app.indexOf("function dayCapNote"), app.indexOf("function seg("));
  assert.match(note, /if \(t\.experience !== "beginner"\) return/,
    "the cap note now shows for runners who are not capped");
  // ⚠️ ASKED OF THE ENGINE WITH AN ABSURD ANSWER RATHER THAN TYPED, so the sentence and the plan
  // cannot disagree — and it is why the run-walk copy reads 3 while the picker offers 4.
  assert.match(note, /RC\.runningDaysFor\(\{[^}]*daysPerWeek: 99/,
    "the note types its own run count, so it can disagree with the plan");
  assert.doesNotMatch(note, /builds up to [0-9]/, "the note has a hardcoded number in it");
  // The card name is read from STATUS_OPTS, not typed — a rename would otherwise orphan it.
  assert.match(note, /STATUS_OPTS\.find\(/, "the note types the level's name instead of reading it");
});

test("BLOCKER: the preview reports a change of NON-running sessions too", () => {
  // ⚠️ THE SAME FALSEHOOD THE OWNER REPORTED, ON A DIFFERENT ANSWER, AND LIVE FOR EVERYBODY.
  // PRIMARY_TYPES is a RUNNING filter; profileImpact used it as a session filter, so turning
  // "Include strength & conditioning?" from Yes to No reported "Nothing about your plan changes"
  // while taking sessions out of every week. Measured after the fix: 3 -> 1.
  const app = nocomment(APP);
  const imp = app.slice(app.indexOf("function profileImpact"), app.indexOf("function profileImpactHtml"));
  assert.match(imp, /Strength & mobility sessions/, "the preview cannot see a strength change");
  assert.match(imp, /!PRIMARY_TYPES\[x\.type\] && x\.type !== "rest"/,
    "the non-running count is not the complement of the running filter");
  // ⚠️ ONE mid-week pick, shared, or two rows describe two different weeks.
  assert.equal((imp.match(/Math\.floor\(plan\.weeks\.length \/ 2\)/g) || []).length, 1,
    "the two rows choose their own week, so they can describe different weeks");
  // And the false causal claim is gone.
  assert.doesNotMatch(app, /the answers you edited do not/,
    "the 'none' copy claims WHY again, and that claim was false for the runner who reported it");
});

test("BLOCKER: a rebuilt picker's buttons are wired, and there is one binder", () => {
  // ⚠️⚠️ THE HALF THAT #goalBody NEVER NEEDED. The [data-set] binding is PER BUTTON at wire() time,
  // and syncStatus is called both from wire() and from the click handler long afterwards — so buttons
  // written into the DOM by that later call have no onclick at all. Without the rebind the runner
  // sees the right two options and neither can be tapped: the looks-live-does-nothing class this
  // project has shipped three times. Driven in a browser during the fix; guarded structurally here.
  const app = nocomment(APP);
  assert.match(app, /function bindSegButtons\(s\) \{/, "the binder has been inlined again");
  const sync = app.slice(app.indexOf("function syncStatus"), app.indexOf("function syncFitSrc"));
  assert.match(sync, /bindSegButtons\(dseg\)/,
    "syncStatus rebuilds the picker and does not re-wire it, so neither option can be tapped");
  // ⚠️ ONE DEFINITION, TWO CALLERS — a hand copy in syncStatus is the fix-one-builder trap.
  assert.equal((app.match(/function bindSegButtons\(/g) || []).length, 1, "two binders");
  // ⚠️ THE TWO CALLERS TAKE DIFFERENT FORMS and a single regex counted only one of them: wire()
  // passes it by reference to forEach, syncStatus calls it. Assert each shape rather than a total.
  assert.match(app, /\.forEach\(bindSegButtons\)/, "wire() no longer binds the segments at all");
  assert.equal((app.match(/\bbindSegButtons\b/g) || []).length, 3,
    "expected exactly the definition and its two callers");
  // ⚠️ AND THE SEG'S CHILDREN ARE REPLACED, NOT THE .q — the .q carries its own setup-off class and
  // the .seg carries the aria-labelledby linkFormLabels gave it, and that pass bails on an
  // already-labelled group, so a replaced .q comes back unnamed to a screen reader.
  assert.match(sync, /dseg\.innerHTML = built/, "the whole .q is being replaced");
  assert.doesNotMatch(sync, /dq\.innerHTML =/, "the .q is being replaced, losing its class and its label");
});

test("BLOCKER: an unanswered days question is never answered for the runner", () => {
  // ⚠️ CAUGHT BY AN EXISTING GUARD DURING THIS FIX. The seeder writes "" on a first run so nothing is
  // selected and draftFromForm refuses to build until the runner chooses. The first version of the
  // clamp turned that "" into Number("") === 0, folded it to the minimum, and silently pre-answered
  // the question — so a first-time runner would never have had to choose.
  const app = nocomment(APP);
  const sv = app.slice(app.indexOf("function daySegVal"), app.indexOf("function dayCapNote"));
  assert.match(sv, /draft\.days === ""/, "daySegVal no longer protects the unanswered state");
  const sync = app.slice(app.indexOf("function syncStatus"), app.indexOf("function syncFitSrc"));
  assert.match(sync, /if \(draft\.days !== "" && draft\.days != null\) draft\.days =/,
    "syncStatus writes a clamped answer over an unanswered question");
});
