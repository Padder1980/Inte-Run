/**
 * Y3 — RESISTANCE TRAINING FOR 12-17s.
 *
 * The numbers are the NSCA's Youth Resistance Training position stand (Faigenbaum et al. 2009,
 * Tables 1-3) and the 2014 International Consensus, which agree: 1-3 sets, 6-15 reps for strength,
 * 3-6 for power, 2-3 sessions a week. `src/domain/youth.ts` owns them; YOUTH.md section 4 has the
 * quotations and section 5.3 the specification these guards were written from.
 *
 * ⚠️⚠️ THE ONE PROPERTY EVERYTHING ELSE HANGS OFF IS THAT A YOUTH SESSION CARRIES NO PERCENTAGE OF A
 * ONE-REP MAX ANYWHERE. Prescribing one asks a 14-year-old to know their 1RM, and unsupervised 1RM
 * testing is the single thing both position stands forbid outright. There are THREE builders that can
 * produce a strength session — the legacy no-preferences path, the preference-driven one and a
 * standalone programme's — and the first cut of this work folded the data on all three and the WORDS
 * on only one, so a 13-year-old was handed a session titled "Strength (heavy)" described as
 * "~80%+ 1RM" over exercises prescribing 8-12 with no load. Every sweep below therefore runs all
 * three rather than the one that is easiest to reach.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { strengthSession, programmeSession } from "../src/plan/session-templates.ts";
import { strengthSessionsFor } from "../src/domain/strength-days.ts";
import { buildStrength, intentFor } from "../src/strength/builder.ts";
import { youthLimitsFor, isYouthAge, YOUTH_STRENGTH_NOTE, YOUTH_MAX_AGE } from "../src/domain/youth.ts";
import type { Athlete, Goal, StrengthPrefs } from "../src/domain/types.ts";

const KIT = ["bodyweight", "dumbbell", "barbell", "box", "bench", "kettlebell"] as StrengthPrefs["equipment"];
const prefs = (over: Partial<StrengthPrefs> = {}): StrengthPrefs =>
  ({ sessionsPerWeek: 3, minutes: 45, level: "intermediate", goal: "running", equipment: KIT, ...over }) as StrengthPrefs;

const YOUTH_AGES = [12, 13, 14, 15, 16, 17];
const PHASES = ["base", "build", "peak", "taper"] as const;

/** Every strength session all three builders can produce for one age. */
function allSessions(age: number | undefined) {
  const out: { path: string; s: ReturnType<typeof strengthSession> }[] = [];
  for (const phase of PHASES) {
    for (const maintenance of [false, true]) {
      for (const competitive of [false, true]) {
        out.push({ path: "legacy", s: strengthSession(phase, maintenance, { competitive, age }) });
        for (const level of ["beginner", "intermediate", "advanced"] as const) {
          for (const minutes of [20, 30, 45, 60] as const) {
            out.push({
              path: "prefs",
              s: strengthSession(phase, maintenance, { competitive, prefs: prefs({ level, minutes }), plyo: true, age }),
            });
          }
        }
      }
    }
  }
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    for (const minutes of [20, 30, 45, 60] as const) {
      for (const week of [1, 3, 5, 7, 9, 11, 12]) {
        for (const slot of [0, 1]) {
          out.push({
            path: "programme",
            s: programmeSession(week, slot, { minutes, level, goal: "running", equipment: KIT, sessionsPerWeek: 3, age }),
          });
        }
      }
    }
  }
  return out;
}

const main = (s: { exercises?: { sets: number }[] }) =>
  (s.exercises ?? []).reduce((a, b) => (b.sets > a.sets ? b : a), { sets: 0 } as { sets: number });

// -------------------------------------------------------------------------------------------------

test("BLOCKER: no 12-17 strength session prescribes a percentage of a one-rep max, on any path", () => {
  let checked = 0;
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      for (const e of s.exercises ?? []) {
        checked++;
        assert.equal((e as { loadPercent1RM?: string }).loadPercent1RM, undefined,
          "age " + age + " on the " + path + " path: " + s.title + " prescribes " + (e as { loadPercent1RM?: string }).loadPercent1RM);
      }
    }
  }
  assert.ok(checked > 3000, "the sweep only looked at " + checked + " exercises — it is not measuring the library");
});

test("BLOCKER: an adult still gets one, so the guard above discriminates", () => {
  const loaded = allSessions(undefined)
    .flatMap(({ s }) => (s.exercises ?? []) as { loadPercent1RM?: string }[])
    .filter((e) => e.loadPercent1RM);
  assert.ok(loaded.length > 200, "only " + loaded.length + " adult exercises carry a load — the sweep proves nothing");
});

test("BLOCKER: a 12-17 session's own copy names no percentage and no one-rep max", () => {
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      const text = s.title + " " + s.description;
      assert.ok(!/1RM|\d\s*%|80%|70–75%|Heavy but controlled/i.test(text),
        "age " + age + " on the " + path + " path: " + text.slice(0, 160));
    }
  }
});

test("BLOCKER: the supervision line ships on every 12-17 strength session, all three paths", () => {
  const seen = new Set<string>();
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      assert.ok(s.description.includes(YOUTH_STRENGTH_NOTE),
        "age " + age + " on the " + path + " path: " + s.title + " ships without it");
      seen.add(path);
    }
  }
  assert.deepEqual([...seen].sort(), ["legacy", "prefs", "programme"], "a whole builder went unswept");
  // ...and an adult never sees it, or the sentence is not about age at all.
  for (const { s } of allSessions(undefined)) assert.ok(!s.description.includes(YOUTH_STRENGTH_NOTE));
});

test("BLOCKER: working sets never exceed three, including where the clock would add one", () => {
  const cap = youthLimitsFor(13)!.maxStrengthSets;
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      for (const e of s.exercises ?? []) {
        assert.ok(e.sets <= cap, "age " + age + " on the " + path + " path: " + s.title + " asks for " + e.sets + " sets");
      }
    }
  }
  /**
   * ⚠️ THE DISCRIMINATING CASE IS ADVANCED AT SIXTY MINUTES, and it is named rather than left to the
   * sweep because it is the only one where the cap binds. The level starts an advanced runner a set
   * above the base and `buildStrength`'s growth loop adds another where the clock has room — so
   * capping the STARTING figure rather than the finished one would have left this at four.
   */
  const adult = main(strengthSession("build", false, { prefs: prefs({ level: "advanced", minutes: 60 }), plyo: true }));
  assert.ok(adult.sets > cap, "the fixture no longer reaches " + (cap + 1) + " sets for an adult, so the cap is untested");
});

test("BLOCKER: a plyometric set is never longer than six reps, and the stated contacts match it", () => {
  const lim = youthLimitsFor(13)!;
  let jumps = 0;
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      for (const e of (s.exercises ?? []) as { sets: number; reps: string; contacts?: number }[]) {
        if (e.contacts == null) continue;
        jumps++;
        const reps = Number(e.reps);
        assert.ok(Number.isFinite(reps), "age " + age + " " + path + ": a plyometric rep count is not a number: " + e.reps);
        assert.ok(reps <= lim.maxPlyoReps, "age " + age + " on the " + path + " path: " + reps + " reps a set");
        // ⚠️ THE LABEL AND THE COUNT ARE CAPPED TOGETHER OR THE SESSION SAYS ONE THING AND COUNTS
        // ANOTHER. `pogoEach` is what the ground-contact total is computed from and `pogoReps` is
        // what the runner reads.
        assert.equal(e.contacts, e.sets * reps, "age " + age + " " + path + ": contacts disagree with sets x reps");
      }
    }
  }
  assert.ok(jumps > 20, "only " + jumps + " plyometric prescriptions were seen — the sweep is not reaching them");
});

test("BLOCKER: both dose tables are folded the same way — one definition of the cap", () => {
  /**
   * The engine has two plyometric dose tables (`PLYO_DOSE` on the legacy path, and the pair inside
   * `plyoFor`), and they carry the same numbers. A cap applied to one and not the other is the
   * fix-one-builder-not-the-other trap; measured here as behaviour rather than read out of the source.
   */
  const legacy = (strengthSession("build", false, { competitive: true, age: 13 }).exercises ?? [])
    .find((e) => (e as { contacts?: number }).contacts != null) as { reps: string } | undefined;
  const built = (strengthSession("build", false, { competitive: true, prefs: prefs({ minutes: 60 }), plyo: true, age: 13 }).exercises ?? [])
    .find((e) => (e as { contacts?: number }).contacts != null) as { reps: string } | undefined;
  assert.ok(legacy && built, "one of the two paths stopped prescribing jumps, so they cannot be compared");
  assert.equal(legacy!.reps, built!.reps, "the two dose tables are capped differently");
});

test("BLOCKER: at most three strength sessions a week, however many are asked for", () => {
  const lim = youthLimitsFor(13)!;
  const asked = 4;
  let bound = 0;
  for (const age of YOUTH_AGES) {
    for (const phase of PHASES) {
      for (const isDeload of [false, true]) {
        const wp = { phase, isDeload, ordinalInPhase: 1 } as Parameters<typeof strengthSessionsFor>[1];
        const a = { includeStrength: true, strength: prefs({ sessionsPerWeek: asked }), experience: "recreational", daysPerWeek: 5, age } as Parameters<typeof strengthSessionsFor>[0];
        const n = strengthSessionsFor(a, wp);
        assert.ok(n <= lim.maxStrengthSessions, "age " + age + " " + phase + ": " + n + " sessions");
        const adult = strengthSessionsFor({ ...a, age: undefined } as Parameters<typeof strengthSessionsFor>[0], wp);
        if (adult > n) bound++;
      }
    }
  }
  assert.ok(bound > 0, "the cap never bound anywhere in the sweep, so it is untested");
});

test("BLOCKER: an injected heavy block is folded too — the path that never calls intentFor", () => {
  /**
   * ⚠️⚠️ A STANDALONE PROGRAMME SUPPLIES ITS OWN INTENT, so it reaches `buildStrength` without
   * `intentFor` being consulted at all. Honouring that unconditionally would let a 13-year-old start
   * an eight-week programme whose third block prescribes 3-6 reps at 85%+ — past the rep floor and
   * past the load rule, through the one path where neither is tested.
   */
  const heavy = { reps: "3–6 (heavy)", intent: "heavy", load: "85%+", sets: 3 } as const;
  const built = buildStrength({
    phase: "base", maintenance: false, prefs: prefs(), competitive: false, plyo: false,
    intent: heavy, youth: youthLimitsFor(13),
  });
  for (const e of built.exercises) {
    assert.equal(e.loadPercent1RM, undefined, "an injected load reached a youth session");
    assert.ok(e.sets <= 3);
  }
  assert.ok(built.exercises.some((e) => e.reps === youthLimitsFor(13)!.strengthReps), "the injected rep band survived");
  assert.notEqual(built.intent, "heavy", "the injected rest intent survived, so the rests are the heavy block's");
  // The same injection for an adult keeps every part of it, which is what makes this discriminate.
  const adult = buildStrength({ phase: "base", maintenance: false, prefs: prefs(), competitive: false, plyo: false, intent: heavy });
  assert.ok(adult.exercises.some((e) => e.loadPercent1RM === "85%+"), "the adult programme lost its own block");
});

test("BLOCKER: a programme card never promises more than the session delivers", () => {
  for (const age of [undefined, 13, 17]) {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      for (const minutes of [20, 30, 45, 60] as const) {
        for (const week of [1, 3, 5, 7, 9, 11]) {
          const s = programmeSession(week, 0, { minutes, level, goal: "running", equipment: KIT, sessionsPerWeek: 3, age });
          const m = /session [ABC] — (\d+) sets of (.+?)(?: at (.+?))?, [\d.]+ minutes between sets\./.exec(s.description);
          assert.ok(m, "the programme description stopped naming its own prescription: " + s.description.slice(0, 160));
          const lift = main(s) as unknown as { sets: number; reps: string; loadPercent1RM?: string };
          const where = "age " + age + " " + level + " " + minutes + "min wk" + week + ": ";
          assert.equal(Number(m![1]), lift.sets, where + "card says " + m![1] + " sets, session has " + lift.sets);
          assert.equal(m![2], lift.reps, where + "the card's rep band is not the session's");
          // ⚠️ AND THE LOAD CLAUSE TOO, which is the half a 12-17 runner is protected by: the card
          // must name the percentage the session prescribes, or — where it prescribes none — say what
          // to lift instead rather than reprinting the block table's.
          if (lift.loadPercent1RM) assert.equal(m![3], lift.loadPercent1RM, where + "the card's load is not the session's");
          else assert.ok(m![3] && !/%/.test(m![3]), where + "a session with no percentage advertised one: " + m![3]);
        }
      }
    }
  }
});

test("BLOCKER: 18 is an adult and gets the adult prescription back", () => {
  assert.equal(youthLimitsFor(YOUTH_MAX_AGE + 1), null);
  const s = strengthSession("build", false, { competitive: false, age: 18 });
  assert.ok((s.exercises ?? []).some((e) => (e as { loadPercent1RM?: string }).loadPercent1RM === "80%+"));
  assert.ok(!s.description.includes(YOUTH_STRENGTH_NOTE));
});

test("BLOCKER: an adult's PLAN is byte-identical whether or not an age is stored", () => {
  /**
   * ⚠️ MEASURED AGAINST HEAD AS WELL AS AGAINST ITSELF: 0 of 72 generated plans changed. The only
   * adult-visible difference Y3 makes anywhere is in a standalone PROGRAMME's description, where 40
   * of 144 sessions were overstating their own set count before this — a card reading "3 sets" over a
   * session containing two, which A7's own note had already recorded for the week card and left on
   * the session.
   */
  const h = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const experience of ["beginner", "recreational", "competitive"] as const) {
      for (const strength of [undefined, prefs()]) {
        const base = { experience, daysPerWeek: 5, includeStrength: true, strength,
          recent: { distanceMeters: 5000, timeSeconds: 1320 }, longRunDay: 6 } as unknown as Athlete;
        const goal = { distance, targetTimeSeconds: distance === "5k" ? 1250 : distance === "10k" ? 2600 : distance === "half" ? 5700 : 12000,
          raceDateIso: "2027-03-14", startDateIso: "2026-10-05" } as unknown as Goal;
        const none = h(generatePlan(base, goal).weeks);
        for (const age of [18, 30, 55]) {
          assert.equal(h(generatePlan({ ...base, age } as Athlete, goal).weeks), none,
            distance + " " + experience + ": storing an age of " + age + " changed an adult's plan");
        }
      }
    }
  }
});

// -------------------------------------------------------------------------------------------------
// The seven guards below exist because a re-break run escaped them. Each one is named with what it
// escaped, because the reason differs every time and the reasons are the useful half.
// -------------------------------------------------------------------------------------------------

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/** Strip comments, so a guard cannot be satisfied by prose quoting the thing it forbids. */
const nocomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/\/\/[^\n]*/g, "");
function fnOf(name: string): string {
  const at = APP.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return nocomment(APP.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}

test("BLOCKER: intentFor itself answers for a youth, not only the builder that wraps it", () => {
  /**
   * ⚠️ ESCAPED A RE-BREAK: deleting `intentFor`'s age branch changed nothing end to end, because
   * `buildStrength` folds the result again for the injected-intent case. Belt and braces hides the
   * brace you are testing. `intentFor` is exported, so it has to be honest on its own — and this is
   * the guard that says so.
   */
  for (const phase of PHASES) {
    for (const maintenance of [false, true]) {
      const y = intentFor(phase, maintenance, youthLimitsFor(13));
      assert.equal(y.load, undefined, phase + ": intentFor handed a youth a load of " + y.load);
      assert.equal(y.reps, youthLimitsFor(13)!.strengthReps);
      assert.notEqual(y.intent, "heavy", phase + ": a youth was given the heavy block's rests");
      // The adult answer at the same phase still carries all three, or this proves nothing.
      const a = intentFor(phase, maintenance);
      assert.ok(a.load, phase + ": the adult prescription lost its own load");
    }
  }
});

test("BLOCKER: a plyometric set never exceeds SIX reps — the evidenced ceiling, not the constant", () => {
  /**
   * ⚠️⚠️ ESCAPED A RE-BREAK: the sweep above asserts `reps <= lim.maxPlyoReps`, which reads the very
   * constant being loosened — so raising it from 6 to 12 passed, and the adult dose (10 and 12) came
   * straight through to a 12-year-old. A guard that scales with the constant it guards is not one.
   * ⚠️ SIX IS THE NSCA'S OWN POWER TABLE (1-3 sets x 3-6 reps, "to maintain quality of movement");
   * its general guidelines say "under 6-8", and six is the conservative reading of the pair. Written
   * here as a literal on purpose: it is a fact about the evidence, not about our configuration.
   */
  const EVIDENCED_MAX_PLYO_REPS = 6;
  let seen = 0;
  for (const age of YOUTH_AGES) {
    for (const { path, s } of allSessions(age)) {
      for (const e of (s.exercises ?? []) as { reps: string; contacts?: number }[]) {
        if (e.contacts == null) continue;
        seen++;
        assert.ok(Number(e.reps) <= EVIDENCED_MAX_PLYO_REPS,
          "age " + age + " on the " + path + " path: " + e.reps + " reps a set, above the position stand's six");
      }
    }
  }
  assert.ok(seen > 20, "only " + seen + " plyometric prescriptions seen");
});

test("BLOCKER: a real GENERATED PLAN reaches the youth prescription — not just the builders", () => {
  /**
   * ⚠️⚠️ ESCAPED A RE-BREAK: removing `age` from the generator's own `strengthSession(...)` call
   * changed nothing, because every guard above drives the builders directly. The whole feature could
   * have been unwired from the plan with the suite green — which is this project's own
   * computed-and-discarded trap, eight times recorded.
   */
  let strengthSessions = 0;
  for (const distance of ["5k", "10k"] as const) {
    for (const strength of [undefined, prefs()]) {
      const athlete = { experience: "recreational", daysPerWeek: 3, includeStrength: true, strength, age: 13,
        recent: { distanceMeters: 5000, timeSeconds: 1500 }, longRunDay: 6 } as unknown as Athlete;
      const goal = { distance, targetTimeSeconds: distance === "5k" ? 1500 : 3200,
        raceDateIso: "2027-03-14", startDateIso: "2026-10-05" } as unknown as Goal;
      for (const w of generatePlan(athlete, goal).weeks) {
        for (const s of w.sessions) {
          if (s.type !== "strength") continue;
          strengthSessions++;
          for (const e of (s.exercises ?? []) as { sets: number; loadPercent1RM?: string }[]) {
            assert.equal(e.loadPercent1RM, undefined, "a generated plan prescribed a 13-year-old " + e.loadPercent1RM);
            assert.ok(e.sets <= 3);
          }
          assert.ok(s.description.includes(YOUTH_STRENGTH_NOTE), "a generated plan's strength session has no supervision line");
        }
      }
    }
  }
  assert.ok(strengthSessions > 30, "only " + strengthSessions + " strength sessions in the sweep");
});

test("BLOCKER: a youth programme's block focus describes the progression that IS happening", () => {
  /**
   * ⚠️ ESCAPED A RE-BREAK: nothing asserted the focus sentence, so a youth week 9 could go back to
   * "Heavy and low-rep — the work the evidence is about" over a session prescribing 8-12 with no
   * load. The blocks still progress for a youth — by load, which is the NSCA's own "increase
   * resistance gradually 5-10%" — so the sentence has to describe that instead.
   */
  const at = (week: number, age?: number) =>
    programmeSession(week, 0, { minutes: 45, level: "intermediate", goal: "running", equipment: KIT, sessionsPerWeek: 3, age }).description;
  for (const week of [1, 5, 9]) {
    assert.ok(!/heavy|low-rep/i.test(at(week, 13).split(" Week ")[0]!),
      "week " + week + ": a 13-year-old's block focus still reads " + at(week, 13).split(" Week ")[0]);
  }
  // Three distinct sentences, or the progression has been flattened into one.
  const youthFoci = new Set([1, 5, 9].map((w) => at(w, 13).split(" Week ")[0]));
  assert.equal(youthFoci.size, 3, "the youth block focus stopped varying by block");
  // And the adult's week 9 still says what it always said, so this discriminates.
  assert.match(at(9), /Heavy and low-rep/);
});

test("BLOCKER: the app withholds the estimated-1RM FIGURE on the history card", () => {
  /**
   * ⚠️ ESCAPED A RE-BREAK: `test/strength-progress.test.ts` drives the record TOAST, and the history
   * card is a second surface printing the same number. Asserted on the GATE around the push rather
   * than on the mention of `isYouth` anywhere in the function — a mention is not a gate.
   */
  const src = fnOf("viewStrengthHistory");
  // ⚠️ A LAZY MATCH, NOT `[^)]*`: the condition itself contains a call, so a character class
  // excluding ")" cannot cross `isYouth()` and the guard failed on correct code.
  const m = /if \((.*?)\) bits\.push\("~" \+ Math\.round\(e1rm\)/.exec(src);
  assert.ok(m, "the history card no longer pushes the estimated 1RM behind a single-line if — re-read it");
  assert.match(m![1]!, /!\s*isYouth\(\)/, "the estimated-1RM figure is no longer withheld under 18");
  // The trend arrow is deliberately NOT withheld: a direction invites nothing.
  assert.ok(/trendGlyph/.test(src) && !/isYouth\(\)[^\n]*trend/.test(src), "the trend arrow was withheld too");
});

test("BLOCKER: a programme's prefs carry the age, and cap the sessions a week", () => {
  /**
   * ⚠️⚠️ ESCAPED TWO RE-BREAKS, and they are the two halves of the only path a 12-17 runner can do
   * the MOST lifting through. `progPrefs` is what hands a standalone programme its age (so the
   * session, the week card and the overview all get it from one place) and what caps its sessions a
   * week (the engine's own cap cannot: `strengthSessionsFor` returns 0 for a programme by design).
   * Driven with the real `isYouth` and the real `RC.youthLimitsFor` rather than asserted on source.
   */
  const body = [fnOf("isYouth"), fnOf("progPrefs")].join("\n");
  const make = (age: number | undefined, asked: number) => {
    // eslint-disable-next-line no-new-func
    const f = new Function("ctx", "const RC = ctx.RC, profile = ctx.profile;" + body + "\nreturn progPrefs;")(
      { RC: { isYouthAge, youthLimitsFor }, profile: { age } },
    ) as (p: unknown) => { sessionsPerWeek: number; age?: number };
    return f({ sessionsPerWeek: asked, minutes: 45, level: "intermediate", goal: "running", equipment: [] });
  };
  for (const age of YOUTH_AGES) {
    assert.equal(make(age, 4).age, age, "age " + age + ": the programme's prefs stopped carrying it");
    assert.equal(make(age, 4).sessionsPerWeek, youthLimitsFor(age)!.maxStrengthSessions,
      "age " + age + ": four sessions a week reached a child's programme");
    assert.equal(make(age, 2).sessionsPerWeek, 2, "age " + age + ": the cap lowered an answer that was already inside it");
  }
  assert.equal(make(30, 4).sessionsPerWeek, 4, "an adult's programme lost a session");
  assert.equal(make(undefined, 4).sessionsPerWeek, 4, "no stored age was treated as a child");
});

test("BLOCKER: every app call into the programme engine goes through progPrefs", () => {
  /**
   * ⚠️⚠️ FOUND BY READING, NOT BY A RE-BREAK. The create sheet's "shape of it" preview hand-built its
   * own prefs object, so it carried no age — a 13-year-old was shown the adult block table over a
   * programme that would be built at 8-12 with no load at all. `progPrefs` is the one place the age
   * and the sessions cap are applied, so every call has to come through it; the alternative is a
   * third, fourth and fifth site each having to remember, which is how this one was missed.
   */
  const calls = [...APP.matchAll(/RC\.(programmeWeeksFor|programmeWeekFor|programmeSession|buildProgrammeSession)\(([^;]*?)\);/g)];
  assert.ok(calls.length >= 3, "only " + calls.length + " programme calls found — the sweep is not reaching them");
  for (const c of calls) {
    assert.match(c[2]!, /progPrefs\(/,
      "RC." + c[1] + " is called without progPrefs, so it carries no age: " + c[0]!.slice(0, 120));
  }
});
