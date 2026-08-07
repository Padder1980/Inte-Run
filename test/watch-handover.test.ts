import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ TWO FAULTS FROM A REAL RUN, neither reproducible without an iPhone and a Watch — so these are
 * structural guards on the two handovers, in the places each one actually broke.
 *
 *  1. "the gps/km tracking didn't start when i tried to start the run from my phone"
 *  2. "the voice coaches only said the start but then nothing after"
 */
const read = (f: string) => readFileSync(new URL("../ios/" + f, import.meta.url), "utf8");

test("⚠️ the watch listens for the phone's go signal ALWAYS, not only on a HealthKit launch", () => {
  // ⚠️ The handler was installed inside `.onChange(of: autoStart) { guard want, !running ... }`.
  // `autoStart` is LaunchRequest.pending — true only when iOS woke the app specifically to run. With
  // the watch app ALREADY OPEN it never flipped, so `store.onStartNow` was never installed: the phone
  // counted him in, sent the go, and the watch parked it in `pendingGo` where nothing would read it.
  // The wrist sat on Today looking like the button had done nothing.
  const today = read("InteRunWatch/TodayView.swift");
  assert.ok(!/onChange\(of: autoStart[^}]*store\.onStartNow/s.test(today),
    "the go handler is gated on autoStart again — an already-open watch will ignore the phone");
  assert.match(today, /\.onAppear \{[\s\S]{0,400}store\.onStartNow = \{/,
    "the go handler is no longer installed unconditionally on appear");
  // ⚠️ And the run guard belongs at FIRE time, not install time — at install it made a watch whose
  // previous run had not cleared `running` permanently deaf, with nothing on screen to say so.
  const install = today.slice(today.indexOf(".onAppear {"));
  const closure = install.slice(install.indexOf("store.onStartNow = {"), install.indexOf("beginNow(s)"));
  assert.match(closure, /guard !running else \{ return \}/,
    "the fire-time guard is gone, so a go could start a second run over a live one");
  // A preview must still never be able to start a workout — WatchPreview's own invariant.
  assert.match(install.slice(0, install.indexOf("store.onStartNow")), /previewInert/,
    "a preview can now start a real workout");
});

test("⚠️ a wrist run's cue survives the phone going in a pocket", () => {
  // ⚠️ The watch decides WHEN a cue is due and the phone plays it, because the phone has the recorded
  // coaches. That handover ended in `evaluateJavaScript` — which does NOTHING against a suspended web
  // content process. So the coach spoke while the phone was in his hand and fell silent the moment it
  // was pocketed. Same root cause as the locked-phone bug, on a path the schedule-based fix cannot
  // reach: only the wrist knows when the next cue is due, so there is no schedule to push.
  const bridge = read("InteRun/WatchBridge.swift");
  const fwd = bridge.slice(bridge.indexOf("private func forwardCue("));
  assert.match(fwd.slice(0, 900), /applicationState == \.active/,
    "forwardCue hands every cue to the web view again, including when it cannot run");
  assert.match(fwd.slice(0, 900), /CoachAudioService\.shared\.playWatchCue/,
    "there is no native fallback, so a backgrounded phone drops the cue silently");
  // ⚠️ It must still try the page when native has nothing — silence is the failure being fixed.
  assert.match(fwd.slice(0, 1200), /guard let webView/,
    "the page path was removed, so a cue with no native clip is lost instead of falling back");

  const svc = read("InteRun/CoachAudioService.swift");
  assert.match(svc, /static let shared = CoachAudioService\(\)/,
    "the service is not shared, so the bridge and the web view hold different objects");
  assert.match(svc, /case "cuemap":/, "the native side cannot be told which clip a trigger means");
  const host = read("InteRun/WebHost.swift");
  assert.match(host, /CoachAudioService\.shared/,
    "WebHost builds its own instance again — the bridge would talk to an empty cue map");
});

test("⚠️ the cue map is pushed for BOTH ways a wrist run can begin", () => {
  // He hit the second one: the phone handover failed, he started it on his watch instead, and the
  // coach went quiet. Pushing only from the phone's start path fixes the half he had given up on.
  const app = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const pushes = (app.match(/coachPushWatchCueMap\(/g) || []).length - 1;   // minus the definition
  assert.ok(pushes >= 2,
    `the cue map is pushed from ${pushes} place(s) — it needs both startOnWatch and the new-run-id tick`);
  assert.match(app, /if \(live\.id !== WATCH_LIVE_ID\)[\s\S]{0,1200}coachPushWatchCueMap/,
    "a run started ON the watch never gets a cue map, so its coach still goes silent");

  // ⚠️ AND IT MUST BE CALLED WITH A SESSION TYPE. This is the defect that made the whole native
  // wrist-cue path inert from the day it shipped: coachScheduledPrompt read LIVE.session.type, and
  // LIVE is null at BOTH call sites by construction — the watch-initiated one is a live-tick handler
  // for a run the phone is not recording, and the phone-initiated one sets LIVE = null two lines
  // later because the WATCH is the recorder. The read threw, a try/catch swallowed it, every trigger
  // returned null, and the map posted to Swift contained ZERO files across all 13 triggers. So
  // playWatchCue could never return true, WatchBridge always fell through to evaluateJavaScript
  // against a suspended page, and the coach went silent the moment the phone went in a pocket —
  // which is the owner's report, against the fix written for it.
  assert.doesNotMatch(app, /coachPushWatchCueMap\(\)/,
    "the cue map is built with no session type again — it will post an empty map and play nothing");
  assert.match(app, /function coachScheduledPrompt\(trigger, idx, type\)/,
    "coachScheduledPrompt no longer takes a type, so it will read it off a null LIVE");

  // Every trigger the wrist can send must be in the map, or that one cue is the one that goes quiet.
  const wrist = ["session-start", "session-complete", "paused", "resumed",
    "warmup-start", "interval-start", "recovery-start", "cooldown-start", "easy-settle"];
  const list = app.slice(app.indexOf("WATCH_CUE_TRIGGERS = ["));
  for (const t of wrist) {
    assert.ok(list.slice(0, 400).includes('"' + t + '"'),
      `"${t}" is sent by the watch but absent from the cue map — that cue would be silent`);
  }
});
