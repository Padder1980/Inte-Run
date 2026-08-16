# Inte-Run post-run debrief specification

## 1. Product outcome

Build a premium, calm post-run experience that answers, in order:

1. What happened?
2. Did the run achieve its intended purpose?
3. What evidence supports that conclusion?
4. What should the athlete do next?

Detailed analytics are supporting evidence, not the opening experience. The screen must feel like a coach with excellent data rather than an activity database with a paragraph attached.

## 2. Authoritative visual states

### State A — map-led arrival

Reference: `references/01-map-hero-target.png`

- Full-bleed contextual route map from the top safe area.
- Transparent 44 × 44 pt Back and overflow controls over the map.
- No persistent global tab bar.
- Route uses Inte-Run teal with clear start/end markers and optional privacy redaction.
- The map dissolves into the page background; there is no visible lower map-card edge.
- Session title and short outcome cue emerge inside the transition area.
- Primary metrics: Distance, Time and Average pace.
- Secondary metrics are compact. Omit unavailable metrics instead of showing zero.
- No Share control appears before the coaching verdict.

### State B — coaching-led interpretation

Reference: `references/02-coach-debrief-target.png`

- Map has faded out as a direct function of scroll position.
- Compact sticky session header has faded in.
- `CoachVerdict` is the dominant surface.
- Verdict contains one headline, two or three short sentences and up to three evidence chips.
- “What went well” contains no more than three items.
- “Watch next time” appears only when evidence supports a useful caution.
- Exactly one prominent next action appears. Normal options are `View next run` or `Adjust plan`; do not promise planning functionality that does not exist.
- A compact metric summary may remain below the action for orientation.

### State C — optional analysis

Reference: `references/03-run-analysis-target.png`

- Compact session header remains.
- Analysis navigation is `Overview`, `Splits`, `Trends`.
- Overview prioritises pace trace, target context, heart-rate-zone distribution and one useful interpretation.
- Elevation, cadence, power and form remain collapsed rows unless the athlete has pinned them or their profile warrants a different default.
- The reference's teal HR-zone bars are placeholders. Replace them with the existing Inte-Run Zone 1–5 colour mapping through its canonical token/component source.

## 3. Information architecture

Use one vertical scroll owner and this content sequence:

1. `RunDetailNavigation`
2. `RouteHero`
3. `RunMetricSummary`
4. `CoachVerdict`
5. `CoachingEvidenceList`
6. `PlanActualComparison`
7. `NextBestAction`
8. `RunAnalysisTabs`
9. `AdvancedMetricAccordion`
10. `RunMetadata`
11. `ShareRunSheet` entry

`PostRunCheckInSheet` is a short completion flow displayed before the debrief when appropriate. It collects RPE, discomfort, optional conditions and a note in approximately ten seconds. It is skippable and editable later.

Metadata includes shoes, source/device, notes, sync state and privacy. These items must not displace the coaching content.

## 4. Map and scroll interaction

The route is emotionally important at arrival but must yield to interpretation during reading.

### Layout

- Map hero height: approximately 44–50% of the active viewport, adjusted for safe areas and supported iPhone sizes.
- Content sheet visually overlaps the bottom of the hero by 22–28 pt.
- Blend map to page with a 72–110 pt transparent-to-background gradient.
- Prefer a cached MapKit snapshot for initial paint. Enable interactive map behaviour only after explicit user interaction.

### Offset-driven transition

Use live scroll offset rather than a one-time animation:

```text
progress = clamp((scrollY - 48) / 220, 0, 1)
mapOpacity = 1 - progress
mapTranslateY = scrollY * 0.22
mapScale = 1 + (0.025 * progress)
headerMaterialOpacity = progress
mapAllowsHitTesting = progress < 0.82
```

Reference states:

| Scroll offset | Map | Header | Content |
|---|---|---|---|
| 0–48 pt | Opacity 1; no blur | Transparent controls | Sheet overlaps hero |
| 48–160 pt | 0.22× parallax; opacity 1 → 0.55 | Title begins to appear | Normal scroll |
| 160–268 pt | Opacity 0.55 → 0 | Material 0.35 → 1 | Coaching dominates |
| Above 268 pt | Removed from hit testing and accessibility | Compact header visible | Normal document flow |
| Reverse scroll | Apply the same interpolation backwards | Header fades out | Map returns |

Do not attach a spring to every scroll-frame update. The transition must track the finger cleanly.

### Reduced Motion

- Remove parallax and scale.
- Keep a reversible crossfade over approximately 120–160 pt.
- Preserve the sticky-header hierarchy.
- Do not use opacity as the only way assistive technology learns that content has changed.

## 5. Component contract

### `RunDetailNavigation`

- Back, compact title and overflow only.
- Transparent at the top; material-backed after collapse.
- Hides the global bottom tab bar until the run detail is dismissed.

### `RouteHero`

- Snapshot, polyline, privacy treatment, start/end markers and bottom gradient.
- States: loading, route available, no GPS, weak GPS, private route, treadmill/indoor.
- Treadmill/indoor uses a route-free hero with session identity and timeline; do not show an empty map.

### `RunMetricSummary`

- Exactly three primary metrics when data permits: Distance, Time and Average pace.
- Up to six secondary metrics: elevation, average HR, cadence, calories, maximum HR and RPE.
- Use existing unit preferences.
- Missing values are omitted or labelled `Not recorded`; never substitute zero.

### `CoachVerdict`

- One outcome headline.
- Maximum visible body length: approximately 70 words before expansion.
- Up to three evidence chips tied to actual values.
- Supports `achieved`, `partial`, `caution`, `insufficientData` and `painFlag` states.
- Every recommendation names the relevant evidence and consequence.

Verdict precedence:

1. Safety/discomfort.
2. Completion against planned duration, distance or repetitions.
3. Adherence to the primary intensity target.
4. Agreement between objective data and perceived effort.
5. Training implication and next action.

Never reward excessive intensity on an easy day because pace was faster. Use `suggests`, `appears` or `may` for uncertain inferences. Do not diagnose injury, dehydration, illness or overtraining from one activity.

### `PlanActualComparison`

- Lead with the purpose of the planned session.
- Compare only relevant values: time, distance, pace/effort target, work repetitions and recoveries.
- Support complete, partial, incomplete and unplanned activities.
- Do not shame an incomplete session or automatically prescribe making up missed load.

### `NextBestAction`

- One primary coaching action.
- Examples: continue as planned, view next run, recovery check or adjust plan.
- Share is not the primary coaching action.

### `RunAnalysisTabs`

- `Overview`: pace, target band, HR zones and brief interpretation.
- `Splits`: kilometre/mile splits or planned work/recovery structure with target comparison.
- `Trends`: comparable sessions, pace stability, aerobic drift and training-block direction.
- Do not introduce unexplained novelty scores.

Charts must expose units, average, range, target band, gaps and a textual summary. Support press-and-drag inspection with a crosshair and accessible equivalent. Each expanded chart contains one sentence explaining why the metric matters for this run.

### `AdvancedMetricAccordion`

- Elevation, cadence, power and running-form metrics.
- Lazy-load on expansion.
- Collapsed by default for beginners and most intermediate athletes.
- Advanced/elite athletes may have profile-driven defaults or up to three pinned metrics.

### `RunMetadata`

- Compact rows for shoes, source/device, notes, sync state, manual edits and privacy.
- Example sync language: `Apple Watch • synced 10:53` or `Stored on this iPhone • not backed up`.
- Do not expose implementation language without explaining its consequence.

### `ShareRunSheet`

- One entry point only.
- Includes system destinations and Strava where supported.
- Shows a privacy preview.
- Offers `Hide start/end` and `Hide entire map` before export.

## 6. Visual system

Use existing project tokens wherever they exist. The values below describe the approved concept; do not create duplicate tokens if equivalent app tokens already exist.

| Role | Reference value | Usage |
|---|---:|---|
| Ink | `#10211D` | Primary text and icons |
| Inte-Run teal | `#0B8F83` | Primary action, route and selected state |
| Mint | `#42D2B2` | Positive range/progress where semantically appropriate |
| Warm off-white | `#F4F7F5` | Light background |
| Mist | `#E5EFEC` | Quiet surfaces and chips |
| Chrome-gold | `#C5A66A` | Restrained success tick or exceptional milestone |
| Muted ink | `#61706B` | Labels and secondary copy |
| Divider | `#D7E1DE` | Hairlines and chart grid |
| HR Zone 1–5 | Existing app tokens | All HR-zone visuals; no local hex values |

Visual rules:

- Use SF Pro Display for large numerals/headlines and SF Pro Text for body/controls where the existing iOS app does so.
- Respect Dynamic Type rather than fixing all values to pixels.
- Reference scale: 32/38 session title, 28/34 key metric, 22/28 section title, 17/22 body, 15/20 support, 12/16 labels.
- Use a 4 pt spacing grid, approximately 20 pt horizontal page inset, 24–32 pt between narrative sections and 12–16 pt within components.
- Reference radii: 24 pt floating summary, 18 pt coaching surface, 14 pt controls; capsules only for chips and primary actions.
- Use one quiet elevation level. Prefer spacing and contrast over multiple shadows and borders.
- Keep the logo unchanged. Never apply chrome-gold to it.

## 7. Athlete-profile adaptation

The hierarchy is identical for every athlete; only wording, default depth and metric emphasis change.

| Ability | First-view emphasis | Analysis default | Language |
|---|---|---|---|
| Beginner | Outcome, duration, effort, reassuring next step | Charts collapsed; explanations visible | Plain English; define pace, zones and RPE |
| Intermediate | Outcome, pace adherence, HR/effort agreement | Splits/zones available; cadence collapsed | Coaching terms with short explanations |
| Advanced | Target distribution, drift, interval execution | Splits open; trends prominent; power optional | Precise performance language |
| Elite | Session-purpose verdict, rep quality, recovery cost, trend | Configurable pinned metrics; export | Concise technical language |

Use explicit profile data and validated history. Never infer elite status from one fast run. Personalisation may change detail but must not produce contradictory advice.

## 8. Activity and data states

| State | Required response |
|---|---|
| Planned + complete | Full verdict, plan comparison and next action |
| Planned + incomplete | State what was completed; no shame or automatic make-up session |
| Unplanned/free run | Descriptive coaching and trends; no invented target |
| Intervals | Prioritise repetitions, work/recovery splits and consistency |
| Race/time trial | Prioritise official distance, pacing, PB context and recovery |
| Indoor/treadmill | Route-free hero; timeline and source badge |
| Weak GPS | Mark route/pace confidence; permit correction where existing product allows |
| HR missing | Remove HR components; give RPE greater weight and explain why |
| Private route | Redact start/end and preserve privacy in share output |
| Low confidence | State that clean data is insufficient; avoid a false verdict |

## 9. Accessibility, privacy and performance

### Accessibility

- Minimum interactive target: 44 × 44 pt.
- Never rely on colour alone.
- Support Dynamic Type through at least Accessibility 2 without clipping.
- VoiceOver order: session, verdict, metrics, coaching, plan comparison, analysis, metadata.
- Charts need a textual summary and selectable values.
- Respect Reduce Motion, Reduce Transparency and Increase Contrast.
- Route and zone meaning must remain understandable for colour-vision deficiencies.

### Privacy and trust

- Preserve existing private-by-default controls.
- Surface weak sensors, pauses, manual edits and low-confidence conditions.
- Never fabricate precision.
- Do not expose private route endpoints in generated share assets.

### Performance

- Render summary and deterministic verdict inputs from local activity data before waiting for generated coaching text.
- Use cached map snapshot for first paint.
- Lazy-load and down-sample advanced chart series to visible pixel width.
- Target smooth 60 fps scrolling.
- Target first meaningful content below 500 ms from warm local cache where current architecture permits.
- If coaching is generating, skeletonise only the missing verdict content; do not shimmer the whole screen.

## 10. Suggested data contract

```text
RunDebriefViewModel
  activityIdentity
  routePresentation {snapshot, polyline, privacyState, gpsConfidence}
  metrics {primary[3], secondary[0...6]}
  verdict {state, headline, explanation, evidence[], confidence}
  planComparison {purpose, targets[], actuals[], completionState}
  nextAction {label, destination, rationale}
  analysis {overview, splits, trends, advancedMetrics[]}
  athleteFeedback {rpe, pain, conditions, note}
  metadata {shoes, sources, syncState, edits}
```

Reuse equivalent existing models instead of duplicating them.

## 11. Implementation sequence

1. Audit current code, data flows, design tokens and HR-zone source.
2. Create the focused run-detail shell and hide global tab navigation.
3. Build `RouteHero`, gradient and offset-driven transition.
4. Build summary, verdict, evidence, plan comparison and next action using deterministic data.
5. Add coaching generation with confidence and missing-data guardrails.
6. Add Overview, Splits and Trends.
7. Add lazy advanced accordions.
8. Add check-in, metadata, privacy and unified Share flow.
9. Validate target screenshots, light/dark mode, accessibility and all activity states.
10. Run visual, unit, snapshot and performance checks before sign-off.

