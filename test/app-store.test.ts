/**
 * Y6 of the 12-17 programme: the App Store answers.
 *
 * Three documents describe what this app sends off the phone, and until Y6 they disagreed:
 *  - PRIVACY_FLOWS in web/app.ts -- what the runner is told (Support › Your data, the Safety page);
 *  - APPSTORE.md -- what the owner tells Apple in App Store Connect (the "nutrition label");
 *  - the privacy manifests inside the app -- what Apple reads for itself.
 * The iPhone manifest said "Nothing is collected ... no server" long after Ask Alfie's online answers and
 * the Strava connection both went through Inte-Run's own server, and the watch app had no manifest at all
 * although it uses UserDefaults. Every test here is DERIVED from one of the three and checked against the
 * others, so the next flow added to the app cannot reach one document and miss the rest.
 *
 * Apple's own lists (the data-type identifiers, the purposes, the API categories and their reason codes)
 * were downloaded from developer.apple.com's documentation data on 27 September 2026. A mistyped
 * identifier is not an error anywhere -- Apple simply ignores it -- so this file is the only place one
 * can be caught.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { YOUTH_MIN_AGE } from "../src/domain/youth.ts";

const at = (p: string) => new URL("../" + p, import.meta.url);
const read = (p: string) => readFileSync(at(p), "utf8");
const DOC = read("APPSTORE.md");
const PAGE = read("web/app.html");
const APP_SRC = read("web/app.ts");
const INFO = read("ios/InteRun-Info.plist");
const WORKER = read("alfie-proxy/src/worker.ts");
const STRAVA = read("alfie-proxy/src/strava.ts");
const PBX = read("ios/InteRun.xcodeproj/project.pbxproj");

// ---- helpers -----------------------------------------------------------------------------------------

/** A top-level function's source out of the built page, brace-matched. */
function fnOf(name: string): string {
  const start = PAGE.indexOf("\nfunction " + name + "(");
  assert.ok(start > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = PAGE.indexOf("{", start); i < PAGE.length; i++) {
    if (PAGE[i] === "{") d++;
    else if (PAGE[i] === "}") { d--; if (!d) return PAGE.slice(start + 1, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}
/** A top-level const statement out of the built page, to its own semicolon, quotes respected. */
function stmt(name: string): string {
  const start = PAGE.indexOf("\nconst " + name + " =");
  assert.ok(start > 0, "no const " + name + " in the built page");
  let depth = 0, q = "";
  for (let i = start + 1; i < PAGE.length; i++) {
    const c = PAGE[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = ""; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "[" || c === "{" || c === "(") depth++;
    else if (c === "]" || c === "}" || c === ")") depth--;
    else if (c === ";" && depth === 0) return PAGE.slice(start + 1, i + 1);
  }
  return assert.fail("const " + name + " has no end");
}
type Flow = { id: string; hosts: string[]; short: string; t: string; d: string; native?: boolean; sw?: string };
const FLOWS: Flow[] = new Function(stmt("PRIVACY_FLOWS") + "\nreturn PRIVACY_FLOWS;")();
const flowById = (id: string) => FLOWS.find((f) => f.id === id);

/** Just enough of an XML property list: dict, array, key, string, integer, true, false. Comments dropped. */
function parsePlist(xml: string): any {
  const src = xml.replace(/<!--[\s\S]*?-->/g, "");
  const re = /<(key|string|integer)>([^<]*)<\/\1>|<(true|false|array|dict)\/>|<(array|dict)>|<\/(array|dict)>/g;
  const root: any[] = [];
  const stack: any[] = [root];
  const keys: Array<string | null> = [null];
  const put = (v: any) => {
    const top = stack[stack.length - 1];
    if (Array.isArray(top)) top.push(v);
    else { top[keys[keys.length - 1] as string] = v; keys[keys.length - 1] = null; }
  };
  for (const m of src.matchAll(re)) {
    if (m[1] === "key") keys[keys.length - 1] = m[2] ?? "";
    else if (m[1] === "string") put(m[2] ?? "");
    else if (m[1] === "integer") put(Number(m[2]));
    else if (m[3] === "true") put(true);
    else if (m[3] === "false") put(false);
    else if (m[3]) put(m[3] === "array" ? [] : {});
    else if (m[4]) { const v: any = m[4] === "array" ? [] : {}; put(v); stack.push(v); keys.push(null); }
    else if (m[5]) { stack.pop(); keys.pop(); }
  }
  return root[0];
}
type Manifest = {
  NSPrivacyCollectedDataTypes: Array<{ NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean;
    NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] }>;
  NSPrivacyTracking: boolean;
  NSPrivacyTrackingDomains: string[];
  NSPrivacyAccessedAPITypes: Array<{ NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }>;
};
const manifest = (p: string): Manifest => parsePlist(read(p)) as Manifest;

// Apple's own identifiers, downloaded 27 September 2026 (see the header).
const APPLE_TYPES = ["Name", "EmailAddress", "PhoneNumber", "PhysicalAddress", "OtherUserContactInfo", "Health", "Fitness",
  "PaymentInfo", "CreditInfo", "OtherFinancialInfo", "PreciseLocation", "CoarseLocation", "SensitiveInfo", "Contacts",
  "EmailsOrTextMessages", "PhotosorVideos", "AudioData", "GameplayContent", "CustomerSupport", "OtherUserContent",
  "BrowsingHistory", "SearchHistory", "UserID", "DeviceID", "PurchaseHistory", "ProductInteraction", "AdvertisingData",
  "OtherUsageData", "CrashData", "PerformanceData", "OtherDiagnosticData", "EnvironmentScanning", "Hands", "Head",
  "OtherDataTypes"].map((t) => "NSPrivacyCollectedDataType" + t);
const APPLE_PURPOSES = ["ThirdPartyAdvertising", "DeveloperAdvertising", "Analytics", "ProductPersonalization",
  "AppFunctionality", "Other"].map((p) => "NSPrivacyCollectedDataTypePurpose" + p);
const APPLE_REASONS: Record<string, string[]> = {
  NSPrivacyAccessedAPICategoryFileTimestamp: ["DDA9.1", "C617.1", "3B52.1", "0A2A.1"],
  NSPrivacyAccessedAPICategorySystemBootTime: ["35F9.1", "8FFB.1", "3D61.1"],
  NSPrivacyAccessedAPICategoryDiskSpace: ["85F4.1", "E174.1", "7D9E.1", "B728.1"],
  NSPrivacyAccessedAPICategoryActiveKeyboards: ["3EC4.1", "54BD.1"],
  NSPrivacyAccessedAPICategoryUserDefaults: ["CA92.1", "1C8F.1", "C56D.1", "AC6B.1"],
};
/** The words APPSTORE.md uses for each identifier App Store Connect shows. */
const LABEL: Record<string, string> = {
  NSPrivacyCollectedDataTypePreciseLocation: "Precise Location", NSPrivacyCollectedDataTypeCoarseLocation: "Coarse Location",
  NSPrivacyCollectedDataTypeHealth: "Health", NSPrivacyCollectedDataTypeFitness: "Fitness",
  NSPrivacyCollectedDataTypeName: "Name", NSPrivacyCollectedDataTypeUserID: "User ID",
  NSPrivacyCollectedDataTypeDeviceID: "Device ID", NSPrivacyCollectedDataTypeOtherUserContent: "Other User Content",
  NSPrivacyCollectedDataTypePhotosorVideos: "Photos or Videos", NSPrivacyCollectedDataTypeEmailAddress: "Email Address",
  NSPrivacyCollectedDataTypeCrashData: "Crash Data", NSPrivacyCollectedDataTypeSearchHistory: "Search History",
};

/** The rows of APPSTORE.md's label table (section 2.2): data type, linked, and the flows each came from. */
function docLabel() {
  const start = DOC.indexOf("### 2.2 The answers");
  assert.ok(start > 0, "APPSTORE.md has no section 2.2");
  const end = DOC.indexOf("\n### ", start + 10);
  const rows = DOC.slice(start, end).split("\n").filter((l) => l.startsWith("| **"));
  return rows.map((l) => {
    const cells = l.split("|").map((c) => c.trim());
    const type = (cells[1]!.match(/\*\*(.+?)\*\*/) || [])[1] || "";
    const linked = /^\*\*Yes\*\*$/.test(cells[2]!) ? true : cells[2] === "No" ? false : null;
    const flows = [...(cells[4] || "").matchAll(/`([a-z]+)`/g)].map((m) => m[1]!);
    return { type, linked, flows };
  });
}

// ---- the label, the manifest and the flows agree ---------------------------------------------------

test("BLOCKER: the iPhone's privacy manifest declares exactly what APPSTORE.md tells Apple", () => {
  const rows = docLabel();
  assert.ok(rows.length >= 6, "the label table was not found, so this comparison would pass on nothing: " + rows.length);
  const m = manifest("ios/InteRun/PrivacyInfo.xcprivacy");
  const declared = m.NSPrivacyCollectedDataTypes.map((e) => ({ type: LABEL[e.NSPrivacyCollectedDataType] || e.NSPrivacyCollectedDataType, linked: e.NSPrivacyCollectedDataTypeLinked }));
  const norm = (xs: Array<{ type: string; linked: boolean | null }>) => xs.map((x) => x.type + (x.linked ? " (linked)" : " (not linked)")).sort();
  assert.deepEqual(norm(declared), norm(rows),
    "the manifest and APPSTORE.md's label disagree -- change both, or Apple and the App Store page tell two stories");
  for (const e of m.NSPrivacyCollectedDataTypes) {
    assert.equal(e.NSPrivacyCollectedDataTypeTracking, false, e.NSPrivacyCollectedDataType + " is marked as used for tracking");
    assert.deepEqual(e.NSPrivacyCollectedDataTypePurposes, ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
      e.NSPrivacyCollectedDataType + " claims a purpose other than App Functionality, which APPSTORE.md does not");
  }
  assert.equal(m.NSPrivacyTracking, false);
  assert.deepEqual(m.NSPrivacyTrackingDomains, []);
  assert.match(DOC, /Data used to track you: none/i, "APPSTORE.md must say nothing is used for tracking");
});

test("BLOCKER: every flow that sends something about the runner is on the label, and nothing on the label is invented", () => {
  const rows = docLabel();
  const onLabel = new Set(rows.flatMap((r) => r.flows));
  // A flow that carries nothing about the runner says so in its own description, and is then named in
  // the "not declared" list instead. Derived from the flow's words, not from a list kept here.
  const quiet = FLOWS.filter((f) => /Nothing about you is sent/.test(f.d));
  assert.ok(quiet.length >= 1 && quiet.every((f) => f.id === "update"), "the flows that send nothing about the runner changed: " + quiet.map((f) => f.id));
  for (const f of FLOWS) {
    if (quiet.includes(f)) {
      assert.ok(DOC.includes("`" + f.id + "`"), "APPSTORE.md does not say why the " + f.id + " flow is left off the label");
      continue;
    }
    assert.ok(onLabel.has(f.id), "the " + f.id + " flow (" + f.t + ") sends data off the phone and is on no row of APPSTORE.md's label");
  }
  for (const id of onLabel) assert.ok(flowById(id), "APPSTORE.md's label names a flow that PRIVACY_FLOWS does not have: " + id);
});

test("BLOCKER: every identifier and reason code in the manifests is one Apple actually defines", () => {
  for (const p of ["ios/InteRun/PrivacyInfo.xcprivacy", "ios/InteRunWatch/PrivacyInfo.xcprivacy"]) {
    const m = manifest(p);
    for (const e of m.NSPrivacyCollectedDataTypes) {
      assert.ok(APPLE_TYPES.includes(e.NSPrivacyCollectedDataType), p + ": " + e.NSPrivacyCollectedDataType + " is not an Apple data type -- Apple would silently ignore it");
      for (const pu of e.NSPrivacyCollectedDataTypePurposes) assert.ok(APPLE_PURPOSES.includes(pu), p + ": unknown purpose " + pu);
    }
    for (const a of m.NSPrivacyAccessedAPITypes) {
      const allowed = APPLE_REASONS[a.NSPrivacyAccessedAPIType];
      assert.ok(allowed, p + ": " + a.NSPrivacyAccessedAPIType + " is not an Apple API category");
      assert.ok(a.NSPrivacyAccessedAPITypeReasons.length >= 1, p + ": " + a.NSPrivacyAccessedAPIType + " is declared with no reason");
      for (const r of a.NSPrivacyAccessedAPITypeReasons) {
        assert.ok(allowed.includes(r), p + ": " + r + " is not a reason Apple allows for " + a.NSPrivacyAccessedAPIType);
      }
    }
  }
});

// ---- every binary that needs a manifest has one ------------------------------------------------------

/** Which folders each shipped target compiles, straight out of the Xcode project. */
function shippedTargets(): Array<{ name: string; groups: string[] }> {
  const out: Array<{ name: string; groups: string[] }> = [];
  for (const m of PBX.matchAll(/fileSystemSynchronizedGroups = \(\s*((?:[0-9A-F]+ \/\* \w+ \*\/,\s*)+)\);\s*name = (\w+);/g)) {
    const groups = [...m[1]!.matchAll(/\/\* (\w+) \*\//g)].map((g) => g[1]!);
    if (!/Tests$/.test(m[2]!)) out.push({ name: m[2]!, groups });
  }
  return out;
}
/** Swift source for a set of folders, with comments removed so a sentence mentioning an API does not count as using it. */
function swiftOf(groups: string[]): string {
  return groups.flatMap((g) => readdirSync(at("ios/" + g)).filter((f) => f.endsWith(".swift"))
    .map((f) => read("ios/" + g + "/" + f))).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"])\/\/.*$/gm, "$1");
}
/**
 * How each "required reason" category shows up in Swift. Apple's own lists name these APIs.
 * ⚠️ The C stat() family is left out on purpose: this codebase has SwiftUI helpers called stat(), and a
 * pattern loose enough to catch the C call reports every one of them.
 */
const API_USE: Record<string, RegExp> = {
  NSPrivacyAccessedAPICategoryUserDefaults: /\bUserDefaults\b|\bNSUserDefaults\b/,
  NSPrivacyAccessedAPICategoryFileTimestamp: /\battributesOfItem\s*\(|\.(creationDate|modificationDate|contentModificationDate|fileModificationDate)\b|\b(creationDate|contentModificationDate|attributeModificationDate)Key\b|\bgetattrlist\s*\(|\bfstat\s*\(|\blstat\s*\(/,
  NSPrivacyAccessedAPICategorySystemBootTime: /\bsystemUptime\b|\bmach_absolute_time\s*\(/,
  NSPrivacyAccessedAPICategoryDiskSpace: /volumeAvailableCapacity|volumeTotalCapacity|\bsystemFreeSize\b|\bstatfs\s*\(|\bstatvfs\s*\(/,
  NSPrivacyAccessedAPICategoryActiveKeyboards: /\bactiveInputModes\b/,
};

test("BLOCKER: every binary that uses a required-reason API ships a manifest declaring exactly those", () => {
  const targets = shippedTargets();
  assert.deepEqual(targets.map((t) => t.name).sort(), ["InteRun", "InteRunWatch", "InteRunWidgets"],
    "the shipped targets changed -- a new binary needs its own answer here");
  for (const t of targets) {
    const src = swiftOf(t.groups);
    const used = Object.keys(API_USE).filter((k) => API_USE[k]!.test(src)).sort();
    const file = "ios/" + t.name + "/PrivacyInfo.xcprivacy";
    if (!used.length) {
      // Nothing to declare: a file is not required, and the answer stays that way only while that is true.
      continue;
    }
    assert.ok(existsSync(at(file)), t.name + " uses " + used.join(", ") + " and has no " + file + " -- Apple emails the upload back as ITMS-91053");
    const declared = manifest(file).NSPrivacyAccessedAPITypes.map((a) => a.NSPrivacyAccessedAPIType).sort();
    assert.deepEqual(declared, used, t.name + " declares " + declared.join(", ") + " but its code uses " + used.join(", "));
  }
  // The measurement behind the answers above, so a sweep that stopped finding anything cannot pass.
  const byName = Object.fromEntries(targets.map((t) => [t.name, swiftOf(t.groups)]));
  assert.ok(API_USE.NSPrivacyAccessedAPICategoryUserDefaults!.test(byName.InteRunWatch!), "the watch app no longer uses UserDefaults -- re-check its manifest");
  assert.ok(API_USE.NSPrivacyAccessedAPICategoryFileTimestamp!.test(byName.InteRun!), "the phone app no longer reads a file's metadata -- re-check C617.1");
});

test("the reasons declared are the ones this code's use actually fits", () => {
  // CA92.1 covers "information that is only accessible to the app itself". A shared suite (an App Group)
  // needs a different reason, so adding one must change the manifest too.
  for (const t of shippedTargets()) {
    assert.ok(!/UserDefaults\s*\(\s*suiteName/.test(swiftOf(t.groups)), t.name + " uses a shared UserDefaults suite -- CA92.1 no longer fits; it needs 1C8F.1");
  }
  const phone = manifest("ios/InteRun/PrivacyInfo.xcprivacy").NSPrivacyAccessedAPITypes;
  const reasons = Object.fromEntries(phone.map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons]));
  assert.deepEqual(reasons.NSPrivacyAccessedAPICategoryUserDefaults, ["CA92.1"]);
  // C617.1 is "files inside the app container": the one caller reads the size of a file the app itself serves.
  assert.deepEqual(reasons.NSPrivacyAccessedAPICategoryFileTimestamp, ["C617.1"]);
  assert.match(read("ios/InteRun/BundleSchemeHandler.swift"), /attributesOfItem\(atPath: file\.path\)/, "the file-metadata read moved -- re-check C617.1 still describes it");
  const watch = manifest("ios/InteRunWatch/PrivacyInfo.xcprivacy");
  assert.deepEqual(watch.NSPrivacyCollectedDataTypes, [], "the watch sends nothing to a server; its manifest must not claim otherwise");
});

// ---- the words the runner reads say where their data goes -------------------------------------------

test("BLOCKER: every sentence about Ask Alfie's online answers names the AI company the server really uses", () => {
  const brain = (WORKER.match(/const BRAIN: [^=]+= "(\w+)"/) || [])[1];
  const COMPANY: Record<string, string> = { cloudflare: "Cloudflare", claude: "Anthropic" };
  assert.ok(brain && COMPANY[brain], "BRAIN in alfie-proxy/src/worker.ts was not read: " + brain);
  const name = COMPANY[brain]!;
  const other = Object.values(COMPANY).filter((c) => c !== name);
  const surfaces: Record<string, string> = {
    "the permission sheet's explanation": stmt("ALFIE_ONLINE_EXPLAIN"),
    "Your data's Ask Alfie row": flowById("alfie")!.d,
    "Alfie's limits panel": fnOf("alfieLimits"),
    "the switch's own sentence": fnOf("alfieOnlineRow"),
    "the Safety page": fnOf("safetyView"),
    "APPSTORE.md": DOC,
  };
  for (const [where, text] of Object.entries(surfaces)) {
    assert.ok(text.includes(name), where + " does not name " + name + " -- guideline 5.1.2(i) asks us to say WHERE the data goes");
    for (const o of other) assert.ok(!text.includes(o), where + " names " + o + ", which is not the AI this server uses");
  }
});

test("the location permission message names every place a rough location goes", () => {
  const str = (INFO.match(/<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]*)<\/string>/) || [])[1] || "";
  // Each flow that carries a location, and the word that must name it in the message iOS shows.
  const WORD: Record<string, RegExp> = { weather: /weather/i, maps: /\bmap/i, place: /\btown\b/i };
  for (const id of Object.keys(WORD)) {
    assert.ok(flowById(id), "PRIVACY_FLOWS no longer has a " + id + " flow -- update this list");
    assert.match(str, WORD[id]!, "the location permission message does not mention the " + id + " flow: " + str);
  }
  // A new flow that mentions a location must join the list above (and the message).
  for (const f of FLOWS) {
    if (/location|where you are/i.test(f.d)) assert.ok(WORD[f.id], "the " + f.id + " flow sends a location and the permission message was not checked for it");
  }
});

test("BLOCKER: the weather credit is Open-Meteo's own wording, and every forecast on screen carries it", () => {
  const credit = fnOf("wxCreditHtml");
  assert.ok(credit.includes('href="https://open-meteo.com/"') && credit.includes("Weather data by Open-Meteo.com"),
    "the credit is not the wording and link Open-Meteo's licence gives");
  assert.ok(credit.includes('target="_blank"') && credit.includes('rel="noopener noreferrer"'), "the credit opens outside the app");
  // Every function that prints a temperature must carry the credit, or be one of three with a reason.
  const EXEMPT: Record<string, string> = {
    conditionsSquare: "a button -- the credit sits under the tiles in viewToday instead",
    heatChipHtml: "a button -- viewToday's credit line also covers it",
    unitsView: "example temperatures, not Open-Meteo's data",
    // B10: a fact pack, not markup — briefingCardHtml shows the credit under any briefing that quotes the forecast.
    briefingFacts: "facts, not markup -- briefingCardHtml prints the credit whenever the briefing quotes a forecast",
  };
  const printers = [...PAGE.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!).filter((n) => n !== "fmtTemp" && fnOf(n).includes("fmtTemp("));
  assert.ok(printers.length >= 5, "the temperature sweep found almost nothing, so it proves nothing: " + printers.join(", "));
  for (const n of printers) {
    if (EXEMPT[n]) continue;
    assert.ok(fnOf(n).includes("wxCreditHtml()"), n + " shows a temperature without the Open-Meteo credit");
  }
  const today = fnOf("viewToday");
  assert.match(today, /\(activeWeather\(\)\.live \|\| heatChoice\(conditionsSession\(\)\) \? '<p class="wx-credit-row">' \+ wxCreditHtml\(\)/,
    "Today's credit line no longer follows the live forecast and the heat chip it covers");
  assert.match(fnOf("briefingCardHtml"), /\(facts\.heat \? '<p class="wx-credit-row">' \+ wxCreditHtml\(\) \+ '<\/p>' : ""\)/,
    "the briefing quotes the forecast without the credit");
  const heat = fnOf("heatBlockHtml");
  assert.ok((heat.match(/, true\);/g) || []).length >= 2 && heat.includes(", w.live);"), "the heat advice's forecast states do not all carry the credit");
  assert.ok(DOC.includes("Weather data by Open-Meteo.com"), "APPSTORE.md's content-rights answer does not record the credit");
});

// ---- the answer sheet itself ------------------------------------------------------------------------

test("APPSTORE.md answers every question on Apple's age-rating questionnaire, honestly where it is easy to slip", () => {
  // Apple's questionnaire, read on 27 September 2026.
  const QUESTIONS = ["Parental Controls", "Age Assurance", "Unrestricted Web Access", "User-Generated Content", "Social Media",
    "Social Media Disabled for Users Under 13", "Messaging and Chat", "Advertising", "Profanity or Crude Humor", "Horror/Fear Themes",
    "Alcohol, Tobacco, or Drug Use or References", "Medical or Treatment Information", "Health or Wellness Topics",
    "Mature or Suggestive Themes", "Sexual Content or Nudity", "Graphic Sexual Content and Nudity", "Cartoon or Fantasy Violence",
    "Realistic Violence", "Prolonged Graphic or Sadistic Realistic Violence", "Guns or Other Weapons", "Gambling",
    "Simulated Gambling", "Contests", "Loot Boxes"];
  const answer = (q: string) => {
    const row = DOC.split("\n").find((l) => l.startsWith("| " + q + " |"));
    assert.ok(row, "APPSTORE.md has no answer for: " + q);
    return row!.split("|")[2]!.replace(/\*/g, "").trim();
  };
  for (const q of QUESTIONS) answer(q);
  // ⚠️ The app's own words decide these, so a change of copy has to change the answer. The fuelling and
  // injury guides mention alcohol (advising against it); "None" would be the easy, wrong answer.
  const copy = APP_SRC.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  if (/\balcohol\b/i.test(copy)) assert.notEqual(answer("Alcohol, Tobacco, or Drug Use or References"), "None", "the app mentions alcohol, so the answer cannot be None");
  assert.notEqual(answer("Medical or Treatment Information"), "None", "the injury guide and the warning-sign screens are medical guidance");
  assert.equal(answer("Health or Wellness Topics"), "Frequent", "exercise recommendations are the whole app");
  // The rating reasoning is about the app's REAL youth minimum; if that moves, section 1.3 has to be re-read.
  assert.ok(DOC.includes("starts at **" + YOUTH_MIN_AGE + "**"), "section 1.3 no longer names the youth programme's real minimum age (" + YOUTH_MIN_AGE + ")");
});

test("the review notes fit Apple's field and describe the permission Ask Alfie now asks for", () => {
  const start = DOC.indexOf("## 5. Review notes");
  const end = DOC.indexOf("\n## ", start + 5);
  const notes = DOC.slice(start, end).split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/, "")).join("\n").trim();
  assert.ok(notes.length > 500, "the review notes were not found");
  // Apple's field reference: "The Notes field can contain up to 4000 bytes."
  assert.ok(Buffer.byteLength(notes, "utf8") < 4000, "the review notes are " + Buffer.byteLength(notes, "utf8") + " bytes; Apple's field holds 4000");
  assert.match(notes, /Nothing is sent until the user agrees/, "the notes do not say Ask Alfie asks first");
  assert.match(notes, /No account or sign-in is needed/, "the notes do not tell the reviewer there is nothing to sign into");
});

test("the server no longer keeps the Strava athlete number nothing read", () => {
  const stored = STRAVA.slice(STRAVA.indexOf("type Stored = {"), STRAVA.indexOf("};", STRAVA.indexOf("type Stored = {")));
  assert.ok(stored.length > 20, "the Stored type was not found");
  assert.ok(!/^\s*athleteId\b/m.test(stored), "the Stored record still has an athleteId field");
  assert.ok(!/athleteId:\s*Number\(/.test(STRAVA), "a new connection still stores the athlete id");
  assert.match(STRAVA, /delete \(rec as Stored & \{ athleteId\?: unknown \}\)\.athleteId;/, "an older record keeps the athlete id when it is next rewritten");
  // What IS kept is what APPSTORE.md declares: the first name ("Name") and the tokens ("User ID").
  assert.ok(/athleteName: string/.test(stored) && docLabel().some((r) => r.type === "Name"), "the name kept on the server is not on the label");
});
