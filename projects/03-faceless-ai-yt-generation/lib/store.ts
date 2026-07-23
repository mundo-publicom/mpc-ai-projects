import { PIPELINE_STAGES, type VideoJob } from "@/lib/types";
import { stageMessage } from "@/lib/pipeline";

/**
 * Tiny in-memory job store for the scaffold. In production this is Postgres +
 * a Redis-backed queue (see TECHNICAL_SPEC.md). We simulate a background worker
 * by advancing each job's stages on a wall-clock schedule, so the studio's job
 * list shows realistic per-stage progress without any infrastructure.
 *
 * A module-level singleton survives across requests within a running dev server
 * (guarded on globalThis so Next.js hot-reload does not reset it).
 */

interface Store {
  jobs: Map<string, VideoJob>;
}

const g = globalThis as unknown as { __facelessStore?: Store };
const store: Store = g.__facelessStore ?? { jobs: new Map() };
g.__facelessStore = store;

/** Seconds of simulated wall-clock time each stage takes to "process". */
const STAGE_DURATION_SEC: Record<string, number> = {
  script: 4,
  voiceover: 8,
  visuals: 12,
  captions: 4,
  thumbnail: 5,
  assembly: 10,
  publish: 3,
};

export function putJob(job: VideoJob): void {
  store.jobs.set(job.id, job);
}

export function getJob(id: string): VideoJob | undefined {
  const job = store.jobs.get(id);
  if (job) advance(job);
  return job;
}

export function listJobs(): VideoJob[] {
  const jobs = [...store.jobs.values()];
  jobs.forEach(advance);
  return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Lazily fast-forward a job's simulated pipeline based on how much time has
 * elapsed since it was created. Pure function of wall-clock time, so repeated
 * reads are idempotent and consistent.
 */
function advance(job: VideoJob): void {
  if (job.status === "completed" || job.status === "failed" || job.status === "canceled") {
    return;
  }

  const elapsedSec = (Date.now() - new Date(job.createdAt).getTime()) / 1000;

  // The script stage may already be done at creation (pre-generated storyboard).
  const scriptPreDone = job.stages[0]?.state === "done";
  let cursor = 0;

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const stage = job.stages[i];
    const dur = STAGE_DURATION_SEC[stage.stage] ?? 6;

    // Skip script duration if it was already generated before enqueue.
    const effectiveDur = i === 0 && scriptPreDone ? 0 : dur;
    const stageStart = cursor;
    const stageEnd = cursor + effectiveDur;
    cursor = stageEnd;

    if (elapsedSec >= stageEnd) {
      stage.state = "done";
      stage.progress = 100;
      stage.message = undefined;
      stage.finishedAt ??= new Date(
        new Date(job.createdAt).getTime() + stageEnd * 1000,
      ).toISOString();
    } else if (elapsedSec >= stageStart) {
      stage.state = "running";
      stage.progress =
        effectiveDur === 0
          ? 100
          : Math.min(99, Math.round(((elapsedSec - stageStart) / effectiveDur) * 100));
      stage.message = stageMessage(stage.stage);
      stage.startedAt ??= new Date().toISOString();
    } else {
      stage.state = "pending";
      stage.progress = 0;
    }
  }

  const allDone = job.stages.every((s) => s.state === "done");
  job.status = allDone ? "completed" : "processing";
  if (allDone && !job.youtubeVideoId) {
    job.youtubeVideoId = "yt_" + job.id.slice(0, 8);
    job.consumedCredits = job.estimatedCredits;
  } else {
    // Consumed credits scale with completed stages.
    const doneCount = job.stages.filter((s) => s.state === "done").length;
    job.consumedCredits = Math.round(
      (doneCount / job.stages.length) * job.estimatedCredits,
    );
  }
  job.updatedAt = new Date().toISOString();
}
