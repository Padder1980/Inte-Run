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
