# Aide — AI Virtual Assistant

> A personal AI executive assistant that triages your inbox, manages your
> calendar, tracks your tasks, drafts your replies, and researches on command —
> planning multi-step actions and using real tools, with a human-in-the-loop
> approval gate on every action that touches the outside world.

## Business case

Knowledge workers lose **~9 hours a week** to inbox and calendar overhead. Aide
sells that time back. It is a **per-seat SaaS**: individuals and teams pay a
monthly subscription for an assistant that connects to their Gmail, Google
Calendar, and Slack and actually *does the work* — not just chat about it.

| Plan | Price | Who it's for |
| --- | --- | --- |
| **Free** | $0 | 1 connected account, read-only triage, 20 commands/mo — the top of funnel |
| **Pro** | **$30 / seat / mo** | Founders, execs, freelancers — full tool access + approvals |
| **Team** | **$25 / seat / mo** (min 5) | Shared context, delegation, admin controls |
| **Enterprise** | Custom | SSO, audit logs, data residency, per-tool policy |

Because value is measured in **hours saved per week**, the ROI story writes
itself: one Pro seat that saves 5 hours/month pays for itself many times over.
Expansion revenue comes from seats (teams) and usage tiers (research/agent runs).

## What it does

- **Inbox triage** — scores every unread thread (urgent / important / normal /
  low) and recommends an action: reply, delegate, schedule, archive, unsubscribe.
- **Calendar management** — reads your day, finds open slots inside your working
  hours, and drafts invites.
- **Task tracking** — turns emails and meetings into tasks with priorities and
  due dates; completes them on command.
- **Drafting** — writes replies in *your* tone; nothing is sent without approval.
- **Research** — pulls a quick synthesized briefing to fold into a reply or doc.
- **Planning + tools** — a planner decomposes a natural-language command into a
  sequence of tool calls, runs the safe (read) ones, and stages the risky
  (write) ones for your approval.

## The human-in-the-loop model (the trust unlock)

Aide never silently sends an email or edits your calendar. The planner runs a
tool-calling loop where **read** tools execute freely, but **write** tools
execute in *staged* mode — they return a preview of what *would* happen. Those
steps come back marked `awaiting_approval`. You approve or reject each one; only
then does the real side effect fire. Autonomy is configurable per user
(`suggest` → `approve_writes` → `autopilot`).

## Architecture at a glance

```
Command → /api/assistant → Planner (AI SDK generateText + tools, stopWhen)
        → reads run inline · writes staged → ActionPlan (awaiting_approval)
        → user approves → commit real side effects → updated ActionPlan
```

Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md), and
[`docs/PRD.md`](docs/PRD.md).

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # optional — runs in mock mode with no keys
pnpm dev                     # http://localhost:3000
```

- **With no keys**, the app boots against an in-memory demo world and a
  deterministic mock planner, so the entire command → plan → approve → execute
  loop is fully clickable.
- **With `AI_GATEWAY_API_KEY` set**, `/api/assistant` uses the real AI SDK v5
  tool-calling planner (`anthropic/claude-sonnet-5` via the Vercel AI Gateway).

Try a command like *"Triage my inbox and draft replies to anything urgent"* or
*"Find a 30-min slot next week for Dana and send an invite"*.

## Tech

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Vercel AI SDK v5
tool-calling · zod-validated APIs · Node.js runtime (Fluid Compute).

Key files:

- `app/api/assistant/route.ts` — the real planner + approval/commit endpoint.
- `lib/tools.ts` — typed tool functions + AI SDK `tool()` definitions.
- `lib/ai.ts` — model routing + planner system prompt.
- `lib/types.ts` — the domain model (User, Task, CalendarEvent, EmailThread,
  ActionPlan, ToolCall).
- `components/` — `CommandBar`, `TaskList`, `ActionPlanPanel`, workspace.

## Roadmap

1. **Real integrations** — Gmail / Google Calendar / Slack OAuth + live sync.
2. **Persistence** — Postgres for users, tasks, plans, and an audit log.
3. **Learning tone** — fine-tune drafting on the user's sent mail.
4. **Proactive mode** — scheduled triage runs that surface a morning brief.
5. **Delegation** — route tasks to teammates or other agents.
6. **Policy engine** — per-tool, per-recipient approval rules for teams.
