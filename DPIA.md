# Data Protection Impact Assessment — Inte-Run

**Status: DRAFT, for the owner's sign-off (Step 7). Not legal advice.** Written 26 September 2026 as
stage Y5 of the 12–17 programme (`YOUTH.md`). Every statement about what the app does was checked
against the code on that date; where something could not be verified, it says so.

**Recommendation before any tester under 18 is invited:** have a data-protection professional review
this document, the lawful-basis position in Step 4 in particular, and the privacy policy and terms.
⚠️ **Updated 28 September 2026 (stage D1):** the privacy policy, terms, a simple version a 12-year-old
can read and a support page are written and published (`docs/privacy/`, `docs/terms/`, `docs/simple/`,
`docs/support/`); there is a contact address; and D1 found and fixed the things recorded below as D1.

---

## Step 1 — Why a DPIA is needed

The ICO's Age Appropriate Design Code (the Children's Code) applies to online services "likely to be
accessed by children". Inte-Run now deliberately serves runners aged 12–17 (stages Y1–Y4 built a
tailored programme for them), so it applies in full. Its standard 2 is verbatim: *"Undertake a DPIA to
assess and mitigate risks to the rights and freedoms of children who are likely to access your service,
which arise from your data processing."*

The processing also includes things that call for a DPIA on their own: precise location during runs,
health-related data (heart rate; symptom and fuelling check-ins), a child's free text sent to an AI
service, and photos and videos.

## Step 2 — The processing

### 2.1 Nature: what is kept, and where

**There is no account, no analytics, no advertising, no crash-reporting service and no tracking of any
kind.** Almost everything is kept on the runner's own phone:

| Store | What it holds |
|---|---|
| The app's local storage (web view `localStorage`) | profile (name, a profile photo, age if given, sex if given, goal, race and trial times, whether they are returning from injury, a measured maximum heart rate), their "why" answers (which can name a person who inspires them), the plan, every logged run (route, splits, heart rate, how it felt, whether anything hurt, notes), strength log, Ask Alfie chat (the last 30 messages), Inte-Club post details, settings, and two random install codes (the Strava device key; Ask Alfie's question counter) |
| The app's IndexedDB | Inte-Club photos and videos; a cache of drawn run maps |
| Apple Health (only if the runner allows it) | finished runs and heart rate |
| The Apple Watch and the phone's native layer | the coming sessions, the runner's first name, maximum heart rate and "why" answers, and coach choices, so the watch can work alone; runs recorded on the watch until the phone takes them (corrected at D1: this row used to say only the plan) |

### 2.2 Nature: what leaves the phone — the data map

This table is the same table the app shows the runner (`PRIVACY_FLOWS` in `web/app.ts`), and
`test/childrens-code.test.ts` fails if the app can reach a web address that the table does not name,
or if a flow below goes missing from this document.

| Flow | What is sent | To whom | When | High-privacy default* |
|---|---|---|---|---|
| `weather` | location rounded to 2 decimal places (about 1 km) | Open-Meteo | when the app checks the forecast for a run | on (disclosed; needed for heat safety) |
| `maps` | which map squares to draw around a run or the runner's current position | CARTO, or Mapbox where configured | when a map is shown | on (disclosed; the map is the run they opened) |
| `place` | the middle of a run, rounded to about 1 km | OpenStreetMap (Nominatim) | once per run, to name the town | **off**; not available under 13 (D1) |
| `alfie` | the question typed, a short plan summary (goal, week, phase, paces, today's session — no name, age or location), and earlier turns that already reached the server | Inte-Run's own server (a Cloudflare Worker), which asks Cloudflare's AI | only after the runner says yes — since Y6, at every age; never under 13 (D1) | **off** (and off until asked for adults too, Y6) |
| `strava` | runs and strength sessions the runner chooses to send; no heart rate under 16. Inte-Run's server keeps the connection itself (the account's tokens and first name) while connected, and deletes a connection unused for a year (D1); since Y6 it no longer keeps the Strava athlete number, which nothing used (deployed 28 Sept 2026) | Strava, through Inte-Run's server | only after the runner connects Strava (13+) | not connected |
| `update` | nothing about the runner — a request for the latest version of the app | GitHub | when the iPhone app opens | on (carries no personal data) |

\* The high-privacy defaults apply to under-18s **and to anybody who has not given an age** (the owner's
ruling, 26 September 2026). A default is never a lock: every switch can be changed by the runner.

Also: Apple Health (on the device, off by default for the high-privacy runners), and pages the runner
opens themselves in a browser (a calendar import page, a run on Strava, the ICO).

### 2.3 Scope

- **People:** one runner per phone, adult or aged 12–17. Age is self-declared and optional.
- **Special category data (health):** heart rate; symptom, injury and fuelling check-ins. **The
  check-ins keep nothing** — answers are read as they are ticked and are gone when the screen closes.
- **Retention:** on the phone until the runner deletes it (Your data › Delete everything, or deleting
  the app). Runs are capped at 50 full records; a small summary row per run is kept for totals.
  Inte-Run's server keeps no copy of Ask Alfie questions; it keeps a count per device per hour and per
  day to limit spending (deleted within about an hour and a day), and a Strava token per connected device
  until the runner disconnects, or a year after it was last used (D1). ⚠️ Before D1 a connection was kept
  for ever, and one left behind by a deleted app could not even be found on request: it is filed under
  the hash of a key only the phone held.

### 2.4 Context

- Users include children from 12. There are **no parental controls** and no accounts, so no parent can
  see or change a child's settings from another device.
- Age is self-declared, so the design assumes it can be wrong: an unknown age gets the privacy defaults.
- The app is used during exercise, often outdoors and alone, so safety features (red-flag screening,
  heat advice) are part of the child's best interests, not only extras.

### 2.5 Purposes

To build and adapt a training plan, record runs and strength sessions, give coaching and safety advice,
and — only when the runner chooses — send activities to Strava or Apple Health, answer free questions
through an AI, and post to the runner's own Inte-Club page (which stays on the phone).

## Step 3 — Consultation

Not yet done, and it should be before children are invited:
- a small, supervised test with young runners and their parents (a running club is the natural place);
- review of the youth training thresholds by a sports-medicine professional (already flagged in `YOUTH.md`);
- review of this DPIA and the privacy wording by a data-protection professional.

## Step 4 — Necessity and proportionality

- **Lawful basis — needs a professional's view.** Most processing happens only on the runner's own
  phone and never reaches the developer; whether and how the developer is a controller for it is worth
  advice. For the flows that leave the phone, the proposed position is: providing the service the runner
  asks for (weather, maps, updates); the runner's own choice, made with a bite-sized explanation, for
  optional flows (Ask Alfie online, town names, Strava, Apple Health). Health data is not sent anywhere
  by default.
- ⚠️ **D1 (28 Sept 2026) refined that position, and it is what the published policy states** (its
  section 8): contract for running the app, the weather and the maps; consent for Ask Alfie's online
  answers (explicit consent for any health detail in a question), Strava (explicit consent for heart
  rate) and Apple Health; legitimate interests for town names, the question counter, the update check and
  answering emails. **Town names cannot rest on consent for adults, because they start ON for adults** —
  consent has to be opted into. For under-18s they start off.
- ⚠️ **UK GDPR Article 8 was missing here, and it mattered.** Where consent is the basis for an online
  service offered to a child, the child must be at least 13 (Data Protection Act 2018, section 9); under
  13, a parent must give or authorise it. A 12-year-old could switch on Ask Alfie's online answers and
  town names by themselves. **The owner's ruling (28 Sept 2026): both stay off until 13, like Strava**
  (`ownConsentAllowedAt` in `src/domain/youth.ts`, tested in `test/own-consent-age.test.ts`). Recorded
  hole, the same as Strava's: a 12-year-old who chooses "Prefer not to say".
- **Data minimisation (standard 8)** — measures in Step 6: rounded locations, optional flows off by
  default, no identifiers in Ask Alfie's plan summary, and nothing a runner kept off the network (a
  symptom, or anything asked while offline) is ever sent later as history.
- **No processor receives more than its job needs**, and no data is sold, shared for advertising, or
  combined across sources.

## Step 5 — Risks

| # | Risk to the child | Likelihood | Severity | Overall (after Step 6) |
|---|---|---|---|---|
| R1 | A child's free text reaches an AI service | possible | medium | **low** — off by default; explained before it is turned on; questions naming a serious warning sign never sent; no name or location in what is sent; not available under 13 (D1). ⚠️ D1 corrected the app's own promise: it said "anything about pain or feeling unwell" stays on the phone, and only the listed warning signs do. Cloudflare says it does not use what is sent to its AI service to train models (its Workers AI data-usage page, read 28 Sept 2026). |
| R2 | Location disclosed to third parties | likely | low | **low** — rounded to about 1 km; town names off by default; map tiles cached so the same area is fetched once |
| R3 | A child's location or heart rate made visible to others on a share card | possible | high | **low** — route and place start hidden every time the share studio opens, and a choice to show them is forgotten when it closes (standard 10); heart rate is never one of the card's usual numbers for a high-privacy runner and appears only if they add it, which is also forgotten on closing (standard 7); start and finish are trimmed for everybody |
| R4 | Heart rate sent to Strava against Strava's rules | — | medium | **low** — no Strava under 13; no heart rate under 16 (Y4) |
| R5 | Health data written where other apps or people can read it | possible | medium | **low** — Apple Health off by default for high-privacy runners. **Residual:** a run recorded on the Apple Watch is saved to Health by watchOS itself, as with any watch workout app |
| R6 | A symptom disclosure leaves the phone | possible | high | **low** — check-ins keep nothing (including the Wellbeing check-in added at D3c, which also gives UK crisis lines); Ask Alfie answers red flags on the phone, and since D3c recognises the eight limb warning signs too; the screener was fixed in Y5 to catch capitalised text and curly apostrophes, which it had been missing |
| R7 | Photos or videos of a child exposed | unlikely | high | **low** — Inte-Club has no server and no feed; media never leaves the phone unless the runner shares it themselves |
| R8 | Age misstated | likely | medium | **medium** — "Prefer not to say" gets the privacy defaults but still the adult training plan (a known gap, `YOUTH.md`) |
| R9 | A shared family phone | possible | medium | **low-medium** — anyone holding the phone can read it; Delete everything is provided |
| R10 | The web version is served by GitHub Pages, which sees ordinary web traffic | likely | low | **low** — no personal data in requests; the personal voice-pack request, which carried a first name, is no longer made on the web |
| R11 | No way to contact the developer about data | — | medium | **low** (D1) — adam.palmer86@gmail.com is in the app, the policy, the terms, the simple version and the support page, and a test keeps them one address; the ICO route is still offered |
| R12 | No formal child-readable privacy policy or terms yet | — | medium | **low** (D1) — published: the full policy, the terms, and a simple version measured at a Flesch-Kincaid grade of 2.6 (the suite fails above 6) |
| R13 | Profiling | — | low | **low** — the plan adapts to the runner's answers, which is the service they chose; nothing is used for marketing or shared |
| R14 | A Strava connection outlives the app it belonged to | likely | medium | **low** (D1) — an unused connection deletes itself after a year; Disconnect and Delete everything remove it at once |
| R15 | A child under 13 gives their own consent to an online extra | possible | medium | **low** (D1) — Ask Alfie's online answers, town names and Strava are not available under 13; residual: "Prefer not to say" |
| R16 | Delete everything leaves a copy on the watch | possible | low | **low** — the watch is refreshed at the next sync but keeps the runner's first name until the app is deleted; stated in the app and the policy (a watch-side fix is for another day) |

## Step 6 — Measures (what stage Y5 changed)

1. **High privacy by default** (standard 7) for under-18s and unknown ages: Ask Alfie online answers,
   town names and Apple Health all start off. One rule decides it (`highPrivacyByDefault` in
   `src/domain/youth.ts`); the runner's own answer always wins.
2. **Bite-sized explanation at the point of use** (standard 4): turning Ask Alfie's online answers on
   shows what leaves the phone and says to ask a parent or an adult they trust; turning it off never asks
   (standard 13). **Since Y6 the same explanation comes before anybody's first online answer, adults
   included**, and names the AI company (Cloudflare): Apple's guideline 5.1.2(i) requires "explicit
   permission" before personal data goes to a third-party AI. An adult is asked once, at their first
   question; a young or unknown-age runner is never asked unprompted.
3. **Ask Alfie's history** sends only turns that already reached the server.
4. **The red-flag screener** normalises text itself, so a phone's capitals and curly apostrophes no
   longer slip past it.
5. **Rounded locations** for weather (was about 110 m) and town names (was about 11 m).
6. **Share cards** keep a young runner's route and place hidden every session (standard 10), and leave
   their heart rate off unless they add it (standard 7).
7. **Your data page** (standard 15): what goes online and to whom, the switches, backup (download), and
   **Delete everything** — which also removes the Strava key and Mapbox token a backup leaves out, tells
   Inte-Run's server to disconnect Strava, and deletes the stored photos, videos and map pictures.
8. **Truthful wording**: the Safety page, Ask Alfie's panel, Apps & devices and the iPhone permission
   texts no longer claim that nothing leaves the phone. What leaves it is one table, guarded by a test.
9. **The web version's offline copy** no longer serves a stale forecast or keeps location-bearing
   weather replies.
10. **App Store answers (Y6)**: the age rating, the App Privacy label and the privacy manifests inside the
   app now tell the same story as this document (`APPSTORE.md`, guarded by `test/app-store.test.ts`). The
   location permission message names the weather, the maps and the town lookup, and the weather credit
   Open-Meteo's licence asks for is shown wherever its forecast is.
11. **D1 (28 Sept 2026): the published policy, terms, simple version and support page**, held to the
   code by `test/privacy-copy.test.ts` (the flows, their addresses, the AI company and model, the ages,
   the time limits, the contact address, the date, the reading level, and every in-app sentence that
   promises something stays on the phone). Also: the under-13 lock (Article 8, above), the pain promise
   corrected in five places and in the App Store notes, two "Inte-Run has no server" sentences
   corrected, a year's limit on unused Strava connections, and the watch's copy now described truly.

### The fifteen standards

| # | Standard | Where Inte-Run stands |
|---|---|---|
| 1 | Best interests of the child | youth training limits (Y1–Y3), safety screening, the measures above |
| 2 | DPIA | this document — **awaiting sign-off** |
| 3 | Age appropriate application | self-declared age; unknown ages get the privacy defaults |
| 4 | Transparency | Your data page and Ask Alfie explanation in plain language; the formal policy, terms and a simple version for 12-year-olds are published (D1) |
| 5 | Detrimental use of data | no advertising, no engagement tricks tied to data; training limits cap load for 12–17s |
| 6 | Policies and community standards | Inte-Club has no community features to police; the terms (published at D1) say what may be shared |
| 7 | Default settings | high privacy by default (Step 6.1) |
| 8 | Data minimisation | Step 6.3–6.5; the server stopped keeping the unused Strava athlete number (Y6) |
| 9 | Data sharing | nothing shared by default beyond weather, maps and the update check; Strava and Health by the runner's choice |
| 10 | Geolocation | location only while recording or when asked; an obvious sign while tracking (iOS indicator and the app's live pill); share-card location reverts each session |
| 11 | Parental controls | none provided |
| 12 | Profiling | only the plan's own adaptation, which is the service |
| 13 | Nudge techniques | turning a setting off is one tap; the private option is the primary button |
| 14 | Connected toys and devices | the Apple Watch app keeps the week's plan and records workouts; nothing leaves it except to the phone and, by watchOS, to Health |
| 15 | Online tools | Your data: see, switch, download, delete; the ICO route; a contact address (D1) |

## Step 7 — Sign-off and outcomes

| Item | Name / date | Notes |
|---|---|---|
| Measures approved by | | |
| Residual risks approved by | | R8 is open (R11 and R12 closed at D1) |
| Professional advice | | recommended before inviting under-18s |
| Consultation | | see Step 3 |
| Next review | | before under-18 testers; and whenever a flow is added (the test will fail until this document names it) |
