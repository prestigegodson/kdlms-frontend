import { describe, expect, it } from "vitest";
import {
  contains,
  normalizeShape,
  resizeByStep,
  resizeRect,
  scalePolygon,
  shapeBounds,
  translateShape,
  type RectShape,
  type Shape,
} from "./geometry";

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

  describe("resizing", () => {
    const rect: RectShape = { kind: "RECT", x: 0.2, y: 0.2, w: 0.4, h: 0.2 };

    it("holds the opposite corner still whichever corner is dragged", () => {
      const nw = resizeRect(rect, "nw", { x: 0.1, y: 0.15 }, false);
      expect(nw).toMatchObject({ kind: "RECT", x: 0.1, y: 0.15 });
      expect(nw.kind === "RECT" && nw.x + nw.w).toBeCloseTo(0.6);
      expect(nw.kind === "RECT" && nw.y + nw.h).toBeCloseTo(0.4);

      const ne = resizeRect(rect, "ne", { x: 0.8, y: 0.1 }, false);
      expect(ne.kind === "RECT" && [ne.x, ne.y + ne.h]).toEqual([0.2, expect.closeTo(0.4)]);
      expect(ne.kind === "RECT" && ne.w).toBeCloseTo(0.6);

      const sw = resizeRect(rect, "sw", { x: 0.3, y: 0.5 }, false);
      expect(sw.kind === "RECT" && [sw.x, sw.y, sw.x + sw.w]).toEqual([0.3, 0.2, expect.closeTo(0.6)]);
    });

    it("flips the box when a corner is dragged past the opposite one", () => {
      const flipped = resizeRect(rect, "se", { x: 0.1, y: 0.1 }, false);
      expect(flipped.kind === "RECT" && [flipped.x, flipped.y]).toEqual([0.1, 0.1]);
      expect(flipped.kind === "RECT" && [flipped.w, flipped.h]).toEqual([expect.closeTo(0.1), expect.closeTo(0.1)]);
    });

    it("keeps the proportions when asked, and stays inside the image", () => {
      const kept = resizeRect(rect, "se", { x: 1, y: 0.3 }, true);
      expect(kept.kind === "RECT" && kept.w / kept.h).toBeCloseTo(2);
      expect(kept.kind === "RECT" && kept.x + kept.w).toBeLessThanOrEqual(1 + 1e-9);

      const tiny = resizeRect(rect, "se", { x: 0.2, y: 0.2 }, false);
      expect(tiny.kind === "RECT" && [tiny.w, tiny.h]).toEqual([0.01, 0.01]);
    });

    it("scales a free shape in proportion about the opposite box corner", () => {
      const scaled = scalePolygon(ell as Extract<Shape, { kind: "POLYGON" }>, "nw", { x: 0, y: 0.5 });
      const box = shapeBounds(scaled, 1);
      expect(box.x + box.w).toBeCloseTo(0.4);
      expect(box.y + box.h).toBeCloseTo(0.9);
      expect(box.w / box.h).toBeCloseTo(1);
      expect(box.w).toBeCloseTo(0.4);

      const capped = scalePolygon(ell as Extract<Shape, { kind: "POLYGON" }>, "se", { x: 1, y: 1 });
      const cappedBox = shapeBounds(capped, 1);
      expect(cappedBox.y + cappedBox.h).toBeCloseTo(1);
      expect(cappedBox.w / cappedBox.h).toBeCloseTo(1);
    });

    it("grows and shrinks a step at a time from the keyboard", () => {
      expect(resizeByStep(rect, 0.05, 0)).toEqual({ ...rect, w: expect.closeTo(0.45) });
      expect(resizeByStep(rect, 0, -0.05)).toEqual({ ...rect, h: expect.closeTo(0.15) });
      expect(resizeByStep({ kind: "CIRCLE", cx: 0.5, cy: 0.5, r: 0.1 }, -0.05, 0)).toEqual({
        kind: "CIRCLE",
        cx: 0.5,
        cy: 0.5,
        r: expect.closeTo(0.05),
      });
      const grown = shapeBounds(resizeByStep(ell, 0.03, 0), 1);
      expect(grown.w).toBeCloseTo(0.33);
      expect(grown.x + grown.w / 2).toBeCloseTo(0.25);
    });
  });
});
