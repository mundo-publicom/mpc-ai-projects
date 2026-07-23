import { generateText, generateObject } from "ai";

// Re-export so routes/domain modules import the SDK helpers from one place.
export { generateText, generateObject };

/**
 * Model catalog. Calls are routed through the Vercel AI Gateway using plain
 * "provider/model" strings — no provider SDK is wired directly.
 *
 * Negotiation is a reasoning-heavy, low-volume task per transaction, so the
 * buyer/seller agents default to `smart`; capability matching can use `fast`.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * True when a gateway/provider key is present. When false, API routes serve
 * realistic mock data (deterministic negotiation + settlement) so the demo
 * runs end-to-end with zero configuration.
 */
export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

// Money helpers live in the dependency-free lib/format module so client
// components can use them without bundling the AI SDK. Re-exported here for
// convenience of server modules that already import from lib/ai.
export { MICROS_PER_UNIT, fmtMicros, applyBps } from "./format";
