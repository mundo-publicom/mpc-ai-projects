"use client";

import type { Opportunity } from "@/lib/types";

const QUADRANT_META: Record<
  Opportunity["quadrant"],
  { label: string; className: string }
> = {
  "quick-win": { label: "Quick wins", className: "text-emerald-700" },
  "big-bet": { label: "Big bets", className: "text-brand-700" },
  "fill-in": { label: "Fill-ins", className: "text-amber-700" },
  "money-pit": { label: "Deprioritize", className: "text-rose-700" },
};

const CATEGORY_COLOR: Record<Opportunity["category"], string> = {
  automation: "bg-emerald-500",
  augmentation: "bg-brand-500",
  insight: "bg-violet-500",
  "customer-experience": "bg-sky-500",
  "risk-compliance": "bg-amber-500",
  "new-product": "bg-rose-500",
};

/**
 * 2x2 opportunity matrix — impact (Y) vs. effort (X). High-impact/low-effort
 * (top-left) are the quick wins to sequence first.
 */
export function OpportunityMatrix({ opportunities }: { opportunities: Opportunity[] }) {
  // Map 1–5 to a percentage position with padding so dots never clip edges.
  const pos = (v: number) => 10 + ((v - 1) / 4) * 80;

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Quadrant guide lines */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-200" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-slate-200" />

        {/* Quadrant labels */}
        <span className="absolute left-3 top-2 text-xs font-semibold text-emerald-600">
          Quick wins
        </span>
        <span className="absolute right-3 top-2 text-xs font-semibold text-brand-600">
          Big bets
        </span>
        <span className="absolute left-3 bottom-2 text-xs font-semibold text-amber-600">
          Fill-ins
        </span>
        <span className="absolute right-3 bottom-2 text-xs font-semibold text-rose-500">
          Deprioritize
        </span>

        {/* Axis labels */}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wide text-slate-400">
          Effort →
        </span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-wide text-slate-400">
          Impact →
        </span>

        {/* Plotted opportunities */}
        {opportunities.map((o) => (
          <div
            key={o.id}
            className="group absolute -translate-x-1/2 translate-y-1/2"
            style={{ left: `${pos(o.effort)}%`, bottom: `${pos(o.impact)}%` }}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ${CATEGORY_COLOR[o.category]}`}
              title={`${o.title} — impact ${o.impact}/5, effort ${o.effort}/5`}
            >
              {o.priority}
            </div>
            <div className="pointer-events-none absolute left-1/2 top-8 z-10 hidden w-44 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-center text-[11px] text-white group-hover:block">
              {o.title}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {Object.entries(CATEGORY_COLOR).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
            {cat.replace("-", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

export { QUADRANT_META };
