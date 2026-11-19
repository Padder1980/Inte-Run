// STAGES.md §10 PIECE 4 IN THE APP — GOALS WITHOUT A RACE (the owner, 2026-11-19: "Yes, all your picks"): the wizard asks
// "Are you training for a race?" (adults only); with no race there is one question, the distance to be fit for, and no date
// and no target. The plan is its road, laid out a block at a time — the block in hand plus the next — held at a checkpoint
// nobody has answered, and every answer takes nothing from what follows. Weeks already laid out never change.
// The engine half is test/road-norace.test.ts. These lift the real functions out of the built page, over the real engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const html = readFileSync(PAGE, "utf8");
const at0 = html.indexOf("function noRaceRoadNow(");
assert.ok(at0 >= 0, "noRaceRoadNow is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));
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
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const isoAdd = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; };
const FROM = "2026-11-23"; // a Monday: the road's first week
const ATH = { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 2250 }, experience: "beginner", runWalk: false,
  includeStrength: true, longRunDay: 6 } as any;

// ---- 1. The road model: held, laid out a block ahead, answered ------------------------------------------------------
const ROAD_FNS = ["roadOf", "roadWeeksBetween", "roadMondayAfter", "roadAnswerAt", "effectiveRoad", "noRaceRoadNow", "planStartIso",
  "noRaceShifted", "noRaceRoadFrom",
  "roadAthleteOf", "roadLegsNow", "roadCheckpoint", "roadAnswered", "roadRaceWeeks", "weekMondayOf", "roadWalkRun",
  "roadMergeRace", "roadSplitRace"];
function harness(today: string, road: unknown, noRace = true, startIso = "") {
  const clock = { today };
  const profile: any = { personalized: true, status: "building", goalDist: "10k", raceDate: noRace ? "" : "2027-05-16", road };
  if (startIso) profile.startDateIso = startIso;
  if (noRace) profile.noRace = true;
  const env: Record<string, unknown> = {
    RC, profile, todayIso: () => clock.today, isoAdd,
    experienceFor: (p: any) => (p.status === "building" || p.status === "new" ? "beginner" : "recreational"),
  };
  const src = [constStmt("ROAD_STAGE_LABEL"), constStmt("ROAD_MIN_RACE_WEEKS"), ...ROAD_FNS.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + ROAD_FNS.join(", ") + " };")(...names.map((n) => env[n]));
  return { api, clock, profile };
}
const RAMP = RC.roadNoRaceFor(ATH, { distance: "10k", targetTimeSeconds: 4000, raceDateIso: FROM, startDateIso: FROM } as any, FROM)!.rampWeeks;
const ROAD = (checkpoints: unknown[] = [], stages = [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }]) =>
  ({ v: 1, noRace: true, fromIso: FROM, stages, rampWeeks: RAMP, checkpoints });
const kinds = (r: any) => r.stages.map((s: any) => s.kind[0] + s.weeks).join(" ");
const eff = (today: string, road: unknown, startIso = "") => { const h = harness(today, road, true, startIso); return h.api.effectiveRoad(h.profile, ATH, {}); };
const UP_REBUILD = { dueIso: addDays(FROM, 28), kind: "rebuild", answer: "up" };

test("BLOCKER: a road with no race is the block in hand plus the next — held at a checkpoint nobody answered, never promoted", () => {
  assert.equal(kinds(eff(addDays(FROM, 2), ROAD())), "r4 b4", "week 1: Rebuild and the Base after it");
  assert.equal(kinds(eff(addDays(FROM, 23), ROAD())), "r4 b4", "Rebuild's last week");
  // Its Monday has come with no answer: the runner stays in Rebuild, and Base keeps all four of its weeks, a week later.
  assert.equal(kinds(eff(addDays(FROM, 30), ROAD())), "r5 b4", "moved into Base without choosing to — or Base was cut");
  assert.equal(kinds(eff(addDays(FROM, 44), ROAD())), "r7 b4");
  // Answered "up": Base begins as laid, and the next Base block is laid out behind it — one block past this one, no more.
  assert.equal(kinds(eff(addDays(FROM, 30), ROAD([UP_REBUILD]))), "r4 b4 b4");
  const upBase = { dueIso: addDays(FROM, 56), kind: "base", answer: "up" };
  assert.equal(kinds(eff(addDays(FROM, 58), ROAD([UP_REBUILD, upBase]))), "r4 b4 b4 b4");
  // A year on, answered every time: still the block in hand plus the next.
  const cps = [UP_REBUILD];
  for (let k = 0; k < 13; k++) cps.push({ dueIso: addDays(FROM, 56 + 28 * k), kind: "base", answer: "up" });
  const yr = eff(addDays(FROM, 365), ROAD(cps));
  const total = yr.stages.reduce((n: number, s: any) => n + s.weeks, 0);
  assert.ok(total * 7 > 365 && total * 7 <= 365 + 7 * 8 + 7, `a year on, the road reaches ${total} weeks`);
  assert.equal(yr.noRace, true);
  assert.equal(yr.fromIso, FROM);
  assert.equal(yr.rampWeeks, RAMP, "the ramp is the one stored when the road was made");
});

test("BLOCKER: every block ends in a checkpoint, once — and the answers take nothing from what follows", () => {
  const cp = harness(addDays(FROM, 23), ROAD()).api.roadCheckpoint();
  assert.equal(cp && cp.kind + "→" + cp.endIso, "rebuild→" + addDays(FROM, 28));
  assert.equal(harness(addDays(FROM, 16), ROAD()).api.roadCheckpoint(), null, "shown before the block's last week");
  assert.equal(harness(addDays(FROM, 23), ROAD([UP_REBUILD])).api.roadCheckpoint(), null, "asked again after it was answered");
  // A Base block with no race ends in one too — it is the next block's question, not race day's.
  const b = harness(addDays(FROM, 52), ROAD([UP_REBUILD])).api.roadCheckpoint();
  assert.equal(b && b.kind + "→" + b.endIso, "base→" + addDays(FROM, 56));
  assert.equal(b.next && b.next.kind, "base");
  const h = harness(addDays(FROM, 23), ROAD());
  const c = h.api.roadCheckpoint();
  const up = h.api.roadAnswered(c, "up");
  assert.equal(kinds(up), "r4 b4");
  assert.deepEqual(up.checkpoints.map((x: any) => x.answer + "@" + x.dueIso), ["up@" + addDays(FROM, 28)]);
  assert.equal(up.noRace, true);
  // One more week, or easing back: this block a week longer, and Base still four weeks — a week later, never shorter.
  assert.equal(kinds(h.api.roadAnswered(c, "more")), "r5 b4", "one more week was taken from what follows");
  assert.equal(kinds(h.api.roadAnswered(c, "ease")), "r5 b4", "easing back was taken from what follows");
  // And answered, the runner is in that week, then asked again at its end.
  const more = h.api.roadAnswered(c, "more");
  assert.equal(kinds(eff(addDays(FROM, 30), more)), "r5 b4");
  const again = harness(addDays(FROM, 30), more).api.roadCheckpoint();
  assert.equal(again && again.kind + "→" + again.endIso, "rebuild→" + addDays(FROM, 35));
});

test("BLOCKER: a road with no race is only ever the road of a plan with no race, and a race road never of one", () => {
  assert.equal(harness(addDays(FROM, 2), ROAD(), false).api.roadOf(harness(addDays(FROM, 2), ROAD(), false).profile), null,
    "a race plan picked up a road with no race");
  const raceRoad = { v: 1, fromIso: FROM, stages: [{ kind: "rebuild", weeks: 4 }, { kind: "race", weeks: 16 }], rampWeeks: 4, checkpoints: [] };
  const h = harness(addDays(FROM, 2), raceRoad, true);
  assert.equal(h.api.roadOf(h.profile), null, "a plan with no race picked up a race road");
  const withRace = harness(addDays(FROM, 2), { ...ROAD(), stages: [{ kind: "base", weeks: 4 }, { kind: "race", weeks: 8 }] });
  assert.equal(withRace.api.roadOf(withRace.profile), null, "a road with no race carried a race block");
  // A road with no race needs no race date to be read.
  const ok = harness(addDays(FROM, 2), ROAD());
  assert.equal(ok.profile.raceDate, "");
  assert.equal(ok.api.roadLegsNow(ok.profile).length, 2);
  // 12–17: no road at all.
  assert.equal(ok.api.effectiveRoad(ok.profile, { ...ATH, age: 15 }, {}), null);
});

test("BLOCKER: the road always reaches a block past the plan's own start — a start moved on, a pause", () => {
  // The independent review: counted from this week alone, a plan starting eight weeks on laid out no week from its start,
  // and the app could not draw Today at launch.
  const total = (r: any) => r.stages.reduce((n: number, s: any) => n + s.weeks, 0);
  for (const start of [addDays(FROM, 10), addDays(FROM, 8 * 7), addDays(FROM, 20 * 7 + 3)]) {
    const r = eff(addDays(FROM, 2), ROAD(), start);
    const end = addDays(FROM, total(r) * 7);
    const startMon = addDays(start, -((new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7));
    assert.ok(end >= addDays(startMon, 4 * 7 + 7), `a start on ${start}: the road ends ${end}, not a full block past it`);
    // And through the real engine there are weeks from the start on, the first of them the start's own week.
    const goal = { distance: "10k", targetTimeSeconds: 4000, startDateIso: start, raceDateIso: addDays(FROM, total(r) * 7 - 1) } as any;
    const p = RC.generatePlan(ATH, goal, { road: r });
    assert.ok(p.weeks.length >= 4, `a start on ${start}: ${p.weeks.length} weeks laid out`);
    assert.equal(p.weeks[0]!.startDateIso, start, `a start on ${start}: the plan opens on ${p.weeks[0]!.startDateIso}`);
  }
});

test("a pick-up moves the road and its answers together, and back again; a road not begun starts on the day it is started", () => {
  const h = harness(addDays(FROM, 2), ROAD([UP_REBUILD]));
  const r = ROAD([UP_REBUILD]);
  const on = h.api.noRaceShifted(r, 3);
  assert.equal(on.fromIso, addDays(FROM, 21));
  assert.deepEqual(on.checkpoints.map((c: any) => c.dueIso), [addDays(UP_REBUILD.dueIso, 21)]);
  assert.deepEqual(h.api.noRaceShifted(on, -3), r, "coming back early did not move the road back");
  assert.equal(h.api.noRaceShifted(r, 0), r);
  // Not begun and unanswered: started today, it starts this week. Begun, or answered: it keeps its weeks.
  const later = { ...ROAD(), fromIso: addDays(FROM, 28) };
  assert.equal(h.api.noRaceRoadFrom(later, addDays(FROM, 2)).fromIso, FROM);
  assert.equal(h.api.noRaceRoadFrom(ROAD([UP_REBUILD]), addDays(FROM, 2)).fromIso, FROM);
  assert.equal(h.api.noRaceRoadFrom({ ...later, checkpoints: [UP_REBUILD] }, addDays(FROM, 2)).fromIso, addDays(FROM, 28));
});

test("BLOCKER: through the real engine, the weeks already laid out never change — the road growing, a checkpoint answered, a hold", () => {
  const goalFor = (road: any) => ({ distance: "10k", targetTimeSeconds: 4000, startDateIso: FROM,
    raceDateIso: addDays(road.fromIso, road.stages.reduce((n: number, s: any) => n + s.weeks, 0) * 7 - 1) }) as any;
  const plan = (road: any) => RC.generatePlan(ATH, goalFor(road), { road });
  const weekOne = eff(addDays(FROM, 2), ROAD());
  const before = plan(weekOne);
  assert.equal(before.weeks.length, 8);
  const h = harness(addDays(FROM, 23), ROAD());
  const cp = h.api.roadCheckpoint();
  for (const choice of ["up", "more", "ease"]) {
    const after = plan(eff(addDays(FROM, 30), h.api.roadAnswered(cp, choice)));
    // Every week up to the checkpoint's Monday is the week it was; "up" leaves the next block as laid, too.
    const same = choice === "up" ? 8 : 4;
    for (let i = 0; i < same; i++) assert.deepEqual(after.weeks[i], before.weeks[i], `"${choice}": week ${i + 1} changed`);
  }
  const held = plan(eff(addDays(FROM, 30), ROAD()));
  for (let i = 0; i < 4; i++) assert.deepEqual(held.weeks[i], before.weeks[i], `held: week ${i + 1} changed`);
  assert.equal(held.weeks[4]!.stage, "rebuild", "the held week is not a Rebuild week");
  // A year of blocks: the first eight weeks are still the ones laid out on the first day.
  const cps = [UP_REBUILD];
  for (let k = 0; k < 13; k++) cps.push({ dueIso: addDays(FROM, 56 + 28 * k), kind: "base", answer: "up" });
  const yr = plan(eff(addDays(FROM, 365), ROAD(cps)));
  for (let i = 0; i < 8; i++) assert.deepEqual(yr.weeks[i], before.weeks[i], `a year on, week ${i + 1} changed`);
  assert.ok(!yr.weeks.some((w: any) => w.sessions.some((s: any) => s.type === "race")), "a race appeared");
});

// ---- 2. The profile: applyProfile, the setup form, the wizard's checks, the Plan screen's header -------------------
const APP_FNS = ["applyProfile", "planStartIso", "blockStartIso", "holdBeforeStart", "firstShownWeek", "returnKind",
  "experienceFor", "resolvedStatus", "trainingYearsFor", "typeCeilingFor", "isNoRace", "noRaceGoalRoad", ...ROAD_FNS,
  "wizFieldVal", "draftFromForm", "formStartIso", "isBeginnerStatus", "goalsForAge", "currentAgeAnswer", "derivedGoalS",
  "goalNoRaceNow", "goalKindAsked", "wizStepError", "goalCardInner", "seg", "planHeadHtml", "targetChosen", "esc",
  "roadProposalFor", "roadFromProposal", "noRaceShifted", "noRaceRoadFrom", "alfieRaceFacts", "planName"];
const APP_CONSTS = ["ROAD_STAGE_LABEL", "ROAD_MIN_RACE_WEEKS", "ADJ_QUALITY", "GOAL_BY_STATUS", "RACE_LABEL", "FINISH_LABEL"];
const TODAY = "2026-11-25";
function app(pf: Record<string, any>, screen = "setup", draftIn: Record<string, any> = {}) {
  const els: Record<string, any> = {};
  const $ = (id: string) => els[id] ?? null;
  const put = (id: string, value = "") => (els[id] = { id, value });
  const profile: any = { status: "building", goalDist: "10k", targetS: 4000, targetSet: false, raceDate: "", startDateIso: FROM,
    longRunDay: 6, recentTimeS: 2250, noRecent: true, twoKmS: 0, daysPerWeek: 4, volKm: 0, strength: true, returning: "",
    age: 40, bRace: null, personalized: true, fitSrc: "beginner", recentDistM: 5000, easyPaceS: 0, autoPace: true, ...pf };
  const draft: any = { status: profile.status, days: String(profile.daysPerWeek), __f: {}, ...draftIn };
  const state: any = { screen };
  const PLAN: any = { goal: { race: "10 km", target: "1:06:40", raceDate: "Sun 17 Jan" }, weeks: [{ index: 3, distanceKm: 14.2 }],
    paces: { easy: "7:10–7:40/km", goal: "6:40/km" }, feasibility: { verdict: "achievable" }, summary: { structuredWeeks: 8, peakKm: 15 } };
  const env: Record<string, unknown> = {
    RC, profile, draft, state, $, PLAN, CURRENT_WEEK: 0, todayIso: () => TODAY, isoAdd,
    strengthPrefsOf: () => null, progActive: () => false, strMinVal: () => 30, strLevelVal: () => "beginner",
    strGoalVal: () => "general", kitFromField: () => [], kitToField: () => "-", strengthKitOf: () => [],
    planActionsHtml: () => "", feasibilityWhy: () => '<div class="feas-why">why</div>', wizSafetyAnswered: () => true,
  };
  const src = APP_CONSTS.map(constStmt).join("\n") + "\n" + APP_FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn {" + APP_FNS.join(",") + "};")(...names.map((n) => env[n]));
  return { api, profile, draft, state, put, PLAN };
}
const NO_RACE_ROAD = (stages = [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }]) =>
  ({ v: 1, noRace: true, fromIso: FROM, stages, rampWeeks: RAMP, checkpoints: [] });

test("BLOCKER: a plan with no race builds — with its road or before one is stored — and never as a race", () => {
  for (const road of [NO_RACE_ROAD(), null]) {
    const a = app({ noRace: true, road });
    let out: any;
    assert.doesNotThrow(() => { out = a.api.applyProfile(a.profile); }, "a plan with no race threw — the launch would fall back to the example plan");
    assert.equal(out.goal.raceDateIso, addDays(FROM, 8 * 7 - 1), "the goal's date is not where the weeks laid out end");
    assert.equal(out.plan.goal.noRace, true, "the summary does not say the plan has no race");
    assert.equal(out.raw.weeks.length, 8);
    assert.ok(!out.raw.weeks.some((w: any) => w.sessions.some((s: any) => s.type === "race")), "a race day appeared");
    assert.equal(out.raw.weeks[0].stage, "rebuild");
  }
  // A B-race never reaches a plan with no race.
  const b = app({ noRace: true, road: NO_RACE_ROAD(), bRace: { distance: "5k", dateIso: addDays(FROM, 33) } });
  assert.ok(!b.api.applyProfile(b.profile).raw.weeks.some((w: any) => w.secondaryRace), "a B-race shaped a plan with no race");
  // 12–17: refused, before anything is built.
  const y = app({ noRace: true, road: null, age: 15 });
  assert.throws(() => y.api.applyProfile(y.profile), /18 and over/);
  // A race plan carrying a road with no race builds as the race plan it is.
  const r = app({ road: NO_RACE_ROAD(), raceDate: "2027-05-16", targetSet: true });
  const rp = r.api.applyProfile(r.profile);
  assert.equal(rp.goal.raceDateIso, "2027-05-16");
  assert.ok(rp.raw.weeks[rp.raw.weeks.length - 1].sessions.some((s: any) => s.type === "race"));
});

test("BLOCKER: plan setup — no race asks no date and no time, saves no target and no B-race; never for a 12–17 runner", () => {
  // The wizard, "No race — keep getting fitter".
  const w = app({ personalized: true }, "wizard", { goalkind: "norace" });
  w.put("s_dist", "10k"); w.put("s_longday", "6"); w.put("s_startdate", TODAY); w.put("s_age", "40");
  const pf = w.api.draftFromForm();
  assert.equal(pf.noRace, true);
  assert.equal(pf.raceDate, "", "a race date was saved for a plan with no race");
  assert.equal(pf.targetSet, false, "a target was saved as the runner's");
  assert.ok(pf.targetS > 0, "the engine was left without a target to build paces from");
  assert.equal(pf.bRace, null);
  assert.equal(pf.road, null, "the wizard inherited the old road");
  assert.equal(w.api.wizStepError("goal"), null, "the goal step asked a plan with no race for a date or a time");
  // The card asks first, and with no race has one question.
  const card = w.api.goalCardInner("building", { dist: "10k", noRace: true, askKind: true });
  assert.match(card, /Are you training for a race\?/);
  assert.match(card, /data-v="norace" class="on"/);
  assert.match(card, /The distance you want to be fit for/);
  assert.ok(!/id="s_date"|id="s_target"/.test(card), "a plan with no race was asked for a date or a time");
  // A race card drawn the way it always was: no question, the date and the time.
  const race = w.api.goalCardInner("regular", { dist: "10k", date: "2027-05-16", target: "50:00" });
  assert.ok(!/goalkind/.test(race) && /id="s_date"/.test(race) && /id="s_target"/.test(race));
  // 12–17 in the wizard: never asked, and the plan is the race plan the goal step showed (it needs its date).
  const yw = app({ personalized: true }, "wizard", { goalkind: "norace" });
  yw.put("s_dist", "5k"); yw.put("s_age", "15");
  assert.equal(yw.api.goalKindAsked(), false, "a 15-year-old was asked");
  assert.equal(yw.api.goalNoRaceNow(), false, "a 15-year-old's goal step drew the card with no date");
  assert.throws(() => yw.api.draftFromForm(), /date/, "a 15-year-old was given a plan with no race");
  // The profile form of a plan with no race keeps it, and — the start left as it is — its road exactly, answers and all…
  const begun = { ...NO_RACE_ROAD(), fromIso: "2026-11-02", checkpoints: [{ dueIso: "2026-11-30", kind: "rebuild", answer: "up" }] };
  const e = app({ noRace: true, road: begun, startDateIso: "2026-11-02" }, "setup");
  e.put("s_dist", "5k"); e.put("s_longday", "5"); e.put("s_startdate", "2026-11-02"); e.put("s_age", "40");
  const ed = e.api.draftFromForm();
  assert.equal(ed.noRace, true);
  assert.deepEqual(ed.road, begun, "an edit that left the start as it is dropped or moved the road");
  assert.equal(ed.goalDist, "5k");
  // …and a NEW START is a new road from the new start's week (the review: the old road was kept and, eight weeks on, laid out
  // no week at all) — the first two blocks, no answers, and a plan with weeks in it.
  for (const start of ["2026-12-02", "2027-03-01"]) {
    const m = app({ noRace: true, road: begun, startDateIso: "2026-11-02" }, "setup");
    m.put("s_dist", "10k"); m.put("s_startdate", start); m.put("s_age", "40");
    const md = m.api.draftFromForm();
    const mon = addDays(start, -((new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7));
    assert.equal(md.road.fromIso, mon, `a start moved to ${start} kept the old road`);
    assert.deepEqual(md.road.checkpoints, []);
    assert.ok(m.api.applyProfile(md).raw.weeks.length >= 4, `a start moved to ${start} built a plan with no weeks`);
  }
  // …refuses an age that makes them 12–17, before anything is saved…
  const ey = app({ noRace: true, road: NO_RACE_ROAD() }, "setup");
  ey.put("s_dist", "5k"); ey.put("s_age", "15");
  assert.throws(() => ey.api.draftFromForm(), /18 and over/);
  // (A plan that has not begun, its start brought forward, is the same: a new road from the new start's week.)
  const later = { ...NO_RACE_ROAD(), fromIso: "2027-01-04" };
  const f = app({ noRace: true, road: later, startDateIso: "2027-01-06" }, "setup");
  f.put("s_dist", "10k"); f.put("s_startdate", "2026-12-02"); f.put("s_age", "40");
  assert.equal(f.api.draftFromForm().road.fromIso, "2026-11-30");
});

test("found on the way: 'Building the habit' can leave its OPTIONAL time blank", () => {
  const b = app({ personalized: true }, "wizard", { status: "building", goalkind: "race" });
  b.put("s_date", "2027-05-16");
  b.put("s_target", "");
  assert.equal(b.api.wizStepError("goal"), null, "a blank OPTIONAL time was refused");
  b.put("s_target", "soon");
  assert.match(b.api.wizStepError("goal"), /or leave it blank/);
  const r = app({ status: "regular", personalized: true }, "wizard", { status: "regular", goalkind: "race" });
  r.put("s_date", "2027-05-16");
  r.put("s_target", "");
  assert.match(r.api.wizStepError("goal"), /target time/, "a regular runner's time became optional");
});

test("BLOCKER: the Plan screen's header — no race, date, target or verdict on a plan with no race; no worked-out time as a goal", () => {
  const n = app({ noRace: true });
  n.PLAN.goal.noRace = true;
  const h = n.api.planHeadHtml(n.PLAN.goal, n.PLAN.summary);
  assert.match(h, /Keep getting fitter · 10 km/);
  assert.match(h, /No race · laid out a block at a time/);
  for (const bad of [/Sun 17 Jan/, /1:06:40/, /achievable/, /feas-why/, /Goal pace/, /Peak\/wk/, /-week plan/])
    assert.ok(!bad.test(h), `a plan with no race shows ${bad}`);
  // A habit-builder who left the time blank: the plan says what it is for, with no verdict on a time nobody set.
  const b = app({ status: "building", targetSet: false, raceDate: "2027-05-16" });
  const bh = b.api.planHeadHtml(b.PLAN.goal, b.PLAN.summary);
  assert.match(bh, /Complete a 10K/);
  assert.ok(!/1:06:40|achievable|feas-why|Goal pace/.test(bh), "a worked-out time was shown as the runner's goal");
  // A runner who set one keeps all of it.
  const r = app({ status: "regular", targetSet: true, raceDate: "2027-05-16" });
  const rh = r.api.planHeadHtml(r.PLAN.goal, r.PLAN.summary);
  for (const want of [/10 km · 1:06:40/, /achievable/, /feas-why/, /Goal pace/]) assert.match(rh, want);
});

test("Alfie and the plan's name say what a plan with no race is", () => {
  const n = app({ noRace: true, goalDist: "half" });
  const f = n.api.alfieRaceFacts();
  assert.equal(f.noRace, true);
  assert.equal(f.race, "No race: getting fitter for Half marathon");
  for (const k of ["target", "date", "daysAway", "weeksAway"]) assert.equal(f[k], null, `Alfie was given a ${k}`);
  assert.equal(n.api.planName({ goal: "half", prof: { noRace: true } }), "Half marathon fitness plan");
  const r = app({ raceDate: "2027-05-16", targetSet: true, goalDist: "half" });
  assert.notEqual(r.api.alfieRaceFacts().noRace, true);
  assert.equal(r.api.planName({ goal: "half", prof: {} }), "Half marathon plan");
  // The checkpoint answer is asked for by "checkpoint" — never by "road", which took "my road race" from a race plan.
  assert.match(SRC, /\{ k: \["checkpoint", "next block"\], a: \(\) => alfieCheckpointAnswer\(\) \}/);
});

test("every screen that reads the race asks first whether there is one", () => {
  // The inventory's readers (notes/plan-profile.md, §10 piece 4): each one handles a plan with no race. A reader that stops
  // asking is the "says something untrue" class this piece exists to close.
  const readers = ["viewPlan", "planHeadHtml", "weekList", "managePlanHtml", "alfieRaceFacts", "alfiePlanContext",
    "pauseChanges", "pausePlanHtml", "applyPause", "realignPickup", "realignOptions", "adoptProf",
    "planStartSheet", "profPlanStatus", "commProfile", "planName", "planFinished", "queueCard", "roadPlanCard", "roadCheckpointHtml", "wizRoadHtml",
    "draftFromForm", "applyProfile", "roadOf", "effectiveRoad", "roadLegsNow", "roadAnswered", "answerRoad", "roadStageJob",
    // found by the independent review, 2026-11-19
    "resumeFromPause", "endRecovery", "briefingFacts", "commJournals", "commJournalSheetHtml", "hardQHtml", "syncHardQ",
    "longMaxQHtml", "easeWeekSheetHtml", "renderAdjustSheet", "alfieIntents", "wizBody"];
  // The rename sheet's "leave it blank to go back to…" names the plan's own default (planName knows a plan with no race).
  assert.match(decomment(fnBody("openRenameSheet")), /planName\(\{ goal: goal, prof: j\.prof \}\)/);
  for (const r of readers) assert.match(decomment(fnBody(r)), /noRace|isNoRace|NoRace/, `${r} never asks whether there is a race`);
  // A pause, a lapse picked up, a stored plan started, coming back early and a recovery week cut short move or replace a
  // plan's road, so each keeps it before the change AND puts it back on Undo (the review: only the first half was checked).
  for (const f of ["applyPause", "answerRealign", "adoptSnapshot", "resumeFromPause", "endRecovery"])
    assert.match(decomment(fnBody(f)), /road: JSON\.stringify\(profile\.road \|\| null\)/, `${f} does not keep the road before changing it`);
  for (const f of ["applyPause", "answerRealign", "adoptRestore", "resumeFromPause", "endRecovery"])
    assert.match(decomment(fnBody(f)), /profile\.road = JSON\.parse\((before|beforeProf|snap)\.road\)/, `${f}'s Undo does not put the road back`);
  // A briefing never says "week 3 of 8" of a plan with no race.
  assert.match(decomment(fnBody("briefingFacts")), /\(profile\.noRace === true\) \? \{\} : \{ of: PLAN\.weeks\.length \}/);
  // A week-move into the last week is refused only where that week holds the race (xwRaceIso), never by position.
  assert.match(decomment(fnBody("xwRefusal")), /\(ti === last \|\| home === last\) && xwRaceIso\(\)\) return "race";/,
    "the last week refuses week-moves by position again — a plan with no race ends on an ordinary week");
  // The weekly review counts a plan with no race as open-ended (it has no end, only the weeks laid out so far).
  assert.match(decomment(SRC), /weeksRemaining: \(profile\.noRace === true\) \? 52 :/);
  // And Alfie's chip for a plan with no race has an answer behind it.
  const chip = /"When is my next checkpoint\?"/.test(SRC);
  assert.ok(chip && /k: \["checkpoint", "next block"\]/.test(SRC), "the checkpoint chip has no answer behind it");
});
