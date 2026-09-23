import type { StrengthPrefs } from "../domain/types.ts";
import { youthLimitsFor, YOUTH_LOAD_TEXT } from "../domain/youth.ts";
import {
  REST_BY_INTENT, buildStrength,
  type BuiltStrength, type RestIntent, type StrengthIntent,
} from "./builder.ts";

/**
 * A STANDALONE STRENGTH PROGRAMME (A7) — four to twelve weeks that PROGRESS, rather than a plan
 * phase's single repeated prescription.
 *
 * The plan's own strength sessions answer "what does this week of RUNNING need beside it". A
 * programme answers a different question — "I want to get stronger over the next few months" — and
 * the difference is that it has a shape of its own: learn the movements, then load them, then lift
 * heavy, easing off every fourth week so the work lands.
 *
 * ⚠️ IT IS THE SAME BUILDER, NOT A SECOND ONE. `buildStrength` already owns the hard part — filling
 * a time budget at the rests a prescription needs, supersetting where there is room, picking only
 * exercises the runner can actually perform. A programme injects its BLOCK's prescription and a
 * rotation offset; everything else is the machinery A3 already proved. Two builders for one job is
 * how a rest interval comes to mean one thing in a plan session and another in a programme one.
 *
 * ⚠️ NO PLYOMETRICS HERE, DELIBERATELY. The jump dose is a RUNNING-plan concept: `addStrength` caps
 * it at two sessions a week so the weekly ground-contact total stays inside the evidenced band, and
 * that accounting has no idea a programme exists. A programme adding its own contacts would silently
 * push a runner past the band the plan is carefully keeping them inside. Said here rather than left
 * to be noticed.
 */

export const PROGRAMME_WEEKS_MIN = 4;
export const PROGRAMME_WEEKS_MAX = 12;
/** The most sessions a week a programme may ask for — the same ceiling the plan's own question uses. */
export const PROGRAMME_SESSIONS_MAX = 4;

/** Every fourth week eases off so the three before it can be absorbed. */
export const DELOAD_EVERY = 4;
/** What a deload does to the prescription: one set fewer, a tenth off the load. */
export const DELOAD_SET_DROP = 1;
export const DELOAD_LOAD_FRAC = 0.9;
/** A deload never drops below this, whatever the block asked for — the builder's own floor. */
const DELOAD_SETS_FLOOR = 2;

export type ProgrammeBlockName = "technique" | "loading" | "heavy";

type BlockDef = {
  name: ProgrammeBlockName;
  /** First week (1-based) this block covers; the next block's `fromWeek` ends it. */
  fromWeek: number;
  reps: string;
  intent: RestIntent;
  /** The set band. The level picks within it — see setsFor. */
  setsLo: number;
  setsHi: number;
  /** Percentage of one-rep max. `loadHi` absent means "and upwards" — an open-ended 80%+. */
  loadLo: number;
  loadHi?: number;
  /** What the runner is being asked to do in this block, in one line, for the screen. */
  focus: string;
};

/**
 * ⚠️ THE BLOCKS ARE THE PROGRAMME. Weeks 1–2 teach the movement at a load you can control; 3–5 add
 * real load at moderate reps; 6 onwards is the heavy, low-rep work the running-economy evidence is
 * actually about (31 studies, 652 runners: heavy lifting at or above 80% 1RM improved economy and
 * performance, while submaximal work produced nothing). Arriving there in week one is how people
 * hurt themselves; never arriving is how a programme does nothing.
 */
const BLOCKS: BlockDef[] = [
  { name: "technique", fromWeek: 1, reps: "8–12", intent: "light", setsLo: 2, setsHi: 3, loadLo: 70, loadHi: 70,
    focus: "Learn the movements at a load you can control." },
  { name: "loading", fromWeek: 3, reps: "6–8", intent: "moderate", setsLo: 3, setsHi: 3, loadLo: 75, loadHi: 80,
    focus: "Add real load while the reps stay moderate." },
  { name: "heavy", fromWeek: 6, reps: "3–6", intent: "heavy", setsLo: 3, setsHi: 4, loadLo: 80,
    focus: "Heavy and low-rep — the work the evidence is about." },
];

export type ProgrammeWeek = {
  /** 1-based. */
  week: number;
  block: ProgrammeBlockName;
  isDeload: boolean;
  sets: number;
  reps: string;
  /** "70%", "75–80%", "80%+" — already carrying any deload reduction. */
  load: string;
  /**
   * The rest INTENT, not the seconds, because the seconds are not a key: light and plyo are both 90
   * in REST_BY_INTENT, so a reverse lookup from a duration cannot say which was meant. The seconds
   * are one lookup away for anyone who needs them.
   */
  intent: RestIntent;
  restSeconds: number;
  focus: string;
};

function blockFor(week: number): BlockDef {
  let out = BLOCKS[0]!;
  for (const b of BLOCKS) if (week >= b.fromWeek) out = b;
  return out;
}

/**
 * Sets for one block at one level.
 *
 * ⚠️ THE BANDS ARE ONE SET WIDE, SO THERE ARE TWO VALUES TO HAND OUT, NOT THREE — and the level's
 * third distinction is one it already makes far more strongly elsewhere: `canDo` gates the whole
 * catalogue by `minLevel`, so a beginner is never offered a barbell deadlift whatever their set
 * count says. Squeezing a third set count out of a two-wide band would be a difference nobody could
 * feel, on top of one they certainly can.
 */
function setsFor(b: BlockDef, level: StrengthPrefs["level"]): number {
  const n = b.setsLo + (level === "advanced" ? 1 : 0);
  return Math.max(b.setsLo, Math.min(b.setsHi, n));
}

/**
 * The load as the runner reads it.
 *
 * ⚠️ HELD AS NUMBERS AND FORMATTED HERE, RATHER THAN STORED AS THE STRING. A deload takes a tenth
 * off the load, and "10% off 80%+" is not something you can do to a string — the first cut would
 * have had to parse its own output back. The open-ended `80%+` is the one case with no upper bound:
 * the evidence names a floor, not a ceiling, and a deload lowers that floor rather than capping it.
 */
function loadText(b: BlockDef, deload: boolean): string {
  const f = deload ? DELOAD_LOAD_FRAC : 1;
  const lo = Math.round(b.loadLo * f);
  if (b.loadHi == null) return lo + "%+";
  const hi = Math.round(b.loadHi * f);
  return lo === hi ? lo + "%" : lo + "–" + hi + "%";
}

/** Is this week an ease-off week? Every fourth: 4, 8, 12. */
export function isDeloadWeek(week: number): boolean {
  return week > 0 && week % DELOAD_EVERY === 0;
}

/** What one week of a programme prescribes, for the screen and for the builder. */
export function programmeWeek(week: number, level: StrengthPrefs["level"]): ProgrammeWeek {
  const b = blockFor(week);
  const deload = isDeloadWeek(week);
  const sets = deload
    ? Math.max(DELOAD_SETS_FLOOR, setsFor(b, level) - DELOAD_SET_DROP)
    : setsFor(b, level);
  return {
    week, block: b.name, isDeload: deload, sets, reps: b.reps,
    load: loadText(b, deload),
    intent: b.intent,
    restSeconds: REST_BY_INTENT[b.intent],
    focus: deload ? "Ease off — one set fewer and a lighter load, so the last three weeks land." : b.focus,
  };
}

/**
 * How many distinct sessions the rotation runs through — A/B, or A/B/C once a runner is lifting
 * three or more times a week.
 *
 * ⚠️ ALWAYS AT LEAST TWO, EVEN AT ONE SESSION A WEEK. A programme is four to twelve weeks long; one
 * session a week with no rotation is the same handful of lifts twelve times in a row, which is the
 * one thing a programme is supposed to be better than.
 */
export function rotationSize(sessionsPerWeek: number): number {
  return sessionsPerWeek >= 3 ? 3 : 2;
}

/**
 * Which rotation slot a given session falls in — counted across the WHOLE programme, not restarted
 * each week, so an odd number of sessions a week still alternates rather than repeating session A
 * every Monday for three months.
 */
export function rotationIndex(week: number, slot: number, sessionsPerWeek: number): number {
  // ⚠ Total in its argument, for the same reason `pickForSlot` refuses a non-finite rotation: this
  // number comes off a stored record, and `Math.max(1, undefined)` is NaN rather than 1.
  const n = Number.isFinite(sessionsPerWeek) ? Math.max(1, Math.round(sessionsPerWeek)) : 1;
  const size = rotationSize(n);
  return ((((week - 1) * n + slot) % size) + size) % size;
}

/** The A/B/C label for a session, for the card. */
export function rotationLabel(week: number, slot: number, sessionsPerWeek: number): string {
  return String.fromCharCode(65 + rotationIndex(week, slot, sessionsPerWeek));
}

export type ProgrammePrefs = Pick<StrengthPrefs, "minutes" | "level" | "goal" | "equipment"> & {
  sessionsPerWeek: number;
  /**
   * The runner's age, so a 12-17 programme is folded to the youth band. Absent is an adult.
   *
   * WARNING: IT RIDES ON THE PREFS RATHER THAN ON EACH FUNCTION'S OWN ARGUMENTS, and that is the
   * point. `buildProgrammeSession`, `programmeWeekFor` and `programmeWeeksFor` all take these prefs
   * and all three have to agree about who is lifting -- three separate parameters is three chances
   * for one caller to pass it and another to forget, and the failure there is a card promising a
   * heavy block over a session that will not contain one.
   */
  age?: number;
};

/**
 * One session of a programme: the block's prescription, filled into the runner's own time budget by
 * the same builder the plan's sessions use, rotated so consecutive sessions are not the same lifts.
 */
export function buildProgrammeSession(opts: {
  week: number;
  /** 0-based position within that week. */
  slot: number;
  prefs: ProgrammePrefs;
}): BuiltStrength & { plan: ProgrammeWeek; rotation: number } {
  const pw = programmeWeek(opts.week, opts.prefs.level);
  const intent: StrengthIntent = { reps: pw.reps, intent: pw.intent, load: pw.load, sets: pw.sets };
  const rotation = rotationIndex(opts.week, opts.slot, opts.prefs.sessionsPerWeek);
  const built = buildStrength({
    // The phase and maintenance flag reach nothing once an intent is injected and plyo is off; they
    // are passed as the neutral pair rather than left to a default that could drift.
    phase: "base",
    maintenance: false,
    prefs: opts.prefs,
    competitive: false,
    plyo: false,
    intent,
    rotate: rotation,
    // ⚠ A PROGRAMME IS THE ONE STRENGTH PATH THAT INJECTS ITS OWN INTENT, so it is the one path a
    // youth could otherwise reach a heavy block through: the third block of an eight-week programme
    // prescribes 3-6 reps at 85%+, and `intentFor` -- which is where the age is usually tested -- is
    // never called. `buildStrength` folds an injected intent to the band; this is what tells it to.
    youth: youthLimitsFor(opts.prefs.age),
  });
  return { ...built, plan: deliveredWeek(pw, built, youthLimitsFor(opts.prefs.age) != null), rotation };
}

/**
 * What the BLOCK asked for, corrected to what the session was actually built with.
 *
 * ⚠️⚠️ `plan` USED TO BE THE RAW BLOCK TABLE AND ITS READERS PRINTED IT AS THOUGH IT WERE THE
 * SESSION. `programmeSession` writes "3 sets of 3-6 (heavy) at 80%+" straight out of it, and the
 * three figures could all be wrong at once: the clock trims the set count (A7's own note measured a
 * 20-minute advanced heavy week prescribed 3 sets and delivered 2), and for a 12-17 runner every
 * exercise is folded to 8-12 with no load at all — so a 13-year-old's programme card promised heavy
 * triples at 80%+ over a session containing neither.
 *
 * ⚠️ THE MAIN LIFT IS THE ONE WITH THE MOST SETS, not the one carrying a load. A youth session
 * carries no percentage anywhere by design, so `find(e => e.loadPercent1RM)` answers undefined for
 * exactly the runner this matters most for. The spine's main lifts take `mainSets` and everything
 * else takes one fewer, so the maximum IS the main lift's figure — and it is the same number the old
 * test returned for every adult.
 *
 * ⚠️ AND A SESSION WITH NO PERCENTAGE SHOWS THE REPS-IN-RESERVE WORDING RATHER THAN THE BLOCK'S.
 * Derived from what was BUILT rather than from a second age test, so this column can never describe a
 * load the session does not prescribe.
 */
function deliveredWeek(pw: ProgrammeWeek, built: BuiltStrength, youth: boolean): ProgrammeWeek {
  let sets = 0, reps = pw.reps, load: string | undefined, rest = pw.restSeconds;
  for (const e of built.exercises) if (e.sets > sets) { sets = e.sets; reps = e.reps; load = e.loadPercent1RM; rest = e.restSeconds; }
  if (!sets) return pw;
  return {
    ...pw, sets, reps, load: load ?? YOUTH_LOAD_TEXT,
    restSeconds: rest, intent: built.intent,
    focus: youth && !pw.isDeload ? YOUTH_FOCUS[pw.block] : pw.focus,
  };
}

/**
 * What each block is FOR when the lifter is 12-17.
 *
 * ⚠️⚠️ THE BLOCKS STILL PROGRESS — BY LOAD, NOT BY DROPPING INTO A HEAVY REP BAND — AND THE ADULT
 * SENTENCES DESCRIBE A PROGRESSION THAT IS NOT HAPPENING. "Heavy and low-rep — the work the evidence
 * is about" sat over a youth week 9 prescribing 8-12 with no percentage. What the sources describe
 * instead is the same rep range with a little more weight each block (the NSCA's own "progression
 * 5-10%"), which is a real progression and is what these say.
 *
 * ⚠️ A DELOAD KEEPS ITS OWN SENTENCE, because "ease off" is true at every age and is the one thing on
 * the card that must not be reworded into something that sounds like more work.
 */
const YOUTH_FOCUS: Readonly<Record<ProgrammeBlockName, string>> = {
  technique: "Learn the movements properly — light, clean and controlled. This block is about how it looks, not how much.",
  loading: "Same reps, a little more weight than last block. Add it in small steps.",
  heavy: "Keep the reps where they are and keep adding a little weight — at your age that IS the progression.",
};

/**
 * What a week will ACTUALLY deliver for this runner: the block's prescription after the clock has had
 * it.
 *
 * ⚠⚠ THE BLOCK PROPOSES THE SET COUNT AND THE RUNNER'S OWN MINUTES DISPOSE, SO THE CARD HAS TO ASK
 * THE BUILDER RATHER THAN THE TABLE. Measured, the two disagree in BOTH directions: a 20-minute
 * advanced heavy week is prescribed 3 sets and delivered 2 (the spine has to fit), and a 60-minute
 * intermediate technique week is prescribed 2 and delivered 3 (an hour has to buy something). A card
 * reading "3 × 3–6" over a session giving two sets is the same class of defect as a title promising
 * minutes a session does not contain, and this repo has shipped that twice.
 *
 * ⚠ THE FIX IS HERE AND NOT IN THE BUILDER. Making the block's count authoritative would undo A3's
 * own measured rule -- the sets give way before the movements do, or a 30-minute advanced session is
 * one exercise -- so the truth is what the builder produces and the card reports it.
 *
 * ⚠ THE SET COUNT IS READ OFF A MAIN LIFT, IDENTIFIED BY CARRYING A LOAD. Accessories deliberately
 * run one set fewer, so reading the first exercise would under-report by one whenever the spine's
 * order put an accessory first. With no main lift at all (nothing in this runner's kit can fill one)
 * the table's own number is the honest answer rather than a guess.
 */
export function programmeWeekFor(week: number, prefs: ProgrammePrefs): ProgrammeWeek {
  // ⚠ ONE DERIVATION, READ BY BOTH THE CARD AND THE SESSION'S OWN DESCRIPTION. `buildProgrammeSession`
  // already corrects the block to what it built; asking it is what stops the two disagreeing.
  try {
    return buildProgrammeSession({ week, slot: 0, prefs }).plan;
  } catch {
    return programmeWeek(week, prefs.level);
  }
}

/** Every week of a programme, for the overview screen. */
export function programmeWeeks(weeks: number, level: StrengthPrefs["level"]): ProgrammeWeek[] {
  const n = Math.max(PROGRAMME_WEEKS_MIN, Math.min(PROGRAMME_WEEKS_MAX, Math.round(weeks)));
  const out: ProgrammeWeek[] = [];
  for (let w = 1; w <= n; w++) out.push(programmeWeek(w, level));
  return out;
}

/** The same overview, but showing what this runner's own minutes will actually deliver. */
export function programmeWeeksFor(weeks: number, prefs: ProgrammePrefs): ProgrammeWeek[] {
  const n = Math.max(PROGRAMME_WEEKS_MIN, Math.min(PROGRAMME_WEEKS_MAX, Math.round(weeks)));
  const out: ProgrammeWeek[] = [];
  for (let w = 1; w <= n; w++) out.push(programmeWeekFor(w, prefs));
  return out;
}
