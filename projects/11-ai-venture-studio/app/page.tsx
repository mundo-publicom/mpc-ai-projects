"use client";

import { useState } from "react";
import { IdeaForm } from "@/components/IdeaForm";
import { ValidationReport } from "@/components/ValidationReport";
import type { ValidateRequest, ValidationReport as Report } from "@/lib/types";

interface HistoryItem {
  id: string;
  title: string;
  score: number;
  recommendation: Report["recommendation"];
}

export default function StudioDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  async function runValidation(input: ValidateRequest) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Validation failed");
        return;
      }
      const r = data as Report;
      setReport(r);
      setHistory((h) => [
        { id: r.ideaId, title: r.ideaTitle, score: r.score, recommendation: r.recommendation },
        ...h,
      ]);
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            V
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Venture Studio</h1>
            <p className="text-sm text-slate-500">
              Idea → validation → Lean Canvas → MVP spec → landing copy, in one sprint.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Main column */}
        <div className="order-2 space-y-8 lg:order-1">
          <IdeaForm onSubmit={runValidation} loading={loading} />

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && !report && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Running the validation sprint — sizing the market, scanning competitors,
              drafting the Lean Canvas and MVP…
            </div>
          )}

          {report && <ValidationReport report={report} />}

          {!report && !loading && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              Submit an idea to generate a validation report.
            </div>
          )}
        </div>

        {/* Sidebar: venture pipeline */}
        <aside className="order-1 lg:order-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Venture pipeline
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                Validated ventures show up here as you run sprints.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-slate-700">
                      {h.title}
                    </span>
                    <span className="ml-2 shrink-0 text-sm font-bold text-brand-700">
                      {h.score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-500">How the studio earns</p>
              <p className="mt-1">
                Productized validation sprints (flat fee) + equity or revenue-share on
                ventures spun out of the pipeline.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
