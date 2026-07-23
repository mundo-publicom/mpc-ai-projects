import { NextResponse } from "next/server";
import {
  generateObject,
  hasAI,
  MODELS,
  buildGenerationSystem,
  buildCritiqueSystem,
  renderBrief,
  renderDraftsForCritique,
} from "@/lib/ai";
import {
  GenerateCopyRequestSchema,
  DraftListSchema,
  CritiqueListSchema,
  type GenerateCopyResponse,
  type Draft,
  type Variant,
} from "@/lib/types";
import { frameworkRotation } from "@/lib/frameworks";
import {
  buildMockVariants,
  heuristicCritique,
  reconcileCritique,
  makeVariantId,
} from "@/lib/mock";

// Node.js runtime (Fluid Compute on Vercel) — avoids edge-only limitations.
export const runtime = "nodejs";

/** Credits are metered per variant, with a surcharge for the critique pass. */
const CREDITS_PER_VARIANT = 2;

/**
 * POST /api/copy/generate
 *
 * Core value path: brand voice + brief + copy type + count → N typed copy
 * variants, each carrying a framework tag and a scored critique.
 *
 * Two-pass generation:
 *   1. generateObject → N framework-shaped drafts (the creative pass).
 *   2. generateObject → one critique per draft (the scoring pass), then every
 *      critique is reconciled against a deterministic heuristic so brand-safety
 *      and plagiarism checks never rely solely on the model.
 *
 * Falls back to a fully working deterministic mock when no API key is set.
 */
export async function POST(
  req: Request,
): Promise<NextResponse<GenerateCopyResponse | { error: string; details?: unknown }>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GenerateCopyRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { brandVoice, brief, copyType, count } = parsed.data;
  const generatedAt = new Date().toISOString();

  // --- Mock fallback: fully functional demo without any keys. ---
  if (!hasAI()) {
    const variants = buildMockVariants(brandVoice, brief, copyType, count);
    return NextResponse.json(mockResponse(variants, copyType, generatedAt));
  }

  const frameworks = frameworkRotation(copyType, count);

  try {
    // ---- Pass 1: generate drafts. ----
    const { object: draftObj } = await generateObject({
      model: MODELS.smart,
      schema: DraftListSchema,
      system: buildGenerationSystem(brandVoice, frameworks),
      prompt: [
        renderBrief(brief, copyType),
        "",
        `Produce exactly ${count} drafts, one per framework listed above, in that order.`,
      ].join("\n"),
      temperature: 0.8,
    });

    const drafts: Draft[] = draftObj.drafts.slice(0, count);
    if (drafts.length === 0) {
      const variants = buildMockVariants(brandVoice, brief, copyType, count);
      return NextResponse.json(mockResponse(variants, copyType, generatedAt), {
        headers: { "x-fallback-reason": "empty-generation" },
      });
    }

    // ---- Pass 2: critique / score drafts. ----
    let variants: Variant[];
    try {
      const { object: critObj } = await generateObject({
        model: MODELS.smart,
        schema: CritiqueListSchema,
        system: buildCritiqueSystem(brandVoice),
        prompt: [
          "Score the following drafts.",
          "",
          renderDraftsForCritique(drafts),
        ].join("\n"),
        temperature: 0.2,
      });

      variants = drafts.map((draft, i) => {
        const rule = heuristicCritique(draft, brandVoice, brief, copyType);
        const aiCritique = critObj.critiques[i];
        const critique = aiCritique ? reconcileCritique(aiCritique, rule) : rule;
        return {
          id: makeVariantId(copyType),
          copyType,
          framework: draft.framework,
          content: draft.content,
          critique,
        };
      });
    } catch {
      // Critique pass failed — score the real drafts heuristically instead.
      variants = drafts.map((draft) => ({
        id: makeVariantId(copyType),
        copyType,
        framework: draft.framework,
        content: draft.content,
        critique: heuristicCritique(draft, brandVoice, brief, copyType),
      }));
    }

    // Best score first — the recommended variant leads.
    variants.sort((a, b) => b.critique.overallScore - a.critique.overallScore);

    const response: GenerateCopyResponse = {
      variants,
      meta: {
        usedAI: true,
        model: MODELS.smart,
        creditsUsed: variants.length * CREDITS_PER_VARIANT,
        copyType,
        generatedAt,
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    // Never fail the request — degrade to the deterministic mock generator.
    const variants = buildMockVariants(brandVoice, brief, copyType, count);
    return NextResponse.json(mockResponse(variants, copyType, generatedAt), {
      headers: { "x-fallback-reason": err instanceof Error ? err.name : "unknown" },
    });
  }
}

function mockResponse(
  variants: Variant[],
  copyType: GenerateCopyResponse["meta"]["copyType"],
  generatedAt: string,
): GenerateCopyResponse {
  const sorted = [...variants].sort(
    (a, b) => b.critique.overallScore - a.critique.overallScore,
  );
  return {
    variants: sorted,
    meta: {
      usedAI: false,
      model: null,
      creditsUsed: sorted.length * CREDITS_PER_VARIANT,
      copyType,
      generatedAt,
    },
  };
}
