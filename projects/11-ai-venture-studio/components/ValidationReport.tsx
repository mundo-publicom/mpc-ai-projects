import type {
  ValidationReport as Report,
  MvpPriority,
  Risk,
} from "@/lib/types";
import { LeanCanvasGrid } from "./LeanCanvasGrid";

interface ValidationReportProps {
  report: Report;
}

/* ------------------------------------------------------------------ */
/* Score gauge                                                         */
/* ------------------------------------------------------------------ */

function scoreColor(score: number): string {
  if (score >= 75) return "#146b4b"; // brand green
  if (score >= 55) return "#ca8a04"; // amber
  if (score >= 35) return "#ea580c"; // orange
  return "#dc2626"; // red
}

function ScoreGauge({ score, verdict }: { score: number; verdict: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = scoreColor(score);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs font-medium text-slate-400">/ 100</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Viability score
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">{verdict}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const RECOMMENDATION_STYLE: Record<Report["recommendation"], string> = {
  pursue: "bg-green-100 text-green-800",
  investigate: "bg-amber-100 text-amber-800",
  pivot: "bg-orange-100 text-orange-800",
  pass: "bg-red-100 text-red-800",
};

const PRIORITY_STYLE: Record<MvpPriority, string> = {
  must: "bg-brand-100 text-brand-800",
  should: "bg-sky-100 text-sky-800",
  could: "bg-slate-100 text-slate-600",
  wont: "bg-slate-100 text-slate-400 line-through",
};

const SEVERITY_STYLE: Record<Risk["severity"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};

/* ------------------------------------------------------------------ */
/* Main report                                                         */
/* ------------------------------------------------------------------ */

export function ValidationReport({ report }: ValidationReportProps) {
  const { market, competitors, segments, canvas, mvp, risks, landing } = report;

  return (
    <div className="space-y-6">
      {/* Header + score */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{report.ideaTitle}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${RECOMMENDATION_STYLE[report.recommendation]}`}
              >
                {report.recommendation}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Report {report.ideaId.slice(0, 8)} ·{" "}
              {new Date(report.generatedAt).toLocaleString()} ·{" "}
              {report.mocked ? "mock data (no AI key)" : `${report.latencyMs} ms`}
            </p>
          </div>
          <ScoreGauge score={report.score} verdict={report.verdict} />
        </div>
        {report.mocked && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Showing deterministic mock output. Set <code>AI_GATEWAY_API_KEY</code> to
            generate a real, idea-specific report.
          </p>
        )}
      </section>

      {/* Market / TAM */}
      <Section title="Market & TAM">
        <div className="grid gap-4 sm:grid-cols-3">
          {(["tam", "sam", "som"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">{k}</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {market[k].display}
              </p>
              <p className="mt-1 text-xs text-slate-500">{market[k].basis}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-900">
              {(market.cagr * 100).toFixed(0)}%
            </span>{" "}
            est. CAGR
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-600">{market.summary}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">
              Key assumptions
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {market.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand-400">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Tailwinds</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {market.tailwinds.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand-400">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Competitors */}
      <Section title="Competitive landscape">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-4 font-semibold">Competitor</th>
                <th className="py-2 pr-4 font-semibold">Type</th>
                <th className="py-2 pr-4 font-semibold">Strengths</th>
                <th className="py-2 pr-4 font-semibold">Weaknesses</th>
                <th className="py-2 font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr key={c.name} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    {c.name}
                    <p className="mt-0.5 text-xs font-normal text-slate-400">
                      {c.description}
                    </p>
                  </td>
                  <td className="py-3 pr-4 capitalize text-slate-600">{c.type}</td>
                  <td className="py-3 pr-4 text-slate-600">{c.strengths.join(", ")}</td>
                  <td className="py-3 pr-4 text-slate-600">{c.weaknesses.join(", ")}</td>
                  <td className="py-3 capitalize text-slate-600">{c.pricePosition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Customer segments */}
      <Section title="Customer segments">
        <div className="grid gap-4 sm:grid-cols-2">
          {segments.map((s) => (
            <div key={s.name} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-800">{s.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                  {s.painLevel} pain
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.description}</p>
              <p className="mt-2 text-xs font-medium text-brand-700">
                WTP: {s.willingnessToPay}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Lean Canvas */}
      <Section title="Lean Canvas">
        <LeanCanvasGrid canvas={canvas} />
      </Section>

      {/* MVP spec */}
      <Section title="MVP spec">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Goal:</span> {mvp.goal}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold">Riskiest assumption:</span>{" "}
            {mvp.riskiestAssumption}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Estimated build: ~{mvp.buildEstimateWeeks} weeks · Success:{" "}
            {mvp.successMetrics.join(" · ")}
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {mvp.features.map((f) => (
            <li
              key={f.name}
              className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
            >
              <input
                type="checkbox"
                defaultChecked={f.priority === "must"}
                className="mt-1 h-4 w-4 accent-brand-600"
                aria-label={f.name}
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[f.priority]}`}
                  >
                    {f.priority}
                  </span>
                  <span className="text-xs text-slate-400">{f.effortDays}d</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{f.description}</p>
                <p className="mt-0.5 text-xs italic text-slate-400">{f.userStory}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Risks */}
      <Section title="Risks">
        <ul className="space-y-3">
          {risks.map((r, i) => (
            <li key={i} className="rounded-lg border border-slate-100 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                  {r.category}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEVERITY_STYLE[r.severity]}`}
                >
                  {r.severity}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-700">{r.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-semibold">Mitigation:</span> {r.mitigation}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Landing copy */}
      <Section title="Landing page copy">
        <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-brand-50 to-white p-6 text-center">
          <h4 className="text-2xl font-bold text-slate-900">{landing.headline}</h4>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">{landing.subheadline}</p>
          <ul className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2 text-sm">
            {landing.valueBullets.map((b, i) => (
              <li
                key={i}
                className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm"
              >
                {b}
              </li>
            ))}
          </ul>
          <button className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
            {landing.primaryCta}
          </button>
        </div>
      </Section>
    </div>
  );
}
