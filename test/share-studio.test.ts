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
 * Every builder that renders a control into the studio — the primary screen AND the five tool sheets.
 * ⚠️ THIS LIST IS THE WHOLE POINT OF THE FIRST SWEEP, so it has to include the sheets. The controls
 * moved off the primary screen into sheets during Build 2; a list that still named only the panel would
 * have gone on passing while the Metrics, Style and destination controls went unwired.
 */
const STUDIO_BUILDERS = ["shareStudioHtml", "studioPhotoHtml", "studioRouteHtml", "studioPosHtml",
  "studioToolsHtml", "studioMetricsHtml", "studioStyleHtml", "studioDestHtml", "studioSheetHtml",
  "studioPrivHtml", "studioSwitch"];
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
  const actions = [...new Set([...src.matchAll(/data-sst="([a-z0-9]+)"/g)].map((m) => m[1]!))];
  assert.ok(actions.length >= 12, "expected the studio's actions, found " + actions.join(", "));
  const handler = nocomment(lift("studioClick"));
  const dead = actions.filter((a) => !new RegExp('=== "' + a + '"').test(handler));
  assert.deepEqual(dead, [], "these render in the studio and studioClick never names them: " + dead.join(", "));
  // ⚠️ AND EVERY OTHER ATTRIBUTE FAMILY TOO. The carousel, the tool row, the template list, the metric
  // chips, the aspect chips and the privacy switches are each addressed by their own attribute; a sweep
  // that only knew data-sst would have missed five whole families of control.
  const fams = [...new Set([...src.matchAll(/(data-sst(?:[a-z]*|-[a-z]+))="/g)].map((m) => m[1]!))]
    .filter((a) => /^data-sst(met|tmpl|tool|priv)$|^data-sst-aspect$/.test(a));
  assert.ok(fams.length >= 5, "expected the studio's attribute families, found " + fams.join(", "));
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
  const handler = lift("studioClick");
  assert.match(handler, /doShareRun\(STUDIO\.run\)/, "Share does not act on the studio's own run");
  assert.match(handler, /saveShareCard\(STUDIO\.run\)/, "Save does not act on the studio's own run");
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
  assert.match(h, /cardW \* gm\.H \/ gm\.W/, "the stage height is not the card's aspect");
  // ⚠️ AND THE SLIDE FOLLOWS THE CARD'S REAL WIDTH, NOT THE ALLOWANCE. On a short screen the height cap
  // binds first and the card comes out narrower than SST_SLIDE allowed; a slide left at the allowance
  // pushed the neighbour's CARD past the edge of the stage while its empty half sat in the gutter —
  // measured on 320x568, the card at 49% of the stage with no peek at all and half the stage empty, which
  // is the fault this design exists to remove reappearing on the smallest supported screen.
  assert.match(h, /STUDIO\.slideW = Math\.min\(cardW, h \* gm\.W \/ gm\.H\)/,
    "the slide is not narrowed to the card, so the peek disappears whenever the height cap binds");
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
  // ⚠️ THE DISPLAY SIZE COMES FROM THE SLIDE, NOT THE STAGE. The slide is the box the card lives in;
  // measuring the stage would size every card to the full width and the peek would disappear.
  assert.match(mount, /slide\.clientWidth/, "the card is sized from the stage, so the peek collapses");
  // ⚠️ AND THE SCALE IS READ BACK OFF THE CANVAS RATHER THAN PASSED IN, so a half-scale drawing can never
  // land in a third-scale buffer the day the selection moves.
  assert.match(lift("studioPaintSlide"), /const S = cv\.width \/ gm\.W/,
    "the paint takes a scale of its own instead of the one the canvas was actually sized at");
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
  assert.match(dest, /data-sst="share"/, "the system share sheet is not offered");
  assert.match(dest, /data-sst="save"/, "saving to the device is not offered");
  assert.match(dest, /stravaRunButtonHtml/, "Strava is not offered where the product allows it");
  assert.match(dest, /own share sheet/, "the sheet does not say where a runner's other apps are");
  // ⚠️ THE PRIMARY ACTION IS IN THE DISABLED SET TOO. It is the only way to the destinations now, so
  // leaving it live while the file is being built opens a sheet whose every row is dead — the
  // looks-live-does-nothing defect moved one tap further in rather than removed.
  assert.match(lift("studioBusy"), /\[data-sst="share"\], \[data-sst="save"\], \[data-sst="dest"\]/,
    "the primary action stays live while there is no file to share");
  assert.match(lift("studioBusy"), /Add a photo and your card is ready to share/,
    "a blocked export does not say why in words");
  // ⚠️ AND BOTH DESTINATIONS DISMISS THE SHEET FIRST. iOS raises its own sheet over ours: coming back to
  // a destination list still sitting over the card reads as the tap having failed.
  const h = lift("studioClick");
  assert.match(h, /if \(what === "share"\) \{ studioSheet\(null\); return doShareRun\(STUDIO\.run\); \}/,
    "sharing leaves the destination sheet up over the system sheet");
  assert.match(h, /if \(what === "save"\) \{ studioSheet\(null\); return saveShareCard\(STUDIO\.run\); \}/,
    "saving leaves the destination sheet up over a download that has already happened");
  // The scrim dismisses, and the exclusion is what stops a tap on a note closing the sheet.
  assert.match(nocomment(h), /closest\("\[data-sst-sheet\]"\) && !t\.closest\("\[data-sst-sheetin\]"\)/,
    "either the scrim does not dismiss, or a tap anywhere inside the sheet dismisses it");
});

// ---- the editor's chrome, and the nav behind it ---------------------------------------------------

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

test("BLOCKER: all three shapes are offered, wired and announced, and the square says what it drops", () => {
  // ⚠️ THE SPEC NAMES THE CONTROL AND ITS THREE OPTIONS: "Aspect control: STORY 9:16, FEED 4:5, optional
  // SQUARE 1:1". The square became non-optional for this app the moment the byte gate proved the required
  // two, which is the condition the contract attaches to it.
  const html = lift("shareStudioHtml");
  const chips = [...html.matchAll(/data-sst-aspect="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chips, ["story", "feed", "square"],
    "the shape row offers " + chips.join(", ") + " rather than all three");
  // ⚠️ AND EACH CHIP SAYS ITS RATIO. "Square" alone does not tell a runner what they are about to export,
  // and the exported pixels are the one thing the whole control decides.
  for (const [aspect, label] of [["story", "9:16"], ["feed", "4:5"], ["square", "1:1"]] as [string, string][]) {
    const at = html.indexOf('data-sst-aspect="' + aspect + '"');
    assert.ok(at > 0, "no chip for " + aspect);
    assert.ok(html.slice(at, at + 120).includes(label),
      aspect + "'s chip does not state its ratio (" + label + ")");
  }
  // ⚠️ WIRED, NOT MERELY RENDERED. A chip that looks live and does nothing is the defect class this
  // project has shipped three times; the handler reads the attribute rather than naming the shapes, so a
  // fourth could not arrive half-connected.
  const click = nocomment(lift("studioClick"));
  assert.match(click, /\[data-sst-aspect\]/, "the shape chips are not reached by the delegated handler");
  assert.match(click, /SCARD\.aspect = /, "tapping a shape chip does not change the shape");
  // and the selected one is marked, in a way a screen reader can hear
  const sync = nocomment(lift("studioSync"));
  assert.match(sync, /data-sst-aspect.*aria-pressed|aria-pressed.*data-sst-aspect/s,
    "the selected shape is not announced");
  // ⚠️ THE SUMMARY NAMES THE SHAPE IN WORDS, AND ALL THREE OF THEM. Written as a two-way ternary, a square
  // card announced itself as a story — which is worse than saying nothing, because it is wrong about the
  // one thing the runner cannot see.
  const aria = nocomment(lift("shareAriaSummary"));
  for (const word of ["Story", "Feed", "Square"]) {
    assert.ok(aria.includes(word), "the preview summary never says " + word);
  }
  assert.match(aria, /one by one/, "the square is announced as a ratio a screen reader cannot read out");
  // ⚠️ AND THE METRIC SHEET SAYS THE THIRD NUMBER IS KEPT RATHER THAN REFUSED. A chip that is on and does
  // not appear on the card is the same looks-live fault in the other direction, and the honest line is
  // that it comes back on the other two shapes.
  const mets = nocomment(lift("studioMetricsHtml"));
  assert.match(mets, /shareMetricCap\(SCARD\.aspect\)/,
    "the metrics sheet does not know a square carries fewer numbers");
  assert.match(mets, /square card carries/, "the sheet never explains the square's cap");
  assert.match(mets, /rather than being dropped/,
    "the sheet implies the third number is discarded, which it is not");
  // ⚠️ AND THE NOTE HAS TO BE REACHABLE, WHICH A TEXT SWEEP CANNOT SEE. Re-broken by changing the gate to
  // a literal false, this guard PASSED: the sentence was still in the source, sitting in a branch that
  // can never run. A source-text assertion proves a string exists, never that anything reaches it — the
  // same distinction as the id-exists-versus-control-is-wired rule this project has shipped twice. So the
  // GATE is asserted too, and it must be the computed flag rather than any constant.
  assert.match(mets, /\(capped \?/,
    "the square's note is not gated on the cap actually binding, so it either always shows or never does");
  assert.match(mets, /const capped = cap < SHARE_METRIC_MAX && chosen\.length > cap/,
    "the gate is not derived from the cap and what the runner chose, so it cannot be honest about either");
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
