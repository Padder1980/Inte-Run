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

const NAMES = ["coachPlay", "coachFail", "coachOnEnded", "coachDequeue", "coachStop",
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
  el.addEventListener("error", api.coachFail);

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
