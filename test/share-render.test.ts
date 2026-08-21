import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REF_VALUES, REF_ROUTE, HOSTILE_GROUNDS, refRunA, refRunB, treadmillRun, intervalRun }
  from "./share-fixtures.ts";

/**
 * THE SHARE CARD'S RENDER PRIMITIVES — THE FULL-BLEED COMPOSITOR, THE SAFE-ZONE SYSTEM, THE ADAPTIVE
 * CONTRAST SOLVER, THE TEXT PRIMITIVES, THE TEXTURE AND THE ROUTE.
 *
 * ⚠️ NOTHING PINNED ANY OF THIS. test/share-model.test.ts covers the data layer and
 * test/share-studio.test.ts covers the editor's wiring; between them they do not contain one assertion
 * about geometry, colour, contrast, projection or exported pixel dimensions. The preflight named the
 * dimension guard as the cheapest and highest-value thing missing from the whole area, and it was
 * absent: not one test in the suite asserted that an export is 1080x1920.
 *
 * ⚠️ THE PURE GEOMETRY IS EXECUTED HERE; THE PIXELS ARE MEASURED IN A BROWSER. node has no canvas, so
 * every guard below either runs the real function against a recording 2D context or checks arithmetic
 * that has no canvas in it. The rendered-pixel measurements (full-bleed edges, the contrast table over
 * eight hostile photographs, the texture's ratio band) live in
 * scratchpad/share/work/p2/m1-fullbleed.mjs, m3-contrast.mjs and m2-topo.mjs, and the numbers they
 * produced are quoted in the assertions that encode them so a future change has to face them.
 *
 * Every guard was watched failing against a deliberate re-break before it was believed; the count is in
 * the phase report.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/**
 * ⚠️⚠️ THE APP'S OWN RUNTIME SCRIPT, NOT THE WHOLE PAGE — AND SEARCHING THE WHOLE PAGE WAS A GUARD THAT
 * COULD NOT FAIL.
 *
 * The built page carries the bundled engine as well as the app, and esbuild MINIFIES the engine, renaming
 * its functions to one and two letters. There are two `function rr(` in web/app.html: the engine's
 * minified rangeText, which comes first, and the canvas rounded-rect helper the card actually draws with.
 * lift("rr") returned the engine's — a function that formats a string and draws nothing — so the sandbox's
 * rr was inert, every rounded path in the renderer logged NOTHING, and any guard reasoning about one was
 * measuring an empty array. Found by a new assertion about the band lane's own geometry failing with
 * "the lane's own tint was never set", which was true: the fill was there and the path was not.
 *
 * The fix is derived rather than a special case for rr: everything these tests lift belongs to the app's
 * own script block, which is the one that declares drawShareCard, so that is the only text searched. Any
 * future one-or-two-letter collision with the minified engine is impossible by construction.
 */
let APP_SRC: string | null = null;
function appScript(): string {
  if (APP_SRC) return APP_SRC;
  const html = page();
  const marker = html.indexOf("function drawShareCard(");
  assert.ok(marker > 0, "drawShareCard is not in the build");
  const open = html.lastIndexOf("<script>", marker);
  const close = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && close > open, "the app's own script block could not be bounded");
  APP_SRC = html.slice(open + 8, close);
  return APP_SRC;
}

function lift(name: string): string {
  const html = appScript();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function liftConst(name: string): string {
  const html = appScript();
  const at = html.indexOf("const " + name + " = ");
  assert.ok(at >= 0, "const not found in the build: " + name);
  let d = 0;
  for (let i = at; i < html.length; i++) {
    const c = html[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return html.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}

const CONSTS = ["SHARE_INK", "SHARE_TYPE", "SHARE_TYPE_FEED", "SHARE_TRACK", "SHARE_SUBJECT",
  "SHARE_ROUTE_ZONES", "SHARE_TOPO", "SHARE_VEIL_STEPS", "SHARE_PROBE_W", "FF",
  "SHARE_ZONE_PEN", "SHARE_ZONE_MIN_H", "SHARE_BADGE", "SHARE_QUIET", "MOMENT_GAP", "POSTER_GAP", "POSTER_TAG",
  "SHARE_POSTER_PAD", "EXEC_GAP", "PROG_GAP", "SHARE_CHART", "SHARE_PHOTO_FLOOR",
  "SHARE_EVEN_SPREAD_S", "SHARE_LADDER", "SHARE_SCRIM", "SHARE_LUMW", "SHARE_HAIR", "SHARE_BLUR",
  "SHARE_SCRIM_MARGIN", "SHARE_EFFORT", "SHARE_GROUND", "SHARE_WM_EDGE",
  // the one table that decides a canvas height, and the two shapes there are
  "SHARE_ASPECTS", "SHARE_ASPECT_H", "SHARE_METRIC_MAX"];
/**
 * ⚠️ THREE OF THE CARD'S CONSTANTS SHARE ONE STATEMENT — `const CARD_W = 1080, CARD_M = 64, ...` — so
 * liftConst cannot find them by their own name. Lifted by the statement's FIRST declarator and named
 * separately for the sandbox's return, rather than reformatting the app to suit a test.
 */
const STMTS: [string, string[]][] = [["CARD_W", ["CARD_W", "CARD_M"]],
  ["SHARE_ZONE_MIN_W", ["SHARE_ZONE_MIN_W", "SHARE_ZONE_MAX_W"]],
  ["SHARE_CAP", ["SHARE_CAP", "SHARE_FIG"]]];
const EXTRA = STMTS.flatMap((s) => s[1]);
const FNS = ["shareFont", "shareTypeSize", "cardAlpha", "cardLsWidth", "shareFigAdvance", "shareFigWidth", "shareFig",
  "shareFit", "shareFitToRoom", "cardGeom", "shareDrawInto", "shareDrawBody",
  "shareRect", "shareRectPad", "shareRectOverlap", "shareRectInside",
  "sharePhotoBox", "sharePhotoNorm", "sharePhotoDraw", "shareSubjectZones",
  "shareBoxLeavesGap", "shareBlurBg", "sharePhotoCompose",
  "shareZoneRect", "shareZoneScore", "shareRouteFallback", "shareRoutePlacement",
  "shareLin255", "shareLinLut", "shareRelLumRGB", "shareHexRGB", "shareGroundRGB", "shareRectGroundRGB",
  "shareRelLum", "shareLumOfByte", "shareRatio", "shareGroundUnder", "shareVeilAlphaFor",
  "shareVeilPlan", "shareVeilDraw", "shareScrimFade", "shareScrimText", "sharePhotoScrim", "shareEase",
  "shareGroundFill", "shareTopoField", "shareEffortHex", "shareHexHSL", "shareHSLHex",
  "shareGroundStops", "shareGroundPaint", "shareQuietInk", "shareTopoDraw", "shareTopoCanvas",
  "shareRouteProject", "shareRouteSimplify", "shareRoutePath", "shareRouteDraw",
  "shareWordmark", "shareWordmarkWidth", "lsText", "rr",
  // the templates
  "shareQuietPlan", "shareLsFit", "shareWordmarkPlan", "shareHeroFor", "shareMetricUnit", "shareFieldRoute",
  "shareMetricsFor", "shareBadgePlan", "shareTick", "shareBadgeDraw", "shareMetricPlan",
  "shareMetricDraw", "shareHairline", "shareMark", "shareMetricRules", "shareMomentPlan", "shareMomentCard",
  "sharePosterMetrics", "sharePosterPlan", "sharePosterCard",
  // phase 4: the two data-led templates, and the state with no template at all
  "shareRowMetrics", "sharePhotoFloor", "shareChartMarker", "shareBandChart", "shareAxisKeep",
  "shareExecutionPlan", "shareExecutionCard", "shareLadderRows", "shareLadderScale", "shareChartKey",
  "shareProgressionPlan", "shareProgressionCard", "sharePlaceholderCard", "fmtPace",
  "shareProgressionClaim", "shareEyebrow",
  // ⚠️ THIS LIST IS HAND-WRITTEN AND IT WENT STALE THE MOMENT cardGeom GAINED shareAspect — 63 tests in
  // this file threw ReferenceError at once. That is the acceptable kind of stale: it fails loudly rather
  // than quietly measuring less, which is why the list survives here while the byte gate's closure is
  // derived. Adding a share* function that another lifted one calls means adding it here too.
  "shareAspect"];

/**
 * A RECORDING 2D CONTEXT. Every call and every style assignment is appended to a log, so a drawing
 * function can be asserted on what it DID rather than on what its source looks like.
 *
 * ⚠️ measureText IS DETERMINISTIC AND DELIBERATELY NOT MONOSPACED. A uniform advance would make the
 * digit-column guard pass whatever shareFig did, which is the assert-a-value-against-itself trap this
 * project has already shipped twice. Digit "1" is narrow here exactly as it is in SF Pro.
 */
const ADV: Record<string, number> = { "1": 0.42, "0": 0.57, "2": 0.52, "3": 0.54, "4": 0.56,
  "5": 0.54, "6": 0.56, "7": 0.49, "8": 0.56, "9": 0.56, ":": 0.26, ".": 0.26, " ": 0.26, "-": 0.33 };
function recCtx() {
  const log: any[] = [];
  let font = "800 100px x";
  const size = () => parseFloat((/(\d+(?:\.\d+)?)px/.exec(font) || ["", "100"])[1]!);
  const ctx: any = {
    get font() { return font; },
    set font(v: string) { font = v; log.push(["font", v]); },
    measureText: (t: string) => {
      const s = size();
      let w = 0;
      for (const ch of String(t)) w += (ADV[ch] == null ? 0.60 : ADV[ch]) * s;
      return { width: w };
    },
    log: log,
    calls: (name: string) => log.filter((e) => e[0] === name),
  };
  for (const m of ["save", "restore", "beginPath", "moveTo", "lineTo", "arc", "arcTo", "closePath",
    "fill", "stroke", "fillRect", "clip", "rect", "roundRect", "fillText", "strokeText", "drawImage", "scale",
    "translate", "setTransform", "clearRect"]) {
    ctx[m] = (...a: any[]) => { log.push([m, ...a]); };
  }
  for (const p of ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "textAlign",
    "textBaseline", "globalAlpha", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "filter",
    "imageSmoothingEnabled", "imageSmoothingQuality"]) {
    let v: any = p === "shadowBlur" ? 0 : p === "shadowColor" ? "rgba(0,0,0,0)" : "";
    Object.defineProperty(ctx, p, {
      get: () => v,
      set: (x: any) => { v = x; log.push([p, x]); },
    });
  }
  ctx.createLinearGradient = () => ({ addColorStop: (o: number, c: string) => { log.push(["stop", o, c]); } });
  ctx.createRadialGradient = () => { log.push(["createRadialGradient"]); return { addColorStop: () => {} }; };
  ctx.getImageData = () => { throw new Error("no pixels in node"); };
  ctx.putImageData = () => {};
  ctx.createImageData = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
  return ctx;
}

/**
 * ⚠️ THE SANDBOX EMITS THE CONSTANTS IN THE ORDER THE PAGE DECLARES THEM, NOT IN THE ORDER THIS FILE
 * LISTS THEM — AND THAT IS A GUARD, NOT TIDINESS.
 *
 * SHARE_LADDER reads SHARE_EVEN_SPREAD_S, which was first written three hundred lines further down the
 * file. At top level that is a temporal dead zone: the const threw on load, the whole script block
 * aborted, and the app rendered a blank page. Every check passed — the build exited 0, node --check on
 * the emitted script was clean because the syntax is valid, tsc was clean, and the whole suite was
 * green BECAUSE THIS LIST WAS IN A DIFFERENT ORDER FROM THE APP. Sorting by the declaration's real
 * position makes the sandbox fail the way the browser does, so the next one cannot hide here.
 */
function constOrder(names: string[]): string[] {
  const html = appScript();
  const at = (n: string) => {
    const i = html.indexOf("const " + n + " = ");
    assert.ok(i >= 0, "const not found in the build: " + n);
    return i;
  };
  return [...names].sort((a, b) => at(a) - at(b));
}

type Env = { [k: string]: any; ctx: () => any };
function env(): Env {
  const body =
    constOrder(CONSTS).map(liftConst).join("\n") + "\n" +
    STMTS.map((s) => liftConst(s[0])).join("\n") + "\n" +
    "let SHARE_LPROBE = null, SHARE_LPROBE_KEY = \"\";\n" +
    "let SHARE_LIN_LUT = null;\n" +
    "let SHARE_TOPO_C = null, SHARE_TOPO_KEY = \"\";\n" +
    "let SHARE_BLUR_C = null, SHARE_BLUR_KEY = \"\";\n" +
    "let CARD_MEASURE = null;\n" +
    "function cardMeasureCtx() { if (!CARD_MEASURE) CARD_MEASURE = __mk(); return CARD_MEASURE; }\n" +
    FNS.map(lift).join("\n") + "\n" +
    "return { " + FNS.join(", ") + ", " + CONSTS.concat(EXTRA).join(", ") + ", cardMeasureCtx };";
  // ⚠️ EVERY OFFSCREEN CANVAS IS KEPT, AND ITS CONTEXT IS STABLE PER CANVAS. The texture and the blur
  // both draw into one of these and then drawImage it, so without a handle on the inner context there is
  // no way to assert what they actually stroked — only what their source looks like, which house rule
  // says proves a string exists and never that anything reaches it. getContext returning a FRESH
  // recorder each call also threw the log away for anything asking for it twice.
  const made: any[] = [];
  const out = new Function("__mk", "PHOTODIAG", "document", body)(
    recCtx, { err: "" },
    { createElement: () => {
      const cx = recCtx();
      const c: any = { width: 0, height: 0, getContext: () => cx, ctx: cx };
      made.push(c);
      return c;
    } },
  ) as Env;
  out.ctx = recCtx;
  out.made = made;
  return out;
}

/** The token values as the built stylesheet declares them in the data-theme="dark" block. */
function darkThemeTokens(): Record<string, string> {
  const html = page();
  const at = html.indexOf(':root[data-theme="dark"]');
  assert.ok(at > 0, "the data-theme dark block is missing");
  const block = html.slice(at, at + 2400);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/**
 * THE APP'S OWN EFFORT-COLOUR LANGUAGE, EXECUTED — the one mapping and the three surfaces that read it.
 * ⚠️ NOT lifted into env(): none of this is the renderer, and mixing it in would let a card guard pass
 * because an app table happened to be present.
 */
type EffEnv = { [k: string]: any };
function effEnv(): EffEnv {
  const names = ["SESSION_EFFORT", "RUN_TYPES", "RUN_KIND", "EFFORT_WORD", "PRIMARY_TYPES"];
  const fns = ["sessionEffort", "effortVar", "effortOf", "runEffort", "runTypeEff", "runKind",
    "runKindColour", "logCalendarLegend"];
  const body = constOrder(names).map(liftConst).join("\n") + "\n" + fns.map(lift).join("\n") +
    "\nreturn { " + names.concat(fns).join(", ") + " };";
  return new Function(body)() as EffEnv;
}

/** Every member of SessionType, read out of the engine's own union rather than listed here. */
function sessionTypes(): string[] {
  // ⚠️ COMMENTS FIRST, AND THE MEMBER PATTERN TAKES DIGITS. Written the obvious way this read NINE of the
  // twelve: "vo2" does not match [a-z-]+, and the doc comment on "race" contains a semicolon ("on race
  // day; with a Wednesday race"), so slicing to the first one stopped the union two members early. A
  // derived collection that silently under-collects is a guard over the wrong set.
  const src = readFileSync(new URL("../src/domain/types.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const at = src.indexOf("export type SessionType =");
  assert.ok(at > 0, "SessionType is not in src/domain/types.ts");
  const decl = src.slice(at, src.indexOf(";", at));
  const out = [...decl.matchAll(/\|\s*"([a-z0-9-]+)"/g)].map((m) => m[1]!);
  assert.ok(out.length >= 12, "SessionType parsed as only " + out.length + " members: " + out.join(", "));
  assert.ok(out.includes("vo2") && out.includes("race") && out.includes("rest"),
    "the union parse is missing members: " + out.join(", "));
  return out;
}

/** The token values as the built stylesheet actually declares them for dark. */
function darkTokens(): Record<string, string> {
  const html = page();
  const at = html.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(at > 0, "the dark media block is missing");
  const block = html.slice(at, at + 2400);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

// ---- the palette ---------------------------------------------------------------------------------

test("BLOCKER: every colour the card commits to is the app's own dark token, not a neon of its own", () => {
  // ⚠️ THE CARD USED TO CARRY #38ffbe AND THE REFERENCES MEASURE #3bc8b2 / #36c2a8 — CIE-Lab dE 31.3
  // apart, which is a different colour rather than a shade. A canvas cannot use var() in fillStyle (the
  // assignment is silently ignored), so the literals are unavoidable; what is avoidable is their
  // drifting from the tokens, and an earlier version of the renderer's comment claimed a test file
  // pinned them when no such file had ever existed.
  const E = env();
  const T = darkTokens();
  const pairs: [string, string][] = [
    ["ground", "--bg"], ["inkSoft", "--ink-soft"], ["inkFaint", "--ink-faint"],
    ["accent", "--accent"], ["accentInk", "--accent-ink"], ["brass", "--brass"],
    ["fast", "--eff-moderate"], ["slow", "--eff-hard"],
  ];
  for (const [key, tok] of pairs) {
    assert.equal(E.SHARE_INK[key], T[tok],
      "SHARE_INK." + key + " is " + E.SHARE_INK[key] + " but " + tok + " is " + T[tok]);
  }
  assert.equal(E.SHARE_INK.ink, "#ffffff", "the references' primary text measures literally #ffffff");
  // And the neon is gone from the whole build, not merely unused by this object.
  const html = page();
  for (const dead of ["#38ffbe", "#3dffb0", "rgba(72,255,184", "rgba(56,255,190", "rgba(45,255,170"]) {
    assert.ok(!html.includes(dead), "the neon palette survives in the build: " + dead);
  }
  // ⚠️ AND THE RENDERER MAY NOT READ THE LIVE THEME. Resolving a token through getComputedStyle would
  // export a LIGHT card for a runner whose phone is in light mode, and every reference the card is built
  // to is deep ink. Measured in the browser: with documentElement's data-theme flipped to light the page
  // genuinely moved (--bg read #eef1f1 against #06110e) and the exported card was byte-identical, hash
  // bc971dee both ways, corner pixel [47,55,53] both ways.
  const seen = new Set<string>();
  const queue = ["drawShareCard", "shareCardModel"];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const b = lift(name);
    assert.ok(!/getComputedStyle|dataset\.theme|prefers-color-scheme/.test(b),
      name + " reads the live theme, so a light-mode runner exports a light card");
    for (const m of b.matchAll(/\b((?:card|share|draw)[A-Za-z0-9_]*)\s*\(/g)) {
      const c = m[1]!;
      if (!seen.has(c) && html.includes("function " + c + "(")) queue.push(c);
    }
  }
});

test("every text tier clears AA on the card's own ground, in the direction that matters", () => {
  // ⚠️ THE FAINT TIER WAS --eff-none AND IT FAILED. #6f7d76 on this ground is 4.45:1 — under AA — and
  // both it and --ink-faint read as "muted sage grey", so the failure is invisible to the eye that
  // chose it. Derived from the tokens rather than quoting ratios, so it re-checks itself if either moves.
  const E = env();
  const gl = E.shareRelLum(E.SHARE_INK.ground);
  for (const tier of ["ink", "inkSoft", "inkFaint", "accent", "unjudged", "fast", "slow", "brass"]) {
    const r = E.shareRatio(E.shareRelLum(E.SHARE_INK[tier]), gl);
    assert.ok(r >= 4.5, tier + " is " + r.toFixed(2) + ":1 on the ground, under AA");
  }
  // The accent is a BACKGROUND as well as a foreground: the pill's own label sits on it.
  const onAccent = E.shareRatio(E.shareRelLum(E.SHARE_INK.accentInk), E.shareRelLum(E.SHARE_INK.accent));
  assert.ok(onAccent >= 4.5, "the pill's own text is " + onAccent.toFixed(2) + ":1 on the accent");
});

// ---- the type ladder -----------------------------------------------------------------------------

test("the type ladder is a ladder, and the feed reflow only touches the rungs it should", () => {
  const E = env();
  const rungs = Object.keys(E.SHARE_TYPE);
  assert.equal(rungs.length, 14, "the type ladder has " + rungs.length + " rungs; it was measured at 14");
  for (const k of rungs) {
    const v = E.SHARE_TYPE[k];
    assert.ok(Number.isInteger(v) && v >= 12 && v <= 400, k + " is not a plausible export size: " + v);
  }
  // Descending, so "the rung above" means something.
  const vals = rungs.map((k) => E.SHARE_TYPE[k]);
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i]! <= vals[i - 1]!, "the ladder is not ordered at " + rungs[i]);
  // ⚠️ SHRINKING A LABEL AT EXPORT SIZE COSTS LEGIBILITY AND BUYS 4px. Only rungs above SHARE_TYPE.row
  // may carry a feed factor, and the guard is derived from that rung rather than from a list of names.
  for (const k of Object.keys(E.SHARE_TYPE_FEED)) {
    assert.ok(E.SHARE_TYPE[k] > E.SHARE_TYPE.row,
      k + " has a feed factor but is not above the row rung, so a 4:5 export loses legibility for nothing");
    assert.ok(E.SHARE_TYPE_FEED[k] > 0.6 && E.SHARE_TYPE_FEED[k] < 1,
      k + "'s feed factor is not a tighten: " + E.SHARE_TYPE_FEED[k]);
  }
  for (const k of rungs) {
    assert.equal(E.shareTypeSize(k, "story"), E.SHARE_TYPE[k], "story is not the base size for " + k);
    const feed = E.shareTypeSize(k, "feed");
    if (E.SHARE_TYPE_FEED[k]) assert.ok(feed < E.SHARE_TYPE[k], k + " does not tighten at 4:5");
    else assert.equal(feed, E.SHARE_TYPE[k], k + " changed size at 4:5 without a factor");
  }
});

// ---- exact export dimensions ---------------------------------------------------------------------

test("BLOCKER: an export is exactly 1080x1920 or exactly 1080x1350, and one place decides", () => {
  // ⚠️ NOTHING IN THE SUITE ASSERTED THIS BEFORE. The brief's completion gate names the two sizes and
  // the preflight recorded that no test anywhere checked an exported pixel dimension.
  const E = env();
  assert.deepEqual([E.cardGeom("story").W, E.cardGeom("story").H], [1080, 1920]);
  assert.deepEqual([E.cardGeom("feed").W, E.cardGeom("feed").H], [1080, 1350]);
  // Whatever the lane kind or the title, the CANVAS does not change size — only the content does.
  for (const kind of ["chart", "sentence", "none"]) {
    for (const t of [null, { size: 72, lines: ["A"] }, { size: 34, lines: ["A", "B"] }]) {
      assert.equal(E.cardGeom("story", kind, t).H, 1920, "a story canvas moved for " + kind);
      assert.equal(E.cardGeom("feed", kind, t).H, 1350, "a feed canvas moved for " + kind);
      assert.equal(E.cardGeom("story", kind, t).W, 1080);
    }
  }
  // ⚠️ AND THE ENCODER MUST NOT SCALE BY THE SCREEN. devicePixelRatio may not appear anywhere in the
  // card's own pipeline; the brief forbids it as the export contract in as many words.
  for (const fn of ["shareCardCanvas", "prepareShareCard", "canvasToShareFile", "drawShareCard"]) {
    assert.ok(!/devicePixelRatio/.test(lift(fn)), fn + " reads devicePixelRatio");
  }
  assert.match(lift("shareCardCanvas"), /Math\.round\(gm\.W \* S\)/, "the export size is not the geometry times the scale");
  assert.match(lift("shareCardCanvas"), /Math\.round\(gm\.H \* S\)/, "the export height is not the geometry times the scale");
  assert.match(lift("prepareShareCard"), /shareCardCanvas\(m, 1\)/, "the exported file is not built at 1x");
});

test("the story's critical region is the brief's own, and the quiet band is below it", () => {
  const E = env();
  const s = E.cardGeom("story").safe;
  assert.deepEqual([s.x0, s.x1, s.y0, s.y1], [64, 1016, 120, 1680],
    "the story safe region is not the brief's x 64-1016, y 120-1680");
  const f = E.cardGeom("feed").safe;
  assert.deepEqual([f.x0, f.x1], [64, 1016], "the feed's side margins differ from the story's");
  assert.ok(f.y1 > 1680 - 570, "the feed's safe region did not move with its shorter canvas");
});

// ---- full bleed ----------------------------------------------------------------------------------

test("BLOCKER: the frame, its clip, its neon border and the radial glows are gone", () => {
  // ⚠️ MEASURED FROM THE REAL EXPORT BEFORE THIS PHASE: the card clipped everything to a 24px-inset
  // rounded rect and stroked a 2.5px teal border with a 14px glow, closing at y1683 on a 1920 canvas
  // with 237px of bare ground beneath it. That is the brief's first named defect, twice over.
  const html = page();
  const draw = lift("drawShareCard");
  assert.ok(!/createRadialGradient/.test(draw), "the ground still carries radial glows");
  assert.ok(!/gm\.FB|\bFH\b/.test(draw), "the frame's constants survive in the renderer");
  assert.ok(!/rr\(g, 24, 24/.test(draw), "the inset rounded clip survives");
  assert.ok(!/FB:/.test(lift("cardGeom")), "cardGeom still publishes the frame's bottom");
  assert.ok(!html.includes("CARD.pipe") && !html.includes("pipe:"), "the piping colour survives");
  // ⚠️ NO GLOW ANYWHERE IN THE RENDERER, not just in drawShareCard. Derived by walking the closure, so
  // a shadow added to a sub-renderer later is caught by the same guard.
  const seen = new Set<string>();
  const queue = ["drawShareCard"];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const b = lift(name);
    // ⚠️ ONE EXEMPTION, AND IT IS THE SPEC'S OWN "local scrim/keyline" RATHER THAN A LOOSENING. The fade
    // across the top of the card is gone at the owner's instruction (2026-08-20), so the wordmark carries
    // its own edge — and an edge needs a halo under it to survive a field of white specks, which is the
    // ground that produced the recorded 2.09:1. The exemption is therefore stated as the two properties
    // that make a halo not a glow, and both are asserted rather than assumed: the shadow colour must be a
    // DEEP ink, and it must be paired with a keyline stroke. A bright shadow or a shadow with no keyline
    // under it is exactly the neon the brief forbids, and either one still fails here.
    if (name === "shareWordmark") {
      assert.match(b, /shadowColor = SHARE_WM_EDGE\.halo/,
        "the wordmark's halo is no longer the named deep one");
      assert.match(b, /strokeStyle = SHARE_INK\.keyline/,
        "the wordmark sets a shadow with no keyline under it, which is a glow");
      const halo = liftConst("SHARE_WM_EDGE");
      assert.match(halo, /halo: "rgba\(2, ?10, ?8/,
        "the halo is not the route's own deep ink: " + halo);
      continue;
    }
    assert.ok(!/shadowBlur|shadowColor/.test(b), name + " sets a shadow, so the card glows");
    for (const m of b.matchAll(/\b((?:card|share|draw)[A-Za-z0-9_]*)\s*\(/g)) {
      const c = m[1]!;
      if (!seen.has(c) && html.includes("function " + c + "(")) queue.push(c);
    }
  }
  assert.ok(seen.size >= 8, "the renderer closure collapsed to " + seen.size);
});

/** The five source shapes the fit ruling has to survive, plus what each one is here to catch. */
const FIT_SHAPES: [number, number, string][] = [
  [1200, 1800, "3:4 portrait, the ordinary phone photograph"],
  [2400, 1200, "4:3 landscape, the widest ordinary case"],
  [1500, 1500, "1:1 square"],
  [4000, 640, "a very wide panorama"],
  [640, 4000, "a very tall panorama, taller than 9:16"],
];

test("FILL covers the whole canvas, at every source shape and every crop", () => {
  // ⚠️ THIS IS WHAT COVER MEANS ARITHMETICALLY, AND IT IS NOW THE OPT-IN RATHER THAN THE DEFAULT. The
  // box is allowed to hang off the canvas; what it may never do is leave a gap, at any aspect, zoom or
  // pan. Read the contain test below for what the DEFAULT promises instead.
  const E = env();
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    for (const [w, h, why] of FIT_SHAPES) {
      for (const ox of [0, 0.5, 1]) for (const oy of [0, 0.5, 1]) for (const k of [1, 1.6, 3]) {
        const b = E.sharePhotoBox({ w, h, ox, oy, k, fill: true }, gm.W, gm.H);
        assert.ok(b.x <= 0.001 && b.y <= 0.001 && b.x + b.w >= gm.W - 0.001 && b.y + b.h >= gm.H - 0.001,
          "a gap at " + aspect + " " + why + " ox" + ox + " oy" + oy + " k" + k +
          " -> " + JSON.stringify(b));
        assert.equal(E.shareBoxLeavesGap(b, gm.W, gm.H), false, "fill reports a gap: " + why);
        // The source's own proportions survive: no distortion, ever.
        assert.ok(Math.abs((b.w / b.h) - (w / h)) < 1e-9, "the photograph is being distorted");
      }
    }
  }
  // ⚠️ AND FILL MODE STILL DRAWS EXACTLY ONE IMAGE AND TINTS NOTHING. A flat veil over all of the
  // picture was here for cohesion and is the arbitrary treatment the brief rejects. This is the
  // assertion the surround must not be allowed to weaken: it can only ever paint where the photograph
  // does not reach, so on a card with no gap there is nothing for it to do.
  const ctx = E.ctx();
  const gm = E.cardGeom("story");
  E.sharePhotoDraw(ctx, { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, fill: true, bitmap: {} }, gm);
  assert.deepEqual(ctx.calls("rect")[0], ["rect", 0, 0, 1080, 1920],
    "the photograph is clipped to less than the canvas");
  assert.equal(ctx.calls("drawImage").length, 1, "the photograph was not drawn once");
  assert.equal(ctx.calls("fillRect").length, 0, "the photograph is still being tinted edge to edge");
});

test("BLOCKER: the DEFAULT shows the whole photograph, and the card is still filled edge to edge", () => {
  // ⚠️ THE OWNER'S RULING OF 2026-08-19, AS ARITHMETIC: "i want the full photo the user uploads to be
  // shown". So at the default zoom every row and column of the source lands inside the canvas — the box
  // is INSIDE the card rather than hanging off it — and no pan can push any of it out, because an axis
  // with slack is centred and ignores the fraction entirely.
  const E = env();
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    for (const [w, h, why] of FIT_SHAPES) {
      for (const ox of [0, 0.5, 1]) for (const oy of [0, 0.5, 1]) {
        const b = E.sharePhotoBox({ w, h, ox, oy, k: 1 }, gm.W, gm.H);
        assert.ok(b.x >= -0.001 && b.y >= -0.001 && b.x + b.w <= gm.W + 0.001 && b.y + b.h <= gm.H + 0.001,
          "the photograph is being cut off at " + aspect + " " + why + " ox" + ox + " oy" + oy +
          " -> " + JSON.stringify(b));
        assert.ok(Math.abs((b.w / b.h) - (w / h)) < 1e-9, "the photograph is being distorted");
        // It is the LARGEST such fit: one axis touches an edge, or the picture is needlessly small.
        assert.ok(Math.abs(b.w - gm.W) < 0.001 || Math.abs(b.h - gm.H) < 0.001,
          "contain is not the largest fit at " + why + ": " + JSON.stringify(b));
        // ⚠️ AND A CONTAINED AXIS IS CENTRED WHATEVER THE FRACTION SAYS. Without this the drag inverts,
        // because the sign of the slack is the opposite of the cover case.
        const mid = E.sharePhotoBox({ w, h, ox: 0.5, oy: 0.5, k: 1 }, gm.W, gm.H);
        if (b.w < gm.W - 0.5) assert.ok(Math.abs(b.x - mid.x) < 0.001, "a contained x honoured the pan");
        if (b.h < gm.H - 0.5) assert.ok(Math.abs(b.y - mid.y) < 0.001, "a contained y honoured the pan");
      }
      // ⚠️ ZOOMING PAST THE FIT CROPS, WHICH IS THE RUNNER'S OWN CHOICE AND THE POINT OF LEAVING PINCH
      // ON — but it does NOT always reach cover, and the first version of this guard asserted that it
      // did. Measured into a story card, the zoom needed to cover is 1.19x for a 3:4 portrait, 3.56x for
      // 4:3 landscape, 1.78x for a square and 3.52x for a 9:21 tower — all inside the 4x pinch clamp —
      // and 11.1x for a 3:1 panorama, which is not. So the honest claim is that the surround shrinks
      // monotonically as the runner zooms; a panorama on a 9:16 card is what the Fill toggle answers in
      // one tap, and the fill test above proves that it does.
      let prev = Infinity;
      for (const k of [1, 1.5, 2, 3, 4]) {
        const z = E.sharePhotoBox({ w, h, ox: 0.5, oy: 0.5, k }, gm.W, gm.H);
        const gap = gm.W * gm.H - Math.min(gm.W, z.w) * Math.min(gm.H, z.h);
        assert.ok(gap < prev - 0.001 || gap <= 0.001,
          "zooming did not reveal more of the card at " + why + " k" + k + ": " + gap + " vs " + prev);
        prev = gap;
      }
      if (Math.max(w / h, h / w) < 4) {
        assert.equal(E.shareBoxLeavesGap(E.sharePhotoBox({ w, h, ox: 0.5, oy: 0.5, k: 4 }, gm.W, gm.H),
          gm.W, gm.H), false, "a 4x zoom in contain mode still leaves a gap at " + why);
      }
    }
  }
  // ⚠️ THE GAP IS FILLED BY A BLURRED COPY OF THE SAME PHOTOGRAPH, AND THE ORDER IS THE WHOLE POINT:
  // surround, then the veil that darkens it, then the photograph ON TOP. Reversed, the veil would land
  // on the runner's picture — which is the one thing the ruling forbids.
  const ctx = E.ctx();
  const gm = E.cardGeom("story");
  E.sharePhotoDraw(ctx, { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, id: "t1", bitmap: {} }, gm);
  const order = ctx.log.map((e: any[]) => e[0]).filter((n: string) => n === "drawImage" || n === "fillRect");
  assert.deepEqual(order, ["drawImage", "fillRect", "drawImage"],
    "the surround, its veil and the photograph are not drawn in that order: " + JSON.stringify(order));
  const veil = ctx.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => e[1]);
  assert.ok(veil.some((v: string) => /^rgba\(6,17,14,0\.\d+\)$/.test(v)),
    "the surround is veiled with something other than the card's own ground: " + JSON.stringify(veil));
  assert.ok(E.SHARE_BLUR.veil > 0 && E.SHARE_BLUR.veil < 1, "the surround's veil is opaque or absent");
  // ⚠️ AND THE SURROUND IS A BLUR, NOT A PLAIN ENLARGEMENT. It is built by drawing the photograph small
  // and then doubling it up; a single step would show its own interpolation, and no step at all would
  // put a sharp copy of the picture behind the picture.
  const small = ctx.log.filter((e: any[]) => e[0] === "drawImage").length;
  assert.ok(small >= 1, "nothing was drawn");
  const bg = env();
  const bc = bg.shareBlurBg({ w: 1200, h: 1800, id: "b1", bitmap: {} }, gm);
  assert.equal(bc.width, bg.SHARE_BLUR.w, "the cached surround is not at the documented size");
  assert.ok(bg.SHARE_BLUR.tiny * 4 < bg.SHARE_BLUR.w,
    "the surround is enlarged in too few steps to be a blur");
});

// ---- the conservative person ---------------------------------------------------------------------

test("the subject exclusion is two zones and it TRAVELS with the crop", () => {
  // ⚠️ READ OFF THE CANVAS CENTRE INSTEAD, IT WOULD GUARD EMPTY SKY the moment the runner panned their
  // photograph — which is the only reason a conservative rectangle is worth having at all.
  // ⚠️ THE PAN IS DEMONSTRATED IN FILL MODE BECAUSE A CONTAINED AXIS CANNOT BE PANNED AT ALL. Written
  // against the default it measured nothing and passed: a 4:3 source in a 9:16 card has horizontal slack,
  // so sharePhotoBox centres it and ox is ignored — the zone correctly did not move, and the guard read
  // that as the exclusion travelling. The claim has to be made where travel is possible.
  const E = env();
  const gm = E.cardGeom("story");
  const mid = E.shareSubjectZones(E.sharePhotoBox({ w: 2400, h: 1200, ox: 0.5, oy: 0.5, k: 1, fill: true }, gm.W, gm.H), gm);
  const left = E.shareSubjectZones(E.sharePhotoBox({ w: 2400, h: 1200, ox: 0, oy: 0.5, k: 1, fill: true }, gm.W, gm.H), gm);
  assert.ok(left.face.x > mid.face.x + 200,
    "the face zone did not move when the photograph did: " + mid.face.x + " -> " + left.face.x);
  // ⚠️ AND IT IS RECOMPUTED PER FIT MODE RATHER THAN INHERITED, which is the fit ruling's own
  // consequence for safety: contain puts the subject HIGHER and SMALLER on the card, so a rectangle
  // carried over from the cover fit would guard the wrong band of somebody's photograph.
  const whole = E.shareSubjectZones(E.sharePhotoBox({ w: 2400, h: 1200, ox: 0.5, oy: 0.5, k: 1 }, gm.W, gm.H), gm);
  assert.ok(whole.body.h < mid.body.h - 50,
    "the body zone is the same height in both fit modes: " + whole.body.h + " vs " + mid.body.h);
  assert.ok(whole.face.h < mid.face.h - 20,
    "the face zone is the same height in both fit modes: " + whole.face.h + " vs " + mid.face.h);
  // ⚠️ IT MOVES, AND WHICH WAY IT MOVES DEPENDS ON THE SHAPE — so this asserts displacement rather than
  // a direction. The brief predicted "higher and smaller"; measured, a 4:3 source in a 9:16 card goes
  // LOWER under contain, because the picture is centred in a tall card while the cover crop was pinned
  // to its top edge (face base y634 under fill, y868 under contain). "Smaller" holds everywhere and
  // "higher" does not, so a guard written to the prediction would have been wrong in the other
  // direction on a portrait source.
  const cy = (z: any) => z.y + z.h / 2;
  assert.ok(Math.abs(cy(whole.face) - cy(mid.face)) > 50,
    "the face zone did not move between the fit modes: " + cy(mid.face) + " -> " + cy(whole.face));
  assert.ok(whole.face.w > 0 && whole.body.w > 0, "a contain-mode subject zone is empty");
  assert.ok(mid.face.w > 0 && mid.face.h > 0 && mid.body.w > 0, "a subject zone is empty");
  // The face is inside the body's horizontal span and above its base: two rectangles, one person.
  assert.ok(E.SHARE_SUBJECT.face.u0 > E.SHARE_SUBJECT.body.u0, "the face zone is wider than the body");
  assert.ok(E.SHARE_SUBJECT.face.v1 <= E.SHARE_SUBJECT.body.v1, "the face zone reaches below the body");
  assert.ok(E.SHARE_SUBJECT.pad > 0, "the exclusion carries no padding");
  // Clipped to the canvas: a zone half off the card cannot be collided with off it.
  for (const z of [mid.face, mid.body, left.face, left.body]) {
    assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= gm.W + 0.001 && z.y + z.h <= gm.H + 0.001,
      "a subject zone escapes the canvas: " + JSON.stringify(z));
  }
});

test("BLOCKER: the route is placed by score, the clearest zone still wins, and it CANNOT refuse for want of a safe one", () => {
  // ⚠️⚠️ THE REFUSAL WAS REMOVED ON THE OWNER'S OWN INSTRUCTION (2026-08-20): "it doesn't matter if the
  // route line sits over the top of their photo." On his screenshot the route was ABSENT from a photo
  // card, because the conservative centre-person exclusion had vetoed all four candidate columns while
  // the switch labelled "show my route" was on — the looks-live-does-nothing defect, arrived at by a
  // safety rule eating the feature. So this test asserts the OPPOSITE of what it used to, deliberately,
  // and its other half — that a clear column is still preferred — is the part he did not ask to change.
  const E = env();
  const gm = E.cardGeom("story");
  const box = E.sharePhotoBox({ w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1 }, gm.W, gm.H);
  const sub = E.shareSubjectZones(box, gm);
  const copy = E.shareRect(0, 1200, gm.W, gm.H - 1200);
  const z = E.shareRoutePlacement(gm, { photoBox: box, top: gm.safe.y0, bottom: 1160, textRects: [copy] });
  assert.ok(z, "no zone was found on an ordinary centred portrait");
  assert.equal(E.shareRectOverlap(z.rect, sub.face), 0,
    "the clearest column was available and the scorer did not prefer it");
  assert.equal(E.shareRectOverlap(z.rect, copy), 0, "the chosen zone crosses the copy");
  assert.ok(E.shareRectInside(z.rect, E.shareRect(gm.M, gm.safe.y0, gm.W - 2 * gm.M, gm.safe.y1 - gm.safe.y0)),
    "the chosen zone is outside the safe region");
  // ⚠️ AND A SUBJECT THAT LEAVES NO CLEAR COLUMN AT ALL STILL GETS A ROUTE. A wide source enlarged to
  // cover puts the assumed person across the whole canvas width, which is what made shareZoneRect answer
  // null for all four candidates — measured before the fallback, the scorer refused on 6 of 10
  // source-shape/aspect combinations in fill mode.
  const wide = E.sharePhotoBox({ w: 2400, h: 1200, ox: 0.5, oy: 0.5, k: 1, fill: true }, gm.W, gm.H);
  const wsub = E.shareSubjectZones(wide, gm);
  assert.ok(wsub.face.w > gm.W * 0.9,
    "the fixture's assumed face does not span the card, so it cannot exercise the case that failed");
  const wz = E.shareRoutePlacement(gm, { photoBox: wide, top: gm.safe.y0, bottom: 1160, textRects: [copy] });
  assert.ok(wz, "a photograph whose assumed subject fills the width lost its route entirely");
  assert.equal(E.shareRectOverlap(wz.rect, copy), 0, "the fallback band crosses the copy");
  assert.ok(E.shareRectInside(wz.rect, E.shareRect(gm.M, gm.safe.y0, gm.W - 2 * gm.M, gm.safe.y1 - gm.safe.y0)),
    "the fallback band is outside the safe region");
  // ⚠️ TEXT IS STILL HARD, AND THAT IS A DIFFERENT RULE FROM THE ONE HE CHANGED. "Over the photograph" is
  // what he asked for; a route through the distance hero is not a route, it is a mess, and no reference
  // card does it. With every candidate AND the whole band covered by copy the answer is still nothing.
  const all = E.shareRect(0, 0, gm.W, gm.H);
  assert.equal(E.shareRoutePlacement(gm, { photoBox: box, textRects: [all] }), null,
    "a zone was returned when the card's own copy covered every candidate and the whole band");
  // ⚠️ THE ORDER IN SHARE_ROUTE_ZONES IS THE PREFERENCE, and a tie must not be decided by iteration
  // luck: with nothing in the way at all, the first candidate wins.
  const open = E.shareRoutePlacement(gm, { top: gm.safe.y0, bottom: gm.safe.y1, textRects: [] });
  assert.equal(open.id, E.SHARE_ROUTE_ZONES[0], "an unobstructed card did not take the first candidate");
  assert.equal(E.SHARE_ROUTE_ZONES[0], "upper-right", "the reference cards put the route upper-right");
});

test("BLOCKER: the face is still preferred over the torso, and neither can refuse a zone", () => {
  // ⚠️ THE BRIEF DRAWS TWO DIFFERENT LINES — "never cover the face", "avoid the torso where a viable
  // alternative exists" — and the owner's ruling turns the first into a strong preference rather than a
  // limit. One weight for both would then be wrong: at equal coverage a zone crossing the assumed FACE
  // must always be the worse trade, or a face crossing could tie with a chest crossing and win on
  // iteration order.
  const E = env();
  const gm = E.cardGeom("story");
  const r = E.shareRect(gm.M, 200, 300, 300);
  const soft = (rect: any, w: number) => [{ rect, w }];
  const clear = E.shareZoneScore(r, gm, [], []);
  assert.equal(clear, 1, "an unobstructed zone does not score 1");
  // A fifth of the zone over the torso: a real cost, and still usable if nothing better exists.
  const nick = E.shareZoneScore(r, gm, [], soft(E.shareRect(gm.M, 200, 60, 300), E.SHARE_ZONE_PEN.body));
  assert.ok(nick > 0 && nick < clear, "a torso overlap is not a penalty: " + nick);
  // ⚠️ AND THE SAME COVERAGE OF THE FACE COSTS STRICTLY MORE. This is the whole of what survives of the
  // old veto, and it is what stops the route being drawn through somebody's face when a clearer
  // placement is free.
  const faceNick = E.shareZoneScore(r, gm, [], soft(E.shareRect(gm.M, 200, 60, 300), E.SHARE_ZONE_PEN.face));
  assert.ok(faceNick < nick, "the same coverage of the face costs no more than the torso: " +
    faceNick + " vs " + nick);
  assert.ok(E.SHARE_ZONE_PEN.face > 1,
    "a fully covered face scores the same as a fully covered torso, so the two can tie");
  assert.ok(E.SHARE_ZONE_PEN.body === 1, "the torso's weight is no longer the unit the face is measured against");
  // ⚠️ AND NEITHER IS A REFUSAL. Two thirds of the zone over the torso used to score -1; it now scores
  // low and stays usable, because the alternative is no route at all.
  const half = E.shareZoneScore(r, gm, [], soft(E.shareRect(gm.M, 200, 200, 300), E.SHARE_ZONE_PEN.body));
  assert.ok(half >= 0 && half < nick, "two thirds of the zone over the torso is a refusal: " + half);
  const buried = E.shareZoneScore(r, gm, [], soft(r, E.SHARE_ZONE_PEN.face));
  assert.equal(buried, 0, "a fully covered zone is refused rather than scoring worst: " + buried);
  // ⚠️ AND ONLY TWO THINGS CAN STILL SAY -1: the card's own copy, and a zone outside the safe region.
  assert.equal(E.shareZoneScore(r, gm, [E.shareRect(gm.M, 200, 10, 10)], []), -1,
    "a hard rectangle is not a veto");
  assert.equal(E.shareZoneScore(E.shareRect(0, 0, 300, 300), gm, [], []), -1,
    "a zone outside the safe region is usable");
  assert.equal(E.shareZoneScore(null, gm, [], []), -1, "a zone that could not be built scores as usable");
});

test("BLOCKER: the fallback band avoids the copy and refuses only on its own geometry", () => {
  // ⚠️ THE SECOND WAY A ROUTE COULD BE REFUSED WAS NOT THE SCORER, AND REMOVING THE VETO ALONE WOULD NOT
  // HAVE FIXED THE OWNER'S SCREENSHOT. shareZoneRect returns null when the free column beside the
  // obstacles is narrower than SHARE_ZONE_MIN_W, so on a centre-person photograph in fill mode all four
  // candidates come back null before anything is scored. This is the band itself.
  const E = env();
  const gm = E.cardGeom("story");
  const wm = E.shareRect(64, 96, 200, 44);
  const b = E.shareRouteFallback(gm, gm.safe.y0, 1160, [wm]);
  assert.ok(b, "the fallback refused an ordinary card");
  assert.equal(b.rect.x, gm.M, "the band is not on the card's own margin");
  assert.equal(b.rect.w, gm.W - 2 * gm.M, "the band is not the card's own content width");
  assert.equal(E.shareRectOverlap(b.rect, wm), 0, "the band crosses the wordmark");
  assert.ok(b.rect.y >= wm.y + wm.h, "the band starts above the wordmark it is meant to clear");
  // a rect in the lower half pulls the band's BOTTOM up rather than pushing its top down
  const low = E.shareRect(64, 1000, 900, 100);
  const b2 = E.shareRouteFallback(gm, gm.safe.y0, 1160, [wm, low]);
  assert.equal(E.shareRectOverlap(b2.rect, low), 0, "the band crosses copy in its lower half");
  assert.ok(b2.rect.y + b2.rect.h <= low.y, "the band was not shortened from the bottom");
  // ⚠️ IT REFUSES ONLY ON HEIGHT, AND THAT IS A STATEMENT ABOUT THE CARD'S GEOMETRY RATHER THAN ABOUT
  // SOMEBODY'S PHOTOGRAPH. A band thinner than this is a smear, not a picture of a route.
  assert.equal(E.shareRouteFallback(gm, 400, 400 + E.SHARE_ZONE_MIN_H - 1, []), null,
    "a band too thin to draw a route in was returned anyway");
  assert.ok(E.shareRouteFallback(gm, 400, 400 + E.SHARE_ZONE_MIN_H, []),
    "a band exactly at the floor was refused");
  assert.ok(E.SHARE_ZONE_MIN_H > 60, "the height floor is low enough to be no floor at all");
  // ⚠️ AND THE SUBJECT IS NOT CONSULTED HERE AT ALL. By the time this is reached every placement crosses
  // it, and choosing between them is the scoring that has already happened.
  const src = lift("shareRouteFallback");
  assert.ok(!/photoBox|subject|face|body/i.test(src),
    "the fallback consults the subject, so it is a second scorer rather than a last resort");
});

// ---- adaptive contrast ---------------------------------------------------------------------------

/**
 * THE ARITHMETIC THIS FILE CHECKS THE SOLVER AGAINST, WRITTEN OUT FROM FIRST PRINCIPLES.
 *
 * ⚠️ DELIBERATELY NOT THE APP'S OWN HELPERS. A test that composites with shareRelLumRGB agrees with the
 * renderer by construction, which is how the flattened-luma defect survived: the guard reused the same
 * wrong model. Channel by channel, linearised per channel, weights written here.
 */
function trueLum(c: number[]): number {
  const f = (v: number) => { const s = Math.max(0, Math.min(255, v)) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
}
function rat(a: number, b: number): number {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
function hexRGB(hex: string): number[] {
  const h = String(hex).replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

test("BLOCKER: the solved veil alpha reaches its ratio over a COLOURED ground, not just a grey one", () => {
  // ⚠️⚠️ THIS TEST'S PREVIOUS VERSION SWEPT SEVEN GREY BYTES AND WAS STRUCTURALLY INCAPABLE OF FAILING.
  // The solver carried the ground as a weighted-average BYTE and linearised it afterwards, which is exact
  // for a neutral and one-directionally wrong for everything else — so over a saturated red ground it
  // asked for NO scrim at all and the three type tiers delivered 4.00 / 1.94 / 1.91 against a 4.5 bar.
  // Every probe in this file was built with new Uint8ClampedArray(...).fill(lum), i.e. R=G=B: the exact
  // family of values the wrong model gets right. The guard-blind-to-the-new-input trap, in the one place
  // a scalar looked obviously sufficient. It sweeps a colour cube now, and the composite is redone here
  // per channel from first principles rather than through the app's own helper.
  const E = env();
  const ink = hexRGB(E.SHARE_INK.ground);
  const CUBE: number[][] = [];
  for (const r of [0, 64, 128, 192, 255]) for (const g of [0, 64, 128, 192, 255])
    for (const b of [0, 64, 128, 192, 255]) CUBE.push([r, g, b]);
  const tiers = [E.SHARE_INK.ink, E.SHARE_INK.accent, E.SHARE_INK.inkSoft, E.SHARE_INK.inkFaint,
    E.SHARE_INK.fast, E.SHARE_INK.slow];
  let worst = 99, worstAt = "";
  for (const hex of tiers) {
    const fg = trueLum(hexRGB(hex));
    for (const target of [3, 3.2, 4.5]) {
      for (const gc of CUBE) {
        const a = E.shareVeilAlphaFor(hex, gc, target);
        const got = rat(fg, trueLum([0, 1, 2].map((i) => a * ink[i]! + (1 - a) * gc[i]!)));
        // A ceiling is not a failure: inkFaint on the flat ground is 6.50:1 and cannot reach 7 at any
        // alpha. Pinned to alpha 1 so a solver that simply gives up early still fails.
        assert.ok(got >= target - 0.02 || a >= 1,
          hex + " target " + target + " on ground " + gc.join(",") + ": alpha " + a +
          " delivers " + got.toFixed(2));
        if (got / target < worst / target) { worst = got; worstAt = hex + " on " + gc.join(","); }
        // ⚠️ AND IT IS THE MINIMUM FOR THE TARGET IT AIMS AT, WHICH IS THE TARGET TIMES THE MARGIN. The
        // solver deliberately overshoots the requested ratio by SHARE_SCRIM_MARGIN, because the ground it
        // is handed is a tenth-scale average — see that constant's note. Written against the RAW target
        // this read as "the alpha is not minimal" the moment the margin arrived, which is the ruler no
        // longer measuring the thing rather than a fault.
        const aim = target * E.SHARE_SCRIM_MARGIN;
        if (a > 0) {
          const less = Math.max(0, a - 0.02);
          const w = rat(fg, trueLum([0, 1, 2].map((i) => less * ink[i]! + (1 - less) * gc[i]!)));
          assert.ok(w < aim + 0.35, "the alpha is not minimal for " + hex + " aim " + aim.toFixed(2) +
            " ground " + gc.join(","));
        }
        // ⚠️ AND THE MARGIN IS DELIVERED, not merely asked for: measured from rendered pixels the eyebrow
        // sat at 4.41 against a 4.5 target before it existed, so a solver that quietly dropped it would
        // pass every other guard in this file.
        assert.ok(got >= aim - 0.02 || a >= 1, hex + " on " + gc.join(",") + ": alpha " + a +
          " delivers " + got.toFixed(2) + " against an aim of " + aim.toFixed(2));
      }
    }
  }
  // ⚠️ AND THE SATURATED CASES ARE NAMED, so a future cube that happens to miss them still fails here.
  // These are the six the old model refused outright; the alpha it asked for is quoted beside each.
  const REFUSED: [number[], number][] = [[[255, 0, 0], 0.00], [[255, 0, 255], 0.06], [[0, 0, 255], 0.00],
    [[0, 255, 0], 0.68], [[178, 58, 42], 0.18], [[255, 140, 0], 0.62]];
  for (const [gc, old] of REFUSED) {
    const a = E.shareVeilAlphaFor(E.SHARE_INK.inkSoft, gc, 4.5);
    const got = rat(trueLum(hexRGB(E.SHARE_INK.inkSoft)),
      trueLum([0, 1, 2].map((i) => a * ink[i]! + (1 - a) * gc[i]!)));
    assert.ok(got >= 4.48, "ground " + gc.join(",") + " delivers " + got.toFixed(2));
    assert.ok(a > old + 0.01, "ground " + gc.join(",") + ": the solver is back to the flattened model, " +
      "which asked " + old + " and this asks " + a);
  }
  // ⚠️ THE WEIGHTS EXIST IN EXACTLY ONE PLACE, which is what stops the two models diverging again — the
  // ground was averaged in the encoded space while the foreground was linearised properly, and that was
  // two copies of these three numbers doing two different things.
  const src = page();
  const at = src.indexOf("function shareRelLum(");
  const region = src.slice(src.indexOf("// ---- luminance,"), src.indexOf("function shareVeilPlan("));
  assert.ok(at > 0 && region.length > 500, "the luminance section moved");
  for (const w of ["0.2126", "0.7152", "0.0722"]) {
    const n = (region.match(new RegExp(w.replace(".", "\\."), "g")) || []).length;
    assert.equal(n, 1, "the channel weight " + w + " appears " + n + " times in the luminance section; " +
      "one of them is a second luminance model waiting to disagree with SHARE_LUMW");
  }
  assert.deepEqual(E.SHARE_LUMW, [0.2126, 0.7152, 0.0722], "SHARE_LUMW is not the WCAG weights");
  // Monotone in a grey ground, or a brighter photograph could ask for less treatment.
  let prev = -1;
  for (let l = 0; l <= 255; l += 5) {
    const a = E.shareVeilAlphaFor(E.SHARE_INK.ink, [l, l, l], 4.5);
    assert.ok(a >= prev - 1e-9, "the solver is not monotone in the ground at luma " + l);
    prev = a;
  }
  assert.equal(E.shareVeilAlphaFor(E.SHARE_INK.ink, [0, 0, 0], 4.5), 0, "a black ground is being darkened");
  // ⚠️ PER-COLOUR, AND THE ACCENT IS THE DEMANDING ONE. It is a mid-tone, so one alpha for both would
  // either over-darken the picture or under-serve the teal.
  assert.ok(E.shareVeilAlphaFor(E.SHARE_INK.accent, [236, 236, 236], 4.5) >
    E.shareVeilAlphaFor(E.SHARE_INK.ink, [236, 236, 236], 4.5),
    "the accent is being treated as if it were white");
  assert.ok(worst >= 2.98, "the worst delivered ratio across the cube is " + worst.toFixed(2) +
    " at " + worstAt);
});

test("BLOCKER: the ground is sampled as a colour, and the brightest one by TRUE luminance", () => {
  // ⚠️ THE SAMPLER RANKED PIXELS ON A WEIGHTED BYTE AND THEN THREW THE CHROMA AWAY, so the solver could
  // not have recovered it even if it wanted to. On a magenta pixel the old answer was byte 73 — a dark
  // grey — for a colour whose real luminance is that of a mid grey.
  const E = env();
  const gm = E.cardGeom("story");
  const mk = (px: number[][]) => {
    const d = new Uint8ClampedArray(px.length * 4);
    px.forEach((c, i) => { d[i * 4] = c[0]!; d[i * 4 + 1] = c[1]!; d[i * 4 + 2] = c[2]!; d[i * 4 + 3] = 255; });
    return { w: px.length, h: 1, data: d };
  };
  const all = E.shareRect(0, 0, gm.W, gm.H);
  // A dark grey and a saturated magenta in one probe: magenta is the brighter of the two and must win.
  assert.deepEqual(E.shareGroundUnder(mk([[73, 73, 73], [255, 0, 255]]), gm, all), [255, 0, 255],
    "the sampler ranked on a weighted byte, so it picked the grey");
  // Pure blue is genuinely darker than mid grey and must NOT win.
  assert.deepEqual(E.shareGroundUnder(mk([[128, 128, 128], [0, 0, 255]]), gm, all), [128, 128, 128],
    "the sampler thinks pure blue is brighter than mid grey");
  // ⚠️ AND IT ANSWERS WHITE WHEN IT CANNOT LOOK. getImageData refuses on a tainted canvas; a photograph
  // the runner chose is same-origin so this should never fire, but the safe direction is not optional and
  // the unsafe one is illegible text on a picture that has already left the phone.
  assert.deepEqual(E.shareGroundUnder(null, gm, all), [255, 255, 255],
    "a missing probe is being read as darkness");
  assert.deepEqual(E.shareGroundUnder({ w: 4, h: 7, data: null }, gm, all), [255, 255, 255],
    "a failed probe is being read as darkness");
  assert.match(lift("shareLumaProbe"), /catch/, "the probe has no failure path at all");
  // A bare number is the grey it actually is, and nothing in the renderer may hand one over.
  assert.deepEqual(E.shareGroundRGB(200), [200, 200, 200], "a grey ground is not a grey triple");
  // ⚠️ ONE READER OF THE SAMPLER NOW, WHERE THERE WERE TWO. The wordmark's band used to be sampled and
  // solved as well; the fade across the top is gone at the owner's instruction and the wordmark carries a
  // keyline, which needs no sample at all — that is the point of it, since the 2.09:1 defect was a sample
  // that missed. So this sweep names the scrim that remains, and a second sampler arriving later has to
  // be added here deliberately.
  for (const fn of ["shareVeilPlan"]) {
    assert.match(lift(fn), /shareGroundUnder\(probe, gm,/,
      fn + " no longer takes its ground from the sampler");
  }
  assert.ok(!/shareGroundUnder/.test(lift("shareWordmark") + lift("shareWordmarkPlan")),
    "the wordmark is sampling the ground again; its whole point is that it does not need to");
});

test("BLOCKER: the copy's first line sits on MORE than the solved alpha, not exactly on it", () => {
  // ⚠️ SOLVE AT THE MIDDLE OR THE MEAN AND THE FIRST LINE — the largest type on the card — IS THE ONE
  // LEFT UNDERSERVED. Three stops, monotone, with the solved alpha arriving just ABOVE the block's top.
  //
  // ⚠️ THIS TEST'S PREVIOUS VERSION PINNED THE STOP'S POSITION TO blockTop, AND THAT WAS A KNIFE EDGE
  // DRESSED AS A GUARANTEE. Measured on the eyebrow — the element that starts the block — the delivered
  // ratio was 4.52 against a 4.5 target at its exact cap box and 4.31 with the 6px halo any pixel
  // measurement needs to find ground between letterforms. Restated to the INVARIANT the promise is
  // about: interpolate the real gradient at the top of the copy and require it to exceed the alpha that
  // was solved for. A stop pinned to a position cannot express that; this fails if the knee is removed.
  const E = env();
  const gm = E.cardGeom("story");
  const probe = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(240) };
  const plan = E.shareVeilPlan(probe, gm, { blockTop: 1200, fade: 280, colours: [{ hex: E.SHARE_INK.ink, target: 4.5 }] });
  assert.ok(plan.a > 0, "a bright photograph earned no veil");
  assert.ok(plan.end >= plan.a, "the veil gets weaker further down the card");
  assert.equal(plan.fadeTop, 920, "the fade does not start where it was asked to");
  assert.ok(E.SHARE_VEIL_STEPS.includes(plan.step), "the plan's step is not one of the named ones");
  const ctx = E.ctx();
  E.shareVeilDraw(ctx, gm, plan);
  const stops = ctx.log.filter((e: any[]) => e[0] === "stop");
  // ⚠️ THIS USED TO PIN THE COUNT AT THREE AND THE RULING OF 2026-08-21 BROKE IT — the fade is sampled
  // now, so the straight line between the first two stops has become a curve. The claim this test is
  // about is unaffected and is the interpolation below; what is asserted here is the ENDS and the fact
  // that there is more than a straight line, because a count of three IS the artefact the owner reported
  // seeing. The count itself belongs to the ease's own guard, which owns SHARE_SCRIM.stops.
  assert.ok(stops.length > 3, "the veil is a three-stop gradient again, so its fade is one straight line " +
    "from nothing to the solved alpha — which is the edge ruling 8 removed");
  assert.equal(stops[0][1], 0, "the gradient does not begin at the top of the fade");
  assert.equal(stops[stops.length - 1][1], 1, "the gradient does not reach the bottom of the canvas");
  const alphaOf = (s: string) => parseFloat((/,([0-9.]+)\)$/.exec(String(s)) || ["", "0"])[1]!);
  const off = stops.map((s: any[]) => s[1] as number), av = stops.map((s: any[]) => alphaOf(s[2]));
  assert.ok(av[1]! >= av[0]! && av[2]! >= av[1]!, "the gradient is not monotone: " + av.join(","));
  // The gradient is drawn from fadeTop to the canvas bottom; interpolate it at the top of the copy.
  const at = (y: number) => {
    const f = (y - plan.fadeTop) / (gm.H - plan.fadeTop);
    for (let i = 1; i < off.length; i++) {
      if (f <= off[i]!) return av[i - 1]! + (av[i]! - av[i - 1]!) * (f - off[i - 1]!) / (off[i]! - off[i - 1]!);
    }
    return av[av.length - 1]!;
  };
  assert.ok(at(plan.blockTop) > plan.a + 1e-6, "the first line of copy sits on exactly the solved alpha (" +
    at(plan.blockTop).toFixed(4) + " against " + plan.a + "), so the promise has no margin at all");
  assert.ok(E.SHARE_SCRIM.knee > 0 && E.SHARE_SCRIM.knee <= 24,
    "the knee is " + E.SHARE_SCRIM.knee + ": either absent, or deep enough to be a design change");
  // And it never overshoots: the knee may not push the solved alpha above the deepest stop.
  assert.ok(at(plan.blockTop) <= plan.end + 1e-6, "the knee has made the copy's top darker than the foot");
  // A dark photograph earns nothing at all, which is what every reference shows.
  const dark = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(8) };
  const none = E.shareVeilPlan(dark, gm, { blockTop: 1200, colours: [{ hex: E.SHARE_INK.ink, target: 4.5 }] });
  assert.equal(none.kind, "none", "a dark photograph is being veiled anyway");
  const c2 = E.ctx();
  E.shareVeilDraw(c2, gm, none);
  assert.equal(c2.log.length, 0, "a 'none' plan still drew something");
});

test("BLOCKER: the scrim is a gradient and nothing else, at every COLOUR a photograph can have", () => {
  // ⚠️ THE OWNER'S AMENDMENT, 2026-08-19, AS A MECHANISM RATHER THAN A HABIT. He asked for "the full
  // picture to be in view....the data and text should always be just an overlay", so no card may end its
  // photograph. There used to be a second pass in shareVeilDraw — a flat rectangle of ground from the
  // block's top to the canvas bottom whenever the alpha reached 1 — and two templates asked for it by
  // name. Both the branch and the request are gone: the ONLY thing this function may emit is one
  // gradient-filled rect, whatever the photograph.
  const E = env();
  const gm = E.cardGeom("story");
  assert.ok(E.SHARE_SCRIM.max < 1, "the cap is 1, so a photograph can still be covered completely");
  const hungry = [E.SHARE_INK.ink, E.SHARE_INK.accent, E.SHARE_INK.inkSoft, E.SHARE_INK.inkFaint]
    .map((hex) => ({ hex: hex, target: 4.5 }))
    .concat([{ hex: E.SHARE_INK.fast, target: 3.2 }, { hex: E.SHARE_INK.slow, target: 3.2 }]);
  // ⚠️ GREYS AND COLOURS. This sweep used to be 52 grey bytes, which is the family the flattened solver
  // got right, so it could not see the defect that made a magenta photograph carry a 1.68:1 wordmark. It
  // also asserts the DELIVERED ratio now, recomputed per channel here, rather than only that an alpha
  // came back inside the cap.
  const inkRGB = hexRGB(E.SHARE_INK.ground);
  const cases: number[][] = [];
  for (let lum = 0; lum <= 255; lum += 5) cases.push([lum, lum, lum]);
  for (const c of [[255, 0, 0], [255, 0, 255], [0, 255, 0], [0, 0, 255], [0, 255, 255], [255, 255, 0],
    [178, 58, 42], [216, 255, 20], [224, 21, 200], [255, 140, 0], [120, 20, 160], [20, 200, 120]]) cases.push(c);
  for (const gc of cases) {
    const lum = gc.join(",");
    const probe = { w: 2, h: 1, data: new Uint8ClampedArray([gc[0]!, gc[1]!, gc[2]!, 255, 0, 0, 0, 255]) };
    const plan = E.shareVeilPlan(probe, gm, { blockTop: 1200, colours: hungry });
    assert.ok(plan.a <= E.SHARE_SCRIM.max + 1e-9, "luma " + lum + ": the scrim solved " + plan.a +
      ", over the cap that keeps the photograph visible");
    assert.ok(plan.end <= E.SHARE_SCRIM.max + 1e-9, "luma " + lum + ": the deepest stop is " + plan.end);
    assert.ok(plan.a < 1 && plan.end < 1, "luma " + lum + ": the photograph is fully covered somewhere");
    // The delivered ratio, from the composite this file computes itself.
    const bg = trueLum([0, 1, 2].map((i) => plan.a * inkRGB[i]! + (1 - plan.a) * gc[i]!));
    for (const c of hungry) {
      const got = rat(trueLum(hexRGB(c.hex)), bg);
      assert.ok(got >= c.target - 0.02 || plan.a >= E.SHARE_SCRIM.max - 1e-9,
        "ground " + lum + ": " + c.hex + " delivers " + got.toFixed(2) + " against " + c.target);
    }
    const ctx = E.ctx();
    E.shareVeilDraw(ctx, gm, plan);
    const rects = ctx.calls("fillRect");
    assert.ok(rects.length <= 1, "luma " + lum + ": the scrim drew " + rects.length +
      " rects, so one of them is a plate over the picture");
    for (const st of ctx.log.filter((e: any[]) => e[0] === "fillStyle")) {
      assert.ok(typeof st[1] !== "string" || !/^#|^rgba\(\d+,\d+,\d+,1\)$/.test(String(st[1])),
        "luma " + lum + ": the scrim filled with the flat colour " + st[1]);
    }
  }
  // ⚠️ AND THE CAP COSTS NOTHING ON A REAL CARD, which is the reason it is safe to have. On the worst
  // ground there is — pure white — the hungriest colour still solves under it, so no card in the family
  // is one byte different for its presence.
  const white = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(255) };
  const worst = E.shareVeilPlan(white, gm, { blockTop: 1200, colours: hungry });
  assert.ok(worst.a < E.SHARE_SCRIM.max, "a white photograph is being clamped rather than solved: " +
    worst.a + " against a cap of " + E.SHARE_SCRIM.max);
  // ⚠️ AND THE HEADROOM IS NOW 0.02, WHICH IS A REAL CONSTRAINT AND IS RECORDED HERE RATHER THAN
  // DISCOVERED LATER. The hungriest colour on a pure-white photograph needed 0.78 before the scrim
  // margin existed and needs 0.90 with it, against a cap of 0.92 — so the margin cannot be raised again
  // without the CLAMP deciding the answer instead of the solver, and the clamp cannot be lowered at all.
  // The pair is what this asserts: raise either and one of these two numbers moves into the other.
  assert.ok(worst.a >= 0.88 && worst.a <= 0.90,
    "the solved alpha on a white photograph is " + worst.a + ", not the measured 0.90 — the scrim " +
    "margin or the ink tiers have moved, and the 0.02 of headroom under the cap has to be re-measured");
  // There is no kind left that asks for an opaque lower section.
  assert.ok(!/opaque/.test(lift("shareVeilPlan")), "shareVeilPlan still honours an opaque request");
  assert.ok(!/fillRect/.test(lift("shareVeilDraw").replace(/g\.fillStyle = grad; g\.fillRect[^;]*;/, "")),
    "shareVeilDraw fills something other than the gradient");
});

test("BLOCKER: every photo template goes through the one scrim, and none of them names a fade", () => {
  // ⚠️ THREE LAYOUTS, ONE SYSTEM. The fade used to be a literal — 280 on The Moment and 320 on the other
  // two, with nothing deciding which — so a fifth template would have picked one by eye. It is derived
  // from the block's own height now, which is what "sized from where the content starts" means.
  const cl = closure("drawShareCard");
  // ⚠️ ALL FOUR NOW, INCLUDING THE POSTER. The owner's ruling of 2026-08-20 made it photo-optional, so it
  // composites a photograph exactly as the other three do and has to take the same one scrim. It used to
  // be excluded here BY NAME, which was right while it could not carry a picture and would now be the
  // one template compositing somebody's photograph with no solved veil at all.
  for (const name of ["shareMomentCard", "shareExecutionCard", "shareProgressionCard", "sharePosterCard"]) {
    const b = cl.get(name)!;
    assert.match(b, /sharePhotoScrim\(g, gm, probe, p\.blockTop,/,
      name + " does not take the shared scrim, or hands it something other than its own block top");
    assert.ok(!/shareVeilDraw|shareVeilPlan/.test(b),
      name + " reaches past sharePhotoScrim into the plan or the draw");
    assert.ok(!/fade:/.test(b), name + " names a fade of its own");
    assert.ok(!/kind: "opaque"/.test(b), name + " still asks for an opaque lower section");
  }
  // ⚠️ AND A CARD WITH NO PHOTOGRAPH IS STILL NOT SCRIMMED — the gate is inside sharePhotoScrim, on the
  // probe, rather than at four call sites each remembering to check. shareGroundUnder answers 255 when it
  // cannot look, so solved from a null probe the poster's matte ground would wear a dark band over type
  // that already measures 19:1 on it.
  assert.match(cl.get("sharePhotoScrim")!, /if \(!probe\) return/,
    "the scrim no longer refuses a card with no photograph, so the matte ground is solved from white");
  const E = env();
  const g = E.ctx();
  // ⚠️ DERIVED, AND THE PROOF IS THAT THE THREE REAL BLOCK TOPS GIVE THREE DIFFERENT FADES. A constant
  // passes "the fade exists"; only the spread shows it is a function of the layout.
  const story = E.cardGeom("story"), feed = E.cardGeom("feed");
  const fades = new Set<number>();
  for (const [gm, m] of [[story, execModel()], [story, progModel()], [feed, execModel({ aspect: "feed" })],
    [feed, progModel({ aspect: "feed" })]] as [any, any][]) {
    const p = m.template === "execution" ? E.shareExecutionPlan(g, m, gm) : E.shareProgressionPlan(g, m, gm);
    const f = E.shareScrimFade(gm, p.blockTop);
    fades.add(f);
    assert.ok(f >= E.SHARE_SCRIM.fadeMin && f <= E.SHARE_SCRIM.fadeMax, "the fade escaped its clamp: " + f);
    // A block that starts lower down the card has less canvas below it and earns a shorter fade.
    assert.ok(E.shareScrimFade(gm, p.blockTop + 200) < f,
      "the fade did not shorten when the block started lower");
  }
  assert.ok(fades.size >= 2, "every layout got the same fade, so it is not derived from the block: " +
    [...fades].join(","));
});

/* ================================================================================================ *
 * THE BOTTOM FADE: HALVED, AND EASED SO IT LEAVES NO LINE (owner, ruling 8 item 4, 2026-08-21)      *
 * ================================================================================================ */

test("BLOCKER: the fade is half the length it was, on every block top the app produces", () => {
  // "the gradient at the bottom of the card is too high, it needs to be halved in distance."
  // ⚠️ THE COEFFICIENT AND BOTH CLAMPS HALVED TOGETHER, and the clamps are the half that matters. Two of
  // the eight real fades sat ON the lower clamp before (the poster at both aspects), so halving fadeK and
  // leaving fadeMin at 200 would have left those two completely unchanged while the other six moved —
  // the owner's own template, the poster, being one of the two.
  const E = env();
  assert.equal(E.SHARE_SCRIM.fadeK, 0.17, "the fade coefficient is no longer half of the 0.34 that shipped");
  assert.equal(E.SHARE_SCRIM.fadeMin, 100, "the fade floor is no longer half of the 200 that shipped");
  assert.equal(E.SHARE_SCRIM.fadeMax, 180, "the fade ceiling is no longer half of the 360 that shipped");
  // ⚠️ AND THE DELIVERED LENGTHS ARE ASSERTED AGAINST THE MEASURED TABLE, not against the arithmetic that
  // produced them — a check that recomputes fadeK * block would pass with fadeK changed to anything.
  // Measured on the eight real block tops: story 830/919/957/735 and feed 670/801/856/581.
  const table: [number, number, number][] = [
    [1920, 830, 141], [1920, 919, 156], [1920, 957, 163], [1920, 735, 125],
    [1350, 670, 114], [1350, 801, 136], [1350, 856, 146], [1350, 581, 100]];
  for (const [H, block, want] of table) {
    const got = E.shareScrimFade({ H: H, W: 1080 }, H - block);
    assert.equal(got, want, "a block of " + block + " on a " + H + "-tall card earns a fade of " + got +
      ", not the measured " + want);
  }
  // ⚠️ THE CEILING IS A SAFETY RAIL AND IS NOT REACHED BY ANY REAL LAYOUT, which is true of the 360 it
  // replaced too — the biggest real fade was 325 of 360 and is now 163 of 180. Asserted so that a future
  // template landing on it is a deliberate decision rather than a surprise.
  const real = table.map((t) => t[2]);
  assert.ok(Math.max(...real) < E.SHARE_SCRIM.fadeMax,
    "a real layout now sits on the fade ceiling, so the ceiling is deciding the geometry");
  assert.ok(real.includes(E.SHARE_SCRIM.fadeMin),
    "no real layout reaches the fade floor any more, so halving the floor was untested");
});

test("BLOCKER: shareEase arrives at nothing with zero slope AND zero curvature", () => {
  // ⚠️ THIS IS THE WHOLE FIX. "i can see the line where it stops on the current one" — a Mach band, which
  // the eye finds from the discontinuity in the RATE of change. A ramp that reaches zero with a non-zero
  // slope draws an edge at the row where it stops however gentle the ramp is.
  const E = env();
  const f = E.shareEase;
  assert.equal(f(0), 0, "the ease does not start at nothing");
  assert.equal(f(1), 1, "the ease does not arrive at the solved alpha");
  // Monotone, so the scrim can never lighten as it goes down.
  let prev = -1;
  for (let t = 0; t <= 1.0000001; t += 0.01) { const v = f(t); assert.ok(v >= prev - 1e-12,
      "the ease is not monotone: f(" + t.toFixed(2) + ") = " + v + " after " + prev); prev = v; }
  // ⚠️ BOTH DERIVATIVES AT THE TOP, MEASURED NUMERICALLY. smoothstep (3t^2 - 2t^3) passes the first of
  // these and fails the second, and its curvature is at its MAXIMUM exactly at the boundary — which is
  // the one place it must not be. Re-broken with smoothstep: f''(0) comes out at 6 and this fails.
  const h = 1e-4;
  const d1 = (f(h) - f(0)) / h;
  const d2 = (f(2 * h) - 2 * f(h) + f(0)) / (h * h);
  assert.ok(Math.abs(d1) < 1e-6, "the ease leaves the top of the fade with slope " + d1 + ", so it draws a line there");
  assert.ok(Math.abs(d2) < 1e-2, "the ease leaves the top of the fade with curvature " + d2 +
    ", which is a Mach band one derivative further out");
  // And the curvature peak has to be INSIDE the fade, which is the property that makes it invisible.
  let peakAt = 0, peak = 0;
  for (let t = 0.02; t <= 0.98; t += 0.005) {
    const c = Math.abs((f(t + h) - 2 * f(t) + f(t - h)) / (h * h));
    if (c > peak) { peak = c; peakAt = t; }
  }
  assert.ok(peakAt > 0.1 && peakAt < 0.9,
    "the ease's curvature peaks at t=" + peakAt.toFixed(3) + ", i.e. at an end rather than in the middle");
});

test("BLOCKER: the fade the gradient actually emits reaches the alpha through the ease, not in a straight line", () => {
  // ⚠️ ASSERTED ON THE STOPS THE DRAW EMITS, NOT ON ITS SOURCE. A source-text check proves shareEase is
  // mentioned; only the recorded gradient can say the curve reached the canvas — and the recorder logs
  // every addColorStop, so the emitted profile is readable exactly as Skia would see it.
  const E = env();
  const gm = E.cardGeom("story");
  const white = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(255) };
  const plan = E.shareVeilPlan(white, gm, { blockTop: 1090, colours: E.shareScrimText() });
  const g = E.ctx();
  E.shareVeilDraw(g, gm, plan);
  const stops = g.log.filter((e: any[]) => e[0] === "stop")
    .map((e: any[]) => ({ o: e[1] as number, a: Number(/([\d.]+)\)$/.exec(String(e[2]))?.[1] ?? "0") }));
  assert.ok(stops.length >= 20, "the fade is emitted as " + stops.length +
    " stops, so it is still a straight line between two of them");
  // exactly one rect, and the last stop is the deepest — both pre-existing invariants, restated here
  // because this test now owns the emitted profile.
  assert.equal(g.calls("fillRect").length, 1, "the scrim drew more than one rect");
  assert.ok(stops[0]!.o === 0 && stops[0]!.a === 0, "the fade does not begin at nothing");
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i]!.o >= stops[i - 1]!.o - 1e-9 && stops[i]!.a >= stops[i - 1]!.a - 1e-9,
      "the emitted profile is not monotone at stop " + i);
  }
  // ⚠️ THE ONE NUMBER THAT MEANS "NO LINE": the slope of the FIRST segment against the mean slope of the
  // whole fade. A straight line makes those equal, by definition; the ease makes the first segment a
  // small fraction of the mean. Measured on the shipped curve at 48 stops: 0.0067. Re-broken by setting
  // stops to 1, which reproduces the old straight line exactly and takes this to 1.0.
  const fadeStops = stops.filter((p: { o: number; a: number }) => p.a < plan.a - 1e-9)
    .concat([stops.filter((p: { o: number; a: number }) => Math.abs(p.a - plan.a) < 1e-9)[0]!]);
  const top = fadeStops[0]!, second = fadeStops[1]!, end = fadeStops[fadeStops.length - 1]!;
  const first = (second.a - top.a) / (second.o - top.o);
  const meanSlope = (end.a - top.a) / (end.o - top.o);
  const share = first / meanSlope;
  assert.ok(share < 0.05, "the fade's first segment carries " + share.toFixed(4) +
    " of its mean slope, so it arrives at nothing in a straight line and draws an edge there");
  // ⚠️ AND THE ALPHA IT ARRIVES AT IS STILL THE SOLVED ONE. An ease that undershot would be a legibility
  // change wearing a cosmetic fix.
  assert.ok(Math.abs(end.a - plan.a) < 1e-9,
    "the eased fade arrives at " + end.a + " instead of the solved " + plan.a);
});

test("BLOCKER: the fade's length cannot change the alpha under any glyph", () => {
  // ⚠️ THIS IS WHY HALVING IT IS SAFE, AND IT IS A CLAIM ABOUT THE MECHANISM RATHER THAN A FLOOR THAT
  // HAPPENS TO BE HIGH ENOUGH. The alpha is solved from the brightest ground inside the BLOCK rect, and
  // the gradient reaches it at blockTop - knee, above the topmost glyph — so the fade decides only where
  // the ramp begins, all of which is above the copy. Measured over 160 real card states: the solved alpha
  // identical in 160 of 160, and the finished cards differ below the copy by at most one 8-bit unit.
  const E = env();
  const gm = E.cardGeom("story");
  // ⚠️⚠️ THE PROBE IS BANDED, AND A UNIFORM ONE CANNOT SEE THIS AT ALL. Written with a flat ground of one
  // colour this test PASSED with the solve deliberately moved onto the fade rect instead of the block
  // rect — the brightest pixel is the same either way, so the rect could grow upwards and change nothing.
  // The fixture-too-kind trap, in the one test whose whole subject is which rect is sampled. Bright above
  // the block, dark inside it: now a solve that reaches up into the fade answers a different alpha.
  const banded = (bright: number[], dark: number[], h: number, split: number) => {
    const d = new Uint8ClampedArray(4 * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) {
      const c = y < split ? bright : dark, o = (y * 4 + x) * 4;
      d[o] = c[0]!; d[o + 1] = c[1]!; d[o + 2] = c[2]!; d[o + 3] = 255;
    }
    return { w: 4, h: h, data: d };
  };
  const cases: [string, any][] = [
    ["flat white", banded([255, 255, 255], [255, 255, 255], 20, 20)],
    ["flat mid", banded([128, 128, 128], [128, 128, 128], 20, 20)],
    ["flat magenta", banded([224, 21, 200], [224, 21, 200], 20, 20)],
    // ⚠️ THE DISCRIMINATING ONE: white above the block, near-black inside it. blockTop 1090 of 1920 lands
    // at probe row 11.35, so the block rect sees only the dark half while a rect grown up by the fade
    // reaches the white.
    ["white sky over dark ground", banded([255, 255, 255], [10, 12, 10], 20, 10)],
  ];
  for (const [name, probe] of cases) {
    const base = E.shareVeilPlan(probe, gm, { blockTop: 1090, colours: E.shareScrimText() });
    for (const fade of [40, 100, 141, 282, 900]) {
      const p = E.shareVeilPlan(probe, gm, { blockTop: 1090, fade: fade, colours: E.shareScrimText() });
      assert.equal(p.a, base.a, "a fade of " + fade + " changed the solved alpha on " + name +
        ": " + p.a + " against " + base.a);
      assert.equal(p.end, base.end, "a fade of " + fade + " changed the deepest stop on " + name);
      assert.equal(p.blockTop, base.blockTop, "a fade of " + fade + " moved the block");
    }
  }
  // ⚠️ AND THE FIXTURE HAS TO BE PROVED CAPABLE OF SEEING THE DIFFERENCE, or the sweep above is vacuous:
  // sampling the same probe over the fade band really does answer a brighter ground.
  const split = cases[3]![1];
  const blockOnly = E.shareGroundUnder(split, gm, E.shareRect(0, 1090, gm.W, gm.H - 1090));
  const withFade = E.shareGroundUnder(split, gm, E.shareRect(0, 1090 - 900, gm.W, gm.H - 190));
  assert.ok(E.shareRelLumRGB(withFade) > E.shareRelLumRGB(blockOnly) * 4,
    "the banded fixture reads the same ground over the block as over the fade, so this test proves nothing");
  // ⚠️ AND THE STOP THAT DELIVERS THE SOLVED ALPHA IS STILL ABOVE THE FIRST GLYPH, whatever the fade.
  // Without the knee the promise "every row of copy sits on at least the ratio solved for" is true at one
  // pixel row and nowhere above it.
  assert.ok(E.SHARE_SCRIM.knee >= 6,
    "the knee is " + E.SHARE_SCRIM.knee + "px, which is inside the halo any pixel measurement needs");
  const gg = E.ctx();
  const plan = E.shareVeilPlan({ w: 2, h: 1, data: new Uint8ClampedArray(8).fill(255) }, gm,
    { blockTop: 1090, colours: E.shareScrimText() });
  E.shareVeilDraw(gg, gm, plan);
  const stops = gg.log.filter((e: any[]) => e[0] === "stop")
    .map((e: any[]) => ({ o: e[1] as number, a: Number(/([\d.]+)\)$/.exec(String(e[2]))?.[1] ?? "0") }));
  const full = stops.filter((p: { o: number; a: number }) => Math.abs(p.a - plan.a) < 1e-9)[0]!;
  const top = Math.max(0, plan.fadeTop);
  const yOfFull = top + full.o * (gm.H - top);
  assert.ok(yOfFull <= plan.blockTop - E.SHARE_SCRIM.knee + 1,
    "the solved alpha only arrives at y=" + Math.round(yOfFull) + ", below the top of the copy at " + plan.blockTop);
});

test("the route's keyline is thickened on a bright ground, judged on luminance and not on a luma byte", () => {
  // ⚠️ THE SAME FLATTENING DEFECT REACHED THIS DECISION TOO. It read the sampled ground as a byte and
  // compared it with 150, so a saturated ground was judged dark whatever its real luminance. The
  // threshold is still mid grey; it is now expressed as mid grey's own luminance, which means the same
  // thing for a neutral and the right thing for a colour.
  const cl = closure("drawShareCard");
  const body = cl.get("shareMomentCard")!;
  assert.match(body, /shareRelLumRGB\(shareRectGroundRGB\(m, probe, gm, zone\.rect\)\) > shareLumOfByte\(150\)/,
    "the route's keyline decision is not taken on true luminance");
  const E = env();
  // ⚠️ AND IT ASKS THE GROUND THIS CARD ACTUALLY HAS. shareGroundUnder answers WHITE when it cannot look,
  // which is the right failure for a photograph we hold and cannot sample and the wrong answer for a card
  // that has no photograph at all — so with no probe every no-photo card thickened the keyline for a
  // bright ground whose lightest pixel is lightness 0.125. Measured through the real function: the easy
  // ground reads far below mid grey, and white reads far above it.
  const noPhoto = E.shareRectGroundRGB({ effort: "easy" }, null, E.cardGeom("story"), { x: 0, y: 0, w: 100, h: 100 });
  assert.ok(E.shareRelLumRGB(noPhoto) < E.shareLumOfByte(150),
    "a no-photo card's own ground is being read as bright: " + noPhoto.join(","));
  assert.deepEqual(E.shareRectGroundRGB({ effort: "" }, null, E.cardGeom("story"), { x: 0, y: 0, w: 10, h: 10 }),
    E.shareHexRGB(E.SHARE_INK.ground), "a card with no effort colour is not reading the plain ink ground");
  // Cyan is genuinely brighter than mid grey; pure blue is genuinely darker. A byte model says both are
  // dark, which is how a route over a bright sky came out as a hollow outline.
  assert.ok(E.shareRelLumRGB([0, 255, 255]) > E.shareLumOfByte(150), "cyan is being read as a dark ground");
  assert.ok(E.shareRelLumRGB([0, 0, 255]) < E.shareLumOfByte(150), "pure blue is being read as a bright ground");
});

// ---- the session's own colour as a ground (owner, ruling 7) --------------------------------------

test("BLOCKER: the ground's three colours ARE the app's own effort tokens, read out of the stylesheet", () => {
  // ⚠️⚠️ THIS IS THE GUARD A COMMENT IN web/app.ts CLAIMED FOR A DAY WHILE NO SUCH GUARD EXISTED — the
  // second time a comment in this area has promised a test that was never written (the first is recorded
  // in the palette test above). Proven by re-break before it was believed: SHARE_EFFORT.easy set to a
  // blue built clean and passed 960 tests, so the card could paint an easy run blue while the Logbook
  // rail, the plan dot and the debrief chip all painted it --eff-easy teal.
  // ⚠️ AND IT READS BOTH DARK DECLARATIONS. CLAUDE.md records that FOUR places declare these tokens and
  // that a change applied to three leaves the fourth stale — which one a runner gets depends on their OS
  // setting, so it reproduces for some people and not others. The card is a dark design in both themes,
  // so the two dark declarations are the two that decide it, and they must agree with each other first.
  const E = env();
  const media = darkTokens(), attr = darkThemeTokens();
  const pairs: [string, string][] = [["easy", "--eff-easy"], ["moderate", "--eff-moderate"], ["hard", "--eff-hard"]];
  for (const [band, tok] of pairs) {
    assert.ok(media[tok], "the dark media block does not declare " + tok);
    assert.equal(attr[tok], media[tok],
      "the two dark declarations of " + tok + " disagree: " + media[tok] + " vs " + attr[tok]);
    assert.equal(E.SHARE_EFFORT[band], media[tok],
      "SHARE_EFFORT." + band + " is " + E.SHARE_EFFORT[band] + " but " + tok + " is " + media[tok]);
  }
  // ⚠️ THREE BANDS, THREE DISTINCT COLOURS. A table whose members happen to be equal is a family with one
  // card in it, which is the shape a copy-paste produces.
  assert.deepEqual(Object.keys(E.SHARE_EFFORT).sort(), ["easy", "hard", "moderate"],
    "SHARE_EFFORT no longer holds exactly the three bands a run can be");
  assert.equal(new Set(Object.values(E.SHARE_EFFORT)).size, 3, "two of the three grounds are the same colour");
  // ⚠️ AND EACH BAND RESOLVES TO ITS OWN COLOUR. Re-broken as `return effort ? SHARE_EFFORT.hard : null`,
  // which paints every easy run as a hard one and which nothing caught.
  for (const [band] of pairs) {
    assert.equal(E.shareEffortHex(band), E.SHARE_EFFORT[band],
      "shareEffortHex(" + band + ") answers " + E.shareEffortHex(band) + ", not that band's own colour");
  }
  // ⚠️ "none" IS NOT A GROUND. --eff-none is a desaturated sage grey and effortOf answers it only for a
  // rest or mobility day, neither of which is a run; forcing it through the derivation would turn "we do
  // not know what this session was" into a confident green.
  for (const absent of ["none", "", null, undefined, "moderat"]) {
    assert.equal(E.shareEffortHex(absent as any), null, "an unknown effort band became a ground: " + absent);
  }
  // ⚠️ AND THE TWO LITERAL COPIES OF #e6ac3e AND #e56f49 IN THIS FILE'S OWN PALETTE MUST STAY EQUAL.
  // SHARE_INK.fast/slow are the chart's out-of-band marks and SHARE_EFFORT.moderate/hard are the
  // grounds; both are pinned to the same token above, so this is implied — stating it means a change
  // that moves one of them fails HERE, naming the pair, rather than in whichever token guard runs first.
  assert.equal(E.SHARE_INK.fast, E.SHARE_EFFORT.moderate,
    "the chart's 'fast' mark and the moderate ground are two spellings of one token and have drifted");
  assert.equal(E.SHARE_INK.slow, E.SHARE_EFFORT.hard,
    "the chart's 'slow' mark and the hard ground are two spellings of one token and have drifted");
});

test("BLOCKER: the app's two effort readers ANSWER from the one mapping, not merely mention it", () => {
  // ⚠️ THREE OF TWENTY-FIVE RE-BREAKS ESCAPED WITH THIS ONE ROOT CAUSE, and the third was the previous
  // round's exact defect restored: effortOf and runEffort could be reverted to HEAD's intensity-keyed
  // branching — which is what painted a tempo rust — and the whole suite stayed green, because the
  // mapping was guarded where it is DECLARED and not where it is READ. A table nobody is forced to read
  // is a suggestion.
  //
  // So this asserts BEHAVIOUR over the derived collection: for every member of the SessionType union,
  // both readers must return exactly what sessionEffort returns. A reader that re-derives the answer
  // from intensity, from a step's RPE, or from its own list cannot agree across all twelve.
  const A = effEnv();
  const types = sessionTypes();
  assert.ok(types.length >= 10, "the SessionType union no longer parses: " + types.length);
  for (const t of types) {
    const want = A.sessionEffort(t);
    assert.equal(A.effortOf({ type: t }), want,
      "effortOf disagrees with the one mapping for " + t + ": " + A.effortOf({ type: t }) + " vs " + want);
    assert.equal(A.runEffort({ type: t }), want,
      "runEffort disagrees with the one mapping for " + t + ": " + A.runEffort({ type: t }) + " vs " + want);
  }
  // ⚠️ AND NEITHER READER MAY CARRY A SECOND OPINION TO FALL BACK ON. An intensity- or RPE-keyed branch
  // that happens to agree today is the same defect one library change away from returning.
  for (const name of ["effortOf", "runEffort"]) {
    const src = lift(name);
    assert.ok(!/intensity|targetRpe|RUN_HARD/.test(src),
      name + " decides an effort itself instead of asking the one mapping: " + src.trim());
  }
});

test("BLOCKER: one session type has ONE effort colour, everywhere in the app", () => {
  // ⚠️ THE OWNER'S OWN EXAMPLE WAS THE ONE THAT WAS WRONG. "an easy run is teale, a tempo is yellow etc"
  // — and a tempo had three colours at once: the Add-a-session grid drew it --eff-moderate, the
  // training-log calendar drew it --eff-hard, and the card's new ground drew it --eff-hard because its
  // own list of hard types named threshold. He taps the amber tile, runs it, gets a rust card.
  // ⚠️ THE SESSION TYPES ARE READ OUT OF THE ENGINE'S OWN UNION, not listed here — a hand-written list is
  // how a mapping comes to be missing the one type nobody remembered (this project has shipped that twice:
  // "race-specific" omitted from one reader, "race" omitted from all three).
  const A = effEnv(), E = env();
  const types = sessionTypes();
  for (const t of types) {
    assert.ok(A.SESSION_EFFORT[t], "SESSION_EFFORT has no row for the session type " + t);
  }
  assert.deepEqual(Object.keys(A.SESSION_EFFORT).sort(), types.slice().sort(),
    "SESSION_EFFORT and SessionType have drifted apart");
  // The owner's decision, and the two it is not.
  assert.equal(A.sessionEffort("threshold"), "moderate", "a tempo is not the moderate band");
  for (const t of ["vo2", "race-specific", "race"]) {
    assert.equal(A.sessionEffort(t), "hard", t + " is not the hard band");
  }
  for (const t of ["easy", "long", "recovery", "strides"]) {
    assert.equal(A.sessionEffort(t), "easy", t + " is not the easy band");
  }
  // ⚠️ EVERY --eff-* COLOUR IN THE GRID AND THE CALENDAR COMES FROM THE MAPPING. Neither table is
  // required to be all-effort — the grid deliberately keeps four identity accents so seven tiles stay
  // tellable apart, and the calendar's long bucket is an identity — but anything WEARING an effort
  // colour must be wearing the right one, which is the drift that produced the defect.
  for (const r of A.RUN_TYPES) {
    if (!/--eff-/.test(r.c)) continue;
    assert.equal(r.c, A.effortVar(A.sessionEffort(r.t)),
      "the Add-a-session tile for " + r.t + " is " + r.c + " and its effort colour is " +
      A.effortVar(A.sessionEffort(r.t)));
  }
  assert.ok(A.RUN_TYPES.some((r: any) => /--eff-/.test(r.c)), "no grid tile carries an effort colour at all");
  for (const t of Object.keys(A.RUN_KIND)) {
    const k = A.RUN_KIND[t];
    if (k.k === "long") { assert.equal(k.c, "var(--taper)", "the long bucket lost its identity accent"); continue; }
    assert.equal(k.c, A.effortVar(A.sessionEffort(t)),
      "the calendar dot for " + t + " is " + k.c + " and its effort colour is " + A.effortVar(A.sessionEffort(t)));
  }
  assert.equal(A.runKindColour("threshold"), "var(--eff-moderate)", "a tempo dot on the calendar is not amber");
  assert.equal(A.runKindColour("qwerty"), A.effortVar(A.sessionEffort("qwerty")), "the default bucket left the mapping");
  // ⚠️ AND THE CALENDAR'S LEGEND NAMES EVERY COLOUR A DOT CAN BE, AND NOTHING ELSE. It was three
  // hand-written pairs and one of them went stale the moment a tempo became amber: it promised
  // "Quality" in --eff-hard over a grid drawing --eff-moderate.
  const legend = A.logCalendarLegend();
  const drawn = new Set<string>(Object.keys(A.RUN_KIND).map((t) => A.RUN_KIND[t].c)
    .concat([A.runKindColour("easy")]));
  assert.deepEqual(new Set(legend.map((x: any) => x[1])), drawn,
    "the legend and the dots disagree: legend " + legend.map((x: any) => x[1]).join(",") +
    " vs dots " + [...drawn].join(","));
  assert.equal(legend.length, new Set(legend.map((x: any) => x[1])).size, "the legend repeats a colour");
  for (const row of legend) assert.ok(row[0] && !/undefined/.test(String(row[0])), "a legend row has no word: " + row);
  // ⚠️ THE CARD IS THE FOURTH READER AND IT MUST AGREE. This is the finding in one line.
  assert.equal(E.shareEffortHex(A.sessionEffort("threshold")), darkTokens()["--eff-moderate"],
    "a tempo card's ground is not the amber token");
  assert.equal(E.shareEffortHex(A.sessionEffort("vo2")), darkTokens()["--eff-hard"]);
  assert.equal(E.shareEffortHex(A.sessionEffort("easy")), darkTokens()["--eff-easy"]);
  // ⚠️ AND THE MIDDLE OF THE FAMILY MUST BE REACHABLE BY A RUN SOMEBODY CAN ACTUALLY LOG. Before this,
  // "moderate" was reached only by strength and cross-training, and PRIMARY_TYPES cannot start either —
  // so the amber ground was undrawable and the derivation's whole legibility argument was about a card
  // no runner could produce.
  const loggable = Object.keys(A.PRIMARY_TYPES);
  for (const band of ["easy", "moderate", "hard"]) {
    assert.ok(loggable.some((t) => A.sessionEffort(t) === band),
      "no run a runner can start resolves to the " + band + " ground: " + loggable.join(","));
  }
});

test("BLOCKER: the session ground is dark enough for every text tier, on all three colours", () => {
  // ⚠️ SHARE_GROUND.lTop GOVERNS LEGIBILITY AND NOTHING WAS CHECKING IT. Re-broken from 0.125 to 0.30:
  // build clean, 960 tests green, and a card whose small type measures 2.57:1 ships. The comment beside
  // it also claimed the honest ceiling was 0.145-0.165 when --ink-faint is already under AA at 0.145.
  // ⚠️ MEASURED AGAINST THE TOP STOP, which is the lightest the ground gets anywhere on the card and so
  // the pixel the tightest tier really does land on (the wordmark and the eyebrow are up there).
  const E = env();
  const tiers = ["inkFaint", "inkSoft", "accent", "ink"];
  let worst = 99, worstAt = "";
  for (const band of ["easy", "moderate", "hard"]) {
    const stops = E.shareGroundStops(E.SHARE_EFFORT[band]);
    assert.equal(stops.length, 2, "a session ground is not two stops");
    // Deepens downward, which is the gesture the photo cards' solved scrim makes.
    assert.ok(E.shareRelLum(stops[1]) < E.shareRelLum(stops[0]),
      band + "'s ground does not deepen towards the block");
    // ⚠️ AND IT KEEPS THE TOKEN'S HUE, which is the whole reason the derivation is done in HSL. A ground
    // mixed towards the ink in sRGB comes out olive, and a flat grey would pass every ratio below while
    // saying nothing about the run.
    // ⚠️ THE TOLERANCE IS 2.5 DEGREES BECAUSE 8-BIT QUANTISATION AT THIS LIGHTNESS IS THE FLOOR, not
    // because the derivation is sloppy. Measured: the top stops drift 0.19-0.61 degrees and the bottom
    // stops 1.33-1.75, because #1d1607 has only 22 levels between its brightest and dimmest channel.
    // Written at 1.5 this failed on correct code.
    for (const st of stops) {
      assert.ok(Math.abs(E.shareHexHSL(st).h - E.shareHexHSL(E.SHARE_EFFORT[band]).h) < 2.5,
        band + "'s ground has lost the token's hue: " + st);
      assert.ok(E.shareHexHSL(st).s > 0.3, band + "'s ground has lost its chroma: " + st);
    }
    for (const k of tiers) {
      const r = E.shareRatio(E.shareRelLum(E.SHARE_INK[k]), E.shareRelLum(stops[0]));
      if (r < worst) { worst = r; worstAt = band + "/" + k; }
      assert.ok(r >= 4.5, "SHARE_INK." + k + " measures " + r.toFixed(2) + ":1 on the " + band +
        " ground's top stop — raise of SHARE_GROUND.lTop takes the type under AA");
    }
  }
  // ⚠️ THE MEASURED SWEEP, QUOTED SO A FUTURE CHANGE HAS TO FACE IT. --ink-faint on the EASY ground (the
  // tightest of the nine) runs 5.17 : 4.70 : 4.25 : 3.81 : 3.42 across lTop 0.105 / 0.125 / 0.145 / 0.165
  // / 0.185, and 1.79 at 0.30. So 0.145 is already under AA, the ceiling is between 0.125 and 0.145, and
  // the shipped value carries 0.20 of margin on the tightest tier there is.
  assert.ok(worst > 4.6 && worst < 4.9, "the tightest tier now measures " + worst.toFixed(2) +
    ":1 at " + worstAt + ", where 0.125 measured 4.70 — SHARE_GROUND has moved");
});

test("BLOCKER: the topographic contours carry the session's colour, and the plain ink ground is unchanged", () => {
  // ⚠️ THE OWNER ASKED FOR THE TEXTURE TO SURVIVE AND IT IS ALSO WHERE THE CHROMA COMES FROM — the ground
  // itself cannot be lifted far enough to read as a hue without taking --ink-faint under 4.5:1. Re-broken
  // as `const tok = SHARE_INK.inkSoft`, which silently returns the whole family to grey contours over
  // three barely-different deep grounds, and which nothing caught.
  // ⚠️ ASSERTED ON WHAT IT STROKED, NOT ON ITS SOURCE. The texture draws into an offscreen canvas and
  // then drawImages it, so the claim is read off that canvas's own recorded strokeStyle.
  const E = env();
  const gm = E.cardGeom("story");
  const seen: string[] = [];
  for (const band of ["easy", "moderate", "hard"]) {
    const before = E.made.length;
    E.shareTopoDraw(E.ctx(), gm, E.SHARE_EFFORT[band]);
    assert.equal(E.made.length, before + 1,
      "the " + band + " texture reused a cached canvas — the stroke colour is not in shareTopoCanvas's key, " +
      "so two grounds share one picture and whichever drew first wins");
    const strokes = E.made[E.made.length - 1].ctx.log.filter((l: any[]) => l[0] === "strokeStyle").map((l: any[]) => l[1]);
    assert.deepEqual(strokes, [E.cardAlpha(E.SHARE_EFFORT[band], E.SHARE_TOPO.alpha)],
      "the " + band + " contours were stroked " + strokes.join(",") + ", not in that session's own colour");
    seen.push(strokes[0]);
  }
  assert.equal(new Set(seen).size, 3, "two of the three grounds drew identically coloured contours");
  // ⚠️ AND WITH NO SESSION COLOUR IT IS EXACTLY WHAT IT ALWAYS WAS: --ink-soft at the same alpha, so a run
  // with no type draws the poster it has always drawn.
  const before = E.made.length;
  E.shareTopoDraw(E.ctx(), gm, null);
  const plain = E.made[E.made.length - 1].ctx.log.filter((l: any[]) => l[0] === "strokeStyle").map((l: any[]) => l[1]);
  assert.deepEqual(plain, [E.cardAlpha(E.SHARE_INK.inkSoft, E.SHARE_TOPO.alpha)],
    "a card with no session colour no longer draws the ink contours it always did: " + plain.join(","));
  assert.ok(E.made.length === before + 1);
  // The cache still works for a repeat of the same colour, which is what keeps a pinch from stuttering.
  const n = E.made.length;
  E.shareTopoDraw(E.ctx(), gm, null);
  assert.equal(E.made.length, n, "the texture is regenerated on every draw");
});

test("BLOCKER: the ground itself is the session's colour, and no effort means the flat ink it always was", () => {
  // ⚠️ THE null PATH MUST BE BYTE-FOR-BYTE WHAT shareGroundFill ALWAYS PAINTED, which is what makes the
  // change provable: an export with no effort is unchanged and an export with one is not.
  const E = env();
  const gm = E.cardGeom("story");
  const g1 = E.ctx(); E.shareGroundPaint(g1, gm, null);
  const g2 = E.ctx(); E.shareGroundFill(g2, gm);
  assert.deepEqual(g1.log, g2.log, "a card with no session colour no longer paints the plain ink ground");
  for (const band of ["easy", "moderate", "hard"]) {
    const g = E.ctx(); E.shareGroundPaint(g, gm, E.SHARE_EFFORT[band]);
    const stops = g.log.filter((l: any[]) => l[0] === "stop").map((l: any[]) => l[1] + ":" + l[2]);
    assert.deepEqual(stops, ["0:" + E.shareGroundStops(E.SHARE_EFFORT[band])[0],
      "1:" + E.shareGroundStops(E.SHARE_EFFORT[band])[1]],
      band + " did not paint its own two stops: " + stops.join(" "));
    const rects = g.log.filter((l: any[]) => l[0] === "fillRect");
    assert.deepEqual(rects, [["fillRect", 0, 0, gm.W, gm.H]], band + " does not fill the whole canvas");
  }
});

test("BLOCKER: a photo-less data template puts the route in its own upper field, and a photo card is untouched", () => {
  // ⚠️ MEASURED BEFORE IT WAS ADDED. With no photograph The Execution and The Progression put 44.4% and
  // 42.4% of a story card into ONE continuous ink-free band, and their second quarter measured a
  // per-quarter luminance sd of 0.0121 against the byte gate's own 0.012 emptiness bar. After: 26.1% and
  // 25.1%. The Moment has always drawn its route in exactly that space, so this removed a difference
  // between the templates rather than adding a variant.
  // ⚠️ AND EVERY PHOTO CARD IS UNTOUCHED DOWN TO THE BYTE, proved by hash across both trees: all 36
  // captured exports identical. The gate is `probe`, which is the presence of a photograph.
  // ⚠️ ISOLATED AGAINST THE SAME CARD WITH NO ROUTE, not against the photo card. Comparing the two
  // COMPOSITIONS measures every other difference a photograph makes as well — written that way the
  // difference was 6 path segments and read as "the field route is not reaching it" on working code.
  const E = env();
  const gm = E.cardGeom("story");
  const photo = { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, id: "p", bitmap: {} };
  const probe = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(250) };
  const paths = (build: any, over: any, pr: any) => {
    const g = E.ctx();
    const m = build(over);
    const fn = m.template === "execution" ? E.shareExecutionCard : E.shareProgressionCard;
    fn(g, m, gm, pr, E.shareWordmarkPlan(g, gm, pr ? 1 : 0));
    return g.log.filter((l: any[]) => l[0] === "lineTo").map((l: any[]) => l[2] as number);
  };
  for (const build of [execModel, progModel]) {
    const name = build === execModel ? "execution" : "progression";
    const gp = E.ctx();
    const plan = name === "execution" ? E.shareExecutionPlan(gp, build({ photo: null }), gm)
      : E.shareProgressionPlan(gp, build({ photo: null }), gm);
    const bare0 = paths(build, { route: null, photo: null }, null);
    const bare1 = paths(build, { route: REF_ROUTE, photo: null }, null);
    assert.ok(bare1.length > bare0.length, name + " with no photograph draws the same path with a route " +
      "as without one (" + bare1.length + " vs " + bare0.length + " lineTo) — the field route is not reaching it");
    // ⚠️ THE ROUTE IS DRAWN FIRST, SO THE EXTRA PATH IS THE PREFIX. Taking it as the SUFFIX read the
    // splits ladder's own geometry and reported the field route as reaching y1684 on working code.
    const extra = bare1.slice(0, bare1.length - bare0.length);
    assert.ok(extra.length > 0);
    assert.ok(Math.max.apply(null, extra) < plan.blockTop - 32,
      name + "'s field route reaches y" + Math.max.apply(null, extra) + ", inside a block that starts at y" + plan.blockTop);
    assert.ok(Math.min.apply(null, extra) >= gm.safe.y0,
      name + "'s field route starts above the safe region");
    // ⚠️ AND WITH A PHOTOGRAPH IT IS THE SAME PICTURE WITH OR WITHOUT A ROUTE, which is the untouched half.
    assert.deepEqual(paths(build, { route: REF_ROUTE, photo: photo }, probe),
      paths(build, { route: null, photo: photo }, probe),
      name + " drew a route over a photograph, which changes every photo card the gate has signed off");
  }
  // ⚠️ AND ITS THREE REFUSALS, EACH A REAL CASE: a photograph (the field IS the picture), no route at all
  // (a treadmill run, or one whose GPS was refused), and a route the runner has hidden — shareCardModel
  // sends m.route null for that last one, which is the same test.
  const noDraw = (probeArg: any, r: any) => {
    const g = E.ctx();
    E.shareFieldRoute(g, { route: r, effort: "easy" }, gm, probeArg, E.shareWordmarkPlan(g, gm, 0), 1200);
    return g.log.filter((l: any[]) => l[0] === "lineTo" || l[0] === "stroke").length;
  };
  assert.equal(noDraw(probe, REF_ROUTE), 0, "a card with a photograph drew a second route in its field");
  assert.equal(noDraw(null, null), 0, "a run with no route drew one anyway");
  assert.ok(noDraw(null, REF_ROUTE) > 0, "a photo-less card with a route drew nothing");
});

test("BLOCKER: the wordmark carries a keyline instead of a fade, and it is a keyline not a plate", () => {
  // ⚠️ THIS TEST REPLACED THE TOP SCRIM'S, AND THE INVARIANT IT PROTECTS IS THE SAME ONE. The owner asked
  // for the fade across the top of the card to go (2026-08-20); the recorded defect it existed for was the
  // accent half of the wordmark measuring 2.09:1 over a field of white specks, because the scrim's alpha
  // was solved from a tenth-scale probe that averaged the specks away. A keyline cannot be defeated that
  // way — it does not sample the ground at all — so what is asserted here is that the treatment is a
  // STROKE UNDER THE GLYPHS and never a filled band, and that its three layers are in the one order that
  // works.
  const E = env();
  const gm = E.cardGeom("story");
  // With no photograph there is no treatment: the family's own grounds measure 11.0 to 19.4:1 on the
  // wordmark, so an edge there is cost with no benefit.
  const flat = E.ctx();
  E.shareWordmark(flat, gm.M, 140, 35, "left", 0);
  assert.equal(flat.calls("strokeText").length, 0, "the wordmark is keylined on a ground that needs none");
  assert.equal(flat.calls("fillText").length, 2, "the wordmark is not its two coloured runs");
  assert.equal(flat.calls("fillRect").length, 0, "the wordmark drew a band");
  // With one, both runs are stroked BEFORE either is filled.
  const over = E.ctx();
  E.shareWordmark(over, gm.M, 140, 35, "left", 1);
  assert.equal(over.calls("fillRect").length, 0, "the wordmark's treatment is a plate, not a keyline");
  const order = over.log.filter((e: any[]) => e[0] === "strokeText" || e[0] === "fillText")
    .map((e: any[]) => e[0]);
  assert.deepEqual(order, ["strokeText", "strokeText", "fillText", "fillText"],
    "the keyline of one run can bite into the fill of the other: " + order.join(","));
  // ⚠️ AND THE HALO IS CARRIED BY THE STROKE, NOT BY THE FILL, WHICH IS WHAT PUTS IT UNDER THE KEYLINE.
  // Measured on the sticker that first used this device: with the halo painted over the keyline only 0.55
  // of the keyline survives, and strengthening the halo then made the type WORSE. The tell is the state of
  // shadowBlur at the moment each draw call is made.
  const at = (kind: string) => {
    const i = over.log.findIndex((e: any[]) => e[0] === kind);
    return over.log.slice(0, i).filter((e: any[]) => e[0] === "shadowBlur").pop();
  };
  const atStroke = at("strokeText"), atFill = at("fillText");
  assert.ok(atStroke && Number(atStroke[1]) > 0, "the keyline stroke carries no halo");
  // ⚠️ AND BY THE TIME THE FILL RUNS THE HALO IS BACK OFF, which is what leaves it above both other layers.
  assert.ok(atFill && Number(atFill[1]) === 0, "the fill is carrying the halo, so it lands over the keyline");
  // The stroke is wider than a hairline at the wordmark's real size, or the edge cannot be seen.
  const lws = over.log.filter((e: any[]) => e[0] === "lineWidth").map((e: any[]) => Number(e[1]));
  const lw = Math.max(...lws);
  assert.ok(lw >= E.SHARE_WM_EDGE.keyMin, "the keyline is thinner than its own floor: " + lw);
  assert.ok(lw >= 35 * E.SHARE_WM_EDGE.key - 1e-9, "the keyline no longer scales with the glyph: " + lw);
  // ⚠️ THE BLUR IS SCALED BY THE DRAW SCALE, because Chrome does not scale shadowBlur by the transform —
  // a preview at half scale would otherwise carry twice the halo the export does.
  const half = E.ctx();
  E.shareWordmark(half, gm.M, 140, 35, "left", 0.5);
  const hb = half.log.filter((e: any[]) => e[0] === "shadowBlur").map((e: any[]) => Number(e[1]))
    .filter((v: number) => v > 0);
  assert.ok(hb.length && Math.abs(hb[0] - E.SHARE_WM_EDGE.blur * 0.5) < 1e-9,
    "the halo does not track the draw scale: " + JSON.stringify(hb));
  // And the context is left as it was found, or every later draw on the same canvas inherits an edge.
  const after = over.log.filter((e: any[]) => e[0] === "shadowBlur" || e[0] === "shadowColor");
  assert.ok(after.length >= 4, "the treatment does not restore what it changed: " + after.length);
});

test("BLOCKER: digits occupy one column, and the build does not claim tabular figures", () => {
  // ⚠️ MEASURED IN THE REAL RENDERER: at 800 84px a "1" is 41.34px and an "8" is 55.90px, so a metric
  // row shifts sideways depending on which run is shared. ctx.font is a CSS font shorthand and has no
  // font-variant-numeric slot, and Chrome exposes no separate property, so the app's on-screen .num
  // class cannot reach the export. This imposes a uniform advance by hand instead.
  const E = env();
  const g = E.ctx();
  g.font = E.shareFont(800, 100);
  const adv = E.shareFigAdvance(g);
  assert.ok(Math.abs(adv - 57) < 0.001, "the advance is not the widest digit's: " + adv);
  assert.equal(E.shareFigWidth(g, "11:11"), E.shareFigWidth(g, "38:88"),
    "two times of the same shape do not occupy the same width");
  assert.ok(E.shareFigWidth(g, "1") > g.measureText("1").width,
    "a narrow digit is not being given the column's width");
  assert.equal(E.shareFigWidth(g, "5.51"), E.shareFigWidth(g, "8.88"));
  // A non-digit keeps its own advance, or a colon would be padded to a digit's width.
  assert.ok(E.shareFigWidth(g, ":") < adv, "a colon is being padded to a digit column");
  // Drawn, the narrow digit is CENTRED in its slot rather than left-aligned in it.
  const d = E.ctx();
  d.font = E.shareFont(800, 100);
  E.shareFig(d, "18", 0, 0, "left");
  const xs = d.calls("fillText").map((c: any[]) => c[2]);
  assert.ok(xs[0] > 0.5, "the narrow digit was not centred in its column: " + xs[0]);
  assert.ok(Math.abs(xs[1] - adv) < 0.6, "the second digit did not start one column along: " + xs[1]);
  // Right and centre alignment measure the SAME total, or a right-aligned column would drift.
  const w = E.shareFigWidth(d, "18");
  const r = E.ctx(); r.font = E.shareFont(800, 100);
  E.shareFig(r, "18", 500, 0, "right");
  // ⚠️ THE FIRST GLYPH IS CENTRED IN ITS COLUMN, so it starts inside the run rather than at its left
  // edge — comparing it to (anchor - width) directly asserts the bug this centring exists to fix.
  const inset = (adv - r.measureText("1").width) / 2;
  assert.ok(Math.abs(r.calls("fillText")[0][2] - (500 - w + inset)) < 0.6,
    "right alignment is not using the figure width");
  // ⚠️ AND NOTHING MAY CLAIM WHAT THE FONT CANNOT DO.
  const html = page();
  assert.ok(!/ctx\.fontVariantNumeric|g\.fontVariantNumeric/.test(html),
    "the renderer sets a property canvas does not have");
  const src = lift("shareFigAdvance") + lift("shareFig") + lift("shareFigWidth");
  assert.ok(!/tabular/i.test(src) || /NOT font-variant-numeric|not tabular/i.test(src),
    "the digit helpers describe themselves as tabular figures");
});

test("text fits a measured box: one line first, then two, then an ellipsis", () => {
  // ⚠️ ONE LINE ALL THE WAY DOWN BEFORE WRAPPING. Measured over a real plan's 142 session titles,
  // wrapping as soon as the top size overflows moved 25 of them onto two lines that had always fitted.
  const E = env();
  const g = E.ctx();
  const one = E.shareFit(g, "EASY RUN", 900, { max: 120, min: 40 });
  assert.equal(one.lines.length, 1);
  assert.equal(one.size, 120, "a string that fits at the top rung was shrunk anyway");
  const wrapped = E.shareFit(g, "A VERY LONG SESSION NAME THAT CANNOT FIT ON ONE LINE AT ALL", 700, { max: 120, min: 40 });
  assert.ok(wrapped.lines.length === 2, "a long title did not wrap to two lines: " + wrapped.lines.length);
  for (const l of wrapped.lines) {
    g.font = E.shareFont(800, wrapped.size);
    assert.ok(g.measureText(l).width <= 700 + 0.001, "a wrapped line still overflows: " + l);
  }
  // A single unbreakable word is ellipsised to the box rather than drawn past it: with no frame to
  // clip it any more, past the edge means gone.
  const long = E.shareFit(g, "X".repeat(400), 400, { max: 120, min: 40 });
  assert.equal(long.lines.length, 1);
  assert.match(long.lines[0], /…$/, "an unbreakable string was not ellipsised");
  g.font = E.shareFont(800, long.size);
  assert.ok(g.measureText(long.lines[0]).width <= 400 + 0.001, "the ellipsised string still overflows");
  assert.ok(long.lh > long.size, "the line height is not larger than the size");
});

test("the wordmark is the app's own two-tone text, and the hand-drawn badge is gone", () => {
  // ⚠️ THE CANVAS BADGE WAS A SECOND DEFINITION OF THE LOGO and it had already drifted: a gradient, a
  // drop glow and a gloss highlight the canonical vector does not have. None of the four references
  // puts a badge on the card at all.
  const E = env();
  const g = E.ctx();
  const w = E.shareWordmark(g, 64, 150, 35, "left");
  const texts = g.calls("fillText");
  assert.deepEqual(texts.map((t: any[]) => t[1]), ["Inte-", "Run"], "the wordmark is not two runs");
  const fills = g.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => e[1]);
  assert.deepEqual(fills, [E.SHARE_INK.ink, E.SHARE_INK.accent], "the wordmark's two colours are wrong");
  assert.ok(Math.abs(w - E.shareWordmarkWidth(E.ctx(), 35)) < 0.001,
    "the measure-only twin disagrees with what was drawn");
  assert.equal(g.calls("arc").length + g.calls("roundRect").length, 0, "the wordmark draws artwork of its own");
  const html = page();
  assert.ok(!html.includes("function drawBrandBadge("), "the hand-drawn canvas badge survives");
  // Right alignment puts the whole thing left of the anchor.
  const r = E.ctx();
  E.shareWordmark(r, 1016, 150, 35, "right");
  assert.ok(r.calls("fillText")[0][2] < 1016 - w + 0.001, "a right-aligned wordmark overruns its anchor");
  // The real vector is the route to the MARK, and it is the canonical one rather than a redraw.
  assert.match(lift("shareMarkImage"), /BRAND_SVG/, "the mark is not rasterised from the real vector");
});

// ---- the topographic texture ---------------------------------------------------------------------

test("BLOCKER: the noise field is not constant, and the texture's subtlety is a BAND not a ceiling", () => {
  // ⚠️ THIS EXACT DEFECT SHIPPED INTO THE FIRST CUT AND MEASURED AS NOTHING. The hash multiplied a seed
  // by a 64-bit-looking constant with an ordinary *, so the term evaluated to 2.92e25 — a float with no
  // low bits — ToInt32 of it was 0, and the two coordinate terms were discarded with it: the field
  // returned 0 for every input and the poster ground drew ZERO inked pixels of 2,073,600. A flat ground
  // looks exactly like a very subtle texture, which is why the floor below matters as much as the cap.
  const E = env();
  const vals = [];
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) vals.push(E.shareTopoField(i, j, E.SHARE_TOPO.seed));
  const min = Math.min(...vals), max = Math.max(...vals);
  assert.ok(max - min > 0.25, "the noise field is flat: range " + (max - min).toFixed(4));
  assert.ok(min >= 0 && max <= 1, "the field escapes 0..1: " + min + " " + max);
  // Deterministic, or the preview and the export are different pictures.
  assert.equal(E.shareTopoField(7, 11, E.SHARE_TOPO.seed), E.shareTopoField(7, 11, E.SHARE_TOPO.seed));
  assert.notEqual(E.shareTopoField(7, 11, 1), E.shareTopoField(7, 11, 2), "the seed does nothing");
  assert.ok(!/Math\.random/.test(lift("shareTopoField") + liftConst("SHARE_TOPO")),
    "the texture is random, so the preview cannot match the export");
  // ⚠️ THE SUBTLETY IS DERIVED FROM THE PALETTE, NOT QUOTED. The reference poster's ground measures
  // luma 10 with contour lines reaching 34 — a ratio of 1.23:1 — and the alpha here has to land a line
  // in that band. Measured on the real canvas after the fix: max 36.2, ratio 1.239:1, 12.1% inked.
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    return 0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) +
      0.0722 * parseInt(h.slice(4, 6), 16);
  };
  const gl = lum(E.SHARE_INK.ground), il = lum(E.SHARE_INK.inkSoft);
  const line = E.SHARE_TOPO.alpha * il + (1 - E.SHARE_TOPO.alpha) * gl;
  const ratio = E.shareRatio(E.shareLumOfByte(line), E.shareLumOfByte(gl));
  assert.ok(ratio >= 1.10, "the texture is invisible at " + ratio.toFixed(3) + ":1");
  assert.ok(ratio <= 1.40, "the texture reads as a pattern at " + ratio.toFixed(3) + ":1");
  // It must not be a labelled map or fake geography: contours only, one weight, no glyphs.
  const src = lift("shareTopoCanvas");
  assert.ok(!/fillText|font\s*=/.test(src), "the texture draws type, so it reads as a map");
  assert.ok(E.SHARE_TOPO.levels >= 6, "too few contour levels to read as topography");
});

// ---- the route -----------------------------------------------------------------------------------

test("the route keeps its shape, its orientation and its aspect", () => {
  // ⚠️ WITHOUT THE cos(latitude) CORRECTION A ROUTE IS STRETCHED SIDEWAYS, and at Durham's 54.8 degrees
  // that is a factor of 0.577 — nearly two to one. One scale is then applied to both axes.
  const E = env();
  const box = E.shareRect(0, 0, 900, 900);
  // A square in metres: one degree of latitude against 1/cos(lat) degrees of longitude.
  const lat = 54.7768, k = 1 / Math.cos(lat * Math.PI / 180);
  const sq = [{ lat: lat, lng: 0 }, { lat: lat, lng: 0.01 * k }, { lat: lat + 0.01, lng: 0.01 * k },
    { lat: lat + 0.01, lng: 0 }, { lat: lat, lng: 0 }];
  const p = E.shareRouteProject(sq, box, 0.09);
  assert.ok(Math.abs(p.box.w / p.box.h - 1) < 0.02,
    "a square route did not project square: " + p.box.w.toFixed(1) + "x" + p.box.h.toFixed(1));
  // North is up: the higher latitude gets the SMALLER y.
  assert.ok(p.pts[2][1] < p.pts[0][1], "the route is upside down");
  // Nothing is rotated to fill the box: a wide route stays wide in a tall box.
  const wide = [{ lat: lat, lng: 0 }, { lat: lat + 0.001, lng: 0.02 * k }];
  const tall = E.shareRouteProject(wide, E.shareRect(0, 0, 300, 900), 0.09);
  assert.ok(tall.box.w > tall.box.h * 5, "a wide route was rotated or stretched to fill a tall box");
  // The padding is real and inside the box.
  assert.ok(p.pad > 0 && E.shareRectInside(p.box, box), "the route escapes its own box");
  assert.ok(p.box.w <= box.w - 2 * p.pad + 0.001, "the internal padding was not applied");
  assert.equal(E.shareRouteProject([{ lat: 1, lng: 1 }], box, 0.09), null, "a one-point route projected anyway");
});

test("simplification is in output pixels and never drops an endpoint", () => {
  const E = env();
  const line = Array.from({ length: 50 }, (_, i) => [i * 10, 300]);
  const s = E.shareRouteSimplify(line, 1);
  assert.deepEqual(s, [[0, 300], [490, 300]], "a straight line did not collapse to its ends");
  const zig: number[][] = [];
  for (let i = 0; i < 40; i++) zig.push([i * 10, 300 + (i % 2 ? 40 : -40)]);
  assert.ok(E.shareRouteSimplify(zig, 2).length > 30, "a real zig-zag was smoothed away");
  assert.ok(E.shareRouteSimplify(zig, 200).length === 2, "a huge tolerance did not collapse the line");
  for (const tol of [0, -1, NaN]) {
    assert.equal(E.shareRouteSimplify(line, tol).length, line.length, "a nil tolerance still simplified");
  }
  const kept = E.shareRouteSimplify(zig, 5);
  assert.deepEqual([kept[0], kept[kept.length - 1]], [zig[0], zig[zig.length - 1]],
    "an endpoint was dropped, and the endpoints carry the markers");
});

test("BLOCKER: the route is a keyline and a core, with no glow and no plate under it", () => {
  // ⚠️ IT USED TO STROKE A TEAL GRADIENT TWICE WITH A shadowBlur OF THREE TIMES THE LINE WIDTH, on a
  // rounded panel filled rgba(4,16,13,0.82) — a neon line on an opaque card on a photograph, which is
  // three of the brief's named defects in one element. Asserted on what the function DOES, because the
  // shape of today's source is not the invariant.
  const E = env();
  const g = E.ctx();
  const route = Array.from({ length: 30 }, (_, i) => ({ lat: 54.77 + i * 0.0004, lng: -1.57 + (i % 5) * 0.0002 }));
  const out = E.shareRouteDraw(g, route, E.shareRect(64, 200, 900, 900), {});
  assert.ok(out && out.n >= 2, "the route drew nothing");
  // No shadow was ever set, at all.
  assert.equal(g.log.filter((e: any[]) => e[0] === "shadowBlur" || e[0] === "shadowColor").length, 0,
    "the route still glows");
  // No plate: nothing is filled behind the line. The only fills are the two markers' rings.
  assert.equal(g.calls("fillRect").length, 0, "the route draws a plate behind itself");
  assert.equal(g.calls("roundRect").length, 0, "the route still draws a rounded panel");
  // The keyline is stroked FIRST and WIDER than the core, in the deep ink; the core is the warm white.
  const strokes: any[] = [];
  let lw = 0, ss = "";
  for (const e of g.log) {
    if (e[0] === "lineWidth") lw = e[1];
    else if (e[0] === "strokeStyle") ss = e[1];
    else if (e[0] === "stroke") strokes.push({ lw, ss });
  }
  assert.equal(strokes.length, 2, "the line is not exactly a keyline and a core: " + strokes.length);
  assert.equal(strokes[0].ss, E.SHARE_INK.keyline, "the first stroke is not the keyline");
  assert.equal(strokes[1].ss, E.SHARE_INK.ink, "the core is not the warm white");
  assert.ok(strokes[0].lw > strokes[1].lw, "the keyline is not wider than the core it edges");
  assert.ok(strokes[0].lw < strokes[1].lw * 3, "the keyline is so wide it is a halo, not an edge");
  assert.equal(g.log.filter((e: any[]) => e[0] === "lineCap")[0][1], "round", "the caps are not round");
  assert.equal(g.log.filter((e: any[]) => e[0] === "lineJoin")[0][1], "round", "the joins are not round");
  // Two markers, each three rings plus its own edge, in the reference's ratio.
  const arcs = g.calls("arc");
  assert.equal(arcs.length, 8, "the two markers are not four rings each: " + arcs.length);
  const R = arcs[1][3];
  assert.ok(Math.abs(arcs[2][3] / R - 0.75) < 0.01, "the accent ring is not 0.75 of the marker");
  assert.ok(Math.abs(arcs[3][3] / R - 0.40) < 0.01, "the pupil is not 0.40 of the marker");
  const markerFills = g.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => e[1]);
  assert.ok(markerFills.includes(E.SHARE_INK.accent), "the markers are not the accent");
  // The stroke scales with the box but is capped, so one rule serves an inset and a poster.
  const small = E.shareRouteDraw(E.ctx(), route, E.shareRect(0, 0, 240, 240), {});
  assert.ok(small.lw < out.lw, "the stroke does not scale with the box");
  assert.ok(small.lw >= 3.5 && out.lw <= 16, "the stroke escaped its own bounds");
});

// ---- the shipped composition ---------------------------------------------------------------------

/** Every function the renderer can reach from drawShareCard, walked once. */
function closure(root: string): Map<string, string> {
  const html = appScript();
  const seen = new Map<string, string>();
  const queue = [root];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    const b = lift(name);
    seen.set(name, b);
    for (const m of b.matchAll(/\b((?:card|share|draw)[A-Za-z0-9_]*)\s*\(/g)) {
      const c = m[1]!;
      if (!seen.has(c) && html.includes("function " + c + "(")) queue.push(c);
    }
  }
  return seen;
}

test("the renderer uses the shared layer rather than a second copy of it", () => {
  // ⚠️ A PRIMITIVE NOTHING CALLS IS THE COMPUTED-AND-DISCARDED TRAP THIS PROJECT HAS SHIPPED FOUR TIMES
  // (CLASS, MASTERS, PLAN.notes, refreshTypePreview). The adaptive path in particular must be exercised
  // by the shipped card, or it rots until a template phase discovers it never worked.
  // ⚠️ ASKED OF THE WHOLE CLOSURE, NOT OF drawShareCard'S OWN TEXT. Its first version required each call
  // to appear literally inside drawShareCard, which was true while there was one composition and became
  // false the moment it became a dispatcher — a ruler that can no longer see the thing it measures. The
  // invariant was never "these strings are in this function", it is "the shipped card reaches these".
  const cl = closure("drawShareCard");
  const all = [...cl.values()].join("\n");
  for (const fn of ["shareGroundFill", "shareGroundPaint", "shareEffortHex", "sharePhotoDraw",
    "shareLumaProbe", "shareVeilPlan",
    "shareVeilDraw", "shareWordmark", "shareRoutePlacement", "shareRouteDraw",
    "shareTopoDraw", "shareWordmarkPlan", "shareMomentCard", "sharePosterCard"]) {
    assert.ok(all.includes(fn + "("), "the renderer does not use " + fn);
  }
  // The texture belongs to the photo-free ground only: a photograph must not have contours over it.
  // ⚠️ AND THAT IS NOW A LIVE GATE ON EVERY TEMPLATE RATHER THAN A FACT ABOUT ONE. The poster is
  // photo-OPTIONAL since the owner's ruling, so the same template draws the texture on one card and a
  // photograph on the next; gated the other way round it would be a full-canvas translucent wash over
  // somebody's picture, which is a scrim wearing a texture.
  const draw = lift("shareDrawBody");
  assert.match(draw, /if \(!m\.photo\) shareTopoDraw/,
    "the topographic texture is not gated on there being no photograph");
  // ⚠️ THE WORDMARK'S RECT IS MEASURED BEFORE ANY TEMPLATE RUNS, and every template that places a route
  // hands it over as an obstacle. Stated as the ordering it protects rather than as one call site, so
  // moving the placement into another template cannot quietly drop it.
  assert.ok(draw.indexOf("shareWordmarkPlan(") < draw.indexOf("Card(g, m, gm"),
    "the wordmark's bounds are not measured before the template that scores against them");
  // ⚠️ DERIVED, NOT LISTED. The pair used to be written out by hand, so the two templates added after
  // it were exempt from the wordmark-as-an-obstacle rule by nothing more than not being typed in.
  const cards = [...new Set([...page().matchAll(/function (share[A-Za-z0-9]*Card)\(/g)].map((x) => x[1]!))];
  assert.ok(cards.length >= 4, "the renderer has " + cards.length + " template cards; four are expected");
  for (const name of cards) {
    const b = cl.get(name)!;
    if (!b.includes("shareRoutePlacement(")) continue;
    assert.ok(b.indexOf("shareRectPad(wm.rect") >= 0 && b.indexOf("textRects") >= 0,
      name + " places a route without the wordmark as an obstacle");
    assert.ok(b.indexOf("shareRectPad(wm.rect") < b.indexOf("shareRouteDraw("),
      name + " draws the route before its obstacles are stated");
  }
});

// ---- the deterministic fixtures -------------------------------------------------------------------

test("the pack's reference values exist only in the fixtures, never in the renderer", () => {
  // ⚠️ THE BRIEF FORBIDS THEM IN A PRODUCTION TEMPLATE in as many words. They are needed to draw the
  // same card the references show, and they must not become the card's own defaults — a template that
  // prints "Hartlepool" when a run has no place is worse than one that prints nothing.
  // ⚠️ SCOPED TO STRING LITERALS INSIDE THE RENDERER, NOT TO THE WHOLE PAGE. A sweep of the built file
  // for "Hartlepool" fails on a comment in the recap that uses the same town to explain a line-wrap
  // measurement, and a sweep for "Durham" fails on this phase's own note about the cosine correction at
  // 54.8 degrees. Both comments are worth keeping, and a guard that forces prose to be reworded to suit
  // it is the trap this project has hit seven times. A LITERAL is the thing that could actually be
  // printed on somebody's card.
  const html = page();
  const seen = new Set<string>();
  const queue = ["drawShareCard", "shareCardModel"];
  let literals = "";
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const b = lift(name);
    for (const m of b.matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)) literals += (m[1] ?? m[2] ?? "") + "\n";
    for (const m of b.matchAll(/\b((?:card|share|draw|run|rd)[A-Za-z0-9_]*)\s*\(/g)) {
      const c = m[1]!;
      if (!seen.has(c) && html.includes("function " + c + "(")) queue.push(c);
    }
  }
  assert.ok(seen.size >= 12, "the closure scanned for reference values collapsed to " + seen.size);
  for (const v of [REF_VALUES.locationA, REF_VALUES.locationB, REF_VALUES.timeA, REF_VALUES.timeB,
    "5.51", "6.31", "5:20–5:50", "5:20–6:10"]) {
    assert.ok(!literals.includes(v), "a reference value is a literal in the renderer: " + v);
  }
  // And the fixtures really do carry the pack's numbers rather than tidy stand-ins.
  const a = refRunA(), b = refRunB();
  assert.equal(a.distKm, REF_VALUES.distanceA);
  assert.equal(a.time, REF_VALUES.timeA);
  assert.equal(a.elevGain, REF_VALUES.elevation);
  assert.deepEqual([a.pband.minSecPerKm, a.pband.maxSecPerKm], REF_VALUES.targetA);
  assert.deepEqual([b.pband.minSecPerKm, b.pband.maxSecPerKm], REF_VALUES.targetB);
  assert.equal(b.distKm, REF_VALUES.distanceB);
  assert.equal(b.time, REF_VALUES.timeB);
  // ⚠️ B IS THE "6 OF 6 ON TARGET" CARD, so every one of its splits has to be inside its own band or
  // the fixture cannot produce the reference's own sentence.
  for (const s of b.splits) {
    assert.ok(s.sec >= b.pband.minSecPerKm && s.sec <= b.pband.maxSecPerKm,
      "fixture B has a split outside its band: " + s.sec);
  }
  assert.equal(b.splits.length, REF_VALUES.adherenceB[1]);
  // A's fourth-of-five arithmetic is the app's own answer for the reference run; the reference card's
  // sixth row is the part-kilometre tail, which is a derived pace and not a stored split.
  assert.equal(a.splits.length, 5);
  assert.ok(REF_VALUES.tailA.km < 1, "the tail row is being treated as a whole kilometre");
  // The id is a clock reading and the date agrees with it, or runStartMsKnown reads back a different day.
  assert.equal(new Date(Number(String(a.id).slice(4))).toISOString().slice(0, 10), a.dateIso);
});

test("the hard shapes are all present, and they are the app's own shapes", () => {
  // ⚠️ A FIXTURE THAT CARRIES ONLY THE TIDY RUN CERTIFIES A LAYOUT AGAINST DATA NO PLAN PRODUCES, which
  // this project has now done twice. Each of these breaks a different assumption a renderer might make.
  assert.equal(treadmillRun().route.length, 0, "the treadmill fixture has a route");
  assert.equal(treadmillRun().distKm, 0, "the treadmill fixture claims a distance");
  assert.equal(treadmillRun().splits.length, 0, "the treadmill fixture has splits to chart");
  assert.equal(intervalRun().pband, null, "the interval fixture has a kilometre band it cannot have");
  assert.equal(intervalRun().pmix, "reps", "the interval fixture is not marked as repetitions");
  const a = refRunA();
  assert.ok(Array.isArray(a.steps) && a.steps[0].tag && a.steps[0].lab,
    "run.steps is not the app's array of rows");
  assert.ok("minSecPerKm" in a.pband && "min" in a.rband,
    "pband and rband have been unified, which is how NaN:NaN once shipped");
  assert.ok(REF_ROUTE.length >= 100 && REF_ROUTE[0].t != null,
    "the route fixture is too short to survive end redaction, or carries no timestamps");
  assert.equal(HOSTILE_GROUNDS.length, 8, "the hostile-ground set has changed size");
});

// ---- the templates -------------------------------------------------------------------------------

/** The rects a plan implies, derived from its OWN published baselines and sizes. */
function planBoxes(E: Env, tmpl: string, gm: any, m: any): [string, any][] {
  const g = E.ctx();
  const cap = (s: number) => Math.round(s * E.SHARE_CAP);
  const wm = E.shareWordmarkPlan(g, gm);
  // ⚠️ THE WORDMARK'S GLYPH BOX, NOT ITS SCRIM RECT. shareWordmarkPlan's rect is deliberately taller
  // than the letters (a full em above the baseline plus a quarter below) because it sizes the solved
  // scrim, and measured against the critical region it reported the logo 8px outside it while the cap
  // tops sat 2px inside. A containment guard has to measure the ink.
  const out: [string, any][] = [["wordmark",
    E.shareRect(wm.rect.x, wm.y - cap(wm.size), wm.rect.w, cap(wm.size))]];
  if (tmpl === "moment") {
    const p = E.shareMomentPlan(g, m, gm);
    if (p.eye) out.push(["eyebrow", E.shareRect(gm.M, p.eyeBase - cap(p.eye.size), p.eye.w, cap(p.eye.size))]);
    if (p.hero) out.push(["hero", E.shareRect(gm.M, p.heroTop, p.heroW, p.heroBase - p.heroTop)]);
    if (p.badge) out.push(["badge", E.shareRect(gm.M, p.badgeTop, p.badge.w, p.badge.h)]);
    if (p.evid) out.push(["evidence", E.shareRect(gm.M,
      p.evidBase - cap(p.evid.size) - (p.evid.lines.length - 1) * p.evid.lh, gm.CW,
      cap(p.evid.size) + (p.evid.lines.length - 1) * p.evid.lh)]);
    if (p.mets.length) out.push(["metrics", E.shareRect(gm.M, p.rowTop, gm.CW, p.labelBase - p.rowTop)]);
    if (p.date) out.push(["date", E.shareRect(gm.safe.x1 - p.date.w, p.dateBase - cap(p.date.size),
      p.date.w, cap(p.date.size))]);
    return out;
  }
  const p = E.sharePosterPlan(g, m, gm, wm);
  out.push(["field", p.field]);
  if (p.eye) out.push(["eyebrow", E.shareRect(gm.M, p.eyeBase - cap(p.eye.size), p.eye.w, cap(p.eye.size))]);
  out.push(["title", E.shareRect(gm.M, p.titleBase - cap(p.title.size) - (p.title.lines.length - 1) * p.title.lh,
    gm.CW, cap(p.title.size) + (p.title.lines.length - 1) * p.title.lh)]);
  if (p.meta) out.push(["meta", E.shareRect(gm.M, p.metaBase - cap(p.meta.size), p.meta.w, cap(p.meta.size))]);
  out.push(["tag", E.shareRect(gm.M, p.tagY, E.POSTER_TAG.w, E.POSTER_TAG.h)]);
  if (p.hero) out.push(["hero", E.shareRect(gm.M, p.heroTop, p.heroW, p.heroBase - p.heroTop)]);
  out.push(["metrics", E.shareRect(gm.M, p.rowTop, gm.CW, p.labelBase - p.rowTop)]);
  out.push(["footer", E.shareRect(gm.M, p.footBase - cap(E.shareTypeSize("foot", gm.aspect)), 320,
    cap(E.shareTypeSize("foot", gm.aspect)))]);
  return out;
}

/**
 * A model, by hand, in the shape shareCardModel produces — because shareCardModel itself cannot be
 * lifted into this sandbox (it reaches runAnalysis, runVerdict, the privacy store and the DOM).
 * ⚠️ THE FIELDS ARE THE HANDOFF'S OWN NAMES. A stand-in that invented a shape would pass while the
 * real card printed undefined, which is the fixture-of-the-wrong-shape trap this area has hit twice.
 * test/share-model.test.ts runs the real builder and pins the shape; this pins what the templates do
 * with it.
 */
function fakeModel(over: any = {}): any {
  return {
    aspect: "story", template: "moment", sessionLabel: "Easy run", sessionTitle: "40 easy + strides",
    title: "40 EASY + STRIDES", coarseLocation: "Hartlepool", dateLabel: "18 Aug 2026",
    distance: 5.51, durationSeconds: 1864, averagePace: 338,
    metrics: [{ key: "time", v: "31:04", u: "MIN", k: "TIME" },
      { key: "pace", v: "5:38", u: "/KM", k: "AVG PACE" },
      { key: "elev", v: "11", u: "M", k: "ELEV" }],
    verdict: { status: "achieved", shortTitle: "STEADY AND CONTROLLED",
      evidenceLine: "5 of 6 km inside 5:20-5:50/km", confidence: "high" },
    pill: { state: "achieved", text: "STEADY AND CONTROLLED" },
    adherence: { inBand: 5, judged: 6 },
    route: Array.from({ length: 40 }, (_, i) => ({ lat: 54.77 + i * 0.0004, lng: -1.57 + (i % 7) * 0.0004 })),
    photo: { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, id: "p", bitmap: {} },
    ...over,
  };
}

test("BLOCKER: The Moment's whole hierarchy is inside the brief's critical region, and nothing collides", () => {
  // ⚠️ THE REFERENCE ITSELF IS NOT. Measured off 01-the-moment-target.png at 1080: its metric labels sit
  // at baseline 1734 and its date at 1850, both below y1680. Only the date is the brief's own named
  // exception, so the block had to move up and the reference cannot be copied here pixel for pixel.
  const E = env();
  const cases: [string, any][] = [
    ["ideal", fakeModel()],
    ["no verdict", fakeModel({ pill: null })],
    ["no distance", fakeModel({ distance: undefined, metrics: [{ key: "time", v: "34:00", u: "MIN", k: "TIME" }, { key: "avgHr", v: "141", u: "BPM", k: "AVG HR" }], pill: null, adherence: undefined })],
    ["one metric", fakeModel({ metrics: [{ key: "time", v: "31:04", u: "MIN", k: "TIME" }] })],
    ["long place", fakeModel({ coarseLocation: "Llanfairpwllgwyngyllgogerychwyrn" })],
    ["long verdict", fakeModel({ pill: { state: "partial", text: "ON PACE, BUT IT COST YOU" } })],
    ["wrapped evidence", fakeModel({ verdict: { status: "partial", confidence: "medium", shortTitle: "X", evidenceLine: "3 of 5 measured km inside 5:20-5:50/km · 2 estimated, 1 outside the target stretch" } })],
  ];
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    const crit = E.shareRect(gm.safe.x0, gm.safe.y0, gm.safe.x1 - gm.safe.x0, gm.safe.y1 - gm.safe.y0);
    for (const [label, m] of cases) {
      const boxes = planBoxes(E, "moment", gm, { ...m, aspect });
      for (const [n, r] of boxes) {
        // The date is the quiet line and may sit below the critical band; it may not leave the canvas.
        if (n === "date") {
          assert.ok(r.y + r.h <= gm.H && r.x >= 0 && r.x + r.w <= gm.W,
            aspect + " " + label + ": the date left the canvas");
          continue;
        }
        assert.ok(E.shareRectInside(r, crit),
          aspect + " " + label + ": " + n + " is outside the critical region: y " +
          Math.round(r.y) + ".." + Math.round(r.y + r.h) + " x " + Math.round(r.x) + ".." + Math.round(r.x + r.w));
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const ov = E.shareRectOverlap(boxes[i]![1], boxes[j]![1]);
        assert.equal(ov, 0, aspect + " " + label + ": " + boxes[i]![0] + " overlaps " + boxes[j]![0] +
          " by " + Math.round(ov) + "px2");
      }
      // ⚠️ NON-OVERLAP CANNOT SEE A GAP OF ZERO, and that is how the first version of this guard passed
      // with MOMENT_GAP.valueToEvidence deliberately set to 0: two cap boxes that share an edge overlap
      // by nothing at all, so the evidence line sat directly on top of the metric row and the assertion
      // was satisfied. Stacked rows have to be SEPARATED, not merely non-intersecting.
      const stack = boxes.filter((b) => b[0] !== "date" && b[0] !== "footer" && b[0] !== "field")
        .sort((a, b) => a[1].y - b[1].y);
      for (let i = 1; i < stack.length; i++) {
        const gap = stack[i]![1].y - (stack[i - 1]![1].y + stack[i - 1]![1].h);
        assert.ok(gap >= 10, aspect + " " + label + ": only " + Math.round(gap) + "px between " +
          stack[i - 1]![0] + " and " + stack[i]![0]);
      }
    }
  }
});

test("BLOCKER: with no evidence-backed verdict the badge and its evidence go, and the hero moves DOWN", () => {
  // The brief: "No evidence-backed verdict: omit coaching badge/evidence and move the hero block down;
  // do not invent praise." A top-down stack cannot do the second half without a second set of numbers.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const full = E.shareMomentPlan(g, fakeModel(), gm);
  const none = E.shareMomentPlan(g, fakeModel({ pill: null }), gm);
  assert.ok(full.badge && full.evid, "the ideal card has no badge or no evidence");
  assert.equal(none.badge, null, "a card with no verdict still draws a badge");
  assert.equal(none.evid, null, "a card with no verdict still prints its evidence line");
  assert.ok(none.heroBase > full.heroBase + 100,
    "the hero did not move down when the badge went: " + full.heroBase + " -> " + none.heroBase);
  assert.ok(none.blockTop > full.blockTop, "the block did not shorten when two rows were dropped");
  // ⚠️ AND THE EVIDENCE RIDES WITH THE BADGE EVEN WHEN IT EXISTS. A run whose judgement rests mostly on
  // estimated splits still has a true evidence line, and printed alone under nothing it reads as a
  // verdict — which is the accusation direction the model's own confidence gate exists to stop.
  const lowConf = E.shareMomentPlan(g, fakeModel({ pill: null,
    verdict: { status: "partial", confidence: "low", shortTitle: "OFF THE BRIEF TODAY",
      evidenceLine: "0 of 6 km inside 5:20-5:50/km" } }), gm);
  assert.equal(lowConf.evid, null, "a low-confidence card still printed its evidence line");
});

test("BLOCKER: a run with no distance heroes its clock and never prints a zero", () => {
  // ⚠️ A TREADMILL RUN, AND EVERY OUTDOOR RUN WHOSE GPS WAS REFUSED. The hero is the largest thing on
  // the card and "0.00" there is a confident measurement of standing still.
  const E = env();
  const noDist = fakeModel({ distance: undefined,
    metrics: [{ key: "time", v: "34:00", u: "MIN", k: "TIME" }, { key: "avgHr", v: "141", u: "BPM", k: "AVG HR" }] });
  // ⚠️ BOTH SHAPES, BECAUSE ONLY ONE OF THEM DISCRIMINATES. The model answers `undefined` for an
  // unmeasured distance, so a hero written `m.distance != null` behaves identically on that fixture and
  // a guard using only it passed the re-break. A stored ZERO is what a treadmill run's own record
  // carries (distKm: 0, dist: "0.00 km"), so it is the shape the gate has to be tested against.
  for (const zero of [undefined, 0]) {
    const h = E.shareHeroFor({ ...noDist, distance: zero });
    assert.equal(h.key, "time", "the hero is not the clock for distance " + String(zero));
    assert.equal(h.v, "34:00");
    assert.ok(!/0\.00/.test(String(h.v)), "a zero distance reached the hero");
  }
  const hero = E.shareHeroFor(noDist);
  // ⚠️ AND THE ROW DROPS THE PROMOTED NUMBER: a duplicate metric is one of the brief's named defects.
  const mets = E.shareMetricsFor(noDist, hero);
  assert.deepEqual(mets.map((x: any) => x.key), ["avgHr"], "the clock is printed twice");
  // The ordinary case keeps all three and promotes the distance.
  const ideal = fakeModel();
  assert.equal(E.shareHeroFor(ideal).key, "dist");
  assert.deepEqual(E.shareMetricsFor(ideal, E.shareHeroFor(ideal)).map((x: any) => x.key),
    ["time", "pace", "elev"]);
  // ⚠️ AND A CLOCK IN THE ROW CARRIES NO UNIT, because "31:04 MIN" reads as a number of minutes and
  // neither reference prints one. It survives on the hero, which has no label under it to say so.
  assert.equal(E.shareMetricUnit({ key: "time", v: "31:04", u: "MIN", k: "TIME" }).u, "");
  assert.equal(E.shareMetricUnit({ key: "time", v: "92:14", u: "HRS", k: "TIME" }).u, "HRS");
  assert.equal(E.shareMetricUnit({ key: "pace", v: "5:38", u: "/KM", k: "AVG PACE" }).u, "/KM");
});

test("BLOCKER: the tick is drawn for an achieved verdict and for nothing else", () => {
  // A check mark beside OFF THE BRIEF TODAY is a lie told by an icon.
  const E = env();
  const g = E.ctx();
  for (const [state, want] of [["achieved", true], ["partial", false], ["caution", false]] as const) {
    const plan = E.shareBadgePlan(g, fakeModel({ pill: { state, text: "SOMETHING" } }), 27, 952);
    assert.equal(plan.tick, want, state + " drew the wrong tick decision");
  }
  // Drawn: the tick is two segments and a stroke, and the badge is filled in the verdict's own colour.
  const g2 = E.ctx();
  const m = fakeModel();
  const plan = E.shareBadgePlan(g2, m, 27, 952);
  const g3 = E.ctx();
  E.shareBadgeDraw(g3, m, plan, 64, 1400);
  const fills = g3.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => e[1]);
  assert.ok(fills.includes(E.SHARE_INK.state.achieved), "the badge is not filled in the verdict's colour");
  assert.ok(fills.includes(E.SHARE_INK.accentInk), "the badge's text is not the dark ink");
  assert.equal(g3.calls("stroke").length, 1, "the tick is not exactly one stroked path");
  // ⚠️ THE DARK INK CLEARS AA ON EVERY REACHABLE STATE, or a filled badge is a legibility hazard.
  for (const st of ["achieved", "partial", "caution"]) {
    const col = E.SHARE_INK.state[st];
    assert.ok(col, "state " + st + " has no colour, so a filled badge would have no fill");
    const r = E.shareRatio(E.shareRelLum(E.SHARE_INK.accentInk), E.shareRelLum(col));
    assert.ok(r >= 4.5, "accentInk on " + st + " is " + r.toFixed(2) + ":1");
  }
});

test("BLOCKER: the route over a photograph is scored against every piece of copy, not just the wordmark", () => {
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const m = fakeModel();
  const p = E.shareMomentPlan(g, m, gm);
  // Every row that renders contributes a rect — that is what makes the placement honest.
  assert.ok(p.rects.length >= 5, "the plan published only " + p.rects.length + " obstacles");
  // ⚠️ AND THE SHIPPED CALL HAS TO HAND THEM OVER. Everything below builds its own obstacle list, so it
  // measures the SCORER and not the card: with .concat(p.rects) deleted from shareMomentCard the whole
  // test still passed, which is this project's assert-a-value-against-itself trap in a new place.
  const src = lift("shareMomentCard");
  const call = src.slice(src.indexOf("shareRoutePlacement("), src.indexOf("shareRouteDraw("));
  assert.match(call, /textRects:/, "the shipped placement passes no text bounds at all");
  assert.match(call, /p\.rects/, "the shipped placement scores the route against the wordmark alone");
  const box = E.sharePhotoBox(m.photo, gm.W, gm.H);
  const wm = E.shareWordmarkPlan(g, gm);
  const zone = E.shareRoutePlacement(gm, { photoBox: box, top: gm.safe.y0, bottom: p.blockTop - 32,
    textRects: [E.shareRectPad(wm.rect, 20)].concat(p.rects) });
  assert.ok(zone, "no zone survived on an ordinary centred portrait, so the route is unreachable");
  const sub = E.shareSubjectZones(box, gm);
  assert.equal(E.shareRectOverlap(zone.rect, sub.face), 0, "the chosen zone crosses the face");
  for (const r of p.rects) {
    assert.equal(E.shareRectOverlap(zone.rect, r), 0, "the chosen zone crosses a row of copy");
  }
  assert.equal(E.shareRectOverlap(zone.rect, E.shareRectPad(wm.rect, 20)), 0, "the zone crosses the logo");
  // ⚠️ AND WHEN NOTHING SURVIVES THE ROUTE IS NOT DRAWN. A photograph whose subject fills the frame has
  // no safe column, and the brief's answer is the Route Poster rather than a least-bad placement.
  const wide = E.shareRoutePlacement(gm, { photoBox: box, top: gm.safe.y0, bottom: p.blockTop - 32,
    textRects: [E.shareRect(0, 0, gm.W, gm.H)] });
  assert.equal(wide, null, "a card with no free space still placed a route");
});

test("The Moment's eyebrow is the session and the place, and it shortens rather than overflowing", () => {
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const p = E.shareMomentPlan(g, fakeModel(), gm);
  assert.equal(p.eye.text, "EASY RUN · HARTLEPOOL");
  assert.ok(p.eye.w <= gm.CW);
  // A 40-character place name fits by shrinking, and a 200-character one by shortening.
  const long = E.shareMomentPlan(g, fakeModel({ coarseLocation: "Llanfairpwllgwyngyllgogerychwyrn" }), gm);
  assert.ok(long.eye.w <= gm.CW, "a 40-character place name overflowed the margin");
  // ⚠️ AND IT FITS BY SHRINKING, NOT BY BEING CUT SHORT. shareLsFit is a total function, so a fitter that
  // cannot step down at all still returns something inside the box — it just truncates. Measured: with
  // the size ladder collapsed to one rung the width assertion above passed and the place name lost nine
  // characters, so the width alone is not the invariant.
  assert.ok(!/…$/.test(long.eye.text), "a real place name was shortened rather than fitted: " + long.eye.text);
  assert.ok(long.eye.size < E.shareTypeSize("eyebrow", "story"), "the eyebrow did not step down to fit");
  const silly = E.shareMomentPlan(g, fakeModel({ coarseLocation: "x".repeat(200) }), gm);
  assert.ok(silly.eye.w <= gm.CW, "a 200-character place name overflowed the margin");
  assert.match(silly.eye.text, /…$/, "an unfittable eyebrow was not shortened");
  // No place at all: the session alone, with no stray separator.
  const noPlace = E.shareMomentPlan(g, fakeModel({ coarseLocation: undefined }), gm);
  assert.equal(noPlace.eye.text, "EASY RUN");
});

test("BLOCKER: The Route Poster is photo-OPTIONAL, and draws no fake route either way", () => {
  // ⚠️⚠️ THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-08-20, AND THE REVERSAL IS THE OWNER'S: "I want them
  // to be able to add a photo to any of the cards that you have created, it doesn't matter if the route
  // line sits over the top of their photo." The pack calls this template "route-led, photo-free" and the
  // model used to hand it null BY NAME. What survives unchanged is the other half — the route is forced
  // on, and a card with no route draws nothing at all rather than a decorative line.
  const E = env();
  const model = lift("shareCardModel");
  assert.ok(!/tmpl === "route".*\? null/.test(model),
    "the poster is still refused a photograph by name, so the ruling has not reached the model");
  assert.match(model, /photo: sharePhotoView\(opt\.photo, tmpl, opt\.aspect\)/,
    "the photograph is gated per template again, so a fifth template inherits whichever half is written first");
  // ⚠️ AND ITS ROUTE IS FORCED ON. shareRouteOn defaults to off when a photograph exists, which would
  // leave the poster an empty field under a distance hero — and that default now bites on this template
  // for real, because it can carry a photograph.
  assert.match(model, /tmpl === "route" \|\| opt\.routeOn/, "the poster's route is still optional");
  const g = E.ctx();
  const gm = E.cardGeom("story");
  const wm = E.shareWordmarkPlan(g, gm);
  // No photograph: the matte ground, no image drawn, and no route means no markers.
  E.sharePosterCard(g, fakeModel({ template: "route", photo: null, route: null }), gm, null, wm);
  assert.equal(g.calls("drawImage").length, 0, "the poster drew an image it was given none of");
  assert.equal(g.calls("arc").length, 0, "something round was drawn where the route would be");
  // ⚠️ AND WITH A PHOTOGRAPH IT COMPOSITES ONE, THROUGH THE SHARED PATH. The claim is that the picture
  // reaches the canvas at all: before the ruling this template ignored it by construction, so a card
  // built with one drew the topographic ground and the runner's photograph appeared nowhere.
  const g2 = E.ctx();
  const shot = { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, bitmap: {} };
  E.sharePhotoDraw(g2, shot, gm);
  assert.ok(g2.calls("drawImage").length > 0, "the shared photo path draws nothing");
  const poster = lift("sharePosterCard");
  assert.match(poster, /sharePhotoScrim\(g, gm, probe,/,
    "the poster composites a photograph without the shared solved scrim");
  // ⚠️ THE WORDMARK'S PROTECTION IS NOW ITS OWN EDGE, AND THE CLAIM IS ASSERTED OVER EVERY TEMPLATE
  // RATHER THAN THIS ONE. The fade across the top of the card is gone (owner, 2026-08-20) and five
  // templates draw the wordmark; a sixth written without the edge would ship the recorded 2.09:1 defect on
  // one card only, so the sweep is derived from every call site in the build instead of naming the poster.
  // ⚠️ THE DECLARATION IS NOT A CALL SITE, and the first version of this sweep counted it — so it reported
  // the parameter list as a wordmark drawn with no edge. Excluded by the keyword in front of it.
  const wmCalls = [...appScript().matchAll(/(function )?shareWordmark\(g, [^)]*\)/g)]
    .filter((m) => !m[1]).map((m) => m[0]);
  assert.ok(wmCalls.length >= 5, "only " + wmCalls.length + " wordmark call sites found");
  for (const c of wmCalls) {
    assert.match(c, /wm\.edge\)$/, "a wordmark is drawn without the plan's own edge: " + c);
  }
  assert.match(lift("shareDrawBody"), /shareWordmarkPlan\(g, gm, probe \? S : 0\)/,
    "the edge is no longer decided once, from the presence of a photograph");
  // ⚠️ AND ITS FAINTEST TIER IS LIFTED WHEN THERE IS A PICTURE, from ONE variable read by the solver AND
  // by every fill. Measured against a white ground the faint tier solves alpha 0.88 where the soft tier
  // solves 0.78, so asking for it costs ten points of somebody's photograph — and on a solved scrim the
  // soft tier is what the rest of the family already sets for these rungs. A palette that disagreed with
  // the scrim solved for it is the whole class of defect the solver exists to prevent.
  assert.match(poster, /const quiet = shareQuietInk\(m\);/,
    "the poster's quiet tier is not one derivation");
  // ⚠️ ZERO NOW, BECAUSE THE DERIVATION MOVED OUT OF THIS TEMPLATE. It used to be the poster's own
  // conditional and the count of 1 was what stopped a second copy appearing beside it; the rule is
  // shareQuietInk's, so the poster may not name the tier at all — which is the stronger claim, and the
  // tier's own reachability is asserted where the rule lives.
  assert.equal((poster.match(/SHARE_INK\.inkFaint/g) || []).length, 0,
    "the poster names the faint tier directly instead of asking shareQuietInk for it");
  assert.ok((poster.match(/\bquiet\b/g) || []).length >= 4,
    "the derived tier is not read by every rung that used to name the faint one");
});

test("BLOCKER: the poster's route field takes the brief's 8-10% internal padding and keeps the shape", () => {
  const E = env();
  const g = E.ctx();
  assert.ok(E.SHARE_POSTER_PAD >= 0.08 && E.SHARE_POSTER_PAD <= 0.10,
    "the poster's padding left the brief's band: " + E.SHARE_POSTER_PAD);
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    const wm = E.shareWordmarkPlan(g, gm);
    const p = E.sharePosterPlan(g, fakeModel({ template: "route", photo: null }), gm, wm);
    // The field is between the wordmark and the block, full content width, and a real box.
    assert.ok(p.field.y >= wm.rect.y + wm.rect.h, aspect + ": the field starts inside the wordmark");
    assert.ok(p.field.y + p.field.h <= p.blockTop, aspect + ": the field runs into the lower block");
    assert.equal(p.field.x, gm.M);
    assert.equal(p.field.w, gm.CW);
    assert.ok(p.field.h > gm.H * 0.30, aspect + ": the field collapsed to " + Math.round(p.field.h));
    // The projection preserves the run's own aspect inside that field.
    const route = Array.from({ length: 30 }, (_, i) => ({ lat: 54.77 + i * 0.0006, lng: -1.57 + (i % 4) * 0.0009 }));
    const pr = E.shareRouteProject(route, p.field, E.SHARE_POSTER_PAD);
    const pad = Math.round(Math.min(p.field.w, p.field.h) * E.SHARE_POSTER_PAD);
    assert.equal(pr.pad, pad);
    assert.ok(pr.box.w <= p.field.w - 2 * pad + 1 && pr.box.h <= p.field.h - 2 * pad + 1,
      aspect + ": the route escaped its own padding");
  }
});

test("BLOCKER: ROUTE 018 is not fabricated, and the footer is a credit line rather than a second logo", () => {
  // The brief: "an optional local activity sequence label only if the product has a truthful
  // equivalent. Otherwise omit it; do not fabricate route numbers."
  const cl = closure("drawShareCard");
  const all = [...cl.values()].join("\n");
  assert.ok(!/ROUTE\s*0?\d/.test(all), "something route-numbered is being printed");
  // ⚠️ ONE WORDMARK, ONE OWNER. The poster's footer is caps-and-tracking like every other small label
  // here; the logo itself is only ever shareWordmark, and only drawShareCard's templates call it.
  const poster = cl.get("sharePosterCard")!;
  assert.equal((poster.match(/shareWordmark\(/g) || []).length, 1,
    "the poster draws the wordmark more than once");
  assert.match(poster, /BUILT WITH /, "the brief's quiet footer is missing");
  // ⚠️ SCOPED TO WHAT DRAWS IT, NOT TO WHAT MENTIONS IT. shareWordmarkWidth is the measure-only twin and
  // has to name the same two runs; a guard on the literal alone condemned it. The thing that must have
  // one owner is the DRAWING, because a second one is a definition of the logo that can drift.
  const drawnByHand = [...cl.entries()].filter(([n, b]) => n !== "shareWordmark" && /fillText\("Inte-"/.test(b));
  assert.deepEqual(drawnByHand.map((e) => e[0]), [],
    "the wordmark is re-drawn outside shareWordmark by: " + drawnByHand.map((e) => e[0]).join(", "));
  assert.match(lift("shareWordmark"), /fillText\("Inte-"/, "shareWordmark no longer draws the wordmark");
});

test("BLOCKER: the poster's adherence column is only drawn when there is an honest one", () => {
  // ⚠️ THIS IS THE ONE COLUMN A MAP APP CANNOT PRINT, which is exactly why it may not be faked. Both
  // gates matter: m.adherence answers "was anything measured against a target", and m.pill answers
  // "is this judgement strong enough to publish".
  const E = env();
  const ideal = fakeModel({ template: "route", photo: null });
  const three = E.sharePosterMetrics(ideal, E.shareHeroFor(ideal));
  assert.deepEqual(three.map((x: any) => x.key), ["time", "pace", "onTarget"]);
  assert.equal(three[2].v, "5");
  assert.equal(three[2].v2, "6");
  assert.equal(three[2].mid, "OF");
  assert.equal(three[2].k, "KM ON TARGET");
  // No target applied to anything measured: the shared ladder answers instead.
  const noAdh = fakeModel({ template: "route", photo: null, adherence: undefined });
  assert.deepEqual(E.sharePosterMetrics(noAdh, E.shareHeroFor(noAdh)).map((x: any) => x.key),
    ["time", "pace", "elev"]);
  // Judged, but not strongly enough to publish a verdict: the count goes with the badge.
  const lowConf = fakeModel({ template: "route", photo: null, pill: null });
  assert.deepEqual(E.sharePosterMetrics(lowConf, E.shareHeroFor(lowConf)).map((x: any) => x.key),
    ["time", "pace", "elev"]);
});

test("BLOCKER: the poster's hierarchy is inside the critical region and nothing collides", () => {
  const E = env();
  const cases: [string, any][] = [
    ["ideal", fakeModel({ template: "route", photo: null })],
    ["no verdict", fakeModel({ template: "route", photo: null, pill: null, adherence: undefined })],
    ["longest real title", fakeModel({ template: "route", photo: null,
      title: "MONA FARTLEK: 2 × (90/60/30/15″ HARD, EQUAL FLOAT)" })],
    ["long place", fakeModel({ template: "route", photo: null,
      coarseLocation: "Llanfairpwllgwyngyllgogerychwyrn" })],
    ["one split", fakeModel({ template: "route", photo: null, adherence: { inBand: 1, judged: 1 } })],
    ["no place or date", fakeModel({ template: "route", photo: null, coarseLocation: undefined, dateLabel: "" })],
  ];
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    const crit = E.shareRect(gm.safe.x0, gm.safe.y0, gm.safe.x1 - gm.safe.x0, gm.safe.y1 - gm.safe.y0);
    for (const [label, m] of cases) {
      const boxes = planBoxes(E, "route", gm, { ...m, aspect });
      for (const [n, r] of boxes) {
        if (n === "footer") {
          assert.ok(r.y + r.h <= gm.H, aspect + " " + label + ": the footer left the canvas");
          continue;
        }
        assert.ok(E.shareRectInside(r, crit), aspect + " " + label + ": " + n + " is outside the critical region: y " +
          Math.round(r.y) + ".." + Math.round(r.y + r.h));
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i]![0] === "field" || boxes[j]![0] === "field") continue;
        const ov = E.shareRectOverlap(boxes[i]![1], boxes[j]![1]);
        assert.equal(ov, 0, aspect + " " + label + ": " + boxes[i]![0] + " overlaps " + boxes[j]![0]);
      }
    }
  }
});

test("BLOCKER: the quiet line has its own band on a feed post, where there is no platform reserve", () => {
  // ⚠️ MEASURED: anchored to the canvas bottom in both aspects, the feed poster's footer landed 23px
  // under the metric labels at the same left margin — "TIME" with "BUILT WITH INTE-RUN" beneath it,
  // which reads as a fourth column heading. A story has 240px of quiet band and a feed post has 64.
  const E = env();
  assert.equal(E.shareQuietPlan(E.cardGeom("story"), 19).reserve, 0,
    "a story reserves room it already has");
  assert.ok(E.shareQuietPlan(E.cardGeom("feed"), 19).reserve > 40,
    "a feed post does not reserve room for its footer");
  const g = E.ctx();
  for (const tmpl of ["moment", "route"]) {
    const gm = E.cardGeom("feed");
    const m = fakeModel({ template: tmpl, photo: tmpl === "route" ? null : fakeModel().photo, aspect: "feed" });
    const boxes = planBoxes(E, tmpl, gm, m);
    const quiet = boxes.filter((b) => b[0] === "date" || b[0] === "footer")[0];
    const mets = boxes.filter((b) => b[0] === "metrics")[0];
    assert.ok(quiet && mets, tmpl + ": the feed card has no quiet line or no metric row");
    assert.ok(quiet[1].y - (mets[1].y + mets[1].h) >= 20,
      tmpl + ": the quiet line sits " + Math.round(quiet[1].y - (mets[1].y + mets[1].h)) +
      "px under the metric row");
  }
});

test("the feed is a reflow: the type tightens and the block takes a bigger share of a shorter canvas", () => {
  // The brief: "Recompose, do not crop the Story output. Reduce photographic share of the canvas,
  // tighten headline scale ... and preserve all essential metrics."
  const E = env();
  const g = E.ctx();
  for (const tmpl of ["moment", "route"]) {
    const out: any = {};
    for (const aspect of ["story", "feed"]) {
      const gm = E.cardGeom(aspect);
      const m = fakeModel({ template: tmpl, aspect, photo: tmpl === "route" ? null : fakeModel().photo });
      const p = tmpl === "moment" ? E.shareMomentPlan(g, m, gm)
        : E.sharePosterPlan(g, m, gm, E.shareWordmarkPlan(g, gm));
      out[aspect] = { H: gm.H, top: p.blockTop, bottom: p.labelBase, hero: p.heroS,
        share: (p.labelBase - p.blockTop) / gm.H, mets: p.mets.length };
    }
    assert.ok(out.feed.hero < out.story.hero, tmpl + ": the hero did not tighten on the feed");
    assert.ok(out.feed.share > out.story.share + 0.03,
      tmpl + ": the block's share did not grow on the feed — story " + out.story.share.toFixed(3) +
      " feed " + out.feed.share.toFixed(3));
    assert.equal(out.feed.mets, out.story.mets, tmpl + ": the feed lost a metric");
  }
});

test("every number on both templates goes through the digit-column primitive", () => {
  // ⚠️ shareFig, NOT fillText. Measured at 800/84px, a "1" is 41.34px wide and an "8" is 55.90px, so a
  // three-column metric row shifts sideways depending on which run is being shared.
  const cl = closure("drawShareCard");
  for (const name of ["shareMomentCard", "sharePosterCard", "shareMetricDraw"]) {
    const b = cl.get(name)!;
    if (!/hero\.v|st\.v/.test(b)) continue;
    assert.ok(/shareFig\(g, (?:p\.hero\.v|st\.v|st\.v2)/.test(b),
      name + " draws a value without the digit-column primitive");
  }
  // And the value the card prints is never assembled here: it comes off the model.
  const moment = cl.get("shareMomentCard")!;
  assert.ok(!/toFixed|Math\.round\(m\./.test(moment), "the template is computing a number of its own");
});

test("the templates read the model and never the run", () => {
  // ⚠️ THE RENDERER CANNOT SEE THE RUN, and that is what makes "hide the route" unrepeatable rather
  // than merely fixed: before it, the card drew run.route raw under a sheet promising otherwise.
  const cl = closure("drawShareCard");
  for (const [name, b] of cl) {
    assert.ok(!/\brun\.[a-z]/i.test(b), name + " reads a field off the run rather than off the model");
    assert.ok(!/runAnalysis\(|runVerdict\(|runRoutePresentation\(|sharePrivacyFor\(/.test(b),
      name + " recomputes a fact the model already carries");
  }
});

/* ============================================================================================== *
 * PHASE 4 — THE EXECUTION AND THE PROGRESSION                                                    *
 * ============================================================================================== */

/** The two data-led templates' own model fields, on top of the shared ones. */
function execModel(over: any = {}): any {
  return fakeModel({
    template: "execution", photo: { w: 1200, h: 1800, ox: 0.5, oy: 0.5, k: 1, id: "p", bitmap: {} },
    band: { minSecPerKm: 320, maxSecPerKm: 370 },
    rows: [351, 337, 336, 333, 334, 340].map((sec, i) =>
      ({ km: i + 1, sec: sec, verdict: "in", delta: 0, judged: true, est: false })),
    n: 6, inBand: 6, fastest: 333, slowest: 351,
    splits: [351, 337, 336, 333, 334, 340].map((sec, i) => ({ km: i + 1, sec: sec, verdict: "in", judged: true, est: false })),
    stats: [{ key: "dist", v: "6.31", u: "KM", k: "DISTANCE" },
      { key: "time", v: "35:42", u: "MIN", k: "TIME" },
      { key: "pace", v: "5:40", u: "/KM", k: "AVG PACE" }],
    target: { paceMinSecPerKm: 320, paceMaxSecPerKm: 370 },
    ...over,
  });
}
function progModel(over: any = {}): any {
  return execModel({
    template: "progression",
    progression: { claim: "FINISHED STRONG", evidence: "Final 2 km averaged 5:29/km" },
    ...over,
  });
}

/**
 * EVERY GLYPH BOX AND GRAPHIC BOX THE TWO DATA-LED TEMPLATES PLACE, so containment and collision can be
 * asked of all of them at once.
 * ⚠️ THE INK, NOT THE ELEMENT'S GENEROUS RECT — the same lesson planBoxes records about the wordmark.
 * A cap height per text run and the real plot rectangle for the chart.
 */
function tmplBoxes(E: Env, gm: any, m: any): [string, any][] {
  const g = E.ctx();
  const cap = (s: number) => Math.round(s * E.SHARE_CAP);
  const wm = E.shareWordmarkPlan(g, gm);
  const out: [string, any][] = [["wordmark",
    E.shareRect(wm.rect.x, wm.y - cap(wm.size), wm.rect.w, cap(wm.size))]];
  const block = (name: string, base: number, f: any, w?: number) => {
    if (!f) return;
    const h = cap(f.size) + ((f.lines ? f.lines.length : 1) - 1) * (f.lh || 0);
    out.push([name, E.shareRect(gm.M, base - h, w == null ? gm.CW : w, h)]);
  };
  if (m.template === "execution") {
    const p = E.shareExecutionPlan(g, m, gm);
    block("eyebrow", p.eyeBase, p.eye, p.eye && p.eye.w);
    block("verdict", p.verdBase, p.verd);
    block("sentence", p.sentBase, p.sent);
    block("chart label", p.capBase, p.capL, p.capL && p.capL.w);
    if (p.capR) out.push(["target range", E.shareRect(gm.safe.x1 - p.capR.w,
      p.capBase - cap(p.capR.size), p.capR.w, cap(p.capR.size))]);
    out.push(["chart", E.shareRect(gm.M, p.chartTop, gm.CW, p.chartBottom - p.chartTop)]);
    out.push(["axis", E.shareRect(gm.M, p.axisBase - cap(p.axisS), gm.CW, cap(p.axisS))]);
    if (p.mets.length) out.push(["metrics", E.shareRect(gm.M, p.rowTop, gm.CW, p.labelBase - p.rowTop)]);
    if (p.date) out.push(["date", E.shareRect(gm.safe.x1 - p.date.w, p.dateBase - cap(p.date.size),
      p.date.w, cap(p.date.size))]);
    return out;
  }
  const p = E.shareProgressionPlan(g, m, gm);
  block("eyebrow", p.eyeBase, p.eye, p.eye && p.eye.w);
  block("headline", p.headBase, p.head);
  block("interpretation", p.interpBase, p.interp);
  if (p.rows.length) {
    out.push(["splits label", E.shareRect(gm.M, p.secBase - cap(p.secS), 240, cap(p.secS))]);
    out.push(["ladder", E.shareRect(gm.M, p.firstBase - cap(p.rowS), gm.CW,
      (p.rows.length - 1) * p.pitch + cap(p.rowS))]);
  }
  if (p.mets.length) out.push(["metrics", E.shareRect(gm.M, p.rowTop, gm.CW, p.labelBase - p.rowTop)]);
  if (p.date) out.push(["date", E.shareRect(gm.safe.x1 - p.date.w, p.dateBase - cap(p.date.size),
    p.date.w, cap(p.date.size))]);
  return out;
}
/** A split row in the shape runAnalysis emits, so the ladder and the chart get the real thing. */
function rows(secs: number[], over: ((i: number) => any) | null = null): any[] {
  return secs.map((sec, i) => ({ km: i + 1, sec: sec, verdict: "in", delta: 0, judged: true, est: false,
    ...(over ? over(i) : {}) }));
}

test("BLOCKER: both new templates export at exactly the required pixel dimensions", () => {
  // ⚠️ THE CHEAPEST GUARD IN THE WHOLE AREA AND IT DID NOT EXIST BEFORE PHASE 2. Restated per template
  // because the dispatch is per template: a plan that reached for a size of its own would pass a guard
  // written only on the geometry.
  const E = env();
  for (const [aspect, W, H] of [["story", 1080, 1920], ["feed", 1080, 1350]] as [string, number, number][]) {
    const gm = E.cardGeom(aspect);
    assert.equal(gm.W, W, aspect + " is " + gm.W + " wide");
    assert.equal(gm.H, H, aspect + " is " + gm.H + " tall");
    for (const build of [execModel, progModel]) {
      const m = build({ aspect: aspect });
      const p = m.template === "execution"
        ? E.shareExecutionPlan(E.ctx(), m, gm) : E.shareProgressionPlan(E.ctx(), m, gm);
      assert.ok(p.labelBase <= gm.safe.y1, m.template + "/" + aspect +
        ": the metric labels sit at " + p.labelBase + ", outside the critical region's " + gm.safe.y1);
      assert.ok(p.dateBase < gm.H, m.template + "/" + aspect + ": the date is off the canvas");
    }
  }
});

test("BLOCKER: the photograph keeps the share of the story the contract asks for", () => {
  // ⚠️ TWO DIFFERENT NUMBERS, ONE PER TEMPLATE, AND BOTH ARE QUOTED FROM THE CONTRACT: The Execution's
  // "upper 52-58% remains photographic and uncluttered" and The Progression's "upper half remains an
  // unobstructed photograph". They are the reason each template has one element that gives way — the
  // verdict's point size and the ladder's row pitch — and without a guard the first extra line of copy
  // silently eats the picture.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const cases: [string, any, number, number][] = [
    ["execution ideal", execModel(), 0.52, 0.58],
    ["execution long verdict", execModel({ pill: { state: "partial", text: "ON PACE, BUT IT COST YOU" } }), 0.52, 0.58],
    ["execution wrapped evidence", execModel({ verdict: { status: "partial", confidence: "medium", shortTitle: "X", evidenceLine: "3 of 5 measured km inside 5:20-5:50/km · 2 estimated, 1 outside the target stretch" } }), 0.52, 0.58],
    ["execution one word", execModel({ pill: { state: "achieved", text: "LOGGED" } }), 0.52, 0.60],
    ["progression 6 rows", progModel({ splits: rows([351, 337, 336, 333, 334, 340]) }), 0.50, 0.62],
    ["progression 3 rows", progModel({ splits: rows([351, 337, 336]) }), 0.50, 0.66],
    ["progression no claim", progModel({ progression: undefined }), 0.50, 0.68],
    ["progression 42 km", progModel({ splits: rows(Array.from({ length: 42 }, (_, i) => 300 + (i % 5))) }), 0.50, 0.62],
  ];
  for (const [label, m, lo, hi] of cases) {
    const p = m.template === "execution" ? E.shareExecutionPlan(g, m, gm) : E.shareProgressionPlan(g, m, gm);
    assert.ok(p.photoFrac >= lo, label + ": the photograph is only " +
      (p.photoFrac * 100).toFixed(1) + "% of the story, under the contract's " + (lo * 100) + "%");
    assert.ok(p.photoFrac <= hi, label + ": the block starts at " +
      (p.photoFrac * 100).toFixed(1) + "%, leaving the lower section too little");
  }
  // ⚠️ AND THE FLOOR IS STORY-ONLY, WHICH IS THE BRIEF'S OWN INSTRUCTION FOR THE FEED: "reduce
  // photographic share of the canvas". Holding 52% on a 570px shorter canvas would shrink the verdict to
  // nothing, so the feed is asserted to go the other way rather than merely being exempt.
  const feed = E.cardGeom("feed");
  const fe = E.shareExecutionPlan(g, execModel({ aspect: "feed" }), feed);
  const se = E.shareExecutionPlan(g, execModel(), gm);
  assert.ok(fe.photoFrac < se.photoFrac - 0.05, "the feed did not reduce the photographic share: story " +
    se.photoFrac.toFixed(3) + " feed " + fe.photoFrac.toFixed(3));
  assert.equal(E.sharePhotoFloor(feed, "execution"), 0, "a feed post is holding a photographic floor");
});

test("BLOCKER: the chart's pace direction is faster-is-higher, and it is the documented one", () => {
  // ⚠️ SECONDS PER KILOMETRE RUN DOWNWARD AS A NUMBER AND UPWARD AS A PERFORMANCE, so a chart plotted on
  // the raw value puts the best kilometre at the bottom. The contract asks for the direction to be
  // "consistent and tested"; this is the test, and it is asserted on the DRAWN y of two markers rather
  // than on the source of the mapping.
  const E = env();
  const g = E.ctx();
  const m = execModel({ rows: rows([400, 300]), n: 2, fastest: 300, slowest: 400 });
  E.shareBandChart(g, m, 64, 1000, 952, 86);
  const arcs = g.log.filter((e: any[]) => e[0] === "arc");
  assert.ok(arcs.length >= 2, "the chart drew " + arcs.length + " markers for two kilometres");
  // The first marker is the SLOW one (400 s), the second the fast one (300 s).
  const slowY = arcs[0]![2], fastY = arcs[arcs.length - 1]![2];
  assert.ok(fastY < slowY, "the faster kilometre is drawn at y" + fastY +
    ", below the slower one at y" + slowY + " — the pace axis is upside down");
  // And the same mapping is what the band's own edges use, so the lane cannot be inverted separately.
  const r = E.shareBandChart(E.ctx(), m, 64, 1000, 952, 86);
  assert.ok(r.yFast < r.ySlow, "the band's quick edge is drawn below its slow edge");
  assert.ok(r.Y(300) < r.Y(400), "Y is not monotone decreasing in seconds");
});

test("BLOCKER: an on-target marker and a missed one differ in SHAPE, not only in colour", () => {
  // ⚠️ "COLOUR IS NOT THE SOLE INDICATOR OF ON/OFF-TARGET SPLITS" IS AN ACCESSIBILITY REQUIREMENT, and
  // the reference draws every marker as the same ring. Asserted on the geometry each verdict produces —
  // an arc for in-band and for unjudged, a closed three-point path for a miss — because a guard that
  // only checked the fill colours would pass on four identical circles.
  const E = env();
  const shapes: Record<string, { arcs: number; tris: number; fills: number; strokes: number }> = {};
  for (const kind of ["in", "fast", "slow", "none"]) {
    const g = E.ctx();
    E.shareChartMarker(g, kind, 500, 1000, 11, "#32c8b2");
    const moves = g.log.filter((e: any[]) => e[0] === "moveTo").length;
    shapes[kind] = { arcs: g.log.filter((e: any[]) => e[0] === "arc").length,
      tris: g.log.filter((e: any[]) => e[0] === "closePath").length,
      fills: g.log.filter((e: any[]) => e[0] === "fill").length,
      strokes: g.log.filter((e: any[]) => e[0] === "stroke").length };
    assert.ok(moves + shapes[kind]!.arcs > 0, kind + " draws nothing at all");
  }
  assert.ok(shapes.in!.arcs >= 2 && shapes.in!.tris === 0, "in-band is not the ring the reference shows");
  assert.ok(shapes.fast!.tris === 1 && shapes.fast!.arcs === 0, "a quick kilometre is not a distinct shape");
  assert.ok(shapes.slow!.tris === 1 && shapes.slow!.arcs === 0, "a slow kilometre is not a distinct shape");
  // ⚠️ AND THE TWO MISSES POINT OPPOSITE WAYS, so the shape says WHICH way it missed rather than only
  // that it did. Compared on the apex, which is the only vertex that moves.
  const apex = (kind: string) => {
    const g = E.ctx();
    E.shareChartMarker(g, kind, 500, 1000, 11, "#e6ac3e");
    return (g.log.filter((e: any[]) => e[0] === "moveTo")[0] as any[])[2];
  };
  assert.ok(apex("fast") < 1000, "the quick marker does not point upward");
  assert.ok(apex("slow") > 1000, "the slow marker does not point downward");
  // Unjudged is an outline with no fill: a filled marker in any colour claims the band was applied.
  assert.equal(shapes.none!.fills, 0, "an unjudged kilometre is filled, which claims it was scored");
  // ⚠️ TWO STROKES, NOT ONE, AND RESTATING THIS WAS THE WORK RATHER THAN RELAXING IT. It asserted exactly
  // one stroke, which the keyline pass broke — and the lazy fix is to change 1 to 2 and lose the meaning.
  // What matters is that the outline exists, is the marker's own colour, and has a WIDER deep keyline
  // underneath it, which is what makes an unfilled ring visible over a photograph at all.
  const un = E.ctx();
  E.shareChartMarker(un, "none", 500, 1000, 11, E.SHARE_INK.unjudged);
  const strokes: [string, number][] = [];
  let sty = "", lw = 0;
  for (const e of un.log as any[][]) {
    if (e[0] === "strokeStyle") sty = String(e[1]);
    if (e[0] === "lineWidth") lw = Number(e[1]);
    if (e[0] === "stroke") strokes.push([sty, lw]);
  }
  assert.equal(strokes.length, 2, "an unjudged kilometre is not a keyline plus an outline: " +
    JSON.stringify(strokes));
  assert.equal(strokes[0]![0], E.SHARE_INK.keyline, "the first pass is not the deep keyline");
  assert.equal(strokes[1]![0], E.SHARE_INK.unjudged, "the outline is not drawn in the unjudged colour");
  assert.ok(strokes[0]![1] > strokes[1]![1], "the keyline is not wider than the outline it sits under");
});

test("BLOCKER: the chart's axis is labelled, keeps both ends, and cannot collide", () => {
  // ⚠️ AN UNLABELLED CHART IS ONE OF THE BRIEF'S NAMED DEFECTS AND A COLLIDING ONE IS ANOTHER. Six
  // labels across 952px is the reference; a marathon is forty-two, and at 23px of spacing they overprint
  // into a smear. Swept from three kilometres to fifty rather than checked on the reference's six.
  const E = env();
  const g = E.ctx();
  const size = E.shareTypeSize("label", "story"), track = E.SHARE_TRACK.label;
  for (let n = 2; n <= 50; n++) {
    const rr = rows(Array.from({ length: n }, () => 330));
    const keep = E.shareAxisKeep(g, rr, 952, size, track);
    assert.ok(keep.length >= 2 || n === 1, n + " kilometres produced " + keep.length + " axis labels");
    assert.equal(keep[0], 0, n + ": the first kilometre is unlabelled");
    assert.equal(keep[keep.length - 1], n - 1, n + ": the LAST kilometre is unlabelled, so the reader " +
      "cannot say how long the run was");
    // Strictly increasing, and far enough apart that the widest label cannot overprint its neighbour.
    g.font = E.shareFont(700, size);
    const span = n > 1 ? 952 / (n - 1) : 952;
    let widest = 0;
    for (const r of rr) widest = Math.max(widest, E.cardLsWidth(g, r.km + "KM", track));
    for (let i = 1; i < keep.length; i++) {
      assert.ok(keep[i]! > keep[i - 1]!, n + ": the axis labels are not in order");
      const gap = (keep[i]! - keep[i - 1]!) * span;
      assert.ok(gap >= widest, n + ": labels " + keep[i - 1] + " and " + keep[i] + " are " +
        gap.toFixed(1) + "px apart with a widest label of " + widest.toFixed(1) + "px");
    }
  }
});

test("BLOCKER: the split ladder can never cherry-pick, and every kilometre is in exactly one row", () => {
  // ⚠️ "NEVER SILENTLY CHERRY-PICK THE BEST SPLITS" IS THE RULE AND THIS IS THE PROOF: membership is a
  // function of POSITION alone. Shuffling the paces — including putting the fastest kilometre first and
  // last — cannot move a kilometre into a different row, and nothing is dropped for being inconvenient.
  const E = env();
  for (let n = 3; n <= 60; n++) {
    const base = E.shareLadderRows({ splits: rows(Array.from({ length: n }, (_, i) => 300 + i)) });
    assert.ok(base.length <= E.SHARE_LADDER.max, n + " splits produced " + base.length + " rows");
    assert.ok(base.length >= Math.min(3, n), n + " splits produced only " + base.length + " rows");
    const members = base.flatMap((r: any) => r.members);
    assert.deepEqual(members, Array.from({ length: n }, (_, i) => i + 1),
      n + ": the rows do not cover every kilometre exactly once, in order");
    // ⚠️ THE DISCRIMINATOR. Same indices, wildly different values: identical membership or the selection
    // is looking at the paces.
    const hostile = [
      Array.from({ length: n }, (_, i) => 200 + (i % 2) * 400),
      Array.from({ length: n }, (_, i) => (i === 0 ? 200 : i === n - 1 ? 210 : 600)),
      Array.from({ length: n }, (_, i) => 600 - i * 3),
    ];
    for (const secs of hostile) {
      const alt = E.shareLadderRows({ splits: rows(secs) });
      assert.deepEqual(alt.map((r: any) => r.members), base.map((r: any) => r.members),
        n + ": the row membership changed when only the paces changed — the ladder is cherry-picking");
      assert.deepEqual(alt.map((r: any) => r.label), base.map((r: any) => r.label),
        n + ": the row labels depend on the paces");
    }
    // The blocked value is the block's own mean, not its best member.
    if (base.length < n) {
      const secs = Array.from({ length: n }, (_, i) => 300 + i);
      const built = E.shareLadderRows({ splits: rows(secs) });
      for (const r of built) {
        const mean = Math.round(r.members.reduce((x: number, km: number) => x + secs[km - 1]!, 0) / r.members.length);
        assert.equal(r.sec, mean, n + ": row " + r.label + " reports " + r.sec + " where its members mean " + mean);
      }
    }
  }
  // ⚠️ AN ESTIMATED SPLIT IS NOT A COMPARABLE ONE, so it is excluded — and the kilometre NUMBERS are
  // the real ones, so the gap is visible rather than papered over by renumbering.
  const withEst = E.shareLadderRows({ splits: rows([351, 337, 336, 333, 334],
    (i: number) => (i === 0 || i === 3 ? { est: true } : {})) });
  assert.deepEqual(withEst.map((r: any) => r.label), ["2 KM", "3 KM", "5 KM"],
    "an estimated kilometre reached the ladder, or the survivors were renumbered");
});

test("BLOCKER: the ladder's bars share one honest scale with a minimum visible range", () => {
  // ⚠️ "BARS SHARE ONE HONEST SCALE BASED ON THE DISPLAYED RANGE WITH A MINIMUM VISIBLE RANGE TO AVOID
  // EXAGGERATING TINY DIFFERENCES." Both halves are asserted: monotone in pace, and a two-second spread
  // must not draw as a full-to-empty sweep.
  const E = env();
  const tight = E.shareLadderScale(rows([330, 331, 332]));
  const wide = E.shareLadderScale(rows([300, 330, 360]));
  // Faster is longer, always.
  for (const sc of [tight, wide]) {
    assert.ok(sc.frac(300) > sc.frac(360), "a quicker kilometre draws a shorter bar");
    assert.ok(sc.frac(330) > sc.frac(331), "the scale is not strictly monotone");
  }
  // The floor: no bar is invisible, none exceeds the track.
  for (const sec of [200, 300, 330, 400, 900]) {
    for (const sc of [tight, wide]) {
      assert.ok(sc.frac(sec) >= 0 && sc.frac(sec) <= 1.0001,
        "a bar fraction of " + sc.frac(sec).toFixed(3) + " is outside the track");
    }
  }
  assert.ok(E.SHARE_LADDER.minBar >= 0.25, "the slowest kilometre draws as almost nothing");
  // ⚠️ THE MINIMUM RANGE, MEASURED. Two seconds apart, the two bars must differ by less than a tenth of
  // the track; without the floor they are the full sweep from minBar to 1 and the card says the runner
  // fell apart. Computed: 0.35 + 0.65 * 2/25 = 0.052 of the track.
  const spread = tight.frac(330) - tight.frac(332);
  assert.ok(spread < 0.12, "a two-second spread draws as " + (spread * 100).toFixed(1) +
    "% of the track, which exaggerates it");
  assert.ok(spread > 0.001, "a two-second spread draws as nothing at all");
  assert.equal(E.SHARE_LADDER.minSpan, E.SHARE_EVEN_SPREAD_S,
    "the ladder's minimum range and the debrief's own evenness threshold have drifted apart");
  // A genuinely wide spread uses the whole track, so the floor cannot flatten a real difference.
  assert.ok(wide.frac(300) - wide.frac(360) > 0.6,
    "a sixty-second spread only uses " + ((wide.frac(300) - wide.frac(360)) * 100).toFixed(0) + "% of the track");
});

test("BLOCKER: FINISHED STRONG is earned, and every gate suppresses it on its own", () => {
  const E = env();
  // A real progression: six kilometres from 6:06 down to 5:22, closing in the quick half of its range.
  const good = { confidence: "high", mixKind: null, progressive: true, thirdN: 2, tailSec: 325,
    headSec: 359, n: 6, spread: 44, fastest: 322, slowest: 366, estN: 0 };
  const v = { state: "achieved" };
  const hit = E.shareProgressionClaim(good, v);
  assert.ok(hit && hit.claim === "FINISHED STRONG", "a real negative split earns no claim: " + JSON.stringify(hit));
  assert.match(hit.evidence, /Final 2 km averaged 5:25\/km/, "the evidence does not expose the close");
  // Each gate, alone.
  const off: [string, any, any][] = [
    ["low confidence", { ...good, confidence: "low" }, v],
    ["a reps session", { ...good, mixKind: "reps" }, v],
    ["an estimated split", { ...good, estN: 1 }, v],
    ["not progressive", { ...good, progressive: false }, v],
    ["a caution verdict", good, { state: "caution" }],
    // ⚠️ THE CASE THAT PROVED progressive IS NOT ENOUGH: 6:12, 5:37, 5:05, 5:33, 6:01. The first third is
    // 11s slower than the last, so shiftSec passes — and the final kilometre is the second SLOWEST of a
    // run whose quickest was 5:05. Closing in the slow half of your own range is not finishing strong.
    ["a slow close", { ...good, thirdN: 1, tailSec: 361, headSec: 372, n: 5, spread: 67,
      fastest: 305, slowest: 372 }, v],
  ];
  for (const [label, a, vv] of off) {
    const got = E.shareProgressionClaim(a, vv);
    assert.ok(!got || got.claim !== "FINISHED STRONG",
      label + " still produced FINISHED STRONG: " + JSON.stringify(got));
  }
  // ⚠️ AND THE NEUTRAL LINE IS TESTED FIRST, WHICH DELIBERATELY DISAGREES WITH REFERENCE 04 ON ITS OWN
  // DATA — see the function's note. An eighteen-second spread is the app's own definition of even.
  const even = E.shareProgressionClaim({ confidence: "high", mixKind: null, progressive: true, thirdN: 1,
    tailSec: 334, headSec: 351, n: 5, spread: 18, fastest: 333, slowest: 351, estN: 0 }, v);
  assert.equal(even.claim, "CONSISTENT THROUGHOUT",
    "a run whose whole spread is 18 seconds is being called a negative split");
  assert.match(even.evidence, /All 5 kilometres within 18 seconds/, "the neutral line hides its evidence");
  // No claim is a valid answer, and a faded run is the case that must reach it.
  assert.equal(E.shareProgressionClaim({ confidence: "high", mixKind: null, progressive: false,
    faded: true, n: 5, spread: 50, fastest: 322, slowest: 372, estN: 0 }, v), null,
    "a run that faded was handed a headline");
  // Only the two approved strings can ever come out of here.
  const seen = new Set<string>();
  for (const prog of [true, false]) for (const sp of [5, 18, 26, 60]) for (const tail of [310, 340, 370]) {
    const got = E.shareProgressionClaim({ confidence: "high", mixKind: null, progressive: prog, thirdN: 2,
      tailSec: tail, headSec: 360, n: 6, spread: sp, fastest: 320, slowest: 320 + sp, estN: 0 }, v);
    if (got) seen.add(got.claim);
  }
  assert.deepEqual([...seen].sort(), ["CONSISTENT THROUGHOUT", "FINISHED STRONG"],
    "a third headline reached the card: " + [...seen].join(" | "));
});

test("BLOCKER: neither template draws a verdict when the model has suppressed it", () => {
  // ⚠️ m.pill IS THE PAIN / INSUFFICIENT-DATA / LOW-CONFIDENCE GATE AND IT IS THE SAFETY RULE OF THIS
  // WHOLE FEATURE. A GPS-mangled run must not be uppercased into an accusation on a picture that leaves
  // the phone, so the headline slot is EMPTY rather than filled from m.verdict.shortTitle.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const p = E.shareExecutionPlan(g, execModel({ pill: null }), gm);
  assert.equal(p.verd, null, "The Execution drew a verdict with no pill");
  // And it may not reach for the verdict object instead.
  const cl = closure("drawShareCard");
  for (const name of ["shareExecutionPlan", "shareExecutionCard", "shareProgressionPlan", "shareProgressionCard"]) {
    const b = cl.get(name)!;
    assert.ok(!/m\.verdict\.shortTitle|m\.verdict\.status/.test(b),
      name + " reads the verdict around the pill gate");
  }
  // The Progression's headline is the CLAIM, which has its own gate, and it is absent-able too.
  const q = E.shareProgressionPlan(g, progModel({ progression: undefined }), gm);
  assert.equal(q.head, null, "The Progression invented a headline with no claim");
  assert.equal(q.interp, null, "The Progression kept an interpretation with no claim behind it");
  assert.ok(q.rows.length > 0, "with no claim the ladder is the whole block and it is missing");
});

test("BLOCKER: the whole hierarchy of both templates is inside the critical region and nothing collides", () => {
  const E = env();
  const cases: [string, any][] = [
    ["execution ideal", execModel()],
    ["execution no pill", execModel({ pill: null })],
    ["execution long verdict", execModel({ pill: { state: "partial", text: "ON PACE, BUT IT COST YOU" } })],
    ["execution long eyebrow", execModel({ title: "MONA FARTLEK: 2 × (90/60/30/15 HARD, EQUAL FLOAT)",
      coarseLocation: "Llanfairpwllgwyngyllgogerychwyrn" })],
    ["execution two metrics", execModel({ stats: [{ key: "time", v: "35:42", u: "MIN", k: "TIME" },
      { key: "pace", v: "5:40", u: "/KM", k: "AVG PACE" }] })],
    ["execution no date", execModel({ dateLabel: "" })],
    ["progression ideal", progModel()],
    ["progression no claim", progModel({ progression: undefined })],
    ["progression 42 km", progModel({ splits: rows(Array.from({ length: 42 }, (_, i) => 300 + (i % 7))) })],
    ["progression 3 rows", progModel({ splits: rows([351, 337, 336]) })],
    ["progression wrapped claim", progModel({ progression: { claim: "CONSISTENT THROUGHOUT",
      evidence: "All 42 kilometres within 24 seconds of each other, which is the tightest block of the plan" } })],
  ];
  for (const aspect of ["story", "feed", "square"]) {
    const gm = E.cardGeom(aspect);
    for (const [label, base] of cases) {
      const m = { ...base, aspect: aspect };
      const boxes = tmplBoxes(E, gm, m);
      for (const [n, r] of boxes) {
        if (n === "date") {
          assert.ok(r.y + r.h <= gm.H && r.x >= 0 && r.x + r.w <= gm.W,
            label + "/" + aspect + ": the quiet date has left the canvas");
          continue;
        }
        assert.ok(r.x >= gm.safe.x0 - 12 && r.x + r.w <= gm.safe.x1 + 12,
          label + "/" + aspect + ": " + n + " breaks the side margins (x " + Math.round(r.x) +
          " to " + Math.round(r.x + r.w) + ")");
        assert.ok(r.y >= gm.safe.y0 - 2, label + "/" + aspect + ": " + n + " is above the safe top at y" + Math.round(r.y));
        assert.ok(r.y + r.h <= gm.safe.y1 + 14,
          label + "/" + aspect + ": " + n + " ends at y" + Math.round(r.y + r.h) + ", past " + gm.safe.y1);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const ov = E.shareRectOverlap(boxes[i]![1], boxes[j]![1]);
          assert.ok(ov <= 0, label + "/" + aspect + ": " + boxes[i]![0] + " overlaps " +
            boxes[j]![0] + " by " + Math.round(ov) + "px²");
        }
      }
    }
  }
});

test("BLOCKER: the state with no eligible template is a deliberate placeholder, and it cannot be exported", () => {
  // ⚠️ REACHABLE TODAY: a treadmill run, or any run whose GPS was refused, the moment the studio opens
  // and before a photograph is chosen. It used to fall through to the old ledger — the card-within-a-card
  // framing, the empty upper region and the em-dash pace the brief names as defects.
  const html = page();
  // ⚠️ THE DISPATCH LIVES IN shareDrawBody, WHICH IS THE ONE LAYOUT ENGINE. drawShareCard is now the
  // entry that resolves the geometry; the branch that decides which of the four is drawn is one level in.
  const draw = lift("shareDrawBody");
  assert.match(draw, /sharePlaceholderCard\(/, "a model with no template still falls through to something else");
  assert.ok(!/shareLedgerCard|cardLedger\(|cardLane\(|cardTitleLines\(/.test(html),
    "the interim ledger composition survives in the build");
  for (const dead of ["CARD_LEDGER", "CARD_CHART_H", "CARD_LANE_H", "cardLaneKind", "cardLedgerH", "cardLayout"]) {
    assert.ok(!html.includes("const " + dead + " =") && !html.includes("function " + dead + "("),
      dead + " is still declared, so the ledger's geometry can come back");
  }
  // ⚠️ AND IT IS NOT AN EXPORT. A placeholder carrying an instruction must never become a file somebody
  // posts, so prepareShareCard refuses before it encodes and the studio keeps the buttons disabled.
  const prep = lift("prepareShareCard");
  assert.ok(prep.indexOf("if (!m.template)") > 0, "prepareShareCard encodes a card with no template");
  assert.ok(prep.indexOf("if (!m.template)") < prep.indexOf("shareCardCanvas("),
    "the refusal happens after the canvas has already been drawn");
  const stale = lift("studioStale");
  assert.match(stale, /studioBusy\(f \?/, "the studio re-arms Share whatever prepareShareCard answered");
  assert.match(lift("studioBusy"), /blocked/, "studioBusy cannot say why the buttons are off");
});

test("the data-led metric row is the references' own trio, and the clock keeps no unit", () => {
  // ⚠️ NOT The Moment'S TRIO. Its hero IS the distance, so its row drops it and climbs the metric ladder
  // for a third; on 02 and 04 the hero is the verdict or the headline, so the distance has nowhere else
  // to be said. Two rows, because two templates ask different questions.
  const E = env();
  const m = execModel();
  const row = E.shareRowMetrics(m);
  assert.deepEqual(row.map((x: any) => x.k), ["DISTANCE", "TIME", "AVG PACE"],
    "the data-led row is not the references' trio");
  assert.equal(row.filter((x: any) => x.key === "time")[0].u, "",
    "the clock carries a unit of minutes over minutes-and-seconds");
  // Missing values reflow rather than printing a placeholder — the treadmill case.
  const two = E.shareRowMetrics(execModel({ stats: [{ key: "time", v: "34:00", u: "MIN", k: "TIME" },
    { key: "avgHr", v: "141", u: "BPM", k: "AVG HR" }] }));
  assert.equal(two.length, 2, "a run with no distance did not reflow to two columns");
  const gm = E.cardGeom("story");
  const P = E.shareMetricPlan(E.ctx(), gm, two);
  assert.equal(P.cols, 2, "the column divisor is hardcoded rather than taken from how many there are");
  // Never more than three: a fourth column on a 1080px card is unreadable at thumbnail size.
  assert.ok(E.shareRowMetrics(execModel({ stats: [1, 2, 3, 4, 5].map((i) =>
    ({ key: "k" + i, v: String(i), u: "", k: "K" + i })) })).length <= 3, "a fourth metric column reached the row");
});

test("BLOCKER: no photo template covers its photograph, and the block's own colours are what is solved for", () => {
  // ⚠️ THE OWNER'S AMENDMENT REPLACED THIS TEST'S OLD ASSERTION, WHICH REQUIRED THE OPPOSITE. It used to
  // demand kind: "opaque" on these two templates, quoting references 02 and 04 (measured: below their
  // blend the ground is a flat luma 13-14 with a deviation of 0.5, no photograph surviving). His
  // instruction outranks that: "I want the full picture to be in view....the data and text should always
  // be just an overlay". So the assertion is inverted and made specific rather than deleted — the thing
  // it was protecting, that the ground under the copy is dark enough to read on, is now carried by the
  // per-colour solve and asserted here as a list each template has to justify.
  const E = env();
  const cl = closure("drawShareCard");
  // ⚠️ A TEMPLATE SOLVES FOR THE COLOURS IT DRAWS. The faint tier costs ten points of alpha on a white
  // ground, so handing it to a template that never sets it darkens somebody's photograph for nothing —
  // and NOT handing it to the one that does leaves the target range under the bar.
  const draws = (name: string) => {
    const body = cl.get(name)!;
    return ["ink", "inkSoft", "inkFaint", "accent", "fast", "slow"]
      .filter((k) => new RegExp("SHARE_INK\\." + k + "\\b").test(body));
  };
  const asked = (name: string) => {
    const body = cl.get(name)!;
    const at = body.indexOf("sharePhotoScrim(");
    assert.ok(at > 0, name + " does not call the shared scrim");
    const arg = body.slice(at, body.indexOf(";", at));
    const out = ["ink", "accent", "inkSoft"];  // shareScrimText's own three
    for (const k of ["inkFaint", "fast", "slow"]) {
      if (new RegExp("hex: SHARE_INK\\." + k + "\\b").test(arg)) out.push(k);
    }
    return out;
  };
  for (const name of ["shareMomentCard", "shareExecutionCard", "shareProgressionCard"]) {
    const drawn = draws(name), solved = asked(name);
    for (const k of drawn) {
      if (k === "unjudged") continue;
      assert.ok(solved.includes(k), name + " sets SHARE_INK." + k +
        " but does not solve the scrim for it, so that colour is unprotected on a bright photograph");
    }
    for (const k of solved) {
      assert.ok(drawn.includes(k), name + " solves the scrim for SHARE_INK." + k +
        ", which it never draws — that is somebody's photograph darkened for nothing");
    }
  }
  assert.deepEqual(asked("shareMomentCard").sort(), ["accent", "ink", "inkSoft"],
    "The Moment's colour list changed; it must not carry the faint tier (see shareScrimText)");
  // ⚠️ THIS ASSERTION USED TO REQUIRE THE OPPOSITE, AND IT WAS COSTING TEN POINTS OF SOMEBODY'S
  // PHOTOGRAPH ON EVERY EXECUTION CARD. The faint tier is the hungriest colour in the family — solved
  // against a white ground it asks 0.88 where the soft tier asks 0.78 — and The Execution set it in
  // exactly one place, the target range at the right end of the chart caption. Measured, that made the
  // one template the owner's amendment was reported against keep the LEAST of its picture: 13.4% of the
  // subject surviving the block against The Moment's 21.7% and The Progression's 20.8%. The element is a
  // tier brighter now (reference 02 has no target-range label at all, so there was no reference tier to
  // honour) and the list drops to 0.80. NO photo template may set the faint tier.
  for (const name of ["shareMomentCard", "shareExecutionCard", "shareProgressionCard"]) {
    assert.ok(!draws(name).includes("inkFaint"), name + " sets SHARE_INK.inkFaint, which is the hungriest " +
      "colour on any of these cards; the poster keeps it because its ground is flat");
    assert.ok(!asked(name).includes("inkFaint"), name + " solves the scrim for the faint tier");
  }
  // ⚠️ THE POSTER REACHES THE FAINT TIER THROUGH ONE SHARED RULE NOW, NOT BY NAMING IT. shareQuietInk
  // steps the quietest tier UP to --ink-soft whenever the ground is not the plain deep ink — a photograph
  // or a session colour — because measured from rendered pixels --ink-faint is 6.50:1 on #06110e and
  // 3.83:1 on the easy session ground. So the assertion is that the tier is still REACHABLE and that the
  // condition is the ground rather than a list of templates; a tier nothing can reach is dead code, and a
  // condition written as a list is one a third kind of ground gets left out of.
  const quiet = lift("shareQuietInk");
  assert.match(quiet, /SHARE_INK\.inkFaint/, "the faint tier is now unreachable and should be removed");
  assert.match(quiet, /m\.photo \|\| shareEffortHex\(m\.effort\)/,
    "the quiet tier's lift no longer asks about the ground: " + quiet);
  assert.match(lift("sharePosterCard"), /shareQuietInk\(m\)/,
    "the poster is naming a tier instead of asking for the quiet one");
  assert.deepEqual(asked("shareExecutionCard").sort(), ["accent", "fast", "ink", "inkSoft", "slow"],
    "The Execution's colour list changed; it is the three type tiers plus the two miss colours");
  // ⚠️ AND THE PICTURE IS DRAWN ONCE, FOR THE WHOLE CANVAS, BEFORE ANY TEMPLATE RUNS — so no template can
  // arrange for less of it. Asserted on the ORDER, because a photo drawn after the dispatch would cover
  // the copy instead of sitting under it.
  const root = cl.get("shareDrawBody")!;
  const atPhoto = root.indexOf("sharePhotoDraw(g, m.photo, gm)");
  assert.ok(atPhoto > 0, "the photograph is no longer drawn for the whole canvas");
  assert.ok(atPhoto < root.indexOf('m.template === "moment"'),
    "the photograph is drawn after the template, so it would cover the copy");
  assert.equal((root.match(/sharePhotoDraw\(/g) || []).length, 1,
    "the photograph is drawn more than once, so one of them is a region rather than the canvas");
  // ⚠️ MEASURED FROM PIXELS, and this is the number the amendment is: rendering the SAME card over a
  // white photograph and over dark wood, the mean luminance of a row 40px above the bottom edge differs
  // by 6.30 (execution), 11.70 (moment) and 11.62 (progression). Under the old panel it differed by
  // exactly 0.00, because there was no photograph left there to differ. See work/p5/survive.json.
  // The plan solves the alpha at the TOP glyph box, not at a baseline — see shareVeilPlan's own note.
  const gm = E.cardGeom("story");
  const g = E.ctx();
  for (const build of [execModel, progModel]) {
    const m = build();
    const p = m.template === "execution" ? E.shareExecutionPlan(g, m, gm) : E.shareProgressionPlan(g, m, gm);
    const boxes = tmplBoxes(E, gm, m).filter((x) => x[0] !== "wordmark" && x[0] !== "date");
    const top = Math.min(...boxes.map((x) => x[1].y));
    assert.equal(p.blockTop, top, m.template + ": the scrim is solved at y" + p.blockTop +
      " but the topmost glyph box starts at y" + top);
  }
});

test("BLOCKER: nothing draws a plate behind type — the chart's own two graphics are the only near-opaque fills", () => {
  // ⚠️ THE ONE LEGIBILITY SYSTEM IS THE SCRIM, and the amendment is what makes that a rule rather than a
  // preference: a plate behind an element hides the photograph exactly where the runner is standing. The
  // badge carried one — a deep fill at 92% behind its own text — which could never draw (m.pill is null
  // for the two states with no colour) and was still the pattern the next template would copy.
  const E = env();
  const cl = closure("drawShareCard");
  // Every fill of the ground colour, anywhere in the renderer, with the alpha it was given.
  const found: [string, number][] = [];
  for (const [name, body] of cl) {
    const src = body.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(/cardAlpha\(SHARE_INK\.ground,\s*([A-Za-z0-9_.]+)\)/g)) {
      const raw = m[1]!;
      const v = /^[0-9.]+$/.test(raw) ? parseFloat(raw)
        : raw === "SHARE_LADDER.trackInk" ? E.SHARE_LADDER.trackInk : NaN;
      found.push([name + ":" + raw, v]);
    }
  }
  // ⚠️ ONE NAMED EXEMPTION, AND IT IS SIXTEEN PIXELS TALL. The split ladder's track fixes the ground
  // inside its own bar so the accent reads on a snowfield as on dark wood — reference 04 draws that track
  // as a flat grey. Everything else at this alpha is a gradient stop, which is the scrim.
  const plates = found.filter(([where, v]) => v >= 0.5 && !/shareVeilDraw/.test(where));
  assert.deepEqual(plates.map((p) => p[0]), ["shareProgressionCard:SHARE_LADDER.trackInk"],
    "a near-opaque ground fill outside the scrim and the ladder track: " + JSON.stringify(plates));
  // And the badge draws nothing at all when it has no colour of its own.
  const badge = cl.get("shareBadgeDraw")!;
  assert.match(badge, /if \(!col\) return;/, "the badge still has a fallback fill of its own");
  assert.ok(!/cardAlpha\(SHARE_INK\.ground/.test(badge), "the badge still plates its own text");
  // ⚠️ AND THE DRAWN OUTPUT AGREES, which is the half a source scan cannot prove. Recorded over the real
  // card, the only rect-shaped fills are the ground and the two gradients; the ladder's track is a
  // rounded path, not a rect, so a plate reintroduced as a fillRect fails here even if it is written in
  // a form the scan above does not recognise.
  const gm = E.cardGeom("story");
  for (const build of [execModel, progModel]) {
    const ctx = E.ctx();
    const m = build();
    const probe = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(250) };
    const wm = E.shareWordmarkPlan(ctx, gm);
    const fn = m.template === "execution" ? E.shareExecutionCard : E.shareProgressionCard;
    fn(ctx, m, gm, probe, wm);
    const rects = ctx.calls("fillRect");
    // ⚠️ ONE, WHERE IT USED TO BE TWO, AND THE SECOND ONE GOING IS THE POINT OF THE CHANGE. The fade
    // across the top of the card was the other full-width rect; the owner asked for it to go
    // (2026-08-20) and the wordmark carries a keyline instead, which strokes glyphs rather than filling
    // a band. So the block's own solved scrim is the only full-width fill a template may draw, and a
    // second one coming back — under any name — fails here.
    assert.equal(rects.length, 1, m.template + " drew " + rects.length +
      " full rects; the block's own solved scrim is the only one allowed");
    for (const r of rects) {
      assert.ok(r[3] === gm.W, m.template + ": a rect narrower than the canvas is a panel: " + JSON.stringify(r));
    }
  }
});

test("BLOCKER: every mark on the target-band chart carries a deep keyline", () => {
  // ⚠️ ONCE THE PHOTOGRAPH RUNS TO THE BOTTOM EDGE, A MARK'S CONTRAST CANNOT BE REASONED ABOUT FROM THE
  // GROUND ALONE. The keyline is the treatment shareRouteDraw already uses on a route over a photo, and
  // it is what lets the band lane stay a tint rather than becoming a panel over the picture. Asserted on
  // what was DRAWN, and on the pairing: a keyline that is not wider than the mark it sits under is a
  // keyline that cannot be seen.
  const E = env();
  const gm = E.cardGeom("story");
  const ctx = E.ctx();
  const m = execModel({ rows: [372, 337, 305, 333, 361, 340].map((sec, i) =>
    ({ km: i + 1, sec: sec, delta: 0, judged: true, est: false,
      verdict: i === 0 ? "slow" : i === 2 ? "fast" : i === 5 ? "unjudged" : "in" })) });
  E.shareBandChart(ctx, m, gm.M, 1200, gm.CW, E.SHARE_CHART.plotH);
  // Walk the log: every stroke or fill in a mark colour must be preceded by a keyline stroke of the same
  // path at a greater width.
  // ⚠️ A MARK IS ITS RGB TRIPLE, NOT ITS STYLE STRING — AND THE FIRST VERSION OF THIS GUARD MISSED THE
  // BAND EDGES ENTIRELY BECAUSE OF IT. Deliberately removing their keyline was the one re-break of
  // fifteen that this test did not catch: the edges are drawn in cardAlpha(accent, 0.85), which is
  // "rgba(50,200,178,0.85)" and matched no entry in a set of hexes, so the mark that most needs a keyline
  // was never examined. Matching the triple covers a colour at any alpha, which is how they are all drawn.
  const isMark = (style: string) => {
    for (const hex of [E.SHARE_INK.accent, E.SHARE_INK.fast, E.SHARE_INK.slow, E.SHARE_INK.unjudged,
      E.SHARE_INK.ink]) {
      if (style === hex) return hex;
      const h = hex.replace("#", "");
      const trip = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)).join(",");
      if (style.startsWith("rgba(" + trip + ",")) return hex;
    }
    return null;
  };
  let lastKeyW = -1, lastKeyAt = -1, laneFills = 0;
  const marks: string[] = [];
  let pendingStyle = "", pendingWidth = 0, i = 0;
  for (const e of ctx.log) {
    if (e[0] === "strokeStyle") pendingStyle = String(e[1]);
    if (e[0] === "lineWidth") pendingWidth = Number(e[1]);
    if (e[0] === "fillStyle") pendingStyle = String(e[1]);
    if (e[0] === "stroke") {
      if (pendingStyle === E.SHARE_INK.keyline) { lastKeyW = pendingWidth; lastKeyAt = i; }
      else {
        const mk = isMark(pendingStyle);
        if (mk) {
          assert.ok(lastKeyAt >= 0 && i - lastKeyAt <= 3,
            "a stroked mark with no keyline under it: " + pendingStyle + " at log " + i);
          assert.ok(lastKeyW > pendingWidth, "the keyline (" + lastKeyW +
            ") is not wider than the mark it sits under (" + pendingWidth + ")");
          marks.push("stroke:" + mk);
        }
      }
    }
    if (e[0] === "fill") {
      const mk = isMark(pendingStyle);
      // ⚠️ THE BAND'S OWN TINT IS A FILL IN THE ACCENT AND IT IS NOT A MARK. It is the lane — a region,
      // deliberately as subtle as the reference's (measured 1.36:1 against the ground). Exempted by its
      // EXACT style rather than by "any low alpha", which was the first version and was itself a hole:
      // an on-target marker drawn at 0.4 of the accent with no keyline would have slipped through a
      // threshold, and a marker is exactly the thing this test exists to catch.
      const lane = pendingStyle === E.cardAlpha(E.SHARE_INK.accent, E.SHARE_CHART.tint);
      if (lane) laneFills++;
      if (mk && !lane) {
        assert.ok(lastKeyAt >= 0 && i - lastKeyAt <= 3,
          "a filled mark with no keyline under it: " + pendingStyle + " at log " + i);
        marks.push("fill:" + mk);
      }
    }
    i++;
  }
  // The four verdicts, the two band edges and the pace line all reached the check.
  assert.ok(marks.length >= 9, "only " + marks.length + " marks were checked: " + marks.join(" "));
  for (const col of [E.SHARE_INK.accent, E.SHARE_INK.fast, E.SHARE_INK.slow, E.SHARE_INK.unjudged]) {
    assert.ok(marks.some((x) => x.endsWith(col)), "no mark was drawn in " + col);
  }
  // ⚠️ AND THE BAND EDGES ARE NAMED, so a future refactor that stops drawing them cannot satisfy this
  // test by drawing fewer marks. Two of them, one per edge of the lane.
  assert.equal(marks.filter((x) => x === "stroke:" + E.SHARE_INK.accent).length, 2,
    "the band's two edges did not both reach the keyline check: " + marks.join(" "));
  assert.equal(laneFills, 1, "the lane's own tint was drawn " + laneFills +
    " times; the exemption covers exactly one fill and nothing else");
  assert.equal(E.SHARE_CHART.key > 0, true, "the keyline has no width of its own");
  // ⚠️ AND THE LINE IS OPAQUE, MEASURED OFF THE REFERENCE. Sampled across 23 columns of
  // 02-the-execution-target between two markers its peak is rgb(251,253,252): warm-white, not a grey.
  assert.equal(E.SHARE_CHART.lineA, 1, "the pace line is translucent where the reference's is not");
});

test("BLOCKER: every mark the chart draws stays inside the contract's x 64-1016", () => {
  // ⚠️ THE FIRST AND LAST MARKER USED TO BE CENTRED ON THE MARGIN ITSELF, so their outer rim and its
  // keyline hung 13px past it — measured on the built card, ink bounds x[53,1026] against a stated
  // x 64-1016, over on BOTH sides, and over on the right where reference 02 is not (its own chart ink
  // measures 58.5-1005.4 in 1080-space). The band, which is aligned with the copy above it, still spans
  // the full content width; only the marks are inset.
  //
  // ⚠️ AND THE INSET IS THE WIDEST MARK'S OWN HALF-WIDTH, NOT THE RADIUS. A miss triangle is r * triW
  // wide and its keyline adds key on top, so an inset of r + key left the miss markers a pixel over while
  // every on-target card measured clean — a defect visible only on the runs that missed. Both constants
  // are named and shared, and this asserts the relation rather than either number.
  const E = env();
  const gm = E.cardGeom("story");
  const src = lift("shareBandChart");
  assert.match(src, /const inset = Math\.min\(w \/ 4, r \* SHARE_CHART\.triW \+ SHARE_CHART\.key\)/,
    "the plot's inset is no longer derived from the widest mark and its keyline");
  assert.match(lift("shareChartMarker"), /hw = r \* SHARE_CHART\.triW/,
    "the miss triangle's half-width is a literal again, so the inset cannot know it");
  // Geometry: the extreme marks' own extents, computed from the returned scale.
  for (const n of [2, 3, 6, 12, 42]) {
    const rows = Array.from({ length: n }, (_, i) => ({ km: i + 1, sec: 330 + (i % 5) * 12,
      delta: 0, judged: true, est: false, verdict: i === 0 ? "slow" : i === n - 1 ? "fast" : "in" }));
    const m = execModel({ rows: rows });
    const ch = E.shareBandChart(E.ctx(), m, gm.M, 1200, gm.CW, E.SHARE_CHART.plotH);
    const half = ch.r * E.SHARE_CHART.triW + E.SHARE_CHART.key;
    assert.ok(ch.X(0) - half >= gm.M - 0.01, n + " splits: the first mark reaches x" +
      (ch.X(0) - half).toFixed(1) + ", left of the margin at " + gm.M);
    assert.ok(ch.X(n - 1) + half <= gm.safe.x1 + 0.01, n + " splits: the last mark reaches x" +
      (ch.X(n - 1) + half).toFixed(1) + ", right of the margin at " + gm.safe.x1);
  }
  // ⚠️ AND THE LANE STILL SPANS THE FULL CONTENT WIDTH, so the chart stays aligned with the copy. Insetting
  // the whole graphic instead would have been easier and would have broken the left alignment.
  const ctx = E.ctx();
  E.shareBandChart(ctx, execModel(), gm.M, 1200, gm.CW, E.SHARE_CHART.plotH);
  // ⚠️ THE LANE IS FOUND BY ITS OWN FILL STYLE, NOT BY THE PRIMITIVE IT HAPPENS TO USE. rr() picks
  // roundRect when the context has one and four arcTo calls when it does not, so a guard that names
  // either can be satisfied or defeated by which branch a canvas takes. Its style is the accent at
  // SHARE_CHART.tint and nothing else on this chart uses that.
  const laneStyle = E.cardAlpha(E.SHARE_INK.accent, E.SHARE_CHART.tint);
  const iLane = ctx.log.findIndex((e: any[]) => e[0] === "fillStyle" && e[1] === laneStyle);
  assert.ok(iLane >= 0, "the lane's own tint was never set, so this is not measuring the lane");
  const shape = ctx.log.slice(0, iLane).reverse()
    .find((e: any[]) => e[0] === "roundRect" || e[0] === "arcTo" || e[0] === "moveTo");
  assert.ok(shape, "the lane has no path before its fill");
  const x0 = shape[0] === "roundRect" ? shape[1] : shape[1];
  assert.ok(Math.abs(x0 - gm.M) < E.SHARE_CHART.laneR + 0.01,
    "the lane no longer starts at the content margin: " + x0 + " against " + gm.M);
  if (shape[0] === "roundRect") {
    assert.equal(shape[3], gm.CW, "the lane no longer spans the content width");
  }
  // The band edges are drawn with an explicit butt cap, or a round cap left behind by the route would put
  // half a keyline past the margin at each end — the same overhang from a different direction.
  // ⚠️ ASSERTED ON THE ORDERING, BECAUSE "IT CONTAINS THE STRING" COULD NOT FAIL. shareBandChart sets a
  // butt cap twice — once before the band edges and once before a miss stem — so deleting the first one
  // left the second satisfying a presence check. This was the one re-break of fourteen that escaped.
  const iCap = src.indexOf('g.lineCap = "butt";');
  const iEdges = src.indexOf("[yFast, ySlow].forEach");
  assert.ok(iCap > 0 && iEdges > 0, "the band edges or the cap moved out of shareBandChart");
  assert.ok(iCap < iEdges, "the band edges are drawn before any cap is set, so they inherit whatever the " +
    "route or the pace line left behind");
});

test("BLOCKER: the metric divider is a bevel, not a translucent line on a deep one", () => {
  // ⚠️⚠️ THE CONCENTRIC VERSION WAS BUILT AND MEASURED AND IS THE REASON THIS TEST EXISTS. The chart's
  // keyline is one wider stroke of the same path, which works there because every mark it protects is
  // OPAQUE. A 20%-alpha hairline is not: drawn on top of its own keyline it composites over deep ink
  // instead of over the photograph, and the pair measured 1.33:1 on snow — no better than the single
  // under-drawn line it replaced. Side by side, the ground cannot be close to both ends at once.
  const E = env();
  const ctx = E.ctx();
  E.shareHairline(ctx, 400, 100, 400, 300);
  const paths: any[] = [];
  let cur: any = null;
  for (const e of ctx.log) {
    if (e[0] === "beginPath") { cur = { pts: [] as any[], style: null }; paths.push(cur); }
    else if (cur && (e[0] === "moveTo" || e[0] === "lineTo")) cur.pts.push([e[1], e[2]]);
    else if (cur && e[0] === "strokeStyle") cur.style = e[1];
  }
  assert.equal(paths.length, 2, "the divider is not two strokes: " + paths.length);
  const xs = paths.map((p) => p.pts[0][0]);
  assert.notEqual(xs[0], xs[1], "the two strokes share one path, so the light one is drawn over the deep " +
    "one and its alpha is spent on ink rather than on the photograph");
  assert.ok(Math.abs((xs[0]! + xs[1]!) / 2 - 400) < 1e-9,
    "the pair is not centred on the line asked for: " + xs.join(","));
  assert.equal(paths[0].style, E.SHARE_INK.keyline, "the deep half is not the keyline colour");
  assert.equal(paths[1].style, E.SHARE_INK.hair, "the light half is not the hairline colour");
  /**
   * ⚠️ THE STRONGER LIGHT HALF THAT USED TO LIVE HERE WENT WITH THE TRANSPARENT OUTPUT IT WAS FOR. On a
   * ground nobody can measure, .28 of white over pure black measures 2.26:1 and the deep half contributes
   * nothing because it is dark on dark — so that output carried a second, raised alpha. Both remaining
   * outputs put a solved scrim or the matte ground under every divider, which is what .28 was measured
   * against, and a second constant with nothing to read it is the machinery this project treats as a
   * defect in its own right.
   */
  assert.ok(!("hairAlpha" in E.SHARE_INK),
    "the palette still carries the raised hairline alpha for an output that no longer exists");
  const w = ctx.log.filter((e: any[]) => e[0] === "lineWidth").map((e: any[]) => e[1]);
  assert.deepEqual([...new Set(w)], [E.SHARE_HAIR.w],
    "the two halves are different widths, which makes them a rule rather than a hairline: " + w.join(","));
  // ⚠️ .28, WHICH IS THE MEAN OF THE FOUR REFERENCES' OWN DIVIDERS (0.385 / 0.297 / 0.191 / 0.20), backed
  // out of each measured line and the ground beside it. At the .14 this shipped with, ours measured
  // 1.05-1.53:1 against a reference band of 1.71-4.18 — under all eight of them.
  const a = parseFloat((/,\s*(\.?[0-9]*\.?[0-9]+)\)/.exec(E.SHARE_INK.hair) || ["", "0"])[1]!);
  assert.ok(a >= 0.24 && a <= 0.34, "the hairline's alpha is " + a + ", outside the references' own range");
  // ⚠️ ONE DEFINITION. The poster used to stroke SHARE_INK.hair inline, so raising the alpha here would
  // have left its horizontal rule at the old weight with nothing to notice.
  const cl = closure("drawShareCard");
  for (const [name, body] of cl) {
    if (name === "shareHairline") continue;
    const clean = body.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/SHARE_INK\.hair/.test(clean), name + " strokes the hairline colour itself instead of " +
      "going through shareHairline, which is how the two weights drift apart");
  }
  assert.match(lift("shareMetricRules"), /shareHairline\(g, x, top, x, bottom\)/,
    "the metric dividers no longer go through the one hairline");
  assert.match(lift("sharePosterCard"), /shareHairline\(g, gm\.M, p\.hairY, gm\.safe\.x1, p\.hairY\)/,
    "the poster's rule no longer goes through the one hairline");
  /**
   * ⚠️ AND THE ACCENT DASH GOES THROUGH ONE FILL RATHER THAN BEING STROKED BY THE TEMPLATE. Its keyline
   * went with the transparent output as well: a single-toned mark has no direction to win in over a
   * ground nobody can measure — measured 1.60:1 over pure white — and both remaining outputs put a
   * solved scrim or the matte ground under it. One mark builder is what stops the next template
   * inventing its own.
   */
  const pc = lift("sharePosterCard");
  assert.match(pc, /shareMark\(g, gm\.M, p\.tagY, POSTER_TAG\.w, POSTER_TAG\.h, SHARE_INK\.accent\)/,
    "the poster's accent tag fills a rect itself instead of going through the one mark builder");
  const mk = lift("shareMark").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/shadow|strokeRect|destination-over/.test(mk),
    "shareMark carries a treatment for a ground nobody can measure, which no output has any more");
});

test("BLOCKER: the ladder's track is two passes, so it is the same grey on any photograph", () => {
  // ⚠️ ONE PASS OF WHITE AT 20% IS 59 ON A DARK PHOTOGRAPH AND 90 ON A BRIGHT ONE, and at 90 the accent
  // bar against its own track measures 2.87:1 — under the 3:1 a chart needs. Fixing the ground inside the
  // bar first and then lightening it lands the track at 44-55 whatever is behind it. Asserted on the
  // ORDER of the three fills, because either pass alone is the defect.
  const E = env();
  const gm = E.cardGeom("story");
  const ctx = E.ctx();
  const m = progModel();
  const probe = { w: 4, h: 7, data: new Uint8ClampedArray(4 * 7 * 4).fill(250) };
  E.shareProgressionCard(ctx, m, gm, probe, E.shareWordmarkPlan(ctx, gm));
  const fills = ctx.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => String(e[1]));
  const groundA = E.cardAlpha(E.SHARE_INK.ground, E.SHARE_LADDER.trackInk);
  const inkA = E.cardAlpha(E.SHARE_INK.ink, E.SHARE_LADDER.trackA);
  const rowsN = E.shareLadderRows(m).length;
  assert.ok(rowsN >= 3, "the ladder fixture lost its rows");
  let runs = 0;
  for (let i = 0; i + 2 < fills.length; i++) {
    if (fills[i] === groundA && fills[i + 1] === inkA && fills[i + 2] === E.SHARE_INK.accent) runs++;
  }
  assert.equal(runs, rowsN, "the track's ground-then-ink-then-bar order held for " + runs +
    " of " + rowsN + " rows");
  assert.ok(E.SHARE_LADDER.trackInk >= 0.6, "the track no longer fixes the ground it stands on");
  assert.ok(E.SHARE_LADDER.trackA > 0 && E.SHARE_LADDER.trackA < 0.3,
    "the track's lightening pass is not the reference's subtle grey");
});

test("the target band's own numbers are on the chart, and they are dropped rather than overprinted", () => {
  // ⚠️ THE REFERENCE GIVES THE RANGE ITS OWN ROW; THIS DESIGN PUTS IT AT THE RIGHT END OF THE CHART'S
  // LABEL, because holding the brief's y1680 leaves 75px less than the reference uses. Both axes are
  // still labelled, which is the requirement — and when the two runs would not fit, the range goes and
  // the sentence above still carries it.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const p = E.shareExecutionPlan(g, execModel(), gm);
  assert.ok(p.capL && /PACE AGAINST TARGET/.test(p.capL.text), "the chart has no label at all");
  assert.ok(p.capR && /5:20/.test(p.capR.text) && /6:10/.test(p.capR.text),
    "the target range is not stated on the chart: " + (p.capR && p.capR.text));
  assert.ok(p.capL.w + p.capR.w <= gm.CW, "the label and the range overlap");
  // No band on the model: the label survives, the range does not, and nothing prints NaN.
  const noBand = E.shareExecutionPlan(g, execModel({ band: null, target: undefined }), gm);
  assert.equal(noBand.capR, null, "a run with no band still printed a target range");
  assert.ok(noBand.capL, "the chart label vanished with the band");
  // ⚠️ AND THE SENTENCE IS THE MODEL'S OWN EVIDENCE LINE, which already contains the band — so the range
  // is stated twice on purpose and neither statement is computed here.
  assert.match(closure("drawShareCard").get("shareExecutionPlan")!, /m\.verdict && m\.verdict\.evidenceLine/,
    "the adherence sentence is not the model's evidence line");
});

test("the two templates' eyebrows are different strings, and both come off the model", () => {
  // ⚠️ THEY ARE NOT INTERCHANGEABLE AND THE REFERENCES DISAGREE ON PURPOSE: 01 and 04 read the session
  // KIND and place, 02 reads the session TITLE and place. A card about EXECUTION names the thing that
  // was prescribed; a card about the moment or the progression names the kind of run it was.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  const m = execModel({ title: "36 EASY RUN", sessionLabel: "Easy run", coarseLocation: "Durham" });
  const ex = E.shareExecutionPlan(g, m, gm);
  assert.match(ex.eye.text, /36 EASY RUN/, "The Execution's eyebrow is not the session title");
  assert.match(ex.eye.text, /DURHAM/, "The Execution's eyebrow lost the place");
  const pr = E.shareProgressionPlan(g, progModel({ title: "36 EASY RUN", sessionLabel: "Easy run",
    coarseLocation: "Hartlepool" }), gm);
  assert.match(pr.eye.text, /EASY RUN/, "The Progression's eyebrow is not the session kind");
  assert.ok(!/36/.test(pr.eye.text), "The Progression's eyebrow took the title instead of the kind");
  // Hidden location: the eyebrow shortens rather than printing a stray separator.
  for (const [name, plan] of [["execution", E.shareExecutionPlan(g, execModel({ coarseLocation: undefined }), gm)],
    ["progression", E.shareProgressionPlan(g, progModel({ coarseLocation: undefined }), gm)]] as [string, any][]) {
    assert.ok(!/·/.test(plan.eye.text), name + " printed a separator with nothing after it");
  }
});

test("the ladder's row pitch is what gives way, and it never goes below its floor", () => {
  // ⚠️ ONE DERIVED QUANTITY PER TEMPLATE, AND IT IS THE ONE THAT IS NOT ON THE TYPE LADDER. The rows are
  // this template's whole purpose, so they are not shed to make room; the leading between them closes to
  // hold the photographic floor and stops at a stated minimum rather than crushing the text.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  // ⚠️ THE CLAMP HAD TO BE REACHED BEFORE THIS GUARD WAS WORTH ANYTHING, AND ITS FIRST VERSION NEVER
  // REACHED IT. Swept over 3 to 42 splits it looked thorough — but shareLadderRows caps the ladder at six
  // rows, so the divisor is never more than five and the derived pitch never fell below 49. Replacing the
  // floor with Math.max(1, ...) left the whole suite green: a guard pinned to a bound the code cannot
  // approach measures nothing. The long interpretation is what closes the gap — a wrapped evidence line
  // costs 43px of the block, which is enough to drive the pitch to 43 and make the floor bind.
  const seen: number[] = [];
  const wordy = { claim: "CONSISTENT THROUGHOUT",
    evidence: "All 6 kilometres within 24 seconds of each other, which is the tightest of the block so far" };
  for (let n = 3; n <= 42; n++) {
    for (const claim of [progModel().progression, wordy]) {
      const pp = E.shareProgressionPlan(g, progModel({ progression: claim,
        splits: rows(Array.from({ length: n }, (_, i) => 300 + i)) }), gm);
      assert.ok(pp.pitch >= E.SHARE_LADDER.minPitch, n + " kilometres with a " +
        (claim === wordy ? "wrapped" : "short") + " interpretation crushed the pitch to " + pp.pitch);
      seen.push(pp.pitch);
    }
    const p = E.shareProgressionPlan(g, progModel({ splits: rows(Array.from({ length: n }, (_, i) => 300 + i)) }), gm);
    assert.ok(p.pitch >= E.SHARE_LADDER.minPitch,
      n + " kilometres crushed the pitch to " + p.pitch + ", under the " + E.SHARE_LADDER.minPitch + " floor");
    assert.ok(p.pitch <= E.SHARE_LADDER.pitch,
      n + " kilometres stretched the pitch to " + p.pitch + ", past the reference's " + E.SHARE_LADDER.pitch);
    // The rows must not run into the metric row below them, at any count.
    assert.ok(p.lastBase < p.rowTop, n + ": the ladder's last row overlaps the metric row");
    assert.ok(p.pitch > Math.round(E.shareTypeSize("row", "story") * E.SHARE_CAP),
      n + ": the pitch is smaller than the row's own cap height, so the rows touch");
  }
  // It genuinely varies AND it genuinely reaches its floor — a pitch that never approaches the clamp
  // would satisfy every bound above and hold nothing.
  assert.ok(new Set(seen).size > 1, "the pitch never moved, so the floor is being held by luck");
  assert.ok(Math.min(...seen) === E.SHARE_LADDER.minPitch,
    "the pitch floor is never reached in the sweep (smallest seen " + Math.min(...seen) +
    " against a floor of " + E.SHARE_LADDER.minPitch + "), so clamping to it is untested");
});

test("the chart is drawn only when there is something to draw, and it never invents a band", () => {
  // ⚠️ "NEVER FAKE A TARGET BAND" IS THE OWNER'S OWN RULING. The Execution is already hidden for a reps
  // session by shareTemplateStates, but the renderer has to be total: handed a model with no band it must
  // draw no lane rather than a lane around NaN.
  const E = env();
  const gm = E.cardGeom("story");
  const cl = closure("drawShareCard");
  assert.match(cl.get("shareExecutionCard")!, /if \(m\.band && rows\.length\)/,
    "the chart is drawn without checking there is a band and a kilometre to plot");
  const g = E.ctx();
  E.shareExecutionCard(g, execModel({ band: null, rows: [], n: 0, target: undefined }), gm, null,
    E.shareWordmarkPlan(g, gm));
  const drawn = g.log.map((e: any[]) => e.join(" ")).join("\n");
  assert.ok(!/NaN/.test(drawn), "a card with no band drew NaN coordinates");
  // And the eligibility rule itself still refuses a reps session, which is what keeps this unreachable.
  const st = lift("shareTemplateStates");
  assert.match(st, /a\.mixKind === "reps"/, "The Execution is no longer hidden for a repetitions session");
});


test("BLOCKER: no colour in the renderer is a literal — every one comes from the palette object", () => {
  // ⚠️ THE PALETTE GUARD USED TO NAME THE FIVE DEAD NEON VALUES AND NOTHING ELSE, so a brand new hex in a
  // brand new template was invisible to it. Caught by re-breaking: swapping the pace line's
  // cardAlpha(SHARE_INK.ink, 0.62) for a literal left the whole suite green, and the whole point of the
  // palette existing is that a canvas cannot use var() so a drifting literal is the failure mode. Derived
  // over the closure rather than listed, so a sixth colour cannot arrive unnoticed.
  const cl = closure("drawShareCard");
  for (const [name, b] of cl) {
    const hex = [...b.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    assert.deepEqual(hex, [], name + " commits to a colour literal rather than a palette token: " + hex.join(", "));
    // rgb()/rgba()/hsl() literals are the same fault wearing a different notation — cardAlpha is the only
    // sanctioned way to take a token to an alpha, and it is handed a token.
    const fn = [...b.matchAll(/(?:rgba?|hsla?)\(\s*\d/g)].map((m) => m[0]);
    assert.deepEqual(fn, [], name + " builds a colour by hand: " + fn.join(", "));
    // cardAlpha is the primitive that TAKES a hex, so its own signature is the one place the word may
    // appear. Every caller has to hand it a token.
    if (name !== "cardAlpha") {
      // ⚠️ A PALETTE MEMBER OR A LOCAL, AND THE LOCAL IS SAFE BECAUSE OF THE TWO SWEEPS ABOVE IT RATHER
      // THAN BY ASSUMPTION. Requiring the literal text SHARE_INK was a proxy for "this colour came from
      // the palette", and it stopped being true when the ground gained a second table: the contour lines
      // are stroked in the SESSION's colour, which arrives as a resolved value rather than as a member
      // expression. What actually protects this file is that no function body may contain a hex or an
      // rgb()/hsl() literal at all — asserted two lines up — so a local can only ever hold something the
      // palette produced. Both tables are pinned to the stylesheet's own tokens elsewhere.
      for (const m of b.matchAll(/cardAlpha\(([^,]+),/g)) {
        assert.match(m[1]!.trim(), /^(?:SHARE_INK\.|SHARE_EFFORT\[|[a-z][A-Za-z0-9_]*$)/,
          name + " takes something other than a palette token to an alpha: " + m[1]);
      }
    }
  }
  // ⚠️ AND THE ONE COLOUR WORD THAT IS NOT A TOKEN IS "transparent", WHICH IS NOT A COLOUR. It appears
  // only to switch a shadow OFF, and it cannot drift from anything — an rgba(0,0,0,0) in its place would
  // be the first hand-built value in the renderer and the sweep above rightly refused it. Named here so
  // the exception is one word in one place rather than a hole in the sweep.
  for (const [name, b] of cl) {
    for (const m of b.matchAll(/"(transparent|white|black|red|[a-z]{3,12})"/g)) {
      if (m[1] !== "transparent") continue;
      assert.match(b, /shadowColor = "transparent"/,
        name + " uses the transparent keyword for something other than switching a shadow off");
    }
  }
  // And the palette itself is where every literal lives, which is what makes the sweep above safe.
  const E = env();
  assert.ok(Object.keys(E.SHARE_INK).length >= 12, "the palette has shrunk to " +
    Object.keys(E.SHARE_INK).length + " entries; the renderer must be getting its colours elsewhere");
});

test("a shrunk progression headline earns its weight from its width", () => {
  // ⚠️ THE ONE PLACE THE HIERARCHY COULD INVERT. shareFit prefers a single line all the way down to its
  // floor before it will wrap, so the 21-character neutral claim lands at 73px on a story where the
  // reference's 15-character one sits at 96 — and the metric values below it are 84. That is only
  // acceptable because the shrunk line is FULL WIDTH: measured, x67 to x1007 of a 952px content width,
  // against the reference headline's x62 to x891. If it ever shrinks without filling the measure, the
  // three numbers at the bottom become the biggest thing on the card, which is one of the brief's own
  // named defects.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  for (const text of ["FINISHED STRONG", "CONSISTENT THROUGHOUT"]) {
    const p = E.shareProgressionPlan(g, progModel({ progression: { claim: text, evidence: "Final 2 km averaged 5:29/km" } }), gm);
    const hmax = E.shareTypeSize("headline", "story");
    g.font = E.shareFont(800, p.head.size);
    const w = Math.max(...p.head.lines.map((l: string) => g.measureText(l).width));
    if (p.head.size < hmax) {
      assert.ok(w >= gm.CW * 0.9, text + " shrank to " + p.head.size +
        "px and only fills " + Math.round(w) + " of " + gm.CW + "px, so it is smaller for nothing");
    }
    assert.ok(p.head.size > p.interp.size, text + " is no larger than the sentence beneath it");
    assert.ok(p.head.size > (p.eye ? p.eye.size : 0), text + " is no larger than the eyebrow above it");
  }
});

test("the activity line drops the place rather than cutting it in half", () => {
  // ⚠️ MEASURED ON A REAL PLAN'S LONGEST NON-REPETITION TITLE. Title plus place is 53 characters, which
  // does not fit 952px even at the eyebrow's floor, so the fit ellipsised the END and the card shipped an
  // eyebrow finishing in half a town name. Both templates share one helper now.
  const E = env();
  const gm = E.cardGeom("story");
  const g = E.ctx();
  // ⚠️ THE INVARIANT IS THE SEPARATOR, AND THE FIRST VERSION OF THIS GUARD MISSED IT. It asked whether
  // the place survived intact "or not at all", which is satisfied by a truncation that cuts the place off
  // ENTIRELY and leaves the separator dangling — so removing the fallback left the suite green. Stated
  // properly: either the whole pair is set, or what is drawn is the head alone with no separator in it.
  const long = "GEARED RUN: EASY TO STEADY TO TEMPO TO EASY AND BACK AGAIN";
  const full = long + " \u00b7 " + "HARTLEPOOL";
  const eye = E.shareEyebrow(g, gm, long, "Hartlepool");
  assert.ok(eye.text === full || !eye.text.includes("\u00b7"),
    "the pair was truncated with the separator still in it, so the place is half a word: " + eye.text);
  // A short pair keeps both halves at the top rung.
  const ok = E.shareEyebrow(g, gm, "36 EASY RUN", "Durham");
  assert.match(ok.text, /36 EASY RUN \u00b7 DURHAM/, "a pair that fits was still shortened");
  assert.equal(ok.size, E.shareTypeSize("eyebrow", "story"), "a pair that fits was shrunk anyway");
  // Nothing at all is nothing, not a stray separator.
  assert.equal(E.shareEyebrow(g, gm, "", ""), null, "an empty activity line still produced a run of text");
  assert.ok(!/\u00b7/.test(E.shareEyebrow(g, gm, "EASY RUN", "").text), "a missing place left its separator");
});


test("shareFitToRoom falls back to its FLOOR when nothing fits the room, never to its ceiling", () => {
  // ⚠️ THE FALLBACK IS UNREACHABLE ON BOTH TEMPLATES AS THEY STAND — a story's verdict has 166px of room
  // against a 49px floor and a feed post holds no photographic floor at all — WHICH IS EXACTLY WHY IT
  // NEEDED A GUARD. Written as a bare shareFit it returned the largest size that fits the WIDTH, which is
  // the one thing already known not to fit the height: the biggest possible overflow, in the one case
  // nobody would ever see in a screenshot. Exercised directly rather than through a template.
  const E = env();
  const g = E.ctx();
  const tiny = E.shareFitToRoom(g, "ON PACE, BUT IT COST YOU", 952, 8,
    { max: 124, min: 68, step: 2, weight: 800, lines: 2, lh: 0.945 });
  assert.equal(tiny.size, 68, "with 8px of room it answered " + tiny.size + "px rather than its floor");
  // And with room to spare it still answers the ceiling, so the floor is a fallback and not a cap.
  const roomy = E.shareFitToRoom(g, "STEADY AND CONTROLLED", 952, 400,
    { max: 124, min: 68, step: 2, weight: 800, lines: 2, lh: 0.945 });
  assert.equal(roomy.size, 124, "with 400px of room it shrank to " + roomy.size + "px anyway");
  // The height it reports is the height it promised to respect.
  const mid = E.shareFitToRoom(g, "STEADY AND CONTROLLED", 952, 170,
    { max: 124, min: 68, step: 2, weight: 800, lines: 2, lh: 0.945 });
  const h = Math.round(mid.size * E.SHARE_CAP) + (mid.lines.length - 1) * mid.lh;
  assert.ok(h <= 170, "it answered " + mid.size + "px on " + mid.lines.length +
    " lines, which is " + h + "px in a 170px room");
});
