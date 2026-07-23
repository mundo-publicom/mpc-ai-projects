/**
 * Pure money-formatting helpers (no dependencies). Safe to import from both
 * server modules and client components — importing lib/ai.ts on the client
 * would pull the AI SDK into the browser bundle, so keep these here.
 *
 * Money is integer micro-units: 1.00 currency unit = 1_000_000 micro-units.
 */

export const MICROS_PER_UNIT = 1_000_000;

/** Format micro-units as a plain decimal string, e.g. 1_250_000 -> "1.25". */
export function fmtMicros(micros: number, maxDp = 6): string {
  const v = micros / MICROS_PER_UNIT;
  const s = v.toFixed(maxDp).replace(/0+$/, "").replace(/\.$/, "");
  return s.includes(".") ? s : v.toFixed(2);
}

/** Format micro-units with a currency label, e.g. "$1.25 USDC". */
export function fmtMoney(micros: number, currency = "USDC"): string {
  return `${fmtMicros(micros)} ${currency}`;
}

/** Apply a basis-point rate to an amount (rounded to nearest micro-unit). */
export function applyBps(amountMicros: number, bps: number): number {
  return Math.round((amountMicros * bps) / 10_000);
}

/** Basis points → percent string, e.g. 250 -> "2.5%". */
export function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}
