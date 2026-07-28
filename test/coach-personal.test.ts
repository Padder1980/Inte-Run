import test from "node:test";
import assert from "node:assert/strict";
import {
  PERSONAL_PROMPT_TEMPLATES, personalPrompts, personalPackSlug, promptTextFor, PROMPTS,
} from "../src/live/coach-prompts.ts";

const COACHES = ["guide", "pacer", "motivator", "technician"] as const;

test("every personal template carries a name slot in every coach's wording", () => {
  for (const p of PERSONAL_PROMPT_TEMPLATES) {
    for (const c of COACHES) {
      const t = promptTextFor(p, c);
      assert.ok(t.includes("{name}"), `${p.id}/${c} has no {name}: ${t}`);
    }
  }
});

test("substitution fills every slot, in the shared text and in each variant", () => {
  for (const p of personalPrompts("Alfie")) {
    assert.ok(!p.text.includes("{name}"), p.id);
    assert.ok(p.text.includes("Alfie"), p.id);
    for (const c of COACHES) {
      const t = promptTextFor(p, c);
      assert.ok(!t.includes("{name}") && t.includes("Alfie"), `${p.id}/${c}: ${t}`);
    }
  }
});

test("a blank or whitespace name yields no personal prompts at all", () => {
  assert.equal(personalPrompts("").length, 0);
  assert.equal(personalPrompts("   ").length, 0);
});

test("personal ids never collide with shared catalogue ids", () => {
  const shared = new Set(PROMPTS.map((p) => p.id));
  for (const p of PERSONAL_PROMPT_TEMPLATES) assert.ok(!shared.has(p.id), `collision: ${p.id}`);
  assert.equal(new Set(PERSONAL_PROMPT_TEMPLATES.map((p) => p.id)).size, PERSONAL_PROMPT_TEMPLATES.length);
});

test("personal triggers all exist in the shared catalogue, so a missing pack always has a fallback", () => {
  const sharedTriggers = new Set(PROMPTS.map((p) => p.trigger));
  for (const p of PERSONAL_PROMPT_TEMPLATES) {
    assert.ok(sharedTriggers.has(p.trigger), `${p.id} trigger ${p.trigger} has no name-free fallback`);
  }
});

test("the pack slug is a safe, stable folder name", () => {
  assert.equal(personalPackSlug("Alfie"), "alfie");
  assert.equal(personalPackSlug("  My Nan  "), "my-nan");
  assert.equal(personalPackSlug("Jo-Anne O'Neill"), "jo-anne-o-neill");
  assert.equal(personalPackSlug("../../etc/passwd"), "etc-passwd");
  assert.equal(personalPackSlug("!!!"), "");
  assert.ok(personalPackSlug("x".repeat(80)).length <= 24);
});

test("no personal line contains a digit — numbers can never be pre-generated", () => {
  for (const p of PERSONAL_PROMPT_TEMPLATES) {
    for (const c of COACHES) assert.ok(!/\d/.test(promptTextFor(p, c)), `${p.id}/${c}`);
  }
});

test("the four coaches say genuinely different things", () => {
  for (const p of PERSONAL_PROMPT_TEMPLATES) {
    const said = new Set(COACHES.map((c) => promptTextFor(p, c)));
    assert.equal(said.size, COACHES.length, `${p.id} has duplicate wordings`);
  }
});
