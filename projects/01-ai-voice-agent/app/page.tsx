import { hasAI } from "@/lib/ai";
import { Console } from "@/components/Console";
import { OUTCOME_LABELS, type Call } from "@/lib/types";

/**
 * Dashboard. Server Component: renders the AI-status banner, KPI tiles, the
 * interactive console (client island), and recent call logs. Call-log data is
 * mocked here; in production it comes from the calls table.
 */

const RECENT_CALLS: Pick<
  Call,
  "id" | "direction" | "fromE164" | "status" | "outcome" | "durationSec" | "costUsd" | "startedAt"
>[] = [
  { id: "c_8f21", direction: "inbound", fromE164: "+14155550142", status: "completed", outcome: "appointment_booked", durationSec: 138, costUsd: 0.32, startedAt: "2026-07-23T14:02:00Z" },
  { id: "c_8f18", direction: "outbound", fromE164: "+16505550188", status: "completed", outcome: "lead_qualified", durationSec: 96, costUsd: 0.23, startedAt: "2026-07-23T13:41:00Z" },
  { id: "c_8f10", direction: "inbound", fromE164: "+12135550109", status: "completed", outcome: "escalated", durationSec: 210, costUsd: 0.49, startedAt: "2026-07-23T13:12:00Z" },
  { id: "c_8f04", direction: "inbound", fromE164: "+14085550177", status: "completed", outcome: "resolved", durationSec: 72, costUsd: 0.17, startedAt: "2026-07-23T12:55:00Z" },
  { id: "c_8ef9", direction: "outbound", fromE164: "+19175550123", status: "no_answer", outcome: "abandoned", durationSec: 0, costUsd: 0.0, startedAt: "2026-07-23T12:30:00Z" },
];

function fmtDuration(sec: number): string {
  if (sec === 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function Page() {
  const aiEnabled = hasAI();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            AV
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Voice Agent</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Inbound &amp; outbound voice agents that book, qualify, and support — billed per minute.
            </p>
          </div>
        </div>

        <div
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
            aiEnabled
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${aiEnabled ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {aiEnabled
            ? "AI Gateway connected — live model replies"
            : "Demo mode — no API key, serving realistic mock replies"}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Calls today" value="312" sub="+18% vs. yesterday" />
        <Stat label="Containment rate" value="74%" sub="handled without a human" />
        <Stat label="Avg. handle time" value="1:52" sub="per completed call" />
        <Stat label="Usage revenue (mo.)" value="$4,820" sub="at $0.14/min blended" />
      </section>

      <div className="mb-10">
        <Console />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-4 text-lg font-semibold">Recent calls</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="py-2 pr-4 font-medium">Call</th>
                <th className="py-2 pr-4 font-medium">Dir.</th>
                <th className="py-2 pr-4 font-medium">From</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Outcome</th>
                <th className="py-2 pr-4 font-medium">Duration</th>
                <th className="py-2 pr-4 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_CALLS.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                >
                  <td className="py-2.5 pr-4 font-mono text-xs">{c.id}</td>
                  <td className="py-2.5 pr-4 capitalize">{c.direction}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{c.fromE164}</td>
                  <td className="py-2.5 pr-4 capitalize">{c.status.replace("_", " ")}</td>
                  <td className="py-2.5 pr-4">{OUTCOME_LABELS[c.outcome]}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{fmtDuration(c.durationSec)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    ${c.costUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 text-center text-xs text-slate-400">
        AI Voice Agent · part of the Make-Money-with-AI portfolio · docs in{" "}
        <code className="font-mono">/docs</code>
      </footer>
    </main>
  );
}
