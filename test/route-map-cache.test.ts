import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE MAP IS DRAWN ONCE AND KEPT.
 *
 * A run's route never changes, so the picture of it never changes either — but every glance at a run
 * in the Logbook re-fetched its tiles. Free on CARTO, billed per request on Mapbox, and on the NATIVE
 * app cached by nothing at all (the service worker is gated on http(s) and the app serves itself from
 * interun://app). Rendering once and keeping the result makes the bill track how many runs are
 * RECORDED rather than how often they are BROWSED, which is the difference between a map provider
 * being affordable and not.
 *
 * ⚠️ Reads the BUILT web/app.html — this is web-layer code. Run `node web/app.ts` first.
 */
const app = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function lift(name: string): string {
  const html = app();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at >= 0, "not found in the build: " + name);
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}

/** The key builder, lifted and run for real — the one piece with logic worth exercising. */
const routeMapKey = new Function(lift("routeMapKey") + "; return routeMapKey;")();

const ring = (n: number, lat = 53.9583, lng = -1.0803) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n * Math.PI * 2;
    return { lat: lat + Math.sin(t) * 0.0075, lng: lng + Math.cos(t) * 0.0125 };
  });

test("⚠️ the cache is keyed on the ROUTE, never on the run id", () => {
  // ⚠️ THE TRAP THIS EXISTS FOR. liveRunRecord stamps `id: "run-" + new Date().getTime()` on EVERY
  // render of the finish screen, so a run-id key would mint a fresh cache entry several times a second
  // while the runner sat looking at their own finished run — an unbounded store of identical pictures.
  // The route decides what the map looks like, so the route is the key.
  const body = lift("routeMapKey");
  assert.doesNotMatch(body, /\brun\.id\b|\brunId\b/,
    "routeMapKey reads a run id — the finish screen re-stamps that on every render");
  assert.match(body, /route\.length/, "the key does not depend on the route at all");
});

test("the key is stable, and moves when anything that changes the picture moves", () => {
  const r = ring(180);
  const base = routeMapKey(r, 700, 420, "rastertiles/voyager");
  assert.equal(routeMapKey(r, 700, 420, "rastertiles/voyager"), base, "the key is not stable");
  assert.notEqual(routeMapKey(r, 900, 420, "rastertiles/voyager"), base, "size does not affect the key");
  assert.notEqual(routeMapKey(r, 700, 420, "dark_all"), base, "style does not affect the key");
  // ⚠️ The style being in the key is what makes changing map provider safe: nothing has to be cleared
  // by hand, because every old picture is simply keyed under a name nothing asks for any more.
  const moved = ring(180);
  moved[5] = { lat: moved[5]!.lat + 0.01, lng: moved[5]!.lng };
  assert.notEqual(routeMapKey(moved, 700, 420, "rastertiles/voyager"), base, "a changed route reuses the old picture");
  // ...and a different run in a different town cannot collide with it.
  assert.notEqual(routeMapKey(ring(180, 51.5, -0.12), 700, 420, "rastertiles/voyager"), base);
});

test("float noise does not change the key", () => {
  // Rounded to about a metre, so a route that survives a JSON round-trip still hits its own picture.
  const r = ring(120);
  const jittered = r.map((p) => ({ lat: p.lat + 1e-9, lng: p.lng - 1e-9 }));
  assert.equal(routeMapKey(jittered, 700, 420, "x"), routeMapKey(r, 700, 420, "x"),
    "a nanometre of float noise invalidated the cache");
});

test("⚠️ the pictures live in IndexedDB and never in localStorage", () => {
  // ⚠️ A composited map measures ~64 KB. Fifty runs of those in localStorage would blow its quota and
  // take the runner's entire training history with them — localStorage is where the RUNS live.
  const body = lift("mapCacheOpen") + lift("mapCachePut") + lift("mapCacheGet");
  assert.match(body, /indexedDB/, "the cache is not using IndexedDB");
  assert.doesNotMatch(body, /localStorage/, "the map cache touches localStorage — that is where the runs live");
});

test("⚠️ a cached picture never reaches the backup", () => {
  // dataView() discovers backup keys by the interun_/rc_ PREFIX in localStorage, so IndexedDB is
  // excluded by construction — and that is correct, not accidental. An export should carry the run,
  // not a regenerable image of it; adding megabytes of WebP to a file the runner emails themselves
  // would be a poor trade. This asserts the exclusion is still structural.
  const html = app();
  const backup = html.slice(html.indexOf("function dataView("), html.indexOf("function dataView(") + 6000);
  assert.doesNotMatch(backup, /indexedDB|MAPCACHE/,
    "the backup has started collecting the map cache — it will bloat every export");
});

test("every failure is silent and the map still draws", () => {
  // Private browsing, a quota refusal, an engine without IndexedDB: the map must fall straight through
  // to tiles exactly as before. A cache that can break the screen is worse than no cache.
  const open = lift("mapCacheOpen");
  assert.match(open, /resolve\(null\)/, "mapCacheOpen can reject — a storage refusal would break the map");
  assert.match(open, /catch \(e\) \{ resolve\(null\)/, "an exception in open is not swallowed");
  const forFn = lift("routeMapFor");
  assert.match(forFn, /\.catch\(\(\) => null\)/, "a cache read failure is not caught, so the map would never draw");
  assert.match(forFn, /loadRouteMap\(/, "there is no tile fallback at all on a miss");
});

test("the cache is bounded, and evicts what has not been looked at", () => {
  const put = lift("mapCachePut");
  assert.match(put, /MAPCACHE_MAX/, "the store can grow without limit");
  assert.match(put, /sort\(\(a, b\) => \(a\.used \|\| 0\) - \(b\.used \|\| 0\)\)/,
    "eviction is not by last use, so a run opened weekly can be dropped for one recorded once");
  // ⚠️ Reads stamp `used`, or eviction degrades to oldest-WRITTEN and drops the runs being looked at.
  assert.match(lift("mapCacheGet"), /v\.used = Date\.now\(\)/, "a read does not refresh the entry");
});

test("⚠️ the picture is composited at a fixed 2x, not at the device's DPR", () => {
  // Caching at 1x would bake a soft map into every retina screen forever; caching at the drawing
  // device's own DPR would make the stored size depend on which phone happened to open it first.
  const body = lift("routeMapFor");
  assert.match(body, /MAPCACHE_SS/, "the composite is not supersampled");
  assert.doesNotMatch(body, /devicePixelRatio/, "the cached size depends on the device that drew it");
  assert.match(app(), /const MAPCACHE_SS = 2/, "the supersample factor is not 2");
});

test("there is exactly ONE tile source, and ONE place naming the styles", () => {
  const html = app();
  // ⚠️ The whole point of the swap-point: changing map provider is these constants plus the URL in
  // loadRouteMap. If a second tile URL appears anywhere, the two will drift and one surface will
  // silently keep the old provider — and it will be the share card, which nobody looks at until a
  // runner posts it.
  // ⚠️ MATCH THE HOST, NOT A WHOLE URL. The URL is assembled by concatenation
  // ("https://" + sub + ".basemaps.cartocdn.com/" + …), so a pattern expecting a literal
  // https://…cartocdn string matched NOTHING and the count came back 0. Written as `<= 1` that would
  // have passed while measuring nothing at all — the exact shape of dead guard this project keeps
  // hitting. `=== 1` is what turned a silent pass into a visible failure.
  // ⚠️ TWO HOSTS IS NOW CORRECT — there are two providers. What must stay true is that they are both
  // built in ONE FUNCTION, so a swap cannot leave a surface behind on the old provider.
  const hosts = (html.match(/basemaps\.cartocdn|api\.mapbox\.com/g) || []);
  assert.equal(hosts.length, 2, "expected both tile hosts, found " + hosts.length);
  const inLoader = (lift("loadRouteMap").match(/basemaps\.cartocdn|api\.mapbox\.com/g) || []);
  assert.equal(inLoader.length, 2,
    "a tile URL is built outside loadRouteMap — the two providers will drift and one surface will " +
    "keep the old one, silently");
  assert.match(html, /const MAP_STYLE_RUN = /, "the run card's style is not named in one place");
  assert.match(html, /const MAP_STYLE_SHARE = /, "the share card's style is not named in one place");
  // Both consumers go through the cache, or one of them still bills per view.
  // ⚠️ THE SELF-RECURSIVE CALL IS NOT A CONSUMER. routeMapFor re-enters itself once when a refused
  // Mapbox token falls back to CARTO, and it does so precisely SO THAT the cache key is re-derived
  // for the provider that actually drew — falling back deeper down would file a CARTO image under a
  // mapbox key. Counting raw occurrences would have forced that worse design to keep a number at 3.
  // The invariant is "every CONSUMER goes through the cache", so the recursion is excluded by name.
  const calls = (html.match(/routeMapFor\(/g) || []).length;
  const selfCalls = (lift("routeMapFor").match(/routeMapFor\(/g) || []).length - 1;  // minus its own signature
  assert.equal(selfCalls, 1, "expected exactly one fallback re-entry inside routeMapFor");
  assert.equal(calls - selfCalls, 3,
    "a map consumer is bypassing the cache (expected: the definition plus both call sites)");
  assert.equal((html.match(/loadRouteMap\(/g) || []).length, 2,
    "loadRouteMap has a caller other than routeMapFor — that one re-fetches tiles on every view");
});


// ---- Mapbox --------------------------------------------------------------------------------------

test("⚠️ no Mapbox token is ever in the built page", () => {
  // ⚠️ THE ONE THAT MATTERS MOST. docs/index.html is committed and served publicly by GitHub Pages,
  // and a Mapbox token is BILLABLE — a published one is somebody else's free maps at the owner's
  // expense, and a token in git history has been published whatever is done afterwards. It reaches
  // the app from ios/mapbox-token.txt (gitignored) via the bundle at build time, never from here.
  const html = app();
  const found = html.match(/pk\.ey[A-Za-z0-9._-]{20,}/g) || [];
  assert.equal(found.length, 0, "a Mapbox token has been built into the public page");
  assert.doesNotMatch(html, /sk\.ey/, "a Mapbox SECRET token appears in the page — that must never ship at all");
});

test("the app falls back to the free maps when there is no token", () => {
  // Anyone else's checkout, and the public Pages build, must work with no account at all.
  const fn = lift("mapProviderFor");
  assert.match(fn, /kind: "carto"/, "there is no free fallback — a checkout without a token gets no maps");
  assert.match(fn, /kind: "mapbox"/);
  const tok = lift("mapboxToken");
  assert.match(tok, /__interunMapboxToken/, "the injected token is not read");
  assert.match(tok, /indexOf\("pk\."\) === 0/, "the token is not checked for being a PUBLIC one");
  assert.match(tok, /return ""/, "there is no empty default, so an absent token would be undefined");
});

test("⚠️ the cache key includes the PROVIDER, not an object", () => {
  // ⚠️ THE BUG THIS CAUGHT. Once each surface named a style per provider, `styles` became an object —
  // and passing it to routeMapKey stringifies it to "[object Object]", identical for every style. The
  // run card and the share card would then share one cache entry and whichever drew first would win,
  // presenting as the share card rendering the wrong map at the wrong size with nothing to point at.
  const body = lift("routeMapFor");
  assert.match(body, /mapProviderFor\(/, "routeMapFor does not resolve the provider");
  assert.match(body, /prov\.kind \+ ":" \+ prov\.style/, "the key does not include the resolved provider and style");
  // and two different styles must produce two different keys, run for real
  assert.notEqual(routeMapKey(ring(60), 700, 420, "mapbox:outdoors-v12"),
                  routeMapKey(ring(60), 700, 420, "mapbox:dark-v11"));
  assert.notEqual(routeMapKey(ring(60), 700, 420, "mapbox:outdoors-v12"),
                  routeMapKey(ring(60), 700, 420, "carto:rastertiles/voyager"),
                  "switching provider would reuse the other provider's pictures");
});

test("⚠️ attribution follows the provider — it is a licence term, not decoration", () => {
  // Mapbox's terms require Mapbox and OpenStreetMap credited on the map; CARTO's require OpenStreetMap
  // and CARTO. Shipping the wrong one is a breach whichever way round it is.
  const fn = lift("mapAttributionFor");
  assert.match(fn, /Mapbox/, "no Mapbox attribution exists");
  assert.match(fn, /CARTO/, "the CARTO attribution has been dropped");
  assert.match(fn, /prov && prov\.kind === "mapbox"/, "attribution is not derived from a provider");
  // ⚠️ AND IT MUST BE THE PROVIDER THAT ACTUALLY SERVED, NOT THE ONE WE WOULD PREFER. Since a refused
  // Mapbox token falls back to CARTO, mapProviderFor answers the wrong question at render time — it
  // shipped "© Mapbox" over CARTO's tiles, naming a provider that served nothing and omitting the one
  // that did. routeMapFor carries the provider it used back on the result; the caller reads that.
  const html = app();
  assert.match(html, /const out = \{ image: cv, proj: md\.proj, prov: prov \}/,
    "routeMapFor does not report which provider actually drew");
  const builder = lift("buildOverviewMap");
  assert.match(builder, /mapAttributionFor\(md\.prov\)/,
    "the run card credits a preference rather than the provider that served it");
  assert.ok(!/mapAttribution\(MAP_STYLE_RUN\)/.test(builder),
    "the run card is back to asking who we would have preferred");
  // Neither surface may carry a hardcoded string.
  for (const s of ["Mapbox \u00a9 OpenStreetMap", "OpenStreetMap contributors \u00a9 CARTO"]) {
    const n = (html.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    assert.equal(n, 1, "the attribution string \"" + s + "\" appears " + n + " times; it must live in one function");
  }
});

test("the share card stays DARK on both providers", () => {
  // ⚠️ Not an oversight that it is not Outdoors. The share card paints rgba(4,16,13,.4) over the map
  // and draws light text on it; a pale outdoors basemap behind that is washed out and unreadable.
  const html = app();
  assert.match(html, /MAP_STYLE_SHARE = \{ mapbox: "dark-v11", carto: "dark_all" \}/,
    "the share card is no longer dark on both providers");
  assert.match(html, /MAP_STYLE_RUN = \{ mapbox: "outdoors-v12"/,
    "the run card is not on Mapbox Outdoors, which is the style the owner picked");
});


test("⚠️ a pasted token never travels in a backup", () => {
  // ⚠️ IT VERY NEARLY DID. Backup keys are discovered by the interun_/rc_ PREFIX so that a key added
  // later still travels — right for training data, exactly wrong for a billable credential. An export
  // is a file the runner emails themselves or hands to someone helping them; a token in it is a token
  // given away.
  const html = app();
  assert.match(html, /BACKUP_NEVER/, "there is no exclusion list, so the token rides out in every export");
  // ⚠️ MEMBERSHIP, NOT THE EXACT LITERAL. This asserted the whole array as written, so adding a second
  // credential to it failed the test that exists to protect credentials — which pushes whoever hit it
  // towards editing the guard. Every credential is named individually instead, so the list can grow
  // and each entry still has a test of its own.
  const list = /BACKUP_NEVER = \[([^\]]*)\]/.exec(html);
  assert.ok(list, "BACKUP_NEVER is no longer a literal array this test can read");
  for (const [key, what] of [
    ["interun_mapbox_v1", "the billable Mapbox token"],
    // The device key that authorises uploads to the runner's Strava account. Whoever held a backup
    // containing it could push runs into that account.
    ["interun_strava_v1", "the Strava device key"],
  ] as const) {
    assert.match(list![1]!, new RegExp('"' + key + '"'), what + " rides out in every export");
  }
  assert.match(lift("backupKeys"), /BACKUP_NEVER\.indexOf\(k\) >= 0. continue/,
    "backupKeys does not consult the exclusion list");
});

test("the in-app token field refuses a secret token and says why", () => {
  // sk. tokens can read and write the whole account. Silently ignoring one would leave the runner
  // believing it had worked, which is worse than refusing it.
  const w = lift("wireMapToken");
  assert.match(w, /indexOf\("sk\."\) === 0/, "a secret token is accepted");
  assert.match(w, /secret token/, "a refused secret token is not explained");
  assert.match(w, /indexOf\("pk\."\) !== 0/, "anything at all can be pasted in");
});
