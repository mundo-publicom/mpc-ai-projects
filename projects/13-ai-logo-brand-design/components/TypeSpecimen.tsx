"use client";

import type { TypePairing } from "@/lib/types";

interface TypeSpecimenProps {
  typography: TypePairing;
  sampleHeadline: string;
  sampleBody: string;
}

export function TypeSpecimen({
  typography,
  sampleHeadline,
  sampleBody,
}: TypeSpecimenProps) {
  const headingStack = `"${typography.heading.family}", ${typography.heading.fallback}`;
  const bodyStack = `"${typography.body.family}", ${typography.body.fallback}`;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <TypeCard
          role="Headings"
          spec={typography.heading}
          stack={headingStack}
        />
        <TypeCard role="Body" spec={typography.body} stack={bodyStack} />
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <p
          className="mb-2 text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100"
          style={{ fontFamily: headingStack }}
        >
          {sampleHeadline}
        </p>
        <p
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
          style={{ fontFamily: bodyStack }}
        >
          {sampleBody}
        </p>
      </div>

      <p className="text-xs italic leading-relaxed text-slate-500 dark:text-slate-400">
        {typography.rationale}
      </p>
      <p className="text-[11px] text-slate-400">
        Fonts referenced by name (Google Fonts). The specimen uses system
        fallbacks until the families are loaded in your app.
      </p>
    </div>
  );
}

function TypeCard({
  role,
  spec,
  stack,
}: {
  role: string;
  spec: TypePairing["heading"];
  stack: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {role} · {spec.category}
      </div>
      <div
        className="mt-1 text-xl text-slate-900 dark:text-slate-100"
        style={{ fontFamily: stack }}
      >
        {spec.family}
      </div>
      <div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
        weights: {spec.weights.join(", ")}
      </div>
    </div>
  );
}
