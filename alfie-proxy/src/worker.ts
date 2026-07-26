/**
 * Alfie proxy — the optional "real AI" brain for Ask Alfie.
 *
 * WHY THIS EXISTS: InteRun is a public static site. An Anthropic API key cannot live in it — anyone
 * could read the page source and spend your money. This tiny Worker holds the key server-side; the
 * app POSTs a question plus the user's plan context, and gets back plain text.
 *
 * The app works fine WITHOUT this: Ask Alfie falls back to its on-device answers. Deploy this only
 * if you want open-ended conversation. See ../README.md.
 */
import Anthropic from "@anthropic-ai/sdk";

type Env = {
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

function cors(env: Env, origin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && (allowed.length === 0 || allowed.includes(origin));
  return {
    "access-control-allow-origin": ok && origin ? origin : allowed[0] || "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env, request.headers.get("origin"));
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
