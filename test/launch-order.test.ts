import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import type * as TS from "typescript";

/**
 * THE LAUNCH READS NOTHING THAT IS DECLARED BELOW IT (2026-11-18).
 *
 * The app is one script, run top to bottom. A function declaration is hoisted, so it can be called from anywhere;
 * a const, a let or a class is not — until its own line has run, reading it throws a ReferenceError (its "temporal
 * dead zone"). The launch builds the plan at the top level, two-thirds of the way up the file:
 *
 *     try { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); recompute(); }
 *
 * so anything that build reaches must already be declared. ⚠️ FOUND WHILE TESTING B14: strengthPrefsOf (inside
 * applyProfile) read STR_DEFAULT_MIN, declared twenty-one thousand lines further down. A stored profile with
 * strengthDays but no strengthMin threw there, and the catch above put DEFAULT_PROFILE in place of the runner's whole
 * profile — goal, paces, name — with nothing on screen to say so. The same sweep found six reads inside adoptPlan's
 * own try blocks (the reminder and watch syncs, the set-log migration) that threw at every launch and were swallowed.
 * This trap keeps coming back (JOURNAL_KEY, SHARE_EVEN_SPREAD_S, PLAN_PROF_FIELDS, the story viewer…), and each time
 * it was guarded afterwards by a hand-written list of names. This test derives the list instead.
 *
 * HOW: the built page's app script is parsed with the TypeScript compiler (scope resolution from its checker), and
 * every top-level statement is walked in order — its own code and, transitively, every top-level function it names.
 * A read of a const, let or class declared at or below that statement is a finding. The walk's rules, each pinned by
 * the fixture test below:
 * - Naming a top-level function counts as calling it (conservative), and so does naming a constant declared above
 *   that holds functions (an arrow in a const, an object of methods).
 * - A callback runs now — EXCEPT one handed to a timer, an event listener or a promise (it runs after the whole
 *   script), or one visibly stored for later (assigned, a property's value, a variable's value, returned, a method).
 * - A ready flag is honoured: a function whose first line is "if (!FLAG) return;", where FLAG is a top-level
 *   "let FLAG = false" set only by top-level statements, does nothing before the first of them (EXTRA_READY).
 * - A read inside a try/catch still counts: it does not reset the profile, but it silently skips that step at launch
 *   (journalSync recorded nothing at launch for weeks that way). Findings say which kind they are.
 * Not seen: a function reached only through an object property it was put on inside another function. The
 * sandboxed launch below executes the real thing for the case that started all this.
 *
 * ⚠️ THE FIX FOR A FINDING is to declare the binding with the store keys, near the top of the app script (CLAUDE.md:
 * "store keys are declared together near the top for this reason") — never to wrap the read in another try.
 */

const ts = createRequire(import.meta.url)("typescript") as typeof TS;

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
const BLOCKS = [...readFileSync(PAGE, "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
const APP = BLOCKS.find((b) => b.includes("function recompute("));
const ENGINE = BLOCKS.find((b) => /^\s*(?:"use strict";)?\s*var RC\s*=/.test(b));
assert.ok(APP, "the app script is not in the build — run node web/app.ts");
assert.ok(ENGINE, "the engine script (var RC = …) is not in the build — run node web/app.ts");

type Finding = {
  name: string; // the binding read in its dead zone
  kind: string; // const, let or class
  declLine: number; // where it is declared (a line of the built script)
  atLine: number; // the top-level statement whose run reaches it
  at: string; // that statement's opening text
  via: string; // the chain of calls from that statement to the read
  caught: boolean; // every path to it is inside a try/catch: a step silently skipped, not a crash
};

const isFnValue = (n: TS.Node) =>
  ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n) ||
  ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n);

/** A function value kept for later rather than run where it stands. */
function stored(n: TS.Node): boolean {
  if (!ts.isArrowFunction(n) && !ts.isFunctionExpression(n)) return true; // a method, accessor or constructor
  let c: TS.Node = n;
  let p = n.parent;
  while (ts.isParenthesizedExpression(p)) { c = p; p = p.parent; }
  return (ts.isBinaryExpression(p) && p.right === c && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
    (ts.isPropertyAssignment(p) && p.initializer === c) ||
    (ts.isVariableDeclaration(p) && p.initializer === c) ||
    ts.isReturnStatement(p);
}

const LATER = new Set(["setTimeout", "setInterval", "requestAnimationFrame", "requestIdleCallback", "queueMicrotask"]);
/** The arguments of a call that run after the whole script has: a timer's, a listener's, a promise's. */
function laterArgs(call: TS.CallExpression): ReadonlySet<TS.Node> | null {
  const e = call.expression;
  const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "";
  if (LATER.has(name)) return new Set(call.arguments.slice(0, 1));
  if (name === "addEventListener") return new Set(call.arguments.slice(1, 2));
  if (ts.isPropertyAccessExpression(e) && (name === "then" || name === "catch" || name === "finally")) return new Set(call.arguments);
  return null;
}

function sweep(src: string) {
  const FILE = "/launch-order-sweep.js";
  const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const options: TS.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, types: [] };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (f) => (f === FILE ? sf : undefined);
  host.fileExists = (f) => f === FILE;
  host.readFile = (f) => (f === FILE ? src : undefined);
  const checker = ts.createProgram([FILE], options, host).getTypeChecker();
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  // The top level. A function is callable from anywhere; a binding exists from its own declarator onwards.
  const fns = new Map<TS.Node, string>();
  const binds = new Map<TS.Node, { name: string; kind: string; pos: number }>();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) fns.set(st, st.name.text);
    else if (ts.isClassDeclaration(st) && st.name) binds.set(st, { name: st.name.text, kind: "class", pos: st.getStart() });
    else if (ts.isVariableStatement(st)) {
      const f = st.declarationList.flags;
      const kind = f & ts.NodeFlags.Const ? "const" : f & ts.NodeFlags.Let ? "let" : "var";
      for (const d of st.declarationList.declarations) binds.set(d, { name: d.name.getText(), kind, pos: d.getStart() });
    }
  }

  /** The top-level function or binding an identifier reads, or undefined (a local, a global, a declaration's own name). */
  function topDecl(id: TS.Identifier): TS.Node | undefined {
    const p = id.parent;
    if ((ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) ||
      ts.isClassDeclaration(p) || ts.isParameter(p)) && p.name === id) return undefined;
    const sym = ts.isShorthandPropertyAssignment(p) && p.name === id
      ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(id);
    for (let d of sym?.declarations ?? []) {
      let n: TS.Node = d;
      while (ts.isBindingElement(n)) n = n.parent.parent; // const { a } = … belongs to its declaration
      if (fns.has(n) || binds.has(n)) return n;
    }
    return undefined;
  }

  // Ready flags: where each one is first set by a top-level statement (Infinity if a function sets it: unknowable).
  const flagOpens = new Map<TS.Node, number>();
  function opensAt(flag: TS.Node): number {
    if (flagOpens.has(flag)) return flagOpens.get(flag)!;
    let at = Infinity, usable = true;
    const scan = (n: TS.Node) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) &&
        topDecl(n.left) === flag) {
        if (ts.isExpressionStatement(n.parent) && n.parent.parent === sf) at = Math.min(at, n.parent.getStart());
        else usable = false;
      }
      ts.forEachChild(n, scan);
    };
    scan(sf);
    const out = usable ? at : -1;
    flagOpens.set(flag, out);
    return out;
  }
  const gates: string[] = [];
  /** True when fn is a ready-flag function whose flag is still false when the statement at `at` runs. */
  function gated(fn: TS.FunctionDeclaration, at: number): boolean {
    const first = fn.body?.statements[0];
    if (!first || !ts.isIfStatement(first) || first.elseStatement) return false;
    const c = first.expression;
    if (!ts.isPrefixUnaryExpression(c) || c.operator !== ts.SyntaxKind.ExclamationToken || !ts.isIdentifier(c.operand)) return false;
    const then = ts.isBlock(first.thenStatement) && first.thenStatement.statements.length === 1
      ? first.thenStatement.statements[0]! : first.thenStatement;
    if (!ts.isReturnStatement(then) || then.expression) return false;
    const flag = topDecl(c.operand);
    if (!flag || !ts.isVariableDeclaration(flag) || binds.get(flag)!.kind !== "let" || binds.get(flag)!.pos > at ||
      flag.initializer?.kind !== ts.SyntaxKind.FalseKeyword) return false;
    if (at >= opensAt(flag)) return false;
    gates.push(fns.get(fn) + " (" + c.operand.text + ")");
    return true;
  }

  /** What a function-holding binding runs if called: every function value inside its initialiser or class body. */
  function held(d: TS.Node): TS.Node[] {
    const out: TS.Node[] = [];
    const find = (n: TS.Node) => { if (isFnValue(n) && "body" in n && n.body) { out.push(n.body as TS.Node); return; } ts.forEachChild(n, find); };
    if (ts.isVariableDeclaration(d) && d.initializer) find(d.initializer);
    if (ts.isClassDeclaration(d)) d.members.forEach(find);
    return out;
  }

  /** Everything the code at `root` runs before the statement at `at` finishes, and every top-level binding it reads. */
  function reach(root: TS.Node, at: number) {
    const entered = new Map<TS.Node, boolean>(); // function or holder -> caught? (an uncaught path wins)
    const reads = new Map<TS.Node, { caught: boolean; via: string[] }>();
    const queue: [TS.Node, string, boolean][] = [[root, "", false]];
    const enter = (key: TS.Node, bodies: TS.Node[], chain: string, caught: boolean) => {
      const prev = entered.get(key);
      if (prev === false || prev === caught) return;
      entered.set(key, caught);
      for (const b of bodies) queue.push([b, chain, caught]);
    };
    const visit = (n: TS.Node, caught: boolean, chain: string): void => {
      if (isFnValue(n) && stored(n)) return;
      if (ts.isTryStatement(n) && n.catchClause) {
        visit(n.tryBlock, true, chain);
        visit(n.catchClause.block, caught, chain);
        if (n.finallyBlock) visit(n.finallyBlock, caught, chain);
        return;
      }
      if (ts.isCallExpression(n)) {
        const later = laterArgs(n);
        if (later) {
          visit(n.expression, caught, chain);
          for (const a of n.arguments) if (!later.has(a)) visit(a, caught, chain);
          return;
        }
      }
      if (ts.isIdentifier(n)) {
        const d = topDecl(n);
        if (d && ts.isFunctionDeclaration(d)) {
          if (!gated(d, at)) enter(d, d.body ? [d.body] : [], (chain ? chain + " > " : "") + fns.get(d), caught);
        } else if (d) {
          const r = reads.get(d);
          if (!r) reads.set(d, { caught, via: [chain || "(itself)"] });
          else { r.caught = r.caught && caught; if (r.via.length < 3 && !r.via.includes(chain || "(itself)")) r.via.push(chain || "(itself)"); }
          const b = binds.get(d)!;
          if (b.pos < at) { const bodies = held(d); if (bodies.length) enter(d, bodies, (chain ? chain + " > " : "") + b.name + "()", caught); }
        }
      }
      ts.forEachChild(n, (c) => visit(c, caught, chain));
    };
    while (queue.length) { const [n, chain, caught] = queue.shift()!; visit(n, caught, chain); }
    const ran = new Map<string, boolean>();
    for (const [k, caught] of entered) if (fns.has(k)) ran.set(fns.get(k)!, caught);
    return { reads, ran };
  }

  // Every top-level statement, in order. A declaration list is taken one declarator at a time: "const a = 1, b = a"
  // reads a after a exists.
  const findings: Finding[] = [];
  const units: { node: TS.Node; at: number; stmt: TS.Statement }[] = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) continue;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (d.initializer) units.push({ node: d.initializer, at: d.getStart(), stmt: st });
    } else units.push({ node: st, at: st.getStart(), stmt: st });
  }
  for (const u of units) {
    const { reads } = reach(u.node, u.at);
    for (const [d, r] of reads) {
      const b = binds.get(d)!;
      if (b.kind === "var" || b.pos < u.at) continue;
      findings.push({ name: b.name, kind: b.kind, declLine: lineOf(b.pos), atLine: lineOf(u.stmt.getStart()),
        at: u.stmt.getText().replace(/\s+/g, " ").slice(0, 60), via: r.via.join(" | "), caught: r.caught });
    }
  }

  // The launch's first plan build: the top-level try whose body is recompute() and whose catch falls back to the default.
  const boots = sf.statements.filter((s): s is TS.TryStatement => ts.isTryStatement(s) &&
    /^\{\s*recompute\(\);\s*\}$/.test(s.tryBlock.getText()) && /DEFAULT_PROFILE/.test(s.catchClause?.block.getText() ?? ""));
  const boot = boots.length === 1 ? boots[0]! : null;
  return {
    findings, gates, boots: boots.length,
    boot: boot ? { line: lineOf(boot.getStart()), end: boot.end, ...reach(boot, boot.getStart()) } : null,
  };
}

const say = (f: Finding) => f.name + " (" + f.kind + ", declared on line " + f.declLine + ") is read by line " + f.atLine +
  " [" + f.at + "] through " + f.via + (f.caught ? " — inside a try, so that step silently does nothing at launch" : "");

const SWEEP = sweep(APP!);

test("BLOCKER: the launch's first plan build reads nothing declared below it, so a stored profile is never swapped for the default", () => {
  assert.equal(SWEEP.boots, 1, "the launch's first recompute() line has changed shape — update this guard (and the sandbox below)");
  const atBoot = SWEEP.findings.filter((f) => f.atLine === SWEEP.boot!.line);
  // ⚠️ AN UNCAUGHT ONE IS THE ORIGINAL DEFECT: it throws out of recompute(), and the launch's catch replaces the runner's
  // whole profile with DEFAULT_PROFILE. A caught one skips a step of every launch (a sync, a migration, a record).
  assert.deepEqual(atBoot.map(say), [],
    "declare these with the store keys, near the top of the app script — above the launch's first recompute()");
});

test("BLOCKER: no step of the launch reads a const, let or class declared below it", () => {
  assert.deepEqual(SWEEP.findings.map(say), [], "each of these throws the moment the launch reaches it");
});

test("the sweep sees the launch: what the first plan build runs, what it reads, the ready flag it honours", () => {
  const boot = SWEEP.boot!;
  // Not caught anywhere on the way: a throw in any of these resets the profile. (Long-lived names only — the road's
  // functions are still being built, and a rename there is not this guard's business.)
  for (const fn of ["applyProfile", "strengthPrefsOf", "planStartIso", "adoptPlan", "normalizeWeekStarts"]) {
    assert.equal(boot.ran.get(fn), false, fn + " is not on the launch's uncaught path any more — re-check what this guard sees");
  }
  // Inside adoptPlan's own try blocks.
  for (const fn of ["applyCrossWeekMoves", "applyAdjustments", "journalSync", "migrateSlog", "syncNativeReminders", "syncWatch"]) {
    assert.equal(boot.ran.get(fn), true, fn + " is not reached from the launch inside a try any more — re-check what this guard sees");
  }
  // EXTRA_READY keeps refreshProgExtras out until EXTRA exists — honoured, not walked into.
  assert.ok(SWEEP.gates.some((g) => g === "refreshProgExtras (EXTRA_READY)"), "the EXTRA_READY gate was not recognised");
  assert.ok(!boot.ran.has("refreshProgExtras"), "the sweep walked past the EXTRA_READY gate");
  // It resolves real reads, so an empty finding list is a measurement and not a blind spot: the very constants whose
  // dead zones were fixed here and before are seen being read — from above the launch now.
  const read = new Set([...boot.reads.keys()].map((d) => (d as TS.VariableDeclaration).name.getText()));
  for (const name of ["STR_DEFAULT_MIN", "STR_DEFAULT_LEVEL", "STR_DEFAULT_GOAL", "PRIMARY_TYPES", "PLAN_PROF_FIELDS",
    "JOURNAL_KEY", "NATIVE_NOTIFY", "NATIVE_WATCH", "SLOG", "DEFAULT_PROFILE"]) {
    assert.ok(read.has(name), name + " is no longer read by the launch's first plan build — re-check what this guard sees");
  }
});

test("the sweep's rules, on a script made to break each of them", () => {
  const fixture = [
    "function readsLate() { return LATE_A; }",
    "function deferred() { setTimeout(() => LATE_B, 0); addEventListener('x', () => LATE_B); Promise.resolve().then(() => LATE_B); }",
    "function caught() { try { return LATE_C; } catch (e) { return 0; } }",
    "let READY = false;",
    "function gated() { if (!READY) return; return LATE_D; }",
    "function shadows() { const LATE_E = 1; return LATE_E; }",
    "function stores() { window.cb = () => LATE_F; return { m() { return LATE_F; } }; }",
    "function typeOf() { return typeof LATE_G; }",
    "function writes() { LATE_H = 2; }",
    "const callNow = () => LATE_I;",
    "function viaConst() { return callNow(); }",
    "function viaMap() { return [1].map(() => LATE_J); }",
    "function makes() { return new Later(); }",
    "function run() { readsLate(); deferred(); caught(); gated(); shadows(); stores(); typeOf(); writes(); viaConst(); viaMap(); makes(); }",
    "run();",
    "const SELF = (() => typeof SELF)();",
    "const PAIR_A = 1, PAIR_B = PAIR_A + 1;",
    "const LATE_A = 1, LATE_B = 2, LATE_C = 3, LATE_D = 4, LATE_E = 5, LATE_F = 6, LATE_G = 7, LATE_I = 9, LATE_J = 10;",
    "let LATE_H = 8;",
    "class Later {}",
    "READY = true;",
    "gated();",
  ].join("\n");
  const got = sweep(fixture).findings.map((f) => f.name + (f.caught ? " (caught)" : "") + " @ " + f.at.split("(")[0]).sort();
  assert.deepEqual(got, [
    "LATE_A @ run", // through a call
    "LATE_C (caught) @ run", // inside a try: still a finding, marked as a silently skipped step
    "LATE_G @ run", // typeof does not protect a dead zone (only an undeclared name)
    "LATE_H @ run", // writing a let in its dead zone throws too
    "LATE_I @ run", // through an arrow stored in a const declared above
    "LATE_J @ run", // a callback that runs now
    "Later @ run", // a class has a dead zone like a const
    "SELF @ const SELF = ", // its own initialiser
  ].sort());
  // Not findings: a timer's, listener's or promise's callback (LATE_B); a ready flag still false (LATE_D — and read
  // again after "READY = true;", by which line it is declared); a local of the same name (LATE_E); a function stored
  // for later (LATE_F); the second declarator reading the first (PAIR_A).
});

/**
 * THE CASE THAT STARTED THIS, EXECUTED. The real page — its engine and its app script, as built — runs in a sandbox up
 * to the end of the launch's first recompute(), with a stored profile, and reports the profile the runner would see.
 */
function launch(stored: Record<string, unknown>) {
  const STOP = "__launch_order_probe_stop__";
  const end = SWEEP.boot!.end;
  const probed = APP!.slice(0, end) +
    "\n;globalThis.__probe = { profile: profile, weeks: PLAN && PLAN.weeks ? PLAN.weeks.length : -1, prefs: strengthPrefsOf(profile) };" +
    "\nthrow new Error(" + JSON.stringify(STOP) + ");\n" + APP!.slice(end);
  const store = new Map<string, string>([["rc_profile_v1", JSON.stringify(stored)]]);
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: unknown) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
    clear: () => store.clear(),
  };
  const quiet = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  const ctx = createContext({ localStorage, console: quiet, navigator: {}, setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {} }) as Record<string, unknown>;
  ctx.window = ctx;
  ctx.self = ctx;
  runInContext(ENGINE!, ctx);
  try { runInContext(probed, ctx, { filename: "app-script.js" }); }
  catch (e) { if (!String((e as Error)?.message).includes(STOP)) throw e; }
  return ctx.__probe as { profile: Record<string, unknown>; weeks: number; prefs: Record<string, unknown> | null };
}

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const RUNNER = { name: "Probe Runner", avatar: "", status: "building", goalDist: "10k", targetS: 3300, targetSet: true,
  raceDate: inDays(120), startDateIso: "", longRunDay: 6, fitSrc: "recent", recentDistM: 5000, recentTimeS: 1650,
  noRecent: false, easyPaceS: 0, twoKmS: 0, daysPerWeek: 4, volKm: 0, sex: "", strength: true, returning: false,
  personalized: true, bRace: null };

test("BLOCKER: a stored profile with strength days but no session length opens as itself — not as the default profile", () => {
  for (const [label, stored] of [
    ["strengthDays and nothing else (the profile found on 2026-11-18)", { ...RUNNER, strengthDays: 2 }],
    ["strength answers no longer on offer", { ...RUNNER, strengthDays: 3, strengthMin: 999, strengthLevel: "olympian", strengthGoal: "bulk" }],
  ] as const) {
    const out = launch(stored);
    // DEFAULT_PROFILE is a "regular" runner with no name: the launch's catch swapped it in for the runner's own.
    assert.equal(out.profile.name, "Probe Runner", label + ": the launch replaced the runner's profile with the default one");
    assert.equal(out.profile.status, "building", label + ": the runner's status was replaced");
    assert.equal(out.profile.goalDist, "10k", label + ": the runner's goal was replaced");
    assert.ok(out.weeks > 0, label + ": no plan was built");
    // And the defaults are what fill the gaps — the reason they are read at launch at all.
    assert.equal(out.prefs?.minutes, 45, label + ": the strength session length did not fall back to 45 minutes");
    assert.equal(out.prefs?.level, "intermediate", label + ": the strength level did not fall back to intermediate");
    assert.equal(out.prefs?.goal, "running", label + ": the strength goal did not fall back to running");
  }
  // The control: a complete profile keeps its own answers.
  const full = launch({ ...RUNNER, strengthDays: 2, strengthMin: 30, strengthLevel: "beginner", strengthGoal: "running" });
  assert.equal(full.profile.name, "Probe Runner");
  assert.equal(full.prefs?.minutes, 30, "a stored session length was not used");
  assert.equal(full.prefs?.level, "beginner", "a stored strength level was not used");
});
