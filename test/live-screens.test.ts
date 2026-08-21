import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE TWO SCREENS A PHONE-RECORDED RUN BEGINS AND ENDS ON.
 *
 * Built to the owner's annotated references, 2026-08-21. He photographed another app's start screen and
 * drew arrows at the things he wanted: the session and its first step, the numbers, an active-shoe chip,
 * a GPS signal indicator, map zoom and recentre controls, and one Start. Then its finish screen: the
 * run's name, its description, private notes, a "sync to applications" block, Discard and Save.
 *
 * ⚠️ THE CLAIMS HERE ARE ABOUT WIRING AND ABOUT HONESTY, not about pixels. A control that renders and
 * does nothing is the defect this project has shipped three times, and it is exactly what a screen built
 * from a screenshot invites — the reference has a zoom button, so ours grows a zoom button, and nothing
 * about the markup says whether it zooms.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
function fn(name: string): string {
  const src = page();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error(name + " is unbalanced");
}
const nocomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("BLOCKER: every control on the start screen is reached by a handler", () => {
  // ⚠️ THE ID GUARD PROVES AN ID RESOLVES AND CANNOT PROVE A CONTROL IS CONNECTED TO ANYTHING. Both of
  // this project's worst UI defects were live-looking and inert: the debrief's overflow button sat where
  // every iOS app puts its actions and did nothing, and the profile confirm clicked a #saveSetup that
  // was nowhere in the app. A screen copied from a screenshot is the likeliest place for a third.
  const src = page();
  // ⚠️ BUTTONS ONLY, AND THE FIRST VERSION SWEPT EVERY id. It flagged #lMapWrap — the panel the map is
  // drawn into — as an unwired control, which is a container and has nothing to wire. A guard that
  // reports a correct thing as broken is one somebody deletes.
  const ids = [...fn("viewLiveStart").matchAll(/<button[^>]*id="(l[A-Za-z]+)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 6, "the start screen renders " + ids.length + " controls; expected at least six");
  const wiring = nocomment(src);
  for (const id of ids) {
    assert.ok(new RegExp('\\$\\("' + id + '"\\)').test(wiring),
      "the start screen renders #" + id + " and no handler ever looks it up");
  }
  // ⚠️ AND EACH ONE REACHES SOMETHING THAT EXISTS. A handler assigned to a function nobody defined is
  // the invented-identifier trap, which this app has now hit six times.
  for (const call of ["liveMapZoom", "drawLiveMap"]) {
    assert.ok(src.indexOf("function " + call + "(") > 0, call + " is called but never defined");
  }
});

test("BLOCKER: the zoom controls are clamped, and recentre puts the runner back in the middle", () => {
  const z = fn("liveMapZoom");
  assert.match(z, /LIVE_MAP_Z_MIN/, "zooming out is unbounded, so a street becomes a pixel");
  assert.match(z, /LIVE_MAP_Z_MAX/, "zooming in is unbounded, so there is no context left");
  const src = page();
  const zs = /LIVE_MAP_Z = (\d+), LIVE_MAP_Z_MIN = (\d+), LIVE_MAP_Z_MAX = (\d+)/.exec(src);
  assert.ok(zs, "the zoom constants are gone");
  const def = Number(zs![1]), lo = Number(zs![2]), hi = Number(zs![3]);
  assert.ok(lo < def && def < hi, "the default zoom is not inside its own range: " + [lo, def, hi]);
  // ⚠️ RECENTRE CLEARS THE OVERRIDE. Its job is "put me back in the middle at a sensible scale"; keeping
  // a zoom the runner had wandered away from leaves them looking at a street they are not on.
  assert.match(nocomment(page()), /lRecentre[\s\S]{0,200}?LIVE\.mapZ = null/,
    "recentre redraws without clearing the zoom override");
});

test("BLOCKER: the start screen's map goes through the cache, and only towards the free provider", () => {
  // ⚠️ THIS IS THE ONE THAT COST SOMETHING TO LEARN. It was written calling loadRouteMap directly, and
  // test/route-map-cache.test.ts caught it: a second caller of the tile fetcher re-fetches billed tiles
  // on every view, which is the bill the whole one-render design exists to prevent.
  const live = fn("liveMapFor");
  assert.match(live, /routeMapFor\(/, "the live map fetches tiles itself instead of going through the cache");
  assert.ok(!/loadRouteMap\(/.test(live), "the live map is calling the tile fetcher directly again");
  // ⚠️ AND IT DOES NOT FOLLOW A MOVING RUNNER. A map that tracked the run would be a tile fetch every
  // few seconds for its whole length.
  const draw = fn("drawLiveMap");
  assert.match(draw, /LIVE\.started/, "the map is drawn during the run, which is a tile fetch per tick");
  // ⚠️ THE EARLY RETURN, NOT THE MENTION. The first version of this asserted that LIVE.mapKey appears
  // in the function — and it appears in the ASSIGNMENT too, so deleting the guard that reads it left
  // this green while every tick re-fetched. A source assertion proves a string exists and never that
  // anything acts on it.
  assert.match(draw, /if \(!force && LIVE\.mapKey === key\) return;/,
    "the same position re-fetches, so a jittering fix costs a tile fetch several times a second");
  // ⚠️ AND THE KEY IS ROUNDED, or the guard is satisfied by a key that changes on every fix anyway.
  assert.match(draw, /Math\.round\(LIVE\.lastLat \* \d+\)/,
    "the map key is built from the raw coordinate, so it changes with every jitter");
  // ⚠️ AND THE ATTRIBUTION IS THE PROVIDER THAT SERVED THE TILES, not the one we would prefer.
  // Crediting Mapbox over CARTO's tiles is a licence breach this project has made once already.
  assert.match(draw, /mapAttributionFor\(r\.prov\)/,
    "the live map credits a provider it did not necessarily use");
});

test("BLOCKER: the signal indicator says nothing when there is no fix", () => {
  // ⚠️ ONE LIT BAR AND NO FIX ARE DIFFERENT SITUATIONS NEEDING DIFFERENT REACTIONS. A weak signal is
  // something to wait out; no signal at all may mean permission was refused.
  const bars = fn("gpsBarsHtml");
  assert.match(bars, /LIVE\.acc != null/, "the bars are drawn without checking there is an accuracy at all");
  assert.match(bars, /lit = acc == null \? 0/, "no fix lights a bar, which reads as a weak signal");
  // ⚠️ THE NUMBER STAYS BESIDE THE BARS. This project's history is full of plausible-looking readouts
  // that hid the fault; the metres are what make the claim falsifiable.
  assert.match(bars, /gpsStatusText\(\)/, "the accuracy in metres is no longer shown beside the bars");
});

test("BLOCKER: the finish screen's name reaches the record, and blank falls back to the title", () => {
  const rec = fn("liveRunRecord");
  assert.match(rec, /sm\.name/, "the run is always saved under the prescription's title, so renaming does nothing");
  assert.match(rec, /LIVE\.session\.title/, "a blank name would be saved, which is unfindable in the Logbook");
  // ⚠️ IT PARKS ON THE SUMMARY BEFORE SAVE, like the note and the effort rating, because this record is
  // rebuilt on every render of the finish screen.
  assert.match(nocomment(page()), /runName[\s\S]{0,320}?LIVE\.summary\.name = runName\.value/,
    "the typed name is not parked on the summary, so Save discards it");
});

test("BLOCKER: one Strava preference, and no toggle for something that does not exist", () => {
  // ⚠️ THE SETTING ALREADY EXISTED. stravaCfg().auto is what stravaMaybeAutoSend reads at save time and
  // Connections has had a switch for it since the Strava work — a second key would have given one
  // preference two homes, with only one of them deciding anything.
  const get = fn("stravaAutoSend"), set = fn("stravaAutoSet");
  assert.match(get, /stravaCfg\(\)\.auto/, "the finish screen reads its own Strava preference");
  assert.match(set, /stravaSaveCfg/, "the finish screen writes its own Strava preference");
  // ⚠️ THE KEY, NOT THE WORD. Written as a case-insensitive search for "stravaauto" this matched the
  // names of the two functions immediately above — stravaAutoSend and stravaAutoSet — and reported the
  // fix as the defect. Sixth firing of this project's own guard-trips-on-its-own-vocabulary trap.
  assert.ok(!/interun_stravaauto/.test(page()),
    "a second Strava preference key is back in the build, so one setting has two homes");
  // ⚠️ EACH ROW APPEARS ONLY WHERE IT CAN ACTUALLY DO SOMETHING. Strava when connected (the reason
  // stravaRunButtonHtml already records: a greyed-out row advertises a feature nobody set up), Health
  // where the native side says it can write. A switch over nothing is the inert control this row exists
  // to avoid, and this file's previous version asserted Health was ABSENT for exactly that reason —
  // it is built now, so the claim moves from "not offered" to "offered only where it works".
  const sync = fn("liveSyncHtml");
  assert.match(sync, /stravaConnected\(\)/,
    "the sync block offers Strava to somebody who has not connected it");
  assert.match(sync, /healthAvailable\(\)/,
    "the sync block offers Apple Health without checking this build can write to it");
  assert.match(sync, /if \(!rows\.length\) return ""/,
    "an empty sync block is still drawn, so the card has a heading and nothing under it");
  // ⚠️ ONE ROW BUILDER, so a third destination cannot arrive with a different shape or an unlabelled
  // switch — every switch here needs a role and an accessible name to be operable at all.
  const row = fn("syncRowHtml");
  assert.match(row, /role="switch"/, "the sync switches are not switches to a screen reader");
  assert.match(row, /aria-checked/, "a sync switch does not say whether it is on");
  assert.match(row, /aria-label="' \+ esc\(aria\)/, "a sync switch has no accessible name");
});

test("BLOCKER: a watch run is never written to Health, because the watch already wrote it", () => {
  // ⚠️⚠️ THIS IS THE ONE THAT WOULD HURT. watchOS runs a real HKWorkoutSession, so a wrist run is in
  // Health before the phone has even been told it happened. Writing it again gives the runner TWO
  // workouts for one run — double distance in their week, double energy in their rings — and the
  // duplicate looks exactly as legitimate as the original.
  const send = fn("healthSendRun");
  assert.match(send, /run\.source === "watch"/,
    "a wrist run can be written to Health a second time, on top of the one the watch saved");
  assert.match(send, /run\.sim/, "a simulated run can be written to Health, and its distance is invented");
  // ⚠️ AND AN UNKNOWN START IS A REFUSAL, NOT A GUESS. runStartMs answers that date at 09:00 when it
  // does not know, which would put the workout hours from where it happened in somebody's day — worse
  // here than in a GPX, because Health is where a person looks to see what they did when.
  assert.match(send, /runStartExactMs\(run\)/, "the workout's start is guessed rather than known");
  assert.match(send, /startMs == null\) return/, "a run with no known start is written at a made-up time");
  // ⚠️ AND THE NATIVE SIDE REFUSES A REPEAT TOO. The finish screen allows Save more than once and a
  // re-render can produce it; HealthKit has no upsert.
  const swift = readFileSync(new URL("../ios/InteRun/HealthKitService.swift", import.meta.url), "utf8");
  assert.match(swift, /written\.contains\(id\)/, "the same run can be written to Health twice");
  assert.match(swift, /HKMetadataKeyExternalUUID/,
    "the workout carries no id, so a duplicate cannot be identified rather than merely suspected");
});

test("BLOCKER: Health is asked for at the moment it is needed, and nothing is invented to fill a field", () => {
  const swift = readFileSync(new URL("../ios/InteRun/HealthKitService.swift", import.meta.url), "utf8");
  // ⚠️ NOT AT LAUNCH. A Health prompt on first open, before the runner has recorded anything, is a
  // prompt with no context — and from the app's point of view a refusal is permanent.
  assert.ok(!/requestAuthorization/.test(fnOfSwift(swift, "capabilityJS")),
    "authorisation is requested just to answer whether Health exists");
  assert.match(swift, /func save\([\s\S]{0,1400}?requestAuthorization/,
    "authorisation is not requested on the save path, so the first write fails");
  // ⚠️ AND NOTHING IS FABRICATED. No route means no route; no distance means no distance sample. A zero
  // would be a measurement, and this data goes into somebody's medical app under their name.
  assert.match(swift, /pts\.count >= 2 else \{ return \}/, "a route is written from fewer than two points");
  assert.match(swift, /km > 0/, "a zero distance is written to Health as a measurement");
  assert.match(swift, /locationType = indoor \? \.indoor : \.outdoor/,
    "an indoor run is filed as an outdoor one, which its own data cannot support");
  // ⚠️ AND THE PAGE IS TOLD WHAT HAPPENED. A silent failure is indistinguishable from a success, and the
  // runner would believe their run is in Health when it is not.
  assert.match(swift, /__interunHealthResult/, "the native side never reports back");
});

/** Brace-matched body of a Swift declaration, for the assertions above. */
function fnOfSwift(src: string, name: string): string {
  const at = src.indexOf(name);
  if (at < 0) return "";
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  return "";
}

test("BLOCKER: the treadmill does not get the start screen, and neither does a running session", () => {
  // ⚠️ IT HAS NO POSITION TO DRAW, NO SIGNAL TO REPORT AND NOTHING TO RECENTRE. And once the run is
  // under way the screen is the numbers and the controls, which is what viewLive has always been.
  const v = nocomment(fn("viewLive"));
  assert.match(v, /if \(!running && !LIVE\.indoor\) return viewLiveStart\(\)/,
    "the start screen is shown for a treadmill run, or during a run, or not at all");
});
