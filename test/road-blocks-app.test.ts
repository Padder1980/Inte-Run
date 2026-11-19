// STAGES.md §10 IN THE APP, piece 1 — the end-of-block test chosen by level (decision 5), lifted from the BUILT page over
// the real engine: the checkpoint offers only the tests this runner may do, a parkrun only once the longest run of the
// last 30 days is about 4.5 km, time on feet for somebody back from injury, and a controlled 2 km that can never pull
// paces down. Blocks themselves (decision 1) are guarded in road-blocks.test.ts and road-app.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function roadFacts(");
assert.ok(at0 >= 0, "roadFacts is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));
function fnBody(name: string): string {
  const at = SRC.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at + 1, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constDecl(name: string): string {
  const at = SRC.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "no const " + name + " in the build");
  return SRC.slice(at, SRC.indexOf(";\n", at) + 1);
}
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const isoAdd = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; };
const day = (iso: string, n: number) => isoAdd(iso, n).toISOString().slice(0, 10);
// The owner's road: Rebuild 23 Nov – 20 Dec, then Base from Monday 21 Dec, its checkpoint on 25 Jan.
const BASE_FROM = "2026-12-21", BASE_END = "2027-01-25", TODAY = "2027-01-20";

type Run = { id: string; dateIso: string; distKm: number; sec: number; rpe?: number; test?: string; pain?: boolean };
function harness(o: { status?: string; returning?: string | false; runs?: Run[]; hist?: unknown[]; twoKm?: unknown[] } = {}) {
  const profile: any = { personalized: true, status: o.status ?? "building", returning: o.returning ?? false, goalDist: "half",
    raceDate: "2027-05-16", recentTimeS: 1500, noRecent: false };
  const state: any = { logged: o.runs ?? [], hist: o.hist ?? [] };
  const saved: { runs: number; fit: unknown } = { runs: 0, fit: null };
  const cp = { i: 1, kind: "base", weeks: 5, fromIso: BASE_FROM, endIso: BASE_END,
    next: { i: 2, kind: "race", weeks: 16, fromIso: BASE_END, endIso: "2027-05-17" },
    legs: [{ i: 0, kind: "rebuild", weeks: 4, fromIso: "2026-11-23", endIso: BASE_FROM },
      { i: 1, kind: "base", weeks: 5, fromIso: BASE_FROM, endIso: BASE_END },
      { i: 2, kind: "race", weeks: 16, fromIso: BASE_END, endIso: "2027-05-17" }] };
  const env: Record<string, unknown> = {
    RC, profile, state, isoAdd, todayIso: () => TODAY,
    // One Base week whose long run is the block's longest planned run: 46 minutes.
    PLAN: { weeks: [{ index: 5, startIso: "2027-01-11" }], feasibility: null, goal: { target: "1:35:00" } },
    RAW: { weeks: [{ sessions: [{ id: "w5-long", type: "long", dayOfWeek: 6, estimatedDurationSeconds: 46 * 60 }] }] },
    PRIMARY_TYPES: { long: 1, easy: 1 }, effDay: (s: any) => s.dayOfWeek, linkedRunFor: () => null,
    loadHist: () => [], loadTwoKm: () => o.twoKm ?? [], runDateLabelIso: (iso: string) => "D" + iso,
    esc: (x: unknown) => String(x).replace(/</g, "&lt;"),
    currentRoadCheckpoint: () => cp, roadOf: () => ({ checkpoints: [] }),
    saveRuns: () => { saved.runs++; }, saveFitSuggest: () => { saved.fit = state.fitSuggest; }, RACE_FIT_MIN: 0.02,
  };
  const fns = ["roadFacts", "roadClock", "roadLongestKm", "roadTestOffer", "roadTestIn", "roadParkrunCandidates", "countRoadTest",
    "resolvedStatus", "returnKind", "fmtTimeFull", "weekMondayOf", "roadMondayAfter", "roadLegName", "roadCheckpointHtml",
    "roadAnswered", "roadRaceWeeks", "roadWeeksLabel", "roadBookRaceWeeks", "roadWalkRun", "roadTargetRun", "roadMergeRace", "roadSplitRace",
    "roadStageJob", "experienceFor"];
  const src = [constDecl("ROAD_STAGE_LABEL"), constDecl("ROAD_STAGE_JOB"), constDecl("ROAD_STAGE_JOB_MAIN"), constDecl("ROAD_MIN_RACE_WEEKS"),
    ...fns.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + fns.join(", ") + " };")(...names.map((n) => env[n]));
  return { api, cp, state, profile, saved };
}
const run = (id: string, dateIso: string, distKm: number, min: number, rpe = 3): Run => ({ id, dateIso, distKm, sec: min * 60, rpe });

test("BLOCKER: back from injury, Base ends in a controlled 2 km or time on feet — never a time trial, never a parkrun", () => {
  const h = harness({ returning: "injury", runs: [run("a", "2027-01-17", 8, 47)] });
  const f = h.api.roadFacts(h.cp);
  assert.equal(f.keyRun.kind, "test");
  assert.deepEqual(f.keyRun.offer, ["controlled-2k", "time-on-feet"]);
  assert.equal(f.keyRun.timeOnFeet.needMin, 46, "time on feet is the block's own longest planned run");
  // Her 47-minute easy run is the key run: no timed effort at all.
  assert.equal(RC.evaluateCheckpoint(f).met.keyRun, true);
  const short = harness({ returning: "injury", runs: [run("a", "2027-01-17", 8, 40)] });
  const sheet = short.api.roadCheckpointHtml();
  assert.match(sheet, /data-roadtrial="controlled"/);
  assert.doesNotMatch(sheet, /data-roadtrial="max"|parkrun|data-trialstart/, "an injured runner is offered a maximal test");
});

test("BLOCKER: a parkrun is offered only once the longest run of the last 30 days is about 4.5 km — and the runner counts it", () => {
  // Longest 4.0 km: the controlled 2 km only.
  const lo = harness({ runs: [run("a", "2027-01-10", 4.0, 30)] });
  assert.deepEqual(lo.api.roadFacts(lo.cp).keyRun.offer, ["controlled-2k"]);
  assert.doesNotMatch(lo.api.roadCheckpointHtml(), /parkrun/);
  // A 6 km run 31 days ago does not count; 29 days ago it does (RC.LONGEST_RUN_WINDOW_DAYS).
  assert.equal(RC.LONGEST_RUN_WINDOW_DAYS, 30);
  const old = harness({ runs: [run("a", day(TODAY, -30), 6, 40)] });
  assert.doesNotMatch(old.api.roadCheckpointHtml(), /parkrun/, "a run from 31 days ago opened the parkrun");
  const in30 = harness({ runs: [run("a", day(TODAY, -29), 6, 40)] });
  assert.match(in30.api.roadCheckpointHtml(), /Or run a parkrun or a 5 km/);
  // The history rows count as runs too (the runs store forgets past its fifty).
  const hist = harness({ hist: [{ i: "h", d: day(TODAY, -3), k: 5.2, s: 1800 }] });
  assert.ok(hist.api.roadFacts(hist.cp).keyRun.offer.includes("parkrun"));
  // A 5.0 km run in the block: a button to count it — and once counted, the key run is done and named. A 5 km the runner
  // rated easy is not offered as a test (found in the browser: an easy 5.4 km sat beside the parkrun as a "test").
  const h = harness({ runs: [run("p", "2027-01-16", 5.0, 27, 8), run("e", "2027-01-14", 5.4, 30, 3)] });
  const sheet = h.api.roadCheckpointHtml();
  assert.match(sheet, /data-roadtest="p">Count your 5\.0 km run on D2027-01-16 as your parkrun or 5 km test/);
  assert.doesNotMatch(sheet, /data-roadtest="e"/, "a run rated easy is offered as the test");
  assert.equal(RC.evaluateCheckpoint(h.api.roadFacts(h.cp)).met.keyRun, false, "an easy-looking 5 km counted by itself");
  assert.equal(h.api.countRoadTest("p"), true);
  assert.equal(h.state.logged[0].test, "5k");
  assert.equal(h.saved.runs, 1, "the count was not saved");
  const f = h.api.roadFacts(h.cp);
  assert.equal(f.keyRun.doneIso, "D2027-01-16");
  assert.match(f.keyRun.label, /^5\.0 km in 27:00$/);
  assert.equal(RC.evaluateCheckpoint(f).met.keyRun, true);
  // ⚠️ AN OFFER, NEVER A CHANGE: the parkrun's 5 km equivalent waits as the pace suggestion; the profile is untouched.
  assert.equal(h.profile.recentTimeS, 1500);
  assert.ok(h.saved.fit && (h.saved.fit as any).test === true && (h.saved.fit as any).implied > 0, "no pace offer from the test");
});

test("Just getting started: time on feet is the whole key run, with no test button at all", () => {
  const h = harness({ status: "new", runs: [run("a", "2027-01-17", 6, 45)] });
  const f = h.api.roadFacts(h.cp);
  assert.equal(f.keyRun.kind, "easy-run");
  assert.equal(f.keyRun.needMin, 46);
  assert.doesNotMatch(h.api.roadCheckpointHtml(), /data-roadtrial|data-roadtest|parkrun/);
});

test("the all-out 2 km is offered only where a maximal test is allowed", () => {
  const reg = harness({ status: "regular", runs: [run("a", "2027-01-10", 10, 55)] });
  const sheet = reg.api.roadCheckpointHtml();
  assert.match(sheet, /data-roadtrial="max"/);
  assert.doesNotMatch(sheet, /data-roadtrial="controlled"/);
  // A habit-builder's 2 km is the controlled one.
  assert.doesNotMatch(harness({ runs: [] }).api.roadCheckpointHtml(), /data-roadtrial="max"/);
});

test("a second Base block is named and offered as the next block, not as moving up", () => {
  const h = harness({ runs: [] });
  h.cp.legs.splice(2, 0, { i: 2, kind: "base", weeks: 4, fromIso: BASE_END, endIso: "2027-02-22" });
  h.cp.legs.forEach((l: any, i: number) => { l.i = i; });
  h.cp.next = h.cp.legs[2] as any;
  const sheet = h.api.roadCheckpointHtml();
  assert.match(sheet, /Checkpoint · end of Base 1/);
  assert.match(sheet, /Start Base 2/);
  assert.doesNotMatch(sheet, /Move up to Base/);
});

test("BLOCKER: a controlled 2 km can lift the paces' anchor, never lower one an all-out test set", () => {
  function save(o: { mode: string | null; from?: string | null; prior: number; secs: number }) {
    const profile: any = { twoKmS: o.prior };
    const state: any = { trialMode: o.mode, trialFrom: o.from ?? null };
    const rec: unknown[] = [], opened: number[] = [];
    const env: Record<string, unknown> = {
      profile, state, saveTwoKmRecord: (s: number, extra: unknown) => rec.push({ s, extra }),
      adoptPlan: () => {}, applyProfile: () => ({}), computeToday: () => {}, planDefaultWeek: () => 0, CURRENT_WEEK: 0, TODAY_DOW: 0,
      saveProfileStore: () => {}, clearScheduledTrial: () => {}, render: () => {}, toast: () => {}, openRoadCheckpoint: () => opened.push(1),
    };
    const src = "let TRIALRUN = { secs: " + o.secs + " };\n" + fnBody("trialControlled") + "\n" + fnBody("fmtTimeFull") + "\n" +
      fnBody("trialSaveResult") + "\nreturn trialSaveResult;";
    const names = Object.keys(env);
    new Function(...names, src)(...names.map((n) => env[n]))();
    return { twoKmS: profile.twoKmS, rec, opened: opened.length, state };
  }
  // Slower than the all-out 9:00 already set: recorded as controlled, the anchor stays 9:00.
  const slow = save({ mode: "controlled", prior: 540, secs: 580 });
  assert.equal(slow.twoKmS, 540, "a controlled 2 km pulled the paces down");
  assert.deepEqual(slow.rec, [{ s: 580, extra: { effort: "controlled" } }]);
  // Quicker: it lifts the anchor. None before: it is the anchor.
  assert.equal(save({ mode: "controlled", prior: 540, secs: 520 }).twoKmS, 520);
  assert.equal(save({ mode: "controlled", prior: 0, secs: 600 }).twoKmS, 600);
  // The all-out trial is exactly as it was: the newest replaces the last, recorded with no effort label.
  const max = save({ mode: null, prior: 540, secs: 600 });
  assert.equal(max.twoKmS, 600);
  assert.deepEqual(max.rec, [{ s: 600, extra: undefined }]);
  // Started from a checkpoint: back to it, on Today, with the mode cleared.
  const road = save({ mode: "controlled", from: "road", prior: 0, secs: 600 });
  assert.equal(road.opened, 1);
  assert.equal(road.state.tab, "today");
  assert.equal(road.state.trialMode, null);
  assert.equal(save({ mode: "controlled", prior: 0, secs: 600 }).state.screen, "setup", "outside a checkpoint it lands where it always did");
});

test("the weekly review's retest offer reads the same rule as the checkpoint", () => {
  const body = decomment(fnBody("currentWeeklyReview"));
  assert.match(body, /noMaximalTest: !RC\.maximalTestAllowed\(\{ level: resolvedStatus\(profile\), injured: returnKind\(profile\) === "injury" \}\)/);
});

test("BLOCKER: the checkpoint never pops back up over a test the runner chose from it", () => {
  // Found driving it in a browser: "Do the 2 km" rendered Today with the test's card, and Today's render opened the
  // checkpoint again on top of it (whenever it had been opened from the Plan screen, so today's mark was not yet set).
  const pop = decomment(fnBody("maybeRoadPopup"));
  assert.match(pop, /if \(state\.trialPending\) return;/);
  assert.match(pop, /\$\("welcomeback"\) \|\| GUIDE \|\| state\.trialPending\) return;/, "the delayed open does not re-check");
  // Driven: with a test pending, no pop-up; without one, the pop-up.
  for (const pending of [true, false]) {
    let opened = 0;
    const env: Record<string, unknown> = {
      profile: { personalized: true }, state: { tab: "today", screen: null, trialPending: pending },
      $: () => null, GUIDE: null, guideSeen: () => true, EXTRAS: null, liveRunning: () => false,
      currentRoadCheckpoint: () => ({ endIso: "2027-01-25" }), todayIso: () => "2027-01-20",
      localStorage: { getItem: () => null, setItem: () => {} }, ROADPOP_KEY: "k",
      setTimeout: (f: () => void) => f(), openRoadCheckpoint: () => { opened++; return true; },
    };
    const names = Object.keys(env);
    new Function(...names, fnBody("maybeRoadPopup") + "\nreturn maybeRoadPopup;")(...names.map((n) => env[n]))();
    assert.equal(opened, pending ? 0 : 1, pending ? "popped up over the pending test" : "did not pop up at all");
  }
  // Opened from the Plan screen counts as today's showing.
  assert.match(decomment(fnBody("openRoadCheckpoint")), /localStorage\.setItem\(ROADPOP_KEY, html && currentRoadCheckpoint\(\) \? currentRoadCheckpoint\(\)\.endIso \+ "\|" \+ todayIso\(\) : ""\)/);
});
