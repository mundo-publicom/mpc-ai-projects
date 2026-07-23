/**
 * In-memory demo world.
 *
 * This scaffold ships with zero external dependencies so `pnpm dev` boots and
 * the full command → plan → execute path is exercisable without any API keys or
 * OAuth. In production these reads/writes are backed by Postgres + the Gmail /
 * Google Calendar / Slack APIs (see docs/TECHNICAL_SPEC.md); here they are a
 * process-local store the mock tools mutate.
 *
 * Timestamps are generated relative to "now" so the dashboard always looks live.
 */

import type {
  ActionPlan,
  CalendarEvent,
  DashboardData,
  EmailThread,
  Task,
  User,
} from "@/lib/types";

const now = new Date();
const iso = (d: Date) => d.toISOString();
/** Today at a given hour:minute in local server time, as ISO. */
const at = (hour: number, min = 0) => {
  const d = new Date(now);
  d.setHours(hour, min, 0, 0);
  return iso(d);
};
const inDays = (days: number, hour: number, min = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return iso(d);
};

export const DEMO_USER: User = {
  id: "usr_demo",
  orgId: "org_demo",
  email: "alex@northwind.co",
  name: "Alex Rivera",
  plan: "pro",
  connections: { gmail: true, googleCalendar: true, slack: true },
  preferences: {
    timezone: "America/New_York",
    workdayStart: "09:00",
    workdayEnd: "18:00",
    autonomy: "approve_writes",
    writingTone: "professional",
  },
  createdAt: inDays(-120, 9),
  updatedAt: iso(now),
};

/**
 * The mutable slices of the demo world. Exported as `let`-backed arrays via
 * accessors so tool executors can push/patch them within a request.
 */
let tasks: Task[] = [
  {
    id: "tsk_1",
    userId: DEMO_USER.id,
    title: "Send Q3 board deck to investors",
    notes: "Waiting on final revenue numbers from Priya.",
    status: "in_progress",
    priority: "urgent",
    dueAt: at(17),
    source: "manual",
    estimateMin: 45,
    labels: ["fundraising"],
    createdAt: inDays(-2, 10),
    updatedAt: at(9, 12),
  },
  {
    id: "tsk_2",
    userId: DEMO_USER.id,
    title: "Reply to Acme contract redlines",
    status: "todo",
    priority: "high",
    dueAt: at(15),
    source: "email",
    sourceRef: "thr_2",
    estimateMin: 20,
    labels: ["legal", "sales"],
    createdAt: at(8, 30),
    updatedAt: at(8, 30),
  },
  {
    id: "tsk_3",
    userId: DEMO_USER.id,
    title: "Prep talking points for 3pm partner sync",
    status: "todo",
    priority: "medium",
    dueAt: at(14, 30),
    source: "calendar",
    sourceRef: "evt_3",
    estimateMin: 15,
    labels: ["partnerships"],
    createdAt: at(8, 45),
    updatedAt: at(8, 45),
  },
  {
    id: "tsk_4",
    userId: DEMO_USER.id,
    title: "Book flights for the NYC customer visit",
    status: "todo",
    priority: "low",
    source: "manual",
    estimateMin: 25,
    labels: ["travel"],
    createdAt: inDays(-1, 16),
    updatedAt: inDays(-1, 16),
  },
  {
    id: "tsk_5",
    userId: DEMO_USER.id,
    title: "Approve November marketing budget",
    status: "done",
    priority: "medium",
    source: "manual",
    labels: ["finance"],
    createdAt: inDays(-1, 11),
    updatedAt: at(8, 5),
  },
];

let events: CalendarEvent[] = [
  {
    id: "evt_1",
    userId: DEMO_USER.id,
    providerId: "gcal_evt_1",
    title: "Standup",
    startAt: at(9, 30),
    endAt: at(9, 45),
    timezone: DEMO_USER.preferences.timezone,
    allDay: false,
    attendees: [
      { email: "team@northwind.co", responseStatus: "accepted" },
    ],
    organizerEmail: DEMO_USER.email,
    status: "confirmed",
    createdAt: inDays(-30, 9),
  },
  {
    id: "evt_2",
    userId: DEMO_USER.id,
    providerId: "gcal_evt_2",
    title: "1:1 with Priya (CFO)",
    description: "Q3 numbers, board deck sign-off.",
    startAt: at(11, 0),
    endAt: at(11, 30),
    timezone: DEMO_USER.preferences.timezone,
    allDay: false,
    attendees: [
      { email: "priya@northwind.co", name: "Priya Shah", responseStatus: "accepted" },
    ],
    conferenceUrl: "https://meet.google.com/demo-priya",
    organizerEmail: DEMO_USER.email,
    status: "confirmed",
    createdAt: inDays(-7, 12),
  },
  {
    id: "evt_3",
    userId: DEMO_USER.id,
    providerId: "gcal_evt_3",
    title: "Partner sync — Globex",
    description: "Quarterly partnership review.",
    location: "Google Meet",
    startAt: at(15, 0),
    endAt: at(15, 45),
    timezone: DEMO_USER.preferences.timezone,
    allDay: false,
    attendees: [
      { email: "dana@globex.com", name: "Dana Kim", responseStatus: "accepted" },
      { email: "alex@northwind.co", responseStatus: "accepted" },
    ],
    conferenceUrl: "https://meet.google.com/demo-globex",
    organizerEmail: "dana@globex.com",
    status: "confirmed",
    createdAt: inDays(-5, 15),
  },
];

let threads: EmailThread[] = [
  {
    id: "thr_1",
    userId: DEMO_USER.id,
    providerThreadId: "gmail_thr_1",
    subject: "Investor update — can we get Q3 by EOD?",
    messages: [
      {
        id: "msg_1",
        fromEmail: "gp@sequoiacap-demo.com",
        fromName: "Jordan (Sequoia)",
        to: [DEMO_USER.email],
        snippet:
          "Hey Alex — the partners meet tomorrow AM. Any chance we get the Q3 update and revenue figures by end of day today?",
        sentAt: at(8, 15),
      },
    ],
    unread: true,
    priority: "urgent",
    recommendedAction: "reply",
    summary: "Lead investor needs the Q3 update before their partner meeting tomorrow.",
    labels: ["investors"],
    updatedAt: at(8, 15),
  },
  {
    id: "thr_2",
    userId: DEMO_USER.id,
    providerThreadId: "gmail_thr_2",
    subject: "Acme MSA — redlines attached",
    messages: [
      {
        id: "msg_2",
        fromEmail: "legal@acme.com",
        fromName: "Sam Ortiz",
        to: [DEMO_USER.email],
        snippet:
          "Attached are our redlines on the MSA. Main sticking point is the liability cap in section 8. Can you turn this around this week?",
        sentAt: inDays(-1, 17),
      },
    ],
    unread: true,
    priority: "important",
    recommendedAction: "delegate",
    summary: "Acme legal wants MSA redlines addressed this week; liability cap is the blocker.",
    labels: ["legal", "sales"],
    updatedAt: inDays(-1, 17),
  },
  {
    id: "thr_3",
    userId: DEMO_USER.id,
    providerThreadId: "gmail_thr_3",
    subject: "Coffee next week?",
    messages: [
      {
        id: "msg_3",
        fromEmail: "dana@globex.com",
        fromName: "Dana Kim",
        to: [DEMO_USER.email],
        snippet:
          "Great chatting last month. Would love to grab 30 min next week to talk expansion — any morning work for you?",
        sentAt: at(7, 50),
      },
    ],
    unread: true,
    priority: "normal",
    recommendedAction: "schedule",
    summary: "Globex partner wants a 30-min morning meeting next week to discuss expansion.",
    labels: ["partnerships"],
    updatedAt: at(7, 50),
  },
  {
    id: "thr_4",
    userId: DEMO_USER.id,
    providerThreadId: "gmail_thr_4",
    subject: "🔥 Last chance: 40% off DevTools Pro",
    messages: [
      {
        id: "msg_4",
        fromEmail: "deals@devtools.io",
        to: [DEMO_USER.email],
        snippet: "Our biggest sale of the year ends tonight. Upgrade now and save 40%...",
        sentAt: at(6, 30),
      },
    ],
    unread: true,
    priority: "low",
    recommendedAction: "unsubscribe",
    summary: "Promotional email — safe to archive or unsubscribe.",
    labels: ["promotions"],
    updatedAt: at(6, 30),
  },
];

/**
 * Process-local cache of recent action plans, so a follow-up approval request
 * can find the plan it is approving. In production this is a row in Postgres.
 */
const plans = new Map<string, ActionPlan>();

/* ------------------------------------------------------------------ */
/* Accessors (used by tool executors and the dashboard)                */
/* ------------------------------------------------------------------ */

export const store = {
  savePlan: (p: ActionPlan) => {
    plans.set(p.id, p);
    // Keep the cache small in this demo.
    if (plans.size > 50) plans.delete(plans.keys().next().value as string);
    return p;
  },
  getPlan: (id: string) => plans.get(id),
  getTasks: () => tasks,
  getEvents: () => events,
  getThreads: () => threads,
  addTask: (t: Task) => {
    tasks = [t, ...tasks];
    return t;
  },
  patchTask: (id: string, patch: Partial<Task>) => {
    let updated: Task | undefined;
    tasks = tasks.map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, ...patch, updatedAt: new Date().toISOString() };
      return updated;
    });
    return updated;
  },
  addEvent: (e: CalendarEvent) => {
    events = [...events, e].sort((a, b) => a.startAt.localeCompare(b.startAt));
    return e;
  },
  findThread: (id: string) => threads.find((t) => t.id === id),
};

export function getDashboardData(): DashboardData {
  return {
    user: DEMO_USER,
    tasks: store.getTasks(),
    events: [...store.getEvents()].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    threads: store.getThreads(),
  };
}
