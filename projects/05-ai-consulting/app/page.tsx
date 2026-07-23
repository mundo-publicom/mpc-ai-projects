"use client";

import { useState } from "react";
import { IntakeForm } from "@/components/IntakeForm";
import { AuditReport } from "@/components/AuditReport";
import type { GenerateAuditRequest, GenerateAuditResponse } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateAuditResponse | null>(null);

  async function generate(payload: GenerateAuditRequest) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as GenerateAuditResponse;
      setResult(data);
      // Bring the report into view on smaller screens.
      requestAnimationFrame(() =>
        document.getElementById("audit-report")?.scrollIntoView({ behavior: "smooth" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Productized AI Consulting
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          AI-Readiness Audit Studio
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Capture a client&apos;s processes and stack, then generate a full
          AI-Readiness Audit — readiness score, opportunity matrix, an ROI-costed
          use-case backlog, and a phased implementation roadmap. The delivery tool
          and client portal in one.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Client Intake
          </h2>
          <IntakeForm onSubmit={generate} loading={loading} />
        </div>

        <div id="audit-report">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Generated Audit
          </h2>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 text-center">
              <p className="text-slate-500">
                {loading
                  ? "Analyzing intake and drafting the audit…"
                  : "Fill in the intake (a sample is pre-loaded) and generate an audit."}
              </p>
            </div>
          )}

          {result && (
            <AuditReport audit={result.audit} usedAI={result.meta.usedAI} />
          )}
        </div>
      </div>

      <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-400">
        Runs with zero API keys (deterministic mock). Set{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5">AI_GATEWAY_API_KEY</code>{" "}
        to generate live audits via the Vercel AI Gateway.
      </footer>
    </main>
  );
}
