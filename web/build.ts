// Builds the interactive visual demo (web/index.html).
//
// The engine is pure TypeScript with no runtime dependencies, so esbuild can bundle it (via
// web/entry.ts) into a single browser IIFE exposed as `window.RC`. That bundle is inlined into a
// static HTML page with an input form: the page runs the *real* engine client-side, so whatever
// goal + fitness a visitor enters produces a genuine plan. No server, no external requests.
// Regenerate with:  node web/build.ts   (or: npm run web)

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
<title>Running Coach — Plan Builder</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --base: #2b9eb3; --build: #5fa83c; --peak: #e0863a; --taper: #7a6fd0;
  --eff-easy: #3fa47a; --eff-moderate: #d99a2b; --eff-hard: #d65b36; --eff-none: #9aa8a1;
  --danger: #c0442e;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --base: #3ab0c4; --build: #74bd52; --peak: #eb9748; --taper: #9184e0;
    --eff-easy: #4cb98a; --eff-moderate: #e6ac3e; --eff-hard: #e56f49; --eff-none: #6f7d76;
    --danger: #e8765c;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --base: #2b9eb3; --build: #5fa83c; --peak: #e0863a; --taper: #7a6fd0;
  --eff-easy: #3fa47a; --eff-moderate: #d99a2b; --eff-hard: #d65b36; --eff-none: #9aa8a1;
  --danger: #c0442e;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --base: #3ab0c4; --build: #74bd52; --peak: #eb9748; --taper: #9184e0;
  --eff-easy: #4cb98a; --eff-moderate: #e6ac3e; --eff-hard: #e56f49; --eff-none: #6f7d76;
  --danger: #e8765c;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1040px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 64px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }

header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--base), var(--accent) 55%, var(--peak)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

/* Form */
.builder { margin-top: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: clamp(18px, 2.5vw, 26px); }
.builder .eyebrow { margin-bottom: 14px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 16px; }
.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field.col2 { grid-column: span 2; }
.field label { font-size: 11.5px; font-weight: 600; color: var(--ink-soft); letter-spacing: .01em; }
.field label .hint { color: var(--ink-faint); font-weight: 400; }
input, select { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
input[type="date"] { font-family: var(--mono); }
.time-in { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.toggles { display: flex; gap: 20px; align-items: center; grid-column: 1 / -1; flex-wrap: wrap; }
.toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); cursor: pointer; }
.toggle input { width: auto; accent-color: var(--accent); }
.builder-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
.build-btn { font: inherit; font-size: 14px; font-weight: 600; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 10px; padding: 11px 22px; cursor: pointer; }
.build-btn:hover { filter: brightness(1.06); }
.build-btn:active { transform: translateY(1px); }
.hint-line { font-size: 12px; color: var(--ink-faint); }
.error { display: none; margin-top: 14px; padding: 11px 14px; border-radius: 10px; font-size: 13px; background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); }
.error.show { display: block; }

/* Result */
#result { transition: opacity .18s; }
.goal { margin-top: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: clamp(20px, 3vw, 30px); display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px; align-items: center; }
.goal-main h2 { margin: 6px 0 4px; font-size: clamp(24px, 4vw, 34px); letter-spacing: -.02em; text-wrap: balance; line-height: 1.08; }
.goal-main .when { color: var(--ink-soft); font-size: 14px; }
.goal-main .who { color: var(--ink-faint); font-size: 12.5px; margin-top: 10px; }
.verdict { display: flex; flex-direction: column; gap: 10px; padding-left: 28px; border-left: 1px solid var(--line); }
.pill { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: color-mix(in srgb, var(--pill-c, var(--accent)) 15%, transparent); color: var(--pill-c, var(--accent)); text-transform: capitalize; }
.pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--pill-c, var(--accent)); }
.verdict-rows { display: grid; gap: 7px; font-size: 13px; }
.verdict-rows div { display: flex; justify-content: space-between; gap: 12px; color: var(--ink-soft); }
.verdict-rows b { color: var(--ink); font-weight: 600; }

.stats { margin-top: 14px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 13px 14px; }
.stat .k { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); }
.stat .v { font-size: 20px; margin-top: 3px; letter-spacing: -.01em; }
.stat .v small { font-size: 12px; color: var(--ink-faint); font-family: var(--sans); }

section { margin-top: 34px; }
.sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 6px; }
.sec-head h3 { margin: 0; font-size: 17px; letter-spacing: -.01em; }
.sec-head p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }

.chart-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(14px, 2.5vw, 22px) 16px; }
.ribbon { display: flex; gap: 3px; margin-bottom: 12px; }
.ribbon span { font-size: 11px; font-weight: 600; color: #fff; padding: 4px 8px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: .02em; }
.chart { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; align-items: end; gap: clamp(2px, .5vw, 6px); height: 168px; padding-top: 6px; }
.bar-btn { display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; gap: 5px; height: 100%; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; border-radius: 7px 7px 0 0; }
.bar { width: 100%; border-radius: 5px 5px 2px 2px; min-height: 4px; background: var(--phase); transition: filter .15s; }
.bar-btn:hover .bar { filter: brightness(1.08); }
.bar-btn[aria-pressed="true"] .bar { outline: 2px solid var(--ink); outline-offset: 2px; }
.bar.deload { background-image: repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,.35) 4px, rgba(255,255,255,.35) 7px); }
.bar-lab { font-size: 9.5px; color: var(--ink-faint); text-align: center; font-family: var(--mono); }
.bar-btn[aria-pressed="true"] .bar-lab { color: var(--ink); font-weight: 700; }
.chart-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 10px; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; color: var(--ink-soft); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.legend .dl { background-image: repeating-linear-gradient(135deg, transparent, transparent 3px, var(--ink-faint) 3px, var(--ink-faint) 5px); border: 1px solid var(--line); }
.axis-note { font-size: 11.5px; color: var(--ink-faint); }

.detail { margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.detail-head { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 18px clamp(16px, 2.5vw, 24px); border-bottom: 1px solid var(--line); background: var(--surface-2); }
.wk-badge { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 12px; flex: none; color: #fff; background: var(--phase); }
.wk-badge .num { font-size: 20px; font-weight: 700; line-height: 1; }
.wk-badge small { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; opacity: .9; }
.detail-head .meta { flex: 1 1 240px; }
.detail-head .meta h4 { margin: 0 0 3px; font-size: 15.5px; letter-spacing: -.01em; }
.detail-head .meta .tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 7px; }
.tag { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft); }
.tag.phase { color: #fff; background: var(--phase); border-color: transparent; text-transform: capitalize; }
.tag.deload { color: var(--peak); border-color: color-mix(in srgb, var(--peak) 45%, var(--line)); }
.detail-head .wk-stats { display: flex; gap: 22px; text-align: right; }
.detail-head .wk-stats div .k { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint); }
.detail-head .wk-stats div .v { font-size: 17px; }
.days { display: grid; }
.day-row { display: grid; grid-template-columns: 54px 1fr; gap: 4px; padding: 0 clamp(16px, 2.5vw, 24px); border-bottom: 1px solid var(--line); }
.day-row:last-child { border-bottom: 0; }
.day-name { padding: 14px 0; font-size: 12px; font-weight: 650; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .05em; }
.day-sessions { display: flex; flex-direction: column; }
.sess { display: flex; align-items: flex-start; gap: 12px; padding: 13px 0; border-top: 1px dashed var(--line); }
.sess:first-child { border-top: 0; }
.dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex: none; background: var(--eff-none); }
.dot.easy { background: var(--eff-easy); }
.dot.moderate { background: var(--eff-moderate); }
.dot.hard { background: var(--eff-hard); }
.sess-body { flex: 1; min-width: 0; }
.sess-title { font-size: 14px; font-weight: 550; letter-spacing: -.005em; }
.sess-title .opt { font-size: 11px; color: var(--ink-faint); font-weight: 500; }
.sess-meta { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-top: 5px; font-size: 12px; color: var(--ink-soft); }
.chip { font-family: var(--mono); font-variant-numeric: tabular-nums; background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; padding: 1px 7px; }
.chip.pace { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
.chip.rpe { color: var(--eff-hard); border-color: color-mix(in srgb, var(--eff-hard) 30%, var(--line)); }
.rest .sess-title { color: var(--ink-faint); }

.notes { margin-top: 16px; display: grid; gap: 10px; }
.note { display: flex; gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; font-size: 13.5px; color: var(--ink-soft); }
.note::before { content: ""; width: 3px; border-radius: 2px; background: var(--accent); flex: none; }
footer { margin-top: 32px; font-size: 12px; color: var(--ink-faint); text-align: center; }
footer a { color: var(--accent); }

@media (max-width: 820px) { .grid { grid-template-columns: repeat(2, 1fr); } .field.col2 { grid-column: span 1; } }
@media (max-width: 760px) {
  .goal { grid-template-columns: 1fr; gap: 18px; }
  .verdict { padding-left: 0; border-left: 0; border-top: 1px solid var(--line); padding-top: 18px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .ribbon span { font-size: 0; padding: 4px; }
  .detail-head .wk-stats { text-align: left; }
  .bar-lab { font-size: 0; }
}
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
        <p>Plan builder · the engine runs live in your browser</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <form class="builder" id="builder" novalidate>
    <div class="eyebrow">Your goal &amp; current fitness</div>
    <div class="grid">
      <div class="field">
        <label for="distance">Race</label>
        <select id="distance">
          <option value="1mile">1 mile</option>
          <option value="5k">5K</option>
          <option value="10k">10K</option>
          <option value="half" selected>Half marathon</option>
          <option value="marathon">Marathon</option>
        </select>
      </div>
      <div class="field">
        <label for="target">Target time <span class="hint">h:mm:ss</span></label>
        <input id="target" class="time-in" value="1:30:00" inputmode="numeric" autocomplete="off">
      </div>
      <div class="field">
        <label for="raceDate">Race date</label>
        <input id="raceDate" type="date" value="2027-09-05">
      </div>
      <div class="field">
        <label for="startDate">Start from</label>
        <input id="startDate" type="date" value="2026-07-23">
      </div>
      <div class="field">
        <label for="recentDist">Recent effort</label>
        <select id="recentDist">
          <option value="1609.344">1 mile</option>
          <option value="5000" selected>5K</option>
          <option value="10000">10K</option>
          <option value="21097.5">Half marathon</option>
          <option value="42195">Marathon</option>
        </select>
      </div>
      <div class="field">
        <label for="recentTime">…in a time of <span class="hint">h:mm:ss</span></label>
        <input id="recentTime" class="time-in" value="21:00" inputmode="numeric" autocomplete="off">
      </div>
      <div class="field">
        <label for="days">Days / week</label>
        <select id="days">
          <option>3</option><option>4</option><option selected>5</option><option>6</option><option>7</option>
        </select>
      </div>
      <div class="field">
        <label for="experience">Experience</label>
        <select id="experience">
          <option value="beginner">Beginner</option>
          <option value="recreational">Recreational</option>
          <option value="competitive" selected>Competitive</option>
        </select>
      </div>
      <div class="field">
        <label for="maxHr">Max HR <span class="hint">optional</span></label>
        <input id="maxHr" type="number" min="120" max="230" value="190" inputmode="numeric">
      </div>
      <div class="field">
        <label for="restingHr">Resting HR <span class="hint">optional</span></label>
        <input id="restingHr" type="number" min="30" max="100" value="48" inputmode="numeric">
      </div>
      <div class="toggles">
        <label class="toggle"><input type="checkbox" id="strength" checked> Include strength &amp; conditioning</label>
        <label class="toggle"><input type="checkbox" id="returning" checked> Returning from injury / lay-off</label>
      </div>
    </div>
    <div class="builder-foot">
      <button class="build-btn" type="submit">Build my plan</button>
      <div class="hint-line">Nothing leaves your device — the whole engine runs here.</div>
    </div>
    <div class="error" id="error" role="alert"></div>
  </form>

  <div id="result">
    <div class="goal" id="goal"></div>
    <div class="stats" id="stats"></div>

    <section>
      <div class="sec-head">
        <h3>Training block</h3>
        <p>Bar height = weekly volume · colour = phase · hatched = deload</p>
      </div>
      <div class="chart-card">
        <div class="ribbon" id="ribbon"></div>
        <div class="chart" id="chart" role="group" aria-label="Weekly volume — select a week"></div>
        <div class="chart-foot">
          <div class="legend" id="legend"></div>
          <div class="axis-note num" id="peakNote"></div>
        </div>
      </div>
    </section>

    <section>
      <div class="sec-head"><h3>Week detail</h3><p>Select any week above</p></div>
      <div class="detail" id="detail"></div>
    </section>

    <section>
      <div class="sec-head"><h3>Coaching notes</h3></div>
      <div class="notes" id="notes"></div>
    </section>
  </div>

  <footer>
    Evidence-based training engine · deterministic, computed client-side · <span id="genAt" class="num"></span>.
    Not affiliated with any commercial running app.
  </footer>
</div>

<script>${bundleJs}</script>
<script>
const PHASE_COLORS = { base: "var(--base)", build: "var(--build)", peak: "var(--peak)", taper: "var(--taper)" };
const VERDICT_COLORS = { comfortable: "var(--eff-easy)", achievable: "var(--accent)", ambitious: "var(--peak)", unrealistic: "var(--danger)" };
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const $ = (id) => document.getElementById(id);
let DATA = null;

function renderGoal() {
  const g = DATA.goal, f = DATA.feasibility;
  const pc = VERDICT_COLORS[f.verdict] || "var(--accent)";
  $("goal").innerHTML =
    '<div class="goal-main">' +
      '<div class="eyebrow">Goal race</div>' +
      '<h2>' + g.race + ' · <span class="num">' + g.target + '</span></h2>' +
      '<div class="when">' + g.raceDate + ' — a ' + DATA.summary.totalWeeks + '-week horizon from ' + g.startDate + '</div>' +
      '<div class="who">' + DATA.athlete.summary + '</div>' +
    '</div>' +
    '<div class="verdict">' +
      '<span class="pill" style="--pill-c:' + pc + '">' + f.verdict + '</span>' +
      '<div class="verdict-rows">' +
        '<div>Current predicted <b class="num">' + f.currentPredicted + '</b></div>' +
        '<div>Improvement needed <b class="num">' + f.required + '%</b></div>' +
        '<div>Model projects <b class="num">' + f.projected + '%</b> achievable</div>' +
      '</div>' +
    '</div>';
}

function renderStats() {
  const s = DATA.summary, p = DATA.paces;
  const cells = [
    { k: "Structured", v: s.structuredWeeks, u: "wks" },
    { k: "Peak volume", v: s.peakKm, u: "km/wk" },
    { k: "Quality total", v: s.totalQuality, u: "sessions" },
    { k: "Intensity", v: s.model, u: "" },
    { k: "Goal pace", v: p.goal, u: "" },
    { k: "Easy pace", v: p.easy, u: "" },
  ];
  $("stats").innerHTML = cells.map((c) =>
    '<div class="stat"><div class="k">' + c.k + '</div><div class="v num">' + c.v + (c.u ? ' <small>' + c.u + '</small>' : '') + '</div></div>'
  ).join("");
}

function renderRibbon() {
  const runs = [];
  for (const w of DATA.weeks) {
    const last = runs[runs.length - 1];
    if (last && last.phase === w.phase) last.count++;
    else runs.push({ phase: w.phase, count: 1 });
  }
  $("ribbon").innerHTML = runs.map((r) =>
    '<span style="flex:' + r.count + ';background:' + PHASE_COLORS[r.phase] + '">' + r.phase.charAt(0).toUpperCase() + r.phase.slice(1) + '</span>'
  ).join("");
}

function renderChart() {
  const peak = DATA.summary.peakKm || 1;
  $("chart").innerHTML = DATA.weeks.map((w) => {
    const h = Math.max(6, Math.round((w.distanceKm / peak) * 100));
    return '<button class="bar-btn" type="button" data-wk="' + w.index + '" aria-pressed="false" aria-label="Week ' + w.index + ', ' + w.phase + (w.isDeload ? ', deload' : '') + ', ' + w.distanceKm + ' kilometres">' +
      '<div class="bar' + (w.isDeload ? ' deload' : '') + '" style="height:' + h + '%;--phase:' + PHASE_COLORS[w.phase] + '"></div>' +
      '<div class="bar-lab">' + w.index + '</div></button>';
  }).join("");
  $("chart").querySelectorAll(".bar-btn").forEach((b) => b.addEventListener("click", () => selectWeek(Number(b.dataset.wk))));
  $("peakNote").textContent = "peak " + DATA.summary.peakKm + " km/wk";
  $("legend").innerHTML = ["base", "build", "peak", "taper"].map((ph) =>
    '<span><i style="background:' + PHASE_COLORS[ph] + '"></i>' + ph.charAt(0).toUpperCase() + ph.slice(1) + '</span>'
  ).join("") + '<span><i class="dl"></i>Deload</span>';
}

function renderDetail(w) {
  const phaseColor = PHASE_COLORS[w.phase];
  const byDay = {};
  for (const s of w.sessions) (byDay[s.day] = byDay[s.day] || []).push(s);
  const rows = DAY_ORDER.filter((d) => byDay[d]).map((d) => {
    const items = byDay[d].map((s) => {
      const meta = ['<span class="chip">' + s.durMin + '′' + (s.distKm ? ' · ' + s.distKm + ' km' : '') + '</span>'];
      if (s.pace) meta.push('<span class="chip pace">' + s.pace + '</span>');
      if (s.rpe) meta.push('<span class="chip rpe">RPE ' + s.rpe + '</span>');
      const isRest = s.type === "rest";
      return '<div class="sess' + (isRest ? ' rest' : '') + '"><span class="dot ' + s.effort + '"></span>' +
        '<div class="sess-body"><div class="sess-title">' + s.title + (s.optional ? ' <span class="opt">(optional)</span>' : '') + '</div>' +
        (isRest ? '' : '<div class="sess-meta">' + meta.join('') + '</div>') + '</div></div>';
    }).join("");
    return '<div class="day-row"><div class="day-name">' + d + '</div><div class="day-sessions">' + items + '</div></div>';
  }).join("");
  $("detail").innerHTML =
    '<div class="detail-head" style="--phase:' + phaseColor + '">' +
      '<div class="wk-badge" style="--phase:' + phaseColor + '"><span class="num">' + w.index + '</span><small>week</small></div>' +
      '<div class="meta"><h4>' + w.focus + '</h4><div class="eyebrow">Starts ' + w.startFull + '</div>' +
        '<div class="tags"><span class="tag phase" style="--phase:' + phaseColor + '">' + w.phase + '</span>' +
        (w.isDeload ? '<span class="tag deload">Deload week</span>' : '') + '<span class="tag">' + w.quality + ' quality</span></div></div>' +
      '<div class="wk-stats"><div><div class="k">Volume</div><div class="v num">' + w.distanceKm + '<small> km</small></div></div>' +
        '<div><div class="k">Long run</div><div class="v num">' + w.longRunMin + '′</div></div></div>' +
    '</div><div class="days">' + rows + '</div>';
}

function selectWeek(index) {
  const w = DATA.weeks.find((x) => x.index === index);
  if (!w) return;
  document.querySelectorAll(".bar-btn").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.wk) === index ? "true" : "false"));
  renderDetail(w);
}

function renderNotes() {
  $("notes").innerHTML = DATA.notes.map((n) => '<div class="note"><span>' + n + '</span></div>').join("");
}

function readInputs() {
  // Times must be entered as m:ss or h:mm:ss — a bare number would be read as seconds and mislead
  // the plan (e.g. "90" → 90 seconds, not 1:30:00).
  const mmss = (s) => /^\\d{1,2}:[0-5]\\d$/.test(s) || /^\\d{1,2}:[0-5]\\d:[0-5]\\d$/.test(s);
  const distance = $("distance").value;
  const targetRaw = $("target").value.trim();
  if (!mmss(targetRaw)) throw new Error("Enter your target time as h:mm:ss or m:ss, e.g. 1:30:00.");
  const targetTimeSeconds = RC.parseDuration(targetRaw);
  const raceDateIso = $("raceDate").value;
  const startDateIso = $("startDate").value || undefined;
  if (!raceDateIso) throw new Error("Pick a race date.");
  const recentRaw = $("recentTime").value.trim();
  if (!mmss(recentRaw)) throw new Error("Enter your recent time as m:ss, e.g. 21:00.");
  const recentTimeSeconds = RC.parseDuration(recentRaw);
  const recentPace = recentTimeSeconds / (Number($("recentDist").value) / 1000);
  if (recentPace < 120 || recentPace > 720) throw new Error("That recent time looks off for the distance — please check it.");
  const athlete = {
    daysPerWeek: Number($("days").value),
    recent: { distanceMeters: Number($("recentDist").value), timeSeconds: recentTimeSeconds },
    experience: $("experience").value,
    includeStrength: $("strength").checked,
    returningFromInjury: $("returning").checked,
  };
  const maxHr = Number($("maxHr").value), restingHr = Number($("restingHr").value);
  if (maxHr > 0) athlete.maxHr = maxHr;
  if (restingHr > 0) athlete.restingHr = restingHr;
  const goal = { distance, targetTimeSeconds, raceDateIso, startDateIso };
  return { athlete, goal };
}

function build() {
  const err = $("error");
  let inputs;
  try {
    inputs = readInputs();
  } catch (e) {
    err.textContent = (e && e.message) ? e.message : "Please check your entries.";
    err.classList.add("show");
    return;
  }
  try {
    DATA = RC.buildPlanSummary(inputs.athlete, inputs.goal);
  } catch (e) {
    err.textContent = "That goal can't be planned yet: " + (e && e.message ? e.message : "try a race date further out, or a different target.");
    err.classList.add("show");
    return;
  }
  err.classList.remove("show");
  renderGoal();
  renderStats();
  renderRibbon();
  renderChart();
  renderNotes();
  $("genAt").textContent = DATA.generatedAt;
  selectWeek(DATA.defaultWeekIndex);
}

$("builder").addEventListener("submit", (e) => { e.preventDefault(); build(); });
$("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
});

build();
</script>
</body>
</html>
`;

const outPath = join(here, "index.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB, engine bundle ${(bundleJs.length / 1024).toFixed(1)} KB)`);
