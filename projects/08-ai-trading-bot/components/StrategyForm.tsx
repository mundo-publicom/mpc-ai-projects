"use client";

import type { Strategy, StrategyRuleKind } from "@/lib/types";

const RULE_LABELS: Record<StrategyRuleKind, string> = {
  sma_crossover: "SMA crossover (trend)",
  rsi_reversion: "RSI mean-reversion",
  momentum: "Momentum",
  breakout: "Channel breakout",
};

interface Props {
  strategy: Strategy;
  onChange: (next: Strategy) => void;
  onRunBacktest: () => void;
  onGenerateSignal: () => void;
  busy: { backtest: boolean; signal: boolean };
}

export function StrategyForm({ strategy, onChange, onRunBacktest, onGenerateSignal, busy }: Props) {
  const set = <K extends keyof Strategy>(key: K, value: Strategy[K]) =>
    onChange({ ...strategy, [key]: value });
  const setRisk = <K extends keyof Strategy["risk"]>(key: K, value: Strategy["risk"][K]) =>
    onChange({ ...strategy, risk: { ...strategy.risk, [key]: value } });

  return (
    <section className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Strategy builder
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Name">
          <input
            className={inputCls}
            value={strategy.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Symbol">
          <input
            className={inputCls}
            value={strategy.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Rule">
          <select
            className={inputCls}
            value={strategy.kind}
            onChange={(e) => set("kind", e.target.value as StrategyRuleKind)}
          >
            {(Object.keys(RULE_LABELS) as StrategyRuleKind[]).map((k) => (
              <option key={k} value={k}>
                {RULE_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starting capital (USD)">
          <input
            type="number"
            className={inputCls}
            value={strategy.startingCapital}
            onChange={(e) => set("startingCapital", Number(e.target.value) || 0)}
          />
        </Field>

        <Field label={`Fast window (${strategy.fastWindow})`}>
          <input
            type="range"
            min={2}
            max={100}
            value={strategy.fastWindow}
            onChange={(e) => set("fastWindow", Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </Field>
        <Field label={`Slow window (${strategy.slowWindow})`}>
          <input
            type="range"
            min={5}
            max={200}
            value={strategy.slowWindow}
            onChange={(e) => set("slowWindow", Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </Field>

        <Field label={`Sentiment weight (${(strategy.sentimentWeight * 100).toFixed(0)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={strategy.sentimentWeight * 100}
            onChange={(e) => set("sentimentWeight", Number(e.target.value) / 100)}
            className="w-full accent-brand-500"
          />
        </Field>
        <Field label={`Min confidence (${(strategy.risk.minConfidence * 100).toFixed(0)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={strategy.risk.minConfidence * 100}
            onChange={(e) => setRisk("minConfidence", Number(e.target.value) / 100)}
            className="w-full accent-brand-500"
          />
        </Field>

        <Field label={`Stop-loss (${(strategy.risk.stopLossPct * 100).toFixed(0)}%)`}>
          <input
            type="range"
            min={0}
            max={50}
            value={strategy.risk.stopLossPct * 100}
            onChange={(e) => setRisk("stopLossPct", Number(e.target.value) / 100)}
            className="w-full accent-loss-500"
          />
        </Field>
        <Field label={`Max position (${(strategy.risk.maxPositionPct * 100).toFixed(0)}%)`}>
          <input
            type="range"
            min={1}
            max={100}
            value={strategy.risk.maxPositionPct * 100}
            onChange={(e) => setRisk("maxPositionPct", Number(e.target.value) / 100)}
            className="w-full accent-brand-500"
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onRunBacktest}
          disabled={busy.backtest}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy.backtest ? "Backtesting…" : "Run backtest"}
        </button>
        <button
          onClick={onGenerateSignal}
          disabled={busy.signal}
          className="rounded-lg border border-brand-500/50 px-4 py-2 text-sm font-semibold text-brand-300 hover:bg-brand-500/10 disabled:opacity-50"
        >
          {busy.signal ? "Generating…" : "Generate signal"}
        </button>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-700 bg-ink-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
