/**
 * Bot registry.
 *
 * In production, bots live in a database keyed by orgId. For the scaffold we
 * ship a single seeded demo bot so the dashboard, ingestion, and chat all work
 * out of the box. `getBot` is the one place the rest of the app resolves a
 * botId to its configuration, so it is the natural seam for a DB lookup later.
 */

import type { Bot } from "./types";

export const DEMO_BOT_ID = "demo";

const DEMO_BOT: Bot = {
  id: DEMO_BOT_ID,
  orgId: "demo-org",
  name: "Aria",
  role: "hybrid",
  systemPrompt:
    "You represent Acme, a SaaS company. Be warm, concise, and helpful. Prefer to point visitors to concrete next steps.",
  theme: {
    primaryColor: "#3563ff",
    position: "bottom-right",
    greeting: "Hi! I'm Aria. Ask me anything about the product, pricing, or docs.",
    title: "Aria — AI Assistant",
  },
  topK: 5,
  minScore: 0.15,
  leadCapture: true,
  humanHandoff: true,
  handoffChannel: "slack",
  plan: "growth",
  allowedOrigins: (process.env.WIDGET_ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()),
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

const globalForBots = globalThis as unknown as { __bots?: Map<string, Bot> };
const bots: Map<string, Bot> = globalForBots.__bots ?? new Map([[DEMO_BOT_ID, DEMO_BOT]]);
if (process.env.NODE_ENV !== "production") globalForBots.__bots = bots;

/** Resolve a bot by id. Returns undefined for unknown tenants. */
export function getBot(botId: string): Bot | undefined {
  return bots.get(botId);
}

/** Origin allow-list check used for CORS on the public widget endpoints. */
export function isOriginAllowed(bot: Bot, origin: string | null): boolean {
  if (bot.allowedOrigins.includes("*")) return true;
  if (!origin) return false;
  return bot.allowedOrigins.includes(origin);
}
