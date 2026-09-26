/**
 * Y4 of the 12-17 programme: Strava's own age rules, and the age answer they stand on.
 *
 * Strava's rules are quoted in src/domain/youth.ts from Strava's own pages (verified 2026-09-23):
 * accounts start at 13, and "athletes under 16 cannot upload heart rate data". Before Y4 the app sent
 * every run's heart rate inside the GPX, whatever the runner's age.
 *
 * ⚠️⚠️ STARTING Y4 FOUND TWO THINGS UNDER IT, AND THEY ARE GUARDED HERE BECAUSE THE STRAVA GATES STAND
 * ON THEM. (1) The app never handed the runner's age to the plan builder, so every youth limit Y2 and
 * Y3 built into the engine was computed and discarded for a real plan -- the engine's own tests set
 * Athlete.age by hand, so nothing could see it. (2) "Prefer not to say" was stored as 0, and the youth
 * test counted 0 as a child. So the first guard below drives the app's own applyProfile and reads what
 * it actually hands over, and the second proves 0 is not an age.
 *
 * Everything here RUNS the shipped functions out of the built page with the REAL engine rules. A stub
 * answering "allowed" would measure a strictly easier program, which is how this project has shipped a
 * guard that passed while the thing it guarded was unwired.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ageAnswer, isYouthAge, youthLimitsFor, stravaAllowedAt, stravaHeartRateAllowedAt,
  STRAVA_MIN_AGE, STRAVA_HEART_RATE_MIN_AGE,
} from "../src/domain/youth.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
// Comment lines joined, so a quote that wraps across two doc-comment lines is still one sentence.
const YOUTH_SRC = readFileSync(new URL("../src/domain/youth.ts", import.meta.url), "utf8").replace(/\s*\n\s*\*\s*/g, " ");

/** A top-level function's source out of the built page, brace-matched. */
function fnOf(name: string): string {
  const at = PAGE.indexOf("\nfunction " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = PAGE.indexOf("{", at); i < PAGE.length; i++) {
    if (PAGE[i] === "{") d++;
    else if (PAGE[i] === "}") { d--; if (!d) return PAGE.slice(at + 1, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}
/** Line comments out, so a guard is not satisfied by a comment quoting what it looks for. */
const nocomment = (src: string) => src.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

/** Evaluate some of the page's functions against a scope, and hand back one of them. */
function lift<T>(names: string[], ret: string, scope: Record<string, unknown>): T {
  const keys = Object.keys(scope);
  const src = names.map(fnOf).join("\n") + "\nreturn " + ret + ";";
  // eslint-disable-next-line no-new-func
  return new Function(...keys, src)(...keys.map((k) => scope[k])) as T;
}

const REAL_RC = { ageAnswer, isYouthAge, youthLimitsFor, stravaAllowedAt, stravaHeartRateAllowedAt };

test("Strava's two numbers are Strava's, and the source quotes where they come from", () => {
  assert.equal(STRAVA_MIN_AGE, 13, "Strava's minimum age is 13 -- re-read its Help Centre before changing it");
  assert.equal(STRAVA_HEART_RATE_MIN_AGE, 16, "Strava's heart-rate age is 16 -- re-read its Help Centre before changing it");
  // The numbers travel with their evidence, so a change to one without the other shows in review.
  assert.ok(YOUTH_SRC.includes("Strava allows accounts starting at age 13"), "the minimum-age quote has gone");
  assert.ok(YOUTH_SRC.includes("athletes under 16 cannot upload heart rate data"), "the heart-rate quote has gone");
  const cases: Array<[unknown, boolean, boolean]> = [
    [9, false, false], [12, false, false], [13, true, false], [15, true, false],
    [16, true, true], [17, true, true], [18, true, true], [46, true, true],
    // No answer means allowed, exactly as it means adult everywhere else: Strava checks a date of
    // birth at its own sign-up, and refusing here would take Strava from every adult who skipped it.
    [undefined, true, true], [0, true, true], ["", true, true],
  ];
  for (const [age, use, hr] of cases) {
    assert.equal(stravaAllowedAt(age), use, "Strava allowed at " + String(age));
    assert.equal(stravaHeartRateAllowedAt(age), hr, "Strava heart rate allowed at " + String(age));
  }
});

test("BLOCKER: \"Prefer not to say\" is not a 12-year-old", () => {
  // The form stored a blank age as 0, and isYouthAge counted 0 as a child: youthLimitsFor(0) was the
  // 12 row, so an adult who declined the question got a 12-year-old's lifting.
  assert.equal(ageAnswer(0), null, "0 is read as an age");
  assert.equal(isYouthAge(0), false, "a stored 0 is a child again");
  assert.equal(youthLimitsFor(0), null, "a stored 0 gets youth limits again");
  for (const none of [undefined, null, "", "  ", NaN, -3, Infinity, "abc"]) assert.equal(ageAnswer(none), null, "no answer read as " + String(none));
  // A real number stays an answer -- including a numeric string (a form field, a restored backup) and
  // an age under 12, which is still a child (isYouthAge is deliberately unbounded below).
  assert.equal(ageAnswer("13"), 13); assert.equal(ageAnswer(46), 46);
  assert.equal(isYouthAge("13" as unknown as number), true, "a numeric-string 13 is treated as an adult");
  assert.equal(isYouthAge(9), true, "an age under 12 stopped being a child");
  // And the app's own isYouth asks the engine, so the two cannot disagree about who is a child.
  const isYouth = (age: unknown) => lift<() => boolean>(["isYouth"], "isYouth", { RC: REAL_RC, profile: { age } })();
  assert.equal(isYouth(0), false, "the app treats a stored 0 as a child");
  assert.equal(isYouth(undefined), false);
  assert.equal(isYouth(13), true, "the app no longer treats a 13-year-old as a child");
  // The form stores no key for a blank answer rather than a 0.
  const draft = nocomment(fnOf("draftFromForm"));
  assert.match(draft, /age: RC\.ageAnswer\(wizFieldVal\("s_age"\)\) \|\| undefined,/, "the form no longer asks the engine what an age answer is");
  assert.ok(!/age: Number\(wizFieldVal\("s_age"\)\) \|\| 0/.test(draft), "the form stores a blank age as 0 again");
  // The goal picker keeps no private copy of the test -- the copy is why the two disagreed.
  const picker = nocomment(fnOf("currentAgeAnswer"));
  assert.ok(!/> 0/.test(picker), "currentAgeAnswer carries its own positive-number test again");
  assert.match(picker, /return RC\.ageAnswer\(profile && profile\.age\);/);
});

/**
 * The app's applyProfile, run for real up to the moment it hands the athlete to the plan builder,
 * with a spy engine that records what it was given. Only the helpers that have nothing to do with age
 * are stand-ins; ageAnswer is the engine's own.
 */
function athleteHandedOver(age: unknown) {
  const STOP = new Error("stop");
  let got: { ath: any; goal: any } | null = null;
  const RC = {
    ...REAL_RC,
    classifyRunner: () => ({ tier: 3 }),
    riegelPredict: (d1: number, t1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06),
    buildPlanSummary: (ath: any, goal: any) => { got = { ath, goal }; throw STOP; },
    generatePlan: () => { throw STOP; },
  };
  const applyProfile = lift<(pf: unknown) => unknown>(["applyProfile"], "applyProfile", {
    RC, trainingYearsFor: () => 3, resolvedStatus: () => "regular", experienceFor: () => "recreational",
    typeCeilingFor: () => 4, returnKind: () => null, strengthPrefsOf: () => null, progActive: () => false,
    todayIso: () => "2026-09-28", Math,
  });
  const pf: Record<string, unknown> = { daysPerWeek: 4, recentTimeS: 1440, twoKmS: 0, strength: true, status: "regular",
    longRunDay: 6, volKm: 0, goalDist: "5k", targetS: 1380, raceDate: "2026-12-20", startDateIso: "2026-09-28" };
  if (age !== undefined) pf.age = age;
  try { applyProfile(pf); } catch (e) { if (e !== STOP) throw e; }
  assert.ok(got, "applyProfile never reached the plan builder");
  return got as unknown as { ath: any; goal: any };
}

test("BLOCKER: the app hands the runner's age to the plan builder", () => {
  // Before Y4 this object never carried an age, so Y2's distance ceilings and Y3's lifting rules were
  // built, tested in the engine, and never reached anybody's plan.
  assert.equal(athleteHandedOver(13).ath.age, 13, "a 13-year-old's age is not handed to the plan builder");
  assert.equal(athleteHandedOver(46).ath.age, 46);
  assert.ok(!("age" in athleteHandedOver(0).ath), "a stored 0 is handed over as an age");
  assert.ok(!("age" in athleteHandedOver(undefined).ath), "an absent age is handed over as something");
  // The summary and the full plan are built from the SAME object, so both carry it.
  const ap = nocomment(fnOf("applyProfile"));
  const handed = ap.indexOf("if (ageA != null) ath.age = ageA;");
  assert.ok(handed > 0, "the age hand-off is gone");
  for (const call of ["RC.buildPlanSummary(ath, goal)", "RC.generatePlan(ath, goal)"]) {
    const at = ap.indexOf(call);
    assert.ok(at > 0, call + " is no longer how the plan is built");
    assert.ok(handed < at, "the age is set after " + call);
  }
});

test("BLOCKER: a 13-year-old's REAL plan now carries the youth limits, end to end", () => {
  const runsPerWeek = (plan: any) => Math.max(...plan.weeks.map((w: any) =>
    w.sessions.filter((s: any) => !["rest", "strength", "mobility", "cross-training"].includes(s.type)).length));
  const percentLifts = (plan: any) => plan.weeks.flatMap((w: any) => w.sessions)
    .filter((s: any) => s.type === "strength").flatMap((s: any) => s.exercises || [])
    .filter((e: any) => e.loadPercent1RM).length;
  const youth = athleteHandedOver(13);
  const kid = generatePlan(youth.ath, youth.goal);
  const lim = youthLimitsFor(13)!;
  assert.ok(runsPerWeek(kid) <= lim.maxRunDays, "a 13-year-old is given " + runsPerWeek(kid) + " runs in a week");
  assert.equal(percentLifts(kid), 0, "a 13-year-old is prescribed lifts at a percentage of a one-rep max");
  // The fixture has to be able to see the difference, or the two assertions above prove nothing.
  const adult = athleteHandedOver(undefined);
  const grown = generatePlan(adult.ath, adult.goal);
  assert.ok(runsPerWeek(grown) > lim.maxRunDays, "the fixture cannot tell a youth plan from an adult one (runs)");
  assert.ok(percentLifts(grown) > 0, "the fixture cannot tell a youth plan from an adult one (lifting)");
});

const RUN = {
  id: "run-1786000000000", t: "5 km easy", type: "easy", dateIso: "2026-08-09", distKm: 1.2, sec: 420,
  route: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ lat: 51.5 + i * 0.0015, lng: -0.12, t: i * 60 })),
  hrSeries: [[0, 120], [300, 135], [600, 142], [900, 150], [1200, 151]],
};
function payloadAt(age: unknown) {
  const build = lift<(r: unknown) => any>(["runStravaPayload", "stravaHeartRateOk"], "runStravaPayload", {
    RC: REAL_RC, profile: age === undefined ? {} : { age },
    esc: (x: unknown) => String(x ?? ""),
    runStartMs: () => Date.parse("2026-08-09T09:00:00Z"),
    runStartExactMs: () => Date.parse("2026-08-09T09:00:00Z"),
  });
  return build(RUN);
}

test("BLOCKER: under 16, no heart rate goes to Strava -- and the run itself still does", () => {
  for (const age of [13, 14, 15]) {
    const p = payloadAt(age);
    assert.equal(p.kind, "gpx", "a " + age + "-year-old's run stopped being a real GPX");
    assert.ok(!/gpxtpx/.test(p.gpx), "a " + age + "-year-old's GPX carries heart rate to Strava");
    assert.equal(p.hrPoints, 0);
    assert.equal((p.gpx.match(/<trkpt /g) || []).length, RUN.route.length, "the route was dropped with the heart rate");
  }
  // From 16, and for anybody who gave no age, the heart rate goes exactly as before.
  for (const age of [16, 17, 46, undefined, 0]) {
    const p = payloadAt(age);
    assert.ok(/<gpxtpx:hr>/.test(p.gpx), "heart rate stopped going to Strava at " + String(age));
    assert.ok(p.hrPoints > 0);
  }
});

function gates(age: unknown, connected: boolean) {
  const cfg = connected ? { connected: true, key: "k", sportTypes: ["Run", "WeightTraining"] } : {};
  return lift<Record<string, () => boolean>>(
    ["stravaConnected", "stravaAgeOk", "stravaHeartRateOk", "stravaActive"],
    "{ stravaConnected, stravaAgeOk, stravaHeartRateOk, stravaActive }",
    { RC: REAL_RC, profile: age === undefined ? {} : { age }, stravaCfg: () => cfg });
}

test("BLOCKER: under 13, nothing is sent -- every upload path asks the gate first", () => {
  assert.equal(gates(12, true).stravaActive!(), false, "a connected 12-year-old can still send to Strava");
  assert.equal(gates(13, true).stravaActive!(), true);
  assert.equal(gates(undefined, true).stravaActive!(), true, "an adult who skipped the age lost Strava");
  assert.equal(gates(13, false).stravaActive!(), false, "being old enough now stands in for being connected");
  // Derived, not listed: every function that uploads to Strava must ask stravaActive before it does,
  // and there are exactly two -- a third upload path fails here until somebody decides about it.
  const app = PAGE.slice(PAGE.indexOf("function stravaCfg("));
  const uploaders = [...app.matchAll(/\nfunction ([A-Za-z0-9_]+)\(/g)].map((m) => m[1]!)
    .filter((n) => /stravaCall\("\/strava\/upload",/.test(fnOf(n)));
  assert.deepEqual(uploaders.sort(), ["stravaSendRun", "strengthSendSession"], "the set of Strava upload paths changed");
  for (const n of uploaders) {
    const src = nocomment(fnOf(n));
    const gate = src.indexOf("stravaActive()"), call = src.indexOf('stravaCall("/strava/upload",');
    assert.ok(gate > 0 && gate < call, n + " uploads without asking whether this runner may use Strava");
  }
  // The app keeps no copy of Strava's numbers, and no catch that could fail OPEN.
  for (const n of ["stravaAgeOk", "stravaHeartRateOk"]) {
    const src = nocomment(fnOf(n));
    assert.ok(!/\b1[36]\b/.test(src), n + " carries its own copy of Strava's age");
    assert.ok(!/catch/.test(src), n + " can fail open");
  }
  assert.match(nocomment(fnOf("stravaAgeOk")), /RC\.stravaAllowedAt\(profile\.age\)/);
  assert.match(nocomment(fnOf("stravaHeartRateOk")), /RC\.stravaHeartRateAllowedAt\(profile\.age\)/);
});

test("BLOCKER: under 13, Connect never opens Strava", () => {
  const connectAt = (age: unknown) => {
    const opened: string[] = [], toasts: string[] = [];
    const cfg: Record<string, unknown> = {};
    const connect = lift<() => void>(["stravaConnect", "stravaAgeOk"], "stravaConnect", {
      RC: REAL_RC, profile: age === undefined ? {} : { age },
      stravaBase: () => "https://example.test", stravaDeviceKey: () => "k",
      stravaCfg: () => cfg, stravaSaveCfg: () => {}, stravaRerender: () => {},
      toast: (m: string) => toasts.push(m), window: { open: (u: string) => opened.push(u) },
    });
    connect();
    return { opened, toasts };
  };
  const kid = connectAt(12);
  assert.equal(kid.opened.length, 0, "Connect opened Strava for a 12-year-old");
  assert.match(kid.toasts.join(" "), /13 and over/, "a refused Connect says nothing");
  assert.equal(connectAt(13).opened.length, 1, "a 13-year-old cannot connect");
  assert.equal(connectAt(undefined).opened.length, 1, "an adult who skipped the age cannot connect");
});

function sheetAt(age: unknown, connected: boolean): string {
  const cfg = connected ? { connected: true, key: "k", name: "Sam" } : {};
  return lift<() => string>(
    ["stravaSheetHtml", "stravaConnected", "stravaAgeOk", "stravaHeartRateOk", "stravaHeartRateNote"], "stravaSheetHtml",
    { RC: REAL_RC, profile: age === undefined ? {} : { age }, stravaCfg: () => cfg,
      stravaBase: () => "https://example.test", stravaDevMode: () => false, esc: (x: unknown) => String(x ?? "") })();
}

test("the Strava sheet tells each age what it can do, and keeps Disconnect for a connected under-13", () => {
  const kid = sheetAt(12, false);
  assert.match(kid, /Strava is for 13 and over/, "a 12-year-old is not told why there is no Strava");
  assert.ok(!/id="stvGo"/.test(kid), "a 12-year-old is offered Connect");
  const kidOn = sheetAt(12, true);
  assert.match(kidOn, /id="stvOff"/, "a connected 12-year-old cannot disconnect");
  assert.ok(!/id="stvAuto"/.test(kidOn), "a connected 12-year-old is offered automatic sending");
  // 13-15: Strava, with the heart-rate line in both states.
  for (const on of [false, true]) {
    const teen = sheetAt(14, on);
    assert.match(teen, /heart rate stays in Inte-Run until you.re 16/, "a 14-year-old is not told about heart rate (" + (on ? "connected" : "not connected") + ")");
    assert.match(teen, on ? /id="stvOff"/ : /id="stvGo"/);
  }
  // 16 and over, and no answer: no heart-rate line, the ordinary sheet.
  for (const age of [16, 46, undefined]) {
    assert.ok(!/until you.re 16/.test(sheetAt(age, true)), "a " + String(age) + " is told their heart rate is withheld");
    assert.match(sheetAt(age, false), /id="stvGo"/);
  }
});

test("the send controls and the finish screen go by stravaActive, not stravaConnected", () => {
  // stravaRunButtonHtml and the finish screen's row are absent, not disabled, for a connected 12-year-old.
  const btn = (age: unknown) => lift<(r: unknown) => string>(
    ["stravaRunButtonHtml", "stravaConnected", "stravaAgeOk", "stravaActive"], "stravaRunButtonHtml",
    { RC: REAL_RC, profile: age === undefined ? {} : { age }, stravaCfg: () => ({ connected: true, key: "k" }),
      esc: (x: unknown) => String(x ?? ""), ICON: { share: "" } })({ id: "run-1", strava: null });
  assert.equal(btn(12), "", "a connected 12-year-old is shown Send to Strava");
  assert.match(btn(13), /id="stvSend"/, "a 13-year-old lost Send to Strava");
  for (const [fn, re] of [
    ["liveSyncHtml", /if \(stravaActive\(\)\) rows\.push\(syncRowHtml\("lStrava"/],
    ["stravaCanWeightTraining", /return stravaActive\(\) &&/],
    ["stravaMaybeAutoSend", /!stravaActive\(\)/],
  ] as const) assert.match(nocomment(fnOf(fn)), re, fn + " no longer asks stravaActive");
});
