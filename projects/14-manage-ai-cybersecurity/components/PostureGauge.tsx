"use client";

import type { PostureScore } from "@/lib/types";
import { gradeColor } from "@/lib/ui";

/**
 * Circular posture-score gauge (0..100). Pure SVG — no chart dependency. Shows
 * the score, letter grade, and trend delta vs. the previous evaluation.
 */
export function PostureGauge({ posture }: { posture: PostureScore | null }) {
  const score = posture?.score ?? 0;
  const grade = posture?.grade ?? "F";
  const color = gradeColor(grade);

  const size = 176;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  const delta = posture?.trendDelta;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>
            {score}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            / 100
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {grade}
        </span>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Security posture
        </span>
      </div>

      {typeof delta === "number" && (
        <p
          className={`mt-2 text-xs font-medium ${
            delta >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs. last evaluation
        </p>
      )}
    </div>
  );
}
