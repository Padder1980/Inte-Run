// TWO HARD DAYS A WEEK — WHAT HUDSON ACTUALLY ASKS FOR, AND WHY THE FREQUENCY CAPS STAY (2026-09-01)
//
// The owner asked whether *Run Faster from the 5K to the Marathon* recommends two hard workouts a week
// for everyone, and to implement it if so. It does say it, flatly and with no level qualification:
//
//     "I believe in doing two hard workouts per week, not including the weekend long run."   (ch2)
//
// ⚠️⚠️ BUT THREE THINGS BOUND IT, AND ALL THREE ARE ALREADY IMPLEMENTED HERE — which is why nothing
// changed in the engine when the question was asked. Any future reader tempted to "finally do it"
// should re-read this file before touching `qualitySessionsThisWeek`.
//
//   1. IT IS PREMISED ON SIX OR SEVEN DAYS OF RUNNING. "I recommend that every runner, INCLUDING
//      BEGINNERS, run at least six times per week, if possible" (ch7), and "I strongly recommend that
//      competitive runners seeking to improve their race times run six or seven times a week" (ch2).
//      The book does not contemplate a three- or four-day runner at all; its answer for one is to run
//      more days, which this app already offers through `addDayOffer`.
//   2. IT IS A DESTINATION, NOT A CONSTANT. His own Level 1 plan (12 weeks, "low training volume plans
//      for beginners") carries ZERO hard workouts in weeks 1-3, ONE in weeks 4-7, and reaches two only
//      in the last third. His Level 2 carries zero for two weeks and one for three more. Measured off
//      those tables, Level 1 delivers ~1.20 hard workouts a week and Level 2 ~1.40.
//   3. AT LOW VOLUME ONE OF THE TWO IS A PROGRESSION RUN, NOT A SECOND INTERVAL SESSION. Level 1 weeks
//      8-12 read "Progression Run 6 miles, last 20 min hard" PLUS one interval session. Chapter 3 says
//      why: progression runs "represent an excellent means of squeezing a little more beneficial hard
//      work into one's training without overtaxing the runner". That is exactly what `longCarriesWork`
//      already does at four running days or fewer.
//
// MEASURED FIDELITY, counting a work-carrying long run the way his Level 1 table counts its progression
// run, at his own block lengths (5K 12wk, 10K 14wk, half 16wk, marathon 20wk), 72 plans per row:
//
//     days/week |  0 hard |  1 hard | 2+ hard | mean hard/week
//         3     |    0.0% |   69.0% |   31.0% |     1.31
//         4     |    0.0% |   63.8% |   36.2% |     1.36
//         6     |    0.0% |   54.1% |   45.9% |     1.75
//
// So the app already meets or exceeds the book's own delivered frequency at every level — 1.31 for a
// three-day runner against his Level 1's 1.20, and 1.75 for a six-day runner against his Level 2's 1.40.
//
// ⚠️⚠️ AND LIFTING THE REMAINING CAPS IS MEASURABLY HARMFUL. All three were lifted and swept over 7,416
// weeks per frequency (3 abilities x 4 distances x 2 experience x 4 stated volumes x 3 runways):
//
//                                        | shipped |  caps lifted
//     3-day weeks under the 68% easy floor |     17  |    699   (41x)
//     3-day worst week, easy fraction      |  63.8%  |   55.4%
//     4-day weeks under the 68% easy floor |      0  |     84
//     5/6/7-day rows                       |  ————— identical —————
//
// ⚠️ THE LAST ROW IS THE POINT: the caps are byte-identical for five, six and seven days, so they only
// ever bind at the frequencies the book does not address. Removing them buys nothing for anybody Hudson
// is writing to and costs a three-day runner a week that is 55% easy.
//
// ⚠️ THE ONE LEVER THAT DOES RAISE DELIVERED FREQUENCY IS BLOCK LENGTH, NOT THIS RULE. The same six-day
// runner gets 1.30 hard sessions a week on our long runways and 1.75 at Hudson's block lengths, with the
// per-phase rule untouched and the build phase identical either way (69% vs 68% of build weeks at two).
// That is the parked `pc-blocklen` recalibration, and it is where this ask actually points.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePlan } from "../src/plan/generate-plan.ts";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";

const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
// Hudson's own block lengths, chapter 12.
const HUDSON_WEEKS: Record<string, number> = { "5k": 12, "10k": 14, half: 16, marathon: 20 };
const START = "2026-09-07"; // a Monday

const raceIso = (weeks: number): string => {
  const d = new Date(START + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

type Opts = { days: number; dist: string; secs?: number; exp?: string; vol?: number | null; weeks?: number };

function plan(o: Opts) {
  const athlete = {
    experience: o.exp ?? "recreational",
    daysPerWeek: o.days,
    recent: { distanceMeters: 5000, timeSeconds: o.secs ?? 1500 },
    returningFromInjury: false,
    returningFromBreak: false,
    ...(o.vol == null ? {} : { weeklyVolumeKmCurrent: o.vol }),
  } as unknown as Athlete;
  const goal = {
    distance: o.dist,
    raceDateIso: raceIso(o.weeks ?? HUDSON_WEEKS[o.dist]!),
    targetTimeSeconds: TT[o.dist]!,
  } as unknown as Goal;
  return generatePlan(athlete, goal, { startDateIso: START });
}

// Both fragments by construction: the partial first week and race week.
const body = (p: { weeks: PlannedWeek[] }): PlannedWeek[] =>
  p.weeks.filter((w) => w.index !== 1 && w.index !== p.weeks.length);

// ⚠️ HUDSON'S OWN DEFINITION: "workouts involving a moderate to large dose of high-intensity running
// (half-marathon race pace or faster)", NOT counting the long run. In this engine that is exactly the
// quality slots. A hill-sprint or strides day is deliberately NOT one — he files those under
// neuromuscular work added to an easy run, and they take "very little time".
const HARD = new Set(["threshold", "vo2", "race-specific"]);

// ⚠️ ...EXCEPT that his Level 1 plan's second hard day IS the long run, once its finish goes hard. The
// gate is the same content test `buildWeek` uses: a work step of 10+ minutes at RPE 4+.
const carriesWork = (s: Session): boolean =>
  (s.steps ?? []).some((st) => (st.targetRpe?.min ?? 0) >= 4 && (st.durationSeconds ?? 0) >= 10 * 60);

const hardDays = (w: PlannedWeek): number =>
  w.sessions.filter((s) => HARD.has(s.type)).length +
  w.sessions.filter((s) => s.type === "long" && carriesWork(s)).length;

const DISTANCES = ["5k", "10k", "half", "marathon"];

test("BLOCKER: the per-phase rule IS Hudson's shape — base 1, build 2, peak 2, taper 1, deload 1", () => {
  let build = 0;
  let peak = 0;
  for (const dist of DISTANCES) {
    for (const secs of [1100, 1500, 1920]) {
      const p = plan({ days: 6, dist, secs, vol: 70 });
      for (const w of body(p)) {
        if (w.isDeload) {
          // A deload keeps ONE hard session. Hudson's Level 1 week 10 is exactly this: the long run
          // goes back to easy and a single interval session stays.
          assert.ok(
            w.qualitySessionCount <= 1,
            `${dist}/${secs}: deload week ${w.index} carries ${w.qualitySessionCount} quality sessions`,
          );
          continue;
        }
        if (w.phase === "build") {
          build++;
          assert.equal(
            w.qualitySessionCount,
            2,
            `${dist}/${secs}: build week ${w.index} carries ${w.qualitySessionCount}, not the book's two`,
          );
        }
        if (w.phase === "peak") {
          peak++;
          assert.equal(
            w.qualitySessionCount,
            2,
            `${dist}/${secs}: peak week ${w.index} carries ${w.qualitySessionCount}, not the book's two`,
          );
        }
        if (w.phase === "taper") {
          assert.equal(w.qualitySessionCount, 1, `${dist}/${secs}: taper week ${w.index} is not one`);
        }
        if (w.phase === "base") {
          assert.ok(w.qualitySessionCount <= 1, `${dist}/${secs}: base week ${w.index} exceeds one`);
        }
      }
    }
  }
  // Vacuity: the sweep has to have reached both phases it makes its strongest claim about.
  assert.ok(build >= 20, `only ${build} non-deload build weeks measured`);
  assert.ok(peak >= 8, `only ${peak} non-deload peak weeks measured`);
});

test("BLOCKER: the frequency caps bind ONLY where the book does not tread — 5, 6 and 7 days are untouched", () => {
  // ⚠️ THIS IS THE DISCRIMINATING CLAIM OF THE WHOLE FILE. Measured, lifting all three caps leaves the
  // five-, six- and seven-day rows byte-identical, which is what makes them safe: they cannot be
  // withholding anything from a runner Hudson is actually writing to. Stated as behaviour: at five or
  // more running days, no cap ever reduces a normal-volume non-deload build or peak week below two.
  for (const days of [5, 6, 7]) {
    for (const dist of DISTANCES) {
      const p = plan({ days, dist, vol: 70 });
      const weeks = body(p).filter((w) => !w.isDeload && (w.phase === "build" || w.phase === "peak"));
      assert.ok(weeks.length > 0, `${days}d/${dist}: no build or peak weeks to measure`);
      for (const w of weeks) {
        assert.equal(
          w.qualitySessionCount,
          2,
          `${days}d/${dist}: ${w.phase} week ${w.index} was capped to ${w.qualitySessionCount} — a cap is ` +
            `binding at a frequency the book prescribes, which is the one thing these caps must never do`,
        );
      }
    }
  }
});

test("BLOCKER: three running days never carries two quality sessions", () => {
  // ⚠️ MEASURED COST OF LIFTING THIS: weeks under the 68% pyramidal easy floor go 17 -> 699 across
  // 7,416 weeks, and the worst week's easy fraction goes 63.8% -> 55.4%. Three runs a week leaves the
  // long run and one easy run to carry the entire aerobic base, so a second quality session raises the
  // hard fraction by pure arithmetic. Hudson's answer for a three-day runner is not a second hard day,
  // it is a fourth run: his own lowest plan STARTS at four runs and builds to six.
  let measured = 0;
  for (const dist of DISTANCES) {
    for (const secs of [1100, 1500, 1920]) {
      for (const vol of [null, 25, 45, 70]) {
        for (const weeks of [16, 28, 40]) {
          const p = plan({ days: 3, dist, secs, vol, weeks });
          for (const w of body(p)) {
            measured++;
            assert.ok(
              w.qualitySessionCount <= 1,
              `3 days: ${dist}/${secs}/vol=${vol}/${weeks}wk week ${w.index} (${w.phase}) carries ` +
                `${w.qualitySessionCount} quality sessions`,
            );
          }
        }
      }
    }
  }
  assert.ok(measured > 1000, `only ${measured} three-day weeks measured`);
});

test("BLOCKER: four running days gets its second quality session only in the peak block", () => {
  // The same arithmetic one day up: four runs leaves ONE easy run plus the long run to carry the base.
  // The peak block is the deliberate exception — a short sharp overload with the taper behind it.
  let peakTwo = 0;
  let outside = 0;
  for (const dist of DISTANCES) {
    for (const secs of [1100, 1500, 1920]) {
      const p = plan({ days: 4, dist, secs, vol: 70 });
      for (const w of body(p)) {
        if (w.phase === "peak") {
          if (w.qualitySessionCount >= 2) peakTwo++;
        } else {
          outside++;
          assert.ok(
            w.qualitySessionCount <= 1,
            `4 days: ${dist}/${secs} ${w.phase} week ${w.index} carries ${w.qualitySessionCount}`,
          );
        }
      }
    }
  }
  assert.ok(outside > 100, `only ${outside} non-peak four-day weeks measured`);
  // And the exception is real rather than nominal — some peak week actually reaches two.
  assert.ok(peakTwo > 0, "no four-day peak week ever reaches two quality sessions");
});

test("BLOCKER: at four days or fewer a work-carrying long run IS the second key day", () => {
  // ⚠️ HUDSON'S LEVEL 1 MECHANISM, AND THE REASON THE CAP ABOVE IS NOT A REFUSAL TO PROGRESS. His weeks
  // 8-12 pair "Progression Run, last 20 min hard" with ONE interval session. Here the long run is built
  // FIRST so the quality count can see what it carries; when it carries a real dose, quality drops to
  // one and the week still has two hard days. Without this the old accounting stacked THREE race-pace
  // days into a four-day peak week, measured at 67.0% easy — under the floor.
  let seen = 0;
  for (const days of [3, 4]) {
    for (const dist of ["half", "marathon"]) {
      for (const secs of [1100, 1500, 1920]) {
        const p = plan({ days, dist, secs, vol: 70 });
        for (const w of body(p)) {
          const long = w.sessions.find((s) => s.type === "long");
          if (!long || !carriesWork(long)) continue;
          seen++;
          assert.equal(
            w.qualitySessionCount,
            1,
            `${days}d/${dist}/${secs} week ${w.index}: the long run carries work AND the week carries ` +
              `${w.qualitySessionCount} quality sessions — that is three hard days in a small week`,
          );
          assert.equal(
            hardDays(w),
            2,
            `${days}d/${dist}/${secs} week ${w.index}: a structured long run should make this two hard days`,
          );
        }
      }
    }
  }
  // ⚠️ Vacuity matters here: half and marathon build/peak long runs are the formats that carry doses,
  // so if this counts zero the guard is measuring nothing.
  assert.ok(seen >= 10, `only ${seen} work-carrying long runs found at 3-4 days — the guard is vacuous`);
});

test("delivered hard-day frequency clears Hudson's own Level 1 plan", () => {
  // ⚠️ THE BAR IS READ OFF HIS TABLE, NOT PICKED. Level 1 (5K, 12 weeks), counting its progression run
  // once its finish goes hard and dropping week 1 and race week to match `body()`:
  //   weeks 2-11 = 0, 0, 1, 1, 1, 1, 2, 3, 1, 2  ->  12 hard workouts / 10 weeks = 1.20 per week.
  const LEVEL1_MEAN = 1.2;
  for (const days of [3, 4, 6]) {
    let hard = 0;
    let weeks = 0;
    for (const dist of DISTANCES) {
      for (const secs of [1100, 1500, 1920]) {
        for (const vol of [null, 45, 70]) {
          const p = plan({ days, dist, secs, vol });
          for (const w of body(p)) {
            weeks++;
            hard += hardDays(w);
          }
        }
      }
    }
    const mean = hard / weeks;
    assert.ok(weeks > 300, `only ${weeks} weeks measured at ${days} days`);
    assert.ok(
      mean >= LEVEL1_MEAN,
      `${days} days/week delivers ${mean.toFixed(2)} hard sessions a week, under Hudson's own Level 1 ` +
        `plan at ${LEVEL1_MEAN}`,
    );
  }
});

test("a hill-sprint or strides day is not counted as one of the two hard days", () => {
  // ⚠️ HIS TAXONOMY, NOT OURS. Hill sprints are "approximately eight seconds apiece" and take "very
  // little time"; he adds them to easy runs throughout the cycle and counts them nowhere near the two
  // hard workouts. So the weekly hill-sprint staple must not be inflating the count above — if it
  // were, this file's fidelity claim would be measuring the staple rather than the hard days.
  const p = plan({ days: 6, dist: "half", vol: 70 });
  const stapleWeeks = body(p).filter((w) =>
    w.sessions.some(
      (s) =>
        (s.type === "strides" || s.type === "easy") &&
        (s.steps ?? []).some((st) => st.kind === "rep" && st.targetPaceSecPerKm == null),
    ),
  );
  assert.ok(stapleWeeks.length > 0, "no hill-sprint staple weeks found — the fixture cannot test this");
  for (const w of stapleWeeks) {
    const counted = w.sessions.filter((s) => HARD.has(s.type)).length;
    assert.equal(
      counted,
      w.qualitySessionCount,
      `week ${w.index}: the hill-sprint day is being counted as a hard workout`,
    );
  }
});

// ⚠️⚠️ THE TAPER'S ONE-SESSION RULE IS ENFORCED TWICE, AND AN END-TO-END TEST CAN ONLY SEE THE PAIR.
// `qualityByPhase` returns 1 for the taper AND `qualityContentsFor`'s taper branch pushes exactly one
// session before `out.slice(0, count)` — so `count` there can only ever REDUCE the list, never grow it.
// Measured: making `qualityByPhase` return 2 for the taper changes nothing observable, because the
// second brace still hands back one session. Belt and braces, correctly — the same shape CLAUDE.md
// records for the share card's date gating, where deleting either gate alone leaves the filename
// dateless. So the outcome guard above catches deleting BOTH, and this one names each brace so
// deleting EITHER fails.
//
// ⚠️ Comments are stripped first. These two functions carry some of the longest explanatory comments in
// the engine and both quote the very identifiers being asserted — the comment-quotes-what-it-forbids
// trap, which CLAUDE.md has now recorded eleven times.
const ENGINE = readFileSync(new URL("../src/plan/generate-plan.ts", import.meta.url), "utf8");
const nocomment = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

const fnBody = (name: string): string => {
  const src = nocomment(ENGINE);
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, `${name} is not in the engine`);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error("unbalanced braces in " + name);
};

test("BLOCKER: both braces of the taper's one-session rule are in place", () => {
  // Brace 1 — the phase rule itself asks for one.
  const byPhase = fnBody("qualityByPhase");
  const taperCase = byPhase.slice(byPhase.indexOf('case "taper"'));
  assert.ok(taperCase.length > 0, "qualityByPhase has no taper case at all");
  assert.match(
    taperCase.slice(0, 60),
    /case "taper":\s*return 1;/,
    "qualityByPhase no longer asks for exactly one quality session in the taper",
  );

  // Brace 2 — the content builder pushes one and slices, so count cannot grow it.
  const contents = fnBody("qualityContentsFor");
  const at = contents.indexOf('wp.phase === "taper"');
  assert.ok(at >= 0, "qualityContentsFor no longer has a taper branch");
  // The branch runs to the next top-level phase test.
  const branch = contents.slice(at, contents.indexOf('wp.phase === "peak"', at));
  assert.ok(branch.length > 0, "could not bound the taper branch");
  const pushes = (branch.match(/out\.push\(/g) ?? []).length;
  assert.equal(
    pushes,
    2,
    `the taper branch has ${pushes} out.push calls, not the two it should (race week's, and the ` +
      `pre-race week's) — a third would let the taper carry two sessions`,
  );
  // ⚠️ Two pushes, ONE per return path. Both paths must slice, or a caller asking for two gets two.
  const slices = (branch.match(/return out\.slice\(0, count\);/g) ?? []).length;
  assert.equal(slices, 2, `the taper branch has ${slices} slicing returns, not two`);
});
