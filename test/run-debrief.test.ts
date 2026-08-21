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
/**
 * The shared secondary-metric ladder, as a runnable function.
 * ⚠️ The array is a const, not a function, so lift() cannot reach it — it is sliced to its own closing
 * bracket and evaluated beside runMetricLadder, which is the only thing that reads it.
 */
function metricLadder(): (run: any, forShare?: boolean) => any[] {
  const html = page();
  const at = html.indexOf("const RUN_METRIC_LADDER = [");
  assert.ok(at >= 0, "RUN_METRIC_LADDER is not in the build");
  const end = html.indexOf("\n];", at);
  assert.ok(end > at, "RUN_METRIC_LADDER's closing bracket moved");
  return new Function(html.slice(at, end + 3) + "\n" + lift("runMetricLadder") +
    "\nreturn runMetricLadder;")() as (run: any, forShare?: boolean) => any[];
}
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
  // ⚠️ FOLLOW THE DELEGATION RATHER THAN PINNING THE OLD SHEET. openRunShareSheet opens the share
  // studio, which now hands its destinations to one sheet of its own — so the flow is four functions,
  // and asserting only on the delegator would pass on any body at all. The invariant is unchanged:
  // Strava is a destination inside the one share flow, and there is exactly one such flow.
  const flow = ["openRunShareSheet", "shareStudioHtml", "studioSheetHtml", "studioDestHtml"].map(lift).join("\n");
  assert.match(flow, /stravaRunButtonHtml/, "Strava is missing from the share flow");
  // ⚠️ AND THE CHAIN IS ASSERTED LINK BY LINK, or the string above could sit in a builder nothing calls —
  // which is the computed-and-discarded trap this project has met six times.
  assert.match(lift("openRunShareSheet"), /openShareStudio\(/, "the one share entry no longer opens the studio");
  assert.match(lift("shareStudioHtml"), /data-sst-sheetin/, "the studio renders no sheet for its destinations");
  assert.match(lift("studioSheetHtml"), /"dest"/, "the sheet dispatch does not know about the destinations");
  assert.match(lift("studioDestHtml"), /stravaRunButtonHtml/, "the destination sheet does not offer Strava");
  assert.match(lift("studioClick"), /studioSheet\("dest"\)/, "nothing opens the destination sheet");
  // ⚠️⚠️ THIS CLAUSE IS THE INVERSE OF WHAT IT WAS, AND THE INVARIANT IS KEPT RATHER THAN DELETED.
  // Until 2026-08-21 it forbade any destination whose label named a third-party app, because the app
  // cannot detect whether Instagram is installed and cannot hand it a story. The owner overruled the
  // conclusion and not the reasoning: "I want the icons to the different social media options like shown
  // in the screenshot, with the more button allowing the further options that we already have when
  // pressing share." Deleting the assertion would have been the lazy answer. What it was protecting —
  // that no control may claim something it cannot do — survives, stated the other way round:
  //   a destination MAY name an app, and if it does it must open the SYSTEM SHARE SHEET, where that app
  //   genuinely appears, and its accessible name must say so.
  // The whole-row honesty sweep (one route, no branching per tile, no promise of a post) lives in
  // test/share-studio.test.ts, which owns the tile builder; what is asserted here is the pack's own
  // requirement of one system-compatible fallback, and that the named tiles reach it.
  const dest = lift("studioDestHtml");
  // ⚠️ BOUNDED TO SST_DEST'S OWN LITERAL. A page-wide sweep for { id: "...", label: "..." } finds the
  // run-type grid and the tool row too, so it would inflate the set with rows this rule is not about.
  const html = page();
  const dAt = html.indexOf("const SST_DEST = [");
  assert.ok(dAt > 0, "SST_DEST is not in the build");
  const destLit = html.slice(html.indexOf("[", dAt), html.indexOf("\n];", dAt));
  const named = [...destLit.matchAll(/\{ id: "([a-z]+)", label: "([^"]+)"/g)].map((m) => ({ id: m[1]!, label: m[2]! }));
  assert.ok(named.length >= 4, "SST_DEST's records were not found, so this guard is measuring nothing");
  const thirdParty = named.filter((r) =>
    /instagram|whatsapp|facebook|twitter|snapchat|tiktok|messenger|threads|message/i.test(r.label));
  assert.ok(thirdParty.length >= 1,
    "no destination names an app any more, so the honesty rule below has nothing to protect");
  // ⚠️ EVERY ONE OF THEM REACHES THE SYSTEM SHEET, AND THERE IS ONE ROUTE FOR ALL OF THEM. Asserted as a
  // count, because a per-tile branch is how one tile comes to do something its logo does not imply.
  const go = lift("studioDest");
  assert.equal((go.match(/doShareRun\(/g) || []).length, 1,
    "the destination tiles no longer share one route to the system share sheet");
  assert.match(dest, /SST_DEST\.map\(studioDestTile\)/,
    "the tile row is not built from SST_DEST, so a named tile could be wired anywhere");
  // A URL scheme is still forbidden outright. LSApplicationQueriesSchemes now permits canOpenURL for five
  // of them, which is permission to ASK whether an app is there — the handoff itself is Swift, so a scheme
  // opened from the page would fail silently until somebody rebuilds in Xcode.
  for (const scheme of ["instagram:", "instagram-stories", "fb://", "whatsapp:", "twitter:", "snapchat:"]) {
    assert.ok(!dest.toLowerCase().includes(scheme) && !go.toLowerCase().includes(scheme),
      "the destination sheet opens a third-party app by URL scheme: " + scheme);
  }
  // ⚠️ THE FALLBACK AND THE PRIMARY ARE COLLECTED FROM EVERY SHAPE A DESTINATION CAN TAKE — a tile id, a
  // data-sst action — so moving one from one shape to the other cannot make this guard stop looking.
  const acts = named.map((r) => r.id)
    .concat([...dest.matchAll(/data-sst="([a-z]+)"/g)].map((m) => m[1]!));
  assert.ok(acts.includes("more"),
    "there is no catch-all destination, so the apps this app cannot name have nowhere to go: " + acts.join(", "));
  assert.ok(acts.includes("save"), "saving to the device is missing: " + acts.join(", "));
  assert.ok(acts.includes("caption"), "copying the caption is missing: " + acts.join(", "));
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
  //
  // ⚠️ RESTATED 2026-08-18, BECAUSE THE MECHANISM MOVED AND THE INVARIANT DID NOT. The six gates were
  // six literal `if` statements inside rdMetricsHtml, which is exactly why the share card had none of
  // them — its ledger carried distance, time and pace and could not reach the relevance ordering the
  // debrief had all along. They now live in RUN_METRIC_LADDER, read by both surfaces, so the two cannot
  // disagree about the third number on a run.
  //
  // ⚠️ AND IT ASSERTS BY RUNNING THE LADDER RATHER THAN BY MATCHING SPELLINGS, which is strictly
  // stronger: a hand-written list of six things to look for can list five, and this project has been
  // caught by that twice. Watched failing with the elevGain > 0 test loosened to a truthiness check.
  assert.match(lift("rdMetricsHtml"), /runMetricLadder\(run, false\)/,
    "the debrief has gone back to carrying its own gates");
  const rung = metricLadder();
  assert.deepEqual(rung({}), [], "a run with nothing to show still produces tiles");
  // The two fields both builders store as 0 rather than null, plus the four that are correctly nulled.
  assert.deepEqual(rung({ elevGain: 0, avgHr: 0, cadence: 0, kcal: 0, maxHr: 0, rpe: 0 }), [],
    "a zero is being rendered as a measurement");
  // Every rung is reachable, in the documented order, so none of them is dead.
  const all = rung({ elevGain: 11, avgHr: 148, cadence: 158, kcal: 402, maxHr: 163, rpe: 3 });
  assert.deepEqual(all.map((m: any) => m.key), ["elev", "avgHr", "cadence", "kcal", "maxHr", "rpe"]);
  assert.deepEqual(all.map((m: any) => m.v), ["11", "148", "158", "402", "163", "3/10"]);
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
  assert.ok(uses >= 3, "expected the hero, the share card and the tile loader to share one decision");
  assert.match(lift("rdHeroHtml"), /runRoutePresentation\(/, "the hero does not apply privacy");
  // ⚠️ RESTATED 2026-08-18, BECAUSE THE OLD VERSION PASSED ON A LIVE LEAK. It asserted that
  // openRunShareSheet mentions runRoutePresentation — which it did, to write the sentence explaining
  // what the card would show — while the card itself drew run.route RAW, so both privacy switches
  // produced a byte-identical picture with the runner's front door on it. The mechanism is that the
  // renderer cannot reach the run at all: it takes a model whose route field is already resolved.
  // ⚠️ NOTHING COMPARES THE TWO EXPORTED PICTURES. This comment used to claim a test file proved the
  // pixels differ, and that file has never existed — a claimed guard is worse than an admitted gap,
  // because the next person reads it and stops looking. What IS pinned is the structure below.
  assert.match(lift("shareCardModel"), /runRoutePresentation\(/, "the share card does not apply privacy");
  // ⚠️ RESTATED AGAIN 2026-08-18 (phase 2): DERIVED, NOT A HAND-WRITTEN LIST OF FIVE NAMES. The list
  // named cardRoute and cardPhoto, which no longer exist — so the very first rename made this guard
  // ERROR rather than fail, and the obvious repair is to edit the names, which is how a list quietly
  // stops covering the code it was written for. The invariant is that NOTHING the renderer reaches can
  // see the run, so the closure of everything drawShareCard calls is walked and every member checked.
  // A new sub-renderer added later is inside it by construction.
  const html2 = page();
  const seen = new Set<string>();
  const queue = ["drawShareCard"];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const body = lift(name);
    assert.ok(!/\brun\./.test(body), name + " reads the run directly, so it can bypass the privacy decision");
    for (const m of body.matchAll(/\b((?:card|share|draw)[A-Za-z0-9_]*)\s*\(/g)) {
      const cand = m[1]!;
      if (!seen.has(cand) && html2.includes("function " + cand + "(")) queue.push(cand);
    }
  }
  // The walk has to have actually gone somewhere, or a renderer that stopped calling anything would
  // pass by drawing nothing at all.
  assert.ok(seen.size >= 8, "the renderer closure collapsed to " + seen.size + ": " + [...seen].join(", "));
  // ⚠️ RESTATED A THIRD TIME 2026-08-19 (phase 4), FOR THE SAME REASON IT WAS RESTATED THE FIRST TWO.
  // It named cardLedger and cardLane — the interim composition and its chart — and both were deleted the
  // moment The Execution and The Progression were built, so the guard ERRORED on a correct change and
  // the obvious repair was again to edit the names. The invariant is that the walk reaches EVERY
  // template renderer, so the set is derived from the build: any function named share*Card is one, and
  // a fifth template is inside the guard the day it is written.
  const cards = [...new Set([...html2.matchAll(/function (share[A-Za-z0-9]*Card)\(/g)].map((x) => x[1]!))];
  assert.ok(cards.length >= 4, "the renderer has " + cards.length + " template cards; four are expected");
  for (const must of cards.concat(["sharePhotoDraw", "shareRouteDraw"])) {
    assert.ok(seen.has(must), must + " is not reachable from drawShareCard, so the guard is not covering it");
  }
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
    lift("openPrivacySheet") + lift("wirePrivacyToggles") + lift("wire");
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
  // ⚠️ THE CLAIM MOVED TO runStartExactMs WHEN THE TWO READERS WERE MADE ONE. runStartMsKnown used to
  // hold its own copy of the id arithmetic; a wrist run then began carrying a real start instant and a
  // second copy would have had to learn about it separately — two answers to "do we know when this run
  // began", one of which prints a time and one of which does not. It delegates now, so what has to be
  // true of it is true of what it delegates to: no 09:00 fallback, and it can still say "unknown".
  const known = lift("runStartMsKnown");
  assert.match(known, /runStartExactMs\(/, "the known-time helper no longer reads the exact-start helper");
  const exact = lift("runStartExactMs");
  for (const [name, src] of [["runStartMsKnown", known], ["runStartExactMs", exact]] as const) {
    assert.ok(!/09:00|dateIso \+ "T/.test(src), name + " inherited the 09:00 fallback");
  }
  assert.match(exact, /return null/, "it must be able to say the time is unknown");
  // And the fabricating one still has the fallback, or the split has moved the problem rather than
  // contained it.
  assert.match(lift("runStartMs"), /dateIso \+ "T09:00:00Z"/,
    "runStartMs lost the fallback Strava needs, so an undated run has no start at all");
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

test("View next run opens the plan, not Today", () => {
  // ⚠️ Today is by definition the session that has just been run, so sending the runner there after
  // a debrief lands them back on the thing they have just finished. The sessions AHEAD of them are
  // on the plan.
  // ⚠️ COMMENTS STRIPPED BEFORE SLICING. A character window is not a statement: the explanation
  // above this handler is longer than the window was, so the code it was meant to check fell outside
  // it and the guard failed on correct code. This project has recorded the same trap three times.
  const fn = lift("wireRunDebrief").replace(/^\s*\/\/.*$/gm, "");
  const at = fn.indexOf('$("rdNext")');
  assert.ok(at > 0, "the next-run action is not wired");
  const handler = fn.slice(at, at + 200);
  assert.match(handler, /state\.tab = "plan"/, "the next-run action does not open the plan");
  assert.ok(!/state\.tab = "today"/.test(handler), "it still goes to Today");
});

// ---- the recap story -----------------------------------------------------------------------------

test("every story panel is built from what the debrief already knows", () => {
  // ⚠️ NOTHING HERE COMPUTES A FACT OF ITS OWN. The story and the screen behind it must never tell
  // the runner two different things about the same run, so the panels read runAnalysis, runVerdict
  // and routeMapFraming — the same sources the debrief itself uses.
  const fn = lift("openRunStory");
  assert.match(fn, /runAnalysis\(run\)/, "the story recomputes rather than reusing the analysis");
  assert.match(fn, /runVerdict\(run, a\)/, "the story writes its own verdict");
  const panels = lift("storyPanelHtml");
  assert.match(panels, /routeMapFraming\(/, "the story frames the route its own way");
  assert.match(panels, /runRoutePresentation\(run\)/, "the story ignores route privacy");
});

/**
 * ⚠️ THE SCALE IS ABSOLUTE AND ITS GAIN IS 2, MEASURED AGAINST THE REFERENCE FRAME.
 *
 * A plain speed ratio (quick / sec) — which is what the first version of this guard accepted — draws the
 * reference's own splits (351 337 336 333 334 333) at 94.9 / 98.8 / 99.1 / 100 / 99.7 / 100 %: measured in
 * the DOM, 315 / 329 / 329 / 332 / 332 / 332 px on a 332px track, so three of the six bars are pixel
 * identical and the whole visible spread is 5.1% of the bar. The reference's own frame, same data,
 * measures 291 / 305 / 308 / 326 / 316 / 316 px — min/max 0.893 against our 0.949, roughly twice the
 * spread, and its slowest bar is visibly the shortest at a glance. Drawing the pace DEFICIT at 2x
 * reproduces that (100 - 2 * 100 * 18/333 = 89.2), so the gain is a measurement of the thing being
 * copied. The tolerances below are set from those two numbers, not from taste.
 *
 * ⚠️ THIS OVERTURNS A DELETED ASSERTION AND THE OWNER SHOULD KNOW. An older guard forbade
 * `r.sec / slow * 100` — "measured from zero every bar comes out the same length and the panel says
 * nothing" — and this scale IS measured from zero. The complaint was real, and it is answered by the gain
 * (an 18s spread now reads as 11% of the bar rather than 5%), by the average line being clamped onto the
 * bars, and by the quickest-kilometre beat. What the old normalise-to-the-run's-own-range formula did
 * instead was draw two kilometres ONE SECOND apart at 100% and 46%.
 */
/**
 * ⚠️ THE BAR SCALE IS ABSOLUTE, AND THIS GUARD REPLACES ONE THAT PINNED THE DEFECT IN PLACE.
 *
 * The old assertion required the literal `46 + 54 * (slow - r.sec) / span` — i.e. it required the run's
 * own min and max to set the scale. Measured consequences of that formula: two kilometres ONE SECOND
 * apart drew 100% and 46%, identical to two ninety seconds apart; five kilometres spanning two seconds
 * drew 100/73/46/100/73; and a single split — the owner's own 1.01 km run — was pinned at 46%, the
 * SHORTEST bar the scale can produce, under a caption reading "longer bar, quicker kilometre". So the
 * invariant it was defending ("faster is longer, and a consistent run still shows something") was true
 * while the picture it produced was false.
 *
 * Speed-proportional against the quickest kilometre keeps "faster is longer" and adds the property that
 * makes the average line mean anything: the same pace is always the same length. Asserted by RUNNING
 * the function rather than matching its source, because the source is what was wrong last time.
 */
test("the split bars are on an absolute scale, and faster is longer", () => {
  const pct = new Function("return " + lift("storyBarPct"))() as (sec: number, quick: number) => number;
  assert.equal(pct(338, 338), 100, "a lone split does not fill its bar");
  assert.equal(pct(333, 333), pct(351, 351), "the scale depends on which run it is in");
  assert.ok(pct(333, 333) > pct(351, 333), "slower is not shorter");
  // Two kilometres a second apart must look a second apart, not like the two ends of the chart. Under
  // the old normalised formula these were 100% and 46%; a small real difference must read as a small one.
  assert.ok(100 - pct(339, 338) <= 2, "a one-second spread is exaggerated (" + pct(339, 338) + "%)");
  // ⚠️ AND A REAL SPREAD MUST BE VISIBLE AT A GLANCE, WHICH IS WHERE THE OLD TOLERANCE WAS TOO KIND: it
  // accepted anything from 90% up, and the ratio scale's 95% is six near-identical lozenges. 5:51 against
  // 5:33 is the reference's own worst case and it measures 89.3% there; 94% would fail this.
  assert.ok(pct(351, 333) <= 92 && pct(351, 333) >= 86,
    "the reference's own spread is not reproduced (" + pct(351, 333) + "%, expected about 89)");
  // The six reference splits must not collapse into three lengths, which is what shipped.
  const ref = [351, 337, 336, 333, 334, 333].map((s) => pct(s, 333));
  assert.ok(new Set(ref).size >= 4, "the reference's six splits draw only " + new Set(ref).size + " lengths");
  assert.ok(Math.max(...ref) - Math.min(...ref) >= 9,
    "the visible spread is " + (Math.max(...ref) - Math.min(...ref)) + "% of the bar, which reads as flat");
  const fn = lift("storyPanelHtml");
  assert.ok(!/46 \+ 54 \* \(slow - r\.sec\) \/ span/.test(fn), "the bars are back on the run's own range");
  assert.match(fn, /storyBarPct\(/, "the rows do not use the shared scale");
  // ⚠️ THE AVERAGE LINE IS PLACED BY THE SAME FUNCTION. Computed separately the two could disagree,
  // and then neither means anything.
  // ⚠️ CLAMPED ONTO THE BARS, BUT STILL DERIVED FROM THE BAR SCALE. The average is by definition slower
  // than the quickest kilometre, so on the ratio scale it computed to 99% and the line rendered past the
  // right-hand end of the track — measured, a left edge of 353px on a 332px container, with avgX >= 78
  // adding the .end class that hangs the pill below the last bar as a caption. A line beside the chart
  // cannot show which kilometres sat above or below it, which is the only reason it exists.
  assert.match(fn, /const avgX = Math\.max\(6, Math\.min\(96, storyBarPct\(sv\.mean, sv\.quick\)\)\)/,
    "the average marker is positioned by something other than the bar scale, or is not clamped onto the bars");
  assert.match(fn, /story-avgl[\s\S]{0,200}--x:' \+ avgX/, "the marker does not use the position it computed");
});

/**
 * storySplitView, lifted and run — its three dependencies are passed in.
 *
 * ⚠️ THE ROW CAP IS READ OUT OF THE BUILD, NOT HARDCODED HERE. Passing a literal 10 made the cap test
 * structurally unable to fail: raising STORY_SPLIT_MAX to 999 in the app left the test measuring its own
 * constant and it passed on the broken build. Watched failing before this was believed.
 */
function splitMax(): number {
  const m = page().match(/const STORY_SPLIT_MAX = (\d+)/);
  assert.ok(m, "STORY_SPLIT_MAX is not in the build");
  return Number(m![1]);
}
function splitView() {
  const fmtPace = new Function("return " + lift("fmtPace"))();
  const storyBarPct = new Function("return " + lift("storyBarPct"))();
  return new Function("storyBarPct", "fmtPace", "STORY_SPLIT_MAX", "return " + lift("storySplitView"))(
    storyBarPct, fmtPace, splitMax()) as (a: any, run: any) => any;
}
const anal = (secs: [number, boolean?][], band?: any) => ({
  rows: secs.map((s, i) => ({ km: i + 1, sec: s[0], est: !!s[1],
    verdict: band ? (s[0] < band.minSecPerKm ? "fast" : s[0] > band.maxSecPerKm ? "slow" : "in") : "none" })),
  n: secs.length, band: band || null,
  inBand: band ? secs.filter((s) => s[0] >= band.minSecPerKm && s[0] <= band.maxSecPerKm).length : 0,
  fastest: Math.min(...secs.map((s) => s[0])), slowest: Math.max(...secs.map((s) => s[0])),
});

test("the splits panel cannot lose a kilometre off the top of the screen", () => {
  // ⚠️ MEASURED AT 375x812 ON THE OLD PANEL: twelve splits pushed the first rows under the header and a
  // 21-split half marathon put NINE of them off-screen entirely, with no scroller to recover them. The
  // band is fixed now and the rows divide it, so the cap is what keeps them legible — and it must SAY
  // that it is a sample, and must keep the two kilometres a runner would look for.
  const view = splitView();
  const max = splitMax();
  // ⚠️ 10 FITS AND 12 DOES NOT — measured on the fixed band at 375x812, and again at --tscale 1.3. A cap
  // that does not fit the band is not a cap, so the number itself is part of the invariant.
  assert.ok(max <= 10, "the row cap is " + max + ", which does not fit the band");
  const many = view(anal(Array.from({ length: 21 }, (_, i) => [330 + (i === 8 ? 60 : i % 3 * 7)] as [number])),
    { distKm: 21, dist: "21.00 km", pace: "5:38 /km" });
  assert.equal(many.shown.length, max, "the row count is not capped");
  assert.match(many.sub, new RegExp("Showing " + max + " of 21 kilometres"),
    "the panel does not say it is showing a sample");
  const kms = many.shown.map((r: any) => r.r.km);
  assert.ok(kms.includes(9), "the slowest kilometre was dropped from the sample");
  assert.ok(kms.includes(1) && kms.includes(21), "the first and last kilometres were dropped");
  // And a small run is not sampled at all.
  const few = view(anal([[330], [337], [344]]), { distKm: 3, dist: "3.00 km", pace: "5:37 /km" });
  assert.equal(few.shown.length, 3, "a three-split run is being sampled");
  assert.equal(few.note, "", "a three-split run claims to be a sample");
});

test("an estimated split is marked, and never sets the scale", () => {
  // ⚠️ AN ESTIMATED SPLIT IS ELAPSED TIME DIVIDED ACROSS KILOMETRES THE PHONE SLEPT THROUGH. runAnalysis
  // already refuses to judge one; letting it be the quickest or slowest kilometre would rescale every
  // measured bar against a number the app invented, and it was drawn as an ordinary measured row.
  const view = splitView();
  // ⚠️ THE ESTIMATED SPLIT MUST BE THE FASTEST ONE IN THE FIXTURE, or the test cannot discriminate: a
  // SLOW estimate does not set the minimum, so the first version of this passed with the exclusion
  // deliberately removed. Watched failing before it was believed.
  const v = view(anal([[330], [200, true], [335]]), { distKm: 3, dist: "3.00 km", pace: "5:35 /km" });
  assert.equal(v.quick, 330, "an estimated split is setting the scale");
  assert.equal(v.shown[0].pct, 100, "the measured rows are not scaled against a measured kilometre");
  assert.equal(v.shown[2].pct, 97, "the measured rows are not scaled against a measured kilometre");
  const fn = lift("storyPanelHtml");
  assert.match(fn, /row\.r\.est \? " est"/, "an estimated row is not marked in the markup");
  assert.match(fn, /row\.r\.est \? "est"/, "an estimated row does not say so in a word");
});

test("one split gets no splits panel at all, and no rail survives anywhere", () => {
  // ⚠️ THIS IS THE THIRD ANSWER TO THE OWNER'S OWN 1.01 km RUN, AND THE FIRST TWO BOTH SHIPPED. A single
  // bar has nothing to be read against (it was pinned at 46%, the shortest bar possible, under a caption
  // saying longer means quicker), so it became an 8px rail — and MEASURED on the shipped build the rail
  // left that panel's first element at y569.5 of 825: 69% of the screen empty, with a grey stripe and a
  // 3px tick as the only graphic on it. That is worse than the 46% void the verdict rebuild exists to
  // remove, and it is the same object that rebuild's own header calls a disabled iOS slider. The verdict
  // panel two beats later already charts that kilometre against its band, so this panel has nothing left
  // to add and is not built.
  assert.match(lift("storyPanelKinds"), /a\.n > 1\) kinds\.push\("splits"\)/,
    "a single kilometre still gets a splits panel of its own");
  const html = page();
  assert.ok(!/function storyBandStripHtml/.test(html), "the 8px rail is still in the build");
  assert.ok(!/story-bsrail|story-bsband|story-bsmk|story-bsbl|class="story-bstrip"/.test(html),
    "the rail's markup or CSS survived it, which is what the next person copies");
  assert.ok(!/\.story-onep/.test(html), "the one-split panel's own layout rules are still here");
  // ⚠️ THE PLURAL. "0 of 1 kilometres" was what shipped.
  const view = splitView();
  const two = view(anal([[330], [340]], { minSecPerKm: 320, maxSecPerKm: 350 }), { distKm: 2, dist: "2.00 km", pace: "5:35 /km" });
  assert.match(two.sub, /2 of 2 kilometres/, "the count does not agree with itself");
  // And a one-kilometre run is still fully charted — by storyBandSvg, on the verdict panel.
  const svg = bandSvg()(bandFixture([620], { minSecPerKm: 560, maxSecPerKm: 640 }));
  assert.match(svg, /class="story-bnd"/, "one kilometre against a band draws no lane");
  assert.match(svg, /class="story-bmk /, "one kilometre against a band draws no marker");
  assert.match(svg, /class="story-bndax"/, "one kilometre against a band draws no pace labels");
});

test("a real kilometre is never relabelled as the leftover distance", () => {
  // ⚠️ SPLITS ARE ONLY EVER RECORDED AT WHOLE KILOMETRE BOUNDARIES, so the old test —
  // (run.distKm - Math.floor(run.distKm)) > 0.08 — fired on a COMPLETE kilometre: a 5.60 km run with
  // five splits relabelled kilometre 5 as "0.60" while printing its full-kilometre pace, and the
  // debrief's own splits table two taps away still called it 5. The label must be keyed on the ROW.
  const fn = lift("storySplitView");
  assert.match(fn, /x\.r\.km > floorKm/, "the partial label is keyed on the run total, not on the row");
  assert.ok(!/\(run\.distKm - Math\.floor\(run\.distKm\)\) > 0\.08/.test(fn),
    "the 0.08 remainder test is back, so a whole kilometre gets a fractional label");
});

test("the panels are one list, so a missing panel cannot displace another", () => {
  // ⚠️ THE COUNT AND THE CONTENT WERE DECIDED SEPARATELY. storyPanelCount required avgHr AND a
  // three-point series; the HR panel itself was gated on avgHr alone. A run with an average heart rate
  // and no usable series — every indoor run with a companion watch, and every run logged before
  // hrSeries existed — silently lost the VERDICT panel, because the HR branch won the index the
  // verdict was computed at, and rendered an empty chart in its place. The bar count looked right.
  const kinds = lift("storyPanelKinds");
  assert.match(kinds, /storyHasHr\(run\)/, "the HR panel is not gated by the shared predicate");
  assert.match(kinds, /kinds\.push\("verdict", "card"\)/, "the verdict and card panels are not always present");
  assert.match(lift("storyHasHr"), /storyHrPoints\(run\)\.length >= 3/,
    "the predicate does not ask the drawing function whether it can draw");
  const panels = lift("storyPanelHtml");
  assert.match(panels, /STORY\.kinds\[i\]/, "the panels are still selected by index arithmetic");
  assert.ok(!/i === STORY\.n - 2/.test(panels), "a panel is still addressed by position");
  // The coach's read carries the evidence runVerdict already built, or the panel is wordless.
  assert.match(panels, /v\.chips/, "the verdict panel throws away its own chips");
});

test("the route panel draws over real dark tiles, through the existing cache", () => {
  const b = lift("buildStoryMap");
  assert.match(b, /routeMapFor\(route, W, H, MAP_STYLE_SHARE\)/,
    "the story map does not use the dark style, or bypasses the tile cache");
  assert.match(b, /mapAttributionFor\(md\.prov\)/,
    "attribution is a licence term and differs by provider — it must come from the provider that served");
  assert.ok(!/MAP_STYLE_RUN/.test(b), "the story panel uses the pale run-card basemap");
  // ⚠️ ONE FRAMING. The overlay is drawn at the stage's measured size and the tiles are asked for at the
  // same size, which is the same arithmetic loadRouteMap uses — so the line cannot jump when they land.
  const panels = lift("storyPanelHtml");
  assert.match(panels, /const W = STORY\.w, H = STORY\.h/, "the route panel is composited at a hardcoded size");
  // ⚠️ THE CONTAINER IS FOUND INSIDE THE PANEL, NEVER BY A DOCUMENT-WIDE id, AND THE PREVIOUS VERSION OF
  // THIS ASSERTION PINNED THE DEFECT IN PLACE. It required the literal $("storyMap"), and the cross-
  // dissolve deliberately leaves the outgoing panel in the DOM for 520ms — so two elements carried that
  // id, getElementById returned the OUTGOING one, and buildStoryMap composited the tiles AND the
  // attribution into the node removed half a second later. Measured on a real tap of the left third of
  // panel 0 (which clamps back to 0 and re-renders): duplicate ids 2, the live panel with no canvas, no
  // ov-ready and no attribution at +1.5s, +4s and +9s — never recovering — while the tiles were fetched
  // and discarded, which on Mapbox is billable. Asserted as "no id on the container" as well as "found by
  // class", because the fix is that the id does not exist to be looked up.
  const show = lift("storyShow");
  assert.match(show, /buildStoryMap\(p\.querySelector\("\.story-map"\), pres\.route, STORY\.w, STORY\.h\)/,
    "the map is built from a document-wide lookup, or at a different size from the overlay");
  assert.ok(!/id="storyMap"/.test(page()), "the story map container carries an id again, so it can be duplicated");
  // Same trap, same 520ms window, the two controls the last panel exists for: bound from the document
  // they attached to the outgoing card and the visible Share button had no handler at all.
  assert.match(show, /p\.querySelector\("\.story-share"\)/, "the Share button is bound from the document");
  assert.match(show, /p\.querySelector\("\.story-later"\)/, "the Maybe later button is bound from the document");
  assert.ok(!/\$\("storyShare"\)/.test(page()), "something still resolves the Share button by id");
});

test("the draw-in has a from-state, and the dash length is measured", () => {
  // ⚠️ A SINGLE requestAnimationFrame IS NOT A STYLE FLUSH IN WEBKIT: the initial and final computed
  // styles collapse into one recalc and no transition starts. Measured on the shipped build, the route
  // "drew" inside one 0.4s frame after a single frame of disconnected fragments.
  const fn = lift("storyShow");
  assert.match(fn, /void p\.offsetWidth;\s*\n\s*p\.classList\.add\("in"\)/,
    "the panel gets no reflow between insertion and .in, so nothing transitions");
  assert.match(fn, /bars\.forEach\(\(b\) => b\.classList\.remove\("done", "live"\)\)/,
    "the progress bars get no from-state, so the first one is instantly full");
  // ⚠️ pathLength="1" DID NOT SURVIVE preserveAspectRatio="none" — dasharray:1 was applied as one user
  // unit and the route drew as dozens of 1px stubs. getTotalLength is transform independent.
  assert.match(lift("storyDashSetup"), /getTotalLength\(\)/, "the dash length is not measured");
  assert.ok(!/pathLength/.test(lift("storyRouteDraw")), "the draw-in is back on pathLength normalisation");
  const html = page();
  assert.match(html, /\.story-route \.rt-line \{[^}]*stroke-dasharray: var\(--rl, none\)/,
    "the dash is not driven by the measured length");
});

test("the wait is per panel, and the progress bar is driven by the same number", () => {
  // ⚠️ EVERY PANEL USED TO GET 4600ms — wrong in both directions, and the bar was a second constant
  // that could disagree with it. JS owns the number, CSS owns the property.
  const html = page();
  assert.match(html, /\.story-bar\.live i \{[^}]*transition: width var\(--story-dur, 4\.6s\) linear/,
    "the progress bar still animates over a fixed duration");
  const fn = lift("storyShow");
  assert.match(fn, /setProperty\("--story-dur", total \+ "ms"\)/, "the panel's duration is not published to CSS");
  assert.match(fn, /const total = STORY\.beats\.reduce/, "the wait is not the sum of the panel's beats");
  assert.ok(!/STORY_MS/.test(fn), "the single-duration constant is back");
});

test("the last panel does not close itself while somebody is deciding", () => {
  // ⚠️ It ends in a choice — Share or Maybe later. A panel that auto-advances off a decision makes
  // the decision for them.
  const fn = lift("storyShow");
  assert.match(fn, /if \(STORY\.i < STORY\.n - 1\) STORY\.timer = setTimeout/,
    "the final panel still auto-advances");
  assert.match(fn, /clearTimeout\(STORY\.timer\)/, "advancing does not cancel the previous timer");
});

test("the story is an offer, not something that happens to you", () => {
  // ⚠️ It opens from a thumbnail the runner taps. It must never appear on its own after a run: a
  // recap that interrupts is one people learn to dismiss without reading.
  const html = page();
  assert.match(lift("wireRunDebrief"), /\$\("rdStory"\)/, "the story has no entry point");
  const auto = (html.match(/openRunStory\(/g) || []).length;
  assert.equal(auto, 2, "openRunStory should be defined once and called from exactly one tap handler");
  // Share hands off to the existing sheet rather than growing a second share path.
  assert.match(lift("storyShow"), /openRunShareSheet\(STORY\.run\)/, "the story has its own share flow");
});

test("the tap zones cannot swallow the buttons on the last panel", () => {
  // ⚠️ THIS GUARD USED TO COMPARE TWO z-index INTEGERS FROM DIFFERENT STACKING CONTEXTS, so it passed
  // 5 > 2 while the Share button was 100% dead: .story-p is its own stacking context, so .story-acts's
  // z-index is sorted INSIDE the panel and can never outrank a zone that is a sibling of the stage.
  // Measured on the shipped build, elementFromPoint over every 6px of #storyShare returned storyPrev or
  // storyNext and never once the button; clicking the real topmost element moved the story BACK a panel.
  // Paint order cannot be the fix, so the invariant is GEOMETRY: the zones stop above the actions.
  //
  // ⚠️ AND THE VERSION OF THIS GUARD THAT REPLACED THE z-index COMPARISON WAS JUST AS VACUOUS. It required
  // only that a "bottom: calc(" declaration existed, never that its number cleared anything — and the
  // number it was passing, 132px, stopped the zones 36-45px SHORT of the actions: elementFromPoint swept
  // over #storyShare returned storyNext or storyPrev for 84 of 97 points, so 9-13% of the button was live
  // at the default text size. The value needed to clear was 168-177px, and worse, it varies: at --tscale
  // 1.3 the same 132px left 89% of the button live, because the card grows and pushes the actions down. So
  // the failure was worst at the setting almost everybody uses, and NO constant can be right across the
  // type scale, the safe-area inset and a card whose height depends on how many stat tiles the run has.
  // The invariant is therefore that the stop is MEASURED FROM THE BUTTONS: a constant in the stylesheet is
  // only the fallback for the frame before the measurement lands.
  const html = page();
  assert.match(html, /\.story-ov\.st-last \.story-tap \{[^}]*bottom: var\(--story-tapstop/,
    "the tap zones stop at a hardcoded distance again, which cannot clear the buttons at every text size");
  const stop = lift("storyTapStop");
  assert.match(stop, /querySelector\("\.story-acts"\)/, "the stop is not measured from the actions themselves");
  // ⚠️ MEASURED IN LAYOUT COORDINATES. getBoundingClientRect runs here while the panel is mid-transform
  // (scale 1.04 about its centre reports the actions about 11px lower than they settle), which quietly
  // spends the whole safety margin; offsetTop is untransformed.
  assert.match(stop, /acts\.offsetTop/, "the stop is not measured from the actions' own layout position");
  assert.ok(!/getBoundingClientRect/.test(stop), "the stop is measured from a transformed box again");
  assert.match(stop, /setProperty\("--story-tapstop"/, "the measured stop is never published to CSS");
  assert.match(lift("storyShow"), /storyTapStop\(ov, p\)/, "nothing measures the stop when a panel is shown");
  // The fallback must at least clear the measured need (168-177px at --tscale 1) rather than sitting under
  // the buttons for however long the first frame lasts.
  const fb = html.match(/\.story-ov\.st-last \.story-tap \{[^}]*var\(--story-tapstop, calc\((\d+)px/);
  assert.ok(fb, "the tap-zone stop has no fallback at all");
  assert.ok(Number(fb![1]) >= 180, "the fallback stop is " + fb![1] + "px, under the measured 177px need");
  assert.match(lift("storyShow"), /classList\.toggle\("st-last", STORY\.i === STORY\.n - 1\)/,
    "nothing marks the last panel, so the shortened zones never apply");
  assert.match(lift("closeRunStory"), /remove\("on", "st-last"\)/, "st-last outlives the story");
});

test("Reduce Motion removes the drawing, not the story", () => {
  const html = page();
  for (const sel of [".story-route.in .rt-line", ".story-p.in .story-split", ".story-bar.live i"]) {
    assert.ok(html.includes(sel), "missing animated rule: " + sel);
  }
  const rm = html.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*story[^}]*\}/g) || [];
  assert.ok(rm.length >= 3, "Reduce Motion does not cover the story animations (" + rm.length + " blocks)");
});

// ---- the recap story: the faults found by three independent verifiers, 2026-08-17 ----------------

test("the heart-rate panel states the maximum its own axis draws", () => {
  // ⚠️ IT QUOTED run.maxHr WHILE THE AXIS LABELLED THE SMOOTHED PEAK. storyHrPoints applies a rolling
  // mean, which reads lower than the peak beat by construction, and the series is thinned to 160 points,
  // which can drop the true peak outright — so the panel's own two halves disagreed on every run with a
  // series: measured, axis ticks ["147 bpm", "120 bpm"] under a sentence reading "Reaching a max of 152
  // bpm", and ["148 bpm", "118 bpm"] under 153 at the real thinning cap. The feature's own header says the
  // story and the screen behind it can never tell the runner two different things.
  const peak = lift("storyHrPeak");
  assert.match(peak, /storyHrPoints\(run\)/, "the peak is not derived from the series the picture draws");
  assert.match(peak, /Math\.max\(run && run\.maxHr > 0 \? run\.maxHr : 0, trace\)/,
    "the peak is not the larger of the measured max and the trace, so the frame can cut the trace off");
  const beats = lift("storyBeats"), svg = lift("storyHrSvg");
  assert.match(beats, /storyHrPeak\(run\)/, "the sentence quotes a maximum of its own again");
  assert.match(svg, /storyHrPeak\(run\)/, "the chart derives its own maximum");
  assert.ok(!/Math\.round\(run\.maxHr\) \+ " bpm"/.test(beats), "the sentence is back on run.maxHr directly");
  // ⚠️ AND NOTHING IS TICKED AT THE SERIES MINIMUM, because the trace touches its own minimum by
  // construction and so struck the label out — measured, 13 of 400 sampled points of the path inside the
  // lower label's own box, at both series lengths. The peak rule sits above every point of the trace.
  assert.ok(!/tick\(lo\)/.test(svg), "the axis ticks the series minimum again, which the trace always crosses");
  assert.match(svg, /const peakRule = peak > y0 && peak < y1/, "the peak has no rule to label");
  // The average was in the headline and nowhere in the picture; the reference draws it as a line with a
  // pill at the end of it.
  assert.match(svg, /story-hravl/, "the average has no line");
  assert.match(svg, /avg \+ ' bpm/, "the average pill does not carry its unit");
});

test("the heart-rate chart fills the panel instead of starting at its midpoint", () => {
  // ⚠️ MEASURED: our ink spanned y 0.505-0.904 of the panel (39.9%), the reference's 0.099-0.795 (69.6%).
  // In flow with margin-top: auto the chart was pinned to the bottom and the whole upper half was bare
  // gradient. The frame is taller and the block is anchored under the header.
  const svg = lift("storyHrSvg");
  const m = svg.match(/const W = 380, H = (\d+)/);
  assert.ok(m, "the heart-rate frame no longer declares its size");
  assert.ok(Number(m![1]) >= 520, "the frame is " + m![1] + " tall, which cannot fill the panel");
  const html = page();
  assert.match(html, /\.story-hrp \.story-hr \{[^}]*position: absolute/,
    "the chart is back in flow, so it sits wherever the statement leaves it");
  assert.match(html, /\.story-hrp \.story-hr::after \{[^}]*linear-gradient/,
    "the statement has no ground of its own, so it sits directly on the trace");
});

test("the deleted band rail leaves nothing behind that can be read as a data graphic", () => {
  // ⚠️ THE RAIL WAS MOVED TWICE AND WRONG BOTH TIMES, AND THIS TEST USED TO BLESS THE SECOND MOVE. It was
  // the verdict panel's only graphic (an 8px stripe with a .42 grey band and a 3px tick, which on a
  // half-empty screen reads as a disabled iOS slider), was demoted to the one-split splits panel — and
  // measured there it left THAT panel 69% empty as its sole graphic, worse than the 46% void it was
  // demoted to escape. The fault was never the placement, so nothing is placed: storyBandSvg draws a
  // single kilometre as a filled lane with the marker in or out of it, with both band paces plated.
  const html = page();
  for (const dead of ["storyBandStripHtml", "story-bstrip", "story-bswrap", "story-bslab",
    "story-bsrail", "story-bsband", "story-bsmk", "story-bsbl", "story-bsc", "story-onep"]) {
    assert.ok(html.indexOf(dead) < 0, "the rail's " + dead + " is still in the build");
  }
  // ⚠️ AND THE THING IT DID RIGHT SURVIVES: the band's own two paces are printed where the band IS, which
  // is the fix its own comment recorded (pinned to the ends of a rescaled rail, a pace four minutes
  // outside the band read as comfortably inside it). On the chart they are plated at the lane's edges.
  const fn = lift("storyBandSvg");
  assert.match(fn, /plateAt = \[\[roomy \? yTop \+ 15 : yTop - 6, fmtPace\(bmin\)\]/,
    "the band's paces are no longer placed from the lane's own edges");
});

test("a plate never covers a kilometre, and the mean pill has a gutter of its own", () => {
  // ⚠️ THE THIRD FIRING OF ONE COLLISION CLASS IN THIS CHART. Measured on the live panel: the mean pill is
  // pushed last and is 94% opaque, so on a 21-kilometre run it covered markers 18 and 19 — two kilometres
  // unreadable, merged with it into one white blob — and sat on the pace line as well; its dashed rule
  // crossed a band plate's digits. Drawing a marker on top instead just puts a datum through the pill's
  // own number, which is the fault the deleted rail's caption already shipped ("10:21" with the marker
  // between the 0 and the 2). So the DATA now stops short of the pill's column and the pill lives in that
  // gutter, and the rule is painted UNDER every datum instead of over them.
  const fn = lift("storyBandSvg");
  assert.match(fn, /const gut = drawMean \? 62 : 0/, "no gutter is reserved for the mean pill");
  assert.match(fn, /const iw = W - LP - RP - gut/, "the data still spans the pill's own column");
  // The rule is pushed before the markers and the plates; only the pill is last.
  const ruleAt = fn.indexOf("story-bnavl"), mkAt = fn.indexOf("story-bmk "), plAt = fn.indexOf("story-bndplate");
  const pillAt = fn.indexOf("story-bncb");
  assert.ok(ruleAt > 0 && mkAt > 0 && plAt > 0 && pillAt > 0, "the chart's own marks moved");
  assert.ok(ruleAt < mkAt && ruleAt < plAt, "the mean's rule is still painted over the data it annotates");
  assert.ok(pillAt > mkAt, "the pill is not the last mark, so its own digits can be covered");
  // ⚠️ ASSERTED AS GEOMETRY, NOT AS SOURCE. Every marker box against the pill's box, on the fixture that
  // measured the collision: 21 kilometres with the mean in the middle of them.
  const secs = [330, 325, 318, 316, 322, 329, 334, 321, 317, 315, 319, 324, 328, 331, 326, 320, 314, 312, 318, 323, 311];
  const svg = bandSvg()(bandFixture(secs, { minSecPerKm: 315, maxSecPerKm: 325 }));
  const box = (re: RegExp) => {
    const m = svg.match(re);
    assert.ok(m, "not drawn: " + re);
    return { x: Number(m![1]), y: Number(m![2]), w: Number(m![3]), h: Number(m![4]) };
  };
  const pill = box(/class="story-bncb" x="([\d.]+)" y="([\d.-]+)" width="(\d+)" height="(\d+)"/);
  const marks = [...svg.matchAll(/class="story-bmk [^"]*" x="([\d.]+)" y="([\d.-]+)" width="(\d+)" height="(\d+)"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
  assert.equal(marks.length, secs.length, "a kilometre is missing from the plot");
  const hits = (a: any, b: any) => a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
  const covered = marks.filter((m) => hits(pill, m));
  assert.deepEqual(covered, [], "the mean pill is drawn over " + covered.length + " kilometre marker(s)");
  const plates = [...svg.matchAll(/class="story-bndplate" x="([\d.]+)" y="([\d.-]+)" width="(\d+)" height="(\d+)"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
  assert.equal(plates.length, 2, "the band's two paces are not both plated");
  for (const pl of plates) {
    assert.deepEqual(marks.filter((m) => hits(pl, m)), [], "a plated pace is drawn over a kilometre marker");
    assert.ok(!hits(pl, pill), "the mean pill is drawn over a plated band pace");
  }
});

test("a run with no prescribed pace still gets a vertical scale", () => {
  // ⚠️ paceChartSvg RECORDS THIS EXACT FIX FOR ITSELF, and this chart shipped with the defect: "A SHAPE
  // WITH NO SCALE MEANS NOTHING. The y labels were drawn only inside the band branch, so a run by feel got
  // a line floating in an empty box — you could not tell whether that dip was two seconds or two minutes."
  // Measured on a bandless six-kilometre fixture: lane false, plates 0, mean pill false — a bare polyline
  // with kilometre numbers along the bottom and nothing whatever on the y axis, while the SPLITS panel of
  // the same story printed an average pace pill. Two panels of one recap disagreeing about whether the run
  // has a reference pace.
  const a = bandFixture([352, 340, 333, 329, 344, 331], null) as any;
  a.workPaceSec = null;                 // runAnalysis: no band means no judged kilometres
  a.avgPaceSec = 337;                   // ...but the run's own average is still a fact
  const svg = bandSvg()(a);
  assert.ok(!/class="story-bnd"/.test(svg), "a run with no band is drawn with a target lane");
  const labels = [...svg.matchAll(/class="story-bndax"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ["5:29", "5:52"], "the fastest and slowest kilometres do not label the scale");
  assert.match(svg, /class="story-bncb"/, "the run's own average is not drawn");
  assert.match(svg, /class="story-bnct"[^>]*>5:37</, "the average pill does not carry the run's average pace");
  // ⚠️ AND THE PILL IS THE SAME NUMBER THE SPLITS PANEL PRINTS. storySplitView's mean is run.avgPaceSec,
  // so reading it from anywhere else here is how the two panels came to disagree.
  assert.match(lift("storyBandSvg"), /a\.workPaceSec \|\| a\.avgPaceSec \|\| 0/,
    "the chart's average is not the run's own average when there is no work pace");
});

test("the recap is offered without a route, and only the ROUTE panel needs one", () => {
  // ⚠️ TWO FAULTS, ONE CAUSE: the chip asked whether there was a map and the panel asked nothing at all.
  // A treadmill run's first panel was a black screen reading "DISTANCE / km" and "PACE / /km" — orphaned
  // units with no values — reachable only because the chip withheld the entire recap without a route,
  // which also cost every treadmill runner the splits, the heart rate and the coach's read. And Route
  // privacy set to "Map hidden" made the chip vanish with no explanation: measured across three privacy
  // states, {ends:false,map:true} gave recapChip false with four perfectly good panels behind it.
  assert.match(lift("storyPanelKinds"), /runRoutePresentation\(run\)\.route/,
    "the route panel is not gated on there being a route");
  const chip = lift("rdStoryChipHtml");
  assert.ok(!/pres\.route/.test(chip), "the recap chip is gated on a route again");
  assert.match(chip, /if \(!run\) return ""/, "the chip does not guard its own input");
});

test("a unit never appears without a value", () => {
  const tile = new Function("esc", "return " + lift("storyStatTile"))((s: string) => s) as
    (k: string, v: unknown, u: string, cls?: string) => string;
  assert.equal(tile("Distance", "", "km"), "", "an empty distance still prints its unit");
  assert.equal(tile("Time", null, ""), "", "a missing time still prints a tile");
  assert.equal(tile("Pace", "—", "/km"), "", "an em dash still prints a tile");
  assert.match(tile("Distance", "5.51", "km"), /5\.51/, "a real value is dropped");
  const fn = lift("storyPanelHtml");
  assert.ok(!/run\.time \|\| "—"/.test(fn), "a missing time is padded with an em dash again");
});

test("the splits panel's average agrees with the sentence beside it", () => {
  // ⚠️ TWO WAYS IT DISAGREED, AND BOTH WERE MEASURED. The mean was taken over the rows ON SCREEN, so a
  // 0.51 km partial counted as a full kilometre (pill 5:37 against a headline of 5:38, forty pixels
  // apart); and once sampling kicks in — every run over 10 km — it was the mean of ten rows deliberately
  // chosen to include the slowest one (pill 5:13 against a statement of 5:09, on a 21-split half marathon).
  const view = splitView();
  const many = view(anal(Array.from({ length: 21 }, (_, i) => [330 + (i === 8 ? 60 : i % 3 * 7)] as [number])),
    { distKm: 21, dist: "21.00 km", pace: "5:09 /km", avgPaceSec: 309, sec: 6489 });
  assert.equal(many.mean, 309, "the average is still taken from the sampled rows, not from the run");
  const part = view(anal([[351], [337], [336], [333], [334], [333]]),
    { distKm: 5.51, dist: "5.51 km", pace: "5:38 /km", avgPaceSec: 338, sec: 1864 });
  assert.equal(part.mean, 338, "the partial kilometre is still counted as a whole one");
  assert.match(part.big, /5:38/, "the statement and the pill are derived from different numbers");
  // The fallback chain must still reach the same number a run without avgPaceSec would print.
  const old = view(anal([[340], [350]]), { distKm: 2, dist: "2.00 km", pace: "5:45 /km", sec: 690 });
  assert.equal(old.mean, 345, "a run predating avgPaceSec loses its average entirely");
});

test("the per-kilometre verdict word appears only where the rows disagree", () => {
  // ⚠️ SIX IDENTICAL "✓ IN BAND" CHIPS RESTATE THE PANEL'S OWN QUALIFIER — "6 of 6 kilometres inside the
  // target band" — so one fact was on the screen seven times and the hierarchy flattened. The reference's
  // rows carry the pace alone. Where the kilometres DO differ the word is the information and stays, and it
  // is still a word rather than a step in alpha, which is the rule this project's session rows are tested
  // for.
  const view = splitView();
  const band = { minSecPerKm: 320, maxSecPerKm: 350 };
  const same = view(anal([[330], [335], [340]], band), { distKm: 3, dist: "3.00 km", pace: "5:35 /km" });
  assert.equal(same.mixed, false, "a wholly in-band run is reported as mixed");
  const diff = view(anal([[330], [400], [340]], band), { distKm: 3, dist: "3.00 km", pace: "6:10 /km" });
  assert.equal(diff.mixed, true, "a run with an off-band kilometre is not reported as mixed");
  const fn = lift("storyPanelHtml");
  assert.match(fn, /!sv\.mixed \? ""/, "the row word is printed whether or not the rows disagree");
  assert.match(fn, /verdict === "slow" \? "slow"/, "an off-band row still has no word of its own");
});

test("the share card is worth posting: the route fills its box and the chip is not the title", () => {
  // ⚠️ A FIXED LANDSCAPE 260x150 BOX CANNOT HOLD A PORTRAIT ROUTE. routeMapFraming fits the whole route
  // inside whatever box it is given, so the reference's there-and-back up a river path — 5.6:1 portrait —
  // was drawn as a ~30px sliver adrift in a large empty area. Shaping the box from the route's lat/lng
  // aspect was measured NOT to be enough either: routeMapFraming picks an INTEGER zoom, so the drawing
  // still only filled 59% of its own box. The box is cropped to what was actually drawn.
  const fit = new Function("return " + lift("storyCardMapFit"))() as
    (pts: number[][]) => { x: number; y: number; w: number; h: number; pct: number };
  // A portrait route: 28 units across, 160 down — the reference's own shape.
  const port = fit([[100, 40], [110, 120], [128, 200]]);
  assert.equal(port.w, 48, "the box does not hug the route's width (" + port.w + ")");
  assert.equal(port.h, 180, "the box does not hug the route's height (" + port.h + ")");
  assert.ok(port.w < port.h, "a portrait route still gets a landscape box");
  assert.ok(port.pct <= 25, "the portrait box is " + port.pct + "% of the card, so the route floats in it");
  // A landscape route uses the full width of the card.
  const land = fit([[10, 100], [130, 96], [250, 110]]);
  assert.ok(land.w > land.h, "a landscape route gets a portrait box (" + land.w + "x" + land.h + ")");
  assert.equal(land.pct, 100, "a landscape route no longer uses the width of the card");
  // ⚠️ AND THE CROP MUST BE APPLIED TO THE PROJECTION, or the viewBox and the drawing disagree.
  const panels = lift("storyPanelHtml");
  assert.match(panels, /storyCardMapFit\(pres\.route\.map\(cfr\.proj\)\)/, "the card box is not fitted to the route");
  assert.match(panels, /q\[0\] - fit\.x/, "the crop is not applied to the projection");
  assert.match(panels, /routeMapSvg\(pres\.route, cproj, fit\.w, fit\.h\)/, "the card draws at a size it was not fitted to");
  // ⚠️ AND NO MARKERS AT CARD SIZE. They are drawn from the route's own dot radius, so in the card's small
  // box they came out about as big as the line was long and the drawing read as two badges and a stub.
  assert.match(page(), /\.story-cardmap \.rt-logo, \.story-cardmap \.rt-finish \{ display: none/,
    "the start and finish markers still dominate the card-sized route");
  // ⚠️ AND THE DRAW-IN'S HEAD DOT IS NOT LEFT ON IT. storyRouteDraw ran on any panel holding a .rt-line,
  // which includes the card — and the dot it appends is left wherever the animation stopped, so a stray
  // white blob sat in the middle of the card's route. Only visible once the markers were hidden.
  assert.match(lift("storyRouteDraw"), /classList\.contains\("story-route"\)/,
    "the route draw-in runs on any panel with a route in it, including the share card");
  // The chip said "EASY RUN" directly above a title reading "5.5km Easy Run".
  assert.match(panels, /dupLabel/, "the plan chip can still restate the title");
});

test("the verdict panel is top-anchored, and every scrap of slack is below the statement", () => {
  // ⚠️ THIS GUARD IS THE SAME INVARIANT AS THE ONE IT REPLACES, MEASURED AGAIN AND FIXED PROPERLY. It used
  // to require .story-verdictp .story-hstats { position: relative }, which was the previous fix: pull the
  // absolutely-positioned tiles into flow so that a bottom-anchored stack closed the 349px hole in the
  // middle. It closed that hole and opened a bigger one — measured on the shipped build, the panel's first
  // element began at y452.7 of 825, so 377px (46%) of the TOP was empty gradient and the coaching headline
  // ended up last, 15px off the panel edge. The real answer is the one .story-hrp already proves on this
  // exact surface: anchor to the TOP, put the hero graphic absolutely under the header, and collect the
  // free space BELOW the last flow row. So the tiles go back to the base absolute rule, and the assertion
  // is inverted to the mechanism that now holds — not deleted.
  const html = page();
  assert.match(html, /\.story-verdictp \{[^}]*justify-content: flex-start/,
    "the verdict panel is bottom-anchored again, so its slack collects above the content");
  assert.match(html, /\.story-verdictp \.story-say \{[^}]*margin-bottom: auto/,
    "nothing collects the free space below the statement, so a rewrapped sub moves the whole stack");
  assert.ok(!/\.story-verdictp \.story-hstats \{[^}]*position: relative/.test(
    html.replace(/\.story-verdictp\.no-hero \.story-hstats \{[^}]*\}/g, "")),
    "the tiles are back in flow, which costs the panel their height for no gain");
  // ⚠️ AND NOT WITH A min-height ON THE SUB. That reserves room for exactly today's two-line worst case
  // and fails silently the first time a coaching sentence wraps to three lines.
  assert.ok(!/\.story-sub \{[^}]*min-height/.test(html),
    "the jolt is being papered over with a reserved slot rather than cured by the anchoring");
  // ⚠️ WATCH FIRST, AND AT MOST ONE well LINE. Two of each was right when the panel's only graphic was an
  // 8px rail; with a filled lane and a marker per kilometre directly above, "Pace was even throughout" and
  // "Most kilometres sat inside the target band" are the picture restated in words. The watch line is the
  // one thing a chart cannot show, so it leads and is never displaced by a well line.
  const fn = lift("storyPanelHtml");
  const at = fn.indexOf('if (kind === "verdict")');
  const branch = fn.slice(at, fn.indexOf("if (!hero)", at));
  assert.ok(branch.indexOf("v.watch") < branch.indexOf("v.well"),
    "the well lines are collected before the watch lines, so a watch line can be pushed out by one");
  assert.match(fn, /\(v\.watch \|\| \[\]\)\.slice\(0, 3\)/, "the panel no longer asks for the watch list first");
  assert.match(fn, /\(v\.well \|\| \[\]\)\.slice\(0, 1\)/,
    "the panel takes more than one well line again, which restates the chart above it");
  // ⚠️ AND THE LIST IS THE ROW THAT YIELDS AT --tscale 1.3, not the chart and not the statement.
  assert.match(html, /\.story-verdictp \.story-vlist \{[^}]*min-height: 0[^}]*overflow: hidden/,
    "nothing yields when the text scale grows, so the chart or the statement is what breaks");
  // ⚠️ THE THREE CHIPS ARE EVIDENCE AND MUST NOT BE SET AT THE HEADLINE'S OWN SIZE. .story-hsv is
  // var(--t-hero) for the route panel, where those numbers ARE the heroes over a full-bleed map; here they
  // sat at exactly the size of .story-big, so the coaching sentence — the panel's whole payoff, and the one
  // thing a competitor's recap cannot produce — did not lead.
  // ⚠️ IT IS ALSO A MEASURED COLLISION FIX. .story-hstats is absolute at top: 96px with no height, so it
  // grows DOWNWARD into the caption at 186px: at 32px x 1.3 the chip "RPE 3/10" did not fit its 126px column,
  // wrapped, and "3/10" was drawn across the middle of the caption.
  assert.match(html, /\.story-verdictp \.story-hsv \{ font-size: var\(--t-section\)/,
    "the verdict panel's chips are back at the headline's size, where they wrap into the caption at 1.3");
  const bandTop = Number((html.match(/\.story-verdictp \{ --band-top: calc\((\d+)px/) || [])[1]);
  const capTop = Number((html.match(/\.story-bandlab \{[^}]*top: calc\((\d+)px/) || [])[1]);
  const tileTop = Number((html.match(/\.story-hstats \{[^}]*top: calc\((\d+)px/) || [])[1]);
  assert.ok(tileTop && capTop && bandTop, "the panel's three absolute offsets are no longer readable");
  assert.ok(capTop - tileTop >= 84,
    "only " + (capTop - tileTop) + "px for the chips before the caption — a wrapped chip lands on it");
  assert.ok(bandTop - capTop >= 20,
    "only " + (bandTop - capTop) + "px for the caption before the chart");
});

test("no panel's landmarks can move when its words change", () => {
  // ⚠️ TOP-ANCHORING CURED THE VERDICT PANEL AND MEASURING IT FOUND THE SAME FAULT ON A SECOND ONE. Across 16
  // fixture/theme/scale combinations the verdict panel's tiles, caption, chart, legend, list and headline all
  // held to 0.0px between beats — but the SPLITS panel bottom-anchors its statement on margin-top: auto and
  // its beat 2 changes the headline as well as the sub, so a rewrapped headline moved its own top: measured
  // 22.5px at --tscale 1.0 and 29.2px at 1.3, on five of eight fixtures. Anchoring cannot fix that one
  // without moving its statement 107px up the screen and redesigning a panel that holds up.
  // Every beat is therefore rendered at once into one grid cell, so the cell is as tall as the tallest beat
  // for the panel's whole life. No constant to go stale, no line clamp cutting a coaching sentence.
  const html = page();
  assert.match(html, /\.story-saystack \{ display: grid; \}/, "the beats are not stacked in one cell");
  assert.match(html, /\.story-sayb \{ grid-area: 1 \/ 1; visibility: hidden; \}/,
    "the beats do not share one grid cell, so the cell's height follows whichever is showing");
  assert.match(html, /\.story-sayb\.on \{ visibility: visible; \}/, "no beat is ever revealed");
  // ⚠️ visibility, NOT opacity. With opacity every beat stays in the accessibility tree and a screen reader
  // reads all of them at once — on the verdict panel that is one headline twice with two different bodies.
  assert.ok(!/\.story-sayb \{[^}]*opacity: 0/.test(html),
    "the beats are hidden with opacity, so a screen reader reads all of them at once");
  // ⚠️ AND storyBeat REVEALS RATHER THAN REWRITES. Rewriting the box is what made its height follow the copy.
  const beat = lift("storyBeat");
  assert.ok(!/say\.innerHTML/.test(beat), "the statement box is still rewritten, which restores the jolt");
  assert.match(beat, /querySelectorAll\("\.story-sayb"\)/, "the beat is not selected from the stack");
  assert.match(beat, /classList\.add\("on", "sy-in"\)/, "the revealed beat is not animated in");
  // Every panel renders its whole beat list, from the one function that decides what the beats are.
  const panels = lift("storyPanelHtml");
  // FIVE, not six: the one-split splits panel is gone (storyPanelKinds), so route / splits / hr /
  // verdict-with-hero / verdict-no-hero each render their whole beat list, and the card decides nothing.
  assert.equal((panels.match(/storySayStack\(storyBeats\(kind\)\)/g) || []).length, 5,
    "a panel still renders only its first beat's text, so its later beats have nothing to reveal");
  assert.ok(!/storyStatement\(/.test(panels), "a panel still builds a single-beat statement box");
});

test("the verdict panel's hero is the band as a REGION, drawn from the run's own rows", () => {
  // ⚠️ THE 8px RAIL WAS THE WHOLE GRAPHIC ON A HALF-EMPTY SCREEN, and it read as a disabled iOS slider:
  // an rgba(255,255,255,.18) stripe with a .42 grey band and a 3px white tick, no colour anywhere. Demoting
  // it to the one-split splits panel is what THIS TEST used to bless, and measured there it left that panel
  // 69% empty as its only graphic — so it is deleted outright and this chart carries both cases.
  const fn = lift("storyPanelHtml");
  const at = fn.indexOf('if (kind === "verdict")');
  const branch = fn.slice(at, fn.indexOf("// ⚠️ THE MAP BOX TAKES", at));
  assert.match(branch, /storyBandSvg\(a\)/, "the verdict panel has no hero graphic");
  assert.match(branch, /story-bandc/, "the hero is not in the absolutely-positioned chart box");
  assert.match(branch, /storyBandLegendHtml\(a\)/, "the marks are read by colour alone");
  // The fallback is only for a run with NO SPLITS, and it reverts the anchoring with it.
  assert.match(branch, /if \(!hero\)/, "there is no fallback for a run with nothing to chart");
  assert.match(branch, /no-hero/, "the fallback does not tell the layout it has no hero");
  // ⚠️ AND THE FALLBACK — a run with no splits at all — IS CENTRED, NOT BOTTOM-ANCHORED. It was anchored to
  // the floor, and measured on that path (a treadmill effort logged by time) 564-632px of the 825px panel,
  // 68-77%, was one unbroken empty band down the whole top of the screen: against this panel's own recorded
  // standard, and half again worse than the 46% void the panel was rebuilt to remove. Centred, the largest
  // band is 34%. Inventing a graphic instead is refused — there is no kilometre to plot.
  assert.match(page(), /\.story-verdictp\.no-hero \{[^}]*justify-content: center/,
    "a panel with no hero is anchored to one end, so all of its free space piles up as one void");
  // ⚠️ SET AS A CLASS FROM JS, NEVER DERIVED WITH :has(). A :has() that fails to match produces a
  // top-anchored panel with a hole in it and nothing at all to see.
  assert.ok(!/:has\(\.story-bandc\)|:not\(:has\(\.story-band/.test(page()),
    "the no-hero case is derived with :has(), which is a silent-failure surface here");
  // ⚠️ THE COLOUR IS THE SESSION'S OWN EFFORT TOKEN, and no colour is named in the debrief's own source
  // (the no-hex BLOCKER above sweeps that). Only the three --eff-* exist; nothing is invented.
  assert.match(branch, /--story-eff: var\(--eff-/, "the chart's colour is not the session's effort token");
  assert.match(branch, /a\.rband/, "the effort band is not read from the run's own RPE band");
  assert.match(page(), /\.story-bnd \{[^}]*var\(--story-eff\)/, "the band region is not filled from the token");
});

/** storyBandSvg, lifted and run — the only way to check the scale against an outlier. */
function bandSvg() {
  const fmtPace = (s: number) => {
    const t = Math.round(s); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  };
  return new Function("fmtPace", "esc", "return " + lift("storyBandSvg"))(
    fmtPace, (s: string) => s) as (a: any, opt?: any) => string;
}
function bandFixture(secs: number[], band: { minSecPerKm: number; maxSecPerKm: number } | null, est?: number[]) {
  const rows = secs.map((sec, i) => {
    const e = !!(est && est.indexOf(i) >= 0);
    const verdict = e || !band ? "none" : sec < band.minSecPerKm ? "fast" : sec > band.maxSecPerKm ? "slow" : "in";
    return { km: i + 1, sec, verdict, delta: 0, judged: !!band && !e, est: e };
  });
  const pool = rows.filter((r) => !r.est).map((r) => r.sec);
  return { band, rows, n: rows.length, inBand: rows.filter((r) => r.verdict === "in").length,
    fastest: Math.min(...pool), slowest: Math.max(...pool),
    workPaceSec: Math.round(pool.reduce((s, v) => s + v, 0) / pool.length),
    fast: rows.filter((r) => r.verdict === "fast").length,
    slow: rows.filter((r) => r.verdict === "slow").length };
}

test("the band lane can never collapse, however far outside it the run was", () => {
  // ⚠️ THIS IS THE DEFECT storyBandStripHtml ALREADY SHIPPED ONCE, in chart form. There the scale stretched
  // to include the owner's 10:21/km against a 5:20-6:00 band and drew it at 81% of a rail labelled with the
  // band's own two ends — reading as comfortably INSIDE the band, directly above a sentence saying the
  // opposite. A padded scale with no floor does the same thing to a filled lane: it becomes a hairline and
  // the picture stops being readable as "in or out". Driven over real fixtures rather than eyeballed on one
  // screenshot, because one screenshot is exactly how the strip's version got through.
  const svg = bandSvg();
  const laneShare = (out: string) => {
    // The lane's share of the PLOT (ih = H - T - B = 274 of the 340-unit viewBox).
    const m = out.match(/class="story-bnd" x="0" y="([\d.]+)" width="\d+" height="([\d.]+)"/);
    assert.ok(m, "no band region is drawn at all");
    return Number(m![2]) / 274;
  };
  const band = { minSecPerKm: 320, maxSecPerKm: 360 };
  // Every kilometre inside the band: the lane is most of the plot, but never all of it — headroom has to
  // exist or an out-of-band kilometre on the next run would have nowhere to be drawn.
  const inside = laneShare(svg(bandFixture([333, 337, 336, 351, 334, 333], band)));
  assert.ok(inside > 0.24 && inside < 0.82, "an in-band run's lane is " + (inside * 100).toFixed(1) + "% of the plot");
  // Four minutes per kilometre outside it — the owner's own outlier, as a multi-kilometre run.
  const way = laneShare(svg(bandFixture([640, 600, 580, 610], band)));
  assert.ok(way > 0.08, "a run far outside the band collapses the lane to " + (way * 100).toFixed(1) + "%");
  // And the pathological case the twelve-band-width cap exists for: a 10s band against a 10-minute spread.
  const narrow = laneShare(svg(bandFixture([340, 900, 600, 345], { minSecPerKm: 340, maxSecPerKm: 350 })));
  assert.ok(narrow >= 1 / 12 - 0.001, "the lane floor does not hold: " + (narrow * 100).toFixed(1) + "%");
  // ⚠️ NOTHING IS EVER CLIPPED OR HIDDEN TO ACHIEVE THAT. Every kilometre still gets a marker, and every
  // marker still sits inside the plot, so the count on screen always equals the count in the analysis.
  const marks = (svg(bandFixture([340, 900, 600, 345], { minSecPerKm: 340, maxSecPerKm: 350 }))
    .match(/class="story-bmk /g) || []).length;
  assert.equal(marks, 4, "a kilometre went missing from the chart rather than being clamped into it");
});

test("the chart draws slower LOWER, is inset from the right edge, and never uses a circle", () => {
  const svg = bandSvg();
  const band = { minSecPerKm: 320, maxSecPerKm: 360 };
  const out = svg(bandFixture([300, 340, 400], band));
  // ⚠️ SAME DIRECTION AS paceChartSvg, so the debrief's own chart and this recap cannot contradict each
  // other about which way is faster.
  const ys = [...out.matchAll(/class="story-bmk [^"]*" x="[\d.-]+" y="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 3);
  assert.ok(ys[0]! < ys[1]! && ys[1]! < ys[2]!, "the chart does not draw a slower kilometre lower: " + ys.join(","));
  // ⚠️ THE RIGHT INSET. Without it the last marker's 12-unit box runs to x=380 and the viewport halves it —
  // the same fault as the HR panel's clipped end dot, in a second chart.
  const xs = [...out.matchAll(/class="story-bmk [^"]*" x="([\d.-]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...xs) + 12 <= 374, "the last marker reaches x=" + (Math.max(...xs) + 12) + ", so it is clipped");
  assert.ok(Math.min(...xs) >= 6, "the first marker starts at x=" + Math.min(...xs) + ", so it is clipped");
  // ⚠️ RECTS, NEVER CIRCLES: preserveAspectRatio="none" would render a circle as an ellipse whose shape
  // depends on the phone's height, since the box is 40dvh and the viewBox is fixed.
  assert.ok(!/<circle/.test(out), "the chart draws a circle under a non-uniform scale");
  assert.match(out, /preserveAspectRatio="none"/, "the chart's box and viewBox are not decoupled");
  // ⚠️ EACH BAND PACE SITS ON A PLATE, AND THAT IS A CONTRAST FIX MEASURED FROM RENDERED PIXELS — not
  // decoration. As bare white bold 11px the number was read against whatever the panel's radial gradient
  // happened to be behind it, and that is not a constant: measured on a one-kilometre run, where the lane
  // sits high and the label lands on the brightest teal, white on (15,140,126) is 4.14:1 — under AA, and
  // 11px bold is nowhere near large-text size. Inside the lane it measured 4.77:1, which passes and is
  // fragile for the same reason, because which of the two a label gets depends on the run's data. Over the
  // plate it is 10.4:1 wherever the lane lands.
  assert.equal((out.match(/class="story-bndplate"/g) || []).length, 2,
    "the band's pace numbers are bare text on a gradient whose brightness the data decides");
  // ⚠️ AND THE TWO PLATES NEVER TOUCH, AT ANY LANE HEIGHT. A plate spans baseline − 12 to baseline + 5, so
  // placed inside the lane they occupy yTop+3..yTop+20 and yBot−18..yBot−1 and clear each other only while
  // the lane exceeds 38 units. The threshold was 34 — the height of the TEXT, from before the plates existed
  // — which put them 3 units apart on a lane of 35 and measured as two pills touching.
  assert.match(lift("storyBandSvg"), /const roomy = lane >= 42/,
    "the inside-the-lane threshold is smaller than the two plates plus a gap, so they can touch");
  const bands: Array<[number, number]> = [[320, 360], [340, 350], [300, 400], [330, 336], [320, 322]];
  for (const [lo, hi] of bands) {
    const o = svg(bandFixture([330, 345, 355, 370], { minSecPerKm: lo, maxSecPerKm: hi }));
    // ⚠️ NOT PINNED TO x="8" ANY MORE. A plate labels a full-width rule, so pickX slides it along that rule
    // to whichever position is clear of the kilometre markers and the mean pill; the invariant here is the
    // VERTICAL separation, and pinning x made this assertion fail on a correct chart.
    const ys = [...o.matchAll(/class="story-bndplate" x="[\d.]+" y="([\d.-]+)"/g)].map((m) => Number(m[1]));
    assert.equal(ys.length, 2, "a band pace lost its plate");
    assert.ok(Math.abs(ys[0]! - ys[1]!) >= 17,
      "the two band plates are " + Math.abs(ys[0]! - ys[1]!).toFixed(1) +
      " units apart on a " + lo + "-" + hi + " band, and each is 17 tall");
  }
  // ⚠️ AND THEY ARE PAINTED AFTER THE STEMS AND THE LINE. A stem starts at the lane edge, which is exactly
  // where these labels sit, so on a run whose kilometre missed the band the stem was drawn across the plate —
  // measured on a four-kilometre outlier. This is the same fault .story-bsc already paid for, where a 3px
  // marker was drawn through the digits of "10:21". A datum goes on top of a region.
  assert.ok(out.indexOf('class="story-bndplate"') > out.lastIndexOf('class="story-bstem'),
    "a stem is painted over the band's pace numbers");
  assert.ok(out.indexOf('class="story-bndplate"') > out.indexOf('class="story-bnl"'),
    "the pace line is painted over the band's pace numbers");
  assert.match(page(), /\.story-bndplate \{ fill: rgba\(6,17,14,\.\d+\); \}/,
    "the plate does not darken the ground under the band's pace numbers");
  // ⚠️ AND IT ANIMATES AND YIELDS TO Reduce Motion WITH THE BAND IT LABELS. A plate that fades on a
  // different schedule from its own number is a grey box appearing on its own.
  assert.match(page(), /\.story-p\.in \.story-bnd, [^{]*\.story-bndplate \{ opacity: 1/,
    "the plate does not fade in with the band");
  const rm = page().split("@media (prefers-reduced-motion: reduce)").find((b) => b.includes(".story-bndplate"));
  assert.ok(rm, "the plate is not exempted by Reduce Motion, so it stays invisible for those runners");
  // ⚠️ AND THE BAND BLEEDS BOTH EDGES. It is a REGION the run sat in or did not, not a stripe beside it.
  assert.match(out, /class="story-bnd" x="0"[^>]*width="380"/, "the band region does not bleed to both edges");
  assert.match(out, /class="story-bnde" x1="0"[^>]*x2="380"/, "the band's edges do not bleed");
  // The screen reader gets the same numbers the picture is made of.
  assert.match(out, /aria-label="Every kilometre against the target band: 1 of 3 kilometres inside 5:20 to 6:00/,
    "the chart has no accessible reading of its own numbers");
});

test("out of band is coloured AND stemmed AND ringed — never colour alone", () => {
  // ⚠️ A TRIPLE, NOT A LEGEND ALONE. In band is white AND inside the lane AND stemless; out of band is
  // coloured AND outside the lane AND carries a stem whose LENGTH is the size of the miss AND a white ring.
  // Any one of the three can be read on its own, and the legend says all of it in words.
  const svg = bandSvg();
  const band = { minSecPerKm: 320, maxSecPerKm: 360 };
  const out = svg(bandFixture([300, 340, 430, 355], band, [3]));
  assert.match(out, /class="story-bmk fast out"/, "a quicker kilometre has no ring");
  assert.match(out, /class="story-bmk slow out"/, "a slower kilometre has no ring");
  assert.match(out, /class="story-bmk in"/, "an in-band kilometre is not drawn plain");
  assert.ok(!/class="story-bmk in out"/.test(out), "an in-band kilometre is ringed as though it missed");
  assert.match(out, /class="story-bmk est"/, "an estimated kilometre is not distinguished");
  // The stems: one per out-of-band kilometre, none for the in-band or estimated ones.
  const stems = [...out.matchAll(/class="story-bstem (up|down)"[^>]*height="([\d.]+)"/g)];
  assert.equal(stems.length, 2, "there are " + stems.length + " stems for two out-of-band kilometres");
  assert.equal(stems[0]![1], "up", "a QUICKER kilometre's stem does not grow upward out of the lane");
  assert.equal(stems[1]![1], "down", "a SLOWER kilometre's stem does not grow downward out of the lane");
  // ⚠️ AND THE STEM IS PROPORTIONAL TO THE MISS. 430 misses by 70s and 300 by 20s, so the slow stem must be
  // the longer of the two by roughly that ratio — a fixed 2px tick would pass a presence check and show
  // nothing about how far outside a 10:21/km really was.
  const up = Number(stems[0]![2]), down = Number(stems[1]![2]);
  assert.ok(down > up * 2, "the stems do not scale with the miss (" + up.toFixed(1) + " vs " + down.toFixed(1) + ")");
  // ⚠️ transform-origin AT THE LANE EDGE, or the stem grows out of thin air in both directions from its own
  // middle, which reads as an object appearing rather than a miss being measured.
  const html = page();
  assert.match(html, /\.story-bstem \{[^}]*transform-box: fill-box/, "the stem's origin is not its own box");
  assert.match(html, /\.story-bstem\.up \{ transform-origin: bottom/, "an upward stem does not grow from the lane");
  assert.match(html, /\.story-bstem\.down \{ transform-origin: top/, "a downward stem does not grow from the lane");
  // Estimated and unjudged rows carry no verdict, so they may not carry a stem either.
  assert.equal((out.match(/story-bstem/g) || []).length, 2, "an unjudged kilometre was given a stem");
});

test("one kilometre and a bandless run are both DRAWN, not fallen back on", () => {
  // ⚠️ MEASURED ON THE FIRST CUT OF THIS REBUILD, WHICH REQUIRED TWO SPLITS AND A BAND: a one-split run left
  // 402px (48.7%) of the panel empty and a run with no prescribed pace left 507px (61.4%) — WORSE than the
  // 46% void the rebuild exists to remove, because the fallback is bottom-anchored. Neither is unplottable.
  const svg = bandSvg();
  const band = { minSecPerKm: 320, maxSecPerKm: 360 };
  // ONE kilometre against a band: the lane, one marker, the band's two paces. This is what the 8px rail was
  // saying, and it says it without the rail's own documented lie (a pace four minutes outside the band drawn
  // at 81% of a rail labelled with the band's two ends).
  const one = svg(bandFixture([621], band));
  assert.ok(one, "a one-kilometre run gets no chart, so the panel falls back to a half-empty screen");
  assert.match(one, /story-bnd/, "a one-kilometre run is not shown the lane it was judged against");
  assert.equal((one.match(/class="story-bmk /g) || []).length, 1, "the single kilometre has no marker");
  assert.match(one, /class="story-bstem down"/, "a single kilometre far outside the band carries no stem");
  // ⚠️ AND NO POLYLINE. One pair of coordinates draws nothing at all, so an empty <polyline> is markup that
  // cannot render — and storyDashSetup would publish a length of 0 for it.
  assert.ok(!/story-bnl/.test(one), "a one-point run emits a polyline, which can never draw");
  assert.match(svg(bandFixture([340, 350], band)), /story-bnl/, "two kilometres do not get a line");
  // NO BAND: still a run. The pace line and the mean, with no lane and nothing implying a target.
  const nb = svg(bandFixture([360, 352, 358, 359], null));
  assert.ok(nb, "a run with no prescribed pace gets no chart at all");
  assert.match(nb, /story-bnl/, "a bandless run is not drawn as its own pace line");
  assert.ok(!/class="story-bnd"|story-bnde/.test(nb), "a bandless run is drawn a lane it never had");
  // ⚠️ BUT IT DOES GET THE TWO PACES THAT SCALE IT, which is the opposite defect and shipped: with both
  // plated labels inside the band branch, a bandless run was a bare polyline with no y axis at all. See
  // "a run with no prescribed pace still gets a vertical scale" — paceChartSvg records this same fix for
  // itself, and asserting the ABSENCE of every story-bnd* class here is what let it through.
  assert.equal((nb.match(/class="story-bndax"/g) || []).length, 2,
    "a bandless run has nothing on its y axis, so a dip could be two seconds or two minutes");
  assert.ok(!/story-bstem/.test(nb), "a bandless run's kilometres are stemmed against a band that did not exist");
  // ⚠️ PLAIN MARKS, NOT HOLLOW ONES. runAnalysis marks every row "none" with no band, and a chart of
  // twenty-one dashed hollow squares reads as twenty-one faults rather than as a run drawn without a target.
  assert.equal((nb.match(/class="story-bmk plain/g) || []).length, 4, "a bandless run's marks are not plain");
  assert.ok(!/story-bmk nj|story-bmk in/.test(nb), "a bandless kilometre is marked as judged or unjudged");
  assert.match(page(), /\.story-bmk\.in, \.story-bmk\.plain \{/, "the plain mark has no fill of its own");
  // ⚠️ AND THE CAPTION AND THE ARIA LABEL MUST NOT PROMISE A TARGET THAT DID NOT EXIST.
  assert.match(nb, /aria-label="Pace across the run: 4 kilometres from [\d:]+ to [\d:]+ per kilometre, no target set"/,
    "the accessible reading of a bandless run describes a target band");
  const fn = lift("storyPanelHtml").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /a\.band \? "Against the pace this session asked for" : "Your pace across the run"/,
    "the caption claims a prescribed pace on a run that had none");
  // The legend goes with it: with nothing to judge against there are no states to key.
  const legend = new Function("return " + lift("storyBandLegendHtml"))() as (a: any) => string;
  assert.equal(legend(bandFixture([360, 352], null)), "",
    "a bandless run gets a legend, which keys the app's own silence as a fault of the run's");
  // ⚠️ AND THE FALLBACK IS NOW ONLY FOR A RUN WITH NO SPLITS AT ALL, which is the insufficientData verdict.
  assert.match(lift("storyBandSvg"), /!\(a\.n >= 1\)/,
    "the chart still refuses a run it could draw, which sends the panel to the half-empty fallback");
  // A run under a kilometre records no splits, so there is nothing to plot and nothing to place in a band.
  const empty = { band: null, rows: [], n: 0, inBand: 0, fastest: 0, slowest: 0, workPaceSec: 0 };
  assert.equal(svg(empty), "", "a run with no splits is handed a chart with nothing in it");
  assert.equal(legend(empty), "", "a run with no splits gets a key to marks that do not exist");
  // ⚠️ AND storyBarPct IS NOT ASKED FOR A LENGTH EITHER — storyCardSplitsHtml returns "" under two rows, so
  // the card shows no split row rather than one empty column.
  const cards = cardSplits();
  assert.equal(cards(empty, { distKm: 0.6 }), "", "the card draws a split row for a run with no splits");
  assert.equal(cards({ ...empty, n: 1, rows: [{ km: 1, sec: 400, verdict: "in", est: false }] },
    { distKm: 1.01 }), "", "the card draws a one-column bar chart, which has nothing to be read against");
});

test("no band means no in-range chip, not 'In range 0%'", () => {
  // ⚠️ A FALSE ACCUSATION IN THE LARGEST TYPE ON THE PANEL. runAnalysis counts inBand as the rows whose
  // verdict is "in", and with no band no row can have one — so pct came out 0 and a run nobody set a target
  // for was told it had hit 0% of it. Found while rebuilding the verdict panel, where after the rebuild it
  // was the ONLY thing on the screen for a bandless run, directly contradicting the headline beside it
  // ("A run by feel") and the body ("no prescribed pace, so there is no target to measure it against").
  // ⚠️ IT REACHES THE DEBRIEF'S OWN CHIPS TOO, so this is one fix in one place for two screens.
  const fn = lift("runVerdict");
  assert.match(fn, /if \(pct != null && a\.n >= 2 && band\) chips\.push\(\{ v: pct \+ "%", k: "In range" \}\)/,
    "the in-range chip is pushed without checking there was a range to be in");
});

test("the legend names only the states this run actually contains", () => {
  // ⚠️ NEVER BY COLOUR ALONE has a second half: a fixed four-item key on an all-in-band run says three
  // false things to make one true one legible. Same rule storySplitView applies to its per-row words.
  const legend = new Function("return " + lift("storyBandLegendHtml"))() as (a: any) => string;
  const band = { minSecPerKm: 320, maxSecPerKm: 360 };
  const clean = legend(bandFixture([333, 340, 351], band));
  assert.equal((clean.match(/<span><i/g) || []).length, 1, "a clean run's legend names states it does not have");
  assert.match(clean, /In band/, "the one state the run has is not named");
  const messy = legend(bandFixture([300, 340, 430, 355], band, [3]));
  const items = (messy.match(/<span><i/g) || []).length;
  assert.equal(items, 4, "a mixed run's legend has " + items + " items for its four states");
  assert.match(messy, /In band/); assert.match(messy, /Quicker/);
  assert.match(messy, /Slower/); assert.match(messy, /Estimated/);
  // And the other direction: a run with nothing in band must not claim an in-band state.
  const none = legend(bandFixture([300, 430, 440], band));
  assert.ok(!/In band/.test(none), "the legend names a state no kilometre reached");
  assert.equal((none.match(/<span><i/g) || []).length, 2, "a run with no in-band kilometre still names three states");
  // ⚠️ A MEASURED-BUT-UNJUDGED ROW IS ITS OWN STATE. runAnalysis marks a row "none" when it sits outside
  // the prescribed stretch of the session, which is not the same thing as an estimate — and neither may be
  // drawn as though it had been scored.
  const nj = legend({ band, n: 2, inBand: 0, rows: [
    { km: 1, sec: 340, verdict: "none", est: false }, { km: 2, sec: 350, verdict: "in", est: false }] });
  assert.match(nj, /Not judged/, "a measured kilometre outside the prescribed stretch has no word of its own");
});

test("beat 2 of the verdict panel changes the picture, not only the sentence", () => {
  // ⚠️ THE REFERENCE FLIPS ONE ROW SOLID AND DIMS THE REST between its frames 070 and 078. Without it the
  // second beat here is a sentence swap on a static chart and the panel stops moving half way through.
  const beats = lift("storyBeats").replace(/\/\/[^\n]*/g, "");
  const at = beats.indexOf('if (kind === "verdict")');
  const branch = beats.slice(at, at + 900);
  assert.match(branch, /hisel: "\.story-bmk"/, "the second beat does not point at the chart's own marks");
  assert.match(branch, /verdict === "fast" \|\| r\.verdict === "slow"/,
    "the highlight does not pick the kilometre that missed the band");
  // ⚠️ ONE PARAMETER, NOT A COMMA SELECTOR. Two panels now carry a highlightable mark, and
  // ".story-split, .story-bmk" would interleave two node types in document order, so an index meant for
  // one would land on the other.
  const beat = lift("storyBeat");
  assert.match(beat, /querySelectorAll\(b\.hisel \|\| "\.story-split"\)\[b\.hi\]/,
    "the highlight lookup is hardcoded to one node type, or widened to a comma selector");
  assert.ok(!/querySelectorAll\("\.story-split, ?\.story-bmk"\)/.test(beat),
    "the lookup is a comma selector, so the two node types interleave");
  // The splits panel's own beat-2 highlight must keep working — it is the existing caller.
  const html = page();
  assert.match(html, /\.story-p\.beat-hi \.story-split \{[^}]*opacity: \.42/, "the splits highlight is gone");
  assert.match(html, /\.story-p\.beat-hi \.story-bmk \{[^}]*opacity: \.4/, "the chart's marks do not dim");
  assert.match(html, /\.story-p\.beat-hi \.story-bmk\.hi \{[^}]*opacity: 1/, "the highlighted mark does not stay lit");
});

test("the pace line draws itself in through the SHARED publisher, before the reflow", () => {
  const show = lift("storyShow");
  assert.match(show, /storyDashSetup\(p\.querySelector\("\.story-bnl"\)\)/,
    "the verdict chart's line has no measured length, so it can never draw itself in");
  // ⚠️ AND IT MUST STAY ABOVE THE REFLOW. Published after it, the transition never starts and the line
  // simply appears — the measured failure this file already records for the route.
  // ⚠️ COMMENTS STRIPPED FIRST, AND THIS GUARD WAS CAUGHT BY THE TRAP IT IS DOCUMENTING: the code comment
  // beside the call explains the reflow requirement and therefore contains the very string being located,
  // ABOVE the call, so the ordering check reported a fault that did not exist.
  const code = show.replace(/\/\/[^\n]*/g, "");
  assert.ok(code.indexOf('querySelector(".story-bnl")') < code.indexOf("void p.offsetWidth"),
    "the dash length is published after the reflow, so the draw-in silently does not happen");
  // ⚠️ ONE PUBLISHER, NOT A SECOND COPY OF getTotalLength — and asserted per FUNCTION rather than by
  // counting the string across the page, because the doc comment on storyDashSetup and the .rt-line CSS
  // comment both quote it. A page-wide count reads 3 and is measuring prose.
  assert.match(lift("storyDashSetup"), /getTotalLength\(\)/, "the shared publisher no longer measures");
  for (const fn of ["storyShow", "storyRouteDraw", "storyHrSvg", "storyBandSvg"])
    assert.ok(!/getTotalLength/.test(lift(fn).replace(/\/\/[^\n]*/g, "")),
      fn + " measures a path length itself instead of going through storyDashSetup");
  const html = page();
  assert.match(html, /\.story-bnl \{[^}]*stroke-dasharray: var\(--rl, none\)/,
    "the line does not take its dash from the published length");
  assert.match(html, /\.story-p\.in \.story-bnl \{[^}]*stroke-dashoffset: 0/, "the line never draws in");
});

/** storyCardSplitsHtml, lifted and run — its two dependencies passed in. */
function cardSplits() {
  const fmtPace = (s: number) => {
    const t = Math.round(s); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  };
  const storyBarPct = new Function("return " + lift("storyBarPct"))();
  // ⚠️ THE REAL storyCardLabelsFit, LIFTED — never a stand-in. The label gate is the thing under test, and a
  // hand-written copy here would keep passing after the app's own version changed.
  const storyCardLabelsFit = new Function("return " + lift("storyCardLabelsFit"))();
  // ⚠️ AND THE REAL CORNER GATE, WITH THE REAL WIDTH MODEL BEHIND IT — both lifted for the same reason.
  const storyCardBlockW = new Function("return " + lift("storyCardBlockW"))();
  const storyCardCornerFits = new Function("storyCardBlockW", "return " + lift("storyCardCornerFits"))(storyCardBlockW);
  return new Function("storyBarPct", "fmtPace", "storyCardLabelsFit", "storyCardCornerFits",
    "return " + lift("storyCardSplitsHtml"))(
    storyBarPct, fmtPace, storyCardLabelsFit, storyCardCornerFits) as (a: any, run: any) => string;
}

test("the card's split row spans the whole column and every block says its pace", () => {
  // ⚠️ THE 132px CAP MISREAD THE REFERENCE BY A FACTOR OF TWO. Its own comment reasoned "the reference's
  // bars are ~40px wide" — measured on reference frame 125, each of THEIR six blocks is ~42px and the row
  // spans the entire 267px content column. Ours drew 21.2/21.2/21.2/21.2/21.2/10.8 wide inside 132px of a
  // 284px column, at 46.3/51/51/52/51.5/52 tall under a var(--r-pill) radius, so five of six were within
  // 1.7px of each other with the difference lost in the corners: six identical pale capsules occupying half
  // a row, which is a loading skeleton.
  const html = page();
  assert.ok(!/\.story-cardsplits \{[^}]*max-width/.test(html),
    "the split row is width-capped again, so it occupies half the card");
  assert.ok(!/\.story-cardsplits \{[^}]*height: 52px/.test(html), "the row is back on the shorter track");
  assert.match(html, /\.story-cardsplits \{[^}]*--track: \d+px/, "the bar height has no track to be a fraction of");
  // ⚠️ NOT var(--r-pill) ON A 44x60 BLOCK. A 999px radius is a capsule again and the height difference
  // disappears into the corners, which IS the defect. var(--r-ctl) is 12 and on the ladder; the reference's
  // own measured block radius is ~10, which would fail the radius ratchet outright.
  assert.match(html, /\.story-cardsp > i \{[^}]*border-radius: var\(--r-ctl\)/,
    "the card's split blocks are capsules again, so their heights read as identical");
  assert.match(html, /\.story-cardsp > i \{[^}]*height: calc\(var\(--track\) \* var\(--h\) \/ 100\)/,
    "the block height is not a fraction of the track");
  // ⚠️ box-shadow: inset, NEVER border, on the estimated block. A 1px border makes that column 2px taller
  // than its neighbours for free and the bottoms stop aligning — the identical defect .act-pair records.
  assert.match(html, /\.story-cardsp\.est > i \{[^}]*box-shadow: inset/, "the estimated block has no marking");
  assert.ok(!/\.story-cardsp\.est > i \{[^}]*[^-]border:/.test(html),
    "a border on the estimated block makes it taller than its neighbours");
  // Every state has a fill, and they are the same three --eff tokens the verdict chart uses.
  for (const st of ["in", "plain", "fast", "slow", "est"])
    assert.match(html, new RegExp("\\.story-cardsp\\." + st + " > i[,{ ]"), "no fill for the " + st + " state");
  // Now the markup itself, run over real rows.
  const build = cardSplits();
  const rows = (n: number) => ({ n, rows: Array.from({ length: n }, (_, i) => ({
    km: i + 1, sec: 330 + i, verdict: "in", est: false })) });
  const six = build(rows(6), { distKm: 6 });
  assert.equal((six.match(/class="story-cardsp /g) || []).length, 6, "a column went missing");
  assert.equal((six.match(/<u>/g) || []).length, 6, "the blocks carry no pace label");
  assert.match(six, /<u>5:3[0-9]<\/u>/, "the label is not the kilometre's own pace");
  assert.match(six, /flex-basis:16\.67%/, "the basis is not the split's own share of the distance");
  // ⚠️ THE LABEL GATE IS ARITHMETIC. Column width is (284 - 4*(n-1))/n, so 8 columns are 32.5px and 9 are
  // 28.4 — and "4:38" at var(--t-label) needs about 26px, 34 at --tscale 1.3. Labels to eight, then gone;
  // the bars keep the full track either way, so nothing collapses when they go.
  assert.equal((build(rows(8), { distKm: 8 }).match(/<u>/g) || []).length, 8, "labels are dropped too early");
  assert.equal((build(rows(9), { distKm: 9 }).match(/<u>/g) || []).length, 0,
    "nine columns still carry labels, which cannot fit in 28px");
  assert.equal((build(rows(9), { distKm: 9 }).match(/class="story-cardsp /g) || []).length, 9,
    "dropping the labels dropped the bars with them");
  // ⚠️ ONE DEFINITION OF THAT GATE, SHARED WITH THE COLOUR KEY. The pace labels are what satisfies "never by
  // colour alone" on the card — each block states its pace and the target line states the band — so the
  // moment they are dropped a key has to appear instead. A second copy of the number 8 is how the row loses
  // its labels while the key stays absent, leaving a card readable only by colour.
  assert.match(lift("storyCardSplitsHtml"), /const lab = storyCardLabelsFit\(a\.rows\.length\)/,
    "the row decides for itself whether labels fit, so the colour key can disagree with it");
  const panels = lift("storyPanelHtml").replace(/\/\/[^\n]*/g, "");
  assert.match(panels, /!storyCardLabelsFit\(a\.n\) \? storyBandLegendHtml\(a\)/,
    "the card's colour key is not gated on the labels being gone");
  // ⚠️ AND NOT ON a.mixed. On runAnalysis that field is !!run.pmix — "the session mixed running and walking"
  // — NOT "the kilometres disagree", which is storySplitView's own mixed. Two questions, one name.
  assert.ok(!/const key = a && a\.mixed/.test(panels),
    "the colour key is gated on a.mixed, which means run-walk rather than disagreeing kilometres");
  assert.match(lift("runAnalysis"), /mixed: !!run\.pmix/,
    "runAnalysis's mixed no longer means what this guard assumes");
  // ⚠️ A PART-KILOMETRE STAYS VISIBLY A PART ONE — the property the old basis-from-distance already had and
  // which must survive the row going full width.
  const part = build({ n: 2, rows: [{ km: 1, sec: 330, verdict: "in", est: false },
    { km: 2, sec: 330, verdict: "in", est: false }] }, { distKm: 1.5 });
  const bases = [...part.matchAll(/flex-basis:([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.ok(bases[0]! > bases[1]! * 1.5, "a 0.5 km split is drawn as wide as a full one");
  // Verdict colour reaches the markup, with the same states as the panel.
  // ⚠️ THE FIXTURE MUST CARRY A BAND. Without one every column is correctly drawn "plain" (see below), so a
  // fixture missing it makes this whole loop test the bandless path while claiming to test the coloured one.
  const mixed = build({ n: 4, band: { minSecPerKm: 320, maxSecPerKm: 360 }, rows: [
    { km: 1, sec: 300, verdict: "fast", est: false }, { km: 2, sec: 340, verdict: "in", est: false },
    { km: 3, sec: 430, verdict: "slow", est: false }, { km: 4, sec: 350, verdict: "none", est: true }] },
    { distKm: 4 });
  for (const st of ["fast", "in", "slow", "est"])
    assert.match(mixed, new RegExp('class="story-cardsp ' + st + '"'), "the " + st + " column has no state");
  // ⚠️ A BANDLESS RUN IS "plain", NOT "est", AND THE CARD ALONE GOT THIS WRONG. runAnalysis marks every row
  // "none" with no band, and folding that into est drew a run nobody set a target for as hollow dashed
  // columns with dimmed labels — "the app estimated these", of kilometres it measured, on the one surface
  // that gets posted in public. The chart had already been given a plain state for exactly this case; the
  // card had not, so panel and card described the same run differently. Found by measuring, not by reading.
  const nb = build({ n: 3, band: null, rows: [
    { km: 1, sec: 360, verdict: "none", est: false }, { km: 2, sec: 352, verdict: "none", est: false },
    { km: 3, sec: 358, verdict: "none", est: false }] }, { distKm: 3 });
  assert.equal((nb.match(/class="story-cardsp plain"/g) || []).length, 3,
    "a bandless run's columns are not drawn plain");
  assert.ok(!/story-cardsp est/.test(nb),
    "a bandless run's measured kilometres are marked as estimated on the posted card");
  assert.match(html, /\.story-cardsp\.in > i, \.story-cardsp\.plain > i \{/,
    "the plain column has no fill of its own");
});

test("the card prints the target the session set, and never 0 of 6", () => {
  // ⚠️ THE ONE SENTENCE NO COMPETITOR'S SHARE CARD CAN PRINT, and without it the coloured fills above it are
  // decoration. Built from the band and the analysis the card already holds — nothing new is computed.
  const fn = lift("storyPanelHtml").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /story-cardtgt/, "the card no longer states what the session asked for");
  assert.match(fn, /Target ' \+ fmtPace\(a\.band\.minSecPerKm\) \+ '–' \+\s*fmtPace\(a\.band\.maxSecPerKm\)/,
    "the target line does not quote the band's own two paces");
  assert.match(fn, /a\.inBand \+ ' of ' \+ a\.n \+ ' on target/, "the target line does not state the count");
  // ⚠️ ABSENT ENTIRELY WITH NO BAND. "0 of 6 on target" on a run that had no target is a false accusation on
  // the one surface that gets posted in public.
  assert.match(fn, /a && a\.band && a\.n >= 1\s*\?\s*'<div class="story-cardtgt"/,
    "the target line is not gated on there being a band at all");
  // ⚠️ ONE BLOCK OWNS THE GAP BELOW THE EVIDENCE, so a card with no band does not lose the space under its
  // bars and a card with one does not gain it twice. Not :has(+ …), which this project records as a
  // silent-failure surface.
  assert.match(fn, /story-cardev/, "the evidence block is gone, so the gap below the bars depends on the band");
  assert.ok(!/\.story-cardsplits:has\(/.test(page()), "the gap is decided with :has()");
});

test("the card's dead column beside a portrait route is FILLED, not the route stretched", () => {
  // ⚠️ THE CRITIC'S FACTOR-OF-TWO RUNS THE OTHER WAY HERE, AND THIS IS WHY storyCardMapFit IS UNTOUCHED.
  // Measured: the reference's own card route trace is 42x168 inside its 267px content column — 16% of the
  // width, 225px of empty card beside it. Ours is 59.6x177 inside 284, i.e. 21%: already wider AND taller
  // than theirs. The run is a there-and-back up a river path at roughly 5.6:1 portrait and routeMapFraming
  // fits the whole route in its box, so no box width can make that route wide. Raising the 176 allowance is
  // also the one change that risks the documented past fault of the card clipping its own stat values.
  const fit = lift("storyCardMapFit");
  assert.match(fit, /Math\.min\(279, 176 \* w \/ h\)/, "the card map's height allowance was changed");
  assert.match(fit, /Math\.max\(14, Math\.min\(100/, "the card map's width floor was changed");
  // ⚠️ THE SAME DERIVATION AT TWO SCALES, so the story panel and the posted card cannot disagree about one
  // run. A second sparkline builder here would drift from the panel's within a release.
  const fn = lift("storyPanelHtml").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /storyBandSvg\(a, fit \? \{ w: 168/, "the card's companion chart is not the panel's own derivation");
  assert.match(fn, /bare: true/, "the card's chart is not the stripped-down rendering");
  assert.match(fn, /story-cardband/, "the map and its companion are not in one row");
  // ⚠️ THE WHOLE GATE IS PINNED, NOT JUST ITS PIECES — and this is the one re-break of twenty-six that the
  // first version of this test did not catch. Gating the chart off with a leading "false &&" left every
  // assertion above still matching, because they describe the SHAPE of the code and not whether it can be
  // reached. A dead gate is exactly how this project's computed-and-discarded faults have always looked.
  assert.match(fn, /const mini = a && a\.n >= 2 && \(!fit \|\| fit\.pct <= 52\)/,
    "the card's companion chart is gated on something other than there being room and data for it");
  assert.ok(!/const (mini|band|tgt|evid) = (false|0|null) &&/.test(fn),
    "part of the card is gated off with a constant, so it is built and then never rendered");
  // A treadmill run has no route at all, so the chart takes the full width rather than a third of it.
  assert.match(fn, /\{ w: 284, h: 132/, "with no route the companion chart does not take the free width");
  // ⚠️ AND NEITHER APPEARS WHEN THERE IS NOTHING TO DRAW — the same rule storyStatTile follows for a unit
  // with no value. An empty 177px band is worse than a shorter card.
  assert.match(fn, /const band = fit \|\| mini/, "the band row renders even with neither a map nor a chart");
  // The bare rendering carries the lane and the line and NOTHING else: at 168 units wide markers merge.
  const svg = bandSvg();
  const bare = svg(bandFixture([333, 340, 351], { minSecPerKm: 320, maxSecPerKm: 360 }),
    { w: 168, h: 132, T: 8, B: 8, LP: 4, RP: 8, bare: true });
  assert.match(bare, /story-bnd/, "the card's chart has no band region");
  assert.match(bare, /story-bnl/, "the card's chart has no pace line");
  for (const c of ["story-bmk", "story-bnx", "story-bncb", "story-bndax", "story-bstem"])
    assert.ok(!bare.includes(c), "the card's chart draws " + c + ", which merges at 168 units wide");
});

test("the card's location line is gated on route privacy", () => {
  // ⚠️ A RUNNER WHO SET Route privacy TO "Map hidden" ASKED NOT TO SAY WHERE THEY WERE, so printing their
  // town on a public card would be a privacy regression introduced BY the fix that adds the line. Ends
  // redaction does not gate it — that hides home, not the town.
  const fn = lift("storyPanelHtml").replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /run\.place && !pres\.hidden \?/,
    "the card prints the place without checking whether the runner hid their route");
  assert.ok(!/pres\.redacted \?/.test(fn.slice(fn.indexOf("const place ="), fn.indexOf("const sub ="))),
    "ends redaction is being used to gate the place, which hides home rather than the town");
  // ⚠️ run.place IS DERIVED, AND FINDING THAT OUT CHANGED THE DESIGN. I had written here that it "cannot be"
  // — reverse geocoding being a network call and this page shipping no external network assets — and
  // runPlaceLookup does exactly that through nominatim, once per run, cached onto the record. So a place is
  // the normal case for any run with a route, and the strings are long: "Hartlepool, England, United Kingdom"
  // wrapped this line to two at the default text size and would take three at --tscale 1.3, on a card
  // measured to the pixel. The card therefore takes the FIRST COMPONENT only — the town is the location on
  // something posted to people who know where the runner lives — and the full string stays on the debrief.
  assert.match(lift("runPlaceLookup"), /nominatim/,
    "run.place is no longer derived, so the card's first-component-only rule may be discarding nothing");
  assert.match(fn, /String\(run\.place\)\.split\(","\)\[0\]\.trim\(\)/,
    "the card prints the whole geocoded string, which wraps this line onto two");
  assert.match(fn, /rdWhenText\(run\)/, "the card has no date and no substitute for one");
  assert.match(fn, /place \+ " · " \+ when/, "the place replaces the date rather than joining it");
  // ⚠️ AND THE LINE MAY NEVER WRAP. Taking the town is what makes it fit; this is what makes it stay fitting
  // when a town name is long, because a second line here costs 18px at 1.0 and 23px at 1.3.
  assert.match(page(), /\.story-cardh span \{[^}]*white-space: nowrap[^}]*text-overflow: ellipsis/,
    "the card's location line can wrap onto a second line, which the height budget does not allow");
  assert.match(fn, /sub \? '<span>' \+ esc\(sub\) \+ '<\/span>' : ""/,
    "an empty location line still renders a box");
  // ⚠️ THE EYEBROW IS NOT BACKFILLED WITH THE RPE, AND THE HEIGHT BUDGET IS WHY. It was, briefly: the
  // reference carries an eyebrow on every card and ours is suppressed whenever the session label restates the
  // title, so the effort rating looked free. Measured it is 30px at --tscale 1.0 and 36px at 1.3, and at 1.3
  // the card was already past the space available and clipping its own bottom stat row through the middle of
  // the values — the documented past fault at this exact spot.
  assert.match(fn, /eyebrow = label && !dupLabel \? label : ""/,
    "the eyebrow is backfilled again, which costs 36px the card does not have at --tscale 1.3");
  assert.match(fn, /eyebrow \? '<span class="story-cardplan">/, "an absent eyebrow still renders a chip");
});

test("the HR panel's end dot and average chip clear the right edge", () => {
  // ⚠️ MEASURED ON THE SHIPPED BUILD: the end dot's centre sat at x=380 with r=5 and the chip's right edge
  // at 374, both cut in half by the VIEWPORT. .story-hrsvg carries overflow: visible so the clip is not at
  // the SVG's own boundary — shrinking the plot is the only fix available, and overflow: hidden would slice
  // the dot rather than move it.
  const svg = lift("storyHrSvg");
  assert.match(svg, /const RPAD = 14/, "the HR plot has no right-hand inset");
  assert.match(svg, /X = \(m\) => \(m \/ mx\) \* \(W - RPAD\)/, "the data still runs to the viewBox edge");
  assert.match(svg, /W - 56 - RPAD/, "the average chip was not moved in with the data");
  assert.match(svg, /W - 31 - RPAD/, "the chip's label was not moved in with its plate");
  assert.match(svg, /W - 58 - RPAD/, "the average rule was not shortened to meet its chip");
  // ⚠️ THE PEAK RULE KEEPS x2 = W. A rule reads as a rule when it bleeds; only the DATA needs the inset.
  assert.match(svg, /x2="' \+ W \+ '"/, "the peak rule was inset too, so it stops short of the edge");
  // ⚠️ AND THE FILL STILL BLEEDS, VIA A SHOULDER. Closing straight from the last point to the bottom-right
  // corner draws a 14px diagonal wedge under the end of the trace, which reads as the run collapsing.
  assert.match(svg, /' L ' \+ W \+ ' ' \+ Y\(series\[series\.length - 1\]\[1\]\)/,
    "the fill closes with a diagonal wedge instead of a level shoulder");
  assert.ok(!/overflow: hidden/.test(
    (page().match(/\.story-hrsvg \{[^}]*\}/) || [""])[0]),
    "the clip was hidden rather than moved, which slices the dot in half");
});

test("the route panel does not print the header a second time", () => {
  // ⚠️ MEASURED: "5.5km Easy Run / 17 Aug 2026" at the top of the panel and the identical two lines again
  // ~690px below it. storyShellHtml renders run.t over rdWhenText(run) permanently; the route beat set
  // big: run.t, sub: run.place || rdWhenText(run) — so with no place recorded the panel spent its one
  // sentence repeating what was already on screen. The place is the only fact the header lacks.
  // ⚠️ COMMENTS STRIPPED FIRST. The explanation of this defect quotes the strings it forbids, which is
  // the trap four guards in this project have already been caught by.
  const beats = lift("storyBeats").replace(/\/\/[^\n]*/g, "");
  const at = beats.indexOf('if (kind === "route")');
  const branch = beats.slice(at, at + 400);
  assert.match(branch, /big: run\.place \|\| ""/, "the route statement is back on the run's own title");
  assert.ok(!/rdWhenText\(run\)/.test(branch), "the route statement repeats the header's date");
  // And with nothing to say there must be no empty box pretending to be a statement. storyStatement became
  // storySayStack when every beat started being rendered at once (see the jolt cure), so the rule is now
  // "filter the empty beats out, and if none survive there is no box at all" — the same invariant, over a
  // list instead of one pair.
  const stack = lift("storySayStack");
  assert.match(stack, /\.filter\(\(b\) => b && \(b\.big \|\| b\.sub\)\)/,
    "an empty beat still renders a statement box");
  assert.match(stack, /if \(!bs\.length\) return ""/, "a panel with nothing to say still renders a box");
  const say = new Function("storySayInner", "return " + stack)((big: string) => big || "");
  assert.equal(say([{ big: "", sub: "" }]), "", "a beat with no words renders a box");
  assert.equal(say([]), "", "no beats at all renders a box");
  assert.match(say([{ big: "x", sub: "" }]), /story-sayb on/, "the first beat is not the visible one");
});

test("the card's blocks keep a corner that fits them, at any number of kilometres", () => {
  // ⚠️ THE 132px CAP WAS REMOVED BECAUSE SIX IDENTICAL PALE CAPSULES ARE A LOADING SKELETON — and above ten
  // kilometres var(--r-ctl) reproduced exactly that, on the distances most likely to be posted. Measured in
  // the rendered DOM on a 21-kilometre run at --tscale 1.3: 22 blocks 9.7px wide under a 12px radius, so the
  // corner exceeded HALF the column and the whole 40.8-48px height spread vanished into it, with the pace
  // labels already dropped at that count.
  const build = cardSplits();
  const rows = (n: number) => ({ n, band: { minSecPerKm: 320, maxSecPerKm: 340 },
    rows: Array.from({ length: n }, (_, i) => ({ km: i + 1, sec: 325 + (i % 5) * 4, verdict: "in", est: false })) });
  // ⚠️ ASSERTED THROUGH THE WIDTH MODEL, NOT AGAINST A REMEMBERED COUNT. Both predicates read the same
  // storyCardBlockW, so this cannot pass while the app and the test disagree about how wide a column is.
  const blockW = new Function("return " + lift("storyCardBlockW"))() as (n: number) => number;
  const radius = Number((page().match(/--r-ctl: (\d+)px/) || [])[1]);
  assert.ok(radius > 0, "the radius token is not in the build");
  for (const n of [2, 6, 8, 10, 11, 14, 21, 22, 43]) {
    const out = build(rows(n), { distKm: n });
    const square = / class="story-cardsplits sq"| class="story-cardsplits sq/.test(out) || /story-cardsplits sq/.test(out);
    const fits = blockW(n) >= 2 * radius;
    assert.equal(square, !fits,
      "at " + n + " kilometres the column is " + blockW(n).toFixed(1) + "px and the corner is " +
      radius + "px, so squaring it off should be " + (!fits));
  }
  assert.match(page(), /\.story-cardsplits\.sq > \.story-cardsp > i \{ border-radius: 0/,
    "the dense row has no rule squaring its corners, so the class does nothing");
  // A marathon's row is still a row of blocks — squaring the corner is not a licence to drop it.
  const many = build(rows(43), { distKm: 43 });
  assert.equal((many.match(/class="story-cardsp /g) || []).length, 43, "a kilometre went missing from the row");
});

test("the share card is MEASURED to fit, and sheds in a stated order rather than clipping its numbers", () => {
  // ⚠️ EVERY HAND-KEPT BUDGET ON THIS CARD HAS GONE STALE, AND THE LAST ONE WAS WRONG WHEN WRITTEN. Its
  // comment claimed "the measured margin is 14px rather than zero"; measured now, every card reports content
  // exactly equal to its box at --tscale 1.0, and the worst reachable card at 1.3 — a 21-kilometre race with
  // a place line, a wrapping title, six stat tiles, a 22-column split row and the colour key — was 64px PAST
  // its box, cutting through the values of Heart rate / Elevation / Cadence. The reference run that budget
  // was measured on suppresses its eyebrow chip (its title contains "Easy run"); a race titled "Half
  // Marathon" does not, so the chip it assumed away is emitted and costs 31px at 1.0 and 35 at 1.3.
  const fn = lift("storyFit");
  assert.match(fn, /ci\.scrollHeight - ci\.clientHeight/,
    "the fit is decided by something other than the one measurement that can see it");
  // The order is by what is lost, and the colour key may only ever go WITH the row it keys — otherwise the
  // card is read by colour alone, which is the rule the key exists to satisfy.
  const chipAt = fn.indexOf("story-cardplan"), bandAt = fn.indexOf("cardband-w"), rowAt = fn.indexOf("story-cardsplits");
  assert.ok(chipAt > 0 && bandAt > 0 && rowAt > 0, "the card sheds nothing");
  assert.ok(chipAt < bandAt && bandAt < rowAt,
    "the card sheds evidence before it sheds provenance or picture size");
  assert.ok(fn.indexOf("story-bnlg") > 0 && fn.indexOf("story-bnlg") < rowAt + 400,
    "the colour key is not shed with the row it keys, so the row's colours become unreadable");
  assert.ok(!/story-stats|story-cardh|story-stv/.test(fn),
    "the card sheds a number or its own title, which is the thing being protected");
  // ⚠️ AND THE PICTURE BAND CAN ONLY SHRINK BY NARROWING, WHICH LOSES NOTHING. Both graphics in it are
  // drawn width-first (svg width: 100%, height: auto), so a narrower band is a shorter band with the whole
  // route and the whole lane still in it — no crop, no distortion, nothing dropped.
  assert.match(page(), /\.story-cardband \{[^}]*max-width: var\(--cardband-w, 100%\)/,
    "the band has no lever to yield with");
  assert.match(page(), /\.story-cardmap svg \{[^}]*height: auto/, "the route would be cropped rather than scaled");
  // ⚠️ AND THE HEADROOM IS THE HEADER'S OWN MEASUREMENT. A constant 92px was reserved for a header that is
  // two lines of type plus a 28px mark: at --tscale 1.3 it measures 107, so a tall card began 15px
  // UNDERNEATH the identity header, which is z-index 3 and drew over the run's own title.
  assert.match(page(), /\.story-card \{[^}]*var\(--story-hdr, 92px\)/,
    "the card reserves a constant for a header whose height follows the text scale");
  assert.match(lift("storyShow"), /setProperty\("--story-hdr"/, "nothing ever measures the header");
  assert.match(lift("storyShow"), /storyFit\(p\)/, "the fit pass is never called");
});

test("a run with nothing to chart still says what the run was, and is not anchored to the floor", () => {
  // ⚠️ THE ONE PANEL THAT CAN BE REACHED WITHOUT THE RUN'S OWN NUMBERS BEING SAID ONCE. A run with no splits
  // is normally a treadmill effort, which carries no route either — so storyPanelKinds returns verdict then
  // card, and distance / time / pace appeared on NEITHER until the final share card. Measured, that left
  // 632px of the 825px panel (76.6%) as one empty band at --tscale 1.0 and 566px (68.6%) at 1.3.
  const fn = lift("storyPanelHtml");
  const at = fn.indexOf("if (!hero)");
  const branch = fn.slice(at, fn.indexOf("// ⚠️ THE CAPTION MUST NOT PROMISE", at));
  assert.ok(at > 0 && branch.length > 200, "the no-hero branch moved; this would measure nothing");
  assert.match(branch, /storyStatTile\("Distance"/, "the run's own distance is never said on this panel");
  assert.match(branch, /storyStatTile\("Time"/, "the run's own time is never said on this panel");
  assert.match(branch, /storyStatTile\("Pace"/, "the run's own pace is never said on this panel");
  // ⚠️ GATED ON THE ROUTE PANEL'S ABSENCE, NOT ON run.indoor. The fault is "nobody has said this yet", and
  // with a route panel present these three would be the same fact twice, two beats apart.
  assert.match(branch, /STORY\.kinds \|\| \[\]\)\.indexOf\("route"\) >= 0 \? "" :/,
    "the numbers are repeated even when the route panel has already printed them");
});

test("the verdict panel's evidence yields whole lines, never half a sentence", () => {
  // ⚠️ CLIPPING THERE IS INTENDED; CUTTING A SENTENCE THROUGH ITS GLYPHS IS NOT. .story-vlist is the row that
  // yields at --tscale 1.3, but overflow: hidden cuts wherever the box ends: measured on a 21-kilometre
  // fixture at 1.3, "…drifted under the target pace" was sliced horizontally through its letters (12.5px of
  // the line left showing) and the line below it was 79px gone with nothing to say so. Whether it degraded
  // cleanly depended on whether a line happened to wrap. storySayStack's own comment in the same file
  // refuses this: "no line clamp truncating a coaching sentence".
  const fn = lift("storyFit");
  assert.match(fn, /\.story-vlist/, "the evidence list is not measured at all");
  assert.match(fn, /removeChild\(list\.lastElementChild\)/,
    "the list is trimmed from the front, which drops the watch line the chart cannot show");
  assert.match(fn, /list\.scrollHeight - list\.clientHeight/,
    "the trim is decided by a constant rather than by the box it has to fit");
  // ⚠️ AND THE OVERFLOW STAYS AS THE BELT AND BRACES for the frame before the trim runs — removing it would
  // let a clipped line become an overflowing one, which lands on the coaching headline underneath.
  assert.match(page(), /\.story-verdictp \.story-vlist \{[^}]*overflow: hidden/,
    "the clip is gone as well as the cause, so an unmeasured frame overflows onto the statement");
  // A trim that empties the list removes the list, so its own gap does not survive as a hole.
  assert.match(fn, /if \(!list\.children\.length && list\.parentNode\)/,
    "an emptied evidence list is left in the layout as a gap");
});
