import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * TRAINING ZONES — Support › Tools. Added 2026-08-15.
 *
 * ⚠️ THE PAGE EXISTS BECAUSE profile.maxHr WAS READ IN SIX PLACES AND WRITTEN IN NONE. maxHrEstimate()
 * has always preferred a measured ceiling over the age estimate, and the zones panel on every run told
 * the runner to "add your measured max heart rate in your profile" — a field that did not exist
 * anywhere in the app. The promise was live and the field was not, which is this project's
 * computed-and-discarded trap pointing the other way round.
 *
 * The number this page writes governs the wrist's zone colours and the coach's safety cue, so the
 * guards below are about REACH and REFUSAL, not about layout.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function fnOf(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
  const src = html.slice(at, rel > 0 ? at + 1 + rel : at + 9000);
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("maxHr is NOT in DEFAULT_PROFILE — absent must mean unanswered", () => {
  const html = page();
  const at = html.indexOf("DEFAULT_PROFILE");
  const src = html.slice(at, html.indexOf("}", at) + 1);
  // ⚠️ THE weeklyVolumeKm LESSON, WHICH COST THIS PROJECT A REBUILT PLAN FOR EVERY EXISTING RUNNER.
  // A default sitting in every stored profile is an answer nobody gave. Here it would silently govern
  // the watch's zone colours and the safety cue for people who never opened this screen.
  assert.ok(!/\bmaxHr\b/.test(src), "maxHr must not have a default — absent is how maxHrEstimate knows to use age");
});

test("saving the ceiling reaches the watch", () => {
  const html = page();
  // The commit path lives in wire(); find it by the id it writes rather than by a line number.
  const at = html.indexOf("const zrCommit");
  assert.ok(at > 0, "zrCommit is missing — nothing commits the ceiling");
  const src = html.slice(at, at + 700).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(/saveProfileStore\(\)/.test(src), "the ceiling must be persisted");
  // ⚠️ The wrist colours its heart by zone from the maxHr in its payload, and the coach's safety cue
  // fires above 92% of the same number. A profile write alone leaves the two halves of one product
  // judging the same heartbeat differently — the exact split maxHrEstimate() was written to end.
  assert.ok(/syncWatch\(\)/.test(src), "saving a new maximum must re-sync the watch");
});

test("an out-of-range maximum is refused, never clamped", () => {
  const html = page();
  const at = html.indexOf("if (zrMax) zrMax.oninput");
  assert.ok(at > 0, "the max-HR input handler is missing");
  const src = html.slice(at, at + 900).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(/n >= 120 && n <= 230/.test(src), "the range check is missing");
  // ⚠️ A typo of 1740 clamped to 230 is a number the runner never chose, silently governing the wrist
  // and the safety cue from then on. Refusing leaves the bad value on screen to be corrected.
  assert.ok(!/Math\.(min|max)\s*\(\s*230/.test(src) && !/Math\.(min|max)\s*\(\s*120/.test(src),
    "an out-of-range maximum must be refused rather than clamped to the boundary");
  assert.ok(/return;/.test(src), "the handler must bail out rather than commit a rejected value");
});

test("clearing the field removes the key rather than storing a zero", () => {
  const html = page();
  const at = html.indexOf("const zrCommit");
  const src = html.slice(at, at + 400);
  // ⚠️ Storing 0 would be a phantom answer with a different failure: maxHrEstimate rejects it and
  // falls back to age anyway, so it LOOKS fine — until a future reader treats "present" as "measured".
  assert.ok(/delete profile\.maxHr/.test(src), "clearing must delete the key, not store 0 or an empty string");
});

test("the page reads the app's zone ladder instead of defining a second one", () => {
  const src = fnOf("zonesView");
  // ⚠️ CLAUDE.md records that the 50/60/70/80/90 boundaries live in three places already —
  // HR_ZONE_FLOOR, the watch's WorkoutManager.hrZone and the engine's estimateHrZones — and that they
  // must move together. A fourth copy inside this page would drift the moment any of them changed.
  assert.ok(/HR_ZONE_FLOOR/.test(src), "zonesView must derive its rows from HR_ZONE_FLOOR");
  assert.ok(/HR_ZONE_NAME/.test(src), "zonesView must use the app's zone names");
  assert.ok(!/0\.5\s*,\s*0\.6/.test(src), "the boundaries must not be re-listed here");
});

test("auto-calculate is one toggle, and it commits the state it is moving TO", () => {
  const html = page();
  const view = fnOf("zonesView");
  // ⚠️ ONE TOGGLE, NOT TWO BUTTONS (owner, 2026-08-15). Save / "Use the estimate" made a single
  // either-or choice look like two actions, and the page carried three paragraphs explaining itself.
  assert.ok(/id="zrAuto"/.test(view), "the auto-calculate switch is missing");
  assert.ok(/role="switch"/.test(view), "it must be a real switch for assistive tech");
  assert.ok(!/zrSave|zrClear/.test(view), "the old two-button pair must be gone");
  // With auto on the field shows the estimate but is not the runner's to type.
  assert.ok(/disabled/.test(view), "the field must be disabled while auto-calculate is on");

  const at = html.indexOf("if (zrAuto) zrAuto.onclick");
  assert.ok(at > 0, "the toggle handler is missing");
  const h = html.slice(at, at + 700).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ aria-checked IS THE STATE BEFORE THE TAP. Written the other way round the toggle was inert:
  // auto-on, tapped, committed null, stayed auto-on. Nothing threw and the switch still animated —
  // only the field staying disabled gave it away, and only because it was tested.
  assert.ok(/wasAuto/.test(h), "the handler must name the pre-tap state rather than reading it twice");
  assert.ok(/wasAuto \? \(maxHrEstimate\(\)[^)]*\|\| \d+\) : null/.test(h),
    "turning auto OFF must adopt the number on screen; turning it ON must clear the override");
});

test("every id the zones page wires actually exists in its markup", () => {
  const html = page();
  const view = fnOf("zonesView");
  const at = html.indexOf("const zrCommit");
  const wiring = html.slice(at, at + 2600);
  // ⚠️ The invented-identifier trap, third outing in this project: a profile button once clicked
  // #saveSetup, which is nowhere in the app. It built, typechecked, passed everything and did nothing.
  for (const id of ["zrMax", "zrAuto", "zrHint"]) {
    assert.ok(view.includes('id="' + id + '"'), id + " is wired but never rendered");
    assert.ok(wiring.includes(id), id + " is rendered but never wired");
  }
});
