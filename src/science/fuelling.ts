// Race and long-run fuelling: what to take, when, and how much.
//
// ⚠️ PROVENANCE — THIS IS THE ONE AREA WITH NO BACKING FROM THE COMMISSIONED EVIDENCE REPORT.
// `Evidence_Based_Running_Training_Prescription_Engine.html` scopes itself to training
// prescription and says nothing about nutrition: zero occurrences of carbohydrate, fuel, gel,
// glycogen or hydration in its prose. So the numbers here come from ordinary sports-nutrition
// consensus (the 30–60 g/h and 90 g/h multiple-transportable-carbohydrate figures are long
// established) and from the owner's elite-coach source, who gave 70–90 g/h for the marathon.
// Do not describe this module as evidence-report-backed; it is not, and the distinction is the
// difference between a claim we can defend and one we cannot.
//
// ⚠️ THE FRAMING IS ALWAYS "EAT ENOUGH", NEVER "EAT LESS". Running apps are used by people with
// disordered eating, and this module sits beside a RED-S screen whose guidance is explicitly
// "under-eating is not the answer here — if anything you likely need more fuel". Nothing here may
// contradict that: no calorie counts, no weight framing, no deficit language. Fuelling is
// presented as a performance tool the runner is probably under-using.

import type { RaceDistanceKey, SessionType } from "../domain/types.ts";

export type CarbRange = { min: number; max: number };

export type FuellingPlan = {
  /** False for anything short enough to run on stored carbohydrate alone. */
  needed: boolean;
  /** Grams of carbohydrate per hour. Null when none is needed. */
  perHour: CarbRange | null;
  /** Grams across the whole session, rounded to something a person can act on. */
  total: CarbRange | null;
  /** Minutes in to take the first one — deliberately before it is needed. */
  firstAtMinutes: number | null;
  /** Roughly how often after that, in minutes. */
  everyMinutes: number | null;
  /** The same total expressed in typical gels, because that is how people carry it. */
  gels: CarbRange | null;
  /** One line for the session card. */
  headline: string;
  /** The detail, in the order it matters. */
  points: string[];
  /** True when this session is the place to rehearse race-day intake exactly. */
  rehearsal: boolean;
};

/**
 * Below this, a fed runner has enough stored carbohydrate and mid-run fuel is noise. The app has
 * used ~75 minutes in its Support article and assistant since long before this module.
 */
const NO_FUEL_BELOW_MIN = 75;

/** A typical single gel. Real ones run 20–30 g; 22 is a fair middle for "how many do I carry". */
const GEL_GRAMS = 22;

/** Whether goal-race pace inside this session makes it a race-day rehearsal. */
export type FuellingInput = {
  durationMinutes: number;
  raceDistance: RaceDistanceKey;
  sessionType: SessionType;
  /** The session carries a real block at goal-race pace (see longRunFor). */
  hasRacePaceWork?: boolean;
};

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function fuellingFor(input: FuellingInput): FuellingPlan {
  const { durationMinutes: min, raceDistance, sessionType } = input;
  const hours = min / 60;

  if (min < NO_FUEL_BELOW_MIN || sessionType === "rest" || sessionType === "strength" ||
      sessionType === "mobility" || sessionType === "cross-training") {
    return {
      needed: false,
      perHour: null, total: null, firstAtMinutes: null, everyMinutes: null, gels: null,
      headline: "No fuel needed during this one.",
      points: [
        "Under about 75 minutes you have enough stored carbohydrate to run on — taking gels adds nothing.",
        "What matters is turning up fuelled: eating normally beforehand, and eating properly afterwards.",
      ],
      rehearsal: false,
    };
  }

  // ⚠️ THE UPPER TIER NEEDS MIXED SUGARS TO BE ABSORBABLE. The gut tops out near 60 g/h on glucose
  // alone; going beyond it requires glucose plus fructose, which use different transporters. A
  // product that says "90 g/h" without saying "mixed" is telling the runner to make themselves
  // sick, so the tier and the note are one decision, never separated.
  const long = min >= 150;
  const perHour: CarbRange = long ? { min: 60, max: 90 } : { min: 30, max: 60 };

  // Marathon-pace work is where the coach's 70–90 g/h belongs: this is the session that rehearses
  // race day, so it is fuelled like race day rather than like a training run.
  //
  // ⚠️ A REHEARSAL HAS TO BE LONG ENOUGH TO BE ONE. Gating on race-pace work alone called a
  // 113-minute progressive a dress rehearsal and prescribed 70–90 g/h for under two hours — a
  // mid-block session dressed up as race day, and a jump straight from the 30–60 tier. It must
  // already be in the long tier before the race-day rate applies.
  const rehearsal = Boolean(input.hasRacePaceWork) && long &&
    (raceDistance === "marathon" || raceDistance === "half");
  if (rehearsal && raceDistance === "marathon") {
    perHour.min = Math.max(perHour.min, 70);
    perHour.max = 90;
  }

  const total: CarbRange = {
    min: roundTo(perHour.min * hours, 5),
    max: roundTo(perHour.max * hours, 5),
  };
  const gels: CarbRange = {
    min: Math.max(1, Math.round(total.min / GEL_GRAMS)),
    max: Math.max(1, Math.round(total.max / GEL_GRAMS)),
  };
  // Cadence from the middle of the band — a gel's worth every N minutes.
  const midPerHour = (perHour.min + perHour.max) / 2;
  const everyMinutes = roundTo((GEL_GRAMS * 60) / midPerHour, 5);
  const firstAtMinutes = min >= 120 ? 30 : 40;

  const points: string[] = [];
  // ⚠️ "Gels' worth", not "gels". At 90 g/h a three-hour run is eleven gels, which nobody takes and
  // which reads as absurd on a session card — real runners split it across gels, drink mix and
  // chews. The gel count is a unit of measurement here, not a shopping list, and the copy has to
  // say so or the whole number gets dismissed.
  points.push(
    `Aim for <b>${perHour.min}–${perHour.max} g of carbohydrate an hour</b> — about ${total.min}–${total.max} g across this run, ` +
    `which is ${gels.min === gels.max ? gels.min : `${gels.min}–${gels.max}`} gel${gels.max === 1 ? "" : "s"}' worth. ` +
    "Sports drink and chews count towards it too; most people split it rather than taking it all as gels.",
  );
  points.push(
    `Start at about <b>${firstAtMinutes} minutes</b>, then one every ${everyMinutes} minutes or so. ` +
    "Fuel before you feel you need it — once you are empty it is too late to catch up.",
  );
  if (long) {
    points.push(
      "Above 60 g an hour you need <b>mixed sugars</b> (glucose <i>and</i> fructose — most modern gels and drinks say so on the packet). " +
      "Your gut can only take on so much of one type, which is what causes the classic gel stomach-ache.",
    );
  }
  points.push(
    "<b>Build up gradually.</b> Your gut trains like your legs do — start at the bottom of the range and add over the weeks, " +
    "rather than trying the top of it for the first time on race day.",
  );
  if (rehearsal) {
    points.push(
      "<b>This is the rehearsal.</b> Use the exact gels, drinks and timings you plan to use on race day — same brand, same flavour, same schedule. " +
      "This session exists to find out what your stomach thinks of them while it still doesn't matter.",
    );
  }
  points.push(
    "Drink to thirst, and on anything long or hot include <b>sodium</b> rather than plain water alone.",
  );

  const headline = rehearsal
    ? `Rehearse race fuelling: ${perHour.min}–${perHour.max} g of carbs an hour`
    : `Fuel this one: ${perHour.min}–${perHour.max} g of carbs an hour`;

  return { needed: true, perHour, total, firstAtMinutes, everyMinutes, gels, headline, points, rehearsal };
}
