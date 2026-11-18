// STAGES.md §10 IN THE APP, piece 2 — the two walk-run blocks (decision 2), lifted from the BUILT page over the real
// engine: the key run read only from the plan's own key session done and rated easy, the answers never cutting a
// walk-run block, easing back in walk-run as a lighter week of run-walk, and the sheet's words.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function roadTargetRun(");
assert.ok(at0 >= 0, "roadTargetRun is not in the build — run node web/app.ts");
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
const isoAdd = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; };

// A runner just getting started: Walk-run 1 from Mon 23 Nov to Sun 27 Dec, its key run (20 minutes) on Sat 26 Dec.
const FROM = "2026-11-23", WR1_END = "2026-12-28";
const ROAD = (stages = [{ kind: "walkrun1", weeks: 5 }, { kind: "walkrun2", weeks: 4 }, { kind: "rebuild", weeks: 4 },
  { kind: "base", weeks: 4 }, { kind: "race", weeks: 12 }], checkpoints: unknown[] = []) =>
  ({ v: 1, fromIso: FROM, stages, rampWeeks: 8, checkpoints });
type Run = { id: string; dateIso: string; sec: number; rpe?: number; distKm?: number };
function harness(today: string, o: { runs?: Run[]; links?: Record<string, string>; road?: any; raceDate?: string } = {}) {
  const profile: any = { personalized: true, status: "new", returning: false, raceDate: o.raceDate ?? "2027-06-13", goalDist: "5k",
    road: o.road ?? ROAD() };
  const state: any = { logged: o.runs ?? [], hist: [] };
  // Walk-run 1's last week: the key session on Saturday 26 Dec (week 5, day 5).
  const env: Record<string, unknown> = {
    RC, profile, state, isoAdd, todayIso: () => today,
    PLAN: { weeks: [{ index: 5, startIso: "2026-12-21" }], feasibility: null },
    RAW: { weeks: [{ sessions: [{ id: "k1", type: "easy", dayOfWeek: 5, estimatedDurationSeconds: 28 * 60, keyRun: { minutes: 20 } },
      { id: "e1", type: "easy", dayOfWeek: 1, estimatedDurationSeconds: 26 * 60 }] }] },
    PRIMARY_TYPES: { easy: 1, long: 1 }, effDay: (s: any) => s.dayOfWeek,
    linkedRunFor: (_w: number, sid: string) => (o.links ?? {})[sid] ?? null,
    loadHist: () => [], loadTwoKm: () => [], runDateLabelIso: (iso: string) => "D" + iso, esc: (x: unknown) => String(x),
    experienceFor: (p: any) => (p.status === "building" || p.status === "new" ? "beginner" : "recreational"),
    // The sheet asks currentRoadCheckpoint: here, the checkpoint itself (nothing else is open). Through a holder, because
    // a value handed to new Function is bound when it is called.
    currentRoadCheckpoint: () => holder.api.roadCheckpoint(),
  };
  const holder: { api: any } = { api: null };
  const fns = ["roadOf", "roadWeeksBetween", "roadMondayAfter", "roadAnswerAt", "effectiveRoad", "roadAthleteOf", "roadLegsNow",
    "roadCheckpoint", "roadAnswered", "roadRaceWeeks", "weekMondayOf", "roadWalkRun", "roadTargetRun", "roadFacts", "roadClock",
    "roadLongestKm", "roadTestOffer", "roadTestIn", "resolvedStatus", "returnKind", "fmtTimeFull", "roadLegName", "roadWeeksLabel",
    "roadBookRaceWeeks", "roadCheckpointHtml", "roadParkrunCandidates"];
  const src = [constDecl("ROAD_STAGE_LABEL"), constDecl("ROAD_STAGE_JOB"), constDecl("ROAD_MIN_RACE_WEEKS"), ...fns.map(fnBody)].join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { " + fns.join(", ") + " };")(...names.map((n) => env[n]));
  holder.api = api;
  return { api, profile, state };
}
const kinds = (r: any) => r.stages.map((s: any) => s.kind.replace("walkrun", "w") + ":" + s.weeks).join(" ");

test("BLOCKER: Walk-run's key run counts only the plan's own key session, done and rated easy", () => {
  const cp = harness("2026-12-26").api.roadCheckpoint();
  assert.equal(cp.kind, "walkrun1");
  assert.equal(cp.endIso, WR1_END);
  const key = (runs: Run[], links?: Record<string, string>) => harness("2026-12-26", { runs, links }).api.roadTargetRun(cp, "2026-12-26");
  // Done: on its day, 20 minutes or more, rated easy.
  assert.equal(key([{ id: "a", dateIso: "2026-12-26", sec: 23 * 60, rpe: 3 }]).doneIso, "D2026-12-26");
  // Not done: rated hard (not a chatting pace), unrated, too short, or on another day.
  for (const r of [{ rpe: 7 }, { rpe: undefined }, { sec: 15 * 60, rpe: 3 }, { dateIso: "2026-12-24", rpe: 3 }]) {
    const run = Object.assign({ id: "a", dateIso: "2026-12-26", sec: 23 * 60 }, r) as Run;
    const k = key([run]);
    assert.equal(k.doneIso, null, JSON.stringify(r));
    assert.equal(k.needMin, 20);
  }
  // A run linked to the key session counts on any day — rated easy.
  assert.equal(key([{ id: "L", dateIso: "2026-12-25", sec: 21 * 60, rpe: 4 }], { k1: "L" }).doneIso, "D2026-12-26");
  // Not yet done, before its day: the sheet can say when it is.
  const before = harness("2026-12-22").api.roadTargetRun(cp, "2026-12-22");
  assert.equal(before.plannedIso, "D2026-12-26");
  assert.match(RC.evaluateCheckpoint({ stage: "walkrun1", planned: 2, done: 2, painRuns: 0, keyRun: before }).reasons[2]!,
    /20 minutes without stopping, at a chatting pace — it is in your plan on D2026-12-26/);
});

test("BLOCKER: an answer never takes a week from a walk-run block, and easing back stays run-walk", () => {
  const h = harness("2026-12-23");
  const cp = h.api.roadCheckpoint();
  // One more week of Walk-run 1: the week comes from Base — never from Walk-run 2, whose key run is in its last week.
  assert.equal(kinds(h.api.roadAnswered(cp, "more")), "w1:6 w2:4 rebuild:4 base:3 race:12");
  // Easing back: a lighter week of Walk-run 1, not a week of continuous running.
  assert.equal(kinds(h.api.roadAnswered(cp, "ease")), "w1:5 w1:1 w2:4 rebuild:4 base:3 race:12");
  // No Base left: the race block gives the week (never under its shortest), then Rebuild — never walk-run.
  const noBase = harness("2026-12-23", { road: ROAD([{ kind: "walkrun1", weeks: 5 }, { kind: "walkrun2", weeks: 4 }, { kind: "rebuild", weeks: 4 },
    { kind: "race", weeks: 4 }]), raceDate: "2027-03-21" });
  assert.equal(kinds(noBase.api.roadAnswered(noBase.api.roadCheckpoint(), "more")), "w1:6 w2:4 rebuild:3 race:4");
});

test("BLOCKER: a sooner race never cuts a walk-run block; a later one after walk-run starts with Rebuild", () => {
  const h = harness("2026-11-25");
  const ATH = { experience: "beginner", runWalk: true };
  // Twelve weeks sooner: Base goes, then the race block to its shortest, then Rebuild — walk-run stays 5 + 4.
  const soon = h.api.effectiveRoad(h.profile, ATH, { raceDateIso: "2027-03-21" });
  assert.match(kinds(soon), /^w1:5 w2:4 /);
  // Sixteen weeks sooner: everything else is down to its least and weeks are still wanted — walk-run is still 5 + 4.
  const sooner = h.api.effectiveRoad(h.profile, ATH, { raceDateIso: "2027-02-21" });
  assert.match(kinds(sooner), /^w1:5 w2:4 rebuild:1 base:1 race:4$/);
  // A road with no Rebuild yet (too short when made), its race moved later: Rebuild first, then Base.
  const short = harness("2026-11-25", { road: ROAD([{ kind: "walkrun1", weeks: 5 }, { kind: "walkrun2", weeks: 4 }, { kind: "race", weeks: 4 }]),
    raceDate: "2027-02-21" });
  assert.equal(kinds(short.api.effectiveRoad(short.profile, ATH, { raceDateIso: "2027-02-21" })), "w1:5 w2:4 race:4", "as laid");
  assert.equal(kinds(short.api.effectiveRoad(short.profile, ATH, { raceDateIso: "2027-04-18" })), "w1:5 w2:4 rebuild:4 base:4 race:4");
});

test("the walk-run checkpoint's sheet: move up to Walk-run 2, a repeat is normal, and no test buttons", () => {
  const sheet = harness("2026-12-23").api.roadCheckpointHtml();
  assert.match(sheet, /Checkpoint · end of Walk-run 1/);
  assert.match(sheet, /Move up to Walk-run 2/);
  assert.match(sheet, /One more week of Walk-run 1/);
  assert.match(sheet, /repeating a week is completely normal/);
  assert.match(sheet, /A lighter week of run–walk, then this checkpoint again/);
  assert.doesNotMatch(sheet, /data-roadtrial|data-roadtest|2 km/);
  // An eased week of Walk-run 1 is still "Walk-run 1", never "Walk-run 1 2".
  const legs = [{ kind: "walkrun1" }, { kind: "walkrun1" }, { kind: "walkrun2" }];
  const h = harness("2026-12-23");
  assert.deepEqual(legs.map((_, i) => h.api.roadLegName(legs, i)), ["Walk-run 1", "Walk-run 1", "Walk-run 2"]);
});
