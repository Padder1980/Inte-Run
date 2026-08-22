import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE COMMUNITY TAB, BUILT TO THE COMMISSIONED DESIGN (design_handoff_community_tab, 2026-08-21).
 *
 * ⚠️⚠️ THE GUARD THAT MATTERS MOST IS THAT NONE OF THE DESIGN'S PEOPLE SHIPPED. The prototype carries
 * four fictional runners, 1,204 followers, 312 following, likes and comments — and there is no backend
 * behind any of it. Rendering those to a real tester would be fabricated data on a screen that looks
 * like a social network, which is the one thing this codebase refuses everywhere: a treadmill run
 * stores no route rather than a guessed one, a wrist run reaches Strava as a manual activity rather
 * than a GPX with invented times, and a run with no known start is not written to Health at all.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
function fn(name: string): string {
  const src = page();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error(name + " is unbalanced");
}
const nocomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** The app's own script block — not the bundled engine, which is minified and has its own names. */
function appBlock(): string {
  const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.reduce((a, b) => (b.length > a.length && b.includes("function viewCommunity(") ? b : a), "");
  assert.ok(app, "the app's script block could not be found");
  return app;
}
/** The generated stylesheet. */
function sheetOf(src: string): string {
  const a = src.indexOf("<style>"), b = src.indexOf("</style>", a);
  assert.ok(a > 0 && b > a, "the stylesheet could not be found");
  return src.slice(a, b);
}

test("BLOCKER: not one of the design's fictional runners reached the build", () => {
  // ⚠️ THE NAMES, THE HANDLES AND THE COUNTS, because each would be a different flavour of the same
  // lie. The counts are the subtle ones: "1,204" and "312" look like data rather than copy.
  const src = nocomment(page());
  for (const who of ["Cormac", "Byrne", "Niamh", "Doyle", "Whitaker", "Saoirse", "Kelly",
    "Aoife", "Nolan", "Declan Moore", "Cork Track Club", "Eoin Barry"]) {
    assert.ok(!src.includes(who), "a fictional runner from the design reached the build: " + who);
  }
  for (const handle of ["@cormac", "@niamh", "@tomw", "@saoirse", "@aoife", "@orlaf", "@dec.moore"]) {
    assert.ok(!src.includes(handle), "a fictional handle reached the build: " + handle);
  }
  for (const n of ["1,204", "\"312\"", ">312<"]) {
    assert.ok(!src.includes(n), "a fictional follower count reached the build: " + n);
  }
  // ⚠️ AND THE FOLLOWER STATS ARE HARD ZEROES RATHER THAN OMITTED, because the design's three-column
  // row is the shape of the screen — an honest zero is data, a missing column is a different design.
  assert.match(fn("viewCommunity"), /stat\(0, "Followers"/, "the follower count is not a real zero");
  assert.match(fn("viewCommunity"), /stat\(0, "Following"/, "the following count is not a real zero");
});

test("BLOCKER: the feed is the design's own empty state, and says why rather than pretending", () => {
  // The handoff requires it in as many words: "an empty feed for a runner following nobody".
  const feed = fn("commFeedHtml");
  assert.ok(!/sc-for|posts\.map|POSTS/.test(feed), "the feed is rendering posts from somewhere");
  assert.match(feed, /nothing to show you/i, "the empty feed does not say why it is empty");
  // ⚠️ AND IT OFFERS THE TWO THINGS THAT DO WORK. The pre-TestFlight audit called an unfinished surface
  // the most visible thing in the app; a state that explains itself and points at the working route is
  // the difference between an empty room and a closed door.
  assert.match(feed, /data-cgo="mine"/, "the empty feed does not offer the runner their own runs");
  // ⚠️ RESTATED: the button became Create a post at his instruction. What matters is unchanged — the
  // empty state must offer the thing that DOES work rather than only explaining what does not.
  assert.match(feed, /data-cnewpost="1"/, "the empty feed offers no working action at all");
});

test("BLOCKER: the runner's own pane is built from real data, and the grid from the UNCAPPED store", () => {
  // ⚠️ state.hist, NOT state.logged. The history store keeps every run for ever; the capped store keeps
  // fifty. A grid from the capped one would quietly stop having a past — measured on an eight-month
  // fixture elsewhere in this suite, 148 days against 50 openable.
  const months = fn("commMonths");
  assert.match(months, /state\.hist/, "the month grid is not built from the uncapped history");
  assert.match(months, /state\.logged/,
    "the grid never consults the full records, so no tile could ever be openable");
  // ⚠️ A RUN WHOSE FULL RECORD IS GONE IS A SPAN, NOT A BUTTON — the rule this app already applies to
  // the training log, because the tap would land on "Run not found."
  const tile = fn("commTileHtml");
  assert.match(tile, /t\.full\s*\n?\s*\?/, "a tile is a button whether or not the run can be opened");
  assert.match(tile, /aria-disabled="true"/, "an unopenable tile is not marked as such");
  // The plan line is real, and the two fields this app does not store are not invented.
  const prof = fn("commProfile");
  assert.match(prof, /CURRENT_WEEK/, "the plan position is not read from the plan");
  assert.match(prof, /RACE_LABEL/, "the goal is not the runner's real goal");
  assert.ok(!/@/.test(nocomment(prof)), "commProfile is inventing a handle");
});

test("BLOCKER: a tile is geometry, never a basemap, so the grid costs no billed tiles", () => {
  // ⚠️ FIFTEEN TILES OF BASEMAP ON FIRST OPEN IS ROUGHLY 120 BILLED TILES. The share card made exactly
  // this call for exactly this reason ("NO TILES … a shared card costs no billed tiles"), and the
  // route-map cache exists because a map re-fetched per view is the bill of the whole feature.
  const tile = fn("commTileHtml");
  assert.match(tile, /routeMapSvg\(/, "the tile does not draw the route as geometry");
  for (const bad of ["routeMapFor", "loadRouteMap", "liveMapFor", "buildOverviewMap"]) {
    assert.ok(!tile.includes(bad), "a grid tile fetches map tiles via " + bad);
  }
  assert.ok(!fn("openCommStory").includes("routeMapFor"), "the story viewer fetches billed map tiles");
});

test("BLOCKER: the badge word and its colour come from the one effort mapping", () => {
  // ⚠️ KEYED A SECOND TIME, A TEMPO WOULD BE RUST HERE AND AMBER EVERYWHERE ELSE — which is the defect
  // the owner found on 2026-08-20, and the reason sessionEffort exists as the single answer.
  // ⚠️ THE WHOLE ASSIGNMENT, NOT A MENTION. The first version of this asked whether sessionEffort(t.type)
  // appeared anywhere in the function — which a conditional wrapped around it still satisfies. Watched
  // escaping: `(t.type === "threshold") ? "hard" : sessionEffort(t.type)` passed, and that IS the defect,
  // because a tempo would then be rust here and amber on every other screen.
  const tile = fn("commTileHtml");
  const eff = (/const eff = ([^;]+);/.exec(tile) || [])[1];
  assert.equal(String(eff).trim(), "sessionEffort(t.type)",
    "the tile decides its own effort colour: " + eff);
  assert.ok(!/intensity|targetRpe/.test(tile), "the tile carries a second opinion about effort");
  // ⚠️ AND NO SESSION TYPE IS NAMED IN THE TILE AT ALL, which is what a second opinion looks like.
  for (const t of ["threshold", "vo2", "race", "recovery"]) {
    assert.ok(!new RegExp('=== "' + t + '"').test(tile),
      "the tile branches on the session type " + t + " rather than asking the one mapping");
  }
  // ⚠️ AND A WORD, NEVER A COLOUR ALONE, which is what makes the grid readable to a colour-blind runner.
  assert.match(tile, /COMM_BADGE\[t\.type\]/, "the badge word is not from the badge table");
  assert.match(fn("commTileHtml"), /\|\| "RUN"/, "a session type with no badge word renders no word");
});

test("BLOCKER: every control on the screen is reached by a handler", () => {
  // ⚠️ THE ID GUARD PROVES AN ID RESOLVES AND CANNOT PROVE A CONTROL IS WIRED. A screen built from a
  // design reference is the likeliest place for a live-looking dead button, and this app has shipped
  // that three times — the debrief's overflow button, the profile confirm, and a share tile.
  const src = page();
  // ⚠️ THE SHARE SHEET IS GONE FROM THIS LIST BECAUSE ITS BUTTON IS. He asked for "Create a post" in
  // place of "Share a run", so commShareHtml and wireCommShare had no caller left — and a builder
  // nothing reaches is the computed-and-discarded trap this project has shipped four times, so they
  // were deleted rather than left. Sharing a run is on the run's own page, which is guarded elsewhere.
  // The two new sub-screens join the sweep in their place.
  const screen = fn("viewCommunity") + fn("commFeedHtml") + fn("commPeopleHtml") +
    fn("clubPostViewHtml") + fn("viewClubEdit");
  const attrs = new Set<string>();
  for (const m of screen.matchAll(/data-(c[a-z]+)="/g)) attrs.add(m[1]!);
  assert.ok(attrs.size >= 4, "the screen renders " + attrs.size + " control families; expected at least four");
  const wiring = nocomment(src);
  for (const a of attrs) {
    // ⚠️ A DELEGATED SELECTOR **OR** A dataset READ. Not every data- attribute is a control: data-cmed
    // and data-cvid are read by the media loader as dataset properties, where the hyphenated name
    // appears nowhere at all. Requiring a [data-x] selector for those reports live code as unwired,
    // which is the collection-too-narrow half of this guard's own lesson.
    // A bare [data-x] selector, a valued [data-x="..."] one, or a dataset read — all three are real
    // bindings, and only requiring the first reports live code as unwired.
    const bound = new RegExp('\\[data-' + a + '[\\]=]').test(wiring) ||
      new RegExp('dataset\\.' + a + '\\b').test(wiring);
    assert.ok(bound, "the screen renders data-" + a + " and nothing ever reads it");
  }
  // ⚠️ AND NEITHER BUILDER SURVIVES AS AN ORPHAN. Deleting the button and leaving the sheet behind is
  // exactly the trap named above; assert both are gone from the app entirely.
  assert.ok(!/function commShareHtml/.test(src), "the unreachable share sheet is still in the build");
  assert.ok(!/function wireCommShare/.test(src), "the unreachable share wiring is still in the build");
});

test("BLOCKER: the story viewer clears its timer on every exit, and needs a run to exist", () => {
  // ⚠️ AN INTERVAL THAT OUTLIVES ITS SHEET HAS BITTEN THIS APP TWICE — the stretch player and the
  // coach's scheduler. Here it would keep advancing slides behind a closed overlay.
  const close = fn("commStoryClose");
  assert.match(close, /clearTimeout\(COMM_STORY_T\)/, "closing the story leaves its timer running");
  assert.match(close, /remove\(\)/, "closing the story leaves the overlay in the DOM");
  const open = fn("openCommStory");
  assert.match(open, /commStoryClose\(\)/, "opening a story does not clear a previous one");
  // ⚠️ NO RUN, NO STORY. The design's own state: "no stories in the rail (the ring row collapses)". An
  // unseen-story ring over nothing is a control that looks live and does nothing.
  assert.match(fn("commStory"), /if \(!run\) return null/, "a runner with no runs still gets a story");
  // ⚠️ RESTATED FOR THE + BADGE, AND THE INVARIANT IS UNCHANGED. The avatar's wrapper is now always
  // drawn — it carries the little plus that goes straight to the camera roll, which has to be there
  // precisely when there is no story yet. What must still be conditional is the TAPPABLE RING: a
  // story ring over nothing is a control that looks live and does nothing. So the claim moved from
  // "the wrapper is conditional" to "cm-av-story is", which is what it always meant.
  const vc = fn("viewCommunity");
  assert.match(vc, /anyStory\s*\n?\s*\?[^:]*cm-av-story/,
    "the tappable story ring is drawn whether or not there is a story to open");
  assert.ok(!/cm-av-story/.test(vc.replace(/anyStory[\s\S]*?cm-avplus/, "")),
    "cm-av-story appears somewhere the anyStory gate does not reach");
  assert.match(vc, /cm-avplus[\s\S]*data-cadd="story"/,
    "the plus on the avatar no longer goes to the camera roll");
  // 4.5s a slide is the design's figure, and the progress keyframe must use the same one.
  const ms = /const COMM_STORY_MS = (\d+);/.exec(page());
  assert.ok(ms, "COMM_STORY_MS is gone");
  assert.equal(Number(ms![1]), 4500, "a slide holds " + ms![1] + "ms; the design says 4.5s");
  assert.match(page(), /animation: cmFill 4\.5s/, "the progress bar and the timer disagree");
});

test("BLOCKER: the story's words are the runner's own facts, not the design's authored captions", () => {
  // ⚠️ THE PROTOTYPE'S SLIDES ARE WRITTEN COPY ("Out before six. The marina to yourself at that hour."),
  // which no app can generate about somebody's morning. What it CAN say is what happened — and it
  // already writes that: debriefParagraphs is the coach's read and is the same sentence the debrief
  // shows, so the story cannot tell the runner something the debrief contradicts.
  const st = fn("commStory");
  assert.match(st, /debriefParagraphs/, "the story's read is not the coach's own");
  assert.match(st, /logTotals/, "the week slide is not the real week");
  const src = nocomment(page());
  for (const line of ["Out before six", "The marina to yourself", "Week seven done",
    "Held the easy effort the whole way"]) {
    assert.ok(!src.includes(line), "an authored caption from the prototype shipped: " + line);
  }
});

test("the signal green is used on dark media only, and the mark gradient only on a story ring", () => {
  // ⚠️ BOTH RULES ARE THE TOKENS' OWN, and the handoff repeats them: the bright signal greens sit on
  // dark media and never in UI chrome; the brand-mark gradient is the story ring alone.
  // ⚠️ BY RULE, NOT BY LINE, AND THE FIRST VERSION OF THIS READ LINES. A rule spanning several lines
  // puts its selector on one and the declaration on another, so a line-based check reported the
  // correct .cm-seye rule as a violation — a guard that calls a correct thing broken is one somebody
  // deletes.
  const css = page().slice(page().indexOf("<style>"), page().indexOf("</style>"));
  const rules = css.split("}").map((r) => r.trim()).filter(Boolean);
  const sig = rules.filter((r) => /var\(--signal-/.test(r));
  assert.ok(sig.length > 0, "the signal token is declared and never used");
  for (const r of sig) {
    assert.ok(/\.cm-seye|\.rt-|share|:root/.test(r),
      "a signal green is used outside dark media: " + r.slice(0, 110).replace(/\s+/g, " "));
  }
  // ⚠️ THE CONIC BRAND GRADIENT MEANS "LIVE OR UNSEEN", AND THAT IS WIDER THAN A STORY RING — which is
  // what this guard first said, before addendum 1 arrived. It reuses the same ring for the CURRENT plan
  // block and says the reuse is deliberate: "same ring as an unseen story — deliberate: it means
  // 'live'". So the invariant is the MEANING, not one selector: an unseen story, a live block, and the
  // launch marks. A finished block is a flat hairline, which is what makes the rail readable at a glance.
  const mark = rules.filter((r) => /var\(--mark/.test(r));
  for (const r of mark) {
    assert.ok(/cm-av-story|cm-rail-ring|cj-ring\.live|splash|welcome|:root/.test(r),
      "the brand-mark gradient is used where nothing is live or unseen: " +
      r.slice(0, 110).replace(/\s+/g, " "));
  }
  // ⚠️ AND A FINISHED BLOCK MUST NOT CARRY IT, or the rail says everything is live.
  const flat = rules.filter((r) => /\.cj-ring \.cj-disc/.test(r))[0] || "";
  assert.ok(flat && /background: var\(--line\)/.test(flat),
    "a completed block's ring is not the flat hairline, so every ring reads as live");
});

test("BLOCKER: no function name is declared twice in the app script", () => {
  // ⚠️ THIS CAUGHT A REAL, SILENT DEFECT ON THE DAY IT WAS WRITTEN. The Inte-Club editor declared
  // fmtClock(seconds) while the live run screen already had fmtClock(milliseconds) — same name, different
  // unit. Function declarations hoist, so the LATER one won for the whole 30,000-line script and every
  // trim label rendered a fifteen-second window as "0:00.0", fifteen milliseconds. The build exited 0,
  // node --check passed all three emitted blocks, and 1132 tests passed.
  //
  // ⚠️ THERE IS NO WARNING FOR THIS ANYWHERE. One template literal means no linting and no typechecking
  // of the runtime JS, and a duplicate declaration is legal JavaScript — it is not even a strict-mode
  // error. The only thing that can see it is a test asking the question.
  //
  // ⚠️ SCOPED TO TOP-LEVEL DECLARATIONS ONLY (no leading whitespace). A nested helper of the same name
  // inside two different functions is correct and common; what is never correct is two at the top level.
  // The app's own script block — not the bundled engine, which is minified and has its own names.
  const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.reduce((a, b) => (b.length > a.length && b.includes("function viewCommunity(") ? b : a), "");
  assert.ok(app, "the app's script block could not be found");
  const names = [...app.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  const seen = new Set(), dupes = new Set();
  for (const n of names) { if (seen.has(n)) dupes.add(n); seen.add(n); }
  assert.deepEqual([...dupes], [],
    "declared twice at the top level, so the later one silently wins everywhere: " + [...dupes].join(", "));
});

/* ══ INTE-CLUB: POSTING, PICKING AND EDITING ═══════════════════════════════════════════════════════
 * Owner, 2026-08-22: "i want to build the functionality whereby a runner can press the plus button at
 * the top and it allows them to add a post or a story etc … The post will allow them to add a video or
 * a photo from their own camera roll and the same if they click story … There also needs to be a little
 * plus button on the profile picture … that takes them straight into their camera roll … (video's capped
 * at 15 seconds for stories) … This section also needs to be changed from being called community to
 * 'Inte-Club'".
 */
test("BLOCKER: the tab is called Inte-Club everywhere a runner reads it", () => {
  const src = page();
  const titles = /const TITLES = \{([^}]*)\}/.exec(src);
  const nav = /const NAV_LABEL = \{([^}]*)\}/.exec(src);
  assert.ok(titles && nav, "the title maps could not be found");
  const tBody = titles![1] || "", nBody = nav![1] || "";
  assert.match(tBody, /community:\s*"Inte-Club"/, "the screen title is not Inte-Club");
  assert.match(nBody, /community:\s*"Inte-Club"/, "the nav label is not Inte-Club");
  // ⚠️ BOTH MAPS, because the nav falls back to TITLES with "Your " stripped when NAV_LABEL has no
  // entry — so renaming one and not the other leaves the two halves of the app disagreeing about what
  // the screen is called, and which one a runner sees depends on where they look.
  assert.ok(!/community:\s*"Community"/.test(tBody + nBody), "one of the two maps still says Community");
});

test("BLOCKER: the create button is on the club and nowhere else", () => {
  // ⚠️ A CREATE CONTROL IN THE TOP BAR OF EVERY SCREEN ONLY MEANS SOMETHING ON ONE OF THEM, so most taps
  // on it would be taps on a control that does not belong there. This project has shipped a
  // looks-live-does-nothing control three times (rdMore, the profile confirm button, #saveSetup).
  const src = nocomment(page());
  assert.match(src, /function syncClubNew\(\)/, "there is no gate on the create button at all");
  const g = fn("syncClubNew");
  assert.match(g, /state\.tab === "community"/, "the create button is not gated on the club tab");
  assert.match(g, /!state\.screen/, "the create button shows over a full-screen sub-view");
  assert.match(g, /!state\.support/, "the create button shows over a support page");
  assert.match(g, /display\s*=\s*on \? "" : "none"/, "the gate does not actually hide it");
  // ⚠️ AND IT IS CALLED FROM THE RENDER PATH, not just declared. A gate nothing runs is a gate that
  // never fires, which is how this app once shipped a warm-up fix to one builder and not the other.
  assert.match(src, /syncClubNew\(\);/, "syncClubNew is declared but never called");
});

test("BLOCKER: the camera roll is reached by a file input that is created, clicked and dropped", () => {
  const p = fn("clubPick");
  assert.match(p, /inp\.type = "file"/, "the picker is not a file input");
  assert.match(p, /accept = "image\/\*,video\/\*"/, "the picker does not accept both photos and video");
  // ⚠️ NO capture ATTRIBUTE. With one, iOS opens the camera directly and the runner cannot reach their
  // roll at all — which is the opposite of what was asked for.
  assert.ok(!/capture/.test(p), "the picker forces the camera, so the camera roll is unreachable");
  // ⚠️ REMOVED AFTER USE. A file input left in the document is one a later render can re-trigger, and on
  // iOS a stale one silently stops opening the sheet.
  assert.match(p, /inp\.remove\(\)/, "the file input is left in the document");
  assert.match(p, /openClubEditor\(kind, f\)/, "picking a file does not open the editor");
});

test("BLOCKER: both Create rows and the avatar's plus all reach the camera roll", () => {
  // ⚠️ THE ATTRIBUTE IS COMPUTED (data-cnew="' + id + '"), so no literal data-cnew="post" exists
  // anywhere — the first version of this guard looked for one and failed on correct code. Assert the
  // builder's own call sites, and that the builder really writes its first argument into the attribute:
  // the same answer the share studio's destination sweep needed when studioDestTile started computing
  // its data-sst.
  const c = fn("clubCreateHtml");
  assert.match(c, /data-cnew="' \+ id \+ '"/, "the Create row no longer writes its kind into the attribute");
  assert.match(c, /row\("post",/, "Create does not offer a post");
  assert.match(c, /row\("story",/, "Create does not offer a story");
  // ⚠️ WHAT IS NOT BUILT IS NAMED, NOT OFFERED. The owner's reference carries Reel, Highlights and Live;
  // a row that opens nothing is the defect class above, and saying so is better than a dead row.
  assert.match(c, /Reels, highlights and going live are next/, "the unbuilt kinds are neither named nor excluded");
  assert.ok(!/data-cnew="(reel|live|highlight)/.test(c), "an unbuilt kind is offered as a live row");
  const open = fn("openClubCreate");
  assert.match(open, /clubPick\(kind\)/, "a Create row does not reach the picker");
  assert.match(open, /closeSheet\(\);\s*\n\s*clubPick/, "the sheet is left open behind the iOS picker");
  // The avatar's plus and the rail's Add both go straight to a story — no Create sheet in between.
  const wire = nocomment(page());
  assert.match(wire, /\[data-cadd\][\s\S]{0,160}clubPick\(b\.dataset\.cadd\)/,
    "the avatar plus and the rail Add do not reach the picker");
  const v = fn("viewCommunity");
  assert.match(v, /cm-avplus[\s\S]{0,200}data-cadd="story"/, "the avatar plus does not add a story");
});

test("BLOCKER: a story video is trimmed to fifteen seconds, and a post is not", () => {
  const src = nocomment(page());
  assert.match(src, /const CLUB_STORY_MAX_S = 15;/, "the fifteen-second cap is not a named constant");
  const t = fn("clubTrimHtml");
  // ⚠️ THE CAP IS THE STORY'S, NOT EVERY UPLOAD'S. The owner capped stories; applying it to a post as
  // well would be a rule he did not ask for.
  assert.match(t, /kind === "story" \? CLUB_STORY_MAX_S : 0/, "the cap is not scoped to stories");
  assert.match(t, /dur > cap/, "a clip shorter than the cap is still offered a trim it does not need");
  // ⚠️ A TRIM, NOT A REFUSAL. Rejecting a long clip sends the runner back to Photos to cut it.
  assert.ok(!/too long|not allowed|cannot be longer/i.test(t), "a long clip is refused rather than trimmed");
  assert.match(t, /maxIn = Math\.max\(0, dur - cap\)/, "the window cannot be slid to the end of the clip");
  // ⚠️ STORED AS IN AND OUT POINTS. Re-encoding in a web view decodes every frame to a canvas, loses
  // quality and drops the audio; the original is kept whole so a future export can cut from it.
  const post = fn("clubEdPost");
  assert.match(post, /trim: x\.sl\.isVid \? \{ inS:[^}]*outS:/,
    "the trim is not stored as in and out points");
  assert.ok(!/MediaRecorder|captureStream|drawImage/.test(post), "posting re-encodes the video");
});

test("BLOCKER: the bytes go in IndexedDB and the row in localStorage, media first", () => {
  // ⚠️ localStorage IS WHERE THE ENTIRE TRAINING HISTORY LIVES. One phone video is tens of megabytes;
  // writing it there takes every logged run with it. The route-map cache is in IndexedDB for exactly
  // this reason and its own note says so.
  const src = nocomment(page());
  assert.match(src, /const CLUBDB = "interun_club_media_v1"/, "there is no IndexedDB store for the media");
  const put = fn("clubMediaPut");
  assert.ok(!/localStorage/.test(put), "the media blob is written to localStorage");
  const post = fn("clubEdPost");
  assert.match(post, /clubMediaPut\([\s\S]*?\)\.then\(/, "the row is not written after the media");
  const rowAt = post.indexOf("clubSave("), medAt = post.indexOf("clubMediaPut(");
  assert.ok(medAt >= 0 && rowAt > medAt,
    "the row is saved before the blob, so a failed write leaves a permanently broken tile");
  assert.match(post, /\.catch\(/, "a failed save is silent");
  // The row carries the key, never the bytes.
  // ⚠️ ALWAYS A LIST, EVEN FOR ONE. A field that is sometimes a string and sometimes a list is two
  // shapes for every reader to get right — the normalizeRoute fault twice over.
  assert.match(post, /media: slides\.map\(\(x\) => x\.key\)/,
    "the row does not reference its media as a list of keys");
  assert.ok(!/dataURL|toDataURL|readAsDataURL/.test(post), "the bytes are inlined into the row");
});

test("BLOCKER: a story expires after 24 hours and takes its blob with it", () => {
  const src = nocomment(page());
  assert.match(src, /const CLUB_STORY_MS = 24 \* 60 \* 60 \* 1000;/, "the 24-hour life is not a named constant");
  const st = fn("clubStories");
  assert.match(st, /CLUB_STORY_MS/, "stories do not expire");
  // ⚠️ THE BLOB IS DELETED WITH THE ROW. Sweeping only the row leaves tens of megabytes of orphaned
  // video in IndexedDB with nothing referencing it and no way to reach it — a store that grows forever.
  assert.match(st, /clubMediaDel/, "an expired story's video is orphaned in IndexedDB");
  assert.match(st, /clubSave/, "the sweep is not persisted, so it runs again on every render");
});

test("BLOCKER: the editor's text is typed on the media, not into a system dialog", () => {
  // ⚠️ NOT prompt(). A system dialog cannot show the runner the typeface, colour or size they are
  // choosing, and on iOS it is a modal the app does not control.
  // ⚠️ COMMENTS STRIPPED, because the code's own note explains why it is not a system dialog and so
  // quotes the very call this forbids. Eighth firing of that trap in this codebase; nocomment is the
  // remedy it already keeps for exactly this.
  const wire = nocomment(fn("wireClubEd"));
  assert.ok(!/prompt\(/.test(wire), "the text is typed into a system prompt");
  assert.match(wire, /clubTextOpen\(-1\)/, "the Aa button does not open the text surface");
  const d = fn("clubTextDraw");
  assert.match(d, /data-cfont/, "there is no way to choose a typeface");
  assert.match(d, /data-ccol/, "there is no way to choose a colour");
  assert.match(d, /clubTxSz/, "there is no way to choose a size");
  // ⚠️ EACH PILL IS SET IN ITS OWN FACE — three labels in one typeface is not a choice you can see.
  assert.match(d, /font-family:' \+ f/, "the font pills are not set in the faces they offer");
  // ⚠️ AND THE TOOLS LIVE IN THIS STATE, not the rail: rail buttons acting on a selected word are inert
  // whenever nothing is selected, which was two of three tools most of the time.
  const html = fn("clubEdDraw");
  assert.ok(!/clubColour|clubFont/.test(html), "the colour and font tools are back in the rail, where they are inert");
  // ⚠️ ASSERTED ON THE PUSH, NOT ON THE PRESENCE OF A TRUTHINESS TEST. The first version matched the
  // first "if (txt)" — which guards the EDIT branch — so turning the add branch's "else if (txt)" into a
  // bare "else" escaped it entirely. What matters is that nothing reaches texts.push without the text
  // having survived the trim.
  const commit = nocomment(fn("clubTextCommit"));
  const pushAt = commit.indexOf("sl.texts.push(");
  assert.ok(pushAt > 0, "the committed word is never added");
  const guard = commit.slice(0, pushAt);
  assert.match(guard.slice(guard.lastIndexOf("}")), /if \(txt\)/,
    "an empty word is added as an invisible draggable nothing");
  assert.match(commit, /splice\(S\.draftAt, 1\)/, "emptying a word leaves it on the picture, invisible");
});

test("BLOCKER: a tap on a word edits it and a drag moves it", () => {
  // ⚠️ ONE GESTURE MUST NOT MEAN TWO THINGS. A word the runner meant to nudge must not reopen the
  // keyboard, and a word they meant to fix must not need a second control to reach.
  const d = fn("clubTextDrag");
  assert.match(d, /moved = true/, "a drag and a tap are not told apart");
  assert.match(d, /if \(!moved\) \{ clubTextOpen\(i\); return; \}/, "a tap on a word does not edit it");
  assert.match(d, /> 4/, "the travel threshold is missing, so every tap reads as a drag or vice versa");
});

test("BLOCKER: the framing is clamped in one place, and the stored crop is what was previewed", () => {
  const f = fn("clubEdFit");
  // ⚠️ THE FRACTION IS CLAMPED TO THE BOX, so the media can never be dragged off the stage — the share
  // studio's own model, where a slack axis is centred rather than panned.
  assert.match(f, /half = \(1 - 1 \/ sl\.k\) \/ 2/, "the clamp is not derived from the zoom");
  // ⚠️ AND EVERY SLIDE OWNS ITS OWN FRAMING. One shared crop across a carousel is the fault the share
  // studio already records: switching pictures destroyed the framing just set, with nothing to undo it.
  assert.ok(!/CLUBED\.ox|CLUBED\.k/.test(f), "the framing is shared across the whole carousel");
  assert.match(f, /Math\.max\(0\.5 - half, Math\.min\(0\.5 \+ half/, "the framing is not clamped");
  // ⚠️ ONE PLACE APPLIES IT. Two would be two answers, and the stored crop would not be the one the
  // runner framed — the two-disagreeing-transforms fault that stretched the debrief hero.
  const g = fn("clubEdGestures");
  assert.ok(!/1 - 1 \/ /.test(g), "the gesture handler clamps too, so there are two answers");
  assert.match(g, /clubEdFit\(\)/, "the gesture handler does not go through the one clamp");
  const post = fn("clubEdPost");
  assert.match(post, /crop: \{ ox: \+x\.sl\.ox/, "the framing is not stored with the post");
});

test("BLOCKER: All and Videos only appear when there is something to split", () => {
  const v = fn("viewCommunity");
  // ⚠️ BEFORE MEDIA EXISTED THIS TAB COULD NEVER HAVE A MEMBER. The grid held runs, which carry no
  // media, so a Videos tab was a tab with nothing in it — which is why the addendum's request for it
  // was declined at the time and is honoured now.
  assert.match(v, /uploads\.length \? clubTabsHtml\(\) : ""/, "the tabs show with nothing to filter");
  assert.match(v, /vidOnly = clubMediaTab\(\) === "video"/, "the filter is not read from the tab");
  assert.match(v, /uploads\.filter\(\(u\) => u\.video\)/, "Videos does not filter to videos");
  // ⚠️ UNDER VIDEOS THE RUN TILES GO. A run is not a video, and showing them under that tab would be
  // the app calling a route drawing a film of itself.
  assert.match(v, /\(vidOnly && uploads\.length\) \? "" :/, "run tiles survive the Videos filter");
  assert.match(v, /No videos yet/, "a runner with no videos gets an empty three-column area");
  const t = fn("clubTabsHtml");
  // ⚠️ THE LABEL IS ALWAYS VISIBLE — colour is never the only signal, which is the design's own rule.
  assert.match(t, /<span>' \+ lab/, "a tab is icon-only, so colour is the only signal");
  assert.match(t, /aria-selected/, "the tabs are not announced as tabs");
});

test("BLOCKER: one full-screen player serves a post and a story, and only a story advances itself", () => {
  const src = nocomment(page());
  // ⚠️ RESTATED: a post no longer uses this player at all. His recording showed a scrollable feed, not a
  // full-screen viewer — a story plays at you and closes itself, a post is read at your own pace.
  assert.match(src, /function openClubStories\(\) \{ clubOpenMedia\(/, "the story player is gone");
  assert.ok(!/function openClubPost\(id\) \{ clubOpenMedia\(/.test(src),
    "a post still opens in the story player, which closes itself while it is being read");
  const v = fn("clubOpenMedia");
  // ⚠️ A POST DOES NOT CLOSE ITSELF. A picture that vanishes while somebody is reading the caption has
  // decided for them — the rule the recap story's last panel already follows.
  assert.match(v, /if \(auto\) \{/, "a post advances itself like a story");
  // ⚠️ A VIDEO STORY RUNS FOR ITS OWN TRIMMED LENGTH, not a flat 4.5s.
  // ⚠️ THROUGH clubSlides — a carousel row keeps its trim per slide, so reading it off the row itself
  // silently loses it on anything posted as a carousel.
  assert.match(v, /first\.trim\.outS - first\.trim\.inS/,
    "a video story is cut off after the photo interval");
  assert.match(v, /Math\.min\(CLUB_STORY_MAX_S/, "a story could run longer than its own cap");
  // ⚠️ THE TRIM IS APPLIED AT PLAYBACK — that is what makes storing points rather than re-encoding honest.
  assert.match(v, /vd\.currentTime = tr\.inS/, "the trim is not applied when the video plays");
  // ⚠️ THE TIMER IS CLEARED ON EVERY EXIT. This app has paid twice for an interval outliving its sheet.
  const c = fn("clubViewClose");
  assert.match(c, /clearTimeout\(CLUB_VIEW_T\)/, "closing the player leaves its timer running");
  assert.match(v, /clearTimeout\(CLUB_VIEW_T\)/, "advancing a slide leaves the previous timer running");
});

test("BLOCKER: a real uploaded story wins over the app's generated one", () => {
  // ⚠️ THE RUN STORY EXISTS BECAUSE THERE WAS NOTHING ELSE TO PUT IN THE RING. Once the runner has put
  // something there themselves, showing them the app's summary of their last run instead is the app
  // talking over them.
  const src = nocomment(page());
  assert.match(src, /if \(clubStories\(\)\.length\) openClubStories\(\); else openCommStory\(\);/,
    "the ring does not prefer the runner's own story");
});

test("BLOCKER: media is loaded after the render, through one loader, and a missing blob is visible", () => {
  // ⚠️ READING A BLOB IS ASYNCHRONOUS AND THIS APP RENDERS SYNCHRONOUSLY FROM MANY PATHS. A builder that
  // awaited the bytes would be an async render.
  const t = fn("clubTileHtml");
  assert.ok(!/await|\.then\(/.test(t), "the tile builder waits for the blob, so the render is async");
  assert.match(t, /data-cmed="/, "the tile does not name its media for the loader");
  // ⚠️ EACH GUARD IS ASSERTED IN ITS GUARD POSITION, NOT AS A MENTION — and dataset.cfilled, not
  // data-cfilled, because the flag is set from JS so the hyphenated attribute name appears nowhere.
  // Three of these first read as "does the string appear", and all three escaped their own re-break:
  // neutering "if (n.dataset.cfilled) return" leaves the assignment two lines below, so the name is
  // still there while the check is dead. A string existing is not the same claim as something reading
  // it — the same distinction as id-exists versus control-is-wired, which this project has shipped twice.
  const f = nocomment(fn("clubFillMedia"));
  assert.match(f, /if \(n\.dataset\.cfilled\) return;/, "the loader re-fetches on every render");
  assert.match(f, /if \(!url\) \{[^}]*cm-med-gone/, "a post whose blob has gone shows nothing at all");
  assert.match(f, /\.catch\(\(\) => n\.classList\.add\("cm-med-gone"\)\)/,
    "a blob that fails to read shows nothing at all");
  assert.match(f, /preload="metadata"/, "a video tile decodes the whole clip to draw a thumbnail");
  // ⚠️ ONE LOADER FOR THE TILE, THE RING AND THE VIEWER. Three would be three places a missing blob is
  // handled differently.
  const calls = (nocomment(page()).match(/clubFillMedia\(\)/g) || []).length;
  assert.ok(calls >= 2 && calls <= 4, "clubFillMedia has an unexpected number of callers: " + calls);
  assert.equal((nocomment(page()).match(/function clubFillMedia/g) || []).length, 1, "there is more than one loader");
});

test("BLOCKER: one object URL per media, and they are released", () => {
  // ⚠️ createObjectURL LEAKS UNTIL THE PAGE IS CLOSED. A grid re-rendered on every tab switch would mint
  // a fresh URL per tile per render and hold every video in memory.
  const u = nocomment(fn("clubUrl"));
  assert.match(u, /if \(CLUBURL\[key\]\) return Promise\.resolve\(CLUBURL\[key\]\);/,
    "the cache is not consulted before minting a URL, so a re-render leaks one per tile");
  const r = fn("clubUrlsRelease");
  assert.match(r, /revokeObjectURL/, "nothing releases the object URLs");
  const c = fn("clubEdClose");
  assert.match(c, /slides\.forEach\(\(sl\) => \{ try \{ URL\.revokeObjectURL\(sl\.url\)/,
    "the editor leaks the files it was editing");
  // ⚠️ AND THE TEXT SURFACE IS A SIBLING OF THE EDITOR, so closing the editor has to remove it too or a
  // half-typed word is left floating over the club with nothing behind it.
  assert.match(c, /clubTxEd/, "closing the editor leaves the text surface on screen");
});

/* ══ HIS SIX CHANGES OF 2026-08-22 ══════════════════════════════════════════════════════════════════
 * The trim as a filmstrip, the + centred, premium profile actions, Instagram-style post opening,
 * "Create a post" with several pictures or a video, and an Edit profile page.
 */
test("BLOCKER: the trim is a filmstrip with a handle at each end, not a slider", () => {
  // His note: "the 15 second selector needs to look like this so you can see where it starts and ends."
  // A slider shows a position; only two handles over the clip can show a span.
  // ⚠️ THE BUILDER **AND** ITS USE. The first version read clubStripHtml alone, so replacing the call to
  // it with a range input escaped entirely — the strip was still perfect and nothing rendered it. A
  // builder proves a shape exists; only the caller proves the runner sees it.
  const trim = nocomment(fn("clubTrimHtml"));
  assert.match(trim, /clubStripHtml\(sl, cap, maxIn\)/, "the trim does not render the filmstrip");
  assert.ok(!/input type="range"/.test(trim), "the trim is still a slider, which cannot show a span");
  const t = nocomment(fn("clubStripHtml"));
  assert.ok(!/input type="range"/.test(t), "the strip builder falls back to a slider");
  assert.match(t, /data-ctrim="a"/, "there is no start handle");
  assert.match(t, /data-ctrim="b"/, "there is no end handle");
  assert.match(t, /club-fr/, "the clip's own frames are not shown");
  assert.match(t, /club-shade[\s\S]*club-shade/, "the time outside the window is not dimmed");
  // ⚠️ THE LABEL NAMES BOTH ENDS AND THE SPAN. "0:09" alone is a position; the runner is choosing a span.
  assert.match(t, /clubClock\(sl\.inS\)[\s\S]{0,80}clubClock\(sl\.outS\)/,
    "the label does not name both ends of the window");
  const w = nocomment(fn("wireClubTrim"));
  assert.match(w, /which === "a"/, "the two handles are not told apart, so both move the same end");
  // ⚠️ THE CAP IS APPLIED TO THE HANDLE BEING MOVED, so the far end never jumps under the finger.
  assert.match(w, /if \(sl\.outS - sl\.inS > cap\) sl\.outS = sl\.inS \+ cap/,
    "dragging the start can push the window past the cap");
  assert.match(w, /if \(sl\.outS - sl\.inS > cap\) sl\.inS = sl\.outS - cap/,
    "dragging the end can push the window past the cap");
  assert.match(w, /clubTrimPaint\(\)/, "the strip is fully re-rendered mid-drag, which drops the pointer");
});

test("BLOCKER: the thumbnail video is held, and its cleanup cannot eat the frames", () => {
  const th = nocomment(fn("clubThumbs"));
  // ⚠️ WITHOUT A HELD REFERENCE NOT ONE FRAME ARRIVES. A detached media element referenced only by its
  // own listener is a cycle nothing outside points at, so it can be collected before the load completes.
  // Measured: the function ran, thumbs became [], and loadeddata never fired at all.
  assert.match(th, /sl\.thumbVid = v/, "nothing holds the thumbnail video, so it can be collected mid-load");
  // ⚠️ AND CLEARING src RAISES error. With the handler still attached it fired AFTER all eight frames had
  // been adopted and reset them to empty — a tidy-up step that undid the work.
  const idx = th.indexOf("v.removeAttribute");
  assert.ok(idx > 0, "the element is never released");
  assert.ok(th.slice(0, idx).includes("v.onerror = null"),
    "the source is cleared before the handlers come off, so the error it raises wipes the frames");
  assert.match(th, /v\.onerror = \(\) => \{ if \(!shots\.length\)/,
    "a late failure still clears frames that were already captured");
  // ⚠️ AND EVERY SEEK IS BOUNDED, or one that never answers hangs the loop for the life of the editor.
  assert.match(th, /setTimeout\(\(\) => res\(false\), \d+\)/, "a seek that never answers hangs the strip");
  assert.match(th, /if \(!await seek\(t\)\) break/, "a timed-out seek is treated as a good frame");
});

test("BLOCKER: an icon button whose glyph is its whole content sets padding: 0", () => {
  // ⚠️ MEASURED, NOT GUESSED. The app's global button rule is padding: 1px 6px, so the avatar's plus had
  // a 10px content box holding a 14px glyph — and grid resolves a centred item that OVERFLOWS its area to
  // start-aligned: 8px of space on the left, 4px on the right, a 2px lean. Vertically it was symmetric,
  // which is why it read as leaning rather than as plainly wrong.
  const style = sheetOf(page());
  for (const cls of [".cm-avplus", ".club-x", ".club-t"]) {
    const rule = new RegExp("\\" + cls + " \\{[^}]*\\}").exec(style);
    assert.ok(rule, "no rule for " + cls);
    assert.match(rule[0], /padding: 0/, cls + " inherits the global button padding, so its glyph leans");
  }
});

test("BLOCKER: the profile actions are one filled pair, and one of them creates a post", () => {
  const style = sheetOf(page());
  const act = /\.cm-act \{[^}]*\}/.exec(style);
  assert.ok(act, "there is no .cm-act rule");
  // ⚠️ FILLED AND BORDERLESS — the reference's own shape. The generic outlined .ui-btn side by side under
  // an avatar reads as two form fields, which is what he called not premium enough.
  assert.match(act[0], /border: 0/, "the profile actions still carry a form control's border");
  assert.match(act[0], /min-height: var\(--tap\)/, "the profile actions do not reach the tap floor");
  assert.match(act[0], /flex: 1/, "the two actions are not equal width");
  const v = fn("viewCommunity");
  assert.match(v, /class="cm-act" data-cedit="1">Edit profile/, "Edit profile is not one of the pair");
  // His instruction: the second becomes Create a post.
  assert.match(v, /data-cnewpost="1">Create a post/, "the second action is not Create a post");
  // ⚠️ COMMENTS STRIPPED — the code's note explaining the rename quotes the old label. Ninth firing.
  assert.ok(!/Share a run/.test(nocomment(v)), "the profile still offers Share a run");
});

test("BLOCKER: Create a post takes several pictures, or one video, never both", () => {
  const pk = nocomment(fn("clubPickMany"));
  assert.match(pk, /inp\.multiple = true/, "the picker cannot select more than one");
  const so = nocomment(fn("clubSortSelection"));
  // ⚠️ MIXING IS REFUSED RATHER THAN SILENTLY SPLIT. His rule is a carousel of pictures OR a video, so a
  // selection holding both is two different posts and the app cannot know which was meant.
  assert.match(so, /vids\.length && pics\.length/, "a mixed selection is not detected at all");
  assert.match(so, /toast\(/, "items are dropped from a mixed selection with nothing said");
  assert.match(so, /vids\.length > 1/, "several videos become a carousel of films");
  assert.match(so, /CLUB_MAX_SLIDES/, "there is no ceiling on how many pictures a post holds");
  const post = nocomment(fn("clubEdPost"));
  // ⚠️ EVERY BLOB FIRST, THEN ONE ROW — a row naming a blob that failed to write is a permanently broken
  // slide in the middle of a carousel.
  assert.match(post, /Promise\.all\(slides\.map/, "the blobs are not all written before the row");
  assert.ok(post.indexOf("Promise.all") < post.indexOf("clubSave("),
    "the row is saved before the media");
  assert.match(post, /oks\.some\(\(ok\) => !ok\)/, "a failed blob write still writes the row");
});

test("BLOCKER: one reader understands both post shapes, and every media read goes through it", () => {
  // ⚠️ media IS ALWAYS A LIST NOW, and posts written before carousels existed carry a single key with
  // their crop, trim and texts on the row. clubSlides is the one place the old shape is understood.
  const sl = nocomment(fn("clubSlides"));
  assert.match(sl, /Array\.isArray\(p\.slides\)/, "the new per-slide shape is not read");
  assert.match(sl, /Array\.isArray\(p\.media\) \? p\.media : \(p\.media \? \[p\.media\] : \[\]\)/,
    "a post written before carousels can no longer be opened");
  assert.match(sl, /i === 0 \? \(p\.crop \|\| null\)/, "an older post loses its framing");
  // ⚠️ AND NOTHING ELSE READS THE RAW FIELD. esc(["a","b"]) is the string "a,b" — a key nothing holds —
  // which drew the missing-media hatch on every carousel tile until this was caught on the served page.
  const app = appBlock();
  const raw = [...app.matchAll(/esc\(p\.media\)/g)].length;
  assert.equal(raw, 0, "something still uses the raw media field as if it were a single key");
  for (const f of ["clubTileHtml", "clubOpenMedia", "clubSharePost"]) {
    assert.match(nocomment(fn(f)), /clubKeys\(p\)|clubSlides\(p\)/,
      f + " does not resolve its media through clubSlides");
  }
  // The sweep and the delete must remove every key a post holds.
  assert.match(nocomment(fn("clubStories")), /clubKeys\(p\)\.forEach/,
    "an expired carousel orphans all but its first video");
  assert.match(nocomment(fn("clubDelete")), /clubKeys\(p\)\.forEach/,
    "deleting a carousel orphans all but its first picture");
});

test("BLOCKER: tapping a post opens a scrollable feed of your own posts, not a story player", () => {
  // His recording shows a titled screen holding a list, positioned at the post tapped — not a
  // full-screen viewer. A story plays at you; a post is read at your own pace.
  const o = nocomment(fn("openClubPost"));
  assert.match(o, /state\.screen = "clubpost"/, "a post still opens as an overlay");
  assert.ok(!/clubOpenMedia/.test(o), "a post still goes through the story player");
  const v = nocomment(fn("clubPostViewHtml"));
  assert.match(v, /posts\.map/, "only the tapped post is shown, not the feed");
  assert.match(v, /cp-rail/, "there is no carousel rail");
  assert.match(v, /cp-dots/, "there are no carousel dots");
  assert.match(v, /cp-when/, "a post does not carry its date");
  // ⚠️ NO LIKES AND NO COMMENTS. The reference has both and this app has no server, so a heart would be
  // a control that looks live and does nothing.
  assert.ok(!/\blike|\bcomment/i.test(v), "the post view offers likes or comments, which cannot work");
  // ⚠️ AND A WAY BACK. A titled sub-screen whose only exit is the bottom nav does not return the runner
  // to where they were.
  // ⚠️ EVERY RETURN, NOT JUST ONE. A single match anywhere in the function is satisfied while a branch
  // has quietly lost it — watched escaping with the empty state's back button deleted, which is the
  // branch a runner with no posts actually reaches.
  // ⚠️ BOTH EXITS, NAMED. A single match anywhere in the function is satisfied while one branch has
  // quietly lost the button — watched escaping with the empty state's deleted, which is the branch a
  // runner with no posts actually reaches. Indentation is not a usable anchor here either: the
  // per-post return inside the .map callback sits at the same depth as the early one, and that return
  // correctly has no back button because the button belongs to the screen rather than to each post.
  const pv = nocomment(fn("clubPostViewHtml"));
  assert.match(pv, /const back = '<button class="backbtn" id="clubBack"/, "there is no back button to render");
  assert.match(pv, /return back \+ '<div class="cm-empty/, "the empty post feed has no way back");
  assert.match(pv, /return back \+ posts\.map/, "the post feed itself has no way back");
  const style = sheetOf(page());
  // ⚠️ NATIVE SCROLL-SNAP, not a JS drag: this screen scrolls vertically, and the browser arbitrates the
  // two axes correctly where a hand-rolled drag has to guess on every move.
  assert.match(style, /\.cp-rail \{[^}]*scroll-snap-type: x mandatory/,
    "the carousel is not a native scroll-snap rail");
  const w = nocomment(fn("wireClubPostView"));
  assert.match(w, /requestAnimationFrame/, "the feed is positioned before the media has its box");
});

test("BLOCKER: Edit profile is the club's own five fields, not the app's settings screen", () => {
  const app = appBlock();
  // ⚠️ IT USED TO HAND THE RUNNER THE WHOLE PROFILE & SETTINGS SCREEN — units, theme, connections — when
  // what they tapped was a button under their own avatar.
  assert.ok(!/\[data-cedit\][\s\S]{0,140}state\.tab = "profile"/.test(app),
    "Edit profile still opens the app's settings screen");
  assert.match(app, /\[data-cedit\][\s\S]{0,120}state\.screen = "clubedit"/,
    "Edit profile does not open the club's own page");
  const e = nocomment(fn("viewClubEdit"));
  for (const bit of ["ceAvatar", "ceBio", "ceFor", "cePb_", "clubBack"]) {
    assert.ok(e.includes(bit), "the edit page is missing " + bit);
  }
  // ⚠️ THE PICTURE AND THE TRAINERS ARE NOT NEW FIELDS. The avatar has a cropper already; the trainers
  // are the Shoe Rack's active pair, which knows their real mileage. Storing either again gives one fact
  // two homes, and the two disagree the first time somebody changes the other.
  assert.match(e, /activeShoe\(\)/, "the trainers are stored again rather than read from the Shoe Rack");
  const w = nocomment(fn("wireClubEdit"));
  assert.match(w, /hit\.shop = shop\.value/, "the shop link is not stored on the shoe it describes");
  // ⚠️ EVERY FIELD SAVES AS IT IS TYPED. A Save button has a state where what is on screen is not what is
  // stored, and this app has paid for that twice.
  assert.ok(!/id="ceSave"/.test(e), "there is a Save button, so the form can hold unsaved state");
  // ⚠️ AN EXPRESSION-BODIED ARROW CANNOT RE-RENDER, because it has no room for a second statement — a
  // stronger claim than any regex over a block body, which my first version got wrong: [^}]* stops at
  // the first brace, and the object literal being saved contains one, so a handler that DID call
  // render() sailed straight past it.
  assert.match(w, /bio\.oninput = \(\) => put\(/, "the bio does not save as a single expression as it is typed");
  assert.match(w, /fr\.oninput = \(\) => put\(/, "training-for does not save as a single expression");
  // The two block-bodied handlers are checked by slicing to them and forbidding a re-render inside.
  const pbStart = w.indexOf('[data-cepb]');
  const pbEnd = w.indexOf('const shop = ');
  assert.ok(pbStart > 0 && pbEnd > pbStart, "the PB handlers could not be located");
  assert.ok(!/render\(/.test(w.slice(pbStart, pbEnd)),
    "a PB field re-renders the screen as it is typed, so the caret is captured");
});

test("BLOCKER: a typed PB is refused if it is not a time, and it beats a computed best", () => {
  const t = nocomment(fn("clubPbText"));
  // ⚠️ REFUSED, NOT PARSED INTO SECONDS AND PRINTED BACK. A typo of 2104 silently becoming 35 minutes is
  // a claim the runner never made.
  assert.match(t, /\\d\{1,2\}:\\d\{2\}/, "any text is accepted as a time");
  assert.ok(!/parseInt|Number\(/.test(t), "the time is parsed into a number and printed back");
  const c = nocomment(fn("clubChips"));
  assert.match(c, /typed[\s\S]{0,80}pb: true/, "a typed time is not marked as a PB");
  assert.match(c, /best\[r\.label\][\s\S]{0,60}pb: false/, "a computed time is not marked as a best");
  // ⚠️ TWO WORDS BECAUSE THEY ARE TWO CLAIMS: a PB is a race result; a Best is the quickest the app has
  // recorded, training runs included. Showing both for one distance would be two answers to one question.
  const v = fn("viewCommunity");
  assert.match(v, /b\.pb \? "PB" : "Best"/, "the profile does not distinguish a PB from a best");
});

test("BLOCKER: a shop link is only ever a plain web address", () => {
  const h = nocomment(fn("clubShopHref"));
  // ⚠️ THE ONE PLACE A RUNNER'S OWN TEXT BECOMES SOMETHING THE PHONE WILL ACT ON.
  assert.match(h, /new URL\(/, "the address is not parsed at all");
  assert.match(h, /protocol !== "http:" && url\.protocol !== "https:"/,
    "a non-web scheme can be made clickable");
  const v = fn("viewCommunity");
  // ⚠️ COMMENTS STRIPPED. The code's note explaining why the attribute is there quotes the attribute, so
  // deleting the real one left the guard perfectly happy — watched escaping. Tenth firing of that trap
  // in this codebase, and the reason nocomment exists.
  assert.match(nocomment(v), /rel="noopener noreferrer"/,
    "the link hands the page it opens a handle back to the app");
  assert.match(nocomment(v), /\(shopHref\s*\?/, "the name is a link even when no address was given");
});
