import type { Shape } from "./geometry";

export type ShapeTone = "neutral" | "selected" | "correct" | "wrong" | "missed";

const TONES: Record<ShapeTone, string> = {
  neutral: "fill-slate-900/10 stroke-slate-700",
  selected: "fill-brand-500/25 stroke-brand-600",
  correct: "fill-green-500/25 stroke-green-700",
  wrong: "fill-red-500/20 stroke-red-700",
  missed: "fill-amber-400/20 stroke-amber-700",
};

export interface OverlayShape {
  key: string;
  shape: Shape;
  tone: ShapeTone;
  dashed?: boolean;
}

/**
 * Regions drawn over a `NormalizedImageStage`: an SVG whose viewBox is the unit square stretched to
 * the image, so a shape's normalized coordinates are its SVG coordinates. A circle is an ellipse
 * here because the square is stretched - its height is `r x aspect` of the image's height.
 */
export function ShapeOverlay({ shapes, aspect }: { shapes: OverlayShape[]; aspect: number }) {
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {shapes.map(({ key, shape, tone, dashed }) => {
        const common = {
          className: TONES[tone],
          strokeWidth: 2,
          vectorEffect: "non-scaling-stroke" as const,
          strokeDasharray: dashed ? "6 4" : undefined,
        };
        switch (shape.kind) {
          case "RECT":
            return <rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} {...common} />;
          case "CIRCLE":
            return (
              <ellipse
                key={key}
                cx={shape.cx}
                cy={shape.cy}
                rx={shape.r}
                ry={shape.r * (aspect > 0 ? aspect : 1)}
                {...common}
              />
            );
          case "POLYGON":
            return (
              <polygon
                key={key}
                points={shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
                {...common}
              />
            );
        }
      })}
    </svg>
  );
}
