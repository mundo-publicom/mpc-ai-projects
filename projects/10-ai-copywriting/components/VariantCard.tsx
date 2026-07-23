"use client";

import { useState } from "react";
import type { Variant } from "@/lib/types";
import { FRAMEWORKS } from "@/lib/frameworks";

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (score >= 65) return "bg-amber-100 text-amber-700 ring-amber-200";
  return "bg-rose-100 text-rose-700 ring-rose-200";
}

function riskColor(risk: Variant["critique"]["plagiarismRisk"]): string {
  if (risk === "low") return "text-emerald-600";
  if (risk === "medium") return "text-amber-600";
  return "text-rose-600";
}

/** Assemble the full copy of a variant for the clipboard. */
function plainText(v: Variant): string {
  const c = v.content;
  const parts = [
    c.headline,
    c.subheadline,
    c.body,
    c.altHeadlines?.length ? `Alt headlines:\n${c.altHeadlines.join("\n")}` : "",
    c.altDescriptions?.length ? `Alt descriptions:\n${c.altDescriptions.join("\n")}` : "",
    c.cta ? `CTA: ${c.cta}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function VariantCard({ variant, rank }: { variant: Variant; rank: number }) {
  const [copied, setCopied] = useState(false);
  const { content, critique, framework } = variant;
  const fw = FRAMEWORKS[framework];

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText(variant));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            #{rank}
          </span>
          <span
            className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
            title={fw.summary}
          >
            {fw.name}
          </span>
          {rank === 1 && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Recommended
            </span>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${scoreColor(
            critique.overallScore,
          )}`}
          title="Overall score"
        >
          {critique.overallScore}
        </div>
      </header>

      <div className="mt-4 space-y-2">
        <h3 className="text-base font-bold leading-snug text-slate-900">{content.headline}</h3>
        {content.subheadline && (
          <p className="text-sm font-medium text-slate-600">{content.subheadline}</p>
        )}
        {content.body && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {content.body}
          </p>
        )}
        {content.altHeadlines && content.altHeadlines.length > 0 && (
          <div className="text-xs text-slate-500">
            <span className="font-semibold">Alt headlines:</span> {content.altHeadlines.join(" · ")}
          </div>
        )}
        {content.cta && (
          <div className="pt-1">
            <span className="inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
              {content.cta}
            </span>
          </div>
        )}
      </div>

      {/* Score breakdown */}
      <div className="mt-4 grid grid-cols-5 gap-1 text-center">
        {(
          [
            ["Clarity", critique.breakdown.clarity],
            ["Persuade", critique.breakdown.persuasion],
            ["Brand", critique.breakdown.brandFit],
            ["Brevity", critique.breakdown.brevity],
            ["CTA", critique.breakdown.ctaStrength],
          ] as const
        ).map(([label, val]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-1 py-1.5">
            <div className="text-xs font-bold text-slate-800">{val}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Critique */}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{critique.rationale}</p>

      {critique.suggestions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {critique.suggestions.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-600">
              <span className="text-brand-500">→</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Safety row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span
          className={
            critique.brandSafety.passed
              ? "font-semibold text-emerald-600"
              : "font-semibold text-rose-600"
          }
        >
          {critique.brandSafety.passed ? "✓ Brand-safe" : "✕ Brand-safety flags"}
        </span>
        <span className={riskColor(critique.plagiarismRisk)}>
          Plagiarism: {critique.plagiarismRisk}
        </span>
      </div>
      {!critique.brandSafety.passed && critique.brandSafety.flags.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {critique.brandSafety.flags.map((f, i) => (
            <li key={i} className="text-xs text-rose-500">
              • {f}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <button
          onClick={copy}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </footer>
    </article>
  );
}
