"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertFeed, type AlertRow } from "@/components/AlertFeed";
import { PostureGauge } from "@/components/PostureGauge";
import { RemediationPanel } from "@/components/RemediationPanel";
import { MOCK_ALERTS } from "@/lib/mock-data";
import type {
  PostureResponse,
  PostureScore,
  Remediation,
  TriageResponse,
} from "@/lib/types";

export default function Dashboard() {
  const [rows, setRows] = useState<AlertRow[]>(() =>
    MOCK_ALERTS.map((alert) => ({ alert, triage: null, loading: true })),
  );
  const [posture, setPosture] = useState<PostureScore | null>(null);
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load the environment posture (demo environment via GET).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/posture")
      .then((r) => r.json() as Promise<PostureResponse>)
      .then((data) => {
        if (cancelled) return;
        setPosture(data.posture);
        setRemediations(data.remediations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Triage every alert in the feed through the real API route.
  useEffect(() => {
    let cancelled = false;
    for (const alert of MOCK_ALERTS) {
      fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(alert),
      })
        .then((r) => r.json() as Promise<TriageResponse>)
        .then((data) => {
          if (cancelled) return;
          setRows((prev) =>
            prev.map((row) =>
              row.alert.id === alert.id
                ? { ...row, triage: data.triage, loading: false }
                : row,
            ),
          );
        })
        .catch(() => {
          if (cancelled) return;
          setRows((prev) =>
            prev.map((row) =>
              row.alert.id === alert.id ? { ...row, loading: false } : row,
            ),
          );
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRow = rows.find((r) => r.alert.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const triaged = rows.filter((r) => r.triage);
    const criticalHigh = triaged.filter(
      (r) => r.triage!.severity === "critical" || r.triage!.severity === "high",
    ).length;
    const falsePos = triaged.filter((r) => r.triage!.isLikelyFalsePositive).length;
    const review = triaged.filter((r) => r.triage!.requiresHumanReview).length;
    return {
      total: rows.length,
      triaged: triaged.length,
      criticalHigh,
      falsePos,
      review,
      fpRate: triaged.length ? Math.round((falsePos / triaged.length) * 100) : 0,
    };
  }, [rows]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg text-white">
              🛡
            </span>
            <h1 className="text-xl font-bold tracking-tight">
              Managed AI Cybersecurity
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Defensive SOC console · AI-triaged alerts, live posture, prioritized remediation ·{" "}
            <span className="font-medium">Northwind Trading Co.</span>
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Monitoring active
        </span>
      </header>

      {/* Top row: posture + KPIs */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <PostureGauge posture={posture} />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label="Alerts triaged" value={`${stats.triaged}/${stats.total}`} accent="brand" />
          <StatCard label="Critical / high" value={stats.criticalHigh} accent="red" />
          <StatCard
            label="Likely false positives"
            value={`${stats.falsePos} (${stats.fpRate}%)`}
            accent="emerald"
          />
          <StatCard label="Awaiting analyst review" value={stats.review} accent="violet" />

          {posture && (
            <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Open findings by severity ({posture.openFindings} open)
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {(
                  [
                    ["critical", "bg-red-500"],
                    ["high", "bg-orange-500"],
                    ["medium", "bg-amber-500"],
                    ["low", "bg-sky-500"],
                    ["info", "bg-slate-400"],
                  ] as const
                ).map(([sev, dot]) => (
                  <span
                    key={sev}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800"
                  >
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <span className="capitalize">{sev}</span>
                    <span className="font-semibold tabular-nums">
                      {posture.severityCounts[sev]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom row: alert feed + remediation */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Alert feed</h2>
            <span className="text-xs text-slate-400">
              AI triage · severity · ATT&CK mapping
            </span>
          </div>
          <AlertFeed rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">
              {selectedRow ? "Triage & remediation" : "Remediation plan"}
            </h2>
            {selectedRow && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                Clear
              </button>
            )}
          </div>
          <div className="scroll-slim max-h-[640px] overflow-y-auto p-4">
            <RemediationPanel
              alert={selectedRow?.alert ?? null}
              triage={selectedRow?.triage ?? null}
              remediations={remediations}
            />
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 dark:border-slate-800">
        Strictly defensive / blue-team. No offensive tooling. Runs with mock triage when no AI key is configured.
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "brand" | "red" | "emerald" | "violet";
}) {
  const accentText: Record<typeof accent, string> = {
    brand: "text-brand-600 dark:text-brand-400",
    red: "text-red-600 dark:text-red-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accentText[accent]}`}>
        {value}
      </p>
    </div>
  );
}
