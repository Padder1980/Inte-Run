import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE SHARE STUDIO'S WIRING, AND THE TWO FULL-SCREEN DIALOGS.
 *
 * Every guard here was watched failing against the build that shipped the studio, and every one of
 * them pins a control that RENDERED, looked live, and did nothing — the defect class this project has
 * now shipped three times (#saveSetup, rdMore, and the studio's own "Add a photo").
 *
 * ⚠️ THE INVARIANTS ARE MECHANISMS, NOT SPELLINGS. "Something reaches this button" is what matters,
 * so the sweeps DERIVE the set of controls from the markup the studio builders emit rather than
 * carrying a hand-written list — a list goes stale the first time somebody adds a row, and the failure
 * mode is silence.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

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

/** Every builder that renders a control into the studio panel. */
const STUDIO_BUILDERS = ["shareStudioHtml", "studioPhotoHtml", "studioRouteHtml"];
const studioMarkup = () => STUDIO_BUILDERS.map(lift).join("\n");

// ---- the controls are reachable at all ------------------------------------------------------------

test("BLOCKER: every control the studio renders is reached by its delegated handler", () => {
  // ⚠️ THIS IS THE GUARD FOR A DEAD PHOTO BUTTON. studioSync rebuilds the photo row, the route row
  // and the Strava row from their own builders on every change — and it runs once at open, straight
  // after the wiring — so handlers assigned to those buttons node by node were thrown away before the
  // runner could reach them. Measured on the shipped build: "Add a photo" had onclick null and tapping
  // it reached the file input ZERO times; "Show my route" left SCARD.routeOn null. The entire
  // photograph feature was unreachable through the interface while the two switches in the STATIC part
  // of the panel worked perfectly, which is exactly why it read as finished.
  const actions = [...new Set([...studioMarkup().matchAll(/data-sst="([a-z]+)"/g)].map((m) => m[1]!))];
  assert.ok(actions.length >= 6, "expected the studio's actions, found " + actions.join(", "));
  const handler = lift("studioClick");
  const dead = actions.filter((a) => !new RegExp('=== "' + a + '"').test(handler));
  assert.deepEqual(dead, [], "these render in the studio and studioClick never names them: " + dead.join(", "));
});

test("BLOCKER: the studio's clicks are delegated onto the node that outlives an open", () => {
  const open = lift("openShareStudio");
  // One listener, attached inside the create-once branch, so re-opening cannot stack a second copy.
  assert.match(open, /addEventListener\("click", studioClick\)/,
    "the delegated click listener is gone; per-node handlers cannot survive studioSync");
  const before = open.indexOf('addEventListener("click", studioClick)');
  const after = open.indexOf("ov.innerHTML = shareStudioHtml");
  assert.ok(before > 0 && before < after,
    "the listener must be attached to the overlay before its markup is written, and only once");
  // ⚠️ AND NOTHING MAY GO BACK TO PER-NODE HANDLERS. studioWire runs BEFORE studioSync at open, so a
  // handler it assigns to a rebuilt row is destroyed in the same tick.
  const wire = lift("studioWire");
  assert.ok(!/data-sst"\]\)\.forEach/.test(wire) && !/\.onclick = /.test(wire),
    "studioWire is assigning click handlers again; studioSync rebuilds those nodes");
});

test("BLOCKER: studioSync rebuilds exactly the rows whose builders it owns", () => {
  // The three rebuilt rows are the reason delegation is required; if one stops being rebuilt the
  // reason weakens, and if a fourth is added it needs the same treatment.
  const sync = lift("studioSync");
  for (const hook of ["data-sst-photo", "data-sst-route", "data-sst-strava"]) {
    assert.match(sync, new RegExp('querySelector\\("\\[' + hook + '\\]"\\)'),
      hook + " is no longer refreshed, so its state can go stale after a change");
  }
});

test("BLOCKER: the picker's file input is display:none, like every other one in the app", () => {
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

// ---- the two dialogs -----------------------------------------------------------------------------

test("both full-screen dialogs keep the promise aria-modal makes", () => {
  // ⚠️ TWO OVERLAYS, ONE SET OF RULES. Both are role="dialog" aria-modal="true" on document.body and
  // both measured the same way: activeElement still BODY, Escape doing nothing, 24 focusable controls
  // live behind them, .app not inert. So assistive tech was told to ignore everything outside a dialog
  // focus had never entered. Written twice these drift, and the second copy is the one nobody measures.
  const modal = lift("overlayModal");
  assert.match(modal, /app\.inert = !!on/, "the app behind the dialog is not made inert");
  assert.match(modal, /focus\(\{ preventScroll: true \}\)/, "focus is not moved without scrolling the panel");
  assert.match(modal, /ov\.modalReturn = was/,
    "the return node is not parked on the overlay, so two overlays would share one slot");

  for (const [open, close, first] of [
    ["openShareStudio", "closeShareStudio", '\\[data-sst="cancel"\\]'],
    ["openRunStory", "closeRunStory", "#storyX"],
  ] as const) {
    const o = lift(open), c = lift(close);
    assert.match(o, new RegExp("overlayModal\\(ov, true, \"?'?" + first),
      open + " does not move focus into the dialog");
    assert.match(o, /addEventListener\("keydown"/, open + " has no Escape handler");
    assert.match(o, new RegExp("key === \"Escape\"[\\s\\S]*?" + close + "\\(\\)"),
      open + "'s Escape does not close it");
    assert.match(c, /overlayModal\(ov, false/, close + " leaves the app inert and focus stranded");
    // ⚠️ RESTORE BEFORE THE MARKUP GOES, or focus is restored from a node already disconnected.
    const restore = c.indexOf("overlayModal(ov, false");
    const wipe = c.indexOf('innerHTML = ""');
    assert.ok(restore > 0 && wipe > restore,
      close + " clears its markup before restoring focus, which lands the runner on BODY");
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
  const css = page();
  const box = /\.rm-switch \{[^}]*\}/.exec(css);
  assert.ok(box, "the switch component is gone");
  const h = Number(/height: (\d+)px/.exec(box![0])?.[1]);
  const bw = Number(/border: (\d+)px/.exec(box![0])?.[1] ?? 0);
  const after = /\.rm-switch::after \{[^}]*\}/.exec(css);
  assert.ok(after, "the switch has no hit-area expander, so it is a 28px target");
  const inset = Number(/inset: -(\d+)px/.exec(after![0])?.[1]);
  assert.ok(Number.isFinite(h) && Number.isFinite(inset), "could not read the switch geometry");
  const tap = h - 2 * bw + 2 * inset;
  assert.ok(tap >= 44, "the switch's hit area is " + tap + "px, under the 44px floor");
  // ⚠️ z-index IS WHAT MAKES IT WORK DOWNWARD: without it the next row in document order paints over
  // the lower half of the expander, and the bottom 8px of every switch stops answering.
  assert.match(css, /\.rm-switch \{ z-index: 1; \}/, "the expander is painted under the following row");
});
