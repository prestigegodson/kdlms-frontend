import { describe, expect, it } from "vitest";
import { contains, normalizeShape, shapeBounds, translateShape, type Shape } from "./geometry";

const ell: Shape = {
  kind: "POLYGON",
  points: [
    { x: 0.1, y: 0.6 },
    { x: 0.4, y: 0.6 },
    { x: 0.4, y: 0.9 },
    { x: 0.3, y: 0.9 },
    { x: 0.3, y: 0.7 },
    { x: 0.1, y: 0.7 },
  ],
};

describe("geometry", () => {
  it("counts a rect's edges as inside", () => {
    const rect: Shape = { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    expect(contains(rect, { x: 0.3, y: 0.2 }, 1)).toBe(true);
    expect(contains(rect, { x: 0.31, y: 0.2 }, 1)).toBe(false);
  });

  it("keeps a circle round on a non-square image", () => {
    const circle: Shape = { kind: "CIRCLE", cx: 0.5, cy: 0.5, r: 0.1 };
    expect(contains(circle, { x: 0.5, y: 0.68 }, 2)).toBe(true);
    expect(contains(circle, { x: 0.5, y: 0.68 }, 1)).toBe(false);
    expect(shapeBounds(circle, 2)).toEqual({ x: 0.4, y: 0.3, w: 0.2, h: 0.4 });
  });

  it("leaves a concave polygon's notch outside and its edges inside", () => {
    expect(contains(ell, { x: 0.2, y: 0.65 }, 1)).toBe(true);
    expect(contains(ell, { x: 0.2, y: 0.8 }, 1)).toBe(false);
    expect(contains(ell, { x: 0.4, y: 0.75 }, 1)).toBe(true);
  });

  it("moves a shape only as far as the image's edge", () => {
    expect(translateShape({ kind: "RECT", x: 0.8, y: 0.1, w: 0.1, h: 0.1 }, 0.5, -0.5)).toEqual({
      kind: "RECT",
      x: 0.9,
      y: 0,
      w: 0.1,
      h: 0.1,
    });
    const moved = translateShape(ell, -0.5, 0);
    expect(shapeBounds(moved, 1).x).toBe(0);
    expect(moved.kind === "POLYGON" && moved.points[1].x).toBeCloseTo(0.3);
  });

  it("clamps a shape onto the image like the server does", () => {
    expect(normalizeShape({ kind: "CIRCLE", cx: 1.5, cy: -1, r: 0.9 })).toEqual({ kind: "CIRCLE", cx: 1, cy: 0, r: 0.5 });
    expect(normalizeShape({ kind: "RECT", x: -0.2, y: 0.95, w: 2, h: 0 })).toEqual({
      kind: "RECT",
      x: 0,
      y: 0.95,
      w: 1,
      h: 0.01,
    });
  });
});
