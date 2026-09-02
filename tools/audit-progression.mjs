// The progression audit, v2 — rebuilt after the first instrument proved wrong.
//
// ⚠️ THREE FAULTS IN THE FIRST VERSION, all found by probing one plan by hand rather than trusting the
// totals. Any one of them would have produced a confident, wrong report:
//   1. Hard minutes were read from STEP-level targetRpe. Quality reps do not carry one — a threshold
//      session probed at "max RPE 3" and a VO2 session at "RPE 3" — so intensity read ~2% everywhere and
//      the taper read 0.0%. The engine's own computeDistribution is the tested definition; use it.
//   2. Race-pace seconds charged the WHOLE race-specific session, so "15′ easy → 20′ at goal pace →
//      10′ threshold" counted 70 minutes of race pace instead of 20.
//   3. The PARTIAL FIRST WEEK was included in the frequency and volume trends. It has fewer sessions by
//      construction, so every plan appeared to "rise" from it and week 1 → 2 was a false volume spike.
const root = process.argv[2] || process.cwd();
const { generatePlan } = await import(root + "/src/plan/generate-plan.ts");
const { computeDistribution, honoursModel } = await import(root + "/src/science/intensity-distribution.ts");

const RUN_TYPES = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const isRun = (s) => RUN_TYPES.has(s.type);
const PREP = new Set(["warmup", "cooldown", "recovery"]);
// ⚠️⚠️ GATE-AGNOSTIC, AND THE FIRST VERSION WAS BLIND TO THE VERY CHANGE THIS TOOL WOULD MEASURE. It
// read `a + (st.durationSeconds || 0)` with an `|| estimatedDurationSeconds` fallback — so a step that
// carries a DISTANCE and no duration contributed nothing, and the fallback only fired when the whole sum
// was zero. A session with a distance-gated body and a timed warm-up would therefore have reported only
// the warm-up's seconds, and prescribing runs by distance would have looked like a large drop in
// training time that had not happened. Same shape as this file's own three original faults: an
// instrument that cannot see the thing it is pointed at. It now derives a distance-gated step exactly as
// the engine's own stepSeconds does (src/science/intensity-distribution.ts) — distance over the mid-band
// pace, with the effort-only hill-sprint fallback — so the ruler is the same before and after.
const EFFORT_ONLY_MPS = 4;
const stepSecs = (st) => {
  if (st.durationSeconds) return st.durationSeconds;
  if (st.distanceMeters && st.targetPaceSecPerKm) {
    const p = st.targetPaceSecPerKm;
    return (st.distanceMeters / 1000) * (p.minSecPerKm + p.maxSecPerKm) / 2;
  }
  if (st.distanceMeters) return st.distanceMeters / EFFORT_ONLY_MPS;
  return 0;
};
const secs = (s) => (s.steps || []).reduce((a, st) => a + stepSecs(st), 0) || (s.estimatedDurationSeconds || 0);
// Race-pace REHEARSAL: work steps only (never the warm-up or the jog recoveries), either inside a
// race-specific session or labelled as goal-pace work wherever it lives — a marathon long run's
// race-pace block counts, which is the whole point of the specificity question.
const raceSecs = (s) => (s.steps || []).reduce((a, st) => {
  if (PREP.has(st.kind)) return a;
  const lab = st.label || "";
  const isRace = s.type === "race-specific" || /race pace|goal pace|race effort|goal effort|marathon effort|marathon pace/i.test(lab);
  return a + (isRace ? stepSecs(st) : 0);
}, 0);

const TT = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
const RUNWAYS = [["short", "2026-11-01"], ["normal", "2027-01-10"], ["long", "2027-03-07"], ["year", "2027-07-25"]];
const START = "2026-08-03";
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pc = (a, b) => b ? ((a / b) * 100).toFixed(1) + "%" : "n/a";
const p2 = (x) => (x * 100).toFixed(1) + "%";

const BY = {};
const bucket = (d) => (BY[d] ||= { hard:{base:[],build:[],peak:[],taper:[]}, mod:{base:[],build:[],peak:[],taper:[]}, rs:{base:[],build:[],peak:[],taper:[]}, over110:0, trans:0, deload:[], inv:0, invTot:0 });
const A = {
  plans: 0, weeks: 0,
  freqPlans: 0, freqRises: 0, freqFlat: 0, freqJump2: 0,
  volPlans: 0, volOver110: 0, volTrans: 0, volPeakOk: 0, worstJump: 0, volOver110Min: 0, worstJumpMin: 0, worstJumpMinWho: "", worstJumpWho: "",
  hard: { base: [], build: [], peak: [], taper: [] },
  mod: { base: [], build: [], peak: [], taper: [] },
  intensityRises: 0, intensityPlans: 0, underFloor: 0,
  rs: { base: [], build: [], peak: [], taper: [] },
  rsNoneInPeak: 0, rsRises: 0,
  deloadDepth: [], deloadGap: [], noDeload: 0, taperCut: [],
  longInv: 0, longTot: 0,
  noPeakRs: [],
};

for (const [runway, raceDate] of RUNWAYS)
for (const distance of ["5k", "10k", "half", "marathon"])
for (const days of [3, 4, 5, 6])
for (const tenK of [2400, 3000, 3600])
for (const experience of ["recreational", "competitive"])
// ⚠️ 30 IS IN THIS LIST BECAUSE WITHOUT IT THE AUDIT IS BLIND TO THE TIER-3 RECOVERY-WEEK RULE.
// `schedulesRecoveryWeeks` fires only on a STATED volume at or under 35 km with 4 or fewer running
// days; `null` means the runner never answered (which keeps the recovery weeks) and 40 is above the
// ceiling, so with `[null, 40]` alone this tool reported the whole change as byte-identical. An
// instrument that cannot see the thing it is pointed at reports "no effect" and is believed.
for (const vol of [null, 30, 40]) {
  const athlete = { daysPerWeek: days, recent: { distanceMeters: 10000, timeSeconds: tenK },
    experience, includeStrength: false, returningFromInjury: false, ...(vol ? { weeklyVolumeKmCurrent: vol } : {}) };
  let p;
  try { p = generatePlan(athlete, { distance, targetTimeSeconds: TT[distance], raceDateIso: raceDate, startDateIso: START }); }
  catch { continue; }
  A.plans++;
  const who = `${runway}/${distance}/${days}d/${tenK / 60}min/${experience}/vol=${vol}`;
  // ⚠️ Drop the partial first week AND race week from every trend. Both are fragments by construction.
  const full = p.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
  if (full.length < 4) continue;

  // FREQUENCY
  const freq = full.map((w) => w.sessions.filter(isRun).length);
  A.freqPlans++;
  if (freq[freq.length - 1] > freq[0]) A.freqRises++; else A.freqFlat++;
  for (let i = 1; i < freq.length; i++) if (freq[i] - freq[i - 1] >= 2) A.freqJump2++;

  // VOLUME - measured on BOTH rulers, because they disagree and only one of them is the plan.
  // ⚠️ THIS SECTION USED TO BE HEADED "TIME" AND MEASURED KILOMETRES ONLY. That is the
  // instrument-cannot-see-what-it-is-pointed-at trap this tool has already been bitten by three
  // times, and it matters here more than anywhere: the plan is BUILT in minutes and DISPLAYED in
  // kilometres, and a hill-sprint session covers almost no ground for 39 minutes of work. So a
  // change that makes the quality rotation denser moves the km figure a long way while the training
  // load does not move at all. Measured once already (CLAUDE.md, the volume-smoothing work): rises
  // above the guardrail were 15.7% on counted distance against 6.1% on training time.
  // Read the MINUTES figure to judge the training. Read the KM figure to judge what the runner sees.
  const km = full.map((w) => w.plannedDistanceMeters / 1000);
  const mins = full.map((w) => w.sessions.reduce((t, x) => t + (x.estimatedDurationSeconds || 0), 0) / 60);
  A.volPlans++;
  const pk = km.indexOf(Math.max(...km));
  if (["peak", "build"].includes(full[pk].phase)) A.volPeakOk++;
  for (let i = 1; i < km.length; i++) {
    if (full[i].isDeload || full[i - 1].isDeload || full[i].phase === "taper") continue;
    A.volTrans++;
    const r = km[i - 1] > 0 ? km[i] / km[i - 1] : 1;
    if (r > 1.10) A.volOver110++;
    const rm = mins[i - 1] > 0 ? mins[i] / mins[i - 1] : 1;
    if (rm > 1.10) A.volOver110Min++;
    if (rm > A.worstJumpMin) { A.worstJumpMin = rm; A.worstJumpMinWho = who + ` wk${full[i].index} ${mins[i - 1].toFixed(0)}→${mins[i].toFixed(0)}min`; }
    bucket(distance).trans++; if (r > 1.10) bucket(distance).over110++;
    if (r > A.worstJump) { A.worstJump = r; A.worstJumpWho = who + ` wk${full[i].index} ${km[i - 1].toFixed(1)}→${km[i].toFixed(1)}km`; }
  }

  // INTENSITY + SPECIFICITY, per week, using the engine's own bucketing
  const perPhase = { base: [], build: [], peak: [], taper: [] };
  const rsPhase = { base: [], build: [], peak: [], taper: [] };
  for (const w of full) {
    A.weeks++;
    const d = computeDistribution(w.sessions);
    if (d && Number.isFinite(d.easy)) {
      if (!honoursModel(d, p.intensityModel)) A.underFloor++;
      A.hard[w.phase].push(d.hard); A.mod[w.phase].push(d.moderate);
      bucket(distance).hard[w.phase].push(d.hard); bucket(distance).mod[w.phase].push(d.moderate);
      perPhase[w.phase].push(d.hard + d.moderate);
    }
    const runs = w.sessions.filter(isRun);
    const tot = runs.reduce((a, s) => a + secs(s), 0);
    const rf = tot ? runs.reduce((a, s) => a + raceSecs(s), 0) / tot : 0;
    A.rs[w.phase].push(rf); rsPhase[w.phase].push(rf); bucket(distance).rs[w.phase].push(rf);

    const long = w.sessions.find((s) => s.type === "long");
    if (long) {
      const others = w.sessions.filter((s) => s !== long && isRun(s));
      if (others.length) {
        A.longTot++;
        const lk = long.trainingDistanceMeters ?? long.estimatedDistanceMeters ?? 0;
        bucket(distance).invTot++;
        if (Math.max(...others.map((s) => s.trainingDistanceMeters ?? s.estimatedDistanceMeters ?? 0)) > lk) { A.longInv++; bucket(distance).inv++; }
      }
    }
  }
  A.intensityPlans++;
  const qBase = mean(perPhase.base), qPeak = mean(perPhase.peak.length ? perPhase.peak : perPhase.build);
  if (qPeak > qBase * 1.05) A.intensityRises++;
  const rB = mean(rsPhase.base), rP = mean(rsPhase.peak.length ? rsPhase.peak : rsPhase.build);
  if (rP === 0) { A.rsNoneInPeak++; A.noPeakRs.push(who); }
  else if (rP > rB * 1.05) A.rsRises++;

  // REVERSIBILITY
  const dl = full.map((w, i) => w.isDeload ? i : -1).filter((i) => i > 0);
  if (!dl.length) A.noDeload++;
  for (const i of dl) if (km[i - 1] > 0) { A.deloadDepth.push(1 - km[i] / km[i - 1]); bucket(distance).deload.push(1 - km[i] / km[i - 1]); }
  for (let i = 1; i < dl.length; i++) A.deloadGap.push(dl[i] - dl[i - 1]);
  const tw = p.weeks.filter((w) => w.phase === "taper");
  if (tw.length) {
    const lastFull = tw.length > 1 ? tw[tw.length - 2] : tw[0];
    const peakKm = Math.max(...km);
    if (peakKm > 0) A.taperCut.push(1 - (lastFull.plannedDistanceMeters / 1000) / peakKm);
  }
}

console.log("PLANS " + A.plans + "   WEEKS " + A.weeks + "   (partial first week and race week excluded from every trend)");
console.log("\n── FREQUENCY — runs per week ──────────────────────────────");
console.log("  plans where running days rise across the block  : " + pc(A.freqRises, A.freqPlans));
console.log("  plans where it is completely flat               : " + pc(A.freqFlat, A.freqPlans));
console.log("  jumps of 2+ running days in a week             : " + A.freqJump2);
console.log("\n── VOLUME — weekly load, on both rulers ───────────────────");
console.log("  biggest week sits in build/peak                 : " + pc(A.volPeakOk, A.volPlans));
console.log("  rises >1.10 on TRAINING TIME  (the plan)        : " + pc(A.volOver110Min, A.volTrans) +
  "   (" + A.volOver110Min + "/" + A.volTrans + ")");
console.log("  rises >1.10 on COUNTED KM     (what is shown)   : " + pc(A.volOver110, A.volTrans) +
  "   (" + A.volOver110 + "/" + A.volTrans + ")");
console.log("  worst single jump, minutes                      : " + A.worstJumpMin.toFixed(2) + "x  " + A.worstJumpMinWho);
console.log("  worst single jump, km                           : " + A.worstJump.toFixed(2) + "x  " + A.worstJumpWho);
console.log("\n── INTENSITY — share of running time above easy ───────────");
for (const ph of ["base", "build", "peak", "taper"])
  console.log("  " + ph.padEnd(6) + " hard " + p2(mean(A.hard[ph])).padStart(6) + "   moderate " + p2(mean(A.mod[ph])).padStart(6) +
    "   (n=" + A.hard[ph].length + ")");
console.log("  plans where peak intensity exceeds base by >5%  : " + pc(A.intensityRises, A.intensityPlans));
console.log("  weeks under the pyramidal/polarized floor       : " + A.underFloor + " of " + A.weeks);
console.log("\n── TYPE / SPECIFICITY — race-pace rehearsal ───────────────");
for (const ph of ["base", "build", "peak", "taper"])
  console.log("  " + ph.padEnd(6) + " race-pace share " + p2(mean(A.rs[ph])).padStart(6) + "   (n=" + A.rs[ph].length + ")");
console.log("  plans with NO race-pace rehearsal near the race : " + pc(A.rsNoneInPeak, A.volPlans));
console.log("  plans where race-pace share rises toward it     : " + pc(A.rsRises, A.volPlans));
console.log("\n── REVERSIBILITY — deloads and the taper ──────────────────");
console.log("  plans with no deload at all                     : " + pc(A.noDeload, A.volPlans));
console.log("  mean deload depth vs the week before            : " + p2(mean(A.deloadDepth)) + "   (n=" + A.deloadDepth.length + ")");
console.log("  mean weeks between deloads                      : " + mean(A.deloadGap).toFixed(1));
console.log("  taper cut, last full taper week vs peak         : mean " + p2(mean(A.taperCut)) +
  "  min " + p2(Math.min(...A.taperCut)) + "  max " + p2(Math.max(...A.taperCut)));
console.log("\n── STRUCTURE ──────────────────────────────────────────────");
console.log("  long run NOT the longest run of its week        : " + pc(A.longInv, A.longTot));
if (A.noPeakRs.length) {
  console.log("\n  plans with no race-pace rehearsal near the race (first 10):");
  A.noPeakRs.slice(0, 10).forEach((w) => console.log("    " + w));
  console.log("    ... " + A.noPeakRs.length + " in total");
}

console.log("\n── BY DISTANCE ────────────────────────────────────────────");
console.log("  dist      hard b→p        moderate b→p     race-pace b→bu→pk        >1.10   deload   longInv");
for (const d of ["5k","10k","half","marathon"]) {
  const b = BY[d]; if (!b) continue;
  console.log("  " + d.padEnd(9) +
    (p2(mean(b.hard.base)) + "→" + p2(mean(b.hard.peak))).padEnd(15) +
    (p2(mean(b.mod.base)) + "→" + p2(mean(b.mod.peak))).padEnd(17) +
    (p2(mean(b.rs.base)) + "→" + p2(mean(b.rs.build)) + "→" + p2(mean(b.rs.peak))).padEnd(24) +
    pc(b.over110, b.trans).padEnd(8) + p2(mean(b.deload)).padEnd(9) + pc(b.inv, b.invTot));
}
