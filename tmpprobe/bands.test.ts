import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { listWorkouts } from "../src/plan/session-templates.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildWarmup } from "../src/science/warmup.ts";

const html = readFileSync("/Users/adampalmer/Developer/InteRun/.claude/worktrees/relaxed-curie-682fd0/web/app.html", "utf8");
function grab(fn: string) {
  const at = html.indexOf("function " + fn + "(");
  if (at < 0) throw new Error("missing " + fn);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced " + fn);
}
const names = ["fmtSec","fmtPace","isStrideStep","workLabel","spanText","stepTargetText","stepChips","esc",
  "structureRows","sessionStepText","withGeneratedWarmup","plannedPaceBandOf","plannedRpeBandOf","isRunWalkShape","watchSessionPayload"];
let ABILITY = "intermediate";
const M: any = new Function("warmupCardFor",
  names.map(grab).join("\n") + "; return {sessionStepText, withGeneratedWarmup, plannedPaceBandOf, plannedRpeBandOf, isRunWalkShape, watchSessionPayload};")(
  (s: any) => buildWarmup(s, ABILITY as any));

const TARGET: any = { "5k": 23*60, "10k": 48*60, half: 105*60, marathon: 220*60 };
function everySession(): Array<[string, any]> {
  const out: Array<[string, any]> = [];
  for (const t of [23*60+30, 18*60+20, 35*60]) {
    const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: t });
    for (const o of listWorkouts(paces)) out.push([`builder ${o.id} @${t}`, o.session]);
    for (const distance of ["5k","10k","half","marathon"] as const)
      for (const daysPerWeek of [3,5,7]) {
        const plan = generatePlan(
          { experience: "recreational", daysPerWeek, includeStrength: true, recent: { distanceMeters: 5000, timeSeconds: t } } as any,
          { distance, targetTimeSeconds: TARGET[distance], raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any);
        for (const wk of plan.weeks || []) for (const s of wk.sessions || []) out.push([`${distance}/${daysPerWeek}d ${s.title} @${t}`, s]);
      }
  }
  return out;
}
const J = (x: any) => JSON.stringify(x ?? null);

test("what the card JUDGES the run against is identical raw vs delivered", () => {
  let n = 0, diffP = 0, diffR = 0, diffMix = 0, diffType = 0, diffTitle = 0, stepsDiff = 0;
  const ex: string[] = [];
  for (const ability of ["new","beginner","intermediate","advanced"]) {
    ABILITY = ability;
    for (const [where, raw] of everySession()) {
      const del = M.withGeneratedWarmup(raw);
      n++;
      if (J(M.plannedPaceBandOf(raw)) !== J(M.plannedPaceBandOf(del))) { diffP++; if (ex.length<8) ex.push("PBAND "+ability+" "+where); }
      if (J(M.plannedRpeBandOf(raw)) !== J(M.plannedRpeBandOf(del))) { diffR++; if (ex.length<8) ex.push("RBAND "+ability+" "+where); }
      if (M.isRunWalkShape(raw) !== M.isRunWalkShape(del)) diffMix++;
      if (raw.type !== del.type) diffType++;
      if (raw.title !== del.title) diffTitle++;
      if (J(M.sessionStepText(raw)) !== J(M.sessionStepText(del))) stepsDiff++;
    }
  }
  console.log({ n, diffP, diffR, diffMix, diffType, diffTitle, stepsDiff });
  console.log(ex);
});

test("the only rows that differ are warm-up rows; the WORK the card reports is identical", () => {
  let n = 0, workDiff = 0, wuDiff = 0; const ex: string[] = [];
  const nonWu = (rows: any[]) => (rows||[]).filter((r) => r.tag !== "Warm-up");
  for (const ability of ["new","beginner","intermediate","advanced"]) {
    ABILITY = ability;
    for (const [where, raw] of everySession()) {
      const del = M.withGeneratedWarmup(raw); n++;
      const a = M.sessionStepText(raw), b = M.sessionStepText(del);
      if (J(a) !== J(b)) {
        wuDiff++;
        if (J(nonWu(a)) !== J(nonWu(b))) { workDiff++; if (ex.length < 6) ex.push(ability + " " + where + "\n  raw: " + J(nonWu(a)) + "\n  del: " + J(nonWu(b))); }
      }
    }
  }
  console.log({ n, rowsDiffer: wuDiff, ofWhichWorkDiffers: workDiff });
  console.log(ex.join("\n"));
});

test("the watch card lists exactly the steps the watch counts through", () => {
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 18*60+20 });
  const raw = listWorkouts(paces).find((o: any) => o.session.title === "2 × 15′ threshold / 3′ float")!.session;
  const payload = M.watchSessionPayload(raw, "2026-08-07");   // what startOnWatch sends the wrist
  console.log("watch counts through:", payload.steps.map((s: any) => s.kind + " " + (s.seconds||s.metres+"m")).join(" | "));
  console.log("watch payload durationMin:", payload.durationMin);
  console.log("card lists (ingestWatchRun -> sessionStepText(raw)):");
  for (const r of M.sessionStepText(raw)) console.log("   ", r.tag, "|", r.lab, "|", r.tgt);
});
