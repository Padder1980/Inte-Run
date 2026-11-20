import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A SCREEN FADES IN WHEN THE RUNNER ARRIVES ON IT, NOT EVERY TIME IT REDRAWS (pc-redraw-fade, 2026-11-20).
 *
 * render() ended in viewEnter(v) for the five tabs and Profile, and viewEnter replays the 180 ms arrival
 * (opacity 0 up to 1) by taking .view-in off #view, reading layout and putting it back. It did that on EVERY
 * render, so anything that redrew the screen the runner was already on blinked it from nothing: a day
 * tapped in Today's week strip, a Logbook filter, a sheet closing, and Today on every update from the watch
 * during a wrist run. It is what made the Connected apps loop of 2026-11-20 look like flicker. (Rating an
 * effort never blinked: it happens on the run's page and the finish screen, which have no fade at all.)
 *
 * render() already knew the difference: its scroll key (tab, screen, Support page, Logbook sub-tab, run,
 * wizard step) keeps the scroll position on a redraw. The fix lets the same key decide the fade.
 *
 * The real render(), viewEnter(), the watch's live-run hook and the wrist view's back button run here,
 * lifted out of the built page with the top-level lets they read. Only the browser is a stand-in, and it
 * is modelled where it matters: a CSS animation starts again at a style recalculation that finds the class
 * present when the one before found it absent. viewEnter's layout read is one such recalculation; the end
 * of the task, before the next frame, is another.
 */
const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
  .find((b) => b.includes("\nfunction render(")) ?? "";
assert.ok(APP, "the app script is not in the build — run node web/app.ts");

/** From `at` to the brace that closes the first one after it. */
function braced(at: number, what: string): string {
  assert.ok(at >= 0, what + " is not in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return APP.slice(at, i + 1); }
  }
  return assert.fail(what + " has no matching close brace");
}
function fnAt(name: string): number {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  return at + 1;
}
const fnOf = (name: string) => braced(fnAt(name), "function " + name);

/** Where `name(` is CALLED in src: not its definition, and not on a comment line (comments quote it). */
function callsOf(src: string, name: string): number[] {
  const out: number[] = [];
  for (const m of src.matchAll(new RegExp("\\b" + name + "\\(", "g"))) {
    const i = m.index!;
    const before = src.slice(src.lastIndexOf("\n", i) + 1, i).trim();
    if (before.startsWith("//") || before.startsWith("*") || before.startsWith("/*")) continue;
    if (/\bfunction\s*$/.test(before)) continue;
    out.push(i);
  }
  return out;
}

const RENDER = fnOf("render");
const RENDER_AT = fnAt("render");
const ENTER_CALLS = callsOf(RENDER, "viewEnter");
// Each place render() hands over to viewEnter, numbered, so the tests can show every one was reached.
const RENDER_SITED = ENTER_CALLS.slice().reverse()
  .reduce((src, at, k) => src.slice(0, at) + "__site(" + (ENTER_CALLS.length - 1 - k) + "), " + src.slice(at), RENDER);
const VIEW_ENTER = fnOf("viewEnter");
const WATCH_ACTIVE = fnOf("watchLiveActive");
const WATCH_HOOK = braced(APP.indexOf("window.__interunWatchLive = function (live) {"), "the watch's live-run hook");
const BACK_HOOK = "wlb.onclick = ";
const WL_BACK = braced(APP.indexOf(BACK_HOOK + "() => {"), "the wrist view's back button").slice(BACK_HOOK.length);

/** The bottom bar's five tabs, read from buildNav rather than listed here. */
const TABS = JSON.parse("[" + ((APP.match(/\$\("nav"\)\.innerHTML = \[([^\]]*)\]/) || [])[1] ?? "") + "]") as string[];
assert.equal(TABS.length, 5, "the bottom bar's tabs could not be read from buildNav");
/** Every screen render() can draw instead of a tab, read from render() itself. */
const SCREENS = [...new Set([...RENDER.matchAll(/state\.screen === "([a-z]+)"/g)].map((m) => m[1]!))];

type State = { tab: string; screen: string | null; support: string | null; actTab: string };
type Let = { get: () => unknown; set: (x: unknown) => void };

/** #view, as far as its animation goes. */
function fakeView() {
  const classes = new Set<string>();
  let wasOn = false;
  const fx = { starts: 0, cancels: 0 };
  const recalc = () => {
    const on = classes.has("view-in");
    if (on && !wasOn) fx.starts++;
    if (!on && wasOn) fx.cancels++;
    wasOn = on;
  };
  const view = {
    innerHTML: "",
    scrollTop: 0,
    style: {} as Record<string, string>,
    classList: {
      add: (c: string) => { classes.add(c); },
      remove: (c: string) => { classes.delete(c); },
      contains: (c: string) => classes.has(c),
      toggle: (c: string, on?: boolean) => {
        const want = on ?? !classes.has(c);
        if (want) classes.add(c); else classes.delete(c);
        return want;
      },
    },
    get offsetWidth() { recalc(); return 390; },
  };
  return { view, fx, recalc };
}

/** The app on Today, before its first render. */
function app() {
  const { view, fx, recalc } = fakeView();
  const nodes: Record<string, unknown> = { view, nav: { style: {} }, topTitle: { textContent: "" } };
  const state: State = { tab: "today", screen: null, support: null, actTab: "workouts" };
  const drawn: string[] = [];
  const sites = new Set<number>();
  let inWire: (() => void) | null = null;
  const win: Record<string, unknown> = {};
  const own: Record<string, unknown> = {
    state,
    $: (id: string) => nodes[id] ?? null,
    document: { documentElement: { classList: { toggle: () => false } }, querySelectorAll: () => [] },
    window: win,
    liveRunning: () => false, // the phone is not recording; the watch is
    calTipUp: () => false, // no calendar lesson open
    wire: () => { const f = inWire; inWire = null; if (f) f(); },
    __site: (n: number) => { sites.add(n); },
    // The watch hook's timers and the coach's audio: nothing here may outlive the test.
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    coachLoadManifest: () => Promise.resolve(),
  };
  // Everything else render() touches is a view builder or a side effect: a stub that records its name and
  // returns a marker, so a test can see which screen was drawn.
  const stubs: Record<string, unknown> = {};
  const scope = new Proxy(own, {
    has: (t, k) => typeof k === "string" && (k in t || !(k in globalThis)),
    get: (t, k) => {
      if (typeof k !== "string") return undefined;
      if (k in t) return t[k];
      return (stubs[k] ??= () => { drawn.push(k); return "<" + k + ">"; });
    },
    set: (t, k, val) => { t[k as string] = val; return true; },
  });
  const lifted = [RENDER_SITED, VIEW_ENTER, WATCH_ACTIVE, WATCH_HOOK, WL_BACK];
  // The top-level lets these read, taken from the page rather than listed here: LAST_SCROLL_KEY, DRAG and
  // the wrist mirror's own.
  const lets = [...APP.matchAll(/^let ([A-Za-z_$][\w$]*) = [^;\n]*;/gm)]
    .filter((m) => !(m[1]! in own) && lifted.some((s) => new RegExp("\\b" + m[1] + "\\b").test(s)));
  const names = lets.map((m) => m[1]!);
  assert.ok(names.includes("LAST_SCROLL_KEY"), "render() no longer reads LAST_SCROLL_KEY");
  const body = "with (__scope) {\n" + lets.map((m) => m[0]).join("\n") + "\n" +
    RENDER_SITED + "\n" + VIEW_ENTER + "\n" + WATCH_ACTIVE + "\n" + WATCH_HOOK + ";\n" +
    "return { render: render, back: " + WL_BACK + ", lets: { " +
    names.map((n) => n + ": { get: () => " + n + ", set: (x) => { " + n + " = x; } }").join(", ") + " } };\n}";
  // eslint-disable-next-line no-new-func
  const made = new Function("__scope", body)(scope) as { render: () => void; back: () => void; lets: Record<string, Let> };
  return {
    state, view, fx, drawn, sites, lets: made.lets,
    /** One task: render(), then the style recalculation the browser makes before the next frame. */
    render: () => { made.render(); recalc(); },
    go: (patch: Partial<State>) => { Object.assign(state, patch); made.render(); recalc(); },
    /** The next wire() calls render() again: a redraw caused from inside a render. */
    redrawFromWire: () => { inWire = () => made.render(); },
    tick: (live: Record<string, unknown>) => { (win.__interunWatchLive as (l: unknown) => void)(live); recalc(); },
    back: () => { made.back(); recalc(); },
    count: (builder: string) => drawn.filter((d) => d === builder).length,
  };
}
type App = ReturnType<typeof app>;

/** What a change did to the fade: restarts and cuts. */
function fadeOf(a: App, act: () => void): { starts: number; cancels: number } {
  const s = a.fx.starts, c = a.fx.cancels;
  act();
  return { starts: a.fx.starts - s, cancels: a.fx.cancels - c };
}
const builderFor = (tab: string, screen: string | null) =>
  "view" + (screen ?? tab).charAt(0).toUpperCase() + (screen ?? tab).slice(1);
const PLACES: { tab: string; screen: string | null }[] = [
  ...TABS.map((tab) => ({ tab, screen: null })),
  { tab: "today", screen: "profile" },
];

test("BLOCKER: a redraw of the screen the runner is on does not replay its fade — the five tabs and Profile", () => {
  for (const place of PLACES) {
    const name = place.screen ?? place.tab;
    const a = app();
    a.go(place);
    assert.equal(a.view.innerHTML, "<" + builderFor(place.tab, place.screen) + ">", "the harness did not draw " + name);
    assert.equal(a.fx.starts, 1, "arriving on " + name + " did not fade in");
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(fadeOf(a, a.render), { starts: 0, cancels: 0 },
        "redraw " + (i + 1) + " of " + name + " replayed the fade — the screen blinks from nothing on every redraw");
    }
    assert.equal(a.count(builderFor(place.tab, place.screen)), 4, name + " was not actually redrawn");
  }
});

test("a redraw inside the arrival's 180 ms leaves the fade running instead of starting it again", () => {
  // Today's weather answering, a sheet closing: a redraw can land while the screen is still arriving.
  const a = app();
  a.go({ tab: "today" });
  a.go({ tab: "plan" });
  // The arrival is under way (the class went on at the last recalculation). A redraw now must not touch it.
  assert.deepEqual(fadeOf(a, a.render), { starts: 0, cancels: 0 }, "a redraw cut the arrival short and started it again");
});

test("arriving still fades: every tab, Profile both ways, a Logbook sub-tab, a Support page, and back from a screen without one", () => {
  const a = app();
  assert.equal(fadeOf(a, () => a.go({ tab: "today" })).starts, 1, "the app's first screen did not fade in");
  for (const tab of TABS.filter((t) => t !== "today")) {
    assert.equal(fadeOf(a, () => a.go({ tab })).starts, 1, "switching to the " + tab + " tab no longer fades");
  }
  assert.equal(fadeOf(a, () => a.go({ screen: "profile" })).starts, 1, "opening Profile no longer fades");
  assert.equal(fadeOf(a, () => a.go({ screen: null, tab: "activities" })).starts, 1, "leaving Profile for a tab no longer fades");
  // A Logbook sub-tab is a navigation (the key says so, and it resets the scroll); a filter within one is not.
  assert.equal(fadeOf(a, () => a.go({ actTab: "performance" })).starts, 1, "a Logbook sub-tab no longer fades");
  assert.equal(fadeOf(a, () => a.go({ tab: "support", support: "connect" })).starts, 1, "a Support page no longer fades");
  assert.equal(fadeOf(a, () => a.go({ support: null })).starts, 1, "back to Support no longer fades");
  // The calendar has no fade of its own; coming back from it to the same tab is still an arrival.
  assert.equal(fadeOf(a, () => a.go({ screen: "calendar" })).starts, 0, "the calendar gained a fade — this test's model is wrong");
  assert.equal(fadeOf(a, () => a.go({ screen: null })).starts, 1, "coming back to a tab from the calendar no longer fades");
});

test("a redraw caused from inside an arrival does not swallow the arrival's fade", () => {
  // ⚠️ wire() runs between render()'s key and viewEnter. If the answer were a top-level flag that viewEnter
  // reads, a render() caused from in there would set it to "same screen", and the arrival it sits inside
  // would never fade. The answer is a local, handed to viewEnter.
  const a = app();
  a.go({ tab: "today" });
  a.redrawFromWire();
  const f = fadeOf(a, () => a.go({ tab: "plan" }));
  assert.equal(a.count("viewPlan"), 2, "the redraw from inside wire() did not happen — this test is not testing anything");
  assert.equal(f.starts, 1, "an arrival with a redraw inside it did not fade in");
});

test("Today during a run recorded on the watch: each update redraws Today, and none replays the fade", () => {
  const a = app();
  a.go({ tab: "today" });
  // The wrist starts: the mirror takes the whole screen.
  a.tick({ id: "w1", state: "running", sec: 2 });
  assert.equal(a.state.screen, "watchlive", "a run starting on the wrist no longer takes the whole screen");
  // The runner backs out with the arrow — the page's own handler — and lands on Today. That is an arrival.
  assert.equal(fadeOf(a, a.back).starts, 1, "backing out of the wrist view to Today did not fade in");
  assert.equal(a.lets.WATCH_LIVE_LEFT?.get(), true, "the back button no longer remembers the runner left");
  const todays = a.count("viewToday");
  // Ticks arrive about every two seconds for the whole run.
  const f = fadeOf(a, () => { for (let s = 4; s <= 20; s += 2) a.tick({ id: "w1", state: "running", sec: s }); });
  assert.equal(a.count("viewToday") - todays, 9, "the watch's updates no longer redraw Today — this test is not testing anything");
  assert.deepEqual(f, { starts: 0, cancels: 0 }, "Today blinked on " + f.starts + " of 9 updates from the watch");
  // The run ending redraws Today once more (the card goes), still in place.
  const end = fadeOf(a, () => a.tick({ id: "w1", state: "ended", sec: 22 }));
  assert.equal(a.count("viewToday") - todays, 10, "the end of the wrist run no longer redraws Today");
  assert.deepEqual(end, { starts: 0, cancels: 0 }, "the end of the wrist run replayed Today's fade");
});

test("a redraw keeps the scroll position; a move to another screen starts at the top", () => {
  const a = app();
  a.go({ tab: "activities" });
  a.view.scrollTop = 640;
  a.render();
  assert.equal(a.view.scrollTop, 640, "a redraw threw the runner back to the top");
  a.go({ actTab: "performance" });
  assert.equal(a.view.scrollTop, 0, "a Logbook sub-tab kept the last one's scroll position");
  a.view.scrollTop = 300;
  a.go({ screen: "profile" });
  assert.equal(a.view.scrollTop, 0, "Profile opened part-way down");
});

test("no screen render() can draw replays a fade when it redraws, and every place that starts one was reached", () => {
  // Derived: every screen named in render() and every tab, so a fade added to another screen later is held
  // to the same rule without anyone listing it here.
  assert.ok(SCREENS.length >= 10, "render()'s screens could not be read: " + SCREENS.join(", "));
  const a = app();
  for (const place of [...SCREENS.map((screen) => ({ tab: "today", screen })), ...PLACES]) {
    a.go(place);
    assert.deepEqual(fadeOf(a, a.render), { starts: 0, cancels: 0 }, "a redraw of " + (place.screen ?? place.tab) + " replayed the fade");
  }
  assert.ok(ENTER_CALLS.length >= 2, "render() hands over to viewEnter in fewer places than the tabs and Profile");
  for (let i = 0; i < ENTER_CALLS.length; i++) {
    assert.ok(a.sites.has(i), "viewEnter call " + (i + 1) + " of " + ENTER_CALLS.length + " in render() was never reached by these tests");
  }
});

test("every call to viewEnter is in render() and hands it render()'s own answer", () => {
  const all = callsOf(APP, "viewEnter");
  assert.equal(all.length, ENTER_CALLS.length,
    "viewEnter is called outside render(), where nothing tells it whether the runner moved");
  for (const at of all) {
    assert.ok(at > RENDER_AT && at < RENDER_AT + RENDER.length, "a viewEnter call sits outside render()");
    assert.ok(APP.startsWith("viewEnter(v, !sameScreen)", at),
      "a viewEnter call no longer passes render()'s answer: " + APP.slice(at, at + 40));
  }
  // The one answer, from the key, before the scroll uses it — and the scroll and the fade share it.
  assert.match(RENDER, /const sameScreen = scrollKey === LAST_SCROLL_KEY;\s*\n\s*const keepScroll = sameScreen \? v\.scrollTop : 0;\s*\n\s*LAST_SCROLL_KEY = scrollKey;/,
    "the scroll and the fade no longer share one answer to whether the screen changed");
  // The harness's back button and wrist hook are the page's own, and the back button lands on Today.
  assert.match(WL_BACK, /WATCH_LIVE_LEFT = true;[\s\S]*state\.screen = null; state\.tab = "today"; render\(\);/,
    "the wrist view's back button no longer lands on Today through render()");
});
