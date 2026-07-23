# AI Trading Bot — Research Sandbox

> ## ⚠️ NOT FINANCIAL ADVICE
> **This is a research and education tool. It does not provide financial, investment, or
> trading advice and is not a broker-dealer or investment adviser.** Every signal, backtest,
> and metric it produces is **hypothetical**, may contain errors, and is **not a
> recommendation** to buy or sell any security. **Simulated and past performance does not
> guarantee future results. Trading involves substantial risk of loss, up to your entire
> capital.** All execution defaults to **PAPER (simulated)** trading. Live trading is an
> explicit, off-by-default opt-in that routes through *your own* licensed brokerage account,
> and you are solely responsible for every decision you make. Consult a licensed professional
> before investing.

---

## Business case

A subscription SaaS for retail algo-traders, quant hobbyists, and trading educators who want to
**design, sentiment-augment, backtest, and paper-trade** strategies without writing infrastructure.
Who pays and for what:

- **Retail algo-traders** ($29/mo Pro) — unlimited backtests, more strategy rules, live-broker paper
  sync, AI news-sentiment on their watchlist.
- **Quant hobbyists / power users** ($99/mo Quant) — API access, higher compute limits, walk-forward
  analysis, data export.
- **Educators & creators** ($199/mo Educator, seats) — shareable strategy templates, classroom
  cohorts, white-labelable disclaimers.
- **Free tier** — capped backtests + mock sentiment, to drive top-of-funnel.

The commercial wedge is **AI-assisted research + reproducible backtesting behind a compliance-first
posture** (paper-by-default, disclaimers everywhere). We monetize research and tooling, never
"guaranteed returns" — there are none.

## What it does

- **Strategy builder** — pick a rule (SMA crossover, RSI reversion, momentum, breakout), windows,
  sizing, stop-loss/take-profit, drawdown halt, and a sentiment weight.
- **AI-assisted signals** — deterministic indicator rules produce an action; the AI reads news
  headlines and returns a structured sentiment read + rationale (`generateObject` + zod); a hard
  **risk gate** blends them and can veto/downgrade. **The AI is never the sole decision-maker.**
- **Backtester** — reproducible, seeded backtest over synthetic (or supplied) OHLC, returning an
  equity curve and research metrics: total return, Sharpe, max drawdown, hit-rate, volatility, and a
  buy-and-hold benchmark.
- **Paper trading** — simulated portfolio, positions, and trade log. No custody, no real orders.
- **Disclaimers everywhere** — the "not financial advice" banner is a first-class UI element.

## Architecture at a glance

`market data → strategy rules → AI sentiment → risk gate → paper execution → reporting`

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the Mermaid diagram and signal lifecycle,
[`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) for components/data models, and
[`docs/PRD.md`](docs/PRD.md) for product scope, pricing, and the full risk disclosure.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — the app runs fully with NO keys
pnpm dev                     # http://localhost:3000
```

- **Zero keys:** signals use a deterministic sentiment lexicon; backtests are pure CPU. Everything
  works, labeled "AI: mock".
- **With `AI_GATEWAY_API_KEY`:** the signal route calls `generateObject` for real news-sentiment
  analysis (routed as `anthropic/claude-sonnet-5` through the Vercel AI Gateway).

Core endpoints (both real, both validated with zod):

- `POST /api/signal` — `{ strategy, snapshot?, headlines }` → `{ signal, meta, disclaimer }`
- `POST /api/backtest` — `{ strategy, bars?, seed?, candles? }` → `{ backtest, disclaimer }`

## Tech

Next.js 15 (App Router) · TypeScript strict · Tailwind · Vercel AI SDK v5 (`generateObject`) ·
zod · Node.js runtime.

## Roadmap

- **M1 (this scaffold):** strategy builder, seeded backtester, AI+rules+risk signal, paper portfolio.
- **M2:** real market-data adapter (Polygon/Alpha Vantage), live news feed, walk-forward + parameter
  sweeps, saved strategies (Postgres).
- **M3:** Alpaca **paper** account sync, scheduled signal runs (cron), alerts (email/Slack).
- **M4:** billing (subscription tiers), API access, educator cohorts.
- **M5:** optional, gated live-broker routing behind explicit opt-in, jurisdiction checks, and audit
  logging. Paper remains the default forever.

## License & disclaimer

Provided "as is" for educational purposes, without warranty. Not affiliated with any exchange or
broker. Using this software does not create an advisory relationship. See the disclaimer at the top —
it governs all use.
