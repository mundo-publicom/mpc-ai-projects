import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CreateJobRequestSchema, type VideoJob } from "@/lib/types";
import {
  DEFAULT_VOICE,
  estimateCreditsFromParams,
  estimateCreditsFromScript,
  generateScript,
  initialStages,
} from "@/lib/pipeline";
import { listJobs, putJob } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/jobs — list all video jobs with live per-stage pipeline status.
 */
export function GET() {
  const jobs = listJobs();
  return NextResponse.json({
    jobs,
    summary: {
      total: jobs.length,
      completed: jobs.filter((j) => j.status === "completed").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      creditsConsumed: jobs.reduce((s, j) => s + j.consumedCredits, 0),
    },
  });
}

/**
 * POST /api/jobs — enqueue a new video render job.
 * Accepts an optional pre-generated `script` (from the studio preview). When
 * absent, the script stage is generated inline so the job starts fully seeded.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = CreateJobRequestSchema.parse(body);

    // Seed the script: use the supplied one, or generate/mock it now.
    let script = input.script;
    if (!script) {
      const generated = await generateScript({
        topic: input.topic,
        niche: input.niche,
        targetLengthSec: input.targetLengthSec,
        aspectRatio: input.aspectRatio,
        format: input.format,
      });
      script = generated.script;
    }

    const now = new Date().toISOString();
    const estimatedCredits = script
      ? estimateCreditsFromScript(script)
      : estimateCreditsFromParams(input);

    const job: VideoJob = {
      id: crypto.randomUUID(),
      projectId: input.projectId ?? "default",
      topic: input.topic,
      niche: input.niche,
      aspectRatio: input.aspectRatio,
      format: input.format,
      status: "queued",
      stages: initialStages(Boolean(script)),
      script,
      voiceProfileId: input.voiceProfileId ?? DEFAULT_VOICE.id,
      assets: [],
      estimatedCredits,
      consumedCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    putJob(job);
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten() },
        { status: 422 },
      );
    }
    console.error("job creation failed:", err);
    return NextResponse.json({ error: "Could not create job." }, { status: 500 });
  }
}
