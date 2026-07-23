"use client";

import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from "react";
import type { StageState, VideoJob } from "@/lib/types";

interface JobsResponse {
  jobs: VideoJob[];
  summary: {
    total: number;
    completed: number;
    processing: number;
    creditsConsumed: number;
  };
}

export interface JobListHandle {
  refresh: () => void;
}

const STAGE_DOT: Record<StageState, string> = {
  pending: "bg-neutral-700",
  running: "bg-brand-500 animate-pulse",
  done: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-neutral-600",
};

const STATUS_BADGE: Record<VideoJob["status"], string> = {
  queued: "bg-neutral-500/15 text-neutral-300",
  processing: "bg-brand-500/15 text-brand-300",
  completed: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  canceled: "bg-neutral-500/15 text-neutral-400",
};

export const JobList = forwardRef<JobListHandle>(function JobList(_props, ref) {
  const [data, setData] = useState<JobsResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* transient — next poll retries */
    }
  }, []);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  useEffect(() => {
    load();
    // Poll so simulated pipeline progress animates in the UI.
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const jobs = data?.jobs ?? [];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Render queue</h2>
        {data && (
          <span className="text-xs text-neutral-500">
            {data.summary.completed}/{data.summary.total} done ·{" "}
            {data.summary.creditsConsumed} credits used
          </span>
        )}
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 py-10 text-center text-sm text-neutral-500">
          No jobs yet. Generate a storyboard and enqueue a render.
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {job.script?.title ?? job.topic}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {job.niche} · {job.format} · {job.aspectRatio} ·{" "}
                    {job.consumedCredits}/{job.estimatedCredits} credits
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    STATUS_BADGE[job.status]
                  }`}
                >
                  {job.status}
                </span>
              </div>

              {/* Per-stage pipeline strip */}
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {job.stages.map((s) => (
                  <div key={s.stage} className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${STAGE_DOT[s.state]}`}
                      title={s.message ?? s.state}
                    />
                    <span
                      className={`text-xs capitalize ${
                        s.state === "done"
                          ? "text-neutral-400"
                          : s.state === "running"
                            ? "text-brand-300"
                            : "text-neutral-600"
                      }`}
                    >
                      {s.stage}
                      {s.state === "running" ? ` ${s.progress}%` : ""}
                    </span>
                  </div>
                ))}
              </div>

              {job.youtubeVideoId && (
                <p className="mt-3 text-xs text-emerald-400">
                  Published (unlisted) · {job.youtubeVideoId}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
