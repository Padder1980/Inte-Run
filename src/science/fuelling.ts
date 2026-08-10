// Race and long-run fuelling: what to take, when, and how much.
//
// ⚠️ PROVENANCE — THIS IS THE ONE AREA WITH NO BACKING FROM THE COMMISSIONED EVIDENCE REPORT.
// `Evidence_Based_Running_Training_Prescription_Engine.html` scopes itself to training
// prescription and says nothing about nutrition: zero occurrences of carbohydrate, fuel, gel,
// glycogen or hydration in its prose. So the numbers here come from ordinary sports-nutrition
// consensus (the 30–60 g/h and 90 g/h multiple-transportable-carbohydrate figures are long
// established). ⚠️ It also USED to take the owner's elite-coach source, who gave 70–90 g/h for the
// marathon; that floor was removed on 2026-08-10 (see the rehearsal branch below) because lifting the
// bottom of the band made an unpractised rate the default. The provenance note stays because the
// distinction between what we can defend and what we cannot is the whole point of this comment.
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
      // ⚠️ "TAKING GELS ADDS NOTHING" WAS AN ABSOLUTE THE EVIDENCE DOES NOT SUPPORT. A carbohydrate
      // mouth rinse or a small intake does produce a performance signal in hard efforts approaching an
      // hour — optional, and unnecessary for a training run, but not nothing. An overstatement here
      // costs the runner's trust in the numbers below, which they do need.
      points: [
        "Under about 75 minutes a fed runner has enough stored carbohydrate — you do not need to fuel during this one.",
        "A small amount can help some hard efforts approaching an hour or longer, but it is optional in training.",
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

  // A long run carrying goal-race-pace work is the session that rehearses race day, so it is fuelled
  // like race day — with the runner's PRODUCTS and TIMINGS, which is what the rehearsal is for.
  //
  // ⚠️ THE RATE IS NO LONGER LIFTED TO 70–90 g/h FOR THE MARATHON (was, from the owner's elite-coach
  // source; changed 2026-08-10 per the fuelling brief §16). The evidence-based public band is 60–90,
  // and forcing the bottom of it up to 70 made a rate the runner has never practised the DEFAULT for
  // any qualifying long run — the opposite of the "start low and build" instruction printed two lines
  // below it. A practised individual target is a later personalisation, not a floor applied to
  // everybody. So the rehearsal now changes the copy and not the numbers, which is the honest split.
  //
  // ⚠️ A REHEARSAL HAS TO BE LONG ENOUGH TO BE ONE. Gating on race-pace work alone called a
  // 113-minute progressive a dress rehearsal and jumped it straight out of the 30–60 tier. It must
  // already be in the long tier before the race-day framing applies.
  const rehearsal = Boolean(input.hasRacePaceWork) && long &&
    (raceDistance === "marathon" || raceDistance === "half");

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
  // ⚠️ GRAMS PER HOUR LEADS; THE GEL COUNT IS A UNIT OF MEASUREMENT BEHIND IT. GEL_GRAMS is a fair
  // middle, not nutrition data — real products run 20–30 g — so every line that converts to gels
  // carries "check the label; products vary" beside it. Without that the estimate reads as a fact
  // about the packet in the runner's hand, and they under- or over-shoot by a third.
  points.push(
    `Aim for <b>${perHour.min}–${perHour.max} g of carbohydrate an hour</b> — about ${total.min}–${total.max} g across this run. ` +
    `That is roughly ${gels.min === gels.max ? gels.min : `${gels.min}–${gels.max}`} gel${gels.max === 1 ? "" : "s"}' worth, ` +
    "though check the label; products vary. " +
    "Sports drink, chews and ordinary food count towards it too; most people split it rather than taking it all as gels.",
  );
  points.push(
    `Start at about <b>${firstAtMinutes} minutes</b>, then one every ${everyMinutes} minutes or so. ` +
    "Fuel before you feel you need it — once you are empty it is too late to catch up.",
  );
  if (long) {
    // ⚠️ THE ABSORPTION CLAIM IS TRUE; THE CAUSAL ONE WAS NOT. "One sugar type is what causes the gel
    // stomach-ache" made a single mechanism the villain, so a runner who followed it and still felt
    // sick had nothing left to change. Gut symptoms are multifactorial (Costa et al. 2025) — total
    // intake, drink concentration, heat, pace and fluid balance all contribute — and naming them is
    // what makes "build gradually and practise" a usable instruction rather than a platitude.
    points.push(
      "Above about 60 g an hour, <b>mixed sugars</b> absorb better than one type alone (glucose or maltodextrin " +
      "<i>and</i> fructose — most modern gels and drinks say so on the packet). " +
      "High intakes, concentrated products, heat, pace and fluid balance can all upset a stomach, so build it up and practise.",
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
  // ⚠️ "SODIUM RATHER THAN PLAIN WATER" NAMED THE WRONG DANGER, AND IT IS THE ONE SENTENCE HERE THAT
  // COULD HARM SOMEBODY. Exercise-associated hyponatraemia is driven by drinking beyond your losses,
  // and a sports drink can be over-consumed exactly as water can — so a line that contrasts sodium
  // WITH water implies the sodium is the protection. It is not. Volume is the risk; sodium replaces
  // part of what is lost. The two halves of this sentence must never be separated.
  points.push(
    "Drink to thirst on most runs. On anything long or hot, use a fluid plan you have practised and " +
    "consider <b>sodium</b> to replace sweat losses. Do not over-drink water <i>or</i> sports drink — " +
    "sodium does not make excess fluid safe.",
  );

  const headline = rehearsal
    ? `Rehearse race fuelling: ${perHour.min}–${perHour.max} g of carbs an hour`
    : `Fuel this one: ${perHour.min}–${perHour.max} g of carbs an hour`;

  return { needed: true, perHour, total, firstAtMinutes, everyMinutes, gels, headline, points, rehearsal };
}
