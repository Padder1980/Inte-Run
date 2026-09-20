import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { exerciseById, exerciseIds } from "../src/plan/session-templates.ts";
import { buildPlanSummary } from "../src/view/plan-summary.ts";
import type { Athlete, Goal, Session } from "../src/domain/types.ts";

/**
 * THE STRENGTH LOG SURVIVES A PLAN REBUILD.
 *
 * ⚠️ IT DID NOT, AND NOTHING SAID SO. `interun_slog` filed every logged set under
 * sessionId|exerciseIndex|setIndex with no date, and read it back through
 * RAW.weeks[n].sessions.find(id).exercises[i] — with `if (!ex) continue;` for anything it could not
 * resolve. So changing the plan (a new race date, different days, a different number of strength
 * sessions a week) renumbered or removed the exercise and the runner's history was gone, silently.
 *
 * The guards below are DRIVEN: the store functions are lifted out of the BUILT page and executed
 * against a fake localStorage, and the plans are real ones from the real generator. A source grep
 * would prove the new code exists; only running it proves a row logged against one plan is still
 * there after another is built.
 */

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const SRC = readFileSync(new URL("../src/plan/session-templates.ts", import.meta.url), "utf8");

/** The app's own script block — the one that holds the runtime JS. */
function appBlock(): string {
  const blocks = [...APP.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  const b = blocks.find((x) => x.includes("function slogWrite("));
  assert.ok(b, "no emitted script block defines slogWrite");
  return b!;
}

/** A function, sliced by BRACE MATCHING. A character window is not a function — this file's rule. */
function fnOf(src: string, name: string): string {
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, "no function " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}

/**
 * Lift the store into a sandbox with a fake localStorage.
 * ⚠️ THE CONSTANTS ARE READ OUT OF THE BUILT PAGE, NEVER TYPED HERE. A harness that supplies its own
 * constants measures a different program — this project has watched exactly that let a re-break
 * escape twice (the tone-curve table, and the engine's distance tables).
 */
function sandbox(seed: Record<string, string> = {}) {
  const block = appBlock();
  const store: Record<string, string> = { ...seed };
  const ls = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const keyLine = /const SLOG2_KEY = "([^"]+)";/.exec(block);
  const maxLine = /const SLOG_MAX_ROWS = (\d+);/.exec(block);
  assert.ok(keyLine && maxLine, "SLOG2_KEY / SLOG_MAX_ROWS not found in the built page");
  const src = [
    'const SLOG2_KEY = "' + keyLine![1] + '";',
    "const SLOG_MAX_ROWS = " + maxLine![1] + ";",
    fnOf(block, "loadSlogV1"),
    "let SLOG = null, SLOG_T = null;",
    fnOf(block, "slogAll"),
    fnOf(block, "slogFlush"),
    fnOf(block, "slogTouch"),
    fnOf(block, "slogWrite"),
    fnOf(block, "slogForSession"),
    fnOf(block, "slogFor"),
    fnOf(block, "slogBest"),
    fnOf(block, "migrateSlog"),
    fnOf(block, "genDay"),
    fnOf(block, "isoAdd"),
    "return { slogAll, slogFlush, slogWrite, slogForSession, slogFor, slogBest, migrateSlog, store, KEY: SLOG2_KEY, MAX: SLOG_MAX_ROWS };",
  ].join("\n");
  const make = new Function("localStorage", "clearTimeout", "setTimeout", "PLAN", "RAW", "store", src);
  return (PLAN: unknown, RAW: unknown) =>
    make(ls, () => {}, () => 0, PLAN, RAW, store) as {
      slogAll: () => { rows: any[]; bests: Record<string, { w: number; d: string }>; meta: any };
      slogFlush: () => void;
      slogWrite: (d: string, s: string, x: string, i: number, f: string, v: string) => void;
      slogForSession: (d: string, s: string) => Record<string, any>;
      slogFor: (x: string) => any[];
      slogBest: (x: string) => number;
      migrateSlog: () => void;
      store: Record<string, string>;
      KEY: string;
      MAX: number;
    };
}

const ATH: Athlete = {
  experience: "recreational", daysPerWeek: 5, longRunDay: 0, includeStrength: true,
  recent: { distanceMeters: 5000, timeSeconds: 1500 }, weeklyVolumeKmCurrent: 40,
} as Athlete;
const GOAL: Goal = { distance: "half", raceDateIso: "2027-03-14", targetTimeSeconds: 6300 } as Goal;

function plan(opts: Partial<Athlete> = {}) {
  return generatePlan({ ...ATH, ...opts } as Athlete, GOAL, { startDateIso: "2026-09-21" });
}
/**
 * The DISPLAY summary, which is what the app calls PLAN.
 * ⚠️ ITS WEEKS CARRY `startIso`; the generator's weeks carry `startDateIso`. Passing the raw plan as
 * PLAN made the migration build an invalid date — the fixture was wrong, not the code, and using the
 * real builder is what stops the two shapes drifting apart in this file.
 */
function summary(opts: Partial<Athlete> = {}) {
  return buildPlanSummary({ ...ATH, ...opts, startDateIso: "2026-09-21" } as Athlete, GOAL);
}
function strengthSessions(p: ReturnType<typeof generatePlan>): { wk: number; s: Session }[] {
  const out: { wk: number; s: Session }[] = [];
  p.weeks.forEach((w, i) => w.sessions.forEach((s) => { if (s.type === "strength" && s.exercises?.length) out.push({ wk: i + 1, s }); }));
  return out;
}

test("BLOCKER: every exercise the generator emits carries a stable id, and it is the catalogue key", () => {
  const p = plan();
  const seen = new Set<string>();
  let checked = 0;
  for (const { s } of strengthSessions(p)) {
    for (const e of s.exercises!) {
      assert.ok(typeof e.id === "string" && e.id.length > 0, "exercise has no id: " + e.name);
      assert.match(e.id, /^[a-z][A-Za-z0-9]*$/, "id is not a slug: " + e.id);
      const def = exerciseById(e.id);
      assert.ok(def, "id " + e.id + " does not resolve in the catalogue");
      assert.equal(def!.name, e.name, "the catalogue and the session disagree about what " + e.id + " is called");
      seen.add(e.id);
      checked++;
    }
  }
  assert.ok(checked > 40, "the sweep saw only " + checked + " exercises — it is not reaching the plan");
  assert.ok(seen.size >= 7, "only " + seen.size + " distinct exercises across a whole block");
});

test("BLOCKER: ids are never reused or renamed — the sixteen the log may already hold are pinned", () => {
  // ⚠️ A RENAME ORPHANS HISTORY EXACTLY AS THE ARRAY INDEX DID. These are the ids that can already be
  // in a runner's store, so they are fixed for ever. Adding an exercise is free; renaming one is not.
  const pinned = ["squat", "stepUp", "splitSquat", "lunge", "rdl", "gluteBridge", "clamshell", "calf",
    "soleus", "plank", "deadbug", "birddog", "balance", "pushup", "pogo", "boxjump"];
  const have = exerciseIds();
  for (const id of pinned) assert.ok(have.includes(id), "exercise id " + id + " has gone — every logged set for it is orphaned");
  for (const id of pinned) assert.ok(exerciseById(id), id + " does not resolve");
});

test("BLOCKER: no session contains one exercise twice, which is what lets a row be keyed on the id", () => {
  // The identity of a logged set is (date, session, exercise, set). That is only unique while an
  // exercise appears at most once in a session. If a future stage adds supersets that repeat a
  // movement, this fails and that stage must carry the slot index into the row.
  for (const { wk, s } of strengthSessions(plan())) {
    const ids = s.exercises!.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "week " + wk + " " + s.id + " repeats an exercise: " + ids.join(", "));
  }
});

test("BLOCKER: a logged set survives a plan rebuild that moves the exercise", () => {
  // The defect, reproduced. Build one plan, log against it, rebuild with a different long-run day —
  // which renumbers the strength days and their exercise lists — and read the history back.
  const a = plan({ longRunDay: 0 });
  const b = plan({ longRunDay: 3, daysPerWeek: 4 });
  const sa = strengthSessions(a)[2]!;
  const ex = sa.s.exercises![1]!;
  const box = sandbox()(a, a);
  box.slogWrite("2026-10-05", sa.s.id, ex.id, 0, "w", "42.5");
  box.slogWrite("2026-10-05", sa.s.id, ex.id, 0, "r", "6");
  box.slogFlush();

  // A different plan is now live. The old reader resolved through it and would drop the row.
  const after = sandbox(box.store)(b, b);
  const rows = after.slogFor(ex.id);
  assert.equal(rows.length, 1, "the row for " + ex.id + " did not survive the rebuild");
  assert.equal(rows[0]!.w, "42.5");
  assert.equal(rows[0]!.d, "2026-10-05", "the row lost its date");
  assert.equal(after.slogBest(ex.id), 42.5);
});

test("BLOCKER: the date is part of a row's identity, so the same session id in two plans does not collide", () => {
  // Session ids are deterministic: w3d2-strength recurs in every rebuilt plan. Without the date,
  // week 3 of the old plan and week 3 of the new one are the same row.
  const box = sandbox()({ weeks: [] }, { weeks: [] });
  box.slogWrite("2026-10-05", "w3d2-strength", "squat", 0, "w", "40");
  box.slogWrite("2026-11-16", "w3d2-strength", "squat", 0, "w", "50");
  const rows = box.slogFor("squat");
  assert.equal(rows.length, 2, "the two dates collapsed into one row");
  assert.deepEqual(rows.map((r) => r.w).sort(), ["40", "50"]);
});

test("BLOCKER: writing the same set twice updates one row rather than appending", () => {
  const box = sandbox()({ weeks: [] }, { weeks: [] });
  box.slogWrite("2026-10-05", "s1", "squat", 0, "w", "4");
  box.slogWrite("2026-10-05", "s1", "squat", 0, "w", "40");
  box.slogWrite("2026-10-05", "s1", "squat", 0, "r", "6");
  const rows = box.slogFor("squat");
  assert.equal(rows.length, 1, "keystrokes appended rows instead of updating one");
  assert.equal(rows[0]!.w, "40");
  assert.equal(rows[0]!.r, "6");
  // Clearing both fields removes the row rather than leaving an empty one.
  box.slogWrite("2026-10-05", "s1", "squat", 0, "w", "");
  box.slogWrite("2026-10-05", "s1", "squat", 0, "r", "");
  assert.equal(box.slogFor("squat").length, 0, "an emptied set left a row behind");
});

test("BLOCKER: the migration carries v1 rows across, stamps them, and runs exactly once", () => {
  const p = plan();
  const target = strengthSessions(p)[1]!;
  const idx = 2;
  const ex = target.s.exercises![idx]!;
  const v1 = JSON.stringify({
    [target.s.id + "|" + idx + "|0"]: { w: "35", r: "8" },
    [target.s.id + "|" + idx + "|1"]: { w: "37.5", r: "6" },
    ["w99d9-strength|0|0"]: { w: "99", r: "1" },   // unresolvable: was already invisible in v1
  });
  const box = sandbox({ interun_slog: v1 })(summary(), p);
  box.migrateSlog();

  const rows = box.slogFor(ex.id);
  assert.equal(rows.length, 2, "the migration did not carry both sets across");
  assert.ok(rows.every((r) => r.m === 1), "carried rows are not stamped as migrated");
  assert.ok(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.d)), "a carried row has no date");
  assert.equal(box.slogAll().meta.migrated, 2);
  assert.equal(box.slogAll().meta.skipped, 1, "the unresolvable row was not counted");
  assert.ok(box.slogAll().meta.migratedAt, "no migratedAt stamp");

  // Idempotent: a second run (every launch calls it) must add nothing.
  const before = box.slogAll().rows.length;
  box.migrateSlog();
  box.migrateSlog();
  assert.equal(box.slogAll().rows.length, before, "the migration ran again and duplicated rows");
  // v1 is kept — it is the only copy of what could not be resolved.
  assert.ok(box.store["interun_slog"], "the migration deleted the v1 store");
});

test("BLOCKER: pruning folds what it drops into bests, so housekeeping never lowers a record", () => {
  const box = sandbox()({ weeks: [] }, { weeks: [] });
  // One very heavy old set, then enough newer rows to push it past the cap.
  box.slogWrite("2020-01-01", "old", "squat", 0, "w", "200");
  for (let n = 0; n < box.MAX + 5; n++) box.slogWrite("2026-01-01", "s" + n, "squat", 0, "w", "50");
  box.slogFlush();
  assert.ok(box.slogAll().rows.length <= box.MAX, "the cap did not bind");
  assert.equal(box.slogBest("squat"), 200, "pruning lost the all-time best");
  // And a typo corrected in a LIVE row still lowers the figure — bests is not a ratchet on live rows.
  const box2 = sandbox()({ weeks: [] }, { weeks: [] });
  box2.slogWrite("2026-10-05", "s1", "rdl", 0, "w", "400");
  assert.equal(box2.slogBest("rdl"), 400);
  box2.slogWrite("2026-10-05", "s1", "rdl", 0, "w", "40");
  assert.equal(box2.slogBest("rdl"), 40, "a corrected typo stayed as the best for ever");
});

test("BLOCKER: the store key is declared with the other store keys, not beside its own functions", () => {
  // migrateSlog runs from adoptPlan, which recompute() calls at module top level. A const declared
  // below that point is read in its temporal dead zone, throws, and the try/catch swallows it —
  // which is exactly how journalSync wrote nothing on any launch for weeks.
  const block = appBlock();
  const key = block.indexOf('const SLOG2_KEY =');
  const adopt = block.indexOf("function adoptPlan(");
  const max = block.indexOf("const SLOG_MAX_ROWS =");
  assert.ok(key >= 0 && adopt >= 0 && max >= 0, "SLOG2_KEY / SLOG_MAX_ROWS / adoptPlan not all found");
  assert.ok(key < adopt, "SLOG2_KEY is declared after adoptPlan — it will be read in its dead zone");
  assert.ok(max < adopt, "SLOG_MAX_ROWS is declared after adoptPlan");
});

test("BLOCKER: the new store travels in a backup, and is not treated as a credential", () => {
  const block = appBlock();
  const key = /const SLOG2_KEY = "([^"]+)";/.exec(block)![1]!;
  assert.ok(key.indexOf("interun_") === 0, "the key does not carry the interun_ prefix, so backups will not discover it");
  assert.match(key, /_v\d+$/, "the key carries no version suffix");
  const never = /const BACKUP_NEVER = \[([^\]]*)\]/.exec(block);
  assert.ok(never, "BACKUP_NEVER not found");
  assert.ok(!never![1]!.includes(key), "the set log is listed as a credential — it is the runner's training data");
});

test("BLOCKER: the history reader no longer resolves a logged set through the plan", () => {
  // The whole defect in one line: strengthHistory used to index RAW.weeks[...].exercises[i] and drop
  // what it could not find. If that returns, a rebuild deletes the history again.
  const hist = fnOf(appBlock(), "strengthHistory");
  assert.ok(!/RAW\.weeks/.test(hist), "strengthHistory reads RAW.weeks again");
  assert.ok(!/\.exercises\[/.test(hist), "strengthHistory indexes an exercises array again");
  assert.ok(/slogAll\(\)/.test(hist), "strengthHistory does not read the set log");
  assert.ok(/exerciseById\(/.test(hist), "strengthHistory does not resolve names from the catalogue");
});

test("BLOCKER: the set inputs carry the exercise id and the date, not an array index", () => {
  const eb = fnOf(appBlock(), "exerciseBlock");
  assert.ok(/data-x="/.test(eb), "the weight box does not carry the exercise id");
  assert.ok(/data-d="/.test(eb), "the weight box does not carry the date");
  assert.ok(!/data-slog="/.test(eb), "the old index-keyed attribute is still emitted");
  // And the wiring writes through slogWrite, not the retired v1 setter.
  const block = appBlock();
  assert.ok(/\[data-x\]"\)\.forEach\(\(inp\) => inp\.oninput = \(\) => slogWrite\(/.test(block),
    "the set inputs are not wired to slogWrite");
  assert.ok(!/function slogSet\(/.test(block), "the v1 writer slogSet is still defined");
});

test("BLOCKER: the exercise catalogue key IS the id — one source, so a builder cannot invent a second", () => {
  const mk = SRC.slice(SRC.indexOf("function mkEx("));
  const body = mk.slice(0, mk.indexOf("\n}"));
  assert.ok(/id: key/.test(body), "mkEx does not set id from the catalogue key");
});
