// Units, distances and time/pace conversions. Pure functions, no dependencies.
// Distances in metres, times in seconds, pace in seconds-per-kilometre internally.

export const METRES_PER_KM = 1000;
export const METRES_PER_MILE = 1609.344;

/** Standard race distances in metres. */
export const RACE_DISTANCES_M = {
  "1mile": METRES_PER_MILE,
  "5k": 5000,
  "10k": 10000,
  half: 21097.5,
  marathon: 42195,
} as const;

export type RaceDistanceKey = keyof typeof RACE_DISTANCES_M;

/** Parse "ss", "mm:ss" or "h:mm:ss" into whole seconds. Throws on malformed input. */
export function parseDuration(text: string): number {
  const parts = text.trim().split(":");
  if (parts.length === 0 || parts.length > 3) {
    throw new Error(`Invalid duration: "${text}"`);
  }
  const nums = parts.map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid duration segment: "${p}"`);
    return n;
  });
  let seconds = 0;
  for (const n of nums) seconds = seconds * 60 + n;
  return seconds;
}

/** Format seconds as "mm:ss", or "h:mm:ss" when an hour or more (or forceHours). */
export function formatDuration(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0 || forceHours) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

/** Format a pace (seconds per km) as "m:ss/km" or "m:ss/mi". */
export function formatPace(secPerKm: number, unit: "km" | "mi" = "km"): string {
  const perUnit = unit === "km" ? secPerKm : secPerKmToSecPerMile(secPerKm);
  return `${formatDuration(perUnit)}/${unit}`;
}

export function secPerKmToSecPerMile(secPerKm: number): number {
  return secPerKm * (METRES_PER_MILE / METRES_PER_KM);
}

export function secPerMileToSecPerKm(secPerMile: number): number {
  return secPerMile * (METRES_PER_KM / METRES_PER_MILE);
}

/** Pace (seconds per km) implied by covering `metres` in `seconds`. */
export function paceSecPerKm(seconds: number, metres: number): number {
  if (metres <= 0) throw new Error("distance must be positive");
  return seconds / (metres / METRES_PER_KM);
}

/** Time in seconds to cover `metres` at a given pace (seconds per km). */
export function timeForDistance(secPerKm: number, metres: number): number {
  return secPerKm * (metres / METRES_PER_KM);
}

/** Distance in metres covered in `seconds` at a given pace (seconds per km). */
export function distanceForTime(secPerKm: number, seconds: number): number {
  if (secPerKm <= 0) throw new Error("pace must be positive");
  return (seconds / secPerKm) * METRES_PER_KM;
}

export function metresToKm(metres: number): number {
  return metres / METRES_PER_KM;
}

/** Round to a whole number of seconds; helper for stable comparisons. */
export function roundSeconds(seconds: number): number {
  return Math.round(seconds);
}
