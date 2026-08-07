/**
 * Reproduction: the "Negative split" chip and its praise are manufactured by the app's own warm-up.
 * Run from the repo root:  node web/app.ts && node tmp-negative-split-repro.ts
 */
import { readFileSync } from "node:fs";
import { generatePlan } from "./src/plan/generate-plan.ts";
import { buildWarmup } from "./src/science/warmup.ts";

const HTML = readFileSync("./web/app.html", "utf8");
function grab(fn: string) {
  const at = HTML.indexOf("function " + fn + "(");
  if (at < 0) throw new Error("not found in the build: " + fn);
  let d = 0;
  for (let i = HTML.indexOf("{", at); i < HTML.length; i++) {
    if (HTML[i] === "{") d++;
    else if (HTML[i] === "}") { d--; if (!d) return HTML.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + fn);
}
const mk = (name: string, deps: string[] = []) =>
  new Function("warmupCardFor", deps.concat([name]).map(grab).join("\n") + "; return " + name + ";");
const wu = (s: any) => buildWarmup(s, "intermediate" as any, {});
const withGeneratedWarmup: any = mk("withGeneratedWarmup", ["isStrideStep"])(wu);
const plannedPaceBandOf: any = mk("plannedPaceBandOf")(wu);
const runAnalysis: any = mk("runAnalysis")(wu);
const debriefParagraphs: any = mk("debriefParagraphs")(wu);
const fmtPace: any = new Function(grab("fmtPace") + "; return fmtPace;")();

/** Exactly what checkSplits() does: distance-triggered, timed off the wall clock from LIVE.startMs.
 *  There is no auto-pause on the phone, so the stationary Mobilise minutes accrue time, not distance. */
function simulate(sess: any, pace: number, moving: (st: any) => boolean) {
  const splits: Array<{ km: number; sec: number }> = [];
  let t = 0, dist = 0, kmDone = 0, lastKm = 0;
  for (const st of sess.steps || []) {
    const speed = moving(st) ? 1000 / pace : 0;
    for (let i = 0; i < (st.durationSeconds || 0); i++) {
      t++; dist += speed;
      const km = Math.floor(dist / 1000);
      if (km > kmDone) { kmDone = km; splits.push({ km, sec: t - lastKm }); lastKm = t; }
    }
  }
  return { splits, totalSec: t, distM: dist };
}

const plan = generatePlan(
  { experience: "recreational", daysPerWeek: 4, includeStrength: false,
    recent: { distanceMeters: 5000, timeSeconds: 27 * 60 } } as any,
  { distance: "10k", targetTimeSeconds: 56 * 60, raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any,
);

let n = 0, chipped = 0;
const seen = new Set<string>();
for (const w of plan.weeks) for (const s of w.sessions) {
  if (!/(easy|moderate|long) run$/.test(s.title) || seen.has(s.title)) continue;
  seen.add(s.title);
  const d = withGeneratedWarmup(s);
  const band = plannedPaceBandOf(d); if (!band) continue;
  const pace = Math.round((band.minSecPerKm + band.maxSecPerKm) / 2);
  // The runner does literally what the card says: jogs every running minute at the prescribed pace,
  // stands still for the prescribed 3-minute Mobilise (ankle rocks, leg swings).
  const sim = simulate(d, pace, (st) => st.display !== "Mobilise");
  const run: any = { splits: sim.splits, pband: band };
  const a = runAnalysis(run);
  n++;
  if (!a.progressive) continue;
  chipped++;
  if (chipped <= 3) {
    console.log("=== " + s.title + " — jogged at a metronomic " + fmtPace(pace) + "/km throughout");
    console.log("    delivered steps : " + d.steps.map((x: any) => (x.display || x.kind) + " " + Math.round((x.durationSeconds || 0) / 6) / 10 + "'").join(" | "));
    console.log("    splits          : " + sim.splits.map((x: any) => fmtPace(x.sec)).join(", "));
    console.log("    CHIP            : <span class=\"db-chip good\">Negative split</span>   (a.shiftSec=" + a.shiftSec + ")");
    console.log("    km 1 scored as  : " + a.rows[0].verdict + " " + a.rows[0].delta + "s");
    for (const p of debriefParagraphs(run, a)) console.log("    > " + p.replace(/\\u2014/g, "—").replace(/\\u2013/g, "–"));
    console.log("");
  }
}
console.log("plain easy/moderate/long runs in this plan: " + n + " — of which falsely chipped 'Negative split': " + chipped);
