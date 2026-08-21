import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE SHARE STUDIO'S EDITOR — THE CAROUSEL, THE FRAMING, THE FIVE TOOLS AND THE ONE DESTINATION SHEET.
 *
 * Every guard here was watched failing against a deliberate re-break, and every one of them pins a
 * control that RENDERED, looked live, and did nothing — the defect class this project has now shipped
 * three times (#saveSetup, rdMore, and the studio's own "Add a photo").
 *
 * ⚠️ THE INVARIANTS ARE MECHANISMS, NOT SPELLINGS. "Something reaches this button" is what matters,
 * so the sweeps DERIVE the set of controls from the markup the studio builders emit rather than
 * carrying a hand-written list — a list goes stale the first time somebody adds a row, and the failure
 * mode is silence.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const css = () => { const h = page(); return h.slice(h.indexOf("<style>"), h.indexOf("</style>")); };

/**
 * THE APP'S OWN SCRIPT BLOCK, NOT THE WHOLE PAGE.
 * ⚠️ The built page also carries the MINIFIED engine, whose functions are renamed to one and two
 * letters — so a set of "function names in the build" taken from the whole page would contain dozens of
 * one-letter names and a dispatch branch calling any of them would count as handled. Bounded to the
 * block that declares studioClick, the same fix test/share-render.test.ts records making for lift().
 */
let APP_SRC: string | null = null;
function appScript(): string {
  if (APP_SRC) return APP_SRC;
  const html = page();
  const marker = html.indexOf("function studioClick(");
  assert.ok(marker > 0, "studioClick is not in the build");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  APP_SRC = html.slice(open + 8, close);
  return APP_SRC;
}
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
/** Lift a top-level const, bracket-matched to its own semicolon. lift() cannot reach data. */
function liftConst(name: string): string {
  const html = page();
  const at = html.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < html.length; i++) {
    const c = html[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return html.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
/** A rule's declarations, by selector text. */
function rule(sel: string): string {
  const h = css();
  const at = h.indexOf("\n" + sel + " {");
  assert.ok(at > 0, "rule not found: " + sel);
  return h.slice(at, h.indexOf("}", at));
}
/** Comments inside the runtime JS quote the strings they forbid; a sweep has to strip them. */
const nocomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * ONE dispatch BRANCH, BOUNDED TO ITS OWN STATEMENT.
 *
 * ⚠️ THE OBVIOUS SLICE — from this action's test to the next one — IS THE COLLECTION-TOO-WIDE TRAP. The
 * LAST branch's slice then runs to the end of studioClick, which contains the tool, template, metric,
 * aspect and privacy families and their calls: an emptied final branch would be "handled" by somebody
 * else's code. So the statement is closed properly: a block to its matching brace, a one-liner to its
 * own semicolon.
 */
function studioBranch(handler: string, action: string): string {
  const key = 'what === "' + action + '"';
  const at = handler.indexOf(key);
  assert.ok(at >= 0, "studioClick never names " + action);
  let i = handler.indexOf(")", at + key.length) + 1;
  while (/\s/.test(handler[i]!)) i++;
  if (handler[i] === "{") {
    let d = 0;
    for (let j = i; j < handler.length; j++) {
      if (handler[j] === "{") d++;
      else if (handler[j] === "}") { d--; if (!d) return handler.slice(i, j + 1); }
    }
    throw new Error("unbalanced branch for " + action);
  }
  const end = handler.indexOf(";", i);
  assert.ok(end > i, "unterminated branch for " + action);
  return handler.slice(i, end + 1);
}

/**
 * Every builder that renders a control into the studio — the primary screen AND the five tool sheets.
 * ⚠️ THIS LIST IS THE WHOLE POINT OF THE FIRST SWEEP, so it has to include the sheets. The controls
 * moved off the primary screen into sheets during Build 2; a list that still named only the panel would
 * have gone on passing while the Metrics, Style and destination controls went unwired.
 */
const STUDIO_BUILDERS = ["shareStudioHtml", "studioPhotoHtml", "studioRouteHtml", "studioPosHtml",
  "studioToolsHtml", "studioMetricsHtml", "studioStyleHtml", "studioDestHtml", "studioSheetHtml",
  "studioPrivHtml", "studioSwitch", "studioDestTile"];
const studioMarkup = () => STUDIO_BUILDERS.map(lift).join("\n");

// ---- the controls are reachable at all ------------------------------------------------------------

test("BLOCKER: every control the studio renders is reached by its delegated handler", () => {
  // ⚠️ THIS IS THE GUARD FOR A DEAD PHOTO BUTTON. studioSyncRows rebuilds every row from its own builder
  // on every change — and it runs at open, straight after the wiring — so handlers assigned to those
  // buttons node by node were thrown away before the runner could reach them. Measured on the first
  // shipped build: "Add a photo" had onclick null and tapping it reached the file input ZERO times;
  // "Show my route" left SCARD.routeOn null. The entire photograph feature was unreachable through the
  // interface while the two switches in the STATIC part of the panel worked perfectly, which is exactly
  // why it read as finished. Delegation cannot go stale when a section is rebuilt.
  const src = nocomment(studioMarkup());
  // ⚠️⚠️ THE ATTRIBUTE IS SOMETIMES STRING-BUILT, AND A LITERAL-ONLY SWEEP MISSED THE WHOLE DESTINATIONS
  // ROW. studioDestTile writes data-sst="' + action + '", so "share" and "caption" appeared in no literal
  // attribute anywhere — the derived list held fourteen actions and neither of those two. That is why the
  // first restatement of the mechanism guard below STILL did not catch the emptied Copy-caption branch: a
  // guard over a collection is only as good as the collection, and this collection had a hole in it.
  const literal = [...src.matchAll(/data-sst="([a-z0-9]+)"/g)].map((m) => m[1]!);
  // ⚠️⚠️ AND NOW THERE MUST BE NO COMPUTED data-sst AT ALL, WHICH IS A STRONGER GUARD THAN THE ONE THIS
  // REPLACES. The destinations row used to build its action string (data-sst="' + action + '"), so "share"
  // and "caption" appeared in no literal attribute and the derived set had a hole in it — which is why the
  // emptied Copy-caption branch survived. Ruling 8 turned the destinations into their own attribute family
  // (data-sstdest, enumerated from SST_DEST further down this file), so nothing here builds a data-sst any
  // more and the literal enumeration below is PROVABLY complete rather than complete-if-you-remember.
  const dyn = src.match(/data-sst="'\s*\+/g) || [];
  assert.deepEqual(dyn, [], "a builder is writing a computed data-sst again, so the literal sweep below " +
    "cannot see its controls — either give it its own attribute family or enumerate it here by hand");
  const actions = [...new Set(literal)];
  for (const must of ["caption", "save", "dest"]) {
    assert.ok(actions.includes(must), "the destination sheet's " + must + " control is not in the swept set");
  }
  // ⚠️ A FLOOR, SO A SWEEP THAT HAS GONE BLIND CANNOT PASS BY FINDING NOTHING. It moved 16 -> 15 when the
  // destinations left data-sst for their own family (ruling 8), and the four they took with them are
  // counted in that family's own guard below — so the two together are 19 where they were 16.
  const destIds = [...appScript().matchAll(/^\s*\{ id: "([a-z]+)", label: "/gm)].map((m) => m[1]!);
  assert.ok(destIds.length >= 4, "SST_DEST's ids were not found, so the family count below is empty");
  assert.ok(actions.length + destIds.length >= 19,
    "expected the studio's controls, found " + actions.concat(destIds).join(", "));
  const handler = nocomment(lift("studioClick"));
  const dead = actions.filter((a) => !new RegExp('=== "' + a + '"').test(handler));
  assert.deepEqual(dead, [], "these render in the studio and studioClick never names them: " + dead.join(", "));
  // ⚠️⚠️ AND NAMING AN ACTION IS NOT HANDLING IT. As written above, this guard asserted only that the
  // dispatch MENTIONS the action — so replacing the Copy-caption branch's body with a bare `return;`
  // passed 960 tests with a tile that looked live and did nothing, which is the exact class CLAUDE.md
  // records shipping three times (rdMore, #saveSetup, the profile confirm button). The claim is now the
  // MECHANISM: each branch must reach at least one function that exists in the app, and the branch is
  // bounded to its own statement so a call further down the dispatch cannot stand in for it.
  const fnNames = new Set([...appScript().matchAll(/\bfunction ([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!));
  assert.ok(fnNames.has("studioSync") && fnNames.has("studioCopyCaption"),
    "the app's function names were not collected, so this sweep would pass on anything");
  for (const a of actions) {
    const body = studioBranch(handler, a);
    const called = [...body.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[2]!)
      .filter((n) => fnNames.has(n));
    assert.ok(called.length > 0,
      'the "' + a + '" branch of studioClick reaches no function that exists in the app: ' + body.trim());
  }
  // ⚠️ AND EVERY OTHER ATTRIBUTE FAMILY TOO. The carousel, the tool row, the template list, the metric
  // chips, the aspect chips and the privacy switches are each addressed by their own attribute; a sweep
  // that only knew data-sst would have missed five whole families of control.
  const fams = [...new Set([...src.matchAll(/(data-sst(?:[a-z]*|-[a-z]+))="/g)].map((m) => m[1]!))]
    .filter((a) => /^data-sst(met|tmpl|tool|priv|dest)$|^data-sst-aspect$/.test(a));
  assert.ok(fams.includes("data-sstdest"),
    "the destination tiles are no longer their own family, so nothing here checks they are wired: " + fams.join(", "));
  assert.ok(fams.length >= 6, "expected the studio's attribute families, found " + fams.join(", "));
  const unread = fams.filter((a) => !handler.includes("[" + a + "]"));
  assert.deepEqual(unread, [], "these attributes are rendered and studioClick never reads them: " + unread.join(", "));
});

test("BLOCKER: the studio's clicks are delegated onto the node that outlives an open", () => {
  const open = lift("openShareStudio");
  // One listener, attached inside the create-once branch, so re-opening cannot stack a second copy.
  assert.match(open, /addEventListener\("click", studioClick\)/,
    "the delegated click listener is gone; per-node handlers cannot survive studioSyncRows");
  const before = open.indexOf('addEventListener("click", studioClick)');
  const after = open.indexOf("ov.innerHTML = shareStudioHtml");
  assert.ok(before > 0 && before < after,
    "the listener must be attached to the overlay before its markup is written, and only once");
  // ⚠️ AND NOTHING MAY GO BACK TO PER-NODE HANDLERS. studioWire runs BEFORE studioSync at open, so a
  // handler it assigns to a rebuilt row is destroyed in the same tick.
  const wire = lift("studioWire");
  assert.ok(!/data-sst"\]\)\.forEach/.test(wire) && !/\.onclick = /.test(wire),
    "studioWire is assigning click handlers again; studioSyncRows rebuilds those nodes");
});

test("BLOCKER: every row a sheet owns is rebuilt from its builder, and studioSync reaches all of them", () => {
  // ⚠️ THE REBUILDING MOVED ONE FUNCTION OUTWARDS AND THE CHAIN IS WHAT IS ASSERTED. Build 2 put the
  // controls into sheets, so the rows are rebuilt by studioSyncRows — which studioSync calls, and which
  // studioSheet calls the moment a sheet is mounted. Pinning studioSync's own text would now pass with
  // the rows never refreshed at all; pinning studioSyncRows alone would pass with nothing calling it.
  const rows = lift("studioSyncRows");
  for (const hook of ["data-sst-photo", "data-sst-route", "data-sst-metwrap", "data-sst-stylewrap",
                      "data-sst-destwrap", "data-sst-priv", "data-sst-strava"]) {
    assert.match(rows, new RegExp('querySelector\\("\\[' + hook + '\\]"\\)'),
      hook + " is no longer refreshed, so its state can go stale after a change");
  }
  assert.match(lift("studioSync"), /studioSyncRows\(\)/, "studioSync no longer refreshes the sheet rows");
  assert.match(lift("studioSheet"), /studioSyncRows\(\)/, "a freshly opened sheet is never filled");
  // ⚠️ AND EVERY TOOL'S BODY IS AN EMPTY HOOK, NOT MARKUP WRITTEN AT OPEN. A body built once cannot
  // restate itself when the state moves under it — turning the route off makes the poster ineligible, so
  // the Style list has to say so while the sheet is still open.
  const dispatch = nocomment(lift("studioSheetHtml"));
  const bodies = [...dispatch.matchAll(/'<div (data-sst-[a-z]+)><\/div>'/g)].map((m) => m[1]!);
  assert.ok(bodies.length >= 6, "a tool's sheet body is inline markup rather than a rebuilt hook: " + bodies.join(", "));
});

test("BLOCKER: the picker's file input is display:none and sits OUTSIDE the panel a sheet inerts", () => {
  // ⚠️ IT SHIPPED UNSTYLED AND VISIBLE. Measured 303x24 at full opacity in both themes, sitting
  // directly under the button that exists to replace it, and carrying aria-hidden — which is the wrong
  // way round: hidden from assistive tech, present to eyes. A display:none input is out of the
  // accessibility tree and the tab order already, so neither aria-hidden nor tabindex is needed.
  const html = page();
  const inputs = [...html.matchAll(/<input[^>]*type=\\?"file\\?"[^>]*>/g)].map((m) => m[0]);
  assert.ok(inputs.length >= 4, "expected the app's file inputs, found " + inputs.length);
  const shown = inputs.filter((i) => !/display\s*:\s*none/.test(i));
  assert.deepEqual(shown, [], "a file input renders as the browser's own grey control: " + shown.join(" | "));
  const studioInput = inputs.filter((i) => /data-sst-file/.test(i));
  assert.equal(studioInput.length, 1, "the studio's picker input is missing");
  assert.ok(!/aria-hidden/.test(studioInput[0]!),
    "a display:none input does not need aria-hidden, and carrying it while visible was the original fault");
  // ⚠️ AND ITS POSITION IS LOAD-BEARING NOW. "Change photo" lives inside a sheet, and a sheet makes the
  // panel behind it inert — so an input inside that panel would be inert at the exact moment the runner
  // asks for the picker. It has to be a child of the overlay, outside .sst-body.
  //
  // ⚠️ THE FIRST VERSION OF THIS CHECK MEASURED NOTHING AND WAS CAUGHT BY ITS OWN RE-BREAK. It looked for
  // the input written "just after a closing div" and read the nearest one before it — which, with the
  // input moved INSIDE the panel, is the div closing the primary action block. Both orderings satisfied
  // it. Nesting in a string-concatenation builder can only be settled by counting the tags: the panel's
  // own opening div is balanced by its closing one exactly when the input sits outside it.
  const mk = lift("shareStudioHtml");
  const from = mk.indexOf('<div class="sst-body"');
  const to = mk.indexOf("data-sst-file");
  assert.ok(from > 0 && to > from, "the panel or the picker input is gone from the studio's markup");
  const between = mk.slice(from, to);
  const opens = (between.match(/<div\b/g) || []).length;
  const closes = (between.match(/<\/div>/g) || []).length;
  assert.equal(opens - closes, 0,
    "the picker input is nested " + (opens - closes) + " div(s) deep inside the panel a sheet inerts, " +
    "so the picker cannot be opened from a sheet");
});

// ---- one run, at every action --------------------------------------------------------------------

test("Share, Save and Strava in the studio all act on the run it was opened with", () => {
  // ⚠️ MEASURED DISAGREEING. Share read currentOverviewRun() while Save beside it read STUDIO.run, so
  // opening the studio for run B from a screen showing run A gave {share: A, save: B} — and the
  // failure is silent, because a mismatched run misses SCARD.key and the tap degrades to a text-only
  // share with the runner's photograph quietly dropped. Same reasoning as viewRunId replacing
  // viewRunIdx: a re-resolved handle is not a handle.
  // ⚠️ THE SHARE CALL MOVED INTO studioDest WHEN THE ROW BECAME DESTINATION TILES (ruling 8), so the
  // scope is both functions — and the invariant is exactly as before. Pinning studioClick alone would now
  // pass with every tile re-resolving the run from the screen behind the overlay.
  const handler = lift("studioClick") + "\n" + lift("studioDest");
  assert.match(lift("studioDest"), /doShareRun\(STUDIO\.run\)/,
    "the destination tiles do not act on the studio's own run");
  assert.match(lift("studioClick"), /saveShareCard\(STUDIO\.run\)/, "Save does not act on the studio's own run");
  assert.match(handler, /stravaSendRun\(STUDIO\.run/, "Send to Strava does not act on the studio's own run");
  assert.ok(!/currentOverviewRun\(/.test(handler),
    "the studio re-resolves the run from the screen behind it instead of using the one it holds");
  // The parameter has to exist for a caller to be able to pass one.
  assert.match(lift("doShareRun"), /function doShareRun\(run\)/, "doShareRun cannot be told which run");
});

test("the studio's Send to Strava is wired, and wire()'s copy cannot reach into the overlay", () => {
  // ⚠️ IT RENDERED WITH NO HANDLER AT ALL. wire() picks the button up by id on every render — and
  // opening the studio does not render — so a connected runner met a full-width primary button reading
  // "Send to Strava" that did nothing, and on the Logbook debrief the studio is the ONLY route to
  // Strava. While the studio sits over the FINISH screen there are two #stvSend nodes, so the
  // render-time lookup is scoped to .app: unscoped it would re-point the studio's button at the run on
  // the screen behind, which is the same re-resolve fault as the row above.
  assert.match(lift("studioClick"), /#stvSend/, "nothing in the studio wires its Strava button");
  const wire = lift("wire");
  assert.match(wire, /querySelector\("#stvSend"\)/, "the finish screen's Strava button lost its wiring");
  assert.ok(!/\$\("stvSend"\)/.test(wire),
    "a document-wide lookup reaches into the studio overlay, where the button belongs to another run");
});

test("there is one share flow, and no button jumps straight to doShareRun", () => {
  // ⚠️ THE FINISH SCREEN WENT STRAIGHT TO doShareRun, so the photo editor was unreachable at the one
  // moment a runner most wants to share, and the card was built from a hand-built stub with no pband:
  // measured, "LOGGED" with no target lane on the finish screen against "NAILED THE BRIEF" with a lane
  // for the identical run in the Logbook.
  const html = page();
  const wired = [...html.matchAll(/onclick = \(\) => doShareRun\b/g)].map((m) => m[0]);
  assert.deepEqual(wired, [], "a button calls doShareRun directly instead of opening the studio");
  assert.match(lift("wire"), /shareRun\.onclick = \(\) => openShareStudio\(/,
    "the finish screen's Share button does not open the studio");
  assert.match(lift("wireRunDebrief"), /openShareStudio\(/,
    "the Logbook debrief's Share button does not open the studio");
  // The finish screen and the studio must resolve one run — the resolver, not a second literal.
  assert.match(lift("currentOverviewRun"), /liveCompleteRun\(LIVE\.summary\)/,
    "the finish screen's run is hand-built again instead of coming from liveRunRecord");
});

// ---- the two dialogs, and the third ---------------------------------------------------------------

test("all three dialogs keep the promise aria-modal makes", () => {
  // ⚠️ TWO OVERLAYS, ONE SET OF RULES. Both are role="dialog" aria-modal="true" on document.body and
  // both measured the same way: activeElement still BODY, Escape doing nothing, 24 focusable controls
  // live behind them, .app not inert. So assistive tech was told to ignore everything outside a dialog
  // focus had never entered. Written twice these drift, and the second copy is the one nobody measures.
  const modal = lift("overlayModal");
  assert.match(modal, /app\.inert = !!on/, "the app behind the dialog is not made inert");
  assert.match(modal, /focus\(\{ preventScroll: true \}\)/, "focus is not moved without scrolling the panel");
  assert.match(modal, /ov\.modalReturn = was/,
    "the return node is not parked on the overlay, so two overlays would share one slot");
  // ⚠️ AND THE RETURN NODE IS READ BEFORE ANYTHING IS INERTED. Making an element inert while it holds
  // focus blurs it, so reading activeElement afterwards answered BODY and a keyboard user was returned to
  // the top of the document instead of the control they opened the dialog from.
  const readAt = modal.indexOf("document.activeElement");
  const inertAt = modal.indexOf("app.inert");
  assert.ok(readAt > 0 && readAt < inertAt,
    "activeElement is read after the panel is inerted, so the return node is always BODY");

  for (const [open, close, first] of [
    ["openShareStudio", "closeShareStudio", '\\[data-sst="cancel"\\]'],
    ["openRunStory", "closeRunStory", "#storyX"],
  ] as const) {
    const o = lift(open), c = lift(close);
    assert.match(o, new RegExp("overlayModal\\(ov, true, \"?'?" + first),
      open + " does not move focus into the dialog");
    assert.match(o, /addEventListener\("keydown"/, open + " has no Escape handler");
    // ⚠️ THE ESCAPE INVARIANT IS "THE KEY REACHES THE CLOSE", NOT A PARTICULAR SPELLING OF THE TEST. The
    // studio's handler now unwinds a layer at a time, so it reads the key with !== and returns early —
    // the old regex demanded === and would have failed a correct improvement.
    const key = o.slice(o.indexOf('addEventListener("keydown"'));
    assert.match(key, /"Escape"/, open + " no longer looks at the Escape key");
    assert.match(key, new RegExp('"Escape"[\\s\\S]*?' + close + "\\(\\)"),
      open + "'s Escape does not close it");
    assert.match(c, /overlayModal\(ov, false/, close + " leaves the app inert and focus stranded");
    // ⚠️ RESTORE BEFORE THE MARKUP GOES, or focus is restored from a node already disconnected.
    const restore = c.indexOf("overlayModal(ov, false");
    const wipe = c.indexOf('innerHTML = ""');
    assert.ok(restore > 0 && wipe > restore,
      close + " clears its markup before restoring focus, which lands the runner on BODY");
  }

  // ⚠️ THE TOOL SHEET IS THE THIRD DIALOG AND IT GOES THROUGH THE SAME HELPER. A sheet that only paints
  // over the panel leaves every control under it in the tab order, so a keyboard user tabs straight out
  // of the sheet into carousel arrows they can no longer see. behind is what let one helper serve three.
  const sheet = lift("studioSheet");
  assert.match(sheet, /overlayModal\(sh, true, [^,]+, panel\)/,
    "the tool sheet does not make the panel behind it inert through the shared helper");
  assert.match(sheet, /overlayModal\(sh, false, "", panel\)/, "closing the sheet leaves the panel inert");
  assert.match(modal, /function overlayModal\(ov, on, firstSel, behind\)/,
    "overlayModal cannot be told what to inert, so the sheet needs its own copy of the rules");
  // Escape unwinds one layer at a time: the sheet first, then the framing mode, then the studio.
  const esc = lift("openShareStudio");
  const shAt = esc.indexOf("studioSheet(null)");
  const edAt = esc.indexOf("studioEdit(false)");
  const clAt = esc.indexOf("closeShareStudio()");
  assert.ok(shAt > 0 && edAt > shAt && clAt > edAt,
    "Escape does not unwind the sheet and the framing mode before closing the whole studio");
});

// ---- the carousel --------------------------------------------------------------------------------

test("BLOCKER: the carousel offers only templates this run can honestly fill", () => {
  // ⚠️ THE ELIGIBILITY COMES FROM THE MODEL THE CARD IS DRAWN FROM, not from a second composition of
  // shareTemplateStates. Composing it again would be a second answer to "which templates can this run
  // have", and the two could disagree about a card already on screen.
  const sync = lift("studioSync");
  assert.match(sync, /shareCardModel\(STUDIO\.run, shareCardOpts\(\)\)/, "studioSync no longer builds the model");
  assert.match(sync, /SHARE_TEMPLATES\.filter\(\(id\) => m\.eligibility\[id\] && m\.eligibility\[id\]\.ok\)/,
    "the carousel's contents are not the model's own eligibility");
  assert.ok(!/shareTemplateStates\(/.test(sync),
    "studioSync composes eligibility a second time, so it can disagree with the card on the stage");
  // ⚠️ AND THE INDEX IS DERIVED FROM WHAT IS ACTUALLY DRAWN. A template can stop being eligible under the
  // runner's own hands — removing the photograph while The Progression is selected — and shareTemplateFor
  // then falls through. An index kept independently would leave the dots, the name and the gestures all
  // describing a card nobody is looking at.
  assert.match(sync, /STUDIO\.idx = Math\.max\(0, STUDIO\.cards\.indexOf\(m\.template\)\)/,
    "the carousel position is held independently of the card being drawn");
  // ⚠️ AND A FALL-THROUGH IS NEVER PROMOTED TO A CHOICE. Writing the answer back into the ask looked tidy
  // and was measured wrong: opening on a run with a route and no photograph leaves only The Route Poster
  // eligible, so adding a photograph then KEPT the poster selected and the runner had to page three cards
  // back to reach The Moment — the contract's own "default, most broadly useful card". Only an explicit
  // selection may write the ask.
  assert.ok(!/SCARD\.template = /.test(nocomment(sync)),
    "studioSync writes the runner's ask, so a template nobody chose becomes a template they cannot leave");
  assert.match(nocomment(lift("studioSelectTemplate")), /SCARD\.template = id/,
    "choosing a template does not record the choice");
  // Paging goes through the one selection path, which goes through studioSync — so every derived thing
  // (the framing slot, the aria summary, the metrics note, the export) is re-derived from one model.
  assert.match(lift("studioGo"), /studioSelectTemplate\(STUDIO\.order\[next\]\)/,
    "paging nudges the index instead of re-deriving from the model");
  assert.match(lift("studioSelectTemplate"), /studioSync\(\)/, "selecting a template does not re-sync");
});

test("BLOCKER: an ineligible style is stated in words, as a row that cannot be tapped", () => {
  // ⚠️ BOTH HALVES OF THE SPEC'S OWN INSTRUCTION — "ineligible templates are hidden or clearly explain
  // what is required". Hidden from the swipe, because a page that cannot be drawn is a dead page; stated
  // in the Style tool, because hiding a style with no explanation anywhere means a runner never learns
  // that The Route Poster exists or that a photograph would unlock three of them.
  const style = lift("studioStyleHtml");
  assert.match(style, /SHARE_TEMPLATES\.map/, "the Style list is not derived from the template list");
  assert.match(style, /s\.why/, "an ineligible style does not state its reason");
  // ⚠️ A div WITH aria-disabled, NEVER A BUTTON. That is the rule test/design-system.test.ts already
  // enforces on plan session rows, for this exact reason: a button that silently does nothing is worse
  // than a row that plainly cannot be chosen.
  const dead = style.slice(style.indexOf("if (!s.ok)"), style.indexOf("const sel"));
  assert.match(dead, /<div class="sst-row/, "an ineligible style renders as a button");
  assert.match(dead, /aria-disabled="true"/, "an ineligible style is not marked disabled");
  assert.ok(!/<button/.test(dead), "an ineligible style renders a button that does nothing");
  // Every template has a line saying what it is for, so a name alone does not have to carry it.
  const blurb = liftConst("SHARE_TEMPLATE_BLURB");
  for (const id of ["moment", "execution", "progression", "route"]) {
    assert.ok(blurb.includes(id + ":"), "no blurb for " + id);
  }
});

test("BLOCKER: the preview stays dominant, the neighbours peek, and the position is stated", () => {
  // ⚠️ MEASURED AT 53.7% OF THE VIEWPORT WITH 42% OF THE STAGE EMPTY EITHER SIDE before the stage became
  // width-driven. The carousel spends some of that width on the peek, so the height has to follow the
  // CARD's width and not the stage's — otherwise the wrap is taller than the card in it and the peeking
  // neighbours sit in a band of empty stage.
  const slide = Number(/const SST_SLIDE = ([0-9.]+)/.exec(page())?.[1]);
  assert.ok(slide >= 0.8 && slide < 1,
    "the slide is " + slide + " of the stage: under 0.8 the preview stops being dominant, at 1 nothing peeks");
  assert.match(rule(".sst-slide"), new RegExp("flex: 0 0 var\\(--sstslide, " + Math.round(slide * 100) + "%\\)"),
    "the CSS slide fallback and SST_SLIDE disagree, so the peek and the height start from different numbers");
  const h = lift("studioStageHeight");
  assert.match(h, /availW \* SST_SLIDE/, "the stage height is derived from the stage width, not the card's");
  // ⚠️ THE OUTPUT-BOX READ THAT USED TO BE PINNED HERE WENT WITH THE TRANSPARENT OUTPUT. It was the one
  // shape whose canvas was cut to its own ink, so its output box differed from the 1080-wide space it was
  // laid out in; with two fixed shapes the two are the same box and a second pair of fields would be an
  // identity the next reader believes means something.
  assert.ok(!/\bOW\b|\bOH\b/.test(h),
    "the stage reads an output box again, which for both remaining shapes is the layout box");
  // ⚠️ AND THE FRAME FOLLOWS ITS REAL WIDTH, NOT THE ALLOWANCE. On a short screen the height cap binds
  // first and the frame comes out narrower than SST_SLIDE allowed; a slide left at the allowance pushed
  // the neighbour's CARD past the edge of the stage while its empty half sat in the gutter — measured on
  // 320x568, the card at 49% of the stage with no peek at all and half the stage empty, which is the
  // fault this design exists to remove reappearing on the smallest supported screen. The arithmetic is
  // studioFrameFit's and is swept in its own test; what this pins is that the stage USES it.
  assert.match(h, /const fit = studioFrameFit\(cardW, room, fr\)/,
    "the stage height derives the frame a second time instead of asking for it");
  assert.match(h, /STUDIO\.slideW = fit\.slideW/,
    "the slide is not narrowed to the frame, so the peek disappears whenever the height cap binds");
  assert.match(h, /STUDIO\.stageH = h/,
    "the stage height is not published, so studioMount has to measure a box the canvas can widen");
  assert.match(h, /setProperty\("--sstslide"/, "the measured slide width never reaches the layout");
  // ⚠️ ONE SLIDE WIDTH, READ BY THE TRANSFORM AND BY THE DRAG SCALE. Two derivations of it put the card
  // off centre at every position but the first, and made a drag move the picture further than the finger.
  assert.match(lift("studioTrackPos"), /STUDIO\.slideW \|\| w \* SST_SLIDE/,
    "the track's transform derives the slide width a second time");
  assert.match(lift("studioGestures"), /STUDIO\.slideW \|\| \(st\.clientWidth \|\| 1\) \* SST_SLIDE/,
    "the drag scale derives the card width a second time");
  // ⚠️ THE RESERVE IS MEASURED, NOT A CONSTANT, AND IT ANCHORS ON THE PRIMARY ACTION. --tscale grows every
  // row below the stage, and a hardcoded reserve would push the only way to the destinations under the
  // fold for exactly the runner who most needs to see it. The old anchor was the photo row, which has
  // moved into a sheet — a reserve measured against something not on the primary screen is zero.
  assert.match(h, /querySelector\("\[data-sst-keep\]"\)/,
    "the stage no longer measures the room the primary action needs");
  assert.match(h, /offsetTop/, "the reserve is measured viewport-relative, so it grows as the panel scrolls");
  assert.ok(!/getBoundingClientRect/.test(h), "a scroller must not be measured with getBoundingClientRect");
  assert.match(lift("shareStudioHtml"), /data-sst-keep/, "nothing carries the hook the reserve is measured to");
  // The page position is stated in words as well as in dots, and the dots are hidden from assistive tech.
  const pos = lift("studioPosHtml");
  assert.match(pos, /" of " \+ n \+ " styles"/, "the carousel does not say which card of how many");
  assert.match(pos, /SHARE_TEMPLATE_LABEL/, "the carousel does not name the selected style");
  assert.match(pos, /class="sst-dots" aria-hidden="true"/, "the dots are announced as unnamed elements");
  // Prev/next are real buttons with real labels, which is the drag alternative the spec asks for.
  assert.match(pos, /data-sst="prev"[\s\S]*?aria-label="Previous card style"/, "the previous-style button has no label");
  assert.match(pos, /data-sst="next"[\s\S]*?aria-label="Next card style"/, "the next-style button has no label");
  assert.match(pos, /i <= 0 \? " disabled"/, "the first card's previous arrow is live and does nothing");
  assert.match(pos, /i >= n - 1 \? " disabled"/, "the last card's next arrow is live and does nothing");
});

test("BLOCKER: only three cards hold a canvas, and the neighbours are drawn smaller", () => {
  // ⚠️ A MEMORY DECISION, MEASURED. A story card is 2.07 MB of RGBA at the preview scale; four of them is
  // 8.3 MB resident on a device whose web view is jetsammed with no exception and nothing in the console.
  // The neighbours occupy about 6% of the stage until a finger moves, so a third of the scale is 0.92 MB
  // each and the softness is never on the card being edited.
  const cur = Number(/const SST_CUR = ([0-9.]+)/.exec(page())?.[1]);
  assert.equal(cur, 0.5, "the preview scale moved; the memory note beside it is now wrong");
  assert.match(page(), /SST_NEIGH = 1 \/ 3/, "the neighbours are no longer drawn smaller than the selected card");
  const mount = lift("studioMount");
  assert.match(mount, /Math\.abs\(i - STUDIO\.idx\) > 1/, "every slide holds a canvas, whatever the memory cost");
  assert.match(mount, /cv\.width = 0; cv\.height = 0; cv\.remove\(\)/,
    "an out-of-reach canvas is removed without zeroing its backing store, which does not free the bitmap");
  assert.match(mount, /i === STUDIO\.idx \? SST_CUR : SST_NEIGH/, "the two scales are no longer applied per slide");
  // ⚠️ THE DISPLAY SIZE COMES FROM THE PUBLISHED FRAME, NEVER FROM A MEASURED BOX, AND THAT IS THE
  // 320x568 DEFECT. A canvas whose bitmap is set but whose style width is not yet assigned has an
  // intrinsic width of that bitmap — 337px for a 1020-wide card at the neighbour scale — so reading
  // slide.clientWidth measured a box the canvas had just widened and fitted the card to it. Measured with
  // four differently-shaped cards: slides [248, 298, 293, 248] against a published 248, the card 114px off
  // centre and 76px of it clipped away by the stage's overflow: hidden. Fixed and re-measured: 0px
  // clipped, 1px worst centre error, every slide exactly the published width, across 96 combinations of
  // output, template, viewport and theme.
  assert.match(mount, /const bw = STUDIO\.slideW \|\|/,
    "the card is sized from a measured box the canvas itself can widen, so the fit chases its own input");
  assert.match(mount, /const bh = STUDIO\.stageH \|\|/, "the card's height comes from a measured box, not the frame");
  assert.ok(!/slide\.client(Width|Height)/.test(nocomment(mount)),
    "studioMount still measures the slide, which is the feedback loop that clipped the card at 320x568");
  // ⚠️ AND THE SCALE IS READ BACK OFF THE CANVAS RATHER THAN PASSED IN, so a half-scale drawing can never
  // land in a third-scale buffer the day the selection moves.
  const paint = nocomment(lift("studioPaintSlide"));
  assert.match(paint, /const m = studioModelFor\(STUDIO\.cards\[i\]\)/,
    "the paint no longer builds one model for the slide");
  assert.match(paint, /shareDrawInto\(g, m, gm, cv\.width \/ gm\.W\)/,
    "the paint takes a scale of its own instead of the one the canvas was actually sized at");
  // ⚠️ ONE GEOMETRY FOR THE WHOLE CAROUSEL, READ ONCE. Both remaining outputs give all four templates one
  // shape, so the frame, every slide's buffer and the draw must all come from the same read — the
  // per-slide geometry and the tallest-card search that used to live here existed only for the withdrawn
  // transparent output, whose four templates were four shapes.
  assert.match(mount, /const gm = cardGeom\(SCARD\.aspect\);/,
    "the carousel resolves a geometry per slide again, so the frame and the fit can be told two shapes");
  assert.match(mount, /studioStageHeight\(st, gm\)/,
    "the stage is not sized from the one geometry the cards are drawn at");
  assert.match(mount, /c\.width = Math\.round\(gm\.W \* S\); c\.height = Math\.round\(gm\.H \* S\);/,
    "a slide's buffer is sized from something other than the card's own geometry");
  assert.match(mount, /const fit = studioCardFit\(gm, bw, bh\)/,
    "the displayed size is not fitted from the same geometry the buffer was sized at");
});

test("BLOCKER: every card comes out exactly the slide's width, at every screen size", () => {
  /**
   * ⚠️ BOTH REMAINING OUTPUTS GIVE ALL FOUR TEMPLATES ONE SHAPE, SO THIS HOLDS BY CONSTRUCTION TODAY —
   * AND IT IS SWEPT ANYWAY, over shape sets far wilder than the renderer can produce. The withdrawn
   * transparent output was the one whose four templates were four shapes (aspect 0.98 / 1.42 / 1.40 /
   * 0.85), and it is what found the fault: a frame taken from the selected card left the others clipped
   * or stranded in a gutter, with the stage resizing under the runner's finger. A fixture of today's
   * shapes proves only today.
   *
   * ⚠️ AND SWEPT OVER THE SMALL SIZES. Measured live, the fault was 0px at 430x932 and 76px at 320x568:
   * a sweep run only at the comfortable size cannot see it. Every point here is a real stage width and a
   * real room from the live editor at 320x568 / 375x812 / 430x932, plus the case where the 210px floor
   * binds, which is what 320x568 does.
   */
  const src = page();
  const F = new Function(liftConst("SST_STAGE_MIN") + "\n" +
    lift("studioFrameFit") + "\n" + lift("studioCardFit") +
    "\nreturn { studioFrameFit, studioCardFit, SST_STAGE_MIN };")() as any;
  // ⚠️ THE FLOOR IS DECLARED TWICE — once in JS and once as .sst-stagewrap's min-height — and two owners
  // of one measurement is a documented fault in this very function. So they are compared rather than
  // trusted: a layout floor above the fit's would let a card be fitted for a stage shorter than the one
  // it is drawn in, which is clipping with nothing in the code to point at.
  const jsMin = Number(/const SST_STAGE_MIN = (\d+)/.exec(src)?.[1]);
  const cssMin = Number(/min-height:\s*(\d+)px/.exec(rule(".sst-stagewrap"))?.[1]);
  assert.equal(jsMin, cssMin, "the fit's floor and .sst-stagewrap's min-height are different numbers");
  assert.equal(F.SST_STAGE_MIN, jsMin, "SST_STAGE_MIN did not lift");

  const OUTPUTS: Record<string, number[][]> = {
    story: [[1080, 1920], [1080, 1920], [1080, 1920], [1080, 1920]],
    feed: [[1080, 1350], [1080, 1350], [1080, 1350], [1080, 1350]],
    // ⚠️ THE SET THE WITHDRAWN TRANSPARENT OUTPUT ACTUALLY PRODUCED (read from the exported PNGs' own
    // IHDRs), kept as the historical worst case, plus one deliberately worse than the renderer can make.
    mixed: [[1020, 1044], [1020, 720], [1020, 730], [1014, 1188]],
    wild: [[1080, 360], [1080, 3240], [900, 900], [1080, 1201]],
    pair: [[1014, 1188], [1020, 720]],
    one: [[1020, 730]],
  };
  const geo = (wh: number[]) => ({ W: wh[0], H: wh[1] });
  // (stage width, room) as measured live. 320x568's room is under the floor, which is the binding case.
  const SCREENS = [[288, 190], [288, 210], [343, 620], [398, 700], [398, 401], [288, 500]];
  let worstSpread = 0, worstOver = 0, rows = 0;
  for (const name of Object.keys(OUTPUTS)) {
    for (const [availW, room] of SCREENS) {
      const geoms = OUTPUTS[name]!.map(geo);
      // ⚠️ THE FRAME IS THE TALLEST BOX, WHICH IS THE ONLY ASPECT THAT KEEPS "SLIDE == CARD" FOR EVERY
      // CARD AT ONCE: fit a card into a box at least as tall as its own aspect and the WIDTH binds. Any
      // shallower frame makes the tall cards height-bound — narrower than their own slide, gutters
      // swallowing the neighbour's card, which is the 320x568 fault. The app hands one shape for every
      // card, so this reduces to that shape; the sweep proves the property holds for any set.
      const tallest = (gs: any[]) => gs.reduce((a: any, g: any) => (!a || g.H * a.W > a.H * g.W ? g : a), null);
      const fr = tallest(geoms);
      const fit = F.studioFrameFit(availW! * 0.86, room!, fr);
      // ⚠️ AND THE FRAME DOES NOT DEPEND ON WHICH CARD IS SELECTED. That is the whole of the no-swing
      // claim, re-derived from every rotation of the list rather than from the order the editor holds.
      for (let r = 0; r < geoms.length; r++) {
        const rot = geoms.slice(r).concat(geoms.slice(0, r));
        const f2 = F.studioFrameFit(availW! * 0.86, room!, tallest(rot));
        assert.deepEqual(f2, fit, name + " at " + availW + "x" + room +
          ": the frame moves with the selection, so the stage and the Share button under it move as the runner pages");
      }
      for (let i = 0; i < geoms.length; i++) {
        const c = F.studioCardFit(geoms[i], fit.slideW, fit.h);
        rows++;
        worstSpread = Math.max(worstSpread, Math.abs(c.w - fit.slideW));
        worstOver = Math.max(worstOver, c.w - fit.slideW, c.h - fit.h);
        assert.equal(c.w, fit.slideW,
          name + " card " + i + " at stage " + availW + "/room " + room + ": the card is " + c.w +
          " in a " + fit.slideW + " slide — a card narrower than its slide loses the peek, a card wider is clipped");
        assert.ok(c.h <= fit.h,
          name + " card " + i + ": " + c.h + " tall in a " + fit.h + " stage, so its bottom rows are cut off");
      }
    }
  }
  assert.equal(worstSpread, 0, "some card is not its slide's width");
  assert.ok(worstOver <= 0, "some card overflows the frame");
  assert.equal(rows, 114, "the sweep no longer covers every shape set at every screen");
  // ⚠️ AND THE CSS PINS THE BOX SO THE CANVAS CANNOT ARGUE WITH IT. A flex item defaults to
  // min-width: auto and refuses to shrink below its content; that is what let the canvas's own intrinsic
  // bitmap width widen the slide in the first place, and it is a second, independent way for the fit
  // above to be told a width nobody published.
  const sl = rule(".sst-slide");
  assert.match(sl, /min-width: 0/, "the slide can still be widened by its own content");
  assert.match(sl, /max-width: var\(--sstslide, 86%\)/, "the slide has no ceiling, so a wide canvas widens it");
});

test("BLOCKER: the carousel's motion is off for a runner who asked for less of it", () => {
  // ⚠️ ITS OWN RULE RATHER THAN RELYING ON THE GLOBAL ONE. The global block catches component transitions
  // today, but the carousel is the one animation on this screen a runner who asked for less movement
  // would notice most, and a rule of its own cannot be lost to a future change in the global selector
  // list. The page still changes; it changes instantly.
  const c = css();
  assert.match(rule(".sst-track"), /transition: transform/, "the carousel does not animate at all");
  // ⚠️ EVERY REDUCED-MOTION BLOCK IS SCANNED, BRACE-MATCHED. This project's own history: a guard that
  // sliced from the FIRST occurrence of a marker to the next newline reported the global reduce-motion
  // rule as missing while it sat two hundred lines below — and the obvious "fix" would have been to
  // delete the assertion. There are fourteen of these blocks and they are written both one-line and
  // multi-line, so neither a line-based nor a first-match read can be trusted.
  const blocks: string[] = [];
  for (const m of c.matchAll(/@media \(prefers-reduced-motion: reduce\) \{/g)) {
    let d = 0;
    for (let i = m.index! + m[0].length - 1; i < c.length; i++) {
      if (c[i] === "{") d++;
      else if (c[i] === "}") { d--; if (!d) { blocks.push(c.slice(m.index!, i + 1)); break; } }
    }
  }
  assert.ok(blocks.length >= 2, "the reduced-motion blocks are gone");
  assert.ok(blocks.some((b) => /\.sst-track\b[^}]*transition: none/.test(b)),
    "the carousel keeps animating under Reduce Motion; " + blocks.length + " blocks scanned");
  // And the finger-tracking class kills the easing outright, or the card lags behind the drag.
  assert.match(rule(".sst-track.sst-nom"), /transition: none/, "a dragged card is eased, so it trails the finger");
  const g = lift("studioGestures");
  assert.match(g, /classList\.add\("sst-nom"\)/, "the drag does not disable the easing");
  assert.match(g, /classList\.remove\("sst-nom"\)/, "the easing never comes back, so a page turn does not animate");
});

// ---- the framing ---------------------------------------------------------------------------------

test("BLOCKER: the gestures write the framing slot, never the photograph", () => {
  // ⚠️ THE CROP IS PER TEMPLATE AND PER ASPECT NOW. Writing SPHOTO.ox would move a framing no card reads
  // and leave the one on screen untouched — a drag that appears to do nothing.
  const g = nocomment(lift("studioGestures"));
  assert.match(g, /shareCropWrite\(STUDIO\.model && STUDIO\.model\.template, SCARD\.aspect\)/,
    "the gestures do not resolve the framing slot from the template being drawn");
  const writes = [...g.matchAll(/SPHOTO\.(ox|oy|k)\s*=/g)].map((m) => m[0]);
  assert.deepEqual(writes, [], "the gestures write the photograph's own geometry again: " + writes.join(", "));
  // ⚠️ AND THE FINGER-TO-CANVAS SCALE IS OFF THE CARD, NOT THE STAGE. Left at the stage width every drag
  // moved the picture 86% as far as the finger and the anchored pinch drifted away from the fingers.
  assert.match(g, /CARD_W \/ cardW\(\)/, "the drag scale is taken from the stage, so the picture lags the finger");
  assert.match(g, /const gut = \(\(st\.clientWidth \|\| 1\) - cardW\(\)\) \/ 2/,
    "the pinch anchor ignores the gutter, so it zooms about the wrong point");
});

test("BLOCKER: a new photograph resets the framing and keeps the chosen style", () => {
  // ⚠️ AN OFFSET AND A ZOOM DESCRIBE WHERE A SUBJECT SITS IN ONE PICTURE. Carried to a different
  // photograph of a different shape they are not a framing the runner chose, they are an arbitrary crop of
  // somebody else's composition. The spec asks for exactly this: "Replacing the photo preserves the
  // chosen template but resets invalid crop geometry."
  const take = nocomment(lift("studioTake"));
  assert.match(take, /crops: \{\}/, "a replacement photograph inherits the previous one's framing");
  assert.match(take, /STUDIO\.undo = \[\]/, "the undo history survives the photograph it described");
  assert.ok(!/SCARD\.template =/.test(take),
    "replacing the photograph moves the chosen style, which the spec forbids");
  // ⚠️ THE ROUTE DECISION IS RESET ONLY WHEN THERE WAS NO PHOTOGRAPH BEFORE. Once the runner has turned
  // the inset on by hand, swapping the picture is not a reason to turn it off again behind them.
  assert.match(take, /const t0 = shareNow\(\), had = !!SPHOTO/, "nothing records whether a photograph was already chosen");
  assert.match(take, /if \(!had\) SCARD\.routeOn = null/,
    "replacing the photograph discards the runner's own route decision");
  // Removing the photograph clears the history for the same reason.
  assert.match(nocomment(lift("studioClick")), /SPHOTO = null; SCARD\.routeOn = null; STUDIO\.undo = \[\]/,
    "removing the photograph leaves undo entries naming a picture that is gone");
});

test("BLOCKER: undo takes one entry per gesture, is bounded, and Reset is undoable", () => {
  // ⚠️ ONE ENTRY PER GESTURE, NOT PER FRAME. A drag fires dozens of pointermove events and each one moves
  // the picture, so pushing on the change would make Undo a way of replaying a swipe one pixel at a time.
  const g = nocomment(lift("studioGestures"));
  assert.match(g, /const arm = \(\) => \{ if \(!armed\) \{ studioCropArm\(\); armed = true; \} \}/,
    "the undo entry is not coalesced to one per gesture");
  assert.ok(!/onpointermove[\s\S]{0,600}studioCropArm/.test(g), "an undo entry is pushed while the finger moves");
  // ⚠️ AND AN ARMED ENTRY THAT NOTHING MOVED IS DISCARDED, or a tap leaves Undo offering to restore the
  // state the picture is already in. armed says whether THIS gesture pushed, so it cannot pop an earlier move.
  assert.match(g, /last\.ox === c\.ox && last\.oy === c\.oy && last\.k === c\.k\) STUDIO\.undo\.pop\(\)/,
    "an undo entry survives a gesture that changed nothing");
  // ⚠️ A WHEEL HAS NO pointerup TO CLOSE THE GESTURE, so its burst is closed by a gap in time instead.
  assert.match(g, /Date\.now\(\) - wheelAt > 400/,
    "a trackpad zoom fills the undo stack a notch at a time");
  const armFn = lift("studioCropArm");
  assert.match(armFn, /shareCropKey\(tmpl, SCARD\.aspect\)/, "an undo entry does not name the slot it describes");
  assert.match(armFn, /while \(STUDIO\.undo\.length > SST_UNDO_MAX\) STUDIO\.undo\.shift\(\)/,
    "the undo stack is unbounded inside one open of the studio");
  assert.match(lift("studioCropUndo"), /SPHOTO\.crops\[e\.key\]/,
    "undo restores the current framing rather than the one its entry named");
  assert.match(lift("studioCropReset"), /studioCropArm\(\)/, "Reset framing cannot itself be undone");
  // Both controls are rendered, and Undo is genuinely disabled with nothing to undo.
  const photo = lift("studioPhotoHtml");
  assert.match(photo, /data-sst="reset"/, "there is no way to reset the framing");
  assert.match(photo, /data-sst="undo"/, "there is no way to undo a move");
  assert.match(photo, /noUndo \? " disabled" : ""/, "Undo is live with an empty history");
  assert.match(lift("studioPosHtml"), /data-sst="undo"[\s\S]*?aria-label="Undo the last move"/,
    "the framing row's Undo has no accessible name");
});

// ---- the metrics editor --------------------------------------------------------------------------

test("BLOCKER: the metric chips express the cap and the floor by disabling, never by refusing a tap", () => {
  // ⚠️ WITH THREE CHOSEN THE FOURTH CANNOT GO ON, AND WITH ONE LEFT IT CANNOT COME OFF. A chip that
  // accepts the tap and then does nothing is the defect class this project has shipped three times, so
  // the state is on the control and the rule is stated in words above it.
  const m = lift("studioMetricsHtml");
  assert.match(m, /const full = chosen\.length >= SHARE_METRIC_MAX, last = chosen\.length <= 1/,
    "the cap and the floor are no longer computed");
  assert.match(m, /const dead = on \? last : full/, "the chip's disabled state is not derived from them");
  assert.match(m, /aria-disabled="true" disabled/, "a chip that cannot be tapped still looks live");
  assert.match(m, /Up to ' \+ SHARE_METRIC_MAX/, "the rule is not stated in words");
  assert.match(m, /only what this run recorded/, "the sheet does not say the offer is limited to real numbers");
  assert.match(m, /for this export only/, "the sheet does not say the pick is not remembered");
  // The toggle only ever runs on an enabled chip, and it holds the result in the pool's own order.
  const t = nocomment(lift("studioMetricToggle"));
  assert.match(t, /if \(cur\.length <= 1\) return/, "the last number can be turned off");
  assert.match(t, /if \(cur\.length >= SHARE_METRIC_MAX\) return/, "a fourth number can be turned on");
  assert.match(t, /SCARD\.metrics = pool\.filter\(\(k\) => cur\.indexOf\(k\) >= 0\)/,
    "the row is held in tap order, so two identical cards can print the same numbers differently arranged");
  assert.match(lift("studioClick"), /aria-disabled"\) === "true"\) return;\n    return studioMetricToggle/,
    "the disabled chip has no belt in the handler");
  // ⚠️ AND THE TWO DATA-LED TEMPLATES SAY IN WORDS THAT THEY DO NOT USE THIS ROW. References 02 and 04
  // print distance, time and average pace under a hero that is the verdict or the headline; letting the
  // picker appear to govern them would be a control that looks live over a card it cannot change.
  assert.match(m, /tmpl === "execution" \|\| tmpl === "progression"/,
    "the sheet does not know which templates ignore the pick");
  assert.match(m, /prints distance, time and average pace/, "the two data-led templates do not say so");
  // The pick dies with the studio: "persists for that card export, not globally".
  assert.match(lift("closeShareStudio"), /SCARD\.metrics = null/,
    "the chosen numbers outlive the export they were chosen for");
});

// ---- the destination sheet -----------------------------------------------------------------------

test("BLOCKER: there is one destination sheet, and the primary action is dead while the file is not ready", () => {
  const dest = lift("studioDestHtml");
  // ⚠️ THE SHAPE, AND THE ROW'S CONTENT, ARE BOTH THE OWNER'S — the shape from 2026-08-20 and the tiles
  // from ruling 8 on 2026-08-21: "I want the icons to the different social media options like shown in
  // the screenshot, with the more button allowing the further options that we already have when pressing
  // share." So a destination is now a TILE built from SST_DEST, plus the primary and the clipboard.
  assert.match(dest, /class="sst-dests"/, "the destinations are not a row of tiles");
  assert.match(dest, /SST_DEST\.map\(studioDestTile\)/,
    "the tile row is no longer built from SST_DEST, so the sweeps below enumerate nothing that ships");
  assert.match(dest, /class="sst-prim"/, "there is no full-width primary row");
  assert.match(dest, /class="sst-save" data-sst="save"/, "Save to device is not the primary");
  assert.match(dest, /class="sst-sec" data-sst="caption"/, "Copy caption is not offered");
  assert.match(dest, /class="sst-cog" data-ssttool="privacy" aria-label="/,
    "the settings affordance beside the primary is missing, unlabelled, or leads nowhere real");
  assert.match(dest, /stravaRunButtonHtml/, "Strava is not offered where the product allows it");
  // ⚠️ THE NOTE IS DERIVED NOW, NOT TYPED, so the assertion is about the derivation rather than about a
  // sentence. With no build-provided capability the note is the old one; with one it names the apps that
  // open directly and still admits the rest go through the sheet. Either way it must mention the sheet,
  // because the sheet is always where the rest go.
  assert.match(dest, /shareDestNote\(\)/, "the note is typed into the markup rather than derived");
  assert.match(lift("shareDestNote"), /own share sheet/,
    "no branch of the note says where a runner's other apps are");
  assert.match(lift("studioDestTile"), /aria-hidden="true"/,
    "a tile's glyph is not hidden from a screen reader, so its name is read twice");
  // ⚠️ THE PRIMARY ACTION IS IN THE DISABLED SET TOO, AND SO IS EVERY TILE. Leaving them live while the
  // file is being built opens a sheet whose every row is dead — the looks-live-does-nothing defect moved
  // one tap further in rather than removed.
  assert.match(lift("studioBusy"), /\[data-sstdest\], \[data-sst="save"\], \[data-sst="dest"\]/,
    "the destination tiles or the primary stay live while there is no file to share");
  assert.match(lift("studioBusy"), /Add a photo and your card is ready to share/,
    "a blocked export does not say why in words");
  // ⚠️ AND EVERY HANDOFF DISMISSES THE SHEET FIRST. iOS raises its own sheet over ours: coming back to a
  // destination list still sitting over the card reads as the tap having failed.
  const h = lift("studioClick");
  assert.match(h, /if \(what === "save"\) \{ studioSheet\(null\); return saveShareCard\(STUDIO\.run\); \}/,
    "saving leaves the destination sheet up over a download that has already happened");
  assert.match(nocomment(lift("studioDest")), /studioSheet\(null\);[\s\S]*doShareRun/,
    "a destination tile leaves the sheet up over the system sheet, or opens it in the wrong order");
  // The scrim dismisses, and the exclusion is what stops a tap on a note closing the sheet.
  assert.match(nocomment(h), /closest\("\[data-sst-sheet\]"\) && !t\.closest\("\[data-sst-sheetin\]"\)/,
    "either the scrim does not dismiss, or a tap anywhere inside the sheet dismisses it");
});

/* ---- the destination tiles (owner, ruling 8 item 3, 2026-08-21) --------------------------------- */

/** The destinations, read out of the app rather than listed here, so a fifth cannot arrive unguarded. */
function destRecords(): { id: string; label: string; glyph: string; native: string }[] {
  const src = appScript();
  const at = src.indexOf("const SST_DEST = [");
  assert.ok(at > 0, "SST_DEST is not in the build");
  let d = 0, end = -1;
  for (let i = src.indexOf("[", at); i < src.length; i++) {
    if (src[i] === "[") d++;
    else if (src[i] === "]") { d--; if (!d) { end = i + 1; break; } }
  }
  assert.ok(end > 0, "SST_DEST is unbalanced");
  const body = src.slice(src.indexOf("[", at), end);
  const out: any[] = [];
  for (const m of body.matchAll(/\{\s*id:\s*"([a-z]+)",\s*label:\s*"([^"]+)",\s*glyph:\s*([A-Z_a-z.]+),\s*\n?\s*native:\s*"([^"]*)"/g)) {
    out.push({ id: m[1]!, label: m[2]!, glyph: m[3]!, native: m[4]! });
  }
  assert.ok(out.length >= 4, "SST_DEST parsed as " + out.length + " records, so this sweep is measuring nothing");
  assert.equal(out.length, (body.match(/\bid:\s*"/g) || []).length,
    "a record in SST_DEST does not have the shape this sweep parses, so it would be skipped in silence");
  return out;
}

test("BLOCKER: every destination is a tile, every tile is wired, and none of them claims a direct post", () => {
  // ⚠️⚠️ THIS INVERTS A GUARD THAT SHIPPED THE DAY BEFORE, AND THE INVARIANT IS KEPT RATHER THAN DELETED.
  // The previous version forbade any destination whose LABEL named a third-party app, on the reasoning
  // that this app cannot detect whether Instagram is installed. The owner overruled the conclusion, not
  // the reasoning: "I want the icons to the different social media options like shown in the screenshot."
  // What was being protected survives and is now specific — a tile may name an app, and if it does it must
  // OPEN THE SYSTEM SHARE SHEET, where that app genuinely appears, and its accessible name must say so.
  const recs = destRecords();
  const dest = nocomment(lift("studioDestHtml"));
  const tile = nocomment(lift("studioDestTile"));
  const src = appScript();
  // The row is built from the records, and the attribute carries the record's own id.
  assert.match(tile, /data-sstdest="' \+ esc\(d\.id\) \+ '"/,
    "studioDestTile no longer writes the record's id into data-sstdest, so nothing below is enumerating the real tiles");
  // ⚠️ ONE ROUTE, ASSERTED AS A COUNT. Four tiles each dispatching for themselves is four chances for one
  // to be wired to something its logo does not imply, and a per-branch guard can only prove a branch calls
  // SOMETHING. Re-broken by giving one id its own branch.
  const go = nocomment(lift("studioDest"));
  assert.equal((go.match(/doShareRun\(/g) || []).length, 1,
    "studioDest has more than one handoff, so the tiles no longer provably share one route");
  assert.ok(!/saveShareCard|stravaSendRun|window\.open|location\.href/.test(go),
    "studioDest reaches a second destination, so a tile can send somewhere its label does not name");
  assert.ok(!new RegExp('id === "').test(go) && !/switch\s*\(/.test(go),
    "studioDest branches on the destination id, so one tile can behave differently from the rest");
  // An unknown id must do nothing rather than falling through to the share sheet.
  assert.match(go, /SST_DEST\.filter\(\(d\) => d\.id === id\)\.length\) return/,
    "an unrecognised data-sstdest reaches the share sheet, so any stray attribute becomes a share button");
  // ⚠️ AND THE ROUTE IS IN EVERY TILE'S ACCESSIBLE NAME, FROM ONE FUNCTION. It was one CONSTANT while
  // every tile opened the share sheet; two of them now open the app itself (owner, 2026-08-21), so a
  // shared string would tell a screen-reader user the wrong thing about half the row. One resolver, so
  // it still cannot be omitted from a single tile — and "label in name" holds either way, because the
  // label is the whole prefix of the spoken name.
  assert.match(tile, /esc\(d\.label \+ shareAppVia\(d\.id\)\)/,
    "a tile's accessible name is no longer its label plus the resolved route clause");
  const via = lift("shareAppVia");
  assert.match(via, /share sheet/i, "no branch of the route clause names the share sheet");
  assert.match(via, /opens the app/i, "no branch of the route clause names a direct open");
  assert.ok(!/const SST_VIA = /.test(src),
    "the flat SST_VIA constant is back, so half the row will be described wrongly");
  // ⚠️ THE VISIBLE LABEL MUST BE CONTAINED IN THE ACCESSIBLE NAME (WCAG "label in name"), or a
  // voice-control user saying the name they can see does not match the control.
  assert.match(tile, /class="sst-dl">' \+ esc\(d\.label\)/,
    "the visible label is no longer the record's label, so it may not be inside the accessible name");
  // Every record is complete, and every one names the native work a direct handoff would need.
  for (const r of recs) {
    assert.ok(r.label.trim().length >= 4, "a destination has no readable label: " + JSON.stringify(r));
    assert.match(r.glyph, /^SST_DGLYPH\./, r.id + " does not take its mark from the destination glyph set");
    assert.ok(r.native.length >= 20, r.id + " does not record what would make it a direct handoff: " +
      JSON.stringify(r.native));
    // ⚠️ AND NO LABEL MAY PROMISE A POST. "Instagram" is honest; "Post to Instagram Story" is not, because
    // that is precisely what needs an Xcode build.
    assert.ok(!/post|story|send to|upload|publish/i.test(r.label),
      r.id + "'s label promises a direct post, which is exactly what this row cannot do: " + r.label);
  }
  // ⚠️ NO URL SCHEME ANYWHERE NEAR THE ROW. A scheme could not work until somebody rebuilds in Xcode, and
  // it would fail silently. The plist now permits canOpenURL for five of them, which is permission to ASK
  // and not a handoff.
  for (const scheme of ["instagram:", "instagram-stories:", "fb://", "whatsapp:", "twitter:", "snapchat:", "sms:"]) {
    assert.ok(!dest.toLowerCase().includes(scheme) && !go.toLowerCase().includes(scheme),
      "the destinations open a third-party app by URL scheme: " + scheme);
  }
  // ⚠️ COMMUNITY IS DELIBERATELY NOT A TILE. His reference's row carries that app's own community feed;
  // ours is a placeholder tab with no backend, so a tile bearing it would be the looks-live-is-inert
  // defect the rest of this row exists to avoid.
  assert.ok(!recs.some((r) => /communit/i.test(r.label + r.id)),
    "Community is a destination tile, and it has no backend to be a destination of");
  // ⚠️ AND THE SCHEME GUARD ABOVE IS STILL RIGHT, WITH THE HANDOFF IN PLACE. The PAGE must never open a
  // third-party app itself: it hands the card to Swift, which does the open — so the page holds no
  // scheme, cannot be tricked into opening one by a stray attribute, and a browser build has nothing to
  // fall over. Where the schemes live is ios/InteRun-Info.plist and ShareAppService.
  // The note under the row says the same thing the names do, in the runner's own words — and it is
  // DERIVED now, because "Inte-Run cannot post to them directly" was true of every build until the one
  // that can. A sentence that overstates the app is the one a reader believes.
  assert.match(dest, /shareDestNote\(\)/, "the note is typed rather than derived from what is possible");
  const note = lift("shareDestNote");
  assert.match(note, /cannot post to them directly/,
    "the no-capability branch no longer says in words that it cannot post directly");
  assert.match(note, /posts nothing on your behalf/,
    "the direct branch does not say that Inte-Run still posts nothing itself");
});

test("BLOCKER: the destination marks are ours, inline, and each one is distinguishable", () => {
  // ⚠️ NO REMOTE ASSET AND NO THIRD-PARTY ARTWORK. The app ships with no external network assets at all,
  // so a fetched logo is not available; a logo file embedded as a data URI would be somebody else's
  // artwork redistributed inside our bundle. These are line drawings in the app's own vocabulary.
  const src = appScript();
  const at = src.indexOf("const SST_DGLYPH = {");
  assert.ok(at > 0, "SST_DGLYPH is not in the build");
  const body = src.slice(at, src.indexOf("\n};", at));
  const marks = [...body.matchAll(/^\s{2}([a-z]+):\s*'(<svg[\s\S]*?<\/svg>)',$/gm)]
    .map((m) => ({ name: m[1]!, svg: m[2]! }));
  assert.ok(marks.length >= 4, "SST_DGLYPH parsed as " + marks.length + " marks: this sweep sees nothing");
  const glyphs = new Set(destRecords().map((r) => r.glyph.replace("SST_DGLYPH.", "")));
  for (const g of glyphs) {
    assert.ok(marks.some((m) => m.name === g), "a tile names the mark " + g + ", which SST_DGLYPH does not have");
  }
  for (const m of marks) {
    assert.match(m.svg, /viewBox="0 0 24 24"/, m.name + " is not on the app's 24-unit grid");
    assert.match(m.svg, /stroke="currentColor"/, m.name + " does not take its colour from the tile");
    assert.ok(!/href|xlink|<image|url\(/i.test(m.svg), m.name + " references something outside the page");
    // ⚠️ NO BRAND COLOUR AND NO GRADIENT: a hex inside one of these is somebody's palette, not ours.
    assert.ok(!/#[0-9a-f]{3,8}|gradient|rgb\(/i.test(m.svg), m.name + " carries a colour of its own");
  }
  // ⚠️ AND THE TWO BUBBLES HAD TO BE MADE TO DIFFER. A chat glyph and a messages glyph are the same
  // shape, so the first cut of this row was two identical marks with only the label to tell them apart —
  // the row's whole job undone. Every mark's geometry must be distinct from every other's.
  const used = marks.filter((m) => glyphs.has(m.name));
  for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {
    const a = used[i]!.svg.replace(/\s+/g, ""), b = used[j]!.svg.replace(/\s+/g, "");
    assert.notEqual(a, b, used[i]!.name + " and " + used[j]!.name + " are the same drawing");
    const paths = (x: string) => (x.match(/<(path|rect|circle)/g) || []).length;
    assert.ok(paths(a) > 0 && paths(b) > 0, "a mark draws nothing at all");
  }
});

test("BLOCKER: the studio covers the global bottom navigation while editing", () => {
  // ⚠️ THE SPEC ASKS FOR THE GLOBAL NAV TO BE HIDDEN. It is not hidden by a class — the overlay simply
  // covers it — so what has to hold is that the overlay is full-bleed, opaque and above it, and that the
  // app behind is inert so the nav cannot be reached by touch or by tab either.
  const ov = rule(".sst-ov");
  assert.match(ov, /position: fixed/, "the studio is not fixed to the viewport");
  assert.match(ov, /inset: 0/, "the studio does not cover the whole viewport");
  assert.match(ov, /background: var\(--bg\)/, "the studio is translucent, so the nav shows through it");
  const ovZ = Number(/z-index: (\d+)/.exec(ov)?.[1]);
  const navZ = Number(/z-index: (\d+)/.exec(rule(".bottomnav"))?.[1]);
  assert.ok(Number.isFinite(ovZ) && Number.isFinite(navZ) && ovZ > navZ,
    "the studio (" + ovZ + ") does not paint above the bottom nav (" + navZ + ")");
  assert.match(lift("overlayModal"), /app\.inert/, "the nav behind the studio is still reachable");
});

test("BLOCKER: every control the studio renders reaches the 44px tap floor", () => {
  // ⚠️ DERIVED FROM THE MARKUP, NOT LISTED. A hand-written list goes stale the first time somebody adds
  // a row, and the failure mode is a control nobody can hit. Each class either sets its own --tap height
  // or inherits a box from a rule that does; the map below is the inheritance, and it is short because
  // anything not in it has to state its own.
  const inherits: Record<string, string> = {
    // The pair's geometry is on .act-pair > button; .ap-yes/.ap-no may set colour and nothing else.
    "ap-yes": ".act-pair > button", "ap-no": ".act-pair > button",
    // The switch reaches the floor by growing its hit area, not its box — see the rule below.
    "rm-switch": ".rm-switch::after",
    // .sst-wide overrides the arrow's fixed width and keeps its height.
    "sst-wide": ".sst-arrow",
    "mini-btn": ".mini-btn.wide-btn", "wide-btn": ".mini-btn.wide-btn",
    "ui-pill": ".sst-chip",
  };
  const src = nocomment(studioMarkup());
  const classed = [...src.matchAll(/<button class="([^"'+]+)"/g)].map((m) => m[1]!.trim());
  assert.ok(classed.length >= 8, "expected the studio's buttons, found " + classed.length);
  const missing: string[] = [];
  for (const attr of [...new Set(classed)]) {
    const ok = attr.split(/\s+/).some((c) => {
      const sels = [inherits[c] || null, "." + c].filter(Boolean) as string[];
      return sels.some((s) => {
        const at = css().indexOf("\n" + s + " {");
        return at > 0 && /var\(--tap\)/.test(css().slice(at, css().indexOf("}", at)));
      });
    });
    if (!ok) missing.push(attr);
  }
  assert.deepEqual(missing, [], "these studio buttons never reach a 44px box: " + missing.join(" | "));
  // The switch's expander is the reason "rm-switch" is in the map, and its arithmetic is asserted below.
  assert.match(rule(".sst-arrow"), /height: var\(--tap\)/, "the carousel arrows are not 44px tall");
  assert.match(rule(".sst-tool"), /min-height: var\(--tap\)/, "the tool row is not 44px tall");
  assert.match(rule(".sst-met"), /min-height: var\(--tap\)/, "a metric chip is not 44px tall");
  assert.match(rule(".sst-row"), /min-height: var\(--tap\)/, "a sheet row is not 44px tall");
  assert.match(rule(".sst-done"), /min-height: var\(--tap\)/, "a sheet's Done button is not 44px tall");
});

test("BLOCKER: a control that cannot be used is marked, not dimmed into illegibility", () => {
  // ⚠️ MEASURED FROM RENDERED PIXELS, WHICH IS THE ONLY WAY THIS COULD BE SEEN. Opacity on an ancestor
  // appears in no declared colour, so getComputedStyle reports the token and the eye reports something
  // else. Both of these carried the shared .sst-off dimming and came out: the ineligible style row's
  // REASON at 2.55:1 in dark and 2.13:1 in light, a disabled metric chip at 3.25:1 and 2.46:1. The reason
  // is the most important sentence in that row — it is the entire purpose of showing a style this run
  // cannot have — and a chip's label is the name of a number. After the fix: 5.72/5.18 and 5.72/5.18.
  const off = rule(".sst-off");
  assert.match(off, /opacity/, "the shared dimming no longer dims, so this guard is measuring nothing");
  // The two builders must not reach for it: their disabled state carries information a runner has to read.
  const style = nocomment(lift("studioStyleHtml")), mets = nocomment(lift("studioMetricsHtml"));
  assert.ok(!/sst-row sst-off/.test(style),
    "an ineligible style row is dimmed, so the sentence explaining it cannot be read");
  assert.ok(!/sst-met[^"]*sst-off/.test(mets) && !/" sst-off"/.test(mets),
    "a disabled metric chip is dimmed, so the name of the number cannot be read");
  // ⚠️ AND THE MARK IS NOT A COLOUR. A dashed edge says "not available" without touching the ink, which
  // also keeps this project's own rule that colour is never the only indicator.
  const dis = rule('.sst-row[aria-disabled="true"], .sst-met[aria-disabled="true"]');
  assert.match(dis, /border-style: dashed/, "a control that cannot be used has no non-colour marking");
  assert.ok(!/opacity/.test(dis), "the disabled treatment dims the text again");
  // The arrows are the one exception and they are the one thing with no words in them: a glyph with an
  // accessible name, exempt from the text floor, held above the 3:1 non-text floor in both themes.
  assert.match(rule(".sst-arrow[disabled]"), /opacity: \.55/,
    "the disabled arrow is dimmer than measured safe (at .4 it read 2.57:1 in light)");
});

test("BLOCKER: the preview is described in words, from the model, with nothing hidden leaking in", () => {
  // ⚠️ BUILT FROM THE MODEL, WHICH IS WHAT MAKES IT SAFE. Every privacy switch has already been applied by
  // the time these fields exist — dateLabel empty when the date is hidden, coarseLocation absent when the
  // place is, pill null on a pain-flagged run — so the spec's rule that hidden metadata may not appear in
  // an accessibility label is kept by construction. A label assembled from the RUN would leak all three.
  const s = nocomment(lift("shareAriaSummary"));
  for (const field of ["m.template", "m.aspect", "m.sessionLabel", "m.coarseLocation", "m.dateLabel",
                       "m.pill", "m.route"]) {
    assert.ok(s.includes(field), "the preview summary does not mention " + field);
  }
  const leaks = ["run.pain", "run.rpe", "\\brpe\\b", "run.place", "\\.lat", "\\.lng", "completedAt"];
  for (const bad of leaks) {
    assert.ok(!new RegExp(bad).test(s), "the preview summary reads a field privacy has not filtered: " + bad);
  }
  // ⚠️ THE THREE NUMBERS COME FROM stats, NOT metrics. stats is the canonical distance, time and average
  // pace; read from metrics, deselecting the clock would remove the run's duration from the description of
  // a card that still prints it.
  assert.match(s, /m\.stats/, "the summary describes the chosen numbers rather than the run's own facts");
  // And the stage carries it, refreshed from the same model the card is drawn from.
  assert.match(lift("shareStudioHtml"), /role="img" aria-label=/, "the preview is not exposed as an image");
  assert.match(lift("studioSync"), /setAttribute\("aria-label", shareAriaSummary\(m\)\)/,
    "the preview's description is never updated, so it describes the card it opened on");
});

test("BLOCKER: both outputs are offered, wired and announced, and each says what it is", () => {
  // ⚠️ THE SPEC NAMES THE CONTROL AND ITS OPTIONS: "Aspect control: STORY 9:16, FEED 4:5, optional
  // SQUARE 1:1". The optional third and the transparent sticker were both built and both withdrawn by the
  // owner on 2026-08-20 — "i only want the two options if story and feed" — so the row is back to the two
  // required formats, and this test asserts the exhaustive list rather than a minimum.
  // ⚠️ COMMENT-FREE, AND THAT IS THIS PROJECT'S OWN RECORDED TRAP FIRING AGAIN: the builder's note
  // explains WHY the two withdrawn shapes are not in the row, so it quotes both names, and the sweep
  // below reported the explanation as the defect.
  const html = nocomment(lift("shareStudioHtml"));
  const chips = [...html.matchAll(/data-sst-aspect="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chips, ["story", "feed"],
    "the output row offers " + chips.join(", ") + " rather than exactly Story and Feed");
  // ⚠️ AND EACH CHIP SAYS ITS RATIO. "Feed" alone does not tell a runner what they are about to export,
  // and the exported pixels are the one thing the whole control decides.
  for (const [aspect, label] of [["story", "9:16"], ["feed", "4:5"]] as [string, string][]) {
    const at = html.indexOf('data-sst-aspect="' + aspect + '"');
    assert.ok(at > 0, "no chip for " + aspect);
    assert.ok(html.slice(at, at + 120).includes(label),
      aspect + "'s chip does not state its ratio (" + label + ")");
  }
  // ⚠️ WIRED, NOT MERELY RENDERED. A chip that looks live and does nothing is the defect class this
  // project has shipped three times; the handler reads the attribute rather than naming the shapes.
  const click = nocomment(lift("studioClick"));
  assert.match(click, /\[data-sst-aspect\]/, "the shape chips are not reached by the delegated handler");
  assert.match(click, /SCARD\.aspect = /, "tapping a shape chip does not change the shape");
  // and the selected one is marked, in a way a screen reader can hear
  const sync = nocomment(lift("studioSync"));
  assert.match(sync, /data-sst-aspect.*aria-pressed|aria-pressed.*data-sst-aspect/s,
    "the selected shape is not announced");
  // ⚠️ THE SUMMARY NAMES THE SHAPE IN WORDS. Written as a bare "not feed means story" it announced a
  // third shape as a story — worse than saying nothing, because it is wrong about the one thing the
  // runner cannot see. There are two now, and both are named.
  const aria = nocomment(lift("shareAriaSummary"));
  for (const word of ["Story", "Feed"]) {
    assert.ok(aria.includes(word), "the preview summary never says " + word);
  }
  assert.match(aria, /nine by sixteen/, "the story is announced as a ratio a screen reader cannot read out");
  assert.match(aria, /four by five/, "the feed post is announced as a ratio a screen reader cannot read out");
  // ⚠️ AND NEITHER WITHDRAWN OUTPUT IS STILL NAMED ANYWHERE IN THE EDITOR. A label or a note left behind
  // is a sentence about something the runner cannot choose, which is worse than none.
  for (const word of ["Square", "Sticker", "square", "sticker"]) {
    assert.ok(!aria.includes(word), "the preview summary still describes " + word);
    assert.ok(!html.includes(word), "the editor's markup still names " + word);
  }
  // ⚠️ THE ROW CARRIES A SENTENCE PER OUTPUT, because a chip cannot carry the pixel size or the fact that
  // the feed post is recomposed rather than cropped. Both are stated, so the row cannot describe one.
  const note = liftConst("SHARE_ASPECT_NOTE");
  for (const a of ["story", "feed"]) {
    assert.ok(new RegExp(a + ":").test(note), "no note for " + a + " in the output row");
  }
  assert.ok(!/square|sticker/.test(note), "the output row still carries a note for a withdrawn shape");
  assert.match(sync, /\[data-sst-shape\]/, "the output note is never filled in");
  assert.match(sync, /SHARE_ASPECT_NOTE\[shareAspect\(SCARD\.aspect\)\]/,
    "the note is not resolved through the one aspect validator");
  // ⚠️ AND THE METRIC SHEET NO LONGER CLAIMS A SHAPE CARRIES FEWER NUMBERS. That sentence existed because
  // the square carried two by the contract's own instruction and the third was KEPT rather than dropped;
  // both remaining shapes carry all three, so a sentence about a cap would describe nothing.
  const mets = nocomment(lift("studioMetricsHtml"));
  assert.ok(!/shareMetricCap|SHARE_ASPECT_LABEL|rather than being dropped/.test(mets),
    "the metrics sheet still explains a per-shape cap that no shape has");
  assert.match(mets, /Up to ' \+ SHARE_METRIC_MAX/,
    "the sheet no longer states the one limit there is, which is the picker's own");
});

test("BLOCKER: rebuilding a sheet's rows puts focus back on the control that was used", () => {
  // ⚠️ EVERY ROW IS REBUILT FROM ITS BUILDER ON EVERY CHANGE, which is what stops one going stale — and it
  // also destroys the node the runner is standing on. A keyboard or switch-control user toggling a metric
  // chip was dropped onto BODY with the panel behind them inert.
  const rows = lift("studioSyncRows");
  assert.match(rows, /const back = studioFocusSig\(document\.activeElement\)/,
    "nothing remembers where focus was before the rows are rebuilt");
  assert.match(rows, /focus\(\{ preventScroll: true \}\)/, "focus is not restored after the rebuild");
  assert.match(rows, /!n\.disabled/, "focus is restored to a control the rebuild has just disabled");
  const sig = liftConst("SST_FOCUS_ATTRS");
  for (const a of ["data-sstmet", "data-ssttmpl", "data-sstpriv", "data-ssttool", "data-sst"]) {
    assert.ok(sig.includes(a), "focus cannot be found again on " + a);
  }
});

// ---- the tap floor -------------------------------------------------------------------------------

test("the switch component reaches the 44px tap floor by growing its hit area", () => {
  // ⚠️ THE HIT AREA GROWS, NOT THE BOX — the rule the Phase 4 accessibility pass used everywhere else.
  // .rm-switch is 46x28 and is used in nine places, so the shortfall was app-wide; the expander fixes
  // all nine without relaying out a single row.
  //
  // ⚠️ AND inset RESOLVES AGAINST THE PADDING BOX, so the border has to be subtracted. At -8px the hit
  // area measured 42px and quietly missed the floor it was added to reach. This asserts the ARITHMETIC
  // rather than the number, because the number is only correct for as long as the box and border are.
  const c = page();
  const box = /\.rm-switch \{[^}]*\}/.exec(c);
  assert.ok(box, "the switch component is gone");
  const h = Number(/height: (\d+)px/.exec(box![0])?.[1]);
  const bw = Number(/border: (\d+)px/.exec(box![0])?.[1] ?? 0);
  const after = /\.rm-switch::after \{[^}]*\}/.exec(c);
  assert.ok(after, "the switch has no hit-area expander, so it is a 28px target");
  const inset = Number(/inset: -(\d+)px/.exec(after![0])?.[1]);
  assert.ok(Number.isFinite(h) && Number.isFinite(inset), "could not read the switch geometry");
  const tap = h - 2 * bw + 2 * inset;
  assert.ok(tap >= 44, "the switch's hit area is " + tap + "px, under the 44px floor");
  // ⚠️ z-index IS WHAT MAKES IT WORK DOWNWARD: without it the next row in document order paints over
  // the lower half of the expander, and the bottom 8px of every switch stops answering.
  assert.match(c, /\.rm-switch \{ z-index: 1; \}/, "the expander is painted under the following row");
});

test("BLOCKER: nothing in the editor is a control over a card it cannot change", () => {
  // ⚠️ THE TWO PLACES THAT USED TO SAY "THIS SHAPE IGNORES YOUR PHOTOGRAPH" ARE GONE WITH THE SHAPES. The
  // transparency chequer explained an output with no background; the Photo tool's note explained that the
  // same output used none of the framing below it. Both were the right answer to a real problem — a
  // control that looks live over a card it cannot change is the defect class this project has shipped
  // three times — and the problem itself no longer exists: every shape carries a photograph, and since
  // the owner's ruling of 2026-08-20 so does every template.
  const src = nocomment(page());
  assert.ok(!/sst-alpha/.test(src),
    "the transparency chequer survives in the build, styling a preview state nothing can enter");
  const ph = nocomment(lift("studioPhotoHtml"));
  assert.ok(!/sticker|no background at all|Story, Feed and Square/.test(ph),
    "the Photo tool still tells the runner a shape ignores their photograph");
  // ⚠️ AND THE CONTROLS ARE LIVE IN BOTH OF ITS STATES. It returns early when no photograph has been
  // chosen, which is the state the tool is most often opened in.
  assert.match(ph, /if \(!SPHOTO\) \{\s*return '<button class="mini-btn wide-btn" data-sst="pick">/,
    "the no-photo branch no longer offers the one control it can");
  assert.match(ph, /data-sst="fit"/, "the Fill switch is gone from the Photo tool");
  assert.ok(!/disabled/.test(ph.split('data-sst="fit"')[0]!),
    "something above the Fill switch is disabled, which loses the framing it sets");
  // ⚠️ AND THE ROUTE SHEET'S OWN NOTE IS STILL THERE, because that one is still true: the poster draws its
  // route whatever the switch says, and a switch reading "off" over a card that plainly shows a route is
  // the app contradicting itself.
  const rt = nocomment(lift("studioRouteHtml"));
  assert.match(rt, /template === "route"/, "the route sheet no longer says the poster ignores the switch");
});

test("BLOCKER: a destination tile opens the app only when this BUILD can, and says which it is", () => {
  // The owner, 2026-08-21: "also I want the share to social media buttons to open in the actual apps".
  // Two of them can be — Instagram Stories through its own URL scheme with the card on the pasteboard,
  // and Messages through a real composer with the card attached. Nothing else has a sanctioned way to
  // receive an image, so those tiles open the share sheet where those apps genuinely appear.
  const src = page();
  const swift = readFileSync(new URL("../ios/InteRun/ShareAppService.swift", import.meta.url), "utf8");

  // ⚠️ THE CAPABILITY COMES FROM SWIFT AND MUST NEVER BE INFERRED FROM THE MESSAGE HANDLER EXISTING.
  // docs/index.html updates over the air and Swift does not, so a page asking an older build to open
  // Instagram has the action discarded by its default branch: a tile that looks live and does nothing,
  // on a phone whose app looks up to date. That hazard was caught minutes from shipping once already.
  assert.match(src, /window\.__interunShareApps/,
    "the page does not read the capability flag, so it cannot know what this build can open");
  const direct = lift("shareAppIsDirect") + lift("shareAppsDirect");
  assert.ok(!/messageHandlers\.interunShareApp/.test(direct),
    "the capability is being inferred from the handler existing, which an older build also has");
  assert.match(swift, /window\.__interunShareApps = /,
    "the native side no longer sets the flag the page reads");

  // ⚠️ ONE DISPATCH PLUS ONE CAPABILITY TEST, NEVER A BRANCH PER TILE. Four tiles each deciding for
  // themselves is four chances for one to be wired to something its own logo does not imply.
  const dest = lift("studioDest");
  assert.match(dest, /shareAppIsDirect\(id\)/, "studioDest no longer asks whether the route is direct");
  assert.match(dest, /doShareRun\(STUDIO\.run\)/, "there is no share-sheet fallback left");
  for (const d of ["instagram", "whatsapp", "messages", "more"]) {
    assert.ok(!new RegExp('=== "' + d + '"').test(dest),
      "studioDest has grown a branch for " + d + "; the point of one dispatch is that it cannot");
  }

  // ⚠️ A DECLINED HANDOFF FALLS BACK RATHER THAN DYING. Every reason to decline — no bridge, no rendered
  // card, an unreadable file, a refused open on the far side — has to end at the share sheet.
  const hand = lift("shareAppHandoff");
  assert.match(hand, /if \(!bridge\) return false/, "a build with no bridge does not decline the job");
  assert.match(hand, /if \(!file\) return false/, "an unrendered card does not decline the job");
  assert.match(hand, /rd\.onerror/, "a failed read leaves the tap dead");
  assert.match(src, /window\.__interunShareAppResult = function/, "Swift has nothing to answer to");
  const ack = src.slice(src.indexOf("window.__interunShareAppResult = function"),
    src.indexOf("function shareAppsDirect"));
  assert.match(ack, /doShareRun\(STUDIO\.run\)/,
    "a refused open reports a failure and stops, leaving the runner to find the sheet themselves");

  // ⚠️ AND THE LABELS AND THE NOTE ARE DERIVED FROM THE SAME LIST, so the row cannot promise a direct
  // post the build cannot make. The old note said "Inte-Run cannot post to them directly", which was
  // true of every build until this one — a sentence that overstates the app is the one a reader believes.
  const via = lift("shareAppVia");
  assert.match(via, /shareAppIsDirect\(id\)/, "the spoken route no longer depends on the capability");
  const note = lift("shareDestNote");
  assert.match(note, /shareAppsDirect\(\)/, "the note is typed rather than derived from what is possible");
  assert.ok(!/cannot post to them directly/.test(lift("studioDestHtml")),
    "the flat 'cannot post directly' sentence is back in the markup, where it cannot be conditional");
});

test("BLOCKER: the pasteboard handoff expires, and every declared scheme has a destination", () => {
  const swift = readFileSync(new URL("../ios/InteRun/ShareAppService.swift", import.meta.url), "utf8");
  // ⚠️ AN UNEXPIRING PASTEBOARD ITEM LEAVES A PICTURE OF SOMEBODY'S RUN IN THEIR SYSTEM CLIPBOARD, so
  // the next thing they paste anywhere is that card. Instagram's own documented window is five minutes.
  assert.match(swift, /expirationDate/,
    "the card is put on the pasteboard with no expiry, so it outlives the handoff");
  // ⚠️ AND THE OPEN IS REPORTED FROM ITS COMPLETION, NOT ASSUMED. A refused open would otherwise leave
  // the page believing the card was handed over.
  assert.match(swift, /UIApplication\.shared\.open\(url, options: \[:\]\) \{[^}]*ok in/,
    "the Instagram open does not report whether it actually happened");
  // ⚠️ BOTH MESSAGE CHECKS. A device can send a text and refuse an attachment, and a composer that
  // silently drops the picture is worse than a share sheet that keeps it.
  assert.match(swift, /canSendText\(\)/, "the Messages route does not check it can send at all");
  assert.match(swift, /canSendAttachments\(\)/,
    "the Messages route does not check it can attach, so the card can be dropped in silence");

  // ⚠️ EVERY SCHEME DECLARED IN Info.plist MUST BE ONE SOMETHING ASKS ABOUT. A declared query for an app
  // nothing offers is a declaration with no reader, which this codebase treats as a defect in itself —
  // fb-messenger-share-api was removed for exactly that.
  const plist = readFileSync(new URL("../ios/InteRun-Info.plist", import.meta.url), "utf8");
  const block = plist.slice(plist.indexOf("LSApplicationQueriesSchemes"));
  const schemes = [...block.slice(0, block.indexOf("</array>")).matchAll(/<string>([^<]+)<\/string>/g)]
    .map((m) => m[1]!);
  assert.ok(schemes.length > 0, "no schemes are declared at all");
  for (const sc of schemes) {
    assert.ok(swift.includes(sc) || src2Mentions(sc),
      "the scheme " + sc + " is declared but nothing asks about it: " + schemes.join(", "));
  }
  function src2Mentions(sc: string): boolean { return page().includes(sc); }
});
