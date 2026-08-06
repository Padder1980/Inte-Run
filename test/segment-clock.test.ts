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
  lift("withGeneratedWarmup") + "; return withGeneratedWarmup;")((s: any) => buildWarmup(s, ABILITY as any));

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
  assert.ok(names.includes("Strides"), `strides are not named as strides (got ${names.join(", ")})`);
  assert.ok(names.includes("Warm up"), "the easy raise is not named");
  // And the strides step really is the hard one — otherwise this test proves nothing.
  const strides = wu.find((s: any) => s.display === "Strides");
  assert.ok((strides.targetRpe?.max ?? 0) >= 5,
    "the strides step is not actually hard, so naming it separately would be pointless");
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
