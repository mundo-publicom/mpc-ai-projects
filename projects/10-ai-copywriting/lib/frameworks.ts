/**
 * Copywriting frameworks.
 *
 * Each framework is a named, ordered set of persuasion "beats" the copy should
 * hit. We surface them three ways:
 *   1. The generator is told which framework to structure a variant around.
 *   2. The critique pass scores how well a variant executes its framework.
 *   3. The UI tags each variant with its framework so operators learn what works.
 *
 * Keeping these as data (not prose baked into a prompt) means the same
 * definitions drive generation, scoring, mock fallback, and the UI legend.
 */

export const FRAMEWORK_IDS = ["AIDA", "PAS", "FAB", "BAB", "4Ps"] as const;
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

export interface FrameworkBeat {
  /** Short label for the step, e.g. "Attention". */
  label: string;
  /** What this beat must accomplish in the copy. */
  intent: string;
}

export interface Framework {
  id: FrameworkId;
  name: string;
  /** One-line summary shown in the UI. */
  summary: string;
  /** Ordered beats the copy should move through. */
  beats: FrameworkBeat[];
  /** Copy types this framework tends to fit best (advisory, not enforced). */
  bestFor: string[];
}

export const FRAMEWORKS: Record<FrameworkId, Framework> = {
  AIDA: {
    id: "AIDA",
    name: "AIDA",
    summary: "Attention → Interest → Desire → Action.",
    beats: [
      { label: "Attention", intent: "Hook the reader with a bold, relevant opener." },
      { label: "Interest", intent: "Build curiosity with a benefit or intriguing detail." },
      { label: "Desire", intent: "Make them want the outcome — proof, emotion, specifics." },
      { label: "Action", intent: "Tell them exactly what to do next with a clear CTA." },
    ],
    bestFor: ["meta_ad", "landing_section", "nurture_email"],
  },
  PAS: {
    id: "PAS",
    name: "PAS",
    summary: "Problem → Agitate → Solution.",
    beats: [
      { label: "Problem", intent: "Name the pain the reader already feels." },
      { label: "Agitate", intent: "Twist the knife — stakes, cost of inaction, frustration." },
      { label: "Solution", intent: "Present the offer as the relief, then direct the action." },
    ],
    bestFor: ["cold_email", "meta_ad", "landing_section"],
  },
  FAB: {
    id: "FAB",
    name: "FAB",
    summary: "Features → Advantages → Benefits.",
    beats: [
      { label: "Feature", intent: "State a concrete capability of the product." },
      { label: "Advantage", intent: "Explain what that capability does better." },
      { label: "Benefit", intent: "Translate it into a tangible outcome the buyer cares about." },
    ],
    bestFor: ["product_description", "google_ad", "landing_section"],
  },
  BAB: {
    id: "BAB",
    name: "BAB",
    summary: "Before → After → Bridge.",
    beats: [
      { label: "Before", intent: "Describe the reader's current painful reality." },
      { label: "After", intent: "Paint the improved world once the problem is gone." },
      { label: "Bridge", intent: "Position the product as the path from Before to After." },
    ],
    bestFor: ["nurture_email", "landing_section", "meta_ad"],
  },
  "4Ps": {
    id: "4Ps",
    name: "4 Ps",
    summary: "Picture → Promise → Prove → Push.",
    beats: [
      { label: "Picture", intent: "Create a vivid mental image of the desired result." },
      { label: "Promise", intent: "Commit to delivering that result." },
      { label: "Prove", intent: "Back it with evidence — data, testimonial, guarantee." },
      { label: "Push", intent: "Create urgency and drive the click." },
    ],
    bestFor: ["landing_section", "nurture_email", "product_description"],
  },
};

export function getFramework(id: FrameworkId): Framework {
  return FRAMEWORKS[id];
}

/** Render a framework as a compact instruction block for a system prompt. */
export function describeFramework(id: FrameworkId): string {
  const f = FRAMEWORKS[id];
  const steps = f.beats.map((b, i) => `${i + 1}. ${b.label}: ${b.intent}`).join("\n");
  return `Framework "${f.name}" (${f.summary})\n${steps}`;
}

/**
 * Suggest a rotation of frameworks for a copy type so N variants explore
 * different persuasion structures instead of repeating one. Deterministic:
 * the mock generator and the UI legend can rely on the same ordering.
 */
export function frameworkRotation(copyType: string, count: number): FrameworkId[] {
  const preferred = FRAMEWORK_IDS.filter((id) =>
    FRAMEWORKS[id].bestFor.includes(copyType),
  );
  const pool = preferred.length > 0 ? preferred : [...FRAMEWORK_IDS];
  const out: FrameworkId[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[i % pool.length]);
  }
  return out;
}
