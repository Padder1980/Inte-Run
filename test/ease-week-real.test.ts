// AN EASIER WEEK IS EASIER ON THE ROAD, NOT ONLY ON PAPER (2026-11-18).
//
// easeWeek "trimmed" easy and long runs with scaleSessionDistance plus a scaled estimate — the FIGURES only. The steps
// (what the live run, the voice coach and the watch follow) and the titles were untouched: an eased "58′ long run" still
// said 58′ and ran 58 minutes under a week summary saying 46, and a walk-run or Rebuild week — no hard session to swap —
// was prescribed exactly as before ("Make a week easier", B5, B6, B14's and §10's "Ease back"). The B-race race week had
// the same paper-only cut. `shortenSession` (src/plan/session-templates.ts) now shortens the steps and derives the rest.
//
// The owner's rulings, 2026-11-18, asked with worked examples from his own plan types:
//   run–walk sessions in an easier week: "Shorter runs, same walks" — 2 × (8′ run / 2′ walk) → 2 × (7′ run / 2′ walk);
//   a walk-run KEY RUN in an easier week: "Stays as it is".
// And two of his earlier rules still hold through it: timed easy runs on multiples of five minutes (2026-08-26), and
// the long run the longest run of an easier week (2026-10-05).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, RaceDistanceKey, Session, WorkoutStep } from "../src/domain/types.ts";
import { generatePlan, secondaryRaceWindow } from "../src/plan/generate-plan.ts";
import { roadFor } from "../src/plan/road.ts";
import { applyMissedSessionAdjustment, easeWeek, type EaseReason } from "../src/adapt/missed-sessions.ts";
import { figuresOf, shortenSession } from "../src/plan/session-templates.ts";

const START = "2026-11-23";
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const TT: Record<string, number> = { "5k": 1500, "10k": 3200, half: 7500, marathon: 16200 };
const athlete = (o: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1800 }, experience: "recreational", includeStrength: true,
  includeMobility: true, returningFromInjury: false, returningFromBreak: false, runWalk: false, longRunDay: 6, ...o,
} as Athlete);
const goal = (distance: string, weeks: number): Goal =>
  ({ distance, targetTimeSeconds: TT[distance]!, raceDateIso: add(START, weeks * 7 - 1) } as Goal);

/** One step's minutes, by the engine's own derivation (figuresOf is what `assemble` uses). */
const stepSec = (st: WorkoutStep) => figuresOf([st]).estimatedDurationSeconds;
/** The running a session prescribes: its steady and rep steps (never warm-ups, cool-downs, walks or walk-backs). A strength
 *  or mobility session is one "steady" step too, and it is not running. */
const running = (s: Session) => s.intensity === "none" ? 0
  : (s.steps ?? []).reduce((a, st) => a + (st.kind === "steady" || st.kind === "rep" ? stepSec(st) : 0), 0);
const isRunWalk = (s: Session) => (s.steps ?? []).some((st) => st.kind === "rep") && !(s.steps ?? []).some((st) => st.kind === "steady");
/** The builder's clock ("50″", "1′30″", "7′"), checked below against every title the engine builds unshortened. */
const clock = (sec: number) => sec % 60 === 0 ? `${sec / 60}′` : sec < 60 ? `${sec}″`
  : `${Math.floor(sec / 60)}′${String(sec % 60).padStart(2, "0")}″`;

/** The main track's grid (the shape of test/ease-week.test.ts's), and every road a runner can be placed on today. */
function* plans() {
  for (const dist of ["5k", "10k", "half", "marathon"]) for (const days of [3, 5, 7])
    for (const exp of ["beginner", "recreational", "competitive"]) for (const secs of [1249, 1800, 2400]) {
      try {
        yield { who: `${dist}/${days}d/${exp}/${secs}s`, p: generatePlan(athlete({ daysPerWeek: days, experience: exp as Athlete["experience"],
          recent: { distanceMeters: 5000, timeSeconds: secs } }), goal(dist, dist === "marathon" ? 24 : 18), { startDateIso: START }) };
      } catch { /* a combination the engine refuses */ }
    }
  for (const dist of ["5k", "10k", "half"]) for (const days of [2, 3, 4]) for (const kind of ["runwalk", "beginner", "injury", "break"]) for (const weeks of [12, 44]) {
    const a = athlete({ daysPerWeek: days, experience: "beginner", runWalk: kind === "runwalk", returningFromInjury: kind === "injury",
      returningFromBreak: kind === "break", recent: { distanceMeters: 5000, timeSeconds: kind === "runwalk" ? 2400 : 2100 } });
    const g = goal(dist, weeks);
    const prop = roadFor(a, g, START);
    try {
      yield { who: `${kind}/${dist}/${days}d/${weeks}w${prop ? "/road" : ""}`, p: generatePlan(a, g, { startDateIso: START,
        ...(prop ? { road: { stages: prop.stages, rampWeeks: prop.rampWeeks } } : {}) }) };
    } catch { /* refused */ }
  }
}
/** Every week of every plan, eased for every reason. */
function* eased(reasons: EaseReason[] = ["chosen", "missed", "race"]) {
  for (const { who, p } of plans()) for (const w of p.weeks) for (const reason of reasons) {
    const r = easeWeek(w, reason);
    if (r.triggered) yield { who: `${who} wk${w.index} ${w.stage ?? ""} (${reason})`, w, r, reason };
  }
}
/** The sessions an ease SHORTENED (the swapped hardest session is a new session, not a shortened one). */
const shortened = (w: PlannedWeek, after: Session[]) =>
  w.sessions.map((s, i) => ({ was: s, now: after[i]! })).filter(({ was, now }) => now !== was && now.type === was.type);

test("BLOCKER: an easier week shortens the runs themselves — every run adds up to its own minutes and kilometres", () => {
  // ⚠️ THE DEFECT, AS IT WAS: the estimate fell and the steps did not, so every figure on screen disagreed with the run.
  // ⚠️ THE SWAPPED HARDEST SESSION IS NOT HELD HERE: its one step carries no pace, so its distance (worked out at the week's
  // easy pace) cannot be derived from it — a pre-existing gap recorded in notes/plan-adaptation.md, not this change's.
  let sessions = 0, cut = 0;
  for (const { who, w, r } of eased()) {
    for (const [i, s] of r.week.sessions.entries()) {
      if (!s.steps?.length || s.type !== w.sessions[i]!.type) continue;
      sessions++;
      const f = figuresOf(s.steps);
      assert.equal(s.estimatedDurationSeconds, f.estimatedDurationSeconds, `${who}: "${s.title}" says ${s.estimatedDurationSeconds} s, its steps ${f.estimatedDurationSeconds} s`);
      assert.equal(s.estimatedDistanceMeters, f.estimatedDistanceMeters, `${who}: "${s.title}" covers ${s.estimatedDistanceMeters} m, its steps ${f.estimatedDistanceMeters} m`);
      assert.equal(s.trainingDistanceMeters, f.trainingDistanceMeters, `${who}: "${s.title}" counts ${s.trainingDistanceMeters} m, its steps ${f.trainingDistanceMeters} m`);
    }
    for (const { was, now } of shortened(w, r.week.sessions)) {
      cut++;
      assert.ok(running(now) < running(was), `${who}: "${was.title}" → "${now.title}" was shortened on paper only (running ${running(was)} → ${running(now)} s)`);
    }
  }
  assert.ok(sessions > 50000 && cut > 20000, `only ${sessions} sessions and ${cut} shortened runs checked`);
});

test("BLOCKER: a walk-run week and a Rebuild week are really easier — the running they prescribe falls", () => {
  // Neither has a hard session to swap, so before this nothing the runner would run changed at all.
  const seen: Record<string, number> = {};
  for (const { who, w, r } of eased(["chosen"])) {
    // A week with a hard session to swap is held by ease-week.test.ts's time band (the swapped easy run is all "running"
    // while the workout's warm-up was not, so this ruler would mis-measure it). Here: the weeks with nothing to swap.
    if (!w.stage || w.stage === "race" || r.week.sessions.some((s, i) => s.type !== w.sessions[i]!.type)) continue;
    const before = w.sessions.reduce((a, s) => a + running(s), 0), after = r.week.sessions.reduce((a, s) => a + running(s), 0);
    // A walk-run week keeps its key run as it is (the owner's ruling), so the floor is lower there.
    const min = w.sessions.some((s) => s.keyRun) ? 0.04 : 0.08;
    assert.ok(after <= before * (1 - min), `${who}: running ${before} → ${after} s, ${((1 - after / before) * 100).toFixed(1)}% off`);
    seen[w.stage] = (seen[w.stage] ?? 0) + 1;
  }
  for (const stage of ["walkrun1", "walkrun2", "rebuild"]) assert.ok((seen[stage] ?? 0) >= 10, `only ${seen[stage] ?? 0} ${stage} weeks eased`);
});

test("BLOCKER: the owner's examples, exactly — Walk-run 1's first and fifth weeks, made easier", () => {
  // The worked examples he chose from on 2026-11-18 ("Shorter runs, same walks"). Asked of the real road.
  const a = athlete({ daysPerWeek: 3, experience: "beginner", runWalk: true, recent: { distanceMeters: 5000, timeSeconds: 2400 } });
  const g = goal("5k", 40);
  const prop = roadFor(a, g, START)!;
  const p = generatePlan(a, g, { startDateIso: START, road: { stages: prop.stages, rampWeeks: prop.rampWeeks } });
  const titles = (w: PlannedWeek) => easeWeek(w, "chosen").week.sessions.filter((s) => running(s) > 0).map((s) => s.title);
  assert.deepEqual(titles(p.weeks[0]!), Array(3).fill("Run–walk · 8 × (50″ run / 1′30″ walk)"));
  assert.deepEqual(titles(p.weeks[4]!), ["Run–walk · 2 × (7′ run / 2′ walk)", "Run–walk · 2 × (7′ run / 2′ walk)", "20′ without stopping — your key run"]);
  const wk1 = easeWeek(p.weeks[0]!, "chosen").week.sessions.find((s) => running(s) > 0)!;
  assert.equal(Math.round(wk1.estimatedDurationSeconds / 60), 25, "27 min → 25 min, as the example said");
});

test("BLOCKER: shorter runs, same walks — every walk, warm-up and cool-down of a run–walk session is as it was", () => {
  // The owner's choice over "go back a week" and "fewer repeats": the same session, every running block shorter.
  let n = 0;
  for (const { who, w, r } of eased()) {
    for (const { was, now } of shortened(w, r.week.sessions)) {
      if (!isRunWalk(was)) continue;
      n++;
      assert.equal(now.steps.length, was.steps.length, `${who}: "${was.title}" lost or gained a block`);
      now.steps.forEach((st, i) => {
        const old = was.steps[i]!;
        assert.equal(st.kind, old.kind, `${who}: "${was.title}" step ${i} changed kind`);
        if (st.kind !== "rep") assert.deepEqual(st, old, `${who}: "${was.title}" changed a ${st.kind} step ("${old.label}")`);
        else assert.ok(st.durationSeconds! <= old.durationSeconds! && st.durationSeconds! >= Math.min(old.durationSeconds!, 30) &&
          st.durationSeconds! >= old.durationSeconds! * 0.7, `${who}: "${was.title}" block ${old.durationSeconds} → ${st.durationSeconds} s`);
      });
      const off = 1 - running(now) / running(was);
      assert.ok(off >= 0.05 && off <= 0.3, `${who}: "${was.title}" → "${now.title}" takes ${(off * 100).toFixed(1)}% of its running`);
    }
  }
  assert.ok(n > 700, `only ${n} run–walk sessions shortened`); // measured 1,431
});

test("BLOCKER: a walk-run key run stays as it is in an easier week — the owner's ruling of 2026-11-18", () => {
  // "Stays as it is": the run the checkpoint looks for (20, then 30 minutes without stopping) is not made easier, so the
  // checkpoint can still be passed that week. For both ways into an easier week: chosen, and after missed runs.
  let n = 0;
  for (const { who, w, r } of eased(["chosen", "missed"])) {
    const key = w.sessions.find((s) => s.keyRun);
    if (!key) continue;
    n++;
    assert.equal(r.week.sessions.find((s) => s.id === key.id), key, `${who}: the key run "${key.title}" was changed`);
    assert.ok(r.changes.includes(`Kept your key run as it is: ${key.keyRun!.minutes} minutes without stopping.`), `${who}: the changes do not say so`);
  }
  // ...and the missed-sessions caller is the same mechanism.
  const missed = [...plans()].flatMap(({ p }) => p.weeks).find((w) => w.sessions.some((s) => s.keyRun))!;
  const m = applyMissedSessionAdjustment(missed, [{ completed: false }, { completed: false }] as never);
  assert.ok(m.week.sessions.some((s) => s.keyRun && s === missed.sessions.find((x) => x.keyRun)), "after missed runs the key run changed");
  assert.ok(n >= 20, `only ${n} eased weeks held a key run`);
});

test("BLOCKER: a shortened run's title says what its steps say", () => {
  // The builders' rule since 2026-08-26 ("rebuilt from the steps"). A title that kept "58′" over a 46-minute run is the
  // same defect in the words the runner reads first.
  let n = 0;
  // The test's clock is the builder's: every title the engine builds unshortened agrees with it.
  for (const { w } of eased(["chosen"])) for (const s of w.sessions) {
    const m = /× \((\S+) run \//.exec(s.title);
    if (m) assert.equal(m[1], clock(s.steps.find((st) => st.kind === "rep")!.durationSeconds!), `the test's clock disagrees with "${s.title}"`);
  }
  for (const { who, w, r } of eased()) {
    for (const { was, now } of shortened(w, r.week.sessions)) {
      n++;
      const reps = now.steps.filter((st) => st.kind === "rep");
      const t = now.title;
      let m: RegExpExecArray | null;
      if ((m = /^(\d+)′ without stopping/.exec(t))) {
        assert.equal(reps.length, 1, `${who}: "${t}" has walk breaks`);
        assert.equal(Number(m[1]) * 60, reps[0]!.durationSeconds, `${who}: "${t}" runs ${reps[0]!.durationSeconds} s`);
        const d = /^(\d+) minutes/.exec(now.description);
        if (d) assert.equal(d[1], m[1], `${who}: "${t}" is described as ${d[1]} minutes`);
      } else if ((m = /^(Long run|Run)–walk · (\d+) × \((\S+) run \/ (\S+) walk\)$/.exec(t))) {
        assert.equal(Number(m[2]), reps.length, `${who}: "${t}" has ${reps.length} blocks`);
        assert.ok(reps.every((st) => clock(st.durationSeconds!) === m![3]), `${who}: "${t}" runs ${reps.map((st) => clock(st.durationSeconds!)).join(", ")}`);
      } else if ((m = /^(\d+)′/.exec(t))) {
        assert.equal(Number(m[1]), Math.round(now.estimatedDurationSeconds / 60), `${who}: "${t}" lasts ${now.estimatedDurationSeconds} s`);
      } else if ((m = /^(\d+(?:\.\d)?) km /.exec(t))) {
        assert.equal(Number(m[1]), Number(((now.estimatedDistanceMeters ?? 0) / 1000).toFixed(1)), `${who}: "${t}" covers ${now.estimatedDistanceMeters} m`);
      } else {
        // ⚠️ A NEW TITLE SHAPE WITH A NUMBER IN IT must be taught to shortenSession's retitled(), or it goes stale.
        assert.ok(!/\d/.test(t.replace(/\d+ hill sprints?|\d+ × \d+′ at race effort/g, "")), `${who}: "${t}" is a title shape shortenSession does not rewrite`);
      }
      assert.notEqual(t === was.title && /^\d/.test(t), true, `${who}: "${t}" kept its old number`);
      for (const st of reps) {
        const l = /^Run (\S+) —/.exec(st.label);
        if (l) assert.equal(l[1], clock(st.durationSeconds!), `${who}: "${t}" has a block labelled "${st.label}" lasting ${st.durationSeconds} s`);
      }
    }
  }
  assert.ok(n > 20000, `only ${n} shortened runs checked`);
});

test("BLOCKER: the owner's units hold through an easier week — five minutes stays five, 100 m stays 100 m, and nearest, not up", () => {
  // 2026-08-26: timed easy runs "always be in multiples of 5's"; a distance-set run on the builder's 100 m. Rounding to
  // the nearest unit, because rounding UP to five minutes would erase a 15% cut from every timed run under 35 minutes.
  let fives = 0, minutes = 0, metres = 0;
  for (const { who, w, r } of eased()) {
    for (const { was, now } of shortened(w, r.week.sessions)) {
      if (isRunWalk(was)) continue;
      const body = now.steps.filter((st) => st.kind === "steady");
      if (body.every((st) => st.durationSeconds)) {
        const unit = was.estimatedDurationSeconds % 300 === 0 ? 300 : 60;
        unit === 300 ? fives++ : minutes++;
        assert.equal(now.estimatedDurationSeconds % unit, 0, `${who}: "${was.title}" → "${now.title}" (${now.estimatedDurationSeconds} s) is off its ${unit / 60}-minute step`);
        assert.ok(now.estimatedDurationSeconds <= Math.round(was.estimatedDurationSeconds / unit) * unit - unit, `${who}: "${was.title}" → "${now.title}" is not a step shorter`);
        assert.ok(now.estimatedDurationSeconds >= 600, `${who}: "${now.title}" is under ten minutes`);
      } else {
        metres++;
        const d = body.reduce((a, st) => a + (st.distanceMeters ?? 0), 0);
        assert.equal(d % 100, 0, `${who}: "${now.title}" runs ${d} m, off the builder's 100 m`);
        assert.ok(d >= 1000, `${who}: "${now.title}" is under a kilometre`);
      }
    }
  }
  assert.ok(fives > 1000 && minutes > 5000 && metres > 5000, `only ${fives} / ${minutes} / ${metres} runs measured`);
  // ⚠️ NEAREST, ASKED OF THE MECHANISM AT THE EASIER WEEK'S OWN FACTORS: away from the floors, a timed run lands within half
  // a step of the exact cut (a fifth of a long run's running, a seventh... of an easy run's). Rounding up would sit a whole
  // step long on a 60′ run (51′ → 55′ instead of 50′) and on every minute-stepped one (46.4′ → 47′).
  let asked = 0;
  for (const { p } of plans()) for (const w of p.weeks) for (const s of w.sessions) {
    if (s.keyRun || isRunWalk(s) || !(s.type === "long" || s.intensity === "easy") || !s.steps.some((st) => st.kind === "steady" && st.durationSeconds)) continue;
    const f = s.type === "long" ? 0.8 : 0.85;
    const now = shortenSession(s, f);
    if (now === s) continue;
    const unit = s.estimatedDurationSeconds % 300 === 0 ? 300 : 60;
    const exact = s.estimatedDurationSeconds - (1 - f) * running(s);
    if (now.estimatedDurationSeconds === 600 || now.estimatedDurationSeconds === Math.round(s.estimatedDurationSeconds / unit) * unit - unit) continue; // a floor
    asked++;
    assert.ok(Math.abs(now.estimatedDurationSeconds - exact) <= unit / 2 + 1,
      `"${s.title}" → "${now.title}": ${now.estimatedDurationSeconds} s against an exact ${Math.round(exact)} s, on ${unit / 60}-minute steps`);
  }
  assert.ok(asked > 2000, `only ${asked} timed runs asked`); // measured 3,881
});

test("BLOCKER: where an easy run cannot get shorter, the long run gives up some of its trim — the case that found it", () => {
  // 5k/3d/beginner week 4: "10′ easy + gentle pickups" sits at the ten-minute floor in five-minute steps, and the long run
  // trimmed from 13′ to 10′ would be SHORTER than it on the road. The long run stays the longest run (2026-10-05) by
  // being trimmed less: 13′ → 11′.
  const p = generatePlan(athlete({ daysPerWeek: 3, experience: "beginner", recent: { distanceMeters: 5000, timeSeconds: 1249 } }),
    { distance: "5k", targetTimeSeconds: 1500, raceDateIso: add("2026-09-07", 18 * 7) } as Goal, { startDateIso: "2026-09-07" });
  const w = p.weeks[3]!;
  const r = easeWeek(w, "chosen");
  const long = r.week.sessions.find((s) => s.type === "long")!;
  const pick = r.week.sessions.find((s) => /gentle pickups/.test(s.title))!;
  assert.equal(w.sessions.find((s) => s.type === "long")!.title, "13′ long run", "the named case moved — find its new shape");
  assert.equal(pick.title, "10′ easy + gentle pickups");
  assert.equal(long.title, "11′ long run");
  assert.ok((pick.estimatedDistanceMeters ?? 0) <= (long.estimatedDistanceMeters ?? 0) * 0.95);
  assert.ok(r.changes.some((c) => /^Kept your long run the longest run of the week.*trimmed a little less/.test(c)),
    "the changes do not say the long run was trimmed less: " + r.changes.join(" | "));
});

test("BLOCKER: no run the engine builds is cut on paper only — every session adds up, a B-race's race week included", () => {
  // The survey that found the B-race race week (2026-11-18): of 30,068 sessions an easier week touches, the only ones
  // whose minutes were not their steps' minutes were that week's, scaled by the race-week multiplier on paper. Held for
  // every session of every plan here, with a B-race at both ends of its window.
  let n = 0, brace = 0;
  const check = (who: string, weeks: PlannedWeek[]) => {
    for (const w of weeks) for (const s of w.sessions) {
      if (!s.steps?.length) continue;
      n++;
      if (w.secondaryRace?.role === "race") brace++;
      assert.equal(s.estimatedDurationSeconds, figuresOf(s.steps).estimatedDurationSeconds, `${who} wk${w.index}: "${s.title}" is not its steps' length`);
    }
  };
  for (const { who, p } of plans()) check(who, p.weeks);
  for (const dist of ["10k", "half", "marathon"] as RaceDistanceKey[]) for (const days of [4, 5]) {
    const a = athlete({ daysPerWeek: days, weeklyVolumeKmCurrent: 40 });
    const g = { distance: dist, targetTimeSeconds: TT[dist]!, raceDateIso: "2027-01-10", startDateIso: "2026-08-24" } as Goal;
    const win = secondaryRaceWindow(generatePlan(a, g).weeks, g);
    if (!win) continue;
    for (const day of [win.fromIso, win.toIso]) for (const d of win.distances)
      check(`${dist} B${d} ${day}`, generatePlan(a, g, { secondaryRace: { distance: d, dateIso: day } }).weeks);
  }
  assert.ok(n > 20000 && brace > 100, `only ${n} sessions, ${brace} in a B-race's race week`); // measured 28,482 and 191
});
