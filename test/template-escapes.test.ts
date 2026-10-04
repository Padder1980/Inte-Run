import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE RUNTIME JS LIVES INSIDE ONE TEMPLATE LITERAL, SO A SINGLE BACKSLASH IN IT IS EATEN AT BUILD TIME.
 *
 * CLAUDE.md names the trap: "Double every backslash in runtime regexes and strings … A single one is eaten
 * silently, and the regex then matches something else." Found 2026-10-04 on Today's card, while driving the
 * week-move (B4) in a browser: todayDecision trimmed the first sentence of a session's description with
 * .replace(/\.$/, "") written with ONE backslash, so the page shipped .replace(/.$/, "") — "remove the last
 * character, whatever it is" — and the long run's card read "… under accumulated fatigu." in the browser.
 *
 * ⚠️ THE GUARD IS THE WHOLE TEMPLATE, NOT THAT ONE LINE: a sweep found it was the only instance, so the
 * count is held at zero and the next one fails here rather than on a screen.
 */
const SRC = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8").split("\n");

function templateLines(): { n: number; line: string }[] {
  const open = SRC.findIndex((l) => l.startsWith("const html = `"));
  assert.ok(open >= 0, "the page template's opening line has changed shape — update this guard");
  const close = SRC.findIndex((l, i) => i > open && l === "`;");
  assert.ok(close > open, "the page template's closing line was not found");
  return SRC.slice(open + 1, close).map((line, i) => ({ n: open + 2 + i, line }));
}

// A backslash that is not doubled, followed by a character a regex escape would use.
const EATEN = /(?<!\\)\\(?!\\)[.dswbDSWB/()[\]{}+*?|^$-]/;

test("BLOCKER: no regex escape in the runtime JS is written with a single backslash", () => {
  const hits = templateLines().filter(({ line }) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false; // comments quote the trap
    return EATEN.test(line.replace(/\/\/ .*$/, ""));
  });
  assert.deepEqual(hits.map((h) => h.n + ": " + h.line.trim().slice(0, 120)), [],
    "a single backslash in the runtime JS is eaten by the template literal — write it doubled");
});

test("Today's card trims a description's full stop, not its last letter", () => {
  // The built page, which is what ships: the escape must survive the template as \. (a literal full stop).
  const page = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = page.indexOf('String(sess.description).split(". ")[0]');
  assert.ok(at >= 0, "the description trim on Today's card has changed shape — update this guard");
  assert.match(page.slice(at, at + 120), /\.replace\(\/\\\.\$\/, ""\)/, "the full-stop trim lost its backslash and eats the last letter");
});
