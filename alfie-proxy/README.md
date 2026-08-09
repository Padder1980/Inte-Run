# Alfie proxy — optional "real AI" brain for Ask Alfie

**You do not need this.** Ask Alfie already works in the app with on-device answers: it reads your
real plan (next session, paces, phase, race date) and covers the running fundamentals. That path is
free, private, offline, and needs no key.

Deploy this only when you want Alfie to handle **open-ended** conversation — anything outside the
authored topics, and proper follow-up questions.

## Why a proxy at all?

InteRun is a **public** static site on GitHub Pages. An Anthropic API key placed in it would be
readable by anyone viewing source, and they could spend your money. So the key lives here instead,
in a Cloudflare Worker you own. The app calls the Worker; the Worker calls Claude.

```
phone (public page)  →  your Worker (holds the key)  →  Claude API
```

## Deploy (about 10 minutes)

Prerequisites: a Cloudflare account (the free tier is fine) and an Anthropic API key with billing.

```bash
cd alfie-proxy
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY     # paste your key when prompted — never commit it
npx wrangler deploy
```

Deploy prints a URL like `https://alfie-proxy.<your-subdomain>.workers.dev`.

**Lock it down to your site** (otherwise anyone can use your key via your Worker). Set the allowed
origins, then redeploy:

```bash
npx wrangler secret put ALLOWED_ORIGINS       # e.g. https://padder1980.github.io
```

## Point the app at it

In the app, open the browser console on the deployed site and run:

```js
localStorage.setItem('interun_alfie_v1', JSON.stringify({ proxy: 'https://alfie-proxy.<you>.workers.dev' }))
```

Reload. Ask Alfie now routes questions to Claude, and **falls back to the on-device answer** if the
Worker is unreachable, errors, or you're offline — so Alfie always replies.

To go back to on-device only: `localStorage.removeItem('interun_alfie_v1')`.

## What it sends

The question, a short conversation history, and a small JSON summary of your plan (goal, race date,
current week/phase, your paces, today's session). No name, no location, no health check-in data.

## Cost

Billed per message against your own Anthropic account. Answers are capped at ~1024 output tokens and
run at `effort: "low"` to stay quick and cheap on a phone. The system prompt is cached, so repeat
questions in a session cost less. Watch your usage in the Anthropic console.

## Notes

- Model: `claude-opus-4-8`.
- Safety: the system prompt routes pain/injury/health and crisis topics to professional help rather
  than coaching them. The **app's own** safety routing runs first and independently of this proxy —
  red-flag symptoms are handled on-device by the training engine's escalation screen and never
  depend on the network.

---

# Strava — the same Worker, a second job

This Worker also holds the **Strava** connection, for the same reason it holds the Anthropic key: the
Strava **client secret** authorises Inte-Run to act on a runner's account, so it behaves like a
password. It cannot live in a public page, and it cannot ship inside the native app either — anyone can
read the strings out of an installed app.

```
phone  →  your Worker (holds the client secret AND the runner's tokens)  →  Strava
```

**The app never sees a Strava token.** The page generates a random 32-byte *device key*, the Worker maps
that key to the tokens in KV, and the tokens never cross back. A leaked device key is revocable and
useless against Strava directly; a leaked refresh token is neither.

The two halves are independent — Alfie works with no Strava credentials set, and Strava works with no
Anthropic key. `POST /` stays Alfie's; Strava lives under `/strava/*`.

## Deploy (about 15 minutes)

Prerequisites: a Cloudflare account (free tier is fine) and a Strava API application.

**1. Create the token store.** Copy the `id` it prints into `wrangler.toml`, replacing the placeholder
— a placeholder deploys cleanly and then fails at runtime with "not configured", which reads as a bug
in the app.

```bash
cd alfie-proxy && npm install && npx wrangler login && npx wrangler kv namespace create STRAVA
```

**2. Deploy once, to find out your Worker's address.**

```bash
npx wrangler deploy
```

It prints something like `https://alfie-proxy.<your-subdomain>.workers.dev`. You need that next.

**3. Register it with Strava.** At <https://www.strava.com/settings/api>, set
**Authorization Callback Domain** to your Worker's host **only** — `alfie-proxy.<your-subdomain>.workers.dev`,
with no `https://`, no path, no trailing slash. Strava refuses any redirect outside that domain, and the
error it gives back does not say that clearly.

**4. Give the Worker the credentials** from `strava-secret.txt` (gitignored, in the repo root), then
redeploy:

```bash
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
npx wrangler secret put ALLOWED_ORIGINS      # https://padder1980.github.io
npx wrangler deploy
```

**5. Point the app at it.** In Inte-Run: **Support › Apps & devices › Strava**, paste the Worker URL,
then **Connect to Strava**. (The paste box only appears in a browser, or once a server has already been
set here — a TestFlight tester is never asked for a URL they have never heard of.) Consent opens in
Safari; come back to the app and it picks up the connection on its own.

Then open any run in the Logbook and tap **Send to Strava**.

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
