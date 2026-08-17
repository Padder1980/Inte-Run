import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The VOICE layer's pace guards, from the 2026-08-17 walking run.
 *
 * The engine (session-runtime) got its own guards — the evidence grace, the plausibility floor, the
 * held-pace expiry — in test/live-session.test.ts. These pin the WEB layer's half of the same
 * defects, because the two layers disagreed for months and the runner heard the disagreement:
 * the engine's paceMessage has always stayed quiet about a slow verdict on a non-work step
 * ("running easy slower than the band is fine"), while coachPaceTick spoke a correction every
 * hundred seconds to a WALKER on an easy run, with numbers behind it.
 *
 * Reads the BUILT web/app.html — same precedent as gps-distance and warmup-delivery. Run
 * `node web/app.ts` first.
 */
function lift(names: string[]) {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

function tickHarness() {
  const src = lift(["coachPaceTick"]);
  const triggers: string[] = [];
  const readouts: any[] = [];
  const COACH: any = { paceSince: 0, paceWas: "", lastPaceCueAt: -999, paceCorrectionPending: false };
  const coachPaceTick = new Function(
    "COACH", "coachTrigger", "speakPaceNumbers", "PACE_HOLD_SEC", "PACE_QUIET_SEC",
    src + "; return coachPaceTick;",
  )(COACH, (t: string) => triggers.push(t), (s: any, f: boolean) => readouts.push({ s, f }), 20, 100);
  return { COACH, triggers, readouts, tick: coachPaceTick };
}

/** A verdict held long enough that only policy, not the hold, decides what happens. */
function holdVerdict(h: ReturnType<typeof tickHarness>, snap: any, type: string) {
  h.tick(snap, type, 0);     // establishes the verdict
  h.tick(snap, type, 25);    // 25 s later — past PACE_HOLD_SEC, past nothing else
}

test("a slow verdict on a non-work step is never spoken — the engine's own rule, honoured", () => {
  const h = tickHarness();
  const snap = { paceStatus: "slow", step: { kind: "steady", targetRpe: { min: 2, max: 4 } } };
  holdVerdict(h, snap, "easy");
  assert.deepEqual(h.triggers, [],
    "a walker on an easy run was told to pick it up — the layer the log stays quiet about spoke anyway");
  assert.deepEqual(h.readouts, [], "and numbers were spoken behind it");
  // ⚠️ The suppression must not burn the quiet window, or a legitimate later cue is pushed back.
  assert.equal(h.COACH.lastPaceCueAt, -999, "a suppressed nudge consumed the 100 s quiet window");
});

test("a slow verdict on WORK still gets its correction", () => {
  const rep = tickHarness();
  holdVerdict(rep, { paceStatus: "slow", step: { kind: "rep" } }, "vo2");
  assert.deepEqual(rep.triggers, ["pace-behind"], "a slow interval rep lost its correction");
  assert.equal(rep.readouts.length, 1, "the rep correction lost its numbers");

  // A threshold block is `steady`, not `rep` — work is decided by effort there, the engine's own
  // isWorkStep predicate. Gate by kind alone and every tempo session loses its slow-side coaching.
  const tempo = tickHarness();
  holdVerdict(tempo, { paceStatus: "slow", step: { kind: "steady", targetRpe: { min: 6, max: 7 } } }, "threshold");
  assert.deepEqual(tempo.triggers, ["pace-behind"], "a slow threshold block lost its correction");
});

test("a fast verdict is corrected on any step — too fast is never fine", () => {
  const h = tickHarness();
  holdVerdict(h, { paceStatus: "fast", step: { kind: "steady", targetRpe: { min: 2, max: 4 } } }, "easy");
  assert.deepEqual(h.triggers, ["pace-ahead"], "the ease-off correction on a genuinely fast easy run is gone");
});

test("the spoken readout refuses a pace no human could run", () => {
  // ⚠️ THE LAST GATE before a fabricated number is said aloud in the coach's own recorded voice.
  // Upstream culls should catch it first; this is the one that cannot be allowed to fail open.
  const src = lift(["speakPaceNumbers", "paceWords"]);
  const COACH: any = { pendingNums: null, current: null, numT: null, cfg: { volume: 1 } };
  const speakPaceNumbers = new Function(
    "COACH", "VOICE_AVAILABLE", "paceSentenceIds", "coachClip", "coachFlushNumbers", "clearTimeout", "setTimeout",
    src + "; return speakPaceNumbers;",
  )(COACH, true, () => ["frag"], () => null, () => {}, () => {}, () => 0);
  const band = { minSecPerKm: 328, maxSecPerKm: 358 };

  speakPaceNumbers({ currentPaceSecPerKm: 133, step: { targetPace: band } }, true);
  assert.equal(COACH.pendingNums, null, "a 2:13/km fabrication was queued to be read out loud");

  speakPaceNumbers({ currentPaceSecPerKm: 697, step: { targetPace: band } }, false);
  assert.ok(COACH.pendingNums, "an honest slow pace lost its readout");
  assert.match(COACH.pendingNums.text, /11 minutes 37/, "the spoken pace does not match the pace");
});

test("the UI tick culls impossible paces on BOTH sides before anything downstream sees them", () => {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function gpsUiTick(");
  assert.ok(at > 0, "gpsUiTick not found in the build");
  const body = html.slice(at, html.indexOf("function gpsStatusText", at)).replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /cur > 1200/, "the slow-side cull is gone — a stopped runner shows a frozen pace");
  assert.match(body, /cur < 150/,
    "the fast-side cull is gone — a settle lump reads as a 2:13/km pace and fires the wrong-direction cue");
});
