"use client";

import type { NegotiateResponse } from "@/lib/types";
import { fmtMicros, bpsToPct } from "@/lib/format";

export function SettlementSummary({ result }: { result: NegotiateResponse }) {
  const s = result.settlement;
  const cur = s.currency;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Settlement
        </h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            s.agreed
              ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
          ].join(" ")}
        >
          {s.agreed ? "Deal settled" : "No deal"}
        </span>
      </div>

      {/* Lifecycle stages */}
      <ol className="mb-4 space-y-2">
        {s.stages.map((stage, i) => (
          <li key={stage.label} className="flex items-start gap-2 text-xs">
            <span
              className={[
                "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold",
                stage.status === "done"
                  ? "bg-brand-500 text-white"
                  : "bg-slate-200 text-slate-400 dark:bg-slate-700",
              ].join(" ")}
            >
              {stage.status === "done" ? "✓" : i + 1}
            </span>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {stage.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {" "}
                — {stage.detail}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* Money breakdown */}
      {s.agreed && (
        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3 font-mono text-xs dark:bg-slate-800/50">
          <Row
            label="List price / unit"
            value={`${fmtMicros(s.listPriceMicros)} ${cur}`}
          />
          <Row
            label="Agreed price / unit"
            value={`${fmtMicros(s.agreedUnitPriceMicros)} ${cur}`}
            highlight
          />
          <Row
            label={`Buyer savings`}
            value={`${s.buyerSavingsPct.toFixed(1)}%`}
          />
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <Row label={`Quantity`} value={`${s.quantity} units`} />
          <Row
            label="Subtotal"
            value={`${fmtMicros(s.subtotalMicros)} ${cur}`}
          />
          <Row
            label={`Platform fee (${bpsToPct(s.takeRateBps)})`}
            value={`${fmtMicros(s.platformFeeMicros)} ${cur}`}
            accent="brand"
          />
          <Row
            label="Buyer pays (total)"
            value={`${fmtMicros(s.totalMicros)} ${cur}`}
          />
          <Row
            label="Net to seller"
            value={`${fmtMicros(s.netToSellerMicros)} ${cur}`}
          />
        </dl>
      )}

      <p className="mt-3 text-[10px] text-slate-400">
        {result.mocked
          ? "Simulated offline (no model key). Money math is real."
          : `Live negotiation via generateObject · ${result.latencyMs}ms`}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: "brand";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={[
          "font-semibold",
          accent === "brand"
            ? "text-brand-600 dark:text-brand-400"
            : highlight
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-700 dark:text-slate-300",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
