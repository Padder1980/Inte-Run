// pc-pace-prompt-edit (Road Map; found 2026-11-19 while building STAGES.md §10 piece 4, older than that work).
//
// A runner on "Building the habit" with no easy pace changes one answer from the profile page (their goal, say) and taps
// "Update my plan". The edit form is drawn in the bottom sheet (openProfileEdit), and the "Add your easy pace?" question
// (openPacePrompt) was drawn in the SAME sheet without keeping what was typed, so asking it destroyed the form:
//   * "No — work it out from my first run" saved with the form gone. draftFromForm read the STORED answers through
//     wizFieldVal's draft fallback: 10 km changed to 5 km came back as 10 km, "Your plan comes out the same either way".
//     On a fresh launch, with nothing stored to fall back on, it threw at the missing error line and saved nothing.
//   * "Add it now" closed the sheet and focused an easy-pace box that was no longer in the page.
//   * On the full Edit page the question was asked a SECOND time, after "Rebuild my plan".
//   * And a box the runner CLEARED came back filled after the form was put back: restoreSetupFields skips blanks.
//
// Lifted from the BUILT page over the real engine (RC): the save button's handler and doSaveProfile, both taken from
// inside the real wire(); openPacePrompt, needsPacePrompt, openProfileEdit, openProfilePreview, closeSheet,
// captureSetupFields, restoreSetupFields, wizFieldVal, seedSetupDraft, and the real draftFromForm with its helpers.
// Faked: the page (a tiny DOM that drops a container's fields when its HTML is replaced, as a browser does), the form's
// markup (drawn from the STORED profile, as viewSetup draws it), and everything after the commit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function openPacePrompt(");
assert.ok(at0 >= 0, "openPacePrompt is not in the build — run node web/app.ts");
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
function constDecl(name: string): string {
  const at = SRC.indexOf("\nconst " + name + " = ");
  assert.ok(at >= 0, "no const " + name + " in the build");
  return SRC.slice(at, SRC.indexOf(";\n", at) + 1);
}
// The save button's handler and the save it calls, taken from INSIDE the real wire(): no top-level function may start
// between wire's first line and either of them, so a copy anywhere else cannot stand in.
const WIRE_AT = SRC.indexOf("\nfunction wire() {");
function inWire(needle: string): number {
  assert.ok(WIRE_AT >= 0, "no wire() in the build");
  const at = SRC.indexOf(needle, WIRE_AT);
  assert.ok(at > WIRE_AT, needle + " is not in the build");
  assert.equal(SRC.slice(WIRE_AT + 1, at).indexOf("\nfunction "), -1, needle + " is no longer inside wire()");
  return at;
}
const SAVE_HANDLER = braced(inWire('const save = $("saveProfile");'), "the save button's handler") + ";";
const DO_SAVE = braced(inWire("function doSaveProfile() {"), "doSaveProfile");

const FNS = ["needsPacePrompt", "openPacePrompt", "openProfileEdit", "closeProfileEdit", "openProfilePreview", "closeSheet",
  "dropSheetForm", "captureSetupFields", "restoreSetupFields", "wizFieldVal", "seedSetupDraft", "draftFromForm",
  "isBeginnerStatus", "goalsForAge", "currentAgeAnswer", "derivedGoalS", "formStartIso",
  "strMinVal", "strLevelVal", "strGoalVal", "kitFromField", "kitToField", "strengthKitOf", "strengthDaysOf", "returnKind"];
const CONSTS = ["GOAL_BY_STATUS", "STR_DEFAULT_MIN", "STR_DEFAULT_LEVEL", "STR_DEFAULT_GOAL"];

const TODAY = "2026-11-19";
/** A habit-builder on a 10 km plan with no easy pace, as the app stores one. */
const BUILDING = {
  name: "Sam", avatar: "", status: "building", goalDist: "10k", targetS: 4200, targetSet: false,
  raceDate: "2027-02-11", startDateIso: "2026-11-16", longRunDay: 6, fitSrc: "beginner", recentDistM: 5000,
  recentTimeS: 2250, noRecent: true, easyPaceS: 0, twoKmS: 0, daysPerWeek: 3, volKm: 0, sex: "", strength: false,
  strengthDays: 0, returning: "", personalized: true, autoPace: true, bRace: null, age: 40,
  volGrowth: "progressive", hardDays: "balanced", longMax: 0, road: null,
};

/** A page: #view and #sheetBody hold whatever HTML they were last given, and only that, as a browser does. */
function page() {
  const dom = { active: null as any, sheetWrites: [] as string[] };
  const make = (id: string, tag: string, attrs = ""): any => {
    const cls = new Set<string>();
    const el: any = {
      id, tag, onclick: null, style: {}, textContent: "", scrolled: false,
      classList: { add: (c: string) => { cls.add(c); }, remove: (c: string) => { cls.delete(c); }, contains: (c: string) => cls.has(c) },
      click() { if (el.onclick) el.onclick(); },
      focus() { dom.active = el; },
      scrollIntoView() { el.scrolled = true; },
    };
    if (tag === "input" || tag === "select") el.value = /\bvalue="([^"]*)"/.exec(attrs)?.[1] ?? "";
    if (tag === "button") el.value = "";
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
      set(h: string) {
        if (name === "sheetBody") dom.sheetWrites.push(h);
        kids[name] = [...h.matchAll(/<(\w+)\b([^>]*)>/g)].filter((m) => /\bid="/.test(m[2] ?? ""))
          .map((m) => make(/\bid="([^"]+)"/.exec(m[2] ?? "")?.[1] ?? "", m[1] ?? "", m[2] ?? ""));
      },
    });
    return el;
  };
  const fixed: Record<string, any> = { view: box("view"), sheetBody: box("sheetBody"), sheetOv: make("sheetOv", "div") };
  const all = () => [...(kids.view ?? []), ...(kids.sheetBody ?? [])];
  const $ = (id: string): any => fixed[id] || all().find((e) => e.id === id) || null;
  const document = {
    getElementById: $,
    querySelectorAll(sel: string) {
      assert.equal(sel, '[id^="s_"]', "the page was asked for something this fake does not draw: " + sel);
      return all().filter((e) => e.id.startsWith("s_"));
    },
    get activeElement() { return dom.active; },
  };
  return { dom, $, document };
}

const clock = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const hms = (s: number) => s >= 3600 ? Math.floor(s / 3600) + ":" + clock(s % 3600).padStart(5, "0") : clock(s);
/** The form, drawn from the STORED profile as viewSetup draws it; only restoreSetupFields puts typed answers back. */
function form(p: any): string {
  return '<div class="setup">' +
    '<select class="sel" id="s_dist" value="' + p.goalDist + '"></select>' +
    '<input class="sel num" id="s_target" value="' + (p.targetSet ? hms(p.targetS) : "") + '">' +
    '<input class="sel" id="s_date" type="date" value="' + p.raceDate + '">' +
    '<input class="sel num" id="s_easypace" value="' + (p.easyPaceS ? clock(p.easyPaceS) : "") + '">' +
    '<input class="sel" id="s_name" value="' + p.name + '">' +
    '<select class="sel" id="s_age" value="' + (p.age || "") + '"></select>' +
    '<select class="sel" id="s_sex" value="' + (p.sex || "") + '"></select>' +
    '<input class="sel" id="s_startdate" type="date" value="' + p.startDateIso + '">' +
    '<select class="sel" id="s_longday" value="' + p.longRunDay + '"></select>' +
    '<div class="err" id="setupErr" style="display:none"></div>' +
    '<button class="primary" id="saveProfile">Update my plan</button></div>';
}

function harness(stored: Record<string, unknown> = {}) {
  const pg = page();
  const seen = { built: [] as any[], committed: 0, toasts: 0 };
  const STATE: any = { screen: "profile", tab: "today", setupFocus: null };
  const env: Record<string, unknown> = {
    RC, $: pg.$, document: pg.document, STORED: { ...BUILDING, ...stored }, STATE, FORM: form,
    todayIso: () => TODAY,
    isoAdd: (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; },
    ensureSheet: () => {}, linkFormLabels: () => {}, applySetupFocus: () => {}, wireWhyInputs: () => {},
    slogFlush: () => {}, stretchStop: () => {}, strengthStop: () => {},
    // What the preview is built from: the profile the save read off the form.
    profileImpact: (pf: any) => { seen.built.push(pf); return { rows: [{ label: "x", was: "a", now: "b" }], lost: 0, steppedBack: [], none: false }; },
    profileImpactHtml: () => "",
    applyProfile: () => ({ plan: { weeks: [] }, raw: { weeks: [] } }),
    adoptPlan: () => { seen.committed++; }, computeToday: () => {}, planDefaultWeek: () => 0, seedDone: () => {},
    restoreTicks: () => {}, todayTicks: () => [], saveProfileStore: () => {}, renderAvatar: () => {},
    commitScheduledTrial: () => {}, planMoment: (commit: () => void, then: () => void) => { commit(); then(); },
    render: () => {}, toastUndo: () => { seen.toasts++; }, saveDayOverride: () => {}, recompute: () => {},
    PLAN: { weeks: [] }, SCHEDULED_TRIAL: null, CURRENT_WEEK: 0, TODAY_DOW: 3, DAY_ORDER: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  };
  const body =
    "let profile = STORED, state = STATE, draft = {}, PROFILE_EDIT_OPEN = false, PROFILE_CONFIRMED = false;\n" +
    "let SHEET_CTX = null, LIVE_TARGET = false, WX_SHEET_OPEN = false;\n" +
    CONSTS.map(constDecl).join("\n") + "\n" + FNS.map(fnBody).join("\n") + "\n" +
    "function viewSetup() { return FORM(profile); }\n" +
    "function wire() {\n" + SAVE_HANDLER + "\n" + DO_SAVE + "\n}\n" +
    // render()'s setup branch: the whole form as a page, in #view.
    "function showSetupPage() { state.screen = 'setup'; seedSetupDraft(); $('view').innerHTML = viewSetup(); restoreSetupFields(); wire(); }\n" +
    "return { openProfileEdit, showSetupPage, captureSetupFields, get profile() { return profile; }, get draft() { return draft; }," +
    " get editOpen() { return PROFILE_EDIT_OPEN; } };";
  const names = Object.keys(env);
  const api = new Function(...names, body)(...names.map((n) => env[n]));
  const asked = () => pg.dom.sheetWrites.filter((h) => h.includes('id="paceSkip"')).length;
  return { api, $: pg.$, document: pg.document, dom: pg.dom, seen, state: STATE, asked };
}

test("BLOCKER: an answer changed from the profile page survives \"Add your easy pace?\" — No", () => {
  // Twice: on a fresh launch (nothing stored in the draft), and after the full Edit page was visited and left, which
  // leaves the old answers in the draft for wizFieldVal to fall back on (how the owner's session saw it).
  for (const leftEditPage of [false, true]) {
    const h = harness();
    // Leaving by another tab captures the form (the nav buttons' handler) and draws the next screen over it.
    if (leftEditPage) { h.api.showSetupPage(); h.api.captureSetupFields(); h.state.screen = "profile"; h.$("view").innerHTML = '<div class="pf-id"></div>'; }
    h.api.openProfileEdit("goal");
    assert.equal(h.$("s_dist").value, "10k");
    h.$("s_dist").value = "5k";
    h.$("saveProfile").click();
    assert.equal(h.asked(), 1, "the easy-pace question was not asked");
    assert.equal(h.$("s_dist"), null, "the question no longer shares the sheet with the form — this test no longer covers the trap");
    h.$("paceSkip").click();
    assert.equal(h.seen.built.length, 1, "No saved nothing — the save failed with the form gone");
    assert.equal(h.seen.built[0].goalDist, "5k", "the preview was built from the stored goal, not the one typed");
    assert.equal(h.seen.built[0].autoPace, true);
    h.$("piGo").click();
    assert.equal(h.seen.committed, 1, "Rebuild my plan committed nothing");
    assert.equal(h.api.profile.goalDist, "5k", "the plan was saved with the stored goal");
    assert.equal(h.api.profile.autoPace, true, "No — work it out from my first run did not leave the paces to the first run");
    assert.equal(h.asked(), 1, "the runner was asked about their easy pace twice in one save");
    assert.equal(h.state.screen, "profile", "a save from the profile page did not come back to it");
  }
});

test("BLOCKER: \"Add it now\" puts the form back at the easy-pace question, with what was typed kept", () => {
  const h = harness();
  h.api.openProfileEdit("goal");
  h.$("s_dist").value = "half";
  h.$("saveProfile").click();
  h.$("paceAdd").click();
  assert.equal(h.api.editOpen, true, "Add it now closed the form");
  assert.equal(h.state.setupFocus, "fitness", "the form did not open at Current fitness, where the easy pace is asked");
  assert.ok(h.$("s_easypace"), "there is no easy-pace box to add it in");
  assert.equal(h.document.activeElement, h.$("s_easypace"), "the easy-pace box was not focused");
  assert.equal(h.$("s_easypace").scrolled, true, "the easy-pace box was not scrolled into view");
  assert.equal(h.$("s_dist").value, "half", "the goal the runner had typed was lost on the way");
  h.$("s_easypace").value = "6:30";
  h.$("saveProfile").click();
  assert.equal(h.asked(), 1, "asked again with the pace filled in");
  assert.equal(h.seen.built[0].goalDist, "half");
  assert.equal(h.seen.built[0].easyPaceS, 390);
  h.$("piGo").click();
  assert.equal(h.api.profile.goalDist, "half");
  assert.equal(h.api.profile.easyPaceS, 390);
  assert.equal(h.api.profile.autoPace, false);
});

test("BLOCKER: a box the runner cleared stays cleared when the form is put back", () => {
  // A stored easy pace, cleared, then "No — work it out from my first run": the pace must go, not come back.
  const pace = harness({ easyPaceS: 390, recentTimeS: 1432, noRecent: false, autoPace: false });
  pace.api.openProfileEdit("fitness");
  assert.equal(pace.$("s_easypace").value, "6:30");
  pace.$("s_easypace").value = "";
  pace.$("saveProfile").click();
  assert.equal(pace.asked(), 1);
  pace.$("paceSkip").click();
  assert.equal(pace.seen.built[0].easyPaceS, 0, "the cleared easy pace came back before the preview");
  pace.$("piGo").click();
  assert.equal(pace.api.profile.easyPaceS, 0, "the cleared easy pace came back after Rebuild my plan");
  assert.equal(pace.api.profile.autoPace, true);
  // The preview's own way back: an optional target time cleared (a pace on file, so no question). The preview was built
  // without it; measured 2026-11-19, the save put the old one back.
  const target = harness({ easyPaceS: 390, recentTimeS: 1432, noRecent: false, autoPace: false, targetS: 3900, targetSet: true });
  target.api.openProfileEdit("goal");
  assert.equal(target.$("s_target").value, "1:05:00");
  target.$("s_target").value = "";
  target.$("saveProfile").click();
  assert.equal(target.asked(), 0);
  assert.equal(target.seen.built[0].targetSet, false);
  target.$("piGo").click();
  assert.equal(target.api.profile.targetSet, false, "Rebuild my plan saved the target time the runner had cleared");
});

test("BLOCKER: on the full Edit page the easy-pace question is asked once per save", () => {
  const h = harness();
  h.api.showSetupPage();
  h.$("s_dist").value = "5k";
  h.$("saveProfile").click();
  assert.equal(h.asked(), 1);
  h.$("paceSkip").click();
  assert.equal(h.seen.built[0].goalDist, "5k");
  h.$("piGo").click();
  assert.equal(h.asked(), 1, "asked again after Rebuild my plan");
  assert.equal(h.seen.committed, 1);
  assert.equal(h.api.profile.goalDist, "5k");
  assert.equal(h.state.tab, "plan", "the full Edit page no longer lands on the Plan tab");
});

test("A mistake in the form shows in the form after \"No\", instead of failing in silence", () => {
  const h = harness();
  h.api.openProfileEdit("goal");
  h.$("s_date").value = "2026-11-01";
  h.$("saveProfile").click();
  assert.doesNotThrow(() => h.$("paceSkip").click());
  assert.equal(h.seen.built.length, 0, "the date the runner typed was lost, so the save went ahead with the stored one");
  assert.equal(h.$("s_date")?.value, "2026-11-01", "the form is not back, or lost what was typed");
  assert.equal(h.$("setupErr").style.display, "block");
  assert.match(h.$("setupErr").textContent, /needs to be in the future/);
  assert.equal(h.api.profile.raceDate, "2027-02-11");
});
