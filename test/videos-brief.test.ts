import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { EXERCISES } from "../src/strength/library.ts";
import { STRETCHES } from "../src/science/stretches.ts";
import { WARMUP_MOVEMENTS } from "../src/science/warmup.ts";

/**
 * VIDEOS.md is the brief the owner pastes into ChatGPT to make the demonstration videos, and its
 * Appendix A is the map a later session uses to wire the clips in by id. Both go stale silently: a new
 * exercise gets no clip, or a cue is reworded and the brief still quotes the old words as "the app's own
 * words" — and the clip is then made to match something the app no longer says. So this holds the file
 * to the code, deriving every list from the engine rather than repeating it here:
 *  - every exercise, stretch and warm-up movement has exactly one clip, and every clip names a real id;
 *  - the prompt's clip list and the appendix agree clip by clip, and the count the prompt states is real;
 *  - every quote the prompt labels as the app's words still is, character for character.
 */
const md = readFileSync(new URL("../VIDEOS.md", import.meta.url), "utf8");
const warmupSrc = readFileSync(new URL("../src/science/warmup.ts", import.meta.url), "utf8");
const start = md.indexOf("PROMPT START");
const end = md.indexOf("PROMPT END");
const prompt = md.slice(start, end);
const appendix = md.slice(end);

type Row = { n: number; file: string; id: string; name: string };
const rows: Row[] = [...appendix.matchAll(/^\| (\d+) \| `([^`]+)` \| `([^`]+)` \| ([^|]+?) \| [^|]+ \|$/gm)]
  .map((m) => ({ n: Number(m[1]), file: m[2]!, id: m[3]!, name: m[4]! }));
const inFolder = (f: string) => rows.filter((r) => r.file.startsWith(f + "/"));
const stretchById = new Map(STRETCHES.map((s) => [s.id, s]));

/** One clip's block in the prompt: from its header line to the next clip header or heading. */
function block(r: Row): string {
  const head = "**" + r.n + " · `" + r.file + "` — ";
  const at = prompt.indexOf(head);
  assert.ok(at >= 0, "clip " + r.n + " (" + r.file + ") is in the appendix but has no entry in the prompt");
  assert.equal(prompt.indexOf(head, at + 1), -1, "clip " + r.n + " has two entries in the prompt");
  const rest = prompt.slice(at + head.length);
  const next = rest.search(/\n(\*\*\d+ · |#)/);
  return head + (next < 0 ? rest : rest.slice(0, next));
}

test("the brief has both markers and an appendix the test can read", () => {
  assert.ok(start > 0 && end > start, "VIDEOS.md must keep its PROMPT START and PROMPT END lines");
  assert.ok(rows.length > 0, "Appendix A's table did not parse — keep its | # | `file` | `id` | name | today | shape");
});

test("every exercise, stretch and warm-up movement has exactly one clip", () => {
  const ids = (f: string) => inFolder(f).map((r) => r.id).sort();
  assert.deepEqual(ids("strength"), Object.keys(EXERCISES).sort(),
    "the strength clips must cover the exercise library exactly — a new exercise needs a clip in VIDEOS.md");
  assert.deepEqual(ids("stretches"), STRETCHES.map((s) => s.id).sort(),
    "the stretch clips must cover the stretch session exactly");
  assert.deepEqual(ids("warm-up"), [...Object.keys(WARMUP_MOVEMENTS), "potentiate"].sort(),
    "the warm-up clips must cover every warm-up movement, plus the strides phase");
  assert.equal(rows.length, inFolder("strength").length + inFolder("stretches").length + inFolder("warm-up").length,
    "every clip lives in one of the three folders");
});

test("clips are numbered 1 to N with unique, plain file names, and the prompt's count is right", () => {
  assert.deepEqual(rows.map((r) => r.n), rows.map((_, i) => i + 1), "numbered 1 to N in order, no gaps");
  assert.equal(new Set(rows.map((r) => r.file)).size, rows.length, "no file name is used twice");
  for (const r of rows) assert.match(r.file, /^(warm-up|stretches|strength)\/[a-z0-9]+(-[a-z0-9]+)*\.mp4$/, r.file);
  const n = rows.length;
  assert.ok(prompt.includes("There are " + n + " clips in all."), "the prompt must say there are " + n + " clips");
  assert.ok(prompt.includes("Make clips 2 to " + n + " in number order"), "step 3 must run to clip " + n);
  assert.ok(prompt.includes("Done 6 of " + n), "the progress example must count to " + n);
  assert.ok(md.slice(0, start).includes(n + " clips"), "the header for the owner must give the same count");
  assert.ok(prompt.includes("Make clip 1, `" + rows[0]!.file + "`"), "the test clip in step 2 must be clip 1");
});

test("the appendix gives each clip the app's own name", () => {
  for (const r of rows) {
    const want = r.file.startsWith("strength/") ? EXERCISES[r.id]?.name
      : r.file.startsWith("stretches/") ? stretchById.get(r.id)?.name
      : r.id === "potentiate" ? r.name
      : WARMUP_MOVEMENTS[r.id as keyof typeof WARMUP_MOVEMENTS];
    assert.equal(r.name, want, "clip " + r.n + " (" + r.id + ")");
  }
});

test("every clip in the prompt says how to film it and what to keep out", () => {
  for (const r of rows) {
    const b = block(r);
    for (const line of ["- Camera: ", "- Show: ", "- Avoid: "]) {
      assert.ok(b.includes("\n" + line), "clip " + r.n + " (" + r.file + ") has no " + line.trim() + " line");
    }
  }
});

test("every quote labelled as the app's words is still the app's words", () => {
  for (const r of rows) {
    const b = block(r);
    if (r.file.startsWith("strength/")) {
      const e = EXERCISES[r.id]!;
      assert.ok(b.startsWith("**" + r.n + " · `" + r.file + "` — " + e.name + "**"), "clip " + r.n + " header must name " + e.name);
      assert.ok(b.includes('\n- App cue: "' + e.cue + '"'), "clip " + r.n + " (" + r.id + ") must quote the library cue exactly: " + e.cue);
    } else if (r.file.startsWith("stretches/")) {
      const s = stretchById.get(r.id)!;
      assert.ok(b.startsWith("**" + r.n + " · `" + r.file + "` — " + s.name + "**"), "clip " + r.n + " header must name " + s.name);
      assert.ok(b.includes('\n- App cue: "' + s.cue + '"'), "clip " + r.n + " (" + r.id + ") must quote the stretch cue exactly: " + s.cue);
    } else if (r.id === "potentiate") {
      const quote = /\n- App says: "([^"]+)"/.exec(b);
      assert.ok(quote, "the strides clip must quote what the app says about strides");
      assert.ok(warmupSrc.includes(quote![1]!), "the strides quote is no longer in src/science/warmup.ts: " + quote![1]);
    } else {
      const label = WARMUP_MOVEMENTS[r.id as keyof typeof WARMUP_MOVEMENTS];
      assert.ok(b.includes('\n- App shows: "' + label + '"'), "clip " + r.n + " (" + r.id + ") must quote the warm-up label exactly: " + label);
    }
  }
});
