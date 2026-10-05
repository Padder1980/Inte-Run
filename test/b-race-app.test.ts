import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

/**
 * STAGE B7 IN THE APP: "Add a race" on Manage plan — window-bounded pickers, a preview in the runner's own weeks,
 * one commit and one Undo, a row under Planned breaks with its Cancel, and every race session read at its own
 * distance. The engine's half is test/b-race.test.ts.
 *
 * The real applyProfile, adoptPlan, the sheet, its save, the cancel and the Planned breaks list, lifted out of the
 * built page over the real engine. The DOM is a stand-in that keeps what the sheet writes and the handlers it wires,
 * so the test taps the same controls the runner does.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function renderRaceSheet(");
  assert.ok(marker >= 0, "renderRaceSheet is not in the build — run node web/app.ts");
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
const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
const MONDAY = mondayOf(ISO(new Date()));
const WED = addDays(MONDAY, 2);
const START = addDays(MONDAY, -35);
const RACE = addDays(MONDAY, 7 * 14 + 6);

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "esc", "applyProfile", "planStartIso", "blockStartIso", "holdBeforeStart",
  "firstShownWeek", "returnKind", "adoptPlan", "recompute", "normalizeWeekStarts", "computeToday", "planDefaultWeek",
  "profileImpact", "reentryKm", "bRaceWindow", "bRaceAhead", "bRacePlaced", "raceKeyOf", "openRaceSheet", "renderRaceSheet",
  "saveRaceDraft", "cancelBRace", "plannedBreaksHtml", "loadAdjust", "legacySid", "sidKeys"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJ_QUALITY", "PRIMARY_TYPES", "B_RACE_NAME", "B_RACE_IN_A_SENTENCE", "ADJUST_KEY", "SKIP_KEEP_DAYS"];

function sandbox(o: { goal?: string; raceDate?: string; bRace?: unknown } = {}) {
  const clock = { today: WED };
  const store: Record<string, string> = {};
  const els: Record<string, any> = {};
  const $ = (id: string) => (els[id] ||= { id, innerHTML: "", value: "", onclick: null, onchange: null, classList: { add: () => {} } });
  const box: any = { clock, els, toasts: [] as string[], undo: null as null | (() => void), calls: [] as string[],
    profile: { status: "regular", goalDist: o.goal || "half", targetS: 6300, raceDate: o.raceDate || RACE, startDateIso: START,
      longRunDay: 6, recentTimeS: 1500, noRecent: false, twoKmS: 0, daysPerWeek: 5, volKm: 40, strength: false, returning: false,
      age: 40, bRace: o.bRace ?? null } as any };
  const env: Record<string, unknown> = {
    RC, profile: box.profile, todayIso: () => clock.today, console: { warn: () => {}, log: () => {} }, $,
    document: { querySelectorAll: () => [] }, ensureSheet: () => {}, SHEET_CTX: null,
    localStorage: { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } },
    state: { dayOverride: {}, done: {}, planWeek: 1, selWeek: 0, selDay: 0 },
    trainingYearsFor: () => 3, resolvedStatus: (p: any) => p.status, typeCeilingFor: () => undefined,
    experienceFor: () => "recreational", strengthPrefsOf: () => null, progActive: () => false,
    todayTicks: () => [], restoreTicks: () => {}, seedDone: () => box.calls.push("seedDone"), saveProfileStore: () => box.calls.push("save"),
    saveDayOverride: () => {}, closeSheet: () => box.calls.push("close"), render: () => {},
    ICON: { timer: "", rRace: "", cal: "" }, effortVar: () => "", sessionEffort: () => "easy",
    toast: (m: string) => box.toasts.push(m), toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
  };
  const src = "let PLAN, RAW, FITNESS, CLASS, MASTERS, XWEEK = {}, RACE_DRAFT = null, SHEET_CTX_ = null;\n" +
    "let CURRENT_WEEK = 0, TODAY_DOW = 0, TODAY_IN_PLAN = false;\n" +
    CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") +
    ", plan: () => PLAN, raw: () => RAW, draft: () => RACE_DRAFT, setDraft: (d) => { RACE_DRAFT = d; } };")(...names.map((n) => env[n]));
  box.launch = () => { box.api.recompute(); box.api.computeToday(); };
  box.launch();
  return box;
}
const raceWeek = (box: any) => box.api.raw().weeks.find((w: any) => w.secondaryRace && w.secondaryRace.role === "race");

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the pickers ARE the window — the engine's own, from tomorrow, and only distances this app knows", () => {
  const box = sandbox();
  const eng = RC.secondaryRaceWindow(box.api.raw().weeks, { distance: "half", raceDateIso: RACE } as any)!;
  const w = box.api.bRaceWindow();
  assert.ok(w, "no window on a fifteen-week half");
  assert.equal(w.toIso, eng.toIso, "the app's window does not end where the engine's does");
  assert.equal(w.fromIso, addDays(WED, 1) > eng.fromIso ? addDays(WED, 1) : eng.fromIso, "the window opens before tomorrow, or after the engine's");
  assert.deepEqual(w.distances, ["5k", "10k"], "a half's B-race is offered something other than a 5K or a 10K (a mile, which nothing here knows)");
  box.api.openRaceSheet();
  const html = box.els.sheetBody.innerHTML;
  assert.match(html, new RegExp('id="raceDate" type="date" value="[0-9-]+" min="' + w.fromIso + '" max="' + w.toIso + '"'), "the date picker is not bounded by the window");
  assert.deepEqual([...html.matchAll(/data-racedist="([a-z0-9]+)"/g)].map((m) => m[1]), w.distances, "the distance buttons are not the window's");
  // The suggestion: six weeks before the goal race (PLAN.md's own example), the longest distance allowed.
  assert.deepEqual(box.api.draft(), { distance: "10k", dateIso: addDays(RACE, -42) });
  // A typed date past the end is held at the end, not refused.
  box.els.raceDate.value = addDays(w.toIso, 30); box.els.raceDate.onchange();
  assert.equal(box.api.draft().dateIso, w.toIso, "a date past the window was accepted");
  // A plan with nothing shorter than its goal says so, and offers nothing.
  const five = sandbox({ goal: "5k" });
  assert.equal(five.api.bRaceWindow(), null, "a 5K plan was offered a race shorter than a 5K");
  five.api.openRaceSheet();
  assert.match(five.els.sheetBody.innerHTML, /There is no room for another race in this plan/);
});

test("BLOCKER: the sheet says what it does, the plan then does exactly that — and Undo puts it all back", () => {
  const box = sandbox();
  const before = JSON.stringify(box.api.raw().weeks);
  box.api.openRaceSheet();
  const html = box.els.sheetBody.innerHTML;
  const d = box.api.draft();
  // The preview, in the runner's own weeks: which week is easier, by how much, and which holds the race.
  const m = html.match(/Week (\d+): easier, so you arrive fresh — ([0-9.]+) → ([0-9.]+) km/);
  assert.ok(m, "the sheet does not say which week gets easier, and by how much");
  const r = html.match(/Week (\d+): your 10K on ([^,]+), with one sharp session before it/);
  assert.ok(r, "the sheet does not say which week holds the race");
  assert.match(html, /stay exactly as they are/, "the sheet does not say the goal race is untouched");
  box.els.raceSave.onclick();
  assert.deepEqual(box.profile.bRace, d, "the race saved is not the one on the sheet");
  const ws = box.api.plan().weeks;
  const bw = ws.find((w: any) => w.index === Number(m[1]));
  assert.equal(bw.distanceKm.toFixed(1), m[3], "the easier week is not the distance the sheet quoted");
  assert.equal(raceWeek(box).index, Number(r[1]), "the race is not in the week the sheet named");
  assert.ok(raceWeek(box).sessions.some((s: any) => s.type === "race" && addDays(mondayOf(raceWeek(box).startDateIso), s.dayOfWeek) === d.dateIso),
    "the race is not on the day the sheet showed");
  assert.ok(box.toasts.some((t: string) => /Your 10K on .* is in your plan\./.test(t)), "the toast does not say what happened");
  assert.ok(box.calls.includes("save"), "the profile was not saved");
  // Undo: the plan as it was, and the profile with no race.
  box.undo();
  assert.equal(box.profile.bRace, null);
  assert.equal(JSON.stringify(box.api.raw().weeks), before, "Undo did not give back the plan as it was");
});

test("BLOCKER: Planned breaks lists the race with its Cancel — and says so when it no longer fits", () => {
  const box = sandbox();
  assert.ok(!/data-pbrace/.test(box.api.plannedBreaksHtml()), "a plan with no race lists one");
  box.api.openRaceSheet(); box.els.raceSave.onclick();
  const list = box.api.plannedBreaksHtml();
  assert.match(list, /10K race/, "the race is not listed under Planned breaks");
  assert.match(list, /the week before is easier/);
  assert.match(list, /data-pbrace="1"/, "the race has no Cancel");
  // Cancel: the plan's own weeks again, and Undo brings the race back.
  const placed = JSON.stringify(box.api.raw().weeks);
  box.api.cancelBRace();
  assert.equal(box.profile.bRace, null, "Cancel left the race in the profile");
  assert.ok(!raceWeek(box), "Cancel left the race in the plan");
  box.undo();
  assert.equal(JSON.stringify(box.api.raw().weeks), placed, "Undo of Cancel did not put the race back");
  // A race the plan no longer has room for — the goal race moved to two weeks after it — is said, not hidden.
  const late = sandbox({ bRace: { distance: "10k", dateIso: addDays(RACE, -42) } });
  late.profile.raceDate = addDays(RACE, -35); late.launch();
  assert.ok(!late.api.bRacePlaced(), "the fixture's race still fits");
  assert.match(late.api.plannedBreaksHtml(), /no longer fits your plan/, "a race outside the window is listed as if it were in the plan");
});

test("BLOCKER: a race session is read at its own distance — the warm-up and the fuelling for a 10K are a 10K's", () => {
  const box = sandbox();
  box.api.openRaceSheet(); box.els.raceSave.onclick();
  const all = box.api.raw().weeks.flatMap((w: any) => w.sessions);
  const races = all.filter((s: any) => s.type === "race");
  assert.equal(races.length, 2, "the plan does not hold two races");
  const keys = races.map((s: any) => box.api.raceKeyOf(s)).sort();
  assert.deepEqual(keys, ["10k", "half"], "a race session is not read at its own distance: " + keys);
  // Both readers ask raceKeyOf rather than the goal.
  assert.match(decomment(SRC), /raceDistance: sess\.type === "race" \? raceKeyOf\(sess\) : null/, "the warm-up reads the goal for every race");
  assert.match(decomment(SRC), /raceDistance: sess\.type === "race" \? raceKeyOf\(sess\) : profile\.goalDist/, "the fuelling reads the goal for every race");
});

test("BLOCKER: the race survives a profile edit, never follows an old plan, and is wired where it is shown", () => {
  // draftFromForm replaces the profile whole, so a field it leaves out is gone.
  assert.match(decomment(fnBody("draftFromForm")), /bRace: state\.screen !== "wizard" && profile\.bRace \? profile\.bRace : null,/);
  assert.match(decomment(fnBody("adoptProf")), /profile\.bRace = null;/, "a plan used again keeps the old plan's race");
  assert.match(constStmt("PLAN_PROF_FIELDS"), /"bRace"/, "the race does not travel with the plan's answers");
  // Both options objects carry it, so the summary and the prescription agree.
  const ap = decomment(fnBody("applyProfile"));
  assert.match(ap, /RC\.buildPlanSummary\(ath, goal, opts\)/); assert.match(ap, /RC\.generatePlan\(ath, goal, opts\)/);
  // The menu row reaches the sheet, Cancel reaches cancelBRace, and the plan list names the race week.
  assert.match(decomment(fnBody("manageAction")), /if \(id === "race"\) \{ openRaceSheet\(\); return; \}/);
  assert.match(decomment(SRC), /querySelectorAll\("\[data-pbrace\]"\)\.forEach\(\(b\) => \{ b\.onclick = \(\) => \{ closeSheet\(\); cancelBRace\(\); \}; \}\);/);
  assert.match(decomment(fnBody("weekSummaryRow")), /sr && sr\.role === "race" \? \(B_RACE_NAME\[sr\.distance\] \|\| "Race"\) \+ " race"/);
  // A week-move never puts a hard session on a B-race's eve (the goal race's rule, read off every race session).
  assert.match(decomment(fnBody("xwRefusal")), /x\.type === "race" && isoAdd\(PLAN\.weeks\[wi\]\.startIso, x\.dayOfWeek - 1\)/);
});
