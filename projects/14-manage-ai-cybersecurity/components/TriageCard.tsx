"use client";

import type { TriageResult } from "@/lib/types";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  VERDICT_BADGE,
  VERDICT_LABEL,
  confidencePct,
} from "@/lib/ui";

/**
 * Compact AI-triage summary shown inline on an alert row: severity badge,
 * verdict, ATT&CK technique tag, and confidence. Renders a loading shimmer
 * while triage is in flight.
 */
export function TriageCard({
  triage,
  loading,
}: {
  triage: TriageResult | null;
  loading: boolean;
}) {
  if (loading || !triage) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex animate-pulse rounded-md bg-slate-200 px-6 py-2 dark:bg-slate-800" />
        <span className="text-xs text-slate-400">AI triaging…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${
          SEVERITY_BADGE[triage.severity]
        }`}
      >
        {SEVERITY_LABEL[triage.severity]}
      </span>

      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
          VERDICT_BADGE[triage.verdict]
        }`}
      >
        {VERDICT_LABEL[triage.verdict]}
      </span>

      <span
        className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
        title={`${triage.mitreTechnique.tactic} — ${triage.mitreTechnique.techniqueName}`}
      >
        <span aria-hidden>🛡</span>
        {triage.mitreTechnique.techniqueId} · {triage.mitreTechnique.techniqueName}
      </span>

      <span className="text-xs text-slate-500 dark:text-slate-400">
        {confidencePct(triage.confidence)} confidence
      </span>

      {triage.requiresHumanReview && (
        <span className="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          Needs analyst review
        </span>
      )}

      {triage.mocked && (
        <span
          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          title="Deterministic mock triage (no AI key configured)"
        >
          mock
        </span>
      )}
    </div>
  );
}
