import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adaptSessionForHeat } from "../src/adapt/heat.ts";
import type { Session } from "../src/domain/types.ts";

/**
 * ADAPT FOR HEAT — rewriting a session's pace targets, on the runner's say-so. Added 2026-08-16.
 *
 * ⚠️ THE STANDING INSTRUCTION GOVERNS THIS WHOLE FEATURE (owner, 2026-08-03): "the app may observe
 * and it may propose; it may never change a pace, a plan or a target on its own. Every suggestion
 * ends in a choice the runner makes, and declining is a first-class answer that is remembered rather
 * than re-asked tomorrow." Nothing here writes anything until Adapt is tapped.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/**
 * ONE function's body, bounded by its own braces.
 *
 * ⚠️ NOT A CHARACTER WINDOW. `html.slice(at, at + 1800)` is how the "nothing is offered when there is
 * nothing honest to offer" guard used to read heatCard, and when the two conditions it looks for
 * moved into a shared heatOffer — one answer, read by the Today card AND by the briefing card, so
 * they cannot disagree — the window slid over the comment block below instead and the guard failed on
 * correct code. CLAUDE.md records this trap firing three times in one feature. A window guessed at
 * 1800 characters either truncates the function or runs into the next one.
 */
function fnOf(src: string, name: string): string {
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
const nocomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");

function sessionOf(steps: any[], extra: any = {}): Session {
  return {
    id: "s1", dayOfWeek: 1, type: "threshold", title: "test", description: "", intensity: "hard",
    estimatedDurationSeconds: steps.reduce((a, s) => a + (s.durationSeconds || 0), 0),
    steps, source: "generated", ...extra,
  } as Session;
}
const paced = (o: any) => ({ kind: "rep", label: "rep", targetPaceSecPerKm: { minSecPerKm: 240, maxSecPerKm: 250 }, ...o });

test("every pace band is slowed by the factor", () => {
  const s = sessionOf([paced({ durationSeconds: 300 })]);
  const out = adaptSessionForHeat(s, 1.04);
  const b = out.session.steps[0]!.targetPaceSecPerKm!;
  assert.equal(b.minSecPerKm, 250);   // 240 * 1.04
  assert.equal(b.maxSecPerKm, 260);   // 250 * 1.04
  assert.equal(out.changedSteps, 1);
});

test("a step with no pace target is left exactly as it was", () => {
  // ⚠️ HILL REPS CARRY NO PACE BY DESIGN — "pace on a hill is meaningless, RPE is the guide" — and
  // neither do jogged recoveries or strength work. The bug to avoid is not failing to scale a band
  // that is absent; it is reporting a session as adapted when nothing in it changed.
  const effort = { kind: "rep", label: "hill", durationSeconds: 45, targetRpe: { min: 8, max: 9 } };
  const s = sessionOf([effort, paced({ durationSeconds: 300 })]);
  const out = adaptSessionForHeat(s, 1.05);
  assert.deepEqual(out.session.steps[0], effort, "an effort-only step must be untouched");
  assert.equal(out.changedSteps, 1, "only the paced step counts as changed");
});

test("a session with NO paced steps reports effortOnly and changes nothing", () => {
  const s = sessionOf([{ kind: "rep", label: "hill", durationSeconds: 45, targetRpe: { min: 8, max: 9 } }]);
  const out = adaptSessionForHeat(s, 1.06);
  assert.equal(out.effortOnly, true);
  assert.equal(out.changedSteps, 0);
  assert.equal(out.session, s, "an unadaptable session must be handed back untouched, not cloned");
});

test("the two kinds of step move in opposite directions", () => {
  // ⚠️ THIS IS THE ARITHMETIC THAT MAKES A SESSION ADD UP. A step measured in DISTANCE still covers
  // that distance, so slowing it makes it take LONGER. A step measured in TIME still takes that
  // time, so slowing it covers LESS GROUND. Getting it the wrong way round would have a heat-adapted
  // interval session claim it finishes sooner.
  const distance = sessionOf([paced({ distanceMeters: 1000, durationSeconds: 245 })]);
  const dOut = adaptSessionForHeat(distance, 1.04);
  assert.ok(dOut.session.estimatedDurationSeconds > distance.estimatedDurationSeconds,
    "a distance-bound session must take longer when slowed");

  const timed = sessionOf([paced({ durationSeconds: 1200 })]);
  const tOut = adaptSessionForHeat(timed, 1.04);
  assert.equal(tOut.session.estimatedDurationSeconds, 1200,
    "a time-bound session takes exactly as long as it always did");
});

test("the effort targets do not move, because that is the whole claim", () => {
  // ⚠️ The evidence supports "this slower pace is the same effort". Shifting the RPE band as well
  // would be saying the session should feel EASIER, which is a different and unevidenced claim.
  const s = sessionOf([paced({ durationSeconds: 300, targetRpe: { min: 6, max: 7 } })], { targetRpe: { min: 6, max: 7 } });
  const out = adaptSessionForHeat(s, 1.06);
  assert.deepEqual(out.session.targetRpe, s.targetRpe);
  assert.deepEqual(out.session.steps[0]!.targetRpe, { min: 6, max: 7 });
});

test("the plan's mileage accounting is never touched", () => {
  // ⚠️ trainingDistanceMeters is what the volume model measures a runner's stated weekly distance
  // against. A hot Tuesday is not a smaller training week — they did the session they were set, in
  // worse conditions. Rewriting it would let one day's weather reshape the block's volume fit.
  const s = sessionOf([paced({ durationSeconds: 1200 })], { trainingDistanceMeters: 8000, estimatedDistanceMeters: 9000 });
  const out = adaptSessionForHeat(s, 1.05);
  assert.equal(out.session.trainingDistanceMeters, 8000, "the mileage figure must not move");
});

test("it never mutates the session it was given", () => {
  const s = sessionOf([paced({ durationSeconds: 300 })]);
  const before = JSON.stringify(s);
  adaptSessionForHeat(s, 1.08);
  assert.equal(JSON.stringify(s), before, "the plan is rebuilt from the profile; nothing may mutate it");
});

test("a factor of 1 or less is a no-op", () => {
  const s = sessionOf([paced({ durationSeconds: 300 })]);
  for (const f of [1, 0.9, 0]) {
    const out = adaptSessionForHeat(s, f);
    assert.equal(out.changedSteps, 0, "factor " + f + " must change nothing");
    assert.equal(out.session, s);
  }
});

// ---- the app side ------------------------------------------------------------------------------

test("the DECISION is stored, never the adapted session", () => {
  const html = page();
  const at = html.indexOf("function heatApplied(");
  assert.ok(at > 0, "heatApplied is missing");
  const src = html.slice(at, at + 900).replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ addExtra states the rule for the same reason: "storing baked steps would freeze old paces into
  // the logbook." An adapted session written to disk would still quote today's paces a month after a
  // re-anchor, so the decision persists and the session is re-derived on every render.
  assert.match(src, /adaptSessionForHeat/, "the session must be re-derived, not read back from storage");
  const save = html.slice(html.indexOf("function saveHeatAdapt("), html.indexOf("function saveHeatAdapt(") + 300);
  assert.ok(!/steps/.test(save), "the store must not contain steps");
  assert.match(html, /state\.heatAdapt\[sess\.id\] = \{ day: day, hour: hour \}/,
    "the stored decision should be nothing more than a day and an hour");
});

test("every surface that shows or runs a session applies the adaptation", () => {
  const html = page();
  // ⚠️ IF THESE DISAGREE THE FEATURE IS WORSE THAN NOTHING — the sheet would describe one session
  // while the live run counted another, or the wrist would run paces the phone was not showing.
  for (const fn of ["watchSessionPayload", "openSessionSheet", "startSession"]) {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at > 0, fn + " is missing");
    const src = html.slice(at, at + 700);
    assert.match(src, /heatApplied\(/, fn + " does not apply the heat adaptation");
  }
  // ⚠️ In startSession it must come BEFORE withGeneratedWarmup, which INHERITS the pace of the
  // existing warm-up step — adapting afterwards leaves a generated warm-up on the original band.
  const st = html.indexOf("function startSession(");
  const src = html.slice(st, st + 900);
  assert.ok(src.indexOf("heatApplied(") < src.indexOf("withGeneratedWarmup("),
    "the adaptation must be applied before the warm-up is generated");
});

/**
 * The whole statement starting at `at`, bounded by its own semicolon at depth zero.
 * ⚠️ NOT A CHARACTER WINDOW, for the same reason fnOf exists — and not an anchor on a VARIABLE NAME
 * either. This test used to find the accept handler by `if (heatDo) heatDo.onclick`, and it failed on
 * correct code the moment every heat control became a data- attribute bound by querySelectorAll (which
 * it had to, because the Today card and the briefing card render the same offer and two elements
 * sharing one id left the second one with no handler). A guard anchored on how something is spelled
 * breaks when the spelling changes for a good reason.
 */
function stmtAt(src: string, at: number): string {
  let d = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i]!;
    if (c === "(" || c === "{" || c === "[") d++;
    else if (c === ")" || c === "}" || c === "]") d--;
    else if (c === ";" && d === 0) return src.slice(at, i + 1);
  }
  throw new Error("unterminated statement");
}

test("accepting reaches the watch", () => {
  const html = page();
  const at = html.indexOf('document.querySelectorAll("[data-heatdo]")');
  assert.ok(at > 0, "the accept handler is missing");
  const src = nocomment(stmtAt(html, at));
  // ⚠️ The competitor tells its users to force-quit their watch app to pick adapted paces up. A wrist
  // quietly running the original targets after the runner accepted is the worst outcome of this whole
  // feature, and there is no reason for it here.
  assert.match(src, /syncWatch\(\)/, "accepting must re-sync the watch");
  assert.match(src, /saveHeatAdapt\(\)/, "the decision must be persisted");
  // And it writes the decision against the session the BUTTON names, not against a re-derived one.
  assert.match(src, /heatSessById\(b\.dataset\.heatdo\)/,
    "the accept handler no longer takes its session from the control it was rendered on");
});

test("a decline is remembered, but only for today", () => {
  const html = page();
  // ⚠️ Per the standing instruction a decline is a first-class answer and is not re-asked. But the
  // weather is a DIFFERENT QUESTION tomorrow, so unlike a pace flag this must not mute indefinitely.
  assert.match(html, /function heatDeclinedToday\(/, "the decline memory is missing");
  const at = html.indexOf("function heatDeclinedToday(");
  const src = html.slice(at, at + 260);
  assert.match(src, /todayIso\(\)/, "the decline must be scoped to a date, not stored forever");
});

test("nothing is offered when there is nothing honest to offer", () => {
  const html = page();
  // ⚠️ THERE IS ONE GATE AND BOTH SURFACES GO THROUGH IT. The Today card and the briefing-card block
  // ask the same question, and two copies of this test is how the card comes to offer something the
  // sheet then refuses — a control that looks live and is not, which is a defect class this project
  // has shipped three times. So the conditions are asserted on heatOffer, and both callers are
  // required to reach it. The BEHAVIOURAL half of this claim — that a 1.005 factor and a pace-free
  // hill session really do produce no offer — is driven through the real functions in
  // test/heat-custom.test.ts; a source assertion can only ever prove a string exists.
  const offer = nocomment(fnOf(html, "heatOffer"));
  assert.match(offer, /HEAT_MIN_FACTOR/, "a trivial adaptation must not be offered");
  // ⚠️ A hill session has no pace targets, so "adjust your paces" promises a change the app cannot
  // make and the accept would land on a session identical to the one before it.
  assert.match(offer, /changedSteps/, "a session with no paces must not be offered an adaptation");
  for (const caller of ["heatCard", "heatBlockHtml"]) {
    assert.match(nocomment(fnOf(html, caller)), /heatOffer\(/,
      caller + " no longer asks heatOffer whether there is anything to offer");
  }
  assert.match(nocomment(fnOf(html, "heatCard")), /heatChoice\(sess\) \|\| heatDeclinedToday\(sess\)/,
    "an answered card must stop asking");
});

test("past the model's range it declines to give a number", () => {
  const html = page();
  const at = html.indexOf("function heatSheetHtml(");
  const src = html.slice(at, at + 4200);
  // ⚠️ Above ~35°C the source data thins out. Printing the model's ceiling there would be an
  // extrapolation wearing the app's confidence.
  assert.match(src, /beyondModel/, "the sheet must handle conditions past the model's range");
  assert.match(src, /hotter than this app will put a pace to/, "it must say so plainly");
});

test("the copy promises effort, not training benefit", () => {
  const html = page();
  const at = html.indexOf("function heatSheetHtml(");
  const src = html.slice(at, at + 4500).replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ MATCH WITHIN ONE STRING LITERAL, NOT ACROSS A CONCATENATION. The built page is emitted JS, not
  // rendered HTML, so a sentence wrapped over two source lines appears there as
  // "…designed ' + 'for</b>" — and a regex spanning that join can never match however correct the
  // copy is. The first version of this assertion failed for exactly that reason and nothing was wrong.
  assert.match(src, /the effort it was designed/, "the effort wording is missing");
  assert.match(src, /Your effort targets do not change/, "the effort-targets line is missing");
  assert.ok(!/training benefit/i.test(src), "must not claim the same training benefit");
});
