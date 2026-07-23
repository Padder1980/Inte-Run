// RPE feedback.
//
// After each session the athlete rates perceived effort (1–10). If quality sessions keep coming in
// much harder than intended, or aren't being completed, the next block eases (deload). If they're
// consistently comfortable and completed, progression can accelerate. RPE is the athlete-facing
// anchor the research brief uses throughout (easy 2–3, threshold 6–7, VO2 8–9).

import type { RpeRecommendation, Session, SessionOutcome } from "../domain/types.ts";

export type RpeEntry = { targetMax: number; actualRpe: number; completed: boolean };

const WINDOW = 3;
const HARDER_THRESHOLD = 1.5; // avg RPE this far above target → ease
const EASIER_THRESHOLD = 1.0; // avg RPE this far below target → progress

export function evaluateRpe(entries: RpeEntry[]): RpeRecommendation {
  const recent = entries.slice(-WINDOW);
  if (recent.length === 0) return "hold";

  if (recent.some((e) => !e.completed)) return "ease";

  const avgDelta = recent.reduce((s, e) => s + (e.actualRpe - e.targetMax), 0) / recent.length;
  if (avgDelta >= HARDER_THRESHOLD) return "ease";
  if (avgDelta <= -EASIER_THRESHOLD) return "progress";
  return "hold";
}

/** Build RPE entries by joining quality sessions to their outcomes, for `evaluateRpe`. */
export function entriesFromOutcomes(
  qualitySessions: Session[],
  outcomes: SessionOutcome[],
): RpeEntry[] {
  const byId = new Map(outcomes.map((o) => [o.sessionId, o]));
  const entries: RpeEntry[] = [];
  for (const s of qualitySessions) {
    const o = byId.get(s.id);
    if (!o) continue;
    entries.push({
      targetMax: s.targetRpe?.max ?? 7,
      actualRpe: o.rpe ?? (o.completed ? (s.targetRpe?.max ?? 7) : 10),
      completed: o.completed,
    });
  }
  return entries;
}
