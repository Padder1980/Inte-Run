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
/**
 * ⚠️ MEMOISED. The built page is ~13 MB and this file asks for it a hundred times — every fn(), every
 * appBlock(), every stylesheet read. Uncached, adding two appBlock() calls to one test pushed the file
 * past a seven-minute timeout; the content cannot change while the suite runs, so reading it once is
 * both faster and more honest than reading it repeatedly and hoping it has not.
 */
let PAGE_CACHE: string | null = null;
const page = () => (PAGE_CACHE ??= readFileSync(new URL("../web/app.html", import.meta.url), "utf8"));
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
/**
 * ⚠️⚠️ THE BLOCK-COMMENT SWEEP IS ANCHORED TO THE START OF A LINE, AND WITHOUT THAT IT EATS LIVE CODE.
 * `accept="image/*,video/*"` in the app is an unbalanced comment OPENER mid-line, so an unanchored
 * /\*[\s\S]*?\*\/ opens there and closes at the next real terminator — CLAUDE.md records it deleting
 * 10,382 characters once. It bit again here the moment the camera-roll fallback added that attribute: a
 * guard counting `clubEditorFor(` saw 2 of 3, because one of the calls was inside the swallowed window.
 * Anchored, a real block comment (which always starts its own line in this file) is still stripped and a
 * mid-line `/*` inside a string is not.
 */
const nocomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
/** The app's own script block — not the bundled engine, which is minified and has its own names. */
let APP_CACHE: string | null = null;
function appBlock(): string {
  if (APP_CACHE != null) return APP_CACHE;
  const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.reduce((a, b) => (b.length > a.length && b.includes("function viewCommunity(") ? b : a), "");
  assert.ok(app, "the app's script block could not be found");
  APP_CACHE = app;
  return app;
}
/** The app block with its comments stripped — the commonest scope in this file, and the slowest to build. */
let NOAPP_CACHE: string | null = null;
const noApp = () => (NOAPP_CACHE ??= nocomment(appBlock()));
/** ⚠️ SWIFT COMMENTS STRIPPED FOR THE SAME REASON THE PAGE'S ARE. Doc comments in this project explain
 *  why an API is NOT used, so they quote the very names a guard forbids — PHPickerViewController is
 *  named in PhotoLibraryService's header explaining why a picker is not a grid. Eleventh firing of that
 *  trap in this codebase, and the first in Swift. */
const noswift = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[\/!]?.*$/gm, "");
/** ⚠️ THE APP'S OWN FILTER TABLE, read out of the built page rather than retyped — a hand-copied table
 *  is a second source of truth, and this file already records the cost of typing one from memory. */
function clubFiltersTable(): Array<{ id: string; label: string; css: string }> {
  const m = /const CLUB_FILTERS = \[([\s\S]*?)\];/.exec(page());
  assert.ok(m, "CLUB_FILTERS could not be found in the built page");
  const out: Array<{ id: string; label: string; css: string }> = [];
  for (const row of m![1]!.matchAll(/\{\s*id:\s*"(\w+)",\s*label:\s*"([^"]*)",\s*css:\s*"([^"]*)"/g)) {
    out.push({ id: row[1]!, label: row[2]!, css: row[3]! });
  }
  assert.ok(out.length >= 4, "only " + out.length + " filters parsed out of CLUB_FILTERS");
  return out;
}
/**
 * ⚠️⚠️ THE CURVE'S CONSTANTS ARE READ OUT OF THE BUILT PAGE, NEVER TYPED INTO THE PREAMBLE. Written as
 * literals here, a lifted clubToneTable runs against the TEST's constants and not the app's — so
 * changing CLUB_TONE_N in the app escaped its own guard, measured. The same
 * probe-supplies-its-own-table trap this project records for the engine's distance tables.
 */
function clubToneConsts(): string {
  const app = appBlock();
  const out: string[] = [];
  for (const k of ["CLUB_TONE_N", "CLUB_TONE_W", "CLUB_TONE_K", "CLUB_TONE_STEP"]) {
    const m = new RegExp("const " + k + " = ([\\d.]+);").exec(app);
    assert.ok(m, k + " could not be read out of the built page");
    out.push("const " + k + " = " + m![1] + ";");
  }
  return out.join("\n") + "\n";
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

test("BLOCKER: the runner's own pane is built from real data, and the grid is what THEY posted", () => {
  // ⚠️⚠️ RESTATED FOR HIS RULING OF 2026-08-22: "I want the user to decide what to post on their grid,
  // not for it to be automatically added". The grid used to be every run the app had ever recorded, so
  // this guard was about reading the UNCAPPED history rather than the capped store. There is no month
  // grid any more — a run reaches the grid by being posted — so what has to be true instead is that the
  // grid shows posts and nothing else, and that a run cannot arrive there without being asked for.
  const v = nocomment(fn("viewCommunity"));
  assert.match(v, /clubPosts\(\)/, "the grid is not built from what the runner posted");
  assert.ok(!/commMonths|state\.hist/.test(v), "the grid is still filling itself from the run history");
  const auto = nocomment(fn("clubMaybeAutoPost"));
  assert.match(auto, /if \(!run \|\| !clubAuto\(\)\) return/,
    "runs are posted to the grid whether or not the runner asked for it");
  assert.match(auto, /clubRunPosted\(run\)/, "the same run can be posted twice by the automatic path");
  assert.match(nocomment(page()), /function clubAuto\(\) \{ return loadClubProf\(\)\.autoPost === true; \}/,
    "automatic posting is not off by default, so the app decides rather than the runner");
  // The plan line is real, and the two fields this app does not store are not invented.
  const prof = fn("commProfile");
  assert.match(prof, /CURRENT_WEEK/, "the plan position is not read from the plan");
  assert.match(prof, /RACE_LABEL/, "the goal is not the runner's real goal");
  assert.ok(!/@/.test(nocomment(prof)), "commProfile is inventing a handle");
});

test("BLOCKER: a posted run's picture is drawn ONCE, at post time, and through the cache", () => {
  // ⚠️⚠️ THIS INVERTS THE GUARD IT REPLACES, AND THE OLD REASONING WAS HALF WRONG. It said a basemap
  // behind a grid tile would be "roughly 120 billed tiles on first open" — true — and left the
  // implication that it would be 120 EVERY time, which is false, and false because of the cache this app
  // already built: routeMapFor keys on the route and keeps the composite in IndexedDB. He asked for the
  // map ("there is no map sitting behind the route line....this needs fixing"), and the honest answer is
  // that it costs tiles once.
  // ⚠️ AND IT IS BAKED AT POST TIME RATHER THAN DRAWN PER RENDER, which is stronger than the cache: the
  // picture somebody approved is the picture that stays there, and a later change to the map provider,
  // the style or the route privacy cannot repaint a post that is already published.
  const blob = nocomment(fn("clubRunTileBlob"));
  // ⚠️ 3:4 NOW, NOT SQUARE, and the two constants are read by BOTH the canvas and the drawers — the cell
  // became 3:4 on the owner's instruction (2026-08-22) and a square picture in a 3:4 cell is a picture
  // cropped by a quarter. Two owners of one shape is how they come to disagree.
  assert.match(blob, /routeMapFor\(route, S, H, MAP_STYLE_RUN\)/,
    "the posted picture does not go through the one cached map path at the cell's own shape");
  assert.match(blob, /const S = CLUB_TILE_W, H = CLUB_TILE_H/,
    "the tile picture no longer reads the cell's shape from the shared constants");
  const css = page();
  assert.match(css, /\.cm-tile \{[^}]*aspect-ratio: 3 \/ 4/,
    "the grid cell is not 3:4, so the picture drawn for it is the wrong shape");
  assert.ok(!/loadRouteMap/.test(blob), "the posted picture fetches tiles outside the cache");
  assert.match(blob, /runRoutePresentation\(run\)/,
    "the posted picture ignores route privacy, so a hidden start could be published");
  // ⚠️ AND IT FALLS BACK TO THE NUMBERS WITH NO ROUTE, whatever style was asked for — a treadmill run has
  // none by design and an empty square is worse than the facts of the run.
  assert.match(blob, /const want = \(route\.length > 1\) \? kind : "card"/,
    "a run with no route is drawn as an empty map rather than as its numbers");
  assert.ok(!fn("openCommStory").includes("routeMapFor"), "the story viewer fetches billed map tiles");
});

test("BLOCKER: the badge word and its colour come from the one effort mapping", () => {
  // ⚠️ KEYED A SECOND TIME, A TEMPO WOULD BE RUST HERE AND AMBER EVERYWHERE ELSE — which is the defect
  // the owner found on 2026-08-20, and the reason sessionEffort exists as the single answer.
  // ⚠️ THE WHOLE ASSIGNMENT, NOT A MENTION. The first version of this asked whether sessionEffort(t.type)
  // appeared anywhere in the function — which a conditional wrapped around it still satisfies. Watched
  // escaping: `(t.type === "threshold") ? "hard" : sessionEffort(t.type)` passed, and that IS the defect,
  // because a tempo would then be rust here and amber on every other screen.
  // ⚠️ MOVED WITH ITS SUBJECT: the run tile is drawn at post time now, so the two painters that put an
  // effort colour and a word on it are what must ask the one mapping.
  const blob = nocomment(fn("clubRunTileBlob"));
  const eff = (/const eff = ([^;]+);/.exec(blob) || [])[1];
  assert.equal(String(eff).trim(), "runEffort(run)",
    "the posted picture decides its own effort colour: " + eff);
  for (const f of ["clubTileStamp", "clubTileCard"]) {
    const src = nocomment(fn(f));
    assert.ok(!/intensity|targetRpe/.test(src), f + " carries a second opinion about effort");
    for (const t of ["threshold", "vo2", "race", "recovery"]) {
      assert.ok(!new RegExp('=== "' + t + '"').test(src),
        f + " branches on the session type " + t + " rather than asking the one mapping");
    }
    // ⚠️ AND A WORD, NEVER A COLOUR ALONE, which is what makes it readable to a colour-blind runner.
    assert.match(src, /COMM_BADGE\[run\.type\]/, f + " does not take its word from the badge table");
    assert.match(src, /\|\| "RUN"/, f + " renders no word for a type with no badge");
  }
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
  // ⚠️ THE FALLBACK, NOT THE PRIMARY ROUTE, SINCE HIS 2026-08-22 RULING. He asked for the camera roll
  // INSIDE the app, which needs PhotoKit and so needs Swift — so the file input is what an over-the-air
  // page uses on a phone whose native side predates PhotoBridge. It is kept for exactly that reason:
  // deleting it would leave those builds with a grid that can never be filled.
  const p = nocomment(fn("clubPickMany"));
  assert.match(p, /inp\.type = "file"/, "the fallback picker is not a file input");
  assert.match(p, /accept = "image\/\*,video\/\*"/, "the fallback does not accept both photos and video");
  assert.ok(!/capture/.test(p), "the fallback forces the camera, so the camera roll is unreachable");
  assert.match(p, /inp\.remove\(\)/, "the file input is left in the document");
  // ⚠️ THROUGH clubEditorFor, WHICH IS THE ONE PLACE A SELECTION BECOMES AN EDITOR SESSION. Two pickers
  // reach it — this fallback and the in-app grid — and a logbook entry has to carry its words into the
  // editor on both. Written at each call site it is two chances to forget, and the failure is silent:
  // the runner picks a photograph for their logbook and gets an ordinary post with no words on it.
  assert.match(p, /clubEditorFor\(kind, files\)/, "picking files does not open the editor");
  const both = nocomment(page());
  assert.equal((both.match(/clubEditorFor\(/g) || []).length, 3,
    "there is no longer exactly one resolver with exactly two pickers feeding it");
  // ⚠️ AND EVERY ENTRY POINT GOES THROUGH THE OPENER, which decides between the two. A caller that
  // reached the fallback directly would be the one route that never gets the in-app grid.
  const app = nocomment(page());
  assert.ok(!/clubPickMany\("post"\)|clubPickMany\(b\.dataset/.test(app),
    "an entry point reaches the fallback picker directly, bypassing the in-app grid");
  const open2 = nocomment(fn("clubOpenLibrary"));
  assert.match(open2, /if \(!clubLibraryAvailable\(\)\) \{ clubPickMany\(kind\); return; \}/,
    "the opener does not fall back to the system sheet where the grid cannot be drawn");
  // ⚠️ A CAPABILITY FLAG, NEVER A HANDLER-EXISTS TEST. This project nearly shipped a silent coach that
  // way: the handler name had existed for weeks while the action behind it had not.
  assert.match(nocomment(fn("clubLibraryAvailable")), /window\.__interunPhotoLibrary/,
    "the in-app grid is chosen without asking whether this build can draw it");
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
  assert.match(open, /clubOpenLibrary\(kind\)/, "a Create row does not reach the picker");
  assert.match(open, /closeSheet\(\);\s*\n\s*clubOpenLibrary/,
    "the sheet is left open behind the picker");
  // The avatar's plus and the rail's Add both go straight to a story — no Create sheet in between.
  const wire = nocomment(page());
  assert.match(wire, /\[data-cadd\][\s\S]{0,180}clubOpenLibrary\(b\.dataset\.cadd\)/,
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
  // ⚠️ RESTATED WHEN THE Aa MOVED FROM A CORNER RAIL INTO THE TOOL ROW (2026-08-23). The invariant is
  // "the Text tool reaches the on-media surface", not "a button with that id exists" — the third guard
  // in this file to have been scoped to markup rather than to a fact.
  assert.match(wire, /data-ctool/, "the tools are not wired at all");
  const open = nocomment(fn("clubToolOpen"));
  assert.match(open, /clubTextOpen\(-1\)/, "the Text tool does not open the on-media text surface");
  assert.ok(!/prompt\(/.test(open), "the Text tool falls back to a system prompt");
  const d = fn("clubTextDraw");
  // ⚠️ RESTATED WHEN THE THREE FONT PILLS BECAME SIX NAMED STYLES (2026-08-23). The invariant is that the
  // typeface is chosen in the editor; data-cfont was the mechanism, and naming it made this guard fail on
  // the fix — the sixth in three days scoped to a HOW rather than a WHAT.
  assert.match(d, /data-ctst/, "there is no way to choose a typeface");
  assert.match(noApp(), /const CLUB_TX_STYLES = \[/, "there are no named text styles");
  assert.match(d, /data-ccol/, "there is no way to choose a colour");
  // ⚠️ RESTATED 2026-08-24 when the horizontal slider became the reference's left-edge vertical knob.
  // clubTxSz was an element id — a mechanism; the fact is that a size control exists, writes d.size
  // within the same bounds the pinch uses, and repaints the word. The knob's markup is clubEdDraw's
  // (it lives on the stage) and its wiring is wireClubEd's.
  assert.match(fn("clubEdDraw"), /data-cszk/, "there is no size control on the typing stage");
  const knobW = fn("wireClubEd");
  const knobAt = knobW.indexOf("data-cszk");
  assert.ok(knobAt > 0, "the size knob is rendered but never wired");
  assert.match(knobW.slice(knobAt, knobAt + 900), /draft\.size = [\s\S]*?clubDraftPaint\(\)/,
    "the size knob does not write d.size and repaint the word");
  // ⚠️ EACH STYLE BUTTON IS SET IN ITS OWN LOOK — six labels in one typeface is not a choice you can see.
  // Restated when the three font pills became six named styles: the button now carries the style's whole
  // declaration rather than just a family, so the claim is that it wears it, not how it is spelled.
  assert.match(d, /data-ctst="' \+ st\.id \+\s*'" style="' \+ st\.css/,
    "the style buttons are not set in the looks they offer");
  const styles = /const CLUB_TX_STYLES = \[([\s\S]*?)\n\];/.exec(noApp());
  assert.ok(styles, "CLUB_TX_STYLES could not be read");
  const rows = [...styles![1]!.matchAll(/\{ id: "(\w+)", label: "([^"]+)",/g)];
  assert.ok(rows.length >= 4, "only " + rows.length + " named styles");
  // ⚠️ AND THE LOOKS MUST GENUINELY DIFFER. Six pills that all render the same is a choice you cannot
  // see, which is the same fault as labelling them all in one face.
  const decls = [...styles![1]!.matchAll(/css: "([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(decls.length, rows.length, "a named style has no declaration");
  assert.equal(new Set(decls).size, decls.length, "two named styles are the same look");
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
  // ⚠️ RESTATED 2026-08-24 WHEN THE GESTURE MOVED ONTO A SHARED RECORD. It pinned `moved = true`,
  // `if (!moved) { clubTextOpen(i); ... }` and the literal `> 4` — all three of which are now spelled
  // differently for the same behaviour, so the guard failed on correct code. Fifth time in this file a
  // guard was scoped to a HOW instead of a WHAT; the invariant is that travel decides.
  const d = nocomment(fn("clubTextDrag")) + "\n" + nocomment(fn("clubTxMove")) + "\n"
    + nocomment(fn("clubTxUp"));
  assert.match(d, /\bmoved = true/, "a drag and a tap are not told apart");
  // ⚠️ RESTATED 2026-08-24: the character window ({0,80}) could not hold the commit-then-edit branch —
  // "a character window is not a card", which this repo has now paid for five times. The claim is that
  // the not-moved branch reaches clubTextOpen; how far away it sits is not the claim.
  const notMoved = /if \(!\w*\.?moved\) \{([\s\S]*?)\n  \}/.exec(d);
  assert.ok(notMoved, "there is no not-moved branch, so a tap and a drag are one gesture");
  assert.match(notMoved![1]!, /clubTextOpen\(/, "a tap on a word does not edit it");
  // ⚠️ AND A TAP ON ANOTHER WORD WHILE ONE IS BEING TYPED COMMITS FIRST — otherwise clubTextOpen
  // overwrites S.draft and the uncommitted word is silently lost. Re-found by OBJECT because
  // committing an emptied word splices the array and an old index would name its neighbour.
  assert.match(notMoved![1]!, /clubTextCommit\(\)/,
    "editing a second word abandons the first one's uncommitted changes");
  assert.match(notMoved![1]!, /indexOf\(target\)/,
    "the tapped word is re-found by index across a commit that can splice the array");
  assert.match(d, /Math\.abs\([^)]*\) > \d/,
    "the travel threshold is missing, so every tap reads as a drag or vice versa");
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
  assert.match(v, /uploads\.length \? clubTabsHtml\(anyLog\) : ""/,
    "the tabs show with nothing to filter");
  assert.match(v, /vidOnly = which === "video", logOnly = which === "logbook"/,
    "the filter is not read from the tab");
  assert.match(v, /uploads\.filter\(\(u\) => u\.video\)/, "Videos does not filter to videos");
  // ⚠️ RESTATED TWICE. There are no run tiles to filter any more — the grid is posts, so Videos is a
  // filter over posts alone — and there is now a third tab, the LOGBOOK area the owner asked for
  // (2026-08-22). What still has to hold is that each tab filters rather than showing everything, and
  // that an empty one gets a sentence rather than an empty three-column area.
  assert.match(v, /vidOnly \? uploads\.filter\(\(u\) => u\.video\)/,
    "the Videos tab does not actually filter");
  assert.match(v, /logOnly \? uploads\.filter\(\(u\) => u\.logbook\) : uploads/,
    "the Logbook tab does not actually filter");
  assert.match(v, /No videos yet/, "a runner with no videos gets an empty three-column area");
  assert.match(v, /No logbook entries yet/, "an empty logbook gets an empty three-column area");
  // ⚠️ AND THE THIRD TAB ONLY EXISTS ONCE THERE IS AN ENTRY, the same rule Videos was held to: a tab
  // that can never have a member is the defect that made Videos wait for months.
  assert.match(v, /anyLog = uploads\.some\(\(u\) => u\.logbook\)/,
    "the Logbook tab is offered whether or not there is anything in it");
  const tabs = fn("clubTabsHtml");
  assert.match(tabs, /has \? tab\("logbook"/, "the Logbook tab is not gated on there being one");
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
  // ⚠️ RESTATED FROM A COUNT TO THE INVARIANT (2026-08-24). A ceiling on the number of callers fails
  // every time a new surface legitimately needs the loader — the journal's kept strip made it six — and
  // what it was protecting is not the count but that NOTHING ELSE fills a data-cmed span itself.
  const app = noApp();
  const callers = [...app.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!)
    .filter((n) => n !== "clubFillMedia" && nocomment(fn(n)).indexOf("clubFillMedia()") >= 0);
  assert.ok(callers.length >= 2,
    "only " + callers.length + " function calls the loader; the tile, the ring and the viewer all need it");
  const rogue = [...app.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!).filter((n) => {
    if (n === "clubFillMedia") return false;
    const body = nocomment(fn(n));
    // A second loader would read a data-cmed key and put media in the span itself.
    return /dataset\.cmed/.test(body) && /innerHTML\s*=/.test(body);
  });
  assert.deepEqual(rogue, [],
    "these fill a media span themselves instead of asking clubFillMedia: " + rogue.join(", "));
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
  assert.match(c, /URL\.revokeObjectURL\(sl\.url\)/, "the editor leaks the files it was editing");
  // ⚠️ AND THE OVERLAYS' URLS, which are each their own createObjectURL — releasing only the slide's
  // leaks a whole photograph per overlay for the life of the app session.
  assert.match(c, /\(sl\.ov \|\| \[\]\)\.forEach\([^)]*\) => \{ try \{ URL\.revokeObjectURL\(o\.url\)/,
    "the editor leaks the overlays it was editing");
  // ⚠️ RESTATED 2026-08-24: the invariant is that NOTHING the text editor creates outlives
  // clubEdClose. The old panel was a body-level sibling, so this used to assert its own teardown line;
  // the chrome is a CHILD of #clubEd now, so the one remove() above takes it — and the discriminating
  // claim moved to the builder: it must never append outside the editor.
  assert.doesNotMatch(nocomment(fn("clubTextDraw")), /document\.body\.appendChild/,
    "the typing chrome is appended to document.body, where clubEdClose cannot reach it");
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
  // ⚠️ RESTATED, NOT DELETED, WHEN THE DIMMING BECAME THE SELECTION'S OWN OUTER SHADOW (2026-08-23). The
  // invariant is "the time outside the window is dimmed"; it used to be two square rectangles beside it,
  // whose corners were the untidiness he reported three times. The guard named the mechanism, so it
  // failed on the fix — the fourth guard in three days scoped to a HOW rather than a WHAT.
  assert.ok(!/club-shade/.test(t), "the two square shade rectangles are back");
  assert.match(nocomment(sheetOf(page())), /\.club-win\s*\{[^}]*box-shadow:\s*0 0 0 \d+px/,
    "the time outside the window is not dimmed");
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
  // ⚠️ RESTATED FOR THE OVERLAYS (2026-08-23): a slide's blob and its overlays' blobs go in the SAME
  // all-or-nothing pass, so the claim is that every clubMediaPut is collected before the row is written
  // rather than that they come from one .map — which stopped being true when overlays arrived.
  assert.match(post, /Promise\.all\(puts\)/, "the blobs are not all written before the row");
  const puts = [...post.matchAll(/clubMediaPut\(/g)].length;
  assert.equal(puts, 2, "expected exactly two clubMediaPut call sites — the slide and its overlays — "
    + "found " + puts + "; one outside the collected pass is a blob the all-or-nothing rule misses");
  assert.ok(post.indexOf("puts.push") < post.indexOf("Promise.all(puts)"),
    "a blob is queued after the pass that waits for them");
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
  for (const bit of ["ceAvatar", "ceBio", "ceFor", "clubBack"]) {
    assert.ok(e.includes(bit), "the edit page is missing " + bit);
  }
  // ⚠️ THE PB ROWS MOVED INTO THEIR OWN BUILDER when they became wheels, so the page names that rather
  // than a field id. Their own behaviour is guarded where the wheels are.
  assert.match(e, /CLUB_PB_ROWS\.map\(\(r\) => clubPbRowHtml\(r, cp\.pbs\[r\.k\]\)\)/,
    "the edit page no longer renders a row per distance");
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
  // ⚠️ THE SCOPE IS DERIVED FROM WHOEVER RENDERS THE ADDRESS, NOT NAMED. Written as fn("viewCommunity")
  // it failed on correct code the day the shoe moved from its own row onto the meta line (2026-08-22) —
  // the second guard in this file to be scoped to a layout rather than to a fact. Every function that
  // turns clubShopHref's result into an href must carry both attributes.
  const app = noApp();
  const fns = [...app.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!);
  let rendered = 0;
  for (const name of fns) {
    const body = nocomment(fn(name));
    if (name === "clubShopHref" || !/href="' \+ esc\(shopHref\)/.test(body)) continue;
    rendered++;
    // ⚠️ COMMENTS STRIPPED. The code's note explaining why the attribute is there quotes the attribute,
    // so deleting the real one left the guard perfectly happy — watched escaping. Tenth firing of that
    // trap in this codebase, and the reason nocomment exists.
    assert.match(body, /rel="noopener noreferrer"/,
      name + " hands the page it opens a handle back to the app");
    assert.match(body, /target="_blank"/, name + " opens the runner's own link inside the app");
    assert.match(body, /\(shopHref\s*\?/, name + " links the name even when no address was given");
  }
  assert.equal(rendered, 1,
    "expected exactly one builder to render the shop address; found " + rendered);
});

/* ══ HIS SEVEN CHANGES OF 2026-08-22 (evening) ══════════════════════════════════════════════════════
 * The camera roll inside the app, the story's layout, the PB capsules, the trainer icon, Inte-Club on
 * the share card, the grid being chosen rather than automatic, and a map behind the route.
 */
test("BLOCKER: the camera roll is drawn inside the app, and asks for nothing until it is opened", () => {
  const swift = noswift(readFileSync(new URL("../ios/InteRun/PhotoLibraryService.swift", import.meta.url), "utf8"));
  const bridge = noswift(readFileSync(new URL("../ios/InteRun/PhotoBridge.swift", import.meta.url), "utf8"));
  // ⚠️ A PICKER AND A GRID ARE DIFFERENT THINGS, and that distinction is the whole point of the native
  // side. PHPickerViewController is presented BY THE SYSTEM over the app — somebody else's screen — and
  // teaches the app nothing about the library. He asked for Instagram's own grid, which means the app
  // enumerates the library itself.
  assert.ok(!/PHPickerViewController/.test(swift + bridge),
    "the native side presents the system picker, which is the screen he asked to replace");
  assert.match(swift, /PHAsset\.fetchAssets\(with: opts\)/, "the library is never enumerated");
  // ⚠️ THE FETCH RESULT IS HELD, NOT THE ASSETS. A PHFetchResult is lazy; materialising a ten-year roll
  // into an array on first call is a stall on open for a grid nobody has scrolled yet.
  assert.match(swift, /private static var cached: PHFetchResult<PHAsset>\?/,
    "the fetch result is not held, so every page re-queries the whole library");
  assert.match(swift, /func page\(offset: Int, limit: Int\)/, "the library is not paged");
  // ⚠️ PERMISSION IS ASKED FOR ON THE PATH THAT NEEDS IT. A prompt at launch is a prompt with no
  // context, and from the app's side a refusal is permanent.
  assert.ok(!/requestAuthorization/.test(noswift(readFileSync(new URL("../ios/InteRun/InteRunApp.swift", import.meta.url), "utf8"))),
    "the photo permission is requested at launch rather than when the picker is opened");
  // ⚠️ LIMITED ACCESS IS A FIRST-CLASS ANSWER. Somebody who shared a chosen handful is curating, not
  // refusing; treating it as a refusal leaves them looking at an empty grid.
  assert.match(swift, /case \.limited: return "limited"/, "a limited grant is not reported as its own state");
  assert.match(bridge, /case "manage"/, "there is no way to widen a limited grant");
  // ⚠️ THE DEGRADED PASS IS IGNORED. PhotoKit answers twice for an iCloud asset and the first is a blur;
  // replying to it would put a smeared thumbnail in the grid permanently, because the page caches it.
  assert.match(swift, /PHImageResultIsDegradedKey/, "the blurry first pass is served as the thumbnail");
});

test("BLOCKER: the pixels come over the app's own scheme, never through the bridge", () => {
  const bridge = noswift(readFileSync(new URL("../ios/InteRun/PhotoBridge.swift", import.meta.url), "utf8"));
  const scheme = noswift(readFileSync(new URL("../ios/InteRun/BundleSchemeHandler.swift", import.meta.url), "utf8"));
  // ⚠️ A BASE64 ROUND TRIP FOR A THIRTY-MEGABYTE VIDEO IS A STALL THE RUNNER WATCHES. The handler answers
  // with small JSON; the bytes stream over interun://app, which WebKit handles like any other resource.
  assert.ok(!/base64EncodedString/.test(bridge), "the bytes are base64'd back through evaluateJavaScript");
  assert.match(bridge, /static let pathPrefix = "\/__photo\/"/, "there is no path for the pixels");
  // ⚠️ THE APP'S OWN ORIGIN, NOT A SECOND SCHEME. localStorage is keyed to interun://app; a photograph
  // from anywhere else would sit outside everything the app owns.
  assert.match(scheme, /url\.path\.hasPrefix\(PhotoBridge\.pathPrefix\)/,
    "the scheme handler does not serve the photo path");
  // ⚠️ AND BEFORE resolve(), which would look for a file of that name in the bundle and 404.
  assert.ok(scheme.indexOf("PhotoBridge.pathPrefix") < scheme.indexOf("let file = resolve(url)"),
    "the photo path is checked after the bundle lookup, so it always 404s");
  // ⚠️ NO-STORE: an identifier outlives an edit, so a cached copy shows the version before the crop.
  assert.match(scheme, /"Cache-Control": "no-store"/, "a photograph is cached under an identifier that can change");
  // ⚠️ AN UNKNOWN ACTION IS ANSWERED. A page waiting on a reply that never comes is a grid that spins
  // for the rest of the run — the failure this project already records for the coach's bridge.
  assert.match(bridge, /default:[\s\S]{0,200}reply\(body, \["error"/, "an unknown action is dropped in silence");
  // And the page never waits forever either.
  assert.match(nocomment(fn("clubPhotoAsk")), /setTimeout\(\(\) => \{[\s\S]{0,120}res\(null\);/,
    "a request with no reply hangs the grid");
});

test("BLOCKER: the story's chrome clears the status bar and its route is not stretched", () => {
  const style = sheetOf(page());
  // ⚠️ MEASURED ON HIS SCREENSHOT: the progress bars ran through the 10:46 and the avatar sat on top of
  // it, because the overlay is fixed at inset 0 — which is the whole screen, clock included.
  const bars = /\.cm-bars \{[^}]*\}/.exec(style);
  assert.ok(bars, "no .cm-bars rule");
  assert.match(bars[0], /env\(safe-area-inset-top/, "the story's progress bars run through the status bar");
  // ⚠️ AND THE ROUTE WAS STRETCHED — routeMapSvg carries preserveAspectRatio="none" by design, so a
  // 320x200 drawing forced into a tall story is pulled almost 3x vertically. The fix is a box of the
  // right shape; object-fit does nothing at all for an inline SVG.
  // ⚠️ THE ASPECT COMES FROM THE MARKUP, NOT THE STYLESHEET, and from the same two constants the drawing
  // is sized with — a number in the CSS and the same number in the call is two owners of one measurement.
  const story = nocomment(fn("openCommStory"));
  assert.match(story, /routeMapSvg\(route, null, STORY_ART_W, STORY_ART_H\)/,
    "the story's route is not drawn at the story's own shape");
  assert.match(story, /style="aspect-ratio:' \+ STORY_ART_W \+ ' \/ ' \+ STORY_ART_H/,
    "the box does not carry the same aspect the drawing was made at, so the route is stretched");
  // ⚠️⚠️ AND THE DRAWING MUST HONOUR THE BOX IT IS GIVEN — asserted by EXECUTING it, because the caller
  // passing the right size proves nothing about whether it is used. routeMapSvg's no-projection branch
  // hardcoded a 320x200 viewBox and discarded its arguments, so with preserveAspectRatio="none" every
  // caller whose box was a different shape got the route pulled to fit: the story was stretched 2.76x
  // vertically and still looked like a route. Reverting that escaped a guard that only checked the call.
  // The three helpers it calls only draw markers; stub them so the geometry can be measured on its own.
  const body = nocomment(fn("routeMapSvg"))
    .replace(/^function routeMapSvg\(route, proj, vbW, vbH\) \{/, "")
    .replace(/\}\s*$/, "");
  const svgOf = (w: number, h: number) => new Function(
    "route", "proj", "vbW", "vbH", "routeLogoDefs", "routeLogoMark", "routeFinishMark", body
  )([{ lat: 54.9, lng: -1.6 }, { lat: 54.95, lng: -1.55 }], null, w, h,
    () => "", () => "", () => "");
  for (const [w, h] of [[360, 620], [320, 200], [1080, 1080]] as Array<[number, number]>) {
    const out = svgOf(w, h);
    assert.match(out, new RegExp('viewBox="0 0 ' + w + ' ' + h + '"'),
      "routeMapSvg discards the box it was given at " + w + "x" + h + ", so the route is stretched to fit");
  }
  const sart = /\.cm-sart \{[^}]*\}/.exec(style);
  assert.ok(sart, "no .cm-sart rule");
  assert.ok(!/aspect-ratio/.test(sart[0]),
    "the stylesheet holds a second copy of the story's aspect, which can drift from the drawing's");
});

test("BLOCKER: the PB capsules are the size of the label beside them, white with a teal edge", () => {
  const style = sheetOf(page());
  const chip = /\.cm-chip-acc \{[^}]*\}/.exec(style);
  assert.ok(chip, "no .cm-chip-acc rule");
  // ⚠️ THE SIZE IS TIED TO THE LABEL, NOT PICKED BY EYE: "they need to be the same size as the word
  // TIMES", so both read --t-label. Two things that must match should come from one place.
  const eyebrow = /\.cm-eyebrow \{[^}]*\}/.exec(style);
  assert.ok(eyebrow, "no .cm-eyebrow rule to compare the capsule against");
  const chipSize = (/font-size: (var\(--t-[a-z]+\))/.exec(chip[0]) || [])[1];
  const eyeSize = (/font-size: (var\(--t-[a-z]+\))/.exec(eyebrow[0]) || [])[1];
  assert.equal(chipSize, eyeSize, "the capsule is not the same size as the label beside it");
  assert.match(chip[0], /color: var\(--accent\)/, "the capsule's text is not teal");
  assert.match(chip[0], /background: var\(--surface-2\)/, "the capsule is not white");
  assert.match(chip[0], /border: 1px solid var\(--accent\)/, "the capsule has no teal outline");
});

test("BLOCKER: the trainers fact wears a trainer, not a runner", () => {
  const app = appBlock();
  // ⚠️ rEasy IS A RUNNING FIGURE and was standing in for the shoe — a picture of a person where the
  // sentence is about footwear.
  assert.match(app, /shoe: '<svg/, "there is no trainer icon at all");
  // ⚠️ RESTATED, NOT DELETED, WHEN THE SHOE LEFT ITS OWN ROW FOR THE META LINE (2026-08-22). The old
  // form pinned the MARKUP it happened to sit in (`cm-tr">' + ICON.shoe`), so it failed on correct code
  // the moment the row was regrouped — and deleting it would have dropped a live invariant with the
  // dead layout. The claim is about whatever renders the trainers, wherever that is.
  const meta = nocomment(fn("commMetaLine"));
  assert.ok(meta.indexOf("ICON.shoe") > 0, "the trainers fact does not wear the trainer icon");
  assert.ok(meta.indexOf("ICON.rEasy") < 0, "the trainers fact wears the running figure");
  assert.ok(!/live-shoe" id="lShoe">' \+ ICON\.rEasy/.test(app),
    "the live start screen's shoe chip still wears the running figure");
});

test("BLOCKER: Inte-Club is a share destination that needs no bridge and never falls to the sheet", () => {
  const app = appBlock();
  assert.match(app, /id: "inteclub", label: "Inte-Club"/, "Inte-Club is not a share destination");
  const to = nocomment(fn("shareToClub"));
  // ⚠️ IT POSTS THE CARD THAT IS ON SCREEN, not a second rendering — prepareShareCard already holds the
  // exact bytes the other tiles hand out, so what lands on the grid is what he was looking at.
  assert.match(to, /prepareShareCard\(run\)/, "the club tile re-renders the card instead of posting it");
  assert.ok(!/shareCardCanvas|drawShareCard/.test(to), "the club tile draws its own second card");
  // ⚠️ RESTATED FOR HIS 2026-08-22 RULING: the tile no longer writes the row itself. It asks story or
  // grid and hands the card to the EDITOR, so he can type over it or write a caption — "it needs to give
  // me the option of sharing to story or grid…..and being able to edit". The row is then written by
  // clubEdPost, which is the one writer for everything on the grid, and that is a stronger version of
  // what this used to assert: not "it writes the ordinary shape" but "it does not write a shape at all".
  assert.ok(!/clubSave\(|clubMediaPut\(/.test(to), "the club tile still writes its own grid entry");
  // ⚠️ THE ASK MOVED, AND THE CLAIM DID NOT. It used to be drawn inside shareToClub with the app's own
  // bottom sheet — .sheet-ov, z-index 70 — while the share studio is .sst-ov at 92, so it opened BEHIND
  // the card: invisible and untappable. The runner tapped Inte-Club, the destinations sheet closed, and
  // they were looking at the share card again with nothing having happened. It is a studio sheet now.
  // ⚠️ Guard moved with it rather than deleted, per this repo's own rule about a comment naming a test
  // that is not there.
  const ask = nocomment(fn("studioClubHtml"));
  assert.match(ask, /data-sst="clubstory"/, "the club tile does not offer a story");
  assert.match(ask, /data-sst="clubpost"/, "the club tile does not offer the grid");
  // And the ask is drawn where it can actually be seen — never with the app's sheet, which is under it.
  for (const bad of ["ensureSheet(", "sheetBody", "sheetOv"]) {
    assert.ok(to.indexOf(bad) < 0 && ask.indexOf(bad) < 0,
      "the story-or-grid ask uses the app's bottom sheet (" + bad + "), which renders under the studio");
  }
  assert.match(to, /openClubEditor\(kind, \[file\],/, "the card does not reach the editor");
  // ⚠️ THE STUDIO CLOSES FIRST, or the editor opens behind it — both are full-screen and the studio is
  // the later one in the stack.
  assert.ok(to.indexOf("closeShareStudio()") < to.indexOf("openClubEditor"),
    "the editor is opened before the studio closes, so it opens behind it");
  assert.match(to, /runId: String\(run\.id/, "the posted card does not remember which run it is of");
  // ⚠️ AND THE CARD IS FITTED, NOT CROPPED, on every surface that shows it. Cover is right for a
  // photograph — raw material the runner is framing — and wrong for a card the app itself composed:
  // measured, it cut "Inte-Run" and the distance off both edges.
  // ⚠️ PASSED IN, NOT PATCHED ON AFTERWARDS. Set on the returned editor it landed AFTER the first paint,
  // so nothing had the flag and the stage cropped the card anyway — measured, object-fit read "cover".
  assert.match(to, /openClubEditor\(kind, \[file\],\s*\n?\s*\{ card: true/,
    "the card is not marked as finished when the editor opens, so the stage crops it");
  assert.ok(!/CLUBED\.slides\[0\]\.card = true/.test(to),
    "the flag is patched on after the editor has already drawn");
  const style2 = sheetOf(page());
  const fitRule = /\.club-med-fit[^{]*\{[^}]*\}/.exec(style2);
  assert.ok(fitRule, "there is no rule that fits a finished card");
  assert.match(fitRule[0], /object-fit: contain/, "a finished card is not fitted");
  for (const sel of ["cm-t-med-fit", "cp-med-fit", "club-vmed-fit", "club-cap-i-fit"]) {
    assert.ok(fitRule[0].includes(sel),
      sel + " is not in the one fit rule, so that surface can crop what another shows whole");
  }
});

test("BLOCKER: a run reaches the grid by being asked for, and the picture is chosen", () => {
  const app = appBlock();
  // ⚠️ HIS RULING. Every route to the grid is a decision: a button on the run, or a switch he turned on.
  assert.match(app, /id="clubPostRun"/, "there is no way to post a run from its own page");
  const sheet2 = nocomment(fn("openClubPostRunSheet"));
  assert.match(sheet2, /CLUB_TILE_STYLES\.map/, "the runner cannot choose what the picture looks like");
  assert.match(sheet2, /clubRunPosted\(run\)/, "a run already on the grid is posted again in silence");
  // ⚠️ THE SAME THREE CHOICES ON BOTH PATHS, so the automatic and the manual route cannot produce
  // different-looking grids.
  const edit = nocomment(fn("viewClubEdit"));
  assert.match(edit, /CLUB_TILE_STYLES\.map/, "the automatic path offers no choice of picture");
  assert.match(edit, /clubAuto\(\)\s*\n?\s*\?[\s\S]{0,200}CLUB_TILE_STYLES/,
    "the style picker shows even when automatic posting is off, so it governs nothing");
  // ⚠️ ONE CALL SITE AT SAVE, beside the Strava one, because that is the one place the phone and the
  // wrist both arrive — a hook on one and not the other is this project's most-repeated trap.
  const calls = (nocomment(app).match(/clubMaybeAutoPost\(/g) || []).length;
  assert.equal(calls, 2, "clubMaybeAutoPost has " + calls + " mentions; expected its definition and one call");
  assert.match(nocomment(app), /stravaMaybeAutoSend\(state\.logged\[0\]\);\s*\n[\s\S]{0,400}clubMaybeAutoPost\(state\.logged\[0\]\)/,
    "the automatic post is not on the shared save path");
});

test("BLOCKER: every field the club profile can store survives being read back", () => {
  // ⚠️⚠️ THIS CAUGHT A REAL DEFECT THE MOMENT IT WAS WRITTEN. loadClubProf returned bio, trainingFor and
  // pbs alone, so autoPost was written correctly, stored correctly, and dropped by the very next read:
  // measured on the served page, the store held {"autoPost":true} while clubAuto() answered false and the
  // switch stayed off. A reader that whitelists has to be updated for every new field, and forgetting is
  // silent — the same shape as the run record's three invented identifiers, from the other direction.
  //
  // ⚠️ THE FIELD LIST IS DERIVED FROM THE WRITERS, not typed here. A hand-written list goes stale the
  // first time somebody adds a setting, which is exactly the failure being guarded.
  const app = appBlock();
  // ⚠️ BOTH WRITE SHAPES. Two of the five fields go through the edit page's own put() helper and three
  // through saveClubProf directly — a sweep that knew only one found three of five and reported the
  // sweep itself as broken, which is the collection-too-narrow half of this kind of guard.
  const written = new Set<string>();
  for (const m of app.matchAll(/saveClubProf\(Object\.assign\(cur, \{ ([a-zA-Z]+):/g)) written.add(m[1]!);
  // ⚠️ SCOPED TO wireClubEdit, WHERE put() IS DEFINED. Swept over the whole app script it also matched a
  // put({ k: ... }) belonging to something else entirely and reported "k" as a dropped club field.
  for (const m of nocomment(fn("wireClubEdit")).matchAll(/put\(\{ ([a-zA-Z]+):/g)) written.add(m[1]!);
  assert.ok(written.size >= 5,
    "only " + written.size + " writable fields found (" + [...written].join(", ") +
    "); the sweep is not reaching every writer");
  // ⚠️ THE SUCCESS RETURN, NOT THE WHOLE FUNCTION. The catch fallback names every field too, so scanning
  // the function body was satisfied by the fallback alone — watched escaping with autoPost deleted from
  // the real return. Each half is checked against its own text.
  const load = nocomment(fn("loadClubProf"));
  const ok = (/return (\{[\s\S]*?\});\n\s*\} catch/.exec(load) || [])[1] || "";
  assert.ok(ok, "the successful return of loadClubProf could not be located");
  const missing = [...written].filter((f) => !new RegExp("\\b" + f + ":").test(ok));
  assert.deepEqual(missing, [],
    "written to the club profile and dropped when it is read back: " + missing.join(", "));
  // ⚠️ AND THE FALLBACK CARRIES THEM TOO, or a corrupt store silently resets a setting to a value the
  // runner never chose rather than to its default.
  // ⚠️ THE OBJECT LITERAL CONTAINS A BRACE OF ITS OWN (pbs: {}), so [^}]* stops inside it — the same
  // first-brace mistake this file already records making on a field handler. Matched to the end of the
  // return statement instead.
  const fallback = (/catch \(e\) \{ return (\{[\s\S]*?\}); \}/.exec(load) || [])[1] || "";
  const gone = [...written].filter((f) => !new RegExp("\\b" + f + ":").test(fallback));
  assert.deepEqual(gone, [], "the parse fallback drops: " + gone.join(", "));
});

test("BLOCKER: a personal best is picked on wheels, and cannot hold an invalid time", () => {
  // ⚠️⚠️ THE FAULT WAS AN INVENTED MECHANISM, AND HIS SCREENSHOT SHOWED IT: a bare text field took "1751"
  // and marked it red, while this app has had a digits-to-time input since the setup form's own 5 km
  // question (fmtDigitsToTime turns 1751 into 17:51 as you type). Writing a new field instead of using
  // the one that exists is the same class as inventing a CSS class or a token — there was already an
  // answer. His suggestion is better than either: a PB is a number the runner already knows, so the only
  // thing typing can add is a way to get it wrong.
  const row = nocomment(fn("clubPbRowHtml"));
  assert.ok(!/<input/.test(row), "the PB row is still a text field, which can hold something that is not a time");
  assert.match(row, /<select class="ce-w"/, "the PB row has no wheels");
  // ⚠️ NATIVE SELECTS ARE WHAT MAKE THEM WHEELS — iOS presents one as its own scrolling picker. A
  // hand-rolled wheel is a scroll container pretending to be one, with none of the accessibility.
  assert.match(row, /aria-label="' \+ esc\(r\.label \+ " " \+ label\)/, "a wheel is announced without saying which");
  assert.match(row, /wheel\("h", 10,[\s\S]{0,80}wheel\("m", 60,[\s\S]{0,80}wheel\("s", 60,/,
    "the three wheels are not hours, minutes and seconds");
  // ⚠️ ALL THREE AT ZERO MEANS NOT SET. Without it every distance the runner has not filled in reads
  // "0:00" on their profile as a claimed record — four fabricated PBs on a screen they might show someone.
  const from = nocomment(fn("clubPbFromWheels"));
  assert.match(from, /if \(!h && !m && !s\) return ""/, "an untouched row claims 0:00 as a personal best");
  // ⚠️ AND THE HOURS ARE DROPPED WHEN ZERO, so a 5 km reads 21:04 rather than 0:21:04.
  assert.match(from, /return h \? h \+ ":" \+ mm \+ ":" \+ ss : mm \+ ":" \+ ss/,
    "a time under an hour is written with a leading zero hour");
  // ⚠️ AND ANYTHING TYPED BEFORE THE WHEELS EXISTED STILL LOADS, in either shape — a reader that only
  // understood the new form would silently blank somebody's PB.
  const parse = nocomment(fn("clubPbParse"));
  assert.match(parse, /m\[3\] != null/, "an older mm:ss value is not distinguished from h:mm:ss");
  assert.match(parse, /Math\.min\(9, Number\(m\[1\]\)\)/, "a stored hour beyond the wheel's range is not clamped");
  // No error state can exist, so nothing marks one.
  assert.ok(!/\bbad\b/.test(row + from), "the PB row still carries an invalid state it cannot reach");
});

test("BLOCKER: the club share tile wears the Inte-Run mark, from the brand mark's own geometry", () => {
  const app = appBlock();
  const glyph = (/club: '(<svg[\s\S]*?<\/svg>)'/.exec(app) || [])[1] || "";
  assert.ok(glyph, "the club tile has no mark at all");
  // ⚠️ THE BRAND MARK'S OWN SHAPES, scaled from its 120 box to the row's 24 one (x0.2): the dot at
  // (82,37) r11 becomes (16.4,7.4) r2.2, and the second slash keeps the .62 it carries on the splash.
  // Derived from BRAND_MARK rather than typed, so a change to the logo is visible as a mismatch here.
  const brand = (/const BRAND_MARK = `([\s\S]*?)`;/.exec(readFileSync(new URL("../web/app.ts", import.meta.url), "utf8")) || [])[1] || "";
  const bc = /<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/.exec(brand);
  assert.ok(bc, "the brand mark has no dot to scale from");
  const k = 24 / 120;
  const want = [Number(bc[1]) * k, Number(bc[2]) * k, Number(bc[3]) * k].map((n) => +n.toFixed(2));
  const gc = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(glyph);
  assert.ok(gc, "the club mark has no dot");
  assert.deepEqual([Number(gc[1]), Number(gc[2]), Number(gc[3])], want,
    "the club mark's dot is not the brand mark's own, scaled to this grid");
  assert.match(glyph, /opacity="\.62"/, "the second slash has lost the brand mark's own weighting");
  // ⚠️ currentColor, NOT THE BRAND GRADIENT. A gradient-filled app icon in a row of line drawings reads
  // as somebody else's logo pasted in — which is the reason the other tiles are our own strokes rather
  // than Instagram's and WhatsApp's real marks.
  assert.match(glyph, /fill="currentColor"/, "the club mark carries a colour of its own");
  assert.ok(!/linearGradient|#[0-9a-fA-F]{3,6}/.test(glyph), "the club mark carries a hex or a gradient");
});

test("BLOCKER: the club destination picks the card's shape, and puts back what was selected", () => {
  // ⚠️⚠️ A 9:16 STORY CARD IN A SQUARE GRID CELL IS MOSTLY WHITE BARS, measured on the served build, and a
  // 4:5 feed card in a story is letterboxed the other way. Choosing story or grid IS choosing the shape,
  // so the card is rendered at the shape it is going to rather than at whatever chip was selected.
  const to = nocomment(fn("shareToClub"));
  assert.match(to, /SCARD\.aspect = \(kind === "story"\) \? "story" : "feed"/,
    "the card is rendered at whatever aspect was selected rather than the one it is going to");
  // ⚠️ AND IT IS PUT BACK. If the render fails the studio stays open, and it must not have changed shape
  // underneath him — the same reason every temporary state in this app is restored on both paths.
  assert.match(to, /const was = SCARD\.aspect;/, "the selected aspect is not remembered");
  const restores = (to.match(/SCARD\.aspect = was/g) || []).length;
  assert.equal(restores, 2, "the aspect is restored on " + restores + " of the two paths; expected both");
  assert.ok(to.indexOf("SCARD.aspect = was") < to.indexOf("openClubEditor"),
    "the aspect is restored after the editor opens, so a failure leaves the studio in the wrong shape");
});

test("BLOCKER: the feed pane is the empty state and nothing else", () => {
  // ⚠️ HIS INSTRUCTION: "it shouldn't look like that, it will be empty until there are other users
  // posting". The design puts a stories rail on the feed, and with nobody to follow it held only the
  // runner's own story beside an Add button — a row of two things above a message saying there is
  // nothing to show.
  const v = nocomment(fn("viewCommunity"));
  const pane = v.slice(v.lastIndexOf('<section class="cm-pane">'));
  assert.match(pane, /commFeedHtml\(\)/, "the feed pane no longer renders the feed");
  assert.ok(!/cm-rail/.test(pane), "the stories rail is still on the feed pane");
  // ⚠️ AND NOTHING IS LOST: the avatar on the other pane opens the story and its + badge adds one.
  assert.match(v, /data-cstory="1"/, "there is no way to open a story at all any more");
  assert.match(v, /data-cadd="story"/, "there is no way to add a story at all any more");
  // ⚠️ ITS CSS WENT WITH IT. An orphaned rule is what the next screen copies — and one of these was the
  // defect: .cm-rail-ring img set a font-size and a colour and never sized or clipped the image, so the
  // avatar rendered at its natural size spilling across the screen. The rule was written for the
  // initials span and the img selector was bolted on without giving it dimensions.
  const style = sheetOf(page());
  assert.ok(!/\.cm-rail/.test(style), "the stories rail's CSS is still in the stylesheet with nothing using it");
});

test("BLOCKER: the camera roll's cells are square, and the rows are told how tall they are", () => {
  // ⚠️⚠️ MEASURED AND REPRODUCED: every cell computed 149x149 correctly while the grid's own row tracks
  // came out 89.5px, so the cells overflowed their rows and overlapped — thumbnails squashed into thin
  // strips with the selection circles running into each other, which is exactly his screenshot.
  // The cause is a circularity: an auto row sizes to its items' content, and an item whose height comes
  // from aspect-ratio has no content contribution to give. Percentage padding resolves against the
  // item's WIDTH, which the 1fr track has already settled, so there is no loop.
  const style = sheetOf(page());
  const cell = /\.clib-c \{[^}]*\}/.exec(style);
  assert.ok(cell, "no .clib-c rule");
  assert.match(cell[0], /padding: 100% 0 0/, "the cell's height does not come from percentage padding");
  assert.match(cell[0], /height: 0/, "the cell has a height of its own, so the padding is added to it");
  assert.ok(!/aspect-ratio/.test(cell[0]),
    "the cell is back on aspect-ratio, which cannot tell an auto row how tall to be");
  // ⚠️ AND THE IMAGE IS ABSOLUTE, because the cell's content box is zero-height by construction.
  const img = /\.clib-c img \{[^}]*\}/.exec(style);
  assert.ok(img, "no .clib-c img rule");
  assert.match(img[0], /position: absolute/, "the image is in flow inside a zero-height content box");
  // ⚠️ AND THE MARKS SIT ABOVE IT — a z-index rather than document order, since the image comes first.
  assert.match(style, /\.clib-n, \.clib-dur \{[^}]*z-index: 2/,
    "the selection mark and the duration are behind the thumbnail");
});

/* ------------------------------------------------------------------------------------------------
 * HIS FIVE INSTRUCTIONS OF 2026-08-22, WRITTEN ON FOUR SCREENSHOTS.
 * ---------------------------------------------------------------------------------------------- */

test("BLOCKER: a story is navigated by tapping, and the zones sit UNDER every control", () => {
  // "Tapping the screen on the right hand side should move the story the next one along, tapping it on
  // the left should move it back one."
  //
  // ⚠️ THE ZONES MUST BE BELOW THE BUTTONS, and this project has shipped the other way round once: a
  // full-width invisible "next" over a panel carrying real actions ate every tap on the control
  // underneath it. Compared as numbers rather than trusting the source order.
  const css = page();
  const zone = /\.club-tapl, \.club-tapr \{([^}]*)\}/.exec(css);
  assert.ok(zone, "the tap zones are gone");
  const zi = /z-index: (\d+)/.exec(zone![1]!);
  assert.ok(zi, "the tap zones have no stacking order, so it is whatever the DOM order happens to give");
  for (const sel of ["\\.club-x", "\\.club-vmore"]) {
    const c = new RegExp(sel + " \\{([^}]*)\\}").exec(css);
    assert.ok(c, "no rule for " + sel);
    const cz = /z-index: (\d+)/.exec(c![1]!);
    assert.ok(cz, sel + " has no stacking order");
    assert.ok(Number(cz![1]) > Number(zi![1]),
      sel + " (z " + cz![1] + ") is at or below the tap zones (z " + zi![1] + "), so the zone eats its taps");
  }
  // Both directions exist, and going back from the first does nothing rather than closing.
  const v = fn("clubOpenMedia");
  assert.match(v, /data-cnav="back"/, "there is no way back a story");
  assert.match(v, /data-cnav="next"/, "there is no way on a story");
  assert.match(nocomment(v), /const back = \(\) => \{ if \(i <= 0\) return;/,
    "tapping back on the first story closes it, which loses what somebody was reading");
});

test("BLOCKER: the Next and Delete buttons are gone, and delete is in the ⋮ menu", () => {
  // "Remove the next and delete buttons, the option to delete should come from opening a 3 little dot
  // menu."
  const v = nocomment(fn("clubOpenMedia"));
  assert.ok(!/clubVNext|clubVDel/.test(v), "the viewer still carries its own Next or Delete button");
  assert.ok(!/club-vfoot/.test(v), "the viewer still draws the button row those two lived in");
  assert.match(v, /id="clubVMore"/, "there is no ⋮ to open");
  assert.match(v, /clubPostMenuHtml\(p\)/, "the ⋮ opens nothing");
  // ⚠️ AND THE MENU'S ACTION REACHES A REAL FUNCTION, not just a branch that mentions one — the
  // looks-live-does-nothing class this project has shipped three times.
  const menu = fn("clubPostMenuHtml");
  assert.match(menu, /data-cact="delete"/, "the menu offers no delete");
  const act = nocomment(fn("clubPostAction"));
  assert.match(act, /clubDelete\(p\.id\)/, "the menu's delete does not delete");
  assert.match(act, /clubViewClose\(\)/, "deleting leaves the viewer open on a post that is gone");
  assert.match(v, /data-cact/, "the menu items are never wired");
});

test("BLOCKER: the menu names what does not exist rather than offering it", () => {
  // ⚠️ HIS LIST WAS FOUR ACTIONS: delete, turn off commenting, hide likes, make post private. One is
  // real today. There is no server, no accounts and nobody else to see a post, so there is nothing to
  // comment, nothing to like, and a post is already private to the one phone it is on. This app's own
  // rule — from the watch settings — is that no toggle ships before the feature behind it exists.
  // ⚠️ RESTATED, NOT RELAXED (2026-08-24). The menu may offer anything that WORKS, and "Add to plan
  // journal" does — he asked for it and it keeps a real copy. What must never appear is one of the three
  // that need a shared feed: commenting, likes and who can see a post. The explanation went with his
  // instruction ("there's no need for the explanation underneath"), so the guard is now about the
  // ACTIONS rather than about a sentence.
  const menu = nocomment(fn("clubPostMenuHtml"));
  const acts = [...menu.matchAll(/data-cact="(\w+)"/g)].map((m) => m[1]!);
  const REAL = ["delete", "keep"];
  const dead = acts.filter((a2) => REAL.indexOf(a2) < 0);
  assert.deepEqual(dead, [],
    "the menu offers an action over a feature that does not exist: " + dead.join(", "));
  for (const word of ["comment", "Comment", "like", "Like", "private", "Private", "hide", "Hide"]) {
    assert.ok(menu.indexOf(word) < 0,
      "the menu mentions " + word + ", which needs a shared feed the club has not got");
  }
  // And every action it offers is reached by the one handler.
  const act = nocomment(fn("clubPostAction"));
  for (const a2 of acts) {
    assert.ok(act.indexOf('"' + a2 + '"') > 0, "the menu's " + a2 + " is not handled");
  }
});

test("BLOCKER: the run's notes are the Logbook, and it is still private by default", () => {
  // "Call this the logbook and when the user adds their thoughts and feelings, they have the option to
  // save it to the logbook area of Inte-Club."
  const n = fn("runNoteHtml");
  assert.match(n, />Logbook</, "the section is not called the Logbook");
  assert.ok(!/Your notes/.test(n), "it still calls itself Your notes");
  // ⚠️ THE PRIVACY LINE SURVIVES. "Saved on this device only" would be a false sentence if posting were
  // automatic, and this app already treats an overstated privacy claim as worse than none.
  assert.match(n, /Saved on this device only/, "the privacy line is gone, so the copy overstates nothing "
    + "but also promises nothing");
  // ⚠️ AND THE OFFER ONLY EXISTS ONCE THERE ARE WORDS. An offer to post an empty entry would sit under
  // the box on every run ever recorded.
  assert.match(nocomment(n), /v\.trim\(\)\.length > 0/,
    "the post button is offered for an empty note");
  assert.match(n, /data-clogpost=/, "there is no way to save it to the club");
});

test("BLOCKER: a logbook entry is an ordinary post, on a photo or on a card the app draws", () => {
  // "with the option of overlaying these comments on top of a photo, if not it can be on top of a
  // branded logbook card that you can design"
  const sheet = nocomment(fn("clubLogbookSheet"));
  assert.match(sheet, /data-clogk="photo"/, "there is no photo option");
  assert.match(sheet, /data-clogk="card"/, "there is no branded-card option");
  assert.match(sheet, /clubOpenLibrary\("logbook"\)/, "the photo option does not open the camera roll");
  assert.match(sheet, /clubLogbookCard\(run, note\)/, "the card option draws nothing");
  // ⚠️ THE WORDS ARE A MOVEABLE OVERLAY, NOT BURNED IN, so a line that lands badly can be dragged,
  // resized or deleted before it goes up.
  const res = nocomment(fn("clubEditorFor"));
  assert.match(res, /logbook: true, text: L\.note/, "the words do not travel into the editor");
  const ed = nocomment(fn("openClubEditor"));
  assert.match(ed, /const texts = \(o\.text && !n\)/,
    "the words are put on every slide of a carousel rather than the one entry");
  // ⚠️ AND THE ROW REMEMBERS WHAT IT IS, so the third tab is a filter over the ONE post shape rather
  // than a second kind of grid entry.
  assert.match(nocomment(fn("clubEdPost")), /logbook: S\.logbook \|\| undefined/,
    "a logbook entry is stored as an ordinary post with nothing to distinguish it");
  // The branded card reads the session's effort colour through the one mapping ruling 7 established.
  const card = nocomment(fn("clubLogbookCard"));
  assert.match(card, /runEffort\(run\)/, "the card invents its own idea of how hard the session was");
  assert.match(card, /const S = CLUB_TILE_W, H = CLUB_TILE_H/, "the card is not the cell's own shape");
  // ⚠️ WRAPPED BY MEASUREMENT, NOT BY A CHARACTER COUNT. A count is right for one font at one size and
  // wrong for every other, and the failure is a line running off the edge of a posted picture.
  assert.match(card, /measureText/, "the words are wrapped by counting characters");
});

test("BLOCKER: a runner has a handle as well as a name, and the app does not claim it is unique", () => {
  // "Each runner needs to have a unique inte-club user name. As well as their full name."
  //
  // ⚠️ UNIQUENESS CANNOT BE PROVEN ON ONE PHONE, AND THE COPY SAYS SO RATHER THAN IMPLYING OTHERWISE.
  // There is no server, so this device cannot know what anybody else has taken. Claiming it was reserved
  // would be the app asserting something it has no way to know.
  const ed = fn("viewClubEdit");
  assert.match(ed, /id="ceUser"/, "there is no handle field");
  assert.match(ed, /row\("Name"/, "the full name is gone, and he asked for both");
  const hint = fn("clubUserHint");
  assert.match(hint, /until the club has a server/,
    "the hint claims the handle is checked, which no phone can do on its own");
  // The shape is one a server could still accept later, and an invalid one is refused rather than
  // silently corrected.
  const ok = new Function("v", nocomment(fn("clubUserOk")) + "\nreturn clubUserOk(v);") as
    (v: string) => boolean;
  for (const good of ["adam", "a.p_1980", "abc"]) assert.ok(ok(good), good + " should be allowed");
  for (const bad of ["ab", "Adam", "a b", "a@b", "x".repeat(21), ""]) {
    assert.ok(!ok(bad), JSON.stringify(bad) + " should be refused");
  }
  const wire = nocomment(fn("wireClubEdit"));
  assert.match(wire, /if \(!v \|\| clubUserOk\(v\)\) put\(\{ username: v \}\)/,
    "an invalid handle is stored, so the profile shows an @name that can never be registered");
  // And it survives a round trip, like every other field on this page.
  const load = nocomment(fn("loadClubProf"));
  assert.match(load, /username: String\(raw\.username \|\| ""\)/,
    "the handle is dropped on read — the whitelisting-reader fault this file already caught once");
});

test("BLOCKER: the Logbook section is a redesign, and its category colour is not raw as text", () => {
  // His clarification, 2026-08-22: "I meant that I wanted you to redesign that section with a premium
  // feel" — the LOOK, not a paywall. I read it as the latter and asked; this is the former.
  const css = page();
  const n = fn("runNoteHtml");
  // ⚠️ THE SESSION'S OWN COLOUR ARRIVES AS A CUSTOM PROPERTY, through the one ruling-7 mapping, so the
  // card belongs to the run above it rather than looking like a component that landed there.
  assert.match(n, /--lbc: var\(--eff-' \+ eff/, "the card does not take the session's own colour");
  assert.match(nocomment(n), /const eff = runEffort\(run\)/,
    "the card invents its own idea of how hard the session was");
  // ⚠️⚠️ A CATEGORY COLOUR USED AS TEXT IS TEXT. Set to the raw --lbc this eyebrow measured 8.30:1 in
  // dark and 2.44:1 in LIGHT — amber on a white card, under AA, on the label naming the section. Exactly
  // the fault CLAUDE.md records twice (the URGENT band at 2.41:1, the accent at 4.14:1 on white), both
  // of which passed a dark-only review. Measured from rendered pixels after the fix: 10.91 / 5.28.
  const eye = /\.lb-eye \{([^}]*)\}/.exec(css);
  assert.ok(eye, "the Logbook eyebrow is gone");
  assert.match(eye![1]!, /color: color-mix\(in srgb, var\(--lbc\) \d+%, var\(--ink\)\)/,
    "the eyebrow uses the raw category colour as text, which is under AA on a light card");
  // ⚠️ AND THE WRITING SURFACE IS A PAGE, NOT A FIELD. A 1px box on a grey plate reads as a support
  // ticket; the runner's own words are the only serif in the app, which is what says "write here".
  const note = /\.lb-note \{([^}]*)\}/.exec(css);
  assert.ok(note, "the writing surface is gone");
  assert.match(note![1]!, /font-family: Georgia/, "the entry is set in the same face as the rest of the app");
  assert.match(note![1]!, /border: 0/, "the page is still a bordered form field");
  // ⚠️ AND IT IS ON THE TYPE LADDER, WHICH IS ALSO ABOVE THE iOS AUTO-ZOOM FLOOR. Under 16px the phone
  // zooms in on focus and pinch is disabled app-wide, so the runner can never zoom back out.
  assert.match(note![1]!, /font-size: var\(--t-card\)/, "the entry's size is off the ladder");
  // The one action looks like one, and says what it does.
  assert.match(n, /class="lb-post"/, "the save action is still a generic button");
  assert.match(n, /lb-post-d/, "the action does not say what it does");
  assert.match(n, /ICON\.journal/, "the action's glyph is not the journal mark");
});

test("BLOCKER: deleting a post asks first, with Delete and Cancel", () => {
  // His instruction, 2026-08-22: "when deleting any post there needs to be an alert that pops up that
  // gives two options... 1. delete 2. cancel".
  const ask = fn("clubConfirmDelete");
  const labels = [...ask.matchAll(/id="clubAsk(Yes|No)">([^<]+)</g)].map((m) => m[2]!);
  assert.deepEqual(labels, ["Delete", "Cancel"], "the dialog does not offer exactly those two: "
    + labels.join(", "));
  assert.match(ask, /role="alertdialog"/, "it is not announced as a dialog");
  assert.match(ask, /aria-modal="true"/, "a screen reader can wander out of it");
  // ⚠️ CANCEL TAKES FOCUS, NOT DELETE. On a dialog whose whole job is to slow a destructive tap down,
  // the safe option is the one a keyboard or switch-control user lands on.
  assert.match(ask, /overlayModal\(ov, true, "#clubAskNo"\)/, "the destructive option takes focus");
  // ⚠️ AND THE COPY SAYS IT CANNOT BE UNDONE, because it cannot: clubDelete removes the row AND the
  // blobs from IndexedDB. That is what makes asking right here, where CLAUDE.md records deliberately
  // NOT asking before deleteRun — that one raises an undo toast, and a dialog before a reversible
  // action is a tap for nothing.
  assert.match(ask, /no way to get it back/, "the dialog does not say the delete is final");
  const del = nocomment(fn("clubDelete"));
  assert.match(del, /clubMediaDel\(k\)/,
    "clubDelete no longer removes the blobs, so the copy claiming it is final would be wrong");
});

test("BLOCKER: it is the SAME dialog on every delete path, and it sits above the viewer", () => {
  // ⚠️⚠️ IT CANNOT USE THE APP'S OWN confirmSheet. That draws on .sheet-ov at z-index 70 and the
  // full-screen viewer is .club-view at 96, so the question would open BEHIND the very thing it is
  // asking about — which is exactly the fault that made the Inte-Club share ask invisible.
  const css = page();
  const z = (sel: string) => {
    const m = new RegExp(sel + "[^{]*\\{([^}]*)\\}").exec(css);
    assert.ok(m, "no rule for " + sel);
    const n = /z-index: (\d+)/.exec(m![1]!);
    assert.ok(n, sel + " has no stacking order");
    return Number(n![1]);
  };
  assert.ok(z("\\.club-ask ") > z("\\.club-ed, \\.club-view"),
    "the confirmation is at or below the viewer, so it opens behind the post it is about");
  assert.ok(z("\\.club-ask ") > z("\\.club-lib"), "the camera roll would cover the confirmation");
  const ask = nocomment(fn("clubConfirmDelete"));
  for (const bad of ["ensureSheet(", "sheetBody", "sheetOv", "confirmSheet("]) {
    assert.ok(ask.indexOf(bad) < 0,
      "the confirmation uses the app's bottom sheet (" + bad + "), which renders under the viewer");
  }
  // ⚠️ EVERY DELETE PATH GOES THROUGH IT. Two confirmations would be two chances for one to be
  // forgotten — the fix-one-builder-not-the-other trap this project has paid for six times.
  const app = nocomment(page());
  const calls = [...app.matchAll(/clubDelete\(/g)].length;
  assert.equal(calls, 3, "clubDelete has " + calls + " mentions; expected its definition and two "
    + "callers, both of which must be inside a confirmation");
  // ⚠️ THE CALLERS ARE DERIVED, NOT LISTED. A hand-written pair went stale immediately — I named a
  // function that does not exist — and a list is one more thing to update the next time a delete is
  // added anywhere. Every function whose body calls clubDelete must ask first, whatever it is called.
  const fns = [...app.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!);
  let asked = 0;
  for (const name of fns) {
    if (name === "clubDelete" || name === "clubConfirmDelete") continue;
    const body = nocomment(fn(name));
    // fn() runs to the matching brace, so a later function's call cannot leak in.
    const at = body.indexOf("clubDelete(");
    if (at < 0) continue;
    asked++;
    const ask = body.indexOf("clubConfirmDelete(");
    assert.ok(ask >= 0 && ask < at, name + " deletes a post without asking first");
  }
  assert.equal(asked, 2, "expected exactly two delete paths — the viewer's menu and the post feed — "
    + "found " + asked);
});

/**
 * THE PROFILE IDENTITY, REGROUPED (owner, 2026-08-22: "Redesign this section so that it fits nicely,
 * it looks cluttered", and "if you need to put a maximum character count on some of the typing fields
 * to make this fit nicer then that's ok").
 *
 * ⚠️ SEVEN LEFT-ALIGNED ROWS BECAME FOUR TIERS, and the count is the whole point of the ask — the name,
 * the handle, the bio, the plan, the shoe, the week and the times each had a row of their own, all the
 * same weight and all starting at the same x. Measured on the served page at 430×932 the block went 153
 * → 130px with a fact ADDED to it, and 152px with the week's distance as well.
 */
test("the profile identity is four tiers, and the name and handle share a line", () => {
  const v = nocomment(fn("viewCommunity"));
  const id = v.slice(v.indexOf('"cm-id"'), v.indexOf('cm-actions'));
  assert.ok(id.length > 200, "the identity block could not be found in viewCommunity");
  // The four tiers, in order. A fifth block-level child is the clutter coming back.
  const tiers = [...id.matchAll(/class="cm-(idline|bio|meta|times)"/g)].map((m) => m[1]!);
  assert.deepEqual(tiers, ["idline", "bio", "times"],
    "expected cm-idline, cm-bio and cm-times as literal classes here (cm-meta is built by "
    + "commMetaLine); found " + tiers.join(", "));
  assert.ok(id.indexOf("commMetaLine(") > 0, "the meta line is not built by commMetaLine");
  // ⚠️ THE NAME AND THE HANDLE MUST BE INSIDE ONE ROW, not two siblings. Guarded by POSITION rather
  // than presence: both spans existed before this change too, each in a block of its own.
  const line = id.indexOf('class="cm-idline"');
  const name = id.indexOf('class="cm-name"');
  const at = id.indexOf('class="cm-at"');
  const closes = id.indexOf("</div>", line);
  assert.ok(line > 0 && name > line && at > name && closes > at,
    "the name and the handle are not both inside cm-idline");
  const sheet = nocomment(sheetOf(page()));
  const idline = /\.cm-idline\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(idline, "no .cm-idline rule");
  assert.match(idline![1]!, /display:\s*flex/, ".cm-idline must lay its two children on one line");
  // ⚠️ THE ORPHANED SHOE ROW'S RULES WERE DELETED, NOT LEFT UNUSED — an orphaned rule is what the next
  // screen copies. Word-bounded, because `.cm-track` (the two-pane slider) contains `.cm-tr`.
  assert.ok(!/\.cm-tr[^a-z-]/.test(sheet), ".cm-tr survived the row it used to draw");
  assert.ok(v.indexOf("cm-tr\"") < 0 && v.indexOf("cm-tr-km") < 0,
    "viewCommunity still builds the old shoe row");
});

/**
 * ⚠️⚠️ NO SEPARATOR GLYPH, AND THIS GUARD EXISTS BECAUSE BOTH OTHER ANSWERS WERE BUILT AND MEASURED.
 * A dot as its own span is a flex item, so a wrap stranded it at the end of the first line
 * ("…week 1 of 36 ·"); moved to a ::before on the following item, the wrap carried it down and it LED
 * the second line like a bullet. A separator and a wrapping row do not mix — spacing alone cannot
 * strand, so the gap does the separating.
 */
test("the meta line separates its facts with spacing, never a glyph", () => {
  const meta = nocomment(fn("commMetaLine"));
  assert.match(meta, /bits\.join\(""\)/,
    "commMetaLine joins its facts with something; a separator string strands on a wrap");
  for (const glyph of ["\u00b7", "\u2022", " | ", " / "]) {
    assert.ok(meta.indexOf('"' + glyph) < 0 && meta.indexOf(glyph + '"') < 0,
      "commMetaLine emits a " + JSON.stringify(glyph) + " separator");
  }
  const sheet = nocomment(sheetOf(page()));
  // The pseudo-element form is the one that reads as a bullet list, so it is forbidden by name.
  assert.ok(!/\.cm-(meta|mi)[^{]*::(before|after)/.test(sheet),
    "a pseudo-element separator is back on the meta line; a wrap makes it lead the second line");
  const rule = /\.cm-meta\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(rule, "no .cm-meta rule");
  assert.match(rule![1]!, /flex-wrap:\s*wrap/, ".cm-meta must wrap rather than overflow");
  assert.match(rule![1]!, /gap:\s*\d/, ".cm-meta separates by gap; without one the facts run together");
});

/**
 * ⚠️⚠️ NOTHING IN THE PANE SLIDES SIDEWAYS — AND THIS ASSERTION IS THE INVERSE OF THE ONE IT REPLACED.
 * For a day this file demanded that the times be a horizontal SCROLLER, which is what he then rejected:
 * "I dont want the screen to slide sideways. it should remain like instagram does with the elements at
 * the top being rearranged in an aesthetically, premium designed way." Inverted rather than deleted, the
 * way the PRICE/RICE reversal was, because what the old guard was protecting — the fourth capsule must
 * not be orphaned on a line of its own — is still true and is still asserted below.
 *
 * ⚠️ THE SCROLLER WAS WRONG TWICE OVER. It bled 12px out of .cm-pane, and .cm-pane has overflow-y: auto
 * with nothing said about x — which the spec turns into overflow-x: auto — so the pane was a horizontal
 * scroller and anything sticking out of it could be dragged. Measured before: 20px of overflow from the
 * journals section and 12 from the times row, and scrollLeft = 200 landed at 20. After: 0 overflow and
 * nothing sticking out, at 430x932 and 320x568, at text scale 1.0 and 1.3.
 */
test("the pane cannot be slid sideways, and nothing bleeds out of it", () => {
  const sheet = nocomment(sheetOf(page()));
  const pane = /\.cm-pane\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(pane, "no .cm-pane rule");
  // ⚠️ IT MUST SAY SOMETHING ABOUT X. Silence is not neutral here: overflow-y: auto with x unstated
  // computes to overflow-x: auto, which is the defect. clip computes to hidden alongside a scrolling
  // y-axis, and neither can be dragged by a finger.
  const ox = /overflow-x:\s*([a-z]+)/.exec(pane![1]!);
  assert.ok(ox, ".cm-pane says nothing about overflow-x, so it computes to auto and the screen slides");
  assert.ok(["clip", "hidden"].indexOf(ox![1]!) >= 0,
    ".cm-pane has overflow-x: " + ox![1] + ", which a finger can drag");
  // ⚠️ AND THE REAL FIX IS THAT NOTHING BLEEDS. A full-bleed child only works when its parent carries
  // the gutter, and .cm-pane carries none — the 16px inset comes from #view, two boxes further out. So
  // no rule on a child of the pane may pull itself outwards; clip would silently CUT it, which is how a
  // guard like this one comes to be satisfied by a screen with its content shaved off.
  for (const cls of ["cj-sec", "cm-pbrow", "cm-times", "cm-id", "cm-head", "cm-acts", "cm-grid"]) {
    const r = new RegExp("\\." + cls + "\\s*\\{([^}]*)\\}").exec(sheet);
    if (!r) continue;
    assert.ok(!/margin[^;}]*-1\s*\*/.test(r[1]!) && !/margin[^;}]*\*\s*-1/.test(r[1]!),
      "." + cls + " pulls itself outwards; inside .cm-pane that overflows and used to let the whole "
      + "screen be dragged sideways");
  }
});

/**
 * ⚠️ THE TIMES ARE TWO EVEN COLUMNS, WHICH IS THE ONE LAYOUT THAT CANNOT ORPHAN THE FOURTH CAPSULE.
 * There are exactly four distances (5 km, 10 km, half, marathon), so four items are two full rows — no
 * orphan, nothing to swipe, and every time the runner has is on screen at once. An auto-fit grid gives
 * 3 + 1 on a narrow screen and a scroller hides half of them behind a gesture nobody is told about.
 * ⚠️ min-width IS WHAT MAKES IT DEGRADE INSTEAD OF OVERFLOWING: at 320px with the largest text setting
 * two no longer fit, and the long capsules take a full row each (measured: 3 rows, 0 overflow) rather
 * than being pushed out of the pane.
 */
test("the times are two even columns, and never a sideways scroller", () => {
  const sheet = nocomment(sheetOf(page()));
  const row = /\.cm-pbrow\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(row, "no .cm-pbrow rule");
  assert.ok(!/overflow-x:\s*(auto|scroll)/.test(row![1]!),
    "the times are a sideways scroller again, which he rejected");
  assert.match(row![1]!, /flex-wrap:\s*wrap/, "the times cannot fall to a second row");
  const cap = /\.cm-pbrow \.cm-chip\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(cap, "no rule sizing the capsules inside the row");
  // Two on a row: a basis under half, so a third cannot join them, with room to stretch even.
  const basis = /flex:\s*1\s+1\s+(\d+)%/.exec(cap![1]!);
  assert.ok(basis, "the capsules are not sized to two per row");
  const pct = Number(basis![1]);
  assert.ok(pct > 33 && pct <= 50,
    "a basis of " + pct + "% puts " + Math.floor(100 / pct) + " on a row, not two");
  assert.match(cap![1]!, /min-width:\s*max-content/,
    "without min-width the widest capsule is pushed out of the pane at the largest text setting");
  // ⚠️ HIS EARLIER CAPSULE RULING IS A SEPARATE DECISION AND SURVIVES THIS ONE UNTOUCHED: same size as
  // the word TIMES, white ground, teal edge, teal text. Only the layout changed.
  const acc = /\.cm-chip-acc\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(acc, "no .cm-chip-acc rule");
  assert.match(acc![1]!, /font-size:\s*var\(--t-label\)/, "the capsule is no longer the size of TIMES");
  assert.match(acc![1]!, /border:\s*1px solid var\(--accent\)/, "the capsule lost its teal edge");
  assert.match(nocomment(fn("viewCommunity")), /class="cm-pbrow"/, "the times row is not built");
});
/**
 * ⚠️ THE CAPS ARE READ BY THE FIELD AND BY THE SAVE, AND BOTH READERS ARE DERIVED FROM THE CONSTANTS.
 * A maxlength alone is advisory — it is a DOM attribute, and a value restored from a store or pasted by
 * a future path is not filtered by it — so the save re-applies it. Two hand-written numbers is how the
 * field and the store come to disagree about the length of the same sentence.
 */
test("the bio and the training-for line carry a character cap, on the field and on the save", () => {
  const app = noApp();
  const caps = /const CLUB_BIO_MAX = (\d+), CLUB_FOR_MAX = (\d+);/.exec(app);
  assert.ok(caps, "CLUB_BIO_MAX and CLUB_FOR_MAX are not declared together");
  assert.ok(Number(caps![1]) > 0 && Number(caps![1]) <= 200, "the bio cap is not a sane length");
  assert.ok(Number(caps![2]) > 0 && Number(caps![2]) <= 80, "the training-for cap is not a sane length");
  for (const k of ["CLUB_BIO_MAX", "CLUB_FOR_MAX"]) {
    // The field says it, so the keyboard stops there rather than the text vanishing on save.
    assert.ok(new RegExp('maxlength="\' \\+ ' + k).test(app),
      k + " does not reach a maxlength attribute");
    // The save says it too, and the read trims what is already stored.
    const writes = [...app.matchAll(new RegExp("slice\\(0, " + k + "\\)", "g"))].length;
    assert.ok(writes >= 2,
      k + " is applied " + writes + " time(s); expected the save AND the read of the store");
  }
  const load = nocomment(fn("loadClubProf"));
  assert.ok(load.indexOf("CLUB_BIO_MAX") > 0 && load.indexOf("CLUB_FOR_MAX") > 0,
    "loadClubProf does not trim to the caps, so text stored before them still overflows the row");
});

/**
 * ⚠️ THE PLAN'S OWN SENTENCE IS TOO LONG FOR A SHARED LINE, AND THE RUNNER'S OWN TEXT IS NEVER TOUCHED.
 * commProfile builds "half marathon block, week 1 of 36" for the header it was written for — 45
 * characters before the shoes have had any, which wrapped the row this redesign exists to tidy.
 * Executed rather than read: the shortening is a regex and a capitalisation, and neither is visible in
 * the source text of the function.
 */
test("clubTrainingFor shortens the plan sentence and leaves typed text alone", () => {
  const src = nocomment(fn("clubTrainingFor"));
  let stored = "";
  let plan = "";
  const run = new Function("loadClubProf", "commProfile", src + "; return clubTrainingFor();");
  const call = () => run(() => ({ trainingFor: stored }), () => ({ plan }));

  plan = "half marathon block, week 1 of 36";
  assert.equal(call(), "Half marathon \u00b7 wk 1/36");
  plan = "marathon block, week 12 of 20";
  assert.equal(call(), "Marathon \u00b7 wk 12/20");
  // ⚠️ AN UNRECOGNISED SENTENCE IS PASSED THROUGH, never dropped — a blank line here would hide a fact
  // the app genuinely knows behind an empty field.
  plan = "taper week";
  assert.equal(call(), "taper week");
  plan = "";
  assert.equal(call(), "");
  // The runner's own words win over anything derived, and are returned exactly as typed.
  stored = "Sub-90 at the Great North Run";
  plan = "half marathon block, week 1 of 36";
  assert.equal(call(), "Sub-90 at the Great North Run");
});

/**
 * ⚠️ ONE RULE PER IDENTITY CLASS, AND THE REDESIGN'S OWN GUARD FOUND A SECOND `.cm-meta` LEFT FROM THE
 * DESIGN BEFORE IT. Both declared font-size and colour, so the line's appearance was decided by which
 * came last in the stylesheet — the two-owners-of-one-measurement fault this project has paid for in
 * the watch's page inset, the story's aspect and the share card's hairline. A duplicate cannot be seen
 * on screen (the later one simply wins), which is why it needs a count rather than an eye.
 */
test("no identity class is declared twice in the stylesheet", () => {
  const sheet = nocomment(sheetOf(page()));
  for (const cls of ["cm-id", "cm-idline", "cm-name", "cm-at", "cm-bio", "cm-meta", "cm-mi",
                     "cm-times", "cm-pbrow"]) {
    const n = [...sheet.matchAll(new RegExp("^\\." + cls + "\\s*\\{", "gm"))].length;
    assert.equal(n, 1, "." + cls + " is declared " + n + " times; one of them decides nothing and the "
      + "next reader cannot tell which");
  }
});

/**
 * ⚠️ commMetaLine IS A TOP-LEVEL FUNCTION, AND IT SHIPPED NESTED INSIDE viewCommunity FOR A DAY.
 * A function declaration inside the view hoists within it, so nothing failed — but it was rebuilt on
 * every render, no other screen could reach it, and `fn("viewCommunity")` swallowed it, which is how it
 * was found: an unrelated guard sliced the view and matched text from a function that should not have
 * been in there. A helper declared inside its only caller is a helper the next caller cannot use.
 */
test("the identity's helpers are declared at the top level, not inside the view", () => {
  const app = appBlock();
  for (const name of ["commMetaLine", "clubTrainingFor", "clubTrainers"]) {
    assert.match(app, new RegExp("^function " + name + "\\(", "m"),
      name + " is not declared at the top level");
  }
  // ⚠️ THE SIGNATURE IS CUT OFF FIRST, or the guard matches its OWN header and can never pass — which is
  // what the first version did. The inverse of a guard that cannot fail, and just as useless.
  const whole = nocomment(fn("viewCommunity"));
  const body = whole.slice(whole.indexOf("{") + 1);
  const nested = [...body.matchAll(/\bfunction (\w+)\(/g)].map((m) => m[1]!);
  assert.deepEqual(nested, [], "viewCommunity declares " + nested.join(", ") + " inside itself; it is "
    + "rebuilt on every render and no other screen can reach it");
});

/**
 * ⚠️⚠️ THE PANE'S CLIP TURNS AN OVERFLOW INTO MISSING CONTENT, so the head has to wrap rather than
 * overflow. Measured on the narrowest supported screen at the largest text setting: the three stat
 * columns needed 49px more than the row beside an 82px avatar could give, and before the clip that was
 * the other half of the sideways slide he reported. FOLLOWING is one word and cannot be hyphenated, so
 * the stats take a line of their own — which is what Instagram does on a narrow screen. Driven by
 * max-content, not a breakpoint, so it happens exactly when the words stop fitting.
 */
test("the profile head wraps rather than pushing the stats out of the pane", () => {
  const sheet = nocomment(sheetOf(page()));
  const head = /\.cm-head\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(head, "no .cm-head rule");
  assert.match(head![1]!, /flex-wrap:\s*wrap/,
    "the head cannot wrap, so the stats overflow and the pane's clip cuts a stat label off");
  const stats = /\.cm-stats\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(stats, "no .cm-stats rule");
  // ⚠️ min-width: 0 IS THE OPPOSITE OF WHAT IS WANTED HERE, and it is what shipped. It lets the box
  // shrink under its own words, so the labels collide and then spill; max-content makes the box refuse,
  // and the wrap above is what catches it.
  assert.match(stats![1]!, /min-width:\s*max-content/,
    "the stats box may shrink under its own words, so the labels collide instead of wrapping");
});

/**
 * ⚠️ THE TRAINERS TAKE A LINE OF THEIR OWN, UNDER THE WEEK — his ruling of 2026-08-23: "the trainer
 * information needs to be underneath the distance covered this week on its own line." Two halves, and
 * either alone puts the shoes back beside something: they must come LAST in the line's own order, and
 * they must be unable to share a row.
 */
test("the trainers are the last fact on the meta line, and take a row of their own", () => {
  const meta = nocomment(fn("commMetaLine"));
  // The order is read off the pushes themselves, so a reorder cannot pass.
  const order = [...meta.matchAll(/bits\.push\('<span class="cm-mi([^"]*)"/g)]
    .map((m) => (m[1]!.indexOf("shoe") >= 0 ? "shoe" : m[1]!.indexOf("num") >= 0 ? "week" : "plan"));
  assert.deepEqual(order, ["plan", "week", "shoe"],
    "the meta line's facts are in the order " + order.join(", ") + "; the trainers must come last");
  const sheet = nocomment(sheetOf(page()));
  const shoe = /\.cm-mi-shoe\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(shoe, "no .cm-mi-shoe rule, so the trainers share a line with whatever precedes them");
  // A basis of 100% cannot share a row, wherever the facts above it happen to wrap to.
  assert.match(shoe![1]!, /flex:\s*0\s+0\s+100%/,
    "the trainers can share a line; a full-row basis is what keeps them on their own");
});

/* ══ THE COMPOSER, BUILT TO THE REFERENCE'S POSTING EXPERIENCE (owner, 2026-08-23) ═════════════════
 * "the next sequence of screenshots is the process that you follow on instagram before posting a photo
 * or carousel … i want the same user experience when posting to inte-run", with his rulings that Audio
 * is shown but marked as coming and Overlay is built in the same go.
 */
test("BLOCKER: the six tools are one wrapping row, not a sideways scroller", () => {
  const t = nocomment(fn("clubToolsHtml"));
  const ids = [...t.matchAll(/tool\("(\w+)"/g)].map((m) => m[1]!);
  assert.deepEqual(ids, ["audio", "text", "overlay", "filter", "edit", "ratio"],
    "the tool row is " + ids.join(", ") + "; the reference's own six, in its own order");
  const sheet = nocomment(sheetOf(page()));
  const row = /\.club-tools\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(row, "no .club-tools rule");
  // ⚠️ HE RULED THE SAME DAY THAT NOTHING SLIDES SIDEWAYS, and six tools do not fit one line on a small
  // screen at the largest text setting — so this wraps, exactly as the profile's times row does.
  assert.ok(!/overflow-x:\s*(auto|scroll)/.test(row![1]!), "the tool row slides sideways");
  assert.match(row![1]!, /flex-wrap:\s*wrap/, "the tool row cannot fall to a second line");
  const tool = /\.club-tool\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(tool && /min-width:\s*max-content/.test(tool[1]!),
    "without min-width a tool's label is squashed instead of the row wrapping");
  // Every tool is reached, and the Text one goes to the on-media surface rather than a dialog.
  assert.match(nocomment(fn("wireClubEd")), /\[data-ctool\]/, "the tools are not wired");
});

/**
 * ⚠️⚠️ CANCEL GENUINELY REVERTS, AND THAT NEEDS A SNAPSHOT TAKEN ON THE WAY IN. A Cancel that only
 * closes the sheet keeps every change the runner was trying out — worse than no Cancel at all, because
 * the word promises the opposite. Driven rather than read: the snapshot is an object copy and the
 * restore is a field-by-field assignment, and neither is visible in the source text.
 */
test("BLOCKER: a tool sheet's Cancel puts back what the tool changed, and nothing else", () => {
  const src = page();
  const run = new Function("haptic", "clubEdDraw", "clubTextOpen", "clubOvAdd",
    nocomment(fn("clubToolOpen")) + "\n" + nocomment(fn("clubToolCancel")) + "\n" +
    nocomment(fn("clubToolDone")) + "\n" +
    "let CLUBED = null;\n" +
    "function clubSlide() { return CLUBED.slides[CLUBED.i]; }\n" +
    "return function (kind, act) {\n" +
    "  CLUBED = { i: 0, ratio: 'orig', tool: '', snap: null, sel: 2,\n" +
    "    slides: [{ filter: 'none', adj: {}, ov: [], k: 1.8, ox: 0.3 }] };\n" +
    "  clubToolOpen(kind);\n" +
    "  const sl = CLUBED.slides[0];\n" +
    "  sl.filter = 'mono'; sl.adj = { lux: 40 }; CLUBED.ratio = 'sq'; sl.ov = [{ x: 1 }];\n" +
    "  sl.k = 3; sl.ox = 0.9;\n" +
    "  if (act === 'cancel') clubToolCancel(); else clubToolDone();\n" +
    "  return { filter: sl.filter, adj: sl.adj, ratio: CLUBED.ratio, ovs: sl.ov.length,\n" +
    "    k: sl.k, ox: sl.ox, tool: CLUBED.tool, snap: CLUBED.snap };\n" +
    "};")(() => {}, () => {}, () => {}, () => {});

  // Cancelling the filter sheet puts the filter back and leaves everything else alone.
  let r = run("filter", "cancel");
  assert.equal(r.filter, "none", "Cancel on the filter sheet kept the filter");
  assert.deepEqual(r.adj, { lux: 40 }, "Cancel on the filter sheet also undid the adjustments");
  assert.equal(r.ratio, "sq", "Cancel on the filter sheet also undid the ratio");
  // ⚠️ AND IT MUST NOT TOUCH THE CROP. A crop made before the sheet was opened is not the sheet's to
  // undo — a snapshot of the whole slide would take it with the filter.
  assert.equal(r.k, 3, "Cancel on the filter sheet undid a crop made before it");
  assert.equal(r.ox, 0.9, "Cancel on the filter sheet undid a pan made before it");
  r = run("edit", "cancel");
  assert.deepEqual(r.adj, {}, "Cancel on the edit sheet kept the adjustments");
  assert.equal(r.filter, "mono", "Cancel on the edit sheet also undid the filter");
  r = run("ratio", "cancel");
  assert.equal(r.ratio, "orig", "Cancel on the ratio sheet kept the ratio");
  r = run("filter", "done");
  assert.equal(r.filter, "mono", "Done on the filter sheet threw the filter away");
  assert.equal(r.tool, "", "Done left the sheet open");
  assert.equal(r.snap, null, "Done left the snapshot behind, so a later Cancel would revert to it");
});

/**
 * ⚠️⚠️ NOTHING IS RE-ENCODED, AND THAT IS THE WHOLE DESIGN. The look is a name and a few numbers applied
 * at display time, exactly as the video trim is two points rather than a re-cut clip. Baking it into
 * pixels in a web view means decoding to a canvas and encoding back — slow, lossy, and it destroys the
 * original the runner may want back.
 */
test("BLOCKER: the look is arithmetic, and the original file is never re-encoded", () => {
  const look = new Function(
    nocomment(fn("clubFilterCss")) + "\n" + nocomment(fn("clubToneQ")) + "\n" +
    nocomment(fn("clubLook")) + "\n" +
    "const CLUB_TONE_STEP = 5;\n" +
    "const CLUB_FILTERS = " + JSON.stringify(clubFiltersTable()) + ";\n" +
    "return clubLook;")();
  // A filter is its own CSS, and nothing else.
  assert.equal(look({ filter: "none" }).filter, "", "Normal is not a no-op");
  assert.match(look({ filter: "mono" }).filter, /grayscale\(1\)/, "Mono does not desaturate");
  // ⚠️ LUX IS ONE DIAL DRIVING THREE, which is what an auto-enhance is.
  const lux = look({ filter: "none", adj: { lux: 100 } }).filter;
  assert.match(lux, /contrast\(/, "Lux does not touch contrast");
  assert.match(lux, /saturate\(/, "Lux does not touch saturation");
  assert.match(lux, /brightness\(/, "Lux does not touch brightness");
  // ⚠️ WARMTH GOES BOTH WAYS AND THE TWO DIRECTIONS ARE DIFFERENT FUNCTIONS — sepia only warms, so a
  // one-armed dial does nothing on half its travel.
  assert.match(look({ adj: { warm: 80 } }).filter, /sepia\(/, "warming up does not warm");
  assert.match(look({ adj: { warm: -80 } }).filter, /hue-rotate\(-/, "cooling down does not cool");
  assert.ok(!/sepia/.test(look({ adj: { warm: -80 } }).filter), "cooling applies sepia");
  // Vignette is one-way and comes back separately, because it is an overlay rather than a filter.
  assert.equal(look({ adj: { vig: -60 } }).vig, 0, "the vignette can be driven negative");
  assert.ok(look({ adj: { vig: 60 } }).vig > 0, "the vignette does nothing");
  assert.ok(!/vignette/.test(look({ adj: { vig: 60 } }).filter), "the vignette is faked as a filter");
  // Straightening is clamped, and a wild stored value cannot spin a picture.
  assert.equal(look({ adj: { rot: 90 } }).rot, 15, "straightening is not clamped");
  assert.equal(look({ adj: { rot: -90 } }).rot, -15, "straightening is not clamped downwards");
  assert.equal(look({ adj: { rot: "x" } }).rot, 0, "a non-number rotation is not refused");
  // ⚠️ THE TONE COMES BACK AS NUMBERS, so the pure function can be driven and the DOM work stays in the
  // applier. Quantised, so dragging a slider does not mint a filter def per value passed through.
  assert.equal(look({ adj: { hi: 100 } }).hi, 100, "highlights do not survive clubLook");
  assert.equal(look({ adj: { sh: -60 } }).sh, -60, "shadows do not survive clubLook");
  assert.equal(look({ adj: { hi: 2 } }).hi, 0, "a value under the quantum is not treated as rest");
  assert.equal(look({ adj: { hi: 999 } }).hi, 100, "highlights are not clamped");
  // ⚠️ NO CANVAS ANYWHERE IN THE LOOK PATH. A toBlob here would be the re-encode this design refuses.
  for (const f of ["clubLook", "clubFilterCss", "clubApplyLook", "clubLookAttrs", "clubRotScale",
                   "clubToneTable", "clubToneQ", "clubToneUrl"]) {
    const body = nocomment(fn(f));
    assert.ok(!/toBlob|getContext|createElement\("canvas"\)/.test(body),
      f + " re-encodes the picture; the look must stay arithmetic");
  }
});

/**
 * ⚠️ A ROTATED PICTURE HAS TO BE SCALED UP OR ITS CORNERS SHOW, AND HOW MUCH DEPENDS ON THE BOX — so it
 * cannot be a constant and cannot live in the stylesheet. Measured through the real function: the same
 * 8 degrees needs a different scale in a square box and a tall one, which is why clubApplyLook measures
 * the node rather than taking a style string.
 */
test("BLOCKER: straightening scales to cover, and the scale depends on the box", () => {
  const rs = new Function(nocomment(fn("clubRotScale")) + "\nreturn clubRotScale;")();
  assert.equal(rs(0, 400, 400), 1, "no rotation still scales");
  assert.ok(rs(8, 400, 400) > 1, "a rotated picture is not scaled up, so its corners show");
  assert.ok(rs(-8, 400, 400) > 1, "rotating the other way is not scaled up");
  assert.equal(rs(8, 400, 400).toFixed(6), rs(-8, 400, 400).toFixed(6),
    "the two directions need the same scale and do not get it");
  const sq = rs(8, 400, 400), tall = rs(8, 400, 700);
  assert.ok(Math.abs(sq - tall) > 0.02,
    "the scale is the same in a square box and a tall one (" + sq.toFixed(4) + " vs " +
    tall.toFixed(4) + "), so it is not covering both");
  assert.equal(rs(8, 0, 0), 1, "a box with no size does not fall back to 1");
});

/**
 * ⚠️ AUDIO IS NAMED, NOT OFFERED — his ruling: "Show it, marked as coming." Music over a post needs a
 * licensed catalogue, and the phone's own library cannot stand in because those tracks are DRM-locked.
 * So the sheet says what is missing rather than opening a picker that finds nothing.
 */
test("BLOCKER: the Audio tool explains itself and offers no picker", () => {
  const b = nocomment(fn("clubAudioBody"));
  assert.match(b, /licen[sc]ed/i, "the Audio sheet does not say a licence is what is missing");
  // ⚠️ IT MUST NOT LOOK LIVE. No file input, no audio element, no track list — the
  // looks-live-does-nothing class this project has shipped three times.
  for (const bad of ["<input", "<audio", "accept=", "clubMediaPut", "createElement"]) {
    assert.ok(b.indexOf(bad) < 0, "the Audio sheet carries " + bad + ", so it looks live");
  }
  // And it is still in the row, because he asked for it to be.
  assert.match(nocomment(fn("clubToolsHtml")), /tool\("audio"/, "Audio is not offered at all");
});

/**
 * ⚠️⚠️ THE SLIDER DOES NOT REDRAW ON INPUT, AND THAT IS NOT AN OPTIMISATION. clubEdDraw rebuilds the
 * whole editor, so redrawing per input event destroys the input the finger is holding — the trap the
 * Support search field needed its caret restored for, and the one that made the video trim snap back to
 * the start on every drag.
 */
test("BLOCKER: the adjustment slider is not rebuilt under the finger", () => {
  const w = nocomment(fn("wireClubTools"));
  const oninput = /dial\.oninput = ([\s\S]*?);\n/.exec(w);
  assert.ok(oninput, "the dial has no input handler");
  const live = /const live = \(\) => \{([\s\S]*?)\n    \};/.exec(w);
  assert.ok(live, "the dial's live handler could not be found");
  assert.ok(live![1]!.indexOf("clubEdDraw") < 0,
    "the dial redraws the editor on every input event, which rebuilds the slider being dragged");
  assert.match(live![1]!, /clubEdFit\(\)/, "the dial changes nothing visible while it is dragged");
  // ⚠️ AND IT REDRAWS ONCE THE FINGER IS UP, or the dial row's own numbers never catch up.
  assert.match(w, /dial\.onchange = \(\) => \{ live\(\); clubEdDraw\(\); \}/,
    "the editor never catches up after the slider is let go");
  // The overlay's two sliders are the same shape for the same reason.
  assert.match(w, /ovk\.onchange = \(\) => clubEdDraw\(\)/, "the overlay size slider never settles");
  assert.match(w, /ovr\.onchange = \(\) => clubEdDraw\(\)/, "the overlay angle slider never settles");
});

/**
 * ⚠️ THE LOOK REACHES EVERY POSTED SURFACE THROUGH ONE APPLIER. The composer's preview, the grid tile,
 * the post feed and the full-screen viewer all go through clubApplyLook — two copies of this is the
 * composer and the grid disagreeing about one picture, which is the debrief hero's two-framings fault.
 */
test("BLOCKER: one applier puts the look on the composer and on every posted surface", () => {
  const app = noApp();
  // Every place a club media span is emitted carries the look.
  const spans = [...app.matchAll(/data-cmed="'? ?\+? ?/g)].length;
  assert.ok(spans >= 3, "expected at least three club media sites; found " + spans);
  const attrs = [...app.matchAll(/clubLookAttrs\(/g)].length;
  assert.ok(attrs >= 4, "clubLookAttrs is called " + attrs + " times; one media site does not carry "
    + "the look, so a filter would vanish on that surface");
  // ⚠️ AND ONE PLACE SETS style.filter ON CLUB MEDIA. A second is a surface that can drift.
  const fns = [...app.matchAll(/\nfunction (\w+)\(/g)].map((m) => m[1]!);
  const setters: string[] = [];
  for (const name of fns) {
    if (name === "clubApplyLook") continue;
    const body = nocomment(fn(name));
    if (/\.style\.filter\s*=/.test(body)) setters.push(name);
  }
  assert.deepEqual(setters, [], "these set a filter themselves instead of asking clubApplyLook: " +
    setters.join(", "));
  assert.match(nocomment(fn("clubApplyLook")), /getBoundingClientRect/,
    "the applier does not measure the node, so the rotation cannot cover its box");
  assert.match(nocomment(fn("clubFillMedia")), /clubApplyLook\(/,
    "a posted surface's media never has the look applied to it");
});

/**
 * ⚠️ AN OVERLAY IS A PHOTOGRAPH, IT IS CAPPED, AND ITS BYTES LIVE AND DIE WITH THE POST. A video overlay
 * is a compositing problem this app cannot export or keep in sync; and a blob nothing points at after a
 * delete is a leak the delete dialog promised would not happen.
 */
test("BLOCKER: an overlay is a photo, capped, and deleted with the post", () => {
  const add = nocomment(fn("clubOvAdd"));
  assert.match(add, /accept = "image\/\*"/, "an overlay picker offers videos");
  assert.match(add, /CLUB_OV_MAX/, "there is no ceiling on how many overlays one picture carries");
  assert.match(add, /toast\(/, "a refused overlay is refused in silence");
  // ⚠️ THE KEYS ARE IN clubKeys, which is what the delete sweep and the loader both read.
  const keys = nocomment(fn("clubKeys"));
  assert.match(keys, /\(x\.ov \|\| \[\]\)/, "clubKeys does not include the overlays' keys, so deleting "
    + "a post leaves their bytes behind for ever");
  // Driven: a post carrying an overlay reports both keys.
  const run = new Function(nocomment(fn("clubSlides")) + "\n" + nocomment(fn("clubKeys")) +
    "\nreturn clubKeys;")();
  assert.deepEqual(run({ slides: [{ media: "a", ov: [{ media: "o1" }, { media: "o2" }] },
    { media: "b" }] }), ["a", "o1", "o2", "b"], "clubKeys misses an overlay");
  assert.deepEqual(run({ media: "old", crop: null }), ["old"],
    "a post from before overlays existed no longer reports its own key");
});

/**
 * ⚠️ THE RATIO IS ON THE POST, NOT THE SLIDE, and the fallback is the shape every post made before the
 * tool existed was composed at — so nothing already up moves.
 */
test("BLOCKER: the ratio belongs to the post, and an older post keeps its shape", () => {
  const post = nocomment(fn("clubEdPost"));
  assert.match(post, /ratio: S\.ratio !== "orig" \? S\.ratio : undefined/,
    "the ratio is not stored on the row, or is stored even when it is the default");
  const slide = post.slice(post.indexOf("slides: slides.map"));
  assert.ok(slide.indexOf("ratio") < 0,
    "a slide carries a ratio of its own, so one post could have slides of two shapes to swipe between");
  const sheet = nocomment(sheetOf(page()));
  const sl = /\.cp-slide\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(sl, "no .cp-slide rule");
  assert.match(sl![1]!, /aspect-ratio:\s*var\(--car,\s*4 \/ 5\)/,
    "the feed slide does not fall back to 4:5, so every post made before the Ratio tool moves");
  const r = new Function(nocomment(fn("clubRatio")) +
    "\nconst CLUB_RATIOS = [{id:'orig',ar:0},{id:'sq',ar:1}];\nreturn clubRatio;")();
  assert.equal(r("nonsense").ar, 0, "an unknown ratio is not the original");
});

/**
 * HIGHLIGHTS AND SHADOWS ARE REAL TONE CURVES (owner, 2026-08-23: "i want you to see if you can sort the
 * highlights and shadows out....there must be a way").
 *
 * ⚠️⚠️ HE WAS RIGHT AND THE CODE'S OWN EARLIER COMMENT WAS WRONG. These need a curve limited to part of
 * the range, which no CSS filter FUNCTION expresses — but SVG's feComponentTransfer is exactly a
 * per-channel lookup table and composes into a CSS filter chain. The mistake was lumping a LOOKUP in
 * with a CONVOLUTION: a component transfer reads one channel of one pixel, where Sharpen reads a pixel's
 * neighbours. Measured in a real browser on a 12-megapixel photograph: the tone curve is p50 8ms per
 * frame, indistinguishable from a plain CSS filter (8ms), while a convolution is 17ms — over the frame
 * budget. So one ships and the other still does not, and now there is a number rather than an assertion.
 */
test("BLOCKER: the tone curve is a real curve — monotone, in range, and at rest when both dials are", () => {
  const t = new Function(clubToneConsts() + nocomment(fn("clubToneQ")) + "\n" +
    nocomment(fn("clubToneTable")) + "\nreturn clubToneTable;")();
  const N = Number(/const CLUB_TONE_N = (\d+)/.exec(appBlock())?.[1]);
  // ⚠️ NOTHING AT ALL WHEN BOTH ARE AT REST. A filter of "url(#identity)" on every picture in the app
  // would be a whole render pass for no change.
  assert.equal(t(0, 0), null, "a filter is built when neither dial has been moved");
  assert.equal(t(1, 0), null, "a value under the quantum is not treated as rest");
  const up = t(0, 100);
  // ⚠️ SEVENTEEN IS THE FLOOR FOR A SMOOTH CURVE. The browser interpolates linearly between samples, so
  // too few turns a smooth shoulder into visible facets — measured against 8, where the curve reads as
  // three straight segments.
  assert.equal(up.length, N, "the table is " + up.length + " samples where the app declares " + N);
  assert.ok(N >= 17, "a " + N + "-sample table is too coarse; the interpolation shows as facets");
  // ⚠️ MONOTONE ACROSS EVERY REACHABLE PAIR. A fold in a lookup table inverts tones and posterises, and
  // it would only show on the photographs that happen to use that part of the range.
  let folds = 0, outOfRange = 0, pairs = 0;
  for (let h = -100; h <= 100; h += 5) {
    for (let s = -100; s <= 100; s += 5) {
      const tab = t(h, s);
      if (!tab) continue;
      pairs++;
      for (let i = 1; i < tab.length; i++) if (tab[i] < tab[i - 1]) folds++;
      if (tab[0] < 0 || tab[tab.length - 1] > 1) outOfRange++;
    }
  }
  assert.equal(pairs, 41 * 41 - 1, "expected every quantised pair but rest; measured " + pairs);
  assert.equal(folds, 0, folds + " folds in the curve across " + pairs + " pairs");
  assert.equal(outOfRange, 0, outOfRange + " curves leave the 0..1 range");
  // ⚠️ AND THE TWO DIALS ARE INDEPENDENT, which is the whole point of anchoring each weight at its own
  // end. Shadows must leave the top of the range alone and Highlights the bottom.
  const sh = t(0, 100), hi = t(100, 0);
  const ident = (i: number) => i / (N - 1);
  for (let i = N - 4; i < N; i++) {
    assert.ok(Math.abs(sh[i]! - ident(i)) < 0.02,
      "Shadows moved the top of the range at sample " + i + " (" + sh[i] + " vs " + ident(i) + ")");
  }
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(hi[i]! - ident(i)) < 0.02,
      "Highlights moved the bottom of the range at sample " + i);
  }
  // Direction: lifting shadows raises black; recovering highlights lowers white.
  assert.ok(sh[0]! > 0.2, "Shadows at +100 barely lifts black (" + sh[0] + ")");
  assert.ok(t(-100, 0)![N - 1]! < 0.8, "Highlights at -100 barely recovers white");
  assert.ok(t(0, -100)![1]! < ident(1), "Shadows at -100 does not deepen the darks");
  const upper = Math.round((N - 1) * 0.75);
  assert.ok(t(100, 0)![upper]! > ident(upper), "Highlights at +100 does not lift the lights");
  // ⚠️ THE STRENGTH IS BOUNDED BY MONOTONICITY, NOT TASTE — so the two constants are checked against the
  // inequality they have to satisfy rather than pinned to a value somebody liked.
  const app = appBlock();
  const k = Number(/const CLUB_TONE_K = ([\d.]+)/.exec(app)?.[1]);
  const W = Number(/const CLUB_TONE_W = ([\d.]+)/.exec(app)?.[1]);
  assert.ok(k > 0 && W > 0, "the curve's constants could not be read");
  assert.ok(k * Math.PI / (2 * W) < 1,
    "k=" + k + " with W=" + W + " makes the weight steeper than 1:1, so the curve can fold");
});

/**
 * ⚠️⚠️ AN UNRESOLVABLE url() MEANS THE ELEMENT IS NOT RENDERED AT ALL — not unfiltered, absent. So the
 * filter def has to exist before any style names it, and nothing may ever be evicted while a picture
 * still points at it.
 */
test("BLOCKER: the tone filter exists before anything references it, and is never evicted", () => {
  const a = nocomment(fn("clubApplyLook"));
  const made = a.indexOf("clubToneUrl(");
  const used = a.indexOf("node.style.filter");
  assert.ok(made > 0 && used > made,
    "the style is set before the filter def is made, so there is a frame in which the picture vanishes");
  const u = nocomment(fn("clubToneUrl"));
  // ⚠️ RE-CHECKED ON EVERY CALL rather than trusting a flag — the defs live in the body and nothing
  // guarantees a future render leaves them there.
  assert.match(u, /if \(!defs\)/, "the defs element is assumed to exist");
  assert.match(u, /querySelector\("#" \+ id\)/, "an existing filter is rebuilt on every call");
  for (const bad of ["remove()", "removeChild", "innerHTML =", "shift()"]) {
    assert.ok(u.indexOf(bad) < 0, "clubToneUrl uses " + bad + "; evicting a def that a picture still "
      + "references makes that picture disappear");
  }
  // ⚠️ sRGB IS NOT OPTIONAL. SVG filters default to linearRGB, and the same table then produces a
  // washed-out result that reads as a bad curve rather than a colour-space mistake.
  assert.match(u, /color-interpolation-filters", "sRGB"/,
    "the filter runs in linearRGB, so the curve will not look like the numbers say");
  // ⚠️ AND clubLook STAYS PURE — it is driven by tests, so minting a def in there would need a DOM.
  const look = nocomment(fn("clubLook"));
  assert.ok(look.indexOf("clubToneUrl") < 0 && look.indexOf("document") < 0,
    "clubLook touches the DOM, so it can no longer be driven as arithmetic");
  assert.match(look, /hi: clubToneQ\(a\.hi\), sh: clubToneQ\(a\.sh\)/,
    "clubLook does not carry the tone out as numbers");
});

test("BLOCKER: Highlights and Shadows are two-way dials and reach a posted surface", () => {
  const app = appBlock();
  const adj = /const CLUB_ADJ = \[([\s\S]*?)\];/.exec(app);
  assert.ok(adj, "CLUB_ADJ could not be found");
  for (const id of ["hi", "sh"]) {
    const row = new RegExp('\\{ id: "' + id + '",[^}]*\\}').exec(adj![1]!);
    assert.ok(row, id + " is not a dial at all");
    // ⚠️ NOT oneWay: recovering highlights and deepening shadows are the halves that matter most, and a
    // dial clamped at zero cannot reach them. Vignette is the only one-way dial there is.
    assert.ok(row![0].indexOf("oneWay") < 0, id + " is one-way, so half of it is unreachable");
    assert.ok(row![0].indexOf("deg") < 0, id + " is measured in degrees");
  }
  // It travels as its own attribute, and the one loader passes it on.
  const attrs = nocomment(fn("clubLookAttrs"));
  assert.match(attrs, /data-chi=/, "highlights do not travel to a posted surface");
  assert.match(attrs, /data-csh=/, "shadows do not travel to a posted surface");
  const fill = nocomment(fn("clubFillMedia"));
  assert.match(fill, /hi: Number\(n\.dataset\.chi\)/, "a posted surface drops the highlights");
  assert.match(fill, /sh: Number\(n\.dataset\.csh\)/, "a posted surface drops the shadows");
});

/**
 * ⚠️⚠️ A REDRAW REBUILDS A SCROLLER, AND A NEW SCROLLER STARTS AT ZERO. His report: "everytime i click on
 * an adjustment type when editing the picture, it jumps back to the start of the list." clubEdDraw
 * rebuilds the whole editor, so the dial row came back with scrollLeft 0 — which made the dials on the
 * right of the row effectively untappable, because tapping one scrolled the row away from it. Same class
 * as the Support search field's captured caret and the video trim snapping back to the start.
 */
test("BLOCKER: a sheet's scrolling row keeps its chosen chip in view across a redraw", () => {
  const keep = new Function(nocomment(fn("clubRowKeep")) + "\nreturn clubRowKeep;")();
  const mk = (scrollLeft: number, chipLeft: number) => {
    const row = { clientWidth: 300, scrollLeft: scrollLeft };
    keep(row, { offsetLeft: chipLeft, offsetWidth: 80 });
    return row.scrollLeft;
  };
  // A chip off the right edge is brought in; off the left, likewise.
  assert.ok(mk(0, 400) > 0, "a chip beyond the right edge is not brought into view");
  assert.ok(mk(0, 400) >= 400 + 80 + 12 - 300, "the chip is only partly brought into view");
  assert.ok(mk(500, 100) <= 100, "a chip left of the view is not brought back");
  // ⚠️ AND A CHIP ALREADY IN VIEW DOES NOT MOVE. A row that re-centres on every redraw is its own
  // jumpiness, one step subtler than the fault being fixed.
  assert.equal(mk(0, 40), 0, "a visible chip still scrolls the row");
  assert.equal(mk(120, 150), 120, "a visible chip still scrolls the row");
  // Nothing to do, and nothing thrown, when there is no row or no selection.
  assert.doesNotThrow(() => keep(null, null));
  // ⚠️ EVERY SCROLLING ROW IN THE COMPOSER IS COVERED, DERIVED FROM THE STYLESHEET — a fourth row added
  // without a keep call is the same defect again, in a place nobody would think to look.
  const sheet = nocomment(sheetOf(page()));
  const rows = [...sheet.matchAll(/^\.(club-(?:dls|fsr|ovr|strip|fps|cap-strip))\s*\{([^}]*)\}/gm)]
    .filter((m) => /overflow-x:\s*auto/.test(m[2]!)).map((m) => m[1]!);
  assert.ok(rows.length >= 3, "expected at least three scrolling rows in the composer; found " + rows.length);
  const w = nocomment(fn("wireClubTools"));
  // ⚠️ club-fsr, NOT club-fr — the filter row was renamed after the filmstrip's frame cell turned out to
  // own that name first, and this list is one of the places that had to follow the rename.
  for (const r of ["club-dls", "club-fsr", "club-ovr"]) {
    assert.ok(rows.indexOf(r) >= 0, "." + r + " is no longer a scrolling row; this guard is stale");
    assert.ok(w.indexOf('".' + r + '"') > 0,
      "." + r + " scrolls but nothing keeps its chosen chip in view after a redraw");
  }
  assert.match(w, /clubRowKeep\(/, "no row is kept in view at all");
});

/**
 * SWIPE RIGHT TO GO BACK TO THE GRID — his request, 2026-08-23.
 *
 * ⚠️⚠️ IT NEVER CALLS preventDefault AND NEVER TOUCHES touch-action, so it cannot break the two scrolls
 * this screen already has: the page scrolls vertically and a carousel swipes sideways exactly as before.
 * A back-swipe that claims the touch up front is how one kills the scrolling it sits on top of.
 */
test("BLOCKER: swiping right leaves the post feed, and nothing else does", () => {
  const src = nocomment(fn("clubWireBackSwipe"));
  for (const bad of ["preventDefault", "touch-action", "stopPropagation"]) {
    assert.ok(src.indexOf(bad) < 0,
      "the back swipe uses " + bad + ", which breaks the scrolling it sits on");
  }
  assert.match(src, /passive: true/, "the listeners are not passive, so the browser must wait on them");
  // Driven: only a clearly horizontal, clearly rightward travel over the threshold goes back.
  const px = Number(/const CLUB_BACK_SWIPE_PX = (\d+)/.exec(appBlock())?.[1]);
  assert.ok(px >= 40, "a threshold of " + px + "px fires on the drift of an ordinary scroll");
  const run = new Function("haptic", "CLUB_BACK_SWIPE_PX",
    nocomment(fn("clubWireBackSwipe")) + "\nreturn clubWireBackSwipe;")(() => {}, px);
  const drive = (dx: number, dy: number, onRail: boolean, railScrolls: boolean) => {
    let went = 0;
    const handlers: Record<string, Array<(e: unknown) => void>> = {};
    const node = { addEventListener: (t: string, f: (e: unknown) => void) => {
      (handlers[t] = handlers[t] || []).push(f); } };
    run(node, () => { went++; });
    const rail = { scrollWidth: railScrolls ? 900 : 300, clientWidth: 300 };
    const target = { closest: (s: string) => (onRail && s === "[data-cprail]" ? rail : null) };
    handlers.pointerdown!.forEach((f) => f({ pointerId: 1, pointerType: "touch", button: 0,
      clientX: 100, clientY: 200, target: target }));
    handlers.pointerup!.forEach((f) => f({ pointerId: 1, clientX: 100 + dx, clientY: 200 + dy }));
    return went;
  };
  assert.equal(drive(140, 10, false, false), 1, "a clear rightward swipe does not go back");
  assert.equal(drive(-140, 10, false, false), 0, "a LEFTWARD swipe goes back");
  assert.equal(drive(px - 5, 4, false, false), 0, "a swipe under the threshold goes back");
  // ⚠️ A DIAGONAL IS A SCROLL, NOT A SWIPE. A loose test throws the runner off the screen they are reading.
  assert.equal(drive(90, 120, false, false), 0, "a mostly-vertical drag goes back");
  // ⚠️ A CAROUSEL'S RAIL IS EXEMPT WHILE IT HAS SOMEWHERE TO GO — there, sideways means "next picture".
  assert.equal(drive(140, 10, true, true), 0, "swiping a multi-picture carousel leaves the screen");
  assert.equal(drive(140, 10, true, false), 1,
    "a single-picture post's rail cannot scroll, so a swipe there should still go back");
  // ⚠️ THE SWIPE AND THE CHEVRON GO TO THE SAME PLACE, or two ways back mean two different backs.
  const wire = nocomment(fn("wireClubPostView"));
  assert.match(wire, /clubWireBackSwipe\(\$\("view"\), \(\) => \{ state\.screen = null; state\.clubPostId = null; render\(\); \}\)/,
    "the swipe does not go where the back chevron goes");
});

/**
 * ⚠️⚠️ A CLASS THAT MEANS TWO THINGS IS LEGAL CSS, AND THAT IS WHY THIS NEEDS A COUNT RATHER THAN AN EYE.
 * `.club-fr` was the filmstrip's frame cell; the composer's filter row reused the name, and being later
 * in the sheet it gave every frame of a story's fifteen-second strip `display: flex` and 12px of side
 * padding. He reported it as "the 15 second slide bar looks messy on the corners", which is exactly what
 * it looked like — and the build, the typecheck and 1270 tests all passed.
 * ⚠️ A RATCHET, NOT A BAN. Seventeen single-class rules in this stylesheet are legitimately declared
 * twice (a base plus a scoped override), so a blanket rule would need an allowlist that goes stale. The
 * count is what must never grow — the same shape as the radius and font-size ratchets.
 */
/* ⚠️ 17 -> 18 for .gps-sig, and this one CANNOT be merged the way .club-win was. Its second rule is
   inside an @container block — the short-map layout lifts the signal pill clear of the control row once
   the controls spread sideways — and a container query is a separate block by construction. So it is the
   base-plus-scoped-override category this ceiling exists to permit, not a class meaning two things. */
const CSS_DUP_CEILING = 18;
test("BLOCKER: no new CSS class is declared twice", () => {
  const css = nocomment(sheetOf(page()));
  const counts: Record<string, number> = {};
  for (const m of css.matchAll(/(^|\})\s*(\.[a-z][a-z0-9-]*)\s*\{/g)) {
    counts[m[2]!] = (counts[m[2]!] || 0) + 1;
  }
  const dup = Object.entries(counts).filter(([, n]) => n > 1).map(([k, n]) => k + " x" + n);
  assert.ok(dup.length <= CSS_DUP_CEILING,
    dup.length + " classes are declared more than once (ceiling " + CSS_DUP_CEILING + "). A class that "
    + "means two things silently applies one component's rules to the other: " + dup.join(", "));
  // ⚠️ AND THE PAIR THAT ACTUALLY BIT IS NAMED, so a rename back cannot slip through under the ratchet.
  assert.equal(counts[".club-fr"], 1,
    ".club-fr is declared " + counts[".club-fr"] + " times; it is the filmstrip's frame cell, and the "
    + "filter swatch row is .club-fsr precisely because sharing it broke the story trim");
  assert.match(nocomment(fn("clubFilterBody")), /class="club-fsr"/,
    "the filter row is back on the filmstrip's class name");
});

/**
 * ⚠️⚠️ THE TRIM IS IN FLOW, NOT PINNED AT A MAGIC OFFSET. It was `bottom: 118px`, which cleared the
 * chrome exactly while the chrome was one row of buttons — and the moment the tool row and the tool
 * sheets went in below it, the fifteen-second strip was drawn straight over them ("the slide bar
 * overlaps the edit tools"). As a flex child it cannot overlap whatever is beneath it however much is
 * added later, which is the point: a number that has to be updated whenever the chrome changes is a
 * number somebody forgets.
 */
test("BLOCKER: the story trim sits above the tools rather than over them", () => {
  const sheet = nocomment(sheetOf(page()));
  const trim = /\.club-trim\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(trim, "no .club-trim rule");
  assert.ok(!/position:\s*absolute/.test(trim![1]!),
    "the trim is positioned absolutely, so it overlaps whatever is added below it");
  assert.ok(!/bottom:\s*\d/.test(trim![1]!),
    "the trim is pinned at a fixed offset from the bottom; that constant is what broke");
  assert.match(trim![1]!, /flex:\s*none/, "the trim can be squeezed or stretched by the column");
  // ⚠️ IT IS EMITTED BEFORE THE SHEET AND THE TOOL ROW, which is what puts it above them in the flow.
  const draw = nocomment(fn("clubEdDraw"));
  const t = draw.indexOf("clubTrimHtml(S)");
  const sh = draw.indexOf("clubSheetHtml(S, sl)");
  const to = draw.indexOf("clubToolsHtml(S, sl)");
  assert.ok(t > 0 && sh > t && to > sh,
    "the trim, the tool sheet and the tool row are not in that order, so the column stacks them wrongly");
  // ⚠️ THE CORNER FIX MOVED ON: matching the handle's radius to the border's inner curve was the first
  // attempt and it still left a hairline where two coincident curves anti-aliased. The bracket is one
  // shape now, so the claim is that the window carries the radius and the handle carries none — asserted
  // in full by "the trim bracket is one white shape", and kept here because this test is the trim's own.
  const win = /\.club-win\s*\{([^}]*)\}/.exec(sheet);
  const ha = /\.club-h-a\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(win && ha, "the trim window or its handle has no rule");
  assert.match(win![1]!, /border-radius:\s*var\(--r-ctl\)/, "the trim window is not rounded at all");
  assert.ok(!/border-radius/.test(ha![1]!),
    "the handle carries a radius again; two rounded white shapes at one corner leave a hairline seam");
});

/**
 * ⚠️⚠️ THE TRIM'S DIMMING IS GENERATED FROM THE SELECTION'S OWN SHAPE, and the two rectangles it replaced
 * are what he kept circling: "the corners of the slide bar still look untidy", three reports running.
 * They were square while the white bracket is rounded, so at each of the four corners a sliver of BRIGHT,
 * undimmed video sat inside the window's box but outside its curve — four pale pips against a dimmed
 * strip. Measured after, from rendered pixels: all four corners read luma 13–58 against the dimmed
 * strip's 61 and the selection's 154. An outer shadow follows the element's own border-radius by
 * construction, where two rectangles matched it only by an arithmetic coincidence.
 */
test("BLOCKER: the trim dims everything outside the selection, corners included", () => {
  const sheet = nocomment(sheetOf(page()));
  const win = /\.club-win\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(win, "no .club-win rule");
  assert.match(win![1]!, /box-shadow:\s*0 0 0 \d+px/,
    "the dimming is not the selection's own outer shadow, so it cannot follow its corners");
  // ⚠️ THE SPREAD HAS TO COVER THE STRIP FROM ANY POSITION — a phone is at most a few hundred px wide.
  const spread = Number(/box-shadow:\s*0 0 0 (\d+)px/.exec(win![1]!)?.[1]);
  assert.ok(spread >= 450, "a spread of " + spread + "px leaves part of the strip undimmed");
  // ⚠️ AND THE RECTANGLES ARE GONE, NOT LEFT UNUSED. An orphaned rule is what the next component copies.
  assert.ok(!page().includes("club-shade"),
    ".club-shade survives somewhere; the two square shades are what made the corners untidy");
  const paint = nocomment(fn("clubTrimPaint"));
  assert.ok(paint.indexOf("club-shade") < 0,
    "the live paint still positions shades, so it moves elements that no longer exist");
  assert.match(paint, /win\.style\.left/, "the live paint no longer moves the selection");
});

/**
 * ⚠️⚠️ THE BRACKET IS ONE WHITE SHAPE, NOT TWO STACKED ONES. It used to be a 2px white border with a
 * separate white handle inside it, both rounded to the same curve at the same centre — two coincident
 * curves anti-alias twice, so a hairline arc showed inside every corner. Magnified 24x it is
 * unmistakable; at 1x it reads as a ragged double edge.
 */
test("BLOCKER: the trim bracket is one white shape, and its three widths agree", () => {
  const sheet = nocomment(sheetOf(page()));
  const win = /\.club-win\s*\{([^}]*)\}/.exec(sheet)![1]!;
  const h = /\.club-h\s*\{([^}]*)\}/.exec(sheet)![1]!;
  const ha = /\.club-h-a\s*\{([^}]*)\}/.exec(sheet)![1]!;
  const hb = /\.club-h-b\s*\{([^}]*)\}/.exec(sheet)![1]!;
  // The white comes from the border, and only from the border.
  const side = Number(/border-left-width:\s*(\d+)px/.exec(win)?.[1]);
  assert.ok(side >= 10, "the window's left border is " + side + "px; the white ends come from it");
  assert.match(win, new RegExp("border-right-width:\\s*" + side + "px"),
    "the two white ends are different widths");
  assert.ok(!/background/.test(h),
    "the handle paints white of its own, so two white shapes stack and seam at the corners");
  assert.ok(!/border-radius/.test(ha) && !/border-radius/.test(hb),
    "a handle carries its own radius again, which is the coincident curve that seamed");
  // ⚠️ THREE NUMBERS THAT MUST AGREE: the border's width, the handle's width, and the handle's offset.
  // The handle is positioned against the padding box, which the border has already inset — so if they
  // drift, the grab area sits off the white it is meant to be.
  const hw = Number(/width:\s*(\d+)px/.exec(h)?.[1]);
  assert.equal(hw, side, "the handle is " + hw + "px over a " + side + "px white end");
  assert.match(ha, new RegExp("left:\\s*-" + side + "px"),
    "the start handle does not sit over the white end");
  assert.match(hb, new RegExp("right:\\s*-" + side + "px"),
    "the end handle does not sit over the white end");
  // The 44px hit area still grows OUTWARD only — the window's interior belongs to the move gesture.
  assert.match(sheet, /\.club-h-a::after[^}]*left:\s*-30px[^}]*right:\s*0/,
    "the start handle's hit area no longer grows outward only");
  assert.match(sheet, /\.club-h-b::after[^}]*left:\s*0[^}]*right:\s*-30px/,
    "the end handle's hit area no longer grows outward only");
});

/**
 * ⚠️⚠️ A WORD MUST NOT RE-WRAP AS IT IS MOVED, and that was his "it jumps around". An absolutely
 * positioned box's available width is its containing block MINUS its own left offset, so dragging the
 * text right squeezed the space left for it and it reflowed under the finger. Measured on a two-line
 * caption dragged 80px right and 150px down: 215x82 and two lines became 135x160 and FOUR, changing at
 * every pointermove. After: 361x82 and two lines, identical at every step of two drags.
 */
test("BLOCKER: a word on the picture keeps its shape wherever it is put", () => {
  const sheet = nocomment(sheetOf(page()));
  const tx = /\.club-tx\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(tx, "no .club-tx rule");
  assert.match(tx![1]!, /width:\s*max-content/,
    "the text's width still depends on where it sits, so it re-wraps as it is dragged");
  // ⚠️ AND THE CAP IS A PERCENTAGE OF THE STAGE, which the left offset does not touch — that is what
  // still decides where it wraps once max-content has taken the available width out of it.
  assert.match(tx![1]!, /max-width:\s*\d+%/, "the wrap width is not a share of the stage");
  // ⚠️ NO DASHED SELECTION BOX — his "weird dotted lines on the top and bottom". The bin appearing in the
  // rail is what says a word is selected; a dashed box as well is the same thing said twice.
  const on = /\.club-tx\.on\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(on, "nothing marks the selected word");
  assert.ok(!/outline/.test(on![1]!), "the dashed outline is back on the selected word");
});

/**
 * ⚠️ ONE BUILDER FOR A WORD, ASKED BY ALL THREE SURFACES. The composer, the story viewer and the post
 * feed each used to write this markup themselves, so a new field — the rotation — would have had to be
 * added in three places or the same text would sit differently depending on where it was looked at.
 */
test("BLOCKER: one builder draws a word, and one function styles it", () => {
  const app = appBlock();
  assert.ok(!/class="club-tx"/.test(app),
    "a surface still writes its own club-tx markup, so a new field will be dropped there");
  const calls = [...nocomment(app).matchAll(/clubTextSpan\(/g)].length;
  assert.ok(calls >= 4, "clubTextSpan is called " + calls + " times; expected its definition and the "
    + "composer, the story viewer and the post feed");
  // ⚠️ THE PREVIEW AND THE RESULT ASK THE SAME STYLER. Two style paths let the runner choose one look
  // and post another — the composer-and-grid disagreement this file records twice.
  assert.match(nocomment(fn("clubTextSpan")), /clubTxCss\(/, "the word on the picture is styled by hand");
  // ⚠️ THE TEXTAREA'S OWN style ATTRIBUTE, not a mention of clubTxCss anywhere in the function — the size
  // slider also calls it, so "the function mentions it" was satisfied with the preview styled by hand.
  // ⚠️⚠️ RESTATED 2026-08-24, AND THE INVARIANT GOT STRONGER RATHER THAN WEAKER. It pinned the panel's
  // OWN preview word — which no longer exists, because the draft is now a real word on the picture built
  // by clubTextSpan like every other. So there is one builder where there were two, which is what this
  // test is named for; the guard has to assert the panel builds no word of its own.
  const draw = nocomment(fn("clubTextDraw"));
  assert.doesNotMatch(draw, /class="club-tx[ "]/,
    "the panel builds its own preview word again, so the runner styles one thing and posts another");
  assert.match(nocomment(fn("clubEdDraw")), /clubTextSpan\(S\.draft, "d", true\)/,
    "the word being typed is not drawn on the picture by the one word builder");
  // And the one place that repaints it in place must ask the same styler.
  assert.match(nocomment(fn("clubDraftPaint")), /clubTxCss\(/,
    "the draft is repainted by hand rather than by the function that styles the result");
});

/**
 * ⚠️ THE HIGHLIGHT PLATE COMPUTES ITS OWN INK, so a white plate gets black words and a black plate white
 * ones — his screenshots 3 and 4, and both fall out of ONE state rather than needing two.
 */
test("BLOCKER: the text plate reads, the glow replaces the keyline, and legacy words survive", () => {
  const ink = new Function(nocomment(fn("clubTxInk")) + "\nreturn clubTxInk;")();
  assert.equal(ink("#ffffff"), "#0a0a0a", "a white plate does not get dark words");
  assert.equal(ink("#0a0a0a"), "#ffffff", "a black plate does not get light words");
  assert.equal(ink("#ffd60a"), "#0a0a0a", "a bright yellow plate does not get dark words");
  assert.equal(ink("#0a3d62"), "#ffffff", "a deep blue plate does not get light words");
  // ⚠️ A NON-HEX FALLS BACK RATHER THAN THROWING. Words stored before the palette became hex-only carry
  // a token, and a plate on one of those must still be readable.
  assert.equal(ink("var(--accent)"), "#ffffff", "a token colour is not handled");
  assert.equal(ink(undefined), "#ffffff", "a missing colour is not handled");

  const css = new Function(nocomment(fn("clubTxStyle")) + "\n" + nocomment(fn("clubTxInk")) + "\n" +
    nocomment(fn("clubTxCss")) + "\n" +
    "const CLUB_TX_STYLES = [{ id: 'clean', label: 'Clean', css: 'font-weight: 800' }];\n" +
    "const CLUB_TX_ALIGN = ['center','left','right'];\nreturn clubTxCss;")();
  // ⚠️ THE PLATE DROPS THE KEYLINE. A dark halo round black words on a white plate is dirt.
  const plate = css({ colour: "#ffffff", bg: 1 }, 34);
  assert.match(plate, /background:\s*#ffffff/, "the plate has no background");
  assert.match(plate, /color:\s*#0a0a0a/, "the plate's ink is not computed");
  assert.match(plate, /text-shadow:\s*none/, "the plate keeps the keyline, which reads as dirt");
  // ⚠️ AND THE GLOW REPLACES IT TOO — a deep outline under a glow is a dark line inside a halo.
  const neon = css({ colour: "#ffd60a", fx: "neon" }, 34);
  assert.match(neon, /text-shadow:[^;]*#ffd60a/, "the glow is not in the chosen colour");
  assert.ok(neon.indexOf("background") < 0, "the glow drags a plate along with it");
  // Plain text says nothing about the shadow, so .club-tx's own keyline stands.
  assert.ok(css({ colour: "#ffffff" }, 34).indexOf("text-shadow") < 0,
    "plain text overrides the keyline the stylesheet gives it");
  // Alignment is one of the three, and anything else is centred.
  assert.match(css({ colour: "#fff", align: "left" }, 34), /text-align:\s*left/, "alignment is ignored");
  assert.match(css({ colour: "#fff", align: "nonsense" }, 34), /text-align:\s*center/,
    "an unknown alignment is not centred");

  // ⚠️ A WORD STORED BEFORE THE STYLES EXISTED CARRIES A font AND NO style, and must still look itself.
  const span = nocomment(fn("clubTextSpan"));
  assert.match(span, /!t\.style && t\.font/, "an older word loses the typeface it was written in");
});

/**
 * ⚠️ TWO FINGERS ON A WORD SCALE AND TURN IT — his "wont scale up or down". It did not exist: the stage's
 * own pinch bails out on a touch that starts on a word, so nothing handled it. Measured through the real
 * handler: a two-finger spread took the size 34 to 70 and the rotation 0 to 14 degrees.
 */
test("BLOCKER: two fingers on a word scale and turn it, within bounds", () => {
  // ⚠️ RESTATED 2026-08-24. It pinned `pts.size === 2` and `pinch = {`, and the baseline is now re-taken
  // on EVERY change of finger count rather than only when the second lands — which is a strictly
  // stronger rule (lifting one finger used to jump the word back). Scoped to a how, again.
  const d = nocomment(fn("clubTextDrag")) + "\n" + nocomment(fn("clubTxAnchor")) + "\n"
    + nocomment(fn("clubTxMove")) + "\n" + nocomment(fn("clubTxUp"));
  assert.match(d, /(pts\.size|p\.length) >?=+ 2/, "a second finger on a word is not noticed");
  assert.match(d, /Math\.hypot/, "nothing measures the pinch");
  assert.match(d, /Math\.atan2/, "nothing measures the twist");
  // ⚠️ THE BASELINE IS RE-TAKEN ON EVERY CHANGE OF FINGER COUNT — both directions. Taken only when the
  // second lands, lifting it measured the rest of the gesture from a baseline that included a finger
  // that had gone, which is the jump he reported as "jittery".
  assert.match(nocomment(fn("clubTextDrag")), /clubTxAnchor\(\)/,
    "a finger landing does not re-take the baseline");
  assert.match(nocomment(fn("clubTxUp")), /pts\.size >= 1[\s\S]{0,60}clubTxAnchor/,
    "a finger lifting does not re-take the baseline, so the word jumps back");
  // Clamped, so a wild gesture cannot leave a word unreadable or off the picture.
  assert.match(d, /CLUB_TX_MIN/, "the size can be pinched to nothing");
  assert.match(d, /CLUB_TX_MAX/, "the size can be pinched past the picture");
  const app = appBlock();
  // ⚠️ THEY ARE DECLARED TOGETHER ON ONE LINE, and a regex expecting its own `const` for each read NaN
  // for the second — a probe that cannot see half its input reports nonsense about the half it can.
  const lo = Number(/CLUB_TX_MIN = (\d+)/.exec(app)?.[1]);
  const hi = Number(/CLUB_TX_MAX = (\d+)/.exec(app)?.[1]);
  assert.ok(lo >= 8 && hi > lo && hi <= 200, "the size bounds are " + lo + "-" + hi + ", which is not sane");
  // ⚠️⚠️ RESTATED 2026-08-24, AND IT PINNED THE DEFECT ITSELF. It required `node.onpointerdown = add` —
  // the drag overwriting the binding wireClubEd had put there, and then NULLING it on release, which left
  // the word dead to a drag or a tap until something redrew. Invisible for as long as a finished drag
  // redrew; removing the redraw (the black flash) is what exposed it. The invariant this was protecting —
  // the pointers belong to the WORD, so one gesture has one owner — is unchanged and better served.
  assert.match(d, /setPointerCapture/, "a second finger on the word is not captured by the word");
  assert.match(d, /CLUB_TXG && CLUB_TXG\.node === node/,
    "a second finger starts its own gesture with its own pointer map instead of joining the first");
  for (const f of ["clubTextDrag", "clubTxUp"]) {
    assert.doesNotMatch(nocomment(fn(f)), /onpointerdown\s*=/,
      f + " writes onpointerdown, which belongs to wireClubEd — after one drag the word goes dead");
  }
});

/**
 * ⚠️ THE PLAYHEAD IS A FRAME LOOP THAT CANCELS ITSELF — his own diagram of a line showing where in the
 * clip the preview has reached. timeupdate fires about four times a second, and a marker moving in four
 * visible steps reads as broken rather than as a playhead.
 */
test("BLOCKER: the trim carries a playhead that glides and stops itself", () => {
  const p = nocomment(fn("clubPlayhead"));
  assert.match(p, /requestAnimationFrame/, "the playhead does not run on a frame loop");
  assert.ok(p.indexOf("ontimeupdate") < 0, "the playhead steps at timeupdate's four frames a second");
  // ⚠️ IT STOPS ITSELF rather than being cleared from somewhere else — a loop cancelled by its caller is
  // a loop that keeps running behind a closed sheet, which this app has paid for twice.
  assert.match(p, /if \(!CLUBED \|\| now !== ph \|\| m !== med \|\| clubSlide\(\) !== sl/,
    "the playhead does not check that it is still wanted, so it runs on behind a closed editor");
  // Hidden while paused or outside the chosen window: a line parked at the far end points at nothing.
  assert.match(p, /!m\.paused && t >= sl\.inS/, "the playhead shows while paused or outside the window");
  assert.match(nocomment(fn("clubVidLoop")), /clubPlayhead\(sl\)/, "nothing ever starts the playhead");
  assert.match(nocomment(fn("clubStripHtml")), /club-ph/, "the strip has no playhead in it");
  const sheet = nocomment(sheetOf(page()));
  const ph = /\.club-ph\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(ph, "no .club-ph rule");
  // ⚠️ IT MUST EAT NO GESTURES. Over a handle it would swallow the drag on whichever end it crossed.
  assert.match(ph![1]!, /pointer-events:\s*none/, "the playhead eats the drag on the handle it crosses");
  assert.match(ph![1]!, /z-index:\s*[1-9]/, "the playhead is under the white bracket it has to cross");
});

/**
 * ⚠️ WHAT IS NOT BUILT IS NAMED, NOT OFFERED. The reference's animations play on the finished story
 * rather than in the editor; Sparkle, Shimmer and Pixel need an animation or a display face this app
 * cannot fetch; Mention needs accounts and a server the club has not got. A control that does nothing is
 * the class this project has shipped three times.
 */
test("BLOCKER: the text editor names what it cannot do and offers no dead control", () => {
  const d = nocomment(fn("clubTextDraw"));
  const tools = [...d.matchAll(/tool\("(\w+)"/g)].map((m) => m[1]!);
  assert.deepEqual(tools, ["style", "colour", "plate", "align", "fx"],
    "the text tools are " + tools.join(", "));
  for (const dead of ["Mention", "Sparkle", "Shimmer", "Pixel", "Typewriter effect"]) {
    assert.ok(d.indexOf('>' + dead) < 0, "the editor offers " + dead + ", which does nothing");
  }
  assert.match(d, /club-tnote/, "nothing says why the missing effects are missing");
  // Every rail is reachable from the row, and every button in a rail is wired.
  for (const attr of ["data-ctst", "data-ccol", "data-ctpage", "data-ctal", "data-ctfx", "data-ctt"]) {
    assert.match(d, new RegExp('\\[' + attr + '\\]'), attr + " is rendered but never wired");
  }
  // ⚠️ THE SIZE CONTROL DOES NOT REBUILD, for the same reason the composer's dials do not: a rebuild
  // destroys the input the finger is holding. RESTATED 2026-08-24 for the second time — sz.oninput was
  // the horizontal slider's mechanism; the control is the reference's vertical knob now, wired in
  // wireClubEd because its track lives on the stage.
  const wireK = nocomment(fn("wireClubEd"));
  const kAt = wireK.indexOf("data-cszk");
  assert.ok(kAt > 0, "the size knob has no handler");
  const kBody = wireK.slice(kAt, wireK.indexOf("clubSzPaint();", kAt) + 20);
  assert.ok(kBody.indexOf("clubTextDraw") < 0 && kBody.indexOf("clubEdDraw") < 0,
    "the size knob rebuilds the chrome or the stage on every input, destroying the track being dragged");
  assert.match(kBody, /clubDraftPaint\(\)/,
    "the size knob changes nothing on the picture until Done is pressed");
});

/**
 * THE ⋮ MENU: AN OBVIOUS DELETE, AND KEEPING A STORY BEHIND A PLAN JOURNAL (owner, 2026-08-24).
 * "This needs to be a more obvious delete button and there's no need for the explanation underneath",
 * and "the individual story theyre on can be added to the plan journal ... if the user has more than one
 * journal on their profile, they're given the option to choose which one to add it to".
 */
test("BLOCKER: the post menu is two obvious actions and no explanation", () => {
  const m = nocomment(fn("clubPostMenuHtml"));
  const acts = [...m.matchAll(/data-cact="(\w+)"/g)].map((x) => x[1]!);
  assert.deepEqual(acts, ["keep", "delete"], "the menu offers " + acts.join(", "));
  // ⚠️ THE PARAGRAPH IS GONE. A note about features that do not exist yet, in a menu whose job is one
  // destructive action, buried the action itself.
  assert.ok(m.indexOf("club-mi-note") < 0, "the explanation is back under the menu");
  assert.ok(m.indexOf("Commenting") < 0, "the note about commenting and likes is back");
  // Both are real buttons carrying an icon and a word — never colour alone to say which is destructive.
  assert.match(m, /class="club-mi club-mi-bad"[^>]*data-cact="delete"/, "delete is not the destructive one");
  assert.match(m, /ICON\.trash/, "the delete has no bin on it");
  assert.match(m, /ICON\.journal/, "the keep has no icon on it");
  assert.match(m, /Delete ' \+ word/, "the delete does not name what it deletes");
  // Both reach the one handler.
  const a = nocomment(fn("clubPostAction"));
  assert.match(a, /act === "keep"/, "the keep action is not handled");
  assert.match(a, /act !== "delete"/, "the delete action is not handled");
});

/**
 * ⚠️⚠️ THE JOURNAL KEEPS A SNAPSHOT OF THE ROW, NOT A REFERENCE TO IT, AND THAT IS THE WHOLE POINT. A
 * story is swept 24 hours after it was posted and its blobs go with it — so a journal holding only the
 * post's id would show a hatched cell the next morning, which is worse than not offering this at all.
 * Measured against IndexedDB itself: with the story expired and swept, the kept copy's blob is still in
 * the store; remove the kept copy and it is gone.
 */
test("BLOCKER: a kept copy is a snapshot, and nothing deletes bytes a journal still wants", () => {
  const keep = nocomment(fn("clubKeepIn"));
  assert.match(keep, /JSON\.parse\(JSON\.stringify\(p\)\)/,
    "the journal stores a reference rather than a snapshot, so the copy dies with the story");
  assert.match(keep, /CLUB_KEEP_MAX/, "there is no ceiling on what one journal keeps");
  // ⚠️ THE SAME ONE IS NOT ADDED TWICE — tapping the menu again would otherwise stack copies.
  assert.match(keep, /some\(\(k\) => k && k\.id === p\.id\)/, "the same story can be kept twice over");

  // ⚠️ BOTH DELETERS ASK THE SAME QUESTION. Either one forgetting is a video deleted out from under a
  // journal, and it only shows weeks later.
  for (const f of ["clubStories", "clubDelete"]) {
    const body = nocomment(fn(f));
    assert.match(body, /clubMediaInUse\(/,
      f + " deletes blobs without asking whether a journal still points at them");
  }
  // ⚠️ AND THE ROWS ARE SAVED BEFORE THE SWEEP, an ORDERING claim: asked first, the in-use check would
  // still see the story that is on its way out and conclude its own bytes are wanted.
  // ⚠️⚠️ AN ORDERING CHECK MUST FIRST PROVE BOTH HALVES EXIST. indexOf returns -1 for a missing needle,
  // and -1 is less than any real index — so deleting the clubSave call outright SATISFIED this, which a
  // re-break caught. Assert both are present, then assert the order.
  for (const f of ["clubStories", "clubDelete"]) {
    const body = nocomment(fn(f));
    const save = body.indexOf("clubSave(");
    const used = body.indexOf("clubMediaInUse(");
    assert.ok(save >= 0, f + " no longer saves the rows at all");
    assert.ok(used >= 0, f + " no longer asks whether the media is in use");
    assert.ok(save < used,
      f + " asks whether the media is in use before removing the row, so it always answers yes");
  }
  // Driven: the check reads both the live rows and every journal's kept snapshots.
  const inUse = new Function("clubLoad", "loadJournals", "clubKeys",
    nocomment(fn("clubMediaInUse")) + "\nreturn clubMediaInUse;");
  const keys = (p: { media?: string[] }) => p.media || [];
  const run = (rows: unknown[], journals: unknown[], key: string, except?: string) =>
    inUse(() => rows, () => journals, keys)(key, except);
  assert.equal(run([{ id: "a", media: ["k1"] }], [], "k1"), true, "a live post's own media reads as free");
  assert.equal(run([{ id: "a", media: ["k1"] }], [], "k1", "a"), false,
    "the row being deleted counts as a reason to keep its own bytes");
  assert.equal(run([], [{ keep: [{ id: "a", media: ["k1"] }] }], "k1"), true,
    "a blob a journal has kept reads as free, so the story sweep would delete it");
  assert.equal(run([], [{ keep: [] }, {}], "k1"), false, "an unreferenced blob reads as in use");
  assert.equal(run([], [], ""), false, "an empty key reads as in use");
});

/**
 * ⚠️ ONE JOURNAL KEEPS IT STRAIGHT AWAY; SEVERAL ASK WHICH — his instruction. And with none, it says why
 * rather than doing nothing, because a journal only exists once a plan does.
 */
test("BLOCKER: the journal chooser only appears when there is a choice, and above the viewer", () => {
  const ask = nocomment(fn("clubKeepAsk"));
  assert.match(ask, /if \(!js\.length\)/, "somebody with no plan gets no explanation");
  assert.match(ask, /toast\(/, "the no-journal case fails silently");
  assert.match(ask, /js\.length === 1.*clubKeepIn\(js\[0\]\.id, p\)/s,
    "a single journal still asks which one");
  // ⚠️ ITS OWN OVERLAY, NOT THE APP'S BOTTOM SHEET — that draws at z-index 70 under a viewer at 96, which
  // is the fault this file records shipping twice.
  for (const bad of ["ensureSheet(", "sheetBody", "closeSheet("]) {
    assert.ok(ask.indexOf(bad) < 0, "the chooser uses " + bad + ", which opens behind the story");
  }
  assert.match(ask, /club-ask/, "the chooser is not on the dialog layer");
  assert.match(ask, /aria-modal="true"/, "the chooser is not a modal");
  assert.match(ask, /overlayModal\(ov, true, "\[data-ckeep=''\]"\)/,
    "focus does not land on Cancel, which is the safe option on a dialog");
  const z = (sel: string) => {
    const m = new RegExp("\\" + sel + "[^{}]*\\{[^}]*z-index:\\s*(\\d+)").exec(nocomment(sheetOf(page())));
    return m ? Number(m[1]) : 0;
  };
  assert.ok(z(".club-ask") > z(".club-view"),
    "the chooser (" + z(".club-ask") + ") is not above the viewer (" + z(".club-view") + ")");
});

/**
 * ⚠️ A KEPT COPY MUST BE REMOVABLE, or a kept video is in IndexedDB for ever with no way for the runner
 * to clear it — the story sweep cannot touch it, which is the whole point, and nothing else would.
 */
test("BLOCKER: kept copies are shown, openable and removable", () => {
  const html = nocomment(fn("commJournalKeptHtml"));
  // Absent until there is something in it: a heading with nothing under it reads as a failure.
  assert.match(html, /if \(!keep\.length\) return ""/, "the kept section shows empty");
  assert.match(html, /data-ckopen=/, "a kept copy cannot be opened");
  assert.match(html, /data-ckdrop=/, "a kept copy cannot be removed");
  assert.match(html, /clubLookAttrs\(/, "a kept copy loses the filter it was posted with");
  const drop = nocomment(fn("journalDropKept"));
  assert.match(drop, /if \(!clubMediaInUse\(k\)\) clubMediaDel\(k\)/,
    "removing a kept copy either leaks its bytes or deletes bytes something else still wants");
  const sv = drop.indexOf("saveJournals"), iu = drop.indexOf("clubMediaInUse");
  assert.ok(sv >= 0 && iu >= 0, "journalDropKept no longer both saves and checks");
  assert.ok(sv < iu,
    "the journal is saved after the in-use check, so the copy being removed still counts as a reason "
    + "to keep its own bytes");
  // ⚠️ THE OPEN TARGET IS THE WHOLE TILE AND THE REMOVE SITS ABOVE IT — an invisible full-tile zone over
  // a real control is the class this app has shipped twice.
  const sheet = nocomment(sheetOf(page()));
  const o = /\.cj-keep-o\s*\{[^}]*z-index:\s*(\d+)/.exec(sheet);
  const x = /\.cj-keep-x\s*\{[^}]*z-index:\s*(\d+)/.exec(sheet);
  assert.ok(o && x && Number(x[1]) > Number(o[1]),
    "the remove sits under the open target, so tapping the cross opens the story instead");
  // It opens in the app's one viewer, from the journal's own snapshots.
  assert.match(nocomment(fn("wire")), /clubOpenMedia\(keep, Number\(x\.dataset\.ckopen\)/,
    "a kept copy does not open in the viewer everything else uses");
});
