import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  RepurposeRequestSchema,
  RepurposeResultSchema,
  type RepurposeResult,
} from "@/lib/types";
import { DEFAULT_FORMATS } from "@/lib/formats";
import {
  countWords,
  extractBrandVoice,
  generateOutputs,
  hasAI,
  MODELS,
} from "@/lib/ai";

// Node.js runtime (Fluid Compute) — large payloads + AI SDK, not edge-only.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/repurpose
 *
 * Body: RepurposeRequest (see lib/types).
 * Returns: RepurposeResult — a typed array of platform-native assets.
 *
 * Pipeline: validate → analyze brand voice → fan-out generate → measure/validate.
 * Degrades gracefully to deterministic mock content when no API key is present.
 */
export async function POST(req: Request) {
  const started = Date.now();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RepurposeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { source, kind, title, formats, brandVoice } = parsed.data;
  const selected = formats?.length ? formats : DEFAULT_FORMATS;

  try {
    // Step 1 — brand voice (supplied override wins; else extracted from source).
    const voice = await extractBrandVoice(source, brandVoice);

    // Step 2 — fan-out generation.
    const outputs = await generateOutputs(source, voice, selected);

    const result: RepurposeResult = {
      jobId: randomUUID(),
      status: "completed",
      usedAI: hasAI(),
      model: hasAI() ? MODELS.smart : undefined,
      brandVoice: voice,
      source: {
        kind: kind ?? "blog_post",
        wordCount: countWords(source),
        title,
      },
      outputs,
      elapsedMs: Date.now() - started,
      createdAt: new Date().toISOString(),
    };

    // Validate our own response shape before returning (contract guarantee).
    return NextResponse.json(RepurposeResultSchema.parse(result), { status: 200 });
  } catch (err) {
    console.error("[repurpose] generation failed:", err);
    return NextResponse.json(
      {
        error: "Generation failed.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/** Lightweight capability probe for the UI. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    aiEnabled: hasAI(),
    defaultFormats: DEFAULT_FORMATS,
  });
}
