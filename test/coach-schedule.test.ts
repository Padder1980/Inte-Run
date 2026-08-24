import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE LOCKED-PHONE SCHEDULE SAYS THE RIGHT THING AT THE RIGHT TIME. Added 2026-08-22, after the owner
 * ran a custom 1 km session through the phone and reported three faults from one outing:
 *
 *   "once it hit the halfway point the voice coach triggered saying session complete.....it didnt
 *    stop the session it just fired the voice command"
 *   "at the end of the session, the volume on my music ducked but the voice stating that the session
 *    had finished didnt arrive until approximately 30 seconds afterwards"
 *   "The 3rd screenshot displays a message that i got when i unlocked the phone just before the
 *    halfway point in the session"
 *
 * ⚠️ THE FIRST TWO ARE ONE CAUSE AND THE PROOF IS ARITHMETIC. `coachNativeSchedule` built the whole
 * locked-phone schedule by summing `stepSecs`, which converts a DISTANCE-gated step at the
 * PRESCRIBED pace. His step targeted 5:17-5:45, so 1 km was scheduled as 331 s; he ran it in 11:00.
 * The finishing cue therefore fired at 331 s of a 660 s run - almost exactly halfway - and, since
 * the session was "Step 1 of 1", the re-push that happens at a step boundary never fired either, so
 * the estimate made in the first second was never corrected.
 *
 * ⚠️ THESE DRIVE THE REAL FUNCTIONS, LIFTED OUT OF THE BUILT PAGE. A source assertion could only
 * ever pin the shape of today's fix; what matters is the second a cue is scheduled for.
 */

const PAGE = new URL("../web/app.html", import.meta.url);

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

/** Lift a top-level `const NAME = ...;` (single statement, no braces inside). */
function liftConst(html: string, name: string): string {
  const m = new RegExp("\\nconst " + name + " = [^;]+;").exec(html);
  assert.ok(m, "const not found in the build: " + name);
  return m![0];
}

const NAMES = ["coachNativeSchedule", "coachPredictedEndSec", "coachRescheduleTick",
  "coachRunTick", "coachReleaseStale", "stepSecs", "coachOnEnded", "coachDequeue",
  "coachStepTrigger", "isStrideStep"];
const CONSTS = ["COACH_RESCHED_MS", "COACH_RESCHED_DRIFT_S", "COACH_STALE_MS"];

type Posted = { action: string; cues?: { id: string; inMs: number; file: string }[] };
type Env = {
  posts: Posted[];
  predict: () => number;
  COACH: Record<string, unknown>;
  LIVE: Record<string, unknown>;
  now: number;
  run: (fn: string) => void;
  last: () => Posted | undefined;
  cueAt: (id: string) => number | null;
};

/**
 * Build a live GPS run with the given steps and drive the real schedule against it.
 *
 * @param elapsedSec  how long the run has been going
 * @param coveredM    how far the runner has actually got in that time
 */
function env(steps: unknown[], elapsedSec: number, coveredM: number, type = "easy"): Env {
  const html = readFileSync(PAGE, "utf8");
  const posts: Posted[] = [];
  const src = NAMES.map((n) => lift(html, n)).join("\n")
    + "\n" + CONSTS.map((n) => liftConst(html, n)).join("\n") + "\n"
    + "return { schedule: coachNativeSchedule, predict: coachPredictedEndSec,"
    + " resched: coachRescheduleTick, tick: coachRunTick, release: coachReleaseStale };";

  const ctx = {
    posts,
    COACH: { current: null as unknown, queue: [] as unknown[], seq: 0, playAt: 0,
             reschedAt: 0, reschedEta: null as number | null, audio: { pause() {} },
             pendingNums: null, numT: 0, cfg: { volume: 1 } },
    LIVE: {
      started: true, done: false, mode: "gps",
      session: { type, steps, estimatedDurationSeconds: 0 },
      rt: { snapshot: () => ({ distanceMeters: coveredM }) },
    },
    now: 1_000_000,
  };

  // Everything the lifted functions reach that is not part of what is under test.
  const fn = new Function(
    "COACH", "LIVE", "ctx",
    "coachNativeAvailable", "coachEnabled", "coachNativePost", "coachScheduledPrompt",
    "coachClip", "liveNowMs", "Date", "coachFlushNumbers", "clearTimeout", "coachPlay",
    src,
  );
  const api = (fn as (...a: unknown[]) => unknown)(
    ctx.COACH, ctx.LIVE, ctx,
    () => true,
    () => true,
    (m: Posted) => { posts.push(m); },
    (trigger: string) => ({ id: trigger + "_1", file: trigger + "/1.mp3", text: trigger }),
    (id: string) => ({ id, file: id + ".mp3", duration: 2 }),
    () => elapsedSec * 1000,
    { now: () => ctx.now },
    () => false,
    () => {},
    (p: unknown) => { ctx.COACH.current = p; },
  ) as unknown as Record<string, () => void>;

  const last = () => posts.filter((p) => p.action === "schedule").slice(-1)[0];
  return {
    posts, COACH: ctx.COACH, LIVE: ctx.LIVE, now: ctx.now,
    predict: () => (api["predict"] as unknown as () => number)(),
    run: (k) => { const f = api[k]; assert.ok(f, "not lifted: " + k); f(); },
    last,
    cueAt: (id) => {
      const s = last();
      const c = s && s.cues && s.cues.find((x) => x.id.startsWith(id));
      return c ? Math.round(c.inMs / 1000) : null;
    },
  };
}

const timed = (sec: number) => ({ durationSeconds: sec, kind: "steady", targetRpe: { min: 3, max: 4 } });
const dist = (m: number, pace: number) => ({
  distanceMeters: m, kind: "steady", targetRpe: { min: 3, max: 4 },
  targetPaceSecPerKm: { minSecPerKm: pace - 14, maxSecPerKm: pace + 14 },
});

test("BLOCKER: a distance-gated step is timed at the runner's OWN pace, not the prescription", () => {
  // His session, his numbers: 1 km prescribed at 5:31/km, run at 11:00/km.
  //
  // ⚠️ MEASURED ON THE ARITHMETIC, NOT ON THE FINISHING CUE, AND THE FIRST VERSION OF THIS GUARD
  // ESCAPED ITS OWN RE-BREAK BECAUSE OF IT. The next test removes the finishing cue from a
  // distance-gated session altogether, so a cue-based assertion here is satisfied by its absence
  // whatever the timing does — double-covered, and discriminating nothing. coachPredictedEndSec IS
  // the estimate: it is what the drift gate compares and what every scheduled second hangs off.
  const e = env([dist(1000, 331)], 330, 500);
  const pred = e.predict();
  assert.ok(pred > 560 && pred < 760,
    "half a kilometre in 330 s predicts a ~660 s finish; at the prescribed 5:31 it predicts 331. Got "
    + pred);
});

test("BLOCKER: and a LATER step's cue therefore starts at the honest second", () => {
  // The other way the same arithmetic is visible, and the one a runner meets: everything placed after
  // a distance-gated step depends on how long that step is believed to take.
  const e = env([dist(1000, 331), timed(300)], 330, 500);
  e.run("schedule");
  const all = e.last();
  assert.ok(all && all.cues && all.cues.length >= 1, "no cues at all: " + JSON.stringify(all));
  // Step 2 begins when step 1 finishes: ~660 s into a run that is 330 s old, so ~330 s from now.
  const later = all!.cues!.slice(-1)[0]!;
  assert.ok(later.inMs > 240_000,
    "the second step was placed using the prescribed pace, not the pace being run: "
    + JSON.stringify(all));
});

test("BLOCKER: a distance-gated session gets NO scheduled finishing cue at all", () => {
  // ⚠️ Even a perfectly estimated finish is a guess: a runner who eases off in the last kilometre
  // still hears "session complete" before they have finished it, and nothing about hearing it makes
  // the session stop. A distance-gated session ends when the ground is covered, which only the page
  // can see, so the cue belongs to the page's own tick and to nothing else.
  const e = env([dist(1000, 331)], 330, 500);
  e.run("schedule");
  assert.equal(e.cueAt("session-complete"), null,
    "a distance-gated session must not schedule a finish it cannot know the time of");
});

test("a TIMED session still schedules its finishing cue, at the right second", () => {
  // The other half of the rule: taking the cue away from every session would be a silent regression
  // for the locked-phone case it was written for.
  const e = env([timed(600)], 100, 300);
  e.run("schedule");
  assert.equal(e.cueAt("session-complete"), 500, JSON.stringify(e.last()));
});

test("BLOCKER: the schedule is refreshed on the clock, so a ONE-STEP session is corrected too", () => {
  // ⚠️ THIS IS THE HALF THAT MADE THE FIRST FAULT DURABLE. coachNativeSchedule was re-pushed at a
  // step boundary, and "Step 1 of 1" has none — so the estimate built in the first second stood for
  // the whole run however far the runner's real pace diverged from it.
  const e = env([timed(600)], 100, 300);
  e.run("tick");
  const first = e.posts.filter((p) => p.action === "schedule").length;
  assert.equal(first, 1, "the first tick of a run must push a schedule");
  e.run("tick");
  assert.equal(e.posts.filter((p) => p.action === "schedule").length, first,
    "an immediate second tick must not re-push: nothing has changed and each push replaces the list");
});

test("the refresh is skipped while the predicted finish has not moved", () => {
  // A runner holding their pace produces the same prediction every time. Re-posting an identical
  // schedule is traffic for nothing, and every post replaces the whole list — so a needless one is
  // a chance to lose a cue that was about to fire.
  const e = env([timed(600)], 100, 300);
  e.run("tick");
  e.COACH.reschedAt = 0;                       // let the interval elapse
  e.run("tick");
  assert.equal(e.posts.filter((p) => p.action === "schedule").length, 1,
    "the drift gate must suppress a re-push when the prediction is unchanged");
});

test("the refresh DOES fire once the predicted finish has moved", () => {
  const e = env([dist(1000, 331)], 330, 500);
  e.run("tick");
  e.COACH.reschedAt = 0;
  e.COACH.reschedEta = 100;                    // as if we had predicted something very different
  e.run("tick");
  assert.equal(e.posts.filter((p) => p.action === "schedule").length, 2,
    "a prediction that has moved by more than the drift bound must re-push");
});

test("BLOCKER: a coach line that has outlived its clip is released by the CLOCK", () => {
  // ⚠️ THE SECOND FAULT. The shim's watchdog is a setTimeout, so it is frozen with the page it
  // belongs to — and the clip it was covering was handed to Swift and answered through
  // evaluateJavaScript, which does nothing at all against a suspended web content process. So
  // COACH.current stayed set for as long as the phone stayed locked; coachTrigger QUEUES anything of
  // priority 40 or more rather than dropping it, and the queue is only drained when the current line
  // ends. The finishing cue was chosen at the right moment and arrived once the wedge cleared.
  const e = env([timed(600)], 100, 300);
  const stale = { id: "warmup_1", priority: 60 };
  e.COACH.current = stale;
  e.COACH.playAt = e.now - 60_000;             // handed over a minute ago
  e.run("release");
  assert.equal(e.COACH.current, null, "a line an entire minute old must not still hold the element");
});

test("a line still inside its own clip is left alone", () => {
  const e = env([timed(600)], 100, 300);
  const live = { id: "warmup_1", priority: 60 };
  e.COACH.current = live;
  e.COACH.playAt = e.now - 900;                // under a second ago
  e.run("release");
  assert.equal(e.COACH.current, live, "a line that has only just started must not be cut off");
});

test("a stitched sentence owns the element and is never cut", () => {
  // COACH.seq is the token a stitched pace sentence holds. It has its own bookkeeping, and cutting it
  // mid-number is the exact defect that machinery exists to prevent.
  //
  // ⚠️ ASSERTED ON THE ELEMENT, NOT ON COACH.current, AND THE FIRST VERSION ESCAPED ITS RE-BREAK.
  // coachOnEnded ALSO opens with `if (COACH.seq) return`, so deleting the check here still leaves
  // COACH.current standing — belt and braces, and correct, but it means the visible harm is the
  // pause(): the element is taken back, the stitched sentence stops mid-number, and stopPage is
  // posted to Swift. That is what has to be impossible.
  let paused = 0;
  const e = env([timed(600)], 100, 300);
  (e.COACH.audio as { pause: () => void }).pause = () => { paused++; };
  const seqPrompt = { id: "pace_behind_1", priority: 60 };
  e.COACH.current = seqPrompt;
  e.COACH.seq = 7;
  e.COACH.playAt = e.now - 60_000;
  e.run("release");
  assert.equal(paused, 0, "a stitched sentence must not have the element taken off it");
  assert.equal(e.COACH.current, seqPrompt, "and must keep the prompt it is speaking");
});

test("releasing drains the queue, which is what makes the late cue arrive", () => {
  const e = env([timed(600)], 100, 300);
  const queued = { id: "session_complete_1", priority: 90 };
  e.COACH.current = { id: "warmup_1", priority: 60 };
  e.COACH.playAt = e.now - 60_000;
  (e.COACH.queue as unknown[]).push(queued);
  e.run("release");
  assert.equal(e.COACH.current, queued,
    "the whole point of releasing is that whatever was waiting behind it plays");
});

test("the release goes through pause(), so the shim's own token cannot fire again", () => {
  // ⚠️ Straight to coachOnEnded would leave the shim's token and watchdog live, and a reply that
  // turns up afterwards would advance the queue a SECOND time — skipping the next line.
  let paused = 0;
  const e = env([timed(600)], 100, 300);
  (e.COACH.audio as { pause: () => void }).pause = () => { paused++; };
  e.COACH.current = { id: "warmup_1", priority: 60 };
  e.COACH.playAt = e.now - 60_000;
  e.run("release");
  assert.equal(paused, 1, "the element must be paused, which is what clears the shim's token");
});

test("BLOCKER: the release runs from BOTH live ticks, not from coachTick", () => {
  // ⚠️ coachTick is the obvious home and the wrong one: it is called from renderLiveNow, which
  // returns immediately when the live screen is not mounted — exactly the backgrounded case this
  // exists for. A treadmill run posts no schedule at all, so indoorUiTick has nothing to
  // reschedule; it can still lose a reply, so the release has to reach it.
  const html = readFileSync(PAGE, "utf8");
  for (const t of ["gpsUiTick", "indoorUiTick"]) {
    assert.match(lift(html, t), /coachRunTick\(\)/, t + " must run the coach's clock work");
  }
  assert.doesNotMatch(lift(html, "coachTick"), /coachReleaseStale|coachRescheduleTick/,
    "coachTick cannot carry this: it does not run when the live screen is unmounted");
  assert.match(lift(html, "coachRunTick"), /coachReleaseStale\(\)/);
  assert.match(lift(html, "coachRunTick"), /coachRescheduleTick\(\)/);
});

test("the stamp and the reschedule bookkeeping are cleared with the rest of the run state", () => {
  // Left behind, run two of an app session inherits run one's predicted finish and the drift gate
  // answers "nothing has moved" — so its schedule is never refreshed at all.
  const html = readFileSync(PAGE, "utf8");
  const body = lift(html, "coachResetSession");
  for (const f of ["reschedAt", "reschedEta", "playAt"]) {
    assert.match(body, new RegExp("COACH\\." + f + " ="), "coachResetSession must clear " + f);
  }
});

test("the stamp is written where the clip is handed over, so it cannot go missing", () => {
  const html = readFileSync(PAGE, "utf8");
  assert.match(lift(html, "coachPlay"), /COACH\.playAt = Date\.now\(\)/,
    "coachPlay is the one place a prompt takes the element; the stamp belongs with it");
});

/**
 * THE COMPLETION CUE ARRIVED 20-30 SECONDS AFTER THE FINISH CARD (the owner's 24 August field report,
 * reported for the second time).
 *
 * The fix that shipped for the first report was not wrong and WAS on his phone — it was defeated by the
 * two lines that run immediately before the cue is fired. `liveFinish` opens with `stopLive()`, and
 * `stopLive` posts `clearSchedule`, which in Swift reaches `CoachAudioService.stop()` →
 * `player?.stop(); player = nil`. `AVAudioPlayer.stop()` does NOT fire `audioPlayerDidFinishPlaying`,
 * which is the only path a page clip has back to the page — so `COACH.current` stayed set for ever.
 * `stopLive` also clears `LIVE.ui`, the only clock that calls `coachReleaseStale`. `session-complete` is
 * `interrupt: false`, so it was then pushed onto the queue behind a dead line by a cue of ANY priority —
 * on his run, almost certainly the kilometre-1 milestone replayed from the unlock burst microseconds
 * earlier. Nothing could drain it but the shim's own 15-second watchdog: a 15 s floor, 20-30 s with a
 * second queued cue.
 *
 * ⚠️ HIS STRONGEST CLUE IS WHAT CONFIRMED IT. His music ducked on time and the voice came half a minute
 * later. The duck is `setActive(true)`, fired the instant a clip is handed over and BEFORE the player is
 * even constructed; the un-duck is `releaseSession()`, reachable only from `audioPlayerDidFinishPlaying`
 * or `stopPagePlayback`. `stop()` reached neither, so the music was held down for a clip that had been
 * cut off, with nothing playing at all. Duck-and-abandon has exactly that signature.
 */
test("BLOCKER: a run that ends silences the line still playing, so the completion cue is not queued behind it", () => {
  const html = readFileSync(PAGE, "utf8");
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const stopLive = strip(lift(html, "stopLive"));
  // ⚠️ THE INVARIANT IS THAT NOTHING FROM A FINISHED RUN IS LEFT PLAYING, not that a particular helper is
  // called at a particular line. It is asserted on stopLive because that is the one funnel every exit
  // from a run goes through — finished, discarded, or walked away from.
  assert.match(stopLive, /coachStop\(\)/,
    "a run can end with a coach line still in flight; the native side then cuts it without reporting " +
    "back, so COACH.current is never cleared and the completion cue waits for a 15-second watchdog");
  // ⚠️ AND EVERY PATH THAT TEARS THE NATIVE SCHEDULE DOWN MUST DO IT, derived rather than listed. Posting
  // clearSchedule is precisely the act that cuts an in-flight clip with no way to tell the page, so a
  // third call site added without silencing the page first would reintroduce the whole defect.
  // ⚠️ A CENSUS, NOT A BLANKET SWEEP, AND THE DIFFERENCE IS EARNED. Posting clearSchedule reaches Swift's
  // stop(), which cuts whatever page clip is playing — so every TEARDOWN path must silence the page first.
  // But `coachNativeSchedule` also posts it, defensively, meaning "there is nothing to schedule": all four
  // of its callers (coachRescheduleTick, startGps, startSim, coachRouteCue) are inside a live run, and
  // liveFinish clears the ticks before the completion cue is fired, so it cannot fire while that cue is
  // playing. Naming it as the one exception and fixing the total is what forces a decision about a fourth.
  // ⚠️ AND THE MATCH IS THE POST, NOT THE WORD: /clearSchedule/ alone flagged `trialSaveResult`, whose only
  // crime is calling `clearScheduledTrial()` — the guard tripping on a neighbour's vocabulary.
  const posts = [...html.matchAll(/function (\w+)\([^)]*\)\s*\{/g)]
    .map((m) => ({ name: m[1]!, body: strip(lift(html, m[1]!)) }))
    .filter((f) => /action:\s*"clearSchedule"/.test(f.body))
    .map((f) => f.name);
  assert.deepEqual(posts.slice().sort(), ["coachNativeSchedule", "livePauseSet", "stopLive"],
    "the set of functions that tear down the native coach schedule has changed to " + posts.join(", ") +
    " — a new one cuts whatever clip the page thinks is playing, and unless it silences the page first the " +
    "next cue is queued behind a line that can never end");
  for (const name of posts) {
    if (name === "coachNativeSchedule") continue;
    assert.match(strip(lift(html, name)), /coachStop\(\)|stopLive\(\)/,
      name + " posts clearSchedule without silencing the clip the page still thinks is playing");
  }
});

test("BLOCKER: the pause line is spoken into a clean queue, not cut off by its own teardown", () => {
  const html = readFileSync(PAGE, "utf8");
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const body = strip(lift(html, "livePauseSet"));
  // ⚠️ AN ORDERING CLAIM, AND BOTH HALVES ARE ASSERTED TO EXIST FIRST. indexOf answers -1 for a missing
  // needle and -1 is less than every real index, so "a comes before b" is satisfied by a being absent —
  // which this repo has already watched let two ordering guards pass on deleted code.
  const teardown = Math.max(body.indexOf("coachStop()"), body.indexOf("stopLive()"));
  const speak = body.indexOf("rt.pause(");
  assert.ok(teardown > 0, "pausing does not silence the line in flight at all");
  assert.ok(speak > 0, "livePauseSet no longer emits the pause cue; this guard has lost its subject");
  assert.ok(teardown < speak,
    "the pause cue is emitted BEFORE the teardown that cuts it, so the runner hears the start of a word " +
    "and the coach stays wedged for the rest of the run");
  // Both branches must do it — the GPS one through coachStop, the treadmill one through stopLive — or
  // pausing on one kind of run is silent and on the other it is wedged.
  assert.match(body, /coachStop\(\)/, "a GPS pause does not silence the clip the page thinks is playing");
  assert.match(body, /stopLive\(\)/, "a treadmill pause no longer tears its run down");
});

test("BLOCKER: cutting a clip natively reports back and hands the music back", () => {
  // ⚠️ THIS IS THE NATIVE HALF AND IT NEEDS AN XCODE BUILD, so it is guarded structurally: this suite has
  // no Swift toolchain to drive. The claim is about two obligations a teardown of a page clip has, and
  // `stopPagePlayback` twelve lines below has always met both — two teardowns for one player with
  // opposite discipline is the fix-one-builder-and-not-the-other trap.
  const swift = readFileSync(new URL("../ios/InteRun/CoachAudioService.swift", import.meta.url), "utf8");
  const noswift = swift.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/\/?.*$/gm, "");
  const at = noswift.indexOf("private func stop() {");
  assert.ok(at > 0, "CoachAudioService.stop() has been renamed; this guard has lost its subject");
  const body = noswift.slice(at, noswift.indexOf("\n    }", at));
  assert.match(body, /pageDone\(pageToken, false\)/,
    "cutting the clip does not tell the page, so COACH.current stays set and the next cue waits for a " +
    "15-second watchdog");
  assert.match(body, /stopPagePlayback\(\)|releaseSession\(\)/,
    "cutting the clip does not deactivate the audio session, so the runner's music stays ducked with " +
    "nothing playing — which is exactly what he reported");
  // ⚠️ THE REPORT MUST PRECEDE THE TOKEN CLEAR. A report carrying token 0 is dropped by the shim as a
  // late answer for a clip it has already moved past, so the order is the whole of it.
  const rep = body.indexOf("pageDone(pageToken, false)");
  const clr = body.indexOf("pageToken = 0");
  assert.ok(rep > 0 && clr > 0, "the token is reported or cleared but not both");
  assert.ok(rep < clr, "the token is cleared before it is reported, so the page is told about clip 0");
  // And the ordinary stop path must still release the session, or the duck outlives every clip.
  const spb = noswift.indexOf("private func stopPagePlayback() {");
  assert.ok(spb > 0);
  assert.match(noswift.slice(spb, noswift.indexOf("\n    }", spb)), /releaseSession\(\)/,
    "the ordinary page-stop no longer hands the music back");
});
