// Maximal Aerobic Speed (MAS) from a 2 km max-effort time trial. Widely used by running and
// field-sport coaches: it's a simple field test (measured route + stopwatch) that stresses the
// aerobic system without multi-day recovery cost, and gives a clean anchor for interval pacing.
//
//   MAS (m/s) = 2000 / (2 km time in seconds)
//
// Interval targets are set as percentages of MAS, each driving a different adaptation.

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
  twoKmSeconds: number;
  masMps: number;
  masPaceSecPerKm: number;
  zones: MasZone[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMas(twoKmSeconds: number): MasResult {
  if (twoKmSeconds <= 0) throw new Error("2 km time must be positive");
  const masMps = 2000 / twoKmSeconds;
  const masPaceSecPerKm = 1000 / masMps; // equals twoKmSeconds / 2

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
      "Your 2 km pace. Hold 2–5 min reps to build maximal aerobic capacity."),
    zone("eurofit", "Eurofit 15/15", 1.2, 15, 15,
      "15s hard / 15s rest — boosts VO₂max with little lactate build-up."),
    zone("tabata", "Tabata 20/10", 1.3, 20, 10,
      "20s near-sprint / 10s rest — builds anaerobic power and high-intensity tolerance."),
  ];

  return {
    twoKmSeconds,
    masMps: round2(masMps),
    masPaceSecPerKm: Math.round(masPaceSecPerKm),
    zones,
  };
}
