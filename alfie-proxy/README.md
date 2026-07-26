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
