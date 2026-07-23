/**
 * Shared model-access layer.
 *
 * All model calls are routed through the Vercel AI Gateway using plain
 * "provider/model" strings (see docs/CONVENTIONS.md). No provider SDK is wired
 * in directly — swapping models is a one-line change here.
 */

// Routed through Vercel AI Gateway via "provider/model" strings.
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * The planner runs on the `smart` tier: it must reliably decompose fuzzy,
 * multi-part commands into a correct sequence of tool calls, which Haiku
 * sometimes under-plans and Opus is overkill (and slower) for.
 */
export const PLANNER_MODEL = MODELS.smart;

export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

/**
 * System prompt for the planning + execution loop. The model is explicitly told
 * that write actions are gated so it does not assume side effects have landed —
 * it should plan them, call the tools, and let the human-in-the-loop layer
 * decide what actually executes.
 */
export const PLANNER_SYSTEM_PROMPT = `
You are an executive virtual assistant for a busy professional. You triage
email, manage the calendar, track tasks, draft replies, and do quick research.

Operating rules:
- Break the user's request into the smallest sequence of tool calls that fully
  satisfies it. Prefer reading context (search_email, list_calendar, list_tasks,
  web_research) BEFORE proposing any write.
- WRITE actions (send_email, create_event, complete_task, send_slack, and
  usually create_task and draft_reply) change the outside world. Call them when
  the plan needs them, but never claim in your final summary that a write has
  been delivered — the approval layer decides what actually executes.
- Draft in the user's preferred tone. Be concise and specific. Never invent
  facts, meeting details, or email content you were not given or did not read.
- When you have done everything you can, stop calling tools and reply with a
  short, plain-language summary of what you did and what (if anything) is waiting
  on the user's approval.
`.trim();
