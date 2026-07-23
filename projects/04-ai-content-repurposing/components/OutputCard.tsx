"use client";

import { useState } from "react";
import type { Output } from "@/lib/types";
import { FORMATS, limitFor } from "@/lib/formats";

interface Props {
  output: Output;
}

export function OutputCard({ output }: Props) {
  const [copied, setCopied] = useState(false);
  const def = FORMATS[output.format];
  const limit = limitFor(output.format);

  async function copy() {
    const text =
      output.hashtags.length > 0
        ? `${output.body}\n\n${output.hashtags.join(" ")}`
        : output.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base text-slate-400">{def.glyph}</span>
          <h3 className="text-sm font-semibold text-slate-100">{output.label}</h3>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-brand-500 hover:text-brand-300"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </header>

      <div className="flex-1 px-4 py-3">
        {output.segments && output.segments.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {output.segments.map((seg, i) => (
              <li
                key={i}
                className="rounded-md bg-slate-950/60 px-3 py-2 text-sm leading-relaxed text-slate-200"
              >
                {seg}
              </li>
            ))}
          </ol>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {output.body}
          </p>
        )}

        {output.hashtags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1 text-xs text-brand-400">
            {output.hashtags.map((h) => (
              <span key={h}>{h.startsWith("#") ? h : `#${h}`}</span>
            ))}
          </p>
        )}

        {output.notes && (
          <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] italic text-slate-500">
            {output.notes}
          </p>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
        <span>
          {output.charCount.toLocaleString()} chars
          {limit ? ` / ${limit.toLocaleString()}${def.multiSegment ? " per unit" : ""}` : ""}
        </span>
        {output.overLimit ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">Over limit</span>
        ) : (
          <span className="text-brand-500">✓ within limit</span>
        )}
      </footer>
    </div>
  );
}
