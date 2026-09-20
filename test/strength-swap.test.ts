/**
 * A4 — SWAP AN EXERCISE FOR A LIKE-FOR-LIKE ALTERNATIVE THAT PERSISTS.
 *
 * "Swap" offers alternatives sharing the movement pattern and, where possible, the primary muscle,
 * gated by the runner's OWN equipment and level rather than whatever the plan builder used to fill
 * that slot. The choice sticks (interun_swap_v1), the prescription (sets/reps/rest/load/contacts)
 * never moves, and every logged set is filed against the exercise the runner actually did.
 *
 * ⚠️⚠️ THE MOST VALUABLE THING FOUND HERE WAS FOUND BY DRIVING THE REAL UI, NOT BY READING THE CODE.
 * The first cut keyed a swap on `e.id` — the CURRENTLY DISPLAYED id — which is correct for a first
 * swap and silently wrong for a second one: after squat -> stepUp, tapping Swap again on the displayed
 * "Step-up" looked up "sessionId|stepUp" instead of "sessionId|squat", wrote a brand-new, unreachable
 * key, and left the ORIGINAL squat -> stepUp mapping untouched underneath it. Picking "squat" from
 * that second picker then did nothing at all, because nothing looks that key up. `slotId` — the
 * exercise's identity BEFORE any swap, stamped by withSwaps on every exercise whether or not it has
 * one applied — is the fix, and most of this file's guards exist to keep it from regressing quietly.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { EQUIPMENT, EXERCISES, alternativesFor, canDo, exerciseById, swapCandidatesFor } from "../src/strength/library.ts";

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/**
 * ⚠️ ANCHORED TO THE START OF A LINE. The app markup contains accept="image/*" — an unbalanced
 * comment opener mid-line — so an unanchored sweep opens there and eats 10,382 characters of live
 * code. CLAUDE.md records that measurement; every guard file here carries the same anchored form.
 */
const nocomment = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");
/** One function of the built page, brace-matched. A character window is not a function. */
function fnOf(name: string): string {
  const at = APP.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return nocomment(APP.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}
/** Every top-level function name in the built page's app script, for the reachability sweep below. */
function fnNames(): string[] {
  const blocks = [...APP.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const block = blocks.find((b) => b.includes("function withSwaps("));
  assert.ok(block, "no emitted block defines withSwaps");
  return [...nocomment(block!).matchAll(/^function ([a-zA-Z_$][\w$]*)\(/gm)].map((m) => m[1]!);
}
function appBlock(): string {
  const blocks = [...APP.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const b = blocks.find((x) => x.includes("function withSwaps("));
  assert.ok(b, "no emitted script block defines withSwaps");
  return nocomment(b!);
}

// ---------------------------------------------------------------------------------------------
// 1. Candidates: swapCandidatesFor is NOT alternativesFor with an extra argument
// ---------------------------------------------------------------------------------------------

test("BLOCKER: swap candidates share the source's pattern, pass canDo, and never include the source itself", () => {
  let checked = 0;
  const ids = Object.keys(EXERCISES);
  for (const id of ids) {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      for (const owned of [[], ["bodyweight"], [...EQUIPMENT]] as const) {
        const cands = swapCandidatesFor(id, owned as never, level);
        const from = EXERCISES[id]!;
        for (const c of cands) {
          assert.notEqual(c.id, id, id + " offered itself as its own swap candidate");
          assert.equal(c.pattern, from.pattern, id + " -> " + c.id + " changed pattern (" + from.pattern + " -> " + c.pattern + ")");
          assert.ok(canDo(EXERCISES[c.id]!, owned as never, level),
            id + " -> " + c.id + " is not something a " + level + " with [" + owned.join(",") + "] can do");
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 500, "the sweep proves little at " + checked + " candidate readings");
});

test("BLOCKER: swap candidates rank a shared primary muscle above a shared pattern alone", () => {
  // squat's candidates within bodyweight+intermediate: stepUp and boxSquat share the primary (Quads);
  // pistolSquat is advanced (excluded here). A candidate sharing the primary muscle must outrank one
  // that only shares the pattern, wherever both exist in the same result.
  const cands = swapCandidatesFor("squat", ["bodyweight"], "intermediate");
  const ids = cands.map((c) => c.id);
  assert.ok(ids.length >= 2, "too few candidates to prove an ordering: " + ids.join(","));
  const quadIdx = cands.findIndex((c) => c.primary === "Quads");
  const otherIdx = cands.findIndex((c) => c.primary !== "Quads");
  if (quadIdx >= 0 && otherIdx >= 0) {
    assert.ok(quadIdx < otherIdx, "a same-primary candidate ranked below a different-primary one");
  }
});

test("BLOCKER: level gates a swap candidate that alternativesFor (the plan builder's own fallback) still offers", () => {
  // ⚠️ THIS IS THE WHOLE REASON swapCandidatesFor EXISTS RATHER THAN REUSING alternativesFor. The
  // builder has already decided the level for a slot; a runner choosing for themselves must never be
  // offered something above their own stated level, or A3's "how much lifting have you done" question
  // is undone one tap after it is answered.
  const bodyweightOnly: string[] = [];
  // pistolSquat (advanced) is a same-pattern, bodyweight-eligible candidate for "squat" — a beginner
  // must never see it, though alternativesFor (which has no level parameter) always can.
  const viaAlternatives = alternativesFor("squat", ["bodyweight"]).map((c) => c.id);
  assert.ok(viaAlternatives.includes("pistolSquat"), "the fixture assumption broke: alternativesFor no longer offers pistolSquat for squat");
  const viaSwapBeginner = swapCandidatesFor("squat", ["bodyweight"], "beginner").map((c) => c.id);
  assert.ok(!viaSwapBeginner.includes("pistolSquat"), "a beginner was offered an advanced swap candidate");
  const viaSwapAdvanced = swapCandidatesFor("squat", ["bodyweight"], "advanced").map((c) => c.id);
  assert.ok(viaSwapAdvanced.includes("pistolSquat"), "an advanced runner lost a candidate the level gate should have let through");
  void bodyweightOnly;
});

test("an unrecognised exercise id returns no candidates rather than throwing", () => {
  assert.deepEqual(swapCandidatesFor("not-a-real-id", ["bodyweight"], "intermediate"), []);
});

// ---------------------------------------------------------------------------------------------
// 2. withSwaps: the web-layer function, lifted and driven
// ---------------------------------------------------------------------------------------------

/**
 * withSwaps and its two small helpers, executed for real rather than modelled — the same precedent
 * as gps-distance.test.ts lifting onGpsPos. A hand-written re-implementation would agree with itself
 * and prove nothing about the shipped function.
 */
function loadWithSwaps(): { withSwaps: (sess: unknown) => unknown; swapKey: (s: string, f: string) => string; setSwap: (s: string, f: string, t: string) => void; loadSwaps: () => Record<string, string> } {
  // ⚠️ SWAP_KEY MUST BE LIFTED TOO, OR THE WHOLE HARNESS "WORKS" WHILE PERSISTING NOTHING. loadSwaps
  // and saveSwaps both read localStorage under SWAP_KEY inside a try/catch — omit the constant and
  // every call throws ReferenceError, which the catch silently swallows, so loadSwaps always answers
  // {} and saveSwaps always writes nothing. Every assertion still ran; every one would have passed on
  // a harness that persisted nothing at all. Exactly the "a lift list that omits a dependency measures
  // a strictly easier program" trap, found here rather than by trusting a first green run.
  const keyMatch = /const SWAP_KEY = "[^"]+";/.exec(APP);
  assert.ok(keyMatch, "SWAP_KEY's declaration line has changed shape — update the lift");
  const body = [
    keyMatch![0]!,
    fnOf("swapKey"),
    fnOf("loadSwaps"),
    fnOf("saveSwaps"),
    fnOf("setSwap"),
    fnOf("withSwaps"),
  ].join("\n");
  const RC = { exerciseById } as const;
  // eslint-disable-next-line no-new-func
  const factory = new Function("RC", "localStorage", body + "\nreturn { withSwaps, swapKey, setSwap, loadSwaps };");
  const store: Record<string, string> = {};
  const fakeLocalStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
  return factory(RC, fakeLocalStorage);
}

const FULL_EXERCISE = () => ({
  id: "squat", name: "Goblet / bodyweight squat", primary: "Quads", secondary: ["Glutes", "Core"],
  pattern: "squat", sets: 3, reps: "3–6 (heavy)", loadPercent1RM: "80%+", restSeconds: 150,
  contacts: undefined, superset: 2, equipment: ["bodyweight", "dumbbell", "kettlebell"], anim: "goblet-squat",
  cue: "Sit your hips back and down, knees tracking over your toes, chest tall. Drive up through your heels.",
});

test("BLOCKER: withSwaps hands back a session unchanged (bar slotId) when there is no swap for it", () => {
  const { withSwaps } = loadWithSwaps();
  const sess = { id: "w1-d1-strength", exercises: [FULL_EXERCISE()] };
  const out = withSwaps(sess) as { exercises: Array<Record<string, unknown>> };
  const e = out.exercises[0]!;
  assert.equal(e.id, "squat");
  assert.equal(e.slotId, "squat", "slotId is not stamped even with no swap applied");
  for (const k of ["name", "primary", "secondary", "pattern", "sets", "reps", "loadPercent1RM", "restSeconds", "superset", "equipment", "anim", "cue"]) {
    assert.deepEqual(e[k], (FULL_EXERCISE() as Record<string, unknown>)[k], k + " changed with no swap applied");
  }
});

test("BLOCKER: a swap moves ONLY identity — sets, reps, rest, load, contacts and superset stay exactly as prescribed", () => {
  const { withSwaps, setSwap } = loadWithSwaps();
  setSwap("w1-d1-strength", "squat", "stepUp");
  const sess = { id: "w1-d1-strength", exercises: [FULL_EXERCISE()] };
  const out = withSwaps(sess) as { exercises: Array<Record<string, unknown>> };
  const e = out.exercises[0]!;
  const target = exerciseById("stepUp")!;
  assert.equal(e.id, "stepUp");
  assert.equal(e.slotId, "squat", "slotId must stay the ORIGINAL id, never the swapped-to one");
  for (const k of ["name", "primary", "secondary", "pattern", "equipment", "anim", "cue"] as const) {
    assert.deepEqual(e[k], (target as Record<string, unknown>)[k], "identity field " + k + " did not move to the target");
  }
  for (const k of ["sets", "reps", "loadPercent1RM", "restSeconds", "superset"]) {
    assert.deepEqual(e[k], (FULL_EXERCISE() as Record<string, unknown>)[k], "prescription field " + k + " moved — it must stay on the slot");
  }
});

test("BLOCKER: the second-swap defect, pinned exactly — swapping the DISPLAYED (already-swapped) exercise must still resolve against the original slot", () => {
  // ⚠️ THIS IS THE BUG THIS FILE'S HEADER DESCRIBES. It cannot be reproduced by calling withSwaps
  // twice on its own output (withSwaps is never fed its own result — see its own comment on why that
  // is safe) — it has to be reproduced the way the runner actually hits it: read slotId off the
  // DISPLAYED exercise (as the Swap button does), and use THAT as the key for the next swap.
  const { withSwaps, setSwap, loadSwaps } = loadWithSwaps();
  setSwap("w1-d1-strength", "squat", "stepUp");
  const sess = { id: "w1-d1-strength", exercises: [FULL_EXERCISE()] };
  const displayed = (withSwaps(sess) as { exercises: Array<{ id: string; slotId: string }> }).exercises[0]!;
  assert.equal(displayed.id, "stepUp");
  // The runner taps Swap again and picks "boxSquat". The button must key this off displayed.slotId
  // ("squat"), not displayed.id ("stepUp") — that is the entire fix.
  setSwap("w1-d1-strength", displayed.slotId, "boxSquat");
  const store = loadSwaps();
  assert.deepEqual(Object.keys(store), ["w1-d1-strength|squat"],
    "a second swap on an already-swapped exercise created a second, unreachable key");
  assert.equal(store["w1-d1-strength|squat"], "boxSquat", "the second swap did not overwrite the first");
  const redisplayed = (withSwaps(sess) as { exercises: Array<{ id: string }> }).exercises[0]!;
  assert.equal(redisplayed.id, "boxSquat");
});

test("BLOCKER: swapping back to the original exercise clears the key rather than storing a no-op", () => {
  const { setSwap, loadSwaps } = loadWithSwaps();
  setSwap("w1-d1-strength", "squat", "stepUp");
  assert.equal(Object.keys(loadSwaps()).length, 1);
  setSwap("w1-d1-strength", "squat", "squat");
  assert.deepEqual(loadSwaps(), {}, "reverting to the original left a stored identity mapping behind");
});

test("an id the catalogue no longer resolves falls back to the original rather than inventing a stand-in or throwing", () => {
  const { withSwaps, setSwap } = loadWithSwaps();
  setSwap("w1-d1-strength", "squat", "not-a-real-id");
  const sess = { id: "w1-d1-strength", exercises: [FULL_EXERCISE()] };
  const out = withSwaps(sess) as { exercises: Array<Record<string, unknown>> };
  assert.equal(out.exercises[0]!.id, "squat", "an unresolvable target produced something other than the original");
  assert.equal(out.exercises[0]!.slotId, "squat");
});

test("BLOCKER: withSwaps is idempotent — applying it to its own output changes nothing further", () => {
  // ⚠️ EVERY CALLER TODAY HAPPENS TO PASS A PRISTINE SESSION, so e.id alone would pass every guard
  // above — this is the one guard that would catch a future consumer (A5's session player, A9's watch
  // payload) accidentally re-applying withSwaps to an already-resolved session, which is exactly the
  // second-swap defect one layer further out. Found only by testing the chain, not by reading the code.
  const { withSwaps, setSwap } = loadWithSwaps();
  setSwap("w1-d1-strength", "squat", "stepUp");
  const sess = { id: "w1-d1-strength", exercises: [FULL_EXERCISE()] };
  const once = withSwaps(sess) as { exercises: Array<Record<string, unknown>> };
  const twice = withSwaps(once) as { exercises: Array<Record<string, unknown>> };
  assert.deepEqual(twice.exercises[0], once.exercises[0], "a second application changed the result");
  assert.equal(twice.exercises[0]!.slotId, "squat", "the slot identity was lost on the second application");
});

test("BLOCKER: a swap lookup is scoped to (session, exercise), with no fallback key that could leak across sessions", () => {
  // ⚠️ setSwap NEVER writes a bare exercise-id key — every write goes through swapKey(sessId, fromId).
  // A lookup that ALSO tries a bare key as a fallback would still pass every guard above, because
  // nothing the real app writes could ever populate that fallback — until a future bug, a hand-edited
  // localStorage value, or a restored backup collision does. The safety property is that a decision
  // made for one session can never affect another; a fallback lookup breaks that even though nothing
  // today happens to trigger it.
  const fn = fnOf("withSwaps");
  assert.match(fn, /const to = m\[swapKey\(sess\.id, slotId\)\];/,
    "the swap lookup no longer matches the exact scoped form — check it has not grown a fallback key");
});

test("a session with no exercises, or none at all, passes through withSwaps unharmed", () => {
  const { withSwaps } = loadWithSwaps();
  assert.equal(withSwaps(null), null);
  assert.equal(withSwaps(undefined), undefined);
  const mobility = { id: "w1-d3-mobility", exercises: [] };
  assert.equal(withSwaps(mobility), mobility);
  const noField = { id: "w1-d5-easy" };
  assert.equal(withSwaps(noField), noField);
});

// ---------------------------------------------------------------------------------------------
// 3. Every consumer of sess.exercises calls withSwaps, or is a named, justified exemption
// ---------------------------------------------------------------------------------------------

test("BLOCKER: sessionSheetHtml — the one sheet a runner logs sets into — applies withSwaps before reading sess.exercises", () => {
  const fn = fnOf("sessionSheetHtml");
  const swapLine = fn.indexOf("sess = withSwaps(sess)");
  assert.ok(swapLine >= 0, "sessionSheetHtml no longer calls withSwaps at all");
  const exercisesRead = fn.indexOf("sess.exercises");
  assert.ok(exercisesRead > swapLine, "sess.exercises is read before withSwaps is applied to it");
});

test("BLOCKER: every consumer of .exercises on a session-shaped object either calls withSwaps or is a named exemption", () => {
  // ⚠️ DERIVED FROM THE BUILT PAGE, NOT A HAND-WRITTEN LIST — a hand-written list is exactly what let
  // the days question and the strength toggle each ship a screen that silently disagreed with the
  // plan; PLAN.md's own words for this guard are "derived by grep".
  const block = appBlock();
  const names = fnNames();
  // Three reads are exempt, and each is exempt for a stated reason rather than by omission:
  //  - warmupCardFor gates on LENGTH only ("sess.exercises && sess.exercises.length"); a swap never
  //    changes how many exercises a session has, so identity is irrelevant to that check.
  //  - profileImpact's own strengthShape row reports a COUNT and a duration ("45 min, 7 exercises"),
  //    neither of which a swap moves — a swap changes identity fields only, never the exercise count
  //    or estimatedDurationSeconds. Found by this very sweep, not assumed safe in advance.
  //  - migrateSlog's read of raw.exercises[exIdx] reconstructs HISTORY from the v1 store, which
  //    predates A4 entirely — a swap made today must not rewrite what a runner logged before swaps
  //    existed.
  //  - strPlayItems is a PURE flattener of an already-resolved session: A5's openStrengthPlayer
  //    applies withSwaps at the ENTRY POINT, so SPLAY.sess is the swapped session for the player's
  //    whole life. ⚠️ THIS SWEEP IS WHAT CAUGHT THAT. The first cut resolved swaps at the call site
  //    instead, which was correct only by convention — a convention every future caller has to know,
  //    and one of them eventually will not. Making the flattener read the store itself would make it
  //    impure and untestable without one; the entry point covers every caller, and the test below
  //    proves it is applied there rather than taking the exemption on trust.
  const EXEMPT = new Set(["warmupCardFor", "profileImpact", "migrateSlog", "withSwaps", "strPlayItems"]);
  let sitesChecked = 0;
  for (const name of names) {
    if (EXEMPT.has(name)) continue;
    const at = block.indexOf("function " + name + "(");
    if (at < 0) continue;
    let d = 0, end = -1;
    for (let i = block.indexOf("{", at); i < block.length; i++) {
      if (block[i] === "{") d++;
      else if (block[i] === "}") { d--; if (!d) { end = i + 1; break; } }
    }
    if (end < 0) continue;
    const body = block.slice(at, end);
    if (!/\.exercises\b/.test(body)) continue;
    sitesChecked++;
    assert.ok(/withSwaps\(/.test(body),
      name + " reads .exercises but never calls withSwaps — a swap will not reach it");
  }
  assert.ok(sitesChecked >= 1, "the sweep found no consumer of .exercises to check at all — it may be too narrow");
});

test("the three exemptions above are genuinely length-only / historical, not swap-sensitive reads in disguise", () => {
  const warm = fnOf("warmupCardFor");
  assert.match(warm, /sess\.exercises && sess\.exercises\.length/, "warmupCardFor's exemption no longer matches a length-only read");
  assert.doesNotMatch(warm, /sess\.exercises\.map|sess\.exercises\[0\]|sess\.exercises\.forEach/, "warmupCardFor now reads exercise CONTENT, not just length — it needs withSwaps");
  const imp = fnOf("profileImpact");
  assert.match(imp, /\(s\.exercises \|\| \[\]\)\.length/, "profileImpact's exemption no longer matches a length-only read");
  assert.doesNotMatch(imp, /\.exercises\.map|\.exercises\[0\]|\.exercises\.forEach/, "profileImpact now reads exercise CONTENT, not just a count — it needs withSwaps");
  const mig = fnOf("migrateSlog");
  assert.match(mig, /raw\.exercises\[exIdx\]/, "migrateSlog's historical read moved — re-check the exemption still applies");
  // strPlayItems is exempt above only because its ENTRY POINT resolves swaps. Move that back to the
  // call site and the exemption is unearned — this is what says so.
  assert.match(fnOf("openStrengthPlayer"), /const sess = withSwaps\(rawSess\)/,
    "the strength player no longer resolves swaps at its entry point — strPlayItems' exemption is unearned");
});

// ---------------------------------------------------------------------------------------------
// 4. The button, the picker, and seedDone's pruning
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the Swap button is keyed on e.slotId, never e.id", () => {
  const block = fnOf("exerciseBlock");
  assert.match(block, /data-swap="'\s*\+\s*esc\(e\.slotId \|\| e\.id\)/,
    "the Swap button reads e.id directly — on an already-swapped exercise this is the second-swap defect");
});

test("BLOCKER: the picker offers a way back to the original exercise once a slot has an active swap", () => {
  const fn = fnOf("swapPickerHtml");
  assert.match(fn, /loadSwaps\(\)\[swapKey\(sessId, fromId\)\]/, "the picker no longer checks for an active swap on this slot");
  assert.match(fn, /Back to the original pick/, "there is no row offering to revert to the original exercise");
  // swapCandidatesFor itself excludes fromId, so without the row above there would be NO way back —
  // asserted here as the reason the row must exist, not just that it does.
  assert.equal(swapCandidatesFor("squat", ["bodyweight"], "intermediate").some((c) => c.id === "squat"), false,
    "swapCandidatesFor started returning the source exercise — the picker's own back-row is redundant, re-check it");
});

test("BLOCKER: seedDone prunes a swap by splitting its key, not by matching the whole thing against a live session id", () => {
  // ⚠️ dayOverride and heatAdapt prune by comparing a WHOLE key against a live session id. A swap key
  // is "sessionId|exerciseId" — comparing the whole thing against `alive` would call every swap stale
  // on every boot, because no session is literally named "w3d2-strength|squat".
  const fn = fnOf("seedDone");
  assert.match(fn, /k\.slice\(0, k\.indexOf\("\|"\)\)/, "seedDone no longer splits the swap key before checking it against the live plan");
  assert.match(fn, /loadSwaps\(\)/, "seedDone no longer reads the swap store at all");
});

test("a swap key is discovered by backup export through the interun_ prefix, with no hardcoded list to go stale", () => {
  // ⚠️ SWAP_KEY IS READ BY loadSwaps/saveSwaps, NOT setSwap — setSwap only calls swapKey() (the
  // "sessionId|exerciseId" builder, an unrelated function of a confusingly similar name) and never
  // touches the localStorage key itself. Checking the wrong function here would have passed on a
  // setSwap that used any storage key at all, proving nothing about backup discoverability.
  assert.match(fnOf("loadSwaps"), /SWAP_KEY/, "loadSwaps no longer reads under SWAP_KEY");
  assert.match(fnOf("saveSwaps"), /SWAP_KEY/, "saveSwaps no longer writes under SWAP_KEY");
  const swapKeyConst = /const SWAP_KEY = "([^"]+)"/.exec(APP);
  assert.ok(swapKeyConst, "SWAP_KEY is not declared as a plain string literal");
  assert.match(swapKeyConst![1]!, /^interun_/, "the swap store key does not carry the backup-discoverable prefix");
});
