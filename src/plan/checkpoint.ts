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

// ---- The end-of-block test, chosen by level (STAGES.md §10, decision 5 of 2026-11-18) -------------------------------

/** The four levels of §10's table, as the status card names them ("Just getting started" … "Competitive"). */
export type RunnerLevel = "new" | "building" | "regular" | "competitive";
/**
 * The tests a block can end in:
 *   "trial-2k"       the 2 km time trial — the fastest pace held for the whole 2 km (a maximal effort);
 *   "controlled-2k"  a 2 km run strong but controlled — Galloway's "Magic Mile" style, never flat out;
 *   "parkrun"        a parkrun or a 5 km (or a race);
 *   "time-on-feet"   the block's own longest run, without stopping, that felt easy — no timed effort at all.
 */
export type BlockTest = "trial-2k" | "controlled-2k" | "parkrun" | "time-on-feet";
/**
 * A parkrun or a 5 km is offered only once the runner's longest run in the last 30 days reaches this (§10: "once the
 * longest run is about 4.5 km"). Why: a run more than 10% longer than the longest of the last 30 days raised injury
 * risk 52–128% (Frandsen 2025, BJSM 59:1203), and a 5 km for somebody whose longest run is 3 km is that jump.
 */
export const PARKRUN_MIN_LONGEST_KM = 4.5;
/** The window that "longest run" is read over (Frandsen's own: the last 30 days). */
export const LONGEST_RUN_WINDOW_DAYS = 30;

/**
 * May this runner be offered a maximal test? ⚠️ NEVER "Just getting started", NEVER anyone back from injury (§10's
 * table): running tests are for the already active, and hard unaccustomed effort carries the highest short-term risk
 * in the least active (Cooper Institute; AHA/ACSM 2007); a runner back from injury has no time trial until running is
 * back to normal (Stanford FASTR). THE CLINICAL REVIEWER CHECKS THIS RULE AND ITS WORDING BEFORE RELEASE.
 */
export function maximalTestAllowed(o: { level: RunnerLevel; injured: boolean }): boolean {
  return o.level !== "new" && !o.injured;
}

/**
 * THE END-OF-BLOCK TEST BY LEVEL — §10's table, in the order the runner is offered them (the first is the one put
 * first). One definition: the checkpoint asks it, the app offers what it returns and nothing else.
 *   Just getting started  time on feet only — the block's target run, non-stop at chatting pace; no time trial.
 *   Back from injury      a strong-but-controlled 2 km, or time on feet — no time trial until running is normal.
 *   Building the habit    a strong-but-controlled 2 km, or a parkrun once the longest run is about 4.5 km.
 *   Regular / Competitive a parkrun or 5 km (or a race) once the longest run is about 4.5 km, or the 2 km trial.
 */
export function blockTestsFor(o: { level: RunnerLevel; injured: boolean; longestKm30d?: number | null }): BlockTest[] {
  if (o.level === "new") return ["time-on-feet"];
  if (o.injured) return ["controlled-2k", "time-on-feet"];
  const parkrun = Number(o.longestKm30d) >= PARKRUN_MIN_LONGEST_KM;
  if (o.level === "building") return parkrun ? ["controlled-2k", "parkrun"] : ["controlled-2k"];
  return parkrun ? ["parkrun", "trial-2k"] : ["trial-2k"];
}

/** A run of at least `needMin` minutes, without stopping, that felt easy (rated EASY_RPE_MAX or under). */
export type EasyRunKey = { needMin: number; bestMin: number | null; bestIso?: string | null };

export type CheckpointFacts = {
  /** The stage whose checkpoint this is — §10 piece 3: a block of the race block too (its key run is the level's test). */
  stage: "walkrun1" | "walkrun2" | "rebuild" | "base" | "race";
  /** Runs the plan asked for in the stage's last two weeks, up to today. */
  planned: number;
  /** Of those, how many were run (logged on their day, or linked to the session). */
  done: number;
  /** Runs in those two weeks the runner answered "yes" to "Did anything hurt?". */
  painRuns: number;
  /**
   * Rebuild: the key run asked for, in minutes — `REBUILD_KEY_RUN_MIN`, or the stage's own longest planned run where
   * that is shorter (a runner who follows the plan exactly must be able to pass), and the longest run logged in the
   * stage that felt easy (null: none). Base: a test run logged in the stage (null: none) — the tests this runner is
   * offered (`offer`, from blockTestsFor), and where time on feet counts too (a runner back from injury) the block's
   * own longest planned run against the longest easy-feeling run logged in it.
   */
  keyRun: ({ kind: "easy-run" } & EasyRunKey)
    | { kind: "test"; doneIso: string | null; label?: string | null; offer?: BlockTest[]; timeOnFeet?: EasyRunKey | null }
    /**
     * §10 decision 2 — a walk-run block's key run: its target, `needMin` minutes without stopping at a chatting pace
     * (the plan's own key session, done and rated easy), and when it is in the plan if not yet done.
     */
    | { kind: "target-run"; needMin: number; doneIso: string | null; plannedIso?: string | null };
};

/** "an 80-minute run", "a 46-minute run" — the article for a number of minutes as it is said aloud (8, 11, 18, 80–89). */
function minutesArticle(n: number): string {
  const s = String(Math.round(n));
  return s.startsWith("8") || s === "11" || s === "18" ? "an" : "a";
}

/** "a strong-but-controlled 2 km, or a parkrun or 5 km" — the offered tests in the runner's words. */
function offerWords(offer: BlockTest[] | undefined, tof: EasyRunKey | null | undefined): string {
  const need = tof ? tof.needMin : REBUILD_KEY_RUN_MIN;
  const words = (offer && offer.length ? offer : ["trial-2k" as BlockTest]).map((t) =>
    t === "trial-2k" ? "the 2 km test run"
      : t === "controlled-2k" ? "a strong-but-controlled 2 km"
        : t === "parkrun" ? "a parkrun or 5 km"
          : `${minutesArticle(need)} ${need}-minute run without stopping that feels easy`);
  return words.length < 2 ? words.join("") : words.slice(0, -1).join(", ") + " or " + words[words.length - 1];
}

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
  const easyMet = (e: EasyRunKey | null | undefined) => !!e && e.bestMin != null && e.bestMin >= e.needMin;
  // A test logged in the stage, or — where time on feet counts — the block's own longest run, easy and unbroken.
  const tofMet = k.kind === "test" && easyMet(k.timeOnFeet);
  const keyRun = k.kind === "easy-run" ? easyMet(k) : k.kind === "target-run" ? !!k.doneIso : !!k.doneIso || tofMet;
  const reasons: string[] = [];
  reasons.push(planned === 0
    ? "No runs were planned in the last two weeks, so there is nothing to count yet."
    : runs
      ? `You ran ${done} of your ${plural(planned, "planned run")} in the last two weeks.`
      : `You ran ${done} of your ${plural(planned, "planned run")} in the last two weeks — the checkpoint looks for ${need}.`);
  // ⚠️ "YOU DID NOT FLAG", NEVER "NOTHING HURT": a run whose "Did anything hurt?" was never answered is absent, not
  // fine (painAskHtml's rule), so the sentence says only what the runner told us.
  reasons.push(noPain
    ? "You didn’t flag pain on any run in the last two weeks."
    : `You said ${f.painRuns === 1 ? "one run" : plural(f.painRuns, "run")} in the last two weeks hurt.`);
  if (k.kind === "easy-run") {
    reasons.push(keyRun
      ? `Your ${k.bestMin}-minute run${k.bestIso ? " on " + k.bestIso : ""} felt easy.`
      : k.bestMin != null
        ? `Your longest easy-feeling run so far is ${k.bestMin} minutes; this stage's key run is ${k.needMin} minutes without stopping.`
        : `No run of ${k.needMin} minutes that felt easy yet — your long run is the chance.`);
  } else if (k.kind === "target-run") {
    // ⚠️ "AT A CHATTING PACE" IS WHAT THE RUNNER RATED, never inferred: the app counts the key run only when it was rated easy.
    reasons.push(k.doneIso
      ? `You ran ${k.needMin} minutes without stopping on ${k.doneIso}, at a chatting pace.`
      : `This block’s key run is ${k.needMin} minutes without stopping, at a chatting pace${k.plannedIso ? " — it is in your plan on " + k.plannedIso : ""}.`);
  } else if (k.doneIso) {
    reasons.push(`You did your test run on ${k.doneIso}${k.label ? " (" + k.label + ")" : ""}.`);
  } else if (tofMet) {
    const t = k.timeOnFeet!;
    reasons.push(`Your ${t.bestMin}-minute run${t.bestIso ? " on " + t.bestIso : ""} felt easy — that is this block’s key run.`);
  } else {
    // ⚠️ THE WORDS NAME ONLY WHAT THIS RUNNER IS OFFERED (blockTestsFor): never the 2 km trial to somebody back from
    // injury, never a parkrun before the longest run reaches about 4.5 km.
    reasons.push(k.offer && k.offer.length
      ? `No test run yet — ${offerWords(k.offer, k.timeOnFeet)} ends this block and sets up the next one.`
      : "No test run yet — a short test run sets your paces from real running.");
  }
  const missing = [runs, noPain, keyRun].filter((x) => !x).length;
  const verdict: CheckpointVerdict["verdict"] = !noPain ? "notyet" : missing === 0 ? "ready" : missing === 1 ? "nearly" : "notyet";
  const recommend: CheckpointVerdict["recommend"] = !noPain ? "ease" : missing === 0 ? "up" : "more";
  return { verdict, recommend, reasons, met: { runs, noPain, keyRun } };
}
