"use client";

import { useState } from "react";
import type { GenerateScriptRequest, Script } from "@/lib/types";

export interface ScriptResult {
  script: Script;
  meta: {
    usedAI: boolean;
    mock: boolean;
    sceneCount: number;
    estimatedDurationSec: number;
    estimatedCredits: number;
  };
}

const NICHES: GenerateScriptRequest["niche"][] = [
  "education",
  "finance",
  "motivation",
  "tech",
  "history",
  "health",
  "entertainment",
  "true-crime",
];

export function TopicForm({
  onResult,
  aiEnabled,
}: {
  onResult: (r: ScriptResult, req: GenerateScriptRequest) => void;
  aiEnabled: boolean | null;
}) {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState<GenerateScriptRequest["niche"]>("education");
  const [format, setFormat] = useState<GenerateScriptRequest["format"]>("long-form");
  const [aspectRatio, setAspectRatio] =
    useState<GenerateScriptRequest["aspectRatio"]>("16:9");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const req: GenerateScriptRequest = {
      topic,
      niche,
      format,
      aspectRatio,
      targetLengthSec: format === "short" ? 45 : 180,
    };

    try {
      const res = await fetch("/api/generate/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onResult(data as ScriptResult, req);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">New video</h2>
        {aiEnabled !== null && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              aiEnabled
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {aiEnabled ? "AI live" : "Mock mode"}
          </span>
        )}
      </div>

      <label className="mb-1 block text-sm text-neutral-400">Topic / idea</label>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Why the Roman concrete recipe was lost for 1500 years"
        className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        required
        minLength={3}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Niche</label>
          <select
            value={niche}
            onChange={(e) =>
              setNiche(e.target.value as GenerateScriptRequest["niche"])
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm capitalize outline-none focus:border-brand-500"
          >
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Format</label>
          <select
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as GenerateScriptRequest["format"])
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="long-form">Long-form (~3 min)</option>
            <option value="short">Short (~45s vertical)</option>
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-1 block text-sm text-neutral-400">Aspect ratio</label>
        <div className="flex gap-2">
          {(["16:9", "9:16", "1:1"] as const).map((ar) => (
            <button
              key={ar}
              type="button"
              onClick={() => setAspectRatio(ar)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                aspectRatio === ar
                  ? "border-brand-500 bg-brand-500/10 text-brand-300"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {ar}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || topic.trim().length < 3}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating storyboard…" : "Generate storyboard"}
      </button>
    </form>
  );
}
