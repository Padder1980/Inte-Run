import assert from "node:assert/strict";
import { test } from "node:test";
import { WARMUP_MOVEMENTS, buildWarmup, firstHardEffort, type AbilityBand } from "../src/science/warmup.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { easyProgression, easyRun, longRun, recoveryRun, thresholdSession, vo2Session } from "../src/plan/session-templates.ts";

const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
const all = (w: ReturnType<typeof buildWarmup>) =>
  w ? [w.why, ...w.notes, ...w.phases.map((p: any) => p.instruction), ...(w.phases.flatMap((p: any) => p.movements || []))] : [];

test("the warm-up comes from the first hard effort, not the session's length", () => {
  // ⚠️ THE SPECIFICATION'S CENTRAL RULE. A 100-minute long run BEGINS easy, so its opening is the
  // warm-up; a much shorter interval session opens with a near-maximal repetition and needs a real
  // one. Sorting by duration gets this exactly backwards.
  // ⚠️ REWRITTEN 2026-08-06, KEEPING ITS INTENT. It used to assert `embedded === true` for the long run,
  // and the named-time change (2026-08-04) retired the embedded warm-up: easy and long runs now get a
  // real, short warm-up of their own rather than being told their opening minutes are it. The rule this
  // test exists for is untouched — a shorter, harder session needs MORE preparation, not less — so that
  // is what it asserts now.
  const long = buildWarmup(longRun(paces, 100), "intermediate")!;
  const reps = buildWarmup(vo2Session(paces, 1), "intermediate")!;
  assert.ok(reps.totalMinutes > long.totalMinutes * 2,
    `the shorter, harder session needs the longer warm-up (${reps.totalMinutes} vs ${long.totalMinutes})`);
  assert.ok(reps.phases.some((p: any) => p.phase === "potentiate"), "an interval session gets no strides");
  assert.ok(!long.phases.some((p: any) => p.phase === "potentiate"), "a long run does not need strides");
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

test("an easy or recovery run gets a SHORT warm-up, not an interval session's", () => {
  // ⚠️ REWRITTEN 2026-08-06. This asserted `embedded === true` and a single instruction — the design the
  // owner replaced on 2026-08-04, when easy and long runs gained a real five-minute warm-up plus
  // stretches. The intent survives exactly: an easy run must not be handed the routine an interval
  // session needs. Deleting the test would have left that unguarded; only its mechanism changed.
  for (const s of [easyRun(paces, 45), recoveryRun(paces, 30)]) {
    const w = buildWarmup(s, "intermediate")!;
    assert.ok(w.totalMinutes <= 12, `${w.totalMinutes} minutes before an easy run`);
    assert.ok(!w.phases.some((p: any) => p.phase === "potentiate"), "no strides before an easy run");
    assert.ok(!w.phases.some((p: any) => p.phase === "transition"), "no settle before a run that starts easy");
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
  // ⚠️ REWRITTEN 2026-08-06 for the same reason as the two above: `embedded` is retired, the rule is not.
  // A run whose hard block comes an hour in must not be given an interval session's preparation.
  const late = longRun(paces, 135, { steadyFinishMin: 20 } as any);
  const w = buildWarmup(late, "intermediate")!;
  assert.ok(w.totalMinutes <= 12, `got ${w.totalMinutes} minutes before a run that starts easy`);
  assert.ok(!w.phases.some((p: any) => p.phase === "potentiate"),
    "strides before a 135-minute run whose work is an hour away");
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

test("the sooner the hard work arrives, the more preparation the runner gets", () => {
  // ⚠️ REWRITTEN 2026-08-06. This was built entirely on the embedded warm-up — it asserted
  // `embedded === true` for a run that warmed itself up and `false` for one that did not — and that
  // design was retired on 2026-08-04 when easy and long runs gained a real warm-up of their own. The
  // rule worth keeping is the one underneath it, and it is the paper's: preparation is a function of
  // HOW SOON the first hard effort arrives, not of how long the session is.
  const mk = (easyMin: number) => ({
    type: "long", title: "t", intensity: "easy", estimatedDurationSeconds: 0,
    steps: [
      { kind: "warmup", label: "w", durationSeconds: 8 * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "steady", label: "easy", durationSeconds: easyMin * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "rep", label: "Threshold block", durationSeconds: 20 * 60, targetPaceSecPerKm: paces.threshold, targetRpe: { min: 6, max: 7 } },
    ],
  }) as any;
  const strides = (w: any) => (w.phases.find((p: any) => p.phase === "potentiate") || { strides: 0 }).strides;

  // Work almost immediately: the run has not warmed itself up, so it gets the full structured version.
  const immediate = buildWarmup(mk(4), "intermediate")!;
  assert.ok(immediate.totalMinutes > 15, `only ${immediate.totalMinutes} minutes before work that starts at four`);
  assert.ok(strides(immediate) >= 2, "no strides bridging into work that is minutes away");

  // Work an hour away: a short warm-up, and nothing to bridge into.
  const late = buildWarmup(mk(45), "intermediate")!;
  assert.ok(late.totalMinutes <= 12, `${late.totalMinutes} minutes before a block 57 minutes away`);
  assert.equal(strides(late), 0, "strides before a block the runner will not reach for an hour");
  assert.ok(immediate.totalMinutes > late.totalMinutes,
    "the imminent block and the distant one got the same preparation");

  // ⚠️ A brand-new runner is CAPPED HARDEST, not exempted — strides are halved for them. The old test
  // asserted zero, which was true of the embedded path it was written against and has never been true
  // of the structured one. Asserting zero here would have been inventing a rule to make a test pass.
  assert.ok(strides(buildWarmup(mk(4), "new")!) < strides(immediate),
    "a new runner got the same stride count as an intermediate");
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

test("strides are gated on when the work arrives in the SESSION AS DELIVERED, raise included", () => {
  // ⚠️ FOUND ON THE OWNER'S PHONE, 2026-08-03. "40′ easy → moderate finish" showed a warm-up card
  // saying "the quicker running starts early in this one" and prescribed 3 × 18s strides — above a
  // session whose moderate lift begins 26 minutes into a 40-minute run. `analyseSession` skips the
  // session's own warm-up step (it is the thing being replaced), so `minutesBefore` was 18 rather
  // than the 26 the runner actually experiences, and the 20-minute gate fired on the wrong number.
  //
  // ⚠️ BOTH DIRECTIONS ARE ASSERTED, and the pair was chosen by measurement, not taste: the 40′ case
  // fails on the old gate and passes on the new one, while the 20′ case passes on both. Testing only
  // the bug would be satisfied by deleting strides altogether.
  const strides = (s: any) => {
    const w = buildWarmup(s, "intermediate");
    assert.ok(w, "expected a warm-up");
    return w!.phases.filter((p: any) => p.phase === "potentiate");
  };
  const far = easyProgression(paces, 40);
  assert.equal(strides(far).length, 0,
    "a lift that arrives 26 min into a 40 min run is not something to prime with strides");
  const wFar = buildWarmup(far, "intermediate")!;
  assert.ok(!all(wFar).some((t) => /starts early|opening is short/.test(t)),
    "and the copy must not claim the quicker running starts early");

  // ⚠️ THE ANTI-OVER-CORRECTION HALF, REBUILT 2026-08-06. It used to assert that a 20-minute
  // progression keeps its strides — but a progression's lift is the aerobic gear (RPE 3-4), which
  // `firstHardEffort` now reads as "easy", so BOTH lengths correctly get none and the pair no longer
  // discriminates anything. Its job is to stop the bug above being "fixed" by deleting strides
  // altogether, so it needs a session whose work genuinely is hard and genuinely is imminent.
  const imminent = {
    type: "vo2", title: "t", intensity: "hard", estimatedDurationSeconds: 0,
    steps: [
      { kind: "warmup", label: "w", durationSeconds: 4 * 60, targetPaceSecPerKm: paces.easy, targetRpe: { min: 2, max: 3 } },
      { kind: "rep", label: "hard", durationSeconds: 12 * 60, targetPaceSecPerKm: paces.vo2, targetRpe: { min: 8, max: 9 } },
    ],
  } as any;
  assert.equal(strides(imminent).length, 1,
    "hard work minutes away still wants strides — the gate has been turned off rather than corrected");
});

test("⚠️ a run–walk beginner is warmed up by WALKING, not by running further than the session asks", () => {
  // ⚠️ The owner's question: "a warm up for someone who is just doing walk/run sessions needs to be
  // appropriate (does the research suggest brisk walk?)". It did not, and the module already knew the
  // answer — its `ability === "new"` copy is "walk briskly for 3–5 minutes, then mix a few minutes of
  // easy running with short walks". A run–walk session never reached that branch, because the gate
  // was `workSteps.length <= 1` and a run–walk has NINE work steps. Repetitions were read as
  // intensity, when in fact they exist because the runner cannot yet run continuously.
  //
  // Measured on "Long run–walk · 9 × (1′30″ run / 1′30″ walk)" before the fix: six minutes of
  // CONTINUOUS easy running as the raise plus three more to settle — nine minutes unbroken, before a
  // session that never asks for more than ninety seconds at a time — a stride at RPE 5–7 in week one,
  // and 13.3 minutes of warm-up against 13.5 minutes of running in the session itself.
  const runStep = { kind: "rep", label: "Run 1′30″ — easy, conversational", durationSeconds: 90,
    targetPaceSecPerKm: { minSecPerKm: 626, maxSecPerKm: 682 }, targetRpe: { min: 3, max: 4 } };
  const walkStep = { kind: "recovery", label: "Walk 1′30″ — recover", durationSeconds: 90,
    targetRpe: { min: 1, max: 2 } };
  const steps: any[] = [{ kind: "warmup", label: "Brisk walk to warm up", durationSeconds: 300, targetRpe: { min: 1, max: 2 } }];
  for (let i = 0; i < 9; i++) { steps.push({ ...runStep }); if (i < 8) steps.push({ ...walkStep }); }
  // ⚠️ `type: "easy"` IS LOAD-BEARING IN THIS FIXTURE, and its absence would have made the whole test
  // a decoration. Every session in a real run–walk plan is typed "easy" — assembleRunWalk's single
  // exit — and the no-warm-up rule added on 2026-08-07 keys on exactly that type. Built without the
  // field, this fixture would have sailed through the gate while every real run–walk session in a
  // beginner's plan lost the brisk walk the test exists to protect: green suite, feature gone, and
  // the runner least able to tell that the app had got it wrong sent from standing into a 90-second
  // running repetition. That is the guard-blind-to-the-new-input trap, and it is the sixth time.
  const sess: any = { type: "easy", steps, targetRpe: { min: 2, max: 4 } };

  const w = buildWarmup(sess, "new")!;
  assert.ok(!w.notNeeded,
    "a run–walk beginner was swept up by the low-intensity no-warm-up rule — their sessions are typed \"easy\" too");
  const raise: any = w.phases.find((p: any) => p.phase === "raise");
  assert.ok(raise, "no raise phase");
  assert.match(raise.instruction, /[Ww]alk brisk/, `a run–walk beginner is told: "${raise.instruction}"`);
  // ⚠️ AND THE STEP'S OWN LABEL, which is what they read mid-session. "Warm up easy" is the opposite
  // instruction, on the screen they are looking at while doing it.
  assert.ok(raise.title && /walk/i.test(raise.title), `the raise is labelled "${raise.title}"`);
  assert.ok(!w.phases.some((p: any) => p.phase === "potentiate"),
    "a run–walk beginner is given strides — RPE 5–7 accelerations in their first weeks of running");
  // The paper's §8: a novice's warm-up must not become their first workout.
  const sessionMin = steps.filter((s) => s.kind === "rep").reduce((a, s) => a + s.durationSeconds, 0) / 60;
  assert.ok(w.totalMinutes <= sessionMin,
    `${w.totalMinutes} min of warm-up for ${sessionMin} min of running — the warm-up IS the workout`);
});

test("⚠️ but a real interval session is NOT mistaken for gentle repetitions", () => {
  // ⚠️ The first cut of the fix above read a missing step RPE as zero — and quality reps carry no
  // step-level band, a threshold session probes at the SESSION's 6–7 — so every tempo and interval
  // session counted as "gentle" and would have been handed a beginner's brisk-walk warm-up with no
  // strides. Caught by the two ability/readiness tests above on the first run. Unknown must fail
  // toward the FULLER warm-up, never the smaller one.
  for (const s of [thresholdSession(paces, 1), vo2Session(paces, 1)]) {
    const w = buildWarmup(s, "intermediate")!;
    const raise: any = w.phases.find((p: any) => p.phase === "raise");
    assert.ok(!/[Ww]alk brisk/.test(raise.instruction),
      `"${(s as any).title}" is being warmed up by walking`);
    assert.ok(w.phases.some((p: any) => p.phase === "potentiate"),
      `"${(s as any).title}" lost its strides — it opens with real work and needs them`);
  }
});
