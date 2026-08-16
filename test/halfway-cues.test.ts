import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_PROMPTS, COACH_IDS, promptTextFor } from "../src/live/coach-prompts.ts";

/**
 * HALFWAY, AND HALFWAY THROUGH THIS SECTION. Owner, 2026-08-16 — two requests in one:
 *
 *   "letting the runner know that theyre halfway through their session (this would be based on
 *    distance if its a session measured by distance or time if its a session driven by minutes)"
 *   "a prompt that lets them know theyre halfway through that section/lap"
 *
 * ...plus "turn on the three moments that aren't firing" (threshold-hold, interval-work,
 * strength-start), which had lines written and audio recorded for all nine coaches and were never
 * played by anything.
 */

const PAGE = new URL("../web/app.html", import.meta.url);

function lift(names: string[]): string {
  const html = readFileSync(PAGE, "utf8");
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

/** Run one live tick sequence against the page's real cue logic and collect what it fired. */
function harness(session: any) {
  const fired: { trigger: string; at: number }[] = [];
  const env: Record<string, any> = {
    LIVE: { session, started: true, done: false, mode: "gps" },
    COACH: {
      cfg: { enabled: true, coach: "guide", volume: 1, frequency: "normal" },
      halfwayDone: false, sectionHalfKey: "", lastHalfwayAt: -999,
    },
    coachTrigger: (trigger: string, _t: string, at: number) => fired.push({ trigger, at }),
    stepSecs: (st: any) => st.durationSeconds
      ? st.durationSeconds
      : (st.distanceMeters && st.targetPaceSecPerKm)
        ? Math.round(st.distanceMeters / 1000 * (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2)
        : 0,
    Math, String, Number, Boolean,
  };
  const src = lift(["sessionDistanceDriven", "sessionHalfwayReached", "coachSectionHalfwayTrigger", "coachSectionTick"]);
  const keys = Object.keys(env);
  const api = new Function(...keys,
    src + "; return { sessionDistanceDriven, sessionHalfwayReached, coachSectionHalfwayTrigger, coachSectionTick };"
  )(...keys.map((k) => env[k]));
  return { api, fired, COACH: env.COACH };
}

const pace = { minSecPerKm: 330, maxSecPerKm: 370 };

// ---- feature 1: halfway through the session ----------------------------------------------------

test("a run dialled in kilometres is judged in kilometres", () => {
  // ⚠️ THE CASE THAT PROMPTED THIS. The owner asked for a 1 km custom run and walked it. On the
  // clock he would have been told he was halfway well before he reached 500 m, because the session's
  // planned duration assumes he is running. The distance is the thing he asked for; measure that.
  const session = {
    estimatedDurationSeconds: 350, estimatedDistanceMeters: 1000,
    steps: [{ kind: "steady", distanceMeters: 1000, targetPaceSecPerKm: pace }],
  };
  const h = harness(session);
  assert.equal(h.api.sessionDistanceDriven(session), true);
  // Walking: well past half the planned time, nowhere near half the distance.
  assert.equal(h.api.sessionHalfwayReached({ elapsedSeconds: 300, distanceMeters: 420 }), false,
    "called halfway on the clock while the runner was 80 m short of it on the ground");
  assert.equal(h.api.sessionHalfwayReached({ elapsedSeconds: 300, distanceMeters: 500 }), true);
});

test("a run dialled in minutes is still judged on the clock", () => {
  const session = {
    estimatedDurationSeconds: 2400, estimatedDistanceMeters: 6800,
    steps: [{ kind: "steady", durationSeconds: 2400, targetPaceSecPerKm: pace }],
  };
  const h = harness(session);
  assert.equal(h.api.sessionDistanceDriven(session), false);
  // Running slowly: past half the time, short of half the distance. The clock is what was asked for.
  assert.equal(h.api.sessionHalfwayReached({ elapsedSeconds: 1200, distanceMeters: 2900 }), true);
  assert.equal(h.api.sessionHalfwayReached({ elapsedSeconds: 900, distanceMeters: 3500 }), false);
});

test("the longest step decides, which is what makes the mixed cases come out right", () => {
  // ⚠️ NEITHER "ALL OF THEM" NOR "ANY OF THEM" WORKS, and both were considered. A six-kilometre run
  // with a strides block is not all-distance; an interval session with metre-based reps is not
  // no-distance. The longest step is the thing the session actually IS.
  const kmPlusStrides = {
    estimatedDurationSeconds: 2100, estimatedDistanceMeters: 6400,
    steps: [
      { kind: "steady", distanceMeters: 6000, targetPaceSecPerKm: pace },
      { kind: "warmup", durationSeconds: 120, display: "Stride", targetPaceSecPerKm: pace },
    ],
  };
  const intervals = {
    estimatedDurationSeconds: 2760, estimatedDistanceMeters: 9000,
    steps: [
      { kind: "warmup", durationSeconds: 600, targetPaceSecPerKm: pace },
      ...Array.from({ length: 6 }, () => ({ kind: "rep", distanceMeters: 1000, targetPaceSecPerKm: { minSecPerKm: 240, maxSecPerKm: 250 } })),
      { kind: "cooldown", durationSeconds: 600, targetPaceSecPerKm: pace },
    ],
  };
  const h = harness(kmPlusStrides);
  assert.equal(h.api.sessionDistanceDriven(kmPlusStrides), true, "the six-kilometre body should decide");
  assert.equal(h.api.sessionDistanceDriven(intervals), false,
    "an interval session's warm-up and cool-down carry no distance, so halfway must stay on the clock");
});

test("a distance session with no distance total falls back rather than guessing", () => {
  const session = {
    estimatedDurationSeconds: 600,
    steps: [{ kind: "steady", distanceMeters: 2000, targetPaceSecPerKm: pace }],
  };
  const h = harness(session);
  assert.equal(h.api.sessionHalfwayReached({ elapsedSeconds: 300, distanceMeters: 100 }), true,
    "with no total to be half of, the clock is the only honest answer");
});

// ---- feature 2: halfway through the section ----------------------------------------------------

const stepAt = (o: any) => ({ index: 1, total: 5, kind: "steady", targetSeconds: 900, ...o });

test("the midpoint of a section is announced once, and only once", () => {
  const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
  const step = stepAt({});
  for (const p of [0.3, 0.5, 0.6, 0.9]) h.api.coachSectionTick({ step, stepProgress: p }, "easy", 600);
  assert.equal(h.fired.length, 1, "fired " + h.fired.length + " times: " + JSON.stringify(h.fired));
  assert.equal(h.fired[0]!.trigger, "section-halfway");
});

test("each repetition of a rep gets its own midpoint, not one for the whole set", () => {
  // ⚠️ KEYED ON index AND repeatIndex. Keyed on index alone, a set of six long reps would announce
  // the midpoint of the first and stay silent through the other five — they share a step index.
  const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
  for (let i = 1; i <= 3; i++) {
    const step = stepAt({ kind: "rep", index: 2, repeatIndex: i, repeatCount: 3, targetSeconds: 300 });
    h.api.coachSectionTick({ step, stepProgress: 0.2 }, "vo2", i * 400);
    h.api.coachSectionTick({ step, stepProgress: 0.55 }, "vo2", i * 400 + 150);
  }
  assert.equal(h.fired.length, 3, "expected one per rep, got " + h.fired.length);
  for (const f of h.fired) assert.equal(f.trigger, "interval-work");
});

test("the specific cue wins, so no moment gets two lines", () => {
  // ⚠️ interval-work and threshold-hold were WRITTEN for this exact moment and never fired. A
  // generic "halfway through this section" alongside them would be two lines for one moment.
  const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
  const t = h.api.coachSectionHalfwayTrigger;
  assert.equal(t({ kind: "rep" }, "vo2"), "interval-work");
  assert.equal(t({ kind: "steady" }, "threshold"), "threshold-hold");
  assert.equal(t({ kind: "steady" }, "race-specific"), "threshold-hold");
  assert.equal(t({ kind: "steady" }, "long"), "section-halfway");
  assert.equal(t({ kind: "steady" }, "easy"), "section-halfway");
});

test("nothing is said in the places where it would be noise", () => {
  const cases: [string, any, string][] = [
    ["a warm-up", stepAt({ kind: "warmup" }), "being half warmed up is not a coaching moment"],
    ["a cool-down", stepAt({ kind: "cooldown" }), "same at the other end"],
    ["a recovery jog", stepAt({ kind: "recovery" }), "the recovery between reps is not a section"],
    ["a walk back", stepAt({ display: "Walk back" }), "a stride's walk back is seconds long"],
    ["a stride", stepAt({ display: "Stride", targetSeconds: 20 }), "twenty seconds has no middle"],
    ["a short rep", stepAt({ kind: "rep", targetSeconds: 60 }), "a minute of hard running needs no progress report"],
    ["a short distance rep", stepAt({ kind: "rep", targetSeconds: 0, targetMeters: 400 }), "400 m likewise"],
    ["a one-section session", stepAt({ total: 1 }), "its midpoint IS the session midpoint"],
  ];
  for (const [what, step, why] of cases) {
    const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
    h.api.coachSectionTick({ step, stepProgress: 0.7 }, "easy", 600);
    assert.equal(h.fired.length, 0, what + ": " + why);
  }
});

test("a long section does get one, by time or by distance", () => {
  for (const step of [stepAt({ targetSeconds: 240 }), stepAt({ targetSeconds: 0, targetMeters: 800 })]) {
    const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
    h.api.coachSectionTick({ step, stepProgress: 0.5 }, "long", 600);
    assert.equal(h.fired.length, 1, "a long enough section should be announced: " + JSON.stringify(step));
  }
});

test("it never lands on top of the session halfway", () => {
  // ⚠️ On a two-section run the two midpoints can fall seconds apart, and "you're halfway through"
  // followed at once by "halfway through this section" is the coach contradicting itself about what
  // it is counting.
  const h = harness({ estimatedDurationSeconds: 3000, steps: [] });
  h.COACH.lastHalfwayAt = 600;
  h.api.coachSectionTick({ step: stepAt({}), stepProgress: 0.6 }, "easy", 615);
  assert.equal(h.fired.length, 0, "spoke 15s after the session halfway");

  const h2 = harness({ estimatedDurationSeconds: 3000, steps: [] });
  h2.COACH.lastHalfwayAt = 600;
  h2.api.coachSectionTick({ step: stepAt({}), stepProgress: 0.6 }, "easy", 700);
  assert.equal(h2.fired.length, 1, "still silent a minute and a half later");
});

// ---- the three that were dormant ---------------------------------------------------------------

test("all three dormant moments are now fired by something", () => {
  const html = readFileSync(PAGE, "utf8");
  const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ SCOPED TO THE FUNCTIONS THAT DECIDE, not to the whole page — the catalogue is inlined in the
  // build, so every trigger name appears in it whether anything fires it or not. A page-wide grep
  // here would pass with all three still dormant, which is how they stayed dormant.
  const decide = strip(lift(["coachStepTrigger", "coachSectionHalfwayTrigger"]));
  for (const t of ["threshold-hold", "interval-work", "strength-start"]) {
    assert.ok(decide.includes('"' + t + '"'), t + " is still fired by nothing");
  }
});

test("a strength session is not handed a running cue", () => {
  // ⚠️ It is one steady step with no pace, indistinguishable from a tempo run by kind alone — which
  // is why it was getting "tempo-start" and never its own line. Type has to be asked first.
  const html = readFileSync(PAGE, "utf8");
  const src = lift(["coachStepTrigger"]);
  const fn = new Function(src + "; return coachStepTrigger;")();
  assert.equal(fn({ kind: "steady", targetRpe: { min: 6, max: 7 } }, "strength"), "strength-start");
  assert.equal(fn({ kind: "warmup" }, "strength"), "warmup-start", "a strength warm-up is still a warm-up");
  assert.equal(fn({ kind: "steady", targetRpe: { min: 6, max: 7 } }, "threshold"), "tempo-start",
    "a real tempo run must be unaffected");
  assert.ok(src.indexOf('sessionType === "strength"') < src.indexOf('stepKind === "warmup"'),
    "the session type must be checked before the step kind, or steady still wins");
});

// ---- the new lines themselves ------------------------------------------------------------------

test("the new section-halfway lines obey the catalogue's rules", () => {
  const list = ALL_PROMPTS.filter((p) => p.trigger === "section-halfway");
  assert.ok(list.length >= 2, "expected at least two so it is not the same line every section");
  for (const p of list) {
    for (const c of COACH_IDS) {
      const txt = promptTextFor(p, c);
      // ⚠️ NO DIGITS, EVER. The clips are pre-generated, so a number can never be spoken correctly.
      assert.ok(!/\d/.test(txt), p.id + "/" + c + " contains a digit: " + txt);
      // Short enough to be heard mid-effort rather than talked through.
      assert.ok(txt.length <= 90, p.id + "/" + c + " is " + txt.length + " characters: " + txt);
      assert.ok(txt.trim().length > 0, p.id + "/" + c + " is empty");
    }
    // Every coach should get their own wording, as the pace cues do — a shared line across nine
    // personalities is the gap the three dormant moments already have.
    const distinct = new Set(COACH_IDS.map((c) => promptTextFor(p, c)));
    assert.ok(distinct.size >= 8, p.id + " only has " + distinct.size + " distinct wordings across nine coaches");
  }
  // Not one-shot: a session has several sections. But not chatty either.
  for (const p of list) {
    assert.ok(p.minRepeatSec >= 120 && p.minRepeatSec < 36000,
      p.id + " repeat gap of " + p.minRepeatSec + "s is either chatty or effectively one-shot");
  }
});
