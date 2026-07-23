"use client";

import type { BrandVoice, ReadingLevel } from "@/lib/types";

/** Split a comma / newline separated string into a trimmed list. */
export function toList(v: string): string[] {
  return v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const READING_LEVELS: ReadingLevel[] = [
  "simple",
  "conversational",
  "professional",
  "expert",
];

const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function BrandVoiceForm({
  value,
  onChange,
}: {
  value: BrandVoice;
  onChange: (patch: Partial<BrandVoice>) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Brand voice</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        The persona every variant is written in. Forbidden words are enforced by the
        brand-safety check.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={labelCls}>Profile name</label>
          <input
            className={inputCls}
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Acme — Playful"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tone (comma-separated)</label>
            <input
              className={inputCls}
              value={value.tone.join(", ")}
              onChange={(e) => onChange({ tone: toList(e.target.value) })}
              placeholder="confident, warm, witty"
            />
          </div>
          <div>
            <label className={labelCls}>Reading level</label>
            <select
              className={inputCls}
              value={value.readingLevel}
              onChange={(e) => onChange({ readingLevel: e.target.value as ReadingLevel })}
            >
              {READING_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Audience</label>
          <input
            className={inputCls}
            value={value.audience}
            onChange={(e) => onChange({ audience: e.target.value })}
            placeholder="Busy DTC founders scaling past $1M/yr"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Always do</label>
            <input
              className={inputCls}
              value={value.doList.join(", ")}
              onChange={(e) => onChange({ doList: toList(e.target.value) })}
              placeholder="active voice, short sentences"
            />
          </div>
          <div>
            <label className={labelCls}>Never do</label>
            <input
              className={inputCls}
              value={value.avoidList.join(", ")}
              onChange={(e) => onChange({ avoidList: toList(e.target.value) })}
              placeholder="jargon, hype, exclamation spam"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Power words</label>
            <input
              className={inputCls}
              value={value.powerWords.join(", ")}
              onChange={(e) => onChange({ powerWords: toList(e.target.value) })}
              placeholder="effortless, proven, ship"
            />
          </div>
          <div>
            <label className={labelCls}>Forbidden words</label>
            <input
              className={inputCls}
              value={value.forbiddenWords.join(", ")}
              onChange={(e) => onChange({ forbiddenWords: toList(e.target.value) })}
              placeholder="cheap, guarantee, synergy"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>On-brand sample (optional)</label>
          <textarea
            className={`${inputCls} h-20 resize-y`}
            value={value.sample}
            onChange={(e) => onChange({ sample: e.target.value })}
            placeholder="Paste a paragraph of writing that sounds exactly like the brand…"
          />
        </div>
      </div>
    </section>
  );
}
