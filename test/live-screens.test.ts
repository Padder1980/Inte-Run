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
  // ⚠️ THIS ASSERTED THAT THE BARS READ LIVE.acc DIRECTLY, and it failed the day the reading gained a
  // freshness rule — a guard scoped to the MECHANISM rather than to the fact, which is the pattern this
  // project has now watched fire eleven times. What matters is that the bars are gated on there being a
  // usable reading at all; where that answer comes from is an implementation detail, and the version
  // that routes it through gpsAccNow is strictly stronger than the one this used to require.
  assert.match(bars, /const acc = gpsAccNow\(\)/,
    "the bars no longer ask the one function that decides whether a reading is usable");
  assert.match(bars, /lit = acc == null \? 0/, "no fix lights a bar, which reads as a weak signal");
  // ⚠️⚠️ AND A READING GOES QUIET WHEN IT STOPS MEANING ANYTHING. LIVE.acc is never cleared — the same
  // trap as WorkoutManager.heartRate, where HealthKit just stops delivering and polling the field
  // charged the whole dropout to the last beat seen. CoreLocation stops delivering indoors, so the
  // badge sat at "GPS · ±4 m" over four lit bars with the last fix minutes old: confidently wrong, on
  // the one control whose whole job is to tell the runner whether to wait.
  const fresh = nocomment(fn("gpsAccNow"));
  assert.match(fresh, /LIVE\.accAt != null && Date\.now\(\) - LIVE\.accAt > GPS_FRESH_MS/,
    "an accuracy of any age is quoted as the signal now");
  assert.match(fresh, /return null/, "a stale reading is corrected rather than withheld");
  // ⚠️ EVERY WRITER STAMPS IT, and the sweep is derived. Two of them are the live run and one is the
  // standby watcher; a stamp at one is a freshness rule that holds before Start and not during the run.
  const src = page();
  const accWrites = [...src.matchAll(/LIVE\.acc = /g)].length;
  const accStamps = [...src.matchAll(/LIVE\.accAt = Date\.now\(\)/g)].length;
  assert.ok(accWrites >= 3, "only " + accWrites + " writers of LIVE.acc found; the sweep is blind");
  assert.equal(accStamps, accWrites,
    accWrites + " places write the accuracy but only " + accStamps + " stamp when it arrived, so the " +
    "freshness rule holds on some paths and not others");
  // ⚠️ AND THE FAILURE PATH REPAINTS, or the gate is invisible: nothing else on this screen ticks
  // before the run starts, so a stale badge with no repaint behind it stays exactly as it was.
  assert.match(nocomment(fn("liveStandbyGps")), /const lost = \(\) =>[\s\S]{0,200}?gpsBarsHtml\(\)/,
    "no fix for twenty seconds repaints nothing, so the gate never shows");
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

/* ------------------------------------------------------------------------------------------------
 * A COMPANION THAT WILL NOT WAKE IS NOT A RUN THAT HAS FAILED — and a system error is not a message.
 *
 * Added 2026-08-22 from the owner's own phone-recorded run: "The 3rd screenshot displays a message
 * that i got when i unlocked the phone just before the halfway point in the session". The message was
 * "Couldn't communicate with a helper application." — Cocoa error 4099, an XPC handshake that did not
 * complete — put on screen verbatim, mid-run, by an app he was using to record on the phone.
 *
 * Two faults in one path. `reportStart` is shared by TWO launches: startOnWatch, where the wrist is
 * the recorder and a failure genuinely changes where the run is kept, and startWatchCompanion, where
 * the wrist is a display and whose own comment says it is silent if there is no watch. On the
 * companion path the handler was clearing the count-in of the run he had just started, re-rendering
 * under him, and raising a toast about a watch he was not using. And the string it raised was the
 * NSError's own.
 * ---------------------------------------------------------------------------------------------- */

/** Drive the real __interunWatchStart with a given pending state, and report what the runner saw. */
function watchStart(pending: boolean, reason: string) {
  const src = page();
  const at = src.indexOf("window.__interunWatchStart = function");
  assert.ok(at > 0, "no __interunWatchStart in the build");
  const end = src.indexOf("\n};", at) + 3;
  const body = src.slice(at, end);
  const consts = /\nconst WATCH_START_MESSAGES = \[[\s\S]*?\];/.exec(src);
  assert.ok(consts, "no WATCH_START_MESSAGES in the build");
  const out = { toasts: [] as string[], renders: 0, cleared: 0, pending };
  const f = new Function("window", "out", "state", "toast", "render", "clearCountIn",
    "watchLiveActive", "WATCHDIAG",
    "let WATCH_LIVE_PENDING = out.pending;\n"
    + consts![0] + "\n" + fn("watchStartMessage") + "\n" + body
    + "\nwindow.__interunWatchStart(false, arguments[8]);"
    + "\nout.pending = WATCH_LIVE_PENDING;");
  (f as (...a: unknown[]) => void)(
    {}, out, { screen: "live" },
    (m: string) => { out.toasts.push(m); },
    () => { out.renders++; },
    () => { out.cleared++; },
    () => false,
    {},
    reason,
  );
  return out;
}

test("BLOCKER: a failed COMPANION launch is silent — it is not the run failing", () => {
  // WATCH_LIVE_PENDING is the discriminator, and it is sound because startOnWatch is its only writer
  // of true and sets it in the same breath as the request.
  const r = watchStart(false, "Couldn't communicate with a helper application.");
  assert.deepEqual(r.toasts, [], "a display that will not wake must not interrupt a run");
  assert.equal(r.cleared, 0, "and it must certainly not cancel the count-in of the run being started");
  assert.equal(r.renders, 0, "nor re-render the live screen under the runner");
});

test("BLOCKER: a failed RECORDER launch still says so, because the run would go to the wrong place", () => {
  // The other half. Silently falling back to the phone would record the run somewhere the runner did
  // not choose, and they would only find out afterwards.
  const r = watchStart(true, "Couldn't reach your watch — open Inte-Run on it and press start.");
  assert.equal(r.toasts.length, 1, "a recorder that will not start has to be reported");
  assert.equal(r.cleared, 1, "and the count-in for a run that is not happening has to stop");
  assert.equal(r.pending, false, "the waiting state has to end, or Start stays blocked");
});

test("BLOCKER: no native error string ever reaches the runner", () => {
  // ⚠️ AN ALLOWLIST, NOT A BLOCKLIST. A blocklist of known system phrasings goes stale with the next
  // iOS release and with every locale, and its failure mode is the raw string back on screen.
  for (const raw of [
    "Couldn't communicate with a helper application.",
    "The operation couldn’t be completed. (NSCocoaErrorDomain error 4099.)",
    "Connection invalid",
  ]) {
    const r = watchStart(true, raw);
    assert.equal(r.toasts.length, 1);
    assert.notEqual(r.toasts[0], raw, "a system error was shown verbatim: " + raw);
    assert.match(r.toasts[0]!, /open Inte-Run on it and press start/,
      "whatever came back, the runner needs a sentence they can act on");
  }
});

test("our own four sentences still come through unchanged", () => {
  // The allowlist is only worth having if it lets our own copy past — otherwise every failure gets
  // the same generic line and "Inte-Run isn't installed on your Apple Watch yet" is lost, which is
  // the one message that actually explains itself.
  const src = page();
  const list = /\nconst WATCH_START_MESSAGES = \[([\s\S]*?)\];/.exec(src);
  assert.ok(list, "no allowlist");
  const ours = [...(list![1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!.replace(/\\u2019/g, "’"));
  assert.ok(ours.length >= 4, "expected our four failure sentences, got " + ours.length);
  for (const m of ours) {
    const r = watchStart(true, m);
    assert.equal(r.toasts[0], m, "our own copy must not be replaced by the fallback: " + m);
  }
});

test("BLOCKER: the Swift no longer hands an NSError's own words to the page", () => {
  // The page is hardened because docs/index.html reaches phones over the air while Swift does not —
  // but the leak has to be closed at source too, or the next reader of reportStart reintroduces it.
  const src = readFileSync(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url), "utf8");
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const calls = [...clean.matchAll(/reportStart\((?:false|ok), ([^\n]*)\)/g)].map((m) => m[1]!);
  assert.ok(calls.length >= 4, "expected every reportStart call, found " + calls.length);
  for (const arg of calls) {
    assert.doesNotMatch(arg, /localizedDescription/,
      "reportStart's string goes straight into a toast: " + arg);
  }
});

/* ------------------------------------------------------------------------------------------------
 * THE LOCK-SCREEN CARD'S CLOCK IS COUNTED BY THE SYSTEM, SO IT DOES NOT STOP WHEN THE PAGE DOES.
 *
 * From the same run: "as soon as the phone locks the tracking seems to jitter......as soon as i
 * unlock it, it corrects itself immediately". His card read 10:52 / 0.86 km / 10:02 while the app,
 * eight seconds later, read 11:00 / 0.98 km / 11:12.
 *
 * ⚠️ THE RECORDED RUN WAS NEVER WRONG — the fixes are buffered in Swift while iOS throttles the web
 * content process and replayed in order, and the pace window is stamped with each fix's OWN clock, so
 * the total and the pace both come out right. What the runner sees is the LAG: `pushLiveActivity` is
 * called from the page's tick, so every number on the card froze together. A clock that has stopped
 * reads as a run that has stopped, which is the part that matters at a glance.
 * ⚠️ THE DISTANCE IS NOT FIXED BY THIS AND CANNOT BE WITHOUT A SECOND ACCUMULATOR IN SWIFT, which
 * would disagree with the run being recorded. The clock can be made honest without one, so it is.
 * ---------------------------------------------------------------------------------------------- */

const swift = (p: string) =>
  readFileSync(new URL("../ios/" + p, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\/\/.*$/gm, "");

test("BLOCKER: the card carries an anchor a system timer can count from", () => {
  const attrs = swift("InteRunShared/RunActivityAttributes.swift");
  assert.match(attrs, /var runningSince: Date\?/,
    "an anchor, not a duration: our elapsed already subtracts paused time, so re-anchoring on every "
    + "push is what keeps the system's count equal to ours");
  assert.match(attrs, /guard !paused, let from = runningSince else \{ return nil \}/,
    "a system timer counts REAL time, so a paused run must fall back to the pushed string");
  // ⚠️ AND IT CARRIES NO DEFAULT, WHICH IS WHAT MAKES THE SWEEP BELOW HOLD IN FUTURE. `= nil` would
  // let a new producer omit it and compile, and the failure is silent: that path alone renders a clock
  // that stands still, which is the defect being fixed. Caught by re-break — the derived sweep reads
  // today's producers and cannot see a door left open for tomorrow's.
  assert.doesNotMatch(attrs, /var runningSince: Date\? *=/,
    "runningSince must be required at every call site, not defaulted");
});

test("BLOCKER: every live producer sends the anchor, and the placeholder deliberately does not", () => {
  // ⚠️ DERIVED, NOT LISTED. A hand-written list of producers goes stale the first time somebody adds
  // one, and the failure is silent: a state built without the anchor renders a clock that stands
  // still, which is the defect being fixed, on one path only.
  const src = swift("InteRun/WatchBridge.swift") + swift("InteRun/MirroredWorkoutService.swift");
  const builds = [...src.matchAll(/(?:ContentState|\.init)\(\s*(?:state: )?elapsedSeconds[\s\S]*?\)\n/g)]
    .map((m) => m[0]);
  assert.ok(builds.length >= 3, "expected every ContentState construction, found " + builds.length);
  for (const b of builds) {
    assert.match(b, /runningSince:/, "a state with no anchor renders a dead clock:\n" + b);
  }
});

test("BLOCKER: whether the anchor is real turns on whether the run has begun", () => {
  // ⚠️ THE SWEEP ABOVE CANNOT SETTLE THIS AND ITS RE-BREAK PROVED IT: both of these states are built
  // with elapsedSeconds 0, so "runningSince is present" is satisfied by `nil` and there is no
  // syntactic way to tell a run that has started from a watch that is only being woken. The
  // difference is which file is doing it, so the claim is made per file.
  //
  // A placeholder must NOT run a clock: the wrist has not begun, so a timer counting up beside a
  // distance stuck at zero reads as a run in progress going nowhere.
  const wb = swift("InteRun/WatchBridge.swift");
  const ph = /state: \.init\(elapsedSeconds: 0[\s\S]*?\),/.exec(wb);
  assert.ok(ph, "the watch-pending placeholder is no longer recognisable");
  assert.match(ph![0], /runningSince: nil/, "a placeholder card must not run a clock");

  // A mirrored wrist workout HAS begun — that handler only fires when the watch starts one — so zero
  // is the truth and the anchor is right. Nil there shows a dead 0:00 until the first tick lands.
  const mw = swift("InteRun/MirroredWorkoutService.swift");
  const st = /ContentState\([\s\S]*?\)\n/.exec(mw);
  assert.ok(st, "the mirrored-workout state is no longer recognisable");
  assert.match(st![0], /runningSince: Date\(\)/,
    "a mirrored wrist workout has started; its card must start counting");
});

test("BLOCKER: the anchor is computed on THIS device, from the elapsed we were just told", () => {
  // A timestamp made at the far end would carry the delivery delay into the clock: a wrist tick
  // crosses WatchConnectivity and a page post crosses a message handler.
  const src = swift("InteRun/WatchBridge.swift");
  const anchors = [...src.matchAll(/runningSince: ([^\n,]+)/g)]
    .map((m) => m[1]!.trim().replace(/\)+$/, ""));
  const live = anchors.filter((a) => a !== "nil");
  assert.ok(live.length >= 2, "expected both live producers, found " + live.length);
  for (const a of live) {
    assert.match(a, /Date\(\)\.addingTimeInterval\(-Double\(/,
      "the anchor must be now minus the elapsed we were told, computed here: " + a);
  }
});

test("BLOCKER: the widget renders the timer where it has one and our string where it does not", () => {
  const w = swift("InteRunWidgets/RunLiveActivity.swift");
  assert.match(w, /Text\(timerInterval: /, "nothing counts the clock without this");
  // Both fallbacks matter: a paused run has no anchor, and an older app build sends none at all.
  assert.match(w, /if let timer \{[\s\S]*?\} else \{[\s\S]*?Text\(value\)/,
    "stat() must fall back to the pushed string");
  assert.match(w, /if let r = st\.timerRange \{[\s\S]*?\} else \{[\s\S]*?Text\(st\.elapsedText\)/,
    "the compact Dynamic Island clock must fall back too");
  // Every place the elapsed is rendered has to take the timer, or one of them stands still.
  const shown = [...w.matchAll(/(?:stat\(context\.state\.elapsedText|clock\(context\.state)/g)];
  assert.ok(shown.length >= 3, "expected all three clock sites, found " + shown.length);
  for (const m of [...w.matchAll(/stat\(context\.state\.elapsedText[^\n]*/g)].map((x) => x[0])) {
    assert.match(m, /timer: context\.state\.timerRange/, "a clock site with no timer: " + m);
  }
});

/**
 * THE START SCREEN IS A SCREEN THE RUNNER ACTUALLY LANDS ON (owner's mockup, 2026-08-24).
 *
 * ⚠️⚠️ IT WAS UNREACHABLE FOR THREE DAYS AND EVERY TEST PASSED. wireStartWhere's phone branch called
 * runCountIn(beginLive) the moment the sheet was tapped — which is EXACTLY what the Start button's own
 * handler does — so the screen painted for a single frame and the run began. Every feature the owner
 * asked for on this screen (the signal, the map, the shoe) was already built on a screen nobody had ever
 * seen. A guard that asks "does this markup exist" cannot see that; this one asks who starts the run.
 */
test("BLOCKER: the phone path lands on the start screen and does not start itself", () => {
  const w = nocomment(fn("wireStartWhere"));
  // The phone branch reaches startSession and then STOPS. Only the treadmill starts itself.
  assert.match(w, /startSession\(sess, \{ indoor: where === "treadmill" \}\)/,
    "the sheet no longer stages the run");
  const after = w.slice(w.indexOf("startSession(sess"));
  assert.match(after, /if \(where === "treadmill"\) \{[^}]*runCountIn\(beginLive\)/,
    "the count-in is not gated on the treadmill, so the phone path starts itself again and the screen " +
    "the owner asked for is unreachable");
  // ⚠️ AND THE GATE IS THE ONLY runCountIn HERE. An ungated one after it would start every run.
  assert.equal((after.match(/runCountIn\(/g) || []).length, 1,
    "there is more than one count-in on this path, so one of them is ungated");
  // ⚠️ THE TREADMILL KEEPS ITS OWN BEHAVIOUR. It has no position, no signal and no map — a screen to
  // wait on would be a screen with nothing on it, and viewLive keeps its own layout for indoor.
  assert.match(nocomment(fn("viewLive")), /if \(!running && !LIVE\.indoor\) return viewLiveStart\(\)/,
    "the treadmill reaches the start screen, which has nothing on it for an indoor run");
  // ⚠️ AND THE WATCH COMPANION MOVES WITH THE COUNT-IN. It arms a startNow with a 25-second give-up, so
  // waking the wrist when the sheet is tapped spends that budget while the runner is still standing.
  const wire = nocomment(page());
  const at = wire.indexOf('$("lStart")');
  assert.ok(at > 0, "the Start button is unwired");
  assert.match(wire.slice(at, at + 500), /startWatchCompanion\(/,
    "Start does not wake the watch companion, so a phone-recorded run has no wrist display");
});

test("BLOCKER: a free run is stepless, typed, and has nothing to judge it against", () => {
  const f = nocomment(fn("freeRunSession"));
  // ⚠️ STEPLESS IS THE WHOLE DESIGN — measured through the real runtime, LiveSession.start skips its
  // step cue, the advance loop never enters so the run never completes, and an hour of telemetry
  // produces only session-start. A single open-ended step would complete the instant it was measured.
  assert.match(f, /steps: \[\]/, "a free run has steps, so the engine will complete it");
  // ⚠️ TYPED, BECAUSE A TYPE IS NOT OPTIONAL DOWNSTREAM. LIVE.summary.type is LIVE.session.type and
  // runEffort reads run.type to colour the run in the club, the calendar and the Logbook.
  assert.match(f, /type: "easy"/, "a free run has no type, so every colour that reads run.type falls back");
  assert.match(f, /free: true/, "nothing marks it as a free run, so the target pill cannot be gated on it");
  // ⚠️ AND NO PACE BAND. A band would have the coach correct the runner against a target they never
  // chose and the flags engine judge them against it afterwards.
  assert.ok(!/targetPaceSecPerKm|pband/.test(f), "a free run carries a pace band");
  // It takes the same route as every other run: the sheet decides where it is recorded.
  const wire = nocomment(page());
  assert.match(wire, /addFree[\s\S]{0,200}?openStartWhereSheet\(freeRunSession\(\)\)/,
    "the free run does not go through the where-to-record sheet");
  // ⚠️ AND IT IS NEVER ADDED TO THE PLAN. A run with no target sitting on a training day would be
  // counted as one, and would still be there tomorrow if the runner never went.
  assert.ok(!/addExtra\([^)]*freeRun|freeRunSession\(\)[\s\S]{0,80}?addExtra/.test(wire),
    "a free run is stored as an EXTRA, so the plan counts a target nobody set");
});

test("BLOCKER: the title wears the session's own effort colour, above its measured floor", () => {
  const v = nocomment(fn("viewLiveStart"));
  // ⚠️ THE ONE MAPPING (ruling 7), so this screen agrees with the tile that was tapped to reach it, the
  // dot on the calendar and the rail in the Logbook.
  assert.match(v, /effortVar\(effortOf\(s\)\)/,
    "the title's colour is not taken from the one session-to-effort mapping");
  const css = page().slice(page().indexOf("<style>"), page().indexOf("</style>"));
  const rule = /\.lst-title \{([^}]*)\}/.exec(css);
  assert.ok(rule, "there is no .lst-title rule");
  // ⚠️⚠️ THE MOCKUP'S GREEN MEASURES 2.01:1 ON THIS APP'S LIGHT CANVAS, where even large text needs
  // 3:1 — so it cannot be copied. color-mix with --ink darkens in light and lightens in dark from ONE
  // declaration, and 60% is the first rung where all three efforts clear 4.5:1 in BOTH themes
  // (light 5.97 / 5.09 / 7.28). A higher percentage is a colour under its floor.
  // ⚠️ MATCHED IN TWO PIECES BECAUSE THE FALLBACK NESTS A var() INSIDE THE FIRST ARGUMENT —
  // var(--lst-eff, var(--accent)) — and [^)]* stops at the inner bracket. The first version of this
  // guard failed on correct code for exactly that.
  assert.match(rule![1]!, /color-mix\(in srgb, var\(--lst-eff/,
    "the title's colour is not mixed towards --ink, so light mode cannot pass");
  const mix = /(\d+)%, var\(--ink\)\)/.exec(rule![1]!);
  assert.ok(mix, "the mix has no percentage against --ink");
  assert.ok(Number(mix![1]) <= 60,
    "the title mixes at " + mix![1] + "% — above 60% the amber effort falls under 4.5:1 in light mode");
  // A fallback, because a session type with no effort must still produce a colour rather than nothing.
  assert.match(rule![1]!, /var\(--lst-eff, var\(--accent\)\)/,
    "there is no fallback, so a missing effort leaves the title uncoloured");
});

test("BLOCKER: the target pill is offered only when there is no target, and adds nothing to the plan", () => {
  const v = nocomment(fn("viewLiveStart"));
  // ⚠️ GATED ON THE SESSION, so it never offers to replace a session the runner deliberately chose.
  assert.match(v, /const free = !!s\.free/, "the screen does not know whether the run has a target");
  assert.match(v, /free[\s\S]{0,120}?id="lTarget"/, "the target pill is not gated on a free run");
  const wire = nocomment(page());
  // It opens the builder the app already has — no second catalogue to drift from the plan's paces.
  const at = wire.indexOf('$("lTarget")');
  assert.ok(at > 0, "the target pill is unwired");
  const body = wire.slice(at, at + 420);
  assert.match(body, /LIVE_TARGET = true/, "the pill does not tell the builder who its customer is");
  assert.match(body, /addSessionSheetHtml\(\)/, "the pill builds its own picker instead of the app's");
  // ⚠️ THE COMMIT FORKS, AND THE TARGET PATH ADDS NOTHING TO THE PLAN.
  const add = wire.slice(wire.indexOf('$("bldAdd")'));
  const fork = add.slice(0, add.indexOf("addExtra("));
  assert.match(fork, /if \(LIVE_TARGET\)/, "the builder's commit does not fork, so a target becomes an EXTRA");
  assert.match(fork, /liveSetTarget\(/, "the target path does not reach liveSetTarget");
  assert.ok(fork.indexOf("addExtra(") < 0, "the target path also adds to the plan");
  // ⚠️ AND THE SWAP KEEPS THE FIX. startSession would build a fresh LIVE and throw away the GPS fix the
  // runner has been standing there waiting for, blanking the map until the next one arrives.
  const set = nocomment(fn("liveSetTarget"));
  assert.ok(set.indexOf("startSession(") < 0,
    "the target swap restarts the session, which discards the GPS fix and blanks the map");
  assert.match(set, /LIVE\.session = s/, "the swap does not replace the session");
  assert.match(set, /LIVE\.rt = new RC\.LiveSession\(s\)/, "the runtime still counts the old session's steps");
  assert.match(set, /LIVE\.lastStep = -1/,
    "lastStep is not reset, so the first tick believes it is partway through a session that just arrived");
  assert.match(set, /withGeneratedWarmup\(heatApplied\(sess\)\)/,
    "the swap does not apply the same two transforms startSession does, in the same order");
  assert.match(set, /LIVE\.started/, "a target can be swapped in mid-run");
  // ⚠️ AND THE FLAG IS CLEARED WHEN THE SHEET IS DISMISSED, or the next "add a session to Tuesday"
  // silently becomes a target for a run that is no longer live.
  assert.match(nocomment(fn("closeSheet")), /LIVE_TARGET = false/,
    "dismissing the sheet leaves the builder pointed at a live run");
});

test("BLOCKER: the screen is one column that never scrolls, and Start is always on it", () => {
  const css = page().slice(page().indexOf("<style>"), page().indexOf("</style>"));
  // ⚠️ MEASURED BEFORE THIS CHANGE at 320x568: the view scrolled 195px and Start sat 27px BELOW THE
  // FOLD. As a column with the map taking the slack, the card and the foot are laid out first, so Start
  // is always the last thing on screen.
  const view = /#view:has\(\.lst-card\) \{([^}]*)\}/.exec(css);
  assert.ok(view, "the screen is no longer scoped as a column");
  assert.match(view![1]!, /display:\s*flex/, "the screen is not a flex column");
  assert.match(view![1]!, /overflow:\s*hidden/, "the screen scrolls again, so Start can leave the fold");
  assert.match(view![1]!, /padding:\s*0/, "the view still pads, so the map cannot reach the edges");
  const map = /\.lst-map \{([^}]*)\}/.exec(css);
  assert.ok(map, "there is no .lst-map rule");
  // ⚠️ min-height: 0 IS WHAT LETS IT SHRINK. A flex item defaults to min-height: auto and refuses to go
  // below its content — the trap .view's own rule already exists for.
  assert.match(map![1]!, /flex:\s*1/, "the map does not take the slack, so the screen has dead space again");
  assert.match(map![1]!, /min-height:\s*0/,
    "the map cannot shrink, so on a short phone it pushes Start off the bottom");
  // ⚠️ THE TOP BAR STEPS ASIDE BY A SELECTOR, NOT A JS FLAG. A class on html can be left set, and a
  // permanently hidden top bar is a bug with no visible cause.
  assert.match(css, /\.app:has\(\.lst-card\) > \.topbar \{[^}]*display:\s*none/,
    "the app's top bar is not hidden on this screen, so it costs the map the height the mockup gives it");
  const wire = nocomment(page());
  assert.ok(!/classList\.(add|remove)\("lst-open"\)/.test(wire),
    "the top bar is hidden by a JS flag, which can be left set");
  // ⚠️ AND THE BOTTOM NAV STAYS. A run no longer locks the app to the live screen; taking navigation
  // away would undo that deliberately.
  assert.ok(!/\.app:has\(\.lst-card\) > \.bottomnav/.test(css),
    "the bottom nav is hidden too, which undoes a deliberate decision nobody asked to reverse");
});

test("BLOCKER: everything that floats on the map is legible over a light basemap", () => {
  // ⚠️⚠️ THE NEAR-WHITE FILL WAS INVISIBLE, AND THIS IS MEASURED. Both styles this app uses for a run
  // are LIGHT basemaps — median relative luminance 0.876 across 14 real voyager tiles, 0.00% of pixels
  // below L 0.10 — so a control filled from --surface has an edge around 1.05:1 and only its glyph
  // reads. Deep ink at .78 measures 9.92:1 for the circle and its white glyph, whatever the tile.
  const src = page();
  const css = src.slice(src.indexOf("<style>"), src.indexOf("</style>"));
  // ⚠️ THE SET IS DERIVED FROM THE BUILDER'S OWN MAP REGION, NOT LISTED. Its first version named three
  // selectors by hand and omitted .lst-target — the biggest control on the map, wearing exactly the
  // fill the other five had been moved off. A guard over a collection is only as good as the
  // collection, and a hand-written one goes stale the first time somebody adds a control.
  const b = fn("viewLiveStart");
  const region = b.slice(b.indexOf("lst-map"), b.indexOf("lst-foot"));
  const cls = new Set<string>();
  const add = (chunk: string) => {
    for (const m of chunk.matchAll(/class="([^"]*)"/g)) {
      for (const t of m[1]!.split(/[^A-Za-z0-9-]+/)) {
        if (/^(lst|live|gps)-/.test(t)) cls.add(t);
      }
    }
  };
  add(region);
  // ⚠️ AND ONE LEVEL OF HELPERS WITH IT — the shoe chip and the signal are built by functions the
  // region calls, so a derivation that reads only the builder's own string finds neither of them.
  const helpers = [...region.matchAll(/\b([a-zA-Z]\w*Html)\(\)/g)].map((m) => m[1]!);
  assert.ok(helpers.length >= 2, "the map region calls no markup helpers; the derivation would be blind");
  for (const h of helpers) add(fn(h));
  for (const need of ["lst-target", "lst-c", "live-shoe", "gps-sig"]) {
    assert.ok(cls.has(need), "the derivation missed ." + need + ", so it is proving less than it claims");
  }
  let checked = 0;
  for (const c of cls) {
    // .lst-map is the ground these sit on and .lst-mapimg is the basemap itself, so neither floats
    // over anything; every other member of the set does.
    if (c === "lst-map" || c === "lst-mapimg") continue;
    const r = new RegExp("\\." + c + " \\{([^}]*)\\}").exec(css);
    if (!r) continue;
    const decl = r[1]!;
    if (!/background:/.test(decl)) continue;
    checked++;
    assert.ok(!/background:\s*(var\(--surface|color-mix\(in srgb, var\(--surface)/.test(decl),
      "." + c + " is filled from the theme surface, which is near-white over a light basemap");
    const a = /rgba\(4,16,13,\.(\d+)\)/.exec(decl);
    assert.ok(a, "." + c + " does not sit on the app's own deep ink, so its edge depends on the tile");
    assert.ok(Number("0." + a[1]!) >= 0.6,
      "." + c + " is at alpha 0." + a[1]! + " — under 0.6 the fill falls below the 3:1 non-text floor " +
      "on a white basemap");
  }
  assert.ok(checked >= 4, "only " + checked + " floating controls carried a background; expected 4+");
  // ⚠️ AND THE TWO THE MAP DRAWER ADDS ARE DELIBERATELY NOT DEEP INK, so they are asserted positively
  // rather than swept. The location marker is the accent BECAUSE it must not read as a sixth control,
  // and attribution is a licence term whose conventional treatment is a light plate with dark text.
  assert.match(css, /\.lst-me \{[^}]*background:\s*var\(--accent\)/,
    "the live location marker must stay the accent, or it is indistinguishable from the controls");
  assert.match(css, /\.lst-attr \{[^}]*background:\s*color-mix\(in srgb, var\(--surface\)/,
    "attribution keeps the conventional light plate; it is a licence term, not a control");
  // ⚠️ ON A SHORT MAP THE CONTROL COLUMN BECOMES A ROW, and without this it is CLIPPED. Measured at
  // 320x568 the map gets 117px and the column needs 176px; a clipped control cannot be tapped, and all
  // four of them were rendered, styled and wired at the time they could not be pressed.
  assert.match(css, /\.lst-map \{[^}]*container-type:\s*size/,
    "the map is not a size container, so the controls cannot know how tall it ended up");
  assert.match(css, /@container \(max-height: \d+px\) \{[^}]*\.lst-ctrls \{[^}]*flex-direction:\s*row/,
    "the control column never becomes a row, so on a short map it is clipped and unreachable");
});


test("BLOCKER: the map and the signal can be reached before the run starts", () => {
  // ⚠️⚠️ THE GUARD WHOSE ABSENCE LET TWO OF THE OWNER'S FIVE FEATURES BE UNREACHABLE FOR THREE DAYS
  // BEHIND A GREEN SUITE. Every writer of LIVE.lastLat lived inside beginLive — startGps sets it and in
  // the same breath sets LIVE.mode, LIVE.startMs and calls rt.start — so the only way to have a
  // position was to have already started running. drawLiveMap returned at its null check and
  // gpsBarsHtml saw acc == null, so the screen showed a bare panel and nought of four bars.
  // ⚠️ AND IT WAS INVISIBLE TO A BROWSER PROBE THAT SET LIVE.lastLat BY HAND — the documented trap of
  // feeding the app a shape no caller can produce. The claim has to be about the WRITERS.
  const src = page();
  const writers: string[] = [];
  const re = /LIVE\.lastLat\s*=/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    // walk back to the owning top-level function
    const before = src.slice(0, m.index);
    const at = before.lastIndexOf("\nfunction ");
    writers.push(/\nfunction ([A-Za-z_$][\w$]*)/.exec(before.slice(at))![1]!);
  }
  assert.ok(writers.length >= 2, "there is only one writer of the run's position: " + writers.join(", "));
  const standby = writers.filter((w) => w !== "startGps" && w !== "onGpsPos" && w !== "livePauseSet");
  assert.ok(standby.length >= 1,
    "every writer of LIVE.lastLat is inside the run itself (" + writers.join(", ") + "), so the start " +
    "screen can never have a position — no map, no dot, and nought of four bars");
  // ⚠️⚠️ AND SOMETHING MUST CALL IT. A writer nothing invokes is not a writer: deleting the one call
  // left this guard green with the screen showing a bare panel again, because the function was still
  // defined and still outside startGps. Watched escaping. The same lesson the club's filmstrip taught —
  // a builder proves a shape exists, only the caller proves the runner reaches it.
  const wiring = nocomment(page());
  for (const w of standby) {
    assert.ok(new RegExp("(?<!function )\\b" + w + "\\(").test(wiring.replace("function " + w + "(", "")),
      w + " writes the start screen's position and nothing ever calls it");
  }
  assert.match(wiring, /\$\("lMapWrap"\)\) liveStandbyGps\(\)/,
    "the start screen does not ask for a fix when it is wired, so it never gets one");
  // ⚠️ AND THE STANDBY MUST NOT LOOK LIKE A RUN. LIVE.mode is what makes the whole distance pipeline
  // live; setting it here would start accumulating a run the runner has not begun.
  const sb = nocomment(fn("liveStandbyGps"));
  for (const forbidden of ["LIVE.mode =", "LIVE.startMs =", "rt.start(", "requestWakeLock", "pedoPost"]) {
    assert.ok(sb.indexOf(forbidden) < 0, "the standby fix does " + forbidden + ", which starts the run");
  }
  assert.match(sb, /LIVE\.started/, "the standby runs during a run, so two watches write one position");
  // ⚠️ THE ARRIVAL IS RE-GUARDED, not just the subscribe: a fix can land after Start or after the
  // runner walked away.
  assert.match(sb, /if \(!LIVE \|\| LIVE\.started \|\| LIVE\.indoor\) return/,
    "a fix arriving after Start is written anyway, behind the run's own position");
  // ⚠️ AND IT IS STOPPED ON BOTH EXITS — the run beginning, and the runner leaving without starting.
  assert.match(nocomment(page()), /liveStandbyStop\(\);[\s\S]{0,200}?if \(LIVE\.indoor\) \{ startIndoor/,
    "beginLive does not stop the standby before opening its own watch");
  assert.match(nocomment(fn("stopLive")), /liveStandbyStop\(\)/,
    "walking away from the start screen leaves a watchPosition running — a GPS radio nobody turned off");
  // ⚠️ THE SIGNAL READS THE ACCURACY IT HAS, not the run's mode. Gating on LIVE.mode === "gps" is what
  // made the bars dark on a phone holding a perfectly good six-metre fix.
  const bars = nocomment(fn("gpsBarsHtml"));
  assert.ok(!/LIVE\.mode === "gps" && LIVE\.acc/.test(bars),
    "the bars are gated on the run being in gps mode again, so they are dark before Start");
  // ⚠️ RESTATED WHEN THE READING GAINED A FRESHNESS RULE. The invariant is that the signal answers from
  // the accuracy it has and never from the run's mode; it used to be pinned to reading LIVE.acc inline,
  // which is a HOW. gpsAccNow is that same answer with an age limit on it.
  assert.match(bars, /gpsAccNow\(\)/, "the bars no longer ask whether there is a usable reading");
  assert.ok(!/LIVE\.mode/.test(bars), "the bars consult the run's mode again, so they are dark before Start");
  assert.match(nocomment(fn("gpsStatusText")), /const acc = gpsAccNow\(\);[\s\S]{0,120}?if \(acc != null\) return "GPS/,
    "the metres are gated behind the run's mode, so the words disagree with the lit bars");
});

test("BLOCKER: a free run's live screen says what it is, and a wrist free run keeps its own identity", () => {
  const src = page();
  // ⚠️ ACTIVE WITH NO STEP IS THE ONLY STATE A FREE RUN IS EVER IN, and there was no arm for it — so
  // the card kept viewLive's placeholder ("Press start when you are ready") for the whole run.
  const up = nocomment(fn("liveUpdate"));
  const tail = up.slice(up.indexOf('snap.status === "completed"'));
  assert.match(tail, /\} else \{/,
    "liveUpdate has no branch for active-with-no-step, so a free run reads 'press start' while running");
  assert.ok(!/Press start/.test(tail), "the free-run branch still shows the not-started placeholder");
  // ⚠️⚠️ AND THE WRIST'S FREE RUN MUST NOT INHERIT THE DAY'S PRESCRIPTION. This matched by DATE alone,
  // so a run started with no plan was stored under whatever session sat on that day, carrying its
  // bands — and the debrief judged the runner against a target they never chose. Live today,
  // independent of the phone's free run.
  const ing = nocomment(fn("ingestWatchRun"));
  assert.match(ing, /const free = !run\.title/,
    "a wrist run with no plan is not identified, so it inherits the day's session");
  assert.match(ing, /const prescribed = free \? null :/,
    "a wrist free run still takes the day's pace band, and the debrief judges it against one");
  assert.match(ing, /const planned = free \? null :/,
    "a wrist free run still ticks the plan, so a day nobody trained is marked done");
  // ⚠️ THE REASONING MUST BE WRITTEN DOWN WHERE THE TEST IS MADE, because "no title" only means "no
  // plan" by virtue of how the watch builds its payload — and the next reader will otherwise take it for
  // a guess and tighten it into something that breaks.
  // ⚠️ ASSERTED ON THE UNSTRIPPED SOURCE. This guard's first version searched nocomment(...) for the
  // very prose it requires, which is the comment trap running backwards: it can only ever fail.
  assert.match(fn("ingestWatchRun"), /summaryPayload/,
    "nothing records why the absence of a title is a reliable test for a free run");
});

/**
 * ⚠️⚠️ THE WORST CASE IS THE LONGEST TITLE ON THE SMALLEST PHONE AT THE LARGEST TEXT SETTING, AND IT IS
 * THE ONLY CASE WORTH GUARDING. Measured with the session library's longest title ("Mona fartlek: 2 x
 * (90/60/30/15s hard, equal float)") at 320x568 with --tscale at its 1.3 cap: the title took SIX lines,
 * the card grew to 413px of a 506px view, and the map collapsed to 18px with five of the seven controls
 * clipped out of it and unhittable. Every one of those controls was rendered, styled and wired — and
 * none of them could be pressed, which is the looks-live-is-inert class wearing a layout disguise.
 *
 * The three guards below are the three fixes, and each was watched failing against its own re-break.
 * Their claims are structural because a headless browser here can neither raise the software keyboard
 * nor take a screenshot; the pixels behind them were measured separately and are quoted in the comments.
 */
test("BLOCKER: the session title is clamped so it cannot swallow the map", () => {
  // ⚠️ A TITLE IS THE ONE THING ON THIS SCREEN WHOSE LENGTH THE APP DOES NOT CHOOSE. It comes out of the
  // session library, and the library's longest is 46 characters at --t-display — so unclamped it is a
  // variable-height block above a flex map that has to give up whatever it takes. Measured, the map went
  // 168px -> 18px between the shortest title and the longest. The clamp is what makes the floor real.
  const css = page();
  const at = css.indexOf(".lst-title {");
  assert.ok(at > 0, "no .lst-title rule");
  const rule = css.slice(at, css.indexOf("}", at));
  const m = /-webkit-line-clamp:\s*(\d+)/.exec(rule);
  assert.ok(m, ".lst-title must clamp its line count, or the longest title eats the map");
  const lines = Number(m![1]);
  assert.ok(lines >= 2 && lines <= 4, "the clamp is " + lines + " lines; 2-4 is the honest range");
  // ⚠️ AND THE CLAMP DOES NOTHING WITHOUT ALL THREE DECLARATIONS. -webkit-line-clamp is inert unless the
  // box is a -webkit-box with vertical orientation and its overflow is hidden; three declarations that
  // must travel together is three chances to keep one and lose the effect with nothing failing.
  for (const need of ["-webkit-box", "-webkit-box-orient: vertical", "overflow: hidden"]) {
    assert.ok(rule.includes(need), ".lst-title clamps but is missing " + need);
  }
});

test("BLOCKER: the three numbers never wrap, and the unit is a rung under the value", () => {
  // ⚠️ THREE NUMBERS IN A THREE-COLUMN GRID EACH GET A THIRD OF THE CARD, so a value that wraps takes a
  // second line and lifts the whole card into the map. Measured at 320 with --tscale 1.3, a column is
  // 91px and the value plus its unit needed 95 -- so this is not hypothetical headroom.
  const css = page();
  const at = css.indexOf(".lst-nums .lv {");
  assert.ok(at > 0, "no .lst-nums .lv rule");
  assert.ok(css.slice(at, css.indexOf("}", at)).includes("white-space: nowrap"),
    "a value that wraps grows the card and shrinks the map");
  // The unit rides beside the value in the same cell, so it is competing for the same 91px. On the type
  // ladder --t-label (14px) is two rungs under --t-hero (24px) -- big enough to read, small enough to fit.
  const ua = css.indexOf(".lst-nums .lu {");
  assert.ok(ua > 0, "no .lst-nums .lu rule");
  assert.ok(css.slice(ua, css.indexOf("}", ua)).includes("var(--t-label)"),
    "the unit must sit on a smaller rung than the value it qualifies");
});

test("BLOCKER: the narrow-column rung drop sits BELOW the rule it overrides", () => {
  // ⚠️⚠️ @container ADDS NO SPECIFICITY, so this rule and the plain one tie at (0,2,0) and the later of
  // the two wins. Written above it the query matched, the container reported its 288px, and the type
  // stayed at --t-hero with nothing whatever to see -- a fix that measured as a no-op. This is the
  // cascade-collision trap in two rules, and the only thing that separates working from not is order.
  const css = page();
  const plain = css.indexOf(".lst-nums .lv {");
  const q = css.indexOf("@container (max-width: 330px)");
  // ⚠️ BOTH HALVES ARE ASSERTED TO EXIST FIRST. indexOf answers -1 for a missing needle and -1 is less
  // than every real index, so "a comes before b" is satisfied by a being absent -- which this file has
  // already watched let two ordering guards pass on deleted code.
  assert.ok(plain > 0, "no .lst-nums .lv rule");
  assert.ok(q > 0, "no narrow-column container query");
  assert.ok(q > plain, "the container query is above the rule it overrides, so it can never win");
  const rule = css.slice(q, css.indexOf("}", css.indexOf("{", q + 30)));
  assert.ok(/font-size:\s*var\(--t-section\)/.test(rule),
    "the drop must land on the type ladder, or it fails the font-size ratchet");
  // And the container has to be declared, or the query resolves against an ancestor that is not this row.
  const na = css.indexOf(".lst-nums {");
  assert.ok(na > 0 && css.slice(na, css.indexOf("}", na)).includes("container-type: inline-size"),
    ".lst-nums must be the query container the drop is measured against");
});

test("BLOCKER: setting the shoe never leaves the screen, and one function decides which pair is on", () => {
  // ⚠️⚠️ THE CHIP USED TO NAVIGATE, AND THAT STRANDED THE RUNNER. A staged run has LIVE.started false,
  // so liveRunning() is false and the live pill — the app's one route back into a run — never appears;
  // and the handler set state.tab directly without stopLive, so the staged session survived with
  // nothing able to reach it and the next bottom-nav tap threw it away. Measured: tap the shoe, land on
  // the rack, run gone. The screen has to answer its own question.
  const h = nocomment(page());
  const at = h.indexOf('$("lShoe")');
  assert.ok(at > 0, "no #lShoe handler");
  const handler = h.slice(at, h.indexOf(";", h.indexOf("=>", at) + 40) + 1);
  for (const nav of ["state.tab", "state.screen", "state.support"]) {
    assert.ok(handler.indexOf(nav) < 0,
      "the shoe chip writes " + nav + ", so it navigates away from a staged run nothing can reach");
  }
  assert.match(handler, /openLiveShoeSheet\(\)/, "the chip does not open the picker");
  // ⚠️ ONE DEFINITION OF WHICH PAIR IS ON, read by both screens. It was open-coded inside wireShoeRack;
  // a second copy is how the rack and the start screen come to disagree about what "active" means,
  // which is the fix-one-builder-not-the-other trap this project has paid for six times.
  const defs = [...h.matchAll(/function setActiveShoe\(/g)].length;
  assert.equal(defs, 1, "there are " + defs + " definitions of setActiveShoe");
  const setter = nocomment(fn("setActiveShoe"));
  assert.match(setter, /x\.active = x\.id === id && !x\.retiredIso/,
    "a retired pair can be made active, and then a run is credited to shoes already thrown away");
  assert.match(setter, /saveShoes\(/, "the choice is not written, so it is forgotten on the next render");
  // Both readers must go through it rather than assigning .active themselves.
  for (const caller of ["wireShoeRack", "openLiveShoeSheet"]) {
    const body = nocomment(fn(caller));
    assert.match(body, /setActiveShoe\(/, caller + " does not use the one setter");
    // ⚠️ THE CLAIM IS ABOUT TURNING A PAIR **ON**, and its first version forbade every ".active ="
    // — which failed on correct code, because retiring a pair legitimately sets .active = false in the
    // same breath as its retiredIso. Retiring is not choosing. So false is allowed anywhere and every
    // other value has to come from the setter.
    for (const m of body.matchAll(/\.active\s*=\s*([^;]+);/g)) {
      const rhs = m[1]!.trim();
      assert.equal(rhs, "false",
        caller + " sets .active to " + rhs + " itself, so there are two answers to which pair is on");
    }
  }
  // ⚠️ AND THE PICKER ITSELF NEVER NAVIGATES, INCLUDING ITS EMPTY CASE. Putting the whole rack in a
  // sheet was the obvious build and it trades a strand for a dead sheet: shoeRackView renders an
  // id="shoeAdd" that the Performance screen also renders, so $() resolves the wrong one and the
  // sheet's own add button is wired to nothing. openShoeSheet ends in closeSheet() + render() and goes
  // nowhere, and its first pair is active by construction — so even an empty rack stays on the screen.
  const sheet = nocomment(fn("openLiveShoeSheet"));
  for (const nav of ["state.tab", "state.screen", "state.support", "shoeRackView"]) {
    assert.ok(sheet.indexOf(nav) < 0, "the shoe picker reaches for " + nav + ", which leaves the run behind");
  }
  assert.match(sheet, /openShoeSheet\(null\)/, "there is no way to add a pair from here");
  assert.match(sheet, /filter\(\(x\) => !x\.retiredIso\)/, "retired pairs are offered as something to run in");
  assert.match(sheet, /shoe-intro|There is nothing in your rack/,
    "an empty rack says nothing, so the sheet reads as broken rather than as empty");
});
