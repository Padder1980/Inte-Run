// Maximal Aerobic Speed (MAS) from a 1 km max-effort time trial. Widely used by running and
// field-sport coaches: a simple field test (measured route + stopwatch) that gives a clean anchor
// for interval pacing. A 1 km all-out is run at roughly the velocity that elicits VO₂max, so:
//
//   MAS (m/s) = 1000 / (1 km time in seconds)
//
// Interval targets are set as percentages of MAS, each driving a different adaptation.

import type { PaceRange } from "../domain/types.ts";

export type MasZone = {
  key: string;
  label: string;
  /** Percentage of MAS, e.g. 100, 120, 130. */
  pct: number;
  velocityMps: number;
  paceSecPerKm: number;
  workSeconds?: number;
  restSeconds?: number;
  /** Distance covered in one work interval (metres) — useful for setting out markers. */
  repDistanceMeters?: number;
  purpose: string;
};

export type MasResult = {
  oneKmSeconds: number;
  masMps: number;
  masPaceSecPerKm: number;
  zones: MasZone[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMas(oneKmSeconds: number): MasResult {
  if (oneKmSeconds <= 0) throw new Error("1 km time must be positive");
  const masMps = 1000 / oneKmSeconds;
  const masPaceSecPerKm = 1000 / masMps; // equals oneKmSeconds

  const zone = (
    key: string,
    label: string,
    fraction: number,
    workSeconds: number | undefined,
    restSeconds: number | undefined,
    purpose: string,
  ): MasZone => {
    const velocityMps = masMps * fraction;
    return {
      key,
      label,
      pct: Math.round(fraction * 100),
      velocityMps: round2(velocityMps),
      paceSecPerKm: Math.round(1000 / velocityMps),
      workSeconds,
      restSeconds,
      repDistanceMeters: workSeconds ? Math.round(velocityMps * workSeconds) : undefined,
      purpose,
    };
  };

  const zones: MasZone[] = [
    zone("long", "Long intervals", 1.0, undefined, undefined,
      "Your 1 km pace. Hold 2–5 min reps to build maximal aerobic capacity."),
    zone("eurofit", "Eurofit 15/15", 1.2, 15, 15,
      "15s hard / 15s rest — boosts VO₂max with little lactate build-up."),
    zone("tabata", "Tabata 20/10", 1.3, 20, 10,
      "20s near-sprint / 10s rest — builds anaerobic power and high-intensity tolerance."),
  ];

  return {
    oneKmSeconds,
    masMps: round2(masMps),
    masPaceSecPerKm: Math.round(masPaceSecPerKm),
    zones,
  };
}

/** VO₂/interval training pace band from MAS: reps of 3–5 min sit around 94–100% MAS. */
export function masVo2Range(masMps: number): PaceRange {
  const fast = 1000 / masMps; // pace at 100% MAS
  const slow = 1000 / (masMps * 0.94); // pace at 94% MAS
  return { minSecPerKm: Math.round(fast), maxSecPerKm: Math.round(slow) };
}
