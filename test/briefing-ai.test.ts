import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

/**
 * STAGE B11 — EXPAND WITH ALFIE (PLAN.md): B10's fact packs, written up by the AI through Inte-Run's server, gated.
 * The server half is RUN here (its fetch handler, with Cloudflare's AI and the KV store stood in); the app half is the
 * real code lifted from the built page, over the real engine, with the network stood in.
 */

/* ---- the server -------------------------------------------------------------------------------- */

const WORKER: any = (await import("../alfie-proxy/src/worker.ts")).default;
const WORKER_SRC = readFileSync(new URL("../alfie-proxy/src/worker.ts", import.meta.url), "utf8");
function server(reply = "Easy today: 40 minutes, keep it conversational.") {
  const kv = new Map<string, string>();
  const ai: any[] = [];
  const env: any = {
    AI: { run: async (_m: string, input: any) => { ai.push(input); return { response: reply }; } },
    STRAVA: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); } },
  };
  const post = async (body: unknown) => {
    const r = await WORKER.fetch(new Request("https://proxy.test/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env);
    return { status: r.status, json: await r.json() };
  };
  const get = async () => (await WORKER.fetch(new Request("https://proxy.test/", { method: "GET" }), env)).json();
  return { env, kv, ai, post, get };
}
const FACTS = { kind: "briefing", when: "Tomorrow", title: "Easy run", length: "40 minutes", main: { steady: "6:02–6:25/km · RPE 3–4" } };

test("BLOCKER: the server writes a briefing or an insight up from the facts alone — its own branch, before the question check", async () => {
  const s = server();
  for (const mode of ["briefing", "insight"]) {
    const r = await s.post({ mode, context: FACTS, device: "d-" + mode });
    assert.equal(r.status, 200, mode + ": " + JSON.stringify(r.json));
    assert.ok(r.json.text, "no text in the reply");
    const input = s.ai[s.ai.length - 1];
    const sys = input.messages.filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n");
    assert.match(sys, /Use ONLY the numbers that appear in the facts/, "the model is not told to use only the facts' numbers");
    assert.match(sys, /at most 80 words/);
    assert.match(sys, /Do not diagnose/);
    assert.match(sys, /never change anything/);
    assert.ok(sys.includes(JSON.stringify(FACTS)), "the facts did not reach the model");
    assert.equal(input.messages[input.messages.length - 1].role, "user");
    assert.ok(!JSON.stringify(input.messages).includes("question"), "an expansion carried a question");
  }
  assert.equal((await s.post({ mode: "diary", context: FACTS })).status, 400, "an unknown mode was written up");
  assert.equal((await s.post({ mode: "briefing" })).status, 400, "an expansion with no facts was written up");
  assert.equal((await s.post({ mode: "briefing", context: { pad: "x".repeat(5000) } })).status, 413, "an oversized pack was accepted");
  // The ordinary question path is untouched: no mode, no question, still a 400.
  assert.equal((await s.post({ device: "x" })).status, 400);
  // When the brain moves to Claude, an expansion is written by Haiku (PLAN.md).
  assert.match(WORKER_SRC, /const EXPAND_MODEL = "claude-haiku-4-5-20251001";/);
  const exp = WORKER_SRC.slice(WORKER_SRC.indexOf("async function expand("), WORKER_SRC.indexOf("export default {"));
  assert.match(exp, /model: EXPAND_MODEL,/, "the expansion does not use the small model");
});

test("BLOCKER: expansions have their own budget — three a day a phone, forty for everyone — checked before the model, and reported", async () => {
  const s = server();
  for (let i = 0; i < 3; i++) assert.equal((await s.post({ mode: "briefing", context: FACTS, device: "one" })).status, 200);
  const before = s.ai.length;
  const fourth = await s.post({ mode: "briefing", context: FACTS, device: "one" });
  assert.equal(fourth.status, 429); assert.equal(fourth.json.scope, "daily");
  assert.equal(s.ai.length, before, "the model ran for an expansion over the budget");
  // A phone's questions are not spent by its expansions.
  assert.equal((await s.post({ question: "How is my week?", device: "one" })).status, 200, "expansions used up the runner's questions");
  // Everybody's day: forty, however many devices a stranger mints.
  const g = server();
  let ok = 0, last: any = null;
  for (let i = 0; i < 45; i++) { last = await g.post({ mode: "insight", context: FACTS, device: "dev" + i }); if (last.status === 200) ok++; }
  assert.equal(ok, 40, "the global cap let " + ok + " through");
  assert.equal(last.json.scope, "global");
  // GET / says what the server can write up and its limits, so the app can ask before offering.
  const h = await s.get();
  assert.deepEqual(h.expand, ["briefing", "insight"]);
  assert.equal(h.expandDaily.device, 3); assert.equal(h.expandDaily.global, 40);
  assert.equal(h.expandDaily.usedToday, 3);
});

/* ---- the app ----------------------------------------------------------------------------------- */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const html = readFileSync(PAGE, "utf8");
const marker = html.indexOf("function expandBrief(");
assert.ok(marker >= 0, "expandBrief is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", marker) + 8, html.indexOf("</script>", marker));
function fnBody(name: string): string | null {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string | null {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  if (at < 0) return null;
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  return null;
}
const decomment = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");
const DECL = new Set<string>([...SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]!));
/** The B11 functions and everything they call, lifted in declaration order (the heat-custom lifter). */
const ROOTS = ["briefingCardHtml", "briefingFacts", "rdReactHtml", "insightFacts", "runAnalysis", "runVerdict", "expandBrief",
  "expandReplyOk", "expandFactsFor", "alfieExpand", "alfieExpandProbe", "expandBtnHtml", "expandVerHtml", "loadBriefs", "alfieOnline"];
const STUB = new Set(["PLAN", "RAW", "RC", "syncWatch", "syncNativeReminders", "render", "toast", "reopenSessionSheet", "fetch"]);
function lift() {
  const CONSTAT = new Map<string, number>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)(?: = |, )/gm)) if (!CONSTAT.has(m[1]!)) CONSTAT.set(m[1]!, m.index!);
  const OWNER = new Map<string, string>();
  for (const m of SRC.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = [^\n]*$/gm)) {
    for (const d of m[0].matchAll(/(?:^(?:const|let) |, )([A-Za-z_$][\w$]*) = /g)) OWNER.set(d[1]!, m[1]!);
  }
  const fns = new Set<string>(), q = [...ROOTS], cq: string[] = [], seenC = new Set<string>(), stmts = new Map<string, number>();
  const scan = (text: string) => {
    for (const m of decomment(text).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) { if (DECL.has(m[1]!)) q.push(m[1]!); else if (CONSTAT.has(m[1]!)) cq.push(m[1]!); }
  };
  while (q.length || cq.length) {
    while (q.length) {
      const n = q.pop()!;
      if (fns.has(n) || STUB.has(n)) continue;
      const b = fnBody(n);
      assert.ok(b != null, "dependency is not a top-level function: " + n);
      fns.add(n); scan(b!);
    }
    while (cq.length) {
      const c = cq.pop()!;
      if (seenC.has(c) || STUB.has(c)) continue;
      seenC.add(c);
      const st = constStmt(OWNER.get(c) || c);
      assert.ok(st != null, "const not found in the build: " + c);
      if (!stmts.has(st!)) { stmts.set(st!, SRC.indexOf(st!)); scan(st!); }
    }
  }
  const ordered = [...stmts.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  return "let PLAN = { weeks: [] }, RAW = { weeks: [], paces: {} };\n" +
    "const syncWatch = () => {}, syncNativeReminders = () => {};\n" +
    ordered.join("\n") + "\n" + [...fns].map((n) => fnBody(n)).join("\n") + "\n" +
    "return { " + [...fns].join(", ") + ", __set: (p, r) => { PLAN = p; RAW = r; }, __state: () => state, __profile: () => profile," +
    " __expand: (v) => { ALFIE_EXPAND = v; ALFIE_EXPAND_ASKED = v !== null; }, __packs: () => EXPAND_PACKS };";
}
const LIFTED = lift();

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monday = (s: string) => addDays(s, -((new Date(s + "T00:00:00Z").getUTCDay() + 6) % 7));
const tick = () => new Promise((r) => setTimeout(r, 0));

/** An app with a plan, Ask Alfie online on (or not), and a network that answers as told. */
function app(o: { online?: boolean; age?: number; reply?: any; modes?: string[] | false } = {}) {
  const store = new MemStore();
  store.setItem("rc_profile_v1", JSON.stringify({ status: "regular", goalDist: "10k", personalized: true, ...(o.age ? { age: o.age } : {}) }));
  store.setItem("interun_alfie_v1", JSON.stringify({ proxy: "https://proxy.test", device: "dev-1", online: o.online !== false }));
  const net: any[] = [];
  const toasts: string[] = [];
  const fetch = async (url: string, init: any = {}) => {
    net.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if ((init.method || "GET") === "GET") return { ok: true, status: 200, json: async () => (o.modes === false ? { brain: "cloudflare" } : { expand: o.modes || ["briefing", "insight"] }) };
    const r = o.reply ?? { status: 200, body: { text: "Easy today." } };
    return { ok: r.status === 200, status: r.status, json: async () => r.body };
  };
  const athlete = { experience: "recreational", daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 } } as unknown as Athlete;
  const goal = { distance: "10k", targetTimeSeconds: 2700, raceDateIso: addDays(monday(TODAY), 7 * 12 + 6), startDateIso: monday(TODAY) } as unknown as Goal;
  const plan = generatePlan(athlete, goal, {});
  const raw = { weeks: plan.weeks, paces: deriveTrainingPaces(athlete.recent!) };
  const view = { weeks: plan.weeks.map((w: any, i: number) => ({ index: i + 1, startIso: monday(w.startDateIso), phase: w.phase, isDeload: w.isDeload, sessions: w.sessions })) };
  const env: Record<string, unknown> = { localStorage: store, RC, navigator: {}, console: { warn: () => {}, log: () => {} }, fetch,
    render: () => {}, reopenSessionSheet: () => {}, toast: (m: string) => toasts.push(m) };
  const names = Object.keys(env);
  const api = new Function(...names, LIFTED)(...names.map((n) => env[n]));
  api.__set(view, raw);
  const st = api.__state();
  st.logged = []; st.hist = []; st.subj = { soreness: "none", energy: "good", stress: "low", motivation: "high", illness: "none" };
  st.subjAnswered = false; st.subjAt = 0; st.wxHours = null; st.wx = null;
  const sess: any = raw.weeks[0]!.sessions.find((s: any) => ["easy", "long", "threshold", "vo2"].includes(s.type));
  assert.ok(sess, "the fixture's first week has no run");
  const shown = { durMin: Math.round(sess.estimatedDurationSeconds / 60), dist: null, wuMin: 0, rpe: sess.targetRpe };
  const card = () => api.briefingCardHtml(sess, TODAY, 1, shown);
  const key = "b|" + sess.id + "|" + TODAY;
  return { api, st, store, net, toasts, sess, shown, card, key, briefs: () => JSON.parse(store.getItem("interun_brief_v1") || "{}") };
}

test("BLOCKER: every number in Alfie's words must be one the facts hold — PLAN.md's own re-break: remove the number filter", () => {
  const a = app();
  const facts = { title: "10 × 1′ hard / 1′ easy", main: { reps: "10 × 1′", target: "4:48–5:02/km" }, week: { n: 4, of: 13 }, length: "46 minutes" };
  const ok = (t: string) => a.api.expandReplyOk(t, facts);
  assert.ok(ok("Ten hard minutes today: 10 × 1′ at 4:48–5:02/km, in week 4 of 13. 46 minutes in all."), "a faithful write-up was refused");
  assert.ok(!ok("Aim for 4:40/km on the reps."), "a pace the facts do not hold got through");
  assert.ok(!ok("It is week 5 of 13."), "a week the facts do not hold got through");
  assert.ok(!ok("About 180 steps a minute is ideal."), "an invented number got through");
  assert.ok(!ok("Heavy legs might mean an injury, so go easy."), "a medical word got through");
  assert.ok(!ok("This could be overtraining."), "a diagnosis got through");
  assert.ok(!ok(""), "an empty reply got through");
  assert.ok(!ok(Array(120).fill("easy").join(" ")), "a 120-word reply got through");
});

test("BLOCKER: what is sent is the pack WITHOUT the runner's health answers — and the morning check-in is never stored at all", () => {
  const a = app();
  const pack = { title: "Easy", ready: { score: "2 out of 5", band: "ease", advice: "Keep it easy." }, pain: true, verdict: "Logged" };
  const sent = a.api.expandFactsFor(pack);
  assert.ok(!("ready" in sent) && !("pain" in sent), "a health answer would be sent");
  assert.equal(sent.verdict, "Logged");
  assert.ok("ready" in pack, "the pack on screen lost its readiness");
  // ⚠️ B10's cache held "you rated yourself 2 out of 5" — the check-in is promised to be kept nowhere (DPIA Step 6).
  a.st.subj.soreness = "high"; a.st.subj.energy = "low"; a.st.subjAnswered = true; a.st.subjAt = Date.now();
  const card = a.card();
  assert.match(card, /This morning you rated yourself/, "the check-in line is no longer on screen");
  const stored = JSON.stringify(a.briefs());
  assert.ok(!/rated yourself|out of 5|"ready"/.test(stored), "the morning check-in was stored: " + stored.slice(0, 300));
  assert.ok(!("ready" in a.api.__packs()[a.key]), "the pack Alfie would be sent carries the check-in");
});

test("BLOCKER: Expand with Alfie is offered only with online answers on, a server that knows the mode, and once", async () => {
  // Online answers off (the runner never said yes): never offered, and nothing is asked of the server.
  const off = app({ online: false });
  off.api.alfieExpandProbe();
  assert.ok(!/data-expand/.test(off.card()), "offered with online answers off");
  assert.equal(off.net.length, 0, "the server was asked anything with online answers off");
  // ...even when the server's answer was learned before the runner switched online answers off.
  off.api.__expand(["briefing", "insight"]);
  assert.ok(!/data-expand/.test(off.card()), "offered after online answers were switched off");
  // Under 13: the lock, whatever is stored.
  const kid = app({ age: 12 });
  kid.api.alfieExpandProbe();
  assert.ok(!/data-expand/.test(kid.card()), "offered to a 12-year-old");
  assert.equal(kid.net.length, 0);
  // A server from before B11 (GET / lists no modes): never offered — deploy skew fails closed.
  const old = app({ modes: false });
  old.api.alfieExpandProbe(); await tick();
  assert.ok(!/data-expand/.test(old.card()), "offered by a server that does not know the mode");
  // Online, and a server that knows it: asked once, then offered.
  const a = app();
  assert.ok(!/data-expand/.test(a.card()), "offered before the server said it can");
  assert.equal(a.net.length, 0, "drawing the card asked the server something — that is wire()'s job, once");
  a.api.alfieExpandProbe(); await tick();
  assert.equal(a.net.filter((n) => n.method === "GET").length, 1, "the server was not asked, or asked twice");
  assert.match(a.card(), /data-expand="b\|[^"]+" data-mode="briefing"[\s\S]*Expand with Alfie[\s\S]*never your name, where you are, or your health answers/);
  a.api.alfieExpandProbe(); a.api.alfieExpandProbe();
  assert.equal(a.net.filter((n) => n.method === "GET").length, 1, "the server is asked on every render");
  assert.match(decomment(fnBody("wire")!), /alfieExpandProbe\(\);/, "nothing asks the server whether it can");
  // Never on a run where something hurt, and never on a rest-day briefing.
  const run = { id: "run-1", t: "Run", dateIso: TODAY, type: "easy", distKm: 5, sec: 1650, avgPaceSec: 330,
    splits: [1, 2, 3, 4, 5].map((km) => ({ km, sec: 330 })), pband: { minSecPerKm: 320, maxSecPerKm: 345 }, rband: { min: 3, max: 4 }, rpe: 4, react: "up" };
  a.st.logged = [run];
  const an = a.api.runAnalysis(run), v = a.api.runVerdict(run, an);
  assert.match(a.api.rdReactHtml(run, an, v), /data-mode="insight"/, "the insight is not offered");
  const hurt = { ...run, id: "run-2", pain: true };
  a.st.logged = [hurt];
  assert.ok(!/data-expand/.test(a.api.rdReactHtml(hurt, a.api.runAnalysis(hurt), a.api.runVerdict(hurt, a.api.runAnalysis(hurt)))), "offered on a run where something hurt");
  a.st.subj.illness = "unwell"; a.st.subjAnswered = true; a.st.subjAt = Date.now();
  assert.ok(!/data-expand/.test(a.card()), "offered on a rest-day briefing");
});

test("BLOCKER: the tap sends the facts and nothing else; a clean reply replaces the text, a bad one is refused, a full day keeps the offer", async () => {
  const a = app({ reply: { status: 200, body: { text: "Easy today: keep it conversational and enjoy it." } } });
  a.api.alfieExpandProbe(); await tick(); a.card();
  a.api.expandBrief(a.key, "briefing");
  await tick(); await tick();
  const post = a.net.find((n) => n.method === "POST");
  assert.ok(post, "nothing was sent");
  assert.deepEqual(Object.keys(post.body).sort(), ["context", "device", "mode"], "the request carries more than the mode, the facts and the device");
  assert.equal(post.body.mode, "briefing");
  assert.deepEqual(post.body.context, a.api.__packs()[a.key], "what was sent is not the pack on screen");
  const e = a.briefs()[a.key];
  assert.equal(e.src, "ai"); assert.equal(e.tried, true);
  assert.deepEqual(e.paras, ["Easy today: keep it conversational and enjoy it."]);
  const now = a.card();
  assert.match(now, /Written up by Alfie from your numbers[\s\S]*Easy today: keep it conversational/);
  assert.ok(!/data-expand/.test(now), "offered again after it was written up");
  // A reply with a number the facts do not hold: refused, the rule text stays, and it is not offered again.
  const b = app({ reply: { status: 200, body: { text: "Run 9 km at 4:15/km today." } } });
  b.api.alfieExpandProbe(); await tick(); b.card();
  const ruleText = b.briefs()[b.key].paras;
  b.api.expandBrief(b.key, "briefing"); await tick(); await tick();
  assert.equal(b.briefs()[b.key].src, "rule"); assert.deepEqual(b.briefs()[b.key].paras, ruleText, "a refused reply replaced the text");
  assert.equal(b.briefs()[b.key].tried, true);
  assert.match(b.toasts.join(" "), /didn’t pass our checks/);
  // A full day's allowance is not an answer: the offer stays for tomorrow.
  const c = app({ reply: { status: 429, body: { error: "rate limited", scope: "daily" } } });
  c.api.alfieExpandProbe(); await tick(); c.card();
  c.api.expandBrief(c.key, "briefing"); await tick(); await tick();
  assert.ok(!c.briefs()[c.key].tried, "a full day used up the one offer");
  assert.match(c.toasts.join(" "), /used up\. Try again tomorrow/);
  assert.match(c.card(), /data-expand/, "the offer did not come back after a full day");
  // The sender asks for itself: with online answers off it sends nothing, whoever calls it.
  const d = app({ online: false });
  await assert.rejects(d.api.alfieExpand("briefing", { title: "x" }));
  assert.equal(d.net.length, 0, "the sender sent with online answers off");
});

test("BLOCKER: the pages say what an expansion sends, and that the health answers never go", () => {
  const flows = decomment(constStmt("PRIVACY_FLOWS")!);
  assert.match(flows, /If you tap Expand with Alfie on a briefing or a run, the facts it was written from go too, never your health answers\./);
  const pol = readFileSync(new URL("../docs/privacy/index.html", import.meta.url), "utf8");
  const sec = pol.slice(pol.indexOf('data-flow="alfie"'), pol.indexOf('data-flow="strava"'));
  assert.match(sec, /Expand with Alfie/);
  assert.match(sec, /Never sent with it:<\/strong> your morning check-in and whether anything hurt/);
  assert.match(sec, /every number in it must be one it sent/);
  const simple = readFileSync(new URL("../docs/simple/index.html", import.meta.url), "utf8");
  assert.match(simple, /It never gets how you said you feel, or whether anything hurt\./);
  // And the wiring: the sheet and the run's page both bind the button to the one tap handler.
  assert.match(decomment(fnBody("wireSheet")!), /querySelectorAll\("#sheetBody \[data-expand\]"\)\.forEach\(\(b\) => b\.onclick = \(\) => expandBrief\(b\.dataset\.expand, b\.dataset\.mode\)\)/);
  assert.match(decomment(fnBody("wire")!), /querySelectorAll\("\[data-expand\]"\)\.forEach\(\(b\) => b\.onclick = \(\) => expandBrief\(b\.dataset\.expand, b\.dataset\.mode\)\)/);
});
