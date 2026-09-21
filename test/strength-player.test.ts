/**
 * A5 — THE GUIDED STRENGTH PLAYER: REST TIMERS, SUPERSETS, TAP-TO-LOG, COMPLETION.
 *
 * Tapping Start on a strength day runs the exercises in order, alternating supersets, logging each set
 * with one tap against last time's numbers, counting rests down and holds down, and recording a
 * finished session that survives a relaunch.
 *
 * ⚠️⚠️ THE ONE CLAIM THIS FILE EXISTS FOR IS THAT REST IS MEASURED AGAINST AN ABSOLUTE TIMESTAMP AND
 * NOT COUNTED IN TICKS. The stretch player it is modelled on does `left--` once per interval, so a
 * throttled interval makes its clock run slow — harmless for a routine somebody is watching, wrong for
 * the one timer whose whole job is to be right while the phone is face down on the floor. iOS throttles
 * timers hard in a backgrounded web view, and a tick-counting rest timer is not slightly wrong, it is
 * wrong by however long the phone was away. Measured in a real browser before this file was written:
 * twenty seconds of wall clock with ZERO interval ticks left the countdown exactly twenty seconds
 * further on (drift 0), where a tick-counting design would not have moved at all. The guards below
 * drive that with a controllable clock so the property is falsifiable rather than remembered.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { holdSecondsFor } from "../src/strength/builder.ts";
import { exerciseById } from "../src/strength/library.ts";
import { suggestLoad } from "../src/strength/progression.ts";

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/**
 * ⚠️ ANCHORED TO THE START OF A LINE. The app markup contains accept="image/*", an unbalanced comment
 * opener mid-line, so an unanchored sweep opens there and eats 10,382 characters of live code.
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
function constOf(name: string): string {
  const m = new RegExp("^const " + name + " = [^\\n]+$", "m").exec(APP);
  assert.ok(m, "const " + name + " is not declared on one line in the built page");
  return m![0]!;
}

// ------------------------------------------------------------------------------------------------
// 1. The engine says what a prescription MEANS — the app never regexes the engine's own vocabulary
// ------------------------------------------------------------------------------------------------

test("BLOCKER: holdSecondsFor answers every live hold wording, and zero for a rep prescription", () => {
  // The three that exist. "30–45s hold" is this builder's own; "20–40s hold" and "30s each leg" come
  // from BEGINNER_REPS in session-templates.ts, which is what a runner with NO strength preferences
  // still gets — the path a predicate matching only this file's own constant would have missed.
  assert.equal(holdSecondsFor("30–45s hold"), 45);
  assert.equal(holdSecondsFor("20–40s hold"), 40);
  assert.equal(holdSecondsFor("30s each leg"), 30);
  // Rep prescriptions, including the ones with words and brackets in them.
  for (const reps of ["6–8", "8–12", "3–6 (heavy)", "4–6", "12–15", "8 each side", "10–12"]) {
    assert.equal(holdSecondsFor(reps), 0, reps + " was read as a hold");
  }
  assert.equal(holdSecondsFor(""), 0);
  assert.equal(holdSecondsFor(undefined), 0);
  assert.equal(holdSecondsFor(null), 0);
});

test("BLOCKER: a hold answers the TOP of its range, so reaching zero means the prescription is met", () => {
  // Answering the bottom would have a countdown congratulate somebody a third of the way through what
  // they were asked to do — "30–45s" done in full is 45 seconds.
  assert.equal(holdSecondsFor("30–45s hold"), 45, "the lower bound was answered");
  assert.equal(holdSecondsFor("20–40s hold"), 40, "the lower bound was answered");
});

test("BLOCKER: every rep string the real generator produces is classified, swept rather than listed", () => {
  // ⚠️ DERIVED FROM REAL PLANS. A hand-written list of rep strings goes stale the first time the
  // builder rewords one, and the failure is silent: a plank starts asking for kilograms.
  const seen = new Map<string, number>();
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    for (const goal of ["running", "allRound"] as const) {
      for (const minutes of [30, 45, 60] as const) {
        const plan = generatePlan(
          { experience: "recreational", daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
            includeStrength: true, strength: { sessionsPerWeek: 2, minutes, level, goal,
              equipment: ["bodyweight", "dumbbell", "kettlebell", "bench", "barbell"] } },
          { distance: "half", raceDateIso: "2027-02-14", targetTimeSeconds: 6300 },
          { startDateIso: "2026-09-21" },
        );
        for (const w of plan.weeks) for (const s of w.sessions) for (const e of (s.exercises || [])) {
          seen.set(e.reps, holdSecondsFor(e.reps));
        }
      }
    }
  }
  assert.ok(seen.size >= 4, "only " + seen.size + " distinct rep strings swept — the grid proves little");
  for (const [reps, secs] of seen) {
    const looksLikeHold = /\ds\b/.test(reps);
    assert.equal(secs > 0, looksLikeHold, reps + " was classified as hold=" + (secs > 0));
    if (secs > 0) assert.ok(secs >= 15 && secs <= 120, reps + " gave an implausible hold of " + secs + "s");
  }
  // And at least one of each kind was actually produced, or the sweep proved nothing either way.
  assert.ok([...seen.values()].some((v) => v > 0), "no hold prescription appeared in any real plan");
  assert.ok([...seen.values()].some((v) => v === 0), "no rep prescription appeared in any real plan");
});

// ------------------------------------------------------------------------------------------------
// 2. The play order — supersets, unequal pairs, and the last set
// ------------------------------------------------------------------------------------------------

/**
 * strPlayItems, lifted and executed.
 *
 * ⚠️ RC.holdSecondsFor IS SUPPLIED FROM THE REAL ENGINE MODULE, not stubbed. A stub would let the app's
 * hold handling pass against a predicate the engine does not have — the "a probe that supplies its own
 * dependency measures a strictly easier program" trap this repo has now recorded three times.
 */
function loadPlayItems(): (sess: unknown) => Array<Record<string, unknown>> {
  const body = fnOf("strPlayItems");
  // eslint-disable-next-line no-new-func
  const factory = new Function("RC", body + "\nreturn strPlayItems;");
  return factory({ holdSecondsFor });
}

const EX = (id: string, sets: number, rest: number, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, cue: "", pattern: "squat", sets, reps: "6–8", restSeconds: rest, ...extra });

test("BLOCKER: a superset alternates and rests once per round, which is what makes the session fit its minutes", () => {
  const strPlayItems = loadPlayItems();
  const items = strPlayItems({ id: "s", exercises: [EX("a", 2, 120, { superset: 1 }), EX("b", 2, 90, { superset: 1 })] });
  assert.deepEqual(items.map((i) => i.x), ["a", "b", "a", "b"], "the pair did not alternate");
  // Rest only after the LAST exercise of each round. Resting after both would add a rest per round and
  // overrun the minutes the card claims — the builder's own pairCost charges one rest, not two.
  assert.deepEqual(items.map((i) => i.rest), [0, 90, 0, 0], "a superset rested more than once per round");
});

test("BLOCKER: a superset whose members have unequal set counts keeps every set, the trailing one standing alone", () => {
  // ⚠️ MEASURED ON A REAL 45-MINUTE SESSION: group 3 is a 2-set step-up paired with a 1-set plank.
  // Zipping the two lists and assuming equal length drops the step-up's second set entirely.
  const strPlayItems = loadPlayItems();
  const items = strPlayItems({ id: "s", exercises: [EX("a", 2, 120, { superset: 3 }), EX("b", 1, 45, { superset: 3 })] });
  assert.deepEqual(items.map((i) => i.x + "#" + ((i.set as number) + 1)), ["a#1", "b#1", "a#2"],
    "an unequal pair lost a set or invented one");
  // Round 2 has no partner, so it is a single set and takes its own rest rather than half a pair's.
  assert.equal(items[0]!.rest, 0, "the first of a pair rested");
  assert.equal(items[1]!.rest, 45, "the last of a pair did not rest");
});

test("BLOCKER: no rest after the last set of the session", () => {
  const strPlayItems = loadPlayItems();
  const items = strPlayItems({ id: "s", exercises: [EX("a", 2, 120), EX("b", 2, 90)] });
  assert.equal(items[items.length - 1]!.rest, 0,
    "the final set starts a countdown — a timer asking the runner to wait for the end of their own workout");
  assert.ok((items[items.length - 2]!.rest as number) > 0, "the fixture cannot tell a real rest from the final one");
});

test("BLOCKER: every prescribed set appears exactly once, across every real generated strength session", () => {
  const strPlayItems = loadPlayItems();
  let sessions = 0;
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    for (const minutes of [30, 45, 60] as const) {
      const plan = generatePlan(
        { experience: "recreational", daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
          includeStrength: true, strength: { sessionsPerWeek: 2, minutes, level, goal: "allRound",
            equipment: ["bodyweight", "dumbbell", "kettlebell", "bench"] } },
        { distance: "half", raceDateIso: "2027-02-14", targetTimeSeconds: 6300 },
        { startDateIso: "2026-09-21" },
      );
      for (const w of plan.weeks) for (const s of w.sessions) {
        if (s.type !== "strength" || !s.exercises || !s.exercises.length) continue;
        sessions++;
        const items = strPlayItems(s);
        const want: string[] = [];
        for (const e of s.exercises) for (let i = 0; i < (e.sets || 1); i++) want.push(e.id + "#" + i);
        const got = items.map((i) => i.x + "#" + i.set);
        assert.equal(got.length, want.length, s.id + ": the player runs " + got.length + " sets of " + want.length + " prescribed");
        assert.deepEqual([...got].sort(), [...want].sort(), s.id + ": the player's sets are not the prescribed ones");
      }
    }
  }
  assert.ok(sessions > 20, "only " + sessions + " sessions swept");
});

// ------------------------------------------------------------------------------------------------
// 3. The rest timer — the claim this file exists for
// ------------------------------------------------------------------------------------------------

/**
 * The timer functions, lifted onto a controllable clock.
 *
 * ⚠️ Date IS REPLACED, NOT MOCKED AROUND. The whole property under test is "the remaining time is
 * derived from the clock, not accumulated from ticks", so the guard has to be able to move the clock
 * WITHOUT delivering any ticks — which is precisely what a throttled iOS web view does.
 */
function loadTimer() {
  let now = 1_700_000_000_000;
  const buzzes: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const scope = {
    SPLAY: null as Record<string, unknown> | null,
    Date: { now: () => now },
    haptic: (k: string) => { buzzes.push(k); },
    setInterval: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; },
    clearInterval: (_h: number) => { timers.length = 0; },
    $: (_id: string) => null,
    fmtPace: (s: number) => String(s),
    strPaintPlayer: () => {},
    strFinish: () => { if (scope.SPLAY) scope.SPLAY.done = true; },
  };
  const body = [
    constOf("STR_REST_WARN_S"),
    fnOf("strRestLeft"),
    fnOf("strHoldLeft"),
    fnOf("strAdvance"),
    fnOf("strTick"),
  ].join("\n");
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "let SPLAY = ctx.SPLAY;" +
    "const Date = ctx.Date, haptic = ctx.haptic, setInterval = ctx.setInterval, clearInterval = ctx.clearInterval," +
    "  $ = ctx.$, fmtPace = ctx.fmtPace, strPaintPlayer = ctx.strPaintPlayer, strFinish = ctx.strFinish;" +
    body +
    "\nreturn { strRestLeft, strHoldLeft, strTick, strAdvance, set: (v) => { SPLAY = v; ctx.SPLAY = v; }, get: () => SPLAY };");
  const api = factory(scope);
  return {
    ...api, buzzes,
    advance: (seconds: number) => { now += seconds * 1000; },
    tick: () => { for (const t of timers.slice()) t.fn(); },
    now: () => now,
    warnAt: Number(/STR_REST_WARN_S = (\d+)/.exec(constOf("STR_REST_WARN_S"))![1]),
  };
}

test("BLOCKER: rest is derived from the clock, so twenty seconds with NO ticks at all still passes twenty seconds", () => {
  const T = loadTimer();
  T.set({ items: [{ rest: 0 }], i: 0, restEnd: T.now() + 120_000, warned: false, rang: false, timer: null });
  assert.equal(T.strRestLeft(), 120);
  // Throttled: the clock moves, the interval never fires. A counter-based timer cannot move here at all
  // — this is the exact difference from the stretch player, and the whole reason this design exists.
  T.advance(20);
  assert.equal(T.strRestLeft(), 100, "the countdown did not follow the wall clock while ticks were suspended");
  T.advance(100);
  assert.equal(T.strRestLeft(), 0, "the countdown did not reach zero");
  T.advance(60);
  assert.equal(T.strRestLeft(), 0, "the countdown went negative rather than clamping");
});

test("BLOCKER: the ten-second warning fires once, and never after the rest has already ended", () => {
  const warn = loadTimer().warnAt;
  // (a) A rest running down normally: the warning fires at the threshold, once, then the end buzzes.
  {
    const T = loadTimer();
    T.set({ items: [{ rest: 0 }, { rest: 0 }], i: 0, restEnd: T.now() + (warn + 5) * 1000, warned: false, rang: false, timer: null });
    T.strTick();
    T.tick();
    assert.deepEqual(T.buzzes, [], "a buzz fired while there was plenty of rest left");
    T.advance(6); T.tick();
    assert.deepEqual(T.buzzes, ["tick"], "the ten-second warning did not fire at the threshold");
    T.advance(1); T.tick(); T.advance(1); T.tick();
    assert.deepEqual(T.buzzes, ["tick"], "the ten-second warning fired more than once");
    T.advance(warn); T.tick();
    assert.deepEqual(T.buzzes, ["tick", "lift"], "the end of the rest did not buzz");
  }
  // (b) ⚠️ WOKEN FROM A THROTTLE PAST THE END. Both thresholds are behind us; buzzing "ten seconds
  // left" then is a statement about the time that is simply false. Only the end may fire.
  {
    const T = loadTimer();
    T.set({ items: [{ rest: 0 }, { rest: 0 }], i: 0, restEnd: T.now() + 8000, warned: false, rang: false, timer: null });
    T.strTick();
    T.advance(13);            // wake five seconds PAST the end, having delivered no ticks
    T.tick();
    assert.deepEqual(T.buzzes, ["lift"], "a stale ten-second warning fired after the rest had already ended");
  }
});

test("BLOCKER: a hold counts down against the clock too, and ends the set when it reaches zero", () => {
  const T = loadTimer();
  T.set({ items: [{ rest: 0, hold: 45 }, { rest: 0 }], i: 0, restEnd: null, holdEnd: T.now() + 45_000,
    warned: false, rang: false, timer: null });
  assert.equal(T.strHoldLeft(), 45);
  T.strTick();
  T.advance(20); T.tick();
  assert.equal(T.strHoldLeft(), 25, "the hold did not follow the wall clock");
  T.advance(25); T.tick();
  assert.equal(T.get()!.i, 1, "a finished hold did not advance to the next set");
  assert.ok(T.buzzes.includes("lift"), "the end of a hold did not buzz");
});

test("BLOCKER: advancing past the final set finishes the session rather than starting a rest", () => {
  const T = loadTimer();
  T.set({ items: [{ rest: 0 }], i: 0, restEnd: null, warned: false, rang: false, timer: null, done: false });
  T.strAdvance();
  assert.equal(T.get()!.done, true, "the last set did not finish the session");
  assert.equal(T.get()!.restEnd, null, "a countdown started after the last set of the session");
});

// ------------------------------------------------------------------------------------------------
// 4. Completion — the store, and the tick that has to survive a relaunch
// ------------------------------------------------------------------------------------------------

function loadSdoneApi() {
  // sdoneSave (A8) is lifted alongside the others -- it is the counterpart to sdoneMark that persists
  // a mutation made on a row AFTER it was returned, which is what a Strava send result needs.
  const body = [constOf("SDONE_KEY"), fnOf("loadSdone"), fnOf("saveSdone"), fnOf("sdoneMark"), fnOf("sdoneHas"), fnOf("sdoneSave")].join("\n");
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("localStorage", body + "\nreturn { loadSdone, sdoneMark, sdoneHas, sdoneSave };");
  return { ...factory(localStorage), raw: store };
}

test("BLOCKER: finishing is idempotent on (date, session) — a second finish updates one row rather than adding another", () => {
  const S = loadSdoneApi();
  S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 4, ex: 8, min: 45 });
  S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 9, ex: 8, min: 45 });
  const rows = S.loadSdone();
  assert.equal(rows.length, 1, "a second finish added a second row — every count on the Strength tab doubles");
  assert.equal(rows[0].sets, 9, "the second finish was skipped rather than updating the fuller attempt");
});

test("BLOCKER: the same session id on a DIFFERENT date is a different row, because ids recur across rebuilds", () => {
  // ⚠️ w3d2-strength recurs in every rebuilt plan. Keyed on the id alone, finishing week 3's strength
  // day reads as having already finished week 7's — the identity lesson the set log learned first.
  const S = loadSdoneApi();
  S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 4, ex: 8, min: 45 });
  S.sdoneMark("2026-11-05", "w1-d3-strength", { sets: 4, ex: 8, min: 45 });
  assert.equal(S.loadSdone().length, 2, "two dates collapsed into one row");
  assert.equal(S.sdoneHas("2026-10-01", "w1-d3-strength"), true);
  assert.equal(S.sdoneHas("2026-10-02", "w1-d3-strength"), false, "a completion leaked onto a neighbouring date");
});

test("BLOCKER: seedDone re-derives the tick from the store, matched on date AND id", () => {
  // ⚠️ state.done IS REBUILT FROM SCRATCH ON EVERY BOOT, so a tick set by the player and nowhere else
  // lives exactly until the app is next launched. This is the block that makes it survive.
  const fn = fnOf("seedDone");
  assert.match(fn, /loadSdone\(\)/, "seedDone no longer reads the completion store");
  assert.match(fn, /fin\[iso \+ "\|" \+ s\.id\]/,
    "the completion replay no longer matches on date AND session id — an id-only match ticks every week that shares the id");
  // And it runs AFTER state.done is cleared, or it is wiped by the very function that sets it.
  assert.ok(fn.indexOf("state.done = {}") >= 0, "seedDone no longer clears state.done");
  assert.ok(fn.indexOf("state.done = {}") < fn.indexOf("loadSdone()"),
    "the completion replay runs before state.done is cleared, so it is wiped immediately");
});

test("BLOCKER: the completion store is discovered by backup export through the interun_ prefix", () => {
  const m = /const SDONE_KEY = "([^"]+)"/.exec(APP);
  assert.ok(m, "SDONE_KEY is not declared as a plain string literal");
  assert.match(m![1]!, /^interun_/, "the completion store would not travel in a backup export");
  assert.match(fnOf("loadSdone"), /SDONE_KEY/);
  assert.match(fnOf("saveSdone"), /SDONE_KEY/);
});

test("BLOCKER: sdoneMark stamps the session's title once, and a re-finish naming none does not blank it (A8)", () => {
  // t is what strengthStravaPayload reads for the activity's name -- a re-finish (Finish tapped twice,
  // or the same session reopened) passes no title at all, and must not erase the one already recorded.
  const S = loadSdoneApi();
  S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 4, ex: 8, min: 45, t: "Push day" });
  assert.equal(S.loadSdone()[0].t, "Push day");
  S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 9, ex: 8, min: 45 });
  assert.equal(S.loadSdone()[0].t, "Push day", "a re-finish with no title blanked the one already stored");
});

test("BLOCKER: sdoneSave persists a mutation made on a row returned earlier by sdoneMark, and touches no other row (A8)", () => {
  // ⚠️ loadSdone() has no in-memory cache the way SLOG does, so a row held onto after sdoneMark returns
  // is not automatically "live" -- this is what makes it so, by finding the SAME row again on (d, s)
  // and writing the mutated object back over it.
  //
  // ⚠️ SAME DATE, DIFFERENT SESSION, MARKED IN THE ORDER THAT DEFEATS A d-ONLY MATCH RATHER THAN
  // PASSING IT BY LUCK. sdoneMark unshifts a new row to the FRONT of the array, so marking the row
  // under test FIRST puts "other" in front of it — a match on date alone then finds "other" first and
  // clobbers ITS identity instead. A first version of this fixture marked "other" first, which put the
  // row under test at index 0: a date-only match found the right row purely by array position, and a
  // real re-break of this exact fault (dropping the session-id half of the comparison) did not fail.
  const S = loadSdoneApi();
  const row = S.sdoneMark("2026-10-01", "w1-d3-strength", { sets: 4, ex: 8, min: 45 });
  const other = S.sdoneMark("2026-10-01", "other-session", { sets: 1, ex: 1, min: 10 });
  row.strava = { state: "done", id: "999" };
  S.sdoneSave(row);
  const rows = S.loadSdone();
  assert.equal(rows.length, 2, "sdoneSave changed the number of rows in the store");
  const mine = rows.filter((r: any) => r.s === "w1-d3-strength");
  const others = rows.filter((r: any) => r.s === "other-session");
  assert.equal(mine.length, 1, "the target row's own identity did not survive the save");
  assert.equal(others.length, 1, "a same-date row lost its identity -- sdoneSave overwrote the wrong row");
  assert.deepEqual(mine[0]!.strava, { state: "done", id: "999" }, "the mutation on the row was not persisted");
  assert.equal(others[0]!.strava, undefined, "a mutation on one row leaked onto a different one sharing its date");
});

// ------------------------------------------------------------------------------------------------
// 5. Wiring — the strength Start must never reach the running machinery
// ------------------------------------------------------------------------------------------------

test("BLOCKER: strength Start opens the player and never the GPS path", () => {
  // ⚠️ #sdStart opens "where shall we record this", which leads to GPS, a wake lock, the coach and a
  // live LiveSession — all wrong for a session done standing still in a room, and the GPS one wrong
  // expensively. Driven in a browser as well: 0 calls to openStartWhereSheet, 0 geolocation watches.
  const wire = fnOf("wireSheet");
  assert.match(wire, /sdStrength[\s\S]{0,400}?openStrengthPlayer\(/,
    "the strength Start no longer opens the player");
  const branch = /const sdStrength[\s\S]*?\n  }/.exec(wire);
  assert.ok(branch, "the sdStrength branch is not where this guard expects it");
  assert.doesNotMatch(branch![0]!, /openStartWhereSheet|startSession\(|RC\.LiveSession/,
    "the strength Start reaches the running machinery");
});

test("BLOCKER: PRIMARY_TYPES excludes strength, so the two Start ids cannot collide", () => {
  const m = /const PRIMARY_TYPES = \{[^}]*\}/.exec(APP);
  assert.ok(m, "PRIMARY_TYPES is not declared as a one-line object");
  assert.doesNotMatch(m![0]!, /strength/, "strength entered the runnable set — it would get the GPS Start");
  // And the sheet only offers the strength Start for a strength session that has exercises to run.
  const sheet = fnOf("sessionSheetHtml");
  assert.match(sheet, /sess\.type === "strength" && sess\.exercises && sess\.exercises\.length/,
    "the strength Start is offered without checking there is anything to play");
});

test("BLOCKER: the player resolves swaps at its ENTRY POINT, so no caller has to remember to", () => {
  // ⚠️ A4's own "every consumer calls withSwaps" sweep is what caught this. Resolving at the call site
  // was correct only by convention, and a convention every future caller must know is one a future caller
  // eventually will not. Applied at the entry point, SPLAY.sess is the swapped session for the player's
  // whole life — the items, the finish row and anything added later all see the exercise the runner chose.
  assert.match(fnOf("openStrengthPlayer"), /const sess = withSwaps\(rawSess\)/,
    "the player no longer resolves swaps itself — it would run the plan's exercise while the sheet shows the runner's");
  assert.match(fnOf("openStrengthPlayer"), /strPlayItems\(sess\)/,
    "the flattener is handed the raw session rather than the resolved one");
});

test("BLOCKER: closeSheet stops the player, or its interval runs on behind a dismissed sheet", () => {
  // The exact trap stretchStop's own comment records — and here it would mean a rest countdown buzzing
  // in the middle of the next session.
  assert.match(fnOf("closeSheet"), /strengthStop\(\)/, "closeSheet no longer stops the strength player");
  assert.match(fnOf("strengthStop"), /clearInterval/, "strengthStop no longer clears the interval");
  assert.match(fnOf("strengthStop"), /SPLAY = null/, "strengthStop no longer drops the player state");
  // Opening a player clears any previous one first, so two intervals can never run at once.
  assert.match(fnOf("openStrengthPlayer"), /strengthStop\(\)/,
    "opening a player does not stop the previous one — two intervals would run together");
});

/**
 * strPlayerBodyHtml, lifted and rendered.
 *
 * ⚠️ DRIVEN, BECAUSE THE TEXTUAL VERSION OF THIS GUARD WAS DEFEATED BY ITS OWN SUBJECT. The first cut
 * sliced the hold branch from "it.hold" to where the rep-logging branch begins, and a re-break that put a
 * rep-logging div INSIDE the hold branch moved that very marker — so the slice collapsed and the assertion
 * passed against exactly the defect it names. A marker the defect itself can introduce is not a boundary.
 * Rendering the thing and looking at the output cannot be fooled that way.
 */
/**
 * ⚠️ A6 ADDED strSuggestFor AS A DEPENDENCY OF strPlayerBodyHtml, AND THIS HARNESS WENT STALE THE
 * MOMENT IT DID — the acceptable kind: it failed loudly with a ReferenceError rather than quietly
 * measuring less. strParseSet/strPriorInstances/strSuggestFor and a real RC (exerciseById,
 * suggestLoad — not stubbed, same reasoning as holdSecondsFor's own comment above) are lifted
 * alongside the functions this file already exercised.
 */
function loadBodyHtml() {
  const body = [
    constOf("STR_REST_WARN_S"),
    fnOf("strRestLeft"),
    fnOf("strHoldLeft"),
    fnOf("strPrefill"),
    fnOf("strParseSet"),
    fnOf("strPriorInstances"),
    fnOf("strSuggestFor"),
    fnOf("strPlayerBodyHtml"),
    fnOf("strPlayerDoneHtml"),
  ].join("\n");
  const ctx = {
    SPLAY: null as Record<string, unknown> | null,
    esc: (x: unknown) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    exAnim: () => "<svg></svg>",
    ICON: { play: "<svg/>", check: "<svg/>" },
    fmtPace: (n: number) => String(n),
    slogFor: () => [],
    RC: { exerciseById, suggestLoad },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "let SPLAY = ctx.SPLAY;" +
    "const esc = ctx.esc, exAnim = ctx.exAnim, ICON = ctx.ICON, fmtPace = ctx.fmtPace, slogFor = ctx.slogFor, RC = ctx.RC;" +
    body +
    "\nreturn (s) => { SPLAY = s; return strPlayerBodyHtml(); };");
  return factory(ctx);
}

test("BLOCKER: a hold is performed and counted, and asks for no weight or reps at all", () => {
  // ⚠️ A plank is not weight x reps. Writing its seconds into the reps field corrupts the one number
  // A6's e1RM reads (Epley is defined for 1-10 reps), and strengthHistory drops any row carrying neither
  // weight nor reps anyway -- so a hold row would be written and then silently discarded.
  const render = loadBodyHtml();
  const base = { sess: { id: "s" }, iso: "2026-10-01", i: 0, restEnd: null, holdEnd: null, done: false, logged: 0 };
  const holdOut = render({ ...base, items: [{ x: "plank", name: "Plank", cue: "", pattern: "plank",
    set: 0, ofSets: 1, reps: "30\u201345s hold", load: "", hold: 45, rest: 0, ss: null }] });
  assert.doesNotMatch(holdOut, /id="strpW"|id="strpR"|data-f="w"|data-f="r"/,
    "a hold offers weight and reps boxes");
  assert.match(holdOut, /id="strpHoldGo"/, "a hold offers no way to start the countdown");
  // The control case: a rep set DOES get them, or the assertion above is satisfied by rendering nothing.
  const repOut = render({ ...base, items: [{ x: "squat", name: "Squat", cue: "", pattern: "squat",
    set: 0, ofSets: 2, reps: "6\u20138", load: "70\u201375%", hold: 0, rest: 120, ss: null }] });
  assert.match(repOut, /id="strpW"/, "a rep set lost its weight box -- the hold assertion above proves nothing");
  assert.match(repOut, /id="strpR"/, "a rep set lost its reps box");
  assert.doesNotMatch(repOut, /id="strpHoldGo"/, "a rep set offers a hold countdown");
});

test("BLOCKER: the hold label does not say the word twice", () => {
  // "Hold for " + "30-45s hold" renders "Hold for 30-45s hold". Found by reading the rendered label in a
  // browser, not the code -- and the other live wording ("30s each leg") does not carry the word at all,
  // which is why it is stripped rather than assumed.
  const render = loadBodyHtml();
  const base = { sess: { id: "s" }, iso: "2026-10-01", i: 0, restEnd: null, holdEnd: null, done: false, logged: 0 };
  const out = render({ ...base, items: [{ x: "plank", name: "Plank", cue: "", pattern: "plank",
    set: 0, ofSets: 1, reps: "30\u201345s hold", load: "", hold: 45, rest: 0, ss: null }] });
  assert.doesNotMatch(out, /Hold for [^<]*hold/i, "the hold label repeats the word");
  assert.match(out, /Hold for 30\u201345s</, "the hold label lost the prescription it is meant to show");
  const leg = render({ ...base, items: [{ x: "balance", name: "Balance", cue: "", pattern: "balance",
    set: 0, ofSets: 1, reps: "30s each leg", load: "", hold: 30, rest: 0, ss: null }] });
  assert.match(leg, /Hold for 30s each leg</, "a wording without the word lost its text to the strip");
});

test("the player replaces the sheet body in place and never opens a second overlay", () => {
  // Every picker in this app that returns to something already open rewrites #sheetBody and re-wires;
  // a nested sheet needs its own back-stack and is the shape of z-order bug this project has shipped
  // twice (the Inte-Club share ask opening behind the card it was asking about).
  const open = fnOf("openStrengthPlayer");
  assert.match(open, /\$\("sheetBody"\)\.innerHTML/, "the player no longer renders into the sheet body");
  assert.doesNotMatch(open, /ensureSheet\(|sheetOv|classList\.add\("on"\)/,
    "the player opens an overlay of its own");
});
