import type { Lead } from "./types";

/** RFC-4180-safe CSV cell: quote and escape when needed. */
function cell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLUMNS: Array<{ header: string; get: (l: Lead) => string | number }> = [
  { header: "Score", get: (l) => l.score.value },
  { header: "Band", get: (l) => l.score.band },
  { header: "Company", get: (l) => l.company.name },
  { header: "Domain", get: (l) => l.company.domain },
  { header: "Industry", get: (l) => l.company.industry },
  { header: "Size", get: (l) => l.company.size },
  { header: "Region", get: (l) => l.company.region },
  { header: "Contact", get: (l) => l.contact.fullName },
  { header: "Title", get: (l) => l.contact.title },
  { header: "Email", get: (l) => l.contact.email },
  { header: "Email Status", get: (l) => l.contact.emailStatus },
  { header: "LinkedIn", get: (l) => l.contact.linkedinUrl ?? "" },
  { header: "Why a Fit", get: (l) => l.whyAFit },
  { header: "Suggested Opener", get: (l) => l.suggestedOpener },
];

/** Serialize leads to a CSV string ready for CRM/spreadsheet import. */
export function leadsToCsv(leads: Lead[]): string {
  const head = COLUMNS.map((c) => cell(c.header)).join(",");
  const rows = leads.map((l) => COLUMNS.map((c) => cell(c.get(l))).join(","));
  return [head, ...rows].join("\r\n");
}
