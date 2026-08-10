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
};

export type Severity = "none" | "mild" | "moderate" | "high" | "severe";

export type WeatherImpact = {
  summary: string;
  severity: Severity;
  /** True when today's session is best run by effort rather than pace. */
  effortBased: boolean;
  headline: string;
  /** Rough slowdown to expect at the same effort on a quality session (s/km). */
  pacePenaltySecPerKm?: number;
  points: string[];
};

const RANK: Record<Severity, number> = { none: 0, mild: 1, moderate: 2, high: 3, severe: 4 };
const worst = (a: Severity, b: Severity): Severity => (RANK[a] >= RANK[b] ? a : b);

const QUALITY = new Set<SessionType>(["threshold", "vo2", "race-specific"]);
const RUN = new Set<SessionType>(["threshold", "vo2", "race-specific", "easy", "long", "recovery", "strides"]);

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
  let pacePenalty: number | undefined;
  if (RANK[heat] >= RANK.mild && isRun) {
    pacePenalty = Math.min(30, Math.round((feels - 16) * 2.2));
    if (isQuality) {
      points.push(`Run these by effort, not the clock — expect roughly ${pacePenalty}s/km slower at the same RPE.`);
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
  const summary = `${tempWord(tempC, feels)} · ${Math.round(tempC)}°C, wind ${Math.round(windKph)} km/h`;

  return { summary, severity, effortBased, headline, pacePenaltySecPerKm: pacePenalty, points };
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
