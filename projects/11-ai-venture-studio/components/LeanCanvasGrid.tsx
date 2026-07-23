import type { LeanCanvas } from "@/lib/types";
import { toRenderableCanvas } from "@/lib/canvas";

interface LeanCanvasGridProps {
  canvas: LeanCanvas;
}

/**
 * Renders a {@link LeanCanvas} in its canonical nine-block grid on wide
 * screens, collapsing to a single readable column on small screens.
 */
export function LeanCanvasGrid({ canvas }: LeanCanvasGridProps) {
  const blocks = toRenderableCanvas(canvas);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[720px] gap-2 lg:min-w-0"
        style={{
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gridTemplateRows: "repeat(3, minmax(120px, auto))",
        }}
      >
        {blocks.map((block) => (
          <div
            key={block.key}
            className="flex flex-col rounded-lg border border-slate-200 bg-white p-3"
            style={{
              gridColumn: `${block.col} / span ${block.colSpan}`,
              gridRow: `${block.row} / span ${block.rowSpan}`,
            }}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              {block.label}
            </h4>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {block.lines.length === 0 ? (
                <li className="text-slate-300">—</li>
              ) : (
                block.lines.map((line, i) => (
                  <li key={i} className="leading-snug">
                    {block.lines.length > 1 && (
                      <span className="mr-1 text-brand-400">•</span>
                    )}
                    {line}
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
