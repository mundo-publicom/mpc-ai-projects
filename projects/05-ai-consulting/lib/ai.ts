import { generateText, generateObject } from "ai";

/**
 * Shared model-access layer. All calls route through the Vercel AI Gateway via
 * plain `"provider/model"` strings — no provider SDK wiring.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * True when an AI Gateway (or direct Anthropic) key is present. When false,
 * API routes fall back to a deterministic mock audit so the demo runs with
 * zero keys.
 */
export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

// Re-export the primitives used across the app so routes import from one place.
export { generateText, generateObject };
