import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE HOURLY FORECAST, added 2026-08-16 to make heat adaptation honest.
 *
 * The app fetched CURRENT conditions only. Adapting a session to "it is 16°C now" when the runner
 * goes out at two in the afternoon in 27°C is worse than not adapting at all — it would hand them a
 * pace target derived from weather they will never run in, with the app's confidence behind it.
 *
 * Two days are fetched, so a hot session can be flagged the evening before rather than only on the
 * morning of it, which is also where the competitor's flow starts.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** Lift a function out of the built page, brace-matched. */
function lift(names: string[]): string {
  const html = page();
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

/** A response in Open-Meteo's real shape: parallel arrays, local wall-clock times, no zone suffix. */
function forecast(days: string[], peakC = 31) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time: string[] = [], t2: number[] = [], rh: number[] = [], dp: number[] = [], ws: number[] = [], wc: number[] = [];
  for (const d of days) for (let h = 0; h < 24; h++) {
    time.push(d + "T" + pad(h) + ":00");
    const temp = Math.round((17 + (peakC - 17) * Math.max(0, Math.sin(((h - 6) / 12) * Math.PI))) * 10) / 10;
    t2.push(temp); rh.push(70 - (temp - 17)); dp.push(Math.round((temp - 7) * 10) / 10); ws.push(9); wc.push(0);
  }
  return { time, temperature_2m: t2, relative_humidity_2m: rh, dew_point_2m: dp, wind_speed_10m: ws, weather_code: wc };
}

function harness(nowHour: number, days: string[]) {
  const src = lift(["parseHourly", "hoursFor", "hourAt", "conditionsAtHour"]);
  const state: any = { wxHours: null };
  // A fixed local clock, so "which hours are left today" is deterministic.
  const base = new Date(2026, 7, 16, nowHour, 0, 0);
  class FakeDate extends Date {
    constructor(...a: any[]) { super(...(a.length ? (a as []) : [base.getTime()])); }
    static now() { return base.getTime(); }
  }
  const fns = new Function("state", "Date",
    src + "; return { parseHourly, hoursFor, hourAt, conditionsAtHour };")(state, FakeDate);
  state.wxHours = fns.parseHourly(forecast(days));
  return { state, ...fns };
}

const TODAY = "2026-08-16";
const TOMORROW = "2026-08-17";

test("parallel arrays are zipped into one row per hour", () => {
  const h = harness(7, [TODAY, TOMORROW]);
  assert.equal(h.state.wxHours.length, 48, "two days should give 48 rows");
  const first = h.state.wxHours[0];
  // ⚠️ Open-Meteo returns `time` plus one array per field, indexed in step. Zipping once here means
  // nothing downstream has to keep four arrays aligned and hope.
  for (const k of ["iso", "hour", "day", "tempC", "humidityPct", "dewPointC", "windKph"]) {
    assert.ok(k in first, "row is missing " + k);
  }
  assert.equal(first.day, TODAY);
  assert.equal(first.hour, 0);
});

test("hours that have already passed are never offered", () => {
  const h = harness(14, [TODAY, TOMORROW]);
  const left = h.hoursFor(null);
  // ⚠️ Offering to adapt a session for 6am at two in the afternoon is not a choice, it is a trap —
  // and the app would then be holding a stored decision keyed to weather that already happened.
  assert.ok(left.every((r: any) => r.hour >= 14), "a past hour was offered: " + JSON.stringify(left[0]));
  assert.equal(left.length, 10, "14:00 to 23:00 is ten hours");
});

test("tomorrow is offered in full, so the card can appear the night before", () => {
  const h = harness(22, [TODAY, TOMORROW]);
  assert.equal(h.hoursFor(TOMORROW).length, 24, "a future day must not be trimmed by today's clock");
  assert.equal(h.hoursFor(null).length, 2, "late at night, only the remaining hours of today");
});

test("the forecast's local wall clock never touches the UTC helpers", () => {
  const src = lift(["parseHourly", "hoursFor", "hourAt"]).replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ THE OPPOSITE RULE FROM THE REST OF THE APP, AND DELIBERATELY SO. todayIso and isoAdd are UTC
  // because a training week must not move with the clocks. A forecast asked for with timezone=auto
  // is LOCAL wall time — "2pm" has to mean 2pm where the runner is — so these strings are compared
  // as strings and never converted. Mixing the two is the fault this project has shipped three times.
  assert.ok(!/todayIso\(|isoAdd\(/.test(src),
    "the hourly forecast is local wall time and must not be run through the UTC date helpers");
  assert.ok(!/toISOString/.test(src), "converting a local forecast time to UTC would shift it by the offset");
});

test("dew point and session length both reach the engine", () => {
  const h = harness(6, [TODAY]);
  const row = h.hourAt(TODAY, 14);
  const c = h.conditionsAtHour(row, { type: "threshold", estimatedDurationSeconds: 45 * 60 });
  // ⚠️ Both are model inputs. Dropping either leaves the heat factor running on defaults — a
  // humidity-derived dew point and a notional hour — while the real numbers sit unused in state.
  assert.equal(c.dewPointC, row.dewPointC, "the forecast's own dew point must be passed through");
  assert.equal(c.minutes, 45, "the session's length must be passed through");
  assert.equal(c.sessionType, "threshold");
});

test("a session with no forecast asks for nothing rather than guessing", () => {
  const h = harness(6, [TODAY]);
  h.state.wxHours = null;
  assert.deepEqual(h.hoursFor(null), [], "no forecast must mean no hours, not a fabricated one");
  assert.equal(h.hourAt(TODAY, 14), null);
  assert.equal(h.conditionsAtHour(null, { type: "easy" }), null);
});

test("the request actually asks for hourly data and a dew point", () => {
  const html = page();
  const at = html.indexOf("api.open-meteo.com");
  assert.ok(at > 0, "the forecast request is missing");
  const url = html.slice(at - 200, at + 500);
  assert.match(url, /&hourly=/, "still fetching current conditions only");
  assert.match(url, /hourly=[^"]*dew_point_2m/, "the hourly request must include dew point");
  assert.match(url, /current=[^"]*dew_point_2m/, "the current request must include dew point too");
  assert.match(url, /forecast_days=2/, "two days, so a hot session can be flagged the evening before");
});

test("the preview presets carry a dew point, so a preview and a real forecast agree", () => {
  const html = page();
  const at = html.indexOf("const WEATHER_PRESETS");
  const src = html.slice(at, html.indexOf("};", at));
  // ⚠️ Without one, a previewed "Hot & humid" would be modelled from a humidity-derived dew point
  // while the live path used a measured one — two different answers behind the same label.
  const rows = src.split("\n").filter((l) => /tempC:/.test(l));
  assert.ok(rows.length >= 5, "expected five presets, found " + rows.length);
  for (const r of rows) assert.match(r, /dewPointC:/, "preset without a dew point: " + r.trim());
});

test("current conditions pass the dew point and duration on", () => {
  const html = page();
  const at = html.indexOf("function currentConditions(");
  const src = html.slice(at, at + 900).replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /dewPointC:/, "currentConditions drops the dew point");
  assert.match(src, /minutes:/, "currentConditions drops the session length");
});
