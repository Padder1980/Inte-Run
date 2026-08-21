import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

/**
 * THE WRIST'S ROUTE THINNING, EXTRACTED FROM THE SHIPPED SWIFT AND EXECUTED.
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL. `test/watch-route-thinning.test.ts` guarded the wrist's half
 * STRUCTURALLY — comments stripped, names derived, every claim a match against the source text — and
 * an adversarial pass then applied twenty-four deliberate re-breaks of which SIX escaped, five of them
 * real defects. Every one is the same class of miss, and it is the class house rule 7 names: a
 * source-text assertion proves a string EXISTS, never that anything reaches it.
 *
 *   • the accessor was made to read `if routeTail != nil { return routePoints }` — the word `routeTail`
 *     still present, the tail never returned. THE COUNT IS KEPT AND THE TAIL IS DROPPED, which is
 *     precisely the mask the route brief named: 340 points, span 99.9%, last point LOST.
 *   • `reset()` was made to re-arm `routeStride = 32` rather than 1. The line is still there, so a
 *     presence check passes; run two of an app session came back as 19 points with its first LOST.
 *   • the thinner was made to decimate by 3 while the stride still only doubled. Both literals the
 *     structural guard matches are still present; the route came back 4x back-loaded
 *     (`[17 27 34 45 45 52 67 68 67 69]` per tenth) with a perfect span and a plausible count.
 *   • the tail was placed FIRST (`[tail] + routePoints`) — first and last both lost, the drawn line
 *     jumping from the end of the run back to its start.
 *   • the thinned buffer was reversed (`routePoints = kept.reversed()`) — mean deviation 344 m, and
 *     yet the count, the span-of-set and the per-tenth histogram all read exactly correct, because a
 *     distribution is order-blind.
 *
 * So the wrist is now measured the way the phone always was: the real code runs and the points that
 * come out are measured. Nothing here is a model of the Swift — `buildWristProbe` lifts
 * `appendRoutePoint`, `thinRoutePoints`, the `route` accessor, the five route state DECLARATIONS with
 * their initial values, and `reset()`'s own route lines, all verbatim by brace matching, and compiles
 * them. The technique is the one the route fix's own measurement used.
 *
 * ⚠️ ABSENT IS A FAILURE, NOT A SKIP — the `test/share-export-harness.ts` precedent, for the same
 * reason: a guard that disappears when its instrument is missing reports a release as verified having
 * verified nothing, and this project's history is mostly guards that could not fail. The structural
 * guards and the whole phone half stay in `test/watch-route-thinning.test.ts`, which needs nothing but
 * node, so a machine with no Swift toolchain still gets that half.
 */

/* ================================================================================================ *
 * GEOMETRY AND MEASUREMENT                                                                          *
 * ================================================================================================ */

export type Pt = { lat: number; lng: number; t: number };

const LAT0 = 51.5074, LNG0 = -0.1278;
const MLAT = 111132.0, MLNG = 111320.0 * Math.cos(LAT0 * Math.PI / 180);

/** Ground a polyline claims, in metres. */
export function metres(pts: readonly Pt[]): number {
  let m = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i]!.lng - pts[i - 1]!.lng) * MLNG, dy = (pts[i]!.lat - pts[i - 1]!.lat) * MLAT;
    m += Math.hypot(dx, dy);
  }
  return m;
}

/** How many of the kept points fall in each tenth of the run. The distribution, not the count. */
export function perTenth(pts: readonly Pt[], seconds: number): number[] {
  const b = new Array(10).fill(0);
  for (const p of pts) b[Math.min(9, Math.floor(10 * p.t / seconds))]++;
  return b;
}

/**
 * How far every real fix sits from the drawn line, measured against the segment that SPANS ITS OWN
 * TIME rather than the nearest segment anywhere.
 *
 * ⚠️ NOT A GLOBAL NEAREST-SEGMENT SEARCH, AND THE DIFFERENCE DECIDES WHETHER TWO OF THE FIVE ESCAPES
 * ARE VISIBLE AT ALL. A global search asks "does this ground appear somewhere in the line", which a
 * route that comes back over itself — or a route stored in REVERSE — answers yes to while being
 * completely wrong about when the runner was where. Bracketing by time asks the question a runner
 * would: was the line where I was, when I was there. Measured on the reversed variant, the same route
 * reads a mean deviation of 344 m time-bracketed and near zero globally.
 */
export function devsTimeBracketed(poly: readonly Pt[], track: readonly Pt[]): number[] {
  const X = poly.map((p) => (p.lng - LNG0) * MLNG), Y = poly.map((p) => (p.lat - LAT0) * MLAT);
  const out: number[] = [];
  let j = 0;
  for (const p of track) {
    while (j < poly.length - 2 && poly[j + 1]!.t <= p.t) j++;
    const px = (p.lng - LNG0) * MLNG, py = (p.lat - LAT0) * MLAT;
    let best = Infinity;
    for (let i = Math.max(1, j - 1); i <= Math.min(poly.length - 1, j + 2); i++) {
      const ax = X[i - 1]!, ay = Y[i - 1]!, bx = X[i]!, by = Y[i]!;
      const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
      const L2 = vx * vx + vy * vy;
      let tt = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0;
      tt = Math.max(0, Math.min(1, tt));
      const d = Math.hypot(px - (ax + tt * vx), py - (ay + tt * vy));
      if (d < best) best = d;
    }
    out.push(best);
  }
  return out;
}

export function meanDev(poly: readonly Pt[], track: readonly Pt[]): number {
  const d = devsTimeBracketed(poly, track);
  return d.reduce((a, b) => a + b, 0) / d.length;
}

/**
 * The polyline an IDEAL even sample of the same track would claim, in metres — the control a
 * ground-fidelity claim has to be made against.
 *
 * ⚠️ A PERCENTAGE OF THE FULL-RESOLUTION GROUND IS A FUNCTION OF ROUTE GEOMETRY, NOT OF THE THINNER.
 * At 150 points a track of long curves keeps 92% of its ground and a track of 6 m hairpins keeps 58%,
 * because the thinner chords across features it cannot represent at any spacing — so a fixed
 * percentage bound passes on one fixture and fails on correct code on the next. Measured against this
 * control instead, both read within a few per cent of 1.00, and a truncated route still reads near
 * zero. Same technique as the share gate's "the feed is a reflow, proved against a crop control".
 */
export function idealEvenSample(track: readonly Pt[], cap: number): Pt[] {
  const n = track.length;
  if (n <= cap) return track.slice();
  const out: Pt[] = [];
  for (let i = 0; i < cap; i++) out.push(track[Math.round(i * (n - 1) / (cap - 1))]!);
  return out;
}

/**
 * Attach each stored point's real time by an ORDER-PRESERVING WALK through the source track.
 *
 * ⚠️ NOT A COORDINATE LOOKUP, AND THE FIXTURES ARE WHY. A `Map` keyed on the rounded coordinate
 * answers with the FIRST visit, so on any track that crosses its own ground a stored point is
 * attributed to the wrong moment and the distribution it feeds is measured against the wrong tenth.
 * Measured on `linearTrack` itself — which its own comment used to claim never runs over its own
 * ground — 12 coordinates repeat at three hours, worst time skew 1399 s. A thinned route is a
 * SUBSEQUENCE of the track, so a two-pointer walk resolves every point to the visit it actually is
 * and the fixture needs no such property at all.
 */
export function attachTimes(poly: readonly { lat: number; lng: number }[], track: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  let j = 0;
  for (const p of poly) {
    while (j < track.length && !(track[j]!.lat === p.lat && track[j]!.lng === p.lng)) j++;
    if (j >= track.length) {
      // Not a limitation of the walk: a thinned route IS a subsequence of the track, so failing to
      // find a point in order means the route is out of order or carries a point the run never
      // passed through — which is the defect, not the instrument.
      throw new Error("the route is not an in-order subsequence of the run: no later fix matches " +
        JSON.stringify(p));
    }
    out.push({ lat: p.lat, lng: p.lng, t: track[j]!.t });
    j++;
  }
  return out;
}

/* ================================================================================================ *
 * FIXTURES — deliberately hostile, and point-to-point                                               *
 * ================================================================================================ */

/**
 * ⚠️ POINT-TO-POINT ON PURPOSE, ALL OF THEM. A looped route MASKS truncation in any deviation
 * measure, because the missing tail runs over ground the kept prefix already covers — measured, the
 * same three-hour truncation reads 1541 m of mean error on a point-to-point route and 18 m on a
 * circuit. A fixture that flatters the defect certifies a fix that has not been made.
 *
 * Geometry is built in METRES and then projected, so the shapes are exact, and every point is rounded
 * to five decimal places exactly as the append site does.
 */
const MPS = 3.0;

function project(x: number, y: number, t: number): Pt & { x: number; y: number } {
  return {
    lat: Math.round((LAT0 + y / MLAT) * 100000) / 100000,
    lng: Math.round((LNG0 + x / MLNG) * 100000) / 100000,
    t, x, y,
  };
}

/**
 * The exported fixtures hand back PLAIN points.
 *
 * ⚠️ The builders carry x and y in metres because `mixedTrack` has to translate one segment onto the
 * end of another, and a point that also carries them cannot be compared with `deepEqual` against what
 * comes back from the Swift — which is the strongest form of "the thinner invented nothing".
 */
function bare(pts: readonly (Pt & { x: number; y: number })[]): Pt[] {
  return pts.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t }));
}

/** A walk at 3 m/s whose heading is a function of arc length. */
function walk(seconds: number, headingAt: (s: number, t: number) => number) {
  const out: (Pt & { x: number; y: number })[] = [];
  let x = 0, y = 0;
  for (let t = 0; t <= seconds; t++) {
    out.push(project(x, y, t));
    const h = headingAt(t * MPS, t);
    x += Math.cos(h) * MPS;
    y += Math.sin(h) * MPS;
  }
  return out;
}

/**
 * The gentle case: long meandering curves with an occasional near-reversal.
 *
 * ⚠️ THIS IS THE FIXTURE THE FIX WAS FIRST MEASURED ON, AND IT IS THE KIND ONE. Kept unchanged so the
 * numbers in the commit and in CLAUDE.md still refer to something, and never used alone — a layout,
 * or a thinner, verified only on a good case is not verified.
 */
export function linearTrack(seconds: number, mps = 3.0): Pt[] {
  const out: Pt[] = [];
  let x = 0, y = 0, head = 0, s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let t = 0; t <= seconds; t++) {
    out.push({
      lat: Math.round((LAT0 + y / MLAT) * 100000) / 100000,
      lng: Math.round((LNG0 + x / MLNG) * 100000) / 100000,
      t: t,
    });
    let turn = (rnd() - 0.5) * 0.02;
    if (t % 90 === 0) turn += (rnd() - 0.5) * 1.2;
    if (t % 600 === 0 && t > 0) turn += Math.PI * 0.9;
    head += turn;
    x += Math.cos(head) * mps;
    y += Math.sin(head) * mps;
  }
  return out;
}

/**
 * Long straights broken by TIGHT 180-degree hairpins of 6 m radius.
 *
 * The worst case for even thinning: a hairpin apex is a six-fix feature, so a stride of 32 misses
 * whole turns and the line chords straight across them. This is the fixture on which a
 * percentage-of-real-ground bound fails on correct code (58% of the ground at 150 points).
 */
export function hairpinTrack(seconds: number): Pt[] { return bare(hairpinRaw(seconds)); }

function hairpinRaw(seconds: number) {
  const R = 6, LEG = 240;
  const turnLen = Math.PI * R;
  const cycle = LEG + turnLen;
  return walk(seconds, (s) => {
    const n = Math.floor(s / cycle), into = s - n * cycle;
    const base = (n % 2 === 0) ? 0 : Math.PI;
    if (into < LEG) return base;
    const frac = (into - LEG) / turnLen;
    return base + frac * Math.PI * (n % 2 === 0 ? 1 : -1);
  });
}

/**
 * A lemniscate walked repeatedly: it crosses its own ground at the centre on every lap, in both
 * directions. Ambiguous by coordinate — which is why `attachTimes` walks in order — and its two loops
 * mean a back-loaded route still looks plausible drawn on a map.
 */
export function eightTrack(seconds: number): Pt[] { return bare(eightRaw(seconds)); }

function eightRaw(seconds: number) {
  const A = 90;
  const out: (Pt & { x: number; y: number })[] = [];
  let u = 0;
  for (let t = 0; t <= seconds; t++) {
    const d = 1 + Math.sin(u) * Math.sin(u);
    const x = A * Math.cos(u) / d, y = A * Math.sin(u) * Math.cos(u) / d;
    out.push(project(x, y, t));
    const h = 1e-4;
    const d2 = 1 + Math.sin(u + h) * Math.sin(u + h);
    const x2 = A * Math.cos(u + h) / d2, y2 = A * Math.sin(u + h) * Math.cos(u + h) / d2;
    const speed = Math.hypot(x2 - x, y2 - y) / h;
    u += MPS / Math.max(speed, 1e-6);
  }
  return out;
}

/**
 * Hairpins, then a figure-of-eight, then hairpins — fine features at BOTH ends and self-overlap in
 * the middle, so a back-loaded route loses the opening hairpins and a truncated one loses the
 * closing ones. The single nastiest fixture here.
 */
export function mixedTrack(seconds: number): Pt[] {
  const third = Math.floor(seconds / 3);
  const a = hairpinRaw(third);
  const b = eightRaw(third);
  const c = hairpinRaw(seconds - 2 * third);
  const out: (Pt & { x: number; y: number })[] = [...a];
  const off = (seg: (Pt & { x: number; y: number })[], dx: number, dy: number, t0: number) =>
    seg.slice(1).map((p) => project(p.x + dx, p.y + dy, p.t + t0));
  const endA = a[a.length - 1]!;
  out.push(...off(b, endA.x - b[0]!.x, endA.y - b[0]!.y, endA.t));
  const endB = out[out.length - 1]!;
  out.push(...off(c, endB.x - c[0]!.x, endB.y - c[0]!.y, endB.t));
  return bare(out.slice(0, seconds + 1));
}

/** Every fixture, by name, so a sweep is derived rather than listed. */
export const TRACKS: Record<string, (seconds: number) => Pt[]> = {
  linear: (s) => linearTrack(s),
  hairpin: hairpinTrack,
  eight: eightTrack,
  mixed: mixedTrack,
};

/* ================================================================================================ *
 * THE SWIFT                                                                                         *
 * ================================================================================================ */

const SWIFT_CANDIDATES = [
  process.env.SWIFTC || "",
  "/usr/bin/swiftc",
  "/usr/local/bin/swiftc",
  "/opt/homebrew/bin/swiftc",
  "/usr/lib/swift/bin/swiftc",
];

export function findSwiftc(): string | null {
  for (const c of SWIFT_CANDIDATES) if (c && existsSync(c)) return c;
  // Xcode can place the toolchain anywhere; ask it rather than guessing at paths.
  for (const probe of [["xcrun", ["-f", "swiftc"]], ["/usr/bin/which", ["swiftc"]]] as const) {
    try {
      const p = execFileSync(probe[0], [...probe[1]], { encoding: "utf8" }).trim();
      if (p && existsSync(p)) return p;
    } catch (e) { /* not available */ }
  }
  return null;
}

/** Swift with its comments removed — the comments in this area quote the broken code they replaced. */
export function stripSwiftComments(src: string): string {
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

export const workoutManagerSrc = () => stripSwiftComments(
  readFileSync(new URL("../ios/InteRunWatch/WorkoutManager.swift", import.meta.url), "utf8"));

/** A Swift declaration from its signature to the matching close brace, verbatim. */
export function swiftDecl(src: string, signature: string): string {
  const at = src.indexOf(signature);
  if (at < 0) throw new Error("the source no longer contains: " + signature);
  const open = src.indexOf("{", at);
  if (open < 0) throw new Error(signature + " has no body");
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  throw new Error(signature + " is unbalanced");
}

export type WristProbe = {
  bin: string;
  cap: number;
  /** The state declarations lifted verbatim, so their INITIAL values come from the source too. */
  declarations: string[];
  /** `reset()`'s own route lines, verbatim. */
  resetLines: string[];
  swift: string;
};

/**
 * Every identifier a lifted body mentions that the TYPE declares as stored state, so the probe holds
 * exactly the state the shipped code does.
 *
 * ⚠️ DERIVED IN BOTH DIRECTIONS, WHICH IS WHY IT IS NOT A LIST. The original version collected only
 * `route*` names, which was right while the members under test touched nothing else — and
 * `routeSample` then arrived reading `startedAt` and `pausedAccum`, neither of which matches that
 * pattern. A hand-written addition would have gone stale the next time; scanning the lifted text for
 * anything the type stores picks up a field a future member touches by construction, and skips
 * `Date`, `max` and `Self` for free because the type declares no such thing.
 */
function storedStateReferencedBy(src: string, bodies: readonly string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const body of bodies) {
    for (const m of body.matchAll(/\b[a-z][A-Za-z0-9]*\b/g)) {
      const name = m[0];
      if (seen.has(name)) continue;
      seen.add(name);
      const re = new RegExp("^ {4}(?:[\\w()@]+\\s+)*(?:var|let)\\s+" + name + "\\b.*$", "m");
      const d = src.match(re);
      // A computed property is not state, and lifting its body would drag in whatever it reads.
      if (d && !/\{\s*$/.test(d[0])) found.push(d[0].trim());
    }
  }
  return found;
}

/**
 * Lift the shipped route members into a standalone Swift file and compile it.
 *
 * ⚠️ THE DECLARATIONS ARE LIFTED TOO, NOT RETYPED. `private var routeStride = 1` carries the value
 * that decides whether the first minute of a run is recorded at full rate; hand-writing `= 1` in the
 * probe would mask a change to it exactly as a source-text check masks a change to the accessor.
 *
 * ⚠️ AND `reset()`'S ROUTE LINES ARE LIFTED VERBATIM, which is what makes the run-two guard behavioural
 * rather than a presence check — `routeStride = 32` in reset() is still a line matching
 * `/routeStride\s*=/`, and it cost run two of an app session all but nineteen of its points.
 */
export function buildWristProbe(): WristProbe {
  const swiftc = findSwiftc();
  if (!swiftc) {
    throw new Error(
      "THE WRIST'S ROUTE GUARDS NEED A SWIFT COMPILER AND FOUND NONE.\n" +
      "These tests execute the shipped appendRoutePoint / thinRoutePoints / route accessor and measure\n" +
      "the points that come out, because a source-text assertion cannot see the five re-breaks that\n" +
      "escaped it — including a route whose count is right and whose LAST POINT IS MISSING.\n" +
      "Install the Xcode command line tools, or point SWIFTC at an existing swiftc, then re-run.\n" +
      "Tried: " + SWIFT_CANDIDATES.filter(Boolean).join(", ") + ", xcrun -f swiftc, which swiftc");
  }

  const src = workoutManagerSrc();

  const append = swiftDecl(src, "private func appendRoutePoint(_ pt: [Double])");
  const thin = swiftDecl(src, "private func thinRoutePoints()");
  const accessor = swiftDecl(src, "var route: [[Double]] {");
  // ⚠️ THE TIME IS LIFTED TOO, BECAUSE THE PAUSE ATTRIBUTION IS THE WHOLE SUBTLETY OF THE FEATURE.
  // `routeSecondsAt` is static and pure precisely so it can be executed here; `routeSample` is the one
  // builder of a route point, and lifting it is what makes "the fix's own clock, and the pause in
  // force when the fix was taken" a claim about behaviour rather than about source text.
  const seconds = swiftDecl(src, "static func routeSecondsAt(");
  const sample = swiftDecl(src, "private func routeSample(_ loc: CLLocation)");

  // ⚠️ THE STATE IS DERIVED FROM WHAT THE MEMBERS ACTUALLY REFERENCE, NOT FROM A LIST AND NOT FROM
  // EVERY `route*` DECLARATION IN THE TYPE. A hand-written list goes stale the first time a sixth
  // field is added, and the failure is silence — the probe would run without it while the shipped code
  // carried state the probe never had. Deriving from the whole type is wrong in the other direction:
  // `routeBuilder` is HealthKit's own route builder, nothing to do with the point buffer, and lifting
  // it drags HKWorkoutRouteBuilder in. Reading the references makes the set exactly the state under
  // test, and a field a future member touches is picked up by construction.
  const accessorBody = accessor.slice(accessor.indexOf("{"));
  const declarations = storedStateReferencedBy(src, [append, thin, accessorBody, seconds, sample]);
  if (declarations.length < 6) {
    throw new Error("only " + declarations.length + " stored fields were lifted (" +
      declarations.join(" | ") + ") — the extractor is looking at the wrong shape of source");
  }
  for (const want of ["routePoints", "routeStride", "routeTail", "routeLastT", "startedAt", "pausedAccum"]) {
    // Not a permitted-list: these are the fields the CLAIMS below are about, so a probe that quietly
    // stopped holding one would measure less while reading exactly as clean.
    if (!declarations.some((d) => new RegExp("\\b" + want + "\\b").test(d))) {
      throw new Error("the probe would not hold " + want + ", so nothing below measures it");
    }
  }

  // The name each lifted declaration declares, so the reset lines below are found from what the probe
  // actually holds rather than from a second list of names.
  const names = declarations.map((d) => d.match(/(?:var|let)\s+([A-Za-z_]\w*)/)![1]!);
  const capDecl = declarations.find((d) => /\brouteMaxPoints\b/.test(d));
  const capM = capDecl && capDecl.match(/=\s*(\d+)/);
  if (!capM) throw new Error("the wrist no longer names its own route cap");

  const reset = swiftDecl(src, "func reset()");
  const resetLines = reset.split("\n").filter((l) => names.some(
    (n) => new RegExp("^\\s*" + n + "\\s*=").test(l)));
  if (!resetLines.length) {
    throw new Error("reset() sets none of the route fields, so the run-two guard would measure nothing");
  }
  // ⚠️ AND THE RUN-TWO GUARD IS ONLY AS GOOD AS THE LINES IT LIFTS. The time watermark is the one field
  // whose absence from reset() refuses run two's whole route rather than merely thinning it oddly, so
  // its line has to be here or that guard is measuring a strictly easier claim.
  if (!resetLines.some((l) => /\brouteLastT\b/.test(l))) {
    throw new Error("reset() no longer clears routeLastT, and the probe cannot see it from here");
  }

  const indent = (s: string) => s.split("\n").map((l) => "    " + l).join("\n");
  const swift = [
    "// GENERATED from the shipped ios/InteRunWatch/WorkoutManager.swift by",
    "// test/watch-route-harness.ts. Every member below is verbatim. Do not edit.",
    "import Foundation",
    "",
    "// The two CoreLocation types routeSample names, and nothing else about CoreLocation. A fix is a",
    "// coordinate and the clock reading it was taken at; the shipped builder is lifted VERBATIM onto",
    "// these, so the rounding and the pause attribution under test are the shipped ones.",
    "struct CLLocationCoordinate2D { var latitude: Double; var longitude: Double }",
    "struct CLLocation { var coordinate: CLLocationCoordinate2D; var timestamp: Date }",
    "",
    "final class Probe {",
    declarations.map((d) => "    " + d).join("\n"),
    "",
    indent(seconds),
    "",
    indent(sample),
    "",
    indent(append),
    "",
    indent(thin),
    "",
    indent(accessor),
    "",
    "    // reset()'s own route lines, verbatim:",
    "    func resetRoute() {",
    resetLines.join("\n"),
    "    }",
    "",
    "    func feed(_ p: [Double]) { appendRoutePoint(p) }",
    "    // The whole pipeline: a fix at a wall-clock instant, through the shipped builder and the",
    "    // shipped gate. 'started' and the pause total are the probe's own lifted fields.",
    "    func feedFix(_ lat: Double, _ lng: Double, _ whenEpoch: Double) {",
    "        appendRoutePoint(routeSample(CLLocation(",
    "            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng),",
    "            timestamp: Date(timeIntervalSince1970: whenEpoch))))",
    "    }",
    "    func beginAt(_ epoch: Double) { startedAt = Date(timeIntervalSince1970: epoch) }",
    "    func addPause(_ seconds: Double) { pausedAccum += seconds }",
    "    func secondsAt(_ whenEpoch: Double) -> Double {",
    "        return Self.routeSecondsAt(Date(timeIntervalSince1970: whenEpoch),",
    "                                   started: startedAt, pausedSoFar: pausedAccum)",
    "    }",
    "    var strideNow: Int { routeStride }",
    "    var bufferNow: Int { routePoints.count }",
    "    var tailNow: Bool { routeTail != nil }",
    "}",
    "",
    "// stdin: one command per line. 'P lat lng t' feeds a credited fix with the time supplied directly;",
    "// 'PAIR lat lng' feeds a two-element point, which the buffer must refuse;",
    "// 'START epoch' sets when the run began; 'PAUSE secs' banks paused time; 'L lat lng epoch' feeds a",
    "// fix through the shipped routeSample so its time is COMPUTED; 'S epoch' prints just the computed",
    "// seconds; 'RESET' calls reset()'s own route lines; 'MARK label' emits the route as the app would",
    "// read it. EOF marks implicitly as 'end'.",
    "let text = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? \"\"",
    "let p = Probe()",
    "var fed = 0",
    "func mark(_ label: String) {",
    "    let r = p.route",
    "    print(\"SEG \" + label + \" \" + String(r.count) + \" \" + String(fed) + \" \"",
    "          + String(p.bufferNow) + \" \" + String(p.strideNow) + \" \" + String(p.tailNow))",
    "    for pt in r { print(String(pt[0]) + \" \" + String(pt[1]) + \" \" + String(pt[2])) }",
    "}",
    "for line in text.split(separator: \"\\n\") {",
    "    let f = line.split(separator: \" \")",
    "    guard let head = f.first else { continue }",
    "    if head == \"RESET\" { p.resetRoute(); fed = 0; continue }",
    "    if head == \"MARK\" { mark(f.count > 1 ? String(f[1]) : \"?\"); continue }",
    "    if head == \"START\", f.count >= 2, let e = Double(f[1]) { p.beginAt(e); continue }",
    "    if head == \"PAUSE\", f.count >= 2, let s = Double(f[1]) { p.addPause(s); continue }",
    "    if head == \"S\", f.count >= 2, let e = Double(f[1]) { print(\"SEC \" + String(p.secondsAt(e))); continue }",
    // ⚠️ A SEPARATE COMMAND, BECAUSE 'P' REQUIRES FOUR FIELDS AND THAT MADE A GUARD VACUOUS. The
    // untimed-point re-break (accept a bare pair) ESCAPED: the test fed "P 51.5 -0.12", the parser's
    // own `f.count >= 4` skipped the line, and appendRoutePoint never saw it. The probe was filtering
    // out the very input under test. This one hands the buffer a two-element array on purpose.
    "    if head == \"PAIR\", f.count >= 3, let a = Double(f[1]), let b = Double(f[2]) {",
    "        p.feed([a, b]); fed += 1; continue",
    "    }",
    "    if head == \"L\", f.count >= 4, let a = Double(f[1]), let b = Double(f[2]), let e = Double(f[3]) {",
    "        p.feedFix(a, b, e); fed += 1; continue",
    "    }",
    "    guard f.count >= 4, let a = Double(f[1]), let b = Double(f[2]), let c = Double(f[3])",
    "    else { continue }",
    "    p.feed([a, b, c])",
    "    fed += 1",
    "}",
    "mark(\"end\")",
    "",
  ].join("\n");

  const hash = createHash("sha256").update(swift).digest("hex").slice(0, 16);
  const dir = tmpdir() + "/interun-wrist-probe";
  mkdirSync(dir, { recursive: true });
  const bin = dir + "/probe-" + hash;
  if (!existsSync(bin)) {
    const file = dir + "/probe-" + hash + ".swift";
    writeFileSync(file, swift);
    try {
      execFileSync(swiftc, ["-O", "-o", bin, file], { encoding: "utf8", stdio: "pipe" });
    } catch (e: any) {
      throw new Error("the lifted Swift did not compile, so nothing below is measuring the shipped " +
        "code:\n" + String(e.stderr || e.message).slice(0, 2000) + "\nprobe source: " + file);
    }
  }
  return { bin, cap: Number(capM[1]), declarations, resetLines, swift };
}

export type Segment = {
  label: string;
  route: Pt[];
  fed: number;
  buffer: number;
  stride: number;
  tail: boolean;
};

export type ProbeRun = {
  segments: Segment[];
  /** One entry per 'S epoch' command, in order: the shipped routeSecondsAt's own answer. */
  seconds: number[];
};

/** Feed a script of commands through the compiled probe and parse every marked segment back. */
export function runWristProbe(probe: WristProbe, script: readonly string[]): Segment[] {
  return runWristProbeFull(probe, script).segments;
}

export function runWristProbeFull(probe: WristProbe, script: readonly string[]): ProbeRun {
  const out = execFileSync(probe.bin, [], {
    input: script.join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 28,
  });
  const segs: Segment[] = [];
  const seconds: number[] = [];
  // ⚠️ EVERY SEGMENT'S DECLARED COUNT IS CHECKED AGAINST THE LINES THAT FOLLOW IT. A parse that
  // silently loses points would make each guard below measure a shorter route than the Swift produced,
  // which is the same defect as the one being hunted, arriving from the instrument instead.
  const want: number[] = [];
  let cur: Segment | null = null;
  for (const line of out.split("\n")) {
    if (!line) continue;
    if (line.startsWith("SEC ")) { seconds.push(Number(line.slice(4))); continue; }
    if (line.startsWith("SEG ")) {
      const f = line.split(" ");
      cur = {
        label: f[1]!, route: [], fed: Number(f[3]), buffer: Number(f[4]),
        stride: Number(f[5]), tail: f[6] === "true",
      };
      want.push(Number(f[2]));
      segs.push(cur);
      continue;
    }
    if (!cur) throw new Error("the probe emitted points before any segment header: " + line);
    const [lat, lng, t] = line.split(" ").map(Number);
    cur.route.push({ lat: lat!, lng: lng!, t: t! });
  }
  segs.forEach((s, i) => {
    if (s.route.length !== want[i]) {
      throw new Error("the probe's segment " + s.label + " declared " + want[i] +
        " points and emitted " + s.route.length);
    }
  });
  return { segments: segs, seconds: seconds };
}

/** Feed one whole track and hand back the route the wrist would send home. */
export function wristRoute(probe: WristProbe, track: readonly Pt[]): Segment {
  const segs = runWristProbe(probe, track.map((p) => "P " + p.lat + " " + p.lng + " " + p.t));
  return segs[segs.length - 1]!;
}

/** A fix as CoreLocation delivers one: where, and the WALL-CLOCK instant it was taken. */
export type TimedFix = { lat: number; lng: number; at: number };

/**
 * Drive a run whose route times are COMPUTED by the shipped code, through real pauses.
 *
 * ⚠️ THE ORDERING IS THE REAL ONE. `pausedAccum` is added to at the RESUME, so a leg's fixes are
 * processed against the pause total banked by every pause before it — which is exactly why a fix
 * stamped INSIDE a pause and delivered after the resume computes a time earlier than the point before
 * it. Putting such a fix in the leg after a pause is how that case is expressed here.
 */
export function wristTimedRoute(
  probe: WristProbe,
  startEpoch: number,
  legs: readonly { fixes: readonly TimedFix[]; pauseAfterSec?: number }[],
): Segment {
  const script = ["START " + startEpoch];
  for (const leg of legs) {
    for (const f of leg.fixes) script.push("L " + f.lat + " " + f.lng + " " + f.at);
    if (leg.pauseAfterSec) script.push("PAUSE " + leg.pauseAfterSec);
  }
  const segs = runWristProbe(probe, script);
  return segs[segs.length - 1]!;
}
