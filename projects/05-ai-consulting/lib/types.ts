import { z } from "zod";

/**
 * Domain models for the productized AI Consulting platform.
 *
 * Every model has a matching zod schema so one definition validates API
 * inputs, structures AI (`generateObject`) output, and types the UI. The
 * flow is: Client → Intake → (analyze) → Audit → Opportunity[] + Roadmap →
 * Deliverable in the client portal.
 */

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

export const IndustrySchema = z.enum([
  "saas",
  "ecommerce",
  "professional-services",
  "healthcare",
  "finance",
  "manufacturing",
  "logistics",
  "education",
  "media",
  "real-estate",
  "nonprofit",
  "other",
]);
export type Industry = z.infer<typeof IndustrySchema>;

export const CompanySizeSchema = z.enum([
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
]);
export type CompanySize = z.infer<typeof CompanySizeSchema>;

export const AiMaturitySchema = z.enum([
  "none", // no AI in use, no data pipeline
  "experimenting", // ad-hoc ChatGPT usage, no strategy
  "piloting", // one or two point solutions live
  "scaling", // multiple use cases in production
  "mature", // AI embedded in core workflows
]);
export type AiMaturity = z.infer<typeof AiMaturitySchema>;

export const ClientSchema = z.object({
  id: z.string(),
  companyName: z.string().min(1).max(200),
  industry: IndustrySchema,
  size: CompanySizeSchema,
  /** Primary contact for delivery + portal access. */
  contactName: z.string().default(""),
  contactEmail: z.string().default(""),
  createdAt: z.string(),
});
export type Client = z.infer<typeof ClientSchema>;

/* -------------------------------------------------------------------------- */
/* Intake                                                                     */
/* -------------------------------------------------------------------------- */

export const ProcessSchema = z.object({
  /** e.g. "Customer support", "Invoice processing". */
  name: z.string().min(1),
  /** What the process does and who owns it, in the client's words. */
  description: z.string().default(""),
  /** Rough hours/week the team spends on it — fuels ROI math. */
  hoursPerWeek: z.number().min(0).max(2000).default(0),
  /** How many people are involved. */
  headcount: z.number().int().min(0).max(100000).default(1),
  /** Fully-loaded blended hourly cost of the people doing it (USD). */
  hourlyCostUsd: z.number().min(0).max(2000).default(60),
  /** Whether the work is repetitive/rules-based (better automation fit). */
  repetitiveness: z.enum(["low", "medium", "high"]).default("medium"),
});
export type Process = z.infer<typeof ProcessSchema>;

export const IntakeSchema = z.object({
  clientId: z.string(),
  /** The business goals the client wants AI to move. */
  goals: z.array(z.string()).default([]),
  /** Current pain points / bottlenecks (free text lines). */
  painPoints: z.array(z.string()).default([]),
  /** Existing tech stack (tools, DBs, SaaS) — AI reasons about integration. */
  techStack: z.array(z.string()).default([]),
  /** Self-reported AI maturity. */
  aiMaturity: AiMaturitySchema.default("experimenting"),
  /** Data readiness: is data centralized, clean, accessible? */
  dataReadiness: z.enum(["poor", "fair", "good", "excellent"]).default("fair"),
  /** Key business processes the client wants examined. */
  processes: z.array(ProcessSchema).default([]),
  /** Annual budget the client can allocate to AI initiatives (USD). */
  annualBudgetUsd: z.number().min(0).max(100_000_000).default(50_000),
  /** Free-text context the AI should weigh (compliance, prior attempts, etc). */
  notes: z.string().max(4000).default(""),
});
export type Intake = z.infer<typeof IntakeSchema>;

/* -------------------------------------------------------------------------- */
/* ROI estimate                                                               */
/* -------------------------------------------------------------------------- */

export const RoiEstimateSchema = z.object({
  /** One-time implementation cost (USD). */
  implementationCostUsd: z.number().min(0),
  /** Recurring annual run cost — tokens, licenses, maintenance (USD). */
  annualRunCostUsd: z.number().min(0),
  /** Estimated annual gross benefit: labor saved + revenue lift (USD). */
  annualBenefitUsd: z.number().min(0),
  /** Annual net = benefit − run cost (USD). */
  annualNetUsd: z.number(),
  /** Months to recover the implementation cost from net benefit. */
  paybackMonths: z.number().min(0),
  /** First-year return on investment as a ratio (e.g. 2.4 = 240%). */
  firstYearRoi: z.number(),
  /** Confidence in the estimate given data quality. */
  confidence: z.enum(["low", "medium", "high"]),
  /** Plain-language explanation of how the numbers were derived. */
  narrative: z.string(),
});
export type RoiEstimate = z.infer<typeof RoiEstimateSchema>;

/* -------------------------------------------------------------------------- */
/* Opportunity                                                                */
/* -------------------------------------------------------------------------- */

/** 1 (low) – 5 (high). Impact × effort places each item on the 2x2 matrix. */
export const ScaleSchema = z.number().int().min(1).max(5);

export const OpportunityCategorySchema = z.enum([
  "automation",
  "augmentation",
  "insight",
  "customer-experience",
  "risk-compliance",
  "new-product",
]);
export type OpportunityCategory = z.infer<typeof OpportunityCategorySchema>;

export const OpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Which process/area this targets. */
  targetProcess: z.string().default(""),
  category: OpportunityCategorySchema,
  /** What the solution is, in one or two sentences. */
  description: z.string(),
  /** Business impact, 1–5 (revenue/cost/quality/speed). */
  impact: ScaleSchema,
  /** Implementation effort, 1–5 (higher = harder). */
  effort: ScaleSchema,
  /** Technical + organizational risk, 1–5. */
  risk: ScaleSchema,
  /** Derived quadrant for the 2x2 matrix. */
  quadrant: z.enum(["quick-win", "big-bet", "fill-in", "money-pit"]),
  /** Priority rank (1 = do first). Lower is higher priority. */
  priority: z.number().int().min(1),
  /** Concrete example tools / approach. */
  suggestedApproach: z.string().default(""),
  roi: RoiEstimateSchema,
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

/* -------------------------------------------------------------------------- */
/* Roadmap                                                                    */
/* -------------------------------------------------------------------------- */

export const RoadmapPhaseSchema = z.object({
  name: z.string(), // e.g. "Phase 1 — Foundations"
  /** Ordinal position, 1-based. */
  order: z.number().int().min(1),
  timeframe: z.string(), // e.g. "Weeks 1–4"
  objective: z.string(),
  /** Opportunity ids (or titles) tackled in this phase. */
  opportunities: z.array(z.string()).default([]),
  /** Milestones / exit criteria for the phase. */
  milestones: z.array(z.string()).default([]),
  /** Estimated cost for this phase (USD). */
  estimatedCostUsd: z.number().min(0).default(0),
});
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;

export const RoadmapSchema = z.object({
  phases: z.array(RoadmapPhaseSchema).default([]),
  /** Total horizon, e.g. "6 months". */
  horizon: z.string().default(""),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

export const ReadinessDimensionSchema = z.object({
  name: z.enum(["strategy", "data", "technology", "talent", "process", "governance"]),
  /** 0–100 sub-score. */
  score: z.number().min(0).max(100),
  /** One-line rationale. */
  rationale: z.string(),
});
export type ReadinessDimension = z.infer<typeof ReadinessDimensionSchema>;

export const AuditSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  /** 0–100 overall AI-readiness score. */
  readinessScore: z.number().min(0).max(100),
  readinessBand: z.enum(["nascent", "developing", "established", "advanced"]),
  /** Per-dimension breakdown for the radar/bar chart. */
  dimensions: z.array(ReadinessDimensionSchema).default([]),
  /** Executive summary the consultant can paste into the deck. */
  executiveSummary: z.string(),
  /** Notable strengths to build on. */
  strengths: z.array(z.string()).default([]),
  /** Gaps / risks to address. */
  gaps: z.array(z.string()).default([]),
  /** Prioritized use-case backlog. */
  opportunities: z.array(OpportunitySchema).default([]),
  roadmap: RoadmapSchema,
  /** Aggregate ROI across the recommended backlog. */
  portfolioRoi: RoiEstimateSchema,
  createdAt: z.string(),
});
export type Audit = z.infer<typeof AuditSchema>;

/* -------------------------------------------------------------------------- */
/* Deliverable (client portal artifact)                                       */
/* -------------------------------------------------------------------------- */

export const DeliverableSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  auditId: z.string(),
  type: z.enum([
    "readiness-audit",
    "opportunity-map",
    "usecase-backlog",
    "roadmap",
    "roi-model",
    "proposal",
  ]),
  title: z.string(),
  status: z.enum(["draft", "in-review", "delivered", "accepted"]),
  /** URL to the rendered/exported PDF once generated. */
  fileUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

/* -------------------------------------------------------------------------- */
/* API payloads                                                               */
/* -------------------------------------------------------------------------- */

export const GenerateAuditRequestSchema = z.object({
  client: ClientSchema.omit({ id: true, createdAt: true }).extend({
    id: z.string().optional(),
    createdAt: z.string().optional(),
  }),
  intake: IntakeSchema.omit({ clientId: true }).extend({
    clientId: z.string().optional(),
  }),
});
export type GenerateAuditRequest = z.infer<typeof GenerateAuditRequestSchema>;

export const GenerateAuditResponseSchema = z.object({
  audit: AuditSchema,
  meta: z.object({
    usedAI: z.boolean(),
    model: z.string().nullable(),
    generatedAt: z.string(),
  }),
});
export type GenerateAuditResponse = z.infer<typeof GenerateAuditResponseSchema>;
