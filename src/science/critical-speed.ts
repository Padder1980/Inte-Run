// Critical speed (brief §1). The brief singles this out because it can be estimated from field
// performances rather than a lab: across efforts of different durations, distance is very nearly
// linear in time —  d = CS·t + D'  — where the slope CS (critical speed) is the asymptote of the
// speed–duration relationship (near the heavy/severe boundary) and the intercept D' is a finite
// distance capacity above it. Two efforts give a line; three or more let us judge the fit.
//
// Treated as an estimate, never "divine revelation delivered by an algorithm" — the relationship
// between critical speed, the first threshold and training zones varies between runners.

import type { Confidence } from "./estimate.ts";

export type Effort = { distanceMeters: number; timeSeconds: number };

export type CriticalSpeedModel = {
  criticalSpeedMps: number;
  dPrimeMeters: number;
  /** CS expressed as a pace, for display alongside training paces. */
  csPaceSecPerKm: number;
  rSquared: number;
  nEfforts: number;
  confidence: Confidence;
  limitations?: string;
};

/** Efforts in roughly this window best satisfy the linear model (very short/long efforts distort it). */
const IDEAL_MIN_S = 120;
const IDEAL_MAX_S = 1200;

/**
 * Fit critical speed and D' from two or more efforts by least-squares on d = CS·t + D'.
 * Requires efforts of differing duration; throws otherwise.
 */
export function fitCriticalSpeed(efforts: Effort[]): CriticalSpeedModel {
  const pts = efforts.filter((e) => e.distanceMeters > 0 && e.timeSeconds > 0);
  if (pts.length < 2) throw new Error("critical speed needs at least two efforts");
  const times = pts.map((p) => p.timeSeconds);
  if (Math.max(...times) - Math.min(...times) < 1) {
    throw new Error("efforts must differ in duration");
  }

  const n = pts.length;
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = pts.reduce((a, p) => a + p.distanceMeters, 0);
  const sumXY = pts.reduce((a, p) => a + p.timeSeconds * p.distanceMeters, 0);
  const sumXX = times.reduce((a, t) => a + t * t, 0);
  const denom = n * sumXX - sumX * sumX;
  const cs = (n * sumXY - sumX * sumY) / denom; // slope = critical speed (m/s)
  const dPrime = (sumY - cs * sumX) / n; // intercept = D' (m)

  // R² of the fit.
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of pts) {
    const pred = cs * p.timeSeconds + dPrime;
    ssRes += (p.distanceMeters - pred) ** 2;
    ssTot += (p.distanceMeters - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const limitations: string[] = [];
  if (cs <= 0) limitations.push("The efforts don't fit the model well — add efforts of clearly different durations.");
  if (dPrime < 0) limitations.push("Negative distance capacity suggests noisy inputs; treat with caution.");
  if (Math.min(...times) < IDEAL_MIN_S) limitations.push("Very short efforts (<2 min) can inflate the estimate.");
  if (Math.max(...times) > IDEAL_MAX_S) limitations.push("Very long efforts (>20 min) drift below true critical speed.");

  // Confidence: field estimate, so never "high". Better with 3+ well-fitting, well-spaced efforts.
  let confidence: Confidence;
  if (cs <= 0) confidence = "none";
  else if (n >= 3 && rSquared >= 0.995 && limitations.length === 0) confidence = "moderate";
  else if (n >= 3 && rSquared >= 0.98) confidence = "low";
  else confidence = "low"; // exactly two efforts: a line, but unverifiable — keep it low

  return {
    criticalSpeedMps: Math.round(cs * 1000) / 1000,
    dPrimeMeters: Math.round(dPrime),
    csPaceSecPerKm: cs > 0 ? Math.round(1000 / cs) : 0,
    rSquared: Math.round(rSquared * 1000) / 1000,
    nEfforts: n,
    confidence,
    limitations: limitations.length ? limitations.join(" ") : undefined,
  };
}

/** Predicted time (s) to cover a distance at this model: t = (d − D') / CS. */
export function predictTimeFromModel(model: CriticalSpeedModel, distanceMeters: number): number {
  if (model.criticalSpeedMps <= 0) throw new Error("model has no valid critical speed");
  return (distanceMeters - model.dPrimeMeters) / model.criticalSpeedMps;
}

/** Predicted distance (m) covered in a given time at this model: d = CS·t + D'. */
export function predictDistanceFromModel(model: CriticalSpeedModel, timeSeconds: number): number {
  return model.criticalSpeedMps * timeSeconds + model.dPrimeMeters;
}
