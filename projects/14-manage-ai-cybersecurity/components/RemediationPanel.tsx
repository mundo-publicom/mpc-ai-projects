"use client";

import type { Alert, Remediation, TriageResult } from "@/lib/types";
import {
  SEVERITY_BADGE,
  SEVERITY_LABEL,
  VERDICT_LABEL,
  confidencePct,
} from "@/lib/ui";

/**
 * Right-hand detail panel. When an alert is selected it shows the full AI
 * triage rationale + step-by-step DEFENSIVE remediation. Otherwise it shows
 * the environment-wide, priority-ranked remediation plan derived from the
 * posture findings.
 */
export function RemediationPanel({
  alert,
  triage,
  remediations,
}: {
  alert: Alert | null;
  triage: TriageResult | null;
  remediations: Remediation[];
}) {
  if (alert && triage) {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${
                SEVERITY_BADGE[triage.severity]
              }`}
            >
              {SEVERITY_LABEL[triage.severity]}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {VERDICT_LABEL[triage.verdict]} · {confidencePct(triage.confidence)} confidence
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            {alert.title}
          </h3>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            ATT&CK mapping
          </p>
          <p className="mt-1 font-mono text-sm text-brand-800 dark:text-brand-200">
            {triage.mitreTechnique.techniqueId} · {triage.mitreTechnique.techniqueName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tactic: {triage.mitreTechnique.tactic}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Analyst rationale
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {triage.rationale}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recommended defensive actions
          </p>
          <ol className="mt-2 space-y-2">
            {triage.remediationSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[11px] text-slate-400">
          Triaged in {triage.latencyMs} ms{triage.mocked ? " · deterministic mock" : " · AI engine"}
        </p>
      </div>
    );
  }

  // Default: environment-wide prioritized remediation plan.
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Prioritized remediation plan for the environment. Select an alert for its specific triage.
      </p>
      <ol className="space-y-3">
        {remediations.map((rem) => (
          <li
            key={rem.id}
            className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {rem.priority}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                  SEVERITY_BADGE[rem.severity]
                }`}
              >
                {SEVERITY_LABEL[rem.severity]}
              </span>
              <span className="text-[10px] uppercase text-slate-400">
                {rem.effort} effort
              </span>
            </div>
            <h4 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {rem.title}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {rem.rationale}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
