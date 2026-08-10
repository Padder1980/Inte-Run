# Locked image-generation specification

The final assets were generated with the built-in image-generation workflow using the user’s goblet-squat screenshot as the anatomical body and rendering reference. The screenshot was a reference only; its UI, text, modal and dumbbell were excluded.

## Global prompt lock

- Production exercise-demonstration art for a mobile running app.
- Same adult male face and athletic proportions across the whole library.
- Detailed realistic monochrome anatomical fitness illustration.
- Visible muscles, tendons and refined graphite/medical-illustration shading.
- Opaque neutral-grey fitted athletic/anatomical shorts.
- Pure white background with only required pale-grey wall, step or mat.
- Square composition, complete body visible, generous padding.
- Inte-Run teal `#1AB5A4` only on the named working muscle group.
- Correct hands, feet and limb count.
- No text, labels, arrows, UI, watermark, logo, weights, extra people, coloured background, glow, cartoon treatment or cropped limbs.

## Movement prompts

### Standing quad

Support hand at wall; free hand reaches the same-side ankle; heel travels up and back; knees close; hips square; torso tall. Highlight quadriceps/front thigh of the moving leg.

### Standing hamstring

Heel on low stable step; working leg long without a forced lock; neutral back; controlled hip hinge. Highlight hamstring/back thigh of the elevated leg.

### Wall calf

Hands at wall; front knee bends; rear leg extends; rear heel remains down; both feet forward; hips move gently toward wall. Highlight rear calf and Achilles.

### Kneeling hip flexor

Stable half-kneeling setup on mat; front knee above ankle; torso upright; subtle abdominal brace and small forward shift. Highlight only front-of-hip and very upper front thigh on the kneeling side.

### Figure-four glute

Supine on mat; ankle crosses opposite thigh above knee; hands clasp behind supporting thigh; supporting leg lifts toward torso; no hand on knee; head relaxed. Highlight glute and outer hip of the crossed leg.

### Child’s pose

Progress from tabletop; seat moves toward heels; arms remain long; neck relaxes; forehead approaches mat comfortably. Highlight lumbar lower back and both shoulder/upper-back regions.

These specifications are retained for audit and future approved regeneration. Claude must use the supplied PNGs and must not regenerate them during app integration.
