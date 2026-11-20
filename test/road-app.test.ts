// STAGE B14 IN THE APP — the stored road, the hold at a checkpoint not yet answered, and the three answers
// (STAGES.md §8 steps 2 and 4). Lifted from the BUILT page over the real engine, never re-implemented here.
//   * profile.road is stored data: the stages, each checkpoint's Monday and the runner's answer;
//   * decision 2 — moving up only through a checkpoint the runner accepts: unanswered, the runner is HELD;
//   * one answer per checkpoint, never daily: the card shows in a stage's last week and not after an answer;
//   * "one more week" and "ease back" change only the weeks from the checkpoint on.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const html = readFileSync(PAGE, "utf8");
const at0 = html.indexOf("function effectiveRoad(");
assert.ok(at0 >= 0, "effectiveRoad is not in the build — run node web/app.ts");
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
/** A top-level const, lifted whole (to its closing semicolon at the end of a line). */
function constDecl(name: string): string {
  const at = SRC.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "no const " + name + " in the build");
  return SRC.slice(at, SRC.indexOf(";\n", at) + 1);
}
const decomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const FROM = "2026-11-23"; // the owner's road starts on this Monday

function harness(today: string, road: unknown) {
  const clock = { today };
  const profile: any = { personalized: true, status: "building", returning: "injury", raceDate: "2027-05-16", goalDist: "half", road };
  const env: Record<string, unknown> = {
    RC, profile, todayIso: () => clock.today,
    isoAdd: (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; },
    experienceFor: (p: any) => (p.status === "building" || p.status === "new" ? "beginner" : "recreational"),
  };
  const fns = ["roadOf", "roadWeeksBetween", "roadMondayAfter", "roadAnswerAt", "effectiveRoad", "roadAthleteOf", "roadLegsNow",
    "roadCheckpoint", "roadAnswered", "roadRaceWeeks", "weekMondayOf", "roadWalkRun", "roadMergeRace", "roadSplitRace"];
  const src = [constDecl("ROAD_STAGE_LABEL"), constDecl("ROAD_MIN_RACE_WEEKS"), ...fns.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + fns.join(", ") + " };")(...names.map((n) => env[n]));
  return { api, clock, profile };
}
const ROAD = (checkpoints: unknown[] = [], stages = [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 5 }, { kind: "race", weeks: 16 }]) =>
  ({ v: 1, fromIso: FROM, stages, rampWeeks: 9, checkpoints });
// §10 piece 3: the race block's blocks of four (each ending in a checkpoint) read as ONE block here — these guards are about
// the race block's length; test/road-regular-app.test.ts guards where it is cut.
const raceAsOne = (stages: any[]) => stages.reduce((out: any[], s: any) => {
  const l = out[out.length - 1];
  if (l && l.kind === "race" && s.kind === "race") l.weeks += s.weeks; else out.push({ ...s });
  return out;
}, []);
const kinds = (r: any) => raceAsOne(r.stages).map((s: any) => s.kind[0] + s.weeks).join(" ");
const ATH = { experience: "beginner", runWalk: false };
const GOAL = { raceDateIso: "2027-05-16" };

test("BLOCKER: a checkpoint not yet answered holds the runner in the stage they are in — never promoted", () => {
  // In Rebuild's last week (from 14 Dec): as laid. On Monday 21 Dec, unanswered: still Rebuild this week.
  assert.equal(kinds(harness("2026-12-16", ROAD()).api.effectiveRoad(harness("2026-12-16", ROAD()).profile, ATH, GOAL)), "r4 b5 r16");
  const h = harness("2026-12-22", ROAD());
  assert.equal(kinds(h.api.effectiveRoad(h.profile, ATH, GOAL)), "r5 b4 r16", "the runner moved into Base without choosing to");
  // Two weeks on, still unanswered: still Rebuild, and the weeks come out of Base, then the race block.
  const h2 = harness("2027-01-06", ROAD());
  assert.equal(kinds(h2.api.effectiveRoad(h2.profile, ATH, GOAL)), "r7 b2 r16");
  // Answered "up" for 21 Dec: the road as laid.
  const h3 = harness("2026-12-22", ROAD([{ dueIso: "2026-12-21", kind: "rebuild", answer: "up" }]));
  assert.equal(kinds(h3.api.effectiveRoad(h3.profile, ATH, GOAL)), "r4 b5 r16");
});

test("BLOCKER: the road fits a moved race date from its own first week, never re-laying the weeks run", () => {
  const h = harness("2026-11-25", ROAD());
  h.profile.raceDate = "2027-05-30";
  // ⚠️ §10 DECISION 1: two more weeks go to Base — as BLOCKS, never one stage past six weeks without a checkpoint. Base
  // has not begun, so it is cut again together with the new weeks (seven: 4 + 3).
  assert.equal(kinds(h.api.effectiveRoad(h.profile, ATH, { raceDateIso: "2027-05-30" })), "r4 b4 b3 r16", "two more weeks go to Base");
  assert.equal(kinds(h.api.effectiveRoad(h.profile, ATH, { raceDateIso: "2027-05-02" })), "r4 b3 r16", "two fewer come out of Base");
  // A race thirteen weeks later: Base (5 + 13 = 18 weeks) as blocks of four to six, and no stage longer than six.
  const far = h.api.effectiveRoad(h.profile, ATH, { raceDateIso: "2027-08-15" });
  assert.equal(kinds(far), "r4 b4 b4 b5 b5 r16");
  assert.ok(far.stages.slice(0, -1).every((s: any) => s.weeks <= 6), kinds(far));
  // ⚠️ A BASE BLOCK ALREADY UNDER WAY KEEPS ITS END — the checkpoint the runner is heading for never moves under them —
  // and the new weeks become blocks of their own after it.
  const inBase = harness("2027-01-06", ROAD([{ dueIso: "2026-12-21", kind: "rebuild", answer: "up" }]));
  inBase.profile.raceDate = "2027-06-13";
  assert.equal(kinds(inBase.api.effectiveRoad(inBase.profile, ATH, { raceDateIso: "2027-06-13" })), "r4 b5 b4 r16");
  // A sooner race takes from the later Base blocks first — down to nothing — before the race block gives up a week.
  // (Its road fills 29 weeks to a race on 13 June; the race comes six weeks sooner.)
  const blocks = harness("2026-11-25", ROAD([], [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }, { kind: "base", weeks: 5 }, { kind: "race", weeks: 16 }]));
  assert.equal(kinds(blocks.api.effectiveRoad(blocks.profile, ATH, { raceDateIso: "2027-06-13" })), "r4 b4 b5 r16", "as laid");
  assert.equal(kinds(blocks.api.effectiveRoad(blocks.profile, ATH, { raceDateIso: addDays("2027-06-13", -42) })), "r4 b3 r16");
  // A runner the road no longer places (now 12–17) has no road at all: the plan it would have been. §10 piece 3 (2026-11-18):
  // a regular runner IS placed now, so their road carries on.
  assert.equal(h.api.effectiveRoad(h.profile, { experience: "recreational", age: 15 }, GOAL), null);
  assert.ok(h.api.effectiveRoad(h.profile, { experience: "recreational" }, GOAL), "a regular runner's road was dropped");
});

test("BLOCKER: the card shows in a stage's last week, once — never daily, never after an answer", () => {
  const seen = (today: string, cps: unknown[] = [], stages?: any) => {
    const h = harness(today, ROAD(cps, stages));
    const cp = h.api.roadCheckpoint();
    return cp ? cp.kind + "→" + cp.endIso : null;
  };
  assert.equal(seen("2026-12-09"), null, "shown before the stage's last week");
  assert.equal(seen("2026-12-14"), "rebuild→2026-12-21");
  assert.equal(seen("2026-12-20"), "rebuild→2026-12-21");
  assert.equal(seen("2026-12-16", [{ dueIso: "2026-12-21", kind: "rebuild", answer: "up" }]), null, "asked again after moving up");
  // Held and unanswered on 22 Dec: still asked (it is the checkpoint not answered, not a new one).
  assert.equal(seen("2026-12-22"), "rebuild→2026-12-28");
  // Base's checkpoint comes in Base's last week.
  assert.equal(seen("2027-01-20", [{ dueIso: "2026-12-21", kind: "rebuild", answer: "up" }]), "base→2027-01-25");
  // The race block's LAST block has no checkpoint (race day is B9's handover). §10 piece 3: its earlier blocks of four do —
  // test/road-regular-app.test.ts.
  assert.equal(seen("2027-05-12", [{ dueIso: "2026-12-21", kind: "rebuild", answer: "up" }, { dueIso: "2027-01-25", kind: "base", answer: "up" }]), null);
});

test("BLOCKER: the three answers — and only the weeks from the checkpoint on change", () => {
  const h = harness("2026-12-16", ROAD());
  const cp = h.api.roadCheckpoint();
  const up = h.api.roadAnswered(cp, "up");
  assert.equal(kinds(up), "r4 b5 r16");
  assert.deepEqual(up.checkpoints.map((c: any) => c.answer + "@" + c.dueIso), ["up@2026-12-21"]);
  const more = h.api.roadAnswered(cp, "more");
  assert.equal(kinds(more), "r5 b4 r16", "one more week of Rebuild comes out of Base");
  const ease = h.api.roadAnswered(cp, "ease");
  assert.equal(kinds(ease), "r4 r1 b4 r16", "easing back adds one Rebuild week before Base");
  // After "more", the card is gone for the rest of this week and back next week — the next checkpoint.
  const h2 = harness("2026-12-17", more);
  assert.equal(h2.api.roadCheckpoint(), null);
  const h3 = harness("2026-12-21", more);
  assert.equal(h3.api.roadCheckpoint().endIso, "2026-12-28");
  // Out of room: Base gone and the race block at its shortest — no week left to take.
  const tight = harness("2026-12-16", ROAD([], [{ kind: "rebuild", weeks: 4 }, { kind: "race", weeks: 4 }]));
  tight.profile.raceDate = addDays(FROM, 7 * 8 - 1);
  const tcp = tight.api.roadCheckpoint();
  assert.equal(tight.api.roadAnswered(tcp, "more"), null);
});

test("BLOCKER: through the real engine, the stored road builds the stages, and a road-less profile is untouched", () => {
  // The guard on applyProfile: the road reaches the engine only when the profile carries one.
  const ap = decomment(fnBody("applyProfile"));
  assert.match(ap, /if \(pf\.road\) \{ const road = effectiveRoad\(pf, ath, goal\); if \(road\) opts\.road = road; \}/);
  const h = harness("2026-11-25", ROAD());
  const eff = h.api.effectiveRoad(h.profile, ATH, GOAL);
  const athlete = { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1250 }, experience: "beginner", includeStrength: true,
    returningFromInjury: true, returningFromBreak: false, runWalk: false, longRunDay: 6 } as any;
  const plan = RC.generatePlan(athlete, { distance: "half", targetTimeSeconds: 5700, raceDateIso: "2027-05-16" } as any,
    { startDateIso: FROM, road: eff });
  assert.deepEqual([...new Set(plan.weeks.map((w: any) => w.stage))], ["rebuild", "base", "race"]);
  assert.equal(plan.weeks.filter((w: any) => w.stage === "rebuild").reduce((n: number, w: any) => n + w.qualitySessionCount, 0), 0);
  assert.ok(plan.weeks.filter((w: any) => w.stage === "base").every((w: any) => w.qualitySessionCount === 1));
});

test("the wizard saves the road its summary showed, and a short road only once the runner chose it", () => {
  const wf = decomment(fnBody("wizardFinish"));
  assert.match(wf, /pf\.road = wizRoadFor\(pf\);/);
  const wr = decomment(fnBody("wizRoadFor"));
  assert.match(wr, /shortWeeks > 0 && draft\.roadShort !== "1"\) return null/);
  const err = decomment(fnBody("wizStepError"));
  assert.match(err, /prop\.shortWeeks > 0 && draft\.roadShort !== "1"\) return /);
  // A profile edit keeps the road; the wizard never inherits the old one.
  // pc-days-raceblock (restated on purpose): a profile edit keeps the road, now through roadDaysEdited, which records a day
  // a habit-builder adds in the race block (test/road-days-app.test.ts) and otherwise hands the road back as it was.
  assert.match(decomment(fnBody("draftFromForm")), /road: state\.screen === "wizard" \? null : profile\.road \? roadDaysEdited\(profile\.road, Number\(draft\.days\), status\) : null/);
});

test("BLOCKER: one question at a time — the checkpoint waits behind the others, and the weekly review waits for it", () => {
  const cur = decomment(fnBody("currentRoadCheckpoint"));
  assert.match(cur, /if \(currentHandover\(\) \|\| currentReentry\(\) \|\| currentRealign\(\)\) return null;/);
  assert.match(decomment(fnBody("weeklyReviewCard")), /if \(currentRoadCheckpoint\(\)\) return "";/);
  assert.match(decomment(fnBody("roadCheckpointHtml")), /cp = currentRoadCheckpoint\(\)/);
  assert.match(decomment(fnBody("answerRoad")), /cp = currentRoadCheckpoint\(\)/);
  // Driven: with another question up, no checkpoint; with none, the checkpoint.
  const h = harness("2026-12-16", ROAD());
  for (const other of [true, false]) {
    const f = new Function("roadCheckpoint", "currentHandover", "currentReentry", "currentRealign",
      fnBody("currentRoadCheckpoint") + "\nreturn currentRoadCheckpoint;")(h.api.roadCheckpoint, () => other, () => null, () => null);
    assert.equal(!!f(), !other, other ? "the checkpoint showed beside race day's question" : "the checkpoint did not show");
  }
});

test("Base's test run can be started from the checkpoint itself — the plan schedules none", () => {
  const html = decomment(fnBody("roadCheckpointHtml"));
  // §10 piece 3: and at every race-block checkpoint (the test that keeps the race block's paces honest).
  assert.match(html, /\(cp\.kind === "base" \|\| cp\.kind === "race"\) && !v\.met\.keyRun/);
  // §10 decision 5: the controlled 2 km and the all-out trial, each only when this runner is offered it.
  assert.match(html, /offer\.indexOf\("controlled-2k"\) >= 0\) trial \+= '<button class="perf-a" data-roadtrial="controlled">/);
  assert.match(html, /offer\.indexOf\("trial-2k"\) >= 0\) trial \+= '<button class="perf-a" data-roadtrial="max">/);
  // Wired by the sheet itself (wire() runs on a render, not when a sheet opens) to the one trial flow, in its mode.
  // ⚠️ NEVER data-trialstart: wire() binds every one in the document to the all-out trial.
  assert.doesNotMatch(html, /data-trialstart/);
  assert.match(decomment(fnBody("openRoadCheckpoint")), /#sheetBody \[data-roadtrial\]"\)\.forEach\(\(b\) => \{ b\.onclick = \(\) => \{ closeSheet\(\); startTrialFlow\(b\.dataset\.roadtrial === "controlled" \? "controlled" : null, "road"\); \}; \}\)/);
});

test("BLOCKER: the checkpoint is a pop-up, never a card wedged onto Today — once a day, never stacked", () => {
  // The owner, 2026-11-18: "I want the check point to appear as a pop up ... rather than above the 'Hi, Adam' part".
  assert.doesNotMatch(decomment(fnBody("todayCards")), /road/i, "the checkpoint is back among Today's cards");
  const pop = decomment(fnBody("maybeRoadPopup"));
  for (const hold of [/\$\("splash"\) \|\| \$\("welcomeback"\)/, /GUIDE \|\| !guideSeen\(\)/, /EXTRAS/, /\$\("sheetOv"\)\.classList\.contains\("on"\)/, /liveRunning\(\)/])
    assert.match(pop, hold, "the pop-up does not wait for " + hold);
  assert.match(pop, /const mark = cp\.endIso \+ "\|" \+ todayIso\(\);/);
  assert.match(pop, /if \(localStorage\.getItem\(ROADPOP_KEY\) === mark\) return;/, "it pops again the same day");
  // Opened at the same three moments as the sessions guide, which goes first.
  assert.equal((SRC.match(/maybeAutoGuide\(\); maybeRoadPopup\(\);/g) || []).length, 3);
  // Every button in it does what it says: the answers, Not now, and the injury door — which NAVIGATES to it.
  const open = decomment(fnBody("openRoadCheckpoint"));
  // pc-days-raceblock (restated on purpose): "Move up" with a days offer asks that first (openRoadDays); every answer still
  // closes the sheet and goes through answerRoad.
  assert.match(open, /#sheetBody \[data-road\]"\)\.forEach\(\(b\) => \{ b\.onclick = \(\) => \{\s*if \(b\.dataset\.road === "up" && b\.dataset\.days === "1" && openRoadDays\(\)\) return;\s*closeSheet\(\); answerRoad\(b\.dataset\.road\);\s*\}; \}\)/);
  assert.match(open, /\$\("roadLater"\); if \(later\) later\.onclick = closeSheet;/);
  assert.match(open, /state\.tab = "support"; state\.support = "redflags"; render\(\);/);
  assert.match(decomment(fnBody("roadCheckpointHtml")), /id="roadInjury"/);
  // And the Plan screen's road opens it at any time it is up.
  assert.match(decomment(fnBody("roadPlanCard")), /id="roadOpen"/);
  assert.match(SRC, /const ro = \$\("roadOpen"\); if \(ro\) ro\.onclick = \(\) => openRoadCheckpoint\(\);/);
});
