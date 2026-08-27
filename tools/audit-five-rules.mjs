// Audits the engine against the five rules of the commissioned programme-engine handoff
// (INTERUNENGINEHANDOFF.md §0). Each rule is measured over real generated plans rather than
// reasoned about, because every one of them is silently violable: nothing throws when a week
// carries too much hard running or climbs too fast, and a plan that breaches a rule looks
// exactly like one that does not.
//
// ⚠️ MEASURED IN MINUTES, NOT KILOMETRES — that is rule 5, and it changes the answer. The same
// week measured both ways gives 1.70% of transitions over the 1.30 ceiling in minutes and 2.54%
// in km, because a hill-sprint session covers almost no ground for its 39 minutes of work.
//
// Usage: node tools/audit-five-rules.mjs [repoRoot]
import { generatePlan } from "../src/plan/generate-plan.ts";
import { computeDistribution } from "../src/science/intensity-distribution.ts";

const RUN_TYPES = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const EFFORT_ONLY_MPS = 4;   // a hill sprint carries no pace on purpose; the engine's own figure

/** Training minutes in a week: the currency rule 5 says load lives in. Preparation excluded. */
function weekMinutes(week) {
  let sec = 0;
  for (const s of week.sessions) {
    if (!RUN_TYPES.has(s.type)) continue;
    const steps = s.steps ?? [];
    if (!steps.length) { sec += s.estimatedDurationSeconds; continue; }
    for (const st of steps) {
      if (st.kind === "warmup" || st.kind === "cooldown") continue;
      if (st.durationSeconds) { sec += st.durationSeconds; continue; }
      if (st.distanceMeters && st.targetPaceSecPerKm) {
        const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
        sec += (st.distanceMeters / 1000) * mid; continue;
      }
      if (st.distanceMeters) sec += st.distanceMeters / EFFORT_ONLY_MPS;
    }
  }
  return sec / 60;
}

const RACE_M = { "5k": 5000, "10k": 10000, half: 21097, marathon: 42195 };

/** Race date `weeks` after `startIso`, in UTC — the plan's length is set by this and nothing else. */
function isoPlusWeeks(startIso, weeks) {
  const d = new Date(startIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7 - 1);
  return d.toISOString().slice(0, 10);
}
let skipped = 0;

function* profiles() {
  for (const distance of ["5k", "10k", "half", "marathon"])
    for (const daysPerWeek of [3, 4, 5, 6])
      for (const t of [900, 1200, 1500, 1800, 2100, 2400])
        for (const weeks of [12, 16, 20, 24, 36])
          for (const experience of ["recreational", "competitive"])
            yield { distance, daysPerWeek, t, weeks, experience };
}

const A = {
  plans: 0, weeks: 0,
  // rule 2
  r2weeks: 0, under75: 0, under80: 0, worstEasy: 1, worstEasyWho: "",
  // rule 3
  r3trans: 0, over130: 0, worst130: 0, worst130Who: "",
  r3blocks: 0, blockOver130: 0,
  // rule 5 — the load a stated kilometrage really buys, across abilities
  byAbility: new Map(),
};

for (const p of profiles()) {
  const athlete = {
    experience: p.experience, daysPerWeek: p.daysPerWeek,
    recent: { distanceMeters: 5000, timeSeconds: p.t },
    ageYears: 35, weeklyVolumeKmCurrent: 40,
  };
  // ⚠️ THE RUNWAY IS THE RACE DATE, AND THERE IS NO `weeks` OPTION. `GenerateOptions` is
  // `{ intensityModel?, startDateIso? }` — nothing else — so a probe passing `{ weeks: 16 }` has it
  // silently ignored and measures whatever runway the race date happens to give. Written that way
  // this sweep's five runway values all produced the SAME 40-week plan, so a fifth of the grid was
  // real and the other four fifths were duplicates; the tell was every runway reporting an
  // identical breach count. Set the date from the runway, and assert the plan came back the length
  // that was asked for.
  const start = "2026-09-07";                       // a Monday, so weeks align without a pro-rata first
  const raceDate = isoPlusWeeks(start, p.weeks);
  const goal = {
    distance: p.distance,
    targetTimeSeconds: p.t * Math.pow(RACE_M[p.distance] / 5000, 1.06),
    raceDateIso: raceDate,
    startDateIso: start,
  };
  let plan;
  try { plan = generatePlan(athlete, goal, { startDateIso: start }); }
  catch { continue; }
  if (Math.abs(plan.totalWeeks - p.weeks) > 1) { skipped++; continue; }
  A.plans++;
  const who = `${p.distance} ${p.daysPerWeek}d ${(p.t / 60).toFixed(0)}min5k ${p.experience} ${p.weeks}wk`;
  // ⚠️ NO `isPartial` FILTER, BECAUSE THERE IS NO SUCH FIELD. `PlannedWeek` carries index,
  // startDateIso, phase, isDeload, focus, sessions, plannedDistanceMeters and qualitySessionCount —
  // and nothing else. An earlier version of this tool filtered on `!w.isPartial`, which is
  // `!undefined` and therefore filtered NOTHING; a .mjs probe has no typechecking to catch it. The
  // protection is the Monday start above: `applyPartialFirstWeek` trims week 1 before the start
  // date, and a start that IS the week's Monday leaves nothing to trim.
  const full = plan.weeks;
  const mins = full.map(weekMinutes);
  A.weeks += full.length;

  // RULE 2 — at least 75% of every week's minutes easy. Race week is exempt by design: it holds a
  // maximal effort over the race distance, which the engine's own intensity sweep also skips.
  full.forEach((w, i) => {
    if (w.phase === "taper") return;
    const d = computeDistribution(w.sessions);
    if (!d || !Number.isFinite(d.easy) || d.totalSeconds === 0) return;
    A.r2weeks++;
    if (d.easy < 0.80) A.under80++;
    if (d.easy < 0.75) A.under75++;
    if (d.easy < A.worstEasy) { A.worstEasy = d.easy; A.worstEasyWho = `${who} week${w.index} ${w.phase}`; }
  });

  // RULE 3 — no week above 1.30x the trailing four-week mean; no block mean above 1.30x the last.
  // A deload is deliberately smaller, and the week after one is climbing back to where it was
  // rather than progressing, so neither end of that pair is a transition worth judging.
  for (let i = 1; i < full.length; i++) {
    if (full[i].isDeload || full[i - 1].isDeload || full[i].phase === "taper") continue;
    // ⚠️ A FULL FOUR-WEEK WINDOW, OR THE MEASUREMENT IS OF SOMETHING ELSE. The rule is about the
    // ATHLETE's trailing four-week mean, i.e. their real history. Inside a freshly generated plan
    // weeks 1-3 have no such history, so a window taken there is one or two of the plan's own
    // opening weeks — and a plan legitimately climbs away from a pro-rata first week. Measured with
    // short windows allowed the worst case was 1.897x at WEEK 2, which is the instrument, not the
    // engine: it compared week 2 against week 1 alone and called the ordinary opening ramp a breach.
    if (i < 4) continue;
    const win = mins.slice(i - 4, i);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    if (mean <= 0) continue;
    A.r3trans++;
    const r = mins[i] / mean;
    if (r > 1.30) A.over130++;
    if (r > A.worst130) {
      A.worst130 = r;
      A.worst130Who = `${who} week${full[i].index}: trailing mean ${mean.toFixed(0)} -> ${mins[i].toFixed(0)} min`;
    }
  }
  for (let b = 4; b + 4 <= mins.length; b += 4) {
    const prev = mins.slice(b - 4, b).reduce((a, c) => a + c, 0) / 4;
    const cur = mins.slice(b, b + 4).reduce((a, c) => a + c, 0) / 4;
    if (prev <= 0) continue;
    A.r3blocks++;
    if (cur / prev > 1.30) A.blockOver130++;
  }

  // RULE 5 — one stated kilometrage, six abilities. If load lived in minutes this column would be
  // flat; if it lives in kilometres it spreads with pace, and the slowest runner is handed the
  // biggest training load of anyone who answered the same question.
  if (p.distance === "half" && p.daysPerWeek === 5 && p.weeks === 20 && p.experience === "recreational") {
    const peak = Math.max(...mins.filter((_, i) => full[i].phase !== "taper"));
    A.byAbility.set(p.t, peak);
  }
}

const pc = (n, d) => (d ? `${String(n).padStart(5)} of ${d}  (${(100 * n / d).toFixed(2)}%)` : "n/a");
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

console.log(`\nFIVE-RULE AUDIT — ${A.plans} plans, ${A.weeks} weeks` + (skipped ? `  (${skipped} profiles skipped: the engine returned a runway that was not asked for)` : "") + `\n`);
console.log("RULE 1  zones anchored to critical speed, never %HRmax");
console.log("        not measurable here — see test/five-rules.test.ts, which asserts the ratio");
console.log("        algebra and that no pace is derived from a heart rate.\n");
console.log("RULE 2  at least 75% of every week's minutes easy   (race week exempt)");
console.log(`        weeks under 75% easy : ${pc(A.under75, A.r2weeks)}`);
console.log(`        weeks under 80% easy : ${pc(A.under80, A.r2weeks)}`);
console.log(`        worst week           : ${(100 * A.worstEasy).toFixed(1)}%  ${A.worstEasyWho}\n`);
console.log("RULE 3  no week above 1.30x the trailing four-week mean, in minutes");
console.log(`        transitions over 1.30 : ${pc(A.over130, A.r3trans)}`);
console.log(`        worst                 : ${A.worst130.toFixed(3)}x  ${A.worst130Who}`);
console.log(`        block means over 1.30 : ${pc(A.blockOver130, A.r3blocks)}\n`);
console.log("RULE 4  the readiness loop has no write path to the fitness anchor");
console.log("        not measurable here — see test/five-rules.test.ts, which asserts the");
console.log("        ReadinessResult type carries no pace, band or anchor field.\n");
console.log("RULE 5  load is computed in running minutes, not kilometres");
if (A.byAbility.size > 1) {
  const rows = [...A.byAbility.entries()].sort((a, b) => a[0] - b[0]);
  console.log("        one stated 40 km/week, half marathon, 5 days, 20 weeks:");
  for (const [t, m] of rows) console.log(`          ${mmss(t)} 5k -> peak week ${m.toFixed(0)} training minutes`);
  const vals = rows.map((r) => r[1]);
  console.log(`        spread across abilities: ${(Math.max(...vals) / Math.min(...vals)).toFixed(2)}x`);
}
console.log("");
