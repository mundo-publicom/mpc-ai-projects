"use client";

import { useMemo, useState } from "react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { StrategyForm } from "@/components/StrategyForm";
import { BacktestResults } from "@/components/BacktestResults";
import { PaperPortfolio } from "@/components/PaperPortfolio";
import type {
  Backtest,
  BacktestResponse,
  Portfolio,
  Signal,
  SignalResponse,
  Strategy,
  Trade,
} from "@/lib/types";

const DEFAULT_STRATEGY: Strategy = {
  id: "demo",
  name: "SPY trend-follow",
  symbol: "SPY",
  kind: "sma_crossover",
  fastWindow: 10,
  slowWindow: 30,
  sentimentWeight: 0.3,
  startingCapital: 100_000,
  risk: {
    maxPositionPct: 0.2,
    stopLossPct: 0.08,
    takeProfitPct: 0.15,
    maxDrawdownPct: 0.25,
    minConfidence: 0.55,
  },
  executionMode: "paper",
  notes: "",
};

const DEFAULT_HEADLINES = [
  "Analysts upgrade SPY components as earnings beat expectations",
  "Fed signals rate cuts could fuel a broad market rally",
  "Tech megacaps post record quarterly profit, raising guidance",
  "Some strategists warn of stretched valuations and volatility risk",
].join("\n");

export default function Page() {
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [headlinesText, setHeadlinesText] = useState(DEFAULT_HEADLINES);
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState({ backtest: false, signal: false });

  const [portfolio, setPortfolio] = useState<Portfolio>(() => makeEmptyPortfolio(DEFAULT_STRATEGY.startingCapital));
  const [trades, setTrades] = useState<Trade[]>([]);

  const headlines = useMemo(
    () =>
      headlinesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title) => ({ source: "news", title, publishedAt: new Date().toISOString().slice(0, 10) })),
    [headlinesText],
  );

  async function runBacktest() {
    setBusy((b) => ({ ...b, backtest: true }));
    setError(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategy, bars: 504, seed: 42 }),
      });
      const data = (await res.json()) as BacktestResponse | { error: string };
      if (!res.ok || !("backtest" in data)) throw new Error("error" in data ? data.error : "Backtest failed");
      setBacktest(data.backtest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setBusy((b) => ({ ...b, backtest: false }));
    }
  }

  async function generateSignal() {
    setBusy((b) => ({ ...b, signal: true }));
    setError(null);
    try {
      const res = await fetch("/api/signal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategy, headlines }),
      });
      const data = (await res.json()) as SignalResponse | { error: string };
      if (!res.ok || !("signal" in data)) throw new Error("error" in data ? data.error : "Signal failed");
      setSignal(data.signal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signal failed");
    } finally {
      setBusy((b) => ({ ...b, signal: false }));
    }
  }

  function executeSignal() {
    if (!signal || signal.action === "hold") return;
    setPortfolio((prev) => {
      const { portfolio: next, trade } = applyPaperTrade(prev, signal, strategy);
      if (trade) setTrades((t) => [...t, trade]);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          <h1 className="text-xl font-bold text-slate-100">AI Trading Bot — Research Sandbox</h1>
        </div>
        <p className="text-sm text-slate-400">
          Define a rules-based strategy, blend it with AI news-sentiment, backtest on reproducible
          data, and paper-trade. Rules lead; AI advises; a hard risk gate has the final say.
        </p>
      </header>

      <DisclaimerBanner />

      {error && (
        <p className="rounded-lg border border-loss-500/40 bg-loss-500/10 px-4 py-2 text-sm text-loss-500">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <StrategyForm
            strategy={strategy}
            onChange={setStrategy}
            onRunBacktest={runBacktest}
            onGenerateSignal={generateSignal}
            busy={busy}
          />

          <section className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              News headlines (sentiment input)
            </h2>
            <textarea
              value={headlinesText}
              onChange={(e) => setHeadlinesText(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-md border border-slate-700 bg-ink-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
              placeholder="One headline per line…"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Without an AI key the app scores these with a deterministic lexicon; with a key,
              they are analyzed via <code className="text-slate-400">generateObject</code>.
            </p>
          </section>

          <BacktestResults backtest={backtest} />
        </div>

        <PaperPortfolio
          signal={signal}
          portfolio={portfolio}
          trades={trades}
          onExecute={executeSignal}
        />
      </div>

      <footer className="border-t border-slate-800 pt-4">
        <DisclaimerBanner compact />
      </footer>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Client-side paper executor (mirrors the server risk model, long/flat)      */
/* -------------------------------------------------------------------------- */

function makeEmptyPortfolio(cash: number): Portfolio {
  return {
    mode: "paper",
    cash,
    equity: cash,
    positions: [],
    realizedPnl: 0,
    unrealizedPnl: 0,
    updatedAt: new Date().toISOString(),
  };
}

function applyPaperTrade(
  prev: Portfolio,
  signal: Signal,
  strategy: Strategy,
): { portfolio: Portfolio; trade: Trade | null } {
  const price = signal.price;
  const existing = prev.positions.find((p) => p.symbol === signal.symbol);
  const now = new Date().toISOString();
  const seq = Date.now().toString(36);

  if (signal.action === "buy" && !existing) {
    const alloc = prev.equity * strategy.risk.maxPositionPct;
    const qty = Math.floor(alloc / price);
    if (qty <= 0) return { portfolio: prev, trade: null };
    const cost = (qty * price * 5) / 10_000;
    const cash = prev.cash - qty * price - cost;
    const positions = [
      ...prev.positions,
      { symbol: signal.symbol, qty, avgPrice: price, marketPrice: price, unrealizedPnl: 0 },
    ];
    return {
      portfolio: reprice({ ...prev, cash, positions, updatedAt: now }, signal.symbol, price),
      trade: { id: `p${seq}`, symbol: signal.symbol, side: "buy", qty, price, cost, executedAt: now, mode: "paper", reason: signal.rationale.slice(0, 80) },
    };
  }

  if (signal.action === "sell" && existing) {
    const gross = existing.qty * price;
    const cost = (gross * 5) / 10_000;
    const realized = (price - existing.avgPrice) * existing.qty - cost;
    const cash = prev.cash + gross - cost;
    const positions = prev.positions.filter((p) => p.symbol !== signal.symbol);
    const equity = cash + positions.reduce((s, p) => s + p.qty * p.marketPrice, 0);
    return {
      portfolio: {
        ...prev,
        cash,
        positions,
        equity,
        realizedPnl: prev.realizedPnl + realized,
        unrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
        updatedAt: now,
      },
      trade: { id: `p${seq}`, symbol: signal.symbol, side: "sell", qty: existing.qty, price, cost, executedAt: now, mode: "paper", reason: signal.rationale.slice(0, 80) },
    };
  }

  return { portfolio: prev, trade: null };
}

/** Re-mark a position and recompute equity/unrealized. */
function reprice(p: Portfolio, symbol: string, price: number): Portfolio {
  const positions = p.positions.map((pos) =>
    pos.symbol === symbol
      ? { ...pos, marketPrice: price, unrealizedPnl: (price - pos.avgPrice) * pos.qty }
      : pos,
  );
  const equity = p.cash + positions.reduce((s, pos) => s + pos.qty * pos.marketPrice, 0);
  const unrealizedPnl = positions.reduce((s, pos) => s + pos.unrealizedPnl, 0);
  return { ...p, positions, equity, unrealizedPnl };
}
