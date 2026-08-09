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

type Env = StravaEnv & {
  ANTHROPIC_API_KEY: string;
  /** Comma-separated origins allowed to call this Worker. */
  ALLOWED_ORIGINS?: string;
};

type Ask = {
  question?: string;
  context?: Record<string, unknown>;
  history?: Array<{ role: string; text?: string; html?: string }>;
};

const MODEL = "claude-opus-4-8";

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env, request.headers.get("origin"));

    // Strava first: it owns /strava/*, and returns null for everything else so the root stays Alfie's.
    const strava = await stravaRoute(request, env, headers);
    if (strava) return strava;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers });

    let body: Ask;
    try {
      body = (await request.json()) as Ask;
    } catch {
      return Response.json({ error: "bad json" }, { status: 400, headers });
    }

    const question = String(body.question || "").slice(0, 2000).trim();
    if (!question) return Response.json({ error: "no question" }, { status: 400, headers });

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
        max_tokens: 1024,
        // effort "low" keeps replies snappy on a phone; raise to "medium" if answers feel shallow.
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: "The runner's current plan context (JSON):\n" + JSON.stringify(body.context ?? {}) },
        ],
        messages: [...history, { role: "user", content: question }],
      });

      if (response.stop_reason === "refusal") {
        return Response.json({ answer: "I can't help with that one — try asking me about your training." }, { headers });
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
