import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROMPTS,
  COACHES,
  COACH_IDS,
  promptsFor,
  selectPrompt,
  canPlay,
  markPlayed,
  shouldInterrupt,
  newPromptHistory,
  allPromptIds,
  type PromptDef,
} from "../src/live/coach-prompts.ts";

test("every prompt id is unique and non-empty (ids are permanent audio keys)", () => {
  const ids = allPromptIds();
  assert.equal(ids.length, PROMPTS.length);
  assert.equal(new Set(ids).size, ids.length, "duplicate prompt id");
  for (const id of ids) assert.match(id, /^[a-z0-9_]+$/, `id ${id} must be filename-safe`);
});

test("every coach binds to a distinct voice", () => {
  const voices = COACH_IDS.map((c) => COACHES[c].voice);
  assert.equal(new Set(voices).size, voices.length, "two coaches share a voice");
  for (const c of COACH_IDS) assert.ok(COACHES[c].name && COACHES[c].description);
});

test("the catalogue covers every required trigger", () => {
  const required = [
    "session-prep", "warmup-start", "session-start", "easy-settle", "long-run-settle",
    "tempo-start", "threshold-hold", "interval-start", "interval-work", "recovery-start",
    "hill-start", "strength-start", "technique", "halfway", "milestone-distance",
    "final-effort", "cooldown-start", "session-complete", "paused", "resumed",
    "ended-early", "safety-effort",
  ];
  for (const trig of required) {
    assert.ok(PROMPTS.some((p) => p.trigger === trig), `no prompt for trigger ${trig}`);
  }
});

test("selectPrompt returns an eligible prompt and respects session-type filtering", () => {
  const h = newPromptHistory();
  const easy = selectPrompt("easy-settle", "easy", 0, h);
  assert.ok(easy, "expected an easy-settle prompt for an easy run");
  assert.equal(easy!.trigger, "easy-settle");
  // easy-settle prompts are scoped to easy/recovery — they must not fire on a vo2 session.
  assert.equal(selectPrompt("easy-settle", "vo2", 0, h), null);
});

test("selectPrompt prefers higher priority", () => {
  // safety-effort has a critical-priority prompt; ensure the selector returns a high-priority one.
  const h = newPromptHistory();
  const safety = selectPrompt("safety-effort", "easy", 0, h)!;
  assert.ok(safety.priority >= 90, "safety prompt should be critical priority");
});

test("minimum repeat interval blocks a too-soon replay, then allows it later", () => {
  const h = newPromptHistory();
  const p = PROMPTS.find((x) => x.trigger === "milestone-distance")!;
  markPlayed(p, 100, h);
  assert.equal(canPlay(p, 100 + p.minRepeatSec - 1, h), false, "should be blocked inside the window");
  assert.equal(canPlay(p, 100 + p.minRepeatSec, h), true, "should be allowed at the window edge");
});

test("a one-shot prompt does not repeat within a session", () => {
  const h = newPromptHistory();
  const first = selectPrompt("halfway", "easy", 600, h)!;
  markPlayed(first, 600, h);
  // Both halfway lines are one-shots; after playing one, the other may still fire once, but the
  // same one cannot replay soon after.
  assert.equal(canPlay(first, 601, h), false);
});

test("variety: equal-priority prompts rotate least-recently-played first", () => {
  const h = newPromptHistory();
  const a = selectPrompt("technique", "easy", 0, h)!;
  markPlayed(a, 0, h);
  const b = selectPrompt("technique", "easy", 300, h)!; // after repeat window
  assert.notEqual(a.id, b.id, "should pick a different technique cue for variety");
});

test("interruption: only an interrupting, higher-priority prompt replaces the current one", () => {
  const ambient: PromptDef = PROMPTS.find((p) => p.trigger === "easy-settle")!;
  const safety: PromptDef = PROMPTS.find((p) => p.trigger === "safety-effort")!;
  assert.equal(shouldInterrupt(safety, ambient), true, "safety should interrupt ambient");
  assert.equal(shouldInterrupt(ambient, safety), false, "ambient must not interrupt safety");
  assert.equal(shouldInterrupt(ambient, null), true, "anything plays when nothing is playing");
});

test("missing-audio safety: selection is pure and never throws on an unknown trigger/type", () => {
  const h = newPromptHistory();
  // A trigger with no matching prompts for this session type yields null, not an error.
  assert.equal(selectPrompt("strength-start", "easy", 0, h), null);
  assert.doesNotThrow(() => selectPrompt("halfway", "cross-training", 0, h));
});
