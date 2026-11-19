// pc-fakewatch (Road Map; found in B10, step 0 of the App Store checklist, fixed 2026-11-19).
//
// The Ready? check on Today and the "How you feel" sheet printed "From your watch: Slept 7.5 h · Resting HR normal" to
// everybody, watch or not, from a hard-coded demo constant — { sleepHours: 7.5, restingHrDelta: 0, hrvStatus: "normal" } —
// and fed the same numbers to RC.assessReadiness, whose advice the sheet, Ask Alfie and the briefing read. Invented health
// data, on the screen an App Store reviewer opens. Nothing reads sleep or resting heart rate from a watch or from Health.
//
// Guarded here, from the BUILT page over the real engine (RC): readinessInput, renderReadiness and feelSheetHtml, rendered
// for EVERY combination of the answers the sheet itself offers (read off its own buttons, not listed here):
//   * neither screen shows a watch reading;
//   * readiness is built only from what the runner answered (motivation, never asked, defaulted to "high" too);
//   * removing the made-up readings changes nobody's advice (at 7.5 h and no change they never added anything);
//   * and no hard-coded sleep, resting heart rate or HRV is left anywhere in the app's code.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function renderReadiness(");
assert.ok(at0 >= 0, "renderReadiness is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));
const APP_TS = readFileSync(fileURLToPath(new URL("../web/app.ts", import.meta.url)), "utf8");

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
// Comments quote the very strings this file forbids, so they go first (a block comment only from the start of a line).
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const state: any = { dayType: "quality", subj: {} };
const app = new Function("RC", "state",
  constDecl("BAND") + "\n" + ["readinessInput", "renderReadiness", "feelSheetHtml", "esc"].map(fnBody).join("\n") +
  "\nreturn { readinessInput, renderReadiness, feelSheetHtml };")(RC, state);

/** The answers the sheet offers, read off its own buttons: { soreness: [...], energy: [...], ... } and dayType. */
function offered(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const sheet = app.feelSheetHtml();
  for (const m of sheet.matchAll(/data-fseg="([^"]+)">([\s\S]*?)<\/div>/g)) {
    out[m[1]!] = [...m[2]!.matchAll(/data-v="([^"]+)"/g)].map((x) => x[1]!);
  }
  return out;
}
/** Every combination of the subjective answers (dayType is not an answer about the runner). */
function everyAnswer(): Array<Record<string, string>> {
  const opts = offered();
  const fields = Object.keys(opts).filter((f) => f !== "dayType");
  assert.ok(fields.length >= 3, "the sheet no longer offers the check-in's answers — this test no longer covers it");
  let all: Array<Record<string, string>> = [{}];
  for (const f of fields) all = all.flatMap((a) => opts[f]!.map((v) => ({ ...a, [f]: v })));
  return all;
}
const WATCH_WORDS = /From your watch|Slept|Resting HR|resting heart|HRV/i;

test("BLOCKER: neither the Ready? check nor the How you feel sheet shows a watch reading, for any answer", () => {
  const answers = everyAnswer();
  assert.ok(answers.length > 100, "fewer combinations than the sheet offers: " + answers.length);
  for (const subj of answers) {
    state.subj = subj;
    for (const dayType of offered().dayType ?? ["quality", "easy"]) {
      state.dayType = dayType;
      const card = app.renderReadiness();
      assert.doesNotMatch(card, WATCH_WORDS, "the Ready? check shows a watch reading for " + JSON.stringify({ dayType, ...subj }));
    }
    assert.doesNotMatch(app.feelSheetHtml(), WATCH_WORDS, "the How you feel sheet shows a watch reading for " + JSON.stringify(subj));
  }
});

test("BLOCKER: readiness is built only from what the runner answered", () => {
  const asked = Object.keys(offered()).filter((f) => f !== "dayType");
  for (const subj of everyAnswer().slice(0, 12)) {
    state.subj = subj;
    const input = app.readinessInput();
    for (const k of Object.keys(input)) {
      assert.ok(asked.includes(k), "readiness is given '" + k + "', which the runner was never asked");
    }
    for (const k of asked) assert.equal(input[k], subj[k], "the answer to " + k + " did not reach the readiness check");
  }
});

test("Removing the made-up readings changes nobody's advice", () => {
  // The old input carried 7.5 h of sleep, no change in resting heart rate and a motivation of "high" nobody was asked
  // about; at those values the engine added nothing, so every answer reads exactly as before.
  for (const subj of everyAnswer()) {
    state.subj = subj;
    const now = RC.assessReadiness(app.readinessInput());
    const before = RC.assessReadiness({ ...app.readinessInput(), sleepHours: 7.5, restingHrDelta: 0, motivation: "high" });
    assert.deepEqual(now, before, "the advice changed for " + JSON.stringify(subj));
  }
});

test("BLOCKER: no hard-coded sleep, resting heart rate or HRV anywhere in the app", () => {
  for (const [where, src] of [["web/app.ts", APP_TS], ["the built page", SRC]] as const) {
    const code = decomment(src);
    assert.doesNotMatch(code, /\bsleepHours\s*:\s*[\d.]/, where + " gives readiness a sleep figure nobody measured");
    assert.doesNotMatch(code, /\brestingHrDelta\s*:\s*-?[\d.]/, where + " gives readiness a resting heart rate nobody measured");
    assert.doesNotMatch(code, /\bhrvStatus\s*:\s*["']/, where + " gives readiness an HRV reading nobody measured");
    assert.doesNotMatch(code, /From your watch/, where + " still draws a \"From your watch\" line");
  }
});
