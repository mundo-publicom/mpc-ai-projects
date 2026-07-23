"use client";

import type { LogoConcept } from "@/lib/types";

const STYLE_LABELS: Record<string, string> = {
  wordmark: "Wordmark",
  lettermark: "Lettermark",
  combination: "Combination mark",
  icon: "Icon-led",
  emblem: "Emblem",
};

interface LogoConceptsProps {
  concepts: LogoConcept[];
  /** Background color to preview the logos on (usually the palette background). */
  background: string;
}

export function LogoConcepts({ concepts, background }: LogoConceptsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {concepts.map((concept) => (
        <figure
          key={concept.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div
            className="flex h-32 items-center justify-center border-b border-slate-100 p-4 dark:border-slate-800"
            style={{ backgroundColor: background }}
          >
            {/* The SVG is model/mock-produced and sanitized in lib/ai.ts. */}
            <div
              className="w-full max-w-[240px]"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: concept.svg }}
            />
          </div>
          <figcaption className="flex flex-1 flex-col gap-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {concept.name}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {STYLE_LABELS[concept.style] ?? concept.style}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {concept.rationale}
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
