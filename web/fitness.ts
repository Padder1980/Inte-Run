// Builds the fitness-profile screen (web/fitness.html): enter one or more recent efforts and it
// shows a multi-dimensional profile — separate estimates, each with a confidence RANGE and its
// provenance and limitations, plus a critical-speed model when two+ efforts allow it. Directly
// embodies the brief's §1 (don't reduce fitness to one score) and §16 (uncertainty on every metric).
// Regenerate with:  node web/fitness.ts   (or: npm run web)

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
<title>Running Coach — Fitness Profile</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --none: #8894b0; --low: #d98a2a; --moderate: #2b9eb3; --high: #4b9e2f;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --none: #8d99b6; --low: #eb9748; --moderate: #3ab0c4; --high: #6bbf46;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --none: #8894b0; --low: #d98a2a; --moderate: #2b9eb3; --high: #4b9e2f;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --none: #8d99b6; --low: #eb9748; --moderate: #3ab0c4; --high: #6bbf46;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 900px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 72px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--moderate), var(--accent) 55%, var(--low)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.lede { margin-top: 24px; }
.lede h2 { font-size: clamp(23px, 4vw, 32px); letter-spacing: -.02em; margin: 6px 0 8px; text-wrap: balance; }
.lede p { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 64ch; }

.builder { margin-top: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(16px,2.5vw,24px); }
.subhead { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; margin: 0 0 10px; }
.effort { display: grid; grid-template-columns: 1fr 130px 34px; gap: 10px; align-items: end; margin-bottom: 10px; }
.field span { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink-soft); margin-bottom: 5px; }
select, input { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
input.time { font-family: var(--mono); }
select:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.rm { border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-faint); border-radius: 9px; cursor: pointer; font-size: 16px; height: 38px; }
.rm:hover { color: var(--low); border-color: var(--low); }
.addbtn { font: inherit; font-size: 13px; color: var(--accent); background: none; border: 1px dashed var(--line); border-radius: 9px; padding: 8px 12px; cursor: pointer; margin-top: 2px; }
.addbtn:hover { border-color: var(--accent); }
.optional { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.builder-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
.build-btn { font: inherit; font-size: 14px; font-weight: 600; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 10px; padding: 11px 22px; cursor: pointer; }
.build-btn:hover { filter: brightness(1.06); }
.hint-line { font-size: 12px; color: var(--ink-faint); }
.error { display: none; margin-top: 12px; font-size: 13px; color: var(--low); }
.error.show { display: block; }

.cs-card { margin-top: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--moderate) 12%, var(--surface)), var(--surface)); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 18px clamp(16px,2.5vw,22px); display: none; }
.cs-card.show { display: block; }
.cs-card .row { display: flex; flex-wrap: wrap; gap: 22px; align-items: baseline; }
.cs-card .big { font-size: 30px; font-weight: 700; letter-spacing: -.02em; }
.cs-card .lab { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint); }
.cs-card .metric { font-size: 20px; font-weight: 650; }
.cs-card .note { font-size: 12.5px; color: var(--ink-soft); margin-top: 10px; }

.summary { margin-top: 22px; font-size: 13px; color: var(--ink-soft); }
.grid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.est { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 16px 17px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.est::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c, var(--none)); }
.est.none { opacity: .82; }
.est .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.est h4 { margin: 0; font-size: 13.5px; letter-spacing: -.005em; }
.pill { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 999px; color: #fff; background: var(--c, var(--none)); white-space: nowrap; }
.est .val { font-size: 27px; font-weight: 700; letter-spacing: -.02em; margin: 8px 0 1px; }
.est .val small { font-size: 13px; color: var(--ink-faint); font-weight: 500; font-family: var(--sans); }
.est .val.dim { color: var(--ink-faint); font-size: 19px; font-weight: 600; }
.est .method { font-size: 11.5px; color: var(--ink-soft); margin-top: 6px; }
.est .limit { font-size: 11.5px; color: var(--ink-faint); margin-top: 6px; border-top: 1px dashed var(--line); padding-top: 7px; }
footer { margin-top: 28px; font-size: 12px; color: var(--ink-faint); text-align: center; }
@media (max-width: 600px) { .grid, .optional { grid-template-columns: 1fr; } }
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
        <p>Fitness profile · estimated in your browser</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="lede">
    <div class="eyebrow">Not one score</div>
    <h2>Your fitness, in the dimensions that actually matter</h2>
    <p>Fitness isn't a single number. Enter a recent effort or two and this estimates each dimension
    separately — always as a range with its confidence, and honestly blank where the data isn't there.</p>
  </div>

  <div class="builder">
    <div class="subhead">Recent efforts (races or time trials)</div>
    <div id="efforts"></div>
    <button class="addbtn" id="addEffort" type="button">+ Add another effort</button>
    <div class="optional">
      <label class="field"><span>Max sprint speed <span style="color:var(--ink-faint);font-weight:400">optional, m/s</span></span><input type="number" id="sprint" step="0.1" min="0" placeholder="e.g. 8.5"></label>
      <label class="field"><span>Long-run pace/HR drift <span style="color:var(--ink-faint);font-weight:400">optional, %</span></span><input type="number" id="decoupling" step="0.1" min="0" placeholder="e.g. 5.0"></label>
    </div>
    <div class="builder-foot">
      <button class="build-btn" id="buildBtn" type="button">Build profile</button>
      <div class="hint-line">Two efforts of different durations unlock critical speed.</div>
    </div>
    <div class="error" id="error"></div>
  </div>

  <div class="cs-card" id="csCard"></div>
  <div class="summary" id="summary"></div>
  <div class="grid" id="grid"></div>

  <footer>Estimates computed on your device from your efforts. Ranges, not certainties — and not a lab test.</footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
const DISTANCES = [["1500","1500 m"],["1609.344","1 mile"],["3000","3000 m"],["5000","5 km"],["10000","10 km"],["21097.5","Half"]];
const CONF_LABEL = { none: "No data", low: "Low", moderate: "Moderate", high: "High" };
const CONF_VAR = { none: "var(--none)", low: "var(--low)", moderate: "var(--moderate)", high: "var(--high)" };

let effortRows = [
  { dist: "3000", time: "12:00" },
  { dist: "5000", time: "21:00" },
];

function renderEfforts() {
  $("efforts").innerHTML = effortRows.map((e, i) =>
    '<div class="effort">' +
      '<label class="field"><span>Distance</span><select data-i="' + i + '" data-k="dist">' +
        DISTANCES.map(([v, l]) => '<option value="' + v + '"' + (v === e.dist ? " selected" : "") + '>' + l + '</option>').join("") +
      '</select></label>' +
      '<label class="field"><span>Time (m:ss)</span><input class="time" data-i="' + i + '" data-k="time" value="' + e.time + '" inputmode="numeric"></label>' +
      (effortRows.length > 1 ? '<button class="rm" data-rm="' + i + '" type="button" title="Remove">×</button>' : '<span></span>') +
    '</div>'
  ).join("");
  $("efforts").querySelectorAll("select,input").forEach((el) =>
    el.addEventListener("change", () => { effortRows[+el.dataset.i][el.dataset.k] = el.value; })
  );
  $("efforts").querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => { effortRows.splice(+b.dataset.rm, 1); renderEfforts(); })
  );
}

function build() {
  const err = $("error");
  let efforts;
  try {
    efforts = effortRows.map((e) => ({ distanceMeters: Number(e.dist), timeSeconds: RC.parseDuration(e.time) }));
  } catch (e) {
    err.textContent = "Check your times — use m:ss or h:mm:ss."; err.classList.add("show"); return;
  }
  err.classList.remove("show");
  const input = { efforts };
  const sprint = Number($("sprint").value); if (sprint > 0) input.maxSprintSpeedMps = sprint;
  const dec = Number($("decoupling").value); if (dec > 0) input.longRunDecouplingPct = dec;

  let profile;
  try { profile = RC.buildFitnessProfile(input); }
  catch (e) { err.textContent = e && e.message ? e.message : "Couldn't build a profile from that."; err.classList.add("show"); return; }

  renderCs(profile.criticalSpeed);
  $("summary").textContent = profile.summary;
  const order = ["aerobicCapacity", "thresholdSpeed", "durability", "speedReserve", "economy", "trainingTolerance"];
  $("grid").innerHTML = order.map((k) => estCard(profile[k])).join("");
}

function fmtPace(secPerKm) {
  const s = Math.round(secPerKm);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function renderCs(cs) {
  const card = $("csCard");
  if (!cs || cs.criticalSpeedMps <= 0) { card.classList.remove("show"); return; }
  card.classList.add("show");
  card.innerHTML =
    '<div class="lab">Critical speed model · ' + cs.nEfforts + ' efforts · R²=' + cs.rSquared + '</div>' +
    '<div class="row" style="margin-top:8px">' +
      '<div><div class="metric num">' + fmtPace(cs.csPaceSecPerKm) + '<small style="font-size:14px;color:var(--ink-faint)"> /km</small></div><div class="lab">Critical speed pace</div></div>' +
      '<div><div class="big num">' + cs.criticalSpeedMps.toFixed(2) + '</div><div class="lab">m/s</div></div>' +
      '<div><div class="big num">' + cs.dPrimeMeters + '</div><div class="lab">D′ (m) above CS</div></div>' +
    '</div>' +
    '<div class="note">' + (cs.limitations || "The slope of distance against time across your efforts — near, but not exactly, your threshold.") + '</div>';
}

function estCard(e) {
  const isNone = e.confidence === "none";
  const c = CONF_VAR[e.confidence];
  let valHtml;
  if (isNone) {
    valHtml = '<div class="val dim">Not enough data</div>';
  } else if (e.unit === "s/km") {
    valHtml = '<div class="val num">' + fmtPace(e.low) + '–' + fmtPace(e.high) + ' <small>/km</small></div>';
  } else {
    valHtml = '<div class="val num">' + RC.rangeText(e, e.unit === "m/s above vVO₂max" || e.unit.startsWith("%") ? 1 : 0) + ' <small>' + e.unit + '</small></div>';
  }
  return '<div class="est ' + (isNone ? "none" : "") + '" style="--c:' + c + '">' +
    '<div class="top"><h4>' + e.metric + '</h4><span class="pill" style="--c:' + c + '">' + CONF_LABEL[e.confidence] + '</span></div>' +
    valHtml +
    '<div class="method">' + e.method + '</div>' +
    (e.limitations ? '<div class="limit">' + e.limitations + '</div>' : '') +
    '</div>';
}

$("addEffort").addEventListener("click", () => { effortRows.push({ dist: "10000", time: "44:00" }); renderEfforts(); });
$("buildBtn").addEventListener("click", build);
$("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
});

renderEfforts();
build();
</script>
</body>
</html>
`;

const outPath = join(here, "fitness.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
