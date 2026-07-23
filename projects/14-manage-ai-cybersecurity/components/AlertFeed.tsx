"use client";

import type { Alert, TriageResult } from "@/lib/types";
import { SEVERITY_ACCENT, timeAgo } from "@/lib/ui";
import { TriageCard } from "./TriageCard";

/** One alert plus its (possibly still-loading) triage result. */
export interface AlertRow {
  alert: Alert;
  triage: TriageResult | null;
  loading: boolean;
}

/**
 * The live alert feed. Each row shows the raw signal plus AI-triage badges.
 * Clicking a row selects it, driving the remediation panel. The accent rail
 * reflects the AI-assessed severity once triage completes (else the vendor
 * severity).
 */
export function AlertFeed({
  rows,
  selectedId,
  onSelect,
}: {
  rows: AlertRow[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}) {
  return (
    <ul className="scroll-slim max-h-[640px] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
      {rows.map(({ alert, triage, loading }) => {
        const severity = triage?.severity ?? alert.reportedSeverity;
        const selected = alert.id === selectedId;
        return (
          <li key={alert.id}>
            <button
              type="button"
              onClick={() => onSelect(alert.id)}
              className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                selected
                  ? "bg-brand-50 dark:bg-brand-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
              }`}
            >
              <span
                aria-hidden
                className={`mt-1 h-full w-1 shrink-0 rounded-full ${SEVERITY_ACCENT[severity]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {alert.title}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {timeAgo(alert.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono uppercase dark:bg-slate-800">
                    {alert.source}
                  </span>
                  {alert.assetName && <span className="truncate">{alert.assetName}</span>}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                  {alert.description}
                </p>
                <div className="mt-2">
                  <TriageCard triage={triage} loading={loading} />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
