// The target time's three meanings, held to one answer between the wizard and the save (2026-11-19).
//
// GOAL_BY_STATUS[status].time is true (a target is required), "optional" ("Building the habit": blank is a real answer) or
// false (no target asked), and every reader must test === true (notes/plan-profile.md, "A habit-builder may set a time goal,
// or leave it off"). The wizard's goal step once read it as truthy and refused a blank OPTIONAL box (pc-wizard-optional-target,
// fixed with §10 piece 4 and guarded in test/road-norace-app.test.ts). Two more readers were still wrong:
//   * saving (draftFromForm) ended its typo sentence "— or leave it blank." for EVERY status with a time, so a regular or
//     competitive runner who cleared the box was told to leave it blank, and doing so brought the same sentence back;
//   * the wizard asked a habit-builder to "Pick your race date." under a card that says "Target date".
//
// The invariant guarded: for EVERY status (derived from GOAL_BY_STATUS, not listed) and a blank, a mistyped and a real target,
// the wizard's goal step and the save agree on whether the answer is allowed. Lifted from the BUILT page over the real engine
// (RC): wizStepError, draftFromForm and its helpers, wizFieldVal, GOAL_BY_STATUS. The answers sit in draft.__f, as they do once
// the goal step is behind the runner; a race goal, so the no-race branch stands aside.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function wizStepError(");
assert.ok(at0 >= 0, "wizStepError is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));

function fnBody(name: string): string {
  const at = SRC.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at + 1, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constDecl(name: string): string {
  const at = SRC.indexOf("\nconst " + name + " = ");
  assert.ok(at >= 0, "no const " + name + " in the build");
  return SRC.slice(at, SRC.indexOf(";\n", at) + 1);
}

const FNS = ["wizStepError", "draftFromForm", "wizFieldVal", "isBeginnerStatus", "goalsForAge", "currentAgeAnswer",
  "derivedGoalS", "formStartIso", "strMinVal", "strLevelVal", "strGoalVal", "kitFromField", "kitToField", "strengthKitOf",
  "goalNoRaceNow", "isNoRace"];
const CONSTS = ["GOAL_BY_STATUS", "STR_DEFAULT_MIN", "STR_DEFAULT_LEVEL", "STR_DEFAULT_GOAL"];
const TODAY = "2026-11-19";

/** The wizard on a first run: the starter profile, the answers so far in the draft, no field of an earlier step on screen. */
function wizard() {
  const env: Record<string, unknown> = {
    RC, $: () => null, todayIso: () => TODAY,
    STORED: { name: "", status: "regular", goalDist: "half", targetS: 6300, targetSet: true, raceDate: "2027-07-22",
      startDateIso: "", longRunDay: 6, daysPerWeek: 5, strength: true, personalized: false },
  };
  const body = "let profile = STORED, draft = {}, state = { screen: 'wizard' };\n" +
    CONSTS.map(constDecl).join("\n") + "\n" + FNS.map(fnBody).join("\n") + "\n" +
    "return { wizStepError, draftFromForm, GOAL_BY_STATUS, set draft(v) { draft = v; } };";
  const names = Object.keys(env);
  return new Function(...names, body)(...names.map((n) => env[n]));
}
/** The goal step behind the runner: a race goal, status, distance and date answered, the target as given. */
function answers(w: any, status: string, target: string, date = "2027-03-14") {
  const dist = w.GOAL_BY_STATUS[status].dists[1] ?? w.GOAL_BY_STATUS[status].dists[0];
  w.draft = { status, goalkind: "race", days: "3", strength: "0", __live: true,
    __f: { s_dist: dist, s_date: date, s_target: target, s_rectime: "25:00", s_age: "40" } };
}
const saveError = (w: any): string | null => { try { w.draftFromForm(); return null; } catch (e) { return (e as Error).message; } };

test("BLOCKER: for every status, the wizard's goal step and saving agree on the target time", () => {
  const w = wizard();
  for (const status of Object.keys(w.GOAL_BY_STATUS)) {
    for (const target of ["", "1:5", "1:05:00"]) {
      answers(w, status, target);
      const wiz = w.wizStepError("goal"), save = saveError(w);
      assert.equal(wiz === null, save === null, status + " with target " + JSON.stringify(target) + ": the wizard " +
        (wiz === null ? "lets it through" : "refuses it (" + wiz + ")") + " but saving " + (save === null ? "accepts it" : "refuses it (" + save + ")"));
    }
  }
});

test("A runner who must give a target time is never told to leave it blank", () => {
  const w = wizard();
  const required = Object.keys(w.GOAL_BY_STATUS).filter((s) => w.GOAL_BY_STATUS[s].time === true);
  assert.ok(required.length > 0, "no status requires a target time any more — this test no longer covers anything");
  for (const status of required) {
    answers(w, status, "");
    assert.equal(w.wizStepError("goal"), "Enter your target time, e.g. 1:45:00.");
    assert.ok(saveError(w), status + ": a blank target was accepted");
    assert.doesNotMatch(saveError(w) ?? "", /leave it blank/, status + " is told to leave the target blank, which it may not");
  }
  // Where blank IS an answer, the save still says so when it refuses a typo.
  answers(w, "building", "1:5");
  assert.match(saveError(w) ?? "", /or leave it blank/, "a habit-builder's typo no longer says blank is fine");
});

test("The date question is a race date only where a target time is required", () => {
  const w = wizard();
  for (const status of Object.keys(w.GOAL_BY_STATUS)) {
    answers(w, status, w.GOAL_BY_STATUS[status].time === true ? "1:05:00" : "", "");
    assert.equal(w.wizStepError("goal"), "Pick your " + (w.GOAL_BY_STATUS[status].time === true ? "race" : "target") + " date.",
      status + ": the wizard names the date differently from the card above it");
  }
});
