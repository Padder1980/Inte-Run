import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

/**
 * A PAUSE PICKS UP WHERE YOU LEFT OFF (2026-10-04, the owner: "make a pause pick up where you left off").
 *
 * Once the block stayed where it began (test/plan-anchor.test.ts) the plan finally climbed week by week, and a pause
 * threw that away: it started the plan again from week 1 on the day the runner was back, built from the weekly
 * distance they gave when they set it up. Pause a fortnight in week 8 and you came back to week 1 of a shorter plan.
 *
 * Now the pause moves the block and the target date later by the weeks away (blockFromIso, pauseChanges), so the
 * runner comes back to the week they paused in, from the same day of it. The days before the plan starts again are
 * held empty and the weeks wholly before it are out of sight (holdBeforeStart) — kept in the plan rather than dropped,
 * so week N is still PLAN.weeks[N - 1] everywhere that reads it that way.
 *
 * Everything here runs the REAL engine through the real applyProfile, adoptPlan, computeToday, the pause sheet,
 * applyPause and resumeFromPause, lifted out of the built page. Only the clock and the screen are stand-ins.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function holdBeforeStart(");
  assert.ok(marker >= 0, "holdBeforeStart is not in the build — run node web/app.ts");
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
/** A Wednesday, so the pause starts mid-week and "from the same day of it" means something. */
const WED = addDays(MONDAY, 2);
const START = addDays(MONDAY, -35);
const RACE = addDays(MONDAY, 7 * 10 + 6);

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "esc", "applyProfile", "planStartIso", "blockStartIso", "holdBeforeStart",
  "firstShownWeek", "returnKind", "adoptPlan", "recompute", "normalizeWeekStarts", "computeToday", "planDefaultWeek",
  "pauseTierFor", "pauseDaysLabel", "pauseChanges", "pausePlanHtml", "applyPause", "resumeFromPause", "pausedCard",
  "pausedWeekRow", "loadAdjust", "adjustFor", "eased", "easeWeekOptions", "legacySid", "sidKeys", "addDayEvidence", "wkLabelInner"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJ_QUALITY", "PAUSE_TIERS", "PAUSE_CHOICES", "ADJUST_KEY", "SKIP_KEEP_DAYS", "PRIMARY_TYPES"];

const PROFILE = () => ({ status: "regular", goalDist: "half", targetS: 6300, raceDate: RACE, startDateIso: START, longRunDay: 6,
  recentTimeS: 1500, noRecent: false, twoKmS: 0, daysPerWeek: 5, volKm: 40, strength: false, returning: false, age: 40 } as any);

function sandbox(today = WED) {
  const clock = { today };
  const store: Record<string, string> = {};
  const box: any = { clock, profile: PROFILE(), toasts: [] as string[], undo: null as null | (() => void), calls: [] as string[] };
  const env: Record<string, unknown> = {
    RC, profile: box.profile, todayIso: () => clock.today, console: { warn: () => {}, log: () => {} },
    localStorage: { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } },
    state: { dayOverride: {}, done: {}, planWeek: 1, selWeek: 0, selDay: 0 },
    trainingYearsFor: () => 3, resolvedStatus: (p: any) => p.status, typeCeilingFor: () => undefined,
    experienceFor: () => "recreational", strengthPrefsOf: () => null, progActive: () => false,
    todayTicks: () => [], restoreTicks: () => {}, seedDone: () => box.calls.push("seedDone"), saveProfileStore: () => box.calls.push("save"),
    saveDayOverride: () => {}, closeSheet: () => {}, render: () => {}, loadAddDayDeclined: () => null,
    toast: (m: string) => box.toasts.push(m), toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
  };
  const src = "let PLAN, RAW, FITNESS, CLASS, MASTERS, XWEEK = {}, PAUSE_DAYS = 7;\n" +
    "let CURRENT_WEEK = 0, TODAY_DOW = 0, TODAY_IN_PLAN = false;\n" +
    CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") +
    ", plan: () => PLAN, raw: () => RAW, cw: () => CURRENT_WEEK, inPlan: () => TODAY_IN_PLAN, days: (n) => { PAUSE_DAYS = n; } };")(
    ...names.map((n) => env[n]));
  box.launch = () => { box.api.recompute(); box.api.computeToday(); };
  box.launch();
  return box;
}

/** Every session the plan holds, with its real date: what the runner would be asked to do, day by day. */
function sessions(box: any) {
  const out: { iso: string; week: number; type: string; min: number; m: number }[] = [];
  box.api.raw().weeks.forEach((w: any, i: number) => {
    const mon = box.api.plan().weeks[i].startIso;
    w.sessions.forEach((s: any) => out.push({ iso: addDays(mon, s.dayOfWeek), week: w.index, type: s.type,
      min: Math.round((s.estimatedDurationSeconds || 0) / 60), m: Math.round(s.trainingDistanceMeters || s.estimatedDistanceMeters || 0) }));
  });
  return out;
}
/** A week's sessions from one weekday on, as the runner meets them: weekday, type, minutes, metres. */
const shape = (list: any[], week: number, fromDow = 0) => list.filter((s) => s.week === week)
  .map((s) => ({ dow: (new Date(s.iso + "T00:00:00Z").getUTCDay() + 6) % 7, type: s.type, min: s.min, m: s.m }))
  .filter((s) => s.dow >= fromDow).sort((a, b) => a.dow - b.dow || a.type.localeCompare(b.type));
const curIndex = (box: any) => box.api.plan().weeks[box.api.cw()].index;

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a fortnight's pause picks up where you left off — the same week, from the same day, two weeks later", () => {
  const box = sandbox();
  assert.ok(box.api.inPlan(), "the fixture's runner is not in their plan today");
  const k = curIndex(box);
  assert.ok(k > 1, "the fixture puts today in week 1, so picking up proves nothing");
  const before = sessions(box);
  const weeks = box.api.plan().weeks.length;
  // ⚠️ A FIXTURE MUST CARRY REAL WORK: sessions left in the paused week after today, and weeks after it to compare.
  assert.ok(shape(before, k, 2).length >= 2 && weeks - k >= 3, "the fixture has too little left in the block to prove anything");

  // ⚠️ THE DEFECT, PUT BACK, IS WHAT THIS ASSERTS AGAINST: the old pause started the plan again from week 1.
  box.api.days(14);
  const sheet = box.api.pausePlanHtml();
  const back = addDays(WED, 14);
  box.api.applyPause("pickup");

  assert.equal(box.profile.startDateIso, back, "the plan does not start again on the day the runner is back");
  assert.equal(box.profile.raceDate, addDays(RACE, 14), "the target date did not move by the fortnight");
  assert.equal(box.profile.pauseWeeks, 2);
  assert.equal(box.api.plan().weeks.length, weeks, "the block changed length: it was rebuilt, not moved");
  const after = sessions(box);
  // Nothing in the window, and nothing before the day back.
  assert.deepEqual(after.filter((s) => s.iso < back), [], "sessions are scheduled inside the pause, or before it");
  // The week the runner comes back to is the week they paused in, from the same day of it.
  const first = box.api.plan().weeks[box.api.firstShownWeek()];
  assert.equal(first.index, k, "the runner comes back to week " + first.index + ", not the week " + k + " they paused in");
  assert.equal(first.startIso, mondayOf(back), "the week they come back to is not the week holding the day they are back");
  assert.deepEqual(shape(after, k), shape(before, k, 2), "the rest of the paused week is not the rest of the week they paused in");
  // The half-held week's figures are its own remaining sessions (the engine's one definition of a week's distance),
  // and it starts on the day back, so a week-move refuses the days before it (xwRefusal's "start").
  const rw = box.api.raw().weeks[box.api.firstShownWeek()];
  assert.equal(first.distanceKm, Math.round(RC.weekVolumeMeters(rw.sessions) / 100) / 10, "the half-held week still shows its full distance");
  assert.equal(rw.startDateIso, back, "the half-held week does not start on the day back");
  // And every week after it is the plan's own week, two weeks later — the block moved, it was not rebuilt.
  for (let w = k + 1; w <= weeks; w++)
    assert.deepEqual(shape(after, w), shape(before, w), "week " + w + " is not the same week after the pause");
  const race = after.find((s) => s.type === "race");
  assert.equal(race && race.iso, addDays(RACE, 14), "race day is not on the new target date");

  // While paused, nobody is "in" a held week: Today shows the paused card, as before.
  assert.equal(box.api.inPlan(), false, "the runner is placed in a held week during their pause");
  assert.equal(box.api.cw(), box.api.firstShownWeek(), "the plan's nearest week is a held one");
  assert.match(box.api.pausedCard(), new RegExp("picks up on [^<]*, in week " + k), "the paused card does not say which week it picks up in");
  assert.match(box.api.pausedWeekRow(), new RegExp("you pick up in week " + k + " on"), "the paused row says week 1 begins");
  // Today's week band names that week as what it is: not "This week", which it is not.
  assert.match(box.api.wkLabelInner(box.api.cw()), new RegExp("^<b>Week " + k + "</b>"), "the week band calls the week you pick up in \"This week\"");
  // And the paused row's line wraps: its end is the part the runner needs, and one line cut it off at phone width.
  assert.match(readFileSync(PAGE, "utf8"), /\.wk-paused \.wk-m \{ white-space: normal; \}/, "the paused row's line is cut off again");

  // ⚠️ THE SHEET SAID SO BEFORE THE RUNNER CHOSE: the option quoted this week, this day and this date.
  const opt = (sheet.match(/<button class="po-opt[^"]*" data-pauseopt="pickup">[\s\S]*?<\/button>/) || [""])[0];
  assert.ok(opt, "a fortnight is not offered picking up where you left off");
  assert.match(opt, /po-opt rec/, "picking up is not the recommendation for a fortnight");
  assert.ok(opt.includes("week " + k) && opt.includes(box.api.runDateLabelIso(back)) && opt.includes(box.api.runDateLabelIso(addDays(RACE, 14))),
    "the option did not quote the week, the day and the date the plan now reads");
  assert.ok(box.toasts.some((t: string) => t.includes("week " + k)), "the toast does not say which week the runner picks up in");
});

test("BLOCKER: from the day back the block carries on climbing — and Undo puts everything back", () => {
  const box = sandbox();
  const k = curIndex(box);
  const before = sessions(box);
  box.api.days(14);
  box.api.applyPause("pickup");
  // Back on the day: week k. A week later: week k + 1. The plan keeps moving through the block.
  box.clock.today = addDays(WED, 14); box.launch();
  assert.ok(box.api.inPlan(), "the runner is not in their plan on the day they are back");
  assert.equal(curIndex(box), k, "on the day back the runner is not in the week they paused in");
  assert.match(box.api.wkLabelInner(box.api.cw()), /^<b>This week<\/b>/, "back in the plan, this week is not called this week");
  box.clock.today = addDays(WED, 21); box.launch();
  assert.equal(curIndex(box), k + 1, "a week later the plan has not moved on");
  // The weeks before the restart stay held, launch after launch.
  assert.ok(box.api.firstShownWeek() > 0 && box.api.plan().weeks.slice(0, box.api.firstShownWeek()).every((w: any) => w.beforeStart && !w.sessions.length),
    "a week before the plan started again came back into sight, or kept sessions");

  // Undo, on the day it was made: the plan as it was.
  const b2 = sandbox();
  b2.api.days(14); b2.api.applyPause("pickup");
  b2.undo();
  assert.equal(b2.profile.startDateIso, START); assert.equal(b2.profile.raceDate, RACE);
  assert.ok(!b2.profile.blockFromIso && !b2.profile.pauseWeeks, "Undo left the pause's layout behind");
  assert.deepEqual(sessions(b2), before, "Undo did not give back the plan as it was");
});

test("BLOCKER: back early — the block and the target date come back with you, to the week you paused in", () => {
  const box = sandbox();
  const k = curIndex(box);
  box.api.days(28);
  box.api.applyPause("pickup");
  assert.equal(box.profile.raceDate, addDays(RACE, 28));
  // Nine days later — the second week of a four-week pause — the runner says "I am back".
  box.clock.today = addDays(WED, 9); box.launch();
  box.api.resumeFromPause();
  assert.equal(box.profile.startDateIso, addDays(WED, 9));
  assert.equal(box.profile.raceDate, addDays(RACE, 7), "the target date kept the weeks the runner did not take");
  assert.ok(box.api.inPlan(), "the runner is not in their plan after coming back");
  assert.equal(curIndex(box), k, "back early, the runner is not in the week they paused in");
  assert.ok(!box.profile.pauseWeeks, "the pause's length outlived it");
  assert.ok(box.toasts.some((t: string) => t.includes("week " + k) && t.includes(box.api.runDateLabelIso(addDays(RACE, 7)))),
    "the toast does not say the week and the new target date");
});

test("BLOCKER: keeping the date for up to a fortnight carries on from where the plan has got to; longer starts again", () => {
  // A week, keeping the date: the days away held empty, then the week the calendar has reached, everything else as it was.
  const box = sandbox();
  const before = sessions(box);
  box.api.days(7);
  const sheet = box.api.pausePlanHtml();
  box.api.applyPause("keep");
  const back = addDays(WED, 7);
  assert.equal(box.profile.raceDate, RACE, "keeping the date moved it");
  const after = sessions(box);
  assert.deepEqual(after.filter((s) => s.iso < back), [], "sessions are scheduled inside the pause");
  assert.deepEqual(after, before.filter((s) => s.iso >= back), "the plan after the pause is not the plan as it was");
  const first = box.api.plan().weeks[box.api.firstShownWeek()];
  const opt = (sheet.match(/<button class="po-opt[^"]*" data-pauseopt="keep">[\s\S]*?<\/button>/) || [""])[0];
  assert.ok(opt.includes("week " + first.index), "the keep option did not name the week the runner carries on with");

  // Three weeks, keeping the date: the tiers' "worth rebuilding the run-in" — week 1 again, to the same date.
  const b3 = sandbox();
  b3.api.days(21);
  b3.api.applyPause("keep");
  assert.equal(b3.profile.raceDate, RACE);
  assert.ok(!b3.profile.blockFromIso, "a long break kept the old block");
  assert.equal(b3.api.plan().weeks[b3.api.firstShownWeek()].index, 1, "three weeks away did not start the run-in again");
  // And moving the date after three weeks starts again too, the recommendation there.
  const b4 = sandbox();
  b4.api.days(21);
  b4.api.applyPause("shift");
  assert.equal(b4.profile.raceDate, addDays(RACE, 21));
  assert.equal(b4.api.plan().weeks[b4.api.firstShownWeek()].index, 1);
  assert.equal(sessions(b4)[0]!.iso >= addDays(WED, 21), true, "the restarted plan schedules inside the pause");
  // Past a month the gentler start comes with it, as it always did.
  const b6 = sandbox();
  b6.api.days(42);
  b6.api.applyPause("shift");
  assert.equal(b6.profile.returning, true, "six weeks away lost the gentler start");
});

test("BLOCKER: the sheet offers what the tiers say — picking up to four weeks, recommended to a fortnight", () => {
  // Derived from the tiers, not typed: every length the sheet offers, against the tier it falls in.
  for (const d of [3, 7, 14, 21, 28, 42, 70]) {
    const box = sandbox();
    box.api.days(d);
    const html = box.api.pausePlanHtml();
    const tier = box.api.pauseTierFor(d).id;
    const has = (id: string) => new RegExp('data-pauseopt="' + id + '"').test(html);
    const rec = (id: string) => new RegExp('po-opt rec" data-pauseopt="' + id + '"').test(html);
    assert.equal(has("pickup"), tier === "resume" || tier === "rebuild", d + " days: picking up offered wrongly");
    assert.equal(rec("pickup"), tier === "resume", d + " days: picking up recommended wrongly");
    assert.equal(has("shift"), tier === "rebuild" || tier === "reentry", d + " days: starting again offered wrongly");
    assert.equal(rec("shift"), tier === "rebuild" || tier === "reentry", d + " days: starting again not recommended where offered");
    assert.ok(has("keep") && !rec("keep"), d + " days: keeping the date is not offered, or is recommended");
    assert.equal(rec("none"), tier === "nudge", d + " days: leaving the plan alone recommended wrongly");
    assert.equal((html.match(/po-opt rec"/g) || []).length, 1, d + " days: not exactly one recommendation");
  }
  // A plan that is not running — already paused — has no week to pick up from.
  const box = sandbox();
  box.api.days(14); box.api.applyPause("pickup");
  box.api.days(14);
  assert.ok(!/data-pauseopt="pickup"/.test(box.api.pausePlanHtml()), "a paused plan is offered picking up again");
});

test("BLOCKER: a week held before the restart is out of sight and out of reach, and keeps its number", () => {
  const box = sandbox();
  box.api.days(14); box.api.applyPause("pickup");
  const f = box.api.firstShownWeek();
  const weeks = box.api.plan().weeks;
  // ⚠️ KEPT, NOT DROPPED: week N is still PLAN.weeks[N - 1] for every reader that indexes it that way.
  weeks.forEach((w: any, i: number) => assert.equal(w.index, i + 1, "week " + w.index + " is no longer at position " + i));
  assert.ok(f > 0, "nothing is held");
  // The ease offer never offers a held week (it would read "already a light week" for a week nobody can see).
  assert.ok(box.api.easeWeekOptions().every((o: any) => o.i >= f), "the ease offer lists a week held before the restart");
  // And every screen that lists weeks starts at the first one on show — guarded at the source, the screens being
  // beyond this sandbox: the Plan list and chart, the calendar, Today's week band (and its scroll), a week-move.
  const shownFrom: [string, RegExp][] = [
    ["weekList", /PLAN\.weeks\.slice\(firstShownWeek\(\)\)/], ["viewPlan", /const shown = PLAN\.weeks\.slice\(firstShownWeek\(\)\)/],
    ["viewCalendar", /PLAN\.weeks\.slice\(firstShownWeek\(\)\)/], ["weekStrip", /if \(wi < first\) return ""/],
    ["curWeekIdx", /Math\.max\(firstShownWeek\(\),/], ["xwRefusal", /PLAN\.weeks\[ti\]\.beforeStart/],
  ];
  for (const [name, re] of shownFrom) assert.match(decomment(fnBody(name)), re, name + " shows or reaches a held week");
  assert.match(decomment(SRC), /band\.scrollLeft = \(curWeekIdx\(\) - first\) \* pageW\(\)/, "the week band scrolls to the wrong page");
});

test("BLOCKER: a week held before the restart is never evidence — no \"add a day\" on one session after a pause", () => {
  // ⚠️ FOUND WHILE BUILDING THIS: a held week prescribes nothing, so three of them and one run since read as full
  // completion, and the add-a-day offer (85% of the last three weeks) would ask for another day a week after the
  // runner came back. When a pause restarted the plan those weeks did not exist, so it could not.
  const box = sandbox();
  box.api.days(14); box.api.applyPause("pickup");
  box.clock.today = addDays(WED, 21); box.launch();
  const f = box.api.firstShownWeek(), cw = box.api.cw();
  assert.ok(cw - f === 1, "the fixture is not one week after the restart");
  const ev = box.api.addDayEvidence("build");
  assert.ok(ev, "no evidence was gathered at all");
  assert.equal(ev.recentWeeks.length, 1, "a week held before the restart was counted as evidence (" + ev.recentWeeks.length + " weeks)");
  assert.ok(ev.recentWeeks.every((w: any) => w.prescribedRuns > 0), "an empty week is being judged");
});

test("BLOCKER: a profile edit keeps a pause's layout, and everything that starts a plan afresh drops it", () => {
  // draftFromForm REPLACES the profile, so a field it leaves out is gone: saving a name after picking up would have
  // started the block again from week 1 — formStartIso's own defect, one field over.
  const draft = decomment(fnBody("draftFromForm"));
  assert.match(draft, /const keepsBlock = state\.screen !== "wizard" && startDateIso === \(profile\.startDateIso \|\| ""\) && !!profile\.blockFromIso;/);
  assert.match(draft, /\.\.\.\(keepsBlock \? \{ blockFromIso: profile\.blockFromIso, pauseWeeks: Number\(profile\.pauseWeeks\) \|\| 0 \} : \{\}\)/);
  // A plan used again, and B6's "start again from this week", are laid out from today.
  assert.match(decomment(fnBody("reusePlan")), /profile\.blockFromIso = ""; profile\.pauseWeeks = 0;/);
  assert.match(decomment(fnBody("realignOptions")), /startDateIso: todayIso\(\), blockFromIso: "", pauseWeeks: 0/);
  // B6's "pick up where you left off" moves the day the block is laid out from, not the day it started again.
  assert.match(decomment(fnBody("realignPickup")), /isoAdd\(blockStartIso\(profile\), 7 \* w\)/);
  assert.match(decomment(fnBody("answerRealign")), /Object\.assign\(profile, o\.pick\.changes\)/);
  // The two fields travel with the others that make a plan (the plan history, reuse's restore).
  assert.match(constStmt("PLAN_PROF_FIELDS"), /"blockFromIso", "pauseWeeks"/);
  // A stale value can never lay a block out from later than it starts.
  const box = sandbox();
  assert.equal(box.api.blockStartIso({ startDateIso: START, blockFromIso: addDays(START, 7) }), START);
  assert.equal(box.api.blockStartIso({ startDateIso: START, blockFromIso: addDays(START, -7) }), addDays(START, -7));
});
