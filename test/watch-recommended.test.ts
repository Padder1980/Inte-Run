/**
 * THE WATCH IS THE RECOMMENDED RECORDER NOW — AND FIVE THINGS ON THE PHONE HAD TO BE TRUE FIRST.
 *
 * The owner field-tested the over-the-air build in Rhodes and reversed a documented architecture
 * ruling on the strength of it: "Tracking when choosing to record the session on the apple watch is
 * really accurate (I want this to be the recommended option, not the phone)." Moving the badge is one
 * word. What made it safe to move is everything else in this file, because each of these was a lie the
 * runner only meets once the watch is the default:
 *
 *   1. the debrief called EVERY wrist run "This iPhone" — run.watch was read once and written nowhere
 *   2. cadence was permanently blank on wrist runs, so the recommended recorder lost a metric
 *   3. the start sheet's own copy sold the phone harder than the badge recommended it
 *   4. the wrist showed three numbers during a phone-recorded run and offered no controls at all
 *   5. the count-in's four beats had no name the page knew, so a rebuilt watch would have been silent
 *
 * ⚠️ EVERY GUARD HERE DRIVES A READER OR DERIVES ITS LIST FROM SOURCE. A source-text assertion proves
 * a string exists and never that anything reaches it; three re-breaks escaped exactly that in this
 * repository last week. Where a name list is needed it is derived — from the app's own save paths, from
 * the Swift that sends the message, or from the shipped audio manifest — so it cannot go stale in the
 * one direction that matters, which is the source growing while the guard stops looking.
 *
 * Run `node web/app.ts` first: this file reads the BUILT page, because these are web-layer functions
 * and the precedent for lifting them is test/warmup-delivery.test.ts and test/heat-custom.test.ts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const WATCH_DIR = fileURLToPath(new URL("../ios/InteRunWatch/", import.meta.url));
const BRIDGE = fileURLToPath(new URL("../ios/InteRun/WatchBridge.swift", import.meta.url));
const MANIFEST = fileURLToPath(new URL("../docs/voices/manifest.json", import.meta.url));

/** The app's own script block — not the minified engine, which shares one-letter names with nothing. */
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function pushToCompanion(");
  assert.ok(marker >= 0, "pushToCompanion is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  return html.slice(open + 8, close);
}
const SRC = appScript();

function fnBody(name: string): string {
  const at = SRC.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not a top-level function in the build: " + name);
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
/** A `window.<name> = function (...) {...};` statement, lifted whole. */
function winFn(name: string): string {
  const at = SRC.indexOf("window." + name + " = function");
  assert.ok(at >= 0, "not a window function in the build: " + name);
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1) + ";"; }
  }
  throw new Error("unbalanced braces in window." + name);
}
function constStmt(name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
/**
 * ⚠️ COMMENTS MUST COME OFF BEFORE ANY SWEEP, AND BOTH DIRECTIONS BITE. The comments in this area
 * deliberately quote the broken code they replaced — "it was run.watch", "it was LIVE.paused",
 * "it was for k in [sec, distKm, paceSec]" — so a guard reading the raw text matches the explanation
 * whatever the code says. That is the fifth-plus firing of the trap in this repository, and rewording
 * the code's own explanation is not the remedy; stripping the comments from the scope is.
 */
const decomment = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
const CODE = decomment(SRC);
/**
 * Top-level keys of the object literal that follows `marker`, in order.
 *
 * ⚠️ THE MARKER IS NOT OPTIONAL, AND LEAVING IT OUT WAS MY OWN FIRST BUG HERE. Asked for "the first
 * literal in this chunk" of a function body, the first brace it finds is the FUNCTION'S OWN — so every
 * key of the real literal sits a level deeper than the sweep looks and the answer comes back empty,
 * which reads as "the save path stores nothing" rather than as a broken ruler.
 */
function literalKeys(chunk: string, marker: string): string[] {
  const at = chunk.indexOf(marker);
  assert.ok(at >= 0, "marker not found: " + marker);
  const start = chunk.indexOf("{", at);
  assert.ok(start >= 0, "no object literal after " + marker);
  const out: string[] = [];
  let d = 0;
  for (let i = start; i < chunk.length; i++) {
    const c = chunk[i]!;
    if (c === "{" || c === "[" || c === "(") d++;
    else if (c === "}" || c === "]" || c === ")") { d--; if (!d) break; }
    else if (d === 1) {
      const m = /^[\s,]([A-Za-z_$][\w$]*)\s*:/.exec(chunk.slice(i - 1, i + 40));
      if (m) out.push(m[1]!);
    }
  }
  assert.ok(out.length, "no keys parsed out of the literal after " + marker);
  return [...new Set(out)];
}
/** The expression a key is assigned in a literal, so it can be evaluated rather than read. */
function keyExpr(chunk: string, key: string): string {
  const re = new RegExp("(?:^|[\\s,{])" + key + ":\\s*");
  const m = re.exec(chunk);
  assert.ok(m, "key not found in the literal: " + key);
  const from = m.index + m[0].length;
  let d = 0;
  for (let i = from; i < chunk.length; i++) {
    const c = chunk[i]!;
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") { if (d === 0) return chunk.slice(from, i).trim(); d--; }
    else if (c === "," && d === 0) return chunk.slice(from, i).trim();
  }
  throw new Error("unterminated expression for " + key);
}
const swift = (f: string) => readFileSync(WATCH_DIR + f, "utf8");
/** Swift with its // comments gone, for the same reason CODE exists. */
const swiftCode = (f: string) => swift(f).replace(/(^|[^:"\\])\/\/[^\n]*/g, "$1 ");

/* ------------------------------------------------------------------------------------------------ *
 * 1. PROVENANCE — the debrief called every wrist run "This iPhone"                                 *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a run saved by the wrist reports the wrist, and one saved here reports here", () => {
  // ⚠️ DRIVEN, NOT GREPPED. The old code was `run.watch ? "Apple Watch" : "This iPhone"` and run.watch
  // appeared exactly once in the whole file — here — and was written by nothing, so the row was right
  // about the simulator and wrong about every watch run there has ever been. A guard looking for the
  // string "Apple Watch" passes on both versions; only calling the reader can tell them apart.
  const api = new Function("esc", "ICON", "PRIVACY", "runShoeChoice", "loadShoes", "runNoteHtml",
    fnBody("rdMetaHtml") + "\nreturn rdMetaHtml;")(
    (s: string) => s, { rEasy: "", phone: "", person: "", chevDown: "" }, { map: false, ends: false },
    () => null, () => [], () => "");
  const src = (h: string) => {
    const m = /Source<\/span><span class="rd-meta-v">([^<]*)</.exec(h);
    assert.ok(m, "the Source row is not in the Details block: " + h.slice(0, 200));
    return m[1]!;
  };
  // The value the wrist's own ingest actually writes, taken from that function rather than typed here.
  const written = keyExpr(fnBody("ingestWatchRun"), "source");
  assert.equal(written, '"watch"', "ingestWatchRun no longer writes source: \"watch\"");
  assert.equal(src(api({ source: JSON.parse(written) })), "Apple Watch",
    "a run ingested from the wrist is still labelled as the phone");
  assert.equal(src(api({})), "This iPhone", "a phone run stopped saying so");
  assert.equal(src(api({ sim: true })), "Simulated", "a simulated run stopped saying so");
  // ⚠️ AND THE SIMULATOR STILL WINS OVER THE WRIST. A sim run is stamped by the phone's own path, so
  // the two flags cannot both be set — but if they ever are, "Simulated" is the honest answer and the
  // ordering is what delivers it.
  assert.equal(src(api({ sim: true, source: "watch" })), "Simulated",
    "a simulated run is being credited to the watch");
});

test("BLOCKER: every field the app reads off a run is written by a save path or a run mutator", () => {
  // ⚠️ THIS IS THE CLASS, NOT THE CASE. run.watch survived because nothing ever asked whether anything
  // wrote it — the same trap as #saveSetup, CLASS, MASTERS, PLAN.notes and #typePreview. Sweeping for
  // siblings found a SECOND one, run.indoor: read by the debrief's empty-route panel and by the share
  // card's route eligibility, written by no save path, so a treadmill run's debrief said "No route
  // recorded" where it meant "Indoor session".
  //
  // ⚠️ THE WRITER SET IS DERIVED FROM THE TWO SAVE PATHS PLUS THE `run.X =` MUTATORS, never listed.
  // A hand-written field list is exactly what let the two invented identifiers survive. The mutators
  // are real and there are four of them (place, placeTried, shoeId, strava) — the reverse-geocode, the
  // shoe rack and the Strava upload all write onto a stored run after it is saved.
  //
  // ⚠️ AND IT SWEEPS FIELDS LONGER THAN ONE CHARACTER, WHICH IS A DERIVED SCOPE RATHER THAN AN
  // EXEMPTION LIST. The uncapped history store's rows are `{i,d,k,s,t,e}` — every key a single letter
  // by design, to keep sixty bytes a run — and several of its readers name their parameter `run` too.
  // Single letters are therefore a different record's schema, and the run record's own single-letter
  // fields (t, d) are in both save literals anyway, so the scope costs nothing.
  const phone = new Set(literalKeys(fnBody("liveRunRecord"), "return"));
  const wrist = new Set(literalKeys(fnBody("ingestWatchRun"), "state.logged.unshift("));
  assert.ok(phone.has("distKm") && phone.has("pband"), "liveRunRecord's literal was not parsed");
  assert.ok(wrist.has("distKm") && wrist.has("source"), "ingestWatchRun's literal was not parsed");
  const mutators = new Set([...CODE.matchAll(/\brun\.([A-Za-z_$][\w$]*)\s*=[^=]/g)].map((m) => m[1]!));
  assert.ok(mutators.size >= 3, "the mutator sweep found almost nothing: " + [...mutators]);
  // ⚠️ THE WRITERS' OWN BODIES ARE EXCLUDED FROM THE READ SCAN, and this is derived from the same pair
  // the writer set comes from rather than being an exemption. ingestWatchRun's parameter is called
  // `run` too — but it is the WIRE PAYLOAD from the wrist, a different shape: it carries `title`, which
  // the record stores as `t`, so counting its reads reported the record as missing a field it has never
  // had. Same conflation the single-letter scope rule handles for the history store's rows.
  const scan = [fnBody("liveRunRecord"), fnBody("ingestWatchRun")]
    .reduce((s, w) => s.split(decomment(w)).join("\n"), CODE);
  assert.ok(scan.length < CODE.length, "the writers' bodies were not removed from the read scan");
  const reads = [...new Set([...scan.matchAll(/\brun\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]!))]
    .filter((f) => f.length > 1);
  assert.ok(reads.length >= 30, "the read sweep found only " + reads.length + " fields");
  const orphans = reads.filter((f) => !phone.has(f) && !wrist.has(f) && !mutators.has(f));
  assert.deepEqual(orphans, [],
    "read off a run and written by nothing: " + orphans.join(", ") +
    " — either write it in a save path or stop reading it");
  // The two fields this guard was written for, named so a future reader can see it discriminates.
  assert.ok(wrist.has("source"), "the wrist's save path no longer records where the run came from");
  assert.ok(phone.has("indoor"), "the phone's save path no longer records that a run was indoors");
});

test("BLOCKER: indoor is recorded for a treadmill and refused for a run whose GPS failed", () => {
  // ⚠️ LIVE.indoor IS TRUE FOR BOTH, AND THAT IS WHY THE RAW FLAG CANNOT BE STORED. gpsFallback sets
  // it on an OUTDOOR run whose GPS never arrived, because the indoor runtime is the only one that
  // records a real clock without inventing distance — and its own comment says in as many words: mark
  // it as a failed outdoor run, NOT as a treadmill. Storing LIVE.indoor would put "Indoor session" on
  // a run somebody did outside and ask them for a distance off a machine they never touched.
  const expr = keyExpr(fnBody("liveRunRecord"), "indoor");
  const run = new Function("LIVE", "return (" + expr + ");");
  assert.equal(run({ indoor: true }), true, "a treadmill run is no longer recorded as indoors");
  assert.equal(run({ indoor: true, gpsDenied: true }), undefined,
    "an OUTDOOR run whose GPS failed is being recorded as a treadmill session");
  assert.equal(run({}), undefined, "an ordinary GPS run is being recorded as indoors");
  // ⚠️ undefined, NEVER false, like sim beside it: absent is what every run recorded before today is.
  assert.notEqual(run({}), false, "a false is being stored where the field should simply be absent");
});

/* ------------------------------------------------------------------------------------------------ *
 * 2. CADENCE — blank on every wrist run, on the recorder that is now recommended                   *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: both save paths record cadence, and neither can store a zero", () => {
  // ⚠️ null, NEVER 0. Every run in an existing store has no cadence at all, and a stored zero renders
  // as a measurement of somebody standing still — the debrief's tile appears on truthiness. The phone
  // path has always stated that rule; the wrist path had no cadence field to state it about.
  for (const [where, body] of [["the phone", fnBody("liveRunRecord")],
                               ["the wrist", fnBody("ingestWatchRun")]] as const) {
    const expr = keyExpr(body, "cadence");
    const src = where === "the phone" ? "LIVE" : "run";
    const f = new Function(src, "return (" + expr + ");");
    const live = (v: unknown) => where === "the phone"
      ? f({ cadN: v ? 1 : 0, cadSum: v || 0 }) : f({ cadence: v });
    assert.equal(live(0), null, where + " stores a cadence of zero as a measurement");
    assert.equal(live(undefined), null, where + " stores an absent cadence as something other than null");
    assert.equal(live(182.4), 182, where + " does not round a measured cadence: " + live(182.4));
  }
  // And the wrist really sends one, from its own accumulator rather than the phone's pedometer.
  const wm = swiftCode("WorkoutManager.swift");
  assert.match(wm, /out\["cadence"\]/, "the wrist's summary payload carries no cadence");
  assert.match(wm, /var avgCadence: Double\?/, "the wrist has no average cadence to send");
});

/* ------------------------------------------------------------------------------------------------ *
 * 3. THE START SHEET — the badge, and the copy that argued the other way                           *
 * ------------------------------------------------------------------------------------------------ */

function startSheet(watchThere = true): { watch: string; phone: string; treadmill: string } {
  const html = new Function("ICON", "esc", "NATIVE_WATCH", "WATCH_STATUS", "watchAvailable",
    fnBody("startWhereHtml") + "\nreturn startWhereHtml(null);")(
    { watch: "", phone: "", treadmill: "" }, (s: string) => s, true,
    { paired: watchThere, installed: watchThere }, () => watchThere);
  // Each row is one <button data-startwhere="…">…</button>; slice on the attribute so a claim about
  // "the watch row" is a claim about that row and not about the sheet.
  const out: Record<string, string> = { watch: "", phone: "", treadmill: "" };
  for (const id of ["watch", "phone", "treadmill"]) {
    const at = html.indexOf('data-startwhere="' + id + '"');
    if (at < 0) continue;
    const end = html.indexOf("</button>", at);
    out[id] = html.slice(at, end < 0 ? html.length : end);
  }
  return out as { watch: string; phone: string; treadmill: string };
}

test("BLOCKER: the recommended badge is on the watch row, and on nothing else", () => {
  // ⚠️ THE OWNER'S REVERSAL OF 2026-08-21, against his own ruling of 2026-07-29. The badge is the one
  // place the recommendation is expressed, and it was on "This iPhone".
  const r = startSheet(true);
  assert.ok(r.watch, "the watch row is not rendered when a watch is available");
  assert.match(r.watch, /sw-badge">recommended</, "the watch row carries no recommended badge");
  assert.doesNotMatch(r.phone, /sw-badge/, "the phone row still claims to be the recommendation");
  assert.doesNotMatch(r.treadmill, /sw-badge/, "the treadmill row carries a badge");
  // Exactly one, so a second cannot be added without a decision.
  const badges = [r.watch, r.phone, r.treadmill].join("").match(/sw-badge/g) || [];
  assert.equal(badges.length, 1, "the sheet recommends " + badges.length + " of its three options");
});

test("BLOCKER: the watch row states what recording on the wrist costs, and the phone row stops selling", () => {
  // ⚠️ THE BADGE WAS NEVER THE STRONGEST SIGNAL — THE COPY WAS. The phone row read "GPS, pace, route
  // and your coach here", i.e. it sold itself as the richer option, so moving a nine-pixel badge and
  // leaving that sentence would recommend one thing in a chip and the other in a sentence.
  //
  // ⚠️ AND THE WATCH ROW'S OLD PROMISE HID A REAL COST. "your phone can stay at home" bought the
  // synthesised voice for the whole run: the recorded coaches only exist on the phone and speakOnPhone
  // requires WCSession.isReachable. A recommendation that hides what it costs is not one.
  const r = startSheet(true);
  assert.match(r.watch, /coach/i, "the watch row does not mention the coach at all");
  assert.match(r.watch, /out of range/i,
    "the watch row does not say what happens when the phone is not there: " + r.watch);
  assert.doesNotMatch(r.watch, /can stay at home/i,
    "the watch row still promises the phone can stay at home with no caveat");
  assert.doesNotMatch(r.phone, /coach/i,
    "the phone row still sells the coach as a reason to record here: " + r.phone);
  // The row without a watch is untouched — it is the only recorder, and it says so.
  const solo = startSheet(false);
  assert.doesNotMatch(solo.phone, /sw-badge/, "with no watch the phone row recommends itself again");
  assert.match(solo.phone, /Keep the phone with you/, "the no-watch copy changed: " + solo.phone);
});

test("the comment at the phone branch records the reversal rather than the old ruling", () => {
  // ⚠️ A CODE COMMENT THAT STATES A SUPERSEDED RULING AS SETTLED ARCHITECTURE IS HOW A COLD SESSION
  // CHANGES IT BACK. This one asserted the 2026-07-29 ruling ("the phone records, the watch supports")
  // as the owner's stated architecture, with the watch described as a deliberate opt-in — and CLAUDE.md
  // said the same. Both are reversed. The reasoning survives, because this branch IS still the
  // phone-records path; the conclusion is inverted.
  //
  // ⚠️ ASSERTED ON WHAT THE COMMENT NOW SAYS, NOT ON THE ABSENCE OF THE OLD SENTENCE, AND THAT IS NOT
  // laziness — the new comment deliberately QUOTES the sentence it replaced, so a cold reader can see
  // what changed, and an absence check cannot tell a quotation from an assertion. Same trap as the
  // guards that tripped on their own explanatory comments; the remedy there was to strip comments from
  // the scope, and here the comment IS the scope, so the claim has to be positive.
  const wire = fnBody("wireStartWhere");
  assert.match(wire, /REVERSED IT/, "the comment does not record that the ruling was reversed");
  assert.match(wire, /2026-08-21/, "the comment does not date the reversal");
  assert.match(wire, /EXACTLY ONE RECORDER/,
    "the one invariant that did NOT change has been dropped from the comment");
});

/* ------------------------------------------------------------------------------------------------ *
 * 4. THE COMPANION — three numbers, no controls                                                    *
 * ------------------------------------------------------------------------------------------------ */

/** Drive the real pushToCompanion and capture the message it posts. */
function companionTick(opts: { snap?: any; live?: any } = {}): any {
  const sent: any[] = [];
  const win = { webkit: { messageHandlers: { interunWatch: { postMessage: (m: any) => sent.push(m) } } } };
  const snap = Object.assign({
    elapsedSeconds: 1386, currentPaceSecPerKm: 512, averagePaceSecPerKm: 677,
    lapPaceSecPerKm: 690, stepProgress: 0.42, status: "active",
    step: { label: "Moderate — quicker than easy, still comfortable", index: 0, total: 1 },
  }, opts.snap || {});
  const LIVE = Object.assign({ dist: 2050, kmDone: 2, watchHr: 119, mode: "gps",
    session: { title: "2 km easy run (custom)", type: "easy" } }, opts.live || {});
  new Function("window", "LIVE", "NATIVE_WATCH", "Math",
    fnBody("livePausedNow") + "\n" + fnBody("pushToCompanion") + "\npushToCompanion(" + JSON.stringify(snap) + ");")(
    win, LIVE, true, Math);
  assert.equal(sent.length, 1, "pushToCompanion posted " + sent.length + " messages");
  return sent[0];
}

test("BLOCKER: the companion tick carries every number the wrist can show", () => {
  // ⚠️ IT SENT THREE. A wrist-RECORDED run offers nine metrics the runner picks and orders; a
  // phone-recorded run gave the wrist sec, distKm and paceSec — and the owner photographed his Ultra
  // showing TIME, DISTANCE and a third row cut off. Everything added was already computed one function
  // above, for the lock-screen card.
  const m = companionTick();
  assert.equal(m.action, "companionTick", "the message is no longer a companion tick");
  assert.equal(m.sec, 1386, "elapsed seconds");
  assert.equal(m.distKm, 2.05, "distance");
  assert.equal(m.paceSec, 512, "current pace");
  assert.equal(m.avgPaceSec, 677, "AVERAGE pace — one of the two the owner's screenshot showed as a dash");
  assert.equal(m.lapPaceSec, 690, "LAP pace — the other one");
  assert.equal(m.lapNumber, 3, "the lap in progress (2 whole kilometres banked, so lap 3)");
  assert.equal(m.hr, 119, "heart rate");
  assert.equal(m.stepProgress, 0.42, "how far through the step");
  assert.equal(m.step, "Moderate — quicker than easy, still comfortable", "the step's own label");
  assert.equal(m.paused, false, "the paused flag");
  assert.equal(m.control, true, "the capability flag that puts controls on the wrist");
  // ⚠️ AND NO CALORIES. The phone measures none of its own — run.kcal has exactly one writer and it is
  // the wrist's ingest — so sending 0 would put "0 CAL" on the wrist where "--" is the truth.
  assert.ok(!("kcal" in m), "the phone is sending a calorie figure it does not measure");
});

test("BLOCKER: paused comes from the runtime's own status, and LIVE.paused is gone", () => {
  // ⚠️ LIVE.paused WAS READ ONCE, BY THE LOCK-SCREEN CARD, AND WRITTEN NOWHERE — so the Live Activity
  // has said "running" through every pause it has ever seen. Third invented identifier in this area,
  // and the one with teeth: the wrist now PREFERS the phone's flag over its own seconds-not-advancing
  // inference, so forwarding it would have replaced a working inference with a constant false.
  assert.doesNotMatch(CODE, /LIVE\.paused\b/,
    "LIVE.paused is being read again — it is written nowhere and is always false");
  const paused = companionTick({ snap: { status: "paused" } });
  assert.equal(paused.paused, true, "a paused run is reported to the wrist as running");
  assert.equal(companionTick({ snap: { status: "active" } }).paused, false, "an active run reads as paused");
  // The lock-screen card reads the same definition, so the two surfaces cannot disagree.
  const act = decomment(fnBody("pushLiveActivity"));
  assert.match(act, /paused:\s*livePausedNow\(/,
    "the lock-screen card has its own idea of whether the run is paused");
});

test("BLOCKER: every key the page sends is forwarded by the bridge and read on the wrist", () => {
  // ⚠️ THE OTA/NATIVE ASYMMETRY, IN THE DIRECTION THAT WASTES WORK RATHER THAN BREAKING THINGS. The
  // bridge used to cherry-pick three keys by name, so a field added on the page could not travel
  // without a Swift edit and an Xcode build — and the reverse is just as bad: a key that crosses two
  // process boundaries to be discarded is an unread value, which is what the next reader copies.
  const bridge = readFileSync(BRIDGE, "utf8").replace(/(^|[^:"\\])\/\/[^\n]*/g, "$1 ");
  const tick = bridge.slice(bridge.indexOf('case "companionTick"'), bridge.indexOf('case "endCompanion"'));
  assert.ok(tick.length > 100, "the companionTick case could not be bounded in WatchBridge");
  const forwarded = new Set<string>([
    ...[...tick.matchAll(/"([A-Za-z_$][\w$]*)"/g)].map((m) => m[1]!),
  ]);
  assert.ok(forwarded.has("sec") && forwarded.has("hr"), "the forward list was not parsed: " + [...forwarded]);
  // ⚠️ "READ ON THE WRIST" MEANS A NAMED READER, AND THIS USED TO MEAN THE WORD APPEARING ANYWHERE
  // IN FOUR FILES. That is loose enough to be satisfied by an unrelated coincidence — `"type"` is a
  // field name on PlannedSession and appears in three of them — so the check would have passed for
  // the one key nothing on the wrist can see. A reader is a subscript into the live dictionary or the
  // `flag(…)` helper the two booleans go through; `SessionStore` reduces `phoneLive` with
  // `compactMapValues { $0 as? Double }`, so anything else is dropped on arrival whatever the source
  // happens to mention.
  const readerScope = swiftCode("CompanionView.swift") + "\n" + swiftCode("SessionStore.swift");
  const isRead = (k: string) =>
    new RegExp('(?:live|nums|phoneLive\\??)\\[\\s*"' + k + '"\\s*\\]').test(readerScope) ||
    new RegExp('flag\\(\\s*"' + k + '"\\s*\\)').test(readerScope);
  assert.ok(isRead("distKm") && isRead("paused") && !isRead("type"),
    "the reader predicate is not discriminating, so this guard cannot fail");
  const sent = literalKeys(decomment(fnBody("pushToCompanion")), "postMessage(").filter((k) => k !== "action");
  assert.ok(sent.length >= 10, "only " + sent.length + " keys are sent: " + sent);
  for (const k of sent) {
    assert.ok(forwarded.has(k), "the page sends " + k + " and WatchBridge drops it silently");
    assert.ok(isRead(k), "the page sends " + k + " and nothing on the wrist reads it");
  }
});

test("BLOCKER: the wrist's controls reach the phone's own pause and finish, through one definition", () => {
  // ⚠️ THE COMMANDS EXISTED IN ONE DIRECTION ONLY. The phone has been able to pause and finish a WRIST
  // run for months; a runner recording on their phone had a watch on their wrist with no controls at
  // all. And the pause body was inline in the button's click handler, so wiring the wrist to a copy of
  // it is the fix-one-builder-not-the-other trap this project has paid for four times.
  const calls: string[] = [];
  const rt = {
    status: "active",
    getStatus() { return this.status; },
    pause() { calls.push("rt.pause"); this.status = "paused"; return []; },
    resume() { calls.push("rt.resume"); this.status = "active"; return []; },
    snapshot() { return { status: this.status }; },
  };
  const LIVE: any = { rt, mode: "gps", pausedMs: 0, pauseStart: 0, done: false, ui: 1, win: [] };
  const api = new Function("LIVE", "liveNowMs", "liveCue", "stopLive", "coachNativePost",
    "coachNativeSchedule", "gpsUiTick", "startLoop", "haptic", "pushLiveActivity", "renderLiveNow",
    "renderUnlessTyping", "liveFinish", "setInterval", "Date", "window",
    fnBody("livePauseSet") + "\n" + winFn("__interunWatchControl") +
    "\nreturn { set: livePauseSet, cmd: window.__interunWatchControl };")(
    LIVE, () => 1000, () => {}, () => calls.push("stopLive"), () => calls.push("clearSchedule"),
    () => calls.push("schedule"), () => {}, () => calls.push("startLoop"),
    (k: string) => calls.push("haptic:" + k), () => calls.push("push"), () => calls.push("render"),
    () => calls.push("render2"), (c: boolean) => calls.push("liveFinish:" + c), () => 9, Date, {});

  api.cmd("pause");
  assert.equal(rt.status, "paused", "the wrist's Pause did not pause the phone's run");
  assert.ok(calls.includes("push"), "the new state was not pushed back, so the wrist's label lags");
  calls.length = 0;
  api.cmd("pause");
  assert.equal(calls.length, 0, "a Pause for a run already paused did something");
  api.cmd("resume");
  assert.equal(rt.status, "active", "the wrist's Resume did not resume the phone's run");
  calls.length = 0;
  api.cmd("nonsense");
  assert.equal(calls.length, 0, "an unknown command from the wrist was acted on");
  api.cmd("stop");
  assert.ok(calls.includes("liveFinish:false"),
    "the wrist's Finish did not finish the run: " + calls.join(","));
  // ⚠️ AND IT DOES NOT CONFIRM AGAIN HERE. The wrist raises its own confirmationDialog before sending
  // "stop", so a second sheet would be a dialog nobody can answer on a phone in a pocket.
  assert.doesNotMatch(decomment(winFn("__interunWatchControl")), /confirmSheet/,
    "the phone asks a second time for a finish the runner already confirmed on their wrist");
  assert.match(swiftCode("CompanionView.swift"), /confirmationDialog/,
    "the wrist no longer confirms before finishing the phone's run");
  // ONE definition of the pause: the button re-labels itself and nothing else.
  const btn = decomment(SRC.slice(SRC.indexOf('const lPause = $("lPause")'), SRC.indexOf('const lFinish = $("lFinish")')));
  assert.match(btn, /livePauseSet\(/, "the live screen's Pause button no longer goes through livePauseSet");
  assert.doesNotMatch(btn, /rt\.pause\(/, "the pause body has been copied back into the button handler");
  assert.doesNotMatch(btn, /rt\.resume\(/, "the resume body has been copied back into the button handler");
});

test("BLOCKER: the wrist shows no controls until the page declares it can answer", () => {
  // ⚠️ THE CAPABILITY FLAG IS THE WHOLE GUARD AGAINST A DEAD CONTROL, and the asymmetry runs both
  // ways: an old PAGE with no __interunWatchControl must not be given buttons, and a new page reaching
  // an old WATCH must not assume the watch knows the key. rdMore shipped wired to nothing; the profile
  // confirm clicked a #saveSetup that was nowhere in the app. This is the same class, across a process
  // boundary, and a flag the sender sets is the answer rather than a message name the receiver guesses.
  assert.match(decomment(fnBody("pushToCompanion")), /control:\s*true/,
    "the page no longer declares that it can answer a control");
  const store = swiftCode("SessionStore.swift");
  assert.match(store, /phoneCanControl/, "the wrist no longer holds the capability");
  assert.match(store, /phoneCanControl = control/, "the wrist no longer sets it from the flag");
  const view = swiftCode("CompanionView.swift");
  assert.match(view, /if store\.phoneCanControl \{/,
    "the wrist's controls are no longer gated on the page having declared itself");
  assert.match(view, /sendPhoneCommand/, "the wrist's controls send nothing");
});

/* ------------------------------------------------------------------------------------------------ *
 * 5. THE COUNT-IN — four beats with no name the page knew                                          *
 * ------------------------------------------------------------------------------------------------ */

test("BLOCKER: every trigger the wrist can send is a trigger the page can play", () => {
  // ⚠️ THIS SWEEP WOULD HAVE CAUGHT THE COUNTDOWN FINDING, AND IT IS THE ONE GUARD HERE THAT PAYS FOR
  // ITSELF TWICE. WATCH_CUE_TRIGGERS is the map handed to Swift so a pocketed phone can answer the
  // wrist on its own; a trigger missing from it resolves to no files, playWatchCue returns false, and
  // the bridge falls through to evaluateJavaScript against a suspended web content process — which
  // does nothing and reports no error. "countdown" was never in the list, so the spoken count had no
  // working path at all when the phone was in a pocket.
  //
  // ⚠️ DERIVED FROM THE SWIFT CALL SITES, NOT FROM A LIST. The old comment claimed the list was taken
  // from the speakOnPhone call sites and nothing checked it.
  const wm = swiftCode("WorkoutManager.swift") + "\n" + swiftCode("WorkoutVoice.swift");
  const sent = new Set<string>([...wm.matchAll(/speakOnPhone\(\s*"([a-z0-9-]+)"/g)].map((m) => m[1]!));
  // ⚠️ THE STEP CUES DO NOT REACH speakOnPhone AS A LITERAL. announceStep maps the step's KIND to a
  // trigger in a switch and passes the variable, so a call-site-only sweep sees five triggers and
  // misses the five that fire most often — which is the shape of the miss it exists to catch. The
  // assignments to that variable are the other half of the same list.
  for (const m of wm.matchAll(/\btrigger = "([a-z0-9-]+)"/g)) sent.add(m[1]!);
  const beats = [...(/static let countdownTriggers = \[([^\]]*)\]/.exec(wm)?.[1] ?? "")
    .matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]!);
  assert.equal(beats.length, 4, "the wrist no longer declares four countdown beats: " + beats);
  for (const b of beats) sent.add(b);
  assert.ok(sent.size >= 13, "the call-site sweep found only " + sent.size + " triggers: " + [...sent]);
  // The two halves really both contributed, or a broken half hides behind the other.
  for (const named of ["session-start", "easy-settle", "count-go"]) {
    assert.ok(sent.has(named), "the sweep did not find " + named + ": " + [...sent]);
  }
  const known: string[] = new Function(constStmt("WATCH_COUNT_CLIPS") + "\n" +
    constStmt("WATCH_CUE_TRIGGERS") + "\nreturn WATCH_CUE_TRIGGERS;")();
  for (const t of sent) {
    assert.ok(known.includes(t),
      "the wrist can send " + t + " and the page's cue map does not know it, so it is silent on a " +
      "pocketed phone");
  }
  // The four beats are in the map by CONSTRUCTION, not by being typed twice.
  const decl = constStmt("WATCH_CUE_TRIGGERS");
  assert.match(decl, /Object\.keys\(WATCH_COUNT_CLIPS\)/,
    "the count triggers are listed by hand rather than derived from their clip map");
});

test("BLOCKER: a count beat resolves to its own fixed clip, whatever the rotation index", () => {
  // ⚠️ FOUR TRIGGERS, ONE CLIP EACH, AND BY ID RATHER THAN THROUGH THE CATALOGUE. playWatchCue plays
  // exactly ONE file per call and holds a per-trigger dedupe, so one shared "countdown" sent four
  // times would speak one number and suppress the other three — and rotate WHICH number across runs.
  // Resolving through promptsFor would do the same thing a different way: four prompts share the
  // trigger "countdown", so beat one would get whichever the rotation reached.
  let asked = 0;
  const api = new Function("RC", "coachClip", "LIVE",
    constStmt("WATCH_COUNT_CLIPS") + "\n" + fnBody("coachScheduledPrompt") +
    "\nreturn coachScheduledPrompt;")(
    { promptsFor: () => { asked++; return []; } },
    (id: string) => ({ file: "voices/guide/" + id + ".mp3", duration: 0.5 }), null);
  for (const [trigger, clip] of Object.entries(
    { "count-3": "count_3", "count-2": "count_2", "count-1": "count_1", "count-go": "count_go" })) {
    for (let idx = 0; idx < 4; idx++) {
      const got = api(trigger, idx, "easy");
      assert.ok(got, trigger + " resolves to nothing at rotation " + idx);
      assert.equal(got.id, clip, trigger + " resolved to " + got.id + " at rotation " + idx);
    }
  }
  assert.equal(asked, 0, "a count beat went through the prompt catalogue, where the rotation lives");
  // A missing clip is null rather than a guess, so the wrist's silent fallback is what happens.
  const none = new Function("RC", "coachClip", "LIVE",
    constStmt("WATCH_COUNT_CLIPS") + "\n" + fnBody("coachScheduledPrompt") +
    "\nreturn coachScheduledPrompt;")({ promptsFor: () => [] }, () => null, null);
  assert.equal(none("count-3", 0, "easy"), null, "a count beat with no audio resolved to something");
});

test("BLOCKER: the cue handler speaks one beat now, and still understands an un-rebuilt watch", () => {
  // ⚠️ THE OLD PATH RE-BASED THE WHOLE SEQUENCE. __interunWatchCue's "countdown" branch scheduled
  // count_3/2/1/go at 0/1/2/3 seconds from whenever its manifest promise resolved, so it was two
  // independent three-second timers started at different moments and could only ever be late. Per beat
  // there is nothing to schedule.
  const said: string[] = [], seq: string[] = [], trig: string[] = [];
  const win: any = {};
  new Function("window", "coachEnabled", "coachUnlock", "coachLoadManifest", "coachSayId",
    "speakCountIn", "coachTrigger", "WATCH_LIVE", "Math",
    constStmt("WATCH_COUNT_CLIPS") + "\n" + winFn("__interunWatchCue"))(
    win, () => true, () => {}, () => ({ then: (f: () => void) => { f(); return { then: () => {} }; } }),
    (id: string) => said.push(id), () => seq.push("sequence"),
    (t: string) => trig.push(t), null, Math);
  for (const [trigger, clip] of Object.entries(
    { "count-3": "count_3", "count-2": "count_2", "count-1": "count_1", "count-go": "count_go" })) {
    said.length = 0; seq.length = 0;
    win.__interunWatchCue(trigger);
    assert.deepEqual(said, [clip], trigger + " spoke " + said.join(",") + " instead of just " + clip);
    assert.deepEqual(seq, [], trigger + " ran the old re-based sequence");
  }
  // ⚠️ THE LEGACY BRANCH IS NOT DEAD CODE. A watch still on the previous build sends one "countdown",
  // and an over-the-air page update reaches phones whose watch has not been rebuilt. Late is what it
  // has always been; silence would be a regression for anyone who has not rebuilt.
  said.length = 0; seq.length = 0;
  win.__interunWatchCue("countdown");
  assert.deepEqual(seq, ["sequence"], "an un-rebuilt watch's countdown is now silent");
  // And an ordinary cue still goes to the live coach.
  win.__interunWatchCue("halfway");
  assert.deepEqual(trig, ["halfway"], "an ordinary wrist cue no longer reaches coachTrigger");
});

test("every count clip is shorter than the beat it has to fit inside", () => {
  // ⚠️ MEASURED, NOT ASSUMED, AND IT IS A REAL CONSTRAINT. The beats are one second apart and
  // CoachAudioService refuses a cue while a clip is still playing, so a count clip longer than a beat
  // would swallow the next number silently. Measured across the shipped manifest: 36 clips (9 coaches
  // x 4 beats), longest 0.77 s.
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const ids = Object.values({ "count-3": "count_3", "count-2": "count_2", "count-1": "count_1", "count-go": "count_go" });
  const clips = (m.clips as any[]).filter((c) => ids.includes(c.id));
  assert.equal(clips.length, m.coaches.length * 4,
    "expected four count clips per coach, found " + clips.length + " for " + m.coaches.length + " coaches");
  for (const c of clips) {
    assert.ok(c.duration > 0, c.coach + "/" + c.id + " has no duration in the manifest");
    assert.ok(c.duration < 1,
      c.coach + "/" + c.id + " is " + c.duration + "s, which is longer than the one-second beat");
  }
});

test("BLOCKER: the cue map is primed at a foreground moment, and never over a run in progress", () => {
  // ⚠️ WITHOUT THIS A WRIST-INITIATED RUN INTO A POCKET HAS NO CUE MAP AT ALL. The map was pushed from
  // startOnWatch (a foreground tap here) and from __interunWatchLive on a new run id — and that second
  // one arrives by evaluateJavaScript, which does nothing against a suspended page. So the one path
  // that most needs the native player was the one path that could never install its own map.
  //
  // ⚠️ AND A cuemap POST REPLACES THE WHOLE MAP IN SWIFT, so priming over a run in progress would swap
  // the coach's wordings mid-run. The guard on that is the only thing making this safe on every
  // foregrounding.
  const posts: any[] = [];
  const mk = (live: boolean, watch: boolean, pending: boolean) => new Function(
    "NATIVE_WATCH", "coachNativeAvailable", "coachEnabled", "liveRunning", "watchLiveActive",
    "WATCH_LIVE_PENDING", "rawToday", "coachLoadManifest", "coachPushWatchCueMap",
    fnBody("coachPrimeWatchCueMap") + "\nreturn coachPrimeWatchCueMap;")(
    true, () => true, () => true, () => live, () => watch, pending,
    () => ({ type: "threshold" }),
    () => ({ then: (f: () => void) => { f(); return { then: () => {} }; } }),
    (t: string) => posts.push(t));
  posts.length = 0; mk(false, false, false)();
  assert.deepEqual(posts, ["threshold"], "nothing was primed on an idle foreground");
  for (const [name, args] of [["a phone run", [true, false, false]],
                              ["a wrist run", [false, true, false]],
                              ["a wrist run being started", [false, false, true]]] as const) {
    posts.length = 0; mk(args[0] as boolean, args[1] as boolean, args[2] as boolean)();
    assert.deepEqual(posts, [], "the cue map was replaced during " + name);
  }
  // It is reached from the one listener that is a foreground moment by definition.
  assert.match(CODE, /visibilitychange[^\n]*coachPrimeWatchCueMap\(\)/,
    "the priming call is not on the visibilitychange listener");
  // ⚠️ AND THAT LISTENER'S EXISTING PAIRINGS MUST SURVIVE — syncTextScale because iOS never tells a web
  // view its text-size setting changed, stravaResume because coming back into view is the only moment
  // the app can learn the link succeeded. Both are asserted by their own files; asserted here too
  // because this is the change that touched the line.
  assert.match(CODE, /visibilitychange[^\n]*syncTextScale\(\)[^\n]*stravaResume\(\)/,
    "the visibilitychange listener lost one of its existing calls");
});
