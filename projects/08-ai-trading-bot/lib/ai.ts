import { generateText, generateObject } from "ai";
import { z } from "zod";
import { SentimentSchema, type Headline, type Sentiment } from "@/lib/types";

/**
 * Shared model-access layer. All calls route through the Vercel AI Gateway via
 * plain `"provider/model"` strings — no provider SDK wiring.
 *
 * The AI layer's ONLY job here is to read news/social headlines and return a
 * structured sentiment read plus a plain-language rationale. It never places
 * trades and is never the sole decision-maker: deterministic indicator rules
 * and a hard risk gate (see lib/signals.ts) always run alongside it.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * True when an AI Gateway (or direct Anthropic) key is present. When false,
 * API routes fall back to a deterministic mock so the demo runs with zero keys.
 */
export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/** zod schema for the structured sentiment object the model must return. */
export const sentimentSchema = SentimentSchema;

const SENTIMENT_SYSTEM = [
  "You are a financial-news sentiment analyst for a RESEARCH tool.",
  "Read the supplied headlines about a single instrument and judge the",
  "near-term (days-to-weeks) directional sentiment they imply.",
  "",
  "Rules:",
  "- Ground every claim ONLY in the supplied headlines. Do not invent facts.",
  "- score is a float in [-1, 1]: negative = bearish, positive = bullish.",
  "- label must match the sign of score (neutral for |score| < 0.15).",
  "- rationale is ONE sentence, neutral and factual.",
  "- drivers lists the concrete headline themes you weighed.",
  "- You are NOT giving investment advice and NOT deciding any trade;",
  "  a separate rules+risk engine consumes your read. Be calibrated, not",
  "  promotional. When headlines are thin or mixed, stay near neutral.",
].join("\n");

export function buildSentimentPrompt(symbol: string, headlines: Headline[]): string {
  if (headlines.length === 0) {
    return `No fresh headlines for ${symbol}. Return a neutral read (score ~0).`;
  }
  const lines = headlines
    .map((h, i) => `${i + 1}. [${h.source} · ${h.publishedAt}] ${h.title}`)
    .join("\n");
  return [
    `Instrument: ${symbol}`,
    `Headlines (most recent first):`,
    lines,
    ``,
    `Return the structured sentiment read.`,
  ].join("\n");
}

/**
 * Live sentiment call via `generateObject`. Callers must guard with `hasAI()`
 * and wrap in try/catch — on any failure fall back to `mockSentiment`.
 */
export async function analyzeSentiment(
  symbol: string,
  headlines: Headline[],
  model: ModelName = MODELS.smart,
): Promise<{ sentiment: Sentiment; model: string }> {
  const { object } = await generateObject({
    model,
    schema: sentimentSchema,
    system: SENTIMENT_SYSTEM,
    prompt: buildSentimentPrompt(symbol, headlines),
    temperature: 0.2,
  });
  return { sentiment: object, model };
}

/**
 * Deterministic sentiment used when no key is set or the model errors. Uses a
 * tiny lexicon over the headlines so the demo produces sensible, stable output.
 */
export function mockSentiment(symbol: string, headlines: Headline[]): Sentiment {
  const bullish = [
    "beat", "surge", "record", "upgrade", "growth", "profit", "rally",
    "strong", "wins", "raises", "expands", "outperform", "buyback",
  ];
  const bearish = [
    "miss", "plunge", "downgrade", "loss", "lawsuit", "probe", "cut",
    "weak", "recall", "layoff", "slump", "warning", "default", "fraud",
  ];
  let raw = 0;
  const drivers: string[] = [];
  for (const h of headlines) {
    const text = h.title.toLowerCase();
    for (const w of bullish) if (text.includes(w)) { raw += 1; drivers.push(w); }
    for (const w of bearish) if (text.includes(w)) { raw -= 1; drivers.push(w); }
  }
  const n = Math.max(headlines.length, 1);
  const score = Math.max(-1, Math.min(1, raw / n));
  const label = score > 0.15 ? "bullish" : score < -0.15 ? "bearish" : "neutral";
  const uniqueDrivers = Array.from(new Set(drivers)).slice(0, 6);
  const rationale =
    headlines.length === 0
      ? `No fresh headlines for ${symbol}; treating sentiment as neutral.`
      : `Lexical scan of ${headlines.length} headline(s) for ${symbol} reads ${label} ` +
        `(${uniqueDrivers.length ? "keywords: " + uniqueDrivers.join(", ") : "no strong keywords"}).`;
  return { score, label, rationale, drivers: uniqueDrivers };
}

// Re-export the primitives used across the app so routes import from one place.
export { generateText, generateObject, z };
