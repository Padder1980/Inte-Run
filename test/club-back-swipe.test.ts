import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * INTE-CLUB'S BACK SWIPE GOES BACK ONCE, AND ONLY FROM THE POSTS SCREEN (2026-11-20, Road Map pc-club-swipe).
 *
 * Swiping right on the Posts screen (the feed a grid tile opens) goes back to the grid — the owner's request of
 * 2026-08-23. wireClubPostView runs after EVERY render of that screen, and each run used to add three more
 * listeners (pointerdown, pointerup, pointercancel) to #view, the app's one permanent scroller, never removed
 * and never asking which screen was showing. Measured in the browser before the fix, with real input:
 *  - the Posts screen drawn three times (the tap that opened it, then two redraws) answered ONE swipe with three
 *    trips back: three redraws and three haptic taps;
 *  - afterwards, a right swipe on the Training calendar threw the runner out of it to the Inte-Club grid —
 *    three times over. The setup form, the plan wizard and the live run screen are drawn into the same #view.
 *
 * The real functions run (openClubPost, wireClubPostView, clubWireBackSwipe and its threshold), lifted out of
 * the built page. Only the browser is a stand-in: #view is one permanent object that keeps its listeners across
 * renders, as the real element does, and render() wires the Posts screen only while it is the one showing, as
 * the real render() → wire() does. The last test holds that stand-in to the app's own path.
 */
const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
  .find((b) => b.includes("\nfunction clubWireBackSwipe(")) ?? "";
assert.ok(APP, "the app script is not in the build — run node web/app.ts");

function fnOf(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return APP.slice(at + 1, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}
/** From a top-level function to the next one: enough to ask what a very long function does. */
function topLevel(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  const end = APP.indexOf("\nfunction ", at + 10);
  return APP.slice(at, end > at ? end : APP.length);
}
const nocomment = (src: string) => src.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

/** The threshold, as the page declares it — the rules below are measured against the real number. */
const PX_DECL = APP.match(/^const CLUB_BACK_SWIPE_PX = [^;\n]*;/m)?.[0] ?? "";
assert.ok(PX_DECL, "CLUB_BACK_SWIPE_PX is no longer declared in the built page");
const PX = Number(PX_DECL.replace(/^[^=]*=\s*/, "").replace(/;$/, ""));
assert.ok(PX > 0, "CLUB_BACK_SWIPE_PX is not a number: " + PX_DECL);

type Target = { closest?: (sel: string) => unknown };
type Ev = { pointerType: string; button: number; clientX: number; clientY: number; pointerId: number; target: Target };
type Fn = (ev: Ev) => void;

/** A finger on something that is not a carousel. */
const PLAIN: Target = { closest: () => null };
/** A carousel with somewhere to go (several pictures), and one with nowhere to go (a single picture). */
const railOf = (scrollWidth: number): Target => {
  const rail = { scrollWidth, clientWidth: 343 };
  return { closest: (sel: string) => (sel === "[data-cprail]" ? rail : null) };
};

/**
 * #view: one element for the life of the page. Like the real one it keeps every listener added to it, and,
 * like addEventListener, it ignores the very same function added twice (a fresh closure is a new listener).
 */
class View {
  [k: string]: unknown;
  private on = new Map<string, Fn[]>();
  addEventListener(type: string, fn: Fn): void {
    const list = this.on.get(type) ?? [];
    if (!list.includes(fn)) list.push(fn);
    this.on.set(type, list);
  }
  removeEventListener(type: string, fn: Fn): void {
    this.on.set(type, (this.on.get(type) ?? []).filter((f) => f !== fn));
  }
  fire(type: string, ev: Ev): void { for (const fn of [...(this.on.get(type) ?? [])]) fn(ev); }
  count(type: string): number { return (this.on.get(type) ?? []).length; }
}

const LIFTED = ["openClubPost", "clubWireBackSwipe", "wireClubPostView"];

/** The app on the Inte-Club grid, with posts to open. */
function app() {
  const state: { tab: string; screen: string | null; clubPostId: string | null } =
    { tab: "community", screen: null, clubPostId: null };
  const view = new View();
  const n = { renders: 0, haptics: 0 };
  let wireClubPostView: () => void = () => {};
  // The real render() writes the screen into the same #view (v.innerHTML = …) and ends in wire(), which wires
  // the Posts screen only when it is the one showing (the reachability test holds the stand-in to that).
  const render = () => {
    n.renders++;
    if (state.screen === "clubpost") wireClubPostView();
  };
  const scope: Record<string, unknown> = {
    state, render,
    $: (id: string) => (id === "view" ? view : null),
    document: { querySelectorAll: () => [], querySelector: () => null },
    haptic: () => { n.haptics++; },
    clubFillMedia: () => {}, clubPosts: () => [], clubSharePost: () => {},
    clubConfirmDelete: () => {}, clubDelete: () => {}, toast: () => {},
    requestAnimationFrame: () => 0, setTimeout: () => 0,
  };
  const keys = Object.keys(scope);
  const src = [PX_DECL, ...LIFTED.map(fnOf)].join("\n") + "\nreturn { openClubPost, wireClubPostView };";
  // eslint-disable-next-line no-new-func
  const fns = new Function(...keys, src)(...keys.map((k) => scope[k])) as {
    openClubPost: (id: string) => void; wireClubPostView: () => void;
  };
  wireClubPostView = fns.wireClubPostView;
  const ev = (x: number, y: number, o: Partial<Ev> = {}): Ev =>
    ({ pointerType: "touch", button: 0, clientX: x, clientY: y, pointerId: 1, target: PLAIN, ...o });
  return {
    state, n, view,
    /** A grid tile tapped: the real openClubPost. */
    open: (id = "post-a") => fns.openClubPost(id),
    /** Any redraw of the screen showing: a watch tick, the weather landing, a post deleted. */
    redraw: render,
    /** Anywhere else the app can go — a bottom-nav tab, the calendar, setup, a run starting. */
    goTo: (screen: string | null) => { state.screen = screen; render(); },
    down: (x: number, y: number, o: Partial<Ev> = {}) => view.fire("pointerdown", ev(x, y, o)),
    up: (x: number, y: number, o: Partial<Ev> = {}) => view.fire("pointerup", ev(x, y, o)),
    cancel: () => view.fire("pointercancel", ev(0, 0)),
    /** A clear right swipe: well past the threshold, nearly level. */
    swipe: (o: Partial<Ev> = {}) => { view.fire("pointerdown", ev(30, 400, o)); view.fire("pointerup", ev(30 + PX + 120, 406, o)); },
  };
}

/** Every screen the app can put in #view other than the Posts screen — read from the page, plus the tabs (null). */
const OTHER_SCREENS: (string | null)[] = [null, ...new Set(
  [...APP.matchAll(/state\.screen (?:=|===) "([a-z]+)"/g)].map((m) => m[1]!).filter((s) => s !== "clubpost"),
)];

test("BLOCKER: a Posts screen drawn five times goes back ONCE per swipe", () => {
  const a = app();
  a.open();
  a.redraw(); a.redraw(); a.redraw(); a.redraw();
  assert.equal(a.state.screen, "clubpost");
  const before = a.n.renders;
  a.swipe();
  assert.equal(a.state.screen, null, "the swipe did not go back to the grid");
  assert.equal(a.n.renders - before, 1,
    "one swipe went back " + (a.n.renders - before) + " times — a copy of the swipe per render of the screen");
  assert.equal(a.n.haptics, 1, "one swipe gave " + a.n.haptics + " haptic taps");
  // And #view itself holds one set, however often the screen was drawn: listeners on a permanent element that
  // are never removed are a leak even on the day nothing yet fires twice.
  for (const t of ["pointerdown", "pointerup", "pointercancel"]) {
    assert.equal(a.view.count(t), 1, "#view holds " + a.view.count(t) + " " + t + " listeners after five draws");
  }
});

test("BLOCKER: after a post has been open, a right swipe on every other screen does nothing", () => {
  assert.ok(OTHER_SCREENS.length >= 10 && OTHER_SCREENS.includes("setup") && OTHER_SCREENS.includes("wizard") &&
    OTHER_SCREENS.includes("live") && OTHER_SCREENS.includes("calendar"),
    "the screens read from the page are not the app's screens: " + OTHER_SCREENS.join(", "));
  for (const screen of OTHER_SCREENS) {
    const a = app();
    a.open(); a.redraw(); a.redraw();
    a.goTo(null); // the ‹ Inte-Club chevron (or a swipe) back to the grid
    a.goTo(screen);
    const before = { renders: a.n.renders, haptics: a.n.haptics };
    a.swipe();
    assert.equal(a.state.screen, screen, "a right swipe threw the runner off " + (screen ?? "a tab") +
      " — the Posts screen's back swipe is still listening after it has gone");
    assert.deepEqual({ renders: a.n.renders, haptics: a.n.haptics }, before,
      "a right swipe on " + (screen ?? "a tab (the Inte-Club grid included)") + " redrew or buzzed");
  }
});

test("a swipe that starts on the Posts screen and lifts on another does nothing", () => {
  // A wrist run arriving (or a Live Activity tap) changes the screen under a finger already down.
  const a = app();
  a.open();
  a.down(30, 400);
  a.goTo("watchlive");
  const before = a.n.renders;
  a.up(30 + PX + 120, 406);
  assert.equal(a.state.screen, "watchlive", "the runner was thrown off the live run by a swipe begun on a post");
  assert.equal(a.n.renders, before, "the late swipe redrew");
});

test("the Posts screen's own swipe still goes back, by its own rules", () => {
  // The real threshold: exactly PX across goes back, one pixel less does not.
  const exact = app(); exact.open();
  exact.down(30, 400); exact.up(30 + PX, 400);
  assert.equal(exact.state.screen, null, "a swipe of exactly " + PX + "px did not go back");
  assert.equal(exact.state.clubPostId, null, "going back left the tapped post set, so the next open would jump");
  const cases: [string, (a: ReturnType<typeof app>) => void][] = [
    ["one pixel short", (a) => { a.down(30, 400); a.up(30 + PX - 1, 400); }],
    ["leftward", (a) => { a.down(300, 400); a.up(300 - PX - 120, 400); }],
    ["diagonal (less than twice as far across as down)", (a) => { a.down(30, 400); a.up(30 + 100, 400 + 51); }],
    ["on a carousel with more pictures to show", (a) => a.swipe({ target: railOf(343 * 3) })],
    ["with a mouse's right button", (a) => a.swipe({ pointerType: "mouse", button: 2 })],
    ["cancelled by the browser (it took the touch for a scroll)", (a) => { a.down(30, 400); a.cancel(); a.up(30 + PX + 120, 406); }],
    ["lifted by a different finger", (a) => { a.down(30, 400); a.up(30 + PX + 120, 406, { pointerId: 2 }); }],
  ];
  for (const [what, act] of cases) {
    const a = app(); a.open();
    act(a);
    assert.equal(a.state.screen, "clubpost", "a swipe " + what + " went back");
  }
  for (const [what, o] of [["on a single-picture post (its rail has nowhere to go)", { target: railOf(343) }],
    ["with a mouse's main button", { pointerType: "mouse", button: 0 }]] as [string, Partial<Ev>][]) {
    const a = app(); a.open();
    a.swipe(o);
    assert.equal(a.state.screen, null, "a swipe " + what + " did not go back");
  }
});

test("leaving and opening a post again still has exactly one way back", () => {
  const a = app();
  a.open("post-a"); a.redraw();
  a.swipe();
  assert.equal(a.state.screen, null);
  a.goTo("calendar"); a.goTo(null);
  a.open("post-b"); a.redraw(); a.redraw();
  const before = { renders: a.n.renders, haptics: a.n.haptics };
  a.swipe();
  assert.equal(a.state.screen, null, "the second post's swipe did not go back");
  assert.deepEqual({ renders: a.n.renders - before.renders, haptics: a.n.haptics - before.haptics },
    { renders: 1, haptics: 1 }, "the second post's swipe went back more than once");
});

test("the harness is the app's own path: one permanent #view, render draws the Posts screen into it and wires it", () => {
  // #view is one element in the page's shell, and render() fills it rather than replacing it — which is why a
  // listener on it outlives every screen.
  assert.equal((PAGE.match(/id="view"/g) ?? []).length, 1, "the page no longer has exactly one #view");
  assert.match(PAGE, /<main class="view" id="view"><\/main>/, "#view is no longer the shell's empty <main>");
  const render = nocomment(topLevel("render"));
  assert.match(render, /^\s*const v = \$\("view"\);/m, "render() no longer draws into #view");
  assert.match(render,
    /if \(state\.screen === "clubpost" \|\| state\.screen === "clubedit"\) \{[\s\S]*?v\.innerHTML = isEdit \? viewClubEdit\(\) : clubPostViewHtml\(\);[\s\S]*?\bwire\(\);\s*\n\s*return;/,
    "render() no longer draws the Posts screen into #view and wires it");
  assert.match(nocomment(topLevel("wire")), /if \(state\.screen === "clubpost"\) wireClubPostView\(\);/,
    "wire() no longer wires the Posts screen only while it is showing");
  // And a grid tile opens the screen through the real openClubPost.
  assert.match(nocomment(topLevel("wire")),
    /document\.querySelectorAll\("\[data-cpost\]"\)\.forEach\(\(b\) => b\.onclick = \(\) => openClubPost\(b\.dataset\.cpost\)\);/,
    "a grid tile no longer opens the Posts screen through openClubPost");
  // The back swipe goes where the ‹ Inte-Club chevron goes.
  assert.match(nocomment(topLevel("wire")),
    /if \(cb\) cb\.onclick = \(\) => \{ state\.screen = null; state\.clubPostId = null; render\(\); \};/,
    "the chevron's way back changed — the swipe must go to the same place");
});
