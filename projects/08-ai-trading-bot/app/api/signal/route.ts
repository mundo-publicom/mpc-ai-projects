import { NextResponse } from "next/server";
import {
  SignalRequestSchema,
  NOT_ADVICE_DISCLAIMER,
  type SignalResponse,
} from "@/lib/types";
import { hasAI, MODELS, analyzeSentiment, mockSentiment } from "@/lib/ai";
import { computeRuleAction, blendSignal } from "@/lib/signals";
import { generateMockCandles } from "@/lib/backtest";

// Node.js runtime (Fluid Compute on Vercel) — avoids edge-only limitations.
export const runtime = "nodejs";

/**
 * POST /api/signal
 *
 * Core value path. Given a strategy config, a (mock or supplied) market
 * snapshot, and recent headlines, produce ONE risk-checked trade signal.
 *
 * Pipeline: deterministic rule (computeRuleAction) → AI sentiment read
 * (generateObject, or mock) → blend + hard risk gate (blendSignal). The AI is
 * an advisor only; the rule and risk gate are pure functions. Falls back to a
 * fully-working mock when no API key is configured or the model errors.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<SignalResponse | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignalRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { strategy, headlines } = parsed.data;

  // Use the supplied snapshot, else synthesize a deterministic mock series long
  // enough for the strategy's slow window.
  const candles =
    parsed.data.snapshot?.candles ??
    generateMockCandles({ bars: Math.max(strategy.slowWindow + 20, 60), seed: 7, startPrice: 100 });

  if (candles.length < 2) {
    return NextResponse.json({ error: "Snapshot needs at least 2 candles" }, { status: 422 });
  }

  const rule = computeRuleAction(strategy, candles);

  const started = Date.now();
  let usedAI = false;
  let model: string | null = null;
  let sentiment = mockSentiment(strategy.symbol, headlines);

  if (hasAI()) {
    try {
      const res = await analyzeSentiment(strategy.symbol, headlines, MODELS.smart);
      sentiment = res.sentiment;
      model = res.model;
      usedAI = true;
    } catch {
      // Degrade to the deterministic sentiment on any model/gateway error.
      sentiment = mockSentiment(strategy.symbol, headlines);
      usedAI = false;
    }
  }

  const signal = blendSignal({ strategy, candles, rule, sentiment, usedAI, model });

  const body: SignalResponse = {
    signal,
    meta: { usedAI, model, latencyMs: Date.now() - started },
    disclaimer: NOT_ADVICE_DISCLAIMER,
  };
  return NextResponse.json(body);
}
