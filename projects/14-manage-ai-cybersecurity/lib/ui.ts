/**
 * Presentational helpers shared across dashboard components: severity color
 * mapping, verdict labels, and small formatters. Keeping these in one place
 * keeps badge styling consistent between the alert feed, triage cards, and
 * posture panels.
 */

import type { Severity, TriageVerdict } from "./types";

/** Tailwind class sets for severity badges (bg + text + ring). */
export const SEVERITY_BADGE: Record<Severity, string> = {
  critical:
    "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-500/30",
  high: "bg-orange-100 text-orange-800 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-500/30",
  medium:
    "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-500/30",
  low: "bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-500/30",
  info: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/30",
};

/** Solid accent color per severity (used for the left rail on alert rows). */
export const SEVERITY_ACCENT: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  info: "bg-slate-400",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const VERDICT_LABEL: Record<TriageVerdict, string> = {
  true_positive: "True positive",
  likely_true_positive: "Likely true positive",
  likely_false_positive: "Likely false positive",
  false_positive: "False positive",
  needs_investigation: "Needs investigation",
};

export const VERDICT_BADGE: Record<TriageVerdict, string> = {
  true_positive: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  likely_true_positive:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  needs_investigation:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  likely_false_positive:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  false_positive:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Color for the posture grade / gauge arc. */
export function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#10b981"; // emerald-500
    case "B":
      return "#22c55e"; // green-500
    case "C":
      return "#eab308"; // yellow-500
    case "D":
      return "#f97316"; // orange-500
    default:
      return "#ef4444"; // red-500
  }
}

/** Relative "time ago" from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function confidencePct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
