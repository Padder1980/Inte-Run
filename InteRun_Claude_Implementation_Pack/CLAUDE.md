# Inte-Run post-run debrief — binding implementation contract

## Status

This file is the highest-authority instruction for the post-run debrief rebuild. The three PNG files in `references/` are the authoritative visual targets. `POST_RUN_DEBRIEF_SPEC.md` defines behaviour that static images cannot show. `VISUAL_ACCEPTANCE_CHECKLIST.md` defines completion.

Do not reinterpret, simplify, restyle or produce alternative concepts. Build the supplied model.

## The only approved visual substitution

The heart-rate Zone 1–5 bars shown in `references/03-run-analysis-target.png` use temporary teal placeholder bars. Do not reproduce those placeholder colours.

Before writing UI code:

1. Find Inte-Run's existing canonical Zone 1, Zone 2, Zone 3, Zone 4 and Zone 5 colour definitions or shared heart-rate-zone component.
2. Confirm how those colours resolve in light and dark appearance.
3. Reuse that source directly in every debrief zone bar, legend, label and selected-zone state.
4. Do not add local replacement hex values, copy Runna's palette or infer colours from the reference PNG.
5. Record the reused token/component names in the final implementation summary.

Useful repository searches:

```bash
rg -n -i "zone.?1|zone.?2|zone.?3|zone.?4|zone.?5|heart.?rate.?zone|hrZone" .
rg -n -i "HeartRateZoneColors|ZoneColor|zoneColor|heartRateZones" .
```

If no canonical mapping can be found, stop and report that blocker. Do not invent one.

## Authority order

When sources disagree, use this order:

1. This contract.
2. The three target PNGs for visible design and hierarchy.
3. `POST_RUN_DEBRIEF_SPEC.md` for interaction, responsive behaviour and non-visible states.
4. Existing Inte-Run design tokens and shared components.
5. Existing feature behaviour that must be preserved.

Do not silently resolve a material conflict. Report it before changing the approved design.

## Required experience

The debrief is one continuous, coaching-first story:

1. Recognise the route and session.
2. Understand whether the run achieved its training purpose.
3. Understand the evidence.
4. Know the next appropriate action.
5. Open deeper analysis only when wanted.
6. Add metadata or share after the coaching content.

Required order:

`RouteHero → RunMetricSummary → CoachVerdict → CoachingEvidence → PlanActualComparison → NextBestAction → AnalysisOverview → Splits/Trends → AdvancedAnalysis → RunMetadata → Share`

The short post-run RPE/discomfort check-in may appear as a completion sheet before the debrief. It must not block later access and must remain editable.

## Non-negotiable visual and interaction rules

- Use one edge-to-edge contextual map hero, not a map inside a bordered card.
- Blend the map into the page with the approved gradient mask.
- Drive map opacity from live scroll offset. Scrolling down fades it; scrolling back restores it at the same rate.
- Replace the transparent map controls with a compact sticky header as the map fades.
- Hide global bottom-tab navigation while the run detail is open.
- Put the coaching verdict before Share, shoes, source, notes and advanced analysis.
- Use one Share entry point. Strava is a destination in that flow, not a second primary button.
- Keep advanced metrics collapsed unless profile defaults or explicit athlete pinning justify expansion.
- Keep Inte-Run teal as the primary accent. Chrome-gold is a restrained success/milestone detail and must not be applied to the logo or used as the default chart colour.
- Preserve light/dark appearance, Dynamic Type, VoiceOver, Reduce Motion, privacy and missing-data states.
- Do not display unavailable values as zero.
- Do not create opaque composite scores or coaching claims unsupported by the activity evidence.

## Existing behaviour that must survive

Inspect the current feature before editing and preserve existing activity import, save, sync, Strava, plan-matching, notes, shoes and privacy behaviour unless the specification explicitly changes its presentation. Use the project's existing architecture and design system. Do not create a parallel styling or data layer.

Implement behind the project's feature-flag mechanism when one exists. Keep one scroll owner for the screen. Avoid nested vertical scrolling.

## Required workflow

1. Read this file, the detailed specification and the acceptance checklist.
2. Inspect the current implementation, shared design tokens, HR-zone source and data models.
3. Produce a short preflight report listing the files/components to reuse and any genuine conflicts. Do not edit yet.
4. Implement the structure and deterministic local-data states first.
5. Add the reversible map transition and progressive analysis.
6. Add coaching generation only after the evidence and confidence model is sound.
7. Render at the agreed reference iPhone viewport and capture screenshots for all three target states.
8. Compare screenshots using an opacity overlay or image-diff workflow; correct hierarchy, position, size, spacing, typography, colour, radius and transition differences.
9. Run the acceptance checklist and relevant tests.
10. Report reused HR-zone tokens, changed files, test results, screenshot locations and any remaining deviation.

## Prohibited shortcuts

- Do not implement the PNGs as flattened background images.
- Do not copy Runna branding, points, colour scheme or graph feed.
- Do not add persistent bottom navigation inside the debrief.
- Do not add separate Share and Send to Strava buttons.
- Do not turn every section into an outlined card.
- Do not make the map fade a one-way triggered animation.
- Do not change unrelated screens while completing this task.
- Do not call a build complete without target-state screenshots and a completed acceptance checklist.

