"use client";

import { useState } from "react";
import { SourceInput } from "@/components/SourceInput";
import { FormatPicker } from "@/components/FormatPicker";
import { OutputCard } from "@/components/OutputCard";
import { FORMAT_LIST, DEFAULT_FORMATS } from "@/lib/formats";
import type { FormatId, RepurposeResult, SourceKind } from "@/lib/types";

const SAMPLE = `The biggest mistake new creators make is treating every platform the same. They write one post, blast it everywhere, and wonder why it flops.

Here's the thing: each platform rewards a different behavior. X rewards a sharp hook and a punchy thread. LinkedIn rewards a personal story with a lesson. TikTok rewards a three-second pattern interrupt. Treating them identically is like speaking English slowly and loudly to someone who speaks French.

The fix isn't to work harder — it's to repurpose smarter. Take one strong idea, then translate it into the native language of each platform. Same message, different delivery. That's how a single blog post becomes a week of content without burning you out.

Start with your best long-form asset. Pull out the one insight that made it worth reading. Then ask, for each platform: what would make someone stop scrolling here? Answer that, and you'll never run out of content again.`;

export default function Page() {
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<SourceKind>("blog_post");
  const [selected, setSelected] = useState<FormatId[]>(DEFAULT_FORMATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepurposeResult | null>(null);

  const canRun = source.trim().length >= 30 && selected.length > 0 && !loading;

  function toggle(id: FormatId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, kind, formats: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setResult(null);
      } else {
        setResult(data as RepurposeResult);
      }
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-10">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-brand-400">
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5">Content Repurposing</span>
          <span className="text-slate-600">Make Money with AI · Project 04</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          One asset in. 20+ platform-native pieces out.
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Paste a blog post, YouTube transcript, or podcast episode. We extract your brand voice and
          fan it out into X threads, LinkedIn posts, IG captions, TikTok scripts, newsletters, quote
          cards, and SEO meta — all native, all in your voice.
        </p>
      </header>

      {/* Workspace */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <SourceInput
            value={source}
            onChange={setSource}
            kind={kind}
            onKindChange={setKind}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setSource(SAMPLE)}
            disabled={loading}
            className="self-start text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50"
          >
            ↳ Load sample content
          </button>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <FormatPicker
            selected={selected}
            onToggle={toggle}
            onSelectAll={() => setSelected(FORMAT_LIST.map((f) => f.id))}
            onClear={() => setSelected([])}
            disabled={loading}
          />
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="mt-auto rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading
              ? "Repurposing…"
              : `Repurpose into ${selected.length} format${selected.length === 1 ? "" : "s"}`}
          </button>
          {error && <p className="text-xs text-amber-400">{error}</p>}
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-300">
              {result.outputs.length} assets generated
            </span>
            <span>{result.source.wordCount.toLocaleString()} source words</span>
            <span>{(result.elapsedMs / 1000).toFixed(1)}s</span>
            <span
              className={
                result.usedAI ? "text-brand-400" : "text-amber-400"
              }
            >
              {result.usedAI ? `Live · ${result.model}` : "Mock mode (no API key)"}
            </span>
            {result.brandVoice.tone.length > 0 && (
              <span>Voice: {result.brandVoice.tone.join(", ")}</span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.outputs.map((o) => (
              <OutputCard key={o.format} output={o} />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto border-t border-slate-800 pt-4 text-xs text-slate-600">
        Tiered SaaS by monthly output volume · Solo · Marketer · Agency. See docs/PRD.md.
      </footer>
    </main>
  );
}
