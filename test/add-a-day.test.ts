import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  addDayOffer, buildWeeklyReview,
  ADD_DAY_MAX, ADD_DAY_COOLDOWN_DAYS, ADD_DAY_MIN_RUNWAY_WEEKS, ADD_DAY_MIN_WEEKS_ON_PLAN,
  type AddDayInput,
} from "../src/adapt/weekly-review.ts";

/**
 * ⚠️ FREQUENCY IS THE ONE FITT AXIS THE PLAN NEVER PROGRESSED — measured flat in 81.3% of blocks by the
 * 2026-08-06 audit, and never rising by even one day. The runner chose their days at setup and nothing
 * ever revisited it.
 *
 * ⚠️ THE APP ASKS; IT NEVER ADDS. Accepting rewrites every week ahead, which is the owner's explicit
 * instruction ("that's the whole point of the app. It adapts and changes based on the runner") — and
 * exactly why the question must be asked plainly and a "no" must stick.
 */
const base: AddDayInput = {
  daysPerWeek: 4,
  phase: "build",
  weeksRemaining: 12,
  weeksOnPlan: 6,
  recentWeeks: [
    { prescribedRuns: 4, completedRuns: 4 },
    { prescribedRuns: 4, completedRuns: 4 },
    { prescribedRuns: 4, completedRuns: 3 },
  ],
  experience: "recreational",
  todayIso: "2026-08-06",
};

test("a runner who is getting it done is offered another day", () => {
  const offer = addDayOffer(base);
  assert.ok(offer, "no offer for a consistent runner with a long block left");
  assert.equal(offer!.kind, "add-a-day");
  assert.equal((offer as any).from, 4);
  assert.equal((offer as any).to, 5);
  // The evidence has to be IN the sentence — a runner who cannot see why cannot disagree with it.
  assert.match(offer!.why, /11 of the last 12/);
});

test("⚠️ someone MISSING sessions is never asked to do more", () => {
  // The whole gate. Without it the app cheerfully asks a struggling runner for another day, which is how
  // a coaching app loses somebody.
  const missing = addDayOffer({ ...base, recentWeeks: [
    { prescribedRuns: 4, completedRuns: 2 },
    { prescribedRuns: 4, completedRuns: 2 },
    { prescribedRuns: 4, completedRuns: 3 },
  ] });
  assert.equal(missing, null);
});

test("every refusal is a real one", () => {
  const cases: [string, Partial<AddDayInput>][] = [
    ["in the peak phase", { phase: "peak" }],
    ["in the taper", { phase: "taper" }],
    ["a beginner", { experience: "beginner" }],
    ["already at the ceiling", { daysPerWeek: ADD_DAY_MAX }],
    ["not enough block left", { weeksRemaining: ADD_DAY_MIN_RUNWAY_WEEKS - 1 }],
    ["barely started the plan", { weeksOnPlan: ADD_DAY_MIN_WEEKS_ON_PLAN - 1 }],
    ["unwell", { unwell: true }],
    ["returning from injury", { returningFromInjury: true }],
    ["already being told to ease off", { easingSuggested: true }],
    ["not enough weeks of evidence", { recentWeeks: [{ prescribedRuns: 4, completedRuns: 4 }] }],
  ];
  for (const [why, patch] of cases) {
    assert.equal(addDayOffer({ ...base, ...patch }), null, `offered a day while ${why}`);
  }
});

test("⚠️ the seventh day is never offered automatically", () => {
  // Six days leaves a rest day. The seventh means none at all, and the evidence report reserves that
  // for athletes with oversight — it must never arrive from a prompt the runner just taps through.
  assert.equal(ADD_DAY_MAX, 6);
  assert.equal(addDayOffer({ ...base, daysPerWeek: 6 }), null);
  const five = addDayOffer({ ...base, daysPerWeek: 5 });
  assert.equal((five as any)?.to, 6, "should still be able to reach six");
});

test("a no is remembered for two months, not until tomorrow", () => {
  const justSaidNo = addDayOffer({ ...base, lastDeclinedIso: "2026-08-01" });
  assert.equal(justSaidNo, null, "re-asked days after being declined");
  // One day past the cooldown it may ask again.
  const longAgo = new Date(Date.parse("2026-08-06T00:00:00Z") - (ADD_DAY_COOLDOWN_DAYS + 1) * 86400000)
    .toISOString().slice(0, 10);
  assert.ok(addDayOffer({ ...base, lastDeclinedIso: longAgo }), "never asks again after a single no");
});

test("the review asks at most ONE question, and a pace change wins", () => {
  // ⚠️ Adding a day rewrites the whole block, so it is last in the order: a pace decision is about work
  // already done and is more immediate. Asking both guarantees one is dismissed unread.
  const review = buildWeeklyReview({
    runs: [{ id: 1, type: "easy", distKm: 8, dateIso: "2026-08-04" } as any],
    flags: { flags: [], suggestion: { action: "anchor", direction: "faster", proposedRecent5kSeconds: 1450, basis: "pace" } } as any,
    weekStartIso: "2026-08-03",
    todayIso: "2026-08-06",
    addDay: base,
  });
  assert.equal(review.suggestion?.kind, "adjust-paces", "the day offer displaced the pace decision");
});

test("with nothing more pressing, the review does carry the offer", () => {
  const review = buildWeeklyReview({
    runs: [{ id: 1, type: "easy", distKm: 8, dateIso: "2026-08-04" } as any],
    flags: { flags: [], suggestion: null } as any,
    // A trial done recently, so a retest is not due and cannot take the slot.
    lastTrialIso: "2026-08-01",
    weekStartIso: "2026-08-03",
    todayIso: "2026-08-06",
    addDay: base,
  });
  assert.equal(review.suggestion?.kind, "add-a-day");
  assert.equal(review.quiet, false);
});

test("a caller that supplies no evidence never gets the offer by accident", () => {
  const review = buildWeeklyReview({
    runs: [{ id: 1, type: "easy", distKm: 8, dateIso: "2026-08-04" } as any],
    flags: { flags: [], suggestion: null } as any,
    lastTrialIso: "2026-08-01",
    weekStartIso: "2026-08-03",
    todayIso: "2026-08-06",
  });
  assert.notEqual(review.suggestion?.kind, "add-a-day");
});

test("accepting goes through the app's own rebuild path, not a hand-assembled plan", () => {
  // ⚠️ Reads the BUILT page: setting PLAN by hand is a documented trap in this repo — it skips
  // normalizeWeekStarts and leaves iOS reminders and the watch holding the old schedule. Accepting must
  // bump daysPerWeek and go through recompute()/adoptPlan, then restore today's ticks.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function applyAddDay(");
  assert.ok(at > 0, "applyAddDay is not in the build");
  const body = html.slice(at, html.indexOf("function declineAddDay", at));
  assert.match(body, /profile\.daysPerWeek = /, "does not change the runner's days");
  assert.match(body, /recompute\(\)/, "does not rebuild the plan — the weeks ahead would not change");
  assert.match(body, /restoreTicks/, "loses today's ticked sessions across the rebuild");
  assert.match(body, /saveProfileStore\(\)/, "does not persist the change");
  // And the decline must be remembered as a date, or the cooldown cannot work.
  assert.match(html, /interun_addday_v1/, "a declined offer is not remembered anywhere");
});
