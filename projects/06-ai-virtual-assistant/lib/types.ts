/**
 * Domain types for the AI Virtual Assistant.
 *
 * These mirror the persisted data models described in docs/TECHNICAL_SPEC.md.
 * Zod schemas that validate API inputs live alongside the routes that use them
 * (see app/api/assistant/route.ts) and the tool signatures (see lib/tools.ts),
 * but the canonical TypeScript shapes are defined here so UI, API, tools, and
 * the planner all speak the same language.
 */

/* ------------------------------------------------------------------ */
/* Enums / unions                                                      */
/* ------------------------------------------------------------------ */

export type SeatPlan = "free" | "pro" | "team" | "enterprise";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "email" | "calendar" | "assistant";

export type EmailPriority = "urgent" | "important" | "normal" | "low";
/** How the triage engine recommends the human handle a thread. */
export type TriageAction =
  | "reply"
  | "delegate"
  | "schedule"
  | "archive"
  | "unsubscribe"
  | "read_later";

/** The families of tools the planner can call. */
export type ToolName =
  | "search_email"
  | "draft_reply"
  | "send_email"
  | "list_calendar"
  | "create_event"
  | "find_meeting_slot"
  | "create_task"
  | "list_tasks"
  | "complete_task"
  | "web_research"
  | "send_slack";

/** Lifecycle of a single tool call inside an action plan. */
export type ToolCallStatus =
  | "planned" // decided by the planner, not yet run
  | "awaiting_approval" // gated: a human must approve before execution
  | "approved"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"; // a human declined the action

export type ActionPlanStatus =
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "partially_completed"
  | "failed";

/** Whether a tool mutates the outside world (and therefore needs approval). */
export type ToolEffect = "read" | "write";

/* ------------------------------------------------------------------ */
/* User                                                                */
/* ------------------------------------------------------------------ */

export interface UserConnections {
  gmail: boolean;
  googleCalendar: boolean;
  slack: boolean;
}

export interface UserPreferences {
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  /** Working hours used when the assistant proposes meeting slots. */
  workdayStart: string; // "09:00"
  workdayEnd: string; // "18:00"
  /**
   * Autonomy level. `suggest` = never acts without approval,
   * `approve_writes` = read actions run freely but writes are gated,
   * `autopilot` = executes low-risk writes automatically.
   */
  autonomy: "suggest" | "approve_writes" | "autopilot";
  /** Preferred tone the assistant uses when drafting replies. */
  writingTone: "professional" | "warm" | "concise" | "casual";
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  plan: SeatPlan;
  connections: UserConnections;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Task                                                                */
/* ------------------------------------------------------------------ */

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO 8601 due date, if any. */
  dueAt?: string;
  /** Where the task originated. */
  source: TaskSource;
  /** Back-reference to the email/event that spawned it. */
  sourceRef?: string;
  /** Minutes the assistant estimates the task will take. */
  estimateMin?: number;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus: "accepted" | "declined" | "tentative" | "needs_action";
  optional?: boolean;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  /** Provider-side id, e.g. a Google Calendar event id. */
  providerId?: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601. */
  startAt: string;
  endAt: string;
  /** IANA timezone the event is defined in. */
  timezone: string;
  allDay: boolean;
  attendees: EventAttendee[];
  /** Video/meeting link, if generated. */
  conferenceUrl?: string;
  organizerEmail: string;
  status: "confirmed" | "tentative" | "cancelled";
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export interface EmailMessage {
  id: string;
  fromEmail: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  /** Plain-text snippet used for triage and drafting context. */
  snippet: string;
  /** Full body, lazily loaded (often omitted in list views). */
  body?: string;
  sentAt: string;
}

export interface EmailThread {
  id: string;
  userId: string;
  /** Provider-side thread id, e.g. a Gmail thread id. */
  providerThreadId?: string;
  subject: string;
  /** Messages oldest-first; the last one is what a reply responds to. */
  messages: EmailMessage[];
  unread: boolean;
  /** Model-assigned triage priority. */
  priority: EmailPriority;
  /** Recommended handling for the human. */
  recommendedAction: TriageAction;
  /** One-line, model-generated summary of what the thread needs. */
  summary: string;
  labels: string[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Tool calls & action plans                                           */
/* ------------------------------------------------------------------ */

/**
 * A single step the planner decided to take. The planner emits `toolName` +
 * `input`; the executor fills in `status`, `output`, and timing. Write actions
 * pass through `awaiting_approval` unless the user's autonomy setting or the
 * tool's own risk level allows auto-execution.
 */
export interface ToolCall {
  id: string;
  /** Ordinal within the plan (1-based), for display. */
  step: number;
  toolName: ToolName;
  effect: ToolEffect;
  /** Whether this specific call is gated behind human approval. */
  requiresApproval: boolean;
  /** Arguments the planner produced for the tool. */
  input: Record<string, unknown>;
  status: ToolCallStatus;
  /** Structured result returned by the tool executor. */
  output?: unknown;
  /** Human-readable one-liner describing the effect (for the approval UI). */
  summary: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ActionPlan {
  id: string;
  userId: string;
  /** The natural-language command the user issued. */
  command: string;
  /** The planner's short restatement of what it intends to accomplish. */
  intent: string;
  status: ActionPlanStatus;
  /** Ordered steps. */
  steps: ToolCall[];
  /** Final natural-language summary the assistant reports back. */
  reply: string;
  /** True when produced by the mock fallback (no API key configured). */
  mocked: boolean;
  /** Total wall-clock model + tool time in ms. */
  latencyMs: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* API contracts (shared request/response shapes)                      */
/* ------------------------------------------------------------------ */

/** Request body for POST /api/assistant. */
export interface AssistantRequest {
  /** The natural-language command, e.g. "Clear my inbox and prep for the 3pm". */
  command: string;
  /**
   * Approval decisions for a previously-returned plan. When present, the route
   * executes (or rejects) the referenced steps instead of planning anew.
   */
  approvals?: { toolCallId: string; approved: boolean }[];
  /** Optional id of the plan the approvals belong to. */
  planId?: string;
}

/** Response body for POST /api/assistant. */
export interface AssistantResponse {
  plan: ActionPlan;
}

/** Snapshot the dashboard hydrates from (today's world for the demo user). */
export interface DashboardData {
  user: User;
  tasks: Task[];
  events: CalendarEvent[];
  threads: EmailThread[];
}
