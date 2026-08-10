import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fuellingFor } from "../src/science/fuelling.ts";
import { screenRedS } from "../src/safety/red-s.ts";
import type { RedSIndicator } from "../src/safety/red-s.ts";

/**
 * The fuelling, hydration and recovery guide (Support › Fuelling & energy).
 *
 * ⚠️ THESE ARE THE ACCEPTANCE CRITERIA FROM THE BRIEF, not styling checks. Each one is a claim the page
 * must not make, a pairing it must not break, or an input the engine must not be deaf to — the kind of
 * thing that reads fine, ships, and is wrong. Two of them are genuinely safety-critical: sodium must
 * never be presented as protection against over-drinking, and a "low" under-fuelling result must never
 * read as clearance.
 *
 * ⚠️ THE PAGE IS NOT CLEARED FOR PUBLIC RELEASE until a UK-registered sports dietitian has reviewed the
 * nutritional wording. Nothing in this file substitutes for that.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const engineSrc = () => readFileSync(new URL("../src/science/fuelling.ts", import.meta.url), "utf8");

/** Collapse JS string-concatenation seams so a phrase split across two source lines reads as one. */
function stripSeams(src: string): string {
  return src.replace(/'\s*\+\s*'/g, "").replace(/"\s*\+\s*"/g, "");
}
/**
 * ⚠️ COMMENTS OUT, IN EVERY SCOPE, AND IT CUTS BOTH WAYS. The comments in this area exist to explain
 * why a phrase is forbidden, so they quote it — and the sodium guard duly reported the engine's own
 * warning-about-the-old-wording as the old wording. That is the familiar half of the trap. The half
 * that matters more is the reverse: the guide's file header restates the product message, so a test
 * asserting the page says "eat enough every day" could be satisfied by a comment while the markup said
 * nothing at all. Both directions are fixed by never letting a comment into a scope.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
/**
 * One function's body, bounded by the next TOP-LEVEL declaration.
 * ⚠️ NOT a fixed character window. fgRaces is several thousand characters and fgSessions longer; a
 * window guessed at 8000 either truncates a card (so a missing pairing passes) or runs into the next
 * function (so a phrase from somewhere else satisfies the assertion). Both failure modes are silent.
 */
function fn(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
  assert.ok(rel > 0, name + " has no terminator — the extractor is wrong, not the app");
  return stripSeams(stripComments(html.slice(at, at + 1 + rel)));
}
/** Every builder the guide composes, plus the view. */
const BUILDERS = ["fgDet", "fgBda", "fgSec", "fgNav", "fgLadder", "fgSessions", "fgCarbAmounts",
  "fgRaces", "fgMeals", "fgTiming", "fgFluids", "fgRecovery", "fgGut", "fgEnergyCheck", "fgMistakes",
  "redsView"];
const guide = () => BUILDERS.map(fn).join("\n");

/**
 * The app's own script block, excluding the bundled RC engine — for "is this in the UI?" questions.
 * ⚠️ COMMENTS STRIPPED. The first version of this guard tripped on its own neighbouring explanation:
 * fgEnergyCheck's doc comment names estimateEnergyAvailability in order to say it must never be wired
 * up, so scanning the raw block reported the exact defect the comment exists to prevent. Fifth time
 * this project's guards have caught their own prose.
 */
function appScript(): string {
  const html = page();
  const marker = html.indexOf("function redsView(");
  assert.ok(marker > 0, "redsView is gone");
  const open = html.lastIndexOf("<script>", marker);
  const close = html.indexOf("</script>", marker);
  assert.ok(open > 0 && close > marker);
  const src = html.slice(open, close);
  assert.ok(!src.includes("var RC="), "the slice swept up the bundled engine, which legitimately exports it");
  // ⚠️ BLOCK COMMENTS ONLY WHERE ONE STARTS A LINE. A bare /\* ... \*/ sweep is not safe over this file:
  // `accept="image/*"` inside viewSetup's markup is an unbalanced comment opener mid-line, so the regex
  // opened there and closed at the next real terminator — measured, it deleted 10,382 characters of LIVE
  // code out of the middle of the profile setup form. A guard with a ten-kilobyte blind spot reports
  // clean for anything hiding in it. Every real comment in this file begins its own line.
  const stripped = src.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ ASSERTED ON A LANDMARK FROM INSIDE THE OLD BLIND WINDOW, not on how much was removed. A length
  // threshold here is the taste-based-number trap: this file is 276 KB of legitimate comments, so any
  // ceiling loose enough to pass is far too loose to catch a 10 KB bite. `id="s_easypace"` is live markup
  // that sat inside the deleted span, so its presence is direct evidence the bug has not returned.
  for (const landmark of ['id="s_easypace"', 'id="s_startdate"', "function viewSetup("])
    assert.ok(stripped.includes(landmark),
      "the comment stripper swallowed live code (" + landmark + ") — the blind-window bug is back");
  return stripped;
}

test("⚠️ the route, the position and the card are preserved — nothing new was invented", () => {
  const html = page();
  // The brief's whole navigational constraint: same id, same route, same orange drop, same group.
  assert.match(html, /if \(id === "reds"\) return back \+ redsView\(\);/,
    "the reds route no longer resolves to the fuelling view");
  const hub = html.slice(html.indexOf("const SUPPORT_HUB = ["), html.indexOf("];", html.indexOf("const SUPPORT_HUB = [")));
  const entry = hub.split("\n").find((l) => l.includes('id: "reds"'));
  assert.ok(entry, "the reds hub entry has gone");
  assert.match(entry!, /ic: "fuel"/, "the orange drop icon changed");
  assert.match(entry!, /c: "var\(--peak\)"/, "the category colour changed");
  assert.match(entry!, /t: "Fuelling & energy"/, "the title changed");
  assert.match(entry!, /d: "Food, fluids and recovery for every run\."/, "the agreed description is not on the card");
  // ⚠️ NO BADGE. interactive:true renders a "CHECK-IN" chip, and this destination is a guide whose
  // checklist is one collapsed section — a badge promising a form is a small lie on the card.
  assert.match(entry!, /interactive: false/, "the card still advertises itself as a check-in");
  // ⚠️ AND NO SECOND ROUTE. The brief forbids a new hub item and a duplicate under Learn; both would
  // split one question across two destinations, each of which then looks like the whole answer.
  const ids = [...hub.matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(ids.filter((i) => i === "reds").length, 1, "there are two reds cards");
  for (const invented of ["fuelling", "fuel", "nutrition", "energy", "food"])
    assert.ok(!ids.includes(invented), "a second fuelling destination exists: " + invented);
  // Learn still holds exactly the three it held.
  assert.match(html, /"understand", "strength", "guides"/, "the Learn group changed");
  assert.match(html, /id="supBack"/, "there is no back button out of the guide");
});

test("⚠️ search finds the page from the words a runner actually types", () => {
  const html = page();
  const at = html.indexOf("const SUPPORT_HUB = [");
  const hub = html.slice(at, html.indexOf("];", at));
  const entry = hub.split("\n").find((l) => l.includes('id: "reds"'))!;
  const kwLine = hub.split("\n")[hub.split("\n").indexOf(entry) + 1] || "";
  const hay = (entry + " " + kwLine).toLowerCase();
  // The brief's own list, verbatim.
  const terms = ["food", "meal", "breakfast", "before run", "after run", "carb", "protein", "drink",
    "hydration", "sodium", "gel", "5k", "10k", "half marathon", "marathon", "recovery", "sleep",
    "red-s", "under-fuelling", "stomach"];
  for (const t of terms) assert.ok(hay.includes(t), "search cannot find the guide from: " + t);
  // ⚠️ And the index must actually read the keyword field, or the list above is decoration.
  assert.match(fn("supportSearch"), /h\.kw/, "supportSearch does not index the keyword field");
});

test("⚠️ the duration boundaries are where the copy says they are", () => {
  const at = (durationMinutes: number) =>
    fuellingFor({ durationMinutes, raceDistance: "marathon", sessionType: "long" });
  // Below the threshold: no mid-run fuel, and told so in words rather than by omission.
  for (const m of [45, 60, 74]) {
    assert.equal(at(m).needed, false, m + " min should need no mid-run fuel");
    assert.equal(at(m).perHour, null);
  }
  // ⚠️ 75 IS THE ENGINE'S GATE AND THE COPY MUST AGREE WITH IT. The brief's prose says "under about an
  // hour", which is the right consumer framing but a whole 15 minutes away from where the code
  // switches over — so the card's wording names 75 and the ladder carries the 60–90 rung separately.
  // Copy that contradicts the threshold beside it is how a runner stops believing either.
  assert.equal(at(75).needed, true, "75 min is the gate — it must be on the fuelled side of it");
  assert.deepEqual(at(90).perHour, { min: 30, max: 60 });
  assert.deepEqual(at(150).perHour, { min: 60, max: 90 }, "150 min is the top tier's boundary");
  assert.deepEqual(at(149).perHour, { min: 30, max: 60 }, "the tier must not step up early");
  const g = guide();
  assert.match(g, /75[–-]90 minutes|75 minutes/,
    "the guide never names the 75-minute mark the engine actually uses");
  // ⚠️ THE RUNGS ARE THE ENGINE'S BOUNDARIES. The brief's ladder was 60–90 / 90–150; the engine gates at
  // 75, so those rungs told a runner "optional" for a 80-minute run that the session card prescribes for.
  for (const rung of ["Under 60 min", "60–75 min", "75–150 min", "Over 150 min"])
    assert.ok(g.includes(rung), "the duration ladder is missing the rung: " + rung);
  // And the ladder's own prescribing threshold IS the engine's, derived rather than eyeballed.
  // ⚠️ PER RUNG, NOT A CHARACTER WINDOW. The first version sliced 200 characters from a rung label and
  // reached into the NEXT rung's text, so it found the 30–60 band attached to the 60–75 rung and reported
  // the ladder prescribing at 60. Third time a window has crossed the boundary it was meant to respect.
  const lad = fn("fgLadder");
  const rungs = [...lad.matchAll(/\["(\d+)[–-](\d+) min",\s*\d+,\s*"([^"]*)"\]/g)]
    .map((m) => ({ from: Number(m[1]), to: Number(m[2]), text: m[3]! }));
  assert.ok(rungs.length >= 2, "only " + rungs.length + " ranged rungs parsed — the ladder scan is broken");
  const band = rungs.find((r) => r.text.includes("30–60 g"));
  assert.ok(band, "no ladder rung carries the 30–60 g band");
  assert.equal(band!.from, 75,
    "the ladder starts prescribing at " + band!.from + " min; the engine gates at 75");
});

test("⚠️ 120 g/h is never prescribed, anywhere", () => {
  // ⚠️ ONE CROSSOVER TRIAL IN EIGHT ELITE MEN, which found more oxidation AND the worst peak nausea,
  // fullness and cramping of the three rates tested. It is a research strategy, and as default public
  // guidance it is an instruction to make yourself ill on the biggest day of your year.
  for (let m = 75; m <= 300; m += 5)
    for (const race of [true, false])
      for (const d of ["5k", "10k", "half", "marathon"] as const) {
        const f = fuellingFor({ durationMinutes: m, raceDistance: d, sessionType: "long", hasRacePaceWork: race });
        assert.ok((f.perHour?.max ?? 0) <= 90, m + "min/" + d + " prescribes " + f.perHour?.max + " g/h");
      }
  const g = guide();
  // ⚠️ TIED TO A RATE, NOT A BARE DIGIT STRING. `!/120/` over 30 KB of prose is satisfied by luck and
  // would fire on an unrelated "120" — it constrains nothing and breaks on the wrong thing.
  assert.ok(!/\b1[0-9]{2}\s*g(\b|rams)/.test(g), "the guide names a three-figure gram-per-hour target");
  assert.ok(!/\b120\b[^.]{0,40}(g\b|gram|an hour)/i.test(g), "the guide points at a 120 g/h target");
});

test("⚠️ every carbohydrate rate is paired with duration AND gut practice", () => {
  // ⚠️ A NUMBER ON ITS OWN IS AN INSTRUCTION TO TRY IT. "60–90 g an hour" with no duration beside it
  // reads as a target for any run, and with no practice instruction beside it reads as a target for
  // Sunday. The pairing is the safety, not the number.
  //
  // ⚠️ CHECKED PER CARD, NOT IN A CHARACTER WINDOW — and this is the second version. The first used a
  // ±380-character window and PASSED with the practice clause deliberately deleted from the long-run
  // card, because the card below it happened to say "practise" close enough to satisfy the match. A
  // window does not respect the boundary a runner reads: they open one card and act on that card.
  const rate = /\d{2}–\d{2} g/;
  const duration = /hour|minute|min\b|long run|race|2\.5 hours/i;
  const practice = /practis|build|gradual|rehears|start(ing)? (lower|early)|lower end/i;
  const prescribing = ["fgSessions", "fgRaces", "fgLadder"];
  let checked = 0;
  for (const builder of prescribing) {
    // Cards are object literals ({ t: "..." }) and ladder rungs are arrays (["Under 60 min", ...]);
    // splitting on the opener gives one chunk per thing the runner actually opens or reads as a unit.
    const body = fn(builder);
    const chunks = body.split(/\{ t: "|\n    \["/).slice(1);
    assert.ok(chunks.length >= 3, builder + " split into " + chunks.length + " chunks — the splitter is wrong");
    for (const c of chunks) {
      if (!rate.test(c)) continue;
      checked++;
      const label = c.slice(0, 40).replace(/\s+/g, " ");
      assert.match(c, duration, "a carbohydrate rate with no duration in its own card: " + label);
      assert.match(c, practice, "a carbohydrate rate with no gut-practice instruction in its own card: " + label);
    }
  }
  assert.ok(checked >= 5, "only " + checked + " prescribing cards name a rate — the scan is broken");
  // The "what does 30 g look like" block is reference, not prescription — so what it must carry is the
  // label caveat and the fact that high rates are built up to, rather than a per-bullet instruction.
  const amounts = fn("fgCarbAmounts");
  assert.match(amounts, /check the label; products vary/i, "the equivalence block has no label caveat");
  assert.match(amounts, /practised over time/i, "the equivalence block presents the top rate as ready to use");
  // The engine's own upper tier, which is where the number is most likely to be acted on.
  const big = fuellingFor({ durationMinutes: 180, raceDistance: "marathon", sessionType: "long" });
  assert.ok(big.points.some((p) => /fructose/i.test(p) && /(glucose|maltodextrin)/i.test(p)),
    "the 60–90 tier does not name the two sugars it requires");
  assert.ok(big.points.some((p) => /build (it )?up|gradual/i.test(p)),
    "the 60–90 tier does not tell the runner to build up to it");
});

test("⚠️ SAFETY: sodium is never offered as protection against over-drinking", () => {
  // ⚠️ THE ONE SENTENCE IN THIS AREA THAT COULD KILL SOMEBODY. Exercise-associated hyponatraemia is
  // driven by drinking beyond your losses, and a sports drink can be over-consumed exactly as water
  // can. The app's old copy said to include sodium "rather than plain water", which puts the danger on
  // the water and implies the sodium is the remedy. It is not: volume is the risk.
  const html = page();
  const scopes: Array<[string, string]> = [
    ["the guide", guide()],
    ["the session-card engine", stripComments(engineSrc())],
    ["the training guide article", stripComments(html.slice(html.indexOf('t: "Fuelling and hydration"'), html.indexOf('t: "Recovery, sleep and rest days"')))],
    ["Alfie", stripComments(html.slice(html.indexOf('k: ["hydrat"'), html.indexOf('k: ["hydrat"') + 1400))],
    ["Alfie in the heat", stripComments(html.slice(html.indexOf('k: ["heat", "hot"'), html.indexOf('k: ["cold", "winter"')))],
  ];
  const caveat = /over-?drink|excess fluid|beyond your losses|more fluid than|heavier than you started|does not make excess/i;
  for (const [where, src] of scopes) {
    assert.ok(src.length > 100, "the " + where + " scope is empty — the slice is wrong");
    const hits = [...stripSeams(src).matchAll(/sodium/gi)];
    assert.ok(hits.length > 0, "no sodium guidance found in " + where);
    for (const h of hits) {
      const w = stripSeams(src).slice(Math.max(0, h.index - 400), h.index + 500);
      assert.match(w, caveat, "sodium named in " + where + " with no over-drinking warning beside it");
    }
    // And never the old framing, which contrasted sodium WITH water.
    assert.ok(!/rather than plain water|not just water/i.test(src),
      where + " still contrasts sodium with plain water, which implies sodium is the protection");
    assert.ok(!/sodium[^.]{0,60}\b(prevents|protects against|stops)\b/i.test(src),
      where + " claims sodium prevents something");
  }
  // The emergency signs are stated plainly, and the instruction is to STOP drinking.
  const fl = fn("fgFluids");
  for (const sign of ["Confusion", "headache", "vomiting", "seizure", "collapse", "swelling", "breathlessness"])
    assert.ok(fl.toLowerCase().includes(sign.toLowerCase()), "the fluid emergency omits: " + sign);
  assert.match(fl, /Stop drinking and get emergency help/i, "it does not say to stop drinking");
  assert.ok(!/salt tablets? (will|can) (help|fix)/i.test(fl), "it suggests salt tablets as a fix");
});

test("⚠️ short races do not imply a gel or a carb load is necessary", () => {
  const r = fn("fgRaces");
  const five = r.slice(r.indexOf('t: "5K"'), r.indexOf('t: "10K"'));
  const ten = r.slice(r.indexOf('t: "10K"'), r.indexOf('t: "Half marathon"'));
  assert.ok(five.length > 200 && ten.length > 200, "the race-card slices are wrong");
  assert.match(five, /No carbohydrate load is needed/i, "the 5K does not say loading is unnecessary");
  assert.match(five, /no fuel is needed/i, "the 5K does not say fuel is unnecessary");
  assert.match(ten, /most runners do not need a gel/i, "the 10K implies a gel is expected");
  assert.match(ten, /optional/i, "the 10K does not mark mid-race carbohydrate as optional");
  assert.match(ten, /No formal loading is needed/i, "the 10K does not say loading is unnecessary");
  // ⚠️ Distance is the way in; expected TIME is the answer. A 2:45 half and a 1:20 half are different
  // problems, and the card labelled by distance has to say so before anyone acts on it.
  assert.match(r, /expected time matters more/i, "the race section does not say time beats distance");
  // The marathon: the golden rule, and loading kept behind a disclosure with the risk named.
  const mar = r.slice(r.indexOf('t: "Marathon"'));
  assert.match(mar, /nothing new on race morning/i, "the marathon card drops the golden rule");
  assert.match(mar, /10–12 g of carbohydrate per kg/i, "the loading figure is missing");
  assert.match(mar, /specialist target/i, "loading is not marked as specialist");
  assert.match(mar, /disordered eating/i,
    "the loading disclosure does not warn who it is inappropriate for");
});

test("⚠️ the under-fuelling screen can hear every input the engine supports", () => {
  // ⚠️ FOUR OF THE TWELVE HAD NO CHECKBOX — preoccupation with food, libido, poor recovery and gut
  // discomfort — so screenRedS was structurally unable to see them. A runner could tick everything on
  // the screen, describe none of what was happening to them, and be told "no strong signs".
  const src = readFileSync(new URL("../src/safety/red-s.ts", import.meta.url), "utf8");
  const uAt = src.indexOf("export type RedSIndicator");
  const union = [...src.slice(uAt, src.indexOf(";", uAt)).matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!);
  assert.equal(union.length, 12, "the indicator union changed size — re-check the checkboxes");

  const html = page();
  const oAt = html.indexOf("const REDS_OPTS = {");
  const opts = html.slice(oAt, html.indexOf("};", oAt));
  const keys = [...opts.matchAll(/"([a-z-]+)":/g)].map((m) => m[1]!);
  assert.deepEqual([...keys].sort(), [...union].sort(),
    "the rendered options and the engine's union have drifted apart");
  // ⚠️ AND EVERY KEY MUST SCORE. A typo in a key renders a perfectly normal-looking checkbox that the
  // engine silently ignores, so the runner's answer is discarded and the result reads reassuringly.
  for (const k of keys) {
    const r = screenRedS([k as RedSIndicator]);
    assert.ok(r.score >= 1, k + " scores nothing — it is not a real indicator");
  }
});

test("⚠️ SAFETY: a low under-fuelling result is not clearance", () => {
  // ⚠️ SELF-REPORTED SCREENS HAVE IMPERFECT SENSITIVITY. Somebody who has not noticed a symptom — or
  // has stopped noticing — reads "no strong signs" as a clean bill of health and stops asking.
  const low = screenRedS([]);
  assert.equal(low.risk, "low");
  assert.match(low.message, /cannot rule it out/i, "a low result reads as clearance");
  assert.match(low.message, /recheck/i, "a low result does not say when to ask again");
  assert.match(screenRedS(["gi-discomfort"]).message, /cannot rule it out/i,
    "one weak indicator is still a low result and still needs the caveat");
  // Elevated results refer, and never diagnose.
  // ⚠️ NOT "the words 'not a diagnosis' appear somewhere" — `disclaimer` is the NOT_A_DIAGNOSIS constant
  // on every result, so that assertion was satisfied by a constant whatever the message said. What has
  // to hold is that the MESSAGE and GUIDANCE name a destination and never name a condition.
  for (const set of [["bone-stress-history"], ["menstrual-disruption", "unintentional-weight-loss"],
    ["preoccupation-with-food-or-weight"]] as RedSIndicator[][]) {
    const r = screenRedS(set);
    assert.ok(r.refer.length > 0, set.join("+") + ": an elevated result names nowhere to go");
    assert.notEqual(r.risk, "low", set.join("+") + " should not come back low");
    const spoken = (r.message + " " + r.guidance.join(" ")).toLowerCase();
    for (const dx of ["red-s", "reds", "relative energy deficiency", "anorexia", "bulimia",
      "eating disorder", "osteoporosis", "amenorrhoea", "hypogonadism"])
      assert.ok(!spoken.includes(dx), set.join("+") + " named a condition: " + dx);
    assert.match(r.disclaimer, /not a diagnosis/i);
  }
  // ⚠️ AND DISTRESS ABOUT FOOD, ALONE, MUST REFER. It got a checkbox for the first time in this change
  // and was NOT in the engine's STRONG set, so one tick came back low with an empty refer list — the app
  // answering the most eating-disorder-adjacent question on the screen with reassurance, while its own
  // escalation module sends the same disclosure to a GP, a dietitian and a psychologist.
  const pre = screenRedS(["preoccupation-with-food-or-weight"]);
  assert.notEqual(pre.risk, "low", "distress about food alone is treated as nothing");
  assert.ok(pre.refer.includes("psychologist") && pre.refer.includes("gp"),
    "distress about food refers to a dietitian only: " + JSON.stringify(pre.refer));
  assert.match(screenRedS(["menstrual-disruption", "unintentional-weight-loss"]).message,
    /avoid adding training or restricting food/i,
    "the high result does not say what not to do while waiting for a review");
  // ⚠️ AND THE UI MUST NOT HEADLINE A RISK GRADE. "Risk: high" is a verdict the app is not entitled to
  // give and the first thing the eye lands on.
  // ⚠️ THE INVARIANT IS "THE BAND CARRIES THE ENGINE'S MESSAGE", not "this one spelling is absent".
  // Pinned as a missing string, `'Risk: ' + r.risk` and `"Risk level: " + r.risk` both slipped past.
  assert.match(fn("runReds"), /renderResult\("redsRes",[^;]*r\.message/,
    "the result band no longer carries the engine's own message");
  assert.ok(!/Risk\s*(level)?\s*:/i.test(fn("runReds")), "the result is headlined with a risk grade");
  assert.ok(!/not worth worrying|nothing to worry/i.test(fn("runReds")),
    "the UI reassures the runner in its own words rather than the engine's");
  assert.match(fn("runReds"), /if \(!picks\.length\)/,
    "the result renders before the runner has ticked anything");
  const chk = fn("fgEnergyCheck");
  assert.match(chk, /cannot rule under-fuelling\s*out/i, "the section itself does not carry the caveat");
  assert.match(chk, /not a diagnosis/i, "the section does not say it is not a diagnosis");
  assert.match(chk, /dietitian/i, "the section names nobody to go to");
  assert.ok(!/not eating more|eat less/i.test(chk), "the section strays into eat-less language");
});

test("⚠️ no calculator, no score, no stored answer", () => {
  // ⚠️ estimateEnergyAvailability IS KEPT IN THE ENGINE AND MUST NOT REACH THE UI. Three imprecise
  // inputs divided into each other produce a figure whose precision is entirely false, and the 2023 IOC
  // consensus is explicit that the thresholds are not diagnostic cut-offs for free-living people. A
  // number on screen becomes a number to eat down to.
  const app = appScript();
  assert.ok(!app.includes("estimateEnergyAvailability"),
    "the energy-availability calculator is wired into the app");
  for (const banned of ["intakeKcal", "fatFreeMass", "kcal/kg"])
    assert.ok(!app.includes(banned), "the app collects " + banned);
  const g = guide();
  // The sweat-rate method is a method, not a form: no weight input, and nothing kept.
  const sw = fn("fgFluids");
  assert.ok(!/<input/.test(sw), "the fluid section has grown an input field");
  assert.match(sw, /does not ask for or keep any of these numbers/i,
    "the sweat-rate method does not say the app keeps nothing");
  assert.match(sw, /estimate/i, "the sweat-rate method is not labelled an estimate");
  assert.match(sw, /Not for children, in pregnancy/i, "the sweat-rate method omits who it is not for");
  // The guide never writes anything, and never touches the plan.
  for (const w of ["localStorage", "adoptPlan", "recompute(", "applyProfile", "saveRuns(", "state.dayOverride"])
    assert.ok(!g.includes(w), "the guide reaches for " + w);
});

test("⚠️ no calorie target, no weight-loss framing, no moral food labels", () => {
  const g = guide();
  // ⚠️ THIS PAGE SITS ON THE SAME ROUTE AS A LOW-ENERGY-AVAILABILITY SCREEN. Anything that could be
  // read as a target to eat down to contradicts the one genuinely safety-critical thing here.
  for (const banned of ["calorie", "kcal", "deficit", "burn off", "burning off", "lose weight",
    "weight loss", "slimming", "low-fat diet", "clean eating", "guilt-free", "cheat meal", "cheat day",
    "bad food", "superfood", "detox", "empty calories"])
    assert.ok(!g.toLowerCase().includes(banned), "the guide uses diet language: " + banned);
  // ⚠️ "weight" IS ALLOWED, BUT ONLY WHERE IT MEANS SOMETHING CLINICAL OR PHYSICAL — an unintentional
  // loss, a symptom to report, a body mass in the loading figure, or the fluid you carry off a run.
  // Anywhere else on this page it is a goal, and a goal is what this page must never set.
  for (const m of [...g.matchAll(/weight/gi)]) {
    const w = g.slice(Math.max(0, m.index - 130), m.index + 130);
    // ⚠️ "weight-loss plan" ON ITS OWN IS NOT AN ALLOW-LIST ENTRY — it admitted the injected sentence
    // "A sensible weight-loss plan alongside your training can help you get faster". The only permitted
    // use is the page REFUSING that reading of itself, so the allow-list requires the refusal verbatim.
    assert.match(w, /without trying|distressed about food|Do not use this page as a weight-loss plan|per kg|heavier than you started|kilogram|unexplained/i,
      "an unexplained use of the word weight: " + w.replace(/\s+/g, " ").slice(0, 120));
  }
  // And the page says out loud that it is not a weight-loss plan.
  assert.match(g, /Do not use this page as a weight-loss plan/i,
    "the guide does not refuse the weight-loss reading of itself");
  assert.match(g, /Eat enough every day/i, "the product message is missing");
});

test("⚠️ food-first, with a plant version of everything", () => {
  const g = guide();
  // ⚠️ ORDINARY FOOD BEFORE SPORTS PRODUCTS. Gels and drinks are concentrated and portable, not
  // nutritionally superior, and a guide that opens with them teaches the opposite.
  const meals = fn("fgMeals");
  for (const food of ["oats", "bread", "rice", "pasta", "potato", "banana", "yoghurt", "eggs", "beans", "lentils"])
    assert.ok(meals.toLowerCase().includes(food), "the everyday food examples omit: " + food);
  for (const plant of ["tofu", "tempeh", "soya", "lentils", "beans", "falafel", "hummus"])
    assert.ok(meals.toLowerCase().includes(plant), "there is no plant alternative for: " + plant);
  // The four parts, and no fixed percentages — requirements move day to day.
  for (const part of ["Carbohydrate", "Protein", "Colour", "Fats and flavour"])
    assert.ok(meals.includes(part), "the meal builder is missing: " + part);
  assert.ok(!/%\s*carbohydrate|carbohydrate\s*\d{2}%|half your plate|quarter of your plate/i.test(meals),
    "the meal builder states fixed plate proportions");
  // Iron and calcium are named, and neither is a supplement recommendation.
  assert.match(meals, /Do not take iron supplements without a blood test/i,
    "iron is discussed without the test-first warning");
  assert.match(g, /salt tablets or iron supplements just in case/i,
    "nothing warns against supplementing on spec");
  // Rest days are not fasting days — the sentence that stops a rest day becoming a restriction day.
  assert.match(g, /not fasting days|not a fasting day/i, "rest-day eating is not protected");
  assert.match(g, /Do not make every run fasted/i, "fasted running is not put in its place");
});

test("⚠️ recovery is food, fluid and sleep — not a 30-minute window and not a supplement", () => {
  const rec = fn("fgRecovery");
  assert.match(rec, /no 30-minute cliff edge/i, "the recovery window is still presented as urgent");
  assert.match(rec, /eight hours/i, "the eight-hour rule that makes timing matter is missing");
  assert.match(rec, /7 to 9 hours|7–9 hours/i, "sleep has no figure");
  assert.match(rec, /Alcohol is not a recovery drink/i, "alcohol is not addressed");
  assert.ok(!/supplement (helps|improves|speeds)/i.test(rec), "a supplement is credited with recovery");
  // Gut comfort: practise and personalise, never a single-cause explanation.
  const gut = fn("fgGut");
  assert.match(gut, /gluten-free does not improve/i, "the gluten-free myth is not corrected");
  assert.match(gut, /dietitian advice before cutting anything out/i,
    "elimination is not gated on professional advice");
  for (const sign of ["Blood in your stool", "black stool", "repeated vomiting", "fever"])
    assert.ok(gut.toLowerCase().includes(sign.toLowerCase()), "the gut red flags omit: " + sign);
});

test("⚠️ every gel-to-grams conversion says the products vary", () => {
  // ⚠️ GEL_GRAMS IS 22 AND REAL PRODUCTS RUN 20–30. Left unqualified the count is read as nutrition
  // data about the packet in the runner's hand, and somebody counting four gels for a 90 g hour is a
  // third short on the day it matters most.
  // ⚠️ COMMENT-STRIPPED. The phrase appears twice in the engine: once in the shipped string and once in
  // the comment that explains why the string must exist — so unstripped, deleting the real one still passed.
  const src = stripComments(engineSrc());
  assert.match(src, /check the label; products vary/i, "the engine's gel figure carries no label caveat");
  const amounts = fn("fgCarbAmounts");
  assert.match(amounts, /check the label; products vary/i, "the guide's gel figures carry no label caveat");
  assert.match(amounts, /Take water with a gel when the label says to/i,
    "nothing says whether a gel needs water");
  // Grams per hour leads; the gel count follows it.
  const f = fuellingFor({ durationMinutes: 180, raceDistance: "marathon", sessionType: "long" });
  const lead = f.points[0]!;
  assert.ok(lead.indexOf("g of carbohydrate an hour") < lead.indexOf("gel"),
    "the gel count is presented before the grams per hour");
});

test("⚠️ accessible: labelled anchors, real tap targets, and focus that follows the jump", () => {
  const html = page();
  assert.match(fn("fgNav"), /<nav class="fg-nav" aria-label="Fuelling guide sections">/,
    "the anchor row is not a labelled nav");
  // ⚠️ SIX ANCHORS, ALL SIX REACHABLE AT 390px. A horizontal scroller hides half the choices, and the
  // one somebody needs is as likely to be the sixth as the first.
  const nav = fn("fgNav");
  const targets = [...nav.matchAll(/\["(fg[A-Za-z]+)",/g)].map((m) => m[1]!);
  assert.equal(targets.length, 6, "there are not six quick choices");
  for (const t of targets)
    assert.ok(html.includes('id="' + t + '"') || fn("redsView").includes('"' + t + '"'),
      "the quick choice " + t + " points at no section");
  // The handler moves focus as well as pixels, and honours Reduce Motion.
  const w = html.slice(html.indexOf("[data-fgnav]"), html.indexOf("[data-fgnav]") + 700);
  assert.match(w, /prefers-reduced-motion/, "the jump animates even in Reduce Motion");
  assert.match(w, /\.focus\(\{ preventScroll: true \}\)/,
    "the jump moves the view but not the focus ring");
  assert.match(fn("fgSec"), /tabindex="-1"/, "a jumped-to heading cannot take focus");
  // 44px hit areas on the only two controls the page has, and headings clear of the app bar.
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const fg = css.slice(css.indexOf(".fuel-guide-page"));
  assert.match(fg, /\.fg-chip \{[^}]*min-height: var\(--tap\)/, "the quick choices are under 44px");
  assert.match(fg, /\.fg-sum \{[^}]*min-height: var\(--tap\)/, "the card summaries are under 44px");
  assert.match(fg, /\.fg-sec \{[^}]*scroll-margin-top/, "a jumped-to section can hide under the app bar");
  // ⚠️ COLOUR IS NEVER THE ONLY SIGNAL. Every ladder rung has words and a number; the bar is decorative.
  assert.match(fn("fgLadder"), /aria-hidden="true"/, "the ladder bar is announced as content");
  assert.match(fn("fgBda"), /Before[\s\S]*During[\s\S]*After/, "the session rows lost their labels");
});

test("⚠️ the other two private check-ins are untouched", () => {
  // The brief is explicit that this change must not reach them, and both are one route away.
  const fh = fn("femaleView");
  assert.equal((fh.match(/type="checkbox"/g) || []).length, 0, "femaleView builds its own checkboxes now");
  assert.match(fh, /checks\(/, "the women's-health options have gone");
  assert.match(fh, /id="fhStatus"/, "the menstrual-status select has gone");
  assert.match(fh, /checkinConsent\(\)/, "the women's-health consent line has gone");
  const rf = fn("redflagsView");
  assert.match(rf, /sti-page/, "the injury guide has changed");
  assert.match(rf, /stiStopScreen\(\)/, "the injury stop screen has gone");
});
