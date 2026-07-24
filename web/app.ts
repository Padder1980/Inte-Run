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

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Running Coach</title>
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
.iconbtn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.iconbtn svg { width: 18px; height: 18px; }
.tb-left, .tb-right { display: flex; gap: 8px; }

.view { flex: 1; overflow-y: auto; padding: 16px 16px 96px; }
.eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 16px; }
h2.sec { font-size: 15px; margin: 22px 2px 10px; letter-spacing: -.01em; }
h2.sec:first-child { margin-top: 4px; }

/* Week strip */
.weekstrip { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; margin-bottom: 14px; }
.weekstrip .d { text-align: center; padding: 8px 0; border-radius: 12px; cursor: default; }
.weekstrip .d .dn { font-size: 10px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .05em; }
.weekstrip .d .dd { font-size: 15px; font-weight: 600; margin-top: 3px; }
.weekstrip .d.today { background: var(--ink); color: var(--surface); }
.weekstrip .d.today .dn { color: color-mix(in srgb, var(--surface) 75%, transparent); }
.weekstrip .d .dot { width: 6px; height: 6px; border-radius: 50%; margin: 4px auto 0; }

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

.primary { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 16px; font: inherit; font-size: 15px; font-weight: 650; color: var(--accent-ink); background: var(--accent); border: 0; border-radius: 14px; padding: 14px; cursor: pointer; text-decoration: none; }
.primary:hover { filter: brightness(1.06); }
.primary svg { width: 18px; height: 18px; }

/* Readiness (Today) */
.ctx { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.ctx .lab { font-size: 12px; color: var(--ink-faint); font-weight: 600; }
.seg { display: inline-flex; gap: 5px; flex-wrap: wrap; }
.seg button { font: inherit; font-size: 12.5px; color: var(--ink-soft); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
.seg button.on { background: var(--accent); color: var(--accent-ink); border-color: transparent; font-weight: 600; }
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

/* Setup banner */
.setup-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line)); border-radius: 14px; padding: 13px 15px; margin-bottom: 14px; cursor: pointer; font: inherit; color: var(--ink); }
.setup-banner b { font-size: 13.5px; } .setup-banner .sb-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; } .setup-banner span { color: var(--accent); font-weight: 600; font-size: 13px; white-space: nowrap; }

/* Live session */
.live-hero { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface)); }
.live-title { font-size: 18px; font-weight: 700; letter-spacing: -.01em; margin: 4px 0 12px; }
.live-metrics { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; }
.live-metrics .lk { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint); }
.live-metrics .lv { font-size: 30px; font-weight: 750; letter-spacing: -.02em; margin-top: 2px; }
.live-metrics .lv small { font-size: 13px; color: var(--ink-faint); font-weight: 500; }
.lv.on { color: var(--eff-easy); } .lv.fast { color: var(--eff-moderate); } .lv.slow { color: var(--eff-hard); }
.live-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0; }
.live-controls .primary { margin: 0; grid-column: 1 / -1; }
.ctrl { font: inherit; font-size: 14px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; }
.ctrl:disabled { opacity: .45; cursor: not-allowed; }
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
<div class="app">
  <div class="topbar">
    <div class="tb-left">
      <button class="iconbtn" id="profileBtn" title="Profile" aria-label="Profile"></button>
      <button class="iconbtn" id="bellBtn" title="Notifications" aria-label="Notifications"></button>
    </div>
    <div class="title" id="topTitle">Today</div>
    <div class="tb-right">
      <button class="iconbtn" id="themeBtn" title="Theme" aria-label="Toggle theme"></button>
    </div>
  </div>
  <div class="view" id="view"></div>
  <nav class="bottomnav" id="nav"></nav>
</div>

<script>${bundleJs}</script>
<script>
const $ = (id) => document.getElementById(id);
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
};
const PHASE = { base: "var(--base)", build: "var(--build)", peak: "var(--peak)", taper: "var(--taper)" };
const BAND = { ready: "var(--ready)", steady: "var(--steady)", ease: "var(--ease)", rest: "var(--rest)" };
const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ---- Your profile drives everything ---------------------------------------
const watch = { sleepHours: 7.5, restingHrDelta: 0, hrvStatus: "normal" };
function todayIso() { return new Date().toISOString().slice(0, 10); }
function futureIso(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function fmtTimeFull(s) { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), x = s%60; const p = (n) => String(n).padStart(2,"0"); return h>0 ? h+":"+p(m)+":"+p(x) : m+":"+p(x); }

// An example runner to start from — until you make it yours.
const DEFAULT_PROFILE = { goalDist: "half", targetS: 6300, raceDate: futureIso(245), recentDistM: 5000, recentTimeS: 1500, daysPerWeek: 5, yearsRunning: 3, weeklyVolumeKm: 30, age: 38, sex: "", strength: true, returning: false, personalized: false };

function loadProfile() { try { const s = localStorage.getItem("rc_profile_v1"); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveProfileStore() { try { localStorage.setItem("rc_profile_v1", JSON.stringify(profile)); } catch (e) {} }

// Turn a profile into engine outputs. Throws if the goal can't be planned (e.g. race too soon).
function applyProfile(pf) {
  const cls = RC.classifyRunner({ runsPerWeek: pf.daysPerWeek, yearsRunning: pf.yearsRunning, weeklyVolumeKm: pf.weeklyVolumeKm || undefined, recent5kSeconds: pf.recentDistM === 5000 ? pf.recentTimeS : undefined, sex: pf.sex || undefined });
  const experience = cls.tier <= 1 ? "beginner" : cls.tier === 2 ? "recreational" : "competitive";
  const ath = { daysPerWeek: pf.daysPerWeek, recent: { distanceMeters: pf.recentDistM, timeSeconds: pf.recentTimeS }, experience, includeStrength: pf.strength, returningFromInjury: pf.returning };
  const goal = { distance: pf.goalDist, targetTimeSeconds: pf.targetS, raceDateIso: pf.raceDate, startDateIso: todayIso() };
  const plan = RC.buildPlanSummary(ath, goal); // may throw
  const raw = RC.generatePlan(ath, goal); // raw sessions with steps, for the live runtime
  const fitness = RC.buildFitnessProfile({ efforts: [{ distanceMeters: pf.recentDistM, timeSeconds: pf.recentTimeS }] });
  const masters = RC.assessMasters({ age: pf.age, sex: pf.sex || undefined });
  return { ath, goal, plan, raw, fitness, classification: cls, masters };
}

let profile = loadProfile() || Object.assign({}, DEFAULT_PROFILE);
let PLAN, RAW, FITNESS, CLASS, MASTERS;
function recompute() { const r = applyProfile(profile); PLAN = r.plan; RAW = r.raw; FITNESS = r.fitness; CLASS = r.classification; MASTERS = r.masters; }
try { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); recompute(); }

const state = { tab: "today", screen: null, dayType: "quality", subj: { soreness: "none", energy: "good", stress: "low", motivation: "high", illness: "none" }, planWeek: PLAN.defaultWeekIndex, actTab: "performance", support: null, logged: [] };

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
function paceOf(s) { const w = s.steps.filter((st) => st.targetPaceSecPerKm); if (!w.length) return null; const p = w.find((st) => st.kind === "rep") || w.find((st) => st.kind === "steady") || w[0]; return fmtPace(p.targetPaceSecPerKm.minSecPerKm) + "–" + fmtPace(p.targetPaceSecPerKm.maxSecPerKm) + "/km"; }
function rpeOf(s) { let band = s.targetRpe; if (!band) { const w = s.steps.filter((st) => st.targetRpe); if (w.length) band = { min: Math.min.apply(null, w.map((x) => x.targetRpe.min)), max: Math.max.apply(null, w.map((x) => x.targetRpe.max)) }; } return band ? band.min + "–" + band.max : null; }
function rawToday() { const ss = RAW.weeks[0].sessions.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek); return ss.find((s) => s.estimatedDistanceMeters) || ss[0]; }
function todayWorkout() {
  const s = rawToday();
  const durMin = Math.round(s.estimatedDurationSeconds / 60);
  const distKm = s.estimatedDistanceMeters ? Math.round(s.estimatedDistanceMeters / 100) / 10 : null;
  const pace = paceOf(s), rpe = rpeOf(s), eff = effortOf(s);
  const meta = ['<span class="chip">' + durMin + "′" + (distKm ? " · " + distKm + " km" : "") + "</span>"];
  if (pace) meta.push('<span class="chip pace">' + pace + "</span>");
  if (rpe) meta.push('<span class="chip rpe">RPE ' + rpe + "</span>");
  return { s, html: '<div class="wk-card" style="--c:var(--eff-' + eff + ')"><div class="b"><div class="t">' + s.title + '</div><div class="sub">Today · ' + DAY_ORDER[s.dayOfWeek] + '</div><div class="meta">' + meta.join("") + '</div></div><div class="checkbox"></div></div>' };
}
function viewToday() {
  const today = 3; // Thu
  const strip = DAY_ORDER.map((d, i) => {
    const wk = PLAN.weeks[0];
    const has = wk.sessions.some((s) => s.day === d && s.type !== "rest");
    const eff = (wk.sessions.find((s) => s.day === d && s.type !== "rest") || {}).effort;
    return '<div class="d' + (i === today ? " today" : "") + '"><div class="dn">' + d + '</div><div class="dd">' + (20 + i) + '</div>' + (has ? '<div class="dot" style="background:var(--eff-' + (eff || "easy") + ')"></div>' : "<div class=\\"dot\\" style=\\"background:transparent\\"></div>") + '</div>';
  }).join("");
  const w = todayWorkout();
  const banner = profile.personalized ? "" : '<button class="setup-banner" id="setupBanner"><div><b>You\\'re viewing an example plan</b><div class="sb-sub">Tell us about you and your goal to make it yours.</div></div><span>Set up →</span></button>';
  return banner + '<div class="weekstrip">' + strip + '</div>' +
    '<h2 class="sec">Today\\'s workout</h2><div class="card">' + w.html + '</div>' +
    '<button class="primary" id="startSession">' + ICON.play + ' Start session</button>' +
    '<h2 class="sec">How you\\'re doing</h2>' +
    '<div class="card"><div class="ctx"><span class="lab">Today\\'s plan</span><div class="seg" data-seg="dayType"><button data-v="quality"' + (state.dayType==="quality"?' class="on"':'') + '>Quality</button><button data-v="easy"' + (state.dayType==="easy"?' class="on"':'') + '>Easy</button></div></div>' +
    '<div id="readySlot">' + renderReadiness() + '</div>' +
    (state.dayType === "quality" ? feelExpander() : "") + '</div>';
}
function feelExpander() {
  const segs = [["soreness","Legs",[["none","Fine"],["mild","Stiff"],["moderate","Sore"],["high","Very sore"]]],["energy","Energy",[["good","Good"],["ok","OK"],["low","Low"]]],["stress","Stress",[["low","Low"],["normal","Normal"],["high","High"]]],["illness","Feeling ill?",[["none","No"],["slight","A little"],["unwell","Unwell"]]]];
  const body = segs.map((g) => '<div class="q"><label>' + g[1] + '</label><div class="seg" data-seg="' + g[0] + '">' + g[2].map((o) => '<button data-v="' + o[0] + '"' + (state.subj[g[0]]===o[0]?' class="on"':'') + '>' + o[1] + '</button>').join("") + '</div></div>').join("");
  return '<details class="more"><summary>Something feel different? Tell us</summary>' + body + '</details>';
}

// ============ PLAN =========================================================
function viewPlan() {
  const g = PLAN.goal, s = PLAN.summary;
  const peak = s.peakKm || 1;
  const bars = PLAN.weeks.map((w) => {
    const h = Math.max(6, Math.round(w.distanceKm / peak * 100));
    return '<button class="bar-btn" data-wk="' + w.index + '" aria-pressed="' + (w.index===state.planWeek) + '"><div class="bar' + (w.isDeload?" deload":"") + '" style="height:' + h + '%;--phase:' + PHASE[w.phase] + '"></div><div class="bl">' + w.index + '</div></button>';
  }).join("");
  return '<div class="card plan-head"><div class="eyebrow">Your plan</div><div class="goal">' + g.race + ' · ' + g.target + '</div><div class="when">' + g.raceDate + ' · ' + s.totalWeeks + '-week plan</div>' +
    '<span class="pill" style="--pc:' + (PLAN.feasibility.verdict==="achievable"?"var(--accent)":"var(--peak)") + '">' + PLAN.feasibility.verdict + '</span>' +
    '<div class="statrow"><div class="stat"><div class="k">Weeks</div><div class="v num">' + s.structuredWeeks + '</div></div><div class="stat"><div class="k">Peak/wk</div><div class="v num">' + s.peakKm + ' km</div></div><div class="stat"><div class="k">Goal pace</div><div class="v num">' + PLAN.paces.goal.replace("/km","") + '</div></div></div></div>' +
    '<h2 class="sec">Training block</h2><div class="card"><div class="chart" id="chart">' + bars + '</div></div>' +
    '<h2 class="sec">Week detail</h2><div class="card" id="weekDetail">' + weekDetail() + '</div>';
}
function weekDetail() {
  const w = PLAN.weeks.find((x) => x.index === state.planWeek) || PLAN.weeks[0];
  const byDay = {}; w.sessions.forEach((s) => (byDay[s.day] = byDay[s.day] || []).push(s));
  const rows = DAY_ORDER.filter((d) => byDay[d]).map((d) => {
    const items = byDay[d].map((s) => {
      const meta = ['<span class="chip">' + s.durMin + "′" + (s.distKm ? " · " + s.distKm + "km" : "") + "</span>"];
      if (s.pace) meta.push('<span class="chip pace">' + s.pace + "</span>");
      return '<div class="sess"><span class="dot ' + s.effort + '"></span><div><div class="st">' + s.title + '</div>' + (s.type==="rest"?"":'<div class="sm">' + meta.join("") + '</div>') + '</div></div>';
    }).join("");
    return '<div class="day-row"><div class="day-nm">' + d + '</div><div>' + items + '</div></div>';
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
  const tabs = '<div class="subtabs"><button data-at="workouts"' + (state.actTab==="workouts"?' class="on"':'') + '>Workouts</button><button data-at="performance"' + (state.actTab==="performance"?' class="on"':'') + '>Performance</button></div>';
  if (state.actTab === "workouts") {
    const list = state.logged.concat(SAMPLE_ACTS).map((a) =>'<div class="card" style="margin-bottom:10px"><div class="act"><div class="b"><div class="t">' + a.t + '</div><div class="d">' + a.d + '</div><div class="m"><div><b class="num">' + a.dist + '</b><span>Distance</span></div><div><b class="num">' + a.time + '</b><span>Time</span></div><div><b class="num">' + a.pace + '</b><span>Avg pace</span></div></div></div></div></div>').join("");
    return tabs + '<div style="font-size:12.5px;color:var(--ink-faint);margin:0 2px 12px">Your recent runs</div>' + list;
  }
  return tabs + viewPerformance();
}
function dimLevel(vo2) { return vo2 < 40 ? 1 : vo2 < 50 ? 2 : vo2 < 60 ? 3 : 4; }
function viewPerformance() {
  const t = FITNESS.thresholdSpeed, a = FITNESS.aerobicCapacity, d = FITNESS.durability;
  const lvl = dimLevel(a.value); const words = { 1:"Building your base", 2:"A solid base", 3:"Strong endurance", 4:"Very strong endurance" };
  const meter = [1,2,3,4].map((i) => '<i class="' + (i<=lvl?"on":"") + '" style="--rc:var(--build)"></i>').join("");
  const dRead = d.confidence === "none" ? '<div class="read q">We\\'ll learn this from your long runs</div>' : '<div class="read">Holds pace well</div>';
  return '<div class="card hero-pace"><div class="lab">Your strong, steady pace</div><div class="p num">' + fmtPace(t.value) + ' <small>/km</small></div><div class="s">The pace you can hold for a long, hard effort.</div></div>' +
    '<div class="card dim-card" style="margin-top:10px"><div class="lab">Endurance base</div><div class="plain">How big your aerobic engine is.</div><div class="read" style="--rc:var(--build)">' + words[lvl] + '</div><div class="dmeter">' + meter + '</div></div>' +
    '<div class="card dim-card" style="margin-top:10px"><div class="lab">Strength when tired</div><div class="plain">How well you hold pace late in long runs.</div>' + dRead + '</div>';
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
function seg(name, opts, val) { return '<div class="seg" data-set="' + name + '">' + opts.map((o) => '<button data-v="' + o[0] + '"' + (String(o[0]) === String(val) ? ' class="on"' : '') + '>' + o[1] + '</button>').join("") + '</div>'; }
function viewSetup() {
  const p = profile;
  return '<div class="eyebrow" style="margin:2px 2px 10px">' + (p.personalized ? "Your profile" : "Let's make this yours") + '</div>' +
    '<div class="card"><div class="subhead" style="margin-top:0">Your goal</div>' +
    '<div class="q"><label>Race</label><select class="sel" id="s_dist">' + opt(DIST_OPTS, p.goalDist) + '</select></div>' +
    '<div class="q"><label>Target time <span style="color:var(--ink-faint);font-weight:400">h:mm:ss</span></label><input class="sel num" id="s_target" value="' + fmtTimeFull(p.targetS) + '" inputmode="numeric"></div>' +
    '<div class="q"><label>Race date</label><input class="sel num" id="s_date" type="date" value="' + p.raceDate + '"></div></div>' +
    '<div class="card" style="margin-top:12px"><div class="subhead" style="margin-top:0">About you</div>' +
    '<div class="q"><label>A recent run — distance</label><select class="sel" id="s_recdist">' + opt(REC_OPTS, p.recentDistM) + '</select></div>' +
    '<div class="q"><label>…in a time of <span style="color:var(--ink-faint);font-weight:400">m:ss</span></label><input class="sel num" id="s_rectime" value="' + fmtTimeFull(p.recentTimeS) + '" inputmode="numeric"></div>' +
    '<div class="q"><label>Runs per week</label>' + seg("days", [["3","3"],["4","4"],["5","5"],["6","6"],["7","7"]], p.daysPerWeek) + '</div>' +
    '<div class="q"><label>Years running</label>' + seg("years", [["0.5","<1"],["2","1–3"],["5","3–8"],["10","8+"]], p.yearsRunning) + '</div>' +
    '<div class="q"><label>Age</label><input class="sel num" id="s_age" type="number" min="12" max="95" value="' + p.age + '" style="max-width:110px"></div>' +
    '<div class="q"><label>Sex <span style="color:var(--ink-faint);font-weight:400">helps tailor advice</span></label><select class="sel" id="s_sex"><option value=""' + (!p.sex?" selected":"") + '>Prefer not to say</option><option value="female"' + (p.sex==="female"?" selected":"") + '>Female</option><option value="male"' + (p.sex==="male"?" selected":"") + '>Male</option></select></div>' +
    '<div class="q"><label>Include strength &amp; conditioning?</label>' + seg("strength", [["1","Yes"],["0","No"]], p.strength?"1":"0") + '</div>' +
    '<div class="q"><label>Returning from injury / a break?</label>' + seg("returning", [["0","No"],["1","Yes"]], p.returning?"1":"0") + '</div></div>' +
    '<div class="card" id="typePreview" style="margin-top:12px"></div>' +
    '<div class="err" id="setupErr" style="display:none;color:var(--ease);font-size:13px;margin:12px 2px 0"></div>' +
    '<button class="primary" id="saveProfile">' + (p.personalized ? "Update my plan" : "Build my plan") + '</button>' +
    (p.personalized ? '<button class="primary" id="cancelSetup" style="background:var(--surface-2);color:var(--ink-soft)">Cancel</button>' : "");
}
// Draft profile from the setup form's current values (may throw on bad times).
function draftFromForm() {
  const mmss = (s) => /^\\d{1,2}:[0-5]\\d$/.test(s) || /^\\d{1,2}:[0-5]\\d:[0-5]\\d$/.test(s);
  const targetRaw = $("s_target").value.trim();
  if (!mmss(targetRaw)) throw new Error("Enter your target time as h:mm:ss or m:ss, e.g. 1:45:00.");
  const recRaw = $("s_rectime").value.trim();
  if (!mmss(recRaw)) throw new Error("Enter your recent run time as m:ss, e.g. 25:00.");
  const recentDistM = Number($("s_recdist").value);
  const recentTimeS = RC.parseDuration(recRaw);
  const pace = recentTimeS / (recentDistM / 1000);
  if (pace < 120 || pace > 720) throw new Error("That recent run time looks off for the distance — please check it.");
  const raceDate = $("s_date").value;
  if (!raceDate) throw new Error("Pick your race date.");
  if (raceDate <= todayIso()) throw new Error("Your race date needs to be in the future.");
  return {
    goalDist: $("s_dist").value, targetS: RC.parseDuration(targetRaw), raceDate,
    recentDistM, recentTimeS, daysPerWeek: Number(draft.days), yearsRunning: Number(draft.years),
    weeklyVolumeKm: profile.weeklyVolumeKm, age: Number($("s_age").value) || 35, sex: $("s_sex").value,
    strength: draft.strength === "1", returning: draft.returning === "1", personalized: true,
  };
}
let draft = {};
function refreshTypePreview() {
  try {
    const cls = RC.classifyRunner({ runsPerWeek: Number(draft.days), yearsRunning: Number(draft.years), sex: $("s_sex") ? ($("s_sex").value || undefined) : undefined });
    const m = RC.assessMasters({ age: Number(($("s_age") || {}).value) || 35, sex: $("s_sex") ? ($("s_sex").value || undefined) : undefined });
    const tp = $("typePreview"); if (!tp) return;
    tp.innerHTML = '<div class="eyebrow" style="margin:0 0 4px">Your runner type</div><div style="font-size:17px;font-weight:700;letter-spacing:-.01em">' + cls.label + '</div><div style="font-size:12.5px;color:var(--ink-soft);margin-top:4px">' + cls.meaning + '</div>' + (m.isMasters ? '<div style="font-size:12.5px;color:var(--ink-faint);margin-top:8px;border-top:1px solid var(--line);padding-top:8px">' + m.headline + '</div>' : '');
  } catch (e) {}
}

// ============ LIVE SESSION (in-app) ========================================
const KIND_COLOR = { warmup: "var(--base)", cooldown: "var(--base)", steady: "var(--base)", recovery: "var(--taper)", rep: "var(--peak)" };
let LIVE = null;
function startSession() {
  const s = rawToday();
  LIVE = { session: s, rt: new RC.LiveSession(s), vms: 0, dist: 0, hr: 105, timer: null, speed: 20, lastStep: -1, quirk: 0, done: false };
  state.screen = "live"; render();
}
function viewLive() {
  const s = LIVE.session;
  return '<button class="backbtn" id="liveBack">‹ Today</button>' +
    '<div class="card live-hero"><div class="eyebrow">Live session · sim ' + LIVE.speed + '×</div><div class="live-title">' + s.title + '</div>' +
    '<div class="live-metrics"><div><div class="lk">Elapsed</div><div class="lv num" id="lElapsed">0:00</div></div>' +
    '<div><div class="lk">Distance</div><div class="lv num" id="lDist">0.00<small> km</small></div></div>' +
    '<div><div class="lk">Pace</div><div class="lv num none" id="lPace">—</div></div></div></div>' +
    '<div class="card lstep" id="lStepCard"><div class="cnt">Press start when you\\'re ready.</div></div>' +
    '<div class="live-controls"><button class="primary" id="lStart">' + ICON.play + ' Start</button><button class="ctrl" id="lPause" disabled>Pause</button><button class="ctrl" id="lFinish" disabled>Finish</button></div>' +
    '<div class="card"><div class="subhead" style="margin-top:0">Coaching cues</div><div class="cuelog" id="lCues"><div style="color:var(--ink-faint);font-size:13px">Cues will appear as you run.</div></div></div>';
}
function livePace(step) { const band = step && step.targetPace; const mid = band ? (band.minSecPerKm + band.maxSecPerKm) / 2 : 360; LIVE.quirk += (Math.random() - 0.5) * 0.03; LIVE.quirk *= 0.9; if (Math.random() < 0.04) LIVE.quirk += (Math.random() - 0.5) * 0.28; return Math.max(120, mid * (1 + LIVE.quirk)); }
function liveHr(step) { if (!step) return 105; if (step.kind === "rep") return 176; if (step.kind === "warmup" || step.kind === "cooldown") return 130; if (step.kind === "recovery") return 148; return 150; }
function liveCue(cue) {
  const log = $("lCues"); if (!log) return; const empty = log.firstChild; if (empty && empty.style) empty.remove();
  const cls = cue.kind === "pace" ? "pace-" + cue.paceStatus : cue.kind === "step-start" ? "step" : cue.kind === "session-start" ? "start" : cue.kind === "session-complete" ? "done" : "";
  const e = el('<div class="cue ' + cls + '"><span class="badge"></span><span class="ct">' + fmtPace(cue.atMs / 1000) + '</span><span>' + cue.message + '</span></div>');
  log.insertBefore(e, log.firstChild);
}
function liveUpdate(snap) {
  $("lElapsed").textContent = fmtPace(snap.elapsedSeconds);
  $("lDist").innerHTML = (snap.distanceMeters / 1000).toFixed(2) + '<small> km</small>';
  const pv = $("lPace"); pv.textContent = snap.currentPaceSecPerKm ? fmtPace(snap.currentPaceSecPerKm) : "—"; pv.className = "lv num " + (snap.paceStatus || "none");
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
  liveUpdate(LIVE.rt.snapshot(LIVE.vms));
  if (LIVE.rt.getStatus() === "completed") { stopLive(); liveFinish(true); }
}
function startLoop() { if (!LIVE.timer) LIVE.timer = setInterval(liveTick, 200); }
function stopLive() { if (LIVE && LIVE.timer) { clearInterval(LIVE.timer); LIVE.timer = null; } }
function liveFinish(complete) {
  if (LIVE.done) return; LIVE.done = true; stopLive();
  if (!complete) LIVE.rt.stop(LIVE.vms).forEach(liveCue);
  const snap = LIVE.rt.snapshot(LIVE.vms);
  const km = snap.distanceMeters / 1000;
  if (km > 0.05) state.logged.unshift({ t: LIVE.session.title, d: "Today", dist: km.toFixed(2) + " km", time: fmtPace(snap.elapsedSeconds), pace: (snap.averagePaceSecPerKm ? fmtPace(snap.averagePaceSecPerKm) : "—") + " /km" });
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
    draft = { days: profile.daysPerWeek, years: profile.yearsRunning, strength: profile.strength ? "1" : "0", returning: profile.returning ? "1" : "0" };
    v.innerHTML = viewSetup();
    v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    refreshTypePreview();
    return;
  }
  if (state.screen === "live") {
    $("topTitle").textContent = "Session";
    v.innerHTML = viewLive(); v.scrollTop = 0;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("on"));
    wire();
    return;
  }
  $("topTitle").textContent = state.support ? "Support" : TITLES[state.tab];
  if (state.tab === "today") v.innerHTML = viewToday();
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
  document.querySelectorAll("[data-wk]").forEach((b) => b.onclick = () => { state.planWeek = Number(b.dataset.wk); document.querySelectorAll("[data-wk]").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("weekDetail").innerHTML = weekDetail(); });
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
    draft[s.dataset.set] = b.dataset.v; s.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); refreshTypePreview();
  }));
  ["s_age","s_sex"].forEach((id) => { const e = $(id); if (e) e.oninput = e.onchange = refreshTypePreview; });
  const setupBanner = $("setupBanner"); if (setupBanner) setupBanner.onclick = () => { state.screen = "setup"; render(); };
  const save = $("saveProfile"); if (save) save.onclick = () => {
    let pf; try { pf = draftFromForm(); } catch (e) { const er = $("setupErr"); er.style.display = "block"; er.textContent = e.message; return; }
    let out; try { out = applyProfile(pf); } catch (e) { const er = $("setupErr"); er.style.display = "block"; er.textContent = "That goal can't be planned yet — try a race date further out."; return; }
    profile = pf; PLAN = out.plan; RAW = out.raw; FITNESS = out.fitness; CLASS = out.classification; MASTERS = out.masters; state.planWeek = PLAN.defaultWeekIndex; saveProfileStore();
    state.screen = null; state.tab = "plan"; render();
  };
  const cancel = $("cancelSetup"); if (cancel) cancel.onclick = () => { state.screen = null; state.tab = "today"; render(); };
  // Live session wiring
  const startBtn = $("startSession"); if (startBtn) startBtn.onclick = startSession;
  const lb = $("liveBack"); if (lb) lb.onclick = () => { stopLive(); state.screen = null; state.tab = "today"; render(); };
  const lStart = $("lStart"); if (lStart) lStart.onclick = () => { LIVE.rt.start(LIVE.vms).forEach(liveCue); startLoop(); lStart.style.display = "none"; $("lPause").disabled = false; $("lFinish").disabled = false; };
  const lPause = $("lPause"); if (lPause) lPause.onclick = () => {
    const st = LIVE.rt.getStatus();
    if (st === "active") { LIVE.rt.pause(LIVE.vms).forEach(liveCue); stopLive(); lPause.textContent = "Resume"; }
    else if (st === "paused") { LIVE.rt.resume(LIVE.vms).forEach(liveCue); startLoop(); lPause.textContent = "Pause"; }
  };
  const lFinish = $("lFinish"); if (lFinish && !LIVE.done) lFinish.onclick = () => liveFinish(false);
}
function buildNav() {
  $("nav").innerHTML = ["today","plan","activities","community","support"].map((t) => '<button class="navbtn' + (t===state.tab?" on":"") + '" data-tab="' + t + '">' + ICON[t] + '<span class="nl">' + TITLES[t].replace("Your ","") + '</span></button>').join("");
  document.querySelectorAll(".navbtn").forEach((b) => b.onclick = () => { stopLive(); state.screen = null; state.tab = b.dataset.tab; if (b.dataset.tab !== "support") state.support = null; render(); });
}
$("profileBtn").innerHTML = ICON.person; $("bellBtn").innerHTML = ICON.bell; $("themeBtn").innerHTML = ICON.theme;
$("themeBtn").onclick = () => { const cur = document.documentElement.getAttribute("data-theme"); document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : cur === "light" ? "dark" : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark")); };
$("profileBtn").onclick = () => { state.screen = "setup"; render(); };
buildNav();
render();
</script>
</body>
</html>
`;

const outPath = join(here, "app.html");
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
