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
