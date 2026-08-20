import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE RELEASE GATE'S OWN NUMBERS, DERIVED FROM THE GATE — SO THE THREE PLACES THAT QUOTE THEM CANNOT
 * DISAGREE AGAIN.
 *
 * ⚠️ THEY DID DISAGREE, AND BY MORE THAN DOUBLE. The Share Studio's gate was reported as "63 of 74
 * checks, eleven blocked", corrected in place to "67 items: 62 PASS, 5 BLOCKED", and then still said
 * "eleven" ninety-four lines later in the SAME CLAUDE.md section — two paragraphs below its own
 * correction — while `docs/roadmap/index.html`, the page the owner actually reads to know where the
 * project is, carried "sixty-three of the seventy-four checks … eleven need a real iPhone" in its hero
 * and "Sixty-two of the sixty-seven … five" in the step detail immediately below it. A cold session, and
 * the owner, believe whichever copy they reach first.
 *
 * ⚠️ THE FIX IS NOT A THIRD CAREFUL RETYPE. Every figure here is derived: the TOTAL is counted from the
 * gate's own checkbox lines, the PASS/BLOCKED/FAIL split is read from CLAUDE.md and required to add up to
 * it, and the Road Map's spelled-out words are required to spell exactly those figures — computed, not
 * matched against a literal. Retyping a number in any of the three now fails here.
 *
 * ⚠️ AND `SHARE_STUDIO_RELEASE_GATE.md` IS COMMITTED FOR THIS REASON. It is the pack's
 * `VISUAL_ACCEPTANCE_CHECKLIST.md`, verbatim. Left in the supplied pack directory the count would depend
 * on a file outside the repo, so the guard would have to skip when it was absent — and a gate that
 * vanishes when its instrument is missing reports a release as verified having verified nothing.
 */

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/** Numbers as the Road Map writes them, because it is written for a person, not for a parser. */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function spell(n: number): string {
  assert.ok(Number.isInteger(n) && n >= 0 && n < 100, "spell() covers 0-99, not " + n);
  if (n < 20) return ONES[n]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? "-" + ONES[n % 10]! : "");
}

/** The gate's items, counted per section from the checkbox lines themselves. */
function gateSections(): Record<string, number> {
  const out: Record<string, number> = {};
  let sec = "";
  for (const line of read("SHARE_STUDIO_RELEASE_GATE.md").split("\n")) {
    const m = /^## ([A-Z])\. /.exec(line);
    if (m) { sec = m[1]!; out[sec] = 0; }
    // ⚠️ CHECKBOX LINES ONLY. The gate ends in an Evidence table whose rows are not checklist items, and
    // folding those rows plus the non-checklist deviations into the figure is exactly how "74" and
    // "eleven" were arrived at, twice.
    else if (sec && /^- \[[ xX]\] /.test(line)) out[sec]!++;
  }
  return out;
}

test("BLOCKER: the release gate's total is counted from the gate, and CLAUDE.md's split adds up to it", () => {
  const sections = gateSections();
  const total = Object.values(sections).reduce((a, b) => a + b, 0);
  assert.ok(Object.keys(sections).length >= 5, "the gate parsed as " + Object.keys(sections).length + " sections");
  assert.ok(total > 20, "the gate parsed as only " + total + " items, so the parse is wrong rather than the docs");

  const md = read("CLAUDE.md");
  const m = /\*\*(\d+) items: (\d+) PASS,\s*\n?(\d+) BLOCKED, (\d+) FAIL\*\*/.exec(md);
  assert.ok(m, "CLAUDE.md no longer states the gate's result in the '<n> items: <p> PASS, <b> BLOCKED, <f> FAIL' shape the derivation reads");
  const [t, pass, blocked, fail] = [Number(m![1]), Number(m![2]), Number(m![3]), Number(m![4])];
  assert.equal(t, total, "CLAUDE.md says " + t + " checklist items; the gate has " + total +
    " (per section " + JSON.stringify(sections) + ")");
  assert.equal(pass + blocked + fail, total,
    "the split " + pass + "+" + blocked + "+" + fail + " does not account for all " + total + " items");

  // ⚠️ THE PER-SECTION BREAKDOWN IS RECORDED IN CLAUDE.md AS THE WORKING, so it is checked against the
  // count rather than trusted. It is the line a future reader will re-add the totals from.
  const brk = /Counted: ((?:[A-Z]\d+\s*)+)\./.exec(md);
  assert.ok(brk, "CLAUDE.md no longer records the per-section count it added up");
  const stated: Record<string, number> = {};
  for (const p of brk![1]!.trim().split(/\s+/)) stated[p[0]!] = Number(p.slice(1));
  assert.deepEqual(stated, sections, "CLAUDE.md's per-section breakdown disagrees with the gate itself");
});

test("BLOCKER: the enumerated blocked items number exactly as many as the figure claims", () => {
  const md = read("CLAUDE.md");
  const m = /\*\*(\d+) items: (\d+) PASS,\s*\n?(\d+) BLOCKED/.exec(md);
  const blocked = Number(m![3]);
  // ⚠️ THE WORD AND THE LIST, BOTH. "eleven" survived for a day as a WORD in a paragraph that then
  // enumerated more than five by folding the Evidence table's rows back in, so pinning the digit alone
  // would have passed the exact defect this file exists for.
  const word = spell(blocked).toUpperCase();
  const at = md.indexOf("The " + word + " BLOCKED checklist items");
  assert.ok(at > 0, "CLAUDE.md no longer opens the blocked paragraph with 'The " + word +
    " BLOCKED checklist items', so the count and the list have nothing tying them together");
  const para = md.slice(at, at + 1400);
  const items = para.match(/\(\d+\)/g) || [];
  assert.equal(items.length, blocked, "the blocked paragraph enumerates " + items.length +
    " items against a stated " + blocked);
  for (let i = 1; i <= blocked; i++) {
    assert.ok(para.includes("(" + i + ")"), "the blocked list skips (" + i + ")");
  }
  // Every other spelled number must not be offered as the blocked count anywhere in that section.
  for (let n = 0; n < 30; n++) {
    if (n === blocked) continue;
    assert.ok(!md.includes("The " + spell(n).toUpperCase() + " BLOCKED checklist items"),
      "a second blocked-item count survives in CLAUDE.md: " + spell(n));
  }
});

test("BLOCKER: the Road Map spells the gate's own figures, and spells them the same way twice", () => {
  /**
   * ⚠️ THIS PAGE IS THE OWNER'S, INSTALLED ON HIS HOME SCREEN, AND HE USES IT TO KNOW WHERE THE PROJECT
   * IS. CLAUDE.md's standing instruction for it is that a map which under-reports or mis-reports is worse
   * than no map. The hero paragraph said "sixty-three of the seventy-four checks pass … eleven need a
   * real iPhone" while the step detail four paragraphs below said sixty-two of sixty-seven and five —
   * i.e. the correction had reached the step and CLAUDE.md and not the summary line at the top.
   */
  const md = read("CLAUDE.md");
  const m = /\*\*(\d+) items: (\d+) PASS,\s*\n?(\d+) BLOCKED, (\d+) FAIL\*\*/.exec(md);
  const [total, pass, blocked, fail] = [Number(m![1]), Number(m![2]), Number(m![3]), Number(m![4])];
  const rm = read("docs/roadmap/index.html");
  // ⚠️ EVERY OCCURRENCE OF THE SHAPE, NOT THE FIRST. The defect was a second copy of the sentence, so a
  // guard that stops at the first match is satisfied by exactly the state being guarded against.
  const shape = /([a-z][a-z-]*) of the ([a-z-]+) checks pass, ([a-z]+) fails?, and ([a-z-]+) /gi;
  const found: string[][] = [];
  for (let x = shape.exec(rm); x; x = shape.exec(rm)) found.push([x[1]!, x[2]!, x[3]!, x[4]!]);
  assert.ok(found.length >= 2, "the Road Map states the gate's result " + found.length +
    " times; the hero and the step detail both have to carry it, and they are what disagreed");
  for (const [p, t, f, b] of found) {
    assert.equal(p!.toLowerCase(), spell(pass), "the Road Map says '" + p + "' pass against CLAUDE.md's " + pass);
    assert.equal(t!.toLowerCase(), spell(total), "the Road Map says '" + t + "' checks against CLAUDE.md's " + total);
    assert.equal(b!.toLowerCase(), spell(blocked), "the Road Map says '" + b + "' blocked against CLAUDE.md's " + blocked);
    // "none fails" is how the page says zero, so the word has to track the figure rather than sit there.
    assert.equal(f!.toLowerCase(), fail === 0 ? "none" : spell(fail),
      "the Road Map says '" + f + "' fails against CLAUDE.md's " + fail);
  }
  // ⚠️ AND NO STALE FIGURE SURVIVES ANYWHERE ELSE ON THE PAGE. The denominator that never existed (74)
  // is the tell: it was arrived at by counting rows that are not checklist items, twice.
  for (let n = 0; n < 100; n++) {
    if (n === total || n === pass || n === blocked) continue;
    // ⚠️ SCOPED TO THE "…checks" SHAPE, AND ANCHORED SO A HYPHENATED NUMBER IS NOT READ AS ITS OWN TAIL.
    // Written as a bare "<word> of the" this flagged the ordinary English "one of the two" elsewhere on
    // the page; written without the lookbehind, "two" matched inside "sixty-two" and condemned the
    // correct sentence. A guard whose first two versions failed on correct prose is a guard that has to
    // be re-broken against the real stale text, which this one was ("sixty-three of the seventy-four").
    assert.ok(!new RegExp("(of the " + spell(n) + " checks|(?<![a-z-])" + spell(n) + " of the [a-z-]+ checks)", "i").test(rm),
      "a stale gate figure survives in the Road Map: " + spell(n));
  }
});

test("BLOCKER: the sharing step stays unticked while a blocked item is still blocked", () => {
  /**
   * ⚠️ ONLY VERIFIABLY-DONE WORK IS TICKED — the page's own standing rule, and a wrongly-ticked step
   * destroys its value. Saving straight to the camera roll needs an Xcode build and a real device, so
   * `pc-share` must appear in NO dated batch.
   * ⚠️ AND A BATCH IS NEVER EDITED, EVEN WHEN THE OWNER WITHDRAWS THE FEATURE IT TICKED. `pc-sticker`
   * stays ticked because the work it names genuinely happened; progress lives in HIS browser's
   * localStorage, so un-ticking it here would do nothing on his phone and would rewrite the record of
   * what was built. What changes when a feature is withdrawn is the step's own DETAIL, which has to say
   * so — a map that still describes a button he asked us to remove is a map that misinforms him.
   */
  const rm = read("docs/roadmap/index.html");
  const at = rm.indexOf("var BATCHES = ");
  assert.ok(at > 0, "the Road Map's dated batches are no longer declared as `var BATCHES = `");
  const batches = rm.slice(at, rm.indexOf("};", at));
  assert.ok(!/"pc-share"/.test(batches),
    "pc-share is ticked while Save to Photos is still blocked on a native build nobody has made");
  assert.match(batches, /"pc-sticker"/,
    "pc-sticker was built and measured, so its batch stays; a withdrawn feature is recorded in the " +
    "step's detail rather than by editing history nobody's browser would re-read");
  /**
   * ⚠️ AND THE WITHDRAWAL IS STATED WHERE HE READS IT — WHICH IS A CLAIM ABOUT POSITION, NOT ABOUT A
   * WORD BEING PRESENT SOMEWHERE. Written as "the detail matches /removed|withdrawn/" this guard was
   * satisfied by the ORIGINAL prose: the step already explained why the sticker "is not simply the same
   * card with the photo removed". Watched — the break deleted the whole withdrawal sentence and the
   * guard passed. A note that a feature is gone, buried three hundred words inside a paragraph
   * describing it as live, is the misinformation rather than the remedy.
   */
  const st = rm.slice(rm.indexOf('data-id="pc-sticker"'));
  const detail = st.slice(st.indexOf('class="st-d"'), st.indexOf("</div></div></div>"));
  assert.match(detail.slice(0, 200), /asked for this one to go/,
    "the sticker step does not OPEN by saying the owner asked for it to be removed, so a reader meets a " +
    "description of a live button first: " + JSON.stringify(detail.slice(0, 200)));
  // Every id a batch names has to be a step that exists, or the tick lands on nothing at all.
  const ids = new Set(Array.from(rm.matchAll(/data-id="([^"]+)"/g)).map((x) => x[1]!));
  for (const x of batches.matchAll(/"([a-z0-9-]+)"\s*[,\]]/g)) {
    const id = x[1]!;
    if (/^\d{4}-\d{2}-\d{2}/.test(id)) continue;
    assert.ok(ids.has(id), "a batch ticks '" + id + "', which is not a step on the page");
  }
});
