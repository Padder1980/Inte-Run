import type { StrengthPrefs } from "../domain/types.ts";
import type { Equipment, MovementPattern } from "./library.ts";
import type { YouthLimits } from "../domain/youth.ts";
import { youthPlyoDose } from "../domain/youth.ts";
import { EXERCISES, canDo, exercisesFor } from "./library.ts";

/**
 * BUILDING ONE STRENGTH SESSION FROM WHAT THE RUNNER ANSWERED.
 *
 * ⚠️⚠️ THE LENGTH IS COMPUTED, NEVER TYPED, AND THAT IS THE WHOLE POINT OF THIS FILE. The session
 * this replaces carried a literal `minutes = maintenance ? 30 : 45` next to a fixed list of seven
 * exercises — and the two had nothing to do with each other. Measured against the rests that session
 * genuinely prescribes (three minutes between heavy triples), its seven exercises plus the plyometric
 * dose take about SIXTY-SEVEN minutes, under a label reading 45. A runner who has been told they can
 * spare thirty minutes cannot be handed a session whose length is a decoration.
 *
 * So the runner gives a budget and the builder fills it: cost a set at `WORK_SEC + rest`, walk an
 * ordered spine of movement patterns, and stop at whichever count lands closest to what was asked.
 *
 * ⚠️ THE SPINE IS ORDERED BY WHAT A RUNNER NEEDS MOST, so a short session is the top of the same
 * session rather than a different one. Squat, single leg, hinge, calves, then trunk — a thirty-minute
 * session is the first few of those, not a random subset.
 *
 * ⚠️ AND IT IS DETERMINISTIC. The same answers must build the same block today and after every
 * rebuild, because a logged set is filed against the exercise id it was performed under. Nothing here
 * reads a clock or a random number; within a pattern the pick is catalogue order.
 */

/** Seconds a single working set takes, including getting into position. */
export const WORK_SEC = 40;
/** A plyometric set is over in seconds; almost all of its cost is the recovery. */
export const PLYO_WORK_SEC = 15;

/**
 * Rest between sets, by what the set is for.
 *
 * ⚠️ REST IS PART OF THE PRESCRIPTION, NOT A CONVENIENCE. Heavy triples off ninety seconds are a
 * different (and worse) session from heavy triples off three minutes; the whole reason heavy lifting
 * improves running economy is that each set is performed fresh. These are the conventional
 * strength-and-conditioning figures for each rep range, and they are what makes the duration honest.
 */
export const REST_BY_INTENT = { heavy: 150, moderate: 120, light: 90, hold: 45, plyo: 90 } as const;
export type RestIntent = keyof typeof REST_BY_INTENT;

/** A maintenance week is deliberately shorter. 2/3 reproduces the old pair exactly: 45 -> 30. */
export const MAINTENANCE_MIN_FRAC = 2 / 3;

/** Most of a session that may go on jumping. Past this there is no session left around the dose. */
const PLYO_BUDGET_FRAC = 0.4;

/** Supersets are offered only where there is room to alternate and the runner is past the basics. */
const SUPERSET_MIN_MINUTES = 45;

/** The most a session may run past the time the runner said they had. See the filler. */
const OVER_SLACK = 120;

/**
 * The answers a picker may offer, and their words — in the engine so the form cannot invent a fifth
 * length or rename a level and have the plan quietly ignore it. The running-days question learned
 * this the hard way: the form offered a beginner 5, 6 and 7 while the plan built 4.
 */
export const STRENGTH_MINUTES = [30, 45, 60] as const;
export const STRENGTH_LEVELS: { id: StrengthPrefs["level"]; label: string; hint: string }[] = [
  { id: "beginner", label: "Beginner", hint: "New to lifting, or coming back to it. Fewer sets, simpler movements." },
  { id: "intermediate", label: "Intermediate", hint: "Comfortable with squats, deadlifts and step-ups." },
  { id: "advanced", label: "Advanced", hint: "Confident under a bar. More sets, and the harder variations." },
];
export const STRENGTH_GOALS: { id: StrengthPrefs["goal"]; label: string; hint: string }[] = [
  { id: "running", label: "Running focus", hint: "Legs, calves and trunk — the work that protects a runner." },
  { id: "allRound", label: "All-round", hint: "Adds an upper-body push and pull to the same session." },
];

type Role = "main" | "accessory" | "hold";

type Slot = {
  pattern: MovementPattern;
  /**
   * The exercise this slot wants when the runner can perform it. Not a tie-break: these are the
   * movements the evidence-cited session has always prescribed, and the picker only looks past one
   * when equipment or level rules it out.
   */
  prefer: string;
  role: Role;
  /** True where a percentage-of-1RM load is genuinely prescribed. Claimed nowhere else. */
  load?: boolean;
};

/**
 * ⚠️ THE FIRST SEVEN SLOTS ARE THE SHIPPED SESSION, IN ITS ORDER. squat, split squat, RDL, both calf
 * raises, step-up, plank — so a runner on the default answers meets the session they already know,
 * and any difference is one they asked for. The three after it are what a longer session buys.
 */
const RUNNING_SPINE: Slot[] = [
  { pattern: "squat", prefer: "squat", role: "main", load: true },
  { pattern: "lunge", prefer: "splitSquat", role: "main", load: true },
  { pattern: "hinge", prefer: "rdl", role: "main", load: true },
  { pattern: "calf", prefer: "calf", role: "accessory" },
  { pattern: "calf", prefer: "soleus", role: "accessory" },
  { pattern: "squat", prefer: "stepUp", role: "main" },
  { pattern: "plank", prefer: "plank", role: "hold" },
  { pattern: "bridge", prefer: "gluteBridge", role: "accessory" },
  { pattern: "core", prefer: "deadbug", role: "accessory" },
  { pattern: "balance", prefer: "balance", role: "hold" },
];

/**
 * All-Round adds an upper-body push and pull, and they go straight after the three big lower lifts so
 * a 45-minute session actually reaches them — putting them last would make the choice cosmetic.
 *
 * ⚠️ THEY ARE ACCESSORY WORK, NOT MAIN LIFTS, AND THE FIRST CUT GOT THIS WRONG IN A WAY THAT PRINTED
 * ITSELF: a push-up came out prescribed at "3-6 (heavy)" off three minutes' rest, which is not a
 * thing anybody can do. The heavy, 80%-plus prescription is what the evidence supports for the LEGS;
 * the upper body here is posture and arm drive, which is a set of eight to twelve. Charging them as
 * main lifts also cost them their place: at sixty minutes the pull slot was priced out and All-Round
 * delivered a push and no pull.
 */
const ALL_ROUND_AT = 3;
const ALL_ROUND_SLOTS: Slot[] = [
  { pattern: "push", prefer: "pushup", role: "accessory" },
  { pattern: "pull", prefer: "bentOverRow", role: "accessory" },
];

/** Sets, relative to what the phase asks for. A beginner does less of the same thing, not something else. */
const SETS_BY_LEVEL = { beginner: -1, intermediate: 0, advanced: 1 } as const;
const SETS_MIN = 2;
const SETS_MAX = 5;

export type BuiltExercise = {
  id: string;
  sets: number;
  reps: string;
  restSeconds: number;
  loadPercent1RM?: string;
  contacts?: number;
  superset?: number;
};

export type BuiltStrength = {
  exercises: BuiltExercise[];
  /** What the session actually takes at the rests it prescribes. */
  seconds: number;
  /** The budget it was filling, so a caller can report how close it landed. */
  budgetSeconds: number;
  /**
   * The rest intent the MAIN lifts were built at.
   *
   * ⚠️ REPORTED RATHER THAN LEFT TO A REVERSE LOOKUP, because the seconds are not a key —
   * `REST_BY_INTENT` maps light and plyo to the same 90 — and because for a 12-17 runner this is not
   * the intent the caller asked for: a heavy block is folded to moderate, so a programme card reading
   * its own block table announced "2.5 minutes between sets" over a session prescribing two.
   */
  intent: RestIntent;
};

/**
 * ⚠️ A `spineExhausted` FLAG WAS BUILT HERE AND REMOVED, AND THE REASON IS WORTH KEEPING. It was meant
 * to let a guard say "short only because there was nothing left to prescribe" without picking a
 * percentage out of the air — but the OTHER reason a session stops short is that the next exercise
 * would have overshot the ceiling, which is simply the filler's own condition written twice. A guard
 * built on it would have restated the loop rather than constrained it, and the field would have been
 * read by nothing else. Measured instead, and quoted in the guard: the lowest fill across every
 * length, level, focus, phase and kit is 55% of the ceiling.
 */

/** The prescription a phase asks for, independent of who is doing it. */
export type StrengthIntent = {
  reps: string;
  intent: RestIntent;
  load?: string;
  /** Base set count before the level adjustment. */
  sets: number;
};

export function intentFor(phase: string, maintenance: boolean, youth?: YouthLimits | null): StrengthIntent {
  /**
   * WARNING: AGE IS TESTED FIRST, BECAUSE IT OVERRIDES THE PHASE RATHER THAN COLOURING IT. A peak
   * phase asks for 3-6 reps at 80%+ of a one-rep max, which is above the band both youth position
   * stands support without qualified supervision -- so for a 12-17 runner the phase does not get to
   * ask. Written as a modifier further down instead, the branch that returns the heavy prescription
   * would already have returned.
   *
   * WARNING: IT RETURNS NO `load`, AND THAT IS THE PRESCRIPTION. See YouthLimits' own note: a
   * percentage is a share of a one-rep max, so naming one instructs a 14-year-old to go and find
   * theirs, which is the single thing both sources forbid outright for this group. `buildStrength`
   * writes `loadPercent1RM` only when the intent carries one, so an absent load is an absent field on
   * every exercise rather than a blank on screen.
   */
  if (youth) return { reps: youth.strengthReps, intent: "moderate", sets: 2 };
  const heavy = !maintenance && (phase === "build" || phase === "peak");
  if (maintenance) return { reps: "4–6", intent: "heavy", load: "80%+", sets: 2 };
  if (heavy) return { reps: "3–6 (heavy)", intent: "heavy", load: "80%+", sets: 3 };
  return { reps: "6–8", intent: "moderate", load: "70–75%", sets: 2 };
}

const ACCESSORY_REPS = "8–12";
const HOLD_REPS = "30–45s hold";

/**
 * How long a prescription asks the runner to HOLD, in seconds, or 0 when it is a rep prescription.
 *
 * ⚠️ THE ENGINE WRITES THESE STRINGS, SO THE ENGINE SAYS WHAT THEY MEAN. The session player needs to
 * count a plank down rather than ask for weight and reps, and the only signal on the exercise instance
 * is the `reps` wording — there is no `hold` field (that one belongs to stretches). A regex in the app
 * layer would be a second definition of the engine's own vocabulary, and it would go stale silently the
 * next time a rep string is reworded: nothing would fail, a plank would simply start asking for
 * kilograms.
 *
 * ⚠️ THREE WORDINGS EXIST AND ALL THREE ARE REAL. `HOLD_REPS` ("30-45s hold") from this builder;
 * "20-40s hold" from `BEGINNER_REPS` in session-templates.ts, which is what a runner with no strength
 * preferences still gets; and "30s each leg" for the balance drill on that same legacy path, which is a
 * hold whose wording never says the word. Matching only this file's own constant would have left the
 * legacy path asking a beginner to load a barbell for a single-leg balance.
 *
 * ⚠️ IT ANSWERS THE TOP OF THE RANGE, AND THE REGEX IS WHAT DOES THAT — not the Math.max below it.
 * In every live wording the `s` is attached to the UPPER bound ("30-45s", "20-40s"), so the lower one is
 * followed by a dash and never matches at all. That is the behaviour wanted: "30-45s" completed in full
 * is 45 seconds, so a countdown reaching zero means the prescription is met rather than merely started,
 * and stopping at 30 is the runner's own call with the range still on the label. Answering the bottom
 * would have a timer congratulate somebody a third of the way through what they were asked to do.
 *
 * ⚠️ SO Math.max IS DEFENSIVE GENERALITY WITH NO OBSERVABLE FAILURE MODE TODAY, recorded here rather
 * than deleted so nobody "verifies" it by removing it. Measured across every live wording: each yields
 * exactly ONE match, so max and min are identical and a re-break swapping them changes nothing. It
 * earns its place only against a hypothetical "30s-45s" where both bounds carry the suffix.
 */
export function holdSecondsFor(reps: string | undefined | null): number {
  if (!reps) return 0;
  // Every second-valued token in the string: "30-45s hold" -> [45] (the 30 is followed by a dash, not
  // an s); "30s each leg" -> [30]; "8-12" and "3-6 (heavy)" -> [] (no digit is followed by an s).
  const secs = [...String(reps).matchAll(/(\d+)\s*s\b/g)].map((m) => Number(m[1]));
  if (!secs.length) return 0;
  const top = Math.max(...secs);
  return Number.isFinite(top) && top > 0 ? top : 0;
}

function setCost(sets: number, work: number, rest: number): number {
  return sets * (work + rest);
}

/** Two exercises alternated cost one rest, not two — which is the only reason to superset at all. */
function pairCost(a: BuiltExercise, b: BuiltExercise): number {
  return Math.max(a.sets, b.sets) * (WORK_SEC * 2 + Math.max(a.restSeconds, b.restSeconds));
}

function soloCost(e: BuiltExercise): number {
  return setCost(e.sets, e.contacts != null ? PLYO_WORK_SEC : WORK_SEC, e.restSeconds);
}

/**
 * The plyometric dose for one session, trimmed to fit when the runner has asked for a short one.
 *
 * ⚠️ TRIMMED RATHER THAN DROPPED OR ALLOWED TO SWALLOW THE SESSION. The combined heavy-plus-plyometric
 * arm is the best-evidenced intervention in the strength literature for runners (ES -1.04 against
 * -0.47 for lifting alone), so a thirty-minute session keeping none of it is a real loss — and one
 * keeping all of it has room for a single lift, which is not a session either.
 */
export function plyoFor(competitive: boolean, budgetSeconds: number, youth?: YouthLimits | null): { pogoSets: number; jumpSets: number; pogoReps: string; jumpReps: string; pogoEach: number; jumpEach: number } | null {
  const full = competitive
    ? { pogoSets: 4, pogoReps: "12", pogoEach: 12, jumpSets: 4, jumpReps: "6", jumpEach: 6 }
    : { pogoSets: 3, pogoReps: "10", pogoEach: 10, jumpSets: 3, jumpReps: "5", jumpEach: 5 };
  /**
   * WARNING: A YOUTH DOSE IS SHORTER SETS, NOT FEWER OF THEM, and the sources say so in as many
   * words: the NSCA's power table is 1-3 sets of 3-6 reps "to maintain quality of movement". Ten
   * hops in a set is where a 13-year-old's ankles stop being springs and start being brakes, which
   * is the mechanism the rep cap protects; trimming sets instead would keep the tired reps and
   * remove the fresh ones.
   */
  const d = youthPlyoDose(full, youth ?? null);
  const per = PLYO_WORK_SEC + REST_BY_INTENT.plyo;
  const cap = budgetSeconds * PLYO_BUDGET_FRAC;
  let pogo = d.pogoSets, jump = d.jumpSets;
  // Trim a set at a time, alternating, never below two of each — two sets is the floor at which the
  // exercise is still an exercise rather than a gesture.
  while ((pogo + jump) * per > cap && (pogo > 2 || jump > 2)) {
    if (pogo >= jump && pogo > 2) pogo--;
    else if (jump > 2) jump--;
    else pogo--;
  }
  if ((pogo + jump) * per > cap) return null;
  return { ...d, pogoSets: pogo, jumpSets: jump };
}

/**
 * Pick the exercise for a slot: the preferred movement when it is available, otherwise the first
 * catalogue entry of the same pattern the runner can perform and has not already been given.
 */
function pickForSlot(
  s: Slot,
  owned: Equipment[],
  level: StrengthPrefs["level"],
  used: Set<string>,
  /**
   * How far to rotate through this pattern's candidates before picking — the A/B(/C) rotation a
   * standalone programme needs so two sessions in the same week are not the same lifts.
   *
   * ⚠️ ZERO IS THE SHIPPED BEHAVIOUR, BYTE FOR BYTE: the preferred movement first, then catalogue
   * order, skipping anything already used. The plan's own sessions never pass anything else, so a
   * plan built with no programme is unchanged — which is the same guarantee A3's two-path split
   * exists to hold, and `test/strength-prefs.test.ts` hashes whole plans to keep it.
   */
  rotate = 0,
): string | null {
  const all: string[] = [];
  const pref = EXERCISES[s.prefer];
  if (pref && canDo(pref, owned, level)) all.push(s.prefer);
  for (const c of exercisesFor(s.pattern, owned, level)) if (all.indexOf(c.id) < 0) all.push(c.id);
  if (!all.length) return null;
  // ⚠⚠ A NON-FINITE ROTATION MUST FALL BACK TO ZERO, AND THE FAILURE IT PREVENTS IS TOTAL AND SILENT.
  // `all[(NaN + i) % n]` is `undefined` for every i, so every slot comes back empty and the builder
  // returns a session with NO EXERCISES AT ALL -- a card promising 45 minutes of lifting with nothing
  // on it, and nothing thrown to say so. One caller supplies this from a stored record
  // (`rotationIndex(week, slot, prefs.sessionsPerWeek)`), so a record written before that field
  // existed, or restored from an older backup, is exactly how NaN gets here. Same lesson as the
  // engine's `qualityRefFor`: a gate written `!= null` lets NaN through, and one non-finite value
  // silently rewrote a whole plan. The wrong rotation is a different session; no rotation is no session.
  const rot = Number.isFinite(rotate) ? Math.max(0, Math.round(rotate)) : 0;
  for (let i = 0; i < all.length; i++) {
    const id = all[(rot + i) % all.length]!;
    if (!used.has(id)) return id;
  }
  return null;
}

export function buildStrength(opts: {
  phase: string;
  maintenance: boolean;
  prefs: StrengthPrefs;
  competitive: boolean;
  /** Whether this session carries the plyometric dose — the caller decides, see addStrength. */
  plyo: boolean;
  /**
   * The prescription to fill the session with, when the caller has one of its own. A standalone
   * strength programme (A7) works in BLOCKS rather than plan phases — technique, then loading, then
   * heavy — so its week decides the reps, the rest and the load, not `intentFor(phase)`.
   *
   * ⚠️ AN INJECTED INTENT'S `sets` IS FINAL; A PHASE DEFAULT'S IS PERSONALISED BY LEVEL. That split
   * is the rule rather than a special case: `intentFor` answers "what does this PHASE ask of a
   * runner", which the level then adjusts, while a programme block has already resolved the level
   * when it chose its own set band. Applying `SETS_BY_LEVEL` twice would push a beginner's heavy
   * block below the three sets the block is defined as.
   */
  intent?: StrengthIntent;
  /** Rotate each pattern's candidate list — the A/B(/C) rotation. See pickForSlot. */
  rotate?: number;
  /**
   * The 12-17 limits, or null/absent for an adult. Absent is an adult and nothing else, so every
   * existing caller is byte-identical by construction.
   */
  youth?: YouthLimits | null;
}): BuiltStrength {
  const { prefs } = opts;
  const level = prefs.level;
  const owned = prefs.equipment ?? [];
  const spine = prefs.goal === "allRound"
    ? [...RUNNING_SPINE.slice(0, ALL_ROUND_AT), ...ALL_ROUND_SLOTS, ...RUNNING_SPINE.slice(ALL_ROUND_AT)]
    : RUNNING_SPINE;

  const minutes = opts.maintenance
    ? Math.round(prefs.minutes * MAINTENANCE_MIN_FRAC)
    : prefs.minutes;
  const budget = Math.max(600, Math.round(minutes * 60));

  /**
   * WARNING: AN INJECTED INTENT IS STILL FOLDED TO THE YOUTH BAND, AND THAT IS WHY THE CAP IS HERE
   * RATHER THAN ONLY IN `intentFor`. A standalone strength programme (A7) supplies its own blocks --
   * technique, then loading, then HEAVY -- so honouring `opts.intent` unconditionally would let a
   * 13-year-old start an eight-week programme whose third block prescribes 3-6 reps at 85%+, past
   * both the rep floor and the load rule, through a path that never calls `intentFor` at all.
   */
  const youth = opts.youth ?? null;
  const injected = opts.intent ?? intentFor(opts.phase, opts.maintenance, youth);
  const base: StrengthIntent = youth
    ? { reps: youth.strengthReps, intent: injected.intent === "heavy" ? "moderate" : injected.intent, sets: injected.sets }
    : injected;

  // ⚠️ THE JUMPS COME OUT OF THE BUDGET BEFORE THE LIFTS GO IN, so the dose can never be squeezed out
  // by a filler that ran out of room. It is a prescription, not padding.
  // ⚠️ AND WHAT IS RESERVED IS WHAT IS SPENT. The first cut reserved both jump exercises and then
  // dropped the box jump for a beginner-level runner, leaving five minutes of a thirty-minute session
  // paid for and unused — a session measurably shorter than the one asked for, for a reason nothing
  // on screen could explain.
  const ply = opts.plyo ? plyoFor(opts.competitive, budget, youth) : null;
  const jumps = ply != null && canDo(EXERCISES.boxjump!, owned, level);
  const plyoSets = ply ? ply.pogoSets + (jumps ? ply.jumpSets : 0) : 0;
  const plyoSeconds = plyoSets * (PLYO_WORK_SEC + REST_BY_INTENT.plyo);
  const liftBudget = Math.max(0, budget - plyoSeconds);

  /**
   * ⚠️⚠️ THE LEVEL SETS THE SETS AND THE CLOCK CAPS THEM, and without the cap the answer to "how long
   * have you got" stops being honoured at the short end. Measured: a thirty-minute ADVANCED build
   * session reserves ten minutes for jumps and then costs nearly thirteen per four-set heavy lift, so
   * the filler could only land on 23 or 36 minutes — six over, on a question whose whole point is the
   * number. The honest coaching answer is that half an hour is not four sets of everything; drop a
   * set until the three lifts that must be there fit, floored at two.
   */
  const MIN_SPINE = 3;
  const levelSets = Math.max(SETS_MIN, Math.min(SETS_MAX,
    base.sets + (opts.intent ? 0 : SETS_BY_LEVEL[level])));
  let mainSets = levelSets;
  while (mainSets > SETS_MIN
    && MIN_SPINE * setCost(mainSets, WORK_SEC, REST_BY_INTENT[base.intent]) > liftBudget) mainSets--;
  /**
   * ⚠️ AND THE SAME ADJUSTMENT UPWARDS, OR AN HOUR BUYS NOTHING. Measured before this: a
   * sixty-minute intermediate base session ran the WHOLE spine at two sets and finished in thirty —
   * half the time the runner said they had, with nothing left to add. The level picks a starting set
   * count; the clock is the constraint, and where the clock has room the sets grow into it.
   * ⚠️ BY AT MOST ONE, so the answer to "how much lifting have you done" still decides something at
   * every length rather than being washed out by a long session.
   * ⚠️ The estimate prices every spine slot, including any this runner's kit cannot fill, so it is
   * conservative: it raises the set count only when there is certainly room.
   */
  const spineCost = (n: number) => spine.reduce((t, s) => t + (s.role === "main"
    ? setCost(n, WORK_SEC, REST_BY_INTENT[base.intent])
    : setCost(Math.max(1, n - 1), WORK_SEC, REST_BY_INTENT[s.role === "hold" ? "hold" : "light"])), 0);
  while (mainSets < Math.min(SETS_MAX, levelSets + 1) && spineCost(mainSets + 1) <= liftBudget) mainSets++;
  /**
   * WARNING: THE YOUTH SET CAP IS APPLIED AFTER THE CLOCK, NOT BEFORE IT, because the clock can add
   * one. Measured: a 17-year-old at advanced level and sixty minutes starts at three sets (2 + the
   * level's +1) and the growth loop above takes it to four, which is past the NSCA's 1-3. Capping the
   * starting figure would have left that untouched.
   */
  if (youth) mainSets = Math.min(mainSets, youth.maxStrengthSets);
  // The shipped session's own relationship: the trunk work carries one set fewer than the lifts.
  const accSets = Math.max(1, mainSets - 1);

  const superset = prefs.minutes >= SUPERSET_MIN_MINUTES && level !== "beginner";
  const used = new Set<string>();
  const out: BuiltExercise[] = [];
  let total = 0;
  let group = 0;

  for (const s of spine) {
    const id = pickForSlot(s, owned, level, used, opts.rotate ?? 0);
    if (!id) continue;
    const ex: BuiltExercise = s.role === "hold"
      ? { id, sets: accSets, reps: HOLD_REPS, restSeconds: REST_BY_INTENT.hold }
      : s.role === "accessory"
        ? { id, sets: accSets, reps: ACCESSORY_REPS, restSeconds: REST_BY_INTENT.light }
        : { id, sets: mainSets, reps: base.reps, restSeconds: REST_BY_INTENT[base.intent] };
    if (s.role === "main" && s.load && base.load) ex.loadPercent1RM = base.load;

    // What adding it costs, taking into account that it may ride alongside the previous exercise.
    const prev = out[out.length - 1];
    const canPair = superset && s.role !== "main" && prev != null && prev.superset == null
      && !(prev.contacts != null);
    const cost = canPair ? pairCost(prev!, ex) - soloCost(prev!) : soloCost(ex);

    // ⚠️ CLOSEST FIT, NOT "WHILE IT FITS". Stopping at the last exercise that fits under the budget
    // leaves a session up to one exercise short of what was asked for; a runner who said forty-five
    // minutes and got thirty-one has been told the question does not matter.
    // ⚠️⚠️ BUT THE ANSWER IS A CEILING, SO THE OVERSHOOT IS BOUNDED AND THE UNDERSHOOT IS NOT.
    // "How long have you got" is a statement about the runner's day: two minutes over is a rounding
    // error, ten minutes over is a session they cannot finish. Closest fit on its own can overshoot by
    // half an exercise — measured at six minutes on a thirty-minute advanced session — so it may only
    // cross the line by OVER_SLACK. Coming in under is fine and sometimes unavoidable: a beginner's
    // whole spine at two sets is thirty-three minutes, and padding it to fill a forty-five-minute
    // answer would be inventing work to match a number.
    const after = total + cost;
    if (after > liftBudget && (after - liftBudget > OVER_SLACK
      || Math.abs(after - liftBudget) >= Math.abs(total - liftBudget))) break;

    if (canPair) { group++; prev!.superset = group; ex.superset = group; }
    out.push(ex);
    used.add(id);
    total = after;
  }

  if (ply) {
    out.push({ id: "pogo", sets: ply.pogoSets, reps: ply.pogoReps, restSeconds: REST_BY_INTENT.plyo, contacts: ply.pogoSets * ply.pogoEach });
    // ⚠️ A BEGINNER GETS HOPS AND NOT JUMPS, and the contacts fall with it rather than being made up
    // elsewhere. Box jumps are an intermediate movement in the catalogue; handing them to somebody who
    // told us they are starting out is the one place in this builder where honouring the dose would
    // mean ignoring the answer. Their weekly total sits below the evidenced band, which is what
    // choosing that level costs and is said rather than hidden.
    if (jumps) out.push({ id: "boxjump", sets: ply.jumpSets, reps: ply.jumpReps, restSeconds: REST_BY_INTENT.plyo, contacts: ply.jumpSets * ply.jumpEach });
    total += plyoSeconds;
  }

  return { exercises: out, seconds: Math.round(total), budgetSeconds: budget, intent: base.intent };
}
