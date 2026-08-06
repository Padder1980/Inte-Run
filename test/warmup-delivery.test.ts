import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { listWorkouts } from "../src/plan/session-templates.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { buildWarmup } from "../src/science/warmup.ts";

/**
 * ⚠️ THIS TEST READS THE BUILT web/app.html, because the code under test lives there.
 * `withGeneratedWarmup` is what turns a briefing card into the session Start actually runs, and it
 * is web-layer code — so a src-only test cannot see it, which is exactly why 93 defects across 432
 * sessions survived a green suite. Same precedent as home-screen-chrome and ios-input-zoom, which
 * also assert against the generated file. Run `node web/app.ts` first.
 */
function lift(name: string, deps: string[] = []) {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const grab = (fn: string) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  };
  return deps.concat([name]).map(grab).join("\n");
}

let ABILITY = "intermediate";
const withGeneratedWarmup = new Function("warmupCardFor",
  lift("withGeneratedWarmup") + "; return withGeneratedWarmup;")(
    (s: any) => buildWarmup(s, ABILITY as any));

const totalMin = (s: any) => (s.steps || []).reduce((a: number, x: any) => a + (x.durationSeconds || 0), 0) / 60;

const TARGET: Record<string, number> = { "5k": 23 * 60, "10k": 48 * 60, half: 105 * 60, marathon: 220 * 60 };
/** Every session the app can hand a runner: the whole builder catalogue plus real generated plans.
 * ⚠️ A `catch { continue }` here once hid that generatePlan was throwing on every call, so the sweep
 * measured the builder alone while claiming to cover plans — the sessions runners actually get on
 * Today. It throws now. */
function everySession(): Array<[string, any]> {
  const out: Array<[string, any]> = [];
  for (const t of [23 * 60 + 30, 18 * 60 + 20, 35 * 60]) {
    const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: t });
    for (const opt of listWorkouts(paces)) out.push([`builder ${opt.id} @${t}s`, opt.session]);
    for (const distance of ["5k", "10k", "half", "marathon"] as const) {
      for (const daysPerWeek of [3, 5, 7]) {
        let plan: any;
        try {
          plan = generatePlan(
            { experience: "recreational", daysPerWeek, includeStrength: true,
              recent: { distanceMeters: 5000, timeSeconds: t } } as any,
            { distance, targetTimeSeconds: TARGET[distance], raceDateIso: "2026-12-06", startDateIso: "2026-08-17" } as any,
          );
        } catch (e) { throw new Error("generatePlan failed for " + distance + "/" + daysPerWeek + ": " + e); }
        for (const wk of plan.weeks || [])
          for (const s of wk.sessions || []) out.push([`${distance}/${daysPerWeek}d ${s.title} @${t}s`, s]);
      }
    }
  }
  return out;
}

test("the warm-up stays in proportion to the session it prepares you for", () => {
  // ⚠️ REWRITTEN 2026-08-06, AND THE OWNER FOUND THE DEFECT IT NOW GUARDS. It used to assert that an
  // EMBEDDED warm-up changes nothing about the session's length — a design retired on 2026-08-04, so it
  // had been failing on `expected embedded warm-ups, found 0` ever since. While it was red, this went
  // unguarded and shipped: a `10 × 1′` session whose template asked for a 15-minute warm-up was
  // delivered with THIRTY-THREE minutes of it, in front of nineteen minutes of work.
  //
  // Two causes, both now fixed in `warmup.ts`: the proportion cap was gated on continuous sessions so no
  // interval session was ever capped, and it ran AFTER the phases were built so it only ever adjusted the
  // number on the card. A guard that cannot reach what it guards is not a guard — which is the same
  // lesson twice over, since this test could not reach it either.
  let checked = 0, worst = 0, worstWhere = "";
  for (const ability of ["new", "beginner", "intermediate", "advanced"]) {
    ABILITY = ability;
    for (const [where, sess] of everySession()) {
      const w: any = buildWarmup(sess, ability as any);
      if (!w || w.incomplete) continue;               // not a run, or a formal test: declined by design
      const live = withGeneratedWarmup(sess);
      const advertised = totalMin(sess), delivered = totalMin(live);
      // ⚠️ A NaN duration makes every comparison below false, so the sweep would pass while measuring
      // nothing. This bit once: paces built from the wrong input shape made distance-derived
      // repetitions non-finite and the whole sweep reported clean.
      assert.ok(Number.isFinite(advertised) && Number.isFinite(delivered),
        `non-finite duration for ${where}`);
      checked++;
      const steps: any[] = live.steps || [];
      const wu = steps.filter((s) => s.kind === "warmup")
        .reduce((a, s) => a + (s.durationSeconds || 0), 0) / 60;
      // Work = everything that is not preparation. Distance-based reps carry no duration, so they must
      // be converted or an interval session measures as zero work and the ratio is meaningless — the
      // exact field trap that let the shipped cap read every distance session as empty.
      const work = steps.filter((s) => s.kind !== "warmup" && s.kind !== "cooldown")
        .reduce((a, s) => {
          if (s.durationSeconds) return a + s.durationSeconds / 60;
          if (s.distanceMeters && s.targetPaceSecPerKm) {
            const mid = (s.targetPaceSecPerKm.minSecPerKm + s.targetPaceSecPerKm.maxSecPerKm) / 2;
            return a + ((s.distanceMeters / 1000) * mid) / 60;
          }
          if (s.distanceMeters) return a + s.distanceMeters / 4 / 60;
          return a;
        }, 0);
      if (work < 10) continue;   // a very short session is dominated by its floor, not its proportion
      const ratio = wu / work;
      if (ratio > worst) { worst = ratio; worstWhere = `${where} (${wu.toFixed(0)}′ warm-up, ${work.toFixed(0)}′ work)`; }
      assert.ok(ratio <= 1.35,
        `${where}: ${wu.toFixed(0)} minutes of warm-up before ${work.toFixed(0)} minutes of work`);
    }
  }
  assert.ok(checked > 5000, `expected a broad sweep, only checked ${checked}`);
  assert.ok(worst > 0.2, `the sweep measured no real warm-ups at all (worst ratio ${worst})`);
});

test("strides sit next to the work they prime, and never appear without any", () => {
  // ⚠️ Strides are a potentiation cue. Prepended to an embedded warm-up they landed before eighteen
  // minutes of conversational running — priming the runner for something twenty-one minutes away,
  // which is not a warm-up component, just a hard bit in a warm-up.
  let seen = 0;
  for (const ability of ["beginner", "intermediate", "advanced"]) {
    ABILITY = ability;
    for (const [where, sess] of everySession()) {
      const w: any = buildWarmup(sess, ability as any);
      if (!w || w.incomplete) continue;
      const steps: any[] = withGeneratedWarmup(sess).steps || [];
      // ⚠️ FIND THE BLOCK BY `display`, NOT BY THE WORD "strides" IN A LABEL. When the strides became
      // one step per repetition, the labels changed to "Stride 1 of 5" and "Walk back" — so this
      // finder returned -1 for every session, `continue` fired 8,631 times, and the whole test
      // asserted NOTHING while staying green. Measured: 0 sessions reached the assertions, of 2,691
      // that genuinely carry a strides block. The same guard-blind-to-the-new-input trap this file
      // has now recorded six times; a test that silently stops testing is worse than no test,
      // because the suite still reports it as covered.
      const si = steps.findIndex((s) => s.display === "Stride");
      if (si < 0) continue;
      seen++;
      // ⚠️ Skip warm-up steps: the strides step is itself RPE 5-7, so an unfiltered search for the
      // first hard step finds the strides and compares them to themselves.
      const hi = steps.findIndex((s) => s.kind !== "warmup" && (s.kind === "rep" || (s.targetRpe && s.targetRpe.max >= 4)));
      assert.ok(hi >= 0, `${where}: strides with nothing hard to prime for`);
      assert.ok(hi > si, `${where}: strides come after the work`);
      // ⚠️ The gap counts the RUN's own steps, not the warm-up's. A structured warm-up deliberately
      // ends with a settle between the strides and the first effort ("start when your breathing is
      // back") -- counting that as separation condemned the paper's own prescribed transition.
      let gap = 0;
      for (let i = si + 1; i < hi; i++) if (steps[i].kind !== "warmup") gap += (steps[i].durationSeconds || 0) / 60;
      assert.ok(gap <= 3, `${where}: ${gap.toFixed(0)} min of the run's own easy running between the strides and the work`);
    }
  }
  // ⚠️ THE COUNT IS THE POINT. Without it the finder above can go blind again — as it just did for a
  // day — and this test reports success having skipped every single session. A sweep must fail when
  // it stops sweeping.
  assert.ok(seen > 500, `only ${seen} sessions carried a strides block — the finder has gone blind again`);
});

test("the card never says the work starts early when it does not", () => {
  for (const ability of ["beginner", "intermediate", "advanced"]) {
    ABILITY = ability;
    for (const [where, sess] of everySession()) {
      const w: any = buildWarmup(sess, ability as any);
      if (!w || w.incomplete) continue;
      const copy = [w.why, ...w.notes, ...w.phases.map((p: any) => p.instruction)].join(" ");
      if (!/starts early|opening is short/.test(copy)) continue;
      let before = 0;
      for (const s of withGeneratedWarmup(sess).steps || []) {
        if (s.kind !== "warmup" && (s.kind === "rep" || (s.targetRpe && s.targetRpe.max >= 4))) break;
        before += (s.durationSeconds || 0) / 60;
      }
      assert.ok(before <= 20,
        `${where}: card claims an early start but the first hard effort is ${before.toFixed(0)} min in`);
    }
  }
});

test("every run warms up, and the stretch session is offered after all of them", () => {
  // ⚠️ THIS REPLACED "…through to a cool-down" (owner's decision, 2026-08-03). The prescribed cool-down
  // jog is gone from the LOW-INTENSITY runs, so asserting every working run reaches a `cooldown` step
  // now asserts the opposite of the design. What must hold instead is that nobody is left with neither
  // a jog nor a stretch: the hard sessions keep their jog, and the stretch session is offered after
  // every run there is — from `runOverviewHtml`, so the finish screen and the Logbook both carry it.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  assert.match(html, /function stretchOfferHtml\(/, "the stretch offer is not in the build");
  const overview = lift("runOverviewHtml");
  assert.match(overview, /stretchOfferHtml\(\)/,
    "the offer is not called from runOverviewHtml — the finish screen and the Logbook would disagree");
  assert.match(html, /strOffer[\s\S]{0,400}?onclick = openStretchSheet/,
    "the offer is rendered but never wired, so tapping it would do nothing");

  for (const ability of ["new", "intermediate"]) {
    ABILITY = ability;
    for (const [where, sess] of everySession()) {
      const w: any = buildWarmup(sess, ability as any);
      if (!w || w.incomplete) continue;
      const steps: any[] = withGeneratedWarmup(sess).steps || [];
      assert.ok(steps.some((s) => s.kind === "warmup"), `${where}: no warm-up step`);
      // ⚠️ THE RULE IS ABOUT HOW A SESSION FINISHES, NOT HOW HARD IT IS. A run that ends easy needs no
      // wind-down — that is the whole point of removing the ease-down. A run that ends ON WORK does:
      // stopping dead after intervals, or after the goal-pace finish of a progressive long run, is a
      // different proposition from easing off an easy run, which is why the threshold/VO2 pools and the
      // structured long runs still carry cooldown().
      // ⚠️ Stated from the runner's side — "what is the last thing this session asks of me?" — rather
      // than by session type. Written as a type check it would have missed the defect it actually
      // caught: with the ease-down gone, "easy + strides" ended on a 20-second stride at repetition
      // pace with nothing after it at all.
      // ⚠️ RACE DAY IS EXEMPT, AND KNOWINGLY SO. applyRaceDay builds a warm-up plus the race and puts
      // rest after it. Whether a goal race should prescribe a cool-down is a coaching decision for the
      // owner, not something to slip in under a test.
      // ⚠️ THE LINE IS AT RPE 5. Ending at the aerobic/moderate gear (4) is still conversational and
      // needs nothing after it; from steady upwards it is work. Drawn at 4, this demanded a cool-down
      // jog after "easy → moderate finish" — reinstating exactly the padding the change removes.
      const CONVERSATIONAL_MAX = 4;
      const body = steps.filter((s) => s.kind !== "cooldown");
      const finalAsk = body[body.length - 1];
      const finishesOnWork = (finalAsk?.targetRpe?.max ?? 0) > CONVERSATIONAL_MAX;
      const isRace = /RACE DAY/i.test(where) || (sess.type === "race");
      if (finishesOnWork && !isRace) {
        assert.ok(steps.some((s) => s.kind === "cooldown"),
          `${where}: finishes on "${finalAsk?.label}" (RPE ${finalAsk?.targetRpe?.max}) with nothing after it`);
      }
    }
  }
});

test("every section of the brief is labelled with the time spent in it", () => {
  // The owner's request, 2026-08-03: a brief that lists paces but no durations makes the runner do
  // arithmetic mid-run. `spanText` reports a rep block WHOLE, recoveries included.
  const spanText = new Function(lift("spanText") + "; return spanText;")();
  ABILITY = "intermediate";
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 23 * 60 + 30 });
  for (const opt of listWorkouts(paces)) {
    const live = withGeneratedWarmup(opt.session);
    for (const st of live.steps || []) {
      if (!(st.durationSeconds || st.distanceMeters)) continue;
      const sp = spanText([st]);
      assert.ok(sp && /\d/.test(sp), `${opt.id}: step "${st.label}" carries no time or distance`);
    }
    // A whole rep block's span must be at least as long as one repetition in it.
    const reps = (live.steps || []).filter((s: any) => s.kind === "rep");
    if (reps.length > 1) {
      const whole = spanText(reps);
      assert.ok(whole && /\d/.test(whole), `${opt.id}: rep block has no span`);
    }
  }
});
