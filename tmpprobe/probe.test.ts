import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { listWorkouts } from "../src/plan/session-templates.ts";
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
const src = ["fmtSec","fmtPace","isStrideStep","workLabel","spanText","stepTargetText","stepChips","esc","structureRows","sessionStepText","withGeneratedWarmup"].map(grab).join("\n");
let ABILITY = "intermediate";
const M: any = new Function("warmupCardFor", src + "; return {sessionStepText, withGeneratedWarmup, structureRows};")(
  (s: any) => buildWarmup(s, ABILITY as any));

test("probe", () => {
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 18 * 60 + 20 });
  const opts = listWorkouts(paces);
  const hit = opts.find((o: any) => /2 × 15|2 x 15/.test(o.session.title) && /threshold/i.test(o.session.title));
  const target = hit || opts.find((o: any) => /threshold/i.test(o.session.title));
  console.log("TITLE:", target.session.title);
  const raw = target.session;
  const del = M.withGeneratedWarmup(raw);
  const mins = (s: any) => (s.steps||[]).reduce((a: number,x: any)=>a+(x.durationSeconds||0),0)/60;
  console.log("raw min", mins(raw).toFixed(1), "delivered min", mins(del).toFixed(1));
  console.log("--- RAW card rows (watch run) ---");
  for (const r of M.sessionStepText(raw)) console.log(" ", r.tag, "|", r.lab, "|", r.tgt);
  console.log("--- DELIVERED card rows (phone run) ---");
  for (const r of M.sessionStepText(del)) console.log(" ", r.tag, "|", r.lab, "|", r.tgt);
});
