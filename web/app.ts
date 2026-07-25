// Builds the navigable app shell (web/app.html): the "one app" that houses every screen we've built
// behind a five-tab bottom nav (Today · Plan · Activities · Community · Support). Our own visual
// identity; the tab structure follows a familiar running-app layout. One engine bundle drives it all,
// client-side. Regenerate with:  node web/app.ts   (or: npm run web)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundleEngine } from "./bundle.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bundleJs = await bundleEngine();

// InteRun brand mark — an original glyph: a teal badge holding a forward-striding runner (head dot +
// two motion bars leaning into the run). Not derived from any other app's logo.
const BRAND_MARK = `<svg viewBox="0 0 120 120" width="104" height="104" role="img" aria-label="InteRun">
  <defs><linearGradient id="brandg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#16b7a4"/><stop offset="1" stop-color="#0a6f64"/></linearGradient></defs>
  <rect x="8" y="8" width="104" height="104" rx="30" fill="url(#brandg)"/>
  <circle cx="82" cy="37" r="11" fill="#fff"/>
  <path d="M35 88 L57 45 L71 45 L49 88 Z" fill="#fff"/>
  <path d="M57 88 L79 45 L93 45 L71 88 Z" fill="#fff" opacity=".62"/>
</svg>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>InteRun — The Intelligent Training Companion</title>
<meta name="description" content="InteRun — evidence-based running coach with live GPS sessions and voice coaching.">
<meta name="theme-color" content="#0e8c7f" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a100e" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="InteRun">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<style>
:root {
  color-scheme: light dark;
  --bg: #eef1f1; --surface: #ffffff; --surface-2: #f6f8f8; --line: #dbe1e0;
  --ink: #14201b; --ink-soft: #4c5b55; --ink-faint: #7a877f;
  --accent: #0e8c7f; --accent-ink: #ffffff;
  --base: #2b9eb3; --build: #5fa83c; --peak: #e0863a; --taper: #7a6fd0;
  --ready: #4b9e2f; --steady: #2b9eb3; --ease: #d98a2a; --rest: #c0442e;
  --eff-easy: #3fa47a; --eff-moderate: #d99a2b; --eff-hard: #d65b36; --eff-none: #9aa8a1;
  --shadow: 0 1px 2px rgba(20,32,27,.05), 0 6px 18px rgba(20,32,27,.06);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a100e; --surface: #151e1b; --surface-2: #1b2622; --line: #26332e;
    --ink: #e7eeea; --ink-soft: #a9b7b0; --ink-faint: #74847c;
    --accent: #2bb3a3; --accent-ink: #06231f;
    --base: #3ab0c4; --build: #74bd52; --peak: #eb9748; --taper: #9184e0;
    --ready: #6bbf46; --steady: #3ab0c4; --ease: #eb9748; --rest: #e8765c;
    --eff-easy: #4cb98a; --eff-moderate: #e6ac3e; --eff-hard: #e56f49; --eff-none: #6f7d76;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 22px rgba(0,0,0,.4);
  }
}
:root[data-theme="light"] { color-scheme: light; --bg:#eef1f1; --surface:#fff; --surface-2:#f6f8f8; --line:#dbe1e0; --ink:#14201b; --ink-soft:#4c5b55; --ink-faint:#7a877f; --accent:#0e8c7f; --accent-ink:#fff; --base:#2b9eb3; --build:#5fa83c; --peak:#e0863a; --taper:#7a6fd0; --ready:#4b9e2f; --steady:#2b9eb3; --ease:#d98a2a; --rest:#c0442e; --eff-easy:#3fa47a; --eff-moderate:#d99a2b; --eff-hard:#d65b36; --eff-none:#9aa8a1; --shadow:0 1px 2px rgba(20,32,27,.05),0 6px 18px rgba(20,32,27,.06); }
:root[data-theme="dark"] { color-scheme: dark; --bg:#0a100e; --surface:#151e1b; --surface-2:#1b2622; --line:#26332e; --ink:#e7eeea; --ink-soft:#a9b7b0; --ink-faint:#74847c; --accent:#2bb3a3; --accent-ink:#06231f; --base:#3ab0c4; --build:#74bd52; --peak:#eb9748; --taper:#9184e0; --ready:#6bbf46; --steady:#3ab0c4; --ease:#eb9748; --rest:#e8765c; --eff-easy:#4cb98a; --eff-moderate:#e6ac3e; --eff-hard:#e56f49; --eff-none:#6f7d76; --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 22px rgba(0,0,0,.4); }
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }

.app { max-width: 440px; min-height: 100dvh; margin: 0 auto; background: var(--bg); display: flex; flex-direction: column; position: relative; box-shadow: 0 0 60px rgba(0,0,0,.06); }
.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
.topbar .title { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.iconbtn { position: relative; overflow: hidden; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.iconbtn svg { width: 18px; height: 18px; }
.tb-left, .tb-right { display: flex; gap: 8px; }
/* Splash / launch screen */
.splash { position: fixed; inset: 0; z-index: 100; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; opacity: 1; transition: opacity .55s ease; }
.splash.hide { opacity: 0; pointer-events: none; }
.splash-mark { animation: splashpop .7s cubic-bezier(.2,.9,.3,1.1) both; }
.splash-mark svg { width: 104px; height: 104px; filter: drop-shadow(0 8px 26px rgba(22,183,164,.35)); }
.splash-name { font-size: 34px; font-weight: 800; letter-spacing: -.02em; color: #fff; animation: splashfade .6s ease .18s both; }
.splash-name span { color: #16b7a4; }
.splash-tag { font-size: 13.5px; font-weight: 500; letter-spacing: .01em; color: #9aa3a0; animation: splashfade .6s ease .34s both; }
@keyframes splashpop { from { opacity: 0; transform: scale(.7) translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes splashfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .splash-mark, .splash-name, .splash-tag { animation: none; } }
/* First-run welcome */
.welcome { position: fixed; inset: 0; z-index: 90; background: radial-gradient(120% 90% at 50% 0%, #0c2b28 0%, #000 62%); display: none; align-items: center; justify-content: center; padding: 32px; text-align: center; opacity: 1; transition: opacity .5s ease; }
.welcome.on { display: flex; }
.welcome.hide { opacity: 0; pointer-events: none; }
.welcome-inner { max-width: 360px; }
.welcome-mark svg { width: 82px; height: 82px; filter: drop-shadow(0 8px 26px rgba(22,183,164,.4)); animation: splashpop .7s cubic-bezier(.2,.9,.3,1.1) both; }
.welcome-h { font-size: 30px; font-weight: 800; letter-spacing: -.02em; color: #fff; margin: 20px 0 18px; animation: welIn .6s ease .15s both; }
.welcome-h span { color: #16b7a4; }
.welcome-msg { font-size: 16px; line-height: 1.5; color: #cfd6d3; margin: 0 0 12px; opacity: 0; }
.welcome-msg.m1 { animation: welIn .55s ease .55s both; }
.welcome-msg.m2 { animation: welIn .55s ease 1.15s both; }
.welcome-msg.m3 { color: #fff; font-weight: 600; animation: welIn .55s ease 1.85s both; }
.welcome-cta { margin-top: 22px; font: inherit; font-size: 16px; font-weight: 700; color: var(--accent-ink); background: linear-gradient(180deg, #1cc4b0 0%, #0e8c7f 60%, #0b6f65 100%); border: 0; border-radius: 14px; padding: 15px 30px; cursor: pointer; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 10px 26px -8px rgba(22,183,164,.6); opacity: 0; animation: welIn .55s ease 2.5s both; }
.welcome-cta:active { transform: translateY(1px); }
@keyframes welIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .welcome-mark svg, .welcome-h, .welcome-msg, .welcome-cta { animation-duration: .01s !important; animation-delay: 0s !important; } }
/* Training calendar */
.cal-wrap { display: flex; flex-direction: column; gap: 16px; }
.cal-week { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.cal-whead { padding: 15px 16px 13px; border-bottom: 1px solid var(--line); }
.cal-wtitle { font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.cal-badge { font-size: 10.5px; font-weight: 700; letter-spacing: .04em; color: #fff; background: var(--ink); border-radius: 999px; padding: 3px 9px; }
.cal-wtot { font-size: 12.5px; color: var(--ink-soft); margin-top: 4px; }
.cal-wtot b { color: var(--ink); font-weight: 650; }
.cal-day { display: grid; grid-template-columns: 52px 1fr; gap: 10px; padding: 10px 16px; border-top: 1px solid var(--line); align-items: center; }
.cal-day:first-child { border-top: 0; }
.cal-dcol { text-align: left; }
.cal-dn { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; color: var(--ink-faint); }
.cal-dd { font-size: 19px; font-weight: 700; color: var(--ink-soft); letter-spacing: -.01em; }
.cal-day.is-today .cal-dd { color: #fff; background: var(--ink); width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.cal-scol { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cal-empty { font-size: 13px; color: var(--ink-faint); }
.cal-sess { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: var(--surface-2); border: 1px solid var(--line); border-radius: 11px; padding: 9px 11px; cursor: pointer; font: inherit; color: inherit; }
.cal-sess.done { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); border-color: color-mix(in srgb, var(--accent) 25%, var(--line)); }
.cal-bar { width: 4px; align-self: stretch; border-radius: 3px; flex: none; }
.cal-body { flex: 1; min-width: 0; }
.cal-t { display: block; font-size: 13.5px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-sub { display: block; font-size: 12px; color: var(--ink-soft); margin-top: 1px; }
.cal-check { width: 24px; height: 24px; border-radius: 50%; flex: none; border: 1.5px solid var(--line); display: flex; align-items: center; justify-content: center; color: #fff; }
.cal-sess.done .cal-check { background: var(--ink); border-color: var(--ink); }
.cal-check svg { width: 15px; height: 15px; }
.cal-open { flex: 1; min-width: 0; text-align: left; background: none; border: 0; font: inherit; color: inherit; cursor: pointer; padding: 0; }
.cal-check { cursor: pointer; }
/* Session detail sheet */
.sheet-ov { position: fixed; inset: 0; z-index: 70; display: none; align-items: flex-end; justify-content: center; background: color-mix(in srgb, var(--ink) 52%, transparent); backdrop-filter: blur(3px); }
.sheet-ov.on { display: flex; }
.sheet { position: relative; width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; background: var(--surface); border-radius: 22px 22px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,.25); padding: 22px 18px calc(26px + env(safe-area-inset-bottom)); animation: sheetUp .28s cubic-bezier(.2,.8,.3,1) both; }
@keyframes sheetUp { from { transform: translateY(28px); opacity: .5; } to { transform: none; opacity: 1; } }
.sheet-x { position: absolute; top: 14px; right: 14px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border: 1px solid var(--line); border-radius: 50%; width: 30px; height: 30px; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
.sd-type { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--sc, var(--accent)); }
.sd-title { font-size: 20px; font-weight: 750; letter-spacing: -.01em; margin: 4px 44px 10px 0; }
.sd-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.sd-desc { font-size: 13.5px; line-height: 1.55; color: var(--ink-soft); margin-bottom: 4px; }
.sd-steps { margin-top: 12px; }
.sd-step { display: grid; grid-template-columns: 12px 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.sd-dot { width: 11px; height: 11px; border-radius: 50%; margin-top: 4px; }
.sd-tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-faint); }
.sd-lab { font-size: 14px; font-weight: 600; margin-top: 2px; letter-spacing: -.01em; }
.sd-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.sd-rec { font-size: 12px; color: var(--ink-faint); margin-top: 4px; }
.sd-move { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 16px; }
.sd-move-h { font-size: 13px; font-weight: 700; letter-spacing: -.01em; }
.sd-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 10px; }
.sd-day { font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-soft); background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid var(--line); border-radius: 10px; padding: 9px 0; cursor: pointer; box-shadow: 0 1px 2px rgba(20,32,27,.05); }
.sd-day:active { transform: translateY(1px); }
.sd-day.on { background: var(--ink); color: var(--surface); border-color: transparent; }
.sd-day:disabled { cursor: default; }
.sd-move-n { font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; }
.tap { cursor: pointer; } .sess.tap:active, .wk-card.tap:active { opacity: .65; }
/* Strength exercise breakdown */
.ex-list { margin-top: 8px; }
.ex-list > :not(:first-child).ex { border-top: 1px solid var(--line); padding-top: 16px; margin-top: 16px; }
.ex { display: flex; gap: 14px; align-items: center; }
.ex-anim { width: 92px; height: 100px; flex: none; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.exfig { width: 100%; height: 100%; display: block; }
.exfig .limb { stroke: var(--ink-soft); stroke-width: 11; fill: none; stroke-linecap: round; }
.exfig .torso { stroke: var(--ink-soft); stroke-width: 22; fill: none; stroke-linecap: round; }
.exfig .head { fill: var(--ink-soft); stroke: none; }
.exfig .back { opacity: .5; }
.exfig .grd { stroke: var(--line); stroke-width: 2.5; }
.exfig .p0 { animation: exposeA 2s ease-in-out infinite; }
.exfig .p1 { animation: exposeB 2s ease-in-out infinite; }
@keyframes exposeA { 0%,40% { opacity: 1; } 50%,90% { opacity: 0; } 100% { opacity: 1; } }
@keyframes exposeB { 0%,40% { opacity: 0; } 50%,90% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .exfig .p0, .exfig .p1 { animation: none; } .exfig .p1 { opacity: .4; } }
.ex-main { flex: 1; min-width: 0; }
.ex-name { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
.ex-mus { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; } .ex-mus b { color: var(--ink); font-weight: 650; } .ex-sec { color: var(--ink-faint); }
.ex-presc { display: inline-block; font-family: var(--mono); font-size: 12px; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line)); border-radius: 7px; padding: 2px 8px; margin-top: 8px; }
.ex-cue { font-size: 12.5px; line-height: 1.5; color: var(--ink-soft); margin-top: 10px; }
.ex-log { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }
.ex-set { display: grid; grid-template-columns: 54px 1fr 14px 1fr; gap: 8px; align-items: center; }
.setn { font-size: 12px; font-weight: 650; color: var(--ink-faint); }
.ex-x { text-align: center; color: var(--ink-faint); font-size: 13px; }
.set-in { font: inherit; font-size: 14px; text-align: center; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 9px; padding: 8px 6px; width: 100%; }
.set-in:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
/* Strength history / progress */
.sh-card { margin-bottom: 12px; }
.sh-head { display: flex; align-items: center; gap: 12px; }
.sh-anim { width: 62px; height: 68px; }
.sh-main { flex: 1; min-width: 0; }
.sh-name { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
.sh-mus { font-size: 12px; color: var(--ink-soft); margin-top: 1px; }
.sh-best { font-size: 12px; color: var(--ink-faint); margin-top: 5px; } .sh-best b { color: var(--accent); font-weight: 700; }
.sh-spark { display: flex; align-items: flex-end; gap: 3px; height: 40px; width: 74px; flex: none; }
.sh-spark i { flex: 1; background: color-mix(in srgb, var(--accent) 55%, var(--surface-2)); border-radius: 2px 2px 0 0; }
.sh-spark i:last-child { background: var(--accent); }
.sh-rows { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; }
.sh-row { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 12.5px; }
.sh-wk { color: var(--ink-faint); font-weight: 600; flex: none; }
.sh-sets { font-family: var(--mono); color: var(--ink-soft); text-align: right; }

.view { flex: 1; overflow-y: auto; padding: 16px 16px 96px; }
.eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 16px; }
h2.sec { font-size: 15px; margin: 22px 2px 10px; letter-spacing: -.01em; }
h2.sec:first-child { margin-top: 4px; }

/* Week strip */
.weekstrip { display: grid; grid-template-columns: repeat(7,1fr); gap: 5px; margin-bottom: 16px; }
.weekstrip .d { text-align: center; padding: 9px 0; border-radius: 14px; cursor: pointer; background: none; border: 1px solid transparent; font: inherit; color: inherit; transition: background .12s ease, transform .12s ease; }
.weekstrip .d:active { transform: scale(.94); }
.weekstrip .d .dn { font-size: 10px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .05em; }
.weekstrip .d .dd { font-size: 15px; font-weight: 650; margin-top: 3px; }
.weekstrip .d.today:not(.sel) { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.weekstrip .d.sel { background: linear-gradient(180deg, color-mix(in srgb, var(--ink) 92%, #000) 0%, var(--ink) 100%); color: var(--surface); box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--ink) 55%, transparent); }
.weekstrip .d.sel .dn { color: color-mix(in srgb, var(--surface) 72%, transparent); }
.weekstrip .d .dot { width: 6px; height: 6px; border-radius: 50%; margin: 5px auto 0; }
/* Today hero workout — a raised, glossy 3D "plate" */
.hero-wk { position: relative; overflow: hidden; border-radius: 22px; padding: 22px 22px 20px; color: #fff;
  background:
    radial-gradient(130% 80% at 12% -10%, rgba(255,255,255,.22), transparent 52%),
    linear-gradient(152deg, color-mix(in srgb, var(--c, var(--accent)) 96%, #fff) 0%, color-mix(in srgb, var(--c, var(--accent)) 80%, #000) 52%, color-mix(in srgb, var(--c, var(--accent)) 58%, #000) 100%);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow:
    0 1.5px 0 rgba(255,255,255,.30) inset,
    0 -22px 34px -26px rgba(0,0,0,.42) inset,
    0 6px 16px -10px color-mix(in srgb, var(--c, var(--accent)) 40%, transparent),
    0 2px 5px -3px rgba(20,32,27,.14);
  cursor: pointer; transition: transform .14s ease, box-shadow .14s ease; }
.hero-wk:active { transform: translateY(1px) scale(.994); box-shadow: 0 1.5px 0 rgba(255,255,255,.26) inset, 0 -20px 30px -24px rgba(0,0,0,.42) inset, 0 4px 10px -8px color-mix(in srgb, var(--c, var(--accent)) 38%, transparent); }
.hero-wk.rest { background: linear-gradient(145deg, var(--surface) 0%, var(--surface-2) 100%); color: var(--ink); border: 1px solid var(--line); box-shadow: var(--shadow); cursor: default; }
.hw-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
.hero-wk.rest .hw-eyebrow { color: var(--ink-faint); opacity: 1; }
.hw-title { font-size: 25px; font-weight: 800; letter-spacing: -.02em; margin: 6px 0 12px; line-height: 1.08; }
.hw-sub { font-size: 14px; color: var(--ink-soft); }
.hw-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.hw-chip { font-family: var(--mono); font-size: 12px; font-weight: 600; color: #fff; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.22); border-radius: 8px; padding: 4px 9px; }
.hw-also { font-size: 12.5px; opacity: .9; margin-top: 10px; }
.hw-go { font-size: 12.5px; font-weight: 650; opacity: .95; margin-top: 14px; display: flex; align-items: center; gap: 4px; }
.hw-go span { font-size: 16px; }
.hw-glow { position: absolute; right: -46px; top: -46px; width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.26), transparent 68%); pointer-events: none; }
/* Start session — premium CTA with a "marching" gradient outline (accent ⇄ white flowing round) */
@property --ma { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.start-btn { position: relative; margin-top: 26px; isolation: isolate; }
.start-btn::before {
  content: ""; position: absolute; inset: -3px; border-radius: 17px; padding: 3px; z-index: -1; pointer-events: none;
  background: conic-gradient(from var(--ma), var(--accent) 0deg, #ffffff 60deg, color-mix(in srgb, var(--accent) 45%, #fff) 120deg, var(--accent) 180deg, #ffffff 240deg, color-mix(in srgb, var(--accent) 45%, #fff) 300deg, var(--accent) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 55%, transparent));
  animation: maSpin 2.8s linear infinite;
}
@keyframes maSpin { to { --ma: 360deg; } }
@media (prefers-reduced-motion: reduce) { .start-btn::before { animation: none; } }
/* Today's two summary squares */
.tsq-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 22px; }
.tsq { position: relative; text-align: left; background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid var(--line); border-radius: 18px; padding: 15px 15px 16px; cursor: pointer; font: inherit; color: inherit; box-shadow: var(--shadow); transition: transform .12s ease, box-shadow .12s ease; }
.tsq:active { transform: translateY(1px); }
.tsq-ic { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(160deg, color-mix(in srgb, var(--sqc, var(--accent)) 92%, #fff), var(--sqc, var(--accent))); box-shadow: 0 5px 12px -5px var(--sqc, var(--accent)); margin-bottom: 12px; }
.tsq-ic svg { width: 22px; height: 22px; }
.tsq-k { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-faint); }
.tsq-v { font-size: 16px; font-weight: 750; letter-spacing: -.01em; margin-top: 3px; }
.tsq-sub { font-size: 12px; color: var(--ink-soft); margin-top: 3px; }

/* Workout card */
.wk-card { display: flex; align-items: flex-start; gap: 12px; padding-left: 14px; position: relative; }
.wk-card::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 4px; border-radius: 3px; background: var(--c, var(--eff-easy)); }
.wk-card .b { flex: 1; min-width: 0; }
.wk-card .t { font-size: 16px; font-weight: 650; letter-spacing: -.01em; }
.wk-card .sub { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
.wk-card .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { font-family: var(--mono); font-size: 11.5px; color: var(--ink-soft); background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; padding: 1px 7px; }
.chip.pace { color: var(--accent); } .chip.rpe { color: var(--eff-hard); }
.checkbox { width: 24px; height: 24px; border-radius: 7px; border: 2px solid var(--line); flex: none; }

.primary { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 16px; font: inherit; font-size: 15px; font-weight: 650; color: var(--accent-ink); background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 86%, #fff) 0%, var(--accent) 55%, color-mix(in srgb, var(--accent) 82%, #000) 100%); border: 0; border-radius: 14px; padding: 14px; cursor: pointer; text-decoration: none; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 6px 16px -4px color-mix(in srgb, var(--accent) 55%, transparent), 0 2px 5px rgba(20,32,27,.16); transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
.primary:hover { filter: brightness(1.03); }
.primary:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 3px 9px -4px color-mix(in srgb, var(--accent) 50%, transparent); }
.primary:hover { filter: brightness(1.06); }
.primary svg { width: 18px; height: 18px; }

/* Readiness (Today) */
.ctx { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.ctx .lab { font-size: 12px; color: var(--ink-faint); font-weight: 600; }
.seg { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.seg button { font: inherit; font-size: 12.5px; font-weight: 550; color: var(--ink-soft); background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; cursor: pointer; box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(20,32,27,.06); transition: transform .12s ease, box-shadow .12s ease, background .12s ease, color .12s ease; }
.seg button:active { transform: translateY(1px); }
.seg button.on { background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff) 0%, var(--accent) 60%, color-mix(in srgb, var(--accent) 84%, #000) 100%); color: var(--accent-ink); border-color: transparent; font-weight: 650; box-shadow: 0 1px 0 rgba(255,255,255,.28) inset, 0 4px 12px -3px color-mix(in srgb, var(--accent) 55%, transparent); }
/* Avatar */
.iconbtn img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar-row { display: flex; align-items: center; gap: 15px; margin-top: 4px; }
.avatar-pic { width: 76px; height: 76px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 24%, var(--surface)), var(--surface)); border: 1px solid var(--line); box-shadow: 0 6px 16px -7px rgba(20,32,27,.35), 0 1px 0 rgba(255,255,255,.5) inset; color: var(--accent); font-weight: 750; font-size: 27px; letter-spacing: -.02em; cursor: pointer; }
.avatar-pic img { width: 100%; height: 100%; object-fit: cover; }
.avatar-pic svg { width: 38px; height: 38px; color: var(--accent); }
.avatar-cta { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line)); border-radius: 11px; padding: 9px 14px; cursor: pointer; box-shadow: 0 1px 2px rgba(20,32,27,.06); }
.avatar-cta:active { transform: translateY(1px); }
.avatar-hint { font-size: 11.5px; color: var(--ink-faint); margin-top: 6px; }
.greeting { font-size: 15px; color: var(--ink-soft); margin: 0 2px 12px; } .greeting b { color: var(--ink); font-weight: 700; }
/* Running-status cards */
.statuscards { display: flex; flex-direction: column; gap: 8px; }
.statuscard { text-align: left; width: 100%; background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid var(--line); border-radius: 13px; padding: 12px 14px; cursor: pointer; font: inherit; color: inherit; box-shadow: 0 1px 2px rgba(20,32,27,.05); transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease; }
.statuscard:active { transform: translateY(1px); }
.statuscard.on { border-color: transparent; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 13%, var(--surface)), color-mix(in srgb, var(--accent) 5%, var(--surface))); box-shadow: 0 5px 16px -7px color-mix(in srgb, var(--accent) 55%, transparent), 0 0 0 1.5px var(--accent) inset; }
.sc-t { font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; display: flex; align-items: center; }
.statuscard.on .sc-t { color: var(--accent); }
.statuscard.on .sc-t::after { content: "✓"; margin-left: auto; font-weight: 800; }
.sc-d { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; line-height: 1.4; }
.status { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
.status .band { padding: 15px 16px; color: #fff; background: var(--bc); }
.status .band .h { font-size: 18px; font-weight: 700; }
.status .band .rec { font-size: 13px; margin-top: 2px; opacity: .96; }
.meter { height: 7px; background: rgba(255,255,255,.3); border-radius: 5px; overflow: hidden; margin-top: 10px; }
.meter > i { display: block; height: 100%; background: #fff; }
.status .body { padding: 12px 16px; background: var(--surface); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips .c { font-size: 12px; color: var(--ink-soft); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; }
.reassure { font-size: 12.5px; color: var(--ink-soft); font-style: italic; margin-top: 9px; }
.watch { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 12px; }
.watch .wl { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
.easynote { border-left: 4px solid var(--ready); background: var(--surface-2); border-radius: 0 10px 10px 0; padding: 12px 14px; }
.easynote.caution { border-color: var(--ease); }
.easynote .m { font-weight: 600; font-size: 14px; }
.easynote .n { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; }
details.more { margin-top: 12px; }
details.more > summary { font-size: 13px; color: var(--accent); cursor: pointer; list-style: none; }
details.more > summary::-webkit-details-marker { display: none; }
details.more > summary::before { content: "▸ "; } details.more[open] > summary::before { content: "▾ "; }
.q { margin-top: 12px; } .q label { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }

/* Plan */
.plan-head .goal { font-size: 20px; font-weight: 750; letter-spacing: -.02em; }
.plan-head .when { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
.plan-note { margin-top: 12px; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid var(--base); border-radius: 0 10px 10px 0; padding: 11px 14px; font-size: 12.5px; color: var(--ink-soft); }
.plan-note b { color: var(--ink); font-weight: 650; }
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px; background: color-mix(in srgb, var(--pc, var(--accent)) 15%, transparent); color: var(--pc, var(--accent)); margin-top: 10px; }
.pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--pc, var(--accent)); }
.statrow { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 14px; }
.stat { background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 11px; }
.stat .k { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); }
.stat .v { font-size: 17px; font-weight: 650; margin-top: 2px; }
.chart { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; align-items: end; gap: 2px; height: 120px; margin-top: 6px; }
.bar-btn { display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; height: 100%; background: none; border: 0; padding: 0; cursor: pointer; }
.bar { border-radius: 4px 4px 2px 2px; min-height: 4px; background: var(--phase); }
.bar.deload { background-image: repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,.35) 3px, rgba(255,255,255,.35) 6px); }
.bar-btn .bl { font-size: 8.5px; color: var(--ink-faint); text-align: center; font-family: var(--mono); }
.bar-btn[aria-pressed="true"] .bar { outline: 2px solid var(--ink); outline-offset: 1px; }
.day-row { display: grid; grid-template-columns: 42px 1fr; gap: 6px; padding: 11px 0; border-top: 1px solid var(--line); }
.day-row:first-child { border-top: 0; }
.day-nm { font-size: 11px; font-weight: 650; color: var(--ink-faint); text-transform: uppercase; }
.sess { display: flex; gap: 9px; align-items: flex-start; }
.dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; flex: none; background: var(--eff-none); }
.dot.easy { background: var(--eff-easy); } .dot.moderate { background: var(--eff-moderate); } .dot.hard { background: var(--eff-hard); }
.sess .st { font-size: 13.5px; font-weight: 550; }
.sess .sm { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }

/* Activities */
.subtabs { display: flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 4px; margin-bottom: 14px; }
.subtabs button { flex: 1; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink-soft); background: none; border: 0; border-radius: 9px; padding: 8px; cursor: pointer; }
.subtabs button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.act { display: flex; align-items: center; gap: 12px; padding-left: 12px; position: relative; }
.act::before { content: ""; position: absolute; left: 0; top: 3px; bottom: 3px; width: 4px; border-radius: 3px; background: linear-gradient(var(--peak), var(--build)); }
.act .b { flex: 1; }
.act .t { font-size: 15px; font-weight: 650; }
.act .d { font-size: 12px; color: var(--ink-faint); margin-top: 1px; }
.act .m { display: flex; gap: 16px; margin-top: 7px; font-size: 12.5px; }
.act .m b { display: block; font-size: 14px; font-weight: 650; }
.act .m span { color: var(--ink-faint); font-size: 11px; }

/* Perf (fitness) */
.hero-pace { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface)); }
.hero-pace .lab { font-size: 12px; color: var(--ink-soft); font-weight: 600; }
.hero-pace .p { font-size: 40px; font-weight: 750; letter-spacing: -.03em; margin: 4px 0; }
.hero-pace .p small { font-size: 16px; color: var(--ink-faint); font-weight: 500; }
.hero-pace .s { font-size: 12.5px; color: var(--ink-soft); }
.dim-card .lab { font-size: 13.5px; font-weight: 650; }
.dim-card .plain { font-size: 12px; color: var(--ink-faint); margin-top: 2px; }
.dim-card .read { font-size: 15px; font-weight: 600; margin-top: 9px; color: var(--rc, var(--ink)); }
.dim-card .read.q { font-size: 13px; color: var(--ink-faint); font-weight: 500; }
.dmeter { display: flex; gap: 4px; margin-top: 9px; } .dmeter i { height: 7px; flex: 1; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); } .dmeter i.on { background: var(--rc); border-color: transparent; }

/* Community */
.empty-state { text-align: center; padding: 40px 20px; }
.empty-state .ic { width: 56px; height: 56px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
.empty-state h3 { font-size: 18px; margin: 0 0 6px; } .empty-state p { font-size: 13.5px; color: var(--ink-soft); max-width: 34ch; margin: 0 auto; }

/* Support */
.hub { display: grid; gap: 10px; }
.hubcard { display: flex; align-items: center; gap: 14px; text-align: left; width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 16px; cursor: pointer; font: inherit; color: inherit; }
.hubcard:hover { border-color: var(--accent); }
.hubcard .ic { width: 40px; height: 40px; border-radius: 11px; flex: none; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--hc, var(--accent)); }
.hubcard .ic svg { width: 20px; height: 20px; }
.hubcard .b { flex: 1; } .hubcard .t { font-size: 15px; font-weight: 650; } .hubcard .d { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
.hubcard .arr { color: var(--ink-faint); }
.tag-int { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line)); border-radius: 999px; padding: 1px 7px; }
.backbtn { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13.5px; color: var(--accent); background: none; border: 0; cursor: pointer; padding: 0; margin-bottom: 12px; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }
.opt { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; color: var(--ink-soft); cursor: pointer; padding: 5px 0; }
.opt input { margin-top: 3px; accent-color: var(--accent); flex: none; }
.subhead { font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; margin: 12px 0 6px; }
select.sel { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; width: 100%; }
.result { margin-top: 14px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: none; }
.result.show { display: block; }
.result .rb { padding: 12px 14px; color: #fff; background: var(--rbc); font-weight: 600; font-size: 14px; }
.result .ri { padding: 10px 14px; background: var(--surface); }
.result .item { padding: 10px 0; border-top: 1px solid var(--line); font-size: 13px; } .result .item:first-child { border-top: 0; }
.result .item .g { color: var(--ink-soft); margin-top: 3px; } .result .item .rf { color: var(--accent); font-weight: 600; margin-top: 4px; font-size: 12.5px; }
.disc { padding: 10px 14px; background: var(--surface-2); font-size: 11.5px; color: var(--ink-faint); border-top: 1px solid var(--line); }
.promise { display: flex; gap: 10px; background: color-mix(in srgb, var(--rest) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--rest) 28%, var(--line)); border-radius: 12px; padding: 12px 14px; font-size: 13px; margin-bottom: 12px; }
.promise b { color: var(--rest); }
.guide-body { font-size: 13.5px; color: var(--ink-soft); } .guide-body p { margin: 0 0 10px; }

/* Weather card */
.wx { border-left: 4px solid var(--wc); }
.wx-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.wx-sum { font-size: 12.5px; color: var(--ink-faint); font-weight: 600; }
.wx-head { font-size: 15px; font-weight: 650; letter-spacing: -.01em; margin-top: 3px; }
.wx-badge { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #fff; background: var(--wc); border-radius: 999px; padding: 3px 9px; white-space: nowrap; flex: none; }
.wx-penrow { margin-top: 8px; }
.wx-pen { font-family: var(--mono); font-size: 12px; color: var(--eff-hard); background: color-mix(in srgb, var(--eff-hard) 10%, transparent); border: 1px solid color-mix(in srgb, var(--eff-hard) 30%, var(--line)); border-radius: 6px; padding: 2px 8px; }
.wx-points { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 7px; }
.wx-points li { display: grid; grid-template-columns: 15px 1fr; gap: 8px; font-size: 13px; color: var(--ink-soft); }
.wx-points li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--wc); margin-top: 6px; }
.wx-foot { margin-top: 11px; } .wx-note { font-size: 11px; color: var(--ink-faint); font-style: italic; }
.wx-seg { margin-top: 10px; }
.wx-seg button { font-size: 12px; padding: 5px 10px; }
.wx-src { font-size: 12px; color: var(--ink-faint); margin: 6px 0 2px; display: flex; align-items: center; gap: 7px; }
.wx-src.live { color: var(--ink-soft); font-weight: 600; }
.wx-src .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ready); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ready) 22%, transparent); animation: wxPulse 2s ease-in-out infinite; }
@keyframes wxPulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.wx-loc { font: inherit; font-size: 12px; font-weight: 600; color: var(--accent); background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline; }

/* MAS */
.mas-hint { font-size: 12px; color: var(--ink-soft); margin-top: 6px; }
.mas-hint b { color: var(--accent); }
.mas-head { display: flex; align-items: baseline; gap: 12px; }
.mas-big { font-size: 30px; font-weight: 750; letter-spacing: -.02em; color: var(--accent); }
.mas-big small { font-size: 14px; color: var(--ink-faint); font-weight: 500; }
.mas-zones { display: grid; gap: 10px; margin-top: 14px; }
.mas-zone { border-left: 3px solid var(--accent); background: var(--surface-2); border-radius: 0 10px 10px 0; padding: 10px 13px; }
.mz-top { display: flex; align-items: baseline; justify-content: space-between; }
.mz-lab { font-size: 13.5px; font-weight: 650; }
.mz-pct { font-size: 12.5px; color: var(--accent); font-weight: 700; }
.mz-pace { font-size: 15px; font-weight: 650; margin-top: 3px; }
.mz-wr { font-size: 12px; color: var(--ink-faint); font-weight: 400; font-family: var(--sans); }
.mz-why { font-size: 12px; color: var(--ink-soft); margin-top: 4px; }

/* Setup banner */
.setup-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line)); border-radius: 14px; padding: 13px 15px; margin-bottom: 14px; cursor: pointer; font: inherit; color: var(--ink); }
.setup-banner b { font-size: 13.5px; } .setup-banner .sb-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; } .setup-banner span { color: var(--accent); font-weight: 600; font-size: 13px; white-space: nowrap; }

/* Live session */
.live-hero { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface)); }
.live-title { font-size: 18px; font-weight: 700; letter-spacing: -.01em; margin: 4px 0 12px; }
.live-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.voice-btn { flex: none; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-faint); cursor: pointer; }
.voice-btn svg { width: 18px; height: 18px; }
.voice-btn.on { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.live-metrics { display: grid; grid-template-columns: 1.15fr 1fr; gap: 10px; }
.live-metrics .lk { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); }
.live-metrics .lv { font-size: 30px; font-weight: 750; letter-spacing: -.02em; margin-top: 2px; }
.live-metrics .lv small, .live-paces .lv small { font-size: 12px; color: var(--ink-faint); font-weight: 500; }
.live-paces { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
.live-paces .lk { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); }
.live-paces .lv { font-size: 23px; font-weight: 750; letter-spacing: -.02em; margin-top: 2px; }
.lv.on { color: var(--eff-easy); } .lv.fast { color: var(--eff-moderate); } .lv.slow { color: var(--eff-hard); }
.live-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }
.live-controls .primary { margin: 0; grid-column: 1 / -1; }
.ctrl { font: inherit; font-size: 14px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; }
.ctrl:disabled { opacity: .45; cursor: not-allowed; }
.mini-btn { margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--accent); background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; cursor: pointer; }
.trial-ov { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; padding: 20px; background: color-mix(in srgb, var(--ink) 55%, transparent); backdrop-filter: blur(4px); }
.trial-ov.on { display: flex; }
.trial-panel { position: relative; width: 100%; max-width: 380px; background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 28px 22px 20px; box-shadow: var(--shadow); text-align: center; }
.trial-x { position: absolute; top: 12px; right: 14px; line-height: 1; background: none; border: 0; font-size: 17px; color: var(--ink-faint); cursor: pointer; }
.trial-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.trial-clock { font-family: var(--mono); font-size: 52px; font-weight: 700; letter-spacing: -.02em; margin: 8px 0 6px; color: var(--ink); font-variant-numeric: tabular-nums; }
.trial-msg { font-size: 13.5px; color: var(--ink-soft); line-height: 1.5; min-height: 44px; }
.trial-msg b { color: var(--ink); }
.trial-controls { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 16px 0 4px; }
.trial-controls.two { grid-template-columns: 1fr 1fr; }
.trial-controls .primary { margin: 0; }
.trial-foot { font-size: 11.5px; color: var(--ink-faint); line-height: 1.45; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
.lstep .kt { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #fff; background: var(--kc, var(--base)); border-radius: 6px; padding: 2px 8px; }
.lstep h4 { margin: 8px 0 2px; font-size: 15px; }
.lstep .tgt { font-size: 12.5px; color: var(--ink-soft); }
.lpbar { height: 9px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; margin-top: 10px; }
.lpbar > i { display: block; height: 100%; width: 0; background: var(--kc, var(--accent)); }
.lstep .cnt { font-size: 12px; color: var(--ink-faint); margin-top: 6px; }
.cuelog { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; }
.cue { display: flex; gap: 9px; align-items: baseline; font-size: 13px; }
.cue .ct { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); width: 40px; flex: none; }
.cue .badge { width: 7px; height: 7px; border-radius: 50%; margin-top: 5px; flex: none; background: var(--ink-faint); }
.cue.pace-fast .badge { background: var(--eff-moderate); } .cue.pace-slow .badge { background: var(--eff-hard); } .cue.pace-on .badge { background: var(--eff-easy); }
.cue.step .badge { background: var(--accent); } .cue.start .badge, .cue.done .badge { background: var(--build); }
.cue.split .badge { background: var(--peak); } .cue.split { font-weight: 650; }

/* Bottom nav */
.bottomnav { position: sticky; bottom: 0; z-index: 20; display: grid; grid-template-columns: repeat(5,1fr); background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
.navbtn { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: 0; padding: 6px 0; cursor: pointer; color: var(--ink-faint); font: inherit; }
.navbtn svg { width: 22px; height: 22px; }
.navbtn .nl { font-size: 10.5px; font-weight: 600; }
.navbtn.on { color: var(--accent); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
</style>
</head>
<body>
<div class="splash" id="splash">
  <div class="splash-mark">${BRAND_MARK}</div>
  <div class="splash-name">Inte<span>Run</span></div>
  <div class="splash-tag">The Intelligent Training Companion</div>
</div>
<div class="welcome" id="welcome">
  <div class="welcome-inner">
    <div class="welcome-mark">${BRAND_MARK}</div>
    <h1 class="welcome-h">Welcome to <span>InteRun</span></h1>
    <p class="welcome-msg m1">Your intelligent training companion.</p>
    <p class="welcome-msg m2">From your very first 5K to a marathon PB — a plan built around you.</p>
    <p class="welcome-msg m3">Let’s start with a few quick questions.</p>
    <button class="welcome-cta" id="welcomeGo">Get started →</button>
  </div>
</div>
<div class="app">
  <div class="topbar">
    <div class="tb-left">
      <button class="iconbtn" id="profileBtn" title="Profile" aria-label="Profile"></button>
      <button class="iconbtn" id="bellBtn" title="Notifications" aria-label="Notifications"></button>
    </div>
    <div class="title" id="topTitle">Today</div>
    <div class="tb-right">
      <button class="iconbtn" id="calBtn" title="Training calendar" aria-label="Training calendar"></button>
      <button class="iconbtn" id="themeBtn" title="Theme" aria-label="Toggle theme"></button>
    </div>
  </div>
  <div class="view" id="view"></div>
  <nav class="bottomnav" id="nav"></nav>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
// Time inputs: the user types only digits and the colons appear automatically (e.g. 13000 → 1:30:00).
function fmtDigitsToTime(raw) {
  const d = String(raw).replace(/\\D/g, "").slice(0, 6);
  if (!d) return "";
  if (d.length <= 2) return d;
  const ss = d.slice(-2), rest = d.slice(0, -2);
  return rest.length <= 2 ? rest + ":" + ss : rest.slice(0, -2) + ":" + rest.slice(-2) + ":" + ss;
}
function bindTimeInput(el) {
  if (!el || el._tbound) return;
  el._tbound = true;
  el.setAttribute("inputmode", "numeric");
  el.addEventListener("input", () => { const f = fmtDigitsToTime(el.value); el.value = f; try { el.setSelectionRange(f.length, f.length); } catch (e) {} });
}
const ICON = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/></svg>',
  activities: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  community: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.5A5 5 0 0 1 21 20"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 7v12"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-4 5-9 5-9z"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="2"/><path d="M12 9c0-3-2-5-2-5s-2 2-2 5 4 5 4 5 4-2 4-5-2-5-2-5-2 2-2 5M12 14v7"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z"/><path d="M5 4v16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><circle cx="8" cy="14" r=".6" fill="currentColor"/><circle cx="12" cy="14" r=".6" fill="currentColor"/><circle cx="16" cy="14" r=".6" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  wxSun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>',
  wxCloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 18z"/></svg>',
  wxWind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 14h15a2.5 2.5 0 1 1-2.5 2.5M3 12h6"/></svg>',
  wxSnow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 6l-2.5 2M12 6l2.5 2M12 18l-2.5-2M12 18l2.5-2"/></svg>',
  wxRain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>',
  vox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a4 4 0 0 1 0 7M18.6 6a7 7 0 0 1 0 12"/></svg>',
  voxOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
};
const PHASE = { base: "var(--base)", build: "var(--build)", peak: "var(--peak)", taper: "var(--taper)" };
const BAND = { ready: "var(--ready)", steady: "var(--steady)", ease: "var(--ease)", rest: "var(--rest)" };
const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// Add whole days to a yyyy-mm-dd string without timezone drift.
function isoAdd(iso, days) { const p = String(iso).split("-").map(Number); const dt = new Date(Date.UTC(p[0], (p[1]||1)-1, p[2]||1)); dt.setUTCDate(dt.getUTCDate() + days); return dt; }
function dmon(dt) { return dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()]; }

// ---- Your profile drives everything ---------------------------------------
const watch = { sleepHours: 7.5, restingHrDelta: 0, hrvStatus: "normal" };
function todayIso() { return new Date().toISOString().slice(0, 10); }
function futureIso(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function fmtTimeFull(s) { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), x = s%60; const p = (n) => String(n).padStart(2,"0"); return h>0 ? h+":"+p(m)+":"+p(x) : m+":"+p(x); }

// An example runner to start from — until you make it yours.
const DEFAULT_PROFILE = { name: "", avatar: "", status: "regular", goalDist: "half", targetS: 6300, raceDate: futureIso(245), fitSrc: "recent", recentDistM: 5000, recentTimeS: 1500, noRecent: false, oneKmS: 255, daysPerWeek: 5, yearsRunning: 3, weeklyVolumeKm: 30, age: 38, sex: "", strength: true, returning: false, personalized: false };

function loadProfile() { try { const s = localStorage.getItem("rc_profile_v1"); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveProfileStore() { try { localStorage.setItem("rc_profile_v1", JSON.stringify(profile)); } catch (e) {} }
// Completed runs recorded in-app (from a live GPS or simulated session) — persisted so they
// survive a reload and show up in Activities alongside the sample history.
function loadRuns() { try { return JSON.parse(localStorage.getItem("interun_runs") || "[]"); } catch (e) { return []; } }
function saveRuns() { try { localStorage.setItem("interun_runs", JSON.stringify(state.logged.slice(0, 50))); } catch (e) {} }

// Turn a profile into engine outputs. Throws if the goal can't be planned (e.g. race too soon).
function applyProfile(pf) {
  // Fitness can be given three ways (fitSrc): a couch-to-5k beginner (no time — we seed a gentle
  // baseline and flag noRecent), a recent 5 km, or a predicted 5 km. A brand-new beginner isn't fed
  // into runner classification since the baseline time is assumed, not run.
  const cls = RC.classifyRunner({ runsPerWeek: pf.daysPerWeek, yearsRunning: pf.yearsRunning, weeklyVolumeKm: pf.weeklyVolumeKm || undefined, recent5kSeconds: pf.noRecent ? undefined : pf.recentTimeS, sex: pf.sex || undefined });
  // Experience comes straight from the self-reported running status — the first question — which maps
  // cleanly to the plan/feasibility improvement ceiling. (Older profiles without a status fall back to
  // the noRecent flag.)
  const expByStatus = { new: "beginner", building: "beginner", regular: "recreational", competitive: "competitive" };
  const experience = expByStatus[pf.status] || (pf.noRecent ? "beginner" : "recreational");
  // The plan is built off the strongest current-fitness signal. When a 1 km trial is given and it
  // projects a faster 5 km than the 5 km source, it anchors the whole plan — every pace derives from
  // it — not just the VO₂ interval band. oneKmTrialSeconds is still passed so the VO₂ paces stay
  // precisely MAS-anchored and feasibility stays consistent.
  let recent = { distanceMeters: 5000, timeSeconds: pf.recentTimeS };
  if (pf.oneKmS > 0) {
    const proj5k = Math.round(RC.riegelPredict(1000, pf.oneKmS, 5000));
    if (proj5k < recent.timeSeconds) recent = { distanceMeters: 5000, timeSeconds: proj5k };
  }
  const ath = { daysPerWeek: pf.daysPerWeek, recent, experience, includeStrength: pf.strength, returningFromInjury: pf.returning, runWalk: pf.status === "new" };
  if (pf.oneKmS > 0) ath.oneKmTrialSeconds = pf.oneKmS;
  const goal = { distance: pf.goalDist, targetTimeSeconds: pf.targetS, raceDateIso: pf.raceDate, startDateIso: todayIso() };
  const plan = RC.buildPlanSummary(ath, goal); // may throw
  const raw = RC.generatePlan(ath, goal); // raw sessions with steps, for the live runtime
  // Fitness profile is built from real efforts only (the entered 5 km and/or the 1 km trial); a pure
  // beginner falls back to the seeded baseline so the page still has something to show.
  const efforts = [];
  if (!pf.noRecent) efforts.push({ distanceMeters: 5000, timeSeconds: pf.recentTimeS });
  if (pf.oneKmS > 0) efforts.push({ distanceMeters: 1000, timeSeconds: pf.oneKmS });
  if (efforts.length === 0) efforts.push({ distanceMeters: 5000, timeSeconds: pf.recentTimeS });
  const fitness = RC.buildFitnessProfile({ efforts });
  const masters = RC.assessMasters({ age: pf.age, sex: pf.sex || undefined });
  return { ath, goal, plan, raw, fitness, classification: cls, masters };
}

const storedProfile = loadProfile();
const FIRST_RUN = !storedProfile;
let profile = storedProfile || Object.assign({}, DEFAULT_PROFILE);
let PLAN, RAW, FITNESS, CLASS, MASTERS;
function recompute() { const r = applyProfile(profile); PLAN = r.plan; RAW = r.raw; FITNESS = r.fitness; CLASS = r.classification; MASTERS = r.masters; }
try { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); recompute(); }

const state = { tab: "today", screen: null, dayType: "quality", subj: { soreness: "none", energy: "good", stress: "low", motivation: "high", illness: "none" }, planWeek: PLAN.defaultWeekIndex, actTab: "performance", support: null, logged: loadRuns(), weather: "hot", wx: null, trialPending: false, trialSaved: null, done: {}, dayOverride: {}, selDay: 4 };
// Effective day index for a session, honouring any user reschedule. Works for raw sessions
// (dayOfWeek) and summary sessions (dayIndex), keyed by the shared session id.
function effDay(s) { const o = state.dayOverride[s.id]; return o != null ? o : (s.dayOfWeek != null ? s.dayOfWeek : s.dayIndex); }
const PRIMARY_TYPES = { easy: 1, long: 1, recovery: 1, threshold: 1, vo2: 1, strides: 1, "race-specific": 1 };
// Move a session to a target day; if a run already sits there, the two swap days.
function moveSession(week, sess, target) {
  const cur = effDay(sess);
  if (target === cur) return;
  const wk = RAW.weeks[week - 1]; if (!wk) return;
  if (PRIMARY_TYPES[sess.type]) {
    const occ = wk.sessions.find((s) => s.id !== sess.id && PRIMARY_TYPES[s.type] && effDay(s) === target);
    if (occ) state.dayOverride[occ.id] = cur;
  }
  state.dayOverride[sess.id] = target;
}
const TODAY_DOW = 4; // simulated "today" = Friday (a run day), matching the week strip
function doneKey(wIdx, s) { return wIdx + "|" + s.day + "|" + s.title; }
// Seed a realistic completed state for the demo: week-1 sessions earlier in the week than "today"
// count as done, so the calendar and Today reflect progress the way a mid-week user would see it.
function seedDone() {
  state.done = {};
  state.dayOverride = {}; // a fresh plan clears any reschedules (session ids change)
  const wk = PLAN.weeks[0]; if (!wk) return;
  wk.sessions.forEach((s) => { if (DAY_ORDER.indexOf(s.day) < TODAY_DOW && s.type !== "rest") state.done[doneKey(wk.index, s)] = true; });
}

// ---- helpers --------------------------------------------------------------
function fmtPace(s) { s = Math.round(s); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); }
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

// ============ TODAY ========================================================
function readinessInput() {
  const i = { sleepHours: watch.sleepHours, restingHrDelta: watch.restingHrDelta, soreness: state.subj.soreness, energy: state.subj.energy, stress: state.subj.stress, motivation: state.subj.motivation, illness: state.subj.illness };
  if (watch.hrvStatus !== "normal") i.hrvStatus = watch.hrvStatus;
  return i;
}
function renderReadiness() {
  const r = RC.assessReadiness(readinessInput());
  const easy = state.dayType === "easy";
  if (easy) {
    const flag = r.band === "rest" || r.band === "ease";
    return '<div class="easynote' + (flag ? " caution" : "") + '"><div class="m">' + (flag ? "Easy run planned — take it gently today." : "Easy run today — go by feel.") + '</div>' +
      '<div class="n">' + (flag ? "You flagged " + r.reasons[0].toLowerCase() + ". If you're not feeling it, resting is fine." : "Nothing to fill in — we only check in properly before hard sessions.") + '</div></div>';
  }
  const c = BAND[r.band];
  const reasons = r.band !== "ready" ? '<div class="chips">' + r.reasons.map((x) => '<span class="c">' + x + '</span>').join("") + '</div>' : "";
  return '<div class="status"><div class="band" style="--bc:' + c + '"><div class="h">' + r.headline + '</div><div class="rec">' + r.recommendation + '</div><div class="meter"><i style="width:' + r.score + '%"></i></div></div>' +
    '<div class="body">' + reasons + '<div class="reassure">' + r.reassurance + '</div></div></div>' +
    '<div class="watch"><span class="wl">From your watch</span><span class="c" style="font-size:12px;color:var(--ink-soft);background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:3px 9px">Slept ' + watch.sleepHours + ' h</span><span class="c" style="font-size:12px;color:var(--ink-soft);background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:3px 9px">Resting HR normal</span></div>';
}
function effortOf(s) { if (s.type === "rest" || s.type === "mobility") return "none"; if (s.type === "strength" || s.type === "cross-training") return "moderate"; if (s.intensity === "hard") return "hard"; if (s.intensity === "moderate") return "moderate"; return "easy"; }
function paceOf(s) { const rep = s.steps.find((st) => st.kind === "rep" && st.targetPaceSecPerKm); const steady = s.steps.find((st) => st.kind === "steady" && st.targetPaceSecPerKm); const quality = s.type === "threshold" || s.type === "vo2" || s.type === "race-specific"; const p = quality ? (rep || steady) : (steady || rep); if (!p) return null; return fmtPace(p.targetPaceSecPerKm.minSecPerKm) + "–" + fmtPace(p.targetPaceSecPerKm.maxSecPerKm) + "/km"; }
function rpeOf(s) { let band = s.targetRpe; if (!band) { const w = s.steps.filter((st) => st.targetRpe); if (w.length) band = { min: Math.min.apply(null, w.map((x) => x.targetRpe.min)), max: Math.max.apply(null, w.map((x) => x.targetRpe.max)) }; } return band ? band.min + "–" + band.max : null; }
// Sessions on the selected day (week 1), honouring reschedules; primary run first.
function sessionsOnSelectedDay() {
  return RAW.weeks[0].sessions.filter((s) => s.type !== "rest" && effDay(s) === state.selDay)
    .sort((a, b) => (PRIMARY_TYPES[b.type] || 0) - (PRIMARY_TYPES[a.type] || 0));
}
function selectedSession() { return sessionsOnSelectedDay()[0] || null; }
// Back-compat: the live-session start reads the featured session.
function rawToday() { return selectedSession() || RAW.weeks[0].sessions.find((s) => s.type !== "rest") || RAW.weeks[0].sessions[0]; }
// The striking hero card for the selected day's main session.
function heroWorkout() {
  const day = state.selDay;
  const eyebrow = day === TODAY_DOW ? "Today’s workout" : DAY_ORDER[day] + " " + (20 + day);
  const list = sessionsOnSelectedDay();
  const s = list[0];
  if (!s) {
    return '<div class="hero-wk rest"><div class="hw-eyebrow">' + eyebrow + '</div><div class="hw-title">Rest day</div><div class="hw-sub">Recovery is part of the plan — take it easy and come back fresh.</div></div>';
  }
  const durMin = Math.round(s.estimatedDurationSeconds / 60);
  const distKm = s.estimatedDistanceMeters ? Math.round(s.estimatedDistanceMeters / 100) / 10 : null;
  const pace = paceOf(s), rpe = rpeOf(s), eff = effortOf(s);
  const chips = ['<span class="hw-chip">' + durMin + "′" + (distKm ? " · " + distKm + " km" : "") + "</span>"];
  if (pace) chips.push('<span class="hw-chip">' + pace + "</span>");
  if (rpe) chips.push('<span class="hw-chip">RPE ' + rpe + "</span>");
  const extra = list.length > 1 ? '<div class="hw-also">＋ also ' + esc(list.slice(1).map((x) => SESSION_LABEL[x.type] || x.type).join(", ").toLowerCase()) + '</div>' : "";
  return '<div class="hero-wk tap" id="todayCard" style="--c:var(--eff-' + eff + ')" data-open="1" data-oweek="1" data-oid="' + s.id + '">' +
    '<div class="hw-eyebrow">' + eyebrow + '</div>' +
    '<div class="hw-title">' + esc(s.title) + '</div>' +
    '<div class="hw-chips">' + chips.join("") + '</div>' + extra +
    '<div class="hw-go">View full session <span>›</span></div>' +
    '<div class="hw-glow"></div></div>';
}
function weekStrip() {
  return '<div class="weekstrip">' + DAY_ORDER.map((d, i) => {
    const wk = PLAN.weeks[0];
    const has = wk.sessions.some((s) => s.type !== "rest" && effDay(s) === i);
    const eff = (wk.sessions.find((s) => s.type !== "rest" && effDay(s) === i) || {}).effort;
    const cls = "d" + (i === state.selDay ? " sel" : "") + (i === TODAY_DOW ? " today" : "");
    return '<button class="' + cls + '" data-day="' + i + '"><div class="dn">' + d + '</div><div class="dd">' + (20 + i) + '</div>' + (has ? '<div class="dot" style="background:var(--eff-' + (eff || "easy") + ')"></div>' : '<div class="dot" style="background:transparent"></div>') + '</button>';
  }).join("") + '</div>';
}
function viewToday() {
  if (state.trialPending) {
    return weekStrip() +
      '<h2 class="sec">Today\\'s workout</h2><div class="card">' + trialTodayCard() + '</div>' +
      '<div class="plan-note" style="border-left-color:var(--accent)">We\\'ve added a <b>1 km time trial</b> to today. Warm up as guided — only the 1 km itself is timed, and its time goes straight to your profile.</div>' +
      '<button class="primary" id="startTrial">' + ICON.play + ' Start time trial</button>' +
      '<button class="primary" id="cancelTrial" style="background:var(--surface-2);color:var(--ink-soft);margin-top:8px">Not today — back to my plan</button>';
  }
  const sess = selectedSession();
  const banner = profile.personalized ? "" : '<button class="setup-banner" id="setupBanner"><div><b>You\\'re viewing an example plan</b><div class="sb-sub">Tell us about you and your goal to make it yours.</div></div><span>Set up →</span></button>';
  const greeting = profile.name ? '<div class="greeting">Hi, <b>' + esc(profile.name) + '</b> \\uD83D\\uDC4B</div>' : "";
  let cta = "";
  if (sess && PRIMARY_TYPES[sess.type]) cta = '<button class="primary start-btn" id="startSession">' + ICON.play + ' Start session</button>';
  else if (sess) cta = '<button class="primary start-btn" id="viewSession">' + ICON.play + ' View session</button>';
  return banner + greeting + weekStrip() +
    heroWorkout() +
    cta +
    '<div class="tsq-row">' + conditionsSquare(sess) + feelSquare() + '</div>';
}
const WEATHER_PRESETS = {
  mild: { label: "Mild", tempC: 12, humidityPct: 55, windKph: 8 },
  warm: { label: "Warm", tempC: 22, humidityPct: 60, windKph: 10 },
  hot: { label: "Hot & humid", tempC: 30, humidityPct: 75, windKph: 8 },
  windy: { label: "Windy", tempC: 14, humidityPct: 55, windKph: 42 },
  cold: { label: "Cold", tempC: 1, humidityPct: 70, windKph: 16 },
};
const SEV_COLOR = { none: "var(--ready)", mild: "var(--steady)", moderate: "var(--ease)", high: "var(--eff-hard)", severe: "var(--rest)" };
const WX_ICON = { mild: "wxCloud", warm: "wxSun", hot: "wxSun", windy: "wxWind", cold: "wxSnow" };
// The conditions in force: a live local forecast once we've fetched one, otherwise the selected
// sample preset. Normalised to a common shape so the square, sheet and assessment share it.
function activeWeather() {
  if (state.wx) return state.wx;
  const p = WEATHER_PRESETS[state.weather];
  return { tempC: p.tempC, humidityPct: p.humidityPct, windKph: p.windKph, label: p.label, iconKey: WX_ICON[state.weather], live: false };
}
function currentConditions(session) {
  const w = activeWeather();
  return RC.assessConditions({ tempC: w.tempC, humidityPct: w.humidityPct, windKph: w.windKph, sessionType: (session && session.type) || "easy" });
}
// ---- Live local weather (Open-Meteo, no key, CORS-friendly) ----------------
// Blocked inside the Claude artifact sandbox (external fetch), where it silently falls back to the
// sample presets; works on the deployed PWA. Maps WMO weather codes to our labels and icons.
function wmoLabel(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}
function wmoIcon(code, windKph) {
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "wxSnow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "wxRain";
  if (windKph >= 30) return "wxWind";
  if (code === 0 || code === 1) return "wxSun";
  return "wxCloud";
}
let WX_FETCHING = false;
function fetchWeather(force) {
  if (WX_FETCHING || (state.wx && !force)) return;
  if (!(typeof navigator !== "undefined" && "geolocation" in navigator)) return;
  WX_FETCHING = true;
  navigator.geolocation.getCurrentPosition((pos) => {
    const la = pos.coords.latitude.toFixed(3), lo = pos.coords.longitude.toFixed(3);
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + la + "&longitude=" + lo + "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto";
    fetch(url).then((r) => r.ok ? r.json() : Promise.reject(r.status)).then((d) => {
      const c = d && d.current; if (!c) throw new Error("no data");
      state.wx = { tempC: Math.round(c.temperature_2m), humidityPct: Math.round(c.relative_humidity_2m), windKph: Math.round(c.wind_speed_10m), code: c.weather_code, label: wmoLabel(c.weather_code), iconKey: wmoIcon(c.weather_code, c.wind_speed_10m), live: true, at: Date.now() };
      WX_FETCHING = false;
      if (WX_SHEET_OPEN) { $("sheetBody").innerHTML = weatherSheetHtml(); wireWeatherSheet(); }
      else if (state.tab === "today" && !state.screen) render();
    }).catch(() => { WX_FETCHING = false; });
  }, () => { WX_FETCHING = false; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
// ---- Today's two summary squares ------------------------------------------
function conditionsSquare(session) {
  const w = activeWeather();
  const imp = currentConditions(session);
  const c = SEV_COLOR[imp.severity];
  const sub = imp.effortBased ? "Run by effort today" : imp.pacePenaltySecPerKm ? "≈ +" + imp.pacePenaltySecPerKm + "s/km" : "Good to run";
  return '<button class="tsq" id="condSq" style="--sqc:' + c + '">' +
    '<div class="tsq-ic">' + ICON[w.iconKey] + '</div>' +
    '<div class="tsq-k">Conditions' + (w.live ? ' · live' : '') + '</div>' +
    '<div class="tsq-v">' + w.tempC + '° · ' + w.label + '</div>' +
    '<div class="tsq-sub">' + sub + '</div></button>';
}
function feelSquare() {
  const r = RC.assessReadiness(readinessInput());
  const c = BAND[r.band];
  return '<button class="tsq" id="feelSq" style="--sqc:' + c + '">' +
    '<div class="tsq-ic">' + ICON.heart + '</div>' +
    '<div class="tsq-k">How you feel</div>' +
    '<div class="tsq-v">' + r.headline + '</div>' +
    '<div class="tsq-sub">Tap to check in</div></button>';
}
// ---- Detail sheets for conditions & readiness -----------------------------
function weatherSheetHtml() {
  const sess = selectedSession();
  const w = activeWeather();
  const imp = currentConditions(sess);
  const c = SEV_COLOR[imp.severity];
  const pen = imp.pacePenaltySecPerKm ? '<span class="chip rpe">≈ +' + imp.pacePenaltySecPerKm + 's/km at the same effort</span>' : "";
  const presetBtns = Object.keys(WEATHER_PRESETS).map((k) => '<button data-weather="' + k + '"' + (!state.wx && k === state.weather ? ' class="on"' : '') + '>' + WEATHER_PRESETS[k].label + '</button>').join("");
  const source = w.live
    ? '<div class="wx-src live"><span class="dot"></span>Live forecast · ' + w.windKph + ' km/h wind · ' + w.humidityPct + '% humidity</div>'
    : (WX_FETCHING ? '<div class="wx-src">Reading your local forecast…</div>' : '<div class="wx-src">Sample conditions · <button class="wx-loc" id="wxUseLoc">Use my location</button></div>');
  return '<div class="sd-type" style="--sc:' + c + '">Conditions' + (w.live ? ' · live' : '') + '</div>' +
    '<div class="sd-title">' + w.tempC + '° · ' + imp.summary + '</div>' +
    source +
    '<div class="sd-chips"><span class="chip">' + esc(imp.headline) + '</span>' + (imp.effortBased ? '<span class="chip rpe">Run by effort</span>' : '') + pen + '</div>' +
    '<ul class="wx-points" style="margin:8px 0 4px">' + imp.points.map((p) => '<li>' + p + '</li>').join("") + '</ul>' +
    '<div class="sd-move"><div class="sd-move-h">' + (w.live ? 'Preview other conditions' : 'Try other conditions') + '</div><div class="seg wx-seg" data-wxseg="1" style="margin-top:10px">' + presetBtns + '</div><div class="sd-move-n">' + (w.live ? 'Tap a preset to preview how a session would feel in different weather.' : 'Sample conditions — allow location to read your local forecast.') + '</div></div>';
}
let WX_SHEET_OPEN = false;
function openWeatherSheet() { ensureSheet(); SHEET_CTX = null; WX_SHEET_OPEN = true; fetchWeather(); $("sheetBody").innerHTML = weatherSheetHtml(); wireWeatherSheet(); $("sheetOv").classList.add("on"); }
function wireWeatherSheet() {
  // Selecting a preset drops any live forecast and previews that sample instead.
  document.querySelectorAll('#sheetBody [data-wxseg] button').forEach((b) => b.onclick = () => { state.wx = null; state.weather = b.dataset.weather; $("sheetBody").innerHTML = weatherSheetHtml(); wireWeatherSheet(); render(); });
  const useLoc = $("wxUseLoc"); if (useLoc) useLoc.onclick = () => { fetchWeather(true); $("sheetBody").innerHTML = weatherSheetHtml(); wireWeatherSheet(); };
}
function feelSheetHtml() {
  const r = RC.assessReadiness(readinessInput());
  const c = BAND[r.band];
  const reasons = r.band !== "ready" ? '<div class="chips" style="margin-top:10px">' + r.reasons.map((x) => '<span class="c">' + x + '</span>').join("") + '</div>' : "";
  const segs = [["dayType","Today’s session",[["quality","Quality"],["easy","Easy"]]],["soreness","Legs",[["none","Fine"],["mild","Stiff"],["moderate","Sore"],["high","Very sore"]]],["energy","Energy",[["good","Good"],["ok","OK"],["low","Low"]]],["stress","Stress",[["low","Low"],["normal","Normal"],["high","High"]]],["illness","Feeling ill?",[["none","No"],["slight","A little"],["unwell","Unwell"]]]];
  const cur = (f) => f === "dayType" ? state.dayType : state.subj[f];
  const body = segs.map((g) => '<div class="q"><label>' + g[1] + '</label><div class="seg" data-fseg="' + g[0] + '">' + g[2].map((o) => '<button data-v="' + o[0] + '"' + (cur(g[0]) === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>').join("") + '</div></div>').join("");
  return '<div class="sd-type" style="--sc:' + c + '">How you feel</div>' +
    '<div class="sd-title">' + esc(r.headline) + '</div>' +
    '<div class="sd-desc">' + esc(r.recommendation) + '</div>' +
    '<div class="meter" style="--bc:' + c + '"><i style="width:' + r.score + '%"></i></div>' + reasons +
    '<div class="sd-desc" style="margin-top:12px">' + esc(r.reassurance) + '</div>' +
    '<div class="watch" style="margin-top:12px"><span class="wl">From your watch</span><span class="c" style="font-size:12px;color:var(--ink-soft);background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:3px 9px">Slept ' + watch.sleepHours + ' h</span><span class="c" style="font-size:12px;color:var(--ink-soft);background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:3px 9px">Resting HR normal</span></div>' +
    '<div class="sd-move"><div class="sd-move-h">Tell us how you\\'re feeling</div>' + body + '</div>';
}
function openFeelSheet() { ensureSheet(); SHEET_CTX = null; $("sheetBody").innerHTML = feelSheetHtml(); wireFeelSheet(); $("sheetOv").classList.add("on"); }
function wireFeelSheet() {
  document.querySelectorAll('#sheetBody [data-fseg]').forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    const f = seg.dataset.fseg;
    if (f === "dayType") state.dayType = b.dataset.v; else state.subj[f] = b.dataset.v;
    $("sheetBody").innerHTML = feelSheetHtml(); wireFeelSheet(); render();
  }));
}

// ============ TRAINING CALENDAR ============================================
// A full plan-at-a-glance in calendar form: every week, every day, with completed sessions ticked.
// Tapping a session toggles its completion; the week's total shows completed / planned distance.
function calSessionRow(wIdx, s) {
  const key = doneKey(wIdx, s);
  const done = !!state.done[key];
  const bits = [];
  if (s.distKm) bits.push(s.distKm + " km");
  if (s.durMin) bits.push(s.durMin + "m");
  return '<div class="cal-sess' + (done ? " done" : "") + '">' +
    '<span class="cal-bar" style="background:var(--eff-' + s.effort + ')"></span>' +
    '<button class="cal-open" data-open="1" data-oweek="' + wIdx + '" data-oid="' + s.id + '"><span class="cal-t">' + s.title + '</span><span class="cal-sub">' + bits.join(" • ") + '</span></button>' +
    '<button class="cal-check" data-done="' + key + '" aria-label="Mark done">' + (done ? ICON.check : "") + '</button></div>';
}
function viewCalendar() {
  const back = '<button class="backbtn" id="calBack">‹ Back</button>';
  const todayIsoStr = todayIso();
  const weeks = PLAN.weeks.map((w) => {
    let doneKm = 0;
    w.sessions.forEach((s) => { if (state.done[doneKey(w.index, s)] && s.distKm) doneKm += s.distKm; });
    const rows = DAY_ORDER.map((dn, i) => {
      const dt = isoAdd(w.startIso, i);
      const isToday = dt.toISOString().slice(0, 10) === todayIsoStr;
      const daySessions = w.sessions.filter((s) => s.type !== "rest" && effDay(s) === i);
      const cells = daySessions.length ? daySessions.map((s) => calSessionRow(w.index, s)).join("") : '<div class="cal-empty">Rest</div>';
      return '<div class="cal-day' + (isToday ? " is-today" : "") + '"><div class="cal-dcol"><div class="cal-dn">' + dn.toUpperCase() + '</div><div class="cal-dd">' + dt.getUTCDate() + '</div></div><div class="cal-scol">' + cells + '</div></div>';
    }).join("");
    const total = (doneKm > 0 ? doneKm.toFixed(1) + " km / " : "") + w.distanceKm.toFixed(1) + " km";
    return '<div class="cal-week"><div class="cal-whead"><div class="cal-wtitle">' + dmon(isoAdd(w.startIso, 0)) + ' – ' + dmon(isoAdd(w.startIso, 6)) + ' <span class="cal-badge">WEEK ' + w.index + '</span></div><div class="cal-wtot">Total: <b>' + total + '</b></div></div>' + rows + '</div>';
  }).join("");
  return back + '<div class="cal-wrap">' + weeks + '</div>';
}

// ============ SESSION DETAIL SHEET =========================================
// Tap any session (Today, Plan week detail, or the training calendar) to see its full breakdown.
const SESSION_LABEL = { easy: "Easy run", long: "Long run", recovery: "Recovery", threshold: "Threshold", vo2: "Intervals", strides: "Easy + strides", "race-specific": "Race pace", strength: "Strength", mobility: "Mobility", "cross-training": "Cross-training", rest: "Rest" };
function rawSession(wIdx, dayName, title) {
  const w = RAW.weeks[wIdx - 1]; if (!w) return null;
  const dow = DAY_ORDER.indexOf(dayName);
  return w.sessions.find((s) => s.dayOfWeek === dow && s.title === title) || w.sessions.find((s) => s.title === title) || null;
}
function rawSessionById(wIdx, id) {
  const w = RAW.weeks[wIdx - 1]; if (!w) return null;
  return w.sessions.find((s) => s.id === id) || null;
}
function fmtSec(s) { s = Math.round(s); if (s < 60) return s + "″"; const m = Math.floor(s / 60), x = s % 60; return x ? m + "′" + String(x).padStart(2, "0") + "″" : m + "′"; }
function workLabel(st) { if (st.distanceMeters) return Math.round(st.distanceMeters) + " m"; if (st.durationSeconds) return fmtSec(st.durationSeconds); return st.label; }
function stepChips(st) {
  const b = [];
  if (st.targetPaceSecPerKm) b.push('<span class="chip pace">' + fmtPace(st.targetPaceSecPerKm.minSecPerKm) + "–" + fmtPace(st.targetPaceSecPerKm.maxSecPerKm) + "/km</span>");
  if (st.targetRpe) b.push('<span class="chip rpe">RPE ' + st.targetRpe.min + "–" + st.targetRpe.max + "</span>");
  return b.join("");
}
function structureRows(steps) {
  const rows = []; let i = 0;
  while (i < steps.length) {
    const st = steps[i];
    if (st.kind === "rep") {
      let j = i; const reps = [], recs = [];
      while (j < steps.length && (steps[j].kind === "rep" || steps[j].kind === "recovery")) { (steps[j].kind === "rep" ? reps : recs).push(steps[j]); j++; }
      const uniform = reps.every((r) => r.durationSeconds === reps[0].durationSeconds && r.distanceMeters === reps[0].distanceMeters);
      let lab;
      if (reps.length === 1) lab = esc(reps[0].label);
      else if (uniform) lab = reps.length + " × " + workLabel(reps[0]);
      else lab = reps.map(workLabel).join(" · ");
      const rec = recs[0];
      const recLine = rec ? "with " + workLabel(rec) + " " + (String(rec.label).toLowerCase().includes("walk") ? "walk" : "easy jog") + " between" : "";
      rows.push({ tag: "Work", lab, chips: stepChips(reps[0]), rec: recLine, muted: false });
      i = j;
    } else {
      const tag = st.kind === "warmup" ? "Warm-up" : st.kind === "cooldown" ? "Cool-down" : "Steady";
      rows.push({ tag, lab: esc(st.label), chips: stepChips(st), rec: "", muted: st.kind === "warmup" || st.kind === "cooldown" });
      i++;
    }
  }
  return rows;
}
// ---- Exercise demo animations (original, CSS cross-fade between two poses) --
function figSeg(a, b, cls) { return '<line class="' + cls + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; }
// A filled "mannequin": thick capsule limbs, a solid torso and a round head — not a thin stick figure.
function fig(j) {
  const neck = [j.head[0], j.head[1] + 8];
  let s = figSeg(neck, j.hip, "torso");
  // Far-side (back) arm/leg first, slightly faded, for a sense of depth.
  if (j.knee2) s += figSeg(j.hip, j.knee2, "limb back") + figSeg(j.knee2, j.ankle2, "limb back");
  if (j.el2) s += figSeg(neck, j.el2, "limb back") + figSeg(j.el2, j.ha2, "limb back");
  s += figSeg(j.hip, j.knee, "limb") + figSeg(j.knee, j.ankle, "limb") + figSeg(neck, j.el, "limb") + figSeg(j.el, j.ha, "limb");
  s += '<circle class="head" cx="' + j.head[0] + '" cy="' + j.head[1] + '" r="9"/>';
  return s;
}
const _S = { head: [60, 26], hip: [60, 80], knee: [60, 102], ankle: [60, 124], el: [49, 56], ha: [46, 76] };
const POSES = {
  squat: [_S, { head: [60, 40], hip: [48, 88], knee: [74, 104], ankle: [60, 124], el: [74, 64], ha: [86, 66] }],
  hinge: [_S, { head: [98, 58], hip: [62, 76], knee: [62, 101], ankle: [64, 124], el: [94, 74], ha: [94, 96] }],
  lunge: [
    { head: [60, 26], hip: [60, 80], knee: [60, 102], ankle: [60, 124], el: [49, 56], ha: [46, 76], knee2: [60, 102], ankle2: [60, 124] },
    { head: [58, 44], hip: [58, 86], knee: [80, 106], ankle: [90, 124], el: [49, 72], ha: [45, 88], knee2: [42, 110], ankle2: [26, 122] },
  ],
  calf: [_S, { head: [60, 18], hip: [60, 72], knee: [60, 94], ankle: [60, 116], el: [49, 48], ha: [46, 68] }],
  push: [
    { head: [28, 64], hip: [74, 82], knee: [96, 88], ankle: [112, 92], el: [32, 92], ha: [32, 106] },
    { head: [28, 76], hip: [74, 90], knee: [96, 94], ankle: [112, 96], el: [24, 94], ha: [32, 106] },
  ],
  plank: [
    { head: [28, 64], hip: [74, 82], knee: [96, 88], ankle: [112, 92], el: [32, 92], ha: [32, 106] },
    { head: [28, 66], hip: [74, 84], knee: [96, 90], ankle: [112, 94], el: [32, 93], ha: [32, 107] },
  ],
  jump: [
    { head: [60, 44], hip: [52, 86], knee: [74, 104], ankle: [60, 124], el: [70, 64], ha: [80, 58] },
    { head: [60, 16], hip: [60, 58], knee: [58, 78], ankle: [60, 98], el: [48, 32], ha: [42, 20] },
  ],
  balance: [
    { head: [60, 26], hip: [60, 80], knee: [60, 102], ankle: [60, 124], el: [47, 54], ha: [41, 68], knee2: [76, 94], ankle2: [86, 108] },
    { head: [62, 26], hip: [62, 80], knee: [62, 102], ankle: [62, 124], el: [51, 54], ha: [47, 68], knee2: [80, 96], ankle2: [92, 110] },
  ],
  bridge: [
    { head: [26, 104], hip: [72, 104], knee: [92, 94], ankle: [100, 112], el: [30, 110], ha: [40, 112] },
    { head: [26, 104], hip: [72, 86], knee: [92, 94], ankle: [100, 112], el: [30, 110], ha: [40, 112] },
  ],
  core: [
    { head: [34, 72], hip: [82, 76], knee: [96, 98], ankle: [108, 100], el: [38, 92], ha: [38, 104] },
    { head: [32, 66], hip: [82, 74], knee: [98, 60], ankle: [114, 52], el: [24, 58], ha: [10, 50] },
  ],
};
function exAnim(pattern) {
  const p = POSES[pattern] || POSES.squat;
  return '<svg class="exfig" viewBox="0 0 120 132" aria-hidden="true"><line class="grd" x1="12" y1="125" x2="108" y2="125"/><g class="p0">' + fig(p[0]) + '</g><g class="p1">' + fig(p[1]) + '</g></svg>';
}
// ---- Strength logging (weights & reps, saved locally) ----------------------
function loadSlog() { try { return JSON.parse(localStorage.getItem("interun_slog") || "{}"); } catch (e) { return {}; } }
function slogSet(key, field, val) {
  const s = loadSlog();
  s[key] = s[key] || {};
  if (val === "") delete s[key][field]; else s[key][field] = val;
  if (!Object.keys(s[key]).length) delete s[key];
  localStorage.setItem("interun_slog", JSON.stringify(s));
}
function exerciseBlock(sessId, ei, e) {
  const log = loadSlog();
  const setRows = [];
  for (let i = 0; i < e.sets; i++) {
    const key = sessId + "|" + ei + "|" + i;
    const rec = log[key] || {};
    setRows.push('<div class="ex-set"><span class="setn">Set ' + (i + 1) + '</span>' +
      '<input class="set-in" inputmode="decimal" placeholder="kg" data-slog="' + key + '" data-f="w" value="' + (rec.w || "") + '">' +
      '<span class="ex-x">×</span>' +
      '<input class="set-in" inputmode="numeric" placeholder="reps" data-slog="' + key + '" data-f="r" value="' + (rec.r || "") + '"></div>');
  }
  const sec = e.secondary && e.secondary.length ? ' <span class="ex-sec">· ' + e.secondary.map(esc).join(", ") + '</span>' : "";
  return '<div class="ex"><div class="ex-anim">' + exAnim(e.pattern) + '</div>' +
    '<div class="ex-main"><div class="ex-name">' + esc(e.name) + '</div>' +
    '<div class="ex-mus"><b>' + esc(e.primary) + '</b>' + sec + '</div>' +
    '<div class="ex-presc">' + e.sets + ' × ' + esc(e.reps) + '</div></div></div>' +
    '<div class="ex-cue">' + esc(e.cue) + '</div>' +
    '<div class="ex-log">' + setRows.join("") + '</div>';
}
let SHEET_CTX = null;
function sessionSheetHtml(sess, week) {
  const sc = "var(--eff-" + effortOf(sess) + ")";
  const dur = Math.round(sess.estimatedDurationSeconds / 60);
  const dist = sess.estimatedDistanceMeters ? (Math.round(sess.estimatedDistanceMeters / 100) / 10) + " km" : null;
  const chips = ['<span class="chip">' + dur + "′" + (dist ? " · " + dist : "") + "</span>"];
  if (sess.targetRpe) chips.push('<span class="chip rpe">RPE ' + sess.targetRpe.min + "–" + sess.targetRpe.max + "</span>");
  let body;
  if (sess.exercises && sess.exercises.length) {
    body = '<div class="ex-list">' + sess.exercises.map((e, ei) => exerciseBlock(sess.id, ei, e)).join("") + '</div>';
  } else {
    const rows = structureRows(sess.steps).map((r) =>
      '<div class="sd-step"><div class="sd-dot" style="background:' + (r.muted ? "var(--ink-faint)" : sc) + '"></div><div><div class="sd-tag">' + r.tag + '</div><div class="sd-lab">' + r.lab + '</div>' + (r.chips ? '<div class="sd-meta">' + r.chips + '</div>' : "") + (r.rec ? '<div class="sd-rec">' + r.rec + '</div>' : "") + '</div></div>').join("");
    body = rows ? '<div class="sd-steps">' + rows + '</div>' : "";
  }
  // Reschedule row — pick any day; a run already there swaps with this one.
  const cur = effDay(sess);
  const dayPicker = DAY_ORDER.map((dn, i) => '<button class="sd-day' + (i === cur ? " on" : "") + '" data-moveto="' + i + '"' + (i === cur ? " disabled" : "") + '>' + dn + '</button>').join("");
  const moveBlock = sess.type === "rest" ? "" :
    '<div class="sd-move"><div class="sd-move-h">Move to another day</div><div class="sd-days">' + dayPicker + '</div><div class="sd-move-n">Pick a day. If a run is already there, the two will swap.</div></div>';
  return '<div class="sd-type" style="--sc:' + sc + '">' + (SESSION_LABEL[sess.type] || sess.type) + '</div>' +
    '<div class="sd-title">' + esc(sess.title) + '</div>' +
    '<div class="sd-chips">' + chips.join("") + '</div>' +
    '<div class="sd-desc">' + esc(sess.description) + '</div>' +
    body +
    moveBlock;
}
function ensureSheet() {
  if ($("sheetOv")) return;
  const node = el('<div class="sheet-ov" id="sheetOv"><div class="sheet"><button class="sheet-x" id="sheetClose" aria-label="Close">✕</button><div class="sheet-body" id="sheetBody"></div></div></div>');
  document.querySelector(".app").appendChild(node);
  $("sheetClose").onclick = closeSheet;
  $("sheetOv").onclick = (e) => { if (e.target === $("sheetOv")) closeSheet(); };
}
function wireSheet() {
  document.querySelectorAll("[data-moveto]").forEach((b) => b.onclick = () => {
    if (!SHEET_CTX) return;
    moveSession(SHEET_CTX.week, SHEET_CTX.sess, Number(b.dataset.moveto));
    closeSheet();
    render();
  });
  document.querySelectorAll("#sheetBody [data-slog]").forEach((inp) => inp.oninput = () => slogSet(inp.dataset.slog, inp.dataset.f, inp.value.trim()));
}
function openSessionSheet(sess, week) {
  if (!sess) return;
  ensureSheet();
  SHEET_CTX = { sess, week: week || state.planWeek || 1 };
  $("sheetBody").innerHTML = sessionSheetHtml(sess, SHEET_CTX.week);
  wireSheet();
  $("sheetOv").classList.add("on");
}
function closeSheet() { const o = $("sheetOv"); if (o) o.classList.remove("on"); WX_SHEET_OPEN = false; }
// Wire every element carrying data-open to open its session detail (keyed by stable session id).
function wireSessionTaps() {
  document.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => {
    const wk = Number(b.dataset.oweek);
    openSessionSheet(rawSessionById(wk, b.dataset.oid), wk);
  });
}

// ============ PLAN =========================================================
function viewPlan() {
  const g = PLAN.goal, s = PLAN.summary;
  const peak = s.peakKm || 1;
  const bars = PLAN.weeks.map((w) => {
    const h = Math.max(6, Math.round(w.distanceKm / peak * 100));
    return '<button class="bar-btn" data-wk="' + w.index + '" aria-pressed="' + (w.index===state.planWeek) + '"><div class="bar' + (w.isDeload?" deload":"") + '" style="height:' + h + '%;--phase:' + PHASE[w.phase] + '"></div><div class="bl">' + w.index + '</div></button>';
  }).join("");
  const lead = s.totalWeeks - s.structuredWeeks;
  const note = lead >= 2 ? '<div class="plan-note">Your race is <b>' + s.totalWeeks + ' weeks</b> away — this is your <b>' + s.structuredWeeks + '-week</b> structured build. Until it begins, keep running easy and consistent to bank the base.</div>' : "";
  let srcMsg = "";
  if (profile.status === "new") srcMsg = "Built for a <b>total beginner</b> — walk\\u2013run to start, sharpening as you log runs.";
  else if (profile.status === "building" || profile.noRecent) srcMsg = "Built to <b>grow your consistency</b> — it sharpens as you log runs or record a 1 km trial.";
  else if (profile.fitSrc === "predicted") srcMsg = "Based on your <b>predicted 5 km</b> time — log a real run and it\\'ll re-tune to your actual fitness.";
  if (profile.oneKmS > 0) srcMsg = (srcMsg ? srcMsg + " " : "") + "Your paces are anchored to your <b>1 km trial</b>.";
  const starterNote = srcMsg ? '<div class="plan-note" style="border-left-color:var(--accent)">' + srcMsg + '</div>' : "";
  return '<div class="card plan-head"><div class="eyebrow">Your plan</div><div class="goal">' + g.race + ' · ' + g.target + '</div><div class="when">' + g.raceDate + ' · ' + s.structuredWeeks + '-week plan</div>' +
    '<span class="pill" style="--pc:' + (PLAN.feasibility.verdict==="achievable"?"var(--accent)":"var(--peak)") + '">' + PLAN.feasibility.verdict + '</span>' +
    '<div class="statrow"><div class="stat"><div class="k">Weeks</div><div class="v num">' + s.structuredWeeks + '</div></div><div class="stat"><div class="k">Peak/wk</div><div class="v num">' + s.peakKm + ' km</div></div><div class="stat"><div class="k">Goal pace</div><div class="v num">' + PLAN.paces.goal.replace("/km","") + '</div></div></div></div>' +
    starterNote +
    note +
    '<h2 class="sec">Training block</h2><div class="card"><div class="chart" id="chart">' + bars + '</div></div>' +
    '<h2 class="sec">Week detail</h2><div class="card" id="weekDetail">' + weekDetail() + '</div>';
}
function weekDetail() {
  const w = PLAN.weeks.find((x) => x.index === state.planWeek) || PLAN.weeks[0];
  const byDay = {};
  w.sessions.filter((s) => s.type !== "rest").forEach((s) => { const d = effDay(s); (byDay[d] = byDay[d] || []).push(s); });
  const rows = DAY_ORDER.map((dn, di) => {
    const list = byDay[di];
    let inner;
    if (!list || !list.length) {
      inner = '<div class="sess"><span class="dot none"></span><div><div class="st" style="color:var(--ink-faint);font-weight:550">Rest</div></div></div>';
    } else {
      inner = list.map((s) => {
        const meta = ['<span class="chip">' + s.durMin + "′" + (s.distKm ? " · " + s.distKm + "km" : "") + "</span>"];
        if (s.pace) meta.push('<span class="chip pace">' + s.pace + "</span>");
        return '<div class="sess tap" data-open="1" data-oweek="' + w.index + '" data-oid="' + s.id + '"><span class="dot ' + s.effort + '"></span><div><div class="st">' + s.title + '</div><div class="sm">' + meta.join("") + '</div></div></div>';
      }).join("");
    }
    return '<div class="day-row"><div class="day-nm">' + dn + '</div><div>' + inner + '</div></div>';
  }).join("");
  return '<div style="font-weight:650;font-size:15px;margin-bottom:2px">Week ' + w.index + ' · ' + w.phase + (w.isDeload?" · deload":"") + '</div><div style="font-size:12.5px;color:var(--ink-faint);margin-bottom:8px">' + w.focus + '</div>' + rows;
}

// ============ ACTIVITIES ===================================================
const SAMPLE_ACTS = [
  { t: "Easy Run", d: "23 Jul · 16:31", dist: "5.01 km", time: "28:00", pace: "5:35 /km" },
  { t: "Easy Run", d: "21 Jul · 17:08", dist: "5.54 km", time: "31:30", pace: "5:41 /km" },
  { t: "Easy Run", d: "14 Jul · 14:58", dist: "4.58 km", time: "25:36", pace: "5:35 /km" },
];
function viewActivities() {
  const t = (k, lab) => '<button data-at="' + k + '"' + (state.actTab === k ? ' class="on"' : '') + '>' + lab + '</button>';
  const tabs = '<div class="subtabs">' + t("workouts", "Runs") + t("strength", "Strength") + t("performance", "Performance") + '</div>';
  if (state.actTab === "workouts") {
    const list = state.logged.concat(SAMPLE_ACTS).map((a) =>'<div class="card" style="margin-bottom:10px"><div class="act"><div class="b"><div class="t">' + a.t + '</div><div class="d">' + a.d + '</div><div class="m"><div><b class="num">' + a.dist + '</b><span>Distance</span></div><div><b class="num">' + a.time + '</b><span>Time</span></div><div><b class="num">' + a.pace + '</b><span>Avg pace</span></div></div></div></div></div>').join("");
    return tabs + '<div style="font-size:12.5px;color:var(--ink-faint);margin:0 2px 12px">Your recent runs</div>' + list;
  }
  if (state.actTab === "strength") return tabs + viewStrengthHistory();
  return tabs + viewPerformance();
}
// Aggregate all logged strength sets by exercise, in plan order (week = a session instance).
function strengthHistory() {
  const slog = loadSlog();
  const groups = {};
  for (const key in slog) {
    const parts = key.split("|");
    const g = parts[0] + "|" + parts[1];
    (groups[g] = groups[g] || {})[parts[2]] = slog[key];
  }
  const byEx = {};
  for (const g in groups) {
    const gp = g.split("|");
    const sessId = gp[0], exIdx = Number(gp[1]);
    const wk = Number((sessId.match(/^w(\\d+)/) || [])[1]);
    const raw = RAW.weeks[wk - 1] && RAW.weeks[wk - 1].sessions.find((s) => s.id === sessId);
    const ex = raw && raw.exercises && raw.exercises[exIdx];
    if (!ex) continue;
    const sets = Object.keys(groups[g]).sort((a, b) => a - b).map((i) => groups[g][i]).filter((s) => s.w || s.r);
    if (!sets.length) continue;
    (byEx[ex.name] = byEx[ex.name] || { name: ex.name, primary: ex.primary, pattern: ex.pattern, instances: [] }).instances.push({ week: wk, sets });
  }
  for (const n in byEx) byEx[n].instances.sort((a, b) => a.week - b.week);
  return byEx;
}
function topWeight(sets) { return sets.reduce((m, s) => Math.max(m, parseFloat(s.w) || 0), 0); }
function viewStrengthHistory() {
  const hist = strengthHistory();
  const names = Object.keys(hist);
  if (!names.length) {
    return '<div class="empty-state"><div class="ic">' + ICON.dumbbell + '</div><h3>No strength logged yet</h3><p>Open a strength session, tap an exercise and record your weights and reps. Your progress on each lift will build up here.</p></div>';
  }
  // Sort by most recently logged.
  names.sort((a, b) => hist[b].instances[hist[b].instances.length - 1].week - hist[a].instances[hist[a].instances.length - 1].week);
  const cards = names.map((n) => {
    const ex = hist[n];
    const best = ex.instances.reduce((m, ins) => Math.max(m, topWeight(ins.sets)), 0);
    const tops = ex.instances.map((ins) => topWeight(ins.sets));
    const peak = Math.max(...tops, 1);
    const spark = tops.map((w) => '<i style="height:' + Math.max(8, Math.round((w / peak) * 100)) + '%"></i>').join("");
    const rows = ex.instances.slice().reverse().slice(0, 4).map((ins) => {
      const sets = ins.sets.map((s) => (s.w || "—") + (s.w ? "kg" : "") + (s.r ? " × " + s.r : "")).join("  ·  ");
      return '<div class="sh-row"><span class="sh-wk">Week ' + ins.week + '</span><span class="sh-sets">' + sets + '</span></div>';
    }).join("");
    return '<div class="card sh-card"><div class="sh-head"><div class="ex-anim sh-anim">' + exAnim(ex.pattern) + '</div>' +
      '<div class="sh-main"><div class="sh-name">' + esc(ex.name) + '</div><div class="sh-mus">' + esc(ex.primary) + '</div>' +
      '<div class="sh-best">Best <b>' + (best ? best + " kg" : "—") + '</b> · ' + ex.instances.length + ' session' + (ex.instances.length > 1 ? "s" : "") + '</div></div>' +
      (tops.some((w) => w > 0) ? '<div class="sh-spark">' + spark + '</div>' : '') + '</div>' +
      '<div class="sh-rows">' + rows + '</div></div>';
  }).join("");
  return '<div style="font-size:12.5px;color:var(--ink-faint);margin:0 2px 12px">Your logged lifts — weight & reps over time.</div>' + cards;
}
function dimLevel(vo2) { return vo2 < 40 ? 1 : vo2 < 50 ? 2 : vo2 < 60 ? 3 : 4; }
function viewPerformance() {
  const t = FITNESS.thresholdSpeed, a = FITNESS.aerobicCapacity, d = FITNESS.durability;
  const lvl = dimLevel(a.value); const words = { 1:"Building your base", 2:"A solid base", 3:"Strong endurance", 4:"Very strong endurance" };
  const meter = [1,2,3,4].map((i) => '<i class="' + (i<=lvl?"on":"") + '" style="--rc:var(--build)"></i>').join("");
  const dRead = d.confidence === "none" ? '<div class="read q">We\\'ll learn this from your long runs</div>' : '<div class="read">Holds pace well</div>';
  return '<div class="card hero-pace"><div class="lab">Your strong, steady pace</div><div class="p num">' + fmtPace(t.value) + ' <small>/km</small></div><div class="s">The pace you can hold for a long, hard effort.</div></div>' +
    '<div class="card dim-card" style="margin-top:10px"><div class="lab">Endurance base</div><div class="plain">How big your aerobic engine is.</div><div class="read" style="--rc:var(--build)">' + words[lvl] + '</div><div class="dmeter">' + meter + '</div></div>' +
    '<div class="card dim-card" style="margin-top:10px"><div class="lab">Strength when tired</div><div class="plain">How well you hold pace late in long runs.</div>' + dRead + '</div>' +
    masCard();
}
function masCard() {
  if (!profile.oneKmS) {
    return '<h2 class="sec">Maximal Aerobic Speed</h2><div class="card"><div class="plain" style="font-size:13px;color:var(--ink-soft)">Add a <b>1 km max-effort time trial</b> in your profile and we\\'ll work out your MAS — and use it to set your VO₂/interval paces.</div></div>';
  }
  const m = RC.computeMas(profile.oneKmS);
  const rows = m.zones.map((z) => {
    const wr = z.workSeconds ? z.workSeconds + "s / " + z.restSeconds + "s" + (z.repDistanceMeters ? " · ~" + z.repDistanceMeters + " m" : "") : "2–5 min reps";
    return '<div class="mas-zone"><div class="mz-top"><span class="mz-lab">' + z.label + '</span><span class="mz-pct num">' + z.pct + '%</span></div>' +
      '<div class="mz-pace num">' + fmtPace(z.paceSecPerKm) + '/km <span class="mz-wr">· ' + wr + '</span></div>' +
      '<div class="mz-why">' + z.purpose + '</div></div>';
  }).join("");
  return '<h2 class="sec">Maximal Aerobic Speed (MAS)</h2>' +
    '<div class="card"><div class="mas-head"><div><div class="mas-big num">' + m.masMps.toFixed(2) + ' <small>m/s</small></div><div class="plain">from your ' + fmtPace(m.oneKmSeconds) + ' 1 km · pace ' + fmtPace(m.masPaceSecPerKm) + '/km</div></div></div>' +
    '<div class="mas-zones">' + rows + '</div>' +
    '<div class="plain" style="font-size:11.5px;color:var(--ink-faint);margin-top:10px">Your plan\\'s VO₂/interval paces are set from this. Interval targets shown as % of MAS.</div></div>';
}

// ============ COMMUNITY ====================================================
function viewCommunity() {
  return '<div class="empty-state"><div class="ic">' + ICON.community + '</div><h3>Community is on the way</h3><p>Groups, challenges and cheering each other on — a friendly place to keep you going. We\\'re building it next.</p></div>';
}

// ============ SUPPORT ======================================================
const SUPPORT_HUB = [
  { id: "redflags", ic: "heart", c: "var(--rest)", t: "Injury & symptoms", d: "A quick check for anything that needs attention now.", interactive: true },
  { id: "reds", ic: "fuel", c: "var(--peak)", t: "Fuelling & energy", d: "Are you getting enough? A gentle RED-S check.", interactive: true },
  { id: "female", ic: "flower", c: "var(--taper)", t: "Women's health", d: "Symptom-informed prompts — periods, postpartum, more.", interactive: true },
  { id: "strength", ic: "dumbbell", c: "var(--build)", t: "Strength & mobility", d: "Why strength matters, and how to fit it in.", interactive: false },
  { id: "guides", ic: "book", c: "var(--accent)", t: "Training guides", d: "Plain-English answers grounded in the research.", interactive: false },
];
function viewSupport() {
  if (state.support) return supportDetail(state.support);
  const cards = SUPPORT_HUB.map((h) => '<button class="hubcard" data-hub="' + h.id + '"><div class="ic" style="--hc:' + h.c + '">' + ICON[h.ic] + '</div><div class="b"><div class="t">' + h.t + (h.interactive ? ' <span class="tag-int">Check-in</span>' : '') + '</div><div class="d">' + h.d + '</div></div><div class="arr">›</div></button>').join("");
  return '<div class="hub">' + cards + '</div>';
}
function supportDetail(id) {
  const back = '<button class="backbtn" id="supBack">‹ Support</button>';
  if (id === "redflags") return back + redflagsView();
  if (id === "reds") return back + redsView();
  if (id === "female") return back + femaleView();
  if (id === "strength") return back + '<h2 class="sec" style="margin-top:0">Strength &amp; mobility</h2><div class="card guide-body"><p>Heavy strength training two times a week is one of the best-evidenced ways to improve your running — it builds economy and protects you from injury, without making you bulky.</p><p>Think squats, single-leg work, calf raises and hip strength — low reps, challenging load. Plyometrics (hops, bounds) come in once you\\'re running fast comfortably.</p><p>Mobility is about keeping the range you need — dynamic warm-ups before quality sessions beat long static stretching.</p></div>';
  return back + '<h2 class="sec" style="margin-top:0">Training guides</h2><div class="card guide-body"><p>Short, plain-English answers grounded in current endurance-running research — training intensity, tapering, long runs and more.</p><p>These are coming as we build out the content library.</p></div>';
}
const FLAGS_PHYS = { "chest-pain":"Chest pain or pressure","collapse-or-fainting":"Fainting or collapse","severe-breathlessness":"Severe breathlessness","neurological":"Confusion, severe headache, weakness","bone-pain":"Pinpoint bone pain","rapidly-worsening-pain":"Pain worsening quickly" };
const FLAGS_WELL = { "eating-disorder-concern":"Worries about my eating","menstrual-disruption":"Periods stopped / irregular","mental-health-concern":"Struggling mentally","self-harm-thoughts":"Thoughts of harming myself" };
const REDS_OPTS = { "unintentional-weight-loss":"Losing weight unintentionally","restrictive-or-skipped-meals":"Skipping / restricting meals","menstrual-disruption":"Periods stopped / irregular","bone-stress-history":"Bone stress injury history","recurrent-illness":"Getting ill often","persistent-fatigue":"Persistent fatigue","always-feeling-cold":"Always cold","low-mood-or-irritability":"Low mood" };
const PROF = RC.PROFESSIONAL_LABEL;
function referLine(refer) { if (!refer || !refer.length) return ""; const n = refer.map((r) => PROF[r] || r); const j = n.length>1 ? n.slice(0,-1).join(", ") + " or " + n[n.length-1] : n[0]; return '<div class="rf">Talk to ' + j + '.</div>'; }
function checks(map, name) { return Object.entries(map).map(([k,v]) => '<label class="opt"><input type="checkbox" data-chk="' + name + '" value="' + k + '"><span>' + v + '</span></label>').join(""); }
function redflagsView() {
  return '<div class="promise"><span><b>In an emergency</b>, don\\'t use an app — call your local emergency number.</span></div>' +
    '<h2 class="sec" style="margin-top:0">How are you feeling?</h2><div class="card"><div class="subhead">Physical</div><div class="opts">' + checks(FLAGS_PHYS,"rf") + '</div><div class="subhead">Wellbeing</div><div class="opts">' + checks(FLAGS_WELL,"rf") + '</div><div class="result" id="rfRes"></div></div>';
}
function redsView() {
  return '<h2 class="sec" style="margin-top:0">Fuelling &amp; energy</h2><div class="card"><div style="font-size:12.5px;color:var(--ink-faint);margin-bottom:8px">Under-fuelling harms health and performance. Tick anything that sounds like you — this is about getting enough, never eating less.</div><div class="opts">' + checks(REDS_OPTS,"reds") + '</div><div class="result" id="redsRes"></div></div>';
}
function femaleView() {
  return '<h2 class="sec" style="margin-top:0">Women\\'s health</h2><div class="card"><div style="font-size:12.5px;color:var(--ink-faint);margin-bottom:10px">Symptom-informed, not calendar-based. It just surfaces what\\'s worth a conversation.</div>' +
    '<label style="font-size:12.5px;font-weight:600;color:var(--ink-soft)">Menstrual status</label><select class="sel" id="fhStatus" style="margin-top:6px"><option value="regular">Regular periods</option><option value="irregular">Irregular periods</option><option value="absent-3m-plus">No period for 3+ months</option><option value="postpartum">Postpartum</option><option value="perimenopause">Perimenopause</option><option value="menopause">Menopause</option><option value="prefer-not-to-say">Prefer not to say</option></select>' +
    '<div class="subhead">Any of these?</div><div class="opts">' + checks({ "pelvic-floor":"Leaking / heaviness","iron-fatigue":"Tired / breathless","heavy-bleeding":"Very heavy periods","painful-periods":"Painful periods" },"fh") + '</div><div class="result" id="fhRes"></div></div>';
}
function renderResult(elId, urgency, headline, items, disclaimer) {
  const e = $(elId); if (!e) return;
  const UC = { emergency:"var(--rest)", urgent:"var(--eff-hard)", professional:"var(--peak)", monitor:"var(--ready)", none:"var(--ready)" };
  e.classList.add("show");
  e.innerHTML = '<div class="rb" style="--rbc:' + UC[urgency] + '">' + headline + '</div>' + (items.length ? '<div class="ri">' + items.map((it) => '<div class="item"><b>' + it.title + '</b><div class="g">' + it.guidance + '</div>' + referLine(it.refer) + '</div>').join("") + '</div>' : '') + '<div class="disc">' + disclaimer + '</div>';
}
function chkValues(name) { return [].slice.call(document.querySelectorAll('[data-chk="' + name + '"]:checked')).map((x) => x.value); }
function runRf() { const picks = chkValues("rf"); const e = $("rfRes"); if (!picks.length) { e.classList.remove("show"); return; } const r = RC.screenRedFlags(picks); renderResult("rfRes", r.urgency, r.headline, r.flags.map((f) => ({ title: f.label, guidance: f.guidance, refer: f.refer })), r.disclaimer); }
function runReds() { const r = RC.screenRedS(chkValues("reds")); const items = [{ title: r.message, guidance: r.guidance.join(" "), refer: r.refer }]; renderResult("redsRes", r.risk === "low" ? "monitor" : "professional", "Risk: " + r.risk, items, r.disclaimer); }
function runFh() { const status = $("fhStatus").value; const r = RC.assessFemaleHealth({ status, symptoms: chkValues("fh") }); if (!r.prompts.length) { renderResult("fhRes","none","Nothing flagged — keep tracking how you feel.",[],r.disclaimer); return; } renderResult("fhRes", r.urgency, r.urgency === "professional" ? "Worth a conversation" : "A couple of things to watch", r.prompts.map((p) => ({ title: p.topic, guidance: p.message, refer: p.refer })), r.disclaimer); }

// ============ SETUP / PROFILE ==============================================
const DIST_OPTS = [["5k","5 km"],["10k","10 km"],["half","Half marathon"],["marathon","Marathon"]];
const REC_OPTS = [["1609.344","1 mile"],["5000","5 km"],["10000","10 km"],["21097.5","Half marathon"]];
function opt(list, val) { return list.map((o) => '<option value="' + o[0] + '"' + (String(o[0]) === String(val) ? " selected" : "") + '>' + o[1] + '</option>').join(""); }
function ageOpts(sel) { let o = ""; for (let a = 12; a <= 90; a++) o += '<option value="' + a + '"' + (a === Number(sel) ? " selected" : "") + '>' + a + '</option>'; return o; }
function seg(name, opts, val) { return '<div class="seg" data-set="' + name + '">' + opts.map((o) => '<button data-v="' + o[0] + '"' + (String(o[0]) === String(val) ? ' class="on"' : '') + '>' + o[1] + '</button>').join("") + '</div>'; }
// ---- Name & profile picture ----------------------------------------------
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function initials(name) { const parts = (name || "").trim().split(/\\s+/).filter(Boolean); if (!parts.length) return ""; return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase(); }
function avatarInner(p) { if (p.avatar) return '<img src="' + p.avatar + '" alt="">'; const init = initials(p.name); return init || ICON.person; }
// Paint the top-bar profile button from the current profile: photo, else initials, else the person icon.
function renderAvatar() {
  const b = $("profileBtn"); if (!b) return;
  b.innerHTML = profile.avatar ? '<img src="' + profile.avatar + '" alt="Profile">'
    : (initials(profile.name) ? '<span style="font-size:13px;font-weight:700;color:var(--accent)">' + initials(profile.name) + '</span>' : ICON.person);
}
// Downscale a chosen image to a square 256px JPEG data URL (keeps localStorage small) and drop it in.
function processAvatarFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 256, c = document.createElement("canvas"); c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      const url = c.toDataURL("image/jpeg", 0.85);
      draft.avatar = url; profile.avatar = url;
      const pic = $("avatarPic"); if (pic) pic.innerHTML = '<img src="' + url + '" alt="">';
      const btn = $("avatarBtn"); if (btn) btn.textContent = "Change photo";
      renderAvatar();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function viewSetup() {
  const p = profile;
  const savedMsg = state.trialSaved ? '<div class="plan-note" style="border-left-color:var(--accent);margin:2px 2px 12px">✓ 1 km time trial saved: <b>' + state.trialSaved + '</b>. Your VO₂/interval paces are now anchored to it.</div>' : "";
  return savedMsg + '<div class="eyebrow" style="margin:2px 2px 10px">' + (p.name ? p.name + "\\u2019s profile" : (p.personalized ? "Your profile" : "Let\\'s make this yours")) + '</div>' +
    '<div class="card"><div class="subhead" style="margin-top:0">You</div>' +
    '<div class="avatar-row"><div class="avatar-pic" id="avatarPic">' + avatarInner(p) + '</div>' +
    '<div><button class="avatar-cta" id="avatarBtn" type="button">' + (p.avatar ? "Change photo" : "\\uD83D\\uDCF7 Add photo") + '</button><div class="avatar-hint">A profile picture shows in your top-bar icon.</div></div></div>' +
    '<input type="file" id="s_avatar_file" accept="image/*" style="display:none">' +
    '<div class="q" style="margin-top:15px"><label>Your name</label><input class="sel" id="s_name" value="' + (p.name || "").replace(/"/g, "&quot;") + '" placeholder="What should we call you?" autocomplete="name"></div></div>' +
    '<div class="card" style="margin-top:12px"><div class="subhead" style="margin-top:0">Your running</div>' +
    '<div class="q"><label>What\\u2019s your current running status? <span style="color:var(--ink-faint);font-weight:400">this shapes what we ask next</span></label>' + statusCards(p.status || "regular") + '</div>' +
    '<div class="q" id="statusBegNote"' + (isBeginnerStatus(p.status) ? '' : ' style="display:none"') + '><div class="mas-hint"></div></div>' +
    '<div id="statusRunnerBlock"' + (isBeginnerStatus(p.status) ? ' style="display:none"' : '') + '>' +
    '<div class="q"><label>Your 5 km time — a recent result or an estimate?</label>' + seg("fitsrc", [["recent","Recent"],["predicted","Predicted"]], p.fitSrc === "predicted" ? "predicted" : "recent") + '</div>' +
    '<div class="q" id="fitTimeWrap"><label id="fitTimeLbl"><span class="lblmain">' + (p.fitSrc === "predicted" ? "Your predicted 5 km time" : "Your recent 5 km time") + '</span> <span style="color:var(--ink-faint);font-weight:400">just type the numbers</span></label><input class="sel num" id="s_rectime" value="' + (p.noRecent ? "" : fmtTimeFull(p.recentTimeS)) + '" placeholder="e.g. 25:00" inputmode="numeric"></div>' +
    '<div class="q"><label>1 km time-trial <span style="color:var(--ink-faint);font-weight:400">max effort, optional — sharpens your VO₂ paces</span></label><input class="sel num" id="s_1km" value="' + (p.oneKmS ? fmtTimeFull(p.oneKmS) : "") + '" placeholder="e.g. 4:00" inputmode="numeric"><div class="mas-hint" id="masHint"></div><button class="mini-btn" id="s_1km_rec" type="button">⏱ Haven\\'t done one? Record it now</button></div>' +
    '</div></div>' +
    '<div class="card" id="goalCard" style="margin-top:12px">' + goalCardInner(p.status || "regular", { dist: p.goalDist, date: p.raceDate, target: fmtTimeFull(p.targetS) }) + '</div>' +
    '<div class="card" style="margin-top:12px"><div class="subhead" style="margin-top:0">A few details</div>' +
    '<div class="q"><label>How many days a week will you run? <span style="color:var(--ink-faint);font-weight:400">we\\'ll shape the plan around this</span></label>' + seg("days", [["3","3"],["4","4"],["5","5"],["6","6"],["7","7"]], p.daysPerWeek) + '</div>' +
    '<div class="q"><label>Age</label><select class="sel" id="s_age" style="max-width:130px">' + ageOpts(p.age) + '</select></div>' +
    '<div class="q"><label>Sex <span style="color:var(--ink-faint);font-weight:400">helps tailor advice</span></label><select class="sel" id="s_sex"><option value=""' + (!p.sex?" selected":"") + '>Prefer not to say</option><option value="female"' + (p.sex==="female"?" selected":"") + '>Female</option><option value="male"' + (p.sex==="male"?" selected":"") + '>Male</option></select></div>' +
    '<div class="q"><label>Include strength &amp; conditioning?</label>' + seg("strength", [["1","Yes"],["0","No"]], p.strength?"1":"0") + '</div>' +
    '<div class="q"><label>Returning from injury / a break?</label>' + seg("returning", [["0","No"],["1","Yes"]], p.returning?"1":"0") + '</div></div>' +
    '<div class="err" id="setupErr" style="display:none;color:var(--ease);font-size:13px;margin:12px 2px 0"></div>' +
    '<button class="primary" id="saveProfile">' + (p.personalized ? "Update my plan" : "Build my plan") + '</button>' +
    (p.personalized ? '<button class="primary" id="cancelSetup" style="background:var(--surface-2);color:var(--ink-soft)">Cancel</button>' : "");
}
// Draft profile from the setup form's current values (may throw on bad times).
function draftFromForm() {
  const mmss = (s) => /^\\d{1,2}:[0-5]\\d$/.test(s) || /^\\d{1,2}:[0-5]\\d:[0-5]\\d$/.test(s);
  // The running status gates the rest. Beginners (new / building) give no times — we seed a gentle
  // baseline and flag noRecent. Runners (regular / competitive) give a recent or predicted 5 km, and
  // may optionally add a 1 km trial to sharpen their VO₂ paces.
  const status = draft.status || "regular";
  const beginner = isBeginnerStatus(status);
  let fitSrc = "beginner", noRecent = true, recentDistM = 5000, recentTimeS, oneKmS = 0;
  if (beginner) {
    recentTimeS = status === "new" ? 2700 : 2250; // couch-to-5k vs a jogger building consistency
  } else {
    fitSrc = draft.fitsrc || "recent"; noRecent = false;
    const recRaw = $("s_rectime").value.trim();
    if (!mmss(recRaw)) throw new Error(fitSrc === "predicted" ? "Enter your predicted 5 km time as m:ss, e.g. 28:00." : "Enter your recent 5 km time as m:ss, e.g. 25:00.");
    recentTimeS = RC.parseDuration(recRaw);
    const pace = recentTimeS / 5; // seconds per km over 5 km
    if (pace < 120 || pace > 720) throw new Error("That 5 km time looks off — please check it (m:ss).");
    const oneKmRaw = ($("s_1km") ? $("s_1km").value : "").trim();
    if (oneKmRaw) {
      if (!mmss(oneKmRaw)) throw new Error("Enter your 1 km time as minutes:seconds, e.g. 4:00.");
      const s = RC.parseDuration(oneKmRaw);
      if (s >= 150 && s <= 480) oneKmS = s;
    }
  }
  // Goal adapts to the status: runners set a target time; beginners work towards *completing* the
  // distance, so we derive a realistic finish time from their current ability (no time to enter).
  const goalCfg = GOAL_BY_STATUS[status] || GOAL_BY_STATUS.regular;
  const goalDist = $("s_dist") ? $("s_dist").value : profile.goalDist;
  let targetS;
  if (goalCfg.time) {
    const targetRaw = $("s_target").value.trim();
    if (!mmss(targetRaw)) throw new Error("Enter your target time as h:mm:ss or m:ss, e.g. 1:45:00.");
    targetS = RC.parseDuration(targetRaw);
  } else {
    targetS = Math.round(RC.riegelPredict(5000, recentTimeS, DIST_M[goalDist] || 5000));
  }
  const raceDate = $("s_date").value;
  if (!raceDate) throw new Error("Pick your " + (goalCfg.time ? "race" : "target") + " date.");
  if (raceDate <= todayIso()) throw new Error("Your " + (goalCfg.time ? "race" : "target") + " date needs to be in the future.");
  return {
    name: ($("s_name") ? $("s_name").value : "").trim().slice(0, 40),
    avatar: draft.avatar != null ? draft.avatar : (profile.avatar || ""),
    status,
    goalDist, targetS, raceDate,
    fitSrc, recentDistM, recentTimeS, noRecent, oneKmS, daysPerWeek: Number(draft.days), yearsRunning: profile.yearsRunning || 3,
    weeklyVolumeKm: profile.weeklyVolumeKm, age: Number($("s_age").value) || 35, sex: $("s_sex").value,
    strength: draft.strength === "1", returning: draft.returning === "1", personalized: true,
  };
}
let draft = {};
function refreshMasHint() {
  const el = $("masHint"); if (!el) return;
  const raw = ($("s_1km").value || "").trim();
  if (!/^\\d{1,2}:[0-5]\\d$/.test(raw)) { el.textContent = ""; return; }
  const s = RC.parseDuration(raw);
  if (s < 150 || s > 480) { el.textContent = ""; return; }
  const m = RC.computeMas(s);
  el.innerHTML = "MAS <b>" + m.masMps.toFixed(2) + " m/s</b> · " + fmtPace(m.masPaceSecPerKm) + "/km — sets your VO₂ paces.";
}

// ---- 1 km time-trial session ---------------------------------------------
// Recording a 1 km trial isn't a bare stopwatch — it's a proper session on Today: a guided warm-up,
// then the timed 1 km. Only the 1 km itself is measured, and on completion its time flows back to the
// About-you 1 km field (and re-anchors the plan's paces). In the live app GPS auto-stops at 1 km;
// here the runner taps Finish.
function fmtClock(ms) { const t = ms / 1000; const m = Math.floor(t / 60); const s = Math.floor(t % 60); const d = Math.floor((t * 10) % 10); return m + ":" + String(s).padStart(2, "0") + "." + d; }
const TRIAL_PARTS = [
  ["easy", "Warm-up", "~10 min easy jog + 3 × 20s strides to open the legs"],
  ["hard", "1 km time trial", "Max effort — hold the fastest pace you can for the full 1 km"],
  ["easy", "Cool-down", "5–10 min easy jog to recover"],
];
// Send the runner from the setup form into a trial session that's been added to Today.
function startTrialFlow() { state.trialPending = true; state.screen = null; state.tab = "today"; render(); }
function trialTodayCard() {
  const rows = TRIAL_PARTS.map((p) => '<div class="sess"><span class="dot ' + p[0] + '"></span><div><div class="st">' + p[1] + '</div><div class="sm" style="color:var(--ink-soft)">' + p[2] + '</div></div></div>').join("");
  return '<div class="wk-card" style="--c:var(--eff-hard)"><div class="b"><div class="t">1 km time trial</div><div class="sub">Added to today · warm-up included</div><div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">' + rows + '</div></div></div>';
}
let TRIALRUN = null;
function beginTrialRun() { TRIALRUN = { phase: "warmup", wStart: performance.now(), start: 0, secs: 0, raf: null }; state.screen = "trialrun"; render(); }
function stopTrialRun() { if (TRIALRUN && TRIALRUN.raf) { cancelAnimationFrame(TRIALRUN.raf); TRIALRUN.raf = null; } }
function trialRunTick() {
  const cl = $("twClock"); if (!TRIALRUN || !cl) return;
  if (TRIALRUN.phase === "warmup") cl.textContent = fmtPace((performance.now() - TRIALRUN.wStart) / 1000);
  else if (TRIALRUN.phase === "run") cl.textContent = fmtClock(performance.now() - TRIALRUN.start);
  else return;
  TRIALRUN.raf = requestAnimationFrame(trialRunTick);
}
function viewTrialRun() {
  const p = TRIALRUN.phase;
  const back = '<button class="backbtn" id="trBack">‹ Today</button>';
  if (p === "warmup") {
    return back +
      '<div class="card live-hero"><div class="eyebrow">1 km time trial · step 1 of 2</div><div class="live-title">Warm up first</div>' +
      '<div class="live-metrics" style="grid-template-columns:1fr"><div><div class="lk">Warm-up time</div><div class="lv num" id="twClock">0:00</div></div></div></div>' +
      '<div class="card"><div class="subhead" style="margin-top:0">Do this before the effort</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">' +
      '<div class="sess"><span class="dot easy"></span><div><div class="st">Easy jog ~10 min</div><div class="sm" style="color:var(--ink-soft)">Raise your heart rate gradually — conversational pace.</div></div></div>' +
      '<div class="sess"><span class="dot moderate"></span><div><div class="st">3 × 20s strides</div><div class="sm" style="color:var(--ink-soft)">Build to fast and smooth, full recovery between each.</div></div></div>' +
      '<div class="sess"><span class="dot hard"></span><div><div class="st">Catch your breath</div><div class="sm" style="color:var(--ink-soft)">Then start the 1 km when you feel ready.</div></div></div></div></div>' +
      '<div class="trial-controls"><button class="primary" id="twGo">' + ICON.play + ' Start the 1 km</button></div>' +
      '<div class="trial-foot" style="border:0;text-align:center">Only the 1 km itself is timed and saved to your profile.</div>';
  }
  if (p === "run") {
    return back +
      '<div class="card live-hero" style="border-color:var(--peak)"><div class="eyebrow" style="color:var(--peak)">1 km time trial · max effort</div>' +
      '<div class="trial-clock num" id="twClock" style="margin:14px 0 6px">0:00.0</div>' +
      '<div style="color:var(--ink-soft);font-size:13.5px">Run 1 km as hard as you can hold. Tap <b>Finish</b> the instant you complete it.</div></div>' +
      '<div class="trial-controls"><button class="primary" id="twFinish" style="background:var(--peak)">Finish — 1 km done</button></div>' +
      '<div class="trial-foot" style="border:0;text-align:center">On a phone with GPS the full app stops automatically at 1 km.</div>';
  }
  const secs = TRIALRUN.secs, inRange = secs >= 150 && secs <= 480;
  const mas = inRange ? RC.computeMas(secs) : null;
  return back +
    '<div class="card live-hero"><div class="eyebrow">1 km time trial · done</div>' +
    '<div class="trial-clock num" style="margin:14px 0 8px">' + fmtTimeFull(secs) + '</div>' +
    (inRange
      ? '<div style="color:var(--ink-soft);font-size:13.5px">MAS <b>' + mas.masMps.toFixed(2) + ' m/s</b> · ' + fmtPace(mas.masPaceSecPerKm) + '/km. Saving this sets your VO₂/interval paces.</div>'
      : '<div style="color:var(--ease);font-size:13.5px">' + (secs < 150 ? "That's under 2:30 — too fast for a full 1 km. Give it another go." : "That's over 8:00 — for MAS we need a hard 1 km effort. Have a rest and try again.") + '</div>') +
    '</div>' +
    (inRange
      ? '<div class="trial-controls two"><button class="ctrl" id="twRedo">Redo</button><button class="primary" id="twSave">Save to my profile</button></div>'
      : '<div class="trial-controls"><button class="primary" id="twRedo">Try again</button></div>');
}
function wireTrialRun() {
  const back = $("trBack"); if (back) back.onclick = () => { stopTrialRun(); TRIALRUN = null; state.screen = null; state.tab = "today"; render(); };
  if (TRIALRUN.phase === "warmup") {
    TRIALRUN.raf = requestAnimationFrame(trialRunTick);
    const go = $("twGo"); if (go) go.onclick = () => { stopTrialRun(); TRIALRUN.phase = "run"; TRIALRUN.start = performance.now(); render(); };
  } else if (TRIALRUN.phase === "run") {
    TRIALRUN.raf = requestAnimationFrame(trialRunTick);
    const fin = $("twFinish"); if (fin) fin.onclick = () => { stopTrialRun(); TRIALRUN.secs = Math.round((performance.now() - TRIALRUN.start) / 1000); TRIALRUN.phase = "done"; render(); };
  } else {
    const redo = $("twRedo"); if (redo) redo.onclick = () => { TRIALRUN.phase = "warmup"; TRIALRUN.wStart = performance.now(); render(); };
    const save = $("twSave"); if (save) save.onclick = trialSaveResult;
  }
}
// Write just the 1 km time back to the profile's About-you field, re-anchor the plan, and land the
// runner on About you so they see it recorded.
function trialSaveResult() {
  profile.oneKmS = TRIALRUN.secs;
  profile.personalized = true;
  try { const out = applyProfile(profile); PLAN = out.plan; RAW = out.raw; FITNESS = out.fitness; CLASS = out.classification; MASTERS = out.masters; state.planWeek = PLAN.defaultWeekIndex; } catch (e) {}
  saveProfileStore();
  state.trialSaved = fmtTimeFull(TRIALRUN.secs);
  state.trialPending = false; TRIALRUN = null;
  state.screen = "setup"; render();
}
// The gating first question: current running status decides which fields we ask for.
const STATUS_OPTS = [
  ["new", "Just getting started", "New to running, or coming back after a long break. We\\'ll build with walk\\u2013run."],
  ["building", "Building the habit", "I can jog 20\\u201330 minutes non-stop. Focused on being consistent."],
  ["regular", "Regular runner", "I run 3\\u20135\\u00d7 a week and can finish a 10K or half comfortably."],
  ["competitive", "Competitive", "High weekly mileage \\u2014 I race and chase time goals."],
];
function isBeginnerStatus(st) { return st === "new" || st === "building"; }
// The goal question adapts to the status: beginners work towards *completing* a shorter distance (no
// time pressure — we derive a realistic finish target); runners set a time goal over any distance.
const DIST_M = { "5k": 5000, "10k": 10000, half: 21097.5, marathon: 42195 };
const RACE_LABEL = { "5k": "5 km", "10k": "10 km", half: "Half marathon", marathon: "Marathon" };
const FINISH_LABEL = { "5k": "Run a 5K non-stop", "10k": "Complete a 10K", half: "Complete a half marathon", marathon: "Complete a marathon" };
const GOAL_BY_STATUS = {
  new: { dists: ["5k", "10k"], time: false, q: "What are you working towards?" },
  building: { dists: ["5k", "10k", "half"], time: false, q: "What are you working towards?" },
  regular: { dists: ["5k", "10k", "half", "marathon"], time: true, q: "Your race" },
  competitive: { dists: ["5k", "10k", "half", "marathon"], time: true, q: "Your race" },
};
function goalCardInner(status, cur) {
  const cfg = GOAL_BY_STATUS[status] || GOAL_BY_STATUS.regular;
  let dist = cur.dist; if (cfg.dists.indexOf(dist) < 0) dist = cfg.dists[0];
  const opts = cfg.dists.map((k) => '<option value="' + k + '"' + (k === dist ? " selected" : "") + '>' + (cfg.time ? RACE_LABEL[k] : FINISH_LABEL[k]) + '</option>').join("");
  let h = '<div class="subhead" style="margin-top:0">Your goal</div>' +
    '<div class="q"><label>' + cfg.q + '</label><select class="sel" id="s_dist">' + opts + '</select></div>';
  if (cfg.time) {
    h += '<div class="q"><label>Target time <span style="color:var(--ink-faint);font-weight:400">just type the numbers</span></label><input class="sel num" id="s_target" value="' + cur.target + '" inputmode="numeric"></div>';
  } else {
    h += '<div class="q"><div class="mas-hint">No time pressure \\u2014 we\\u2019ll build you up to comfortably finish it. You can set a time goal once you\\u2019re there.</div></div>';
  }
  h += '<div class="q"><label>' + (cfg.time ? "Race date" : "Target date") + '</label><input class="sel num" id="s_date" type="date" value="' + cur.date + '"></div>';
  return h;
}
function statusCards(sel) {
  return '<div class="statuscards" data-set="status">' + STATUS_OPTS.map((o) =>
    '<button type="button" data-v="' + o[0] + '" class="statuscard' + (o[0] === sel ? " on" : "") + '"><div class="sc-t">' + o[1] + '</div><div class="sc-d">' + o[2] + '</div></button>').join("") + '</div>';
}
// Show the runner-only block (5 km time + 1 km trial) for runners; a reassuring note for beginners.
function syncStatus() {
  const st = draft.status || "regular";
  const beginner = isBeginnerStatus(st);
  const rb = $("statusRunnerBlock"), bn = $("statusBegNote");
  if (rb) rb.style.display = beginner ? "none" : "";
  if (bn) {
    bn.style.display = beginner ? "" : "none";
    const note = bn.querySelector(".mas-hint");
    if (note) note.textContent = st === "new"
      ? "Perfect — we\\u2019ll start with walk\\u2013run intervals and build your base gently. No times to enter."
      : "Great — we\\u2019ll grow your consistency and learn your paces as you run. No times to enter.";
  }
  if (!beginner) syncFitSrc();
  // Rebuild the goal card so its distance options and time field match the status.
  const gc = $("goalCard");
  if (gc) {
    const cur = {
      dist: $("s_dist") ? $("s_dist").value : profile.goalDist,
      date: $("s_date") ? $("s_date").value : profile.raceDate,
      target: $("s_target") ? $("s_target").value : fmtTimeFull(profile.targetS),
    };
    gc.innerHTML = goalCardInner(st, cur);
    bindTimeInput($("s_target"));
  }
}
// Show/hide the 5 km time field to match the chosen fitness source, and relabel recent vs predicted.
function syncFitSrc() {
  const v = draft.fitsrc || "recent";
  const wrap = $("fitTimeWrap"), main = document.querySelector("#fitTimeLbl .lblmain");
  if (wrap) wrap.style.display = "";
  if (main) main.textContent = v === "predicted" ? "Your predicted 5 km time" : "Your recent 5 km time";
}
function refreshTypePreview() {
  try {
    const cls = RC.classifyRunner({ runsPerWeek: Number(draft.days), yearsRunning: profile.yearsRunning || 3, sex: $("s_sex") ? ($("s_sex").value || undefined) : undefined });
    const m = RC.assessMasters({ age: Number(($("s_age") || {}).value) || 35, sex: $("s_sex") ? ($("s_sex").value || undefined) : undefined });
    const tp = $("typePreview"); if (!tp) return;
    tp.innerHTML = '<div class="eyebrow" style="margin:0 0 4px">Your runner type</div><div style="font-size:17px;font-weight:700;letter-spacing:-.01em">' + cls.label + '</div><div style="font-size:12.5px;color:var(--ink-soft);margin-top:4px">' + cls.meaning + '</div>' + (m.isMasters ? '<div style="font-size:12.5px;color:var(--ink-faint);margin-top:8px;border-top:1px solid var(--line);padding-top:8px">' + m.headline + '</div>' : '');
  } catch (e) {}
}

// ============ LIVE SESSION (in-app) ========================================
const KIND_COLOR = { warmup: "var(--base)", cooldown: "var(--base)", steady: "var(--base)", recovery: "var(--taper)", rep: "var(--peak)" };
let LIVE = null;
const GPS_AVAILABLE = typeof navigator !== "undefined" && "geolocation" in navigator;
const VOICE_AVAILABLE = typeof window !== "undefined" && "speechSynthesis" in window;
let VOICE_ON = (() => { try { return localStorage.getItem("interun_voice") !== "0"; } catch (e) { return true; } })();
// Speak a phrase aloud during a run. Best-effort: unsupported browsers / muted state are no-ops.
function speak(text) {
  if (!VOICE_ON || !VOICE_AVAILABLE || !text) return;
  try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.03; u.pitch = 1; u.lang = "en-GB"; u.volume = 1; window.speechSynthesis.speak(u); } catch (e) {}
}
function stopSpeech() { try { if (VOICE_AVAILABLE) window.speechSynthesis.cancel(); } catch (e) {} }
// Natural spoken form of a duration, e.g. 330 -> "5 minutes 30 seconds".
function spokenDuration(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  const mm = m > 0 ? m + " minute" + (m === 1 ? "" : "s") : "";
  const ss = s > 0 ? s + " second" + (s === 1 ? "" : "s") : "";
  return (mm + (mm && ss ? " " : "") + ss) || "0 seconds";
}
// The phrase to announce for a coaching cue — curated per kind so the numbers read cleanly aloud.
function cueSpeech(cue) {
  if (cue.kind === "step-start") return cue.message.split(" — ")[0].split("(").join("").split(")").join("").split("/").join(" of ") + ".";
  if (cue.kind === "pace") return cue.message.split(" — ").join(", ").split("—").join(", ").split("/km").join(" per kilometre");
  if (cue.kind === "paused") return "Paused.";
  if (cue.kind === "resumed") return "Resumed.";
  if (cue.kind === "session-complete") return "Session complete. Great work.";
  return null; // session-start is spoken on the Start gesture (below) to unlock speech on iOS
}
function startSession() {
  const s = rawToday();
  LIVE = { session: s, rt: new RC.LiveSession(s), mode: null, acquiring: false, gpsErr: null,
    startMs: 0, pausedMs: 0, pauseStart: 0, vms: 0, dist: 0, hr: 105, paceHint: null,
    timer: null, ui: null, watchId: null, wakeLock: null, lastLat: null, lastLon: null, acc: null,
    speed: 20, lastStep: -1, quirk: 0, done: false, kmDone: 0, lastKmMs: 0 };
  state.screen = "live"; render();
}
// Announce a fresh whole-kilometre split (spoken + logged) as the runner crosses it.
function checkSplits() {
  if (!LIVE || LIVE.mode == null) return;
  const km = Math.floor(LIVE.dist / 1000);
  if (km <= LIVE.kmDone) return;
  LIVE.kmDone = km;
  const now = liveNowMs();
  const splitSec = (now - LIVE.lastKmMs) / 1000;
  LIVE.lastKmMs = now;
  speak("Kilometre " + km + ". " + spokenDuration(splitSec) + " for that split.");
  liveCue({ kind: "split", atMs: now, message: km + " km · " + fmtPace(splitSec) + " /km split" });
}
// Great-circle distance between two lat/lon points, in metres.
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
// Real elapsed session time (ms), excluding any paused stretches.
function liveElapsedMs() {
  const base = Date.now() - LIVE.startMs - LIVE.pausedMs;
  return LIVE.pauseStart ? base - (Date.now() - LIVE.pauseStart) : base;
}
// The runtime clock: virtual for the simulator, wall-clock for a real GPS run.
function liveNowMs() { return LIVE.mode === "sim" ? LIVE.vms : liveElapsedMs(); }
// Keep the screen awake during a run where the platform supports it.
function requestWakeLock() {
  try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then((w) => { if (LIVE) LIVE.wakeLock = w; }).catch(() => {}); } catch (e) {}
}
function releaseWakeLock() { try { if (LIVE && LIVE.wakeLock) { LIVE.wakeLock.release(); LIVE.wakeLock = null; } } catch (e) {} }
// Begin a session: try real GPS first, fall back to the simulator when geolocation is
// unavailable or denied (e.g. inside the Claude artifact sandbox), so the demo always works.
function beginLive() {
  const st = $("lStart"); if (st) st.style.display = "none";
  const pa = $("lPause"); if (pa) pa.disabled = false;
  const fi = $("lFinish"); if (fi) fi.disabled = false;
  // Speak inside the tap gesture — announces the start and unlocks TTS on iOS for later cues.
  speak("Let's go. " + LIVE.session.title.split("·")[0] + ".");
  if (GPS_AVAILABLE) {
    LIVE.acquiring = true; renderLiveNow();
    navigator.geolocation.getCurrentPosition(
      (pos) => startGps(pos),
      (err) => { LIVE.gpsErr = err && err.message; startSim(); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  } else { startSim(); }
}
function startGps(pos) {
  if (!LIVE || LIVE.done) return;
  LIVE.acquiring = false; LIVE.mode = "gps"; LIVE.startMs = Date.now();
  LIVE.lastLat = pos.coords.latitude; LIVE.lastLon = pos.coords.longitude; LIVE.acc = pos.coords.accuracy;
  requestWakeLock();
  LIVE.rt.start(0).forEach(liveCue);
  LIVE.watchId = navigator.geolocation.watchPosition(onGpsPos, () => {}, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  if (!LIVE.ui) LIVE.ui = setInterval(gpsUiTick, 250);
  renderLiveNow();
}
function startSim() {
  if (!LIVE || LIVE.done) return;
  LIVE.acquiring = false; LIVE.mode = "sim";
  LIVE.rt.start(LIVE.vms).forEach(liveCue);
  startLoop();
  renderLiveNow();
}
// A new GPS fix: accumulate real distance (accuracy-gated, with a jitter/teleport filter) and
// capture the device's own speed as a pace hint. Time and cue advancement happen in gpsUiTick.
function onGpsPos(pos) {
  if (!LIVE || LIVE.mode !== "gps") return;
  const c = pos.coords; LIVE.acc = c.accuracy;
  const good = c.accuracy == null || c.accuracy <= 40;
  if (good && LIVE.rt.getStatus() === "active" && LIVE.lastLat != null) {
    const d = haversine(LIVE.lastLat, LIVE.lastLon, c.latitude, c.longitude);
    if (d > 1 && d < 80) LIVE.dist += d;
  }
  if (good) { LIVE.lastLat = c.latitude; LIVE.lastLon = c.longitude; }
  LIVE.paceHint = (c.speed != null && c.speed > 0.35) ? 1000 / c.speed : null;
}
function gpsUiTick() {
  if (!LIVE || LIVE.mode !== "gps") return;
  if (LIVE.rt.getStatus() === "active") {
    const t = { atMs: liveElapsedMs(), distanceMeters: LIVE.dist };
    if (LIVE.paceHint) t.paceSecPerKm = LIVE.paceHint;
    LIVE.rt.update(t).forEach(liveCue);
    checkSplits();
  }
  renderLiveNow();
  if (LIVE.rt.getStatus() === "completed") { stopLive(); liveFinish(true); }
}
function gpsStatusText() {
  if (LIVE.acquiring) return "Acquiring GPS…";
  if (LIVE.mode === "sim") return LIVE.gpsErr ? "Simulated (no GPS)" : "Simulated";
  if (LIVE.mode === "gps") return LIVE.acc != null ? "GPS · ±" + Math.round(LIVE.acc) + " m" : "GPS";
  return "Ready";
}
function renderLiveNow() {
  if (!LIVE) return;
  liveUpdate(LIVE.rt.snapshot(liveNowMs()));
  const badge = $("gpsBadge"); if (badge) badge.textContent = gpsStatusText();
}
function viewLive() {
  const s = LIVE.session;
  return '<button class="backbtn" id="liveBack">‹ Today</button>' +
    '<div class="card live-hero"><div class="live-hero-top"><div class="eyebrow">Live session · <span id="gpsBadge">' + gpsStatusText() + '</span></div>' +
    (VOICE_AVAILABLE ? '<button class="voice-btn' + (VOICE_ON ? ' on' : '') + '" id="lVoice" aria-label="Toggle voice coaching">' + (VOICE_ON ? ICON.vox : ICON.voxOff) + '</button>' : '') +
    '</div><div class="live-title">' + s.title + '</div>' +
    '<div class="live-metrics"><div><div class="lk">Elapsed</div><div class="lv num" id="lElapsed">0:00</div></div>' +
    '<div><div class="lk">Distance</div><div class="lv num" id="lDist">0.00<small> km</small></div></div></div>' +
    '<div class="live-paces">' +
    '<div><div class="lk">Current</div><div class="lv num none" id="lPace">—</div></div>' +
    '<div><div class="lk">Average</div><div class="lv num" id="lAvg">—</div></div>' +
    '<div><div class="lk">Lap</div><div class="lv num" id="lLap">—</div></div></div></div>' +
    '<div class="card lstep" id="lStepCard"><div class="cnt">Press start when you\\'re ready.</div></div>' +
    '<div class="live-controls"><button class="primary" id="lStart">' + ICON.play + ' Start</button><button class="ctrl" id="lPause" disabled>Pause</button><button class="ctrl" id="lFinish" disabled>Finish</button></div>' +
    '<div class="card"><div class="subhead" style="margin-top:0">Coaching cues</div><div class="cuelog" id="lCues"><div style="color:var(--ink-faint);font-size:13px">Cues will appear as you run.</div></div></div>';
}
function livePace(step) { const band = step && step.targetPace; const mid = band ? (band.minSecPerKm + band.maxSecPerKm) / 2 : 360; LIVE.quirk += (Math.random() - 0.5) * 0.03; LIVE.quirk *= 0.9; if (Math.random() < 0.04) LIVE.quirk += (Math.random() - 0.5) * 0.28; return Math.max(120, mid * (1 + LIVE.quirk)); }
function liveHr(step) { if (!step) return 105; if (step.kind === "rep") return 176; if (step.kind === "warmup" || step.kind === "cooldown") return 130; if (step.kind === "recovery") return 148; return 150; }
function liveCue(cue) {
  speak(cueSpeech(cue));
  const log = $("lCues"); if (!log) return; const empty = log.firstChild; if (empty && empty.style) empty.remove();
  const cls = cue.kind === "pace" ? "pace-" + cue.paceStatus : cue.kind === "step-start" ? "step" : cue.kind === "session-start" ? "start" : cue.kind === "session-complete" ? "done" : cue.kind === "split" ? "split" : "";
  const e = el('<div class="cue ' + cls + '"><span class="badge"></span><span class="ct">' + fmtPace(cue.atMs / 1000) + '</span><span>' + cue.message + '</span></div>');
  log.insertBefore(e, log.firstChild);
}
function liveUpdate(snap) {
  $("lElapsed").textContent = fmtPace(snap.elapsedSeconds);
  $("lDist").innerHTML = (snap.distanceMeters / 1000).toFixed(2) + '<small> km</small>';
  const paceHtml = (p) => p ? fmtPace(p) + '<small> /km</small>' : "—";
  const pv = $("lPace"); pv.innerHTML = paceHtml(snap.currentPaceSecPerKm); pv.className = "lv num " + (snap.paceStatus || "none");
  const av = $("lAvg"); if (av) av.innerHTML = paceHtml(snap.averagePaceSecPerKm);
  const lp = $("lLap"); if (lp) lp.innerHTML = paceHtml(snap.lapPaceSecPerKm);
  const step = snap.step, card = $("lStepCard");
  if (step) {
    const c = KIND_COLOR[step.kind] || "var(--base)";
    const tgt = [];
    if (step.gate === "distance" && step.targetMeters) tgt.push(Math.round(step.targetMeters) + " m");
    else if (step.targetSeconds) tgt.push(fmtPace(step.targetSeconds));
    if (step.targetPace) tgt.push("target " + fmtPace(step.targetPace.minSecPerKm) + "–" + fmtPace(step.targetPace.maxSecPerKm));
    card.innerHTML = '<span class="kt" style="--kc:' + c + '">' + step.kind + (step.repeatIndex ? ' ' + step.repeatIndex + '/' + step.repeatCount : '') + '</span><h4>' + step.label + '</h4><div class="tgt">' + tgt.join(" · ") + '</div><div class="lpbar" style="--kc:' + c + '"><i style="width:' + Math.round(snap.stepProgress * 100) + '%"></i></div><div class="cnt">Step ' + (step.index + 1) + ' of ' + step.total + '</div>';
  } else if (snap.status === "completed") {
    card.innerHTML = '<span class="kt" style="--kc:var(--build)">done</span><h4>Session complete</h4><div class="tgt">Nice work.</div>';
  }
}
function liveTick() {
  const dt = 0.2 * LIVE.speed; LIVE.vms += dt * 1000;
  const pre = LIVE.rt.snapshot(LIVE.vms);
  if (pre.step && pre.step.index !== LIVE.lastStep) { LIVE.quirk = 0; LIVE.lastStep = pre.step.index; }
  const pace = livePace(pre.step); LIVE.dist += (1000 / pace) * dt;
  LIVE.hr += (liveHr(pre.step) - LIVE.hr) * 0.05 + (Math.random() - 0.5) * 1.5; LIVE.hr = Math.max(95, Math.min(190, LIVE.hr));
  LIVE.rt.update({ atMs: LIVE.vms, distanceMeters: LIVE.dist, heartRateBpm: Math.round(LIVE.hr) }).forEach(liveCue);
  checkSplits();
  liveUpdate(LIVE.rt.snapshot(LIVE.vms));
  if (LIVE.rt.getStatus() === "completed") { stopLive(); liveFinish(true); }
}
function startLoop() { if (!LIVE.timer) LIVE.timer = setInterval(liveTick, 200); }
function stopLive() {
  if (!LIVE) return;
  if (LIVE.timer) { clearInterval(LIVE.timer); LIVE.timer = null; }
  if (LIVE.ui) { clearInterval(LIVE.ui); LIVE.ui = null; }
  if (LIVE.watchId != null && GPS_AVAILABLE) { navigator.geolocation.clearWatch(LIVE.watchId); LIVE.watchId = null; }
  releaseWakeLock();
}
function liveFinish(complete) {
  if (LIVE.done) return; LIVE.done = true; stopLive();
  const now = liveNowMs();
  if (!complete) LIVE.rt.stop(now).forEach(liveCue);
  const snap = LIVE.rt.snapshot(now);
  const km = snap.distanceMeters / 1000;
  if (km > 0.05) { state.logged.unshift({ t: LIVE.session.title, d: "Today", dist: km.toFixed(2) + " km", time: fmtPace(snap.elapsedSeconds), pace: (snap.averagePaceSecPerKm ? fmtPace(snap.averagePaceSecPerKm) : "—") + " /km" }); saveRuns(); }
  // Reflect the completed session in the training calendar.
  const wk0 = PLAN.weeks[0]; const dn = DAY_ORDER[LIVE.session.dayOfWeek];
  if (complete && wk0) { const m = wk0.sessions.find((s) => s.day === dn && s.title === LIVE.session.title); if (m) state.done[doneKey(wk0.index, m)] = true; }
  const st = $("lStart"), pa = $("lPause"), fi = $("lFinish");
  if (st) { st.style.display = "none"; }
  if (pa) pa.disabled = true;
  if (fi) { fi.textContent = "Done"; fi.disabled = false; fi.onclick = () => { state.screen = null; state.tab = "activities"; state.actTab = "workouts"; render(); }; }
}

// ---- Router ---------------------------------------------------------------
const TITLES = { today: "Today", plan: "Your Plan", activities: "Activities", community: "Community", support: "Support" };
function render() {
  const v = $("view");
  if (state.screen === "setup") {
    $("topTitle").textContent = "Your profile";
    draft = { days: profile.daysPerWeek, strength: profile.strength ? "1" : "0", returning: profile.returning ? "1" : "0", status: profile.status || (profile.noRecent ? "new" : "regular"), fitsrc: (profile.fitSrc === "predicted" ? "predicted" : "recent"), avatar: profile.avatar || "" };
    v.innerHTML = viewSetup();
    v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    refreshTypePreview();
    state.trialSaved = null;
    return;
  }
  if (state.screen === "live") {
    $("topTitle").textContent = "Session";
    v.innerHTML = viewLive(); v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    return;
  }
  if (state.screen === "trialrun") {
    $("topTitle").textContent = "1 km time trial";
    v.innerHTML = viewTrialRun(); v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wireTrialRun();
    return;
  }
  if (state.screen === "calendar") {
    $("topTitle").textContent = "Training calendar";
    v.innerHTML = viewCalendar(); v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    return;
  }
  $("topTitle").textContent = state.support ? "Support" : TITLES[state.tab];
  if (state.tab === "today") { fetchWeather(); v.innerHTML = viewToday(); }
  else if (state.tab === "plan") v.innerHTML = viewPlan();
  else if (state.tab === "activities") v.innerHTML = viewActivities();
  else if (state.tab === "community") v.innerHTML = viewCommunity();
  else if (state.tab === "support") v.innerHTML = viewSupport();
  v.scrollTop = 0;
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
  wire();
}
function wire() {
  document.querySelectorAll("[data-seg]").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.onclick = () => {
    const f = seg.dataset.seg; const v = b.dataset.v;
    if (f === "dayType") { state.dayType = v; render(); return; }
    state.subj[f] = v; seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); $("readySlot").innerHTML = renderReadiness();
  }));
  document.querySelectorAll("[data-wk]").forEach((b) => b.onclick = () => { state.planWeek = Number(b.dataset.wk); document.querySelectorAll("[data-wk]").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("weekDetail").innerHTML = weekDetail(); wireSessionTaps(); });
  document.querySelectorAll("[data-at]").forEach((b) => b.onclick = () => { state.actTab = b.dataset.at; render(); });
  document.querySelectorAll("[data-hub]").forEach((b) => b.onclick = () => { state.support = b.dataset.hub; render(); });
  const back = $("supBack"); if (back) back.onclick = () => { state.support = null; render(); };
  document.querySelectorAll('[data-chk="rf"]').forEach((c) => c.onchange = runRf);
  document.querySelectorAll('[data-chk="reds"]').forEach((c) => c.onchange = runReds);
  document.querySelectorAll('[data-chk="fh"]').forEach((c) => c.onchange = runFh);
  const fh = $("fhStatus"); if (fh) fh.onchange = runFh;
  if ($("redsRes")) runReds();
  // Setup screen wiring
  document.querySelectorAll("[data-set]").forEach((s) => s.querySelectorAll("button").forEach((b) => b.onclick = () => {
    draft[s.dataset.set] = b.dataset.v; s.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    if (s.dataset.set === "status") syncStatus();
    if (s.dataset.set === "fitsrc") syncFitSrc();
    refreshTypePreview();
  }));
  ["s_age","s_sex"].forEach((id) => { const e = $(id); if (e) e.oninput = e.onchange = refreshTypePreview; });
  bindTimeInput($("s_target")); bindTimeInput($("s_rectime"));
  const km1 = $("s_1km");
  if (km1) { bindTimeInput(km1); km1.addEventListener("input", refreshMasHint); refreshMasHint(); }
  const km1rec = $("s_1km_rec"); if (km1rec) km1rec.onclick = startTrialFlow;
  if (document.querySelector('[data-set="status"]')) syncStatus();
  // Avatar upload
  const avatarFile = $("s_avatar_file");
  const avatarBtn = $("avatarBtn"); if (avatarBtn && avatarFile) avatarBtn.onclick = () => avatarFile.click();
  const avatarPic = $("avatarPic"); if (avatarPic && avatarFile) avatarPic.onclick = () => avatarFile.click();
  if (avatarFile) avatarFile.onchange = () => processAvatarFile(avatarFile.files && avatarFile.files[0]);
  const setupBanner = $("setupBanner"); if (setupBanner) setupBanner.onclick = () => { state.screen = "setup"; render(); };
  const wxSeg = document.querySelector("[data-weatherseg]"); if (wxSeg) wxSeg.querySelectorAll("button").forEach((b) => b.onclick = () => { state.weather = b.dataset.weather; render(); });
  const save = $("saveProfile"); if (save) save.onclick = () => {
    let pf; try { pf = draftFromForm(); } catch (e) { const er = $("setupErr"); er.style.display = "block"; er.textContent = e.message; return; }
    let out; try { out = applyProfile(pf); } catch (e) { const er = $("setupErr"); er.style.display = "block"; er.textContent = "That goal can't be planned yet — try a race date further out."; return; }
    profile = pf; PLAN = out.plan; RAW = out.raw; FITNESS = out.fitness; CLASS = out.classification; MASTERS = out.masters; state.planWeek = PLAN.defaultWeekIndex; seedDone(); saveProfileStore(); renderAvatar();
    state.screen = null; state.tab = "plan"; render();
  };
  const cancel = $("cancelSetup"); if (cancel) cancel.onclick = () => { state.screen = null; state.tab = "today"; render(); };
  // Session detail taps (Plan, calendar, Today)
  wireSessionTaps();
  // Today: clickable dates, conditions & feel squares, view-session
  document.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => { state.selDay = Number(b.dataset.day); render(); });
  const condSq = $("condSq"); if (condSq) condSq.onclick = openWeatherSheet;
  const feelSq = $("feelSq"); if (feelSq) feelSq.onclick = openFeelSheet;
  const viewSession = $("viewSession"); if (viewSession) viewSession.onclick = () => openSessionSheet(selectedSession(), 1);
  // Training-calendar wiring
  const calBack = $("calBack"); if (calBack) calBack.onclick = () => { state.screen = null; render(); };
  document.querySelectorAll("[data-done]").forEach((b) => b.onclick = () => { const k = b.dataset.done; state.done[k] = !state.done[k]; render(); });
  // 1 km time-trial session wiring
  const startTrial = $("startTrial"); if (startTrial) startTrial.onclick = beginTrialRun;
  const cancelTrial = $("cancelTrial"); if (cancelTrial) cancelTrial.onclick = () => { state.trialPending = false; render(); };
  // Live session wiring
  const startBtn = $("startSession"); if (startBtn) startBtn.onclick = startSession;
  const lb = $("liveBack"); if (lb) lb.onclick = () => { stopLive(); stopSpeech(); state.screen = null; state.tab = "today"; render(); };
  const lStart = $("lStart"); if (lStart) lStart.onclick = beginLive;
  const lVoice = $("lVoice"); if (lVoice) lVoice.onclick = () => {
    VOICE_ON = !VOICE_ON; try { localStorage.setItem("interun_voice", VOICE_ON ? "1" : "0"); } catch (e) {}
    if (!VOICE_ON) stopSpeech(); else speak("Voice on.");
    lVoice.classList.toggle("on", VOICE_ON); lVoice.innerHTML = VOICE_ON ? ICON.vox : ICON.voxOff;
  };
  const lPause = $("lPause"); if (lPause) lPause.onclick = () => {
    const st = LIVE.rt.getStatus();
    if (st === "active") {
      LIVE.rt.pause(liveNowMs()).forEach(liveCue);
      if (LIVE.mode === "gps") { LIVE.pauseStart = Date.now(); } else { stopLive(); }
      lPause.textContent = "Resume";
    } else if (st === "paused") {
      if (LIVE.mode === "gps") { LIVE.pausedMs += Date.now() - LIVE.pauseStart; LIVE.pauseStart = 0; LIVE.lastLat = null; LIVE.rt.resume(liveNowMs()).forEach(liveCue); if (!LIVE.ui) LIVE.ui = setInterval(gpsUiTick, 250); }
      else { LIVE.rt.resume(LIVE.vms).forEach(liveCue); startLoop(); }
      lPause.textContent = "Pause";
    }
  };
  const lFinish = $("lFinish"); if (lFinish && !LIVE.done) lFinish.onclick = () => liveFinish(false);
}
function buildNav() {
  $("nav").innerHTML = ["today","plan","activities","community","support"].map((t) => '<button class="navbtn' + (t===state.tab?" on":"") + '" data-tab="' + t + '">' + ICON[t] + '<span class="nl">' + TITLES[t].replace("Your ","") + '</span></button>').join("");
  document.querySelectorAll(".navbtn").forEach((b) => b.onclick = () => { stopLive(); stopSpeech(); stopTrialRun(); TRIALRUN = null; state.screen = null; state.tab = b.dataset.tab; if (b.dataset.tab !== "support") state.support = null; render(); });
}
$("bellBtn").innerHTML = ICON.bell; $("themeBtn").innerHTML = ICON.theme; $("calBtn").innerHTML = ICON.cal; renderAvatar();
$("themeBtn").onclick = () => { const cur = document.documentElement.getAttribute("data-theme"); document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark")); };
$("profileBtn").onclick = () => { stopTrialRun(); state.screen = "setup"; render(); };
$("calBtn").onclick = () => { stopTrialRun(); state.screen = "calendar"; render(); };
seedDone();
buildNav();
render();
// Launch flow: brief brand splash, then either the first-run welcome (which leads into setup) or,
// for a returning user, straight to Today.
(function () {
  const sp = $("splash"); if (!sp) return;
  const removeSplash = () => { sp.classList.add("hide"); setTimeout(() => sp.remove(), 600); };
  if (FIRST_RUN) {
    setTimeout(() => {
      removeSplash();
      const wel = $("welcome"); if (!wel) return;
      wel.classList.add("on");
      const go = () => { wel.classList.add("hide"); setTimeout(() => wel.remove(), 500); state.screen = "setup"; render(); };
      const btn = $("welcomeGo"); if (btn) btn.onclick = go;
    }, 1300);
  } else {
    sp.addEventListener("click", removeSplash);
    setTimeout(removeSplash, 1900);
  }
})();
// Register the service worker only where it actually exists (the GitHub Pages PWA build). We probe
// first so the standalone artifact — which has no sw.js — stays silent instead of logging an error.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
  addEventListener("load", () => {
    fetch("sw.js", { method: "HEAD" }).then((r) => { if (r.ok) navigator.serviceWorker.register("sw.js").catch(() => {}); }).catch(() => {});
  });
}
</script>
</body>
</html>
`;

const outPath = join(here, "app.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);

// ---- Installable PWA build (GitHub Pages) --------------------------------
// The same self-contained shell, plus a web manifest and a service worker, written to /docs so it
// can be served over HTTPS at https://<user>.github.io/<repo>/ — the origin real GPS + voice need.
const docsDir = join(here, "..", "docs");
writeFileSync(join(docsDir, "index.html"), html, "utf8");

const manifest = {
  name: "InteRun — The Intelligent Training Companion",
  short_name: "InteRun",
  description: "Evidence-based running coach with live GPS sessions and voice coaching.",
  start_url: ".",
  scope: ".",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0a100e",
  theme_color: "#0e8c7f",
  categories: ["health", "fitness", "sports"],
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync(join(docsDir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2), "utf8");

// Cache name is tied to the shell size so every deploy invalidates the old cache; navigation is
// network-first (updates reach the user) while assets are cache-first (fast + offline-capable).
const cacheName = `interun-${html.length}`;
const sw = `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("./index.html", c)).catch(() => {}); return res; }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)).catch(() => {}); return res; })));
});
`;
writeFileSync(join(docsDir, "sw.js"), sw, "utf8");
console.log(`Wrote PWA to ${docsDir} (index.html, manifest.webmanifest, sw.js)`);
