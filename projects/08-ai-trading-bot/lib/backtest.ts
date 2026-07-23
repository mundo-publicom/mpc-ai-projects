import type {
  Backtest,
  BacktestMetrics,
  Candle,
  EquityPoint,
  Strategy,
  Trade,
} from "@/lib/types";
import { computeRuleAction } from "@/lib/signals";

/**
 * Deterministic, self-contained backtester over a (mock or supplied) daily OHLC
 * series. Everything is seedable so a given strategy + seed always produces the
 * same equity curve — essential for a research tool where results must be
 * reproducible and auditable.
 *
 * Modeling simplifications (documented on purpose): long/flat only, next-open
 * fill is approximated by the signal bar's close, fixed bps cost + slippage,
 * one instrument, no dividends/borrow. These make the demo transparent, not
 * production-accurate — see docs/TECHNICAL_SPEC.md.
 */

const TRADING_DAYS = 252;
const COST_BPS = 5; // round-trip friction proxy, in basis points per fill

/** Small, fast, seedable PRNG (mulberry32) — deterministic across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform generator. */
function nextNormal(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Generate a synthetic geometric-random-walk OHLC series with mild drift and a
 * slow regime cycle so trend/mean-reversion strategies have something to chew.
 */
export function generateMockCandles(opts: {
  bars: number;
  seed: number;
  startPrice?: number;
  startDate?: Date;
}): Candle[] {
  const { bars, seed, startPrice = 100, startDate } = opts;
  const rng = mulberry32(seed);
  const candles: Candle[] = [];
  let price = startPrice;
  const start = startDate ?? new Date(Date.now() - bars * 86_400_000);

  for (let i = 0; i < bars; i++) {
    const drift = 0.0003; // ~7.5%/yr baseline
    const regime = Math.sin(i / 40) * 0.0006; // slow bull/bear cycle
    const shock = nextNormal(rng) * 0.011; // ~17.5% annualized vol
    const ret = drift + regime + shock;
    const open = price;
    const close = Math.max(1, open * (1 + ret));
    const high = Math.max(open, close) * (1 + Math.abs(nextNormal(rng)) * 0.004);
    const low = Math.min(open, close) * (1 - Math.abs(nextNormal(rng)) * 0.004);
    const volume = Math.round(1_000_000 * (0.8 + rng() * 0.6));
    const d = new Date(start.getTime() + i * 86_400_000);
    candles.push({
      t: d.toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume,
    });
    price = close;
  }
  return candles;
}

interface OpenLot {
  qty: number;
  entry: number;
}

/**
 * Run the strategy bar-by-bar. Long/flat: `buy` opens/holds a position sized by
 * `maxPositionPct`, `sell`/stop/target/`drawdown halt` flattens it.
 */
export function runBacktest(args: {
  strategy: Strategy;
  candles: Candle[];
}): Backtest {
  const { strategy, candles } = args;
  const closes: number[] = [];
  let cash = strategy.startingCapital;
  let lot: OpenLot | null = null;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  const dailyReturns: number[] = [];

  let peak = strategy.startingCapital;
  let prevEquity = strategy.startingCapital;
  let tradeSeq = 0;

  const minBars = strategy.slowWindow + 1;

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];
    closes.push(bar.close);
    const price = bar.close;

    const equityBefore = cash + (lot ? lot.qty * price : 0);
    const drawdown = peak > 0 ? equityBefore / peak - 1 : 0;

    // --- Exit checks on any open lot (stop / target / drawdown halt). ---
    if (lot) {
      const change = price / lot.entry - 1;
      let exitReason: string | null = null;
      if (strategy.risk.stopLossPct > 0 && change <= -strategy.risk.stopLossPct) exitReason = `stop-loss ${(change * 100).toFixed(1)}%`;
      else if (strategy.risk.takeProfitPct > 0 && change >= strategy.risk.takeProfitPct) exitReason = `take-profit ${(change * 100).toFixed(1)}%`;
      if (exitReason) {
        cash += sell(lot.qty, price, trades, `${strategy.symbol}`, bar.t, ++tradeSeq, exitReason);
        lot = null;
      }
    }

    // --- Rule signal on history up to and including this bar. ---
    if (i + 1 >= minBars) {
      const rule = computeRuleAction(strategy, candles.slice(0, i + 1));
      const entriesHalted = drawdown <= -strategy.risk.maxDrawdownPct;

      if (rule.action === "buy" && rule.strength >= strategy.risk.minConfidence && !lot && !entriesHalted) {
        const alloc = equityBefore * strategy.risk.maxPositionPct;
        const qty = Math.floor(alloc / price);
        if (qty > 0) {
          cash -= buy(qty, price, trades, strategy.symbol, bar.t, ++tradeSeq, rule.detail);
          lot = { qty, entry: price };
        }
      } else if (rule.action === "sell" && lot) {
        cash += sell(lot.qty, price, trades, strategy.symbol, bar.t, ++tradeSeq, rule.detail);
        lot = null;
      }
    }

    // --- Mark-to-market + equity point. ---
    const equity = cash + (lot ? lot.qty * price : 0);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? equity / peak - 1 : 0;
    equityCurve.push({ t: bar.t, equity: round2(equity), peak: round2(peak), drawdown: round4(dd) });
    if (i > 0 && prevEquity > 0) dailyReturns.push(equity / prevEquity - 1);
    prevEquity = equity;
  }

  // Flatten any residual position at the last close for clean accounting.
  if (lot) {
    const last = candles[candles.length - 1];
    cash += sell(lot.qty, last.close, trades, strategy.symbol, last.t, ++tradeSeq, "final flatten");
    lot = null;
  }

  const metrics = computeMetrics({
    startingCapital: strategy.startingCapital,
    finalEquity: cash,
    dailyReturns,
    equityCurve,
    trades,
    candles,
  });

  return {
    id: `bt_${Date.now().toString(36)}`,
    strategy,
    from: candles[0]?.t ?? "",
    to: candles[candles.length - 1]?.t ?? "",
    bars: candles.length,
    equityCurve,
    metrics,
    trades,
    createdAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Fills                                                                       */
/* -------------------------------------------------------------------------- */

function buy(qty: number, price: number, trades: Trade[], symbol: string, t: string, seq: number, reason: string): number {
  const gross = qty * price;
  const cost = (gross * COST_BPS) / 10_000;
  trades.push({ id: `t${seq}`, symbol, side: "buy", qty, price: round2(price), cost: round2(cost), executedAt: t, mode: "paper", reason });
  return gross + cost; // cash out
}

function sell(qty: number, price: number, trades: Trade[], symbol: string, t: string, seq: number, reason: string): number {
  const gross = qty * price;
  const cost = (gross * COST_BPS) / 10_000;
  trades.push({ id: `t${seq}`, symbol, side: "sell", qty, price: round2(price), cost: round2(cost), executedAt: t, mode: "paper", reason });
  return gross - cost; // cash in
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                     */
/* -------------------------------------------------------------------------- */

function computeMetrics(args: {
  startingCapital: number;
  finalEquity: number;
  dailyReturns: number[];
  equityCurve: EquityPoint[];
  trades: Trade[];
  candles: Candle[];
}): BacktestMetrics {
  const { startingCapital, finalEquity, dailyReturns, equityCurve, trades, candles } = args;

  const totalReturnPct = (finalEquity / startingCapital - 1) * 100;

  const mean = dailyReturns.length ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (dailyReturns.length - 1)
    : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(TRADING_DAYS) : 0;
  const volatilityPct = std * Math.sqrt(TRADING_DAYS) * 100;

  const maxDrawdownPct = equityCurve.reduce((min, p) => Math.min(min, p.drawdown), 0) * 100;

  // Hit rate over matched buy→sell round trips (FIFO, long-only).
  const { closed, wins } = pairTrades(trades);
  const hitRate = closed > 0 ? wins / closed : 0;

  const first = candles[0]?.close ?? 1;
  const last = candles[candles.length - 1]?.close ?? first;
  const buyHoldReturnPct = (last / first - 1) * 100;

  return {
    totalReturnPct: round2(totalReturnPct),
    sharpe: round2(sharpe),
    maxDrawdownPct: round2(maxDrawdownPct),
    hitRate: round4(hitRate),
    trades: closed,
    volatilityPct: round2(volatilityPct),
    buyHoldReturnPct: round2(buyHoldReturnPct),
  };
}

/** Count closed round trips and how many were profitable (net of costs). */
function pairTrades(trades: Trade[]): { closed: number; wins: number } {
  let entry: Trade | null = null;
  let closed = 0;
  let wins = 0;
  for (const tr of trades) {
    if (tr.side === "buy") entry = tr;
    else if (tr.side === "sell" && entry) {
      const pnl = (tr.price - entry.price) * Math.min(tr.qty, entry.qty) - tr.cost - entry.cost;
      closed += 1;
      if (pnl > 0) wins += 1;
      entry = null;
    }
  }
  return { closed, wins };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
