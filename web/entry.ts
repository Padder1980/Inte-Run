// Browser bundle entry point. esbuild bundles this (and everything it imports from the pure-TS
// engine) into a single IIFE exposed as `window.RC`, so the interactive page can run the real
// engine client-side. Keep this surface minimal — just what the page calls.

export { buildPlanSummary } from "../src/view/plan-summary.ts";
export type { PlanSummary } from "../src/view/plan-summary.ts";
export { parseDuration } from "../src/domain/units.ts";
