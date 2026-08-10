/**
 * Inte-Run's server — the one place a secret can live.
 *
 * WHY THIS EXISTS: InteRun is a public static site, and a native app whose strings anyone can read.
 * Neither can hold a credential. This Worker holds them instead, and it now does two unrelated jobs
 * for that one reason:
 *
 *   POST /            → Ask Alfie's optional "real AI" brain (holds the Anthropic API key)
 *   /strava/*         → the Strava token holder (holds the Strava client secret + the runner's tokens)
 *
 * ⚠️ THE ROOT PATH IS ALFIE'S AND MUST STAY THAT WAY. The app POSTs to the bare proxy URL it was
 * given (`fetch(cfg.proxy, …)` in web/app.ts), so moving Alfie to /alfie would silently break every
 * install already configured. New jobs get a path; the original keeps the root.
 *
 * Either half works without the other: Ask Alfie falls back to its on-device answers, and Strava is
 * simply not offered when its credentials are absent. See ../README.md.
 */
import Anthropic from "@anthropic-ai/sdk";
import { stravaRoute, type StravaEnv } from "./strava.ts";

/** Cloudflare's own rate-limit binding — accurate at seconds resolution, unlike KV. */
type RateLimiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };

type Env = StravaEnv & {
  ANTHROPIC_API_KEY: string;
  /** Burst protection. Absent in older deploys, so every use is guarded. */
  BURST?: RateLimiter;
  /** Comma-separated origins allowed to call this Worker. */
  ALLOWED_ORIGINS?: string;
};

type Ask = {
  question?: string;
  context?: Record<string, unknown>;
  history?: Array<{ role: string; text?: string; html?: string }>;
  /** An opaque per-install id, used only to bound how much one device can spend. Not a credential. */
  device?: string;
};

const MODEL = "claude-opus-5";

/**
 * ⚠️ THIS CEILING COVERS THINKING *AND* THE ANSWER, and that is why it is not 1024.
 * On claude-opus-5 thinking is ON whenever the request omits a `thinking` field — a silent change
 * from claude-opus-4-8, where omitting it meant no thinking at all. `max_tokens` caps the two
 * together, so the 1024 this shipped with would have been spent reasoning and then truncated Alfie
 * mid-sentence. Nothing errors; the runner just gets a cut-off answer.
 *
 * ⚠️ AND THINKING IS DELIBERATELY LEFT ON rather than disabled to save the tokens. With
 * `thinking: {type: "disabled"}` this model occasionally leaks its internal `<thinking>` tags into
 * the visible reply — which here means straight into a coaching answer a runner reads. Lower effort
 * is the cheap lever; disabling thinking is not.
 *
 * Only generated tokens are billed, so a generous ceiling costs nothing on a short answer.
 */
const MAX_TOKENS = 4096;

const SYSTEM = [
  "You are Alfie, the coaching assistant inside InteRun — an evidence-based running-coach app.",
  "",
  "Voice: warm, direct, and concrete. Short paragraphs. No emoji, no bullet-point spam, no hype.",
  "Talk like an experienced coach who respects the runner's time — lead with the answer, then the why.",
  "",
  "You are given the user's ACTUAL training plan as JSON context. Use it: reference their real",
  "sessions, paces, phase and race when it's relevant, and never invent numbers that aren't there.",
  "If the context doesn't contain something, say so rather than guessing.",
  "",
  "Ground advice in mainstream endurance-training evidence (easy running is most of the volume,",
  "threshold and intervals are the quality, consistency beats heroics, sleep and fuelling matter).",
  "",
  "SAFETY — this matters more than being helpful:",
  "- You are not a doctor and must not diagnose. For pain, injury or health symptoms, give general",
  "  guidance and point the user to a qualified professional and to Support in the app.",
  "- If the user mentions chest pain, fainting, severe breathlessness, neurological symptoms, or",
  "  possible bone/stress-fracture pain, tell them to stop running and seek prompt medical review.",
  "- If the user mentions self-harm, suicide, or an eating disorder, respond with warmth and brevity,",
  "  and direct them to urgent crisis support or a doctor. Do not coach them on training.",
  "",
  "Keep replies under about 180 words unless the question genuinely needs more.",
].join("\n");

/**
 * ⚠️ THE NATIVE APP'S ORIGIN IS NOT AN HTTPS ONE. Inte-Run serves its page over `interun://app` so
 * that WKWebView will allow fetch() at all, and that is the Origin its requests carry — so an
 * allow-list of https origins locks the native app out of its own server. It is always allowed.
 *
 * ⚠️ AND A CUSTOM SCHEME MAY SEND NO ORIGIN AT ALL, which is why a missing one falls through to `*`.
 * That is deliberate and it is not the security boundary: every Strava route is authorised by the
 * device key in the request itself, which a hostile page cannot obtain by being able to call this.
 */
const APP_ORIGIN = "interun://app";

function cors(env: Env, origin: string | null): Record<string, string> {
  const configured = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  // With no ALLOWED_ORIGINS set, any origin is allowed — the same open default this Worker shipped
  // with, so an existing Alfie deploy behaves exactly as before until its owner locks it down.
  const ok = !origin || configured.length === 0 || origin === APP_ORIGIN || configured.includes(origin);
  return {
    "access-control-allow-origin": ok ? (origin || "*") : (configured[0] || "*"),
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
  };
}

/**
 * How many questions one device may ask, and how many the whole app may ask in a day.
 *
 * ⚠️ THIS IS A PUBLIC URL SPENDING THE OWNER'S OWN MONEY, and that makes it a different risk from
 * the Strava half. A Strava device key is useless to a stranger — it can only push runs into the
 * account that granted it. An Alfie question costs real money on the owner's Anthropic account, so
 * anyone who finds this address can spend it, and ALLOWED_ORIGINS does not stop them: CORS is a
 * browser rule, and curl has never heard of it.
 *
 * ⚠️ THE DAILY CEILING IS THE ONE THAT MATTERS. Per-device limits bound an honest runner; only a
 * global cap bounds a stranger with a script, who can mint a fresh device id per request. Crossing
 * it degrades Alfie to the on-device answers, which is the same thing that happens offline — a
 * capped feature, not a broken one, and never a surprise bill.
 */
// ⚠️ THESE ARE PRICED, NOT PICKED. Measured shape of one Alfie question on claude-opus-5: roughly
// 2,000 input tokens (system prompt + plan context + a little history) and ~600 output including
// thinking at low effort — about 2.5p at $5/$25 per million. So the GLOBAL cap IS the monthly bill:
// the 1500/day first written here was ~£30 a day, or ~£900 a month if anyone ever maxed it, which is
// not a hobby-project number. At 200 the worst case is ~£4 a day, and ten testers asking a handful of
// questions each lands nearer 30.
// ⚠️ AND THE REAL CEILING IS HIGHER THAN THESE NUMBERS because KV counts with lag (see overLimit) —
// treat them as approximate, and read the actual spend in the Anthropic console for the truth.
const PER_DEVICE_HOURLY = 15;
const PER_DEVICE_DAILY = 40;
const GLOBAL_DAILY = 200;

/** Counters live in the KV namespace the Strava tokens already use, with a TTL so they self-clear. */
let burstFault: string | null = null;
async function overLimit(env: Env, device: string): Promise<string | null> {
  // ⚠️ THE BURST CHECK COMES FIRST AND IS THE ONLY ACCURATE ONE. KV's counters below lag by up to a
  // minute, so on their own they let a rapid script through — measured, 31 requests in seconds left a
  // KV counter reading 21 and tripped nothing. This binding is exact.
  if (env.BURST) {
    try {
      const { success } = await env.BURST.limit({ key: device });
      if (!success) return "burst";
    } catch (e) {
      // ⚠️ NOT SWALLOWED. A silent catch here would report protection that is not there — the exact
      // failure mode this Worker has already shipped once (a deploy with no credentials that looked
      // healthy). The reason is recorded so Support can show whether the burst guard is live.
      burstFault = e instanceof Error ? e.message : String(e);
    }
  }
  if (!env.STRAVA) return null;   // no store bound: fail open rather than break Alfie
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);
  // ⚠️ Hashed, so a dump of the store cannot be tied back to a device.
  const id = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("alfie:" + device)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

  const buckets: Array<[string, number, number, string]> = [
    ["rl:h:" + id + ":" + hour, PER_DEVICE_HOURLY, 3900, "hourly"],
    ["rl:d:" + id + ":" + day, PER_DEVICE_DAILY, 90000, "daily"],
    ["rl:all:" + day, GLOBAL_DAILY, 90000, "global"],
  ];
  for (const [key, cap, ttl, label] of buckets) {
    const used = Number((await env.STRAVA.get(key)) || "0");
    if (used >= cap) return label;
    // ⚠️ NOT ATOMIC, AND THAT IS ACCEPTED. KV has no counter primitive, so two simultaneous
    // questions can both read the same value and each write used+1, losing one increment. The cap is
    // a spend bound, not an access-control decision — a few over on a burst is fine, and the
    // alternative (Durable Objects) is real complexity for a budget guard.
    await env.STRAVA.put(key, String(used + 1), { expirationTtl: ttl });
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env, request.headers.get("origin"));

    // Strava first: it owns /strava/*, and returns null for everything else so the root stays Alfie's.
    const strava = await stravaRoute(request, env, headers);
    if (strava) return strava;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    // A health probe: says whether Alfie has a key and whether the burst guard is live, without
    // spending a question. Reports presence, never the key itself.
    if (request.method === "GET") {
      return Response.json({
        alfie: env.ANTHROPIC_API_KEY ? "configured" : "no key",
        burstGuard: env.BURST ? (burstFault ? "failing: " + burstFault : "bound") : "absent",
        budgetStore: env.STRAVA ? "bound" : "absent",
      }, { headers });
    }
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers });

    let body: Ask;
    try {
      body = (await request.json()) as Ask;
    } catch {
      return Response.json({ error: "bad json" }, { status: 400, headers });
    }

    const question = String(body.question || "").slice(0, 2000).trim();
    if (!question) return Response.json({ error: "no question" }, { status: 400, headers });

    // ⚠️ CHECKED BEFORE THE MODEL IS CALLED, which is the whole point — after it, the money is spent.
    // A 429 sends the app to its own on-device answer, so a throttled runner still gets a reply.
    const limited = await overLimit(env, String(body.device || "anonymous"));
    if (limited) return Response.json({ error: "rate limited", scope: limited }, { status: 429, headers });

    // Replay a little history so follow-ups ("what about tomorrow?") make sense. The app sends its
    // own rendered HTML for Alfie turns, so strip tags before handing them back to the model.
    const history = (body.history || []).slice(-8).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(m.text ?? m.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200),
    })).filter((m) => m.content);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // effort "low" keeps replies snappy on a phone; raise to "medium" if answers feel shallow.
        // On this model low and medium are unusually strong, so low is a real setting here rather
        // than a compromise — and it is the lever for cost, not max_tokens.
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: "The runner's current plan context (JSON):\n" + JSON.stringify(body.context ?? {}) },
        ],
        messages: [...history, { role: "user", content: question }],
      });

      // ⚠️ A REFUSAL HANDS THE QUESTION BACK TO THE APP RATHER THAN ANSWERING IT.
      // Checked before reading response.content, which is empty on a pre-output refusal — code that
      // indexes content[0] unconditionally breaks here. Returning a non-200 is deliberate: it sends
      // the app to alfieLocalAnswer, and for a running app the curated on-device answer is usually
      // better than a canned apology. This is also why no server-side model fallback is configured —
      // the fallback that fits best is the one the app already has.
      if (response.stop_reason === "refusal") {
        return Response.json({ error: "refused" }, { status: 502, headers });
      }
      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (!answer) return Response.json({ error: "empty" }, { status: 502, headers });
      return Response.json({ answer }, { headers });
    } catch (err) {
      // The app falls back to its on-device answer on any non-200, so fail quietly and clearly.
      const status = err instanceof Anthropic.APIError ? err.status ?? 502 : 502;
      return Response.json({ error: "upstream" }, { status, headers });
    }
  },
};
