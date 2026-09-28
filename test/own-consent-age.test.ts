/**
 * Stage D1: the extras that run on a runner's own permission stay off until 13.
 *
 * UK GDPR Article 8, with the age set by the Data Protection Act 2018, section 9: where an online service
 * offered to a child relies on consent, the child must be at least 13; below that, a parent must give or
 * authorise it. Two extras run on the runner's own yes -- Ask Alfie's online answers and town names for
 * runs -- and before D1 a 12-year-old could switch both on alone. The owner's ruling, 28 September 2026:
 * off until 13, like Strava, rather than a "my parent says yes" button a child could tap themselves.
 *
 * ⚠️ A LOCK, NOT A DEFAULT, so "a yes stored earlier" is tested as well as "unanswered": a runner who
 * switched something on and then gave their age as 12 must send nothing. Every function here is lifted
 * out of the built page and run with the REAL engine rule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { highPrivacyByDefault, ownConsentAllowedAt, OWN_CONSENT_MIN_AGE, YOUTH_MIN_AGE, STRAVA_MIN_AGE } from "../src/domain/youth.ts";

const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const RC = { highPrivacyByDefault, ownConsentAllowedAt };

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
function lift(names: string[], consts: string[], ret: string, scope: Record<string, unknown>): any {
  const keys = Object.keys(scope);
  const src = consts.map(stmt).join("\n") + "\n" + names.map(fnOf).join("\n") + "\nreturn " + ret + ";";
  // eslint-disable-next-line no-new-func
  return new Function(...keys, src)(...keys.map((k) => scope[k]));
}
function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: unknown) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const ESC = new Function(fnOf("esc") + "\nreturn esc;")() as (x: unknown) => string;
/** A runner who had already said yes to both, before any age was given. */
const SAID_YES = { interun_alfie_v1: JSON.stringify({ online: true }), interun_placenames_v1: "1" };

test("the rule: 13 and over may give their own permission, as UK law sets it; absent is allowed, like Strava", () => {
  assert.equal(OWN_CONSENT_MIN_AGE, 13, "UK GDPR Article 8 with the Data Protection Act 2018, section 9, says 13");
  assert.equal(OWN_CONSENT_MIN_AGE, STRAVA_MIN_AGE, "the owner's ruling was 'like Strava': if these part company, say why");
  assert.ok(YOUTH_MIN_AGE < OWN_CONSENT_MIN_AGE, "the youth programme starts below this age, which is the whole reason it matters");
  for (const a of [12, "12", 12.5]) assert.equal(ownConsentAllowedAt(a), false, "no own consent at " + String(a));
  for (const a of [13, "13", 14, 17, 18, 40]) assert.equal(ownConsentAllowedAt(a), true, "own consent at " + String(a));
  // Absent (and 0, which "Prefer not to say" used to be stored as) is allowed: an unknown age already starts
  // on the private settings, so nothing is sent unless they switch it on themselves.
  for (const a of [undefined, null, "", 0]) assert.equal(ownConsentAllowedAt(a), true, "absent is allowed: " + String(a));
});

/** The two getters, lifted with the real rule. */
function getters(age: unknown, stored: Record<string, string> = SAID_YES) {
  const api = lift(["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieOnline", "placeNamesOn"], ["PLACE_KEY"],
    "{ alfieOnline, placeNamesOn }", { RC, profile: { age }, localStorage: fakeStorage(stored) });
  return { alfie: api.alfieOnline() as boolean, place: api.placeNamesOn() as boolean };
}

test("BLOCKER: under 13, Ask Alfie's online answers and town names are off even after a yes", () => {
  assert.deepEqual(getters(12), { alfie: false, place: false }, "a 12-year-old's earlier yes sends nothing");
  assert.deepEqual(getters(13), { alfie: true, place: true }, "at 13 their own yes counts");
  assert.deepEqual(getters(undefined), { alfie: true, place: true }, "an unknown age's own yes counts too (the rule's recorded hole)");
  assert.deepEqual(getters(12, {}), { alfie: false, place: false });
});

test("BLOCKER: under 13 nothing reaches the server or OpenStreetMap, whatever is stored", async () => {
  const urls: string[] = [];
  const fetch = (u: string) => { urls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: "x" }) }); };
  // The one function that sends asks for itself (alfieRemote), so a caller that forgot cannot leak.
  const remote = lift(["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieBase", "alfieOnline", "alfieRemote"], ["ALFIE_SERVER"],
    "alfieRemote", { RC, profile: { age: 12 }, localStorage: fakeStorage(SAID_YES), fetch,
      alfiePlanContext: () => ({}), alfieHistory: () => [], alfieDevice: () => "d", esc: ESC });
  await assert.rejects(remote("How far is my long run?"), "a 12-year-old's question is refused before it is sent");
  const run: any = { id: "r1", route: [{ lat: 51.507351, lng: -0.127758 }, { lat: 51.508912, lng: -0.125511 }, { lat: 51.51034, lng: -0.1231 }] };
  lift(["privDefaultOn", "ownConsentOk", "placeNamesOn", "runPlaceLookup"], ["PLACE_KEY"], "runPlaceLookup(run)", {
    RC, profile: { age: 12 }, localStorage: fakeStorage(SAID_YES), run, state: { screen: null },
    saveRuns: () => {}, render: () => {}, fetch,
  });
  assert.deepEqual(urls, [], "nothing was requested for a 12-year-old");
  assert.equal(run.placeTried, undefined, "and the run is not marked tried, so the town is looked up once they are 13");
});

test("under 13 the screens show '13 and over' where the switches were, and the sheet is never offered", () => {
  const card = (age: number) => lift(
    ["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieOnline", "placeNamesOn", "healthSyncOn", "privacyFlowShown", "privacyCardHtml"],
    ["PRIVACY_FLOWS", "PLACE_KEY", "HEALTH_KEY"], "privacyCardHtml()",
    { RC, profile: { age }, localStorage: fakeStorage(), healthAvailable: () => true, inNativeApp: () => true,
      alfieBase: () => "x", stravaBase: () => "x", stravaAgeOk: () => age >= 13, stravaConnected: () => false, esc: ESC }) as string;
  const twelve = card(12), thirteen = card(13);
  for (const id of ["pvAlfie", "pvPlace"]) {
    assert.ok(!twelve.includes('id="' + id + '"'), id + " is a switch a 12-year-old cannot use -- an inert control");
    assert.ok(thirteen.includes('id="' + id + '"'), id + " is back at 13");
  }
  assert.ok(twelve.includes('id="pvHealth"'), "Apple Health stays on the device and keeps its switch at 12");
  assert.equal((twelve.match(/13 and over/g) || []).length, 3, "Ask Alfie, town names and Strava each say 13 and over");
  // Alfie's own row: a status, not a switch.
  const row = (age: number) => lift(["privDefaultOn", "ownConsentOk", "alfieOnline", "alfieCfg", "alfieOnlineRow"], [], "alfieOnlineRow()",
    { RC, profile: { age }, localStorage: fakeStorage(), alfieBase: () => "https://server.test", ALFIE_MSGS: [] }) as string;
  assert.ok(!row(12).includes('id="alfOnline"') && row(12).includes("13 and over") && row(12).includes("Nothing you type leaves it"), "Alfie's row at 12");
  assert.ok(row(13).includes('id="alfOnline"'), "the switch is there at 13");
  // Tapping where the switch was (or any stale handler) opens nothing and records nothing.
  let sheet = 0;
  const store = fakeStorage();
  const toggle = lift(["privDefaultOn", "ownConsentOk", "alfieCfg", "alfieSaveCfg", "alfieOnline", "alfieSetOnline", "alfieToggleOnline"], [],
    "alfieToggleOnline", { RC, profile: { age: 12 }, localStorage: store, openAlfieOnlineSheet: () => { sheet++; }, render: () => {} });
  toggle();
  assert.equal(sheet, 0, "a 12-year-old is not offered a permission they cannot give");
  assert.equal(store.getItem("interun_alfie_v1"), null, "and nothing is recorded");
});
