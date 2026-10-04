import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sessionVolumeMeters, weekVolumeMeters } from "../src/domain/steps.ts";
import { weekView, buildPlanSummary } from "../src/view/plan-summary.ts";
import { easeWeek } from "../src/adapt/missed-sessions.ts";
import { generatePlan, HARD_BEFORE_RACE, sessionIdFor } from "../src/plan/generate-plan.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

/**
 * STAGE B4 (2026-10-04) — move a session a week earlier or later.
 *
 * A move is a day-override with a week offset — { to, from, wk: ±1 } in interun_dayov_v1 — applied by
 * applyCrossWeekMoves inside adoptPlan, which moves the RAW session, re-derives both weeks' distance with the
 * engine's weekVolumeMeters and re-projects PLAN through the engine's weekView. xwRefusal is the one set of
 * rules, read by the rebuild AND the sheet. Everything below drives the real functions lifted out of the
 * built page over a small plan built with the engine's own projection.
 *
 * AND THE FOUNDATION IT NEEDED: session ids name their calendar week now ("2026-10-12-d1-threshold"). The plan
 * is rebuilt from today on every launch, so the old ids ("w3-d1-threshold") shifted a week every Monday and
 * every store keyed on one — a dragged day, a skip, a time — then pointed at the wrong week. legacySid carries
 * an old id across.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function applyCrossWeekMoves(");
  assert.ok(marker >= 0, "applyCrossWeekMoves is not in the build — run node web/app.ts");
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
// ⚠️ THE PLAN STARTS NEXT MONDAY, so no day in it has passed whichever day the suite runs on — a move is
// refused for a past day, and that refusal must be tested on purpose rather than by the calendar.
const MON = (w: number) => addDays(THIS_MON, 7 * (w + 1));
const ID = (w: number, d: number, t: string) => MON(w) + "-d" + d + "-" + t;
const WEEKS = 5;

type Opts = { mondayRace?: boolean; partial?: number };
/**
 * Five weeks; the last is race week. A week: easy Mon, threshold Tue, rest Wed, easy Thu, rest Fri,
 * strength Sat, long Sun. Race week: easy Mon, rest, easy Wed, rest, rest, easy Sat, RACE Sun.
 * mondayRace puts the race on race week's Monday and leaves the Sunday before it (race eve) free.
 */
function fixture(o: Opts = {}) {
  const sess = (w: number, d: number, type: string, min: number, km: number) => ({
    id: ID(w, d, type), dayOfWeek: d, type, title: type + " " + w + "/" + d, intensity: type === "threshold" ? "hard" : "easy",
    estimatedDurationSeconds: min * 60, estimatedDistanceMeters: km * 1000, trainingDistanceMeters: Math.round(km * 900), steps: [],
  });
  const week = (w: number) => {
    if (w === WEEKS - 1) {
      return o.mondayRace
        ? [sess(w, 0, "race", 100, 21.1), sess(w, 1, "rest", 0, 0), sess(w, 2, "rest", 0, 0)]
        : [sess(w, 0, "easy", 30, 5), sess(w, 1, "rest", 0, 0), sess(w, 2, "easy", 25, 4), sess(w, 3, "rest", 0, 0),
          sess(w, 4, "rest", 0, 0), sess(w, 5, "easy", 20, 3), sess(w, 6, "race", 100, 21.1)];
    }
    const list = [sess(w, 0, "easy", 40, 7), sess(w, 1, "threshold", 50, 9), sess(w, 2, "rest", 0, 0), sess(w, 3, "easy", 35, 6),
      sess(w, 4, "rest", 0, 0), sess(w, 5, "strength", 40, 0), sess(w, 6, "long", 90, 16)];
    // A Monday race's eve is this Sunday: the engine puts a shakeout there; the fixture leaves it free.
    return o.mondayRace && w === WEEKS - 2 ? list.filter((s) => s.dayOfWeek !== 6) : list;
  };
  const raw = Array.from({ length: WEEKS }, (_, w) => {
    let sessions = week(w);
    let startDateIso = MON(w);
    if (o.partial != null && w === 0) { sessions = sessions.filter((s) => s.dayOfWeek >= o.partial!); startDateIso = addDays(MON(0), o.partial); }
    return { index: w + 1, startDateIso, phase: w === WEEKS - 1 ? "taper" : "build", isDeload: false, focus: "",
      sessions, plannedDistanceMeters: weekVolumeMeters(sessions as any), qualitySessionCount: sessions.filter((s) => s.type === "threshold").length };
  });
  const PLAN = { weeks: raw.map((w, i) => Object.assign(weekView(w as any), { startIso: MON(i) })) };
  return { RAW: { weeks: raw }, PLAN };
}

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "dayLabelIso", "esc", "genDay", "effDay", "ovTo", "ovFrom",
  "doneKey", "loadLinks", "saveLinks", "planSessionRef", "tickSession", "linkedRunFor", "loadAdjust", "saveAdjust", "adjPhrase",
  "adjustFor", "weekSkips", "adjDrops", "applyAdjustments", "eased", "easeWeekIn", "loadTimes", "saveTimes", "setSessionTime",
  "sessionTimeAt", "hmValid", "legacySid", "sidKeys", "loadDayOverride", "saveDayOverride", "skipOfferable",
  "xwDir", "xwDayOf", "xwRaceIso", "xwDropped", "xwRefusal", "applyCrossWeekMoves", "xwHomeOf", "xwOfferable", "xwTargets",
  "moveSessionToWeek", "xwBlockText", "xwPickerHtml", "xwRowHtml", "moveSession", "weekMoves", "xwMovedFrom", "weekAdjust",
  "weekAdjustNote", "seedDone"];
const CONSTS = ["DAY_ORDER", "MONTHS", "MON_SHORT", "ADJUST_KEY", "SKIP_KEEP_DAYS", "LINK_KEY", "TIME_KEY", "PRIMARY_TYPES",
  "XWEEK", "ADJ_MODES", "ADJ_QUALITY", "ADJ_RUN", "XW_WHY"];

function sandbox(o: Opts = {}, seed: Record<string, string> = {}) {
  const store: Record<string, string> = { ...seed };
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const f = fixture(o);
  const PLAN: any = f.PLAN, RAW: any = f.RAW;
  const state: any = { done: {}, dayOverride: {}, heatAdapt: {}, selWeek: 0, planWeek: 1 };
  const toasts: string[] = [];
  // The clock is the real one unless a test moves it: todayIso is the app's only reader of "now" here.
  const clock = { today: TODAY };
  const box: any = { store, state, PLAN, RAW, toasts, clock, opts: o, calls: [] as string[], undo: null as null | (() => void) };
  const env: Record<string, unknown> = {
    state, PLAN, RAW, localStorage, EXTRA: [], todayIso: () => clock.today,
    RC: { weekVolumeMeters, sessionVolumeMeters, weekView, easeWeek, HARD_BEFORE_RACE, sessionIdFor },
    progExtraOf: () => null, saveHeatAdapt: () => {}, loadSwaps: () => ({}), saveSwaps: () => {}, loadSdone: () => [],
    // ⚠️ recompute IS adoptPlan's part that matters here, in adoptPlan's order: a fresh plan, the week-moves,
    // then the breaks — and the throw clause adoptPlan has, so a fault reads as "not known", never as "none".
    recompute: () => {
      const g = fixture(o); PLAN.weeks = g.PLAN.weeks; RAW.weeks = g.RAW.weeks;
      try { box.api.applyCrossWeekMoves(); } catch (e) { box.api.setXweek(null); }
      box.api.applyAdjustments(); box.calls.push("recompute");
    },
    computeToday: () => box.calls.push("computeToday"), todayTicks: () => [], restoreTicks: () => box.calls.push("restoreTicks"),
    closeSheet: () => box.calls.push("closeSheet"), render: () => box.calls.push("render"),
    toast: (m: string) => toasts.push(m), toastUndo: (m: string, fn: () => void) => { toasts.push(m); box.undo = fn; },
    syncWatch: () => box.calls.push("syncWatch"), syncNativeReminders: () => box.calls.push("syncNativeReminders"),
    planDefaultWeek: () => 1, CURRENT_WEEK: 0, TODAY_DOW,
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") + ", xweek: () => XWEEK, setXweek: (v) => { XWEEK = v; } };")(...names.map((n) => env[n]));
  // The app's own boot: state.dayOverride is read from the store after the first rebuild.
  (env.recompute as () => void)();
  state.dayOverride = box.api.loadDayOverride();
  box.api.seedDone();
  return box;
}
/** A relaunch: the plan rebuilt from scratch, state re-read from the store, seedDone's prune. */
function relaunch(box: any) {
  box.calls.length = 0;
  const g = fixture(box.opts || {});
  box.PLAN.weeks = g.PLAN.weeks; box.RAW.weeks = g.RAW.weeks;
  try { box.api.applyCrossWeekMoves(); } catch (e) { box.api.setXweek(null); }
  box.api.applyAdjustments();
  box.state.dayOverride = box.api.loadDayOverride();
  box.api.seedDone();
}
const where = (box: any, sid: string) => {
  for (let wi = 0; wi < box.RAW.weeks.length; wi++) {
    const s = box.RAW.weeks[wi].sessions.find((x: any) => x.id === sid);
    if (s) return { wi, day: box.api.effDay(s) };
  }
  return null;
};
const stored = (box: any) => JSON.parse(box.store["interun_dayov_v1"] || "{}");
/** Every PLAN week holds exactly RAW's sessions, in RAW's order, and reports RAW's own distance. */
function shapesAgree(box: any) {
  box.PLAN.weeks.forEach((w: any, i: number) => {
    const raw = box.RAW.weeks[i];
    assert.deepEqual(w.sessions.map((s: any) => s.id + "@" + s.dayIndex), raw.sessions.map((s: any) => s.id + "@" + s.dayOfWeek),
      "PLAN and RAW disagree about week " + (i + 1));
    assert.equal(w.distanceKm, Math.round(weekVolumeMeters(raw.sessions) / 100) / 10, "week " + (i + 1) + "'s distance is not the engine's sum");
    assert.equal(raw.plannedDistanceMeters, weekVolumeMeters(raw.sessions), "RAW week " + (i + 1) + " kept a stale distance");
  });
}

/* ------------------------------------------------------------------------------------------------ *
 * 1. The foundation: ids that name their calendar week                                               *
 * ------------------------------------------------------------------------------------------------ */

const ATH = { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1500 }, experience: "recreational",
  includeStrength: true, longRunDay: 6 } as Athlete;

test("BLOCKER: a session's id names its calendar week, so it is the same id after a Monday", () => {
  // The defect: the plan is rebuilt from today, so on a Monday a block that has begun loses a week and
  // every later week's NUMBER drops by one. Ids built from the number named a different week afterwards.
  const race = addDays(THIS_MON, 7 * 12 + 6);
  const goal = (start: string) => ({ distance: "half", targetTimeSeconds: 6300, raceDateIso: race, startDateIso: start }) as Goal;
  const before = generatePlan(ATH, goal(addDays(THIS_MON, 7)));
  const after = generatePlan(ATH, goal(addDays(THIS_MON, 14)));   // a week later: one week fewer
  assert.equal(after.weeks.length, before.weeks.length - 1, "the fixture did not shrink the block — it proves nothing");
  const byDate = (p: typeof before) => {
    const m = new Map<string, string>();
    p.weeks.forEach((w) => w.sessions.forEach((s) => m.set(addDays(w.startDateIso, s.dayOfWeek - ((new Date(w.startDateIso + "T00:00:00Z").getUTCDay() + 6) % 7)) + " " + s.type, s.id)));
    return m;
  };
  const a = byDate(before), b = byDate(after);
  let same = 0, shared = 0;
  b.forEach((id, key) => { if (a.has(key)) { shared++; if (a.get(key) === id) same++; } });
  assert.ok(shared > 50, "too few sessions in common to judge");
  assert.equal(same, shared, "a session kept its date and type across the Monday but changed its id");
  for (const w of after.weeks) for (const s of w.sessions) {
    assert.ok(!/^w\d+-/.test(s.id), "an id still carries the week's number: " + s.id);
    assert.match(s.id, /^\d{4}-\d{2}-\d{2}-d[0-6]-/, "an id does not lead with its week's Monday: " + s.id);
  }
  const ids = after.weeks.flatMap((w) => w.sessions.map((s) => s.id));
  assert.equal(new Set(ids).size, ids.length, "two sessions in one plan share an id");
  // PLAN (the summary) and RAW (the generator) must name every session alike — the app pairs them by id.
  const sum = buildPlanSummary(ATH, goal(addDays(THIS_MON, 14)));
  assert.deepEqual(sum.weeks.map((w: any) => w.sessions.map((s: any) => s.id)), after.weeks.map((w) => w.sessions.map((s) => s.id)));
});

test("BLOCKER: an id in the old week-number form is carried to the calendar-week form — by its own date when it has one", () => {
  const { api, PLAN } = sandbox();
  // Dated: exact, whatever the plan's numbering is today.
  assert.equal(api.legacySid("w7-d2-easy", addDays(MON(1), 2)), ID(1, 2, "easy"));
  assert.equal(api.legacySid("w1-d0-long", addDays(MON(3), 4)), ID(3, 0, "long"), "a row's own date did not decide its week");
  // Undated: the live plan's numbering — exactly where the old code applied it.
  assert.equal(api.legacySid("w2-d1-threshold", ""), PLAN.weeks[1].startIso + "-d1-threshold");
  // Anything else is left alone.
  for (const id of [ID(1, 1, "threshold"), "x0-1700000000000", "w3d2-strength", "", null]) assert.equal(api.legacySid(id, ""), null);
});

test("BLOCKER: the stores keyed on a session id read an old id through legacySid, and the undated one is written back", () => {
  const seed = {
    interun_dayov_v1: JSON.stringify({ "w2-d1-threshold": { to: 4, from: 1 } }),   // Friday: free
    interun_time_v1: JSON.stringify({ "w9-d6-long": { t: "07:00", iso: addDays(MON(2), 6) } }),
    interun_adjust_v1: JSON.stringify([{ id: "s", kind: "skip", mode: "skip", from: addDays(MON(3), 3), to: addDays(MON(3), 3), sid: "w4-d3-easy" }]),
    interun_link_v1: JSON.stringify({ r1: { sid: "w1-d0-easy", wk: 1, iso: MON(0) } }),
  };
  const box = sandbox({}, seed);
  const { api, RAW } = box;
  assert.deepEqual(stored(box), { [ID(1, 1, "threshold")]: { to: 4, from: 1 } }, "the dragged day was not carried and written back");
  assert.equal(where(box, ID(1, 1, "threshold"))!.day, 4, "the carried drag does not move its session");
  assert.equal(api.sessionTimeAt(addDays(MON(2), 6), ID(2, 6, "long")), "07:00", "an old time of day was lost");
  assert.ok(!RAW.weeks[3].sessions.some((x: any) => x.id === ID(3, 3, "easy")), "an old skip no longer takes its session");
  assert.equal(api.loadLinks().r1.sid, ID(0, 0, "easy"), "an old link no longer names its session");
});

/* ------------------------------------------------------------------------------------------------ *
 * 2. The rebuild                                                                                     *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a week-move moves RAW's session, sets its day, and BOTH shapes and BOTH weeks' distance follow", () => {
  const box = sandbox();
  const sid = ID(1, 1, "threshold");
  const km = (wi: number) => weekVolumeMeters(box.RAW.weeks[wi].sessions);
  const before = [km(1), km(2)];
  const vol = sessionVolumeMeters(box.RAW.weeks[1].sessions.find((x: any) => x.id === sid));
  box.state.dayOverride[sid] = { to: 2, from: 1, wk: 1 };
  box.api.saveDayOverride();
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 2, day: 2 }, "the session did not land on Wednesday of the week after");
  assert.equal(box.RAW.weeks[2].sessions.find((x: any) => x.id === sid).dayOfWeek, 2, "RAW's dayOfWeek is not the new day");
  assert.ok(!box.PLAN.weeks[1].sessions.some((x: any) => x.id === sid), "the plan still shows it in its old week");
  assert.deepEqual([km(1), km(2)], [before[0]! - vol, before[1]! + vol], "the distance did not move with the session");
  // ⚠️ PLAN.md's OWN RE-BREAK: skip the re-projection and PLAN and RAW disagree. This is that check.
  shapesAgree(box);
  assert.equal(box.PLAN.weeks[1].quality, 0, "the week that lost its threshold still counts a quality session");
  assert.equal(box.PLAN.weeks[2].quality, 2);
  assert.deepEqual(box.api.xweek(), { [sid]: { home: 1, at: 2, t: "threshold 1/1" } });
  assert.deepEqual(stored(box)[sid], { to: 2, from: 1, wk: 1 }, "seedDone pruned a move the rebuild had applied");
});

test("BLOCKER: the rules — no second run on a day, nothing into or out of race week, nothing hard on race eve", () => {
  const box = sandbox();
  const { api } = box;
  const thr = box.RAW.weeks[1].sessions.find((x: any) => x.type === "threshold");
  const ov = box.state.dayOverride, rows: any[] = [];
  assert.equal(api.xwRefusal(thr, 1, 2, 0, ov, rows), "taken", "a day with a run took a second one");
  assert.equal(api.xwRefusal(thr, 1, 2, 4, ov, rows), "", "a free day was refused");
  assert.equal(api.xwRefusal(thr, 1, 2, 5, ov, rows), "", "a strength-only day was refused — strength is not a run");
  const t3 = box.RAW.weeks[3].sessions.find((x: any) => x.type === "threshold");
  assert.equal(api.xwRefusal(t3, 3, 4, 1, ov, rows), "race", "a session went INTO race week");
  const easyRace = box.RAW.weeks[4].sessions.find((x: any) => x.type === "easy");
  assert.equal(api.xwRefusal(easyRace, 4, 3, 2, ov, rows), "race", "a session came OUT of race week");
  assert.equal(api.xwRefusal(box.RAW.weeks[4].sessions.find((x: any) => x.type === "race"), 4, 3, 2, ov, rows), "type", "the race itself moved");
  assert.equal(api.xwRefusal(thr, 1, 3, 2, ov, rows), "far", "a session went two weeks from where the plan put it");
  assert.equal(api.xwRefusal(thr, 1, 0, 2, ov, rows), "", "a week EARLIER was refused");
  // Race eve: only a Monday race puts it in another week, so only that can be reached by a week-move.
  const m = sandbox({ mondayRace: true });
  const hard = m.RAW.weeks[2].sessions.find((x: any) => x.type === "threshold");
  const easy = m.RAW.weeks[2].sessions.find((x: any) => x.type === "easy");
  assert.equal(m.api.xwRefusal(hard, 2, 3, 6, m.state.dayOverride, []), "eve", "a threshold landed the day before the race");
  assert.equal(m.api.xwRefusal(easy, 2, 3, 6, m.state.dayOverride, []), "", "an easy run was refused race eve — only hard types are");
  // ⚠️ ONE DEFINITION: the app reads the engine's set and keeps no copy of its own.
  assert.match(decomment(fnBody("xwRefusal")), /RC\.HARD_BEFORE_RACE\.has\(s\.type\)/);
  assert.ok(!/\[\s*"threshold",\s*"vo2",\s*"race-specific",\s*"long",\s*"strength"\s*\]/.test(decomment(SRC)), "the app carries its own copy of HARD_BEFORE_RACE");
  // A part-week's days before the plan starts do not exist.
  const p = sandbox({ partial: 3 });
  const t1 = p.RAW.weeks[1].sessions.find((x: any) => x.type === "threshold");
  assert.equal(p.api.xwRefusal(t1, 1, 0, 1, p.state.dayOverride, []), "start", "a session landed before the plan starts");
  assert.equal(p.api.xwRefusal(t1, 1, 0, 4, p.state.dayOverride, []), "");
});

test("BLOCKER: a stored move the plan can no longer honour is not applied, and seedDone prunes it", () => {
  const box = sandbox();
  const sid = ID(1, 1, "threshold");
  box.state.dayOverride[sid] = { to: 0, from: 1, wk: 1 };   // Monday of week 3 holds an easy run
  box.api.saveDayOverride();
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 1, day: 1 }, "a refused move still moved the session — or dragged it to Monday of its own week");
  assert.equal(stored(box)[sid], undefined, "the refused move was kept, waiting to drag the session somewhere it was never put");
  shapesAgree(box);
  // A stale from (the plan put it on another day since) is the same answer.
  box.state.dayOverride[sid] = { to: 4, from: 3, wk: 1 };
  box.api.saveDayOverride();
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 1, day: 1 });
  assert.equal(stored(box)[sid], undefined);
});

test("BLOCKER: the rebuild is order-free — a session may land on a day another move has just freed", () => {
  // Week 2's threshold goes to week 3's Wednesday; week 1's Monday run takes week 2's Tuesday it left.
  // The dependent move sorts FIRST by id, so applying them one at a time would refuse it.
  const box = sandbox();
  const t2 = ID(1, 1, "threshold"), e1 = ID(0, 0, "easy");
  assert.ok(e1 < t2, "the fixture no longer puts the dependent move first — it proves nothing");
  box.state.dayOverride[t2] = { to: 2, from: 1, wk: 1 };
  box.state.dayOverride[e1] = { to: 1, from: 0, wk: 1 };
  box.api.saveDayOverride();
  relaunch(box);
  assert.deepEqual(where(box, t2), { wi: 2, day: 2 });
  assert.deepEqual(where(box, e1), { wi: 1, day: 1 }, "a move onto a day another move freed was refused for the order it was read in");
  shapesAgree(box);
  // And when the two genuinely collide, ONE goes home rather than both landing on a day.
  const c = sandbox();
  c.state.dayOverride[ID(1, 1, "threshold")] = { to: 4, from: 1, wk: 1 };
  c.state.dayOverride[ID(3, 1, "threshold")] = { to: 4, from: 1, wk: -1 };
  c.api.saveDayOverride();
  relaunch(c);
  const runsOnFri = c.RAW.weeks[2].sessions.filter((x: any) => ["easy", "threshold", "long"].includes(x.type) && c.api.effDay(x) === 4);
  assert.equal(runsOnFri.length, 1, "two moves both landed on one day");
  shapesAgree(c);
});

test("BLOCKER: the moves go in BEFORE the breaks — a holiday booked later spares a session moved out of it; a skip in its new week takes it", () => {
  const ad = decomment(fnBody("adoptPlan"));
  assert.ok(ad.indexOf("applyCrossWeekMoves()") >= 0 && ad.indexOf("applyCrossWeekMoves()") < ad.indexOf("applyAdjustments()"),
    "adoptPlan applies the breaks before the week-moves");
  assert.ok(ad.indexOf("applyCrossWeekMoves()") < ad.indexOf("syncWatch()"), "the watch is told before the moves are applied");
  const box = sandbox();
  const sid = ID(1, 1, "threshold");
  box.state.dayOverride[sid] = { to: 2, from: 1, wk: 1 };
  box.api.saveDayOverride();
  // "Not running" over the whole of the week it LEFT.
  box.api.saveAdjust([{ id: "h", kind: "holiday", mode: "none", from: MON(1), to: addDays(MON(1), 6) }]);
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 2, day: 2 }, "a holiday over the week a session had LEFT took it");
  // A skip dated in its new week takes it there — and it stays gone after another launch (the move is kept).
  box.api.saveAdjust([{ id: "s", kind: "skip", mode: "skip", from: addDays(MON(2), 2), to: addDays(MON(2), 2), sid }]);
  relaunch(box);
  relaunch(box);
  assert.equal(where(box, sid), null, "the skipped moved session came back — in its old week, where no skip names it");
  assert.deepEqual(stored(box)[sid], { to: 2, from: 1, wk: 1 }, "seedDone pruned the move of a session a skip had taken");
  // Week 2 still says what it lost.
  const out = box.api.weekMoves(box.PLAN.weeks[1]);
  assert.equal(out.length, 1); assert.equal(out[0].dir, "out"); assert.equal(out[0].gone, true);
  assert.match(box.api.weekAdjustNote(box.PLAN.weeks[1]), /was moved to week 3, then taken off the plan there/);
});

test("BLOCKER: a week-move the rebuild did not apply moves nothing — effDay reads it only when XWEEK says it is in", () => {
  const box = sandbox();
  const sid = ID(1, 1, "threshold");
  const s = box.RAW.weeks[1].sessions.find((x: any) => x.id === sid);
  box.state.dayOverride[sid] = { to: 4, from: 1, wk: 1 };   // stored, but no rebuild has applied it
  assert.equal(box.api.effDay(s), 1, "an unapplied week-move dragged the session to Friday of its OWN week");
  box.api.setXweek(null);   // a rebuild that threw: "not known"
  box.api.seedDone();
  assert.ok(box.state.dayOverride[sid], "seedDone pruned a week-move when the rebuild had not said what it applied");
});

/* ------------------------------------------------------------------------------------------------ *
 * 3. The runner's action                                                                             *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: moving is one commit with an Undo, the time of day goes with it, and coming home is no move at all", () => {
  const box = sandbox();
  const { api } = box;
  const sid = ID(1, 1, "threshold");
  const s = box.RAW.weeks[1].sessions.find((x: any) => x.id === sid);
  api.setSessionTime(sid, addDays(MON(1), 1), "18:00");
  const t = api.xwTargets(s, 2, 1);
  assert.deepEqual(t.days.map((d: any) => d.why), ["taken", "taken", "", "taken", "", "", "taken"]);
  assert.equal(api.moveSessionToWeek(s, 2, 1, 0), false, "a taken day was accepted");
  assert.deepEqual(stored(box), {}, "a refused move wrote something");
  assert.equal(api.moveSessionToWeek(s, 2, 1, 4), true);
  assert.deepEqual(stored(box)[sid], { to: 4, from: 1, wk: 1 });
  assert.deepEqual(where(box, sid), { wi: 2, day: 4 });
  assert.equal(api.sessionTimeAt(addDays(MON(2), 4), sid), "18:00", "the session's time of day stayed behind in its old week");
  assert.ok(box.toasts.includes("Moved to " + api.dayLabelIso(addDays(MON(2), 4)) + "."), "the toast does not say where it went");
  assert.match(decomment(fnBody("moveSessionToWeek")), /saveDayOverride\(\);[\s\S]*recompute\(\);[\s\S]*computeToday\(\); seedDone\(\); restoreTicks\(ticks\);[\s\S]*toastUndo\(/,
    "the commit is not store → recompute → computeToday → seedDone → restoreTicks → Undo");
  shapesAgree(box);
  // Undo puts back the store AND the time, and the plan with them.
  box.undo();
  assert.deepEqual(stored(box), {}, "Undo left the move in the store");
  assert.deepEqual(where(box, sid), { wi: 1, day: 1 });
  assert.equal(api.sessionTimeAt(addDays(MON(1), 1), sid), "18:00", "Undo lost the time of day");
  // Moved and then moved back: the session is HOME, with no override at all — never two moves that cancel.
  api.moveSessionToWeek(s, 2, 1, 4);
  const moved = box.RAW.weeks[2].sessions.find((x: any) => x.id === sid);
  const back = api.xwTargets(moved, 3, -1);
  assert.equal(back.ti, 1); assert.equal(back.home, 1);
  assert.equal(api.xwTargets(moved, 3, 1).block, "far", "a moved session was offered a second week further");
  api.moveSessionToWeek(moved, 3, -1, 1);
  assert.equal(stored(box)[sid], undefined, "coming home on its own day left an override behind");
  assert.deepEqual(where(box, sid), { wi: 1, day: 1 });
  // Home on another day is an ordinary same-week drag.
  api.moveSessionToWeek(s, 2, 1, 4);
  api.moveSessionToWeek(box.RAW.weeks[2].sessions.find((x: any) => x.id === sid), 3, -1, 4);
  assert.deepEqual(stored(box)[sid], { to: 4, from: 1 });
});

test("BLOCKER: a same-week drag of a moved session keeps where it came from — or the next launch snaps it back", () => {
  const box = sandbox();
  const sid = ID(1, 1, "threshold");
  box.api.moveSessionToWeek(box.RAW.weeks[1].sessions.find((x: any) => x.id === sid), 2, 1, 4);
  const moved = box.RAW.weeks[2].sessions.find((x: any) => x.id === sid);
  box.api.moveSession(3, moved, 5);   // Saturday of its new week (strength only — no run there)
  assert.deepEqual(box.state.dayOverride[sid], { to: 5, from: 1, wk: 1 }, "the drag dropped the week-move or rewrote where it came from");
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 2, day: 5 }, "the dragged moved session snapped back on the next launch");
  // A swap with a run native to that week moves the native one ordinarily and keeps the moved one's origin.
  const mon = box.RAW.weeks[2].sessions.find((x: any) => x.id === ID(2, 0, "easy"));
  box.api.moveSession(3, mon, 5);
  assert.deepEqual(box.state.dayOverride[sid], { to: 0, from: 1, wk: 1 });
  assert.deepEqual(box.state.dayOverride[ID(2, 0, "easy")], { to: 5, from: 0 });
  relaunch(box);
  assert.deepEqual(where(box, sid), { wi: 2, day: 0 });
  assert.deepEqual(where(box, ID(2, 0, "easy")), { wi: 2, day: 5 });
});

test("BLOCKER: Move to another week is offered only where it can work — a run, from today on, not the race, not done", () => {
  const box = sandbox();
  const { api } = box;
  const w = (wi: number, type: string) => box.RAW.weeks[wi].sessions.find((x: any) => x.type === type);
  assert.equal(api.xwOfferable(w(1, "threshold"), 2), true);
  assert.equal(api.xwOfferable(w(1, "strength"), 2), false, "strength was offered a week-move — it moves within its week");
  assert.equal(api.xwOfferable(w(4, "race"), 5), false, "the race was offered a week-move");
  // The row: both directions for a mid-plan run; race week's run says why, never offers a dead button.
  const row = api.xwRowHtml(w(1, "threshold"), 2);
  assert.match(row, /id="sdWeekBack"(?![^>]*disabled)/); assert.match(row, /id="sdWeekNext"(?![^>]*disabled)/);
  const raceWeekRun = api.xwRowHtml(w(4, "easy"), 5);
  assert.match(raceWeekRun, /id="sdWeekBack"[^>]*disabled/, "a race-week run was offered a move out of race week");
  assert.match(raceWeekRun, /Race week\u2019s sessions stay in race week\./);
  assert.match(api.xwRowHtml(w(3, "threshold"), 4), /id="sdWeekNext"[^>]*disabled[\s\S]*nothing moves into it/);
  // Week one has no week before it in the plan: the button is not drawn at all.
  assert.ok(!/sdWeekBack/.test(api.xwRowHtml(w(0, "threshold"), 1)), "a week earlier was drawn for the plan's first week");
  // An easier week the runner chose takes nothing in and gives nothing up.
  api.saveAdjust([{ id: "r", kind: "recovery", mode: "recovery", from: MON(2), to: addDays(MON(2), 6) }]);
  assert.equal(api.xwTargets(w(1, "threshold"), 2, 1).block, "eased");
  assert.match(api.xwRowHtml(w(1, "threshold"), 2), /You made week 3 easier, so nothing moves into it\./);
});

test("BLOCKER: the picker offers only days the rebuild will honour, says why the others are grey, and quotes the engine's distance", () => {
  const box = sandbox();
  const { api } = box;
  const s = box.RAW.weeks[1].sessions.find((x: any) => x.type === "threshold");
  // A break over a free day: moving a run into a day the runner is not running would toast "Moved" over nothing.
  api.saveAdjust([{ id: "h", kind: "holiday", mode: "none", from: addDays(MON(2), 4), to: addDays(MON(2), 4) }]);
  const t = api.xwTargets(s, 2, 1);
  assert.equal(t.days[4].why, "break", "a day in a booked break was offered");
  const html = api.xwPickerHtml(s, 2, 1);
  for (const d of t.days) {
    const re = new RegExp('data-xwday="' + d.d + '"([^>]*)>');
    assert.equal(/disabled/.test(re.exec(html)![1]!), !!d.why, "day " + d.d + " is drawn " + (d.why ? "live but refused" : "dead but allowed"));
  }
  assert.match(html, /Days that already have a run can\u2019t take a second one\./);
  assert.match(html, /because the break would take it straight back out/);
  const km = (m: number) => (Math.round(m / 100) / 10).toFixed(1);
  const vol = sessionVolumeMeters(s), a = weekVolumeMeters(box.RAW.weeks[1].sessions), b = weekVolumeMeters(box.RAW.weeks[2].sessions);
  assert.ok(html.includes("Week 2 goes from " + km(a) + " to " + km(a - vol) + " km, and week 3 from " + km(b) + " to " + km(b + vol) + " km."),
    "the picker's distance is not the engine's");
  // The picker's buttons do the move; Back returns to the session.
  const open = decomment(fnBody("openXwPicker"));
  assert.match(open, /moveSessionToWeek\(ctx\.sess, ctx\.week, dir, Number\(b\.dataset\.xwday\)\)/);
  assert.match(open, /\$\("xwBack"\)[\s\S]*reopenSessionSheet\(\)/);
  // A day that has gone is refused — the clock moved to Thursday of the week it would go to.
  const later = sandbox();
  later.clock.today = addDays(MON(2), 3);
  const lt = later.api.xwTargets(later.RAW.weeks[1].sessions.find((x: any) => x.type === "threshold"), 2, 1);
  assert.deepEqual(lt.days.map((d: any) => d.why), ["taken", "taken", "past", "taken", "", "", "taken"], "a day that had gone was offered");
  assert.match(later.api.xwPickerHtml(later.RAW.weeks[1].sessions.find((x: any) => x.type === "threshold"), 2, 1), /Days that have gone can\u2019t be picked\./);
  // And there is no week before the plan's first.
  assert.equal(box.api.xwTargets(box.RAW.weeks[0].sessions.find((x: any) => x.type === "threshold"), 1, -1).block, "edge");
});

test("the sheet carries the row between Move to another day and Time of day, and both buttons are wired", () => {
  const sheet = decomment(fnBody("sessionSheetHtml"));
  assert.match(sheet, /moveBlock \+\s*xwRowHtml\(sess, week\) \+\s*timeBlock/);
  const wire = decomment(fnBody("wireSheet"));
  assert.match(wire, /\$\("sdWeekBack"\)[^\n]*openXwPicker\(-1\)/, "A week earlier does nothing");
  assert.match(wire, /\$\("sdWeekNext"\)[^\n]*openXwPicker\(1\)/, "A week later does nothing");
});

test("BLOCKER: the weeks a move touched are marked, Today says where today's session went, and the declarations sit above the first rebuild", () => {
  const box = sandbox();
  const { api } = box;
  const sid = ID(1, 1, "threshold");
  api.moveSessionToWeek(box.RAW.weeks[1].sessions.find((x: any) => x.id === sid), 2, 1, 4);
  assert.equal(api.weekAdjust(box.PLAN.weeks[1]).tag, "Moved");
  assert.equal(api.weekAdjust(box.PLAN.weeks[2]).tag, "Moved");
  assert.equal(api.weekAdjust(box.PLAN.weeks[0]), null, "an untouched week was marked");
  assert.match(api.weekAdjustNote(box.PLAN.weeks[2]), /Moved in \u00b7 [A-Z][a-z]{2} \d+ [A-Z][a-z]{2}[\s\S]*was moved here from week 2\. Open it to move it back\./);
  assert.match(api.weekAdjustNote(box.PLAN.weeks[1]), /Moved out[\s\S]*is now on [A-Z][a-z]{2} \d+ [A-Z][a-z]{2}, in week 3\. Open it there to move it back\./);
  // Today, on a day a move emptied, names where it went (B2's rule: not "Recovery day").
  const mv = api.xwMovedFrom(addDays(MON(1), 1));
  assert.equal(mv && mv.iso, addDays(MON(2), 4));
  assert.match(decomment(fnBody("todayDecision")), /const mv = onToday \? xwMovedFrom\(todayIso\(\)\) : null;[\s\S]*headline: "Moved to " \+ dayLabelIso\(mv\.iso\)/);
  // ⚠️ THE TEMPORAL DEAD ZONE: both are read inside adoptPlan, which recompute() runs at module top level.
  const first = SRC.indexOf("try { recompute(); } catch (e)");
  assert.ok(first > 0);
  for (const name of ["PRIMARY_TYPES", "XWEEK"]) {
    const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
    assert.ok(at > 0 && at < first, name + " is declared below the first recompute(), so the rebuild reads it in its dead zone");
  }
});

test("BLOCKER: every restore of the day-overrides is written back before the rebuild that reads them", () => {
  // ⚠️ applyCrossWeekMoves reads the STORE, not state (it runs from the first recompute(), above state's
  // declaration). A restore held only in memory therefore rebuilds without the week-moves, and seedDone then
  // prunes them as unapplied — found in the pause's Undo, which restored state.dayOverride and rebuilt.
  const app = decomment(SRC);
  const sites = [...app.matchAll(/state\.dayOverride = /g)].map((m) => m.index!);
  assert.ok(sites.length >= 3, "the restore sites were not found — the sweep proves nothing");
  for (const at of sites) {
    const next = app.indexOf("recompute()", at);
    if (next < 0 || next - at > 700) continue;   // not followed by a rebuild
    assert.match(app.slice(at, next), /saveDayOverride\(\)/,
      "a restore of the overrides is not saved before the rebuild: " + JSON.stringify(app.slice(at, at + 90)));
  }
});
