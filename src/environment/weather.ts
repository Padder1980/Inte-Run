// Weather / environment impact on a run (brief §15). Heat raises cardiovascular strain and perceived
// effort; wind makes you work harder into it; cold mostly changes your warm-up and clothing. The
// brief's key rule: in demanding conditions, pace targets should become EFFORT-based — "asking
// someone to hold their cool-weather pace during a heatwave is not coaching". So this turns
// conditions + the kind of session into plain guidance, tuned to whether it's a quality session
// (threshold, intervals) or an easy run. It informs; it never forces.

import type { SessionType } from "../domain/types.ts";

export type Conditions = {
  tempC: number;
  humidityPct: number;
  windKph: number;
  sessionType: SessionType;
  /**
   * Dew point in °C, when the forecast supplies one.
   * ⚠️ IT IS A BETTER HUMIDITY SIGNAL THAN A PERCENTAGE, and it is what the pace model wants.
   * Relative humidity is a ratio to what the air COULD hold at that temperature, so 70% at 10°C and
   * 70% at 30°C are utterly different conditions to run in. Dew point is an absolute: it says
   * whether sweat can evaporate at all, which is the whole mechanism by which heat costs you pace.
   * Optional, and derived from humidity when absent, so no caller is forced to supply it.
   */
  dewPointC?: number;
  /**
   * How long the session is, in minutes. Heat accumulates, so the same conditions cost a two-hour
   * long run more than a twenty-minute jog. Optional; treated as an hour when absent.
   */
  minutes?: number;
};

export type Severity = "none" | "mild" | "moderate" | "high" | "severe";

export type WeatherImpact = {
  /**
   * A metric one-liner, e.g. "Mild · 12°C, wind 14 km/h".
   * ⚠️ THE APP DELIBERATELY DOES NOT RENDER THIS, and that is not an oversight to tidy away. It bakes
   * °C and km/h into prose, so a runner who has chosen Fahrenheit would be shown Celsius inside it.
   * The app composes its own line from `tempWord` plus the numbers, in whichever units were chosen.
   * Kept because it is a correct, useful summary for any caller that wants metric.
   */
  summary: string;
  /**
   * The temperature in a word — "Freezing", "Mild", "Warm" and so on — with NO units in it, so a
   * caller can pair it with a temperature it has formatted itself.
   */
  tempWord: string;
  severity: Severity;
  /** True when today's session is best run by effort rather than pace. */
  effortBased: boolean;
  headline: string;
  /**
   * How much slower the same EFFORT runs in these conditions, as a multiplier on pace.
   * 1.0 means no effect; 1.04 means four percent slower.
   *
   * ⚠️ A MULTIPLIER, NOT A FLAT s/km, AND THIS PROJECT HAS ALREADY LEARNED WHY ONCE. The old value was
   * `Math.min(30, (feels - 16) * 2.2)` — a constant number of seconds handed to everybody. That is
   * 14% of a 3:30/km runner's pace and 7% of a 7:00/km runner's, so the same weather was twice as
   * punishing to the faster runner. It is the identical fault the pace ladder had when easy pace was
   * "threshold + 92 s/km", recorded in CLAUDE.md: "a constant +92 is a 50% slowdown for a 14-minute
   * 5 km runner and 16% for a 45-minute one". The gears became MULTIPLES of threshold; this is the
   * same correction, in the same units, for the same reason.
   *
   * ⚠️ IT IS ALSO A TRANSFORM, WHICH IS WHAT KEEPS ONE PACE TABLE. paces.ts:89 says "there is still
   * exactly ONE pace table". A multiplier over the bands that table produces is not a second table;
   * an additive offset alongside it effectively was.
   */
  paceFactor: number;
  /**
   * True when the conditions are past the point where a pace target should be offered at all.
   * ⚠️ Distinct from `effortBased`, which is advice. This says the MODEL itself should not be used:
   * above about 35°C the research it rests on runs out of data, so the honest answer is to move the
   * session rather than to print a number derived from an extrapolation.
   */
  beyondModel: boolean;
  points: string[];
};

const RANK: Record<Severity, number> = { none: 0, mild: 1, moderate: 2, high: 3, severe: 4 };
const worst = (a: Severity, b: Severity): Severity => (RANK[a] >= RANK[b] ? a : b);

const QUALITY = new Set<SessionType>(["threshold", "vo2", "race-specific"]);
const RUN = new Set<SessionType>(["threshold", "vo2", "race-specific", "easy", "long", "recovery", "strides"]);

/**
 * Dew point from temperature and relative humidity — the Magnus approximation.
 * Used only when a forecast has not supplied a real one. Accurate to a few tenths of a degree over
 * the range anybody runs in, which is far inside the precision this model claims.
 */
export function dewPointFrom(tempC: number, humidityPct: number): number {
  const rh = Math.min(100, Math.max(1, humidityPct));
  const g = Math.log(rh / 100) + (17.625 * tempC) / (243.04 + tempC);
  return (243.04 * g) / (17.625 - g);
}

/**
 * THE HEAT PACE MODEL — how much slower the same effort runs, as a multiplier.
 *
 * ⚠️ EVERY CONSTANT HERE IS ANCHORED, WHICH THE ONE IT REPLACES WAS NOT. The old formula was
 * `(feels - 16) * 2.2` capped at 30, with no source in the file for the 2.2, the 16 or the 30, and
 * measured about two and a half times too aggressive against the literature.
 *
 * The anchor is the model published at apps.runningwritings.com/heat-adjusted-pace/, fitted to
 * 3,891 marathon runners across 754 races (Mantzios et al., 2022): at 29.4°C air with a 21.1°C dew
 * point, a marathon runs about 4% slower for the same effort. `HEAT_K` is set so this function
 * returns exactly that for a marathon-length run in those conditions, and nothing else was tuned.
 *
 * ⚠️ WHAT IT CLAIMS IS EQUIVALENT EFFORT, NOT EQUIVALENT TRAINING BENEFIT (owner's ruling,
 * 2026-08-16). The source model is explicit that it predicts effort, and that "heat adaptation and
 * individual variation in heat tolerance play a major role". Competitors word this as maintaining
 * "the same training benefits"; that is a stronger claim than the evidence carries, and this app
 * does not make claims it cannot defend — the same rule that governs the stretch and fuelling copy.
 *
 * ⚠️ ITS LIMITS, FROM THE SOURCE'S OWN DISCLAIMERS, and each one is handled rather than ignored:
 *  - Unreliable above about 35°C, where the data thins out → `beyondModel`, and no number offered.
 *  - Built on marathon data, so it overstates short events → scaled by duration below.
 *  - Possible survivor bias, so it may UNDERstate the effect for ordinary runners → which is why
 *    the effort-based advice stays in place on top of it rather than being replaced by a number.
 */
const HEAT_BASE_C = 15;      // below this, running is not heat-limited; the literature's ideal is 7–13°C
// ⚠️ THE DEW WEIGHT IS A JUDGEMENT, NOT AN ANCHOR, AND SAYING SO IS THE POINT. One published data
// point constrains the COMBINATION of temperature and dew point, not how the effect divides between
// them, so this 0.6 cannot be derived from it — a higher weight with a correspondingly lower HEAT_K
// would fit the same anchor equally well. It is set so a degree of dew point counts for a little
// less than a degree of air temperature, which is the conservative reading. Secondary sources put
// muggy conditions higher than this model does; they measure race performance rather than
// equivalent effort, and over-slowing somebody on the strength of that is not a trade worth making.
const HEAT_DEW_WEIGHT = 0.6;
const HEAT_DEW_BASE_C = 10;  // a dew point at or under this is dry enough not to matter
const HEAT_EXP = 1.5;        // mildly superlinear: strain climbs faster than temperature does
const HEAT_K = 0.000296;     // set from the anchor above, and from nothing else
const HEAT_MAX = 0.10;       // 10% — a hard ceiling, because past it the honest answer is not a pace
const BEYOND_MODEL_C = 35;   // where the source's own data runs out

/** The duration weighting. Heat accumulates, so the same air costs a long run more than a short one. */
function heatDurationWeight(minutes: number): number {
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  // 1.0 at an hour, floored at 0.6 for very short sessions and capped at 1.4 for marathon-length
  // ones — which is the weight the 4% anchor above was measured at.
  return Math.min(1.4, Math.max(0.6, 0.6 + 0.4 * (m / 60)));
}

/**
 * Pace multiplier for the same effort. 1.0 when heat is not a factor.
 * Exported so the app can show a runner's OWN slowdown in seconds, from their own pace, rather than
 * a single number pretending to fit everybody.
 */
export function heatPaceFactor(tempC: number, dewPointC: number, minutes: number): number {
  const effective = tempC + HEAT_DEW_WEIGHT * Math.max(0, dewPointC - HEAT_DEW_BASE_C);
  const excess = effective - HEAT_BASE_C;
  if (!(excess > 0)) return 1;
  const raw = HEAT_K * Math.pow(excess, HEAT_EXP) * heatDurationWeight(minutes);
  return 1 + Math.min(HEAT_MAX, raw);
}

/** A "feels like" temperature — humidity matters more the warmer it is. */
function feelsLike(tempC: number, humidityPct: number): number {
  if (tempC < 20 || humidityPct <= 60) return tempC;
  return tempC + ((humidityPct - 60) / 40) * 4; // up to +4°C at 100% humidity
}

function heatSeverity(feels: number): Severity {
  if (feels < 18) return "none";
  if (feels < 23) return "mild";
  if (feels < 28) return "moderate";
  if (feels < 33) return "high";
  return "severe";
}
function windSeverity(kph: number): Severity {
  if (kph < 12) return "none";
  if (kph < 24) return "mild";
  if (kph < 38) return "moderate";
  if (kph < 52) return "high";
  return "severe";
}

function tempWord(tempC: number, feels: number): string {
  if (tempC < 0) return "Freezing";
  if (tempC < 6) return "Cold";
  if (feels >= 33) return "Very hot";
  if (feels >= 28) return "Hot";
  if (feels >= 23) return "Warm";
  return "Mild";
}

export function assessConditions(input: Conditions): WeatherImpact {
  const { tempC, humidityPct, windKph, sessionType } = input;
  const feels = feelsLike(tempC, humidityPct);
  const heat = heatSeverity(feels);
  const wind = windSeverity(windKph);
  const cold: Severity = tempC < 0 ? "moderate" : tempC < 6 ? "mild" : "none";
  const severity = worst(worst(heat, wind), cold);

  const isQuality = QUALITY.has(sessionType);
  const isRun = RUN.has(sessionType);
  const humid = tempC >= 20 && humidityPct >= 70;
  const points: string[] = [];

  // ---- Heat ----
  // ⚠️ THE PACE MODEL TAKES DEW POINT AND DURATION; THE SEVERITY BANDS ABOVE STILL TAKE `feels`.
  // That is deliberate and not a leftover. The bands are calibrated, tested, and drive advice; the
  // factor drives an actual change to somebody's session and had to be re-anchored to the
  // literature. Re-basing the bands on dew point as well would silently move every threshold in the
  // app, which is its own change with its own evidence, not a side effect of this one.
  const dewC = Number.isFinite(input.dewPointC as number) ? (input.dewPointC as number) : dewPointFrom(tempC, humidityPct);
  const paceFactor = isRun ? heatPaceFactor(tempC, dewC, input.minutes ?? 60) : 1;
  const beyondModel = isRun && tempC >= BEYOND_MODEL_C;
  const slowerPct = Math.round((paceFactor - 1) * 1000) / 10;
  if (RANK[heat] >= RANK.mild && isRun) {
    if (isQuality) {
      // ⚠️ "the same effort", never "the same training benefit". The source model predicts effort and
      // says individual heat tolerance varies a lot; the stronger claim is not ours to make.
      points.push(slowerPct >= 0.5
        ? `Run these by effort, not the clock — expect roughly ${slowerPct}% slower for the same effort.`
        : "Run these by effort, not the clock.");
      // ⚠️ "HYDRATE BEFOREHAND WITH ELECTROLYTES" WAS THE ONE HYDRATION LINE IN THE APP THE FUELLING
      // RECONCILIATION MISSED (fixed 2026-08-10). It contradicted the guide twice over: the guide says
      // arrive having drunk normally and do NOT load up, and it says not to take salt "just in case".
      // It also carried no volume caveat, which is the invariant that reconciliation established —
      // drinking beyond your losses is the actual danger, and electrolytes do not make it safe.
      if (RANK[heat] >= RANK.moderate) points.push("Take full recoveries between reps, and arrive normally hydrated — no need to load up beforehand. If you drink during it, something with a little sodium in it helps, without drinking more than you lose.");
      if (heat === "severe") points.push("Strongly consider moving this to a cooler time of day, or swapping it for an easy run — heat illness is a real risk.");
    } else {
      points.push("Just slow down and go by feel — effort matters far more than pace in this heat.");
      if (RANK[heat] >= RANK.moderate) points.push("Carry water on anything over ~45 minutes, and don't chase your usual pace.");
    }
    if (humid) points.push("It's humid, so sweat evaporates poorly — you'll feel it more than the temperature suggests.");
  }

  // ---- Wind ----
  if (RANK[wind] >= RANK.moderate && isRun) {
    if (isQuality) {
      points.push("Judge reps by effort — a headwind will slow your pace even at full effort, and that's fine.");
      points.push("On an out-and-back, take the headwind on the way out so you finish with it behind you.");
      if (wind === "severe") points.push("In wind this strong, a sheltered route — or moving the hard reps to a calmer day — is the smarter call.");
    } else {
      points.push("Expect to work harder into the wind; ease off and let your pace drift rather than forcing it.");
    }
  } else if (wind === "mild" && isQuality) {
    points.push("A light breeze — nothing to worry about, just be aware into the headwind sections.");
  }

  // ---- Cold ----
  if (RANK[cold] >= RANK.mild) {
    points.push("Warm up longer and keep a layer on until you're moving well.");
    if (cold === "moderate") points.push("Cover your extremities — the first efforts will feel harder, so build in gradually.");
  }

  if (points.length === 0) points.push("Near-ideal conditions — run to your planned paces.");

  const effortBased = isRun && (
    RANK[heat] >= RANK.high ||
    RANK[wind] >= RANK.high ||
    (isQuality && RANK[heat] >= RANK.moderate) ||
    (isQuality && RANK[wind] >= RANK.moderate)
  );

  const headline = buildHeadline(severity, heat, wind, cold, isQuality, effortBased);
  const word = tempWord(tempC, feels);
  const summary = `${word} · ${Math.round(tempC)}°C, wind ${Math.round(windKph)} km/h`;

  return { summary, tempWord: word, severity, effortBased, headline, paceFactor, beyondModel, points };
}

function buildHeadline(severity: Severity, heat: Severity, wind: Severity, cold: Severity, isQuality: boolean, effortBased: boolean): string {
  if (severity === "none") return "Good conditions for today's run.";
  const lead = RANK[heat] >= RANK[wind] && RANK[heat] >= RANK[cold] ? "heat" : RANK[wind] >= RANK[cold] ? "wind" : "cold";
  if (lead === "heat") {
    if (heat === "severe") return isQuality ? "Too hot for chasing paces — run by effort, or reschedule the hard work." : "It's very hot — take it easy and prioritise staying cool.";
    if (effortBased) return "Warm enough to run by effort today, not the clock.";
    return "A bit warm — stay hydrated and don't force the pace.";
  }
  if (lead === "wind") {
    if (wind === "severe") return "Strong wind — judge effort over pace, or pick a sheltered route.";
    return effortBased ? "Windy — run these by effort, not pace." : "Breezy — expect to work harder into the wind.";
  }
  return cold === "moderate" ? "Cold out — warm up well and layer up." : "A little cold — warm up longer than usual.";
}
