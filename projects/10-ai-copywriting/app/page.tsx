"use client";

import { useState } from "react";
import { BrandVoiceForm } from "@/components/BrandVoiceForm";
import { BriefForm } from "@/components/BriefForm";
import { VariantCard } from "@/components/VariantCard";
import { COPY_TYPES } from "@/lib/types";
import type {
  BrandVoice,
  Brief,
  CopyType,
  GenerateCopyResponse,
} from "@/lib/types";

const DEFAULT_BRAND_VOICE: BrandVoice = {
  name: "Acme — Confident & Warm",
  tone: ["confident", "warm", "clear"],
  audience: "Busy DTC founders scaling past $1M/yr",
  readingLevel: "conversational",
  doList: ["active voice", "short sentences", "lead with the outcome"],
  avoidList: ["jargon", "hype", "empty superlatives"],
  powerWords: ["effortless", "proven", "ship"],
  forbiddenWords: ["cheap", "guaranteed", "revolutionary"],
  sample: "",
};

const DEFAULT_BRIEF: Brief = {
  product: "AI inventory forecasting for Shopify stores",
  audience: "Store owners who keep running out of best-sellers",
  goal: "signups",
  keyBenefits: ["never run out of stock", "cut carrying costs 20%"],
  proofPoints: ["used by 4,000 stores", "4.9 stars on the App Store"],
  cta: "Start free trial",
  keywords: ["inventory forecasting", "shopify"],
  constraints: "Mention the 14-day trial. No emojis.",
};

const COPY_TYPE_LIST = Object.values(COPY_TYPES);

export default function StudioPage() {
  const [brandVoice, setBrandVoice] = useState<BrandVoice>(DEFAULT_BRAND_VOICE);
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [copyType, setCopyType] = useState<CopyType>("meta_ad");
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCopyResponse | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/copy/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandVoice, brief, copyType, count }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      setResult((await res.json()) as GenerateCopyResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold text-white">
            AI Copywriting
          </span>
          <span className="text-xs text-slate-400">credit-based copy studio</span>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          Generate on-brand copy that converts
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Define your brand voice and brief, pick a format, and get scored variants across
          proven frameworks (AIDA, PAS, FAB, BAB, 4 Ps) — each with a critique and a
          brand-safety pass.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Inputs */}
        <div className="space-y-6">
          <BrandVoiceForm
            value={brandVoice}
            onChange={(patch) => setBrandVoice((v) => ({ ...v, ...patch }))}
          />
          <BriefForm value={brief} onChange={(patch) => setBrief((v) => ({ ...v, ...patch }))} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Format</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {COPY_TYPE_LIST.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setCopyType(ct.id)}
                  title={ct.description}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    copyType === ct.id
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">{COPY_TYPES[copyType].guidance}</p>

            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Variants
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="font-normal text-slate-400">≈ {count * 2} credits</span>
              </label>
              <button
                onClick={generate}
                disabled={loading || brief.product.trim().length === 0}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate copy"}
              </button>
            </div>
          </section>
        </div>

        {/* Results */}
        <div>
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">No variants yet</p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Fill in the brand voice and brief, choose a format, and hit generate. Works
                with zero API keys via a built-in mock engine.
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {result.variants.length} variants · {COPY_TYPES[result.meta.copyType].label}
                </span>
                <span>
                  {result.meta.usedAI ? `AI: ${result.meta.model}` : "Mock engine (no key)"}
                </span>
                <span>{result.meta.creditsUsed} credits used</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.variants.map((v, i) => (
                  <VariantCard key={v.id} variant={v} rank={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        AI Copywriting Studio · part of the Make-Money-with-AI portfolio
      </footer>
    </main>
  );
}
