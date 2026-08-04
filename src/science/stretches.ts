/**
 * The optional post-run stretch session.
 *
 * Replaces the prescribed cool-down jog on the low-intensity runs (owner's decision, 2026-08-03): a jog
 * at easy pace at the end of an easy run was the same effort under a different name, and a stretch at
 * the end is the more useful thing to offer. It is OFFERED, never prescribed — it is not part of any
 * session's steps, it costs no training volume, and skipping it is a complete answer.
 *
 * ⚠️ WHAT THIS IS ALLOWED TO CLAIM, AND IT IS NARROW. Static stretching after running is NOT injury
 * prevention and it does not make anyone faster — a 2025 review found no acute effect of stretching on
 * running economy, and the injury-prevention literature does not support the claim either. What it
 * honestly is: range of motion, a few minutes of coming down from the run, and it feels good. The copy
 * here stays inside that, and `test/stretches.test.ts` fails on any sentence that reaches past it.
 * `test/warmup.test.ts` already enforces the same rule on the warm-up copy; this is the same rule.
 *
 * ⚠️ HOLD TIMES ARE PER SIDE where a movement has sides, and `seconds` is the time for ONE hold. The
 * session total counts both sides (see `stretchTotalSeconds`), or a five-movement routine would claim
 * to take half as long as it does.
 */

export type Stretch = {
  /** Stable id — used for the animation slug and as the key in any saved state. */
  id: string;
  name: string;
  /** Seconds for ONE hold. Doubled by the total when `bothSides`. */
  seconds: number;
  bothSides: boolean;
  /** The area it addresses, in the runner's language, not a muscle-chart name. */
  area: string;
  /** How to do it — one sentence, imperative, no claim about what it achieves. */
  cue: string;
  /** Schematic figure to draw when no animation exists yet. See `POSES` in web/app.ts. */
  pattern: string;
};

/**
 * The routine, in the order it should be done: biggest muscles first while they are warmest, hips
 * before the deep glute work that needs them loose, and the floor positions last so the runner is not
 * getting up and down repeatedly.
 */
export const STRETCHES: readonly Stretch[] = [
  {
    id: "standing-quad",
    name: "Standing quad stretch",
    seconds: 30,
    bothSides: true,
    area: "front of the thigh",
    cue: "Hold a wall, take your ankle behind you and keep your knees together and your hips square.",
    pattern: "quad",
  },
  {
    id: "standing-hamstring",
    name: "Standing hamstring stretch",
    seconds: 30,
    bothSides: true,
    area: "back of the thigh",
    cue: "Heel on a low step, leg straight, hinge forward from the hips with a flat back.",
    pattern: "hamstring",
  },
  {
    id: "calf-wall",
    name: "Calf stretch against a wall",
    seconds: 30,
    bothSides: true,
    area: "calf and achilles",
    cue: "Back leg straight, heel pressed down, hips forward. Then bend that knee slightly to reach lower down.",
    pattern: "calfwall",
  },
  {
    id: "hip-flexor",
    name: "Kneeling hip flexor stretch",
    seconds: 30,
    bothSides: true,
    area: "front of the hip",
    cue: "Half-kneeling, tuck your tailbone under and ease your hips forward. Stay tall rather than leaning.",
    pattern: "hipflexor",
  },
  {
    id: "figure-four",
    name: "Figure-four glute stretch",
    seconds: 30,
    bothSides: true,
    area: "glute and outside of the hip",
    cue: "On your back, ankle across the opposite thigh, and draw that thigh towards your chest.",
    pattern: "glute",
  },
  {
    id: "childs-pose",
    name: "Child's pose",
    seconds: 45,
    bothSides: false,
    area: "lower back and shoulders",
    cue: "Sit back onto your heels, arms long in front, and let your breathing slow down.",
    pattern: "childs",
  },
];

/** Total time for the whole routine in seconds, counting both sides where a stretch has them. */
export function stretchTotalSeconds(list: readonly Stretch[] = STRETCHES): number {
  return list.reduce((t, s) => t + s.seconds * (s.bothSides ? 2 : 1), 0);
}

/**
 * The holds in the order they are performed, one entry per hold — so the left and the right are two
 * separate entries. This is what a guided player counts through, and what the on-screen total is
 * derived from, so the list and the clock can never disagree.
 */
export function stretchHolds(
  list: readonly Stretch[] = STRETCHES,
): { stretch: Stretch; side: "left" | "right" | null; seconds: number }[] {
  const out: { stretch: Stretch; side: "left" | "right" | null; seconds: number }[] = [];
  for (const s of list) {
    if (s.bothSides) {
      out.push({ stretch: s, side: "left", seconds: s.seconds });
      out.push({ stretch: s, side: "right", seconds: s.seconds });
    } else {
      out.push({ stretch: s, side: null, seconds: s.seconds });
    }
  }
  return out;
}

/**
 * The one line of framing shown above the list. Deliberately not a promise: it says what the runner
 * gets and that it is theirs to skip.
 */
export const STRETCH_INTRO =
  "Optional, and it is fine to skip. A few minutes of easing out while you are still warm — "
  + "it is about range of movement and coming down from the run, nothing more than that.";
