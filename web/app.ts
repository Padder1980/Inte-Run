// Builds the navigable app shell (web/app.html): the "one app" that houses every screen we've built
// behind a five-tab bottom nav (Today · Plan · Activities · Community · Support). Our own visual
// identity; the tab structure follows a familiar running-app layout. One engine bundle drives it all,
// client-side. Regenerate with:  node web/app.ts   (or: npm run web)

import { writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundleEngine } from "./bundle.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bundleJs = await bundleEngine();

// Exercise demonstration animations (looping WebP, 512×512, teal muscle highlights in the brand
// family). Read from assets/ and inlined as data URIs so the app stays a single self-contained,
// offline-capable file. Keyed by slug; the strength UI looks these up via each exercise's `anim`.
const EX_ANIM_SLUGS = [
  "goblet-squat", "step-up", "split-squat-dumbbell", "reverse-lunge", "romanian-deadlift-dumbbell",
  "glute-bridge", "clamshell", "standing-calf-raise", "single-leg-standing-calf-raise", "plank",
  "dead-bug", "bird-dog", "push-up", "box-jump",
];
const animDir = join(here, "..", "assets", "exercise-animations");
const exAnimData: Record<string, string> = {};
for (const slug of EX_ANIM_SLUGS) {
  exAnimData[slug] = "data:image/webp;base64," + readFileSync(join(animDir, slug + ".webp")).toString("base64");
}

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
/* Splash / launch screen — shared launch geometry.
   The splash and the welcome use the SAME top-anchored layout and the SAME 96px
   brand mark, so the logo occupies an identical screen rectangle in both. As the
   splash fades out and the welcome fades in at the same instant, the two identical
   logos overlap exactly — the brand mark appears to hold perfectly still while only
   the text and background crossfade around it (a continuous-logo transition). */
.splash, .welcome { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: clamp(84px, 24vh, 176px) 32px 40px; text-align: center; background: radial-gradient(125% 90% at 50% 0%, #0c2b28 0%, #06110f 56%, #000 100%); }
.splash { z-index: 100; gap: 20px; opacity: 1; transition: opacity .55s ease; }
.splash.hide { opacity: 0; pointer-events: none; }
/* Mark + name + tagline all fade in together (same 0 delay), a touch slower, as one unit. */
.splash-mark { animation: splashfade 1.1s ease both; }
.splash-mark svg, .welcome-mark svg { display: block; margin: 0 auto; width: 96px; height: 96px; filter: drop-shadow(0 8px 26px rgba(22,183,164,.38)); }
.splash-name { font-size: 34px; font-weight: 800; letter-spacing: -.02em; color: #fff; animation: splashfade 1.1s ease both; }
.splash-name span { color: #16b7a4; }
.splash-tag { font-size: 13.5px; font-weight: 500; letter-spacing: .01em; color: #9aa3a0; animation: splashfade 1.1s ease both; }
@keyframes splashfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
/* First-run welcome — mounts fully opaque directly UNDER the splash (same bg, same
   logo, same spot). Only the splash fades out on top, dissolving to reveal this; the
   logo holds still and the app never bleeds through. Copy arrives via welIn. */
.welcome { z-index: 90; display: none; opacity: 1; transition: opacity .5s ease; }
.welcome.on { display: flex; }
.welcome.hide { opacity: 0; pointer-events: none; }
.welcome-inner { max-width: 360px; }
/* Welcome copy — heading, all three lines, and the CTA fade in together (same .5s delay
   so the splash label clears first), a touch slower, as one unit. */
.welcome-h { font-size: 30px; font-weight: 800; letter-spacing: -.02em; color: #fff; margin: 20px 0 18px; animation: welIn .65s ease .5s both; }
.welcome-h span { color: #16b7a4; }
.welcome-msg { font-size: 16px; line-height: 1.5; color: #cfd6d3; margin: 0 0 12px; opacity: 0; }
.welcome-msg.m1 { animation: welIn .65s ease .5s both; }
.welcome-msg.m2 { animation: welIn .65s ease .5s both; }
.welcome-msg.m3 { color: #fff; font-weight: 600; animation: welIn .65s ease .5s both; }
.welcome-cta { margin-top: 22px; font: inherit; font-size: 16px; font-weight: 700; color: var(--accent-ink); background: linear-gradient(180deg, #1cc4b0 0%, #0e8c7f 60%, #0b6f65 100%); border: 0; border-radius: 14px; padding: 15px 30px; cursor: pointer; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 10px 26px -8px rgba(22,183,164,.6); opacity: 0; animation: welIn .65s ease .5s both; }
.welcome-cta:active { transform: translateY(1px); }
@keyframes welIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .splash-mark, .splash-name, .splash-tag, .welcome-h, .welcome-msg, .welcome-cta, .wb-quote, .wb-by { animation: none !important; } .welcome-msg, .welcome-cta, .wb-quote, .wb-by { opacity: 1; } }
/* Welcome-back (returning user): personalised greeting + rotating quote — same
   continuous-logo entrance (opaque under the fading splash); only the copy differs. */
.welcome.wb .welcome-h { margin: 18px 0 14px; }
.wb-quote { font-size: 18px; line-height: 1.5; font-style: italic; color: #eef3f1; margin: 0 8px; animation: welIn .65s ease .5s both; }
.wb-by { font-size: 13px; color: #9aa3a0; margin: 12px 0 0; animation: welIn .65s ease .5s both; }
.wb-cta { margin-top: 26px; animation: welIn .65s ease .5s both; }
/* Session guide overlay (interactive walkthrough of the session shorthand) */
.guide-ov { position: fixed; inset: 0; z-index: 80; display: none; align-items: center; justify-content: center; padding: 22px; background: color-mix(in srgb, var(--ink) 72%, transparent); backdrop-filter: blur(5px); opacity: 0; transition: opacity .25s ease; }
.guide-ov.on { display: flex; opacity: 1; }
.guide-card { width: 100%; max-width: 380px; background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 22px 20px 18px; box-shadow: 0 24px 60px -18px rgba(0,0,0,.5); }
.guide-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--accent); }
.guide-title { font-size: 25px; font-weight: 750; letter-spacing: -.01em; margin: 12px 0 4px; line-height: 1.3; display: flex; flex-wrap: wrap; gap: 4px 2px; align-items: baseline; }
.guide-title .gt-sep { color: var(--ink-faint); }
.guide-title .gtok { padding: 1px 5px; border-radius: 7px; transition: opacity .25s ease, background .25s ease, color .25s ease, transform .25s ease; }
.guide-title .gtok.dim { opacity: .28; }
.guide-title .gtok.on { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); font-weight: 800; transform: scale(1.06); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent); }
.guide-cap { min-height: 84px; margin-top: 14px; }
.guide-cap-h { font-size: 15px; font-weight: 750; }
.guide-cap-b { font-size: 13.5px; color: var(--ink-soft); margin-top: 4px; line-height: 1.5; }
.guide-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
.guide-dots { display: flex; gap: 6px; }
.guide-dots .gd { width: 6px; height: 6px; border-radius: 50%; background: var(--line); transition: background .2s, transform .2s; }
.guide-dots .gd.on { background: var(--accent); transform: scale(1.25); }
.guide-btns { display: flex; align-items: center; gap: 6px; }
.guide-skip { font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-faint); background: none; border: 0; padding: 9px 10px; cursor: pointer; }
.guide-next { font: inherit; font-size: 14px; font-weight: 650; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 11px; padding: 10px 20px; cursor: pointer; }
.guide-next:active { transform: translateY(1px); }
/* Support · Understanding my sessions */
.ex-chip { display: inline-block; font-size: 17px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 11px; padding: 9px 14px; margin-top: 12px; }
.leg-row { display: flex; align-items: center; gap: 13px; padding: 9px 0; border-top: 1px solid var(--line); } .leg-row:first-of-type { border-top: 0; }
.leg-sym { flex: none; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 11%, var(--surface)); border-radius: 10px; }
.leg-name { font-size: 14px; font-weight: 650; } .leg-eg { font-size: 12.5px; color: var(--ink-faint); margin-top: 1px; }
.gloss { display: flex; flex-direction: column; gap: 10px; }
.gloss-row b { font-size: 13.5px; } .gloss-row span { display: block; font-size: 12.5px; color: var(--ink-soft); margin-top: 1px; }
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
/* Looping WebP demonstration: the source art is on white, so keep a white backdrop in both themes
   and contain (never crop) the square asset per the animation pack's guidance. */
.ex-anim:has(.ex-webp) { background: #fff; }
.ex-webp { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; background: #fff; }
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
/* Voice coach picker */
.coachcards { display: flex; flex-direction: column; gap: 9px; }
.coachcard { text-align: left; width: 100%; background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); border: 1px solid var(--line); border-radius: 14px; padding: 13px 14px; cursor: pointer; box-shadow: 0 1px 2px rgba(20,32,27,.05); transition: border-color .12s ease, box-shadow .12s ease, background .12s ease; }
.coachcard.on { border-color: transparent; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, var(--surface)), color-mix(in srgb, var(--accent) 5%, var(--surface))); box-shadow: 0 5px 16px -7px color-mix(in srgb, var(--accent) 55%, transparent), 0 0 0 1.5px var(--accent) inset; }
.cc-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.cc-name { font-size: 15px; font-weight: 750; letter-spacing: -.01em; }
.coachcard.on .cc-name { color: var(--accent); }
.cc-preview { flex: none; display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); border-radius: 999px; padding: 4px 10px; cursor: pointer; }
.cc-preview svg { width: 12px; height: 12px; }
.cc-preview:active { transform: translateY(1px); }
.cc-tag { font-size: 12px; font-weight: 600; color: var(--ink-soft); margin-top: 3px; }
.cc-desc { font-size: 12.5px; color: var(--ink-faint); margin-top: 4px; line-height: 1.45; }
.vol { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 30%, var(--surface-2)); outline: none; }
.vol::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); border: 2px solid var(--surface); box-shadow: 0 2px 6px -1px color-mix(in srgb, var(--accent) 60%, transparent); cursor: pointer; }
.vol::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); border: 2px solid var(--surface); cursor: pointer; }
.coach-note { font-size: 11.5px; color: var(--ink-faint); line-height: 1.5; margin-top: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
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
/* Setup / profile form — premium, obvious inputs */
input.sel { font: inherit; font-size: 15px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 11px; padding: 12px 13px; width: 100%; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
input.sel::placeholder { color: var(--ink-faint); }
/* Date inputs: iOS centres the value. Left-align it (and its WebKit value element) and constrain the
   width so it reads like the constrained selects (Age, Sex) — no flex/min-height, which broke iOS. */
input.sel[type="date"] { text-align: left; max-width: 230px; }
input.sel[type="date"]::-webkit-date-and-time-value { text-align: left; }
input.sel:focus, select.sel:focus { outline: none; border-color: var(--accent); background: var(--surface); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
select.sel { font-size: 15px; border-radius: 11px; padding: 12px 13px; cursor: pointer; }
.setup-intro { margin: 2px 2px 14px; }
.setup-intro h2 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; margin: 0; }
.setup-intro p { font-size: 13.5px; color: var(--ink-soft); margin: 5px 0 0; }
.sec-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.sec-num { width: 28px; height: 28px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 750; color: var(--accent-ink); background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 86%, #fff), var(--accent)); box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--accent) 55%, transparent); margin-top: 1px; }
.sec-title { font-size: 17px; font-weight: 750; letter-spacing: -.01em; line-height: 1.2; }
.sec-sub { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
/* Actionable callout for optional-but-valuable inputs (easy pace, 1 km trial) */
.callout { margin-top: 13px; border-radius: 14px; padding: 14px; background: linear-gradient(158deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface) 70%); border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line)); }
.callout-h { display: flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; }
.callout-h .ic { color: var(--accent); display: inline-flex; } .callout-h .ic svg { width: 19px; height: 19px; }
.callout-badge { margin-left: auto; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); border-radius: 999px; padding: 3px 8px; }
.callout p { font-size: 12.5px; color: var(--ink-soft); margin: 7px 0 11px; line-height: 1.45; }
.callout .mas-hint { margin-top: 9px; }
.callout .mini-btn { margin-top: 10px; }
.q-hint { font-size: 12px; color: var(--ink-faint); font-weight: 400; }
.setup-card { padding: 17px; }
.setup-foot { text-align: center; font-size: 12px; color: var(--ink-faint); margin: 14px 0 4px; }
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
/* Adaptive fitness-suggestion banner (after a run implies changed fitness) */
.fit-banner { display: flex; gap: 12px; width: 100%; border-radius: 14px; padding: 14px; margin-bottom: 14px; border: 1px solid; }
.fit-banner.up { background: linear-gradient(158deg, color-mix(in srgb, var(--ready) 14%, var(--surface)), var(--surface) 72%); border-color: color-mix(in srgb, var(--ready) 34%, var(--line)); }
.fit-banner.down { background: linear-gradient(158deg, color-mix(in srgb, var(--ease) 14%, var(--surface)), var(--surface) 72%); border-color: color-mix(in srgb, var(--ease) 34%, var(--line)); }
.fit-banner .fb-ic { flex: none; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; }
.fit-banner.up .fb-ic { background: var(--ready); } .fit-banner.down .fb-ic { background: var(--ease); }
.fit-banner .fb-ic svg { width: 20px; height: 20px; }
.fit-banner .fb-h { font-size: 14.5px; font-weight: 750; letter-spacing: -.01em; }
.fit-banner .fb-b { font-size: 12.5px; color: var(--ink-soft); margin-top: 3px; line-height: 1.45; }
.fit-banner .fb-actions { display: flex; gap: 8px; margin-top: 11px; }
.fit-banner .fb-yes { font: inherit; font-size: 13px; font-weight: 650; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 10px; padding: 9px 15px; cursor: pointer; }
.fit-banner .fb-no { font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-soft); background: transparent; border: 1px solid var(--line); border-radius: 10px; padding: 9px 15px; cursor: pointer; }

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
.live-controls.two { grid-template-columns: 1fr 1fr; }
.live-controls.two .primary { grid-column: auto; }
.ctrl { font: inherit; font-size: 14px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; }
.ctrl:disabled { opacity: .45; cursor: not-allowed; }
.ctrl.danger { color: var(--rest); border-color: color-mix(in srgb, var(--rest) 40%, var(--line)); }
/* Session-complete screen */
.done-hero { text-align: center; background: linear-gradient(150deg, color-mix(in srgb, var(--ready) 16%, var(--surface)), var(--surface)); }
.dn-badge { width: 54px; height: 54px; margin: 2px auto 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--ready); color: #fff; box-shadow: 0 6px 18px color-mix(in srgb, var(--ready) 40%, transparent); }
.dn-badge svg { width: 28px; height: 28px; }
.dn-h { font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
.dn-sub { font-size: 13px; color: var(--ink-soft); margin-top: 3px; }
.dn-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.dn-stat .dn-v { font-size: 22px; font-weight: 750; letter-spacing: -.02em; }
.dn-stat .dn-v small { font-size: 12px; color: var(--ink-faint); font-weight: 500; }
.dn-stat .dn-k { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); margin-top: 2px; }
/* Run overview: route map (brand-colour marching-ants line) + stats + splits */
.ov-map-card { padding: 0; overflow: hidden; }
.ov-map { position: relative; background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 8%, var(--surface-2)), var(--surface-2)); }
.ov-mapcv { display: block; width: 100%; height: auto; }
.ov-mapov { position: absolute; inset: 0; }
.ov-mapov .routemap { width: 100%; height: 100%; }
.ov-mapov .rt-base { stroke-width: 9; opacity: .55; } .ov-mapov .rt-ants { stroke-width: 5; stroke-dasharray: 15 17; }
.ov-mapov .rt-start, .ov-mapov .rt-end { stroke-width: 4; }
.ov-attr { position: absolute; left: 10px; bottom: 7px; font-size: 10px; color: rgba(255,255,255,.45); text-shadow: 0 1px 2px rgba(0,0,0,.5); pointer-events: none; }
/* Light (Voyager) overview map: give the route a dark casing so the bright-green line reads on streets */
.ov-light .ov-mapov .rt-base { stroke: #062e25; opacity: .92; stroke-width: 12.5; }
.ov-light .ov-mapov .rt-ants { stroke: #17c98f; stroke-width: 6.5; filter: drop-shadow(0 1px 2px rgba(3,20,16,.45)); }
.ov-light .ov-mapov .rt-start { fill: #17c98f; stroke: #fff; stroke-width: 4.5; }
.ov-light .ov-mapov .rt-end { fill: #fff; stroke: #062e25; stroke-width: 5; }
.ov-light .ov-attr { color: rgba(20,44,36,.62); text-shadow: 0 1px 1px rgba(255,255,255,.7); }
.routemap { display: block; width: 100%; height: auto; }
.rt-base { fill: none; stroke: var(--accent); stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; opacity: .5; }
.rt-ants { fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 9 11; filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent) 70%, transparent)); animation: rtMarch 1s linear infinite; }
@keyframes rtMarch { to { stroke-dashoffset: -20; } }
.rt-start { fill: var(--accent); stroke: #fff; stroke-width: 2.5; }
.rt-end { fill: #fff; stroke: var(--accent); stroke-width: 3.5; }
@media (prefers-reduced-motion: reduce) { .rt-ants { animation: none; } }
.rt-none { padding: 26px 16px; text-align: center; font-size: 13px; color: var(--ink-faint); }
.ov-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 14px 16px; border-top: 1px solid var(--line); }
.ov-stat .ov-v { font-size: 21px; font-weight: 750; letter-spacing: -.02em; }
.ov-stat .ov-k { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); margin-top: 2px; }
.sp-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.sp-k { flex: none; width: 46px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
.sp-bar { flex: 1; height: 9px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
.sp-bar i { display: block; height: 100%; border-radius: 999px; background: color-mix(in srgb, var(--accent) 55%, var(--base)); }
.sp-v { flex: none; width: 52px; text-align: right; font-size: 12.5px; font-weight: 600; }
/* Activities: empty state + tappable run cards */
.empty-acts { text-align: center; padding: 40px 24px; }
.empty-acts .ea-ic { width: 54px; height: 54px; margin: 0 auto 14px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.empty-acts .ea-ic svg { width: 28px; height: 28px; }
.empty-acts .ea-h { font-size: 17px; font-weight: 750; }
.empty-acts .ea-b { font-size: 13.5px; color: var(--ink-soft); margin-top: 6px; line-height: 1.5; max-width: 300px; margin-left: auto; margin-right: auto; }
.runcard { display: block; width: 100%; text-align: left; padding: 0; overflow: hidden; margin-bottom: 10px; cursor: pointer; font: inherit; color: inherit; }
.rc-map { background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 8%, var(--surface-2)), var(--surface-2)); border-bottom: 1px solid var(--line); }
.rc-map .routemap { max-height: 150px; }
.runcard .act { display: flex; align-items: center; padding: 13px 15px; }
.runcard .rc-arr { margin-left: auto; color: var(--ink-faint); font-size: 20px; }
.rd-head { margin: 2px 2px 12px; } .rd-head .rd-t { font-size: 20px; font-weight: 750; letter-spacing: -.02em; } .rd-head .rd-d { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
.share-btn { background: var(--surface); color: var(--accent); border: 1.5px solid color-mix(in srgb, var(--accent) 45%, var(--line)); box-shadow: 0 1px 2px rgba(20,32,27,.05); }
.share-btn svg { width: 19px; height: 19px; }
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

/* =========================================================
   PROFILE / SETUP — premium visual refinement (design collab)
   Scoped to the setup screen via #view:has(#saveProfile); uses
   existing colour tokens so light and dark both adapt.
   ========================================================= */
#view:has(#saveProfile) {
  --profile-tint: color-mix(in srgb, var(--accent) 8%, var(--surface));
  --profile-edge: color-mix(in srgb, var(--accent) 24%, var(--line));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 32%),
    var(--bg);
}
#view:has(#saveProfile) .setup-intro {
  position: relative; isolation: isolate; overflow: hidden;
  margin: 0 0 14px; padding: 20px;
  background: linear-gradient(145deg, var(--profile-tint), var(--surface) 68%);
  border: 1px solid var(--profile-edge); border-radius: 22px; box-shadow: var(--shadow);
}
#view:has(#saveProfile) .setup-intro::before {
  content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--accent); pointer-events: none;
}
#view:has(#saveProfile) .setup-intro > * { position: relative; z-index: 1; }
#view:has(#saveProfile) .setup-intro h2 {
  margin: 0; max-width: 14ch; color: var(--ink); font-size: 25px; font-weight: 780; letter-spacing: -0.035em; line-height: 1.08;
}
#view:has(#saveProfile) .setup-intro p {
  max-width: 34ch; margin: 8px 0 0; color: var(--ink-soft); font-size: 13.5px; line-height: 1.5;
}
#view:has(#saveProfile) .setup-card {
  padding: 18px;
  background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 35%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 82%, var(--accent)); border-radius: 18px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
}
#view:has(#saveProfile) .sec-head {
  align-items: center; gap: 11px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--line);
}
#view:has(#saveProfile) .sec-num {
  width: 29px; min-width: 29px; height: 25px; margin: 0;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border: 1px solid var(--profile-edge); border-radius: 8px; box-shadow: none;
  font-family: var(--mono); font-size: 12px; font-weight: 750;
}
#view:has(#saveProfile) .sec-title { color: var(--ink); font-size: 17px; font-weight: 730; letter-spacing: -0.02em; }
#view:has(#saveProfile) .sec-sub { margin-top: 3px; color: var(--ink-faint); font-size: 12px; line-height: 1.35; }
#view:has(#saveProfile) .avatar-row { gap: 17px; margin-top: 2px; }
#view:has(#saveProfile) .avatar-pic {
  width: 86px; height: 86px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, var(--surface)), var(--surface));
  border: 4px solid var(--surface); box-shadow: 0 0 0 1px var(--line), var(--shadow); color: var(--accent); font-size: 29px;
}
#view:has(#saveProfile) .avatar-cta {
  min-height: 40px; padding: 9px 14px; color: var(--accent); background: var(--surface-2);
  border-color: var(--profile-edge); border-radius: 10px; box-shadow: none;
}
#view:has(#saveProfile) .avatar-cta:hover { background: var(--profile-tint); }
#view:has(#saveProfile) .avatar-hint { max-width: 19ch; margin-top: 7px; color: var(--ink-faint); font-size: 11.5px; line-height: 1.35; }
#view:has(#saveProfile) .q { margin-top: 16px; }
#view:has(#saveProfile) .q label { margin-bottom: 8px; color: var(--ink); font-size: 12.5px; font-weight: 650; line-height: 1.4; }
#view:has(#saveProfile) .q-hint { color: var(--ink-faint); font-size: 11.5px; font-weight: 450; }
#view:has(#saveProfile) input.sel,
#view:has(#saveProfile) select.sel {
  min-height: 46px; padding: 12px 13px; color: var(--ink); background: var(--surface-2);
  border-color: color-mix(in srgb, var(--line) 78%, var(--ink-faint)); border-radius: 11px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(#saveProfile) input.sel:hover,
#view:has(#saveProfile) select.sel:hover { border-color: var(--profile-edge); }
#view:has(#saveProfile) input.sel:focus,
#view:has(#saveProfile) select.sel:focus {
  color: var(--ink); background: var(--surface); border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}
#view:has(#saveProfile) .statuscards { gap: 9px; }
#view:has(#saveProfile) .statuscard {
  position: relative; padding: 14px; background: var(--surface-2); border-color: var(--line); border-radius: 14px; box-shadow: none;
}
#view:has(#saveProfile) .statuscard:hover { border-color: var(--profile-edge); }
#view:has(#saveProfile) .statuscard.on {
  color: var(--ink); background: var(--profile-tint); border-color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent);
}
#view:has(#saveProfile) .statuscard.on .sc-t { color: var(--accent); }
#view:has(#saveProfile) .sc-t { font-size: 14.5px; font-weight: 700; }
#view:has(#saveProfile) .sc-d { margin-top: 4px; color: var(--ink-soft); line-height: 1.45; }
#view:has(#saveProfile) .setup-card .seg { gap: 7px; }
#view:has(#saveProfile) .setup-card .seg button {
  min-width: 42px; min-height: 38px; padding: 8px 14px; color: var(--ink-soft); background: var(--surface-2);
  border-color: var(--line); border-radius: 999px; box-shadow: none;
}
#view:has(#saveProfile) .setup-card .seg button:hover { color: var(--ink); border-color: var(--profile-edge); }
#view:has(#saveProfile) .setup-card .seg button.on {
  color: var(--accent-ink); background: var(--accent); border-color: var(--accent);
  box-shadow: 0 7px 16px -10px color-mix(in srgb, var(--accent) 75%, transparent);
}
#view:has(#saveProfile) .callout {
  margin-top: 15px; padding: 16px;
  background: linear-gradient(150deg, var(--profile-tint), var(--surface) 76%);
  border-color: var(--profile-edge); border-radius: 16px;
}
#view:has(#saveProfile) .callout-h { color: var(--ink); font-size: 14.5px; font-weight: 720; }
#view:has(#saveProfile) .callout-badge {
  color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid var(--profile-edge);
}
#view:has(#saveProfile) .callout p { margin: 8px 0 13px; color: var(--ink-soft); line-height: 1.5; }
#view:has(#saveProfile) #saveProfile {
  min-height: 52px; margin-top: 18px; color: var(--accent-ink); background: var(--accent);
  border: 1px solid var(--accent); border-radius: 15px;
  box-shadow: 0 10px 22px -13px color-mix(in srgb, var(--accent) 80%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--accent-ink) 30%, transparent);
  font-size: 15px; font-weight: 720;
}
#view:has(#saveProfile) #saveProfile:hover { filter: brightness(1.03); }
#view:has(#saveProfile) #saveProfile:active { transform: translateY(1px); }
#view:has(#saveProfile) #cancelSetup {
  min-height: 48px; margin-top: 9px !important; color: var(--ink-soft) !important; background: transparent !important;
  border: 1px solid var(--line); border-radius: 15px; box-shadow: none !important;
}
#view:has(#saveProfile) #cancelSetup:hover { color: var(--ink) !important; background: var(--surface-2) !important; }
#view:has(#saveProfile) .setup-foot { margin: 14px 0 6px; color: var(--ink-faint); font-size: 11.5px; }
@media (max-width: 360px) {
  #view:has(#saveProfile) .setup-intro { padding: 18px; }
  #view:has(#saveProfile) .setup-card { padding: 16px; }
  #view:has(#saveProfile) .avatar-row { align-items: flex-start; }
  #view:has(#saveProfile) .avatar-pic { width: 76px; height: 76px; }
}

/* =========================================================
   TODAY — premium visual refinement (design collab)
   Scoped to the Today screen via #view:has(.hero-wk); token-driven
   so light and dark both adapt. Keeps the marching-ants start button
   (base .start-btn::before still supplies content/animation).
   ========================================================= */
#view:has(.hero-wk) {
  --today-tint: color-mix(in srgb, var(--accent) 8%, var(--surface));
  --today-edge: color-mix(in srgb, var(--accent) 22%, var(--line));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 30%),
    var(--bg);
}
#view:has(.hero-wk) .greeting {
  margin: 2px 2px 14px; color: var(--ink-soft); font-size: 20px; font-weight: 520; letter-spacing: -0.025em; line-height: 1.2;
}
#view:has(.hero-wk) .greeting b { color: var(--ink); font-weight: 760; }
#view:has(.hero-wk) .weekstrip,
#view:has(#startTrial) .weekstrip {
  gap: 3px; margin: 0 0 16px; padding: 6px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow);
}
#view:has(.hero-wk) .weekstrip .d,
#view:has(#startTrial) .weekstrip .d {
  min-width: 0; min-height: 54px; padding: 7px 0 6px;
  background: transparent; border: 1px solid transparent; border-radius: 12px;
  transition: color 140ms ease, background 140ms ease, border-color 140ms ease, transform 120ms ease;
}
#view:has(.hero-wk) .weekstrip .d .dn,
#view:has(#startTrial) .weekstrip .d .dn { color: var(--ink-faint); font-size: 9.5px; font-weight: 680; letter-spacing: 0.07em; }
#view:has(.hero-wk) .weekstrip .d .dd,
#view:has(#startTrial) .weekstrip .d .dd { margin-top: 2px; color: var(--ink); font-family: var(--mono); font-size: 14px; font-weight: 680; }
#view:has(.hero-wk) .weekstrip .d.today:not(.sel),
#view:has(#startTrial) .weekstrip .d.today:not(.sel) { background: var(--today-tint, var(--surface-2)); border-color: var(--today-edge, var(--line)); }
#view:has(.hero-wk) .weekstrip .d.sel,
#view:has(#startTrial) .weekstrip .d.sel {
  color: var(--accent-ink); background: var(--accent); border-color: var(--accent);
  box-shadow: 0 8px 18px -12px color-mix(in srgb, var(--accent) 80%, transparent);
}
#view:has(.hero-wk) .weekstrip .d.sel .dn,
#view:has(#startTrial) .weekstrip .d.sel .dn { color: color-mix(in srgb, var(--accent-ink) 72%, transparent); }
#view:has(.hero-wk) .weekstrip .d.sel .dd,
#view:has(#startTrial) .weekstrip .d.sel .dd { color: var(--accent-ink); }
#view:has(.hero-wk) .weekstrip .d .dot,
#view:has(#startTrial) .weekstrip .d .dot { width: 5px; height: 5px; margin-top: 4px; }
#view:has(.hero-wk) .hero-wk {
  position: relative; padding: 22px 20px 20px; color: var(--ink);
  background: linear-gradient(145deg, color-mix(in srgb, var(--c, var(--accent)) 13%, var(--surface)), var(--surface) 64%);
  border: 1px solid color-mix(in srgb, var(--c, var(--accent)) 26%, var(--line)); border-radius: 22px;
  box-shadow: var(--shadow), inset 3px 0 0 var(--c, var(--accent)), inset 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
}
#view:has(.hero-wk) .hero-wk:active {
  transform: translateY(1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--ink) 8%, transparent), inset 3px 0 0 var(--c, var(--accent));
}
#view:has(.hero-wk) .hero-wk.rest {
  --c: var(--ink-faint); color: var(--ink);
  background: linear-gradient(145deg, var(--surface), var(--surface-2)); border-color: var(--line);
}
#view:has(.hero-wk) .hw-eyebrow {
  position: relative; z-index: 1; color: var(--c, var(--accent)); font-size: 10.5px; font-weight: 760; letter-spacing: 0.085em; opacity: 1;
}
#view:has(.hero-wk) .hero-wk.rest .hw-eyebrow { color: var(--ink-faint); }
#view:has(.hero-wk) .hw-title {
  position: relative; z-index: 1; max-width: 14ch; margin: 7px 0 16px;
  color: var(--ink); font-size: 27px; font-weight: 790; letter-spacing: -0.04em; line-height: 1.04;
}
#view:has(.hero-wk) .hw-sub { position: relative; z-index: 1; max-width: 31ch; color: var(--ink-soft); line-height: 1.5; }
#view:has(.hero-wk) .hw-chips { position: relative; z-index: 1; gap: 7px; }
#view:has(.hero-wk) .hw-chip {
  padding: 5px 9px; color: var(--ink);
  background: color-mix(in srgb, var(--c, var(--accent)) 10%, var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--c, var(--accent)) 22%, var(--line));
  border-radius: 9px; font-size: 11.5px; font-weight: 650;
}
#view:has(.hero-wk) .hw-also { position: relative; z-index: 1; color: var(--ink-soft); opacity: 1; }
#view:has(.hero-wk) .hw-go { position: relative; z-index: 1; margin-top: 17px; color: var(--accent); font-size: 12.5px; font-weight: 720; opacity: 1; }
#view:has(.hero-wk) .hw-go span { transition: transform 140ms ease; }
#view:has(.hero-wk) .hero-wk:hover .hw-go span { transform: translateX(2px); }
#view:has(.hero-wk) .hw-glow {
  right: -55px; top: -60px; width: 190px; height: 190px;
  background: radial-gradient(circle, color-mix(in srgb, var(--c, var(--accent)) 18%, transparent), transparent 69%);
}
#view:has(.hero-wk) .start-btn {
  min-height: 54px; margin-top: 17px; padding: 15px 18px; color: var(--accent-ink); background: var(--accent);
  border: 1px solid var(--accent); border-radius: 16px;
  box-shadow: 0 10px 24px -15px color-mix(in srgb, var(--accent) 85%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--accent-ink) 24%, transparent);
  font-size: 15px; font-weight: 740;
}
#view:has(.hero-wk) .start-btn::before {
  inset: -3px; border-radius: 19px;
  background: conic-gradient(from var(--ma),
    var(--accent) 0deg, color-mix(in srgb, var(--accent-ink) 82%, var(--accent)) 60deg,
    var(--accent) 120deg, color-mix(in srgb, var(--accent-ink) 82%, var(--accent)) 180deg,
    var(--accent) 240deg, color-mix(in srgb, var(--accent-ink) 82%, var(--accent)) 300deg, var(--accent) 360deg);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 48%, transparent));
}
#view:has(.hero-wk) .tsq-row { gap: 10px; margin-top: 18px; }
#view:has(.hero-wk) .tsq {
  min-width: 0; padding: 15px; color: var(--ink);
  background: linear-gradient(155deg, color-mix(in srgb, var(--sqc, var(--accent)) 7%, var(--surface)), var(--surface) 68%);
  border-color: color-mix(in srgb, var(--sqc, var(--accent)) 17%, var(--line)); border-radius: 16px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(.hero-wk) .tsq:active { transform: translateY(1px); }
#view:has(.hero-wk) .tsq-ic {
  width: 36px; height: 36px; margin-bottom: 13px; color: var(--sqc, var(--accent));
  background: color-mix(in srgb, var(--sqc, var(--accent)) 12%, var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--sqc, var(--accent)) 24%, var(--line)); border-radius: 11px; box-shadow: none;
}
#view:has(.hero-wk) .tsq-ic svg { width: 19px; height: 19px; }
#view:has(.hero-wk) .tsq-k { color: var(--ink-faint); font-size: 10px; font-weight: 720; letter-spacing: 0.075em; }
#view:has(.hero-wk) .tsq-v { margin-top: 4px; color: var(--ink); font-size: 15px; font-weight: 730; letter-spacing: -0.02em; line-height: 1.25; }
#view:has(.hero-wk) .tsq-sub { margin-top: 5px; color: var(--ink-soft); font-size: 11.5px; line-height: 1.35; }
#view:has(.hero-wk) .setup-banner {
  padding: 14px 15px; background: linear-gradient(145deg, var(--today-tint), var(--surface));
  border-color: var(--today-edge); border-radius: 16px; box-shadow: var(--shadow);
}
#view:has(.hero-wk) .setup-banner span { color: var(--accent); font-weight: 700; }
#view:has(.hero-wk) .fit-banner { padding: 15px; border-radius: 16px; box-shadow: var(--shadow); }
#view:has(.hero-wk) .fit-banner .fb-ic { width: 36px; height: 36px; border-radius: 11px; }
#view:has(.hero-wk) .fit-banner .fb-h { color: var(--ink); font-size: 14px; font-weight: 730; }
#view:has(.hero-wk) .fit-banner .fb-actions { flex-wrap: wrap; }
#view:has(.hero-wk) .fit-banner .fb-yes,
#view:has(.hero-wk) .fit-banner .fb-no { min-height: 39px; border-radius: 10px; }
@media (max-width: 360px) {
  #view:has(.hero-wk) .hero-wk { padding: 20px 18px 19px; }
  #view:has(.hero-wk) .hw-title { font-size: 24px; }
  #view:has(.hero-wk) .tsq { padding: 13px; }
  #view:has(.hero-wk) .tsq-v { font-size: 14px; }
}

/* =========================================================
   PLAN — premium visual refinement (design collab)
   Scoped to the Plan screen via #view:has(.plan-head); token-driven so
   light and dark both adapt. !important on #weekDetail children beats
   their inline styles from weekDetail().
   ========================================================= */
#view:has(.plan-head) {
  --plan-tint: color-mix(in srgb, var(--accent) 8%, var(--surface));
  --plan-edge: color-mix(in srgb, var(--accent) 23%, var(--line));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 30%),
    var(--bg);
}
#view:has(.plan-head) .plan-head {
  position: relative; isolation: isolate; overflow: hidden; padding: 22px 20px 20px;
  background: linear-gradient(145deg, var(--plan-tint), var(--surface) 68%);
  border-color: var(--plan-edge); border-radius: 22px;
  box-shadow: var(--shadow), inset 3px 0 0 var(--accent), inset 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
}
#view:has(.plan-head) .plan-head::after {
  content: ""; position: absolute; z-index: -1; top: -70px; right: -70px; width: 190px; height: 190px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent), transparent 68%); pointer-events: none;
}
#view:has(.plan-head) .plan-head .eyebrow { color: var(--accent); font-size: 10.5px; font-weight: 760; letter-spacing: 0.09em; }
#view:has(.plan-head) .plan-head .goal { max-width: 17ch; margin-top: 7px; color: var(--ink); font-size: 26px; font-weight: 790; letter-spacing: -0.04em; line-height: 1.08; }
#view:has(.plan-head) .plan-head .when { margin-top: 7px; color: var(--ink-soft); font-size: 12.5px; line-height: 1.4; }
#view:has(.plan-head) .pill {
  gap: 7px; margin-top: 14px; padding: 6px 11px; color: var(--pc, var(--accent));
  background: color-mix(in srgb, var(--pc, var(--accent)) 11%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--pc, var(--accent)) 28%, var(--line));
  border-radius: 999px; font-size: 11.5px; font-weight: 720; letter-spacing: 0.01em;
}
#view:has(.plan-head) .pill::before {
  width: 7px; height: 7px; background: var(--pc, var(--accent));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc, var(--accent)) 12%, transparent);
}
#view:has(.plan-head) .statrow { gap: 8px; margin-top: 18px; }
#view:has(.plan-head) .stat {
  min-width: 0; padding: 12px 10px;
  background: color-mix(in srgb, var(--surface-2) 72%, transparent);
  border-color: color-mix(in srgb, var(--line) 82%, var(--accent)); border-radius: 12px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(.plan-head) .stat .k { color: var(--ink-faint); font-size: 9.5px; font-weight: 700; letter-spacing: 0.075em; }
#view:has(.plan-head) .stat .v { margin-top: 5px; color: var(--ink); font-size: 16px; font-weight: 720; letter-spacing: -0.025em; line-height: 1.15; }
#view:has(.plan-head) .plan-note {
  position: relative; margin-top: 11px; padding: 14px 15px; color: var(--ink-soft);
  background: linear-gradient(145deg, color-mix(in srgb, var(--base) 7%, var(--surface)), var(--surface));
  border-color: color-mix(in srgb, var(--base) 22%, var(--line)); border-left-width: 3px; border-radius: 14px;
  box-shadow: var(--shadow); font-size: 12.5px; line-height: 1.5;
}
#view:has(.plan-head) .plan-note b { color: var(--ink); font-weight: 690; }
#view:has(.plan-head) h2.sec {
  position: relative; margin: 24px 2px 10px; padding-left: 12px; color: var(--ink); font-size: 15px; font-weight: 740; letter-spacing: -0.015em;
}
#view:has(.plan-head) h2.sec::before {
  content: ""; position: absolute; top: 50%; left: 0; width: 4px; height: 16px; background: var(--accent); border-radius: 999px; transform: translateY(-50%);
}
#view:has(.plan-head) .card:has(#chart) {
  padding: 18px 16px 14px;
  background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 35%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 85%, var(--accent)); border-radius: 18px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(.plan-head) .chart { gap: 4px; height: 138px; margin-top: 0; }
#view:has(.plan-head) .bar-btn { gap: 7px; border-radius: 8px; transition: transform 140ms ease; }
#view:has(.plan-head) .bar-btn:active { transform: scale(0.97); }
#view:has(.plan-head) .bar {
  min-height: 5px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--phase) 82%, var(--surface)), var(--phase));
  border-radius: 6px 6px 3px 3px; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--surface) 25%, transparent);
}
#view:has(.plan-head) .bar.deload {
  background-color: var(--phase);
  background-image: repeating-linear-gradient(135deg, transparent, transparent 4px, color-mix(in srgb, var(--surface) 42%, transparent) 4px, color-mix(in srgb, var(--surface) 42%, transparent) 7px);
}
#view:has(.plan-head) .bar-btn .bl {
  width: 21px; height: 21px; margin: 0 auto; display: flex; align-items: center; justify-content: center;
  color: var(--ink-faint); border-radius: 7px; font-size: 9px; font-weight: 650; transition: color 140ms ease, background 140ms ease;
}
#view:has(.plan-head) .bar-btn[aria-pressed="true"] .bar {
  outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 8px 14px -10px color-mix(in srgb, var(--phase) 70%, transparent);
}
#view:has(.plan-head) .bar-btn[aria-pressed="true"] .bl { color: var(--accent-ink); background: var(--accent); font-weight: 760; }
#view:has(.plan-head) .bar-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
/* Phase legend so the chart is read by label, not colour alone; a faint rule marks each phase start */
#view:has(.plan-head) .phase-legend { display: flex; flex-wrap: wrap; gap: 7px 14px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
#view:has(.plan-head) .phase-key { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 650; color: var(--ink-soft); }
#view:has(.plan-head) .phase-key i { width: 10px; height: 10px; border-radius: 3px; background: var(--phase); flex: none; }
#view:has(.plan-head) .bar-btn.phase-start { position: relative; }
#view:has(.plan-head) .bar-btn.phase-start:not(:first-child)::before { content: ""; position: absolute; left: -3px; top: 6px; bottom: 26px; width: 1px; background: color-mix(in srgb, var(--ink) 12%, transparent); }
#view:has(.plan-head) #weekDetail {
  padding: 18px;
  background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 30%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 85%, var(--accent)); border-radius: 18px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(.plan-head) #weekDetail > div:first-child {
  color: var(--ink); font-size: 17px !important; font-weight: 760 !important; letter-spacing: -0.025em; line-height: 1.25;
}
#view:has(.plan-head) #weekDetail > div:nth-child(2) {
  max-width: 32ch; margin-top: 4px !important; margin-bottom: 16px !important; color: var(--ink-soft) !important; font-size: 12.5px !important; line-height: 1.45;
}
#view:has(.plan-head) .day-row {
  grid-template-columns: 42px minmax(0, 1fr); gap: 8px; margin-top: 7px; padding: 11px 10px;
  background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px;
}
#view:has(.plan-head) .day-row:first-of-type { margin-top: 0; border-top: 1px solid var(--line); }
#view:has(.plan-head) .day-nm { padding-top: 3px; color: var(--ink-faint); font-size: 10px; font-weight: 750; letter-spacing: 0.075em; }
#view:has(.plan-head) .sess { min-width: 0; gap: 10px; }
#view:has(.plan-head) .sess.tap {
  padding: 9px 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 11px;
  transition: border-color 140ms ease, background 140ms ease, transform 120ms ease;
}
#view:has(.plan-head) .sess.tap:hover { background: var(--plan-tint); border-color: var(--plan-edge); }
#view:has(.plan-head) .sess.tap:active { opacity: 1; transform: translateY(1px); }
#view:has(.plan-head) .sess + .sess { margin-top: 7px; }
#view:has(.plan-head) .sess .dot { width: 8px; height: 8px; margin-top: 5px; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 8%, transparent); }
#view:has(.plan-head) .sess .st { color: var(--ink); font-size: 13.5px; font-weight: 660; letter-spacing: -0.01em; line-height: 1.35; }
#view:has(.plan-head) .sess .sm { gap: 5px; margin-top: 6px; }
#view:has(.plan-head) .sess .chip { padding: 3px 7px; color: var(--ink-soft); background: var(--surface-2); border-color: var(--line); border-radius: 7px; font-size: 10.5px; line-height: 1.25; }
#view:has(.plan-head) .sess .chip.pace { color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface-2)); border-color: var(--plan-edge); }
@media (max-width: 360px) {
  #view:has(.plan-head) .plan-head { padding: 20px 17px 18px; }
  #view:has(.plan-head) .plan-head .goal { font-size: 23px; }
  #view:has(.plan-head) .stat { padding: 10px 7px; }
  #view:has(.plan-head) .stat .v { font-size: 14.5px; }
  #view:has(.plan-head) #weekDetail { padding: 15px; }
  #view:has(.plan-head) .day-row { grid-template-columns: 37px minmax(0, 1fr); padding: 9px 8px; }
  #view:has(.plan-head) .sess.tap { padding: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  #view:has(.plan-head) .bar-btn,
  #view:has(.plan-head) .sess.tap { transition: none; }
}

/* =========================================================
   ACTIVITIES — premium visual refinement (design collab)
   Scoped to the Activities screen via #view:has(.subtabs); token-driven.
   ========================================================= */
#view:has(.subtabs) {
  --activity-tint: color-mix(in srgb, var(--accent) 8%, var(--surface));
  --activity-edge: color-mix(in srgb, var(--accent) 23%, var(--line));
  background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 30%), var(--bg);
}
#view:has(.subtabs) .subtabs {
  position: sticky; top: 0; z-index: 8; gap: 4px; margin: 0 0 18px; padding: 4px;
  background: color-mix(in srgb, var(--surface-2) 90%, transparent);
  border-color: color-mix(in srgb, var(--line) 86%, var(--accent)); border-radius: 15px;
  box-shadow: 0 8px 22px -18px color-mix(in srgb, var(--ink) 35%, transparent), inset 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
  backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%);
}
#view:has(.subtabs) .subtabs button {
  position: relative; min-height: 40px; padding: 9px 7px; color: var(--ink-faint); border-radius: 11px;
  font-size: 12.5px; font-weight: 680; letter-spacing: -0.005em;
  transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease, transform 120ms ease;
}
#view:has(.subtabs) .subtabs button.on {
  color: var(--accent); background: linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--accent) 6%, var(--surface)));
  box-shadow: 0 6px 15px -11px color-mix(in srgb, var(--ink) 38%, transparent), inset 0 -2px 0 var(--accent), inset 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
  font-weight: 740;
}
#view:has(.subtabs) .subtabs button:active { transform: scale(0.98); }
#view:has(.subtabs) .subtabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
#view:has(.subtabs) .subtabs + div[style] {
  margin: 0 3px 11px !important; color: var(--ink-faint) !important;
  font-size: 10.5px !important; font-weight: 720; letter-spacing: 0.075em; text-transform: uppercase;
}
#view:has(.subtabs) .runcard {
  position: relative; margin-bottom: 13px;
  background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 38%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 84%, var(--accent)); border-radius: 20px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
}
#view:has(.subtabs) .runcard:hover { border-color: var(--activity-edge); box-shadow: var(--shadow), 0 12px 25px -21px color-mix(in srgb, var(--accent) 48%, transparent); }
#view:has(.subtabs) .runcard:active { transform: translateY(1px); }
#view:has(.subtabs) .rc-map {
  position: relative; overflow: hidden; height: 138px;
  background: radial-gradient(circle at 25% 15%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 38%), var(--surface-2);
  border-bottom-color: color-mix(in srgb, var(--line) 84%, var(--accent));
}
#view:has(.subtabs) .rc-map::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 -16px 24px -24px color-mix(in srgb, var(--ink) 40%, transparent); pointer-events: none; }
#view:has(.subtabs) .rc-map .routemap { display: block; width: 100%; height: 100%; max-height: none; }
#view:has(.subtabs) .runcard .act { gap: 13px; padding: 16px 16px 17px 18px; }
#view:has(.subtabs) .runcard .act::before { top: 17px; bottom: 17px; left: 0; width: 3px; background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, var(--build))); border-radius: 0 999px 999px 0; }
#view:has(.subtabs) .act .b { min-width: 0; }
#view:has(.subtabs) .act .t { color: var(--ink); font-size: 16px; font-weight: 740; letter-spacing: -0.02em; line-height: 1.3; }
#view:has(.subtabs) .act .d { margin-top: 3px; color: var(--ink-faint); font-size: 11.5px; line-height: 1.35; }
#view:has(.subtabs) .act .m { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
#view:has(.subtabs) .act .m > div { min-width: 0; padding: 0 9px; }
#view:has(.subtabs) .act .m > div:first-child { padding-left: 0; }
#view:has(.subtabs) .act .m > div:not(:first-child) { border-left: 1px solid var(--line); }
#view:has(.subtabs) .act .m b { overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 720; letter-spacing: -0.025em; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
#view:has(.subtabs) .act .m span { display: block; margin-top: 3px; color: var(--ink-faint); font-size: 9px; font-weight: 680; letter-spacing: 0.055em; line-height: 1.2; text-transform: uppercase; }
#view:has(.subtabs) .runcard .rc-arr {
  width: 30px; height: 30px; margin-left: auto; flex: none; display: flex; align-items: center; justify-content: center;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--surface-2));
  border: 1px solid var(--activity-edge); border-radius: 10px; font-size: 19px; line-height: 1;
}
#view:has(.subtabs) .empty-acts, #view:has(.subtabs) .empty-state {
  position: relative; overflow: hidden; padding: 48px 25px;
  background: linear-gradient(155deg, var(--activity-tint), var(--surface) 68%);
  border: 1px solid var(--activity-edge); border-radius: 22px; box-shadow: var(--shadow), inset 3px 0 0 var(--accent);
}
#view:has(.subtabs) .empty-acts::after, #view:has(.subtabs) .empty-state::after { content: ""; position: absolute; top: -60px; right: -60px; width: 160px; height: 160px; background: radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent), transparent 68%); pointer-events: none; }
#view:has(.subtabs) .empty-acts .ea-ic, #view:has(.subtabs) .empty-state .ic {
  width: 58px; height: 58px; margin-bottom: 16px; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 11%, var(--surface)); border: 1px solid var(--activity-edge); border-radius: 17px;
  box-shadow: 0 9px 18px -15px color-mix(in srgb, var(--accent) 65%, transparent);
}
#view:has(.subtabs) .empty-acts .ea-h, #view:has(.subtabs) .empty-state h3 { color: var(--ink); font-size: 18px; font-weight: 760; letter-spacing: -0.025em; }
#view:has(.subtabs) .empty-acts .ea-b, #view:has(.subtabs) .empty-state p { color: var(--ink-soft); line-height: 1.55; }
#view:has(.subtabs) .sh-card {
  margin-bottom: 12px; padding: 16px;
  background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 35%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 84%, var(--accent)); border-radius: 18px;
  box-shadow: var(--shadow), inset 0 1px 0 color-mix(in srgb, var(--ink) 3%, transparent);
}
#view:has(.subtabs) .sh-head { gap: 13px; }
#view:has(.subtabs) .sh-anim { width: 64px; height: 70px; border-color: var(--activity-edge); border-radius: 13px; }
#view:has(.subtabs) .sh-name { color: var(--ink); font-size: 15.5px; font-weight: 730; letter-spacing: -0.018em; }
#view:has(.subtabs) .sh-mus { margin-top: 2px; color: var(--ink-soft); }
#view:has(.subtabs) .sh-best { margin-top: 6px; }
#view:has(.subtabs) .sh-best b { color: var(--accent); font-weight: 740; }
#view:has(.subtabs) .sh-spark { height: 45px; padding: 7px 6px 5px; background: color-mix(in srgb, var(--accent) 6%, var(--surface-2)); border: 1px solid var(--line); border-radius: 10px; }
#view:has(.subtabs) .sh-spark i { background: color-mix(in srgb, var(--accent) 45%, var(--surface-2)); }
#view:has(.subtabs) .sh-spark i:last-child { background: var(--accent); }
#view:has(.subtabs) .sh-rows { margin-top: 14px; padding-top: 9px; }
#view:has(.subtabs) .sh-row { padding: 6px 0; }
#view:has(.subtabs) .sh-wk { color: var(--ink-faint); font-size: 11px; }
#view:has(.subtabs) .sh-sets { color: var(--ink-soft); font-size: 11.5px; }
#view:has(.subtabs) .hero-pace {
  position: relative; overflow: hidden; padding: 22px 20px;
  background: linear-gradient(145deg, var(--activity-tint), var(--surface) 70%);
  border-color: var(--activity-edge); border-radius: 22px; box-shadow: var(--shadow), inset 3px 0 0 var(--accent);
}
#view:has(.subtabs) .hero-pace .lab { color: var(--ink-soft); font-size: 11px; font-weight: 700; letter-spacing: 0.055em; text-transform: uppercase; }
#view:has(.subtabs) .hero-pace .p { margin: 8px 0 4px; color: var(--ink); font-size: 42px; font-weight: 780; letter-spacing: -0.045em; line-height: 1; }
#view:has(.subtabs) .hero-pace .p small { color: var(--ink-faint); font-size: 14px; }
#view:has(.subtabs) .hero-pace .s { max-width: 30ch; margin-top: 8px; color: var(--ink-soft); line-height: 1.45; }
#view:has(.subtabs) .dim-card {
  padding: 17px; background: linear-gradient(165deg, var(--surface), color-mix(in srgb, var(--surface-2) 32%, var(--surface)));
  border-color: color-mix(in srgb, var(--line) 86%, var(--accent)); border-radius: 17px; box-shadow: var(--shadow);
}
#view:has(.subtabs) .dim-card .lab { color: var(--ink); font-size: 14px; font-weight: 720; }
#view:has(.subtabs) .dim-card .read { color: var(--rc, var(--accent)); font-weight: 700; }
#view:has(.subtabs) .dmeter { gap: 5px; margin-top: 12px; }
#view:has(.subtabs) .dmeter i { height: 6px; border: 0; border-radius: 999px; }
#view:has(.subtabs) h2.sec { position: relative; margin: 24px 2px 10px; padding-left: 12px; color: var(--ink); font-size: 15px; font-weight: 730; }
#view:has(.subtabs) h2.sec::before { content: ""; position: absolute; top: 50%; left: 0; width: 4px; height: 16px; background: var(--accent); border-radius: 999px; transform: translateY(-50%); }
#view:has(.subtabs) .mas-zone { padding: 11px 13px; background: color-mix(in srgb, var(--accent) 5%, var(--surface-2)); border-left-color: var(--accent); border-radius: 0 11px 11px 0; }
@media (max-width: 360px) {
  #view:has(.subtabs) .subtabs button { padding-inline: 4px; font-size: 11.5px; }
  #view:has(.subtabs) .rc-map { height: 124px; }
  #view:has(.subtabs) .runcard .act { padding-inline: 15px 12px; }
  #view:has(.subtabs) .act .m > div { padding-inline: 6px; }
  #view:has(.subtabs) .act .m b { font-size: 12.5px; }
  #view:has(.subtabs) .sh-spark { width: 58px; }
  #view:has(.subtabs) .hero-pace .p { font-size: 37px; }
}

/* Bottom navigation — refined full-width app bar (global), with a live Today date icon */
.bottomnav {
  position: sticky; bottom: 0; z-index: 20;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0;
  width: 100%; margin: 0; padding: 5px 8px calc(5px + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border: 0; border-top: 1px solid color-mix(in srgb, var(--line) 88%, var(--accent)); border-radius: 0;
  box-shadow: 0 -12px 28px -26px color-mix(in srgb, var(--ink) 45%, transparent);
  backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%);
}
.navbtn {
  position: relative; min-width: 0; min-height: 53px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  padding: 6px 2px 5px; color: var(--ink-faint); background: transparent; border: 0; border-radius: 10px;
  font: inherit; cursor: pointer; transition: color 150ms ease, transform 120ms ease;
}
.navbtn::before {
  content: ""; position: absolute; top: -5px; left: 50%; width: 24px; height: 2px;
  background: var(--accent); border-radius: 0 0 999px 999px; opacity: 0;
  transform: translateX(-50%) scaleX(0.45); transition: opacity 150ms ease, transform 150ms ease;
}
.navbtn.on::before { opacity: 1; transform: translateX(-50%) scaleX(1); }
.navbtn svg { width: 22px; height: 22px; flex: none; stroke-width: 1.9; transition: transform 150ms ease; }
/* Dynamic Today calendar icon (drawn with borders + pseudo-elements; number is today's date) */
.nav-date {
  position: relative; width: 22px; height: 21px; flex: none;
  display: flex; align-items: flex-end; justify-content: center; padding-bottom: 3px;
  color: currentColor; border: 1.8px solid currentColor; border-radius: 5px;
}
.nav-date::before { content: ""; position: absolute; top: 5px; left: 0; right: 0; height: 1.5px; background: currentColor; }
.nav-date::after { content: ""; position: absolute; top: -3px; left: 5px; width: 2px; height: 5px; background: currentColor; border-radius: 999px; box-shadow: 8px 0 0 currentColor; }
.nav-date-day { position: relative; font-size: 8.5px; font-weight: 780; letter-spacing: -0.06em; line-height: 1; }
.navbtn .nl { overflow: hidden; max-width: 100%; color: currentColor; font-size: 10px; font-weight: 620; letter-spacing: -0.012em; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.navbtn.on { color: var(--accent); }
.navbtn.on svg { transform: translateY(-1px); }
.navbtn.on .nl { font-weight: 750; }
.navbtn:active { transform: scale(0.97); }
.navbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 360px) {
  .bottomnav { padding-inline: 4px; }
  .navbtn { min-height: 51px; padding-inline: 1px; }
  .navbtn .nl { font-size: 9px; }
  .navbtn svg, .nav-date { width: 21px; }
}
@media (prefers-reduced-motion: reduce) {
  #view:has(.subtabs) .subtabs button, #view:has(.subtabs) .runcard, .navbtn, .navbtn::before, .navbtn svg { transition: none; }
}
/* Today — scrollable week band (above the day strip) + weekly overview (below the squares) */
.wk-head { display: flex; justify-content: center; margin: 2px 2px 10px; }
.wk-label { text-align: center; line-height: 1.15; }
.wk-label b { display: block; font-size: 13.5px; font-weight: 750; color: var(--ink); letter-spacing: -.01em; }
.wk-label span { font-size: 11.5px; color: var(--ink-faint); }
/* The band reuses .weekstrip's card look but scrolls horizontally, one full-width week per snap page.
   Horizontal padding lives on the pages (not the scroll container) so each page fills the viewport
   exactly — otherwise the next week peeks in and the snap looks off. */
#view #weekband { display: flex; grid-template-columns: none; gap: 0; padding: 6px 0; overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
#view #weekband::-webkit-scrollbar { display: none; }
.wkpage { flex: 0 0 100%; box-sizing: border-box; padding: 0 6px; scroll-snap-align: start; display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
.cal-week.ovw { margin-top: 4px; }
.cal-week.ovw .cal-day.is-sel { box-shadow: inset 3px 0 0 var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); }
/* Session reminders sheet */
.iconbtn.rm-on { color: var(--accent); }
.rm-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
.rm-row:first-of-type { border-top: 0; padding-top: 4px; }
.rm-row label { font-size: 14px; font-weight: 600; color: var(--ink); }
.rm-row b { font-size: 14px; font-weight: 650; color: var(--ink); }
.rm-row input[type="time"] { font: inherit; font-size: 15px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; }
.rm-row input[type="time"]:disabled { opacity: .5; }
.rm-switch { position: relative; width: 46px; height: 28px; flex: 0 0 auto; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); cursor: pointer; padding: 0; transition: background .15s ease, border-color .15s ease; }
.rm-switch.on { background: var(--accent); border-color: var(--accent); }
.rm-knob { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s ease; }
.rm-switch.on .rm-knob { transform: translateX(18px); }
.rm-test { display: block; width: 100%; margin-top: 14px; font: inherit; font-size: 13.5px; color: var(--ink-soft); background: none; border: 0; text-decoration: underline; cursor: pointer; }
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
const BRAND_SVG = ${JSON.stringify(BRAND_MARK)};
const EX_ANIM = ${JSON.stringify(exAnimData)};
const ICON = {
  gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19a8 8 0 1 1 16 0"/><path d="M13.4 12.6 18 8"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg>',
  guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8" r=".6" fill="currentColor"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4"/></svg>',
  trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><circle cx="12" cy="14" r="8"/><path d="M12 14V10"/></svg>',
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
const DEFAULT_PROFILE = { name: "", avatar: "", status: "regular", goalDist: "half", targetS: 6300, raceDate: futureIso(245), startDateIso: "", longRunDay: 6, fitSrc: "recent", recentDistM: 5000, recentTimeS: 1500, noRecent: false, easyPaceS: 0, oneKmS: 255, daysPerWeek: 5, yearsRunning: 3, weeklyVolumeKm: 30, age: 38, sex: "", strength: true, returning: false, personalized: false };

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
  let experience = expByStatus[pf.status] || (pf.noRecent ? "beginner" : "recreational");
  // A "building" runner who calibrated a genuinely capable easy pace (≈ sub-33:00 5 km-equivalent) is
  // fit, just infrequent — give them the proper structured plan at their real paces rather than the
  // couch-to-5k build. The "returning from a break" toggle keeps the early weeks conservative.
  if (pf.status === "building" && !pf.noRecent && pf.recentTimeS < 1980) experience = "recreational";
  // The plan is built off the strongest current-fitness signal. When a 1 km trial is given and it
  // projects a faster 5 km than the 5 km source, it anchors the whole plan — every pace derives from
  // it — not just the VO₂ interval band. oneKmTrialSeconds is still passed so the VO₂ paces stay
  // precisely MAS-anchored and feasibility stays consistent.
  let recent = { distanceMeters: 5000, timeSeconds: pf.recentTimeS };
  if (pf.oneKmS > 0) {
    const proj5k = Math.round(RC.riegelPredict(1000, pf.oneKmS, 5000));
    if (proj5k < recent.timeSeconds) recent = { distanceMeters: 5000, timeSeconds: proj5k };
  }
  const ath = { daysPerWeek: pf.daysPerWeek, recent, experience, includeStrength: pf.strength, returningFromInjury: pf.returning, runWalk: pf.status === "new", longRunDay: pf.longRunDay != null ? pf.longRunDay : 6 };
  if (pf.oneKmS > 0) ath.oneKmTrialSeconds = pf.oneKmS;
  const startDateIso = (pf.startDateIso && pf.startDateIso >= todayIso()) ? pf.startDateIso : todayIso();
  const goal = { distance: pf.goalDist, targetTimeSeconds: pf.targetS, raceDateIso: pf.raceDate, startDateIso };
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

const state = { tab: "today", screen: null, dayType: "quality", subj: { soreness: "none", energy: "good", stress: "low", motivation: "high", illness: "none" }, planWeek: PLAN.defaultWeekIndex, actTab: "performance", support: null, logged: loadRuns(), weather: "hot", wx: null, fitSuggest: loadFitSuggest(), trialPending: false, trialSaved: null, done: {}, dayOverride: {}, selDay: 4, selWeek: 0 };
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
// The week the top calendar strip is currently showing. selWeek is a 0-based array index into
// PLAN/RAW.weeks; week 0 is the current ("this") week. Clamped so a regenerated (shorter) plan
// can't leave us pointing off the end.
function curWeekIdx() { return Math.max(0, Math.min(state.selWeek, PLAN.weeks.length - 1)); }
function curWeek() { return PLAN.weeks[curWeekIdx()]; }
function curWeekNo() { return curWeek().index; } // 1-based week number, for done keys / data-oweek
function isCurrentWeek() { return curWeekIdx() === 0; }
// Sessions on the selected day of the selected week, honouring reschedules; primary run first.
function sessionsOnSelectedDay() {
  return RAW.weeks[curWeekIdx()].sessions.filter((s) => s.type !== "rest" && effDay(s) === state.selDay)
    .sort((a, b) => (PRIMARY_TYPES[b.type] || 0) - (PRIMARY_TYPES[a.type] || 0));
}
function selectedSession() { return sessionsOnSelectedDay()[0] || null; }
// Back-compat: the live-session start reads the featured session.
function rawToday() { return selectedSession() || RAW.weeks[0].sessions.find((s) => s.type !== "rest") || RAW.weeks[0].sessions[0]; }
// The striking hero card for the selected day's main session.
function heroWorkout() {
  const day = state.selDay;
  const isToday = isCurrentWeek() && day === TODAY_DOW;
  const eyebrow = isToday ? "Today’s workout" : DAY_ORDER[day] + " " + dmon(isoAdd(curWeek().startIso, day));
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
  return '<div class="hero-wk tap" id="todayCard" style="--c:var(--eff-' + eff + ')" data-open="1" data-oweek="' + curWeekNo() + '" data-oid="' + s.id + '">' +
    '<div class="hw-eyebrow">' + eyebrow + '</div>' +
    '<div class="hw-title">' + esc(s.title) + '</div>' +
    '<div class="hw-chips">' + chips.join("") + '</div>' + extra +
    '<div class="hw-go">View full session <span>›</span></div>' +
    '<div class="hw-glow"></div></div>';
}
// The top calendar: a centred week label over a horizontally-scrollable band. Each week is a full-
// width snap page of 7 days; scroll/swipe the band to move through the plan (no arrows). The label,
// hero and overview follow whichever week the band settles on (wired in wire()).
let wbandScrollT = null;
function wkLabelInner(wi) {
  const w = Math.max(0, Math.min(wi, PLAN.weeks.length - 1));
  const wk = PLAN.weeks[w];
  const range = dmon(isoAdd(wk.startIso, 0)) + " – " + dmon(isoAdd(wk.startIso, 6));
  return '<b>' + (w === 0 ? "This week" : "Week " + wk.index) + '</b><span>' + range + '</span>';
}
function weekStrip() {
  const pages = PLAN.weeks.map((wk, wi) => {
    const cur = wi === 0;
    const days = DAY_ORDER.map((d, i) => {
      const dt = isoAdd(wk.startIso, i);
      const has = wk.sessions.some((s) => s.type !== "rest" && effDay(s) === i);
      const eff = (wk.sessions.find((s) => s.type !== "rest" && effDay(s) === i) || {}).effort;
      const cls = "d" + (i === state.selDay ? " sel" : "") + (cur && i === TODAY_DOW ? " today" : "");
      return '<button class="' + cls + '" data-week="' + wi + '" data-day="' + i + '"><div class="dn">' + d + '</div><div class="dd">' + dt.getUTCDate() + '</div>' + (has ? '<div class="dot" style="background:var(--eff-' + (eff || "easy") + ')"></div>' : '<div class="dot" style="background:transparent"></div>') + '</button>';
    }).join("");
    return '<div class="wkpage">' + days + '</div>';
  }).join("");
  return '<div class="wk-head"><div class="wk-label" id="wkLabel">' + wkLabelInner(curWeekIdx()) + '</div></div>' +
    '<div class="weekstrip" id="weekband">' + pages + '</div>';
}
// The weekly overview shown on Today, under the summary squares: the selected week's UPCOMING
// sessions — rest days are omitted, and on the current week only today-onward is shown. Tap a session
// to open its detail; tap its check to toggle done. Reflects whichever week the band is scrolled to.
function weeklyOverview() {
  const wk = curWeek();
  const cur = isCurrentWeek();
  const days = [];
  DAY_ORDER.forEach((dn, i) => {
    if (cur && i < TODAY_DOW) return;                                   // past days aren't "upcoming"
    const ds = wk.sessions.filter((s) => s.type !== "rest" && effDay(s) === i); // drop rest days
    if (ds.length) days.push({ i: i, dn: dn, ds: ds });
  });
  let n = 0, km = 0;
  days.forEach((g) => g.ds.forEach((s) => { n++; if (s.distKm) km += s.distKm; }));
  const rows = days.map((g) => {
    const dt = isoAdd(wk.startIso, g.i);
    const cls = "cal-day" + (cur && g.i === TODAY_DOW ? " is-today" : "") + (g.i === state.selDay ? " is-sel" : "");
    const cells = g.ds.map((s) => calSessionRow(wk.index, s)).join("");
    return '<div class="' + cls + '"><div class="cal-dcol"><div class="cal-dn">' + g.dn.toUpperCase() + '</div><div class="cal-dd">' + dt.getUTCDate() + '</div></div><div class="cal-scol">' + cells + '</div></div>';
  }).join("");
  const phase = wk.phase ? '<span class="cal-badge">' + esc(String(wk.phase).toUpperCase()) + (wk.isDeload ? " · DELOAD" : "") + '</span>' : "";
  const summary = n ? (n + (n === 1 ? " session" : " sessions") + (km > 0 ? " · " + km.toFixed(1) + " km" : "")) : "";
  const head = '<div class="cal-whead"><div class="cal-wtitle">' + (cur ? "This week" : "Week " + wk.index) + " " + phase + '</div><div class="cal-wtot">' + summary + '</div></div>';
  const body = rows || '<div class="cal-empty" style="padding:14px 16px">Nothing left this week — recover well.</div>';
  return '<h2 class="sec">' + (cur ? "Upcoming this week" : "Week " + wk.index) + '</h2><div class="cal-week ovw">' + head + body + '</div>';
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
  const onToday = isCurrentWeek() && state.selDay === TODAY_DOW;
  let cta = "";
  if (sess && onToday && PRIMARY_TYPES[sess.type]) cta = '<button class="primary start-btn" id="startSession">' + ICON.play + ' Start session</button>';
  else if (sess) cta = '<button class="primary start-btn" id="viewSession">' + ICON.play + ' View session</button>';
  return banner + fitSuggestBanner() + greeting + weekStrip() +
    heroWorkout() +
    cta +
    '<div class="tsq-row">' + conditionsSquare(sess) + feelSquare() + '</div>' +
    weeklyOverview();
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

// ---- Session reminders + calendar export ----------------------------------
// Remind the user of a session on the day they have one. Two mechanisms, because a backend-less PWA
// can't push in the background: in-app notifications (reliable while open / when added to the Home
// Screen) and a calendar export (a native reminder on any phone, even with the app closed).
function loadReminders() { try { const o = JSON.parse(localStorage.getItem("interun_reminders_v1") || "null"); return { enabled: !!(o && o.enabled), time: (o && o.time) || "07:30" }; } catch (e) { return { enabled: false, time: "07:30" }; } }
let REMIND = loadReminders();
function saveReminders() { try { localStorage.setItem("interun_reminders_v1", JSON.stringify(REMIND)); } catch (e) {} }
function remindedOn() { try { return localStorage.getItem("interun_reminded_on") || ""; } catch (e) { return ""; } }
function setRemindedOn(d) { try { localStorage.setItem("interun_reminded_on", d); } catch (e) {} }
function notifSupported() { return typeof Notification !== "undefined"; }
function notifPerm() { return notifSupported() ? Notification.permission : "unsupported"; }
function updateBell() { const b = $("bellBtn"); if (b) b.classList.toggle("rm-on", REMIND.enabled && notifPerm() === "granted"); }
function showNotif(title, opts) {
  try { new Notification(title, opts); return; } catch (e) {}
  try { if (navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => {}); } catch (e) {}
}
// Plan sessions that fall on a given real (YYYY-MM-DD) date, primary run first.
function sessionsForIso(iso) {
  for (let wi = 0; wi < PLAN.weeks.length; wi++) {
    const wk = PLAN.weeks[wi];
    for (let i = 0; i < 7; i++) {
      if (isoAdd(wk.startIso, i).toISOString().slice(0, 10) !== iso) continue;
      return wk.sessions.filter((s) => s.type !== "rest" && effDay(s) === i).sort((a, b) => (PRIMARY_TYPES[b.type] || 0) - (PRIMARY_TYPES[a.type] || 0));
    }
  }
  return [];
}
function hmMinutes(t) { const p = String(t || "07:30").split(":"); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }
// Fire today's reminder if there's a session today and we haven't already notified today.
function notifyToday() {
  if (!REMIND.enabled || notifPerm() !== "granted") return;
  const today = todayIso();
  if (remindedOn() === today) return;
  const list = sessionsForIso(today);
  if (!list.length) return;
  const s = list[0], bits = [];
  if (s.durMin) bits.push(s.durMin + " min");
  if (s.distKm) bits.push(s.distKm + " km");
  const more = list.length > 1 ? " (+" + (list.length - 1) + " more)" : "";
  setRemindedOn(today);
  showNotif("Today: " + s.title + more, { body: (bits.length ? bits.join(" \\u00b7 ") + " \\u00b7 " : "") + "Tap to open InteRun.", tag: "interun-session-" + today, icon: "./icon-192.png", badge: "./icon-192.png", data: { url: "./" } });
}
let REMIND_TIMER = null;
// On open: fire now if past the reminder time, else arm a same-day timer (only fires while the app is
// open — a website can't wake itself in the background without a server).
function initReminders() {
  clearTimeout(REMIND_TIMER);
  if (!REMIND.enabled || notifPerm() !== "granted") return;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), due = hmMinutes(REMIND.time);
  if (nowMin >= due) { notifyToday(); return; }
  if (sessionsForIso(todayIso()).length) REMIND_TIMER = setTimeout(notifyToday, (due - nowMin) * 60000 + 2000);
}
// ---- Calendar (.ics) export: every planned session on its real date, with a morning alarm ----
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function icsDate(dt) { return "" + dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate()); }
function icsStamp() { const d = new Date(); return "" + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z"; }
function icsTrigger() { const m = hmMinutes(REMIND.time), h = Math.floor(m / 60), mm = m % 60; return "PT" + (h > 0 ? h + "H" : "") + (mm > 0 || h === 0 ? mm + "M" : ""); }
function icsEsc(s) { return String(s == null ? "" : s).split(";").join("\\\\;").split(",").join("\\\\,"); }
function buildSessionsIcs() {
  const stamp = icsStamp(), trig = icsTrigger();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//InteRun//Training//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:InteRun sessions"];
  PLAN.weeks.forEach((wk) => {
    wk.sessions.filter((s) => s.type !== "rest").forEach((s) => {
      const dt = isoAdd(wk.startIso, effDay(s)), bits = [];
      if (s.durMin) bits.push(s.durMin + " min");
      if (s.distKm) bits.push(s.distKm + " km");
      if (s.pace) bits.push(s.pace);
      lines.push("BEGIN:VEVENT", "UID:interun-" + wk.index + "-" + (s.id || (icsDate(dt) + "-" + s.type)) + "@interun.app", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + icsDate(dt), "SUMMARY:" + icsEsc("InteRun \\u2014 " + s.title), "DESCRIPTION:" + icsEsc(bits.join(" \\u00b7 ") || "Training session"), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(s.title), "TRIGGER;RELATED=START:" + trig, "END:VALARM", "END:VEVENT");
    });
  });
  lines.push("END:VCALENDAR");
  return lines.join("\\r\\n") + "\\r\\n";
}
function downloadIcs() {
  const ics = buildSessionsIcs();
  try {
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "interun-sessions.ics";
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 1500);
  } catch (e) { try { window.open("data:text/calendar;charset=utf-8," + encodeURIComponent(ics)); } catch (e2) {} }
}
// ---- Reminders sheet (opened from the top-bar bell) ----
function remindersSheetHtml() {
  const perm = notifPerm(), supported = notifSupported(), on = REMIND.enabled && perm === "granted";
  const note = !supported
    ? "Your browser can\\u2019t show notifications here \\u2014 add InteRun to your Home Screen, or just use the calendar below."
    : perm === "denied" ? "Notifications are blocked for this site in your settings \\u2014 allow them there, then switch this on." : "";
  const toggle = '<button class="rm-switch' + (on ? " on" : "") + '" id="rmToggle" role="switch" aria-checked="' + (on ? "true" : "false") + '" aria-label="Toggle session reminders"><span class="rm-knob"></span></button>';
  return '<div class="sd-type" style="--sc:var(--accent)">Session reminders</div>' +
    '<div class="sd-title">Get reminded on session days</div>' +
    '<div class="rm-row"><div><b>In-app notifications</b><div class="sd-desc" style="margin:2px 0 0">A nudge on the days you have a session.</div></div>' + toggle + '</div>' +
    '<div class="rm-row"><label for="rmTime">Reminder time</label><input type="time" id="rmTime" value="' + REMIND.time + '"' + (on ? "" : " disabled") + '></div>' +
    (note ? '<div class="sd-desc" style="margin-top:8px">' + note + '</div>' : "") +
    '<div class="sd-desc" style="margin-top:10px;font-size:12.5px;color:var(--ink-faint)">A web app can only notify reliably while it\\u2019s open (or added to your Home Screen). For an alert that reaches you with InteRun closed, add your sessions to your calendar below \\u2014 it works on any phone.</div>' +
    '<div class="sd-move" style="margin-top:14px"><div class="sd-move-h">Add sessions to your calendar</div>' +
    '<div class="sd-desc" style="margin:2px 0 10px">Puts every planned session in your phone\\u2019s calendar with a reminder at your chosen time \\u2014 a native alert on the day, even if InteRun is closed.</div>' +
    '<button class="primary" id="rmIcs" style="width:100%">' + ICON.cal + ' Add to calendar</button></div>' +
    (supported && perm === "granted" ? '<button class="rm-test" id="rmTest">Send a test notification</button>' : "");
}
function openRemindersSheet() { ensureSheet(); SHEET_CTX = null; $("sheetBody").innerHTML = remindersSheetHtml(); wireRemindersSheet(); $("sheetOv").classList.add("on"); }
function wireRemindersSheet() {
  const rerender = () => { $("sheetBody").innerHTML = remindersSheetHtml(); wireRemindersSheet(); };
  const commit = () => { saveReminders(); initReminders(); updateBell(); rerender(); };
  const tog = $("rmToggle");
  if (tog) tog.onclick = () => {
    if (REMIND.enabled) { REMIND.enabled = false; commit(); return; }
    if (!notifSupported()) { rerender(); return; }
    const p = notifPerm();
    if (p === "granted") { REMIND.enabled = true; commit(); }
    else if (p === "denied") { rerender(); }
    else { Notification.requestPermission().then((res) => { REMIND.enabled = (res === "granted"); commit(); }); }
  };
  const time = $("rmTime"); if (time) time.onchange = () => { REMIND.time = time.value || "07:30"; saveReminders(); initReminders(); };
  const ics = $("rmIcs"); if (ics) ics.onclick = downloadIcs;
  const test = $("rmTest"); if (test) test.onclick = () => showNotif("InteRun test reminder", { body: "This is how your session reminders will look.", tag: "interun-test", icon: "./icon-192.png", data: { url: "./" } });
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
// The exercise demonstration: a looping WebP animation when one exists for this exercise, otherwise
// the schematic two-pose figure. Takes the exercise object so it can read its animation slug.
function exVisual(e) {
  const src = e && e.anim && EX_ANIM[e.anim];
  if (src) return '<img class="ex-webp" src="' + src + '" alt="' + esc(e.name || "") + ' demonstration" loading="lazy" draggable="false">';
  return exAnim(e && e.pattern);
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
  return '<div class="ex"><div class="ex-anim">' + exVisual(e) + '</div>' +
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
  // Chart legend + bars: label each phase (Base/Build/Peak/Taper) so the chart isn't read by colour
  // alone, mark where each phase starts, and give every bar an accessible label.
  const phaseNames = { base: "Base", build: "Build", peak: "Peak", taper: "Taper" };
  const phaseSeq = ["base", "build", "peak", "taper"];
  const phasesInPlan = phaseSeq.filter((ph) => PLAN.weeks.some((w) => w.phase === ph));
  const phaseLegend = phasesInPlan.map((ph) =>
    '<span class="phase-key" style="--phase:' + PHASE[ph] + '"><i aria-hidden="true"></i>' + phaseNames[ph] + '</span>').join("");
  const bars = PLAN.weeks.map((w, i) => {
    const phaseStart = i === 0 || PLAN.weeks[i - 1].phase !== w.phase;
    const h = Math.max(6, Math.round(w.distanceKm / peak * 100));
    const aria = "Week " + w.index + ", " + phaseNames[w.phase] + " phase" + (w.isDeload ? ", deload week" : "") + ", " + w.distanceKm.toFixed(1) + " kilometres";
    return '<button class="bar-btn' + (phaseStart ? " phase-start" : "") + '" data-phase="' + w.phase + '" data-wk="' + w.index + '" aria-label="' + aria + '" aria-pressed="' + (w.index===state.planWeek) + '"><div class="bar' + (w.isDeload?" deload":"") + '" style="height:' + h + '%;--phase:' + PHASE[w.phase] + '"></div><div class="bl">' + w.index + '</div></button>';
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
    '<h2 class="sec">Training block</h2><div class="card"><div class="chart" id="chart">' + bars + '</div><div class="phase-legend">' + phaseLegend + '</div></div>' +
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
function viewActivities() {
  const t = (k, lab) => '<button data-at="' + k + '"' + (state.actTab === k ? ' class="on"' : '') + '>' + lab + '</button>';
  const tabs = '<div class="subtabs">' + t("workouts", "Runs") + t("strength", "Strength") + t("performance", "Performance") + '</div>';
  if (state.actTab === "workouts") {
    // Only real, completed runs — no fabricated history. Blank until the user runs a session.
    if (!state.logged.length) {
      return tabs + '<div class="empty-acts"><div class="ea-ic">' + ICON.today + '</div><div class="ea-h">No runs yet</div><div class="ea-b">Start a session from the <b>Today</b> tab. Once you finish, your runs — with route maps and splits — will appear here.</div></div>';
    }
    const list = state.logged.map((a, i) => {
      const hasRoute = a.route && a.route.length >= 2;
      return '<button class="card runcard" data-runidx="' + i + '">' + (hasRoute ? '<div class="rc-map">' + routeMapSvg(a.route) + '</div>' : '') +
        '<div class="act"><div class="b"><div class="t">' + esc(a.t) + '</div><div class="d">' + esc(a.d || "") + '</div>' +
        '<div class="m"><div><b class="num">' + a.dist + '</b><span>Distance</span></div><div><b class="num">' + a.time + '</b><span>Time</span></div><div><b class="num">' + a.pace + '</b><span>Avg pace</span></div></div></div><div class="rc-arr">›</div></div></button>';
    }).join("");
    return tabs + '<div style="font-size:12.5px;color:var(--ink-faint);margin:0 2px 12px">Your recent runs</div>' + list;
  }
  if (state.actTab === "strength") return tabs + viewStrengthHistory();
  return tabs + viewPerformance();
}
function viewRunDetail() {
  const run = state.logged[state.viewRunIdx];
  if (!run) return '<button class="backbtn" id="runBack">‹ Activities</button><div class="card">Run not found.</div>';
  return '<button class="backbtn" id="runBack">‹ Activities</button>' +
    '<div class="rd-head"><div class="rd-t">' + esc(run.t) + '</div><div class="rd-d">' + esc(run.d || "") + '</div></div>' +
    runOverviewHtml(run);
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
    (byEx[ex.name] = byEx[ex.name] || { name: ex.name, primary: ex.primary, pattern: ex.pattern, anim: ex.anim, instances: [] }).instances.push({ week: wk, sets });
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
    return '<div class="card sh-card"><div class="sh-head"><div class="ex-anim sh-anim">' + exVisual(ex) + '</div>' +
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
  { id: "understand", ic: "guide", c: "var(--accent)", t: "Understanding my sessions", d: "What the numbers in a session mean — with a walkthrough.", interactive: false },
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
  if (id === "understand") return back + understandView();
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
// Reference version of the session guide — a legend, a replay of the interactive walkthrough, and a
// plain-English glossary of every effort level. Users can return here any time.
function understandView() {
  const legend = [
    ["\\u2032", "minutes", "e.g. 8\\u2032 = 8 minutes"],
    ["\\u2033", "seconds", "e.g. 90\\u2033 = 90 seconds"],
    ["\\u00D7", "repeat", "e.g. 4 \\u00D7 = do it four times"],
    ["/", "then recover", "work / recovery, e.g. 8\\u2032 / 2\\u2032"],
    ["m", "metres", "e.g. 800m = 800 metres"],
  ].map((r) => '<div class="leg-row"><span class="leg-sym">' + r[0] + '</span><div><div class="leg-name">' + r[1] + '</div><div class="leg-eg">' + r[2] + '</div></div></div>').join("");
  const efforts = [
    ["Easy", EFFORT_HINT.easy], ["Steady", EFFORT_HINT.steady], ["Threshold / tempo / cruise", EFFORT_HINT.threshold],
    ["VO\\u2082 / hard intervals", EFFORT_HINT.vo2], ["Long run", EFFORT_HINT.long], ["Strides / pickups", EFFORT_HINT.strides], ["Recovery / jog", EFFORT_HINT.recovery],
  ].map((r) => '<div class="gloss-row"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join("");
  return '<h2 class="sec" style="margin-top:0">Understanding my sessions</h2>' +
    '<div class="card"><div class="guide-body"><p>Every session is written in a short, consistent shorthand. Read it left to right: <b>how many</b> \\u00D7 <b>how long/far</b> at an <b>effort</b>, then the <b>recovery</b>.</p></div>' +
    '<div class="ex-chip">' + esc(GUIDE_EXAMPLE) + '</div>' +
    '<button class="mini-btn" id="guideReplay" style="margin-top:12px">' + ICON.guide + ' Walk me through an example</button></div>' +
    '<div class="card" style="margin-top:12px"><div class="subhead" style="margin-top:0">The symbols</div>' + legend + '</div>' +
    '<div class="card" style="margin-top:12px"><div class="subhead" style="margin-top:0">The effort levels</div><div class="gloss">' + efforts + '</div></div>';
}
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
const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function dayOpts(sel) { const s = sel != null ? Number(sel) : 6; return DAY_NAMES_FULL.map((d, i) => '<option value="' + i + '"' + (i === s ? " selected" : "") + '>' + d + '</option>').join(""); }
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
// A numbered section card — the numbered badge + title makes each step obvious and the page premium.
function setupSection(num, title, sub, body) {
  return '<div class="card setup-card" style="margin-top:12px"><div class="sec-head"><div class="sec-num">' + num + '</div>' +
    '<div><div class="sec-title">' + title + '</div>' + (sub ? '<div class="sec-sub">' + sub + '</div>' : '') + '</div></div>' + body + '</div>';
}
// The voice-coach settings block (lives in the profile/settings screen). Reads/writes COACH.cfg live —
// independent of the plan save — so changes take effect immediately.
function coachSettingsHtml() {
  const c = COACH.cfg, on = !!c.enabled;
  const cards = RC.COACH_IDS.map((id) => {
    const co = RC.COACHES[id], sel = c.coach === id;
    return '<div class="coachcard' + (sel ? " on" : "") + '" data-coach="' + id + '" role="button" tabindex="0">' +
      '<div class="cc-top"><div class="cc-name">' + co.name + '</div>' +
      '<span class="cc-preview" data-preview="' + id + '" role="button" tabindex="0">' + ICON.play + ' Preview</span></div>' +
      '<div class="cc-tag">' + co.tagline + '</div><div class="cc-desc">' + co.description + '</div></div>';
  }).join("");
  return '<div class="q" style="margin-top:0"><label>Spoken coaching <span class="q-hint">a voice coaches you through live sessions</span></label>' +
      seg("coach_on", [["1", "On"], ["0", "Off"]], on ? "1" : "0") + '</div>' +
    '<div id="coachOpts"' + (on ? "" : ' style="display:none"') + '>' +
      '<div class="q"><label>Your coach</label><div class="coachcards">' + cards + '</div></div>' +
      '<div class="q"><label>Coaching volume</label><input type="range" class="vol" id="coach_vol" min="0" max="100" step="5" value="' + Math.round((c.volume ?? 0.9) * 100) + '" aria-label="Coaching volume"></div>' +
      '<div class="q"><label>How much talking? <span class="q-hint">how chatty your coach is</span></label>' +
        seg("coach_freq", [["minimal", "Minimal"], ["normal", "Balanced"], ["chatty", "Chatty"]], c.frequency || "normal") + '</div>' +
      '<div class="coach-note">Your chosen coach downloads once (about 1 MB) so it works offline after that. Prompts play while the screen is on and the app is open; like other web apps, audio is limited when the phone is locked or the app is in the background.</div>' +
    '</div>';
}
function viewSetup() {
  const p = profile;
  const savedMsg = state.trialSaved ? '<div class="plan-note" style="border-left-color:var(--accent);margin:2px 2px 12px">✓ 1 km time trial saved: <b>' + state.trialSaved + '</b>. Your VO₂/interval paces are now anchored to it.</div>' : "";
  const intro = '<div class="setup-intro"><h2>' + (p.personalized ? (p.name ? p.name + "\\u2019s profile" : "Your profile") : "Let\\u2019s build your plan") + '</h2><p>' + (p.personalized ? "Update anything below and we\\u2019ll rebuild your plan." : "A few quick questions — this shapes every pace and session.") + '</p></div>';

  // 1 · You
  const secYou =
    '<div class="avatar-row"><div class="avatar-pic" id="avatarPic">' + avatarInner(p) + '</div>' +
    '<div><button class="avatar-cta" id="avatarBtn" type="button">' + (p.avatar ? "Change photo" : "\\uD83D\\uDCF7 Add photo") + '</button><div class="avatar-hint">Shows in your top-bar icon.</div></div></div>' +
    '<input type="file" id="s_avatar_file" accept="image/*" style="display:none">' +
    '<div class="q" style="margin-top:16px"><label>Your name</label><input class="sel" id="s_name" value="' + (p.name || "").replace(/"/g, "&quot;") + '" placeholder="What should we call you?" autocomplete="name"></div>';

  // 2 · Your running (status gates the fitness inputs)
  const secRunning =
    '<div class="q" style="margin-top:0"><label>What\\u2019s your current running status?</label>' + statusCards(p.status || "regular") + '</div>' +
    '<div class="q" id="statusBegNote"' + (p.status === "new" ? '' : ' style="display:none"') + '><div class="mas-hint"></div></div>' +
    // Fitness ≠ frequency: a "building the habit" runner can be genuinely fit but just not running
    // often. This callout makes the optional pace calibration obvious and inviting to fill in.
    '<div id="buildingCalib" class="callout"' + (p.status === "building" ? "" : ' style="display:none"') + '>' +
    '<div class="callout-h"><span class="ic">' + ICON.gauge + '</span>Set your easy pace<span class="callout-badge">optional</span></div>' +
    '<p>Already fairly fit? Enter a pace you can comfortably <b>chat at</b> and every training pace scales to you. Leave it blank and we\\u2019ll start gently and learn as you run.</p>' +
    '<input class="sel num" id="s_easypace" value="' + (p.easyPaceS ? fmtTimeFull(p.easyPaceS) : "") + '" placeholder="e.g. 6:00 / km" inputmode="numeric"></div>' +
    '<div id="statusRunnerBlock"' + (isBeginnerStatus(p.status) ? ' style="display:none"' : '') + '>' +
    '<div class="q"><label>Your 5 km time — a recent result or an estimate?</label>' + seg("fitsrc", [["recent","Recent"],["predicted","Predicted"]], p.fitSrc === "predicted" ? "predicted" : "recent") + '</div>' +
    '<div class="q" id="fitTimeWrap"><label id="fitTimeLbl"><span class="lblmain">' + (p.fitSrc === "predicted" ? "Your predicted 5 km time" : "Your recent 5 km time") + '</span> <span class="q-hint">just type the numbers</span></label><input class="sel num" id="s_rectime" value="' + (p.noRecent ? "" : fmtTimeFull(p.recentTimeS)) + '" placeholder="e.g. 25:00" inputmode="numeric"></div>' +
    '<div class="callout"><div class="callout-h"><span class="ic">' + ICON.timer + '</span>1 km time-trial<span class="callout-badge">optional</span></div>' +
    '<p>A max-effort 1 km sharpens your VO₂ and interval paces — a direct, re-testable measure of fitness.</p>' +
    '<input class="sel num" id="s_1km" value="' + (p.oneKmS ? fmtTimeFull(p.oneKmS) : "") + '" placeholder="e.g. 4:00" inputmode="numeric"><div class="mas-hint" id="masHint"></div><button class="mini-btn" id="s_1km_rec" type="button">⏱ Haven\\'t done one? Record it now</button></div>' +
    '</div>';

  // 3 · Your goal (goalCardInner supplies its own inner markup; keep the id for syncStatus)
  const secGoal = goalCardInner(p.status || "regular", { dist: p.goalDist, date: p.raceDate, target: fmtTimeFull(p.targetS) });

  // 4 · A few details
  const secDetails =
    '<div class="q" style="margin-top:0"><label>How many days a week will you run? <span class="q-hint">we\\u2019ll shape the plan around this</span></label>' + seg("days", [["3","3"],["4","4"],["5","5"],["6","6"],["7","7"]], p.daysPerWeek) + '</div>' +
    '<div class="q"><label>Which day suits your long run? <span class="q-hint">we\\u2019ll build the week around it</span></label><select class="sel" id="s_longday" style="max-width:200px">' + dayOpts(p.longRunDay) + '</select></div>' +
    '<div class="q"><label>When do you want to start? <span class="q-hint">a mid-week start gives a shorter first week</span></label><input class="sel" id="s_startdate" type="date" value="' + (p.startDateIso || todayIso()) + '" min="' + todayIso() + '"></div>' +
    '<div class="q"><label>Age</label><select class="sel" id="s_age" style="max-width:140px">' + ageOpts(p.age) + '</select></div>' +
    '<div class="q"><label>Sex <span class="q-hint">helps tailor advice</span></label><select class="sel" id="s_sex" style="max-width:200px"><option value=""' + (!p.sex?" selected":"") + '>Prefer not to say</option><option value="female"' + (p.sex==="female"?" selected":"") + '>Female</option><option value="male"' + (p.sex==="male"?" selected":"") + '>Male</option></select></div>' +
    '<div class="q"><label>Include strength &amp; conditioning?</label>' + seg("strength", [["1","Yes"],["0","No"]], p.strength?"1":"0") + '</div>' +
    '<div class="q"><label>Returning from injury or a long break?</label>' + seg("returning", [["0","No"],["1","Yes"]], p.returning?"1":"0") + '</div>';

  return savedMsg + intro +
    setupSection(1, "You", "A photo and what to call you", secYou) +
    setupSection(2, "Your running", "So we pitch your paces just right", secRunning) +
    '<div class="card setup-card" id="goalCard" style="margin-top:12px"><div class="sec-head"><div class="sec-num">3</div><div><div class="sec-title">Your goal</div><div class="sec-sub">What you\\u2019re working towards</div></div></div><div id="goalBody">' + secGoal + '</div></div>' +
    setupSection(4, "A few details", "The finishing touches to your plan", secDetails) +
    setupSection(5, "Voice coaching", "Your spoken running coach", coachSettingsHtml()) +
    '<div class="err" id="setupErr" style="display:none;color:var(--rest);font-size:13px;margin:14px 2px 0;font-weight:600"></div>' +
    '<button class="primary" id="saveProfile">' + (p.personalized ? "Update my plan" : "Build my plan") + '</button>' +
    (p.personalized ? '<button class="primary" id="cancelSetup" style="background:var(--surface-2);color:var(--ink-soft);box-shadow:none;margin-top:8px">Cancel</button>' : '') +
    '<div class="setup-foot">You can change any of this later.</div>';
}
// Draft profile from the setup form's current values (may throw on bad times).
function draftFromForm() {
  const mmss = (s) => /^\\d{1,2}:[0-5]\\d$/.test(s) || /^\\d{1,2}:[0-5]\\d:[0-5]\\d$/.test(s);
  // The running status gates the rest. Beginners (new / building) give no times — we seed a gentle
  // baseline and flag noRecent. Runners (regular / competitive) give a recent or predicted 5 km, and
  // may optionally add a 1 km trial to sharpen their VO₂ paces.
  const status = draft.status || "regular";
  const beginner = isBeginnerStatus(status);
  let fitSrc = "beginner", noRecent = true, recentDistM = 5000, recentTimeS, oneKmS = 0, easyPaceS = 0;
  if (beginner) {
    recentTimeS = status === "new" ? 2700 : 2250; // couch-to-5k vs a jogger building consistency
    // A "building" runner can optionally give their easy pace. Fitness ≠ frequency: someone fit but
    // not currently running regularly shouldn't be lumped with the unfit. We back out a 5 km-equivalent
    // from the easy pace (easy bands sit ~92 s/km above threshold; threshold ≈ Riegel-predicted 15 km
    // pace) so every training pace scales to their real ability.
    if (status === "building") {
      const epRaw = ($("s_easypace") ? $("s_easypace").value : "").trim();
      if (epRaw) {
        if (!mmss(epRaw)) throw new Error("Enter your easy pace as minutes:seconds per km, e.g. 6:00.");
        const ep = RC.parseDuration(epRaw);
        if (ep < 210 || ep > 720) throw new Error("That easy pace looks off — enter minutes:seconds per km (e.g. 6:00).");
        easyPaceS = ep;
        recentTimeS = Math.max(600, Math.round((ep - 92) * 4.6822));
        noRecent = false;
      }
    }
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
  const longRunDay = $("s_longday") ? Number($("s_longday").value) : (profile.longRunDay != null ? profile.longRunDay : 6);
  let startDateIso = $("s_startdate") ? $("s_startdate").value : (profile.startDateIso || "");
  if (startDateIso && startDateIso < todayIso()) startDateIso = todayIso();
  if (startDateIso && startDateIso >= raceDate) throw new Error("Your start date needs to be before your race date.");
  return {
    name: ($("s_name") ? $("s_name").value : "").trim().slice(0, 40),
    avatar: draft.avatar != null ? draft.avatar : (profile.avatar || ""),
    status,
    goalDist, targetS, raceDate, startDateIso, longRunDay,
    fitSrc, recentDistM, recentTimeS, noRecent, easyPaceS, oneKmS, daysPerWeek: Number(draft.days), yearsRunning: profile.yearsRunning || 3,
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
  let h = '<div class="q" style="margin-top:0"><label>' + cfg.q + '</label><select class="sel" id="s_dist">' + opts + '</select></div>';
  if (cfg.time) {
    h += '<div class="q"><label>Target time <span class="q-hint">just type the numbers</span></label><input class="sel num" id="s_target" value="' + cur.target + '" inputmode="numeric"></div>';
  } else {
    h += '<div class="q"><div class="mas-hint">No time pressure \\u2014 we\\u2019ll build you up to comfortably finish it. You can set a time goal once you\\u2019re there.</div></div>';
  }
  h += '<div class="q"><label>' + (cfg.time ? "Race date" : "Target date") + '</label><input class="sel" id="s_date" type="date" value="' + cur.date + '"></div>';
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
    // The "new" runner gets a reassuring note; "building" gets the easy-pace callout instead.
    bn.style.display = st === "new" ? "" : "none";
    const note = bn.querySelector(".mas-hint");
    if (note && st === "new") note.textContent = "Perfect — we\\u2019ll start with walk\\u2013run intervals and build your base gently.";
  }
  const bc = $("buildingCalib"); if (bc) bc.style.display = st === "building" ? "" : "none";
  if (!beginner) syncFitSrc();
  // Rebuild the goal card body so its distance options and time field match the status (the numbered
  // section header stays put outside #goalBody).
  const gb = $("goalBody");
  if (gb) {
    const cur = {
      dist: $("s_dist") ? $("s_dist").value : profile.goalDist,
      date: $("s_date") ? $("s_date").value : profile.raceDate,
      target: $("s_target") ? $("s_target").value : fmtTimeFull(profile.targetS),
    };
    gb.innerHTML = goalCardInner(st, cur);
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
// Voices load asynchronously in most browsers — cache them and refresh on the change event.
let VOICES = [];
function loadVoices() { try { VOICES = window.speechSynthesis.getVoices() || []; } catch (e) { VOICES = []; } }
if (VOICE_AVAILABLE) { loadVoices(); try { window.speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (e) {} }
function pickVoice() {
  if (!VOICES.length) loadVoices();
  return VOICES.find((v) => /en[-_]GB/i.test(v.lang)) || VOICES.find((v) => /^en/i.test(v.lang)) || VOICES[0] || null;
}
// Speak a phrase aloud during a run. Best-effort: unsupported browsers / muted state are no-ops.
function speak(text) {
  if (!VOICE_ON || !VOICE_AVAILABLE || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
    u.rate = 1.03; u.pitch = 1; u.volume = 1;
    window.speechSynthesis.resume(); // iOS can leave the queue paused between utterances
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function stopSpeech() { try { if (VOICE_AVAILABLE) window.speechSynthesis.cancel(); } catch (e) {} }
// The runner's first name (from their profile) for personalised coaching, or "" if not set.
function firstName() { const n = (profile.name || "").trim(); return n ? n.split(" ")[0] : ""; }
function nameTail() { const n = firstName(); return n ? ", " + n : ""; }
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
  // session-start and session-complete are spoken explicitly (gesture / finish handler) to avoid
  // doubling and to guarantee the celebratory line lands.
  return null;
}

// ===========================================================================
// Spoken coaching controller — plays pre-generated Kokoro voice clips (one per
// prompt, per coach) at the right session events. Single reused <audio>
// element; a small priority queue prevents overlap; missing/failed audio falls
// back to the device speech engine so coaching degrades gracefully (e.g. inside
// the sandboxed artifact where the clip files aren't served). See
// src/live/coach-prompts.ts for the catalogue and selection logic.
// ===========================================================================
const COACH_STORE = "interun_coach";
function loadCoachCfg() {
  try { const j = JSON.parse(localStorage.getItem(COACH_STORE) || "null"); if (j && j.coach) return j; } catch (e) {}
  // Migrate the old boolean voice flag into the richer config on first run.
  let enabled = true; try { enabled = localStorage.getItem("interun_voice") !== "0"; } catch (e) {}
  return { enabled: enabled, coach: RC.DEFAULT_COACH, volume: 0.9, frequency: "normal" };
}
const COACH = {
  cfg: loadCoachCfg(),
  manifest: null, ready: false, byKey: {},
  audio: null, current: null, queue: [], unlocked: false,
  history: RC.newPromptHistory(), halfwayDone: false, finalDone: false,
  settleDone: false, lastTechAt: -999, highEffortSince: 0,
};
function coachEnabled() { return !!(COACH.cfg && COACH.cfg.enabled); }
function saveCoachCfg() { try { localStorage.setItem(COACH_STORE, JSON.stringify(COACH.cfg)); } catch (e) {} }
function coachAudioEl() {
  if (!COACH.audio) { COACH.audio = new Audio(); COACH.audio.preload = "auto";
    COACH.audio.addEventListener("ended", coachOnEnded); COACH.audio.addEventListener("error", coachFail); }
  return COACH.audio;
}
// Load the clip manifest once. Absent (artifact / not yet deployed) => fallback mode, never an error.
function coachLoadManifest() {
  if (COACH.manifest || COACH.ready) return Promise.resolve();
  return fetch("voices/manifest.json").then((r) => r.ok ? r.json() : null).then((m) => {
    COACH.manifest = m; COACH.ready = true;
    if (m && m.clips) m.clips.forEach((c) => { COACH.byKey[c.coach + "/" + c.id] = c; });
  }).catch(() => { COACH.ready = true; });
}
function coachClip(promptId) { return COACH.byKey[COACH.cfg.coach + "/" + promptId] || null; }
// Unlock audio inside a user gesture (iOS blocks playback until then).
function coachUnlock() {
  if (COACH.unlocked) return; const a = coachAudioEl();
  try { a.muted = true; a.src = "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA"; const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.muted = false; COACH.unlocked = true; }).catch(() => { a.muted = false; }); else { COACH.unlocked = true; a.muted = false; } } catch (e) {}
}
// Warm the browser/SW cache for the selected coach's clips at the start of a session.
function coachPreload() {
  if (!coachEnabled() || !COACH.manifest) return;
  const clips = COACH.manifest.clips.filter((c) => c.coach === COACH.cfg.coach);
  clips.slice(0, 60).forEach((c) => { try { fetch(c.file).catch(() => {}); } catch (e) {} });
}
function coachFrequencyAllows(prompt) {
  const f = COACH.cfg.frequency || "normal";
  if (f === "minimal") return prompt.priority >= 40;          // structure + key moments only
  return true;                                                 // normal / chatty: everything (repeat limits still apply)
}
// Central entry point: fire the best prompt for a trigger, honouring priority, interruption and repeats.
function coachTrigger(trigger, sessionType, nowSec) {
  if (!coachEnabled()) return;
  const p = RC.selectPrompt(trigger, sessionType, nowSec, COACH.history);
  if (!p || !coachFrequencyAllows(p)) return;
  if (COACH.current && !RC.shouldInterrupt(p, COACH.current)) {
    if (COACH.queue.length < 3 && p.priority >= 40) COACH.queue.push(p); // queue only things worth hearing
    return;
  }
  RC.markPlayed(p, nowSec, COACH.history);
  coachPlay(p);
}
function coachPlay(prompt) {
  COACH.current = prompt;
  const clip = coachClip(prompt.id), a = coachAudioEl();
  if (clip) {
    try { a.src = clip.file; a.volume = Math.max(0, Math.min(1, COACH.cfg.volume)); a.currentTime = 0;
      const pr = a.play(); if (pr && pr.catch) pr.catch(coachFail); return; } catch (e) {}
  }
  coachFail(); // no clip entry — degrade to speech (current is set)
}
// Single, idempotent failure handler for a missing clip / failed file / blocked play. Speaks the
// current prompt's text with the device engine so coaching still degrades gracefully (e.g. inside the
// sandboxed artifact, or before the coach has downloaded), then advances the queue. Guarded so a
// play() rejection and an "error" event for the same clip never double-speak.
function coachFail() {
  const p = COACH.current; COACH.current = null;
  if (p && VOICE_AVAILABLE && coachEnabled()) speak(p.text);
  coachDequeue();
}
function coachOnEnded() { COACH.current = null; coachDequeue(); }
function coachDequeue() {
  const next = COACH.queue.shift();
  if (next) { COACH.current = next; coachPlay(next); }
}
function coachStop() {
  COACH.queue = []; COACH.current = null;
  try { if (COACH.audio) { COACH.audio.pause(); } } catch (e) {}
  stopSpeech();
}
function coachResetSession() {
  COACH.history = RC.newPromptHistory(); COACH.halfwayDone = false; COACH.finalDone = false;
  COACH.settleDone = false; COACH.lastTechAt = -999; COACH.highEffortSince = 0; coachStop();
}
// Map a live step's kind + the session type to the right trigger when a step begins.
function coachStepTrigger(stepKind, sessionType) {
  if (stepKind === "warmup") return "warmup-start";
  if (stepKind === "cooldown") return "cooldown-start";
  if (stepKind === "recovery") return "recovery-start";
  if (stepKind === "rep") return "interval-start";
  if (stepKind === "steady") {
    if (sessionType === "threshold" || sessionType === "race-specific") return "tempo-start";
    if (sessionType === "long") return "long-run-settle";
    return "easy-settle";
  }
  return null;
}
// Ambient / milestone checker, called each UI tick with a fresh snapshot.
function coachTick(snap) {
  if (!coachEnabled() || !LIVE || !LIVE.started || LIVE.done) return;
  const t = LIVE.session.type, nowSec = (LIVE.mode === "sim" ? LIVE.vms : liveElapsedMs()) / 1000;
  const target = (LIVE.session.estimatedDurationSeconds || 0);
  // Halfway (by planned duration, once).
  if (!COACH.halfwayDone && target > 120 && snap.elapsedSeconds >= target * 0.5) {
    COACH.halfwayDone = true; coachTrigger("halfway", t, nowSec);
  }
  // Final effort — entering the last step (unless it's a cool-down), once.
  if (!COACH.finalDone && snap.step && snap.step.total > 1 && snap.step.index === snap.step.total - 1 && snap.step.kind !== "cooldown") {
    COACH.finalDone = true; coachTrigger("final-effort", t, nowSec);
  }
  // Periodic technique cue on relaxed running (frequency-gated by selection + repeat window).
  if ((t === "easy" || t === "long" || t === "recovery") && nowSec - COACH.lastTechAt > 240 && snap.elapsedSeconds > 120) {
    COACH.lastTechAt = nowSec; coachTrigger("technique", t, nowSec);
  }
  // Safety: sustained very high effort, only where we actually have heart-rate data + a max.
  const hr = snap.heartRateBpm || (LIVE.mode === "sim" ? Math.round(LIVE.hr) : null);
  const maxHr = profile.maxHr || (profile.age ? 208 - 0.7 * profile.age : 0);
  if (hr && maxHr && hr > maxHr * 0.92) {
    if (!COACH.highEffortSince) COACH.highEffortSince = nowSec;
    else if (nowSec - COACH.highEffortSince > 75) { COACH.highEffortSince = nowSec + 240; coachTrigger("safety-effort", t, nowSec); }
  } else COACH.highEffortSince = 0;
}
// Play a one-off preview of a coach (used by the settings screen). Falls back to device speech.
function coachPreview(coachId) {
  coachUnlock();
  const sample = "prep_1";
  const clip = COACH.byKey[coachId + "/" + sample] || COACH.byKey[coachId + "/start_1"];
  const a = coachAudioEl();
  if (clip) { try { a.src = clip.file; a.volume = Math.max(0, Math.min(1, COACH.cfg.volume)); a.play().catch(() => { if (VOICE_AVAILABLE) speak("Welcome to Inter-run. Let's make today's session count."); }); return; } catch (e) {} }
  if (VOICE_AVAILABLE) speak("Welcome to Inter-run. Let's make today's session count.");
}
// Wire the settings-screen coach controls: coach cards, per-coach preview, and volume.
function wireCoachSettings() {
  coachLoadManifest();
  document.querySelectorAll("[data-coach]").forEach((el) => {
    const pick = () => {
      COACH.cfg.coach = el.dataset.coach; saveCoachCfg();
      document.querySelectorAll("[data-coach]").forEach((x) => x.classList.toggle("on", x === el));
      coachUnlock(); coachLoadManifest().then(coachPreload);
    };
    el.onclick = (e) => { if (e.target.closest("[data-preview]")) return; pick(); };
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
  });
  document.querySelectorAll("[data-preview]").forEach((el) => {
    const go = (e) => { if (e) e.stopPropagation(); coachUnlock(); coachLoadManifest().then(() => coachPreview(el.dataset.preview)); };
    el.onclick = go;
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } };
  });
  const vol = $("coach_vol");
  if (vol) vol.oninput = () => {
    COACH.cfg.volume = Math.max(0, Math.min(1, Number(vol.value) / 100)); saveCoachCfg();
    if (COACH.audio) COACH.audio.volume = COACH.cfg.volume;
  };
}
function startSession() {
  const s = rawToday();
  LIVE = { session: s, rt: new RC.LiveSession(s), mode: null, acquiring: false, gpsErr: null,
    startMs: 0, pausedMs: 0, pauseStart: 0, vms: 0, dist: 0, hr: 105, devSpeed: null, curPace: null, win: [],
    timer: null, ui: null, watchId: null, wakeLock: null, lastLat: null, lastLon: null, acc: null,
    speed: 20, lastStep: -1, quirk: 0, started: false, done: false, completedFull: false, summary: null, kmDone: 0, lastKmMs: 0,
    route: [], splits: [], routeDist: 0, simLat: 0, simLng: 0, simHead: Math.random() * 6.28, elevGain: 0, lastAlt: null };
  state.screen = "live"; render();
}
// True while a session is under way (started, not yet finished) — the app locks onto the live
// screen during this window so a stray tap can't abandon the run.
function liveRunning() { return !!(LIVE && LIVE.started && !LIVE.done); }
// Announce a fresh whole-kilometre split (spoken + logged) as the runner crosses it.
function checkSplits() {
  if (!LIVE || LIVE.mode == null) return;
  const km = Math.floor(LIVE.dist / 1000);
  if (km <= LIVE.kmDone) return;
  LIVE.kmDone = km;
  const now = liveNowMs();
  const splitSec = (now - LIVE.lastKmMs) / 1000;
  LIVE.lastKmMs = now;
  LIVE.splits.push({ km, sec: splitSec });
  // The coach speaks a milestone line (routed from this split cue); the exact split time stays in the
  // on-screen log and overview, so the audio stays concise rather than reading numbers aloud each km.
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
  LIVE.started = true;
  // Prime audio inside the tap gesture — iOS blocks playback until a user-initiated one. Unlock the
  // coach's <audio> element and the speech engine (fallback) here, then greet through the chosen coach.
  if (VOICE_AVAILABLE) loadVoices();
  coachResetSession();
  if (coachEnabled()) {
    coachUnlock();
    coachLoadManifest().then(() => { coachPreload(); coachTrigger("session-prep", LIVE.session.type, 0); });
  }
  render(); // re-render to lock the screen (hide nav + back) now the run is starting
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
// A new GPS fix: accrue real distance only for genuine movement. GPS at a standstill jitters by a
// few metres per fix, and haversine is always positive, so without gating that phantom motion piles
// up. We require the device to report movement (or, when it gives no speed, a step past a noise
// floor scaled to the fix's own accuracy) before adding distance.
function onGpsPos(pos) {
  if (!LIVE || LIVE.mode !== "gps") return;
  const c = pos.coords; LIVE.acc = c.accuracy;
  const good = c.accuracy == null || c.accuracy <= 35;
  LIVE.devSpeed = (c.speed != null && isFinite(c.speed) && c.speed >= 0) ? c.speed : null;
  const movingByDevice = LIVE.devSpeed == null || LIVE.devSpeed > 0.7; // <0.7 m/s ≈ standing
  if (good && movingByDevice && LIVE.rt.getStatus() === "active" && LIVE.lastLat != null) {
    const d = haversine(LIVE.lastLat, LIVE.lastLon, c.latitude, c.longitude);
    const floor = Math.max(2.5, (c.accuracy || 8) * 0.5);
    if (d > floor && d < 80) {
      LIVE.dist += d; LIVE.route.push({ lat: c.latitude, lng: c.longitude });
      // Accumulate elevation gain from the device's altitude, when it reports one (often it doesn't).
      if (c.altitude != null && isFinite(c.altitude)) {
        if (LIVE.lastAlt != null && c.altitude - LIVE.lastAlt > 0.6) LIVE.elevGain += c.altitude - LIVE.lastAlt;
        LIVE.lastAlt = c.altitude;
      }
    }
  }
  if (good) { LIVE.lastLat = c.latitude; LIVE.lastLon = c.longitude; }
}
// Current pace: trust the device's own speed when it's a real running speed; otherwise derive it
// from distance covered over a trailing ~12s window. When neither shows meaningful movement we
// report null → the UI shows "—" instead of a frozen or absurd number.
function currentGpsPace(atMs) {
  if (LIVE.devSpeed != null && LIVE.devSpeed > 0.7) return 1000 / LIVE.devSpeed;
  const w0 = LIVE.win[0];
  if (w0) { const dM = LIVE.dist - w0.d, dS = (atMs - w0.t) / 1000; if (dM > 8 && dS > 2) return dS / (dM / 1000); }
  return null;
}
function gpsUiTick() {
  if (!LIVE || LIVE.mode !== "gps") return;
  const at = liveElapsedMs();
  LIVE.win.push({ t: at, d: LIVE.dist });
  while (LIVE.win.length > 1 && at - LIVE.win[0].t > 12000) LIVE.win.shift();
  let cur = currentGpsPace(at); if (cur && cur > 1200) cur = null; // slower than 20:00/km ⇒ stopped
  LIVE.curPace = cur;
  if (LIVE.rt.getStatus() === "active") {
    const t = { atMs: at, distanceMeters: LIVE.dist };
    if (cur) t.paceSecPerKm = cur;
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
  if (LIVE.done) return viewLiveComplete();
  const s = LIVE.session;
  const running = LIVE.started;
  const controls = running
    ? '<div class="live-controls two"><button class="ctrl" id="lPause">Pause</button><button class="ctrl danger" id="lFinish">End session</button></div>'
    : '<div class="live-controls"><button class="primary" id="lStart">' + ICON.play + ' Start</button></div>';
  return (running ? '' : '<button class="backbtn" id="liveBack">‹ Today</button>') +
    '<div class="card live-hero"><div class="live-hero-top"><div class="eyebrow">Live session · <span id="gpsBadge">' + gpsStatusText() + '</span></div>' +
    '<button class="voice-btn' + (coachEnabled() ? ' on' : '') + '" id="lVoice" aria-label="Toggle voice coaching">' + (coachEnabled() ? ICON.vox : ICON.voxOff) + '</button>' +
    '</div><div class="live-title">' + s.title + '</div>' +
    '<div class="live-metrics"><div><div class="lk">Elapsed</div><div class="lv num" id="lElapsed">0:00</div></div>' +
    '<div><div class="lk">Distance</div><div class="lv num" id="lDist">0.00<small> km</small></div></div></div>' +
    '<div class="live-paces">' +
    '<div><div class="lk">Current</div><div class="lv num none" id="lPace">—</div></div>' +
    '<div><div class="lk">Average</div><div class="lv num" id="lAvg">—</div></div>' +
    '<div><div class="lk">Lap</div><div class="lv num" id="lLap">—</div></div></div></div>' +
    '<div class="card lstep" id="lStepCard"><div class="cnt">Press start when you\\'re ready.</div></div>' +
    controls +
    '<div class="card"><div class="subhead" style="margin-top:0">Coaching cues</div><div class="cuelog" id="lCues"><div style="color:var(--ink-faint);font-size:13px">Cues will appear as you run.</div></div></div>';
}
// Trim a GPS/simulated track to at most ~150 evenly-spaced points for compact storage + a clean map.
function downsampleRoute(route, max) {
  max = max || 150;
  if (!route || route.length <= max) return route ? route.slice() : [];
  const out = []; const step = (route.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(route[Math.round(i * step)]);
  return out;
}
// Draw the recorded route as an SVG, in brand colours, with a marching-ants animated line (an accent
// base plus flowing white dashes) — echoing the Start button. Scales lng by cos(lat) for true shape.
function routeMapSvg(route, proj, vbW, vbH) {
  if (!route || route.length < 2) return '<div class="rt-none">No route was recorded for this run.</div>';
  let xy, W, H, r;
  if (proj) { W = vbW; H = vbH; xy = (p) => proj(p); r = 9; }
  else {
    const lats = route.map((p) => p.lat), lngs = route.map((p) => p.lng);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lngs), maxLo = Math.max(...lngs);
    const cx = Math.cos((minLa + maxLa) / 2 * Math.PI / 180) || 1;
    W = 320; H = 200; const pad = 20;
    const spanLo = Math.max(1e-9, (maxLo - minLo) * cx), spanLa = Math.max(1e-9, maxLa - minLa);
    const scale = Math.min((W - 2 * pad) / spanLo, (H - 2 * pad) / spanLa);
    const ox = (W - spanLo * scale) / 2, oy = (H - spanLa * scale) / 2;
    xy = (p) => [ox + (p.lng - minLo) * cx * scale, oy + (maxLa - p.lat) * scale]; r = 5.5;
  }
  const d = route.map((p, i) => (i ? "L" : "M") + xy(p).map((n) => n.toFixed(1)).join(" ")).join(" ");
  const s = xy(route[0]), e = xy(route[route.length - 1]);
  return '<svg class="routemap" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<path class="rt-base" d="' + d + '"/><path class="rt-ants" d="' + d + '"/>' +
    '<circle class="rt-start" cx="' + s[0].toFixed(1) + '" cy="' + s[1].toFixed(1) + '" r="' + r + '"/>' +
    '<circle class="rt-end" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="' + r + '"/></svg>';
}
// Overview map size (CSS px) — canvas backing store is DPR-scaled for crispness.
const OVMAP_W = 700, OVMAP_H = 420;
// Enhance an .ov-map container with a real street map behind the route (async). If tiles can't load
// (offline / sandbox), the marching-ants fallback already in the container stays.
function buildOverviewMap(container, route) {
  if (!container || !route || route.length < 2) return;
  loadRouteMap(route, OVMAP_W, OVMAP_H, "rastertiles/voyager").then((md) => {
    if (!container.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement("canvas"); cv.width = OVMAP_W * dpr; cv.height = OVMAP_H * dpr;
    cv.className = "ov-mapcv";
    const g = cv.getContext("2d"); g.scale(dpr, dpr);
    g.fillStyle = "#eef1ee"; g.fillRect(0, 0, OVMAP_W, OVMAP_H);
    md.tiles.forEach((t) => { try { g.drawImage(t.img, t.dx, t.dy, MAP_TILE, MAP_TILE); } catch (e) {} });
    const overlay = routeMapSvg(route, md.proj, OVMAP_W, OVMAP_H);
    container.classList.add("ov-light");
    container.innerHTML = "";
    container.appendChild(cv);
    container.appendChild(el('<div class="ov-mapov">' + overlay + '</div>'));
    container.appendChild(el('<div class="ov-attr">© OpenStreetMap contributors © CARTO</div>'));
  }).catch(() => {});
}
function splitsHtml(splits) {
  if (!splits || !splits.length) return "";
  const secs = splits.map((s) => s.sec), max = Math.max(...secs), min = Math.min(...secs);
  const rows = splits.map((s) => {
    const w = 34 + 66 * (max === min ? 1 : (max - s.sec) / (max - min)); // faster km ⇒ longer bar
    const fast = s.sec === min && splits.length > 1;
    return '<div class="sp-row"><span class="sp-k">' + s.km + ' km</span><div class="sp-bar"><i style="width:' + w.toFixed(0) + '%' + (fast ? ";background:var(--accent)" : "") + '"></i></div><span class="sp-v num">' + fmtPace(s.sec) + '</span></div>';
  }).join("");
  return '<div class="card"><div class="subhead" style="margin-top:0">Kilometre splits</div>' + rows + '</div>';
}
// Shared overview: route map + key stats + splits + share. Used by the completion screen and Activities.
function runOverviewHtml(run) {
  const stat = (k, v) => '<div class="ov-stat"><div class="ov-v num">' + v + '</div><div class="ov-k">' + k + '</div></div>';
  return '<div class="card ov-map-card"><div class="ov-map" id="ovMap">' + routeMapSvg(run.route) + '</div>' +
    '<div class="ov-stats">' + stat("Distance", run.dist) + stat("Time", run.time) + stat("Avg pace", run.pace) + '</div></div>' +
    splitsHtml(run.splits) +
    '<button class="primary share-btn" id="shareRun">' + ICON.share + ' Share my run</button>';
}
// ---- Shareable branded run card -------------------------------------------
// The run whose overview is on screen right now (completion screen or Activities detail).
function currentOverviewRun() {
  if (state.screen === "runview") return state.logged[state.viewRunIdx];
  if (LIVE && LIVE.summary) { const sm = LIVE.summary; return { t: LIVE.session.title, d: runDateLabel(), dist: sm.distKm + " km", time: sm.time, pace: (sm.pace || "—") + " /km", route: sm.route, splits: sm.splits, elevGain: sm.elevGain || 0, type: sm.type }; }
  return null;
}
const FF = "-apple-system, system-ui, Roboto, Arial, sans-serif";
const TEAL = "#38ffbe", TEALW = "#16b7a4";
const SHARE_INSIGHT = {
  easy: "Easy effort. Aerobic fitness building exactly as planned.",
  recovery: "Gentle shakeout done. Recovery is where you adapt and grow.",
  long: "Time on feet banked. Endurance and durability are growing.",
  steady: "Strong steady effort. Aerobic power building nicely.",
  threshold: "Threshold work done. Your sustainable pace is climbing.",
  vo2: "Hard intervals in the bag. Top-end fitness is sharpening.",
  "race-specific": "Race-pace rehearsed. You're sharpening for the day.",
  strides: "Easy miles plus fast strides — economy and pop building.",
};
function rr(g, x, y, w, h, r) {
  if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Letter-spaced text (canvas has no native tracking we can rely on cross-browser). Returns width.
function lsText(g, text, x, y, sp, align) {
  let total = 0; for (const ch of text) total += g.measureText(ch).width + sp; total -= sp;
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = g.textAlign; g.textAlign = "left";
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; }
  g.textAlign = prev; return total;
}
function wrapLines(g, text, maxW) {
  const words = text.split(" "), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function drawBrandBadge(g, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size / 120, size / 120);
  g.save(); rr(g, 8, 8, 104, 104, 30); g.shadowColor = "rgba(22,183,164,.55)"; g.shadowBlur = 26; g.shadowOffsetY = 8;
  const grad = g.createLinearGradient(8, 8, 112, 112); grad.addColorStop(0, "#1cc7b2"); grad.addColorStop(1, "#0a6f64");
  g.fillStyle = grad; g.fill(); g.restore();
  const gloss = g.createLinearGradient(0, 8, 0, 70); gloss.addColorStop(0, "rgba(255,255,255,.22)"); gloss.addColorStop(1, "rgba(255,255,255,0)");
  g.save(); rr(g, 8, 8, 104, 104, 30); g.clip(); g.fillStyle = gloss; g.fillRect(8, 8, 104, 62); g.restore();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(82, 37, 11, 0, 7); g.fill();
  g.beginPath(); g.moveTo(35, 88); g.lineTo(57, 45); g.lineTo(71, 45); g.lineTo(49, 88); g.closePath(); g.fill();
  g.globalAlpha = .62; g.beginPath(); g.moveTo(57, 88); g.lineTo(79, 45); g.lineTo(93, 45); g.lineTo(71, 88); g.closePath(); g.fill(); g.globalAlpha = 1;
  g.restore();
}
// Neon glowing route in the reference style: soft glow + bright core gradient, target-ring markers.
// proj (optional) maps a lat/lng to panel pixels so the line aligns with a real map underneath;
// without it we fit the route to the panel with a simple equirectangular projection.
function drawRouteGlow(g, route, x, y, w, h, proj) {
  if (!route || route.length < 2) {
    g.fillStyle = "rgba(200,255,240,.4)"; g.textAlign = "center"; g.font = "500 30px " + FF;
    g.fillText("No route recorded for this run", x + w / 2, y + h / 2); g.textAlign = "left"; return;
  }
  let P;
  if (proj) { P = route.map(proj); }
  else {
    const lats = route.map((p) => p.lat), lngs = route.map((p) => p.lng);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lngs), maxLo = Math.max(...lngs);
    const cxf = Math.cos((minLa + maxLa) / 2 * Math.PI / 180) || 1, pad = 96;
    const spanLo = Math.max(1e-9, (maxLo - minLo) * cxf), spanLa = Math.max(1e-9, maxLa - minLa);
    const scale = Math.min((w - 2 * pad) / spanLo, (h - 2 * pad) / spanLa);
    const ox = x + (w - spanLo * scale) / 2, oy = y + (h - spanLa * scale) / 2;
    P = route.map((p) => [ox + (p.lng - minLo) * cxf * scale, oy + (maxLa - p.lat) * scale]);
  }
  const grad = g.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, "#3dffb0"); grad.addColorStop(1, "#a7ffd8");
  g.lineJoin = "round"; g.lineCap = "round";
  const trace = () => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); };
  g.save(); g.shadowColor = "rgba(45,255,170,.9)"; g.shadowBlur = 36;
  trace(); g.strokeStyle = grad; g.lineWidth = 11; g.stroke(); g.shadowBlur = 22; g.stroke(); g.restore();
  trace(); g.strokeStyle = "#eafff5"; g.lineWidth = 4.5; g.stroke();
  const s = P[0], e = P[P.length - 1];
  g.strokeStyle = "rgba(56,255,190,.45)"; g.lineWidth = 3;
  g.beginPath(); g.arc(s[0], s[1], 24, 0, 7); g.stroke();
  g.globalAlpha = .5; g.beginPath(); g.arc(s[0], s[1], 38, 0, 7); g.stroke(); g.globalAlpha = 1;
  g.save(); g.shadowColor = "rgba(45,255,170,.9)"; g.shadowBlur = 18; g.fillStyle = "#2effb0"; g.beginPath(); g.arc(s[0], s[1], 12, 0, 7); g.fill(); g.restore();
  g.fillStyle = "#06181a"; g.beginPath(); g.arc(s[0], s[1], 5.5, 0, 7); g.fill();
  g.save(); g.shadowColor = "rgba(45,255,170,.9)"; g.shadowBlur = 20; g.fillStyle = "#6bffca"; g.beginPath(); g.arc(e[0], e[1], 14, 0, 7); g.fill(); g.restore();
  g.lineWidth = 5; g.strokeStyle = "#fff"; g.beginPath(); g.arc(e[0], e[1], 14, 0, 7); g.stroke();
  const chip = (px, py, txt) => {
    g.font = "700 22px " + FF; const tw = g.measureText(txt).width, cw = tw + 34, ch = 42;
    let cxp = Math.max(x + 14, Math.min(px - cw / 2, x + w - cw - 14));
    let cyp = Math.max(y + 14, Math.min(py, y + h - ch - 14));
    rr(g, cxp, cyp, cw, ch, 11); g.fillStyle = "rgba(6,22,20,.82)"; g.fill(); g.lineWidth = 2; g.strokeStyle = "rgba(56,255,190,.55)"; g.stroke();
    g.fillStyle = "#c9fff0"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, cxp + cw / 2, cyp + ch / 2 + 1); g.textAlign = "left"; g.textBaseline = "alphabetic";
  };
  chip(s[0], s[1] - 66, "START"); chip(e[0], e[1] - 66, "FINISH");
}
function drawStatIcon(g, kind, cx, cy) {
  g.strokeStyle = TEAL; g.fillStyle = TEAL; g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round";
  if (kind === 0) { // distance / route
    g.beginPath(); g.arc(cx - 9, cy - 7, 5, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - 9, cy - 2); g.quadraticCurveTo(cx + 16, cy - 6, cx + 7, cy + 11); g.stroke();
    g.beginPath(); g.arc(cx + 7, cy + 11, 3.5, 0, 7); g.fill();
  } else if (kind === 1) { // clock
    g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 8); g.moveTo(cx, cy); g.lineTo(cx + 6, cy + 3); g.stroke();
  } else { // speedometer
    g.beginPath(); g.arc(cx, cy + 4, 13, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    g.beginPath(); g.moveTo(cx, cy + 4); g.lineTo(cx + 9, cy - 6); g.stroke();
    g.beginPath(); g.arc(cx, cy + 4, 2.6, 0, 7); g.fill();
  }
}
function drawInsightIcon(g, cx, cy, r) {
  g.strokeStyle = TEAL; g.fillStyle = TEAL; g.lineWidth = 2.5;
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  const n = [[0, -r * 0.5], [-r * 0.42, r * 0.18], [r * 0.42, r * 0.18], [0, r * 0.02]];
  g.beginPath();
  g.moveTo(cx + n[1][0], cy + n[1][1]); g.lineTo(cx + n[3][0], cy + n[3][1]); g.lineTo(cx + n[0][0], cy + n[0][1]);
  g.moveTo(cx + n[3][0], cy + n[3][1]); g.lineTo(cx + n[2][0], cy + n[2][1]); g.stroke();
  n.forEach((p) => { g.beginPath(); g.arc(cx + p[0], cy + p[1], 3, 0, 7); g.fill(); });
}
// ---- Real map tiles (Web Mercator) for the share card ----------------------
const MAP_TILE = 256, MAP_W = 984, MAP_H = 576;
function mercX(lng, z) { return (lng + 180) / 360 * MAP_TILE * Math.pow(2, z); }
function mercY(lat, z) { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * MAP_TILE * Math.pow(2, z); }
function loadTileImage(url) {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    const to = setTimeout(() => rej(new Error("timeout")), 6000);
    img.onload = () => { clearTimeout(to); res(img); };
    img.onerror = () => { clearTimeout(to); rej(new Error("err")); };
    img.src = url;
  });
}
// Load CORS-enabled dark basemap tiles (CARTO/OpenStreetMap) covering the route, plus a projection
// so the route aligns with the streets. Rejects on any failure (offline / sandbox / CORS) so the
// caller can fall back to the grid map.
function loadRouteMap(route, pw, ph, style) {
  pw = pw || MAP_W; ph = ph || MAP_H; style = style || "dark_all";
  return new Promise((resolve, reject) => {
    if (!route || route.length < 2) return reject(new Error("no route"));
    const lats = route.map((p) => p.lat), lngs = route.map((p) => p.lng);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lngs), maxLo = Math.max(...lngs);
    const pad = Math.min(64, pw * 0.1); let z = 18;
    for (; z >= 3; z--) { if (mercX(maxLo, z) - mercX(minLo, z) <= pw - 2 * pad && mercY(minLa, z) - mercY(maxLa, z) <= ph - 2 * pad) break; }
    const originX = mercX((minLo + maxLo) / 2, z) - pw / 2, originY = mercY((minLa + maxLa) / 2, z) - ph / 2;
    const n = Math.pow(2, z), specs = [];
    for (let tx = Math.floor(originX / MAP_TILE); tx <= Math.floor((originX + pw) / MAP_TILE); tx++)
      for (let ty = Math.floor(originY / MAP_TILE); ty <= Math.floor((originY + ph) / MAP_TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n, sub = ["a", "b", "c"][((tx % 3) + 3) % 3];
        specs.push({ url: "https://" + sub + ".basemaps.cartocdn.com/" + style + "/" + z + "/" + wx + "/" + ty + "@2x.png", dx: tx * MAP_TILE - originX, dy: ty * MAP_TILE - originY });
      }
    if (!specs.length || specs.length > 40) return reject(new Error("tile count"));
    Promise.all(specs.map((s) => loadTileImage(s.url).then((img) => ({ img, dx: s.dx, dy: s.dy }))))
      .then((tiles) => resolve({ tiles, proj: (p) => [mercX(p.lng, z) - originX, mercY(p.lat, z) - originY] }))
      .catch(reject);
  });
}
function drawMapPanel(g, run, mx, my, mw, mh, mapData) {
  rr(g, mx, my, mw, mh, 30); g.fillStyle = "#0a1714"; g.fill();
  g.save(); rr(g, mx, my, mw, mh, 30); g.clip();
  if (mapData) {
    mapData.tiles.forEach((t) => { try { g.drawImage(t.img, mx + t.dx, my + t.dy, MAP_TILE, MAP_TILE); } catch (e) {} });
    g.fillStyle = "rgba(4,16,13,.4)"; g.fillRect(mx, my, mw, mh); // dim map for route contrast
    drawRouteGlow(g, run.route, mx, my, mw, mh, (p) => { const q = mapData.proj(p); return [mx + q[0], my + q[1]]; });
  } else {
    g.strokeStyle = "rgba(120,160,150,.06)"; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const yy = my + (i + .5) * mh / 9; g.beginPath(); g.moveTo(mx, yy + Math.sin(i * 1.3) * 14); g.lineTo(mx + mw, yy + Math.cos(i) * 14); g.stroke(); }
    for (let i = 0; i < 6; i++) { const xx = mx + (i + .5) * mw / 6; g.beginPath(); g.moveTo(xx, my); g.lineTo(xx + (i % 2 ? 26 : -26), my + mh); g.stroke(); }
    drawRouteGlow(g, run.route, mx, my, mw, mh, null);
  }
  g.restore();
  rr(g, mx, my, mw, mh, 30); g.lineWidth = 2; g.strokeStyle = "rgba(61,255,176,.5)"; g.stroke();
  let corner = null;
  if (run.elevGain && run.elevGain >= 1) corner = { k: "ELEVATION GAIN", v: "+" + run.elevGain + "m" };
  else if (run.splits && run.splits.length) corner = { k: "FASTEST KM", v: fmtPace(Math.min.apply(null, run.splits.map((s) => s.sec))) };
  if (corner) {
    g.textAlign = "right"; g.fillStyle = "#eafff5"; g.font = "800 34px " + FF; g.fillText(corner.v, mx + mw - 34, my + mh - 56);
    g.fillStyle = "rgba(190,215,205,.6)"; g.font = "600 19px " + FF; lsText(g, corner.k, mx + mw - 34, my + mh - 28, 1.5, "right"); g.textAlign = "left";
  }
  if (mapData) { g.textAlign = "left"; g.fillStyle = "rgba(200,220,210,.32)"; g.font = "500 15px " + FF; g.fillText("© OpenStreetMap © CARTO", mx + 22, my + mh - 20); }
}
// Draw the whole card; mapData (optional) puts the route over a real map instead of the grid.
function buildShareCanvasCore(run, mapData) {
  const W = 1080, H = 1556, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#04100d"; g.fillRect(0, 0, W, H);
  const glowAt = (gx, gy, rad, a) => { const rg = g.createRadialGradient(gx, gy, 0, gx, gy, rad); rg.addColorStop(0, "rgba(30,180,150," + a + ")"); rg.addColorStop(1, "rgba(30,180,150,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H); };
  glowAt(180, 200, 620, .18); glowAt(W - 150, 260, 560, .12); glowAt(W / 2, H - 120, 720, .08);
  // Panel frame — bright green neon piping with a soft glow
  g.save(); rr(g, 20, 20, W - 40, H - 40, 46); g.fillStyle = "rgba(255,255,255,.015)"; g.fill();
  g.shadowColor = "rgba(61,255,176,.5)"; g.shadowBlur = 12; g.lineWidth = 2.5; g.strokeStyle = "rgba(72,255,184,.7)"; g.stroke(); g.restore();
  g.textBaseline = "alphabetic"; g.textAlign = "left";
  drawBrandBadge(g, 56, 92, 116);
  g.font = "800 62px " + FF; g.fillStyle = "#fff"; g.fillText("Inte", 196, 178);
  const iw = g.measureText("Inte").width; g.fillStyle = TEAL; g.fillText("Run", 196 + iw, 178);
  g.fillStyle = "rgba(160,200,190,.65)"; g.font = "600 20px " + FF; lsText(g, "THE INTELLIGENT TRAINING COMPANION", 198, 210, 2.5, "left");
  g.fillStyle = TEAL; g.font = "600 26px " + FF; g.textAlign = "right"; g.fillText("#RunWithInteRun", W - 56, 150); g.textAlign = "left";
  const title = (run.t || "My run").toUpperCase(); let ts = 90; g.font = "800 " + ts + "px " + FF;
  while (g.measureText(title).width > W - 130 && ts > 44) { ts -= 2; g.font = "800 " + ts + "px " + FF; }
  g.fillStyle = "#fff"; g.fillText(title, 56, 322);
  rr(g, 58, 348, 96, 7, 4); g.fillStyle = TEAL; g.fill();
  g.font = "600 28px " + FF; const dparts = (run.d || "").toUpperCase().split("·");
  g.fillStyle = "rgba(190,215,205,.7)"; g.fillText(dparts[0].trim(), 58, 410);
  if (dparts[1]) { const dw = g.measureText(dparts[0].trim() + "  ").width; g.fillStyle = TEAL; g.fillText("· " + dparts[1].trim(), 58 + dw, 410); }
  drawMapPanel(g, run, 48, 452, MAP_W, MAP_H, mapData);
  // Stat cards
  const mx = 48, dParts = (run.dist || "0 km").split(" "), pParts = (run.pace || "— /km").split(" ");
  const stats = [
    { icon: 0, label: "DISTANCE", val: dParts[0], unit: (dParts[1] || "km").toUpperCase() },
    { icon: 1, label: "DURATION", val: run.time || "0:00", unit: "MIN" },
    { icon: 2, label: "AVG PACE", val: pParts[0], unit: (pParts[1] || "/km").toUpperCase() },
  ];
  const sy = 1064, sh = 236, gap = 22, sw = (MAP_W - 2 * gap) / 3;
  stats.forEach((st, i) => {
    const sxp = mx + i * (sw + gap);
    rr(g, sxp, sy, sw, sh, 24); g.fillStyle = "rgba(255,255,255,.03)"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = "rgba(61,255,176,.4)"; g.stroke();
    drawStatIcon(g, st.icon, sxp + 42, sy + 52);
    g.fillStyle = "rgba(180,210,200,.75)"; g.font = "700 20px " + FF; lsText(g, st.label, sxp + 74, sy + 60, 1.5, "left");
    g.strokeStyle = "rgba(61,255,176,.3)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sxp + 30, sy + 84); g.lineTo(sxp + sw - 30, sy + 84); g.stroke();
    g.fillStyle = "#fff"; g.font = "800 72px " + FF; g.fillText(st.val, sxp + 32, sy + 170);
    g.fillStyle = TEAL; g.font = "700 28px " + FF; g.fillText(st.unit, sxp + 32, sy + 208);
  });
  // Insight card
  const iy = 1330, ih = 178;
  rr(g, mx, iy, MAP_W, ih, 24); g.fillStyle = "rgba(255,255,255,.03)"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = "rgba(61,255,176,.42)"; g.stroke();
  drawInsightIcon(g, mx + 92, iy + ih / 2, 40);
  g.fillStyle = TEAL; g.font = "700 22px " + FF; lsText(g, "INTERUN INSIGHT", mx + 168, iy + 56, 2, "left");
  const insight = SHARE_INSIGHT[run.type] || SHARE_INSIGHT.easy;
  g.fillStyle = "#eef7f3"; g.font = "600 36px " + FF;
  wrapLines(g, insight, MAP_W - 168 - 90).slice(0, 2).forEach((ln, i) => g.fillText(ln, mx + 168, iy + 100 + i * 46));
  g.fillStyle = "rgba(61,255,176,.24)"; g.font = "800 150px Georgia, " + FF; g.fillText("\\u201D", mx + MAP_W - 96, iy + 120);
  return c;
}
function buildShareCanvasSync(run) { return buildShareCanvasCore(run, null); }
function buildShareCanvasWithMap(run) { return loadRouteMap(run.route, MAP_W, MAP_H).then((md) => buildShareCanvasCore(run, md)); }
function canvasToPngFile(canvas, name) {
  const dataUrl = canvas.toDataURL("image/png");
  const b64 = dataUrl.split(",")[1], bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: "image/png" });
}
function shareCaption(run) { return "I completed a run with InteRun \\uD83C\\uDFC3 \\u2014 " + run.dist + " in " + run.time + "."; }
// Identity of a run for share-cache purposes.
function shareKey(run) { return (run.t || "") + "|" + (run.d || "") + "|" + (run.dist || "") + "|" + ((run.route && run.route.length) || 0); }
let SHARE = { key: null, file: null };
// Pre-build the (map) card when the overview appears, so the tap can share it synchronously (iOS).
function prepareShareCard(run) {
  if (!run) return; const key = shareKey(run);
  if (SHARE.key === key && SHARE.file) return;
  SHARE = { key: null, file: null };
  buildShareCanvasWithMap(run).then((canvas) => { try { SHARE = { key, file: canvasToPngFile(canvas, "interun-run.png") }; } catch (e) {} }).catch(() => {});
}
function doShareRun() {
  const run = currentOverviewRun(); if (!run) return;
  // Use the pre-built card with the real map if it's ready; otherwise build the instant grid card.
  let file = (SHARE.key === shareKey(run) && SHARE.file) ? SHARE.file : null;
  if (!file) { try { file = canvasToPngFile(buildShareCanvasSync(run), "interun-run.png"); } catch (e) { file = null; } }
  const caption = shareCaption(run);
  const canShareFile = file && navigator.canShare && navigator.canShare({ files: [file] });
  if (canShareFile) {
    navigator.share({ files: [file], text: caption, title: "InteRun" }).catch(() => {});
  } else if (navigator.share) {
    navigator.share({ text: caption, title: "InteRun" }).catch(() => downloadShareCard(file, run));
  } else {
    downloadShareCard(file, run);
  }
}
function downloadShareCard(file, run) {
  if (!file) { try { file = canvasToPngFile(buildShareCanvasSync(run), "interun-run.png"); } catch (e) { return; } }
  const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = "interun-run.png";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function viewLiveComplete() {
  const sm = LIVE.summary || { distKm: "0.00", time: "0:00", pace: "—", saved: false, route: [], splits: [] };
  const run = { dist: sm.distKm + " km", time: sm.time, pace: (sm.pace || "—") + " /km", route: sm.route, splits: sm.splits };
  const controls = sm.saved
    ? '<div class="live-controls"><button class="primary" id="lDone">' + ICON.check + ' View in Activities</button></div>'
    : '<div class="live-controls two"><button class="ctrl" id="lDiscard">Discard</button><button class="primary" id="lSave">' + ICON.check + ' Save session</button></div>';
  return '<div class="card live-hero done-hero"><div class="dn-badge">' + ICON.check + '</div>' +
    '<div class="dn-h">' + (LIVE.completedFull ? "Well done!" : "Session ended") + '</div>' +
    '<div class="dn-sub">' + (LIVE.completedFull ? "You completed " : "You logged ") + esc(LIVE.session.title) + (sm.saved ? " · saved" : "") + '</div></div>' +
    runOverviewHtml(run) +
    controls +
    '<div class="card"><div class="subhead" style="margin-top:0">Coaching cues</div><div class="cuelog" id="lCues"></div></div>';
}
function livePace(step) { const band = step && step.targetPace; const mid = band ? (band.minSecPerKm + band.maxSecPerKm) / 2 : 360; LIVE.quirk += (Math.random() - 0.5) * 0.03; LIVE.quirk *= 0.9; if (Math.random() < 0.04) LIVE.quirk += (Math.random() - 0.5) * 0.28; return Math.max(120, mid * (1 + LIVE.quirk)); }
function liveHr(step) { if (!step) return 105; if (step.kind === "rep") return 176; if (step.kind === "warmup" || step.kind === "cooldown") return 130; if (step.kind === "recovery") return 148; return 150; }
// Route a live event to the chosen coach's spoken prompt (audio), then log it visually below.
function coachRouteCue(cue) {
  if (!coachEnabled() || !LIVE) return;
  const type = LIVE.session.type, nowSec = liveNowMs() / 1000;
  if (cue.kind === "step-start") {
    const snap = LIVE.rt.snapshot(liveNowMs());
    if (snap.step) {
      let trig = coachStepTrigger(snap.step.kind, type);
      if (snap.step.kind === "rep" && /hill/i.test(LIVE.session.title || "")) trig = "hill-start";
      if (trig) coachTrigger(trig, type, nowSec);
    }
  } else if (cue.kind === "split") coachTrigger("milestone-distance", type, nowSec);
  else if (cue.kind === "paused") coachTrigger("paused", type, nowSec);
  else if (cue.kind === "resumed") coachTrigger("resumed", type, nowSec);
  // session-start / session-complete are fired explicitly at begin / finish to avoid doubling.
}
function liveCue(cue) {
  coachRouteCue(cue);
  const log = $("lCues"); if (!log) return; const empty = log.firstChild; if (empty && empty.style) empty.remove();
  const cls = cue.kind === "pace" ? "pace-" + cue.paceStatus : cue.kind === "step-start" ? "step" : cue.kind === "session-start" ? "start" : cue.kind === "session-complete" ? "done" : cue.kind === "split" ? "split" : "";
  const e = el('<div class="cue ' + cls + '"><span class="badge"></span><span class="ct">' + fmtPace(cue.atMs / 1000) + '</span><span>' + cue.message + '</span></div>');
  log.insertBefore(e, log.firstChild);
}
function liveUpdate(snap) {
  $("lElapsed").textContent = fmtPace(snap.elapsedSeconds);
  $("lDist").innerHTML = (snap.distanceMeters / 1000).toFixed(2) + '<small> km</small>';
  // Hide implausible paces (>20:00/km): those only appear when barely moving and read as nonsense.
  const clamp = (p) => (p && p > 0 && p <= 1200) ? p : null;
  const paceHtml = (p) => { const v = clamp(p); return v ? fmtPace(v) + '<small> /km</small>' : "—"; };
  // On a real GPS run use our movement-aware current pace (falls to "—" when stopped); the simulator
  // has no such artefacts so its snapshot pace is fine.
  const cur = clamp(LIVE && LIVE.mode === "gps" ? LIVE.curPace : snap.currentPaceSecPerKm);
  const pv = $("lPace"); pv.innerHTML = cur ? fmtPace(cur) + '<small> /km</small>' : "—"; pv.className = "lv num " + (cur ? (snap.paceStatus || "none") : "none");
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
  coachTick(snap);
}
function liveTick() {
  const dt = 0.2 * LIVE.speed; LIVE.vms += dt * 1000;
  const pre = LIVE.rt.snapshot(LIVE.vms);
  if (pre.step && pre.step.index !== LIVE.lastStep) { LIVE.quirk = 0; LIVE.lastStep = pre.step.index; }
  const pace = livePace(pre.step); LIVE.dist += (1000 / pace) * dt;
  simRouteStep();
  LIVE.hr += (liveHr(pre.step) - LIVE.hr) * 0.05 + (Math.random() - 0.5) * 1.5; LIVE.hr = Math.max(95, Math.min(190, LIVE.hr));
  LIVE.rt.update({ atMs: LIVE.vms, distanceMeters: LIVE.dist, heartRateBpm: Math.round(LIVE.hr) }).forEach(liveCue);
  checkSplits();
  liveUpdate(LIVE.rt.snapshot(LIVE.vms));
  if (LIVE.rt.getStatus() === "completed") { stopLive(); liveFinish(true); }
}
// Synthesize a plausible wandering GPS track for the simulator, so the demo/artifact still shows a
// route map. Advances a heading with gentle random turns, one point roughly every 40 m.
function simRouteStep() {
  if (!LIVE.simLat) { LIVE.simLat = 51.5074; LIVE.simLng = -0.1278; }
  if (LIVE.dist - LIVE.routeDist < 40) return;
  const seg = LIVE.dist - LIVE.routeDist; LIVE.routeDist = LIVE.dist;
  LIVE.simHead += (Math.random() - 0.5) * 0.7;
  LIVE.simLat += seg * Math.cos(LIVE.simHead) / 111320;
  LIVE.simLng += seg * Math.sin(LIVE.simHead) / (111320 * Math.cos(LIVE.simLat * Math.PI / 180));
  LIVE.route.push({ lat: LIVE.simLat, lng: LIVE.simLng });
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
  if (LIVE.done) return;
  LIVE.done = true; LIVE.completedFull = !!complete; stopLive();
  const now = liveNowMs();
  if (!complete) LIVE.rt.stop(now).forEach(liveCue);
  const snap = LIVE.rt.snapshot(now);
  const km = snap.distanceMeters / 1000;
  LIVE.summary = { distKm: km.toFixed(2), time: fmtPace(snap.elapsedSeconds), pace: snap.averagePaceSecPerKm ? fmtPace(snap.averagePaceSecPerKm) : "—", avgPaceSec: snap.averagePaceSecPerKm || 0, sec: Math.round(snap.elapsedSeconds), route: downsampleRoute(LIVE.route), splits: LIVE.splits.slice(), elevGain: Math.round(LIVE.elevGain), type: LIVE.session.type, saved: false, meaningful: km > 0.05 };
  // Clear, unmissable end — the chosen coach speaks the closing line (falling back to the device voice
  // if the clip is unavailable) plus a completion screen the user must act on.
  if (coachEnabled()) coachTrigger(complete ? "session-complete" : "ended-early", LIVE.session.type, now / 1000);
  else speak(complete ? "Well done" + nameTail() + ". Session complete." : "Session ended" + nameTail() + ".");
  render();
}
function runDateLabel() {
  const d = new Date(), M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.getDate() + " " + M[d.getMonth()] + " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
// Persist the just-finished run to Activities + tick it off in the training calendar.
function saveLiveSession() {
  const sm = LIVE.summary; if (!sm || sm.saved) return;
  if (sm.meaningful) {
    state.logged.unshift({ t: LIVE.session.title, d: runDateLabel(), dist: sm.distKm + " km", time: sm.time, pace: sm.pace + " /km",
      distKm: Number(sm.distKm), sec: sm.sec, avgPaceSec: Math.round(sm.avgPaceSec), route: sm.route, splits: sm.splits, elevGain: sm.elevGain || 0, type: sm.type });
    saveRuns();
  }
  const wk0 = PLAN.weeks[0]; const dn = DAY_ORDER[LIVE.session.dayOfWeek];
  if (LIVE.completedFull && wk0) { const m = wk0.sessions.find((s) => s.day === dn && s.title === LIVE.session.title); if (m) state.done[doneKey(wk0.index, m)] = true; }
  sm.saved = true;
  assessFitnessFromRun(LIVE.session.type, sm.avgPaceSec, Number(sm.distKm));
}
// ---- Adaptive re-estimation: does the completed run imply a different fitness than the plan? -----
function loadFitSuggest() { try { return JSON.parse(localStorage.getItem("interun_fitsuggest") || "null"); } catch (e) { return null; } }
function saveFitSuggest() { try { state.fitSuggest ? localStorage.setItem("interun_fitsuggest", JSON.stringify(state.fitSuggest)) : localStorage.removeItem("interun_fitsuggest"); } catch (e) {} }
// Back out a 5 km-equivalent from a continuous run's average pace, per effort type. Interval/strides
// sessions average across recoveries so their mean pace isn't comparable — those return null.
function impliedRecentFromRun(type, avgPaceSec) {
  if (!avgPaceSec || avgPaceSec <= 0) return null;
  let thr; // implied threshold pace (s/km)
  if (type === "easy" || type === "long" || type === "recovery") thr = avgPaceSec - 92; // easy ≈ threshold+92
  else if (type === "steady") thr = avgPaceSec - 35; // steady ≈ threshold+35
  else if (type === "threshold" || type === "race-specific") thr = avgPaceSec; // continuous ≈ threshold
  else return null;
  if (thr < 120) return null; // implausibly fast
  return Math.round(thr * 4.6822); // threshold pace → 5 km-equivalent (inverse of the pace model)
}
function assessFitnessFromRun(type, avgPaceSec, distKm) {
  if (!distKm || distKm < 2) return; // too short to trust
  const implied = impliedRecentFromRun(type, avgPaceSec);
  if (!implied) return;
  const cur = profile.recentTimeS;
  if (!cur) return;
  const dev = (cur - implied) / cur; // >0 ⇒ run implies FASTER (fitter); <0 ⇒ slower
  const easyType = type === "easy" || type === "long" || type === "recovery";
  // Easy runs vary most and are often run slower than capable: only trust the "fitter" direction,
  // and demand a clearer margin. Deliberately-paced steady/threshold work triggers either way.
  let dir = null;
  if (dev > (easyType ? 0.08 : 0.06)) dir = "better";
  else if (dev < -0.06 && !easyType) dir = "lower";
  if (!dir) return;
  state.fitSuggest = { dir, implied, from: cur, at: todayIso(), sessTitle: LIVE.session.title };
  saveFitSuggest();
}
// Apply the suggestion: re-anchor fitness to the run's implied 5 km and rebuild the plan.
function applyFitSuggest() {
  const fs = state.fitSuggest; if (!fs) return;
  profile.recentTimeS = fs.implied; profile.noRecent = false;
  if (profile.status === "new") profile.status = "building"; // a real run means they're past couch-to-5k
  try { recompute(); } catch (e) {}
  state.planWeek = PLAN.defaultWeekIndex; state.selWeek = 0; state.selDay = TODAY_DOW; seedDone(); saveProfileStore();
  state.fitSuggest = null; saveFitSuggest();
  render();
}
function dismissFitSuggest() { state.fitSuggest = null; saveFitSuggest(); render(); }
function fitSuggestBanner() {
  const fs = state.fitSuggest; if (!fs) return "";
  const faster = fs.dir === "better";
  const impliedPace = fmtPace(fs.implied / 5);
  const head = faster ? "You\\u2019re running stronger than your plan assumes" : "That run was tougher than your plan expects";
  const body = faster
    ? "Your last run implies about a " + fmtTimeFull(fs.implied) + " 5K (was " + fmtTimeFull(fs.from) + "). Update your paces so every session matches your current fitness?"
    : "Your last run implies about a " + fmtTimeFull(fs.implied) + " 5K (was " + fmtTimeFull(fs.from) + "). Ease your paces to match how you\\u2019re running right now?";
  return '<div class="fit-banner ' + (faster ? "up" : "down") + '"><div class="fb-ic">' + (faster ? ICON.trendUp : ICON.trendDown) + '</div>' +
    '<div class="fb-main"><div class="fb-h">' + head + '</div><div class="fb-b">' + body + '</div>' +
    '<div class="fb-actions"><button class="fb-yes" id="fitApply">Update my paces</button><button class="fb-no" id="fitDismiss">Not now</button></div></div></div>';
}

// ---- Welcome-back message + motivational quotes ---------------------------
const QUOTES = [
  ["The miracle isn\\u2019t that I finished. The miracle is that I had the courage to start.", "John Bingham"],
  ["Run when you can, walk if you have to, crawl if you must; just never give up.", "Dean Karnazes"],
  ["It\\u2019s you against the little voice that wants you to quit.", "George Sheehan"],
  ["The body achieves what the mind believes.", ""],
  ["Don\\u2019t dream of winning, train for it.", "Mo Farah"],
  ["We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Aristotle"],
  ["The will to win means nothing without the will to prepare.", "Juma Ikangaa"],
  ["It never gets easier, you just get stronger.", ""],
  ["Consistency beats intensity. Just show up.", ""],
  ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
  ["Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"],
  ["Run the mile you\\u2019re in.", ""],
  ["Slow runs make fast runners.", ""],
  ["The magic is in the miles.", ""],
  ["Fall in love with the process and the results will come.", ""],
  ["One run can change your day. Many runs can change your life.", "Benjamin Cheever"],
  ["Motivation gets you going, but discipline keeps you growing.", "John Maxwell"],
  ["The pain of discipline weighs ounces; the pain of regret weighs tons.", ""],
  ["Your only limit is the one you set yourself.", ""],
  ["Every mile is a gift you give yourself.", ""],
  ["Somewhere someone is training when you are not.", "Tom Fleming"],
  ["Believe you\\u2019re strong enough to accomplish everything you want to do.", "John Bingham"],
  ["Discipline is choosing between what you want now and what you want most.", ""],
  ["The reason we race isn\\u2019t so much to beat each other, but to be with each other.", "Christopher McDougall"],
  ["Small steps, every day.", ""],
  ["A run begins the moment you forget you\\u2019re running.", ""],
  ["If you want to be the best runner you can be, start now.", "Priscilla Welch"],
  ["It always seems impossible until it\\u2019s done.", "Nelson Mandela"],
  ["Take care of the miles, and the miles will take care of you.", ""],
  ["The only bad run is the one that didn\\u2019t happen.", ""],
];
function randomQuote() { return QUOTES[Math.floor(Math.random() * QUOTES.length)]; }
function welcomeBackName() { const n = firstName(); return n ? "Welcome back, " + esc(n) : "Welcome back"; }
// A brief personalised welcome shown on each return to the app, with a rotating motivational quote.
function showWelcomeBack() {
  const q = randomQuote();
  const ov = el('<div class="welcome wb" id="welcomeback"><div class="welcome-inner">' +
    '<div class="welcome-mark">' + BRAND_SVG + '</div>' +
    '<h1 class="welcome-h">' + welcomeBackName() + ' \\uD83D\\uDC4B</h1>' +
    '<p class="wb-quote">\\u201C' + esc(q[0]) + '\\u201D</p>' +
    (q[1] ? '<p class="wb-by">\\u2014 ' + esc(q[1]) + '</p>' : '') +
    '<button class="welcome-cta wb-cta" id="wbGo">Let\\u2019s go \\u2192</button>' +
    '</div></div>');
  document.body.appendChild(ov);
  ov.classList.add("on");   // opaque, directly under the fading splash — the logo holds; copy welIns
  let gone = false;
  const dismiss = () => { if (gone) return; gone = true; ov.classList.add("hide"); setTimeout(() => { ov.remove(); if (state.tab === "today" && !state.screen) maybeAutoGuide(); }, 500); };
  // Stays up until the user taps "Let's go" — no auto-dismiss, no tap-away.
  const go = $("wbGo"); if (go) go.onclick = dismiss;
}

// ---- "Understanding your sessions" interactive guide ----------------------
const EFFORT_HINT = {
  easy: "comfortable and conversational — you could chat the whole way.",
  steady: "moderate — a bit quicker than easy, still controlled.",
  threshold: "comfortably hard — around your one-hour race effort.",
  tempo: "controlled and comfortably hard, a steady rhythm.",
  cruise: "threshold effort, broken into repeats.",
  fartlek: "playful bursts of harder running by feel.",
  vo2: "hard — around your 5K race pace.",
  hard: "hard — around your 5K race pace.",
  jog: "very easy jogging to recover.",
  recovery: "very easy — just turning the legs over.",
  long: "easy and relaxed, building endurance.",
  strides: "relaxed, controlled fast running — never a sprint.",
  pickups: "short, smooth lifts in pace — never a sprint.",
  float: "an easy, rolling recovery (not a full stop).",
  walk: "walking to recover — part of the plan, not a failure.",
  run: "running at the effort noted.",
};
// Parse a session title into display tokens; mark the ones worth explaining and build their steps.
function parseGuide(title) {
  // Merge distance phrases ("1 mile", "1 km") so they read as one token.
  const merged = [];
  const words = title.split(/\\s+/);
  for (let i = 0; i < words.length; i++) {
    if (/^\\d+(?:\\.\\d+)?$/.test(words[i]) && /^(miles?|km|k)$/i.test(words[i + 1] || "")) { merged.push(words[i] + " " + words[i + 1]); i++; }
    else merged.push(words[i]);
  }
  const hasReps = merged.some((w) => /^\\d+$/.test(w)) && merged.includes("\\u00D7");
  let rec = false, usedEffort = false;
  const tokens = [];
  merged.forEach((w) => {
    if (w === "/") { rec = true; tokens.push({ text: w, plain: true }); return; }
    if (w === "\\u00D7") { tokens.push({ text: w, plain: true }); return; }
    let step = null;
    if (/^\\d+$/.test(w) && hasReps && !rec) {
      step = { label: "How many", body: "Repeat the main effort this many times \\u2014 here, " + w + (Number(w) === 1 ? " rep." : " reps.") };
    } else if (/^\\d+[\\u2032]$/.test(w)) { // minutes, e.g. 8'
      const mins = w.replace("\\u2032", "");
      step = rec
        ? { label: "Recovery", body: "Easy recovery between efforts \\u2014 " + mins + " minute" + (mins === "1" ? "" : "s") + " of gentle jogging." }
        : hasReps
          ? { label: "Each effort", body: "How long each effort lasts \\u2014 " + mins + " minute" + (mins === "1" ? "" : "s") + ". (\\u2032 means minutes, \\u2033 means seconds.)" }
          : { label: "Duration", body: "How long to run for \\u2014 " + mins + " minutes at the effort shown. (\\u2032 means minutes.)" };
    } else if (/^\\d+[\\u2033]$/.test(w)) { // seconds, e.g. 90"
      const secs = w.replace("\\u2033", "");
      step = rec
        ? { label: "Recovery", body: "A short easy recovery \\u2014 " + secs + " seconds. (\\u2033 means seconds.)" }
        : { label: "Each effort", body: "A short, sharp effort \\u2014 " + secs + " seconds. (\\u2033 means seconds.)" };
    } else if (/^\\d+(?:\\.\\d+)?\\s?(?:miles?|km|m)$/i.test(w)) { // distance, e.g. 800m, 1 mile
      step = rec
        ? { label: "Recovery", body: "Recover over " + w + " of easy jogging." }
        : { label: "Each effort", body: "How far each effort covers \\u2014 " + w + "." };
    } else {
      const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hintKey = EFFORT_HINT[key] ? key : (key.startsWith("vo") ? "vo2" : null);
      if (hintKey && !usedEffort && !rec) {
        usedEffort = true;
        step = { label: "The effort", body: "The pace or effort for the work \\u2014 \\u201C" + w + "\\u201D: " + EFFORT_HINT[hintKey] };
      }
    }
    tokens.push({ text: w, step });
  });
  return tokens;
}
// Count of explainable tokens — used to decide whether today's title is rich enough to teach from.
function guideStepCount(title) { return parseGuide(title).filter((t) => t.step).length; }
const GUIDE_EXAMPLE = "4 \\u00D7 8\\u2032 threshold / 90\\u2033 jog";
let GUIDE = null;
function ensureGuideOv() {
  if ($("guideOv")) return;
  const ov = el('<div class="guide-ov" id="guideOv"><div class="guide-card">' +
    '<div class="guide-eyebrow" id="guideEyebrow">Understanding your sessions</div>' +
    '<div class="guide-title" id="guideTitle"></div>' +
    '<div class="guide-cap"><div class="guide-cap-h" id="guideCapH"></div><div class="guide-cap-b" id="guideCapB"></div></div>' +
    '<div class="guide-foot"><div class="guide-dots" id="guideDots"></div><div class="guide-btns"><button class="guide-skip" id="guideSkip">Skip</button><button class="guide-next" id="guideNext">Next</button></div></div>' +
    '</div></div>');
  document.body.appendChild(ov);
  $("guideNext").onclick = guideNext;
  $("guideSkip").onclick = closeGuide;
  ov.addEventListener("click", (e) => { if (e.target === ov) closeGuide(); });
}
// steps = [intro, ...token steps, outro]; each token step points at the token index to illuminate.
function openSessionGuide(title, opts) {
  opts = opts || {};
  ensureGuideOv();
  const tokens = parseGuide(title);
  const steps = [{ intro: true }];
  tokens.forEach((t, i) => { if (t.step) steps.push({ ti: i, label: t.step.label, body: t.step.body }); });
  steps.push({ outro: true });
  GUIDE = { title, tokens, steps, i: 0, onClose: opts.onClose, fromSupport: !!opts.fromSupport };
  renderGuide();
  const ov = $("guideOv"); ov.classList.add("on");
}
function guideTitleHtml(activeTi) {
  return GUIDE.tokens.map((t, i) => {
    if (t.plain) return '<span class="gt-sep">' + esc(t.text) + '</span>';
    const on = activeTi === i;
    const dim = activeTi != null && !on;
    return '<span class="gtok' + (on ? " on" : "") + (dim ? " dim" : "") + '">' + esc(t.text) + '</span>';
  }).join(" ");
}
function renderGuide() {
  const st = GUIDE.steps[GUIDE.i];
  const activeTi = st && st.ti != null ? st.ti : null;
  $("guideTitle").innerHTML = guideTitleHtml(activeTi);
  const h = $("guideCapH"), b = $("guideCapB");
  if (st.intro) { h.textContent = "Let\\u2019s decode your sessions"; b.textContent = "Every session is written in a simple shorthand. Let\\u2019s go through what the numbers mean, one at a time."; }
  else if (st.outro) { h.textContent = "That\\u2019s the shorthand!"; b.textContent = "You\\u2019ll see this on every session. You can revisit it any time in Support \\u2192 Understanding my sessions."; }
  else { h.textContent = st.label; b.textContent = st.body; }
  $("guideNext").textContent = GUIDE.i >= GUIDE.steps.length - 1 ? "Got it" : "Next";
  $("guideSkip").style.visibility = GUIDE.i >= GUIDE.steps.length - 1 ? "hidden" : "visible";
  $("guideDots").innerHTML = GUIDE.steps.map((_, i) => '<span class="gd' + (i === GUIDE.i ? " on" : "") + '"></span>').join("");
}
function guideNext() { if (GUIDE.i >= GUIDE.steps.length - 1) return closeGuide(); GUIDE.i++; renderGuide(); }
function closeGuide() {
  const ov = $("guideOv"); if (ov) ov.classList.remove("on");
  try { localStorage.setItem("interun_guide_seen", "1"); } catch (e) {}
  const cb = GUIDE && GUIDE.onClose; GUIDE = null; if (cb) cb();
}
function guideSeen() { try { return localStorage.getItem("interun_guide_seen") === "1"; } catch (e) { return false; } }
// Auto-run the guide the first time a personalised user opens Today (using today's session if it's
// rich enough to teach from, otherwise a clear worked example).
function maybeAutoGuide() {
  if (guideSeen() || !profile.personalized || GUIDE) return;
  // Hold off while the splash / welcome-back overlays are still up — it fires when they clear.
  if ($("splash") || $("welcomeback")) return;
  const s = selectedSession();
  const title = s && guideStepCount(s.title) >= 2 ? s.title : GUIDE_EXAMPLE;
  setTimeout(() => { if (!guideSeen() && !GUIDE && state.tab === "today" && !state.screen && !$("welcomeback")) openSessionGuide(title, {}); }, 550);
}

// ---- Router ---------------------------------------------------------------
const TITLES = { today: "Today", plan: "Your Plan", activities: "Activities", community: "Community", support: "Support" };
// The Today tab shows a live calendar glyph with today's date (drawn in CSS; number injected here).
function todayNavIcon() {
  return '<span class="nav-date" aria-hidden="true"><span class="nav-date-day num">' + new Date().getDate() + '</span></span>';
}
function refreshTodayNavDate() {
  const day = document.querySelector(".nav-date-day");
  if (day) day.textContent = String(new Date().getDate());
}
// Keep the date current if the app is left open across midnight and brought back to the foreground.
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshTodayNavDate(); });
function render() {
  const v = $("view");
  // Lock onto the live screen while a run is under way: hide the bottom nav so a stray tap can't
  // abandon it. Every other screen shows the nav.
  const nav = $("nav"); if (nav) nav.style.display = liveRunning() ? "none" : "";
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
  if (state.screen === "runview") {
    $("topTitle").textContent = "Run";
    v.innerHTML = viewRunDetail(); v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    return;
  }
  $("topTitle").textContent = state.support ? "Support" : TITLES[state.tab];
  if (state.tab === "today") { fetchWeather(); v.innerHTML = viewToday(); maybeAutoGuide(); }
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
  document.querySelectorAll("[data-runidx]").forEach((b) => b.onclick = () => { state.viewRunIdx = Number(b.dataset.runidx); state.screen = "runview"; render(); });
  const runBack = $("runBack"); if (runBack) runBack.onclick = () => { state.screen = null; state.tab = "activities"; state.actTab = "workouts"; render(); };
  const shareRun = $("shareRun"); if (shareRun) { shareRun.onclick = doShareRun; prepareShareCard(currentOverviewRun()); }
  const ovMap = $("ovMap"); if (ovMap) { const r = currentOverviewRun(); if (r) buildOverviewMap(ovMap, r.route); }
  document.querySelectorAll("[data-hub]").forEach((b) => b.onclick = () => { state.support = b.dataset.hub; render(); });
  const guideReplay = $("guideReplay"); if (guideReplay) guideReplay.onclick = () => openSessionGuide(GUIDE_EXAMPLE, { fromSupport: true });
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
    if (s.dataset.set === "coach_on") {
      COACH.cfg.enabled = b.dataset.v === "1"; saveCoachCfg();
      const o = $("coachOpts"); if (o) o.style.display = COACH.cfg.enabled ? "" : "none";
      if (COACH.cfg.enabled) { coachUnlock(); coachLoadManifest(); } else coachStop();
    }
    if (s.dataset.set === "coach_freq") { COACH.cfg.frequency = b.dataset.v; saveCoachCfg(); }
    refreshTypePreview();
  }));
  wireCoachSettings();
  ["s_age","s_sex"].forEach((id) => { const e = $(id); if (e) e.oninput = e.onchange = refreshTypePreview; });
  bindTimeInput($("s_target")); bindTimeInput($("s_rectime")); bindTimeInput($("s_easypace"));
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
    profile = pf; PLAN = out.plan; RAW = out.raw; FITNESS = out.fitness; CLASS = out.classification; MASTERS = out.masters; state.planWeek = PLAN.defaultWeekIndex; state.selWeek = 0; state.selDay = TODAY_DOW; seedDone(); saveProfileStore(); renderAvatar();
    state.screen = null; state.tab = "plan"; render();
  };
  const cancel = $("cancelSetup"); if (cancel) cancel.onclick = () => { state.screen = null; state.tab = "today"; render(); };
  // Session detail taps (Plan, calendar, Today)
  wireSessionTaps();
  // Today: clickable dates, conditions & feel squares, view-session
  // Tapping a date selects that day (and its week); the hero + overview follow.
  document.querySelectorAll("[data-day]").forEach((b) => b.onclick = () => { if (b.dataset.week != null) state.selWeek = Number(b.dataset.week); state.selDay = Number(b.dataset.day); render(); });
  // The week band scrolls horizontally, one week per snap page. Position it at the selected week, keep
  // the label live while scrolling, and re-render once it settles on a new week.
  const band = $("weekband");
  if (band) {
    const pageW = () => (band.firstElementChild ? band.firstElementChild.getBoundingClientRect().width : band.clientWidth) || 1;
    band.scrollLeft = curWeekIdx() * pageW();
    band.dataset.shown = String(curWeekIdx());
    band.onscroll = () => {
      const w = Math.max(0, Math.min(PLAN.weeks.length - 1, Math.round(band.scrollLeft / pageW())));
      const lab = $("wkLabel"); if (lab && band.dataset.shown !== String(w)) { lab.innerHTML = wkLabelInner(w); band.dataset.shown = String(w); }
      clearTimeout(wbandScrollT);
      wbandScrollT = setTimeout(() => { if (w !== state.selWeek) { state.selWeek = w; render(); } }, 110);
    };
  }
  const condSq = $("condSq"); if (condSq) condSq.onclick = openWeatherSheet;
  const feelSq = $("feelSq"); if (feelSq) feelSq.onclick = openFeelSheet;
  const fitApply = $("fitApply"); if (fitApply) fitApply.onclick = applyFitSuggest;
  const fitDismiss = $("fitDismiss"); if (fitDismiss) fitDismiss.onclick = dismissFitSuggest;
  const viewSession = $("viewSession"); if (viewSession) viewSession.onclick = () => openSessionSheet(selectedSession(), curWeekNo());
  // Training-calendar wiring
  const calBack = $("calBack"); if (calBack) calBack.onclick = () => { state.screen = null; render(); };
  document.querySelectorAll("[data-done]").forEach((b) => b.onclick = () => { const k = b.dataset.done; state.done[k] = !state.done[k]; render(); });
  // 1 km time-trial session wiring
  const startTrial = $("startTrial"); if (startTrial) startTrial.onclick = beginTrialRun;
  const cancelTrial = $("cancelTrial"); if (cancelTrial) cancelTrial.onclick = () => { state.trialPending = false; render(); };
  // Live session wiring
  const startBtn = $("startSession"); if (startBtn) startBtn.onclick = startSession;
  const lb = $("liveBack"); if (lb) lb.onclick = () => { coachStop(); stopLive(); stopSpeech(); state.screen = null; state.tab = "today"; render(); };
  const lStart = $("lStart"); if (lStart) lStart.onclick = beginLive;
  const lVoice = $("lVoice"); if (lVoice) lVoice.onclick = () => {
    COACH.cfg.enabled = !COACH.cfg.enabled; saveCoachCfg();
    if (!COACH.cfg.enabled) coachStop(); else { coachUnlock(); coachLoadManifest(); }
    lVoice.classList.toggle("on", coachEnabled()); lVoice.innerHTML = coachEnabled() ? ICON.vox : ICON.voxOff;
  };
  const lPause = $("lPause"); if (lPause) lPause.onclick = () => {
    const st = LIVE.rt.getStatus();
    if (st === "active") {
      LIVE.rt.pause(liveNowMs()).forEach(liveCue);
      if (LIVE.mode === "gps") { LIVE.pauseStart = Date.now(); } else { stopLive(); }
      lPause.textContent = "Resume";
    } else if (st === "paused") {
      if (LIVE.mode === "gps") { LIVE.pausedMs += Date.now() - LIVE.pauseStart; LIVE.pauseStart = 0; LIVE.lastLat = null; LIVE.win = []; LIVE.devSpeed = null; LIVE.curPace = null; LIVE.rt.resume(liveNowMs()).forEach(liveCue); if (!LIVE.ui) LIVE.ui = setInterval(gpsUiTick, 250); }
      else { LIVE.rt.resume(LIVE.vms).forEach(liveCue); startLoop(); }
      lPause.textContent = "Pause";
    }
  };
  const lFinish = $("lFinish"); if (lFinish && !LIVE.done) lFinish.onclick = () => liveFinish(false);
  // Completion screen: save the run to Activities, discard it, or move on to Activities.
  const lSave = $("lSave"); if (lSave) lSave.onclick = () => { saveLiveSession(); render(); };
  const lDiscard = $("lDiscard"); if (lDiscard) lDiscard.onclick = () => { coachStop(); stopSpeech(); LIVE = null; state.screen = null; state.tab = "today"; render(); };
  const lDone = $("lDone"); if (lDone) lDone.onclick = () => { coachStop(); stopSpeech(); LIVE = null; state.screen = null; state.tab = "activities"; state.actTab = "workouts"; render(); };
}
function buildNav() {
  $("nav").innerHTML = ["today","plan","activities","community","support"].map((t) => '<button type="button" class="navbtn' + (t===state.tab?" on":"") + '" data-tab="' + t + '">' + (t === "today" ? todayNavIcon() : ICON[t]) + '<span class="nl">' + TITLES[t].replace("Your ","") + '</span></button>').join("");
  document.querySelectorAll(".navbtn").forEach((b) => b.onclick = () => { coachStop(); stopLive(); stopSpeech(); stopTrialRun(); TRIALRUN = null; state.screen = null; state.tab = b.dataset.tab; if (b.dataset.tab !== "support") state.support = null; if (b.dataset.tab === "today") { state.selWeek = 0; state.selDay = TODAY_DOW; } render(); });
}
$("bellBtn").innerHTML = ICON.bell; $("themeBtn").innerHTML = ICON.theme; $("calBtn").innerHTML = ICON.cal; renderAvatar();
$("themeBtn").onclick = () => { const cur = document.documentElement.getAttribute("data-theme"); document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark")); };
$("profileBtn").onclick = () => { if (liveRunning()) return; stopTrialRun(); state.screen = "setup"; render(); };
$("calBtn").onclick = () => { if (liveRunning()) return; stopTrialRun(); state.screen = "calendar"; render(); };
$("bellBtn").onclick = () => { if (liveRunning()) return; stopTrialRun(); openRemindersSheet(); };
seedDone();
buildNav();
render();
try { updateBell(); initReminders(); } catch (e) {}
// Launch flow: brief brand splash, then either the first-run welcome (which leads into setup) or,
// for a returning user, straight to Today.
(function () {
  const sp = $("splash"); if (!sp) return;
  const removeSplash = () => { sp.classList.add("hide"); setTimeout(() => sp.remove(), 600); };
  if (FIRST_RUN) {
    setTimeout(() => {
      removeSplash();
      const wel = $("welcome"); if (!wel) return;
      wel.classList.add("on");   // opaque, directly under the fading splash; its copy arrives via welIn
      const go = () => { wel.classList.add("hide"); setTimeout(() => wel.remove(), 500); state.screen = "setup"; render(); };
      const btn = $("welcomeGo"); if (btn) btn.onclick = go;
    }, 2000);
  } else {
    // Returning user: brand splash → a brief personalised welcome with a rotating quote → Today.
    let started = false;
    const go = () => { if (started) return; started = true; removeSplash(); showWelcomeBack(); };
    sp.addEventListener("click", go);
    setTimeout(go, 2200);
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
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
    for (const c of cl) { if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  }));
});
`;
writeFileSync(join(docsDir, "sw.js"), sw, "utf8");
console.log(`Wrote PWA to ${docsDir} (index.html, manifest.webmanifest, sw.js)`);

// Mirror the generated coach audio (web/voices -> docs/voices) so GitHub Pages serves it. The service
// worker caches these on demand — only the coach the runner selects is downloaded, never all four.
const voicesSrc = join(here, "voices");
if (existsSync(voicesSrc)) {
  cpSync(voicesSrc, join(docsDir, "voices"), { recursive: true });
  console.log("Mirrored coach audio to docs/voices");
} else {
  console.log("No web/voices yet — run: node voice-dev/dump-catalogue.ts && voice-dev/venv/bin/python voice-dev/generate.py");
}
