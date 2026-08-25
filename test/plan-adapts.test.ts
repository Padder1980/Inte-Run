/**
 * THE PLAN ANSWERS THE PROFILE (owner, 2026-08-25, from two annotated screenshots).
 *
 * "When editing the questions in my profile, I don't think the app uses the information well enough to
 * adapt the plan for the needs of the runner. I did an experiment where drastically changed the profile
 * and it didn't affect the types of run too much" / "I also set my preference to Sunday long run and it
 * didn't deliever" / "I think 'building the habit' runner needs to have the option to set a time goal if
 * they choose to, they can also just leave it off".
 *
 * Measured first, and the engine turned out to be innocent on both counts: it honours the chosen
 * long-run day at every experience level and every weekday, never puts two runs on one day, and gives
 * six distinct session mixes across seven very different profiles. What flattened his experiment was one
 * line in the WEB layer, and what moved his long run was a stale reschedule.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

const PAGE = fs.readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/** ⚠️ COMMENTS STRIPPED. Every claim below quotes the code it forbids, which is the trap this
 *  codebase has now recorded a dozen times. */
const nocomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function fn(name: string): string {
  const at = PAGE.indexOf("\nfunction " + name + "(");
  assert.ok(at > 0, name + " is not in the built page");
  const open = PAGE.indexOf("{", at);
  let d = 0;
  for (let i = open; i < PAGE.length; i++) {
    if (PAGE[i] === "{") d++;
    else if (PAGE[i] === "}" && --d === 0) return PAGE.slice(at, i + 1);
  }
  assert.fail(name + " never closes");
  return "";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RUN = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const goal: Goal = { distance: "half", raceDateIso: "2026-12-06", targetTimeSeconds: 6300 } as Goal;
const mk = (over: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1500 },
  experience: "recreational", includeStrength: true, longRunDay: 6, ...over } as Athlete);

test("BLOCKER: the runner's stated status decides the track — nothing promotes it behind their back", () => {
  // ⚠️⚠️ THE LINE THAT CAUSED HIS REPORT:
  //   if (pf.status === "building" && !pf.noRecent && pf.recentTimeS < 1980) experience = "recreational";
  // Its own comment justified it by "a runner who calibrated a genuinely capable easy pace" while the
  // test was on recentTimeS — a 5 km TIME that ships at 1500 in DEFAULT_PROFILE and is copied forward by
  // every save. So it fired for anyone who had never entered a time, which is the opposite of
  // calibrated, and "Building the habit" essentially could not reach the habit track.
  const ap = nocomment(fn("applyProfile"));
  const assigns = [...ap.matchAll(/\bexperience\s*=\s*/g)].length;
  assert.equal(assigns, 1,
    "experience is assigned " + assigns + " times in applyProfile; the status is no longer the only " +
    "thing that decides the track");
  assert.match(ap, /expByStatus\[pf\.status\]/, "the track is no longer keyed on the stated status");
  // Nothing may reconsider the track from a race time — the specific overreach, and any relative of it.
  const after = ap.slice(ap.indexOf("expByStatus[pf.status]"));
  for (const src of ["recentTimeS", "twoKmS", "easyPaceS"]) {
    assert.ok(!new RegExp("experience\\s*=[^;]*" + src).test(after),
      "the track is being reconsidered from " + src + ", which is a number the runner may never have given");
  }
  // ⚠️ AND THE TWO TRACKS ARE NOT A SHADE APART, which is why the promotion mattered so much: measured
  // on his own answers it was 27.5 km with a 3 x 8' threshold session against 15.1 km of easy plus a
  // long run. Asserted from the engine so the claim cannot go stale.
  let differ = 0;
  for (const days of [3, 4, 5, 6]) {
    for (const dist of ["5k", "10k", "half", "marathon"] as const) {
      const g = { ...goal, distance: dist } as Goal;
      const key = (exp: any) => generatePlan(mk({ experience: exp, daysPerWeek: days }), g, {})
        .weeks.map((w: any) => w.sessions.filter((s: any) => RUN.has(s.type))
          .map((s: any) => s.type).sort().join("+")).join("|");
      if (key("beginner") !== key("recreational")) differ++;
    }
  }
  assert.equal(differ, 16,
    "the beginner and recreational tracks differ in only " + differ + " of 16 goal/day combinations, so " +
    "the status barely decides anything");
});

test("BLOCKER: the engine honours the chosen long-run day, and never doubles a day", () => {
  // The measurement that cleared the engine: his long run was on Wednesday because of a stale
  // reschedule, not because the generator ignored him.
  for (const exp of ["beginner", "recreational", "competitive"] as const) {
    for (let d = 0; d < 7; d++) {
      const wk: any = generatePlan(mk({ experience: exp, longRunDay: d }), goal, {}).weeks[1];
      const longs = wk.sessions.filter((s: any) => s.type === "long");
      assert.ok(longs.length <= 1, exp + " built " + longs.length + " long runs in one week");
      if (longs.length) {
        assert.equal(longs[0].dayOfWeek, d,
          exp + " asked for " + DAYS[d] + " and got " + DAYS[longs[0].dayOfWeek]);
      }
      const by = new Map<number, number>();
      wk.sessions.filter((s: any) => RUN.has(s.type))
        .forEach((s: any) => by.set(s.dayOfWeek, (by.get(s.dayOfWeek) || 0) + 1));
      const doubled = [...by.entries()].filter(([, n]) => n > 1);
      assert.equal(doubled.length, 0,
        exp + " with " + DAYS[d] + " long put two runs on " + doubled.map(([k]) => DAYS[k]).join(","));
    }
  }
});

test("BLOCKER: a reschedule is perishable — it survives a rebuild and dies when the layout moves", () => {
  // ⚠️ AN OVERRIDE IS AN ANSWER ABOUT ONE ARRANGEMENT OF THE WEEK. seedDone's own comment said "a
  // same-shape rebuild keeps them", which is right — and nothing checked whether the shape was still
  // the same, so changing the long-run day left the old drag dragging the long run back.
  const lift = new Function("state",
    nocomment(fn("ovTo")) + "\n" + nocomment(fn("ovFrom")) + "\n" + nocomment(fn("genDay")) + "\n" +
    nocomment(fn("effDay")) + "\nreturn { effDay, ovTo, ovFrom, genDay };");
  const st: any = { dayOverride: {} };
  const api = lift(st);
  const sess = { id: "w2-d6-long", dayOfWeek: 6 };
  assert.equal(api.effDay(sess), 6, "with no override the generated day is used");
  // ⚠️ BOTH SHAPES. A bare number is an override written before the from-field existed and is what is
  // actually sitting in every existing install — reading it as an object gives NaN and every session
  // lands on day undefined.
  st.dayOverride[sess.id] = 2;
  assert.equal(api.effDay(sess), 2, "a legacy numeric override is not honoured");
  assert.equal(api.ovFrom(st.dayOverride[sess.id]), null, "a legacy override claims to know where it came from");
  st.dayOverride[sess.id] = { to: 2, from: 6 };
  assert.equal(api.effDay(sess), 2, "an override with a from-field is not honoured");
  assert.equal(api.ovFrom(st.dayOverride[sess.id]), 6, "the from-field is not read back");
  // moveSession must record it, or staleness can never be detected.
  const mv = nocomment(fn("moveSession"));
  assert.match(mv, /state\.dayOverride\[sess\.id\] = \{ to: target, from: genDay\(sess\) \}/,
    "a reschedule no longer records the day the plan had put the session on");
  assert.match(mv, /state\.dayOverride\[occ\.id\] = \{ to: cur, from: genDay\(occ\) \}/,
    "the session displaced by a swap does not record where it came from, so its override never expires");
  // And seedDone drops the stale ones, then resolves any collision the plan has created.
  const seed = nocomment(fn("seedDone"));
  assert.match(seed, /ovFrom\(state\.dayOverride\[s\.id\]\)[\s\S]{0,140}?genDay\(s\)/,
    "nothing compares a reschedule against the day the plan now puts that session on");
  assert.match(seed, /delete state\.dayOverride\[s\.id\]/, "a stale reschedule is never dropped");
  // ⚠️ THE COLLISION BELT IS SEPARATE AND IT IS WHAT CATCHES A LEGACY OVERRIDE, where staleness cannot
  // be detected at all. Reproduced in a browser: an easy run and the long run both on one day, which
  // is exactly the screenshot he sent.
  assert.match(seed, /PRIMARY_TYPES\[s\.type\][\s\S]{0,400}?effDay\(s\)/,
    "nothing checks whether two runs have ended up on the same day after a rebuild");
  assert.match(seed, /const drop = state\.dayOverride\[s\.id\] != null \? s\.id : other/,
    "the collision is resolved against the plan's own day rather than by dropping a reschedule");
});

test("BLOCKER: a habit-builder may set a time goal or leave it off, and blank is not shown back", () => {
  // His screenshot: "I think 'building the habit' runner needs to have the option to set a time goal if
  // they choose to, they can also just leave it off".
  const card = new Function(
    "const RACE_LABEL = { '10k': '10 km' }, FINISH_LABEL = { '10k': 'Complete a 10K' };\n" +
    (/const GOAL_BY_STATUS = \{[\s\S]*?\n\};/.exec(PAGE) || [""])[0] + "\n" +
    nocomment(fn("goalCardInner")) + "\nreturn goalCardInner;")();
  const at = (st: string) => card(st, { dist: "10k", date: "2026-12-06", target: "" });
  // The habit-builder is asked, and told that blank is a real answer.
  const b = at("building");
  assert.match(b, /id="s_target"/, "a habit-builder still cannot set a time goal");
  assert.match(b, /OPTIONAL/, "the time goal is offered without saying it is optional");
  assert.match(b, /leave this blank/, "nothing says what leaving it blank does");
  // ⚠️ AND THE FRAMING STAYS ABOUT FINISHING. cfg.time is three-valued now, so every reader must test
  // === true — read as truthy, a habit-builder's dropdown flips to race language and the date becomes a
  // "Race date", which is the pressure the old copy existed to remove.
  assert.match(b, /Complete a 10K/, "the habit-builder's distance now reads as a race");
  assert.match(b, /<label>Target date</, "the habit-builder is now asked for a race date");
  // The walk-run beginner is deliberately untouched — he named the habit-builder.
  const n = at("new");
  assert.ok(n.indexOf('id="s_target"') < 0, "a walk-run beginner is now asked for a finishing time");
  // And a racer is unchanged.
  for (const st of ["regular", "competitive"]) {
    const h = at(st);
    assert.match(h, /id="s_target"/, st + " lost its target time");
    assert.ok(h.indexOf("OPTIONAL") < 0, st + "'s target time has become optional");
    assert.match(h, /<label>Race date</, st + " no longer asks for a race date");
  }
  // ⚠️ A DERIVED TARGET IS NOT SHOWN BACK AS A GOAL. The engine always has one — it is required — so the
  // number alone cannot answer whether the runner chose it, and printing a Riegel projection back to a
  // habit-builder as "your goal" is the pressure this is all about.
  const chosen = new Function((/const GOAL_BY_STATUS = \{[\s\S]*?\n\};/.exec(PAGE) || [""])[0] + "\n" +
    nocomment(fn("targetChosen")) + "\nreturn targetChosen;")();
  assert.equal(chosen({ status: "building", targetSet: false }), false, "a blank time is shown back as a goal");
  assert.equal(chosen({ status: "building", targetSet: true }), true, "a time they typed is not shown");
  // ⚠️ AND MISSING MEANS "WHATEVER THE STATUS ASKS FOR", so no stored profile needs migrating.
  assert.equal(chosen({ status: "regular" }), true, "an existing racer's chosen time stopped showing");
  assert.equal(chosen({ status: "new" }), false, "an existing beginner's derived time started showing");
  // Reading the draft: required for a racer, blank accepted for a habit-builder, a typo still refused.
  // ⚠️ THE FUNCTION IS draftFromForm. CLAUDE.md calls it buildProfileFromDraft in two places and no
  // such function has ever existed — an invented identifier in the docs, which cost a pass here.
  const build = nocomment(fn("draftFromForm"));
  assert.match(build, /goalCfg\.time === "optional" && !targetRaw/,
    "a blank optional time is not handled, so a habit-builder is told to enter one");
  assert.match(build, /targetSet = false/, "a blank time is not recorded as unchosen");
  assert.match(build, /if \(!mmss\(targetRaw\)\) throw/, "a typo'd time is silently accepted");
});
