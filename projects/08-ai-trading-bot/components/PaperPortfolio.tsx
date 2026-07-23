"use client";

import type { Action, Portfolio, Signal, Trade } from "@/lib/types";

interface Props {
  signal: Signal | null;
  portfolio: Portfolio;
  trades: Trade[];
  onExecute: () => void;
}

const ACTION_STYLE: Record<Action, string> = {
  buy: "bg-brand-500/15 text-brand-300 border-brand-500/40",
  sell: "bg-loss-500/15 text-loss-500 border-loss-500/40",
  hold: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

export function PaperPortfolio({ signal, portfolio, trades, onExecute }: Props) {
  return (
    <section className="space-y-4">
      {/* --- Latest signal --- */}
      <div className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Latest signal
        </h2>
        {!signal ? (
          <p className="text-sm text-slate-500">
            Generate a signal to see the rule + AI-sentiment blend and its risk check.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-md border px-3 py-1 text-sm font-bold uppercase ${ACTION_STYLE[signal.action]}`}>
                {signal.action}
              </span>
              <span className="font-mono text-sm text-slate-300">{signal.symbol} @ ${signal.price.toFixed(2)}</span>
              <span className="text-xs text-slate-500">
                confidence <span className="font-mono text-slate-300">{(signal.confidence * 100).toFixed(0)}%</span>
              </span>
              <span className="text-xs text-slate-500">
                {signal.usedAI ? `AI: ${signal.model ?? "model"}` : "AI: mock (no key)"}
              </span>
              {signal.action !== signal.ruleAction && (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
                  risk override (rule said {signal.ruleAction})
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-slate-300">{signal.rationale}</p>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                sentiment: {signal.sentiment.label} ({signal.sentiment.score.toFixed(2)})
              </span>
              {signal.sentiment.drivers.map((d) => (
                <span key={d} className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                  {d}
                </span>
              ))}
            </div>

            {signal.riskNotes.length > 0 && (
              <ul className="list-inside list-disc text-[11px] text-amber-300/80">
                {signal.riskNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}

            <button
              onClick={onExecute}
              disabled={signal.action === "hold"}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {signal.action === "hold" ? "No paper trade (hold)" : `Execute PAPER ${signal.action}`}
            </button>
          </div>
        )}
      </div>

      {/* --- Paper portfolio --- */}
      <div className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Paper portfolio
          </h2>
          <span className="rounded bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-brand-300">
            {portfolio.mode} · simulated
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Equity" value={`$${fmt(portfolio.equity)}`} />
          <Stat label="Cash" value={`$${fmt(portfolio.cash)}`} />
          <Stat
            label="Unrealized P&L"
            value={`${portfolio.unrealizedPnl >= 0 ? "+" : ""}$${fmt(portfolio.unrealizedPnl)}`}
            good={portfolio.unrealizedPnl >= 0}
          />
        </div>

        {portfolio.positions.length > 0 && (
          <table className="mt-4 w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-1 font-medium">Symbol</th>
                <th className="pb-1 text-right font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Avg</th>
                <th className="pb-1 text-right font-medium">Mark</th>
                <th className="pb-1 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-300">
              {portfolio.positions.map((p) => (
                <tr key={p.symbol} className="border-t border-slate-800">
                  <td className="py-1">{p.symbol}</td>
                  <td className="py-1 text-right">{p.qty}</td>
                  <td className="py-1 text-right">${p.avgPrice.toFixed(2)}</td>
                  <td className="py-1 text-right">${p.marketPrice.toFixed(2)}</td>
                  <td className={`py-1 text-right ${p.unrealizedPnl >= 0 ? "text-brand-400" : "text-loss-500"}`}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}${fmt(p.unrealizedPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Trade log --- */}
      {trades.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-ink-800/60 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Paper trade log
          </h2>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <tbody className="font-mono text-slate-300">
                {[...trades].reverse().map((t) => (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className={`py-1 pr-3 font-semibold uppercase ${t.side === "buy" ? "text-brand-400" : "text-loss-500"}`}>
                      {t.side}
                    </td>
                    <td className="py-1 pr-3">{t.symbol}</td>
                    <td className="py-1 pr-3 text-right">{t.qty} @ ${t.price.toFixed(2)}</td>
                    <td className="py-1 pl-3 text-slate-500">{t.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  const color = good === undefined ? "text-slate-100" : good ? "text-brand-400" : "text-loss-500";
  return (
    <div className="rounded-lg border border-slate-800 bg-ink-900 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`font-mono text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
