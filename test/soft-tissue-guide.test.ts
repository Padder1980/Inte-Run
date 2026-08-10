import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The soft-tissue injury guide (Support › Injury & symptoms).
 *
 * ⚠️ THESE ARE THE CLINICAL INVARIANTS FROM THE BRIEF, not styling checks. Each one is a claim the page
 * must not make, or a gate it must not drop — the kind of thing that reads fine, ships, and is wrong.
 *
 * ✅ THE PRE-PRICE WORDING WAS REVIEWED AND APPROVED (owner, 2026-08-10). ⚠️ AND THE PRICE REWRITE LATER
 * THE SAME DAY IS NEWER THAN THAT SIGN-OFF. It is sourced — the updated brief carries its own clinical
 * re-audit reconciling the page with current NHS and British Red Cross PRICE/RICE guidance — but the same
 * brief still asks for a clinician to read the final page before release, so the first-aid wording below
 * has not itself been signed off. This is the condition the earlier note predicted: an approval covers the
 * wording as it stands and does not travel with a rewrite. These guards are what tell you a change was
 * material rather than editorial; a failure here means go back, not relax the assertion.
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
  const names = ["stiStopScreen", "stiPrice", "stiTimeline", "stiLoadRule", "stiGates", "stiFirstRun",
    "stiWhatNot", "stiPainRelief", "stiWhy", "redflagsView"];
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
  assert.match(g, /has not been shown to speed healing|has not shown it repairs tissue faster/i,
    "the cold-pack line does not say plainly that it has not been shown to speed healing");
  // ⚠️ AND THE PRICE BLOCK ITSELF MUST CARRY IT. Naming a framework the NHS recommends is the moment the
  // page is most likely to be read as endorsement, so the disclaimer sits inside the block rather than
  // somewhere further down the page.
  assert.match(fn("stiPrice"), /none of them has been shown to speed up tissue repair/i,
    "the PRICE block offers ice, compression and elevation without saying they are not proven to heal");
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

test("⚠️ PRICE is the opening framework, every letter is explained, and R is not immobility", () => {
  // ⚠️ THIS TEST REPLACED AN INVERTED ONE, ON INSTRUCTION (owner, 2026-08-10). Its first version FORBADE
  // the acronym — "no RICE, PRICE, POLICE or PEACE & LOVE" — on the reasoning that an acronym reads as a
  // protocol with uniform evidence behind it. That was wrong on the guidance: the NHS recommends PRICE
  // for the first two to three days, hospital physiotherapy departments publish it, and the British Red
  // Cross still teaches RICE. Deleting the assertion would have been the lazy fix; what it was actually
  // protecting — R is not bed rest, and none of I/C/E is sold as a cure — is asserted here instead.
  const g = guide();
  const price = fn("stiPrice");
  assert.match(g, /PRICE/, "PRICE is not presented at all");
  assert.match(fn("stiTimeline"), /Stop, then start PRICE/,
    "PRICE is not the opening stage of the timeline");
  // Every letter, named and explained.
  for (const [letter, word] of [["P", "Protect"], ["R", "Relative rest"], ["I", "Ice"],
    ["C", "Compression"], ["E", "Elevation"]] as Array<[string, string]>) {
    // ⚠️ ASSERTED ON THE SOURCE'S DATA, NOT ON RENDERED MARKUP. guide() extracts the builder's SOURCE, so
    // the letter reaches the page through r[0] and the string ">P<" never appears in it — a marker regex
    // would fail on a perfectly correct page, which is the kind of guard that gets deleted rather than fixed.
    assert.match(price, new RegExp('\\["' + letter + '",\\s*"' + word.split(",")[0]),
      "PRICE has no row for " + letter + " (" + word + ")");
    assert.match(price, /class="sti-pr-l"/, "the PRICE letters have no marker element");
  }
  // ⚠️ R IS THE LETTER THAT DOES HARM IF MISREAD, so it is explained twice: in PRICE and in the
  // what-not-to-do list, and both must say it is not immobility.
  assert.match(price, /Not complete immobility/i, "the R in PRICE is not qualified");
  assert.match(g, /Do not read the R in PRICE as complete bed rest/i,
    "nothing corrects the bed-rest reading of PRICE");
  assert.match(g, /relative rest/i, "the guide never says relative rest");
  const at = g.toLowerCase().indexOf("relative rest");
  assert.match(g.slice(at, at + 200), /[Nn]ot complete immobility|change what you do/i,
    "relative rest is used without being explained immediately");
  // ⚠️ AND IT IS FIRST AID, NOT A REHAB PLAN. Presenting the acronym as the whole recovery is the thing
  // the original ban was reaching for, and it is the claim that would actually mislead somebody.
  assert.match(price, /opening first aid, not the whole recovery/i,
    "PRICE is not bounded as first aid rather than a full plan");
});

test("⚠️ every ice threshold from the brief is on the page, exactly", () => {
  // ⚠️ THESE ARE CLINICAL THRESHOLDS, NOT ROUNDED-OFF COPY. 10–15 minutes per application, a hard cap of
  // 20, and at least two hours between. A guide that says "ice it for a bit" is not the same document.
  const g = guide();
  assert.match(g, /10–15 minutes/, "the per-application window is missing");
  // ⚠️ THE CAP, NOT THE NUMBER. Written with the phrasing in an OPTIONAL group this reduced to /20
  // minutes/, so softening "never longer than 20 minutes" to "up to 20 minutes" — which turns a hard
  // ceiling into a target, a change of clinical meaning — left it green while the failure message still
  // claimed to be checking the cap. Its two sibling thresholds were unconditional; this one was not.
  assert.match(g, /never (use it for )?longer than (<b>)?20 minutes/i, "the 20-minute cap is missing");
  assert.ok(!/up to 20 minutes|for 20 minutes/i.test(g),
    "the 20-minute ceiling is phrased as a target rather than a limit");
  assert.match(g, /at least two hours/i, "the gap between applications is missing");
  assert.match(g, /wrapped|wrap a cold pack|wrapped in a towel/i, "nothing says to wrap the pack");
  // The cap and the gap each appear where a runner would act on them, not only in the safety note.
  assert.match(fn("stiPrice"), /never longer than (<b>)?20 minutes/i, "the PRICE block omits the 20-minute cap");
  assert.match(fn("stiPrice"), /at least two hours/i, "the PRICE block omits the two-hour gap");
  assert.match(fn("stiTimeline"), /at least two hours/i,
    "the first-24-hours stage does not say how long to leave between cold packs");
  // Cold-pack safety, in full.
  for (const rule of ["straight on skin", "fall asleep", "circulation"])
    assert.ok(g.toLowerCase().includes(rule), "the cold-pack safety note omits: " + rule);
  // ⚠️ COMPRESSION CARRIES ITS CIRCULATION WARNING IN THE SAME BREATH AS THE INSTRUCTION. A wrap told
  // about on one screen and warned about on another is a wrap left on overnight.
  const comp = fn("stiPrice");
  const ci = comp.indexOf("Compression");
  assert.match(comp.slice(ci, ci + 420), /tingling|numbness|coldness|colour/i,
    "compression is offered without a circulation warning beside it");
  assert.match(comp.slice(ci, ci + 420), /[Ss]nug, never tight/,
    "compression does not say snug rather than tight");
  // Elevation is tied to resting and to swelling, which is the whole of its instruction.
  const ei = comp.indexOf("Elevation");
  assert.match(comp.slice(ei, ei + 200), /resting/i, "elevation is not tied to resting");
  assert.match(comp.slice(ei, ei + 200), /swell/i, "elevation is not tied to swelling");
});

test("⚠️ gentle movement is NOT gated on 72 hours", () => {
  // ⚠️ THE MOST LIKELY MISREADING OF A PRICE-LED PAGE. Naming a "first two to three days" framework
  // invites a runner to hold still until it is over, and the guidance says the opposite: protect briefly,
  // then move within comfort. So the first-24-hours stage has to carry the movement instruction, and say
  // out loud that waiting is not required.
  const tl = fn("stiTimeline");
  const first = tl.slice(tl.indexOf('when: "First 24 hours"'), tl.indexOf('when: "24–72 hours"'));
  assert.ok(first.length > 300, "the first-24-hours slice is wrong");
  assert.match(first, /do not have to wait 72 hours/i,
    "nothing tells the runner they can start moving before 72 hours");
  assert.match(first, /gently bend and straighten/i, "the first 24 hours prescribes no movement at all");
  // And from 24–72 hours the acronym becomes optional while movement becomes the progression.
  const second = tl.slice(tl.indexOf('when: "24–72 hours"'), tl.indexOf('when: "Days 3–7"'));
  assert.match(second, /optional/i, "ice, compression and elevation are not marked optional later on");
  assert.match(second, /movement is the important progression/i,
    "nothing says movement matters more than the ice and the wrap");
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
