import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

/**
 * THE BRAND MARKS ON CONNECTED APPS, AND THE RULES THEY COME WITH (2026-11-20, the owner's choice).
 *
 * He asked for the real logos ("the strava logo would be used, the garmin logo, apple, google etc"). Each brand's own
 * rules were read first (notes/strava-and-alfie.md, "Brand logos on Connected apps"): Apple's logo, Google, Microsoft,
 * Garmin (until it licenses an integration) and COROS do not allow theirs in another company's app, and using them
 * risks App Review 5.2.1. Two are allowed, each on conditions this file holds:
 *  - Strava: only its official "Compatible with Strava" artwork, never changed (API Agreement §4.1, Brand
 *    Guidelines). It is checked here against the SHA-256 of Strava's own files, so an edit to a single path fails.
 *  - Apple Health: Apple's icon, inside the screens of an iOS app only (Developer Artwork License Agreement for
 *    HealthKit, accepted on his behalf on his yes). So it never enters the public web page or the repo: the iPhone
 *    app's build copies a gitignored file into its bundle and Swift tells the page it is there.
 */
const ROOT = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), "utf8");
const PAGE = read("web/app.html");
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).find((b) => b.includes("\nfunction connectView(")) ?? "";
const CSS = [...PAGE.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
assert.ok(APP, "the app script is not in the build — run node web/app.ts");

function fnOf(name: string): string {
  const at = APP.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return APP.slice(at + 1, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}
function lift<T>(names: string[], ret: string, scope: Record<string, unknown>): T {
  const keys = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...keys, names.map(fnOf).join("\n") + "\nreturn " + ret + ";")(...keys.map((k) => scope[k])) as T;
}

/**
 * Strava's own files, from developers.strava.com/downloads/1.2-Strava-API-Logos.zip (last modified 17 Nov 2026):
 * "Compatible with Strava/cptblWith_strava_{orange,white}/api_logo_cptblWith_strava_horiz_{orange,white}.svg", with only
 * the newlines between their elements removed (a runtime string is one line). Nothing else may differ.
 */
const OFFICIAL_SHA256 = {
  orange: "93b38ca285528b1f5026298480a73df7b4de5ac955318a8d2bda8779cd7c6124",
  white: "77d9558f09b2f1a652d457ee80f5079735ff1e2f74c01511a51d21fd080a96c9",
};
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const svg = (colour: "orange" | "white") => lift<(c: string) => string>(["stravaCompatSvg"], "stravaCompatSvg", {})(colour);

test("BLOCKER: the Strava marks are Strava's own artwork, unchanged", () => {
  for (const c of ["orange", "white"] as const) {
    assert.equal(sha(svg(c)), OFFICIAL_SHA256[c],
      "the " + c + " Compatible with Strava artwork differs from Strava's file — the Brand Guidelines forbid any change");
  }
  // The orange one is Strava's orange, for light screens; the white one is for dark screens.
  assert.match(svg("orange"), /fill="#FC5200"/);
  assert.ok(!/#FC5200/.test(svg("white")), "the white artwork carries orange");
});

function connect(o: { native: boolean; healthIcon?: unknown; connected?: boolean }) {
  const cfg = o.connected ? { key: "k", connected: true, name: "Sam" } : {};
  return lift<() => string>(["connectView", "stravaMarkHtml", "stravaCompatSvg", "nativeHealthIcon"], "connectView", {
    inNativeApp: () => o.native, NATIVE_WATCH: false, WATCH_STATUS: null,
    window: o.healthIcon === undefined ? {} : { __interunAppleHealthIcon: o.healthIcon },
    stravaCfg: () => cfg, stravaBase: () => "https://example.test", stravaAgeOk: () => true,
    stravaConnected: () => !!o.connected, stravaHeartRateOk: () => true, stravaDevMode: () => false,
    esc: (x: unknown) => String(x ?? ""),
    ICON: { devices: "<svg data-g=\"devices\"></svg>", heart: "<svg data-g=\"heart\"></svg>", share: "<svg data-g=\"share\"></svg>", plan: "<svg data-g=\"plan\"></svg>" },
  })();
}
const rowOf = (html: string, name: string) => {
  const rows = html.split(/(?=<(?:button|div)[^>]*class="cn-row")/).filter((r) => r.includes('class="cn-row"'));
  const r = rows.find((x) => x.includes(name));
  assert.ok(r, "no row for " + name);
  return r!;
};

test("the Strava row wears the official mark, in Strava orange on light and white on dark", () => {
  const row = rowOf(connect({ native: false, connected: true }), "Compatible with Strava");
  assert.ok(row.includes(svg("orange")) && row.includes(svg("white")), "the Strava row does not carry both versions of the mark");
  assert.match(row, /class="stv-mark brand-light"[^>]*role="img"[^>]*aria-label="Compatible with Strava"/);
  assert.match(row, /class="stv-mark brand-dark"[^>]*role="img"[^>]*aria-label="Compatible with Strava"/);
  // ⚠️ NEVER A CHEVRON CUT OUT OF THE LOGO: the small square keeps this app's own glyph.
  assert.match(row, /<div class="cn-ic"><svg data-g="share"><\/svg><\/div>/, "the Strava row's square no longer holds the app's own glyph");
  // One of the two shows in each theme: light by default, dark under the system setting and under data-theme dark.
  const rule = (sel: string) => new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*display:\\s*(none|inline-flex)");
  assert.equal(rule(".brand-dark").exec(CSS)?.[1], "none", "the white mark shows on light screens");
  const media = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root \.brand-light\s*\{\s*display:\s*none;?\s*\}\s*:root \.brand-dark\s*\{\s*display:\s*inline-flex;?\s*\}\s*\}/;
  assert.match(CSS, media, "the system dark setting does not swap the marks");
  // ⚠️ THE SWAP MUST OUTRANK THE DEFAULTS. Written as a plain .brand-light rule it only tied with them, and a tie is
  // settled by order (a default placed after it showed orange on a dark phone); written from :root it wins outright,
  // and it adds no second plain rule for the duplicate-class ratchet (test/community.test.ts) to count.
  for (const c of [".brand-light", ".brand-dark"]) {
    const plain = [...CSS.matchAll(new RegExp("(^|\\})\\s*\\" + c + "\\s*\\{", "g"))].length;
    assert.equal(plain, 1, c + " has " + plain + " plain rules — the theme swap must be written from :root");
  }
  for (const [theme, light, dark] of [["light", "inline-flex", "none"], ["dark", "none", "inline-flex"]] as const) {
    assert.equal(rule(':root[data-theme="' + theme + '"] .brand-light').exec(CSS)?.[1], light, theme + " theme shows the wrong Strava mark");
    assert.equal(rule(':root[data-theme="' + theme + '"] .brand-dark').exec(CSS)?.[1], dark, theme + " theme shows the wrong Strava mark");
  }
});

test("Apple's Health icon shows only when the iPhone app says it has it, as Apple supplies it, with no tile behind", () => {
  const img = /<img class="cn-logo" src="apple-health\.png" alt="" width="34" height="34">/;
  const health = (o: Parameters<typeof connect>[0]) => rowOf(connect(o), "Apple Health");
  assert.match(health({ native: true, healthIcon: "apple-health.png" }), img, "the iPhone app's Health icon is not shown");
  // Anywhere else — the web, an older iPhone build without the file, or a flag that is not the exact file — the heart.
  for (const o of [{ native: false, healthIcon: "apple-health.png" }, { native: true }, { native: true, healthIcon: "x.png" },
    { native: true, healthIcon: "javascript:alert(1)" }, { native: true, healthIcon: 1 }]) {
    const row = health(o);
    assert.ok(!/<img/.test(row), "the Health icon is shown without the iPhone app's say-so: " + JSON.stringify(o));
    assert.match(row, /<div class="cn-ic"><svg data-g="heart"><\/svg><\/div>/);
  }
  // HIG: the icon keeps its own shape — no tile, border, shadow or new corner — and is no smaller than the other icons.
  const logo = /\.cn-logo\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(logo, "no .cn-logo rule");
  assert.ok(!/background|border|box-shadow|border-radius|filter|clip-path|mask/.test(logo![1]!), "the Health icon is given a tile, border, shadow or new shape: " + logo![1]);
  const tile = /\.cn-ic\s*\{[^}]*flex:\s*0 0 (\d+)px;\s*height:\s*(\d+)px/.exec(CSS);
  assert.ok(tile, "no .cn-ic size");
  assert.match(logo![1]!, new RegExp("width:\\s*" + tile![1] + "px") , "the Health icon is not the other icons' size");
});

test("BLOCKER: Apple's icon never reaches the web page or the repo", () => {
  // The licence: only the user interface of iOS apps; never website content, never redistributed.
  assert.ok(!existsSync(new URL("docs/apple-health.png", ROOT)), "Apple's icon is in docs/, which GitHub Pages publishes");
  assert.ok(!PAGE.includes("Icon - Apple Health"), "the public page names Apple's artwork file");
  // On a Mac that holds the gitignored icon, prove its bytes are nowhere public: not in the page as base64, and not
  // under docs/ as an image file of any name. (Elsewhere the file is absent, and so is the risk.)
  const icon = new URL("ios/apple-health-icon.png", ROOT);
  if (existsSync(icon)) {
    const bytes = readFileSync(icon);
    const b64 = bytes.toString("base64");
    for (const at of [100, b64.length >> 1, b64.length - 200])
      assert.ok(!PAGE.includes(b64.slice(at, at + 64)), "the public page carries Apple's icon as base64");
    const iconSha = sha(bytes.toString("latin1"));
    const walk = (dir: URL): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(new URL(e.name + "/", dir)) : /\.(png|jpe?g|webp|gif)$/i.test(e.name) ? [new URL(e.name, dir).pathname] : []);
    for (const p of walk(new URL("docs/", ROOT)))
      assert.notEqual(sha(readFileSync(p).toString("latin1")), iconSha, "Apple's icon is published under docs/ as " + p);
  }
  assert.match(read(".gitignore"), /^ios\/apple-health-icon\.png$/m, "ios/apple-health-icon.png is not gitignored");
  const tracked = execFileSync("git", ["ls-files"], { cwd: new URL(".", ROOT), encoding: "utf8" });
  assert.ok(!/apple-health/i.test(tracked), "Apple's icon is committed: " + tracked.split("\n").filter((l) => /apple-health/i.test(l)).join(", "));
});

test("the iPhone app bundles the icon only from the gitignored file, and tells the page only when it is there", () => {
  const phase = read("ios/make-project.py");
  assert.match(phase, /HICON="\$\{SRCROOT\}\/apple-health-icon\.png"/, "the build no longer looks for ios/apple-health-icon.png");
  assert.match(phase, /rm -f "\$\{DST\}\/apple-health\.png"/, "a stale copy would survive the file being removed");
  // -X: no extended attributes — a FinderInfo attribute from the disk image fails code signing (measured).
  assert.match(phase, /cp -X "\$\{HICON\}" "\$\{DST\}\/apple-health\.png"/, "the icon is copied with its Finder attributes, which code signing refuses");
  const host = read("ios/InteRun/WebHost.swift");
  assert.match(host, /appendingPathComponent\("web\/apple-health\.png"\)/, "Swift no longer checks the bundle for the file");
  assert.match(host, /window\.__interunAppleHealthIcon = \\"apple-health\.png\\";/, "Swift no longer sets the flag the page reads");
  assert.match(host, /\+ healthIconJS/, "the flag is built but never injected");
});
