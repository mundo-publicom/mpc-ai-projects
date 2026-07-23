"use client";

import { useMemo, useState } from "react";
import type { ActionPlan, ToolCall, ToolCallStatus } from "@/lib/types";

const STATUS_STYLES: Record<ToolCallStatus, string> = {
  planned: "bg-slate-500/15 text-slate-300",
  awaiting_approval: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  approved: "bg-brand-500/15 text-brand-200",
  running: "bg-brand-500/15 text-brand-200 animate-pulse",
  succeeded: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  rejected: "bg-slate-600/20 text-slate-400 line-through",
};

const STATUS_LABEL: Record<ToolCallStatus, string> = {
  planned: "planned",
  awaiting_approval: "needs approval",
  approved: "approved",
  running: "running",
  succeeded: "done",
  failed: "failed",
  rejected: "skipped",
};

function StepRow({
  step,
  selectable,
  checked,
  onToggle,
}: {
  step: ToolCall;
  selectable: boolean;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      {selectable ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-4 w-4 accent-brand-500"
          aria-label={`Approve step ${step.step}`}
        />
      ) : (
        <span className="mt-0.5 w-4 text-center text-[11px] text-slate-500">{step.step}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-brand-200">
            {step.toolName}
          </code>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[step.status]}`}
          >
            {STATUS_LABEL[step.status]}
          </span>
          {step.effect === "write" && (
            <span className="text-[10px] uppercase tracking-wide text-amber-400/70">write</span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-300">{step.summary}</p>
        {step.error && <p className="mt-1 text-xs text-red-300">{step.error}</p>}
      </div>
    </li>
  );
}

export function ActionPlanPanel({
  plan,
  busy,
  onDecide,
}: {
  plan: ActionPlan | null;
  busy: boolean;
  onDecide: (approvals: { toolCallId: string; approved: boolean }[]) => void;
}) {
  const pending = useMemo(
    () => (plan ? plan.steps.filter((s) => s.status === "awaiting_approval") : []),
    [plan],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-8 text-center">
        <span className="text-2xl" aria-hidden>
          ✦
        </span>
        <p className="text-sm text-slate-400">
          Give a command above. Your assistant will plan the steps, run the safe ones, and hold
          any writes here for your approval.
        </p>
      </div>
    );
  }

  const approveSelected = () => {
    const approvals = pending.map((s) => ({
      toolCallId: s.id,
      approved: Boolean(selected[s.id]),
    }));
    onDecide(approvals);
  };
  const approveAll = () =>
    onDecide(pending.map((s) => ({ toolCallId: s.id, approved: true })));
  const rejectAll = () =>
    onDecide(pending.map((s) => ({ toolCallId: s.id, approved: false })));

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Action plan</h2>
          <span className="flex items-center gap-2">
            {plan.mocked && (
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] text-slate-400">
                mock
              </span>
            )}
            <span className="text-[11px] text-slate-500">{plan.latencyMs} ms</span>
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">{plan.reply}</p>
      </div>

      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {plan.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            selectable={step.status === "awaiting_approval" && !busy}
            checked={Boolean(selected[step.id])}
            onToggle={(v) => setSelected((s) => ({ ...s, [step.id]: v }))}
          />
        ))}
        {plan.steps.length === 0 && (
          <li className="py-6 text-center text-xs text-slate-500">
            No tool calls were needed for this command.
          </li>
        )}
      </ol>

      {pending.length > 0 && (
        <div className="border-t border-white/10 p-3">
          <p className="mb-2 text-[11px] text-amber-300/80">
            {pending.length} action{pending.length === 1 ? "" : "s"} waiting on your approval.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={approveAll}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:opacity-40"
            >
              Approve all
            </button>
            <button
              onClick={approveSelected}
              disabled={busy}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-500/40 disabled:opacity-40"
            >
              Approve selected
            </button>
            <button
              onClick={rejectAll}
              disabled={busy}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
            >
              Reject all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
