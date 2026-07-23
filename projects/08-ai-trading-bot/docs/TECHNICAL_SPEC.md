# Technical Spec — AI Trading Bot (Research Sandbox)

> Research/education tool. All output is hypothetical and not financial advice. Execution is
> paper (simulated) by default; live is a gated, opt-in, later-milestone feature.

## 1. System overview

A Next.js 15 (App Router, TS strict) application. Domain logic lives in `lib/` and is exercised by
two real API routes. The signal pipeline is **rules-lead, AI-advises, risk-decides**: deterministic
indicators produce an action, an AI layer contributes a structured news-sentiment read, and a hard
risk gate blends them and can veto. The backtester is fully deterministic and seedable. The app runs
end-to-end with **zero API keys** via graceful mock fallback.

```
lib/types.ts     — zod schemas + inferred TS types (single source of truth)
lib/ai.ts        — model access (MODELS, hasAI), sentiment via generateObject, mock sentiment
lib/signals.ts   — indicators, deterministic rule engine, sentiment blend, risk gate
lib/backtest.ts  — seeded synthetic OHLC + deterministic backtest simulation + metrics
app/api/signal   — POST: strategy + snapshot + headlines → risk-checked Signal
app/api/backtest — POST: strategy + seed/bars/candles → equity curve + metrics
app/page.tsx     — dashboard: builder, backtest chart, paper portfolio, disclaimers
components/       — StrategyForm, BacktestResults, PaperPortfolio, DisclaimerBanner
```

## 2. Component breakdown

- **Market data adapter** *(M2; scaffold uses synthetic OHLC).* Normalizes vendor candles
  (Polygon/Alpha Vantage/Finnhub) into the internal `Candle` model. In M1, `generateMockCandles`
  produces a deterministic geometric-random-walk series with drift + a slow regime cycle so
  trend/reversion strategies have signal.
- **Strategy engine** (`lib/signals.ts`). Pure indicator functions (`sma`, `rsi`, `momentum`) and
  `computeRuleAction(strategy, candles)` → `{ action, strength, detail }`. Deterministic, no I/O,
  no look-ahead (only uses closes up to the current bar).
- **Signal generator** (`lib/ai.ts` + `lib/signals.ts`). `analyzeSentiment` calls `generateObject`
  for a structured `Sentiment`; `mockSentiment` is the deterministic fallback. `blendSignal`
  combines rule + sentiment and runs the risk gate.
- **Backtester** (`lib/backtest.ts`). Bar-by-bar simulation (long/flat), position sizing from
  `maxPositionPct`, stop-loss/take-profit exits, drawdown halt on new entries, bps friction, and
  metric computation (Sharpe, drawdown, hit-rate, volatility, buy&hold benchmark).
- **Paper-trading executor.** Server backtester is the historical simulator; the dashboard also
  includes a client-side paper executor (`applyPaperTrade` in `app/page.tsx`) that mirrors the same
  long/flat + friction model so users can step signals into a live-updating simulated portfolio. M3
  adds Alpaca **paper** account sync server-side.
- **Risk manager** (`blendSignal`). Enforces: min-confidence gate, sentiment-contradiction downgrade,
  and portfolio drawdown halt. Emits `riskBlocked` + `riskNotes`. In the backtester the same limits
  (stop/target/drawdown/sizing) are applied per bar.

## 3. Data models (typed)

All models are zod schemas in `lib/types.ts` with inferred TS types. Key models:

```ts
type Action = "buy" | "sell" | "hold";
type ExecutionMode = "paper" | "live";           // paper is the default everywhere

interface Candle { t: string; open: number; high: number; low: number; close: number; volume: number; }
interface Headline { source: string; title: string; publishedAt: string; url?: string; }

interface RiskLimits {
  maxPositionPct: number;   // 0-1 of equity per position
  stopLossPct: number;      // 0-1 below entry
  takeProfitPct: number;    // 0-5 above entry (0 = off)
  maxDrawdownPct: number;   // 0-1 portfolio DD halting new entries
  minConfidence: number;    // 0-1 to act
}

interface Strategy {
  id: string; name: string; symbol: string;
  kind: "sma_crossover" | "rsi_reversion" | "momentum" | "breakout";
  fastWindow: number; slowWindow: number;
  sentimentWeight: number;  // 0-1 tilt from news sentiment
  startingCapital: number;
  risk: RiskLimits;
  executionMode: ExecutionMode;  // default "paper"
  notes: string;
}

interface Sentiment {         // structured AI (generateObject) output
  score: number;              // -1..1
  label: "bearish" | "neutral" | "bullish";
  rationale: string;          // one sentence, grounded in supplied headlines
  drivers: string[];
}

interface Signal {
  symbol: string;
  action: Action;             // final, risk-checked
  ruleAction: Action;         // pure rules, pre-sentiment/risk
  confidence: number;         // 0-1 blended
  sentiment: Sentiment;
  rationale: string;
  riskBlocked: boolean; riskNotes: string[];
  price: number; generatedAt: string;
  usedAI: boolean; model: string | null;
}

interface Trade { id: string; symbol: string; side: "buy"|"sell"; qty: number; price: number;
  cost: number; executedAt: string; mode: ExecutionMode; reason: string; }
interface Position { symbol: string; qty: number; avgPrice: number; marketPrice: number; unrealizedPnl: number; }
interface Portfolio { mode: ExecutionMode; cash: number; equity: number; positions: Position[];
  realizedPnl: number; unrealizedPnl: number; updatedAt: string; }

interface EquityPoint { t: string; equity: number; peak: number; drawdown: number; }
interface BacktestMetrics { totalReturnPct: number; sharpe: number; maxDrawdownPct: number;
  hitRate: number; trades: number; volatilityPct: number; buyHoldReturnPct: number; }
interface Backtest { id: string; strategy: Strategy; from: string; to: string; bars: number;
  equityCurve: EquityPoint[]; metrics: BacktestMetrics; trades: Trade[]; createdAt: string; }
```

## 4. API surface

All routes run on the Node.js runtime, validate inputs with zod, and return typed JSON. Every
signal/backtest response carries a `disclaimer` string.

### `POST /api/signal`
Request (`SignalRequestSchema`):
```json
{ "strategy": { "...Strategy" }, "snapshot": { "symbol": "SPY", "candles": [ /* Candle[] */ ] }, "headlines": [ { "source": "news", "title": "...", "publishedAt": "2026-07-23" } ] }
```
- `snapshot` optional — when omitted the server synthesizes a deterministic series long enough for
  `slowWindow`.
Response (`SignalResponseSchema`): `{ signal, meta: { usedAI, model, latencyMs }, disclaimer }`.
- Pipeline: `computeRuleAction` → `analyzeSentiment` (or `mockSentiment` when `!hasAI()` / on error)
  → `blendSignal` (blend + risk gate).

### `POST /api/backtest`
Request (`BacktestRequestSchema`): `{ strategy, bars?=504, seed?=42, candles? }`.
Response (`BacktestResponseSchema`): `{ backtest, disclaimer }`.
- Deterministic: same `{strategy, seed, bars}` ⇒ identical output. No network, no AI.

Error contract: `400` invalid JSON, `422` `{ error, details }` on zod failure, `200` on success (the
signal route degrades to mock on model error rather than failing).

## 5. AI / model usage

- **SDK:** Vercel AI SDK v5. Model strings route through the Vercel AI Gateway (`MODELS.smart =
  "anthropic/claude-sonnet-5"`). No provider SDK wiring.
- **Where:** exactly one place — news/social **sentiment analysis** — via `generateObject` with the
  `SentimentSchema` zod schema, a constrained system prompt (ground claims only in supplied
  headlines, calibrated, non-promotional), and `temperature: 0.2`.
- **Rationale:** the human-readable signal `rationale` is composed deterministically from the rule
  detail + sentiment + risk outcome, so the explanation always reflects the actual decision.
- **AI is not the decision-maker.** The rule action and the risk gate are pure functions. Sentiment
  can reinforce/damp confidence and, on strong contradiction (agreement < −0.5 with weight ≥ 0.2),
  downgrade an action to `hold`. It can **never** turn a `hold` into a trade on its own.
- **Fallback:** `hasAI()` false, or any model/gateway error, → `mockSentiment` (deterministic
  lexicon). The response marks `usedAI: false`.

## 6. Third-party integrations

- **Market data (M2):** Polygon, Alpha Vantage, Finnhub via `ALPHAVANTAGE_API_KEY` /
  `POLYGON_API_KEY` / `FINNHUB_API_KEY`. Adapter normalizes to `Candle`.
- **News (M2):** NewsAPI (`NEWSAPI_API_KEY`) or vendor headlines → `Headline`.
- **Brokerage — Alpaca PAPER (M3):** `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`,
  `ALPACA_BASE_URL=https://paper-api.alpaca.markets`. Paper endpoint only unless live is opted in.
- **AI Gateway:** `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY` fallback).
- **Live trading safety switch:** `ENABLE_LIVE_TRADING` must be explicitly `true` to ever allow live
  routing; default/unset = paper-only.

## 7. Risk controls

- **Pre-trade gate** (`blendSignal`): min-confidence, sentiment-contradiction downgrade, drawdown
  halt; emits `riskBlocked` + `riskNotes` for auditability.
- **Position/portfolio limits** (backtester + executor): `maxPositionPct` sizing, `stopLossPct` and
  `takeProfitPct` exits, `maxDrawdownPct` entry halt, modeled bps friction.
- **Paper-by-default:** `executionMode` defaults to `paper`; live requires `ENABLE_LIVE_TRADING` +
  explicit user opt-in + user's own brokerage keys (M5).
- **Kill switch & audit (M5):** global halt flag and append-only audit log of signals/orders.

## 8. Security & privacy

- No secrets in the client bundle; all keys server-side (route handlers on Node runtime).
- Brokerage keys stored encrypted at rest, least-privilege (paper scope by default), never returned
  to the client, rotatable.
- zod validation on every API boundary; typed responses; no eval of user input.
- No PII required for the core sandbox; auth + per-user data in M2 (row-level isolation).
- Rate limiting + auth on API tier (M4) to protect metered AI/data costs.

## 9. Observability

- Structured logs per request: route, `usedAI`, model, latency, `riskBlocked`, fallback reason.
- Metrics: signal latency p50/p95, AI-vs-mock ratio, backtest duration, error rates, sentiment/rule
  agreement distribution.
- Backtest reproducibility check as a CI canary (fixed `{strategy, seed}` → known metrics hash).
- Cost tracking on AI Gateway usage per user/tier for billing + abuse detection.

## 10. Scaling considerations

- Stateless route handlers on Fluid Compute scale horizontally; backtests are CPU-bound and bounded
  (`bars ≤ 2000`).
- Heavy parameter sweeps / walk-forward (M2) offloaded to a queue/worker; results cached by
  `{strategyHash, seed, dataWindow}`.
- Market/news data cached with short TTLs; vendor rate limits handled in the adapter.
- AI cost controlled via model tiering (Haiku for cheap sentiment, Sonnet default), per-tier quotas,
  and response caching for identical headline sets.

## 11. Testing strategy

- **Unit (deterministic core):** indicators (`sma`/`rsi`/`momentum`), `computeRuleAction` on crafted
  series, `blendSignal` risk-gate branches (min-confidence, contradiction downgrade, drawdown halt),
  metric math (Sharpe/drawdown/hit-rate) against hand-computed fixtures.
- **Property/reproducibility:** same `{strategy, seed, bars}` yields identical backtest output; no
  look-ahead (rule at bar *i* uses only data ≤ *i*).
- **API/contract:** zod parse of requests/responses; `422` on bad input; signal route degrades to
  mock (never 5xx) on simulated model error.
- **Integration:** end-to-end signal + backtest with and without `AI_GATEWAY_API_KEY`; mock path is
  the default CI path (no external calls).
- **UI:** disclaimer banner always present; paper executor never mutates on `hold`.
