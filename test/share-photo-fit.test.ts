import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE PHOTO-FIT RULING — THE WHOLE PHOTOGRAPH BY DEFAULT, FILL BY CHOICE.
 *
 * The owner's ruling of 2026-08-19, verbatim: "Is the photograph going to be across the full page with
 * the text as an overlay, I dont really want the photo cutting off? I don't mind a subtle fade but i
 * want the full photo the user uploads to be shown." Offered three answers he chose whole-photo by
 * default plus a Fill toggle. That reverses the guard this file's sibling carried for a day — "the
 * photograph covers the whole canvas" — so the invariant had to be split in two rather than deleted:
 * FILL still covers, and CONTAIN shows everything while the card is still filled edge to edge, by a
 * blurred reflection of the picture itself.
 *
 * ⚠️ EVERY GUARD HERE WAS WATCHED FAILING AGAINST A DELIBERATE RE-BREAK. Three of my own first attempts
 * were refuted by their own re-break and are recorded where they sit.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
function lift(name: string): string {
  const html = page();
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
  const html = page();
  const at = html.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
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
const nocomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * A sandbox holding just the geometry and the composite. Deliberately NOT the whole renderer — these
 * guards are about where the photograph lands and what fills the rest, and a smaller lift means a
 * failure names the fault rather than a chain of six functions.
 */
type Env = { [k: string]: any; ctx: () => any };
function recCtx() {
  const log: any[] = [];
  const ctx: any = { log, calls: (n: string) => log.filter((e) => e[0] === n),
    measureText: () => ({ width: 10 }) };
  for (const m of ["save", "restore", "beginPath", "rect", "clip", "fillRect", "drawImage",
    "scale", "translate", "setTransform", "clearRect", "fill", "stroke"]) {
    ctx[m] = (...a: any[]) => { log.push([m, ...a]); };
  }
  for (const p of ["fillStyle", "imageSmoothingEnabled", "imageSmoothingQuality", "globalAlpha"]) {
    let v: any = "";
    Object.defineProperty(ctx, p, { get: () => v, set: (x: any) => { v = x; log.push([p, x]); } });
  }
  ctx.getImageData = () => { throw new Error("no pixels in node"); };
  return ctx;
}
const FNS = ["sharePhotoBox", "sharePhotoNorm", "shareBoxLeavesGap", "shareBlurBg",
  "sharePhotoCompose", "sharePhotoDraw", "shareSubjectZones", "cardGeom",
  "shareRect", "cardAlpha", "shareCropKey", "shareCropRead", "shareAspect"];
// ⚠️ CARD_W AND CARD_M SHARE ONE STATEMENT WITH cardGeom's other constants, so liftConst finds
// them by the statement's FIRST declarator and they are named separately for the return.
const CONSTS = ["SHARE_INK", "SHARE_BLUR", "SHARE_SUBJECT", "SHARE_CROP0", "CARD_W",
  "SHARE_ASPECTS", "SHARE_ASPECT_H"];
const EXTRA = ["CARD_M"];
function env(): Env {
  // ⚠️ THE CANVAS STUB'S width AND height MUST BE WRITABLE, because shareBlurBg's doubling chain reads
  // the width back to decide when to stop. A stub with a frozen 0 loops forever.
  const made: any[] = [];
  const mkCanvas = () => {
    const c: any = { width: 0, height: 0 };
    let g: any = null;
    c.getContext = () => (g || (g = recCtx()));
    made.push(c);
    return c;
  };
  const body = CONSTS.map(liftConst).join("\n") + "\n" +
    "let SHARE_BLUR_C = null, SHARE_BLUR_KEY = \"\";\n" +
    "let SPHOTO = null;\n" +
    FNS.map(lift).join("\n") + "\n" +
    "return { " + FNS.concat(CONSTS, EXTRA).join(", ") + ", setPhoto: (p) => { SPHOTO = p; }," +
    " getPhoto: () => SPHOTO };";
  const out = new Function("PHOTODIAG", "document", body)(
    { err: "" }, { createElement: mkCanvas }) as Env;
  out.ctx = recCtx;
  out.canvases = made;
  return out;
}

/** The five source shapes the ruling has to survive, and what each one is here to catch. */
const SHAPES: [string, number, number][] = [
  ["3:4 portrait", 1200, 1600],
  ["4:3 landscape", 1600, 1200],
  ["1:1 square", 1400, 1400],
  ["3:1 panorama", 2400, 800],
  ["9:21 tower", 900, 2100],
];

/* ================================================================================================ *
 * THE GEOMETRY                                                                                     *
 * ================================================================================================ */

test("BLOCKER: contain is the DEFAULT and fill is the opt-in, at every shape and both aspects", () => {
  // ⚠️ THE DEFAULT IS THE RULING. A slot that has never been touched must show the whole photograph, so
  // the default is read from SHARE_CROP0 and from the box's own behaviour with no flag at all — not from
  // a call site passing fill:false, which would pass whichever way round the default sat.
  const E = env();
  assert.equal(E.SHARE_CROP0.fill, false, "the untouched framing slot asks to crop the photograph");
  for (const aspect of ["story", "feed"]) {
    const gm = E.cardGeom(aspect);
    for (const [why, w, h] of SHAPES) {
      const bare = E.sharePhotoBox({ w, h, k: 1 }, gm.W, gm.H);
      const whole = E.sharePhotoBox({ w, h, k: 1, fill: false }, gm.W, gm.H);
      const fill = E.sharePhotoBox({ w, h, k: 1, fill: true }, gm.W, gm.H);
      assert.deepEqual(bare, whole, why + ": a box with no fit named is not the whole photograph");
      // Contain is inside the canvas; fill covers it. Neither ever distorts.
      assert.ok(whole.x >= -0.001 && whole.y >= -0.001 &&
        whole.x + whole.w <= gm.W + 0.001 && whole.y + whole.h <= gm.H + 0.001,
        why + " " + aspect + ": the default cuts the photograph off -> " + JSON.stringify(whole));
      assert.ok(fill.x <= 0.001 && fill.y <= 0.001 &&
        fill.x + fill.w >= gm.W - 0.001 && fill.y + fill.h >= gm.H - 0.001,
        why + " " + aspect + ": fill leaves a gap -> " + JSON.stringify(fill));
      for (const b of [whole, fill]) {
        assert.ok(Math.abs((b.w / b.h) - (w / h)) < 1e-9, why + ": the photograph is distorted");
      }
      // ⚠️ AND CONTAIN IS THE LARGEST SUCH FIT. Without this a solver that returned a tiny centred
      // thumbnail would satisfy every assertion above — "the whole photograph is present" is only half
      // the ruling; "shown" is the other half.
      assert.ok(Math.abs(whole.w - gm.W) < 0.001 || Math.abs(whole.h - gm.H) < 0.001,
        why + " " + aspect + ": contain is not the largest fit -> " + JSON.stringify(whole));
      // The two modes genuinely differ unless the source happens to match the card exactly.
      if (Math.abs(w / h - gm.W / gm.H) > 0.001) {
        assert.ok(fill.w > whole.w + 1, why + " " + aspect + ": fill and contain are the same box");
      }
    }
  }
});

test("BLOCKER: an axis with slack is CENTRED, so the drag can never invert", () => {
  // ⚠️ (W - dw) IS NEGATIVE UNDER COVER AND POSITIVE UNDER CONTAIN, so one fraction cannot mean the same
  // thing in both modes: honoured on a contained axis, the same finger movement would push the picture
  // left in one mode and right in the other. Measured as "the fraction changes nothing on an axis with
  // room", which is the property the gesture code relies on.
  const E = env();
  for (const aspect of ["story", "feed"]) {
    const gm = E.cardGeom(aspect);
    for (const [why, w, h] of SHAPES) {
      const mid = E.sharePhotoBox({ w, h, ox: 0.5, oy: 0.5, k: 1 }, gm.W, gm.H);
      for (const ox of [0, 0.25, 1]) for (const oy of [0, 0.25, 1]) {
        const b = E.sharePhotoBox({ w, h, ox, oy, k: 1 }, gm.W, gm.H);
        if (mid.w < gm.W - 0.5) assert.ok(Math.abs(b.x - mid.x) < 1e-9,
          why + " " + aspect + ": a contained x honoured the pan (" + mid.x + " -> " + b.x + ")");
        if (mid.h < gm.H - 0.5) assert.ok(Math.abs(b.y - mid.y) < 1e-9,
          why + " " + aspect + ": a contained y honoured the pan (" + mid.y + " -> " + b.y + ")");
      }
      // And an OVERFLOWING axis still pans, in the direction it always did: ox 0 shows the left edge.
      const zoom = { w, h, k: 6, ox: 0, oy: 0.5 };
      const z0 = E.sharePhotoBox(zoom, gm.W, gm.H);
      const z1 = E.sharePhotoBox({ ...zoom, ox: 1 }, gm.W, gm.H);
      assert.ok(Math.abs(z0.x) < 0.001, why + ": ox 0 does not put the left edge on the left edge");
      assert.ok(z1.x < z0.x - 1, why + ": ox 1 did not pan the other way");
    }
  }
});

test("BLOCKER: the gesture code asks sharePhotoBox rather than carrying a second copy of its arithmetic", () => {
  // ⚠️ THIS RE-DERIVED THE COVER SCALE BY HAND — Math.max(gm.W / p.w, gm.H / p.h) * c.k — and the fit
  // ruling gave that copy two fresh ways to be wrong at once: the base scale is the MINIMUM of the two
  // ratios under contain, and an axis with slack is centred rather than panned. A drag then moved the
  // picture by the wrong amount, in the wrong direction, with nothing throwing.
  const src = nocomment(lift("studioGestures"));
  assert.ok(/sharePhotoBox\(/.test(src), "studioGestures no longer asks sharePhotoBox for the box");
  assert.ok(!/Math\.max\(\s*gm\.W\s*\/\s*p\.w/.test(src) && !/Math\.min\(\s*gm\.W\s*\/\s*p\.w/.test(src),
    "the gesture code derives the photograph's scale itself");
  // ⚠️ AND ONLY AN OVERFLOWING AXIS PANS. Written as Math.abs(hx) > 1 a contained axis would be written
  // to and move nothing, which is a drag that silently does nothing; and if the box ever honoured it,
  // the direction would be reversed.
  assert.ok(!/Math\.abs\(hx\)\s*>\s*1/.test(src) && !/Math\.abs\(hy\)\s*>\s*1/.test(src),
    "the pan is gated on the MAGNITUDE of the slack, so it writes a fraction to a centred axis");
  assert.ok(/hx\s*<\s*-1/.test(src) && /hy\s*<\s*-1/.test(src),
    "the pan is not gated on the axis actually overflowing");
  // The anchored pinch must use the box's own origin, not slack x fraction.
  assert.ok(!/\(before\.gm\.W - before\.dw\) \* c\.ox/.test(src),
    "the pinch anchor multiplies the slack by the fraction, which is not where the picture is");
  assert.ok(/before\.x/.test(src) && /before\.y/.test(src),
    "the pinch anchor does not read the box's own origin");
});

/* ================================================================================================ *
 * THE SURROUND                                                                                     *
 * ================================================================================================ */

test("BLOCKER: the gap is filled by a blurred reflection of the photograph, drawn UNDER it", () => {
  const E = env();
  const gm = E.cardGeom("story");
  const ctx = E.ctx();
  E.sharePhotoDraw(ctx, { w: 1600, h: 1200, ox: 0.5, oy: 0.5, k: 1, id: "t1", bitmap: {} }, gm);
  const order = ctx.log.map((e: any[]) => e[0]).filter((n: string) => n === "drawImage" || n === "fillRect");
  // ⚠️ THE ORDER IS THE WHOLE POINT: surround, the veil that darkens it, then the photograph ON TOP.
  // Reversed, the veil lands on the runner's picture — the one thing the ruling forbids.
  assert.deepEqual(order, ["drawImage", "fillRect", "drawImage"],
    "the surround, its veil and the photograph are not drawn in that order: " + JSON.stringify(order));
  const styles = ctx.log.filter((e: any[]) => e[0] === "fillStyle").map((e: any[]) => String(e[1]));
  assert.ok(styles.length === 1 && /^rgba\(6,17,14,0?\.\d+\)$/.test(styles[0]!),
    "the surround's veil is not a translucent fill of the card's own ground: " + JSON.stringify(styles));
  assert.ok(E.SHARE_BLUR.veil > 0 && E.SHARE_BLUR.veil < 1, "the surround's veil is opaque or absent");
  // The clip is the whole canvas, not a region of it.
  assert.deepEqual(ctx.calls("rect")[0], ["rect", 0, 0, gm.W, gm.H],
    "the composite is clipped to less than the canvas");
});

test("BLOCKER: a card with NO gap draws one image and tints nothing", () => {
  // ⚠️ THIS IS THE ASSERTION THE SURROUND MUST NOT BE ALLOWED TO WEAKEN. A flat veil over all of the
  // picture was in this function once for "cohesion" and is the arbitrary treatment the brief rejects;
  // the surround may only ever paint where the photograph does not reach, so on a covered card there is
  // nothing for it to do and every fill-mode export is unchanged by its existence.
  const E = env();
  for (const aspect of ["story", "feed"]) {
    const gm = E.cardGeom(aspect);
    for (const [why, w, h] of SHAPES) {
      const ctx = E.ctx();
      E.sharePhotoDraw(ctx, { w, h, ox: 0.5, oy: 0.5, k: 1, fill: true, id: "f" + w, bitmap: {} }, gm);
      assert.equal(ctx.calls("drawImage").length, 1, why + " " + aspect + ": more than the photograph was drawn");
      assert.equal(ctx.calls("fillRect").length, 0, why + " " + aspect + ": the photograph is being tinted");
    }
    // And a contain that has been zoomed past the fit is a covered card too.
    const gm2 = E.cardGeom(aspect);
    const ctx2 = E.ctx();
    E.sharePhotoDraw(ctx2, { w: 1200, h: 1600, ox: 0.5, oy: 0.5, k: 4, id: "z", bitmap: {} }, gm2);
    assert.equal(ctx2.calls("fillRect").length, 0,
      aspect + ": a zoomed contain still paints a surround nobody can see");
  }
});

test("BLOCKER: the gap is decided by the BOX, never by the mode", () => {
  // ⚠️ KEYED ON p.fill INSTEAD, the surround would be built, veiled and drawn underneath a photograph
  // pinched past the fit that hides every pixel of it — work for nothing, and a cached bitmap held for
  // something nobody can see.
  const E = env();
  const gm = E.cardGeom("story");
  assert.ok(!/\bp\.fill\b/.test(nocomment(lift("shareBoxLeavesGap"))),
    "the gap test reads the fit mode instead of the box");
  assert.ok(!/\.fill\b/.test(nocomment(lift("sharePhotoCompose")).replace(/fillStyle|fillRect/g, "")),
    "the composite branches on the fit mode rather than on there being a gap");
  const zoomed = E.sharePhotoBox({ w: 1200, h: 1600, ox: 0.5, oy: 0.5, k: 4 }, gm.W, gm.H);
  assert.equal(E.shareBoxLeavesGap(zoomed, gm.W, gm.H), false,
    "a contain zoomed past the fit is still reported as leaving a gap");
  const covered = E.sharePhotoBox({ w: 1200, h: 1600, k: 1, fill: true }, gm.W, gm.H);
  assert.equal(E.shareBoxLeavesGap(covered, gm.W, gm.H), false, "a covered card reports a gap");
  assert.equal(E.shareBoxLeavesGap(E.sharePhotoBox({ w: 2400, h: 800, k: 1 }, gm.W, gm.H), gm.W, gm.H),
    true, "a panorama shown whole reports no gap");
});

test("BLOCKER: the surround is REFLECTED at the seam, and mirrored rather than repeated or stretched", () => {
  // ⚠️ THIS IS THE DEFECT THAT LOOKED LIKE A DESIGN CHOICE AND WAS NOT. The first cut built the surround
  // as a blurred cover crop of the whole picture, and a cover crop of a 3:4 photograph shows its vertical
  // MIDDLE — so on a sunset the band above the picture came out muddy brown while the picture's own top
  // row is deep blue sky, and at full size that is a hard coloured line across the card. Chasing blur
  // strength first (24 down to 4) improved the smudge and left the line exactly where it was.
  // The band now mirrors the strip it touches, so the two are the same colour BY CONSTRUCTION.
  // ⚠️ ASSERTED ON THE CALLS THE FUNCTION MAKES, NOT ON ITS SOURCE TEXT — AND THE FIRST VERSION OF THIS
  // GUARD WAS REFUTED BY ITS OWN RE-BREAK. Written as "the source contains scale(1, -1)" it passed with
  // both reflection branches switched off at `if (false)`, because the dead code still contains the
  // string. A source grep cannot tell live code from dead code; a recorded draw can.
  const E0 = env();
  const gmS = E0.cardGeom("story");
  E0.shareBlurBg({ w: 1600, h: 1200, id: "refl-v", bitmap: {} }, gmS);
  const tinyV = E0.canvases[0].getContext("2d").log;
  const flipsV = tinyV.filter((e: any[]) => e[0] === "scale" && e[1] === 1 && e[2] === -1);
  assert.equal(flipsV.length, 2, "a vertically letterboxed surround made " + flipsV.length +
    " vertical reflections; the top and bottom bands each need one");
  // Each reflection draws a STRIP of the source, not the whole of it, and the two strips are the
  // photograph's own opposite edges — which is what makes the join continuous.
  // drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) records as [name, src, sx, sy, sw, sh, dx, dy, dw, dh].
  const stripsV = tinyV.filter((e: any[]) => e[0] === "drawImage" && e.length === 10 && e[5] < 1200);
  assert.ok(stripsV.length >= 2,
    "the reflections do not draw an edge strip of the source: " + JSON.stringify(stripsV));
  assert.ok(stripsV.some((e: any[]) => e[3] === 0), "no reflection is taken from the photograph's top edge");
  assert.ok(stripsV.some((e: any[]) => e[3] > 0), "no reflection is taken from the photograph's bottom edge");
  const E1 = env();
  E1.shareBlurBg({ w: 900, h: 2100, id: "refl-h", bitmap: {} }, E1.cardGeom("story"));
  const tinyH = E1.canvases[0].getContext("2d").log;
  const flipsH = tinyH.filter((e: any[]) => e[0] === "scale" && e[1] === -1 && e[2] === 1);
  assert.equal(flipsH.length, 2, "a horizontally letterboxed surround made " + flipsH.length +
    " horizontal reflections; the left and right bands each need one");
  const src = nocomment(lift("shareBlurBg"));
  // ⚠️ A TRUE 1:1 REFLECTION, WHICH MEANS THE STRIP IS AS DEEP AS THE BAND. Written as a fixed fraction
  // of the photograph (45%) the strip was squashed into a 3px band, so the pixel touching the seam was
  // the mean of the top 229 source rows — blue sky averaged with brown cloud — and the line survived.
  // Reflection padding is only continuous when it is not scaled.
  assert.ok(/bc\.y \/ kc/.test(src) && /bc\.x \/ kc/.test(src),
    "the reflected strip's depth is not derived from the band and the contain scale");
  assert.ok(!/SHARE_BLUR\.mirror/.test(src) && !/mirror:/.test(liftConst("SHARE_BLUR")),
    "a fixed mirror fraction is back, which is the squashed reflection that left the seam visible");
  // ⚠️ AND THE REFLECTION IS TAKEN AGAINST THE CARD'S BOX SCALED DOWN, not against a fresh fit inside
  // the tiny canvas: the tiny height is ROUNDED, so a fit computed there can put its slack on the other
  // axis from the card's, and a reflection on the wrong axis guarantees nothing.
  assert.ok(/tw \/ gm\.W/.test(src), "the tiny layout is not derived from the card's own geometry");
});

test("BLOCKER: no CanvasRenderingContext2D.filter anywhere in the renderer", () => {
  // ⚠️ IT IS A RECENT SAFARI ADDITION AND THIS APP RUNS IN A WKWEBVIEW ON WHATEVER iOS THE RUNNER IS ON,
  // so a blur built on it is a blur that silently does not happen on an older phone — and a sharp
  // enlargement behind a photograph reads as a rendering fault rather than as a missing effect.
  // Derived by walking the closure so a filter added to a sub-renderer later is caught by the same guard.
  const html = page();
  const seen = new Set<string>();
  const q = ["drawShareCard"];
  while (q.length) {
    const n = q.shift()!;
    if (seen.has(n)) continue;
    seen.add(n);
    const b = lift(n);
    assert.ok(!/\.filter\s*=/.test(nocomment(b)), n + " sets ctx.filter, which older iOS ignores");
    for (const m of b.matchAll(/\b((?:card|share|draw)[A-Za-z0-9_]*)\s*\(/g)) {
      const c = m[1]!;
      if (!seen.has(c) && html.includes("function " + c + "(")) q.push(c);
    }
  }
  assert.ok(seen.size >= 8, "the renderer closure collapsed to " + seen.size);
  // The blur is a downscale plus a chain of doubling enlargements, which every canvas has always had.
  const src = lift("shareBlurBg");
  assert.ok(/while \(cur\.width < SHARE_BLUR\.w\)/.test(src), "the doubling chain is gone");
  assert.ok(E_TINY() * 4 < 216, "the surround is enlarged in too few steps to be a blur");
});
function E_TINY(): number { return env().SHARE_BLUR.tiny; }

test("BLOCKER: the surround is computed once per (photograph, aspect), not per frame", () => {
  // ⚠️ KEYED ON THE FRAMING TOO IT WOULD BE REBUILT ON EVERY pointermove, and this is drawn under a
  // finger. Measured through the real editor: 40 drag frames rebuild it zero times, and the cached
  // bitmap is the same object afterwards.
  const E = env();
  const gm = E.cardGeom("story");
  const p = { w: 1200, h: 1600, id: "cache-1", bitmap: {} };
  const first = E.shareBlurBg(p, gm);
  assert.ok(first, "the surround was not built at all");
  for (const k of [1, 1.2, 1.5, 2]) for (const ox of [0, 0.5, 1]) {
    assert.equal(E.shareBlurBg({ ...p, k, ox }, gm), first,
      "the surround was rebuilt when the framing moved (k " + k + " ox " + ox + ")");
  }
  // The fit mode must not rebuild it either: fill simply stops drawing it.
  assert.equal(E.shareBlurBg({ ...p, fill: true }, gm), first,
    "the surround was rebuilt when the fit mode changed");
  // A different aspect and a different photograph both must.
  assert.notEqual(E.shareBlurBg(p, E.cardGeom("feed")), first,
    "the surround survived a change of aspect, so one bitmap is serving two card shapes");
  const back = E.shareBlurBg(p, gm);
  assert.notEqual(E.shareBlurBg({ ...p, id: "cache-2" }, gm), back,
    "the surround survived a change of photograph");
  // ⚠️ AND IT IS CACHED SMALL. At full card size it would be 8.3 MB of resident RGBA, which is the
  // allocation this project already records getting a web view jetsammed.
  assert.equal(back.width, E.SHARE_BLUR.w, "the cached surround is not at the documented small size");
  assert.ok(E.SHARE_BLUR.w <= 320, "the cached surround is large enough to be a memory problem");
});

/* ================================================================================================ *
 * SAFETY, RE-DERIVED PER MODE                                                                      *
 * ================================================================================================ */

test("BLOCKER: the subject exclusion and the route zone are recomputed per fit mode", () => {
  // ⚠️ CONTAIN PUTS THE SUBJECT SOMEWHERE ELSE AND MAKES IT SMALLER, so a rectangle carried over from the
  // cover fit would guard the wrong band of somebody's photograph. Measured across the five shapes: the
  // face zone moves 8 to 517px between the modes and its area changes by up to 620,110 px^2.
  // ⚠️ AND IT ASSERTS DISPLACEMENT, NOT A DIRECTION. The prediction was "higher and smaller"; measured, a
  // 4:3 source in a 9:16 card goes LOWER under contain, because the picture is centred in a tall card
  // while the cover crop was pinned to its top edge. "Smaller" holds everywhere; "higher" does not.
  const E = env();
  for (const aspect of ["story", "feed"]) {
    const gm = E.cardGeom(aspect);
    for (const [why, w, h] of SHAPES) {
      const whole = E.shareSubjectZones(E.sharePhotoBox({ w, h, k: 1 }, gm.W, gm.H), gm);
      const fill = E.shareSubjectZones(E.sharePhotoBox({ w, h, k: 1, fill: true }, gm.W, gm.H), gm);
      const area = (z: any) => z.w * z.h;
      // ⚠️ THERE IS ONE PAIRING WHERE THE TWO MODES MUST AGREE EXACTLY, AND THE SQUARE FOUND IT. When the
      // source and the card have the same aspect there is nothing to crop and nothing to pad, so contain
      // and cover are the same box — and a fit mode that moved the subject there would be doing something
      // arbitrary rather than fitting. The first version of this guard demanded a difference at every
      // pairing and failed on a 1:1 source in a 1:1 card, which is correct code.
      const same = Math.abs(w / h - gm.W / gm.H) < 0.001;
      if (same) {
        assert.deepEqual([whole.face, whole.body], [fill.face, fill.body],
          why + " " + aspect + ": the source already fits the card, so the fit mode changed nothing and " +
          "yet the subject zones moved");
      } else {
        assert.ok(area(whole.body) < area(fill.body) - 100,
          why + " " + aspect + ": the body zone is the same size in both fit modes");
      }
      assert.ok(whole.face.w > 0 && whole.face.h > 0 && whole.body.w > 0,
        why + " " + aspect + ": a contain-mode subject zone is empty");
      for (const z of [whole.face, whole.body, fill.face, fill.body]) {
        assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= gm.W + 0.001 && z.y + z.h <= gm.H + 0.001,
          why + ": a subject zone escapes the canvas");
      }
    }
  }
  // ⚠️ AND IT IS DERIVED FROM THE BOX, WHICH IS WHAT MAKES THAT AUTOMATIC. Reading the canvas centre
  // instead, it would guard empty sky the moment the runner moved their photograph OR changed the fit.
  const src = nocomment(lift("shareSubjectZones"));
  assert.ok(/sharePhotoNorm\(box/.test(src), "the exclusion no longer maps through the crop transform");
  assert.ok(!/gm\.W \/ 2/.test(src), "the exclusion is anchored to the canvas rather than the picture");
});

test("BLOCKER: the luminance probe composites exactly what the card does, and the mode is in its key", () => {
  // ⚠️ IN CONTAIN MODE THE GROUND UNDER THE COPY IS OFTEN THE SURROUND RATHER THAN THE PHOTOGRAPH'S OWN
  // LOWER HALF, and a blurred bright sky is still a bright ground. A probe that composited only the
  // photograph would solve the scrim against a ground that is not there, and the runner would approve a
  // picture whose file reads differently.
  const src = nocomment(lift("shareLumaProbe"));
  assert.ok(/sharePhotoCompose\(/.test(src),
    "the probe draws the photograph itself instead of going through the one composite");
  assert.ok(!/q\.drawImage\(photo\.bitmap/.test(src),
    "the probe still has its own copy of the photograph draw");
  assert.ok(/photo\.fill/.test(src), "the fit mode is not in the probe's cache key");
  // ⚠️ AND IT ASKS FOR THE SURROUND AGAINST THE CARD'S GEOMETRY, not the probe's own size, so the two
  // share one cached bitmap instead of evicting each other on every frame.
  assert.ok(/sharePhotoCompose\(q, photo, SHARE_PROBE_W, H, gm\)/.test(src),
    "the probe composites against its own size, so the surround cache thrashes");
});

test("BLOCKER: neither fit mode can put a wash over the photograph, because there is no wash", () => {
  // ⚠️ THIS GUARD USED TO ASSERT THE SCRIM'S CAP AND ITS SOLVER MARGIN, and both are gone: the owner
  // removed the gradient outright on 2026-08-21 ("the gradient is worse! I think it's best to just remove
  // it completely"). The rule it protected — the data and text are an OVERLAY, never a panel — is now
  // carried by the copy's own keyline, and it is re-asserted here rather than left to the render file
  // because THIS file owns the fit, and the fit is what decides how much photograph there is to protect.
  const E = env();
  assert.ok(E.SHARE_INK.ground, "the ground token is gone");
  const src = page();
  for (const dead of ["SHARE_SCRIM", "SHARE_SCRIM_MARGIN", "shareVeilAlphaFor", "shareVeilPlan",
    "shareVeilDraw", "sharePhotoScrim"]) {
    assert.ok(!new RegExp("\\b" + dead + "\\b").test(src),
      dead + " is back, so a wash can be solved over somebody's photograph again");
  }
  // ⚠️ AND THE FIT IS STILL WHAT DECIDES HOW MUCH PICTURE THERE IS. Under contain the surround is a
  // darkened mirror, which IS a translucent full-canvas fill — legitimately, because it is composited
  // UNDER the photograph as its mat. Asserted here so that ordering cannot quietly invert.
  const compose = lift("sharePhotoCompose");
  const veilAt = compose.indexOf("SHARE_BLUR.veil");
  const photoAt = compose.lastIndexOf("drawImage");
  assert.ok(veilAt > 0 && photoAt > veilAt,
    "the surround's darkening is applied after the photograph is drawn, which makes it a wash over the " +
    "picture rather than the mat behind it");
});

/* ================================================================================================ *
 * PERSISTENCE AND THE CONTROL                                                                      *
 * ================================================================================================ */

test("BLOCKER: the fit is persisted per (template, aspect), like every other part of the framing", () => {
  // ⚠️ ONE SHARED ANSWER COULD NEVER HAVE BEEN RIGHT. A 9:16 story and a 4:5 feed post leave slack on
  // different edges and the four templates put their type in four different places, so switching shape
  // to see what it looked like would destroy the choice just made.
  const E = env();
  assert.ok("fill" in E.SHARE_CROP0, "the read-only default framing carries no fit");
  const write = lift("shareCropWrite");
  assert.ok(/fill: false/.test(write), "a freshly created framing slot carries no fit");
  const view = lift("sharePhotoView");
  assert.ok(/fill: !!c\.fill/.test(view),
    "the photograph handed to a card does not carry the slot's fit, so the slot is decorative");
  // ⚠️ AND IT IS IN THE CACHE KEY, or the encoded file lags a tap behind the preview.
  assert.ok(/fill/.test(lift("shareCropSig")),
    "the fit is not in the card's cache signature, so a toggle can serve a stale file");
  // Undo carries it too: a fit left out means Undo restores a pan onto whichever fit happens to be
  // current, which is a state the runner was never in.
  assert.ok(/fill: !!c\.fill/.test(lift("studioCropArm")), "the undo entry does not record the fit");
  assert.ok(/c\.fill = !!e\.fill/.test(lift("studioCropUndo")), "undo does not restore the fit");
  // ⚠️ AND Reset DOES NOT TOUCH IT, because one of the two is a named mode with a switch the runner can
  // see and the other is what a finger did. Reset is also reached by a double-tap on the card, so
  // folding the fit in would mean a gesture flipping a switch in a sheet that is not open.
  assert.ok(!/fill/.test(nocomment(lift("studioCropReset"))),
    "Reset framing silently flips the Fill switch");
});

test("BLOCKER: the Fill switch exists, reads its state from the slot, and is reached by a handler", () => {
  // The looks-live-does-nothing class this project has shipped three times (#saveSetup, rdMore, the
  // studio's own Add a photo). A switch that renders and is wired to nothing is the same defect.
  const src = lift("studioPhotoHtml");
  assert.ok(/data-sst="fit"/.test(src), "the Photo tool has no Fill switch");
  assert.ok(/role="switch"/.test(src) && /aria-checked/.test(src),
    "the Fill switch is not announced as a switch with a state");
  // ⚠️ THE STATE IS READ FROM THE SLOT THIS CARD IS DRAWN WITH. Holding its own copy it would show the
  // previous card's answer for one render after every swipe.
  assert.ok(/shareCropRead\(/.test(src),
    "the Fill switch does not read its state from the framing slot");
  const click = nocomment(lift("studioClick"));
  assert.ok(/what === "fit"/.test(click), "no handler reaches the Fill switch");
  assert.ok(/studioCropFit\(\)/.test(click), "the Fill switch is not wired to studioCropFit");
  const fit = lift("studioCropFit");
  assert.ok(/studioCropArm\(\)/.test(fit), "toggling the fit is not undoable");
  assert.ok(/c\.fill = !c\.fill/.test(fit), "studioCropFit does not toggle the slot's fit");
  // ⚠️ AND THE ZOOM GOES BACK TO THE FIT WITH IT. k is a multiple of whichever base scale is in force,
  // so a card left at k 2.4 under contain is cropped HARDER than cover the instant Fill comes on — the
  // runner asks to see more of their photograph and sees less of it.
  assert.ok(/c\.k = 1/.test(fit), "the zoom survives a change of fit, so Fill can crop harder than cover");
  assert.ok(/studioSync\(\)/.test(fit), "the preview is not repainted after the fit changes");
  // The switch's own note has to say what the two states DO; a bare label teaches nothing.
  assert.ok(/whole photo/.test(src) && /crops/.test(src),
    "the Fill switch does not say what either state does");
});
