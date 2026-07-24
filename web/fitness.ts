// Builds the fitness screen (web/fitness.html). Same honest engine underneath (buildFitnessProfile,
// with confidence ranges and provenance) — but the presentation is plain-English for everyday
// runners: it leads with a pace you can actually train at, describes each strength in one sentence,
// and tucks every number, unit and method behind an optional "Show the science" toggle. Nobody
// should need to know what "VO₂max" or "critical speed" means to use this.
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
<title>Running Coach — Your Running</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --strong: #4b9e2f; --mid: #2b9eb3; --soft: #d98a2a; --muted: #8894b0;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --strong: #6bbf46; --mid: #3ab0c4; --soft: #eb9748; --muted: #8d99b6;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --strong: #4b9e2f; --mid: #2b9eb3; --soft: #d98a2a; --muted: #8894b0;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --strong: #6bbf46; --mid: #3ab0c4; --soft: #eb9748; --muted: #8d99b6;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 860px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 72px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--mid), var(--accent) 55%, var(--strong)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.lede { margin-top: 24px; }
.lede h2 { font-size: clamp(23px, 4vw, 32px); letter-spacing: -.02em; margin: 6px 0 8px; text-wrap: balance; }
.lede p { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 60ch; }

.builder { margin-top: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(16px,2.5vw,24px); }
.subhead { font-size: 13px; font-weight: 650; color: var(--ink); margin: 0 0 4px; }
.subnote { font-size: 12.5px; color: var(--ink-faint); margin: 0 0 12px; }
.effort { display: grid; grid-template-columns: 1fr 130px 34px; gap: 10px; align-items: end; margin-bottom: 10px; }
.field span { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink-soft); margin-bottom: 5px; }
select, input { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
input.time { font-family: var(--mono); }
select:focus, input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.rm { border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-faint); border-radius: 9px; cursor: pointer; font-size: 16px; height: 38px; }
.rm:hover { color: var(--soft); border-color: var(--soft); }
.addbtn { font: inherit; font-size: 13px; color: var(--accent); background: none; border: 1px dashed var(--line); border-radius: 9px; padding: 8px 12px; cursor: pointer; margin-top: 2px; }
.addbtn:hover { border-color: var(--accent); }
.more { margin-top: 16px; }
.more > summary { font-size: 13px; color: var(--accent); cursor: pointer; list-style: none; }
.more > summary::-webkit-details-marker { display: none; }
.more > summary::before { content: "▸ "; }
.more[open] > summary::before { content: "▾ "; }
.more .inner { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.builder-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
.build-btn { font: inherit; font-size: 14px; font-weight: 600; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 10px; padding: 11px 22px; cursor: pointer; }
.build-btn:hover { filter: brightness(1.06); }
.hint-line { font-size: 12px; color: var(--ink-faint); }
.error { display: none; margin-top: 12px; font-size: 13px; color: var(--soft); }
.error.show { display: block; }

.result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 26px 0 4px; flex-wrap: wrap; }
.result-head h3 { margin: 0; font-size: 18px; letter-spacing: -.01em; }
.sci-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-soft); cursor: pointer; }
.sci-toggle input { width: auto; accent-color: var(--accent); }

.hero { margin-top: 12px; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface)); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 22px clamp(18px,3vw,26px); }
.hero .lab { font-size: 12.5px; color: var(--ink-soft); font-weight: 600; }
.hero .pace { font-size: clamp(38px, 8vw, 54px); font-weight: 750; letter-spacing: -.03em; line-height: 1; margin: 6px 0 6px; }
.hero .pace small { font-size: 20px; color: var(--ink-faint); font-weight: 500; letter-spacing: 0; }
.hero .say { font-size: 13.5px; color: var(--ink-soft); max-width: 54ch; }
.hero .conf { font-size: 12px; color: var(--ink-faint); margin-top: 8px; }

.cards { margin-top: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 16px 17px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c, var(--muted)); }
.card.q { opacity: .9; }
.card h4 { margin: 0; font-size: 14px; letter-spacing: -.005em; }
.card .plain { font-size: 12.5px; color: var(--ink-faint); margin-top: 3px; }
.card .read { font-size: 16px; font-weight: 650; margin-top: 11px; color: var(--rc, var(--ink)); }
.card .read.q { font-size: 14px; font-weight: 550; color: var(--ink-faint); }
.card .conf { font-size: 11.5px; color: var(--ink-faint); margin-top: 6px; }
.meter { display: flex; gap: 4px; margin-top: 11px; }
.meter i { height: 8px; flex: 1; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); }
.meter i.on { background: var(--c, var(--mid)); border-color: transparent; }

.science { display: none; margin-top: 9px; border-top: 1px dashed var(--line); padding-top: 8px; font-size: 11.5px; color: var(--ink-faint); }
body.sci .science { display: block; }
.science .n { font-family: var(--mono); color: var(--ink-soft); }
.sci-only { display: none; }
body.sci .sci-only { display: block; }
.cs-card { margin-top: 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; font-size: 12.5px; color: var(--ink-soft); }
.cs-card .n { font-family: var(--mono); color: var(--ink); }

footer { margin-top: 28px; font-size: 12px; color: var(--ink-faint); text-align: center; }
@media (max-width: 600px) { .cards, .more .inner { grid-template-columns: 1fr; } }
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
        <p>Your running · worked out on your device</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="lede">
    <div class="eyebrow">Know your running</div>
    <h2>Where you're strong, in plain English</h2>
    <p>Pop in a recent run or race and we'll show what it says about your running — starting with a
    pace you can actually train at. No jargon needed. The more you add, the sharper it gets.</p>
  </div>

  <div class="builder">
    <p class="subhead">Your recent runs</p>
    <p class="subnote">A parkrun, a race, or any hard effort you timed. One is enough to start; two of different lengths tells us more.</p>
    <div id="efforts"></div>
    <button class="addbtn" id="addEffort" type="button">+ Add another run</button>
    <details class="more">
      <summary>Add more detail (optional)</summary>
      <div class="inner">
        <label class="field"><span>Slow-down on a long run <span style="color:var(--ink-faint);font-weight:400">%, if you know it</span></span><input type="number" id="decoupling" step="0.5" min="0" placeholder="e.g. 5"></label>
      </div>
    </details>
    <div class="builder-foot">
      <button class="build-btn" id="buildBtn" type="button">See my running</button>
      <div class="hint-line">Everything stays on your device.</div>
    </div>
    <div class="error" id="error"></div>
  </div>

  <div id="results" style="display:none">
    <div class="result-head">
      <h3>Here's your running</h3>
      <label class="sci-toggle"><input type="checkbox" id="sciToggle"> Show the science</label>
    </div>
    <div class="hero" id="hero"></div>
    <div class="cards" id="cards"></div>
    <div class="cs-card sci-only" id="csCard"></div>
    <p class="conf sci-only" id="summary" style="font-size:12px;color:var(--ink-faint);margin-top:12px"></p>
  </div>

  <footer>These are friendly estimates from your runs — the more you log, the better they get. Not a lab test, and not medical advice.</footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
const DISTANCES = [["1500","1500 m"],["1609.344","1 mile"],["3000","3 km"],["5000","5 km (parkrun)"],["10000","10 km"],["21097.5","Half marathon"]];

let effortRows = [
  { dist: "5000", time: "25:00" },
];

function renderEfforts() {
  $("efforts").innerHTML = effortRows.map((e, i) =>
    '<div class="effort">' +
      '<label class="field"><span>How far</span><select data-i="' + i + '" data-k="dist">' +
        DISTANCES.map(([v, l]) => '<option value="' + v + '"' + (v === e.dist ? " selected" : "") + '>' + l + '</option>').join("") +
      '</select></label>' +
      '<label class="field"><span>Your time (m:ss)</span><input class="time" data-i="' + i + '" data-k="time" value="' + e.time + '" inputmode="numeric"></label>' +
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

function fmtPace(secPerKm) {
  const s = Math.round(secPerKm);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
// Friendly words for confidence — no clinical labels.
function confSay(c) {
  return c === "moderate" ? "A good read from your runs."
    : c === "low" ? "A rough guess — add another recent run to sharpen it."
    : "";
}
function enduranceLevel(vo2) { // 1..4
  return vo2 < 40 ? 1 : vo2 < 50 ? 2 : vo2 < 60 ? 3 : 4;
}
const ENDURANCE_WORD = { 1: "Building your base", 2: "A solid base", 3: "Strong endurance", 4: "Very strong endurance" };
const ENDURANCE_COLOR = { 1: "var(--soft)", 2: "var(--mid)", 3: "var(--strong)", 4: "var(--strong)" };

function scienceBlock(e) {
  const range = RC.rangeText(e, e.unit && (e.unit.startsWith("%") || e.unit.indexOf("m/s") >= 0) ? 1 : 0);
  const val = e.confidence === "none" ? "not enough data yet" : (e.unit === "s/km" ? fmtPace(e.low) + "–" + fmtPace(e.high) + " /km" : range + " " + e.unit);
  return '<div class="science"><b>' + e.metric + ':</b> <span class="n">' + val + '</span>. ' +
    e.method + '.' + (e.limitations ? ' ' + e.limitations : '') + '</div>';
}

function build() {
  const err = $("error");
  let efforts;
  try {
    efforts = effortRows.map((e) => ({ distanceMeters: Number(e.dist), timeSeconds: RC.parseDuration(e.time) }));
  } catch (e) { err.textContent = "Check your times — use m:ss (e.g. 25:00)."; err.classList.add("show"); return; }
  err.classList.remove("show");

  const input = { efforts };
  const dec = Number($("decoupling").value); if (dec > 0) input.longRunDecouplingPct = dec;

  let p;
  try { p = RC.buildFitnessProfile(input); }
  catch (e) { err.textContent = (e && e.message) || "Couldn't read that — check your run details."; err.classList.add("show"); return; }

  $("results").style.display = "block";

  // Hero: the strong, steady pace — the one genuinely useful, trainable number.
  const t = p.thresholdSpeed;
  const midPace = t.value;
  $("hero").innerHTML =
    '<div class="lab">Your strong, steady pace</div>' +
    '<div class="pace num">' + fmtPace(midPace) + ' <small>/km</small></div>' +
    '<div class="say">The pace you can hold for a long, hard effort — think tempo runs. A great anchor for training and pacing longer races.</div>' +
    (confSay(t.confidence) ? '<div class="conf">' + confSay(t.confidence) + '</div>' : '') +
    scienceBlock(t);

  // Plain-English cards for the other dimensions.
  const cards = [];

  // Endurance base (VO₂max, translated).
  const a = p.aerobicCapacity;
  const lvl = enduranceLevel(a.value);
  cards.push({
    c: ENDURANCE_COLOR[lvl], title: "Endurance base", plain: "How big your aerobic engine is — your staying power.",
    readHtml: '<div class="read" style="--rc:' + ENDURANCE_COLOR[lvl] + '">' + ENDURANCE_WORD[lvl] + '</div>' +
      '<div class="meter">' + [1,2,3,4].map((i) => '<i class="' + (i <= lvl ? "on" : "") + '" style="--c:' + ENDURANCE_COLOR[lvl] + '"></i>').join("") + '</div>',
    conf: confSay(a.confidence), sci: scienceBlock(a),
  });

  // Strength when tired (durability).
  const d = p.durability;
  let dRead;
  if (d.confidence === "none") dRead = '<div class="read q">We\\'ll learn this from your long runs</div>';
  else if (d.value <= 5) dRead = '<div class="read" style="--rc:var(--strong)">You hold pace well when tired</div>';
  else dRead = '<div class="read" style="--rc:var(--soft)">You fade a little late — worth training</div>';
  cards.push({
    c: d.confidence === "none" ? "var(--muted)" : (d.value <= 5 ? "var(--strong)" : "var(--soft)"),
    title: "Strength when tired", plain: "How well you hold your pace late in long runs.",
    readHtml: dRead, conf: d.confidence === "none" ? "" : confSay(d.confidence), sci: scienceBlock(d),
  });

  // How much you can handle (training tolerance).
  cards.push({
    c: "var(--muted)", title: "How much you can handle", plain: "How well you soak up training over time.",
    readHtml: '<div class="read q">This builds up as you log runs</div>',
    conf: "", sci: scienceBlock(p.trainingTolerance), q: true,
  });

  $("cards").innerHTML = cards.map((c) =>
    '<div class="card ' + (c.q ? "q" : "") + '" style="--c:' + c.c + '">' +
      '<h4>' + c.title + '</h4><div class="plain">' + c.plain + '</div>' +
      c.readHtml +
      (c.conf ? '<div class="conf">' + c.conf + '</div>' : '') +
      c.sci +
    '</div>'
  ).join("");

  // Science-only extras.
  const cs = p.criticalSpeed;
  $("csCard").innerHTML = cs && cs.criticalSpeedMps > 0
    ? 'Critical-speed model from <span class="n">' + cs.nEfforts + '</span> efforts (R²=<span class="n">' + cs.rSquared + '</span>): critical speed <span class="n">' + cs.criticalSpeedMps.toFixed(2) + ' m/s</span> (' + fmtPace(cs.csPaceSecPerKm) + '/km), D′ <span class="n">' + cs.dPrimeMeters + ' m</span>.' + (cs.limitations ? ' ' + cs.limitations : '')
    : 'Add a second run of a different length to compute a critical-speed model.';
  $("summary").textContent = p.summary;
}

$("addEffort").addEventListener("click", () => { effortRows.push({ dist: "10000", time: "55:00" }); renderEfforts(); });
$("buildBtn").addEventListener("click", build);
$("sciToggle").addEventListener("change", (e) => document.body.classList.toggle("sci", e.target.checked));
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
