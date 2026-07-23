// Runnable demo: build a plan for the brief's example athlete (a runner returning from a cartilage
// injury, chasing a sub-1:30 half marathon) and print it. Run with:  node demo/generate.ts
//
// Everything here is deterministic — the same inputs always produce the same plan.

import type { Athlete, Goal, PaceRange, PlannedWeek } from "../src/domain/types.ts";
import { applyMissedSessionAdjustment } from "../src/adapt/missed-sessions.ts";
import { assessFeasibility } from "../src/plan/feasibility.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { detectAchievements } from "../src/progress/achievements.ts";
import { formatDuration, formatPace, metresToKm } from "../src/domain/units.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const athlete: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 }, // 21:00 5k while returning to fitness
  experience: "competitive",
  includeStrength: true,
  returningFromInjury: true,
  maxHr: 190,
  restingHr: 48,
};

const goal: Goal = {
  distance: "half",
  targetTimeSeconds: 5400, // 1:30:00
  raceDateIso: "2027-09-05",
  startDateIso: "2026-07-23",
};

function pace(r: PaceRange): string {
  return `${formatDuration(r.minSecPerKm)}–${formatDuration(r.maxSecPerKm)}/km`;
}

function line(s = ""): void {
  process.stdout.write(`${s}\n`);
}

function h(title: string): void {
  line();
  line(`━━ ${title} ${"━".repeat(Math.max(0, 58 - title.length))}`);
}

// ---- Feasibility ----------------------------------------------------------
h("GOAL FEASIBILITY");
const fa = assessFeasibility(athlete, goal);
line(`Goal:    Half marathon in ${formatDuration(goal.targetTimeSeconds)} by ${goal.raceDateIso}`);
line(`Verdict: ${fa.verdict.toUpperCase()}  (${fa.weeksAvailable} weeks available)`);
line(
  `Current fitness predicts ${formatDuration(fa.currentPredictedSeconds)}; target needs ${fa.requiredImprovementPct}% improvement.`,
);
for (const r of fa.rationale) line(`  • ${r}`);

// ---- Plan -----------------------------------------------------------------
const plan = generatePlan(athlete, goal);

h("TRAINING PACES (from current fitness)");
line(`Easy:      ${pace(plan.paces.easy)}      (RPE 2–3, conversational)`);
line(`Steady:    ${pace(plan.paces.steady)}`);
line(`Threshold: ${pace(plan.paces.threshold)}      (RPE 6–7)`);
line(`VO2:       ${pace(plan.paces.vo2)}      (RPE 8–9)`);
line(`Reps:      ${pace(plan.paces.rep)}`);
line(`Goal pace: ${pace(plan.paces.goalRace)}`);
if (plan.paces.hrZones) {
  const z = plan.paces.hrZones;
  line(
    `HR zones:  Z2 ${z[1]!.minBpm}-${z[1]!.maxBpm}  Z4 ${z[3]!.minBpm}-${z[3]!.maxBpm}  Z5 ${z[4]!.minBpm}-${z[4]!.maxBpm} bpm (secondary anchor)`,
  );
}
line();
line("Predicted equivalent race times at current fitness:");
line(
  `  1mi ${formatDuration(plan.paces.predictedRaceTimes["1mile"])}  ·  5k ${formatDuration(plan.paces.predictedRaceTimes["5k"])}  ·  10k ${formatDuration(plan.paces.predictedRaceTimes["10k"])}  ·  HM ${formatDuration(plan.paces.predictedRaceTimes.half)}  ·  M ${formatDuration(plan.paces.predictedRaceTimes.marathon)}`,
);

h("PLAN OVERVIEW");
line(
  `Intensity model: ${plan.intensityModel}   ·   Structured weeks: ${plan.weeks.length} (of ${plan.totalWeeks} until race)`,
);
const phaseCounts = plan.weeks.reduce<Record<string, number>>(
  (m, w) => ((m[w.phase] = (m[w.phase] ?? 0) + 1), m),
  {},
);
line(
  `Phases: ${Object.entries(phaseCounts)
    .map(([p, n]) => `${p} ${n}`)
    .join("  ·  ")}`,
);
line();
for (const n of plan.notes) line(`  • ${n}`);

h("WEEK-BY-WEEK SUMMARY");
line("Wk  Start        Phase   Deload  Quality  LongRun  ~Distance");
for (const w of plan.weeks) {
  const long = w.sessions.find((s) => s.type === "long")!;
  line(
    `${String(w.index).padStart(2)}  ${w.startDateIso}  ${w.phase.padEnd(6)}  ${(w.isDeload ? "yes" : "").padEnd(6)}  ${String(w.qualitySessionCount).padStart(4)}     ${String(Math.round(long.estimatedDurationSeconds / 60)).padStart(4)}′   ${metresToKm(w.plannedDistanceMeters).toFixed(1).padStart(5)} km`,
  );
}

function detailWeek(w: PlannedWeek): void {
  h(`WEEK ${w.index} DETAIL — ${w.phase.toUpperCase()} — ${w.focus}`);
  for (const s of w.sessions) {
    if (s.type === "rest") {
      line(`${DAYS[s.dayOfWeek]}  Rest`);
      continue;
    }
    const dur = s.estimatedDurationSeconds ? `${Math.round(s.estimatedDurationSeconds / 60)}′` : "";
    const dist = s.estimatedDistanceMeters
      ? ` ~${metresToKm(s.estimatedDistanceMeters).toFixed(1)}km`
      : "";
    const rpe = s.targetRpe ? ` [RPE ${s.targetRpe.min}-${s.targetRpe.max}]` : "";
    line(`${DAYS[s.dayOfWeek]}  ${s.title}  (${dur}${dist})${rpe}`);
    if (s.type === "threshold" || s.type === "vo2" || s.type === "race-specific") {
      const paceStep = s.steps.find(
        (st) => st.kind === "rep" || (st.kind === "steady" && st.targetPaceSecPerKm),
      );
      if (paceStep?.targetPaceSecPerKm) {
        line(
          `       target ${formatPace(paceStep.targetPaceSecPerKm.minSecPerKm)}–${formatPace(paceStep.targetPaceSecPerKm.maxSecPerKm)}`,
        );
      }
    }
  }
}

const sampleBuild = plan.weeks.find(
  (w) => w.phase === "build" && !w.isDeload && w.qualitySessionCount >= 2,
);
if (sampleBuild) detailWeek(sampleBuild);
detailWeek(plan.weeks.at(-1)!);

// ---- Adaptation demo ------------------------------------------------------
h("ADAPTATION — TWO MISSED SESSIONS IN A ROW");
if (sampleBuild) {
  const res = applyMissedSessionAdjustment(sampleBuild, [
    { sessionId: "x", dateIso: "2026-11-01", completed: false },
    { sessionId: "y", dateIso: "2026-11-03", completed: false },
  ]);
  line(`Triggered: ${res.triggered}`);
  for (const c of res.changes) line(`  • ${c}`);
  line(
    `Volume ${metresToKm(sampleBuild.plannedDistanceMeters).toFixed(1)}km → ${metresToKm(res.week.plannedDistanceMeters).toFixed(1)}km  (missed work is NOT crammed back in)`,
  );
}

// ---- Achievements demo ----------------------------------------------------
h("ACHIEVEMENTS — PBs FROM A 10K RUN");
const tenK = {
  id: "run-42",
  dateIso: "2026-08-02",
  distanceMeters: 10000,
  movingTimeSeconds: 2400,
  splits: Array.from({ length: 10 }, () => ({ distanceMeters: 1000, timeSeconds: 240 })),
};
const { achievements } = detectAchievements([tenK], { "fastest-5k": 1260 });
for (const a of achievements) {
  const val = a.valueSeconds
    ? formatDuration(a.valueSeconds)
    : `${metresToKm(a.valueMeters ?? 0).toFixed(1)}km`;
  line(`  🏅 ${a.kind}: ${val}`);
}
line();
