// Shared helper: bundle the pure-TS engine (via web/entry.ts) into a single browser IIFE exposed as
// `window.RC`. Both page builds (build.ts, live.ts) inline the returned JS into a <script> tag.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

export async function bundleEngine(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const result = await esbuild.build({
    entryPoints: [join(here, "entry.ts")],
    bundle: true,
    format: "iife",
    globalName: "RC",
    minify: true,
    write: false,
    target: "es2020",
    legalComments: "none",
  });
  return result.outputFiles[0]!.text;
}
