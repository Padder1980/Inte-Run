import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

/**
 * THE PLAN GETS HARDER AS THE WEEKS GO BY (2026-10-04, the owner: "fix the plan so it gets harder, counting from
 * this week").
 *
 * applyProfile used to replace a start date in the past with today, so the block was rebuilt from today on every
 * launch and the runner was ALWAYS in its first week: measured, an 80-minute long run every week for twelve weeks,
 * the block never leaving base. The weeks ahead on the Plan screen climbed — and were regenerated as week 1 when
 * they arrived. Now the start is kept as it is (planStartIso), a plan from before the fix is moved ONCE to count
 * from the day the fix first runs (anchorMigrate — never from its old start, which would be a sudden jump), and
 * every path that adopts a plan writes a date rather than a blank.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function planStartIso(");
  assert.ok(marker >= 0, "planStartIso is not in the build — run node web/app.ts");
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
const decomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const TODAY = ISO(new Date());
const MONDAY = addDays(TODAY, -((new Date(TODAY + "T00:00:00Z").getUTCDay() + 6) % 7));

/**
 * applyProfile and planStartIso, lifted, over the REAL engine. The app helpers that only shape the athlete
 * (classification, the strength answers, a running programme) are fixed, so the one thing that can change the
 * block between two "launches" is the day it is built on — the clock.
 */
function builder() {
  const clock = { today: TODAY };
  const env: Record<string, unknown> = {
    RC, todayIso: () => clock.today,
    trainingYearsFor: () => 3, resolvedStatus: (p: any) => p.status, typeCeilingFor: () => undefined,
    experienceFor: () => "recreational", strengthPrefsOf: () => null, progActive: () => false,
  };
  // blockStartIso joined it with the pause that picks up where you left off (test/pause-pickup.test.ts).
  const src = ["applyProfile", "planStartIso", "blockStartIso", "returnKind"].map(fnBody).join("\n");
  const names = Object.keys(env);
  const api = new Function(...names, src + "\nreturn { applyProfile, planStartIso };")(...names.map((n) => env[n]));
  return { api, clock };
}
const PROFILE = (start: string) => ({ status: "regular", goalDist: "half", targetS: 6300, raceDate: addDays(MONDAY, 7 * 14 + 6),
  startDateIso: start, longRunDay: 6, recentTimeS: 1500, noRecent: false, twoKmS: 0, daysPerWeek: 5, volKm: 40, strength: false,
  returning: false, age: 40 });
/** The block's week holding `day`, and that week's long run in minutes. */
function weekOf(out: any, day: string) {
  const i = out.raw.weeks.findIndex((w: any) => { const mon = addDays(w.startDateIso, -((new Date(w.startDateIso + "T00:00:00Z").getUTCDay() + 6) % 7)); return day >= mon && day <= addDays(mon, 6); });
  const w = out.raw.weeks[i];
  const lr = w && w.sessions.find((s: any) => s.type === "long");
  return { index: w ? w.index : null, long: lr ? Math.round(lr.estimatedDurationSeconds / 60) : null };
}

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the week a runner lives in advances through the block — the plan gets harder as the weeks go by", () => {
  // ⚠️ THE DEFECT, PUT BACK: with the old rule (a past start replaced by today) every row below is week 1 with
  // an 80-minute long run. Built on six successive Mondays, the plan must put each one in its own week.
  const { api, clock } = builder();
  const start = MONDAY;
  const seen: { index: number | null; long: number | null }[] = [];
  for (let k = 0; k < 6; k++) {
    clock.today = addDays(MONDAY, 7 * k);
    const out = api.applyProfile(PROFILE(start));
    assert.equal(out.goal.startDateIso, start, "launch " + k + " rebuilt the block from its own today");
    seen.push(weekOf(out, clock.today));
  }
  assert.deepEqual(seen.map((s) => s.index), [1, 2, 3, 4, 5, 6], "the runner is not moving through the block");
  // The long run the runner meets each week is the block's own for that week — the same block built once.
  clock.today = MONDAY;
  const once = api.applyProfile(PROFILE(start));
  assert.deepEqual(seen.map((s) => s.long), [1, 2, 3, 4, 5, 6].map((n) => weekOf(once, addDays(MONDAY, 7 * (n - 1))).long),
    "a week met on its own Monday is not the week the plan showed for it beforehand");
  assert.ok(new Set(seen.map((s) => s.long)).size > 2, "the long run never changes: " + seen.map((s) => s.long).join(", "));
  assert.ok(Math.max(...seen.map((s) => s.long!)) > seen[0]!.long!, "the long run never grows past the first week's");
});

test("BLOCKER: the stored start is used as it is — past or future — and a blank is today", () => {
  const { api } = builder();
  assert.equal(api.planStartIso({ startDateIso: addDays(TODAY, -40) }), addDays(TODAY, -40), "a start in the past was pulled up to today");
  assert.equal(api.planStartIso({ startDateIso: addDays(TODAY, 9) }), addDays(TODAY, 9), "a future start (a pause) is not honoured");
  assert.equal(api.planStartIso({ startDateIso: "" }), TODAY);
  assert.equal(api.planStartIso(null), TODAY);
  assert.match(decomment(fnBody("applyProfile")), /const startDateIso = planStartIso\(pf\);/);
  assert.ok(!/startDateIso >= todayIso\(\) \? pf\.startDateIso : todayIso\(\)/.test(decomment(SRC)), "the old clamp is back");
});

function migrator(profile: any, opts: { firstRun?: boolean; mark?: string; today?: string } = {}) {
  const store: Record<string, string> = {};
  if (opts.mark) store["interun_anchor_v1"] = opts.mark;
  const localStorage = { getItem: (k: string) => (k in store ? store[k]! : null), setItem: (k: string, v: string) => { store[k] = String(v); } };
  let saved: any = null;
  const env: Record<string, unknown> = {
    localStorage, profile, FIRST_RUN: !!opts.firstRun, todayIso: () => opts.today || TODAY,
    saveProfileStore: () => { saved = JSON.parse(JSON.stringify(profile)); },
    ANCHOR_KEY: "interun_anchor_v1",
  };
  const names = Object.keys(env);
  new Function(...names, fnBody("anchorMigrate") + "\nanchorMigrate();")(...names.map((n) => env[n]));
  return { store, saved, profile };
}

test("BLOCKER: a plan from before the fix counts from today, ONCE — never from the start it was built with", () => {
  // ⚠️ THE JUMP THIS PREVENTS: a plan built five weeks ago has been doing week 1 every week. Honouring its stored
  // start would hand the runner week 6's load at once.
  const past = migrator({ startDateIso: addDays(TODAY, -35) });
  assert.equal(past.profile.startDateIso, TODAY, "an old plan was left to jump to the week its stored start implies");
  assert.equal(past.saved && past.saved.startDateIso, TODAY, "the move was not saved, so the next launch jumps anyway");
  assert.equal(past.store["interun_anchor_v1"], TODAY, "the move is not marked, so it would happen again next week");
  const blank = migrator({ startDateIso: "" });
  assert.equal(blank.profile.startDateIso, TODAY);
  // A pause (or a plan that has not begun) is already the right anchor.
  const future = migrator({ startDateIso: addDays(TODAY, 10) });
  assert.equal(future.profile.startDateIso, addDays(TODAY, 10), "a pause was cancelled by the move");
  assert.equal(future.store["interun_anchor_v1"], TODAY);
  // ONCE: with the mark, a start in the past is the block's real start and is never moved again.
  const marked = migrator({ startDateIso: addDays(TODAY, -21) }, { mark: addDays(TODAY, -21) });
  assert.equal(marked.profile.startDateIso, addDays(TODAY, -21), "a plan already counting was moved back to week 1");
  // A first run only sets the mark — so its own wizard start is never moved on a later launch.
  const first = migrator({ startDateIso: "" }, { firstRun: true });
  assert.equal(first.profile.startDateIso, "", "a first run's default profile was given a start");
  assert.equal(first.store["interun_anchor_v1"], TODAY);
  // ⚠️ AND IT RUNS BEFORE THE FIRST REBUILD, or the first launch has already built (and adopted) the jumped plan.
  // (The launch's rebuild is the one top-level line below; "recompute();" inside earlier FUNCTIONS runs later.)
  assert.ok(SRC.indexOf("\nanchorMigrate();\ntry { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); recompute(); }") > 0,
    "anchorMigrate does not run immediately before the launch's first recompute()");
});

test("BLOCKER: a profile edit keeps the plan's start; a new plan starts when asked", () => {
  const env = new Function(fnBody("formStartIso") + "\nreturn formStartIso;")();
  const old = addDays(TODAY, -28);
  // An edit: the field unchanged — or not on screen — keeps the block's own start, past included.
  assert.equal(env(old, false, old, TODAY), old, "saving the profile restarted the plan at week 1");
  assert.equal(env("", false, old, TODAY), old, "saving another topic restarted the plan at week 1");
  // An edit that CHANGES the date is a deliberate new start (never before today).
  assert.equal(env(addDays(TODAY, 3), false, old, TODAY), addDays(TODAY, 3));
  // The wizard is a new plan: the day picked, today by default — never the old plan's start.
  assert.equal(env(TODAY, true, old, TODAY), TODAY);
  assert.equal(env("", true, old, TODAY), TODAY, "a new plan inherited the old plan's start");
  assert.equal(env(addDays(TODAY, -2), true, old, TODAY), TODAY, "a stale draft date started a new plan in the past");
  assert.match(decomment(fnBody("draftFromForm")), /formStartIso\(wizFieldVal\("s_startdate"\), state\.screen === "wizard", profile\.startDateIso \|\| "", todayIso\(\)\)/);
  // No path writes a blank start for a real plan: a blank would mean "today" on every later launch.
  assert.ok(!/profile\.startDateIso = ""/.test(decomment(SRC)), "a path still clears the plan's start");
  assert.match(decomment(fnBody("resumeFromPause")), /profile\.startDateIso = todayIso\(\);/);
  assert.match(decomment(fnBody("reusePlan")), /profile\.startDateIso = todayIso\(\);/);
});

test("BLOCKER: what the launch reads is declared above the first rebuild — so the plan history records at launch", () => {
  // The launch's own line — the same text inside earlier FUNCTIONS is not the first rebuild, it runs later.
  const first = SRC.indexOf("try { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); recompute(); }");
  assert.ok(first > 0, "the launch's first recompute() line has changed shape — update this guard");
  // ADJ_QUALITY: holdBeforeStart reads it inside applyProfile, so a paused plan reads it at launch (test/pause-pickup).
  for (const name of ["ANCHOR_KEY", "PLAN_PROF_FIELDS", "FIRST_RUN", "ADJ_QUALITY"]) {
    const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
    assert.ok(at > 0 && at < first, name + " is declared below the first recompute(), so launch reads it in its dead zone");
  }
  // The history's signature is stable now that the block stays put: same block, same signature, every launch.
  const { api, clock } = builder();
  const sigOf = (out: any) => [out.plan.weeks[0].startIso, out.plan.weeks.length].join("|");
  clock.today = MONDAY; const a = sigOf(api.applyProfile(PROFILE(MONDAY)));
  clock.today = addDays(MONDAY, 15); const b = sigOf(api.applyProfile(PROFILE(MONDAY)));
  assert.equal(b, a, "the same plan reads as a new block a fortnight later, so the history grows a row a week");
});
