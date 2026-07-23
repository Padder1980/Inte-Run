// Minimal ISO-date helpers (yyyy-mm-dd). UTC-based to avoid timezone drift in scheduling.

const MS_PER_DAY = 86_400_000;

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function toUtcDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid ISO date: "${iso}"`);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const ms = toUtcDate(iso) + days * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a); negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcDate(b) - toUtcDate(a)) / MS_PER_DAY);
}

/** Whole weeks from `a` to `b`, floored at 0 for the common "how long until race" use. */
export function weeksBetween(a: string, b: string): number {
  return Math.floor(daysBetween(a, b) / 7);
}

/** 0 = Monday … 6 = Sunday, matching Session.dayOfWeek. */
export function dayOfWeekMondayZero(iso: string): number {
  const dow = new Date(toUtcDate(iso)).getUTCDay(); // 0 = Sunday
  return (dow + 6) % 7;
}
