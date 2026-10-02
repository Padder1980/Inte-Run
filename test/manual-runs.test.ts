import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BEST_DISTANCES, runBests, newBest, bestEligible } from "../src/progress/records.ts";
import { paceRatioMid } from "../src/science/paces.ts";

/**
 * STAGE B1 (2026-10-02) — a run added by hand, a run linked to the session it fulfilled, best times.
 *
 * ⚠️ DRIVEN AGAINST THE REAL FUNCTIONS, LIFTED OUT OF THE BUILT PAGE. Only the world outside them is
 * stood in — storage, the shoe rack, the grid, Strava — and those stand-ins RECORD rather than answer,
 * so a test can say which hooks a commit point called and in what order. A reimplementation here would
 * pass for ever while the shipped code rotted (test/warmup-delivery.test.ts is the precedent).
 *
 * What B1 found while mapping the code, and these tests hold:
 *   - state.done is never stored, so a run finished TODAY was unticked by the next launch;
 *   - the phone ticked a session only in PLAN.weeks[0] — week one of the plan — so from week two on,
 *     a finished phone run ticked nothing;
 *   - "Done for today" asked doneKey() about a RAW session, which has no .day, so it never once showed;
 *   - the phone's save path never posted to the grid, under a switch promising "every run";
 *   - a run with no pmodel stopped the flags engine's evidence walk dead.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function saveManualRun(");
  assert.ok(marker >= 0, "saveManualRun is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
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

/* ------------------------------------------------------------------------------------------------ *
 * The sandbox: the real functions, a fake localStorage, a small two-week plan around the real today. *
 * ------------------------------------------------------------------------------------------------ */

const FNS = [
  "isoAdd", "todayIso", "dmon", "fmtPace", "fmtTimeFull", "runDateLabelIso", "esc", "genDay", "effDay", "ovTo", "ovFrom",
  "doneKey", "rawSessionDone", "loadLinks", "saveLinks", "runLinkOf", "linkRunTo", "unlinkRun", "planSessionRef",
  "tickSession", "plannedSessionIso", "linkedRunFor", "untickSession", "addRunTypeLabel", "dayGap", "linkCandidatesFor",
  "linkCandidateLabel", "buildManualRun", "saveManualRun", "saveRuns", "loadHist", "saveHist", "runOriginOf", "syncHist",
  "histForget", "runBestRows", "runBestToast", "flagObservations", "runWorkPace", "impliedRecentFromRun", "plannedRpeBandOf",
  "deleteRun", "linkExistingRun", "unlinkExistingRun", "seedDone", "todayDecision", "runVerdict", "perfBestsHtml",
  "commBests", "clubPbText",
];
const CONSTS = ["DAY_ORDER", "MONTHS", "MON_SHORT", "PRIMARY_TYPES", "SESSION_LABEL", "ADD_RUN_TYPES", "LINK_KEY",
  "PACE_MODEL_VERSION", "UNDO_RUN", "COMM_BESTS", "PB_TYPED_KEY"];

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const TODAY = ISO(new Date());
const TODAY_DOW = (new Date(TODAY + "T00:00:00Z").getUTCDay() + 6) % 7;
const THIS_MON = addDays(TODAY, -TODAY_DOW);
const LAST_MON = addDays(THIS_MON, -7);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// ⚠️ THE REST DAY IS NEVER TODAY AND NEVER MONDAY, whichever day the suite runs on: the tests link a run
// to "today's session" and drag Monday's, and a fixed rest day made them depend on the calendar.
const REST = [1, 2, 3, 4, 5, 6].find((d) => d > TODAY_DOW) ?? [1, 2, 3, 4, 5, 6].find((d) => d !== TODAY_DOW)!;
const TYPES = ["easy", "threshold", "easy", "vo2", "easy", "easy", "long"].map((t, d) => (d === REST ? "rest" : t));

/** A two-week plan: last week and this one, one runnable session a day plus a rest day. */
function fixturePlan() {
  const types = TYPES;
  const titles = ["Easy 40 min with strides", "Tempo 3 x 10 min at threshold", "Easy 35 min", "Intervals 6 x 800 m",
    "Easy 45 min", "Easy 30 min", "Long run 95 min building to steady"].map((t, d) => (d === REST ? "Rest" : t));
  const mk = (wIdx: number) => types.map((t, d) => ({
    id: "w" + wIdx + "-d" + d + "-" + t, dayOfWeek: d, type: t, title: titles[d],
    estimatedDurationSeconds: 2400, targetRpe: t === "easy" || t === "long" ? { min: 3, max: 4 } : { min: 7, max: 8 },
    steps: [{ kind: "steady", durationSeconds: 2400, targetPaceSecPerKm: { minSecPerKm: 330, maxSecPerKm: 360 }, targetRpe: { min: 3, max: 4 } }],
  }));
  const raw = [mk(1), mk(2)];
  const RAW = { weeks: raw.map((sessions) => ({ sessions })) };
  const PLAN = { weeks: [LAST_MON, THIS_MON].map((startIso, wi) => ({
    index: wi + 1, startIso,
    sessions: raw[wi]!.map((s) => ({ id: s.id, day: DAYS[s.dayOfWeek], dayIndex: s.dayOfWeek, type: s.type, title: s.title })),
  })) };
  return { RAW, PLAN };
}

type Box = { api: any; state: any; store: Record<string, string>; calls: string[]; PLAN: any; RAW: any; profile: any; toasts: string[] };
function sandbox(over: Record<string, unknown> = {}): Box {
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const { RAW, PLAN } = fixturePlan();
  const state: any = { logged: [], hist: [], done: {}, dayOverride: {}, heatAdapt: {}, selDay: TODAY_DOW, selWeek: 1, wx: null, trainFlag: null };
  const profile: any = { recentTimeS: 1500, autoPace: false, noRecent: false };
  const calls: string[] = [];
  const toasts: string[] = [];
  const rec = (name: string) => (...a: any[]) => { calls.push(name); return undefined; };
  const never = (name: string) => () => { throw new Error(name + " must never be called here"); };
  const RC = { runBests, newBest, BEST_DISTANCES, bestEligible, paceRatioMid };
  const env: Record<string, unknown> = {
    state, PLAN, RAW, profile, localStorage, RC,
    EXTRA: [], TODAY_IN_PLAN: true, TODAY_DOW,
    toast: (m: string) => { toasts.push(m); },
    toastUndo: (m: string, fn: () => void) => { toasts.push(m); (env as any).__undo = fn; },
    render: rec("render"), renderUnlessTyping: rec("renderUnlessTyping"), clearTrainFlag: rec("clearTrainFlag"),
    // The shoe rack stamps the id as the real one does, so the test can see it reached the stored copy.
    shoeCreditRun: (run: any) => { calls.push("shoeCreditRun"); run.shoeId = "sh1"; },
    shoeUncreditRun: rec("shoeUncreditRun"), shoeRecreditRun: rec("shoeRecreditRun"),
    clubMaybeAutoPost: (run: any) => { calls.push("clubMaybeAutoPost:" + (run && run.id)); },
    stravaCanSendAdded: () => false, stravaSendRun: rec("stravaSendRun"),
    maybeTrainingFlags: rec("maybeTrainingFlags"),
    healthSendRun: never("healthSendRun"), maybeAutoPaceCalibrate: never("maybeAutoPaceCalibrate"),
    assessFitnessFromRun: never("assessFitnessFromRun"), stravaMaybeAutoSend: never("stravaMaybeAutoSend"),
    sessionStepText: (s: any) => [{ tag: "RUN", lab: s.title, tgt: "", rec: "" }],
    saveDayOverride: () => {}, saveHeatAdapt: () => {}, loadSwaps: () => ({}), saveSwaps: () => {}, loadSdone: () => [],
    selectedSession: () => RAW.weeks[state.selWeek]!.sessions.filter((s: any) => s.type !== "rest" && s.dayOfWeek === state.selDay)[0] || null,
    curWeek: () => PLAN.weeks[state.selWeek], isCurrentWeek: () => state.selWeek === 1,
    todayNextUp: () => null, currentConditions: () => null,
    loadClubProf: () => ({ pbs: {} }),
    paceStampFor: () => ({ pband: { minSecPerKm: 330, maxSecPerKm: 360 }, pwin: { s: 0, e: 8000 }, pmix: null }),
    rdWell: () => [],
    ...over,
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  const make = new Function(...names, src + "\nreturn {" + FNS.join(",") + "};");
  const api = make(...names.map((n) => env[n]));
  (api as any).undo = () => (env as any).__undo && (env as any).__undo();
  return { api, state, store, calls, PLAN, RAW, profile, toasts };
}
const form = (o: Record<string, unknown> = {}) => ({ iso: TODAY, start: "", km: "5.02", h: 0, m: 27, s: 30, type: "easy", tread: false, link: "", strava: false, back: false, ...o });
const todaysRunId = () => "w2-d" + TODAY_DOW + "-" + TYPES[TODAY_DOW];

/* ------------------------------------------------------------------------------------------------ *
 * 1. The record                                                                                      *
 * ------------------------------------------------------------------------------------------------ */

test("a run added by hand is a subset of a recorded run, and nothing on it is invented", () => {
  const { api } = sandbox();
  const r = api.buildManualRun(form());
  assert.ok(!r.error, r.error);
  const run = r.run;
  assert.equal(run.manual, true);
  assert.match(run.id, /^man-\d{13}$/, "the id must be man-<ms>: a run- id is read back as the instant the run began");
  for (const k of ["route", "splits", "elevGain", "avgHr", "maxHr", "cadence", "hrSeries", "zoneSec", "pband", "pwin", "pmix"])
    assert.equal(run[k], null, k + " was invented on a run nobody recorded");
  assert.equal(run.startMs, null, "a start time was invented when the runner gave none");
  assert.equal(run.distKm, 5.02);
  assert.equal(run.sec, 27 * 60 + 30);
  assert.equal(run.avgPaceSec, Math.round(1650 / 5.02));
  assert.equal(run.time, "27:30");
  assert.equal(run.dist, "5.02 km");
  assert.equal(run.dateIso, TODAY);
  // ⚠️ anchor and pmodel ARE set, as the wrist does: a run without pmodel stops the flags engine's walk.
  assert.equal(run.anchor, 1500);
  assert.equal(run.pmodel, 2);
  assert.equal(run.indoor, undefined, "an outdoor run was marked indoor");
  assert.equal(api.runOriginOf(run), "manual");
  assert.equal(r.link, null);
});

test("a start time the runner gave becomes the run's start, in their own local time", () => {
  const { api } = sandbox();
  const r = api.buildManualRun(form({ iso: addDays(TODAY, -1), start: "07:30" }));
  assert.ok(!r.error, r.error);
  const p = addDays(TODAY, -1).split("-").map(Number);
  assert.equal(r.run.startMs, new Date(p[0]!, p[1]! - 1, p[2]!, 7, 30, 0, 0).getTime());
  assert.match(r.run.d, /\u00b7 07:30$/, "the caption does not carry the time the runner gave");
});

test("a treadmill run says so, and its distance is never a measurement", () => {
  const { api } = sandbox();
  const run = api.buildManualRun(form({ tread: true })).run;
  assert.equal(run.indoor, true);
  assert.equal(run.t, "Treadmill run");
  assert.equal(api.runOriginOf(run), "manual", "how it reached the app is the stronger statement");
});

test("every bad answer is refused with one plain sentence, and a comma decimal is understood", () => {
  const { api } = sandbox();
  const err = (o: Record<string, unknown>) => api.buildManualRun(form(o)).error;
  assert.match(err({ iso: "" }), /date/);
  assert.match(err({ iso: addDays(TODAY, 1) }), /not happened yet/);
  assert.match(err({ km: "" }), /how far/);
  assert.match(err({ km: "abc" }), /how far/);
  assert.match(err({ km: "400" }), /further than one run/);
  assert.match(err({ h: 0, m: 0, s: 0 }), /how long/);
  assert.match(err({ km: "10", m: 12, s: 0 }), /can.t be right/, "1:12 a kilometre was accepted");
  assert.match(err({ strava: true }), /Strava needs the time you started/);
  assert.equal(err({ km: "8,05" }), undefined, "a comma decimal was refused");
  assert.equal(api.buildManualRun(form({ km: "8,05" })).run.distKm, 8.05);
});

test("a run linked to a session carries what that session asked for — but never its pace band", () => {
  const { api, RAW } = sandbox();
  const sid = todaysRunId();
  const r = api.buildManualRun(form({ link: sid }));
  assert.ok(!r.error, r.error);
  const raw = RAW.weeks[1].sessions.find((s: any) => s.id === sid);
  assert.equal(r.run.t, raw.title, "the run is not called by the session it fulfilled");
  assert.equal(r.run.type, raw.type, "the run's type is not the session's");
  assert.ok(Array.isArray(r.run.steps) && r.run.steps.length, "the prescription was not kept, so the debrief calls it a free run");
  assert.deepEqual(r.run.rband, raw.targetRpe, "the effort band is not the session's");
  assert.equal(r.run.pband, null, "a typed time for the whole outing was given a pace band to be judged against");
  assert.deepEqual(r.link, { sid, wk: 2, iso: TODAY });
});

/* ------------------------------------------------------------------------------------------------ *
 * 2. The commit point                                                                                *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the third commit point stores through saveRuns, credits the shoe first, and calls only its own hooks", () => {
  const { api, state, store, calls } = sandbox();
  const r = api.buildManualRun(form());
  api.saveManualRun(r.run, r.link, false);
  // Through saveRuns: the run store AND the uncapped history, which only syncHist writes.
  const runs = JSON.parse(store["interun_runs"] || "[]");
  assert.equal(runs.length, 1, "the run did not reach interun_runs");
  assert.equal(runs[0].shoeId, "sh1", "the shoe was credited after the record was stored, so the stored copy lacks its shoe");
  const hist = JSON.parse(store["interun_hist_v1"] || "[]");
  assert.equal(hist.length, 1, "the run did not reach the permanent history");
  assert.equal(hist[0].x, "manual", "the history row does not say the run was added by hand");
  assert.ok(!("e" in hist[0]), "a climb of 0 m was written for a run nobody measured");
  assert.equal(calls[0], "shoeCreditRun");
  assert.ok(calls.includes("clubMaybeAutoPost:" + r.run.id), "the grid hook was not called");
  assert.ok(calls.includes("maybeTrainingFlags"), "the flags engine was not asked again");
  assert.ok(!calls.includes("stravaSendRun"), "a run went to Strava without its switch on");
  assert.equal(state.logged[0].id, r.run.id);
});

test("BLOCKER: Strava only when the runner switched it on for this run, and only through the handshake", () => {
  const off = sandbox();
  const r1 = off.api.buildManualRun(form({ start: "06:00", iso: addDays(TODAY, -1) }));
  off.api.saveManualRun(r1.run, null, true);
  assert.ok(!off.calls.includes("stravaSendRun"), "sent while the server has not said it labels a hand-added run truthfully");
  const on = sandbox({ stravaCanSendAdded: () => true });
  const r2 = on.api.buildManualRun(form({ start: "06:00", iso: addDays(TODAY, -1) }));
  on.api.saveManualRun(r2.run, null, false);
  assert.ok(!on.calls.includes("stravaSendRun"), "sent with the switch off");
  const r3 = on.api.buildManualRun(form({ start: "06:00", iso: addDays(TODAY, -1) }));
  on.api.saveManualRun(r3.run, null, true);
  assert.ok(on.calls.includes("stravaSendRun"), "not sent with the switch on and the server ready");
  // And by name, in the source: none of the three that would treat a typed number as a measurement.
  const body = decomment(fnBody("saveManualRun"));
  for (const f of ["healthSendRun", "maybeAutoPaceCalibrate", "assessFitnessFromRun", "stravaMaybeAutoSend"])
    assert.ok(!body.includes(f + "("), "saveManualRun calls " + f);
});

test("BLOCKER: a run added by hand goes in date order, not on top", () => {
  const { api, state } = sandbox();
  state.logged = [
    { id: "run-a", dateIso: TODAY, distKm: 8, sec: 2800, type: "easy" },
    { id: "run-b", dateIso: addDays(TODAY, -3), distKm: 6, sec: 2100, type: "easy" },
  ];
  const back = api.buildManualRun(form({ iso: addDays(TODAY, -2) })).run;
  api.saveManualRun(back, null, false);
  assert.deepEqual(state.logged.map((r: any) => r.id), ["run-a", back.id, "run-b"],
    "a run from two days ago became the latest run");
  const same = api.buildManualRun(form({ iso: TODAY })).run;
  api.saveManualRun(same, null, false);
  assert.equal(state.logged[0].id, same.id, "a run added for today did not go first");
});

test("BLOCKER: the only write of the run store is saveRuns — no fourth path can skip the history", () => {
  // ⚠️ THE SPEC'S OWN RE-BREAK: bypass saveRuns with a direct setItem and this must fail.
  const code = decomment(SRC);
  const writes = code.match(/setItem\("interun_runs"/g) || [];
  assert.equal(writes.length, 1, "interun_runs is written from " + writes.length + " places");
  assert.match(fnBody("saveRuns"), /setItem\("interun_runs"/, "the one write is not saveRuns'");
  assert.match(decomment(fnBody("saveManualRun")), /saveRuns\(\)/, "saveManualRun does not go through saveRuns");
});

/* ------------------------------------------------------------------------------------------------ *
 * 3. Links, ticks and the relaunch                                                                   *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a linked session stays ticked after a rebuild or a relaunch — seedDone replays the link", () => {
  const { api, state, PLAN } = sandbox();
  const sid = todaysRunId();
  const r = api.buildManualRun(form({ link: sid }));
  api.saveManualRun(r.run, r.link, false);
  const s = PLAN.weeks[1].sessions.find((x: any) => x.id === sid);
  const key = api.doneKey(2, s);
  assert.equal(state.done[key], true, "saving did not tick the session");
  // A relaunch, or any plan change: seedDone rebuilds state.done from nothing.
  api.seedDone();
  assert.equal(state.done[key], true, "the tick did not survive seedDone, so the next launch unticks a run done today");
  // And without the link, today's session is NOT ticked by seedDone (it only ticks earlier days).
  const bare = sandbox();
  bare.api.seedDone();
  assert.ok(!bare.state.done[key], "seedDone ticked today's session with no run behind it");
});

test("a link survives the session being dragged to another day of the same week", () => {
  const { api, state, PLAN } = sandbox();
  const sid = PLAN.weeks[1].sessions[0].id; // Monday's
  api.linkRunTo("man-1", { sid, wk: 2, iso: THIS_MON });
  // Moved onto the fixture's rest day, so seedDone's no-two-runs-a-day rule keeps the move.
  state.dayOverride[sid] = { to: REST, from: 0 };
  api.seedDone();
  assert.equal(state.done[api.doneKey(2, PLAN.weeks[1].sessions[0])], true, "the link was lost when the session moved");
});

test("BLOCKER: the phone ticks the session in ITS week — PLAN.weeks[0] was week one of the plan", () => {
  const save = decomment(fnBody("saveLiveSession"));
  assert.ok(!/PLAN\.weeks\[0\]/.test(save), "saveLiveSession still only searches the first week of the plan");
  assert.match(save, /plannedSessionIso\(LIVE\.session\)/, "the phone does not find the session's own date");
  assert.match(save, /tickSession\(iso, LIVE\.session\.id\)/, "the phone does not tick by session id");
  assert.match(save, /linkRunTo\(sm\.runId,/, "the phone's tick is not kept for the next launch");
  // Driven: a session in the plan's SECOND week resolves to its own date and ticks.
  const { api, state, PLAN, RAW } = sandbox();
  const sess = RAW.weeks[1].sessions[1];
  assert.equal(api.plannedSessionIso(sess), addDays(THIS_MON, 1));
  api.tickSession(api.plannedSessionIso(sess), sess.id);
  assert.equal(state.done[api.doneKey(2, PLAN.weeks[1].sessions[1])], true);
  // And the wrist keeps its tick the same way.
  assert.match(decomment(fnBody("ingestWatchRun")), /linkRunTo\(run\.id, \{ sid: planned\.id, wk: wk\.index, iso: iso \}\)/,
    "a wrist run's tick is not kept for the next launch");
});

test("BLOCKER: 'Done for today' can show at last — on the real today, and never on a past day", () => {
  const { api, state, PLAN, RAW } = sandbox();
  const raw = RAW.weeks[1].sessions[TODAY_DOW];
  if (raw.type === "rest") return; // the fixture's one rest day: nothing to be done
  const twin = PLAN.weeks[1].sessions[TODAY_DOW];
  state.selWeek = 1; state.selDay = TODAY_DOW;
  assert.notEqual(api.todayDecision().kind, "completed", "done before anything was run");
  // The old key, built from the RAW session, is exactly what could never match:
  assert.equal(api.doneKey(2, raw), "2|undefined|" + raw.title);
  state.done[api.doneKey(2, twin)] = true;
  assert.equal(api.todayDecision().kind, "completed", "a ticked session today still offers itself");
  assert.equal(api.todayDecision().headline, "Done for today");
  // A past day is ticked by seedDone whether or not it was run, so it must never read as logged.
  if (TODAY_DOW > 0) {
    state.selDay = TODAY_DOW - 1;
    const prevTwin = PLAN.weeks[1].sessions[TODAY_DOW - 1];
    state.done[api.doneKey(2, prevTwin)] = true;
    assert.notEqual(api.todayDecision().kind, "completed", "a past day says 'Done for today'");
  }
});

test("deleting a linked run unticks today's session and forgets the link; Undo brings both back", () => {
  const { api, state, PLAN, store } = sandbox();
  const sid = todaysRunId();
  const r = api.buildManualRun(form({ link: sid }));
  api.saveManualRun(r.run, r.link, false);
  const key = api.doneKey(2, PLAN.weeks[1].sessions.find((x: any) => x.id === sid));
  api.deleteRun(0);
  assert.ok(!state.done[key], "the session stayed ticked with the run behind it deleted");
  assert.equal(api.runLinkOf(r.run.id), null, "the link outlived its run");
  api.undo();
  assert.equal(state.done[key], true, "Undo did not re-tick the session");
  assert.ok(api.runLinkOf(r.run.id), "Undo did not restore the link");
  assert.ok(JSON.parse(store["interun_link_v1"] || "{}")[r.run.id], "the restored link is not in the store");
});

test("a session another run already fulfils is not offered again, and the candidates are nearest first", () => {
  const { api } = sandbox();
  const day = TODAY;
  const all = api.linkCandidatesFor(day, null);
  assert.ok(all.length >= 5, "the runnable sessions of the week were not offered");
  const gaps = all.map((c: any) => Math.abs(api.dayGap(c.iso, day)));
  assert.deepEqual(gaps, [...gaps].sort((a, b) => a - b), "the sessions are not nearest first: " + gaps.join(","));
  assert.ok(all.every((c: any) => c.type !== "rest"), "a rest day was offered as a session");
  api.linkRunTo("run-other", { sid: all[0].sid, wk: 2, iso: all[0].iso });
  assert.ok(!api.linkCandidatesFor(day, null).some((c: any) => c.sid === all[0].sid), "a fulfilled session was offered again");
  assert.ok(api.linkCandidatesFor(day, "run-other").some((c: any) => c.sid === all[0].sid), "a run's own session was hidden from it");
  assert.deepEqual(api.linkCandidatesFor(addDays(LAST_MON, -30), null), [], "a date outside the plan offered sessions");
});

test("linking a recorded free run after the fact stamps it like a planned run, and unlinking puts it back exactly", () => {
  const { api, state, PLAN } = sandbox();
  const free = { id: "run-free", dateIso: TODAY, distKm: 8, sec: 2800, type: "easy", steps: null, rband: null, pband: null, pwin: null, pmix: null };
  state.logged = [free];
  const target = api.linkCandidatesFor(TODAY, "run-free").find((c: any) => c.type !== "easy") || api.linkCandidatesFor(TODAY, "run-free")[0];
  api.linkExistingRun(free, target.sid);
  assert.equal(free.type, target.type);
  assert.ok(free.steps, "the prescription was not stamped");
  assert.ok(free.pband, "a recorded run with kilometres was not given the session's pace band");
  assert.ok(api.runLinkOf("run-free").was, "what the stamps replaced was not kept");
  const s = PLAN.weeks[1].sessions.find((x: any) => x.id === target.sid);
  assert.equal(state.done[api.doneKey(2, s)], true);
  api.unlinkExistingRun(free);
  assert.equal(free.type, "easy"); assert.equal(free.steps, null); assert.equal(free.pband, null); assert.equal(free.rband, null);
  assert.equal(api.runLinkOf("run-free"), null);
  // A hand-added run linked afterwards gets the prescription and the effort band — never a pace band.
  const hand = api.buildManualRun(form()).run;
  state.logged = [hand];
  api.linkExistingRun(hand, api.linkCandidatesFor(TODAY, hand.id)[0].sid);
  assert.equal(hand.pband, null, "a hand-added run was given a pace band to be judged against");
  assert.ok(hand.steps && hand.rband);
});

/* ------------------------------------------------------------------------------------------------ *
 * 4. Never a pace judgement                                                                          *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the flags engine skips an unlinked hand-added run — it no longer stops the walk", () => {
  const { api, state } = sandbox();
  const real = (id: string) => ({ id, type: "easy", distKm: 8, avgPaceSec: 340, sec: 2720, rpe: 4, rband: { min: 3, max: 4 },
    pband: { minSecPerKm: 330, maxSecPerKm: 360 }, anchor: 1500, pmodel: 2, dateIso: TODAY });
  const hand = api.buildManualRun(form()).run;
  delete hand.pmodel; // the exact shape that used to break the walk: and it must now be skipped before it is read
  state.logged = [hand, real("r1"), real("r2")];
  const obs = api.flagObservations();
  assert.deepEqual(obs.map((o: any) => o.id), ["r1", "r2"], "the real runs behind a hand-added one were cut off, or it was counted");
});

test("BLOCKER: a linked hand-added run is effort evidence only — its typed pace is never read", () => {
  const { api, state } = sandbox();
  const r = api.buildManualRun(form({ link: todaysRunId() }));
  api.saveManualRun(r.run, r.link, false);
  state.logged[0].rpe = 8;
  const o = api.flagObservations()[0];
  assert.equal(o.id, r.run.id, "the linked run is not evidence at all");
  assert.equal(o.avgPaceSecPerKm, null, "the typed pace was handed to the flags engine");
  assert.equal(o.plannedPaceSecPerKm, null);
  assert.equal(o.implied5kSeconds, null, "a 5 km time was implied from a typed pace");
  assert.equal(o.reportedRpe, 8);
  assert.ok(o.plannedRpe, "the effort the session asked for is missing, so the effort comparison cannot happen");
});

test("BLOCKER: the debrief names a hand-added run for what it is, and judges no pace", () => {
  const { api } = sandbox();
  const run = api.buildManualRun(form()).run;
  const v = api.runVerdict(run, { n: 0, judgedN: 0, inBand: 0, confidence: "low", band: null, rband: null, rpe: null });
  assert.equal(v.headline, "Added by hand");
  assert.equal(v.state, "insufficientData");
  assert.ok(!v.chips.some((c: any) => /range/i.test(c.k)), "a pace chip on a run nobody measured");
  // Discomfort still outranks it — the safety rule is first, always.
  const hurt = api.runVerdict({ ...run, pain: true }, { n: 0, judgedN: 0, inBand: 0, confidence: "low" });
  assert.equal(hurt.state, "caution", "a hand-added run with pain lost the discomfort branch");
});

test("the pace readers that compare runs leave hand-added runs out", () => {
  // progressSnapshot (a pace-at-the-same-effort claim), the weekly review and the run-page trend.
  assert.match(decomment(fnBody("progressSnapshot")), /!r\.manual/, "the progress snapshot reads a typed pace");
  assert.match(decomment(fnBody("currentWeeklyReview")), /avgPaceSecPerKm: r\.manual \? null/, "the weekly review reads a typed pace");
  const trends = decomment(fnBody("rdTrendsHtml"));
  assert.match(trends, /if \(run\.manual\)/, "a hand-added run's page compares its pace");
  assert.match(trends, /!r\.manual/, "measured runs are compared against hand-added ones");
});

/* ------------------------------------------------------------------------------------------------ *
 * 5. Best times                                                                                      *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a hand-added run never sets a best, and the club chips and Performance agree", () => {
  const { api, state } = sandbox();
  state.logged = [{ id: "run-5k", dateIso: addDays(TODAY, -5), distKm: 5.01, sec: 1500, type: "easy", route: [1, 2] }];
  api.saveRuns();
  const quick = api.buildManualRun(form({ km: "5", m: 18, s: 0 })).run;
  api.saveManualRun(quick, null, false);
  const bests = runBests(api.runBestRows());
  assert.equal(bests[0]!.runId, "run-5k", "an 18:00 typed 5 km took the best");
  const club = api.commBests();
  assert.deepEqual(club, [{ label: "5 km", time: "25:00" }], "the club chip disagrees with the engine");
  const card = api.perfBestsHtml();
  assert.match(card, /25:00/, "Performance does not show the measured best");
  assert.ok(!/18:00/.test(card), "Performance shows the typed time as a best");
  assert.match(card, /data-pbrun="run-5k"/, "the best does not open its run");
  assert.match(card, />Best</, "the measured time is not labelled Best");
  assert.match(card, /do not count, because their distance was not measured/, "the card does not say why a hand-added run is missing");
});

test("the Performance card names a typed race PB as a PB, and shows a measured best beside it", () => {
  const { api, state } = sandbox({ loadClubProf: () => ({ pbs: { k10: "48:10", k5: "21:04" } }) });
  state.logged = [{ id: "run-5k", dateIso: addDays(TODAY, -5), distKm: 5.01, sec: 1500, type: "easy" }];
  api.saveRuns();
  const card = api.perfBestsHtml();
  assert.match(card, /10 km[\s\S]*A race time you entered[\s\S]*>PB<[\s\S]*48:10/, "a typed 10 km PB is not shown as a PB");
  assert.match(card, /race PB 21:04/, "the typed 5 km PB is hidden behind the measured best");
  const empty = sandbox().api.perfBestsHtml();
  assert.match(empty, /appears here/, "no empty state");
});

test("a new best is announced once at a save point, never for a first and never for a typed run", () => {
  const { api, state, toasts } = sandbox();
  state.logged = [{ id: "run-old", dateIso: addDays(TODAY, -9), distKm: 5.0, sec: 1560, type: "easy" }];
  api.saveRuns();
  const fresh = { id: "run-new", dateIso: TODAY, distKm: 5.02, sec: 1500, type: "easy" };
  state.logged.unshift(fresh); api.saveRuns();
  api.runBestToast(fresh);
  assert.equal(toasts.length, 1, "a genuine new best was not announced");
  assert.match(toasts[0]!, /^New best: 5 km in 25:00, 1:00 quicker than your last\.$/);
  const hand = api.buildManualRun(form({ km: "5", m: 20, s: 0 })).run;
  api.saveManualRun(hand, null, false);
  api.runBestToast(hand);
  assert.equal(toasts.length, 1, "a typed run was announced as a best");
  // The two recorded save points call it; the manual one must not.
  assert.match(decomment(fnBody("saveLiveSession")), /runBestToast\(state\.logged\[0\]\)/);
  assert.match(decomment(fnBody("ingestWatchRun")), /runBestToast\(state\.logged\[0\]\)/);
  assert.ok(!/runBestToast\(/.test(decomment(fnBody("syncHist"))), "the history back-fill announces bests");
});

test("the history row says why a distance is not a measurement — for every kind of run that has one", () => {
  const { api, state } = sandbox();
  state.logged = [
    { id: "a", dateIso: TODAY, distKm: 5, sec: 1500, type: "easy" },
    { id: "b", dateIso: TODAY, distKm: 5, sec: 1500, type: "easy", indoor: true },
    { id: "c", dateIso: TODAY, distKm: 5, sec: 1500, type: "easy", sim: true },
    { id: "d", dateIso: TODAY, distKm: 5, sec: 1500, type: "easy", nogps: true },
    { id: "e", dateIso: TODAY, distKm: 5, sec: 1500, type: "easy", manual: true },
  ];
  api.syncHist();
  const x = Object.fromEntries(state.hist.map((r: any) => [r.i, r.x]));
  assert.deepEqual(x, { a: undefined, b: "indoor", c: "sim", d: "nogps", e: "manual" });
  // And a row is refreshed when its run gains a flag later (a GPS-less run's distance typed in after).
  state.logged[0].indoor = true; api.syncHist();
  assert.equal(state.hist.find((r: any) => r.i === "a").x, "indoor", "the row did not follow its run");
  // The phone records a refused GPS as nogps, and never as indoor.
  const rec = decomment(fnBody("liveRunRecord"));
  assert.match(rec, /nogps: \(LIVE\.indoor && LIVE\.gpsDenied\) \|\| undefined/);
});

test("BLOCKER: a run with no route shows what it is — the panel was drawn at opacity 0 and never revealed", () => {
  // ⚠️ FOUND IN THE BROWSER, NOT IN A TEST. .rd-mapin starts at opacity 0 and only the map path in wire()
  // adds ov-ready, so on every run without a route — a treadmill, a hidden map, a run added by hand — the
  // hero was a blank grey box with its words in the DOM. Driven against the real rdHeroHtml and the real
  // runRoutePresentation, under both privacy settings that matter.
  const hero = (run: any, privacy: any) => new Function("ICON", "PRIVACY", "redactRouteEnds", "PRIV_RADIUS_M",
    fnBody("runRoutePresentation") + "\n" + fnBody("rdHeroHtml") + "\nreturn rdHeroHtml;")(
    { timer: "" }, privacy, () => null, 200)(run);
  const shown = (h: string) => /class="rd-mapin ov-ready"/.test(h);
  const open = { map: false, ends: false };
  assert.ok(shown(hero({ manual: true }, open)), "a run added by hand shows a blank hero");
  assert.match(hero({ manual: true }, open), /Added by hand/);
  assert.match(hero({ manual: true, indoor: true }, open), /Treadmill run, added by hand/);
  assert.ok(shown(hero({ indoor: true }, open)), "a treadmill run shows a blank hero");
  assert.ok(shown(hero({}, open)), "a run with no route shows a blank hero");
  const route = [{ lat: 51.5, lng: -0.1, t: 0 }, { lat: 51.51, lng: -0.1, t: 60 }];
  assert.ok(shown(hero({ route }, { map: true, ends: false })), "a hidden map shows a blank hero");
  // ⚠️ AND A ROUTE STILL WAITS FOR ITS MAP: revealing it early would put the jump back that the fade exists to hide.
  assert.ok(!shown(hero({ route }, open)), "a run with a route is revealed before its map is framed");
});

/* ------------------------------------------------------------------------------------------------ *
 * 6. Reachability — every new control is wired                                                       *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: every new control does something — the looks-live-does-nothing class", () => {
  const code = decomment(SRC);
  // ⚠️ A LOOKUP IS NOT A HANDLER. Each id must be fetched AND given an event handler right there — a
  // `const x = $("id")` with the assignment deleted would pass a lookup-only check, which is the
  // looks-live-does-nothing class with a test standing guard over it.
  for (const id of ["lgAdd", "sdElsewhere", "arSave", "arCancel", "arStrava", "arDate", "arLink", "arKm", "arStart", "arWhere", "arType", "rdLink", "rdUnlink"]) {
    assert.ok(code.includes('id="' + id + '"'), "#" + id + " is never rendered");
    const at = code.search(new RegExp('\\$\\("' + id + '"\\)'));
    assert.ok(at >= 0, "#" + id + " is rendered and never looked up");
    assert.match(code.slice(at, at + 260), /\.(onclick|onchange|oninput) =/, "#" + id + " is looked up and given no handler");
  }
  for (const p of ["h", "m", "s"]) assert.match(decomment(fnBody("wireAddRun")), /\$\("arT" \+ p\)[\s\S]{0,40}\.onchange =/, "the time wheels write nothing");
  assert.match(code, /querySelectorAll\("\[data-pbrun\]"\)\.forEach/, "a best time's row opens nothing");
  assert.match(code, /querySelectorAll\("\[data-linkto\]"\)\.forEach/, "a session in the link picker does nothing");
  // The session sheet's button is wired in wireSheet, which openSessionSheet calls — not in wire().
  assert.match(decomment(fnBody("wireSheet")), /\$\("sdElsewhere"\)/, "I did this run elsewhere is wired outside the sheet's own wiring");
  // ⚠️ AND BOTH STATES OF THE LOGBOOK OFFER IT — the empty state returns early.
  const acts = decomment(fnBody("viewActivities"));
  assert.ok((acts.match(/\+ addRun/g) || []).length >= 2, "the Logbook's empty state has no way to add a run");
  // Start stays the last thing in the session sheet (the design rule test/design-system.test.ts holds);
  // B2's Skip sits between this stage's button and it.
  assert.match(decomment(fnBody("sessionSheetHtml")), /addLink \+\s*elsewhere \+\s*skipBtn \+\s*startBtn;/);
});

test("a run added by hand only offers Strava through the handshake, and says where it was run", () => {
  const code = decomment(SRC);
  assert.match(decomment(fnBody("stravaSendRun")), /if \(run\.manual && !stravaCanSendAdded\(run\)\) return;/,
    "the floor under every Strava button lets a hand-added run through");
  assert.match(decomment(fnBody("stravaRunButtonHtml")), /run\.manual && !run\.strava && !stravaCanSendAdded\(run\)/);
  assert.match(decomment(fnBody("stravaCanAddedRuns")), /c\.origins\.indexOf\("added"\) !== -1/);
  assert.match(decomment(fnBody("stravaRefresh")), /c\.origins = \(r\.json && Array\.isArray\(r\.json\.origins\)\)/,
    "the app never learns what the server can label");
  const pay = decomment(fnBody("runStravaPayload"));
  assert.match(pay, /trainer: !!run\.indoor, origin: "added"/, "a hand-added outdoor run is filed as indoor, or unlabelled");
  assert.ok(code.includes('renderAddRunSheet') && /const stv = stravaCanAddedRuns\(\);/.test(decomment(fnBody("renderAddRunSheet"))),
    "the form shows a Strava switch the server cannot honour");
});
