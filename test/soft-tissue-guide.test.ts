import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The soft-tissue injury guide (Support › Injury & symptoms).
 *
 * ⚠️ THESE ARE THE CLINICAL INVARIANTS FROM THE BRIEF, not styling checks. Each one is a claim the page
 * must not make, or a gate it must not drop — the kind of thing that reads fine, ships, and is wrong.
 *
 * ✅ CLINICALLY REVIEWED AND APPROVED — the owner confirmed on 2026-08-10 that the wording has been through
 * clinical review and is cleared to ship. ⚠️ THAT APPROVAL IS OF THE WORDING AS IT STANDS, so it does not
 * travel with a rewrite: anything that materially changes the clinical meaning needs re-reviewing before it
 * ships, and these guards are what tell you a change was material rather than editorial.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** The guide's own markup, so a match elsewhere in a 2 MB page cannot pass or fail this by accident. */
function stripSeams(src: string): string {
  // Collapse JS string-concatenation seams ("…blood ' + 'thinners…") so a phrase split across two
  // source lines still reads as one phrase.
  return src.replace(/'\s*\+\s*'/g, "").replace(/"\s*\+\s*"/g, "");
}
/**
 * ⚠️ COMMENTS OUT. Every slice below is bounded by the NEXT `\nfunction `, which deliberately walks past
 * the following function's doc comment — and the comments in this area quote the very phrases these tests
 * require. So an assertion could be satisfied by prose explaining why the markup must say something,
 * while the markup said nothing. The sibling fuelling test file learned this the hard way.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
/** ONE builder, for assertions that must not be satisfiable by a different section of the page. */
function fn(name: string): string {
  const html = page();
  const s = html.indexOf("function " + name + "(");
  assert.ok(s > 0, "no function " + name);
  const e = html.indexOf("\nfunction ", s + 10);
  return stripSeams(stripComments(html.slice(s, e > s ? e : s + 9000)));
}
function guide(): string {
  const html = page();
  const at = html.indexOf("function redflagsView()");
  assert.ok(at > 0, "redflagsView is gone");
  // Every builder the view composes, plus the view itself.
  const names = ["stiStopScreen", "stiTimeline", "stiLoadRule", "stiGates", "stiFirstRun",
    "stiWhatNot", "stiPainRelief", "redflagsView"];
  return names.map((n) => {
    const s = html.indexOf("function " + n + "(");
    assert.ok(s > 0, "no function " + n);
    const e = html.indexOf("\nfunction ", s + 10);
    return html.slice(s, e > s ? e : s + 9000);
  }).map(stripComments).map(stripSeams).join("\n");
}


test("⚠️ the guide names no drug and no dose", () => {
  const g = guide();
  // ⚠️ NO DOSE, EVER. The app cannot know a runner's kidney function, other medicines or pregnancy.
  assert.ok(!/\b\d+\s?mg\b/i.test(g), "the guide states a dose in mg");
  // Brands are never appropriate; the generic names the brief uses (following NHS advice) are.
  assert.ok(!/\b(voltarol|nurofen|panadol|calpol|advil|tylenol)\b/i.test(g), "the guide names a brand of painkiller");
  assert.ok(!/\b(codeine|tramadol|naproxen|diclofenac)\b/i.test(g), "the guide names a prescription-strength painkiller");
  // ⚠️ Any drug that IS named must sit with the pharmacist caveat, never as a standalone recommendation.
  if (/\b(paracetamol|ibuprofen|anti-inflammator)/i.test(g)) {
    assert.match(g, /do not make the injury safe to run on/i,
      "a painkiller is named without saying it does not make the injury safe to run on");
    assert.match(g, /do not speed up tissue repair|do not speed tissue repair/i,
      "anti-inflammatories are named without correcting the belief that they speed repair");
  }
  assert.match(g, /pharmacist/i, "nothing points the runner at a pharmacist");
  // Who must ask first — the part a runner is least likely to know.
  for (const who of ["under 16", "pregnant", "blood thinners", "stomach ulcer", "kidney", "asthma"])
    assert.ok(g.toLowerCase().includes(who.toLowerCase()), "the pain-relief note omits: " + who);
});

test("⚠️ nothing is promised to speed healing", () => {
  const g = guide();
  // ⚠️ THE EASIEST UNTRUTH ON THIS PAGE. The 2024 BJSM critical review found no human evidence that
  // cooling limits secondary injury or speeds repair, yet "ice to heal faster" is what most consumer
  // advice says. Ice, compression, elevation, heat and massage are comfort measures here, never cures.
  assert.match(g, /has not been shown to speed healing/i,
    "the cold-pack line does not say plainly that it has not been shown to speed healing");
  assert.match(g, /not a proven cure/i, "heat/massage are not qualified as unproven");
  // No claim of the opposite shape anywhere.
  const claims = /(speeds? (up )?(healing|recovery|repair)|heals? faster|reduces? healing time|repairs? tissue faster)/gi;
  let m: RegExpExecArray | null;
  while ((m = claims.exec(g)) !== null) {
    const before = g.slice(Math.max(0, m.index - 70), m.index);
    assert.match(before, /not shown|not been shown|does not|do not|never|no human evidence/i,
      "an unqualified healing-speed claim at " + m.index + ": " + m[0]);
  }
});

test("⚠️ no acronym protocol, and relative rest is defined where it is used", () => {
  const g = guide();
  // RICE/PRICE/POLICE/PEACE & LOVE read as a protocol and hide how weak the evidence is for most of it.
  for (const a of ["RICE", "PRICE", "POLICE", "PEACE & LOVE", "PEACE AND LOVE"])
    assert.ok(!g.includes(a), "the guide presents " + a + " as a branded protocol");
  assert.match(g, /relative rest/i, "the guide never says relative rest");
  // ⚠️ Defined in the same breath — a runner meeting the phrase cold will read it as "rest".
  const at = g.toLowerCase().indexOf("relative rest");
  assert.match(g.slice(at, at + 160), /change what you do/i,
    "relative rest is used without being explained immediately");
});

test("⚠️ return to running is gated on function, never on a date", () => {
  const g = guide();
  assert.match(g, /Do not run because seven or fourteen days have passed/i,
    "the guide does not say plainly that a date is not clearance");
  assert.match(g, /review point, not automatic clearance/i, "two weeks is presented as clearance");
  // The gates themselves: function, strength, impact tolerance, and the next morning.
  // ⚠️ SCOPED TO stiGates, NOT THE WHOLE GUIDE. Searched across all eight builders, "controlled strength"
  // also appears in the Days 3–7 timeline stage, so deleting the actual GATE left the assertion green.
  const gates = fn("stiGates");
  for (const gate of ["without a limp", "swelling back", "controlled strength", "hops", "next morning"])
    assert.ok(gates.toLowerCase().includes(gate.toLowerCase()), "a return-to-run gate is missing: " + gate);
  // ⚠️ "Pain-free" must never be the only gate. It may appear (cross-training), but function must too.
  assert.match(g, /same or better the next morning/i,
    "nothing checks how the leg is the next morning, which is the honest gate");
});

test("⚠️ the stop screen is always visible and is not a second page", () => {
  const html = page();
  const view = html.slice(html.indexOf("function redflagsView()"), html.indexOf("function redflagsView()") + 2000);
  assert.match(view, /stiStopScreen\(\)/, "the stop screen is not on the page");
  // ⚠️ NOT COLLAPSIBLE. Hiding danger signs behind a tap is how somebody with a cold blue foot reads a
  // recovery timeline instead. The only <details> on the page is the pain-relief note.
  const stop = html.slice(html.indexOf("function stiStopScreen("), html.indexOf("function stiTimeline("));
  assert.ok(!/<details/.test(stop), "the stop screen is collapsible");
  // And it must not send the runner somewhere else to be screened.
  assert.ok(!/check my symptoms|data-hub=|supportDetail/i.test(stop),
    "the stop screen links out to a second symptom screen");
  // Both urgency levels present, as words.
  assert.match(stop, /Emergency/, "no emergency band");
  assert.match(stop, /Urgent/, "no urgent band");
});

test("⚠️ urgency is never carried by colour alone", () => {
  const g = guide();
  // The load rule must say the words, not just tint three rows.
  for (const w of ["Green", "Amber", "Red"])
    assert.ok(g.includes('"' + w + '"') || g.includes(">" + w) || g.includes(w + '"'),
      "the load rule does not use the word " + w);
  // Each row states what to DO, so the colour is never the instruction.
  for (const doIt of ["Carry on", "Repeat the easier stage", "Stop and get assessed"])
    assert.ok(g.includes(doIt), "a load-rule row has no action: " + doIt);
});

test("⚠️ the guide does not diagnose, and does not touch the training plan", () => {
  const g = guide();
  for (const d of ["rupture", "fracture", "thrombosis", "DVT", "compartment syndrome", "grade 1", "grade 2", "grade 3"])
    assert.ok(!g.toLowerCase().includes(d.toLowerCase()), "the guide names a diagnosis: " + d);
  assert.match(g, /not a diagnosis/i, "the guide never says it is not a diagnosis");
  // ⚠️ A STATIC GUIDE MUST NOT REWRITE A PLAN. The brief is explicit: a later feature may offer an
  // explicit, reversible preview, but nothing here may silently change what the runner is asked to run.
  for (const mutate of ["adoptPlan", "recompute(", "applyProfile", "saveRuns(", "state.dayOverride"])
    assert.ok(!g.includes(mutate), "the guide mutates the plan via " + mutate);
});

test("⚠️ the warm-up discomfort line says the same thing everywhere", () => {
  // ⚠️ THREE PLACES SAID IT, NOT TWO. The brief found two "usually fine to run through" strings; a
  // third said "soreness that eases as you warm up is usually fine" — the same claim in other words,
  // and it contradicted src/adapt/injury.ts, which treats pain while running as a stop signal.
  const html = page();
  assert.ok(!/usually fine to run through/i.test(html), "the old contradictory claim is still in the page");
  assert.ok(!/eases as you warm up is usually fine/i.test(html), "the reworded version of the same claim survives");
  const agreed = (html.match(/Mild awareness that stays stable/g) || []).length;
  assert.equal(agreed, 3, "the agreed wording should appear at all three former sites, found " + agreed);
  assert.match(html, /sits sharply on a bone is a stop signal/i, "the stop half of the agreed wording is missing");
});
