// "MAKE A WEEK EASIER" — Hudson's own alternative to a scheduled recovery week.
//
// Owner, 2026-09-02: "go", against my own offer to wire this up. It is the second half of the ch7
// sentence whose first half shipped the day before: "Low-key, low-volume competitive runners typically
// don't need to schedule recovery weeks at all. Instead, they can just take a day off or REPLACE A HARD
// RUN WITH AN EASY RUN as necessary."
//
// ⚠️⚠️ WHY IT WAS NEEDED, MEASURED. Every level the app could already offer is a FILTER (`adjDrops`), so
// the shallowest easing a runner could reach took 57% off their week and the default took 70-91% — where
// a scheduled recovery week takes 24-28%. Somebody who wanted one notch easier had to choose between
// nothing and half their week. `applyMissedSessionAdjustment` had done exactly the right thing since it
// was written — substitute the hardest session for an easy run — and had ZERO callers.
//
// MEASURED ACROSS 9,945 GENERATED WEEKS (4 distances x 3-7 days x 3 experiences x 3 abilities x 3
// runways):
//   training-time cut     13.4% to 24.2%, mean 18.9% — inside the book's own "20-to 30-percent" band
//   session COUNT changed 0 — it substitutes, it never deletes
//   goal race touched     0
//   nothing to ease       540 weeks, every one a race week whose only sessions are the race and rest
//   counted km RISES      44 of 9,405 = 0.5%, worst +0.94 km, while the load still falls 21-24%
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { Athlete, Goal, PlannedWeek, SessionOutcome } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { applyMissedSessionAdjustment, easeWeek } from "../src/adapt/missed-sessions.ts";
import { weekVolumeMeters } from "../src/domain/steps.ts";
import { computeDistribution } from "../src/science/intensity-distribution.ts";

const TT: Record<string, number> = { "5k": 1500, "10k": 3200, half: 7500, marathon: 16200 };
const START = "2026-09-07";
const iso = (w: number) => {
  const d = new Date(START + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + w * 7);
  return d.toISOString().slice(0, 10);
};
const mins = (w: PlannedWeek) => computeDistribution(w.sessions).totalSeconds / 60;
const km = (w: PlannedWeek) => weekVolumeMeters(w.sessions) / 1000;
const misses = (n: number) => Array.from({ length: n }, () => ({ completed: false })) as SessionOutcome[];

function plan(o: { dist?: string; days?: number; exp?: string; secs?: number; weeks?: number } = {}) {
  const athlete = {
    daysPerWeek: o.days ?? 5,
    recent: { distanceMeters: 5000, timeSeconds: o.secs ?? 1500 },
    experience: o.exp ?? "recreational",
    includeStrength: true, includeMobility: true,
    returningFromInjury: false, returningFromBreak: false, runWalk: false, longRunDay: 6,
  } as unknown as Athlete;
  const goal = {
    distance: o.dist ?? "10k",
    targetTimeSeconds: TT[o.dist ?? "10k"]!,
    raceDateIso: iso(o.weeks ?? 18),
  } as unknown as Goal;
  return generatePlan(athlete, goal, { startDateIso: START });
}

/** Every week of a wide grid, so a claim about "an eased week" is a claim about all of them. */
function* weeks() {
  for (const dist of ["5k", "10k", "half", "marathon"]) {
    for (const days of [3, 4, 5, 6, 7]) {
      for (const exp of ["beginner", "recreational", "competitive"]) {
        for (const secs of [1249, 1800, 2400]) {
          let p;
          try { p = plan({ dist, days, exp, secs, weeks: dist === "marathon" ? 24 : 18 }); } catch { continue; }
          for (const w of p.weeks) yield { who: `${dist}/${days}d/${exp}/${secs}s wk${w.index}`, w };
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The engine: one definition, two callers
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the two-misses gate belongs to the CALLER, not to the mechanism", () => {
  // ⚠️ WRITTEN THE OTHER WAY ROUND, a runner-initiated easier week would have to fake two missed
  // sessions to get one — lying to the function to obtain the behaviour — and the wording it produces
  // ("after missed sessions") would then be false on screen.
  const w = plan().weeks[5]!;
  assert.equal(applyMissedSessionAdjustment(w, misses(0)).triggered, false, "0 misses triggered");
  assert.equal(applyMissedSessionAdjustment(w, misses(1)).triggered, false, "1 miss triggered");
  assert.equal(applyMissedSessionAdjustment(w, misses(2)).triggered, true, "2 misses did not trigger");
  // and the chosen path needs no outcomes at all
  assert.equal(easeWeek(w, "chosen").triggered, true, "a chosen ease did not trigger");
  // ...and the two produce the SAME arithmetic, which is what makes it one mechanism.
  const a = applyMissedSessionAdjustment(w, misses(2)).week;
  const b = easeWeek(w, "chosen").week;
  assert.equal(Math.round(km(a) * 100), Math.round(km(b) * 100), "the two callers cut different amounts");
  assert.equal(Math.round(mins(a)), Math.round(mins(b)), "the two callers cut different amounts of time");
});

test("BLOCKER: it SUBSTITUTES and never deletes, and it never touches the goal race", () => {
  // ⚠️ THIS IS THE WHOLE REASON IT EXISTS. Every level the app could already offer deletes sessions,
  // which is why the shallowest was 57%. A substitution keeps the week's shape and takes a fifth out.
  let n = 0, countChanged = 0, raceChanged = 0;
  for (const { who, w } of weeks()) {
    const r = easeWeek(w, "chosen");
    if (!r.triggered) continue;
    n++;
    assert.equal(r.week.sessions.length, w.sessions.length, `${who}: the session count changed`);
    if (r.week.sessions.length !== w.sessions.length) countChanged++;
    const before = w.sessions.find((s) => s.type === "race");
    if (before) {
      const after = r.week.sessions.find((s) => s.type === "race");
      assert.ok(after, `${who}: the goal race was removed`);
      assert.equal(after!.estimatedDurationSeconds, before.estimatedDurationSeconds,
        `${who}: the goal race was shortened`);
      assert.equal(after!.title, before.title, `${who}: the goal race was retitled`);
      if (after!.title !== before.title) raceChanged++;
    }
  }
  assert.ok(n > 3000, `only ${n} eased weeks measured`);
  assert.equal(countChanged, 0);
  assert.equal(raceChanged, 0);
});

test("BLOCKER: the cut is inside the book's own 20-to-30-percent band, measured on TIME", () => {
  // ⚠️ TIME IS THE RULER AND DISTANCE IS NOT, and this repo has paid for that distinction twice. A hill
  // or fartlek session carries almost no counted distance for its length, so replacing it with an easy
  // run of 70% of its duration can leave the week with MORE kilometres — measured, 44 of 9,405 eased
  // weeks (0.5%), worst +0.94 km, while the training time still falls 21-24%.
  const cuts: number[] = [];
  let gained = 0, n = 0;
  for (const { w } of weeks()) {
    const r = easeWeek(w, "chosen");
    if (!r.triggered) continue;
    n++;
    const m0 = mins(w);
    if (m0 > 0) cuts.push(1 - mins(r.week) / m0);
    if (km(r.week) > km(w) + 0.05) gained++;
  }
  const mean = cuts.reduce((a, b) => a + b, 0) / cuts.length;
  assert.ok(cuts.length > 3000, `only ${cuts.length} weeks measured`);
  // Measured min 13.4%, max 24.2%, mean 18.9%. A recovery week is 24-28%, so this is a shade shallower
  // and is stated as such rather than tuned to match.
  assert.ok(Math.min(...cuts) >= 0.10,
    `the shallowest ease takes only ${(Math.min(...cuts) * 100).toFixed(1)}% off the week`);
  assert.ok(Math.max(...cuts) <= 0.30,
    `the deepest ease takes ${(Math.max(...cuts) * 100).toFixed(1)}% off the week, past the book's band`);
  assert.ok(mean >= 0.15 && mean <= 0.24, `the mean cut is ${(mean * 100).toFixed(1)}%`);
  // The km rise is real, rare and must stay rare — the copy is worded around it.
  assert.ok(gained / n <= 0.02,
    `${gained} of ${n} eased weeks come out with MORE counted km (${(gained / n * 100).toFixed(1)}%)`);
});

test("BLOCKER: nothing to ease is reported as nothing, and the week is left alone", () => {
  // ⚠️ `triggered: false` MUST MEAN THE WEEK IS UNCHANGED. Returning true there would put "this week is
  // easier now" over an identical week — and measured, every such week is a RACE WEEK whose only
  // sessions are the race and rest days (540 of 9,945), i.e. the one week the whole block exists for.
  let untriggered = 0, notRace = 0;
  for (const { who, w } of weeks()) {
    const r = easeWeek(w, "chosen");
    if (r.triggered) continue;
    untriggered++;
    assert.equal(r.week, w, `${who}: an untriggered ease returned a different week object`);
    assert.equal(r.changes.length, 0, `${who}: an untriggered ease still described changes`);
    if (!w.sessions.some((s) => s.type === "race")) notRace++;
  }
  assert.ok(untriggered > 100, `only ${untriggered} untriggered weeks measured — the branch may be dead`);
  assert.equal(notRace, 0,
    `${notRace} weeks reported nothing to ease and were NOT race weeks — the app's reason text says ` +
    '"race week", so it would be lying about them');
});

test("BLOCKER: every word follows the reason — a chosen week never mentions missed sessions", () => {
  // ⚠️ FOUND BY DRIVING THE REAL BUTTON, NOT THE FUNCTION. A runner who chose an easier week was handed
  // a session titled "31′ easy (eased re-entry)" having missed nothing. A derived string that does not
  // follow its own reason is the stale-derived-fact trap, and this one is the text the runner reads.
  const w = plan().weeks[5]!;
  const chosen = easeWeek(w, "chosen");
  const missed = applyMissedSessionAdjustment(w, misses(2));
  const bad = /re-entry|missed|ease back in|after a break/i;
  const chosenText = [
    chosen.week.focus,
    ...chosen.changes,
    ...chosen.week.sessions.map((s) => s.title + " " + (s.description ?? "")),
  ].join(" | ");
  assert.ok(!bad.test(chosenText),
    "a chosen easier week uses the missed-session wording: " +
    (chosenText.match(bad) ? chosenText.slice(Math.max(0, chosenText.search(bad) - 60), chosenText.search(bad) + 60) : ""));
  // ...and the missed path must KEEP its own wording, or this guard is satisfied by deleting both.
  const missedText = [missed.week.focus, ...missed.changes,
    ...missed.week.sessions.map((s) => s.title + " " + (s.description ?? ""))].join(" | ");
  assert.ok(bad.test(missedText), "the missed-session path lost its own wording");
  assert.notEqual(chosen.week.focus, missed.week.focus, "both reasons produce the same focus line");
});

// ---------------------------------------------------------------------------------------------
// The app: the engine does the work, the app re-projects
// ---------------------------------------------------------------------------------------------

const page = (() => {
  let cache: string | null = null;
  return () => (cache ??= readFileSync(new URL("../web/app.html", import.meta.url), "utf8"));
})();
const appBlock = (() => {
  let cache: string | null = null;
  return () => {
    if (cache) return cache;
    const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
    cache = blocks.reduce((a, b) => (b.includes("function easeWeekIn") ? b : a), "");
    return cache;
  };
})();
const nocomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
const nostring = (s: string) =>
  s.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
function fn(name: string): string {
  const src = appBlock();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not in the built page");
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  assert.fail(name + " never closes");
}

test("BLOCKER: the app never hand-builds a session — the engine substitutes and weekView re-projects", () => {
  // ⚠️⚠️ ADJ_MODES's OWN NOTE RECORDED WHY THIS WAS NOT ATTEMPTED FOR MONTHS: "building a session in the
  // app layer and keeping PLAN's display summary in step with RAW's steps by hand -- two shapes, and
  // CLAUDE.md records what that costs". It never had to be built there. RC.easeWeek rewrites the RAW
  // week and RC.weekView is the ENGINE'S OWN projection into the display shape, so there is no second
  // builder and the two shapes cannot drift.
  const body = nocomment(fn("easeWeekIn"));
  assert.match(body, /RC\.easeWeek\(/, "easeWeekIn does not ask the engine to do the substitution");
  assert.match(body, /RC\.weekView\(/, "easeWeekIn does not re-project through the engine's own view");
  // no session literal built here
  assert.ok(!/steps\s*:/.test(body), "easeWeekIn builds steps of its own");
  assert.ok(!/title\s*:/.test(body), "easeWeekIn builds a session title of its own");
  // ⚠️ AND ONLY THE SESSION-DERIVED FIELDS ARE ADOPTED. normalizeWeekStarts() snaps every week back to
  // its Monday AFTER adoption, so copying a whole re-projection over the live PLAN week would
  // un-normalise it and computeToday() would stop matching today.
  for (const f of ["startIso", "start", "startFull", "index", "phase", "isDeload"])
    assert.ok(!new RegExp("wk\\." + f + "\\s*=").test(body),
      `easeWeekIn overwrites wk.${f} from a re-projection`);
  for (const f of ["sessions", "distanceKm", "quality", "longRunMin", "focus"])
    assert.ok(new RegExp("wk\\." + f + "\\s*=").test(body),
      `easeWeekIn does not adopt wk.${f}, so PLAN and RAW will disagree`);
});

test("BLOCKER: an easier-week row removes NOTHING", () => {
  // ⚠️ EXPLICIT RATHER THAN INCIDENTAL. adjDrops's chain happens to fall through to false for an
  // unknown mode, so the behaviour would be right by accident and the next person to add a level would
  // have no way of knowing a "recovery" row must never reach it. Easing SUBSTITUTES; deleting as well
  // would double the cut.
  const body = nocomment(fn("adjDrops"));
  const at = body.indexOf('a.mode === "recovery"');
  assert.ok(at >= 0, "adjDrops has no explicit branch for the easier-week mode");
  // it must come before any branch that can return true
  const firstTrue = body.indexOf("return true");
  assert.ok(firstTrue < 0 || at < firstTrue,
    "the recovery branch sits after a branch that can already return true");
  assert.match(body.slice(at, at + 60), /return false/,
    "the recovery branch does not return false");
});

test("BLOCKER: the preview asks the function that will do the work", () => {
  // A second estimate is a second answer to "how much easier", and the runner is agreeing to the
  // number on the screen. Same rule as adjustPreviewCount.
  const body = nocomment(fn("easeWeekOptions"));
  assert.match(body, /RC\.easeWeek\(/, "the preview does not ask the engine");
  assert.ok(!/0\.8|0\.85|\*\s*0\.7/.test(body),
    "the preview does its own arithmetic instead of asking easeWeek");
  // it must read the volume through the engine's single definition too
  assert.match(body, /RC\.weekVolumeMeters\(/, "the preview sums the week itself");
});

test("BLOCKER: the undo snapshot is taken BEFORE the rebuild", () => {
  // ⚠️ seedDone() prunes state.dayOverride of every session id the new plan lacks and PERSISTS the
  // prune, so by the time a toast appears the runner's own reschedules are already gone from disk. An
  // undo restoring only the store hands back a plan with those moves deleted, under a button labelled
  // Undo. An ORDERING claim, not a presence one.
  const body = nocomment(fn("applyEaseWeek"));
  const snap = body.indexOf("const before = JSON.stringify(loadAdjust())");
  const rebuild = body.indexOf("recompute()");
  const undo = body.indexOf("toastUndo(");
  assert.ok(snap >= 0, "applyEaseWeek takes no snapshot");
  assert.ok(rebuild >= 0, "applyEaseWeek never rebuilds");
  assert.ok(undo >= 0, "applyEaseWeek raises no undo");
  assert.ok(snap < rebuild, "the snapshot is taken after the rebuild");
  assert.ok(rebuild < undo, "the undo is offered before the rebuild");
  // and the ticks are restored around seedDone, the pairing doSaveProfile once missed
  const seeds = [...body.matchAll(/seedDone\(\);\s*restoreTicks\(/g)].length;
  assert.ok(seeds >= 1, "applyEaseWeek does not restore today's ticks around seedDone");
});

test("BLOCKER: every control on the sheet is reached by a handler", () => {
  // The looks-live-does-nothing class, which this app has shipped three times.
  const src = nocomment(appBlock());
  assert.match(nocomment(fn("manageAction")), /id === "easier"[\s\S]{0,60}openEaseWeekSheet\(\)/,
    "the menu row is not wired to the sheet");
  assert.match(nocomment(fn("managePlanHtml")), /row\("easier"/, "the menu has no easier-week row");
  for (const attr of ["data-ewk", "data-ewcancel"]) {
    assert.ok(src.includes(attr), `${attr} is never rendered`);
    assert.ok(new RegExp('querySelectorAll\\("\\[' + attr + '\\]"\\)').test(src),
      `${attr} is rendered but never bound`);
  }
  // the sheet must use the app's own $("id") accessors, not helpers that do not exist
  const open = nocomment(fn("openEaseWeekSheet"));
  assert.match(open, /\$\("sheetBody"\)/, "the sheet does not write into #sheetBody");
  assert.match(open, /\$\("sheetOv"\)/, "the sheet is never shown");
});

test("BLOCKER: every function this feature calls actually exists", () => {
  // ⚠️⚠️ THIS IS THE GUARD THAT WOULD HAVE CAUGHT THE DEFECT THIS FEATURE SHIPPED WITH. openEaseWeekSheet
  // called `sheetBody()` and `sheetOv()` — two helpers I invented; neither exists. The sheet opened
  // showing the menu it came from and the control looked live and did nothing. It built, it typechecked,
  // node --check passed all three emitted blocks and 1,469 tests passed, because nothing in this suite
  // asks whether a called function is defined. Eighth firing of the invented-identifier trap, and the
  // first time the sweep for it has been a test rather than a throwaway script.
  const src = nocomment(appBlock());
  const defined = new Set([...src.matchAll(/(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!));
  const consts = new Set([...src.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(|async|function)/g)].map((m) => m[1]!));
  // Things that are legitimately not top-level app functions.
  const KNOWN = new Set([
    "if", "for", "while", "switch", "catch", "return", "typeof", "function", "new", "do", "else",
    "await", "void", "delete", "in", "of", "case", "throw", "yield", "instanceof",
    "Number", "String", "Boolean", "Array", "Object", "Math", "JSON", "Date", "RegExp", "Error",
    "Promise", "Map", "Set", "WeakMap", "Intl", "parseInt", "parseFloat", "isNaN", "isFinite",
    "encodeURIComponent", "decodeURIComponent", "btoa", "atob", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "fetch",
    "alert", "confirm", "prompt", "structuredClone", "queueMicrotask", "$", "el", "esc",
  ]);
  const missing = new Map<string, string[]>();
  for (const name of ["easeWeekOptions", "easeWeekSheetHtml", "openEaseWeekSheet", "wireEaseWeekSheet",
    "applyEaseWeek", "easeWeekIn", "eased", "adjPhrase", "manageAction", "plannedBreaksHtml",
    "weekAdjust", "applyAdjustments"]) {
    const body = nostring(nocomment(fn(name)));
    // locals declared inside this very function are fine
    const local = new Set([...body.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]!));
    const params = (body.slice(0, body.indexOf(")")).match(/\(([^)]*)/) ?? ["", ""])[1]!
      .split(",").map((x) => x.trim().split(/[=:\s]/)[0]!).filter(Boolean);
    for (const m of body.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const id = m[2]!;
      if (KNOWN.has(id) || defined.has(id) || consts.has(id) || local.has(id) || params.includes(id)) continue;
      if (id === name) continue;
      if (!missing.has(id)) missing.set(id, []);
      missing.get(id)!.push(name);
    }
  }
  assert.equal(missing.size, 0,
    "these functions are CALLED but never defined: " +
    [...missing].map(([id, where]) => `${id}() in ${[...new Set(where)].join(", ")}`).join(" | "));
});

test("BLOCKER: the store's third kind is named everywhere it is rendered", () => {
  // ⚠️ THE MODE IS DELIBERATELY NOT IN ADJ_MODES — that array is rendered straight into the level
  // picker, so an entry there would put a WEEK-granular level among the DAY-granular ones. One phrase
  // resolver instead, or the breaks list shows the bare word "recovery" while the week marking shows
  // something else.
  const src = nocomment(appBlock());
  assert.match(nocomment(fn("adjPhrase")), /"recovery"/, "adjPhrase does not know the third kind");
  for (const name of ["plannedBreaksHtml", "weekAdjust"]) {
    const body = nocomment(fn(name));
    assert.match(body, /adjPhrase\(/, `${name} resolves the level itself instead of asking adjPhrase`);
    assert.ok(!/ADJ_MODES\.find/.test(body),
      `${name} still looks the level up in ADJ_MODES, so a "recovery" row renders as the bare word`);
  }
  assert.match(nocomment(fn("plannedBreaksHtml")), /"recovery"/,
    "the breaks list does not name the easier-week kind, so it renders as Taking it easier");
  assert.match(nocomment(fn("weekAdjust")), /"recovery"/,
    "the week marking does not name the easier-week kind");
  // and the mode must NOT be a picker option
  // ⚠️ THE SLICE IS THE ARRAY LITERAL, NOT EVERYTHING UP TO THE NEXT const. Taken to ADJ_QUALITY it
  // swallows adjustFor and adjPhrase — both of which name "recovery" legitimately — and the guard
  // reports the fix as the defect. Collection-too-wide, for the umpteenth time in this repo.
  const mStart = src.indexOf("const ADJ_MODES");
  const modes = src.slice(mStart, src.indexOf("];", mStart) + 2);
  assert.ok(modes.length > 100 && modes.includes('id: "easy"'), "the ADJ_MODES literal was not captured");
  assert.ok(!/recovery/.test(modes),
    "the easier-week mode is in ADJ_MODES, so it appears in the day-range level picker");
});

test("BLOCKER: the easing runs AFTER the day filter, and only on a covered week", () => {
  // ⚠️ AN ORDERING CLAIM. If a holiday has already taken sessions out of a week, easing it should ease
  // what is LEFT — otherwise the two windows compound into a cut neither of them asked for.
  const body = nocomment(fn("applyAdjustments"));
  const filter = body.indexOf("wk.sessions = wk.sessions.filter");
  const ease = body.indexOf("easeWeekIn(");
  assert.ok(filter >= 0, "the day filter is gone");
  assert.ok(ease >= 0, "applyAdjustments never eases a week");
  assert.ok(filter < ease, "the week is eased before the day filter has run");
  assert.match(body, /eased\(wk, rows\)/, "the ease is not gated on the week being covered");
});
