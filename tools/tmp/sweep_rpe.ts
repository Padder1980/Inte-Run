import { deriveTrainingPaces } from "../../src/science/paces.ts";
import { listWorkouts } from "../../src/plan/session-templates.ts";
import { generatePlan } from "../../src/plan/generate-plan.ts";

const TARGET: any = { "5k": 23*60, "10k": 48*60, half: 105*60, marathon: 220*60 };
const seen = new Map<string, any>();
function check(tag: string, s: any) {
  const band = s.targetRpe;
  if (!band) return;
  const work = (s.steps||[]).filter((st:any)=>st.targetRpe && st.kind!=="warmup" && st.kind!=="cooldown");
  if (!work.length) return;
  const maxStep = Math.max(...work.map((st:any)=>st.targetRpe.max));
  if (maxStep > band.max) {
    const key = s.title.replace(/\d+/g,"N") + " | band " + band.min+"-"+band.max + " vs step " + maxStep;
    if (!seen.has(key)) seen.set(key, {tag, title: s.title, type: s.type, band, maxStep,
      hardest: work.filter((st:any)=>st.targetRpe.max===maxStep)[0].label});
  }
}
for (const t of [23*60+30, 18*60+20, 35*60]) {
  const paces = deriveTrainingPaces({distanceMeters:5000, timeSeconds:t});
  for (const o of listWorkouts(paces)) check("builder "+o.id, o.session);
  for (const distance of ["5k","10k","half","marathon"] as const)
    for (const daysPerWeek of [3,5,7])
      for (const runWalk of [false,true])
      for (const experience of ["beginner","recreational","competitive"] as const) {
        let plan:any;
        try { plan = generatePlan({experience, daysPerWeek, includeStrength:true, runWalk,
          recent:{distanceMeters:5000, timeSeconds:t}} as any,
          {distance, targetTimeSeconds: TARGET[distance], raceDateIso:"2026-12-06", startDateIso:"2026-08-17"} as any); }
        catch(e){ continue; }
        for (const wk of plan.weeks||[]) for (const s of wk.sessions||[]) check(distance+"/"+daysPerWeek+"d/"+experience, s);
      }
}
console.log("MISMATCHES:", seen.size);
for (const [k,v] of seen) console.log(JSON.stringify(v));
