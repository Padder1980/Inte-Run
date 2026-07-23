// Builds the safety & wellbeing screen (web/safety.html): the UI for the safety layer's three
// screens — medical red flags, RED-S / fuelling, and female-athlete health. Every screen runs the
// real engine client-side and routes to a professional; nothing here diagnoses. Regenerate with:
//   node web/safety.ts   (or: npm run web, which builds every page)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundleEngine } from "./bundle.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bundleJs = await bundleEngine();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Running Coach — Safety &amp; Wellbeing</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --calm: #3fa47a; --pro: #d98a2a; --urgent: #d65b36; --emergency: #c0392b;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --calm: #4cb98a; --pro: #eb9748; --urgent: #e56f49; --emergency: #e05745;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --calm: #3fa47a; --pro: #d98a2a; --urgent: #d65b36; --emergency: #c0392b;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --calm: #4cb98a; --pro: #eb9748; --urgent: #e56f49; --emergency: #e05745;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 780px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 72px; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
a { color: var(--accent); }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--calm), var(--accent) 55%, var(--pro)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.lede { margin-top: 24px; }
.lede h2 { font-size: clamp(23px, 4vw, 32px); letter-spacing: -.02em; margin: 6px 0 8px; text-wrap: balance; }
.lede p { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 62ch; }
.promise { margin-top: 16px; display: flex; gap: 12px; background: color-mix(in srgb, var(--emergency) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--emergency) 30%, var(--line)); border-radius: 12px; padding: 13px 15px; font-size: 13.5px; color: var(--ink); }
.promise b { color: var(--emergency); }

.card { margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(16px,2.5vw,24px); }
.card > h3 { margin: 0 0 3px; font-size: 17px; letter-spacing: -.01em; }
.card > .hint { margin: 0 0 14px; font-size: 12.5px; color: var(--ink-faint); }
.subhead { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; margin: 14px 0 8px; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
.opt { display: flex; gap: 9px; align-items: flex-start; font-size: 13.5px; color: var(--ink-soft); cursor: pointer; padding: 5px 0; }
.opt input { margin-top: 3px; accent-color: var(--accent); flex: none; }
label.field { display: block; margin-top: 6px; }
label.field span { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink-soft); margin-bottom: 5px; }
select, input[type="number"] { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
select:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.result { margin-top: 16px; border-radius: 12px; border: 1px solid var(--line); overflow: hidden; display: none; }
.result.show { display: block; }
.banner { padding: 13px 16px; font-weight: 600; font-size: 14px; color: #fff; background: var(--bc, var(--calm)); display: flex; gap: 9px; align-items: center; }
.banner .dot { width: 9px; height: 9px; border-radius: 50%; background: #fff; opacity: .9; flex: none; }
.result .items { padding: 4px 16px 6px; background: var(--surface); }
.item { padding: 12px 0; border-top: 1px solid var(--line); }
.item:first-child { border-top: 0; }
.item .t { font-size: 13.5px; font-weight: 600; display: flex; gap: 8px; align-items: baseline; }
.item .u { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; padding: 1px 7px; border-radius: 999px; color: #fff; background: var(--uc, var(--pro)); }
.item .g { font-size: 13px; color: var(--ink-soft); margin-top: 4px; }
.item .refer { font-size: 12.5px; color: var(--ink); margin-top: 6px; }
.item .refer b { color: var(--accent); font-weight: 600; }
.disclaimer { padding: 11px 16px; background: var(--surface-2); font-size: 12px; color: var(--ink-faint); border-top: 1px solid var(--line); }
.ea-toggle { margin-top: 14px; font-size: 13px; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit; }
.ea { margin-top: 12px; padding: 14px; border: 1px dashed var(--line); border-radius: 12px; display: none; }
.ea.show { display: block; }
.ea .out { margin-top: 12px; font-size: 13.5px; }
.ea .out .band { font-weight: 700; text-transform: capitalize; }
footer { margin-top: 28px; font-size: 12px; color: var(--ink-faint); text-align: center; }
@media (max-width: 620px) { .opts, .row2 { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div class="mark" aria-hidden="true"></div>
      <div>
        <h1>Running Coach</h1>
        <p>Safety &amp; wellbeing · screens run in your browser</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="lede">
    <div class="eyebrow">Screen · educate · refer</div>
    <h2>A quick check-in — never a diagnosis</h2>
    <p>These screens flag things worth acting on and point you to the right person. They can't diagnose
    anything, and they're not a substitute for a professional who can actually assess you.</p>
    <div class="promise"><span><b>In an emergency</b>, don't use an app — call your local emergency number straight away.</span></div>
  </div>

  <div class="card">
    <h3>How are you feeling right now?</h3>
    <p class="hint">Tick anything you're experiencing. This checks whether you should stop and seek help.</p>
    <div class="subhead">Physical symptoms</div>
    <div class="opts" id="flags-physical"></div>
    <div class="subhead">Wellbeing</div>
    <div class="opts" id="flags-wellbeing"></div>
    <div class="result" id="flags-result"></div>
  </div>

  <div class="card">
    <h3>Fuelling &amp; energy (RED-S)</h3>
    <p class="hint">Under-fuelling harms health and performance. Tick anything that sounds like you — this is about getting enough, never about eating less.</p>
    <div class="opts" id="reds-opts"></div>
    <div class="result" id="reds-result"></div>
    <button class="ea-toggle" id="eaToggle" type="button">Optional: estimate energy availability ▸</button>
    <div class="ea" id="ea">
      <p class="hint" style="margin:0 0 10px">A rough teaching estimate: (daily intake − exercise energy) ÷ fat-free mass. Hard to measure precisely — never use it as a target to eat less.</p>
      <div class="row2">
        <label class="field"><span>Daily intake (kcal)</span><input type="number" id="eaIntake" value="2400" min="0"></label>
        <label class="field"><span>Exercise energy (kcal)</span><input type="number" id="eaExercise" value="700" min="0"></label>
      </div>
      <label class="field" style="margin-top:12px"><span>Fat-free mass (kg)</span><input type="number" id="eaFfm" value="52" min="1"></label>
      <div class="out" id="eaOut"></div>
    </div>
  </div>

  <div class="card">
    <h3>Female-athlete health</h3>
    <p class="hint">Symptom-informed, not calendar-based. Nothing here changes your training by cycle phase — it just surfaces what's worth a conversation.</p>
    <label class="field"><span>Menstrual status</span>
      <select id="fhStatus">
        <option value="regular">Regular periods</option>
        <option value="irregular">Irregular periods</option>
        <option value="absent-3m-plus">No period for 3+ months</option>
        <option value="hormonal-contraception">On hormonal contraception</option>
        <option value="pregnant">Pregnant</option>
        <option value="postpartum">Postpartum (after birth)</option>
        <option value="perimenopause">Perimenopause</option>
        <option value="menopause">Menopause</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
    </label>
    <label class="field" id="fhMonthsWrap" style="display:none"><span>Months since last period</span><input type="number" id="fhMonths" value="1" min="0" max="60"></label>
    <label class="field" id="fhWeeksWrap" style="display:none"><span>Weeks since birth</span><input type="number" id="fhWeeks" value="8" min="0" max="200"></label>
    <div class="subhead">Any of these?</div>
    <div class="opts" id="fh-opts"></div>
    <div class="result" id="fh-result"></div>
  </div>

  <footer>Screens compute on your device. Guidance only — not medical advice, and never a diagnosis.</footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
const PROF = RC.PROFESSIONAL_LABEL;

const FLAGS_PHYSICAL = {
  "chest-pain": "Chest pain or pressure",
  "collapse-or-fainting": "Fainting or collapse",
  "severe-breathlessness": "Severe or sudden breathlessness",
  "neurological": "Sudden confusion, severe headache, weakness, or vision/speech trouble",
  "heat-illness": "Feeling faint or confused in heat, or stopped sweating",
  "palpitations": "Palpitations or an irregular heartbeat",
  "bone-pain": "Pinpoint bone pain or tenderness (or pain at night)",
  "rapidly-worsening-pain": "Pain that is worsening quickly",
};
const FLAGS_WELLBEING = {
  "eating-disorder-concern": "Worries about my eating",
  "menstrual-disruption": "Periods have stopped or are very irregular",
  "mental-health-concern": "Struggling with my mental health",
  "self-harm-thoughts": "Thoughts of harming myself",
};
const REDS = {
  "unintentional-weight-loss": "Losing weight without meaning to",
  "restrictive-or-skipped-meals": "Skipping meals or restricting food",
  "preoccupation-with-food-or-weight": "Preoccupied with food or weight",
  "menstrual-disruption": "Periods stopped or irregular",
  "low-libido": "Low libido",
  "recurrent-illness": "Getting ill often",
  "bone-stress-history": "A history of bone stress injury",
  "poor-recovery": "Recovering poorly between sessions",
  "low-mood-or-irritability": "Low mood or irritability",
  "always-feeling-cold": "Always feeling cold",
  "gi-discomfort": "Frequent gut discomfort",
  "persistent-fatigue": "Persistent fatigue",
};
const FH_SYMPTOMS = {
  "pelvic-floor": "Leaking, heaviness or dragging (pelvic floor)",
  "heavy-bleeding": "Very heavy periods",
  "iron-fatigue": "Tired or breathless (possible low iron)",
  "hot-flushes-or-sleep": "Hot flushes or disrupted sleep",
  "painful-periods": "Painful periods",
};
const URG_COLOR = { emergency: "var(--emergency)", urgent: "var(--urgent)", professional: "var(--pro)", monitor: "var(--calm)", none: "var(--calm)" };
const URG_LABEL = { emergency: "Emergency", urgent: "Urgent", professional: "See someone", monitor: "Monitor", none: "OK" };

function checks(container, map) {
  container.innerHTML = Object.entries(map).map(([k, v]) =>
    '<label class="opt"><input type="checkbox" value="' + k + '"><span>' + v + '</span></label>'
  ).join("");
}
function selected(container) {
  return [...container.querySelectorAll("input:checked")].map((el) => el.value);
}
function referLine(refer) {
  if (!refer || refer.length === 0) return "";
  const names = refer.map((r) => PROF[r] || r);
  const joined = names.length > 1 ? names.slice(0, -1).join(", ") + " or " + names[names.length - 1] : names[0];
  return '<div class="refer">Talk to <b>' + joined + '</b>.</div>';
}
function renderResult(el, urgency, headline, items, disclaimer) {
  el.classList.add("show");
  el.innerHTML =
    '<div class="banner" style="--bc:' + URG_COLOR[urgency] + '"><span class="dot"></span>' + headline + '</div>' +
    (items.length ? '<div class="items">' + items.map((it) =>
      '<div class="item"><div class="t">' + it.title +
      (it.urgency ? '<span class="u" style="--uc:' + URG_COLOR[it.urgency] + '">' + URG_LABEL[it.urgency] + '</span>' : '') +
      '</div><div class="g">' + it.guidance + '</div>' + referLine(it.refer) + '</div>'
    ).join("") + '</div>' : '') +
    '<div class="disclaimer">' + disclaimer + '</div>';
}

// Red flags
function runFlags() {
  const picks = [...selected($("flags-physical")), ...selected($("flags-wellbeing"))];
  const el = $("flags-result");
  if (picks.length === 0) { el.classList.remove("show"); return; }
  const r = RC.screenRedFlags(picks);
  renderResult(el, r.urgency, r.headline, r.flags.map((f) => ({ title: f.label, urgency: f.urgency, guidance: f.guidance, refer: f.refer })), r.disclaimer);
}
// RED-S
function runReds() {
  const picks = selected($("reds-opts"));
  const el = $("reds-result");
  const r = RC.screenRedS(picks);
  const items = [{ title: r.message, urgency: r.urgency === "monitor" ? "monitor" : "professional", guidance: r.guidance.join(" "), refer: r.refer }];
  renderResult(el, r.risk === "low" ? "monitor" : "professional", "Risk: " + r.risk + (r.risk === "low" ? " — nothing strong flagged" : " — worth a review"), items, r.disclaimer);
}
function runEa() {
  const intake = Number($("eaIntake").value), exercise = Number($("eaExercise").value), ffm = Number($("eaFfm").value);
  const out = $("eaOut");
  if (!(ffm > 0)) { out.textContent = "Enter your fat-free mass to estimate."; return; }
  const e = RC.estimateEnergyAvailability({ intakeKcal: intake, exerciseEnergyKcal: exercise, fatFreeMassKg: ffm });
  const c = e.band === "low" ? "var(--urgent)" : e.band === "reduced" ? "var(--pro)" : "var(--calm)";
  out.innerHTML = 'Estimated <b class="num">' + e.eaKcalPerKgFfm + '</b> kcal/kg FFM/day — <span class="band" style="color:' + c + '">' + e.band + '</span>.<div class="g" style="color:var(--ink-soft);margin-top:6px;font-size:12.5px">' + e.note + '</div>';
}
// Female health
function runFh() {
  const status = $("fhStatus").value;
  const input = { status, symptoms: selected($("fh-opts")) };
  if (status === "irregular") input.monthsSinceLastPeriod = Number($("fhMonths").value);
  if (status === "postpartum") input.postpartumWeeks = Number($("fhWeeks").value);
  const r = RC.assessFemaleHealth(input);
  const el = $("fh-result");
  if (r.prompts.length === 0) { renderResult(el, "none", "Nothing flagged — keep tracking how you feel.", [], r.disclaimer); return; }
  const items = r.prompts.map((p) => ({ title: p.topic, urgency: p.urgency, guidance: p.message, refer: p.refer }));
  const extra = r.suggestRedSScreen ? [{ title: "Worth also checking fuelling", urgency: "monitor", guidance: "Missing periods can link to low energy availability — the RED-S screen above is worth a look too.", refer: [] }] : [];
  renderResult(el, r.urgency, r.urgency === "professional" ? "Worth a conversation with a professional." : "A couple of things to keep an eye on.", items.concat(extra), r.disclaimer);
}

checks($("flags-physical"), FLAGS_PHYSICAL);
checks($("flags-wellbeing"), FLAGS_WELLBEING);
checks($("reds-opts"), REDS);
checks($("fh-opts"), FH_SYMPTOMS);

$("flags-physical").addEventListener("change", runFlags);
$("flags-wellbeing").addEventListener("change", runFlags);
$("reds-opts").addEventListener("change", runReds);
$("eaToggle").addEventListener("click", () => { $("ea").classList.toggle("show"); if ($("ea").classList.contains("show")) runEa(); });
["eaIntake", "eaExercise", "eaFfm"].forEach((id) => $(id).addEventListener("input", runEa));
$("fhStatus").addEventListener("change", () => {
  $("fhMonthsWrap").style.display = $("fhStatus").value === "irregular" ? "block" : "none";
  $("fhWeeksWrap").style.display = $("fhStatus").value === "postpartum" ? "block" : "none";
  runFh();
});
["fhMonths", "fhWeeks"].forEach((id) => $(id).addEventListener("input", runFh));
$("fh-opts").addEventListener("change", runFh);
$("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
});

runReds();
</script>
</body>
</html>
`;

const outPath = join(here, "safety.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
