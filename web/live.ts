// Builds the live-session demo (web/live.html): a "during the run" screen that drives the real
// LiveSession state machine from the engine. Pick one of the plan's sessions, press Start, and a
// simulated runner executes it — the runtime steps through warmup/reps/recoveries/cooldown, judges
// pace against target, and emits the cues shown in the log. Same engine bundle as the plan builder.
// Regenerate with:  node web/live.ts

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundleEngine } from "./bundle.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bundleJs = await bundleEngine();

const TOKENS = `
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --base: #2b9eb3; --build: #5fa83c; --peak: #e0863a; --taper: #7a6fd0;
  --on: #3fa47a; --fast: #d99a2b; --slow: #d65b36;
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
    --on: #4cb98a; --fast: #e6ac3e; --slow: #e56f49;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --base: #2b9eb3; --build: #5fa83c; --peak: #e0863a; --taper: #7a6fd0;
  --on: #3fa47a; --fast: #d99a2b; --slow: #d65b36;
  --shadow: 0 1px 2px rgba(20,32,27,.06), 0 8px 24px rgba(20,32,27,.06);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d1512; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
  --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
  --accent: #2bb3a3; --accent-ink: #06231f;
  --base: #3ab0c4; --build: #74bd52; --peak: #eb9748; --taper: #9184e0;
  --on: #4cb98a; --fast: #e6ac3e; --slow: #e56f49;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Running Coach — Live Session</title>
<style>
${TOKENS}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 940px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 64px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.brand { display: flex; align-items: center; gap: 12px; }
.mark { width: 34px; height: 34px; border-radius: 9px; flex: none; background: linear-gradient(145deg, var(--base), var(--accent) 55%, var(--peak)); box-shadow: var(--shadow); }
.brand h1 { font-size: 15px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
.brand p { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.theme-toggle { border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 12.5px; cursor: pointer; }
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); }

.controls { margin-top: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 18px clamp(16px,2.5vw,22px); display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: end; }
.controls .field { display: flex; flex-direction: column; gap: 5px; }
.controls label { font-size: 11.5px; font-weight: 600; color: var(--ink-soft); }
select { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; }
select#session { min-width: 260px; }
select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.btns { display: flex; gap: 8px; margin-left: auto; }
button.op { font: inherit; font-size: 13.5px; font-weight: 600; border-radius: 10px; padding: 10px 18px; cursor: pointer; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); }
button.op.primary { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
button.op:hover { filter: brightness(1.05); }
button.op:disabled { opacity: .45; cursor: not-allowed; filter: none; }

.screen { margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
.hero { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 1px; background: var(--line); }
.hero > div { background: var(--surface); padding: 20px clamp(16px,2.5vw,24px); }
.hero .k { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); }
.hero .big { font-size: clamp(34px, 7vw, 52px); font-weight: 700; letter-spacing: -.02em; line-height: 1.02; margin-top: 4px; }
.hero .sub { font-size: 12.5px; color: var(--ink-faint); margin-top: 4px; }
.pace-val.on { color: var(--on); } .pace-val.fast { color: var(--fast); } .pace-val.slow { color: var(--slow); } .pace-val.none { color: var(--ink); }

.stepcard { padding: 18px clamp(16px,2.5vw,24px); border-top: 1px solid var(--line); }
.stepcard .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.kindtag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: var(--k, var(--base)); border-radius: 6px; padding: 3px 8px; }
.stepcard h3 { margin: 0; font-size: 16px; letter-spacing: -.01em; flex: 1 1 auto; min-width: 0; }
.stepcard .target { font-size: 12.5px; color: var(--ink-soft); }
.stepcard .rep { font-size: 12px; color: var(--ink-faint); }
.pbar { height: 10px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; margin-top: 12px; }
.pbar > i { display: block; height: 100%; width: 0; background: var(--k, var(--accent)); transition: width .2s linear; }
.stepmeta { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-faint); margin-top: 6px; }

.segwrap { padding: 0 clamp(16px,2.5vw,24px) 18px; }
.seglabel { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); margin: 4px 0 8px; }
.segs { display: flex; gap: 2px; height: 16px; }
.seg { position: relative; background: var(--track); border-radius: 3px; overflow: hidden; min-width: 2px; }
.seg > i { position: absolute; inset: 0; width: 0; background: var(--fillc); }

.cues { border-top: 1px solid var(--line); }
.cues .hd { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); padding: 14px clamp(16px,2.5vw,24px) 6px; }
.cuelog { max-height: 220px; overflow-y: auto; padding: 0 clamp(16px,2.5vw,24px) 16px; display: flex; flex-direction: column; gap: 8px; }
.cue { display: flex; gap: 10px; align-items: baseline; font-size: 13px; }
.cue .t { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 11.5px; color: var(--ink-faint); flex: none; width: 44px; }
.cue .m { color: var(--ink); }
.cue.dim .m { color: var(--ink-soft); }
.cue .badge { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex: none; background: var(--ink-faint); }
.cue.pace-fast .badge { background: var(--fast); } .cue.pace-slow .badge { background: var(--slow); } .cue.pace-on .badge { background: var(--on); }
.cue.step .badge { background: var(--accent); } .cue.start .badge, .cue.done .badge { background: var(--build); }
.empty { color: var(--ink-faint); font-size: 13px; padding: 4px 0 14px; }
footer { margin-top: 24px; font-size: 12px; color: var(--ink-faint); text-align: center; }
footer a { color: var(--accent); }
@media (max-width: 680px) { .hero { grid-template-columns: 1fr 1fr; } .hero .timer { grid-column: 1 / -1; } }
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
        <h1>Running Coach — Live</h1>
        <p>During-the-run engine · a simulated runner drives the real state machine</p>
      </div>
    </div>
    <button class="theme-toggle" id="themeToggle" type="button">Toggle theme</button>
  </header>

  <div class="controls">
    <div class="field">
      <label for="session">Session</label>
      <select id="session"></select>
    </div>
    <div class="field">
      <label for="speed">Sim speed</label>
      <select id="speed">
        <option value="1">Real time (1×)</option>
        <option value="8">8×</option>
        <option value="20" selected>20×</option>
        <option value="60">60×</option>
      </select>
    </div>
    <div class="btns">
      <button class="op primary" id="startBtn" type="button">Start</button>
      <button class="op" id="pauseBtn" type="button" disabled>Pause</button>
      <button class="op" id="stopBtn" type="button" disabled>Stop</button>
    </div>
  </div>

  <div class="screen">
    <div class="hero">
      <div class="timer">
        <div class="k">Elapsed</div>
        <div class="big num" id="elapsed">0:00</div>
        <div class="sub"><span class="num" id="distance">0.00</span> km · <span id="status">ready</span></div>
      </div>
      <div>
        <div class="k">Current pace</div>
        <div class="big num pace-val none" id="pace">—</div>
        <div class="sub">avg <span class="num" id="avgpace">—</span></div>
      </div>
      <div>
        <div class="k">Heart rate</div>
        <div class="big num" id="hr">—</div>
        <div class="sub">bpm</div>
      </div>
    </div>

    <div class="stepcard">
      <div class="top">
        <span class="kindtag" id="kindtag" style="--k:var(--base)">—</span>
        <h3 id="steptitle">Pick a session and press Start</h3>
        <span class="rep num" id="rep"></span>
      </div>
      <div class="target" id="target"></div>
      <div class="pbar"><i id="stepfill" style="--k:var(--base)"></i></div>
      <div class="stepmeta"><span id="stepelapsed">0:00</span><span id="stepcount"></span></div>
    </div>

    <div class="segwrap">
      <div class="seglabel">Whole session</div>
      <div class="segs" id="segs"></div>
    </div>

    <div class="cues">
      <div class="hd">Cues</div>
      <div class="cuelog" id="cuelog"><div class="empty">Coaching cues will appear here as you run.</div></div>
    </div>
  </div>

  <footer>
    The runner is simulated; the runtime, cues and pace judgements are the real engine. Deterministic core, computed client-side.
  </footer>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
const KIND_COLOR = { warmup: "var(--base)", cooldown: "var(--base)", steady: "var(--base)", recovery: "var(--taper)", rep: "var(--peak)" };

const ATHLETE = { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1260 }, experience: "competitive", includeStrength: true, returningFromInjury: false, maxHr: 190, restingHr: 48 };
const GOAL = { distance: "half", targetTimeSeconds: 5400, raceDateIso: "2027-09-05", startDateIso: "2026-07-23" };

// Collect distinct runnable sessions from a generated plan.
const SESSIONS = [];
(function () {
  const seen = new Set();
  const plan = RC.generatePlan(ATHLETE, GOAL);
  const skip = new Set(["rest", "mobility", "strength", "cross-training"]);
  for (const w of plan.weeks) for (const s of w.sessions) {
    if (skip.has(s.type) || s.steps.length === 0 || seen.has(s.title)) continue;
    seen.add(s.title); SESSIONS.push(s);
  }
  SESSIONS.sort((a, b) => b.steps.filter((x) => x.kind === "rep").length - a.steps.filter((x) => x.kind === "rep").length);
})();

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
}
function fmtPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return "—";
  const s = Math.round(secPerKm);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + "/km";
}
function segSeconds(v) {
  if (v.targetSeconds) return v.targetSeconds;
  if (v.targetMeters && v.targetPace) return ((v.targetPace.minSecPerKm + v.targetPace.maxSecPerKm) / 2) * v.targetMeters / 1000;
  return 30;
}
function hrTarget(step) {
  if (!step) return 110;
  if (step.kind === "rep") return 178;
  if (step.kind === "warmup" || step.kind === "cooldown") return 132;
  if (step.kind === "recovery") return 150;
  return 152;
}

let live = null, timer = null, vms = 0, dist = 0, hr = 110, speed = 20, quirk = 0, lastStepIdx = -1;

function populate() {
  $("session").innerHTML = SESSIONS.map((s, i) => '<option value="' + i + '">' + s.title + '</option>').join("");
}

function buildSegments() {
  const plan = live.plan();
  const total = plan.reduce((a, v) => a + segSeconds(v), 0) || 1;
  $("segs").innerHTML = plan.map((v) => {
    const c = KIND_COLOR[v.kind] || "var(--base)";
    const track = v.kind === "rep" ? "color-mix(in srgb, var(--peak) 22%, var(--surface-2))" : "var(--surface-2)";
    return '<div class="seg" style="flex:' + segSeconds(v).toFixed(1) + ';--track:' + track + ';--fillc:' + c + '"><i></i></div>';
  }).join("");
}

function selectSession(i) {
  stopLoop();
  live = new RC.LiveSession(SESSIONS[i]);
  vms = 0; dist = 0; hr = 110; quirk = 0; lastStepIdx = -1;
  $("cuelog").innerHTML = '<div class="empty">Coaching cues will appear here as you run.</div>';
  buildSegments();
  render(live.snapshot(0));
  setButtons("idle");
}

function paceForStep(step) {
  const band = step && step.targetPace;
  const mid = band ? (band.minSecPerKm + band.maxSecPerKm) / 2 : 360;
  quirk += (Math.random() - 0.5) * 0.03; quirk *= 0.9;
  if (Math.random() < 0.04) quirk += (Math.random() - 0.5) * 0.28;
  return Math.max(120, mid * (1 + quirk));
}

function tick() {
  const dt = 0.2 * speed; // virtual seconds per 200ms real
  vms += dt * 1000;
  const pre = live.snapshot(vms);
  if (pre.step && pre.step.index !== lastStepIdx) { quirk = 0; lastStepIdx = pre.step.index; }
  const pace = paceForStep(pre.step);
  dist += (1000 / pace) * dt;
  hr += (hrTarget(pre.step) - hr) * 0.05 + (Math.random() - 0.5) * 1.6;
  hr = Math.max(95, Math.min(ATHLETE.maxHr, hr));
  const cues = live.update({ atMs: vms, distanceMeters: dist, heartRateBpm: Math.round(hr) });
  cues.forEach(logCue);
  render(live.snapshot(vms));
  if (live.getStatus() === "completed") { stopLoop(); setButtons("done"); }
}

function startLoop() { if (!timer) timer = setInterval(tick, 200); }
function stopLoop() { if (timer) { clearInterval(timer); timer = null; } }

function logCue(cue) {
  const log = $("cuelog");
  const empty = log.querySelector(".empty");
  if (empty) empty.remove();
  const cls = cue.kind === "pace" ? "pace-" + cue.paceStatus
    : cue.kind === "step-start" ? "step"
    : cue.kind === "session-start" ? "start"
    : cue.kind === "session-complete" ? "done" : "dim";
  const dim = cue.kind === "paused" || cue.kind === "resumed" ? " dim" : "";
  const el = document.createElement("div");
  el.className = "cue " + cls + dim;
  el.innerHTML = '<span class="badge"></span><span class="t">' + fmtTime(cue.atMs / 1000) + '</span><span class="m">' + cue.message + '</span>';
  log.insertBefore(el, log.firstChild);
}

function render(s) {
  $("elapsed").textContent = fmtTime(s.elapsedSeconds);
  $("distance").textContent = (s.distanceMeters / 1000).toFixed(2);
  $("status").textContent = s.status;
  const pv = $("pace");
  pv.textContent = s.currentPaceSecPerKm ? fmtPace(s.currentPaceSecPerKm) : "—";
  pv.className = "big num pace-val " + (s.paceStatus || "none");
  $("avgpace").textContent = s.averagePaceSecPerKm ? fmtPace(s.averagePaceSecPerKm) : "—";
  $("hr").textContent = s.heartRateBpm ? s.heartRateBpm : "—";

  const step = s.step;
  if (step) {
    const c = KIND_COLOR[step.kind] || "var(--base)";
    $("kindtag").textContent = step.kind;
    $("kindtag").style.setProperty("--k", c);
    $("steptitle").textContent = step.label;
    $("rep").textContent = step.repeatIndex && step.repeatCount ? step.repeatIndex + " / " + step.repeatCount : "";
    const tgt = [];
    if (step.gate === "distance" && step.targetMeters) tgt.push(Math.round(step.targetMeters) + " m");
    else if (step.targetSeconds) tgt.push(fmtTime(step.targetSeconds));
    if (step.targetPace) tgt.push("target " + fmtPace(step.targetPace.minSecPerKm) + "–" + fmtPace(step.targetPace.maxSecPerKm));
    $("target").textContent = tgt.join(" · ");
    const fill = $("stepfill");
    fill.style.width = Math.round(s.stepProgress * 100) + "%";
    fill.style.setProperty("--k", c);
    $("stepelapsed").textContent = fmtTime(s.stepElapsedSeconds);
    $("stepcount").textContent = "Step " + (step.index + 1) + " of " + step.total;
  } else {
    $("kindtag").textContent = s.status === "completed" ? "done" : "—";
    $("steptitle").textContent = s.status === "completed" ? "Session complete" : "Pick a session and press Start";
    $("rep").textContent = ""; $("target").textContent = ""; $("stepcount").textContent = "";
    $("stepfill").style.width = s.status === "completed" ? "100%" : "0%";
  }

  // Segment fills.
  const segs = $("segs").children;
  const idx = step ? step.index : (s.status === "completed" ? segs.length : 0);
  for (let i = 0; i < segs.length; i++) {
    const fill = segs[i].firstChild;
    fill.style.width = i < idx ? "100%" : i === idx ? Math.round(s.stepProgress * 100) + "%" : "0%";
  }
}

function setButtons(state) {
  const start = $("startBtn"), pause = $("pauseBtn"), stop = $("stopBtn"), sel = $("session"), spd = $("speed");
  if (state === "idle" || state === "done") {
    start.disabled = false; start.textContent = "Start"; pause.disabled = true; pause.textContent = "Pause"; stop.disabled = true; sel.disabled = false; spd.disabled = false;
  } else if (state === "active") {
    start.disabled = true; pause.disabled = false; pause.textContent = "Pause"; stop.disabled = false; sel.disabled = true; spd.disabled = false;
  } else if (state === "paused") {
    pause.textContent = "Resume"; stop.disabled = false;
  }
}

$("startBtn").addEventListener("click", () => {
  if (!live || live.getStatus() !== "idle") selectSession(Number($("session").value));
  live.start(vms).forEach(logCue);
  render(live.snapshot(vms));
  setButtons("active");
  startLoop();
});
$("pauseBtn").addEventListener("click", () => {
  if (!live) return;
  if (live.getStatus() === "active") { live.pause(vms).forEach(logCue); stopLoop(); setButtons("paused"); }
  else if (live.getStatus() === "paused") { live.resume(vms).forEach(logCue); startLoop(); setButtons("active"); }
  render(live.snapshot(vms));
});
$("stopBtn").addEventListener("click", () => {
  if (!live) return;
  live.stop(vms).forEach(logCue); stopLoop(); render(live.snapshot(vms)); setButtons("done");
});
$("session").addEventListener("change", () => selectSession(Number($("session").value)));
$("speed").addEventListener("change", () => { speed = Number($("speed").value); });
$("themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", next);
});

populate();
selectSession(0);
</script>
</body>
</html>
`;

const outPath = join(here, "live.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
