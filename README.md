# MCP AI Portfolio

A monorepo of **14 production-oriented AI products**, each built as a standalone
[Next.js](https://nextjs.org) app with a full **PRD**, **technical spec**, **architecture doc**, and a
**working scaffold**. Every project is designed around a real, defensible monetization model — this
is both a portfolio and a set of launchable AI businesses.

> **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Vercel AI SDK (via AI Gateway) · Deployable to Vercel
> **Layout:** One monorepo · one folder per product · each independently runnable & deployable

---

## The 14 Products

| # | Project | What it does | How it makes money |
|---|---------|--------------|--------------------|
| 01 | [AI Voice Agent](./projects/01-ai-voice-agent) | Phone/web voice agents that book, qualify & support | Per-minute / per-seat SaaS + setup fees |
| 02 | [AI Lead Generation](./projects/02-ai-lead-generation) | Scrapes, enriches & scores B2B leads automatically | Per-lead / monthly SaaS |
| 03 | [Faceless AI YouTube Generation](./projects/03-faceless-ai-yt-generation) | Script→voice→video pipeline for faceless channels | Subscription + per-video credits |
| 04 | [AI Content Repurposing](./projects/04-ai-content-repurposing) | Turns 1 long-form asset into 20+ platform-native posts | Tiered SaaS by output volume |
| 05 | [AI Consulting](./projects/05-ai-consulting) | Productized AI-readiness audits & consulting delivery | Retainers + audit packages |
| 06 | [AI Virtual Assistant](./projects/06-ai-virtual-assistant) | Personal AI EA: inbox, calendar, tasks, research | Per-seat SaaS |
| 07 | [AI Chatbot Agent](./projects/07-ai-chatbot-agent) | Embeddable RAG support/sales chatbot for any site | Per-site / per-conversation SaaS |
| 08 | [AI Trading Bot](./projects/08-ai-trading-bot) | Signal generation & paper/live trading (research-grade) | Subscription + performance tiers |
| 09 | [AI Agent Development](./projects/09-ai-agent-development) | Framework + platform to build/deploy custom agents | Platform SaaS + usage |
| 10 | [AI Copywriting](./projects/10-ai-copywriting) | Brand-aware copy across ads, email, landing pages | Credit-based SaaS |
| 11 | [AI Venture Studio](./projects/11-ai-venture-studio) | Idea→validation→MVP-spec pipeline for new ventures | Equity + productized sprints |
| 12 | [AI-to-AI Marketplace](./projects/12-ai-to-ai-marketplace) | Marketplace where agents discover & pay other agents | Take-rate on transactions |
| 13 | [AI Logo & Brand Design](./projects/13-ai-logo-brand-design) | Generates logos, palettes & brand kits | Per-kit + subscription |
| 14 | [Managed AI Cybersecurity](./projects/14-manage-ai-cybersecurity) | AI-driven threat triage & posture monitoring | MRR per monitored asset |

---

## Repository layout

```
Make-Money-with-AI/
├── README.md                 ← you are here (portfolio index)
├── docs/
│   ├── CONVENTIONS.md         ← shared engineering & doc conventions
│   └── PROJECT_TEMPLATE.md    ← the structure every project follows
├── pnpm-workspace.yaml
├── package.json
└── projects/
    ├── 01-ai-voice-agent/
    │   ├── README.md
    │   ├── docs/{PRD.md, TECHNICAL_SPEC.md, ARCHITECTURE.md}
    │   └── (Next.js app scaffold)
    ├── 02-ai-lead-generation/
    └── ... (12 more)
```

Every `projects/NN-*` folder is a **self-contained app** with its own `package.json`, so it can be
run and deployed on its own — or all together from the workspace root.

---

## Quickstart

```bash
# install all workspaces
pnpm install

# run a single project
cd projects/07-ai-chatbot-agent
cp .env.example .env.local   # add your keys
pnpm dev
```

Each project reads its AI provider config from environment variables and routes model calls through
the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) using plain `"provider/model"` strings,
so you can swap models without code changes.

---

## Documentation standard

Each project ships three core documents so it reads like a real product, not a demo:

- **`docs/PRD.md`** — problem, users & personas, user stories, functional/non-functional
  requirements, success metrics, monetization, pricing, GTM, milestones.
- **`docs/TECHNICAL_SPEC.md`** — architecture, data models, API surface, AI/model usage,
  integrations, security, scaling.
- **`docs/ARCHITECTURE.md`** — system diagram (Mermaid), components, data flow, deployment.

See [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) for the full standard.

---

## Status

| # | Project | PRD | Spec | Arch | Scaffold |
|---|---------|-----|------|------|----------|
| 01 | AI Voice Agent | ✅ | ✅ | ✅ | ✅ |
| 02 | AI Lead Generation | ✅ | ✅ | ✅ | ✅ |
| 03 | Faceless AI YouTube Generation | ✅ | ✅ | ✅ | ✅ |
| 04 | AI Content Repurposing | ✅ | ✅ | ✅ | ✅ |
| 05 | AI Consulting | ✅ | ✅ | ✅ | ✅ |
| 06 | AI Virtual Assistant | ✅ | ✅ | ✅ | ✅ |
| 07 | AI Chatbot Agent | ✅ | ✅ | ✅ | ✅ |
| 08 | AI Trading Bot | ✅ | ✅ | ✅ | ✅ |
| 09 | AI Agent Development | ✅ | ✅ | ✅ | ✅ |
| 10 | AI Copywriting | ✅ | ✅ | ✅ | ✅ |
| 11 | AI Venture Studio | ✅ | ✅ | ✅ | ✅ |
| 12 | AI-to-AI Marketplace | ✅ | ✅ | ✅ | ✅ |
| 13 | AI Logo & Brand Design | ✅ | ✅ | ✅ | ✅ |
| 14 | Managed AI Cybersecurity | ✅ | ✅ | ✅ | ✅ |

---

## License

MIT — see [LICENSE](./LICENSE). Built as a portfolio by [@blockchanger](https://github.com/).
