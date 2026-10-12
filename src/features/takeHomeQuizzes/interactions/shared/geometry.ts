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

/** A corner of a shape's box - the resize handle being dragged; the opposite corner stays put. */
export type BoxCorner = "nw" | "ne" | "se" | "sw";

/** Where `corner` of a box is, and where the corner opposite it is. */
function corners(box: { x: number; y: number; w: number; h: number }, corner: BoxCorner) {
  const left = box.x;
  const right = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  return {
    handle: { x: west ? left : right, y: north ? top : bottom },
    anchor: { x: west ? right : left, y: north ? bottom : top },
  };
}

/**
 * `original` resized by dragging `corner` to `point`, its opposite corner held still. Dragging past
 * that corner flips the box rather than breaking it; `keepRatio` (Shift) keeps its width over height.
 */
export function resizeRect(original: RectShape, corner: BoxCorner, point: NormalizedPoint, keepRatio: boolean): Shape {
  const { anchor } = corners(original, corner);
  let far = point;
  if (keepRatio && original.w > 0 && original.h > 0) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    // Equal factors on normalized axes keep the on-screen ratio too: pixels are nx·W and ny·H.
    const room = Math.min(
      (sx < 0 ? anchor.x : 1 - anchor.x) / original.w,
      (sy < 0 ? anchor.y : 1 - anchor.y) / original.h,
    );
    const scale = Math.min(Math.max(Math.abs(dx) / original.w, Math.abs(dy) / original.h), room);
    far = { x: anchor.x + sx * scale * original.w, y: anchor.y + sy * scale * original.h };
  }
  return normalizeShape({
    kind: "RECT",
    x: Math.min(anchor.x, far.x),
    y: Math.min(anchor.y, far.y),
    w: Math.abs(far.x - anchor.x),
    h: Math.abs(far.y - anchor.y),
  });
}

/** `original` scaled in proportion by dragging `corner` of its box to `point`, the opposite corner held still. */
export function scalePolygon(original: PolygonShape, corner: BoxCorner, point: NormalizedPoint): PolygonShape {
  const box = shapeBounds(original, 1);
  const { handle, anchor } = corners(box, corner);
  const spanX = handle.x - anchor.x;
  const spanY = handle.y - anchor.y;
  const ratios = [
    spanX !== 0 ? (point.x - anchor.x) / spanX : 0,
    spanY !== 0 ? (point.y - anchor.y) / spanY : 0,
  ];
  const largest = Math.max(box.w, box.h);
  const min = largest > 0 ? MIN_SIZE / largest : 1;
  // The handle may only travel as far as the image's edge in the direction it points.
  const maxX = spanX > 0 ? (1 - anchor.x) / spanX : spanX < 0 ? anchor.x / -spanX : Infinity;
  const maxY = spanY > 0 ? (1 - anchor.y) / spanY : spanY < 0 ? anchor.y / -spanY : Infinity;
  const scale = clamp(Math.max(...ratios), min, Math.max(min, Math.min(maxX, maxY)));
  return {
    kind: "POLYGON",
    points: original.points.map((p) =>
      clampPoint({ x: anchor.x + (p.x - anchor.x) * scale, y: anchor.y + (p.y - anchor.y) * scale }),
    ),
  };
}

/**
 * `shape` grown (positive) or shrunk (negative) by a keyboard step: a rectangle's width and height
 * with its top-left held still, a circle's radius about its centre, a free shape in proportion about
 * its box's centre. `dw`/`dh` are fractions of the image's width and height.
 */
export function resizeByStep(shape: Shape, dw: number, dh: number): Shape {
  switch (shape.kind) {
    case "RECT":
      return normalizeShape({ ...shape, w: shape.w + dw, h: shape.h + dh });
    case "CIRCLE":
      return normalizeShape({ ...shape, r: shape.r + (dw !== 0 ? dw : dh) });
    case "POLYGON": {
      const box = shapeBounds(shape, 1);
      const step = dw !== 0 ? dw : dh;
      const span = dw !== 0 ? box.w : box.h;
      if (span <= 0) {
        return shape;
      }
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const largest = Math.max(box.w, box.h);
      let scale = Math.max(1 + step / span, MIN_SIZE / largest);
      // Growing stops at the image's edge, so the shape keeps its proportions rather than squashing.
      const half = { x: box.w / 2, y: box.h / 2 };
      if (scale > 1) {
        const roomX = half.x > 0 ? Math.min(cx, 1 - cx) / half.x : Infinity;
        const roomY = half.y > 0 ? Math.min(cy, 1 - cy) / half.y : Infinity;
        scale = Math.max(1, Math.min(scale, roomX, roomY));
      }
      return {
        kind: "POLYGON",
        points: shape.points.map((p) => clampPoint({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale })),
      };
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
