import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * SUPPORT › TOOLS — the hub group, and the pace calculator inside it. Added 2026-08-15.
 *
 * ⚠️ THE GROUP GUARD EXISTS BECAUSE CLAUDE.md WAS WRONG. It promised that "a hub card named in no
 * group still appears, under More" — there is no More, and there never has been. viewSupport renders
 * Alfie, HUB_CHECKINS, HUB_LEARN, HUB_TOOLS and Safety, and nothing else. So a card added to
 * SUPPORT_HUB without naming a group ships as an unreachable page with nothing looking broken.
 *
 * The four ungrouped ids are deliberate and live on the Profile screen instead, so this asserts a
 * KNOWN exemption list rather than demanding every entry be grouped — and it fails the moment a new
 * id appears in neither place, which is the case it exists for.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** The ids listed in one of the group arrays in the built page. */
function group(name: string): string[] {
  const html = page();
  const m = html.match(new RegExp("const " + name + "\\s*=\\s*\\[([^\\]]*)\\]"));
  assert.ok(m, "no " + name + " in the built page");
  return [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
}

test("every Support hub card is reachable from the hub, or deliberately lives on Profile", () => {
  const html = page();
  const block = html.slice(html.indexOf("const SUPPORT_HUB"), html.indexOf("const HUB_CHECKINS"));
  const ids = [...block.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 10, "only found " + ids.length + " hub entries — the scan is broken");

  // Alfie is a bespoke featured card, not a group member; safety is a footer button with no entry.
  const grouped = new Set([...group("HUB_CHECKINS"), ...group("HUB_LEARN"), ...group("HUB_TOOLS"), "alfie"]);
  // ⚠️ These four are ON PURPOSE — they are rows on the Profile screen, where a thing about the
  // runner belongs. A code comment records that "why" was moved there deliberately.
  const onProfile = new Set(["why", "connect", "shoes", "data"]);

  const lost = ids.filter((id) => !grouped.has(id) && !onProfile.has(id));
  assert.deepEqual(lost, [], "hub cards in no group and not on Profile — they render nowhere: " + lost.join(", "));

  // And the Profile exemptions must actually BE reachable from Profile, or the exemption is just a
  // way of hiding the same bug behind a list.
  // ⚠️ "why" is reached as action "setup:why" — the Motivation row opens those questions inside the
  // setup wizard rather than the standalone support view, which is what the code comment beside
  // HUB_CHECKINS describes. Accept either spelling, or this guard rejects the deliberate design.
  for (const id of onProfile) {
    const reachable = html.includes('action: "' + id + '"') || html.includes('action: "setup:' + id + '"') || html.includes('data-hub="' + id + '"');
    assert.ok(reachable, id + " is exempted as a Profile row but nothing on Profile opens it");
  }
});

test("every hub card names an icon that exists", () => {
  const html = page();
  const block = html.slice(html.indexOf("const SUPPORT_HUB"), html.indexOf("const HUB_CHECKINS"));
  const icons = [...block.matchAll(/ic:\s*"([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(icons.length >= 10, "icon scan found only " + icons.length);
  const iconBlock = html.slice(html.indexOf("const ICON"), html.indexOf("const ICON") + 24000);
  for (const key of icons) {
    // ⚠️ hubCard does NO fallback — ICON[h.ic] on a missing key renders the string "undefined" into
    // the card, silently. ICON.search did not exist once before and drew an empty slot for months.
    assert.ok(new RegExp("(^|[\\s,{])" + key + ":").test(iconBlock), "ICON." + key + " does not exist, so its card draws undefined");
  }
});

test("the Tools group is rendered by viewSupport", () => {
  const html = page();
  const at = html.indexOf("function viewSupport(");
  const src = html.slice(at, at + 2600);
  assert.ok(/HUB_TOOLS\.map/.test(src), "HUB_TOOLS is declared but viewSupport never renders it");
  assert.ok(src.indexOf("HUB_TOOLS") > src.indexOf("HUB_LEARN"), "Tools should follow Learn on the hub");
});

test("a pace target is floored, never rounded", () => {
  const html = page();
  const at = html.indexOf("function paceCalcResultHtml(");
  assert.ok(at > 0, "paceCalcResultHtml is missing");
  const src = html.slice(at, at + 2200).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ SCOPE TO THE PACE BRANCH ALONE. Slicing to the end of the function swept in the distance
  // branch, whose Math.round(shown * 100) / 100 is correct — a distance is an outcome, not a target
  // somebody has to hold. This file's own project notes record the same trap three times over.
  const from = src.indexOf('kind === "pace"');
  const to = src.indexOf('kind === "time"');
  assert.ok(from > 0 && to > from, "could not isolate the pace branch");
  const pace = src.slice(from, to);
  // ⚠️ THE WHOLE POINT OF THE FEATURE. A half marathon in 1:45 needs 298.6 s/km; rounded to 4:59 and
  // held exactly it finishes in 1:45:08, so the calculator would hand back a pace that misses the
  // time it was asked for. Over a marathon the same half-second is 21 seconds.
  // ⚠️ ASSERT ON THE ASSIGNMENT, NOT ON THE PRESENCE OF "Math.floor". The first version of this guard
  // PASSED against a deliberately reintroduced Math.round, twice over: a bare /Math.floor/ was still
  // satisfied by the second variable, and the paired regex hunted for "Math.round(shown" when the code
  // reads "const shown = Math.round(...)" — the name is the target of the assignment, not its argument.
  // A guard that cannot fail is the thing this whole file exists to avoid.
  assert.ok(/const shown = Math\.floor\(/.test(pace), "the shown pace must be floored, or holding it misses the target time");
  assert.ok(/const other = Math\.floor\(/.test(pace), "the converted pace must be floored too — both are targets");
  assert.ok(!/const (shown|other) = Math\.round\(/.test(pace), "rounding a pace target makes it unachievable");
});

test("the calculator never writes to the profile or to storage", () => {
  const html = page();
  const names = ["paceCalcView", "paceCalcCompute", "paceCalcResultHtml", "pcKm", "pcPaceSecPerKm", "pcTotalSec"];
  for (const n of names) {
    const at = html.indexOf("function " + n + "(");
    assert.ok(at > 0, n + " is missing");
    const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
    const src = html.slice(at, rel > 0 ? at + 1 + rel : at + 6000).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // ⚠️ It offers miles while the app stays metric. That is only safe while nothing here escapes
    // into stored data or the engine — otherwise it quietly becomes the half-done units feature the
    // owner deliberately did not ask for.
    assert.ok(!/localStorage/.test(src), n + " must not touch localStorage");
    assert.ok(!/\bprofile\s*\./.test(src), n + " must not read or write the profile");
    assert.ok(!/\brender\(\)/.test(src), n + " must not call render() — it rebuilds the input being typed into");
  }
});
