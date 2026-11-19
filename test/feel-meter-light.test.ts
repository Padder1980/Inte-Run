// pc-feel-meter-light (Road Map; found 2026-11-19 while fixing pc-fakewatch, older than that work).
//
// The readiness bar (.meter) was made for the coloured readiness card (.band): white on a 30%-white track, over the band's
// colour. The How you feel sheet draws the same bar on the plain sheet, so in light mode it was white on white: measured,
// fill rgb(255,255,255) on a white sheet — no bar at all. Dark mode showed it.
//
// The invariant guarded, from the BUILT page: for every band the sheet can show (found by answering it, not listed here),
// the colour the stylesheet actually paints the sheet's bar with stands out from the sheet in BOTH themes. Read like
// test/contrast.test.ts reads it: the generated CSS and the :root[data-theme] token blocks, never a table written beside
// them. The bar's colour is resolved the way the browser would: of the rules that can paint a .meter > i inside .sheet, the
// most specific, then the last.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RC from "../web/entry.ts";

const html = readFileSync(fileURLToPath(new URL("../web/app.html", import.meta.url)), "utf8");
const at0 = html.indexOf("function feelSheetHtml(");
assert.ok(at0 >= 0, "feelSheetHtml is not in the build — run node web/app.ts");
const SRC = html.slice(html.lastIndexOf("<script>", at0) + 8, html.indexOf("</script>", at0));
const CSS = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, " ");

function fnBody(name: string): string {
  const at = SRC.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at + 1, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
const constDecl = (name: string) => { const at = SRC.indexOf("\nconst " + name + " = "); assert.ok(at >= 0); return SRC.slice(at, SRC.indexOf(";\n", at) + 1); };

const state: any = { dayType: "quality", subj: {} };
const app = new Function("RC", "state", constDecl("BAND") + "\n" +
  ["readinessInput", "feelSheetHtml", "esc"].map(fnBody).join("\n") + "\nreturn { feelSheetHtml };")(RC, state);

/** A theme's tokens, from the block the theme toggle stamps (as test/contrast.test.ts reads them). */
function tokens(theme: "light" | "dark"): Record<string, string> {
  const at = html.indexOf(':root[data-theme="' + theme + '"]');
  assert.ok(at >= 0, "no :root[data-theme=" + theme + "] block in the build");
  const out: Record<string, string> = {};
  for (const m of html.slice(at, html.indexOf("}", at)).matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]!] = m[2]!;
  return out;
}
function lum(hex: string): number {
  const h = hex.replace("#", ""), full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
const ratio = (a: string, b: string) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

/** Every rule in the stylesheet as [selector, declarations], in source order. */
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!] as const);
/** The background a selector pattern resolves to: most specific matching selector wins, then the later rule. */
function background(matches: (sel: string) => boolean): string {
  let best: { spec: number; at: number; value: string } | null = null;
  RULES.forEach(([sels, decls], at) => {
    const v = /(?:^|;)\s*background\s*:\s*([^;]+)/.exec(decls)?.[1]?.trim();
    if (!v) return;
    for (const sel of sels.split(",").map((x) => x.trim())) {
      if (!matches(sel)) continue;
      const spec = (sel.match(/\./g) || []).length;
      if (!best || spec > best.spec || (spec === best.spec && at > best.at)) best = { spec, at, value: v };
    }
  });
  assert.ok(best, "no rule paints it");
  return (best as { value: string }).value;
}
/** var(--x, fallback) → a token's hex in a theme; --bc is the band colour the meter carries inline. */
function resolve(value: string, theme: Record<string, string>, bc: string): string {
  const v = value.trim();
  if (v.startsWith("#")) return v;
  const m = /^var\(--([a-z0-9-]+)\s*(?:,\s*(.+))?\)$/.exec(v);
  assert.ok(m, "cannot read the colour " + v);
  if (m![1] === "bc") return resolve(bc, theme, bc);
  if (theme[m![1]!]) return theme[m![1]!]!;
  assert.ok(m![2], "--" + m![1] + " is not a theme token, and there is no fallback");
  return resolve(m![2]!, theme, bc);
}

/** One set of answers per band, found by answering the sheet (its own buttons), not written down. */
function answersPerBand(): Record<string, Record<string, string>> {
  const sheet = app.feelSheetHtml();
  const opts: Record<string, string[]> = {};
  for (const m of sheet.matchAll(/data-fseg="([^"]+)">([\s\S]*?)<\/div>/g)) {
    if (m[1] !== "dayType") opts[m[1]!] = [...m[2]!.matchAll(/data-v="([^"]+)"/g)].map((x) => x[1]!);
  }
  let all: Array<Record<string, string>> = [{}];
  for (const f of Object.keys(opts)) all = all.flatMap((a) => opts[f]!.map((v) => ({ ...a, [f]: v })));
  const out: Record<string, Record<string, string>> = {};
  for (const subj of all) { state.subj = subj; const b = RC.assessReadiness(subj as any).band; out[b] ??= subj; }
  return out;
}

test("BLOCKER: the readiness bar in How you feel stands out from the sheet, for every band, in light and dark", () => {
  const bands = answersPerBand();
  assert.deepEqual(Object.keys(bands).sort(), ["ease", "ready", "rest", "steady"], "the sheet no longer reaches every band");
  const fill = background((sel) => /^(\.sheet(\s+[^\s>]+)*\s+)?\.meter\s*>\s*i$/.test(sel));
  const sheetBg = background((sel) => sel === ".sheet");
  for (const themeName of ["light", "dark"] as const) {
    const theme = tokens(themeName);
    for (const [band, subj] of Object.entries(bands)) {
      state.subj = subj;
      const bc = /class="meter"[^>]*style="--bc:([^"]+)"/.exec(app.feelSheetHtml())?.[1] ?? "";
      assert.ok(bc, "the sheet's bar no longer carries its band's colour");
      const r = ratio(resolve(fill, theme, bc), resolve(sheetBg, theme, bc));
      assert.ok(r >= 2.5, themeName + ", " + band + ": the bar is " + r.toFixed(2) + ":1 against the sheet — " +
        (r < 1.2 ? "it cannot be seen at all" : "too faint to read"));
    }
  }
});

test("The coloured readiness card keeps its white bar on the band's colour", () => {
  // The card the meter was made for is not in a sheet: there the plain .meter > i still paints it.
  const cardFill = background((sel) => /^\.meter\s*>\s*i$/.test(sel));
  assert.equal(cardFill.toLowerCase(), "#fff", "the card's bar is no longer white on its coloured band");
});
