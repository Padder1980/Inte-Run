import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALL_PROMPTS, PROMPTS } from "../src/live/coach-prompts.ts";

/**
 * THE COACH'S REGULAR REMINDERS — added 2026-11-18, after the owner's report from a 70-minute long run:
 *
 *   "there were no regular voice commands. The only commands i received were; start, pause, restart,
 *    halfway through the session and then the end message."
 *
 * ⚠️ THOSE FIVE ARE THE WRIST'S speakOnPhone LIST, WORD FOR WORD. On a watch-recorded run the wrist
 * decides when a cue is due and the phone plays the recorded clip — and the wrist only ever sent the
 * count-in, the start, halfway, pause, resume, the finish and step changes. The kilometre line and the
 * form reminder lived only in the page's coachTick, which does not run on a watch run (the wrist
 * records; LIVE is null) or on a locked phone (the web process is suspended). The locked-phone
 * schedule, for a phone-recorded run, carried step changes and the finish and nothing between them.
 * A one-step long run is therefore an hour of silence on either device.
 *
 * Three halves, all guarded here:
 *   1. the wrist sends a kilometre line and a form reminder (Swift — checked from source);
 *   2. the locked-phone schedule carries every reminder that is a function of the clock;
 *   3. the page and that schedule share ONE grid, so the two players never say the same line twice
 *      and the page does not "catch up" on unlock.
 *
 * ⚠️ THESE DRIVE THE REAL FUNCTIONS, LIFTED OUT OF THE BUILT PAGE, with the real grid constants. Only
 * the things the tests are not about — audio, the catalogue lookup, the DOM — are stubbed.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const WATCH = fileURLToPath(new URL("../ios/InteRunWatch/", import.meta.url));

/** The app's own script block — not the minified engine, which shares one-letter names with nothing. */
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function coachScheduleReminders(");
  assert.ok(marker >= 0, "coachScheduleReminders is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  return html.slice(open + 8, close);
}
const SRC = appScript();

function fnBody(name: string): string {
  const at = SRC.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "not a top-level function in the build: " + name);
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at + 1, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string {
  const m = new RegExp("\\nconst " + name + " = [^;]+;").exec(SRC);
  assert.ok(m, "const not found in the build: " + name);
  return m[0];
}
/** Swift with its // comments gone, so a comment quoting a call cannot satisfy a guard. */
const swiftCode = (f: string) => readFileSync(WATCH + f, "utf8").replace(/(^|[^:"\\])\/\/[^\n]*/g, "$1 ");
/** A brace-matched Swift body from the first `{` after `anchor`. */
function swiftBody(code: string, anchor: string): string {
  const at = code.indexOf(anchor);
  assert.ok(at >= 0, "not found in the Swift source: " + anchor);
  let d = 0;
  for (let i = code.indexOf("{", at); i < code.length; i++) {
    if (code[i] === "{") d++;
    else if (code[i] === "}") { d--; if (!d) return code.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces after " + anchor);
}

const GRID = ["COACH_TECH_FIRST_S", "COACH_TECH_EVERY_S", "COACH_KEEP_FROM", "COACH_KEEP_EVERY_S"];
const GRID_FNS = ["coachTechType", "coachTechSlot", "coachTechAt", "coachKeepType", "coachKeepSlot", "coachKeepAt"];

type Step = {
  kind: string; durationSeconds?: number; distanceMeters?: number;
  targetRpe?: { min: number; max: number };
  targetPaceSecPerKm?: { minSecPerKm: number; maxSecPerKm: number };
  display?: string;
};
type Cue = { id: string; inMs: number; file: string };
type CoachState = { techSlot: number; keepSlot: number; halfwayDone: boolean; schedPosted?: boolean };

const timed = (sec: number, kind = "steady", rpe = 3): Step =>
  ({ kind, durationSeconds: sec, targetRpe: { min: rpe, max: rpe + 1 } });
const dist = (m: number, pace: number): Step => ({
  kind: "steady", distanceMeters: m, targetRpe: { min: 3, max: 4 },
  targetPaceSecPerKm: { minSecPerKm: pace - 14, maxSecPerKm: pace + 14 },
});

/* ------------------------------------------------------------------------------------------------ *
 * The locked-phone schedule, driven for real                                                        *
 * ------------------------------------------------------------------------------------------------ */

/**
 * The schedule coachNativeSchedule would post, as [{ trigger, slot, at }] with `at` in seconds of the
 * run. The stubbed pick names each cue "<trigger>#<slot index>" so a test can read both back.
 */
function schedule(o: { steps: Step[]; type: string; target: number; elapsed: number; covered?: number;
  coach?: Partial<CoachState> }): { trigger: string; at: number; raw: Cue }[] {
  const posts: { action: string; cues?: Cue[] }[] = [];
  const COACH: CoachState = Object.assign({ techSlot: -1, keepSlot: -1, halfwayDone: false, schedPosted: false }, o.coach || {});
  const LIVE = {
    started: true, done: false, mode: "gps",
    session: { type: o.type, steps: o.steps, estimatedDurationSeconds: o.target },
    rt: { snapshot: () => ({ distanceMeters: o.covered ?? 0 }) },
  };
  const names = ["coachNativeSchedule", "coachScheduleReminders", "stepSecs", "coachStepTrigger",
    "sessionDistanceDriven"].concat(GRID_FNS);
  const src = names.map(fnBody).join("\n") + "\n" + GRID.map(constStmt).join("\n") + "\nreturn coachNativeSchedule;";
  const make = new Function("COACH", "LIVE", "coachNativeAvailable", "coachEnabled", "coachNativePost",
    "coachSchedulePick", "liveNowMs", src) as (...a: unknown[]) => () => void;
  const run = make(COACH, LIVE, () => true, () => true,
    (m: { action: string; cues?: Cue[] }) => { posts.push(m); },
    (trigger: string, idx: number) => ({ id: trigger + "#" + idx, file: trigger + ".mp3" }),
    () => o.elapsed * 1000);
  run();
  const last = posts.filter((p) => p.action === "schedule").slice(-1)[0];
  assert.ok(last && last.cues, "no schedule was posted: " + JSON.stringify(posts));
  assert.equal(COACH.schedPosted, true, "a posted schedule must be recorded, or the page never hands over the clock");
  return last.cues.map((c) => ({ trigger: c.id.split("#")[0]!, at: o.elapsed + c.inMs / 1000, raw: c }));
}
const of = (cues: { trigger: string; at: number }[], t: string) => cues.filter((c) => c.trigger === t);

// His session: one step, seventy minutes, a long run measured in minutes.
const HIS_RUN = { steps: [timed(4200)], type: "long", target: 4200 };

test("BLOCKER: his 70-minute long run, locked from the start, now hears the coach every few minutes", () => {
  const cues = schedule({ ...HIS_RUN, elapsed: 5, covered: 15 });
  const tech = of(cues, "technique"), half = of(cues, "halfway"), keep = of(cues, "keep-going");
  // ⚠️ THE INVARIANT IS THE SILENCE, NOT A COUNT. Before this change the list held one line — the
  // finish — so the longest gap was the whole run. "Regular" means no gap longer than five minutes.
  const times = [5].concat(cues.map((c) => c.at)).sort((a, b) => a - b);
  let worst = 0;
  for (let i = 1; i < times.length; i++) worst = Math.max(worst, times[i]! - times[i - 1]!);
  assert.ok(worst <= 300, "a silence of " + Math.round(worst) + " s on a locked phone: " + JSON.stringify(cues.map((c) => [c.trigger, c.at])));
  assert.ok(tech.length >= 15, "form reminders every four minutes over seventy, got " + tech.length);
  assert.equal(Math.round(tech[0]!.at), 121, "the first form reminder is two minutes in, as on the page");
  assert.equal(half.length, 1, "a halfway in minutes is a function of the clock and belongs on the schedule");
  assert.equal(Math.round(half[0]!.at), 2101);
  assert.deepEqual(keep.map((c) => Math.round(c.at)), [3361, 3661, 3961],
    "keep-going from 80% every five minutes, stopping a minute short of the finish");
  assert.equal(of(cues, "session-complete").length, 1, "the finish is still scheduled");
});

test("BLOCKER: a form reminder never lands within thirty seconds of another line", () => {
  // Two clips queued back to back is the coach talking over itself; on the native side the second one
  // waits behind the first and can go stale. Checked across sessions with step changes in them too.
  const sessions = [
    { ...HIS_RUN, elapsed: 5 },
    { steps: [timed(600, "warmup"), timed(1800), timed(300, "cooldown")], type: "easy", target: 2700, elapsed: 3 },
    { steps: [timed(900), timed(1500, "steady", 4), timed(1200)], type: "long", target: 3600, elapsed: 30 },
  ];
  for (const s of sessions) {
    const cues = schedule(s);
    for (const t of of(cues, "technique")) {
      const near = cues.filter((c) => c !== t && Math.abs(c.at - t.at) < 30);
      assert.equal(near.length, 0, "a form reminder at " + t.at + " s collides with " + JSON.stringify(near.map((c) => [c.trigger, c.at])));
    }
    const ms = cues.map((c) => c.raw.inMs);
    assert.deepEqual(ms, ms.slice().sort((a, b) => a - b), "the list is not in time order — Swift takes the first due cue in list order");
  }
});

test("BLOCKER: a session measured in kilometres gets no scheduled halfway or keep-going — only the clock's own lines", () => {
  // ⚠️ HONESTY OVER COVERAGE. Its halfway is a distance only the page can see, and keep-going hangs
  // off a predicted finish; either one early is the coach saying something untrue. Form reminders are
  // pure clock and still come, stopping short of the PREDICTED finish because a runner who speeds up
  // gets there first.
  const cues = schedule({ steps: [dist(10000, 360)], type: "long", target: 3600, elapsed: 600, covered: 1700 });
  assert.equal(of(cues, "halfway").length, 0, "a distance session's halfway was guessed onto the clock");
  assert.equal(of(cues, "keep-going").length, 0, "keep-going was hung off a guessed finish");
  assert.equal(of(cues, "session-complete").length, 0, "the existing rule: never a guessed finish");
  const tech = of(cues, "technique");
  assert.ok(tech.length >= 8, "a distance long run still gets its form reminders, got " + tech.length);
  const predictedEnd = 10000 * (600 / 1700);
  assert.ok(tech.every((c) => c.at < predictedEnd * 0.9), "a form reminder sits in the last tenth of a guessed finish");
});

test("keep-going is never scheduled into a cool-down, and form reminders only on relaxed running", () => {
  // A threshold session's closing fifth is its cool-down: "this is the part that counts" is the wrong
  // thing to hear while easing off. The page made that mistake too — it is fixed in both.
  const thr = schedule({ steps: [timed(600, "warmup"), timed(1200, "steady", 7), timed(600, "cooldown")],
    type: "threshold", target: 2400, elapsed: 10 });
  assert.equal(of(thr, "keep-going").length, 0, "keep-going in a cool-down: " + JSON.stringify(of(thr, "keep-going")));
  assert.equal(of(thr, "technique").length, 0, "form reminders are for relaxed running, as on the page");
  assert.equal(of(thr, "halfway").length, 1, "a timed threshold session still has its halfway");
});

test("a reminder the page has already said is not handed to Swift to say again", () => {
  // The page re-pushes the schedule the moment it speaks a reminder in the foreground. That push must
  // leave the line it has just said off the list, or the phone locking a second later plays it twice.
  const before = schedule({ ...HIS_RUN, elapsed: 2050 });
  assert.equal(of(before, "halfway").length, 1);
  const after = schedule({ ...HIS_RUN, elapsed: 2100.4, coach: { halfwayDone: true, techSlot: 8 } });
  assert.equal(of(after, "halfway").length, 0, "a halfway the page has said is still on the native list");
  // Slot 8 is spoken at 2041; a push straight after it starts from slot 9.
  const justSaid = schedule({ ...HIS_RUN, elapsed: 2041.2, coach: { techSlot: 8 } });
  assert.equal(Math.round(of(justSaid, "technique")[0]!.at), 2281, "the slot just said was handed over again");
});

/* ------------------------------------------------------------------------------------------------ *
 * The page's own tick, on the same grid                                                             *
 * ------------------------------------------------------------------------------------------------ */

type Said = { trigger: string; at: number };
/**
 * Drive the real coachTick second by second. `hidden(sec)` says whether the app is in the background
 * at that moment (the native player holding the clock).
 */
function pageRun(o: { steps: Step[]; type: string; target: number; to: number; from?: number;
  hidden?: (sec: number) => boolean; native?: boolean; metresPerSec?: number;
  coach?: CoachState }): { said: Said[]; pushes: number; coach: CoachState } {
  const said: Said[] = [];
  let pushes = 0;
  let now = o.from ?? 0;
  const COACH = Object.assign({ techSlot: -1, keepSlot: -1, halfwayDone: false, finalDone: false,
    lastHalfwayAt: -999, highEffortSince: 0 }, o.coach || {});
  const LIVE = { started: true, done: false, mode: "gps", hr: 0,
    session: { type: o.type, steps: o.steps, estimatedDurationSeconds: o.target,
      estimatedDistanceMeters: o.steps.reduce((s, st) => s + (st.distanceMeters || 0), 0) } };
  const names = ["coachTick", "sessionHalfwayReached", "sessionDistanceDriven", "stepSecs"].concat(GRID_FNS);
  const src = names.map(fnBody).join("\n") + "\n" + GRID.map(constStmt).join("\n") + "\nreturn coachTick;";
  const make = new Function("COACH", "LIVE", "coachEnabled", "coachNativeOwnsClock", "coachPaceTick",
    "coachWhyTick", "coachSectionTick", "coachTrigger", "coachNativeAvailable", "coachNativeSchedule",
    "maxHrEstimate", "liveElapsedMs", src) as (...a: unknown[]) => (snap: unknown) => void;
  const tick = make(COACH, LIVE, () => true, () => !!(o.hidden && o.hidden(now)),
    () => {}, () => {}, () => {},
    (trigger: string) => { said.push({ trigger, at: now }); },
    () => !!o.native, () => { pushes++; }, () => null, () => now * 1000);
  // Which step the runner is in, by the clock — the same arithmetic as the schedule's spans.
  const stepAt = (sec: number) => {
    let at = 0;
    for (let i = 0; i < o.steps.length; i++) {
      const st = o.steps[i]!;
      const len = st.durationSeconds || 0;
      if (sec < at + len || i === o.steps.length - 1) return { index: i, total: o.steps.length, kind: st.kind };
      at += len;
    }
    return null;
  };
  for (; now <= o.to; now += 1) {
    tick({ elapsedSeconds: now, distanceMeters: now * (o.metresPerSec ?? 2.8), step: stepAt(now) });
  }
  return { said, pushes, coach: COACH };
}

test("BLOCKER: the page still coaches his long run in the hand, on the same rhythm as before", () => {
  // The other half of the rule. A grid that silenced the page would pass every schedule test above.
  // To 4199: at 4200 the session is complete and coachTick returns before any of this.
  const r = pageRun({ ...HIS_RUN, to: 4199 });
  const tech = of(r.said, "technique");
  assert.equal(tech.length, 17, "two minutes in, then every four, to the end: " + tech.map((c) => c.at));
  assert.equal(tech[0]!.at, 121, "the first is just past two minutes, as the old rule had it");
  for (let i = 1; i < tech.length; i++) assert.equal(tech[i]!.at, 120 + 240 * i, "off the four-minute grid");
  assert.equal(of(r.said, "halfway").length, 1);
  assert.deepEqual(of(r.said, "keep-going").map((c) => c.at), [3360, 3660, 3960]);
});

test("BLOCKER: locked mid-run and unlocked again — every reminder is said once, by one player, with no catch-up", () => {
  // In his hand to 1000 s, in a pocket to 2950 s, back in his hand to the finish. The native player
  // says what falls in the pocket; the page says the rest; the moment he unlocks, nobody says anything.
  // ⚠️ 2950, NOT A ROUND 3000: 3000 s is itself a form-reminder boundary (120 + 240 x 12), so a line
  // there is the next reminder arriving on time, not a catch-up, and the test could not tell them apart.
  const inPocket = (s: number) => s >= 1000 && s < 2950;
  const first = pageRun({ ...HIS_RUN, to: 999 });
  // The schedule the page leaves behind as he locks the phone, built from the page's own state.
  const handed = schedule({ ...HIS_RUN, elapsed: 1000, coach: first.coach })
    .filter((c) => inPocket(c.at));
  const rest = pageRun({ ...HIS_RUN, from: 1000, to: 4199, hidden: inPocket, coach: first.coach });
  assert.equal(rest.said.filter((c) => inPocket(c.at)).length, 0,
    "the page spoke while the native player held the clock: " + JSON.stringify(rest.said.filter((c) => inPocket(c.at))));
  assert.equal(rest.said.filter((c) => c.at === 2950).length, 0, "the page caught up on unlock");
  assert.ok(handed.length >= 8, "the pocket was not covered by the native list: " + JSON.stringify(handed.map((c) => [c.trigger, c.at])));
  const heard = first.said.concat(rest.said).concat(handed.map((c) => ({ trigger: c.trigger, at: c.at })));
  for (const t of ["halfway", "technique", "keep-going"]) {
    const xs = of(heard, t).map((c) => c.at).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i]! - xs[i - 1]! > 200, t + " said twice, at " + xs[i - 1] + " and " + xs[i]);
    }
  }
  assert.equal(of(heard, "halfway").length, 1, "halfway once, whoever held the clock");
  assert.equal(of(heard, "technique").length, 17, "every form reminder heard once across both players");
});

test("BLOCKER: a distance session's halfway is still said by the page while hidden — nobody else has it", () => {
  const steps = [dist(10000, 360)];
  const r = pageRun({ steps, type: "long", target: 3600, to: 3600, hidden: () => true, metresPerSec: 2.8 });
  assert.equal(of(r.said, "halfway").length, 1, "a distance halfway is off the schedule, so the page must say it");
  assert.equal(of(r.said, "technique").length, 0, "hidden, the form reminders are the schedule's");
});

test("keep-going is not said in a cool-down on the page either", () => {
  const r = pageRun({ steps: [timed(600, "warmup"), timed(1200, "steady", 7), timed(600, "cooldown")],
    type: "threshold", target: 2400, to: 2400 });
  assert.equal(of(r.said, "keep-going").length, 0, JSON.stringify(r.said));
});

test("the page re-pushes the schedule after each reminder it says in the app, and never in a browser", () => {
  const app = pageRun({ ...HIS_RUN, to: 1000, native: true });
  assert.equal(app.pushes, app.said.length, "every reminder said in the foreground must come off the native list");
  const web = pageRun({ ...HIS_RUN, to: 1000, native: false });
  assert.equal(web.pushes, 0, "a browser has no native list to correct");
});

test("a free run with no schedule keeps the page's own reminders while hidden", () => {
  // ⚠️ coachNativeSchedule returns before posting anything for a session with no steps, so handing the
  // clock to Swift there would hand it to a player holding nothing.
  const body = fnBody("coachNativeOwnsClock");
  assert.match(body, /COACH\.schedPosted/, "the page goes quiet whether or not a schedule exists");
  const reset = fnBody("coachResetSession");
  assert.match(reset, /COACH\.schedPosted = false/, "run two would inherit run one's schedule flag");
  assert.match(reset, /COACH\.techSlot = -1/);
  assert.match(reset, /COACH\.keepSlot = -1/);
});

/* ------------------------------------------------------------------------------------------------ *
 * The runner's "how often" setting reaches the lists handed to Swift                                *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: Minimal is minimal with the phone locked too", () => {
  const src = fnBody("coachSchedulePick") + "\n" + fnBody("coachFrequencyAllows") + "\nreturn coachSchedulePick;";
  const pickFor = (frequency: string) => (new Function("COACH", "RC", "coachScheduledPrompt", src) as
    (...a: unknown[]) => (t: string, i: number, type: string) => { id: string } | null)(
    { cfg: { frequency } }, { ALL_PROMPTS },
    (trigger: string) => {
      const p = PROMPTS.find((x) => x.trigger === trigger);
      return p ? { id: p.id, file: p.id + ".mp3" } : null;
    });
  assert.equal(pickFor("minimal")("technique", 0, "long"), null, "a form reminder survives Minimal on the locked phone");
  assert.ok(pickFor("minimal")("halfway", 0, "long"), "Minimal still keeps the key moments");
  assert.ok(pickFor("normal")("technique", 0, "long"), "Normal keeps the form reminders");
  // Both lists handed to Swift go through it.
  assert.match(fnBody("coachPushWatchCueMap"), /coachSchedulePick\(/, "the wrist's cue map ignores the setting");
  assert.match(fnBody("coachScheduleReminders"), /coachSchedulePick\(/, "the reminders ignore the setting");
});

/* ------------------------------------------------------------------------------------------------ *
 * The wrist                                                                                         *
 * ------------------------------------------------------------------------------------------------ */

const WM = swiftCode("WorkoutManager.swift");

test("BLOCKER: a watch-recorded run sends the kilometre line and the form reminder to the phone", () => {
  assert.match(swiftBody(WM, "private func recordSplits()"), /speakOnPhone\("milestone-distance"\)/,
    "the wrist records a split and says nothing about it");
  assert.match(WM, /speakOnPhone\("technique"\)/, "the wrist never sends a form reminder");
  const known = new Function(constStmt("WATCH_COUNT_CLIPS").slice(1) + "\n" +
    SRC.slice(SRC.indexOf("const WATCH_CUE_TRIGGERS"), SRC.indexOf(";", SRC.indexOf("const WATCH_CUE_TRIGGERS")) + 1) +
    "\nreturn WATCH_CUE_TRIGGERS;")() as string[];
  for (const t of ["milestone-distance", "technique"]) {
    assert.ok(known.includes(t), t + " has no clips in the cue map, so a pocketed phone cannot play it");
  }
});

test("BLOCKER: the kilometre line is said once per batch, after the loop, and only while running", () => {
  // ⚠️ A late HealthKit sum can cross two kilometres in one call; inside the loop that is "another
  // kilometre done" twice in a row. And a sum landing in a pause must not talk over the pause line.
  const body = swiftBody(WM, "private func recordSplits()");
  const loop = swiftBody(body, "while distanceMetres - lastSplitMetre >= 1000");
  assert.doesNotMatch(loop, /speakOnPhone/, "the kilometre line is inside the per-kilometre loop");
  assert.match(body, /if crossed > 0, phase == \.running \{ _ = speakOnPhone\("milestone-distance"\) \}/);
});

test("BLOCKER: the wrist and the page keep ONE rhythm and ONE list of relaxed sessions", () => {
  const first = /static let techniqueFirst: TimeInterval = (\d+)/.exec(WM);
  const every = /static let techniqueEvery: TimeInterval = (\d+)/.exec(WM);
  assert.ok(first && every, "the wrist's reminder grid is not declared where this test looks");
  assert.equal(constStmt("COACH_TECH_FIRST_S").trim(), "const COACH_TECH_FIRST_S = " + first[1] + ";");
  assert.equal(constStmt("COACH_TECH_EVERY_S").trim(), "const COACH_TECH_EVERY_S = " + every[1] + ";");
  const wrist = /var isRelaxedSession: Bool \{\s*\[([^\]]*)\]/.exec(WM);
  assert.ok(wrist, "isRelaxedSession is not where this test looks");
  const wristTypes = [...wrist[1]!.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
  const pageTypes = [...fnBody("coachTechType").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(wristTypes, pageTypes, "a session gets form reminders on one device and not the other");
  // And the slow-is-fine rule reads the same list rather than a copy of it.
  assert.match(swiftBody(WM, "var slowIsFine: Bool"), /guard isRelaxedSession else/);
});

test("the wrist's reminder waits for a quiet phone, and its state is per run", () => {
  const tick = WM.slice(WM.indexOf("let slot = Self.techniqueSlot(elapsed: self.elapsed)") - 200,
    WM.indexOf("let slot = Self.techniqueSlot(elapsed: self.elapsed)") + 400);
  assert.match(tick, /Date\(\)\.timeIntervalSince\(self\.lastPhoneCueAt\) > 20/,
    "a form reminder can land on top of the line before it — the phone drops the second as 'already playing'");
  assert.match(swiftBody(WM, "func speakOnPhone("), /lastPhoneCueAt = Date\(\)/, "nothing records when the phone was last given a line");
  const reset = swiftBody(WM, "func reset()");
  assert.match(reset, /techniqueSlotSpoken = -1/, "run two inherits run one's reminders");
  assert.match(reset, /lastPhoneCueAt = \.distantPast/);
});

test("with the phone out of range the wrist stays silent for these lines rather than reading them out", () => {
  const voice = readFileSync(WATCH + "WorkoutVoice.swift", "utf8");
  assert.match(voice, /case "milestone-distance", "keep-going", "technique": return/,
    "a robot voice now reads the form reminder when the phone is out of range");
});

/* ------------------------------------------------------------------------------------------------ *
 * Leaving the live screen                                                                           *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: the coach keeps talking when the runner looks at another screen mid-run", () => {
  // coachTick rode on liveUpdate, which renderLiveNow skips when the live screen is not mounted.
  for (const t of ["gpsUiTick", "indoorUiTick"]) {
    assert.match(fnBody(t), /coachTickOffScreen\(at\)/, t + " does not keep the coach ticking off-screen");
  }
  let ticks = 0;
  const src = fnBody("coachTickOffScreen") + "\nreturn coachTickOffScreen;";
  const make = (mounted: boolean) => (new Function("LIVE", "$", "coachTick", src) as (...a: unknown[]) => (at: number) => void)(
    { rt: { snapshot: () => ({}) } }, () => (mounted ? {} : null), () => { ticks++; });
  make(false)(1000);
  assert.equal(ticks, 1, "off the live screen the coach does not tick");
  make(true)(1000);
  assert.equal(ticks, 1, "on the live screen liveUpdate already ticks the coach — twice would double every rhythm");
});
