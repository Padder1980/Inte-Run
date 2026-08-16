// Regenerate the owner's plain-English inventory of every line the coach can say:
//   node voice-dev/dump-coach-lines.mjs ~/Desktop/InteRun-coach-lines.md
// Built from the catalogue itself, so it cannot drift from what the app will actually say.
import { ALL_PROMPTS, COACHES, COACH_IDS, promptTextFor, PERSONAL_PROMPT_TEMPLATES }
  from "../src/live/coach-prompts.ts";
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../src/live/coach-prompts.ts", import.meta.url), "utf8");

// The one-line "when it fires" note lives beside each trigger in the union type.
const block = src.slice(src.indexOf("export type PromptTrigger"), src.indexOf(";", src.indexOf("export type PromptTrigger")));
const when = {};
for (const line of block.split("\n")) {
  const m = line.match(/\|\s*"([a-z-]+)"\s*(?:\/\/\s*(.*))?/);
  if (m) when[m[1]] = (m[2] || "").trim();
}

const NOT_FIRED = new Set([]);   // all three were switched on 2026-08-16

// The order a run actually happens in, so the document reads like a run rather than like a file.
const ORDER = [
  ["Before you set off", ["session-prep", "countdown"]],
  ["Getting going", ["warmup-start", "session-start", "easy-settle", "long-run-settle"]],
  ["Inside the work", ["tempo-start", "threshold-hold", "interval-start", "interval-work",
                        "recovery-start", "hill-start", "strength-start"]],
  ["Reacting to how it is going", ["pace-behind", "pace-ahead", "pace-on", "safety-effort", "keep-going"]],
  ["Through the middle", ["halfway", "section-halfway", "milestone-distance", "technique"]],
  ["Your reason for being out there", ["why-inspire", "why-reason", "why-goal", "why-anchor"]],
  ["Finishing", ["final-effort", "cooldown-start", "session-complete"]],
  ["If something changes", ["paused", "resumed", "ended-early"]],
];

const byTrig = {};
for (const p of ALL_PROMPTS) (byTrig[p.trigger] ||= []).push(p);

const coachName = (id) => (COACHES[id] && COACHES[id].name) || id;
const repeatWord = (s) => s >= 99999 ? "once per run" : s >= 3600 ? "at most once an hour" : s > 0 ? ("no sooner than every " + Math.round(s / 60) + " min") : "no limit";
const sess = (p) => p.sessionTypes === "all" ? "every session" : p.sessionTypes.join(", ");
const prio = (n) => n >= 90 ? "critical — interrupts anything" : n >= 60 ? "key moment" : n >= 40 ? "normal" : "background — never interrupts";

const out = [];
const W = (s = "") => out.push(s);

W("# Inte-Run — every line the coach can say");
W();
W("Generated from the app's own catalogue on 16 August 2026. **" + (ALL_PROMPTS.length - byTrig.fragment.length) +
  " spoken lines** across **" + (ORDER.flatMap(([, t]) => t).length) + " moments**, plus a bank of " +
  byTrig.fragment.length + " number fragments used to read paces aloud.");
W();
W("There are **" + COACH_IDS.length + " coaches**. Most lines have a different wording per coach — same moment, different personality.");
W();
W("---");
W();
W("## How to use this document");
W();
W("- **To add a line to a moment that already exists:** find the moment below and add a bullet under");
W("  *Your additions*. Write the words you want said. If you only write one line I will give the other");
W("  coaches their own version of it in their own voice; if you want to write all nine yourself, do.");
W("- **To add a whole new moment** (a point in the run where the coach currently says nothing): use the");
W("  *New moments I want* section at the end. Describe when it should fire in plain English.");
W("- **To change an existing line:** edit it in place and put `CHANGED` at the end of the bullet.");
W("- **To remove one:** put `REMOVE` at the end of the bullet.");
W();
W("Then send this file back and I will build it. Nothing here is live until you do.");
W();
W("### Four rules that constrain what a line can say");
W();
W("1. **No numbers, ever.** Not \"three minutes\", not \"5k\", not \"400 metres\". Every line is recorded in");
W("   advance as an audio file, so a number in the text would be spoken whatever the real figure is.");
W("   The only numbers the coach can say are paces, which are stitched from the fragment bank.");
W("   There is an automatic test that fails the build if a digit gets in.");
W("2. **Short.** One to four seconds. A line long enough to be ignored is the same as a wrong one — the");
W("   full read-out of a pace correction measured eleven seconds in an early version and had to be cut.");
W("3. **No medical or injury advice.** Anything about pain routes to the safety screens, not the coach.");
W("4. **Nothing that only makes sense once.** A line the runner hears every session becomes wallpaper,");
W("   so anything special needs a repeat gap (I will set that).");
W();
W("---");
W();
W("## The coaches");
W();
for (const id of COACH_IDS) {
  const c = COACHES[id];
  W("- **" + c.name + "** (`" + id + "`) — " + (c.tagline || "").toLowerCase() + ". " + (c.description || ""));
}
W();
W("---");
W();

for (const [section, triggers] of ORDER) {
  W("## " + section);
  W();
  for (const t of triggers) {
    const list = byTrig[t] || [];
    W("### " + t);
    W();
    W("**When:** " + (when[t] || "—"));
    if (NOT_FIRED.has(t)) {
      W();
      W("> ⚠️ **These lines are written and recorded but the app never plays them.** The moment is");
      W("> defined and the audio exists; nothing in the running app triggers it. Tell me if you want it");
      W("> switched on and I will wire it up — no new recording needed.");
    }
    if (!list.length) { W(); W("*No lines yet.*"); W(); continue; }
    W();
    W("**Rules:** " + prio(list[0].priority) + " · " + repeatWord(list[0].minRepeatSec) + " · " + sess(list[0]));
    W();
    for (const p of list) {
      W("- **" + p.id + "**");
      const seen = new Map();
      for (const id of COACH_IDS) {
        const txt = promptTextFor(p, id);
        if (!seen.has(txt)) seen.set(txt, []);
        seen.get(txt).push(coachName(id));
      }
      for (const [txt, who] of seen) {
        const label = who.length === COACH_IDS.length ? "all coaches" : who.join(", ");
        W("    - *" + label + ":* " + txt);
      }
    }
    W();
    W("*Your additions:*");
    W();
    W("- ");
    W();
  }
  W("---");
  W();
}

W("## Reading a pace out loud");
W();
W("The coach can say an actual pace — \"eight fifty-two, target six minutes\" — by stitching together");
W("small recorded fragments. That is the only way a number can ever be spoken.");
W();
W("- **" + byTrig.fragment.length + " fragments** per coach: whole minutes, every second from zero to fifty-nine, and the");
W("  joining words (\"target is\", \"per kilometre\", \"to\").");
W("- They are only used for pace corrections. If you want the coach to read out anything else numeric");
W("  — distance covered, time elapsed, heart rate — say so below and I will tell you what would need");
W("  recording.");
W();
W("*Numbers I would like the coach to be able to say:*");
W();
W("- ");
W();
W("---");
W();
W("## Lines that say your name");
W();
W("There are **" + PERSONAL_PROMPT_TEMPLATES.length + " personal lines** that use the runner's own name. These are recorded separately for");
W("one person and are never shipped publicly. Every one has a name-free fallback, so a runner without");
W("a personal pack hears the ordinary line rather than silence.");
W();
for (const p of PERSONAL_PROMPT_TEMPLATES) W("- *" + p.trigger + ":* " + p.text);
W();
W("*Your additions:*");
W();
W("- ");
W();
W("---");
W();
W("## New moments I want");
W();
W("Points in a run where the coach currently says nothing. Describe when it should fire and roughly");
W("what it should say — I will tell you whether the app can detect that moment, and what it would cost.");
W();
W("Some the app could detect today, if you want them:");
W();
W("- The last kilometre of a long run");
W("- Starting up a hill / cresting it (the phone knows elevation)");
W("- First run back after a rest day, or after a gap");
W("- Heart rate drifting up while pace holds steady");
W("- A personal best pace for that distance");
W("- Rain or heat detected at the start");
W("- The first session of a new training block or phase");
W("- Race week, and race morning");
W();
W("*What I want:*");
W();
W("- ");
W();
W("- ");
W();
W("- ");
W();

writeFileSync(process.argv[2] || "InteRun-coach-lines.md", out.join("\n"));
console.log("lines:", out.length);
