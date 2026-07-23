"use client";

import type { Palette } from "@/lib/types";
import { auditPalette, readableTextColor } from "@/lib/palette";

interface PaletteSwatchesProps {
  palette: Palette;
}

export function PaletteSwatches({ palette }: PaletteSwatchesProps) {
  const audit = auditPalette(palette);
  const failures = audit.filter((c) => !c.passesBody && c.level === "Fail");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {palette.colors.map((color) => {
          const text = readableTextColor(color.hex);
          return (
            <div
              key={`${color.role}-${color.hex}`}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800"
            >
              <div
                className="flex h-20 items-end p-2"
                style={{ backgroundColor: color.hex, color: text }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {color.role}
                </span>
              </div>
              <div className="bg-white px-2 py-1.5 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                  {color.name}
                </div>
                <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400">
                  {color.hex}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-1 font-medium text-slate-700 dark:text-slate-300">
          Accessibility check (WCAG 2.1)
        </div>
        {failures.length === 0 ? (
          <p className="text-emerald-600 dark:text-emerald-400">
            All brand colors pass AA for large text with an auto-selected
            black/white foreground.
          </p>
        ) : (
          <p className="text-amber-600 dark:text-amber-400">
            {failures.length} pairing(s) fall below AA — consider darkening or
            lightening for text-heavy surfaces.
          </p>
        )}
      </div>
    </div>
  );
}
