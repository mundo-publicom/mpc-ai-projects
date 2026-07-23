import { generateText, generateObject } from "ai";
import { z } from "zod";
import type { ValidateRequest, ValidationReport } from "./types";

// Re-export the SDK primitives so routes import them from one place.
export { generateText, generateObject };

/**
 * Model catalog. All calls route through the Vercel AI Gateway via plain
 * "provider/model" strings — no provider SDK is wired directly.
 */
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * True when a gateway/provider key is present. When false, the /api/validate
 * route serves a realistic mock report so the studio runs with zero config.
 */
export const hasAI = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/* ------------------------------------------------------------------ */
/* Structured output schema (zod → generateObject)                     */
/* ------------------------------------------------------------------ */

const marketSizeSchema = z.object({
  valueUsd: z.number().describe("Market size in raw USD, e.g. 4200000000."),
  display: z.string().describe('Human rendering, e.g. "$4.2B".'),
  basis: z.string().describe("How the number was derived (top-down/bottom-up)."),
});

const marketSchema = z.object({
  tam: marketSizeSchema,
  sam: marketSizeSchema,
  som: marketSizeSchema,
  cagr: z.number().min(0).max(1).describe("Annual growth rate 0..1 (0.18 = 18%)."),
  assumptions: z.array(z.string()).min(2).max(6),
  tailwinds: z.array(z.string()).min(1).max(5),
  summary: z.string(),
});

const competitorSchema = z.object({
  name: z.string(),
  type: z.enum(["direct", "indirect", "substitute"]),
  description: z.string(),
  strengths: z.array(z.string()).min(1).max(4),
  weaknesses: z.array(z.string()).min(1).max(4),
  pricePosition: z.enum(["low", "mid", "premium", "unknown"]),
});

const segmentSchema = z.object({
  name: z.string(),
  painLevel: z.enum(["low", "medium", "high", "acute"]),
  description: z.string(),
  willingnessToPay: z.string(),
});

const canvasSchema = z.object({
  problem: z.array(z.string()).min(1).max(3),
  customerSegments: z.array(z.string()).min(1).max(4),
  uniqueValueProposition: z.string(),
  solution: z.array(z.string()).min(1).max(3),
  channels: z.array(z.string()).min(1).max(5),
  revenueStreams: z.array(z.string()).min(1).max(4),
  costStructure: z.array(z.string()).min(1).max(5),
  keyMetrics: z.array(z.string()).min(1).max(5),
  unfairAdvantage: z.string(),
});

const mvpFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.enum(["must", "should", "could", "wont"]),
  effortDays: z.number().min(0.5).max(60),
  userStory: z.string().describe('As a <user>, I want <goal>, so that <benefit>.'),
});

const mvpSchema = z.object({
  goal: z.string(),
  riskiestAssumption: z.string(),
  features: z.array(mvpFeatureSchema).min(3).max(10),
  successMetrics: z.array(z.string()).min(1).max(5),
  buildEstimateWeeks: z.number().min(1).max(52),
});

const riskSchema = z.object({
  category: z.enum([
    "market",
    "technical",
    "financial",
    "regulatory",
    "team",
    "competitive",
  ]),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string(),
});

const landingSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  valueBullets: z.array(z.string()).min(3).max(5),
  primaryCta: z.string(),
});

/**
 * The full validation-report schema handed to generateObject. Everything the
 * pipeline produces in a single structured generation call.
 */
export const validationSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall venture-viability score."),
  verdict: z.string().describe("One-line verdict."),
  recommendation: z.enum(["pursue", "investigate", "pivot", "pass"]),
  market: marketSchema,
  competitors: z.array(competitorSchema).min(2).max(6),
  segments: z.array(segmentSchema).min(1).max(4),
  canvas: canvasSchema,
  mvp: mvpSchema,
  risks: z.array(riskSchema).min(2).max(6),
  landing: landingSchema,
});

export type GeneratedValidation = z.infer<typeof validationSchema>;

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

export const VALIDATION_SYSTEM_PROMPT = [
  "You are the lead analyst of an AI venture studio that runs rigorous, fast",
  "idea-to-MVP validation sprints. You are skeptical, quantitative, and honest —",
  "your job is to protect the studio's time and capital, not to cheerlead.",
  "",
  "For the given startup idea, produce a complete validation report:",
  "1. MARKET: TAM/SAM/SOM with explicit, scrutinizable assumptions. Prefer",
  "   defensible bottom-up sizing. Never invent precise figures you cannot",
  "   justify — state the basis for each number.",
  "2. COMPETITORS: a realistic landscape (direct, indirect, substitutes) with",
  "   concrete strengths/weaknesses and price positioning.",
  "3. SEGMENTS: who feels the pain most acutely and what they would pay.",
  "4. LEAN CANVAS: all nine blocks, concrete and specific to this idea.",
  "5. MVP SPEC: the smallest build that tests the riskiest assumption, with",
  "   MoSCoW-prioritized features and honest engineer-day effort estimates.",
  "6. RISKS: the real ones (market/technical/financial/regulatory/team/",
  "   competitive) with severity and a concrete mitigation each.",
  "7. LANDING COPY: a crisp headline, subheadline, value bullets, and CTA.",
  "",
  "SCORING: 0–100 overall viability. Be discriminating — most ideas should land",
  "40–70. Reserve 80+ for ideas with a large growing market, a sharp wedge, and",
  "a credible unfair advantage. Map the recommendation honestly to the score:",
  "pursue (>=75), investigate (55–74), pivot (35–54), pass (<35).",
].join("\n");

/** Builds the per-idea user prompt. */
export function buildValidationPrompt(input: ValidateRequest): string {
  return [
    `IDEA TITLE: ${input.title}`,
    ``,
    `DESCRIPTION:`,
    input.description.trim(),
    ``,
    input.market ? `TARGET MARKET HINT: ${input.market}` : "",
    input.businessModel ? `BUSINESS MODEL HINT: ${input.businessModel}` : "",
    ``,
    `Produce the full structured validation report now.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Mock fallback (no API key present)                                  */
/* ------------------------------------------------------------------ */

/** Small deterministic hash so mock output varies with the idea text. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const money = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};

/**
 * Deterministic, idea-aware mock report so the product is fully demoable with
 * zero keys. Numbers are seeded from the idea text to feel plausible and stable
 * across reloads.
 */
export function mockValidation(input: ValidateRequest): GeneratedValidation {
  const seed = hash(input.title + input.description);
  const tam = 1.5e9 + (seed % 60) * 1e8; // $1.5B–$7.5B
  const sam = tam * 0.28;
  const som = sam * 0.06;
  const score = 42 + (seed % 43); // 42–84
  const recommendation: GeneratedValidation["recommendation"] =
    score >= 75 ? "pursue" : score >= 55 ? "investigate" : score >= 35 ? "pivot" : "pass";
  const label = input.title.trim() || "the venture";

  return {
    score,
    verdict:
      score >= 70
        ? "Promising — a focused validation sprint is warranted."
        : score >= 50
          ? "Mixed signal — validate the riskiest assumptions before committing."
          : "Weak as framed — consider a pivot on segment or wedge.",
    recommendation,
    market: {
      tam: { valueUsd: Math.round(tam), display: money(tam), basis: "Top-down: category spend × addressable share." },
      sam: { valueUsd: Math.round(sam), display: money(sam), basis: "Segments reachable via planned channels in target geos." },
      som: { valueUsd: Math.round(som), display: money(som), basis: "Realistic 3-year capture given CAC and sales motion." },
      cagr: 0.12 + (seed % 15) / 100, // 12–26%
      assumptions: [
        "Buyers currently solve this with manual work or spreadsheets.",
        "Average contract value supports a self-serve + assisted motion.",
        "No dominant incumbent owns the specific wedge described.",
      ],
      tailwinds: [
        "AI lowers the cost of the core workflow by an order of magnitude.",
        "Category budgets are shifting from services to software.",
      ],
      summary: `The market for ${label} looks sizeable and growing; the open question is whether the wedge is sharp enough to win a beachhead segment before incumbents react.`,
    },
    competitors: [
      {
        name: "Incumbent Suite Co.",
        type: "direct",
        description: "Established platform serving the broad category.",
        strengths: ["Brand trust", "Large install base", "Full feature breadth"],
        weaknesses: ["Slow to ship", "Expensive", "Generic, not workflow-specific"],
        pricePosition: "premium",
      },
      {
        name: "Point Tool Startup",
        type: "direct",
        description: "Venture-backed newcomer attacking an adjacent slice.",
        strengths: ["Modern UX", "Fast iteration"],
        weaknesses: ["Narrow feature set", "Thin integrations"],
        pricePosition: "mid",
      },
      {
        name: "DIY / Spreadsheets",
        type: "substitute",
        description: "The status quo most prospects use today.",
        strengths: ["Free", "Familiar", "Infinitely flexible"],
        weaknesses: ["Manual", "Error-prone", "Does not scale"],
        pricePosition: "low",
      },
    ],
    segments: [
      {
        name: "Early-adopter operators at growth-stage SMBs",
        painLevel: "high",
        description: "Feel the manual pain daily and have budget authority.",
        willingnessToPay: "$99–499/mo",
      },
      {
        name: "Solo founders / consultants",
        painLevel: "medium",
        description: "Price-sensitive but high word-of-mouth value.",
        willingnessToPay: "$0–49/mo",
      },
    ],
    canvas: {
      problem: [
        "The core workflow is manual, slow, and error-prone.",
        "Existing tools are too broad and not built for this job.",
        "Teams lack visibility into the outcome that matters.",
      ],
      customerSegments: ["Growth-stage SMB operators", "Solo founders", "In-house teams"],
      uniqueValueProposition: `${label}: get the outcome in minutes, not weeks — purpose-built, AI-native.`,
      solution: [
        "AI-native workflow that automates the manual steps.",
        "Opinionated defaults with human-in-the-loop review.",
        "One dashboard for the metric that matters.",
      ],
      channels: ["Content + SEO", "Founder-led sales", "Community", "Integrations marketplace"],
      revenueStreams: ["Monthly SaaS subscription", "Usage-based overage", "Annual enterprise plan"],
      costStructure: ["AI inference", "Cloud hosting", "Engineering", "Go-to-market"],
      keyMetrics: ["Activation rate", "Weekly active teams", "Net revenue retention", "CAC payback"],
      unfairAdvantage: "Proprietary workflow data + a founder-embedded design partner network.",
    },
    mvp: {
      goal: "Prove that target users will adopt the AI workflow and pay for the time saved.",
      riskiestAssumption: "Users trust AI output enough to act on it without heavy manual review.",
      features: [
        {
          name: "Idea/input intake",
          description: "Capture the user's input and kick off the core workflow.",
          priority: "must",
          effortDays: 3,
          userStory: "As an operator, I want to submit my input, so that I can get a result fast.",
        },
        {
          name: "AI core workflow",
          description: "The single automated step that delivers the headline value.",
          priority: "must",
          effortDays: 8,
          userStory: "As an operator, I want the AI to do the manual work, so that I save hours.",
        },
        {
          name: "Review & edit UI",
          description: "Let users verify and correct AI output to build trust.",
          priority: "must",
          effortDays: 5,
          userStory: "As an operator, I want to review results, so that I can trust and fix them.",
        },
        {
          name: "Shareable output",
          description: "Export/share the result to drive virality.",
          priority: "should",
          effortDays: 3,
          userStory: "As an operator, I want to share output, so that my team sees the value.",
        },
        {
          name: "Usage analytics",
          description: "Instrument activation and retention.",
          priority: "could",
          effortDays: 2,
          userStory: "As the team, we want funnel data, so that we can improve activation.",
        },
      ],
      successMetrics: ["40%+ activation", "3+ uses/user in week one", "20%+ WoW retention"],
      buildEstimateWeeks: 6,
    },
    risks: [
      {
        category: "market",
        description: "Beachhead segment may be too small to reach escape velocity.",
        severity: "medium",
        mitigation: "Interview 20 target users pre-build; require 10 to commit to a paid pilot.",
      },
      {
        category: "competitive",
        description: "An incumbent could bolt on a similar AI feature.",
        severity: "medium",
        mitigation: "Win a defensible data + workflow moat with design partners early.",
      },
      {
        category: "technical",
        description: "AI output quality may be inconsistent for edge cases.",
        severity: "medium",
        mitigation: "Human-in-the-loop review + evaluation harness before launch.",
      },
    ],
    landing: {
      headline: `${label}, done in minutes`,
      subheadline: "The AI-native way to run the workflow you dread — accurate, fast, and built for your team.",
      valueBullets: [
        "Cut hours of manual work to minutes",
        "Purpose-built, not a generic suite",
        "Human-in-the-loop so you stay in control",
        "Set up in under five minutes",
      ],
      primaryCta: "Start your free validation",
    },
  };
}

/**
 * Assembles a full {@link ValidationReport} from a generated core plus request
 * metadata. Shared by both the real and mock paths so the shape is identical.
 */
export function assembleReport(
  input: ValidateRequest,
  ideaId: string,
  core: GeneratedValidation,
  meta: { mocked: boolean; latencyMs: number },
): ValidationReport {
  return {
    ideaId,
    ideaTitle: input.title,
    ...core,
    mocked: meta.mocked,
    latencyMs: meta.latencyMs,
    generatedAt: new Date().toISOString(),
  };
}
