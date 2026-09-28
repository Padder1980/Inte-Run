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
