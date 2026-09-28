/**
 * Y5 of the 12-17 programme: the ICO's Children's Code, applied to what this app actually does.
 *
 * The owner's rulings (2026-09-26): the high-privacy defaults cover UNDER-18s AND ANYBODY WHO HAS NOT
 * TOLD US THEIR AGE, and there is no privacy contact address yet -- the line offering one appears only
 * once there is one.
 *
 * ⚠️⚠️ STARTING Y5 FOUND FOUR THINGS THAT WERE WRONG FOR EVERYBODY, NOT ONLY FOR CHILDREN, AND THEY ARE
 * GUARDED HERE:
 *  1. The red-flag screener that runs before a question may leave the phone matched RAW text, while the
 *     phrase lists are lower case with straight apostrophes. An iPhone capitalises the first word and
 *     types curly apostrophes, so "Chest pain when I run" and "I don’t want to be here" went to the
 *     server and never met the safety answer.
 *  2. Ask Alfie sent the last eight messages as history whatever they were -- including a symptom the
 *     screener had deliberately kept off the network one question earlier.
 *  3. The Safety page said "two things do reach the internet, and only these" while six did, and Ask
 *     Alfie's own panel said "Nothing you type is sent anywhere" above a chat that sent every question.
 *  4. The web version's offline copy served the first forecast ever fetched for a place until the app
 *     next updated, and kept a reply carrying the runner's rough location.
 *
 * Everything here RUNS the shipped functions out of the built page with the REAL engine rule. A stub
 * answering "private" would measure a strictly easier program, which is how this project has shipped
 * guards that passed while the thing they guarded was unwired.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { highPrivacyByDefault, isYouthAge, ownConsentAllowedAt } from "../src/domain/youth.ts";
import { personalPackSlug } from "../src/live/coach-prompts.ts";

const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const SW = readFileSync(new URL("../docs/sw.js", import.meta.url), "utf8");
const PLIST = readFileSync(new URL("../ios/InteRun-Info.plist", import.meta.url), "utf8");
const DPIA = readFileSync(new URL("../DPIA.md", import.meta.url), "utf8");
const RC = { highPrivacyByDefault, ownConsentAllowedAt };

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
/**
 * A top-level const statement out of the built page, to its own semicolon. ⚠️ THE REAL ONE, NEVER A
 * TYPED COPY: a harness that supplies its own value measures its own value, and this project has
 * watched that exact trap let a re-break escape.
 */
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
/** Evaluate some of the page's consts and functions against a scope, and hand back an expression. */
function lift(names: string[], consts: string[], ret: string, scope: Record<string, unknown>): any {
  const keys = Object.keys(scope);
  const src = consts.map(stmt).join("\n") + "\n" + names.map(fnOf).join("\n") + "\nreturn " + ret + ";";
  // eslint-disable-next-line no-new-func
  return new Function(...keys, src)(...keys.map((k) => scope[k]));
}
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(init));
  return {
    m,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: unknown) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));
const ESC = fnOf("esc");

test("the high-privacy defaults cover under-18s AND anybody who has not given an age", () => {
  for (const a of [12, 13, 15, 17, 17.5, "16"]) assert.equal(highPrivacyByDefault(a), true, "high privacy at " + String(a));
  for (const a of [18, "18", 19, 34, 70]) assert.equal(highPrivacyByDefault(a), false, "adult defaults at " + String(a));
  // No answer: undefined, blank, and 0 -- which is how "Prefer not to say" used to be stored.
  for (const a of [undefined, null, "", 0, NaN, "abc"]) assert.equal(highPrivacyByDefault(a), true, "high privacy with no age: " + String(a));
  // ⚠️ THE DELIBERATE DIFFERENCE FROM THE TRAINING RULE. Somebody who declined to give an age keeps the
  // adult plan, and gets the private settings. If these two ever agree on "absent", one of them moved.
  assert.equal(isYouthAge(undefined), false, "an unknown age trains as an adult");
  assert.equal(highPrivacyByDefault(undefined), true, "an unknown age starts private");
});

/** The four readers of a privacy default, lifted together with the real rule. */
function defaults(age: unknown, stored: Record<string, string> = {}) {
  const localStorage = fakeStorage(stored);
  const api = lift(
    ["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieSaveCfg", "alfieOnline", "alfieSetOnline", "placeNamesOn", "placeNamesSet", "healthSyncOn"],
    ["PLACE_KEY", "HEALTH_KEY"],
    "{ alfieOnline, placeNamesOn, healthSyncOn }",
    { RC, profile: { age }, localStorage, healthAvailable: () => true },
  );
  return { alfie: api.alfieOnline(), place: api.placeNamesOn(), health: api.healthSyncOn() };
}

test("BLOCKER: every setting that sends something off the phone starts OFF for a young or unknown-age runner", () => {
  for (const age of [13, 16, 17, undefined, 0]) {
    assert.deepEqual(defaults(age), { alfie: false, place: false, health: false }, "high-privacy defaults at age " + String(age));
  }
  // An adult's town names and Apple Health are exactly where they were before Y5. Ask Alfie's online
  // answers are the one exception, and it is Apple's rather than ours: guideline 5.1.2(i) requires
  // explicit permission before personal data goes to a third-party AI, so since Y6 they wait for a yes
  // at every age (an adult is asked once, at their first question -- see the tests below).
  assert.deepEqual(defaults(34), { alfie: false, place: true, health: true }, "an adult's defaults, with Alfie waiting to be asked");
});

test("a default is never a lock: the runner's own answer wins in both directions", () => {
  const on = { interun_alfie_v1: JSON.stringify({ online: true }), interun_placenames_v1: "1", interun_health_v1: "1" };
  const off = { interun_alfie_v1: JSON.stringify({ online: false }), interun_placenames_v1: "0", interun_health_v1: "0" };
  assert.deepEqual(defaults(13, on), { alfie: true, place: true, health: true }, "a young runner who turned things on has them on");
  assert.deepEqual(defaults(34, off), { alfie: false, place: false, health: false }, "an adult who turned things off has them off");
});

/** A runner who has already said yes to online answers. */
const ONLINE = { interun_alfie_v1: JSON.stringify({ online: true }) };
/** Just enough page for the sheet and the question box: every id answers with a node that remembers. */
function fakePage() {
  const nodes: Record<string, any> = {};
  const $ = (id: string) => (nodes[id] ||= { id, value: "", innerHTML: "", onclick: null, classList: { on: false, add(c: string) { if (c === "on") this.on = true; } } });
  return { nodes, $ };
}
/** Ask Alfie, lifted whole: the screener, the switch, the permission sheet, what is sent and when. */
function alfie(age: unknown, stored: Record<string, string> = {}, fetchImpl?: (u: string, o: any) => Promise<any>,
  opts: { noServer?: boolean } = {}) {
  const calls: any[] = [];
  const msgs: any[] = [];
  const page = fakePage();
  const localStorage = fakeStorage(stored);
  let closed = 0, renders = 0;
  const fetch = (u: string, o: any) => {
    calls.push({ url: u, body: JSON.parse(o.body) });
    return fetchImpl ? fetchImpl(u, o) : Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: "Here is your plan." }) });
  };
  const api = lift(
    ["alfieNorm", "alfieRedFlags", "alfieCfg", "alfieSaveCfg", "alfieBase", "privDefaultOn", "ownConsentOk", "alfieOnline", "alfieSetOnline",
      "alfieNeedsAsk", "alfieHistory", "alfieRemote", "alfieMaySend", "alfieAsk", "openAlfieOnlineSheet", "alfieToggleOnline"],
    // ⚠️ A blank proxy in storage does NOT remove the server -- alfieBase falls back to ALFIE_SERVER -- so
    // "no server" has to replace that constant rather than the stored setting.
    (opts.noServer ? [] : ["ALFIE_SERVER"]).concat(["ALFIE_FLAGS", "ALFIE_ONLINE_EXPLAIN", "ALFIE_ONLINE_ASK_ADULT", "ALFIE_ONLINE_CHANGE"]),
    "{ alfieAsk, alfieRemote, alfieHistory, alfieMaySend, alfieRedFlags, alfieOnline, alfieToggleOnline }",
    {
      RC, profile: { age }, localStorage, fetch, ALFIE_MSGS: msgs, ALFIE_THINKING: false,
      alfieRenderLog: () => {}, alfieSaveMsgs: () => {}, alfieLocalAnswer: () => "<p>answered on the phone</p>",
      alfiePlanContext: () => ({ goal: "10k" }), alfieDevice: () => "device-1", setTimeout: (f: () => void) => f(),
      esc: (x: unknown) => String(x), $: page.$, SHEET_CTX: null, ensureSheet: () => {},
      closeSheet: () => { closed++; }, render: () => { renders++; },
      ...(opts.noServer ? { ALFIE_SERVER: "" } : {}),
    },
  );
  return { api, calls, msgs, page, localStorage, closed: () => closed, renders: () => renders };
}

test("BLOCKER: a young or unknown-age runner's questions stay on the phone unless they turn online answers on", async () => {
  for (const age of [13, undefined]) {
    const { api, calls, msgs } = alfie(age);
    api.alfieAsk("What's my next session?");
    await flush();
    assert.equal(calls.length, 0, "nothing sent at age " + String(age));
    assert.equal(msgs.length, 2, "the question was still answered, on the phone");
    assert.ok(msgs.every((m) => !m.sent), "and nothing is marked as having reached the server");
  }
  // A young runner is never shown the sheet unprompted (standard 13).
  const young = alfie(13);
  young.api.alfieAsk("What's my next session?");
  assert.equal(young.page.nodes.sheetOv, undefined, "a young runner is not offered online answers unprompted");
});

test("BLOCKER: nothing reaches the AI service before the runner says yes, at any age (App Review 5.1.2(i))", async () => {
  const q = "What's my next session?";
  // An adult who has never answered is ASKED, and nothing is sent or even added to the chat meanwhile.
  const a = alfie(34);
  a.api.alfieAsk(q); await flush();
  assert.equal(a.calls.length, 0, "an adult's first question is not sent before they have said yes");
  assert.equal(a.msgs.length, 0, "and it is not answered either -- it waits for their choice");
  assert.equal(a.page.nodes.sheetOv && a.page.nodes.sheetOv.classList.on, true, "the permission sheet is shown");
  assert.match(a.page.nodes.sheetBody.innerHTML, /Answer this online\?/, "and it asks about this question");
  assert.equal(a.page.nodes.alfieIn.value, q, "the question goes back in the box, so closing the sheet loses nothing");
  // Saying yes records it, asks the question online, and empties the box.
  a.page.nodes.alfOnYes.onclick(); await flush();
  assert.equal(a.api.alfieOnline(), true, "the yes is remembered");
  assert.equal(a.calls.length, 1, "and the waiting question is then sent");
  assert.equal(a.calls[0].body.question, q);
  assert.equal(a.page.nodes.alfieIn.value, "", "the box is emptied once the question is asked");
  a.api.alfieAsk("And tomorrow?"); await flush();
  assert.equal(a.calls.length, 2, "an adult is asked once, not every time");
  // Saying no records it and answers on the phone.
  const b = alfie(34);
  b.api.alfieAsk(q); b.page.nodes.alfOnKeep.onclick(); await flush();
  assert.equal(b.api.alfieOnline(), false, "the no is remembered");
  assert.equal(b.calls.length, 0, "nothing is sent");
  assert.equal(b.msgs.length, 2, "and the question is answered on the phone");
  b.api.alfieAsk("And tomorrow?"); await flush();
  assert.equal(b.page.nodes.sheetOv.classList.on, true);
  assert.equal(b.calls.length, 0, "a no is not asked again at the next question");
  // A red flag is answered on the phone whatever the switch says, so it never triggers the question.
  const c = alfie(34);
  c.api.alfieAsk("Chest pain when I run"); await flush();
  assert.equal(c.page.nodes.sheetOv, undefined, "a symptom never opens the permission sheet");
  assert.equal(c.calls.length, 0);
  // With no server there is nothing to ask about, so the question is simply answered on the phone.
  const d = alfie(34, {}, undefined, { noServer: true });
  d.api.alfieAsk(q); await flush();
  assert.equal(d.page.nodes.sheetOv, undefined, "no server, no permission sheet");
  assert.equal(d.msgs.length, 2, "the question is answered on the phone");
  assert.equal(d.calls.length, 0);
});

test("BLOCKER: the red-flag screen before sending catches what a phone actually types", () => {
  const { api } = alfie(34, ONLINE);
  // An iPhone capitalises the first word and types curly apostrophes. Every one of these went to the
  // server before Y5.
  for (const q of ["Chest pain when I run", "Suicidal thoughts again", "I don’t want to be here anymore",
    "I can’t breathe properly after running", "I Feel Faint On Hills", "SELF HARM"]) {
    assert.ok(api.alfieRedFlags(q).length > 0, "the screener recognises: " + q);
    assert.equal(api.alfieMaySend(q), false, "and it never leaves the phone: " + q);
  }
  assert.equal(api.alfieMaySend("What's my next session?"), true, "an ordinary question still goes (the control)");
});

test("BLOCKER: history carries only turns that already reached the server -- never a symptom kept off it", async () => {
  let fail = false;
  const { api, calls } = alfie(34, ONLINE, () => (fail
    ? Promise.reject(new Error("no signal"))
    : Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: "Here is your plan." }) })));
  api.alfieAsk("I have chest pain"); await flush();
  assert.equal(calls.length, 0, "the symptom itself is never sent");
  api.alfieAsk("What's my next session?"); await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.question, "What's my next session?");
  assert.deepEqual(calls[0].body.history, [], "no earlier turn had reached the server -- and the current question is not sent twice");
  api.alfieAsk("And tomorrow?"); await flush();
  const h = calls[1].body.history;
  assert.equal(h.length, 2, "the one exchange that did reach the server");
  assert.equal(h[0].text, "What's my next session?");
  assert.ok(!JSON.stringify(calls).toLowerCase().includes("chest"), "the symptom never travels as history either");
  // A failed request may or may not have arrived, and "not sent" is the side that cannot leak it later.
  fail = true; api.alfieAsk("Should I run in the rain?"); await flush();
  fail = false; api.alfieAsk("What about Sunday?"); await flush();
  assert.ok(!JSON.stringify(calls[calls.length - 1].body.history).includes("rain"), "a question whose send failed is not re-sent as history");
});

test("the one function that sends refuses on its own when online answers are off", async () => {
  const { api, calls } = alfie(13);
  await assert.rejects(api.alfieRemote("hello"), "alfieRemote must refuse with the switch off");
  assert.equal(calls.length, 0, "and it sent nothing");
});

test("turning online answers ON always goes through the sheet; turning them OFF never asks", () => {
  function toggle(age: unknown, stored: Record<string, string>) {
    const localStorage = fakeStorage(stored);
    let sheet = 0, renders = 0;
    const api = lift(
      ["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieSaveCfg", "alfieOnline", "alfieSetOnline", "alfieToggleOnline"], [],
      "{ alfieToggleOnline, alfieOnline }",
      { RC, profile: { age }, localStorage, openAlfieOnlineSheet: () => { sheet++; }, render: () => { renders++; } },
    );
    api.alfieToggleOnline();
    return { sheet, renders, online: api.alfieOnline() };
  }
  assert.deepEqual(toggle(13, {}), { sheet: 1, renders: 0, online: false }, "a 13-year-old is shown what leaves the phone before it is switched on");
  assert.deepEqual(toggle(undefined, {}), { sheet: 1, renders: 0, online: false }, "so is somebody who has not given an age");
  assert.deepEqual(toggle(13, { interun_alfie_v1: JSON.stringify({ online: true }) }), { sheet: 0, renders: 1, online: false },
    "switching OFF is one tap -- a confirmation there is friction against the private choice");
  assert.deepEqual(toggle(34, { interun_alfie_v1: JSON.stringify({ online: false }) }), { sheet: 1, renders: 0, online: false },
    "an adult is told what is sent and to whom before it is switched on too (guideline 5.1.2(i)) -- it was one silent tap before Y6");
  // The real sheet, both variants. Each says what is sent, what is not, and where it goes.
  function sheet(age: unknown) {
    const x = alfie(age);
    x.api.alfieToggleOnline();
    return { html: x.page.nodes.sheetBody.innerHTML as string, x };
  }
  const young = sheet(13), adult = sheet(40);
  for (const s of [young.html, adult.html]) {
    for (const bit of ["Inte-Run’s server", "Cloudflare", "never sent", "stays on your phone"]) assert.ok(s.includes(bit), "the sheet says: " + bit);
  }
  assert.ok(young.html.includes("Ask a parent or an adult you trust"), "a young runner is told who to talk to");
  assert.ok(!adult.html.includes("Ask a parent"), "an adult is not");
  assert.ok(young.html.includes('class="primary" id="alfOnKeep"'),
    "for a young runner, keeping them off is the primary button -- the Code forbids nudging a child towards LESS privacy, not more");
  // A young runner's "keep them off" from the switch changes nothing; saying yes records it.
  young.x.page.nodes.alfOnKeep.onclick();
  assert.equal(young.x.api.alfieOnline(), false);
  assert.ok(!String(young.x.localStorage.getItem("interun_alfie_v1") || "").includes("online"), "no answer is recorded -- unanswered already means off");
  adult.x.page.nodes.alfOnYes.onclick();
  assert.equal(adult.x.api.alfieOnline(), true, "an adult's yes from the switch turns them on");
});

test("Alfie's own words follow the switch, and the old false sentence is gone", () => {
  function words(online: boolean) {
    return lift(["alfieLimits", "alfieOnlineRow"], [], "alfieLimits() + alfieOnlineRow()",
      { alfieOnline: () => online, ownConsentOk: () => true, alfieBase: () => "https://server.test", ALFIE_MSGS: [{ role: "user", text: "hi" }], esc: (x: unknown) => String(x) });
  }
  const off = words(false), on = words(true);
  assert.ok(off.includes("Nothing you type leaves it") && !off.includes("Online answers are on"), "off, it says the words stay on the phone");
  // ⚠️ D1 (28 Sept 2026): it used to promise that "anything about pain or feeling unwell" stays on the phone,
  // and only the serious warning signs alfieRedFlags knows do. "My knee hurts" is sent when this is on.
  assert.ok(on.includes("Online answers are on") && on.includes("Serious warning signs"), "on, it says what is sent and what never is");
  assert.ok(off.includes('id="alfClear"'), "a conversation can be cleared");
  assert.ok(!PAGE.includes("Nothing you type is sent anywhere"), "the sentence that was false for everybody is gone");
});

test("a run's town is looked up only when the setting allows it, and from a location to about 1 km", () => {
  function lookup(age: unknown) {
    const urls: string[] = [];
    const run: any = { id: "r1", route: [{ lat: 51.507351, lng: -0.127758 }, { lat: 51.508912, lng: -0.125511 }, { lat: 51.51034, lng: -0.1231 }] };
    lift(["privDefaultOn", "ownConsentOk", "placeNamesOn", "runPlaceLookup"], ["PLACE_KEY"], "runPlaceLookup(run)", {
      RC, profile: { age }, localStorage: fakeStorage(), run, state: { screen: null },
      saveRuns: () => {}, render: () => {}, fetch: (u: string) => { urls.push(u); return Promise.resolve({ ok: false }); },
    });
    return { urls, tried: run.placeTried };
  }
  const young = lookup(14);
  assert.equal(young.urls.length, 0, "a young runner's route is not sent to OpenStreetMap by default");
  assert.equal(young.tried, undefined, "and the run is not marked tried, so turning town names on later still works");
  const adult = lookup(40);
  assert.equal(adult.urls.length, 1);
  assert.ok(/lat=51\.51&lon=-0\.13$/.test(adult.urls[0] as string), "two decimals, about 1 km -- was four, about 11 m: " + adult.urls[0]);
});

test("the weather is asked for with a location to about 1 km, not a street", () => {
  const urls: string[] = [];
  lift(["fetchWeather"], [], "fetchWeather(true)", {
    WX_FETCHING: false, state: { wx: null }, profile: { personalized: true },
    navigator: { geolocation: { getCurrentPosition: (ok: (p: any) => void) => ok({ coords: { latitude: 51.507351, longitude: -0.127758 } }) } },
    fetch: (u: string) => { urls.push(u); return new Promise(() => {}); },
  });
  assert.equal(urls.length, 1);
  assert.ok((urls[0] as string).includes("latitude=51.51&longitude=-0.13&"), "two decimals: " + urls[0]);
});

test("the web version never asks GitHub for a personal voice pack, whose address carries a first name", () => {
  function load(native: boolean) {
    const urls: string[] = [];
    lift(["coachLoadPersonal"], [], "coachLoadPersonal()", {
      RC: { personalPackSlug }, COACH: {}, WHY: { name: "Alfie" }, inNativeApp: () => native,
      fetch: (u: string) => { urls.push(u); return Promise.resolve({ ok: false }); },
    });
    return urls;
  }
  assert.deepEqual(load(false), [], "on the web there is no pack to find, so the name is not sent");
  assert.equal(load(true).length, 1, "the iPhone app still loads the pack from its own bundle");
});

/** Every web address a piece of source can reach: after http(s)://, and the one host built by concatenation. */
function hostsIn(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const h = (m[1] as string).toLowerCase();
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)) continue; // a placeholder like "alfie-proxy.…" is not a host
    // An XML namespace (an SVG's, a GPX file's, createElementNS's first argument) is a label that is
    // never fetched, not a request.
    if (/(?:xmlns(?::[a-z]+)?=\\*|createElementNS\()["']$/i.test(src.slice(Math.max(0, (m.index as number) - 24), m.index as number))) continue;
    out.add(h);
  }
  for (const m of src.matchAll(/["']\.((?:[a-z0-9-]+\.)+[a-z]{2,})\//gi)) out.add((m[1] as string).toLowerCase());
  return out;
}
function swiftSources(): string {
  const root = new URL("../ios/", import.meta.url);
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".swift"))
    .map((f) => readFileSync(new URL(f, root), "utf8")).join("\n");
}

test("BLOCKER: every web address the app can reach is named in what the runner is told", () => {
  const blocks = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.find((b) => b.includes("function privacyCardHtml(")) || "";
  assert.ok(app, "the app's script block could not be found");
  const reached = new Set([...hostsIn(app), ...hostsIn(swiftSources())]);
  const flows = new Function(stmt("PRIVACY_FLOWS") + "\nreturn PRIVACY_FLOWS;")() as Array<{ id: string; hosts: string[] }>;
  const links = new Function(stmt("PRIVACY_LINK_HOSTS") + "\nreturn PRIVACY_LINK_HOSTS;")() as string[];
  const named = [...flows.flatMap((f) => f.hosts), ...links];
  const covered = (h: string) => named.some((n) => h === n || h.endsWith("." + n));
  const untold = [...reached].filter((h) => !covered(h));
  assert.deepEqual(untold, [], "these addresses are reached but not in PRIVACY_FLOWS or PRIVACY_LINK_HOSTS -- tell the runner, or remove the request");
  // And the table names nothing that no longer exists, or it would describe a service that is not there.
  const stale = named.filter((n) => ![...reached].some((h) => h === n || h.endsWith("." + n)));
  assert.deepEqual(stale, [], "PRIVACY_FLOWS names an address nothing reaches any more");
  assert.ok(reached.size >= 8, "the sweep found only " + reached.size + " addresses -- it has stopped seeing the app");
  // The DPIA's data map is the same table, so it cannot silently go stale either.
  for (const f of flows) assert.ok(DPIA.includes("`" + f.id + "`"), "DPIA.md's data map does not cover the " + f.id + " flow");
});

test("the Safety page and Apps & devices no longer claim what stopped being true", () => {
  for (const s of ["Two things do reach the internet", "no server holding them", "no Inte-Run server for other apps"]) {
    assert.ok(!PAGE.includes(s), "still claims: " + s);
  }
  assert.ok(fnOf("safetyView").includes("privacyFlowList()"), "the Safety page reads the table rather than keeping its own list");
  const list = lift(["privacyFlowShown", "privacyFlowList"], ["PRIVACY_FLOWS"], "privacyFlowList()",
    { inNativeApp: () => true, alfieBase: () => "x", stravaBase: () => "x" });
  for (const bit of ["the weather", "maps of your runs", "town names for runs", "Ask Alfie", "Strava", "app updates"]) {
    assert.ok(list.includes(bit), "the list names " + bit + ": " + list);
  }
});

test("Your data shows each switch with the runner's real default, and every control is wired", () => {
  function card(age: unknown) {
    return lift(
      ["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieOnline", "placeNamesOn", "healthSyncOn", "privacyFlowShown", "privacyCardHtml"],
      ["PRIVACY_FLOWS", "PLACE_KEY", "HEALTH_KEY"], "privacyCardHtml()",
      {
        RC, profile: { age }, localStorage: fakeStorage(), healthAvailable: () => true, inNativeApp: () => true,
        alfieBase: () => "x", stravaBase: () => "x", stravaAgeOk: () => true, stravaConnected: () => false,
        esc: new Function(ESC + "\nreturn esc;")(),
      },
    );
  }
  const young = card(13), adult = card(40);
  for (const id of ["pvAlfie", "pvPlace", "pvHealth"]) {
    assert.ok(young.includes('id="' + id + '" role="switch" aria-checked="false"'), id + " starts off for a 13-year-old");
  }
  for (const id of ["pvPlace", "pvHealth"]) {
    assert.ok(adult.includes('id="' + id + '" role="switch" aria-checked="true"'), id + " starts on for an adult");
  }
  assert.ok(adult.includes('id="pvAlfie" role="switch" aria-checked="false"'),
    "Ask Alfie's online answers are off for an adult until they say yes (guideline 5.1.2(i))");
  const wire = fnOf("wireDataView");
  for (const id of ["pvAlfie", "pvPlace", "pvHealth", "pvDelete"]) {
    assert.ok(new RegExp('\\$\\("' + id + '"\\);\\s*if \\(\\w+\\) \\w+\\.onclick').test(wire), id + " is wired");
  }
  assert.ok(/confirmSheet\([^]*?deleteEverything\)/.test(wire), "Delete everything asks first, and then really deletes");
  assert.ok(fnOf("dataView").indexOf("privacyCardHtml()") < fnOf("dataView").indexOf("On this device"), "privacy comes first on the page");
});

test("the contact line appears only once there is an address; the ICO is always offered", () => {
  const html = (contact: string) => lift(["privacyDeleteHtml"], ["ICO_COMPLAINTS_URL"], "privacyDeleteHtml()",
    { PRIVACY_CONTACT: contact, esc: new Function(ESC + "\nreturn esc;")() });
  const none = html("");
  assert.ok(!none.includes("mailto:"), "no address, no line offering one -- an address that reaches nobody is worse than none");
  assert.ok(none.includes('href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer"'), "the ICO link opens outside the app");
  assert.ok(none.includes("Talk to a parent or an adult you trust"), "and it tells a child who to talk to first");
  assert.ok(html("privacy@inte-run.test").includes('href="mailto:privacy@inte-run.test"'), "once an address exists, it is offered");
});

test("BLOCKER: Delete everything removes what a backup leaves out, tells Strava first, and nothing is written back", async () => {
  const log: string[] = [];
  const storage = fakeStorage({
    interun_runs: "[]", rc_profile_v1: "{}", interun_strava_v1: '{"key":"dk-1"}', interun_mapbox_v1: "pk.x",
    interun_alfie_msgs: "[]", some_other_site: "keep",
  });
  const rm = storage.removeItem; storage.removeItem = (k: string) => { log.push("remove " + k); rm(k); };
  const deleted: string[] = [];
  const idb: any = { deleteDatabase: (n: string) => { deleted.push(n); const rq: any = {}; queueMicrotask(() => rq.onsuccess && rq.onsuccess()); return rq; } };
  const cached = [{ url: "https://api.open-meteo.com/v1/forecast?x" }, { url: "https://a.basemaps.cartocdn.com/1/2/3.png" }, { url: "https://app.test/index.html" }];
  const dropped: string[] = [];
  const caches = { keys: () => Promise.resolve(["c1"]), open: () => Promise.resolve({
    keys: () => Promise.resolve(cached), delete: (r: { url: string }) => { dropped.push(r.url); return Promise.resolve(true); } }) };
  const StorageFake: any = { prototype: { setItem: "original" } };
  let reloaded = 0;
  let stravaSent: any = null;
  await lift(["wipeAppStorage", "purgeOffsiteCache", "deleteEverything"], ["BACKUP_PREFIXES", "CLUBDB", "MAPCACHE_DB"], "deleteEverything()", {
    localStorage: storage, indexedDB: idb, caches, Storage: StorageFake, location: { origin: "https://app.test", reload: () => { reloaded++; } },
    stravaCfg: () => JSON.parse(storage.getItem("interun_strava_v1") || "{}"), stravaBase: () => "https://server.test",
    stravaCall: (path: string, opts: any) => { log.push("strava " + path); stravaSent = opts; return Promise.resolve({ ok: true }); },
    URL, setTimeout: () => 0,
  });
  assert.equal(log[0], "strava /strava/disconnect", "Strava is told before the key it needs is deleted");
  assert.ok(stravaSent.keepalive === true && JSON.parse(stravaSent.body).dk === "dk-1", "with the device key, and surviving the reload");
  assert.deepEqual([...storage.m.keys()], ["some_other_site"], "every key the app owns is gone -- including the two a backup deliberately leaves out");
  assert.deepEqual(deleted.sort(), ["interun_club_media_v1", "interun_mapcache_v1"], "the club's photos and the cached maps of every run are deleted too");
  assert.deepEqual(dropped.sort(), ["https://a.basemaps.cartocdn.com/1/2/3.png", "https://api.open-meteo.com/v1/forecast?x"],
    "other sites' cached replies go; the app's own files stay so it still opens offline");
  assert.notEqual(StorageFake.prototype.setItem, "original", "after the wipe nothing can be written back before the reload");
  assert.throws(() => idb.open("x"), "and no database can be re-created");
  assert.equal(reloaded, 1, "the page reloads, so no in-memory copy repaints as though nothing happened");
  // The card says plainly what it cannot reach.
  const card = fnOf("privacyDeleteHtml");
  for (const bit of ["Strava", "Apple Health", "backup files", "Apple Watch"]) assert.ok(card.includes(bit), "the card says it cannot reach " + bit);
});

test("BLOCKER: a young runner's share card starts with the route and the place hidden, every visit", () => {
  function studio(age: unknown) {
    const localStorage = fakeStorage();
    return {
      localStorage,
      api: lift(["privDefaultOn", "saveSharePriv", "sharePrivacyFor", "setSharePrivacy", "closeShareStudio"],
        ["SHARE_PRIV_STORE", "SHARE_PRIV_MAX"], "{ sharePrivacyFor, setSharePrivacy, closeShareStudio }",
        { RC, profile: { age }, localStorage, SHAREPRIV: {}, SHAREPRIV_SESS: {}, PRIVACY: { ends: false, map: false }, state: { logged: [] },
          STUDIO: null, SPHOTO: null, SCARD: {}, document: { getElementById: () => null }, overlayModal: () => {} }),
    };
  }
  const run = { id: "run-1" };
  const y = studio(15);
  assert.equal(y.api.sharePrivacyFor(run).map, true, "the route starts hidden for a 15-year-old");
  assert.equal(y.api.sharePrivacyFor(run).loc, true, "and so does the place");
  y.api.setSharePrivacy(run, "map", false);
  assert.equal(y.api.sharePrivacyFor(run).map, false, "they can show it on this card");
  assert.equal(y.localStorage.getItem("interun_shareprivacy_v1"), null, "and that choice is never written to disk");
  y.api.closeShareStudio();
  assert.equal(y.api.sharePrivacyFor(run).map, true, "the next visit starts hidden again -- standard 10's end of the session");
  const a = studio(40);
  assert.equal(a.api.sharePrivacyFor(run).map, false, "an adult's card is unchanged");
  a.api.setSharePrivacy(run, "loc", true);
  assert.ok(String(a.localStorage.getItem("interun_shareprivacy_v1")).includes('"loc":true'), "and an adult's choice is still remembered");
});

test("the web version's offline copy never answers a forecast from its cache", () => {
  const handlers: Record<string, (e: any) => void> = {};
  const self = { addEventListener: (t: string, f: (e: any) => void) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } };
  const caches = { match: () => Promise.resolve(undefined), open: () => Promise.resolve({ put() {}, addAll: () => Promise.resolve() }), keys: () => Promise.resolve([]) };
  new Function("self", "caches", "fetch", SW)(self, caches, () => new Promise(() => {}));
  let answered = 0;
  const ask = (url: string) => (handlers.fetch as (e: any) => void)({ request: { method: "GET", url, mode: "cors" }, respondWith: () => { answered++; } });
  ask("https://api.open-meteo.com/v1/forecast?latitude=51.51&longitude=-0.13");
  assert.equal(answered, 0, "a forecast goes straight to the network");
  ask("https://padder1980.github.io/Inte-Run/voices/manifest.json");
  assert.equal(answered, 1, "the app's own files are still served from the cache (the control)");
});

test("the iPhone's permission wording says what really happens", () => {
  const str = (key: string) => (PLIST.match(new RegExp("<key>" + key + "</key>\\s*<string>([^<]*)</string>")) || [])[1] || "";
  // ⚠️ STRAVA IS NOT THE ONLY WAY HEART RATE LEAVES THE PHONE, and Y5's first wording said it was ("It only
  // leaves them if you send a run to Strava yourself"). A share card can print the run's heart rate --
  // RUN_METRIC_LADDER marks those entries share: true -- and a backup file carries it as well. So the
  // wording names Strava as an EXAMPLE of the runner's own choice and admits sharing. Derived from the
  // ladder: the day no heart-rate figure can reach a card, this says so instead of going quietly vacuous.
  const ladder = lift([], ["RUN_METRIC_LADDER"], "RUN_METRIC_LADDER", {}) as Array<{ key: string; share: boolean; health?: boolean }>;
  assert.ok(ladder.some((m) => m.health && m.share),
    "no heart-rate figure can reach a share card any more -- restate the 'or share it' half of this guard");
  for (const k of ["NSHealthShareUsageDescription", "NSHealthUpdateUsageDescription"]) {
    assert.ok(!/never sent anywhere/.test(str(k)), k + " still says health data is never sent anywhere -- heart rate goes to Strava when a runner sends a run");
    assert.ok(str(k).includes("Strava"), k + " no longer names Strava, the main place a runner sends a run");
    assert.ok(/\bshar/i.test(str(k)), k + " reads as if Strava were the only way out -- a share card can print heart rate too");
  }
  assert.ok(str("NSLocationWhenInUseUsageDescription").includes("weather"), "the location wording names the weather lookup");
});

test("a young runner's share card leaves heart rate off unless they add it", () => {
  // ⚠️⚠️ A DEFAULT, NOT A LOCK (standard 7). On a run with heart rate and no recorded climb, the pool's head
  // put AVG HR third on the card, so a young runner sharing a run published their heart rate -- special
  // category data -- without ever choosing to. Found by the session that committed Y5, after the route and
  // the place had already been made private on the same card. Driven through the real shareMetricsChosen
  // and the real Metrics sheet, with the real privacy rule.
  const env = (profile: Record<string, unknown>) => lift(
    ["privDefaultOn", "runMetricLadder", "shareMetricPool", "shareHealthMetric", "shareMetricsChosen", "studioMetricsHtml", "esc"],
    ["RUN_METRIC_LADDER", "SHARE_METRIC_MAX"],
    "{ chosen: shareMetricsChosen, pool: shareMetricPool, sheet: studioMetricsHtml, ladder: RUN_METRIC_LADDER }",
    { RC, profile, STUDIO: null, SCARD: { metrics: null }, SHARE_TEMPLATE_LABEL: {} });
  const run = { time: "32:10", pace: "5:21 /km", avgPaceSec: 321, avgHr: 152, maxHr: 176, cadence: 168, elevGain: 0 };
  const keys = (e: any, picked: string[] | null = null) => e.chosen(run, picked).map((x: any) => x.key);
  const adult = env({ age: 34 });
  // The control. Without it the cases below could pass on a fixture that never showed heart rate at all.
  assert.deepEqual(keys(adult), ["time", "pace", "avgHr"], "an adult's card no longer shows what it did before Y5");
  assert.doesNotMatch(adult.sheet(run), /Heart rate stays off/, "an adult is told heart rate is held back when it is not");
  const cases: Array<[string, any]> = [["a 14-year-old", env({ age: 14 })], ["a runner with no age", env({})]];
  for (const [who, e] of cases) {
    assert.deepEqual(keys(e), ["time", "pace", "cadence"], who + "'s card shows a heart-rate figure by default");
    assert.ok(e.pool(run).some((x: any) => x.key === "avgHr"), who + " cannot add heart rate at all -- a default must never be a lock");
    assert.deepEqual(keys(e, ["time", "avgHr"]), ["time", "avgHr"], who + " picked heart rate and did not get it");
    assert.match(e.sheet(run), /Heart rate stays off unless you add it/, who + "'s Metrics sheet does not say why heart rate is missing");
    const noHr = { time: "32:10", pace: "5:21 /km", avgPaceSec: 321, cadence: 168 };
    assert.doesNotMatch(e.sheet(noHr), /Heart rate stays off/, "the sentence appears on a run that recorded no heart rate");
  }
  // ⚠️ DERIVED, SO A NEW HEART-RATE FIGURE CANNOT ARRIVE UNMARKED: every bpm entry must carry health: true.
  // The default case above cannot see a missing marker on maxHr -- it is fifth in the pool, so it never
  // reaches the usual three -- which is exactly why this half exists.
  const bpm = (adult.ladder as Array<{ key: string; u: string; health?: boolean }>).filter((m) => m.u === "bpm");
  assert.ok(bpm.length >= 2, "the ladder's heart-rate entries were not found, so this sweep would pass on anything");
  const unmarked = bpm.filter((m) => !m.health).map((m) => m.key);
  assert.deepEqual(unmarked, [], "these heart-rate figures are not marked health: true: " + unmarked.join(", "));
});
