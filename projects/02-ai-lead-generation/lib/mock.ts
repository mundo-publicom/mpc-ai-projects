import type { CompanySize, EnrichmentSource, Lead, LeadCompany, LeadContact } from "./types";

/**
 * Seed data for the zero-key demo path. These are fictional companies used to
 * synthesize realistic-looking enriched leads when no AI/enrichment key is set.
 */

const COMPANY_SEEDS: Array<Omit<LeadCompany, "size" | "region"> & { size: CompanySize; region: string }> = [
  { name: "NorthLoop Logistics", domain: "northloop.io", industry: "Logistics & Supply Chain", size: "201-500", region: "North America", description: "Freight visibility platform; hiring SDRs and expanding its RevOps team, uses HubSpot." },
  { name: "Verdant Health", domain: "verdanthealth.com", industry: "Healthcare SaaS", size: "51-200", region: "North America", description: "Patient-intake automation for clinics; recently raised a Series A and is scaling go-to-market." },
  { name: "Cobalt Fintech", domain: "cobalt.finance", industry: "Fintech", size: "501-1000", region: "Europe", description: "Embedded-payments API; strong developer adoption, using Salesforce, opening a US office." },
  { name: "Meridian Analytics", domain: "meridian-analytics.com", industry: "Data & Analytics", size: "11-50", region: "North America", description: "Product analytics for e-commerce; PLG motion, hiring a first head of sales." },
  { name: "Atlas Manufacturing", domain: "atlasmfg.com", industry: "Industrial Manufacturing", size: "1001-5000", region: "North America", description: "Precision components supplier modernizing procurement; evaluating new vendor tools." },
  { name: "Bright Ledger", domain: "brightledger.co", industry: "Accounting Software", size: "51-200", region: "Europe", description: "SMB bookkeeping automation; uses HubSpot, running paid acquisition and hiring RevOps." },
  { name: "Kestrel Security", domain: "kestrelsec.com", industry: "Cybersecurity", size: "201-500", region: "North America", description: "Cloud posture management; SOC2 focus, expanding mid-market sales team." },
  { name: "Harborview Real Estate", domain: "harborview.re", industry: "PropTech", size: "11-50", region: "North America", description: "Commercial leasing marketplace; early GTM, founder-led sales, evaluating outbound tooling." },
  { name: "Pulse Learning", domain: "pulselearning.com", industry: "EdTech", size: "51-200", region: "Asia-Pacific", description: "Corporate upskilling platform; expanding into new regions, using Salesforce." },
  { name: "Terra Renewables", domain: "terrarenew.com", industry: "CleanTech", size: "501-1000", region: "Europe", description: "Solar asset management software; scaling enterprise sales, hiring account executives." },
  { name: "Nimbus DevTools", domain: "nimbus.dev", industry: "Developer Tools", size: "11-50", region: "North America", description: "CI/CD observability; PLG with strong bottoms-up adoption, first sales hire in progress." },
  { name: "Cascade Retail Group", domain: "cascaderetail.com", industry: "Retail & E-commerce", size: "1001-5000", region: "North America", description: "Omnichannel retailer modernizing its martech stack; evaluating lead-gen and CRM tools." },
];

const FIRST_NAMES = ["Jordan", "Priya", "Marcus", "Elena", "Diego", "Aisha", "Liam", "Sofia", "Noah", "Mei", "Omar", "Grace"];
const LAST_NAMES = ["Reyes", "Kapoor", "Bennett", "Novak", "Fischer", "Okafor", "Tanaka", "Alvarez", "Schmidt", "Nguyen", "Hassan", "Whitfield"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function emailFor(fullName: string, domain: string): string {
  const [first, last] = fullName.toLowerCase().split(" ");
  return `${first}.${last}@${domain}`;
}

function contactFor(company: LeadCompany, title: string, i: number): LeadContact {
  const fullName = `${pick(FIRST_NAMES, i * 3 + 1)} ${pick(LAST_NAMES, i * 5 + 2)}`;
  return {
    fullName,
    title,
    email: emailFor(fullName, company.domain),
    emailStatus: i % 3 === 0 ? "verified" : "guessed",
    linkedinUrl: `https://www.linkedin.com/in/${fullName.toLowerCase().replace(" ", "-")}`,
  };
}

export function mockEnrichmentSources(i: number): EnrichmentSource[] {
  const now = new Date().toISOString();
  return [
    { provider: "mock", confidence: 0.72 + (i % 3) * 0.08, fields: ["company", "industry", "size"], fetchedAt: now },
    { provider: "mock", confidence: 0.65 + (i % 4) * 0.07, fields: ["email", "title", "linkedin"], fetchedAt: now },
  ];
}

/**
 * Build `count` raw (unscored) lead skeletons from seed data. Titles are drawn
 * from the ICP when provided so the mock respects the requested buyer.
 */
export function buildMockCandidates(
  targetTitles: string[],
  count: number,
): Array<Pick<Lead, "id" | "company" | "contact"> & { sources: EnrichmentSource[] }> {
  const titles = targetTitles.length > 0 ? targetTitles : ["VP of Sales", "Head of Marketing", "Founder & CEO", "RevOps Lead"];
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => {
    const seed = COMPANY_SEEDS[i % COMPANY_SEEDS.length];
    const company: LeadCompany = { ...seed };
    const title = pick(titles, i);
    return {
      id: `lead_${Date.now().toString(36)}_${i}`,
      company,
      contact: contactFor(company, title, i),
      sources: mockEnrichmentSources(i),
    };
  });
}
