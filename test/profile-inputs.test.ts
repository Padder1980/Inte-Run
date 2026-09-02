// Guards for the profile's training questions — that each one reaches the plan, and that none of them
// carries an answer nobody gave.
//
// ⚠️ EVERY DEFECT THESE COVER SURVIVED A GREEN SUITE OF 1,369 TESTS, and they survived for one reason:
// nothing asserted that a question the runner is asked has any effect, or that a value the app stores
// was ever answered. This is the `weeklyVolumeKm: 30` lesson generalised — that field sat in
// DEFAULT_PROFILE from the first commit with no screen that ever asked for it, and every save copied
// it forward. Two more were doing the same thing: `age: 38` and `yearsRunning: 3`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { assessMasters } from "../src/athlete/masters.ts";
import { classifyRunner } from "../src/athlete/classification.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

let PAGE: string | null = null;
/** The built page. Read once — it is ~13 MB and cannot change while the suite runs. */
function page(): string {
  if (PAGE == null) PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return PAGE;
}
let APP: string | null = null;
/** The app's own script block, not the bundled engine (which is minified and has its own names). */
function appBlock(): string {
  if (APP != null) return APP;
  const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.reduce((a, b) => (b.length > a.length && b.includes("function applyProfile(") ? b : a), "");
  assert.ok(app, "the app's script block could not be found");
  APP = app;
  return app;
}
/** ⚠️ Anchored to the start of a line: `accept="image/*,video/*"` is an unbalanced opener mid-line. */
const nocomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

function fn(name: string): string {
  const src = appBlock();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not in the built page");
  const open = src.indexOf("{", at);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}" && --d === 0) return src.slice(at, i + 1);
  }
  assert.fail(name + " is unbalanced");
  return "";
}

// ---------------------------------------------------------------------------------------------
// Age — the phantom that reached a heart rate
// ---------------------------------------------------------------------------------------------

test("BLOCKER: no stored profile carries an age nobody gave", () => {
  // ⚠️ THIS ONE REACHED FURTHER THAN A PLAN. `maxHrEstimate()` falls back to Tanaka's 208 - 0.7 x age
  // and its own comment says "Zero means no ceiling known; callers must treat that as do not judge,
  // never as a number" — so a default defeats a function deliberately built to refuse to guess. With
  // the old `age: 38`, measured: a 65-year-old was handed a ceiling 19 bpm too high, so the coach's
  // 92%-of-max safety cue fired at 167 bpm instead of 149, and a 20-year-old's fired 11 bpm early.
  // That same ceiling colours the watch's zones and the Training zones table.
  const decl = nocomment(appBlock());
  const m = decl.match(/const DEFAULT_PROFILE = \{[^}]*\}/);
  assert.ok(m, "DEFAULT_PROFILE could not be found");
  assert.ok(!/\bage:/.test(m[0]),
    "DEFAULT_PROFILE carries an age. Absent must mean unanswered: " + m[0].slice(0, 200));
  assert.ok(!/\byearsRunning:/.test(m[0]),
    "DEFAULT_PROFILE carries yearsRunning, which no screen has ever asked for");
});

test("BLOCKER: the age question offers a way to not answer it", () => {
  // A select with no empty option and a pre-selected default cannot express "unanswered" at all.
  const src = fn("ageOpts");
  assert.ok(/value=""/.test(src), "ageOpts has no empty option, so age can never be unanswered");
  assert.ok(/Prefer not to say/.test(src),
    "the empty option needs the same words the sex question already uses");
  // And no code path may invent one behind the runner's back.
  const app = nocomment(appBlock());
  const invented = [...app.matchAll(/s_age"\)[^;]{0,40}\|\|\s*(\d+)/g)].map((x) => x[1]);
  for (const v of invented)
    assert.equal(v, "0", `a fallback age of ${v} is an answer nobody gave — 0 means unanswered`);
});

test("BLOCKER: assessMasters answers 'unknown' rather than the oldest band", () => {
  // ⚠️ `bandOf` compared against three thresholds and returned "60-plus" for anything that failed all
  // three, so an absent age gave `ageBand: "60-plus"` with `isMasters: false` — a pair that cannot
  // both be true, and the OLDEST band for the runner we know least about.
  // ⚠️ SEX IS PASSED, AND WITHOUT IT THIS GUARD COULD NOT SEE HALF OF WHAT IT ASSERTS. The female-health
  // suggestion is `sex === "female" && age >= 45`, so a fixture with no sex fails the first half of that
  // conjunction whatever the age does — measured: replacing the age check with `(input.age ?? 45) >= 45`,
  // which suggests a menopause screen to a runner who gave no age at all, ESCAPED the first version of
  // this test entirely. A fixture that cannot reach the branch it is pointed at proves nothing about it.
  for (const age of [undefined, 0, 5, 9, 101, 200, NaN])
    for (const sex of ["female", "male", undefined] as const) {
    const m = assessMasters({ age: age as number | undefined, sex });
    assert.equal(m.ageBand, "unknown", `age ${age} / ${sex} gave band ${m.ageBand}`);
    assert.equal(m.isMasters, false, `age ${age} / ${sex} was called a masters athlete`);
    assert.equal(m.suggestFemaleHealth, false, `age ${age} / ${sex} suggested the female-health screen`);
    assert.equal(m.minEasyDaysBetweenQuality, 1, `age ${age} / ${sex} widened the spacing on an unknown age`);
    // It still gives the advice that is true at every age, rather than nothing.
    assert.ok(m.points.length >= 2, `age ${age} / ${sex} returned no guidance at all`);
    assert.ok(/add your age/i.test(m.headline), `age ${age} / ${sex} does not say what is missing: "${m.headline}"`);
  }
  // The real bands still work, and the boundary is where it was.
  assert.equal(assessMasters({ age: 34 }).ageBand, "under-35");
  assert.equal(assessMasters({ age: 35 }).ageBand, "35-49");
  assert.equal(assessMasters({ age: 50 }).ageBand, "50-59");
  assert.equal(assessMasters({ age: 60 }).ageBand, "60-plus");
  assert.equal(assessMasters({ age: 10 }).ageBand, "under-35", "10 is a real age and must not read as unknown");
});

// ---------------------------------------------------------------------------------------------
// Training years — derived from what the runner said, not stored
// ---------------------------------------------------------------------------------------------

test("BLOCKER: training years are derived from the status card, and clear the gates it implies", () => {
  // ⚠️ `yearsRunning` was never asked and always 3. It cannot reach generatePlan at all (Athlete has
  // no such field), so a plan is byte-identical for 0 years and 25 — but classifyRunner's label IS
  // rendered, so the number was invisible in the plan and visible on the screen.
  const app = nocomment(appBlock());
  assert.ok(/function trainingYearsFor\(/.test(app), "the derivation is gone");
  assert.ok(!/yearsRunning: profile\.yearsRunning/.test(app) && !/yearsRunning: pf\.yearsRunning/.test(app),
    "a stored yearsRunning is being read again");
  const calls = (app.match(/yearsRunning: trainingYearsFor\(/g) ?? []).length;
  assert.ok(calls >= 2, `only ${calls} call sites derive the years; every classifyRunner call must`);
  const noDerive = [...app.matchAll(/classifyRunner\(\{[^}]*\}/g)]
    .filter((m) => !/trainingYearsFor\(/.test(m[0]));
  assert.equal(noDerive.length, 0,
    "a classifyRunner call does not derive its years: " + (noDerive[0]?.[0] ?? "").slice(0, 140));

  // The derivation must land on the right side of classifyRunner's own two gates (yrs >= 1 for
  // tier 3, yrs >= 3 for tier 4), or it is a number with no meaning.
  const src = fn("trainingYearsFor");
  const yearsFor = new Function("status", src + "; return trainingYearsFor(status);") as (s: string) => number;
  assert.ok(yearsFor("new") < 1, "a runner new to running must not clear the one-year gate");
  assert.ok(yearsFor("building") >= 1 && yearsFor("building") < 3,
    "a habit-builder should clear one year and not three");
  assert.ok(yearsFor("regular") >= 3, "a regular runner should clear the three-year gate");
  assert.ok(yearsFor("competitive") >= 3, "a competitive runner should clear the three-year gate");
});

// ---------------------------------------------------------------------------------------------
// The runner-type panel must not contradict the card the runner just answered
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the runner type never exceeds the status the runner chose", () => {
  // ⚠️ classifyRunner starts everybody who runs at all at tier 2, so a runner who had just chosen
  // "Just getting started" was shown "Recreational runner" on a panel headed "Your runner type".
  const CEIL: Record<string, number> = { new: 1, building: 2, regular: 3, competitive: 4 };
  for (const [status, cap] of Object.entries(CEIL))
    for (const runsPerWeek of [0, 1, 3, 4, 6, 7])
      for (const weeklyVolumeKm of [0, 20, 45, 80, 140])
        for (const recent5kSeconds of [900, 1200, 1800, 2400]) {
          const c = classifyRunner({
            runsPerWeek,
            yearsRunning: status === "new" ? 0 : status === "building" ? 1 : 3,
            weeklyVolumeKm: weeklyVolumeKm || undefined,
            recent5kSeconds,
            maxTier: cap as 1 | 2 | 3 | 4,
          });
          assert.ok(c.tier <= cap,
            `a "${status}" runner on ${runsPerWeek} days / ${weeklyVolumeKm} km / ${recent5kSeconds}s was called tier ${c.tier} (${c.label})`);
        }
  // ⚠️ AND THE CEILING IS APPLIED AFTER THE PERFORMANCE REFINEMENT, or a fast time lifts the runner
  // straight back past their own stated band. A 15:00 5 km would otherwise reach tier 4.
  const fast = classifyRunner({ runsPerWeek: 6, yearsRunning: 3, weeklyVolumeKm: 100, recent5kSeconds: 900, maxTier: 2 });
  assert.equal(fast.tier, 2, "a fast time overrode the stated status");
});

test("BLOCKER: the preview panel is fed the same inputs as the real classification", () => {
  // ⚠️ It saw three of the five fields and disagreed with the real answer in 3 of 8 realistic cases,
  // in BOTH directions: a competitive runner on 6 days and 80 km was called a "Trained runner" where
  // the real answer is "Highly trained", and a regular runner on 4 days and 20 km was called
  // "Trained" where the real answer is "Recreational". A panel that contradicts the form is worse
  // than no panel.
  const preview = nocomment(fn("refreshTypePreview"));
  for (const field of ["weeklyVolumeKm", "recent5kSeconds", "maxTier", "yearsRunning", "runsPerWeek"])
    assert.ok(preview.includes(field),
      `the preview does not pass ${field}, so it can disagree with the plan's own classification`);
  // Both callers must use one ceiling helper, or the two can drift apart.
  const app = nocomment(appBlock());
  const capCalls = (app.match(/maxTier: typeCeilingFor\(/g) ?? []).length;
  assert.ok(capCalls >= 2, `only ${capCalls} sites use the shared ceiling; both classifyRunner calls must`);
});

// ---------------------------------------------------------------------------------------------
// The status cards must route a returning runner to a track that acts on it
// ---------------------------------------------------------------------------------------------

test("BLOCKER: the beginner card does not invite a runner coming back from a break", () => {
  // ⚠️ A MISROUTE, NOT A WORDING PREFERENCE. The card read "New to running, or coming back after a
  // long break", pointing a detrained veteran at the run-walk track — where the dedicated "Coming
  // back to running?" question they answer two sections later changes NOTHING: measured,
  // returningFromBreak and returningFromInjury give a byte-identical session list for a beginner
  // (0 of 140 sessions differ) against 158 of 170 on the recreational track. So the one card that
  // named their situation sent them to the one track that ignores it.
  const app = appBlock();
  const opts = app.slice(app.indexOf("const STATUS_OPTS"), app.indexOf("];", app.indexOf("const STATUS_OPTS")));
  const newCard = opts.split("\n").find((l) => l.includes('"new"'));
  assert.ok(newCard, "the 'new' status card could not be found");
  assert.ok(!/coming back/i.test(newCard!),
    "the beginner card invites a returning runner onto a track that ignores the returning answer: " + newCard);
  // The dedicated question must still exist, since it is where that runner is meant to go.
  assert.ok(/After time off/.test(app) && /After an injury/.test(app),
    "the returning question has lost one of its answers");
});

test("the beginner track really does ignore the returning answer — so the misroute matters", () => {
  // The measurement behind the guard above, asserted rather than trusted. If the beginner track ever
  // starts acting on the returning flags this becomes a false premise, and it should fail here.
  const base: Athlete = {
    daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "beginner", includeStrength: true, runWalk: true, longRunDay: 6,
  };
  const goal: Goal = { distance: "10k", targetTimeSeconds: 3300, raceDateIso: "2027-01-31", startDateIso: "2026-09-07" };
  const titles = (a: Athlete) => generatePlan(a, goal, { startDateIso: "2026-09-07" })
    .weeks.flatMap((w) => w.sessions.map((s) => s.type + "|" + s.title)).join("\n");
  const plain = titles(base);
  const off = titles({ ...base, returningFromBreak: true });
  const hurt = titles({ ...base, returningFromInjury: true });
  assert.equal(off, plain, "the beginner track now reacts to a break — update the misroute guard's premise");
  assert.equal(hurt, plain, "the beginner track now reacts to an injury — update the misroute guard's premise");
});

// ---------------------------------------------------------------------------------------------
// A stated mileage the plan cannot honour must be said out loud, in BOTH directions
// ---------------------------------------------------------------------------------------------

test("BLOCKER: a plan that opens above the stated mileage says so", () => {
  // ⚠️ THE EXISTING CHECK WAS ONE-SIDED. It fires when the plan cannot REACH a stated mileage and
  // said nothing when it overshot one — and at the bottom of the range the per-session floors bind,
  // so a low answer stops moving the plan and then stops being reflected in it. Measured on a half
  // marathon, 5 days, 17 weeks: week one is the SAME 27.8 km whether the runner says 15, 20 or 25,
  // so somebody who said 15 was handed nearly double it in their opening week with no note at all.
  const start = "2026-09-07";
  const race = (() => { const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 17 * 7 - 1); return d.toISOString().slice(0, 10); })();
  const mk = (volKm: number) => generatePlan(
    { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1200 }, experience: "recreational",
      includeStrength: true, longRunDay: 6, weeklyVolumeKmCurrent: volKm },
    { distance: "half", targetTimeSeconds: 5100, raceDateIso: race, startDateIso: start },
    { startDateIso: start });

  const low = mk(15);
  const opening = (low.weeks.find((w) => !w.isDeload)?.plannedDistanceMeters ?? 0) / 1000;
  assert.ok(opening > 15 * 1.15, `the fixture no longer overshoots (opens at ${opening.toFixed(1)} km on 15 stated) — pick a lower figure`);
  const note = (low.notes ?? []).find((n) => /this block opens at/.test(n));
  assert.ok(note, "a plan opening at " + opening.toFixed(1) + " km on a stated 15 km says nothing about it");
  assert.ok(/15 km a week/.test(note!), "the note does not quote what the runner actually said");

  // ⚠️ AND IT MUST NOT FIRE WHERE THE PLAN HONOURS THE ANSWER, or it becomes wallpaper.
  for (const v of [30, 45, 60]) {
    const n = (mk(v).notes ?? []).find((x) => /this block opens at/.test(x));
    assert.equal(n, undefined, `a stated ${v} km triggers the overshoot note when the plan honours it`);
  }
  // ⚠️ KEYED ON WEEK ONE, NOT THE PEAK. A peak above the stated figure is what a block IS.
  const src = readFileSync(new URL("../src/plan/generate-plan.ts", import.meta.url), "utf8");
  const branch = src.slice(src.indexOf("AND SAY SO WHEN THE PLAN GIVES MORE"), src.indexOf("const leadIn = totalWeeks"));
  assert.ok(/firstFull/.test(branch) && !/deliveredPeak/.test(branch),
    "the overshoot branch reads the peak rather than the opening week");
});

test("BLOCKER: the overshoot note is one the app actually shows", () => {
  // ⚠️ ADDING THE NOTE UPSTREAM ACHIEVES NOTHING ON ITS OWN. The app renders only the notes its own
  // regex names, so a branch the regex misses is generated and discarded — the trap this whole file is
  // about.
  // ⚠️ RESTATED 2026-09-02, NOT DELETED. This guard pinned `.find` and failed when the recovery-week
  // work changed it to `.filter` (both notes can fire for one runner, and `.find` silently dropped the
  // second). The invariant — a note the engine writes must be one the app actually shows, and the
  // design notes must stay off it — never changed, so the claim is now written against WHICHEVER
  // collector is in use rather than against one spelling of it. Guard the fact, not the mechanism.
  const app = nocomment(appBlock());
  const m = app.match(/const volNotes? = \(PLAN\.notes \|\| \[\]\)\.(?:find|filter)\(\(n\) =>\s*(\/[^/]+\/)\.test\(n\)\)/);
  assert.ok(m, "the note filter could not be found");
  const re = new RegExp(m[1]!.slice(1, -1));
  assert.ok(re.test("You told us you run about 15 km a week, and this block opens at 28 km."),
    "the filter does not match the overshoot note, so the runner never sees it: " + m[1]);
  assert.ok(re.test("Adding a day would carry more of it"), "the filter no longer matches the under-delivery note");
  // ⚠️ And it must not match a note about the plan's own design — those belong in Support.
  assert.ok(!re.test("Intensity distribution: pyramidal — mostly easy running"),
    "the filter now catches the design notes, which the header deliberately keeps off it");
});

// ---------------------------------------------------------------------------------------------
// One answer to "which of the four cards is this runner"
// ---------------------------------------------------------------------------------------------

test("BLOCKER: every reader of the status card resolves it through one function", () => {
  // ⚠️ A STORED PROFILE IS USED AS-IS WITH NO MERGE, so `status` is undefined for any profile saved
  // before the status question existed — and four things fell back independently. `expByStatus` falls
  // back on the noRecent flag and answers "beginner"; `warmupAbility` fell back to "intermediate" with
  // no equivalent test. So a legacy runner the engine builds a BEGINNER plan for was handed an
  // INTERMEDIATE warm-up, and the two derived helpers would have given the same runner three years of
  // training and a tier-3 ceiling. One resolver, four readers.
  const app = nocomment(appBlock());
  assert.ok(/function resolvedStatus\(pf\)/.test(app), "the resolver is gone");
  for (const [what, call] of [
    ["the experience mapping", "return map[resolvedStatus(pf)];"],
    ["the warm-up band", "const st = resolvedStatus(profile);"],
    ["the derived training years", "trainingYearsFor(resolvedStatus(pf))"],
    ["the type ceiling", "typeCeilingFor(resolvedStatus(pf))"],
  ] as Array<[string, string]>)
    assert.ok(app.includes(call), `${what} does not go through the resolver`);
  // ⚠️ AND NOTHING MAY READ THE RAW FIELD FOR THESE FOUR DECISIONS AGAIN.
  assert.ok(!/expByStatus\[pf\.status\]/.test(app), "the experience mapping reads the raw status again");
  assert.ok(!/const st = profile\.status;/.test(app), "something reads the raw status again");
  // ⚠️ AND THERE MUST BE EXACTLY ONE STATUS-TO-EXPERIENCE MAPPING. There were two: the second was
  // hand-inlined in the add-a-day evidence builder with no legacy fallback, so a profile built as a
  // BEGINNER was judged as RECREATIONAL by the offer — and `addDayOffer` opens by returning null for a
  // beginner, so that runner was offered an extra day the gate exists to withhold.
  assert.ok(/function experienceFor\(pf\)/.test(app), "the experience mapping is gone");
  const inlined = [...app.matchAll(/=== "new" \|\| \w+ === "building"\) \? "beginner"/g)].length;
  assert.equal(inlined, 0, "the status-to-experience mapping is inlined somewhere again");
  assert.equal([...app.matchAll(/regular: "recreational", competitive: "competitive"/g)].length, 1,
    "there is more than one status-to-experience table");
  for (const call of ["experience = experienceFor(pf)", "experience: experienceFor(profile)"])
    assert.ok(app.includes(call), `a reader does not use the shared mapping: ${call}`);

  // The fallback must preserve `experience` exactly — it is chosen for that, not for tidiness.
  const src = fn("resolvedStatus");
  const resolve = new Function("pf", src + "; return resolvedStatus(pf);") as (pf: unknown) => string;
  const exp: Record<string, string> = { new: "beginner", building: "beginner", regular: "recreational", competitive: "competitive" };
  for (const pf of [{ status: "new" }, { status: "building" }, { status: "regular" }, { status: "competitive" },
                    { noRecent: true }, { noRecent: false }, {}, { status: "bogus", noRecent: true }]) {
    const before = exp[(pf as { status?: string }).status ?? ""] ?? ((pf as { noRecent?: boolean }).noRecent ? "beginner" : "recreational");
    assert.equal(exp[resolve(pf)], before,
      `resolving ${JSON.stringify(pf)} changes the experience the plan is built from`);
  }
  // ⚠️ AND NEVER "new", because that is the run-walk track — resolving a legacy runner onto it would
  // change every session in their plan.
  assert.notEqual(resolve({ noRecent: true }), "new", "a legacy profile resolves onto the run-walk track");
  assert.notEqual(resolve({}), "new", "a profile with no answers at all resolves onto the run-walk track");
});

test("BLOCKER: the derived training years are not written back into the profile", () => {
  // ⚠️ THE PHANTOM IN A NEW COSTUME. `draftFromForm` stored `yearsRunning: trainingYearsFor(...)` and
  // nothing read it — so the profile carried a derived number that goes stale the moment the status
  // changes without a save, which is the same shape of trap as the original phantom, one indirection on.
  const app = nocomment(appBlock());
  const stores = [...app.matchAll(/yearsRunning:/g)].length;
  const derives = [...app.matchAll(/yearsRunning: trainingYearsFor\(/g)].length;
  assert.equal(stores, derives, "a yearsRunning is being assigned somewhere it is not derived for a call");
  assert.ok(!/daysPerWeek: Number\(draft\.days\), yearsRunning:/.test(app),
    "draftFromForm stores a derived yearsRunning back into the profile");
});

test("BLOCKER: the panel says that self-assessment is capped", () => {
  // ⚠️ `classifyRunner` returns a `note` for tier 4 saying the top tiers are defined by international
  // competitive standard and are therefore capped — and CLAUDE.md says this panel is where the app was
  // supposed to SAY so. It rendered `label` and `meaning` and dropped the note entirely, so the one
  // sentence the panel exists to carry could never appear. And it was UNREACHABLE besides: with the
  // preview's old inputs the tier was days alone and topped out at 3.
  const preview = nocomment(fn("refreshTypePreview"));
  assert.ok(/cls\.note/.test(preview), "the panel drops the cap note");
  const cls = classifyRunner({ runsPerWeek: 6, yearsRunning: 3, weeklyVolumeKm: 100, recent5kSeconds: 900, maxTier: 4 });
  assert.equal(cls.tier, 4, "tier 4 is unreachable, so the note can never render");
  assert.ok(cls.note && /cap self-assessment/.test(cls.note), "the note no longer says what it is for");
  // And it must not appear for anybody else, or it reads as a limit on them.
  assert.equal(classifyRunner({ runsPerWeek: 4, yearsRunning: 3, recent5kSeconds: 1500, maxTier: 3 }).note, undefined,
    "the cap note shows to a runner who is not at the cap");
});
