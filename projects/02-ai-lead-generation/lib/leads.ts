import { z } from "zod";
import { generateObject, hasAI, MODELS } from "./ai";
import { buildMockCandidates } from "./mock";
import { computeScore, prioritize, reconcileScore } from "./scoring";
import { ScoreSchema } from "./types";
import type { Icp, Lead } from "./types";

/** Credits charged per enriched+scored lead (mirrors the pricing model). */
export const CREDITS_PER_LEAD = 1;

/**
 * Schema the AI fills for every candidate. We ask the model only for the
 * judgement work — fit score, why-a-fit, and a personalized opener — while the
 * factual company/contact fields come from enrichment (mocked here).
 */
const AiLeadEnrichmentSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().describe("Echo back the candidate id verbatim."),
      score: ScoreSchema,
      whyAFit: z
        .string()
        .describe("One or two sentences on why this account matches the ICP."),
      suggestedOpener: z
        .string()
        .describe("A personalized first-touch outreach opener, 1-2 sentences, no greeting boilerplate."),
    }),
  ),
});

export interface GenerateResult {
  leads: Lead[];
  usedAI: boolean;
  model: string | null;
  creditsUsed: number;
}

const SYSTEM_PROMPT = `You are a B2B sales-intelligence analyst. Given an Ideal Customer Profile (ICP) and a list of enriched account/contact candidates, you:
1. Score each candidate 0-100 for fit against the ICP, with honest sub-scores (industryFit, sizeFit, titleFit, signalStrength) and a one-line reasoning.
2. Explain in plain language why the account is (or isn't) a fit.
3. Draft a crisp, specific first-touch outreach opener tailored to that account's context and the seller's value proposition.
Be concrete and reference real details from the candidate. Never invent contact facts (names, emails). Keep openers under 40 words, no "Hi {name}" boilerplate, no fake claims.`;

function buildPrompt(icp: Icp, candidates: ReturnType<typeof buildMockCandidates>): string {
  return [
    "ICP:",
    JSON.stringify(icp, null, 2),
    "",
    "CANDIDATES (score every one, echo its id):",
    JSON.stringify(
      candidates.map((c) => ({
        id: c.id,
        company: c.company,
        contact: { title: c.contact.title, fullName: c.contact.fullName },
      })),
      null,
      2,
    ),
  ].join("\n");
}

/**
 * Core value path: enrich candidates, score + write outreach with AI, and
 * prioritize. Falls back to deterministic scoring + templated openers when no
 * AI key is present so the demo always returns real, structured data.
 */
export async function generateLeads(icp: Icp, count: number): Promise<GenerateResult> {
  const candidates = buildMockCandidates(icp.targetTitles, count);
  const now = new Date().toISOString();

  if (!hasAI()) {
    const leads = candidates.map<Lead>((c) => {
      const score = computeScore(icp, c);
      return {
        ...c,
        score,
        whyAFit: mockWhyAFit(icp, c, score.value),
        suggestedOpener: mockOpener(icp, c),
        createdAt: now,
      };
    });
    return {
      leads: prioritize(leads),
      usedAI: false,
      model: null,
      creditsUsed: leads.length * CREDITS_PER_LEAD,
    };
  }

  try {
    const { object } = await generateObject({
      model: MODELS.smart,
      schema: AiLeadEnrichmentSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(icp, candidates),
      temperature: 0.4,
    });

    const byId = new Map(object.results.map((r) => [r.id, r]));
    const leads = candidates.map<Lead>((c) => {
      const ai = byId.get(c.id);
      const ruleScore = computeScore(icp, c);
      const score = ai ? reconcileScore(ai.score, ruleScore) : ruleScore;
      return {
        ...c,
        score,
        whyAFit: ai?.whyAFit ?? mockWhyAFit(icp, c, score.value),
        suggestedOpener: ai?.suggestedOpener ?? mockOpener(icp, c),
        createdAt: now,
      };
    });

    return {
      leads: prioritize(leads),
      usedAI: true,
      model: MODELS.smart,
      creditsUsed: leads.length * CREDITS_PER_LEAD,
    };
  } catch (err) {
    // Never fail the request on a model hiccup — degrade to deterministic path.
    console.error("[leads] AI generation failed, using deterministic fallback:", err);
    const leads = candidates.map<Lead>((c) => {
      const score = computeScore(icp, c);
      return {
        ...c,
        score,
        whyAFit: mockWhyAFit(icp, c, score.value),
        suggestedOpener: mockOpener(icp, c),
        createdAt: now,
      };
    });
    return {
      leads: prioritize(leads),
      usedAI: false,
      model: null,
      creditsUsed: leads.length * CREDITS_PER_LEAD,
    };
  }
}

/* ------------------------------ mock copy -------------------------------- */

function mockWhyAFit(
  icp: Icp,
  c: ReturnType<typeof buildMockCandidates>[number],
  value: number,
): string {
  const bits: string[] = [];
  if (icp.industries.some((i) => c.company.industry.toLowerCase().includes(i.toLowerCase()))) {
    bits.push(`operates in ${c.company.industry}`);
  } else {
    bits.push(`in ${c.company.industry}`);
  }
  bits.push(`a ${c.company.size}-person company in ${c.company.region}`);
  if (icp.targetTitles.some((t) => c.contact.title.toLowerCase().includes(t.toLowerCase().split(" ")[0]))) {
    bits.push(`and your buyer persona (${c.contact.title}) is reachable`);
  }
  return `Scores ${value}/100: ${bits.join(", ")}.`;
}

function mockOpener(
  icp: Icp,
  c: ReturnType<typeof buildMockCandidates>[number],
): string {
  const value = icp.valueProposition.trim() || "help teams like yours hit pipeline targets faster";
  const hook = c.company.description.split(";")[1]?.trim() || c.company.description.split(".")[0];
  return `Noticed ${c.company.name} ${hook ? `is ${hook}` : "is scaling"} — we ${value}. Worth a quick look at how similar ${c.company.industry} teams are doing it?`;
}
