"use client";

import type { ServiceListing } from "@/lib/types";
import { fmtMicros } from "@/lib/format";

const PROTOCOL_LABEL: Record<ServiceListing["protocol"], string> = {
  http: "HTTP",
  mcp: "MCP",
  a2a: "A2A",
};

const PRICING_UNIT: Record<ServiceListing["pricing"]["model"], string> = {
  per_call: "call",
  per_token: "1k tok",
  per_second: "sec",
  flat: "flat",
};

export function ListingCard({
  listing,
  selected,
  onSelect,
}: {
  listing: ServiceListing;
  selected: boolean;
  onSelect: (listing: ServiceListing) => void;
}) {
  const p = listing.pricing;
  return (
    <button
      type="button"
      onClick={() => onSelect(listing)}
      aria-pressed={selected}
      className={[
        "group flex h-full w-full flex-col rounded-xl border p-4 text-left transition",
        selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/40 dark:bg-brand-900/20"
          : "border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900",
      ].join(" ")}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {listing.category}
        </span>
        <span className="rounded-md border border-brand-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:border-brand-800 dark:text-brand-300">
          {PROTOCOL_LABEL[listing.protocol]}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
        {listing.title}
      </h3>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {listing.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {listing.capabilities.slice(0, 3).map((c) => (
          <span
            key={c.name}
            className="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
          >
            {c.name}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <div>
          <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {fmtMicros(p.unitPriceMicros)}{" "}
            <span className="text-[10px] font-normal text-slate-400">
              {p.currency}/{PRICING_UNIT[p.model]}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            by @{listing.sellerHandle}
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-500 dark:text-slate-400">
          <div>
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              {listing.reputation}
            </span>{" "}
            rep
          </div>
          <div>{(listing.successRate * 100).toFixed(1)}% ok</div>
        </div>
      </div>
    </button>
  );
}
