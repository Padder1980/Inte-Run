import { RACE_DISTANCES_M, METRES_PER_KM, type RaceDistanceKey } from "./units.ts";

/**
 * What a 12-17 year old may be coached towards, and how much.
 *
 * Commissioned by the owner on 21 September 2026, replacing an under-18 gate. The research, the
 * sources and what was discarded are in YOUTH.md at the repo root; read that before changing a
 * number here, because every one of them is a governing body's or a position stand's, not a taste.
 *
 * ⚠️⚠️ THESE ARE UK ATHLETICS' RULE, NOT ITS RECOMMENDATION, AND THAT WAS THE OWNER'S EXPLICIT
 * CHOICE. UKA publishes both: a maximum PERMITTED distance (Rules for Competition TR3 S4) and a
 * shorter RECOMMENDED one it licenses real events against. The recommendation would cap 15-17 at
 * 8-14 km and withhold the half marathon until 18. He chose the rule, having first proposed a table
 * more permissive than either. Do not quietly move to the recommendation, and do not move past the
 * rule -- the first reverses his decision, the second coaches a minor toward a race they cannot enter.
 *
 * ⚠️ THE NUMBERS A SEARCH GIVES YOU FOR THIS ARE WRONG, TWICE OVER. UKA's age groups CHANGED on
 * 1 April 2026 (U13/U15/U17 became U14/U16/U18), so anything written before that describes different
 * bands; and the widely-quoted table allowing a 15-year-old a half marathon and a 17-year-old a
 * marathon traces to a 1987 viewpoint article, not to any rule. YOUTH.md section 1 has the detail.
 * If a source lets a 15-year-old race a half, it is that table wearing a new hat.
 *
 * ⚠️ 18 IS AN ADULT, by his ruling and by UK majority, UKA's own rule (a marathon is permitted at 18)
 * and every World Marathon Major's entry age. So this module answers for 12-17 and for nobody else.
 */

/** The youngest and oldest ages that get a youth plan. 18 is an adult. */
export const YOUTH_MIN_AGE = 12;
export const YOUTH_MAX_AGE = 17;

/**
 * UKA Rules for Competition TR3 S4 - maximum permitted ROAD race distance, by age on the day.
 *
 * ⚠️ ROAD, NOT CROSS COUNTRY OR TRAIL, which are shorter again (12-13: 4 km, 14-15: 5 km, 16-17:
 * 8 km off-road). The app builds road plans, so road is the applicable column; if it ever builds a
 * trail plan these are the wrong numbers for it.
 */
const RULE_MAX_KM: Readonly<Record<number, number>> = { 12: 6, 13: 6, 14: 8, 15: 12, 16: 16, 17: 25 };

/**
 * The owner's own frequency column, adopted unchanged on 21 September 2026.
 *
 * ⚠️ THIS IS THE ONE COLUMN OF HIS TABLE THAT WAS NEVER IN DISPUTE, and it is well supported:
 * Nationwide Children's says under-14s should run "only three times per week", and measured practice
 * in competitive adolescent runners is 4.1 sessions a week at 13-14 and 5.1 at 17-18. His table said
 * "max 4-5" at 15-16; 5 is the ceiling of his own range and is what is encoded.
 */
const MAX_RUN_DAYS: Readonly<Record<number, number>> = { 12: 3, 13: 3, 14: 3, 15: 5, 16: 5, 17: 5 };

/**
 * Weekly volume as a multiple of the longest single session.
 *
 * ⚠️ PROVENANCE FLAG - THIS IS THE WEAKEST NUMBER IN THE FILE AND IS DELIBERATELY THE CONSERVATIVE
 * READING. It is attributed to the Youth Running Consensus Statement (Krabak et al., Br J Sports Med
 * 2021;55:305-318) by two independent secondary summaries; I could not obtain the primary text, and a
 * third source -- one quoting the discarded 1987 table -- says three rather than two. Two is chosen
 * because it is the smaller. Raising it needs the primary text, not another blog.
 */
const WEEKLY_MULTIPLE = 2;

/**
 * RESISTANCE TRAINING FOR 12-17s. The numbers are the NSCA's position stand (Faigenbaum et al.,
 * J Strength Cond Res 2009;23:S60-S79, Tables 1-3) and the 2014 International Consensus on Youth
 * Resistance Training, which agree with each other. YOUTH.md section 4 has the quotations.
 *
 * WARNING: THEY DO NOT VARY BY AGE WITHIN 12-17, AND THAT IS THE SOURCES' OWN SHAPE RATHER THAN A
 * SIMPLIFICATION. The NSCA's tables are keyed on TRAINING EXPERIENCE (novice / intermediate /
 * advanced), not on how old somebody is -- a 12-year-old who has lifted for two years and a
 * 17-year-old who has never touched a bar get the same prescription. So the row is constant down the
 * age column while the running limits are not, and the app's own `level` question is what moves it.
 *
 * WARNING: STRENGTH IS OFFERED, NOT WITHHELD. There is no minimum age in either source and the
 * benefits are large and well evidenced. What changes is HOW it is prescribed.
 */

/** Working sets per exercise. NSCA Tables 1 and 2: 1-3 for strength AND for power. */
const YOUTH_MAX_STRENGTH_SETS = 3;

/**
 * Reps for the main lifts. NSCA gives 6-15 for strength; 8-12 is its intermediate band and is what
 * the adult path already prescribes for its own accessory work, so the app has one vocabulary.
 */
const YOUTH_STRENGTH_REPS = "8–12";

/** Reps in a power (plyometric) set. NSCA Table 3: 3-6, "to maintain quality of movement". */
const YOUTH_MAX_PLYO_REPS = 6;

/** Sessions a week. NSCA: 2-3, on non-consecutive days. */
const YOUTH_MAX_STRENGTH_SESSIONS = 3;

/**
 * The supervision sentence, which ships on every youth strength session.
 *
 * WARNING: IT IS A CONDITION OF THE EVIDENCE, NOT A DISCLAIMER. Every favourable finding in both
 * position stands is qualified by "with qualified supervision", and the NSCA's permission for loads
 * above 85% of a one-rep max is conditional on it specifically. An app cannot watch a squat, so the
 * honest thing is to say which half of the recommendation it can supply and which it cannot.
 */
/**
 * The title and the opening sentence of a 12-17 strength session.
 *
 * WARNING: THEY ARE CONSTANTS BECAUSE THREE BUILDERS WRITE THIS COPY -- the legacy no-preferences
 * session, the preference-driven one and a standalone programme's -- and the first cut folded the
 * data on all three while folding the WORDS on only one. Measured: a 13-year-old on the preferences
 * path was handed a session titled "Strength (heavy)" described as "~80%+ 1RM, low reps" over
 * exercises prescribing 8-12 with no load anywhere, which reinstates by sentence exactly what
 * removing `loadPercent1RM` took out of the data.
 */
export const YOUTH_STRENGTH_TITLE = "Strength & power";
export const YOUTH_STRENGTH_LEAD =
  "Strength work, prescribed the way the research asks for at your age: a rep range rather than a percentage. "
  + "Pick a weight you could manage two or three more times than you are asked for, and stop well before your form goes.";

export const YOUTH_STRENGTH_NOTE =
  "Lifting is good for you at your age — the research is clear about that, and it is clear that it works best "
  + "with a coach or an adult who knows the lifts watching your technique. This app can tell you what to do; it "
  + "cannot see you do it. Learn each movement with somebody before you add weight to it.";

/**
 * What a card shows in place of a load percentage.
 *
 * WARNING: IT IS A REAL PRESCRIPTION, NOT A BLANK. It is reps-in-reserve, which is what the NSCA
 * tells you to do when no 1RM is known -- "establish the repetition range and then by trial and error
 * determine the maximum load" -- and it is understandable by a 13-year-old, which "70-75%" is not.
 *
 * WARNING: IT NEVER GOES IN `loadPercent1RM`. That field is DATA: A6 parses a percentage out of it to
 * seed a suggested weight. Prose there would be parsed as a number and is how a suggestion becomes
 * NaN. This string is for the programme card's own display column and for nothing else.
 */
export const YOUTH_LOAD_TEXT = "a weight you could lift 2–3 more times";

/** The youngest age the plan will rehearse a race pace at. See `YouthLimits.allowRacePaceWork`. */
const RACE_PACE_MIN_AGE = 15;

export interface YouthLimits {
  /** The age these limits were resolved for, after clamping. */
  age: number;
  /** No single run may exceed this. UKA TR3 S4. */
  maxSessionKm: number;
  /** No week's running may exceed this. See WEEKLY_MULTIPLE's provenance flag. */
  maxWeeklyKm: number;
  /** Most days a week the plan may schedule a run. */
  maxRunDays: number;
  /**
   * May the plan prescribe goal-race-pace work (8 x 1 km at 5k pace and its relatives)?
   *
   * WARNING: FALSE UNDER 15, AND IT IS THE RESEARCH RATHER THAN THE ARITHMETIC THAT SETS THIS.
   * Hudson's Freshman plan -- the most conservative thing in the book, written for a runner brand new
   * to structured training -- carries hill sprints and fartlek and nothing else: no intervals, no
   * threshold, no goal-pace work. The youth running consensus statement is evidence-based for 13-18
   * and explicitly opinion below that. Measured, a 12-year-old was otherwise handed a peak-phase
   * race-specific session covering 8.6 km against a 6 km whole-session ceiling.
   *
   * WARNING: IT DOES NOT MEAN "NO HARD RUNNING". They still get a quality session every week -- a
   * VO2 or threshold one, which at this age the app's own beginner track already builds as fartlek
   * and hill work. What goes is rehearsing a race pace, which is the piece the sources agree is for
   * older runners.
   */
  allowRacePaceWork: boolean;
  /** Working sets per exercise in a strength session. Constant across 12-17 -- see the note above. */
  maxStrengthSets: number;
  /** What the main lifts are prescribed in. A rep range, never a percentage; see below. */
  strengthReps: string;
  /** Reps in one plyometric set. */
  maxPlyoReps: number;
  /** Strength sessions a week. */
  maxStrengthSessions: number;
}

/**
 * WARNING: THERE IS NO LOAD FIELD, AND ITS ABSENCE IS THE PRESCRIPTION RATHER THAN AN OMISSION.
 * A youth session carries no `loadPercent1RM` at all, and nothing here can be set to restore one.
 *
 * A percentage is a share of a one-rep max, so prescribing "70%" to a 14-year-old asks them to know
 * their one-rep max -- and unsupervised 1RM testing is exactly what both position stands forbid for
 * this group. Capping the percentage rather than removing it was considered and is worse: it keeps the
 * instruction to go and find the number while quibbling about the fraction. The NSCA says what to do
 * instead, in as many words: "if 1RM tests are not performed... establish the repetition range and
 * then by trial and error determine the maximum load". That is a rep range, which is what ships.
 *
 * WARNING: THE SAME REASONING WITHHOLDS THE ESTIMATED 1RM IN THE APP. The estimate itself is safe --
 * it is Epley over submaximal sets and nobody has to lift anything maximal to produce it. Putting the
 * number on the screen is the hazard: a one-rep max in front of a 14-year-old is an invitation to go
 * and test it.
 */

/**
 * True for anyone this module answers for. Absent, non-finite and 18+ are all false.
 *
 * ⚠️ DELIBERATELY UNBOUNDED BELOW, AND THAT IS THE SAFE DIRECTION. There is no lower test, so
 * an age of 9 is "youth" and youthLimitsFor clamps it to the 12 row. The form cannot produce one, but
 * a restored backup or a future birthday field could -- and the failure mode of a lower bound would be
 * that the youngest runner in the app is treated as an ADULT, which is the one outcome this file
 * exists to prevent.
 */
export function isYouthAge(age: number | null | undefined): boolean {
  return typeof age === "number" && Number.isFinite(age) && age < YOUTH_MAX_AGE + 1;
}

/**
 * The limits for this age, or null for an adult.
 *
 * ⚠️ AN AGE BELOW 12 CLAMPS TO THE 12 LIMITS RATHER THAN THROWING OR ANSWERING null. The form cannot
 * produce one (ageOpts starts at 12) and UKA's rules "do not cater for athletes younger than 12",
 * saying only that distances "should be scaled-down appropriately" -- so we have no basis for a real
 * answer and the most restrictive row we do have is the honest fallback. null here would mean ADULT,
 * which is the one answer that must never come back for a child.
 */
export function youthLimitsFor(age: number | null | undefined): YouthLimits | null {
  if (!isYouthAge(age)) return null;
  const a = Math.max(YOUTH_MIN_AGE, Math.min(YOUTH_MAX_AGE, Math.floor(age as number)));
  const km = RULE_MAX_KM[a]!;
  return {
    age: a,
    maxSessionKm: km,
    maxWeeklyKm: km * WEEKLY_MULTIPLE,
    maxRunDays: MAX_RUN_DAYS[a]!,
    allowRacePaceWork: a >= RACE_PACE_MIN_AGE,
    maxStrengthSets: YOUTH_MAX_STRENGTH_SETS,
    strengthReps: YOUTH_STRENGTH_REPS,
    maxPlyoReps: YOUTH_MAX_PLYO_REPS,
    maxStrengthSessions: YOUTH_MAX_STRENGTH_SESSIONS,
  };
}

/** The shape both plyometric dose tables in the engine share. */
export interface PlyoDose {
  pogoSets: number; pogoReps: string; pogoEach: number;
  jumpSets: number; jumpReps: string; jumpEach: number;
}

/**
 * Fold a plyometric dose to what a 12-17 runner may do. Adults pass through untouched.
 *
 * WARNING: THE ENGINE HAS TWO DOSE TABLES -- `PLYO_DOSE` on the legacy no-preferences path and the
 * pair inside `plyoFor` -- AND THIS IS DELIBERATELY NOT A THIRD. Both call this, so there is one
 * definition of the cap even though there are two of the dose. Capping in one and not the other is
 * the fix-one-builder-not-the-other trap this repo has paid for six times, and here it would leave
 * whichever path a runner happened to be on prescribing ten hops a set to a 12-year-old.
 *
 * WARNING: THE REPS FIELD IS A STRING AND IS REBUILT FROM THE NUMBER, not left as the adult's. The
 * label is what the runner reads and `pogoEach` is what the ground-contact total is computed from, so
 * capping one and not the other is a session that says "10" and counts 6.
 */
export function youthPlyoDose(d: PlyoDose, lim: YouthLimits | null): PlyoDose {
  if (!lim) return d;
  const pogo = Math.min(d.pogoEach, lim.maxPlyoReps);
  const jump = Math.min(d.jumpEach, lim.maxPlyoReps);
  return {
    pogoSets: Math.min(d.pogoSets, lim.maxStrengthSets), pogoEach: pogo, pogoReps: String(pogo),
    jumpSets: Math.min(d.jumpSets, lim.maxStrengthSets), jumpEach: jump, jumpReps: String(jump),
  };
}

/**
 * Filter a caller's own list of goals down to the ones this age may be coached towards.
 *
 * ⚠️ IT TAKES THE OFFERED LIST RATHER THAN OWNING ONE, AND THE DISTANCES COME FROM RACE_DISTANCES_M.
 * A second list of goal keys here would drift from GOAL_BY_STATUS the first time either changed, and
 * a second table of metres would drift from units.ts -- so this module owns only the CEILING and the
 * intersection is computed. Adding a goal to the app needs no edit here, and it cannot slip past the
 * ceiling either.
 *
 * ⚠️ NEVER EMPTY FOR A REAL AGE: a 5k is 5 km and the lowest ceiling is 6 km, so the shortest goal
 * always survives. An empty result means the caller passed an empty list, which is its own bug --
 * a picker with nothing in it is the dead-end this repo refuses to ship.
 */
export function youthGoalsFrom(offered: readonly RaceDistanceKey[], age: number | null | undefined): RaceDistanceKey[] {
  const lim = youthLimitsFor(age);
  if (!lim) return offered.slice();
  return offered.filter((k) => RACE_DISTANCES_M[k] / METRES_PER_KM <= lim.maxSessionKm);
}

/** Fold a day-count answer from anywhere onto what this age may run. Adults pass through. */
export function clampYouthDays(age: number | null | undefined, days: number): number {
  const lim = youthLimitsFor(age);
  const n = Math.round(Number(days));
  if (!Number.isFinite(n)) return lim ? lim.maxRunDays : days;
  return lim ? Math.min(lim.maxRunDays, n) : n;
}
