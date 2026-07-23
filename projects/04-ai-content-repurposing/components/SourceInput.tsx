"use client";

import { countWords } from "@/lib/ai";
import type { SourceKind } from "@/lib/types";

const KIND_OPTIONS: { value: SourceKind; label: string }[] = [
  { value: "blog_post", label: "Blog post" },
  { value: "youtube_transcript", label: "YouTube transcript" },
  { value: "podcast_transcript", label: "Podcast transcript" },
  { value: "newsletter", label: "Newsletter" },
  { value: "webinar", label: "Webinar" },
  { value: "raw_notes", label: "Raw notes" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  kind: SourceKind;
  onKindChange: (k: SourceKind) => void;
  disabled?: boolean;
}

export function SourceInput({ value, onChange, kind, onKindChange, disabled }: Props) {
  const words = value.trim() ? countWords(value) : 0;
  const readMins = Math.max(1, Math.round(words / 200));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="source" className="text-sm font-semibold text-slate-200">
          Source content
        </label>
        <select
          value={kind}
          onChange={(e) => onKindChange(e.target.value as SourceKind)}
          disabled={disabled}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 outline-none focus:border-brand-500"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        id="source"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste your blog post, YouTube transcript, or podcast transcript here…"
        className="h-64 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-4 font-mono text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500 disabled:opacity-60"
      />

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{words.toLocaleString()} words</span>
        <span>~{readMins} min read</span>
        {words > 0 && words < 30 && (
          <span className="text-amber-400">Add at least a paragraph to repurpose.</span>
        )}
      </div>
    </div>
  );
}
