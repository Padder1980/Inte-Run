// Daily readiness (brief §8). A MULTI-factor check — sleep, soreness, energy, life stress,
// motivation, and optionally resting HR / HRV / yesterday's effort — blended into a gentle
// recommendation for today. Two rules from the brief shape the design:
//   1. No single metric decides the day. In particular, one poor HRV reading must NOT cancel a
//      session on its own — every soft factor is capped so it takes several to force a rest.
//   2. Non-punitive. Feeling unwell means rest, never "push through"; backing off is framed as part
//      of training well, not a failure.

export type ReadinessBand = "ready" | "steady" | "ease" | "rest";

export type ReadinessInput = {
  sleepHours?: number;
  sleepQuality?: "poor" | "ok" | "good";
  soreness?: "none" | "mild" | "moderate" | "high";
  energy?: "low" | "ok" | "good";
  stress?: "low" | "normal" | "high";
  motivation?: "low" | "ok" | "high";
  illness?: "none" | "slight" | "unwell";
  /** Resting heart rate this morning, in bpm above your personal normal (optional). */
  restingHrDelta?: number;
  /** HRV vs your baseline (optional). Deliberately capped so it can never decide the day alone. */
  hrvStatus?: "low" | "normal" | "high";
  /** Yesterday's session effort, RPE 1–10 (optional). */
  yesterdayRpe?: number;
};

export type ReadinessResult = {
  band: ReadinessBand;
  /** Friendly 0–100 readiness score for a meter (higher = fresher). */
  score: number;
  headline: string;
  recommendation: string;
  /** Plain-language factors that shaped the result. */
  reasons: string[];
  /** A non-punitive, reassuring line. */
  reassurance: string;
};

const HEADLINE: Record<ReadinessBand, string> = {
  ready: "Good to go",
  steady: "Green light — with a little care",
  ease: "Ease off today",
  rest: "Rest day",
};

const RECOMMENDATION: Record<ReadinessBand, string> = {
  ready: "Train as planned — you're recovered and ready.",
  steady: "Train as planned, but keep the easy parts genuinely easy and don't force it.",
  ease: "Swap today's hard work for an easy run or cross-training. Save the quality for when you're fresher.",
  rest: "Take a rest or gentle recovery day. Backing off now is what makes the training stick.",
};

const REASSURANCE: Record<ReadinessBand, string> = {
  ready: "Consistency like this is what drives improvement.",
  steady: "Listening to your body is part of training well.",
  ease: "Adjusting a day isn't falling behind — it's how you keep progressing.",
  rest: "This isn't a setback; it's how you avoid one. Never push through feeling unwell.",
};

export function assessReadiness(input: ReadinessInput): ReadinessResult {
  let strain = 0;
  const reasons: string[] = [];
  const add = (points: number, reason?: string) => {
    if (points <= 0) return;
    strain += points;
    if (reason) reasons.push(reason);
  };

  if (input.sleepHours != null) {
    if (input.sleepHours < 5) add(22, "Very little sleep");
    else if (input.sleepHours < 6) add(12, "Short sleep");
    else if (input.sleepHours < 7) add(5, "A little less sleep than ideal");
  }
  if (input.sleepQuality === "poor") add(12, "Poor sleep quality");
  else if (input.sleepQuality === "ok") add(4);

  if (input.soreness === "high") add(22, "Legs are very sore");
  else if (input.soreness === "moderate") add(12, "Noticeable soreness");
  else if (input.soreness === "mild") add(4);

  if (input.energy === "low") add(14, "Low energy");
  else if (input.energy === "ok") add(4);

  if (input.stress === "high") add(12, "High life stress");
  else if (input.stress === "normal") add(2);

  if (input.motivation === "low") add(8, "Low motivation");
  else if (input.motivation === "ok") add(2);

  if (input.restingHrDelta != null) {
    if (input.restingHrDelta >= 8) add(14, "Resting heart rate well up");
    else if (input.restingHrDelta >= 5) add(8, "Resting heart rate a bit up");
    else if (input.restingHrDelta >= 3) add(4);
  }

  // HRV is capped low on purpose — the brief is explicit it must not decide the day by itself.
  if (input.hrvStatus === "low") add(8, "HRV a little below your baseline");

  if (input.yesterdayRpe != null) {
    if (input.yesterdayRpe >= 9) add(10, "Yesterday was very hard");
    else if (input.yesterdayRpe >= 7) add(5);
  }

  // Illness is the one signal allowed to override — you don't train through being unwell.
  let forcedRest = false;
  if (input.illness === "unwell") {
    forcedRest = true;
    reasons.unshift("You're feeling unwell");
  } else if (input.illness === "slight") {
    strain += 20;
    reasons.unshift("Feeling slightly under the weather");
  }

  let band: ReadinessBand;
  if (forcedRest) band = "rest";
  else band = strain <= 15 ? "ready" : strain <= 35 ? "steady" : strain <= 60 ? "ease" : "rest";
  // A slight illness caps the day at "ease" — never a hard session.
  if (input.illness === "slight" && (band === "ready" || band === "steady")) band = "ease";

  if (reasons.length === 0) reasons.push("Everything looks good today");

  return {
    band,
    score: Math.max(0, Math.min(100, 100 - strain)),
    headline: HEADLINE[band],
    recommendation: RECOMMENDATION[band],
    reasons,
    reassurance: REASSURANCE[band],
  };
}
