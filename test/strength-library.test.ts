import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { EQUIPMENT, PATTERNS, PATTERN_WHY,
  exerciseById, exerciseIds, alternativesFor } from "../src/strength/library.ts";
import { strengthSession, generalStrengthSession } from "../src/plan/session-templates.ts";

/**
 * A2 — ONE EXERCISE CATALOGUE, GROWN TO COVER RUNNA'S EQUIPMENT LIST.
 *
 * ⚠️ THERE USED TO BE TWO. `EX` in session-templates.ts (17 entries, built sessions) and
 * `STRENGTH_LIB` in web/app.ts (a hand-picked ~20, taught the Learn hub) — a cue fixed in one never
 * reached the other, and neither could answer "what needs no equipment", which A3's preferences stage
 * needs to ask. src/strength/library.ts is the one definition now; the guards below are DRIVEN
 * (execute the real catalogue and the real built page) rather than grepped, per this project's rule
 * that a source grep proves code exists and a driven check proves it is what runs.
 */

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/** The app's own runtime script block that holds the strength library page. */
function appBlock(): string {
  const blocks = [...APP.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const b = blocks.find((x) => x.includes("function strengthView("));
  assert.ok(b, "no emitted script block defines strengthView");
  return b!;
}
/** The POSES object literal, as declared in the built page — parsed for its top-level keys only. */
function posesKeys(): string[] {
  const block = appBlock();
  const m = /const POSES = \{([\s\S]*?)\n\};/.exec(block);
  assert.ok(m, "POSES not found in the built page");
  return [...m![1]!.matchAll(/^\s{2}([a-zA-Z0-9]+): \[/gm)].map((x) => x[1]!);
}

// ---- The catalogue itself ---------------------------------------------------------------------

test("BLOCKER: every exercise id is a unique, slug-shaped string", () => {
  const ids = exerciseIds();
  assert.ok(ids.length >= 60, "only " + ids.length + " exercises — below the 60+ target");
  assert.equal(new Set(ids).size, ids.length, "duplicate id in the catalogue");
  for (const id of ids) assert.match(id, /^[a-z][a-zA-Z0-9]*$/, "id " + id + " is not a slug");
});

test("BLOCKER: the sixteen original ids and their names/anims are unchanged", () => {
  // ⚠️ THESE ARE WHAT A RUNNER'S STORE CAN ALREADY HOLD. Renaming or re-pointing one orphans every
  // logged set for it exactly as A1 records for the id itself — the guarantee has to cover the whole
  // entry, not just the key.
  const original: Record<string, { name: string; anim?: string }> = {
    squat: { name: "Goblet / bodyweight squat", anim: "goblet-squat" },
    stepUp: { name: "Step-up", anim: "step-up" },
    splitSquat: { name: "Split squat", anim: "split-squat-dumbbell" },
    lunge: { name: "Reverse lunge", anim: "reverse-lunge" },
    rdl: { name: "Romanian deadlift", anim: "romanian-deadlift-dumbbell" },
    gluteBridge: { name: "Glute bridge", anim: "glute-bridge" },
    clamshell: { name: "Clamshell", anim: "clamshell" },
    calf: { name: "Calf raise", anim: "standing-calf-raise" },
    soleus: { name: "Bent-knee calf raise", anim: "single-leg-standing-calf-raise" },
    deadbug: { name: "Dead bug", anim: "dead-bug" },
    birddog: { name: "Bird-dog", anim: "bird-dog" },
    balance: { name: "Single-leg balance", anim: "single-leg-balance" },
    pushup: { name: "Push-up (incline if needed)", anim: "push-up" },
    pogo: { name: "Pogo hops", anim: "pogo-hops" },
    boxjump: { name: "Box / hurdle jump", anim: "box-jump" },
  };
  for (const id in original) {
    const d = exerciseById(id);
    assert.ok(d, "original exercise " + id + " has gone");
    assert.equal(d!.name, original[id]!.name, id + "'s name changed");
    assert.equal(d!.anim, original[id]!.anim, id + "'s animation slug changed");
  }
});

test("BLOCKER: every equipment tag on every exercise is a real EQUIPMENT value", () => {
  for (const id of exerciseIds()) {
    const d = exerciseById(id)!;
    assert.ok(d.equipment.length > 0, id + " lists no equipment at all — not even bodyweight");
    for (const q of d.equipment) assert.ok((EQUIPMENT as readonly string[]).includes(q), id + " has an unknown equipment tag: " + q);
  }
});

test("BLOCKER: every equipment tag has real coverage — none is a dead end on its own", () => {
  // The Logbook's own filter rule: "a chip that always returns nothing is a dead end wearing the
  // clothes of a feature." Same law, applied to equipment.
  const counts: Record<string, number> = {};
  for (const q of EQUIPMENT) counts[q] = 0;
  for (const id of exerciseIds()) for (const q of exerciseById(id)!.equipment) counts[q]!++;
  for (const q of EQUIPMENT) assert.ok(counts[q]! >= 2, "equipment tag " + q + " has only " + counts[q] + " exercises");
});

test("BLOCKER: every movement pattern used by an exercise has a schematic figure to fall back to", () => {
  // ⚠️ AN UNKNOWN PATTERN SILENTLY DRAWS A SQUAT. exAnim() falls back to POSES.squat for a pattern
  // it doesn't recognise, so a typo here is invisible on screen — every exercise still shows SOME
  // figure, just the wrong one. The guard has to compare against the real POSES object.
  const poses = new Set(posesKeys());
  const used = new Set(exerciseIds().map((id) => exerciseById(id)!.pattern));
  assert.ok(used.size >= 10, "only " + used.size + " distinct patterns are actually used");
  for (const pat of used) assert.ok(poses.has(pat), "pattern " + pat + " has no entry in POSES — every exercise using it silently draws a squat");
  // And PATTERNS itself must cover what is used, or a pattern-grouped page misses a whole group.
  for (const pat of used) assert.ok((PATTERNS as readonly string[]).includes(pat), "pattern " + pat + " is used but absent from PATTERNS");
});

test("BLOCKER: every anim slug either has a real asset file, or is the one documented pre-wired exception", () => {
  const dir = new URL("../assets/exercise-animations/", import.meta.url);
  const files = new Set(readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")));
  const PRE_WIRED = new Set(["single-leg-balance"]); // artwork not drawn yet; documented on the entry itself
  let checkedPreWired = false;
  for (const id of exerciseIds()) {
    const anim = exerciseById(id)!.anim;
    if (!anim) continue;
    if (PRE_WIRED.has(anim)) checkedPreWired = true;
    assert.ok(files.has(anim) || PRE_WIRED.has(anim), id + "'s anim slug \"" + anim + "\" has no asset and is not the documented pre-wired exception");
  }
  assert.ok(checkedPreWired, "the pre-wired exception was never exercised — remove it if nothing uses it");
});

test("BLOCKER: no copy claims injury prevention, a guarantee, or a cure — the rule this app enforces everywhere else", () => {
  // ⚠️ NO TRAILING \b AFTER THE OPEN-ENDED STEMS. \bguarantee\b cannot match inside "guarantees" or
  // "guaranteed" — the character right after "guarantee" is a word character, so the boundary never
  // fires and the inflected form sails past. \w* absorbs any suffix while the LEADING \b still keeps
  // this from matching inside an unrelated word like "obscure" (no boundary before "cure" there).
  const banned = /\bprevents?\s+injur\w*|\bguarantee\w*|\bcures?\b|\bcure-all\w*/i;
  for (const id of exerciseIds()) {
    const d = exerciseById(id)!;
    assert.ok(!banned.test(d.cue), id + "'s cue makes an unsupportable claim: " + d.cue);
  }
  for (const pat of PATTERNS) assert.ok(!banned.test(PATTERN_WHY[pat]!), pat + "'s why-text makes an unsupportable claim");
});

// ---- alternativesFor: the swap candidate function A4 will build on --------------------------------

test("BLOCKER: alternativesFor only offers the same pattern, equipment the runner owns, never the exercise itself", () => {
  const cands = alternativesFor("squat", ["dumbbell"]);
  assert.ok(cands.length > 0, "squat has no dumbbell-compatible alternative at all");
  for (const c of cands) {
    assert.notEqual(c.id, "squat", "offered itself as its own alternative");
    assert.equal(c.pattern, "squat", c.id + " is a different pattern from squat");
    assert.ok(c.equipment.includes("dumbbell"), c.id + " needs equipment the runner doesn't have");
  }
});

test("BLOCKER: alternativesFor with no owned equipment falls back to bodyweight, never returns everything", () => {
  const cands = alternativesFor("rdl", []);
  for (const c of cands) assert.ok(c.equipment.includes("bodyweight"), c.id + " requires equipment despite none being owned");
});

// ---- session-templates.ts still resolves against the shared library ------------------------------

test("BLOCKER: strengthSession and generalStrengthSession still build from the shared library", () => {
  for (const phase of ["base", "build", "peak", "taper"] as const) {
    for (const maintenance of [false, true]) {
      const s = strengthSession(phase, maintenance);
      for (const e of s.exercises ?? []) {
        assert.ok(exerciseById(e.id!), "session exercise " + e.id + " does not resolve in the shared library");
      }
    }
  }
  const g = generalStrengthSession(0);
  for (const e of g.exercises ?? []) assert.ok(exerciseById(e.id!), "general session exercise " + e.id + " does not resolve");
});

// ---- web/app.ts: the duplicate catalogue and its dead renderer are gone, not left orphaned --------

test("BLOCKER: STRENGTH_LIB and exCard no longer exist — one catalogue, not two", () => {
  const src = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");
  assert.ok(!/const STRENGTH_LIB/.test(src), "the duplicate catalogue is still declared");
  assert.ok(!/function exCard\(/.test(src), "the dead renderer that skipped every exercise with no art is still defined");
});

test("BLOCKER: the Learn hub's card renderer is exVisual, the same one the session sheet uses", () => {
  // exVisual() already falls back to the schematic figure for a pattern with no bespoke animation —
  // reusing it is what lets all 62 exercises show a demonstration, not just the 16 with real art.
  const block = appBlock();
  const libCard = block.slice(block.indexOf("function libCard("));
  const body = libCard.slice(0, libCard.indexOf("\n}"));
  assert.ok(/exVisual\(/.test(body), "libCard does not call exVisual");
});

test("BLOCKER: the strength library page reads RC.EXERCISES via exerciseIds/exerciseById, not a local list", () => {
  const view = appBlock();
  const fn = view.slice(view.indexOf("function strengthView("));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.ok(/RC\.exerciseIds\(\)/.test(body), "strengthView does not read RC.exerciseIds");
  assert.ok(/RC\.exerciseById\(/.test(body), "strengthView does not read RC.exerciseById");
  assert.ok(/RC\.PATTERNS/.test(body), "strengthView does not group by RC.PATTERNS");
});

test("BLOCKER: the equipment filter is exhaustive (every EQUIPMENT tag gets a chip) and OR, not AND", () => {
  const view = appBlock();
  const fn = view.slice(view.indexOf("function strengthView("));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert.ok(/RC\.EQUIPMENT\.map/.test(body), "the chip row is not derived from RC.EQUIPMENT");
  assert.ok(/e\.equipment\.some/.test(body), "the filter does not use OR-style .some() matching");
  assert.ok(!/e\.equipment\.every/.test(body), "the filter switched to AND-style .every() matching");
});

// web/entry.ts exports the library surface the app and future stages need.
test("BLOCKER: web/entry.ts exports the library, not the retired session-templates.ts copies", () => {
  const entry = readFileSync(new URL("../web/entry.ts", import.meta.url), "utf8");
  assert.match(entry, /from "\.\.\/src\/strength\/library\.ts"/, "entry.ts does not import from the shared library");
  for (const name of ["EXERCISES", "EQUIPMENT", "PATTERNS", "alternativesFor", "exerciseById", "exerciseIds"]) {
    assert.ok(entry.includes(name), "web/entry.ts does not export " + name);
  }
});
