// pc-setup-stale-sheet (Road Map; found 2026-11-19 while fixing pc-pace-prompt-edit, older than that work).
//
// Editing one answer from the profile page draws the WHOLE setup form into the bottom sheet (openProfileEdit). The sheet
// hides with display:none and keeps its body, so after it closed its copy of the form stayed in the page, every s_ id
// with it, until another sheet happened to replace it. captureSetupFields sweeps the whole document and the sheet comes
// after #view, so the hidden copy's OLD values overwrote what the runner had typed:
//   * on the full Edit page, a date typed and then left by a tab came back as the old one (measured: 14 Mar → 1 Nov);
//   * in the wizard, opened from a card on Today with no sheet in between, a goal picked as a half came back as the old
//     10K — wizFieldVal finds the hidden copy before it looks in draft.__f — and the new plan was built from it.
// And "Show every question" in the sheet lost what was typed there: nothing captured it before the sheet closed.
//
// Lifted from the BUILT page: closeSheet, dropSheetForm, captureSetupFields, restoreSetupFields, wizFieldVal,
// openProfileEdit, closeProfileEdit, seedSetupDraft and its helpers, and the "Show every question" button's handler taken
// from inside the real applySetupFocus. Faked: the page (#view before #sheetBody, as in the app, each dropping its
// fields when its HTML is replaced) and the form's markup, drawn from the STORED profile as viewSetup draws it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function captureSetupFields(");
assert.ok(at0 >= 0, "captureSetupFields is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));

/** The source from `from` to the brace that closes the first block opened after it. */
function braced(from: number, what: string): string {
  assert.ok(from >= 0, "no " + what + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", from); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(from, i + 1); }
  }
  throw new Error("unbalanced braces in " + what);
}
const fnBody = (name: string) => braced(SRC.indexOf("\nfunction " + name + "("), "function " + name);
// "Show every question" is bound inside the real applySetupFocus; its handler is taken from there and nowhere else.
const FOCUS = fnBody("applySetupFocus");
const ALL_AT = FOCUS.indexOf("if (all) all.onclick = () => {");
assert.ok(ALL_AT > 0, "the Show every question handler is no longer bound in applySetupFocus");
const SHOW_ALL = braced(SRC.indexOf(FOCUS) + FOCUS.indexOf("{", ALL_AT), "the Show every question handler");

const FNS = ["closeSheet", "dropSheetForm", "captureSetupFields", "restoreSetupFields", "wizFieldVal", "openProfileEdit",
  "closeProfileEdit", "seedSetupDraft", "strengthDaysOf", "returnKind"];

const STORED = {
  name: "Sam", avatar: "", status: "building", goalDist: "10k", targetS: 4200, targetSet: false, raceDate: "2027-02-11",
  startDateIso: "2026-11-16", longRunDay: 6, daysPerWeek: 3, strength: false, strengthDays: 0, returning: "",
  personalized: true, age: 40, easyPaceS: 0, noRecent: true, fitSrc: "beginner",
};

/** A page: #view and #sheetBody hold whatever HTML they were last given, and only that, as a browser does. */
function page() {
  const make = (id: string, tag: string, attrs = ""): any => {
    const cls = new Set<string>();
    const el: any = { id, tag, onclick: null, style: {}, classList: { add: (c: string) => { cls.add(c); }, remove: (c: string) => { cls.delete(c); }, contains: (c: string) => cls.has(c) } };
    if (tag === "input" || tag === "select") el.value = /\bvalue="([^"]*)"/.exec(attrs)?.[1] ?? "";
    return el;
  };
  const kids: Record<string, any[]> = { view: [], sheetBody: [] };
  const box = (name: string) => {
    const el = make(name, "div");
    el.querySelector = (sel: string) => {
      assert.equal(sel, '[id^="s_"]', "the page was asked for something this fake does not draw: " + sel);
      return (kids[name] ?? []).find((e) => e.id.startsWith("s_")) || null;
    };
    Object.defineProperty(el, "innerHTML", {
      get() { return (kids[name] ?? []).map((e) => e.id).join(" "); },
      set(h: string) {
        kids[name] = [...h.matchAll(/<(\w+)\b([^>]*)>/g)].filter((m) => /\bid="/.test(m[2] ?? ""))
          .map((m) => make(/\bid="([^"]+)"/.exec(m[2] ?? "")?.[1] ?? "", m[1] ?? "", m[2] ?? ""));
      },
    });
    return el;
  };
  const fixed: Record<string, any> = { view: box("view"), sheetBody: box("sheetBody"), sheetOv: make("sheetOv", "div") };
  // #view comes before #sheetBody, as in the app (ensureSheet appends the sheet at the end of .app).
  const all = () => [...(kids.view ?? []), ...(kids.sheetBody ?? [])];
  const $ = (id: string): any => fixed[id] || all().find((e) => e.id === id) || null;
  const document = {
    getElementById: $,
    querySelectorAll(sel: string) {
      assert.equal(sel, '[id^="s_"]', "the page was asked for something this fake does not draw: " + sel);
      return all().filter((e) => e.id.startsWith("s_"));
    },
  };
  const inView = (id: string) => (kids.view ?? []).find((e) => e.id === id) || null;
  const inSheet = () => (kids.sheetBody ?? []).filter((e) => e.id.startsWith("s_")).length;
  return { $, document, inView, inSheet };
}

function form(p: any): string {
  return '<div class="setup"><select class="sel" id="s_dist" value="' + p.goalDist + '"></select>' +
    '<input class="sel num" id="s_target" value="">' +
    '<input class="sel" id="s_date" type="date" value="' + p.raceDate + '">' +
    '<input class="sel num" id="s_easypace" value="">' +
    '<select class="sel" id="s_age" value="' + (p.age || "") + '"></select>' +
    '<div class="err" id="setupErr" style="display:none"></div><button class="primary" id="saveProfile">Update my plan</button></div>';
}

function harness() {
  const pg = page();
  const STATE: any = { screen: "profile", tab: "today", setupFocus: null };
  const env: Record<string, unknown> = {
    RC, $: pg.$, document: pg.document, STORED, STATE, FORM: form,
    ensureSheet: () => {}, linkFormLabels: () => {}, applySetupFocus: () => {}, wireWhyInputs: () => {}, wire: () => {},
    slogFlush: () => {}, stretchStop: () => {}, strengthStop: () => {},
  };
  const body =
    "let profile = STORED, state = STATE, draft = {}, PROFILE_EDIT_OPEN = false, LIVE_TARGET = false, WX_SHEET_OPEN = false;\n" +
    FNS.map(fnBody).join("\n") + "\n" +
    "function viewSetup() { return FORM(profile); }\n" +
    // render(): only its setup branch matters here — the whole form as a page, in #view.
    "function render() { if (state.screen === 'setup') { seedSetupDraft(); $('view').innerHTML = viewSetup(); restoreSetupFields(); } else { $('view').innerHTML = '<div class=\"pf-id\"></div>'; } }\n" +
    "function showEveryQuestion() " + SHOW_ALL + "\n" +
    "return { openProfileEdit, closeSheet, captureSetupFields, wizFieldVal, render, showEveryQuestion," +
    " get draft() { return draft; }, set draft(v) { draft = v; } };";
  const names = Object.keys(env);
  const api = new Function(...names, body)(...names.map((n) => env[n]));
  return { api, ...pg, state: STATE };
}

test("BLOCKER: a closed sheet keeps no copy of the setup form — and keeps any other sheet's content", () => {
  const h = harness();
  h.api.openProfileEdit("goal");
  assert.ok(h.inSheet() > 0, "the one-answer edit no longer draws the form in the sheet — this test no longer covers the trap");
  h.api.closeSheet();
  assert.equal(h.inSheet(), 0, "the closed sheet still holds the form's fields, where captures and lookups find them");
  // Another sheet (a session's, say) may still be read by the code that closed it: only the setup form goes.
  h.$("sheetBody").innerHTML = '<input id="sdTime" value="07:30"><button id="sdStart">Start</button>';
  h.api.closeSheet();
  assert.equal(h.$("sdTime")?.value, "07:30", "closing a sheet that holds no setup form emptied it");
});

test("BLOCKER: an answer typed on the full Edit page and left by a tab comes back as typed, after a one-answer edit", () => {
  const h = harness();
  h.api.openProfileEdit("goal");          // a one-answer edit from the profile page…
  h.api.closeSheet();                     // …closed (saved or not)
  h.state.screen = "setup"; h.api.render(); // later, the full Edit page
  h.inView("s_date").value = "2027-03-14";
  h.api.captureSetupFields();             // what the tab buttons do when they leave the Edit page
  assert.equal(h.api.draft.__f.s_date, "2027-03-14", "the typed date was overwritten by the closed sheet's old copy");
  h.state.screen = "profile"; h.api.render();
  h.state.screen = "setup"; h.api.render(); // coming back
  assert.equal(h.inView("s_date").value, "2027-03-14", "the Edit page came back with the old date, not the one typed");
});

test("BLOCKER: the wizard reads an earlier step's answer from the draft, not from a closed sheet's old copy", () => {
  const h = harness();
  h.api.openProfileEdit("goal");
  h.api.closeSheet();
  // "Start a new plan" from a card on Today (startWizard): a clean draft, then the goal step in #view.
  h.api.draft = { __live: true, __f: {}, status: "building" };
  h.$("view").innerHTML = '<select class="sel" id="s_dist" value="10k"></select>';
  h.inView("s_dist").value = "half";
  h.api.captureSetupFields();             // wizNext
  assert.equal(h.api.draft.__f.s_dist, "half", "the goal picked in the wizard was overwritten by the closed sheet's old 10K");
  h.$("view").innerHTML = '<input class="sel" id="s_volume" value="">'; // the next step: the goal field is gone from #view
  assert.equal(h.api.wizFieldVal("s_dist"), "half", "the wizard read the goal from the closed sheet's old copy");
});

test("BLOCKER: \"Show every question\" keeps what was typed in the sheet", () => {
  const h = harness();
  h.api.openProfileEdit("goal");
  h.$("s_dist").value = "5k";
  h.api.showEveryQuestion();
  assert.equal(h.state.screen, "setup", "Show every question no longer opens the full Edit page");
  assert.equal(h.inSheet(), 0, "the sheet's form outlived Show every question");
  assert.equal(h.inView("s_dist")?.value, "5k", "the goal typed in the sheet was lost on the way to the full Edit page");
});
