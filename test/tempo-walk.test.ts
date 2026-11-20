// pc-tempowalk (Road Map; found 6 October 2026, fixed 2026-11-19).
//
// "4 × 10′ tempo / 2′ walk" says the walk is deliberate ("it keeps every block honest"), but reps() built its breaks as an
// "Easy jog recovery" with the easy pace band — so the session card, the watch and the voice coach all ran a 2′ jog, and
// one of the two recorded recovery lines ("Good rep. Jog easy…") told a walking runner to jog.
//
// Guarded here:
//   * across EVERY session format the library can build (several runners' paces), a break the TITLE calls a walk is a
//     walk in the steps (no pace to hold, a label that says walk), and one it calls a jog or a float is not;
//   * the coach: a session whose breaks are walks never gets a line marked jog, and the app's two pickers — the live one
//     and the lists handed to Swift — are actually given that flag, set wherever a session starts;
//   * its debrief still treats it as repeats (efforts and recoveries), never as a beginner's run-walk;
//   * the "Understanding your sessions" guide calls its 2′ walking, not "gentle jogging".
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listWorkouts } from "../src/plan/session-templates.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { promptsFor, selectPrompt, newPromptHistory, PROMPTS } from "../src/live/coach-prompts.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function coachWalkBreaks(");
assert.ok(at0 >= 0, "coachWalkBreaks is not in the build — run node web/app.ts");
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
const constDecl = (name: string) => { const at = SRC.indexOf("\nconst " + name + " = "); assert.ok(at >= 0, "no const " + name); return SRC.slice(at, SRC.indexOf("};\n", at) + 2); };
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
const APP: any = new Function(constDecl("EFFORT_HINT") + "\n" +
  ["coachWalkBreaks", "isRunWalkShape", "plannedStepMeters", "paceWindowOf", "paceStampFor", "plannedPaceBandOf", "parseGuide"].map(fnBody).join("\n") +
  "\nreturn { coachWalkBreaks, isRunWalkShape, paceStampFor, parseGuide };")();

/** Every session format the library builds, for a slow, a middling and a quick runner. */
function everySession(): any[] {
  const out: any[] = [];
  for (const t of [35 * 60, 25 * 60, 18 * 60 + 20]) {
    for (const o of listWorkouts(deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: t })) as any[]) out.push(o.session);
  }
  return out;
}
/** The word a title gives its breaks: "3 × 8′ threshold / 2′ jog" → "jog". */
const breakWord = (title: string) => /\/\s*[\d.]+\S*\s+(walk|jog|float)\b/i.exec(title)?.[1]?.toLowerCase() ?? null;
const isWalk = (st: any) => /\bwalk/i.test(String(st.label || "")) && !st.targetPaceSecPerKm;

test("BLOCKER: a break the title calls a walk is a walk in the steps, and a jog is a jog — every format", () => {
  const sessions = everySession().filter((s) => breakWord(s.title));
  assert.ok(sessions.some((s) => breakWord(s.title) === "walk"), "no format names a walking break any more — this test covers less than it says");
  assert.ok(sessions.some((s) => breakWord(s.title) === "jog"), "no format names a jogging break any more");
  for (const s of sessions) {
    const rec = (s.steps || []).filter((st: any) => st.kind === "recovery");
    assert.ok(rec.length, `"${s.title}" names a break and has none`);
    if (breakWord(s.title) === "walk") {
      for (const st of rec) assert.ok(isWalk(st), `"${s.title}": a break it calls a walk is "${st.label}"` + (st.targetPaceSecPerKm ? " with a pace to hold" : ""));
    } else {
      for (const st of rec) assert.ok(!isWalk(st), `"${s.title}": a break it calls a ${breakWord(s.title)} is a walk`);
    }
  }
});

test("BLOCKER: the coach never tells a runner on a walking break to jog", () => {
  // In the catalogue: the lines that say jog are marked, and a walking session's recovery lines leave them out.
  for (const p of PROMPTS.filter((x) => x.trigger === "recovery-start")) {
    assert.equal(!!p.jog, /\bjog/i.test(p.text), `"${p.text}" ${p.jog ? "is marked jog but does not say it" : "says jog but is not marked"}`);
  }
  const lines = promptsFor("recovery-start", "threshold", { walkBreaks: true });
  assert.ok(lines.length, "a walking break gets no recovery line at all");
  assert.ok(lines.every((p) => !/\bjog/i.test(p.text)), "a walking break can still hear a line that says jog");
  const h = newPromptHistory();
  for (let t = 0; t < 4; t++) {
    const p = selectPrompt("recovery-start", "threshold", t * 720, h, { walkBreaks: true });
    assert.ok(p && !/\bjog/i.test(p.text), "break " + (t + 1) + " of a walking session said: " + (p && p.text));
    h.lastPlayedAt[p!.id] = t * 720;
  }
  // In the app: the walking session is recognised, a jogging one is not…
  const sessions = everySession();
  const walky = sessions.find((s) => breakWord(s.title) === "walk")!, joggy = sessions.find((s) => breakWord(s.title) === "jog")!;
  assert.equal(APP.coachWalkBreaks(walky), true, `"${walky.title}" is not recognised as walking between blocks`);
  assert.equal(APP.coachWalkBreaks(joggy), false, `"${joggy.title}" is taken for a walking session`);
  // …and both pickers are handed the flag, which is set wherever a session starts.
  const wired = (fn: string, re: RegExp, what: string) => assert.match(decomment(fnBody(fn)), re, what);
  wired("coachTrigger", /RC\.selectPrompt\([^)]*walkBreaks: !!COACH\.walkBreaks/, "the live coach is not told the breaks are walks");
  wired("coachScheduledPrompt", /RC\.promptsFor\([^;]*walkBreaks: !!COACH\.walkBreaks/, "the locked-phone and watch lists are not told the breaks are walks");
  wired("beginLive", /COACH\.walkBreaks = coachWalkBreaks\(LIVE\.session\)/, "a phone run does not set the flag");
  wired("startOnWatch", /COACH\.walkBreaks = coachWalkBreaks\(s\)/, "a run sent to the watch does not set the flag");
  wired("coachResetSession", /COACH\.walkBreaks = false/, "a new session inherits the last one's breaks");
});

test("BLOCKER: its debrief treats it as repeats, never as a beginner's run-walk", () => {
  const walky = everySession().find((s) => breakWord(s.title) === "walk")!;
  assert.equal(APP.isRunWalkShape(walky), false, `"${walky.title}" is taken for a run-walk — its debrief would say the running stayed easy`);
  assert.equal(APP.paceStampFor(walky).pmix, "reps", `"${walky.title}" is not stamped as repeats`);
});

test("The session guide calls a 2′ walk walking, and a 2′ jog jogging", () => {
  const body = (title: string) => (APP.parseGuide(title).tokens || APP.parseGuide(title) || []).flatMap((t: any) => t.step ? [t.step.body] : []).join(" ");
  assert.match(body("4 × 10′ tempo / 2′ walk"), /2 minutes of walking/, "the guide still calls the walk jogging");
  assert.match(body("3 × 8′ threshold / 2′ jog"), /2 minutes of gentle jogging/, "the guide lost its jog wording");
});
