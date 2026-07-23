"use client";

import { useState } from "react";
import {
  BRAND_STYLES,
  BRAND_STYLE_LABELS,
  type Brief,
  type BrandStyle,
} from "@/lib/types";

interface BriefFormProps {
  onSubmit: (brief: Brief) => void;
  loading: boolean;
}

const EXAMPLE: Brief = {
  name: "Northwind",
  industry: "climate fintech",
  values: ["trust", "momentum", "clarity"],
  style: "modern",
  audience: "founders raising their first round",
  description:
    "A platform that helps startups measure and offset their carbon footprint.",
};

export function BriefForm({ onSubmit, loading }: BriefFormProps) {
  const [name, setName] = useState(EXAMPLE.name);
  const [industry, setIndustry] = useState(EXAMPLE.industry);
  const [valuesText, setValuesText] = useState(EXAMPLE.values.join(", "));
  const [style, setStyle] = useState<BrandStyle>(EXAMPLE.style);
  const [audience, setAudience] = useState(EXAMPLE.audience ?? "");
  const [description, setDescription] = useState(EXAMPLE.description ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values = valuesText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 8);
    onSubmit({
      name: name.trim(),
      industry: industry.trim(),
      values,
      style,
      audience: audience.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Brand name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
          placeholder="e.g. Northwind"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Industry
        </label>
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          required
          maxLength={80}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
          placeholder="e.g. climate fintech"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Brand values{" "}
          <span className="text-slate-400">(comma separated)</span>
        </label>
        <input
          value={valuesText}
          onChange={(e) => setValuesText(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
          placeholder="trust, momentum, clarity"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Style direction
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BRAND_STYLES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStyle(s)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                style === s
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {BRAND_STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Target audience{" "}
          <span className="text-slate-400">(optional)</span>
        </label>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
          placeholder="e.g. founders raising their first round"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
          placeholder="One or two sentences about what you do."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Designing your brand…" : "Generate brand kit"}
      </button>
    </form>
  );
}
