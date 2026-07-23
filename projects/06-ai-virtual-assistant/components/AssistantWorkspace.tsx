"use client";

import { useState } from "react";
import type {
  ActionPlan,
  AssistantResponse,
  CalendarEvent,
  DashboardData,
  EmailPriority,
  EmailThread,
} from "@/lib/types";
import { CommandBar } from "@/components/CommandBar";
import { TaskList } from "@/components/TaskList";
import { ActionPlanPanel } from "@/components/ActionPlanPanel";

const PRIORITY_DOT: Record<EmailPriority, string> = {
  urgent: "bg-red-400",
  important: "bg-orange-400",
  normal: "bg-brand-400",
  low: "bg-slate-500",
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function CalendarColumn({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((e) => (
        <div key={e.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-100">{e.title}</p>
            <span className="shrink-0 font-mono text-[11px] text-brand-200">
              {time(e.startAt)}–{time(e.endAt)}
            </span>
          </div>
          {e.attendees.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {e.attendees.map((a) => a.name ?? a.email).join(", ")}
            </p>
          )}
        </div>
      ))}
      {events.length === 0 && (
        <p className="px-1 py-6 text-center text-sm text-slate-500">No events today.</p>
      )}
    </div>
  );
}

function InboxColumn({ threads }: { threads: EmailThread[] }) {
  return (
    <div className="flex flex-col gap-2">
      {threads.map((t) => (
        <div key={t.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
            <p className="truncate text-sm font-medium text-slate-100">{t.subject}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{t.summary}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] capitalize text-slate-300">
              {t.recommendedAction.replace("_", " ")}
            </span>
            <span className="text-[10px] text-slate-500">
              {t.messages[t.messages.length - 1]?.fromName ??
                t.messages[0]?.fromEmail}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Column({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        <span className="text-[11px] text-slate-500">{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}

export function AssistantWorkspace({ data }: { data: DashboardData }) {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status}).`);
      }
      const body = (await res.json()) as AssistantResponse;
      setPlan(body.plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const runCommand = (command: string) => call({ command });
  const decide = (approvals: { toolCallId: string; approved: boolean }[]) => {
    if (!plan) return;
    call({ command: plan.command, planId: plan.id, approvals });
  };

  const openTasks = data.tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Aide <span className="text-slate-500">·</span>{" "}
            <span className="text-sm font-normal text-slate-400">
              good morning, {data.user.name.split(" ")[0]}
            </span>
          </h1>
          <p className="text-[11px] text-slate-500">
            {openTasks} open tasks · {data.events.length} meetings ·{" "}
            {data.threads.filter((t) => t.unread).length} unread ·{" "}
            autonomy: {data.user.preferences.autonomy.replace("_", " ")}
          </p>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
          {(["gmail", "googleCalendar", "slack"] as const).map((k) => (
            <span
              key={k}
              className={`rounded-full px-2 py-1 ring-1 ${
                data.user.connections[k]
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                  : "bg-white/5 text-slate-500 ring-white/10"
              }`}
            >
              {k === "googleCalendar" ? "calendar" : k}
            </span>
          ))}
        </div>
      </header>

      <CommandBar onSubmit={runCommand} busy={busy} />
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_1.1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Column title="Today's tasks" count={openTasks}>
            <TaskList tasks={data.tasks} />
          </Column>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Column title="Calendar" count={data.events.length}>
            <CalendarColumn events={data.events} />
          </Column>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Column title="Inbox triage" count={data.threads.length}>
            <InboxColumn threads={data.threads} />
          </Column>
        </div>
        <div className="min-h-[420px]">
          <ActionPlanPanel plan={plan} busy={busy} onDecide={decide} />
        </div>
      </div>
    </div>
  );
}
