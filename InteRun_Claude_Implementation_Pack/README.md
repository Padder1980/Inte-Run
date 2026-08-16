# Inte-Run Claude implementation pack

This folder is the build source for the approved Inte-Run post-run debrief.

## Files

- `CLAUDE.md` — binding constraints and required workflow. Claude reads this first.
- `POST_RUN_DEBRIEF_SPEC.md` — detailed information architecture, components, states and interaction values.
- `VISUAL_ACCEPTANCE_CHECKLIST.md` — objective completion gate.
- `START_PROMPT.txt` — ready-to-paste opening instruction for Claude Code.
- `references/01-map-hero-target.png` — zero-scroll target.
- `references/02-coach-debrief-target.png` — coaching-state target.
- `references/03-run-analysis-target.png` — analysis-state target. Its teal HR-zone bars are placeholders only.
- `manifest.json` — machine-readable file roles, hashes and authority rules.

The Word design brief remains the human-facing visual master. Claude Code should build from this lean pack so it can load the strict contract first and read detail only when required.

## Recommended use

Place this folder at the root of the Inte-Run repository or merge its `CLAUDE.md` instructions into the repository's existing root `CLAUDE.md`. Do not overwrite unrelated project instructions.

Paste the contents of `START_PROMPT.txt` into Claude Code. It contains this initial instruction:

```text
Read InteRun_Claude_Implementation_Pack/CLAUDE.md, then the detailed specification and visual acceptance checklist. Treat the three files in references/ as authoritative visual targets. Inspect the existing implementation and report your preflight findings before editing code. Once I approve the preflight, implement and verify the debrief exactly as instructed. The only approved visual substitution is to reuse Inte-Run's existing Zone 1-5 heart-rate colours instead of the teal placeholder bars in the analysis reference.
```

Do not upload only the Word document and ask Claude to “make something similar”. That wording invites interpretation; this pack deliberately removes it.
