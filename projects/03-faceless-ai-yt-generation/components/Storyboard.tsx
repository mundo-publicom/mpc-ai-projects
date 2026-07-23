"use client";

import type { Scene, Script } from "@/lib/types";
import type { ScriptResult } from "./TopicForm";

const BROLL_LABEL: Record<Scene["broll"], string> = {
  "ai-image": "AI image",
  "stock-video": "Stock video",
  "motion-graphic": "Motion graphic",
  "screen-capture": "Screen capture",
};

export function Storyboard({
  result,
  onEnqueue,
  enqueuing,
}: {
  result: ScriptResult;
  onEnqueue: () => void;
  enqueuing: boolean;
}) {
  const { script, meta } = result;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Video title</p>
          <h2 className="text-xl font-bold">{script.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            <span className="font-medium text-brand-400">Hook:</span> {script.hook}
          </p>
        </div>
        <button
          onClick={onEnqueue}
          disabled={enqueuing}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
        >
          {enqueuing ? "Queuing…" : "Enqueue render"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <Stat label="Scenes" value={String(meta.sceneCount)} />
        <Stat label="Est. length" value={`${meta.estimatedDurationSec}s`} />
        <Stat label="Est. credits" value={String(meta.estimatedCredits)} />
        <Stat label="Source" value={meta.usedAI ? "AI" : "Mock"} />
      </div>

      {/* Scene cards rail */}
      <div className="scroll-rail flex gap-4 overflow-x-auto pb-3">
        {script.scenes.map((scene) => (
          <SceneCard key={scene.index} scene={scene} />
        ))}
      </div>

      {/* Thumbnail + CTA + SEO */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Thumbnail concept
          </p>
          <div className="mb-2 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-neutral-900 p-4">
            <span className="text-center text-lg font-black uppercase leading-tight text-white drop-shadow">
              {script.thumbnailConcept.overlayText}
            </span>
          </div>
          <p className="text-sm text-neutral-400">{script.thumbnailConcept.visual}</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Call to action
          </p>
          <p className="mb-4 text-sm text-neutral-300">{script.callToAction}</p>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {script.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
          {scene.index}
        </span>
        <span className="text-xs text-neutral-500">{scene.durationSec}s</span>
      </div>
      <h3 className="mb-2 text-sm font-semibold">{scene.title}</h3>

      {/* Visual placeholder framed by the prompt */}
      <div className="mb-3 flex aspect-video items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900 p-2 text-center">
        <span className="text-[11px] leading-snug text-neutral-500">
          {scene.visualPrompt}
        </span>
      </div>

      <p className="mb-3 flex-1 text-sm text-neutral-300">{scene.narration}</p>

      <div className="mt-auto flex items-center justify-between gap-2">
        {scene.onScreenText && (
          <span className="truncate rounded bg-yellow-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-yellow-300">
            {scene.onScreenText}
          </span>
        )}
        <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
          {BROLL_LABEL[scene.broll]}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-semibold text-neutral-200">{value}</span>
    </span>
  );
}
