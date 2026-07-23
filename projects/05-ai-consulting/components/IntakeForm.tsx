"use client";

import { useState } from "react";
import type {
  AiMaturity,
  CompanySize,
  GenerateAuditRequest,
  Industry,
  Process,
} from "@/lib/types";

const INDUSTRIES: Industry[] = [
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
];
const SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const MATURITY: AiMaturity[] = ["none", "experimenting", "piloting", "scaling", "mature"];
const DATA_READINESS = ["poor", "fair", "good", "excellent"] as const;
const REPETITIVENESS = ["low", "medium", "high"] as const;

/** A sensible sample so the demo is one click to a full audit. */
const SAMPLE_PROCESSES: Process[] = [
  {
    name: "Customer support",
    description: "Email + chat support triage and responses",
    hoursPerWeek: 120,
    headcount: 4,
    hourlyCostUsd: 45,
    repetitiveness: "high",
  },
  {
    name: "Invoice processing",
    description: "Manual data entry from PDFs into the accounting system",
    hoursPerWeek: 30,
    headcount: 2,
    hourlyCostUsd: 40,
    repetitiveness: "high",
  },
  {
    name: "Sales proposal drafting",
    description: "Custom proposals written from scratch per lead",
    hoursPerWeek: 25,
    headcount: 3,
    hourlyCostUsd: 75,
    repetitiveness: "medium",
  },
];

const label = "block text-xs font-medium text-slate-600 mb-1";
const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function lines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function IntakeForm({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: GenerateAuditRequest) => void;
  loading: boolean;
}) {
  const [companyName, setCompanyName] = useState("Acme Widgets Co.");
  const [industry, setIndustry] = useState<Industry>("ecommerce");
  const [size, setSize] = useState<CompanySize>("51-200");
  const [contactName, setContactName] = useState("Jordan Lee");
  const [contactEmail, setContactEmail] = useState("jordan@acmewidgets.com");
  const [goals, setGoals] = useState(
    "Reduce support response times\nCut manual back-office work\nGrow revenue without adding headcount",
  );
  const [painPoints, setPainPoints] = useState(
    "Support team is overwhelmed at peak\nInvoice entry is slow and error-prone\nProposals take too long to turn around",
  );
  const [techStack, setTechStack] = useState("Shopify, Zendesk, QuickBooks, HubSpot, Slack");
  const [aiMaturity, setAiMaturity] = useState<AiMaturity>("experimenting");
  const [dataReadiness, setDataReadiness] =
    useState<(typeof DATA_READINESS)[number]>("fair");
  const [annualBudget, setAnnualBudget] = useState(60000);
  const [notes, setNotes] = useState(
    "We tried an off-the-shelf chatbot last year but it didn't integrate with our systems.",
  );
  const [processes, setProcesses] = useState<Process[]>(SAMPLE_PROCESSES);

  function updateProcess(i: number, patch: Partial<Process>) {
    setProcesses((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addProcess() {
    setProcesses((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        hoursPerWeek: 10,
        headcount: 1,
        hourlyCostUsd: 50,
        repetitiveness: "medium",
      },
    ]);
  }
  function removeProcess(i: number) {
    setProcesses((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: GenerateAuditRequest = {
      client: { companyName, industry, size, contactName, contactEmail },
      intake: {
        goals: lines(goals),
        painPoints: lines(painPoints),
        techStack: techStack
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        aiMaturity,
        dataReadiness,
        annualBudgetUsd: annualBudget,
        notes,
        processes: processes.filter((p) => p.name.trim().length > 0),
      },
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company */}
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-700">Company</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Company name</label>
            <input
              className={input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>Industry</label>
            <select
              className={input}
              value={industry}
              onChange={(e) => setIndustry(e.target.value as Industry)}
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i.replace("-", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Company size (employees)</label>
            <select
              className={input}
              value={size}
              onChange={(e) => setSize(e.target.value as CompanySize)}
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Contact name</label>
            <input
              className={input}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Contact email</label>
            <input
              className={input}
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Context */}
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-700">Context</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Business goals (one per line)</label>
            <textarea
              className={`${input} h-24`}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Pain points (one per line)</label>
            <textarea
              className={`${input} h-24`}
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Tech stack (comma-separated)</label>
            <input
              className={input}
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>AI maturity</label>
            <select
              className={input}
              value={aiMaturity}
              onChange={(e) => setAiMaturity(e.target.value as AiMaturity)}
            >
              {MATURITY.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Data readiness</label>
            <select
              className={input}
              value={dataReadiness}
              onChange={(e) =>
                setDataReadiness(e.target.value as (typeof DATA_READINESS)[number])
              }
            >
              {DATA_READINESS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Annual AI budget (USD)</label>
            <input
              className={input}
              type="number"
              min={0}
              value={annualBudget}
              onChange={(e) => setAnnualBudget(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Notes</label>
            <textarea
              className={`${input} h-20`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Processes */}
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Key processes (drive ROI math)
        </legend>
        <div className="space-y-4">
          {processes.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Process name</label>
                  <input
                    className={input}
                    value={p.name}
                    onChange={(e) => updateProcess(i, { name: e.target.value })}
                    placeholder="e.g. Customer support"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Description</label>
                  <input
                    className={input}
                    value={p.description}
                    onChange={(e) => updateProcess(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Hours / week</label>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={p.hoursPerWeek}
                    onChange={(e) =>
                      updateProcess(i, { hoursPerWeek: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Headcount</label>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={p.headcount}
                    onChange={(e) =>
                      updateProcess(i, { headcount: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Blended $/hour</label>
                  <input
                    className={input}
                    type="number"
                    min={0}
                    value={p.hourlyCostUsd}
                    onChange={(e) =>
                      updateProcess(i, { hourlyCostUsd: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Repetitiveness</label>
                  <select
                    className={input}
                    value={p.repetitiveness}
                    onChange={(e) =>
                      updateProcess(i, {
                        repetitiveness: e.target
                          .value as Process["repetitiveness"],
                      })
                    }
                  >
                    {REPETITIVENESS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeProcess(i)}
                className="mt-3 text-xs font-medium text-rose-600 hover:underline"
              >
                Remove process
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addProcess}
            className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-500 hover:text-brand-600"
          >
            + Add process
          </button>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Generating audit…" : "Generate AI-Readiness Audit"}
      </button>
    </form>
  );
}
