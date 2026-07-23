import { generateText, generateObject } from "ai";

/**
 * Central model-access module. Every AI call in this project goes through the
 * Vercel AI Gateway using plain `"provider/model"` strings — no provider SDK.
 */

// Routed through Vercel AI Gateway via "provider/model" strings.
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

/** True when a gateway/provider key is present so real calls can be made. */
export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/** True when an ElevenLabs key is present for real TTS. */
export const hasTTS = () => Boolean(process.env.ELEVENLABS_API_KEY);

/** True when an image-generation provider key is present. */
export const hasImageGen = () =>
  Boolean(process.env.IMAGE_PROVIDER_API_KEY || process.env.FAL_API_KEY);

// Re-export so downstream modules import a single AI surface from here.
export { generateText, generateObject };
