"use client";

import type { Run, Step, TraceEvent } from "@/lib/types";

function pretty(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const EVENT_COLOR: Record<TraceEvent["type"], string> = {
  run_start: "bg-slate-600",
  model_step: "bg-brand-500",
  tool_call: "bg-emerald-500",
  run_end: "bg-slate-600",
};

function Timeline({ run }: { run: Run }) {
  const events = run.trace.events.filter((e) => e.durationMs > 0 || e.type === "tool_call");
  const total = Math.max(run.latencyMs, 1);
  return (
    <div className="space-y-1.5">
      {events.map((e) => {
        const widthPct = Math.max(2, (e.durationMs / total) * 100);
        const leftPct = Math.min(98, (e.tStartMs / total) * 100);
        return (
          <div key={e.id} className="flex items-center gap-2">
            <div className="w-40 flex-none truncate text-[11px] text-slate-400">{e.label}</div>
            <div className="relative h-3 flex-1 rounded bg-slate-800">
              <div
                className={`absolute top-0 h-3 rounded ${EVENT_COLOR[e.type]}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${e.durationMs} ms`}
              />
            </div>
            <div className="w-14 flex-none text-right font-mono text-[11px] text-slate-500">
              {e.durationMs}ms
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-300">
          step {step.index + 1}
        </span>
        <span
          className={[
            "rounded px-2 py-0.5 font-medium",
            step.kind === "final"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-brand-500/15 text-brand-300",
          ].join(" ")}
        >
          {step.kind}
        </span>
        <span className="text-slate-500">finish: {step.finishReason}</span>
      </div>

      {step.text ? (
        <p className="whitespace-pre-wrap text-sm text-slate-200">{step.text}</p>
      ) : (
        <p className="text-xs italic text-slate-500">(no assistant text on this step)</p>
      )}

      {step.toolCalls.length > 0 && (
        <div className="mt-3 space-y-2">
          {step.toolCalls.map((c) => (
            <div
              key={c.toolCallId}
              className={[
                "rounded-md border p-2",
                c.ok ? "border-emerald-800/60 bg-emerald-950/30" : "border-red-800/60 bg-red-950/30",
              ].join(" ")}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium text-emerald-300">{c.toolName}()</span>
                <span className="font-mono text-slate-500">{c.latencyMs}ms</span>
              </div>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase text-slate-500">input</div>
                  <pre className="scroll-thin mt-0.5 max-h-32 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                    {pretty(c.input)}
                  </pre>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500">
                    {c.ok ? "output" : "error"}
                  </div>
                  <pre className="scroll-thin mt-0.5 max-h-32 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                    {c.ok ? pretty(c.output) : c.error}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RunTrace({
  run,
  loading,
  error,
}: {
  run: Run | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        <span className="animate-pulse">Running agent loop…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!run) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-800 text-sm text-slate-600">
        Run the agent to see its step-by-step trace here.
      </div>
    );
  }

  const toolCalls = run.steps.reduce((n, s) => n + s.toolCalls.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge label={run.status} tone={run.status === "completed" ? "good" : "bad"} />
        {run.mocked && <Badge label="mock (no key)" tone="warn" />}
        <Badge label={run.model} tone="neutral" />
        <Badge label={`${run.steps.length} steps`} tone="neutral" />
        <Badge label={`${toolCalls} tool calls`} tone="neutral" />
        <Badge label={`${run.latencyMs} ms`} tone="neutral" />
        <Badge label={`${run.usage.totalTokens} tok`} tone="neutral" />
      </div>

      {run.error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {run.error}
        </div>
      )}

      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Final answer
        </h3>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-100">
          {run.output || <span className="italic text-slate-500">(empty)</span>}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Trace timeline
        </h3>
        <Timeline run={run} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Steps
        </h3>
        <div className="space-y-2">
          {run.steps.map((s) => (
            <StepCard key={s.index} step={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  const cls = {
    good: "bg-emerald-500/15 text-emerald-300",
    bad: "bg-red-500/15 text-red-300",
    warn: "bg-amber-500/15 text-amber-300",
    neutral: "bg-slate-800 text-slate-300",
  }[tone];
  return <span className={`rounded px-2 py-0.5 font-mono ${cls}`}>{label}</span>;
}
