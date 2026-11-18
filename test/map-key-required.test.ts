import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * THE MAPS STOPPED WORKING BECAUSE THE FREE MAPS STOPPED BEING FREE — owner, 2026-11-18:
 *
 *   "I want the maps to work, they worked previously and need you to investigate this and fix why
 *    theyve stopped working"
 *
 * ⚠️ WHAT "PREVIOUSLY" WAS. In the phone app the maps have been CARTO's free tiles since 2026-08-17: his
 * Mapbox token is URL-restricted, interun://app matches no URL, Mapbox refuses it, and routeMapFor falls
 * back. CARTO then put its free basemaps behind a key. Measured 2026-11-18: every tile, every style the
 * app uses, comes back 200 OK and CORS-clean as a 256-px grey square reading "API KEY REQUIRED" — even
 * when the 512-px @2x tile is asked for. Nothing failed, so the app drew those squares, and CACHED the
 * picture, so each run opened since kept it.
 *
 * Guarded here, against the real functions lifted out of the built page:
 *   1. a tile narrower than it was asked for is refused as a placeholder;
 *   2. a placeholder is not retried, not drawn and not cached, and CARTO is not asked again that session;
 *   3. every cache key carries a generation, so the grey pictures already stored are never shown again;
 *   4. the Maps card stops promising "Free, no account" and says when Mapbox refuses a token.
 * The street map itself comes back with a Mapbox token that has no URL restriction (ios/mapbox-token.txt).
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));

function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function loadTileImage(");
  assert.ok(marker >= 0, "loadTileImage is not in the build — run node web/app.ts");
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
/** Strip // comments so a guard cannot be satisfied by the comment that explains it. */
const code = (s: string) => s.replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1 ");

/** A stand-in for the browser's Image: loads at the width the "server" decides for that URL. */
type Served = (url: string) => number | "error";
function fakeImage(serve: Served, requested: string[]) {
  return class {
    crossOrigin = "";
    naturalWidth = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(u: string) {
      requested.push(u);
      const w = serve(u);
      queueMicrotask(() => {
        if (w === "error") { if (this.onerror) this.onerror(); return; }
        this.naturalWidth = w;
        if (this.onload) this.onload();
      });
    }
  };
}

type Diag = { tried: number; cors: number; tainted: number; failed: number; why: string;
  cartoRefused: boolean; mapboxRefused: boolean };
const freshDiag = (): Diag => ({ tried: 0, cors: 0, tainted: 0, failed: 0, why: "no map drawn yet",
  cartoRefused: false, mapboxRefused: false });

/** The real loadTileImage + loadRouteMap, with a fake network. */
function loader(serve: Served) {
  const requested: string[] = [];
  const MAPDIAG = freshDiag();
  const src = ["loadTileImage", "loadRouteMap", "routeMapFraming", "mercX", "mercY"].map(fnBody).join("\n") +
    "\nconst MAP_TILE = 256, MAP_W = 984, MAP_H = 576;" +
    "\nreturn { loadTileImage: loadTileImage, loadRouteMap: loadRouteMap };";
  const api = (new Function("MAPDIAG", "Image", "mapProviderFor", "MAP_STYLE_SHARE", "setTimeout", "clearTimeout", src) as
    (...a: unknown[]) => { loadTileImage: (u: string, t: boolean, w?: number) => Promise<unknown>;
      loadRouteMap: (r: unknown, pw: number, ph: number, prov: unknown) => Promise<unknown> })(
    MAPDIAG, fakeImage(serve, requested), () => ({ kind: "carto", style: "dark_all", token: "" }),
    { mapbox: "dark-v11", carto: "dark_all" }, () => 0, () => {});
  return { api, requested, MAPDIAG };
}
// A short loop in London — any real route; nothing here depends on where it is.
const ROUTE = [
  { lat: 51.5074, lng: -0.1278 }, { lat: 51.5094, lng: -0.1258 },
  { lat: 51.5110, lng: -0.1290 }, { lat: 51.5080, lng: -0.1310 },
];
const CARTO = { kind: "carto", style: "rastertiles/voyager", token: "" };
const MAPBOX = { kind: "mapbox", style: "outdoors-v12", token: "pk.test" };

test("BLOCKER: a tile narrower than it was asked for is refused as a placeholder", async () => {
  const { api } = loader((u) => (/placeholder/.test(u) ? 256 : 512));
  await assert.rejects(api.loadTileImage("https://x/placeholder@2x.png", false, 512), /placeholder/,
    "CARTO's 256-px API KEY REQUIRED square was accepted as a 512-px map tile");
  await api.loadTileImage("https://x/real@2x.png", false, 512);           // a real @2x tile loads
  const { api: shy } = loader(() => 0);
  await shy.loadTileImage("https://x/any.png", false, 512);               // an engine that will not say: let through
});

test("BLOCKER: CARTO's placeholder is not retried, not drawn, and not asked for again this session", async () => {
  const { api, requested, MAPDIAG } = loader((u) => (/cartocdn/.test(u) ? 256 : 512));
  await assert.rejects(api.loadRouteMap(ROUTE, 700, 420, CARTO), /placeholder/);
  const first = requested.length;
  assert.ok(first > 0 && first <= 40, "no tiles were asked for at all: " + first);
  assert.ok(requested.every((u) => /@2x\.png$/.test(u)), "the tiles are no longer asked for at @2x, so the size check means nothing");
  // ⚠️ The uncached retry exists for a CORS refusal. For a placeholder it would fetch the same grey
  // squares again and draw them anyway, so it must not run: every request above is the first attempt.
  assert.equal(MAPDIAG.tainted, 0, "the placeholder was retried without CORS and drawn");
  assert.equal(MAPDIAG.cartoRefused, true);
  assert.match(MAPDIAG.why, /free maps \(CARTO\) now need a key/, "the diagnostic line hides why there is no map");
  await assert.rejects(api.loadRouteMap(ROUTE, 700, 420, CARTO), /placeholder/);
  assert.equal(requested.length, first, "CARTO was asked again after it had answered with its key placeholder");
});

test("a working provider is untouched: full-size tiles load and resolve a map", async () => {
  const { api, MAPDIAG } = loader(() => 512);
  const md = await api.loadRouteMap(ROUTE, 700, 420, MAPBOX) as { tiles: unknown[] };
  assert.ok(md.tiles.length > 0);
  assert.equal(MAPDIAG.why, "ok, cached");
  assert.equal(MAPDIAG.cartoRefused, false);
});

/** The real routeMapFor, with the cache and the loader stubbed. */
function mapFor(loadFor: (prov: { kind: string }) => Promise<unknown>) {
  const puts: string[] = [], gets: string[] = [];
  const MAPDIAG = freshDiag();
  const src = fnBody("routeMapFor") + "\n" + fnBody("routeMapKey") + "\n" + constStmt("MAPCACHE_GEN") +
    "\nreturn routeMapFor;";
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ scale() {}, fillRect() {}, drawImage() {}, fillStyle: "" }),
    toBlob: (cb: (b: unknown) => void) => cb({ size: 1 }) });
  const fn = (new Function("MAPDIAG", "mapProviderFor", "MAP_STYLE_SHARE", "mapCacheGet", "mapCachePut",
    "loadRouteMap", "document", "MAPCACHE_SS", "MAP_TILE", "mercX", "mercY", "URL", "Image", src) as
    (...a: unknown[]) => (r: unknown, pw: number, ph: number, st: unknown) => Promise<{ prov: { kind: string } }>)(
    MAPDIAG, () => MAPBOX, { mapbox: "dark-v11", carto: "dark_all" },
    (k: string) => { gets.push(k); return Promise.resolve(null); },
    (k: string) => { puts.push(k); return Promise.resolve(); },
    (_r: unknown, _w: number, _h: number, prov: { kind: string }) => loadFor(prov),
    { createElement: canvas }, 2, 256, () => 0, () => 0, {}, function () {});
  return { routeMapFor: fn, puts, gets, MAPDIAG };
}
const STYLES = { mapbox: "outdoors-v12", carto: "rastertiles/voyager" };

test("BLOCKER: Mapbox refused, then CARTO's placeholder — no map is cached, and the line says both", async () => {
  const m = mapFor((prov) => prov.kind === "mapbox"
    ? Promise.reject(new Error("cors"))
    : Promise.reject(new Error("placeholder")));
  await assert.rejects(m.routeMapFor(ROUTE, 700, 420, STYLES), /placeholder/);
  assert.equal(m.puts.length, 0, "a picture was stored for a map that never drew");
  assert.equal(m.MAPDIAG.mapboxRefused, true, "the Mapbox refusal is not recorded, so the line cannot say it");
  assert.deepEqual(m.gets.map((k) => k.split("|").slice(-2).join("|")),
    ["mapbox:outdoors-v12|g" + genOf(), "carto:rastertiles/voyager|g" + genOf()],
    "the two attempts did not each look up their own provider's key");
});

function genOf(): number {
  const m = /const MAPCACHE_GEN = (\d+);/.exec(constStmt("MAPCACHE_GEN"));
  assert.ok(m, "MAPCACHE_GEN is not a plain number");
  return Number(m[1]);
}

test("BLOCKER: every cache key carries the generation, and it moved past the grey pictures", async () => {
  // ⚠️ Without this, refusing new placeholder tiles fixes only the runs nobody has opened since CARTO
  // changed: every run already viewed keeps its stored grey picture for ever.
  assert.ok(genOf() >= 2, "the generation was not bumped, so the stored API KEY REQUIRED pictures are still served");
  const body = code(fnBody("routeMapFor"));
  const uses = body.match(/MAPCACHE_GEN/g) || [];
  assert.equal(uses.length, 2, "both key forms (a route and a live point map) must carry the generation");
  const m = mapFor(() => Promise.resolve({ tiles: [], z: 14, originX: 0, originY: 0, proj: () => [0, 0] }));
  await m.routeMapFor(ROUTE, 700, 420, STYLES);
  assert.equal(m.puts.length, 1, "a real map was not cached");
  assert.match(m.puts[0]!, new RegExp("\\|g" + genOf() + "$"), "the stored key has no generation: " + m.puts[0]);
});

/* ------------------------------------------------------------------------------------------------ */

function card(o: { kind: string; injected?: boolean; refused?: boolean; dev?: boolean }): string {
  const MAPDIAG = Object.assign(freshDiag(), { mapboxRefused: !!o.refused });
  const src = fnBody("mapTokenCard") + "\nreturn mapTokenCard;";
  const win: Record<string, unknown> = o.injected ? { __interunMapboxToken: "pk.x" } : {};
  return (new Function("mapProviderFor", "MAP_STYLE_RUN", "window", "MAPDIAG", "mapDevMode", src) as
    (...a: unknown[]) => () => string)(
    () => ({ kind: o.kind, style: "s", token: o.kind === "mapbox" ? "pk.x" : "" }), STYLES, win, MAPDIAG,
    () => !!o.dev)();
}

test("BLOCKER: the Maps card no longer promises free maps that are not free", () => {
  const none = card({ kind: "carto" });
  assert.doesNotMatch(none, /Free, no account/, "the card still promises the free maps CARTO withdrew");
  assert.match(none, /Route only, no street map/);
  assert.doesNotMatch(none, /Paste a Mapbox token/, "a tester (no paste field) is told to paste a token");
  assert.match(card({ kind: "carto", dev: true }), /Paste a Mapbox token below/, "the owner is not told how to bring maps back");
});

test("BLOCKER: a token Mapbox refuses is named as refused, not shown as working", () => {
  const refused = card({ kind: "mapbox", refused: true, dev: true });
  assert.match(refused, /Mapbox refused this token/);
  assert.match(refused, /URL restriction/, "the card does not say why a website-limited token fails in the app");
  assert.doesNotMatch(refused, /Mapbox \u2014 Outdoors/, "a refused token still reads as Outdoors maps");
  assert.match(card({ kind: "mapbox", refused: true, injected: true }), /This build needs one/,
    "with no paste field the card tells the runner to paste one");
  assert.match(card({ kind: "mapbox" }), /Mapbox \u2014 Outdoors/, "a working token no longer reads as working");
});
