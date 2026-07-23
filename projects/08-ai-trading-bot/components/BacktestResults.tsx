"use client";

import type { Backtest } from "@/lib/types";

interface Props {
  backtest: Backtest | null;
}

export function BacktestResults({ backtest }: Props) {
  if (!backtest) {
    return (
      <section className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Backtest
        </h2>
        <p className="text-sm text-slate-500">
          Run a backtest to see the equity curve and research metrics. Results are
          hypothetical and reproducible for a given strategy + seed.
        </p>
      </section>
    );
  }

  const m = backtest.metrics;
  return (
    <section className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Backtest · {backtest.from} → {backtest.to}
        </h2>
        <span className="text-xs text-slate-500">{backtest.bars} bars</span>
      </div>

      <EquityChart backtest={backtest} />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total return" value={pct(m.totalReturnPct)} good={m.totalReturnPct >= 0} />
        <Metric label="Buy & hold" value={pct(m.buyHoldReturnPct)} good={m.buyHoldReturnPct >= 0} muted />
        <Metric label="Sharpe" value={m.sharpe.toFixed(2)} good={m.sharpe >= 1} />
        <Metric label="Max drawdown" value={pct(m.maxDrawdownPct)} good={false} />
        <Metric label="Hit rate" value={`${(m.hitRate * 100).toFixed(0)}%`} good={m.hitRate >= 0.5} />
        <Metric label="Volatility (ann.)" value={pct(m.volatilityPct)} muted />
        <Metric label="Closed trades" value={String(m.trades)} muted />
        <Metric label="vs. B&H" value={pct(m.totalReturnPct - m.buyHoldReturnPct)} good={m.totalReturnPct >= m.buyHoldReturnPct} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Metrics are descriptive research statistics on a hypothetical, cost-adjusted simulation
        (long/flat, {"5"}bps friction). They are not a forecast and not financial advice.
      </p>
    </section>
  );
}

function EquityChart({ backtest }: { backtest: Backtest }) {
  const pts = backtest.equityCurve;
  const w = 640;
  const h = 180;
  const pad = 4;
  const eqs = pts.map((p) => p.equity);
  const min = Math.min(...eqs);
  const max = Math.max(...eqs);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(pts.length - 1, 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const up = pts[pts.length - 1].equity >= pts[0].equity;
  const stroke = up ? "#10b981" : "#ef4444";
  const start = pts[0].equity;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[420px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* starting-capital reference line */}
        <line x1={pad} x2={w - pad} y1={y(start)} y2={y(start)} stroke="#475569" strokeDasharray="4 4" strokeWidth="1" />
        <path d={area} fill="url(#eqfill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>${fmt(start)} start</span>
        <span>${fmt(pts[pts.length - 1].equity)} end</span>
      </div>
    </div>
  );
}

function Metric({ label, value, good, muted }: { label: string; value: string; good?: boolean; muted?: boolean }) {
  const color = muted ? "text-slate-300" : good ? "text-brand-400" : "text-loss-500";
  return (
    <div className="rounded-lg border border-slate-800 bg-ink-900 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`font-mono text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
