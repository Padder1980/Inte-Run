// The estimate primitive (brief §16). Every physiological number the app shows must carry its
// uncertainty and provenance — not a false-precision point value. This type is that contract: a
// value with a plausible range, a confidence level, how it was derived, and its known limitations.
// Where evidence is absent we say so ("none") rather than inventing a number.

export type Confidence = "none" | "low" | "moderate" | "high";

export type Estimate = {
  /** Human label, e.g. "Aerobic capacity (VO₂max)". */
  metric: string;
  /** Midpoint estimate. Absent when confidence is "none" (not enough data). */
  value?: number;
  /** Plausible range — the honest way to present the value (e.g. 52–56, not 54.3). */
  low?: number;
  high?: number;
  unit: string;
  confidence: Confidence;
  /** How this was derived (the method / model). */
  method: string;
  /** Short grounding note — what evidence or field data it rests on. */
  evidence?: string;
  /** Known limitations a reader should keep in mind. */
  limitations?: string;
};

/** Build an "insufficient data" estimate — the honest default when we can't estimate something. */
export function unknownEstimate(
  metric: string,
  unit: string,
  method: string,
  limitations: string,
): Estimate {
  return { metric, unit, confidence: "none", method, limitations };
}

/** Format an estimate's range for display: "52–56", or "—" when unknown. */
export function rangeText(e: Estimate, digits = 0): string {
  if (e.confidence === "none" || e.low == null || e.high == null) return "—";
  const f = (n: number) => n.toFixed(digits);
  return e.low === e.high ? f(e.value ?? e.low) : `${f(e.low)}–${f(e.high)}`;
}

/** Symmetric range around a midpoint, clamped so the low never goes below `floor`. */
export function rangeAround(value: number, halfWidth: number, floor = 0): { low: number; high: number } {
  return { low: Math.max(floor, value - halfWidth), high: value + halfWidth };
}
