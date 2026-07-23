"use client";

import { useCallback, useEffect, useState } from "react";
import type { IngestResponse, Source } from "@/lib/types";

interface IngestPanelProps {
  botId: string;
}

const STATUS_STYLES: Record<Source["status"], string> = {
  queued: "bg-slate-100 text-slate-600",
  crawling: "bg-blue-100 text-blue-700",
  embedding: "bg-indigo-100 text-indigo-700",
  ready: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

/**
 * "Paste your docs" panel. Sends text or a URL to /api/ingest, then refreshes
 * the source list. This is the knowledge-base authoring surface of the product.
 */
export function IngestPanel({ botId }: IngestPanelProps) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [mocked, setMocked] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/ingest?botId=${encodeURIComponent(botId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { sources: Source[]; totalChunks: number };
      setSources(data.sources);
      setTotalChunks(data.totalChunks);
    } catch {
      /* non-fatal */
    }
  }, [botId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function ingest() {
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "url"
          ? { botId, type: "url" as const, url, label: label || undefined }
          : { botId, type: "text" as const, text, label: label || undefined };

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as IngestResponse | { error: string };
      if (!res.ok) throw new Error("error" in data ? data.error : "Ingestion failed");

      setMocked((data as IngestResponse).mocked);
      setTotalChunks((data as IngestResponse).totalChunks);
      if (mode === "text") setText("");
      if (mode === "url") setUrl("");
      setLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Knowledge base</h3>
          <p className="text-sm text-slate-500">
            Paste text or add a URL. It gets chunked, embedded, and made retrievable.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{totalChunks}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">chunks indexed</div>
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
        {(["text", "url"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 font-medium capitalize ${
              mode === m ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m === "text" ? "Paste text" : "Add URL"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste product docs, FAQs, policies…"
          className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.yoursite.com/getting-started"
          className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
        <button
          onClick={() => void ingest()}
          disabled={busy || (mode === "text" ? !text.trim() : !url.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? "Ingesting…" : "Ingest"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {mocked !== null && (
        <p className="mt-2 text-xs text-slate-500">
          Embeddings: {mocked ? "deterministic mock (no AI key)" : "real model via AI Gateway"}
        </p>
      )}

      {sources.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-700" title={s.url || s.label}>
                {s.label}
              </span>
              <span className="text-xs text-slate-400">{s.chunkCount} chunks</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[s.status]}`}>
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SAMPLE_TEXT = `Acme is a project management tool for small teams.

Pricing: The Free plan supports up to 3 users and 2 projects. The Pro plan is $12 per user per month and includes unlimited projects, time tracking, and priority support. The Business plan is $22 per user per month and adds SSO, audit logs, and a dedicated success manager.

Refunds: We offer a 30-day money-back guarantee on all annual plans. Monthly plans can be cancelled at any time and are not pro-rated.

Support: Free and Pro customers get email support with a 24-hour response time. Business customers get a private Slack channel and a 2-hour response SLA during business hours.`;
