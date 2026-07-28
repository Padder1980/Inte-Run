import assert from "node:assert/strict";
import { test } from "node:test";
import { COACH_IDS, PROMPTS, promptTextFor, promptsFor } from "../src/live/coach-prompts.ts";

test("every prompt has non-empty text for every coach", () => {
  for (const p of PROMPTS) {
    for (const c of COACH_IDS) {
      const t = promptTextFor(p, c);
      assert.ok(t && t.trim().length > 0, `${p.id}/${c} is empty`);
    }
  }
});

test("a coach without a variant falls back to the shared text", () => {
  const plain = PROMPTS.find((p) => !p.variants)!;
  for (const c of COACH_IDS) assert.equal(promptTextFor(plain, c), plain.text);
});

test("the four coaches genuinely differ where variants exist", () => {
  const varied = PROMPTS.filter((p) => p.variants);
  assert.ok(varied.length >= 15, "expected the new pace/why lines to carry variants");
  for (const p of varied) {
    const said = new Set(COACH_IDS.map((c) => promptTextFor(p, c)));
    assert.equal(said.size, COACH_IDS.length, `${p.id} has duplicate wordings across coaches`);
  }
});

// These are pre-generated clips: a coach can never read a live number aloud.
test("no prompt text contains digits", () => {
  for (const p of PROMPTS) {
    for (const c of COACH_IDS) {
      assert.ok(!/\d/.test(promptTextFor(p, c)), `${p.id}/${c} contains a digit`);
    }
  }
});

test("the new triggers are all populated", () => {
  for (const trig of ["pace-behind", "pace-ahead", "pace-on", "keep-going",
                      "why-inspire", "why-reason", "why-goal", "why-anchor"] as const) {
    assert.ok(PROMPTS.some((p) => p.trigger === trig), `no prompts for ${trig}`);
  }
});

test("why prompts are one-shot, and pace nudges cannot nag", () => {
  for (const p of PROMPTS.filter((x) => x.trigger.startsWith("why-"))) {
    assert.ok(p.minRepeatSec >= 3600, `${p.id} should be once per session`);
  }
  for (const p of PROMPTS.filter((x) => x.trigger.startsWith("pace-"))) {
    assert.ok(p.minRepeatSec >= 90, `${p.id} repeats too freely`);
  }
});

test("pace prompts apply to every session type", () => {
  for (const p of PROMPTS.filter((x) => x.trigger.startsWith("pace-"))) {
    assert.equal(p.sessionTypes, "all");
  }
  assert.ok(promptsFor("pace-behind", "easy").length >= 3);
});
