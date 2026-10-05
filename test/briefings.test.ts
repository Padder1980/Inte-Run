import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

/**
 * STAGE B10 — BRIEFINGS AND INSIGHTS, RULE-BASED, FREE AND OFFLINE (PLAN.md): a short briefing on a run's sheet for
 * today or tomorrow, and an insight on a run's page after the runner says how it felt. PLAN.md's guards, each asked of
 * the real code: every number in the text is in the fact pack; no second derivation; no plan-changing call reachable
 * from the card; a medical-claim sweep.
 *
 * The whole call graph of the new functions is lifted out of the built page (the heat-custom harness's method), over
 * the REAL engine — a probe that supplied its own runVerdict or heatOffer would measure an easier program.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function briefingFacts(");
  assert.ok(marker >= 0, "briefingFacts is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  return html.slice(open + 8, close);
}
const SRC = appScript();
function fnBody(name: string): string | null {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string | null {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  if (at < 0) return null;
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  return null;
}
const decomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
const DECL = new Set<string>([...SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]!));

/** The new functions and everything they call, lifted in declaration order (the heat-custom lifter). */
const ROOTS = ["briefingCardHtml", "briefingFacts", "briefingText", "briefText", "rdReactHtml", "insightFacts", "insightText",
  "setRunReact", "seedDone", "sessionSheetHtml", "runAnalysis", "runVerdict", "lastRunOfType", "viewedRun", "wxCreditHtml"];
const STUB = new Set(["PLAN", "RAW", "RC", "syncWatch", "syncNativeReminders", "render"]);
function lift() {
  const CONSTAT = new Map<string, number>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)(?: = |, )/gm)) if (!CONSTAT.has(m[1]!)) CONSTAT.set(m[1]!, m.index!);
  const OWNER = new Map<string, string>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = [^\n]*$/gm)) {
    for (const d of m[0].matchAll(/(?:^(?:const|let) |, )([A-Za-z_$][\w$]*) = /g)) OWNER.set(d[1]!, m[1]!);
  }
  const fns = new Set<string>(), q = [...ROOTS], cq: string[] = [], seenC = new Set<string>(), stmts = new Map<string, number>();
  const scan = (text: string) => {
    for (const m of decomment(text).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (DECL.has(m[1]!)) q.push(m[1]!); else if (CONSTAT.has(m[1]!)) cq.push(m[1]!);
    }
  };
  while (q.length || cq.length) {
    while (q.length) {
      const n = q.pop()!;
      if (fns.has(n) || STUB.has(n)) continue;
      const b = fnBody(n);
      assert.ok(b != null, "dependency is not a top-level function: " + n);
      fns.add(n); scan(b!);
    }
    while (cq.length) {
      const c = cq.pop()!;
      if (seenC.has(c) || STUB.has(c)) continue;
      seenC.add(c);
      const st = constStmt(OWNER.get(c) || c);
      assert.ok(st != null, "const not found in the build: " + c);
      if (!stmts.has(st!)) { stmts.set(st!, SRC.indexOf(st!)); scan(st!); }
    }
  }
  const ordered = [...stmts.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  return "let PLAN = { weeks: [] }, RAW = { weeks: [], paces: {} };\n" +
    "const syncWatch = () => {}, syncNativeReminders = () => {};\n" +
    "let RENDERS = 0; const render = () => { RENDERS++; };\n" +
    ordered.join("\n") + "\n" + [...fns].map((n) => fnBody(n)).join("\n") + "\n" +
    "return { " + [...fns].join(", ") + ", __set: (p, r) => { PLAN = p; RAW = r; }, __state: () => state, __renders: () => RENDERS };";
}
const LIFTED = lift();

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const NOW = new Date();
const TODAY = iso(NOW);
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const TOMORROW = addDays(TODAY, 1);
const monday = (s: string) => addDays(s, -((new Date(s + "T00:00:00Z").getUTCDay() + 6) % 7));

/** A 10K block starting this Monday, as the app holds it: PLAN a display summary on Mondays, RAW the steps. */
function env() {
  const store = new MemStore();
  const athlete = { experience: "recreational", daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 } } as unknown as Athlete;
  const goal = { distance: "10k", targetTimeSeconds: 2700, raceDateIso: addDays(monday(TODAY), 7 * 12 + 6), startDateIso: monday(TODAY) } as unknown as Goal;
  const plan = generatePlan(athlete, goal, {});
  const raw = { weeks: plan.weeks, paces: deriveTrainingPaces(athlete.recent!) };
  const view = { weeks: plan.weeks.map((w: any, i: number) => ({ index: i + 1, startIso: monday(w.startDateIso), phase: w.phase,
    isDeload: w.isDeload, sessions: w.sessions.map((s: any) => ({ ...s, day: s.dayOfWeek })) })) };
  const api = new Function("localStorage", "RC", "navigator", "console", LIFTED)(store, RC, {}, { warn: () => {}, log: () => {} });
  api.__set(view, raw);
  const st = api.__state();
  st.logged = []; st.hist = []; st.subj = { soreness: "none", energy: "good", stress: "low", motivation: "high", illness: "none" };
  st.subjAnswered = false; st.subjAt = 0; st.wxHours = null; st.wx = null;
  return { api, st, store, raw, view };
}
/** Every hour of today and tomorrow at one temperature, local and UTC days both (the heat harness's own reason). */
function seedForecast(e: any, t: number) {
  const local = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const days = [...new Set([TODAY, TOMORROW, local(NOW), local(new Date(NOW.getTime() + 864e5))])];
  const rows: any[] = [];
  for (const day of days) for (let h = 0; h < 24; h++) rows.push({ iso: day + "T" + String(h).padStart(2, "0") + ":00", hour: h, day, tempC: t, humidityPct: 45, dewPointC: 19, windKph: 20, code: 0 });
  e.st.wxHours = rows;
  e.st.wx = { tempC: t, humidityPct: 45, dewPointC: 19, windKph: 20, code: 0, label: "Clear", iconKey: "wxSun", live: true, at: Date.now() };
}
const RUNNABLE = ["easy", "long", "recovery", "strides", "threshold", "vo2", "race-specific", "race"];
/** The chips' own numbers for a session, worked out by the sheet itself (sessionSheetHtml hands them in). */
const shownOf = (s: any) => ({ durMin: Math.round(s.estimatedDurationSeconds / 60),
  dist: s.estimatedDistanceMeters ? (Math.round(s.estimatedDistanceMeters / 100) / 10) + " km" : null, wuMin: 12, rpe: s.targetRpe });
/** A logged run of a type, with a band and an effort — the shape liveRunRecord writes. */
function runOf(o: any) {
  const n = o.km || 6, pace = o.pace || 330;
  return { id: o.id || "run-" + Math.random().toString(36).slice(2), t: o.t || "Run", d: "", dateIso: o.dateIso, type: o.type || "easy",
    dist: n.toFixed(2) + " km", time: "", pace: "", distKm: n, sec: n * pace, avgPaceSec: pace,
    splits: Array.from({ length: n }, (_, i) => ({ km: i + 1, sec: pace })), pband: o.pband === undefined ? { minSecPerKm: 320, maxSecPerKm: 345 } : o.pband,
    rband: o.rband === undefined ? { min: 3, max: 4 } : o.rband, rpe: o.rpe === undefined ? 4 : o.rpe, ...(o.extra || {}) };
}
/** Every number in a text, as whole tokens: "4:30–4:40/km" gives 4:30 and 4:40, "7.0 km" gives 7.0. */
const numbers = (s: string) => s.match(/\d+(?:[.:]\d+)*/g) || [];
function assertNumbersFrom(text: string, facts: unknown, who: string) {
  const have = new Set(numbers(JSON.stringify(facts)));
  for (const n of numbers(text)) assert.ok(have.has(n), who + ": the number " + n + " is not in its fact pack — \"" + text + "\"");
}

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: every number a briefing prints is in its fact pack — every runnable session, last runs, heat and readiness", () => {
  const e = env();
  let checked = 0;
  const states = [
    { rpe: 4, pace: 330 },                                          // on the brief
    { rpe: 6, pace: 290, extra: {} },                               // quicker, and harder than planned
    { rpe: 4, pace: 400 },                                          // off the brief
    { rpe: null, pband: null, rband: null, extra: { manual: true } }, // added by hand
  ];
  for (const w of e.raw.weeks.slice(0, 6)) {
    for (const s of w.sessions) {
      if (!RUNNABLE.includes(s.type)) continue;
      for (const variant of [0, 1, 2, 3, 4]) {
        e.st.logged = variant < 4 ? [runOf({ ...states[variant], type: s.type, dateIso: addDays(TODAY, -6) })] : [];
        for (const day of [TODAY, TOMORROW]) {
          if (variant === 1) seedForecast(e, 31); else { e.st.wxHours = null; e.st.wx = null; }
          e.st.subjAnswered = variant === 2; e.st.subjAt = variant === 2 ? Date.now() : 0;
          e.st.subj.soreness = variant === 2 ? "high" : "none";
          const f = e.api.briefingFacts(s, day, w.index, shownOf(s));
          const paras = e.api.briefingText(f);
          assert.ok(paras.length >= 2, s.type + ": a briefing of " + paras.length + " lines");
          assertNumbersFrom(paras.join(" "), f, "week " + w.index + " " + s.type + " " + day + " v" + variant);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 150, "only " + checked + " briefings swept");
});

test("BLOCKER: every number an insight prints is in its fact pack — thumbs up and down, every kind of run", () => {
  const e = env();
  let checked = 0;
  const kinds = [
    { rpe: 4, pace: 330 }, { rpe: 7, pace: 300 }, { rpe: 4, pace: 290 }, { rpe: 4, pace: 400 },
    { rpe: null }, { pband: null, rband: null, rpe: 5 }, { extra: { manual: true } }, { extra: { pain: true } },
    { extra: { splits: [{ km: 1, sec: 330, est: true }, { km: 2, sec: 330, est: true }, { km: 3, sec: 330 }] } },
  ];
  for (const k of kinds) for (const when of [TODAY, addDays(TODAY, -1), addDays(TODAY, -20)]) for (const react of ["up", "down"]) {
    const run = runOf({ ...k, type: "easy", dateIso: when, extra: { react, ...(k as any).extra } });
    e.st.logged = [run]; e.st.hist = [{ i: run.id, d: when, k: run.distKm, s: run.sec, t: "easy" }];
    const a = e.api.runAnalysis(run), v = e.api.runVerdict(run, a);
    const f = e.api.insightFacts(run, a, v);
    const paras = e.api.insightText(f);
    assert.ok(paras.length >= 1, "an empty insight");
    assertNumbersFrom(paras.join(" "), f, JSON.stringify(k) + " " + when + " " + react);
    checked++;
  }
  assert.ok(checked >= 50, "only " + checked + " insights swept");
});

test("BLOCKER: no second derivation — the text is a template over its facts, and the facts are read from the sheet's own sources", () => {
  // The text functions join facts: they call nothing that could look something up or work a number out.
  const ALLOWED = new Set(["push", "join", "split", "slice", "charAt", "toLowerCase", "replace", "indexOf", "String", "tgt"]);
  for (const fn of ["briefingText", "insightText"]) {
    // String literals out first: "first (it is in the steps)" is words, not a call.
    const body = decomment(fnBody(fn)!).replace(/^function \w+\(/, "(").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const calls = [...body.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!).filter((n) => !["if", "for", "while", "return", "function"].includes(n));
    const bad = calls.filter((c) => !ALLOWED.has(c));
    assert.deepEqual([...new Set(bad)], [], fn + " calls something besides joining its facts");
  }
  // The briefing's facts come from what the sheet shows: the chips' numbers handed in, its rows and targets, the
  // purpose line, the week, the fuelling plan, the heat offer, the readiness engine and the last run's own debrief.
  const bf = decomment(fnBody("briefingFacts")!);
  for (const src of ["structureRows(main, true)", "mainSetSteps(sess)", "stepTargetText(", "longestStep(main)", "WHY_SHORT[sess.type]",
    "weekByNo(week)", "sessionFuelling(sess)", "heatOffer(sess)", "RC.assessReadiness(readinessInput())", "readinessScore()",
    "lastRunOfType(sess.type, iso)", "runVerdict(last, runAnalysis(last))", "shown.durMin", "shown.wuMin"]) {
    assert.ok(bf.includes(src), "briefingFacts no longer reads " + src);
  }
  assert.match(decomment(fnBody("sessionSheetHtml")!), /briefingCardHtml\(sess, sIso, week, \{ durMin: dur, dist: dist, wuMin: wuMin, rpe: sess\.targetRpe \}\)/,
    "the briefing is not handed the chips' own numbers");
  assert.match(decomment(fnBody("sessionSheetHtml")!), /if \(wuMin > 0\) chips\.push\('<span class="chip">incl\. ' \+ wuMin/, "the chip and the briefing read different warm-ups");
  // ONE fuelling answer and ONE main set, for the cards and the briefing alike.
  assert.equal([...decomment(SRC).matchAll(/RC\.fuellingFor\(/g)].length, 1, "the fuelling plan is asked for twice");
  assert.match(decomment(fnBody("fuelHtml")!), /const f = sessionFuelling\(sess\);/);
  assert.match(decomment(fnBody("sessionStages")!), /const main = mainSetSteps\(sess\);/);
  assert.match(decomment(fnBody("mainSubtitle")!), /const longest = longestStep\(list\);/);
  // The insight reads the SAME analysis and verdict the page above it is drawn from — handed in, never worked out
  // again — and the confidence is runAnalysis's own.
  const inf = decomment(fnBody("insightFacts")!);
  for (const n of ["runAnalysis(", "runVerdict(", "runEvidenceConfidence("]) assert.ok(!inf.includes(n), "insightFacts works out " + n + " again");
  for (const src of ["debriefParagraphs(run, a)", "logTotals(mon, run.dateIso)", "alfieNextSession()", "a.confidence"]) assert.ok(inf.includes(src), "insightFacts no longer reads " + src);
  assert.match(decomment(fnBody("viewRunDetail")!), /rdReactHtml\(run, a, v\)/, "the insight is not handed the page's own analysis");
});

test("BLOCKER: nothing reachable from a briefing or an insight can change the plan", () => {
  const app = decomment(SRC);
  const bodyOf = new Map<string, string>();
  for (const n of DECL) bodyOf.set(n, decomment(fnBody(n)!));
  const calls = (n: string) => [...new Set([...bodyOf.get(n)!.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!).filter((x) => DECL.has(x) && x !== n))];
  // ⚠️ DERIVED, NOT LISTED: a function changes the plan if it rebuilds it or writes what it is built from — the
  // profile, the breaks, the moved days, a heat choice.
  const BASE = ["recompute", "adoptPlan", "adoptProf", "saveProfileStore", "saveAdjust", "saveDayOverride", "moveSession", "saveHeatAdapt"]
    .filter((n) => DECL.has(n));
  assert.ok(BASE.length >= 6, "the plan-changing functions were not found: " + BASE);
  const mutators = new Set([...DECL].filter((n) => BASE.includes(n) || BASE.some((b) => bodyOf.get(n)!.includes(b + "(")) ||
    /\bprofile\.[A-Za-z_]\w*\s*=[^=]/.test(bodyOf.get(n)!)));
  // From the card, its facts, its text, the cache, and the thumbs' handler — render and wire are where the screen is
  // drawn again from state, not something the card itself does.
  const BOUNDARY = new Set(["render", "wire"]);
  const seen = new Set<string>(), q = ["briefingCardHtml", "briefingFacts", "briefingText", "briefText", "rdReactHtml", "insightFacts", "insightText", "setRunReact"];
  while (q.length) {
    const n = q.pop()!;
    if (seen.has(n) || BOUNDARY.has(n)) continue;
    seen.add(n);
    q.push(...calls(n));
  }
  // The walk must reach the heavy sources, or it proves nothing.
  for (const n of ["heatOffer", "runVerdict", "runAnalysis", "structureRows", "warmupCardFor", "alfieNextSession", "saveRuns"]) assert.ok(seen.has(n), "the walk never reached " + n);
  const hit = [...seen].filter((n) => mutators.has(n));
  assert.deepEqual(hit, [], "a briefing or an insight can reach a plan change");
  // And the thumbs' handler writes the run's reaction and nothing else.
  assert.match(decomment(fnBody("setRunReact")!), /run\.react = val; saveRuns\(\); render\(\);/);
  assert.match(decomment(fnBody("wire")!), /querySelectorAll\("\[data-react\]"\)\.forEach\(\(b\) => b\.onclick = \(\) => setRunReact\(b\.dataset\.react\)\)/);
  assert.ok(app.includes('data-react="'), "nothing renders the thumbs");
});

test("BLOCKER: no medical claim — not in the templates, not in anything they write", () => {
  const BANNED = /diagnos|injur|overtrain|dehydrat|illness|\bsick|disease|syndrome|symptom|medical|treatment|\bcure\b|you are ill/i;
  for (const fn of ["briefingText", "insightText", "briefingCardHtml", "rdReactHtml"]) {
    const lits = [...decomment(fnBody(fn)!).matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g)].map((m) => m[1] ?? m[2] ?? "");
    for (const l of lits) assert.ok(!BANNED.test(l), fn + " says: " + l);
  }
  // And what they write, across a plan's runs and every kind of logged run (the readiness advice is the engine's
  // own, reviewed text, so the sweep runs without it).
  const e = env();
  for (const w of e.raw.weeks.slice(0, 4)) for (const s of w.sessions) {
    if (!RUNNABLE.includes(s.type)) continue;
    e.st.logged = [runOf({ type: s.type, dateIso: addDays(TODAY, -3), rpe: 6, pace: 300 })];
    const text = e.api.briefingText(e.api.briefingFacts(s, TODAY, w.index, shownOf(s))).join(" ");
    assert.ok(!BANNED.test(text), "a briefing says: " + text);
  }
  for (const react of ["up", "down"]) {
    const run = runOf({ type: "easy", dateIso: TODAY, rpe: 7, pace: 300, extra: { react } });
    e.st.logged = [run];
    const a = e.api.runAnalysis(run), v = e.api.runVerdict(run, a);
    const text = e.api.insightText(e.api.insightFacts(run, a, v)).join(" ");
    assert.ok(!BANNED.test(text), "an insight says: " + text);
  }
});

test("BLOCKER: the briefing is for a run today or tomorrow — never another day, never strength, mobility or rest", () => {
  const e = env();
  const run = e.raw.weeks[0]!.sessions.find((s: any) => RUNNABLE.includes(s.type));
  const html = (s: any, day: string) => e.api.briefingCardHtml(s, day, 1, shownOf(s));
  assert.match(html(run, TODAY), /class="sd-brief"[\s\S]*Your briefing[\s\S]*Today: /);
  assert.match(html(run, TOMORROW), /Tomorrow: /);
  assert.equal(html(run, addDays(TODAY, 2)), "", "a briefing for the day after tomorrow");
  assert.equal(html(run, addDays(TODAY, -1)), "", "a briefing for yesterday");
  for (const type of ["strength", "mobility", "rest", "cross-training"]) assert.equal(html({ ...run, type }, TODAY), "", "a briefing for " + type);
  // Readiness is today's, and only when answered this morning — the defaults are not answers.
  e.st.subj.energy = "low"; e.st.subj.soreness = "moderate";
  assert.ok(!e.api.briefingFacts(run, TODAY, 1, shownOf(run)).ready, "an unanswered check-in was read as an answer");
  e.st.subjAnswered = true; e.st.subjAt = Date.now() - 13 * 3600e3;
  assert.ok(!e.api.briefingFacts(run, TODAY, 1, shownOf(run)).ready, "yesterday's check-in was read as today's");
  e.st.subjAt = Date.now();
  const f = e.api.briefingFacts(run, TODAY, 1, shownOf(run));
  assert.ok(f.ready && /out of 5/.test(f.ready.score), "a fresh answer is not in the briefing");
  assert.ok(!e.api.briefingFacts(run, TOMORROW, 1, shownOf(run)).ready, "this morning's answer was read into tomorrow");
  // A runner who should rest hears that, and no warm-up or fuelling to go with it.
  e.st.subj.illness = "unwell";
  const rest = e.api.briefingText(e.api.briefingFacts(run, TODAY, 1, shownOf(run)));
  assert.equal(rest.length, 2, "a rest-day briefing still sends the runner out: " + rest.join(" | "));
  // The work as the sheet says it, the effort once, and the distance only where the title does not say it.
  const reps = e.raw.weeks.flatMap((w: any) => w.sessions).find((s: any) => s.steps && s.steps.filter((x: any) => x.kind === "rep").length > 1);
  const t = e.api.briefingText(e.api.briefingFacts(reps, TOMORROW, 1, shownOf(reps))).join(" ");
  assert.match(t, /The main set: \d+ × [^.]* at \d+:\d\d–\d+:\d\d\/km/, "the repetitions are not said with their target");
  const steady = e.raw.weeks[0]!.sessions.find((s: any) => s.type === "easy");
  e.st.subj.illness = "none";
  assert.match(e.api.briefingText(e.api.briefingFacts(steady, TOMORROW, 1, shownOf(steady))).join(" "), /Keep it at \d+:\d\d–\d+:\d\d\/km, RPE \d–\d\./);
  const named = { ...steady, title: "7 km moderate run" };
  const once = e.api.briefingFacts(named, TOMORROW, 1, { ...shownOf(named), dist: "7 km" });
  assert.equal(once.length, shownOf(named).durMin + " minutes", "the distance is said twice");
});

test("BLOCKER: 'last time' is the latest run of that type BY DATE, before the session — never one on or after its day", () => {
  const e = env();
  // ⚠️ state.logged is newest-first by INSERTION: a run added by hand for last week sits after a run from yesterday.
  const older = runOf({ id: "run-old", type: "threshold", dateIso: addDays(TODAY, -10), rpe: 9 });
  const newer = runOf({ id: "run-new", type: "threshold", dateIso: addDays(TODAY, -3), rpe: 6 });
  const sameDay = runOf({ id: "run-same", type: "threshold", dateIso: TOMORROW, rpe: 5 });
  const other = runOf({ id: "run-easy", type: "easy", dateIso: addDays(TODAY, -1) });
  const sim = runOf({ id: "run-sim", type: "threshold", dateIso: addDays(TODAY, -2), extra: { sim: true } });
  e.st.logged = [older, other, sim, newer, sameDay];
  assert.equal(e.api.lastRunOfType("threshold", TOMORROW).id, "run-new", "not the latest by date");
  assert.equal(e.api.lastRunOfType("threshold", addDays(TODAY, -3)).id, "run-old", "a run on the session's own day counted as last time");
  assert.equal(e.api.lastRunOfType("vo2", TOMORROW), null, "a run of another type counted");
});

test("BLOCKER: a briefing that quotes today's forecast carries Open-Meteo's credit", () => {
  const e = env();
  const run = e.raw.weeks[0]!.sessions.find((s: any) => s.type === "easy" || s.type === "long");
  seedForecast(e, 32);
  const f = e.api.briefingFacts(run, TODAY, 1, shownOf(run));
  if (!f.heat) return assert.fail("the 32°C fixture produced no heat offer, so this proves nothing");
  const card = e.api.briefingCardHtml(run, TODAY, 1, shownOf(run));
  assert.match(card, /could reach 32°C before you run/);
  assert.ok(card.includes(e.api.wxCreditHtml()), "the briefing quotes the forecast without the credit");
  assert.ok(!e.api.briefingFacts(run, TOMORROW, 1, shownOf(run)).heat, "today's forecast was read into tomorrow's briefing");
});

test("BLOCKER: the thumbs are saved on the run, the insight follows the answer, and the cache keeps it steady — pruned by date and by run", () => {
  const e = env();
  const run = runOf({ id: "run-1", type: "easy", dateIso: TODAY, rpe: 6, pace: 300 });
  e.st.logged = [run]; e.st.hist = [{ i: run.id, d: TODAY, k: run.distKm, s: run.sec, t: "easy" }];
  const a = e.api.runAnalysis(run), v = e.api.runVerdict(run, a);
  // Before the answer: the question, and no insight.
  let html = e.api.rdReactHtml(run, a, v);
  assert.match(html, /How did that run feel\?[\s\S]*data-react="up"[\s\S]*data-react="down"/);
  assert.ok(!/rd-insight/.test(html), "the insight shows before the runner has answered");
  // The answer, from the run's page only, saved on the run and in the store.
  e.st.screen = "runview"; e.st.viewRunId = run.id;
  e.api.setRunReact("down");
  assert.equal(e.st.logged[0].react, "down");
  assert.equal(JSON.parse(e.store.getItem("interun_runs")!)[0].react, "down", "the reaction was not saved");
  assert.ok(e.api.__renders() > 0, "the page was not drawn again");
  e.api.setRunReact("sideways");
  assert.equal(e.st.logged[0].react, "down", "a reaction that is not up or down was saved");
  html = e.api.rdReactHtml(e.st.logged[0], a, v);
  assert.match(html, /class="rd-insight"[\s\S]*<p>/, "no insight after the answer");
  // The cache: same pack, same words — even if the rule would now write something else (proved by changing the entry).
  const cache = JSON.parse(e.store.getItem("interun_brief_v1")!);
  assert.equal(cache["i|run-1"].src, "rule");
  cache["i|run-1"].paras = ["kept"]; e.store.setItem("interun_brief_v1", JSON.stringify(cache));
  assert.match(e.api.rdReactHtml(e.st.logged[0], a, v), /<p>kept<\/p>/, "the same pack was written again instead of read");
  e.st.logged[0].react = "up";
  assert.ok(!/<p>kept<\/p>/.test(e.api.rdReactHtml(e.st.logged[0], a, v)), "a changed pack kept the old words");
  // Pruned by date and by run, never by the plan.
  const m = JSON.parse(e.store.getItem("interun_brief_v1")!);
  m["b|old-sess|" + addDays(TODAY, -1)] = { sig: "x", paras: ["old"], src: "rule", at: TODAY };
  m["b|today-sess|" + TODAY] = { sig: "x", paras: ["today"], src: "rule", at: TODAY };
  m["i|run-gone"] = { sig: "x", paras: ["gone"], src: "rule", at: TODAY };
  e.store.setItem("interun_brief_v1", JSON.stringify(m));
  e.api.seedDone();
  const after = JSON.parse(e.store.getItem("interun_brief_v1")!);
  assert.ok(!after["b|old-sess|" + addDays(TODAY, -1)], "yesterday's briefing was kept");
  assert.ok(after["b|today-sess|" + TODAY], "today's briefing was pruned");
  assert.ok(!after["i|run-gone"], "an insight outlived its run");
  assert.ok(after["i|run-1"], "an insight was pruned while its run is still kept");
  assert.match(decomment(fnBody("seedDone")!), /briefing cache prune skipped/, "the prune is not in seedDone, or swallows its errors");
});
