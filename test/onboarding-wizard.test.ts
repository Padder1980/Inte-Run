import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The first-run onboarding wizard. It builds the plan a step at a time and ends by letting the runner
 * PICK between real plan variants. These are structural guards on the wiring that a browser walk-through
 * proved once but a test has to keep true — the wizard reuses the whole existing save pipeline, so the
 * risk is a wire coming loose, not the questions themselves.
 */
const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const fn = (name: string) => {
  const i = html.indexOf("function " + name + "(");
  return i < 0 ? "" : html.slice(i, i + 4000);
};

test("first launch — native OR web — goes to the wizard, not the old form or Today", () => {
  // The launch flow used to split native (→ setup form) from web (→ Today). Both now open the wizard.
  // ⚠️ RESTATED, NOT RELAXED: this asserted the literal `state.screen = "wizard"` INSIDE the welcome
  // handler, so extracting the four lines into startWizard() -- which "Start a new plan" now shares --
  // broke a guard whose invariant was untouched. Scoped to a HOW rather than a WHAT, which is a pattern
  // this project has recorded a dozen times. The chain is asserted instead, every link falsifiable, and
  // it is STRONGER than the old form because it also proves the draft is cleared on the way in.
  const launch = html.slice(html.indexOf("if (FIRST_RUN) {"), html.indexOf("if (FIRST_RUN) {") + 900);
  assert.match(launch, /startWizard\(\)/, "the first-run welcome no longer opens the wizard");
  assert.doesNotMatch(launch, /state\.screen = "setup"/, "first-run still opens the old long form");
  const sw = fn("startWizard");
  assert.match(sw, /state\.screen = "wizard"/, "startWizard does not open the wizard");
  assert.match(sw, /draft = \{\}/, "startWizard does not clear the draft, so a second plan starts mid-answers");
  assert.match(sw, /state\.wizStep = 0/, "startWizard does not reset the step");
});

test("render() has a wizard branch that draws and wires it", () => {
  assert.match(html, /if \(state\.screen === "wizard"\) \{/, "render has no wizard branch");
  const branch = html.slice(html.indexOf('if (state.screen === "wizard") {'), html.indexOf('if (state.screen === "wizard") {') + 1200);
  assert.match(branch, /viewWizard\(\)/, "the wizard branch does not render viewWizard");
  assert.match(branch, /wireWizard\(\)/, "the wizard branch does not wire its controls");
  // Full-screen, focused: the bottom nav is hidden so a tester cannot fall out of onboarding by accident.
  assert.match(branch, /nav\.style\.display = "none"/, "the wizard leaves the bottom nav live");
  assert.match(branch, /seedSetupDraft\(\)/, "the wizard does not seed the draft (its fields would be blank)");
});

test("the wizard reuses the ONE build pipeline and lands on Today", () => {
  const finish = fn("wizardFinish");
  assert.ok(finish.length > 100, "wizardFinish is missing");
  // Same sequence doSaveProfile uses — draftFromForm -> applyProfile -> adoptPlan — not a second builder.
  assert.match(finish, /draftFromForm\(\)/, "wizardFinish does not build from the shared draftFromForm");
  assert.match(finish, /applyProfile\(/, "wizardFinish does not run the plan through applyProfile");
  assert.match(finish, /adoptPlan\(/, "wizardFinish does not adopt the plan through adoptPlan");
  assert.match(finish, /state\.tab = "today"/, "the wizard does not land on Today when it finishes");
});

test("the variant picker builds REAL plans, not mock cards", () => {
  const vars = fn("wizVariants");
  assert.ok(vars.length > 100, "wizVariants is missing");
  // Each card is applyProfile run at a different day count — the existing generator, different input.
  assert.match(vars, /applyProfile\(draftFromForm\(\)\)/, "the variants are not generated from the real engine");
  assert.match(vars, /draft\.days = String\(/, "the variants do not vary days-per-week");
  assert.match(vars, /draft\.days = savedDays/, "the variant loop does not restore the runner's own day choice");
});

test("the persisted draft is what makes a step-at-a-time form reach the build", () => {
  // Only the current step's fields are in the DOM, so draftFromForm reads earlier answers back from the
  // draft. Without this the plan would build from blanks for every field not on the last screen.
  assert.match(html, /function wizFieldVal\(id\)/, "wizFieldVal is gone — earlier steps' answers would be lost");
  // These reads live only in draftFromForm; if they revert to a raw $("...") the wizard loses that answer.
  assert.match(html, /wizFieldVal\("s_rectime"\)/, "the 5 km time is read from the DOM only, not the persisted draft");
  assert.match(html, /wizFieldVal\("s_date"\)/, "the race date is read from the DOM only, not the persisted draft");
});

test("a runner who backs out re-enters the wizard, not the old form", () => {
  // The example-plan banner is the fallback landing; for a non-personalized runner it must reopen the wizard.
  assert.match(html, /setupBanner\.onclick = \(\) => \{ state\.screen = profile\.personalized \? "setup" : "wizard"/,
    "the example-plan banner opens the old setup form for a first-run runner");
});

test("Start my plan opens the extras popup (coach + motivation, now or later)", () => {
  // The offer is one-shot, right after the plan starts — matched to the "Understanding your sessions"
  // guide style so a new runner meets one popup vocabulary, not two.
  assert.match(html, /function openExtrasOffer\(\)/, "openExtrasOffer is missing");
  assert.match(html, /setTimeout\(openExtrasOffer, /, "wizardFinish does not open the extras popup");
  const render = fn("renderExtras");
  assert.ok(render.length > 100, "renderExtras is missing");
  // Both pages, both buttons, and the "Later" flow that shows where to find it.
  assert.match(render, /Do it now/, "the Do it now button is gone");
  assert.match(render, />Later</, "the Later button is gone");
  assert.match(render, /Any time in Profile/, "the second page (where-to-find-it) is gone");
  // ⚠️ Do it now is a MINI-WIZARD INSIDE the popup now (coach page -> why page -> done), not a jump to
  // the setup screen. The pages are named on EXTRAS.step; assert both are handled and the final saves.
  assert.match(render, /step === "coach"/, "the coach page inside the popup is gone");
  assert.match(render, /step === "why"/, "the why page inside the popup is gone");
  // The coach cards' select+preview wiring lives in wireExtrasCoaches (so renderExtras stays inside the
  // window this test reads); renderExtras calls it, and picking a coach there still saves the choice.
  assert.match(render, /wireExtrasCoaches\(body\)/, "renderExtras no longer wires its coach cards");
  assert.match(fn("wireExtrasCoaches"), /COACH\.cfg\.coach = /, "picking a coach in the popup no longer saves it");
  assert.match(fn("wireExtrasCoaches"), /coachPreview\(/, "the popup coach cards have no working Preview");
  // The why page reuses the profile's whyRowsHtml/wireWhyInputs so answers persist to WHY on change.
  assert.match(render, /whyRowsHtml\("xw_"\)/, "the popup's why page no longer uses the shared whyRowsHtml");
  // ⚠️ The auto-guide ("Understanding your sessions") must stand aside while the extras popup is up,
  // or a new runner sees TWO overlapping popups the first time Today loads.
  const auto = fn("maybeAutoGuide");
  assert.match(auto, /EXTRAS/, "maybeAutoGuide does not wait for the extras popup — two popups will stack");
});

test("every wizard step fits on a 375-wide phone", () => {
  // ⚠️ MEASUREMENT-BASED. At 375×812 the level step was +90px, plan +187px, schedule +20px. Card-only
  // titles, a compact plan-card layout and a lead-line trim brought each to 0. These grep-based guards
  // fail if the specific bloaters come back — they are not a substitute for measuring, they are a
  // low-cost cage around the shape that measured clean.
  //
  // The status cards on the WIZARD's level step must be compact (no two-line description). The compact
  // flag is passed by viewWizard's level branch; statusCards renders the description only otherwise.
  assert.match(html, /statusCards\(draft\.status[^)]*, \{ compact: true \}\)/,
    "the wizard's level step no longer uses compact status cards — descriptions will overflow the step");
  // The plan card had a duplicative "focus" sub-line; removed to save a row per card.
  assert.doesNotMatch(html, /"wz-plan-focus"/,
    "the plan cards' focus sub-line is back — three of them will overflow the plan step");
  // Reminder-time field is only rendered when reminders are ON (an off-toggle needing no time saves a row).
  assert.match(html, /rmOn === "1" \? '<div class="q"><label>Reminder time<\/label>/,
    "the reminder time is always rendered — the schedule step will overflow when reminders are off");
});

test("the trial day is moved if the adjacent plan sessions are hard", () => {
  // ⚠️ The plan is built BEFORE the trial date is committed, so we can ask whether the neighbouring
  // days are hard (threshold, VO2, long run) and pick the nearest easier day if so.
  // findGoodTrialDay must exist and be called inside wizardFinish.
  assert.match(html, /function findGoodTrialDay\(/, "findGoodTrialDay is missing");
  const finish = fn("wizardFinish");
  // The trial-commit logic moved into commitScheduledTrial (shared with doSaveProfile so the two can't
  // drift); wizardFinish calls it, and for a wizard pick — which never sets a clash-move — it still
  // resolves the day through findGoodTrialDay.
  assert.match(finish, /commitScheduledTrial\(\)/, "wizardFinish does not commit the scheduled trial");
  assert.match(fn("commitScheduledTrial"), /findGoodTrialDay\(tIso\)/, "the scheduled trial is not resolved through findGoodTrialDay");
  // The helper must check ALL THREE days — the trial day must be free of plan sessions, AND
  // neither neighbour should be a hard session.
  const helper = fn("findGoodTrialDay");
  assert.match(helper, /effortOn\(iso\) !== "rest"/, "findGoodTrialDay does not reject a trial day that already has a plan session");
  assert.match(helper, /effortOn.*isoAdd.*-1/, "findGoodTrialDay does not check the day before the trial");
  assert.match(helper, /effortOn.*isoAdd.*1/, "findGoodTrialDay does not check the day after the trial");
  // It must prefer the original date when all three conditions are met.
  assert.match(helper, /if \(isGoodDay\(preferredIso\)\) return preferredIso/, "findGoodTrialDay does not short-circuit on the original day");
});

test("a trial dropped on a day that has a run asks first, then moves the RUN out — owner's rule", () => {
  // The clash prompt is gated on a real plan: a returning runner editing their profile. First-run
  // setup / the wizard has no plan yet, so onTrialDayPick just records the pick and findGoodTrialDay
  // resolves any clash at save, as before.
  const pick = fn("onTrialDayPick");
  assert.ok(pick.length > 100, "onTrialDayPick is missing");
  assert.match(pick, /profile && profile\.personalized/, "the clash prompt is not gated on a real plan");
  assert.match(pick, /runOnIso\(/, "onTrialDayPick does not look for a run on the chosen day");
  assert.match(pick, /confirmSheet\(/, "onTrialDayPick moves things without asking first");
  assert.match(pick, /draft\.trialMoveClash = 1/, "confirming the prompt does not record the move intent");
  // The profile date picker is wired to it.
  assert.match(html, /trialDay2\.onchange = \(\) => onTrialDayPick\(trialDay2\)/,
    "the profile trial picker is not wired to onTrialDayPick");
  // On commit, a confirmed clash moves the RUN (not the trial); with no confirmed clash it falls back
  // to moving the trial via findGoodTrialDay.
  const commit = fn("commitScheduledTrial");
  assert.match(commit, /if \(draft\.trialMoveClash\)/, "commitScheduledTrial ignores the confirmed move");
  assert.match(commit, /moveSession\(clash\.week, clash\.sess/, "commitScheduledTrial does not move the clashing run out");
  assert.match(commit, /findGoodTrialDay\(tIso\)/, "commitScheduledTrial drops the no-clash fallback");
  // ⚠️ UNDO-SAFE: the run-move must run AFTER doSaveProfile's undo snapshot (which captures
  // dayOverride), or Undo cannot put the run back in its slot.
  const save = fn("doSaveProfile");
  const snap = save.indexOf("undoSnap = {"), move = save.indexOf("commitScheduledTrial()");
  assert.ok(snap > 0 && move > snap, "the run is moved before the undo snapshot — Undo would not restore it");
});

test("⚠️ the trial lands on a day with no RUN — strength and mobility do not block it", () => {
  // ⚠️ FOUND ON A REAL PHONE. A 5-6 day plan carries strength and mobility on most days, so when
  // findGoodTrialDay treated ANY non-rest session as occupying the day it could not find a free day
  // and fell back to the runner's chosen day -- even when that day already held a RUNNING session.
  // The trial then stacked on the run, invisible behind the run's own dot in the week strip, and the
  // runner reported "it didn't add my trial anywhere". A strength or mobility day is a fine home for a
  // 2 km trial (the plan itself stacks strength onto running days); only another RUN is the problem.
  //
  // Lift the real helper and run it against a plan where every day is a run EXCEPT a mobility-only
  // Thursday. Picking Friday (a run) must move the trial to Thursday, not leave it on the run.
  const at = html.indexOf("function findGoodTrialDay(");
  assert.ok(at >= 0, "findGoodTrialDay is not in the build");
  let depth = 0, end = -1;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (!depth) { end = i + 1; break; } }
  }
  const src = html.slice(at, end);
  const PRIMARY_TYPES = { easy: 1, long: 1, recovery: 1, threshold: 1, vo2: 1, strides: 1, "race-specific": 1, race: 1 };
  const isoAdd = (iso: string, days: number) => {
    const p = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt;
  };
  const effDay = (s: any) => s.dayIndex;
  const todayIso = () => "2020-01-01"; // far in the past so no future candidate is skipped
  const run = (di: number, eff = "easy") => ({ dayIndex: di, type: "easy", effort: eff });
  const week = (startIso: string, sessions: any[]) => ({ startIso, sessions });
  const make = (sessW0: any[], sessW1: any[] = [0, 1, 2, 3, 4, 5, 6].map((d) => run(d))) => {
    const PLAN = { weeks: [week("2026-06-01", sessW0), week("2026-06-08", sessW1)] };
    return new Function("PLAN", "isoAdd", "PRIMARY_TYPES", "effDay", "todayIso", src + "; return findGoodTrialDay;")(
      PLAN, isoAdd, PRIMARY_TYPES, effDay, todayIso);
  };
  const mobility = (di: number) => ({ dayIndex: di, type: "mobility", effort: "none" });
  const strength = (di: number) => ({ dayIndex: di, type: "strength", effort: "moderate" });

  // 2026-06-01 is Mon; Thu = +3 = 2026-06-04, Fri = +4 = 2026-06-05.
  // Every day is an easy run except Thursday, which is mobility-only.
  const fullExceptThu = [run(0), run(1), run(2), mobility(3), run(4), run(5), run(6)];
  const find = make(fullExceptThu);

  // Picking Friday (a run) must MOVE the trial to the mobility-only Thursday, never leave it on the run.
  assert.equal(find("2026-06-05"), "2026-06-04",
    "the trial stayed on a running day instead of moving to the run-free mobility day");

  // Picking the mobility day itself must KEEP it there — strength/mobility never block the trial.
  assert.equal(find("2026-06-04"), "2026-06-04",
    "a mobility-only day was rejected as a trial home; strength/mobility must not count as a run");

  // A strength-only day is equally a valid home.
  const strengthThu = make([run(0), run(1), run(2), strength(3), run(4), run(5), run(6)]);
  assert.equal(strengthThu("2026-06-04"), "2026-06-04",
    "a strength-only day was rejected as a trial home");

  // ⚠️ The neighbour guard still bites on a hard RUN: a free day flanked by a hard run must be rejected.
  // Thu is mobility (free) but Fri is a HARD run — so picking Thu must move away from the hard neighbour.
  const hardFriday = make([mobility(0), mobility(1), mobility(2), mobility(3), run(4, "hard"), mobility(5), mobility(6)]);
  assert.notEqual(hardFriday("2026-06-04"), "2026-06-04",
    "the trial sat next to a hard run — the neighbour guard stopped working");
});

test("beginners are not asked for a 5 km time or weekly mileage", () => {
  const ids = fn("wizStepIds");
  assert.ok(ids.length > 50, "wizStepIds is missing");
  // fitness only for building/runners; volume only for runners (never a beginner).
  assert.match(ids, /if \(st === "building" \|\| \(st && !beginner\)\) ids\.push\("fitness"\)/, "the fitness step gate changed");
  assert.match(ids, /if \(st && !beginner\) ids\.push\("volume"\)/, "the weekly-distance step gate changed");
});
