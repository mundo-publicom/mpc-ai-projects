"use client";

import type { Brief, CampaignGoal } from "@/lib/types";
import { toList } from "./BrandVoiceForm";

const GOALS: CampaignGoal[] = [
  "awareness",
  "clicks",
  "leads",
  "sales",
  "signups",
  "retention",
];

const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function BriefForm({
  value,
  onChange,
}: {
  value: Brief;
  onChange: (patch: Partial<Brief>) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Brief</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        What this specific piece of copy is selling and to whom.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={labelCls}>Product / offer</label>
          <input
            className={inputCls}
            value={value.product}
            onChange={(e) => onChange({ product: e.target.value })}
            placeholder="AI-powered inventory forecasting for Shopify stores"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Audience (this piece)</label>
            <input
              className={inputCls}
              value={value.audience}
              onChange={(e) => onChange({ audience: e.target.value })}
              placeholder="Store owners tired of stockouts"
            />
          </div>
          <div>
            <label className={labelCls}>Goal</label>
            <select
              className={inputCls}
              value={value.goal}
              onChange={(e) => onChange({ goal: e.target.value as CampaignGoal })}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Key benefits</label>
          <input
            className={inputCls}
            value={value.keyBenefits.join(", ")}
            onChange={(e) => onChange({ keyBenefits: toList(e.target.value) })}
            placeholder="never run out of stock, cut carrying costs 20%"
          />
        </div>

        <div>
          <label className={labelCls}>Proof points</label>
          <input
            className={inputCls}
            value={value.proofPoints.join(", ")}
            onChange={(e) => onChange({ proofPoints: toList(e.target.value) })}
            placeholder="used by 4,000 stores, 4.9★ on the App Store"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>CTA</label>
            <input
              className={inputCls}
              value={value.cta}
              onChange={(e) => onChange({ cta: e.target.value })}
              placeholder="Start free trial"
            />
          </div>
          <div>
            <label className={labelCls}>Keywords</label>
            <input
              className={inputCls}
              value={value.keywords.join(", ")}
              onChange={(e) => onChange({ keywords: toList(e.target.value) })}
              placeholder="inventory forecasting, shopify"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Constraints (optional)</label>
          <input
            className={inputCls}
            value={value.constraints}
            onChange={(e) => onChange({ constraints: e.target.value })}
            placeholder="Must mention the 14-day trial. No emojis."
          />
        </div>
      </div>
    </section>
  );
}
