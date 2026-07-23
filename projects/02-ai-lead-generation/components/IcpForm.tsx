"use client";

import { useState } from "react";
import type { CompanySize, Icp } from "@/lib/types";

const SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

const DEFAULT_ICP: Icp = {
  description:
    "Series A–B B2B SaaS companies in North America scaling their go-to-market. We sell an outbound-automation platform.",
  industries: ["SaaS", "Fintech", "Developer Tools"],
  companySizes: ["51-200", "201-500"],
  regions: ["North America"],
  targetTitles: ["VP of Sales", "Head of Marketing", "RevOps Lead", "Founder & CEO"],
  buyingSignals: ["hiring SDRs", "uses HubSpot", "recently raised", "expanding sales team"],
  valueProposition: "cut cost-per-qualified-lead by automating research and first-touch outreach",
  exclusions: ["agencies", "government"],
};

function csv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface IcpFormProps {
  onGenerate: (icp: Icp, count: number) => void;
  loading: boolean;
}

export function IcpForm({ onGenerate, loading }: IcpFormProps) {
  const [description, setDescription] = useState(DEFAULT_ICP.description);
  const [industries, setIndustries] = useState(DEFAULT_ICP.industries.join(", "));
  const [regions, setRegions] = useState(DEFAULT_ICP.regions.join(", "));
  const [titles, setTitles] = useState(DEFAULT_ICP.targetTitles.join(", "));
  const [signals, setSignals] = useState(DEFAULT_ICP.buyingSignals.join(", "));
  const [valueProp, setValueProp] = useState(DEFAULT_ICP.valueProposition);
  const [exclusions, setExclusions] = useState(DEFAULT_ICP.exclusions.join(", "));
  const [sizes, setSizes] = useState<CompanySize[]>(DEFAULT_ICP.companySizes);
  const [count, setCount] = useState(8);

  function toggleSize(size: CompanySize) {
    setSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const icp: Icp = {
      description,
      industries: csv(industries),
      companySizes: sizes,
      regions: csv(regions),
      targetTitles: csv(titles),
      buyingSignals: csv(signals),
      valueProposition: valueProp,
      exclusions: csv(exclusions),
    };
    onGenerate(icp, count);
  }

  const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const label = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className={label} htmlFor="desc">Ideal Customer Profile</label>
        <textarea
          id="desc"
          className={`${field} min-h-[80px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your ideal customer in plain English…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="industries">Industries</label>
          <input id="industries" className={field} value={industries} onChange={(e) => setIndustries(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="regions">Regions</label>
          <input id="regions" className={field} value={regions} onChange={(e) => setRegions(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="titles">Target titles</label>
          <input id="titles" className={field} value={titles} onChange={(e) => setTitles(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="signals">Buying signals</label>
          <input id="signals" className={field} value={signals} onChange={(e) => setSignals(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="valueprop">Value proposition</label>
        <input id="valueprop" className={field} value={valueProp} onChange={(e) => setValueProp(e.target.value)} />
      </div>

      <div>
        <label className={label} htmlFor="exclusions">Exclusions</label>
        <input id="exclusions" className={field} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
      </div>

      <div>
        <span className={label}>Company size</span>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggleSize(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                sizes.includes(s)
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="w-32">
          <label className={label} htmlFor="count">Sample size</label>
          <input
            id="count"
            type="number"
            min={1}
            max={25}
            className={field}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Finding leads…" : "Generate leads"}
        </button>
      </div>
    </form>
  );
}
