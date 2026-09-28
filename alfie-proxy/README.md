# Inte-Run's server — Ask Alfie's online answers, and Strava

One Cloudflare Worker with two jobs. The app has this Worker's address built in (`ALFIE_SERVER` and
`STRAVA_SERVER` in `web/app.ts`), so nothing needs pasting on a phone.

⚠️ **What this Worker receives and keeps is published in the privacy policy** (`docs/privacy/`), and
`test/privacy-copy.test.ts` holds the two together. Change what it stores or where it sends anything,
and the policy has to change in the same commit, or the suite fails.

## Ask Alfie's online answers (`POST /`)

Ask Alfie answers on the phone by default. **Online answers are off until the runner says yes** (at
every age: App Review guideline 5.1.2(i)), and a runner under 13 cannot switch them on at all. Questions
that mention a serious warning sign (chest pain, fainting, thoughts of self-harm and similar) are
answered on the phone and never sent, whatever the switch says.

```
phone  →  this Worker  →  Cloudflare Workers AI (env.AI)
```

- **Brain:** `BRAIN = "cloudflare"` in `src/worker.ts`, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  (`CF_MODEL`), replies capped at 700 tokens. It runs on the Workers Free plan's daily allowance: no key,
  no card, and past the allowance requests simply fail and the app answers on the phone instead.
  Switching `BRAIN` to `"claude"` (model `claude-opus-5`) needs `npx wrangler secret put ANTHROPIC_API_KEY`
  and a billing account, and every sentence that names the AI company has to change with it.
- **What arrives:** the question, a short plan summary (goal, race date and target, week and phase, the
  week's distance, easy/threshold/goal paces, today's session, experience, days per week — no name, age
  or location), up to eight earlier turns that already reached this Worker, and a random per-install id.
- **What is kept:** nothing of the question or the answer. The per-install id is only ever stored as a
  SHA-256 hash, inside rate-limit counters that delete themselves (`expirationTtl` 3,900 s for the hourly
  count, 90,000 s for the daily ones).
- **Limits:** a burst guard of 12 a minute per install (Cloudflare's own rate-limit binding), then 15 an
  hour and 40 a day per install, and 200 a day for the whole app (KV counters, approximate by design).
  `ALLOWED_ORIGINS` is not a lock: the native app's `interun://app` origin and requests with no origin are
  always allowed, and curl ignores CORS. The limits are what cap use.

A `GET /` reports the brain and whether the burst guard and the counter store are bound, without
spending a question.

## Deploy

```bash
cd alfie-proxy
npx wrangler login          # opens a browser; click Allow within about two minutes
CI=1 WRANGLER_SEND_METRICS=false npx --no-install wrangler deploy
```

---

# Strava — the same Worker, a second job

This Worker also holds the **Strava** connection, because the
Strava **client secret** authorises Inte-Run to act on a runner's account, so it behaves like a
password. It cannot live in a public page, and it cannot ship inside the native app either — anyone can
read the strings out of an installed app.

```
phone  →  your Worker (holds the client secret AND the runner's tokens)  →  Strava
```

**The app never sees a Strava token.** The page generates a random 32-byte *device key*, the Worker maps
that key to the tokens in KV, and the tokens never cross back. The record (`tok:<sha256("interun-strava:" + key)>`)
holds the tokens, the granted scope and the account's first name, and nothing else since Y6. It deletes
itself a year after it was last written (`CONNECTION_TTL_SECONDS`), and Disconnect deletes it at once and
tells Strava to revoke access. A leaked device key is revocable and
useless against Strava directly; a leaked refresh token is neither.

The two halves are independent — Alfie works with no Strava credentials set, and Strava works with no
Anthropic key. `POST /` stays Alfie's; Strava lives under `/strava/*`.

## Deploy — the short way

Prerequisites: a Cloudflare account (free tier is fine) and the Strava API application already
registered (its credentials are in gitignored `strava-secret.txt` in the repo root).

**Step 1 — sign in to Cloudflare.** This one has to be done by hand; it opens a browser.

```bash
cd alfie-proxy && npm install && ./node_modules/.bin/wrangler login
```

**Step 2 — run the setup script.** It creates the token store, writes its id into `wrangler.toml`,
sends Cloudflare the Strava credentials, deploys, and then prints the two things left to paste.

```bash
./alfie-proxy/setup-strava.sh
```

⚠️ The script never prints a secret, never writes one to disk, and is safe to re-run — an existing
token store is reused rather than replaced, because replacing it would sign out every runner who had
already connected.

**Steps 3 and 4** are the two the script prints for you: paste the Worker's **host** into Strava's
*Authorization Callback Domain* at <https://www.strava.com/settings/api>, and paste the Worker's
**full URL** into `STRAVA_SERVER` in `web/app.ts` if it has changed (the paste box in *Support › Apps &
devices › Strava* shows only in developer mode). Then tap **Connect to Strava**.

⚠️ The callback domain is the **host only** — no `https://`, no path, no trailing slash. Strava
refuses any redirect outside it and the error it returns does not say so clearly.

Consent opens in Safari; come back to the app and it picks the connection up on its own. Then open any
run in the Logbook and tap **Send to Strava**.

## Deploy — by hand, if the script fails

```bash
cd alfie-proxy && npm install
./node_modules/.bin/wrangler login
./node_modules/.bin/wrangler kv namespace create STRAVA   # paste the id into wrangler.toml
./node_modules/.bin/wrangler secret put STRAVA_CLIENT_ID
./node_modules/.bin/wrangler secret put STRAVA_CLIENT_SECRET
./node_modules/.bin/wrangler secret put ALLOWED_ORIGINS   # https://padder1980.github.io
./node_modules/.bin/wrangler deploy
```

⚠️ The `id` in `wrangler.toml` ships as a **placeholder**. Left as it is, the Worker deploys perfectly
cleanly and then answers every request with "not configured" — which reads as a bug in the app.

⚠️ **`wrangler whoami` exits 0 even when it is telling you "You are not authenticated"**, so a script
guarding on its exit code sails straight past. Read its output instead. (`setup-strava.sh` does.)

⚠️ **npm 11 blocks install scripts by default**, so `npm install` prints an `allow-scripts` warning for
`esbuild` and `workerd`. Wrangler and `deploy` both work anyway — verified with `wrangler deploy
--dry-run`. Only `wrangler dev` (the local server) needs `workerd`, and if you want it:
`npm approve-scripts --allow-scripts-pending`.

## What it asks Strava for

`activity:write`, and nothing else. That is the only scope that permits an upload or a manual activity.
Most tutorials also request `activity:read_all`, which would hand this Worker the runner's entire
private history including their privacy zones — to push one run.

## What gets sent

- A run **with timed GPS points** goes as a **GPX** file, so Strava derives the map, splits and pace.
- A run **without** one (treadmill, GPS refused, or anything recorded before the app stamped times on
  route points) goes as a **manual activity** carrying its real distance and time.

⚠️ It never invents the missing half. Spreading a run's total time evenly across the points it happens
to have would draw a perfectly even run that never happened, in somebody's training log, under their
name. `test/strava-payload.test.ts` and `test/strava-connect.test.ts` exist to keep that true.

## Verifying a change to this Worker

⚠️ **The repo's `npx tsc --noEmit` does NOT cover `alfie-proxy/`** — its tsconfig `include` is
`src`, `test`, `demo`. A type error here reaches you at deploy time, not before. Check it by hand:

```bash
npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --lib es2023,dom --allowImportingTsExtensions alfie-proxy/src/strava.ts
```

`worker.ts` additionally needs `npm install` inside `alfie-proxy/` for the Anthropic SDK's types.

The behaviour of both files is asserted from the repo's own suite (`node --test`), which reads them as
source — so the rules that matter (one scope, the granted scope checked, the device key hashed, a
duplicate treated as success, no token ever returned to the client) are covered without a deploy.
