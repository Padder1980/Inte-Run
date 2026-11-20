import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessConditions } from "../src/environment/weather.ts";

/**
 * A SAMPLE WEATHER THE RUNNER PICKS STAYS UNTIL THEY TAP "Use my location", AND A FORECAST THAT FAILED IS NOT
 * ASKED FOR AGAIN ON EVERY REDRAW OF TODAY (2026-11-20, Road Map pc-weather-preset).
 *
 * Found by reading the code during the Connected apps flicker fix, then reproduced in the browser with the
 * location and the forecast stubbed:
 *  - the Conditions sheet's sample buttons ("Mild", "Cold"…) emptied state.wx and redrew. That render asked
 *    for the forecast again (fetchWeather asks whenever state.wx is empty), and its reply put the live
 *    forecast back about a second after the tap: the sheet read "Cold · example", then "live 9°";
 *  - a failed attempt leaves state.wx empty as well, so with location refused or no signal every redraw of
 *    Today asked again. Measured: ten redraws, ten more location requests; offline, six redraws made six
 *    location requests and six forecast requests. During a run recorded on the watch Today redraws on every
 *    update from the wrist.
 *
 * The real functions run, lifted out of the built page with the top-level lets and consts they read, and the
 * real engine prices the weather. Only the browser (render, the sheet's document), the location, the network
 * and the clock are stand-ins.
 */
const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
  .find((b) => b.includes("\nfunction fetchWeather(")) ?? "";
assert.ok(APP, "the app script is not in the build — run node web/app.ts");

/** The index of the bracket that closes the one at `open`. */
function closeOf(src: string, open: number): number {
  const o = src[open]!, c = o === "{" ? "}" : o === "[" ? "]" : ")";
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) d++;
    else if (src[i] === c) { d--; if (!d) return i; }
  }
  return assert.fail("no matching " + c + " for the " + o + " at " + open);
}
function fnOf(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  return APP.slice(at + 1, closeOf(APP, APP.indexOf("{", at)) + 1);
}
/** A top-level let or const, whole — including one whose value spans lines (WEATHER_PRESETS). */
function stmtOf(name: string): string | null {
  const m = new RegExp("\\n((?:const|let) " + name.replace(/\$/g, "\\$") + " = )").exec(APP);
  if (!m) return null;
  const start = m.index + 1, value = start + m[1]!.length;
  if (APP[value] === "{" || APP[value] === "[") return APP.slice(start, closeOf(APP, value) + 1) + ";";
  return APP.slice(start, APP.indexOf(";\n", value) + 1);
}
const nocomment = (src: string) => src.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");
/** From a top-level function to the next one: enough to ask what a very long function calls. */
function topLevel(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  const end = APP.indexOf("\nfunction ", at + 10);
  return APP.slice(at, end > at ? end : APP.length);
}

// The weather's own functions, the hero card that must only ever hear the real weather, and Alfie's answers.
const LIFTED = [
  "fetchWeather", "activeWeather", "currentConditions", "parseHourly", "wmoLabel", "wmoIcon", "hoursFor",
  "weatherSheetHtml", "wireWeatherSheet", "wxUseMyLocation", "openWeatherSheet", "wxDiagLine",
  "heatSecPerKm", "easyPaceRef", "fmtTemp", "tempUnit", "wxCreditHtml", "esc",
  "todayDecision", "alfieIntents",
];

type Mode = "ok" | "refuse" | "nosignal" | "offline";
type Weather = { tempC: number; label: string; live: boolean; humidityPct: number; windKph: number; dewPointC?: number };
type Btn = { dataset: { weather: string }; onclick: null | (() => void) };
type Lifted = {
  fetchWeather: (force?: boolean) => void;
  activeWeather: () => Weather;
  currentConditions: (s: unknown, w?: unknown) => { headline: string; severity: string };
  openWeatherSheet: () => void;
  wxDiagLine: () => string;
  todayDecision: () => { kind: string };
  alfieIntents: () => { k: string[]; a: () => string }[];
  esc: (s: unknown) => string;
};

const SESSION = { id: "2026-11-16-d4-easy", type: "easy", title: "Easy run", estimatedDurationSeconds: 2400, steps: [] };

/** What Open-Meteo answers: the current reading and 48 hours from local midnight, all at one temperature. */
function forecast(tempC: number) {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pad = (x: number) => String(x).padStart(2, "0");
  const time: string[] = [], t: number[] = [], rh: number[] = [], dp: number[] = [], wind: number[] = [], code: number[] = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(midnight + i * 3600e3);
    time.push(d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":00");
    t.push(tempC); rh.push(80); dp.push(tempC - 3); wind.push(12); code.push(3);
  }
  return {
    current: { temperature_2m: tempC, relative_humidity_2m: 80, dew_point_2m: tempC - 3, wind_speed_10m: 12, weather_code: 3 },
    hourly: { time, temperature_2m: t, relative_humidity_2m: rh, dew_point_2m: dp, wind_speed_10m: wind, weather_code: code },
  };
}

/** The app on Today, set up, with a real forecast of `tempC` one location answer away. */
function app(opts: { mode?: Mode; tempC?: number } = {}) {
  let mode: Mode = opts.mode ?? "ok";
  const tempC = opts.tempC ?? 9;
  let clock = Date.now();
  // Only Date.now() is moved by the test; new Date() still reads the real time, as hoursFor wants.
  class Clock extends Date { static override now() { return clock; } }
  const n = { asks: 0, fetches: 0, renders: 0 };
  // Answers arrive on a later turn, as real ones do — or are held until release(), to land one mid-sheet.
  let hold = false;
  const held: (() => void)[] = [];
  const later = (fn: () => void) => { if (hold) held.push(fn); else setTimeout(fn, 0); };
  const state: Record<string, unknown> = { tab: "today", screen: null, weather: "hot", wx: null, wxSample: false, wxHours: null, selDay: 3 };
  const sheet = { innerHTML: "" };
  let presets: Record<string, Btn> = {};
  let useLoc: { onclick: null | (() => void) } | null = null;
  let squareFrom: Weather | null = null;
  let fns: Lifted | null = null;
  // The real render() on Today asks fetchWeather() and then draws the screen, whose conditions square reads
  // activeWeather() (the last test holds this stand-in to the real render and the real square).
  const render = () => {
    n.renders++;
    if (state.tab === "today" && !state.screen && fns) { fns.fetchWeather(); squareFrom = fns.activeWeather(); }
  };
  const scope: Record<string, unknown> = {
    state, render, Date: Clock,
    document: {
      querySelectorAll: (sel: string) => {
        if (sel !== "#sheetBody [data-wxseg] button") return [];
        presets = {};
        for (const m of sheet.innerHTML.matchAll(/<button data-weather="(\w+)"/g)) presets[m[1]!] = { dataset: { weather: m[1]! }, onclick: null };
        return Object.values(presets);
      },
      querySelector: () => null,
    },
    $: (id: string) => {
      if (id === "sheetBody") return sheet;
      if (id === "sheetOv") return { classList: { add: () => {}, remove: () => {}, contains: () => true } };
      if (id === "wxUseLoc") return sheet.innerHTML.includes('id="wxUseLoc"') ? (useLoc = { onclick: null }) : null;
      return null;
    },
    profile: { personalized: true },
    RC: { assessConditions },
    RAW: { paces: { easy: { minSecPerKm: 330, maxSecPerKm: 370 } } },
    PLAN: { paces: {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    ensureSheet: () => {},
    conditionsSession: () => SESSION, selectedSession: () => SESSION,
    navigator: {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void, err: (e: unknown) => void) => {
          n.asks++;
          const m = mode;
          later(() => {
            if (m === "refuse") err({ code: 1 });
            else if (m === "nosignal") err({ code: 2 });
            else ok({ coords: { latitude: 54.973, longitude: -1.614 } });
          });
        },
      },
    },
    fetch: (url: string) => {
      assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/, "an unexpected request: " + url);
      n.fetches++;
      const m = mode;
      return new Promise((res, rej) => later(() => {
        if (m === "offline") rej(new TypeError("Load failed"));
        else res({ ok: true, status: 200, json: () => Promise.resolve(forecast(tempC)) });
      }));
    },
    // The hero card's surroundings: an ordinary planned run, today, not yet done.
    racePassed: () => false, TODAY_IN_PLAN: true, TODAY_DOW: 3, isCurrentWeek: () => true,
    rawSessionDone: () => false, curWeek: () => ({ startIso: "2026-11-16" }), todayNextUp: () => null,
    sessionTimeAt: () => null, isoAdd: (iso: string, d: number) => new Date(Date.parse(iso + "T00:00:00Z") + d * 864e5),
    DAY_ORDER: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], dmon: () => "",
  };
  const keys = Object.keys(scope);
  const bodies = LIFTED.map(fnOf);
  // The top-level lets and consts the weather functions read, taken from the page rather than listed here, so
  // a flag or clock the fix depends on travels with it. In declaration order, as the page has them.
  const weatherBodies = nocomment(bodies.slice(0, LIFTED.indexOf("todayDecision")).join("\n"));
  const decls = [...APP.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = /gm)]
    .map((m) => m[1]!)
    .filter((name, i, all) => all.indexOf(name) === i && !keys.includes(name) && !LIFTED.includes(name) &&
      new RegExp("\\b" + name.replace(/\$/g, "\\$") + "\\b").test(weatherBodies))
    .map((name) => stmtOf(name)!)
    .sort((a, b) => APP.indexOf("\n" + a) - APP.indexOf("\n" + b));
  const src = [...decls, ...bodies].join("\n") +
    "\nreturn { fetchWeather, activeWeather, currentConditions, openWeatherSheet, wxDiagLine, todayDecision, alfieIntents, esc };";
  // eslint-disable-next-line no-new-func
  fns = new Function(...keys, src)(...keys.map((k) => scope[k])) as Lifted;
  const live = fns;
  const sheetSays = () => ({
    kind: (sheet.innerHTML.match(/<div class="sd-type"[^>]*>([^<]*)<\/div>/) || [])[1] ?? "",
    title: (sheet.innerHTML.match(/<div class="sd-title">([^<]*)<\/div>/) || [])[1] ?? "",
    line: (sheet.innerHTML.match(/<div class="wx-src[^"]*">([\s\S]*?)<\/div>/) || [])[1]?.replace(/<[^>]+>/g, "") ?? "",
    lit: (sheet.innerHTML.match(/<button data-weather="(\w+)" class="on">/) || [])[1] ?? null,
  });
  return {
    n, state, live, sheetSays,
    square: () => squareFrom,
    setMode: (m: Mode) => { mode = m; },
    pass: (ms: number) => { clock += ms; },
    holdAnswers: () => { hold = true; },
    release: () => { hold = false; held.splice(0).forEach((f) => setTimeout(f, 0)); },
    boot: () => render(),
    redraw: () => render(),
    openConditions: () => live.openWeatherSheet(),
    tapSample: (k: string) => {
      const b = presets[k];
      assert.ok(b && b.onclick, "the sheet has no wired sample button " + k);
      b.onclick();
    },
    tapUseMyLocation: () => {
      assert.ok(useLoc && useLoc.onclick, "the sheet shows no wired Use my location button");
      useLoc.onclick();
    },
  };
}

/** Long enough for any answer, and any second round of asking, to land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
}

test("BLOCKER: a sample the runner picks stays on screen — the redraw after the tap asks for nothing", async () => {
  const a = app({ tempC: 9 });
  a.boot();
  await settle();
  assert.equal(a.square()?.live, true, "the fixture never got its live forecast");
  a.openConditions();
  await settle();
  assert.match(a.sheetSays().kind, /live/, "the sheet did not open on the live forecast");
  const asked = a.n.asks;
  a.tapSample("cold");
  await settle();
  assert.equal(a.n.asks, asked, "picking a sample asked for the location again — its reply puts the live forecast back");
  assert.match(a.sheetSays().kind, /example/, "the sheet no longer shows the picked sample: " + a.sheetSays().kind);
  assert.match(a.sheetSays().title, /1°C, wind 16 km\/h/, "the sheet shows " + a.sheetSays().title + ", not the Cold sample");
  assert.equal(a.sheetSays().lit, "cold", "the Cold button is not lit");
  assert.equal(a.square()?.label, "Cold", "Today's conditions square does not show the picked sample");
  a.redraw(); a.redraw(); a.redraw();
  await settle();
  assert.equal(a.square()?.label, "Cold", "a later redraw of Today threw the picked sample away");
  assert.equal(a.n.asks, asked, "redrawing Today with a sample on show asked for the forecast again");
  // ⚠️ AND THE LIVE READING IS KEPT UNDERNEATH, not emptied: the warm-up reads its temperature straight from
  // state.wx, and the hero's heat warning and Alfie's "right now" read it there too (the test below).
  assert.equal((a.state.wx as Weather | null)?.tempC, 9, "picking a sample threw away the live reading the warm-up reads");
});

test("BLOCKER: a forecast already on its way when the sample is picked does not undo it either", async () => {
  const a = app({ tempC: 9 });
  a.boot();
  await settle();
  a.holdAnswers();
  a.openConditions(); // opening Conditions asks for a fresh forecast…
  await settle();
  a.tapSample("windy"); // …and the runner picks a sample before it lands
  a.release();
  await settle();
  assert.match(a.sheetSays().title, /14°C, wind 42 km\/h/, "the forecast that landed after the pick replaced it: " + a.sheetSays().title);
  assert.equal(a.square()?.label, "Windy", "Today's square went back to the live forecast");
});

test("opening Conditions again keeps the sample, and never claims to be reading the forecast over it", async () => {
  const a = app({ tempC: 9 });
  a.boot();
  await settle();
  a.openConditions();
  await settle();
  a.tapSample("warm");
  a.holdAnswers();
  a.openConditions(); // a refresh starts underneath
  assert.doesNotMatch(a.sheetSays().line, /Reading your local forecast/,
    "the sheet promises the live forecast is coming, over a sample the runner chose");
  assert.match(a.sheetSays().line, /Use my location/, "the way back to the live forecast is missing");
  a.release();
  await settle();
  assert.match(a.sheetSays().title, /22°C, wind 10 km\/h/, "reopening Conditions threw the sample away: " + a.sheetSays().title);
});

test("Use my location ends the sample: the live reading is back at once, and refreshed", async () => {
  const a = app({ tempC: 9 });
  a.boot();
  await settle();
  a.openConditions();
  await settle();
  a.tapSample("hot");
  await settle();
  const asked = a.n.asks;
  a.tapUseMyLocation();
  assert.match(a.sheetSays().kind, /live/, "Use my location did not bring the live forecast back");
  assert.match(a.sheetSays().title, /9°C, wind 12 km\/h/, "the sheet does not show the live 9°: " + a.sheetSays().title);
  assert.equal(a.square()?.live, true, "Today's square behind the sheet still shows the sample");
  assert.equal(a.n.asks, asked + 1, "Use my location did not ask for a fresh forecast");
  await settle();
  assert.equal(a.state.wxSample, false);
  assert.match(a.live.wxDiagLine(), /^forecast: live/, "the diagnostic line does not say live: " + a.live.wxDiagLine());
});

test("a forecast that lands while Conditions is open reaches Today's square behind it as well", async () => {
  // Measured before the fix: the sheet said "live 9°" while the square behind it still said "Cold · example",
  // and still did once the sheet was closed — the answer redrew the sheet OR Today, never both.
  const a = app({ mode: "offline" });
  a.boot();
  await settle();
  assert.equal(a.square()?.live, false, "the fixture should start with no forecast");
  a.setMode("ok");
  a.openConditions(); // a tap asks at once, whatever the retry clock says
  await settle();
  assert.match(a.sheetSays().kind, /live/, "the forecast did not reach the open sheet");
  assert.equal(a.square()?.live, true, "the forecast reached the sheet but not Today's square behind it");
});

test("BLOCKER: with location refused, redrawing Today asks nothing more — a tap on Conditions still asks", async () => {
  const a = app({ mode: "refuse" });
  a.boot();
  await settle();
  assert.equal(a.n.asks, 1, "Today did not ask at launch");
  for (let i = 0; i < 10; i++) { a.redraw(); await settle(); }
  assert.equal(a.n.asks, 1, "ten redraws asked for the location " + (a.n.asks - 1) + " more times after it was refused");
  // A refusal can only be undone in iOS Settings, so the runner's own tap is what asks again.
  a.pass(24 * 3600e3);
  a.redraw();
  await settle();
  assert.equal(a.n.asks, 1, "a refused location was asked for again by itself");
  assert.match(a.live.wxDiagLine(), /location refused/, "the diagnostic line does not say it was refused");
  assert.match(a.live.wxDiagLine(), /asks again only when tapped/, "the diagnostic line does not say when it asks again");
  a.openConditions();
  await settle();
  assert.equal(a.n.asks, 2, "opening Conditions no longer asks — the runner would have no way to try again");
  assert.match(a.sheetSays().line, /Use my location/, "after the refusal the sheet offers no way to try again");
});

test("BLOCKER: with no signal, redrawing Today waits ten minutes before asking again, then asks once", async () => {
  for (const mode of ["offline", "nosignal"] as const) {
    const a = app({ mode });
    a.boot();
    await settle();
    const first = { asks: a.n.asks, fetches: a.n.fetches };
    assert.equal(first.asks, 1, mode + ": Today did not ask at launch");
    for (let i = 0; i < 6; i++) { a.redraw(); await settle(); }
    assert.deepEqual({ asks: a.n.asks, fetches: a.n.fetches }, first,
      mode + ": six redraws asked again after a failure — every update from the watch would");
    assert.match(a.live.wxDiagLine(), /asks again in 10m/, mode + ": the diagnostic line does not say when: " + a.live.wxDiagLine());
    a.pass(9 * 60e3);
    a.redraw();
    await settle();
    assert.equal(a.n.asks, 1, mode + ": asked again after nine minutes");
    // Ten minutes on, the signal is back: the next redraw asks once, and the forecast arrives.
    a.pass(61e3);
    a.setMode("ok");
    a.redraw(); a.redraw();
    await settle();
    assert.equal(a.n.asks, 2, mode + ": did not ask again once ten minutes had passed, or asked more than once");
    assert.equal(a.square()?.live, true, mode + ": the forecast that came back is not on Today");
    assert.doesNotMatch(a.live.wxDiagLine(), /asks again/, mode + ": a success left the retry clock running");
  }
});

test("BLOCKER: a preview may not raise a heat warning, or hide one — the hero and Alfie hear the real weather", async () => {
  // A real 33° day: the hero card warns. Previewing "Mild" must not take the warning away.
  const hot = app({ tempC: 33 });
  hot.boot();
  await settle();
  assert.equal(hot.live.todayDecision().kind, "risk", "the fixture's 33° day does not raise the hero's heat warning");
  const realHeadline = hot.live.currentConditions(SESSION, hot.state.wx).headline;
  hot.openConditions();
  await settle();
  hot.tapSample("mild");
  await settle();
  assert.equal(hot.square()?.label, "Mild", "the preview is not on Today's square");
  assert.equal(hot.live.todayDecision().kind, "risk", "previewing Mild hid the real heat warning on the hero card");
  const heat = hot.live.alfieIntents().find((x) => x.k.includes("heat"));
  assert.ok(heat, "Alfie has no heat answer");
  assert.ok(heat.a().includes("rates conditions as <b>" + hot.live.esc(realHeadline) + "</b>"),
    "Alfie's \"right now\" describes the sample being previewed, not the real weather");
  // A real 9° day: no warning. Previewing "Hot & humid" must not raise one.
  const cool = app({ tempC: 9 });
  cool.boot();
  await settle();
  assert.equal(cool.live.todayDecision().kind, "scheduled", "the fixture's 9° day already warns");
  cool.openConditions();
  await settle();
  cool.tapSample("hot");
  await settle();
  assert.equal(cool.square()?.label, "Hot & humid", "the preview is not on Today's square");
  assert.equal(cool.live.todayDecision().kind, "scheduled", "previewing Hot & humid turned the hero card red from example weather");
});

test("the harness is the app's own path: Today's render asks fetchWeather and its square reads activeWeather", () => {
  assert.match(nocomment(topLevel("render")), /if \(state\.tab === "today"\) \{ fetchWeather\(\); v\.innerHTML = viewToday\(\);/,
    "render() no longer asks for the forecast on Today the way this file's stand-in does");
  assert.match(nocomment(fnOf("conditionsSquare")), /const w = activeWeather\(\);/, "the conditions square no longer reads activeWeather()");
  assert.match(nocomment(topLevel("wire")), /const condSq = \$\("condSq"\); if \(condSq\) condSq\.onclick = openWeatherSheet;/,
    "the conditions square no longer opens the Conditions sheet");
  // Every button that asks for the runner's own forecast ends a sample the same way.
  const heat = nocomment(topLevel("wireHeatControls"));
  assert.match(heat, /\[data-heatfetch\]"\)\.forEach\(\(b\) => b\.onclick = \(\) => \{ wxUseMyLocation\(\);/, "Get my local forecast no longer ends a sample");
  assert.match(heat, /if \(!hoursFor\(null\)\.length\) \{ wxUseMyLocation\(\);/, "the heat block's Try again no longer ends a sample");
  assert.doesNotMatch(heat, /fetchWeather\(true\)/, "a heat button asks for the forecast while leaving a sample on screen");
});
