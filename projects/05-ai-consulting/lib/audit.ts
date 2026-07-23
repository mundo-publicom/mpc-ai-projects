import { z } from "zod";
import type {
  Audit,
  Client,
  Intake,
  Opportunity,
  OpportunityCategory,
  Process,
  ReadinessDimension,
  Roadmap,
} from "./types";
import {
  OpportunityCategorySchema,
  ScaleSchema,
} from "./types";
import {
  aggregateRoi,
  computeRoi,
  prioritize,
  quadrantFor,
  withConfidence,
} from "./roi";

/**
 * Audit assembly. The AI supplies *judgment* (readiness scoring, opportunity
 * ideas with impact/effort/risk ratings, roadmap sequencing, narrative). The
 * dollar ROI is always computed deterministically in `lib/roi.ts` from intake
 * numbers — so headline figures are defensible, not hallucinated.
 */

/* -------------------------------------------------------------------------- */
/* AI draft schema (what `generateObject` returns)                            */
/* -------------------------------------------------------------------------- */

export const OpportunityDraftSchema = z.object({
  title: z.string(),
  /** Name of the intake process this targets (empty if net-new). */
  targetProcess: z.string().default(""),
  category: OpportunityCategorySchema,
  description: z.string(),
  impact: ScaleSchema,
  effort: ScaleSchema,
  risk: ScaleSchema,
  suggestedApproach: z.string().default(""),
  /** Optional revenue lift (USD/yr) for growth-oriented plays; 0 if pure cost-save. */
  revenueLiftUsd: z.number().min(0).default(0),
});

export const RoadmapPhaseDraftSchema = z.object({
  name: z.string(),
  order: z.number().int().min(1),
  timeframe: z.string(),
  objective: z.string(),
  /** Opportunity titles addressed in this phase. */
  opportunities: z.array(z.string()).default([]),
  milestones: z.array(z.string()).default([]),
});

export const AuditDraftSchema = z.object({
  readinessScore: z.number().min(0).max(100),
  dimensions: z
    .array(
      z.object({
        name: z.enum([
          "strategy",
          "data",
          "technology",
          "talent",
          "process",
          "governance",
        ]),
        score: z.number().min(0).max(100),
        rationale: z.string(),
      }),
    )
    .length(6),
  executiveSummary: z.string(),
  strengths: z.array(z.string()).min(1),
  gaps: z.array(z.string()).min(1),
  opportunities: z.array(OpportunityDraftSchema).min(3).max(10),
  roadmap: z.object({
    horizon: z.string(),
    phases: z.array(RoadmapPhaseDraftSchema).min(2),
  }),
});
export type AuditDraft = z.infer<typeof AuditDraftSchema>;

/* -------------------------------------------------------------------------- */
/* Prompt construction                                                        */
/* -------------------------------------------------------------------------- */

export const AUDIT_SYSTEM_PROMPT = `You are a senior AI transformation consultant producing an AI-Readiness Audit for a client.
You are pragmatic and commercially honest: you favor quick wins that pay back fast, flag data/governance gaps candidly, and never over-promise.
Rate each opportunity's impact, effort, and risk on a 1-5 scale (5 = highest). Do NOT invent dollar figures — the platform computes ROI from the client's own process numbers. Focus your judgment on: readiness scoring across the six dimensions (strategy, data, technology, talent, process, governance), a prioritized backlog of concrete, buildable AI use cases mapped to the client's real processes and stack, and a phased roadmap that sequences quick wins before big bets.`;

export function buildAuditPrompt(client: Client, intake: Intake): string {
  const procLines = intake.processes
    .map(
      (p) =>
        `- ${p.name}: ${p.description || "(no description)"} — ~${p.hoursPerWeek}h/week, ${p.headcount} people @ $${p.hourlyCostUsd}/h, repetitiveness: ${p.repetitiveness}`,
    )
    .join("\n");

  return `Client: ${client.companyName}
Industry: ${client.industry}
Company size: ${client.size} employees
Self-reported AI maturity: ${intake.aiMaturity}
Data readiness: ${intake.dataReadiness}
Annual AI budget: $${intake.annualBudgetUsd.toLocaleString("en-US")}

Business goals:
${intake.goals.map((g) => `- ${g}`).join("\n") || "- (none provided)"}

Pain points:
${intake.painPoints.map((p) => `- ${p}`).join("\n") || "- (none provided)"}

Current tech stack: ${intake.techStack.join(", ") || "(not specified)"}

Key processes:
${procLines || "- (none provided)"}

Additional context:
${intake.notes || "(none)"}

Produce the audit. Map each opportunity's targetProcess to one of the process names above when applicable, and reference the client's actual stack in your suggestedApproach.`;
}

/* -------------------------------------------------------------------------- */
/* Finalization: draft -> full Audit (deterministic ROI)                      */
/* -------------------------------------------------------------------------- */

function bandForReadiness(score: number): Audit["readinessBand"] {
  if (score >= 80) return "advanced";
  if (score >= 60) return "established";
  if (score >= 40) return "developing";
  return "nascent";
}

function findProcess(intake: Intake, name: string): Process | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return intake.processes.find(
    (p) => p.name.toLowerCase() === n || p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()),
  );
}

/**
 * Turn a validated AI draft (or mock draft) into a complete, ROI-costed Audit.
 * This is the single source of truth for how a draft becomes a deliverable.
 */
export function finalizeAudit(
  draft: AuditDraft,
  client: Client,
  intake: Intake,
): Audit {
  const now = new Date().toISOString();

  // 1. Cost every opportunity from real intake numbers.
  const costed: Opportunity[] = draft.opportunities.map((d, i) => {
    const process = findProcess(intake, d.targetProcess);
    const baseRoi = computeRoi({
      category: d.category as OpportunityCategory,
      effort: d.effort,
      process,
      revenueLiftUsd: d.revenueLiftUsd,
    });
    const roi = withConfidence(baseRoi, intake, d.effort);
    return {
      id: `opp-${i + 1}`,
      title: d.title,
      targetProcess: d.targetProcess,
      category: d.category as OpportunityCategory,
      description: d.description,
      impact: d.impact,
      effort: d.effort,
      risk: d.risk,
      quadrant: quadrantFor(d.impact, d.effort),
      priority: i + 1, // provisional; prioritize() reassigns
      suggestedApproach: d.suggestedApproach,
      roi,
    };
  });

  // 2. Rank by blended impact/ROI/effort/risk.
  const opportunities = prioritize(costed);

  // 3. Portfolio ROI across the whole backlog.
  const portfolioRoi = aggregateRoi(opportunities);

  // 4. Attach estimated cost to each roadmap phase from its opportunities.
  const byTitle = new Map(opportunities.map((o) => [o.title.toLowerCase(), o]));
  const roadmap: Roadmap = {
    horizon: draft.roadmap.horizon,
    phases: draft.roadmap.phases
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((ph) => {
        const estimatedCostUsd = ph.opportunities.reduce((sum, t) => {
          const o = byTitle.get(t.toLowerCase());
          return sum + (o ? o.roi.implementationCostUsd : 0);
        }, 0);
        return {
          name: ph.name,
          order: ph.order,
          timeframe: ph.timeframe,
          objective: ph.objective,
          opportunities: ph.opportunities,
          milestones: ph.milestones,
          estimatedCostUsd,
        };
      }),
  };

  const dimensions: ReadinessDimension[] = draft.dimensions;

  return {
    id: `audit-${Date.now()}`,
    clientId: client.id,
    readinessScore: Math.round(draft.readinessScore),
    readinessBand: bandForReadiness(draft.readinessScore),
    dimensions,
    executiveSummary: draft.executiveSummary,
    strengths: draft.strengths,
    gaps: draft.gaps,
    opportunities,
    roadmap,
    portfolioRoi,
    createdAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/* Mock draft (used when !hasAI())                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build a realistic mock draft from the intake so the demo produces a coherent,
 * client-specific audit with zero API keys. Uses simple heuristics rather than
 * random data so output is stable and defensible.
 */
export function mockAuditDraft(client: Client, intake: Intake): AuditDraft {
  const dataScore = { poor: 30, fair: 52, good: 74, excellent: 90 }[intake.dataReadiness];
  const maturityScore = {
    none: 25,
    experimenting: 45,
    piloting: 60,
    scaling: 75,
    mature: 88,
  }[intake.aiMaturity];

  const dimensions: AuditDraft["dimensions"] = [
    {
      name: "strategy",
      score: clamp(maturityScore + (intake.goals.length ? 8 : -6)),
      rationale: intake.goals.length
        ? "Clear business goals give AI initiatives a direction to serve."
        : "No explicit goals stated — strategy needs sharpening before investment.",
    },
    {
      name: "data",
      score: dataScore,
      rationale: `Self-reported data readiness is "${intake.dataReadiness}"; data foundations gate most high-value use cases.`,
    },
    {
      name: "technology",
      score: clamp(50 + Math.min(intake.techStack.length, 6) * 6),
      rationale: intake.techStack.length
        ? `A ${intake.techStack.length}-tool stack offers integration surface for AI.`
        : "Stack not specified; integration effort is unknown.",
    },
    {
      name: "talent",
      score: clamp(maturityScore - 8),
      rationale: "Team AI fluency tracks maturity; upskilling likely needed to scale.",
    },
    {
      name: "process",
      score: clamp(
        40 +
          (intake.processes.filter((p) => p.repetitiveness === "high").length * 12),
      ),
      rationale: "Repetitive, well-documented processes are the strongest automation candidates.",
    },
    {
      name: "governance",
      score: clamp(maturityScore - 15),
      rationale: "Governance/oversight typically lags adoption; formalize before scaling.",
    },
  ];

  const readinessScore = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  // Derive opportunities from the client's processes, plus one growth play.
  const procOpps = intake.processes.slice(0, 5).map((p): z.infer<typeof OpportunityDraftSchema> => {
    const rep = p.repetitiveness;
    const impact = rep === "high" ? 5 : rep === "medium" ? 4 : 3;
    const effort = p.hoursPerWeek > 40 ? 3 : 2;
    return {
      title: `AI-assist ${p.name}`,
      targetProcess: p.name,
      category: rep === "high" ? "automation" : "augmentation",
      description: `Introduce an AI copilot/automation layer over "${p.name}" to remove repetitive effort and speed turnaround.`,
      impact,
      effort,
      risk: rep === "high" ? 2 : 3,
      suggestedApproach: `Ground an LLM on ${client.companyName}'s ${p.name} SOPs and connect it to ${
        intake.techStack[0] ?? "the core system"
      }; start with human-in-the-loop review.`,
      revenueLiftUsd: 0,
    };
  });

  const growthOpp: z.infer<typeof OpportunityDraftSchema> = {
    title: "AI-driven customer insight layer",
    targetProcess: "",
    category: "insight",
    description:
      "Aggregate customer and operational data into an AI analytics layer surfacing churn risk, upsell signals, and demand trends.",
    impact: 4,
    effort: 3,
    risk: 3,
    suggestedApproach:
      "Centralize data into a warehouse, then use an LLM + semantic layer for natural-language analytics and weekly insight digests.",
    revenueLiftUsd: Math.round(intake.annualBudgetUsd * 0.6),
  };

  const opportunities = (procOpps.length ? procOpps : [growthOpp]).concat(
    procOpps.length ? [growthOpp] : [],
  );

  // Guarantee the schema minimum of 3 opportunities.
  while (opportunities.length < 3) {
    opportunities.push({
      title: `Knowledge base assistant #${opportunities.length}`,
      targetProcess: "",
      category: "augmentation",
      description:
        "Deploy an internal RAG assistant over company documents to cut time employees spend searching for information.",
      impact: 3,
      effort: 2,
      risk: 2,
      suggestedApproach: "Index internal docs into a vector store and expose a chat assistant with citations.",
      revenueLiftUsd: 0,
    });
  }

  return {
    readinessScore,
    dimensions,
    executiveSummary: `${client.companyName} is at a "${intake.aiMaturity}" maturity level with ${intake.dataReadiness} data readiness, scoring ${readinessScore}/100 for AI readiness. The strongest near-term returns come from automating repetitive processes while the team builds data and governance foundations in parallel. This audit prioritizes ${opportunities.length} use cases, front-loading quick wins that pay back inside a year.`,
    strengths: buildStrengths(intake),
    gaps: buildGaps(intake),
    opportunities,
    roadmap: {
      horizon: "6 months",
      phases: [
        {
          name: "Phase 1 — Quick wins & foundations",
          order: 1,
          timeframe: "Weeks 1–8",
          objective: "Ship one high-impact automation and stand up basic data plumbing + governance.",
          opportunities: opportunities.slice(0, 2).map((o) => o.title),
          milestones: [
            "First automation live with human-in-the-loop",
            "Data access + retention policy documented",
            "Baseline metrics instrumented",
          ],
        },
        {
          name: "Phase 2 — Scale & augment",
          order: 2,
          timeframe: "Weeks 9–24",
          objective: "Roll out augmentation copilots and the insight layer; formalize governance.",
          opportunities: opportunities.slice(2).map((o) => o.title),
          milestones: [
            "Copilots adopted by target teams",
            "Insight digests delivered to leadership",
            "AI usage + review policy operational",
          ],
        },
      ],
    },
  };
}

function buildStrengths(intake: Intake): string[] {
  const s: string[] = [];
  if (intake.goals.length) s.push("Clear, stated business goals to anchor AI investment.");
  if (["good", "excellent"].includes(intake.dataReadiness))
    s.push("Solid data foundations reduce time-to-value.");
  if (intake.techStack.length >= 3)
    s.push("Modern tooling provides integration points for AI.");
  if (intake.processes.some((p) => p.repetitiveness === "high"))
    s.push("Highly repetitive processes are prime automation targets.");
  if (s.length === 0) s.push("Willingness to invest and a defined budget for AI initiatives.");
  return s;
}

function buildGaps(intake: Intake): string[] {
  const g: string[] = [];
  if (["poor", "fair"].includes(intake.dataReadiness))
    g.push("Data is fragmented or unclean — a prerequisite for most use cases.");
  if (["none", "experimenting"].includes(intake.aiMaturity))
    g.push("Low AI maturity; needs governance and upskilling before scaling.");
  if (!intake.goals.length) g.push("No explicit success metrics defined for AI initiatives.");
  if (intake.techStack.length < 2) g.push("Limited/undocumented stack raises integration risk.");
  if (g.length === 0) g.push("Governance and change-management processes should be formalized.");
  return g;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
