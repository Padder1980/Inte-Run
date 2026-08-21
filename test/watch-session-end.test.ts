import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ SIX FAULTS FROM ONE REAL RUN ON THE OWNER'S WATCH (2026-08-20, Rhodes), none of them
 * reproducible without an iPhone and an Apple Watch — so these are structural guards on the exact
 * code paths each one broke, in the shape this repo has settled on for the watch target
 * (`test/watch-handover.test.ts` is the precedent).
 *
 *   1. "at the end of a custom 2km, the session just kept going rather than ending when reaching 2km"
 *   2. "the audio countdown didn't match the screen countdown and the session had already started
 *      before the audio countdown fired"
 *   3. "the watch functionality is far too limited and you can't actually see all the metrics
 *      without having to scroll" — with the labels clipped off the right edge of an Ultra
 *   4. cadence permanently blank on every wrist run
 *   5. CURRENT and LAP reading "—" for a whole wrist run on the phone's mirror
 *
 * ⚠️ EVERY ASSERTION HERE IS ABOUT A READER, NOT A DECLARATION. A source-text check proves a string
 * exists; it never proves anything reaches it, and three re-breaks escaped exactly that in this repo
 * last week. Where a list of names is needed it is DERIVED from the source rather than typed out, so
 * it cannot go stale in the one direction that matters (the source grows and the guard stops looking).
 */
/**
 * Swift source with its comments removed.
 *
 * ⚠️ THIS IS NOT TIDINESS — TWO OF THE GUARDS BELOW COULD NOT FAIL WITHOUT IT, and both were caught
 * the first time this file was run. The comments here deliberately quote the broken code they replaced
 * ("This was `for k in [\"sec\",\"distKm\",\"paceSec\"]`"), so a guard reading the raw file matches the
 * comment whatever the code says. That is the same trap CLAUDE.md records firing on five earlier
 * guards; the remedy that has always worked is to strip comments from the scope rather than to reword
 * the code's own explanation.
 *
 * Quote-aware, so a `//` inside a string literal is not mistaken for a comment. Block comments are
 * refused outright rather than parsed: a `/*` sweep over real source has a documented blind window,
 * and none of these files uses one — so the honest thing is to fail loudly if that ever changes.
 */
function stripComments(src: string): string {
  assert.doesNotMatch(src, /\/\*/,
    "this source now contains a block comment; the stripper below cannot see inside one");
  return src
    .split("\n")
    .map((line) => {
      let quoted = false;
      for (let i = 0; i < line.length - 1; i++) {
        const c = line[i]!;
        if (c === "\\") { i++; continue; }
        if (c === '"') { quoted = !quoted; continue; }
        if (!quoted && c === "/" && line[i + 1] === "/") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

const read = (f: string) =>
  stripComments(readFileSync(new URL("../ios/" + f, import.meta.url), "utf8"));

/** The body of a Swift function, from its `func` line to the matching close brace. */
function fn(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.notEqual(at, -1, `the source no longer contains ${signature}`);
  const open = src.indexOf("{", at);
  assert.notEqual(open, -1, `${signature} has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  assert.fail(`${signature} is unbalanced`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1. The session must END
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: the last step of a prescribed session ends the run", () => {
  // ⚠️ `advanceStepIfDue` used to finish with `guard stepIndex + 1 < steps.count else { return }`, so
  // the FINAL step was a dead end: nothing else in the watch target ever called `end()` except the
  // phone's relayed stop command and the runner's own End button. His custom 2 km ran to 2.05 km and
  // kept going, and it was never distance-specific — a single timed step hung identically.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const advance = fn(wm, "private func advanceStepIfDue()");
  assert.doesNotMatch(advance, /stepIndex \+ 1 < steps\.count else \{ return \}/,
    "the last step is a dead end again — a prescribed session on the wrist will never finish");

  // The no-next-step branch must reach a completion. Derived: whatever that branch calls, that
  // function has to exist and has to be the one that ends the run.
  const tail = advance.match(/stepIndex \+ 1 < steps\.count else \{ return (\w+)\(\) \}/);
  assert.ok(tail, "the last-step branch no longer calls a completion function");
  const finisher = tail![1]!;
  const done = fn(wm, `private func ${finisher}()`);

  // ⚠️ THROUGH `end()`, NEVER BY ASSIGNING `phase`. `end()` speaks the session-complete cue, sends a
  // final "ended" tick so the phone's mirror and the lock-screen card come down, and calls
  // `sendHome()` BEFORE the HealthKit teardown that owns the transition to `.ended`. Setting the
  // phase directly would skip `sendHome()` and lose the run.
  assert.match(done, /\bend\(\)/,
    `${finisher} no longer calls end(), so the run is never banked or sent home`);
  assert.doesNotMatch(done, /phase\s*=/,
    `${finisher} assigns phase itself, which skips sendHome() and loses the run`);
});

test("BLOCKER: a free run never gains an end", () => {
  // A free run is `plan == nil` → `steps == []` → `currentStep == nil`. The bail on that must come
  // FIRST, or the completion path fires on a run that has no prescription to complete.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const advance = fn(wm, "private func advanceStepIfDue()");
  const bail = advance.indexOf("guard let step = currentStep else { return }");
  assert.notEqual(bail, -1, "the free-run bail is gone — a run with no steps could now be ended");
  const completion = advance.search(/steps\.count else \{ return \w+\(\) \}/);
  assert.ok(bail < completion,
    "the completion branch is reachable before the free-run bail, so a free run can be ended");
  // And `currentStep` must still be the empty-steps sentinel it has always been.
  assert.match(wm, /var currentStep: PlannedStep\? \{ stepIndex < steps\.count \? steps\[stepIndex\] : nil \}/,
    "currentStep no longer returns nil for a run with no steps, which is the free-run guard");
});

test("BLOCKER: the completion flag is cleared for the next run", () => {
  // ⚠️ WorkoutManager is a @StateObject and outlives a run. A completion flag left set makes run two
  // of an app session start already finished — the documented trap that once had the second run
  // silently dropped because it inherited run one's id.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const done = fn(wm, "private func finishPrescribedSession()");
  const flag = done.match(/guard !(\w+) else \{ return \}/);
  assert.ok(flag, "the completion is no longer one-shot, so end() can be called repeatedly");
  const reset = fn(wm, "func reset()");
  assert.match(reset, new RegExp("\\b" + flag![1]! + "\\s*=\\s*false"),
    `reset() does not clear ${flag![1]}, so run two of an app session starts already complete`);
});

test("the manual Skip still refuses to walk off the end of the session", () => {
  // `nextStep()` is the runner's own skip and is offered only while a later step exists. It must not
  // inherit the auto-completion: skipping is "I have had enough of THIS step", not "end my run".
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const next = fn(wm, "func nextStep()");
  assert.match(next, /guard stepIndex \+ 1 < steps\.count else \{ return \}/,
    "nextStep can now advance past the final step");
  assert.doesNotMatch(next, /\bend\(\)/, "the Skip button can now end the run");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2. The countdown
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: the count-in is sent one beat at a time, not as one sequence", () => {
  // ⚠️ The wrist sent a single `"countdown"` and the PHONE then ran its own 0/1/2/3-second schedule
  // from whenever its handler got round to running — two independent three-second timers started at
  // different moments, so the spoken count could only ever be late. Per beat, each message carries
  // the one-way latency and nothing else.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const count = fn(wm, "func startCountingDown()");
  assert.doesNotMatch(count, /speakOnPhone\("countdown"\)/,
    "the whole sequence is asked for in one message again — the audio will re-base and run late");

  // Derived from the declaration, so a fifth beat cannot be added without this guard seeing it.
  const listed = wm.match(/static let countdownTriggers = \[([^\]]+)\]/);
  assert.ok(listed, "countdownTriggers is gone, so the beats have no named triggers");
  const triggers = listed![1]!.match(/"([^"]+)"/g)!.map((s) => s.replace(/"/g, ""));
  assert.equal(triggers.length, 4, `the count has ${triggers.length} beats, not four`);
  // ⚠️ FOUR DISTINCT NAMES. The phone's native player plays exactly one file per call and holds a
  // per-trigger dedupe window, so one name reused four times would speak one number, suppress the
  // other three, and rotate WHICH number it spoke across runs.
  assert.equal(new Set(triggers).size, 4, "two beats share a trigger name — three of them will be silent");

  // Every beat must actually be sent from inside the countdown, and index 0 at the top.
  assert.match(count, /speakOnPhone\(Self\.countdownTriggers\[0\]\)/,
    "the first beat is not spoken, so the count opens in silence");
  // ⚠️ DISTINCT INDICES, NOT A COUNT OF SENDS. A re-break that pointed every beat at [0] — so the
  // phone says "three" three times while the screen counts 3-2-1, which is the owner's finding 2
  // VERBATIM — passed a version of this guard that only counted send expressions. Three sends of the
  // same index is not a count-in.
  const idx = [...count.matchAll(/speakOnPhone\(Self\.countdownTriggers\[([^\]]+)\]\)/g)]
    .map((m) => m[1]!.replace(/\s+/g, ""));
  assert.equal(new Set(idx).size, idx.length,
    "two beats index the same trigger, so the spoken count repeats itself: " + JSON.stringify(idx));
  const sends = (count.match(/speakOnPhone\(Self\.countdownTriggers\[/g) || []).length;
  assert.equal(sends, 3,
    `the count sends ${sends} of the three beat expressions — one beat is silent (the middle two share an index expression)`);
  // ⚠️ "Go." travels BEFORE start(), so the word and the clock leave together rather than the word
  // queueing behind start()'s HealthKit round trip.
  const go = count.indexOf("countdownTriggers[3]");
  const begin = count.indexOf("self.start()");
  assert.ok(go !== -1 && begin !== -1 && go < begin,
    "the go beat is sent after start(), so it lands behind the clock again");
});

test("BLOCKER: the wrist never counts somebody in with a robot", () => {
  // ⚠️ A beat is only worth saying at the instant it happens, and by the time the phone's ack has told
  // us it was silent that instant has gone. The haptics carry the count — that is what they are for.
  // Derived from the same list, so a new beat cannot arrive without a matching silence.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const triggers = wm.match(/static let countdownTriggers = \[([^\]]+)\]/)![1]!
    .match(/"([^"]+)"/g)!.map((s) => s.replace(/"/g, ""));
  const voice = read("InteRunWatch/WorkoutVoice.swift");
  const fallback = fn(voice, "func fallback(for trigger: String, text: String?)");
  const silent = fallback.match(/case ([^:]+): return\s*$/m);
  assert.ok(silent, "the silent-cue branch is gone from the fallback");
  for (const t of triggers) {
    assert.ok(silent![1]!.includes(`"${t}"`),
      `"${t}" is not in the silent branch — an unreachable phone would speak the count as a robot`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 3. Cadence
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: a wrist run reports its cadence, and never a zero", () => {
  // ⚠️ The debrief's cadence tile was permanently blank on every watch run: the phone accumulates it
  // from CMPedometer, and `summaryPayload` simply had no such field. There is no CMPedometer on
  // watchOS, so the source is HealthKit's own step count — and ALL THREE of enable, read-authorise and
  // handle are needed. Any one missing makes `avgCadence` silently nil forever.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const begin = fn(wm, "private func begin()");
  assert.match(begin, /enableCollection\(for: HKQuantityType\(\.stepCount\)/,
    "step count is not enabled on the live data source, so nothing collects it");
  const start = fn(wm, "func start()");
  assert.match(start, /HKQuantityType\(\.stepCount\)/,
    "step count is not in the READ set, so HealthKit will never deliver it");
  assert.match(wm, /quantityType == HKQuantityType\(\.stepCount\)/,
    "the collection callback has no step-count branch, so deliveries are discarded");

  const payload = fn(wm, "func summaryPayload()");
  assert.match(payload, /if let cad = avgCadence \{ out\["cadence"\] = /,
    "the payload no longer carries cadence, so the debrief's tile stays blank on wrist runs");
  // ⚠️ ABSENT, NEVER 0. A stored zero renders as a measurement of somebody standing still — the rule
  // the phone's own save path states at its cadence line.
  assert.doesNotMatch(payload, /out\["cadence"\] = 0/,
    "a zero cadence is published, which reads as a measurement of standing still");
});

test("BLOCKER: cadence skips paused time, like the zone totals and the average heart rate", () => {
  // Three accumulators, one rule: a runner standing at a crossing is not accumulating training time.
  // The zone totals are only fed from the ticker's RUNNING branch; this is fed by HealthKit whenever
  // it likes, so the gate has to be inside it.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const took = fn(wm, "private func tookSteps(_ total: Double)");
  assert.match(took, /guard phase == \.running/,
    "cadence banks steps taken while paused, so a crossing drags the average down");
  // ⚠️ THE BASELINES ADVANCE EVEN WHEN THE SAMPLE IS REFUSED. That is what makes a pause free: the
  // steps shuffled at a crossing are absorbed into the baseline instead of being charged to the next
  // running interval.
  assert.match(took, /defer \{[^}]*lastStepTotal = total/,
    "the baseline is not advanced on a refused sample, so a pause's steps land on the next interval");

  const avg = fn(wm, "var avgCadence: Double?");
  assert.match(avg, /guard cadSeconds >= \d+, cadSteps > 0 else \{ return nil \}/,
    "avgCadence has no floor, so one HealthKit batch can publish a cadence");

  // ⚠️ Every per-run cadence field must be cleared: the manager outlives a run, and a stale baseline
  // would charge run two's first interval against run one's last step count.
  const reset = fn(wm, "func reset()");
  for (const field of ["cadSteps", "cadSeconds", "lastStepTotal", "lastStepElapsed"]) {
    assert.ok(reset.includes(field + " ="),
      `reset() does not clear ${field}, so run two inherits run one's cadence`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 4. Current pace on the wrist, and therefore on the phone's mirror
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: a pace is derived when the device will not report a speed", () => {
  // ⚠️ `paceSecPerKm` had exactly one writer — CoreLocation's own `speed`, which is -1 whenever the
  // receiver will not commit to one — and the delegate's branches left the case "no speed AND moving"
  // assigning nothing at all. So the published pace stayed nil for the whole run: no CURRENT on the
  // wrist, none in the tick (which is why the phone's mirror read "—"), "FINDING GPS" throughout, no
  // pace cues, and auto-pause blind. The phone has always had this fallback; the wrist never did.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const derive = fn(wm, "private func derivePaceIfStale()");
  // Only when the device's own figure has gone stale: Doppler speed is far steadier than
  // differentiating positions and keeps priority.
  assert.match(derive, /guard !paceIsFresh else \{ paceRef = nil; return \}/,
    "the derivation overrides a fresh device speed, which is noisier than the value it replaces");
  // ⚠️ AND IT MUST CLEAR THE PACE WHEN THE WINDOW EXPIRES EMPTY. A derived value that persisted
  // through a standstill would mean autoPauseTick never saw the runner stop.
  assert.match(derive, /paceSecPerKm = nil/,
    "an expired window leaves a stale derived pace in place, so auto-pause can never fire");

  // It has to be CALLED, from the running branch of the ticker.
  const begin = fn(wm, "private func begin()");
  assert.match(begin, /self\.derivePaceIfStale\(\)/,
    "nothing calls derivePaceIfStale, so the fallback is dead code");
  const tick = begin.slice(begin.indexOf("self.elapsed = Date().timeIntervalSince(started)"));
  assert.ok(tick.indexOf("derivePaceIfStale") >= 0 && tick.indexOf("derivePaceIfStale") < tick.indexOf("autoPauseTick"),
    "the derivation runs after auto-pause has already judged the tick");

  // The delegate must no longer leave the field unwritten on the unknown-speed path, and every
  // branch that clears the pace must drop the derivation baseline with it.
  const loc = fn(wm, "nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locs: [CLLocation])");
  const branch = loc.slice(loc.indexOf("let sp = usable.last?.speed ?? -1", loc.indexOf("var movedThisBatch")));
  assert.match(branch.slice(0, 500), /if sp > 0\.5 \{ paceSecPerKm = 1000 \/ sp; paceAt = Date\(\); paceRef = nil \}/,
    "a reported speed no longer drops the derivation baseline, so the two can mix");
  const clears = (branch.slice(0, 500).match(/paceRef = nil/g) || []).length;
  assert.equal(clears, 3,
    `${clears} of the three speed branches drop the derivation baseline — a stale one would span a gap it never measured`);
});

test("the wrist's live tick still carries the numbers the phone's mirror shows", () => {
  // The mirror renders CURRENT, LAP and AVERAGE from these three keys. They have always been sent;
  // this is the guard that keeps them sent, now that the reason one of them was empty is fixed.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const tick = fn(wm, "func sendLiveTick(force: Bool = false, stateOverride: String? = nil)");
  for (const key of ["paceSec", "avgPaceSec", "lapPaceSec", "hr", "distKm", "sec"]) {
    assert.ok(tick.includes(`live["${key}"]`) || tick.includes(`"${key}":`),
      `the tick no longer carries ${key}, so the phone's mirror will show a dash for it`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 5. The companion screen
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: the companion renders the SAME metrics page a wrist run does", () => {
  // ⚠️ This is the fix-one-builder-not-the-other trap. `MetricsPage` records four successive attempts
  // at the rounded glass and settled on 8pt insets with the LABEL WRAPPED BESIDE the number; the
  // companion kept the layout that was abandoned — a `Spacer` pinning each label against the right
  // edge inside 4pt of total padding — and the owner photographed it clipped on an Ultra. Rendering
  // the same page means it can never drift from the run screen again.
  const cv = read("InteRunWatch/CompanionView.swift");
  assert.match(cv, /MetricsPage\(/,
    "the companion has its own layout again, which is how it drifted from the run screen");
  assert.doesNotMatch(cv, /Spacer\(minLength: 4\)/,
    "the label-to-the-far-edge layout is back — that is what clipped on his Ultra");
  // The runner's own metric choice, one picker for both recorders.
  assert.match(cv, /settings\.metrics/,
    "the companion no longer honours WatchSettings, so its numbers are hardcoded again");
  assert.match(cv, /@ObservedObject private var settings = WatchSettings\.shared/,
    "the settings object is not observed, so changing a metric mid-run would not redraw");
});

test("BLOCKER: the companion starts no workout session of its own", () => {
  // ⚠️ Two recorders double-count and put the same outing in the Logbook twice. The companion's heart
  // rate comes from CompanionSession, whose workout is DISCARDED and never finished, and that switch
  // is thrown by the phone's `companionStart` message — not by this view.
  const cv = read("InteRunWatch/CompanionView.swift");
  assert.doesNotMatch(cv, /HKWorkoutSession|HKLiveWorkoutBuilder|beginCollection|startActivity/,
    "the companion view now builds a workout session — that is a second recorder");
  assert.doesNotMatch(cv, /WorkoutManager/,
    "the companion view reaches for WorkoutManager, which records runs");
  assert.doesNotMatch(cv, /CompanionSession\.shared\.start\(\)/,
    "the view starts the sensor session itself; that belongs to the phone's companionStart message");
  // And the discard must still be the thing that ends the sensor session.
  const cs = read("InteRunWatch/CompanionSession.swift");
  assert.match(cs, /b\.discardWorkout\(\)/,
    "the companion's workout is finished rather than discarded — a duplicate lands in Health");
});

test("BLOCKER: a control appears only when the phone has said it can answer", () => {
  // ⚠️ The wrist-to-phone relay is native and the handler that acts on it is in the page, so a page
  // served before it has one cannot answer. A pause/finish button that looks live and does nothing is
  // the defect this project has shipped twice. The flag comes from the side that HAS the capability,
  // so the buttons light up on their own when a newer page is served — with no watch rebuild.
  const cv = read("InteRunWatch/CompanionView.swift");
  const controls = cv.slice(cv.indexOf("struct CompanionControls"));
  assert.match(controls, /if store\.phoneCanControl \{/,
    "the controls are unconditional, so an old page gets buttons that do nothing");
  const gated = controls.indexOf("if store.phoneCanControl {");
  const send = controls.indexOf("store.sendPhoneCommand(");
  assert.ok(gated !== -1 && send > gated,
    "a command can be sent from outside the capability gate");

  // The flag must come off the tick and must clear when the run ends.
  const ss = read("InteRunWatch/SessionStore.swift");
  assert.match(ss, /self\.phoneCanControl = control/,
    "phoneCanControl is not read from the phone's tick, so it can never become true");
  const end = ss.slice(ss.indexOf('case "companionEnd":'), ss.indexOf('case "stop":'));
  assert.match(end, /phoneCanControl = false/,
    "the capability survives the end of the run, leaving a Finish button for a finished run");

  // ⚠️ Finishing asks first. There is no way back into a session once it has ended, and a wrist is
  // exactly where an accidental press happens.
  assert.match(controls, /confirmationDialog\("Finish on your iPhone\?"/,
    "the wrist can now end the phone's run on one unconfirmed tap");
  const relay = read("InteRun/WatchBridge.swift");
  assert.match(relay, /message\["phoneCommand"\] as\? String/,
    "the phone no longer relays a wrist command, so the buttons cannot reach the run");
  assert.match(relay, /\["pause", "resume", "stop"\]\.contains\(cmd\)/,
    "the relay forwards any string the wrist sends straight into the page");
});

test("BLOCKER: the phone forwards the companion tick by key list, not by cherry-pick", () => {
  // ⚠️ This was `for k in ["sec", "distKm", "paceSec"]` — the same fault the `sync` case records being
  // fixed, left un-fixed here. Three numbers reached the wrist while the page computed heart rate, the
  // step and the paused flag ten lines above, and a field added on the page side could not travel
  // without a Swift edit and an Xcode build.
  const bridge = read("InteRun/WatchBridge.swift");
  const tick = bridge.slice(bridge.indexOf('case "companionTick":'), bridge.indexOf('case "endCompanion":'));
  const keys = tick.match(/for k in \[([^\]]+)\]/);
  assert.ok(keys, "the companion tick no longer forwards a list of keys");
  const names = keys![1]!.match(/"([^"]+)"/g)!.map((s) => s.replace(/"/g, ""));
  // Every key the companion actually READS.
  const readByTheWrist = ["sec", "distKm", "paceSec", "avgPaceSec", "lapPaceSec", "lapNumber",
                          "kcal", "hr", "stepProgress", "paused", "control"];
  for (const need of readByTheWrist) {
    assert.ok(names.includes(need),
      `"${need}" is not forwarded to the wrist, so the companion cannot show it`);
  }

  // ⚠️⚠️ AND NOTHING BEYOND WHAT THE WRIST READS — DERIVED FROM EVERY WRITE INTO `live`, NOT FROM
  // THE LIST LITERAL. This assertion used to slice `for k in [...]` and check only that list, so a
  // key added by a statement of its own was invisible to it: `live["type"] = type` shipped three
  // lines under a comment claiming every key is read, and a deliberate re-break adding
  // `live["paceLow"] = z` was the one break of forty-nine that escaped every guard in this repo.
  // A guard over a collection is only as good as the collection, so the collection is now the union
  // of the loop's list and every `live["…"] =` assignment in the case.
  const assigned = [...tick.matchAll(/\blive\[\s*"([^"]+)"\s*\]\s*=/g)].map((m) => m[1]!);
  assert.ok(assigned.includes("title"),
    "the assignment sweep found no `live[\"title\"] =`, so it is measuring nothing");
  const sent = [...new Set([...names, ...assigned])];

  // ⚠️ AND "READ" MEANS A NAMED READER, NOT THE WORD APPEARING SOMEWHERE. `type` would pass a bare
  // text search of the watch target several times over (`PlannedSession.type`, the effort maps), and
  // it is precisely the key nothing on the wrist can see: `SessionStore` reduces `phoneLive` with
  // `compactMapValues { $0 as? Double }` and names title/step/paused/control as exceptions, so a
  // String is dropped on arrival. A reader is a subscript into that dictionary, or the `flag(…)`
  // helper the two booleans go through.
  const cvSrc = read("InteRunWatch/CompanionView.swift");
  const ssSrc = read("InteRunWatch/SessionStore.swift");
  const ingest = ssSrc.slice(ssSrc.indexOf('if let live = message["phoneLive"]'));
  assert.ok(ingest.length > 200, "the phoneLive ingest block could not be bounded in SessionStore");
  const readerScope = cvSrc + "\n" + ingest.slice(0, ingest.indexOf("guard let action"));
  const isRead = (k: string) =>
    new RegExp('(?:live|nums|phoneLive\\??)\\[\\s*"' + k + '"\\s*\\]').test(readerScope) ||
    new RegExp('flag\\(\\s*"' + k + '"\\s*\\)').test(readerScope);
  assert.ok(isRead("distKm") && isRead("paused"),
    "the reader predicate matches nothing, so this guard cannot fail");
  const spare = sent.filter((k) => !isRead(k));
  assert.deepEqual(spare, [],
    "keys are forwarded that nothing on the wrist reads: " + spare.join(", "));
  // ⚠️ Absent keys are MEANINGFUL and must be left out rather than zeroed: a run with no watch has no
  // heart rate and a free run has no step, and the wrist renders "--" for what it was not sent.
  assert.match(tick, /where body\[k\] != nil/,
    "absent keys are forwarded as something, so the wrist will render a value nobody measured");
});

test("BLOCKER: nothing the phone did not send is rendered as a number", () => {
  // ⚠️ A zero is a measurement of standing still. Every metric the companion can be asked for must
  // either come from the tick, be arithmetic on what did arrive, or read "--" — and this is derived
  // from the Metric enum so a tenth metric cannot be added without an answer here.
  const settings = read("InteRunWatch/WatchSettings.swift");
  const cases = settings.match(/case elapsed, ([^\n]+)/);
  assert.ok(cases, "the Metric enum's case list has moved, so this guard is measuring nothing");
  const metrics = ("elapsed, " + cases![1]!).split(",").map((s) => s.trim()).filter(Boolean);
  assert.ok(metrics.length >= 9, `only ${metrics.length} metrics found — the derivation is broken`);

  const cv = read("InteRunWatch/CompanionView.swift");
  const mapper = fn(cv, "private func value(for m: WatchSettings.Metric) -> (value: String, unit: String?)");
  for (const m of metrics) {
    assert.ok(mapper.includes("case ." + m),
      `the companion has no answer for the "${m}" metric, so choosing it renders nothing`);
  }
  // The two that are arithmetic rather than sent: average pace and the lap number.
  assert.match(mapper, /live\["avgPaceSec"\] \?\? derivedAvgPace/,
    "average pace is no longer derived when the phone does not send it, so it reads as a dash");
  assert.match(mapper, /live\["lapNumber"\]/,
    "the lap number is no longer answered from the tick");
  // Nothing may fall through to a bare zero.
  assert.doesNotMatch(mapper, /return \("0"/,
    "a metric renders a literal 0, which reads as a measurement of standing still");
});

test("the companion has a preview scene, on every page", () => {
  // ⚠️ WatchPreview exists precisely so a run screen can be looked at without a run, and the ONE live
  // screen it had never been pointed at was the one the owner photographed clipped. 25 scenes, zero of
  // them this. A screenshot cannot swipe a watch simulator, so the scene number picks the page.
  const wp = read("InteRunWatch/WatchPreview.swift");
  for (const scene of ["companion", "companion-controls", "companion-paused", "companion-waiting"]) {
    assert.ok(wp.includes(`case "${scene}":`), `there is no "${scene}" preview scene`);
  }
  // ⚠️ And the harness must not write the runner's real settings. WatchSettings persists on didSet, so
  // a scene that assigned `WatchSettings.shared.metrics` left every later scene inheriting it —
  // measured, the paused scene then clipped at 41mm for reasons that had nothing to do with pausing.
  assert.doesNotMatch(wp, /WatchSettings\.shared\.metrics\s*=/,
    "a preview scene writes the real metric setting, which leaks into every scene after it");
  assert.match(wp, /metricsOverride: metrics/,
    "the four-metric scene no longer passes its list through the override");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 7. The strip the app shares with watchOS
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every display width `WATCHOS_DEPLOYMENT_TARGET = 10.0` admits, in points, and where watchOS puts
 * the leading edge of its own clock on each.
 *
 * ⚠️ THE FRACTIONS ARE MEASURED, NOT ASSUMED — read off real simulators by colour separation (the
 * app never draws pure white; the system clock is exactly 255,255,255), with a five-glyph 24-hour
 * time, which is the widest the clock gets. The sizes with no measurement of their own take the
 * worst one observed, which is the smallest watch. See MetricsPage.systemClockReserve.
 */
const WATCH_WIDTHS: { name: string; pt: number; clockLeftFrac: number }[] = [
  { name: "40mm", pt: 162, clockLeftFrac: 0.679 },
  { name: "41mm", pt: 176, clockLeftFrac: 0.693 },
  { name: "44mm", pt: 184, clockLeftFrac: 0.679 },
  { name: "42mm", pt: 187, clockLeftFrac: 0.700 },
  { name: "45mm", pt: 198, clockLeftFrac: 0.710 },
  { name: "49mm", pt: 205, clockLeftFrac: 0.705 },
  { name: "46mm", pt: 208, clockLeftFrac: 0.679 },
];

/** A `Text(...)` and the modifier chain hanging off it, as the file lays them out. */
function textChains(src: string): string[] {
  const lines = src.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\bText\(/.test(lines[i]!)) continue;
    let chain = lines[i]!;
    // ⚠️ A BLANK LINE CONTINUES THE CHAIN. `read()` strips comments, and a full-line comment between
    // two modifiers leaves whitespace behind — so a walker that stopped at the first non-`.` line cut
    // every chain that explains itself, which in this file is most of them.
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j]!.trim();
      if (t === "") continue;
      if (!t.startsWith(".")) break;
      chain += "\n" + lines[j]!;
    }
    out.push(chain);
  }
  return out;
}

test("BLOCKER: the top strip leaves watchOS its own clock room, at every supported size", () => {
  // ⚠️ THE SCREEN THE OWNER PHOTOGRAPHED, AND THE MEASUREMENT THAT CERTIFIED IT CLEAN COULD NOT SEE
  // IT. The strip filled the whole width and ended in a Spacer, so the app's content ran under the
  // system clock: measured, "PAUSED · IPHONE" overlapped it by 48px at 40mm, 24px at 41mm and 5px at
  // 42mm, and the running state's 3px gap at 40mm rendered "23:10" and "06:19" as one number
  // ("23:1006:19") because the spacing WITHIN a number is 4-5px. The previous instrument counted ink
  // in the outer six rows and columns, and a collision in the MIDDLE of the strip puts no ink on any
  // edge — so it returned 0 and read as a pass. This guard is the arithmetic; the pixel measurement
  // lives beside the shots in the phase's probe directory.
  const mp = read("InteRunWatch/MetricsPage.swift");

  const frac = mp.match(/clockReserveFraction:\s*CGFloat\s*=\s*([\d.]+)/);
  assert.ok(frac, "MetricsPage no longer declares a reserve fraction for the system clock");
  const f = Number(frac![1]);
  const edgeM = mp.match(/static let edge:\s*CGFloat\s*=\s*([\d.]+)/);
  assert.ok(edgeM, "MetricsPage no longer declares its own edge inset");
  const edge = Number(edgeM![1]);

  // ⚠️ THE RESERVE HAS TO TRACK THE DEVICE. A constant would be right for one watch and wrong for the
  // other six, which is what the measured spread of the clock's leading edge says.
  assert.match(mp, /screenBounds\.width \* clockReserveFraction/,
    "the clock reserve no longer scales with the display, so it fits one watch and no others");

  // ⚠️ AND IT HAS TO BE READ. A declared constant that no modifier consumes is the
  // computed-and-discarded trap this project has shipped four times.
  const applied = [...mp.matchAll(/\.padding\(\.trailing,\s*MetricsPage\.clockInset\)/g)];
  assert.equal(applied.length, 1,
    "the clock reserve is applied " + applied.length + " times, not once");

  // 8pt is the bar because a smaller gap does not read as a gap: the app's clock and the system's
  // sat 1.5pt apart at 40mm and were read as one number.
  for (const w of WATCH_WIDTHS) {
    const contentRight = w.pt - edge - w.pt * f;
    const clearance = w.pt * w.clockLeftFrac - contentRight;
    assert.ok(clearance >= 8,
      `${w.name} (${w.pt}pt): the strip ends ${contentRight.toFixed(1)}pt in and the system clock ` +
      `starts at ${(w.pt * w.clockLeftFrac).toFixed(1)}pt — ${clearance.toFixed(1)}pt of clearance, ` +
      `under the 8pt a gap needs to read as one`);
  }
});

test("BLOCKER: nothing in the top strip can truncate instead of shrinking", () => {
  // ⚠️ `.kerning` MAKES `.minimumScaleFactor` INERT — A TEXT WITH CUSTOM LETTER SPACING TRUNCATES.
  // Both strip strings already carried a scale factor AND a kerning, so the give they were written
  // for had never once worked. Measured with the clock's columns reserved and the kerning still in
  // place: "PAUSED · IPHONE" rendered "PAUSED · IPHO…" and "IPHONE" rendered "IPH…"; with the kerning
  // deleted, both fitted whole. It is also why the collision presented as an OVERPRINT rather than as
  // small text — given too little room the strip did not shrink, it ran on under the clock.
  const mp = read("InteRunWatch/MetricsPage.swift");
  const strip = mp.slice(mp.indexOf("HStack(spacing: 6) {"), mp.indexOf("ForEach(rows)"));
  assert.ok(strip.length > 200, "the top strip could not be bounded in MetricsPage");
  const chains = textChains(strip);
  assert.ok(chains.length >= 3, `only ${chains.length} Text chains found in the strip`);
  for (const c of chains) {
    const first = c.split("\n")[0]!.trim();
    assert.doesNotMatch(c, /\.kerning\(/,
      "a strip Text carries .kerning, which makes its minimumScaleFactor inert: " + first);
    assert.match(c, /\.minimumScaleFactor\(/,
      "a strip Text has no give, so it truncates rather than shrinking: " + first);
  }

  // ⚠️ AND NO SPACER. An HStack shares its width among the children that can flex and a Spacer flexes
  // without limit, so its share plus the spacing it brings left "IPHONE 23:10" truncating to
  // "IPH… 23:10" on a 40mm watch with room going spare — measured, 33..173px of ink in a 198px box.
  assert.doesNotMatch(strip, /Spacer\(/,
    "the strip has a Spacer again, which takes width the words need");
});

test("the kerning/minimumScaleFactor conflict does not spread", () => {
  // ⚠️ A RATCHET, NOT A BAN, AND THE COUNT IS THE POINT. Four Text chains elsewhere in the watch
  // target pair the two, so their scale factors are inert as well — measured at 40mm, none of them
  // is truncating today, so they are latent rather than broken and rewriting screens with no
  // measured defect is the risk this phase should not take. What must not happen is the count going
  // up, or either repaired screen regaining one.
  const files = ["MetricsPage.swift", "CompanionView.swift", "PacePage.swift", "StepsPage.swift",
                 "TodayView.swift", "SessionDetailView.swift", "SettingsView.swift", "WorkoutView.swift",
                 "EffortView.swift"];
  let total = 0;
  for (const f of files) {
    const src = read("InteRunWatch/" + f);
    const bad = textChains(src)
      .filter((c) => /\.kerning\(/.test(c) && /\.minimumScaleFactor\(/.test(c));
    if (f === "MetricsPage.swift" || f === "CompanionView.swift") {
      assert.equal(bad.length, 0,
        f + " has a Text pairing .kerning with .minimumScaleFactor again, so it truncates: " +
        bad.map((c) => c.split("\n")[0]!.trim()).join(" | "));
    }
    total += bad.length;
  }
  assert.ok(total <= 4,
    `${total} Text chains pair .kerning with an inert .minimumScaleFactor, up from 4 — ` +
    "the scale factor does nothing on a Text with custom letter spacing");
});

test("BLOCKER: the default metric list fits the cap it is clamped to", () => {
  // ⚠️ FIVE ENTRIES AGAINST A CAP OF FOUR. `init`'s clamp therefore fired on a FRESH INSTALL and
  // silently dropped `.avgPace`, so the declared default and the delivered default were different
  // lists — and `reset()` assigns the declared one with no clamp at all, which made the one control
  // whose job is to restore the default the only way to exceed the cap the editor enforces.
  const ws = read("InteRunWatch/WatchSettings.swift");
  const cap = ws.match(/static let maxMetrics = (\d+)/);
  assert.ok(cap, "maxMetrics has moved, so this guard is measuring nothing");
  const list = ws.match(/static let defaultMetrics: \[Metric\] = \[([^\]]+)\]/);
  assert.ok(list, "defaultMetrics has moved, so this guard is measuring nothing");
  const entries = list![1]!.split(",").map((s) => s.trim()).filter(Boolean);
  assert.ok(entries.length >= 3, `only ${entries.length} default metrics parsed — check the regex`);
  assert.ok(entries.length <= Number(cap![1]),
    `defaultMetrics has ${entries.length} entries against a cap of ${cap![1]}, so a fresh install ` +
    `is clamped to something other than the declared default and Reset stores more than the cap`);
  // The clamp stays — it is what protects a setting saved before the cap changed.
  assert.match(ws, /metrics\.count > Self\.maxMetrics/,
    "the clamp on a stored list is gone, so an old five-metric setting loads as-is and overflows");
});

test("BLOCKER: the top strip's status word can shrink but never wrap", () => {
  // ⚠️ THE CODE SAYS THIS AND NOTHING ASSERTED IT. MetricsPage's own comment: "ONE LINE, ALWAYS. The
  // strip is reserved at a single line's height precisely so the rows below never move; a status long
  // enough to wrap would take a second line out of them and push the last metric into the bottom
  // curve." Removing .lineLimit(1) escaped every guard — and the strip is minHeight, not maxHeight, so
  // it grows and "PAUSED · IPHONE" wraps instead of shrinking. That is the owner's finding 3 (content
  // pushed off the bottom of the watch) by another route.
  const mp = read("InteRunWatch/MetricsPage.swift");
  const strip = mp.slice(mp.indexOf("HStack(spacing: 6)"));
  const status = strip.slice(0, strip.indexOf(".foregroundStyle(status.tint)"));
  assert.match(status, /\.lineLimit\(1\)/,
    "the status word may wrap now, which takes a line out of the metrics below it");
  // ⚠️ AND SHRINKING IS THE OTHER HALF OF THE PAIR. One line without a scale factor truncates instead
  // — "PAUSED · IPHO…" — which is the same defect wearing an ellipsis.
  const sf = status.match(/\.minimumScaleFactor\(([\d.]+)\)/);
  assert.ok(sf, "the status word has no minimumScaleFactor, so one line truncates rather than shrinks");
  assert.ok(Number(sf![1]) <= 0.65,
    "the scale floor is " + sf![1] + "; measured, PAUSED with a provenance word needs 0.72 of its size "
    + "on a 40mm watch, so a floor above 0.65 sits a few points from truncating");
  // ⚠️ AND KERNING MAKES minimumScaleFactor INERT — a Text with letter spacing truncates instead of
  // shrinking, which is why this collision presented as an overprint rather than as small text.
  assert.doesNotMatch(status, /\.kerning\(/,
    "kerning is back on the status word, which silently disables its scale factor");
});

test("BLOCKER: the derived pace window can express every pace the model calls plausible", () => {
  // ⚠️ THE WINDOW WAS A THIRD INDEPENDENT NUMBER AND IT CONTRADICTED THE OTHER TWO. At a flat 15s it
  // named a 25:00/km shuffle as the case it existed for and then refused it — ten metres at
  // 1500 s/km takes exactly 15.0s, so the two branches tie and float noise decides. Driven, the
  // derivation returned 1499 for 1499 and nil for 1500. And 1800 needs 18s, so the top 300 s/km of
  // the declared plausible band was unreachable by its only writer.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const num = (name: string) => {
    const m = wm.match(new RegExp("static let " + name + "[^=]*=\\s*([\\d.]+)"));
    assert.ok(m, name + " has moved, so this guard is measuring nothing");
    return Number(m![1]);
  };
  const metres = num("paceDeriveMetres");
  const maxPlausible = num("paceMaxPlausible");
  // ⚠️ EVALUATED, NOT PATTERN-MATCHED. A guard that demanded today's exact expression would pin the
  // shape of the fix and say nothing about the behaviour; this reads whatever the declaration is and
  // works out how slow a pace the window can actually express. A bare `= 15` fails it.
  const decl = wm.match(/static let paceDeriveMaxSec:\s*TimeInterval\s*=\s*([^\n]+)/);
  assert.ok(decl, "paceDeriveMaxSec has moved, so this guard is measuring nothing");
  const expr = decl![1]!
    .replace(/\bpaceDeriveMetres\b/g, String(metres))
    .replace(/\bpaceMaxPlausible\b/g, String(maxPlausible))
    .replace(/\bpaceMinPlausible\b/g, String(num("paceMinPlausible")))
    .replace(/\bpaceDeriveSec\b/g, String(num("paceDeriveSec")));
  assert.match(expr, /^[\d\s.+*/()-]+$/,
    "the give-up window now depends on something this guard cannot evaluate: " + decl![1]);
  const maxSec = Number(new Function("return (" + expr + ")")());
  assert.ok(Number.isFinite(maxSec) && maxSec > 0, "the give-up window evaluated to " + maxSec);
  // ⚠️ AND THE READER MUST USE IT. Evaluating the DECLARATION is only half the claim: a re-break that
  // left the derived constant in place and wrote a bare 15 at the comparison passed this guard while
  // the constant became computed-and-discarded and the flat-window behaviour returned. That is the
  // rule CLAUDE.md states outright — guard the readers, not the declaration — broken by the guard
  // written for it.
  const derive = fn(wm, "func derivePaceIfStale()");
  assert.match(derive, /Self\.paceDeriveMaxSec/,
    "derivePaceIfStale no longer reads paceDeriveMaxSec, so the derived window is discarded");
  assert.match(derive, /Self\.paceDeriveMetres/,
    "derivePaceIfStale no longer reads paceDeriveMetres");
  // ⚠️ AND THE BAND MUST CONTAIN SOMETHING. Inverting it (min above max) makes the derivation refuse
  // every pace, so CURRENT reads "—" for a whole run — the owner's finding 5 restored — and a claim
  // about "every pace the model calls plausible" is vacuously true of an empty band.
  const minPlausible = num("paceMinPlausible");
  assert.ok(minPlausible < maxPlausible,
    "the plausible pace band is inverted or empty: " + minPlausible + " to " + maxPlausible);
  // And it must track the ceiling rather than repeating it, or the two go stale apart.
  assert.match(decl![1]!, /paceMaxPlausible/,
    "the give-up window is a number of its own again, so it can contradict the plausibility ceiling");
  const slowestExpressible = maxSec / (metres / 1000);
  assert.ok(slowestExpressible >= maxPlausible,
    `the window gives up after ${maxSec}s, so the slowest pace it can derive is ` +
    `${slowestExpressible} s/km while the model calls ${maxPlausible} s/km plausible`);
});

test("BLOCKER: the tick that ends the run stops there", () => {
  // ⚠️ `end()` INVALIDATES THE TICKER, AND THE TICK ALREADY RUNNING CARRIES ON TO ITS LAST LINE. The
  // last step completing calls `advanceStepIfDue` → `finishPrescribedSession` → `end()`, which sends
  // a forced "ended" tick that takes the phone's mirror and the lock-screen card down. What followed
  // it in the same closure was a non-forced `sendLiveTick()` reporting "running" — suppressed only by
  // the 2s send throttle, i.e. by accident — and `autoPauseTick()`, which reads a `phase` that is
  // still `.running` until HealthKit's teardown lands and can therefore pause a run that has ended,
  // sending a forced "paused" tick after the "ended" one. Reachable on a TIMED final step that
  // expires while the runner is already standing still.
  const wm = read("InteRunWatch/WorkoutManager.swift");
  const tick = wm.slice(wm.indexOf("ticker = Timer.scheduledTimer"), wm.indexOf("} catch {"));
  assert.ok(tick.length > 400, "the ticker closure could not be bounded in WorkoutManager");
  const advance = tick.indexOf("self.advanceStepIfDue()");
  const bail = tick.search(/if self\.autoCompleted \{ return \}/);
  const send = tick.lastIndexOf("self.sendLiveTick()");
  const auto = tick.lastIndexOf("self.autoPauseTick()");
  assert.ok(advance >= 0, "the ticker no longer advances the step");
  assert.ok(bail > advance,
    "the ticker does not stop after the prescription ends the run, so a running tick and possibly a " +
    "pause follow the ended one");
  assert.ok(send > bail && auto > bail,
    "the ticker's trailing send and auto-pause are no longer downstream of the bail, so the bail " +
    "protects nothing");
});
