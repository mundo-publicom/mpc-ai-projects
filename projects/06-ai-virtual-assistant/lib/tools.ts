/**
 * The assistant's toolbox.
 *
 * Two layers live here:
 *
 *   1. Plain, typed functions (searchEmail, listCalendar, createTask, …) that
 *      encapsulate the domain logic against the demo store. In production these
 *      call Gmail / Google Calendar / Slack; here they are deterministic mocks.
 *
 *   2. AI SDK v5 `tool()` definitions (assistantTools) that wrap layer 1 with
 *      zod input schemas so the planner can call them in a generateText loop.
 *
 * Human-in-the-loop model:
 *   - READ tools execute freely inside the planning loop and return live data.
 *   - WRITE tools execute in "staged" mode inside the loop: they return a
 *     preview of what WOULD happen and do NOT mutate anything. The API route
 *     marks those steps `awaiting_approval`. A follow-up approval request calls
 *     `commitToolCall`, which performs the real mutation. This keeps the model
 *     from ever silently sending an email or editing a calendar.
 */

import { tool } from "ai";
import { z } from "zod";
import { store, DEMO_USER } from "@/lib/mock-data";
import type {
  CalendarEvent,
  Task,
  ToolCall,
  ToolEffect,
  ToolName,
  TaskPriority,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Tool metadata: effect + whether a human must approve                */
/* ------------------------------------------------------------------ */

export interface ToolMeta {
  effect: ToolEffect;
  /** Baseline gating; the route may relax it under `autopilot` autonomy. */
  requiresApproval: boolean;
  /** Short label for the UI. */
  label: string;
}

export const TOOL_META: Record<ToolName, ToolMeta> = {
  search_email: { effect: "read", requiresApproval: false, label: "Search email" },
  draft_reply: { effect: "write", requiresApproval: true, label: "Draft reply" },
  send_email: { effect: "write", requiresApproval: true, label: "Send email" },
  list_calendar: { effect: "read", requiresApproval: false, label: "List calendar" },
  create_event: { effect: "write", requiresApproval: true, label: "Create event" },
  find_meeting_slot: { effect: "read", requiresApproval: false, label: "Find meeting slot" },
  create_task: { effect: "write", requiresApproval: true, label: "Create task" },
  list_tasks: { effect: "read", requiresApproval: false, label: "List tasks" },
  complete_task: { effect: "write", requiresApproval: true, label: "Complete task" },
  web_research: { effect: "read", requiresApproval: false, label: "Web research" },
  send_slack: { effect: "write", requiresApproval: true, label: "Send Slack message" },
};

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/* ------------------------------------------------------------------ */
/* Layer 1 — typed domain functions (mocks over the demo store)        */
/* ------------------------------------------------------------------ */

export interface EmailHit {
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  priority: string;
  recommendedAction: string;
}

export function searchEmail(args: { query?: string; unreadOnly?: boolean }): EmailHit[] {
  const q = (args.query ?? "").toLowerCase();
  return store
    .getThreads()
    .filter((t) => (args.unreadOnly ? t.unread : true))
    .filter((t) =>
      q
        ? (t.subject + t.summary + t.messages.map((m) => m.snippet).join(" "))
            .toLowerCase()
            .includes(q)
        : true,
    )
    .map((t) => ({
      threadId: t.id,
      subject: t.subject,
      from: t.messages[t.messages.length - 1]?.fromName ?? t.messages[0]?.fromEmail ?? "",
      snippet: t.messages[t.messages.length - 1]?.snippet ?? "",
      priority: t.priority,
      recommendedAction: t.recommendedAction,
    }));
}

export function listCalendar(args: { onDate?: string }): CalendarEvent[] {
  const day = args.onDate ? args.onDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return store
    .getEvents()
    .filter((e) => e.startAt.slice(0, 10) === day)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export interface Slot {
  startAt: string;
  endAt: string;
}

/** Naive slot finder: proposes open 30-min windows inside working hours. */
export function findMeetingSlot(args: {
  durationMin?: number;
  daysAhead?: number;
}): Slot[] {
  const duration = args.durationMin ?? 30;
  const days = args.daysAhead ?? 7;
  const [startH] = DEMO_USER.preferences.workdayStart.split(":").map(Number);
  const [endH] = DEMO_USER.preferences.workdayEnd.split(":").map(Number);
  const slots: Slot[] = [];
  for (let d = 1; d <= days && slots.length < 3; d++) {
    for (let h = startH; h + duration / 60 <= endH && slots.length < 3; h++) {
      const start = new Date();
      start.setDate(start.getDate() + d);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + duration * 60_000);
      const clash = store
        .getEvents()
        .some((e) => start.toISOString() < e.endAt && end.toISOString() > e.startAt);
      if (!clash && h >= 9 && h <= 11) {
        slots.push({ startAt: start.toISOString(), endAt: end.toISOString() });
      }
    }
  }
  return slots;
}

export function listTasks(args: { status?: string }): Task[] {
  return store
    .getTasks()
    .filter((t) => (args.status ? t.status === args.status : true));
}

/** Builds (but only the executor commits) a new task. */
export function buildTask(args: {
  title: string;
  priority?: TaskPriority;
  dueAt?: string;
  notes?: string;
}): Task {
  const nowIso = new Date().toISOString();
  return {
    id: uid("tsk"),
    userId: DEMO_USER.id,
    title: args.title,
    notes: args.notes,
    status: "todo",
    priority: args.priority ?? "medium",
    dueAt: args.dueAt,
    source: "assistant",
    labels: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function buildEvent(args: {
  title: string;
  startAt: string;
  endAt: string;
  attendees?: string[];
  description?: string;
}): CalendarEvent {
  return {
    id: uid("evt"),
    userId: DEMO_USER.id,
    title: args.title,
    description: args.description,
    startAt: args.startAt,
    endAt: args.endAt,
    timezone: DEMO_USER.preferences.timezone,
    allDay: false,
    attendees: (args.attendees ?? []).map((email) => ({
      email,
      responseStatus: "needs_action" as const,
    })),
    organizerEmail: DEMO_USER.email,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
}

export interface ResearchResult {
  query: string;
  summary: string;
  sources: { title: string; url: string }[];
}

/** Mock research — deterministic, no network. Real impl calls a web tool. */
export function webResearch(args: { query: string }): ResearchResult {
  return {
    query: args.query,
    summary: `Synthesized briefing for "${args.query}": 3 key points gathered from recent sources, ready to fold into a reply or doc.`,
    sources: [
      { title: `Overview — ${args.query}`, url: "https://example.com/a" },
      { title: `Latest developments — ${args.query}`, url: "https://example.com/b" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Layer 2 — AI SDK tool definitions                                   */
/* ------------------------------------------------------------------ */

/**
 * Write tools execute in "staged" mode: they return a preview object and set
 * `staged: true`. They intentionally do NOT mutate the store. The commit
 * happens in `commitToolCall` after human approval.
 */
export const assistantTools = {
  search_email: tool({
    description: "Search the user's inbox for threads matching a query. Read-only.",
    inputSchema: z.object({
      query: z.string().optional().describe("Keywords, sender, or subject to match."),
      unreadOnly: z.boolean().optional().describe("Only return unread threads."),
    }),
    execute: async (input) => searchEmail(input),
  }),

  list_calendar: tool({
    description: "List the user's calendar events on a given date (defaults to today). Read-only.",
    inputSchema: z.object({
      onDate: z.string().optional().describe("ISO date, e.g. 2026-07-23."),
    }),
    execute: async (input) => listCalendar(input),
  }),

  find_meeting_slot: tool({
    description: "Find open meeting slots inside the user's working hours. Read-only.",
    inputSchema: z.object({
      durationMin: z.number().int().positive().optional(),
      daysAhead: z.number().int().positive().optional(),
    }),
    execute: async (input) => findMeetingSlot(input),
  }),

  list_tasks: tool({
    description: "List the user's tasks, optionally filtered by status. Read-only.",
    inputSchema: z.object({
      status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    }),
    execute: async (input) => listTasks(input),
  }),

  web_research: tool({
    description: "Research a topic on the web and return a short synthesized briefing. Read-only.",
    inputSchema: z.object({
      query: z.string().describe("What to research."),
    }),
    execute: async (input) => webResearch(input),
  }),

  draft_reply: tool({
    description:
      "Draft (but do NOT send) a reply to an email thread. Returns the draft for human review.",
    inputSchema: z.object({
      threadId: z.string().describe("The thread to reply to."),
      body: z.string().describe("The full reply body, written in the user's tone."),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "email_draft", ...input },
    }),
  }),

  send_email: tool({
    description:
      "Send an email. Staged for approval — nothing is delivered until the user approves.",
    inputSchema: z.object({
      to: z.array(z.string()).describe("Recipient email addresses."),
      subject: z.string(),
      body: z.string(),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "email_send", ...input },
    }),
  }),

  create_event: tool({
    description:
      "Create a calendar event. Staged for approval — not written until the user approves.",
    inputSchema: z.object({
      title: z.string(),
      startAt: z.string().describe("ISO 8601 start time."),
      endAt: z.string().describe("ISO 8601 end time."),
      attendees: z.array(z.string()).optional(),
      description: z.string().optional(),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "calendar_event", ...input },
    }),
  }),

  create_task: tool({
    description: "Create a task on the user's list. Staged for approval.",
    inputSchema: z.object({
      title: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      dueAt: z.string().optional().describe("ISO 8601 due date."),
      notes: z.string().optional(),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "task", ...input },
    }),
  }),

  complete_task: tool({
    description: "Mark a task as done. Staged for approval.",
    inputSchema: z.object({
      taskId: z.string(),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "task_complete", ...input },
    }),
  }),

  send_slack: tool({
    description: "Send a Slack message. Staged for approval — not delivered until approved.",
    inputSchema: z.object({
      channel: z.string().describe("Channel or @user."),
      text: z.string(),
    }),
    execute: async (input) => ({
      staged: true as const,
      preview: { kind: "slack_message", ...input },
    }),
  }),
} as const;

/* ------------------------------------------------------------------ */
/* Commit — runs a WRITE tool for real after human approval            */
/* ------------------------------------------------------------------ */

export interface CommitResult {
  ok: boolean;
  detail: string;
  data?: unknown;
}

/**
 * Executes the real side effect for an approved write step. Read tools never
 * reach here. For the demo, "sending" an email/slack is simulated (logged) and
 * calendar/task writes mutate the in-memory store.
 */
export function commitToolCall(call: ToolCall): CommitResult {
  const input = call.input as Record<string, unknown>;
  switch (call.toolName) {
    case "create_task": {
      const t = store.addTask(
        buildTask({
          title: String(input.title),
          priority: input.priority as TaskPriority | undefined,
          dueAt: input.dueAt as string | undefined,
          notes: input.notes as string | undefined,
        }),
      );
      return { ok: true, detail: `Added task “${t.title}”.`, data: t };
    }
    case "complete_task": {
      const updated = store.patchTask(String(input.taskId), { status: "done" });
      return updated
        ? { ok: true, detail: `Completed “${updated.title}”.`, data: updated }
        : { ok: false, detail: `Task ${String(input.taskId)} not found.` };
    }
    case "create_event": {
      const e = store.addEvent(
        buildEvent({
          title: String(input.title),
          startAt: String(input.startAt),
          endAt: String(input.endAt),
          attendees: input.attendees as string[] | undefined,
          description: input.description as string | undefined,
        }),
      );
      return { ok: true, detail: `Scheduled “${e.title}”.`, data: e };
    }
    case "send_email":
      return {
        ok: true,
        detail: `Email sent to ${(input.to as string[] | undefined)?.join(", ") ?? "recipient"}.`,
      };
    case "draft_reply":
      return { ok: true, detail: `Reply drafted on thread ${String(input.threadId)}.` };
    case "send_slack":
      return { ok: true, detail: `Slack message sent to ${String(input.channel)}.` };
    default:
      return { ok: false, detail: `No commit handler for ${call.toolName}.` };
  }
}
