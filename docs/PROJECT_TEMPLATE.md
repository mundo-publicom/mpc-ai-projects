# Project Template

Reference skeleton each `projects/NN-slug` follows. Copy, then specialize.

## Baseline files

**`package.json`**
```json
{
  "name": "@mmai/<slug>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ai": "^5.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**`lib/ai.ts`** — every project shares this model-access pattern:
```ts
import { generateText, generateObject } from "ai";

// Routed through Vercel AI Gateway via "provider/model" strings.
export const MODELS = {
  fast: "anthropic/claude-haiku-4-5",
  smart: "anthropic/claude-sonnet-5",
  frontier: "anthropic/claude-opus-4-8",
} as const;

export const hasAI = () =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
```

Scaffolds degrade gracefully: when `hasAI()` is false, API routes return realistic mock data so
the demo runs with zero keys.

## Required docs
- `docs/PRD.md`, `docs/TECHNICAL_SPEC.md`, `docs/ARCHITECTURE.md` (see CONVENTIONS.md).

## Required app surface
- `app/page.tsx` — landing/dashboard that demonstrates the value prop.
- At least one `app/api/*/route.ts` implementing the core logic for real.
- `README.md` — business case first, then features, quickstart, roadmap.
