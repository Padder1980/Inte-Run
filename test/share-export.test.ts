import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liftExportPipeline, gateRun } from "./share-export-harness.ts";

/**
 * SECTION G OF THE RELEASE GATE — WHAT THE EXPORT PIPELINE PROMISES, ASSERTED WITHOUT PIXELS.
 *
 * ⚠️ THE PREFLIGHT SWEPT ALL 69 TEST FILES AND FOUND NOTHING ANYWHERE ASSERTING AN EXPORTED PIXEL
 * DIMENSION, ENCODING, QUALITY, FILENAME OR PIECE OF METADATA. `VISUAL_ACCEPTANCE_CHECKLIST.md`
 * section G is a release gate, so none of it could be deferred to a later phase.
 *
 * ⚠️ THIS FILE AND test/share-export-bytes.test.ts ARE HALVES OF ONE GATE, SPLIT ON WHAT THEY NEED.
 * The bytes cannot be produced without a canvas, and node has none — so the byte half spawns a
 * headless browser and fails loudly when there is not one. Everything provable from the source lives
 * here instead, where it runs everywhere and can never be blocked by a missing tool. Splitting it the
 * other way round — one file that skips when the browser is absent — would have made the whole of
 * section G vanish silently on any machine without Chrome, which is the class of guard this project
 * has repeatedly found to be worth nothing.
 *
 * ⚠️ AND THE SWEEPS ARE OVER THE DERIVED CLOSURE, NEVER A HAND-WRITTEN LIST OF FUNCTION NAMES. The
 * existing dimension guard in test/share-render.test.ts names four functions; that was right when it
 * was written and is one refactor away from checking a function the export no longer calls. Here the
 * 114 functions the export actually reaches are walked out from six roots, so a helper added later is
 * covered without anybody remembering to add it.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** The app's own script block — not the whole page, which also carries the minified engine. */
let APP: string | null = null;
function appScript(): string {
  if (APP) return APP;
  const html = page();
  const marker = html.indexOf("function drawShareCard(");
  assert.ok(marker > 0, "drawShareCard is not in the build");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  APP = html.slice(open + 8, close);
  return APP;
}
function lift(name: string): string {
  const src = appScript();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
/** Comment-free, so a guard cannot be tripped or satisfied by prose. */
function code(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
}
/** The whole export closure, as source, one entry per function. */
let CLOSURE: Map<string, string> | null = null;
function closure(): Map<string, string> {
  if (CLOSURE) return CLOSURE;
  const out = new Map<string, string>();
  for (const n of liftExportPipeline().fns) out.set(n, lift(n));
  CLOSURE = out;
  return out;
}
/**
 * A tiny sandbox for the pure helpers, so they can be EXERCISED rather than read.
 * ⚠️ THE CONSTANTS HAVE TO COME WITH THEM. cardGeom reads CARD_W and CARD_M, which share one statement
 * with two more declarators — lifted by name alone the sandbox threw ReferenceError: CARD_W, which is
 * exactly what the browser would do.
 */
function liftConst(name: string): string {
  const src = appScript();
  const at = src.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return src.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
function pure(names: string[], consts: string[] = []): Record<string, any> {
  const body = consts.map(liftConst).join("\n") + "\n" +
    names.map(lift).join("\n") + "\nreturn { " + names.join(", ") + " };";
  return new Function(body)() as Record<string, any>;
}

/* ================================================================================================ *
 * THE EXPORT DOES NOT DEPEND ON THE SCREEN                                                         *
 * ================================================================================================ */

/**
 * Every way a renderer can accidentally learn how big the phone is. The brief forbids one of them by
 * name — "do not use devicePixelRatio as the export contract" — and the others are the same fault
 * arriving through a different property.
 */
const SCREEN_READS = [
  "devicePixelRatio", "innerWidth", "innerHeight", "outerWidth", "outerHeight",
  "screen.width", "screen.height", "screen.availWidth", "visualViewport",
  "getBoundingClientRect", "clientWidth", "clientHeight", "offsetWidth", "offsetHeight",
  "matchMedia", "getComputedStyle", "window.screen",
];

test("BLOCKER: nothing in the whole export closure can learn the size of the screen", () => {
  // ⚠️ SWEPT OVER ALL 114 FUNCTIONS THE EXPORT REACHES, not over a named few. A card composed against
  // the phone's own geometry is a card that comes out a different size on a different phone, and the
  // failure is invisible on the device it was written on.
  const cl = closure();
  assert.ok(cl.size > 80, "the closure came back implausibly small: " + cl.size);
  const hits: string[] = [];
  for (const [name, src] of cl) {
    const c = code(src);
    for (const r of SCREEN_READS) if (c.includes(r)) hits.push(name + " reads " + r);
  }
  assert.deepEqual(hits, [], "the export learned the screen: " + hits.join("; "));
});

test("BLOCKER: the export renders at the target size, and the preview is the same engine at a scale", () => {
  // The spec's own words: "Preview and export must use the same layout engine and view model. Preview
  // may render at reduced scale, but export renders directly at target pixels."
  // ⚠️ THE CLAIM NOW LIVES ON shareDrawBody, AND THE MOVE IS NOT A RELAXATION. It used to count
  // drawShareCard's callers, which was the right question while drawShareCard was the only way in. The
  // sticker needs a draw that takes its geometry as an argument (cardGeom cannot ask for the answer it
  // is computing), so there are two entry points and one body — and "one layout engine" is exactly the
  // statement that the body has a single caller.
  const src = code(appScript());
  const body = [...src.matchAll(/shareDrawBody\(/g)].length;
  assert.equal(body, 2, "shareDrawBody should have its declaration and exactly one caller, found " +
    body + " occurrences — one layout engine is the whole point");
  const into = code(lift("shareDrawInto"));
  assert.match(into, /shareDrawBody\(g, m, gm, S\)/, "shareDrawInto no longer draws the one body");
  assert.match(code(lift("drawShareCard")), /shareDrawInto\(g, m, shareCanvasGeom\(m\.aspect, m\), S\)/,
    "drawShareCard no longer resolves the geometry in one place and hands it to the one body");
  // the export: a canvas sized from the geometry's OUTPUT box, drawn at scale 1
  const mk = code(lift("shareCardCanvas"));
  assert.match(mk, /shareCanvasGeom\(m\.aspect, m\)/, "the export canvas is not sized from the geometry");
  assert.match(mk, /c\.width = Math\.round\(gm\.OW \* S\)/, "the export canvas width is not the geometry's");
  assert.match(mk, /c\.height = Math\.round\(gm\.OH \* S\)/, "the export canvas height is not the geometry's");
  assert.match(code(lift("prepareShareCard")), /shareCardCanvas\(m, 1\)/,
    "the exported file is not rendered at scale 1");
  // the preview: its scale comes from its own canvas against the same geometry, so it can only ever
  // describe the preview and can never become the export's contract
  const pv = code(lift("studioPaintSlide"));
  assert.match(pv, /cv\.width \/ gm\.OW/, "the preview's scale is not derived from its own canvas");
  assert.match(pv, /shareDrawInto\(g, m, gm,/, "the preview does not go through the one layout engine");
});

test("BLOCKER: the dispatch gives each template its own drawing branch, one to one", () => {
  // ⚠️ A HASH CANNOT PROVE THIS AND THE FIRST ATTEMPT TRIED. Rewiring the poster branch to call
  // shareMomentCard produces a different picture, not a duplicate — the poster carries no photograph, so
  // the Moment layout lands on the topographic ground and every distinctness check is satisfied. The
  // model's own answer cannot see it either: it still says "route". The dispatch is where the claim
  // lives, so this is where it is checked.
  const d = code(lift("shareDrawBody"));
  const pairs = [...d.matchAll(/m\.template === "([a-z]+)"\) (share[A-Za-z]+Card)\(/g)]
    .map((m) => [m[1]!, m[2]!] as [string, string]);
  assert.deepEqual(pairs.map((p) => p[0]).sort(), ["execution", "moment", "progression", "route"],
    "the dispatch no longer names exactly the four templates: " + JSON.stringify(pairs));
  const fns = pairs.map((p) => p[1]);
  assert.equal(new Set(fns).size, 4,
    "two templates share one drawing branch, so one of them silently renders as the other: " +
    JSON.stringify(pairs));
  for (const [tmpl, fn] of pairs) {
    assert.ok(fn.toLowerCase().includes(tmpl === "route" ? "poster" : tmpl),
      tmpl + " is drawn by " + fn + ", which belongs to a different template");
  }
  // and the unrecognised case is the placeholder, never one of the four
  assert.match(d, /else sharePlaceholderCard\(/,
    "an unresolved template falls through to one of the four instead of the placeholder");
});

test("BLOCKER: the file is encoded from the export canvas and never from a preview or a photograph", () => {
  // ⚠️ "NEVER UPSCALE A SCREEN SCREENSHOT" IS THE PROHIBITION, AND THE WAY IT WOULD ARRIVE IS AN
  // ENCODE OF SOMETHING OTHER THAN THE FULL-SIZE CANVAS: a slide canvas from the carousel, or the
  // runner's own file passed straight through. Both are one line away, and both look right on screen.
  const src = code(appScript());
  const enc = [...src.matchAll(/\.toBlob\s*\(/g)].length;
  const uri = [...src.matchAll(/\.toDataURL\s*\(/g)].length;
  // toBlob is used by the route-map cache and the avatar cropper as well; what matters is that the
  // share pipeline has exactly one, and that it is handed shareCardCanvas's own canvas.
  assert.ok(enc >= 1, "nothing in the app encodes a canvas any more");
  const cts = code(lift("canvasToShareFile"));
  assert.equal([...cts.matchAll(/\.toBlob\s*\(/g)].length, 1, "the share encoder is not a single toBlob");
  assert.ok(!/toDataURL/.test(cts), "the share encoder went back to toDataURL");
  const prep = code(lift("prepareShareCard"));
  assert.match(prep, /canvasToShareFile\(c, shareFileName\(m\), shareExportSpec\(m\)\)/,
    "the export does not encode shareCardCanvas's own canvas under the derived name and format");
  assert.ok(!/STUDIO\.slides|querySelector\(["']canvas/.test(prep),
    "the export reached for a preview canvas");
  // and the only two calls in the whole app are the declaration and that one
  assert.equal([...src.matchAll(/canvasToShareFile\(/g)].length, 2,
    "canvasToShareFile has more than one caller, so more than one thing decides what gets encoded");
  assert.ok(uri >= 0);
});

test("BLOCKER: the encoder's format and quality are the spec's, and one function decides both", () => {
  // The spec: "Photo templates: high-quality JPEG around 0.90-0.94"; "Graphic Route Poster: PNG is
  // acceptable". The bytes are checked in test/share-export-bytes.test.ts; this pins where the decision
  // lives so there is one place to check.
  // ⚠️ AND THE EXTENSION COMES OUT OF THE SAME FUNCTION AS THE MIME TYPE, WHICH IS THE WHOLE GUARD. A
  // sticker is a PNG because alpha is the feature, and JPEG has no alpha channel at all — so a .png name
  // over JPEG bytes is a "transparent" export that is a silent white rectangle. Nothing about its
  // dimensions, its filename or its preview would show it; only the two decisions being one can.
  const { shareExportSpec, shareAspect } =
    pure(["shareExportSpec", "shareAspect"], ["SHARE_ASPECTS"]);
  const jpg = shareExportSpec({ aspect: "story" });
  assert.equal(jpg.mime, "image/jpeg", "a story card is no longer encoded as JPEG");
  assert.equal(jpg.ext, "jpg", "a story card's extension disagrees with its mime type");
  assert.ok(jpg.quality >= 0.90 && jpg.quality <= 0.94,
    "the export quality is " + jpg.quality + ", outside the spec's 0.90-0.94");
  for (const a of ["feed", "square"]) {
    assert.deepEqual(shareExportSpec({ aspect: a }), jpg, a + " does not encode like a story card");
  }
  const png = shareExportSpec({ aspect: "sticker" });
  assert.equal(png.mime, "image/png", "a sticker is not encoded as PNG, so it has no alpha channel");
  assert.equal(png.ext, "png", "a sticker's extension is " + png.ext + " over PNG bytes");
  assert.equal(png.quality, undefined, "a sticker carries a JPEG quality, which PNG has no use for");
  // ⚠️ AND THERE IS NO OTHER PLACE A FORMAT IS NAMED. The encoder derives it from the spec, with the
  // name's own extension as the belt: a .png name cannot carry JPEG bytes even if a caller forgets.
  const cts = code(lift("canvasToShareFile"));
  assert.match(cts, /toBlob\(([\s\S]*?)sp\.mime, sp\.quality\)/,
    "the encoder no longer takes its format from the spec: " + cts.slice(0, 400));
  assert.match(cts, /type: sp\.mime/, "the File's own type disagrees with the encoder");
  assert.ok(cts.includes(".png$/i.test(String(name))"),
    "the encoder no longer falls back to the name's own extension: " + cts.slice(0, 400));
  const src = code(appScript());
  const specs = [...src.matchAll(/"image\/(jpeg|png)"/g)].map((m) => m[0]);
  const inSpec = [...code(lift("shareExportSpec")).matchAll(/"image\/(jpeg|png)"/g)].length;
  const inEnc = [...cts.matchAll(/"image\/(jpeg|png)"/g)].length;
  assert.ok(inSpec === 2, "shareExportSpec should name exactly the two formats, found " + inSpec);
  assert.ok(inEnc === 2, "canvasToShareFile's fallback should name exactly the two formats, found " + inEnc);
  assert.ok(specs.length >= 4, "the formats vanished from the build: " + specs.join(", "));
});

/* ================================================================================================ *
 * THE FILENAME                                                                                     *
 * ================================================================================================ */

/**
 * ⚠️ shareFileName IS PURE, SO IT CAN BE EXERCISED RATHER THAN READ. The spec forbids hidden metadata
 * appearing "in accessibility labels, filenames, EXIF or analytics", and a filename is the one place
 * a hidden fact leaks in plain text into the runner's own file manager, their cloud backup and the
 * name of whatever they attach it to.
 */
const SAFE_NAME = /^InteRun(-\d{4}-\d{2}-\d{2})?-[A-Za-z0-9-]+(-\d+\.\d{2}km)?\.(jpg|png)$/;
function nameOf(over: any = {}): string {
  const { shareFileName } = pure(["shareFileName", "shareExportSpec", "shareAspectFamily", "shareAspect"],
    ["SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  // ⚠️ THE MODEL CARRIES A PLACE, A ROUTE AND AN ID BY DEFAULT, so a builder that started using one
  // has something to leak. Handed a model with none of them, every "the filename names no place" guard
  // is satisfied by there being no place to name — which is how the first cut of the pattern guard
  // passed with coarseLocation appended to the name.
  return shareFileName({ sessionLabel: "Easy run", completedAt: "2026-08-18T07:39:10.000Z",
    distance: 6.31, coarseLocation: "Durham", activityId: "gate-run-1",
    route: [{ lat: 54.682, lng: -1.216 }],
    privacy: { route: true, ends: true, location: false, date: false }, ...over });
}
/**
 * ⚠️ AN ALLOWLIST OF TOKENS, NOT A PATTERN — AND THE PATTERN ALONE WAS A GUARD THAT COULD NOT FAIL.
 * A regex of the shape brand-date-kind-distance is satisfied by brand-date-kind-distance-PLACE, because
 * a place is made of the same characters as a session name. Watched: appending coarseLocation to the
 * filename passed the pattern check. So the real invariant is that every token in the name has to be
 * derivable from the four things the name is allowed to carry, and anything else fails by construction.
 */
function unexpectedTokens(name: string, model: any): string[] {
  const allowed = new Set(["InteRun"]);
  const date = String(model.completedAt || "").slice(0, 10);
  if (date) for (const t of date.split("-")) allowed.add(t);
  for (const t of String(model.sessionLabel || "Run").split(/[^A-Za-z0-9]+/)) if (t) allowed.add(t);
  allowed.add("Run");
  if (model.distance > 0) allowed.add(model.distance.toFixed(2) + "km");
  // ⚠️ BOTH EXTENSIONS, AND THIS IS A RULER CHANGE RATHER THAN A LOOSENING. The stripper's job is to
  // remove the extension before splitting on hyphens; left at .jpg only, a sticker's ".png" rode into
  // the last token and the guard reported "6.31km.png" as a leaked field. The extension itself is
  // asserted on its own two lines below, from the one function that decides it.
  return name.replace(/\.(jpg|png)$/, "").split("-").filter((t) => t && !allowed.has(t));
}

test("BLOCKER: the export filename is the spec's non-sensitive pattern", () => {
  const n = nameOf();
  assert.equal(n, "InteRun-2026-08-18-Easy-run-6.31km.jpg");
  // the spec's example is InteRun-2026-08-18-Run.jpg, so: brand, date, kind, and nothing else that
  // could describe a person or a place
  // The whole grammar, so anything the builder could newly append has to face this line: the brand,
  // an optional ISO date, a sanitised session kind, and an optional distance. Nothing else.
  assert.match(n, SAFE_NAME, "the filename left the safe pattern: " + n);
  assert.deepEqual(unexpectedTokens(n, { sessionLabel: "Easy run",
    completedAt: "2026-08-18T07:39:10.000Z", distance: 6.31 }), [],
    "the filename carries something that is not the brand, the date, the session kind or the distance: " + n);
  assert.ok(!/[/\\:*?"<>|]/.test(n), "the filename carries a character a filesystem will refuse: " + n);
  // ⚠️ THE EXTENSION HAS TO AGREE WITH WHAT THE ENCODER WRITES, or the phone opens it with the wrong
  // app — and this used to be asserted by looking for a ".jpg" literal in the builder. That was right
  // while there was one format; with a PNG sticker the literal is gone and the honest claim is that the
  // name's extension IS the format's, from the one function that decides both. Written as a literal it
  // would now be satisfied by hardcoding .jpg back on every output, which is the defect.
  assert.match(code(lift("shareFileName")), /shareExportSpec\(m\)\.ext/,
    "the filename's extension no longer comes from the export spec");
  assert.equal(nameOf({ aspect: "sticker" }).slice(-4), ".png",
    "a sticker's filename is not .png: " + nameOf({ aspect: "sticker" }));
  assert.equal(nameOf({ aspect: "story" }).slice(-4), ".jpg",
    "a story card's filename is not .jpg: " + nameOf({ aspect: "story" }));
  // and the sticker's name is otherwise the SAME safe pattern: the shape is not a token
  assert.match(nameOf({ aspect: "sticker" }), SAFE_NAME);
  assert.deepEqual(unexpectedTokens(nameOf({ aspect: "sticker" }), { sessionLabel: "Easy run",
    completedAt: "2026-08-18T07:39:10.000Z", distance: 6.31 }), [],
    "a sticker's filename carries a token the three photo shapes' does not");
});

test("BLOCKER: hiding the date hides it in the filename too, and nothing else leaks the clock", () => {
  const shown = nameOf(), hidden = nameOf({ privacy: { date: true } });
  assert.ok(/2026-08-18/.test(shown), "the date is missing when it is not hidden");
  assert.ok(!/2026|08-18|\d{4}-\d{2}/.test(hidden),
    "the date survived in the filename of a card whose date is hidden: " + hidden);
  assert.equal(hidden, "InteRun-Easy-run-6.31km.jpg");
  // ⚠️ AND NEVER A TIME OF DAY, WHICH IS THE SAME DISCLOSURE AT FINER GRAIN. completedAt carries
  // 07:39:10; a runner who hides the date is not agreeing to publish the hour they left the house.
  assert.ok(!/07|39|10:|T\d/.test(shown.replace("2026-08-18", "")),
    "the filename carries a time of day: " + shown);
});

test("BLOCKER: the filename can carry no place, no coordinate and no run id", () => {
  // Each of these is a real field on the model, and each would be a plausible thing to add.
  const n = nameOf({ coarseLocation: "Durham", place: "Durham, County Durham, England",
    activityId: "gate-run-1", route: [{ lat: 54.682, lng: -1.216 }] });
  assert.ok(!/Durham|County|England/i.test(n), "the filename names a place: " + n);
  assert.ok(!/54\.|-1\.21|lat|lng/i.test(n), "the filename carries a coordinate: " + n);
  assert.ok(!/gate-run|\b17\d{11}\b/.test(n), "the filename carries the run's id: " + n);
  // the run id is a millisecond timestamp, so it is a clock reading wearing a different name
  const src = code(lift("shareFileName"));
  assert.ok(!/\bm\.activityId\b|\brun\.id\b|\.id\b/.test(src), "the filename reads an id: " + src);
});

test("two runs on one day get two different filenames", () => {
  // ⚠️ A FIXED NAME MEANS THE RUNNER'S OWN FILE MANAGER DECIDES WHICH RUN SURVIVES. The distance is
  // the collision breaker and it is not sensitive: it is the largest number printed on the card.
  const a = nameOf({ distance: 6.31 }), b = nameOf({ distance: 12.04 });
  assert.notEqual(a, b);
  assert.match(b, /12\.04km/);
  // and a run with no distance still gets a usable name rather than a bare brand
  const none = nameOf({ distance: undefined });
  assert.equal(none, "InteRun-2026-08-18-Easy-run.jpg");
  const bare = nameOf({ distance: undefined, sessionLabel: "", privacy: { date: true } });
  assert.equal(bare, "InteRun-Run.jpg", "with nothing to say the name collapsed to something unusable");
});

test("a session label with punctuation cannot escape into the filename", () => {
  for (const [label, want] of [["36' easy run", "36-easy-run"], ["Intervals: 10 x 1'", "Intervals-10-x-1"],
    ["../../etc/passwd", "etc-passwd"], ["a\"b<c>d", "a-b-c-d"]] as [string, string][]) {
    const n = nameOf({ sessionLabel: label });
    assert.ok(n.includes(want), label + " became " + n);
    assert.match(n, SAFE_NAME, label + " became " + n);
    assert.deepEqual(unexpectedTokens(n, { sessionLabel: label,
      completedAt: "2026-08-18T07:39:10.000Z", distance: 6.31 }), [], label + " became " + n);
  }
});

/* ================================================================================================ *
 * THE FEED IS A REFLOW                                                                             *
 * ================================================================================================ */

test("BLOCKER: the three aspects are the only three, and each is exactly one required size", () => {
  const { cardGeom, shareCanvasGeom, shareAspect } =
    pure(["cardGeom", "shareGeomAt", "shareCanvasGeom", "shareAspectFamily", "shareAspect"],
      ["CARD_W", "SHARE_ASPECTS", "SHARE_ASPECT_H", "SHARE_ASPECT_FAMILY"]);
  // ⚠️ THE SIZES ARE ASSERTED AGAINST LITERALS, NOT AGAINST SHARE_ASPECT_H. Reading the table the
  // function reads is the compare-a-value-with-itself trap: it would hold whatever the table said.
  assert.deepEqual([shareCanvasGeom("story").W, shareCanvasGeom("story").H], [1080, 1920]);
  assert.deepEqual([shareCanvasGeom("feed").W, shareCanvasGeom("feed").H], [1080, 1350]);
  assert.deepEqual([shareCanvasGeom("square").W, shareCanvasGeom("square").H], [1080, 1080]);
  // ⚠️ AND THE THREE ARE THREE DIFFERENT HEIGHTS. "Each is exactly one required size" is satisfied by
  // three canvases of 1920 if the aspect never reaches the geometry, which is exactly what the square
  // looked like before shareAspect existed.
  const hs = ["story", "feed", "square"].map((a) => shareCanvasGeom(a).H);
  assert.equal(new Set(hs).size, 3, "two aspects answer the same canvas height: " + hs.join(", "));
  // ⚠️ ANYTHING ELSE IS A STORY, NOT AN ERROR AND NOT A FOURTH SIZE. An unrecognised aspect must not
  // mint a canvas of its own, and it must land on the required default rather than the newest addition.
  for (const junk of ["", "SQUARE", "1:1", "9:16", "portrait", null, undefined, 0, {}]) {
    const g = shareCanvasGeom(junk as any);
    assert.deepEqual([g.W, g.H], [1080, 1920], "an unknown aspect produced " + g.W + "x" + g.H);
    assert.equal(shareAspect(junk as any), "story", "shareAspect let " + JSON.stringify(junk) + " through");
  }
  // ⚠️ ONE VALIDATOR, AND EVERY OTHER READER IN THE FILE COMPARES AGAINST WHAT IT RETURNS. Spelled out
  // at four call sites it is four chances for a typo to draw a story under a square label.
  for (const a of ["story", "feed", "square", "sticker"]) assert.equal(shareAspect(a), a);
  assert.equal(shareCanvasGeom("feed").H, cardGeom("feed").H, "two functions answer the canvas size");
  assert.equal(shareCanvasGeom("square").H, cardGeom("square").H);
});

test("BLOCKER: the sticker is a fourth OUTPUT and not a fourth fixed size, and it refuses to guess", () => {
  const { cardGeom, shareAspectFamily } =
    pure(["cardGeom", "shareGeomAt", "shareCanvasGeom", "shareAspectFamily", "shareAspect"],
      ["CARD_W", "SHARE_ASPECTS", "SHARE_ASPECT_H", "SHARE_ASPECT_FAMILY"]);
  // ⚠️ IT REFUSES RATHER THAN FALLING BACK, AND THAT IS THE WHOLE SAFETY OF THE MECHANISM. A sticker's
  // size is a function of what is on it, so a caller that forgets the model would otherwise get the
  // nominal 1080 — a card drawn at one height into a buffer sized for another, which reads as content
  // cut off the bottom and points at the renderer rather than at the caller.
  assert.throws(() => cardGeom("sticker"), /model/i,
    "a sticker geometry with no model answered instead of refusing");
  assert.throws(() => cardGeom("sticker", null), /model/i);
  // and the three fixed shapes still answer without one, because their size does not depend on content
  for (const a of ["story", "feed", "square"]) {
    assert.ok(cardGeom(a).H > 0, a + " now needs a model, which it must not");
  }
  // ⚠️ THE FAMILY IS THE SQUARE'S, WHICH IS WHAT GIVES IT THE COMPACT LADDER, TYPE AND GAPS. Named as a
  // family rather than tested for at each of the seven readers: seven two-armed comparisons is seven
  // chances for the eighth to be written without the second half, and the failure is silent — a sticker
  // drawn at the story's type ladder simply comes out enormous.
  assert.equal(shareAspectFamily("sticker"), "square");
  assert.equal(shareAspectFamily("square"), "square");
  assert.equal(shareAspectFamily("story"), "story");
  assert.equal(shareAspectFamily("feed"), "feed");
  // ⚠️ AN UNKNOWN OUTPUT FALLS BACK TO THE STORY FAMILY, which is what shareAspect's own validation
  // guarantees, and this message used to state the opposite of what the line asserts. A failure message
  // is read at the exact moment somebody is deciding whether the guard is wrong or the code is, and one
  // that reads backwards argues for the wrong answer.
  assert.equal(shareAspectFamily("nonsense"), "story", "an unknown output no longer falls back to the story family");
});

test("BLOCKER: every table keyed on the shape is reached through the one family lookup", () => {
  // ⚠️ DERIVED FROM THE TABLES THEMSELVES, NOT A LIST OF FUNCTION NAMES. Each of these constants is the
  // square family's own answer for one dimension of the layout; whatever function reads one has to route
  // its argument through shareAspectFamily, or the sticker gets the story's value for that dimension
  // alone. A hand-written list of the five readers is a list that goes stale the first time a sixth
  // table arrives, and this file already records that shape of failure twice.
  const src = code(appScript());
  const TABLES = ["SHARE_TYPE_SQ", "SHARE_GAP_SQ", "SHARE_CHART_SQ_H", "SHARE_LADDER_MAX",
    "SHARE_METRIC_CAP"];
  const bad: string[] = [];
  for (const t of TABLES) {
    // every function whose body mentions the table, other than its own declaration
    for (const m of src.matchAll(/function ([A-Za-z_$][\w$]*)\(/g)) {
      const body = code(lift(m[1]!));
      if (!body.includes(t)) continue;
      if (!/shareAspectFamily|gm\.family|\.family ===/.test(body)) bad.push(m[1] + " reads " + t);
    }
  }
  assert.deepEqual([...new Set(bad)], [],
    "a shape-keyed table is read without going through the family: " + [...new Set(bad)].join("; "));
  // and the two places that branch on "is this a story" do it on the family too
  for (const n of ["shareQuietPlan", "sharePhotoFloor"]) {
    assert.match(code(lift(n)), /\.family === "story"/,
      n + " tests the aspect rather than the family, so a sticker takes the story's treatment");
  }
});

test("BLOCKER: the route band a sticker RESERVES is the band it DRAWS into", () => {
  // ⚠️ TWO DERIVATIONS OF ONE BAND IS HOW THE RESERVED SPACE AND THE DRAWN ROUTE COME TO DIFFER BY A FEW
  // PIXELS, which presents as a route clipped along one edge for no visible reason. shareStickerH decides
  // where the block starts by adding the band; shareStickerField hands the card the rect between the two.
  // Their agreement is arithmetic, so it can be checked without drawing anything.
  const { shareStickerField, shareGeomAt, shareRect } =
    pure(["shareStickerField", "shareStickerBandTop", "shareGeomAt", "shareRect", "shareAspectFamily",
      "shareAspect"], ["CARD_W", "SHARE_ASPECTS", "SHARE_ASPECT_FAMILY", "SHARE_WM_CLEAR",
      "SHARE_STICKER"]);
  const SS = new Function("return " + liftConst("SHARE_STICKER").replace(/^const SHARE_STICKER = /, "")
    .replace(/;$/, ""))() as any;
  const CLEAR = Number(/const SHARE_WM_CLEAR = (\d+)/.exec(appScript())![1]);
  const gm = shareGeomAt("sticker", 1200, null);
  // the wordmark's own rect is measured with a context, which node has not — so the band is checked
  // against a stand-in rect at a known place, which is all this arithmetic depends on.
  const wm = { rect: { x: 64, y: 100, w: 200, h: 40 } };
  const bandTop = Math.round(wm.rect.y + wm.rect.h) + CLEAR;
  const blockTop = bandTop + SS.field + CLEAR;
  const f = shareStickerField(gm, wm, blockTop);
  assert.equal(f.y, bandTop, "the drawn band does not start where the reservation does");
  assert.equal(f.x, gm.M, "the band is not on the card's own margin");
  assert.equal(f.w, gm.CW, "the band is not the card's own content width");
  /**
   * ⚠️⚠️ `f.h === SHARE_STICKER.field` USED TO SIT HERE AND WAS TRUE BY CONSTRUCTION. blockTop is built
   * two lines above as `bandTop + field + CLEAR` and shareStickerField answers `blockTop - CLEAR - top`,
   * so the two cancel and there is no single-sided edit that can make them differ — an attempt to break
   * it by changing `posterField` moved both sides together and was correctly not caught. The assertion
   * read as the strongest one in the test and could not fail.
   *
   * What IS falsifiable is the SHAPE of the derivation: the band's height must track the block top
   * one-for-one, because it is DERIVED from it. A re-derivation — returning SHARE_STICKER.field as a
   * height of its own, which is precisely the two-derivations fault the title names — gives a constant
   * instead, and a constant does not move when the block does.
   */
  for (const d of [1, 37, 180, -60]) {
    const g = shareStickerField(gm, wm, blockTop + d);
    assert.equal(g.h, f.h + d, "moving the block " + d + "px changed the band by " + (g.h - f.h) +
      "px: the band is not derived from the block top, so the space reserved and the space drawn into " +
      "are two numbers that can disagree");
    assert.equal(g.y, bandTop, "the band's top moved with the block; it belongs to the wordmark");
  }
  // and it can never come out negative, whatever the block does
  assert.equal(shareStickerField(gm, wm, 0).h, 0, "a block above the band produced a negative rect");
  assert.ok(shareRect(0, 0, 1, 1).w === 1);
  // ⚠️ AND THE MOMENT CARD DRAWS INTO THAT RECT RATHER THAN SCORING FOR A ZONE. shareRoutePlacement's
  // candidates lie between the top of the safe region and the top of the block, and on a sticker those
  // are 36px apart by construction — so every zone is refused, and a route switch left reading "on" over
  // a card with no route on it is the looks-live-does-nothing defect.
  const mc = code(lift("shareMomentCard"));
  assert.match(mc, /gm\.sticker \? \{ rect: shareStickerField\(gm, wm, p\.blockTop\) \}/,
    "The Moment does not draw its sticker route into the reserved band");
  assert.match(mc, /shareRoutePlacement\(gm/, "the photo cards no longer score for a route zone");
  // and the height derivation adds the band for exactly the templates that draw one
  const h = code(lift("shareStickerH"));
  assert.match(h, /SHARE_STICKER\.posterField/, "the poster reserves no route field");
  assert.match(h, /m\.route \? SHARE_STICKER\.field/,
    "The Moment reserves a route band whether or not it has a route to draw");
});

test("BLOCKER: no photograph means no scrim, which is not the same test as an unreadable one", () => {
  // ⚠️⚠️ THIS IS THE DEFECT THE WHOLE STICKER IS ONE MISSING GATE AWAY FROM. shareGroundUnder answers
  // WHITE when it cannot look, which is right for a photograph we have but cannot sample — fail towards
  // protecting the type — and catastrophic on a transparent card, where there is no photograph at all:
  // solved from 255 the alpha comes back near its cap and the export carries a near-opaque dark gradient
  // over its lower half, to be dropped on to somebody's own picture. probe === null is the sticker;
  // probe.data === null is the tainted card, and the two must not share an answer.
  for (const n of ["sharePhotoScrim", "shareTopScrim"]) {
    const b = code(lift(n));
    assert.match(b, /if \(!probe\) return/,
      n + " does not refuse a card with no photograph, so a scrim is solved from a white ground");
  }
  // and the fail-towards-white rule is intact for a photograph that cannot be READ
  assert.match(code(lift("shareGroundUnder")), /if \(!probe \|\| !probe\.data\) return \[255, 255, 255\]/,
    "the sampler no longer fails towards the strongest treatment when it cannot see the photograph");
  // and nothing fills a ground or draws the poster's texture on a sticker
  const body = code(lift("shareDrawBody"));
  assert.match(body, /if \(!gm\.sticker\) shareGroundFill/,
    "a sticker fills the ground, which is the one thing a transparent output must not do");
  assert.match(body, /!m\.photo && !gm\.sticker\) shareTopoDraw/,
    "a sticker draws the poster's topographic texture, which on alpha is a full-canvas wash");
});

test("BLOCKER: the shorter shapes recompose rather than scaling — the safe region is not the story's, scaled", () => {
  // The contract: "Recompose, do not crop the Story output." A uniform scale would keep every ratio;
  // a crop would keep every absolute inset. Neither shorter shape keeps either, and that is checkable
  // arithmetic. ⚠️ SWEPT OVER BOTH OF THEM RATHER THAN NAMED FOR THE FEED — the square is the shape a
  // centre crop of the story would most plausibly be mistaken for.
  const { shareCanvasGeom } = pure(["cardGeom", "shareGeomAt", "shareCanvasGeom", "shareAspectFamily", "shareAspect"],
    ["CARD_W", "SHARE_ASPECTS", "SHARE_ASPECT_H", "SHARE_ASPECT_FAMILY"]);
  const s = shareCanvasGeom("story");
  for (const aspect of ["feed", "square"]) {
    const f = shareCanvasGeom(aspect);
    assert.equal(s.W, f.W, aspect + " is not the story's width, so a scale is not even the question");
    // NOT A UNIFORM SCALE. A scale keeps EVERY ratio, so it is refuted the moment one of them differs —
    // and the claim has to be written that way round, because on the square the TOP one does not.
    // ⚠️ MEASURED COINCIDENCE, RECORDED SO IT IS NOT MISTAKEN FOR A DEFECT: the square's top reserve is
    // 64 / 1080 = 0.059 and the story's is 120 / 1920 = 0.063. Four thousandths apart, for entirely
    // unrelated reasons — one is a side margin, the other is Instagram's profile row — so the top inset
    // alone cannot tell a recomposed square from a scaled story. The first version of this guard
    // required it to differ and failed on correct code, which is the same shape of fault as pinning a
    // test to an implementation's own frame of reference.
    const sTop = s.safe.y0 / s.H, fTop = f.safe.y0 / f.H;
    const sBot = (s.H - s.safe.y1) / s.H, fBot = (f.H - f.safe.y1) / f.H;
    assert.ok(Math.abs(sTop - fTop) > 0.01 || Math.abs(sBot - fBot) > 0.01,
      aspect + ": every vertical reserve is the same fraction of both canvases (top " +
      sTop.toFixed(3) + " vs " + fTop.toFixed(3) + ", bottom " + sBot.toFixed(3) + " vs " +
      fBot.toFixed(3) + "), which is what a uniform scale looks like");
    // and the bottom one is the reserve that carries the meaning: the story holds a platform overlay
    // open and a feed post or a square has none, so that ratio must move on both.
    assert.ok(Math.abs(sBot - fBot) > 0.05,
      aspect + ": the bottom reserve is the same fraction of both canvases, so the platform overlay " +
      "the story reserves for is being reserved on a shape that has none");
    // not a crop either: a crop keeps the absolute inset, and the shorter shapes' own reserve is the
    // side margin
    assert.notEqual(s.safe.y0, f.safe.y0,
      aspect + " kept the story's absolute top inset — that is a crop");
    assert.equal(f.safe.y0, f.M, aspect + " has no platform reserve, so its top inset is the margin");
    assert.equal(f.H - f.safe.y1, f.M, aspect + "'s bottom inset is not its own margin");
  }
});

test("BLOCKER: the feed tightens the DISPLAY type only, which is a recomposition and not a scale", () => {
  // ⚠️ THE CONSTANT IS A MAP OF MULTIPLIERS, NOT A SECOND LADDER OF SIZES, and reading it as sizes was
  // a guard measuring nothing: feed.mega / story.mega came out as 0.78 / 248. Exercise shareTypeSize,
  // which is what the templates call, rather than the table behind it.
  const { shareTypeSize } = pure(["shareTypeSize", "shareAspectFamily", "shareAspect"],
    ["SHARE_TYPE", "SHARE_TYPE_FEED", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  const src = appScript();
  const at = src.indexOf("const SHARE_TYPE = ");
  assert.ok(at > 0, "SHARE_TYPE is not in the build");
  const story = new Function("return " + src.slice(src.indexOf("{", at), src.indexOf("};", at) + 1))() as Record<string, number>;
  const shrunk: string[] = [], held: string[] = [];
  for (const role of Object.keys(story)) {
    const s = shareTypeSize(role, "story"), f = shareTypeSize(role, "feed");
    assert.ok(s > 0 && f > 0, role + " has no size");
    assert.ok(f <= s, role + " is LARGER on the feed: " + f + " vs " + s);
    (f < s ? shrunk : held).push(role);
  }
  // ⚠️ SOME RUNGS MOVE AND SOME DO NOT, AND THAT IS THE EVIDENCE. The contract asks the feed to
  // "tighten headline scale" while preserving all essential metrics: measured, the six display rungs
  // shrink (mega 248 -> 193, a factor of 0.78) and the eight body rungs hold at their story size. A
  // uniform scale would move every one of them by the same factor, and a crop would move none.
  assert.ok(shrunk.length >= 5, "the feed tightens almost nothing: " + shrunk.join(","));
  assert.ok(held.length >= 5, "the feed shrank the body copy too, which is a scale: " + held.join(","));
  const factors = shrunk.map((r) => shareTypeSize(r, "feed") / shareTypeSize(r, "story"));
  const spread = Math.max(...factors) - Math.min(...factors);
  assert.ok(spread > 0.05, "every tightened rung moved by the same factor (spread " + spread.toFixed(3) +
    "), so the hierarchy was scaled rather than re-proportioned");
  assert.ok(shareTypeSize("mega", "feed") < shareTypeSize("mega", "story") * 0.85,
    "the hero barely tightened on the feed");
});

test("BLOCKER: the story reserves a photographic share of the canvas and the feed does not", () => {
  // ⚠️ THE CLEAREST SINGLE PIECE OF EVIDENCE THAT THE FEED IS RECOMPOSED. The contract asks it to
  // "reduce photographic share of the canvas", so the floor that holds the story's upper half open for
  // the photograph is deliberately absent there — the data block is allowed to take more of a shorter
  // canvas. A cropped or scaled story would carry the same reserve in both.
  const { sharePhotoFloor, shareCanvasGeom } =
    pure(["cardGeom", "shareGeomAt", "shareCanvasGeom", "sharePhotoFloor", "shareAspectFamily", "shareAspect"],
      ["CARD_W", "SHARE_PHOTO_FLOOR", "SHARE_ASPECTS", "SHARE_ASPECT_H", "SHARE_ASPECT_FAMILY"]);
  for (const id of ["execution", "progression"]) {
    const st = sharePhotoFloor(shareCanvasGeom("story"), id);
    assert.ok(st > 0.49 * 1920, id + ": the story's photographic floor is only " + st + "px of 1920");
    // ⚠️ BOTH SHORTER SHAPES, AND THE SQUARE IS THE ONE THIS WOULD HAVE BITTEN SILENTLY. Written as
    // "feed means no floor", a square inherited the STORY's floor — 50% of 1080 is 540, which a
    // recomposed block clears anyway, so nothing looked wrong and The Execution's verdict was
    // nevertheless sized against a constraint belonging to a canvas 840px taller.
    for (const aspect of ["feed", "square"]) {
      const fd = sharePhotoFloor(shareCanvasGeom(aspect), id);
      assert.equal(fd, 0, id + ": " + aspect + " carries the story's photographic reserve (" + fd + "px)");
    }
  }
});

/* ================================================================================================ *
 * THE STATES THE GATE HAS TO COVER                                                                 *
 * ================================================================================================ */

test("the gate's own fixture is a run record, and it carries the values that make the checks mean something", () => {
  // ⚠️ A FIXTURE THAT IS ALREADY TIDY CERTIFIES A RULE THAT HAS BEEN DELETED. This project has shipped
  // that twice: a debrief layout verified against a short target line no plan produces, and a run-walk
  // warm-up fixture with no session type. So the gate's run has to arrive UNCOARSENED and UNREDACTED.
  const r = gateRun();
  assert.equal(r.place, "Durham, County Durham, England",
    "the fixture's place is already coarse, so coarsening cannot be seen to happen");
  assert.ok(r.route.length > 40, "the fixture's route is too short for end redaction to remove anything");
  assert.ok(r.pband && r.pband.minSecPerKm > 0, "the fixture carries no target, so The Execution is unreachable");
  assert.ok(r.splits.length >= 3, "the fixture cannot exercise The Progression");
  assert.ok(!/^\d{13}$/.test(String(r.id)), "the fixture's id is a timestamp, which the filename guard needs absent");
});

/* ================================================================================================ *
 * THE SQUARE IS A RECOMPOSITION, AND EACH OF ITS FOUR REDUCTIONS DOES REAL WORK                    *
 * ================================================================================================ */

/**
 * ⚠️ THE CONTRACT PERMITS 1:1 ONLY AS A RECOMPOSITION — "Recompose to a compact poster; allow two
 * metrics rather than crushing three", "Never hide the primary distance/session outcome to retain
 * secondary data" and, for every non-story shape, "Reflow each aspect ratio. Do not merely crop or
 * uniformly scale the 9:16 design."
 *
 * The bytes gate proves the shape and proves it is not a crop of the story. What is checked here is the
 * MECHANISM: four independent reductions, each of which was measured to do work, and each of which is
 * the kind of thing a future change could quietly turn off. Reverted one at a time and re-measured, the
 * clear photograph on a square reads (moment / execution / progression / poster):
 *
 *   all four in place              51.7 / 43.1 / 42.2 / 59.0 %
 *   type at the feed's factors     47.1 / 38.7 / 40.8 / 55.4 %
 *   the ladder left at six rows    51.7 / 43.1 / 31.9 / 59.0 %
 *   none of them, gaps at 1.0      33.6 / 21.4 / 20.0 / 43.7 %
 */
test("BLOCKER: the square tightens the display type further than the feed, and holds the body rungs", () => {
  const { shareTypeSize } = pure(["shareTypeSize", "shareAspectFamily", "shareAspect"],
    ["SHARE_TYPE", "SHARE_TYPE_FEED", "SHARE_TYPE_SQ", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  const src = appScript();
  const at = src.indexOf("const SHARE_TYPE = ");
  const story = new Function("return " +
    src.slice(src.indexOf("{", at), src.indexOf("};", at) + 1))() as Record<string, number>;
  const tightened: string[] = [], held: string[] = [];
  for (const role of Object.keys(story)) {
    const s = shareTypeSize(role, "story"), f = shareTypeSize(role, "feed"),
      q = shareTypeSize(role, "square");
    assert.ok(s > 0 && f > 0 && q > 0, role + " has no size at some aspect");
    // ⚠️ MONOTONE, AND THAT IS THE CLAIM RATHER THAN "the square is smaller than the story". A square is
    // shorter than a feed post, so a rung that tightened for the feed and then grew back for the square
    // would be a reflow that undoes itself, and the story-versus-square comparison alone cannot see it.
    assert.ok(q <= f && f <= s,
      role + " is not monotone across the three shapes: story " + s + ", feed " + f + ", square " + q);
    (q < f ? tightened : held).push(role);
  }
  assert.ok(tightened.length >= 5,
    "the square tightens no more than the feed does, so it is the feed's reflow at a different height: " +
    tightened.join(","));
  // and the body rungs are IDENTICAL in all three, deliberately: a square is read at feed size, and
  // four pixels of height bought off a 24px label costs legibility at thumbnail size.
  for (const role of held) {
    assert.equal(shareTypeSize(role, "square"), shareTypeSize(role, "story"),
      role + " is a body rung and the square moved it");
  }
  assert.ok(held.length >= 5, "the square shrank the body copy too, which is a scale: " + held.join(","));
});

test("BLOCKER: the square's measured gaps close, and the other two shapes' gaps cannot move", () => {
  const { shareGaps } = pure(["shareGaps", "shareAspectFamily", "shareAspect"], ["SHARE_GAP_SQ", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  const src = appScript();
  const tables: Record<string, Record<string, number>> = {};
  for (const name of ["MOMENT_GAP", "EXEC_GAP", "PROG_GAP", "POSTER_GAP"]) {
    const at = src.indexOf("const " + name + " = ");
    assert.ok(at > 0, name + " is not in the build");
    tables[name] = new Function("return " +
      src.slice(src.indexOf("{", at), src.indexOf("};", at) + 1))() as Record<string, number>;
  }
  for (const [name, G] of Object.entries(tables)) {
    // ⚠️ IDENTITY, NOT EQUALITY, FOR THE TWO REQUIRED SHAPES. Returning a fresh copy would pass an
    // equality check and would also be a second object a future edit could scale by accident; the
    // required formats must be handed the very table the references were measured off.
    assert.equal(shareGaps(G, "story"), G, name + " was copied for a story");
    assert.equal(shareGaps(G, "feed"), G, name + " was copied for a feed post");
    const q = shareGaps(G, "square");
    assert.notEqual(q, G, name + " handed the square the story's own table");
    assert.deepEqual(Object.keys(q).sort(), Object.keys(G).sort(),
      name + ": the square's table has different keys, so a gap silently became undefined");
    for (const k of Object.keys(G)) {
      assert.ok(q[k]! < G[k]!, name + "." + k + " did not close for the square: " + q[k] + " of " + G[k]);
      assert.ok(q[k]! > 0, name + "." + k + " closed to nothing, which is a collision not a reflow");
    }
  }
});

test("BLOCKER: the square carries two metric columns and the poster keeps the adherence one", () => {
  const { shareMetricCap, shareMetricsFor, sharePosterMetrics, shareMetricUnit } =
    pure(["shareMetricCap", "shareMetricsFor", "sharePosterMetrics", "shareMetricUnit", "shareAspectFamily", "shareAspect"],
      ["SHARE_METRIC_CAP", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  assert.equal(shareMetricCap("square"), 2, "the square does not carry the contract's two metrics");
  for (const a of ["story", "feed", undefined]) {
    assert.equal(shareMetricCap(a as any), 3, "a required shape lost a metric column");
  }
  const metrics = [{ key: "time", k: "TIME", v: "47:12", u: "" },
    { key: "pace", k: "AVG PACE", v: "5:36", u: "/KM" },
    { key: "elev", k: "ELEV", v: "28", u: "M" },
    { key: "hr", k: "AVG HR", v: "142", u: "BPM" }];
  assert.equal(shareMetricsFor({ aspect: "square", metrics }, null).length, 2);
  assert.equal(shareMetricsFor({ aspect: "story", metrics }, null).length, 3);
  // ⚠️ THE POSTER APPENDS ITS ADHERENCE COLUMN AFTER THE CAP, SO IT HAS TO RE-APPLY IT — and it did not,
  // which shipped a three-column row on a square while the other three templates had reflowed to two.
  const m = { aspect: "square", metrics, pill: { state: "achieved" },
    adherence: { inBand: 5, judged: 6 } };
  const row = sharePosterMetrics(m, null);
  assert.equal(row.length, 2, "the poster kept three columns on a square: " + row.length);
  // ⚠️ AND IT IS THE ADHERENCE COLUMN THAT SURVIVES. It is the only number in that row that says whether
  // the run did what it was set to do, and the contract's square rule is that secondary data gives way
  // to the outcome, never the other way round.
  assert.equal(row[row.length - 1].key, "onTarget",
    "the square poster dropped the adherence column instead of a supporting number");
  assert.equal(sharePosterMetrics({ ...m, aspect: "story" }, null).length, 3);
});

test("BLOCKER: the square's ladder is shorter and still describes every kilometre", () => {
  const { shareLadderMax, shareLadderRows } =
    // ⚠️ DECLARATION ORDER, NOT ALPHABETICAL: SHARE_LADDER READS SHARE_EVEN_SPREAD_S, and pure() emits
    // these in the order given, so listing them the other way round throws a temporal-dead-zone
    // ReferenceError exactly as the page would. This file's sibling records the same trap taking a whole
    // suite green while the app rendered nothing.
    pure(["shareLadderMax", "shareLadderRows", "shareAspectFamily", "shareAspect"],
      ["SHARE_EVEN_SPREAD_S", "SHARE_LADDER", "SHARE_LADDER_MAX", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  assert.equal(shareLadderMax("square"), 4);
  for (const a of ["story", "feed", undefined]) assert.equal(shareLadderMax(a as any), 6);
  const splits = [];
  for (let i = 1; i <= 11; i++) splits.push({ km: i, sec: 330 + (i % 3) * 7 });
  for (const [aspect, want] of [["story", 6], ["square", 4]] as [string, number][]) {
    const rows: any[] = shareLadderRows({ aspect, splits });
    assert.equal(rows.length, want, aspect + " drew " + rows.length + " ladder rows");
    // ⚠️ FEWER ROWS IS STILL EVERY KILOMETRE. shareLadderRows' own rule is that membership is a function
    // of position alone — nothing is dropped for being inconvenient and nothing is chosen for being
    // fast — so a shorter ladder has to be wider blocks rather than a subset.
    const members = rows.flatMap((r: any) => r.members).sort((x: number, y: number) => x - y);
    assert.deepEqual(members, splits.map((s) => s.km),
      aspect + ": the ladder does not account for every kilometre exactly once: " + members.join(","));
  }
  // and shuffling the paces cannot change which kilometre lands in which row
  const shuffled = splits.map((s, i) => ({ km: s.km, sec: 300 + ((i * 7) % 11) * 9 }));
  assert.deepEqual(shareLadderRows({ aspect: "square", splits: shuffled }).map((r: any) => r.members),
    shareLadderRows({ aspect: "square", splits }).map((r: any) => r.members),
    "the square's ladder chose its rows from the paces, which is cherry-picking");
});

test("BLOCKER: the square's target-band chart is shorter and nothing else about it changes", () => {
  const { shareChartH } = pure(["shareChartH", "shareAspectFamily", "shareAspect"],
    ["SHARE_CHART", "SHARE_CHART_SQ_H", "SHARE_ASPECT_FAMILY", "SHARE_ASPECTS"]);
  const story = shareChartH("story");
  assert.equal(shareChartH("feed"), story, "the feed's chart is not the story's height");
  assert.ok(shareChartH("square") < story,
    "the square's chart is the story's height, so its 22px comes out of the photograph instead");
  assert.ok(shareChartH("square") > story * 0.6,
    "the square's chart shrank to " + shareChartH("square") + "px, which is a hairline not a lane");
  // ⚠️ ONE NUMBER MOVES. Every other property of that chart — the band's padding, the marker radius, the
  // stem length — is derived from the plot height, so a second square-only constant would be a second
  // place for the two to disagree.
  const src = appScript();
  const at = src.indexOf("const SHARE_CHART = ");
  const chart = src.slice(at, src.indexOf("};", at));
  assert.ok(!/square/i.test(chart), "SHARE_CHART itself now knows about the square");
});
