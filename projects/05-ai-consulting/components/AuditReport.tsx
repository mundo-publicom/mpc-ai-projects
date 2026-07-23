"use client";

import type { Audit, Opportunity, RoiEstimate } from "@/lib/types";
import { OpportunityMatrix } from "./OpportunityMatrix";

function usd(n: number): string {
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000).toLocaleString("en-US")}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const BAND_META: Record<Audit["readinessBand"], { label: string; ring: string }> = {
  nascent: { label: "Nascent", ring: "text-rose-500" },
  developing: { label: "Developing", ring: "text-amber-500" },
  established: { label: "Established", ring: "text-brand-500" },
  advanced: { label: "Advanced", ring: "text-emerald-500" },
};

function ReadinessGauge({ score, band }: { score: number; band: Audit["readinessBand"] }) {
  const meta = BAND_META[band];
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            className={meta.ring}
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900">{score}</span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">AI-Readiness</div>
        <div className={`text-2xl font-bold ${meta.ring}`}>{meta.label}</div>
      </div>
    </div>
  );
}

function DimensionBars({ dimensions }: { dimensions: Audit["dimensions"] }) {
  return (
    <div className="space-y-2.5">
      {dimensions.map((d) => (
        <div key={d.name}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium capitalize text-slate-700">{d.name}</span>
            <span className="tabular-nums text-slate-500">{Math.round(d.score)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${d.score}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{d.rationale}</p>
        </div>
      ))}
    </div>
  );
}

function RoiStat({ roi }: { roi: RoiEstimate }) {
  const stats = [
    { label: "Implementation", value: usd(roi.implementationCostUsd) },
    { label: "Net benefit / yr", value: usd(roi.annualNetUsd) },
    {
      label: "Payback",
      value: roi.paybackMonths < 999 ? `${roi.paybackMonths} mo` : "—",
    },
    { label: "1st-yr ROI", value: `${Math.round(roi.firstYearRoi * 100)}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">{s.label}</div>
          <div className="text-lg font-bold text-slate-900">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function BacklogTable({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Use case</th>
            <th className="py-2 pr-2">Category</th>
            <th className="py-2 pr-2 text-center">Impact</th>
            <th className="py-2 pr-2 text-center">Effort</th>
            <th className="py-2 pr-2 text-right">Net / yr</th>
            <th className="py-2 pr-2 text-right">Payback</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {opportunities.map((o) => (
            <tr key={o.id} className="align-top">
              <td className="py-3 pr-2 font-bold text-slate-400">{o.priority}</td>
              <td className="py-3 pr-2">
                <div className="font-semibold text-slate-900">{o.title}</div>
                <div className="text-xs text-slate-500">{o.description}</div>
                {o.suggestedApproach && (
                  <div className="mt-1 text-xs italic text-slate-400">
                    Approach: {o.suggestedApproach}
                  </div>
                )}
              </td>
              <td className="py-3 pr-2">
                <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                  {o.category.replace("-", " ")}
                </span>
              </td>
              <td className="py-3 pr-2 text-center tabular-nums">{o.impact}/5</td>
              <td className="py-3 pr-2 text-center tabular-nums">{o.effort}/5</td>
              <td className="py-3 pr-2 text-right font-semibold tabular-nums text-emerald-700">
                {usd(o.roi.annualNetUsd)}
              </td>
              <td className="py-3 pr-2 text-right tabular-nums text-slate-600">
                {o.roi.paybackMonths < 999 ? `${o.roi.paybackMonths} mo` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoadmapTimeline({ roadmap }: { roadmap: Audit["roadmap"] }) {
  return (
    <div className="space-y-4">
      {roadmap.horizon && (
        <p className="text-sm text-slate-500">Horizon: {roadmap.horizon}</p>
      )}
      <ol className="relative space-y-6 border-l-2 border-slate-200 pl-6">
        {roadmap.phases.map((ph) => (
          <li key={ph.order} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {ph.order}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold text-slate-900">{ph.name}</h4>
              <span className="text-xs text-slate-500">{ph.timeframe}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{ph.objective}</p>
            {ph.opportunities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ph.opportunities.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {ph.milestones.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
                {ph.milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {ph.estimatedCostUsd > 0 && (
              <div className="mt-2 text-xs font-medium text-slate-500">
                Est. cost: {usd(ph.estimatedCostUsd)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AuditReport({ audit, usedAI }: { audit: Audit; usedAI: boolean }) {
  return (
    <div className="space-y-6">
      {/* Header: gauge + exec summary */}
      <Section title="Executive Summary">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ReadinessGauge score={audit.readinessScore} band={audit.readinessBand} />
          <p className="flex-1 text-sm leading-relaxed text-slate-700">
            {audit.executiveSummary}
          </p>
        </div>
        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              usedAI
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {usedAI ? "Generated with AI" : "Mock audit (no AI key configured)"}
          </span>
        </div>
      </Section>

      {/* Portfolio ROI */}
      <Section title="Portfolio ROI">
        <RoiStat roi={audit.portfolioRoi} />
        <p className="mt-3 text-sm text-slate-600">{audit.portfolioRoi.narrative}</p>
        <p className="mt-1 text-xs text-slate-400">
          Confidence: {audit.portfolioRoi.confidence}
        </p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Readiness by Dimension">
          <DimensionBars dimensions={audit.dimensions} />
        </Section>

        <Section title="Opportunity Matrix">
          <OpportunityMatrix opportunities={audit.opportunities} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Strengths">
          <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
            {audit.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
        <Section title="Gaps & Risks">
          <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
            {audit.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Prioritized Use-Case Backlog">
        <BacklogTable opportunities={audit.opportunities} />
      </Section>

      <Section title="Implementation Roadmap">
        <RoadmapTimeline roadmap={audit.roadmap} />
      </Section>
    </div>
  );
}
