import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * CONNECTED APPS OPENS, ASKS STRAVA ONCE, AND THEN STAYS STILL (2026-11-20).
 *
 * The owner: "every time I press the Connected apps button, the page it takes me to is constantly flickering
 * and it won't allow me to press anything on that screen." Measured in the browser with a connected Strava:
 * 24 full redraws a second, each one a /strava/status request, for as long as the screen stayed open. Every
 * redraw rebuilt the screen under the runner's finger, so a tap seldom survived long enough to land.
 *
 * The loop had two halves, and either one alone breaks it, so each is held here on its own as well as the
 * loop as a whole:
 *  - wireConnectView asked the server on EVERY wire(), and wire() runs after every render — so a redraw
 *    asked exactly as an opening did;
 *  - stravaRefresh redrew the screen after every answer: its test ended "|| !c.pending", which is true
 *    whenever nothing is waiting, i.e. always, for a runner who is connected.
 *
 * The real functions run, lifted out of the built page with the top-level lets they read; only the browser
 * (render, the document) and the network are stand-ins.
 */
const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
  .find((b) => b.includes("\nfunction wireConnectView(")) ?? "";
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
/** From a top-level function to the next one: enough to ask what a very long function calls. */
function topLevel(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  const end = APP.indexOf("\nfunction ", at + 10);
  return APP.slice(at, end > at ? end : APP.length);
}
const nocomment = (src: string) => src.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

const LIFTED = ["wireConnectView", "stravaRefresh", "stravaRerender"];

type Cfg = Record<string, unknown>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const CONNECTED: Cfg = {
  key: "device-key", connected: true, name: "Sam", pending: 0,
  sportTypes: ["Run", "WeightTraining"], origins: ["recorded", "added"],
};
const SAME_ANSWER: Cfg = { connected: true, configured: true, canWrite: true, name: "Sam", sportTypes: ["Run", "WeightTraining"], origins: ["recorded", "added"] };

/** The app with a connected Strava, on the profile screen, one tap from Connected apps. */
function app(stored: Cfg, reply: Cfg) {
  let cfg = clone(stored);
  let answer = clone(reply);
  const state: { tab: string; support: string | null } = { tab: "profile", support: null };
  let onScreen = false;
  const n = { asks: 0, renders: 0 };
  let wireConnectView: () => void = () => {};
  // The real render() rebuilds the screen and ends in wire(), which calls wireConnectView() whatever the
  // screen (the reachability test below holds the harness to that).
  const render = () => {
    n.renders++;
    onScreen = state.tab === "support" && state.support === "connect";
    wireConnectView();
  };
  const scope: Record<string, unknown> = {
    state, render,
    document: { querySelector: (sel: string) => (sel === ".cn-row" && onScreen ? {} : null), querySelectorAll: () => [] },
    NATIVE_WATCH: false, WATCH_STATUS: null, window: {},
    $: () => null, // the Strava sheet is not open
    openStravaSheet: () => {}, openRemindersSheet: () => {},
    stravaCfg: () => clone(cfg),
    stravaSaveCfg: (c: Cfg) => { cfg = clone(c); },
    stravaBase: () => "https://example.test",
    // The network answers on a later turn, as a real fetch does. Capped, so that if the loop comes back it
    // fails this file rather than hanging the suite.
    stravaCall: (path: string) => {
      assert.match(path, /^\/strava\/status\?dk=/, "an unexpected server call: " + path);
      n.asks++;
      if (n.asks > 200) return new Promise(() => {});
      return new Promise((res) => setTimeout(() => res({ ok: true, status: 200, json: clone(answer) }), 0));
    },
  };
  const keys = Object.keys(scope);
  const bodies = LIFTED.map(fnOf);
  // The top-level lets these functions read, taken from the page rather than listed here, so a flag the
  // fix depends on travels with it and the unfixed page simply has none.
  const lets = [...APP.matchAll(/^let ([A-Za-z_$][\w$]*) = [^;\n]*;/gm)]
    .filter((m) => !keys.includes(m[1]!) && bodies.some((b) => new RegExp("\\b" + m[1] + "\\b").test(b)))
    .map((m) => m[0]);
  const src = [...lets, ...bodies].join("\n") + "\nreturn { wireConnectView, stravaRefresh };";
  // eslint-disable-next-line no-new-func
  const fns = new Function(...keys, src)(...keys.map((k) => scope[k])) as {
    wireConnectView: () => void; stravaRefresh: () => Promise<unknown>;
  };
  wireConnectView = fns.wireConnectView;
  return {
    n,
    cfg: () => cfg,
    answer: (r: Cfg) => { answer = clone(r); },
    open: () => { state.tab = "support"; state.support = "connect"; render(); },
    leave: () => { state.tab = "profile"; state.support = null; render(); },
    redraw: render,
    refresh: () => fns.stravaRefresh(),
  };
}

/** Long enough for a loop to go round many times (one ask per turn), short enough to stay quick. */
async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
}

test("BLOCKER: opening Connected apps asks Strava once, and the screen then stays still", async () => {
  const a = app(CONNECTED, SAME_ANSWER);
  a.open();
  await settle();
  assert.equal(a.n.asks, 1, "opening the screen once asked Strava " + a.n.asks + " times — the redraw loop is back");
  assert.equal(a.n.renders, 1, "an answer that changed nothing redrew the screen " + (a.n.renders - 1) + " times");
  await settle();
  assert.deepEqual(a.n, { asks: 1, renders: 1 }, "the screen kept moving after it had its answer");
});

test("an answer that changes what the screen shows redraws it once, and only once", async () => {
  // Renamed on Strava: the screen must show it, so a fix that never redraws is not a fix.
  const renamed = app(CONNECTED, Object.assign({}, SAME_ANSWER, { name: "Sam R" }));
  renamed.open();
  await settle();
  assert.deepEqual(renamed.n, { asks: 1, renders: 2 }, "a new name was not shown, or was shown more than once");
  assert.equal(renamed.cfg().name, "Sam R");
  // Revoked from Strava's own settings page: the one answer this screen exists to give.
  const revoked = app(CONNECTED, { connected: false, configured: true, sportTypes: ["Run"], origins: ["recorded"] });
  revoked.open();
  await settle();
  assert.deepEqual(revoked.n, { asks: 1, renders: 2 }, "a revoked connection was not shown, or was shown more than once");
  assert.equal(revoked.cfg().connected, false);
});

test("a redraw of the screen is not an opening, and asks nothing", async () => {
  // The watch's answer landing, a sheet closing, an in-page control: each renders this screen again.
  const a = app(CONNECTED, SAME_ANSWER);
  a.open();
  await settle();
  a.redraw(); a.redraw(); a.redraw();
  await settle();
  assert.equal(a.n.asks, 1, "a redraw asked Strava again — wireConnectView cannot tell opening from redrawing");
});

test("every opening still asks: leaving and coming back checks Strava again", async () => {
  // ⚠️ THE PROMISE THE FIX MUST KEEP: a runner can revoke Inte-Run from Strava's own settings page, and this
  // is where they come to find out. Asking once per app launch instead would report a stale answer.
  const a = app(CONNECTED, SAME_ANSWER);
  a.open();
  await settle();
  a.leave();
  await settle();
  assert.equal(a.n.asks, 1, "leaving the screen asked Strava");
  a.open();
  await settle();
  assert.equal(a.n.asks, 2, "coming back to the screen did not check Strava again");
});

test("an answer that changes nothing redraws nothing, whoever asked", async () => {
  // stravaResume (coming back from Safari) asks too; its answer must not redraw a screen it leaves the same.
  const a = app(CONNECTED, SAME_ANSWER);
  a.open();
  await settle();
  const before = a.n.renders;
  await a.refresh();
  await settle();
  assert.equal(a.n.renders, before, "an unchanged answer redrew the screen — stravaRefresh's redraw test is always true again");
  a.answer({ connected: false, configured: true });
  await a.refresh();
  await settle();
  assert.equal(a.n.renders, before + 1, "a changed answer was not shown");
});

test("the harness is the app's own path: render ends in wire, wire calls wireConnectView, an answer redraws via stravaRerender", () => {
  assert.match(nocomment(topLevel("render")), /\bwire\(\);/, "render() no longer ends in wire()");
  assert.match(nocomment(topLevel("wire")), /\bwireConnectView\(\);/, "wire() no longer calls wireConnectView()");
  assert.match(nocomment(fnOf("stravaRefresh")), /\bstravaRerender\(\);/, "stravaRefresh no longer redraws through stravaRerender");
  assert.match(nocomment(fnOf("stravaRerender")), /state\.support === "connect"\) render\(\);/,
    "stravaRerender no longer redraws Connected apps");
  // And the buttons that open this screen reach it through render(): the Plan page's "Connected apps" tile (the
  // button the owner named) through planAction, and the profile's Apps & devices row through the [data-pf] handler.
  assert.match(nocomment(fnOf("planActionsHtml")), /tile\("apps", ICON\.devices, "Connected<br>apps"\)/, "the Connected apps tile has gone");
  assert.match(nocomment(topLevel("planAction")),
    /if \(id === "apps"\) \{\s*\n\s*state\.tab = "support"; state\.screen = null; state\.support = "connect"; state\.supportFrom = null;\s*\n\s*render\(\);/,
    "the Connected apps tile no longer opens this screen through render()");
  assert.match(APP, /label: "Apps & devices", value: devices, action: "connect" \}\)/, "the Apps & devices row has gone");
  assert.match(nocomment(topLevel("wire")), /state\.support = to;\s*\n\s*state\.supportFrom = "profile";\s*\n\s*render\(\);/,
    "the profile rows no longer open their screen through render()");
});

// ---- The Strava sheet: a closed sheet stays closed, and "check now" always answers (2026-11-20, his yes) --------

/** Run real functions from the built page with only the names given here in scope. */
function lift<T>(names: string[], ret: string, scope: Record<string, unknown>): T {
  const keys = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...keys, names.map(fnOf).join("\n") + "\nreturn " + ret + ";")(...keys.map((k) => scope[k])) as T;
}
/** The sheet's overlay: open or closed. closeSheet only removes .on, and the sheet's body stays in the page. */
const overlay = (open: boolean) => ({ classList: { contains: (c: string) => c === "on" && open } });

test("a closed Strava sheet stays closed: a new answer redraws Connected apps instead", () => {
  const rerender = (o: { sheetInPage: boolean; open: boolean; onConnect: boolean }) => {
    const n = { render: 0, sheet: 0 };
    lift<() => void>(["stravaRerender"], "stravaRerender", {
      $: (id: string) => (id === "sheetOv" ? overlay(o.open) : id === "stvSheet" ? (o.sheetInPage ? {} : null) : null),
      state: o.onConnect ? { tab: "support", support: "connect" } : { tab: "today", support: null },
      render: () => { n.render++; },
      openStravaSheet: () => { n.sheet++; },
    })();
    return n;
  };
  // ⚠️ THE CASE THAT WAS WRONG: opened once, closed, and the answer changed (a disconnect made on Strava's website).
  // The sheet popped back up, and Connected apps behind it still said Connected.
  assert.deepEqual(rerender({ sheetInPage: true, open: false, onConnect: true }), { render: 1, sheet: 0 },
    "a closed Strava sheet was reopened, or Connected apps was not redrawn");
  assert.deepEqual(rerender({ sheetInPage: true, open: false, onConnect: false }), { render: 0, sheet: 0 },
    "a closed Strava sheet popped up over another screen");
  // An open sheet shows the answer, and so does the screen behind it, for when it is closed.
  assert.deepEqual(rerender({ sheetInPage: true, open: true, onConnect: true }), { render: 1, sheet: 1 },
    "an open Strava sheet, or the screen behind it, kept the old answer");
  assert.deepEqual(rerender({ sheetInPage: false, open: false, onConnect: true }), { render: 1, sheet: 0 });
});

test("\"check now\" always answers, in the sheet: still waiting puts the button back and says so", async () => {
  const checkNow = async (o: { connectedAfter: boolean; open: boolean }) => {
    const n = { sheet: 0, notes: [] as string[], toasts: [] as string[], whileChecking: "" };
    const btn: { textContent: string; disabled: boolean; onclick: null | (() => void); insertAdjacentHTML: (at: string, html: string) => void } =
      { textContent: "I’ve done that — check now", disabled: false, onclick: null,
        insertAdjacentHTML: (at: string, html: string) => { n.notes.push(at + " " + html); } };
    lift<() => void>(["wireStravaSheet"], "wireStravaSheet", {
      $: (id: string) => (id === "stvCheckLink" ? btn : id === "sheetOv" ? overlay(o.open) : id === "stvSheet" ? {} : null),
      stravaConnect: () => {}, stravaDisconnect: () => {}, stravaCfg: () => ({}), stravaSaveCfg: () => {}, haptic: () => {},
      openStravaSheet: () => { n.sheet++; },
      // The server's answer, on a later turn; stravaRefresh itself redraws only when the answer changed.
      stravaRefresh: () => new Promise((res) => setTimeout(() => res({}), 0)),
      stravaConnected: () => o.connectedAfter,
      toast: (m: string) => { n.toasts.push(m); },
    })();
    assert.ok(btn.onclick, "the check button is not wired");
    btn.onclick!();
    n.whileChecking = btn.textContent;
    await settle();
    return n;
  };
  const waiting = await checkNow({ connectedAfter: false, open: true });
  assert.equal(waiting.whileChecking, "Checking…", "the button does not say it is checking");
  assert.equal(waiting.sheet, 1, "still waiting left the button on \"Checking…\" for ever — nothing redrew the sheet");
  assert.equal(waiting.notes.length, 1, "still waiting was not explained in the sheet");
  assert.match(waiting.notes[0]!, /^afterend .*role="status".*Not connected yet\./, "the answer is not a status line under the button");
  // ⚠️ NOT A TOAST: the answer belongs beside the button it answers, and must not vanish after four seconds.
  assert.equal(waiting.toasts.length, 0, "the answer went to a toast, which is gone before the runner looks back");
  // Connected: the answer's own redraw shows it, so nothing more here.
  const connected = await checkNow({ connectedAfter: true, open: true });
  assert.deepEqual([connected.sheet, connected.notes.length], [0, 0], "a connected answer was redrawn twice, or annotated");
  // Closed while it checked: nothing reopens it.
  const closed = await checkNow({ connectedAfter: false, open: false });
  assert.deepEqual([closed.sheet, closed.notes.length], [0, 0], "a sheet closed while checking was reopened");
});
