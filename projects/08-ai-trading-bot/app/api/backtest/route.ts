import { NextResponse } from "next/server";
import {
  BacktestRequestSchema,
  NOT_ADVICE_DISCLAIMER,
  type BacktestResponse,
} from "@/lib/types";
import { runBacktest, generateMockCandles } from "@/lib/backtest";

// Node.js runtime (Fluid Compute on Vercel). Pure CPU work, no external calls.
export const runtime = "nodejs";

/**
 * POST /api/backtest
 *
 * Runs the deterministic backtest over a supplied candle series or a synthetic
 * seeded series, and returns the equity curve + research metrics (total return,
 * Sharpe, max drawdown, hit-rate, volatility, buy&hold benchmark). No AI, no
 * network — reproducible for a given { strategy, seed, bars }.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<BacktestResponse | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BacktestRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { strategy, bars, seed, candles } = parsed.data;

  const series =
    candles ??
    generateMockCandles({ bars, seed, startPrice: 100 });

  if (series.length < strategy.slowWindow + 1) {
    return NextResponse.json(
      { error: `Need at least ${strategy.slowWindow + 1} bars for slowWindow=${strategy.slowWindow}` },
      { status: 422 },
    );
  }

  const backtest = runBacktest({ strategy, candles: series });

  const body: BacktestResponse = {
    backtest,
    disclaimer: NOT_ADVICE_DISCLAIMER,
  };
  return NextResponse.json(body);
}
