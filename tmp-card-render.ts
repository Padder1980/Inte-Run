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
  "plannedRpeBandOf", "runAnalysis", "splitsVsTargetHtml", "debriefParagraphs", "paceChartSvg",
  "runDebrief", "esc", "fmtPace", "fmtSec", "spanText", "workLabel", "stepTargetText", "stepChips",
  "structureRows", "sessionStepText"];
const M: any = new Function("warmupCardFor", "PACE_MODEL_VERSION", "ICON", "profile",
  NAMES.map(lift).join(";\n") + "; return {" + NAMES.join(",") + "};")(
    (s: any) => buildWarmup(s, "intermediate"), "1.0.0", { alfie: "<i>A</i>" }, { name: "Adam" });
const strip = (x: any) => String(x).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const athlete: any = { daysPerWeek: 5, experience: "intermediate", includeStrength: false,
  recent: { distanceMeters: 5000, timeSeconds: 20 * 60 } };
const goal: any = { distance: "half", targetTimeSeconds: 95 * 60, raceDateIso: "2027-01-10", startDateIso: "2026-08-10" };
const plan = generatePlan(athlete, goal, {} as any);
const paces = deriveTrainingPaces(athlete.recent, goal);
const mid = (b: any) => (b.minSecPerKm + b.maxSecPerKm) / 2;

function simulate(delivered: any) {
  const splits: { km: number; sec: number }[] = [];
  let dist = 0, t = 0, kmDone = 0, lastKmT = 0;
  for (const st of delivered.steps || []) {
    let pace: number | null = st.targetPaceSecPerKm ? mid(st.targetPaceSecPerKm) : null;
    let stationary = false;
    if (!pace) {
      if (/Mobilise/.test(String(st.display || "")) || /Mobilise/.test(String(st.label || ""))) stationary = true;
      else pace = mid(paces.easy);
    }
    let secs = st.durationSeconds || 0;
    if (!secs && st.distanceMeters) secs = (st.distanceMeters / 1000) * (pace || mid(paces.vo2));
    if (stationary) { t += secs; lastKmT += secs; continue; }
    const stepDist = st.distanceMeters ? st.distanceMeters : (secs / pace!) * 1000;
    const speed = stepDist / secs;
    for (let s = 0; s < secs; s++) {
      dist += speed; t += 1;
      const km = Math.floor(dist / 1000);
      if (km > kmDone) { kmDone = km; splits.push({ km, sec: t - lastKmT }); lastKmT = t; }
    }
  }
  return { splits, distKm: dist / 1000, sec: t };
}

const TARGETS = ["Threshold fartlek: 6 × 3′ brisk / 2′ easy", "VO₂ pyramid: 1–2–3–2–1′ / equal easy"];
for (const title of TARGETS) {
  let sess: any = null;
  for (const w of plan.weeks) for (const s of w.sessions) if (s.title === title) sess = sess || s;
  if (!sess) { console.log("NOT FOUND", title); continue; }
  const live = M.withGeneratedWarmup(sess);
  const sim = simulate(live);
  const run: any = { id: "r", t: sess.title, type: sess.type, d: "7 Aug", dateIso: "2026-08-07",
    dist: sim.distKm.toFixed(2) + " km", time: "—", pace: "—", distKm: sim.distKm, sec: sim.sec,
    avgPaceSec: sim.sec / sim.distKm, splits: sim.splits, route: [],
    pband: M.plannedPaceBandOf(live), pmix: M.isRunWalkShape(live), rband: M.plannedRpeBandOf(live),
    rpe: 8, steps: M.sessionStepText(live) };
  const a = M.runAnalysis(run);
  console.log("\n================ " + title);
  console.log("session type:", sess.type, "| stamped pband:", JSON.stringify(run.pband), "| pmix:", run.pmix, "| rband:", JSON.stringify(run.rband));
  console.log("splits:", sim.splits.map((s) => `km${s.km} ${M.fmtPace(s.sec)}`).join("  "));
  console.log("\n--- WHAT THE CARD RENDERS ---");
  console.log(strip(M.runDebrief(run, a)));
}
