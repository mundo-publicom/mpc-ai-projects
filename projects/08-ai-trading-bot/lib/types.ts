import { z } from "zod";

/**
 * Domain models for the AI Trading Bot (research-grade).
 *
 * Every model has a matching zod schema so a single definition validates API
 * inputs, structures AI (`generateObject`) output, and types the UI.
 *
 * IMPORTANT: This is a RESEARCH / EDUCATION tool. Nothing here constitutes
 * financial advice, and no model output is a recommendation to buy or sell any
 * security. All execution defaults to PAPER (simulated) trading.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** Trade side / signal action. `hold` means take no new position. */
export const ActionSchema = z.enum(["buy", "sell", "hold"]);
export type Action = z.infer<typeof ActionSchema>;

/** Where an order is (or would be) routed. Paper is the default everywhere. */
export const ExecutionModeSchema = z.enum(["paper", "live"]);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

/** A single OHLCV candle. `t` is an ISO date (daily bars in the scaffold). */
export const CandleSchema = z.object({
  t: z.string(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
});
export type Candle = z.infer<typeof CandleSchema>;

/** A news/social headline fed to the sentiment stage. */
export const HeadlineSchema = z.object({
  source: z.string(),
  title: z.string().min(1).max(500),
  publishedAt: z.string(),
  url: z.string().optional(),
});
export type Headline = z.infer<typeof HeadlineSchema>;

/* -------------------------------------------------------------------------- */
/* Strategy                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A rules-based strategy definition. The rules run deterministically; the AI
 * layer only annotates sentiment and rationale — it is never the sole decider.
 */
export const StrategyRuleKindSchema = z.enum([
  "sma_crossover", // fast SMA crosses slow SMA
  "rsi_reversion", // buy oversold, sell overbought
  "momentum", // trade in the direction of recent return
  "breakout", // trade N-day high/low breakouts
]);
export type StrategyRuleKind = z.infer<typeof StrategyRuleKindSchema>;

export const RiskLimitsSchema = z.object({
  /** Max fraction of portfolio equity allocated to a single position (0-1). */
  maxPositionPct: z.number().min(0.01).max(1).default(0.2),
  /** Hard stop-loss as a fraction below entry (0-1). */
  stopLossPct: z.number().min(0).max(1).default(0.08),
  /** Take-profit as a fraction above entry (0-1). 0 disables. */
  takeProfitPct: z.number().min(0).max(5).default(0.15),
  /** Portfolio-level max drawdown that halts new entries (0-1). */
  maxDrawdownPct: z.number().min(0).max(1).default(0.25),
  /** Minimum AI+rules confidence required to act (0-1). */
  minConfidence: z.number().min(0).max(1).default(0.55),
});
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

export const StrategySchema = z.object({
  id: z.string().default(""),
  name: z.string().min(1).max(120),
  /** Instrument the strategy trades (symbol). Single-symbol in the scaffold. */
  symbol: z.string().min(1).max(12).default("SPY"),
  kind: StrategyRuleKindSchema.default("sma_crossover"),
  /** Fast lookback window (bars). Used by SMA/momentum/breakout. */
  fastWindow: z.number().int().min(1).max(200).default(10),
  /** Slow lookback window (bars). Used by SMA/RSI/breakout. */
  slowWindow: z.number().int().min(2).max(400).default(30),
  /** How much the news-sentiment score can tilt the rule signal (0-1). */
  sentimentWeight: z.number().min(0).max(1).default(0.3),
  /** Starting capital for backtests / paper portfolio (USD). */
  startingCapital: z.number().positive().max(1e9).default(100_000),
  risk: RiskLimitsSchema.default({}),
  /** Paper is the default; live requires explicit opt-in elsewhere. */
  executionMode: ExecutionModeSchema.default("paper"),
  notes: z.string().max(2000).default(""),
});
export type Strategy = z.infer<typeof StrategySchema>;

/* -------------------------------------------------------------------------- */
/* Signal                                                                      */
/* -------------------------------------------------------------------------- */

/** The structured object the AI returns via `generateObject`. */
export const SentimentSchema = z.object({
  /** -1 (very bearish) .. +1 (very bullish). */
  score: z.number().min(-1).max(1),
  label: z.enum(["bearish", "neutral", "bullish"]),
  /** One-sentence justification grounded in the supplied headlines. */
  rationale: z.string(),
  /** Notable headline themes the model weighed. */
  drivers: z.array(z.string()).max(8).default([]),
});
export type Sentiment = z.infer<typeof SentimentSchema>;

/**
 * A trade signal. `ruleAction` comes from deterministic indicators; `action`
 * is the final decision after blending sentiment AND passing the risk gate.
 */
export const SignalSchema = z.object({
  symbol: z.string(),
  /** Final, risk-checked action the operator sees. */
  action: ActionSchema,
  /** Action the pure rules produced, before sentiment/risk. */
  ruleAction: ActionSchema,
  /** 0-1 blended confidence (rules strength * sentiment agreement). */
  confidence: z.number().min(0).max(1),
  sentiment: SentimentSchema,
  /** Human-readable explanation combining rules + sentiment. */
  rationale: z.string(),
  /** True when the risk manager vetoed or downgraded the rule action. */
  riskBlocked: z.boolean().default(false),
  /** Any risk notes (e.g. "below minConfidence", "drawdown halt"). */
  riskNotes: z.array(z.string()).default([]),
  /** Reference price the signal was computed against. */
  price: z.number().positive(),
  generatedAt: z.string(),
  /** Whether the sentiment stage used a live model or the mock. */
  usedAI: z.boolean(),
  model: z.string().nullable(),
});
export type Signal = z.infer<typeof SignalSchema>;

/* -------------------------------------------------------------------------- */
/* Trades, Positions, Portfolio                                                */
/* -------------------------------------------------------------------------- */

export const TradeSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  /** Fees + modeled slippage applied to this fill (USD). */
  cost: z.number().nonnegative().default(0),
  executedAt: z.string(),
  mode: ExecutionModeSchema.default("paper"),
  /** Why this trade fired — links a fill back to a signal rationale. */
  reason: z.string().default(""),
});
export type Trade = z.infer<typeof TradeSchema>;

export const PositionSchema = z.object({
  symbol: z.string(),
  qty: z.number(),
  /** Volume-weighted average entry price. */
  avgPrice: z.number().nonnegative(),
  /** Last mark used for valuation. */
  marketPrice: z.number().nonnegative(),
  /** Unrealized P&L in USD at the current mark. */
  unrealizedPnl: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const PortfolioSchema = z.object({
  mode: ExecutionModeSchema.default("paper"),
  cash: z.number(),
  equity: z.number(),
  positions: z.array(PositionSchema).default([]),
  realizedPnl: z.number().default(0),
  unrealizedPnl: z.number().default(0),
  updatedAt: z.string(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

/* -------------------------------------------------------------------------- */
/* Backtest                                                                    */
/* -------------------------------------------------------------------------- */

export const EquityPointSchema = z.object({
  t: z.string(),
  equity: z.number(),
  /** Peak-to-date equity, used to derive drawdown. */
  peak: z.number(),
  /** Drawdown from peak as a negative fraction (0 .. -1). */
  drawdown: z.number(),
});
export type EquityPoint = z.infer<typeof EquityPointSchema>;

/** Research metrics — descriptive only, never a promise of future results. */
export const BacktestMetricsSchema = z.object({
  totalReturnPct: z.number(),
  /** Annualized Sharpe ratio (rf = 0 in the scaffold). */
  sharpe: z.number(),
  /** Worst peak-to-trough decline as a negative fraction. */
  maxDrawdownPct: z.number(),
  /** Fraction of closed trades that were profitable (0-1). */
  hitRate: z.number().min(0).max(1),
  trades: z.number().int().nonnegative(),
  /** Annualized volatility of daily returns. */
  volatilityPct: z.number(),
  /** Return of buy-and-hold over the same window, for context. */
  buyHoldReturnPct: z.number(),
});
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>;

export const BacktestSchema = z.object({
  id: z.string(),
  strategy: StrategySchema,
  from: z.string(),
  to: z.string(),
  bars: z.number().int(),
  equityCurve: z.array(EquityPointSchema),
  metrics: BacktestMetricsSchema,
  trades: z.array(TradeSchema),
  createdAt: z.string(),
});
export type Backtest = z.infer<typeof BacktestSchema>;

/* -------------------------------------------------------------------------- */
/* API payloads                                                                */
/* -------------------------------------------------------------------------- */

/** Point-in-time market snapshot the signal endpoint reasons over. */
export const MarketSnapshotSchema = z.object({
  symbol: z.string().min(1).max(12),
  /** Recent candles, oldest first. At least `slowWindow` for meaningful rules. */
  candles: z.array(CandleSchema).min(2).max(1000),
});
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const SignalRequestSchema = z.object({
  strategy: StrategySchema,
  /** Optional snapshot; when omitted the server synthesizes a mock series. */
  snapshot: MarketSnapshotSchema.optional(),
  headlines: z.array(HeadlineSchema).max(50).default([]),
});
export type SignalRequest = z.infer<typeof SignalRequestSchema>;

export const SignalResponseSchema = z.object({
  signal: SignalSchema,
  meta: z.object({
    usedAI: z.boolean(),
    model: z.string().nullable(),
    latencyMs: z.number().int().nonnegative(),
  }),
  disclaimer: z.string(),
});
export type SignalResponse = z.infer<typeof SignalResponseSchema>;

export const BacktestRequestSchema = z.object({
  strategy: StrategySchema,
  /** Number of daily bars to simulate when no explicit series is supplied. */
  bars: z.number().int().min(30).max(2000).default(504),
  /** Deterministic seed so runs are reproducible. */
  seed: z.number().int().min(0).max(1_000_000).default(42),
  /** Optional explicit candle series (overrides synthetic generation). */
  candles: z.array(CandleSchema).min(30).max(2000).optional(),
});
export type BacktestRequest = z.infer<typeof BacktestRequestSchema>;

export const BacktestResponseSchema = z.object({
  backtest: BacktestSchema,
  disclaimer: z.string(),
});
export type BacktestResponse = z.infer<typeof BacktestResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Shared copy                                                                 */
/* -------------------------------------------------------------------------- */

export const NOT_ADVICE_DISCLAIMER =
  "Research and educational use only. Signals, backtests, and metrics are " +
  "hypothetical, may contain errors, and are NOT financial advice or a " +
  "recommendation to buy or sell any security. Past and simulated performance " +
  "does not guarantee future results. Trading involves substantial risk of " +
  "loss. All execution defaults to PAPER (simulated).";
