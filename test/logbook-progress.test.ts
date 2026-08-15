import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE LOGBOOK'S NEW SURFACES — this week, the 12-week trend, streaks, the training log and the
 * Progress ranges. Added 2026-08-15.
 *
 * All of it was blocked until interun_hist_v1 existed: against the capped 50-run store a 1Y range
 * held 24% of a year and a streak calendar drew REST DAYS THE RUNNER NEVER TOOK. So the guards here
 * are mostly about one thing — nothing on these screens may read state.logged for a total, and
 * nothing may imply a run did not happen when the truth is that its record aged out.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function fnOf(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  const rel = html.slice(at + 1).search(/\n(function |const |let |\/\*\*)/);
  const src = html.slice(at, rel > 0 ? at + 1 + rel : at + 9000);
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("every total and chart reads the permanent history, never the capped runs", () => {
  // ⚠️ THE WHOLE POINT. state.logged is 50 runs; a total taken from it silently stops being true
  // after about twelve weeks, and stops being true FIRST for the runners who train most.
  for (const fn of ["logTotals", "logWeekBuckets", "logStreakWeeks"]) {
    const src = fnOf(fn);
    assert.ok(/state\.hist/.test(src), fn + " must read state.hist");
    assert.ok(!/state\.logged/.test(src), fn + " must not read the capped store for a total");
  }
});

test("week boundaries are built with the UTC helpers", () => {
  for (const fn of ["logWeekBuckets", "dayDiff", "trainingLogView"]) {
    const src = fnOf(fn);
    // ⚠️ new Date(iso + "T00:00:00") parses as LOCAL midnight, so toISOString() hands back the
    // PREVIOUS day for the whole of British Summer Time. This project shipped that once already and
    // the symptom was a Monday total that quietly swallowed Sunday's long run — the biggest of the
    // week, so it looked plausible nearly every time.
    assert.ok(!/T00:00:00/.test(src), fn + " must not construct a Date from an ISO string without Z");
    assert.ok(!/getDay\(\)|setDate\(/.test(src), fn + " must use the UTC helpers, not local date methods");
  }
});

/**
 * ⚠️ NO ISO DATE MAY BE BUILT FROM A LOCALLY-MUTATED Date. DERIVED, NOT LISTED.
 *
 * This project fixed the local/UTC mix once in logWeekStartIso and wrote it up as done — and two
 * more copies of the same shape were still live on 2026-08-15: futureIso, which feeds the watch's
 * upcoming-week payload, and reviewWeekStartIso, which decides whether the weekly review has already
 * been answered. Both were found by sweeping, not by reading, which is the whole argument for a
 * derived guard: a hand-written list of "date functions" cannot contain the one somebody adds next.
 *
 * ⚠️ AND THE FIRST VERSION OF THIS SWEEP WAS TOO BROAD. Forbidding every local getter beside a
 * toISOString flagged buildReminderSchedule and runStravaPayload, which are both CORRECT and both
 * documented: a reminder is set against the clock on the wall, and Strava's start_date_local must be
 * local or every British summer run lands an hour early in the runner's own log. The precise fault is
 * narrower — mutating a Date with local setters and then reading it back as an ISO date — and stated
 * that way the sweep needs no exemption list, which is what stops it going stale.
 */
test("no ISO date is built from a Date mutated in local time", () => {
  const html = page();
  const names = [...new Set([...html.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]!))];
  assert.ok(names.length > 100, "only " + names.length + " functions found — the scan is broken");
  const bad: string[] = [];
  for (const n of names) {
    const at = html.indexOf("function " + n + "(");
    const rel = html.slice(at + 1).indexOf("\nfunction ");
    const body = (rel > 0 ? html.slice(at, at + 1 + rel) : html.slice(at, at + 4000))
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (!body.includes("toISOString")) continue;
    // setUTCDate and friends are the correct forms and must not match.
    if (/\.(setDate|setMonth|setFullYear|setHours)\(/.test(body)) bad.push(n);
  }
  assert.deepEqual(bad, [], "these build an ISO date from a locally-mutated Date, which moves it a day across a clock change: " + bad.join(", "));
});

test("there is one definition of when a week starts", () => {
  const html = page();
  const at = html.indexOf("function reviewWeekStartIso(");
  assert.ok(at > 0, "reviewWeekStartIso is missing");
  const src = html.slice(at, at + 220).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ It used to carry its own copy of the sum, in local time, and therefore kept the fault after
  // logWeekStartIso was fixed. Two definitions of a week boundary is one too many.
  assert.ok(/logWeekStartIso\(\)/.test(src), "reviewWeekStartIso must delegate rather than repeat the calculation");
  assert.ok(!/getDay\(\)/.test(src), "it must not compute the day of week itself");
});

test("the trend chart's y axis starts at zero", () => {
  const src = fnOf("logTrendSvg");
  // ⚠️ Auto-scaling to the data's own minimum turns a steady 20–22 km month into a mountain range,
  // which is the opposite of what somebody checking their consistency needs to see.
  assert.ok(/y\(0\)/.test(src), "the area and baseline must be drawn from zero");
  assert.ok(!/Math\.min\(\s*\.\.\.\s*weeks/.test(src), "the axis must not start at the smallest week");
});

test("a run whose record has aged out is shown but is not a button", () => {
  const src = fnOf("trainingLogView");
  // ⚠️ Measured on an eight-month fixture: 148 dots, 50 openable, 98 landing on "Run not found."
  // A dot showing a real distance that dead-ends is worse than one that plainly cannot be opened.
  assert.ok(/openable/.test(src), "the view must know which runs still have a full record");
  assert.ok(/aria-disabled="true"/.test(src), "an unopenable day must be marked disabled, not left as a live button");
  const closed = src.slice(src.indexOf("anyClosed = true"));
  assert.ok(!/data-runid/.test(closed.slice(0, 260)), "an aged-out day must not carry data-runid");
  // And it must say why, once, rather than leaving pale dots unexplained.
  assert.ok(/older than your last fifty/.test(src), "the page must explain the paler runs");
});

test("dots are addressed by run id, never by list position", () => {
  const src = fnOf("trainingLogView");
  // ⚠️ state.logged is unshifted whenever a watch run arrives, so an index points at a different run
  // by the time it is used. test/silent-defects.test.ts already fails on any data-runidx in the page.
  assert.ok(/data-runid="/.test(src), "openable dots must carry data-runid");
  assert.ok(!/data-runidx/.test(src), "never address a run by index");
});

test("the calendar cannot page back before the first recorded run", () => {
  const view = fnOf("trainingLogView");
  // ⚠️ Past the first record every day draws blank, and a blank day on this calendar means "you
  // rested". Scrolling further would be inventing rest days out of an absence of records — the exact
  // reason a scrolling calendar was refused before the history store existed.
  assert.ok(/canBack/.test(view), "the view must compute whether paging back is legitimate");
  assert.ok(/disabled/.test(view), "the back control must be disabled at the boundary");
  const html = page();
  const at = html.indexOf('bind("scPrev"');
  assert.ok(at > 0, "the month-back handler is missing");
  const handler = html.slice(at, at + 420).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // A second gate in the handler, because a disabled attribute is a UI state and this is the invariant.
  assert.ok(/oldest/.test(handler) && /return;/.test(handler), "the handler must refuse to page past the oldest record");
});

test("Progress says when its range reaches back further than the records do", () => {
  const src = fnOf("progressView");
  // ⚠️ A 1Y chart for somebody two months into using the app is mostly flat line at zero. Without a
  // caption that reads as a year of not running.
  assert.ok(/oldest/.test(src), "the view must know when its history starts");
  assert.ok(/not because you did not run/.test(src), "an empty stretch must be explained, not left to imply idleness");
});

test("the two Logbook destinations light the Logbook tab", () => {
  const html = page();
  const at = html.indexOf('state.screen === "progress" || state.screen === "traininglog"');
  assert.ok(at > 0, "the Logbook destination router is missing");
  const src = html.slice(at, at + 1100);
  // ⚠️ The nav is normally synced from state.tab at the very end of render(), which these branches
  // return before reaching — so without an explicit line the previous tab stays lit and a runner deep
  // in their training log is told they are on Today.
  assert.ok(/navbtn/.test(src) && /activities/.test(src), "these screens must light the Logbook tab explicitly");
});
