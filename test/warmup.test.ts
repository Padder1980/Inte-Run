import assert from "node:assert/strict";
import { test } from "node:test";
import { WARMUP_MOVEMENTS, buildWarmup, firstHardEffort, type AbilityBand } from "../src/science/warmup.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { easyRun, longRun, recoveryRun, thresholdSession, vo2Session } from "../src/plan/session-templates.ts";

const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
const all = (w: ReturnType<typeof buildWarmup>) =>
  w ? [w.why, ...w.notes, ...w.phases.map((p: any) => p.instruction), ...(w.phases.flatMap((p: any) => p.movements || []))] : [];

test("the warm-up comes from the first hard effort, not the session's length", () => {
  // ⚠️ THE SPECIFICATION'S CENTRAL RULE. A 100-minute long run BEGINS easy, so its opening is the
  // warm-up; a much shorter interval session opens with a near-maximal repetition and needs a real
  // one. Sorting by duration gets this exactly backwards.
  const long = buildWarmup(longRun(paces, 100), "intermediate")!;
  const reps = buildWarmup(vo2Session(paces, 1), "intermediate")!;
  assert.equal(long.embedded, true, "a long run warms up inside itself");
  assert.equal(reps.embedded, false, "an interval session needs preparing for");
  assert.ok(reps.totalMinutes > long.totalMinutes,
    `the shorter, harder session needs the longer warm-up (${reps.totalMinutes} vs ${long.totalMinutes})`);
});

test("first hard effort is read from the session's own steps", () => {
  assert.equal(firstHardEffort(easyRun(paces, 40)), "easy");
  assert.equal(firstHardEffort(recoveryRun(paces, 30)), "easy");
  assert.ok(["threshold", "hard"].includes(firstHardEffort(thresholdSession(paces, 1))));
  assert.ok(["hard", "maximal"].includes(firstHardEffort(vo2Session(paces, 1))));
});

test("no generated string may promise injury prevention", () => {
  // ⚠️ The paper's ONE grade-A rule, and it is about language. A 2024 meta-analysis found no pooled
  // injury reduction from exercise programmes in endurance runners; the 1993 running trial found
  // none from warm-up education. Claiming otherwise is the single thing this feature must not do.
  const banned = /prevent\w* (an )?injur|protects? your (joints|muscles|knees)|avoid\w* injur|eliminat\w* (muscle )?(pulls|strains)|safe to (run|race)|injury[- ]free/i;
  const abilities: AbilityBand[] = ["new", "beginner", "intermediate", "advanced"];
  const sessions = [easyRun(paces, 40), longRun(paces, 90), thresholdSession(paces, 1), vo2Session(paces, 1), recoveryRun(paces, 30)];
  for (const ability of abilities) {
    for (const s of sessions) {
      for (const t of [{}, { temperatureC: 30 }, { temperatureC: 2 }, { timeAvailableMinutes: 8 }]) {
        for (const line of all(buildWarmup(s, ability, t))) {
          assert.ok(!banned.test(line), `banned claim in "${line}"`);
        }
      }
    }
  }
});

test("nor may it sell stretching as making you faster or safer", () => {
  // A 2025 running-specific review found no significant acute effect of any stretching mode on
  // running economy. The movements are rehearsal and a readiness check; saying more is unsupported.
  const overclaim = /stretch\w* (improves?|makes you|helps you run)|improves? your running economy|makes you faster/i;
  for (const ability of ["new", "intermediate", "advanced"] as AbilityBand[]) {
    for (const line of all(buildWarmup(thresholdSession(paces, 1), ability))) {
      assert.ok(!overclaim.test(line), `over-claims for stretching: "${line}"`);
    }
  }
});

test("a beginner gets less than an advanced runner for the identical session", () => {
  // Acceptance criterion 1. The 2026 adolescent study found a standard warm-up helped the fitter
  // group and not the low-fitness one — one dose for everyone is the thing to avoid.
  const s = thresholdSession(paces, 1);
  const nw = buildWarmup(s, "new")!, beg = buildWarmup(s, "beginner")!;
  const int = buildWarmup(s, "intermediate")!, adv = buildWarmup(s, "advanced")!;
  assert.ok(nw.totalMinutes < beg.totalMinutes, "new < beginner");
  assert.ok(beg.totalMinutes < int.totalMinutes, "beginner < intermediate");
  assert.ok(int.totalMinutes <= adv.totalMinutes, "intermediate <= advanced");
  const strideCount = (w: any) => (w.phases.find((p: any) => p.phase === "potentiate") || { strides: 0 }).strides;
  assert.ok(strideCount(nw) <= strideCount(int), "a new runner gets no more strides than an intermediate");
});

test("a harder first effort gets a bigger warm-up than a gentler one", () => {
  // Acceptance criterion 3, in the form this app can express it.
  const steadyish = buildWarmup(longRun(paces, 90), "intermediate")!;
  const thr = buildWarmup(thresholdSession(paces, 1), "intermediate")!;
  const rep = buildWarmup(vo2Session(paces, 1), "intermediate")!;
  assert.ok(thr.totalMinutes > steadyish.totalMinutes);
  assert.ok(rep.totalMinutes >= thr.totalMinutes);
});

test("heat only ever removes; cold adds easy minutes, never harder work", () => {
  // ⚠️ Both are explicit content assertions in the paper. Adding activity in heat makes the runner
  // arrive overheated, which costs more than arriving slightly under-warmed.
  const s = thresholdSession(paces, 1);
  const mild = buildWarmup(s, "intermediate", { temperatureC: 14 })!;
  const hot = buildWarmup(s, "intermediate", { temperatureC: 30 })!;
  const cold = buildWarmup(s, "intermediate", { temperatureC: 1 })!;
  assert.ok(hot.totalMinutes < mild.totalMinutes, "heat must shorten it");
  assert.ok(cold.totalMinutes > mild.totalMinutes, "cold may lengthen it");
  const strides = (w: any) => (w.phases.find((p: any) => p.phase === "potentiate") || { strides: 0 }).strides;
  assert.ok(strides(cold) <= strides(mild), "cold must not add hard repetitions");
  assert.ok(hot.notes.some((n) => /heat|shade/i.test(n)), "the runner is told why it is shorter");
});

test("less time keeps the specific work and drops the extras", () => {
  const s = thresholdSession(paces, 1);
  const full = buildWarmup(s, "intermediate")!;
  const rushed = buildWarmup(s, "intermediate", { timeAvailableMinutes: 8 })!;
  assert.ok(rushed.totalMinutes < full.totalMinutes);
  const mob = (w: any) => (w.phases.find((p: any) => p.phase === "mobilise") || { movements: [] }).movements.length;
  assert.ok(mob(rushed) < mob(full), "the drill list shortens first");
  assert.ok(rushed.phases.some((p: any) => p.phase === "potentiate" && p.strides >= 1),
    "at least one stride survives — the specific work is what you keep");
  assert.ok(rushed.notes.some((n) => /time/i.test(n)));
});

test("an easy or recovery run needs no separate warm-up at all", () => {
  for (const s of [easyRun(paces, 45), recoveryRun(paces, 30)]) {
    const w = buildWarmup(s, "intermediate")!;
    assert.equal(w.embedded, true);
    assert.ok(!w.phases.some((p: any) => p.phase === "potentiate"), "no strides before an easy run");
    assert.ok(w.phases.length === 1, "one instruction, not a routine");
  }
});

test("illness or pain stops it generating anything", () => {
  // ⚠️ Returns NOTHING, not a gentler warm-up. The paper's modifier order puts the medical gate
  // above every performance rule so no later scaling can talk its way past it.
  assert.equal(buildWarmup(vo2Session(paces, 1), "intermediate", { unwell: true }), null);
  assert.equal(buildWarmup(easyRun(paces, 40), "new", { unwell: true }), null);
});

test("every warm-up carries its evidence grade and explains itself", () => {
  // The paper asks that grades survive into the product so nothing reads as more certain than it is.
  for (const ability of ["new", "intermediate", "advanced"] as AbilityBand[]) {
    for (const s of [easyRun(paces, 40), thresholdSession(paces, 1), vo2Session(paces, 1)]) {
      const w = buildWarmup(s, ability)!;
      assert.ok(/^[ABCD](\/[BCD])?$/.test(w.evidenceGrade), `bad grade ${w.evidenceGrade}`);
      assert.ok(w.why.length > 30, "a warm-up must say why it is what it is");
      assert.ok(/[.!]$/.test(w.why));
      assert.equal(w.modelVersion, "1.0.0");
    }
  }
});

test("the movement library is small, and a new runner is never given skips", () => {
  // Ten minutes of drills for every runner is explicitly not supported; and a drill a novice cannot
  // coordinate is worse than the march it replaces.
  const adv = buildWarmup(vo2Session(paces, 1), "advanced")!;
  const mob = (w: any) => (w.phases.find((p: any) => p.phase === "mobilise") || { movements: [] }).movements;
  assert.ok(mob(adv).length >= 2 && mob(adv).length <= 6, "between two and six movements");
  const nw = buildWarmup(vo2Session(paces, 1), "new")!;
  assert.ok(!mob(nw).some((m: string) => m === WARMUP_MOVEMENTS.a_skip), "a new runner marches rather than skips");
  assert.ok(mob(nw).some((m: string) => m === WARMUP_MOVEMENTS.a_march));
});

test("no primer, no plyometrics, no device — none of them are defaults", () => {
  // The paper reserves all three for rehearsed advanced athletes and says so repeatedly. Phase 1 is
  // the safe core; if a primer ever appears it must be opt-in, and this test should be the thing
  // that makes someone think twice before making it automatic.
  const banned = /primer|inspiratory|plyometric|bounding|resisted sprint|loaded jump|heavy (lift|squat)/i;
  for (const ability of ["new", "beginner", "intermediate", "advanced"] as AbilityBand[]) {
    for (const s of [thresholdSession(paces, 1), vo2Session(paces, 1)]) {
      for (const line of all(buildWarmup(s, ability))) {
        assert.ok(!banned.test(line), `an advanced-only component appeared by default: "${line}"`);
      }
    }
  }
});

test("a race is warmed up by its DISTANCE, never by its intensity", () => {
  // ⚠️ Every race is a maximal effort, so reading effort alone gave a half marathon the same
  // 34-minute preparation as a VO2 session — against a paper that allows a half 0–15 minutes, a
  // marathon 0–12, and warns in as many words against copying 5 km logic into longer races.
  const race = vo2Session(paces, 1); // any maximal-effort session stands in for the race steps
  const k5 = buildWarmup(race, "intermediate", { raceDistance: "5k" })!;
  const k10 = buildWarmup(race, "intermediate", { raceDistance: "10k" })!;
  const half = buildWarmup(race, "intermediate", { raceDistance: "half" })!;
  const mar = buildWarmup(race, "intermediate", { raceDistance: "marathon" })!;
  assert.ok(k5.totalMinutes > k10.totalMinutes, "5k needs more than 10k");
  assert.ok(k10.totalMinutes > half.totalMinutes, "10k needs more than a half");
  assert.ok(half.totalMinutes > mar.totalMinutes, "a half needs more than a marathon");
  assert.ok(mar.totalMinutes <= 15, `a marathon warm-up must be small, got ${mar.totalMinutes}`);
  // Acceptance criterion 2 from the paper, stated exactly.
  assert.ok(mar.totalMinutes < k5.totalMinutes,
    "a marathon warm-up is shorter than a 5 km warm-up for the same runner in the same weather");
});

test("a beginner does no formal running before a half or a marathon", () => {
  const race = vo2Session(paces, 1);
  for (const d of ["half", "marathon"] as const) {
    const w = buildWarmup(race, "new", { raceDistance: d })!;
    assert.equal(w.embedded, true, `${d}: the race itself is the warm-up`);
    assert.ok(!w.phases.some((p: any) => p.phase === "potentiate"), `${d}: no strides for a novice`);
    assert.ok(w.notes.some((n) => /finish|easier/i.test(n)), `${d}: told to start conservatively`);
  }
});

test("a long run with its hard work late warms up inside itself", () => {
  // The paper's T2: a run whose pace block comes later needs no second full warm-up. Taking the
  // PEAK effort instead of the FIRST put 24 minutes of preparation in front of a 135-minute run
  // whose opening 40 minutes are easy.
  const late = longRun(paces, 135, { finishMinutes: 20, finishPace: paces.threshold, finishRpe: { min: 6, max: 7 } } as any);
  const w = buildWarmup(late, "intermediate")!;
  assert.equal(w.embedded, true, "the run's own opening is the warm-up");
  assert.ok(w.totalMinutes <= 12, `got ${w.totalMinutes} minutes before a run that starts easy`);
});

test("an advanced runner's RACE warm-up differs from an intermediate's at every distance", () => {
  // ⚠️ The paper gives advanced runners a longer raise and more strides at every distance — and a
  // marathon is the sharpest case: 2–4 short strides where an intermediate usually has none.
  // Collapsing the two tiers gave an experienced runner a near-novice race routine.
  const race = vo2Session(paces, 1);
  for (const d of ["5k", "10k", "half", "marathon"] as const) {
    const int = buildWarmup(race, "intermediate", { raceDistance: d })!;
    const adv = buildWarmup(race, "advanced", { raceDistance: d })!;
    assert.ok(adv.totalMinutes > int.totalMinutes, `${d}: advanced ${adv.totalMinutes} must exceed intermediate ${int.totalMinutes}`);
    const mob = (w: any) => (w.phases.find((p: any) => p.phase === "mobilise") || { movements: [] }).movements.length;
    assert.ok(mob(adv) > mob(int), `${d}: advanced gets their own drill sequence, not two movements`);
  }
  // ...and the distance ordering still holds inside the advanced tier.
  const mins = (d: any) => buildWarmup(race, "advanced", { raceDistance: d })!.totalMinutes;
  assert.ok(mins("5k") > mins("10k") && mins("10k") > mins("half") && mins("half") > mins("marathon"));
});

test("an embedded warm-up gains strides when the hard work starts early", () => {
  // ⚠️ The paper's T2: no second full warm-up for a run whose pace block comes later, BUT 2–4
  // progressive strides if that block starts inside the first 20 minutes — by then the run's own
  // opening has had barely any time to do the job.
  // ⚠️ The session's OWN warm-up step is deliberately not counted — it is the thing being generated,
  // not evidence the run warms itself up. Only easy running that is part of the RUN counts, which is
  // why this fixture carries 15 real minutes of it.
  const early = {
    targetRpe: { min: 2, max: 7 },
    steps: [
      // ⚠️ Steps carry a PACE. A session with neither pace nor distance is not a run — that is how
      // the generator tells a threshold session from a strength session, both of which are one
      // continuous block at a similar effort.
      { kind: "warmup", label: "Easy", durationSeconds: 10 * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "steady", label: "Easy", durationSeconds: 15 * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "rep", label: "Threshold block", durationSeconds: 20 * 60, targetPaceSecPerKm: paces.threshold, targetRpe: { min: 6, max: 7 } },
    ],
  } as any;
  const w = buildWarmup(early, "intermediate")!;
  assert.equal(w.embedded, true, "the run still warms itself up");
  assert.ok(w.phases.some((p: any) => p.phase === "potentiate" && p.strides >= 2), "but strides bridge into the work");
  assert.ok(w.notes.some((n) => /early|shock/i.test(n)), "and the runner is told why");

  // The same session with the block much later gets no strides — nothing to bridge.
  const late = { ...early, steps: [early.steps[0], { ...early.steps[1], durationSeconds: 45 * 60 }, early.steps[2]] };
  // ...and with barely any easy running first, the run has NOT warmed itself up: a real warm-up.
  const immediate = { ...early, steps: [early.steps[0], { ...early.steps[1], durationSeconds: 4 * 60 }, early.steps[2]] };
  const wi = buildWarmup(immediate, "intermediate")!;
  assert.equal(wi.embedded, false, "four minutes of easy running is not a warm-up");
  assert.ok(wi.totalMinutes > 15, "it gets the full structured version instead");
  const wl = buildWarmup(late, "intermediate")!;
  assert.equal(wl.embedded, true);
  assert.ok(!wl.phases.some((p: any) => p.phase === "potentiate"), "a block 57 minutes in needs no strides beforehand");

  // ⚠️ A brand-new runner is exempt: strides are the component the paper caps hardest for them.
  assert.ok(!buildWarmup(early, "new")!.phases.some((p: any) => p.phase === "potentiate"));
});

test("readiness can only ever REDUCE, never add", () => {
  // ⚠️ The paper's acceptance criterion 4. A good readiness score must not unlock a bigger warm-up:
  // there is no evidence for it, and it is precisely the direction in which an app talks somebody
  // into more work on a day they happened to say they felt fine.
  const s = thresholdSession(paces, 1);
  const normal = buildWarmup(s, "intermediate")!;
  const flat = buildWarmup(s, "intermediate", { readiness: 2 })!;
  const great = buildWarmup(s, "intermediate", { readiness: 5 })!;
  assert.ok(flat.totalMinutes < normal.totalMinutes, "a poor score shortens it");
  assert.equal(great.totalMinutes, normal.totalMinutes, "a good score changes nothing");
  const st = (w: any) => (w.phases.find((p: any) => p.phase === "potentiate") || { strides: 0 }).strides;
  assert.ok(st(flat) <= st(normal), "and it never adds strides");
  assert.ok(flat.notes.some((n) => /conservativ|not feeling/i.test(n)), "and it says why");
});

test("a formal test is never compressed — it is declined", () => {
  // ⚠️ The paper is explicit: for a formal time trial, too little time returns "warm-up incomplete"
  // rather than squeezing the preparation. A rushed warm-up produces a time that measures the
  // warm-up, and the whole value of the test is being comparable with the last one.
  const s = vo2Session(paces, 1);
  const rushed = buildWarmup(s, "intermediate", { timeAvailableMinutes: 6, formalTest: true })!;
  assert.equal(rushed.incomplete, true);
  assert.equal(rushed.phases.length, 0, "no compressed routine is offered");
  assert.ok(/comparable|not enough time/i.test(rushed.why + rushed.notes.join(" ")));
  // An ordinary session in the same six minutes still gets the best available version.
  const ordinary = buildWarmup(s, "intermediate", { timeAvailableMinutes: 6 })!;
  assert.ok(!ordinary.incomplete && ordinary.phases.length > 0);
  // And with enough time, a formal test warms up normally.
  assert.ok(!buildWarmup(s, "intermediate", { timeAvailableMinutes: 60, formalTest: true })!.incomplete);
});

test("a delayed start gets a re-warm plan, and never a repeat", () => {
  const w = buildWarmup(thresholdSession(paces, 1), "intermediate")!;
  assert.ok(w.delayPlan && w.delayPlan.afterMinutes > 0);
  const txt = w.delayPlan!.actions.join(" ");
  assert.ok(!/repeat|again from the start|full warm/i.test(txt), "never repeat the warm-up");
  assert.ok(/stride|easy/i.test(txt), "a brief reactivation instead");
  // ⚠️ In heat the re-warm must not add movement — thermal strain is the thing being managed.
  const hot = buildWarmup(thresholdSession(paces, 1), "intermediate", { temperatureC: 30 })!;
  assert.ok(/shade|still/i.test(hot.delayPlan!.actions.join(" ")));
});

test("the three readiness questions are asked after the warm-up", () => {
  const w = buildWarmup(vo2Session(paces, 1), "intermediate")!;
  assert.ok(w.readinessCheck && w.readinessCheck.length === 3);
  assert.ok(w.readinessCheck!.some((q) => /legs/i.test(q)));
  assert.ok(w.readinessCheck!.some((q) => /breathing/i.test(q)));
  assert.ok(w.readinessCheck!.some((q) => /pain/i.test(q)));
});

test("under-18s get a smaller, simpler warm-up", () => {
  const s = vo2Session(paces, 1);
  const adult = buildWarmup(s, "intermediate")!;
  const teen = buildWarmup(s, "intermediate", { ageYears: 15 })!;
  assert.ok(teen.totalMinutes < adult.totalMinutes);
  const st = (w: any) => (w.phases.find((p: any) => p.phase === "potentiate") || { strides: 0 }).strides;
  assert.ok(st(teen) <= st(adult));
  assert.ok(teen.notes.some((n) => /your age|simple/i.test(n)));
});

test("a static hold appears only when asked for, and is never sold as necessary", () => {
  // The paper allows a short hold for a known restriction or a preference; it does not support
  // making it compulsory, and a long hold immediately before fast running is the thing to avoid.
  const s = thresholdSession(paces, 1);
  const plain = buildWarmup(s, "intermediate")!;
  const held = buildWarmup(s, "intermediate", { mobilityNeeds: true })!;
  const mv = (w: any) => (w.phases.find((p: any) => p.phase === "mobilise") || { movements: [] }).movements.join(" ");
  assert.ok(!/hold/i.test(mv(plain)), "no holds unless asked for");
  assert.ok(/15–30 seconds/.test(mv(held)), "a short hold when asked for");
  assert.ok(held.notes.some((n) => /because you asked/i.test(n)), "framed as the runner's choice");
  assert.ok(!/must|should always|need to stretch/i.test(held.notes.join(" ")));
});

test("a session with no running in it gets no running warm-up", () => {
  // ⚠️ A strength session is ONE continuous 45-minute block at RPE 6-7 with no pace and no distance
  // — indistinguishable from a tempo run if you look at kind and effort, which is what my first
  // gate did: it handed "Strength (maintenance)" 21 minutes of jogging and four strides. The tell
  // is a pace or a distance. And the gate lives in the engine, not the UI, because a UI gate stops
  // it being SHOWN while every other caller still gets the wrong answer — which is how it reached
  // the session-duration figures and made a 45-minute strength session read as 69.
  const strength = {
    targetRpe: { min: 6, max: 7 },
    steps: [{ kind: "steady", label: "Strength circuit", durationSeconds: 45 * 60, targetRpe: { min: 6, max: 7 } }],
  } as any;
  assert.equal(buildWarmup(strength, "intermediate"), null);
  assert.equal(buildWarmup({ ...strength, exercises: [{}] }, "intermediate"), null, "a list of exercises is not a run");
  // The identical shape WITH a pace is a tempo run, and does get one.
  const tempo = { ...strength, steps: [{ ...strength.steps[0], targetPaceSecPerKm: paces.threshold }] };
  assert.ok(buildWarmup(tempo, "intermediate"));
});

test("a warm-up never becomes the session — but repetitions are exempt", () => {
  // ⚠️ Two failures in opposite directions, both measured. Uncapped, a 35-minute moderate run got a
  // 19-minute warm-up. Capped blindly, a VO2 session dropped to 17 against the paper's 25-32 — and
  // the paper's own worked example is that a short repetition session needs MORE preparation, not
  // less. So the cap guards continuous running only.
  const moderate = {
    targetRpe: { min: 3, max: 4 },
    steps: [
      { kind: "warmup", label: "Easy", durationSeconds: 6 * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "steady", label: "Moderate", durationSeconds: 29 * 60, targetPaceSecPerKm: paces.aerobic, targetRpe: { min: 3, max: 4 } },
    ],
  } as any;
  const w = buildWarmup(moderate, "intermediate")!;
  assert.ok(w.totalMinutes <= 14, `a 35-minute moderate run must not get ${w.totalMinutes} minutes of warm-up`);
  // ...while a repetition session keeps its full preparation.
  const reps = buildWarmup(vo2Session(paces, 1), "intermediate")!;
  assert.ok(reps.totalMinutes >= 25, `an interval session needs real preparation, got ${reps.totalMinutes}`);
});
