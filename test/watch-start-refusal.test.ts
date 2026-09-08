import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A RUN THAT ENDED AND WAS NEVER DISMISSED MADE THE WRIST DEAF TO THE PHONE, FOR EVER, IN SILENCE.
 *
 * Reported by the owner, 2026-09-08, with two screenshots: *"the session and watch app doesnt
 * recording start when selecting to start on watch if the previous run from a different day didn't
 * get finished on the watch"*. The watch showed the old run's summary ("Well done, Adam", 0.00KM,
 * TIME 0:17); the phone sat on "Starting on your Apple Watch… it counts you in from your wrist."
 *
 * ⚠️⚠️ THE CATEGORY ERROR, WHICH IS THE WHOLE SUBJECT OF THIS FILE. `TodayView.running` is the
 * `isPresented:` binding of a `navigationDestination` — a fact about WHICH SCREEN IS ON TOP. It has
 * exactly one assignment (`running = true`) and returns to false only when SwiftUI pops the pushed
 * view, which needs two deliberate taps (Summary's Next, then the effort screen's Save or Skip).
 * `store.onStartNow` asked `guard !running else { return }` — a NAVIGATION fact answering a
 * RECORDER-BUSY question — and returned silently, before `beginNow`'s `reset()` could make
 * everything consistent again.
 *
 * ⚠️ AND THE TWO HAVE BEEN MEASURED DISAGREEING IN BOTH DIRECTIONS. `SessionDetailView`'s own note
 * records the inverse: navigation popped while a real HKWorkoutSession, GPS and Live Activity were
 * still running, with nothing on the wrist able to set `running` true again. So the old guard both
 * refused starts it should have allowed AND allowed a second recorder it should have refused.
 *
 * ⚠️ THIS WAS A HALF-FIXED BUG AND ITS OWN FIX COMMENT NAMES THE MECHANISM. TodayView's comment
 * block already said: *"A run that ended without clearing `running` therefore left the watch
 * permanently deaf to the phone, with nothing on screen to say so"* — and then concluded *"acting is
 * what needs a guard, and the closure already has one."* The closure's guard was the wrong guard.
 */

const WATCH = (f: string) =>
  readFileSync(new URL("../ios/InteRunWatch/" + f, import.meta.url), "utf8");
const PHONE = (f: string) =>
  readFileSync(new URL("../ios/InteRun/" + f, import.meta.url), "utf8");

/**
 * Strip `//` comments so a guard cannot be satisfied by the prose that explains it.
 *
 * ⚠️ Every comment in this area QUOTES the identifiers it forbids — that trap has fired twelve-plus
 * times in this project. Quote-aware, and block comments are refused outright rather than parsed: a
 * `/*` sweep over real source has a documented ten-kilobyte blind window, and none of these files
 * uses one, so the honest thing is to fail loudly if that ever changes.
 */
function stripComments(src: string): string {
  assert.doesNotMatch(src, /\/\*/,
    "this source now contains a block comment; the stripper below cannot see inside one");
  return src.split("\n").map((line) => {
    let quoted = false;
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i]!;
      if (c === "\\") { i++; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (!quoted && c === "/" && line[i + 1] === "/") return line.slice(0, i);
    }
    return line;
  }).join("\n");
}

/** The body of a Swift declaration, brace-matched from its signature to the matching close. */
function fn(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.notEqual(at, -1, `the source no longer contains ${signature}`);
  const open = src.indexOf("{", at);
  assert.notEqual(open, -1, `${signature} has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return assert.fail(`${signature} has no matching close brace`);
}

/* ------------------------------------------------------- G1: the predicate, actually run */

/**
 * Compile the REAL predicate and drive every phase through it.
 *
 * ⚠️ THE REAL FUNCTION, LIFTED WHOLE, NEVER A MODEL OF IT. A hand-written copy in the test is a
 * second implementation that agrees with itself and proves nothing about the shipped one — and this
 * project has watched a lifted probe supply its own constants and pass a re-break twice.
 */
function recorderBusy(rows: Array<{ phase: string; countdown: number | null; age?: number }>) {
  const swiftc = "/usr/bin/swiftc";
  if (!existsSync(swiftc)) {
    assert.fail("swiftc is not on this machine, so the busy predicate cannot be driven. Install the "
      + "Xcode command line tools (xcode-select --install). This gate is deliberately a failure "
      + "rather than a skip: a check that disappears with its instrument reports a release as "
      + "verified having verified nothing.");
  }
  const src = WATCH("WorkoutManager.swift");
  const phase = /enum Phase[^\n]*\n/.exec(src);
  assert.ok(phase, "WorkoutManager.Phase is no longer a one-line enum — has it been reshaped?");
  const sticks = /static let requestingSticksFor: TimeInterval = ([0-9.]+)/.exec(src);
  assert.ok(sticks, "the requesting bound is gone — a stuck authorisation refuses for ever again");
  const body = /static func recorderBusy\([\s\S]*?\n    \}/.exec(src);
  assert.ok(body, "WorkoutManager.recorderBusy is no longer recognisable — has it been inlined?");
  const dir = mkdtempSync(join(tmpdir(), "interun-busy-"));
  const file = join(dir, "main.swift");
  writeFileSync(file, [
    "import Foundation",
    "enum Probe {",
    "    " + phase![0].trim(),
    // ⚠️ THE BOUND IS LIFTED TOO. A lift list that omits a dependency measures a strictly easier
    // program — and this one failed loudly with "cannot find requestingSticksFor in scope".
    "    static let requestingSticksFor: TimeInterval = " + sticks![1] + "",
    body![0],
    "}",
    'for line in (try! String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8))',
    '    .split(separator: "\\n") {',
    '  let p = line.split(separator: " ").map(String.init)',
    "  let ph: Probe.Phase",
    '  switch p[0] {',
    '  case "idle": ph = .idle',
    '  case "requesting": ph = .requesting',
    '  case "running": ph = .running',
    '  case "paused": ph = .paused',
    '  case "ended": ph = .ended',
    '  default: ph = .failed("whatever")',
    "  }",
    '  let c = p[1] == "nil" ? nil : Int(p[1])',
    '  let age = Double(p[2])!',
    "  print(Probe.recorderBusy(phase: ph, countdown: c, requestingFor: age) ? \"busy\" : \"free\")",
    "}",
  ].join("\n"));
  const bin = join(dir, "probe");
  execFileSync(swiftc, ["-O", "-o", bin, file], { stdio: "pipe" });
  const input = join(dir, "in.txt");
  writeFileSync(input, rows.map((r) =>
    [r.phase, r.countdown === null ? "nil" : r.countdown, r.age ?? 0].join(" ")).join("\n"));
  return execFileSync(bin, [input], { encoding: "utf8" }).trim().split("\n");
}

const PHASES = ["idle", "requesting", "running", "paused", "ended", "failed"];

test("BLOCKER: a recorder is busy exactly when starting again would make a second one", () => {
  const rows = PHASES.map((phase) => ({ phase, countdown: null }));
  const got = recorderBusy(rows);
  const want: Record<string, string> = {
    // ⚠️ .ended AND .failed ARE FREE, AND THAT IS THE REPORTED BUG. end() calls sendHome() BEFORE
    // the HealthKit teardown that owns the transition to .ended, so a run sitting on its summary is
    // already in the phone's Logbook. Treating it as busy is what made the wrist deaf.
    idle: "free", ended: "free", failed: "free",
    // ⚠️ .requesting IS BUSY, and not out of caution: begin() has one caller — start()'s HealthKit
    // authorisation callback — and no phase guard of its own, so a second start while the first
    // request is in flight lands two begin() calls and two HKWorkoutSessions, the second
    // overwriting `session` and orphaning the first.
    // ⚠️ .requesting is busy only BRIEFLY — see the bound below. Driven here at age 0.
    requesting: "busy", running: "busy", paused: "busy",
  };
  PHASES.forEach((p, i) => {
    assert.equal(got[i], want[p], `phase .${p} should be ${want[p]}, the predicate said ${got[i]}`);
  });
});

test("BLOCKER: a live countdown is busy even though the phase still says idle", () => {
  // ⚠️ startCountingDown never touches `phase`, so for three seconds the phase alone answers "free"
  // while a run is already on its way. The predicate must read both or a phone start lands on top
  // of a wrist count-in.
  const got = recorderBusy([
    { phase: "idle", countdown: 3 },
    { phase: "idle", countdown: 1 },
    { phase: "idle", countdown: null },
  ]);
  assert.deepEqual(got, ["busy", "busy", "free"]);
});

/* ------------------------------------------------ G2: the decision reads the lifecycle, in time */

test("BLOCKER: the one place a run starts asks the lifecycle, and asks before reset()", () => {
  const tv = stripComments(WATCH("TodayView.swift"));
  const body = fn(tv, "private func beginNow(");

  assert.match(body, /recorderBusy/,
    "beginNow no longer consults the busy predicate — a second recorder is one tap away");

  // ⚠️ ORDERING, WITH BOTH HALVES PROVED PRESENT FIRST. `indexOf` returns -1 for a missing needle
  // and -1 is less than any real index, so an ordering check written without this passes when the
  // thing it is ordering has been deleted. That has silently satisfied two guards in this project.
  const asked = body.indexOf("recorderBusy");
  const reset = body.indexOf("workout.reset()");
  assert.notEqual(asked, -1, "beginNow does not ask the predicate at all");
  assert.notEqual(reset, -1, "beginNow no longer calls reset() — the manager outlives a run");
  assert.ok(asked < reset,
    "the busy question is asked AFTER reset(), which sets phase = .idle — so it always answers "
    + "\"free\" and proves nothing. The ordering IS the guarantee.");
});

test("BLOCKER: the phone's go path consults no navigation flag", () => {
  const tv = stripComments(WATCH("TodayView.swift"));
  // Brace-matched from the assignment, never a character window: a window is not a function, and
  // that has expired twelve-plus times here.
  const closure = fn(tv, "store.onStartNow =");
  assert.doesNotMatch(closure, /\brunning\b/,
    "the go path reads `running` again — that is the navigationDestination's own binding, and a run "
    + "left on its summary leaves it true for ever. This is the reported bug restored.");
  assert.match(closure, /beginNow\(/, "the go path no longer starts anything");
});

test("BLOCKER: the busy flag is a delegation, so there is no second opinion to drift", () => {
  const tv = stripComments(WATCH("TodayView.swift"));
  // ⚠️ THIS IS WHAT STOPS A RENAME EVADING THE GUARD ABOVE. Without it, a fresh
  // `@State private var busy` alongside `running` would satisfy every other assertion here.
  const prop = stripComments(fn(tv, "private var recorderBusy"));
  assert.match(prop, /WorkoutManager\.recorderBusy\(/,
    "TodayView is deciding busy-ness itself rather than asking the one driven predicate");
  // All three arguments come from the manager, so the view holds no opinion of its own.
  for (const arg of ["phase:", "countdown:", "requestingFor:"]) {
    assert.ok(prop.includes(arg), `the delegation no longer passes ${arg}`);
  }
  assert.match(prop, /workout\.phase/, "the phase is not the manager's");
  assert.match(prop, /workout\.countdown/, "the countdown is not the manager's");
  assert.match(prop, /workout\.requestingSince/, "the age is not the manager's");
});

/* ------------------------------------------------------- G3: the refusal leaves the wrist */

test("BLOCKER: a refused start is reported to the phone, never swallowed", () => {
  const ss = stripComments(WATCH("SessionStore.swift"));
  const tv = stripComments(WATCH("TodayView.swift"));

  // The sender's NAME is derived, so renaming it cannot orphan the call site.
  const senders = [...ss.matchAll(/func (\w+)\(\)\s*\{/g)]
    .filter((m) => fn(ss, `func ${m[1]}()`).includes("startRefused"))
    .map((m) => m[1]!);
  assert.equal(senders.length, 1,
    `expected exactly one function in SessionStore to send startRefused, found ${senders.length}`);
  const send = fn(ss, `func ${senders[0]}()`);
  assert.match(send, /sendMessage\(/, "the refusal is not actually sent over WatchConnectivity");

  const closure = fn(tv, "store.onStartNow =");
  assert.ok(closure.includes(senders[0]!),
    `the go path never calls ${senders[0]} — a refusal would be silent again, which is the defect`);
});

test("BLOCKER: the phone routes the refusal before its last-resort run ingest, and answers it", () => {
  const wb = stripComments(PHONE("WatchBridge.swift"));
  const route = fn(wb, "private func route(");
  // ⚠️ THE EXACT KEY, NOT A SUBSTRING. Written as indexOf("startRefused") this passed with the key
  // renamed to "startRefusedXX" — the branch dead, the guard green — because the longer name
  // contains the shorter one. The same trap has fired here on `stravaAutoSend` and `clubTxInk`.
  const KEY = 'message["startRefused"]';
  const marker = route.indexOf(KEY);
  const ingest = route.indexOf("acceptRun(");
  assert.notEqual(marker, -1, "the phone no longer routes the wrist's refusal on the exact key");
  assert.notEqual(ingest, -1, "route no longer falls through to acceptRun");
  assert.ok(marker < ingest,
    "the refusal is routed AFTER the fallthrough that treats a message as a finished run");

  assert.match(route, /reportStart\(false,/,
    "the refusal does not reach reportStart, so the phone never leaves its waiting room");
  assert.match(route, /Your watch is already recording a run/,
    "the refusal carries no sentence the runner can act on");
});

/* --------------------------------------- G7: the finish screen does not survive into the next run */

test("BLOCKER: the effort screen cannot survive into the next run", () => {
  // ⚠️ A NEW STATE THIS FIX CREATES. With `running` already true the destination is already
  // presented, so a new run re-purposes WorkoutView IN PLACE — no push, no pop — and the view's own
  // @State survives. Left on the view, a runner who had tapped Next and lowered their wrist would
  // have the NEXT run go straight to the effort screen and skip its summary entirely.
  const wm = stripComments(WATCH("WorkoutManager.swift"));
  const wv = stripComments(WATCH("WorkoutView.swift"));

  assert.match(fn(wm, "func reset()"), /showingEffort = false/,
    "reset() no longer clears the effort flag, so run two skips its own summary");
  assert.doesNotMatch(wv, /@State private var askingEffort/,
    "the effort flag has a second home on the view again — it must live where reset() can reach it");
  assert.match(wv, /workout\.showingEffort/,
    "WorkoutView no longer reads the manager's effort flag");
});

/* -------------------------------------------------------------------------------------------------
 * ⚠️⚠️ THE FIRST VERSION OF THIS FIX SHIPPED A WORSE BUG THAN THE ONE IT FIXED, AND THESE TWO GUARDS
 * ARE THAT LESSON. Reported the same day: "its still not working, in fact its worse, some sessions
 * are just not starting now". Two causes, both mine, both from treating a state as authoritative
 * without asking whether it can be LEFT.
 * ---------------------------------------------------------------------------------------------- */

test("BLOCKER: a stuck authorisation cannot refuse every start for ever", () => {
  // ⚠️ `.requesting` HAS NO CLEARING PATH. If requestAuthorization's completion never fires the
  // phase stays there, so treating it as unconditionally busy turned a stuck round trip into a
  // permanent, silent dead end — nothing on screen and no way to retry. The navigation flag it
  // replaced was WRONG but ESCAPABLE: backing out cleared it. A fix that removes an escape hatch is
  // not a fix.
  const src = readFileSync(new URL("../ios/InteRunWatch/WorkoutManager.swift", import.meta.url), "utf8");
  const sticks = /static let requestingSticksFor: TimeInterval = ([0-9.]+)/.exec(src);
  assert.ok(sticks, "the bound is gone");
  const secs = Number(sticks![1]);

  const got = recorderBusy([
    { phase: "requesting", countdown: null, age: 0 },
    { phase: "requesting", countdown: null, age: secs - 1 },
    { phase: "requesting", countdown: null, age: secs + 1 },
    { phase: "requesting", countdown: null, age: 600 },
  ]);
  assert.deepEqual(got, ["busy", "busy", "free", "free"],
    "a .requesting older than the bound must be treated as stuck and let the runner start again");

  // ⚠️ .running and .paused are deliberately NOT time-bounded — a run legitimately lasts hours, and
  // their escape is that the refusal RE-PRESENTS a screen carrying an End button.
  assert.deepEqual(recorderBusy([
    { phase: "running", countdown: null, age: 99999 },
    { phase: "paused", countdown: null, age: 99999 },
  ]), ["busy", "busy"], "a long run must still refuse a second recorder");

  const tv = stripComments(readFileSync(
    new URL("../ios/InteRunWatch/TodayView.swift", import.meta.url), "utf8"));
  assert.match(fn(tv, "private var recorderBusy"), /requestingFor:/,
    "TodayView no longer passes the age, so the bound cannot bind");
});

test("BLOCKER: a re-delivered start is a duplicate, not a refusal to report", () => {
  // ⚠️⚠️ flushStartNow RE-ARMS AND RESENDS WHENEVER sendMessage ERRORS, AND ITS OWN COMMENT SAID IT
  // RELIED ON THE GUARD THAT WAS REMOVED: "A duplicate on the watch is harmless — its start guards
  // on !running." Once the refusal began being REPORTED, that harmless duplicate started clearing
  // the phone's waiting room and toasting "already recording" over a run that had started fine.
  const wb = readFileSync(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url), "utf8");
  assert.match(wb, /pendingStartNow = true/,
    "the retry has gone — if it truly has, this guard's premise needs revisiting rather than deleting");

  const tv = stripComments(readFileSync(
    new URL("../ios/InteRunWatch/TodayView.swift", import.meta.url), "utf8"));
  const closure = fn(tv, "store.onStartNow =");
  // The refusal must be CONDITIONAL on not having just accepted a start.
  const refuse = closure.indexOf("sendStartRefused");
  const guardAt = closure.indexOf("startJustAccepted");
  assert.notEqual(refuse, -1, "the refusal is gone entirely — the phone waits for ever again");
  assert.notEqual(guardAt, -1,
    "the refusal is unconditional, so a delivery retry reports a failure over a run that started");
  assert.ok(guardAt < refuse, "the duplicate check must gate the report, not follow it");

  // ⚠️ THE STAMP IS ON THE SUCCESS PATH ONLY, AND THAT IS THE CLAIM THAT BITES. An ordering claim
  // against reset() was written here first and watched PASSING with the stamp moved — reset() does
  // not clear acceptedStartAt (deliberately; see its own note), so the order cannot matter. What
  // does matter: stamped on a REFUSAL, every refusal would silence the next one within 45 seconds
  // and the phone would wait for ever again — the original bug, restored by the fix for it.
  const begin = fn(tv, "private func beginNow(");
  const stamp = begin.indexOf("noteStartAccepted");
  assert.notEqual(stamp, -1, "no start is ever stamped, so every duplicate is reported as a refusal");
  const busyBranch = begin.slice(begin.indexOf("if recorderBusy"), begin.indexOf("workout.reset()"));
  assert.ok(!busyBranch.includes("noteStartAccepted"),
    "a REFUSAL stamps the accepted-start clock, so the next genuine refusal is silenced and the "
    + "phone waits for ever — which is the bug this whole file exists for");
  assert.ok(stamp > begin.indexOf("running = true"),
    "the stamp is not on the path that actually starts a run");
});
