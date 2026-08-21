/**
 * THE SHARE CARD'S DETERMINISTIC FIXTURES — THE PACK'S OWN REFERENCE VALUES, IN TEST CODE ONLY.
 *
 * ⚠️ THE BRIEF FORBIDS THESE VALUES REACHING A PRODUCTION TEMPLATE, in as many words: "do not hard-code
 * the example athlete/activity values into production templates". They live here so a preview, a
 * screenshot harness and a test can all draw the SAME card as the references without any of them
 * appearing in web/app.ts. Nothing in this file is imported by the app.
 *
 * ⚠️ THE FIXTURES CARRY THE HARD SHAPES, NOT ONLY THE TIDY ONE. This project has twice certified a
 * layout against a fixture no plan produces — a debrief target line short enough to fit, a pband of the
 * wrong shape — so the treadmill run with no distance, the watch run with no cadence and no recoverable
 * start time, the wholly estimated run and the interval run with no band at all are all here beside the
 * pack's clean one.
 *
 * ⚠️ AND THE SHAPES ARE THE APP'S OWN. run.steps is an ARRAY OF ROWS ({tag,lab,tgt,rec}); run.pband is
 * a PaceRange ({minSecPerKm,maxSecPerKm}); run.rband is {min,max}. Feeding the wrong shape produces NaN
 * and reads like a product defect: it has already cost one investigation into a pace panel that was
 * rendering six dots and no line.
 */

/**
 * ⚠️ THE ID IS A CLOCK READING, NOT A LABEL. liveRunRecord stamps id: "run-" + Date.now() and
 * dateIso: todayIso() one line apart, so a real run's id and its date always agree — and
 * runStartMsKnown reads the time of day back out of the id. A hand-picked id beside a hand-picked date
 * is data no builder can produce, and three guards once read the wrong year out of one and reported it
 * as a defect in the app. Derived from one stated instant instead.
 * ⚠️ NOON UTC, so the UTC date holds in every timezone the suite might run in.
 */
export const REF_END_MS = Date.UTC(2026, 7, 18, 12, 0, 4);
export const REF_SEC_A = 1864;   // 31:04
export const REF_SEC_B = 2142;   // 35:42

/** The pack's stated reference values, so a template's output can be compared with the brief itself. */
export const REF_VALUES = {
  session: "Easy Run",
  locationA: "Hartlepool", locationB: "Durham",
  date: "18 Aug 2026",
  distanceA: 5.51, distanceB: 6.31,
  timeA: "31:04", timeB: "35:42",
  paceA: "5:38", paceB: "5:40",
  elevation: 11,
  targetA: [320, 350], targetB: [320, 370],
  adherenceA: [5, 6], adherenceB: [6, 6],
  splitsA: [351, 337, 336, 333, 334],
  /** The reference's sixth row is the FINAL PART-KILOMETRE — a derived pace, not a stored split. */
  tailA: { km: 0.51, secPerKm: 333 },
  splitsB: [351, 337, 336, 333, 334, 340],
};

function localStamp(endMs: number, sec: number): string {
  const d = new Date(endMs - sec * 1000);
  return d.getDate() + " Aug · " + String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}

/** A there-and-back along a river path: 120 points, enough to survive 250 m end redaction. */
export const REF_ROUTE: any[] = (() => {
  const pts: any[] = [];
  for (let i = 0; i < 60; i++) pts.push({ lat: 54.7768 + i * 0.0004, lng: -1.5757 + i * 0.00012, t: i * 30 });
  for (let i = 59; i >= 0; i--) pts.push({ lat: 54.7768 + i * 0.0004, lng: -1.5751 + i * 0.00012, t: 1800 + (59 - i) * 30 });
  return pts;
})();

/** The pack's variant A: 5.51 km in 31:04 at 5:38/km, target 5:20-5:50, Hartlepool. */
export function refRunA(over: any = {}): any {
  return {
    id: "run-" + REF_END_MS, t: "40′ easy + strides", type: "easy",
    d: localStamp(REF_END_MS, REF_SEC_A), dateIso: "2026-08-18",
    dist: "5.51 km", distKm: 5.51, time: "31:04", sec: REF_SEC_A, pace: "5:38 /km", avgPaceSec: 338,
    splits: REF_VALUES.splitsA.map((sec, i) => ({ km: i + 1, sec: sec })),
    pband: { minSecPerKm: 320, maxSecPerKm: 350 }, pwin: { s: 0, e: 5510 }, pmix: null,
    rband: { min: 2, max: 4 }, rpe: 3, anchor: 1500, pmodel: "3",
    elevGain: 11, avgHr: 148, maxHr: 163, cadence: 158, kcal: null,
    route: REF_ROUTE, place: "Hartlepool, County Durham, England",
    steps: [{ tag: "Work", lab: "40′ easy", tgt: "5:20–5:50/km", rec: "" }],
    ...over,
  };
}
/** The pack's variant B: 6.31 km in 35:42 at 5:40/km, target 5:20-6:10, Durham, 6 of 6 on target. */
export function refRunB(over: any = {}): any {
  return refRunA({
    id: "run-" + (REF_END_MS + 1000), t: "36′ easy run",
    d: localStamp(REF_END_MS + 1000, REF_SEC_B),
    dist: "6.31 km", distKm: 6.31, time: "35:42", sec: REF_SEC_B, pace: "5:40 /km", avgPaceSec: 340,
    splits: REF_VALUES.splitsB.map((sec, i) => ({ km: i + 1, sec: sec })),
    pband: { minSecPerKm: 320, maxSecPerKm: 370 }, pwin: { s: 0, e: 6310 },
    place: "Durham, County Durham, England",
    steps: [{ tag: "Work", lab: "36′ easy", tgt: "5:20–6:10/km", rec: "" }],
    ...over,
  });
}
/** Every split estimated: the pocketed-phone case, and the false ACCUSATION the model gates on. */
export const allEstRun = () =>
  refRunA({ id: "run-est", splits: refRunA().splits.map((s: any) => ({ ...s, est: true })) });
/** Two of five estimated: still reaches a pace branch, so the badge is drawn with the qualification. */
export const partEstRun = () => refRunA({
  id: "run-part",
  splits: [{ km: 1, sec: 351, est: true }, { km: 2, sec: 337 }, { km: 3, sec: 336 },
           { km: 4, sec: 333 }, { km: 5, sec: 334, est: true }],
});
/** A treadmill run: a real clock, deliberately no distance, no route and no splits. */
export const treadmillRun = () => ({
  id: "run-tread", t: "Treadmill easy", type: "easy", d: "18 Aug · 06:02", dateIso: "2026-08-18",
  dist: "0.00 km", distKm: 0, time: "34:00", sec: 2040, pace: "— /km", avgPaceSec: 0,
  splits: [], route: [], indoor: true, elevGain: 0, avgHr: 141, maxHr: null, cadence: null, kcal: null,
  pband: null, pwin: null, pmix: null, rband: { min: 2, max: 4 }, rpe: 3, steps: [],
});
/**
 * A wrist run FROM BEFORE THE WATCH SENT EITHER (a UUID id, no startMs, no route timestamps), which
 * is the case that still has to work: a watch on an older build, and every wrist run already stored.
 * No start time is recoverable from it, so no time of day is printed and it goes to Strava as a
 * manual activity. A wrist run that DOES carry both is exercised in test/watch-route-thinning.test.ts.
 */
export const watchRun = (over: any = {}) => refRunA({
  id: "9E1C3A62-7B41-4E0A-9C77-1D2F0B8A5E33", cadence: null, kcal: 402,
  route: REF_ROUTE.map((p) => ({ lat: p.lat, lng: p.lng })),
  ...over,
});
/** An interval session: paceStampFor deliberately gives it no band at all. */
export const intervalRun = () => refRunA({
  id: "run-int", t: "10 × 1′ hard / 1′ jog", type: "vo2",
  pband: null, pwin: null, pmix: "reps", rband: { min: 6, max: 8 }, rpe: 7,
  splits: [{ km: 1, sec: 420 }, { km: 2, sec: 400 }, { km: 3, sec: 410 }, { km: 4, sec: 405 }],
});
/** A run that STARTED on one UTC day and FINISHED on the next: the date-basis discriminator. */
export const midnightRun = () => refRunA({
  id: "run-" + Date.UTC(2026, 7, 18, 0, 20, 0), sec: 3600, time: "60:00", dateIso: "2026-08-18",
});

/**
 * THE EIGHT HOSTILE GROUNDS, as a description rather than as pixels — the browser harness paints them
 * (scratchpad/share/work/p2/inject.js) and this list is what a test can assert the harness covered.
 * ⚠️ A CONTRAST CLAIM MEASURED ON ONE PLEASANT PHOTOGRAPH IS NOT A CLAIM. Each of these breaks a
 * different assumption: a flat maximum, a bright textured field, a dark ground that must earn NO
 * treatment, a mid-tone with high variance, a hard luminance split, high-frequency detail, a gradient
 * that is dark where the copy is and bright where it is not, and a landscape source cropped to portrait.
 */
export const HOSTILE_GROUNDS = ["white", "snow", "dark_wood", "busy_mid", "split", "detail",
  "sunset", "beach_wide"];
