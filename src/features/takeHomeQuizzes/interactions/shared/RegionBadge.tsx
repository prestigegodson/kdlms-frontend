import { clamp, percent, type NormalizedPoint, type Shape } from "./geometry";

/** A region's number, at its top-left corner. */
export function RegionBadge({ shape, aspect, number }: { shape: Shape; aspect: number; number: number }) {
  const anchor = badgeAnchor(shape, aspect);
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute flex h-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white"
      style={{ left: percent(anchor.x), top: percent(anchor.y) }}
    >
      {number}
    </span>
  );
}

function badgeAnchor(shape: Shape, aspect: number): NormalizedPoint {
  switch (shape.kind) {
    case "RECT":
      return { x: shape.x, y: shape.y };
    case "CIRCLE":
      return { x: shape.cx, y: clamp(shape.cy - shape.r * aspect, 0, 1) };
    case "POLYGON":
      return shape.points[0] ?? { x: 0, y: 0 };
  }
}
