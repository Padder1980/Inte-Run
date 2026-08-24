import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE FIFTEEN-SECOND WINDOW GOES WHERE THE RUNNER PUTS IT.
 *
 * The owner, 2026-08-22: *"when trying to add a story that is a video, the tool doesn't allow me to
 * move to a different section of the video for the 15 second clip, it just keeps jumping back to the
 * start"*.
 *
 * ⚠️⚠️ TWO CAUSES, AND THE FIRST THREW AWAY EVERY TRIM HE MADE. `clubEdDraw` rebuilds the <video>
 * element on every redraw, and `wireClubEd`'s `onloadedmetadata` reset the window to the first fifteen
 * seconds — so a NEW element meant a NEW reset. Since the end of every handle drag called
 * `clubEdDraw`, the window moved under his finger (the strip is painted live) and snapped back to zero
 * the instant he let go.
 *
 * ⚠️ THE SECOND WAS A DRAG THAT COMPOUNDED. The move handler mutates `sl.inS`, so computing the new
 * position from the live value adds the displacement once per pointermove event — a dozen times in one
 * gesture. Measured in a real browser before the fix: a 70px nudge left, about 4.5 s, walked the
 * window from 9.23 s to 0 and pinned it there.
 *
 * ⚠️ THIS DRIVES THE REAL `wireClubTrim` AGAINST A FAKE STRIP, so what is asserted is where the window
 * ends up rather than what the source says. The faults above are both arithmetic and both invisible to
 * a source grep: one was a missing flag, the other a variable read one line too late.
 */

/** ⚠️ THE APP'S OWN FILTER TABLE, read out of the built page rather than retyped — a hand-copied table
 *  is a second source of truth, and this file already records the cost of typing one from memory. */
/** ⚠️ A CONST ARRAY READ OUT OF THE BUILT PAGE, never retyped — a hand-copied table is a second source
 *  of truth, and this file already records the cost of a harness supplying its own constants. */
function arrOf(src: string, name: string): string {
  const at = src.indexOf("const " + name + " = [");
  assert.ok(at > 0, name + " could not be found in the built page");
  let d = 0, i = src.indexOf("[", at);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "[") d++;
    else if (src[i] === "]") { d--; if (!d) return src.slice(from, i + 1); }
  }
  throw new Error(name + " is unbalanced");
}
function filtersOf(src: string): Array<{ id: string; label: string; css: string }> {
  const m = /const CLUB_FILTERS = \[([\s\S]*?)\];/.exec(src);
  assert.ok(m, "CLUB_FILTERS could not be found in the built page");
  const out: Array<{ id: string; label: string; css: string }> = [];
  for (const row of m![1]!.matchAll(/\{\s*id:\s*"(\w+)",\s*label:\s*"([^"]*)",\s*css:\s*"([^"]*)"/g)) {
    out.push({ id: row[1]!, label: row[2]!, css: row[3]! });
  }
  assert.ok(out.length >= 4, "only " + out.length + " filters parsed out of CLUB_FILTERS");
  return out;
}
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** Lift a function out of the built page, brace-matched. */
function fn(src: string, name: string): string {
  const at = src.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error(name + " is unbalanced");
}
const nocomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FILM_X = 24, FILM_W = 382;

type Slide = { isVid: boolean; dur: number; inS: number; outS: number; trimSet?: boolean };
type Harness = {
  slide: Slide;
  /** Press on one handle ("a" / "b") or the window ("w") at a time in seconds, drag to another. */
  drag: (which: "a" | "b" | "w", fromSec: number, toSec: number, steps?: number) => void;
  scrubs: number[];
  redraws: number;
};

/** The real trim wiring, over a fake strip whose geometry is known exactly. */
function harness(opts: { dur: number; kind?: string; inS?: number; outS?: number }): Harness {
  const src = page();
  const slide: Slide = {
    isVid: true, dur: opts.dur, trimSet: true,
    inS: opts.inS ?? 0,
    outS: opts.outS ?? Math.min(opts.dur, 15),
  };
  const scrubs: number[] = [];
  const box = { left: FILM_X, width: FILM_W };
  // ⚠️⚠️ THE DRAG TARGETS ARE DERIVED FROM THE REAL MARKUP, AND A HAND-WRITTEN SET ESCAPED ITS OWN
  // RE-BREAK. With ["a","b","w"] hardcoded, deleting data-ctrim="w" from .club-win left the harness
  // still offering a "w" node — so the window stopped being draggable in the app and every arithmetic
  // test carried on passing. A guard over a collection is only as good as the collection.
  const strip = new Function("sl", "cap", "maxIn", "clubClock", "CLUB_STRIP_N",
    nocomment(fn(src, "clubStripHtml")) + "\nreturn clubStripHtml(sl, cap, maxIn);",
  )(slide, opts.kind === "post" ? slide.dur : 15, 0, (t: number) => String(t), 8) as string;
  const keys = [...new Set([...strip.matchAll(/data-ctrim="(\w+)"/g)].map((m) => m[1]!))];
  assert.ok(keys.length >= 2, "the strip declares no drag targets at all: " + keys.join(","));
  const nodes: Record<string, any> = {};
  for (const k of keys) {
    nodes[k] = { dataset: { ctrim: k }, setPointerCapture() {}, setAttribute() {},
      onpointerdown: null, onpointermove: null, onpointerup: null, onpointercancel: null };
  }
  const film = {
    getBoundingClientRect: () => box,
    querySelectorAll: (sel: string) => (sel === "[data-ctrim]" ? Object.values(nodes) : []),
    querySelector: (sel: string) => {
      const m = /\[data-ctrim="(\w)"\]/.exec(sel);
      if (m) return nodes[m[1]!];
      return { style: {}, setAttribute() {} };
    },
  };
  let redraws = 0;
  const api = new Function(
    "CLUBED", "clubSlide", "$", "document", "CLUB_STORY_MAX_S", "clubTrimMin",
    "clubTrimPaint", "clubVidScrub", "clubVidLoop", "clubTrimAria", "clubEdDraw", "clubClock",
    nocomment(fn(src, "wireClubTrim")) + "\nreturn { wire: wireClubTrim };",
  )(
    { kind: opts.kind ?? "story" },
    () => slide,
    (id: string) => (id === "clubFilm" ? film : null),
    { querySelector: () => ({ textContent: "" }) },
    15,
    // The real minimum-span rule, lifted with the constant it reads — a hand-written copy in the test
    // would agree with itself and prove nothing about the shipped rule.
    new Function("dur",
      (/\nconst CLUB_TRIM_MIN_S = [^;]+;/.exec(src) || [""])[0] + "\n"
      + nocomment(fn(src, "clubTrimMin")) + "\nreturn clubTrimMin(dur);"),
    () => {},
    (t: number) => { scrubs.push(Math.round(t * 100) / 100); },
    () => {},
    () => {},
    () => { redraws++; },
    (t: number) => String(t),
  ) as { wire: () => void };
  api.wire();

  const xAt = (sec: number) => FILM_X + (sec / opts.dur) * FILM_W;
  return {
    slide, scrubs,
    get redraws() { return redraws; },
    drag(which, fromSec, toSec, steps = 12) {
      const h = nodes[which];
      assert.ok(h, "the strip declares no \"" + which + "\" drag target — the window must carry "
        + "data-ctrim so a finger in its middle moves the whole selection");
      assert.ok(h.onpointerdown, "wireClubTrim did not wire the " + which + " target");
      h.onpointerdown({ clientX: xAt(fromSec), pointerId: 1,
        preventDefault() {}, stopPropagation() {} });
      assert.ok(h.onpointermove, "no move handler after pressing " + which);
      for (let i = 1; i <= steps; i++) {
        h.onpointermove({ clientX: xAt(fromSec + (toSec - fromSec) * i / steps) });
      }
      h.onpointerup({});
    },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

test("BLOCKER: dragging the window moves the whole selection, and does not compound", () => {
  // ⚠️ THE FAULT THIS EXISTS FOR. The handler mutates sl.inS, so reading it back on each of the dozen
  // pointermove events in one gesture applies the displacement a dozen times over. Measured in a real
  // browser before the fix: 9.23 s → 0 for a nudge of 4.5 s.
  const h = harness({ dur: 24.36, inS: 9.23, outS: 24.23 });
  h.drag("w", 16.72, 12.26);                     // the browser's own measured gesture: 70px left
  assert.equal(round(h.slide.inS), 4.77, "the window did not land where the finger put it");
  assert.equal(round(h.slide.outS), 19.77);
  assert.equal(round(h.slide.outS - h.slide.inS), 15, "moving it changed its length");
});

test("BLOCKER: the same gesture in one step and in fifty steps lands in the same place", () => {
  // The compounding bug is invisible at one step and worst at many, so the discriminating claim is
  // that the answer does not depend on how many events the browser happened to deliver.
  const a = harness({ dur: 60, inS: 20, outS: 35 });
  const b = harness({ dur: 60, inS: 20, outS: 35 });
  a.drag("w", 30, 40, 1);
  b.drag("w", 30, 40, 50);
  assert.equal(round(a.slide.inS), round(b.slide.inS),
    "the landing place depends on the event count: " + a.slide.inS + " vs " + b.slide.inS);
  assert.equal(round(a.slide.inS), 30, "a ten-second push should move it ten seconds");
});

test("BLOCKER: the window slides to each edge and stops, keeping its length", () => {
  // ⚠️ CLAMPED AS A PAIR. Clamping the ends independently lets the window SHRINK against an edge, and
  // a selection that changes length when you move it is not a move.
  const lo = harness({ dur: 40, inS: 10, outS: 25 });
  lo.drag("w", 17.5, -30);
  assert.equal(round(lo.slide.inS), 0);
  assert.equal(round(lo.slide.outS), 15, "the window shrank against the start");
  const hi = harness({ dur: 40, inS: 10, outS: 25 });
  hi.drag("w", 17.5, 90);
  assert.equal(round(hi.slide.outS), 40);
  assert.equal(round(hi.slide.inS), 25, "the window shrank against the end");
});

test("BLOCKER: dragging an END past the cap slides the other end rather than growing the window", () => {
  // A fifteen-second story cap: pull the finish later and the start has to follow.
  const h = harness({ dur: 24.36, inS: 0, outS: 15 });
  h.drag("b", 15, 24.36);
  assert.equal(round(h.slide.outS), 24.36);
  assert.equal(round(h.slide.inS), 9.36, "the window grew past the cap instead of sliding");
  assert.ok(h.slide.outS - h.slide.inS <= 15.001, "the story cap was exceeded");
});

test("a feed post has no fifteen-second cap, so its end is free", () => {
  const h = harness({ dur: 40, kind: "post", inS: 0, outS: 40 });
  h.drag("a", 0, 10);
  assert.equal(round(h.slide.inS), 10);
  assert.equal(round(h.slide.outS), 40, "a post's window was capped like a story's");
});

test("BLOCKER: neither end can cross the other", () => {
  const h = harness({ dur: 40, inS: 5, outS: 20 });
  h.drag("a", 5, 39);
  assert.ok(h.slide.inS < h.slide.outS, "the start passed the finish: " + JSON.stringify(h.slide));
  const g = harness({ dur: 40, inS: 5, outS: 20 });
  g.drag("b", 20, 0);
  assert.ok(g.slide.outS > g.slide.inS, "the finish passed the start: " + JSON.stringify(g.slide));
});

test("BLOCKER: the preview follows the end being dragged, so the section can be SEEN", () => {
  // "Move to a different section" is a thing you do by looking. Without this the runner picks a
  // window blind and finds out what is in it afterwards.
  const b = harness({ dur: 40, inS: 0, outS: 15 });
  b.drag("b", 15, 30);
  assert.ok(b.scrubs.length > 0, "nothing scrubbed the preview at all");
  assert.equal(b.scrubs[b.scrubs.length - 1], round(b.slide.outS),
    "dragging the FINISH must show the finish");
  const a = harness({ dur: 40, inS: 0, outS: 15 });
  a.drag("a", 0, 5);
  assert.equal(a.scrubs[a.scrubs.length - 1], round(a.slide.inS),
    "dragging the START must show the start");
  const w = harness({ dur: 40, inS: 10, outS: 25 });
  w.drag("w", 17.5, 22);
  assert.equal(w.scrubs[w.scrubs.length - 1], round(w.slide.inS),
    "moving the window must show where it now begins");
});

test("BLOCKER: the end of a drag does NOT redraw the editor", () => {
  // ⚠️ THIS IS THE OTHER HALF OF THE REPORTED FAULT. A full redraw rebuilds the <video>, which fires
  // loadedmetadata again — and that is what got to reset the window. Nothing needs redrawing: the
  // strip is painted live throughout.
  const h = harness({ dur: 40, inS: 0, outS: 15 });
  h.drag("b", 15, 30);
  assert.equal(h.redraws, 0,
    "a trim drag redrew the editor, which rebuilds the video and re-runs its metadata handler");
});

test("BLOCKER: the window is initialised ONCE, whatever the video element does", () => {
  // ⚠️ A FLAG, NOT A TEST OF WHETHER inS IS ZERO. A window a runner deliberately left starting at zero
  // reads zero, and re-initialising it would silently drag its END back out to the cap — undoing a
  // shortened clip rather than a moved one.
  const body = nocomment(fn(page(), "wireClubEd"));
  const meta = /onloadedmetadata = \(\) => \{[\s\S]*?\n    \};/.exec(body);
  assert.ok(meta, "the metadata handler is no longer recognisable");
  assert.match(meta![0], /if \(!sl\.trimSet\) \{[\s\S]*?sl\.inS = 0/,
    "the window is reset on every metadata event, so every redraw throws the runner's trim away");
  // And the flag is only ever set there — a second writer is a second chance to reset.
  const whole = nocomment(page());
  const sets = [...whole.matchAll(/\.trimSet = /g)].length;
  assert.equal(sets, 1, "trimSet is written in " + sets + " places; one is the whole point");
});

test("BLOCKER: every drag target on the strip has an accessible name and a role", () => {
  // ⚠️ DERIVED FROM THE MARKUP, not a list of three. Three sliders with no names is three controls a
  // screen-reader user cannot tell apart, and the window is the one that was added last — so it is the
  // one a hand-written list would miss.
  const src = page();
  const strip = new Function("sl", "cap", "maxIn", "clubClock", "CLUB_STRIP_N",
    nocomment(fn(src, "clubStripHtml")) + "\nreturn clubStripHtml(sl, cap, maxIn);",
  )({ isVid: true, dur: 40, inS: 5, outS: 20, thumbs: null }, 15, 0,
    (t: number) => String(t), 8) as string;
  const tags = [...strip.matchAll(/<span[^>]*data-ctrim="(\w+)"[^>]*>/g)];
  assert.ok(tags.length >= 3,
    "expected a start handle, a finish handle and the window: found " + tags.length);
  for (const t of tags) {
    assert.match(t[0], /aria-label="[^"]+"/, "a drag target with no name: " + t[0]);
    assert.match(t[0], /role="slider"/, "a drag target that is not a slider: " + t[0]);
    assert.match(t[0], /aria-valuetext="[^"]+"/, "a slider with no value: " + t[0]);
  }
});

test("the strip is painted in place, never rebuilt under the finger", () => {
  // A full redraw mid-drag replaces the handle the finger is holding, which drops the pointer capture
  // and the gesture dies. clubTrimPaint writes styles on the nodes that are already there.
  const paint = nocomment(fn(page(), "clubTrimPaint"));
  assert.doesNotMatch(paint, /innerHTML|outerHTML/, "the paint rebuilds markup instead of styling it");
  assert.match(paint, /\.style\.(left|width)/, "nothing is actually moved");
});

test("BLOCKER: the handles' hit areas grow OUTWARD, so the window keeps an interior to grab", () => {
  // ⚠️ SYMMETRICAL WAS WRONG THE MOMENT THE WINDOW BECAME DRAGGABLE: at 15px each side the two zones
  // met in the middle of a short selection and left nothing to move — and a short selection is exactly
  // the one a handle cannot move, because dragging an end only slides the window once it is already at
  // the cap.
  const css = page();
  const a = /\.club-h-a::after \{([^}]*)\}/.exec(css);
  const b = /\.club-h-b::after \{([^}]*)\}/.exec(css);
  assert.ok(a && b, "the handle hit areas are no longer declared per side");
  assert.match(a![1]!, /left: -30px/, "the start handle must reach outward");
  assert.match(a![1]!, /right: 0/, "the start handle must not reach into the window");
  assert.match(b![1]!, /right: -30px/, "the finish handle must reach outward");
  assert.match(b![1]!, /left: 0/, "the finish handle must not reach into the window");
  // 14px of handle plus 30px of reach is the 44px this app insists on everywhere else.
  assert.match(css, /\.club-h \{[^}]*width: 14px/, "the handle is no longer 14px, so 30 is the wrong reach");
});

/* ------------------------------------------------------------------------------------------------
 * THE STORY AND POST VIEWER ACTUALLY RENDERS.
 *
 * The owner, 2026-08-22, with a screenshot of a black screen: *"when i've saved a video to my story and
 * try to play it, this is what shows"*. No progress bars, no ✕, no video — nothing but the app's own
 * dark, which is what an appended overlay looks like when the code that fills it never runs.
 *
 * ⚠️⚠️ IT WAS A TEMPORAL DEAD ZONE. `clubOpenMedia`'s `texts` line read `first.texts` one line ABOVE
 * `const first = clubSlides(p)[0]`, and a `const` read before its own declaration throws
 * `ReferenceError` every single time. So the function appended the overlay to the body and then died
 * before assigning any content to it — on every uploaded story.
 * ⚠️ POSTED TILES WERE NOT AFFECTED. `openClubPost` renders its own screen, so `clubOpenMedia` has
 * exactly ONE caller. Worth naming, because a report of "the viewer is broken" that does not say which
 * viewer sends the next reader down the wrong path.
 *
 * ⚠️ NOTHING COULD SEE IT, AND THAT IS WHY THIS TEST EXECUTES RATHER THAN READS. A dead zone is legal
 * syntax, so `node --check` passes and the build passes; the app block's duplicate-declaration sweep
 * cannot see it either. A STATIC sweep for the pattern was written and MEASURED: over the whole app
 * script it produced 57 candidates for this one real fault, because a function defined above a `const`
 * it captures is both extremely common and perfectly legal. A guard that reports 56 false positives is
 * one people stop reading — so the guard is to run the thing.
 *
 * ⚠️ THIRD FIRING OF THIS TRAP HERE (`JOURNAL_KEY` threw at every boot inside a silent try/catch;
 * `SHARE_LADDER` read `SHARE_EVEN_SPREAD_S`), and the first to reach a runner's screen.
 * ---------------------------------------------------------------------------------------------- */

/** Run the real clubOpenMedia against a fake DOM and hand back what it drew. */
function openMedia(row: Record<string, unknown>, auto: boolean) {
  const src = page();
  const made: { html: string }[] = [];
  const overlay = {
    _html: "",
    set innerHTML(v: string) { this._html = v; made.push({ html: v }); },
    get innerHTML() { return this._html; },
    querySelector: () => null,
    // The viewer now wires its tap zones and its ⋮ menu items off the overlay itself.
    querySelectorAll: () => [],
    remove() {},
    classList: { add() {}, remove() {} },
  };
  const api = new Function(
    "el", "document", "clubViewClose", "clubSlides", "clubKeys", "esc", "clubFillMedia",
    "clubDelete", "render", "toast", "haptic", "$", "setTimeout", "clearTimeout",
    // ⚠️ clubPostMenuHtml, clubMenu AND clubPostAction ARE THE ⋮ MENU the owner asked for (2026-08-22):
    // "Remove the next and delete buttons, the option to delete should come from opening a 3 little dot
    // menu". Stubbed here because this file is about whether the viewer DRAWS; the menu's own contents
    // are asserted in test/community.test.ts.
    "clubPostMenuHtml", "clubMenu", "clubPostAction", "CLUB_MENU_ON",
    "CLUB_VIEW_T", "COMM_STORY_MS", "CLUB_STORY_MAX_S",
    // ⚠️ THE LOOK IS LIFTED FOR REAL RATHER THAN STUBBED, so this file can see a filter, a vignette and
    // an overlay actually reach the viewer's markup. A stub returning "" would let the viewer stop
    // carrying them and every assertion here would still pass.
    // ⚠️ THE QUANTUM IS READ OUT OF THE PAGE, not typed — a constant supplied by the harness means the
    // lifted function runs against the TEST's value, and this project has measured that escaping a guard.
    "const CLUB_TONE_STEP = " + (/const CLUB_TONE_STEP = (\d+);/.exec(src) || [])[1] + ";\n" +
    nocomment(fn(src, "clubFilterCss")) + "\n" +
    nocomment(fn(src, "clubToneQ")) + "\n" +
    nocomment(fn(src, "clubLook")) + "\n" +
    nocomment(fn(src, "clubLookAttrs")) + "\n" +
    // ⚠️ THE WORD BUILDER IS LIFTED FOR REAL, so this file can see a caption's style, colour, plate and
    // rotation actually reach the viewer's markup. Its two tables are read OUT OF THE PAGE rather than
    // typed here — a constant supplied by the harness means the lifted function runs against the TEST's
    // value, which this project has measured escaping a guard.
    "const CLUB_TX_STYLES = " + arrOf(src, "CLUB_TX_STYLES") + ";\n" +
    "const CLUB_TX_ALIGN = " + arrOf(src, "CLUB_TX_ALIGN") + ";\n" +
    nocomment(fn(src, "clubTxStyle")) + "\n" +
    nocomment(fn(src, "clubTxInk")) + "\n" +
    nocomment(fn(src, "clubTxCss")) + "\n" +
    nocomment(fn(src, "clubTextSpan")) + "\n" +
    "const CLUB_FILTERS = " + JSON.stringify(filtersOf(src)) + ";\n" +
    nocomment(fn(src, "clubOpenMedia")) + "\nreturn clubOpenMedia;",
  )(
    () => overlay,
    { body: { appendChild() {} } },
    () => {},
    // The real readers, lifted TOGETHER — clubKeys calls clubSlides, so lifting them into separate
    // scopes gives the second one a ReferenceError of its own and the test fails for its own reason
    // rather than the code's.
    new Function("p", nocomment(fn(src, "clubSlides")) + "\n"
      + nocomment(fn(src, "clubKeys")) + "\nreturn clubSlides(p);"),
    new Function("p", nocomment(fn(src, "clubSlides")) + "\n"
      + nocomment(fn(src, "clubKeys")) + "\nreturn clubKeys(p);"),
    (s: unknown) => String(s == null ? "" : s),
    () => {}, () => {}, () => {}, () => {}, () => {},
    () => null,
    () => 0, () => {},
    () => "<button data-cact=\"delete\">Delete</button>", () => {}, () => {}, false,
    0, 4500, 15,
  ) as (rows: unknown[], i: number, auto: boolean) => void;
  api([row], 0, auto);
  return made.map((m) => m.html);
}

/** A story row in the shape the store actually holds, carousel-era fields and all. */
const VIDEO_STORY = {
  id: "s1", kind: "story", video: true, caption: "Evening one",
  media: ["blob-key-1"],
  // ⚠️ THE FIELD IS `media`, NOT `key` — clubKeys reads x.media, and a fixture using the wrong name
  // renders an empty slot and reports the viewer as broken when it is the fixture.
  slides: [{ media: "blob-key-1", isVid: true, crop: { ox: 0.4, oy: 0.6, k: 1.2 },
    trim: { inS: 4.75, outS: 19.75 },
    texts: [{ x: 0.5, y: 0.3, colour: "#fff", font: "system-ui", size: 28, text: "Sunset" }] }],
};

test("BLOCKER: opening a video story renders something — it does not throw", () => {
  // ⚠️ THE WHOLE POINT: a dead zone in here appended a full-screen overlay and then died before
  // filling it, so the runner met a black screen with no controls on it at all.
  const drawn = openMedia(VIDEO_STORY, true);
  assert.equal(drawn.length, 1, "the viewer drew nothing at all");
  assert.ok(drawn[0]!.length > 200, "the viewer drew almost nothing: " + drawn[0]);
});

test("BLOCKER: and what it renders is the video, its trim, its crop and its text", () => {
  const html = openMedia(VIDEO_STORY, true)[0]!;
  assert.match(html, /data-cvid="1"/, "the media slot is not marked as a video, so no <video> is made");
  assert.match(html, /data-cmed="blob-key-1"/, "the media slot names no blob, so nothing can fill it");
  // ⚠️ THROUGH clubSlides: a carousel row keeps its crop and text per slide, so reading them off the
  // row itself silently loses the framing on anything posted as a carousel.
  assert.match(html, /scale\(1\.2\)/, "the slide's own zoom was lost");
  assert.match(html, /transform-origin:40% 60%/, "the slide's own framing was lost");
  assert.match(html, /class="club-tx"/, "the words typed on the story were lost");
  assert.match(html, /Sunset/, "the text content was lost");
  // The chrome the screenshot was missing.
  assert.match(html, /id="clubVX"/, "no way out of the viewer");
  assert.match(html, /Evening one/, "the caption was lost");
});

test("BLOCKER: a photo story renders too, and asks for no video", () => {
  const photo = { id: "s2", kind: "story", caption: "",
    media: ["k2"], slides: [{ media: "k2", isVid: false }] };
  const html = openMedia(photo, true)[0]!;
  assert.match(html, /data-cvid=""/, "a photo story asked for a video element");
  assert.match(html, /data-cmed="k2"/);
});

test("BLOCKER: a row stored BEFORE carousels still opens", () => {
  // ⚠️ clubSlides is the one reader that understands both shapes. Posts written hours before carousels
  // existed carry a single key with their crop, trim and texts on the ROW — and those are exactly the
  // stories a runner already has on their phone.
  const old = { id: "s3", kind: "story", video: true, caption: "Older",
    media: "k3", crop: { ox: 0.5, oy: 0.5, k: 1 }, trim: { inS: 0, outS: 12 },
    texts: [{ x: 0.5, y: 0.5, colour: "#fff", font: "system-ui", size: 24, text: "Then" }] };
  const html = openMedia(old, true)[0]!;
  assert.match(html, /data-cmed="k3"/, "an older row's media key was lost");
  assert.match(html, /Then/, "an older row's text was lost");
});

/**
 * HIS SIX SCREENSHOTS OF 2026-08-24 — the playhead, the clutter, the live preview and the black flash.
 *
 * ⚠️ requestAnimationFrame FIRES ZERO TIMES IN THE HEADLESS CHROME THIS REPO TESTS IN. Measured: 0
 * frames in 1.2 s while setInterval managed 25 in 0.4 s. So the playhead's MOTION cannot be driven in a
 * browser here at all, which is why its arithmetic was split into clubPhFrac — a function can be run
 * where a loop cannot, and the containment is geometry that a browser CAN measure.
 */
test("BLOCKER: the playhead is mapped over the selection, clamped, and safe on a zero span", () => {
  const src = page();
  const frac = new Function("t", "inS", "outS",
    nocomment(fn(src, "clubPhFrac")) + "\nreturn clubPhFrac(t, inS, outS);",
  ) as (t: number, a: number, b: number) => number;
  // The window is 0..1 of the SELECTION, not of the clip — the marker lives inside the window now.
  assert.equal(frac(0, 0, 15), 0, "the first chosen frame is not 0");
  assert.equal(frac(7.5, 0, 15), 0.5, "the middle of the window is not 0.5");
  assert.equal(frac(15, 0, 15), 1, "the last chosen frame is not 1");
  // ⚠️ THE DISCRIMINATING CASE IS A WINDOW THAT DOES NOT START AT ZERO. Mapped over the CLIP instead,
  // a 4..19 window would put its own start at 4/19 = 0.21 rather than at 0 — which is the defect.
  assert.equal(frac(4, 4, 19), 0, "a window starting at 4s does not start its marker at 0");
  assert.equal(frac(11.5, 4, 19), 0.5, "the middle of a 4..19 window is not 0.5");
  assert.equal(frac(19, 4, 19), 1, "the end of a 4..19 window is not 1");
  // Clamped as well as hidden: a frame can land between the clamp and the class.
  assert.equal(frac(0, 4, 19), 0, "a time before the window is not clamped");
  assert.equal(frac(99, 4, 19), 1, "a time after the window is not clamped");
  // A zero-length window has no inside; dividing by it would be Infinity or NaN as a percentage.
  assert.equal(frac(5, 5, 5), 0, "a zero-length window did not answer 0");
  assert.ok(Number.isFinite(frac(5, 5, 5)), "a zero-length window produced a non-finite fraction");
});

test("BLOCKER: the playhead sits inside the window and its travel is inset by its own width", () => {
  const src = page();
  const strip = nocomment(fn(src, "clubStripHtml"));
  const ph = strip.indexOf('id="clubPh"');
  const win = strip.indexOf('class="club-win"');
  const ha = strip.indexOf('data-ctrim="a"');
  assert.ok(ph > 0 && win > 0 && ha > 0, "the strip no longer builds a playhead, a window and a handle");
  // ⚠️⚠️ A CHILD, NOT A SIBLING, and that is the fix for "the playhead going past the wall of the
  // slider": a child is positioned against the padding box, which the 14px border has already inset, so
  // it physically cannot reach the white ends. As a sibling it was a fraction of the WHOLE strip.
  assert.ok(ph > win, "the playhead is emitted before the window, so it is not inside it");
  assert.ok(ph < ha, "the playhead is not inside the window — the start handle comes first");
  // ⚠️ AND INSIDE IS NOT ENOUGH ON ITS OWN. Centred on its position (the old margin-left: -1.5px) HALF
  // of a 3px marker still sat over each wall — measured 1.5px at both ends. The travel is inset by the
  // marker's own width instead, so at 0 its left edge is the wall's inner face and at 1 its right edge
  // is, and it touches them without crossing.
  const css = src.slice(src.indexOf("<style>"), src.indexOf("</style>"));
  const rule = /\.club-ph \{([^}]*)\}/.exec(css);
  assert.ok(rule, "there is no .club-ph rule at all");
  assert.doesNotMatch(rule![1]!, /margin-left/,
    "the playhead is centred on its position again, so half of it sits over the white wall");
  const loop = nocomment(fn(src, "clubPlayhead"));
  assert.match(loop, /calc\(/,
    "the playhead's left is a bare percentage again, so its travel is not inset by its own width");
  assert.match(loop, /100% - 3px/,
    "the inset is not the marker's own width, so it will overhang one wall or fall short of the other");
  // The width in the CSS and the inset in the arithmetic are one measurement, and two owners drift.
  const w = /width:\s*(\d+)px/.exec(rule![1]!);
  assert.ok(w, ".club-ph declares no width, so the inset cannot be checked against it");
  assert.match(loop, new RegExp("100% - " + w![1]! + "px"),
    "the inset (" + /100% - (\d+)px/.exec(loop)![1] + "px) is not the marker's declared width (" + w![1] + "px)");
});

test("BLOCKER: a redraw adopts the media element instead of rebuilding it", () => {
  const src = page();
  const draw = nocomment(fn(src, "clubEdDraw"));
  // ⚠️⚠️ THE BLACK FLASH. Writing a fresh <video src> into innerHTML starts a new load, and a loading
  // video paints black for a frame — reported as "the screen flashed black once you take your finger
  // off". Every redraw did it, so any tap or drag that redrew flashed.
  assert.match(draw, /clubEdKeepMedia\(/,
    "clubEdDraw no longer adopts the existing media element, so every redraw reloads the video");
  const keep = nocomment(fn(src, "clubEdKeepMedia"));
  // Only when the source AND the kind both match — reusing across sources shows the wrong picture.
  assert.match(keep, /tagName !== want/, "the keeper does not check the element's kind");
  assert.match(keep, /getAttribute\("src"\) !== sl\.url/, "the keeper does not check the source");
  // ⚠️ DETACHED BEFORE innerHTML WIPES IT. innerHTML destroys whatever was there, so the node has to be
  // taken out first and put back after; detached, a <video> keeps playing and keeps its currentTime.
  assert.match(keep, /\.remove\(\)/, "the keeper does not detach the node, so innerHTML destroys it");
  assert.ok(draw.indexOf("appendChild(keepMed)") > draw.indexOf("innerHTML"),
    "the adopted node is put back before innerHTML runs, which destroys it");
  // ⚠️⚠️ A REUSED VIDEO NEVER FIRES loadedmetadata AGAIN, so everything wireClubEd hangs off that event
  // has to be driven by hand — without it the reuse trades a visible flash for an invisible dead trim.
  // ⚠️ THE GATE, NOT THE MENTION. Its first version sliced below wireClubEd and looked for the two
  // calls — so wrapping the block in `if (false && ...)` left both strings exactly where they were and
  // the guard passed while a reused video silently lost its strip and its playhead. Watched escaping.
  const tail = draw.slice(draw.indexOf("wireClubEd()"));
  const gate = /if \(([^)]*)\) \{/.exec(tail);
  assert.ok(gate, "there is no gate below wireClubEd at all, so a reused video restarts nothing");
  assert.match(gate![1]!.trim(), /^keepMed && sl\.isVid && sl\.dur$/,
    "the gate is '" + gate![1]!.trim() + "' — it must fire exactly when a video was reused");
  const body = tail.slice(tail.indexOf(gate![0]!), tail.indexOf("\n  }", tail.indexOf(gate![0]!)));
  assert.match(body, /clubTrimHtml\(S\)/, "a reused video never rebuilds the trim, so the strip dies");
  assert.match(body, /clubPlayhead\(sl\)/, "a reused video never restarts the playhead");
  // The kept node must not outlive its own blob URL.
  assert.match(nocomment(fn(src, "clubEdClose")), /CLUBED_MED = null/,
    "the kept media node is not cleared on close, so the next editor adopts a revoked blob URL");
});

test("BLOCKER: a finished drag paints in place and never redraws the stage", () => {
  const src = page();
  const up = nocomment(fn(src, "clubTxUp"));
  assert.doesNotMatch(up, /clubEdDraw\(/,
    "the end of a drag redraws again, which rebuilds the video and flashes black");
  assert.match(up, /clubSelPaint\(/, "the end of a drag no longer puts the selected word's bin up");
  const move = nocomment(fn(src, "clubTxMove"));
  assert.doesNotMatch(move, /clubEdDraw\(/,
    "a moving finger redraws the stage, which drops the pointer capture mid-gesture");
  assert.match(move, /clubTxPaint\(/, "the move no longer paints the node in place");
  // ⚠️ THE BIN IS PUT UP WITHOUT REBUILDING ANYTHING, which is the only reason no redraw is needed.
  const sel = nocomment(fn(src, "clubSelPaint"));
  assert.doesNotMatch(sel, /clubEdDraw\(|innerHTML/,
    "clubSelPaint redraws or rewrites innerHTML, so it flashes exactly as a redraw would");
  assert.match(sel, /clubRailHtml\(/, "clubSelPaint writes its own rail markup instead of asking the builder");
  // ONE builder for the rail, or the redraw path and the drag path drift.
  assert.match(nocomment(fn(src, "clubEdDraw")), /clubRailHtml\(/,
    "clubEdDraw writes its own rail markup, so two paths own one control");
});

test("BLOCKER: the baseline is re-taken whenever the number of fingers changes", () => {
  const src = page();
  const anchor = nocomment(fn(src, "clubTxAnchor"));
  const drag = nocomment(fn(src, "clubTextDrag"));
  const move = nocomment(fn(src, "clubTxMove"));
  const up = nocomment(fn(src, "clubTxUp"));
  // ⚠️⚠️ EVERY CHANGE OF FINGER COUNT RE-ANCHORS. The first version read ev.clientX for the whole
  // gesture, so a second finger landing moved the word by however far the first had already dragged, and
  // lifting one finger moved it back — "the pinching and moving is a bit jittery still....its not smooth".
  for (const [name, body] of [["the start of a gesture", drag], ["a finger lifting", up]] as const) {
    assert.match(body, /clubTxAnchor\(\)/, name + " does not re-take the baseline");
  }
  assert.match(up, /pts\.size >= 1.*clubTxAnchor/s,
    "lifting one finger of a pinch does not re-anchor on the fingers still down, so the word jumps");
  // The move must read the ANCHOR, never the original event.
  assert.doesNotMatch(move, /ev\.client/,
    "the move measures from the original pointerdown again, which is the compounding jump");
  assert.match(move, /anchor\.mid/, "the move no longer measures from the current baseline");
  // The anchor snapshots the word's own position, or the displacement is applied to a moving target.
  for (const f of ["x:", "y:", "size:", "rot:"]) {
    assert.ok(anchor.includes(f), "the baseline does not capture " + f + ", so that value compounds");
  }
});

test("BLOCKER: a second finger joins the live gesture and onpointerdown is never stolen", () => {
  const src = page();
  const drag = nocomment(fn(src, "clubTextDrag"));
  const up = nocomment(fn(src, "clubTxUp"));
  // ⚠️⚠️ THE FIRST VERSION OVERWROTE node.onpointerdown WITH ITS OWN HANDLER AND NULLED IT ON RELEASE,
  // which destroyed the binding wireClubEd had put there — so after one drag the word could not be
  // dragged or tapped again until something redrew. Invisible for as long as a finished drag redrew;
  // taking the redraw away is what exposed it. Measured in a browser: a tap after a drag did nothing.
  for (const [name, body] of [["clubTextDrag", drag], ["clubTxUp", up]] as const) {
    assert.doesNotMatch(body, /onpointerdown\s*=/,
      name + " writes onpointerdown, which belongs to wireClubEd — after one drag the word goes dead");
  }
  // Re-entrant instead: a second finger is added to the gesture that is already running.
  assert.match(drag, /CLUB_TXG && CLUB_TXG\.node === node/,
    "a second finger starts a second gesture with its own pointer map rather than joining the first");
  assert.match(drag, /CLUB_TXG = \{/, "the gesture is not held anywhere a second finger could find it");
  assert.match(up, /CLUB_TXG = null/, "the gesture is never released, so the next one adopts its fingers");
  // wireClubEd is still the only owner of onpointerdown, and it must pass the draft's key as a STRING.
  const wire = nocomment(fn(src, "wireClubEd"));
  assert.match(wire, /onpointerdown = \(ev\) => clubTextDrag\(ev, k === "d" \? "d" : Number\(k\)\)/,
    'the draft\'s key is coerced with Number("d") = NaN again, so the word being typed cannot be moved');
});

test("BLOCKER: opening the text editor redraws once, so the draft is on the picture and the chrome steps aside", () => {
  const src = page();
  const open = nocomment(fn(src, "clubTextOpen"));
  // ⚠️ BOTH OF THOSE ARE DECIDED IN clubEdDraw'S MARKUP, so the panel alone cannot bring either about.
  // Without the redraw the word being typed appeared nowhere until a keystroke happened to fall back to
  // one, and the tool row and the strip stayed on screen under the panel — the clutter he photographed.
  assert.match(open, /clubEdDraw\(\)/,
    "clubTextOpen no longer redraws, so the draft is not on the stage and the composer chrome stays up");
  assert.ok(open.indexOf("clubEdDraw()") < open.indexOf("clubTextDraw()"),
    "the panel is built before the stage it types onto");
  const draw = nocomment(fn(src, "clubEdDraw"));
  assert.match(draw, /S\.draft \? clubTextSpan\(S\.draft, "d", true\) : ""/,
    "the draft is no longer rendered as a real word on the stage");
  assert.match(draw, /const drafting = !!S\.draft/, "there is no gate on the composer's own chrome");
  // Everything the composer owns is behind that gate; the panel supplies the controls instead.
  const gated = draw.slice(draw.indexOf("drafting ?"));
  for (const part of ["clubTrimHtml", "clubToolsHtml", "club-foot"]) {
    assert.ok(gated.includes(part), part + " is outside the drafting gate, so it stays on screen");
  }
});

test("BLOCKER: the text panel is opaque and one line tall, so it is not a second screen of controls", () => {
  const src = page();
  const css = src.slice(src.indexOf("<style>"), src.indexOf("</style>"));
  // ⚠️ THE BASE RULE, NOT WHICHEVER ONE COMES FIRST. `.club-txed {` is a substring of
  // `html.kbup .club-txed {`, and that one is declared far earlier in the stylesheet — so an unanchored
  // regex read the keyboard rule and reported the panel as having no background at all. Pick the rule
  // that positions it. Same shape as this test's own background-versus-border slip, one edit later.
  const panel = [...css.matchAll(/\.club-txed \{([^}]*)\}/g)]
    .find((r) => /position:\s*fixed/.test(r[1]!));
  assert.ok(panel, "there is no .club-txed rule that positions the panel");
  // ⚠️ HIS SCREENSHOT 2: "the layout when editing text, its too cluttered". It was a translucent
  // full-screen overlay, so the composer's tool row and foot showed straight through it.
  // ⚠️ SCOPED TO THE background DECLARATION. Its first version swept the whole rule and matched the
  // BORDER's rgba(255,255,255,.12) — a legitimate hairline — so it failed on correct code. A guard that
  // reads a neighbouring declaration is measuring something it was not asked about.
  const bg = /background:\s*([^;]+);/.exec(panel![1]!);
  assert.ok(bg, "the panel declares no background at all, so whatever is behind it shows through");
  assert.doesNotMatch(bg![1]!, /rgba\([^)]*,\s*0?\.\d+\)|transparent/,
    "the panel's background is translucent again, so the composer's chrome shows through it");
  assert.doesNotMatch(panel![1]!, /inset:\s*0/,
    "the panel covers the whole screen again rather than sitting at the bottom");
  assert.match(panel![1]!, /bottom:\s*0/, "the panel is not anchored to the bottom");
  // A one-line field, not a two-row styled box: the words are read on the picture, not in the panel.
  const field = /\.club-txed-in \{([^}]*)\}/.exec(css);
  assert.ok(field, "there is no .club-txed-in rule");
  assert.match(field![1]!, /resize:\s*none/, "the field can be dragged bigger, covering the picture");
  const px = /font-size:\s*var\(--t-([a-z]+)\)/.exec(field![1]!);
  assert.ok(px, "the field's size is not on the type ladder, so it does not scale with the phone");
  assert.match(nocomment(fn(src, "clubTextDraw")), /rows="1"/,
    "the field is more than one row again, so it takes the room the picture needs");
  // ⚠️⚠️ THE KEYBOARD LIFTS IT, or every control the runner needs while typing is behind the keyboard.
  // The panel is fixed at bottom: 0 — right, because it must sit directly above the keyboard — and only
  // .app, .view and .sheet-ov were ever lifted. Found by sweeping every fixed bottom-anchored rule
  // against what html.kbup moves, not by looking at it: a headless browser raises no keyboard.
  assert.match(css, /html\.kbup \.club-txed \{[^}]*bottom:\s*var\(--kbh/,
    "the keyboard does not lift the text panel, so the field, Done and every tool sit behind it");
  assert.doesNotMatch(css, /html\.kbup \.club-txed \{[^}]*padding-bottom/,
    "the panel is padded rather than moved, so its background grows and its controls stay put");
});

test("BLOCKER: every change shows on the picture at once, and the plate scales with the size", () => {
  const src = page();
  const draw = nocomment(fn(src, "clubTextDraw"));
  // ⚠️ HIS SCREENSHOTS 4 AND 5: "i want the text and and changes you make to the text to be viewable
  // accurately in real time, not when you have clicked done". Every control repaints the word.
  const paints = (draw.match(/clubDraftPaint\(\)/g) || []).length;
  assert.ok(paints >= 4, "only " + paints + " controls repaint the word, so some wait for Done");
  const sz = draw.slice(draw.indexOf("sz.oninput"));
  assert.match(sz.slice(0, 200), /clubDraftPaint\(\)/, "the size slider does not repaint the word");
  assert.doesNotMatch(sz.slice(0, 200), /clubTextDraw\(\)/,
    "the size slider rebuilds the panel, which destroys the slider the finger is holding");
  // ⚠️ ONE PLACE PAINTS IT, and it is not a redraw.
  const p = nocomment(fn(src, "clubDraftPaint"));
  assert.match(p, /clubTxCss\(/, "the draft is styled by hand instead of by the function that styles the result");
  assert.match(p, /d\.size/, "the draft is not painted at its own size");
  // ⚠️ THE PLATE'S PADDING IS PROPORTIONAL. A flat 4px 12px is why "text background is far too big
  // during the editing phase" — right at the committed size and wrong at every other.
  const cssf = nocomment(fn(src, "clubTxCss"));
  const at = cssf.indexOf("padding");
  assert.ok(at > 0, "clubTxCss no longer sets a padding on the plate");
  // ⚠️ THE SLICE RUNS TO THE END OF THE STATEMENT, not to the second "px" — the expression is two
  // Math.max calls across two lines, and a short slice reported one axis where there are two.
  const pad = cssf.slice(at, cssf.indexOf(";", at));
  // ⚠️ BOTH AXES MUST SCALE, AND ITS FIRST VERSION ONLY NEEDED ONE. Replacing the vertical term with a
  // flat 4 left the horizontal one proportional, so `px * 0.` still matched and the guard passed with
  // half the fix removed. Watched escaping. Count the factors instead.
  const scaled = (pad.match(/px \* 0?\.\d+/g) || []).length;
  assert.ok(scaled >= 2,
    "only " + scaled + " of the plate's two padding axes scale with the size, so it is the wrong size " +
    "at every size but one: " + pad);
  assert.match(cssf, /line-height/, "the plate has no line height, so a two-line caption's rows collide");
});
