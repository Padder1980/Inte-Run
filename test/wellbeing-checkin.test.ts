/**
 * Stage D3c: the wellbeing tick-boxes get a home again, the crisis lines get numbers, and Ask Alfie learns
 * the eight limb warning signs.
 *
 * ⚠️⚠️ WHY THIS STAGE EXISTS. When the injury guide replaced the old "How are you feeling?" screen it took
 * four tick-boxes with it -- worries about eating, periods stopping, struggling mentally, thoughts of
 * harming yourself -- and the app's crisis escalation was then reachable only by TYPING it to Ask Alfie.
 * The engine still knew all four (acute-limb-flags.test.ts kept them resolving); nothing on screen offered
 * them. And the engine's own guidance for self-harm said "contact an urgent crisis line" while the app, it
 * turned out, named no crisis line anywhere.
 *
 * The owner's rulings, 28 September 2026: show the UK crisis numbers when self-harm or struggling mentally
 * is ticked or typed; and teach Ask Alfie the eight acute-limb signs the injury guide lists as text.
 * ⚠️ Everything is lifted out of the built page and run with the REAL engine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { screenRedFlags, PROFESSIONAL_LABEL } from "../src/index.ts";

const read = (rel: string) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const PAGE = read("web/app.html");
const ENGINE = read("src/safety/escalation.ts");
const WEBHOST = read("ios/InteRun/WebHost.swift");
const PLIST = read("ios/InteRun-Info.plist");
const RC = { screenRedFlags, PROFESSIONAL_LABEL };

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
/**
 * What a piece of the page SAYS: its string literals, with every comment left out. ⚠️ Comments quote the
 * very wording a guard forbids (this stage's own comments quote the dead page name and the old promise),
 * so a guard on copy must read the strings, never the source.
 */
function stringsOf(src: string): string {
  const STR = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    const spans = [...line.matchAll(STR)].map((m) => [m.index as number, (m.index as number) + m[0].length] as const);
    let cut = line.length;
    for (let i = line.indexOf("//"); i >= 0; i = line.indexOf("//", i + 2)) {
      if (!spans.some(([a, b]) => i > a && i < b)) { cut = i; break; }
    }
    for (const m of line.matchAll(STR)) if ((m.index as number) < cut) out.push(m[0].slice(1, -1));
  }
  return out.join("\n");
}
const APP = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "").find((b) => b.includes("function wellbeingView(")) || "";
const constValue = <T>(name: string): T => new Function(stmt(name) + "\nreturn " + name + ";")() as T;
const ESC = new Function(fnOf("esc") + "\nreturn esc;")() as (x: unknown) => string;
const FLAGS_WELL = constValue<Record<string, string>>("FLAGS_WELL");
const WB_CHK = constValue<string>("WB_CHK");

/** The engine's own flag table, read from its source: id -> category and urgency. */
function engineFlags(): Array<{ id: string; category: string; urgency: string; limb: boolean }> {
  const body = ENGINE.slice(ENGINE.indexOf("const FLAGS: Record<RedFlag, FlagDef> = {"), ENGINE.indexOf("\n};", ENGINE.indexOf("const FLAGS:")));
  const limbAt = body.indexOf("Acute limb injury");
  assert.ok(limbAt > 0, "the engine's acute-limb block was not found");
  return [...body.matchAll(/(?:"([a-z-]+)"|([a-z]+)): \{\s*category: "([a-z]+)",\s*urgency: "([a-z]+)"/g)]
    .map((m) => ({ id: (m[1] || m[2])!, category: m[3]!, urgency: m[4]!, limb: (m.index as number) > limbAt }));
}

test("the Wellbeing check-in is a Support card among the check-ins, and opens its own page", () => {
  const hub = PAGE.slice(PAGE.indexOf("const SUPPORT_HUB"), PAGE.indexOf("const HUB_CHECKINS"));
  assert.match(hub, /\{ id: "wellbeing", ic: "[a-zA-Z]+", c: "var\(--[a-z-]+\)", t: "Wellbeing", d: "[^"]+", interactive: true,/,
    "there is no Wellbeing card, or it does not carry the Check-in badge");
  assert.ok(constValue<string[]>("HUB_CHECKINS").includes("wellbeing"), "the card is in no group, so it renders nowhere");
  assert.match(fnOf("supportDetail"), /if \(id === "wellbeing"\) return back \+ wellbeingView\(\);/, "the card opens nothing");
  assert.notEqual(WB_CHK, "rf", "the group is named rf, which wire() binds to runRf -- a dead handler that reads a node this page lacks");
});

test("BLOCKER: it offers every wellbeing flag the engine knows, as tick-boxes, with the consent line and the emergency route", () => {
  // Derived both ways: the engine's psychological and hormonal flags ARE this list.
  const engineWell = engineFlags().filter((f) => f.category === "psychological" || f.category === "hormonal").map((f) => f.id).sort();
  assert.deepEqual(Object.keys(FLAGS_WELL).sort(), engineWell, "FLAGS_WELL and the engine's wellbeing flags disagree");
  for (const k of Object.keys(FLAGS_WELL)) assert.equal(screenRedFlags([k as never]).flags.length, 1, k + " does not resolve through the engine");
  const html = lift(["checks", "checkinConsent", "EMERGENCY_BANNER", "wellbeingView"], ["FLAGS_WELL", "WB_CHK"], "wellbeingView()", {}) as string;
  for (const [k, label] of Object.entries(FLAGS_WELL)) {
    assert.ok(html.includes('data-chk="' + WB_CHK + '" value="' + k + '"'), "no tick-box for " + k);
    assert.ok(html.includes(label), "the tick-box for " + k + " is not labelled " + label);
  }
  assert.ok(html.includes(fnOf("checkinConsent").match(/Your answers stay on this phone/)![0]), "it does not say what happens to the answers");
  assert.ok(html.includes("In an emergency"), "it has no emergency route");
  assert.ok(html.includes('id="wbRes"'), "there is nowhere for the answer to go");
});

/** runWb against a page that holds the ticks given, with the real engine and the real renderer. */
function wellbeing(picks: string[], native?: string) {
  const node = { innerHTML: "", shown: false, classList: { add(c: string) { if (c === "show") node.shown = true; }, remove(c: string) { if (c === "show") node.shown = false; } } };
  lift(["crisisFlagged", "appCanOpen", "crisisLinesHtml", "referLine", "renderResult", "runWb"],
    ["FLAGS_WELL", "WB_CHK", "CRISIS_LINES", "CRISIS_FLAGS", "PROF"], "runWb()", {
      RC, esc: ESC, $: (id: string) => (id === "wbRes" ? node : null), chkValues: (name: string) => (name === WB_CHK ? picks : []),
      inNativeApp: () => native !== undefined, window: native === undefined ? {} : { __interunLinkSchemes: native },
    });
  return node;
}

test("BLOCKER: ticking gives the engine's answer; self-harm and struggling mentally bring the crisis lines; nothing shows until something is ticked", () => {
  const none = wellbeing([]);
  assert.equal(none.shown, false, "an answer about nothing was shown");
  assert.equal(none.innerHTML, "");
  const junk = wellbeing(["none"]);
  assert.equal(junk.shown, false, "an id the engine does not know was screened -- screenRedFlags throws on those");

  const harm = wellbeing(["self-harm-thoughts"]);
  const r = screenRedFlags(["self-harm-thoughts"]);
  assert.equal(r.urgency, "emergency");
  assert.ok(harm.shown && harm.innerHTML.includes(r.headline), "the engine's own headline is not what the runner reads");
  assert.ok(harm.innerHTML.includes("--rbc:var(--rest)"), "an emergency is not shown in the emergency colour");
  assert.ok(harm.innerHTML.includes("116 123") && harm.innerHTML.includes("85258") && harm.innerHTML.includes("0800 1111"), "no crisis numbers for self-harm");
  const band = harm.innerHTML.indexOf('class="rb"'), lines = harm.innerHTML.indexOf('class="crisis"'), items = harm.innerHTML.indexOf('class="ri"');
  assert.ok(band >= 0 && lines > band && lines < items, "the crisis lines are not the first thing under the headline");

  assert.ok(wellbeing(["mental-health-concern"]).innerHTML.includes("116 123"), "no crisis numbers for struggling mentally");
  const eating = wellbeing(["eating-disorder-concern"]);
  assert.ok(eating.shown && eating.innerHTML.includes(screenRedFlags(["eating-disorder-concern"]).headline));
  assert.ok(!eating.innerHTML.includes('class="crisis"'), "the crisis lines appear where the owner's ruling does not put them");
  assert.ok(!wellbeing(["menstrual-disruption"]).innerHTML.includes('class="crisis"'));
});

test("the crisis numbers are the ones read on the services' own pages, and each link dials what it shows", () => {
  // ⚠️ A TYPED COPY ON PURPOSE: these are outside facts, read on 28 September 2026 on the NHS's "Where to
  // get urgent help for mental health", Samaritans' contact page and Shout's own page. If one changes,
  // change it here only after reading it there again.
  const lines = constValue<Array<{ name: string; num: string; href: string }>>("CRISIS_LINES");
  assert.deepEqual(lines.map((l) => l.name + " " + l.num), ["Samaritans 116 123", "Shout 85258", "Childline 0800 1111", "NHS 111 111"]);
  for (const l of lines) {
    assert.equal(l.href.replace(/^(tel|sms):/, ""), l.num.replace(/\D/g, ""), l.name + "'s link dials something other than the number it shows");
  }
  // On the web every number is a link; on an iPhone build that has not declared tel:, none is, and the
  // number is still printed; on a build that has, they are links again.
  const web = lift(["appCanOpen", "crisisLinesHtml"], ["CRISIS_LINES"], "crisisLinesHtml()", { esc: ESC, inNativeApp: () => false, window: {} }) as string;
  for (const h of ["tel:116123", "sms:85258", "tel:08001111", "tel:111", "tel:999"]) assert.ok(web.includes('href="' + h + '"'), "no link for " + h);
  const old = lift(["appCanOpen", "crisisLinesHtml"], ["CRISIS_LINES"], "crisisLinesHtml()", { esc: ESC, inNativeApp: () => true, window: {} }) as string;
  assert.ok(!old.includes("<a "), "an iPhone build that cannot dial shows a tap that does nothing");
  for (const l of [...lines.map((x) => x.num), "999"]) assert.ok(old.includes(">" + l + "<"), l + " is not printed where it cannot be tapped");
  const nu = lift(["appCanOpen", "crisisLinesHtml"], ["CRISIS_LINES"], "crisisLinesHtml()", { esc: ESC, inNativeApp: () => true, window: { __interunLinkSchemes: "tel,sms,mailto" } }) as string;
  assert.ok(nu.includes('href="tel:116123"') && nu.includes('href="sms:85258"'), "a build that can dial still shows plain text");
});

test("BLOCKER: the iPhone build that can open these links says so, and declares every scheme it says", () => {
  const flag = (WEBHOST.match(/window\.__interunLinkSchemes = \\"([a-z,]+)\\";/) || [])[1];
  assert.ok(flag, "WebHost does not tell the page which links it can open");
  const declared = [...(PLIST.match(/<key>LSApplicationQueriesSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/) || [])[1]!.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  for (const s of flag.split(",")) assert.ok(declared.includes(s), "WebHost says it can open " + s + ": links, and Info.plist does not declare " + s);
  const used = [...new Set(constValue<Array<{ href: string }>>("CRISIS_LINES").map((l) => l.href.slice(0, l.href.indexOf(":"))).concat(["tel", "mailto"]))];
  for (const s of used) assert.ok(flag.split(",").includes(s), "the page uses " + s + ": links that no build can say it opens");
});

/** Ask Alfie's on-phone safety route, lifted whole. */
function alfie(question: string) {
  const api = lift(["alfieNorm", "alfieRedFlags", "crisisFlagged", "appCanOpen", "crisisLinesHtml", "alfieSafetyAnswer"],
    ["ALFIE_FLAGS", "CRISIS_LINES", "CRISIS_FLAGS"], "{ alfieRedFlags, alfieSafetyAnswer }",
    { RC, esc: ESC, inNativeApp: () => false, window: {} });
  const flags = api.alfieRedFlags(question) as string[];
  return { flags, answer: flags.length ? (api.alfieSafetyAnswer(flags) as string) : "" };
}

test("BLOCKER: Ask Alfie gives the crisis lines for self-harm, names pages that exist, and the old dead address is gone", () => {
  const harm = alfie("I’ve been having suicidal thoughts");
  assert.ok(harm.flags.includes("self-harm-thoughts"), "a phone's curly apostrophe and capital hid it again");
  assert.ok(harm.answer.includes("116 123") && harm.answer.includes("0800 1111"), "Alfie's crisis answer gives no number");
  assert.ok(harm.answer.includes("Support → Wellbeing"), "Alfie does not point at the Wellbeing check-in");
  const chest = alfie("Chest pain when I run");
  assert.ok(chest.flags.includes("chest-pain") && !chest.answer.includes('class="crisis"'), "chest pain got the crisis lines");
  assert.ok(chest.answer.includes("Safety, privacy &amp; human help"), "chest pain no longer points at the Safety page, which says when to stop");
  const limb = alfie("I heard a crack and I can’t put weight on it");
  assert.ok(limb.flags.includes("deformity-or-crack") && limb.flags.includes("cannot-bear-weight-four-steps"));
  assert.equal(screenRedFlags(limb.flags as never[]).urgency, "emergency");
  assert.ok(limb.answer.includes("Support → Injury &amp; symptoms"));
  assert.ok(APP.length > 100000, "the app's script block was not found");
  assert.ok(!stringsOf(APP).includes("When to stop and seek help"), "Alfie still points at a page that has never existed");
  // Every page the answer can name is a real one.
  const hub = PAGE.slice(PAGE.indexOf("const SUPPORT_HUB"), PAGE.indexOf("const HUB_CHECKINS"));
  assert.ok(hub.includes('t: "Wellbeing"') && hub.includes('t: "Injury & symptoms"'), "a page Alfie names is not in Support");
  assert.ok(fnOf("viewSupport").includes("Safety, privacy &amp; human help"), "Safety, privacy & human help is not in Support");
});

test("BLOCKER: each of the eight limb signs is recognised as a phone types it, and ordinary running questions are not", () => {
  const limb = engineFlags().filter((f) => f.limb).map((f) => f.id);
  assert.equal(limb.length, 8, "the engine's acute-limb flags were not read: " + limb.join(","));
  const known = new Map(constValue<Array<[string, string[]]>>("ALFIE_FLAGS"));
  for (const id of limb) assert.ok((known.get(id) || []).length >= 3, "Alfie has no words for " + id);
  const typed: Record<string, string> = {
    "deformity-or-crack": "I heard a crack in my ankle when I landed",
    "cold-blue-or-numb-limb": "My foot went numb after I fell",
    "severe-constant-pain-or-tense-swelling": "The pain is unbearable and won’t ease",
    "cannot-bear-weight-four-steps": "I can’t put weight on my foot",
    "rapid-swelling-or-bruising": "It swelled up straight away",
    "pop-with-loss-of-push-off": "I felt a pop at the back of my ankle",
    "hot-swollen-one-sided-calf": "My calf is swollen and warm",
    "open-wound-or-fever": "There’s an open wound on my knee",
  };
  assert.deepEqual(Object.keys(typed).sort(), [...limb].sort(), "the examples here do not cover the engine's limb flags");
  for (const [id, q] of Object.entries(typed)) assert.ok(alfie(q).flags.includes(id), id + " is not recognised in: " + q);
  // The pairing the engine escalates: a swollen calf with chest pain is an emergency.
  assert.equal(screenRedFlags(alfie("My calf is swollen and now I have chest pain").flags as never[]).urgency, "emergency");
  // ⚠️ THE OTHER HALF, AND THE ONE THAT KEEPS ALFIE USEFUL. An emergency answer to a harmless question
  // teaches runners to stop asking, and these are the questions they actually type.
  for (const q of [
    "My last interval was excruciating", "Is it ok to run with a fever?", "My toes get cold on winter runs",
    "My knee clicks when I squat", "My calves are tight after the hill session", "My legs feel heavy today",
    "Should I run if I’m sore?", "I can’t walk properly after my long run, my legs are so sore",
    "How far should my long run be?", "What if I feel achy tomorrow?",
  ]) assert.deepEqual(alfie(q).flags, [], "an ordinary question was flagged: " + q);
});

test("the two old symptom-checker promises are gone, and both doors say where they go", () => {
  const lim = fnOf("alfieLimits");
  assert.ok(!/symptom check-in|Check a symptom/.test(stringsOf(lim)), "Alfie still promises a symptom checker behind a leg-injury guide");
  assert.match(lim, /id="alfEsc">Injury &amp; symptoms/);
  assert.match(lim, /id="alfWb">Wellbeing/);
  assert.match(fnOf("wireAlfie"), /\$\("alfWb"\);\s*if \(wbBtn\) wbBtn\.onclick = \(\) => \{[^}]*state\.support = "wellbeing"/, "the Wellbeing button goes nowhere");
  const safety = fnOf("safetyView");
  assert.ok(!/Check a symptom/.test(stringsOf(safety)), "the Safety page still says Check a symptom");
  assert.match(safety, /data-hub="redflags">Injury &amp; symptoms/);
  assert.match(safety, /data-hub="wellbeing">Wellbeing check-in/);
  assert.ok(!/Check a symptom|symptom check-in/.test(stringsOf(APP)), "a promise of a symptom checker survives somewhere");
});

test("the check-in keeps nothing, and its ticks are wired", () => {
  const run = fnOf("runWb");
  for (const w of ["localStorage", "state.", "save", "draft"]) assert.ok(!run.includes(w), "runWb writes somewhere (" + w + ") -- the consent line says nothing is kept");
  assert.match(fnOf("wire"), /document\.querySelectorAll\('\[data-chk="' \+ WB_CHK \+ '"\]'\)\.forEach\(\(c\) => c\.onchange = runWb\);/, "ticking a box does nothing");
});

test("BLOCKER: every check-in result headline is readable in both themes (the emergency one was 2.93:1 in dark)", () => {
  // Derived from the page: the urgency colours renderResult uses, each theme's own value for them, and
  // the band's mix towards black. color-mix(in srgb, X p%, #000) is exactly each channel times p.
  const uc = [...fnOf("renderResult").matchAll(/(\w+):"var\((--[a-z-]+)\)"/g)].map((m) => m[2]!);
  assert.ok(uc.length >= 4, "renderResult's urgency colours were not read");
  const mix = Number((PAGE.match(/\.result \.rb \{[^}]*background: color-mix\(in srgb, var\(--rbc\) (\d+)%, #000\)/) || [])[1]);
  assert.ok(mix > 0 && mix <= 100, "the result band is no longer mixed towards black, so its contrast is no longer known");
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * mix / 100 / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  for (const theme of ["light", "dark"]) {
    const block = (PAGE.match(new RegExp(':root\\[data-theme="' + theme + '"\\] \\{([^}]*)\\}')) || [])[1] || "";
    for (const v of new Set(uc)) {
      const hex = (block.match(new RegExp(v + ":\\s*(#[0-9a-f]{6})", "i")) || [])[1];
      assert.ok(hex, v + " has no plain value in the " + theme + " theme, so this cannot measure it");
      const ratio = 1.05 / (lum(hex) + 0.05);
      assert.ok(ratio >= 4.5, "white on " + v + " in the " + theme + " theme is " + ratio.toFixed(2) + ":1");
    }
  }
});
