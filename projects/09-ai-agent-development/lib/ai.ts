import { generateText, tool, stepCountIs } from "ai";
import type { ModelTier } from "./types";

// Re-export the SDK helpers from one place so the runtime imports them here.
export { generateText, tool, stepCountIs };

/**
 * Model catalog. Calls are routed through the Vercel AI Gateway using plain
 * "provider/model" strings — no provider SDK is wired directly.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

/** Resolve a logical tier to the gateway model string. */
export function resolveModel(tier: ModelTier): string {
  return MODELS[tier];
}

/**
 * True when a gateway/provider key is present. When false, the runtime uses a
 * deterministic mock loop so the whole platform is demoable with zero config.
 */
export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
