# Inte-Run debrief — visual and functional acceptance checklist

The rebuild is not complete until every applicable critical item passes. Complete this checklist against a real build, not a static design file.

## 1. Evidence required at sign-off

- [ ] Screenshot of zero-scroll/map state matching `references/01-map-hero-target.png`.
- [ ] Screenshot of coaching state matching `references/02-coach-debrief-target.png`.
- [ ] Screenshot of analysis state matching `references/03-run-analysis-target.png`.
- [ ] Light-mode and dark-mode screenshots at the project's agreed baseline iPhone viewport.
- [ ] At least one small supported iPhone and one large supported iPhone checked.
- [ ] Reduce Motion recording or screenshots.
- [ ] VoiceOver/Dynamic Type QA result.
- [ ] List of reused HR Zone 1–5 token or component names.
- [ ] Test results and any remaining known deviation.

The reference PNGs are 450 × 954 px. Compare at the same rendered canvas size or scale both reference and build proportionally before overlaying them.

## 2. Visual comparison procedure

For each target state:

1. Render deterministic fixture data matching the visible reference values where practical.
2. Capture the build without debug overlays.
3. Align reference and build by viewport edges, not by an internal component.
4. Create a 50% opacity overlay and an absolute-difference image.
5. Correct large geometry first: safe areas, hero height, header, content start and card bounds.
6. Correct typography, spacing, radii, icon size, colour and shadow.
7. Repeat until no unexplained material difference remains.

Suggested tolerances after proportional scaling:

- Major component position/size: within 4 pt.
- Internal spacing and control alignment: within 2 pt.
- Corner radius: within 2 pt.
- Typography: same semantic style, weight and line wrapping; no clipping.
- Colour: use project tokens; no visually obvious mismatch.
- Motion endpoints: map/header opacity within 0.05 of the specified state.

These tolerances are QA guidance, not permission to ignore obvious differences.

## 3. Critical contract checks

- [ ] The three reference PNGs were treated as targets, not inspiration.
- [ ] No unapproved alternative layout, navigation or colour language was introduced.
- [ ] Existing import, save, sync, Strava, plan matching, notes, shoes and privacy behaviour still works.
- [ ] Existing project architecture and shared tokens/components were reused where possible.
- [ ] No unrelated screen was changed.
- [ ] The rebuild is feature-flagged when the project has an established feature-flag mechanism.

## 4. HR-zone colour lock — release blocker

- [ ] Canonical existing Zone 1–5 colours/components were located before UI work.
- [ ] The implementation imports or injects that existing source.
- [ ] No new local Zone 1–5 hex values were added to the debrief.
- [ ] Zone bars, legends, labels and selected states all use the same canonical mapping.
- [ ] Light and dark appearance match the existing Inte-Run HR-zone screen.
- [ ] The teal placeholder zone bars in the analysis PNG were not copied.
- [ ] Runna's zone palette was not copied.
- [ ] Reused token/component names are recorded in the implementation report.

Failure of any item in this section blocks release.

## 5. State A — map-led arrival

- [ ] Contextual map reaches the top/safe area and is not enclosed in a conventional card.
- [ ] Back and overflow controls are the only navigation visible over the hero.
- [ ] Global bottom tabs are hidden.
- [ ] Route is clearly visible in Inte-Run teal with start/end markers.
- [ ] Start/end privacy redaction works.
- [ ] Gradient creates a seamless map-to-page blend without a visible lower edge.
- [ ] Session title and outcome cue emerge within the blend area.
- [ ] Distance, Time and Average pace form the primary metric row.
- [ ] Secondary metrics remain visually subordinate.
- [ ] Missing metrics are omitted or labelled `Not recorded`, never shown as zero.
- [ ] Coaching outcome is visible before Share.

## 6. State B — coaching-led interpretation

- [ ] Compact session header replaces the map during scroll.
- [ ] Header does not appear fully opaque at the top state.
- [ ] Coaching verdict is the strongest visual element.
- [ ] Verdict has one headline, no more than three short sentences and up to three evidence chips.
- [ ] Each evidence chip maps to an actual value.
- [ ] “What went well” contains at most three points.
- [ ] “Watch next time” is omitted when there is no supported caution.
- [ ] Exactly one primary coaching action is shown.
- [ ] Share, shoes, notes and source do not precede the verdict.
- [ ] Easy runs are not praised for being faster than prescribed.

## 7. State C — optional analysis

- [ ] Tabs are `Overview`, `Splits`, `Trends` in that order.
- [ ] Overview includes pace, relevant target context, HR zones and one interpretation.
- [ ] Splits reflect athlete units and interval structure where applicable.
- [ ] Trends compare meaningful comparable sessions rather than generating novelty scores.
- [ ] Elevation, cadence, power and form are collapsed by default unless profile/pinning rules apply.
- [ ] Advanced content lazy-loads without shifting or blocking initial content.
- [ ] Charts show units, summaries and missing-data states.
- [ ] Charts have accessible textual equivalents.

## 8. Reversible map-fade behaviour

- [ ] Map opacity is calculated from live scroll offset.
- [ ] Scrolling down progressively fades the map.
- [ ] Scrolling back restores it at the same offsets.
- [ ] There is no one-way completion flag controlling visibility.
- [ ] Parallax tracks the finger without spring lag.
- [ ] Map hit testing is disabled after it is substantially hidden.
- [ ] Sticky header title/material appears progressively.
- [ ] Reduce Motion removes parallax/scale while keeping a reversible crossfade.
- [ ] A single vertical scroll owner is used; there is no nested vertical-scroll conflict.

## 9. Content order and actions

- [ ] Order is Route → Metrics → Verdict → Evidence → Plan/Actual → Next Action → Analysis → Metadata → Share.
- [ ] Post-run RPE/discomfort check-in is short, skippable and editable.
- [ ] There is one Share entry point.
- [ ] Strava appears as a destination rather than a competing primary action.
- [ ] Share preview respects route privacy.
- [ ] Notes, shoes, source and sync state use compact rows rather than large competing cards.

## 10. Coaching correctness and trust

- [ ] Pain/discomfort overrides performance praise.
- [ ] Completion and the session's intended intensity determine the verdict before raw pace.
- [ ] Objective data and RPE disagreement is handled explicitly.
- [ ] Low-confidence GPS/HR produces cautious language.
- [ ] No injury, illness, dehydration or overtraining diagnosis is inferred from one activity.
- [ ] Every recommendation can identify its supporting evidence.
- [ ] Unplanned runs do not receive invented plan targets.
- [ ] Incomplete runs do not automatically receive make-up load.
- [ ] Generated text failure does not block deterministic summary information.

## 11. Responsive and adaptive states

- [ ] Beginner view keeps explanations visible and advanced charts collapsed.
- [ ] Intermediate view exposes useful splits/zones without specialist clutter.
- [ ] Advanced view can emphasise execution, drift and trends.
- [ ] Elite view can use profile-pinned metrics without moving the coaching verdict.
- [ ] Ability is taken from profile/history rules, not inferred from one activity.
- [ ] Planned complete, planned incomplete, unplanned, intervals, race/time trial, treadmill, weak GPS, missing HR and private route fixtures are covered.

## 12. Accessibility and appearance

- [ ] All interactive targets are at least 44 × 44 pt.
- [ ] No meaning or action depends on colour alone.
- [ ] Dynamic Type through Accessibility 2 does not clip or overlap.
- [ ] Large metrics reflow appropriately.
- [ ] VoiceOver order follows the coaching narrative.
- [ ] VoiceOver names chart metric, value, unit and context.
- [ ] Increase Contrast and Reduce Transparency remain usable.
- [ ] Light and dark appearances preserve hierarchy and contrast.
- [ ] Zone distinctions remain understandable in colour-vision-deficiency checks.

## 13. Performance

- [ ] Cached map snapshot is used for initial display where appropriate.
- [ ] First local summary is available without waiting for generated coaching.
- [ ] Scroll remains smooth at the supported refresh rate on a representative device.
- [ ] Long series are down-sampled for visible resolution.
- [ ] Advanced charts do not perform expensive work while collapsed.
- [ ] Loading placeholders are limited to genuinely pending content.

## 14. Final sign-off report

Claude must finish with:

```text
HR-zone source reused:
Files/components changed:
Target screenshots produced:
Automated tests:
Accessibility checks:
Performance checks:
Known deviations from reference:
Reason for each deviation:
```

`Known deviations` must say `None` only after visual comparison. Silence is not evidence; it is merely a very confident shrug.

