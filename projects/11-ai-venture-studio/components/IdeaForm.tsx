"use client";

import { useState } from "react";
import type { ValidateRequest } from "@/lib/types";

interface IdeaFormProps {
  onSubmit: (input: ValidateRequest) => void;
  loading: boolean;
}

const EXAMPLES: ValidateRequest[] = [
  {
    title: "ShiftMate",
    description:
      "An AI scheduling copilot for independent restaurants that builds fair weekly staff rotas from availability, labor rules, and forecasted demand, then handles shift swaps over SMS.",
    market: "Independent restaurants, US",
    businessModel: "Per-location SaaS subscription",
  },
  {
    title: "LedgerLens",
    description:
      "A tool that ingests a freelancer's bank and invoicing data and auto-drafts quarterly tax estimates, flagging deductions and setting money aside automatically.",
    market: "US freelancers & solopreneurs",
    businessModel: "Freemium + paid filing",
  },
];

export function IdeaForm({ onSubmit, loading }: IdeaFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [market, setMarket] = useState("");
  const [businessModel, setBusinessModel] = useState("");

  const valid = title.trim().length > 0 && description.trim().length >= 20;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      market: market.trim() || undefined,
      businessModel: businessModel.trim() || undefined,
    });
  }

  function loadExample(ex: ValidateRequest) {
    setTitle(ex.title);
    setDescription(ex.description);
    setMarket(ex.market ?? "");
    setBusinessModel(ex.businessModel ?? "");
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">Capture an idea</h2>
      <p className="mt-1 text-sm text-slate-500">
        Describe the venture. The studio runs a full AI validation sprint in one pass.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            Venture name
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. ShiftMate"
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Idea description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is the product, who is it for, and what problem does it solve?"
            rows={5}
            maxLength={6000}
            className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <p className="mt-1 text-xs text-slate-400">
            {description.trim().length}/20 characters minimum
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="market" className="block text-sm font-medium text-slate-700">
              Target market <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="market"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. SMB dentists, US"
              maxLength={400}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-slate-700">
              Business model <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="model"
              value={businessModel}
              onChange={(e) => setBusinessModel(e.target.value)}
              placeholder="e.g. SaaS subscription"
              maxLength={400}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!valid || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Running sprint…
            </>
          ) : (
            "Run validation sprint"
          )}
        </button>

        <span className="text-xs text-slate-400">or try an example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => loadExample(ex)}
            disabled={loading}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
          >
            {ex.title}
          </button>
        ))}
      </div>
    </form>
  );
}
