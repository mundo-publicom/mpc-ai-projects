/**
 * Lean Canvas structure + helpers.
 *
 * The Lean Canvas (Ash Maurya) is nine blocks laid out in a fixed grid. This
 * module defines that layout declaratively so the UI, docs, and any exports
 * stay consistent, and provides a helper to flatten a {@link LeanCanvas} into
 * renderable cells.
 */
import type { LeanCanvas } from "./types";

/** The nine canonical Lean Canvas block keys. */
export type LeanCanvasBlockKey = keyof LeanCanvas;

export interface LeanCanvasBlockMeta {
  key: LeanCanvasBlockKey;
  /** Display label. */
  label: string;
  /** Short prompt describing what belongs in the block. */
  hint: string;
  /** Grid column start (1-based, 5-col grid). */
  col: number;
  /** Grid row start (1-based). */
  row: number;
  /** Column span. */
  colSpan: number;
  /** Row span. */
  rowSpan: number;
}

/**
 * Canonical Lean Canvas layout on a 5-column, 3-row grid.
 *
 * Row layout mirrors the classic canvas:
 *   [ Problem | Solution | UVP | Unfair Adv. | Segments ]  (UVP + Segments span 2 rows)
 *   [ Problem | Key Metrics | UVP | Channels | Segments ]
 *   [ Cost Structure (span 2.5) ............ | Revenue Streams (span 2.5) ]
 */
export const LEAN_CANVAS_LAYOUT: LeanCanvasBlockMeta[] = [
  {
    key: "problem",
    label: "Problem",
    hint: "Top 1–3 problems worth solving.",
    col: 1,
    row: 1,
    colSpan: 1,
    rowSpan: 2,
  },
  {
    key: "solution",
    label: "Solution",
    hint: "Outline a possible solution for each problem.",
    col: 2,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
  },
  {
    key: "keyMetrics",
    label: "Key Metrics",
    hint: "The numbers that tell you how the business is doing.",
    col: 2,
    row: 2,
    colSpan: 1,
    rowSpan: 1,
  },
  {
    key: "uniqueValueProposition",
    label: "Unique Value Proposition",
    hint: "Single, clear, compelling message that states why you are different.",
    col: 3,
    row: 1,
    colSpan: 1,
    rowSpan: 2,
  },
  {
    key: "unfairAdvantage",
    label: "Unfair Advantage",
    hint: "Something that cannot be easily copied or bought.",
    col: 4,
    row: 1,
    colSpan: 1,
    rowSpan: 1,
  },
  {
    key: "channels",
    label: "Channels",
    hint: "Your path to customers.",
    col: 4,
    row: 2,
    colSpan: 1,
    rowSpan: 1,
  },
  {
    key: "customerSegments",
    label: "Customer Segments",
    hint: "Target customers and early adopters.",
    col: 5,
    row: 1,
    colSpan: 1,
    rowSpan: 2,
  },
  {
    key: "costStructure",
    label: "Cost Structure",
    hint: "Customer acquisition, distribution, hosting, people, etc.",
    col: 1,
    row: 3,
    colSpan: 2,
    rowSpan: 1,
  },
  {
    key: "revenueStreams",
    label: "Revenue Streams",
    hint: "Revenue model, lifetime value, gross margin.",
    col: 3,
    row: 3,
    colSpan: 3,
    rowSpan: 1,
  },
];

/** A block ready to render: its metadata plus normalized string lines. */
export interface RenderableCanvasBlock extends LeanCanvasBlockMeta {
  lines: string[];
}

/**
 * Flattens a {@link LeanCanvas} into the fixed layout, coercing single-string
 * blocks (UVP, unfair advantage) into single-element arrays so the UI can treat
 * every block uniformly.
 */
export function toRenderableCanvas(canvas: LeanCanvas): RenderableCanvasBlock[] {
  return LEAN_CANVAS_LAYOUT.map((meta) => {
    const value = canvas[meta.key];
    const lines = Array.isArray(value) ? value : [value];
    return { ...meta, lines: lines.filter(Boolean) };
  });
}

/** An empty canvas — useful as a default / skeleton. */
export function emptyCanvas(): LeanCanvas {
  return {
    problem: [],
    customerSegments: [],
    uniqueValueProposition: "",
    solution: [],
    channels: [],
    revenueStreams: [],
    costStructure: [],
    keyMetrics: [],
    unfairAdvantage: "",
  };
}
