import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "./src/science/paces.ts";
import { easyRun, thresholdSession } from "./src/plan/session-templates.ts";

const html = readFileSync(new URL("./web/app.html", import.meta.url), "utf8");
function lift(name: string) {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("not in build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced " + name);
}
const src = [
  lift("runAnalysis"), lift("runEvidenceConfidence"), lift("paceChartSvg"), lift("splitsVsTargetHtml"),
  lift("debriefParagraphs"), lift("runDebrief"), lift("plannedPaceBandOf"),
  lift("isRunWalkShape"), lift("plannedRpeBandOf"),
].join(";\n");
const env: any = new Function("profile", "esc", "ICON", "fmtPace",
  src + "; return {runAnalysis, runDebrief, plannedPaceBandOf, plannedRpeBandOf, isRunWalkShape, splitsVsTargetHtml, debriefParagraphs};")(
  { name: "Adam" },
  (s: any) => String(s),
  { alfie: "<i></i>" },
  (s: number) => { const m = Math.floor(s / 60), x = Math.round(s % 60); return m + ":" + String(x).padStart(2, "0"); },
);

test("probe", () => {
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  const sess: any = easyRun(paces, 26);
  const pband = env.plannedPaceBandOf(sess);
  const rband = env.plannedRpeBandOf(sess);
  console.log("session:", sess.title, "| type", sess.type);
  console.log("pband:", JSON.stringify(pband), "| rband:", JSON.stringify(rband));
  const run: any = {
    id: "r1", t: sess.title, d: "6 Aug · 18:20", dateIso: "2026-08-06",
    dist: "8.00 km", time: "48:00", pace: "6:00 /km", distKm: 8, sec: 2880,
    avgPaceSec: 360, route: [], splits: [], elevGain: 0, type: sess.type,
    rpe: 3, pband, rband, pmix: env.isRunWalkShape(sess),
    anchor: 1500, pmodel: 3, avgHr: null, steps: [],
  };
  const a = env.runAnalysis(run);
  console.log("analysis: n=" + a.n, "inBand=" + a.inBand, "band=" + JSON.stringify(a.band), "mixed=" + a.mixed);
  const out: string = env.runDebrief(run, a);
  console.log("---- runDebrief ----\n" + out + "\n--------------------");
  console.log("chips:", (out.match(/<div class="db-chips">[\s\S]*?<\/div><div class="db-body">/) || [""])[0]);
  console.log("splitsVsTarget empty? ", env.splitsVsTargetHtml(a) === "");
  console.log("paras:", JSON.stringify(env.debriefParagraphs(run, a)));
});
