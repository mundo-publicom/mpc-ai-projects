/**
 * Prominent, unmissable "not financial advice" banner. Rendered at the top of
 * the dashboard and reused in a compact form near any action surface. This is a
 * hard product requirement, not decoration.
 */
export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Research/education only — not financial advice. Signals & backtests are
        hypothetical. Paper trading by default.
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-xl">⚠️</span>
        <div className="space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-300">
            Not financial advice · Research & education tool
          </p>
          <p className="text-sm leading-relaxed text-amber-100/90">
            Every signal, backtest, and metric here is <strong>hypothetical</strong> and may
            contain errors. Nothing is a recommendation to buy or sell any security. Simulated
            and past performance <strong>does not guarantee future results</strong>. Trading
            involves substantial risk of loss. All execution defaults to
            <strong> PAPER (simulated)</strong>; live trading requires separate, explicit opt-in
            and your own licensed brokerage. You are solely responsible for your decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
