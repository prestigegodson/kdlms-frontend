/**
 * The TS twin of the backend's `domain.interaction.geometry` (interaction-quiz.md §4.3): regions of
 * an image in normalized coordinates - fractions of the image's natural width and height, 0..1 from
 * the top-left - so a region means the same place however large the image is drawn. `contains`
 * mirrors `Shape#contains` step for step; the hotspot golden fixtures hold the two to the same answers.
 */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export type RectShape = { kind: "RECT"; x: number; y: number; w: number; h: number };
export type CircleShape = { kind: "CIRCLE"; cx: number; cy: number; r: number };
export type PolygonShape = { kind: "POLYGON"; points: NormalizedPoint[] };
/** A circle's `r` is a fraction of the image's width, so it stays round given the image's aspect. */
export type Shape = RectShape | CircleShape | PolygonShape;
export type ShapeKind = Shape["kind"];

export const MIN_SIZE = 0.01;
export const MIN_POLYGON_POINTS = 3;
export const MAX_POLYGON_POINTS = 30;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function clampPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
}

/** Whether `point` is inside `shape`, boundary included; `aspect` is the image's width over its height. */
export function contains(shape: Shape, point: NormalizedPoint, aspect: number): boolean {
  const px = point.x;
  const py = point.y;
  switch (shape.kind) {
    case "RECT":
      return px >= shape.x && px <= shape.x + shape.w && py >= shape.y && py <= shape.y + shape.h;
    case "CIRCLE": {
      const dx = px - shape.cx;
      const dy = (py - shape.cy) / (aspect > 0 ? aspect : 1);
      return dx * dx + dy * dy <= shape.r * shape.r;
    }
    case "POLYGON":
      return polygonContains(shape.points, px, py);
  }
}

function polygonContains(points: NormalizedPoint[], px: number, py: number): boolean {
  const n = points.length;
  if (n < MIN_POLYGON_POINTS) {
    return false;
  }
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (onSegment(points[j], points[i], px, py)) {
      return true;
    }
  }
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function onSegment(a: NormalizedPoint, b: NormalizedPoint, px: number, py: number): boolean {
  const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
  return (
    cross === 0 &&
    px >= Math.min(a.x, b.x) &&
    px <= Math.max(a.x, b.x) &&
    py >= Math.min(a.y, b.y) &&
    py <= Math.max(a.y, b.y)
  );
}

/** `shape` moved and sized inside the image, never smaller than `MIN_SIZE` - the twin of `Shape#normalized`. */
export function normalizeShape(shape: Shape): Shape {
  switch (shape.kind) {
    case "RECT": {
      const x = clamp(shape.x, 0, 1 - MIN_SIZE);
      const y = clamp(shape.y, 0, 1 - MIN_SIZE);
      return { kind: "RECT", x, y, w: clamp(shape.w, MIN_SIZE, 1 - x), h: clamp(shape.h, MIN_SIZE, 1 - y) };
    }
    case "CIRCLE":
      return { kind: "CIRCLE", cx: clamp(shape.cx, 0, 1), cy: clamp(shape.cy, 0, 1), r: clamp(shape.r, MIN_SIZE, 0.5) };
    case "POLYGON":
      return { kind: "POLYGON", points: shape.points.map(clampPoint) };
  }
}

/** `shape` moved by `dx`/`dy`, kept whole inside the image. */
export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.kind) {
    case "RECT":
      return {
        ...shape,
        x: clamp(shape.x + dx, 0, 1 - shape.w),
        y: clamp(shape.y + dy, 0, 1 - shape.h),
      };
    case "CIRCLE":
      return { ...shape, cx: clamp(shape.cx + dx, 0, 1), cy: clamp(shape.cy + dy, 0, 1) };
    case "POLYGON": {
      const xs = shape.points.map((point) => point.x);
      const ys = shape.points.map((point) => point.y);
      const mx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs));
      const my = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys));
      return { kind: "POLYGON", points: shape.points.map((point) => ({ x: point.x + mx, y: point.y + my })) };
    }
  }
}

/** The box around `shape` in normalized coordinates - where to place a zone's drop target or a badge. */
export function shapeBounds(shape: Shape, aspect: number): { x: number; y: number; w: number; h: number } {
  switch (shape.kind) {
    case "RECT":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "CIRCLE": {
      const ry = shape.r * (aspect > 0 ? aspect : 1);
      return { x: shape.cx - shape.r, y: shape.cy - ry, w: 2 * shape.r, h: 2 * ry };
    }
    case "POLYGON": {
      const xs = shape.points.map((point) => point.x);
      const ys = shape.points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
  }
}

/** Where on `element` a pointer is, in normalized coordinates - `null` when it has no size yet. */
export function pointOn(element: Element, clientX: number, clientY: number): NormalizedPoint | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return clampPoint({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
}

/** A percentage for a CSS `left`/`top`/`width`/`height`. */
export function percent(value: number): string {
  return `${value * 100}%`;
}
