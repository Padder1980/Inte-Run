import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";
import { longCapNote } from "../src/plan/generate-plan.ts";

/**
 * STAGE B8 IN THE APP: the three training preference dials on the Training rhythm questions and in the wizard —
 * what each saves, what reaches the engine, where each hides (exactly where the engine would ignore it), the long-run
 * limits offered (the engine's own choices, kept as they are offered), and the preview that shows each effect before
 * saving. The engine's half is test/preference-dials.test.ts.
 *
 * The real form readers, question builders, applyProfile and profileImpact, lifted out of the built page over the
 * real engine. The DOM is a stand-in holding only the fields a test puts on screen, so "not on screen" is real.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function longMaxQHtml(");
  assert.ok(marker >= 0, "longMaxQHtml is not in the build — run node web/app.ts");
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
const START = MONDAY;
const RACE = addDays(MONDAY, 7 * 19 + 6);

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "esc", "applyProfile", "planStartIso", "blockStartIso", "holdBeforeStart",
  "firstShownWeek", "returnKind", "adoptPlan", "recompute", "normalizeWeekStarts", "computeToday", "planDefaultWeek",
  "profileImpact", "profileImpactHtml", "reentryKm", "bRaceWindow", "bRaceAhead", "bRacePlaced", "raceKeyOf", "loadAdjust",
  "legacySid", "sidKeys",
  // B8
  "longMaxRange", "longMaxQHtml", "syncLongMaxQ", "hardDialWhy", "formAgeNow", "hardQHtml", "syncHardQ", "growthQHtml",
  "syncGrowthQ", "seg", "wizFieldVal", "draftFromForm", "formStartIso", "isBeginnerStatus", "goalsForAge",
  "currentAgeAnswer", "derivedGoalS", "longMaxKept", "experienceFor", "resolvedStatus", "trainingYearsFor", "typeCeilingFor"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJ_QUALITY", "PRIMARY_TYPES", "B_RACE_NAME", "B_RACE_IN_A_SENTENCE", "ADJUST_KEY",
  "SKIP_KEEP_DAYS", "GROWTH_OPTS", "HARD_OPTS", "LONG_RANGE_MEMO", "GOAL_BY_STATUS", "SETUP_TOPICS", "PLAN_PROF_FIELDS"];

type Pf = Record<string, any>;
// A 10K on six days at 40 km a week, nineteen weeks out: the engine offers 82 and 90 minutes (and 82, 90 and 105 on four
// days), so the list has more than one choice and visibly changes with the days.
const BASE: Pf = { status: "regular", goalDist: "10k", targetS: 2640, targetSet: true, raceDate: RACE, startDateIso: START,
  longRunDay: 6, recentTimeS: 1500, noRecent: false, twoKmS: 0, daysPerWeek: 6, volKm: 40, strength: false, returning: "",
  age: 40, bRace: null, personalized: true, fitSrc: "recent", recentDistM: 5000, easyPaceS: 0, autoPace: false };

function sandbox(o: Pf = {}) {
  const els: Record<string, any> = {};
  const $ = (id: string) => els[id] ?? null;
  const put = (id: string, value = "") =>
    (els[id] = { id, value, innerHTML: "", textContent: "", style: { display: "" }, listeners: {} as Record<string, unknown[]>,
      addEventListener(ev: string, fn: unknown) { (this.listeners[ev] ||= []).push(fn); } });
  const box: any = { els, put, calls: [] as string[], profile: { ...BASE, ...o } };
  const draft: Pf = { status: box.profile.status, days: String(box.profile.daysPerWeek), __f: {} };
  box.draft = draft;
  const state: Pf = { dayOverride: {}, done: {}, planWeek: 1, selWeek: 0, selDay: 0, screen: "setup" };
  box.state = state;
  const store: Record<string, string> = {};
  const env: Record<string, unknown> = {
    RC, profile: box.profile, draft, state, todayIso: () => WED, console: { warn: () => {}, log: () => {} }, $,
    document: { querySelectorAll: () => [] }, ensureSheet: () => {}, SHEET_CTX: null,
    localStorage: { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; } },
    strengthPrefsOf: () => null, progActive: () => false,
    todayTicks: () => [], restoreTicks: () => {}, seedDone: () => {}, saveProfileStore: () => {},
    saveDayOverride: () => {}, closeSheet: () => {}, render: () => {},
    linkFormLabels: () => box.calls.push("link"), applySetupFocus: () => box.calls.push("focus"),
    strMinVal: () => 30, strLevelVal: () => "beginner", strGoalVal: () => "general", kitFromField: () => [],
    kitToField: () => "-", strengthKitOf: () => [],
  };
  const src = "let PLAN, RAW, FITNESS, CLASS, MASTERS, XWEEK = {}, RACE_DRAFT = null;\n" +
    "let CURRENT_WEEK = 0, TODAY_DOW = 0, TODAY_IN_PLAN = false;\n" +
    CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") +
    ", GROWTH_OPTS, HARD_OPTS, SETUP_TOPICS, PLAN_PROF_FIELDS, plan: () => PLAN, raw: () => RAW };")(...names.map((n) => env[n]));
  box.api.recompute();
  return box;
}
/** Put the setup form's own fields on the stand-in page, as a regular runner's form has them. */
function formOn(box: any, extra: Pf = {}) {
  const p = box.profile;
  const f: Pf = { s_rectime: "25:00", s_dist: p.goalDist, s_target: "44:00", s_date: p.raceDate, s_longday: String(p.longRunDay),
    s_startdate: p.startDateIso, s_volume: String(p.volKm || ""), s_age: String(p.age ?? ""), s_name: "", s_sex: "", s_2km: "",
    s_strkit: "-", ...extra };
  for (const [k, v] of Object.entries(f)) if (v !== null) box.put(k, v);
}
const opts = (html: string) => [...html.matchAll(/<option value="(\d+)"( selected)?>([^<]*)<\/option>/g)]
  .map((m) => ({ v: Number(m[1]), on: !!m[2], t: m[3]! }));
const longestOf = (raw: any) => Math.max(0, ...raw.weeks.flatMap((w: any) => w.sessions).filter((s: any) => s.type === "long")
  .map((s: any) => Math.round(s.estimatedDurationSeconds / 60)));

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: each answer reaches the engine — and a default sends nothing at all", () => {
  const box = sandbox();
  const { applyProfile } = box.api;
  const plain = applyProfile({ ...box.profile });
  const defaults = applyProfile({ ...box.profile, volGrowth: "progressive", hardDays: "balanced", longMax: 0 });
  for (const k of ["volumeGrowth", "hardDays", "longRunMaxMinutes"])
    assert.ok(!(k in defaults.ath), "a default answer still sent " + k + " to the engine");
  assert.deepEqual(defaults.raw.weeks, plain.raw.weeks, "the defaults changed the plan");
  const set = applyProfile({ ...box.profile, volGrowth: "steady", hardDays: "challenging", longMax: 75 });
  assert.equal(set.ath.volumeGrowth, "steady");
  assert.equal(set.ath.hardDays, "challenging");
  assert.equal(set.ath.longRunMaxMinutes, 75);
  // Junk is not an answer.
  const junk = applyProfile({ ...box.profile, volGrowth: "fast", hardDays: "max", longMax: "abc" });
  for (const k of ["volumeGrowth", "hardDays", "longRunMaxMinutes"]) assert.ok(!(k in junk.ath), "junk reached the engine as " + k);
  // Recorded in the plan history with every other plan-shaping answer, and edited on the Training rhythm topic.
  for (const f of ["volGrowth", "hardDays", "longMax"]) assert.ok(box.api.PLAN_PROF_FIELDS.includes(f), f + " is not a plan-shaping field");
  for (const k of ["growth", "hard", "s_longmax"]) assert.ok(box.api.SETUP_TOPICS.rhythm.includes(k), k + " is not on the Training rhythm topic");
});

test("BLOCKER: the form saves what is on screen, the stored answer when it is not, and no long-run limit in the wizard", () => {
  const box = sandbox({ volGrowth: "gradual", hardDays: "comfortable", longMax: 75 });
  formOn(box);
  const { draftFromForm } = box.api;
  // Nothing on screen for the dials: the stored answers ride through.
  let pf = draftFromForm();
  assert.equal(pf.volGrowth, "gradual"); assert.equal(pf.hardDays, "comfortable"); assert.equal(pf.longMax, 75);
  // On screen: what the runner picked, "0" meaning no limit.
  box.draft.growth = "steady"; box.draft.hard = "challenging"; box.put("s_longmax", "0");
  pf = draftFromForm();
  assert.equal(pf.volGrowth, "steady"); assert.equal(pf.hardDays, "challenging"); assert.equal(pf.longMax, 0, "No limit did not clear the limit");
  box.els.s_longmax.value = "90";
  assert.equal(draftFromForm().longMax, 90);
  // A new plan starts without a limit: the wizard has no long-run question (it needs a built plan to know its choices).
  box.state.screen = "wizard";
  assert.equal(draftFromForm().longMax, 0, "the wizard carried a long-run limit into a new plan");
  // A runner who never answered gets the defaults.
  const fresh = sandbox();
  formOn(fresh);
  const f = fresh.api.draftFromForm();
  assert.equal(f.volGrowth, "progressive"); assert.equal(f.hardDays, "balanced"); assert.equal(f.longMax, 0);
});

test("BLOCKER: the long-run question offers exactly the engine's choices, each kept as offered — and a saved limit stays on screen", () => {
  const box = sandbox();
  const { longMaxQHtml, longMaxRange, applyProfile } = box.api;
  const r = longMaxRange(box.profile);
  assert.ok(r && r.choices.length >= 2, "the fixture offers no long-run choices: " + JSON.stringify(r));
  const html = longMaxQHtml(box.profile);
  const o = opts(html);
  assert.deepEqual(o.map((x) => x.v), [0, ...r.choices], "the options are not No limit plus the engine's choices");
  assert.ok(o[0]!.on && /^No limit — up to /.test(o[0]!.t), "No limit is not the first, selected option");
  assert.match(html, /These are the lengths your plan can keep\. The shortest is /);
  // ⚠️ EVERY OPTION, THROUGH THE APP'S OWN applyProfile, IS THE PLAN'S LONGEST LONG RUN, WITH NO NOTE.
  for (const c of r.choices) {
    const out = applyProfile({ ...box.profile, longMax: c });
    const got = longestOf(out.raw);
    assert.ok(got <= c && got >= c - 2, "the " + c + "-minute option gave a " + got + "-minute long run");
    assert.ok(!out.plan.notes.some((n: string) => /^You asked for long runs/.test(n)), "the " + c + "-minute option came with a note");
  }
  // A saved limit off the list stays on screen and selected, so nothing moves without the runner — and it is marked
  // only when the engine cannot keep it. Measured on this plan: 84 minutes is off the quarter-hour list and kept
  // exactly; 60 is under what a 10K needs and becomes 82, with a note.
  for (const [saved, keptAsIs] of [[r.choices[0] + 2, true], [60, false]] as const) {
    const out = applyProfile({ ...box.profile, longMax: saved });
    assert.equal(!out.plan.notes.some((n: string) => /^You asked for long runs/.test(n)), keptAsIs, "the fixture moved: " + saved);
    const o2 = opts(longMaxQHtml({ ...box.profile, longMax: saved }));
    const row = o2.find((x) => x.v === saved);
    assert.ok(row && row.on, "a saved " + saved + "-minute limit vanished from the question");
    assert.equal(/can’t be kept exactly/.test(row!.t), !keptAsIs, saved + ": marked " + JSON.stringify(row!.t));
    assert.equal(o2.filter((x) => x.on).length, 1);
  }
});

test("BLOCKER: the long-run question hides exactly where the engine does not read the limit — but never over a saved one", () => {
  // A beginner's ladder, run-walk, a young runner: null, hidden, and the engine ignores a stored limit there.
  for (const o of [{ status: "building" }, { age: 15 }]) {
    const box = sandbox(o);
    const q = box.api.longMaxQHtml({ ...box.profile, longMax: 60 });
    assert.equal(q, "", JSON.stringify(o) + ": the long-run question shows where the engine does not read it");
    const a = box.api.applyProfile({ ...box.profile, longMax: 60 }), b = box.api.applyProfile({ ...box.profile });
    assert.deepEqual(a.raw.weeks, b.raw.weeks, JSON.stringify(o) + ": a hidden long-run limit changed the plan");
  }
  // A plan whose long run is already as short as it can keep: hidden — unless a limit is saved, when it shows with
  // only No limit and that limit, and says what to do.
  const tight = sandbox({ goalDist: "marathon", targetS: 14400, daysPerWeek: 4, volKm: 0, raceDate: addDays(MONDAY, 7 * 9 + 6) });
  const r = tight.api.longMaxRange(tight.profile);
  assert.ok(r && !r.choices.length, "the tight fixture has choices after all: " + JSON.stringify(r));
  assert.equal(tight.api.longMaxQHtml(tight.profile), "", "a question with nothing to offer is on screen");
  const saved = tight.api.longMaxQHtml({ ...tight.profile, longMax: 120 });
  assert.deepEqual(opts(saved).map((x) => x.v), [0, 120], "a saved limit with no choices is not reachable");
  assert.match(saved, /Choose No limit to clear this/);
});

test("BLOCKER: the long-run question follows the answers that shape the plan, and every route to it is wired", () => {
  const box = sandbox();
  formOn(box);
  box.put("longMaxWrap");
  box.api.syncLongMaxQ();
  const six = opts(box.els.longMaxWrap.innerHTML).map((x) => x.v);
  assert.deepEqual(six, [0, ...box.api.longMaxRange(box.profile).choices], "the rebuilt question is not this plan's");
  assert.ok(box.calls.includes("link") && box.calls.includes("focus"), "a rebuilt question was not re-linked and re-focused");
  // Fewer days: a different plan, and the question rebuilt from it — not the six-day list.
  box.draft.days = "4";
  box.api.syncLongMaxQ();
  const four = box.api.longMaxRange({ ...box.profile, daysPerWeek: 4 });
  const shown = opts(box.els.longMaxWrap.innerHTML).map((x) => x.v);
  assert.deepEqual(shown, four && four.choices.length ? [0, ...four.choices] : [], "the question kept the six-day list after a change to four days");
  assert.notDeepEqual(shown, six, "the fixture's four- and six-day lists are the same, so this proves nothing");
  // A form with an answer that cannot be read leaves the question as it was rather than guessing.
  const before = box.els.longMaxWrap.innerHTML;
  box.els.s_rectime.value = "fast";
  box.api.syncLongMaxQ();
  assert.equal(box.els.longMaxWrap.innerHTML, before);
  // ⚠️ REACHABILITY: a sync nothing calls is the "looks live, does nothing" defect.
  const seg = decomment(fnBody("bindSegButtons"));
  assert.match(seg, /s\.dataset\.set === "days" \|\| s\.dataset\.set === "status"\) \{ syncHardQ\(\); syncGrowthQ\(\); syncLongMaxQ\(\); \}/,
    "a change of days or status does not rebuild the three dials");
  const wire = decomment(fnBody("wire"));
  assert.match(wire, /\["s_volume", "s_rectime", "s_2km", "s_age", "s_easypace", "s_startdate"\]\.forEach\(\(id\) => \{ const f = \$\(id\); if \(f\) f\.addEventListener\("change", syncLongMaxQ\); \}\);/,
    "the fields that shape the plan do not rebuild the long-run question");
  assert.match(wire, /const gc = \$\("goalCard"\); if \(gc\) gc\.addEventListener\("change", syncLongMaxQ\);/, "a change of race does not rebuild it");
  assert.match(wire, /const ag = \$\("s_age"\); if \(ag && \$\("hardQ"\)\) ag\.addEventListener\("change", syncHardQ\);/, "a change of age does not re-check the hard-days question");
  // And the wrapper the sync writes into is always rendered.
  assert.match(SRC, /'<div id="longMaxWrap">' \+ longMaxQHtml\(p\) \+ '<\/div>'/, "the long-run question has no wrapper to rebuild into");
});

test("BLOCKER: hard days hide exactly where the engine ignores them, and say why", () => {
  const box = sandbox();
  const { hardDialWhy, applyProfile } = box.api;
  let shown = 0, changes = 0;
  for (const status of ["new", "building", "regular", "competitive"])
    for (const days of [3, 4, 5, 6])
      for (const age of [15, 40]) {
        if ((status === "new" || status === "building") && days > 4) continue;
        const why = hardDialWhy(status, days, age);
        const pf = { ...box.profile, status, daysPerWeek: days, age, volKm: status === "new" || status === "building" ? 0 : 40,
          goalDist: "10k", targetS: 2700 };
        const plain = JSON.stringify(applyProfile(pf).raw.weeks);
        const moved = ["comfortable", "challenging"].filter((h) => JSON.stringify(applyProfile({ ...pf, hardDays: h }).raw.weeks) !== plain);
        if (why) assert.deepEqual(moved, [], status + "/" + days + "d/" + age + ": hidden (" + why + ") but the answer still changes the plan");
        else { shown++; if (moved.length) changes++; }
        // The reason given is the true one.
        if (age === 15 && status !== "new" && status !== "building") assert.match(why, /^Under 18/);
        else if (status === "new" || status === "building") assert.match(why, /builds? up/);
        else if (days < 5) assert.match(why, /^On four days or fewer/);
        else assert.equal(why, "");
      }
  assert.ok(shown >= 4 && changes >= shown / 2, "the hard-days question is shown " + shown + " times and changes " + changes);
  // The question and its reason swap places as the answers change.
  const b = sandbox();
  formOn(b);
  b.put("hardQ"); b.put("hardWhy");
  b.api.syncHardQ();
  assert.equal(b.els.hardQ.style.display, ""); assert.equal(b.els.hardWhy.style.display, "none");
  b.els.s_age.value = "15";
  b.api.syncHardQ();
  assert.equal(b.els.hardQ.style.display, "none", "a 15-year-old is asked about hard days");
  assert.match(b.els.hardWhy.textContent, /^Under 18/);
  // The wizard asks it after age, so the same rule there.
  assert.match(decomment(SRC), /draft\.status === "new" \|\| draft\.status === "building" \|\| RC\.youthLimitsFor\(RC\.ageAnswer\(wizFieldVal\("s_age"\)\)\) \? "" :/,
    "the wizard asks a young runner about hard days");
});

test("BLOCKER: the growth question needs a mileage to grow from, and never shows on a beginner track", () => {
  const box = sandbox();
  formOn(box);
  box.put("growthQ"); box.put("growthWhy");
  box.api.syncGrowthQ();
  assert.equal(box.els.growthQ.style.display, ""); assert.equal(box.els.growthWhy.style.display, "none");
  box.els.s_volume.value = "";
  box.api.syncGrowthQ();
  assert.equal(box.els.growthQ.style.display, "none", "growth asked with no mileage to grow from");
  assert.equal(box.els.growthWhy.style.display, "", "the reason is not given");
  // A beginner's mileage question is hidden and its number dropped at save, so growth hides with it, reason and all.
  box.els.s_volume.value = "40";
  box.draft.status = "building";
  box.api.syncGrowthQ();
  assert.equal(box.els.growthQ.style.display, "none", "growth asked on a beginner track");
  assert.equal(box.els.growthWhy.style.display, "none", "a beginner is told to type a mileage they are not asked for");
  assert.match(box.api.growthQHtml({ ...box.profile, status: "building" }), /id="growthQ" style="display:none"/);
  // And the engine agrees: a beginner's plan and a plan without a mileage are the same whatever is asked.
  for (const pf of [{ ...box.profile, status: "building", volKm: 0 }, { ...box.profile, volKm: 0 }]) {
    const a = box.api.applyProfile(pf), b = box.api.applyProfile({ ...pf, volGrowth: "steady" });
    assert.deepEqual(b.raw.weeks, a.raw.weeks, "a hidden growth answer changed the plan");
  }
});

test("BLOCKER: the preview shows each dial's effect before saving, and a dial the engine moved says so there and on the Plan screen", () => {
  const box = sandbox();
  const { profileImpact, profileImpactHtml, longMaxRange } = box.api;
  const label = (imp: any) => imp.rows.map((r: any) => r.label);
  const hard = profileImpact({ ...box.profile, hardDays: "challenging" });
  assert.ok(label(hard).includes("Hard sessions across the plan") || hard.steppedBack.length,
    "a second hard day is neither shown nor explained: " + JSON.stringify(hard.rows));
  const r = longMaxRange(box.profile);
  const cap = profileImpact({ ...box.profile, longMax: r.choices[0] });
  const row = cap.rows.find((x: any) => x.label === "Longest long run");
  assert.ok(row, "a long-run limit does not show in the preview");
  assert.equal(row.now, r.choices[0] + " min", "the preview's longest long run is not the choice");
  const grow = profileImpact({ ...box.profile, volGrowth: "steady" });
  assert.ok(label(grow).includes("Biggest week") || grow.steppedBack.length, "less growth is neither shown nor explained");
  // A limit the plan cannot keep (under what a 10K needs): the preview says so, in the Plan screen's own words.
  const odd = profileImpact({ ...box.profile, longMax: 60 });
  assert.ok(odd.steppedBack.includes(longCapNote(60, 82, "race")), "a moved limit is not explained before saving: " + odd.steppedBack);
  assert.match(profileImpactHtml(odd), /class="pi-warn">You asked for long runs of up to 60 minutes\. Your longest is 82 minutes/);
  // The Plan screen keeps every "You asked for…" note.
  assert.match(decomment(SRC), /\|You asked for\/\.test\(n\)\)/, "the Plan screen drops the dials' notes");
});
