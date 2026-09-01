/**
 * A CUSTOM SESSION MUST BE THE SESSION ITS OWN LABEL NAMES.
 *
 * ⚠️ THE OWNER PHOTOGRAPHED THIS IN RHODES. His live card read "2 km easy run (custom)" over
 * "Moderate — quicker than easy, still comfortable", at 6:02–6:25/km when his easy band is
 * 6:31–7:06 — 29 to 41 s/km faster than the gear he asked for. He asked for an EASY run and was
 * given a MODERATE one wearing an easy title.
 *
 * ⚠️ NOTHING IN THE SUITE COULD SEE IT, AND THE REASON MATTERS. Every string involved is correct in
 * isolation: "Easy run" is the right label for type easy, and "Moderate — quicker than easy, still
 * comfortable" is the right label for a moderate run. What was wrong was WHICH ONE THE BUILDER
 * REACHED — `sessionLibrary` took the FIRST session of each type walked over the plan, and
 * SessionType "easy" covers four different gears (a plain easy run, a moderate run typed easy on
 * purpose for the intensity accounting, an easy → moderate progression, and a beginner run-walk).
 * A source grep for either string passes either way, so this file drives the REAL builder and reads
 * the band and the label it produces. `test/session-builder-distance.test.ts` has twelve tests about
 * a custom session and not one of them asserts its band or its label, which is precisely why this
 * shipped.
 *
 * ⚠️ IT LIFTS THE BUILDER OUT OF THE BUILT PAGE, because that is where it lives — same precedent as
 * test/warmup-delivery.test.ts and test/share-export-harness.ts. Run `node web/app.ts` first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import type { Athlete, Goal, RaceDistanceKey, Session } from "../src/domain/types.ts";

/* ------------------------------------------------------------------------------------------------ *
 * Lifting the builder                                                                              *
 * ------------------------------------------------------------------------------------------------ */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));

function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function sessionLibrary(");
  assert.ok(marker >= 0, "sessionLibrary is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  return html.slice(open + 8, close);
}
function fnBody(SRC: string, name: string): string | null {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(SRC: string, name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
// Comments are stripped from ONE lifted body at a time, never from the whole script: CLAUDE.md
// records a 10 KB blind window opened by sweeping the whole app script this way.
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

/**
 * ⚠️ THE CLOSURE IS DERIVED FROM THREE ROOTS, NOT LISTED. A hand-written list of helpers goes stale
 * the first time somebody adds one, and the failure is silent — the lift would still run and would
 * quietly measure a builder missing a step.
 */
const ROOTS = ["sessionLibrary", "extraRep", "buildCustomSession"];
/** Globals the app owns and boots; the harness supplies them instead. */
const STUB = new Set(["RAW", "TODAY_DOW", "state", "PLAN", "profile", "EXTRA"]);

function liftBuilder() {
  const SRC = appScript();
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
      if (fns.has(n)) continue;
      const b = fnBody(SRC, n);
      assert.ok(b != null, "dependency is not a top-level function: " + n);
      fns.add(n); scan(b!);
    }
    while (cq.length) {
      const c = cq.pop()!;
      if (seenC.has(c) || STUB.has(c)) continue;
      seenC.add(c);
      const st = constStmt(SRC, OWNER.get(c) || c);
      if (!stmts.has(st)) { stmts.set(st, SRC.indexOf(st)); scan(st); }
    }
  }
  // ⚠️ DECLARATION ORDER, or a const that reads a later const throws a temporal-dead-zone
  // ReferenceError — which is what the app itself would do.
  const ordered = [...stmts.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  const body =
    "let RAW = null; const TODAY_DOW = 0;\n" +
    ordered.join("\n") + "\n" +
    [...fns].map((n) => fnBody(SRC, n)).join("\n") + "\n" +
    "return { " + [...fns].join(", ") + ", __setRaw: (r) => { RAW = r; } };";
  return { api: new Function(body)() as any, fns: [...fns], consts: ordered.length };
}

const LIFT = liftBuilder();
const B = LIFT.api;

/* ------------------------------------------------------------------------------------------------ *
 * Real plans                                                                                       *
 * ------------------------------------------------------------------------------------------------ */

type Plan = { label: string; raw: any; paces: any; runWalk: boolean };

const RACE_ISO = "2027-03-14";
const TARGET: Record<string, number> = { "5k": 1, "10k": 2.08, half: 4.39, marathon: 9.2 };
/**
 * ⚠️⚠️ THE START DAY OF THE WEEK IS THE AXIS THAT EXPOSES THIS DEFECT, AND MY FIRST FIXTURE HAD ONLY
 * A MONDAY IN IT — SO ALL EIGHT GUARDS PASSED WITH THE FIX DELIBERATELY REVERTED. Measured: with a
 * Monday start, 0 of 1728 plans put a moderate run first; adding mid-week starts, 1440 of 5760
 * (25.0%) do. The mechanism is `applyPartialFirstWeek`, which TRIMS the days of week 1 before the
 * start date — so a Monday start keeps the plain easy run that sits on Monday and it is the first
 * easy-typed session in the plan, while a Thursday start throws it away and the first survivor is
 * the moderate run later that week. That is why the owner met this and a green suite did not:
 * CLAUDE.md's own note says "the web layer defaults the start date to TODAY, so a partial first week
 * is the normal case". A fixture must carry the shape the product actually produces.
 */
const STARTS = ["2026-08-17", "2026-08-19", "2026-08-20", "2026-08-22", "2026-08-23"];

function plans(): Plan[] {
  const out: Plan[] = [];
  for (const distance of ["5k", "10k", "half", "marathon"] as RaceDistanceKey[])
    for (const daysPerWeek of [3, 4, 5, 6])
      for (const t of [18 * 60, 25 * 60, 35 * 60])
        for (const experience of ["beginner", "recreational", "competitive"] as Athlete["experience"][])
          for (const runWalk of experience === "beginner" ? [false, true] : [false])
            for (const startDateIso of STARTS) {
              const athlete = {
                experience, daysPerWeek, runWalk, ageYears: 42, sex: "m", strengthTraining: true,
                recent: { distanceMeters: 5000, timeSeconds: t },
              } as unknown as Athlete;
              const goal = {
                distance, targetTimeSeconds: Math.round(t * TARGET[distance]!),
                raceDateIso: RACE_ISO, startDateIso,
              } as unknown as Goal;
              let plan;
              // ⚠️ IT THROWS. A `catch { continue }` here once hid generatePlan failing on every
              // call, so a sweep measured nothing while claiming to cover plans.
              try { plan = generatePlan(athlete, goal, {}); }
              catch (e) { throw new Error(`generatePlan failed for ${distance}/${daysPerWeek}d/${t}s: ${e}`); }
              const paces = deriveTrainingPaces(athlete.recent!);
              out.push({
                label: `${distance} ${daysPerWeek}d ${t / 60}:00 ${experience}` +
                  `${runWalk ? " run-walk" : ""} from ${startDateIso}`,
                raw: { weeks: plan.weeks, paces }, paces, runWalk,
              });
            }
  return out;
}
const PLANS = plans();

const bandKey = (b: any) => (b ? b.minSecPerKm + "-" + b.maxSecPerKm : null);
/** The step the runner spends most of the session in — the one whose band the card prints. */
function bodyStep(s: any): any {
  let best: any = null;
  for (const st of s.steps || []) {
    if (st.kind === "warmup" || st.kind === "cooldown" || !st.targetPaceSecPerKm) continue;
    const n = st.durationSeconds || st.distanceMeters || 0;
    if (!best || n > (best.durationSeconds || best.distanceMeters || 0)) best = st;
  }
  return best;
}
/** Build a custom session the way the UI does: a stored extra, through the real builder. */
function custom(p: Plan, type: string, params: Record<string, unknown>): any {
  B.__setRaw(p.raw);
  return B.buildCustomSession(Object.assign(
    { id: "t-" + type, type, workoutId: null, durMin: null, reps: null, distKm: null, date: null },
    params,
  ));
}
function repFor(p: Plan, type: string): any {
  B.__setRaw(p.raw);
  return B.extraRep(type);
}
function typesIn(p: Plan): Set<string> {
  const t = new Set<string>();
  for (const wk of p.raw.weeks) for (const s of wk.sessions as Session[]) t.add(s.type);
  return t;
}

/* ------------------------------------------------------------------------------------------------ *
 * The guards                                                                                       *
 * ------------------------------------------------------------------------------------------------ */

test("the lift reaches the whole builder", () => {
  for (const r of ROOTS) assert.ok(LIFT.fns.includes(r), "root not lifted: " + r);
  assert.ok(LIFT.fns.length >= 4, "suspiciously small closure: " + LIFT.fns.join(","));
  assert.ok(LIFT.consts >= 3, "suspiciously few consts: " + LIFT.consts);
  assert.ok(PLANS.length >= 100, "the sweep must cover real plans, got " + PLANS.length);
});

test("BLOCKER: the fixture can actually see the defect", () => {
  // ⚠️⚠️ THIS GUARD EXISTS BECAUSE THE FIRST VERSION OF THIS FILE PASSED WITH THE FIX REVERTED. Eight
  // assertions, three deliberate re-breaks, all green — because every plan in the fixture started on
  // a MONDAY and no Monday-start plan puts a moderate run first. A guard whose fixture cannot contain
  // the defect measures nothing and reports it as safety.
  //
  // So this reproduces the OLD rule — first session of each type the walk reaches — and requires the
  // fixture to hold plans where it lands on the wrong gear. It is the ruler's own calibration: if a
  // future change to the plan generator stops producing them, THIS fails rather than the guards
  // silently going hollow.
  let easyWrong = 0, stridesUnpaced = 0, withEasy = 0, withStrides = 0;
  for (const p of PLANS) {
    const first: Record<string, any> = {};
    for (const wk of p.raw.weeks) for (const s of wk.sessions as any[]) if (!first[s.type]) first[s.type] = s;
    if (first.easy) {
      withEasy++;
      const b = bodyStep(first.easy);
      if (bandKey(b && b.targetPaceSecPerKm) !== bandKey(p.paces.easy)) easyWrong++;
    }
    if (first.strides) {
      withStrides++;
      const work = (first.strides.steps || []).filter((st: any) => st.kind === "rep");
      if (work.length && work.some((st: any) => !st.targetPaceSecPerKm)) stridesUnpaced++;
    }
  }
  assert.ok(easyWrong >= 100,
    `the fixture cannot see the easy/moderate defect: only ${easyWrong} of ${withEasy} plans would ` +
    "have taken a wrong-gear easy representative under the old first-match rule. Vary the START DAY " +
    "OF THE WEEK — applyPartialFirstWeek trims week 1 before the start date, and a Monday start keeps " +
    "the plain easy run that would otherwise be trimmed away.");
  // ⚠️⚠️ THE STRIDES HALF OF THIS CALIBRATION IS NO LONGER REACHABLE, AND THAT IS A STRONGER STATE
  // RATHER THAN A HOLE — restated 2026-09-01. It required the FIRST strides-typed session in a plan to
  // be an effort-only one, and two changes made that impossible: `easyHillStrides` left the flavour
  // rotation entirely (2026-08-31), and `pickSprintSlot` now prefers an easy day the rotation would NOT
  // have given strides (2026-09-01) — so a week's strides-typed session is the relaxed one and the
  // sprint day sits elsewhere. Measured: 0 of 480 plans, where it used to be dozens.
  //
  // ⚠️ SO THE PRECONDITION IS RESTATED AS THE ONE `repScore` ACTUALLY NEEDS: both candidate kinds must
  // EXIST in the plan, or its band term has nothing to discriminate between and every guard built on it
  // is hollow whatever the first-match rule would have done. Measured: **480 of 480 plans carry both** a
  // relaxed-strides session and an effort-only hill session — three quarters of this fixture, which
  // includes run-walk beginners (who get no hill sprints at all, by the documented scoping decision)
  // and short-runway blocks with few easy days. The bar sits at 600 so the discrimination is exercised
  // by the large majority rather than by a handful.
  let withBothKinds = 0;
  for (const p of PLANS) {
    let hill = false;
    let relaxed = false;
    for (const wk of p.raw.weeks) for (const s of wk.sessions as any[]) {
      if (s.type !== "strides" && s.type !== "easy") continue;
      const reps = (s.steps || []).filter((st: any) => st.kind === "rep");
      if (!reps.length) continue;
      if (reps.some((st: any) => !st.targetPaceSecPerKm)) hill = true;
      if (reps.some((st: any) => st.targetPaceSecPerKm)) relaxed = true;
    }
    if (hill && relaxed) withBothKinds++;
  }
  void stridesUnpaced;
  void withStrides;
  assert.ok(withBothKinds >= 600,
    `only ${withBothKinds} of ${PLANS.length} plans carry BOTH a relaxed-strides session and an ` +
    "effort-only hill session — repScore's band term has nothing to discriminate between, so every " +
    "guard built on it is hollow");
});

test("BLOCKER: a custom EASY run is an easy run — the owner's own screenshot", () => {
  // The exact asks from his field test plus the two he could reach from the same control.
  const asks: Array<Record<string, unknown>> = [
    { durMin: 20 }, { durMin: 30 }, { durMin: 45 }, { durMin: 12, distKm: 2 }, { durMin: 37, distKm: 6 },
  ];
  let checked = 0;
  for (const p of PLANS) {
    if (!typesIn(p).has("easy")) continue;
    const want = bandKey(p.paces.easy);
    for (const ask of asks) {
      const s = custom(p, "easy", ask);
      assert.ok(s, `no custom easy session at all for ${p.label} ${JSON.stringify(ask)}`);
      const body = bodyStep(s);
      assert.ok(body, `a custom easy run with no paced body: ${p.label} ${JSON.stringify(ask)}`);
      // ⚠️ THE BAND IS THE CHECKABLE HALF. His was 6:02–6:25 against an easy band of 6:31–7:06.
      assert.equal(bandKey(body.targetPaceSecPerKm), want,
        `a custom easy run is prescribed at the wrong gear on ${p.label} ${JSON.stringify(ask)}: ` +
        `band ${bandKey(body.targetPaceSecPerKm)}, easy is ${want}, label "${body.label}"`);
      // ⚠️ AND THE LABEL IS WHAT HE READ. "Moderate — quicker than easy, still comfortable" is the
      // MODERATE run's own body label; it may never appear under a card titled "easy run".
      assert.ok(!/moderate/i.test(String(body.label)),
        `a custom easy run describes itself as moderate on ${p.label}: "${body.label}"`);
      assert.ok(/easy|conversational|run.walk|jog/i.test(String(body.label)),
        `a custom easy run's body says nothing about being easy on ${p.label}: "${body.label}"`);
      checked++;
    }
  }
  assert.ok(checked >= 500, "not enough custom easy runs measured: " + checked);
});

test("BLOCKER: every gear-named type is built at the gear its own label promises", () => {
  // ⚠️ THE TABLE IS NOT THE GUARD — this drives the builder for each type and reads the band back.
  // long, recovery and strides already measured 100% correct under the old first-match rule, so
  // these three are here to LOCK the invariant: a new easy-family template that lands earlier in a
  // plan cannot silently take a representative's place.
  const WANT: Record<string, string> = { easy: "easy", long: "easy", recovery: "recovery", strides: "easy" };
  let checked = 0;
  for (const p of PLANS) {
    const have = typesIn(p);
    for (const [type, gear] of Object.entries(WANT)) {
      if (!have.has(type)) continue;
      const s = custom(p, type, { durMin: 30 });
      assert.ok(s, `no custom ${type} session for ${p.label}`);
      const body = bodyStep(s);
      assert.ok(body, `a custom ${type} session with no paced body: ${p.label}`);
      assert.equal(bandKey(body.targetPaceSecPerKm), bandKey(p.paces[gear]),
        `a custom ${type} session is at the wrong gear on ${p.label}: ` +
        `${bandKey(body.targetPaceSecPerKm)} against ${gear} ${bandKey(p.paces[gear])} ("${body.label}")`);
      // ⚠️ AND NOTHING ELSE IS MIXED IN — which is a SECOND claim, not a restatement. The longest
      // step of "N′ easy → moderate finish" is its easy 60%, so the assertion above passes on a
      // session that lifts to moderate for its last third; the runner asked for an easy run and
      // would get a moderate block at the end of it. Strides are excluded because "Easy + Strides"
      // promises fast bursts by name — its own guard is below.
      if (type !== "strides") {
        const mixed = (s.steps || []).filter((st: any) =>
          st.kind !== "warmup" && st.kind !== "cooldown" && st.kind !== "recovery" &&
          bandKey(st.targetPaceSecPerKm) !== bandKey(p.paces[gear]));
        assert.equal(mixed.length, 0,
          `a custom ${type} session carries work at another gear on ${p.label}: ` +
          `"${mixed[0]?.label}" at ${bandKey(mixed[0]?.targetPaceSecPerKm)}, not ${gear}`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 300, "not enough gear-named types measured: " + checked);
});

test("BLOCKER: Easy + Strides delivers strides, not maximal hill sprints", () => {
  // ⚠️ THE GRID'S OWN BLURB IS "An easy run with relaxed fast bursts", and the built title is
  // "N′ easy + strides (custom)". Measured before the fix: 320 of 320 plans that offer the type
  // handed back easy + HILL SPRINTS — a 10-second maximal uphill effort at RPE 8, which is neither
  // relaxed nor a burst on the flat, under a title that said strides.
  //
  // ⚠️ ASSERTED ON THE MECHANISM, NOT ON A TITLE WORD. The discriminator is that relaxed strides run
  // at repetition pace while hill sprints carry NO pace by design (pace up a hill is a function of
  // gradient — the engine says so). So: the fast work must have a band to aim at.
  let checked = 0, sprints = 0;
  for (const p of PLANS) {
    if (!typesIn(p).has("strides")) continue;
    const s = custom(p, "strides", { durMin: 35 });
    assert.ok(s, "no custom strides session for " + p.label);
    const work = (s.steps || []).filter((st: any) => st.kind === "rep");
    assert.ok(work.length > 0, `a custom Easy + Strides session with no fast work at all: ${p.label}`);
    const unpaced = work.filter((st: any) => !st.targetPaceSecPerKm);
    if (unpaced.length) sprints++;
    assert.equal(unpaced.length, 0,
      `Easy + Strides delivered effort-only work with no pace on ${p.label}: "${unpaced[0]?.label}"`);
    // Relaxed, not maximal: strides sit at repetition pace, and nothing here should be quicker.
    for (const st of work) {
      assert.ok(st.targetPaceSecPerKm.minSecPerKm >= p.paces.rep.minSecPerKm,
        `Easy + Strides work is quicker than repetition pace on ${p.label}: "${st.label}"`);
    }
    checked++;
  }
  assert.ok(checked >= 50, "not enough strides sessions measured: " + checked);
  assert.equal(sprints, 0, sprints + " plans still hand Easy + Strides an effort-only hill sprint");
});

test("BLOCKER: a run-walk beginner still gets a run-walk", () => {
  // ⚠️ THE CLONE EXISTS FOR THIS RUNNER. A beginner run-walk plan is built ENTIRELY from easy-typed
  // sessions, so its representative is the only base there is — and choosing a "plainer" candidate
  // must never turn a run-walker's extra into a continuous run they cannot yet do. A walk break is
  // an unpaced recovery step, so scoring has to ignore recoveries or this test fails.
  const rw = PLANS.filter((p) => p.runWalk);
  assert.ok(rw.length >= 8, "no run-walk plans in the sweep: " + rw.length);
  for (const p of rw) {
    const rep = repFor(p, "easy");
    assert.ok(rep, "no easy representative for a run-walk plan: " + p.label);
    const walks = (rep.steps || []).filter((st: any) => st.kind === "recovery" && /walk/i.test(st.label || ""));
    assert.ok(walks.length > 0,
      `a run-walk beginner's easy representative has no walk breaks on ${p.label}: "${rep.title}"`);
    const s = custom(p, "easy", { durMin: 30 });
    assert.ok((s.steps || []).some((st: any) => st.kind === "recovery" && /walk/i.test(st.label || "")),
      `a run-walk beginner's custom easy run lost its walk breaks on ${p.label}: "${s.title}"`);
  }
});

test("BLOCKER: the quality types keep first-match, which is the scoping decision", () => {
  // ⚠️ "Tempo" AND "Intervals" NAME A FAMILY, NOT A GEAR. The threshold pool legitimately spans
  // cruise intervals at CV, a continuous tempo at threshold, true tempo, and effort-only Kenyan
  // hills with no pace at all — measured, the first threshold-typed session sits at the threshold
  // band in only 43.8% of plans and every other case is a real threshold-family session. There is
  // no band that is the right answer, and the runner picks the format from the workout list. So the
  // scoring must leave them exactly where they were, and this proves it rather than asserting it.
  let checked = 0;
  for (const p of PLANS) {
    const first: Record<string, any> = {};
    for (const wk of p.raw.weeks) for (const s of wk.sessions as any[]) {
      if (!first[s.type]) first[s.type] = s;
    }
    for (const type of ["threshold", "vo2", "race-specific"]) {
      if (!first[type]) continue;
      const rep = repFor(p, type);
      assert.ok(rep, `no ${type} representative on ${p.label}`);
      assert.equal(rep.id, first[type].id,
        `${type} no longer takes the plan's first one on ${p.label}: ` +
        `"${rep.title}" instead of "${first[type].title}"`);
      checked++;
    }
  }
  assert.ok(checked >= 200, "not enough quality types measured: " + checked);
});

test("BLOCKER: a representative is never null for a type the plan contains", () => {
  // ⚠️ CLAUDE.md RECORDS WHAT THIS COSTS. runTypesAvailable gates the type grid on extraRep, and a
  // representative that came back null once froze the whole add-session sheet: buildCustomSession
  // returns null, and reading estimatedDurationSeconds off null threw inside addSessionSheetHtml
  // with BUILDER already mutated, so every other control on the stale screen went dead too. A
  // selector that can return NOTHING where the old one returned something reopens that defect.
  for (const p of PLANS) {
    for (const type of typesIn(p)) {
      const rep = repFor(p, type);
      // Non-runnable types (strength, mobility, rest, race) are not offered and need no
      // representative; everything the grid can offer must have one.
      if (!["easy", "long", "recovery", "strides", "threshold", "vo2", "race-specific"].includes(type)) continue;
      assert.ok(rep, `extraRep("${type}") is null on ${p.label} — the add sheet would freeze`);
      assert.ok((rep.steps || []).length > 0, `an empty representative for ${type} on ${p.label}`);
    }
  }
});

test("BLOCKER: with no purely-easy candidate, the one whose MAIN body is easy still wins", () => {
  // ⚠️ CONSTRUCTED, NOT SWEPT, AND THE MEASUREMENT IS WHY. Every generated plan has a candidate that
  // is purely at its named gear — 960 of 960 easy, 720 of 720 long, 480 of 480 recovery — so the
  // "nothing else mixed in" term always decides and this fallback ordering is unreachable from
  // generatePlan. It is still the term that stops "whichever session the walk reached first" being
  // the answer for a plan shape nobody can rule out, so it is exercised here directly.
  //
  // Two easy-typed sessions, neither pure: a plain MODERATE run (all of it at the aerobic band) and
  // an easy → moderate progression (two thirds of it easy). The runner asked for an easy run, so the
  // second is the closer answer and must win despite coming second in the plan.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  const mk = (id: string, title: string, steps: any[]) => ({
    id, title, type: "easy", dayOfWeek: 0, steps,
    estimatedDurationSeconds: steps.reduce((a: number, s: any) => a + (s.durationSeconds || 0), 0),
    estimatedDistanceMeters: 5000, targetRpe: { min: 2, max: 4 },
  });
  const raw = {
    paces,
    weeks: [{ sessions: [
      mk("all-moderate", "40′ moderate run", [
        { kind: "steady", label: "Moderate — quicker than easy, still comfortable",
          durationSeconds: 2400, targetPaceSecPerKm: (paces as any).aerobic, targetRpe: { min: 3, max: 4 } },
      ]),
      mk("mostly-easy", "40′ easy → moderate finish", [
        { kind: "steady", label: "Easy, conversational",
          durationSeconds: 1600, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
        { kind: "steady", label: "Lift to moderate for the last third",
          durationSeconds: 800, targetPaceSecPerKm: (paces as any).aerobic, targetRpe: { min: 3, max: 4 } },
      ]),
    ] }],
  };
  B.__setRaw(raw);
  const rep = B.extraRep("easy");
  assert.ok(rep, "no representative at all on the degenerate plan");
  assert.equal(rep.id, "mostly-easy",
    `with no purely-easy candidate the representative fell back to plan order: "${rep.title}"`);
  // And the reverse order gives the same answer, so this is the scoring and not the position.
  B.__setRaw({ paces, weeks: [{ sessions: [raw.weeks[0]!.sessions[1], raw.weeks[0]!.sessions[0]] }] });
  assert.equal(B.extraRep("easy").id, "mostly-easy", "the answer depends on plan order, not on the score");
});

test("scoring can only ever REPLACE a worse candidate, never reorder ties", () => {
  // ⚠️ STATED AS A PROPERTY BECAUSE THE ALTERNATIVE IS A SORT, AND A SORT MAKES THE ANSWER DEPEND ON
  // A COMPARATOR RATHER THAN ON THE PLAN. Ties must keep plan order, or the representative for a
  // quality type would move for no reason a reader could point at.
  const src = appScript();
  const body = fnBody(src, "sessionLibrary")!;
  assert.ok(/sc > byScore\[s\.type\]/.test(decomment(body)),
    "sessionLibrary no longer keeps the first of equal-scoring candidates");
  // and the behaviour it implies, measured through the builder: two runs of the sweep agree.
  for (const p of PLANS.slice(0, 20)) {
    const a = repFor(p, "easy"), b = repFor(p, "easy");
    assert.equal(a.id, b.id, "the representative is not stable on " + p.label);
  }
});
