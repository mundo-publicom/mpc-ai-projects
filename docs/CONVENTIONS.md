# Engineering & Documentation Conventions

Every project in this monorepo follows the same conventions so the portfolio reads as one coherent
body of work.

## Tech baseline

- **Framework:** Next.js 15+ (App Router, `app/` directory).
- **Language:** TypeScript (`strict: true`).
- **Styling:** Tailwind CSS. Utility-first; shared design tokens per app.
- **AI:** [Vercel AI SDK](https://sdk.vercel.ai) v5+. Model calls use plain
  `"provider/model"` strings routed through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
  — e.g. `generateText({ model: "anthropic/claude-sonnet-5", ... })`. No provider SDK unless a
  project explicitly needs direct wiring.
- **Runtime:** Node.js (Fluid Compute on Vercel). Avoid edge-only APIs.
- **Package manager:** pnpm workspaces.

## Project folder structure

```
projects/NN-slug/
├── README.md                 # product overview + quickstart + monetization
├── .env.example              # every required env var, documented, no secrets
├── package.json              # self-contained deps + scripts
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_SPEC.md
│   └── ARCHITECTURE.md
├── app/                      # routes, layouts, API routes
│   ├── layout.tsx
│   ├── page.tsx              # landing / dashboard
│   ├── globals.css
│   └── api/…/route.ts        # core backend logic (real, not stubbed away)
├── components/               # reusable UI
├── lib/                      # domain logic, AI orchestration, types
└── (project-specific dirs)
```

## Documentation standard

- **PRD.md** must contain: Overview, Problem, Target users & personas, User stories,
  Functional requirements (numbered), Non-functional requirements, Success metrics/KPIs,
  Monetization & pricing, Go-to-market, Competitive landscape, Risks & mitigations,
  Out of scope, Milestones/roadmap.
- **TECHNICAL_SPEC.md** must contain: System overview, Component breakdown, Data models
  (typed), API surface (routes + payloads), AI/model usage, Third-party integrations,
  Security & privacy, Observability, Scaling considerations, Testing strategy.
- **ARCHITECTURE.md** must contain: A Mermaid diagram of the system, data-flow description,
  request lifecycle, deployment topology, and environment/config notes.

## Code conventions

- Prefer Server Components; use `"use client"` only where interactivity requires it.
- API routes return typed JSON; validate inputs with `zod`.
- Keep domain logic in `lib/`, not in components or routes.
- Every AI call sets a system prompt, temperature, and (where relevant) a `zod` output schema
  via `generateObject`.
- Scaffolds must be runnable (`pnpm dev` boots) and include at least one **real** end-to-end
  path exercising the core value prop, with graceful fallback (mock data) when API keys are absent.
- No secrets committed. All keys via `.env.example` → `.env.local`.

## Monetization framing

Each README opens with a one-paragraph business case: who pays, for what, and the pricing model.
This is a money-making-portfolio; the commercial angle is a first-class requirement, not an afterthought.
