import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * CLAUDE.md LOADS INTO EVERY CLAUDE SESSION, SO ITS SIZE IS A COST PAID ON EVERY TURN OF EVERY SESSION.
 *
 * ⚠️ IT REACHED 1.29 MB — ABOUT 400,000 TOKENS — AND SESSIONS KEPT RUNNING OUT OF CONTEXT. Every stage
 * appended a chapter, every chapter was worth keeping, and nothing pushed back. It is also loaded again after
 * every compaction, so a long session could not compact its way below it. On 2026-09-28 the chapters moved,
 * word for word, into notes/, and CLAUDE.md became the rules nearly every task needs plus an index.
 *
 * This file is the push-back: a ceiling on CLAUDE.md, and an index that must match notes/ in both directions,
 * so a new chapter goes where a session will find it rather than back into the file every session pays for.
 */
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const notes = () => readdirSync(new URL("../notes/", import.meta.url)).filter((f) => f.endsWith(".md")).sort();
const MAX_CHARS = 30_000;

test("CLAUDE.md stays small enough to load into every session", () => {
  const n = read("CLAUDE.md").length;
  assert.ok(n <= MAX_CHARS, "CLAUDE.md is " + n + " characters against a ceiling of " + MAX_CHARS + ". It loads into " +
    "every session: put the new chapter at the end of the matching notes/ file, and add a line here only if " +
    "nearly every task needs it.");
});

test("every notes file is in CLAUDE.md's index, and every notes file the index names exists", () => {
  const md = read("CLAUDE.md");
  const files = notes();
  assert.ok(files.length >= 20, "notes/ holds only " + files.length + " files");
  for (const f of files) {
    assert.ok(md.includes("`notes/" + f + "`"), "notes/" + f + " is missing from CLAUDE.md's index, so no session will know to read it");
  }
  for (const m of md.matchAll(/notes\/([\w.-]+\.md)/g)) {
    assert.ok(files.includes(m[1]!), "CLAUDE.md names notes/" + m[1] + ", which does not exist");
  }
});

test("CLAUDE.md never imports another file, which would load it into every session again", () => {
  // Claude Code reads "@path/to/file" inside CLAUDE.md as an import and loads that file as well.
  const imports = [...read("CLAUDE.md").matchAll(/(?:^|\s)@[\w./~-]+\.md\b/gm)].map((m) => m[0].trim());
  assert.deepEqual(imports, [], "CLAUDE.md imports " + imports.join(", ") + " — name it as a plain path instead");
});

test("no notes file is too big to read when its area is being changed", () => {
  for (const f of notes()) {
    const n = read("notes/" + f).length;
    assert.ok(n <= 150_000, "notes/" + f + " is " + n + " characters: split it by topic and add the new file to CLAUDE.md's index");
  }
});
