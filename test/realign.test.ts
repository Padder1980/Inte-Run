import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { weekVolumeMeters, sessionVolumeMeters } from "../src/domain/steps.ts";
import { weekView } from "../src/view/plan-summary.ts";
import { easeWeek, countTrailingMisses } from "../src/adapt/missed-sessions.ts";

/**
 * STAGE B6 (2026-10-04) — missed sessions: the app offers to get back on track, and the runner chooses.
 *
 * From what the runner actually did (the plan's runs against the runs logged — NEVER state.done, which seedDone
 * fills for every past day), three questions, quietest first: three missed runs in a row (ease back in / carry
 * on), a week without a run (pick up where you left off / start again from this week / carry on), four weeks
 * (start a new plan / start again with the gentler start / carry on). Each answer quotes what it does, once per
 * lapse, asked again only when it gets worse, and the weekly review steps aside while it is open.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function realignEvidence(");
  assert.ok(marker >= 0, "realignEvidence is not in the build — run node web/app.ts");
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
const TODAY = ISO(new Date());
const DOW = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
const MONDAY = (iso: string) => addDays(iso, -DOW(iso));
const THIS_MON = MONDAY(TODAY);

/**
 * A plan built the way applyProfile builds one — from the profile's start to its race week — whose weeks GROW
 * (week n's easy run 5 + n km), so "back to week 3" and "week 1 again" quote different, checkable distances.
 * The sandbox's recompute and realignPreview both build through it, so a quote can be held to the plan after.
 * The returning flag shortens week 1's long run, as the engine's run-in does.
 */
function buildPlan(pf: any) {
  const start = pf.startDateIso || TODAY;
  const raceMon = MONDAY(pf.raceDate);
  const n = Math.round((new Date(raceMon + "T00:00:00Z").getTime() - new Date(MONDAY(start) + "T00:00:00Z").getTime()) / (7 * 864e5)) + 1;
  const raw = Array.from({ length: n }, (_, k) => {
    const mon = addDays(MONDAY(start), 7 * k), idx = k + 1;
    const mk = (d: number, type: string, km: number, min: number) => ({ id: mon + "-d" + d + "-" + type, dayOfWeek: d, type, title: type + " w" + idx,
      intensity: type === "threshold" ? "hard" : "easy", estimatedDurationSeconds: min * 60, estimatedDistanceMeters: km * 1000,
      trainingDistanceMeters: km * 1000, steps: [{ kind: "steady", durationSeconds: min * 60, targetPaceSecPerKm: { minSecPerKm: 330, maxSecPerKm: 360 } }] });
    let sessions = k === n - 1
      ? [mk(0, "easy", 5, 30), mk(6, "race", 21, 100)]
      // A run every day, so "three missed in a row" happens whichever weekday the suite runs on.
      : [mk(0, "easy", 5 + idx, 30 + idx * 2), mk(1, "threshold", 8, 50), mk(2, "easy", 5, 30), mk(3, "easy", 6, 35),
         mk(4, "easy", 5, 30), mk(5, "easy", 5, 30), mk(6, "long", 12 + idx, (pf.returning && idx === 1 ? 50 : 70) + idx * 5)];
    if (k === 0) sessions = sessions.filter((s) => s.dayOfWeek >= DOW(start));
    return { index: idx, startDateIso: k === 0 ? start : mon, phase: "build", isDeload: false, focus: "", sessions,
      plannedDistanceMeters: weekVolumeMeters(sessions as any), qualitySessionCount: sessions.filter((s) => s.type === "threshold").length };
  });
  return { plan: { weeks: raw.map((w, i) => Object.assign(weekView(w as any), { startIso: addDays(MONDAY(start), 7 * i) })) }, raw: { weeks: raw } };
}

const FNS = ["currentHandover", "racePassed", "isoAdd", "dmon", "runDateLabelIso", "esc", "genDay", "effDay", "ovTo", "ovFrom", "loadLinks", "legacySid", "planSessionRef", "linkedRunFor",
  "loadAdjust", "saveAdjust", "adjustFor", "weekSkips", "adjDrops", "applyAdjustments", "eased", "easeWeekIn", "easeWeekOptions",
  "pauseTierFor", "pauseDaysLabel", "planStartIso", "blockStartIso", "firstShownWeek", "computeToday", "saveDayOverride", "loadReentry", "saveReentry", "reentryCapture",
  "reentryWeeks", "reentryOptions", "currentReentry", "reentryWeekLine", "reentryKm", "realignGapDays", "realignLongGapDays",
  "loadRealign", "saveRealign", "realignEvidence", "realignWeekAt", "realignPreview", "realignPickup", "realignOptions",
  "currentRealign", "realignCard", "answerRealign", "weeklyReviewCard"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJUST_KEY", "SKIP_KEEP_DAYS", "LINK_KEY", "REENTRY_KEY", "REENTRY_MODES", "REENTRY_ASK_DAYS",
  "REALIGN_KEY", "REALIGN_RANK", "REALIGN_MIN_MISSES", "PAUSE_TIERS", "ADJ_MODES", "ADJ_QUALITY", "ADJ_RUN", "PRIMARY_TYPES", "XWEEK"];

type Opts = { weeksAgo?: number; lastRun?: number | null; hist?: string[]; race?: string };
function sandbox(o: Opts = {}) {
  const store: Record<string, string> = {};
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const profile: any = { startDateIso: addDays(THIS_MON, -7 * (o.weeksAgo ?? 3)), raceDate: o.race || addDays(THIS_MON, 7 * 8 + 6), returning: false };
  const hist = (o.hist || (o.lastRun == null ? [] : [addDays(TODAY, -o.lastRun)])).map((d, i) => ({ i: "r" + i, d, k: 8, s: 2800, t: "easy" }));
  const state: any = { hist, dayOverride: {}, done: {}, trainFlag: null, planWeek: 1, selWeek: 0, selDay: 0 };
  const box: any = { store, profile, state, toasts: [] as string[], calls: [] as string[], undo: null as null | (() => void),
    review: { quiet: false, observations: ["2 runs, 16 km"], suggestion: null } };
  const PLAN: any = { weeks: [] }, RAW: any = { weeks: [] };
  box.PLAN = PLAN; box.RAW = RAW;
  const env: Record<string, unknown> = {
    PLAN, RAW, localStorage, profile, state, todayIso: () => TODAY, ICON: { alfie: "" },
    RC: { weekVolumeMeters, sessionVolumeMeters, weekView, easeWeek, countTrailingMisses },
    applyProfile: (pf: any) => buildPlan(pf),
    recompute: () => { const g = buildPlan(profile); PLAN.weeks = g.plan.weeks; RAW.weeks = g.raw.weeks; box.api.applyAdjustments(); box.calls.push("recompute"); },
    seedDone: () => box.calls.push("seedDone"), todayTicks: () => [], restoreTicks: () => {}, saveProfileStore: () => box.calls.push("saveProfileStore"),
    planDefaultWeek: () => 1, startWizard: () => box.calls.push("startWizard"), currentWeeklyReview: () => box.review,
    toast: (m: string) => box.toasts.push(m), toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
    render: () => box.calls.push("render"),
  };
  const src = "let CURRENT_WEEK = 0, TODAY_DOW = 0, TODAY_IN_PLAN = false;\n" + CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") + ", cw: () => CURRENT_WEEK, inPlan: () => TODAY_IN_PLAN };")(...names.map((n) => env[n]));
  (env.recompute as () => void)(); box.api.computeToday();
  return box;
}

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the evidence is runs logged against the plan — NEVER state.done, which seedDone fills for every past day", () => {
  // ⚠️ PLAN.md's OWN RE-BREAK: fire this from state.done and it reads "done" for somebody who has not run at all.
  const box = sandbox({ weeksAgo: 2, lastRun: null });
  box.state.done = new Proxy({}, { get: () => true });
  const ev = box.api.realignEvidence();
  assert.ok(ev.misses >= 3 || ev.tier, "a runner with no runs logged reads as up to date");
  assert.ok(!/state\.done/.test(decomment(fnBody("realignEvidence"))), "the evidence reads state.done");
  assert.match(decomment(fnBody("realignEvidence")), /RC\.countTrailingMisses\(outcomes\)/, "the misses are not the engine's own count");
});

test("BLOCKER: the three questions and their lines — three misses, a week, four weeks — read from the pause tiers", () => {
  assert.equal(sandbox().api.realignGapDays(), 7); assert.equal(sandbox().api.realignLongGapDays(), 28);
  assert.match(decomment(fnBody("realignGapDays")), /PAUSE_TIERS\[0\]\.maxDays/, "the week is typed again instead of read from the tiers");
  assert.match(decomment(fnBody("realignLongGapDays")), /PAUSE_TIERS\[2\]\.maxDays/);
  // A run yesterday: nothing to say.
  assert.equal(sandbox({ lastRun: 1 }).api.realignEvidence().tier, null);
  // Ten days, a month.
  assert.equal(sandbox({ lastRun: 10 }).api.realignEvidence().tier, "gap7");
  assert.equal(sandbox({ weeksAgo: 6, lastRun: 30 }).api.realignEvidence().tier, "gap28");
  // Three missed runs inside a week: a run 6 days ago, and the five runs since all missed.
  const m = sandbox({ lastRun: 6 }).api.realignEvidence();
  assert.equal(m.misses, 5); assert.equal(m.tier, "misses");
  // Two is the weekly review's to raise (EASE_MIN_MISSES), not this card's.
  assert.equal(sandbox({ lastRun: 3 }).api.realignEvidence().tier, null, "two missed runs raised the card");
  // ⚠️ THE GAP COUNTS FROM THE DAY BEFORE THE PLAN BEGAN, never from a run before it: a plan started yesterday has
  // missed nothing yet, whatever the history says.
  const fresh = sandbox({ weeksAgo: 0, lastRun: 40 });
  assert.ok(fresh.api.realignEvidence().gap <= 7, "a plan that has just begun counts a gap from before it began");
});

test("BLOCKER: time the runner was excused is not time missed — a break, a pause, a run linked to its session", () => {
  // A holiday that took running out ended two days ago (B5's record): the gap counts from its end.
  const box = sandbox({ lastRun: 20 });
  box.store["interun_reentry_v1"] = JSON.stringify({ id: "h", kind: "holiday", mode: "none", from: addDays(TODAY, -15), to: addDays(TODAY, -2), days: 14, answer: "quick" });
  const ev = box.api.realignEvidence();
  assert.equal(ev.active, addDays(TODAY, -2), "a booked holiday was counted as a lapse");
  assert.ok(ev.gap < 7);
  // On a break right now: nothing is being missed.
  const away = sandbox({ lastRun: 20 });
  away.store["interun_adjust_v1"] = JSON.stringify([{ id: "a", kind: "holiday", mode: "none", from: addDays(TODAY, -10), to: addDays(TODAY, 3), dropNonRun: false }]);
  assert.equal(away.api.realignEvidence(), null, "the runner was asked about missed runs during their holiday");
  // Paused: the paused card speaks.
  const paused = sandbox({ lastRun: 20 });
  paused.profile.startDateIso = addDays(TODAY, 5);
  assert.equal(paused.api.realignEvidence(), null);
  // A run linked to a session (B1) is that session done: link one to yesterday's, and nothing trails it.
  const linked = sandbox({ weeksAgo: 2, lastRun: 4 });
  assert.equal(linked.api.realignEvidence().misses, 3);
  const yIso = addDays(TODAY, -1), wi = linked.api.realignWeekAt(yIso), w = linked.PLAN.weeks[wi];
  const s = linked.RAW.weeks[wi].sessions.find((x: any) => addDays(w.startIso, x.dayOfWeek) === yIso);
  linked.store["interun_link_v1"] = JSON.stringify({ r9: { sid: s.id, wk: w.index, iso: yIso } });
  assert.equal(linked.api.realignEvidence().misses, 0, "a run linked to its session still reads as missed");
});

test("BLOCKER: each answer quotes what it does — and the plan then reads exactly that", () => {
  // A week away: pick up where you left off. The quoted week and distance are the plan's after the answer.
  const box = sandbox({ lastRun: 10 });
  const q = box.api.currentRealign();
  assert.ok(q, "ten days without a run asked nothing");
  assert.deepEqual(q.options.map((o: any) => o.id), ["pickup", "restart", "carry"]);
  assert.equal(q.options.find((o: any) => o.rec).id, "pickup", "a short gap did not recommend picking up where they left off");
  const pick = q.options.find((o: any) => o.id === "pickup");
  const raceBefore = box.profile.raceDate;
  box.api.answerRealign("pickup");
  assert.equal(box.PLAN.weeks[box.api.cw()].index, pick.pick.pre.index, "the runner is not back in the week they were promised");
  assert.equal(box.PLAN.weeks[box.api.cw()].distanceKm, pick.pick.pre.km, "that week's distance is not the one quoted");
  assert.equal(box.profile.raceDate, addDays(raceBefore, 7 * pick.pick.weeks), "the target date did not move by the weeks quoted");
  assert.ok(box.profile.startDateIso <= TODAY, "picking up left the plan paused");
  assert.ok(box.calls.includes("saveProfileStore"), "the new dates were not saved");
  // Undo puts the plan, the dates and the question back.
  box.undo();
  assert.equal(box.profile.raceDate, raceBefore);
  assert.ok(box.api.currentRealign(), "Undo did not put the question back");
  // Start again from this week: week 1, at the quoted distance.
  const r = box.api.currentRealign().options.find((o: any) => o.id === "restart");
  box.api.answerRealign("restart");
  assert.equal(box.PLAN.weeks[box.api.cw()].index, 1);
  assert.equal(box.profile.startDateIso, TODAY);
  assert.match(r.s, new RegExp("Week 1 from this week \\(" + box.PLAN.weeks[box.api.cw()].distanceKm.toFixed(1) + " km\\)"));
  // Three misses: ease back in, in the engine's "missed" words, at the distance quoted.
  const miss = sandbox({ weeksAgo: 2, lastRun: 6 });
  const mq = miss.api.currentRealign();
  assert.equal(mq.ev.tier, "misses");
  assert.deepEqual(mq.options.map((o: any) => o.id), ["ease", "carry"]);
  const e = mq.options.find((o: any) => o.id === "ease");
  assert.equal(mq.options.find((o: any) => o.rec).id, "ease");
  miss.api.answerRealign("ease");
  const row = JSON.parse(miss.store["interun_adjust_v1"])[0];
  assert.equal(row.reason, "missed", "the easier week does not carry the missed-runs wording");
  assert.equal(row.mode, "recovery"); assert.equal(row.to, addDays(row.from, 6));
  assert.equal(miss.PLAN.weeks[e.weeks[0].i].distanceKm.toFixed(1), miss.api.reentryKm(e.weeks[0].km1), "the eased week is not the distance quoted");
  assert.ok(miss.RAW.weeks[e.weeks[0].i].sessions.some((s: any) => /eased re-entry/.test(s.title)), "the swapped session is not worded as a re-entry");
});

test("BLOCKER: four weeks — a new plan is recommended, the restart gets the gentler start, carrying on never is", () => {
  const box = sandbox({ weeksAgo: 6, lastRun: 30 });
  const q = box.api.currentRealign();
  assert.deepEqual(q.options.map((o: any) => o.id), ["newplan", "restart", "carry"], "picking up a month-old week was offered");
  assert.equal(q.options.find((o: any) => o.rec).id, "newplan");
  box.api.answerRealign("restart");
  assert.equal(box.profile.returning, "break", "the restart after a month lost the gentler start");
  box.undo();
  assert.equal(box.profile.returning, false);
  box.api.answerRealign("newplan");
  assert.ok(box.calls.includes("startWizard"), "a new plan was not started");
  // Carrying on is offered everywhere and recommended nowhere past a week: the plan moved on, the runner did not.
  for (const opts of [sandbox({ lastRun: 10 }), sandbox({ lastRun: 20 })].map((b) => b.api.currentRealign().options))
    assert.ok(!opts.find((o: any) => o.id === "carry").rec, "carrying on was recommended after a week without a run");
  assert.ok(!/rearrange/i.test(decomment(fnBody("realignOptions"))), "missed work is being crammed forward");
});

test("BLOCKER: once per lapse, again only if it gets worse — and a new run starts afresh", () => {
  const box = sandbox({ lastRun: 10 });
  box.api.answerRealign("carry");
  assert.equal(box.api.currentRealign(), null, "a declined question was asked again");
  // The record keys the lapse by the last run, at the tier answered.
  const rec = JSON.parse(box.store["interun_realign_v1"]);
  assert.equal(rec.tier, "gap7"); assert.equal(rec.key, addDays(TODAY, -10));
  // Worse: the same lapse has become a month.
  const worse = sandbox({ weeksAgo: 6, lastRun: 30 });
  worse.store["interun_realign_v1"] = JSON.stringify({ key: addDays(TODAY, -30), tier: "gap7", answer: "carry" });
  assert.ok(worse.api.currentRealign(), "a lapse that got worse was not asked about again");
  // A new run is a new lapse: an answer to the old one does not silence the new.
  const fresh = sandbox({ lastRun: 10 });
  fresh.store["interun_realign_v1"] = JSON.stringify({ key: addDays(TODAY, -40), tier: "gap28", answer: "carry" });
  assert.ok(fresh.api.currentRealign(), "an answer to an older lapse silenced this one");
});

test("BLOCKER: one question at a time — it replaces the weekly review, and waits for B5's", () => {
  const box = sandbox({ lastRun: 10 });
  assert.ok(box.api.currentRealign());
  assert.equal(box.api.weeklyReviewCard(), "", "the weekly review asked its question beside this one");
  box.api.answerRealign("carry");
  assert.ok(box.api.weeklyReviewCard(), "the review stayed silent after the question was answered");
  // B9: after race day "what next?" comes first — the plan is over — then this order, unchanged.
  assert.match(decomment(fnBody("todayCards")), /return \[handoverCard\(\), reentryCard\(\), realignCard\(\), trainFlagBanner\(\), weeklyReviewCard\(\)/);
  assert.match(decomment(fnBody("currentRealign")), /if \(currentReentry\(\)\) return null;/, "both coming-back questions can show at once");
  assert.match(decomment(SRC), /document\.querySelectorAll\("\[data-realign\]"\)\.forEach\(\(b\) => \{ b\.onclick = \(\) => answerRealign\(b\.dataset\.realign\); \}\);/,
    "the answers render and do nothing");
  const html = box.api.realignCard() || sandbox({ lastRun: 10 }).api.realignCard();
  for (const id of ["pickup", "restart", "carry"]) assert.match(html, new RegExp('data-realign="' + id + '"'));
});
