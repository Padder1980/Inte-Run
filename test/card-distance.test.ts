import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * THE LOCK-SCREEN CARD'S DISTANCE KEEPS MOVING, AND IT IS STILL NOT A SECOND RECORDER.
 *
 * The owner's ruling, 2026-08-22: *"The distance needs to keep going on the lock screen if the user
 * has decided to use the phone to run......There's no reason that this should affect anything else and
 * you need to make sure it doesn't break anything else...i don't know why the distance cant keep
 * tracking, in fact when i was looking at the card on the lock screen, it does change but just not
 * accurately"*.
 *
 * That last observation is the diagnosis: iOS THROTTLES the web content process rather than stopping
 * it, so `pushLiveActivity` runs whenever the page wakes and every number stands still in between.
 *
 * ⚠️ "MAKE SURE IT DOESN'T BREAK ANYTHING ELSE" IS THE HARD PART, AND IT IS WHAT THIS FILE IS FOR.
 * The obvious implementation — Swift adding up per-fix deltas — is the exact fault the page's own
 * anchor-and-leash exists to prevent, and it would be WORSE than the stale card: noise is positive on
 * every reading and haversine is always positive, so it runs long, and the error ACCUMULATES for as
 * long as the phone stays locked. What ships is a single chord from the last position the PAGE
 * published, so nothing accumulates and every push replaces it outright.
 */

const SRC = new URL("../ios/InteRun/CardDistance.swift", import.meta.url);
const src = () => readFileSync(SRC, "utf8");
const noswift = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/\/?.*$/gm, "");

/* ------------------------------------------------------------------ the arithmetic, actually run */

/** Compile the real `project` and drive it. One point per line: `base lat lon accLat accLon acc age`. */
function project(rows: Array<{ base: number; anchor: [number, number]; fix: [number, number]; acc: number; age: number }>) {
  const swiftc = "/usr/bin/swiftc";
  if (!existsSync(swiftc)) {
    assert.fail("swiftc is not on this machine, so the card's arithmetic cannot be driven. "
      + "Install the Xcode command line tools (xcode-select --install). This gate is deliberately a "
      + "failure rather than a skip: a check that disappears with its instrument reports a release as "
      + "verified having verified nothing.");
  }
  // ⚠️ THE REAL FUNCTION, LIFTED WHOLE, NOT A MODEL OF IT. A hand-written copy in the test is a
  // second implementation that agrees with itself and proves nothing about the shipped one.
  const body = /static func project\([\s\S]*?\n    \}/.exec(src());
  assert.ok(body, "CardDistance.project is no longer recognisable — has it been inlined again?");
  const dir = mkdtempSync(join(tmpdir(), "interun-card-"));
  const file = join(dir, "main.swift");
  writeFileSync(file, [
    "import CoreLocation",
    "import Foundation",
    "enum Probe {",
    body![0],
    "}",
    "for line in (try! String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8))",
    "    .split(separator: \"\\n\") {",
    "  let p = line.split(separator: \" \").map { Double($0)! }",
    "  let anchor = CLLocation(latitude: p[1], longitude: p[2])",
    "  let fix = CLLocation(coordinate: CLLocationCoordinate2D(latitude: p[3], longitude: p[4]),",
    "                       altitude: 0, horizontalAccuracy: p[5], verticalAccuracy: 1,",
    "                       timestamp: Date())",
    "  let r = Probe.project(baseMeters: p[0], anchor: anchor, fix: fix, age: p[6])",
    "  print(r == nil ? \"nil\" : String(format: \"%.3f\", r!))",
    "}",
  ].join("\n"));
  const bin = join(dir, "probe");
  execFileSync(swiftc, ["-O", "-o", bin, file], { stdio: "pipe" });
  const input = join(dir, "in.txt");
  writeFileSync(input, rows.map((r) =>
    [r.base, r.anchor[0], r.anchor[1], r.fix[0], r.fix[1], r.acc, r.age].join(" ")).join("\n"));
  return execFileSync(bin, [input], { encoding: "utf8" }).trim().split("\n")
    .map((l) => (l === "nil" ? null : Number(l)));
}

/** Metres north of a reference latitude, in degrees. */
const north = (m: number) => m / 111_320;
const BASE: [number, number] = [51.5074, -0.1278];

test("BLOCKER: it adds a chord from the page's own figure — so nothing accumulates", () => {
  // A runner 60 m north of the page's anchor, on a total the page put at 1000 m, is at 1060 m. Ten
  // seconds later, 60 m further on, they are at 1120 m — measured from the SAME anchor, so the second
  // reading does not contain the first one's error.
  const [a, b] = project([
    { base: 1000, anchor: BASE, fix: [BASE[0] + north(60), BASE[1]], acc: 8, age: 10 },
    { base: 1000, anchor: BASE, fix: [BASE[0] + north(120), BASE[1]], acc: 8, age: 20 },
  ]);
  assert.ok(Math.abs(a! - 1060) < 1, "expected ~1060, got " + a);
  assert.ok(Math.abs(b! - 1120) < 1, "expected ~1120, got " + b);
});

test("BLOCKER: a jittering phone at a standstill gains almost nothing, and never accumulates", () => {
  // ⚠️ THE FAULT THIS DESIGN EXISTS TO AVOID. Summing per-fix deltas over 120 jittering fixes credits
  // hundreds of metres to somebody standing still — measured on the page's own harness at ±32 m of
  // wander. A chord from a fixed point is bounded by the jitter itself, forever.
  const rows = [];
  for (let i = 0; i < 120; i++) {
    const jx = ((i * 37) % 21 - 10) / 10;   // ±1 m, deterministic
    const jy = ((i * 53) % 21 - 10) / 10;
    rows.push({ base: 1000, anchor: BASE,
      fix: [BASE[0] + north(jx), BASE[1] + north(jy)] as [number, number], acc: 8, age: i + 1 });
  }
  const out = project(rows).map((v) => v! - 1000);
  const worst = Math.max(...out);
  assert.ok(worst < 3, "a standstill drifted " + worst.toFixed(1) + " m; a sum of deltas gives hundreds");
  // And it does not trend: the last reading is no bigger than the first few.
  assert.ok(out[out.length - 1]! < 3, "the drift is accumulating: " + out.slice(-3).join(", "));
});

test("BLOCKER: a chord across a bend UNDER-reads, which is the safe direction", () => {
  // 100 m north then 100 m east is 200 m of running and a 141 m chord. The card must never claim more
  // ground than was covered; the page corrects it the moment it wakes.
  const [v] = project([
    { base: 0, anchor: BASE, fix: [BASE[0] + north(100), BASE[1] + north(100) / Math.cos(BASE[0] * Math.PI / 180)], acc: 8, age: 60 },
  ]);
  assert.ok(v! > 130 && v! < 150, "expected the ~141 m chord of a 200 m dog-leg, got " + v);
  assert.ok(v! < 200, "the card claimed more ground than the runner covered");
});

test("BLOCKER: a fix the page itself would refuse is refused here, at the same threshold", () => {
  // onGpsPos calls a fix `good` at 35 m or better. Two gates that disagree about what a usable fix is
  // put a position on the card that the run itself never accepted.
  const out = project([
    { base: 500, anchor: BASE, fix: [BASE[0] + north(50), BASE[1]], acc: 34, age: 10 },
    { base: 500, anchor: BASE, fix: [BASE[0] + north(50), BASE[1]], acc: 36, age: 10 },
    { base: 500, anchor: BASE, fix: [BASE[0] + north(50), BASE[1]], acc: -1, age: 10 },
  ]);
  assert.ok(out[0] != null, "a 34 m fix must be usable");
  assert.equal(out[1], null, "a 36 m fix must be refused");
  assert.equal(out[2], null, "an invalid fix (negative accuracy) must be refused");
});

test("BLOCKER: a wild fix is CLAMPED to a believable speed, not shown and not dropped", () => {
  // 2 km from the anchor two seconds after the page spoke is not a runner. Dropping it would freeze
  // the card; showing it would jump it by two kilometres. Clamped, it advances at a pace a person
  // could run and the next good fix corrects it.
  const [v] = project([
    { base: 1000, anchor: BASE, fix: [BASE[0] + north(2000), BASE[1]], acc: 8, age: 2 },
  ]);
  assert.ok(v! > 1000 && v! < 1020, "expected a clamp to ~7 m/s over 2 s, got " + v);
});

/* -------------------------------------------------------- and the rules a run must never be given */

test("BLOCKER: nothing this computes can reach the run, Strava, Health or the store", () => {
  // ⚠️ THE ONE PROMISE THAT MATTERS: "There's no reason that this should affect anything else."
  const whole = readFileSync(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url), "utf8")
    + readFileSync(new URL("../ios/InteRun/LocationService.swift", import.meta.url), "utf8");
  const uses = [...noswift(whole).matchAll(/CardDistance\.shared\.(\w+)/g)].map((m) => m[1]!);
  assert.ok(uses.length >= 3, "expected every use of CardDistance, found " + uses.length);
  for (const u of uses) {
    assert.ok(["adopt", "stop", "saw"].includes(u),
      "CardDistance grew a reader: " + u + " — it may only be told things, never asked");
  }
  // It hands its number to exactly one place, and that place is the card.
  const own = noswift(src());
  const calls = [...own.matchAll(/^\s*(\w[\w.]*)\.(\w+)\(/gm)].map((m) => m[1] + "." + m[2]);
  const outward = calls.filter((c) => !c.startsWith("Self.") && !c.startsWith("loc.")
    && !c.startsWith("Date") && !c.startsWith("CLLocation") && !c.startsWith("min") && !c.startsWith("max"));
  assert.deepEqual([...new Set(outward)], ["LiveActivityService.shared.update"],
    "CardDistance speaks to something other than the card: " + outward.join(", "));
});

test("BLOCKER: it accumulates nothing — only the PAGE may move the base or the anchor", () => {
  // ⚠️ THIS IS THE CLAIM, AND MY FIRST TWO ATTEMPTS AT IT BOTH ESCAPED THEIR RE-BREAK. "There is no
  // += on a distance" is satisfied by an accumulator written as `baseMeters = shown; anchor = loc`
  // after each push, and so is "there is exactly one distance measurement" — and because the
  // arithmetic was deliberately extracted into a pure `project`, every behavioural test still passed
  // too: the accumulation had simply moved into the stateful part that project() cannot see.
  //
  // The invariant that catches it wherever it is written: the base and the anchor are the PAGE's
  // figures, so only the page speaking may change them. Derived, not listed.
  const own = noswift(src());
  const bodies: Record<string, string> = {};
  for (const m of own.matchAll(/(?:static )?func (\w+)\(/g)) {
    const at = m.index!;
    let d = 0;
    for (let i = own.indexOf("{", at); i < own.length; i++) {
      if (own[i] === "{") d++;
      else if (own[i] === "}") { d--; if (!d) { bodies[m[1]!] = own.slice(at, i + 1); break; } }
    }
  }
  assert.ok(Object.keys(bodies).length >= 3, "the functions are no longer recognisable");
  for (const [name, body] of Object.entries(bodies)) {
    const writes = [...body.matchAll(/^\s*(?:self\.)?(baseMeters|anchor|anchorAt)\s*=/gm)].map((x) => x[1]!);
    if (name === "adopt" || name === "stop") continue;
    assert.deepEqual(writes, [],
      name + " moves the base or the anchor (" + writes.join(", ") + "). Only the page may: this is a "
      + "chord from a published position, and re-anchoring it after each fix makes it the accumulator "
      + "whose error grows for as long as the phone stays locked.");
  }
  assert.doesNotMatch(own, /(baseMeters|lastShown|shown|chord)\s*\+=/, "a running total appeared");
  assert.equal((own.match(/distance\(from:/g) || []).length, 1,
    "more than one distance measurement means more than one thing being added up");
});

test("BLOCKER: the page's push resets it, and the page sends the COMMITTED total", () => {
  const page = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  // ⚠️ COMMITTED, NOT DISPLAYED. liveDistM() already contains the pending leg measured from this same
  // anchor, so pairing THAT with the anchor counts those metres twice.
  assert.match(page, /distCommittedKm: \(LIVE\.dist \|\| 0\) \/ 1000/,
    "the push must send the committed total, not liveDistM()");
  assert.match(page, /anchorLat: typeof LIVE\.anchorLat/, "no anchor is sent, so nothing can be measured");
  const wb = noswift(readFileSync(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url), "utf8"));
  const liveCase = /case "liveActivity":[\s\S]*?\n        case /.exec(wb);
  assert.ok(liveCase, "the liveActivity case is no longer recognisable");
  assert.match(liveCase![0], /CardDistance\.shared\.adopt\(/,
    "the page speaking must reset the extrapolation — that is what stops it drifting");
});

test("BLOCKER: no anchor means no extrapolation, so a treadmill and an older page are untouched", () => {
  // LIVE.anchorLat is written only by onGpsPos, so an indoor run and a simulated one never send one —
  // and a page that predates this sends neither field. All three must behave exactly as before.
  const own = noswift(src());
  const adopt = /func adopt\([\s\S]*?\n    \}/.exec(own);
  assert.ok(adopt, "adopt is no longer recognisable");
  assert.match(adopt![0], /guard let km = committedKm, let lat = anchorLat, let lon = anchorLon/,
    "without all three there is nothing to measure from, and it must go dormant rather than guess");
  assert.match(adopt![0], /live = false/, "the dormant path must actually switch it off");
});

test("BLOCKER: a wrist-recorded run switches it off entirely", () => {
  // That card is driven from native code that keeps running while the screen is off, so it was never
  // stale — and a phone-side chord would be competing with the wrist's own figure.
  const wb = noswift(readFileSync(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url), "utf8"));
  const drive = /func driveLiveActivity\([\s\S]*?\n    \}/.exec(wb);
  assert.ok(drive, "driveLiveActivity is no longer recognisable");
  assert.match(drive![0], /CardDistance\.shared\.stop\(\)/,
    "a wrist run must stop the phone-side extrapolation");
});

test("BLOCKER: a paused run's card does not creep, and the run ending switches it off", () => {
  const own = noswift(src());
  const saw = /func saw\([\s\S]*?\n    \}/.exec(own);
  assert.ok(saw, "saw is no longer recognisable");
  assert.match(saw![0], /guard live, !paused/, "a paused run is not covering ground");
  // ⚠️ SCOPED TO THE `if ended` BLOCK ITSELF, AND THE FIRST VERSION WAS NOT — a lazy match ran
  // straight past `if ended { return }` to the `live = false` in the guard-let-else below it, so
  // deleting the whole ended branch passed. Collection-too-wide, in a two-line regex.
  const adopt = /func adopt\([\s\S]*?\n    \}/.exec(own);
  const endedBlock = /if ended \{([^{}]*)\}/.exec(adopt![0]);
  assert.ok(endedBlock, "adopt no longer has an `if ended` branch at all");
  assert.match(endedBlock![1]!, /live = false/,
    "the run ending must stop it, or a later fix moves a finished run's card");
  assert.match(endedBlock![1]!, /anchor = nil/, "and it must let go of the anchor");
});

test("the fix it reads is the NEWEST one, not each of a replayed backlog", () => {
  const ls = noswift(readFileSync(new URL("../ios/InteRun/LocationService.swift", import.meta.url), "utf8"));
  assert.match(ls, /if let newest = locations\.last[\s\S]*?CardDistance\.shared\.saw\(newest\)/,
    "only where the runner is NOW can move the card; replaying a backlog through it is waste");
  // ⚠️ AND IT IS OUTSIDE THE applicationState GATE. The buffer exists precisely because the page
  // cannot be reached, which is exactly when the card goes stale — gating this the same way would
  // switch it off in the only situation it is for.
  const i = ls.indexOf("CardDistance.shared.saw");
  const j = ls.indexOf("applicationState == .active");
  assert.ok(i >= 0 && j >= 0 && i < j,
    "the card update must not sit behind the same gate that stops the page being told");
});
