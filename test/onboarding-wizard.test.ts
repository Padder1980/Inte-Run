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
  const launch = html.slice(html.indexOf("if (FIRST_RUN) {"), html.indexOf("if (FIRST_RUN) {") + 900);
  assert.match(launch, /state\.screen = "wizard"/, "the first-run welcome no longer opens the wizard");
  assert.doesNotMatch(launch, /state\.screen = "setup"/, "first-run still opens the old long form");
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
  assert.match(render, /COACH\.cfg\.coach = /, "picking a coach in the popup no longer saves it");
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
  assert.match(finish, /findGoodTrialDay\(draft\.trialIso\)/, "wizardFinish does not call findGoodTrialDay");
  // The helper must check BOTH neighbours — day before AND day after — to protect the trial.
  const helper = fn("findGoodTrialDay");
  assert.match(helper, /effortOn.*isoAdd.*-1/, "findGoodTrialDay does not check the day before the trial");
  assert.match(helper, /effortOn.*isoAdd.*1/, "findGoodTrialDay does not check the day after the trial");
  // It must prefer the original date when both neighbours are safe.
  assert.match(helper, /if \(isGoodDay\(preferredIso\)\) return preferredIso/, "findGoodTrialDay does not short-circuit on the original day");
});

test("beginners are not asked for a 5 km time or weekly mileage", () => {
  const ids = fn("wizStepIds");
  assert.ok(ids.length > 50, "wizStepIds is missing");
  // fitness only for building/runners; volume only for runners (never a beginner).
  assert.match(ids, /if \(st === "building" \|\| \(st && !beginner\)\) ids\.push\("fitness"\)/, "the fitness step gate changed");
  assert.match(ids, /if \(st && !beginner\) ids\.push\("volume"\)/, "the weekly-distance step gate changed");
});
