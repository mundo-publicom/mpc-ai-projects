# PRD — Aide (AI Virtual Assistant)

## Overview

Aide is a personal AI executive assistant. It connects to a user's Gmail,
Google Calendar, and Slack, and acts on natural-language commands: triage the
inbox, manage the calendar, track tasks, draft replies, and run quick research.
Under the hood, a **planner** decomposes each command into a sequence of tool
calls and executes them — with a **human-in-the-loop approval gate** on every
action that changes the outside world. It is sold as **per-seat SaaS**.

## Problem

Knowledge workers — especially founders, executives, and freelancers — spend
25–40% of their week on communication and coordination overhead: sorting email,
scheduling meetings, writing routine replies, and remembering follow-ups. The
work is high-volume, low-leverage, and impossible to fully delegate to a human
assistant at most price points. Existing tools each solve a slice (a calendar
app, an email client, a to-do list, a chatbot) but none *plan and act across all
of them* on the user's behalf. Meanwhile, "AI agents" that act autonomously
create a trust problem: nobody wants a bot silently emailing their investors.

**The gap:** an assistant that (a) works across inbox + calendar + tasks, (b)
plans multi-step actions, and (c) never acts irreversibly without approval.

## Target users & personas

1. **Busy founder ("Alex")** — runs a 20-person startup. 150+ emails/day,
   back-to-back meetings, investors and customers waiting on replies. Needs the
   important 5% surfaced and the routine 95% handled. Willing to pay for time.
2. **Executive ("Priya")** — VP at a mid-size company. Has (or shares) a human
   EA but wants software leverage for the long tail: scheduling, follow-ups,
   drafting. Cares about control, audit, and not embarrassing herself.
3. **Freelancer / solo operator ("Sam")** — juggles many clients, is their own
   ops team, cannot afford a human assistant. Needs inbox triage, scheduling,
   and task capture that just works, cheaply.

## User stories

- As a founder, I can type *"triage my inbox and draft replies to anything
  urgent"* and get a plan with drafts I can approve in one place.
- As an exec, I can say *"find 30 minutes next week for Dana and send an
  invite"* and the assistant proposes slots inside my working hours and stages
  the invite for my OK.
- As a freelancer, I can say *"turn the Acme redline email into a task due
  today"* and it appears on my list, linked to the source thread.
- As any user, I can review every action the assistant wants to take before it
  happens, and approve/reject each one individually.
- As any user, I can set my autonomy level so low-risk actions run
  automatically while sends always require approval.
- As a team admin, I can see an audit log of what the assistant did for each
  seat.

## Functional requirements

1. **Command intake** — accept a free-text command via a command bar and via
   `POST /api/assistant`.
2. **Planning** — decompose the command into an ordered `ActionPlan` of
   `ToolCall`s using an AI tool-calling loop.
3. **Tools** — support inbox (search, draft, send), calendar (list, find slot,
   create event), tasks (list, create, complete), research (web), and Slack
   (send). Each tool has a typed input schema.
4. **Read/write separation** — read tools execute during planning; write tools
   are staged and returned as `awaiting_approval`.
5. **Approval** — the user approves or rejects each staged write; approved
   writes execute for real via a commit endpoint.
6. **Autonomy levels** — `suggest`, `approve_writes`, `autopilot` (autopilot
   auto-runs low-risk writes but still gates sends).
7. **Inbox triage** — classify threads by priority and recommend an action.
8. **Unified dashboard** — one view of today's tasks, calendar, inbox triage,
   and the live action-plan/approval panel.
9. **Tone control** — drafts written in the user's configured tone.
10. **Graceful degradation** — full functionality (mock planner + demo data)
    with no API keys configured.
11. **Integrations** — OAuth connect flows for Gmail, Google Calendar, Slack
    (post-scaffold; scaffold uses mock adapters).

## Non-functional requirements

- **Latency:** plan returned in < 6 s p95; approval commit < 2 s p95.
- **Reliability:** a model/tool error degrades to a usable plan, never a 500 to
  the user; no partial writes without a recorded status.
- **Security & privacy:** least-privilege OAuth scopes; per-user token
  encryption; email/calendar contents never used for cross-tenant training.
- **Auditability:** every executed write is logged with actor, input, outcome.
- **Accessibility:** keyboard-operable command bar and approval controls; WCAG
  AA contrast.
- **Portability:** Node.js runtime only; no edge-only APIs.

## Success metrics / KPIs

- **Hours saved / week / seat** (self-reported + estimated from actions) —
  north-star; target ≥ 5 hrs by day 30.
- **Tasks auto-completed / week** — target ≥ 25 per active seat.
- **Inbox-zero rate** — % of active days a user ends at zero unread in the
  triaged set; target ≥ 60%.
- **Approval acceptance rate** — % of staged writes approved (a trust proxy);
  healthy band 70–90% (too low = bad drafts, too high = gate is theater).
- **Activation:** % of signups who connect ≥ 1 account and run ≥ 3 commands.
- **Retention:** week-4 seat retention ≥ 55%; net revenue retention ≥ 115%.

## Monetization & pricing

Per-seat SaaS with a usage ceiling on lower tiers.

| Plan | Price | Limits |
| --- | --- | --- |
| Free | $0 | 1 account, read-only triage, 20 commands/mo |
| Pro | $30 / seat / mo | All tools, unlimited approvals, 3 accounts |
| Team | $25 / seat / mo (min 5) | Shared context, delegation, admin + audit |
| Enterprise | Custom | SSO/SAML, audit export, data residency, policy engine |

Expansion levers: seat growth (Team), research/agent-run overage packs, and
premium model tiers for heavy users. Gross-margin lever: route routine planning
to a fast model, escalate only ambiguous commands to a frontier model.

## Go-to-market

- **Wedge:** inbox triage — the most visceral daily pain; free tier delivers it
  read-only to prove value fast.
- **Motion:** PLG. Self-serve signup → connect Gmail → first "wow" within 5
  minutes (a triaged inbox + one great draft).
- **Channels:** founder/exec communities, X/LinkedIn build-in-public, and
  productivity newsletters. Team plan via bottoms-up seat expansion.
- **Positioning:** "An assistant that *acts*, that you can *trust*." Lead with
  the approval model against fully-autonomous competitors.

## Competitive landscape

| Product | Focus | Where Aide wins |
| --- | --- | --- |
| **Motion** | AI calendar/task auto-scheduling | Aide spans email + Slack + research, not just scheduling, and shows an explicit approval layer. |
| **Martin** | Voice-first personal AI assistant | Aide is workspace-integrated with a visible plan/approval UI and team features. |
| **Lindy** | Build-your-own AI agents/workflows | Aide is a batteries-included assistant, not a builder — faster time-to-value for non-technical users. |
| **Cal AI / Cal.com AI** | AI scheduling on top of Cal.com | Aide is calendar-agnostic and handles the full inbox+task surface, not scheduling alone. |

General assistants (ChatGPT, Copilot) chat but don't natively act across a
user's connected email/calendar with an approval gate; that integration +
trust layer is the moat.

## Risks & mitigations

- **Privacy & trust (highest).** Users grant access to their most sensitive
  data. *Mitigation:* least-privilege scopes, encryption at rest, transparent
  data policy, no cross-tenant training, SOC 2 on the roadmap, and a clear
  in-product data map.
- **Action safety / wrong actions.** A bad send is unrecoverable. *Mitigation:*
  the human-in-the-loop approval model is the core design; sends always gate,
  previews are explicit, and every action is reversible-by-review before commit.
- **Hallucinated content.** Model invents facts in a draft. *Mitigation:* the
  planner is instructed to read context before writing and never invent details;
  drafts always shown before send; citations required for research.
- **Over-automation erodes trust.** Autopilot that gets it wrong loses the user.
  *Mitigation:* conservative defaults (`approve_writes`), acceptance-rate
  monitoring, easy per-tool policy.
- **Integration fragility.** Provider API/permission changes. *Mitigation:*
  adapter layer isolating each integration; graceful mock fallback.
- **Cost.** Frontier-model planning is expensive. *Mitigation:* tiered model
  routing; cache dashboard reads; cap free-tier usage.

## Out of scope (v1)

- Autonomous action with no approval path for irreversible sends.
- Non-Google email (Outlook/Exchange) and non-Slack chat (Teams) — later.
- Voice interface.
- CRM / project-management deep integrations (Salesforce, Jira).
- Multi-language drafting beyond English.
- Mobile native apps (responsive web only in v1).

## Milestones / roadmap

- **M0 — Scaffold (this repo):** command → plan → approve → commit loop with
  mock adapters, real AI SDK tool-calling, unified dashboard. ✅
- **M1 — Live Gmail + Calendar:** OAuth, real read/write, Postgres persistence,
  audit log.
- **M2 — Slack + research:** Slack send/read, real web research tool, morning
  brief (proactive triage run).
- **M3 — Teams:** shared context, delegation, admin console, per-tool policy.
- **M4 — Trust & scale:** SOC 2, SSO/SAML, tone-learning, model-routing cost
  controls, data-residency options.
