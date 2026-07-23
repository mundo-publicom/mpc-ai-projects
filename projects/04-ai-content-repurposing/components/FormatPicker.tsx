"use client";

import { FORMAT_LIST } from "@/lib/formats";
import type { FormatId } from "@/lib/types";

interface Props {
  selected: FormatId[];
  onToggle: (id: FormatId) => void;
  onSelectAll: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export function FormatPicker({ selected, onToggle, onSelectAll, onClear, disabled }: Props) {
  const set = new Set(selected);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">
          Formats <span className="text-slate-500">({selected.length} selected)</span>
        </span>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={disabled}
            className="text-brand-400 hover:text-brand-300 disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-slate-400 hover:text-slate-300 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FORMAT_LIST.map((f) => {
          const active = set.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onToggle(f.id)}
              disabled={disabled}
              title={f.description}
              className={[
                "flex items-start gap-2 rounded-lg border p-3 text-left transition disabled:opacity-50",
                active
                  ? "border-brand-500 bg-brand-500/10"
                  : "border-slate-700 bg-slate-900 hover:border-slate-600",
              ].join(" ")}
            >
              <span className="mt-0.5 text-base leading-none text-slate-400">{f.glyph}</span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-100">{f.label}</span>
                <span className="text-[11px] leading-tight text-slate-500">{f.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
