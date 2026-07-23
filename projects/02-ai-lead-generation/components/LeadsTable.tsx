"use client";

import type { Lead, ScoreBand } from "@/lib/types";

const BAND_STYLES: Record<ScoreBand, string> = {
  hot: "bg-red-100 text-red-700 border-red-200",
  warm: "bg-amber-100 text-amber-700 border-amber-200",
  cool: "bg-sky-100 text-sky-700 border-sky-200",
  cold: "bg-slate-100 text-slate-600 border-slate-200",
};

function ScorePill({ value, band }: { value: number; band: ScoreBand }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${BAND_STYLES[band]}`}>
      {value}
      <span className="font-medium uppercase opacity-70">{band}</span>
    </span>
  );
}

export interface LeadsTableProps {
  leads: Lead[];
  onExport: () => void;
  exporting: boolean;
}

export function LeadsTable({ leads, onExport, exporting }: LeadsTableProps) {
  if (leads.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {leads.length} prioritized leads
          </h2>
          <p className="text-xs text-slate-500">Sorted by fit score, highest first.</p>
        </div>
        <button
          onClick={onExport}
          disabled={exporting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Score</th>
              <th className="px-5 py-3 font-semibold">Company</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Why a fit</th>
              <th className="px-5 py-3 font-semibold">Suggested opener</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-4">
                  <ScorePill value={lead.score.value} band={lead.score.band} />
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-900">{lead.company.name}</div>
                  <div className="text-xs text-slate-500">{lead.company.industry}</div>
                  <div className="text-xs text-slate-400">
                    {lead.company.size} · {lead.company.region}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-900">{lead.contact.fullName}</div>
                  <div className="text-xs text-slate-500">{lead.contact.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    <span className="text-slate-600">{lead.contact.email}</span>
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${
                        lead.contact.emailStatus === "verified"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {lead.contact.emailStatus}
                    </span>
                  </div>
                </td>
                <td className="max-w-xs px-5 py-4 text-xs text-slate-600">{lead.whyAFit}</td>
                <td className="max-w-sm px-5 py-4 text-xs italic text-slate-700">
                  &ldquo;{lead.suggestedOpener}&rdquo;
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
