import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE COACH'S SENTENCES ARE NOT CUT OFF, AND NOTHING TALKS OVER THEM. Added 2026-08-16, after the
 * owner ran a real session and reported two faults that turned out to be one:
 *
 *   "the voice coach was competing with the computer voice"
 *   "the selected voice coach kept missing words out of it's sentences"
 *
 * ⚠️ ONE <audio> ELEMENT, FOUR WRITERS, AND NOTHING TOLD THEM APART. `coachPlay` starts a prompt;
 * `coachSaySequence` stitches the pace numbers out of fragments; and a PERMANENT "ended" listener
 * (`coachOnEnded`) and a PERMANENT "error" listener (`coachFail`) both fire on the same element for
 * whatever either of the first two happens to be doing. `speakPaceNumbers` then waited a FIXED
 * 2600ms before taking the element — while the function's own comment claimed, and had always
 * claimed, that it "waits for the clip to finish rather than talking over it".
 *
 * Measured against the shipped audio: SEVEN OF THE NINE pace clips for the default coach are longer
 * than 2600ms (pace_ahead_2 is 5.28s, pace_behind_1 is 4.92s). So every pace correction was cut off
 * mid-word, and the src reassignment that cut it raised "error", which sent `coachFail` off to read
 * the WHOLE line again in the device voice on top of the fragments. Both reported faults, one cause.
 *
 * ⚠️ THIS TEST DRIVES THE REAL FUNCTIONS, LIFTED OUT OF THE BUILT PAGE, AGAINST THE REAL MANIFEST.
 * Asserting on the source would only pin the shape of today's fix; what matters is what a runner
 * hears, so the element is faked and it records every clip that was stopped before its own end.
 */

const PAGE = new URL("../web/app.html", import.meta.url);
const MANIFEST = new URL("../docs/voices/manifest.json", import.meta.url);

/** Lift a function out of the built page, brace-matched. */
function lift(html: string, name: string): string {
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}

const NAMES = ["coachPlay", "coachErr", "coachFail", "coachOnEnded", "coachDequeue", "coachStop",
  "coachSaySequence", "speakPaceNumbers", "coachFlushNumbers", "paceFragmentIds",
  "paceSentenceIds", "paceWords", "coachClip", "coachAudioEl", "coachEnabled"];

type Heard = { id: string; playedMs: number; fullMs: number; cut: boolean; at: number };
type Said = { text: string; at: number };

/**
 * Run one pace cue end to end on a virtual clock, and report what was audible.
 *
 * The element is deliberately honest about the two things that matter: reassigning `src` while a
 * clip is playing records the clip as CUT and raises "error" (which is what a real element does to
 * the load being abandoned), and a clip left alone plays to its manifest length and raises "ended".
 */
function playPaceCue(opts: { curSecPerKm: number; minSecPerKm: number; maxSecPerKm: number; promptId: string }) {
  const html = readFileSync(PAGE, "utf8");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const byKey: Record<string, any> = {};
  manifest.clips.forEach((c: any) => { byKey[c.coach + "/" + c.id] = c; });

  let now = 0, nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  const setTimeoutV = (fn: () => void, ms?: number) => {
    const id = nextId++; timers.push({ id, at: now + (ms || 0), fn }); return id;
  };
  const clearTimeoutV = (id: number) => { timers = timers.filter((t) => t.id !== id); };

  const heard: Heard[] = [];
  const said: Said[] = [];
  const listeners: { ended: (() => void)[]; error: (() => void)[] } = { ended: [], error: [] };
  const idOf = (file: string) => String(file).split("/").pop()!.replace(".mp3", "");
  let elTimer = 0;

  const el: any = {
    _src: "", _startedAt: 0, _dur: 0, paused: true, ended: true, currentTime: 0, volume: 1,
    onended: null, preload: "",
    _finish() {
      this.paused = true; this.ended = true; this.currentTime = 0;
      heard.push({ id: idOf(this._src), playedMs: this._dur, fullMs: this._dur, cut: false, at: now });
      const cb = this.onended; if (cb) cb();
      listeners.ended.forEach((f) => f());
    },
    set src(v: string) {
      if (!this.paused && this._src) {
        const played = now - this._startedAt;
        // ⚠️ A 25ms TAIL TRIM IS DELIBERATE (see coachSaySequence) — the fragments are scheduled a
        // hair early so the stitched sentence does not sound assembled. Only a real interruption counts.
        heard.push({ id: idOf(this._src), playedMs: played, fullMs: this._dur, cut: played < this._dur - 40, at: now });
        clearTimeoutV(elTimer);
        listeners.error.forEach((f) => f());
      }
      this._src = v;
      const clip = manifest.clips.find((c: any) => c.file === v);
      this._dur = clip ? Math.round(clip.duration * 1000) : 500;
    },
    get src() { return this._src; },
    play() {
      this.paused = false; this.ended = false; this.currentTime = 0.01; this._startedAt = now;
      clearTimeoutV(elTimer);
      elTimer = setTimeoutV(() => this._finish(), this._dur);
      return { catch: () => {} };
    },
    pause() { this.paused = true; },
    addEventListener(ev: "ended" | "error", fn: () => void) { listeners[ev].push(fn); },
  };

  const env: Record<string, any> = {
    COACH: {
      cfg: { enabled: true, coach: "guide", volume: 1, frequency: "normal" },
      manifest, ready: true, byKey,
      audio: null, current: null, queue: [], unlocked: true,
      history: {}, personal: null, personalTried: "",
      seq: 0, pendingNums: null, numT: 0,
    },
    LIVE: { done: false, pauseStart: 0 },
    VOICE_AVAILABLE: true,
    Audio: function () { return el; },
    speak: (t: string) => said.push({ text: t, at: now }),
    stopSpeech: () => {},
    setTimeout: setTimeoutV, clearTimeout: clearTimeoutV,
    Math, JSON, Object, String, Number,
  };
  const src = NAMES.map((n) => lift(html, n)).join("\n");
  const keys = Object.keys(env);
  const api = new Function(...keys, src + "; return {" + NAMES.join(",") + "};")(...keys.map((k) => env[k]));
  env.COACH.audio = el;
  el.addEventListener("ended", api.coachOnEnded);
  // ⚠ coachErr, NOT coachFail — the app wires the wrapper that ignores an aborted load, and a fixture
  // wiring the raw handler would exercise a program that no longer exists.
  el.addEventListener("error", api.coachErr);

  const tooFast = opts.curSecPerKm < opts.minSecPerKm;
  const snap = {
    currentPaceSecPerKm: opts.curSecPerKm,
    step: { targetPace: { minSecPerKm: opts.minSecPerKm, maxSecPerKm: opts.maxSecPerKm } },
  };
  api.coachPlay({ id: opts.promptId, text: "Ease into it. You are a little behind target pace.", priority: 40 });
  api.speakPaceNumbers(snap, tooFast);

  // Drain the clock. 60s is far longer than any cue, so anything still pending is a hang.
  for (;;) {
    const due = timers.filter((t) => t.at <= 60000).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at; due.fn();
  }
  return { heard, said, expected: api.paceSentenceIds(opts.curSecPerKm, snap.step.targetPace, tooFast) as string[] };
}

/** Every pace clip the default coach owns, so the numbers below are the shipped ones. */
function paceClips() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  return manifest.clips.filter((c: any) => c.coach === "guide" && /^pace_(ahead|behind|on)_/.test(c.id));
}

test("the shipped pace clips are longer than any fixed wait could safely assume", () => {
  // ⚠️ THIS IS THE MEASUREMENT THE OLD CODE NEEDED AND NEVER MADE. It is asserted rather than
  // merely noted, because the moment somebody reintroduces a constant it should fail loudly and
  // say why: there is no single number that is both long enough for pace_ahead_2 (5.28s) and short
  // enough to feel like a follow-on. The schedule has to come from the clip.
  const clips = paceClips();
  assert.ok(clips.length >= 6, "expected the pace correction clips, found " + clips.length);
  const longest = Math.max(...clips.map((c: any) => c.duration));
  assert.ok(longest > 2.6, "a fixed 2600ms wait is only safe if every clip is shorter; longest is " + longest + "s");
});

test("the coach finishes their sentence before the numbers start", () => {
  // 8:52/km against a 6:00-6:40 easy band — the owner's own session, where he was walking.
  const r = playPaceCue({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  const cut = r.heard.filter((h) => h.cut);
  assert.deepEqual(cut, [], "clips were stopped mid-word: " +
    cut.map((c) => c.id + " (" + c.playedMs + "ms of " + c.fullMs + "ms)").join(", "));
});

test("the device voice never speaks while a clip is still to be heard", () => {
  // ⚠️ THE OVERLAP IS SIMULTANEOUS, NOT SEQUENTIAL, which is why this asks "was there audio still
  // to come" rather than comparing a start against an end. Under the old code the reassignment that
  // cut the coach off raised "error" in the SAME tick that the first fragment began, so a check
  // written as "did the speech start before the clip ended" measured nothing and reported clean.
  const r = playPaceCue({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  for (const s of r.said) {
    const after = r.heard.filter((h) => h.at >= s.at);
    assert.equal(after.length, 0,
      "the device voice began at " + s.at + "ms with " + after.length + " clip(s) still to play: " +
      after.map((h) => h.id).join(", "));
  }
  assert.deepEqual(r.said, [], "every fragment exists for this coach, so nothing should be synthesised at all");
});

test("the whole stitched sentence is played, in order", () => {
  const r = playPaceCue({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  // Derived from the code's own rule, so the expectation cannot drift from it. A 6:00 edge has no
  // seconds fragment at all, which is exactly the sort of thing a hand-written list gets wrong.
  assert.deepEqual(r.heard.map((h) => h.id), ["pace_behind_1"].concat(r.expected));
});

test("it holds for a fast verdict and an awkward number too", () => {
  // 4:07 against a 4:30-5:05 band: too fast, so the edge quoted is the SLOW end (5:05) — and both
  // numbers carry seconds, which is the longest sentence this can produce. Picking 5:00 for the
  // edge is what the first version of this fixture did, and a round number drops its seconds
  // fragment entirely, so the "longest sentence" case was never actually exercised.
  const r = playPaceCue({ curSecPerKm: 247, minSecPerKm: 270, maxSecPerKm: 305, promptId: "pace_ahead_2" });
  assert.deepEqual(r.heard.filter((h) => h.cut), [], "a clip was cut off on the fast path");
  assert.deepEqual(r.said, [], "nothing should be synthesised");
  assert.deepEqual(r.heard.map((h) => h.id), ["pace_ahead_2"].concat(r.expected));
  assert.ok(r.expected.length >= 5, "expected both edges to carry seconds: " + r.expected.join(" "));
});

test("stopping the coach cancels a pace readout that has not left yet", () => {
  const html = readFileSync(PAGE, "utf8");
  const src = lift(html, "coachStop").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ Both of these outlive the audio element's own state. A readout still pending when a run is
  // paused or finished would arrive seconds later over silence, describing a run that has stopped.
  assert.match(src, /pendingNums = null/, "coachStop leaves a pace readout pending");
  assert.match(src, /clearTimeout\(COACH\.numT\)/, "coachStop leaves the fallback timer armed");
  assert.match(src, /COACH\.seq = 0/, "coachStop does not release a stitched sentence in flight");
});

test("the two permanent listeners stand aside while a sentence is being stitched", () => {
  const html = readFileSync(PAGE, "utf8");
  // ⚠️ These are addEventListener registrations on the shared element, so they fire for whatever
  // it happens to be doing. Without the guard, coachFail read the pace prompt still sitting in
  // COACH.current and spoke the entire line over the fragments — the reported second voice — and
  // coachOnEnded nulled COACH.current at every fragment boundary and started the queue on top.
  for (const fn of ["coachFail", "coachOnEnded"]) {
    const src = lift(html, fn).replace(/^\s*\/\/.*$/gm, "");
    assert.match(src, /if \(COACH\.seq\) return/, fn + " runs during a stitched sentence");
  }
});

test("no fixed wait is left anywhere in the pace readout path", () => {
  const html = readFileSync(PAGE, "utf8");
  const src = lift(html, "speakPaceNumbers").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/2600/.test(src), "the fixed 2600ms wait is back");
  // The remaining timer is a ceiling for a clip whose "ended" never arrives, and it must be derived
  // from the clip that is actually playing rather than picked.
  assert.match(src, /clip\.duration/, "the fallback timer must be derived from the clip, not a constant");
  assert.match(src, /pendingNums/, "the readout must be queued behind the coach's own line");
});

// ---- the native transport ----------------------------------------------------------------------

/**
 * ⚠️ IN THE NATIVE APP SWIFT PLAYS THE CLIPS, AND THAT IS ABOUT THE RUNNER'S MUSIC. WebKit manages
 * the shared AVAudioSession for its own <audio> elements and sets plain playback with NO options,
 * dropping the duck/mix this app configures at launch — so a cue interrupts whatever else is playing
 * and, because WebKit never deactivates, nothing tells the music app it may resume. Reported from a
 * real run on 2026-08-16, and specifically NOT the device voice: "it wasn't the robot voice knocking
 * the music off it was the real coach voice."
 *
 * The whole point of doing it as a SHIM is that the sequencing logic above it does not change, so
 * these run the identical scenario through the bridge and demand the identical result.
 */
function playPaceCueNative(opts: { curSecPerKm: number; minSecPerKm: number; maxSecPerKm: number; promptId: string }) {
  const html = readFileSync(PAGE, "utf8");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const byKey: Record<string, any> = {};
  manifest.clips.forEach((c: any) => { byKey[c.coach + "/" + c.id] = c; });

  let now = 0, nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  const setTimeoutV = (fn: () => void, ms?: number) => { const id = nextId++; timers.push({ id, at: now + (ms || 0), fn }); return id; };
  const clearTimeoutV = (id: number) => { timers = timers.filter((t) => t.id !== id); };

  const heard: Heard[] = [];
  const said: Said[] = [];
  const posted: any[] = [];
  const win: any = {};
  // Stand in for Swift: accept a file, play it for its real length, then call back on the token.
  let cur: { token: number; file: string; startedAt: number; dur: number } | null = null;
  const bridge = {
    postMessage(msg: any) {
      posted.push(msg);
      if (msg.action === "stopPage") { cur = null; return; }
      if (msg.action !== "playPage") return;
      if (cur) {
        // A new clip while one is sounding is an interruption, exactly as on the element.
        heard.push({ id: String(cur.file).split("/").pop()!.replace(".mp3", ""), playedMs: now - cur.startedAt, fullMs: cur.dur, cut: (now - cur.startedAt) < cur.dur - 40, at: now });
      }
      const clip = manifest.clips.find((c: any) => c.file === msg.file);
      const dur = clip ? Math.round(clip.duration * 1000) : 0;
      if (!clip) { const t = msg.token; setTimeoutV(() => win.__interunCoachClipEnded(t, false), 1); cur = null; return; }
      cur = { token: msg.token, file: msg.file, startedAt: now, dur };
      const mine = cur;
      setTimeoutV(() => {
        if (cur !== mine) return;
        heard.push({ id: String(mine.file).split("/").pop()!.replace(".mp3", ""), playedMs: mine.dur, fullMs: mine.dur, cut: false, at: now });
        cur = null;
        win.__interunCoachClipEnded(mine.token, true);
      }, dur);
    },
  };
  win.webkit = { messageHandlers: { interunCoachAudio: bridge } };
  win.__interunCoachNativePlay = 1;

  const env: Record<string, any> = {
    COACH: {
      cfg: { enabled: true, coach: "guide", volume: 1, frequency: "normal" },
      manifest, ready: true, byKey,
      audio: null, current: null, queue: [], unlocked: false,
      history: {}, personal: null, personalTried: "",
      seq: 0, pendingNums: null, numT: 0, native: false,
    },
    LIVE: { done: false, pauseStart: 0 },
    VOICE_AVAILABLE: true,
    Audio: function () { throw new Error("the real <audio> element must not be used in the native app"); },
    speak: (t: string) => said.push({ text: t, at: now }),
    stopSpeech: () => {},
    setTimeout: setTimeoutV, clearTimeout: clearTimeoutV,
    window: win,
    Math, JSON, Object, String, Number, Error,
  };
  const NATIVE_NAMES = NAMES.concat(["coachNativeAudioBridge", "coachNativeAudioShim", "coachUnlock"]);
  const src = NATIVE_NAMES.map((n) => lift(html, n)).join("\n");
  const keys = Object.keys(env);
  const api = new Function(...keys, src + "; return {" + NATIVE_NAMES.join(",") + "};")(...keys.map((k) => env[k]));

  api.coachUnlock();
  const tooFast = opts.curSecPerKm < opts.minSecPerKm;
  const snap = { currentPaceSecPerKm: opts.curSecPerKm, step: { targetPace: { minSecPerKm: opts.minSecPerKm, maxSecPerKm: opts.maxSecPerKm } } };
  api.coachPlay({ id: opts.promptId, text: "Ease into it. You are a little behind target pace.", priority: 40 });
  api.speakPaceNumbers(snap, tooFast);
  for (;;) {
    const due = timers.filter((t) => t.at <= 60000).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at; due.fn();
  }
  return { heard, said, posted, env, expected: api.paceSentenceIds(opts.curSecPerKm, snap.step.targetPace, tooFast) as string[] };
}

test("in the native app every clip goes to Swift, and none to an <audio> element", () => {
  // The fake Audio() constructor throws, so any fall-through to the page element fails this outright.
  const r = playPaceCueNative({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  assert.equal(r.env.COACH.native, true, "the bridge was present but not detected");
  const plays = r.posted.filter((m) => m.action === "playPage");
  assert.equal(plays.length, 1 + r.expected.length, "not every clip was handed over: " + JSON.stringify(r.posted));
  for (const m of plays) assert.match(m.file, /^voices\//, "a non-clip was sent to the native player: " + m.file);
  // ⚠️ EVERY CALL NEEDS ITS OWN TOKEN. A late answer for a clip already moved past would otherwise
  // advance the sentence twice, which is the fragment-boundary fault in a different disguise.
  assert.equal(new Set(plays.map((m) => m.token)).size, plays.length, "tokens are not unique");
});

test("the silent unlock clip is never handed to the native player", () => {
  // ⚠️ It is a data: URI. Swift would look for it in the app bundle, fail, and report a failure —
  // which lands in coachFail and speaks the current prompt in the device voice. An unlock step would
  // have produced a robot voice at the start tap, on every run.
  const r = playPaceCueNative({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  for (const m of r.posted) assert.ok(!/^data:/.test(String(m.file || "")), "the unlock clip reached Swift");
});

test("the native path behaves exactly as the browser one does", () => {
  const web = playPaceCue({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  const nat = playPaceCueNative({ curSecPerKm: 532, minSecPerKm: 360, maxSecPerKm: 400, promptId: "pace_behind_1" });
  assert.deepEqual(nat.heard.map((h) => h.id), web.heard.map((h) => h.id), "a different sentence came out");
  assert.deepEqual(nat.heard.filter((h) => h.cut), [], "a clip was cut off on the native path");
  assert.deepEqual(nat.said, [], "the device voice spoke on the native path");
});

test("stopping the coach tells Swift to stop too", () => {
  const html = readFileSync(PAGE, "utf8");
  // ⚠️ coachStop pauses the element; on the shim that must reach the native player, or a clip keeps
  // sounding after the runner has paused or finished and the audio session is never released.
  const shim = lift(html, "coachNativeAudioShim").replace(/^\s*\/\/.*$/gm, "");
  assert.match(shim, /action: "stopPage"/, "pausing the shim does not stop the native player");
  assert.match(lift(html, "coachStop"), /pause\(\)/, "coachStop no longer pauses the element");
});

test("a reply that never arrives does not wedge the coach for the rest of the run", () => {
  // ⚠️ Swift answers through evaluateJavaScript, which this project has already recorded doing
  // NOTHING against a suspended web content process and reporting no error for it. One lost reply
  // would otherwise leave COACH.current set forever, and every later cue would be discarded as an
  // interruption of a line that finished minutes ago — a coach that goes quiet after one sentence.
  const html = readFileSync(PAGE, "utf8");
  let now = 0, nextId = 1;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  const env: Record<string, any> = {
    setTimeout: (fn: () => void, ms?: number) => { const id = nextId++; timers.push({ id, at: now + (ms || 0), fn }); return id; },
    clearTimeout: (id: number) => { timers = timers.filter((t) => t.id !== id); },
    String, Number, Math, Object,
    window: {} as any,
  };
  const src = lift(html, "coachNativeAudioShim");
  const make = new Function(...Object.keys(env), src + "; return coachNativeAudioShim;")(...Object.keys(env).map((k) => env[k]));
  // A bridge that swallows everything — the lost-reply case exactly.
  const shim = make({ postMessage() {} });
  let ended = 0;
  shim.addEventListener("ended", () => { ended++; });
  shim.src = "voices/guide/pace_behind_1.mp3";
  shim.play();
  assert.equal(ended, 0, "it must not report an end before the clip could have finished");

  for (;;) {
    const due = timers.filter((t) => t.at <= 60000).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at; due.fn();
  }
  assert.equal(ended, 1, "the watchdog never released the coach");
  assert.ok(now >= 6000, "it gave up after only " + now + "ms — long enough to cut a real clip short");

  // And a real answer must win, leaving nothing for the watchdog to double-fire on.
  const posted: any[] = [];
  const shim2 = make({ postMessage: (m: any) => posted.push(m) });
  let ended2 = 0;
  shim2.addEventListener("ended", () => { ended2++; });
  shim2.src = "voices/guide/min_8.mp3";
  shim2.play();
  env.window.__interunCoachClipEnded(posted[0].token, true);
  assert.equal(ended2, 1);
  for (;;) {
    const due = timers.filter((t) => t.at <= 60000).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at; due.fn();
  }
  assert.equal(ended2, 1, "the watchdog fired on top of a clip that had already reported");
});

test("an older native build is never handed clips it cannot play", () => {
  // ⚠️ THE HAZARD THAT MAKES THIS GATE A CAPABILITY FLAG RATHER THAN A HANDLER CHECK. The page
  // updates OVER THE AIR; Swift does not. `interunCoachAudio` has been a registered message handler
  // since the locked-phone work, so a handler-exists guard is satisfied by a build that falls
  // through `default: break` on playPage — every clip handed over, none played, no reply, and a
  // coach silent for the whole run. Pushing this page without the flag would have done exactly that
  // to the build already on the owner's phone.
  const html = readFileSync(PAGE, "utf8");
  const src = lift(html, "coachNativeAudioBridge");
  assert.match(src, /__interunCoachNativePlay/, "the bridge is gated on the handler alone");

  let posted = 0;
  const env: Record<string, any> = {
    window: { webkit: { messageHandlers: { interunCoachAudio: { postMessage: () => { posted++; } } } } },
  };
  const fn = new Function("window", src + "; return coachNativeAudioBridge;")(env.window);
  assert.equal(fn(), null, "an old build with the handler but no flag was treated as capable");
  env.window.__interunCoachNativePlay = 1;
  assert.ok(fn(), "a build that sets the flag must be used");
  assert.equal(posted, 0, "detection must not post anything");
});

test("the native app declares the capability it just gained", () => {
  const swift = readFileSync(new URL("../ios/InteRun/WebHost.swift", import.meta.url), "utf8");
  assert.match(swift, /window\.__interunCoachNativePlay = 1;/, "WebHost no longer declares the flag");
  const service = readFileSync(new URL("../ios/InteRun/CoachAudioService.swift", import.meta.url), "utf8");
  assert.match(service, /case "playPage":/, "the flag is declared but the action is not handled");
  assert.match(service, /case "stopPage":/, "stopPage is not handled, so a pause leaves a clip sounding");
});

/**
 * DRIVE THE COACH OVER ONE SHARED ELEMENT, WITH A play() WHOSE REJECTION I CONTROL.
 *
 * ⚠️ ITS OWN ELEMENT, NOT playPaceCue's. That one is built for the stitched-sentence scenario and its
 * play() can never reject, which is the whole subject here — and widening it would change the fixture
 * fifteen passing guards depend on.
 */
function coachRig() {
  const html = readFileSync(PAGE, "utf8");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const byKey: Record<string, any> = {};
  manifest.clips.forEach((c: any) => { byKey[c.coach + "/" + c.id] = c; });
  const said: string[] = [];
  // ⚠️ EVERY catch HANDLER, NOT JUST THE LAST. The whole scenario is a rejection from an EARLIER line
  // arriving after a later one has taken the element, so a rig that keeps only the most recent handler
  // can only ever reject the line that is currently playing — which is not the defect. Measured: the
  // first version did exactly that and reported the fix as broken.
  const rejects: (() => void)[] = [];
  const listeners: { ended: (() => void)[]; error: (() => void)[] } = { ended: [], error: [] };
  const el: any = {
    _src: "", paused: true, ended: true, currentTime: 0, volume: 1, onended: null, preload: "",
    error: null,
    set src(v: string) {
      // A real element raises "error" for the load it is abandoning, with MEDIA_ERR_ABORTED.
      if (!this.paused && this._src) { this.error = { code: 1 }; listeners.error.forEach((f) => f()); }
      this._src = v;
    },
    get src() { return this._src; },
    play() { this.paused = false; this.ended = false; return { catch: (fn: () => void) => { rejects.push(fn); } }; },
    pause() { this.paused = true; },
    addEventListener(ev: "ended" | "error", fn: () => void) { listeners[ev].push(fn); },
  };
  const env: Record<string, any> = {
    COACH: {
      cfg: { enabled: true, coach: "guide", volume: 1, frequency: "normal" },
      manifest, ready: true, byKey, audio: el, current: null, queue: [], unlocked: true,
      history: {}, personal: null, personalTried: "", seq: 0, pendingNums: null, numT: 0, gen: 0,
    },
    LIVE: { done: false, pauseStart: 0 },
    VOICE_AVAILABLE: true,
    Audio: function () { return el; },
    speak: (t: string) => said.push(t),
    stopSpeech: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    Math, JSON, Object, String, Number, Date,
  };
  const src = NAMES.map((n) => lift(html, n)).join("\n");
  const keys = Object.keys(env);
  const api = new Function(...keys, src + "; return {" + NAMES.join(",") + "};")(...keys.map((k) => env[k]));
  el.addEventListener("ended", api.coachOnEnded);
  el.addEventListener("error", api.coachErr);
  const clipFor = (id: string) => byKey["guide/" + id];
  return {
    said, el, COACH: env.COACH,
    play: (id: string, text: string) => {
      assert.ok(clipFor(id), "no shipped clip for " + id + "; this fixture cannot express the defect");
      api.coachPlay({ id: id, text: text, priority: 40 });
    },
    stop: () => api.coachStop(),
    /** Reject the nth play() that was started — 0 is the first, which is the one a stop aborts. */
    rejectPlay: (n = 0) => {
      assert.ok(rejects[n], "play() number " + n + " was never given a catch handler");
      rejects[n]!();
    },
    plays: () => rejects.length,
  };
}

test("BLOCKER: silencing the coach cannot make the next line come out in the device voice", () => {
  // ⚠️⚠️ THE OWNER'S REPORT, WITHIN THE HOUR OF THE ONE-SCREEN CHANGE: "the voice has turned back into the
  // robot." Cause: stopLive learned to call coachStop, coachStop pauses the element, and pausing ABORTS an
  // in-flight play() and rejects its promise. That rejection lands LATER — by which time liveFinish has set
  // COACH.current to the completion prompt — and coachFail read that and spoke it with the device engine,
  // over the top of its own clip. Driven here rather than asserted on the source, because the whole defect
  // is the ORDER two asynchronous things arrive in.
  const r = coachRig();
  r.play("interval_start_1", "Here we go. Settle into the effort.");
  assert.ok(r.el.src, "no clip was handed over, so this fixture cannot express the defect");
  // A run ends: the coach is silenced, then the completion cue is fired into the empty queue.
  r.stop();
  r.play("complete_1", "Session complete. Excellent work today. Recover well.");
  // Only NOW does the ABORTED line's rejection arrive — the first play(), not the completion cue's.
  assert.equal(r.plays(), 2, "expected two play() calls: the interval line and the completion cue");
  r.rejectPlay(0);
  assert.deepEqual(r.said, [],
    "the aborted line's failure was attributed to the completion cue, which the device voice then read " +
    "out loud: " + JSON.stringify(r.said));
  // ⚠️ AND A GENUINE FAILURE MUST STILL DEGRADE TO SPEECH, or this guard has traded one silence for
  // another. A clip that really cannot play is the whole reason coachFail exists.
  const g = coachRig();
  g.play("interval_start_1", "Here we go. Settle into the effort.");
  g.rejectPlay(0);
  assert.equal(g.said.length, 1,
    "a clip that genuinely fails no longer falls back to the device voice, so the coach goes silent");
});

test("BLOCKER: an abandoned load is not a failure to play", () => {
  // ⚠️ Reassigning src while a load is pending raises "error" for the load being DROPPED, on a permanent
  // listener attached to a shared element — so the event arrives after COACH.current has moved on. Neither
  // the src nor a generation stamp can tell the two apart, because both have already advanced by the time
  // it fires. MediaError.MEDIA_ERR_ABORTED (code 1) is the only discriminator: it means the fetch was
  // stopped at our own request. Codes 2, 3 and 4 are real and must still degrade to speech.
  const src = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = src.indexOf("function coachErr(");
  assert.ok(at > 0, "coachErr is gone; the abandoned-load error speaks the wrong line again");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.match(body, /error\.code === 1/, "an aborted load is treated as a failure to play");
  assert.match(body, /coachFail\(\)/, "a genuine media error no longer degrades to speech");
  // And the element must be wired to the wrapper, not to the raw handler.
  assert.match(src, /addEventListener\("error", coachErr\)/,
    "the element is wired straight to coachFail, so an aborted load still speaks the wrong line");
  assert.ok(!/addEventListener\("error", coachFail\)/.test(src),
    "the raw handler is still attached somewhere");
});
