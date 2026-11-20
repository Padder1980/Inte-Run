# Strava and Ask Alfie's online brain

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> Strength-to-Strava (A8) is in notes/strength-a5-a8.md; Strava's age rules (Y4) in notes/youth-programme.md.

## ASK ALFIE'S REMOTE BRAIN IS CLOUDFLARE'S FREE AI (owner's call, 2026-08-10)

He asked for Alfie to answer anything, "like the AI at the top of a Google search", then pushed back on
paying for it: *"Is there no way I can just connect it to a free version of AI? I don't need complex
answers… they're just every day questions."* Costed, he was right to ask.

| brain | per question | 10 testers × 5 questions/day |
|---|---|---|
| `claude-opus-5` | ~2.5p | ~£1.25/day |
| `claude-haiku-4-5` | ~0.3p | ~15p/day |
| **Cloudflare Workers AI** | **£0** | **£0** |

⚠️ **`BRAIN` IN `alfie-proxy/src/worker.ts` IS THE WHOLE SWITCH.** `"cloudflare"` (shipped) needs no key
and no card; `"claude"` needs `ANTHROPIC_API_KEY` and gives better answers. One line, so his mind can
change without a rewrite.

⚠️ **THE WORKERS FREE PLAN CANNOT BE BILLED, AND THAT IS THE REASON THIS IS THE DEFAULT.** 10,000
Neurons/day are included; above it requests simply **fail** rather than costing money, and a failure
sends the app to `alfieLocalAnswer`. Roughly ~70 questions/day before that bites. There is no bill to
run up, only an allowance to exhaust.

⚠️ **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, and its `max_tokens` DEFAULTS TO 256** — left alone
that truncates a coaching answer mid-sentence. Set to 700.

⚠️ **THE PLAN CONTEXT GOES IN A SYSTEM TURN, NOT THE QUESTION.** In the user turn a smaller model
answers *about* the JSON ("your plan says…") or reads a field back verbatim instead of using it.
Verified live: asked whether easy runs were too slow, it quoted the runner's real 6:10–6:40/km band.

⚠️ **`CF_EXTRA` IS SIX FAILURE MODES, NOT PREFERENCES.** A 70B model given this app's Claude-tuned
system prompt runs long, opens with "Great question!", invents paces, and — the one that matters —
answers a pain question with confident medical advice. Verified live: "knee sore for two weeks" and
"might have a stress fracture" both returned *stop running, see a physio or GP, I am not a doctor*.
⚠️ It is the SECOND line of that defence. `alfieRedFlags` runs on the PHONE first, so the worst
questions never reach the server at all — do not let this replace it.

⚠️ **THE CONSENT COPY HAD TO BE REWRITTEN, and this is the second time that sentence has been the
work.** It read *"except that you have connected it to your own service"* — true only while a server
was something the owner opted into by hand. Shipped on by default it tells every runner they did
something they did not, on the one screen a worried person reads carefully. It now names what leaves
the phone (question, a plan summary, the last few messages), what never does (name, location, check-in
answers), and that Inte-Run stores none of it — and it does **not** claim anything about what
Cloudflare keeps, which is not ours to assert.

**Spend/allowance ceiling.** Per-device 15/hour and 40/day, global 200/day, checked BEFORE the model
call; over it returns 429 and the app answers on-device. ⚠️ **The caps are PRICED, not picked** — the
1500/day first written was ~£30/day (~£900/month) on Opus, which is not a hobby-project number.

⚠️ **KV CANNOT STOP A BURST, AND THE BURST GUARD IS UNPROVEN.** KV reads are edge-cached for up to a
minute, so rapid questions all read the same stale count: measured against the deployed Worker, **31
requests in seconds left the counter at 21 and tripped a limit of 30 not once.** Cloudflare's own
`ratelimit` binding was added for that dimension — it deploys, binds, never throws, and **still did
not enforce across 16 rapid requests.** So the daily budget is the ceiling that actually holds, and it
holds approximately. A **GET on the Worker** reports brain / key / burst guard / store, because a
silent catch would report protection that is not there.

⚠️ **`npx tsc --noEmit` does not cover `alfie-proxy/`, and that hid a real type error**: the pinned SDK
(0.70) had no types for `output_config`, so the effort setting only survived because wrangler's esbuild
does not typecheck. Upgraded to 0.116. The by-hand command is in `alfie-proxy/README.md`.

## Strava (2026-08-09) — and the first time this app has needed a server

The owner chose Strava over a second Mapbox token, reasoning that **a tester will not move off the app
they already use if it means losing their Strava log.** Finish a run → **Send to Strava** on the run's
own page → it lands there with map, splits and pace.

⚠️ **THE BLOCKER WAS THE DATA, NOT THE API** (groundwork commit `0106126`). Route points were
`{lat,lng}` with no times, and Strava needs a time on each point to derive pace, moving time and
splits — which is most of why anyone wants the run there. Points now carry `t` = seconds since the run
started, **recorded from `liveElapsedMs()` so paused time is subtracted** (`Date.now()` minus a start
draws a straight line at walking pace through the junction the runner waited at), and the field is
carried through `normalizeRoute()`, which silently drops anything it does not name.

⚠️ **NEVER FABRICATE THE MISSING HALF.** The obvious way to make an older run into a GPX is to spread
its total time evenly across the points it has. That draws a perfectly even run **that never happened,
in somebody else's training log, under their name.** So `runStravaPayload()` picks its shape from the
DATA: timed points → `gpx`; no timed points → `manual`, carrying the real distance and time. A run with
no route at all is `trainer: true` (treadmill); a GPS-refused outdoor run is not. Same rule as
`sim: true` and as a treadmill run storing no route. `test/strava-payload.test.ts` enforces it.

**Where the secrets live: `alfie-proxy/` — ONE Worker, two jobs.** Same secrecy problem, same box.
- ⚠️ **`POST /` STAYS ALFIE'S.** The app POSTs to the bare proxy URL it was given (`fetch(cfg.proxy…)`),
  so moving Alfie to a path would silently break every install already configured. Strava is under
  `/strava/*`, and `stravaRoute()` returns `null` for anything else.
- Routes: `/strava/start` (302 to Strava), `/strava/callback` (HTML result page), `/strava/status`,
  `/strava/upload`, `/strava/upload-status`, `/strava/disconnect`.
- Tokens live in a **Cloudflare KV namespace bound as `STRAVA`**. `wrangler.toml` carries a
  **placeholder id** — it deploys cleanly and then fails at runtime with "not configured".

⚠️ **THE PAGE NEVER HOLDS A STRAVA TOKEN, and that is the design rather than a detail.** The obvious
build hands the access token back after the OAuth dance and uploads from the page — putting a live
credential for somebody's Strava account into `localStorage` on a **public origin**, where every backup
export and every storage-inspector screenshot carries it away, and a refresh token cannot be revoked
from there. Instead the page holds a **device key** (32 bytes of `crypto.getRandomValues`, base64url) in
`interun_strava_v1`; the Worker maps it to the tokens and never returns them.
- ⚠️ **`interun_strava_v1` IS IN `BACKUP_NEVER`.** Backup keys are found by the `interun_` PREFIX, so it
  would otherwise ride out in every export — a file the runner emails themselves. Whoever held it could
  push runs into their Strava account. Same trap as `interun_mapbox_v1`, worse consequence.
- ⚠️ The KV key is a **SHA-256 of the device key**, so a dump of the store yields nothing replayable.

⚠️ **The device key does NOT round-trip through Strava.** `state` lands in a redirect URL, browser
history and any log in between, so `/strava/start` stores a **single-use nonce → key-hash** with a
600s TTL and sends the nonce. That is also the CSRF gate: a code arriving without a nonce we issued is
refused.

⚠️ **`activity:write` AND NOTHING ELSE.** It is the only scope that permits an upload or a manual
activity. Every tutorial also asks for `activity:read_all`, which would hand the Worker the runner's
entire private history including their privacy zones — to push one run.

⚠️ **CHECK THE GRANTED SCOPE, don't assume it.** Strava's consent screen lets the runner untick the
permission and continue, returning a perfectly valid token that cannot upload. Stored, that reports
"Connected" and then fails on every run, which reads as a bug in the app rather than a decision they
made thirty seconds earlier. The check is before the `put`, asserted by a test.

⚠️ **`start_date_local` IS LOCAL TIME and no server can know the runner's timezone**, so the device
computes it. Written out from `getFullYear/getMonth/getDate/getHours/…`, **not** sliced off
`toISOString()` — that is UTC, and it moved every British summer run an hour earlier in the runner's
own log, invisibly for five months of the year. Verified on-device: UTC `06:39:10Z` → local `07:39:10`.

⚠️ **A DUPLICATE IS A SUCCESS.** Strava answers `"duplicate of activity N"` when the run is already
there — exactly what a retry produces. Reporting it as an error teaches the runner to tap again, which
cannot help. `external_id` = the run's own id is what makes Strava able to say so.

⚠️ **A rotated `refresh_token` must be written back.** Strava may rotate it on refresh; keeping the old
one works until it doesn't, and then the runner is silently disconnected with no way to tell why.

⚠️ **Disconnect tells STRAVA, not just us.** Forgetting our copy alone leaves Inte-Run standing in the
runner's Strava settings with write access forever. Local record first, so a failed deauthorise still
disconnects rather than trapping a half state.

Other rules baked in:
- **The server's answer wins.** A runner can revoke from Strava's settings and the page would never
  hear; `stravaRefresh()` runs on every mount of Connections, and a 401 on upload clears `connected`.
- **Coming back into view is the ONLY signal consent succeeded** — nothing redirects into the app. See
  `stravaResume()` on `visibilitychange`. ⚠️ It must stay on ONE LINE with `syncTextScale()`; a test
  asserts that pairing (iOS never tells a web view its text-size setting changed).
- **Consent opens in Safari** via `window.open(…, "_blank")`, which `WebHost.createWebViewWith` already
  routes out. A login page inside our own web view is the shape of a phishing screen.
- **Nothing uploads on its own.** The only caller of `stravaSendRun` is a tap; a test counts them.
- **The button is ABSENT, not disabled, when not connected** — a greyed-out Strava button on every run
  advertises a feature the runner has not set up.
- **A tester is never asked for a URL.** `stravaDevMode()` gates the paste field exactly as
  `mapDevMode()` does; with no server the row stays an untappable "Planned".

⚠️ **`npx tsc --noEmit` DOES NOT COVER `alfie-proxy/`** (tsconfig `include` is `src`/`test`/`demo`), so
a type error there surfaces at deploy. The command to check it by hand is in `alfie-proxy/README.md`.
Behaviour is covered from the repo suite instead — `test/strava-connect.test.ts` reads both the page and
the Worker as source (17 tests).

**The Worker is DEPLOYED and verified live (2026-08-09):** `https://alfie-proxy.alfie-proxy.workers.dev`,
KV namespace `52ff9e8a2b944d058efabc3abe33ad1c`, all three secrets confirmed on the server.
`STRAVA_SERVER` in `web/app.ts` ships filled in, so every build connects in one tap. Smoke-tested
against the running Worker: `/strava/status` → `configured:true`, `/strava/start` → 302 to Strava with
`activity:write`, `/strava/upload` with a bogus device key → refused.

### ⚠️ STRAVA'S OWN LIMITS ARE THE REAL GATE, NOT THE CODE (researched 2026-08-09)

95 claims checked against Strava-owned pages; 40 were refuted or corrected on inspection, which is why
these are worth trusting over recollection. **Sources: `developers.strava.com/docs/rate-limits/`,
`developers.strava.com/docs/getting-started/`, `developers.strava.com/guidelines/`,
`strava.com/legal/api_policy`.**

⚠️ **A NEW STRAVA APP HAS AN ATHLETE CAPACITY OF ONE.** *"All newly created apps will have an athlete
capacity of 1, aka Single Player Mode."* Only the owner's own Strava account can authenticate. **This
is not a rate limit and no amount of code fixes it** — the second tester to tap Connect simply fails.
- **10 athletes is self-serve** from the API Settings Dashboard, no review (and doubles the request
  limits to 400/15min, 4,000/day).
- **Beyond 10 requires submitting the app for Strava review**, and *"increased access is not a
  guarantee"*. Standard Tier tops out at **9,999**; 10,000+ needs the Extended Access Tier, case by
  case. ⚠️ **No exemption for upload-only apps** — capacity counts athletes who authenticated,
  whatever scope they granted.
- ⚠️ **The review asks for SCREENSHOTS of every place Strava data appears and of the "Connect with
  Strava" button**, so those screens must exist before applying.

⚠️ **A PAID STRAVA SUBSCRIPTION IS NOW REQUIRED TO HAVE AN API APP AT ALL** (Standard Tier; 1 June 2026
for new developers, 30 June for existing). *"A Strava subscription is a prerequisite for creating an
app."* It falls on the OWNER, not on runners — no Strava page requires end users to be subscribers.

⚠️ **RATE LIMITS ARE PER APPLICATION, NOT PER ATHLETE** — one shared pool for every runner. Default
**200 requests/15min and 2,000/day overall**, plus a separate **non-upload (read) limit of 100/15min
and 1,000/day**. Uploads are exempt from the read limit but counted by the overall one, so writes
always keep ≥100/15min of headroom. Daily limits reset at **midnight UTC**. Strava *"only raise rate
limits for apps that are approaching capacity"*, so headroom cannot be requested before launch.

⚠️ **THE CONNECT BUTTON SHOULD BE STRAVA'S OWN ARTWORK, AND OURS CURRENTLY IS NOT.** The Brand
Guidelines are written conditionally (*"apps that choose to use the Connect with Strava button"*) but
the developer landing page calls the rules *"Mandatory"*, **Strava is the sole judge of compliance**,
and branding non-compliance is an express ground for revoking the token. Treat the official button as
required.
- ⚠️ **"Connect to Strava" IS NOT SANCTIONED WORDING.** The only permitted strings are **"Powered by
  Strava"**, **"Compatible with Strava"** and **"View on Strava"**. "Works with Strava", "Syncs with
  Strava" and "Connect your Strava" are all outside it.
- Official button: **48px high @1x (96 @2x)**, artwork 237×48, **orange or white only**, and *"never
  modify, alter or animate"* — no recolouring to our palette, no re-typesetting.
- A Strava logo must be **visually separate from ours and never more prominent**. Never a Strava logo
  as the app icon; never "Strava" in the app's name; the word must not be set larger than surrounding
  text. `#FC5200` is the only published Strava orange, and only for making a "View on Strava" link
  identifiable.
- ⚠️ Attribution (*"Powered by Strava"*) is **optional** — there is no place Strava mandates it.
- ⚠️ These branding claims are the one group whose **adversarial verification did not finish** (session
  limit), so confirm against `developers.strava.com/guidelines/` before acting.

⚠️ **API Policy §2.4 requires clear links out to the runner's own Strava account** plus accessible
support contact information. §4.3 forbids anything implying affiliation or endorsement; §5.2 forbids
imitating Strava's look. Before consent, §7 requires disclosing what is collected, how to withdraw and
how to request deletion — **a screen Inte-Run has not built** — and a GDPR-compliant privacy policy
behind a prominent link.

⚠️ **§5.8: THE STRAVA SYNC MAY NEVER BE A PAID FEATURE.** No charging *"in any manner"* for access to
the API Materials. Charging for our OWN non-duplicative functionality is expressly permitted, so a paid
coaching plan is defensible — putting Strava export behind it is not. (Subscriptions are already cut.)

⚠️ **§5.16 bans a "pass-through proxy, intermediary, or aggregator that re-exposes the Strava API"** and
bans sharing or multiplexing tokens across users. `alfie-proxy` holds each runner's own tokens under
their own device key and exposes only our own upload action, never a generic Strava proxy — which is the
ordinary server-side OAuth shape Strava's own secret-handling rules force on everyone. **Read as
compliant, but it is the clause to re-read before adding any new route**, and it is unverified.

**Still the owner's to do:** register the Worker host as Strava's **Authorization Callback Domain**
(host only — no scheme, no path), raise athlete capacity to 10 in the API Settings Dashboard before any
tester tries it, and confirm the paid Strava subscription. The Road Map step `p2-strava` stays
**unticked** until a real run has gone across. Credentials are in gitignored `strava-secret.txt`.
✅ **THE CALLBACK DOMAIN IS REGISTERED — verified 2026-09-23 against a control, not assumed.** An
authorize request whose `redirect_uri` is on `example.com` gets **400 `redirect_uri invalid`**; the same
request with ours gets **302 to Strava's login**. Athlete capacity and the subscription cannot be seen
from outside Strava's own settings page and are still the owner's to check.

## Deployed 2026-11-19 (version fa07893f-a21d-48d0-946e-22138d66f339)

The Worker on main went live: B11's Expand with Alfie and B1's Strava switch for a run added by hand are on. Read from the live
server straight after, neither spending a question: `GET /` → `"expand":["briefing","insight"]`,
`"expandDaily":{"device":3,"global":40,"usedToday":0}` (before: no `expand` key, so the app hid the button); `GET /strava/status`
with no device key → `"configured":true`, `"origins":["recorded","added"]` (`stravaCanAddedRuns`). Bindings at deploy: `STRAVA`
(KV), `AI`, `BURST` (ratelimit, wrangler warns that "unsafe" fields are experimental).

- ⚠️ **The wrangler login had expired again** (the 2026-09-23 one): `whoami` → "Your auth token has expired and could not be
  refreshed". The first `wrangler login` in his Terminal panel timed out after two minutes unseen (the browser page opens behind
  the app), the second worked once he was told to switch to the browser first.
- ⚠️ **`run_in_terminal` only starts in this session's folders**, so from a worktree: symlink the main checkout's
  `alfie-proxy/node_modules` into the worktree's `alfie-proxy/` and log in there (the login itself is stored per user, not per
  folder). Deploy from a checkout whose `alfie-proxy/` matches main: `git diff <its HEAD> main -- alfie-proxy/` was empty.

## Connected apps redrew itself for ever (2026-11-20)

The owner: *"every time I press the Connected apps button, the page it takes me to is constantly flickering and it
won't allow me to press anything on that screen."* The button with that name is the Plan page's **Connected apps**
tile (`data-pact="apps"` → `planAction("apps")`); Profile › Connections › **Apps & devices** (`data-pf="connect"`) and
Support's `connect` hub open the same screen (`state.support = "connect"`), so all three looped.

**Measured, not guessed.** In a browser at phone size, with a device key in `interun_strava_v1` and `/strava/status`
stubbed to answer in 40 ms: opening the screen ran **71 renders and 71 status requests in 3 s, then 47 more in the
next 2 s** — one full redraw per answer, never stopping (on a real network, one per round trip). Every redraw restarts
`#view`'s `viewIn` fade (the flicker) and rebuilds the rows under the finger, so a slow touch tap rarely lands.

**The loop had two halves, both there since 72a4538 (2026-08-09):**
- `wireConnectView()` called `stravaRefresh()` on every `wire()`, and `wire()` runs after every `render()` — so a
  redraw asked exactly as an opening did. The comment said "every time this screen is OPENED"; the code said every
  time it is drawn.
- `stravaRefresh()` redrew after every answer: `if (was !== c.connected || !c.pending) stravaRerender();`.
  `!c.pending` is true whenever nothing is waiting — always, for a connected runner. The intent was "the waiting
  state has just ended".

It needs only a device key (`cfg.key`, written the first time Connect is pressed, connected or not) and a server that
answers (`STRAVA_SERVER` ships filled in and the Worker sends CORS headers), so every phone that ever pressed Connect
had it. Under the Strava sheet it pauses (`stravaRerender` reopens the sheet instead of rendering) and it restarts on
the next render of the screen. Each request costs the Worker one KV read (`status()` reads `tok:<hash>` and calls
nothing at Strava), so no Strava rate limit was spent.

**The fix — each half on its own:**
- `let CONNECT_SHOWN` (beside `wireConnectView`): whether the last `wire()` found `.cn-row` on screen. Only an
  ARRIVAL (`shown && !CONNECT_SHOWN`) asks the server; a redraw, a sheet closing or the watch's
  `__interunWatch.status` answer landing does not. Leaving and coming back asks again — the promise in the comment,
  kept and tested.
- `stravaRefresh()` redraws only when what the screens show changed: `[connected, name, pending]` before and after
  the answer (`shown(c) !== before`). `sportTypes` and `origins` are on neither screen, so they are saved without one.
- Measured after, in headless Chrome over CDP with real touch taps (down, 120 ms, up), light and dark: opening asks
  once, then **0 renders, 0 requests and 0 DOM mutations** over the next 3 s; the Strava row opens its sheet, the
  calendar row opens "Get reminded on session days", both close, Back returns to where it came from ("‹ Profile" or
  "‹ Support"), reopening asks once, the bottom bar works — entering from the Plan tile and from the profile row
  alike. An answer that changes something (connected → revoked) redraws exactly once and shows "Ready".
- ⚠️ **The full `npm run verify` took 63 minutes on 2026-11-20** (load average 21 while headless Chrome checks and a
  subagent ran beside it); `verify:quick` alone took 2½. Don't run screenshot tools while verify runs.

**Guard:** `test/connected-apps-still.test.ts` runs the real `wireConnectView`, `stravaRefresh` and `stravaRerender`
(with the top-level lets they read, derived from the page) against a stand-in `render()` that ends in
`wireConnectView()`, as `wire()` does — a reachability test holds the stand-in to that. Re-broken three ways, copying
the file aside and back: the original code fails 5 of 6; the ask half alone fails 2 ("redraws it once, and only
once", "a redraw of the screen is not an opening"); the redraw half alone fails 2 ("asks Strava once, and the screen
then stays still", "an answer that changes nothing redraws nothing").

- ⚠️ **A desktop mouse click is no test of a screen that keeps redrawing.** In the looping build a mouse click on the
  Strava row still opened the sheet — it is quick enough to fall between two redraws; a thumb is not. Count renders
  per second instead.
- ⚠️ **The in-app Browser pane was hidden, and its screenshot showed the page mid-fade with Today highlighted** — a
  stale frame: the live DOM said Support, opacity 1, `viewIn` finished. The screenshots came from headless Chrome.
- **Follow-up, not changed:** the Strava sheet's "I've done that — check now" (`stvCheckLink`) sets "Checking…" and
  relies on the answer's redraw. An answer of "still waiting" changes nothing on screen, so the button keeps saying
  "Checking…" — before this fix as well as after (the old test skipped that redraw too).

**The same shape elsewhere — swept 2026-11-20 (a subagent traced every request started from `render()`, `wire()`, the
view builders and the sheet openers): no second endless loop.** Bounded or safe, with the guard that makes it so:
`fetchWeather` (`WX_FETCHING` / `state.wx`; one redraw on success), `runPlaceLookup` (`run.placeTried` set before the
fetch), `alfieExpandProbe` (`ALFIE_EXPAND_ASKED`), the week band's `onscroll` (renders only if the week changed),
`__interunWatch.status` (sets `WATCH_STATUS` before rendering), `openStartWhereSheet` (asks once per opening), the
reminders reply (`NOTIFY_RERENDER` asks nothing back). Found on the way — not loops, NOT changed, each a Road Map step:
- **A closed Strava sheet pops back open by itself — seen in the browser.** `closeSheet` only hides the sheet, so
  `#stvSheet` stays in `#sheetBody`, and `stravaRerender`'s `if ($("stvSheet"))` reopens it on the next answer that
  changes something, instead of redrawing Apps & devices (whose row still said "Connected" underneath). Before this
  fix it fired on every opening after the sheet had once been opened. Fix: also require `#sheetOv.on`, as
  `refreshStartWhere` does. Road Map `pc-strava-sheet` (with the stuck "Checking…" above).
- **Every render replays the 180 ms `viewIn` fade, same screen or not — read in the code.** `viewEnter(v)` ends
  `render()` for the tabs and Profile with no "did the screen change" test (`LAST_SCROLL_KEY` already knows), so any
  redraw in place blinks — and during a wrist run, Today redraws on every update from the watch. Road Map `pc-redraw-fade`.
- **Inte-Club's back swipe piles up — read in the code.** `wireClubPostView` (run on every render of a post) calls
  `clubWireBackSwipe($("view"), …)`, adding three listeners to the permanent `#view` each time, never removed and not
  checking the screen: after a post has been open, a right swipe on any later screen runs `state.screen = null;
  render()` once per copy. Road Map `pc-club-swipe`.
- **A sample weather is undone — read in the code.** The weather sheet's preset buttons set `state.wx = null` and
  `render()`, and that render's `fetchWeather()` asks again, so the live forecast replaces the preset when it lands;
  with no signal or location refused, Today asks again on every render (every update during a wrist run). Road Map
  `pc-weather-preset`.
- Also reported, not checked: `wireTrialRun` starts a new animation-frame chain on every render without cancelling
  the last (CPU only).

## The Strava sheet: a closed sheet stays closed, and "check now" answers (2026-11-20, his yes)

Both were found while fixing the Connected apps loop (above), and both were seen in a browser before being fixed.
- **A closed sheet popped back open.** `closeSheet` removes `.on` and keeps the sheet's body, so `#stvSheet` stays in
  the page, and `stravaRerender` asked only `$("stvSheet")`: the next answer that changed something reopened the sheet
  the runner had closed, and returned before redrawing Connected apps, whose row still said Connected. Measured: open
  the sheet, close it, disconnect on Strava's website, reopen Connected apps → the sheet popped up over it. Now the
  sheet counts as open only with `#sheetOv.on` as well (the `refreshStartWhere` test), and Connected apps is redrawn
  whether or not the sheet is open, so the row behind an open sheet is right when it closes (before, Connect inside
  the sheet left the row saying "Ready" while the sheet said "Waiting for Strava").
- **"I've done that — check now" stuck on "Checking…".** `stravaRefresh` redraws only when the answer changes what is
  shown, and "still waiting" changes nothing (an unreachable server, the same), so nothing put the button back. The
  handler now waits for the answer: connected → the answer's own redraw shows it; anything else → the sheet is
  redrawn (button back, enabled) with a status line under the button, "Not connected yet. Finish on Strava in your
  browser, then check again." Nothing happens if the sheet was closed while it checked.
- ⚠️ **The answer is IN THE SHEET, not a toast, because a toast can sit hidden behind an open sheet.** `.app-toast` and
  `.sheet-ov` are both z-index 70 and both appended to `.app` the first time they are used, so page order decides:
  whenever a toast came before the session's first sheet, the sheet is drawn over every later toast. Proved with a
  probe that turns the toast's `pointer-events` on (it is `none`, so `elementFromPoint` otherwise sees straight
  through it): the hit at the toast's centre was the sheet's own text (`.sd-desc`). Every toast raised while a sheet
  is open is exposed (the Strava sheet's "That must be an https:// address." among them). NOT changed — a layering
  change for every toast in the app; Road Map `pc-toast-behind-sheet`.
- **Guard:** two more tests in `test/connected-apps-still.test.ts` (8 in all): `stravaRerender` with a closed sheet
  still in the page, with an open one, and on another screen; the check button still waiting, connected, and closed
  while checking — and never a toast. Re-broken by copying the file aside and back: the old `stravaRerender` fails "a
  closed Strava sheet stays closed"; the old one-line handler fails "check now always answers"; the answer sent to a
  toast fails it as well.
- Checked in the in-app browser at phone size, light and dark: the closed sheet stays closed and the row reads
  "Ready"; with the sheet open, coming back connected turns the sheet and the row behind it to Connected together;
  "check now" while waiting shows "Checking…", then the button and the status line (8.2:1 in dark; the sheet's own
  `.bk-md` text style).
- ⚠️ **While a connection is waiting, `stravaResume` asks on every return to view.** In the in-app browser the pane hid
  and reappeared dozens of times in a few minutes and each return asked `/strava/status` (31 calls by the end). That
  is the designed path — once per coming back to the app on a phone — not a loop; don't mistake it for one.
- **`pc-toast-behind-sheet` was fixed the same day, on his yes:** `.app-toast` is z-index 99 now (notes/redesign-design-system.md,
  "Toasts were drawn behind sheets"). The "check now" answer stays in the sheet anyway — it belongs beside the button it
  answers, and must not vanish after four seconds.

## Brand logos on Connected apps: what each brand allows (researched 2026-11-20)

The owner asked for the real logos on Connected apps ("the strava logo would be used, the garmin logo, apple, google
etc"). A subagent read each brand's own published rules on 2026-11-20; quotes are close paraphrases except where marked,
so re-read the page before relying on a detail. Using a mark without permission risks App Review 5.2.1 (third-party
trademarks need permission) and, for Strava, API Agreement §4.1 (no use of Strava marks beyond the guidelines).
- **Strava — allowed with conditions, official lockups only** (developers.strava.com/guidelines, revised 29 Sep 2025).
  Only Strava's own artwork, unchanged and not animated; never part of our app icon; never implying Strava sponsors us;
  visually separate from our own name or logo and never more prominent. There is **no standalone Strava mark** to use as
  a square icon, and cutting the chevron out of a lockup counts as changing the logo — so the row's small square cannot
  hold a Strava logo; the "Compatible with Strava" / "Powered by Strava" lockup (wide text) can sit elsewhere. Packs:
  `developers.strava.com/downloads/1.2-Strava-API-Logos.zip` (1,183,207 bytes; EPS, SVG, PNG; orange, white, black;
  horizontal or stacked) and `1.1-Connect-with-Strava-Buttons.zip` (397,030 bytes), both last modified 17 Nov 2026.
  ⚠️ **CORRECTS THE EARLIER NOTE ABOVE ("THE CONNECT BUTTON SHOULD BE STRAVA'S OWN ARTWORK"):** the guidelines' section
  1.1 applies only to apps that CHOOSE the Connect with Strava button (48 px high, 96 @2x, orange or white, linked to
  Strava's OAuth authorise URL); it is optional. Wording: a reference to working with Strava says "Powered by Strava" or
  "Compatible with Strava"; links to Strava data say "View on Strava" (bold, underlined or #FC5200). API Agreement §4.4:
  credit Garmin if we ever SHOW Strava activities recorded on Garmin devices.
- **Garmin — not allowed until Garmin licenses us** (developer.garmin.com/brand-guidelines/connect): the assets are for
  licensees with a commercially available Garmin Connect integration. Afterwards: unaltered images, the "works with…"
  badge at least 88 px high, the full "Garmin Connect" name with its tile (API Brand Guidelines PDF, 30 Jun 2025).
- **COROS — not allowed** without written permission (coros.com/terms §6); no partner guidelines found. Spelled "COROS".
- **Apple logo, Apple Watch, Apple Calendar — not allowed** (apple.com/legal/intellectual-property/guidelinesfor3rdparties):
  no Apple-owned logo, symbol or icon without a written licence; the names are fine in accurate text ("works with Apple
  Watch"). No Apple Watch badge exists. SF Symbols (`applewatch`) are licensed for software running on Apple systems
  only, so not in the public web page (seen quoted, not first-hand).
- **Apple Health — allowed with conditions, iPhone app only.** Verbatim: "You can use the Apple Health app icon in your
  app user interface" (developer.apple.com/health-fitness/works-with-apple-health/), for HealthKit apps. HIG HealthKit
  "Apple Health icon": Apple's file only, only to show the app works with Health; "Apple Health" written beside it (never
  "HealthKit" to users); the icon is not the button; no new corner shape, border, shadow or tile behind it; clear space
  1/10 of its height; no smaller than the list's other icons. File: developer.apple.com/design/resources → Technologies →
  "Apple Health Icon" (a PNG inside a DMG). Apple's artwork licence covers software running on Apple systems, and
  `docs/index.html` is a public web page, so the icon belongs in the native app (supplied by the Swift side behind a
  capability flag) — an Xcode build, not over the air.
- **Google Calendar — not allowed without Google's approval** (Partner Marketing Hub account and an approval request;
  even then never alone and with our brand more prominent). Plain text and "works with" are fine. We use no Google API.
- **Microsoft Outlook — not allowed**: no Microsoft logos or icons, only true text statements (microsoft.com trademarks
  page; Microsoft 365 Trademark Guidelines, 1 Sep 2026); first mention "Microsoft Outlook".

**What was built (2026-11-20, his choice: "Strava badge + Apple Health"):**
- **Strava row:** the plain word "Strava" became Strava's own "Compatible with Strava" horizontal artwork, 154×13 px
  (`stravaMarkHtml`, `.stv-mark svg { height: 13px }`). Both official colours are inlined — orange (`#FC5200` wordmark,
  black "compatible with") and white — and the stylesheet swaps them (`.brand-light` / `.brand-dark`): one plain rule each
  for the default, then the system-dark swap and both `data-theme` rules written from `:root`, so specificity — not order —
  settles it, and the duplicate-class ratchet in `test/community.test.ts` (ceiling 20) sees no second plain rule. The
  first version wrote the swap as plain `.brand-dark` rules inside the media query, and that ratchet failed at 21. The small square keeps the app's own share glyph: there is no Strava mark that fits it.
  `stravaCompatSvg` holds the artwork as Strava ships it, newlines between elements removed and nothing else, and is a
  function rather than a const (no launch-order dead zone). Downloaded with his yes (file, source and size stated):
  `1.2-Strava-API-Logos.zip`, 1,183,207 bytes.
- **Apple Health row:** Apple's icon, iPhone app only. Downloaded with his yes (`Icon-Apple-Health.dmg`, 182,601 bytes,
  devimages-cdn.apple.com); the disk image opens with Apple's **Developer Artwork License Agreement for HealthKit**, which
  was read, summarised to him and accepted on his behalf on his explicit yes (`yes Y | hdiutil attach …`; without it
  `hdiutil` answers "attach canceled"). The PNG (1920×1920, 55,090 bytes, Apple's file unchanged) lives in
  `ios/apple-health-icon.png`: **gitignored** (this repo is public), also listed in the shared `.git/info/exclude` so the
  main checkout was safe before it pulled the `.gitignore` line, and copied there too so his own builds carry it. The
  "Embed web app" phase copies it into the bundle as `web/apple-health.png` (served at `interun://app/apple-health.png`
  by the scheme handler, over-the-air page or not); `WebHost` sets `window.__interunAppleHealthIcon = "apple-health.png"`
  only when that file is in the bundle; `nativeHealthIcon()` draws `<img class="cn-logo" src="apple-health.png" alt="">`
  only in the native app and only for exactly that value, else the heart tile. `.cn-logo` is 34 px like the tiles, with
  no tile, border, shadow or corner of ours (HIG). A build without the file — anyone else's checkout — shows the heart.
- **Not changed, by the brands' rules:** Apple Watch, "Garmin, Coros & others" and the calendar row keep the app's own
  glyphs and the names in text. Garmin's tile can come once Garmin licenses a live integration.
- **Guard: `test/brand-marks.test.ts`** — both Strava strings against the SHA-256 of Strava's files (newlines removed); the
  Strava row carries both colours with the right classes and the theme rules in the right order; the Health icon only
  with the native flag set to exactly the file name (web, older build, a different name, a `javascript:` URL and a
  number all get the heart); `.cn-logo` the tiles' size with no tile; the icon's bytes nowhere in the page (as base64) or
  under `docs/` (by hash, any image name) on a Mac that holds it; gitignored and untracked; the build phase and WebHost
  wiring. Re-broken five ways, each caught by its own test: one coordinate of the orange artwork nudged, the dark swap
  removed, the native check removed, the icon copied into `docs/`, the Swift flag dropped.
