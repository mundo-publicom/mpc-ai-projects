import { z } from "zod";

/**
 * Domain models for the AI Lead Generation engine.
 *
 * Every model has a matching zod schema so the same definition validates
 * API inputs, structures AI (`generateObject`) output, and types the UI.
 */

/* -------------------------------------------------------------------------- */
/* Ideal Customer Profile (ICP)                                               */
/* -------------------------------------------------------------------------- */

export const CompanySizeSchema = z.enum([
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
]);
export type CompanySize = z.infer<typeof CompanySizeSchema>;

export const IcpSchema = z.object({
  /** Free-text description the operator typed; the AI parses it into structure. */
  description: z.string().min(1).max(2000),
  industries: z.array(z.string()).default([]),
  companySizes: z.array(CompanySizeSchema).default([]),
  regions: z.array(z.string()).default([]),
  /** Job titles / roles of the buying committee we want to reach. */
  targetTitles: z.array(z.string()).default([]),
  /** Signals that indicate a good fit (e.g. "hiring SDRs", "uses HubSpot"). */
  buyingSignals: z.array(z.string()).default([]),
  /** The value proposition we are selling — used to personalize outreach. */
  valueProposition: z.string().default(""),
  /** Explicit disqualifiers (e.g. "no agencies", "not government"). */
  exclusions: z.array(z.string()).default([]),
});
export type Icp = z.infer<typeof IcpSchema>;

/* -------------------------------------------------------------------------- */
/* Enrichment                                                                 */
/* -------------------------------------------------------------------------- */

export const EnrichmentProviderSchema = z.enum([
  "apollo",
  "clearbit",
  "hunter",
  "peopledatalabs",
  "linkedin",
  "builtwith",
  "mock",
]);
export type EnrichmentProvider = z.infer<typeof EnrichmentProviderSchema>;

export const EnrichmentSourceSchema = z.object({
  provider: EnrichmentProviderSchema,
  /** 0-1 confidence the provider attaches to the matched record. */
  confidence: z.number().min(0).max(1),
  /** Which fields this source contributed (for provenance / audit). */
  fields: z.array(z.string()).default([]),
  /** ISO timestamp of when the data was fetched. */
  fetchedAt: z.string(),
});
export type EnrichmentSource = z.infer<typeof EnrichmentSourceSchema>;

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

export const ScoreBandSchema = z.enum(["hot", "warm", "cool", "cold"]);
export type ScoreBand = z.infer<typeof ScoreBandSchema>;

/** The structured object the AI returns per lead via `generateObject`. */
export const ScoreSchema = z.object({
  /** 0-100 overall fit score. */
  value: z.number().min(0).max(100),
  band: ScoreBandSchema,
  /** Component sub-scores for transparency (each 0-100). */
  breakdown: z.object({
    industryFit: z.number().min(0).max(100),
    sizeFit: z.number().min(0).max(100),
    titleFit: z.number().min(0).max(100),
    signalStrength: z.number().min(0).max(100),
  }),
  /** One-sentence human explanation of why this lead fits the ICP. */
  reasoning: z.string(),
});
export type Score = z.infer<typeof ScoreSchema>;

/* -------------------------------------------------------------------------- */
/* Lead                                                                       */
/* -------------------------------------------------------------------------- */

export const LeadContactSchema = z.object({
  fullName: z.string(),
  title: z.string(),
  email: z.string(),
  /** Whether the email is verified/deliverable vs. pattern-guessed. */
  emailStatus: z.enum(["verified", "guessed", "unknown"]).default("unknown"),
  linkedinUrl: z.string().optional(),
});
export type LeadContact = z.infer<typeof LeadContactSchema>;

export const LeadCompanySchema = z.object({
  name: z.string(),
  domain: z.string(),
  industry: z.string(),
  size: CompanySizeSchema,
  region: z.string(),
  description: z.string().default(""),
});
export type LeadCompany = z.infer<typeof LeadCompanySchema>;

export const LeadSchema = z.object({
  id: z.string(),
  company: LeadCompanySchema,
  contact: LeadContactSchema,
  score: ScoreSchema,
  /** Why the lead is a fit — surfaced verbatim in the table. */
  whyAFit: z.string(),
  /** AI-generated personalized first-touch opener. */
  suggestedOpener: z.string(),
  sources: z.array(EnrichmentSourceSchema).default([]),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof LeadSchema>;

/* -------------------------------------------------------------------------- */
/* Campaign                                                                   */
/* -------------------------------------------------------------------------- */

export const CampaignStatusSchema = z.enum([
  "draft",
  "generating",
  "ready",
  "exported",
  "archived",
]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  icp: IcpSchema,
  status: CampaignStatusSchema,
  leads: z.array(LeadSchema).default([]),
  /** Credits consumed generating + enriching this campaign's leads. */
  creditsUsed: z.number().int().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Campaign = z.infer<typeof CampaignSchema>;

/* -------------------------------------------------------------------------- */
/* API payloads                                                               */
/* -------------------------------------------------------------------------- */

export const GenerateLeadsRequestSchema = z.object({
  icp: IcpSchema,
  /** How many sample leads to return (capped server-side). */
  count: z.number().int().min(1).max(25).default(8),
});
export type GenerateLeadsRequest = z.infer<typeof GenerateLeadsRequestSchema>;

export const GenerateLeadsResponseSchema = z.object({
  leads: z.array(LeadSchema),
  meta: z.object({
    usedAI: z.boolean(),
    model: z.string().nullable(),
    creditsUsed: z.number().int(),
    generatedAt: z.string(),
  }),
});
export type GenerateLeadsResponse = z.infer<typeof GenerateLeadsResponseSchema>;

export const ExportLeadsRequestSchema = z.object({
  leads: z.array(LeadSchema).min(1),
  format: z.enum(["csv"]).default("csv"),
});
export type ExportLeadsRequest = z.infer<typeof ExportLeadsRequestSchema>;
