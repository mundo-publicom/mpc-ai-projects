# Technical Spec — Aide (AI Virtual Assistant)

## System overview

Aide is a Next.js 15 (App Router) application on the Node.js runtime. The
browser renders a dashboard (Server Component shell + client workspace). All
intelligence lives behind one API route, `POST /api/assistant`, which runs a
**planner** — an AI SDK v5 `generateText` tool-calling loop — that turns a
natural-language command into an `ActionPlan` of typed `ToolCall`s. Read tools
execute inside the loop; write tools are **staged** and returned for human
approval; a follow-up request **commits** approved writes for real.

Everything degrades gracefully: with no `AI_GATEWAY_API_KEY`, a deterministic
mock planner produces the same `ActionPlan` shape over an in-memory demo world,
so the full loop is exercisable with zero keys.

## Component breakdown

| Component | Location | Responsibility |
| --- | --- | --- |
| Dashboard shell | `app/page.tsx` | Server Component; loads today's world, passes to workspace. |
| Workspace | `components/AssistantWorkspace.tsx` | Client; owns command + plan state, renders columns + panel, calls the API. |
| Command bar | `components/CommandBar.tsx` | Client; free-text input + suggestions. |
| Task list | `components/TaskList.tsx` | Presentational task column. |
| Action-plan panel | `components/ActionPlanPanel.tsx` | Client; renders plan, per-step status, approval controls. |
| Assistant API | `app/api/assistant/route.ts` | Plan mode + commit mode; zod-validated. |
| Model layer | `lib/ai.ts` | Model routing (Gateway), planner system prompt, `hasAI()`. |
| Toolbox | `lib/tools.ts` | Typed tool fns + AI SDK `tool()` defs + `commitToolCall`. |
| Domain types | `lib/types.ts` | Canonical shapes for UI/API/tools. |
| Demo store | `lib/mock-data.ts` | In-memory world + plan cache (Postgres in prod). |

## Data models (typed)

Canonical definitions live in [`lib/types.ts`](../lib/types.ts). Summary:

```ts
interface User {
  id; orgId; email; name;
  plan: "free" | "pro" | "team" | "enterprise";
  connections: { gmail; googleCalendar; slack: boolean };
  preferences: {
    timezone; workdayStart; workdayEnd;
    autonomy: "suggest" | "approve_writes" | "autopilot";
    writingTone: "professional" | "warm" | "concise" | "casual";
  };
  createdAt; updatedAt;
}

interface Task {
  id; userId; title; notes?;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueAt?; source: "manual" | "email" | "calendar" | "assistant";
  sourceRef?; estimateMin?; labels: string[]; createdAt; updatedAt;
}

interface CalendarEvent {
  id; userId; providerId?; title; description?; location?;
  startAt; endAt; timezone; allDay;
  attendees: { email; name?; responseStatus; optional? }[];
  conferenceUrl?; organizerEmail; status; createdAt;
}

interface EmailThread {
  id; userId; providerThreadId?; subject;
  messages: { id; fromEmail; fromName?; to; cc?; snippet; body?; sentAt }[];
  unread;
  priority: "urgent" | "important" | "normal" | "low";
  recommendedAction: "reply" | "delegate" | "schedule" | "archive" | "unsubscribe" | "read_later";
  summary; labels: string[]; updatedAt;
}

interface ToolCall {
  id; step; toolName: ToolName; effect: "read" | "write";
  requiresApproval; input: Record<string, unknown>;
  status: "planned" | "awaiting_approval" | "approved" | "running" | "succeeded" | "failed" | "rejected";
  output?; summary; error?; startedAt?; finishedAt?;
}

interface ActionPlan {
  id; userId; command; intent;
  status: "planning" | "awaiting_approval" | "executing" | "completed" | "partially_completed" | "failed";
  steps: ToolCall[]; reply; mocked; latencyMs; createdAt;
}
```

In production these map to Postgres tables (`users`, `tasks`,
`calendar_events`, `email_threads`, `action_plans`, `tool_calls` as an audit
log). OAuth tokens live in a separate encrypted `connections` table.

## API surface

### `POST /api/assistant`

Two modes, discriminated by the body.

**Plan mode** — request:
```jsonc
{ "command": "Triage my inbox and draft replies to anything urgent" }
```

**Commit mode** — request (approves/rejects steps from a returned plan):
```jsonc
{
  "command": "…",              // echoed back for context
  "planId": "plan_ab12cd3",
  "approvals": [
    { "toolCallId": "call_x1", "approved": true },
    { "toolCallId": "call_x2", "approved": false }
  ]
}
```

Response (both modes) — `{ plan: ActionPlan }`:
```jsonc
{
  "plan": {
    "id": "plan_ab12cd3",
    "command": "…",
    "intent": "Triage unread mail and prepare replies.",
    "status": "awaiting_approval",
    "steps": [
      { "id": "call_1", "step": 1, "toolName": "search_email",
        "effect": "read", "requiresApproval": false,
        "input": { "unreadOnly": true }, "status": "succeeded",
        "output": [ /* hits */ ], "summary": "Search inbox (unread)" },
      { "id": "call_2", "step": 2, "toolName": "draft_reply",
        "effect": "write", "requiresApproval": true,
        "input": { "threadId": "thr_1", "body": "Hi Jordan …" },
        "status": "awaiting_approval", "summary": "Draft a reply on thread thr_1" }
    ],
    "reply": "I read your 4 unread threads and drafted a reply to Sequoia. Approve to send.",
    "mocked": false,
    "latencyMs": 3120
  }
}
```

Validation: `zod` (`RequestSchema`); malformed body → 400 with issues; unknown
`planId` in commit mode → 404. Runtime: `nodejs`.

The dashboard hydrates from a server-side `getDashboardData()` snapshot (no
separate GET route in the scaffold; production exposes `GET /api/dashboard`).

## AI / model usage

- **SDK:** Vercel AI SDK v5 (`ai@^5`). Models via the Vercel AI Gateway using
  `"provider/model"` strings — no provider SDK wired in.
- **Model tiers** (`lib/ai.ts`): `fast` = `anthropic/claude-haiku-4-5`,
  `smart` = `anthropic/claude-sonnet-5` (the planner default), `frontier` =
  `anthropic/claude-opus-4-8`.
- **Planner loop:**
  ```ts
  const { text, steps } = await generateText({
    model: PLANNER_MODEL,               // anthropic/claude-sonnet-5
    system: PLANNER_SYSTEM_PROMPT,
    tools: assistantTools,              // AI SDK tool() defs, zod inputSchema
    stopWhen: stepCountIs(8),           // multi-step tool loop
    temperature: 0.3,
    prompt: `${userContext}\n${command}`,
  });
  ```
  The model reads context (search_email, list_calendar, list_tasks,
  find_meeting_slot, web_research) and proposes writes (draft_reply, send_email,
  create_event, create_task, complete_task, send_slack). We flatten
  `steps.flatMap(s => s.toolCalls)` and match `s.toolResults` by `toolCallId` to
  build the `ToolCall[]`.
- **Tool definitions:** each tool is `tool({ description, inputSchema:
  z.object(...), execute })`. Write-tool `execute` runs in *staged* mode —
  returns `{ staged: true, preview }` and mutates nothing. Read-tool `execute`
  returns live data.
- **Determinism:** low temperature (0.3) for stable planning. Where structured
  output is needed elsewhere (e.g. triage scoring), `generateObject` with a zod
  schema is used (see roadmap).
- **Fallback:** `hasAI()` false → `mockPlan()` builds the same `ActionPlan`
  shape via keyword routing, so the UI and HITL flow are identical.

## Human-in-the-loop approval model

1. **Plan.** Planner emits tool calls. Reads execute inline (`succeeded`).
2. **Stage.** Each write becomes a `ToolCall` with `status:
   "awaiting_approval"` and `requiresApproval` derived from tool metadata +
   the user's autonomy (`autopilot` auto-runs low-risk writes but still gates
   `send_email` / `send_slack`).
3. **Return.** `ActionPlan.status = "awaiting_approval"`, cached by `planId`.
4. **Decide.** UI shows previews; user approves/rejects per step.
5. **Commit.** Commit-mode request runs `commitToolCall()` for approved steps
   (real side effect), marks rejected steps `rejected`, recomputes plan status
   (`completed` / `partially_completed` / `failed`).

This guarantees no irreversible action fires without an explicit human decision.

## Third-party integrations

| Integration | Scopes / creds | Used by |
| --- | --- | --- |
| Gmail | `gmail.modify` (read, label, draft, send) | search_email, draft_reply, send_email |
| Google Calendar | `calendar` | list_calendar, find_meeting_slot, create_event |
| Slack | bot token, `chat:write`, `channels:history` | send_slack |
| Web research | server-side fetch / search provider | web_research |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | planner |

In the scaffold these are mock adapters over `lib/mock-data.ts`. Production
isolates each behind an adapter module so a provider change never leaks into the
planner. OAuth handled via `/api/oauth/{provider}/callback` (roadmap).

## Security & privacy

- Least-privilege OAuth; tokens encrypted at rest (KMS-managed key), never
  logged.
- Per-tenant isolation; email/calendar content excluded from model training.
- Write actions are gated + audited (`tool_calls` rows record actor, input,
  output, timestamps).
- Input validated with zod at the API boundary; outputs are typed JSON.
- Secrets only via env (`.env.example` → `.env.local`); none committed.
- Sends always require approval regardless of autonomy — a hard safety rail.

## Observability

- Structured logs per plan: `planId`, model, `latencyMs`, step count, tool
  names, mocked flag, finish reason.
- Metrics: plan latency (p50/p95), tool-call volume by tool, approval
  acceptance rate, error/degrade rate, tokens & cost per plan.
- Audit log: every committed write with before/after where applicable.
- Tracing: AI SDK step callbacks (`onStepEnd`) feed per-step spans in prod.

## Scaling considerations

- Stateless API on Fluid Compute; horizontal scale is trivial. The demo's
  in-memory plan cache becomes Postgres/Redis in prod (plans are short-lived).
- Model cost controlled by tier routing (Haiku for routine, Sonnet default,
  Opus only for ambiguous commands) and by caching dashboard reads.
- Provider rate limits absorbed by the Gateway; per-tenant quotas enforce fair
  use and back the usage-tier pricing.
- Long-running / proactive runs (morning brief) move to a queue + cron.

## Testing strategy

- **Unit:** tool functions (`searchEmail`, `findMeetingSlot`, `buildTask/Event`,
  `commitToolCall`) — deterministic, no network.
- **Contract:** `RequestSchema` validation; API returns typed `AssistantResponse`
  in both modes; 400/404 paths.
- **Planner (mock):** `mockPlan` produces valid `ActionPlan`s across command
  categories (inbox/calendar/task/research); write steps always
  `awaiting_approval`.
- **Planner (live, gated CI):** golden commands asserted to call expected tools
  and never claim a send happened.
- **HITL:** commit mode approves subset → correct `succeeded`/`rejected`/status
  transitions; unknown `planId` → 404.
- **E2E:** command → plan → approve → committed, in mock mode (no keys), via
  Playwright against the dashboard.
- **Typecheck/lint:** `tsc --noEmit` (strict) + `next lint` in CI.
