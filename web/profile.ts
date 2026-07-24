// Builds the profile screen (web/profile.html): your "runner type" in plain words, age-aware
// guidance for masters runners, and — the distinctive bit — how the app weighs each piece of advice
// for YOU, flagging when the research wasn't done on people like you. Runs the real engine.
// Regenerate with:  node web/profile.ts   (or: npm run web)

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
<title>Running Coach — Your Profile</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --well: #4b9e2f; --guide: #2b9eb3; --limited: #d98a2a;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --well: #6bbf46; --guide: #3ab0c4; --limited: #eb9748;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --well: #4b9e2f; --guide: #2b9eb3; --limited: #d98a2a;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --well: #6bbf46; --guide: #3ab0c4; --limited: #eb9748;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 800px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 72px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--guide), var(--accent) 55%, var(--well)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.lede { margin-top: 24px; }
.lede h2 { font-size: clamp(23px, 4vw, 32px); letter-spacing: -.02em; margin: 6px 0 8px; text-wrap: balance; }
.lede p { margin: 0; color: var(--ink-soft); font-size: 14.5px; max-width: 62ch; }

.card { margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px clamp(16px,2.5vw,24px); }
.card > h3 { margin: 0 0 3px; font-size: 17px; letter-spacing: -.01em; }
.card > .hint { margin: 0 0 14px; font-size: 12.5px; color: var(--ink-faint); }

.form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 16px; }
.field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.field label { font-size: 11.5px; font-weight: 600; color: var(--ink-soft); }
.field .hintx { color: var(--ink-faint); font-weight: 400; }
input, select { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
input[type="number"], input.time { font-family: var(--mono); }
input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.err { font-size: 11.5px; color: var(--limited); min-height: 0; }
.err:empty { display: none; }

.type { margin-top: 4px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.type .big { font-size: clamp(24px, 4.5vw, 32px); font-weight: 750; letter-spacing: -.02em; }
.type .desc { font-size: 13.5px; color: var(--ink-soft); }
.means { margin-top: 12px; border-left: 4px solid var(--accent); background: var(--surface-2); border-radius: 0 10px 10px 0; padding: 12px 14px; font-size: 13.5px; color: var(--ink); }
.tiernote { margin-top: 10px; font-size: 12px; color: var(--ink-faint); }
.sci { display: none; }
body.showsci .sci { display: block; }
.sci-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-soft); cursor: pointer; margin-top: 12px; }
.sci-toggle input { width: auto; accent-color: var(--accent); }

.masters .headline { font-size: 15px; font-weight: 600; }
.points { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.points li { display: grid; grid-template-columns: 16px 1fr; gap: 10px; font-size: 13.5px; color: var(--ink-soft); }
.points li::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); margin-top: 7px; }

.tips { display: grid; gap: 10px; margin-top: 4px; }
.tip { border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; }
.tip .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.tip .claim { font-size: 13.5px; font-weight: 600; }
.badge { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 9px; border-radius: 999px; color: #fff; white-space: nowrap; }
.badge.well { background: var(--well); } .badge.guide { background: var(--guide); } .badge.limited { background: var(--limited); }
.tip .q { font-size: 12.5px; color: var(--ink-soft); margin-top: 6px; }
.tip .caveat { font-size: 12.5px; color: var(--limited); margin-top: 5px; }
footer { margin-top: 28px; font-size: 12px; color: var(--ink-faint); text-align: center; }
@media (max-width: 560px) { .form { grid-template-columns: 1fr; } }
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
        <p>Your profile · tailored, and honest about it</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="lede">
    <div class="eyebrow">Advice that fits you</div>
    <h2>Not everyone's the same runner</h2>
    <p>A little about you lets us pitch training at the right level and your stage of life — and, just
    as importantly, be honest when a piece of advice wasn't really studied on people like you.</p>
  </div>

  <div class="card">
    <h3>About you</h3>
    <div class="form">
      <div class="field"><label>Runs per week</label><input type="number" id="rpw" min="0" max="14" value="4"></div>
      <div class="field"><label>Years running</label><input type="number" id="years" min="0" max="60" step="0.5" value="4"></div>
      <div class="field"><label>Weekly distance <span class="hintx">km, optional</span></label><input type="number" id="vol" min="0" step="1" value="35"></div>
      <div class="field"><label>Recent 5k <span class="hintx">just the numbers, optional</span></label><input class="time" id="fivek" placeholder="e.g. 2400" inputmode="numeric" autocomplete="off"><div class="err" id="fivekErr"></div></div>
      <div class="field"><label>Age</label><input type="number" id="age" min="10" max="99" value="52"></div>
      <div class="field"><label>Sex <span class="hintx">helps tailor advice</span></label>
        <select id="sex"><option value="">Prefer not to say</option><option value="female" selected>Female</option><option value="male">Male</option></select>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Your runner type</h3>
    <p class="hint">This sets how gently or ambitiously your plans progress.</p>
    <div id="typeOut"></div>
    <label class="sci-toggle"><input type="checkbox" id="sciToggle"> Show the research tier</label>
  </div>

  <div class="card masters">
    <h3>For your stage</h3>
    <p class="hint">Age changes the details — not whether you can train hard.</p>
    <div id="mastersOut"></div>
  </div>

  <div class="card">
    <h3>How your advice is weighted</h3>
    <p class="hint">Every tip carries who it was studied in. When that isn't people like you, we say so — we never hide the tip, we just add an honest note.</p>
    <div class="tips" id="tipsOut"></div>
  </div>

  <footer>Tailored on your device. Guidance only — not medical advice.</footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
function fmtDigitsToTime(raw) { const d = String(raw).replace(/\\D/g, "").slice(0, 6); if (!d) return ""; if (d.length <= 2) return d; const ss = d.slice(-2), rest = d.slice(0, -2); return rest.length <= 2 ? rest + ":" + ss : rest.slice(0, -2) + ":" + rest.slice(-2) + ":" + ss; }
(function () { const el = $("fivek"); if (el) el.addEventListener("input", () => { const f = fmtDigitsToTime(el.value); el.value = f; try { el.setSelectionRange(f.length, f.length); } catch (e) {} build(); }); })();
const BADGE = { "applies-well": ["well", "Applies well"], "general-guide": ["guide", "General guide"], "limited": ["limited", "General guide"] };

// A few real recommendations from the brief, tagged by who they were studied in.
const TIPS = [
  { claim: "Heavy strength 2×/week improves running economy", population: "trained young men", sex: "male", levels: [3, 4], ageRange: [18, 35], quality: "strong" },
  { claim: "Plyometrics sharpen economy once you're running fast", population: "trained runners", sex: "mixed", levels: [3, 4], ageRange: [18, 40], quality: "moderate" },
  { claim: "Mostly-easy (pyramidal) training suits most runners", population: "recreational to trained runners", sex: "mixed", levels: "any", quality: "strong" },
  { claim: "Strength training benefits female endurance runners", population: "adult women", sex: "female", levels: "any", quality: "moderate" },
];

function who() {
  const sex = $("sex").value || undefined;
  const c = current;
  return { tier: c ? c.tier : undefined, sex, age: Number($("age").value) || undefined };
}

let current = null;

function build() {
  const input = {
    runsPerWeek: Number($("rpw").value) || 0,
    yearsRunning: Number($("years").value) || 0,
  };
  const vol = Number($("vol").value); if (vol > 0) input.weeklyVolumeKm = vol;
  const sex = $("sex").value; if (sex) input.sex = sex;

  // Recent 5k must be entered as minutes:seconds. A bare number like "24" would be read as 24
  // *seconds* and wrongly flag you as elite — so require m:ss and a plausible range, or ignore it.
  const t = $("fivek").value.trim();
  const errEl = $("fivekErr");
  errEl.textContent = "";
  if (t) {
    if (!/^\\d{1,2}:[0-5]\\d$/.test(t)) {
      errEl.textContent = "Enter your 5k as minutes:seconds, e.g. 24:00.";
    } else {
      const secs = RC.parseDuration(t);
      if (secs < 12 * 60 || secs > 60 * 60) errEl.textContent = "That 5k time looks off — most are between 12:00 and 60:00.";
      else input.recent5kSeconds = secs;
    }
  }

  current = RC.classifyRunner(input);
  renderType(current);
  renderMasters();
  renderTips();
}

function renderType(c) {
  $("typeOut").innerHTML =
    '<div class="type"><div class="big">' + c.label + '</div><div class="desc">' + c.description + '</div></div>' +
    '<div class="means">' + c.meaning + '</div>' +
    '<div class="sci tiernote">Research tier ' + c.tier + ' of 6 — ' + c.tierName + '.' + (c.note ? ' ' + c.note : '') + '</div>';
}

function renderMasters() {
  const m = RC.assessMasters({ age: Number($("age").value) || 30, sex: $("sex").value || undefined });
  $("mastersOut").innerHTML =
    '<div class="masters"><div class="headline">' + m.headline + '</div>' +
    '<ul class="points">' + m.points.map((p) => '<li><span>' + p + '</span></li>').join("") + '</ul></div>';
}

function renderTips() {
  const w = who();
  $("tipsOut").innerHTML = TIPS.map((tag) => {
    const a = RC.applicability(tag, w);
    const [cls, label] = BADGE[a.level];
    const caveat = a.caveats.length ? '<div class="caveat">A general guide for you — ' + a.caveats.join("; ") + ".</div>" : "";
    return '<div class="tip"><div class="top"><div class="claim">' + tag.claim + '</div><span class="badge ' + cls + '">' + label + '</span></div>' +
      '<div class="q">' + a.qualityNote + '</div>' + caveat + '</div>';
  }).join("");
}

["rpw", "years", "vol", "age"].forEach((id) => $(id).addEventListener("input", build));
$("sex").addEventListener("change", build);
$("sciToggle").addEventListener("change", (e) => document.body.classList.toggle("showsci", e.target.checked));
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

const outPath = join(here, "profile.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
