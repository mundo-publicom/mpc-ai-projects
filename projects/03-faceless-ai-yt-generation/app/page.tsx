"use client";

import { useEffect, useRef, useState } from "react";
import { TopicForm, type ScriptResult } from "@/components/TopicForm";
import { Storyboard } from "@/components/Storyboard";
import { JobList, type JobListHandle } from "@/components/JobList";
import type { GenerateScriptRequest } from "@/lib/types";

export default function StudioPage() {
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [lastReq, setLastReq] = useState<GenerateScriptRequest | null>(null);
  const [enqueuing, setEnqueuing] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const jobListRef = useRef<JobListHandle>(null);

  useEffect(() => {
    fetch("/api/generate/script")
      .then((r) => r.json())
      .then((d) => setAiEnabled(Boolean(d.aiEnabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  async function enqueue() {
    if (!result || !lastReq) return;
    setEnqueuing(true);
    try {
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: lastReq.topic,
          niche: lastReq.niche,
          aspectRatio: lastReq.aspectRatio,
          format: lastReq.format,
          targetLengthSec: lastReq.targetLengthSec,
          script: result.script,
        }),
      });
      jobListRef.current?.refresh();
    } finally {
      setEnqueuing(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-400">Faceless AI YouTube Studio</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Topic in. Finished video out.
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Script → storyboard → AI voiceover → captions → thumbnail → render.
          Run faceless channels at scale on a subscription + render-credit model.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <TopicForm
            aiEnabled={aiEnabled}
            onResult={(r, req) => {
              setResult(r);
              setLastReq(req);
            }}
          />
          <JobList ref={jobListRef} />
        </div>

        <div>
          {result ? (
            <Storyboard result={result} onEnqueue={enqueue} enqueuing={enqueuing} />
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center">
              <div>
                <p className="text-lg font-medium text-neutral-300">
                  Your storyboard preview appears here
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Enter a topic and generate to see scene-by-scene cards, thumbnail
                  concept and SEO metadata.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-12 border-t border-neutral-900 pt-6 text-xs text-neutral-600">
        Scaffold · Next.js App Router · AI SDK v5 · runs in mock mode with zero API keys.
      </footer>
    </main>
  );
}
