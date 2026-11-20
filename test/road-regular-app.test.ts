// STAGES.md §10 PIECE 3 IN THE APP — regular and competitive runners' roads, and a checkpoint every four weeks inside the race
// block (owner, 2026-11-18, decision 3: "yes to all five, build it"). Lifted from the BUILT page over the real engine:
//   * the race block is cut into its blocks of four (RC.raceBlockSplit) — a road stored with one race stage too;
//   * NO HOLD in the race block: a race-block checkpoint left unanswered lets the plan carry on as laid (decision 4: only the
//     runner shortens the race block), and an answer there moves no week;
//   * a foundation answer takes its week from the race block as ONE block (its floor is the block's);
//   * the race-block checkpoint asks for the level's test and says what happens if it is not answered;
//   * the road the wizard saves carries the race block its foundation is aimed at (destWeeks).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function roadSplitRace(");
assert.ok(at0 >= 0, "roadSplitRace is not in the build — run node web/app.ts");
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

const FROM = "2026-11-23";
const CONSTS = ["ROAD_STAGE_LABEL", "ROAD_STAGE_JOB", "ROAD_STAGE_JOB_MAIN", "ROAD_MIN_RACE_WEEKS"];
const ROAD_FNS = ["roadOf", "roadWeeksBetween", "roadMondayAfter", "roadAnswerAt", "effectiveRoad", "roadAthleteOf", "roadLegsNow",
  "roadCheckpoint", "roadAnswered", "roadRaceWeeks", "weekMondayOf", "roadWalkRun", "roadMergeRace", "roadSplitRace",
  "roadFromProposal", "roadStageJob", "roadOwnsTests", "roadLine", "roadWeeksLabel", "experienceFor", "resolvedStatus"];

/** A regular runner's road: two Base blocks, then a half's race block of sixteen weeks (from 25 Jan, race on 16 May). */
const REGULAR = (checkpoints: unknown[] = [], stages: unknown[] = [{ kind: "base", weeks: 4 }, { kind: "base", weeks: 5 },
  { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }]) =>
  ({ v: 1, fromIso: FROM, stages, rampWeeks: 9, destWeeks: 16, checkpoints });
const UP_FOUNDATION = [{ dueIso: "2026-12-21", kind: "base", answer: "up" }, { dueIso: "2027-01-25", kind: "base", answer: "up" }];

function harness(today: string, road: unknown, o: { status?: string; returning?: string | false } = {}) {
  const clock = { today };
  const profile: any = { personalized: true, status: o.status ?? "regular", returning: o.returning ?? false,
    raceDate: "2027-05-16", goalDist: "half", road };
  const env: Record<string, unknown> = { RC, profile, todayIso: () => clock.today, isoAdd };
  const src = [...CONSTS.map(constDecl), ...ROAD_FNS.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + ROAD_FNS.join(", ") + " };")(...names.map((n) => env[n]));
  return { api, clock, profile };
}
const raw = (r: any) => r.stages.map((s: any) => s.kind.slice(0, 2) + s.weeks).join(" ");

test("BLOCKER: the race block has a checkpoint every four weeks — its last block none — and an old one-stage race block is cut too", () => {
  // A road stored before the race block had checkpoints: one race stage. Its sessions do not change (the engine builds the
  // entries as one block, test/road-regular.test.ts); its checkpoints appear.
  const old = harness("2026-11-25", REGULAR([], [{ kind: "base", weeks: 4 }, { kind: "base", weeks: 5 }, { kind: "race", weeks: 16 }]));
  assert.equal(raw(old.api.effectiveRoad(old.profile, { experience: "recreational" }, { raceDateIso: "2027-05-16" })),
    "ba4 ba5 ra4 ra4 ra4 ra4");
  const seen = (today: string, cps: unknown[] = UP_FOUNDATION) => {
    const cp = harness(today, REGULAR(cps)).api.roadCheckpoint();
    return cp ? cp.kind + "→" + cp.endIso : null;
  };
  assert.equal(seen("2027-02-10"), null, "asked before the block's last week");
  assert.equal(seen("2027-02-17"), "race→2027-02-22", "Race block 1's checkpoint");
  assert.equal(seen("2027-03-17"), "race→2027-03-22");
  assert.equal(seen("2027-04-14"), "race→2027-04-19");
  assert.equal(seen("2027-05-12"), null, "race day's block has a checkpoint — that question is B9's after-race handover");
  // Answered, it is not asked again.
  assert.equal(seen("2027-02-18", [...UP_FOUNDATION, { dueIso: "2027-02-22", kind: "race", answer: "up" }]), null);
  // A race-only road (a regular runner close to the race) has them too.
  const only = harness("2026-12-16", REGULAR([], [{ kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 },
    { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 1 }]));
  only.profile.raceDate = "2027-05-16";
  assert.equal(only.api.roadCheckpoint()?.endIso, "2026-12-21");
});

test("BLOCKER: no hold inside the race block — a checkpoint left unanswered lets the plan carry on as laid", () => {
  // Monday 22 Feb has come and Race block 1's checkpoint was never answered: the race block is exactly as laid, and the
  // next question is Race block 2's. (A foundation checkpoint left unanswered still holds — test/road-app.test.ts.)
  const h = harness("2027-02-24", REGULAR(UP_FOUNDATION));
  assert.equal(raw(h.api.effectiveRoad(h.profile, { experience: "recreational" }, { raceDateIso: "2027-05-16" })), "ba4 ba5 ra4 ra4 ra4 ra4",
    "the race block was held — it shortened itself without the runner choosing");
  assert.equal(h.api.roadCheckpoint(), null);
  h.clock.today = "2027-03-17";
  assert.equal(h.api.roadCheckpoint()?.endIso, "2027-03-22");
});

test("BLOCKER: an answer at a race-block checkpoint moves no week — carry on, or ease back with a lighter week only", () => {
  const h = harness("2027-02-17", REGULAR(UP_FOUNDATION));
  const cp = h.api.roadCheckpoint();
  assert.equal(cp.kind, "race");
  for (const choice of ["up", "ease"]) {
    const after = h.api.roadAnswered(cp, choice);
    assert.equal(raw(after), "ba4 ba5 ra4 ra4 ra4 ra4", `"${choice}" changed the race block`);
    assert.deepEqual(after.checkpoints.slice(-1)[0], { dueIso: "2027-02-22", kind: "race", answer: choice, answeredIso: "2027-02-17" });
    // Easing back's lighter week is next week: the "make a week easier" row answerRoad adds from the stage's end.
    const wk = after.stages.slice(0, cp.i + 1).reduce((n: number, s: any) => n + s.weeks, 0);
    assert.equal(h.api.roadMondayAfter(after.fromIso, wk), cp.endIso);
  }
  const answer = decomment(fnBody("answerRoad"));
  assert.match(answer, /if \(choice === "ease"\) \{/, "easing back no longer adds the lighter week");
  // ⚠️ "One more week" inside the race block is the owner's to rule on (STAGES.md §10): until then it is not an answer there.
  assert.equal(h.api.roadAnswered(cp, "more"), null);
});

test("BLOCKER: a foundation answer takes its week from the race block as ONE block — its floor is the block's", () => {
  // A regular runner coming back: Rebuild, then a race block of sixteen as four blocks of four. At the Rebuild checkpoint a
  // week more has nowhere to come from but the race block — and no single block of four can give one up by itself.
  const reb = REGULAR([], [{ kind: "rebuild", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 },
    { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }]);
  (reb as any).fromIso = "2026-12-28"; // twenty weeks to race week (10 May): Rebuild to 25 Jan, then the race block
  const h = harness("2027-01-20", reb, { returning: "injury" });
  const cp = h.api.roadCheckpoint();
  assert.equal(cp.kind, "rebuild");
  const more = h.api.roadAnswered(cp, "more");
  assert.ok(more, "a week more found no room — taken per block of four, each at its floor");
  assert.equal(raw(more), "re5 ra4 ra4 ra4 ra3", "the race block gives one week, then is cut into its blocks again");
  assert.equal(raw(h.api.roadAnswered(cp, "ease")), "re4 re1 ra4 ra4 ra4 ra3");
});

test("a regular runner's road is saved with the race block it is aimed at, and described in their own words", () => {
  const h = harness("2026-11-20", null);
  const prop = { stages: [{ kind: "base", weeks: 4 }, { kind: "base", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 },
    { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }], rampWeeks: 8, destWeeks: 16 };
  const road = h.api.roadFromProposal(prop, { raceDate: "2027-05-16" });
  assert.equal(road.destWeeks, 16, "the destination the foundation was aimed at is not stored");
  assert.equal(road.fromIso, "2026-11-30");
  // A beginner's road (no destWeeks in its proposal) stores none — the engine aims it at the book's race block, as before.
  assert.equal("destWeeks" in h.api.roadFromProposal({ ...prop, destWeeks: undefined }, { raceDate: "2027-05-16" }), false);
  assert.equal(h.api.roadLine(road.stages), "8 weeks Base in 2 blocks → 16 weeks race block in 4 blocks");
  // The race block's length is all its blocks (the "it usually takes 16" note and the wizard's short-road note read it).
  assert.equal(h.api.roadRaceWeeks(road.stages), 16);
  // The stage's job: a regular runner's Base is their own (not the habit-builder's fartlek).
  assert.match(h.api.roadStageJob("base"), /built up from where it is now: one quality session a week/);
  h.profile.status = "building";
  assert.match(h.api.roadStageJob("base"), /one gentle fartlek a week/);
  const wiz = decomment(fnBody("wizRoadHtml"));
  assert.match(wiz, /Your race block has a checkpoint every four weeks too/);
});

test("the Plan screen's road says what the runner chose at a race-block checkpoint, and what comes next", () => {
  // Found in the browser: after "Ease back" the card went on saying "your checkpoint is this week" — easing back inside the
  // race block moves no week, so the answer stands against this block and the card has to say so.
  const card = (cps: unknown[], today: string) => {
    const clock = { today };
    const profile: any = { personalized: true, status: "regular", returning: false, raceDate: "2027-05-16", goalDist: "half", road: REGULAR(cps) };
    const env: Record<string, unknown> = { RC, profile, todayIso: () => clock.today, isoAdd, esc: (x: unknown) => String(x),
      currentHandover: () => null, currentReentry: () => null, currentRealign: () => null,
      // pc-days-raceblock: a regular runner's road adds no day this way (road-days-app guards the line).
      roadNewDayLine: () => "" };
    const fns = [...ROAD_FNS, "roadPlanCard", "roadTimelineHtml", "roadDayLabel", "roadLegName", "currentRoadCheckpoint"];
    const src = [...CONSTS, "ROAD_COLOUR"].map(constDecl).concat(fns.map(fnBody)).join("\n");
    const names = Object.keys(env);
    const api = new Function(...names, src + "\nreturn { roadPlanCard };")(...names.map((n) => env[n]));
    return api.roadPlanCard().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  };
  assert.match(card(UP_FOUNDATION, "2027-02-17"), /Your checkpoint is this week: a test run, and a look at how this block went\./);
  const eased = card([...UP_FOUNDATION, { dueIso: "2027-02-22", kind: "race", answer: "ease" }], "2027-02-18");
  assert.match(eased, /You chose to ease back: the week of 22 Feb is lighter, then Race block 2 carries on as planned\./);
  assert.doesNotMatch(eased, /Your checkpoint is this week/);
  const up = card([...UP_FOUNDATION, { dueIso: "2027-02-22", kind: "race", answer: "up" }], "2027-02-18");
  assert.match(up, /You chose to go on: Race block 2 starts on Monday 22 Feb\./);
  // Mid-block, the next race-block checkpoint is named with what it is for.
  assert.match(card(UP_FOUNDATION, "2027-03-03"), /Your next checkpoint is the week of 15 Mar: a test run that keeps your paces honest/);
});

test("the weekly review's 2 km retest stands aside on a road — the checkpoints ask for the test", () => {
  const body = decomment(fnBody("currentWeeklyReview"));
  assert.match(body, /noMaximalTest: !RC\.maximalTestAllowed\(\{ level: resolvedStatus\(profile\), injured: returnKind\(profile\) === "injury" \}\) \|\| roadOwnsTests\(\)/);
  assert.equal(harness("2027-02-17", REGULAR(UP_FOUNDATION)).api.roadOwnsTests(), true);
  assert.equal(harness("2027-02-17", null).api.roadOwnsTests(), false);
});

// ---- The race-block checkpoint's sheet ------------------------------------------------------------------------------

type Run = { id: string; dateIso: string; distKm: number; sec: number; rpe?: number; test?: string; pain?: boolean };
const SHEET_TODAY = "2027-02-17";
function sheet(o: { status?: string; returning?: string | false; runs?: Run[]; feas?: unknown } = {}) {
  const profile: any = { personalized: true, status: o.status ?? "regular", returning: o.returning ?? false, goalDist: "half",
    raceDate: "2027-05-16", recentTimeS: 1350, noRecent: false };
  const state: any = { logged: o.runs ?? [], hist: [] };
  const legs = [
    { i: 0, kind: "base", weeks: 4, fromIso: "2026-11-23", endIso: "2026-12-21" },
    { i: 1, kind: "base", weeks: 5, fromIso: "2026-12-21", endIso: "2027-01-25" },
    { i: 2, kind: "race", weeks: 4, fromIso: "2027-01-25", endIso: "2027-02-22" },
    { i: 3, kind: "race", weeks: 4, fromIso: "2027-02-22", endIso: "2027-03-22" },
    { i: 4, kind: "race", weeks: 4, fromIso: "2027-03-22", endIso: "2027-04-19" },
    { i: 5, kind: "race", weeks: 4, fromIso: "2027-04-19", endIso: "2027-05-17" },
  ];
  const cp = Object.assign({}, legs[2], { next: legs[3], legs });
  const env: Record<string, unknown> = {
    RC, profile, state, isoAdd, todayIso: () => SHEET_TODAY,
    // The block's longest planned run: 80 minutes (time on feet's bar, where it counts).
    PLAN: { weeks: [{ index: 12, startIso: "2027-02-08" }], feasibility: o.feas ?? null, goal: { target: "1:35:00" } },
    RAW: { weeks: [{ sessions: [{ id: "w12-long", type: "long", dayOfWeek: 6, estimatedDurationSeconds: 80 * 60 }] }] },
    PRIMARY_TYPES: { long: 1, easy: 1 }, effDay: (s: any) => s.dayOfWeek, linkedRunFor: () => null,
    loadHist: () => [], loadTwoKm: () => [], runDateLabelIso: (iso: string) => "D" + iso,
    esc: (x: unknown) => String(x).replace(/</g, "&lt;"),
    currentRoadCheckpoint: () => cp, roadOf: () => ({ checkpoints: [] }),
    saveRuns: () => {}, saveFitSuggest: () => {}, RACE_FIT_MIN: 0.02,
    // pc-days-raceblock: the days offer is a habit-builder's, at the checkpoint into the race block — road-days-app.
    roadDayOffer: () => null,
  };
  const fns = ["roadFacts", "roadClock", "roadLongestKm", "roadTestOffer", "roadTestIn", "roadParkrunCandidates", "resolvedStatus", "returnKind",
    "fmtTimeFull", "weekMondayOf", "roadMondayAfter", "roadLegName", "roadCheckpointHtml", "roadAnswered", "roadRaceWeeks", "roadWeeksLabel",
    "roadBookRaceWeeks", "roadWalkRun", "roadTargetRun", "roadMergeRace", "roadSplitRace", "roadStageJob", "experienceFor"];
  const src = [...CONSTS.map(constDecl), ...fns.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + fns.join(", ") + " };")(...names.map((n) => env[n]));
  return { api, cp };
}
const run = (id: string, dateIso: string, distKm: number, min: number, rpe = 3): Run => ({ id, dateIso, distKm, sec: min * 60, rpe });

test("BLOCKER: the race-block checkpoint asks for the level's test, and says the plan carries on if it is not answered", () => {
  // A regular runner with a 10 km run this month: a parkrun or the 2 km trial (RC.blockTestsFor), with their buttons.
  const reg = sheet({ runs: [run("a", "2027-02-07", 10, 55), run("p", "2027-02-13", 5.0, 21, 8)] });
  const f = reg.api.roadFacts(reg.cp);
  assert.equal(f.stage, "race");
  assert.equal(f.keyRun.kind, "test");
  assert.deepEqual(f.keyRun.offer, ["parkrun", "trial-2k"]);
  const html = reg.api.roadCheckpointHtml();
  assert.match(html, /Checkpoint · end of Race block 1/);
  assert.match(html, /data-roadtrial="max"/);
  assert.match(html, /data-roadtest="p">Count your 5\.0 km run/);
  assert.match(html, /data-road="up"[^>]*>(<span class="po-rec">Suggested<\/span>)?<span class="po-t">Start Race block 2</);
  assert.match(html, /data-road="ease"/);
  // ⚠️ No hold: the words say the plan carries on — never "until you choose, you stay in …".
  assert.match(html, /If you don’t choose, your plan carries on as it is\./);
  assert.doesNotMatch(html, /you stay in|Move up to/);
  // "One more week" inside the race block waits for the owner's ruling (STAGES.md §10).
  assert.doesNotMatch(html, /data-road="more"/);
  // Back from injury: the controlled 2 km or time on feet — never the trial, never a parkrun (decision 5).
  const inj = sheet({ returning: "injury", runs: [run("a", "2027-02-07", 10, 55)] });
  assert.deepEqual(inj.api.roadFacts(inj.cp).keyRun.offer, ["controlled-2k", "time-on-feet"]);
  const ih = inj.api.roadCheckpointHtml();
  assert.match(ih, /data-roadtrial="controlled"/);
  assert.doesNotMatch(ih, /data-roadtrial="max"|parkrun/);
});

test("BLOCKER: the owner's B inside the race block — the suggestion is Start or Ease back, and behind names both ways out", () => {
  // His answer, 2026-11-19: "B: No "One more week" there". Where the judgement would suggest a week more (a run missed, the
  // test not yet done), the race block suggests carrying on — the reasons and the test buttons say what is missing.
  const sug = (html: string) => (/data-road="(\w+)"[^>]*><span class="po-rec">Suggested/.exec(html) || [])[1] ?? null;
  const nearly = sheet({ runs: [run("a", "2027-02-07", 10, 55)] });
  assert.notEqual(RC.evaluateCheckpoint(nearly.api.roadFacts(nearly.cp)).verdict, "ready");
  assert.equal(RC.evaluateCheckpoint(nearly.api.roadFacts(nearly.cp)).recommend, "more", "the judgement itself is unchanged");
  assert.equal(sug(nearly.api.roadCheckpointHtml()), "up", "inside the race block nothing was suggested, or a week more");
  // Something hurt: easing back, with the injury door — as at every checkpoint.
  const hurt = sheet({ runs: [{ ...run("a", "2027-02-14", 10, 55), pain: true }] });
  const hh = hurt.api.roadCheckpointHtml();
  assert.equal(sug(hh), "ease");
  assert.match(hh, /id="roadInjury"/);
  // Behind: a new target near the suggested one, or a later race — both named, neither picked.
  const behind = sheet({ runs: [], feas: { verdict: "unrealistic", currentPredicted: "1:48:00", suggestedTarget: "1:45:00" } });
  const bh = behind.api.roadCheckpointHtml().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(bh, /behind — your current fitness predicts 1:48:00\. Your choices, none picked for you: a target near 1:45:00, which fits the time left, or a later race — both in your profile — or carry on as you are\./);
  const noSuggestion = sheet({ runs: [], feas: { verdict: "unrealistic", currentPredicted: "1:48:00", suggestedTarget: null } });
  assert.match(noSuggestion.api.roadCheckpointHtml(), /Your choices, none picked for you: a new target, or a later race/);
});
