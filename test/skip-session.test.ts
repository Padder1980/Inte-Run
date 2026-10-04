import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { weekVolumeMeters } from "../src/domain/steps.ts";
import { sessionIdFor } from "../src/plan/generate-plan.ts";

/**
 * STAGE B2 (2026-10-02) — skip a single session without rebuilding the week.
 *
 * A skip is a row in the break store (interun_adjust_v1): { kind: "skip", mode: "skip", from, to, sid }.
 * It inherits the break store's machinery — adoptPlan's ordering, the Planned breaks list with its
 * Cancel, the week marking — and adds three rules of its own, each held here against the real functions
 * lifted out of the built page:
 *   - adjDrops answers for it AFTER the race guard, so the race can never be skipped (PLAN.md's re-break);
 *   - adjustFor never returns it, because one-row-per-day resolution would let a skip hide a holiday's
 *     level, or hide a "make this week easier" row from eased();
 *   - it outlives its day, because a session put back into a past RAW week counts as a miss.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function skipSession(");
  assert.ok(marker >= 0, "skipSession is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  return html.slice(open + 8, close);
}
const SRC = appScript();
function fnBody(name: string): string {
  const at = SRC.indexOf("function " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "no const " + name + " in the build");
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
const decomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const TODAY = ISO(new Date());
const TODAY_DOW = (new Date(TODAY + "T00:00:00Z").getUTCDay() + 6) % 7;
const THIS_MON = addDays(TODAY, -TODAY_DOW);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Last week, this week, next week. Next week ends on race day, so the race guard has a real target.
const STARTS = [addDays(THIS_MON, -7), THIS_MON, addDays(THIS_MON, 7)];
// A session id in the engine's real form: the week's Monday, the day and the type ("2026-10-05-d1-easy").
const ID = (w: number, d: number, t: string) => STARTS[w - 1] + "-d" + d + "-" + t;
// ⚠️ THE REST DAY IS NEVER TODAY, so "today's session" exists whichever day the suite runs on.
const REST = [1, 2, 3, 4, 5, 6].find((d) => d > TODAY_DOW) ?? [1, 2, 3, 4, 5, 6].find((d) => d !== TODAY_DOW)!;
const TYPES = ["easy", "threshold", "easy", "vo2", "easy", "strength", "long"].map((t, d) => (d === REST ? "rest" : t));

function fixture() {
  const mk = (w: number) => TYPES.map((t, d) => {
    const type = w === 3 && d === 6 ? "race" : t;
    return { id: ID(w, d, type), dayOfWeek: d, type,
      title: type === "race" ? "Race day: half marathon" : "Session " + DAYS[d] + " " + type,
      estimatedDurationSeconds: 2400, estimatedDistanceMeters: 8000, trainingDistanceMeters: 7000, steps: [] };
  });
  const raw = [mk(1), mk(2), mk(3)];
  return {
    RAW: { weeks: raw.map((sessions) => ({ sessions, plannedDistanceMeters: weekVolumeMeters(sessions as any), qualitySessionCount: 2 })) },
    PLAN: { weeks: STARTS.map((startIso, wi) => ({ index: wi + 1, startIso, distanceKm: 0, quality: 2, longRunMin: 40,
      sessions: raw[wi]!.map((s) => ({ id: s.id, day: DAYS[s.dayOfWeek], dayIndex: s.dayOfWeek, type: s.type, title: s.title })) })) },
  };
}

const FNS = ["isoAdd", "todayIso", "dmon", "runDateLabelIso", "esc", "genDay", "effDay", "ovTo", "ovFrom", "doneKey",
  "rawSessionDone", "loadLinks", "saveLinks", "planSessionRef", "linkedRunFor", "loadAdjust", "saveAdjust", "adjPhrase",
  "adjustFor", "weekSkips", "adjDrops", "applyAdjustments", "eased", "weekAdjust", "weekAdjustNote", "plannedBreaksHtml", "bRaceAhead",
  "skipOfferable", "skipSession", "cancelAdjust", "todayDecision", "sessionEffort", "effortVar",
  "loadTimes", "hmValid", "sessionTimeAt", "legacySid", "sidKeys", "weekMoves", "xwDir",
  // B5: saveAdjust records a break that has just ended before its prune can drop it.
  "reentryCapture", "loadReentry", "saveReentry"];
const CONSTS = ["DAY_ORDER", "MONTHS", "MON_SHORT", "ADJUST_KEY", "SKIP_KEEP_DAYS", "LINK_KEY", "ADJ_MODES", "ADJ_QUALITY",
  "ADJ_RUN", "SESSION_EFFORT", "TIME_KEY", "XWEEK", "REENTRY_KEY", "REENTRY_MODES", "REENTRY_ASK_DAYS"];

function sandbox() {
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const f = fixture();
  const PLAN: any = f.PLAN, RAW: any = f.RAW;
  const state: any = { done: {}, dayOverride: {}, selWeek: 1, selDay: TODAY_DOW, planWeek: 3, wx: null };
  const toasts: string[] = [];
  const box: any = { store, state, PLAN, RAW, toasts, calls: [] as string[] };
  const env: Record<string, unknown> = {
    state, PLAN, RAW, localStorage, profile: { startDateIso: "" },
    RC: { weekVolumeMeters, sessionIdFor, easeWeek: () => ({ triggered: false }), weekView: () => ({}) },
    TODAY_IN_PLAN: true, TODAY_DOW, ICON: { cal: "", wxSun: "", timer: "", heart: "" },
    progExtraOf: () => null,
    // ⚠️ recompute IS adoptPlan's part that matters here: a fresh plan, then applyAdjustments over it.
    recompute: () => { const g = fixture(); PLAN.weeks = g.PLAN.weeks; RAW.weeks = g.RAW.weeks; box.api.applyAdjustments(); box.calls.push("recompute"); },
    computeToday: () => box.calls.push("computeToday"), seedDone: () => box.calls.push("seedDone"),
    todayTicks: () => [], restoreTicks: () => box.calls.push("restoreTicks"), closeSheet: () => box.calls.push("closeSheet"),
    render: () => box.calls.push("render"), toast: (m: string) => toasts.push(m),
    toastUndo: (m: string, fn: () => void) => { toasts.push(m); box.undo = fn; },
    planDefaultWeek: () => 2, CURRENT_WEEK: 1,
    selectedSession: () => RAW.weeks[state.selWeek].sessions.filter((s: any) => s.type !== "rest" && s.dayOfWeek === state.selDay)[0] || null,
    curWeek: () => PLAN.weeks[state.selWeek], isCurrentWeek: () => state.selWeek === 1,
    todayNextUp: () => null, currentConditions: () => null,
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") + "};")(...names.map((n) => env[n]));
  return box;
}
const sess = (box: any, w: number, d: number) => box.RAW.weeks[w].sessions.find((s: any) => s.dayOfWeek === d);
// The next day this week holding a session, or null on a Sunday — so a test that needs a future session
// gets one whenever the calendar allows, rather than quietly passing because tomorrow was the rest day.
const futureDay = () => [1, 2, 3, 4, 5, 6].map((n) => TODAY_DOW + n).find((d) => d <= 6 && d !== REST) ?? null;

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a skip takes one session by id — and never the race, however it is asked", () => {
  const { api } = sandbox();
  const race = { id: ID(3, 6, "race"), type: "race" };
  // ⚠️ PLAN.md's OWN RE-BREAK: move the skip branch above the race guard, and this fails.
  assert.equal(api.adjDrops({ mode: "skip", sid: ID(3, 6, "race") }, race), false, "a skip took the race");
  assert.equal(api.adjDrops({ mode: "skip", sid: ID(2, 1, "threshold") }, { id: ID(2, 1, "threshold"), type: "threshold" }), true);
  assert.equal(api.adjDrops({ mode: "skip", sid: ID(2, 1, "threshold") }, { id: ID(2, 2, "easy"), type: "easy" }), false,
    "a skip took a session it does not name");
  // A skip of a strength session is a skip like any other: the runner chose it, and nothing else asks.
  assert.equal(api.adjDrops({ mode: "skip", sid: ID(2, 5, "strength") }, { id: ID(2, 5, "strength"), type: "strength" }), true);
  assert.match(decomment(fnBody("adjDrops")), /if \(s\.type === "race"\) return false;[\s\S]*if \(a\.mode === "skip"\)/,
    "the skip branch is not after the race guard");
});

test("BLOCKER: a skip is never the answer to 'which window covers this day'", () => {
  const { api } = sandbox();
  const day = addDays(THIS_MON, 2);
  const skip = { id: "s", mode: "skip", kind: "skip", from: day, to: day, sid: ID(2, 2, "easy") };
  const hol = { id: "h", mode: "none", kind: "holiday", from: day, to: day };
  // The skip is FIRST in the list, which is the order a fresh skip takes (newest first).
  assert.equal(api.adjustFor(day, [skip, hol]), hol, "a skip hid the holiday covering the same day");
  assert.equal(api.adjustFor(day, [skip]), null, "a skip answered as a window");
  // And a skip on a Monday must not hide a "make this week easier" row from eased().
  const mon = { id: "s2", mode: "skip", kind: "skip", from: THIS_MON, to: THIS_MON, sid: ID(2, 0, "easy") };
  const rec = { id: "r", mode: "recovery", kind: "recovery", from: THIS_MON, to: addDays(THIS_MON, 6) };
  assert.equal(api.eased({ startIso: THIS_MON }, [mon, rec]), true, "a Monday skip hid the easier week");
});

test("BLOCKER: applying a skip removes exactly that session from BOTH shapes, and the week's figures follow", () => {
  const box = sandbox();
  const { api, PLAN, RAW, store } = box;
  const s = sess(box, 1, 1); // this week's threshold (day 1 is never the rest day unless REST is 1)
  const target = s && s.type !== "rest" ? s : sess(box, 1, 3);
  const iso = addDays(THIS_MON, target.dayOfWeek);
  store["interun_adjust_v1"] = JSON.stringify([{ id: "s", kind: "skip", mode: "skip", from: iso, to: iso, sid: target.id }]);
  const kmBefore = weekVolumeMeters(RAW.weeks[1].sessions);
  const n = api.applyAdjustments();
  assert.equal(n, 1, "the skip removed " + n + " sessions");
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.id === target.id), "RAW still prescribes the skipped session");
  assert.ok(!PLAN.weeks[1].sessions.some((x: any) => x.id === target.id), "the plan still shows the skipped session");
  assert.equal(RAW.weeks[1].sessions.length, 6, "a skip took more than its one session"); // 7 days, 1 rest kept, 1 skipped
  assert.equal(RAW.weeks[1].plannedDistanceMeters, kmBefore - 7000, "the week's mileage did not follow, from the engine's own sum");
  assert.equal(PLAN.weeks[1].distanceKm, Math.round((kmBefore - 7000) / 100) / 10);
  // Nothing else in the plan moved — the other weeks hold all seven.
  assert.equal(RAW.weeks[0].sessions.length, 7); assert.equal(RAW.weeks[2].sessions.length, 7);
});

test("a skip and a holiday on the same day BOTH apply, and a skip naming the race leaves it in", () => {
  const box = sandbox();
  const { api, RAW, store } = box;
  const d = TODAY_DOW !== REST ? TODAY_DOW : (TODAY_DOW + 1) % 7;
  const iso = addDays(THIS_MON, d);
  const s = sess(box, 1, d);
  store["interun_adjust_v1"] = JSON.stringify([
    { id: "s", kind: "skip", mode: "skip", from: iso, to: iso, sid: s.id },
    { id: "h", kind: "holiday", mode: "full", from: iso, to: iso },  // "everything as planned" — removes nothing
    { id: "r", kind: "skip", mode: "skip", from: addDays(STARTS[2]!, 6), to: addDays(STARTS[2]!, 6), sid: ID(3, 6, "race") },
  ]);
  api.applyAdjustments();
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.id === s.id), "a holiday on the same day shadowed the skip");
  assert.ok(RAW.weeks[2].sessions.some((x: any) => x.type === "race"), "the race was skipped");
});

test("BLOCKER: a skip outlives its day — six weeks — so the session never comes back as a miss", () => {
  const { api, store } = sandbox();
  const row = (id: string, from: string) => ({ id, kind: "skip", mode: "skip", from, to: from, sid: ID(1, 0, "easy") });
  api.saveAdjust([row("recent", addDays(TODAY, -10)), row("edge", addDays(TODAY, -42)), row("old", addDays(TODAY, -43))]);
  const kept = JSON.parse(store["interun_adjust_v1"]).map((r: any) => r.id);
  assert.deepEqual(kept, ["recent", "edge"], "a skip was pruned inside the miss window, or kept past it");
  // ⚠️ The miss count is built from RAW, so a skip kept is a session kept out of it.
  assert.match(decomment(fnBody("easeWeekEvidence")), /const w = PLAN\.weeks\[i\], rw = RAW\.weeks\[i\];[\s\S]*for \(const sess of rw\.sessions\)/,
    "the miss count no longer reads RAW, so a skip would not protect a session from it");
  // A past WINDOW is still dropped at once, as it always was.
  api.saveAdjust([{ id: "hol", kind: "holiday", mode: "none", from: addDays(TODAY, -5), to: addDays(TODAY, -1) }]);
  assert.deepEqual(JSON.parse(store["interun_adjust_v1"]), [], "an ended holiday was kept");
});

test("BLOCKER: a run of skips can never push a booked holiday out of the store", () => {
  const { api, store } = sandbox();
  const rows: any[] = [];
  for (let i = 0; i < 50; i++) rows.push({ id: "s" + i, kind: "skip", mode: "skip", from: TODAY, to: TODAY, sid: "x" + i });
  rows.push({ id: "far-holiday", kind: "holiday", mode: "easy", from: addDays(TODAY, 90), to: addDays(TODAY, 97) });
  api.saveAdjust(rows);
  const kept = JSON.parse(store["interun_adjust_v1"]);
  assert.ok(kept.some((r: any) => r.id === "far-holiday"), "fifty skips pushed a holiday booked three months ahead out of the store");
  assert.equal(kept.filter((r: any) => r.mode === "skip").length, 40, "skips are not capped on their own");
});

test("BLOCKER: Skip is offered for today and later, never for the race, the past, or a session already done", () => {
  const box = sandbox();
  const { api, state, PLAN } = box;
  const today = sess(box, 1, TODAY_DOW);
  if (today.type !== "rest") assert.equal(api.skipOfferable(today, 2), true, "today's session cannot be skipped");
  const fd = futureDay();
  if (fd != null) assert.equal(api.skipOfferable(sess(box, 1, fd), 2), true, "tomorrow's session cannot be skipped");
  assert.equal(api.skipOfferable(sess(box, 2, 6), 3), false, "the race can be skipped");
  assert.equal(api.skipOfferable(sess(box, 0, 0), 1), false, "a session from last week can be skipped after the fact");
  assert.equal(api.skipOfferable({ id: "x1-123", type: "easy", dayOfWeek: TODAY_DOW }, 2), false, "an added session is offered a plan skip");
  if (today.type !== "rest") {
    // Done today, by a run finished since launch:
    const twin = PLAN.weeks[1].sessions.find((x: any) => x.id === today.id);
    state.done[api.doneKey(2, twin)] = true;
    assert.equal(api.skipOfferable(today, 2), false, "a session already run today can be skipped");
    state.done = {};
    // Done by a linked run (B1):
    box.store["interun_link_v1"] = JSON.stringify({ "man-1": { sid: today.id, wk: 2, iso: TODAY } });
    assert.equal(api.skipOfferable(today, 2), false, "a session a run already fulfils can be skipped");
  }
});

test("BLOCKER: skipping is one commit with an Undo — store snapshot first, the view left where it was", () => {
  const box = sandbox();
  const { api, RAW, state, store, toasts } = box;
  const fd = futureDay() ?? (sess(box, 1, TODAY_DOW).type !== "rest" ? TODAY_DOW : null);
  if (fd == null) return;
  const s = sess(box, 1, fd);
  api.skipSession(s, 2);
  const rows = JSON.parse(store["interun_adjust_v1"]);
  assert.equal(rows.length, 1);
  assert.deepEqual({ kind: rows[0].kind, mode: rows[0].mode, from: rows[0].from, to: rows[0].to, sid: rows[0].sid, t: rows[0].t },
    { kind: "skip", mode: "skip", from: addDays(THIS_MON, fd), to: addDays(THIS_MON, fd), sid: s.id, t: s.title });
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.id === s.id), "the session is still in the rebuilt plan");
  assert.match(toasts[toasts.length - 1]!, /^Skipped\. It won.t count as missed\.$/, "the toast does not say it is not a miss");
  assert.equal(state.planWeek, 3, "skipping moved the Plan screen off the week the runner was reading");
  assert.ok(box.calls.indexOf("seedDone") > box.calls.indexOf("recompute") && box.calls.includes("restoreTicks"),
    "today's ticks are not carried across the rebuild");
  box.undo();
  assert.deepEqual(JSON.parse(store["interun_adjust_v1"]), [], "Undo did not restore the store");
  assert.ok(RAW.weeks[1].sessions.some((x: any) => x.id === s.id), "Undo did not put the session back");
  // ⚠️ AND THE SAME TEST GUARDS THE WRITE: a refused session writes nothing.
  api.skipSession(sess(box, 2, 6), 3);
  assert.deepEqual(JSON.parse(store["interun_adjust_v1"]), [], "the race was written as a skip");
});

test("the Plan screen marks a week that lost a session to a skip, and names it", () => {
  const box = sandbox();
  const { api, store } = box;
  const fd = futureDay() ?? TODAY_DOW;
  const s = sess(box, 1, fd);
  const iso = addDays(THIS_MON, fd);
  store["interun_adjust_v1"] = JSON.stringify([{ id: "s", kind: "skip", mode: "skip", from: iso, to: iso, sid: s.id, t: "Tempo 3 x 10 min" }]);
  const mark = api.weekAdjust({ startIso: THIS_MON, index: 2 });
  assert.ok(mark, "a week with a skipped session reads as untouched");
  assert.equal(mark.tag, "Skipped");
  assert.equal(mark.adj, null);
  const note = api.weekAdjustNote({ startIso: THIS_MON, index: 2 });
  assert.match(note, /Skipped \u00b7 /, "the note does not say a session was skipped");
  assert.match(note, /Tempo 3 x 10 min is off the plan, and it won.t count as a missed session\./);
  assert.match(note, /put it back from Manage plan/, "an upcoming skip does not name its way back");
  assert.equal(api.weekAdjust({ startIso: STARTS[2], index: 3 }), null, "another week was marked");
  // A skip from an earlier day says nothing about putting it back — it is no longer listed there.
  store["interun_adjust_v1"] = JSON.stringify([{ id: "o", kind: "skip", mode: "skip", from: STARTS[0], to: STARTS[0], sid: ID(1, 0, "easy"), t: "Easy" }]);
  assert.ok(!/put it back/.test(api.weekAdjustNote({ startIso: STARTS[0], index: 1 })), "a past skip offers a way back that is not there");
});

test("Planned breaks lists an upcoming skip with its Cancel, in the session's own colour, and not a past one", () => {
  const { api, store } = sandbox();
  store["interun_adjust_v1"] = JSON.stringify([
    { id: "up", kind: "skip", mode: "skip", from: TODAY, to: TODAY, sid: ID(2, 0, "easy"), t: "Long run 90 min", ty: "long" },
    { id: "gone", kind: "skip", mode: "skip", from: addDays(TODAY, -3), to: addDays(TODAY, -3), sid: ID(1, 0, "easy"), t: "Old one", ty: "easy" },
  ]);
  const html = api.plannedBreaksHtml();
  assert.match(html, /Skipped/, "the skip is not listed");
  assert.match(html, /Long run 90 min/, "the skip does not name its session");
  assert.match(html, /data-pbdel="up"/, "the skip has no Cancel");
  assert.ok(!/Old one/.test(html), "a skip from an earlier day is offered as a planned break");
  assert.match(html, /--pc: var\(--eff-hard\)|--pc: var\(--eff-moderate\)|--pc: var\(--eff-/, "the colour is not an effort colour");
  // Only skips from earlier days: nothing to list, and no empty heading.
  store["interun_adjust_v1"] = JSON.stringify([{ id: "gone", kind: "skip", mode: "skip", from: addDays(TODAY, -3), to: addDays(TODAY, -3), sid: ID(1, 0, "easy") }]);
  assert.equal(api.plannedBreaksHtml(), "", "a list of nothing was rendered");
});

test("Cancelling a skip puts the session back, and says so", () => {
  const box = sandbox();
  const { api, store, RAW, toasts } = box;
  const d = TODAY_DOW !== REST ? TODAY_DOW : (TODAY_DOW + 1) % 7;
  const s = sess(box, 1, d);
  const iso = addDays(THIS_MON, d);
  store["interun_adjust_v1"] = JSON.stringify([{ id: "s", kind: "skip", mode: "skip", from: iso, to: iso, sid: s.id }]);
  api.applyAdjustments();
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.id === s.id));
  api.cancelAdjust("s");
  assert.ok(box.RAW.weeks[1].sessions.some((x: any) => x.id === s.id), "cancelling the skip did not put the session back");
  assert.equal(toasts[toasts.length - 1], "Session put back.");
});

test("Today says a skipped day was skipped — not that the plan chose to rest it", () => {
  const box = sandbox();
  const { api, store, RAW } = box;
  const s = sess(box, 1, TODAY_DOW);
  if (s.type === "rest") return;
  store["interun_adjust_v1"] = JSON.stringify([{ id: "s", kind: "skip", mode: "skip", from: TODAY, to: TODAY, sid: s.id, t: "Tempo 3 x 10 min" }]);
  api.applyAdjustments();
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.dayOfWeek === TODAY_DOW && x.type !== "rest"), "today still holds a session");
  const d = api.todayDecision();
  assert.equal(d.headline, "Skipped today", "a skipped day reads as the plan's own recovery day");
  assert.match(d.implication, /^Tempo 3 x 10 min is off today.s plan, and it won.t count as a missed session\.$/);
});

test("BLOCKER: the session sheet offers Skip through the same test the action runs, and wires it there", () => {
  const sheet = decomment(fnBody("sessionSheetHtml"));
  assert.match(sheet, /const skipBtn = skipOfferable\(sess, week\)/, "the button is not gated by the action's own test");
  assert.match(sheet, /id="sdSkip">Skip this session</);
  assert.match(sheet, /elsewhere \+\s*skipBtn \+\s*startBtn;/, "Start is no longer last in the sheet");
  const wire = decomment(fnBody("wireSheet"));
  assert.match(wire, /\$\("sdSkip"\)[\s\S]{0,200}sdSkip\.onclick = \(\) => skipSession\(ctx\.sess, ctx\.week\)/,
    "Skip this session is rendered and does nothing");
  assert.match(decomment(fnBody("skipSession")), /if \(!skipOfferable\(sess, week\)\) return;/, "the action does not ask the button's own question");
  // ⚠️ adoptPlan's ordering covers it: the one place skips are applied is applyAdjustments.
  const callers = [...decomment(SRC).matchAll(/function (\w+)\s*\([^)]*\)\s*\{/g)].map((m) => m[1]!)
    .filter((n) => { try { return /weekSkips\(/.test(decomment(fnBody(n)).replace(/^function \w+\s*\([^)]*\)/, "")); } catch { return false; } });
  // B4: xwDropped asks too — a run a skip has taken does not occupy its day for a week-move — and it reads
  // the same weekSkips through the same adjDrops, so it is one more reader of the one definition.
  assert.deepEqual(callers.sort(), ["applyAdjustments", "todayDecision", "weekAdjust", "xwDropped"],
    "skip membership is decided somewhere new: " + callers.join(", "));
});

test("BLOCKER: a skip stored under the old week-number id is carried across by its own date, and still takes its session", () => {
  // ⚠️ THE DEFECT THIS FIXES: the plan is rebuilt from today, so after a Monday an old id named the session a
  // week LATER and the skipped session came back. The row's own date says which week it meant, exactly.
  const box = sandbox();
  const { api, RAW, store } = box;
  const d = futureDay() ?? TODAY_DOW;
  const s = sess(box, 1, d);
  const iso = addDays(THIS_MON, d);
  // Written this week by the old code, when this week was "week 2" of the block.
  store["interun_adjust_v1"] = JSON.stringify([{ id: "o", kind: "skip", mode: "skip", from: iso, to: iso, sid: "w2-d" + d + "-" + s.type }]);
  assert.equal(api.loadAdjust()[0].sid, s.id, "the old id was not carried to the calendar-week form");
  api.applyAdjustments();
  assert.ok(!RAW.weeks[1].sessions.some((x: any) => x.id === s.id), "an old skip no longer takes its session");
});
