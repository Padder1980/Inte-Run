import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ THE COACH GOING SILENT ON A LOCKED PHONE WAS A TRIGGER PROBLEM, NOT AN AUDIO ONE — which is why
 * "we set an AVAudioSession and added the background mode" never fixed it, twice. Cues are fired from the
 * page's live tick; iOS suspends the web content process when the screen locks, so nothing asks for the
 * next cue. An audio session keeps ALREADY-PLAYING audio alive; it cannot keep JavaScript running.
 *
 * The fix hands the deterministic cues to the native shell, which stays alive on the location background
 * mode and plays them with AVAudioPlayer. These tests pin the parts that fail SILENTLY — a schedule that
 * builds empty, or a native path that is never told anything, both present as "the coach is a bit quiet".
 */
const app = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const swift = () => readFileSync(new URL("../ios/InteRun/CoachAudioService.swift", import.meta.url), "utf8");

function lift(name: string) {
  const html = app();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}

test("the schedule is built from a DETERMINISTIC lookup, not the live selector", () => {
  // ⚠️ The defect that shipped in the first cut and produced a schedule with one entry in it. selectPrompt
  // is stateful and time-relative: asked for a line at a future moment against a history that has not
  // reached it, it returns null. Every step cue came back empty and the failure was invisible — the
  // runner would simply have heard less.
  const body = lift("coachNativeSchedule");
  assert.ok(!/RC\.selectPrompt/.test(body),
    "coachNativeSchedule uses selectPrompt again — it returns null for future moments and the schedule will build empty");
  assert.match(body, /coachScheduledPrompt\(/, "no deterministic picker in the schedule builder");
  assert.match(lift("coachScheduledPrompt"), /RC\.promptsFor\(/,
    "the picker no longer asks the catalogue for this trigger's candidates");
});

test("the schedule is pushed on every event that moves the run", () => {
  // A schedule of offsets from "now" is only true until the run drifts. Start, resume and every step
  // boundary must re-push, or the locked-phone cues creep away from the session being run.
  const html = app();
  const calls = (html.match(/coachNativeSchedule\(\)/g) || []).length;
  assert.ok(calls >= 5, `coachNativeSchedule is called ${calls} times — start, resume and step changes are not all covered`);
  // And stopping must clear it: a cue from a finished run is the worst kind of ghost.
  assert.match(lift("stopLive"), /action: "clear"/, "stopping a run does not clear the native schedule");
});

test("the page marks natively-spoken lines as played", () => {
  // Without this the runner unlocks their phone and immediately hears the line they just heard.
  const html = app();
  assert.match(html, /window\.__interunCoachPlayed = function/, "no callback for a natively-played cue");
  assert.match(html, /__interunCoachPlayed[\s\S]{0,300}?RC\.markPlayed/,
    "the callback does not mark the prompt played in the page's own history");
});

test("⚠️ the native player dedupes per SLOT, not per clip", () => {
  // A session legitimately reuses a line — a real threshold session drew warmup_2 twice, eight minutes
  // apart. Keyed on the prompt id, the second was silently swallowed.
  const s = swift();
  assert.match(s, /let key: Int/, "cues carry no per-slot key");
  assert.match(s, /played = Set<Int>/, "the played-set is keyed by clip id again — repeats will be swallowed");
  assert.match(s, /played\.contains\(\$0\.key\)/, "dedupe is not using the slot key");
});

test("⚠️ the native side only speaks while the page cannot", () => {
  // Both sides playing means every line twice.
  assert.match(swift(), /applicationState != \.active/,
    "the native player does not check whether the app is in the foreground — cues will double up");
});

test("the audio player is owned strongly, on both sides", () => {
  // An AVAudioPlayer with no owner is deallocated mid-sentence; a message handler is held weakly by
  // WKUserContentController, so the service itself needs an owner too.
  assert.match(swift(), /private var player: AVAudioPlayer\?/, "no retained player");
  const host = readFileSync(new URL("../ios/InteRun/WebHost.swift", import.meta.url), "utf8");
  assert.match(host, /var coachAudio: CoachAudioService\?/,
    "the coordinator does not retain the coach audio service — it would be collected and the coach would go silent");
  assert.match(host, /CoachAudioService\.messageName/, "the service is never registered with the web view");
});

test("a stale cue is dropped rather than played late", () => {
  // Hearing "settle into the warm-up" ten minutes into the work is worse than hearing nothing.
  assert.match(swift(), /staleAfter/, "no staleness guard — a late cue would play at the wrong moment");
});

test("clip paths resolve where the build actually puts them", () => {
  // docs/ is embedded as web/, so a manifest path of "voices/guide/prep_1.mp3" is at
  // "web/voices/guide/prep_1.mp3". Getting this wrong fails silently: the file simply is not found.
  assert.match(swift(), /appendingPathComponent\("web\/"\)/,
    "the native player does not look under web/ — every clip lookup will miss");
  // ⚠️ Read the CLIP list, not the coach roster. `manifest.coaches` is [{id,name,voice,bytes}] — no file
  // paths at all — so the first cut asserted against a coach entry and failed for the wrong reason.
  const manifest = JSON.parse(readFileSync(new URL("../docs/voices/manifest.json", import.meta.url), "utf8")) as any;
  const clips: any[] = manifest.clips ?? [];
  assert.ok(clips.length > 0, "the voice manifest has no clip list to check");
  assert.match(clips[0].file, /^voices\//, "manifest paths are no longer relative to the page root");
});
