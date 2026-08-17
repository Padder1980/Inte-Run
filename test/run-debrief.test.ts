import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE POST-RUN DEBRIEF (Logbook run page) — commissioned implementation pack, 2026-08-16.
 *
 * The pack's own acceptance checklist names one release blocker: the heart-rate Zone 1–5 colours
 * must come from Inte-Run's existing canonical source, not from the teal placeholder bars in the
 * supplied reference and not from a local copy. That is the first group of tests here.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const src = () => readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");

/** Lift a function out of the built page, brace-matched. */
function lift(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
/** Everything the debrief adds, as one scope — used for sweeps that must cover all of it. */
function debriefScope(): string {
  const s = src();
  const a = s.indexOf("THE POST-RUN DEBRIEF — Logbook run page");
  const b = s.indexOf("function runOverviewHtml(run) {", a);
  assert.ok(a > 0 && b > a, "the debrief block moved; this sweep would measure nothing");
  return s.slice(a, b) + lift("viewRunDetail") + lift("wireRunDebrief");
}

// ---- release blocker: the HR-zone colour lock ---------------------------------------------------

test("BLOCKER: no zone colour is defined inside the debrief", () => {
  // ⚠️ The pack: "Do not add local replacement hex values, copy Runna's palette or infer colours
  // from the reference PNG." A local hex here would drift from Support > Training zones the first
  // time either was touched, and the runner would meet two different colour languages for one idea.
  const scope = debriefScope().replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  const hex = scope.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], "the debrief defines its own colours: " + hex.join(", "));
});

test("BLOCKER: zone bars, ranges and labels all read the canonical --hz tokens", () => {
  const fn = lift("rdZonesHtml");
  // Every one of the five, through the shared component's own --hz indirection.
  assert.match(fn, /--hz:var\(--hz' \+ \(i \+ 1\) \+ '\)/, "the bar does not take its colour from --hzN");
  assert.match(fn, /class="hz-bar/, "the shared .hz-bar component is not being reused");
  // ⚠️ AND THE BOUNDARIES COME FROM THE SAME LADDER AS EVERYTHING ELSE. A second copy of the
  // percentages here would let the debrief and the zones screen disagree about what zone 3 is.
  assert.match(fn, /HR_ZONE_FLOOR/, "zone boundaries are redefined rather than read from HR_ZONE_FLOOR");
  assert.match(fn, /maxHrEstimate\(\)/, "the ceiling is not the app's own estimate");
});

test("BLOCKER: --hz1..5 are declared in all four theme blocks", () => {
  // ⚠️ FOUR PLACES DEFINE THESE — :root, the prefers-color-scheme block and the two data-theme
  // blocks. A zone colour present in three of them renders differently depending on the runner's
  // OS setting, which reproduces for some people and not others.
  const html = page();
  for (let z = 1; z <= 5; z++) {
    const n = (html.match(new RegExp("--hz" + z + "\\s*:", "g")) || []).length;
    assert.ok(n >= 4, "--hz" + z + " is declared " + n + " times; every theme block needs it");
  }
});

test("BLOCKER: the reference's teal placeholder bars were not copied", () => {
  // The analysis reference draws all five zones in one teal. Five zones that share a colour cannot
  // be told apart, which is the reason that substitution was approved in the first place.
  const fn = lift("rdZonesHtml");
  // ⚠️ The token name is BUILT FROM THE LOOP INDEX, so there is no literal --hz3 to grep for — and
  // that is the stronger implementation, because a hand-written list of five can list four. Assert
  // the construction instead of the literals.
  assert.match(fn, /--hz' \+ \(i \+ 1\)/, "zones are not coloured per index");
  assert.ok(!/var\(--accent\)/.test(fn), "the zone bars fall back to the app accent, which is one colour for five zones");
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(fn), "a literal colour reached the zone rows");
});

// ---- content order, which the pack calls a contract ---------------------------------------------

test("the order is Route, metrics, verdict, evidence, plan, action, analysis, details, share", () => {
  const fn = lift("viewRunDetail");
  const want = ["rdHeroHtml", "rdTitleHtml", "rdMetricsHtml", "rdVerdictHtml", "rdEvidenceHtml",
    "rdPlanHtml", "rdNextHtml", "rdAnalysisHtml", "rdAdvancedHtml", "rdMetaHtml", "rdShareHtml"];
  let at = -1;
  for (const name of want) {
    const i = fn.indexOf(name + "(");
    assert.ok(i > at, name + " is out of order — the coaching must precede share, shoes and notes");
    at = i;
  }
});

test("there is exactly one share entry and Strava is inside it", () => {
  // ⚠️ The pack forbids separate Share and Send-to-Strava buttons. Strava is a destination in the
  // share flow; the existing upload path behind it is unchanged.
  const view = lift("viewRunDetail");
  assert.equal((view.match(/rdShareHtml\(/g) || []).length, 1, "more than one share entry point");
  assert.ok(!/stravaRunButtonHtml/.test(view), "Strava is a second button on the page");
  assert.match(lift("openRunShareSheet"), /stravaRunButtonHtml/, "Strava is missing from the share sheet");
});

// ---- the verdict ---------------------------------------------------------------------------------

test("discomfort outranks a technically good run", () => {
  // ⚠️ PRECEDENCE IS THE FEATURE. Praising the execution of a run somebody was hurting on is the
  // single worst thing this screen could do.
  const fn = lift("runVerdict");
  const pain = fn.indexOf("run.pain");
  const pct = fn.indexOf("pct >= 70");
  assert.ok(pain > 0 && pct > 0 && pain < pct, "the pain branch must be reached before any pace verdict");
});

test("an easy run is never praised for being quick", () => {
  const fn = lift("runVerdict");
  assert.match(fn, /easy && a\.fast > a\.n \/ 2/, "the too-fast-easy-run guard is missing");
  const guard = fn.indexOf("easy && a.fast");
  const achieved = fn.indexOf('state: "achieved"');
  assert.ok(guard < achieved, "a fast easy run can reach the achieved verdict");
});

test("no verdict diagnoses anything", () => {
  // One activity cannot show injury, illness, dehydration or overtraining, and the copy may not imply it.
  // ⚠️ COMMENTS STRIPPED FIRST. The code's own note says "do not diagnose ... dehydration ...",
  // so an unstripped sweep reports the warning against a word as an instance of it.
  const scope = debriefScope().replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  for (const w of ["dehydrat", "overtrain", "injured", "injury is", "illness", "you are ill"]) {
    assert.ok(!new RegExp(w, "i").test(scope), "the debrief diagnoses: " + w);
  }
});

test("an unplanned run gets no invented target", () => {
  const fn = lift("rdPlanHtml");
  assert.match(fn, /if \(!run\.steps\)/, "a run with no prescription is not handled");
  assert.match(fn, /free run/, "an unplanned run should say so rather than compare against nothing");
});

// ---- missing data --------------------------------------------------------------------------------

test("a missing metric is omitted, never shown as zero", () => {
  // ⚠️ A confident "0 m" reads as a measurement. Absence is the truth and an absent tile says it.
  const fn = lift("rdMetricsHtml");
  for (const [field, label] of [["run.elevGain > 0", "Elevation"], ["run.avgHr", "Avg HR"],
                                 ["run.cadence", "Cadence"], ["run.kcal", "Calories"],
                                 ["run.maxHr", "Max HR"], ["run.rpe", "RPE"]]) {
    assert.ok(fn.includes("if (" + field + ")"), label + " is not gated on having a value");
  }
});

test("cadence is persisted, or the tile could never appear", () => {
  // ⚠️ It was received from the pedometer into LIVE.cadence and never saved, so no run in the store
  // has ever carried it. A tile for a field nothing writes is the computed-and-discarded trap.
  const rec = lift("liveRunRecord");
  assert.match(rec, /cadence: LIVE\.cadN \? Math\.round\(LIVE\.cadSum \/ LIVE\.cadN\) : null/,
    "cadence is not written onto the run record");
  assert.ok(!/cadence: 0/.test(rec), "a zero cadence would render as a measurement of standing still");
});

// ---- the map transition --------------------------------------------------------------------------

test("the map fade is reversible and driven by scroll offset", () => {
  const fn = lift("wireRunDebrief");
  // ⚠️ NO ONE-WAY FLAG. Anything that latches "has faded" makes scrolling back up impossible.
  assert.match(fn, /v\.scrollTop/, "the transition does not read the live scroll offset");
  assert.match(fn, /addEventListener\("scroll"/, "nothing recomputes it as the runner scrolls");
  assert.ok(!/faded|hasFaded|didFade/.test(fn), "a latching flag would stop the map ever coming back");
  assert.match(fn, /pointerEvents = gone/, "the hidden map still catches taps");
  assert.match(fn, /aria-hidden/, "the hidden map is still in the accessibility tree");
});

test("Reduce Motion keeps the crossfade and drops the movement", () => {
  const fn = lift("wireRunDebrief");
  assert.match(fn, /prefers-reduced-motion/, "Reduce Motion is not honoured");
  assert.match(fn, /reduce \? "" :/, "parallax and scale still apply under Reduce Motion");
  assert.match(fn, /reduce \? 140 : 220/, "the crossfade distance is not shortened under Reduce Motion");
});

test("the debrief hides the app chrome from one place", () => {
  // ⚠️ Set on every render rather than toggled on entry and exit. There are a dozen ways off this
  // screen and one forgotten exit would leave the whole app with no navigation.
  const html = page();
  assert.match(html, /classList\.toggle\("rd-open", state\.screen === "runview"\)/,
    "rd-open is not derived from the current screen on every render");
  assert.match(html, /html\.rd-open \.topbar, html\.rd-open \.bottomnav \{ display: none; \}/,
    "the global chrome is not hidden on the debrief");
});

// ---- privacy --------------------------------------------------------------------------------------

test("redaction trims the route, it does not merely hide the pins", () => {
  // ⚠️ A polyline that still ends at the runner's front door is not private, however many markers
  // have been removed from it.
  const fn = lift("redactRouteEnds");
  assert.match(fn, /rdMetresBetween/, "redaction is not distance-based");
  const one = lift("runRoutePresentation");
  assert.match(one, /p\.map/, "hide-the-map is not handled");
  assert.match(one, /redactRouteEnds/, "hide-start-and-finish does not trim the line");
});

test("the hero and the share card make the same privacy decision", () => {
  // ⚠️ Two copies of this rule would mean a redacted map on screen and a full one in the picture the
  // runner posts — the worst possible way for a privacy feature to fail.
  const html = page();
  const uses = (html.match(/runRoutePresentation\(/g) || []).length;
  assert.ok(uses >= 3, "expected the hero, the share sheet and the tile loader to share one decision");
  assert.match(lift("rdHeroHtml"), /runRoutePresentation\(/, "the hero does not apply privacy");
  assert.match(lift("openRunShareSheet"), /runRoutePresentation\(/, "the share sheet does not apply privacy");
});

// ---- accessibility ----------------------------------------------------------------------------------

test("every chart carries a textual equivalent", () => {
  assert.match(lift("rdZonesHtml"), /rdZoneSummary/, "the zone chart has no textual summary");
  assert.match(lift("rdZoneSummary"), /zone/, "the summary does not name the zone");
  assert.match(lift("rdTrendsHtml"), /rd-sr/, "the trend panel has no textual equivalent");
});

test("tap targets reach 44pt, including the ones that stay visually smaller", () => {
  const html = page();
  // ⚠️ The tab pills are deliberately 38px so the bar is not visibly heavier than the design; the
  // hit area is extended instead, which is the rule the rest of the app already follows.
  assert.match(html, /\.rd-tab::after \{ content: ""; position: absolute;[^}]*height: var\(--tap\)/,
    "the analysis tabs are under the minimum tap target with no extended hit area");
  for (const sel of [".rd-ic", ".rd-next", ".rd-share", ".rd-acc-h", ".rd-meta-r"]) {
    const at = html.indexOf(sel + " {");
    assert.ok(at > 0, sel + " is missing");
    const rule = html.slice(at, html.indexOf("}", at));
    assert.match(rule, /(min-)?height: var\(--tap\)/, sel + " does not reach the 44pt minimum");
  }
});

test("every control in the debrief actually does something", () => {
  // ⚠️ THE OVERFLOW BUTTON SHIPPED WIRED TO NOTHING. It rendered, it sat in the top-right where every
  // iOS app puts its actions, and tapping it did nothing at all — reported within the hour of the
  // rebuild going live. The existing $("id")-must-resolve guard proves an id EXISTS; it cannot prove
  // a control is connected to anything, and "looks live, is inert" is its own class of defect that
  // this project has now shipped twice (the profile confirm button clicked a #saveSetup that was
  // nowhere in the app).
  //
  // So: collect every id="…" the debrief renders on a <button>, and require each to be reachable
  // from a handler — either by its own id or through a data- attribute sweep.
  const html = page();
  const scope = [lift("rdNavHtml"), lift("rdNextHtml"), lift("rdShareHtml"), lift("rdMetaHtml"),
    lift("rdAnalysisHtml"), lift("rdAdvancedHtml"), lift("openRunShareSheet"), lift("openRunMoreSheet"),
    lift("openPrivacySheet")].join("\n");
  const ids = [...scope.matchAll(/<button[^>]*id="([a-zA-Z0-9_]+)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 5, "expected several buttons, found " + ids.length);
  const wiring = lift("wireRunDebrief") + lift("openRunShareSheet") + lift("openRunMoreSheet") +
    lift("openPrivacySheet") + lift("wireSheetShare") + lift("wire");
  const dead = ids.filter((id) => !new RegExp('\\$\\("' + id + '"\\)').test(wiring));
  assert.deepEqual(dead, [], "these render as buttons and nothing wires them: " + dead.join(", "));

  // The attribute-driven controls need their sweep to exist too.
  for (const attr of ["data-rdtab", "data-rdacc", "data-rdmeta", "data-rdpriv"]) {
    assert.ok(new RegExp('querySelectorAll\\("\\[' + attr + '\\]"\\)').test(wiring),
      attr + " is rendered but never swept for handlers");
  }
});

test("the overflow offers the run's own actions, and delete leaves the screen", () => {
  const fn = lift("openRunMoreSheet");
  assert.match(fn, /Share this run/);
  assert.match(fn, /Route privacy/);
  assert.match(fn, /Delete this run/);
  // ⚠️ deleteRun re-renders, and this screen resolves its run BY ID — deleting while still on it
  // would land the runner on "Run not found." rather than back in the Logbook.
  const nav = fn.indexOf('state.screen = null');
  const del = fn.indexOf("deleteRunById");
  assert.ok(nav > 0 && del > nav, "the screen must be left before the run is deleted");
  // ⚠️ deleteRun already raises an undo toast; a second confirmation would be a dialog to dismiss
  // before an action that is already reversible.
  assert.match(lift("deleteRun"), /toastUndo/, "delete is no longer undoable, so it now needs a confirm step");
});

test("the hero map is composited at the hero's own shape, not a fixed 700x420", () => {
  // ⚠️ THE ROUTE CAME OUT STRETCHED, AND IT WAS TWO TRANSFORMS OVER ONE PICTURE. The composite was
  // always 700x420 (wide); the hero is nearly square. The canvas then COVERED its box — cropped,
  // scale 1.11 — while the route overlay, whose SVG carries preserveAspectRatio="none", STRETCHED to
  // fill the same box at scale 0.63. Squashed sideways, pulled vertically, and off the streets.
  // Matching the aspect at composite time is what removes both, rather than hiding one behind
  // object-fit.
  const fn = lift("buildOverviewMap");
  assert.match(fn, /function buildOverviewMap\(container, route, pw, ph\)/,
    "the compositor cannot be asked for a size");
  assert.ok(!/OVMAP_W \* dpr|drawImage\(md\.image, 0, 0, OVMAP_W/.test(fn),
    "the canvas is still hard-wired to the legacy card size");
  assert.match(fn, /routeMapSvg\(route, md\.proj, W, H\)/,
    "the route overlay is drawn at a different size from the map underneath");
  // ⚠️ QUANTISED, because the size is part of the cache key — keyed on a raw measurement, every
  // device width and every rotation mints its own stored picture and evicts real ones.
  assert.match(fn, /Math\.round\(n \/ 20\) \* 20/, "the requested size is not quantised for the cache key");

  const caller = lift("wire");
  // The compositor is handed the INNER layer now — see the two-layer note in the reveal test.
  assert.match(caller, /buildOverviewMap\(inner, rt, b\.width, b\.height\)/,
    "the hero does not pass its measured box");
  assert.match(caller, /\$\("rdMapIn"\) \|\| rdMap/, "there is no fallback if the inner layer is missing");
  // ⚠️ AND THE PLACEHOLDER MUST BE FRAMED THE SAME WAY. Framing the route by its own bounding box
  // while tiles load, then replacing it with the Mercator-framed version, is what made the line jump
  // from large to small a second after the screen opened.
  assert.match(caller, /routeMapFraming\(rt, W, H\)\.proj/,
    "the placeholder route is not drawn in the map's own framing");
  const load = lift("loadRouteMap");
  assert.match(load, /routeMapFraming\(route, pw, ph\)/,
    "the tiled map computes its own framing, so the two can drift apart again");
});

test("the start marker is the brand mark, drawn per-map so gradients cannot collide", () => {
  const fn = lift("routeMapSvg");
  assert.match(fn, /routeLogoMark\(/, "the start marker is not the brand mark");
  assert.ok(!/class="rt-start"/.test(fn), "the plain start dot is still being drawn");
  assert.match(fn, /routeFinishMark\(/, "the finish marker is not the chequered disc");
  assert.ok(!/class="rt-end"/.test(fn), "the plain finish ring is still being drawn");
  // ⚠️ Two route maps on one screen (the Logbook list) sharing a gradient or clip id means the second
  // silently adopts the first's geometry — and loses its fill, or is clipped away entirely, if the
  // first leaves the DOM. Asserted as the INVARIANT (the counter moves, both ids derive from it)
  // rather than as one spelling of the increment, which is what this pinned before and it broke on a
  // refactor that changed nothing about the behaviour.
  const defs = lift("routeLogoDefs");
  assert.match(defs, /RT_LOGO_N\s*\+\+|\+\+\s*RT_LOGO_N/, "the per-map counter never advances");
  assert.match(defs, /RT_LOGO_ID = "rtlg" \+ RT_LOGO_N|"rtlg" \+ \(\+\+RT_LOGO_N\)/, "the gradient id is not derived from the counter");
  assert.match(defs, /RT_CLIP_ID = "rtcl" \+ RT_LOGO_N/, "the clip id is not derived from the counter");
});

test("the finish marker reads as a finish at the size it is actually drawn", () => {
  // ⚠️ A CHEQUERED DISC, NOT A FLAG ON A POLE. The marker is about 22px across on screen; a pole
  // with a rectangle on it resolves to a smudge with a stick, which is worse than the plain ring it
  // replaces. The chequer carries the meaning; the flag's outline is the part that does not survive.
  const fn = lift("routeFinishMark");
  assert.match(fn, /\(i \+ j\) % 2/, "the chequer pattern is not generated");
  assert.match(fn, /clip-path="url\(#' \+ RT_CLIP_ID/, "the chequer is not clipped to the disc");
  assert.ok(!/#fc5200|var\(--accent\)/.test(fn), "the finish marker should not compete with the brand or Strava colour");
});

test("the run's identity block never invents a time", () => {
  // ⚠️ runStartMs falls back to 09:00 on the run's date when the id carries no timestamp — every
  // watch run, whose id is a UUID. That fallback exists for Strava's start_date_local, where
  // something must be sent. Printing it here would put an invented "at 09:00" on a run done in the
  // evening, in the one block whose job is to say which run this was.
  const known = lift("runStartMsKnown");
  assert.ok(!/09:00|dateIso \+ "T/.test(known), "the known-time helper inherited the 09:00 fallback");
  assert.match(known, /return null/, "it must be able to say the time is unknown");
  const when = lift("rdWhenText");
  assert.match(when, /runStartMsKnown\(/, "the block reads the fallback-free time");
  assert.ok(!/runStartMs\(/.test(when), "the block reads the fabricating helper");
});

test("the place lookup geocodes the middle of the route, not the start", () => {
  // ⚠️ The start of a run is very often somebody's front door, and this screen has just been given a
  // control for hiding exactly that. Sending those precise coordinates to a third party for a town
  // name would quietly contradict it.
  const fn = lift("runPlaceLookup");
  assert.match(fn, /route\[Math\.floor\(route\.length \/ 2\)\]/, "it geocodes an endpoint");
  assert.ok(!/route\[0\]|route\[route\.length - 1\]/.test(fn), "an endpoint is being sent to the geocoder");
  // Once per run, ever — the result is stored and the attempt is remembered even when it fails.
  assert.match(fn, /run\.placeTried/, "a failed lookup would be retried on every open");
  assert.match(fn, /\.catch\(\(\) => \{\}\)/, "a geocoder outage must not surface as an error");
  assert.match(fn, /toFixed\(4\)/, "full-precision coordinates are being sent when four places is a town");
});

test("View on Strava appears only when the run genuinely reached Strava", () => {
  const fn = lift("rdIdentityHtml");
  assert.match(fn, /run\.strava\.state === "done" && run\.strava\.id/,
    "the link would appear on runs that were never uploaded");
  assert.match(fn, /strava\.com\/activities\//, "the link does not point at the activity");
});

test("the sheet owns the vertical rhythm, so no block brings its own", () => {
  // ⚠️ MEASURED, NOT ARGUED: the share button and the stretch card sat 0px apart — touching — while
  // other joins were 24px. The screen mixes purpose-built .rd-* sections with three legacy .card
  // elements borrowed whole from the old debrief (notes, the effort question, the stretch offer),
  // and each brought whatever margin it carried in the list context it was written for.
  const html = page();
  const at = html.indexOf(".rd-sheet > * { margin-top:");
  assert.ok(at > 0, "the sheet does not set a default gap for its children");
  for (const rule of [
    '.rd-sheet > *:first-child { margin-top: 0; }',
    '.rd-sheet > .rd-sec { margin: var(--s6) 0 0; }',
    '.rd-sheet > .rd-sec + * { margin-top: var(--s3); }',
    '.rd-sheet > .card { margin-bottom: 0; }',
  ]) assert.ok(html.includes(rule), "missing spacing rule: " + rule);

  // ⚠️ And the blocks must NOT re-introduce their own. A margin here and a margin there is exactly
  // how the 0px join happened, and it cannot be seen by reading either rule alone.
  for (const sel of [".rd-next", ".rd-share", ".rd-adv", ".rd-identity", ".rd-title"]) {
    const i = html.indexOf(sel + " {");
    assert.ok(i > 0, sel + " is missing");
    const rule = html.slice(i, html.indexOf("}", i));
    assert.ok(!/margin(-top)?:\s*var\(--s[45]\)/.test(rule),
      sel + " sets its own vertical margin, which the sheet is supposed to own: " + rule.trim());
  }
});

test("both route markers take their size from one number", () => {
  // ⚠️ THEY MUST STAY THE SAME SIZE AS EACH OTHER, and two independent literals is exactly how the
  // heat card's two buttons drifted apart — a mismatch invisible until the pair sat side by side.
  // Measured after halving them: both render 17px wide on a 440pt viewport.
  const html = page();
  assert.match(html, /const RT_MARK_R = /, "the marker size is not a shared constant");
  assert.match(html, /const RT_MARK_RING = /, "the ring size is not a shared constant");
  for (const fn of ["routeLogoMark", "routeFinishMark"]) {
    const src = lift(fn);
    assert.match(src, /const R = r \* RT_MARK_R;/, fn + " sizes itself from its own literal");
    assert.match(src, /r \* RT_MARK_RING/, fn + " draws its ring from its own literal");
    // Any bare multiplier here is a second source of truth waiting to disagree with the first.
    const stray = (src.match(/r \* 0\.\d+/g) || []).filter((m) => !/RT_MARK/.test(m));
    assert.deepEqual(stray, [], fn + " still has hard-coded sizes: " + stray.join(", "));
  }
});

test("the plan comparison reads the band's real fields and renders its real shape", () => {
  const fn = lift("rdPlanHtml");
  // ⚠️ THE BAND IS A PaceRange — minSecPerKm / maxSecPerKm — NOT the {min,max} shape rband uses.
  // Reading the wrong one printed "NaN:NaN–NaN:NaN /km" on a real run. Every other reader in the
  // file already had it right; this was the only new one, and it is the same shape mistake that
  // broke the screenshot fixture earlier the same night.
  assert.match(fn, /a\.band\.minSecPerKm/, "the target pace reads the wrong band field");
  assert.match(fn, /a\.band\.maxSecPerKm/, "the target pace reads the wrong band field");
  assert.ok(!/a\.band\.min\b|a\.band\.max\b/.test(fn), "the {min,max} shape is still being read");
  // ⚠️ run.steps is an ARRAY OF ROWS ({tag, lab, tgt, rec}), not a sentence. Escaping it printed
  // "[object Object]" straight onto the screen.
  assert.ok(!/esc\(run\.steps\)/.test(fn), "run.steps is being rendered as a string");
  assert.match(fn, /r\.tag/, "the prescription rows are not rendered");
  assert.match(fn, /r\.lab/, "the prescription rows are not rendered");
});

test("the route and the basemap appear as one", () => {
  // ⚠️ The route is arithmetic and instant; the tiles take a second or two. Revealing each as it
  // became ready meant a bare line on an empty panel with the map catching up underneath — two
  // events where the runner sees one thing happening.
  const html = page();
  // ⚠️ TWO LAYERS, BECAUSE TWO THINGS OWN AN OPACITY HERE AND THEY CANNOT SHARE ONE ELEMENT. The
  // scroll transition writes .rd-map's opacity INLINE every frame; the reveal wants a transitioned
  // class. Inline always wins, so putting both on one element left the reveal dead and the visible
  // result decided by whichever ran last. It cannot be solved by transitioning the scroll opacity
  // either — that has to track the finger with no easing at all.
  assert.match(html, /\.rd-mapin \{ position: absolute; inset: 0; opacity: 0; \}/,
    "the hero is not held until the map is ready");
  assert.match(html, /\.rd-mapin\.ov-ready \{ opacity: 1; transition: opacity/, "there is no reveal");
  assert.ok(!/\.rd-map \{[^}]*opacity: 0/.test(html),
    "the reveal is back on the same element the scroll handler writes inline");
  assert.match(lift("wireRunDebrief"), /map\.style\.opacity/, "the scroll fade no longer owns .rd-map");
  // ⚠️ AND IT MUST REVEAL ON FAILURE TOO, or a phone with no signal gets a permanently blank hero
  // instead of the route on its own.
  const b = lift("buildOverviewMap");
  assert.match(b, /container\.classList\.add\("ov-ready"\);\n\s*\}\)\.catch\(\(\) => \{ container\.classList\.add\("ov-ready"\); \}\)/,
    "the reveal does not happen when the tiles fail");
});

test("a real prescription row cannot push the page sideways", () => {
  // ⚠️ IT DID. A real target line reads "36 min · 6.3 km · 5:28–5:58/km · RPE 2–3", and the row was
  // laid out with flex: 0 0 auto on it — which means it will not shrink. The row grew past the
  // viewport, and because #view is the scroll owner the WHOLE SCREEN gained a horizontal scroll:
  // headings clipped on the left, the overflow button off the right. Nothing in the row looked
  // wrong; the page moved.
  //
  // ⚠️ AND THE HARNESS MISSED IT BECAUSE THE FIXTURE WAS TOO KIND — a short "5:20–6:10 /km" target
  // fits, so the layout was verified against a prescription no plan produces. Fixtures have to carry
  // the longest real value, not a tidy one.
  const html = page();
  for (const [sel, need] of [
    [".rd-step ", /flex-wrap: wrap/],
    [".rd-step-l ", /min-width: 0/],
    [".rd-step-t ", /min-width: 0/],
  ] as const) {
    const at = html.indexOf(sel + "{");
    assert.ok(at > 0, sel + "is missing");
    const rule = html.slice(at, html.indexOf("}", at));
    assert.match(rule, need, sel + "can still refuse to shrink: " + rule.trim());
  }
  // ⚠️ A flex item defaults to min-width:auto and will not shrink below its content — the same trap
  // .view's min-height:0 exists for elsewhere in this file.
  const t = html.slice(html.indexOf(".rd-step-t {"), html.indexOf("}", html.indexOf(".rd-step-t {")));
  assert.ok(!/flex: 0 0 auto/.test(t), "the target line is back to refusing to shrink");
  assert.match(t, /overflow-wrap: anywhere/, "a single long token could still overflow");
});
