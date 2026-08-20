# Inte-Run Share Studio — release gate

Mark every item `PASS`, `FAIL` or `BLOCKED` and attach evidence paths. A blocked required item means the feature is not complete.

## A. Preflight and architecture

- [ ] Preflight names the existing editor, renderer, native bridge, share/save flow, data models, tokens and logo assets.
- [ ] One canonical `ShareCardModel` drives preview and export.
- [ ] Coaching copy is reused from the debrief/source-of-truth model.
- [ ] Existing architecture is extended rather than duplicated without justification.
- [ ] Feature flag/rollback follows project conventions.

## B. Four templates

- [ ] The Moment matches `01-the-moment-target.png` in hierarchy and tone.
- [ ] The Execution matches `02-the-execution-target.png` and uses real target data.
- [ ] The Route Poster matches `03-the-route-poster-target.png`; route is large, crisp and unglowed.
- [ ] The Progression matches `04-the-progression-target.png`; split scaling is honest.
- [ ] Templates look like one family and have distinct purposes.
- [ ] Real Inte-Run logo/wordmark asset is used unchanged.
- [ ] Chrome-gold appears only for a verified PB/milestone and never on the logo.

## C. Photo and collision safety

- [ ] Portrait, landscape and square source photos crop without distortion.
- [ ] Face/person detection is local or conservative fallback is used.
- [ ] No route, text or chart crosses a detected face.
- [ ] Main body is avoided where a viable safe zone exists.
- [ ] Crop/zoom persists independently per template/aspect.
- [ ] Drag, pinch and reset behave predictably.
- [ ] Text contrast remains readable over bright, dark and mixed photographs.
- [ ] No-photo and photo-decode-failure states are intentional and never striped/blank.

## D. Data truth

- [ ] Example values exist only in preview/test fixtures.
- [ ] Metric units, precision, date and location are locale-aware.
- [ ] Missing values are omitted/reflowed, never displayed as zero.
- [ ] The Execution is unavailable without a valid target.
- [ ] The Progression is unavailable without sufficient comparable splits.
- [ ] Claims such as `NAILED THE BRIEF`, `STEADY & CONTROLLED` and `FINISHED STRONG` appear only when supported.
- [ ] Low-confidence data cannot produce a high-confidence claim.
- [ ] Interval sessions use repetitions rather than arbitrary kilometre target points.

## E. Route and privacy

- [ ] Route redaction occurs before display/export.
- [ ] Hidden start/end defaults on when route is enabled.
- [ ] Route, start/end, location and date controls update preview/export identically.
- [ ] Only coarse location is displayed.
- [ ] Export contains no location EXIF or hidden sensitive metadata.
- [ ] No-route/indoor sessions show no fake route.
- [ ] Route remains recognisable, correctly oriented and crisp.

## F. Editor UX

- [ ] Large preview remains the dominant editor element.
- [ ] Template carousel shows current selection and adjacent options clearly.
- [ ] Story/Feed switching is immediate and retains compatible edits.
- [ ] Photo, Route, Metrics, Style and Privacy controls are understandable.
- [ ] Ineligible templates explain or gracefully reflect missing requirements.
- [ ] One clear primary Continue/Share action exists.
- [ ] System share and Save to Photos/device work; unavailable third-party apps do not break the flow.
- [ ] Global bottom navigation is hidden while editing.

## G. Exact export verification

- [ ] Story export is exactly `1080 × 1920`.
- [ ] Feed export is exactly `1080 × 1350`.
- [ ] Square, if shipped, is exactly `1080 × 1080`.
- [ ] Aspect layouts reflow; Feed/Square are not cropped Story images.
- [ ] Export is sRGB and visually matches preview.
- [ ] No editor handles, safe guides, controls or platform icons appear in export.
- [ ] Type, route and charts remain sharp at 100% inspection.
- [ ] Photo export quality avoids obvious banding/blocking at normal social compression.
- [ ] Export does not depend on screen size or `devicePixelRatio`.

## H. Visual comparison evidence

- [ ] 9:16 screenshot/export for each template attached.
- [ ] 4:5 screenshot/export for each template attached.
- [ ] Overlay/diff comparison against each target attached.
- [ ] Bright-photo and dark-photo contrast examples attached.
- [ ] Route placed left and right of different subjects attached.
- [ ] Every material deviation is listed with a reason.
- [ ] No huge empty region, outer card border, neon glow, text collision, duplicate metric or unlabelled chart remains.

## I. Accessibility, performance and tests

- [ ] Editor supports Dynamic Type without blocking essential controls.
- [ ] VoiceOver announces template, aspect and meaningful preview summary.
- [ ] Controls meet 44 × 44 pt minimum targets.
- [ ] Reduce Motion is respected.
- [ ] Unit tests cover template eligibility, verdict gating, metric fallback, route privacy and split selection.
- [ ] Snapshot/visual tests cover every template/aspect and missing-data state.
- [ ] Repeated switching/cropping does not leak memory or leave stale renders.
- [ ] Real-device photo pick, save, system share and Instagram Story handoff are tested where available.

## Evidence table

| Evidence | Path / result | Status |
|---|---|---|
| Preflight report |  |  |
| 9:16 exports |  |  |
| 4:5 exports |  |  |
| Visual diffs |  |  |
| Privacy/metadata test |  |  |
| Automated tests |  |  |
| Real-device share test |  |  |
| Deviations/blockers |  |  |
