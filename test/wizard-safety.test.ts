import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { screenRedFlags } from "../src/safety/escalation.ts";

/**
 * D3a — the safety step, first in the onboarding wizard.
 *
 * Six symptoms that must not be trained through, screened by the engine before a plan is built.
 * The claims here are mostly DRIVEN rather than grepped, because every one of them is about what
 * happens when somebody ticks a box: which outcome the engine reaches, whether Next moves, and
 * whether anything is remembered afterwards.
 *
 * ⚠️ fnOf IS BRACE-MATCHED, NEVER A CHARACTER WINDOW. test/onboarding-wizard.test.ts still slices a
 * flat 4000 characters, which is the trap CLAUDE.md records fourteen times: the window either stops
 * inside the function or runs into the next one, and both directions read as a pass.
 */
const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function fnOf(name: string): string {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) return "";
  let depth = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (!depth) return html.slice(at, i + 1); }
  }
  return "";
}
/** A top-level const's initialiser, by name. */
function constOf(name: string): string {
  const m = new RegExp("\\nconst " + name + " = ([^\\n]*);").exec(html);
  return m && m[1] ? m[1] : "";
}
/**
 * ⚠️ COMMENTS ARE STRIPPED FROM EVERY SCOPE THESE GUARDS SCAN, and the block-comment regex is
 * LINE-ANCHORED. CLAUDE.md measures an unanchored sweep eating 10,382 characters of live code,
 * because accept="image/*" is an unbalanced comment opener mid-line. Several of the comments on this
 * feature quote the very identifiers the guards forbid, which is the twelfth firing of that trap.
 */
const nocomment = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The runtime FLAGS_PHYS map, read out of the built page rather than retyped. */
function flagsPhys(): Record<string, string> {
  const src = constOf("FLAGS_PHYS");
  assert.ok(src.startsWith("{"), "FLAGS_PHYS is not a literal map in the build");
  return JSON.parse(src.replace(/([{,])\s*"/g, '$1"'));
}

test("BLOCKER: the safety step is FIRST, in both branches, and ahead of the goal", () => {
  // Driven, not grepped: the real wizStepIds, run for every status and both personalized states.
  const src = fnOf("wizStepIds");
  assert.ok(src.length > 100, "wizStepIds is missing");
  const make = (personalized: boolean, status: string) =>
    new Function("profile", "draft", "isBeginnerStatus", src + "; return wizStepIds();")(
      { personalized }, { status }, (s: string) => s === "new" || s === "building");
  let checked = 0;
  for (const personalized of [false, true]) {
    for (const status of ["", "new", "building", "regular", "competitive"]) {
      const ids = make(personalized, status);
      assert.equal(ids[0], "safety",
        "the wizard does not open on the safety step (personalized=" + personalized + ", status=" + status + ")");
      assert.ok(ids.indexOf("goal") > ids.indexOf("safety"),
        "the goal is chosen before the safety question is asked");
      assert.equal(ids.filter((x: string) => x === "safety").length, 1, "the safety step appears twice");
      checked++;
    }
  }
  assert.ok(checked >= 10, "the sweep did not reach both branches");
});

test("BLOCKER: every symptom the step offers is one the engine can screen", () => {
  // ⚠️ THIS IS WHAT MAKES wizSafetyPicks' FILTER'S OWN THROW UNREACHABLE. screenRedFlags reads
  // FLAGS[flag] unguarded, so an id it does not know is a TypeError — measured, screenRedFlags(["none"])
  // throws — and this runs from an onchange handler, where a throw leaves the panel dead. Derived from
  // the map in the build, so a seventh symptom the engine has never heard of fails here.
  const keys = Object.keys(flagsPhys());
  assert.ok(keys.length >= 6, "FLAGS_PHYS shrank — the step is asking fewer questions than it did");
  for (const k of keys) {
    const r = screenRedFlags([k as any]);
    assert.ok(["emergency", "urgent", "professional", "monitor"].includes(r.urgency),
      k + " screens to " + r.urgency + " — a symptom on this step must reach a real escalation");
  }
  // And the two outcomes the step can actually produce, so the paint's branching is measured, not assumed.
  assert.equal(screenRedFlags(["chest-pain"]).urgency, "emergency");
  assert.equal(screenRedFlags(["bone-pain"]).urgency, "urgent");
});

test("BLOCKER: the step's checkbox group is not another screener's", () => {
  // wire() binds [data-chk="rf"] to runRf, which reads $("rfRes") unguarded — dead code on its own
  // route and a TypeError here. Derived from every name the page binds, so a future collision fails.
  const name = JSON.parse(constOf("WIZ_SAFETY_CHK"));
  const bound = [...html.matchAll(/data-chk="([a-z]+)"\]'\)\.forEach\(\(c\) => c\.onchange = (\w+)/g)].map((m) => m[1]);
  assert.ok(bound.length >= 3, "the per-screener data-chk bindings are gone — this guard measures nothing");
  assert.ok(!bound.includes(name),
    "the safety step reuses the " + name + " group, which another screener's handler is bound to");
  assert.notEqual(name, "rf", "the safety step uses the dead runRf group");
});

test("BLOCKER: the step is actually rendered, and an unanswered one refuses to advance", () => {
  // ⚠️ EVERY OTHER GUARD HERE DRIVES wizSafetyHtml AND THE GATE DIRECTLY, so without these two the
  // whole step could be built perfectly and reach nobody: wizBody is what puts it on screen, and
  // wizStepError is what stops a runner tapping straight past it without answering either way.
  const body = nocomment(fnOf("wizBody"));
  assert.match(body, /id === "safety"\)\s*return wizSafetyHtml\(\)/,
    "wizBody does not render the safety step — the step would be blank");
  const err = nocomment(fnOf("wizStepError"));
  assert.match(err, /id === "safety"\)\s*return wizSafetyAnswered\(\)/,
    "the safety step does not require an answer, so Next walks past an unanswered health question");
  // Driven: no answer is an error, either answer is not.
  const src = fnOf("wizStepError");
  const run = (answered: boolean) =>
    new Function("draft", "isBeginnerStatus", "wizSafetyAnswered", "wizFieldVal", "todayIso", "GOAL_BY_STATUS",
      src + '; return wizStepError("safety");')(
      { status: "regular" }, () => false, () => answered, () => "", () => "2026-01-01", {});
  assert.equal(run(true), null, "an answered safety step still errors");
  assert.match(String(run(false)), /None of these/, "an unanswered safety step does not name the way past it");
});

/** Lift the step's own functions onto a fake DOM and drive them. */
function loadStep() {
  // ⚠️ THE CONSTANT IS EXTRACTED FROM THE BUILD, NOT RETYPED, AND OMITTING IT COST A RUN. Every lifted
  // function reads WIZ_SAFETY_CHK; without it in scope each one threw a ReferenceError — loudly, which
  // is the acceptable kind of stale, but a lift list that omits a dependency measures a strictly easier
  // program, and retyping the value would let the test and the page disagree about the group's name.
  const konst = "const WIZ_SAFETY_CHK = " + constOf("WIZ_SAFETY_CHK") + ";\n";
  assert.match(konst, /"[a-z]+"/, "WIZ_SAFETY_CHK is not a literal in the build");
  const src = konst + ["wizSafetyPicks", "wizSafetyAnswered", "wizSafetyPaint", "wizSafetyGate"].map(fnOf).join("\n");
  for (const n of ["wizSafetyPicks", "wizSafetyAnswered", "wizSafetyPaint", "wizSafetyGate"])
    assert.ok(fnOf(n).length > 20, n + " is missing from the build");

  const ticks: string[] = [];
  let noneChecked = false;
  const mkEl = () => {
    const cls = new Set<string>();
    return {
      innerHTML: "",
      scrolled: 0,
      classList: { add: (c: string) => cls.add(c), remove: (c: string) => cls.delete(c), contains: (c: string) => cls.has(c) },
      scrollIntoView(this: any) { this.scrolled++; },
    } as any;
  };
  const res = mkEl(), ack = mkEl();
  const okBtn = { onclick: null as any };
  const errNode = { removed: 0, remove() { this.removed++; } };
  const state: any = { wizErr: null };
  const advanced = { n: 0 };

  const $ = (id: string) => {
    if (id === "wizSafetyRes") return res;
    if (id === "wizSafetyAck") return ack;
    if (id === "wizSafetyNone") return { checked: noneChecked };
    if (id === "wizSafetyOk") return String(ack.innerHTML).includes('id="wizSafetyOk"') ? okBtn : null;
    return null;
  };
  // ⚠️ THE FAKE MODELS THE REAL DOM: the .wz-err node exists until something removes it. Gated on
  // state.wizErr instead, it could never be handed back — wizSafetyPaint nulls state.wizErr BEFORE it
  // queries — so the test failed against code the browser had already shown working. Fix the ruler.
  const document = { querySelector: (s: string) => (s === ".wz-err" && !errNode.removed ? errNode : null) };
  // ⚠️ The REAL engine and the REAL map — a stubbed screener would make every urgency claim below a
  // statement about the stub. renderResult is a fake, because what it draws is the three Support
  // screeners' business and is already guarded there; what matters here is what it is HANDED.
  const painted: any[] = [];
  const fns = new Function(
    "$", "document", "state", "chkValues", "FLAGS_PHYS", "RC", "renderResult", "wizAdvance",
    src + "; return { picks: wizSafetyPicks, answered: wizSafetyAnswered, paint: wizSafetyPaint, gate: wizSafetyGate };",
  )(
    $, document, state,
    (name: string) => (name === JSON.parse(constOf("WIZ_SAFETY_CHK")) ? ticks.slice() : []),
    flagsPhys(),
    { screenRedFlags },
    (...a: any[]) => { painted.push(a); res.classList.add("show"); },
    () => { advanced.n++; },
  );
  return {
    ...fns, res, ack, okBtn, state, errNode, painted, advanced,
    tick(...v: string[]) { ticks.length = 0; ticks.push(...v); noneChecked = false; },
    tickNone() { ticks.length = 0; noneChecked = true; },
    clear() { ticks.length = 0; noneChecked = false; },
  };
}

test("BLOCKER: an emergency answer blocks, offers no way on, and says a plan is not being built", () => {
  const s = loadStep();
  s.tick("chest-pain");
  assert.equal(s.paint(), "emergency", "chest pain does not reach the emergency branch");
  assert.equal(s.gate(), false, "the wizard would advance past a reported emergency");
  assert.equal(s.okBtn.onclick, null, "an emergency answer still offers a continue button");
  assert.doesNotMatch(String(s.ack.innerHTML), /wizSafetyOk/,
    "an emergency answer renders a way past it");
  assert.match(String(s.ack.innerHTML), /Get help first/i,
    "an emergency answer does not say that no plan is being built");
  // paint() ran twice — once directly, once inside gate() — which is the point: it is idempotent.
  assert.ok(s.painted.length >= 1, "the engine's own result was never rendered");
  for (const p of s.painted) assert.equal(p[1], "emergency", "the panel was painted at the wrong urgency");
  assert.match(String(s.painted[0][2]), /emergency help/i, "the panel does not carry the engine's own headline");
});

test("BLOCKER: a flagged-but-not-emergency answer blocks until an explicit acknowledgement", () => {
  const s = loadStep();
  s.tick("bone-pain");
  assert.equal(s.paint(), "flagged", "pinpoint bone pain does not reach the acknowledge branch");
  assert.equal(s.gate(), false, "Next walked past a flagged answer without an acknowledgement");
  assert.match(String(s.ack.innerHTML), /id="wizSafetyOk"/, "there is no way to acknowledge and continue");
  assert.match(String(s.ack.innerHTML), /I understand, continue/, "the acknowledgement is not explicit");
  // ⚠️ THE BUTTON ADVANCES BY THE SAME ROUTE AS NEXT. A second copy of the advance is how the two come
  // to disagree about clearing the error or clamping the step.
  assert.equal(typeof s.okBtn.onclick, "function", "the acknowledgement button is wired to nothing");
  s.okBtn.onclick();
  assert.equal(s.advanced.n, 1, "acknowledging does not advance the wizard");
});

test("BLOCKER: a clean answer is the only thing that lets Next through", () => {
  const s = loadStep();
  s.tickNone();
  assert.equal(s.answered(), true, "'None of these' is not an answer");
  assert.equal(s.gate(), true, "a clean answer still blocks");
  assert.equal(s.res.classList.contains("show"), false, "a clean answer still shows a warning panel");
  assert.equal(String(s.ack.innerHTML), "", "a clean answer leaves an acknowledgement on screen");
  s.clear();
  assert.equal(s.answered(), false, "no answer at all counts as an answer");
});

test("BLOCKER: wizNext cannot reach wizardFinish while the safety gate refuses", () => {
  // Driven: the real wizNext, with the gate forced to refuse. Neither the advance nor the finish may run.
  const src = fnOf("wizNext");
  assert.ok(src.length > 100, "wizNext is missing");
  const run = (gateOk: boolean, stepId: string) => {
    const calls = { advance: 0, finish: 0, render: 0 };
    const state: any = { wizStep: 0, wizErr: null };
    new Function("state", "wizStepIds", "captureSetupFields", "wizStepError", "wizSafetyGate",
      "wizardFinish", "wizAdvance", "render",
      src + "; wizNext();")(
      state, () => [stepId, "level", "summary"], () => {}, () => null, () => gateOk,
      () => { calls.finish++; }, () => { calls.advance++; }, () => { calls.render++; });
    return calls;
  };
  const blocked = run(false, "safety");
  assert.equal(blocked.advance, 0, "a refused safety gate still advanced the wizard");
  assert.equal(blocked.finish, 0, "a refused safety gate still reached wizardFinish");
  const allowed = run(true, "safety");
  assert.equal(allowed.advance, 1, "a clean safety answer does not advance");
  // And the gate is asked ONLY on its own step — a gate that ran everywhere would block the whole wizard.
  const other = run(false, "level");
  assert.equal(other.advance, 1, "the safety gate is being applied to steps that never asked the question");
});

test("BLOCKER: the step keeps nothing — that is what makes the consent line true", () => {
  // ⚠️ checkinConsent() promises "nothing is kept — leave this screen and they are gone". CLAUDE.md
  // records that sentence being the work twice over. It is true here ONLY because the ticks live in the
  // DOM and nowhere else, so these are the three ways it could quietly stop being true.
  const body = nocomment(fnOf("wizSafetyHtml"));
  assert.match(body, /checkinConsent\(\)/, "the safety step collects health answers and says nothing about them");
  assert.match(body, /EMERGENCY_BANNER\(\)/, "the safety step does not carry the emergency route");
  assert.match(body, /checks\(FLAGS_PHYS, WIZ_SAFETY_CHK\)/, "the step no longer renders the engine's own flag list");
  // (a) no s_-prefixed field, which captureSetupFields would sweep into the draft.
  assert.doesNotMatch(body, /id="s_/, "a safety answer is an s_ field, so captureSetupFields persists it into the draft");
  // (b) nothing in the step's own functions writes it anywhere.
  const all = ["wizSafetyHtml", "wizSafetyPicks", "wizSafetyAnswered", "wizSafetyPaint", "wizSafetyGate"]
    .map((n) => nocomment(fnOf(n))).join("\n");
  assert.doesNotMatch(all, /\bdraft\./, "the safety step writes an answer into the draft");
  assert.doesNotMatch(all, /localStorage/, "the safety step stores an answer on the device");
  // (c) state carries no acknowledgement, so one cannot go stale and wave a later answer through.
  const writes = [...all.matchAll(/state\.(\w+)\s*=/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(writes)], ["wizErr"],
    "the safety step writes " + writes.join(", ") + " to state — an answer or an acknowledgement is being remembered");
});

test("the error clears the moment they answer, without a re-render", () => {
  // ⚠️ A RE-RENDER HERE WOULD WIPE THE TICKS, which are the only copy of the answer — so the stale
  // "tell us either way" line has to come out of the DOM directly. Without this it sat under a panel
  // that had already answered it.
  const s = loadStep();
  s.state.wizErr = "Tick anything that applies";
  s.tick("bone-pain");
  s.paint();
  assert.equal(s.state.wizErr, null, "the error is still set after an answer");
  assert.equal(s.errNode.removed, 1, "the error was left on screen after an answer");
});

test("a refusal does something visible — it lands the runner on the reason", () => {
  // Next stays full-width and green while the gate refuses, so a refusal that scrolled nothing was a
  // control that looked live and did nothing. Only rendering the screen showed it.
  const s = loadStep();
  s.tick("chest-pain");
  assert.equal(s.gate(), false);
  assert.equal(s.res.scrolled, 1, "a refused Next does not bring the reason into view");
  const clean = loadStep();
  clean.tickNone();
  assert.equal(clean.gate(), true);
  assert.equal(clean.res.scrolled, 0, "a clean answer scrolls the page for no reason");
});

test("a value that is not a flag can never reach the engine", () => {
  // The filter is derived from FLAGS_PHYS, not a list. "None of these" is the checkbox that nearly
  // was one; the next one added to that group must not be able to throw inside an onchange handler.
  const s = loadStep();
  s.tick("bone-pain", "none", "not-a-flag");
  assert.deepEqual(s.picks(), ["bone-pain"], "a non-flag value survives into screenRedFlags");
  assert.equal(s.paint(), "flagged", "the paint threw or mis-branched on a stray value");
});
