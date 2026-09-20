/**
 * THE EXERCISE LIBRARY — one definition, read by the plan generator AND by the Learn hub's browsable
 * page. There used to be TWO: `EX` in session-templates.ts (17 entries, used to build sessions) and
 * `STRENGTH_LIB` in web/app.ts (a separate hand-picked 20-odd, used only to teach). A cue edited in
 * one never reached the other, and neither could answer "what can I do with a kettlebell" — which is
 * what a Runna-parity equipment picker needs.
 *
 * ⚠️ EQUIPMENT AND LEVEL ARE FACTS ABOUT THE MOVEMENT, NOT ABOUT A PRESCRIPTION. They live here, on
 * the catalogue entry, and are read by whichever stage needs them (a swap, a builder, the library
 * page) rather than copied onto every session's own exercise list.
 *
 * ⚠️ AN ID IS NEVER RENAMED OR REUSED — see the note on StrengthExercise.id in domain/types.ts. New
 * entries get new slugs; nothing here is ever deleted once a runner could have logged against it.
 */

export const EQUIPMENT = [
  "bodyweight", "bands", "barbell", "box", "bench", "dumbbell", "kettlebell", "pullUpBar", "swissBall",
] as const;
export type Equipment = typeof EQUIPMENT[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: "No equipment", bands: "Resistance band", barbell: "Barbell", box: "A step or box",
  bench: "A bench", dumbbell: "Dumbbells", kettlebell: "A kettlebell", pullUpBar: "A pull-up bar",
  swissBall: "A Swiss ball",
};

export const PATTERNS = [
  "squat", "hinge", "lunge", "bridge", "calf", "plank", "core", "rotate", "push", "pull", "carry",
  "balance", "jump",
] as const;
export type MovementPattern = typeof PATTERNS[number];

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  squat: "Squat", hinge: "Hinge", lunge: "Single leg", bridge: "Glutes", calf: "Calf", plank: "Plank",
  core: "Core", rotate: "Rotation", push: "Push", pull: "Pull", carry: "Carry", balance: "Balance",
  jump: "Plyometric",
};

/**
 * ⚠️ WHY EACH PATTERN MATTERS FOR A RUNNER, not a general fitness sentence. This is what the Learn
 * hub renders above each group, so it earns the runner's trust in the whole page rather than reading
 * as a stock gym-app description.
 */
export const PATTERN_WHY: Record<MovementPattern, string> = {
  squat: "Loads the quads and glutes through a deep knee bend — the base of nearly every strength plan.",
  hinge: "Trains the hamstrings and glutes to produce force with a long lever — the pattern that drives you forward.",
  lunge: "Running is a series of single-leg hops. Training one side at a time exposes and fixes asymmetries.",
  bridge: "Weak glutes let the knee and hip drift inward on every stride. This is the direct fix.",
  calf: "The calf and Achilles handle huge loads every stride. Strong calves are among the best protections against Achilles and shin problems.",
  plank: "Not about abs: about resisting movement so the force you make with your legs isn't lost through a wobbly middle.",
  core: "Trains the deep muscles that hold your spine still while your arms and legs move — the opposite job to a plank, and just as useful.",
  rotate: "Every stride rotates the torso a little against the hips. Training that rotation, and resisting it, keeps the trunk efficient rather than wasting energy.",
  push: "Upper-body strength keeps your arm drive and posture intact when you're tired late in a race.",
  pull: "Balances the push muscles and holds the shoulders back and down — the posture that collapses first when a race gets hard.",
  carry: "A loaded walk trains grip, posture and the whole trunk at once, under real fatigue rather than a fixed rep count.",
  balance: "Running is a series of single-leg landings. Steadying one leg trains the ankle and hip stabilisers that keep you tracking straight.",
  jump: "Trains tendon stiffness and elastic return — cheap speed. Introduce these only once you're running comfortably.",
};

export type ExerciseLevel = "beginner" | "intermediate" | "advanced";

export type ExerciseDef = {
  name: string;
  primary: string;
  secondary: string[];
  pattern: MovementPattern;
  equipment: Equipment[];
  minLevel: ExerciseLevel;
  /** True when one side is trained at a time — the log and the swap picker both care. */
  unilateral?: boolean;
  /** True for an exercise prescribed as a TIME under tension rather than reps (plank, dead hang). */
  hold?: boolean;
  cue: string;
  /** Slug of a looping demonstration animation (assets/exercise-animations/<slug>.webp). Absent for
   *  most of the library — exVisual() falls back to the schematic figure for the movement PATTERN,
   *  so a page of sixty exercises does not need sixty bespoke animations to be usable. */
  anim?: string;
};

/**
 * ⚠️ THE SIXTEEN ORIGINAL EXERCISES ARE UNCHANGED — same id, name, cue, anim. Ids are load-bearing:
 * they are what a logged set is filed under, and this project has already paid once for treating an
 * exercise identifier as free to move.
 */
export const EXERCISES: Record<string, ExerciseDef> = {
  // ---- Squat --------------------------------------------------------------------------------------
  squat: { name: "Goblet / bodyweight squat", primary: "Quads", secondary: ["Glutes", "Core"], pattern: "squat", equipment: ["bodyweight", "dumbbell", "kettlebell"], minLevel: "beginner", anim: "goblet-squat", cue: "Sit your hips back and down, knees tracking over your toes, chest tall. Drive up through your heels." },
  stepUp: { name: "Step-up", primary: "Quads", secondary: ["Glutes"], pattern: "squat", equipment: ["box", "bodyweight", "dumbbell"], minLevel: "beginner", unilateral: true, anim: "step-up", cue: "Drive through the top foot to stand tall, then lower with control. Start with a low step." },
  boxSquat: { name: "Box squat", primary: "Quads", secondary: ["Glutes"], pattern: "squat", equipment: ["box", "barbell", "bodyweight"], minLevel: "beginner", cue: "Sit back onto the box under control, pause briefly without relaxing, then drive back up." },
  frontRackSquat: { name: "Front-rack squat", primary: "Quads", secondary: ["Core", "Glutes"], pattern: "squat", equipment: ["kettlebell", "barbell"], minLevel: "intermediate", cue: "Weight held at the shoulders keeps you upright — sit down between your hips rather than back." },
  boxStepDown: { name: "Step-down", primary: "Quads", secondary: ["Glutes"], pattern: "squat", equipment: ["box", "bodyweight"], minLevel: "intermediate", unilateral: true, cue: "Lower the trailing foot to the floor slowly, controlling the knee — the lowering is the exercise, not the step itself." },
  pistolSquat: { name: "Pistol squat", primary: "Quads", secondary: ["Glutes", "Balance"], pattern: "squat", equipment: ["bodyweight"], minLevel: "advanced", unilateral: true, cue: "One leg extended in front, sit the standing leg down as far as control allows. Use a box under the hips at first." },
  // ---- Hinge ----------------------------------------------------------------------------------------
  rdl: { name: "Romanian deadlift", primary: "Hamstrings", secondary: ["Glutes", "Lower back"], pattern: "hinge", equipment: ["dumbbell", "kettlebell", "barbell", "bodyweight"], minLevel: "beginner", anim: "romanian-deadlift-dumbbell", cue: "Soft knees, push your hips back with a flat back until you feel the hamstrings, then stand tall." },
  singleLegRdl: { name: "Single-leg RDL", primary: "Hamstrings", secondary: ["Glutes", "Balance"], pattern: "hinge", equipment: ["bodyweight", "dumbbell", "kettlebell"], minLevel: "intermediate", unilateral: true, cue: "Hinge forward on one leg as the other reaches back for balance. A slower tempo matters more than the range." },
  kettlebellDeadlift: { name: "Kettlebell deadlift", primary: "Hamstrings", secondary: ["Glutes", "Lower back"], pattern: "hinge", equipment: ["kettlebell"], minLevel: "beginner", cue: "Weight between your feet, hinge to grip it with a flat back, then stand by driving the floor away." },
  barbellDeadlift: { name: "Barbell deadlift", primary: "Hamstrings", secondary: ["Glutes", "Lower back"], pattern: "hinge", equipment: ["barbell"], minLevel: "advanced", cue: "Bar close to the shins, brace before you pull, and stand by pushing the floor away rather than yanking the bar." },
  goodMorning: { name: "Good morning", primary: "Hamstrings", secondary: ["Lower back", "Glutes"], pattern: "hinge", equipment: ["barbell", "bodyweight"], minLevel: "advanced", cue: "Hips hinge back while the bar (or your hands, behind your head) stays over them. Small range, strict form." },
  kettlebellSwing: { name: "Kettlebell swing", primary: "Glutes", secondary: ["Hamstrings", "Core"], pattern: "hinge", equipment: ["kettlebell"], minLevel: "intermediate", cue: "Power comes from snapping the hips forward, not lifting with the arms. The kettlebell floats — you don't muscle it up." },
  barbellHipThrust: { name: "Hip thrust", primary: "Glutes", secondary: ["Hamstrings"], pattern: "hinge", equipment: ["barbell", "bench", "bodyweight"], minLevel: "beginner", cue: "Shoulders on the bench, drive the hips up by squeezing the glutes, not by arching the lower back." },
  // ---- Lunge / single leg ---------------------------------------------------------------------------
  splitSquat: { name: "Split squat", primary: "Quads", secondary: ["Glutes"], pattern: "lunge", equipment: ["bodyweight", "dumbbell"], minLevel: "beginner", unilateral: true, anim: "split-squat-dumbbell", cue: "Feet split front-to-back. Lower straight down, front knee over the foot; push back up." },
  lunge: { name: "Reverse lunge", primary: "Quads", secondary: ["Glutes", "Core"], pattern: "lunge", equipment: ["bodyweight", "dumbbell"], minLevel: "beginner", unilateral: true, anim: "reverse-lunge", cue: "Step back and lower the back knee toward the floor; push through the front heel to return." },
  walkingLunge: { name: "Walking lunge", primary: "Quads", secondary: ["Glutes"], pattern: "lunge", equipment: ["bodyweight", "dumbbell"], minLevel: "intermediate", unilateral: true, cue: "Step forward into a lunge, then bring the back leg through to the next step rather than returning to standing." },
  lateralLunge: { name: "Lateral lunge", primary: "Quads", secondary: ["Adductors", "Glutes"], pattern: "lunge", equipment: ["bodyweight", "dumbbell"], minLevel: "intermediate", unilateral: true, cue: "Step directly sideways and sit the hips over that foot, keeping the other leg straight. A plane running rarely uses, and worth training anyway." },
  deficitLunge: { name: "Deficit reverse lunge", primary: "Quads", secondary: ["Glutes"], pattern: "lunge", equipment: ["box", "dumbbell"], minLevel: "advanced", unilateral: true, cue: "Standing on a low step, the back leg reaches further down than the floor allows — more range, same control." },
  clamshell: { name: "Clamshell", primary: "Glutes", secondary: ["Hips"], pattern: "bridge", equipment: ["bodyweight", "bands"], minLevel: "beginner", anim: "clamshell", cue: "On your side, knees bent, lift the top knee while keeping your feet together and hips still." },
  // ---- Bridge / glutes -------------------------------------------------------------------------------
  gluteBridge: { name: "Glute bridge", primary: "Glutes", secondary: ["Hamstrings"], pattern: "bridge", equipment: ["bodyweight"], minLevel: "beginner", anim: "glute-bridge", cue: "Drive your hips up by squeezing your glutes, pause at the top, lower slowly." },
  singleLegGluteBridge: { name: "Single-leg glute bridge", primary: "Glutes", secondary: ["Hamstrings"], pattern: "bridge", equipment: ["bodyweight"], minLevel: "intermediate", unilateral: true, cue: "One foot planted, the other leg extended. Drive up without letting the hips tilt toward the lifted side." },
  fireHydrant: { name: "Fire hydrant", primary: "Glute medius", secondary: ["Hips"], pattern: "bridge", equipment: ["bodyweight", "bands"], minLevel: "beginner", unilateral: true, cue: "On hands and knees, lift the bent knee out to the side without rotating the hips or spine." },
  // ---- Calf -----------------------------------------------------------------------------------------
  calf: { name: "Calf raise", primary: "Calves", secondary: [], pattern: "calf", equipment: ["bodyweight"], minLevel: "beginner", anim: "standing-calf-raise", cue: "Rise onto the balls of your feet, pause at the top, lower slowly under control." },
  soleus: { name: "Bent-knee calf raise", primary: "Soleus", secondary: ["Calves"], pattern: "calf", equipment: ["bodyweight"], minLevel: "beginner", anim: "single-leg-standing-calf-raise", cue: "Same as a calf raise but with knees slightly bent, to reach the deeper soleus muscle." },
  seatedCalfRaise: { name: "Seated calf raise", primary: "Soleus", secondary: [], pattern: "calf", equipment: ["bench", "dumbbell"], minLevel: "beginner", cue: "Knees bent at 90°, weight on the thighs. Press through the balls of the feet, full range, slow down." },
  singleLegCalfRaise: { name: "Single-leg calf raise", primary: "Calves", secondary: [], pattern: "calf", equipment: ["bodyweight", "box"], minLevel: "intermediate", unilateral: true, cue: "One foot on the step, heel dropping below it, then rise fully onto the toes. Hold the wall if balance is the limiter, not the calf." },
  loadedCalfRaise: { name: "Loaded calf raise", primary: "Calves", secondary: ["Soleus"], pattern: "calf", equipment: ["dumbbell", "barbell"], minLevel: "intermediate", cue: "Added weight, same full range as a bodyweight raise. The load should slow the tempo, not shorten the movement." },
  // ---- Plank / anti-extension -------------------------------------------------------------------------
  plank: { name: "Plank", primary: "Core", secondary: ["Shoulders"], pattern: "plank", equipment: ["bodyweight"], minLevel: "beginner", hold: true, anim: "plank", cue: "Straight line from head to heels. Brace your abs and glutes; don't let the hips sag." },
  sidePlank: { name: "Side plank", primary: "Obliques", secondary: ["Glute medius"], pattern: "plank", equipment: ["bodyweight"], minLevel: "beginner", unilateral: true, hold: true, anim: "side-plank", cue: "Stack the shoulders and hips. Lift the bottom hip rather than resting on it." },
  sidePlankLegRaise: { name: "Side plank with leg raise", primary: "Obliques", secondary: ["Glute medius"], pattern: "plank", equipment: ["bodyweight"], minLevel: "advanced", unilateral: true, hold: true, cue: "Hold the side plank, then lift the top leg without dropping the hips. The hips staying level is the point, not the leg height." },
  swissBallPlank: { name: "Swiss ball plank", primary: "Core", secondary: ["Shoulders"], pattern: "plank", equipment: ["swissBall"], minLevel: "advanced", hold: true, cue: "Forearms on the ball rather than the floor — the instability makes the same brace much harder to hold." },
  // ---- Core (dynamic anti-rotation / anti-extension) --------------------------------------------------
  deadbug: { name: "Dead bug", primary: "Core", secondary: [], pattern: "core", equipment: ["bodyweight"], minLevel: "beginner", anim: "dead-bug", cue: "On your back, slowly lower an opposite arm and leg while keeping your lower back pressed down." },
  birddog: { name: "Bird-dog", primary: "Core", secondary: ["Glutes"], pattern: "core", equipment: ["bodyweight"], minLevel: "beginner", unilateral: true, anim: "bird-dog", cue: "On hands and knees, extend an opposite arm and leg, stay level, then switch sides." },
  plankShoulderTap: { name: "Plank shoulder tap", primary: "Core", secondary: ["Shoulders"], pattern: "core", equipment: ["bodyweight"], minLevel: "intermediate", cue: "In a plank, tap the opposite shoulder without letting the hips rock. Slow it down if they do." },
  mountainClimber: { name: "Mountain climber", primary: "Core", secondary: ["Hip flexors"], pattern: "core", equipment: ["bodyweight"], minLevel: "beginner", cue: "Drive the knees toward the chest one at a time from a plank, keeping the hips low and steady." },
  hollowHold: { name: "Hollow hold", primary: "Core", secondary: [], pattern: "core", equipment: ["bodyweight"], minLevel: "intermediate", hold: true, cue: "On your back, lower back pressed to the floor, lift the shoulders and legs a few inches. Longer levers are harder — bend the knees to make it easier." },
  swissBallStirThePot: { name: "Swiss ball stir the pot", primary: "Core", secondary: ["Shoulders"], pattern: "core", equipment: ["swissBall"], minLevel: "advanced", cue: "Forearms on the ball in a plank, then trace small circles with the elbows without the hips following." },
  // ---- Rotate ---------------------------------------------------------------------------------------
  russianTwist: { name: "Russian twist", primary: "Obliques", secondary: ["Core"], pattern: "rotate", equipment: ["bodyweight", "dumbbell", "kettlebell"], minLevel: "beginner", cue: "Lean back to about 45°, feet lifted if you can, and rotate the weight from hip to hip without collapsing the chest." },
  woodchop: { name: "Woodchop", primary: "Obliques", secondary: ["Core", "Glutes"], pattern: "rotate", equipment: ["dumbbell", "kettlebell", "bands"], minLevel: "intermediate", cue: "Rotate from high on one side to low on the other, driven by the hips and trunk, not just the arms." },
  palofPress: { name: "Palof press", primary: "Core", secondary: ["Obliques"], pattern: "rotate", equipment: ["bands"], minLevel: "beginner", cue: "Band pulling you to rotate; press it straight out and resist the twist. The goal is to stay still, not to move." },
  // ---- Push -------------------------------------------------------------------------------------------
  pushup: { name: "Push-up (incline if needed)", primary: "Chest", secondary: ["Triceps", "Core"], pattern: "push", equipment: ["bodyweight"], minLevel: "beginner", anim: "push-up", cue: "Hands under shoulders, body in a straight line. Lower with control, then press away." },
  inclinePushUp: { name: "Incline push-up", primary: "Chest", secondary: ["Triceps"], pattern: "push", equipment: ["bench", "box"], minLevel: "beginner", anim: "incline-push-up", cue: "Hands raised makes it easier. Work down to a lower surface as you get stronger." },
  shoulderPressDumbbell: { name: "Dumbbell shoulder press", primary: "Shoulders", secondary: ["Triceps"], pattern: "push", equipment: ["dumbbell"], minLevel: "beginner", cue: "Press straight overhead without arching the lower back — brace the core to keep the ribs down." },
  shoulderPressKettlebell: { name: "Kettlebell shoulder press", primary: "Shoulders", secondary: ["Triceps", "Core"], pattern: "push", equipment: ["kettlebell"], minLevel: "intermediate", cue: "Press from the rack position, staying tall through the press rather than leaning back." },
  benchPress: { name: "Bench press", primary: "Chest", secondary: ["Triceps", "Shoulders"], pattern: "push", equipment: ["barbell", "bench"], minLevel: "intermediate", cue: "Bar to the chest under control, drive it back up in a straight line. Feet planted, not floating." },
  overheadPressBarbell: { name: "Overhead press", primary: "Shoulders", secondary: ["Triceps", "Core"], pattern: "push", equipment: ["barbell"], minLevel: "advanced", cue: "Press the bar in a straight line past the face, finishing with the head through the arms, not behind them." },
  // ---- Pull -------------------------------------------------------------------------------------------
  bentOverRow: { name: "Bent-over row", primary: "Upper back", secondary: ["Biceps"], pattern: "pull", equipment: ["dumbbell", "barbell", "kettlebell"], minLevel: "beginner", cue: "Hinge forward, flat back, and pull the weight to the ribs by driving the elbows back — not by shrugging the shoulders." },
  singleArmRow: { name: "Single-arm row", primary: "Upper back", secondary: ["Biceps"], pattern: "pull", equipment: ["dumbbell", "kettlebell"], minLevel: "beginner", unilateral: true, cue: "Support yourself with the free hand, keep the hips square, and pull the elbow back past the ribs." },
  bandedRow: { name: "Banded row", primary: "Upper back", secondary: ["Biceps"], pattern: "pull", equipment: ["bands"], minLevel: "beginner", cue: "Anchor the band, sit back slightly, and pull the handles to the ribs while keeping the shoulders down." },
  bandedFacePull: { name: "Face pull", primary: "Rear shoulders", secondary: ["Upper back"], pattern: "pull", equipment: ["bands"], minLevel: "beginner", cue: "Pull the band toward your face, elbows high, squeezing the shoulder blades — the posture running slowly erodes." },
  invertedRow: { name: "Inverted row", primary: "Upper back", secondary: ["Biceps"], pattern: "pull", equipment: ["pullUpBar", "bodyweight"], minLevel: "intermediate", cue: "Body straight underneath a bar or table edge, pull the chest to it. Walk the feet in to make it easier." },
  pullUp: { name: "Pull-up", primary: "Upper back", secondary: ["Biceps"], pattern: "pull", equipment: ["pullUpBar"], minLevel: "advanced", cue: "Pull until the chin clears the bar, then lower fully under control — the lowering counts as much as the pull." },
  // ---- Carry ------------------------------------------------------------------------------------------
  farmersCarry: { name: "Farmer's carry", primary: "Whole body", secondary: ["Grip", "Core"], pattern: "carry", equipment: ["dumbbell", "kettlebell"], minLevel: "beginner", cue: "Stand tall and walk with purpose. If your shoulders round forward, the weight is too heavy or the distance too far." },
  suitcaseCarry: { name: "Suitcase carry", primary: "Obliques", secondary: ["Core", "Grip"], pattern: "carry", equipment: ["dumbbell", "kettlebell"], minLevel: "intermediate", unilateral: true, cue: "One weight, carried on one side. Resist leaning away from it — the core works to keep you upright, not the arm." },
  overheadCarry: { name: "Overhead carry", primary: "Shoulders", secondary: ["Core"], pattern: "carry", equipment: ["dumbbell", "kettlebell"], minLevel: "advanced", unilateral: true, cue: "Arm locked straight overhead, walk slowly and under control. Stop the set the moment the arm starts to waver." },
  // ---- Balance ----------------------------------------------------------------------------------------
  balance: { name: "Single-leg balance", primary: "Ankles", secondary: ["Core"], pattern: "balance", equipment: ["bodyweight"], minLevel: "beginner", hold: true, anim: "single-leg-balance", cue: "Stand tall on one leg and stay steady. Progress by closing your eyes or standing on something soft." },
  singleLegBoxTouch: { name: "Single-leg box touch", primary: "Ankles", secondary: ["Glute medius"], pattern: "balance", equipment: ["box", "bodyweight"], minLevel: "intermediate", unilateral: true, cue: "Standing on one leg, reach the other foot to lightly tap a low box in front, to the side, then behind, returning to balance each time." },
  // ---- Jump / plyometric --------------------------------------------------------------------------------
  pogo: { name: "Pogo hops", primary: "Calves", secondary: [], pattern: "jump", equipment: ["bodyweight"], minLevel: "beginner", anim: "pogo-hops", cue: "Small, springy hops off the balls of your feet — stiff ankles, minimal time on the ground." },
  boxjump: { name: "Box / hurdle jump", primary: "Quads", secondary: ["Glutes", "Calves"], pattern: "jump", equipment: ["bodyweight", "box"], minLevel: "intermediate", anim: "box-jump", cue: "Explode up, land soft and quiet with bent knees. Full recovery between jumps — quality over fatigue." },
  hurdleHop: { name: "Hurdle hop", primary: "Calves", secondary: ["Quads"], pattern: "jump", equipment: ["bodyweight", "box"], minLevel: "intermediate", cue: "Small forward hops over a low obstacle — quick, light contacts, not maximal height." },
  lateralBound: { name: "Lateral bound", primary: "Glute medius", secondary: ["Calves"], pattern: "jump", equipment: ["bodyweight"], minLevel: "advanced", unilateral: true, cue: "Push off one leg sideways, land softly on the other and hold it — control on landing matters more than distance." },
  depthJump: { name: "Depth jump", primary: "Calves", secondary: ["Quads"], pattern: "jump", equipment: ["box"], minLevel: "advanced", cue: "Step off the box, land, and rebound up immediately — minimal ground time. The most demanding entry here; earn it with the others first." },
};

/** Every exercise id the catalogue defines, so a guard can sweep them rather than list them. */
export function exerciseIds(): string[] { return Object.keys(EXERCISES); }

/** Rank of each level, so "at most this level" is a comparison rather than three if-statements. */
const LEVEL_RANK: Record<ExerciseLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * True when a runner at `level` owning `owned` can perform this exercise.
 *
 * ⚠️ AN EMPTY LIST IS BODYWEIGHT, NOT "ANYTHING GOES". A runner who ticked nothing has nothing, so
 * reading empty as unrestricted would prescribe a barbell to somebody standing in a hotel room.
 *
 * ⚠️⚠️ AND BODYWEIGHT IS NEVER SOMETHING YOU OWN — IT IS ALWAYS TRUE. The first cut built the owned
 * set from the ticks alone, so a runner who ticked "a resistance band" and nothing else was refused
 * every bodyweight exercise in the catalogue: no plank, no calf raise, no pogo hops. Ticking a piece
 * of kit can only ever ADD to what somebody can do. Caught by the guard sweeping a band-only kit.
 */
export function canDo(d: ExerciseDef, owned: Equipment[], level: ExerciseLevel): boolean {
  if (LEVEL_RANK[d.minLevel] > LEVEL_RANK[level]) return false;
  const has = new Set<string>(owned);
  has.add("bodyweight");
  return d.equipment.some((e) => has.has(e));
}

/**
 * Every exercise of one movement pattern this runner can actually perform, in catalogue order.
 *
 * ⚠️ CATALOGUE ORDER, NOT A SCORE, AND NOT SHUFFLED. A plan must be reproducible — the same answers
 * must build the same block today and after a rebuild — so the only ordering here is the one written
 * down in EXERCISES, easiest first within each pattern group. `alternativesFor` ranks by muscle
 * overlap because a SWAP is a comparison against one exercise; this is a pick with no incumbent.
 */
export function exercisesFor(
  pattern: MovementPattern,
  owned: Equipment[],
  level: ExerciseLevel,
): (ExerciseDef & { id: string })[] {
  const out: (ExerciseDef & { id: string })[] = [];
  for (const id in EXERCISES) {
    const d = EXERCISES[id]!;
    if (d.pattern !== pattern) continue;
    if (!canDo(d, owned, level)) continue;
    out.push({ id, ...d });
  }
  return out;
}

/** Look up an exercise by its stable id. */
export function exerciseById(id: string): (ExerciseDef & { id: string }) | null {
  const d = EXERCISES[id];
  return d ? { id, ...d } : null;
}

/**
 * Candidates to swap an exercise for: same pattern, owned equipment, ranked by how much of the
 * secondary-muscle work is preserved. Never the exercise itself.
 *
 * ⚠️ SAME PATTERN, NOT SAME PRIMARY MUSCLE — a squat and a step-up both load the quads but are
 * different movements to learn and load differently; a runner asking to swap wants an alternative
 * they can actually perform with what they have, not a lecture on anatomy.
 */
export function alternativesFor(id: string, owned: Equipment[]): (ExerciseDef & { id: string })[] {
  const from = EXERCISES[id];
  if (!from) return [];
  const has = new Set(owned.length ? owned : ["bodyweight"]);
  const out: (ExerciseDef & { id: string; score: number })[] = [];
  for (const cand in EXERCISES) {
    if (cand === id) continue;
    const d = EXERCISES[cand]!;
    if (d.pattern !== from.pattern) continue;
    if (!d.equipment.some((e) => has.has(e))) continue;
    const overlap = d.secondary.filter((m) => from.secondary.includes(m) || m === from.primary).length +
      (d.primary === from.primary ? 2 : 0);
    out.push({ id: cand, ...d, score: overlap });
  }
  out.sort((a, b) => b.score - a.score);
  return out.map(({ score, ...rest }) => rest);
}
