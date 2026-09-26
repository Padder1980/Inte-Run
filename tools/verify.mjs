#!/usr/bin/env node
// The whole verification recipe as ONE command, so no step is ever quoted from memory.
//
//   npm run verify            build → voices clean → node --check ×N → tsc → tests ×3 timezones → audits
//   npm run verify:quick      same, but tests under UTC only and no audits (a development loop)
//   node tools/verify.mjs --no-audit   full timezone sweep, audits skipped
//
// Why this exists — every one of these steps has, on record in CLAUDE.md, been skipped or misread:
//   • the build failed and `node --check` then passed on the STALE page (the exit code was not read);
//   • `node web/app.ts` silently overwrote the committed coach audio from a stale local `web/voices/`;
//   • `npx tsc --noEmit` was "clean apart from the one pre-existing error" when it had three;
//   • a harness parsed `# fail N` while node prints `ℹ fail N`, and reported 0 of 25 breaks caught
//     while every one was being caught;
//   • a test passed under UTC and failed under Pacific/Pago_Pago, twenty-five hours away.
//
// Rules this script follows, each the cost of a documented fault:
//   • It READS EVERY EXIT CODE. A failed build stops the run; nothing after it is trusted.
//   • It NEVER restores `docs/voices/` by itself. A dirty voices tree is reported with the restore
//     command, because the same diff is a disaster after an accidental build and correct after a
//     deliberate regeneration — only a person knows which.
//   • The script-block count is DERIVED from the built page, not typed.
//   • The one allowed tsc error is pinned by FILE and CODE, never by line number (lines drift).
//   • Both `ℹ fail N` and `# fail N` are parsed, and an UNPARSABLE result is a failure, never a pass.
//   • The three timezone runs must agree on the pass count — a test that exists in one and not
//     another is a test that depends on the clock.
//
// On success it writes `.verify-ok` (gitignored) with the commit, a hash of the working tree's
// diff, and the counts, so a later pre-push hook can refuse a push nobody verified.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const QUICK = ARGS.has("--quick");
const NO_AUDIT = QUICK || ARGS.has("--no-audit");
if (ARGS.has("--help") || ARGS.has("-h")) {
  console.log("node tools/verify.mjs [--quick] [--no-audit]\n  --quick     UTC only, no audits\n  --no-audit  skip the two engine audits");
  process.exit(0);
}

/** The one tsc error this repo carries on purpose (a Date overload in a test fixture). */
const ALLOWED_TSC = [{ file: "test/onboarding-wizard.test.ts", code: "TS2769" }];
/** UTC-11 and UTC+14 are 25 hours apart, so anything that depends on which day it is fails in one. */
const TIMEZONES = QUICK ? ["UTC"] : ["UTC", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
const AUDITS = ["tools/audit-progression.mjs", "tools/audit-five-rules.mjs"];

const t0 = Date.now();
const summary = [];
let step = 0;

function banner(title) { step++; console.log(`\n[${step}] ${title}`); }
function fail(msg, extra) {
  console.error(`\n✖ verify FAILED at step ${step}: ${msg}`);
  if (extra) console.error(extra.split("\n").slice(-40).join("\n"));
  console.error(`\n(${elapsed()} elapsed; nothing after this step was run)`);
  process.exit(1);
}
function elapsed() { const s = Math.round((Date.now() - t0) / 1000); return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`; }
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...(opts.env || {}) } });
  return { code: r.status ?? -1, out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "", stderr: r.stderr || "", signal: r.signal };
}

/** Chrome for the share-card export gate. Absent means those tests fail by design, naming the fix. */
function chromePath() {
  const cands = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  return cands.find((p) => existsSync(p)) || "";
}

// 1. Build — and read the exit code.
banner("build: node web/app.ts");
{
  const r = run("node", ["web/app.ts"]);
  if (r.code !== 0) fail(`build exited ${r.code}`, r.out);
  console.log("  exit 0");
  summary.push("build 0");
}

// 2. The committed coach audio must be untouched by that build.
banner("docs/voices/ untouched by the build");
{
  const r = run("git", ["status", "--short", "docs/voices/"]);
  if (r.code !== 0) fail("git status failed", r.out);
  const dirty = r.stdout.trim();
  if (dirty) {
    fail("the build changed committed coach audio — a stale local web/voices/ was mirrored over docs/voices/.\n" +
      "  If this was NOT a deliberate regeneration, restore it with:  git checkout -- docs/voices/\n" +
      "  (this script never restores it for you — the same diff is correct after a real regeneration)", dirty);
  }
  console.log("  clean");
  summary.push("voices clean");
}

// 3. node --check on every emitted <script> block — the count is derived, never typed.
banner("node --check on the emitted script blocks");
{
  const html = readFileSync(join(ROOT, "web/app.html"), "utf8");
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (blocks.length < 1) fail("no <script> blocks found in web/app.html");
  const dir = mkdtempSync(join(tmpdir(), "interun-verify-"));
  blocks.forEach((b, i) => {
    const f = join(dir, `block${i}.js`);
    writeFileSync(f, b);
    const r = run("node", ["--check", f]);
    if (r.code !== 0) fail(`emitted script block ${i} does not parse`, r.out);
  });
  console.log(`  ${blocks.length} blocks OK`);
  summary.push(`${blocks.length} blocks`);
}

// 4. Typecheck — allow exactly the pinned error and nothing else.
banner("npx tsc --noEmit");
{
  const r = run("npx", ["tsc", "--noEmit"]);
  const errs = [...r.out.matchAll(/^(.+?\.tsx?)\((\d+),(\d+)\): error (TS\d+)/gm)].map((m) => ({ file: m[1], code: m[4], line: m[0] }));
  const unexpected = errs.filter((e) => !ALLOWED_TSC.some((a) => a.file === e.file && a.code === e.code));
  if (unexpected.length) fail(`${unexpected.length} unexpected type error(s)`, unexpected.map((e) => e.line).join("\n"));
  if (r.code !== 0 && errs.length === 0) fail("tsc exited non-zero without reporting a parseable error", r.out);
  console.log(`  ${errs.length} error(s), all pinned (${ALLOWED_TSC.map((a) => a.file + " " + a.code).join(", ")})`);
  summary.push(`tsc ${errs.length} pinned`);
}

// 5. The suite, once per timezone. Parses both fail-line formats; unparsable is a failure.
banner(`node --test under ${TIMEZONES.join(", ")}`);
const chrome = chromePath();
if (!chrome) console.log("  ⚠ no Chrome found — the share-card export gate will fail by design and name the fix");
// ⚠️ VERIFY_CONCURRENCY runs fewer test files at once. Off unless set, so the recipe is unchanged for
// everyone else. It exists because on 2026-09-24 a 24 GB Mac with other apps open pushed 4 GB into swap
// under the default (about 13 files at once, a few of the share-card files at 1.6-2.7 GB each): one run
// took 7,299 s and the headless Chrome of the export gate timed out, failing 21 tests that pass 21/21
// alone. It cannot go through NODE_OPTIONS ("--test-concurrency is not allowed in NODE_OPTIONS"), hence
// this. The summary line says when it was used, so a slower, gentler run is never passed off as the default.
const CONC = /^[1-9][0-9]*$/.test(process.env.VERIFY_CONCURRENCY || "") ? Number(process.env.VERIFY_CONCURRENCY) : 0;
const passCounts = [];
for (const tz of TIMEZONES) {
  process.stdout.write(`  ${tz} … `);
  const r = run("node", CONC ? ["--test", "--test-concurrency=" + CONC] : ["--test"], { env: { TZ: tz, ...(chrome ? { CHROME_PATH: chrome } : {}) } });
  const pass = r.out.match(/^(?:ℹ|#) pass (\d+)/m);
  const failm = r.out.match(/^(?:ℹ|#) fail (\d+)/m);
  if (!pass || !failm) fail(`could not parse the test result under ${tz} (neither "ℹ fail N" nor "# fail N" found)`, r.out);
  const p = Number(pass[1]), f = Number(failm[1]);
  console.log(`${p} pass / ${f} fail`);
  if (f !== 0 || r.code !== 0) {
    const failing = [...r.out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => "  ✖ " + m[1]).join("\n");
    fail(`${f} failing test(s) under ${tz}`, failing || r.out);
  }
  passCounts.push(p);
}
if (new Set(passCounts).size !== 1) fail(`pass counts differ across timezones: ${TIMEZONES.map((z, i) => z + "=" + passCounts[i]).join(", ")} — a test depends on the clock`);
summary.push(`tests ${passCounts[0]}/0 ×${TIMEZONES.length} tz`);

// 6. The two engine audits — informational, but they must run to completion.
const auditLines = {};
if (!NO_AUDIT) {
  banner("engine audits");
  for (const a of AUDITS) {
    process.stdout.write(`  ${a} … `);
    const r = run("node", [a]);
    if (r.code !== 0) fail(`${a} exited ${r.code}`, r.out);
    const tail = r.stdout.trim().split("\n").slice(-3);
    auditLines[a] = tail;
    console.log("ok");
    for (const l of tail) console.log("    " + l.slice(0, 160));
  }
  summary.push("audits ok");
} else {
  summary.push("audits skipped");
}

// 7. Stamp. `head` + a hash of the uncommitted diff identify exactly what was verified.
const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const diff = run("git", ["diff", "HEAD"]).stdout + run("git", ["ls-files", "--others", "--exclude-standard"]).stdout;
const stamp = {
  at: new Date().toISOString(), head, dirtyHash: createHash("sha256").update(diff).digest("hex").slice(0, 16), dirty: diff.trim().length > 0,
  quick: QUICK, timezones: TIMEZONES, pass: passCounts[0], fail: 0, blocks: summary.find((s) => s.endsWith("blocks")), audits: auditLines,
};
writeFileSync(join(ROOT, ".verify-ok"), JSON.stringify(stamp, null, 2) + "\n");

const line = `verify OK · ${summary.join(" · ")} · ${elapsed()}${QUICK ? " · QUICK (UTC only, no audits)" : ""}${CONC ? " · " + CONC + " test files at a time" : ""}`;
console.log("\n" + line);
console.log(`(.verify-ok written for ${head.slice(0, 7)}${stamp.dirty ? " + uncommitted changes" : ""})`);
