# Privacy (Children's Code) and the App Store answers

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> See also DPIA.md and APPSTORE.md.

## ✅ Y5 — THE CHILDREN'S CODE, AND FOUR THINGS IT FOUND WRONG FOR EVERYBODY (owner, 2026-09-26)

The fifth stage of the 12-17 programme. The ICO's Age Appropriate Design Code applies in full once an
app deliberately serves children (`YOUTH.md` section 6). The owner's two rulings: **the high-privacy
defaults cover under-18s AND anybody who has not told us their age**, and **there is no privacy contact
address yet** — the line offering one appears only once `PRIVACY_CONTACT` is set, and the ICO is offered
meanwhile. The fifteen standards were read word for word from the ICO's own pages, and standard 10's full
text checked separately ("Options which make a child's location visible to others should default back to
'off' at the end of each session"). Suite 1760 → **1781**; `test/childrens-code.test.ts` holds 21 guards;
**36 deliberate re-breaks, all 36 caught** (28 in the build, 8 in the heart-rate follow-up below; each applied to a pristine copy, rebuilt, and the tree restored byte-identical after). All web except four iPhone permission strings, which need an Xcode build.

⚠️ **THE AUTHORITATIVE LIST OF WHAT LEAVES THE PHONE IS `PRIVACY_FLOWS` IN `web/app.ts`**, and the full
assessment is **`DPIA.md`** at the repo root. Read both before adding anything that talks to a server.

### ⚠️⚠️ FOUR THINGS WERE WRONG FOR EVERYBODY, NOT ONLY FOR CHILDREN

1. ⚠️⚠️ **ASK ALFIE'S RED-FLAG SCREEN BEFORE SENDING MATCHED RAW TEXT — SO ON AN iPHONE IT MISSED THE
   WORST QUESTIONS.** `alfieLocalAnswer` lower-cased the question and straightened curly apostrophes before
   calling `alfieRedFlags`; the gate that decides whether a question may leave the phone passed it raw.
   The phrase lists are lower case with straight apostrophes, and an iPhone capitalises the first word and
   types curly apostrophes by default — so **"Chest pain when I run", "Suicidal thoughts" and "I don’t want
   to be here" matched nothing, were sent to the server, and never met the safety answer.** CLAUDE.md had
   recorded this screener as "runs first now, and a hit is answered locally and never sent" for months;
   that was true only for someone typing in lower case with straight apostrophes. `alfieNorm` is the one
   preparation and **`alfieRedFlags` applies it itself**, so no caller can hand it unprepared text.
2. ⚠️⚠️ **THE HISTORY SENT WITH A QUESTION LEAKED WHAT THE SCREENER HAD KEPT BACK.** `alfieRemote` sent
   `ALFIE_MSGS.slice(-8)` — the last eight messages whatever they were — so "I have chest pain", answered
   on the phone precisely so it never reached the network, went to the server as history with the NEXT
   question. Same for anything asked while offline. `alfieHistory()` sends only turns marked `sent`, and a
   turn is marked only once the server has answered it (a failed request is not marked: whether it arrived
   is unknowable, and "not sent" cannot leak later). It also stopped sending the current question twice.
3. ⚠️⚠️ **THE SAFETY PAGE SAID "TWO THINGS DO REACH THE INTERNET, AND ONLY THESE" WHILE SIX DID**, and Ask
   Alfie's own panel said "Nothing you type is sent anywhere" above a chat that sent every question. The
   page's header promised it would change "in the same commit" as the code; it didn't, five times. What
   leaves the phone is now one table, `PRIVACY_FLOWS`, read by the Safety page and Your data, and
   `test/childrens-code.test.ts` sweeps every web address in the app script AND the Swift and fails on one
   the table does not name (and on a table entry nothing reaches any more).
   ⚠️ **XML NAMESPACES ARE NOT REQUESTS** — `www.w3.org` in an SVG's `xmlns` and `createElementNS`, and the
   GPX file's `topografix.com`/`garmin.com` — and the sweep skips exactly those shapes. Pages the RUNNER
   opens (a calendar import, a run on Strava, the ICO) are `PRIVACY_LINK_HOSTS`, because the app sends them
   nothing.
4. ⚠️ **THE WEB VERSION'S OFFLINE COPY SERVED A STALE FORECAST.** The service worker is cache-first for
   every GET, including cross-origin ones, and the forecast URL is identical every time for somebody who
   runs from home — so the PWA showed the first forecast it fetched until the next deploy replaced the
   cache, while keeping a reply that carried a rough location. `docs/sw.js` (generated in `web/app.ts`) now
   passes Open-Meteo straight to the network. The native app has no service worker and was never affected.

### What shipped

- **`highPrivacyByDefault(age)`** in `src/domain/youth.ts` — ⚠️ **THE ONE PLACE WHERE ABSENT DOES NOT MEAN
  ADULT**, and the difference from `isYouthAge` is the design: an unknown age still trains as an adult
  (withholding training costs them something real) but starts on the private settings (a default costs an
  adult one tap). A test asserts the two disagree on "absent".
- **`privDefaultOn()`** is the ONE home of the rule in the app, and **a default is never a lock**: Ask
  Alfie's online answers (`alfieOnline`, stored as `online` in `interun_alfie_v1`), town names
  (`placeNamesOn`, `interun_placenames_v1`) and Apple Health (`healthSyncOn`) all read it only when the
  runner has not answered. An adult's app is byte-for-byte unchanged.
  ⚠️⚠️ **NO LONGER TRUE FOR ASK ALFIE, SINCE Y6 (2026-09-27).** App Review guideline 5.1.2(i) requires
  explicit permission before anything is shared with a third-party AI, so an ADULT who has not answered is
  now asked once, at their first question, where Y5 sent it silently. `alfieOnline()` answers true only
  for an explicit yes. See the Y6 chapter; town names and Apple Health are unchanged.
- **The gate on sending is `alfieMaySend(t)`** — online, a server, and no red flag — and **`alfieRemote`
  refuses on its own** as well, so a future caller that forgot the switch still sends nothing. ⚠️ The two
  are tested separately, because belt and braces hides the brace you are testing.
- **Switching online answers ON for a high-privacy runner shows a sheet** saying what is sent, what never
  is, and to ask a parent or an adult they trust (standard 4's "bite-sized" explanation at the point of
  use). ⚠️ **SWITCHING OFF NEVER ASKS**, and **"Keep them off" is the primary button** — standard 13 forbids
  nudging a child towards LESS privacy, not more. One handler, `alfieToggleOnline`, serves both switches.
- **"Clear this chat"** on the Alfie screen (confirmed, because it cannot be undone). ⚠️ Its box measured
  31px tall by `elementFromPoint`; the hit area grows to 45px via `::after`, not the box.
- **Locations rounded** to two decimals (about 1 km): the weather request was three (about 110 m), the
  town-name lookup four (about 11 m — a point on the runner's own route). `run-debrief.test.ts`'s guard
  that pinned four places was **tightened, not relaxed**, and now also forbids more than two.
- **A young runner's share card hides the route and the place every visit** (`SHAREPRIV_SESS`, never
  written to disk, emptied by `closeShareStudio`). An adult's per-run choice is still remembered.
- ⚠️⚠️ **AND IT LEAVES HEART RATE OFF UNLESS THEY ADD IT — found by the session that committed Y5, not by the
  one that built it.** A card's usual three numbers are the head of `shareMetricPool`, and on a run with heart
  rate and no recorded climb that head was **TIME, AVG PACE, AVG HR** — so a young runner sharing a run
  published their heart rate (special-category data) without choosing to, on the very card whose route and
  place had just been made private. Measured on a fixture: an adult's default `time/pace/avgHr`, a
  14-year-old's and an unknown age's `time/pace/cadence`. `health: true` on the two bpm entries of
  `RUN_METRIC_LADDER` is the one marker, `shareHealthMetric` reads it, and `shareMetricsChosen` leaves them
  out of the DEFAULT only: an explicit pick still wins (a default is never a lock), and `SCARD.metrics` is
  forgotten when the studio closes, so the next card starts private again. The Metrics sheet says *"Heart
  rate stays off unless you add it"* only when that is true. An adult's card is byte-identical (the export
  gate measures an adult and did not move).
  ⚠️ **A derived check fails on any bpm entry without the marker, and it is the only thing that can see a
  missing marker on `maxHr`** — fifth in the pool, so it never reaches the usual three. Re-broken: the
  default test passed, the derived check caught it.
  ⚠️ **The lesson: a privacy pass over a card has to cover every field the card can print, not the one the
  standard happens to name.** Standard 10 names location, so location was made private; no standard names
  heart rate by field, so it was not.
- **Your data** (standard 15) now opens with the table, the switches (with the runner's real default),
  backup (the download tool), **Delete everything**, and "Worried about your information?" with the ICO.
- **Delete everything** — ⚠️ read `deleteEverything` before changing it; every line is load-bearing:
  it removes the keys a BACKUP deliberately leaves out (the Strava device key, a Mapbox token); it tells
  Inte-Run's server to disconnect Strava **before** the key is gone, with `keepalive` so the request
  survives the reload; it deletes both IndexedDB stores (club media, cached route maps) — which needed
  `onversionchange` → `close()` added to both open functions, because every call opened a connection and
  none was ever closed; it purges other sites' replies from the PWA's cache but keeps the app's own files;
  and it **freezes `Storage.prototype.setItem` and `indexedDB.open`** until the reload, because the strength
  log flushes itself when the page is hidden — which a reload does — and would otherwise write the deleted
  data straight back. Driven end to end in a real browser: every app key gone, another site's key kept,
  both databases gone, the app back at the welcome screen.
- **The personal voice pack is never requested on the web** — its address carries a first name, and on
  GitHub Pages it can only ever 404.
- **Truthful wording**: the Safety page (and its header comment), Ask Alfie's panel, Apps & devices ("no
  Inte-Run server"), the Mapbox card ("never leaves the app" — it goes to Mapbox with every tile), and four
  iPhone permission strings (heart rate can reach Strava; the location string now names the weather; the
  photo string now names Inte-Club).
  ⚠️ **And the Health strings' first replacement said heart rate *only* leaves via Strava** — false the
  moment a runner shares a card showing it, or saves a backup. They now read *"unless you choose to send or
  share it, for example by sending a run to Strava"*, and the guard requires both Strava and sharing to be
  named — deriving the sharing half from the ladder's `share: true`, so it cannot go vacuous in silence.
- **`DPIA.md`** — the seven ICO steps, the data map, thirteen risks and the fifteen standards. ⚠️ The test
  fails if a flow in `PRIVACY_FLOWS` is missing from its data map, so the document cannot quietly go stale.

### Guards restated, none deleted (the guard-scoped-to-a-HOW pattern, again)

`alfie-proxy` (the gate is `alfieMaySend`; `alfieBase()` and the red-flag screen are asserted inside it,
plus the switch); `silent-defects` ×2 (the screen-before-send ordering reads `alfieMaySend`; the Safety
page must read `privacyFlowList()` and the table must name weather and maps); `route-map-cache` (the
privacy table names both tile hosts as a DISCLOSURE, so it is set aside before counting tile URLs — and
the guard fails if it cannot find the table to set aside); `run-debrief` (two decimals). **`share-model`
and `share-export-harness` now measure an ADULT on purpose** — sharePrivacyFor asks the privacy rule, and
an unknown age would hide every route. ⚠️ The harness ships the REAL rule into the browser page together
with everything it closes over (`ageAnswer`, `YOUTH_MAX_AGE`), because a function serialised without its
closure is a different function.

### Traps this stage paid for

- ⚠️ **THE Write TOOL TURNED `\uXXXX` ESCAPES IN MY PATCH ANCHORS INTO THE CHARACTERS THEMSELVES**, so an
  anchor copied from `web/app.ts` (which writes `’`, `›` as escapes in places) matched nothing.
  The patch helper now matches a non-ASCII character as itself OR as a one- or two-backslash escape.
- ⚠️ **A CONST STATEMENT'S EXTRACTOR MUST TRACK QUOTES**: `ALFIE_FLAGS` holds `"don't want to be here"`.
- ⚠️ **THE EXISTING Safety-page guard asserted `/!!alfieBase\(\)/` and "map tiles" as literals** — correct
  for the old design, and exactly the kind of assertion that let the page go stale: it checked that two
  things were named, not that everything was.

### Still open — the owner's, and none is fixable from here

- **A privacy contact address** (`PRIVACY_CONTACT`; the line appears the moment it is set).
- **`DPIA.md` sign-off**, ideally after a data-protection professional reads it (the lawful-basis
  position especially).
- **The privacy policy and terms (D1)** with a version a 12-year-old can read.
- ✅ **Y6 — the App Store answers** — done 2026-09-27; see the next chapter and `APPSTORE.md`.
- ⚠️ **"Prefer not to say" still gets the ADULT training plan**; only the privacy defaults treat them as
  a child (the known gap in `YOUTH.md`).
- ⚠️ **What Cloudflare, CARTO, Mapbox, Open-Meteo and OpenStreetMap keep is set by their own terms** and is
  deliberately not asserted anywhere in the app.
- ⚠️ **A run recorded on the Apple Watch is saved to Health by watchOS itself**, whatever the phone's
  switch says — stated on the Your data page.
- ⚠️ **Existing profiles with no stored age now start private.** Most older profiles carry the phantom
  `age: 38` the old `DEFAULT_PROFILE` wrote, so they read as adults; a runner who genuinely chose "Prefer
  not to say" will find Ask Alfie's online answers off until they switch them on.

## ✅ Y6 — THE APP STORE ANSWERS, AND FIVE THINGS THE APP WAS TELLING APPLE WRONGLY (owner, 2026-09-27)

The sixth stage of the 12-17 programme, and what the owner asked for at the start of it: *"All of this
needs to be written into any privacy policy and answers for the app store."* The answers are
**`APPSTORE.md`** at the repo root — age rating, App Privacy label, both privacy manifests, content
rights, review notes, and what App Review might question — with every Apple rule quoted from Apple's own
pages, read that day. **The owner types them into App Store Connect; nothing is submitted by itself.**
Suite 1781 → **1793**; `test/app-store.test.ts` holds 11 guards, and **28 deliberate re-breaks were all
caught** (one only after the break itself was made strong enough — below).

⚠️ **THE ANSWERS COULD NOT BE WRITTEN HONESTLY UNTIL THE APP WAS FIXED, AND THAT IS MOST OF THIS STAGE.**

1. ⚠️⚠️ **THE iPHONE'S PRIVACY MANIFEST SAID "NOTHING IS COLLECTED ... NO SERVER"**, and both halves had
   stopped being true when Ask Alfie's online answers and the Strava connection arrived. Apple reads that
   file out of the binary, so a label contradicting it contradicts the app. It now declares the same eight
   types as the label, entry for entry, and a guard parses both and fails if they disagree.
2. ⚠️⚠️ **THE WATCH APP HAD NO MANIFEST, AND APPLE CHECKS EVERY BINARY IN AN UPLOAD.** `WatchSettings`
   and `SessionStore` use UserDefaults, so the watch binary is the one that would have drawn ITMS-91053 —
   by email, after an upload that looked successful — while the phone's own file was complete.
   `ios/InteRunWatch/PrivacyInfo.xcprivacy` is new; the widget uses no required-reason API and needs none.
   ⚠️ **THE GUARD DERIVES BOTH LISTS**: the shipped targets out of `project.pbxproj`, and each target's
   API use out of its own Swift (comments stripped, so a sentence naming an API is not a use). A new
   target or a new API use fails until it is declared. ⚠️ The C `stat()` family is left out of the
   patterns on purpose — this codebase has SwiftUI helpers called `stat()`. Verified by an Xcode build
   (beta toolchain): both files are inside the built bundles.
3. ⚠️⚠️ **AN ADULT'S ASK ALFIE QUESTIONS WENT TO A THIRD-PARTY AI WITHOUT THEM EVER BEING ASKED.**
   Guideline 5.1.2(i), added November 2025: *"You must clearly disclose where personal data will be shared
   with third parties, including with third-party AI, and obtain explicit permission before doing so."*
   Y5 made "unanswered" mean off for under-18s and unknown ages and left adults on — the one default Apple
   now rules out.
   - `alfieOnline()` answers true **only for an explicit yes**, at every age.
   - `alfieNeedsAsk(t)` — an adult who has never answered, a server to send to, and a question allowed off
     the phone at all — opens the sheet at their FIRST question, leaves the question in the box, and
     answers it straight after, online or on the phone, whichever they chose. ⚠️ The box is emptied only if
     it still holds that question, so anything typed meanwhile survives.
   - ⚠️ **NEVER ASKED OF A HIGH-PRIVACY RUNNER.** Offering a child the less private choice unprompted is
     the nudge the Children's Code's standard 13 forbids; they can still switch it on themselves.
   - ⚠️ **A RED-FLAG QUESTION NEVER TRIGGERS THE ASK** — it is answered on the phone whatever the switch
     says, so asking permission for it would be asking for nothing.
   - ⚠️ **TURNING THE SWITCH ON ALWAYS GOES THROUGH THE SHEET, AT EVERY AGE** (`alfieToggleOnline`, one
     handler for both switches). Before Y6 an adult's switch was one silent tap. Turning it off never asks.
   - An adult's sheet leads with "Allow online answers" and says it can be changed; a young runner's still
     leads with "Keep them off" and says to ask a parent or an adult they trust.
4. ⚠️ **"AN AI" SAYS WHAT, NOT WHERE, AND 5.1.2(i) ASKS WHERE.** Every sentence about online answers —
   the sheet (`ALFIE_ONLINE_EXPLAIN`), Alfie's own screen, the Safety page and `PRIVACY_FLOWS` — names
   Cloudflare. ⚠️ **THE NAME IS DERIVED, NOT TRUSTED**: the guard reads `BRAIN` in
   `alfie-proxy/src/worker.ts`, so switching the server to Claude fails the suite until every sentence
   changes with it — re-broken exactly that way.
5. ⚠️ **THE LOCATION PERMISSION MESSAGE NAMED THE WEATHER AND NOTHING ELSE**, while a rough location also
   goes to the map provider and to OpenStreetMap for a run's town. It names all three; the guard checks it
   against every `PRIVACY_FLOWS` entry that mentions a location, so a fourth flow cannot join silently.
   Native — it reaches Apple only in a build.

Two more, found on the way:
- ⚠️⚠️ **OPEN-METEO'S LICENCE (CC BY 4.0) REQUIRES A CREDIT, AND THE APP HAD NONE:** *"You must include a
  link next to any location Open-Meteo data are displayed."* Without it the content-rights answer ("do you
  have the rights to this third-party content?") was false. `wxCreditHtml()` is one builder carrying their
  own suggested words, and appears under Today's tile, in the weather sheet's live line, in the heat block
  and in the heat sheet. ⚠️ **Today's credit shows when the forecast is live OR a heat adaptation is on
  screen**, because the heat chip is their data too; a sample preset carries none — it is the app's own
  example. ⚠️ **Their free tier is for apps "that do not have subscriptions or advertising"** — true today,
  and the day Inte-Run charges, it needs a paid plan. The link's hit area grows via `::after`, not its box,
  and `open-meteo.com` joined `PRIVACY_LINK_HOSTS` (the runner opens it; the app sends it nothing).
- ⚠️ **THE STRAVA SERVER KEPT THE ATHLETE NUMBER AND NOTHING EVER READ IT** — standard 8, data
  minimisation. New connections no longer store it, and an existing record loses it the next time its
  token is refreshed. **Needs `wrangler deploy`**; the label does not depend on it, because the tokens
  identify the account anyway.

### The label: the full reading, deliberately

Apple's "collect" is transmitting data off the device in a way that lets you or your partners access it
longer than it takes to serve the request. Read narrowly, only what Inte-Run's own server keeps must be
declared. **Read fully — which is what `APPSTORE.md` recommends and what the manifest carries —
everything that leaves the phone for somebody who may keep it is declared too**: Strava and Cloudflare do
keep what we send them, 5.1.2(i) singles out third-party AI, and over-declaring is never a rejection
reason while under-declaring can be. Eight types, App Functionality only, none tracking: **Precise
Location, Health, Fitness, Name, User ID and Device ID linked** (Strava, and the hashed install keys);
**Coarse Location and Other User Content not linked** (weather/maps/town, and Alfie's questions).
⚠️ Photos, check-in answers, diagnostics and search are deliberately not declared, and `APPSTORE.md` 2.3
says why for each.

### The age rating, and the decision that is the owner's

⚠️⚠️ **THERE IS NO 12+ RATING ANY MORE.** Apple replaced 12+ and 17+ with 13+, 16+ and 18+ in 2025, and
the youth programme starts at 12 — so a 13+ rating locks a 12-year-old out wherever Screen Time age
limits are on. ⚠️ **AND APPLE'S RULE IS THAT TERMS SETTING A MINIMUM AGE ABOVE THE CALCULATED RATING
FORCE AN OVERRIDE UP TO IT**, so D1's terms saying "you must be 12 or over" would force 13+. The
recommendation: accept the calculated rating, do not override it, and have D1 describe the app as
*designed for runners aged 12 and over* rather than making 12 a contractual minimum. **The owner's call.**
- ⚠️ **ALCOHOL IS "INFREQUENT", NOT NONE, AND IT IS THE EASY ONE TO GET WRONG.** The injury guide, the
  fuelling guide ("Alcohol is not a recovery drink") and the race-morning caffeine warning all reference
  licit substances, and Apple counts references. They advise against — and they are clinically reviewed
  wording that must never be edited to change an answer. The guard reads the app's own copy: while it
  mentions alcohol, the answer cannot be None.
- ⚠️ **MADE FOR KIDS: NO, and the choice cannot be undone once approved.** Guideline 2.3.8 also means the
  listing must not say "for kids" or "for children".
- The guard holds every question on Apple's questionnaire, and fails if one goes unanswered or if
  section 1.3 stops naming the programme's real minimum age (`YOUTH_MIN_AGE`).

### What App Review might question — recorded, not fixed

- ⚠️ **Guideline 5.1.1(v): Strava's tokens are held on our server,** and Strava calls itself a social
  network. The position (the token exchange needs our client secret, which must never ship; the tokens
  never leave the server; `activity:write` only; Disconnect revokes at Strava) and the fallback if it is
  rejected (hand the tokens to the app once and let the server only refresh them) are in `APPSTORE.md`
  6.1. Real work, and not built unless Apple asks.
- **Downloaded web code** (2.5.2, DPLA 3.3.1(B)) is disclosed in the review notes on purpose; keeping that
  paragraph is the owner's call.
- **OpenStreetMap / Nominatim** attribution and usage policy: worth confirming before a public launch.
- **Apple's Declared Age Range API** (iOS 26) would close the "Prefer not to say" gap. Native; not built.

### Traps this stage paid for

- ⚠️ **APPLE'S DOCUMENTATION PAGES ARE RENDERED BY JAVASCRIPT, SO WebFetch READS NOTHING.** Fetch the
  DocC JSON with curl (sandbox off):
  `https://developer.apple.com/tutorials/data/documentation/bundleresources/<path>.json`. In the reason
  codes, each description comes BEFORE its `"name":"CA92.1"` — a parser that takes the next description
  reads the wrong code's text.
- ⚠️ **ONE OF MY OWN GUARDS PASSED FOR THE WRONG REASON.** "No server means no ask" blanked the stored
  proxy — which falls back to the built-in `ALFIE_SERVER`, so the server was there the whole time. The
  harness gained a `noServer` option that replaces the constant itself.
- ⚠️ **ONE RE-BREAK WAS TOO GENTLE AND LOOKED LIKE AN ESCAPE.** Removing "draw maps of your runs" left
  "a map service" in the same message, so the guard rightly passed. Redone removing both, and caught —
  a re-break has to cross the boundary the guard tests, which this file already records once for A2.
- ⚠️ **The re-break harness normalises the build stamp** (`const BUILD = "…"` changes every minute), or
  every "did the break reach the built page" comparison reads as changed.
- ⚠️ The existing address sweep failed on the new credit link — correctly: it is a page the runner opens,
  so it joined `PRIVACY_LINK_HOSTS` rather than the flow table.

### Still the owner's

The privacy policy and terms (**D1 — now the one thing blocking a submission**) · a support URL leading
to a real email address (the same address can be `PRIVACY_CONTACT`) · the rating decision · an Xcode
build and upload (the manifests and the location message reach Apple only in a build) · `wrangler deploy`
for the athlete-number removal · `DPIA.md` sign-off · the clinical review of every threshold.

## ✅ D1 — THE PRIVACY POLICY, THE TERMS AND A VERSION A 12-YEAR-OLD CAN READ (owner, 2026-09-28)

The owner's brief: *"the privacy policy and terms for Inte-Run, plus a version a 12-year-old can read ...
Everything the app sends off the phone is listed in PRIVACY_FLOWS in web/app.ts, so the policy must match
that list exactly."* Contact for privacy AND support: **adam.palmer86@gmail.com** (now `PRIVACY_CONTACT`).
Four hand-written pages under `docs/`, served by Pages, **left out of the iPhone bundle on purpose** so a
runner always reads the current version: `privacy/`, `terms/`, `simple/` (the version for a 12-year-old,
which covers the rules too) and `support/` (Apple's Support URL), sharing `docs/legal.css`. Suite 1793 →
**1813**; `test/privacy-copy.test.ts` (12) and `test/own-consent-age.test.ts` (4) are new; **30 deliberate
re-breaks, all 30 caught**, each on a copy restored byte-identical (the harness asserts the hash).

### The owner's rulings, one question at a time

1. **Who is responsible:** "Adam Palmer, a one-person developer in England" — the controller. So the terms
   are under the law of England and Wales, with the usual right of a consumer in Scotland or Northern
   Ireland to use their own courts.
2. **Age wording: "designed for runners aged 12 and up", and NO minimum age** (APPSTORE.md 1.3's
   recommendation). A minimum above the calculated rating forces Apple's rating up, and there is no 12+
   rating, so "you must be 12" would lock 12-year-olds out. The test fails on a minimum-age sentence in the
   terms or the simple version. **Accept the calculated rating; do not override it.**
3. **Under 13: Ask Alfie's online answers and town names are OFF, like Strava** — a lock, not a default.
   See the first finding.
4. **The pain promise: fix the words**, not widen the screen. See the second finding.
5. **Deploy the Worker now** — done (version `670df6ba`, 2026-09-28 16:09 UTC; the probe answered
   `brain: cloudflare`, `alfie: ready`, `burstGuard: bound`, `budgetStore: bound`).

### ⚠️⚠️ WHAT WRITING IT HONESTLY FOUND

1. ⚠️⚠️ **UK GDPR ARTICLE 8 WAS MISSING FROM THE DPIA, AND A 12-YEAR-OLD COULD CONSENT ALONE.** Where
   consent is the basis for an online service offered to a child, the child must be at least 13 (Data
   Protection Act 2018, section 9); under 13 a parent must give or authorise it. The DPIA's own lawful
   basis for the optional flows was "the runner's own choice" — consent — and a 12-year-old could switch on
   Ask Alfie's online answers and town names by themselves. `ownConsentAllowedAt` / `OWN_CONSENT_MIN_AGE`
   in `src/domain/youth.ts`; `ownConsentOk()` in the app, read by **the getters themselves**
   (`alfieOnline`, `placeNamesOn`) so a yes stored before the age was given sends nothing either;
   `alfieToggleOnline` never opens the sheet under 13; Your data and Alfie's own row show "13 and over"
   where the switches were (a switch that cannot turn on is the inert control this app refuses).
   ⚠️ **Absent means allowed, like `stravaAllowedAt`** — the recorded hole is "Prefer not to say".
   ⚠️ **Town names start ON for adults, so consent cannot be their basis for adults** (consent must be
   opted into): the policy states legitimate interests for them. Flagged for the legal read.
2. ⚠️⚠️ **"ANYTHING ABOUT PAIN OR FEELING UNWELL STAYS ON YOUR PHONE" WAS FALSE — IN FIVE PLACES AND IN THE
   APP STORE REVIEW NOTES.** `alfieRedFlags` knows a fixed list of warning signs (`ALFIE_FLAGS`: chest pain,
   fainting, palpitations, breathlessness, heat illness, neurological signs, bone pain, worsening pain,
   eating disorders, lost periods, self-harm and low mood). "My knee hurts" is not on it, and nor is
   Alfie's own suggestion chip "Should I run if I'm sore?" — with online answers on, both are sent. Now:
   *"serious warning signs, like chest pain or fainting"*, in `ALFIE_ONLINE_EXPLAIN`, `alfieLimits`,
   `alfieOnlineRow`, `safetyView`, `PRIVACY_FLOWS` and APPSTORE.md section 5. The test forbids the old
   phrase in the app and the pages, and checks the two examples really are caught as a phone types them.
3. ⚠️ **STRAVA CONNECTIONS WERE KEPT FOR EVER — AND ONE LEFT BY A DELETED APP COULD NOT EVEN BE FOUND.**
   The `tok:` record had no expiry, and it is filed under the hash of a device key only the phone held, so
   an erasure request by email could not be honoured. `CONNECTION_TTL_SECONDS` (a year) on **every** write
   of the record: at connecting, and at each token refresh (the first use after the six-hour access token
   runs out). ⚠️ Records written before the deploy carry no expiry until their next refresh.
4. ⚠️ **TWO "INTE-RUN HAS NO SERVER" SENTENCES SURVIVED Y5**: the backup card in `dataView` ("nothing is
   uploaded anywhere, because Inte-Run has no server") and "Your why" in `whyView`. Both corrected; the
   why answers also go to the watch, and now say so. Also `commPeopleHtml` ("a server Inte-Run does not
   have" → accounts) and the watch mirror card ("stays on your wrist" — it comes to the phone at the end).
5. ⚠️ **DELETE EVERYTHING LEAVES THE RUNNER'S FIRST NAME ON THE WATCH.** The reload re-syncs the watch with
   an empty profile, and `SessionStore.apply` clears why answers, max HR and the sessions when they are
   absent — but writes the name only when present, so the old one stays. The card and the policy now say
   so. **For another day:** clear it when absent, as the same function's own comment says it should (a
   watch build). The phone also keeps `interun_watch_last_payload` (replaced by that same sync),
   `interun_pending_watch_runs` (normally empty) and `InteRunHealthWritten` (run ids only).
6. ⚠️ **AN EMAIL LINK IN THE iPHONE APP MAY HAVE DONE NOTHING.** `WebHost` opens a tapped link only if
   `canOpenURL` says yes, and that answers no for any scheme missing from `LSApplicationQueriesSchemes` —
   which listed `sms` but not `mailto`. Added (needs a build); the address is also printed as text.
7. **The DPIA's inventory was short**: the profile photo, the "why" answers (which can name a person),
   "did anything hurt", a measured max HR, and the watch's copy of the first name, max HR and why answers.
   All in the DPIA and the policy now. Confirmed NOT stored: menstrual status and every check-in answer.
8. Also corrected: the camera permission string (Take Photo also serves Inte-Club and the profile
   picture — needs a build); the entitlements comment ("the phone reads and writes no health data" — it
   writes workouts, routes and heart rate); `alfie-proxy/README.md`, whose Alfie half still described a
   Claude proxy with a pasted address (`claude-opus-4-8`, "the Worker calls Claude"); two stale comments
   in `web/app.ts` and one in `worker.ts`.

### What the test holds (derived, never typed)

- **The flows:** `data-flow` sections in `privacy/` and `simple/` are exactly `PRIVACY_FLOWS`, in order.
- **The addresses:** each flow's section names its hosts as `<span class="host">`; the Strava section names
  what the Worker reaches (`www.strava.com`, swept from `alfie-proxy/src/`); the policy names no other.
- **The AI:** the company from `BRAIN`, the model from `CF_MODEL` (`llama-3.3` → "Llama 3.3").
- **The ages:** every `data-age` equals the engine constant; `YOUTH_MAX_AGE + 1 === 18` and
  `YOUTH_MIN_AGE === OWN_CONSENT_MIN_AGE - 1` guard the words used unmarked ("under 18", "if you are 12");
  the age picker's lowest option equals `YOUTH_MIN_AGE`.
- **The numbers:** runs kept (`saveRuns`' slice, every mention), Alfie messages kept, history sent (the
  app's slice AND the Worker's), the year, the ten-minute link, the counters' lifetimes, two decimals.
- **The address, the date, the links:** every `mailto:` equals `PRIVACY_CONTACT`; each page's
  `data-updated` date equals `LEGAL_UPDATED` in words and machine date; each `LEGAL_PAGES` path exists and
  opens outside the app; the Support row, the Safety page and Your data all carry them.
- **The bundle and the offline copy:** every page is excluded in `make-project.py` AND in the regenerated
  `project.pbxproj`; ⚠️ **every `docs/sw.js` ASSET must exist, because `c.addAll()` fails whole on one
  missing file and the web version's offline copy then never installs** — nothing guarded that before.
- **The terms:** `NOT_A_DIAGNOSIS` word for word; no minimum age; the parent or carer clause.
- **The reading level:** Flesch-Kincaid grade of `simple/` ≤ 6 and at least 1.5 below the full policy.
  Measured: **simple 2.6** (reading ease 90), privacy 5.1, terms 5.8. Headings, list items and table cells
  end a sentence, as they do for a reader — which is also why the full policy measures lower than its prose.
- **The promise register (`CLAIMS`):** every runtime string in the app that promises something stays on
  the phone, as `[enclosing function, exact sentence]`. 28 today, each read against the code and true. A
  new promise fails until registered; a registered one that disappears fails too. Error messages
  (`new Error("…")`) are skipped — no runner reads them.

### Traps this stage paid for

- ⚠️ **`.lg-list` WAS ALREADY THE LOGBOOK'S CLASS.** Borrowing the short prefix indented the new rows by
  the logbook's padding; renamed `legal-*`. Grep a class before inventing one.
- ⚠️ **THE WEB VERSION'S SERVICE WORKER CACHES `legal.css`**, cache-first like every asset, and the
  browser's HTTP cache held it too: two contrast measurements read the OLD colours. Unregister the worker,
  clear the caches, then `fetch(url, {cache: "reload"})` before believing a stylesheet change.
- ⚠️ **A HAND-MADE `rc_profile_v1` WAS DISCARDED**: the page booted on `DEFAULT_PROFILE` and the age read as
  absent, so the first "under 13" screenshot showed the switches. Set `profile.age` on the live page.
- ⚠️ **`python3 ios/make-project.py` REWRITES THE WHOLE `project.pbxproj`** (Xcode had reflowed the
  committed one, and `CURRENT_PROJECT_VERSION` is the commit count: 495 → 558). Same 57 objects and team;
  compare `sort`ed copies before believing a 200-line diff is only formatting.
- Contrast measured on the rendered pages: `--ink-faint` 4.37 and `--accent` 4.49 in light mode, both
  under 4.5; darkened. **Lowest now 5.61 light, 6.44 dark.** No page scrolls sideways at 375 px.
- ⚠️ `hostsIn` in this test and in `childrens-code.test.ts` are separate sweeps with different jobs: that
  one proves the TABLE names every address the app reaches; this one proves the PAGE names the table.

### Still the owner's

- **A data-protection read of the four pages and `DPIA.md` before external testers** (PLAN.md D1.E) — the
  lawful-basis table (section 8 of the policy), town names on legitimate interests, the international
  transfers section, and whether an ICO data protection fee is due.
- **The DPIA sign-off.**
- **Paste the URLs into App Store Connect**: Privacy Policy `…/Inte-Run/privacy/`, Support `…/support/`.
- **An Xcode build** for the camera wording, the `mailto` scheme and everything Y6 left waiting.
- For another day: the watch keeping the first name; "Prefer not to say" still passing both age gates.
