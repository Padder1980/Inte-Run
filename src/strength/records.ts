import { epley1RM, type LoggedSet } from "./progression.ts";

/**
 * NEW-BEST DETECTION FOR ONE EXERCISE.
 *
 * Three independent things a session can set a record in: the heaviest single set ever, the best
 * estimated one-rep max ever, and the most total volume (weight x reps, summed) in one session ever.
 * A session can set none, one, two or all three at once — a heavy single beats the weight record
 * without necessarily beating the volume one, and the reverse.
 */
export type StrengthRecordKind = "heaviest" | "e1rm" | "volume";
export type StrengthRecordHit = { kind: StrengthRecordKind; value: number; previousBest: number | null };

function heaviestOf(sets: LoggedSet[]): number | null {
  let m: number | null = null;
  for (const s of sets) if (s.w != null && s.w > 0 && (m == null || s.w > m)) m = s.w;
  return m;
}
function bestE1RMOf(sets: LoggedSet[]): number | null {
  let m: number | null = null;
  for (const s of sets) {
    if (s.w == null || s.r == null) continue;
    const e = epley1RM(s.w, s.r);
    if (e != null && (m == null || e > m)) m = e;
  }
  return m;
}
function volumeOf(sets: LoggedSet[]): number {
  let v = 0;
  for (const s of sets) if (s.w != null && s.w > 0 && s.r != null && s.r > 0) v += s.w * s.r;
  return v;
}

/**
 * Which records, if any, THIS instance sets against everything that came before it.
 *
 * ⚠️ A RECORD NEEDS SOMETHING TO BEAT. With no prior instance at all, "beating nothing" is not a
 * record — it is the first data point — and treating it as one would toast a "new best!" on every
 * single exercise a runner ever logs for the first time, which cheapens the ones that actually mean
 * something. `priorInstances.length === 0` refuses outright, before any of the three comparisons run.
 *
 * ⚠️ STRICTLY GREATER, ON ALL THREE. A tie is not a new record — it is the same one, and congratulating
 * a runner for matching what they already did is worth less than staying quiet.
 */
export function detectStrengthRecords(opts: {
  /** Every earlier instance of this exercise, one array per date it was performed. */
  priorInstances: LoggedSet[][];
  /** The sets just logged in this instance. */
  thisInstance: LoggedSet[];
}): StrengthRecordHit[] {
  if (!opts.priorInstances.length) return [];

  let priorHeaviest: number | null = null;
  let priorE1RM: number | null = null;
  let priorVolume: number | null = null;
  for (const inst of opts.priorInstances) {
    const h = heaviestOf(inst);
    if (h != null && (priorHeaviest == null || h > priorHeaviest)) priorHeaviest = h;
    const e = bestE1RMOf(inst);
    if (e != null && (priorE1RM == null || e > priorE1RM)) priorE1RM = e;
    const v = volumeOf(inst);
    if (v > 0 && (priorVolume == null || v > priorVolume)) priorVolume = v;
  }

  const thisHeaviest = heaviestOf(opts.thisInstance);
  const thisE1RM = bestE1RMOf(opts.thisInstance);
  const thisVolume = volumeOf(opts.thisInstance);

  const hits: StrengthRecordHit[] = [];
  if (thisHeaviest != null && (priorHeaviest == null || thisHeaviest > priorHeaviest))
    hits.push({ kind: "heaviest", value: thisHeaviest, previousBest: priorHeaviest });
  if (thisE1RM != null && (priorE1RM == null || thisE1RM > priorE1RM))
    hits.push({ kind: "e1rm", value: thisE1RM, previousBest: priorE1RM });
  if (thisVolume > 0 && (priorVolume == null || thisVolume > priorVolume))
    hits.push({ kind: "volume", value: thisVolume, previousBest: priorVolume });
  return hits;
}
