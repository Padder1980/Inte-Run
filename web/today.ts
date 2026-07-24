// Builds the "Today" screen (web/today.html): a plain-English daily check-in that runs the real
// readiness model (no single metric decides the day) and the training-load guardrails (the long-run
// spike signal + return-to-running guidance). Non-punitive throughout. Same engine bundle.
// Regenerate with:  node web/today.ts   (or: npm run web)

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
<title>Running Coach — Today</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --ready: #4b9e2f; --steady: #2b9eb3; --ease: #d98a2a; --rest: #c0442e;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --ready: #6bbf46; --steady: #3ab0c4; --ease: #eb9748; --rest: #e8765c;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --ready: #4b9e2f; --steady: #2b9eb3; --ease: #d98a2a; --rest: #c0442e;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --ready: #6bbf46; --steady: #3ab0c4; --ease: #eb9748; --rest: #e8765c;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 780px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 72px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--steady), var(--accent) 55%, var(--ready)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.lede { margin-top: 24px; }
.lede h2 { font-size: clamp(23px, 4vw, 32px); letter-spacing: -.02em; margin: 6px 0 8px; text-wrap: balance; }
.lede p { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 60ch; }

.card { margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(16px,2.5vw,24px); }
.card > h3 { margin: 0 0 3px; font-size: 17px; letter-spacing: -.01em; }
.card > .hint { margin: 0 0 14px; font-size: 12.5px; color: var(--ink-faint); }
.q { margin: 14px 0; }
.q > label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-soft); margin-bottom: 7px; }
.seg { display: flex; flex-wrap: wrap; gap: 6px; }
.seg button { font: inherit; font-size: 13px; color: var(--ink-soft); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
.seg button:hover { border-color: var(--accent); }
.seg button.on { background: var(--accent); color: var(--accent-ink); border-color: transparent; font-weight: 600; }
.rowin { display: flex; align-items: center; gap: 10px; }
.rowin input[type="number"] { font: inherit; font-size: 14px; font-family: var(--mono); color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 8px 10px; width: 90px; }
.rowin input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.rowin .u { font-size: 13px; color: var(--ink-faint); }
details.more { margin-top: 8px; }
details.more > summary { font-size: 13px; color: var(--accent); cursor: pointer; list-style: none; }
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::before { content: "▸ "; }
details.more[open] > summary::before { content: "▾ "; }

.readout { margin-top: 18px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.readout .band { padding: 16px 18px; color: #fff; background: var(--bc); }
.readout .band .h { font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
.readout .band .rec { font-size: 13.5px; margin-top: 3px; opacity: .96; }
.meter { height: 8px; background: rgba(255,255,255,.3); border-radius: 5px; overflow: hidden; margin-top: 12px; }
.meter > i { display: block; height: 100%; background: #fff; border-radius: 5px; transition: width .25s; }
.readout .body { padding: 14px 18px; background: var(--surface); }
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { font-size: 12px; color: var(--ink-soft); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; }
.reassure { font-size: 13px; color: var(--ink-soft); font-style: italic; margin-top: 12px; }

.load-inputs { display: flex; flex-wrap: wrap; gap: 16px; }
.load-inputs .rowin { flex-direction: column; align-items: flex-start; gap: 5px; }
.load-inputs label { font-size: 12px; font-weight: 600; color: var(--ink-soft); }
.result-line { margin-top: 16px; border-left: 4px solid var(--rc, var(--ready)); background: var(--surface-2); border-radius: 0 10px 10px 0; padding: 12px 14px; }
.result-line .m { font-size: 14px; font-weight: 600; }
.result-line .n2 { font-size: 12.5px; color: var(--ink-soft); margin-top: 4px; }
.stages { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; counter-reset: s; }
.stages li { display: grid; grid-template-columns: 26px 1fr; gap: 10px; font-size: 13px; color: var(--ink-soft); }
.stages li::before { counter-increment: s; content: counter(s); width: 24px; height: 24px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 12px; color: var(--accent); font-weight: 600; }
.stages li b { color: var(--ink); font-weight: 600; }
footer { margin-top: 28px; font-size: 12px; color: var(--ink-faint); text-align: center; }
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
        <p>Today · a quick, kind check-in</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="lede">
    <div class="eyebrow">How are you today?</div>
    <h2>Should you train today — and how hard?</h2>
    <p>A few taps and we'll suggest whether to go for it, take it easy, or rest. No single thing decides
    it, and backing off when you need to is part of training well — never a failure.</p>
  </div>

  <div class="card">
    <h3>Your check-in</h3>
    <p class="hint">Answer what you can — skip anything you're not sure about.</p>

    <div class="q">
      <label>How many hours did you sleep?</label>
      <div class="rowin"><input type="number" id="sleepHours" step="0.5" min="0" max="14" value="7.5"><span class="u">hours</span></div>
    </div>
    <div class="q"><label>How well did you sleep?</label><div class="seg" data-field="sleepQuality" data-opts="good:Good|ok:OK|poor:Poor"></div></div>
    <div class="q"><label>How do your legs feel?</label><div class="seg" data-field="soreness" data-opts="none:Fine|mild:A bit stiff|moderate:Sore|high:Very sore"></div></div>
    <div class="q"><label>Energy today?</label><div class="seg" data-field="energy" data-opts="good:Good|ok:OK|low:Low"></div></div>
    <div class="q"><label>Life stress?</label><div class="seg" data-field="stress" data-opts="low:Low|normal:Normal|high:High"></div></div>
    <div class="q"><label>Feeling like running?</label><div class="seg" data-field="motivation" data-opts="high:Keen|ok:OK|low:Not really"></div></div>
    <div class="q"><label>Feeling ill at all?</label><div class="seg" data-field="illness" data-opts="none:No|slight:A little|unwell:Unwell"></div></div>

    <details class="more">
      <summary>Add wearable data (optional)</summary>
      <div class="q" style="margin-top:14px"><label>Resting heart rate vs your normal</label><div class="rowin"><input type="number" id="rhr" step="1" min="0" max="40" value="0"><span class="u">bpm above normal</span></div></div>
      <div class="q"><label>HRV vs your baseline <span style="color:var(--ink-faint);font-weight:400">(never decides the day on its own)</span></label><div class="seg" data-field="hrvStatus" data-opts="normal:Normal|low:Low|high:High"></div></div>
      <div class="q"><label>How hard was yesterday? <span style="color:var(--ink-faint);font-weight:400">(1–10)</span></label><div class="rowin"><input type="number" id="rpe" step="1" min="0" max="10" value="0"></div></div>
    </details>

    <div class="readout" id="readout"></div>
  </div>

  <div class="card">
    <h3>Planning a longer run?</h3>
    <p class="hint">Big jumps in one go are linked to more injuries. Pop in the numbers for a quick sense-check.</p>
    <div class="load-inputs">
      <div class="rowin"><label for="planned">Run you're planning</label><div class="rowin"><input type="number" id="planned" step="0.5" min="0" value="20"><span class="u">km</span></div></div>
      <div class="rowin"><label for="longest">Longest run in the last month</label><div class="rowin"><input type="number" id="longest" step="0.5" min="0" value="15"><span class="u">km</span></div></div>
    </div>
    <div id="loadResult"></div>
  </div>

  <div class="card">
    <h3>Coming back from time off?</h3>
    <p class="hint">Ease back in — your heart and lungs bounce back faster than tendons and bone.</p>
    <div class="q"><label>How long have you been off?</label><div class="rowin"><input type="number" id="weeksOff" step="1" min="0" value="3"><span class="u">weeks</span></div></div>
    <div class="q"><label>Can you walk pain-free?</label><div class="seg" data-field="painFree" data-opts="yes:Yes|no:Not yet"></div></div>
    <div class="q"><label>Was it a bone or joint injury?</label><div class="seg" data-field="boneJoint" data-opts="no:No|yes:Yes"></div></div>
    <div id="returnResult"></div>
  </div>

  <footer>A friendly guide, computed on your device — not medical advice. If something hurts or worries you, check with a professional.</footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
const BAND_COLOR = { ready: "var(--ready)", steady: "var(--steady)", ease: "var(--ease)", rest: "var(--rest)" };

const state = {
  sleepQuality: "good", soreness: "none", energy: "good", stress: "low", motivation: "high",
  illness: "none", hrvStatus: "normal", painFree: "yes", boneJoint: "no",
};

function initSegs() {
  document.querySelectorAll(".seg").forEach((seg) => {
    const field = seg.dataset.field;
    seg.innerHTML = seg.dataset.opts.split("|").map((pair) => {
      const [v, label] = pair.split(":");
      const on = state[field] === v ? ' class="on"' : "";
      return '<button type="button" data-v="' + v + '"' + on + '>' + label + '</button>';
    }).join("");
    seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state[field] = b.dataset.v;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onChange(field);
    }));
  });
}

function onChange(field) {
  if (["painFree", "boneJoint"].includes(field)) return runReturn();
  runReadiness();
}

function runReadiness() {
  const input = {
    sleepHours: Number($("sleepHours").value) || undefined,
    sleepQuality: state.sleepQuality, soreness: state.soreness, energy: state.energy,
    stress: state.stress, motivation: state.motivation, illness: state.illness,
  };
  const rhr = Number($("rhr").value); if (rhr > 0) input.restingHrDelta = rhr;
  if (state.hrvStatus !== "normal") input.hrvStatus = state.hrvStatus;
  const rpe = Number($("rpe").value); if (rpe > 0) input.yesterdayRpe = rpe;

  const r = RC.assessReadiness(input);
  const c = BAND_COLOR[r.band];
  $("readout").innerHTML =
    '<div class="band" style="--bc:' + c + '">' +
      '<div class="h">' + r.headline + '</div>' +
      '<div class="rec">' + r.recommendation + '</div>' +
      '<div class="meter"><i style="width:' + r.score + '%"></i></div>' +
    '</div>' +
    '<div class="body">' +
      '<div class="chips">' + r.reasons.map((x) => '<span class="chip">' + x + '</span>').join("") + '</div>' +
      '<div class="reassure">' + r.reassurance + '</div>' +
    '</div>';
}

function runLoad() {
  const r = RC.assessLongRunSpike({ plannedLongestRunKm: Number($("planned").value), longestRunLast30dKm: Number($("longest").value) });
  const c = r.withinComfort ? "var(--ready)" : "var(--ease)";
  $("loadResult").innerHTML =
    '<div class="result-line" style="--rc:' + c + '"><div class="m">' + r.message + '</div><div class="n2">' + r.note + '</div></div>';
}

function runReturn() {
  const r = RC.returnToRunningPlan({ weeksOff: Number($("weeksOff").value), painFreeWalking: state.painFree === "yes", boneOrJointInjury: state.boneJoint === "yes" });
  const c = r.seeProfessionalFirst ? "var(--ease)" : "var(--ready)";
  let html = '<div class="result-line" style="--rc:' + c + '"><div class="m">' + r.message + '</div><div class="n2">' + r.note + '</div></div>';
  if (r.stages.length) {
    html += '<ol class="stages">' + r.stages.map((s) => '<li><span><b>' + s.label + '</b> — ' + s.detail + '</span></li>').join("") + '</ol>';
  }
  $("returnResult").innerHTML = html;
}

["sleepHours", "rhr", "rpe"].forEach((id) => $(id).addEventListener("input", runReadiness));
["planned", "longest"].forEach((id) => $(id).addEventListener("input", runLoad));
$("weeksOff").addEventListener("input", runReturn);
$("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
});

initSegs();
runReadiness();
runLoad();
runReturn();
</script>
</body>
</html>
`;

const outPath = join(here, "today.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
