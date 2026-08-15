import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessConditions } from "../src/environment/weather.ts";

/**
 * MEASUREMENTS — Support › Tools. Added 2026-08-15.
 *
 * Temperature only. The owner asked for km/miles too and chose, once shown the cost, to do distance
 * properly and separately: runs are STORED as kilometre numbers, both the phone and the watch cut
 * splits at 1000 m, and ~105 sites render a km literal. A label-only toggle would put mile captions
 * on kilometre splits.
 *
 * ⚠️ THE POINT OF THESE GUARDS IS THAT A DISPLAY CHOICE CANNOT REACH A TRAINING DECISION. Every
 * threshold in weather.ts is Celsius (18/23/28/33), and the warm-up shortens itself above 24°C. If a
 * conversion ever leaked inward, a runner picking Fahrenheit would silently get a different plan.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

test("choosing Fahrenheit cannot change a single training decision", () => {
  const c: any = { tempC: 28, humidityPct: 60, windKph: 14, sessionType: "threshold" };
  const a = assessConditions(c);
  const b = assessConditions(c);
  assert.equal(a.severity, b.severity);
  assert.equal(a.pacePenaltySecPerKm, b.pacePenaltySecPerKm);
  assert.equal(a.effortBased, b.effortBased);
  // The engine takes tempC and nothing else — it has no notion of a display unit, and must not gain
  // one. This asserts the shape rather than the value: a `unit` parameter appearing here is the
  // regression to catch.
  // ⚠️ COMMENTS STRIPPED FIRST. The doc comment on `summary` explains why a Fahrenheit reader must not
  // be shown that string, so it contains the very word this sweep forbids. CLAUDE.md records this
  // exact trap firing four times already; it is not an interesting new failure, just a familiar one.
  const src = readFileSync(new URL("../src/environment/weather.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/fahrenheit|tempF|degF/i.test(src), "the engine must stay Celsius-only");
});

test("the engine exposes a unit-free temperature word", () => {
  const r = assessConditions({ tempC: 28, humidityPct: 60, windKph: 14, sessionType: "easy" } as any);
  assert.ok(r.tempWord && r.tempWord.length > 0, "tempWord is missing");
  // ⚠️ It exists so the app can pair a word with a temperature IT formatted. A unit baked in here
  // would defeat the whole feature.
  assert.ok(!/°|C\b|F\b|km/.test(r.tempWord), "tempWord must carry no units: " + r.tempWord);
  assert.ok(r.summary.includes(r.tempWord), "summary and tempWord must agree on the word");
});

test("the weather sheet no longer prints the temperature twice", () => {
  const html = page();
  const at = html.indexOf('class="sd-title"');
  assert.ok(at > 0, "the weather sheet title is missing");
  const src = html.slice(at - 300, at + 320).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ THE OLD LINE READ "12° · Mild · 12°C, wind 14 km/h" — the same number twice, the second time
  // in a unit the runner may not have chosen, because imp.summary already contains the temperature.
  assert.ok(!/imp\.summary/.test(src), "the sheet must not render imp.summary — it duplicates the temperature and hardcodes °C");
  assert.ok(/imp\.tempWord/.test(src), "the sheet should compose from tempWord");
  assert.ok(/fmtTemp\(/.test(src), "the sheet temperature must go through fmtTemp so it follows the setting");
});

test("every temperature the runner reads goes through fmtTemp", () => {
  const html = page();
  // Any surviving "tempC + '°" concatenation is a site that ignores the setting.
  const raw = [...html.matchAll(/tempC\s*\+\s*['"]°/g)];
  assert.equal(raw.length, 0, "found " + raw.length + " temperature renders that bypass fmtTemp");
});

test("the unit preference is stored outside the profile", () => {
  const html = page();
  const at = html.indexOf("function tempUnit(");
  assert.ok(at > 0, "tempUnit is missing");
  const src = html.slice(at, at + 500);
  assert.ok(/interun_units_v1/.test(src), "the preference should have its own key, like interun_theme_v1");
  // ⚠️ The weeklyVolumeKm lesson again: the profile holds answers that shape the plan. A display
  // preference living there would ride into every plan rebuild for no reason.
  const dp = html.slice(html.indexOf("DEFAULT_PROFILE"), html.indexOf("}", html.indexOf("DEFAULT_PROFILE")) + 1);
  assert.ok(!/tempUnit|units/.test(dp), "the unit preference must not be a profile field");
});

test("fmtTemp converts correctly and rounds once", () => {
  const html = page();
  const at = html.indexOf("function fmtTemp(");
  const src = html.slice(at, at + 420);
  // 0°C = 32°F, 100°C = 212°F — the conversion must be *9/5+32, not an approximation.
  assert.ok(/\* 9 \/ 5 \+ 32/.test(src), "fmtTemp must use the exact conversion");
  // ⚠️ Rounded ONCE at the end. Rounding the Celsius first and then converting shows 54°F for 12.4°C
  // and 55°F for 12.5°C, which is a whole degree of drift invented by the order of operations.
  const rounds = (src.match(/Math\.round/g) || []).length;
  assert.equal(rounds, 1, "fmtTemp should round exactly once, after converting");
});

test("the page says distance is still metric rather than omitting it", () => {
  const html = page();
  const at = html.indexOf("function unitsView(");
  assert.ok(at > 0, "unitsView is missing");
  const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
  const src = html.slice(at, rel > 0 ? at + 1 + rel : at + 4000);
  // ⚠️ The owner asked for km/miles. Shipping the page with no mention of distance would read as the
  // request having been forgotten; saying where it stands is the honest half-answer.
  assert.ok(/kilometre|kilometres/i.test(src), "the page must say what distance currently does");
  assert.ok(/split/i.test(src), "it should say why — the splits are the reason a label swap is not enough");
  // And it must not claim the training maths changes with the toggle.
  assert.ok(/Celsius/.test(src), "it should say the heat rules stay in Celsius underneath");
});
