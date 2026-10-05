<!-- Stage Y6 of the 12-17 programme: the App Store answers. Written 27 September 2026.
Every Apple rule quoted here was read on Apple's own pages that day (links in section 8). The owner
types these answers into App Store Connect; nothing here is submitted by itself.
test/app-store.test.ts keeps this file, the privacy manifests and the app's own privacy table
(PRIVACY_FLOWS in web/app.ts) telling the same story. If one changes, change all three. -->

# App Store answers for Inte-Run

## The short version

1. **Age rating** — answer the questionnaire exactly as in section 1. App Store Connect works out the
   rating itself as you go. Expect **9+ or 13+**; section 1.3 explains the one decision that is yours.
2. **App Privacy (the "nutrition label")** — declare the eight data types in section 2. Nothing is
   used to track anyone.
3. **The privacy policy link now exists** (stage D1, 28 September 2026). Paste
   `https://padder1980.github.io/Inte-Run/privacy/` into App Store Connect as the Privacy Policy URL and
   `https://padder1980.github.io/Inte-Run/support/` as the Support URL (section 0).
4. **Review notes** — paste section 5 into the notes field.

Everything else Apple asks is answered in section 4.

## 0. What still blocks a submission

| Blocker | Why | Whose |
|---|---|---|
| ✅ A **privacy policy link**, in App Store Connect **and** inside the app | Guideline 5.1.1(i): "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner." Guideline 5.1.4 says the same for any app that transmits personal information "from a minor". | **Done (D1):** `https://padder1980.github.io/Inte-Run/privacy/`, linked in the app from Support › Tools › Privacy policy & terms, the Safety page and Your data. You paste the URL into App Store Connect. ⚠️ Have it read by someone who knows data protection before external testers. |
| ✅ A version of that policy a **12-year-old can read** | The ICO's Children's Code (see `DPIA.md`) | **Done (D1):** `https://padder1980.github.io/Inte-Run/simple/`, measured at Flesch-Kincaid grade 2.6 |
| ✅ **Terms** with a parent or guardian clause | Under-18s cannot sign a binding contract (`YOUTH.md` section 6). ⚠️ How the terms word a minimum age changes the age rating — section 1.3. | **Done (D1):** `https://padder1980.github.io/Inte-Run/terms/`. "Designed for runners aged 12 and up", with no minimum age (your ruling, section 1.3) |
| ✅ A **support URL** that leads to real contact details | Apple: "This URL must lead to actual contact information (legal address, email address, telephone number), as may be required by local law ... This property is required." | **Done (D1):** `https://padder1980.github.io/Inte-Run/support/`, giving adam.palmer86@gmail.com, which is also `PRIVACY_CONTACT` in the app |
| A **new app build** | The privacy files, the location message and the watch app's privacy file only reach Apple in a build (section 7) | Press Play in Xcode, then upload |
| Signing `DPIA.md` | Not an Apple rule — UK data protection law | You |

## 1. Age rating

App Store Connect → your app → **App Information** → **Age Ratings** → **Set Up Age Ratings**.

Apple's rule (guideline 2.3.6): "Answer the age rating questions in App Store Connect honestly so that
your app aligns properly with parental controls."

### 1.1 In-app controls

| Question | Answer | Why |
|---|---|---|
| Parental Controls | **Not present** | There are no tools for a parent to monitor or restrict what a child does in the app. |
| Age Assurance | **Not present** | The app asks the runner's age and believes the answer. Apple's definition is a mechanism "to confirm an individual's age", such as its Declared Age Range API or ID checks, and the app has none. (See section 6.5 — this may be worth adding.) |

### 1.2 Content and capabilities

| Question | Answer | Why |
|---|---|---|
| Unrestricted Web Access | **None** | There is no browser in the app. Links (Strava, the ICO, the weather credit) open in Safari. |
| User-Generated Content | **None** | Apple means "the broad distribution of content created by users". Inte-Club posts and stories never leave the phone, and nobody else can see them. A share card leaves only when the runner shares it themselves, through the iPhone's own share sheet. |
| Social Media | **None** | No feed spreads anything to other people. |
| Social Media Disabled for Users Under 13 | **No / not applicable** | There is no social media to disable. |
| Messaging and Chat | **None** | Apple means "users can directly communicate with one another". Nobody can contact anybody. Ask Alfie is an AI assistant, not a person (it is disclosed in the review notes). |
| Advertising | **None** | No adverts of any kind. |
| Profanity or Crude Humor | None | |
| Horror/Fear Themes | None | |
| Alcohol, Tobacco, or Drug Use or References | **Infrequent** | ⚠️ Honest, and easy to get wrong. Apple counts any "references to ... the consumption of alcohol ... or other licit ... substances". The injury guide says not to use alcohol while an injury is swelling, the fuelling guide says "Alcohol is not a recovery drink" and warns against a new caffeine dose on race morning. All three advise against, and all three are clinically reviewed wording that must not be edited to change an answer. |
| Medical or Treatment Information | **Infrequent** | The injury guide (first aid, return to running, which over-the-counter medicines to ask a pharmacist about), the warning-sign screens that send somebody to a doctor or to 999, and the fuelling and under-fuelling guides. They live in Support, not in the everyday plan. |
| Health or Wellness Topics | **Frequent** | Apple's own example is "exercise recommendations" — that is the whole app. |
| Mature or Suggestive Themes | **None** | ⚠️ The one judgement call. If a runner ticks or types something about self-harm, struggling mentally or an eating disorder (the Wellbeing check-in, or Ask Alfie), the app answers on the phone with where to get help, including UK crisis lines (Samaritans, Shout, Childline, NHS 111, 999) since D3c, and the fuelling guide mentions that an eating disorder needs individual advice. That is safety signposting in reply to the runner, not content about those subjects. |
| Sexual Content or Nudity | None | |
| Graphic Sexual Content and Nudity | None | |
| Cartoon or Fantasy Violence | None | |
| Realistic Violence | None | |
| Prolonged Graphic or Sadistic Realistic Violence | None | |
| Guns or Other Weapons | None | |
| Gambling | None | |
| Simulated Gambling | None | |
| Contests | **None** | Apple means events where "users ... compete with one another". The app trains people for real races and shows their own personal bests, but nobody competes with anybody inside it. |
| Loot Boxes | None | |

### 1.3 The rating it will show, and the decision that is yours

Apple does not publish how the answers turn into a rating; App Store Connect shows it as you answer.
Its own summary is "9+: Infrequent mild content" and "13+: Frequent mild to moderate content", so
expect **9+ or 13+**.

⚠️ **There is no 12+ rating any more** — Apple replaced 12+ and 17+ with 13+, 16+ and 18+ in 2025. That
matters because the app's youth programme starts at **12**:

- **If it shows 13+**, a 12-year-old whose iPhone has Screen Time age limits switched on cannot install
  the app, even though the app has a plan written for them.
- **If it shows 4+ or 9+**, nothing needs changing — **but** Apple says that if your terms set "minimum
  age requirements that exceed the calculated rating, you must override to a rating that adheres to
  those requirements". So if the D1 terms say "you must be 12 or over", Apple's rule forces **13+**.

**My recommendation:** accept whatever rating App Store Connect calculates, do not override it, and have
D1 describe the app as *designed for runners aged 12 and over* rather than making 12 a contractual
minimum. That keeps a 12-year-old able to install it.
✅ **Decided, 28 September 2026: "designed for 12 and up".** The terms (`docs/terms/`) say exactly that and
set no minimum age, and `test/privacy-copy.test.ts` fails if a minimum-age sentence appears in the terms
or the simple version. So: **accept the calculated rating and do not override it.**

Other choices on the same screen:

- **Made for Kids: No.** The Kids category is for apps whose calculated rating is 4+ or 9+ *and* that are
  made for children, and the choice cannot be changed once the app is approved. Inte-Run is a running app for everybody with
  a programme for teenagers. ⚠️ Guideline 2.3.8 also means the App Store listing must not use words like
  "for kids" or "for children".
- **Age Suitability URL:** optional; leave blank for now.

## 2. App Privacy (the "nutrition label")

App Store Connect → your app → **App Privacy** → **Get Started**.

### 2.1 How Apple decides what counts

Apple's definition: "'Collect' refers to transmitting data off the device in a way that allows you
and/or your third-party partners to access it for a period longer than what is necessary to service the
transmitted request in real time." Data that stays on the phone is never "collected".

Read narrowly, only what **Inte-Run's own server keeps** must be declared: the Strava connection (the
account's tokens and first name) and the hashed install keys. Read fully, everything that leaves the
phone for somebody who may keep it is declared too — the routes and heart rate sent to Strava, Ask
Alfie's questions sent to an AI service, and the rough location sent for weather, maps and town names.

**I recommend the full reading**, for three reasons: Strava and Cloudflare do keep what we send them;
guideline 5.1.2(i) singles out sharing with "third-party AI" for clear disclosure; and declaring more
than the minimum is not a reason for rejection, while declaring less can be.

### 2.2 The answers

For every row: **used to track you: No**, and the only purpose is **App Functionality**.

| Data type (Apple's category) | Linked to the user? | What it is, and where it goes | Flow in `PRIVACY_FLOWS` |
|---|---|---|---|
| **Precise Location** (Location) | **Yes** | The GPS route of a run the runner sends to their own Strava account. Only if they connect Strava. | `strava` |
| **Coarse Location** (Location) | No | A rough location for the weather (Open-Meteo, rounded to about 1 km), the map around a run (CARTO or Mapbox), and a run's town (OpenStreetMap, about 1 km). No identifier from us goes with it. | `weather`, `maps`, `place` |
| **Health** (Health & Fitness) | **Yes** | Heart rate in runs sent to Strava — only from 16, which is Strava's own rule. | `strava` |
| **Fitness** (Health & Fitness) | **Yes** | Runs and strength sessions sent to Strava; the short plan summary that goes with an Ask Alfie question; and, when the runner taps Expand with Alfie (B11), the facts a briefing or a run's insight was written from — never the check-in answers or whether anything hurt. | `strava`, `alfie` |
| **Name** (Contact Info) | **Yes** | The Strava account's first name, kept on Inte-Run's server to show "Connected as ...". | `strava` |
| **User ID** (Identifiers) | **Yes** | The Strava connection itself: the account's tokens, kept on Inte-Run's server. | `strava` |
| **Device ID** (Identifiers) | **Yes** | Random keys made by the app for this install, stored on the server only as a scrambled (hashed) value: one keys the Strava connection, the other counts Ask Alfie questions per hour and per day, and expansions per day, to keep the free AI allowance fair (those counts delete themselves within about a day). | `strava`, `alfie` |
| **Other User Content** (User Content) | No | Ask Alfie questions (and the last few that already reached the server) — only after the runner says yes. The server keeps none of it; Cloudflare's side is governed by Cloudflare's terms. | `alfie` |

**Data used to track you: none.** There are no third-party SDKs, no analytics and no adverts.

### 2.3 What is deliberately not declared, and why

- **Photos or Videos** — Inte-Club posts, stories and share-card photos never leave the phone. A card
  leaves only when the runner shares it themselves, through the iPhone's share sheet.
- **Health check-in answers** — kept nowhere, sent nowhere (`DPIA.md`, Step 6).
- **Crash data, diagnostics, usage data** — none is sent. Support › Your data shows diagnostics on the
  screen only.
- **Search history** — Support search runs on the phone.
- **Contacts, email address, phone number, purchases** — never asked for.
- **The app-update check** (`update` in `PRIVACY_FLOWS`) sends nothing about the runner.

## 3. The privacy manifests (files inside the app)

Apple reads these from the app itself. Since 1 May 2024 a missing one gets an upload emailed back as
ITMS-91053. They now say the same thing as section 2, and a test checks it.

| Binary | File | Required-reason APIs | Collected data |
|---|---|---|---|
| iPhone app | `ios/InteRun/PrivacyInfo.xcprivacy` | **UserDefaults — CA92.1** ("to read and write information that is only accessible to the app itself"); **file timestamp — C617.1** ("the timestamps, size, or other metadata of files inside the app container") | The eight rows of section 2 |
| Watch app | `ios/InteRunWatch/PrivacyInfo.xcprivacy` — **new in Y6** | UserDefaults — CA92.1 | None: nothing leaves the watch for a server |
| Lock-screen widget | none needed | none used | — |

⚠️ **The iPhone file used to say "Nothing is collected ... no server".** Both halves stopped being true
when Ask Alfie's online answers and Strava arrived.

## 4. Everything else App Store Connect asks

- **Export compliance** — already answered inside the app (`ITSAppUsesNonExemptEncryption` is false: it
  uses only standard HTTPS).
- **Content rights** — "Does your app contain, show, or access third-party content?" **Yes**, and you
  have the rights:
  - Maps from CARTO or Mapbox with OpenStreetMap data — credited under every map.
  - Weather from Open-Meteo — ⚠️ **the credit was missing until Y6.** Their licence (CC BY 4.0) says:
    "You must include a link next to any location Open-Meteo data are displayed, for example: ...
    Weather data by Open-Meteo.com". It now appears under Today's weather tile, in the weather sheet and
    in the heat advice whenever a real forecast is shown. Their free service is for "private or
    non-profit websites or apps that do not have subscriptions or advertising" — true today. ⚠️ **If
    Inte-Run ever charges a subscription or shows adverts, it needs a paid Open-Meteo plan.**
  - Town names from OpenStreetMap — see section 6.4.
- **Category** — Health & Fitness.
- **Sign-in required** — No. There are no accounts.
- **Medical device** (if asked) — No. The app does not diagnose or treat; it gives general guidance and
  says when to see a doctor.
- **EU trader status** — App Store Connect asks every developer. If you declare yourself a trader, your
  address, phone and email are shown on the EU App Store. That is a legal question about you, not the app.

## 5. Review notes (paste into "Notes")

Apple: "The Notes field can contain up to 4000 bytes." This is well under (a test keeps it so).

> Inte-Run is a running coach. No account or sign-in is needed, and every feature works without one.
>
> Location: used while a run is recording, including with the screen locked, to measure distance, pace
> and route. A rough location (about 1 km) is also sent to Open-Meteo for the weather, map tiles are
> requested from CARTO or Mapbox, and a run's town can be looked up from OpenStreetMap.
>
> HealthKit: reads heart rate during a run and saves finished phone-recorded runs to Health as workouts.
> Runs recorded on the Apple Watch are saved to Health by watchOS and never written twice.
>
> Apple Watch and Live Activities: an optional companion app; a run can be recorded on the watch or the
> phone, and the lock screen shows the run's time and distance.
>
> Ask Alfie is an optional AI assistant. Nothing is sent until the user agrees in the app. Then the
> question and a short summary of their plan go to our server, which asks an AI service run by
> Cloudflare for the reply and stores nothing. Questions that mention a serious warning sign (chest pain,
> fainting, thoughts of self-harm and similar) are recognised on the device and answered with safety
> guidance; they are never sent. Users aged 12 to 17, or who have not given an age, are never offered
> online answers unprompted, and users under 13 cannot switch them on.
>
> Strava is optional. Connecting uses Strava's own page in Safari. The access tokens are kept on our
> server, never on the device, because Strava's token exchange needs our client secret. The user can
> disconnect at any time from Profile > Apps & devices, which also revokes access at Strava. No Strava
> account is needed to review anything else.
>
> Health guidance: the injury and fuelling pages give first-aid and general guidance, list the warning
> signs that need a doctor or emergency care, and advise seeing a GP or physiotherapist. The app does not
> diagnose.
>
> Ages 12 to 17: the app asks the runner's age and keeps the plan within UK Athletics' limits for that
> age. For under-18s, and anyone who has not given an age, Ask Alfie's online answers, town names for
> runs and saving to Apple Health all start switched off.
>
> The interface is a web page bundled in the app (WKWebView). The app can download newer versions of that
> same page from our website; updates never change the app's purpose, as the Apple Developer Program
> License Agreement section 3.3.1(B) requires.

⚠️ **The last paragraph is your call.** Downloading newer web code is allowed under the Developer
Program License Agreement ("Interpreted code may be downloaded to an Application but only so long as
such code ... does not change the primary purpose of the Application"), and many apps do it without
saying so. I recommend saying so: a reviewer who finds it unexplained is a worse outcome than one who
reads it here.

## 6. What App Review might question

### 6.1 Strava tokens are kept on our server (guideline 5.1.1(v))

The guideline says: "An app may not store credentials or tokens to social networks off of the device and
may only use such credentials or tokens to directly connect to the social network from the app itself
while the app is in use." Strava calls itself a social network for athletes, so a strict reviewer could
apply this.

**Our position:** Strava's token exchange and refresh need our client secret, which must never ship in an
app, so a server is unavoidable; the tokens never leave that server; they can only upload activities
(`activity:write`, nothing else); and Disconnect revokes them at Strava. Many fitness apps sync to Strava
this way.

**If it is rejected anyway:** the server would hand the tokens to the app once at connection, the app
would keep them and upload directly, and the server would only refresh them. That is a real piece of
work and is not needed unless Apple asks.

### 6.2 Downloaded web code (guideline 2.5.2)

Covered by the review note above and the Developer Program License Agreement section 3.3.1(B).

### 6.3 Medical content (guideline 1.4.1)

"Apps should remind users to check with a doctor in addition to using the app and before making medical
decisions." The injury, fuelling and warning-sign pages all do.

### 6.4 Town names from OpenStreetMap

OpenStreetMap's data is credited under every map. A run's town also appears on its page and can appear
on a share card. ⚠️ Worth confirming against OpenStreetMap's attribution guidance and Nominatim's usage
policy (which asks apps to identify themselves) before a public launch. Not a submission blocker.

### 6.5 Age assurance (a future option, not a problem)

Apple's Declared Age Range API (iOS 26) lets an app ask whether somebody is under 18, answered by the
family's own settings. It would close the known gap that "Prefer not to say" still gets the adult plan
(`YOUTH.md`). Not built; native work.

## 7. What Y6 changed in the app

- **Ask Alfie asks before anything goes to the AI, at every age.** Guideline 5.1.2(i) (added November
  2025): "You must clearly disclose where personal data will be shared with third parties, including
  with third-party AI, and obtain explicit permission before doing so." An adult's questions used to go
  online without being asked. Now an adult is asked once, at their first question; a young or
  unknown-age runner is never asked unprompted and can switch it on themselves. Every sentence that
  describes it names Cloudflare. (Web — reaches phones over the air.)
- **The location permission message** now names all three places a rough location goes: the weather,
  the maps and the town lookup. (Needs a build.)
- **The iPhone privacy manifest** was corrected, and **the watch app got its own**. (Needs a build.)
- **The weather credit** Open-Meteo's licence asks for. (Web.)
- **The server no longer keeps the Strava athlete number**, which nothing ever read. (Deployed 28
  September 2026, with D1's year limit on unused Strava connections; the answers above do not depend
  on it.)

## 8. Sources, read on 27 September 2026

- Age ratings, values and definitions — https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions
- Set an app age rating — https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- App privacy details — https://developer.apple.com/app-store/app-privacy-details/
- App Review Guidelines (1.4.1, 2.3.6, 2.3.8, 2.5.2, 5.1.1, 5.1.2, 5.1.3, 5.1.4) — https://developer.apple.com/app-store/review/guidelines/
- Required-reason API codes — https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons
- Open-Meteo terms and licence — https://open-meteo.com/en/terms and https://open-meteo.com/en/licence

Read on 28 September 2026 for the privacy policy (stage D1):

- Cloudflare Workers AI data usage — https://developers.cloudflare.com/workers-ai/platform/data-usage/
- Cloudflare privacy policy (UK Extension to the EU–US Data Privacy Framework) — https://www.cloudflare.com/privacypolicy/
- Strava privacy policy (effective 1 January 2026) — https://www.strava.com/legal/privacy
- Mapbox privacy policy (IP addresses kept 30 days; UK Extension) — https://www.mapbox.com/legal/privacy
- CARTO privacy notice — https://carto.com/privacy
- OpenStreetMap Foundation privacy policy — https://osmfoundation.org/wiki/Privacy_Policy
- Apple's Licensed Application End User License Agreement — https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
