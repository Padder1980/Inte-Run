// pc-days-raceblock IN THE APP — DAYS A WEEK ONCE A HABIT-BUILDER'S ROAD REACHES THE RACE BLOCK (the owner's yes to the
// recommendation in notes/plan-profile.md, 2026-11-20). Lifted from the BUILT page, over the real engine and the real
// applyProfile, on the owner's own road (Building the habit, After an injury, 4 days, a half on 16 May 2027: Rebuild 4 →
// Base 5 → race block 16, Base's checkpoint on Monday 25 Jan 2027):
//   * the checkpoint INTO the race block offers one more day — only to a habit-builder, only on its own good evidence;
//   * "Move up" then asks: Keep 4 days, or Add a day — never changing the days by itself, never saying a day is needed;
//   * adding records the day on the road from the race block's second week, so the engine starts it short and no week
//     already run changes; "Keep" is remembered for two months; one commit, one Undo;
//   * once the runner's week is in the race block the picker offers up to five, and a day added there starts short too;
//   * the weekly review judges race-block weeks by the track they are built on.
// The engine half is test/road-days-added.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function roadDayOffer(");
assert.ok(at0 >= 0, "roadDayOffer is not in the build — run node web/app.ts");
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
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
const isoAdd = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; };
const day = (iso: string, n: number) => isoAdd(iso, n).toISOString().slice(0, 10);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const IN_BASE = "2027-01-20";   // a Wednesday in Base's last week: its checkpoint (Monday 25 Jan) is up
const IN_RACE = "2027-02-03";   // a Wednesday in the race block's second week
const UP_REBUILD = { dueIso: "2026-12-21", kind: "rebuild", answer: "up" };
const UP_BASE = { dueIso: "2027-01-25", kind: "base", answer: "up" };
/** The owner's road as stored (§10: the race block in its four blocks of four). */
const ROAD = (checkpoints: unknown[] = [UP_REBUILD], extra: Record<string, unknown> = {}) => ({ v: 1, fromIso: "2026-11-23",
  stages: [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 5 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 },
    { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }], rampWeeks: 9, checkpoints, ...extra });
/** His profile: everything applyProfile reads. */
const OWNER = (o: Record<string, unknown> = {}) => ({ personalized: true, status: "building", returning: "injury", goalDist: "half",
  targetS: 5700, targetSet: true, raceDate: "2027-05-16", startDateIso: "2026-11-23", longRunDay: 6, recentTimeS: 1250,
  recentDistM: 5000, noRecent: false, twoKmS: 0, daysPerWeek: 4, volKm: 0, strength: true, age: 40, bRace: null, fitSrc: "recent",
  easyPaceS: 0, road: ROAD(), ...o } as any);

const FNS = [
  // the road
  "roadOf", "roadWeeksBetween", "roadMondayAfter", "roadAnswerAt", "effectiveRoad", "noRaceRoadNow", "roadAthleteOf", "roadLegsNow",
  "roadCheckpoint", "currentRoadCheckpoint", "roadAnswered", "roadRaceWeeks", "roadBookRaceWeeks", "weekMondayOf", "roadWalkRun",
  "roadMergeRace", "roadSplitRace", "roadLegName", "roadStageJob", "roadWeeksLabel", "roadDayLabel", "roadCheckpointHtml", "answerRoad",
  // the plan
  "applyProfile", "planStartIso", "blockStartIso", "holdBeforeStart", "firstShownWeek", "returnKind", "experienceFor", "resolvedStatus",
  "trainingYearsFor", "typeCeilingFor", "isNoRace", "noRaceGoalRoad",
  // the days
  "dayRaceBlockNow", "dayAddPhased", "roadDayAddedLast", "roadWithDayAdded", "roadDaysEdited", "roadDayAddFrom", "roadDayAddMonday", "roadDayOffer",
  "roadNewDayFacts", "roadDayPreview", "roadNth", "roadDaysStepHtml", "roadNewDayLine", "dayTrackFor", "dayChoiceOpts", "dayAnswerOf",
  "dayCapNote", "loadAddDayDeclined", "saveAddDayDeclined", "addDayEvidence", "applyAddDay",
];
const CONSTS = ["ROAD_STAGE_LABEL", "ROAD_STAGE_JOB", "ROAD_STAGE_JOB_MAIN", "ROAD_STAGE_JOB_NORACE", "ROAD_MIN_RACE_WEEKS",
  "ADJUST_KEY", "PRIMARY_TYPES", "STATUS_OPTS"];

type Facts = { planned: number; done: number; painRuns: number };
function harness(today: string, pf: any, o: { facts?: Facts; screen?: string; subj?: unknown; logged?: unknown[]; currentWeek?: number } = {}) {
  const clock = { today };
  const store: Record<string, string> = {};
  const box: any = { clock, store, profile: pf, toasts: [] as string[], undo: null, calls: [] as string[] };
  const state: any = { screen: o.screen ?? null, subj: o.subj ?? null, trainFlag: null, logged: o.logged ?? [], hist: [], dayOverride: {} };
  const RAW: any = { weeks: [] };
  const PLAN: any = { weeks: [], feasibility: null, goal: { target: "1:35:00" } };
  // The checkpoint's evidence: what roadFacts would gather (it is guarded in road-app / road-blocks-app); the judgement on
  // it is the real one (RC.evaluateCheckpoint).
  const facts = o.facts ?? { planned: 8, done: 8, painRuns: 0 };
  const env: Record<string, unknown> = {
    RC, profile: pf, state, RAW, PLAN, CURRENT_WEEK: o.currentWeek ?? 0, TODAY_DOW: 2, todayIso: () => clock.today, isoAdd,
    esc: (x: unknown) => String(x).replace(/</g, "&lt;"),
    localStorage: { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; } },
    roadFacts: () => ({ stage: "base", planned: facts.planned, done: facts.done, painRuns: facts.painRuns,
      keyRun: { kind: "easy-run", needMin: 40, bestMin: 46, bestIso: "16 Jan" } }),
    currentHandover: () => null, currentReentry: () => null, currentRealign: () => null,
    strengthPrefsOf: () => null, progActive: () => false, roadParkrunCandidates: () => [], roadTestTrailHtml: () => "",
    loadAdjust: () => [], saveAdjust: () => {}, saveDayOverride: () => {}, saveProfileStore: () => box.calls.push("save"),
    todayTicks: () => [], restoreTicks: () => {}, computeToday: () => {}, planDefaultWeek: () => 0, seedDone: () => {}, render: () => {},
    dismissWeeklyReview: () => box.calls.push("dismiss"), toast: (m: string) => box.toasts.push(m),
    toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
    // ⚠️ THE REBUILD IS THE REAL applyProfile: what the stored road builds, the engine builds.
    recompute: () => { box.calls.push("recompute"); RAW.weeks = box.api.applyProfile(pf).raw.weeks; },
    currentWeeklyReview: () => box.review,
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") + "};")(...names.map((n) => env[n]));
  box.state = state; box.RAW = RAW; box.PLAN = PLAN;
  return box;
}
const goodV = { met: { runs: true, noPain: true, keyRun: true } };

test("BLOCKER: the checkpoint into a habit-builder's race block offers one more day — only on its own good evidence", () => {
  const h = harness(IN_BASE, OWNER());
  const cp = h.api.roadCheckpoint();
  assert.equal(cp.kind + "→" + cp.next.kind, "base→race", "the fixture is not the checkpoint into the race block");
  assert.deepEqual(h.api.roadDayOffer(cp, goodV), { from: 4, to: 5 });
  // Just getting started reaches the race block on the main track too; three days are offered a fourth.
  assert.deepEqual(harness(IN_BASE, OWNER({ status: "new" })).api.roadDayOffer(cp, goodV), { from: 4, to: 5 });
  assert.deepEqual(harness(IN_BASE, OWNER({ daysPerWeek: 3 })).api.roadDayOffer(cp, goodV), { from: 3, to: 4 });
  // Only on the checkpoint's own evidence: most runs done, nothing hurt (the judgement's own "met").
  for (const met of [{ runs: false, noPain: true }, { runs: true, noPain: false }])
    assert.equal(h.api.roadDayOffer(cp, { met }), null, "offered a day on " + JSON.stringify(met));
  // Never to a regular runner (their race block is their own track, and the weekly review asks them).
  assert.equal(harness(IN_BASE, OWNER({ status: "regular" })).api.roadDayOffer(cp, goodV), null);
  // Never while unwell, and a no is remembered: the weekly review's own store, for two months.
  assert.equal(harness(IN_BASE, OWNER(), { subj: { illness: "cold", soreness: "low" } }).api.roadDayOffer(cp, goodV), null);
  const said = harness(IN_BASE, OWNER());
  said.store["interun_addday_v1"] = day(IN_BASE, -10);
  assert.equal(said.api.roadDayOffer(said.api.roadCheckpoint(), goodV), null, "asked again ten days after a no");
  // Never at a checkpoint that is not into the race block: inside it, or between two Base blocks.
  const inRace = harness("2027-02-17", OWNER({ road: ROAD([UP_REBUILD, UP_BASE]) }));
  const rcp = inRace.api.roadCheckpoint();
  assert.equal(rcp.kind, "race");
  assert.equal(inRace.api.roadDayOffer(rcp, goodV), null, "offered at a race-block checkpoint");
  const twoBase = OWNER({ road: { ...ROAD(), stages: [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }, { kind: "base", weeks: 5 },
    { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }, { kind: "race", weeks: 4 }] } });
  const tb = harness("2027-01-13", twoBase);
  const bcp = tb.api.roadCheckpoint();
  assert.equal(bcp.kind + "→" + bcp.next.kind, "base→base");
  assert.equal(tb.api.roadDayOffer(bcp, goodV), null, "offered between two Base blocks");
});

test("BLOCKER: \"Move up\" asks the days question only when offered — and the sheet otherwise is as it was", () => {
  const html = harness(IN_BASE, OWNER()).api.roadCheckpointHtml();
  assert.match(html, /data-road="up" data-days="1"/, "Move up does not lead to the days question");
  assert.match(text(html), /Then you choose: 4 days a week, or 5\./);
  for (const [why, h] of [
    ["a run hurt", harness(IN_BASE, OWNER(), { facts: { planned: 8, done: 8, painRuns: 1 } })],
    ["runs missed", harness(IN_BASE, OWNER(), { facts: { planned: 8, done: 5, painRuns: 0 } })],
    ["a regular runner", harness(IN_BASE, OWNER({ status: "regular" }))],
  ] as const) {
    const sheet = h.api.roadCheckpointHtml();
    assert.doesNotMatch(sheet, /data-days/, "the days question with " + why);
    assert.doesNotMatch(sheet, /Then you choose/, "the days question with " + why);
  }
  // The sheet's wiring: "up" with data-days opens the question; its two answers go through answerRoad and close the sheet.
  const days = decomment(fnBody("openRoadDays"));
  assert.match(days, /answerRoad\("up", b\.dataset\.roaddays === "add" \? "add" : "keep"\)/);
  assert.match(days, /closeSheet\(\)/);
  assert.match(days, /\$\("roadDaysBack"\); if \(back\) back\.onclick = \(\) => \{ openRoadCheckpoint\(\); \}/, "Back goes nowhere");
});

test("BLOCKER: the days question — two plain choices, its dates read off the plan the answer builds, no claim a day is needed", () => {
  const h = harness(IN_BASE, OWNER());
  const cp = h.api.roadCheckpoint();
  const sheet = h.api.roadDaysStepHtml(cp, { from: 4, to: 5 });
  const t = text(sheet);
  assert.match(t, /Your race block: 4 days a week, or 5\?/);
  assert.match(t, /You ran 8 of your 8 planned runs in the last two weeks and didn’t flag pain/);
  assert.match(sheet, /data-roaddays="keep"><span class="po-t">Keep 4 days</);
  assert.match(sheet, /data-roaddays="add"><span class="po-t">Add a day — 5 a week</);
  // ⚠️ THE DATES ARE THE ENGINE'S: the plan with the day, built through the real applyProfile from the road as answered.
  const pf = OWNER();
  const up = h.api.roadAnswered(cp, "up");
  const add = h.api.applyProfile({ ...pf, road: h.api.roadWithDayAdded(up, 4, 5, "2027-02-01", "checkpoint"), daysPerWeek: 5 });
  const facts = h.api.roadNewDayFacts(add.raw);
  assert.deepEqual(facts, { startIso: "2027-02-01", openMin: 20, fullIso: "2027-02-22" });
  assert.match(t, /Your 5th day starts as a 20-minute easy run in the week of 1 Feb and grows a little each week\. From 22 Feb it is a full day of your 5-day plan\./);
  // The harder sessions a five-day plan carries are counted from the two plans, never hand-listed.
  const keep = h.api.applyProfile({ ...pf, road: up });
  const harder = add.raw.weeks.filter((w: any, i: number) => w.stage === "race" && w.qualitySessionCount > keep.raw.weeks[i].qualitySessionCount).length;
  assert.ok(harder > 0, "the fixture no longer has a week with a second harder session — the sentence is untested");
  assert.match(t, new RegExp("A 5-day plan also has a second harder session in " + harder + " weeks of your race block\\."));
  // ⚠️ NEITHER ANSWER IS THE SAFER ONE (no study says a fourth day is), so nothing is marked and nothing says so.
  assert.doesNotMatch(sheet, /Suggested|po-rec/);
  assert.doesNotMatch(t, /\bsafe|\bneed|\bmust\b|injur|\brisk/i, "the days question claims a day is needed or safer");
  assert.match(t, /Either way you move up to your race block on Monday/);
});

test("BLOCKER: Add a day — one commit: the day recorded from the race block's second week, five days, nothing run changed; Undo puts it all back", () => {
  const pf = OWNER();
  const h = harness(IN_BASE, pf);
  const plan0 = h.api.applyProfile(OWNER()).raw.weeks;
  const before = JSON.stringify(pf.road);
  h.api.answerRoad("up", "add");
  assert.equal(pf.daysPerWeek, 5);
  assert.deepEqual(pf.road.daysAdded, [{ fromIso: "2027-02-01", from: 4, to: 5, answeredIso: IN_BASE, via: "checkpoint" }]);
  assert.deepEqual(pf.road.checkpoints.slice(-1)[0], { dueIso: "2027-01-25", kind: "base", answer: "up", answeredIso: IN_BASE, days: "add" });
  assert.ok(h.calls.includes("recompute"));
  assert.equal(h.toasts.slice(-1)[0], "Moving up to your race block, with a 5th day from the week of 1 Feb.");
  // ⚠️ END TO END: the stored road reaches the engine (effectiveRoad passes the day on) — every week before 1 Feb exactly as it
  // was, the new day a 20-minute easy run that week.
  const plan1 = h.RAW.weeks;
  const cut = plan1.findIndex((w: any) => w.startDateIso >= "2027-02-01");
  assert.ok(cut > 9);
  for (let i = 0; i < cut; i++) assert.deepEqual(plan1[i], plan0[i], `week ${i + 1} changed when the day was added`);
  const s = plan1[cut].sessions.find((x: any) => x.newDay);
  assert.ok(s && s.type === "easy" && Math.round(s.estimatedDurationSeconds / 60) === 20, "the new day does not start as a 20-minute easy run");
  // ⚠️ STILL BASE'S LAST WEEK (the race block starts on Monday) — but he has moved up, so his answer is five everywhere it is
  // shown (found in the browser: judged by the week alone it folded back to four, and any profile save that week dropped it).
  assert.equal(h.api.dayRaceBlockNow(), true);
  assert.equal(h.api.dayAnswerOf(pf), 5, "the stored five folds back to four in the checkpoint week");
  assert.equal(h.api.roadDaysEdited(pf.road, 5, "building"), pf.road, "a profile save that week rewrote the day just added");
  assert.match(text(h.api.roadNewDayLine()), /your full 5-day plan from 22 Feb\./);
  // Undo: the road, the days and the question all come back.
  h.undo();
  assert.equal(JSON.stringify(pf.road), before);
  assert.equal(pf.daysPerWeek, 4);
  assert.equal(h.api.roadCheckpoint()?.endIso, "2027-01-25", "the checkpoint did not come back");
});

test("BLOCKER: Keep — moves up with the days as they were, and the no is remembered (and forgotten again on Undo)", () => {
  const pf = OWNER();
  const h = harness(IN_BASE, pf);
  h.api.answerRoad("up", "keep");
  assert.equal(pf.daysPerWeek, 4);
  assert.equal(pf.road.daysAdded, undefined);
  assert.equal(h.store["interun_addday_v1"], IN_BASE, "the no was not remembered");
  assert.equal(pf.road.checkpoints.slice(-1)[0].days, "keep");
  assert.equal(h.toasts.slice(-1)[0], "Moving up to your race block — 4 days a week.");
  h.undo();
  assert.equal(h.store["interun_addday_v1"], undefined, "Undo left the no behind");
  // A day asked for when the evidence has since turned (a run hurt): it moves up, and adds nothing.
  const sore = OWNER();
  const hs = harness(IN_BASE, sore, { facts: { planned: 8, done: 8, painRuns: 1 } });
  hs.api.answerRoad("up", "add");
  assert.equal(sore.daysPerWeek, 4, "a day was added after a run hurt");
  assert.equal(sore.road.daysAdded, undefined);
  assert.equal(sore.road.checkpoints.slice(-1)[0].answer, "up");
});

test("BLOCKER: once the week is in the race block the picker offers up to five — Base, the wizard and a regular runner as they were", () => {
  const raceRoad = ROAD([UP_REBUILD, UP_BASE]);
  const inRace = harness(IN_RACE, OWNER({ road: raceRoad }));
  assert.equal(inRace.api.dayRaceBlockNow(), true);
  assert.deepEqual(inRace.api.dayChoiceOpts({ status: "building" }).map((o: string[]) => o[0]), ["3", "4", "5"]);
  assert.deepEqual(inRace.api.dayChoiceOpts({ status: "new" }).map((o: string[]) => o[0]), ["3", "4", "5"]);
  assert.deepEqual(inRace.api.dayChoiceOpts({ status: "regular" }).map((o: string[]) => o[0]), ["3", "4", "5", "6", "7"]);
  assert.equal(inRace.api.dayAnswerOf({ status: "building", daysPerWeek: 5 }), 5, "the profile row would say 4 over a five-day plan");
  assert.match(text(inRace.api.dayCapNote({ status: "building" })), /Your race block can use up to 5 runs a week\. A day you add starts as a short easy run/);
  // In Base with its checkpoint not yet answered: the beginner track's own answers.
  const inBase = harness(IN_BASE, OWNER());
  assert.equal(inBase.api.dayRaceBlockNow(), false);
  assert.deepEqual(inBase.api.dayChoiceOpts({ status: "building" }).map((o: string[]) => o[0]), ["3", "4"]);
  assert.equal(inBase.api.dayAnswerOf({ status: "building", daysPerWeek: 5 }), 4);
  // Moved up (Base's checkpoint answered, the race block starting on Monday): the race block's answers already.
  assert.deepEqual(harness(IN_BASE, OWNER({ road: raceRoad })).api.dayChoiceOpts({ status: "building" }).map((o: string[]) => o[0]), ["3", "4", "5"]);
  const wiz = harness(IN_RACE, OWNER({ road: raceRoad }), { screen: "wizard" });
  assert.deepEqual(wiz.api.dayChoiceOpts({ status: "building" }).map((o: string[]) => o[0]), ["3", "4"], "a new plan's wizard offered five");
  assert.deepEqual(harness(IN_RACE, OWNER({ road: null })).api.dayChoiceOpts({ status: "building" }).map((o: string[]) => o[0]), ["3", "4"]);
});

test("BLOCKER: a day added from the profile starts short too — from next Monday — and fewer days drop the days added above", () => {
  const raceRoad = ROAD([UP_REBUILD, UP_BASE]);
  const h = harness(IN_RACE, OWNER({ road: raceRoad }));
  const r5 = h.api.roadDaysEdited(raceRoad, 5, "building");
  assert.deepEqual(r5.daysAdded, [{ fromIso: "2027-02-08", from: 4, to: 5, answeredIso: IN_RACE, via: "profile" }],
    "a day picked in the profile did not start short from next Monday");
  const h3 = harness(IN_RACE, OWNER({ road: raceRoad, daysPerWeek: 3 }));
  assert.deepEqual(h3.api.roadDaysEdited(raceRoad, 5, "building").daysAdded.map((a: any) => a.fromIso + ":" + a.from + "→" + a.to),
    ["2027-02-08:3→4", "2027-02-15:4→5"]);
  // Fewer days: the days added above the answer go.
  const added = { ...raceRoad, daysAdded: [{ fromIso: "2027-02-01", from: 4, to: 5 }] };
  const h5 = harness(IN_RACE, OWNER({ road: added, daysPerWeek: 5 }));
  const r4 = h5.api.roadDaysEdited(added, 4, "building");
  assert.equal(r4.daysAdded, undefined);
  assert.equal(h5.api.roadDaysEdited(added, 5, "building"), added, "an edit that left the days alone touched the road");
  // A regular runner's days, or a habit-builder still in Base: the road as it was (their picker is their track's own).
  assert.equal(h.api.roadDaysEdited(raceRoad, 5, "regular"), raceRoad);
  const hb = harness(IN_BASE, OWNER());
  assert.equal(hb.api.roadDaysEdited(ROAD(), 5, "building").daysAdded, undefined);
  // And it is draftFromForm's road (restated in road-app).
  assert.match(decomment(fnBody("draftFromForm")), /profile\.road \? roadDaysEdited\(profile\.road, Number\(draft\.days\), status\) : null/);
});

test("BLOCKER: the weekly review judges a race-block week on the track it is built on, and a day it adds starts short", () => {
  const raceRoad = ROAD([UP_REBUILD, UP_BASE]);
  // His 25 weeks from 23 Nov, four runs each; every run done in the three weeks before this one.
  const mondays = Array.from({ length: 25 }, (_, i) => day("2026-11-23", 7 * i));
  const runs = mondays.slice(0, 12).flatMap((m, w) => [1, 2, 4, 6].map((d) => ({ id: "r" + w + d, dateIso: day(m, d) })));
  // A habit-builder not back from injury (the review keeps its own refusal for that — checked below).
  const mk = (today: string, o: { status?: string; road?: any; logged?: unknown[]; returning?: string } = {}) => {
    const pf = OWNER({ road: o.road ?? raceRoad, status: o.status ?? "building", returning: o.returning ?? "" });
    const cw = mondays.findIndex((m) => m <= today && today < day(m, 7));
    const h = harness(today, pf, { logged: o.logged ?? runs, currentWeek: cw });
    h.PLAN.weeks = mondays.map((m) => ({ startIso: m }));
    h.RAW.weeks = mondays.map(() => ({ sessions: [1, 2, 4, 6].map((d) => ({ type: "easy", dayOfWeek: d })) }));
    return { h, pf };
  };
  // In the race block (its fourth week): judged as the main track it is built on, up to five, the day starting short.
  const race = mk("2027-02-17");
  const ev = race.h.api.addDayEvidence("build");
  assert.equal(ev.experience, "recreational", "a race-block week was judged by the status card");
  assert.equal(ev.maxDays, 5);
  assert.equal(ev.startsShort, true);
  assert.equal(ev.painFlagged, false);
  const offer = RC.addDayOffer(ev);
  assert.equal(offer?.kind, "add-a-day");
  assert.equal((offer as any).to, 5);
  assert.match(offer!.why, /starts as a short easy run and grows a little each week/);
  // In Base the week is the beginner track's: refused, exactly as before.
  const base = mk(IN_BASE, { road: ROAD() });
  const bev = base.h.api.addDayEvidence("base");
  assert.equal(bev.experience, "beginner");
  assert.equal(RC.addDayOffer(bev), null, "a Base week offered a day");
  // A run they said hurt in the weeks it covers: no offer.
  const sore = mk("2027-02-17", { logged: runs.map((r, i) => (i === runs.length - 2 ? { ...r, pain: true } : r)) });
  assert.equal(sore.h.api.addDayEvidence("build").painFlagged, true);
  assert.equal(RC.addDayOffer(sore.h.api.addDayEvidence("build")), null, "asked a runner whose run hurt to run more");
  // ⚠️ A regular runner's offer is exactly as it was: the pain refusal for them is the owner's to decide (pc-days-regular-short).
  const soreReg = mk("2027-02-17", { status: "regular", logged: runs.map((r, i) => (i === runs.length - 2 ? { ...r, pain: true } : r)) });
  assert.equal(soreReg.h.api.addDayEvidence("build").painFlagged, false, "a regular runner's offer changed without his say-so");
  // The review's own gates are kept: somebody back from injury is not asked by it (the checkpoint may ask them, on its evidence).
  assert.equal(RC.addDayOffer(mk("2027-02-17", { returning: "injury" }).h.api.addDayEvidence("build")), null);
  // A day added on the road two weeks ago: it is still settling in.
  const added = mk("2027-02-17", { road: { ...raceRoad, daysAdded: [{ fromIso: "2027-02-01", from: 3, to: 4, answeredIso: "2027-01-20" }] } });
  assert.equal(added.h.api.addDayEvidence("build").lastAddedIso, "2027-01-20");
  // In the days after "Move up" (Base's last week), a day from the profile waits for the race block's SECOND week — never on top
  // of its opening step — and so does the review's.
  const moved = harness(IN_BASE, OWNER({ road: raceRoad, returning: "" }));
  assert.equal(moved.api.roadDaysEdited(raceRoad, 5, "building").daysAdded[0].fromIso, "2027-02-01", "a day from the profile landed on the race block's first week");
  // Accepting: the day recorded on the road from next Monday, the days five — the week in hand untouched.
  race.h.review = { suggestion: offer };
  race.h.api.applyAddDay();
  assert.equal(race.pf.daysPerWeek, 5);
  assert.deepEqual(race.pf.road.daysAdded, [{ fromIso: "2027-02-22", from: 4, to: 5, answeredIso: "2027-02-17", via: "review" }]);
  assert.ok(race.h.calls.includes("recompute") && race.h.calls.includes("dismiss"));
  // A regular runner's accept is the plan rebuilt for the new days, exactly as before — no record.
  const reg = mk("2027-02-17", { status: "regular" });
  reg.h.review = { suggestion: { kind: "add-a-day", from: 4, to: 5, why: "" } };
  reg.h.api.applyAddDay();
  assert.equal(reg.pf.daysPerWeek, 5);
  assert.equal(reg.pf.road.daysAdded, undefined, "a regular runner's day was phased in without the owner's say-so");
});

test("the Plan screen says when the new day starts and when the full plan begins — read off the plan, gone once it is in", () => {
  const pf = OWNER({ road: ROAD([UP_REBUILD, { ...UP_BASE, days: "add" }], { daysAdded: [{ fromIso: "2027-02-01", from: 4, to: 5 }] }), daysPerWeek: 5 });
  const h = harness(IN_RACE, pf);
  h.RAW.weeks = h.api.applyProfile(pf).raw.weeks;
  assert.equal(text(h.api.roadNewDayLine()),
    "Your new running day: a 20-minute easy run from the week of 1 Feb, a little longer each week — your full 5-day plan from 22 Feb.");
  h.clock.today = "2027-02-24";
  assert.equal(h.api.roadNewDayLine(), "", "the line stayed after the day was fully in");
  // And the road card carries it.
  assert.match(decomment(fnBody("roadPlanCard")), /roadTimelineHtml\(legs, here\) \+ cpLine \+ roadNewDayLine\(\)/);
});
