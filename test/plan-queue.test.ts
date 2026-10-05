import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

/**
 * STAGE B9 — THE PLAN QUEUE, PLANS SAVED FOR LATER, AND THE HANDOVER AFTER RACE DAY (PLAN.md): a plan saved from
 * the wizard's last step, Your plans in five lists, one start path for every stored plan (adoptProf), the runner's
 * own state kept when it is newer, the plan history that no longer splits a paused plan in two, Today's "what
 * next?" after race day with its dates, a recovery week, and the race turned into a fitness offer.
 *
 * The real functions, lifted out of the built page over the real engine. The DOM is a stand-in that keeps what a
 * sheet or a screen writes and the handlers it wires, so the test taps the controls the runner taps.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function adoptProf(");
  assert.ok(marker >= 0, "adoptProf is not in the build — run node web/app.ts");
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
/** A Sunday race ten weeks from this Monday: the plan the runner is on. */
const RACE = addDays(MONDAY, 7 * 10 + 6);

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "esc", "fmtTimeFull", "fmtPace", "applyProfile", "planStartIso", "blockStartIso",
  "holdBeforeStart", "firstShownWeek", "returnKind", "adoptPlan", "recompute", "normalizeWeekStarts", "computeToday",
  "planDefaultWeek", "loadAdjust", "legacySid", "sidKeys", "saveProfileStore", "pauseTierFor", "pauseChanges",
  // the plan history and Your plans
  "journalSync", "journalSig", "loadJournals", "saveJournals", "journalUpdate", "planProfSnapshot", "planName",
  "planCreatedIso", "planDistLabel", "planBadge", "planHue", "planFinished", "viewPlans", "queueCard", "openRenameSheet",
  "reusePlan",
  // B9
  "loadQueue", "saveQueue", "queueAdd", "queueUpdate", "queueRemove", "queueNext", "queueName", "storedDates",
  "adoptSnapshot", "adoptRestore", "adoptProf", "storedFitnessLine", "planStartSheet", "queueAfterOk", "startStored", "queueStored",
  "deleteQueued", "startQueued", "wizardSaveLater", "loadHandover", "saveHandover", "racePassed", "recoveryStartIso",
  "currentHandover", "raceResult", "raceFitCheck", "handoverCard", "answerHandover", "recoveryCard", "endRecovery",
  "pausedCard", "loadLinks", "saveFitSuggest", "fitSuggestBanner", "applyFitSuggest", "todayDecision", "todayNextUp"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJ_QUALITY", "PRIMARY_TYPES", "ADJUST_KEY", "SKIP_KEEP_DAYS", "JOURNAL_KEY",
  "PLAN_PROF_FIELDS", "RUNNER_STATE_FIELDS", "QUEUE_KEY", "HANDOVER_KEY", "QUEUE_MAX", "LINK_KEY", "RACE_LABEL", "RACE_KM",
  "RACE_FIT_MIN", "PLAN_HUES", "PAUSE_TIERS"];

const PROFILE = (o: Record<string, unknown> = {}) => ({ status: "regular", goalDist: "10k", targetS: 2700, targetSet: true,
  raceDate: RACE, startDateIso: START, longRunDay: 6, fitSrc: "recent", recentDistM: 5000, recentTimeS: 1500, noRecent: false,
  easyPaceS: 0, twoKmS: 0, daysPerWeek: 5, volKm: 40, strength: false, returning: "", age: 40, sex: "", bRace: null,
  personalized: true, name: "Sam", avatar: "data:image/png;base64,AAAA", ...o } as any);

function sandbox(o: { today?: string; profile?: Record<string, unknown>; draftPf?: any } = {}) {
  // ⚠️ A CLOCK THAT ONLY MOVES FORWARD: "which is newer" (the runner's stamp, a plan's createdAt) must never tie on
  // a fast machine, and it starts at a real date so a row's createdIso compares the way it does on a phone.
  const clock = { today: o.today || WED, now: Date.parse(WED + "T12:00:00Z") };
  const FakeDate = class extends Date { static override now() { clock.now += 1000; return clock.now; } };
  const store: Record<string, string> = {};
  const els: Record<string, any> = {};
  const sheetIds = new Set<string>();
  const mk = (id: string) => (els[id] = { id, innerHTML: "", value: "", onclick: null as null | (() => void), classList: { add: () => {} },
    querySelectorAll: () => [], focus: () => {} });
  // ⚠️ AN ELEMENT EXISTS ONLY IF THE LAST SHEET DREW IT, so "is there a Start it after your race button?" is
  // answered by the markup and not by the stand-in. A new sheet forgets the old one's buttons.
  const $ = (id: string) => els[id] ||
    (els.sheetBody && els.sheetBody.innerHTML.includes('id="' + id + '"') ? (sheetIds.add(id), mk(id)) : null);
  const box: any = { clock, els, store, toasts: [] as string[], undo: null as null | (() => void), calls: [] as string[],
    profile: PROFILE(o.profile) };
  const state: any = { dayOverride: {}, done: {}, planWeek: 1, selWeek: 0, selDay: 0, logged: [], hist: [], fitSuggest: null,
    screen: null, tab: "today", wizErr: null, wizStep: 0 };
  box.state = state;
  const env: Record<string, unknown> = {
    RC, profile: box.profile, state, todayIso: () => clock.today, console: { warn: () => {}, log: () => {} }, $,
    Date: FakeDate,
    document: { querySelectorAll: () => [] },
    ensureSheet: () => { sheetIds.forEach((id) => delete els[id]); sheetIds.clear(); mk("sheetBody"); mk("sheetOv"); }, SHEET_CTX: null,
    localStorage: { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } },
    trainingYearsFor: () => 3, resolvedStatus: (p: any) => p.status, typeCeilingFor: () => undefined,
    experienceFor: (p: any) => (p.status === "new" || p.status === "building" ? "beginner" : "recreational"),
    strengthPrefsOf: () => null, progActive: () => false,
    todayTicks: () => [], restoreTicks: () => {}, seedDone: () => box.calls.push("seedDone"), saveDayOverride: () => {},
    closeSheet: () => box.calls.push("closeSheet"), render: () => box.calls.push("render"),
    startWizard: () => box.calls.push("startWizard"), captureSetupFields: () => {},
    draftFromForm: () => { if (!o.draftPf) throw new Error("no draft"); return JSON.parse(JSON.stringify(o.draftPf)); },
    ICON: { play: "", trash: "", cEdit: "", plusDot: "", rRace: "", trendUp: "", trendDown: "" },
    toast: (m: string) => box.toasts.push(m), toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
  };
  const src = "let PLAN, RAW, FITNESS, CLASS, MASTERS, XWEEK = {}, draft = {};\n" +
    "let CURRENT_WEEK = 0, TODAY_DOW = 0, TODAY_IN_PLAN = false;\n" +
    CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") +
    ", plan: () => PLAN, raw: () => RAW, inPlan: () => TODAY_IN_PLAN };")(...names.map((n) => env[n]));
  box.launch = () => { box.api.recompute(); box.api.computeToday(); };
  box.launch();
  box.json = (k: string) => JSON.parse(store[k] || "null");
  /** Tap a button the last sheet rendered, by id. */
  box.tap = (id: string) => { const h = (box.els[id] || {}).onclick; assert.ok(h, "no #" + id + " on the sheet"); h(); };
  return box;
}
/** What a plan that has started looks like, independent of how it was reached. */
const weeksOf = (box: any) => JSON.stringify(box.api.raw().weeks);
/** The handlers a screen renders, as the wire() pass binds them from #view: data-x="v" -> v. */
const attrs = (html: string, a: string) => [...html.matchAll(new RegExp("data-" + a + '="([^"]+)"', "g"))].map((m) => m[1]!);

const MARATHON_PF = () => PROFILE({ goalDist: "marathon", targetS: 14400, raceDate: addDays(RACE, 7 * 20), startDateIso: WED,
  daysPerWeek: 5, recentTimeS: 1440, volKm: 45, stateSig: "x", stateAt: 5 });

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: Save it for later keeps the answers in Your plans, and the plan you are on carries on untouched", () => {
  const box = sandbox({ draftPf: MARATHON_PF() });
  const before = { profile: JSON.stringify(box.profile), weeks: weeksOf(box), journal: box.store["interun_journals_v1"] };
  box.api.wizardSaveLater();
  const q = box.json("interun_queue_v1");
  assert.equal(q.length, 1, "nothing was saved");
  assert.equal(q[0].status, "draft");
  assert.equal(q[0].prof.goalDist, "marathon");
  assert.ok(q[0].weeks > 10, "the saved plan does not know its own length: " + q[0].weeks);
  // ⚠️ THE ANSWERS THAT MAKE A PLAN AND NOTHING ELSE — no name, no picture, no stamp, no pause, no smaller race.
  const PPF: string[] = new Function(constStmt("PLAN_PROF_FIELDS") + " return PLAN_PROF_FIELDS;")();
  const extra = Object.keys(q[0].prof).filter((k) => !PPF.includes(k));
  assert.deepEqual(extra, [], "the saved answers carry fields that do not make a plan");
  for (const k of ["name", "avatar", "stateAt", "stateSig", "personalized"]) assert.ok(!(k in q[0].prof), "the saved answers carry " + k);
  assert.equal(q[0].prof.blockFromIso, ""); assert.equal(q[0].prof.pauseWeeks, 0); assert.equal(q[0].prof.bRace, null);
  // ⚠️ AND NOTHING ELSE MOVED: the profile, the plan, the plan history.
  assert.equal(JSON.stringify(box.profile), before.profile, "saving for later changed the profile");
  assert.equal(weeksOf(box), before.weeks, "saving for later changed the plan");
  assert.equal(box.store["interun_journals_v1"], before.journal, "saving for later wrote the plan history");
  assert.equal(box.state.screen, "plans", "the runner is not shown where it went");
  // Offered only beside a plan already running, and wired.
  assert.match(decomment(fnBody("wizBody")), /profile\.personalized && PLAN && PLAN\.weeks && PLAN\.weeks\.length\s*\?\s*'<button class="ctrl wz-later" id="wizSaveLater"/);
  assert.match(decomment(fnBody("wireWizard")), /const later = \$\("wizSaveLater"\); if \(later\) later\.onclick = wizardSaveLater;/);
  // A full queue says so rather than dropping the plan.
  for (let i = 0; i < 11; i++) box.api.queueAdd({ prof: { goalDist: "5k" }, weeks: 8 });
  box.api.wizardSaveLater();
  assert.equal(box.json("interun_queue_v1").length, 12);
  assert.match(box.state.wizErr || "", /can hold 12 saved plans/, "a full queue dropped the plan in silence");
});

test("BLOCKER: starting a saved plan is ONE path through adoptPlan — a new plan in the history — and Undo puts every part back", () => {
  const box = sandbox({ draftPf: MARATHON_PF() });
  box.api.wizardSaveLater();
  const id = box.json("interun_queue_v1")[0].id;
  const snap = { prof: JSON.stringify(box.api.planProfSnapshot()), weeks: weeksOf(box), journal: box.store["interun_journals_v1"],
    queue: box.store["interun_queue_v1"] };
  box.api.queueUpdate(id, { name: "Spring marathon" });
  box.api.startQueued(id);
  assert.match(box.els.sheetBody.innerHTML, /Race day: <b>/, "the sheet does not give the race day");
  box.tap("psNow");
  assert.equal(box.profile.goalDist, "marathon", "the saved plan did not start");
  assert.equal(box.profile.startDateIso, WED, "it did not start today");
  assert.equal(box.profile.blockFromIso, ""); assert.equal(box.profile.pauseWeeks, 0);
  // ⚠️ THROUGH adoptPlan: the plan the screen shows is the one the profile builds, and the history has a NEW row.
  assert.equal(weeksOf(box), JSON.stringify(box.api.applyProfile(box.profile).raw.weeks), "the plan is not the profile's");
  const rows = box.json("interun_journals_v1");
  assert.equal(rows.length, 2, "starting a saved plan did not record a new plan");
  assert.equal(rows[0].goal, "marathon"); assert.equal(rows[0].endedIso, "");
  assert.equal(rows[0].name, "Spring marathon", "the saved plan's name did not carry over");
  assert.equal(rows[1].endedIso, WED, "the plan it replaced was not ended today");
  assert.equal(box.json("interun_queue_v1"), null, "the plan it started is still waiting in the queue");
  // ⚠️ ONE PATH: nothing in the app assigns PLAN but adoptPlan (PLAN.md's own re-break: "adopt by assigning PLAN").
  const app = decomment(SRC);
  assert.equal([...app.matchAll(/(^|[^.\w])PLAN\s*=[^=]/gm)].length, 1, "something besides adoptPlan assigns PLAN");
  assert.match(decomment(fnBody("adoptProf")), /recompute\(\{ newPlan: true \}\)/);
  // Undo: the profile, the plan, the history and the queue, all as they were.
  box.undo();
  assert.equal(JSON.stringify(box.api.planProfSnapshot()), snap.prof, "Undo left the profile changed");
  assert.equal(weeksOf(box), snap.weeks, "Undo left the plan changed");
  assert.equal(box.store["interun_journals_v1"], snap.journal, "Undo left the plan history changed");
  assert.equal(box.json("interun_queue_v1")[0].id, id, "Undo lost the saved plan");
});

test("BLOCKER: a stored plan is built with the runner's NEWER state — theirs when it changed since, the plan's when it is newer", () => {
  // Saved first, then the runner's fitness moves on (a race, say): the start keeps the newer fitness.
  const a = sandbox({ draftPf: MARATHON_PF() });
  a.api.wizardSaveLater();
  const q = a.json("interun_queue_v1")[0];
  a.profile.recentTimeS = 1380; a.api.saveProfileStore();
  assert.ok(a.profile.stateAt > q.createdAt, "a change of fitness was not stamped");
  a.api.startQueued(q.id);
  assert.match(a.els.sheetBody.innerHTML, /Built with your current fitness: a 23:00 5K\./, "the sheet does not say which fitness");
  a.tap("psNow");
  assert.equal(a.profile.goalDist, "marathon");
  assert.equal(a.profile.recentTimeS, 1380, "starting a saved plan put the runner's fitness back to what it was");
  assert.equal(a.profile.volKm, 40, "starting a saved plan put the runner's mileage back to what it was");
  // Saved after the runner's last change (a new 5 km time typed in the wizard): the plan's answers are the newer.
  const b = sandbox({ draftPf: MARATHON_PF() });
  b.api.saveProfileStore();
  b.api.wizardSaveLater();
  const qb = b.json("interun_queue_v1")[0];
  b.api.startQueued(qb.id);
  assert.match(b.els.sheetBody.innerHTML, /Built with the fitness you gave for it: a 24:00 5K\./);
  b.tap("psNow");
  assert.equal(b.profile.recentTimeS, 1440, "the time typed for the saved plan was lost");
  // ⚠️ THE STAMP MOVES ONLY WITH THE RUNNER'S OWN STATE: a long-run day is a choice about the plan.
  const c = sandbox();
  c.api.saveProfileStore();
  const t0 = c.profile.stateAt;
  c.profile.longRunDay = 5; c.api.saveProfileStore();
  assert.equal(c.profile.stateAt, t0, "a plan choice was stamped as a change of fitness");
  c.profile.volKm = 55; c.api.saveProfileStore();
  assert.ok(c.profile.stateAt > t0, "a change of mileage was not stamped");
  // And the form carries the stamp across its whole-object replacement, or every edit would read as one.
  assert.match(decomment(fnBody("draftFromForm")), /stateSig: profile\.stateSig, stateAt: profile\.stateAt,/);
  // A past plan used again takes the same path and the same rule (its answers are as old as the row).
  assert.match(decomment(fnBody("reusePlan")), /at: Date\.parse\(\(j\.createdIso \|\| j\.startIso \|\| "1970-01-01"\) \+ "T00:00:00Z"\)/);
});

test("BLOCKER: a pause, a restart and a moved race day are the SAME plan in the history; a new goal or a new plan is a new one", () => {
  // Measured before the fix: a pickup pause, a restart, a long pause and a race-date edit each wrote a new row and
  // ended the old one — Your plans would have listed the paused plan as stopped early beside a copy of itself.
  const box = sandbox();
  const rows = () => box.json("interun_journals_v1");
  assert.equal(rows().length, 1);
  const sig = rows()[0].sig;
  for (const [kind, days] of [["pickup", 14], ["shift", 14], ["keep", 35]] as const) {
    const b = sandbox();
    Object.assign(b.profile, b.api.pauseChanges(kind, days));
    b.launch();
    const r = b.json("interun_journals_v1");
    assert.equal(r.length, 1, kind + " " + days + ": a pause became a new plan in the history");
    assert.equal(r[0].endedIso, "", kind + ": the plan was ended by its own pause");
    assert.equal(r[0].prof.raceDate, b.profile.raceDate, kind + ": the row does not follow the moved race day");
    const end = Date.parse(r[0].startIso + "T00:00:00Z") + r[0].weeks * 6048e5;
    const last = b.api.plan().weeks[b.api.plan().weeks.length - 1].startIso;
    assert.equal(end, Date.parse(last + "T00:00:00Z") + 6048e5, kind + ": the row's length does not reach the plan's last week");
  }
  box.profile.raceDate = addDays(RACE, 21); box.launch();
  assert.equal(rows().length, 1, "a moved race day became a new plan");
  assert.equal(rows()[0].sig, sig, "the plan's identity changed");
  // A new goal is a new plan; so is a plan started from stored answers, even for the same goal.
  box.profile.goalDist = "half"; box.profile.targetS = 6300; box.launch();
  assert.equal(rows().length, 2, "a new goal did not start a new row");
  assert.equal(rows()[1].endedIso, WED);
  box.api.adoptProf(PROFILE({ goalDist: "half", targetS: 6000 }), { raceDate: addDays(RACE, 49), startIso: WED, at: 0 });
  assert.equal(rows().length, 3, "a stored plan started for the same goal did not record a new plan");
  // The wizard says it made a new plan too.
  assert.match(decomment(fnBody("wizardFinish")), /profile = pf; adoptPlan\(out, \{ newPlan: true \}\);/);
});

test("BLOCKER: Your plans lists the active plan, Up next, Saved for later, Finished and Stopped early — each from what it records", () => {
  const box = sandbox();
  const live = box.json("interun_journals_v1")[0];
  const old = (o: any) => ({ sig: o.sig, goal: o.goal, startIso: o.start, weeks: o.weeks, endedIso: o.ended, createdIso: o.start, name: "", ...(o.race ? { prof: { raceDate: o.race, goalDist: o.goal } } : {}) });
  box.store["interun_journals_v1"] = JSON.stringify([live,
    old({ sig: "f1", goal: "half", start: "2025-01-06", weeks: 16, ended: "2025-04-28", race: "2025-04-27" }),   // ran to race day
    old({ sig: "s1", goal: "5k", start: "2024-09-02", weeks: 10, ended: "2024-10-01", race: "2024-11-10" }),      // replaced early
    old({ sig: "f2", goal: "10k", start: "2024-01-01", weeks: 12, ended: "2024-03-22" }),                         // no answers kept: its last week
  ]);
  box.api.queueAdd({ status: "upcoming", prof: { goalDist: "half", raceDate: addDays(RACE, 7 * 16) }, weeks: 14, name: "Autumn half" });
  box.api.queueAdd({ status: "draft", prof: { goalDist: "marathon", raceDate: "2025-01-01" }, weeks: 20 });
  const html = box.api.viewPlans();
  const at = (h: string) => html.indexOf('<h2 class="sec">' + h + "</h2>");
  const order = ["Your active plan", "Up next", "Saved for later", "Finished", "Stopped early"].map(at);
  assert.ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]!)), "the five lists are missing or out of order: " + order);
  const between = (a: string, b: string) => html.slice(at(a), b ? at(b) : undefined);
  assert.match(between("Up next", "Saved for later"), /Autumn half[\s\S]*Starts after your race on/);
  assert.match(between("Saved for later", "Finished"), /Marathon plan[\s\S]*Its race day has passed: starting it sets a new one/);
  assert.match(between("Finished", "Stopped early"), /data-rpdel="f1"[\s\S]*data-rpdel="f2"/, "a plan that reached its race is not under Finished");
  assert.ok(!/data-rpdel="s1"/.test(between("Finished", "Stopped early")), "a plan replaced early is listed as finished");
  assert.match(between("Stopped early", ""), /data-rpdel="s1"/);
  // Every control the screen renders is reached by a handler bound from #view, and the title says Your plans.
  const wire = decomment(fnBody("wire"));
  for (const a of ["qstart", "qdel", "qname", "rpuse", "rpdel", "rpname"]) {
    assert.ok(attrs(html, a).length, "the screen renders no data-" + a);
    assert.match(wire, new RegExp('vw\\.querySelectorAll\\("\\[data-' + a + '\\]"\\)'), "data-" + a + " is not bound from #view");
  }
  assert.match(decomment(SRC), /\$\("topTitle"\)\.textContent = "Your plans";/);
  // A saved plan is deleted with an Undo (it never ran), and renamed in its own store.
  const id = box.json("interun_queue_v1")[1].id;
  box.api.deleteQueued(id);
  assert.equal(box.json("interun_queue_v1").length, 1);
  box.undo();
  assert.equal(box.json("interun_queue_v1").length, 2, "Undo did not bring the deleted plan back");
  box.api.openRenameSheet(id, "queue");
  box.els.rpNameIn = { value: "Big one" }; box.tap("rpNameSave");
  assert.equal(box.api.loadQueue()[1].name, "Big one", "the rename did not reach the saved plan");
});

test("BLOCKER: a saved plan can wait for the race you are training for — Up next — and come out again, each with an Undo", () => {
  const box = sandbox({ draftPf: MARATHON_PF() });
  box.api.wizardSaveLater();
  const id = box.json("interun_queue_v1")[0].id;
  box.api.startQueued(id);
  assert.match(box.els.sheetBody.innerHTML, new RegExp('id="psAfter">Start it after your race on '), "no way to queue it after the race");
  box.tap("psAfter");
  assert.equal(box.api.loadQueue()[0].status, "upcoming");
  assert.equal(box.profile.goalDist, "10k", "queueing a plan started it");
  box.api.startQueued(id);
  assert.ok(!/id="psAfter"/.test(box.els.sheetBody.innerHTML), "a plan already up next is offered the queue again");
  box.tap("psOut");
  assert.equal(box.api.loadQueue()[0].status, "draft");
  box.undo();
  assert.equal(box.api.loadQueue()[0].status, "upcoming", "Undo did not put it back up next");
  // ⚠️ ONLY BEHIND A RACE IT COMES WELL AFTER (found in the browser: a March half was offered a start after an April
  // marathon). A saved plan racing before the runner's own race is offered today, never "after your race".
  const early = sandbox();
  early.api.queueAdd({ status: "draft", prof: PROFILE({ goalDist: "half", raceDate: addDays(RACE, -14) }), weeks: 12 });
  early.api.startQueued(early.api.loadQueue()[0].id);
  assert.ok(!/id="psAfter"/.test(early.els.sheetBody.innerHTML), "a plan racing before the runner's race was offered a start after it");
  assert.match(decomment(fnBody("queueAfterOk")), /return r >= isoAdd\(liveRace, 28\)/);
  // A past plan can be queued from the same sheet: it joins the queue with its own answers' age. Its race day has
  // gone, so it is set afresh when it starts — and so it can wait.
  const b = sandbox({ profile: { raceDate: addDays(WED, -3), startDateIso: addDays(MONDAY, -70) } });
  b.profile.goalDist = "half"; b.profile.targetS = 6300; b.profile.raceDate = RACE; b.launch();
  const past = b.json("interun_journals_v1")[1];
  b.api.reusePlan(past.sig);
  b.tap("psAfter");
  const q = b.api.loadQueue()[0];
  assert.equal(q.prof.goalDist, "10k"); assert.equal(q.status, "upcoming");
  assert.equal(q.createdAt, Date.parse(past.createdIso + "T00:00:00Z"), "a past plan queued counts as freshly answered");
});

test("BLOCKER: after race day Today asks what next, once, with the dates each answer means — and nothing changes until it is answered", () => {
  const box = sandbox();
  assert.equal(box.api.handoverCard(), "", "asked before race day");
  box.clock.today = RACE; box.launch();
  assert.equal(box.api.handoverCard(), "", "asked on race day itself");
  box.clock.today = addDays(RACE, 2); box.launch();
  assert.ok(box.api.racePassed());
  // ⚠️ THE PLAN IS OVER, AND TODAY SAYS SO (found in the browser: the day after the race, Today offered last Monday's
  // easy run with "View session" and Tuesday's intervals as next up).
  const dec = box.api.todayDecision();
  assert.equal(dec.headline, "Plan finished", "Today shows a past session as today's after race day");
  assert.equal(dec.actionId, "todayPlans");
  assert.equal(box.api.todayNextUp(), null, "a session from the finished plan is offered as next");
  assert.match(decomment(fnBody("wire")), /const tpl = \$\("todayPlans"\); if \(tpl\) tpl\.onclick = \(\) => \{ state\.screen = "plans"; render\(\); \};/);
  let html = box.api.handoverCard();
  assert.deepEqual(attrs(html, "handover"), ["new", "recovery", "keep"], "the options with nothing saved");
  assert.match(html, /Easy running or rest until [^.]+\. We will ask again on /);
  // "Not now" is remembered for this race, through a relaunch; Undo brings the question back.
  box.api.answerHandover("keep");
  box.launch();
  assert.equal(box.api.handoverCard(), "", "not now was asked again");
  box.undo();
  assert.notEqual(box.api.handoverCard(), "", "Undo did not bring the question back");
  // A saved plan is offered by name, then a recovery week, until the week after the race has gone.
  box.api.queueAdd({ status: "upcoming", prof: MARATHON_PF(), weeks: 18, name: "Spring marathon", createdAt: 1 });
  html = box.api.handoverCard();
  assert.deepEqual(attrs(html, "handover"), ["next", "recovery", "keep"]);
  assert.match(html, /Start Spring marathon[\s\S]*It starts today, with race day on /);
  const monday = box.api.recoveryStartIso();
  assert.equal(new Date(monday + "T00:00:00Z").getUTCDay(), 1, "the next plan does not start on a Monday");
  assert.ok(monday >= addDays(RACE, 7), "a recovery week of under seven days");
  box.clock.today = monday;
  assert.ok(!attrs(box.api.handoverCard(), "handover").includes("recovery"), "a recovery week offered after it would have ended");
  box.clock.today = addDays(RACE, 2);
  // Nothing has changed by asking.
  assert.equal(box.profile.goalDist, "10k");
  assert.equal(box.json("interun_journals_v1").length, 1);
});

test("BLOCKER: the answers do what they say — the next plan today, or after a recovery week shown as one, and the question returns when it should", () => {
  const box = sandbox({ today: addDays(RACE, 1) });
  box.api.queueAdd({ status: "upcoming", prof: MARATHON_PF(), weeks: 18, name: "Spring marathon", createdAt: 1 });
  const monday = box.api.recoveryStartIso();
  box.api.answerHandover("recovery");
  assert.equal(box.profile.goalDist, "marathon");
  assert.equal(box.profile.startDateIso, monday, "the next plan does not start after the recovery week");
  assert.equal(box.api.handoverCard(), "", "the question is still up after it was answered");
  // ⚠️ THE CARD WHERE "PAUSED" WOULD STAND SAYS RECOVERY WEEK, and the plan can be brought forward.
  const card = box.api.pausedCard();
  assert.match(card, /Recovery week[\s\S]*Spring marathon starts on /, "the recovery week is not shown as one");
  assert.ok(!/Paused/.test(card), "a recovery week is called a pause");
  box.api.endRecovery();
  assert.equal(box.profile.startDateIso, addDays(RACE, 1), "Start it now did not start it today");
  box.undo();
  assert.equal(box.profile.startDateIso, monday, "Undo did not put the start back");
  // Without a plan to go to, the recovery week ends with the question asked again.
  const b = sandbox({ today: addDays(RACE, 1) });
  const m2 = b.api.recoveryStartIso();
  b.api.answerHandover("recovery");
  assert.equal(b.api.handoverCard(), "", "asked during the recovery week");
  assert.match(b.api.pausedCard(), /we will ask what is next/);
  b.clock.today = m2; b.launch();
  assert.notEqual(b.api.handoverCard(), "", "the question did not come back when the recovery week ended");
  // The next plan straight away, and with nothing queued the wizard or the saved plans.
  const c = sandbox({ today: addDays(RACE, 1) });
  c.api.queueAdd({ status: "upcoming", prof: MARATHON_PF(), weeks: 18, createdAt: 1 });
  c.api.answerHandover("next");
  assert.equal(c.profile.goalDist, "marathon"); assert.equal(c.profile.startDateIso, addDays(RACE, 1));
  assert.equal(c.api.loadQueue().length, 0);
  const d = sandbox({ today: addDays(RACE, 1) });
  d.api.answerHandover("new");
  assert.deepEqual(d.calls.filter((x: string) => x === "startWizard"), ["startWizard"]);
  // While it is open the weekly review steps aside — one question at a time.
  assert.match(decomment(fnBody("weeklyReviewCard")), /if \(currentHandover\(\)\) return "";/);
  assert.match(decomment(fnBody("todayCards")), /return \[handoverCard\(\), reentryCard\(\)/);
});

test("BLOCKER: the race becomes a fitness OFFER, once — never a change — and taking it survives the next plan", () => {
  const box = sandbox({ today: addDays(RACE, 1) });
  // A 10K on race day in 47:00 (GPS 10.05 km), and a warm-up jog the same day that is not the race.
  box.state.logged = [{ id: "w", dateIso: RACE, distKm: 2.1, sec: 760 }, { id: "r", dateIso: RACE, distKm: 10.05, sec: 2820 }];
  const res = box.api.raceResult();
  assert.equal(res.id, "r", "the warm-up was taken for the race");
  assert.equal(res.implied, Math.round(RC.riegelPredict(10050, 2820, 5000)), "not the engine's own Riegel");
  const prof = JSON.stringify(box.profile);
  box.api.raceFitCheck();
  const fs = box.state.fitSuggest;
  assert.ok(fs && fs.race, "no offer from the race");
  assert.equal(fs.implied, res.implied); assert.equal(fs.from, 1500); assert.equal(fs.dir, "better");
  assert.equal(JSON.stringify(box.profile), prof, "the race changed the profile by itself");
  const mmss = (t: number) => Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  assert.match(box.api.fitSuggestBanner(), new RegExp("Your 10 km on [^:]+ took 47:00, about a " + mmss(res.implied) +
    " 5K\\. Your paces use 25:00\\. Update them to match\\?"), "the offer does not say the race, the result and both fitnesses");
  // Once per race: declined, it is not offered again.
  box.state.fitSuggest = null;
  box.api.raceFitCheck();
  assert.equal(box.state.fitSuggest, null, "the race was offered twice");
  // Taken, it stamps the runner's state, so a plan saved before the race keeps the race's fitness when it starts.
  const b = sandbox({ today: addDays(RACE, 1), draftPf: MARATHON_PF() });
  b.api.wizardSaveLater();
  b.state.logged = [{ id: "r", dateIso: RACE, distKm: 10, sec: 2820 }];
  b.api.raceFitCheck();
  b.api.applyFitSuggest();
  const raced = b.profile.recentTimeS;
  assert.equal(raced, Math.round(RC.riegelPredict(10000, 2820, 5000)));
  b.api.startQueued(b.api.loadQueue()[0].id);
  b.tap("psNow");
  assert.equal(b.profile.goalDist, "marathon");
  assert.equal(b.profile.recentTimeS, raced, "starting the next plan threw the race's fitness away");
  // Not a race: too far from the distance, or no different from the paces already in use.
  const c = sandbox({ today: addDays(RACE, 1) });
  c.state.logged = [{ id: "x", dateIso: RACE, distKm: 8.5, sec: 2400 }];
  assert.equal(c.api.raceResult(), null, "an 8.5 km run was read as a 10K");
  const d = sandbox({ today: addDays(RACE, 1) });
  const same = Math.round(1500 * Math.pow(2, 1.06));
  d.state.logged = [{ id: "y", dateIso: RACE, distKm: 10, sec: same }];
  d.api.raceFitCheck();
  assert.equal(d.state.fitSuggest, null, "a race matching the paces was offered as a change");
});
