import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { generatePlan } from "./src/plan/generate-plan.ts";
import { buildWarmup } from "./src/science/warmup.ts";
import { deriveTrainingPaces } from "./src/science/paces.ts";

const html = readFileSync(new URL("./web/app.html", import.meta.url), "utf8");
function lift(name: string) {
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced " + name);
}
const NAMES = ["isRunWalkShape", "isStrideStep", "withGeneratedWarmup", "plannedPaceBandOf",
  "plannedRpeBandOf", "runAnalysis", "splitsVsTargetHtml", "debriefParagraphs", "esc", "fmtPace",
  "fmtSec", "spanText", "workLabel", "stepTargetText", "stepChips", "structureRows", "sessionStepText"];
const M: any = new Function("warmupCardFor", "PACE_MODEL_VERSION",
  NAMES.map(lift).join(";\n") + "; return {" + NAMES.join(",") + "};")(
    (s: any) => buildWarmup(s, "intermediate"), "1.0.0");
const strip = (x: any) => String(x).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const athlete: any = {
  daysPerWeek: 5, experience: "intermediate", status: "recreational", includeStrength: false,
  recent: { distanceMeters: 5000, timeSeconds: 20 * 60 },
};
const goal: any = { distance: "half", targetTimeSeconds: 95 * 60, raceDateIso: "2027-01-10", startDateIso: "2026-08-10" };
const plan = generatePlan(athlete, goal, {} as any);
const paces = deriveTrainingPaces(athlete.recent, goal);

const mid = (b: any) => (b.minSecPerKm + b.maxSecPerKm) / 2;

/** Simulate a runner executing every step exactly at the middle of its prescribed pace. */
function simulate(delivered: any) {
  const splits: { km: number; sec: number }[] = [];
  let dist = 0, t = 0, kmDone = 0, lastKmT = 0;
  for (const st of delivered.steps || []) {
    const dur = st.durationSeconds || 0;
    let pace: number | null = st.targetPaceSecPerKm ? mid(st.targetPaceSecPerKm) : null;
    // No pace prescribed. Mobilise is stationary; anything else is jogging — use easy pace, which
    // is the most generous assumption available to the app (a slower jog reads worse, not better).
    let stationary = false;
    if (!pace) {
      if (/Mobilise/.test(String(st.display || "")) || /Mobilise/.test(String(st.label || ""))) stationary = true;
      else pace = mid(paces.easy);
    }
    let secs = dur;
    if (!secs && st.distanceMeters) secs = (st.distanceMeters / 1000) * (pace || mid(paces.vo2));
    if (stationary) { t += secs; lastKmT += secs; continue; }
    const stepDist = st.distanceMeters ? st.distanceMeters : (secs / pace!) * 1000;
    if (!isFinite(stepDist) || !isFinite(secs) || secs <= 0) {
      throw new Error("unsimulatable step: " + JSON.stringify({ kind: st.kind, display: st.display, label: st.label, dur, distanceMeters: st.distanceMeters, pace }));
    }
    // advance second by second so km boundaries land correctly
    const speed = stepDist / secs; // m/s
    for (let s = 0; s < secs; s++) {
      dist += speed; t += 1;
      const km = Math.floor(dist / 1000);
      if (km > kmDone) { kmDone = km; splits.push({ km, sec: t - lastKmT }); lastKmT = t; }
    }
  }
  return { splits, distKm: dist / 1000, sec: t };
}

const seen = new Set<string>();
const wanted: any[] = [];
for (const w of plan.weeks) for (const s of w.sessions) {
  if (!s.steps || !s.steps.length) continue;
  if (seen.has(s.title)) continue;
  seen.add(s.title);
  wanted.push(s);
}
console.log("distinct titles:", wanted.length);
for (const sess of wanted) {
  const live = M.withGeneratedWarmup(sess);
  const band = M.plannedPaceBandOf(live);
  const sim = simulate(live);
  const run: any = {
    type: sess.type, t: sess.title, splits: sim.splits, distKm: sim.distKm, sec: sim.sec,
    pband: band, pmix: M.isRunWalkShape(live), rband: M.plannedRpeBandOf(live), route: [],
    avgPaceSec: sim.distKm ? sim.sec / sim.distKm : 0,
  };
  const a = M.runAnalysis(run);
  const tag = band ? `${a.inBand}/${a.n} in band (${M.fmtPace(band.minSecPerKm)}-${M.fmtPace(band.maxSecPerKm)})` : `no band, n=${a.n}`;
  const worst = a.rows.length ? a.rows.slice().sort((x: any, y: any) => Math.abs(y.delta) - Math.abs(x.delta))[0] : null;
  console.log(`\n== ${sess.type} :: ${sess.title}`);
  console.log("   ", tag, "| dist", sim.distKm.toFixed(2), "km |", worst ? `worst km${worst.km} ${worst.verdict} ${worst.delta}s` : "");
  if (band && a.inBand < a.n) {
    console.log("   splits:", sim.splits.map((s) => `${s.km}:${M.fmtPace(s.sec)}`).join(" "));
    console.log("   DEBRIEF:", M.debriefParagraphs(run, a).map(strip).join(" | "));
  }
}
