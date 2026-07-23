import type {
  Action,
  Candle,
  Sentiment,
  Signal,
  Strategy,
} from "@/lib/types";

/**
 * Deterministic indicator + rule engine, plus the sentiment blend and the risk
 * gate. This is the "brain" that the AI sentiment layer only *advises* — the
 * rule action and the risk check are pure functions of price/config, so the
 * system's behavior is explainable and reproducible.
 */

/* -------------------------------------------------------------------------- */
/* Indicators                                                                  */
/* -------------------------------------------------------------------------- */

/** Simple moving average of the last `window` values. Returns NaN if short. */
export function sma(values: number[], window: number): number {
  if (values.length < window || window <= 0) return NaN;
  let sum = 0;
  for (let i = values.length - window; i < values.length; i++) sum += values[i];
  return sum / window;
}

/** Wilder-style RSI over `window` periods on the trailing closes. */
export function rsi(values: number[], window: number): number {
  if (values.length < window + 1) return NaN;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - window; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / window;
  const avgLoss = losses / window;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Trailing simple return over `window` bars. */
export function momentum(values: number[], window: number): number {
  if (values.length < window + 1) return 0;
  const past = values[values.length - 1 - window];
  const now = values[values.length - 1];
  if (past === 0) return 0;
  return (now - past) / past;
}

/* -------------------------------------------------------------------------- */
/* Rule engine                                                                 */
/* -------------------------------------------------------------------------- */

export interface RuleResult {
  action: Action;
  /** 0-1 conviction from the rule alone (distance-from-threshold based). */
  strength: number;
  /** Short machine explanation of what fired. */
  detail: string;
}

/**
 * Pure, deterministic rule signal for the latest bar. Requires enough history;
 * returns a `hold` with 0 strength when indicators are undefined.
 */
export function computeRuleAction(strategy: Strategy, candles: Candle[]): RuleResult {
  const closes = candles.map((c) => c.close);
  const fast = Math.min(strategy.fastWindow, strategy.slowWindow - 1);
  const slow = strategy.slowWindow;

  switch (strategy.kind) {
    case "sma_crossover": {
      const f = sma(closes, fast);
      const s = sma(closes, slow);
      if (Number.isNaN(f) || Number.isNaN(s)) {
        return { action: "hold", strength: 0, detail: "insufficient history" };
      }
      const spread = (f - s) / s;
      const strength = Math.min(1, Math.abs(spread) * 20);
      if (f > s) return { action: "buy", strength, detail: `fastSMA(${fast})>${slow}SMA by ${(spread * 100).toFixed(2)}%` };
      if (f < s) return { action: "sell", strength, detail: `fastSMA(${fast})<${slow}SMA by ${(spread * 100).toFixed(2)}%` };
      return { action: "hold", strength: 0, detail: "SMAs equal" };
    }
    case "rsi_reversion": {
      const r = rsi(closes, slow);
      if (Number.isNaN(r)) return { action: "hold", strength: 0, detail: "insufficient history" };
      if (r < 30) return { action: "buy", strength: Math.min(1, (30 - r) / 30), detail: `RSI ${r.toFixed(1)} oversold` };
      if (r > 70) return { action: "sell", strength: Math.min(1, (r - 70) / 30), detail: `RSI ${r.toFixed(1)} overbought` };
      return { action: "hold", strength: 0, detail: `RSI ${r.toFixed(1)} neutral` };
    }
    case "momentum": {
      const m = momentum(closes, fast);
      const strength = Math.min(1, Math.abs(m) * 10);
      if (m > 0.02) return { action: "buy", strength, detail: `${(m * 100).toFixed(2)}% ${fast}-bar momentum` };
      if (m < -0.02) return { action: "sell", strength, detail: `${(m * 100).toFixed(2)}% ${fast}-bar momentum` };
      return { action: "hold", strength: 0, detail: "flat momentum" };
    }
    case "breakout": {
      if (candles.length < slow + 1) return { action: "hold", strength: 0, detail: "insufficient history" };
      const window = candles.slice(candles.length - 1 - slow, candles.length - 1);
      const hi = Math.max(...window.map((c) => c.high));
      const lo = Math.min(...window.map((c) => c.low));
      const last = closes[closes.length - 1];
      if (last > hi) return { action: "buy", strength: Math.min(1, (last - hi) / hi * 20), detail: `broke ${slow}-bar high ${hi.toFixed(2)}` };
      if (last < lo) return { action: "sell", strength: Math.min(1, (lo - last) / lo * 20), detail: `broke ${slow}-bar low ${lo.toFixed(2)}` };
      return { action: "hold", strength: 0, detail: "inside range" };
    }
    default:
      return { action: "hold", strength: 0, detail: "unknown rule" };
  }
}

/* -------------------------------------------------------------------------- */
/* Sentiment blend + risk gate                                                 */
/* -------------------------------------------------------------------------- */

export interface RiskContext {
  /** Current portfolio drawdown from peak as a negative fraction, if known. */
  currentDrawdown?: number;
}

/**
 * Blend the deterministic rule with the AI sentiment read, then run the risk
 * gate. Sentiment can only *reinforce or damp* conviction and, when it strongly
 * contradicts the rule, downgrade the action to `hold`. It can never, by
 * itself, flip a `hold` into a trade — rules lead, AI advises.
 */
export function blendSignal(args: {
  strategy: Strategy;
  candles: Candle[];
  rule: RuleResult;
  sentiment: Sentiment;
  risk?: RiskContext;
  usedAI: boolean;
  model: string | null;
}): Signal {
  const { strategy, candles, rule, sentiment, risk, usedAI, model } = args;
  const price = candles[candles.length - 1].close;
  const w = strategy.sentimentWeight;
  const riskNotes: string[] = [];

  // Agreement in [-1,1]: does sentiment point the same way as the rule?
  const ruleDir = rule.action === "buy" ? 1 : rule.action === "sell" ? -1 : 0;
  const agreement = ruleDir === 0 ? 0 : Math.sign(sentiment.score) === ruleDir ? Math.abs(sentiment.score) : -Math.abs(sentiment.score);

  // Blended confidence: rule strength adjusted by weighted sentiment agreement.
  let confidence = rule.strength * (1 - w) + Math.max(0, rule.strength + agreement) * w;
  confidence = Math.max(0, Math.min(1, confidence));

  let action: Action = rule.action;
  let riskBlocked = false;

  // 1) Strong contradiction from sentiment downgrades an active trade to hold.
  if (ruleDir !== 0 && agreement < -0.5 && w >= 0.2) {
    action = "hold";
    riskBlocked = true;
    riskNotes.push(`sentiment (${sentiment.score.toFixed(2)}) strongly contradicts rule; downgraded to hold`);
  }

  // 2) Minimum confidence gate.
  if (action !== "hold" && confidence < strategy.risk.minConfidence) {
    action = "hold";
    riskBlocked = true;
    riskNotes.push(`confidence ${confidence.toFixed(2)} < minConfidence ${strategy.risk.minConfidence}`);
  }

  // 3) Portfolio drawdown halt on new entries.
  if (action === "buy" && risk?.currentDrawdown !== undefined && risk.currentDrawdown <= -strategy.risk.maxDrawdownPct) {
    action = "hold";
    riskBlocked = true;
    riskNotes.push(`drawdown ${(risk.currentDrawdown * 100).toFixed(1)}% breached maxDrawdown ${(strategy.risk.maxDrawdownPct * 100).toFixed(0)}%; entries halted`);
  }

  const rationale = buildRationale(strategy, rule, sentiment, action, confidence, riskBlocked);

  return {
    symbol: strategy.symbol,
    action,
    ruleAction: rule.action,
    confidence,
    sentiment,
    rationale,
    riskBlocked,
    riskNotes,
    price,
    generatedAt: new Date().toISOString(),
    usedAI,
    model,
  };
}

function buildRationale(
  strategy: Strategy,
  rule: RuleResult,
  sentiment: Sentiment,
  action: Action,
  confidence: number,
  riskBlocked: boolean,
): string {
  const parts = [
    `Rule (${strategy.kind}) → ${rule.action.toUpperCase()} [${rule.detail}].`,
    `News sentiment ${sentiment.label} (${sentiment.score.toFixed(2)}): ${sentiment.rationale}`,
    `Blended confidence ${(confidence * 100).toFixed(0)}%.`,
  ];
  if (riskBlocked) parts.push(`Risk manager overrode to ${action.toUpperCase()}.`);
  else parts.push(`Final signal: ${action.toUpperCase()}.`);
  parts.push("Research only — not financial advice.");
  return parts.join(" ");
}
