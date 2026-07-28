// Dump the typed prompt catalogue to JSON so the (Python) generation pipeline reads exactly what the
// app ships — the TypeScript catalogue stays the single source of truth. Run: node voice-dev/dump-catalogue.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COACHES, COACH_IDS, PROMPTS, PERSONAL_PROMPT_TEMPLATES, promptTextFor } from "../src/live/coach-prompts.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = {
  // A version tag folded into each clip's content hash — bump to force a full regenerate.
  version: 1,
  coaches: COACH_IDS.map((id) => ({ id, name: COACHES[id].name, voice: COACHES[id].voice })),
  // Per-coach text, resolved here so the generator never needs the catalogue's fallback rules.
  prompts: PROMPTS.map((p) => ({
    id: p.id, text: p.text, trigger: p.trigger,
    byCoach: Object.fromEntries(COACH_IDS.map((c) => [c, promptTextFor(p, c)])),
  })),
  // Name-bearing lines with a {name} slot. The generator expands these per --personal NAME into a
  // private pack; they are never part of the public voices/ set.
  personal: PERSONAL_PROMPT_TEMPLATES.map((p) => ({
    id: p.id, text: p.text, trigger: p.trigger,
    byCoach: Object.fromEntries(COACH_IDS.map((c) => [c, promptTextFor(p, c)])),
  })),
};
const path = join(here, "prompts.json");
writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${path} — ${out.prompts.length} prompts × ${out.coaches.length} coaches = ${out.prompts.length * out.coaches.length} clips, plus ${out.personal.length} personal templates`);
