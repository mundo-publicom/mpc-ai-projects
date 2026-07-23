import type { Task, TaskPriority } from "@/lib/types";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-500/15 text-red-300 ring-red-500/30",
  high: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  medium: "bg-brand-500/15 text-brand-200 ring-brand-500/30",
  low: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

function dueLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-2">
      {open.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-white/5 bg-white/[0.03] p-3 transition hover:border-white/10"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-slate-100">{t.title}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${PRIORITY_STYLES[t.priority]}`}
            >
              {t.priority}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="capitalize">{t.status.replace("_", " ")}</span>
            {dueLabel(t.dueAt) && (
              <>
                <span aria-hidden>·</span>
                <span>due {dueLabel(t.dueAt)}</span>
              </>
            )}
            {t.source !== "manual" && (
              <>
                <span aria-hidden>·</span>
                <span className="text-brand-300">from {t.source}</span>
              </>
            )}
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <p className="mt-1 px-1 text-[11px] text-slate-500">
          {done.length} completed today
        </p>
      )}
      {open.length === 0 && (
        <p className="px-1 py-6 text-center text-sm text-slate-500">Inbox zero on tasks. 🎉</p>
      )}
    </div>
  );
}
