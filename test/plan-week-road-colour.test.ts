// pc-week-road-colour (Road Map; asked for by the owner, 2026-11-19).
//
// "The week numbers on the plan page should match the colours of the 'Road'." The Your road card colours each stage
// (Walk-run, Rebuild, Base, Race block — ROAD_COLOUR); the Plan screen's week list numbered every week in the same grey,
// so nothing on that list tied a week to the stage it belongs to.
//
// Guarded here, from the BUILT page:
//   * the road is the real one: roadLegsNow and everything it calls are lifted from the page and run on a stored road, so
//     the stages' dates are the app's own — and the weeks each stage holds are counted here from its first Monday and its
//     length, not by the comparison the row itself makes;
//   * every week the list draws carries the colour the road card gives its stage, and the stage's name; weekList really
//     hands the road to each row (the list is drawn by weekList itself, not by a helper beside it);
//   * a week the road does not reach — before it begins, after it ends, or no road at all — keeps the plain number;
//   * the number stays readable in light and dark, for every stage colour: ringed, and as the solid current-week number
//     (the rules and the tokens read from the built stylesheet, never a table written here).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function weekSummaryRow(");
assert.ok(at0 >= 0, "weekSummaryRow is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));
const CSS = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, " ");

function fnBody(name: string): string {
  const at = SRC.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at + 1, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
const constDecl = (name: string) => {
  const at = SRC.indexOf("\nconst " + name + " = ");
  assert.ok(at >= 0, "no const " + name + " in the build");
  return SRC.slice(at, SRC.indexOf(";\n", at) + 1);
};

// The real list, the real row and the real road. Stubbed: only the parts of the Plan screen this does not test — which
// week is open (none), an altered week (none), the paused row (none), and which week is the current one.
const APP: any = new Function("RC",
  ["ROAD_COLOUR", "ROAD_STAGE_LABEL", "ROAD_MIN_RACE_WEEKS", "PHASE_NAME", "B_RACE_NAME"].map(constDecl).join("\n") + "\n" +
  ["weekList", "weekSummaryRow", "roadLegsNow", "roadOf", "effectiveRoad", "roadAthleteOf", "roadMondayAfter",
    "roadWeeksBetween", "roadMergeRace", "roadSplitRace", "roadWalkRun", "roadAnswerAt", "noRaceRoadNow", "roadLegName",
    "weekMondayOf", "experienceFor", "resolvedStatus", "planStartIso", "isoAdd", "todayIso", "esc"].map(fnBody).join("\n") + "\n" +
  "let PLAN = null, profile = null, TODAY_IN_PLAN = false, CUR = 1; const state = { planWeek: 0 };\n" +
  "function curWeekNo() { return CUR; }\nfunction weekAdjust() { return null; }\nfunction firstShownWeek() { return 0; }\n" +
  "function pausedWeekRow() { return ''; }\nfunction weekDetail() { return ''; }\n" +
  "return { weekList, roadLegsNow, roadLegName, weekMondayOf, roadMondayAfter, todayIso, ROAD_COLOUR,\n" +
  "  set(o) { PLAN = o.PLAN; profile = o.profile; TODAY_IN_PLAN = !!o.cur; CUR = o.cur || 1; } };")(RC);

const MON: string = APP.weekMondayOf(APP.todayIso());
const monday = (weeks: number): string => APP.roadMondayAfter(MON, weeks);

/** A plan of week summaries, one a Monday from `from` (weeks after this Monday), as PLAN.weeks carries them. */
function planWeeks(from: number, count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({ index: i + 1, startIso: monday(from + i), phase: i < count - 3 ? "base" : "taper",
    distanceKm: 30, quality: 1, longRunMin: 80, isDeload: false }));
}
/** A half-marathon road stored as the wizard stores one (roadFromProposal): first Monday counted back from race week. */
function roadProfile(stages: Array<{ kind: string; weeks: number }>, extra: any = {}): any {
  const weeks = stages.reduce((n, s) => n + s.weeks, 0);
  return Object.assign({ status: "building", goalDist: "half", personalized: true, startDateIso: MON,
    raceDate: APP.roadMondayAfter(MON, weeks - 1),
    road: { v: 1, fromIso: MON, stages, rampWeeks: 0, checkpoints: [] } }, extra);
}

/** Each drawn week's number: its colour (or null for the plain number) and the stage it names. */
function drawnNumbers(): Map<number, { rc: string | null; title: string | null }> {
  const out = new Map<number, { rc: string | null; title: string | null }>();
  const list: string = APP.weekList();
  for (const m of list.matchAll(/data-weeksel="(\d+)"><span class="wk-n( road)?"(?: style="--rc:([^"]+)" title="([^"]*)")?>(\d+)<\/span>/g)) {
    assert.equal(m[1], m[5], "a row's number is not its own week's");
    assert.equal(!!m[2], !!m[3], "week " + m[1] + ": a road number without its colour, or a colour without the road class");
    out.set(Number(m[1]), { rc: m[3] ?? null, title: m[4] ?? null });
  }
  assert.equal(out.size, (list.match(/data-weeksel="/g) || []).length, "a week row's number is drawn in a way this test cannot read");
  return out;
}
/** The stage that holds each Monday, counted from each stage's first Monday and its length. */
function stageOfMonday(legs: any[]): Map<string, { leg: any; i: number }> {
  const out = new Map<string, { leg: any; i: number }>();
  legs.forEach((leg, i) => { for (let k = 0; k < leg.weeks; k++) out.set(APP.roadMondayAfter(leg.fromIso, k), { leg, i }); });
  return out;
}

test("BLOCKER: every week on the Plan list wears its road stage's colour and name; a week off the road wears none", () => {
  // Rebuild → Base → Race block, with two weeks before the road begins and one after it ends, so the plain number is
  // exercised on both sides.
  const pf = roadProfile([{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }, { kind: "race", weeks: 12 }]);
  APP.set({ PLAN: { goal: {}, weeks: planWeeks(-2, 23) }, profile: pf });
  const legs = APP.roadLegsNow(pf);
  assert.ok(legs && legs.length >= 3, "the road did not build — this test covers less than it says");
  assert.deepEqual([...new Set(legs.map((l: any) => l.kind))], ["rebuild", "base", "race"], "the road's stages are not the stored ones");
  const at = stageOfMonday(legs);
  const drawn = drawnNumbers();
  assert.equal(drawn.size, 23, "the list did not draw every week");
  let onRoad = 0, off = 0;
  for (const w of planWeeks(-2, 23)) {
    const got = drawn.get(w.index)!, want = at.get(w.startIso);
    if (!want) {
      assert.equal(got.rc, null, "week " + w.index + " (" + w.startIso + ") is off the road but coloured " + got.rc);
      off++;
      continue;
    }
    onRoad++;
    assert.equal(got.rc, APP.ROAD_COLOUR[want.leg.kind], "week " + w.index + " is in " + APP.roadLegName(legs, want.i) +
      " but its number is " + (got.rc || "plain") + ", not the road card's " + APP.ROAD_COLOUR[want.leg.kind]);
    assert.equal(got.title, APP.roadLegName(legs, want.i), "week " + w.index + " names the wrong stage");
  }
  assert.equal(onRoad, 20, "not every week of the road was checked");
  assert.equal(off, 3, "the weeks before and after the road were not checked");
  // Every stage of this road is drawn, the race block's blocks by their own names.
  const names = new Set([...drawn.values()].map((d) => d.title).filter(Boolean));
  for (let i = 0; i < legs.length; i++) assert.ok(names.has(APP.roadLegName(legs, i)), APP.roadLegName(legs, i) + " is on the road card but no week wears it");
});

test("A walk-run road's weeks wear the walk-run colour; with no road, every number stays plain", () => {
  const pf = roadProfile([{ kind: "walkrun1", weeks: 4 }, { kind: "walkrun2", weeks: 4 }, { kind: "rebuild", weeks: 4 }, { kind: "race", weeks: 8 }],
    { status: "new" });
  APP.set({ PLAN: { goal: {}, weeks: planWeeks(0, 20) }, profile: pf });
  const legs = APP.roadLegsNow(pf);
  assert.ok(legs && legs[0].kind === "walkrun1", "the walk-run road did not build");
  const drawn = drawnNumbers();
  for (let wk = 1; wk <= 8; wk++) assert.equal(drawn.get(wk)!.rc, APP.ROAD_COLOUR.walkrun1, "walk-run week " + wk + " is not in the walk-run colour");
  assert.equal(drawn.get(9)!.rc, APP.ROAD_COLOUR.rebuild, "the first Rebuild week is not in Rebuild's colour");
  // No road: the same plan, every number plain.
  APP.set({ PLAN: { goal: {}, weeks: planWeeks(0, 20) }, profile: Object.assign({}, pf, { road: null }) });
  assert.equal(APP.roadLegsNow(Object.assign({}, pf, { road: null })), null);
  for (const [wk, d] of drawnNumbers()) assert.equal(d.rc, null, "week " + wk + " is coloured with no road at all");
});

// ---- Readable in both themes -------------------------------------------------------------------------------------------
function tokens(theme: "light" | "dark"): Record<string, string> {
  const at = html.indexOf(':root[data-theme="' + theme + '"]');
  assert.ok(at >= 0, "no :root[data-theme=" + theme + "] block in the build");
  const out: Record<string, string> = {};
  for (const m of html.slice(at, html.indexOf("}", at)).matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]!] = m[2]!;
  return out;
}
const rgb = (hex: string): number[] => {
  const h = hex.replace("#", ""), f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const lum = (c: number[]) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
};
const ratio = (a: number[], b: number[]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** A declaration of the one rule whose selector is exactly `sel`. */
function decl(sel: string, prop: string): string {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1]!.split(",").map((x) => x.trim()).includes(sel));
  assert.ok(rules.length, "no rule for " + sel);
  const v = rules.map((m) => new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)").exec(m[2]!)?.[1]?.trim()).filter(Boolean).pop();
  assert.ok(v, sel + " sets no " + prop);
  return v!;
}
/** A colour as the browser paints it: a hex, a theme token, --rc (the stage colour), or a color-mix of those in srgb. */
function paint(v: string, theme: Record<string, string>, rc: string): number[] {
  const s = v.trim();
  if (s.startsWith("#")) return rgb(s);
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/.exec(s);
  if (mix) {
    const a = paint(mix[1]!, theme, rc), b = paint(mix[3]!, theme, rc), p = Number(mix[2]) / 100;
    return a.map((x, i) => Math.round(x * p + b[i]! * (1 - p)));
  }
  const m = /^var\(--([a-z0-9-]+)\)/.exec(s);
  assert.ok(m, "cannot read the colour " + s);
  if (m![1] === "rc") return paint(rc, theme, rc);
  assert.ok(theme[m![1]!], "--" + m![1] + " is not a theme token");
  return rgb(theme[m![1]!]!);
}

test("BLOCKER: a coloured week number is readable on its colour, ringed and as this week's, in light and dark", () => {
  const ring = /inset\s+0\s+0\s+0\s+[\d.]+px\s+(var\(--rc\))/.exec(decl(".wk-n.road", "box-shadow"));
  assert.ok(ring, "the ringed number lost its ring in the stage's colour");
  for (const themeName of ["light", "dark"] as const) {
    const theme = tokens(themeName);
    const card = paint(decl(".wk-sum", "background"), theme, "");
    for (const [kind, rc] of Object.entries(APP.ROAD_COLOUR as Record<string, string>)) {
      const tint = paint(decl(".wk-n.road", "background"), theme, rc), ink = paint(decl(".wk-n.road", "color"), theme, rc);
      const r1 = ratio(ink, tint);
      assert.ok(r1 >= 4.5, themeName + ", " + kind + ": a week's number is " + r1.toFixed(2) + ":1 on its tint");
      const r2 = ratio(paint(ring![1]!, theme, rc), card);
      assert.ok(r2 >= 2.5, themeName + ", " + kind + ": the stage's ring is " + r2.toFixed(2) + ":1 on the card — the colour cannot be told");
      const solid = paint(decl(".wk-sum.cur .wk-n.road", "background"), theme, rc), cink = paint(decl(".wk-sum.cur .wk-n.road", "color"), theme, rc);
      const r3 = ratio(cink, solid);
      assert.ok(r3 >= 4.5, themeName + ", " + kind + ": this week's number is " + r3.toFixed(2) + ":1 on its stage's colour");
    }
  }
});

test("This week's number is drawn solid in its stage's colour", () => {
  const pf = roadProfile([{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }, { kind: "race", weeks: 12 }]);
  APP.set({ PLAN: { goal: {}, weeks: planWeeks(0, 20) }, profile: pf, cur: 6 });
  const list: string = APP.weekList();
  const row = /<button class="wk-sum[^"]*\bcur\b[^"]*" data-weeksel="(\d+)"><span class="wk-n road" style="--rc:([^"]+)"/.exec(list);
  assert.ok(row, "the current week is not drawn as a road number");
  assert.equal(row![1], "6");
  assert.equal(row![2], APP.ROAD_COLOUR.base, "week 6 sits in Base");
});
