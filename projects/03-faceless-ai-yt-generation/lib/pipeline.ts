import { generateObject, hasAI, MODELS } from "@/lib/ai";
import {
  PIPELINE_STAGES,
  ScriptSchema,
  type Asset,
  type GenerateScriptRequest,
  type PipelineStage,
  type Script,
  type StageStatus,
  type VoiceProfile,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Credit economics — the unit customers are billed in                       */
/* -------------------------------------------------------------------------- */

/** Credit cost per unit of work. Tuned so 1 credit ≈ $0.01 of provider spend. */
export const CREDIT_COSTS = {
  scriptGeneration: 5,
  /** TTS billed per spoken second. */
  voiceoverPerSecond: 0.2,
  /** Image/B-roll billed per scene. */
  visualPerScene: 4,
  captions: 2,
  thumbnail: 6,
  /** Render/assembly billed per output second. */
  assemblyPerSecond: 0.5,
  publish: 1,
} as const;

/** Rough credit estimate before a script exists (used at enqueue time). */
export function estimateCreditsFromParams(params: {
  targetLengthSec: number;
  format: GenerateScriptRequest["format"];
}): number {
  const secs = params.targetLengthSec;
  const approxScenes = Math.max(3, Math.round(secs / (params.format === "short" ? 4 : 8)));
  return Math.round(
    CREDIT_COSTS.scriptGeneration +
      secs * CREDIT_COSTS.voiceoverPerSecond +
      approxScenes * CREDIT_COSTS.visualPerScene +
      CREDIT_COSTS.captions +
      CREDIT_COSTS.thumbnail +
      secs * CREDIT_COSTS.assemblyPerSecond +
      CREDIT_COSTS.publish,
  );
}

/** Precise credit estimate once the script (and its scenes) is known. */
export function estimateCreditsFromScript(script: Script): number {
  const totalSecs = script.scenes.reduce((s, sc) => s + sc.durationSec, 0);
  return Math.round(
    CREDIT_COSTS.scriptGeneration +
      totalSecs * CREDIT_COSTS.voiceoverPerSecond +
      script.scenes.length * CREDIT_COSTS.visualPerScene +
      CREDIT_COSTS.captions +
      CREDIT_COSTS.thumbnail +
      totalSecs * CREDIT_COSTS.assemblyPerSecond +
      CREDIT_COSTS.publish,
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage bookkeeping                                                          */
/* -------------------------------------------------------------------------- */

export function initialStages(scriptAlreadyDone: boolean): StageStatus[] {
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    state: scriptAlreadyDone && stage === "script" ? "done" : "pending",
    progress: scriptAlreadyDone && stage === "script" ? 100 : 0,
  }));
}

/** Human copy shown per stage while it runs. */
const STAGE_MESSAGES: Record<PipelineStage, string> = {
  script: "Drafting hook, scenes and SEO metadata",
  voiceover: "Synthesizing AI narration track",
  visuals: "Generating B-roll images per scene",
  captions: "Force-aligning kinetic captions to audio",
  thumbnail: "Rendering thumbnail concept",
  assembly: "Compositing timeline with ffmpeg",
  publish: "Uploading to YouTube (unlisted)",
};

export function stageMessage(stage: PipelineStage): string {
  return STAGE_MESSAGES[stage];
}

/* -------------------------------------------------------------------------- */
/*  Script generation (the one real AI call in the scaffold)                   */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are a senior faceless-YouTube scriptwriter and retention strategist.
You write tight, high-retention narration for videos with no on-camera host — every frame is
B-roll, AI imagery, or motion graphics driven by voiceover.

Rules:
- Open with a pattern-interrupt hook that pays off within the first 3 seconds.
- Each scene = one visual idea + 1-3 spoken sentences. Keep narration conversational and punchy.
- visualPrompt must be a concrete, model-ready image/video prompt (subject, setting, style, lighting).
- onScreenText is a SHORT kinetic caption (a few words), never the full narration.
- Size the number of scenes to hit the requested target length (~8s/scene long-form, ~4s short).
- Never invent statistics as fact; frame claims as generally-known or clearly illustrative.
- Titles and thumbnail text must be curiosity-driven but not clickbait-dishonest.`;

/**
 * Generate a structured storyboard for a topic. Uses AI SDK v5 `generateObject`
 * with the shared zod schema; falls back to deterministic mock data when no AI
 * key is configured so the demo runs with zero secrets.
 */
export async function generateScript(
  req: GenerateScriptRequest,
): Promise<{ script: Script; usedAI: boolean }> {
  if (!hasAI()) {
    return { script: mockScript(req), usedAI: false };
  }

  // Clamp to the ScriptSchema bound (3..30 scenes) so generateObject validates.
  const sceneTarget = Math.min(
    30,
    Math.max(3, Math.round(req.targetLengthSec / (req.format === "short" ? 4 : 8))),
  );

  const { object } = await generateObject({
    model: MODELS.smart,
    schema: ScriptSchema,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    prompt: `Write a faceless YouTube ${req.format} video.

Topic: ${req.topic}
Niche: ${req.niche}
Aspect ratio: ${req.aspectRatio}
Target length: ${req.targetLengthSec} seconds (~${sceneTarget} scenes)

Produce the title, a 3-second hook, ${sceneTarget} scenes (each with narration, a model-ready
visual prompt, a short on-screen caption, a B-roll treatment, and an estimated duration in
seconds), a closing call-to-action, an SEO description, 8-15 tags, and a thumbnail concept.`,
  });

  return { script: object, usedAI: true };
}

/** Deterministic, realistic mock storyboard for key-free demos. */
export function mockScript(req: GenerateScriptRequest): Script {
  const sceneCount = Math.min(
    8,
    Math.max(3, Math.round(req.targetLengthSec / (req.format === "short" ? 4 : 8))),
  );
  const perScene = Math.round(req.targetLengthSec / sceneCount);
  const t = req.topic.trim();

  const beats = [
    { title: "The Hook", angle: `why ${t} matters more than you think` },
    { title: "The Setup", angle: `the surprising origin behind ${t}` },
    { title: "The Turn", angle: `what almost everyone gets wrong about ${t}` },
    { title: "The Evidence", angle: `a concrete example that makes ${t} click` },
    { title: "The Mechanism", angle: `how ${t} actually works under the hood` },
    { title: "The Stakes", angle: `what happens if you ignore ${t}` },
    { title: "The Payoff", angle: `the one takeaway about ${t} to remember` },
    { title: "The Close", angle: `where to go next with ${t}` },
  ];

  const scenes = Array.from({ length: sceneCount }, (_, i) => {
    const b = beats[i % beats.length];
    return {
      index: i + 1,
      title: b.title,
      narration:
        i === 0
          ? `Here's ${b.angle} — and by the end of this video it'll change how you see it.`
          : `${capitalize(b.angle)}. Watch closely, because this is where it gets interesting.`,
      visualPrompt: `Cinematic ${req.niche} B-roll illustrating "${b.angle}", ${
        req.aspectRatio
      } framing, dramatic volumetric lighting, shallow depth of field, high detail, no text`,
      onScreenText: b.title.toUpperCase(),
      broll: (i % 3 === 0 ? "ai-image" : i % 3 === 1 ? "stock-video" : "motion-graphic") as
        | "ai-image"
        | "stock-video"
        | "motion-graphic"
        | "screen-capture",
      durationSec: Math.max(3, Math.min(30, perScene)),
    };
  });

  return {
    title: `The Truth About ${capitalize(t)} (Explained in ${
      req.format === "short" ? "60s" : Math.round(req.targetLengthSec / 60) + " min"
    })`,
    hook: `Most people are completely wrong about ${t}. Here's what's really going on.`,
    scenes,
    callToAction: `If this reframed ${t} for you, subscribe — the next video goes even deeper.`,
    description: `A faceless ${req.niche} deep-dive into ${t}. We break down the hook, the mechanism, and the one takeaway that matters. Generated with the Faceless AI YouTube pipeline.\n\nChapters, sources and more in the description.`,
    tags: [
      req.niche,
      t.toLowerCase(),
      "explained",
      "faceless youtube",
      "documentary",
      "ai narration",
      "educational",
      "deep dive",
    ],
    thumbnailConcept: {
      visual: `Bold high-contrast ${req.niche} scene depicting ${t}, single focal subject, dramatic rim lighting, arrow/circle emphasis, space for large left-aligned overlay text`,
      overlayText: capitalize(t).slice(0, 24),
    },
  };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/* -------------------------------------------------------------------------- */
/*  Downstream stage stubs (real integration points)                          */
/* -------------------------------------------------------------------------- */

/**
 * Voiceover stage. In production this calls ElevenLabs (or another TTS
 * provider) per scene and stores audio assets. The stub returns placeholder
 * assets so the pipeline stays coherent without keys.
 */
export async function synthesizeVoiceover(
  script: Script,
  voice: VoiceProfile,
): Promise<Asset[]> {
  // Real impl: POST audio to ElevenLabs /v1/text-to-speech/{voice_id}, upload
  // the returned mp3 to blob storage, and record byte size + credit cost.
  return script.scenes.map((scene) => ({
    id: `vo_${scene.index}`,
    kind: "voiceover",
    sceneIndex: scene.index,
    mimeType: "audio/mpeg",
    provider: voice.provider,
    creditCost: scene.durationSec * CREDIT_COSTS.voiceoverPerSecond,
  }));
}

/** Image/B-roll stage. Real impl calls an image model per scene. */
export async function generateVisuals(script: Script): Promise<Asset[]> {
  return script.scenes.map((scene) => ({
    id: `img_${scene.index}`,
    kind: "image",
    sceneIndex: scene.index,
    mimeType: "image/png",
    provider: "image-provider",
    creditCost: CREDIT_COSTS.visualPerScene,
  }));
}

/** Default in-app voice profile used when a project has not configured one. */
export const DEFAULT_VOICE: VoiceProfile = {
  id: "voice_default",
  name: "Narrator — Deep Documentary",
  providerVoiceId: "mock-voice",
  provider: "mock",
  language: "en-US",
  stability: 0.6,
  style: "authoritative, measured, cinematic",
};
