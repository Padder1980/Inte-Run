import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { thresholdSession, vo2Session } from "../src/plan/session-templates.ts";
import { buildWarmup } from "../src/science/warmup.ts";
import { LiveSession } from "../src/live/session-runtime.ts";

/**
 * ⚠️ TWO THINGS THE OWNER ASKED FOR ON 2026-08-06, from watching a real session.
 *
 * 1. "i dont understand why the step 3 shows the actual work but its still labelled as warm up" — the
 *    badge showed the step's KIND, so "4 × 20s strides" at RPE 5–7 was announced as WARMUP. It is a
 *    warm-up step by kind (it is preparation and is excluded from training volume), but the badge is
 *    what a runner reads mid-stride and that read as a contradiction.
 * 2. "each segment needs a 'Lap Time' which resets at 0:00 each time a new section starts… enabling the
 *    runner to see how much of the work is left on that section." The total elapsed may run straight
 *    through, warm-up included — the per-section clock is what answers "how much of THIS is left".
 */
const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
const html = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function lift(name: string) {
  const h = html();
  const at = h.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = h.indexOf("{", at); i < h.length; i++) {
    if (h[i] === "{") d++;
    else if (h[i] === "}") { d--; if (!d) return h.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
let ABILITY = "intermediate";
const withGeneratedWarmup = new Function("warmupCardFor",
  lift("isStrideStep") + ";" + lift("withGeneratedWarmup") + "; return withGeneratedWarmup;")((s: any) => buildWarmup(s, ABILITY as any));

test("every generated warm-up phase says what it actually is", () => {
  // ⚠️ The owner's question, made into an invariant. Strides inside a warm-up must not be announced as
  // "warm up" — nor may the fix go the other way and leave a section with no name at all.
  const live = withGeneratedWarmup(vo2Session(paces, 1));
  const wu = (live.steps || []).filter((s: any) => s.kind === "warmup");
  assert.ok(wu.length >= 3, "the generated warm-up did not expand into phases");
  for (const s of wu) {
    assert.ok(s.display, `a warm-up step has no display name: "${s.label}"`);
  }
  const names = wu.map((s: any) => s.display);
  assert.ok(names.includes("Stride"), `strides are not named as strides (got ${names.join(", ")})`);
  assert.ok(names.includes("Warm up"), "the easy raise is not named");
  // And a stride really is the hard bit — otherwise naming it separately would prove nothing.
  const stride = wu.find((s: any) => s.display === "Stride");
  assert.ok((stride.targetRpe?.max ?? 0) >= 5,
    "the strides step is not actually hard, so naming it separately would be pointless");
});

test("⚠️ strides are repetitions with a walk back, not one block", () => {
  // The owner's second catch, from a live session: one step badged STRIDES with a single 6:15 clock.
  // "5 × 20s" existed in the label and nowhere the runner could act on — no way to know which stride
  // you are on, when to go, or how long the walk back is. The session library shipped and fixed this
  // exact defect on 2026-08-03; the generated warm-up kept it.
  const wu = (withGeneratedWarmup(vo2Session(paces, 1)).steps || [])
    .filter((s: any) => s.display === "Stride" || s.display === "Walk back");
  assert.ok(wu.length >= 4, "the strides block did not expand into repetitions");
  const strides = wu.filter((s: any) => s.display === "Stride");
  assert.ok(strides.length >= 2, "there is still only one stride step");

  // Each stride is ONE stride: a short effort, not a block containing its own recoveries.
  for (const s of strides) {
    assert.ok(s.durationSeconds <= 30,
      `a "stride" lasts ${s.durationSeconds}s — that is a block, not a repetition`);
    assert.ok(s.repeatIndex && s.repeatCount,
      "a stride carries no rep index, so the screen cannot say which one you are on");
  }
  // Every stride is followed by a recovery the runner can see and time.
  for (let i = 0; i < wu.length; i += 2) {
    assert.equal(wu[i]!.display, "Stride", `position ${i} of the block is not a stride`);
    assert.equal(wu[i + 1]?.display, "Walk back",
      `stride ${i / 2 + 1} is not followed by a walk back — including the last, which runs straight into the work`);
  }
  // ⚠️ And the block still takes exactly as long as it always did: 75s per stride was ALWAYS the
  // stride plus its walk back. If this drifts, every session carrying strides changed length.
  const total = wu.reduce((a: number, s: any) => a + (s.durationSeconds || 0), 0);
  assert.equal(total, strides.length * 75,
    "the strides block no longer costs 75s per stride — sessions have changed length");
});

test("⚠️ the WRITTEN brief still says '4 × 20″ strides', not eight lines", () => {
  // ⚠️ Splitting a step for the live screen changes what every WRITTEN view renders from it, and
  // structureRows also builds the snapshot stored on each logged run — so the Logbook's "what the
  // plan asked for" would have become a wall of "Walk back — easy until your breathing is back",
  // permanently, on runs already saved. A runner reading a plan and a runner mid-stride are asking
  // different questions of the same steps.
  const src = ["esc", "fmtPace", "fmtSec", "spanText", "workLabel", "stepTargetText", "stepChips", "structureRows"]
    .map(lift).join(";\n");
  const structureRows = new Function(src + "; return structureRows;")();
  const delivered = withGeneratedWarmup(vo2Session(paces, 1)).steps;
  const rows = structureRows(delivered, true);
  const stride = rows.filter((r: any) => /stride/i.test(String(r.lab)));
  assert.equal(stride.length, 1, `the strides block renders as ${stride.length} rows, not one`);
  assert.match(String(stride[0].lab), /^\d+ × /, "the grouped row lost its count");
  assert.ok(!rows.some((r: any) => /^Walk back/.test(String(r.lab))),
    "a walk back is printed as its own row in the written brief");
  // ⚠️ The walk back must still be SAID somewhere — the whole point of splitting the step was that it
  // existed only in prose. Grouping it back out of existence would undo that.
  assert.match(String(stride[0].rec), /walk back/i, "the grouped row does not mention the walk back");
  // And the block reports its WHOLE length, not one stride's. ⚠️ Derived from the steps, never a
  // constant — the first version of this assertion hardcoded the minutes of a different fixture and
  // failed on a correct build, which is the same class of mistake as a test that agrees with the bug.
  const blockSec = delivered
    .filter((s: any) => s.display === "Stride" || s.display === "Walk back")
    .reduce((a: number, s: any) => a + (s.durationSeconds || 0), 0);
  assert.ok(String(stride[0].chips).startsWith(Math.round(blockSec / 60) + " min"),
    `the strides row quotes "${stride[0].chips}" for a ${Math.round(blockSec / 60)}-minute block`);
});

test("⚠️ the grouped row keeps 'the last one', which is the whole prescription", () => {
  // ⚠️ The per-stride label deliberately drops "the last one (or two)" — that lead-in reads wrong on
  // the very stride it describes. Rebuilding the SUMMARY row from that stripped text changed what the
  // session asks for: "the last one or two at the pace you are about to run" became "at the pace you
  // are about to run", i.e. five 20-second warm-up strides at VO2 pace instead of one. And
  // sessionStepText snapshots this row onto every logged run, so it would have been permanent.
  const src = ["esc", "fmtPace", "fmtSec", "spanText", "workLabel", "stepTargetText", "stepChips", "structureRows"]
    .map(lift).join(";\n");
  const structureRows = new Function(src + "; return structureRows;")();
  for (const build of [() => vo2Session(paces, 1), () => thresholdSession(paces, 1)]) {
    const sess = build();
    const wu: any = buildWarmup(sess, ABILITY as any);
    const pot = (wu.phases || []).find((p: any) => p.phase === "potentiate");
    if (!pot) continue;
    const row = structureRows(withGeneratedWarmup(sess).steps, true)
      .find((r: any) => /strides/i.test(String(r.lab)));
    assert.ok(row, "no strides row");
    // The row must carry the block's OWN instruction verbatim, not a reconstruction of it.
    assert.ok(String(row.lab).includes(pot.effort),
      `the written row says "${row.lab}" where the warm-up asks for "${pot.effort}"`);
  }
});

test("⚠️ the segment clock is actually IN the card, not merely computed", () => {
  // ⚠️ Proved necessary by deletion: with the clock spliced out of the card's innerHTML entirely, all
  // the other tests here still passed — they measure stepElapsedSeconds from the engine, which is the
  // input to the clock rather than the clock. A test that verifies the ingredient and not the dish.
  const body = lift("liveUpdate");
  assert.match(body, /card\.innerHTML =[^;]*'<\/h4>' \+ seg \+/,
    "the segment clock is no longer rendered into the step card");
  assert.match(body, /class="lseg-left num">' \+ fmtPace\(left\)/, "the time-left figure is gone");
  assert.match(body, /const left = segTot \? Math\.max\(0, segTot - segEl\)/, "the time left is not derived from the section");
});

test("the step heading does not repeat the badge", () => {
  // ⚠️ This regex is built from a STRING, so it needs four backslashes in web/app.ts, not the two the
  // project's escaping rule asks for in a regex LITERAL. Written with two it shipped as \s inside a
  // string literal, which is a bare "s" — pattern ^Mobilises*[—-]s*, matching nothing, on every step.
  // Nothing threw; the card just kept printing "MOBILISE" above "Mobilise — Ankle rocks…".
  const src = html();
  const at = src.indexOf('new RegExp("^" + step.display');
  assert.ok(at > 0, "the heading strip is gone");
  const expr = src.slice(at, src.indexOf("\n", at)).replace(/,\s*""\)\s*$/, "");
  const strip = new Function("step", "return String(step.label).replace(" + expr + ', "");');
  const cases = [
    ["Mobilise", "Mobilise — Ankle rocks, 8–12 each side", "Ankle rocks, 8–12 each side"],
    ["Walk back", "Walk back — easy until your breathing is back", "easy until your breathing is back"],
    ["Settle", "Settle — 3 minutes easy.", "3 minutes easy."],
    // ⚠️ The index is part of the prefix on the most frequent step of all. Escaping alone would have
    // left "STRIDE 3/5" above "Stride 3 of 5 — …" — the same identifier three times in two lines.
    ["Stride", "Stride 3 of 5 — relaxed and progressive", "relaxed and progressive"],
  ];
  for (const [display, label, want] of cases) {
    assert.equal(strip({ display, label }).trim(), want,
      `badge "${display}" leaves heading "${strip({ display, label })}"`);
  }
});

test("the coach introduces the strides block once, not ten times", () => {
  // Ten steps in a row, each firing a step-start cue, is a coach talking over every acceleration for
  // six minutes.
  const body = lift("coachStepTrigger");
  assert.match(body, /display === "Walk back"[\s\S]{0,40}return null/,
    "a walk back still fires a step cue");
  assert.match(body, /display === "Stride"[\s\S]{0,60}return null/,
    "every stride still fires a step cue");
});

test("⚠️ StepView carries targetRpe, or the long-run lift gets the settle line", () => {
  // coachStepTrigger reads step.targetRpe.min to tell a long run's race-pace block from its easy
  // main. StepView did not carry the field, so on the live path that read was always undefined and
  // the lift moment got "patience early, sip fluids" — the exact instruction the split exists to
  // avoid. The schedule builder passed a raw step and got it right; the two disagreed silently.
  const live = withGeneratedWarmup(vo2Session(paces, 1));
  const rt = new LiveSession(live as any);
  rt.start(0);
  const step = rt.snapshot(0).step!;
  assert.ok(step.targetRpe, "StepView is not carrying targetRpe");
  assert.equal(typeof step.targetRpe!.min, "number", "targetRpe reached the view in the wrong shape");
});

test("the display name reaches the live screen, not just the step", () => {
  // A name the runtime drops on the floor is no better than no name.
  const live = withGeneratedWarmup(vo2Session(paces, 1));
  const rt = new LiveSession(live as any);
  rt.start(0);
  const snap = rt.snapshot(0);
  assert.ok(snap.step, "no current step");
  assert.equal(snap.step!.display, "Warm up",
    "StepView is not carrying `display` through — the badge would fall back to the kind");
});

test("the badge prefers the section's own name and never prints a raw kind", () => {
  const body = lift("liveUpdate");
  assert.match(body, /step\.display \|\| STEP_BADGE\[step\.kind\]/,
    "the live screen is back to printing step.kind directly");
  assert.match(html(), /STEP_BADGE = \{[^}]*rep: "Work"/,
    "a repetition is still badged 'rep' to the runner");
});

test("⚠️ the segment clock restarts at every section boundary", () => {
  // The heart of the request. Measured against the engine rather than the screen: stepElapsedSeconds
  // is what the card renders, so if it does not reset, nothing downstream can.
  const live = withGeneratedWarmup(thresholdSession(paces, 1));
  const rt = new LiveSession(live as any);
  rt.start(0);
  const seen: { step: number; seg: number }[] = [];
  let lastIndex = -1;
  for (let sec = 0; sec <= 60 * 60; sec += 5) {
    rt.update({ atMs: sec * 1000, distanceMeters: sec * 3 });
    const s = rt.snapshot(sec * 1000);
    if (!s.step) continue;
    if (s.step.index !== lastIndex) {
      // The first snapshot of a NEW section must be at (or within one tick of) zero.
      assert.ok(s.stepElapsedSeconds <= 5,
        `section ${s.step.index} opened with ${s.stepElapsedSeconds}s already on its clock`);
      lastIndex = s.step.index;
    }
    seen.push({ step: s.step.index, seg: s.stepElapsedSeconds });
  }
  assert.ok(lastIndex > 1, "the session never advanced past its first section");
  // And within a section it must actually count up.
  const mid = seen.filter((x) => x.step === 1);
  if (mid.length > 2) assert.ok(mid[mid.length - 1]!.seg > mid[0]!.seg, "the segment clock does not advance");
});

test("the total elapsed runs straight through, warm-up included", () => {
  // ⚠️ His call: the clock used to subtract the warm-up so the named minutes were what you watched,
  // which meant it read 0:00 for the whole warm-up and then switched labels mid-run. With a per-section
  // clock there is nothing left for the total to do except be the honest total.
  const body = lift("liveWorkElapsed");
  assert.match(body, /label: "Elapsed"/, "the total is labelled something other than Elapsed");
  assert.ok(!/label: "Warm-up"/.test(body), "the total still switches label mid-run");
  assert.ok(!/snap\.elapsedSeconds - LIVE\.warmSec/.test(body),
    "the total is subtracting the warm-up again — it would read 0:00 through the opening");
});

test("the section's length is printed once, not twice", () => {
  // The segment clock shows "0:24 / 3:00"; the target line underneath used to repeat "3:00".
  const body = lift("liveUpdate");
  const targetBlock = body.slice(body.indexOf("const tgt = ["), body.indexOf("const badge"));
  assert.ok(!/tgt\.push\(fmtPace\(step\.targetSeconds\)\)/.test(targetBlock),
    "the step's duration is printed both in the segment clock and in the target line");
  assert.match(targetBlock, /targetMeters/, "a distance-gated step no longer shows its distance");
});
