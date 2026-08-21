import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gate, evidenceDir, imageSize, imageKind, jpegSegments, jpegQuantTables, iccInfo,
  exifInfo, sha, GATE_CASES, GATE_ASPECTS, type Gate } from "./share-export-harness.ts";

/** The app's own source, for the constants a byte-level claim has to be stated against. */
const appSrc = () => readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");

/**
 * SECTION G OF THE RELEASE GATE — THE PRODUCED BYTES.
 *
 * ⚠️ EVERY ASSERTION IN THIS FILE IS ON AN ENCODED FILE, NOT ON A CONSTANT IN THE SOURCE. The
 * preflight recorded that nothing anywhere in the suite had ever looked at one:
 * test/share-render.test.ts proves cardGeom answers 1080x1920, which is a different claim from the
 * JPEG's own frame header saying 1080x1920. Between the two sit canvas.width, the 2D context, toBlob,
 * the platform's colour management and whatever it decides to embed — and that gap is where every
 * fault this gate exists to catch actually lives.
 *
 * ⚠️ THE WHOLE FILE READS ONE CAPTURE, TAKEN ONCE IN A `before` HOOK. Sixteen cards, a quality ladder,
 * three screen sizes and five privacy states through the real renderer and the real encoder, in about
 * three and a half seconds. If the capture cannot happen the hook throws and node fails EVERY test in
 * the file — measured, nineteen failures — each carrying the reason and the command that fixes it.
 * Noisy, and correct: nothing here is allowed to pretend it checked something.
 *
 * ⚠️ AND IT NEEDS A HEADLESS BROWSER, WHICH IS A DEPENDENCY THIS SUITE DID NOT PREVIOUSLY HAVE.
 * See share-export-harness.ts for why that is a hard failure rather than a skip. The rest of section G
 * — the mechanism, the filename, the reflow arithmetic — is in test/share-export.test.ts and needs
 * nothing but node, so a machine with no browser still gets that half.
 */

let G: Gate;
before(async () => { G = await gate(); }, { timeout: 180000 });

const STORY: [number, number] = [1080, 1920];
const FEED: [number, number] = [1080, 1350];
/**
 * ⚠️ A TABLE RATHER THAN A TERNARY, AND IT STAYS ONE NOW THERE ARE TWO. Written as "story or not story"
 * every future shape would be measured against the feed's 1350; written as "feed or story" every one
 * would be measured against 1920. Both are wrong in a way the table cannot express, and a third shape
 * existed here for a day, which is how the shape of that mistake is known.
 */
const WANT: Record<string, [number, number]> = { story: STORY, feed: FEED };
const want = (aspect: string) => WANT[aspect] || STORY;
const shots = () => [...G.shots.values()];

/* ================================================================================================ *
 * THE HARNESS PROVES ITSELF FIRST                                                                  *
 * ================================================================================================ */

test("BLOCKER: the lift really ran the app's own model builder, so nothing below is measuring a stub", () => {
  // ⚠️ A SWEEP THAT READS THE WRONG FIELD REPORTS CLEAN, and a harness whose globals are stubbed
  // wrongly produces a plausible model that is not the app's. This is the discriminator: every value
  // here is one only shareCardModel can produce, from the run record in share-export-harness.ts.
  const p = G.modelProbe;
  assert.ok(G.lifted.fns.length > 80, "the lift collected only " + G.lifted.fns.length + " functions");
  assert.equal(p.units, "metric", "the model's units field is not the app's literal");
  assert.equal(p.place, "Durham",
    "coarseLocation is " + JSON.stringify(p.place) + " — the fixture's place is a three-part string, so " +
    "anything but the coarse first part means the model builder did not run");
  assert.equal(p.dateLabel, "17 Aug 2026", "the date label is not the app's own formatting");
  assert.equal(p.verdictState, "achieved", "the verdict did not come from runVerdict");
  assert.deepEqual(p.metricKeys, ["time", "pace", "elev"], "the metric ladder did not run");
  assert.deepEqual(p.statKeys, ["dist", "time", "pace"], "the data-led metric row did not run");
  assert.equal(p.bandMin, 320, "runAnalysis did not read the run's prescribed band");
  assert.deepEqual([p.n, p.inBand], [6, 6], "the splits were not judged against the band");
  // and the route came back REDACTED, which is the app's own privacy default doing its work
  assert.ok(p.routeN > 0 && p.routeN < p.rawRouteN,
    "the model's route is " + p.routeN + " of " + p.rawRouteN + " points — end redaction did not run");
});

test("BLOCKER: the source photograph genuinely carries GPS metadata, so the metadata guard can see one", () => {
  // ⚠️ WITHOUT THIS, "THE EXPORT HAS NO GPS" IS UNFALSIFIABLE. A parser that finds nothing in a file
  // that contains nothing has proved only that it agrees with itself.
  const e = G.sourcePhoto.exif;
  assert.equal(e.app1, true, "the source photograph carries no Exif block at all");
  assert.equal(e.gps, true, "the source photograph carries no GPS IFD");
  assert.deepEqual(e.gpsTags.sort((a, b) => a - b), [0x0000, 0x0001, 0x0002, 0x0003],
    "the source's GPS IFD is not the version, the two hemisphere refs and the latitude");
  assert.deepEqual(imageSize(G.sourcePhoto.bytes), [1200, 1800], "the source photograph is not the fixture");
});

/* ================================================================================================ *
 * DIMENSIONS                                                                                       *
 * ================================================================================================ */

test("BLOCKER: Story is exactly 1080x1920 and Feed exactly 1080x1350, in the BYTES", () => {
  const bad: string[] = [];
  for (const s of shots()) {
    const sz = imageSize(s.bytes);
    const w = want(s.aspect);
    if (!sz || sz[0] !== w[0] || sz[1] !== w[1]) {
      bad.push(s.key + ": the file's own header says " + (sz ? sz.join("x") : "nothing readable") +
        ", wanted " + w.join("x"));
    }
    // and the canvas it came off agreed, so the encoder did not resize on the way out
    assert.deepEqual(s.canvas, w, s.key + ": the canvas was " + s.canvas.join("x"));
  }
  assert.deepEqual(bad, []);
  // ⚠️ EVERY CASE, EVERY ASPECT, BOTH FIT MODES — derived rather than counted. The owner's photo-fit
  // ruling made two pictures out of one, and a gate that measured only the default would leave the opt-in
  // cover crop — which every runner with a panorama will reach for — with no proof of its own dimensions
  // at all. A fixed number would silently stop covering a shape or a case.
  const wantShots = GATE_CASES.length * GATE_ASPECTS.length * 2;
  assert.equal(shots().length, wantShots,
    "the capture is missing cards: " + shots().length + " of " + wantShots);
  // ⚠️ AND EVERY SHAPE HAS TO BE PRESENT, not merely counted. A count is satisfied by twice as many
  // stories, which is exactly what a broken aspect list produces.
  for (const a of GATE_ASPECTS) {
    const n = shots().filter((s) => s.aspect === a).length;
    assert.equal(n, GATE_CASES.length * 2, "only " + n + " captures at " + a);
    assert.ok(shots().some((s) => s.aspect === a && imageSize(s.bytes)![1] === want(a)[1]),
      "no export at " + a + " has that shape's own height");
  }
});

test("BLOCKER: both fit modes are captured, differ from each other, and the fit reaches the card", () => {
  // ⚠️ THE FIT IS REPORTED FROM THE MODEL'S OWN PHOTO, not echoed back from the argument, so a fit that
  // never reaches the renderer is visible here rather than assumed. This is the seam that broke once
  // already: shareCardModel reads the fit out of the framing store, so a photograph handed in as an
  // option carries none and every card comes out at the default.
  for (const s of shots()) {
    if (s.drawn === "route") continue;              // the poster carries no photograph
    assert.equal(s.fill, s.fit === "fill",
      s.key + ": asked for the " + s.fit + " fit and the model drew fill=" + s.fill);
  }
  // ⚠️ AND THE TWO MODES MUST PRODUCE DIFFERENT PICTURES. A toggle that renders an identical card is the
  // looks-live-does-nothing class this project has shipped three times — and a dimension guard cannot
  // see it, because both files are correctly 1080 wide.
  for (const c of GATE_CASES) {
    if (c.template === "route") continue;
    for (const aspect of GATE_ASPECTS) {
      const a = G.shots.get(c.name + "/" + aspect)!, b = G.shots.get(c.name + "/" + aspect + "/fill")!;
      assert.ok(a && b, "a fit mode is missing for " + c.name + "/" + aspect);
      assert.notEqual(sha(a.bytes), sha(b.bytes),
        c.name + "/" + aspect + ": the whole-photo and fill cards are byte-identical");
      // The default shows MORE of the photograph, so the pictures differ over a real area rather than
      // in a corner: at least a tenth of the coarse signature has to move.
      const moved = a.sig.filter((v, i) => Math.abs(v - b.sig[i]!) > 0.02).length / a.sig.length;
      assert.ok(moved > 0.10, c.name + "/" + aspect + ": only " + (moved * 100).toFixed(1) +
        "% of the card changed between the fit modes, which is not a change of fit");
    }
  }
});

test("BLOCKER: all four templates reach both aspects, and no card silently fell back to another", () => {
  // ⚠️ A DIMENSION GUARD PASSES WHATEVER WAS DRAWN. Correctly sized pictures of the wrong
  // template would satisfy every assertion above, so the gate has to say which template it got.
  //
  // ⚠️ AND ASKING THE MODEL WAS NOT ENOUGH — WATCHED. `drawn` is the model's answer, so a first version
  // of this guard passed with drawShareCard's poster branch rewired to draw The Moment: the model still
  // said "route" and the picture was somebody else's. The claim has to be checked against the artefact,
  // so each template's own picture is required to be unlike the other three at the same aspect.
  for (const c of GATE_CASES) {
    for (const aspect of GATE_ASPECTS) {
      const s = G.shots.get(c.name + "/" + aspect)!;
      assert.ok(s, "no capture for " + c.name + "/" + aspect);
      assert.equal(s.drawn, c.template,
        c.name + "/" + aspect + " asked for " + c.template + " and the model answered " + s.drawn +
        " (" + c.why + ")");
    }
  }
  const drawn = new Set(shots().map((s) => s.drawn));
  for (const t of ["moment", "execution", "progression", "route"]) {
    assert.ok(drawn.has(t), t + " was never drawn by the gate at all");
  }
  for (const aspect of GATE_ASPECTS) {
    const four = ["moment", "execution", "progression", "route"]
      .map((t) => ({ t, sha: sha(G.shots.get(t + "/" + aspect)!.bytes) }));
    const dupes = four.filter((a, i) => four.findIndex((b) => b.sha === a.sha) !== i);
    assert.deepEqual(dupes.map((d) => d.t), [],
      aspect + ": a template drew a picture identical to another template's, which is a silent " +
      "fallback whatever the model said: " + four.map((f) => f.t + "=" + f.sha).join(", "));
  }
});

/* ================================================================================================ *
 * THE EXPORT DOES NOT DEPEND ON THE SCREEN                                                         *
 * ================================================================================================ */

test("BLOCKER: the same card exports byte-for-byte identically on three different screens", () => {
  // ⚠️ THE BRIEF FORBIDS devicePixelRatio AS THE EXPORT CONTRACT IN AS MANY WORDS, and the way that
  // fault ships is invisible: it looks right on the phone it was written on. Measured across a 320pt
  // 1x window, a 430pt 3x phone and a 1440pt 2x desktop, the bytes do not move at all — which is a
  // stronger statement than "the dimensions are the same", because it also rules out the composition
  // being laid out against the viewport.
  assert.equal(G.dprShots.length, 3, "the screen sweep did not run");
  const hashes = new Set(G.dprShots.map((d) => d.sha));
  assert.equal(hashes.size, 1,
    "the export changed with the screen: " + G.dprShots.map((d) => d.label + "=" + d.sha).join(", "));
  for (const d of G.dprShots) assert.deepEqual(d.size, STORY, d.label + " exported " + d.size);
});

/* ================================================================================================ *
 * ENCODING, QUALITY AND COLOUR                                                                     *
 * ================================================================================================ */

test("BLOCKER: every export is a real JPEG and carries a complete frame", () => {
  // ⚠️ EVERY ONE, WITH NO PER-TEMPLATE ALLOWANCE. The spec permits PNG for the poster — "PNG is
  // acceptable when file size remains practical" — and this app measured it and declined: at 1080x1920
  // the photo-free poster is 158 KB as JPEG against 1,437 KB as PNG, because the radial gradients make
  // PNG nine times larger. So there is one encoding, and asserting it exhaustively is what couples this
  // guard to SHARE_EXPORT: taking the allowance later means changing both, deliberately.
  // ⚠️ AND imageKind CAN STILL RECOGNISE A PNG, which is what makes "it is a JPEG" falsifiable rather
  // than a parser agreeing with itself.
  for (const s of shots()) {
    const kind = imageKind(s.bytes);
    assert.equal(kind, "jpeg", s.key + " is a " + kind + ", and every export must be JPEG");
    assert.equal(s.type, "image/jpeg", s.key + ": the File's declared type is " + s.type);
    const segs = jpegSegments(s.bytes)!;
    assert.ok(segs.some((x) => x.marker === 0xda), s.key + " has no start-of-scan, so it is truncated");
    assert.equal(s.bytes.readUInt16BE(s.bytes.length - 2), 0xffd9,
      s.key + " does not end in an end-of-image marker, so the file is cut short");
    assert.ok(s.bytes.length > 20000, s.key + " is only " + s.bytes.length +
      " bytes, which is too small to be a composed 1080-wide card");
  }
});

test("BLOCKER: the quality read out of the quantisation tables is inside the spec's 0.90-0.94", () => {
  // ⚠️ THE QUALITY IS RECOVERED FROM THE BYTES, NOT READ OFF THE CALL SITE. A JPEG records the quality
  // it was written at in its quantisation tables, so encoding one canvas across a ladder of qualities
  // and matching the export against it identifies the setting from the artefact. Measured: the six
  // rungs 0.80 / 0.86 / 0.90 / 0.92 / 0.94 / 0.98 all produce DIFFERENT tables, so the match
  // discriminates — which is the half a fingerprint test usually forgets to prove.
  const key = (t: number[][]) => t.map((x) => x.join(",")).join("|");
  const rungs = new Map(G.quality.map((q) => [q.q, key(q.tables)]));
  assert.equal(new Set(rungs.values()).size, rungs.size,
    "two rungs of the quality ladder produced identical tables, so matching one proves nothing");
  const inBand = G.quality.filter((q) => q.q >= 0.90 && q.q <= 0.94).map((q) => key(q.tables));
  const outOfBand = G.quality.filter((q) => q.q < 0.90 || q.q > 0.94);
  assert.ok(inBand.length >= 2 && outOfBand.length >= 2, "the ladder does not straddle the spec's band");
  for (const s of shots()) {
    if (imageKind(s.bytes) !== "jpeg") continue;
    const mine = key(jpegQuantTables(s.bytes));
    assert.ok(inBand.includes(mine), s.key + " was not encoded at a quality between 0.90 and 0.94");
    for (const o of outOfBand) {
      assert.notEqual(mine, key(o.tables), s.key + " was encoded at " + o.q + ", outside the spec's band");
    }
  }
});

test("BLOCKER: no export can be read as a wide gamut, and every JPEG says sRGB in a profile", () => {
  // The spec asks for sRGB. An untagged file is interpreted by whatever opens it, and a Display-P3
  // one posted to a platform that assumes sRGB comes back oversaturated — so the honest check is that
  // the file SAYS what it is, in a profile a reader will find.
  for (const s of shots()) {
    if (imageKind(s.bytes) !== "jpeg") continue;
    const icc = iccInfo(s.bytes);
    assert.equal(icc.present, true, s.key + " carries no colour profile at all");
    assert.equal(icc.space, "RGB ", s.key + "'s profile is not an RGB one: " + JSON.stringify(icc.space));
    assert.equal(icc.klass, "mntr", s.key + "'s profile is not a display profile: " + icc.klass);
    assert.match(String(icc.desc), /sRGB/i,
      s.key + "'s embedded profile describes itself as " + JSON.stringify(icc.desc) + ", not sRGB");
    assert.ok(!/P3|2020|Adobe|ProPhoto/i.test(String(icc.desc)),
      s.key + " is tagged with a wide-gamut profile: " + icc.desc);
  }
});

/* ================================================================================================ *
 * METADATA                                                                                         *
 * ================================================================================================ */

test("BLOCKER: no export carries an Exif block, a GPS IFD or any other metadata segment", () => {
  // ⚠️ THE SOURCE PHOTOGRAPH THIS WAS COMPOSED FROM CARRIES REAL GPS COORDINATES (asserted above), so
  // this is a measurement of the pipeline rather than of an empty file. The reason it holds is
  // structural — the export is a fresh canvas, and drawImage copies pixels and not tags — but
  // "structurally impossible" is exactly the kind of claim that stops being true when somebody adds a
  // fast path that hands the original file through, which is a plausible optimisation for a card whose
  // photograph fills the frame.
  const allowed = new Set([0xe0, 0xe2, 0xdb, 0xc0, 0xc1, 0xc2, 0xc4, 0xda, 0xdd]);
  for (const s of shots()) {
    if (imageKind(s.bytes) !== "jpeg") continue;
    const e = exifInfo(s.bytes);
    assert.equal(e.app1, false, s.key + " carries an Exif APP1 block: ifds " + e.ifds.join(","));
    assert.equal(e.gps, false, s.key + " carries a GPS IFD: tags " + e.gpsTags.join(","));
    // and nothing else either: no XMP, no Photoshop IRB, no comment
    const extra = jpegSegments(s.bytes)!.filter((x) => !allowed.has(x.marker))
      .map((x) => "FF" + x.marker.toString(16).toUpperCase());
    assert.deepEqual(extra, [], s.key + " carries unexpected metadata segments: " + extra.join(","));
    // ⚠️ AND THE COORDINATES ARE NOT IN THE FILE IN ANY OTHER FORM. The fixture's route is around
    // 54.68 N, 1.21 W; a latitude printed as text or stashed in a comment would pass every check above.
    const text = s.bytes.toString("latin1");
    for (const needle of ["54.68", "-1.21", "GPSLatitude", "geo:", "http://ns.adobe.com/xap"]) {
      assert.ok(!text.includes(needle), s.key + " contains the string " + JSON.stringify(needle));
    }
  }
});

test("BLOCKER: the export's own filename is the only place a date appears, and the switch removes it", () => {
  // ⚠️ THIS PATH IS GUARDED TWICE AND THIS TEST CAN ONLY SEE THE PAIR — WATCHED, AND WORTH KNOWING.
  // shareCardModel returns an empty completedAt when the date is hidden, AND shareFileName refuses to
  // print one; deleting either alone leaves the filename dateless, so removing the filename's own gate
  // failed nothing here. The per-gate proof is in test/share-export.test.ts, which calls shareFileName
  // with a date in hand. What this end-to-end version adds is the upstream gate, pinned below.
  const shown = G.privacyShots.find((p) => p.label === "route, ends hidden")!;
  const hidden = G.privacyShots.find((p) => p.label === "date hidden")!;
  assert.match(shown.file, /InteRun-2026-08-17-/, "the visible-date card's filename lost its date: " + shown.file);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(hidden.file),
    "hiding the date left it in the filename: " + hidden.file);
  assert.equal(hidden.file, "InteRun-Easy-run-6.31km.jpg");
  for (const s of shots()) {
    assert.match(s.file, /^InteRun-/, s.key + "'s file is not brand-first: " + s.file);
    assert.ok(!/Durham|County|England/i.test(s.file), s.key + "'s file names a place: " + s.file);
  }
  // The two gates, asserted apart, so this test is sensitive to each of them rather than to the pair.
  assert.equal(shown.completedAt, "2026-08-17",
    "with the date visible the model does not carry it (" + JSON.stringify(shown.completedAt) +
    "), so the filename has nothing to lose and the switch cannot be seen to work");
  assert.equal(hidden.completedAt, "",
    "the model still carries the instant with the date hidden: " + JSON.stringify(hidden.completedAt));
  assert.equal(hidden.dateLabel, "", "the card still prints a date with the date hidden");
  assert.notEqual(shown.dateLabel, "", "the card prints no date even with the date visible");
});

/* ================================================================================================ *
 * PRIVACY CHANGES THE PIXELS                                                                       *
 * ================================================================================================ */

test("BLOCKER: the three route-privacy states produce three different pictures", () => {
  // ⚠️ DRIVEN THROUGH THE APP'S OWN PRIVACY RECORD, NOT BY HANDING THE RENDERER THREE ROUTES. The
  // harness writes SHAREPRIV and lets sharePrivacyFor and runRoutePresentation decide, so what is
  // measured is the switch a runner actually flips. A privacy feature that reaches the preview and not
  // the export is the worst possible way for one to fail, and it cannot be seen from a screenshot of
  // the editor.
  const ends = G.privacyShots.find((p) => p.label === "route, ends shown")!;
  const trim = G.privacyShots.find((p) => p.label === "route, ends hidden")!;
  const off = G.privacyShots.find((p) => p.label === "route hidden")!;
  assert.equal(new Set([ends.sha, trim.sha, off.sha]).size, 3,
    "two of the three route states exported the same bytes: " +
    [ends, trim, off].map((p) => p.label + "=" + p.sha).join(", "));
  // and the geometry moved in the direction the names promise
  assert.equal(ends.routeN, 61, "the ends-shown state did not carry the whole route");
  assert.ok(trim.routeN > 2 && trim.routeN < ends.routeN,
    "hiding the ends left " + trim.routeN + " of " + ends.routeN + " points");
  assert.equal(off.routeN, 0, "hiding the route left " + off.routeN + " points on the card");
});

test("BLOCKER: Hide location and Hide date each change the exported bytes on their own", () => {
  // ⚠️ ONE AT A TIME, BECAUSE A SWITCH THAT DOES NOTHING IS INVISIBLE BESIDE ONE THAT DOES. Both of
  // these are text on the card, so a change that reached the model and not the renderer would leave
  // the picture identical while the editor showed the switch as on.
  const base = G.privacyShots.find((p) => p.label === "route, ends hidden")!;
  for (const label of ["location hidden", "date hidden"]) {
    const s = G.privacyShots.find((p) => p.label === label)!;
    assert.notEqual(s.sha, base.sha, label + " did not change the exported bytes at all");
    // and it changed the picture rather than only its metadata: the signature has to move
    const moved = s.sig.reduce((n, v, i) => n + (Math.abs(v - base.sig[i]!) > 0.004 ? 1 : 0), 0);
    assert.ok(moved > 0, label + " changed the bytes but not one cell of the picture");
  }
  // all five states are distinct pictures, so no pair of switches cancels out
  const all = G.privacyShots.map((p) => p.sha);
  assert.equal(new Set(all).size, all.length,
    "two privacy states exported the same picture: " +
    G.privacyShots.map((p) => p.label + "=" + p.sha).join(", "));
});

/* ================================================================================================ *
 * THE FEED IS A REFLOW, MEASURED ON THE PICTURES                                                   *
 * ================================================================================================ */

/** Resample a row profile over the normalised window [a, a + span]. */
function resample(prof: number[], a: number, span: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = a + span * (i / (n - 1));
    const p = t * (prof.length - 1), lo = Math.floor(p), hi = Math.min(prof.length - 1, lo + 1);
    const f = p - lo;
    out.push(prof[lo]! * (1 - f) + prof[hi]! * f);
  }
  return out;
}
function rms(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(s / a.length);
}
/** The best any crop or uniform scale of `story` can do at explaining `other`. */
function bestAffine(story: number[], other: number[]): number {
  let best = Infinity;
  for (let span = 0.50; span <= 1.0001; span += 0.01) {
    for (let a = 0; a + span <= 1.0001; a += 0.005) {
      const r = rms(resample(story, a, span, other.length), other);
      if (r < best) best = r;
    }
  }
  return best;
}

test("BLOCKER: the Feed export is a recomposition, not a crop or a scale of the Story", () => {
  // ⚠️ THE THRESHOLD IS A MEASURED CONTROL, NOT A NUMBER CHOSEN BY TASTE. For each template and each
  // shorter shape the gate builds the two things the contract forbids — a centre crop of the story to
  // that shape, and a uniform squash of it — and measures how well the best crop-or-scale explains
  // each. The controls come back at 0.0000 (the squash, by construction) and 0.0047-0.0074 (the crop,
  // whose residual is only the resampling). The real reflows measure far above that, so the bar is set
  // at three times the control rather than at a figure that happens to pass today.
  //
  // ⚠️ THE LAZY SHORTER SHAPE IS EXACTLY A CENTRE CROP OF A STORY — it needs no new type scale and no
  // shorter ladder, and it looks plausible until you notice the wordmark has gone. The contract's words
  // are "Recompose, do not crop the Story output".
  const rows: string[] = [];
  for (const t of ["moment", "execution", "progression", "route"]) {
    const story = G.shots.get(t + "/story")!.rows;
    for (const aspect of GATE_ASPECTS) {
      if (aspect === "story") continue;
      const other = G.shots.get(t + "/" + aspect)!.rows;
      const h = imageSize(G.shots.get(t + "/" + aspect)!.bytes)![1] / 1920;
      assert.equal(story.length, other.length, "the two profiles are not comparable");
      const crop = resample(story, (1 - h) / 2, h, other.length);
      const squash = resample(story, 0, 1, other.length);
      const control = Math.max(bestAffine(story, crop), bestAffine(story, squash), 0.001);
      const actual = bestAffine(story, other);
      rows.push(t + "/" + aspect + " " + actual.toFixed(4) + " vs control " + control.toFixed(4));
      assert.ok(actual > control * 3,
        t + "/" + aspect + ": it is explained by a crop or a scale of the story — residual " +
        actual.toFixed(4) + " against a control of " + control.toFixed(4) +
        ". The contract says recompose, do not crop.");
    }
  }
  assert.equal(rows.length, 4 * (GATE_ASPECTS.length - 1),
    "not every template and shape was compared: " + rows.join("; "));
});

/* ================================================================================================ *
 * VISUAL COVERAGE — EVERY TEMPLATE, EVERY ASPECT, EVERY MISSING-DATA STATE                         *
 * ================================================================================================ */

/**
 * ⚠️ INVARIANTS, NOT A GOLDEN FILE, AND THE CHOICE IS DELIBERATE. Checklist section I asks for
 * "snapshot/visual tests covering every template/aspect and missing-data state". A committed baseline
 * image would fail on a Chrome upgrade, a font substitution or a one-pixel move, so its failure would
 * mean "something changed" rather than "something is wrong" — and a test whose failures are usually
 * noise is a test people learn to re-baseline without reading. What is pinned instead is every
 * property a broken render actually violates: the card is not blank, not flat, not half empty, has ink
 * where the composition puts it, and is a different picture from the states it should differ from. The
 * exports themselves are written to disk every run as the attachable evidence section H asks for.
 */
function stats(v: number[]) {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return { mean, sd, min: Math.min(...v), max: Math.max(...v) };
}

test("BLOCKER: every template, aspect and missing-data state renders a composed card, never a blank one", () => {
  // Measured over the sixteen: sd 0.070 (the dark poster) to 0.273, spread 0.31 to 0.86. The floors
  // are set under the poster, which is the least contrasty card the app can legitimately draw.
  for (const s of shots()) {
    const q = stats(s.sig);
    assert.ok(q.sd > 0.04, s.key + " is nearly flat (sd " + q.sd.toFixed(3) +
      "), which is what a blank or single-colour card looks like");
    assert.ok(q.max - q.min > 0.20, s.key + " has a luminance spread of only " +
      (q.max - q.min).toFixed(3) + ", so nothing is legible on it");
    assert.ok(q.mean > 0.02 && q.mean < 0.98, s.key + " is uniformly black or white (mean " +
      q.mean.toFixed(3) + ")");
    // ⚠️ AND NO STRIPES. The brief names "broken/striped or blank photo regions" as a defect that
    // shipped; a decode that half-failed leaves rows of one repeated value.
    const rows = s.rows, runs: number[] = [];
    let run = 1;
    for (let i = 1; i < rows.length; i++) {
      if (Math.abs(rows[i]! - rows[i - 1]!) < 0.0005) run++;
      else { runs.push(run); run = 1; }
    }
    runs.push(run);
    assert.ok(Math.max(...runs) < rows.length * 0.5, s.key + " has " + Math.max(...runs) +
      " of " + rows.length + " identical rows in a row, which reads as a broken region");
  }
});

test("BLOCKER: no card leaves a whole quarter of the canvas empty", () => {
  // The brief's "no huge unused space". Judged on the 12x16 grid: a quarter of the canvas with no
  // variation in it at all is either a hole in the composition or a region nothing was drawn into.
  //
  // ⚠️ THE FLOOR IS HALF THE MEASURED MINIMUM, AND THE FIRST VALUE WAS SET FROM TASTE AND CAUGHT
  // NOTHING. Across the sixteen the quietest quarter measures 0.0228 (the route poster's top quarter on
  // a feed post, which is the ground, the wordmark and the start of the route); the busiest measures
  // 0.2476. shareGroundFill is a FLAT fill, so a genuinely empty quarter reads as very nearly 0.0000 —
  // and a threshold of 0.004 sat far below anything the app draws, which is why disabling the poster's
  // whole topographic texture did not trip it.
  for (const s of shots()) {
    const GX = 12, GY = 16;
    let worst = Infinity, at = "";
    for (const [y0, y1, name] of [[0, 4, "top quarter"], [4, 8, "second quarter"],
      [8, 12, "third quarter"], [12, 16, "bottom quarter"]] as [number, number, string][]) {
      const band: number[] = [];
      for (let y = y0; y < y1; y++) for (let x = 0; x < GX; x++) band.push(s.sig[y * GX + x]!);
      const sd = stats(band).sd;
      if (sd < worst) { worst = sd; at = name; }
    }
    assert.ok(worst > 0.012, s.key + "'s " + at + " is empty (sd " + worst.toFixed(4) +
      ", against a measured minimum of 0.0228 across the sixteen)");
  }
  assert.equal(shots().length, GATE_CASES.length * GATE_ASPECTS.length * 2,
    "the quarter sweep did not see every card: " + shots().length);
});

test("BLOCKER: the four templates are four different pictures in every aspect", () => {
  for (const aspect of GATE_ASPECTS) {
    const four = ["moment", "execution", "progression", "route"]
      .map((t) => ({ t, sha: sha(G.shots.get(t + "/" + aspect)!.bytes) }));
    assert.equal(new Set(four.map((f) => f.sha)).size, 4,
      aspect + ": two templates exported the same picture: " +
      four.map((f) => f.t + "=" + f.sha).join(", "));
  }
  // every card differs between every pair of shapes, which is the reflow arriving in the file
  for (const c of GATE_CASES) {
    const hashes = GATE_ASPECTS.map((a) => ({ a, sha: sha(G.shots.get(c.name + "/" + a)!.bytes) }));
    assert.equal(new Set(hashes.map((h) => h.sha)).size, GATE_ASPECTS.length,
      c.name + " exported the same bytes for two different shapes: " +
      hashes.map((h) => h.a + "=" + h.sha).join(", "));
  }
});

test("the missing-data states are distinct where they should be, and identical where that is correct", () => {
  // ⚠️ TWO OF THE SIXTEEN ARE LEGITIMATELY THE SAME PICTURE, AND SAYING SO IS BETTER THAN A LOOSER
  // GUARD. A pain-flagged run and a run with no prescribed band both suppress the verdict badge, and
  // The Moment prints no target — so once the badge is gone there is nothing left for the two to
  // disagree about. Measured, they are byte-identical in both aspects. Naming the pair means a future
  // change that made any OTHER pair collapse still fails.
  const named = new Map<string, string[]>();
  for (const s of shots()) {
    const h = sha(s.bytes);
    if (!named.has(h)) named.set(h, []);
    named.get(h)!.push(s.key);
  }
  const collisions = [...named.values()].filter((v) => v.length > 1).map((v) => v.sort().join(" = "));
  // ⚠️ AND THE ROUTE POSTER IS THE SAME PICTURE IN BOTH FIT MODES, WHICH IS THE FIT RULING'S OWN
  // CONSEQUENCE RATHER THAN A FAULT. That template carries no photograph at all, so there is nothing for
  // a fit to change — and a poster that DID move would mean the fit had reached something it has no
  // business touching. Naming it here makes that an assertion instead of an omission.
  // ⚠️ AND THE PHOTO-FREE POSTER IS THE SAME PICTURE IN BOTH FIT MODES, WHICH IS A CONSEQUENCE OF THE
  // FIT RULING RATHER THAN A FAULT: that case carries no photograph, so there is nothing for a fit to
  // change. The poster WITH a photograph is not in this list, which is the owner's 2026-08-20 ruling
  // showing up in the bytes — before it, the poster ignored a picture and the two modes collapsed.
  assert.deepEqual(collisions.sort(),
    ["no-target/feed = no-verdict/feed",
      "no-target/feed/fill = no-verdict/feed/fill",
      "no-target/story = no-verdict/story",
      "no-target/story/fill = no-verdict/story/fill",
      "route-bare/feed = route-bare/feed/fill",
      "route-bare/story = route-bare/story/fill"],
    "the set of cards that export identical pictures changed: " + collisions.join("; "));
  // and each state differs from the ideal card it was derived from, so none of them is a no-op fixture
  for (const name of ["no-verdict", "no-route", "no-target", "few-splits"]) {
    for (const aspect of GATE_ASPECTS) {
      assert.notEqual(sha(G.shots.get(name + "/" + aspect)!.bytes),
        sha(G.shots.get("moment/" + aspect)!.bytes),
        name + "/" + aspect + " is the same picture as the ideal card, so the state was never exercised");
    }
  }
});

test("BLOCKER: the card with no eligible template cannot become a file at all", () => {
  // ⚠️ THE PLACEHOLDER CARRIES A SENTENCE AND MUST NEVER BE SOMETHING SOMEBODY POSTS. Its trigger changed
  // with ruling 7: a missing photograph no longer refuses anything, so the only run that fits none of the
  // four is one carrying neither a distance nor a time nor a split nor a route. The model answers null and
  // the export path refuses.
  assert.equal(G.refused.placeholder, true,
    "a run with no distance, no time, no splits and no route still resolved to a template");
  assert.match(G.refused.reason, /distance/i,
    "the editor gives no reason in words for the missing template: " + JSON.stringify(G.refused.reason));
  // ⚠️ AND THE REASON MAY NOT ASK FOR A PHOTOGRAPH, which is what it used to say — a card that refuses
  // itself and blames a missing picture sends the runner to add one and nothing changes.
  assert.ok(!/photo/i.test(G.refused.reason),
    "the refusal still blames a missing photograph: " + JSON.stringify(G.refused.reason));
});

test("BLOCKER: the bottom fade leaves no edge where it begins, measured off rendered pixels", () => {
  // ⚠️ THE OWNER REPORTED SEEING A LINE: "the gradient at the bottom of the card ... needs a more natural
  // fade, i can see the line where it stops on the current one." That is a Mach band, which is a real
  // artefact rather than taste — the eye finds the discontinuity in the RATE of change, so a ramp that
  // reaches zero with a non-zero slope draws an edge at the row where it stops however gentle the ramp is.
  //
  // ⚠️ THIS IS THE PIXEL HALF OF THE GUARD AND IT IS HERE RATHER THAN IN share-render BECAUSE IT NEEDS A
  // CANVAS. That file asserts the emitted gradient stops, which proves the curve reaches Skia; only a
  // rendered column can say what Skia then painted.
  //
  // ⚠️ AND THE CONTROL IS EXACT. SHARE_SCRIM.stops = 1 makes the fade one straight line — smootherstep
  // sampled at its two endpoints IS a line — so each row below is the same card, same fade length, same
  // solved alpha, differing only in whether the fade is eased.
  assert.ok(G.scrimEdge.length >= 8, "the fade profile was not captured: " + G.scrimEdge.length);
  const at = (set: { lag: number; bnd: number; inner: number }[], lag: number) =>
    set.filter((x) => x.lag === lag)[0]!;
  const rows = G.scrimEdge.map((e) => ({ key: e.ground + "/" + e.aspect, a: e.a, fade: e.fade,
    eased8: at(e.eased, 8).bnd, linear8: at(e.linear, 8).bnd,
    eased4: at(e.eased, 4).bnd, easedIn8: at(e.eased, 8).inner, linearIn8: at(e.linear, 8).inner }));
  for (const r of rows) {
    assert.ok(r.a > 0.2, r.key + " earned an alpha of " + r.a + ", so there is no fade to measure");
    // ⚠️ THE ABSOLUTE BAR IS TWO 8-BIT STEPS. One step at white is 0.0089 in relative luminance, and the
    // eased boundary measures exactly that — i.e. it is as smooth as the encoding can express. Measured
    // before ruling 8: 0.069889 on the worst flat ground. Re-broken by setting SHARE_SCRIM.stops to 1.
    assert.ok(r.eased8 <= 0.02, r.key + ": the fade's top row has a Laplacian of " + r.eased8.toFixed(6) +
      " at lag 8, which is an edge — the shipped-before straight line measured 0.069889 and one 8-bit " +
      "step at white is 0.008898");
    assert.ok(r.eased4 <= 0.02, r.key + ": the fade's top row has a Laplacian of " + r.eased4.toFixed(6) +
      " at lag 4");
    // ⚠️ AND IT IS MUCH SMALLER THAN THE STRAIGHT LINE ON THE SAME CARD, which is the claim that cannot be
    // satisfied by a fade that has simply become invisible: the control has to be worse.
    assert.ok(r.linear8 > r.eased8 * 3, r.key + ": easing the fade only took its boundary from " +
      r.linear8.toFixed(6) + " to " + r.eased8.toFixed(6) + ", so the ease is not doing the work");
    // ⚠️ THE CURVATURE DID NOT VANISH, IT MOVED, and that is the trade rather than a free win — asserted
    // so a future "improvement" that flattens the interior is recognised as having removed the mechanism.
    assert.ok(r.easedIn8 > r.eased8, r.key + ": the eased fade's interior curvature (" +
      r.easedIn8.toFixed(6) + ") is not greater than its boundary's (" + r.eased8.toFixed(6) +
      "), so the curve is not concentrated away from the edge");
    assert.ok(r.easedIn8 > r.linearIn8, r.key + ": the eased fade carries no more curvature inside " +
      "itself than a straight line does, which a smootherstep cannot do");
  }
  // ⚠️ AND THE HALVED LENGTHS ARE THE ONES THE CARDS ACTUALLY GOT. A fade measured on a length nobody
  // ships is a measurement of a different card.
  const fades = [...new Set(rows.map((r) => r.fade))];
  assert.deepEqual(fades.sort((a, b) => a - b), [114, 141],
    "the captured fades are not the halved story/feed lengths: " + fades.join(","));
});

test("the capture is quick enough to keep in the suite, and it left its evidence on disk", () => {
  // ⚠️ A GATE NOBODY WILL RUN IS A GATE THAT DOES NOT EXIST. One browser, one lift, twenty-six exports:
  // measured at about 3.5 seconds against a 70-second suite. If this ever creeps into the tens of
  // seconds, share the capture further rather than dropping cases from it.
  assert.ok(G.ms < 60000, "the capture took " + G.ms + "ms, which is too slow to keep everyone running it");
  assert.ok(evidenceDir().length > 0);
});
