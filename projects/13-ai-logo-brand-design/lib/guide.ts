/**
 * Builds a standalone, self-contained HTML brand guide from a BrandKit.
 *
 * The output embeds the logo SVGs inline and references brand fonts via a
 * Google Fonts link so the downloaded file renders correctly on its own. This
 * is the exportable deliverable users pay for.
 */

import type { BrandKit } from "./types";
import { readableTextColor } from "./palette";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function googleFontsHref(kit: BrandKit): string {
  const families = [kit.typography.heading, kit.typography.body].map((f) => {
    const weights = f.weights.join(";");
    return `family=${encodeURIComponent(f.family)}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

export function buildBrandGuideHtml(kit: BrandKit): string {
  const { brief, palette, typography, voice } = kit;
  const bg = palette.colors.find((c) => c.role === "background")?.hex ?? "#fff";
  const primary =
    palette.colors.find((c) => c.role === "primary")?.hex ?? "#3563ff";
  const headingFont = `'${typography.heading.family}', ${typography.heading.fallback}`;
  const bodyFont = `'${typography.body.family}', ${typography.body.fallback}`;

  const swatches = palette.colors
    .map((c) => {
      const text = readableTextColor(c.hex);
      return `<div class="swatch" style="background:${c.hex};color:${text}">
        <span class="role">${esc(c.role)}</span>
        <span class="meta">${esc(c.name)}<br><code>${esc(c.hex)}</code></span>
      </div>`;
    })
    .join("");

  const logos = kit.concepts
    .map(
      (c) => `<figure class="logo">
        <div class="logo-canvas" style="background:${bg}">${c.svg}</div>
        <figcaption><strong>${esc(c.name)}</strong> · ${esc(
          c.style,
        )}<p>${esc(c.rationale)}</p></figcaption>
      </figure>`,
    )
    .join("");

  const rules = kit.usageRules.map((r) => `<li>${esc(r)}</li>`).join("");
  const dos = voice.dos.map((d) => `<li>${esc(d)}</li>`).join("");
  const donts = voice.donts.map((d) => `<li>${esc(d)}</li>`).join("");
  const tones = voice.tone
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brief.name)} — Brand Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${googleFontsHref(kit)}" rel="stylesheet">
<style>
  :root { --primary:${primary}; --bg:${bg}; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:${bodyFont}; color:#1f2937; background:#f8fafc; line-height:1.6; }
  .page { max-width:900px; margin:0 auto; padding:48px 24px; }
  h1,h2,h3 { font-family:${headingFont}; color:#0f172a; line-height:1.2; }
  h1 { font-size:40px; margin:0 0 4px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.1em; color:#64748b; margin:48px 0 16px; }
  .sub { color:#64748b; margin-top:0; }
  .cover { border-left:6px solid var(--primary); padding-left:20px; }
  .logos { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
  .logo { margin:0; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; background:#fff; }
  .logo-canvas { display:flex; align-items:center; justify-content:center; padding:24px; }
  .logo-canvas svg { max-width:220px; height:auto; }
  .logo figcaption { padding:16px; font-size:13px; color:#475569; }
  .logo figcaption p { margin:6px 0 0; }
  .swatches { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); }
  .swatch { border-radius:12px; padding:16px; min-height:120px; display:flex; flex-direction:column; justify-content:space-between; }
  .swatch .role { font-size:11px; text-transform:uppercase; letter-spacing:.08em; opacity:.85; }
  .swatch .meta { font-size:13px; }
  .swatch code { font-size:12px; }
  .type { display:grid; gap:16px; grid-template-columns:1fr 1fr; }
  .type .card { border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#fff; }
  .specimen-h { font-family:${headingFont}; font-size:32px; font-weight:700; margin:16px 0 8px; }
  .specimen-b { font-family:${bodyFont}; color:#475569; }
  .grid2 { display:grid; gap:24px; grid-template-columns:1fr 1fr; }
  .tag { display:inline-block; background:#eef2ff; color:#3730a3; border-radius:999px; padding:2px 10px; font-size:12px; margin:0 4px 4px 0; }
  ul { margin:8px 0; padding-left:18px; }
  .card { border:1px solid #e2e8f0; border-radius:12px; padding:20px; background:#fff; }
  footer { margin-top:48px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; }
  @media (max-width:640px){ .type,.grid2{grid-template-columns:1fr;} }
</style>
</head>
<body>
<div class="page">
  <header class="cover">
    <h1>${esc(brief.name)}</h1>
    <p class="sub">Brand Guide · ${esc(brief.industry)} · ${esc(
      brief.style,
    )}</p>
  </header>

  <h2>Logo concepts</h2>
  <div class="logos">${logos}</div>

  <h2>Color palette</h2>
  <div class="swatches">${swatches}</div>

  <h2>Typography</h2>
  <div class="type">
    <div class="card"><strong>Headings</strong><br><span style="font-family:${headingFont};font-size:22px">${esc(
      typography.heading.family,
    )}</span><br><small>${typography.heading.weights.join(
    ", ",
  )}</small></div>
    <div class="card"><strong>Body</strong><br><span style="font-family:${bodyFont};font-size:22px">${esc(
      typography.body.family,
    )}</span><br><small>${typography.body.weights.join(", ")}</small></div>
  </div>
  <p class="specimen-h">${esc(voice.sampleHeadline)}</p>
  <p class="specimen-b">${esc(voice.sampleBody)}</p>
  <p style="color:#64748b;font-style:italic">${esc(typography.rationale)}</p>

  <h2>Brand voice</h2>
  <div class="card">
    <div>${tones}</div>
    <h3 style="margin-top:12px">${esc(voice.archetype)}</h3>
    <p style="font-family:${headingFont};font-size:20px">“${esc(
      voice.tagline,
    )}”</p>
    <p>${esc(voice.elevatorPitch)}</p>
    <div class="grid2">
      <div><strong>Do</strong><ul>${dos}</ul></div>
      <div><strong>Don't</strong><ul>${donts}</ul></div>
    </div>
  </div>

  <h2>Usage rules</h2>
  <div class="card"><ul>${rules}</ul></div>

  <footer>
    Generated by AI Logo &amp; Brand Design Studio${
      kit.mocked ? " (demo mode)" : ""
    }. Verify originality and trademark availability before commercial use.
  </footer>
</div>
</body>
</html>`;
}
