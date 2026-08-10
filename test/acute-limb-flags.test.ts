import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { screenRedFlags } from "../src/safety/escalation.ts";
import type { RedFlag } from "../src/safety/escalation.ts";

/**
 * Acute limb-injury triage, added with the soft-tissue injury guide (brief §7).
 *
 * ⚠️ THE RULE THIS FILE EXISTS TO ENFORCE: the app triages, it never diagnoses. A checkbox cannot tell
 * a calf strain from a clot or an Achilles rupture from a bad knock, and a runner told "probably a
 * strain" stops seeking help. Every output names an URGENCY and a DESTINATION, and nothing else.
 */

const EMERGENCY: RedFlag[] = [
  "deformity-or-crack",
  "cold-blue-or-numb-limb",
  "severe-constant-pain-or-tense-swelling",
];
const URGENT: RedFlag[] = [
  "cannot-bear-weight-four-steps",
  "rapid-swelling-or-bruising",
  "pop-with-loss-of-push-off",
  "hot-swollen-one-sided-calf",
  "open-wound-or-fever",
];

test("⚠️ each acute-limb flag reaches its intended urgency", () => {
  for (const f of EMERGENCY) {
    const r = screenRedFlags([f]);
    assert.equal(r.urgency, "emergency", f + " is not an emergency");
    assert.deepEqual(r.flags[0]!.refer, ["emergency-services"], f + " does not route to emergency services");
  }
  for (const f of URGENT) {
    const r = screenRedFlags([f]);
    assert.equal(r.urgency, "urgent", f + " is not urgent");
    assert.ok(r.flags[0]!.refer.length > 0, f + " names nowhere to go");
    assert.ok(!r.flags[0]!.refer.includes("emergency-services"),
      f + " sends a same-day problem to emergency services, which cries wolf");
  }
});

test("⚠️ a swollen calf WITH chest symptoms escalates to emergency", () => {
  // ⚠️ THE ONE PAIRING THAT KILLS PEOPLE. A newly swollen warm calf is same-day on its own; the same
  // calf plus chest pain or breathlessness is now, because together that is how a clot in the leg
  // announces part of it has travelled. Encoded as a pair so neither flag overstates itself alone.
  const alone = screenRedFlags(["hot-swollen-one-sided-calf"]);
  assert.equal(alone.urgency, "urgent", "the calf flag alone should stay same-day");

  for (const partner of ["chest-pain", "severe-breathlessness", "collapse-or-fainting"] as RedFlag[]) {
    const paired = screenRedFlags(["hot-swollen-one-sided-calf", partner]);
    assert.equal(paired.urgency, "emergency", "calf + " + partner + " did not escalate");
    const calf = paired.flags.find((f) => f.flag === "hot-swollen-one-sided-calf")!;
    assert.equal(calf.urgency, "emergency", "the calf row itself still reads as same-day");
    assert.match(calf.guidance, /emergency/i, "the escalated calf row does not say to get emergency help");
  }
  // ⚠️ ORDER MUST NOT MATTER — a runner ticks boxes in whatever order they read them. And this has to be
  // asserted on the CALF ROW, not on the overall urgency: chest-pain is an emergency on its own, so
  // `urgency === "emergency"` for the pair passes whether the escalating-pair rule fires or not. Pinned
  // that way it was a test that could not fail.
  for (const order of [["chest-pain", "hot-swollen-one-sided-calf"],
    ["hot-swollen-one-sided-calf", "chest-pain"]] as RedFlag[][]) {
    const r = screenRedFlags(order);
    const calf = r.flags.find((f) => f.flag === "hot-swollen-one-sided-calf")!;
    assert.equal(calf.urgency, "emergency",
      "the calf row did not escalate when ticked " + (order[0] === "chest-pain" ? "second" : "first"));
    assert.equal(r.flags[0]!.urgency, "emergency", "an emergency row does not lead");
  }
});

test("⚠️ every flag definition names an urgency and a destination — swept, not listed", () => {
  // ⚠️ THE LISTS ABOVE ARE HAND-WRITTEN, so a NINTH acute-limb flag added later inherits none of their
  // invariants and nothing fails. This sweeps the definitions themselves out of the source, so a new flag
  // is covered the moment it exists.
  const src = readFileSync(new URL("../src/safety/escalation.ts", import.meta.url), "utf8");
  // FLAGS is a Record<RedFlag, FlagDef>, so each definition is a quoted key at one indent level. Scoped to
  // the object itself so a quoted key anywhere else in the file cannot enter the list.
  const from = src.indexOf("const FLAGS: Record<RedFlag, FlagDef> = {");
  assert.ok(from > 0, "FLAGS is no longer a Record — this scan needs rewriting, not relaxing");
  const obj = src.slice(from, src.indexOf("\n};", from));
  const ids = [...obj.matchAll(/^  "([a-z-]+)":\s*\{/gm)].map((m) => m[1]! as RedFlag);
  assert.ok(ids.length >= 18, "only " + ids.length + " flag definitions found — the scan is broken");
  for (const f of ids) {
    const r = screenRedFlags([f]);
    assert.equal(r.flags.length, 1, f + " does not resolve to exactly one flag");
    const a = r.flags[0]!;
    assert.ok(a.refer.length > 0, f + " names nowhere to go");
    assert.ok(a.guidance.length > 20, f + " has no real guidance");
    assert.ok(a.label.length > 2, f + " has no label");
    assert.ok(["emergency", "urgent", "professional", "monitor"].includes(a.urgency),
      f + " has an unexpected urgency: " + a.urgency);
    // An emergency must route to emergency services; nothing less urgent may cry wolf by doing so.
    assert.equal(a.refer.includes("emergency-services"), a.urgency === "emergency",
      f + " (" + a.urgency + ") and its emergency-services routing disagree");
  }
  // And the eight added by this work are all in that swept set, so the sweep really covers them.
  for (const f of [...EMERGENCY, ...URGENT]) assert.ok(ids.includes(f), f + " is not a flag definition");
});

test("⚠️ nothing the engine says names a diagnosis", () => {
  // ⚠️ THE WHOLE POINT. These words are what a runner would take as an answer, and the app has no
  // basis for any of them. Checked across every flag's own output AND the source, so a future flag
  // cannot smuggle one in.
  const banned = [
    "rupture", "ruptured", "fracture", "fractured", "broken bone", "dvt",
    "deep vein", "thrombosis", "clot", "compartment syndrome", "grade 1", "grade 2", "grade 3",
    "torn", "tear", "sprain grade", "achilles rupture",
  ];
  const all = [...EMERGENCY, ...URGENT];
  const r = screenRedFlags(all);
  const spoken = [r.headline, r.disclaimer, ...r.flags.flatMap((f) => [f.label, f.guidance])].join(" ").toLowerCase();
  for (const w of banned)
    assert.ok(!spoken.includes(w), "the engine told the runner they have a " + w);

  // And the same over the source, with comments stripped — the comments discuss these words on purpose.
  const src = readFileSync(new URL("../src/safety/escalation.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n");
  const strings = (src.match(/"[^"]{12,}"/g) || []).join(" ").toLowerCase();
  for (const w of banned)
    assert.ok(!strings.includes(w), "a flag definition names " + w + ", which is a diagnosis");
});

test("⚠️ every acute-limb flag says where to go, in plain language", () => {
  for (const f of [...EMERGENCY, ...URGENT]) {
    const a = screenRedFlags([f]).flags[0]!;
    assert.ok(a.guidance.length > 30, f + " has no real guidance");
    // A destination, not just a warning: emergency care, today, or a named professional.
    assert.match(a.guidance, /emergency|today|medical advice|assessment/i,
      f + " warns the runner without telling them where to go");
    assert.equal(a.category, "musculoskeletal", f + " is filed under the wrong category");
  }
});

test("⚠️ the wellbeing flags still work, and are still defined", () => {
  // ⚠️ THEY ARE NO LONGER RENDERED BY redflagsView(), which is what the brief asked for — but they are
  // reached by Ask Alfie's text screener, so deleting the definitions would remove the app's crisis
  // path. Verified before removing the checkboxes; this guard keeps them reachable.
  for (const f of ["self-harm-thoughts", "eating-disorder-concern", "mental-health-concern", "menstrual-disruption"] as RedFlag[]) {
    const r = screenRedFlags([f]);
    assert.ok(r.flags.length === 1, f + " no longer resolves");
    assert.ok(r.flags[0]!.refer.length > 0, f + " names nowhere to go");
  }
  assert.equal(screenRedFlags(["self-harm-thoughts"]).urgency, "emergency",
    "self-harm no longer escalates — the app's crisis path");
});
