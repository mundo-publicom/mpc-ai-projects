# PRD — AI Trading Bot (Research Sandbox)

## 0. Not financial advice / risk disclosure (read first)

This product is a **research and education tool**. It is **not** a broker-dealer, investment
adviser, or financial planner, and it does **not** provide financial, investment, tax, or legal
advice. This section leads the PRD because compliance and honest risk framing are the product's
first requirement, not a footnote.

- **Hypothetical output.** All signals, backtests, sentiment reads, and metrics (Sharpe, drawdown,
  hit-rate, etc.) are hypothetical, model-generated, and may be wrong. They are **not
  recommendations** to buy, sell, or hold any security.
- **No guaranteed returns.** Simulated and past performance **does not guarantee future results.**
  Backtests are subject to overfitting, look-ahead bias, survivorship bias, and modeling error.
- **Substantial risk of loss.** Trading and investing can lose money, up to and including your
  entire capital. Leverage amplifies losses.
- **Paper by default.** All execution is **simulated (paper)** unless the user completes an
  explicit, off-by-default live opt-in that routes through *their own* licensed brokerage.
- **No custody, no fund management.** The product never holds client funds or securities and never
  places discretionary trades on a user's behalf.
- **User responsibility.** The user is solely responsible for their decisions and for compliance
  with the laws of their jurisdiction. They should consult a licensed professional.
- **AI limitations.** AI-generated sentiment and rationale can be inaccurate, biased, or fabricated.
  The AI is an *advisor input only* and is combined with deterministic rules and a hard risk gate;
  it is never the sole decision-maker.

Disclaimers are surfaced prominently in the UI (persistent banner + per-action copy), in API
responses (`disclaimer` field), and in all marketing.

---

## 1. Overview

A platform to **define trading strategies, generate AI-assisted trade signals** from market data +
news sentiment, **backtest** them on reproducible data, and **paper-trade** by default (live is an
explicit opt-in). The core value proposition is *compliance-first, AI-augmented strategy research*:
rules lead, AI advises, and a risk manager has the final say.

## 2. Problem

- Retail traders and hobbyist quants want to test ideas but face fragmented tooling: separate data
  vendors, spreadsheets for backtests, and no structured way to fold qualitative news into rules.
- "AI trading" tools in the market often over-promise ("beat the market," "guaranteed signals"),
  creating regulatory risk and misleading users.
- Educators lack a safe, paper-only sandbox with built-in disclaimers to teach strategy design.

We solve this with a single, honest sandbox: **structured strategies + AI sentiment + reproducible
backtests + paper execution**, wrapped in a paper-by-default, disclaimer-everywhere posture.

## 3. Target users & personas

- **Riya — retail algo-trader.** Trades her own account part-time; wants to backtest rule ideas and
  see whether news sentiment would have helped, then paper-trade the winners before risking capital.
- **Marco — quant hobbyist.** Comfortable with APIs and metrics; wants reproducible backtests,
  parameter sweeps, data export, and programmatic access. Skeptical of black boxes; values the
  deterministic rule core and transparent risk gate.
- **Dr. Chen — trading educator.** Runs a course; needs a safe classroom sandbox with strong
  disclaimers, shareable strategy templates, and no path to accidental real-money trading.

## 4. User stories

1. As Riya, I can pick a rule (e.g. SMA crossover), set windows and stops, and run a backtest to see
   an equity curve and metrics.
2. As Riya, I can paste recent headlines and generate a signal that blends the rule with AI
   sentiment, and I can see *why* (rationale + risk notes).
3. As Riya, I can "execute" a signal into a **paper** portfolio and watch positions/P&L evolve.
4. As Marco, I can call `POST /api/backtest` and `POST /api/signal` directly and get typed JSON.
5. As Marco, I can set a seed so a backtest is byte-for-byte reproducible.
6. As Dr. Chen, I can share a strategy template with students and trust that no real order can fire.
7. As any user, I always see the "not financial advice" disclaimer and understand results are
   hypothetical.

## 5. Functional requirements

1. **Strategy definition.** Users define a `Strategy`: name, symbol, rule kind (SMA crossover, RSI
   reversion, momentum, breakout), fast/slow windows, sentiment weight, starting capital, and risk
   limits (max position %, stop-loss %, take-profit %, max drawdown %, min confidence).
2. **Signal generation.** Given a strategy + market snapshot + headlines, the system computes a
   deterministic rule action, obtains an AI sentiment read (`generateObject` + zod, or mock),
   **blends** them, and applies a **risk gate** that can veto/downgrade to `hold`. Output includes
   `action`, `confidence`, `rationale`, `riskNotes`.
3. **AI is not the sole decider.** The rule action and risk gate are pure functions; sentiment can
   only reinforce/damp conviction and, on strong contradiction, downgrade to `hold`. It can never by
   itself turn a `hold` into a trade.
4. **Backtesting.** Reproducible (seeded) backtest over synthetic or supplied OHLC, long/flat,
   modeling friction (bps), stop-loss/take-profit exits, and a drawdown halt. Returns an equity
   curve + research metrics.
5. **Research metrics.** Total return, annualized Sharpe, max drawdown, hit-rate, annualized
   volatility, and a buy-and-hold benchmark — all labeled as descriptive research statistics.
6. **Paper trading (default).** A simulated portfolio applies executed signals: cash, positions,
   avg price, unrealized/realized P&L, and a trade log. No real orders.
7. **Live trading (opt-in, out-of-scope for M1).** Gated behind `ENABLE_LIVE_TRADING`, explicit user
   opt-in, and the user's own brokerage keys. Paper remains the default forever.
8. **Graceful degradation.** With no API keys, sentiment uses a deterministic lexicon and backtests
   run on synthetic data; the full demo works with zero configuration.
9. **Disclaimers.** Persistent UI banner, per-action copy, and a `disclaimer` field on every
   signal/backtest API response.
10. **Input validation.** All API inputs validated with zod; typed JSON responses.

## 6. Non-functional requirements

- **Reproducibility:** identical `{strategy, seed, bars}` → identical backtest output.
- **Latency:** signal endpoint p95 < 4s with AI, < 100ms on mock; backtest < 500ms for 504 bars.
- **Correctness/transparency:** deterministic core is unit-testable; no look-ahead in the backtester.
- **Security & privacy:** no secrets in client; brokerage keys server-side only; paper-by-default.
- **Accessibility:** WCAG-AA contrast; disclaimers legible and non-dismissible on first view.
- **Portability:** Node.js runtime (Fluid Compute); no edge-only APIs.

## 7. Success metrics / KPIs

**Product/business KPIs**
- Activation: % of new users who run ≥1 backtest and generate ≥1 signal in week 1.
- Conversion: free → paid; trial → paid.
- Retention: 4-week retention of paying users; # strategies saved per active user.
- MRR, ARPU, churn.

**Research quality KPIs (descriptive, not promises)**
- **Sharpe ratio**, **max drawdown**, and **hit-rate** are surfaced as *research metrics* to help
  users evaluate strategies — explicitly framed as hypothetical, never as expected live performance.
- Coverage: % of signals with a non-mock AI sentiment read; sentiment/rule agreement rate.

## 8. Monetization & pricing

Subscription tiers + feature/performance gating. We sell **research tooling and compute**, never
"returns."

| Tier | Price | Who | Key limits/features |
|------|-------|-----|---------------------|
| Free | $0 | Trial / students | Capped backtests/day, mock sentiment only, 1 saved strategy |
| Pro | $29/mo | Retail algo-traders | Unlimited backtests, all rules, AI sentiment, 25 strategies, paper-broker sync |
| Quant | $99/mo | Power users | API access, walk-forward + param sweeps, higher compute, data export |
| Educator | $199/mo (seats) | Educators/creators | Cohorts, shareable templates, white-label disclaimers |

Add-ons: metered API overage; premium market-data pass-through; annual discount.

## 9. Go-to-market

- **Content-led:** publish reproducible strategy studies and "does news sentiment help?" write-ups
  (each with disclaimers) to rank for algo-trading/backtesting queries.
- **Community:** engage r/algotrading, quant Discords, fintwit; free tier as the hook.
- **Education channel:** partner with trading-course creators (Educator tier) — safe sandbox is a
  strong selling point vs. real-money tools.
- **Developer angle:** API + docs for the Quant tier; template gallery for virality.

## 10. Competitive landscape

- **Composer** — no-code strategy building + live brokerage; strength is automation. We differentiate
  on AI news-sentiment as a *transparent advisory input* and a compliance-first, paper-first stance.
- **Trade Ideas** — AI stock scanning/alerts for active traders; real-time and pricey. We focus on
  reproducible research + backtesting + education rather than day-trading alerts.
- **Tickeron** — AI "robots" and pattern signals, performance-marketing heavy. We deliberately avoid
  return promises and lead with risk disclosure.
- **3Commas** — crypto trading bots/automation with exchange connectivity. We are research/education,
  multi-asset-agnostic in design, and paper-by-default.

Our wedge: **rules-lead + AI-advises + hard risk gate + reproducible backtests + disclaimers
everywhere.** Honest framing is a feature.

## 11. Risks & mitigations

**Lead risk — regulatory / "financial advice."** Being construed as an unregistered adviser/broker.
- *Mitigations:* prominent, persistent "not financial advice" disclaimers; no return promises in
  product or marketing; paper-by-default with live strictly opt-in via the user's own brokerage; no
  custody; no discretionary trading; ToS establishing no advisory relationship; jurisdiction checks
  before any live feature; legal review before live launch.

**Misleading performance claims.** Users over-trusting backtests.
- *Mitigations:* label all metrics "hypothetical/research"; show buy-and-hold benchmark; document
  modeling simplifications; roadmap walk-forward + out-of-sample to fight overfitting.

**AI inaccuracy / hallucination.** Sentiment or rationale wrong.
- *Mitigations:* AI is advisory only; deterministic rules + risk gate lead; sentiment grounded in
  supplied headlines via a constrained schema; low temperature; confidence gating; mock fallback.

**Live-trading harm.** A user loses real money.
- *Mitigations:* off-by-default (`ENABLE_LIVE_TRADING`), explicit multi-step opt-in, paper strongly
  recommended, per-order and per-day risk limits, kill switch, audit logging.

**Data quality / vendor outages.** Bad or missing market/news data.
- *Mitigations:* adapter abstraction with fallbacks; data-quality checks; graceful mock degradation.

**Security.** Leaked brokerage keys.
- *Mitigations:* server-side only, encrypted at rest, least-privilege (paper scope by default), never
  sent to the client, rotation support.

## 12. Out of scope

- **No custody** of user funds or securities.
- **No guaranteed returns** or performance claims of any kind.
- **No discretionary/managed trading** on a user's behalf.
- **No tax, legal, or personalized investment advice.**
- **No real-money live trading in M1** (design-only; gated, opt-in, later milestone).
- No options/derivatives pricing engine, no HFT/co-location, no portfolio-margin modeling in M1.

## 13. Milestones / roadmap

- **M1 (this scaffold):** strategy builder, seeded reproducible backtester, AI+rules+risk signal
  pipeline with mock fallback, paper portfolio, disclaimers, two real API routes.
- **M2:** real market-data adapter (Polygon/Alpha Vantage/Finnhub), live news feed, walk-forward +
  parameter sweeps, saved strategies (Postgres), auth.
- **M3:** Alpaca **paper** account sync, scheduled signal runs (cron), alerts (email/Slack), export.
- **M4:** billing + subscription tiers, metered API, educator cohorts/templates.
- **M5:** gated, opt-in live-broker routing with jurisdiction checks, kill switch, full audit trail.
  Paper stays the default.
