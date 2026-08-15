import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE PERMANENT RUN HISTORY (interun_hist_v1), added 2026-08-15.
 *
 * saveRuns() has always kept only 50 runs, because a run carries its GPS route and heart-rate
 * series. That cap was correct for the ROUTE and quietly wrong for everything else: at four runs a
 * week it reaches back about twelve weeks, so a year of progress could not be drawn, a streak
 * calendar scrolled past three months would have shown REST DAYS THE RUNNER NEVER TOOK, and
 * logStreakWeeks -- counted from the capped store -- got SHORTER THE MORE CONSISTENTLY SOMEBODY RAN.
 *
 * ⚠️ Measured against the pre-fix build: a genuine 40-week streak displayed as ELEVEN WEEKS. The one
 * number in the app whose whole job is to reward consistency was reduced by it. Nothing threw.
 *
 * These tests EXECUTE the real functions lifted out of the built page rather than reading their
 * source, because every fault above was a live-behaviour fault that source-matching would have
 * missed. Each was watched failing against the pre-fix build before being believed.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** The source of one top-level function, verbatim (comments kept — this is fed to the evaluator). */
function fnOf(html: string, name: string): string {
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  // Search from at+1 so the function's own header cannot match, then measure back to `at`.
  const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
  const src = html.slice(at, rel > 0 ? at + 1 + rel : at + 8000);
  assert.ok(/^function [A-Za-z_$][\w$]*\(/.test(src), "fnOf sliced " + name + " wrongly: " + src.slice(0, 40));
  return src;
}

/**
 * The real functions, running against a fake localStorage.
 * ⚠️ Lifted from web/app.html, NOT reimplemented here. A reimplementation would pass forever while
 * the shipped code rotted — the precedent is test/warmup-delivery.test.ts, which found four defects
 * the moment it started exercising the real thing.
 */
function sandbox() {
  const html = page();
  const names = ["isoAdd", "todayIso", "logWeekStartIso", "loadHist", "saveHist", "syncHist", "histForget", "logStreakWeeks"];
  const src = names.map((n) => fnOf(html, n)).join("\n");
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const state: any = { logged: [], hist: [] };
  const make = new Function("localStorage", "state",
    src + "\nreturn { syncHist, histForget, logStreakWeeks, loadHist, logWeekStartIso, isoAdd, todayIso };");
  return { api: make(localStorage, state), state, store, localStorage };
}

/** n runs on the given ISO dates, newest first, in the shape saveRuns/syncHist expect. */
function runs(dates: string[]) {
  return dates.map((d, i) => ({ id: "run-" + i, dateIso: d, distKm: 8, sec: 2700, type: "easy" }));
}

test("a history row outlives its run past the 50-run cap", () => {
  const { api, state, localStorage } = sandbox();
  const today = api.todayIso();
  const dates: string[] = [];
  for (let i = 0; i < 60; i++) dates.push(api.isoAdd(today, -i * 2).toISOString().slice(0, 10));
  state.logged = runs(dates);
  api.syncHist();

  // The runs store is what saveRuns caps; the history is not.
  localStorage.setItem("interun_runs", JSON.stringify(state.logged.slice(0, 50)));
  const keptRuns = JSON.parse(localStorage.getItem("interun_runs")!);
  const keptHist = JSON.parse(localStorage.getItem("interun_hist_v1")!);

  assert.equal(keptRuns.length, 50, "the run store should still cap at 50 — the route is why it exists");
  assert.equal(keptHist.length, 60, "every run must have a history row, uncapped");
  // The oldest history row must predate the oldest surviving run, or the store buys nothing.
  assert.ok(keptHist[keptHist.length - 1].d < keptRuns[keptRuns.length - 1].dateIso,
    "history must reach further back than the capped runs");
});

test("the streak is counted from history, so consistency no longer shortens it", () => {
  const { api, state } = sandbox();
  const wkStart = api.logWeekStartIso();
  const today = api.todayIso();
  const dates: string[] = [];
  // 5 runs a week for 40 weeks — a real streak, far beyond 50 runs.
  for (let w = 0; w < 40; w++) {
    for (const dow of [0, 2, 3, 5, 6]) {
      const iso = api.isoAdd(wkStart, -(w * 7) + dow).toISOString().slice(0, 10);
      if (iso <= today) dates.push(iso);
    }
  }
  state.logged = runs(dates);
  api.syncHist();
  assert.ok(dates.length > 150, "fixture should be far bigger than the cap, got " + dates.length);

  const streak = api.logStreakWeeks();
  assert.equal(streak, 40, "a 40-week streak must read 40, not the ~11 the capped store gave");

  // ⚠️ THE DISCRIMINATOR. Capping the source is the exact bug; prove the streak survives it.
  state.logged = state.logged.slice(0, 50);
  assert.equal(api.logStreakWeeks(), 40, "the streak must not depend on state.logged at all");
});

test("deleting a run forgets its row, and undo brings it back", () => {
  const { api, state } = sandbox();
  const today = api.todayIso();
  state.logged = runs([today, api.isoAdd(today, -2).toISOString().slice(0, 10)]);
  api.syncHist();
  assert.equal(state.hist.length, 2);

  const gone = state.logged[1];
  state.logged = [state.logged[0]];
  api.histForget(gone);
  assert.equal(state.hist.length, 1, "a deleted run must not keep counting toward totals forever");

  // Undo: the run returns to state.logged and the next sync re-adds it. No partner call needed.
  state.logged = [state.logged[0], gone];
  api.syncHist();
  assert.equal(state.hist.length, 2, "undo must restore the row");
});

test("a distance added after the fact updates the row instead of duplicating it", () => {
  const { api, state } = sandbox();
  // A treadmill run is saved with no distance, then applyTreadmillDistance edits it in place.
  state.logged = [{ id: "run-tm", dateIso: api.todayIso(), distKm: 0, sec: 1800, type: "easy" }];
  api.syncHist();
  assert.equal(state.hist.length, 1);
  assert.equal(state.hist[0].k, 0);

  state.logged[0].distKm = 6.4;
  api.syncHist();
  assert.equal(state.hist.length, 1, "editing a run must not add a second row");
  assert.equal(state.hist[0].k, 6.4, "the row must follow the run it describes");
});

test("nothing caps the history, and the runs are still written first", () => {
  const html = page();
  const sync = fnOf(html, "syncHist").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/slice\(0,\s*\d/.test(sync), "syncHist must never cap — that is the whole point of it");

  // ⚠️ Order matters: a failure to keep the history must never cost somebody the run they just did.
  const save = fnOf(html, "saveRuns").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const runsAt = save.indexOf("interun_runs");
  const histAt = save.indexOf("syncHist");
  assert.ok(runsAt > 0 && histAt > runsAt, "saveRuns must write the runs before touching the history");
  assert.ok(/catch[\s\S]*syncHist/.test(save), "the history write needs its own try — it must not be able to lose a run");
});
