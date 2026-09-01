/**
 * THE HEAT ADAPTATION MUST BE REACHABLE FOR THE RUN IN FRONT OF THE RUNNER.
 *
 * ⚠️ THE OWNER FIELD-TESTED THIS IN RHODES AT 33 °C AND THE FEATURE DID NOTHING. Measured against the
 * build he was carrying, with a custom 2 km easy run added for today: `heatTargetSession()` → null,
 * `heatBlockHtml()` → 0 characters, `heatChoice(custom)` → null, `heatApplied(custom) === custom` by object
 * identity, and the session sheet's own HTML matching NONE of /heat/i, /°/, /by effort/i, /adapt/i,
 * /conditions/i or /weather/i — while at the same moment the engine answered paceFactor 1.0228,
 * severity "severe", and `adaptSessionForHeat` changed a step. **The adaptation applied and was
 * structurally unreachable.**
 *
 * ⚠️ AND `test/heat-adapt.test.ts` COULD NOT SEE ANY OF IT. Its seventeen tests pin that the sheet,
 * the live start and the watch all go through `heatApplied`, and that the store holds a DECISION
 * rather than an adapted session. Both are true and both were true throughout: what was missing was
 * any way to CREATE a decision for the session on screen. A guard that asserts the adaptation is
 * applied cannot see that nothing can ever be adapted.
 *
 * ⚠️ SO THIS FILE DRIVES THE REAL FUNCTIONS OUT OF THE BUILT PAGE, over a real generated plan, with a
 * real forecast, and asks the question a runner asks: I added a run, it is 33 °C, what does the app
 * say? Same lift precedent as test/warmup-delivery.test.ts and test/share-export-harness.ts. Run
 * `node web/app.ts` first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { MAX_STRUCTURED_WEEKS } from "../src/plan/periodization.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { assessConditions } from "../src/environment/weather.ts";
import { adaptSessionForHeat } from "../src/adapt/heat.ts";
import { buildWarmup } from "../src/science/warmup.ts";
import { buildWorkout, listWorkouts } from "../src/plan/session-templates.ts";
import { fuellingFor } from "../src/science/fuelling.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

/* ------------------------------------------------------------------------------------------------ *
 * Lifting the heat pipeline                                                                        *
 * ------------------------------------------------------------------------------------------------ */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));

function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function heatBlockHtml(");
  assert.ok(marker >= 0, "heatBlockHtml is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
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
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

/**
 * ⚠️ DERIVED FROM ROOTS, NEVER LISTED. `heatBlockHtml` and `sessionSheetHtml` between them reach the
 * whole briefing card — the warm-up card, the staged steps, the fuelling block — and a hand-written
 * list of ninety helpers goes stale the first time one is added, silently measuring a card that is no
 * longer the card.
 */
const ROOTS = ["heatCandidates", "heatSessById", "heatTargetSession", "heatOffer",
  "heatBlockHtml", "heatApplied", "heatChipHtml", "heatSheetHtml", "hoursFor", "hourAt",
  "seedDone", "wxDiagLine", "addExtra", "removeExtra", "sessionSheetHtml",
  // ⚠️ THE CONDITIONS SURFACES ARE PART OF THIS PIPELINE, and leaving them out is how the square came
  // to price a different session from the card two inches below it. conditionsSquare paints from the
  // severity and used to word itself from three other tests; conditionsSession is the one resolver
  // both it and the sheet read; sessionsOnSelectedDay is here as the CONTROL, so the guard can show
  // the two answering differently rather than asserting that they do.
  "conditionsSquare", "conditionsSession", "weatherSheetHtml", "sessionsOnSelectedDay"];
/** Globals the app boots; the harness supplies them, so the lift cannot depend on boot order. */
const STUB = new Set(["PLAN", "RAW", "RC", "syncWatch", "syncNativeReminders"]);

function liftHeat() {
  const DECL = new Set<string>();
  for (const m of SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)) DECL.add(m[1]!);
  const CONSTAT = new Map<string, number>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)(?: = |, )/gm)) {
    if (!CONSTAT.has(m[1]!)) CONSTAT.set(m[1]!, m.index!);
  }
  const OWNER = new Map<string, string>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = [^\n]*$/gm)) {
    for (const d of m[0].matchAll(/(?:^(?:const|let) |, )([A-Za-z_$][\w$]*) = /g)) OWNER.set(d[1]!, m[1]!);
  }
  const fns = new Set<string>(), q = [...ROOTS], cq: string[] = [], seenC = new Set<string>();
  const stmts = new Map<string, number>();
  const scan = (text: string) => {
    for (const m of decomment(text).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (DECL.has(m[1]!)) q.push(m[1]!);
      else if (CONSTAT.has(m[1]!)) cq.push(m[1]!);
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
  // Declaration order, or a const reading a later const throws a temporal-dead-zone ReferenceError.
  const ordered = [...stmts.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  const body =
    "let PLAN = { weeks: [] }, RAW = { weeks: [], paces: {} };\n" +
    "const syncWatch = () => {}, syncNativeReminders = () => {};\n" +
    ordered.join("\n") + "\n" +
    [...fns].map((n) => fnBody(n)).join("\n") + "\n" +
    "return { " + [...fns].join(", ") +
    ", __set: (p, r) => { PLAN = p; RAW = r; }" +
    ", __extra: () => EXTRA" +
    ", __state: () => state"
    + ", __raw: () => RAW" +
    ", __reload: () => { EXTRA = loadExtra(); state.heatAdapt = loadHeatAdapt(); } };";
  return { body, fns: [...fns], consts: ordered.length };
}

/* ------------------------------------------------------------------------------------------------ *
 * The environment the lift runs in                                                                 *
 * ------------------------------------------------------------------------------------------------ */

/** A real localStorage, so the decision store, the extras store and the decline memory all work. */
class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

/**
 * ⚠️ RC IS THE REAL ENGINE, NOT A STUB. The whole question is whether the app's heat surfaces reach
 * the engine's answer, so faking `assessConditions` would let the guard pass on a page that never
 * asks it anything.
 */
const RC: any = {
  assessConditions, adaptSessionForHeat, buildWarmup, buildWorkout, listWorkouts, fuellingFor,
};

type Env = {
  api: any;
  store: MemStore;
  plan: any;
  raw: any;
  paces: any;
  today: string;
  /** Every hour of today and tomorrow at one temperature, so the answer cannot depend on the clock. */
  seedForecast: (tempC: number) => void;
  clearForecast: () => void;
};

const LIFT = liftHeat();

/**
 * @param raceToday when set, the goal race falls on TODAY and the block is a ~13-week plan behind it.
 *   ⚠️ NEEDED BECAUSE heatBlockHtml IS TODAY-ONLY AND CORRECTLY SO — the forecast is today's, so a
 *   session months away has nothing to say about the weather. The offer for a race can only be seen
 *   on the screen on race day, which means the fixture has to put one there. dayOverride cannot: it
 *   moves a session within its OWN week, and the race is in the last one.
 */
function env(tempC = 33, raceToday = false): Env {
  const store = new MemStore();
  const now = new Date();
  // ⚠️ UTC, BECAUSE THE APP IS UTC. todayIso() is new Date().toISOString().slice(0, 10), and CLAUDE.md
  // states the rule outright: never build an ISO date from local getters. Written with getFullYear /
  // getMonth / getDate this seeded the plan on the LOCAL date and then asked the app for the UTC one,
  // so east of Greenwich after midnight UTC the two differ and every session lookup missed — six
  // BLOCKER guards red, on a machine whose only unusual property was its timezone. This is the third
  // firing of that trap in this repository, and the first to be caused by the owner travelling: the Mac
  // was on EEST for the Rhodes trip, where local time is UTC+3.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(now);
  const athlete = {
    experience: "recreational", daysPerWeek: 5, ageYears: 45, sex: "m", strengthTraining: true,
    recent: { distanceMeters: 5000, timeSeconds: 1500 },
  } as unknown as Athlete;
  const goal = {
    distance: "half", targetTimeSeconds: 6300,
    // ⚠️⚠️ 91 DAYS, NOT 200, SINCE THE BLOCK-LENGTH CAP (2026-09-01). Weeks are placed backwards from
    // race Monday, so a runway LONGER than the distance's cap moves the plan's START into the future —
    // and a half is capped at 20 weeks (140 days). At 200 days the block began 60 days from now, today
    // was not in the plan at all, and three guards failed on `ensurePlannedToday` with "the fixture is
    // misaligned". Thirteen weeks is inside every cap, so the block still starts today.
    // ⚠️ THE FIXTURE MUST NOT OUTRUN THE CAP. If a future change shortens `MAX_STRUCTURED_WEEKS.half`
    // below 13 this breaks the same way, which is why the assertion below reads the constant.
    raceDateIso: raceToday ? today : iso(new Date(now.getTime() + 91 * 864e5)),
    startDateIso: raceToday ? iso(new Date(now.getTime() - 91 * 864e5)) : today,
  } as unknown as Goal;
  const plan = generatePlan(athlete, goal, {});
  // ⚠️ THE RUNWAY MUST STAY INSIDE THE BLOCK-LENGTH CAP, or the plan starts in the future and every
  // today-relative guard in this file fails with a message about the fixture rather than the code.
  // Asserted here, at the fixture, so the failure names the cause.
  if (!raceToday && plan.weeks.length < 13) {
    throw new Error(
      `the heat fixture built only ${plan.weeks.length} weeks — the 91-day runway no longer fits ` +
      `inside MAX_STRUCTURED_WEEKS.half (${MAX_STRUCTURED_WEEKS.half}); shorten the runway to match`,
    );
  }
  const paces = deriveTrainingPaces(athlete.recent!);
  // The web layer's PLAN is a display summary and RAW carries the steps; both are needed, and
  // rawSessionsForIso pairs them by INDEX, so they must be the same weeks in the same order.
  const raw = { weeks: plan.weeks, paces };
  // ⚠️ WEEK STARTS MUST BE SNAPPED TO THEIR MONDAY, exactly as normalizeWeekStarts() does at boot.
  // The generator gives week 1 the runner's own start date, so on a mid-week start every session's
  // dayOfWeek is offset from the index rawSessionsForIso derives — and a fixture without the snap
  // reports NOTHING on any date, which reads as the resolver being broken. This is the documented
  // adoptPlan trap: setting the globals is not the whole job.
  const monday = (s: string) => {
    const d = new Date(s + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const view = { weeks: plan.weeks.map((w: any, i: number) => ({ index: i + 1, startIso: monday(w.startDateIso), sessions: w.sessions })) };

  const api = new Function("localStorage", "RC", "navigator", "console", LIFT.body)(store, RC, {}, console);
  api.__set(view, raw);
  // ⚠️ THE FORECAST IS KEYED ON THE **LOCAL** DAY, AND SEEDING ONLY THE UTC ONE LEFT SIX GUARDS RED AT
  // UTC-11. hoursFor(null) builds its day from local getters — deliberately, and it is one of this
  // repository's documented legitimate exceptions to the UTC rule, because "the remaining hours of
  // today" is a wall-clock question and Open-Meteo is fetched with the device's own timezone. The
  // DECISION stores are UTC (todayIso()), so a fixture has to satisfy both. Measured in
  // TZ=Pacific/Pago_Pago on 2026-08-21: local today is 2026-08-20, the seeded rows were 08-21 and
  // 08-22, hoursFor matched none, and every heat surface went silent — "the Today heat card is empty on
  // a 33 °C day with a run added", which reads exactly like the defect this file exists to guard.
  // ⚠️ CLAUDE.md records the previous phase proving this file across six timezones INCLUDING Pago Pago.
  // It does not hold today, so either the fixture drifted or that claim was about a different day; the
  // union below removes the dependency either way.
  const localDay = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const wxDays = [...new Set([today, iso(new Date(now.getTime() + 864e5)),
    localDay(now), localDay(new Date(now.getTime() + 864e5))])];
  const seedForecast = (t: number) => {
    const rows: any[] = [];
    for (const day of wxDays) {
      for (let h = 0; h < 24; h++) {
        rows.push({ iso: day + "T" + String(h).padStart(2, "0") + ":00", hour: h, day,
          tempC: t, humidityPct: 45, dewPointC: 19, windKph: 20, code: 0 });
      }
    }
    const st = api.__state();
    st.wxHours = rows;
    st.wx = { tempC: t, humidityPct: 45, dewPointC: 19, windKph: 20, code: 0, label: "Clear",
      iconKey: "wxSun", live: true, at: Date.now() };
  };
  const clearForecast = () => { const st = api.__state(); st.wxHours = null; };
  seedForecast(tempC);
  return { api, store, plan, raw, paces, today, seedForecast, clearForecast };
}

/** Add a custom run for today, exactly as the "Added today" flow does. */
function addRun(e: Env, params: Record<string, unknown>): any {
  e.api.addExtra(Object.assign({ type: "easy", durMin: 14, distKm: 2 }, params));
  const list = e.api.__extra();
  const rec = list[list.length - 1];
  return e.api.heatSessById(rec.id);
}
/** The plan's first runnable session on a date, or null. */
function plannedOn(e: Env, iso: string): any {
  return e.api.heatCandidates(iso).find((s: any) => !String(s.id).startsWith("x")) || null;
}
/**
 * Make sure today carries a planned run, by MOVING one onto it if it does not.
 *
 * ⚠️ WITHOUT THIS THE TWO-CANDIDATE GUARDS ARE VACUOUS ON MOST DAYS OF THE WEEK, and the day this was
 * written was one of them — the fixture's own slot for 2026-08-20 is a mobility session, which is
 * exactly the day the owner met the defect on. A guard that quietly skips when the interesting case
 * is absent is the shape this whole file exists to stop.
 * ⚠️ It moves it through state.dayOverride, the app's own reschedule mechanism, so effDay and every
 * reader downstream honour it exactly as they would for a runner who dragged the session.
 */
function ensurePlannedToday(e: Env): any {
  const already = plannedOn(e, e.today);
  if (already) return already;
  const st = e.api.__state();
  const wk = e.raw.weeks[0];
  const target = (wk.sessions as any[]).find((s: any) => ["easy", "long", "recovery", "strides", "threshold", "vo2"].includes(s.type));
  assert.ok(target, "the fixture's first week has no runnable session at all");
  // Today's index inside its own week, derived the same way computeToday does.
  const d = new Date(e.today + "T00:00:00Z");
  st.dayOverride[target.id] = (d.getUTCDay() + 6) % 7;
  const moved = plannedOn(e, e.today);
  assert.ok(moved, "moving a session onto today did not put it there — the fixture is misaligned");
  return moved;
}
/**
 * The MIRROR of ensurePlannedToday: today carries NO planned RUN, but does carry a non-run — which is
 * exactly the day the owner met the defect on in Rhodes (a plan slot holding only mobility, with a
 * custom 2 km easy run added).
 *
 * ⚠️ THIS FUNCTION EXISTS BECAUSE TWO GUARDS IN THIS FILE WENT RED ONE DAY AFTER THEY WERE WRITTEN,
 * AND NEITHER WAS A DEFECT. The fixture's plan starts TODAY, so today's slot is whatever the generator
 * puts on today's weekday: on 2026-08-20 that was a mobility session and the two guards reached their
 * case; on 2026-08-21 it is a strides run, so the plan's own run became the head candidate and
 * "declining the custom run silences the card" was simply not true any more. Both failures had ONE
 * cause and it was the calendar. The file already carried ensurePlannedToday for the opposite need,
 * which is the tell: the weekday fragility was recognised in one direction and missed in the other.
 *
 * ⚠️ IT MOVES SESSIONS THROUGH state.dayOverride, the app's own reschedule mechanism, exactly as
 * ensurePlannedToday does — so effDay and every reader downstream honour it as they would for a runner
 * who dragged the session. Splicing the week's array would work too and would be a shape no runner can
 * produce.
 *
 * ⚠️ IT DOES NOT ALSO MOVE A NON-RUN ONTO TODAY, AND THAT WAS TRIED AND MEASURED FIRST. The Rhodes
 * day had a mobility session sitting there, which is the richer form of the case — but the fixture's
 * plan starts TODAY, so applyPartialFirstWeek trims week one to today onward and on some weekdays
 * there is no non-run left in that week to move. Measured on 2026-08-21: week one is exactly
 * strides / easy / long. So the helper promises only what it can keep on every weekday — that today
 * carries no runnable plan session — and the guards below hold whether the plan's slot is then a
 * non-run or empty, which is what their re-breaks prove rather than argue.
 */
/**
 * THE HEAT OFFER, WHERE THE RUNNER NOW MEETS IT.
 *
 * ⚠️ heatCard IS GONE. It rendered an attention card at the top of Today, and the owner moved that offer
 * into the session preview on 2026-08-21 — "I want the adapt for heat to be within the session preview"
 * — where heatBlockHtml had been showing it all along. So every claim these tests made about the card is
 * re-pointed at the block rather than deleted: the gating is the same (heatOffer decides, and the block
 * is scoped to today by the same heatCandidates test), and the block additionally has states for an
 * accepted decision and a stale forecast.
 * ⚠️ IT RESOLVES THE TARGET THE SAME WAY THE CARD DID, so "the offer reaches the runner" is still a
 * statement about the whole chain rather than about a builder called with a session handed to it.
 */
function heatOfferHtml(e: any): string {
  const t = e.api.heatTargetSession();
  return t ? e.api.heatBlockHtml(t) : "";
}

function ensureNoPlannedToday(e: Env): void {
  const st = e.api.__state();
  const d = new Date(e.today + "T00:00:00Z");
  const away = ((d.getUTCDay() + 6) % 7 + 3) % 7;
  for (let guard = 0; ; guard++) {
    const p = plannedOn(e, e.today);
    if (!p) break;
    assert.ok(guard < 10, "moving today's planned runs off today did not converge");
    st.dayOverride[p.id] = away;
  }
  assert.equal(plannedOn(e, e.today), null, "today still carries a runnable plan session");
}
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const bands = (s: any) => (s.steps || []).filter((st: any) => st.targetPaceSecPerKm)
  .map((st: any) => st.targetPaceSecPerKm.minSecPerKm + "-" + st.targetPaceSecPerKm.maxSecPerKm).join(",");

/* ------------------------------------------------------------------------------------------------ *
 * The guards                                                                                       *
 * ------------------------------------------------------------------------------------------------ */

test("the lift reaches the whole heat pipeline and the briefing card", () => {
  for (const r of ROOTS) assert.ok(LIFT.fns.includes(r), "root not lifted: " + r);
  assert.ok(LIFT.fns.length >= 60, "suspiciously small closure: " + LIFT.fns.length);
  assert.ok(LIFT.consts >= 15, "suspiciously few consts: " + LIFT.consts);
  const e = env();
  assert.ok(e.plan.weeks.length > 10, "the fixture is not a real plan");
});

test("BLOCKER: a heat decision can be CREATED for a custom run — the Rhodes defect", () => {
  const e = env(33);
  const custom = addRun(e, {});
  assert.ok(custom, "the custom run could not be resolved by id");
  assert.match(String(custom.title), /custom/, "not a custom session: " + custom.title);

  // ⚠️ THE RESOLVER MUST SEE IT AT ALL. heatCandidates read rawSessionsForIso and never consulted
  // EXTRA, so an added run was invisible to every heat surface in the app.
  const cands = e.api.heatCandidates(e.today).map((s: any) => s.id);
  assert.ok(cands.includes(custom.id), "heatCandidates does not see the added run: " + cands.join(","));

  // ⚠️ AND THE OFFER MUST REACH IT. Measured on his build: heatTargetSession() → null and
  // heatCard() → 0 characters, on a day whose only runnable thing was the run he had just added.
  const tgt = e.api.heatTargetSession();
  assert.ok(tgt, "heatTargetSession found nothing to offer on a 33 °C day with a run added");
  const card = heatOfferHtml(e);
  assert.ok(card.length > 0,
    "the heat offer is empty in the session preview on a 33 °C day with a run added");

  // ⚠️ AND ACCEPTING MUST ACTUALLY CHANGE THE SESSION. This is the claim heat-adapt.test.ts cannot
  // make: it asserts heatApplied is CALLED, never that a decision exists for it to apply.
  const before = bands(custom);
  const worst = e.api.heatOffer(custom);
  assert.ok(worst, "no offer for a 2 km run at 33 °C");
  e.api.__state().heatAdapt[custom.id] = { day: e.today, hour: worst.row.hour };
  const applied = e.api.heatApplied(custom);
  assert.notEqual(applied, custom, "heatApplied handed back the original session — nothing was applied");
  const after = bands(applied);
  assert.notEqual(after, before, "the pace bands did not move: " + before);
  // Slower, never quicker. A heat adaptation that speeds somebody up is the worst possible defect.
  const b0 = (custom.steps || []).find((st: any) => st.targetPaceSecPerKm).targetPaceSecPerKm;
  const a0 = (applied.steps || []).find((st: any) => st.targetPaceSecPerKm).targetPaceSecPerKm;
  assert.ok(a0.minSecPerKm > b0.minSecPerKm && a0.maxSecPerKm > b0.maxSecPerKm,
    "the adapted band is not slower: " + JSON.stringify(b0) + " → " + JSON.stringify(a0));
});

test("BLOCKER: the briefing card carries the heat message — his exact request", () => {
  // His words: "the adaption for heat message needs to come on the race briefing card when they click
  // view session". Measured before: the sheet's HTML matched NONE of /heat/i, /°/, /by effort/i,
  // /adapt/i, /conditions/i or /weather/i, for a custom run AND for a planned one.
  const e = env(33);
  const planned = ensurePlannedToday(e);
  const custom = addRun(e, {});
  let checked = 0;
  for (const [what, sess] of [["a custom run", custom], ["a planned session", planned]] as Array<[string, any]>) {
    assert.ok(sess, "the fixture has no " + what);
    checked++;
    const block = e.api.heatBlockHtml(sess);
    assert.ok(block.length > 0, "no heat block on the briefing card for " + what);
    const sheet = e.api.sessionSheetHtml(e.api.heatApplied(sess), 1);
    assert.match(sheet, /heat/i, "the briefing card says nothing about heat for " + what);
    assert.match(sheet, /°/, "the briefing card names no temperature for " + what);
    assert.ok(sheet.indexOf(block) >= 0, "the block is not in the card it is supposed to be on (" + what + ")");
    // ⚠️ ABOVE THE STEPS, because it is what explains their paces. openSessionSheet has already run
    // heatApplied, so every band below is the adapted one and this block is the only thing that says
    // why. Under them the runner reads numbers they cannot account for and then, maybe, the reason.
    const steps = sheet.indexOf('class="sd-stage');
    if (steps >= 0) assert.ok(sheet.indexOf(block) < steps,
      "the heat block sits BELOW the steps it explains, for " + what);
  }
  assert.equal(checked, 2, "the guard did not reach both a custom run and a planned session");
});

test("BLOCKER: all four states of the block exist — none of them is silent", () => {
  // ⚠️ A BLOCK THAT ONLY APPEARS WHEN EVERYTHING WORKED IS THE DEFECT BEING FIXED. A silent forecast
  // failure looks exactly like a missing feature, which is the report this came from.
  const e = env(33);
  const custom = addRun(e, {});
  const st = e.api.__state();
  const seen: Record<string, string> = {};

  // STATE 2 — no decision, hot enough to matter: the offer.
  seen.offer = text(e.api.heatBlockHtml(custom));
  assert.ok(seen.offer.length > 20, "the offer state is empty");
  assert.match(seen.offer, /33|°/, "the offer does not name the temperature");
  assert.match(seen.offer, /harder/i, "the offer does not say what holding the paces would cost");

  // STATE 1 — a decision in force.
  const worst = e.api.heatOffer(custom);
  st.heatAdapt[custom.id] = { day: e.today, hour: worst.row.hour };
  seen.inForce = text(e.api.heatBlockHtml(custom));
  assert.match(seen.inForce, /Adapted for/i, "the in-force state does not say it is adapted");
  assert.match(seen.inForce, /slower/i, "the in-force state does not say what changed");
  assert.match(seen.inForce, /effort targets have not moved/i,
    "the in-force state drops the effort claim — the pace moves, the effort does not");

  // STATE 3 — a decision stored, no forecast to price it from.
  e.clearForecast();
  seen.stale = text(e.api.heatBlockHtml(custom));
  assert.ok(seen.stale.length > 20, "the stale state is empty — the runner is told nothing");
  assert.match(seen.stale, /planned paces are in force/i,
    "the stale state does not say which paces are actually in force");
  assert.equal(e.api.heatApplied(custom), custom,
    "heatApplied guessed at a price it could not compute");

  // STATE 4 — no forecast at all, and the conditions we DO have say heat matters.
  delete st.heatAdapt[custom.id];
  seen.noForecast = text(e.api.heatBlockHtml(custom));
  assert.ok(seen.noForecast.length > 20,
    "with no forecast on a hot day the card says nothing at all — which is the reported defect");
  assert.match(seen.noForecast, /no hour-by-hour forecast|will not put a number/i,
    "the no-forecast state does not say why there is no number");

  // All four are different sentences, or one of them is a copy that reads as another state.
  const vals = Object.values(seen);
  assert.equal(new Set(vals).size, vals.length, "two states render the same text: " + JSON.stringify(seen));
});

test("BLOCKER: the block is TODAY only — a session weeks away is never priced from today's air", () => {
  // ⚠️ THIS WAS A DEFECT I INTRODUCED AND A REAL BROWSER FOUND. Every input the block has is about
  // today — hoursFor(null) is today's remaining hours, a decision is keyed by day, a decline is scoped
  // to the date — so with no gate the briefing card for w4-d0-easy, a session THREE WEEKS AWAY, read
  // "Up to 33 °C before you run … about 2.6% harder", priced entirely from this afternoon. The Plan
  // screen and the month calendar open those sheets constantly.
  const e = env(33);
  const today = ensurePlannedToday(e);
  assert.ok(e.api.heatBlockHtml(today).length > 0, "today's own session has no block, so this proves nothing");

  let checkedFuture = 0;
  for (const wi of [2, 4, 8]) {
    const wk = e.raw.weeks[Math.min(wi, e.raw.weeks.length - 1)];
    for (const s of (wk.sessions as any[])) {
      if (!["easy", "long", "recovery", "strides", "threshold", "vo2", "race-specific", "race"].includes(s.type)) continue;
      if (e.api.heatCandidates(e.today).some((c: any) => c.id === s.id)) continue;   // that one IS today
      assert.equal(e.api.heatBlockHtml(s), "",
        "a session that is not today (" + s.id + " \"" + s.title + "\") was offered a heat " +
        "adaptation priced from today's forecast");
      const sheet = e.api.sessionSheetHtml(s, wi + 1);
      // ⚠️ SCOPED TO THE BLOCK, NOT TO THE WORD "heat". A future card legitimately contains the
      // string: warmupHtml carries "Cut short for the heat" because buildWarmup shortens above 24 °C,
      // and that note is priced from today's conditions too — pre-existing, documented in CLAUDE.md,
      // and not this change's to fix. Asserting on /heat/i failed on correct code and would have had
      // me chase somebody else's copy.
      assert.ok(!/class="heat-block/.test(sheet),
        "the briefing card for a future session (" + s.id + ") carries the heat block");
      checkedFuture++;
    }
  }
  assert.ok(checkedFuture >= 5, "only " + checkedFuture + " future sessions checked — the sweep is wrong");

  // ⚠️ AND AN EXTRA DATED TOMORROW IS EXCLUDED BY THE SAME TEST. The runner can add a session to any
  // day they are looking at, so "an extra" is not the same thing as "today".
  const tomorrow = new Date(e.today + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tIso = tomorrow.toISOString().slice(0, 10);
  const list = JSON.parse(e.store.getItem("interun_extra_v1") || "[]");
  list.push({ id: "x-tomorrow", type: "easy", workoutId: null, durMin: 30, reps: null, distKm: null, date: tIso });
  e.store.setItem("interun_extra_v1", JSON.stringify(list));
  e.api.__reload();
  const tomorrowSess = e.api.heatSessById("x-tomorrow");
  assert.ok(tomorrowSess, "the tomorrow extra could not be resolved");
  assert.equal(e.api.heatBlockHtml(tomorrowSess), "",
    "a run added for TOMORROW was offered an adaptation priced from today's forecast");
});

test("BLOCKER: it proposes, it never imposes", () => {
  // ⚠️ STANDING INSTRUCTION, 2026-08-03: the app may observe and propose, never change a pace on its
  // own, and declining is remembered rather than re-asked.
  const e = env(33);
  // ⚠️ heatCard() prices the HEAD of the candidate list, so declining the custom run only silences it
  // on a day whose plan carries no run of its own. Left to the calendar this held on the Thursday it
  // was written and broke on the Friday. See ensureNoPlannedToday.
  ensureNoPlannedToday(e);
  const custom = addRun(e, {});
  // Nothing is applied until a decision exists.
  assert.equal(e.api.heatApplied(custom), custom, "a session was adapted with no decision stored");
  assert.equal(e.api.heatChoice(custom), null, "a decision appeared without being made");
  // Declining is remembered for TODAY, and the card stops asking.
  const decl = JSON.parse(e.store.getItem("interun_heatno_v1") || "{}");
  decl[custom.id] = e.today;
  e.store.setItem("interun_heatno_v1", JSON.stringify(decl));
  assert.equal(e.api.heatDeclinedToday(custom), true, "the decline was not remembered");
  // ⚠️ ASSERTED ON WHETHER IT STILL ASKS, NOT ON WHETHER IT IS EMPTY. The card returned "" after a
  // decline; the block it moved into has a state for a decision that has been made, so an empty-string
  // check would now be a claim about the wrong thing. What must hold is that the runner is not asked
  // again today — no adjust control, no offer wording.
  const after = heatOfferHtml(e);
  assert.ok(!/data-heatopen/.test(after),
    "the offer kept asking after a decline: " + after.slice(0, 200));
  assert.ok(!/Adjust my paces/.test(after),
    "the offer kept its adjust control after a decline: " + after.slice(0, 200));
  // ⚠️ BUT ONLY FOR TODAY. The weather is a different question tomorrow.
  decl[custom.id] = "2020-01-01";
  e.store.setItem("interun_heatno_v1", JSON.stringify(decl));
  assert.equal(e.api.heatDeclinedToday(custom), false, "a decline was remembered beyond its day");
});

test("BLOCKER: a control acts on ITS OWN session, not on whatever today's target happens to be", () => {
  // ⚠️ ALL SIX HEAT HANDLERS USED TO RE-DERIVE THE SESSION through heatTargetSession(), which answers
  // a different question — "the one thing worth offering today". On a day carrying a planned run and
  // an added one that meant accepting on one could write the decision against the other, and clearing
  // the chip on one could clear the other. Every control now carries the id it was rendered for.
  const e = env(33);
  const planned = ensurePlannedToday(e);
  const custom = addRun(e, {});
  assert.notEqual(planned.id, custom.id, "the fixture has only one candidate");
  // ⚠️ AND THE TWO-CANDIDATE CASE IS REACHED, NOT ASSUMED. The old heatTargetSession refused outright
  // whenever a day carried more than one runnable thing, so this is the case it went silent on.
  const cands = e.api.heatCandidates(e.today);
  assert.ok(cands.length >= 2, "the fixture has " + cands.length + " candidate(s), so this guard measures nothing");
  assert.ok(e.api.heatTargetSession(), "the card refuses to offer anything on a day with two runs");

  // heatSessById is the resolver both kinds go through, and it must find both.
  assert.equal(e.api.heatSessById(custom.id).id, custom.id, "an extra cannot be resolved by id");
  assert.equal(e.api.heatSessById(planned.id).id, planned.id, "a planned session cannot be resolved by id");
  assert.equal(e.api.heatSessById("nothing-like-this"), null, "an unknown id resolved to something");

  // Accepting for one leaves the other alone.
  const w = e.api.heatOffer(custom);
  e.api.__state().heatAdapt[custom.id] = { day: e.today, hour: w.row.hour };
  assert.ok(e.api.heatChoice(custom), "the decision was not stored against the run it was made for");
  assert.equal(e.api.heatChoice(planned), null, "accepting for one run adapted a different one");
  assert.notEqual(e.api.heatApplied(custom), custom, "the adapted run is not adapted");
  assert.equal(e.api.heatApplied(planned), planned, "the other run was adapted too");

  // ⚠️ AND THE BEFORE COLUMN MUST BE THE PLANNED BAND. openSessionSheet stores the ALREADY-adapted
  // copy, so a sheet that took its session from there would strike through the SLOWED band and
  // present a doubly-slowed one as the target — a wrong starting point and a wrong destination.
  // ⚠️ I FIRST WROTE THIS AS "the two columns must differ" AND THE RE-BREAK SAILED PAST IT: feeding
  // heatSheetHtml an adapted session slows it AGAIN, so the columns still differ and the guard was
  // satisfied by exactly the defect it was written for. What is checkable is the VALUE.
  const sheet = e.api.heatSheetHtml(custom);
  const struck = [...sheet.matchAll(/<s class="num">([^<]+)<\/s>\s*<b class="num">([^<]+)<\/b>/g)];
  assert.ok(struck.length > 0, "the heat sheet shows no before/after rows");
  const secs = (mmss: string) => { const p = mmss.split(":"); return Number(p[0]) * 60 + Number(p[1]); };
  const pacedRows = (custom.steps || []).filter((st: any) => st.targetPaceSecPerKm);
  assert.equal(struck.length, pacedRows.length,
    "the sheet shows " + struck.length + " paced rows for a session with " + pacedRows.length);
  struck.forEach((m, i) => {
    const [lo, hi] = m[1]!.split(/[–-]/).map(secs);
    const band = pacedRows[i]!.targetPaceSecPerKm;
    assert.equal(lo, band.minSecPerKm,
      "row " + i + "'s struck-through band is not the PLANNED one (" + m[1] + " vs " +
      band.minSecPerKm + "-" + band.maxSecPerKm + ") — the sheet was handed an adapted session");
    assert.equal(hi, band.maxSecPerKm, "row " + i + "'s struck-through upper bound is not the planned one");
    const [alo] = m[2]!.split(/[–-]/).map(secs);
    assert.ok(alo > lo, "row " + i + " is not slower after: " + m[1] + " → " + m[2]);
  });
  assert.match(sheet, new RegExp('data-heatsess="' + custom.id + '"'),
    "the sheet's own controls do not carry the session they are about");
});

test("BLOCKER: a badge never claims an adaptation that is not in force", () => {
  // ⚠️ MEASURED BEFORE: with a decision stored and the forecast gone — which is every fresh launch,
  // because state.wxHours is never persisted — heatApplied handed back the ORIGINAL session, the band
  // went back to its planned values and the watch payload was byte-identical to no decision at all,
  // while the chip still read "Adapted for heat". Not guessing the paces is right; asserting a change
  // that is not happening is not.
  const e = env(33);
  const custom = addRun(e, {});
  const w = e.api.heatOffer(custom);
  e.api.__state().heatAdapt[custom.id] = { day: e.today, hour: w.row.hour };
  assert.match(e.api.heatChipHtml(custom), /Adapted for heat/,
    "a live adaptation is not badged as one");
  e.clearForecast();
  assert.equal(e.api.heatApplied(custom), custom, "a decision was priced with no forecast");
  const chip = e.api.heatChipHtml(custom);
  assert.ok(!/Adapted for heat/.test(chip),
    "the chip still claims 'Adapted for heat' while the planned paces are in force: " + text(chip));
  assert.ok(chip === "" || /paused|no forecast/i.test(chip),
    "the paused state says something other than that it is paused: " + text(chip));
});

test("BLOCKER: every runnable type the app has is a run to the weather model", () => {
  // ⚠️ "race" WAS MISSING FROM weather.ts's RUN SET while being in the app's PRIMARY_TYPES, and it
  // silenced the heat card on the one day in the plan whose entire point is a pace target: driven
  // through a real race day at 33 °C, paceFactor came back exactly 1.0000, effortBased false, and
  // points[0] read "Near-ideal conditions — run to your planned paces".
  // ⚠️ DERIVED FROM THE APP'S OWN LIST, not a "race" case. Two lists that must agree cannot be kept
  // in step by a test that only knows about the divergence somebody already found.
  const decl = constStmt("PRIMARY_TYPES");
  assert.ok(decl, "PRIMARY_TYPES is not in the build");
  const types = [...decl!.matchAll(/(?:"([\w-]+)"|([A-Za-z][\w-]*))\s*:\s*1/g)]
    .map((m) => m[1] || m[2]!);
  assert.ok(types.length >= 8, "PRIMARY_TYPES parsed as " + types.join(","));
  for (const t of types) {
    const r = assessConditions({ tempC: 33, humidityPct: 45, dewPointC: 19, windKph: 20,
      minutes: 60, sessionType: t as any });
    assert.ok(r.paceFactor > 1.015,
      "the weather model has no pace answer for a runnable type at 33 °C: " + t +
      " (paceFactor " + r.paceFactor + ") — is it missing from RUN in src/environment/weather.ts?");
    assert.ok(!/near-ideal/i.test(r.points.join(" ")),
      "a runnable type is told the conditions are near-ideal at 33 °C: " + t);
  }
});

test("BLOCKER: a session with no pace is never told the conditions are near-ideal in severe heat", () => {
  // ⚠️ THIS IS WHAT HE SAW ON TODAY. severity and headline are computed for every session type —
  // correctly, it really is 33 °C — while paceFactor and every point were gated on isRun. So his own
  // mobility slot produced severity "severe" and the headline "It's very hot — take it easy" WITH
  // "Near-ideal conditions — run to your planned paces" one line under it, and the conditions square
  // painted red over the words "Good to run".
  for (const t of ["strength", "mobility", "cross-training", "rest"]) {
    const r = assessConditions({ tempC: 33, humidityPct: 45, dewPointC: 19, windKph: 20,
      minutes: 45, sessionType: t as any });
    assert.equal(r.severity, "severe", "33 °C is not severe for " + t + "?");
    assert.ok(!/near-ideal/i.test(r.points.join(" ")),
      t + " at 33 °C still says the conditions are near-ideal: " + r.points.join(" | "));
    assert.match(r.points.join(" "), /no pace to adjust/i,
      t + " says nothing truthful about a session with no pace: " + r.points.join(" | "));
    // And the model still refuses to invent a pace penalty for something with no pace.
    assert.equal(r.paceFactor, 1, t + " was given a pace penalty it cannot use");
  }
  // ⚠️ AND A COOL DAY STILL READS AS A COOL DAY. The truthful line must not replace "near-ideal" when
  // the conditions really are near-ideal, or every mild morning reads as a warning.
  const cool = assessConditions({ tempC: 12, humidityPct: 55, windKph: 8, minutes: 45, sessionType: "mobility" as any });
  assert.match(cool.points.join(" "), /near-ideal/i, "a cool day lost its near-ideal line");
});

/* ------------------------------------------------------------------------------------------------ *
 * THE COPY MUST NAME THE WEATHER THAT IS ACTUALLY IN CHARGE                                        *
 * ------------------------------------------------------------------------------------------------ */

/** The whole grid, once, so several guards can measure over it without rebuilding it. */
const NON_RUN_TYPES = ["strength", "mobility", "cross-training", "rest"];
function wxGrid(types: string[]) {
  const out: { r: ReturnType<typeof assessConditions>; tempC: number; windKph: number; sessionType: string }[] = [];
  for (const sessionType of types) {
    for (let tempC = -20; tempC <= 45; tempC++) {
      for (const humidityPct of [20, 40, 55, 70, 90]) {
        for (const windKph of [2, 12, 25, 45]) {
          for (const minutes of [20, 45, 60, 120]) {
            out.push({ r: assessConditions({ tempC, humidityPct, windKph, minutes, sessionType: sessionType as any }), tempC, windKph, sessionType });
          }
        }
      }
    }
  }
  return out;
}

test("BLOCKER: the no-pace line names the weather that is driving the severity, not the temperature", () => {
  // ⚠️ THE FIRST VERSION OF THAT LINE COMMITTED THE DEFECT IT WAS WRITTEN TO REMOVE. It read
  // `cold === "none" ? "Hot" : "Cold"` — and `cold` is not what sets the severity, which is
  // worst(worst(heat, wind), cold). So a 6 °C day in a 25 kph wind was severity "moderate" from the
  // WIND and the copy read "Hot out", one line under a headline reading "Breezy — expect to work
  // harder into the wind". Two contradictory sentences one line apart: exactly the shape of the
  // defect the line replaced ("It's very hot" above "Near-ideal conditions").
  //
  // ⚠️ MEASURED, WITH THE OLD RULE REPRODUCED ON THIS SAME GRID AS THE CONTROL, over 21,120 non-run
  // cases: "Hot out" fired 10,208 times, 1,120 of them at 12 °C or below, the coldest at 6 °C, and
  // 2,992 of them sat under a WIND headline. After: 7,216 "Hot out" (20 °C and above, none under a
  // wind headline) and 2,992 "Windy out".
  const grid = wxGrid(NON_RUN_TYPES);
  assert.equal(grid.length, 21120, "the grid is not the grid these numbers were measured on");
  const RANKS: Record<string, number> = { none: 0, mild: 1, moderate: 2, high: 3, severe: 4 };
  let oldHotOnWind = 0, oldHotCool = 0, newHot = 0, newWindy = 0, contradictions = 0, coldest = 999;
  for (const g of grid) {
    const line = g.r.points.join(" | ");
    if (!/no pace to adjust/.test(line)) continue;
    // The CONTROL: what the previous rule would have said about this very case.
    const coldSev = g.tempC < 0 ? "moderate" : g.tempC < 6 ? "mild" : "none";
    if (coldSev === "none") {
      if (/wind|breezy/i.test(g.r.headline)) oldHotOnWind++;
      if (g.tempC <= 12) { oldHotCool++; coldest = Math.min(coldest, g.tempC); }
    }
    if (/Hot out/.test(line)) {
      newHot++;
      assert.ok(g.tempC >= 20, "still called a " + g.tempC + " °C day hot: " + g.r.headline + " / " + line);
      if (/wind|breezy/i.test(g.r.headline)) contradictions++;
    }
    if (/Windy out/.test(line)) {
      newWindy++;
      assert.ok(/wind|breezy/i.test(g.r.headline),
        "called it windy under a headline that is not about wind: " + g.r.headline + " / " + line);
    }
    assert.ok(RANKS[g.r.severity]! >= 2, "the no-pace line fired on calm conditions: " + line);
  }
  assert.ok(oldHotOnWind > 1000,
    "the CONTROL cannot see the defect any more — the old rule now puts only " + oldHotOnWind +
    " cases of 'Hot out' under a wind headline, so this guard proves nothing");
  assert.ok(oldHotCool > 500 && coldest <= 8,
    "the control's cold cases have gone (" + oldHotCool + " at <=12 C, coldest " + coldest + ")");
  assert.equal(contradictions, 0, "a cool windy day is still called hot in " + contradictions + " cases");
  assert.ok(newHot > 5000, "'Hot out' has become unreachable: " + newHot);
  assert.ok(newWindy > 1000, "'Windy out' is not reachable, so the wind case has no copy: " + newWindy);
});

test("BLOCKER: every branch of the no-pace line is reachable, and no unreachable branch is kept", () => {
  // ⚠️ AN UNREACHABLE BRANCH IS A FINDING, NOT A SAFETY NET. The first version carried a "Cold out"
  // string and it fired 0 times of 21,120 — the computed-and-discarded trap this project has now
  // shipped five times. The mechanism: ANY cold at all (below 6 °C) pushes its own point above, and
  // that block is NOT gated on isRun, so a non-run on a cold day already has something true to read
  // and never reaches this fallback. It was DELETED rather than made reachable, because making it
  // reachable would mean removing the cold advice that is already better than it.
  //
  // ⚠️ SO THIS ASSERTS EXHAUSTION IN BOTH DIRECTIONS: every driver that can reach the line has copy,
  // and the source carries copy for no driver that cannot.
  const drivers = new Set<string>();
  for (const g of wxGrid(NON_RUN_TYPES)) {
    if (/no pace to adjust/.test(g.r.points.join(" | "))) drivers.add(g.r.driver);
  }
  assert.deepEqual([...drivers].sort(), ["heat", "wind"],
    "the drivers that reach the no-pace line have changed: " + [...drivers].sort().join(","));
  const wx = readFileSync(fileURLToPath(new URL("../src/environment/weather.ts", import.meta.url)), "utf8");
  const at = wx.indexOf("if (points.length === 0) {");
  assert.ok(at > 0, "the fallback is no longer where this guard looks");
  const body = wx.slice(at, wx.indexOf("}", wx.indexOf("points.push", at)));
  assert.ok(!/Cold out/.test(body),
    "the fallback carries copy for a driver that cannot reach it — either make it reachable or delete it");
  for (const d of drivers) {
    assert.ok(new RegExp(d === "wind" ? '"wind"' : "Hot out").test(body),
      "a reachable driver has no copy of its own in the fallback: " + d);
  }
});

test("BLOCKER: the headline and the no-pace line are built from ONE derivation of the driver", () => {
  // ⚠️ TWO DERIVATIONS OF THE SAME RULE IS HOW THEY CAME TO DISAGREE. buildHeadline had a `lead` of
  // its own; the fallback keyed on `cold`; the app's conditions square named heat unconditionally.
  // driverOf is now the only one, and buildHeadline takes its answer as an argument.
  const wx = readFileSync(fileURLToPath(new URL("../src/environment/weather.ts", import.meta.url)), "utf8");
  const noComments = wx.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
  const derivations = [...noComments.matchAll(/RANK\[heat\] >= RANK\[wind\]/g)].length;
  assert.equal(derivations, 1,
    "the driver is derived in " + derivations + " places; it must be derived once and read");
  assert.match(noComments, /function buildHeadline\(severity: Severity, driver: ConditionsDriver/,
    "buildHeadline no longer takes the driver — it is deriving its own again");
  // And the answer really is exposed, so the app does not have to re-derive it either.
  const r = assessConditions({ tempC: 6, humidityPct: 40, windKph: 25, minutes: 45, sessionType: "mobility" as any });
  assert.equal(r.driver, "wind", "a cool windy day is not driven by the wind: " + JSON.stringify(r));
  assert.equal(assessConditions({ tempC: 33, humidityPct: 45, dewPointC: 19, windKph: 5, minutes: 45, sessionType: "easy" }).driver, "heat");
  assert.equal(assessConditions({ tempC: -5, humidityPct: 60, windKph: 5, minutes: 45, sessionType: "easy" }).driver, "cold");
  assert.equal(assessConditions({ tempC: 12, humidityPct: 55, windKph: 8, minutes: 45, sessionType: "easy" }).driver, "none",
    "a calm mild day names a driver, so a caller reading it is told the heat is in charge");
});

/* ------------------------------------------------------------------------------------------------ *
 * THE TODAY SQUARE: ITS WORDS AGAINST ITS OWN COLOUR, AND ITS SESSION AGAINST THE HEAT CARD'S      *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the conditions square never says Good to run under a warning colour", () => {
  // ⚠️ THIS IS THE VISIBLE HALF OF WHAT THE OWNER REPORTED, AND IT WAS STILL THERE AFTER THE ENGINE
  // COPY WAS FIXED. The tile is painted from imp.severity while the sub-line was
  // "effortBased ? … : heatSec ? … : Good to run" — three tests, none of them the severity. A
  // mobility session at 33 °C is severity "severe" with effortBased false and heatSec 0 (there is no
  // pace to slow), so the square was painted SEVERE and read "Good to run". Measured on the served
  // page: "Conditions · live 33° · Clear Good to run".
  // ⚠️ AND A MODERATE WIND ON AN ORDINARY EASY RUN REACHED IT THE SAME WAY — amber tile, same words —
  // so this is not only about non-runs and the sweep covers both.
  // ⚠️ THE SWEEP MUST REACH "mild" AS WELL AS "moderate", or an over-aggressive gate passes. The
  // first version of this guard swept 12 °C / 8 kph (severity none) and 33 °C (severe) and nothing
  // between, so turning the gate into "severity !== none" — which makes every mild morning a warning
  // and "Good to run" unreachable — escaped it. Fixture too kind, at the other end.
  const e = env(33);
  const st = e.api.__state();
  const d = new Date(e.today + "T00:00:00Z");
  st.selWeek = 0; st.selDay = (d.getUTCDay() + 6) % 7;
  const RANKS: Record<string, number> = { none: 0, mild: 1, moderate: 2, high: 3, severe: 4 };
  const seen = new Map<string, number>();
  let good = 0, worded = 0;
  for (const tempC of [-4, 2, 12, 16, 20, 24, 29, 33, 38]) {
    for (const windKph of [4, 15, 25, 45]) {
      st.wx = { tempC, humidityPct: 45, dewPointC: Math.min(19, tempC - 2), windKph,
        code: 0, label: "Clear", iconKey: "wxSun", live: true, at: Date.now() };
      const sess = e.api.conditionsSession();
      const sub = text(e.api.conditionsSquare());
      // ⚠️ THE IMPACT IS THE APP'S OWN, NOT A SECOND DERIVATION OF IT. This guard used to build
      // its own assessConditions call with a hardcoded minutes: 45 and a "mobility" fallback, while
      // currentConditions passes the SESSION'S REAL DURATION and falls back to "easy" — so the ruler
      // and the thing being measured disagreed whenever today's session was not 45 minutes long. It
      // failed for the first time on 2026-08-25 with no code change at all: the weekday moved, today's
      // session changed length, and at -4 °C / 45 kph the app said "Run by effort" while the proxy
      // said wind. The invariant is that the WORDS MATCH THE IMPACT THE TILE IS PAINTED FROM, so it
      // has to be that impact. Same fixture-too-kind trap this file already records, on a clock.
      const imp = e.api.currentConditions(sess);
      seen.set(imp.severity, (seen.get(imp.severity) || 0) + 1);
      if (RANKS[imp.severity]! >= 2) {
        worded++;
        assert.ok(!/Good to run/.test(sub),
          "the square is painted " + imp.severity + " at " + tempC + " °C / " + windKph +
          " kph and reads 'Good to run' — " + sub);
        // And it says something true instead, from the engine's own driver, not a second guess here.
        const want = imp.effortBased || imp.paceFactor > 1 ? /Run by effort|s\/km/
          : imp.driver === "wind" ? /Windy/ : imp.driver === "cold" ? /Cold/ : /Hot/;
        assert.match(sub, want, tempC + " °C / " + windKph + " kph (driver " + imp.driver + "): " + sub);
      } else if (/Good to run/.test(sub)) good++;
    }
  }
  // ⚠️ THE FIXTURE REALLY REACHED BOTH ENDS. Without this the guard can go vacuous either way.
  assert.ok((seen.get("none") || 0) > 0 && (seen.get("mild") || 0) > 0,
    "the sweep never reached a calm or a mild day: " + JSON.stringify([...seen]));
  assert.ok(worded >= 8, "the sweep reached only " + worded + " warning-colour cases");
  assert.ok(good >= 4,
    "'Good to run' survived on only " + good + " of the calm and mild cases — the gate has become so " +
    "aggressive that every ordinary morning reads as a warning");
});

test("BLOCKER: the square takes no session, so no caller can hand it a different one", () => {
  // ⚠️ THE FIRST FIX PASSED THE RIGHT SESSION IN FROM viewToday AND THAT IS A CONVENTION, NOT A
  // GUARANTEE. Re-broken by reverting that one call site to selectedSession(), every behavioural
  // guard here still passed — the resolver existed and nothing read it, which is the
  // computed-and-discarded trap. conditionsSquare resolves its own session now, so there is no
  // argument to get wrong, and this asserts the signature stays that way.
  const decl = SRC.match(/function conditionsSquare\(([^)]*)\)/);
  assert.ok(decl, "conditionsSquare is not in the build");
  assert.equal(decl![1]!.trim(), "",
    "conditionsSquare takes a parameter again (" + decl![1] + ") — a caller can pass the wrong session");
  const body = decomment(fnBody("conditionsSquare")!);
  assert.match(body, /conditionsSession\(\)/, "the square no longer resolves its own session");
  assert.ok(!/selectedSession\(\)/.test(body),
    "the square resolves the plan's session directly, bypassing conditionsSession()");
  // And every call site really passes nothing.
  const calls = [...SRC.matchAll(/conditionsSquare\(([^)]*)\)/g)]
    .filter((m) => !/^function /.test(SRC.slice(Math.max(0, m.index! - 9), m.index!)));
  assert.ok(calls.length >= 1, "conditionsSquare is never called");
  for (const c of calls) {
    assert.equal(c[1]!.trim(), "", "a call site still hands the square a session: " + c[0]);
  }
});

test("BLOCKER: the conditions square and the heat card price the SAME session", () => {
  // ⚠️ TWO CONTROLS ON ONE SCREEN DESCRIBING DIFFERENT RUNS. sessionsOnSelectedDay() reads RAW.weeks
  // and has never consulted EXTRA, so on the Rhodes day — a plan slot holding only mobility, with a
  // custom 2 km easy run added — it answered the mobility session while heatCandidates answered the
  // custom run. Measured: sessionsOnSelectedDay() -> ["mobility/w1-d3-mobility"], heatCandidates ->
  // ["easy/x0-…"], so the Conditions sheet said "this session has no pace to adjust" while the heat
  // card two inches below offered "about 2.3% harder".
  const e = env(33);
  // ⚠️ THE DIVERGENCE ONLY EXISTS ON A DAY WHOSE PLAN HOLDS NO RUN. With a planned run on today both
  // resolvers answer it and the control below rightly refuses — which is what happened the day after
  // this was written. See ensureNoPlannedToday.
  ensureNoPlannedToday(e);
  const st = e.api.__state();
  const d = new Date(e.today + "T00:00:00Z");
  st.selWeek = 0; st.selDay = (d.getUTCDay() + 6) % 7;
  const custom = addRun(e, {});

  // The CONTROL first: the two resolvers really do disagree on this day, or the guard proves nothing.
  const planned = e.api.sessionsOnSelectedDay();
  const cands = e.api.heatCandidates(e.today);
  assert.ok(cands.some((c: any) => c.id === custom.id), "the fixture's custom run is not a candidate");
  const divergent = !planned.length || !planned.some((s: any) => s.id === cands[0].id);
  assert.ok(divergent,
    "the fixture no longer reaches the case: sessionsOnSelectedDay and heatCandidates agree " +
    "(" + planned.map((s: any) => s.type).join(",") + " vs " + cands.map((s: any) => s.type).join(",") + ")");

  // ⚠️ ONE RESOLVER. The square, its sheet and the chip must all price the session the heat
  // machinery prices — which is the head of the SAME candidate list heatTargetSession chooses from.
  const cs = e.api.conditionsSession();
  assert.ok(cs, "conditionsSession found nothing at all");
  assert.ok(cands.some((c: any) => c.id === cs.id),
    "the conditions surfaces price a session the heat machinery does not even consider: " + cs.type + "/" + cs.id);

  // The runner-facing invariant: the sheet cannot say there is no pace to adjust while the card
  // offers to adjust one.
  const sheet = text(e.api.weatherSheetHtml());
  const card = heatOfferHtml(e);
  assert.ok(card.length > 0, "the fixture makes no heat offer, so there is no contradiction to test");
  assert.ok(!/no pace to adjust/i.test(sheet),
    "the Conditions sheet says there is no pace to adjust while the heat card offers to adjust one: " + sheet.slice(0, 240));
  // ⚠️ ASSERTED ON WHAT THE SQUARE SAYS ABOUT A PACE, NOT ON THE ABSENCE OF ONE PHRASE. "Good to run"
  // alone is satisfied by the square describing the MOBILITY session ("Hot out today"), which is the
  // very divergence this guard is about — so the claim is that a square sitting above a card offering
  // to adjust a pace must itself be describing something that has one.
  const sq = text(e.api.conditionsSquare());
  assert.ok(!/Good to run/.test(sq), "the square says 'Good to run' while the heat card offers an adaptation");
  assert.match(sq, /Run by effort|s\/km/,
    "the heat card offers to adjust a pace while the square describes a session with none: " + sq);

  // ⚠️ AND ON A DAY WITH NOTHING ADDED IT MUST STILL ANSWER THE PLAN'S OWN SESSION, or swiping the
  // week strip prices a day nobody is looking at.
  const e2 = env(33);
  const st2 = e2.api.__state();
  // ⚠️ WEEK ONE, NOT WEEK ZERO, AND THAT IS THE SAME CALENDAR FRAGILITY AGAIN. The fixture's plan
  // starts TODAY, so applyPartialFirstWeek trims week zero to the days from today onward: full on a
  // Monday, three sessions on a Friday (measured 2026-08-21), and the "checked >= 4" floor below then
  // fails on a guard that has nothing to do with the day of the week. Week one is always whole.
  st2.selWeek = 1;
  let checked = 0;
  for (let day = 0; day < 7; day++) {
    st2.selDay = day;
    const plan2 = e2.api.sessionsOnSelectedDay();
    if (!plan2.length) continue;
    checked++;
    const cs2 = e2.api.conditionsSession();
    assert.ok(cs2, "conditionsSession answered nothing on a day the plan has a session on");
    assert.ok(plan2.some((s: any) => s.id === cs2.id),
      "with no extras added, day " + day + "'s conditions session left the plan: " + cs2.id +
      " vs " + plan2.map((s: any) => s.id).join(","));
  }
  assert.ok(checked >= 4, "only " + checked + " days of the fixture week carry a session");
});

test("BLOCKER: the forecast is diagnosable — a missing one no longer looks like a missing feature", () => {
  // ⚠️ THERE WAS NO FORECAST LINE AMONG THE SIX DIAGNOSTICS, both of fetchWeather's failure paths were
  // empty, and state.wxHours is never persisted. So "the heat feature does nothing" was unanswerable
  // from his phone — which is the report we got. Same precedent as __kbDiag and LIVE.gpsDiag.
  const e = env(33);
  const withIt = e.api.wxDiagLine();
  assert.match(withIt, /forecast:/, "the forecast diagnostic is not labelled");
  // ⚠️ DERIVED FROM WHAT WAS SEEDED, NOT TYPED. It was /48 hours/, which is two days of rows — and the
  // fixture now seeds the union of the UTC and LOCAL days, so at an extreme offset it is three. A typed
  // constant here would have turned a timezone fix into a second timezone failure.
  const hours = e.api.__state().wxHours.length;
  assert.ok(hours >= 48, "the fixture seeded only " + hours + " forecast hours");
  assert.match(withIt, new RegExp("\\b" + hours + " hours"), "it does not say how many hours are held: " + withIt);
  assert.match(withIt, /live/, "it does not say whether the forecast is live or a preset: " + withIt);
  e.clearForecast();
  const without = e.api.wxDiagLine();
  assert.match(without, /0 hours/, "with no forecast it does not say so: " + without);
  assert.notEqual(withIt, without, "the line reads the same with and without a forecast");
  // ⚠️ AND IT REPORTS THE LAST ATTEMPT, which is the half that separates offline from refused from
  // never-asked. A refused location is sticky and can only be undone in iOS Settings.
  assert.match(without, /last /, "the line does not report the last attempt: " + without);
  const src = decomment(fnBody("fetchWeather")!);
  assert.ok(/WX_LAST/.test(src), "fetchWeather records nothing about what happened");
  const empty = [...src.matchAll(/catch\s*\(\s*\)?\s*[^)]*\)\s*=>\s*\{\s*WX_FETCHING = false;\s*\}/g)];
  assert.equal(empty.length, 0, "fetchWeather still has a silent failure path");
  // ⚠️ AND IT IS ON THE SCREEN THE OWNER CAN READ. A diagnostic nobody renders is the
  // computed-and-discarded trap this project has shipped four times; the line has to be in the list
  // Support › Your data prints, beside the other seven.
  const diag = decomment(fnBody("viewportDiagLines")!);
  assert.match(diag, /wxDiagLine\(\)/,
    "the forecast line is never rendered — Support > Your data would not show it");
});

test("BLOCKER: the briefing card's own wiring path binds every control the heat block renders", () => {
  // ⚠️⚠️ THIS SHIPPED, AND ONLY A REAL BROWSER FOUND IT. The block rendered perfectly in both themes
  // with two 184x44 buttons, and BOTH were `wired: false` — because openSessionSheet calls wireSheet()
  // while the heat handlers lived inside wire(). Tapping "Adjust my paces" did nothing at all. That is
  // the rdMore defect for the third time in this project: a control in the place every app puts its
  // actions, looking live, connected to nothing.
  //
  // ⚠️ AND THE FIRST VERSION OF THIS GUARD COULD NOT SEE IT. It asserted the app script contains a
  // lookup for every id the block renders — true, in a function that never ran for this surface. House
  // rule: a source-text assertion proves a string exists, never that anything reaches it. So this runs
  // wireSheet() for real, against a document that records what it asks for.
  const wired = new Set<string>();
  const doc = {
    querySelectorAll: (sel: string) => { wired.add(sel); return []; },
    querySelector: (sel: string) => { wired.add(sel); return null; },
    getElementById: () => null,
    createElement: () => ({ innerHTML: "", content: { firstChild: null } }),
  };
  const body = "const document = arguments[0], $ = (id) => document.getElementById(id);\n" +
    "let SHEET_CTX = null, state = { heatHour: null, heatAdapt: {} };\n" +
    "const closeSheet = () => {}, render = () => {}, ensureSheet = () => {}, wire = () => {}," +
    " toast = () => {}, fetchWeather = () => {}, openWeatherSheet = () => {}, syncWatch = () => {}," +
    " syncNativeReminders = () => {}, moveSession = () => {}, slogSet = () => {}, wireExDemos = () => {}," +
    " openStartWhereSheet = () => {}, openAddSessionSheet = () => {}, sheetSessionIso = () => \"\"," +
    " heatSessById = () => null, heatSheetHtml = () => \"\", heatWorstHour = () => null," +
    " hoursFor = () => [], loadHeatDeclined = () => ({}), saveHeatDeclined = () => {}," +
    " saveHeatAdapt = () => {}, heatApplied = (s) => s, sessionSheetHtml = () => \"\", todayIso = () => \"\";\n" +
    fnBody("wireHeatControls") + "\n" + fnBody("wireSheet") + "\nwireSheet();";
  new Function(body)(doc);

  // ⚠️ DERIVED FROM THE BUILDERS, never listed — a sixth control in a fifth state is picked up without
  // anyone remembering to come here. Both builders, because the card and the block share the offer.
  const emitted = new Set<string>();
  for (const b of ["heatBlockHtml"]) {
    for (const m of fnBody(b)!.matchAll(/\bdata-(heat[\w-]*)="/g)) emitted.add(m[1]!);
  }
  assert.ok(emitted.size >= 4, "the scan found only " + emitted.size + " controls — it is wrong, not the code");
  for (const d of emitted) {
    assert.ok(wired.has("[data-" + d + "]"),
      "wireSheet() never binds data-" + d + ", so that control renders and does nothing. " +
      "Queried: " + [...wired].join(" "));
  }

  // ⚠️ AND NOT ONE id AMONG THEM, which is what makes the above possible at all. The Today card and the
  // block render the SAME offer, so both wanted a button called heatOpen — and with the card still in
  // the DOM behind an open sheet that is two elements sharing one id, where $() (getElementById)
  // answers the first and the second silently gets no handler. CLAUDE.md records the identical fault in
  // the recap story. Attributes bound by querySelectorAll cannot collide this way.
  for (const b of ["heatBlockHtml", "heatChipHtml", "heatSheetHtml"]) {
    const ids = [...fnBody(b)!.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(ids, [],
      b + " renders an id-addressed control (" + ids.join(",") + "); two copies of one surface then " +
      "share an id and $() hands the handler to whichever came first");
  }
});

test("BLOCKER: heat decisions do not accumulate for ever", () => {
  // ⚠️ NOW THAT A CUSTOM RUN CAN CARRY ONE. An extra's id is unique per add and gone the moment the
  // runner removes it or the day passes, so every decision would otherwise sit in interun_heat_v1 for
  // ever — and that is localStorage, which is where the runs live. seedDone already prunes
  // state.dayOverride this way and persists the prune.
  const e = env(33);
  const custom = addRun(e, {});
  const st = e.api.__state();
  const w = e.api.heatOffer(custom);
  st.heatAdapt[custom.id] = { day: e.today, hour: w.row.hour };
  st.heatAdapt["x999-long-gone"] = { day: e.today, hour: 9 };
  e.api.saveHeatAdapt();
  e.api.seedDone();
  assert.ok(st.heatAdapt[custom.id], "the prune deleted the decision the runner had just made");
  assert.ok(!st.heatAdapt["x999-long-gone"], "a decision for a run that no longer exists survived the prune");
  // ⚠️ AND THE PRUNE IS PERSISTED, or it runs again on every boot and the store never actually shrinks.
  const onDisk = JSON.parse(e.store.getItem("interun_heat_v1") || "{}");
  assert.ok(!onDisk["x999-long-gone"], "the prune was not written to disk");
  // Removing the run takes its decision with it on the next boot.
  e.api.removeExtra(custom.id);
  e.api.seedDone();
  assert.ok(!st.heatAdapt[custom.id], "removing a custom run left its heat decision behind");
});

test("EXTRA is declared before the top-level seedDone() call", () => {
  // ⚠️ THE PRUNE READS EXTRA, AND ITS CATCH WOULD HIDE A TEMPORAL DEAD ZONE. EXTRA is a `let` well
  // below seedDone in the file; if the boot call is ever moved above it the read throws a
  // ReferenceError, the catch swallows it and the prune quietly never happens — which is the
  // addDayOffer defect exactly (two invented function names, a try/catch, a permanent no-op).
  const extraAt = SRC.search(/^let EXTRA = loadExtra\(\);/m);
  assert.ok(extraAt > 0, "EXTRA is no longer declared the way this guard expects");
  const bootAt = SRC.search(/^seedDone\(\);/m);
  assert.ok(bootAt > 0, "the top-level seedDone() call is gone");
  assert.ok(bootAt > extraAt,
    "seedDone() now runs before EXTRA exists, so the heat prune throws into a silent catch");
});

/* ------------------------------------------------------------------------------------------------
 * A GOAL RACE IS OFFERED A HEAT ADAPTATION — the owner's ruling, 2026-08-22.
 *
 * The previous phase found "race" missing from weather.ts's RUN set, which silenced the heat card on
 * the one day the whole plan exists for: driven through a real race day at 33 °C, paceFactor came
 * back exactly 1.0000 and the runner was told "near-ideal conditions". It was fixed and then flagged
 * for him rather than assumed, because adapting a goal race is a coaching decision and not a bug fix.
 *
 * His answer: *"The goal race adaptation for heat can be offered, it doesnt mean the user has to
 * accept it."* So the offer stands, and this guard is what stops it being quietly removed again — the
 * derived PRIMARY_TYPES sweep above proves race is a run to the model, and this proves the whole path
 * from a real generated race session to something on the runner's screen with a way to decline.
 * ---------------------------------------------------------------------------------------------- */

/** The goal race out of a real generated plan — the last week's `race` session. */
function raceSession(e: Env): any {
  for (const w of [...(e.api.__raw().weeks as any[])].reverse()) {
    const r = (w.sessions as any[]).find((s) => s.type === "race");
    if (r) return r;
  }
  return null;
}

test("BLOCKER: a goal race in severe heat is offered an adaptation", () => {
  const e = env(33, true);
  const race = raceSession(e);
  assert.ok(race, "the generated plan has no race session, so this proves nothing");
  const offer = e.api.heatOffer(race);
  assert.ok(offer, "a goal race at 33 °C was offered nothing — 'race' is out of weather.ts's RUN set");
  assert.ok(offer.pct > 0, "the offer names no cost: " + JSON.stringify(offer.pct));
  // ⚠️ IT MUST REACH THE SCREEN, not merely be computable. The whole original defect was an
  // adaptation that had always worked sitting behind a set that made it unreachable.
  const block = e.api.heatBlockHtml(race);
  assert.ok(block.length > 0, "nothing on the briefing card for a race day in severe heat");
  assert.match(block, /heat|°/i);
});

test("BLOCKER: it is an OFFER — a race is never adapted until the runner says so", () => {
  // His ruling in his own words: "it doesnt mean the user has to accept it". Same rule the standing
  // instruction of 2026-08-03 sets for everything the app proposes.
  const e = env(33, true);
  const race = raceSession(e);
  assert.ok(race);
  assert.equal(e.api.heatApplied(race), race,
    "a race was adapted with no decision recorded — the app may propose, never impose");
  const before = JSON.stringify(race.steps);
  e.api.heatBlockHtml(race);
  assert.equal(JSON.stringify(race.steps), before, "rendering the offer changed the session");
});

test("a race gets the quality wording, not an easy run's 'just slow down'", () => {
  // ⚠️ WHY "race" IS IN QUALITY AS WELL AS RUN. A goal race is the session whose entire point is a
  // pace target, so the honest advice is to run by effort and to consider the day — not to ease off
  // and go by feel, which is what an easy run is told.
  const e = env(33, true);
  const race = raceSession(e);
  assert.ok(race);
  const imp = e.api.heatOffer(race)!.imp;
  const advice = (imp.points || []).join(" ") + " " + (imp.advice || "");
  assert.match(advice, /by effort, not the clock/i,
    "a race in severe heat did not get the quality wording: " + advice);
  // ⚠️ ASSERT THE ABSENCE TOO, AND THE FIRST VERSION DID NOT — /effort/i matches BOTH branches,
  // because the easy-run line is "Just slow down and go by feel — effort matters far more than pace".
  // So dropping "race" from QUALITY escaped a guard whose own title names what it was checking for.
  assert.doesNotMatch(advice, /just slow down and go by feel/i,
    "a goal race was given an easy run's advice: " + advice);
});

test("BLOCKER: a race is never told to move to a cooler hour or swap itself for an easy run", () => {
  // ⚠️ THE QUALITY ADVICE'S ESCAPE ROUTES DO NOT EXIST FOR A GOAL RACE. It starts when it starts and it
  // is not swappable — so "move this to a cooler time of day, or swap it for an easy run" is advice
  // the runner cannot act on, on the one card the whole plan was built to reach. Found when the owner
  // ruled that a race MAY be offered an adaptation: the offer was reachable and its wording was not.
  const e = env(33, true);
  const race = raceSession(e);
  assert.ok(race);
  const imp = e.api.heatOffer(race)!.imp;
  const advice = (imp.points || []).join(" ");
  assert.doesNotMatch(advice, /cooler time of day|swapping it for an easy run/i,
    "a goal race was offered something it cannot do: " + advice);
  // And it still says the thing that matters, in terms a runner on a start line can use.
  assert.match(advice, /adjust your target|ease off/i, "no usable race-day advice at all: " + advice);
  assert.match(advice, /heat illness is a real risk/i, "the safety line was lost with the rewording");
});
