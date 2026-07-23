/**
 * Tool registry.
 *
 * Each tool has: (1) client-safe metadata (in lib/types.ts TOOL_CATALOG), and
 * (2) a server-side executable definition built here — a zod input schema plus
 * an `execute` function. The registry also exposes the raw executors so the
 * mock agent loop can run them directly without the AI SDK.
 *
 * Executors are pure and deterministic: `calculator` really evaluates, and the
 * web/http tools return realistic canned data so a run produces the same trace
 * whether or not a model key is present.
 */
import { tool } from "ai";
import { z } from "zod";
import { TOOL_CATALOG, type ToolMeta } from "./types";

/* ------------------------------------------------------------------ */
/* Executors (used by both the AI loop and the mock loop)              */
/* ------------------------------------------------------------------ */

/**
 * Safe arithmetic evaluator — recursive descent over + - * / and parentheses.
 * Deliberately does NOT use eval/Function; only numeric tokens are accepted.
 */
export function evalArithmetic(expr: string): number {
  const s = expr.replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];

  const parseExpr = (): number => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const parseTerm = (): number => {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = parseFactor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const parseFactor = (): number => {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") throw new Error("Unbalanced parentheses");
      i++;
      return v;
    }
    if (peek() === "-") {
      i++;
      return -parseFactor();
    }
    let num = "";
    while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
    if (num === "") throw new Error(`Unexpected token '${s[i] ?? "EOF"}' at ${i}`);
    return parseFloat(num);
  };

  if (s.length === 0) throw new Error("Empty expression");
  const result = parseExpr();
  if (i < s.length) throw new Error(`Unexpected trailing token '${s[i]}'`);
  if (!Number.isFinite(result)) throw new Error("Non-finite result");
  return result;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Deterministic mock search: canned corpus filtered by query terms. */
export function mockWebSearch(query: string, limit = 3): SearchResult[] {
  const corpus: SearchResult[] = [
    {
      title: "Vercel AI SDK — Tool Calling",
      url: "https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling",
      snippet:
        "Define tools with a zod inputSchema and an execute function; the model calls them across multiple steps via stopWhen.",
    },
    {
      title: "Building agents that loop over tools",
      url: "https://ai-sdk.dev/docs/agents",
      snippet:
        "An agent is a system prompt plus a tool set plus a stop condition. generateText runs the model/tool loop for you.",
    },
    {
      title: "AI Gateway model routing",
      url: "https://vercel.com/docs/ai-gateway",
      snippet:
        "Route provider/model strings like anthropic/claude-sonnet-5 through one endpoint with spend caps and failover.",
    },
    {
      title: "Observability for agent runs",
      url: "https://example.com/agent-observability",
      snippet:
        "Capture every step, tool call, latency, and token count into a trace so failures are debuggable in production.",
    },
  ];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = corpus
    .map((r) => {
      const hay = `${r.title} ${r.snippet}`.toLowerCase();
      const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);
  // Always return something useful even on a zero-match query.
  return scored.slice(0, Math.max(1, Math.min(limit, corpus.length))).map((x) => x.r);
}

export interface HttpFetchResult {
  url: string;
  method: string;
  status: number;
  contentType: string;
  body: unknown;
}

/** Deterministic mock HTTP fetch. Never touches the network. */
export function mockHttpFetch(url: string, method = "GET"): HttpFetchResult {
  let host = "unknown";
  try {
    host = new URL(url).host;
  } catch {
    return {
      url,
      method,
      status: 400,
      contentType: "text/plain",
      body: "Invalid URL",
    };
  }
  return {
    url,
    method,
    status: 200,
    contentType: "application/json",
    body: {
      ok: true,
      host,
      receivedAt: "2026-07-23T00:00:00.000Z",
      note: "Mock response — replace http_fetch with a real fetch tool in production.",
      sample: { id: "obj_123", value: 42 },
    },
  };
}

/* ------------------------------------------------------------------ */
/* AI SDK tool set builder                                             */
/* ------------------------------------------------------------------ */

/** Called by the runtime each time a tool finishes, for trace collection. */
export interface ToolSpan {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export type ToolSpanSink = (span: ToolSpan) => void;

// Zod input schemas — shared by the AI tool defs and mock argument parsing.
export const calculatorInput = z.object({
  expression: z
    .string()
    .min(1)
    .describe("Arithmetic expression, e.g. '(2 + 3) * 4'. Digits and + - * / ( ) only."),
});
export const webSearchInput = z.object({
  query: z.string().min(1).describe("Search query."),
  limit: z.number().int().min(1).max(10).default(3).describe("Max results."),
});
export const httpFetchInput = z.object({
  url: z.string().url().describe("Absolute URL to fetch."),
  method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method."),
});

/**
 * Build the AI SDK tool set for the enabled tool ids. Each tool's execute is
 * instrumented: it measures latency, records a span, and returns the result to
 * the model. The `toolCallId` is generated per invocation for trace correlation.
 */
export function buildToolSet(enabledIds: string[], sink: ToolSpanSink) {
  const record = async <T>(
    toolName: string,
    input: unknown,
    fn: () => T | Promise<T>,
  ): Promise<T | { error: string }> => {
    const toolCallId = `tc_${Math.random().toString(36).slice(2, 10)}`;
    const start = Date.now();
    try {
      const output = await fn();
      sink({
        toolCallId,
        toolName,
        input,
        output,
        ok: true,
        latencyMs: Date.now() - start,
      });
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool execution failed";
      sink({
        toolCallId,
        toolName,
        input,
        ok: false,
        error: message,
        latencyMs: Date.now() - start,
      });
      return { error: message };
    }
  };

  const all = {
    calculator: tool({
      description: "Evaluate an arithmetic expression and return the numeric result.",
      inputSchema: calculatorInput,
      execute: async ({ expression }) =>
        record("calculator", { expression }, () => ({
          expression,
          result: evalArithmetic(expression),
        })),
    }),
    web_search: tool({
      description: "Search the web for a query and return ranked result snippets.",
      inputSchema: webSearchInput,
      execute: async ({ query, limit }) =>
        record("web_search", { query, limit }, () => ({
          query,
          results: mockWebSearch(query, limit),
        })),
    }),
    http_fetch: tool({
      description: "Fetch a URL over HTTP and return the status code and body.",
      inputSchema: httpFetchInput,
      execute: async ({ url, method }) =>
        record("http_fetch", { url, method }, () => mockHttpFetch(url, method)),
    }),
  };

  const set: Record<string, (typeof all)[keyof typeof all]> = {};
  for (const id of enabledIds) {
    if (id in all) set[id] = all[id as keyof typeof all];
  }
  return set;
}

/** Resolve catalog metadata for a set of ids (used for validation/UX). */
export function toolMetaFor(ids: string[]): ToolMeta[] {
  return TOOL_CATALOG.filter((t) => ids.includes(t.id));
}

export const VALID_TOOL_IDS = TOOL_CATALOG.map((t) => t.id);
