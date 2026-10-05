/**
 * D4 of PLAN.md: the submit checklist.
 *
 * The page at docs/submit/ tells the owner what is already done and hands him every box he pastes into App
 * Store Connect. Both halves can go stale in silence: a "done" line that stops being true in the project files,
 * and a copy box that drifts from APPSTORE.md. Every test here checks one of the page's claims against the
 * thing it claims, and the permission and background checks are DERIVED from the Swift and web code, so a new
 * permission the app starts asking for cannot reach Apple without its message.
 *
 * Apple's limits were read on Apple's own pages on 5 October 2026 (APPSTORE.md section 9 lists them).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import zlib from "node:zlib";

const at = (p: string) => new URL("../" + p, import.meta.url);
const read = (p: string) => readFileSync(at(p), "utf8");
const DOC = read("APPSTORE.md");
const PAGE = read("docs/submit/index.html");
const APP_SRC = read("web/app.ts");
const INFO = read("ios/InteRun-Info.plist");
const WINFO = read("ios/InteRunWatch-Info.plist");
const XINFO = read("ios/InteRunWidgets-Info.plist");
const EXPORT = read("ios/ExportOptions.plist");
const MAKE = read("ios/make-project.py");
// The project file stores the build script as one quoted string: \" for a quote, \n for a line break.
const PBX = read("ios/InteRun.xcodeproj/project.pbxproj").replace(/\\(.)/g, (_m, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
const TOOL = read("tools/store-shots.mjs");

// Swift with its comments taken out: a comment that names an API is not a use of it.
function swift(dir: string): string {
  return readdirSync(at(dir)).filter((f) => f.endsWith(".swift"))
    .map((f) => read(dir + "/" + f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, ""))
    .join("\n");
}
const PHONE = swift("ios/InteRun");
const WATCH = swift("ios/InteRunWatch");

const plistString = (xml: string, key: string) =>
  (xml.match(new RegExp("<key>" + key + "</key>\\s*<string>([^<]*)</string>")) || [])[1];
const plistBool = (xml: string, key: string) =>
  (xml.match(new RegExp("<key>" + key + "</key>\\s*<(true|false)/>")) || [])[1];
const plistArray = (xml: string, key: string) => {
  const m = xml.match(new RegExp("<key>" + key + "</key>\\s*<array>([\\s\\S]*?)</array>"));
  return m ? [...m[1]!.matchAll(/<string>([^<]*)<\/string>/g)].map((x) => x[1]!) : [];
};
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

// The paste boxes in APPSTORE.md section 9, and the review notes in section 5, exactly as
// test/app-store.test.ts reads them.
function storeBlock(name: string): string {
  const m = DOC.match(new RegExp("```store-" + name + "\\n([\\s\\S]*?)\\n```"));
  assert.ok(m, "APPSTORE.md has no ```store-" + name + " block");
  return m![1]!;
}
function reviewNotes(): string {
  const start = DOC.indexOf("## 5. Review notes"), end = DOC.indexOf("## 6.");
  return DOC.slice(start, end).split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/, "")).join("\n").trim();
}
// The page's copy boxes, by their data-field.
function pageBox(field: string): string {
  const m = PAGE.match(new RegExp('<pre class="copy-text" data-field="' + field + '">([\\s\\S]*?)</pre>'));
  assert.ok(m, "the checklist page has no copy box for " + field);
  return unescape(m![1]!);
}

test("the encryption answer is inside the app, so App Store Connect never has to ask", () => {
  assert.equal(plistBool(INFO, "ITSAppUsesNonExemptEncryption"), "false");
});

test("every permission the code asks for has its message, and every message is in the app's own name", () => {
  // DERIVED: an API in the code → the message iOS needs before it may ask. Without one, iOS ends the app
  // the first time the API is touched, and App Review rejects a build that would.
  const needs: Array<[string, boolean, string, string]> = [
    // [where, used?, Info.plist, key]
    ["the phone reads Health", /HKHealthStore\(\)/.test(PHONE), "phone", "NSHealthShareUsageDescription"],
    ["the phone saves runs to Health", /requestAuthorization\(toShare:/.test(PHONE), "phone", "NSHealthUpdateUsageDescription"],
    ["the phone records a run's route", /CLLocationManager\(\)/.test(PHONE), "phone", "NSLocationWhenInUseUsageDescription"],
    ["the phone counts steps", /CMPedometer\(\)/.test(PHONE), "phone", "NSMotionUsageDescription"],
    ["the phone reads the photo library", /PHPhotoLibrary\.requestAuthorization\(for: \.readWrite\)/.test(PHONE), "phone", "NSPhotoLibraryUsageDescription"],
    // The share sheet's "Save Image" adds to the library, and needs the add-only message.
    ["the share sheet can save a card", /UIActivityViewController\(/.test(PHONE), "phone", "NSPhotoLibraryAddUsageDescription"],
    // An image file picker in the web page offers "Take Photo", which opens the camera.
    ["a picture picker offers Take Photo", /type="file"[^>]*accept="image\//.test(APP_SRC), "phone", "NSCameraUsageDescription"],
    ["the watch reads heart rate", /HKHealthStore\(\)/.test(WATCH), "watch", "NSHealthShareUsageDescription"],
    ["the watch saves workouts", /requestAuthorization\(toShare:/.test(WATCH), "watch", "NSHealthUpdateUsageDescription"],
    ["the watch uses its GPS", /CLLocationManager\(\)/.test(WATCH), "watch", "NSLocationWhenInUseUsageDescription"],
  ];
  for (const [why, used, where, key] of needs) {
    assert.ok(used, "the check for '" + why + "' no longer finds its API — re-derive it rather than delete it");
    const str = plistString(where === "phone" ? INFO : WINFO, key);
    assert.ok(str && str.trim().length > 20, why + ", but the " + where + " app has no " + key);
  }
  // Every message a runner reads says the app's name as it is spelled: Inte-Run, never the identifier.
  for (const [name, xml] of [["phone", INFO], ["watch", WINFO]] as const) {
    const keys = [...xml.matchAll(/<key>(\w+UsageDescription)<\/key>/g)].map((m) => m[1]!);
    assert.ok(keys.length > 0);
    for (const k of keys) {
      const s = plistString(xml, k)!;
      assert.ok(!/\bInteRun\b/.test(s), "the " + name + " app's " + k + " says InteRun; the name is Inte-Run");
      assert.ok(/Inte-Run/.test(s), "the " + name + " app's " + k + " does not name the app");
    }
  }
  for (const [name, xml] of [["phone", INFO], ["watch", WINFO], ["widget", XINFO]] as const) {
    assert.equal(plistString(xml, "CFBundleDisplayName"), "Inte-Run", "the " + name + "'s visible name is not Inte-Run");
  }
});

test("the background modes are the ones that keep a run going with the screen locked, and nothing more", () => {
  const modes = plistArray(INFO, "UIBackgroundModes").sort();
  const want: string[] = [];
  if (/allowsBackgroundLocationUpdates = true/.test(PHONE)) want.push("location");
  if (/setCategory\(\s*\.playback/.test(PHONE)) want.push("audio");
  assert.deepEqual(modes, want.sort(), "the phone's UIBackgroundModes do not match what the code needs");
  const wmodes = plistArray(WINFO, "WKBackgroundModes");
  assert.deepEqual(wmodes, /HKWorkoutSession\(/.test(WATCH) ? ["workout-processing"] : []);
});

test("both binaries carry a privacy file, and the export settings make an App Store build", () => {
  for (const f of ["ios/InteRun/PrivacyInfo.xcprivacy", "ios/InteRunWatch/PrivacyInfo.xcprivacy"]) {
    assert.ok(existsSync(at(f)), f + " is missing — Apple emails back ITMS-91053 without it");
  }
  assert.equal(plistString(EXPORT, "method"), "app-store-connect");
  assert.equal(plistString(EXPORT, "signingStyle"), "automatic");
  assert.match(plistString(EXPORT, "teamID") || "", /^[A-Z0-9]{10}$/);
  assert.equal(plistBool(EXPORT, "uploadSymbols"), "true");
  assert.equal(plistBool(EXPORT, "manageAppVersionAndBuildNumber"), "false", "Xcode could renumber the build during export");
});

test("an App Store build cannot be made without its map token, and a phone build only warns", () => {
  // CARTO's free tiles all read "API KEY REQUIRED" (measured 2026-10-05). An archive is ACTION=install.
  for (const [name, src] of [["ios/make-project.py", MAKE], ["the Xcode project", PBX]] as const) {
    const guard = src.match(/if \[ "\$\{MAPS_OK\}" != "1" \]; then([\s\S]*?)\nfi/);
    assert.ok(guard, name + " has lost the map-token check" + (name === "the Xcode project" ? " — run python3 ios/make-project.py" : ""));
    assert.match(guard![1]!, /if \[ "\$\{ACTION:-build\}" = "install" \] && \[ "\$\{INTERUN_NO_MAP_TOKEN_OK:-\}" != "1" \]; then\s*\n\s*echo "error: [^"]*" >&2\s*\n\s*exit 1/,
      name + ": an archive without a token no longer stops");
    // MAPS_OK is set in one place only: a token that begins pk.
    const sets = [...src.matchAll(/MAPS_OK=1/g)].length;
    assert.equal(sets, 1, name + " sets MAPS_OK in more than one place");
    assert.match(src, /pk\.\*\) printf '%s' "\$\{VAL\}" > "\$\{DST\}\/mapbox-token\.txt"\s*\n\s*MAPS_OK=1/);
  }
});

test("the checklist page stays out of the app", () => {
  assert.ok(MAKE.includes("--exclude 'submit'"), "ios/make-project.py does not leave docs/submit out of the app bundle");
  assert.ok(PBX.includes("--exclude 'submit'"), "the Xcode project was not regenerated after submit was excluded — run python3 ios/make-project.py");
});

test("the store listing fits Apple's fields and keeps Apple's keyword rules", () => {
  const name = storeBlock("name"), sub = storeBlock("subtitle"), promo = storeBlock("promo");
  const desc = storeBlock("description"), kw = storeBlock("keywords");
  assert.ok(name.length >= 2 && name.length <= 30, "name: " + name.length + " characters (2 to 30)");
  assert.ok(name.startsWith("Inte-Run"), "the store name must start with the app's name");
  assert.ok(sub.length <= 30, "subtitle: " + sub.length + " characters (30 at most)");
  assert.ok(promo.length <= 170, "promotional text: " + promo.length + " characters (170 at most)");
  assert.ok(desc.length <= 4000, "description: " + desc.length + " characters (4000 at most)");
  assert.ok(!/<[a-z]/i.test(desc), "the description must be plain text; HTML is not supported");
  assert.ok(Buffer.byteLength(kw, "utf8") <= 100, "keywords: " + Buffer.byteLength(kw, "utf8") + " bytes (100 at most)");
  const words = kw.split(",");
  for (const w of words) {
    assert.equal(w, w.trim(), "a space around a comma wastes a keyword byte: '" + w + "'");
    assert.ok(w.length > 2, "Apple wants every keyword longer than two characters: '" + w + "'");
  }
  // The name, the subtitle and the company are searched already, so repeating them wastes the field.
  const indexed = new Set((name + " " + sub + " Adam Palmer").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  for (const w of words.flatMap((x) => x.toLowerCase().split(/\s+/))) assert.ok(!indexed.has(w), "keyword '" + w + "' repeats the name, subtitle or company");
  // "Names of other apps or companies aren't allowed" in keywords; none belong in the name or subtitle either.
  const others = /\b(strava|garmin|runna|nike|apple|coros|polar|suunto|fitbit|parkrun|couch to 5k)\b/i;
  for (const [field, text] of [["name", name], ["subtitle", sub], ["keywords", kw]] as const) {
    assert.ok(!others.test(text), "the " + field + " names another company or app: " + (text.match(others) || [])[0]);
  }
  // Nothing about other platforms, prices or a beta (App Review Guidelines 2.3.10 and 2.3.1).
  for (const [field, text] of [["promotional text", promo], ["description", desc]] as const) {
    assert.ok(!/\b(android|google play|beta|testflight|free trial|subscription|£|\$)\b/i.test(text), "the " + field + " mentions something Apple does not allow there");
  }
});

test("the description promises only what the app does", () => {
  const desc = storeBlock("description") + " " + storeBlock("promo");
  // Each phrase it uses, and the code that makes it true. A feature removed takes its phrase with it.
  const claims: Array<[RegExp, boolean, string]> = [
    [/Apple Watch/, existsSync(at("ios/InteRunWatch/WorkoutManager.swift")), "a watch app that records runs"],
    [/Strava/, /id: "strava"/.test(APP_SRC), "the Strava connection"],
    [/Apple Health/, /HKHealthStore\(\)/.test(PHONE), "saving runs to Health"],
    [/Ask Alfie/, /function openAlfie\(/.test(APP_SRC), "Ask Alfie"],
    [/only with your permission/, /function openAlfieOnlineSheet\(/.test(APP_SRC), "the online-answers question"],
    [/12 to 17/, existsSync(at("src/domain/youth.ts")), "the 12-17 programme"],
    [/briefing/i, /function briefingCardHtml\(/.test(APP_SRC), "the briefing (B10)"],
    [/debrief/, /function runVerdict\(/.test(APP_SRC), "the debrief"],
    [/best times/, existsSync(at("src/progress/records.ts")), "best times (B1)"],
    [/move a run/, /function applyCrossWeekMoves\(/.test(APP_SRC) || /applyCrossWeekMoves/.test(APP_SRC), "moving a run (B4)"],
    [/skip one/, /Skip this session/.test(APP_SRC), "skipping a session (B2)"],
    [/add a smaller race/, /secondaryRace/.test(APP_SRC), "a B-race (B7)"],
    [/guided player/, /function openStrengthPlayer\(/.test(APP_SRC), "the strength player (A5)"],
    [/rest timer/, /restEnd/.test(APP_SRC), "the rest timer"],
    [/voice coach/, existsSync(at("ios/InteRun/CoachAudioService.swift")), "the voice coach"],
    [/No account/, !/sign[ -]?up|create an account/i.test(storeBlock("description")), "no accounts"],
    [/Inte-Club/, /Inte-Club has no server: nobody else can see your page/.test(read("docs/privacy/index.html")), "Inte-Club staying on the phone"],
  ];
  for (const [phrase, real, what] of claims) {
    if (phrase.test(desc)) assert.ok(real, "the description promises " + what + ", and the code no longer has it");
  }
  assert.ok(/not medical advice/.test(desc), "the description must say it is not medical advice (APPSTORE.md 6.3)");
});

test("every box on the checklist page is the text in APPSTORE.md, word for word", () => {
  for (const f of ["name", "subtitle", "promo", "description", "keywords"]) {
    assert.equal(pageBox("store-" + f), storeBlock(f), "the page's " + f + " box has drifted from APPSTORE.md section 9");
  }
  assert.equal(pageBox("store-notes"), reviewNotes(), "the page's review notes have drifted from APPSTORE.md section 5");
  assert.ok(Buffer.byteLength(pageBox("store-notes"), "utf8") <= 4000, "the notes field takes 4000 bytes");
  assert.equal(pageBox("store-version"), (MAKE.match(/"MARKETING_VERSION": "([^"]+)"/) || [])[1], "the version box is not the build's MARKETING_VERSION");
  // The two addresses are the ones the app itself links to.
  const site = (APP_SRC.match(/const LEGAL_SITE = "([^"]+)"/) || [])[1]!;
  assert.ok(site, "LEGAL_SITE not found");
  assert.equal(pageBox("url-privacy"), site + "privacy/");
  assert.equal(pageBox("url-support"), site + "support/");
  for (const u of ["privacy/", "support/"]) assert.ok(DOC.includes("`" + site + u + "`"), "APPSTORE.md section 9 does not give " + site + u);
  // The token step copies from the clipboard into the file, so no token is ever written on the page.
  assert.ok(!/pk\.[A-Za-z0-9]{20,}/.test(PAGE), "a Mapbox token is written on a public page");
});

test("the page's step 0 is there exactly while the made-up watch numbers are", () => {
  // Raised in B10: the Ready? sheet prints "From your watch" from a hard-coded constant. The page tells the
  // owner to fix it before the build; once it is fixed, this fails until the step is taken off the page.
  const fake = /const watch = \{ sleepHours: 7\.5/.test(APP_SRC);
  assert.equal(PAGE.includes('data-id="fix-watch"'), fake,
    fake ? "the made-up watch numbers are still in the app, and the page no longer says to fix them"
      : "the made-up watch numbers are gone: take step 0 off docs/submit/ (and its line in APPSTORE.md)");
});

test("the screenshot tool makes the sizes Apple takes, with no alpha channel", async () => {
  // Apple's accepted portrait sizes, read 2026-10-05: 6.9" 1260x2736, 1290x2796, 1320x2868; 6.5" 1284x2778, 1242x2688.
  const accepted: Record<string, string[]> = {
    "iphone-6.9": ["1260x2736", "1290x2796", "1320x2868"],
    "iphone-6.5": ["1284x2778", "1242x2688"],
  };
  const path = "../tools/store-shots.mjs";
  const tool = await import(path);
  for (const s of tool.SIZES as Array<{ dir: string; w: number; h: number; px: number[] }>) {
    assert.deepEqual(s.px, [s.w * 3, s.h * 3], s.dir + ": the pixel size is not the points at 3x");
    assert.ok(accepted[s.dir]!.includes(s.px.join("x")), s.dir + ": " + s.px.join("x") + " is not a size Apple takes");
    assert.ok(DOC.includes(s.px.join(" × ")), "APPSTORE.md section 9 does not give " + s.px.join(" × "));
  }
  // The re-encoder: an RGBA PNG goes in, a plain RGB PNG with the same colours comes out.
  const w = 3, h = 2, rows: number[] = [];
  for (let y = 0; y < h; y++) { rows.push(y === 0 ? 0 : 2); for (let x = 0; x < w; x++) rows.push(10 * x, 20 * y, 30, 255); }
  // Filter 2 (Up) on the second row stores the difference from the row above.
  const raw = Buffer.from(rows);
  for (let x = 0; x < w * 4; x++) raw[1 + w * 4 + 1 + x] = (raw[1 + w * 4 + 1 + x]! - raw[1 + x]!) & 255;
  const crc = (b: Buffer) => { const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(b) >>> 0); return c; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); return Buffer.concat([l, td, crc(td)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  const out = tool.pngToRgb(png);
  assert.equal(out.png.readUInt8(8 + 8 + 9), 2, "the output is not colour type 2 (RGB, no alpha)");
  assert.equal(out.translucent, 0);
  const back = zlib.inflateSync(out.png.subarray(8 + 25 + 8, out.png.length - 12 - 4));
  assert.deepEqual([...back.subarray(1 + 3 * w + 1, 1 + 3 * w + 1 + 9)], [0, 20, 30, 10, 20, 30, 20, 20, 30], "the second row's colours did not survive");
  assert.match(TOOL, /pngToRgb\(Buffer\.from\(s\.data, "base64"\)\)/, "the tool no longer passes its captures through the re-encoder");
});
