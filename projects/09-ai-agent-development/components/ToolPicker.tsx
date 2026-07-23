"use client";

import { TOOL_CATALOG } from "@/lib/types";

export function ToolPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Tools ({selected.length} enabled)
      </div>
      <div className="grid gap-2">
        {TOOL_CATALOG.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={[
                "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                on
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px]",
                  on ? "border-brand-400 bg-brand-500 text-white" : "border-slate-600",
                ].join(" ")}
              >
                {on ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{t.name}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                    {t.category}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">{t.description}</span>
                <code className="mt-1 block font-mono text-[11px] text-slate-500">
                  {t.inputHint}
                </code>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
