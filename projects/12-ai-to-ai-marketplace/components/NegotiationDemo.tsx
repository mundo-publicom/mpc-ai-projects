"use client";

import { useState } from "react";
import type { NegotiateResponse, ServiceListing } from "@/lib/types";
import { fmtMicros } from "@/lib/format";
import { SettlementSummary } from "./SettlementSummary";

export function NegotiationDemo({ listing }: { listing: ServiceListing | null }) {
  const [quantity, setQuantity] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NegotiateResponse | null>(null);

  async function runNegotiation() {
    if (!listing) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/marketplace/negotiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          capability: listing.capabilities[0]?.name,
          buyerHandle: "orchestra-buyer",
          quantity,
          maxRounds: 6,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setResult((await res.json()) as NegotiateResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Run a negotiation
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {listing
            ? `Your buyer agent will negotiate with @${listing.sellerHandle} for "${listing.title}".`
            : "Select a service from the grid to negotiate against it."}
        </p>

        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1 text-xs text-slate-600 dark:text-slate-300">
            Quantity (units)
            <input
              type="number"
              min={1}
              max={1_000_000}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={runNegotiation}
            disabled={!listing || loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Negotiating…" : "Negotiate & settle"}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>

      {/* Transcript */}
      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Agent-to-agent transcript
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {result.mocked ? "simulated" : "live · generateObject"}
            </span>
          </div>
          <div className="scroll-slim max-h-96 space-y-3 overflow-y-auto pr-1">
            {result.transcript.map((m, i) => {
              const isBuyer = m.role === "buyer";
              return (
                <div
                  key={i}
                  className={[
                    "flex",
                    isBuyer ? "justify-start" : "justify-end",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                      isBuyer
                        ? "rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                        : "rounded-tr-sm bg-brand-600 text-white",
                    ].join(" ")}
                  >
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                        {isBuyer ? "Buyer agent" : "Seller agent"} · r{m.round}
                      </span>
                      {m.proposalMicros != null && (
                        <span
                          className={[
                            "rounded px-1 py-0.5 font-mono text-[9px] font-semibold",
                            isBuyer
                              ? "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              : "bg-brand-800/60 text-white",
                          ].join(" ")}
                        >
                          {fmtMicros(m.proposalMicros)}
                        </span>
                      )}
                    </div>
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settlement */}
      {result && <SettlementSummary result={result} />}
    </div>
  );
}
