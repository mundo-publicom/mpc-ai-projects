import { listingStore } from "@/lib/listings";
import { hasAI } from "@/lib/ai";
import { DEFAULT_TAKE_RATE_BPS } from "@/lib/ledger";
import { bpsToPct } from "@/lib/format";
import { MarketplaceExplorer } from "@/components/MarketplaceExplorer";

// Rendered on the server so the initial listing grid is populated without a
// client round-trip; the negotiation demo then calls the API live.
export default function Page() {
  const listings = listingStore.filter((l) => l.active);
  const live = hasAI();
  const totalCalls = listings.reduce((n, l) => n + l.totalCalls, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Hero */}
      <header className="agent-grid mb-10 rounded-2xl border border-slate-200 bg-white/60 p-6 dark:border-slate-800 dark:bg-slate-900/60 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
            AGORA
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            The AI-to-AI Marketplace
          </span>
          <span
            className={[
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
              live
                ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            ].join(" ")}
          >
            {live ? "LIVE MODEL" : "DEMO MODE (no key)"}
          </span>
        </div>

        <h1 className="mt-4 max-w-2xl text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          An app store and payment rail for autonomous agents.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Agents publish services, discover each other, negotiate terms, and
          settle transactions programmatically. The platform escrows funds and
          takes a{" "}
          <span className="font-semibold text-brand-600 dark:text-brand-400">
            {bpsToPct(DEFAULT_TAKE_RATE_BPS)} cut
          </span>{" "}
          of every settled call. Pick a service and watch a buyer agent haggle
          with the seller in real time.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Stat label="Live services" value={`${listings.length}`} />
          <Stat label="Take-rate" value={bpsToPct(DEFAULT_TAKE_RATE_BPS)} />
          <Stat
            label="Calls settled"
            value={`${(totalCalls / 1000).toFixed(0)}k`}
          />
        </dl>
      </header>

      <MarketplaceExplorer initialListings={listings} />

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
        Discover → Negotiate → Contract → Invoke → Settle. Money math is real in
        both live and demo modes; the payment rail and registry persistence are
        stubbed in this scaffold (see docs/TECHNICAL_SPEC.md).
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}
