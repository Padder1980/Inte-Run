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

test("coaches with their own wording genuinely differ", () => {
  // ⚠️ Scoped to the coaches that HAVE a variant for the prompt, not to the whole roster. It used to
  // require all four to differ, which was right when four was the roster — five more voices were
  // cast on 2026-08-03 and they share the default text, so the old assertion read that shared text
  // as duplicate personality. The property worth protecting is unchanged: a coach who claims its own
  // wording for a moment must not be saying the same thing as another coach who claims one too.
  const varied = PROMPTS.filter((p) => p.variants);
  assert.ok(varied.length >= 15, "expected the pace/why lines to carry variants");
  for (const p of varied) {
    const owners = COACH_IDS.filter((c) => p.variants && p.variants[c]);
    const said = new Set(owners.map((c) => promptTextFor(p, c)));
    assert.equal(said.size, owners.length, `${p.id} has duplicate wordings across coaches`);
  }
  // And the original four must still each own wording somewhere, or personality has quietly leaked
  // out of the feature while the tests stayed green.
  for (const c of ["guide", "pacer", "motivator", "technician"] as const) {
    const owns = varied.filter((p) => p.variants && p.variants[c]).length;
    assert.ok(owns >= 10, `${c} should own its own wording for at least ten moments, has ${owns}`);
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
