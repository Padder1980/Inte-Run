// Browser bundle entry point. esbuild bundles this (and everything it imports from the pure-TS
// engine) into a single IIFE exposed as `window.RC`, so the interactive pages can run the real
// engine client-side. Keep this surface minimal — just what the pages call.

export { buildPlanSummary } from "../src/view/plan-summary.ts";
export type { PlanSummary } from "../src/view/plan-summary.ts";
export { parseDuration } from "../src/domain/units.ts";
export { generatePlan } from "../src/plan/generate-plan.ts";
export { LiveSession } from "../src/live/session-runtime.ts";
export type { Telemetry, Cue, LiveSnapshot, StepView } from "../src/live/session-runtime.ts";
