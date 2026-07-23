import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GenerateScriptRequestSchema } from "@/lib/types";
import { generateScript, estimateCreditsFromScript } from "@/lib/pipeline";
import { hasAI } from "@/lib/ai";

// Node.js runtime: script generation may be followed by media SDK calls.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate/script
 * Turn a topic + niche into a full structured storyboard (title, hook, scenes,
 * SEO metadata, thumbnail concept) via `generateObject`. Falls back to mock
 * data when no AI key is configured.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = GenerateScriptRequestSchema.parse(body);
    const { script, usedAI } = await generateScript(input);

    return NextResponse.json({
      script,
      meta: {
        usedAI,
        mock: !usedAI,
        sceneCount: script.scenes.length,
        estimatedDurationSec: script.scenes.reduce((s, sc) => s + sc.durationSec, 0),
        estimatedCredits: estimateCreditsFromScript(script),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten() },
        { status: 422 },
      );
    }
    console.error("script generation failed:", err);
    return NextResponse.json(
      { error: "Script generation failed. Check AI_GATEWAY_API_KEY or try again." },
      { status: 500 },
    );
  }
}

/** GET /api/generate/script — capability probe for the UI. */
export function GET() {
  return NextResponse.json({ aiEnabled: hasAI() });
}
