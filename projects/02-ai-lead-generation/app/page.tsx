"use client";

import { useState } from "react";
import { IcpForm } from "@/components/IcpForm";
import { LeadsTable } from "@/components/LeadsTable";
import type { GenerateLeadsResponse, Icp, Lead } from "@/lib/types";

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<GenerateLeadsResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(icp: Icp, count: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp, count }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: GenerateLeadsResponse = await res.json();
      setLeads(data.leads);
      setMeta(data.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (leads.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads, format: "csv" }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
            AI Lead Gen
          </span>
          <span className="text-xs text-slate-400">per-lead credits · monthly SaaS</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
          Turn an ICP into prioritized, ready-to-contact leads
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Describe your ideal customer. The engine finds matching accounts, enriches contacts,
          scores fit, and drafts a personalized first-touch opener for each — then exports to your CRM.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <IcpForm onGenerate={handleGenerate} loading={loading} />
          {meta && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>
                  Engine:{" "}
                  <span className="font-semibold text-slate-700">
                    {meta.usedAI ? `AI (${meta.model})` : "Deterministic mock (no API key)"}
                  </span>
                </span>
                <span>
                  Credits used:{" "}
                  <span className="font-semibold text-slate-700">{meta.creditsUsed}</span>
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {leads.length === 0 && !loading ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 text-center text-sm text-slate-400">
              Your scored leads will appear here.
            </div>
          ) : (
            <LeadsTable leads={leads} onExport={handleExport} exporting={exporting} />
          )}
        </div>
      </div>
    </main>
  );
}
