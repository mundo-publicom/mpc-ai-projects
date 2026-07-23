# PRD — AI Voice Agent

## Overview

AI Voice Agent is a platform for standing up production AI phone and web voice
agents. A business configures an agent (persona, script/knowledge, voice,
objective), connects a phone number through a telephony provider (Twilio), and
the agent conducts real, natural spoken conversations — inbound and outbound. It
books appointments, qualifies leads, and handles tier-1 support, with warm
escalation to humans when needed.

Monetization is three-legged: **per-minute usage** on conversation time,
**per-seat SaaS** for the console and integrations, and **one-time setup fees**
for onboarding and custom scripting.

## Problem

- **Missed calls are missed revenue.** Studies of SMB inbound calling
  consistently show a large share of calls go unanswered, especially after
  hours; each missed call for a high-ticket service (dental, HVAC, legal) can be
  hundreds to thousands of dollars in lost lifetime value.
- **Human phone labor is expensive and hard to staff.** Front-desk and tier-1
  support roles have high turnover; coverage across evenings/weekends is costly.
- **Existing IVR is hated.** Touch-tone trees and rigid speech IVRs frustrate
  callers and deflect poorly.
- **DIY LLM voice is hard.** Wiring low-latency STT→LLM→TTS with barge-in,
  telephony, recording consent, and analytics is a serious engineering effort
  most businesses will not undertake.

## Target users & personas

- **Priya — Practice Manager, multi-location dental group.** Wants every call
  answered and appointments booked directly into the calendar without adding
  front-desk headcount. Cares about tone, accuracy, and never double-booking.
- **Marcus — Head of Sales, home-services franchise.** Runs outbound campaigns
  (reactivation, estimate follow-ups) and wants inbound leads qualified and
  routed instantly. Cares about qualification quality and CRM sync.
- **Dana — Support Lead, B2B SaaS.** Wants to deflect password resets, billing,
  and how-to questions from a stretched support team, with clean escalation and
  transcripts. Cares about containment rate and accurate handoffs.
- **Sofia — Agency / integrator (channel).** Resells and configures agents for
  many end clients. Cares about multi-tenant management, white-label, and
  predictable margins.

## User stories

1. As Priya, I can create an agent with a persona and script so it sounds like
   my practice and follows our booking rules.
2. As Priya, I can connect a phone number so inbound callers reach the agent.
3. As a caller, I can interrupt the agent mid-sentence and be understood
   (barge-in), so the conversation feels natural.
4. As Priya, I can have the agent book an appointment into our calendar and
   confirm the time with the caller.
5. As Marcus, I can launch an outbound campaign to a contact list so the agent
   places calls and qualifies leads.
6. As Marcus, I can define qualification criteria (BANT) so the agent captures
   structured answers and marks leads qualified or not.
7. As Dana, I can give the agent a knowledge base so it answers tier-1 questions
   accurately and refuses to invent facts.
8. As Dana, I can configure escalation so the agent warm-transfers to a human
   when confidence is low or the caller is frustrated.
9. As any operator, I can review every call's transcript, summary, outcome, and
   recording (where consent allows).
10. As any operator, I can test-drive an agent in the console before it goes
    live, using the same conversation engine production uses.
11. As any operator, I can see per-call duration and cost so I understand and
    control usage spend.
12. As an admin, I can set recording-consent behavior per region so we stay
    compliant with two-party consent laws.
13. As Sofia, I can manage multiple client organizations from one login with
    isolated data.
14. As any operator, I can set a maximum call length / turn budget so calls
    wrap up gracefully instead of looping.

## Functional requirements

1. **Agent CRUD** — create/edit/delete agents with name, objective, persona,
   script/knowledge, voice (provider + voice ID + rate + language),
   temperature, max turns, transfer settings, active flag.
2. **Number management** — provision/import Twilio numbers, assign an inbound
   agent per number, view capabilities (voice/SMS).
3. **Inbound handling** — telephony webhook answers calls, plays consent notice
   where required, and connects the audio to the real-time loop.
4. **Outbound calling** — place calls to a contact/list with a chosen agent and
   campaign settings; detect voicemail.
5. **Conversation engine** — per caller turn, produce the agent's next spoken
   turn from persona+script+transcript, returning a typed
   `{ reply, done, outcome }` (`POST /api/agent/converse`).
6. **Real-time voice loop** — streaming STT (Deepgram) → LLM (Claude via AI
   Gateway) → streaming TTS (ElevenLabs) over the Twilio media stream, with
   barge-in / interruption handling.
7. **Escalation & transfer** — warm-transfer to a human number on low
   confidence, explicit request, or configured triggers.
8. **Transcripts & summaries** — persist per-turn transcript with timing and STT
   confidence; generate a post-call summary and outcome classification.
9. **Analytics** — dashboard of calls today, containment rate, average handle
   time, outcomes, and usage revenue/cost.
10. **Billing meter** — record billable duration (rounded up per second) and
    compute cost/price per call for invoicing.
11. **Consent & recording controls** — per-region consent behavior; store
    recordings only when permitted; redact PII in transcripts on request.
12. **Console test-drive** — text simulation that exercises the exact
    `converse` path used in production.
13. **Graceful degradation** — with no API keys, the product runs in demo mode
    with realistic mock replies.

## Non-functional requirements

- **Latency:** median caller-perceived response < 900 ms turn-around;
  target < 1.2 s p95 (see latency budget in TECHNICAL_SPEC).
- **Availability:** 99.9% for call handling; telephony webhook must respond
  quickly and always return a safe instruction, even on model failure.
- **Scalability:** thousands of concurrent calls; horizontally scalable media
  workers; stateless HTTP where possible.
- **Security & privacy:** encryption in transit and at rest; PII minimization;
  tenant isolation; SOC 2 Type II target.
- **Reliability of speech:** agent replies must be TTS-safe (short, no markdown,
  numbers spoken naturally) and never claim to be human.
- **Observability:** every call traceable end-to-end with per-stage latency.
- **Cost control:** per-call cost tracked; model tier selectable per agent.

## Success metrics / KPIs

- **Containment rate** (calls resolved without a human): target ≥ 70% for
  tier-1 support agents.
- **Booking conversion** (booked / eligible inbound): target ≥ 45% for
  appointment agents.
- **Answer rate**: ≥ 99% of inbound calls answered within 2 rings.
- **Median turn latency**: < 900 ms.
- **CSAT / caller sentiment**: ≥ 4.2 / 5 post-call (where surveyed).
- **Gross margin on usage**: ≥ 55% blended.
- **Net revenue retention**: ≥ 115% (seat + usage expansion).

## Monetization & pricing

Three revenue legs. Illustrative list pricing (USD):

### Per-minute usage (billed per second, rounded up)

| Tier | Price / min | Notes |
| --- | --- | --- |
| Standard voice | **$0.12** | Sonnet-class model, standard voices |
| Premium voice | **$0.18** | Frontier model and/or premium TTS voice |
| Outbound dialing | **+$0.02/min** | Surcharge for outbound campaigns |

Blended target realized rate ~**$0.14/min**; underlying variable cost
~$0.04–0.06/min (Deepgram STT + Claude tokens + ElevenLabs TTS + Twilio
minutes), leaving strong usage margin.

### Per-seat SaaS (monthly)

| Plan | Price / mo | Included | For |
| --- | --- | --- | --- |
| **Starter** | $99 | 1 agent, 1 number, 500 usage min included, console + transcripts | Solo / single location |
| **Growth** | $399 | 5 agents, 5 numbers, 2,500 min included, calendar + CRM integrations, analytics | SMB / multi-location |
| **Scale** | $1,499 | 25 agents, 25 numbers, 12,000 min included, SSO, roles, priority support | Mid-market |
| **Enterprise** | Custom | Unlimited, white-label, SLA, SOC 2 report, dedicated infra | Large orgs / channel |

Overage on included minutes billed at the per-minute rates above.

### One-time setup / services

- **Guided onboarding & scripting:** $500–$2,500 depending on complexity.
- **Custom integration build:** quoted; typical $2k–$10k.
- **White-label / channel enablement (agencies):** $5k platform fee + revenue share.

## Go-to-market

- **Beachhead verticals:** dental/medical front-desk and home services — high
  ticket value per booked appointment, clear ROI story ("one saved booking pays
  for the month").
- **Motions:** (1) self-serve Starter/Growth via website + interactive demo (the
  console test-drive); (2) sales-assisted for Scale/Enterprise; (3) **agency
  channel** for volume via white-label.
- **Proof:** free 14-day trial with included minutes; live demo call to the
  prospect's own phone during the sales conversation.
- **Content/SEO:** "AI receptionist for <vertical>", ROI calculators, missed-call
  cost tooling.
- **Integrations as distribution:** calendar and CRM marketplaces (HubSpot,
  Cal.com, Google), Twilio ecosystem.

## Competitive landscape

- **Vapi** — developer-first voice-AI orchestration platform; highly flexible,
  API/SDK-centric. Strong for builders; less turnkey for non-technical SMBs.
  *Our edge:* opinionated, vertical, business-user console + done-for-you setup.
- **Bland AI** — infrastructure for programmatic phone calls at scale, strong on
  outbound and self-hosted-feel control. *Our edge:* balanced inbound+outbound
  with vertical workflows (booking/support) and analytics out of the box.
- **Retell AI** — conversation-quality-focused voice agent API with good latency
  and call analytics; developer platform. *Our edge:* packaged SaaS + services +
  channel program, not just an API.
- **Air.ai** — positioned around long, human-like sales/CS calls; brand-heavy.
  *Our edge:* transparent per-minute economics, reliability/consent guardrails,
  and a focused ROI story per vertical rather than a general "human replacement"
  pitch.

General positioning: most incumbents are **developer platforms**. We win the
non-technical buyer with a configurable console, vertical templates, integrated
booking/CRM, transparent pricing, and an agency channel — while remaining
API-accessible for builders.

## Risks & mitigations

- **Latency / unnatural feel.** → Streaming everywhere, barge-in, model-tier
  selection, latency budget with p95 SLO and monitoring.
- **Hallucination / wrong info on support & booking.** → Strict system prompt
  ("never invent beyond script"), grounded knowledge, tool-based booking with
  confirmation, low temperature, escalation on uncertainty.
- **Regulatory: recording consent & robocall/TCPA.** → Per-region consent
  notices, consent storage, opt-out handling, outbound calling-time rules, clear
  AI disclosure, DNC list support.
- **PII exposure.** → PII minimization, redaction, encryption, tenant isolation,
  access controls, configurable recording retention.
- **Provider dependency / outages (Twilio, STT, TTS, model).** → Abstract
  providers behind interfaces; failover voices/models; safe webhook fallback
  that never drops a live call.
- **Cost blowout on usage.** → Per-call cost tracking, budgets/alerts, max turn
  limits, cheaper model tiers.
- **Trust / "creepy AI" perception.** → Always disclose AI when asked, natural
  consent notice, easy human escalation.

## Out of scope (v1)

- Full contact-center / ACD queueing and workforce management.
- Live human co-pilot / whisper coaching UI.
- Multi-language mid-call switching (single configured language per agent in v1).
- Video / avatar agents.
- On-prem / self-hosted deployment.
- Payment collection over the phone (PCI scope) — deferred.

## Milestones / roadmap

- **M0 — Scaffold (this repo).** Console, agent config, `converse` engine,
  telephony webhook stub, demo-mode fallback, docs.
- **M1 — Live calling.** Twilio media-stream worker, Deepgram streaming STT,
  ElevenLabs streaming TTS, barge-in, real inbound calls end-to-end.
- **M2 — Persistence & analytics.** Postgres (agents/calls/transcripts),
  summaries, outcome classification, dashboards, billing meter.
- **M3 — Integrations.** Calendar (Google/Cal.com) booking tool, CRM (HubSpot/
  Salesforce), helpdesk (Zendesk) for support agents.
- **M4 — Outbound & campaigns.** Contact lists, voicemail detection, calling
  windows, DNC compliance.
- **M5 — Scale & compliance.** Multi-tenant orgs, SSO/roles, SOC 2, consent
  management, white-label channel program.
