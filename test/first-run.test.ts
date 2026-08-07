import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ WHAT A STRANGER MEETS IN THEIR FIRST MINUTE.
 *
 * The owner has used this daily for weeks, which makes him the worst possible judge of first run —
 * his phone is full of his profile, his plan and his runs, and a tester arrives with none of it. Both
 * faults below were found by driving the real UI from an empty localStorage before a TestFlight
 * build, and both cost a tester's goodwill in the first minute rather than throwing anything.
 */
const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
function lift(name: string) {
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}

test("⚠️ the app never asks for location before the runner knows what it is", () => {
  // ⚠️ render() runs synchronously at boot with state.tab === "today", so fetchWeather reached
  // getCurrentPosition about 50ms into the FIRST EVER launch — over the splash, two seconds before
  // "Welcome to Inte-Run" was readable, for a WEATHER lookup worded as being for a run.
  // A tester who taps "Don't Allow" to a prompt they cannot place has killed GPS for their first real
  // run, recoverable only in iOS Settings. The report you get is "the tracking doesn't work".
  const body = lift("fetchWeather");
  const gate = body.indexOf("!profile.personalized");
  const geo = body.indexOf("getCurrentPosition");
  assert.ok(gate > 0, "fetchWeather no longer waits for setup — it will prompt over the splash again");
  assert.ok(gate < geo, "the setup gate sits AFTER the location call, so it gates nothing");

  // Simulate the three cases rather than trusting the ordering alone.
  let asked = 0;
  const run = (personalized: boolean, force: boolean) => {
    asked = 0;
    const fn = new Function("profile", "state", "WX_FETCHING", "navigator", "fetch", "wxRender",
      body + "; return fetchWeather;")(
        { personalized }, { wx: null }, false,
        { geolocation: { getCurrentPosition: () => { asked++; } } },
        () => new Promise(() => {}), () => {});
    fn(force);
    return asked;
  };
  assert.equal(run(false, false), 0, "a brand-new install still prompts for location at launch");
  assert.equal(run(false, true), 1, "tapping the weather card does nothing — a dead card is its own bug");
  assert.equal(run(true, false), 1, "weather stopped working for a set-up runner");
});

test("⚠️ every screen built from the example plan says it is an example", () => {
  // ⚠️ The banner lived only on Today — and Today is not where a new tester looks. A fresh install
  // opens into setup with the bottom nav live, so tapping the second tab lands on Plan having never
  // seen the word "example". What they read there is a personal fitness prediction about a runner the
  // app has never met — "Current fitness predicts 1:55:00 for the half" under the heading "Your plan"
  // — every figure of it invented from DEFAULT_PROFILE.
  assert.ok(html.includes("function examplePlanBanner("),
    "the banner is no longer a shared builder, so a screen can show the example plan silently again");
  const banner = lift("examplePlanBanner");
  assert.match(banner, /if \(profile\.personalized\) return "";/,
    "the banner would show to a runner who HAS set up");

  // Both screens that render plan figures must call it.
  for (const view of ["viewToday", "viewPlan"]) {
    assert.match(lift(view), /examplePlanBanner\(\)/,
      `${view} renders the example plan without saying so`);
  }
});

test("the example banner is honest about what the numbers are", () => {
  // "Example plan" alone reads as a template. The figures are a specific invented runner, and a
  // beginner told the app predicts them a 1:55 half either believes it or stops trusting the app.
  const banner = lift("examplePlanBanner");
  assert.match(banner, /demonstration|not about you/i,
    "the banner does not say the NUMBERS are invented, only that the plan is an example");
  assert.match(banner, /Set up/, "there is no way out of the example state from the banner");
});
