"use client";

import { useState } from "react";
import type { Brief, BrandKit, GenerateBrandResponse } from "@/lib/types";
import { BriefForm } from "@/components/BriefForm";
import { LogoConcepts } from "@/components/LogoConcepts";
import { PaletteSwatches } from "@/components/PaletteSwatches";
import { TypeSpecimen } from "@/components/TypeSpecimen";
import { buildBrandGuideHtml } from "@/lib/guide";

export default function StudioPage() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(brief: Brief) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(brief),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as GenerateBrandResponse;
      setKit(data.kit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function downloadGuide() {
    if (!kit) return;
    const html = buildBrandGuideHtml(kit);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kit.brief.name.replace(/\s+/g, "-").toLowerCase()}-brand-guide.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const bg =
    kit?.palette.colors.find((c) => c.role === "background")?.hex ?? "#ffffff";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          AI Logo &amp; Brand Design Studio
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          From brief to brand kit in seconds
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Describe your brand and get logo concepts (real SVG), a color palette
          with accessibility checks, a typography pairing, brand voice, and a
          downloadable brand guide.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BriefForm onSubmit={generate} loading={loading} />
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="min-w-0">
          {!kit && !loading && (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-400 dark:border-slate-700">
              Your generated brand kit will appear here.
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 text-sm text-slate-500 dark:border-slate-800">
              Designing logos, palette, and voice…
            </div>
          )}

          {kit && !loading && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      kit.mocked
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {kit.mocked ? "Mock (no API key)" : "AI-generated"}
                  </span>
                  <span className="text-slate-400">
                    {kit.latencyMs} ms
                  </span>
                </div>
                <button
                  onClick={downloadGuide}
                  className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  Download brand guide
                </button>
              </div>

              <Section title="Logo concepts">
                <LogoConcepts concepts={kit.concepts} background={bg} />
              </Section>

              <Section title="Color palette">
                <PaletteSwatches palette={kit.palette} />
              </Section>

              <Section title="Typography">
                <TypeSpecimen
                  typography={kit.typography}
                  sampleHeadline={kit.voice.sampleHeadline}
                  sampleBody={kit.voice.sampleBody}
                />
              </Section>

              <Section title="Brand voice">
                <VoicePanel kit={kit} />
              </Section>

              <Section title="Usage rules">
                <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {kit.usageRules.map((rule, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-brand-500">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function VoicePanel({ kit }: { kit: BrandKit }) {
  const { voice } = kit;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          {voice.archetype}
        </span>
        {voice.tone.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        “{voice.tagline}”
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {voice.elevatorPitch}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Do
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {voice.dos.map((d, i) => (
              <li key={i}>+ {d}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            Don&apos;t
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {voice.donts.map((d, i) => (
              <li key={i}>– {d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
