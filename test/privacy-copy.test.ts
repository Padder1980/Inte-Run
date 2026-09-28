/**
 * Stage D1: the published privacy policy, terms, simple version and support page, held to the code.
 *
 * The pages are hand-written (docs/privacy/, docs/terms/, docs/simple/, docs/support/), and a
 * hand-written page describing code goes stale the moment the code moves on. This project has watched
 * that happen: the Safety page said "two things do reach the internet, and only these" while six did,
 * and Ask Alfie promised that "anything about pain or feeling unwell" stays on the phone when only
 * serious warning signs do. So every fact the pages state that the code decides -- which flows leave
 * the phone and where to, which AI company answers, the ages, the time limits, the caps, the contact
 * address, the date -- is read out of the code here and compared with the page.
 *
 * ⚠️ DERIVED, NEVER A TYPED COPY. Each expectation comes from the built page, the engine or the Worker
 * source, so changing the code without changing the page fails, and so does the other way round.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import {
  YOUTH_MIN_AGE, YOUTH_MAX_AGE, OWN_CONSENT_MIN_AGE, STRAVA_MIN_AGE, STRAVA_HEART_RATE_MIN_AGE,
} from "../src/domain/youth.ts";
import { NOT_A_DIAGNOSIS } from "../src/safety/common.ts";

const read = (rel: string) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const PAGE = read("web/app.html");
const WORKER = read("alfie-proxy/src/worker.ts");
const STRAVA = read("alfie-proxy/src/strava.ts");
const MAKE_PROJECT = read("ios/make-project.py");
const PBXPROJ = read("ios/InteRun.xcodeproj/project.pbxproj");
const SW = read("docs/sw.js");
const DOC = {
  privacy: read("docs/privacy/index.html"),
  terms: read("docs/terms/index.html"),
  simple: read("docs/simple/index.html"),
  support: read("docs/support/index.html"),
};
type DocName = keyof typeof DOC;
const ALL = Object.keys(DOC) as DocName[];

/** A top-level const statement out of the built page, to its own semicolon (quote-aware). */
function stmt(name: string): string {
  const at = PAGE.indexOf("\nconst " + name + " =");
  assert.ok(at > 0, "no const " + name + " in the built page");
  let depth = 0, q = "";
  for (let i = at + 1; i < PAGE.length; i++) {
    const c = PAGE[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = ""; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "[" || c === "{" || c === "(") depth++;
    else if (c === "]" || c === "}" || c === ")") depth--;
    else if (c === ";" && depth === 0) return PAGE.slice(at + 1, i + 1);
  }
  return assert.fail("const " + name + " has no end");
}
/** A top-level function's source out of the built page, brace-matched. */
function fnOf(name: string): string {
  const at = PAGE.indexOf("\nfunction " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = PAGE.indexOf("{", at); i < PAGE.length; i++) {
    if (PAGE[i] === "{") d++;
    else if (PAGE[i] === "}") { d--; if (!d) return PAGE.slice(at + 1, i + 1); }
  }
  return assert.fail(name + " has no matching close brace");
}
function constValue<T>(name: string): T {
  // eslint-disable-next-line no-new-func
  return new Function(stmt(name) + "\nreturn " + name + ";")() as T;
}
type Flow = { id: string; hosts: string[]; t: string; d: string };
const FLOWS = constValue<Flow[]>("PRIVACY_FLOWS");
const CONTACT = constValue<string>("PRIVACY_CONTACT");

/** The part of a page that belongs to one flow: from its data-flow marker to the next one (or its section's end). */
function flowSection(doc: string, id: string): string {
  const at = doc.indexOf('data-flow="' + id + '"');
  assert.ok(at > 0, "no data-flow=\"" + id + "\" section");
  const next = doc.indexOf("data-flow=", at + 10);
  const end = doc.indexOf("</section>", at);
  return doc.slice(at, next > 0 && next < end ? next : end);
}
/** Every value a page gives for a data-* marker, e.g. <span data-age="strava">13</span>. */
function marked(doc: string, attr: string): Array<{ key: string; text: string }> {
  return [...doc.matchAll(new RegExp("data-" + attr + '="([a-z-]+)"[^>]*>([^<]*)<', "g"))]
    .map((m) => ({ key: m[1]!, text: m[2]!.trim() }));
}
/** Visible text of a page: no comments, no head, no tags, entities that matter decoded. */
function visibleText(doc: string): string {
  return doc.replace(/<!--[\s\S]*?-->/g, " ").replace(/<head>[\s\S]*?<\/head>/, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

test("BLOCKER: the policy and the simple version list exactly the flows in PRIVACY_FLOWS, in the same order", () => {
  const ids = FLOWS.map((f) => f.id);
  assert.ok(ids.length >= 6, "PRIVACY_FLOWS was not read: " + ids.join(","));
  for (const name of ["privacy", "simple"] as const) {
    const listed = [...DOC[name].matchAll(/data-flow="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(listed, ids, "docs/" + name + "/ does not list the flows the app sends -- the user's instruction was that the policy must match PRIVACY_FLOWS exactly");
  }
});

/** Every web address a piece of source reaches after http(s)://. */
function hostsIn(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const h = m[1]!.toLowerCase();
    if (/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)) out.add(h);
  }
  return out;
}

test("BLOCKER: every address a flow reaches is named in its own section of the policy, and the policy names no other", () => {
  // What the Worker itself goes on to reach (Strava's API). Cloudflare's AI is a binding, not an address.
  const workerOut = [...hostsIn(WORKER + "\n" + STRAVA)];
  assert.ok(workerOut.includes("www.strava.com"), "the Worker's outbound addresses were not found: " + workerOut.join(","));
  for (const f of FLOWS) {
    const sec = flowSection(DOC.privacy, f.id);
    for (const h of f.hosts) assert.ok(sec.includes('<span class="host">' + h + "</span>"), "the policy's " + f.id + " section does not name " + h);
  }
  const stravaSec = flowSection(DOC.privacy, "strava");
  for (const h of workerOut) assert.ok(stravaSec.includes('<span class="host">' + h + "</span>"), "the Worker reaches " + h + " and the policy's Strava section does not say so");
  // And the other way: an address the policy names must be one something really reaches.
  const known = new Set([...FLOWS.flatMap((f) => f.hosts), ...workerOut]);
  const named = [...DOC.privacy.matchAll(/<span class="host">([^<]+)<\/span>/g)].map((m) => m[1]!);
  assert.deepEqual(named.filter((h) => !known.has(h)), [], "the policy names an address nothing reaches");
});

test("BLOCKER: the AI company and model the pages name are the ones the server really uses", () => {
  const brain = (WORKER.match(/const BRAIN: [^=]+= "(\w+)"/) || [])[1];
  const COMPANY: Record<string, string> = { cloudflare: "Cloudflare", claude: "Anthropic" };
  assert.ok(brain && COMPANY[brain], "BRAIN in alfie-proxy/src/worker.ts was not read: " + brain);
  const name = COMPANY[brain]!;
  for (const doc of ["privacy", "simple"] as const) {
    const sec = flowSection(DOC[doc], "alfie");
    assert.ok(sec.includes(name), "the " + doc + " page's Ask Alfie section does not name " + name);
    for (const other of Object.values(COMPANY).filter((c) => c !== name)) {
      assert.ok(!sec.includes(other), "the " + doc + " page names " + other + ", which is not the AI this server uses");
    }
  }
  // The model, derived from the constant the Worker sends it by.
  const model = brain === "cloudflare"
    ? ((WORKER.match(/const CF_MODEL = "@cf\/[a-z]+\/llama-([\d.]+)-/) || [])[1])
    : undefined;
  const expected = brain === "cloudflare" ? "Llama " + model : "Claude";
  assert.ok(brain !== "cloudflare" || model, "CF_MODEL is not a Llama model any more -- say which model it is in the policy");
  const said = marked(DOC.privacy, "model").map((m) => m.text);
  assert.ok(said.length > 0 && said.every((t) => t.startsWith(expected)), "the policy names the model " + said.join(",") + ", the server uses " + expected);
});

test("BLOCKER: the ages the pages state are the ages the code enforces", () => {
  const AGES: Record<string, number> = {
    "youth-min": YOUTH_MIN_AGE, "own-consent": OWN_CONSENT_MIN_AGE, strava: STRAVA_MIN_AGE, "strava-hr": STRAVA_HEART_RATE_MIN_AGE,
  };
  for (const name of ALL) {
    for (const m of marked(DOC[name], "age")) {
      assert.ok(m.key in AGES, name + " marks an age the test does not know: " + m.key);
      assert.equal(Number(m.text), AGES[m.key], "docs/" + name + "/ says " + m.text + " for " + m.key + "; the code says " + AGES[m.key]);
    }
  }
  // The pages a young runner reads must carry the two limits that change what they can do.
  for (const name of ["privacy", "simple"] as const) {
    const keys = new Set(marked(DOC[name], "age").map((m) => m.key));
    for (const k of ["own-consent", "strava", "strava-hr"]) assert.ok(keys.has(k), "docs/" + name + "/ never states the " + k + " age");
  }
  assert.ok(marked(DOC.terms, "age").some((m) => m.key === "youth-min"), "the terms no longer say who Inte-Run is designed for");
  // The words the pages use throughout, rather than mark every time: "under 18", "12 to 17", and the simple
  // version's "If you are 12, it stays off until you are 13". Each is true only while these hold.
  assert.equal(YOUTH_MAX_AGE + 1, 18, "the pages say 'under 18' and '12 to 17' throughout -- change them with the youth limits");
  assert.equal(YOUTH_MIN_AGE, OWN_CONSENT_MIN_AGE - 1, "the simple version says 'if you are 12, it stays off until you are 13', true only while 12 is the one age below 13 the app knows");
  const picker = Number((PAGE.match(/for \(let a = (\d+); a <= 90; a\+\+\) o \+= '<option value="/) || [])[1]);
  assert.equal(picker, YOUTH_MIN_AGE, "the age picker starts at " + picker + ", and the pages say Inte-Run is designed for " + YOUTH_MIN_AGE + " and up");
});

test("the time limits and caps the policy states are the ones the code and the server use", () => {
  // Every mention of a cap must say the same number, so the first one cannot be right while a later one is stale.
  const cap = (k: string) => {
    const all = marked(DOC.privacy, "cap").filter((m) => m.key === k).map((m) => Number(m.text));
    assert.ok(all.length > 0 && all.every((n) => n === all[0]), "the policy gives " + k + " as " + all.join(" and "));
    return all[0]!;
  };
  const ttl = (k: string) => (marked(DOC.privacy, "ttl").filter((m) => m.key === k).map((m) => m.text));
  // Full runs kept, and Alfie's chat kept, on the phone.
  const runs = Number((fnOf("saveRuns").match(/state\.logged\.slice\(0, (\d+)\)/) || [])[1]);
  assert.ok(runs > 0 && cap("runs") === runs, "the policy says " + cap("runs") + " full runs are kept; saveRuns keeps " + runs);
  const msgs = Number((fnOf("alfieSaveMsgs").match(/ALFIE_MSGS\.slice\(-(\d+)\)/) || [])[1]);
  assert.ok(msgs > 0 && cap("alfie-msgs") === msgs, "the policy says " + cap("alfie-msgs") + " Alfie messages are kept; the app keeps " + msgs);
  // Earlier turns sent with a question: the app's own cut AND the server's must both be the number stated.
  const appHist = Number((fnOf("alfieHistory").match(/\.slice\(-(\d+)\)/) || [])[1]);
  const srvHist = Number((WORKER.match(/body\.history \|\| \[\]\)\.slice\(-(\d+)\)/) || [])[1]);
  assert.ok(appHist > 0 && appHist === cap("alfie-history") && srvHist === cap("alfie-history"),
    "the policy says " + cap("alfie-history") + " earlier messages; the app sends " + appHist + " and the server keeps " + srvHist);
  // How long an unused Strava connection lasts, and a half-finished one.
  const conn = new Function("return " + ((STRAVA.match(/export const CONNECTION_TTL_SECONDS = ([\d* ]+);/) || [])[1] || "NaN"))() as number;
  assert.equal(conn, 365 * 24 * 60 * 60, "CONNECTION_TTL_SECONDS is not a year any more -- the policy says a year");
  const puts = [...STRAVA.matchAll(/\.put\("tok:" \+ \w+, JSON\.stringify\(\w+\)([^;]*)\);/g)];
  assert.ok(puts.length >= 2, "the Worker's writes of a Strava connection were not found");
  for (const put of puts) assert.match(put[1]!, /expirationTtl: CONNECTION_TTL_SECONDS/, "a Strava connection is written without its expiry: " + put[0]);
  assert.ok(ttl("strava-connection").length >= 2 && ttl("strava-connection").every((t) => t === "a year"), "the policy's Strava time limit is not 'a year'");
  const nonce = Number((STRAVA.match(/put\("nonce:" \+ nonce, [^,]+, \{ expirationTtl: (\d+) \}\)/) || [])[1]);
  assert.ok(nonce > 0 && ttl("strava-link")[0] === nonce / 60 + " minutes", "the policy says " + ttl("strava-link")[0] + "; a half-finished connection lasts " + nonce + " s");
  // Ask Alfie's counters: the hourly one within about an hour, the daily ones within about a day.
  const buckets = [...WORKER.matchAll(/\["rl:[^\]]*?, (\d+), "(hourly|daily|global)"\]/g)].map((m) => ({ ttl: Number(m[1]), label: m[2]! }));
  assert.equal(buckets.length, 3, "the Worker's rate-limit counters were not read");
  for (const b of buckets) assert.ok(b.label === "hourly" ? b.ttl <= 2 * 3600 : b.ttl <= 26 * 3600, b.label + " counter lives " + b.ttl + " s, longer than the policy says");
  assert.ok(DOC.privacy.includes("within about an hour") && DOC.privacy.includes("about a day"), "the policy no longer says how long the counters live");
  // About 1 km: two decimal places, in both requests that carry a location.
  for (const fn of ["fetchWeather", "runPlaceLookup"]) {
    const src = fnOf(fn);
    assert.ok(/toFixed\(2\)/.test(src) && !/toFixed\([3-9]\)/.test(src), fn + " no longer rounds to two decimal places, and the policy says about 1 km");
  }
  for (const id of ["weather", "place"]) assert.ok(flowSection(DOC.privacy, id).includes("about 1 km"), "the policy's " + id + " section no longer says about 1 km");
});

test("BLOCKER: every page gives the one contact address the app gives", () => {
  assert.match(CONTACT, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/, "PRIVACY_CONTACT is not set -- the pages give an address the app does not");
  for (const name of ALL) {
    const addrs = [...DOC[name].matchAll(/mailto:([^"?]+)/g)].map((m) => m[1]);
    assert.ok(addrs.length > 0, "docs/" + name + "/ gives no contact address");
    assert.ok(addrs.every((a) => a === CONTACT), "docs/" + name + "/ gives " + addrs.join(",") + "; the app gives " + CONTACT);
  }
  // And the app offers it: the Your data card and the legal card.
  assert.ok(fnOf("privacyDeleteHtml").includes("PRIVACY_CONTACT") && fnOf("legalLinksHtml").includes("PRIVACY_CONTACT"), "the app no longer offers the address");
});

test("the pages carry the date the app shows, and every page the app links to exists", () => {
  const updated = constValue<string>("LEGAL_UPDATED");
  const pages = constValue<Array<{ id: string; path: string }>>("LEGAL_PAGES");
  const site = constValue<string>("LEGAL_SITE");
  assert.equal(site, "https://padder1980.github.io/Inte-Run/", "LEGAL_SITE is not the Pages site the docs/ folder is served from");
  // The update flow's host is the same site, so the address sweep in childrens-code.test.ts covers these links.
  assert.ok(FLOWS.some((f) => f.hosts.includes(new URL(site).host)), "the legal pages' host is not one PRIVACY_FLOWS names");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (const p of pages) {
    assert.ok(existsSync(new URL("../docs/" + p.path + "index.html", import.meta.url)), "the app links to " + p.path + " and docs/" + p.path + "index.html does not exist");
    const doc = DOC[p.id as DocName];
    assert.ok(doc, "LEGAL_PAGES names a page this test does not read: " + p.id);
    const m = doc.match(/<time datetime="(\d{4})-(\d{2})-(\d{2})" data-updated>([^<]+)<\/time>/);
    assert.ok(m, "docs/" + p.path + " has no date");
    assert.equal(m[4], updated, "docs/" + p.path + " says it was updated " + m[4] + "; the app says " + updated);
    assert.equal(Number(m[3]) + " " + months[Number(m[2]) - 1] + " " + m[1], updated, "docs/" + p.path + "'s machine date disagrees with its words");
  }
  // They open outside the app, and all three places that promise them really show them.
  const html = new Function("esc", "LEGAL_SITE", "LEGAL_UPDATED", "LEGAL_PAGES", "PRIVACY_CONTACT", "inNativeApp", "window",
    fnOf("appCanOpen") + "\n" + fnOf("mailLink") + "\n" + fnOf("legalLinksHtml") + "\nreturn legalLinksHtml();")(
    (x: unknown) => String(x), site, updated, pages, CONTACT, () => false, {}) as string;
  for (const p of pages) assert.ok(html.includes('href="' + site + p.path + '" target="_blank" rel="noopener noreferrer"'), p.id + " does not open outside the app");
  assert.ok(html.includes('href="mailto:' + CONTACT + '"'), "the legal card does not offer the address");
  assert.ok(constValue<string[]>("HUB_TOOLS").includes("legal"), "Support › Tools has no Privacy policy & terms row");
  assert.ok(/if \(id === "legal"\) return back \+ legalView\(\);/.test(fnOf("supportDetail")), "the Support row opens nothing");
  for (const fn of ["safetyView", "dataView"]) assert.ok(fnOf(fn).includes("legalLinksHtml()"), fn + " no longer links to the policy");
});

test("the pages stay out of the iPhone bundle, and the web version's offline copy can still install", () => {
  // ⚠️ Excluded on purpose: the app opens them on Pages, so a runner reads the current version.
  const want = [...constValue<Array<{ path: string }>>("LEGAL_PAGES").map((p) => p.path.replace(/\/$/, "")), "support", "legal.css"];
  for (const w of want) {
    assert.ok(MAKE_PROJECT.includes("--exclude '" + w + "'"), "ios/make-project.py does not leave " + w + " out of the app bundle");
    assert.ok(PBXPROJ.includes("--exclude '" + w + "'"), "the Xcode project was not regenerated after " + w + " was excluded -- run python3 ios/make-project.py");
  }
  // ⚠️ c.addAll() FAILS WHOLE IF ONE ASSET IS MISSING, and then the offline copy never installs. Every
  // entry must exist -- a directory entry needs its index.html.
  const assets = JSON.parse((SW.match(/const ASSETS = (\[[^\]]*\]);/) || [])[1] || "[]") as string[];
  assert.ok(assets.length >= 10, "the service worker's asset list was not read");
  for (const a of assets) {
    const rel = a.replace(/^\.\//, "");
    const path = new URL("../docs/" + (rel === "" || rel.endsWith("/") ? rel + "index.html" : rel), import.meta.url);
    assert.ok(existsSync(path) && statSync(path).isFile(), "sw.js precaches " + a + ", which docs/ does not have -- the offline copy would never install");
  }
  for (const w of want) assert.ok(assets.some((a) => a.replace(/^\.\//, "").replace(/\/$/, "") === w), "the web version's offline copy does not keep " + w);
});

test("the terms reuse the app's own not-a-diagnosis sentence, and set no minimum age (the owner's ruling)", () => {
  assert.ok(DOC.terms.includes(NOT_A_DIAGNOSIS), "the terms no longer carry NOT_A_DIAGNOSIS word for word");
  // ⚠️ APPLE: terms with a minimum age above the calculated rating force the rating up to it, and there
  // is no 12+ rating, so a "must be 12" would lock 12-year-olds out (APPSTORE.md 1.3). Designed for, not required.
  const MIN_AGE = /minimum age|you must be (at least )?\d+|must be aged|only for (people|runners|those|anyone) (aged )?\d+|not for (anyone|children|people) under \d+|if you are under \d+,? (you )?(may|must|can)(not|n’t| not) use/i;
  for (const name of ["terms", "simple"] as const) {
    const hit = visibleText(DOC[name]).match(MIN_AGE);
    assert.equal(hit, null, "docs/" + name + "/ sets a minimum age (\"" + (hit && hit[0]) + "\") -- Apple would then force a 13+ rating");
  }
  assert.ok(/designed for runners aged/.test(visibleText(DOC.terms)), "the terms no longer say who Inte-Run is designed for");
  assert.ok(/parent, carer or another adult you trust/.test(visibleText(DOC.terms)), "the terms lost the parent or carer clause a young runner needs");
});

// ---- Readability ----------------------------------------------------------------------------------
/** Syllables in an English word, by the usual vowel-group estimate. Good enough to rank text. */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) || []).length);
}
/** The Flesch-Kincaid grade of some text: 0.39 words per sentence + 11.8 syllables per word - 15.59. */
function fkGrade(text: string): number {
  const sentences = text.split(/(?<=[.!?:])\s+|\s*[•·]\s*/).filter((s) => /[a-z]/i.test(s));
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}
/** A page's reading text: headings and list items end a sentence, as they do for a reader. */
function readingText(doc: string): string {
  const body = doc.slice(doc.indexOf('<main id="main">'), doc.indexOf("</main>"));
  return visibleText(body.replace(/<\/(h[1-6]|li|p|dt|dd|td|th)>/g, ". "));
}

test("BLOCKER: the simple version reads at a level a 12-year-old can manage, and is simpler than the full policy", () => {
  const simple = fkGrade(readingText(DOC.simple));
  const full = fkGrade(readingText(DOC.privacy));
  // Flesch-Kincaid grade 6 is the US sixth grade: ages 11 to 12, a UK Year 7. Measured 28 Sept 2026.
  assert.ok(simple <= 6, "the simple version measures grade " + simple.toFixed(1) + " -- above what a 12-year-old reads easily");
  assert.ok(full - simple >= 1.5, "the simple version (" + simple.toFixed(1) + ") is barely simpler than the full policy (" + full.toFixed(1) + ")");
});

// ---- The promises the app makes on screen ---------------------------------------------------------
test("BLOCKER: nothing promises that everything about pain stays on the phone -- only serious warning signs do", () => {
  // ⚠️ The screener (alfieRedFlags) knows a fixed list of warning signs. "My knee hurts" is not on it and
  // is sent when online answers are on, so a sentence promising "anything about pain" was false.
  const script = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "").find((b) => b.includes("function privacyCardHtml(")) || "";
  assert.ok(script, "the app's script block could not be found");
  for (const [where, text] of [["the app", script], ...ALL.map((n) => ["docs/" + n + "/", DOC[n]] as const)] as const) {
    assert.ok(!/pain or feeling unwell|anything about pain/i.test(text), where + " promises that anything about pain stays on the phone");
  }
  // And the examples the copy gives really are caught, from the way a phone types them.
  const flags = new Function(stmt("ALFIE_FLAGS") + "\n" + fnOf("alfieNorm") + "\n" + fnOf("alfieRedFlags") + "\nreturn alfieRedFlags;")() as (q: string) => string[];
  for (const q of ["I’ve got chest pain", "I keep fainting on long runs"]) assert.ok(flags(q).length > 0, "the copy's example is not caught: " + q);
  for (const name of ["privacy", "simple"] as const) {
    assert.ok(/chest pain/.test(flowSection(DOC[name], "alfie")) && /faint/.test(flowSection(DOC[name], "alfie")), "docs/" + name + "/ no longer gives the warning-sign examples");
  }
});

/**
 * Every sentence the app shows that promises something stays put. PLAN.md D1: "every 'no server /
 * nothing uploaded' sentence registered as function + exact text so a rewrite is deliberate".
 * ⚠️ A NEW PROMISE FAILS UNTIL IT IS ADDED HERE, AND AN ENTRY FAILS ONCE ITS SENTENCE IS GONE. Adding
 * one means checking it against PRIVACY_FLOWS and docs/privacy/ first: each of these was read against
 * the code on 28 September 2026 and is true (the false ones were rewritten that day).
 */
const CLAIMS: Array<[fn: string, sentence: string]> = [
  ["ALFIE_ONLINE_EXPLAIN", "If you mention a serious warning sign, like chest pain or fainting, Alfie answers on your phone and that question stays on your phone."],
  ["ALFIE_ONLINE_EXPLAIN", "Your name, where you are and your health check-in answers are never sent, and Inte-Run doesn’t keep your questions."],
  ["PRIVACY_FLOWS", "Nothing about you is sent."],
  ["PRIVACY_FLOWS", "Nothing is sent until you say yes, and serious warning signs, like chest pain or fainting, never leave the phone."],
  ["alfieLimits", "Nothing you type leaves it, and it works with no signal."],
  ["alfieLimits", "Serious warning signs, like chest pain or fainting, are answered here and never sent."],
  ["alfieOnlineRow", "Nothing you type leaves it."],
  ["alfieOnlineRow", "Serious warning signs, like chest pain or fainting, stay on this phone."],
  ["checkinConsent", "Nothing is sent anywhere,"],
  ["checkinConsent", "Your answers stay on this phone."],
  ["clubLogbookSheet", "Nobody else can see it — there is"],
  ["connectView", "Heart rate isn’t sent until you’re 16."],
  ["dataView", "It’s a plain file on your device — it isn’t uploaded anywhere, and it goes only where you send it."],
  ["mapTokenCard", "Stays on this phone, and goes only to Mapbox, with each map it draws."],
  ["privacyCardHtml", "There’s no account, and Inte-Run keeps no copy anywhere else."],
  ["remindersSheetHtml", "Inte-Run never sees your password."],
  ["runNoteHtml", "Saved on this device only."],
  ["safetyView", "Nothing you type leaves it."],
  ["safetyView", "There is no account, and Inte-Run keeps no copy of them anywhere else."],
  ["safetyView", "chest pain or fainting, are answered on this phone and never sent."],
  ["shareDestNote", "Inte-Club puts the card straight on your own grid — nothing leaves your phone."],
  ["shareDestNote", "where those apps appear — Inte-Run posts nothing on your behalf either way."],
  ["stravaSheetHtml", "Stays on this phone."],
  ["stravaSheetHtml", "Strava history, and it never sees your Strava password."],
  ["stravaSheetHtml", "cannot read your Strava history and never sees your Strava password."],
  ["whyView", "Nowhere online."],
  ["whyView", "They travel in your backups and are never uploaded."],
  ["wire", "Saved on this device only."],
];

/** The runtime strings of the app's script, with the top-level declaration each sits in. Comments skipped. */
function runtimeStrings(script: string): Array<{ fn: string; text: string }> {
  const out: Array<{ fn: string; text: string }> = [];
  let fn = "(top)";
  const STR = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
  for (const line of script.split("\n")) {
    const decl = line.match(/^(?:async )?function (\w+)\(|^(?:const|let|var) (\w+) =/);
    if (decl) fn = decl[1] || decl[2] || fn;
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    // A trailing comment starts at the first // that is outside every string on the line.
    const spans = [...line.matchAll(STR)].map((m) => [m.index as number, (m.index as number) + m[0].length] as const);
    let cut = line.length;
    for (let i = line.indexOf("//"); i >= 0; i = line.indexOf("//", i + 2)) {
      if (!spans.some(([a, b]) => i > a && i < b) && (i === 0 || /[\s;,)}]/.test(line[i - 1] || ""))) { cut = i; break; }
    }
    for (const m of line.matchAll(STR)) {
      if ((m.index as number) >= cut) continue;
      // An error's message is for the code that catches it, never shown to a runner.
      if (/Error\($/.test(line.slice(0, m.index as number))) continue;
      out.push({ fn, text: m[0].slice(1, -1) });
    }
  }
  return out;
}
/** What a runtime string says, as a runner reads it. */
function asRead(raw: string): string {
  return raw.replace(/\\\\u([0-9a-f]{4})|\\u([0-9a-f]{4})/gi, (_m, a, b) => String.fromCharCode(parseInt(a || b, 16)))
    .replace(/\\(["'—])/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
const CLAIM = /stays? on (this|your) (phone|device|wrist)|never leaves?\b|leaves? (this|your) (phone|device)|nothing you type leaves|nothing (you type |about you )?(is |gets )?(sent|uploaded)|isn.t sent|not sent|never sent|never uploaded|isn.t uploaded|no server|keeps no copy|nowhere online|only on this (phone|device)|on this (phone|device) only|nobody else can see|doesn.t keep|does not keep|never sees your (\w+ )?password|posts nothing/i;

test("BLOCKER: every sentence in the app that promises something stays on the phone is a registered, checked promise", () => {
  const script = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "").find((b) => b.includes("function privacyCardHtml(")) || "";
  const found = new Set<string>();
  for (const s of runtimeStrings(script)) {
    const text = asRead(s.text);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) if (CLAIM.test(sentence)) found.add(s.fn + ": " + sentence);
  }
  assert.ok(found.size >= 10, "the sweep found only " + found.size + " promises -- it has stopped seeing the app");
  const registered = new Set(CLAIMS.map(([fn, s]) => fn + ": " + s));
  const unregistered = [...found].filter((c) => !registered.has(c)).sort();
  const gone = [...registered].filter((c) => !found.has(c)).sort();
  assert.deepEqual(unregistered, [], "a new promise that something stays on the phone -- check it against PRIVACY_FLOWS and docs/privacy/, then register it");
  assert.deepEqual(gone, [], "a registered promise is no longer in the app -- remove it from CLAIMS (and from the policy, if the policy repeats it)");
});
