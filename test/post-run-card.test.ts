import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildWarmup } from "../src/science/warmup.ts";

/**
 * ⚠️ DOES THE POST-RUN CARD DESCRIBE THE SESSION THAT ACTUALLY TOOK PLACE?
 *
 * The owner's question, after a real run-walk session. It found a card that told a beginner their
 * precisely-prescribed session was *"a run by feel"* — and then, one paragraph later, praised them
 * for *"pace and feel agreeing"* when no pace had been judged at all.
 *
 * The cause is worth remembering: `plannedPaceBandOf` returns null for a run-walk, and that is
 * CORRECT — each kilometre contains both running and walking, so it cannot be held to either pace.
 * What was wrong is that "no band" was rendered as "no prescription". Two different facts, one
 * sentence, and the one it chose was false.
 */
const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
function lift(name: string) {
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
const NAMES = ["isRunWalkShape", "isStrideStep", "withGeneratedWarmup", "plannedPaceBandOf",
  "plannedRpeBandOf", "runAnalysis", "splitsVsTargetHtml", "debriefParagraphs", "esc", "fmtPace",
  "fmtSec", "spanText", "workLabel", "stepTargetText", "stepChips", "structureRows", "sessionStepText"];
const M: any = new Function("warmupCardFor", "PACE_MODEL_VERSION",
  NAMES.map(lift).join(";\n") + "; return {" + NAMES.join(",") + "};")(
    (s: any) => buildWarmup(s, "beginner"), "1.0.0");

/** The exact session the owner ran: a beginner run-walk long session. */
function runWalkSession() {
  const plan = generatePlan(
    { daysPerWeek: 3, experience: "beginner", includeStrength: false, runWalk: true,
      recent: { distanceMeters: 5000, timeSeconds: 2400 } } as never,
    { distance: "10k", targetTimeSeconds: 5400, raceDateIso: "2027-02-07", startDateIso: "2026-08-07" },
  );
  for (const w of plan.weeks) for (const s of w.sessions) if (/run–walk/i.test(s.title)) return s;
  throw new Error("no run-walk session in the beginner plan");
}
const recordFor = (sess: any, over: any = {}) => {
  const live = M.withGeneratedWarmup(sess);
  return {
    id: "r", t: sess.title, type: sess.type, d: "7 Aug", dateIso: "2026-08-07",
    dist: 2.6, time: 1560, pace: 600, rpe: 4,
    pband: M.plannedPaceBandOf(live), pmix: M.isRunWalkShape(live), rband: M.plannedRpeBandOf(live),
    splits: [{ km: 1, sec: 615 }, { km: 2, sec: 598 }, { km: 3, sec: 590 }],
    steps: M.sessionStepText(live), route: [], ...over,
  };
};
const strip = (x: any) => String(x).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("⚠️ a run-walk session really is prescribed — the plan gives its running a pace", () => {
  // The premise. If the run steps carried no pace, "no set pace" would be true and there would be
  // nothing to fix; the whole finding rests on this.
  const sess: any = runWalkSession();
  const runStep = (sess.steps || []).find((s: any) => s.kind === "rep");
  assert.ok(runStep?.targetPaceSecPerKm,
    "the run-walk's running carries no pace, so the card's 'no set pace' would be honest");
  const walkStep = (sess.steps || []).find((s: any) => s.kind === "recovery");
  assert.ok(walkStep && !walkStep.targetPaceSecPerKm, "the walk should not carry a pace");
});

test("⚠️ the card never tells a run-walk runner their session was 'by feel'", () => {
  const run = recordFor(runWalkSession());
  assert.equal(run.pband, null, "a run-walk should NOT be judged by kilometre — it mixes run and walk");
  assert.equal(run.pmix, true, "the run-walk shape was not recognised, so the copy cannot be right");
  const a = M.runAnalysis(run);
  const prose = M.debriefParagraphs(run, a).map(strip).join(" ");
  const splits = strip(M.splitsVsTargetHtml(a));
  for (const [where, text] of [["debrief", prose], ["splits table", splits]] as const) {
    assert.ok(!/by feel/i.test(text), `the ${where} still calls a prescribed session "by feel": ${text}`);
    assert.ok(!/no set pace/i.test(text), `the ${where} still says the session had no set pace: ${text}`);
    assert.ok(/walk/i.test(text), `the ${where} does not explain why a split cannot judge it: ${text}`);
  }
});

test("⚠️ it never claims 'pace and feel agreeing' when no pace was judged", () => {
  // Two sentences on one screen contradicting each other is worse than the weaker one alone.
  for (const [what, run] of [
    ["run-walk", recordFor(runWalkSession())],
    ["free run", { id: "f", t: "Free run", type: "easy", dist: 5, time: 1800, pace: 360, rpe: 3,
      rband: { min: 2, max: 4 }, splits: [{ km: 1, sec: 360 }, { km: 2, sec: 355 }], route: [] }],
  ] as const) {
    const a = M.runAnalysis(run);
    const prose = M.debriefParagraphs(run, a).map(strip).join(" ");
    assert.ok(!a.band, `${what}: fixture has a band, so it cannot test this`);
    assert.ok(/Effort came in at/.test(prose), `${what}: the effort line is missing`);
    assert.ok(!/[Pp]ace and feel agreeing/.test(prose),
      `${what}: claims pace agreement with no pace band — "${prose}"`);
  }
});

test("a genuinely by-feel run still says so", () => {
  // ⚠️ The fix must not silence the honest case. A free run really has no prescription.
  const free: any = { id: "f", t: "Free run", type: "easy", dist: 5, time: 1800, pace: 360,
    splits: [{ km: 1, sec: 360 }, { km: 2, sec: 355 }], route: [] };
  const prose = M.debriefParagraphs(free, M.runAnalysis(free)).map(strip).join(" ");
  assert.match(prose, /by feel/i, "a free run no longer says it was by feel");
});

test("a paced session still gets judged, and praised only when earned", () => {
  // ⚠️ The other direction: nothing here may weaken the judging of an ordinary prescribed run, and
  // the project's no-unconditional-praise rule still applies.
  const band = { minSecPerKm: 300, maxSecPerKm: 320 };
  const onTarget: any = { id: "a", type: "easy", dist: 3, time: 930, pace: 310, rpe: 3, pband: band,
    rband: { min: 2, max: 4 }, splits: [{ km: 1, sec: 310 }, { km: 2, sec: 308 }, { km: 3, sec: 312 }], route: [] };
  const tooFast: any = { ...onTarget, id: "b",
    splits: [{ km: 1, sec: 250 }, { km: 2, sec: 248 }, { km: 3, sec: 252 }] };
  const good = M.debriefParagraphs(onTarget, M.runAnalysis(onTarget)).map(strip).join(" ");
  const bad = M.debriefParagraphs(tooFast, M.runAnalysis(tooFast)).map(strip).join(" ");
  assert.match(good, /inside the target band/i, "an on-target run is no longer recognised");
  assert.match(good, /[Pp]ace and feel agreeing/, "a genuinely paced run lost the pace-agreement line");
  assert.ok(!/inside the target band/i.test(bad), "a run 60s/km too fast is praised for being in band");
  assert.match(bad, /quicker than the plan asked/i, "a too-fast run is not told so");
});
