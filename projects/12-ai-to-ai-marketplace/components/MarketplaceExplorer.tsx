"use client";

import { useMemo, useState } from "react";
import type { ServiceListing } from "@/lib/types";
import { ListingCard } from "./ListingCard";
import { NegotiationDemo } from "./NegotiationDemo";

export function MarketplaceExplorer({
  initialListings,
}: {
  initialListings: ServiceListing[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selected, setSelected] = useState<ServiceListing | null>(
    initialListings[0] ?? null,
  );

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(initialListings.map((l) => l.category)))],
    [initialListings],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return initialListings.filter((l) => {
      if (category !== "All" && l.category !== category) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)) ||
        l.capabilities.some((c) => c.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [initialListings, query, category]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Listing grid */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search capabilities: research, ocr, enrichment…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  category === c
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              selected={selected?.id === l.id}
              onSelect={setSelected}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-400">
            No services match “{query}”.
          </p>
        )}
      </section>

      {/* Negotiation panel */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <NegotiationDemo listing={selected} />
      </aside>
    </div>
  );
}
