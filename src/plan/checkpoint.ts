// Stage B14 — THE CHECKPOINT AT THE END OF A STAGE (STAGES.md §5, owner's decision 3 of 2026-11-18).
//
// A pure judgement over what the runner has ACTUALLY done — never over the plan's own ticks, which mark every
// past session done whether it happened or not (B6's warning). The app gathers the facts from its stores (runs
// logged against runs planned, the "did anything hurt?" answer on each run, the stage's key run) and this turns
// them into Ready / Nearly / Not yet with the reasons in plain words. It decides nothing: the runner chooses
// (decision 2), and a "not yet" is remembered and asked again at the next checkpoint only.
//
// ⚠️ THE PAIN RULE AND THIS WORDING GO TO THE CLINICAL REVIEWER BEFORE RELEASE (STAGES.md, decisions 1 and 3).

/** The share of the stage's last two weeks' runs that must be done (decision 3: "at least 80%"). */
export const CHECKPOINT_DONE_SHARE = 0.8;
/** Rebuild's key run: a continuous run of this long that felt easy (STAGES.md §3, "a 40-min run that felt easy"). */
export const REBUILD_KEY_RUN_MIN = 40;
/** "Felt easy": an effort the runner rated at or under this (the app's 1–10 scale; easy running is 2–4). */
export const EASY_RPE_MAX = 4;

export type CheckpointFacts = {
  /** The stage whose checkpoint this is. */
  stage: "rebuild" | "base";
  /** Runs the plan asked for in the stage's last two weeks, up to today. */
  planned: number;
  /** Of those, how many were run (logged on their day, or linked to the session). */
  done: number;
  /** Runs in those two weeks the runner answered "yes" to "Did anything hurt?". */
  painRuns: number;
  /**
   * Rebuild: the key run asked for, in minutes — `REBUILD_KEY_RUN_MIN`, or the stage's own longest planned run where
   * that is shorter (a runner who follows the plan exactly must be able to pass), and the longest run logged in the
   * stage that felt easy (null: none). Base: a test run logged in the stage (null: none).
   */
  keyRun: { kind: "easy-run"; needMin: number; bestMin: number | null; bestIso?: string | null }
    | { kind: "test"; doneIso: string | null; label?: string | null };
};

export type CheckpointVerdict = {
  verdict: "ready" | "nearly" | "notyet";
  /** The choice the app puts first; the runner still chooses (decision 2). */
  recommend: "up" | "more" | "ease";
  /** One plain sentence per check, in the order the runner reads them. */
  reasons: string[];
  met: { runs: boolean; noPain: boolean; keyRun: boolean };
};

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
/** The runs needed out of `planned` for the 80% rule — never more than were planned. */
export function runsNeeded(planned: number): number {
  return Math.min(planned, Math.ceil(planned * CHECKPOINT_DONE_SHARE - 1e-9));
}

/**
 * Ready (all three met), Nearly (one missing, no pain: a week more), Not yet (pain flagged: ease back, with the
 * injury guidance) — the owner's decision 3 word for word. ⚠️ TWO OR MORE MISSING WITHOUT PAIN IS "NOT YET" TOO,
 * but the choice put first is a week more, not easing back: easing back is the answer to pain, and nothing hurt.
 */
export function evaluateCheckpoint(f: CheckpointFacts): CheckpointVerdict {
  const planned = Math.max(0, Math.floor(f.planned));
  const done = Math.max(0, Math.min(planned, Math.floor(f.done)));
  const need = runsNeeded(planned);
  const runs = planned > 0 && done >= need;
  const noPain = !(f.painRuns > 0);
  const k = f.keyRun;
  const keyRun = k.kind === "easy-run" ? k.bestMin != null && k.bestMin >= k.needMin : !!k.doneIso;
  const reasons: string[] = [];
  reasons.push(planned === 0
    ? "No runs were planned in the last two weeks, so there is nothing to count yet."
    : runs
      ? `You ran ${done} of your ${plural(planned, "planned run")} in the last two weeks.`
      : `You ran ${done} of your ${plural(planned, "planned run")} in the last two weeks — the checkpoint looks for ${need}.`);
  // ⚠️ "YOU DID NOT FLAG", NEVER "NOTHING HURT": a run whose "Did anything hurt?" was never answered is absent, not
  // fine (painAskHtml's rule), so the sentence says only what the runner told us.
  reasons.push(noPain
    ? "You didn't flag pain on any run in the last two weeks."
    : `You said ${f.painRuns === 1 ? "one run" : plural(f.painRuns, "run")} in the last two weeks hurt.`);
  if (k.kind === "easy-run") {
    reasons.push(keyRun
      ? `Your ${k.bestMin}-minute run${k.bestIso ? " on " + k.bestIso : ""} felt easy.`
      : k.bestMin != null
        ? `Your longest easy-feeling run so far is ${k.bestMin} minutes; this stage's key run is ${k.needMin} minutes without stopping.`
        : `No run of ${k.needMin} minutes that felt easy yet — your long run is the chance.`);
  } else {
    reasons.push(keyRun
      ? `You did your test run${k.doneIso ? " on " + k.doneIso : ""}${k.label ? " (" + k.label + ")" : ""}.`
      : "No test run yet — a short test run sets your paces from real running.");
  }
  const missing = [runs, noPain, keyRun].filter((x) => !x).length;
  const verdict: CheckpointVerdict["verdict"] = !noPain ? "notyet" : missing === 0 ? "ready" : missing === 1 ? "nearly" : "notyet";
  const recommend: CheckpointVerdict["recommend"] = !noPain ? "ease" : missing === 0 ? "up" : "more";
  return { verdict, recommend, reasons, met: { runs, noPain, keyRun } };
}
