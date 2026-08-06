// Browser bundle entry point. esbuild bundles this into a single IIFE exposed as `window.MK`, so
// the page runs the real engine client-side — same arrangement as the running app's `RC`.
// Keep this surface minimal: just what the page calls.

export {
  rateAsset,
  rankRatings,
  scoreTrend,
  scoreAnalyst,
  scoreFundamentals,
  profileRisk,
  starsFor,
  WEIGHTS,
  STAR_THRESHOLDS,
  RISK_STAR_CAP,
  TARGET_NEUTRAL,
  CONSENSUS_NEUTRAL,
} from "./engine/score.ts";
export type { SortKey } from "./engine/score.ts";

export { loadWatchlist, fetchCrypto, fetchEquityHistory, ProviderError } from "./engine/providers.ts";
export type { Keys, WatchItem, LoadResult } from "./engine/providers.ts";

export type {
  AssetKind,
  AssetSnapshot,
  Candle,
  Pillar,
  Rating,
  RiskBand,
  RiskProfile,
} from "./engine/types.ts";
