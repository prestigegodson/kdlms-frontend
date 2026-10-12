import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Shape, ShapeKind } from "./geometry";
import { RegionEditor } from "./RegionEditor";

vi.mock("@/components/richText/AuthenticatedRichImage", () => ({ AuthenticatedRichImage: () => null }));

interface Region {
  id: string;
  shape: Shape;
}

const BOUNDS = { left: 0, top: 0, width: 500, height: 250, right: 500, bottom: 250, x: 0, y: 0, toJSON() {} } as DOMRect;

function Harness({
  initial,
  allowedKinds = ["RECT", "CIRCLE", "POLYGON"],
  onValue,
}: {
  initial: Region[];
  allowedKinds?: ShapeKind[];
  onValue(regions: Region[]): void;
}) {
  const [regions, setRegions] = useState(initial);
  let next = 0;
  return (
    <RegionEditor
      imageFileId="img"
      imageAspect={2}
      onImageChange={vi.fn()}
      regions={regions}
      onRegionsChange={(value) => {
        setRegions(value);
        onValue(value);
      }}
      createRegion={(shape) => ({ id: `new-${next++}`, shape })}
      allowedKinds={allowedKinds}
      maxRegions={5}
      regionName={(index) => `Region ${index + 1}`}
      renderRegionPanel={() => null}
      disabled={false}
    />
  );
}

function stage(): HTMLElement {
  const element = screen.getByRole("group", { name: /Drawing area/ });
  element.getBoundingClientRect = () => BOUNDS;
  return element;
}

describe("RegionEditor", () => {
  it("moves a region picked from the list with the arrow keys and deletes it", async () => {
    let latest: Region[] = [];
    render(
      <Harness
        initial={[
          { id: "a", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
          { id: "b", shape: { kind: "CIRCLE", cx: 0.6, cy: 0.6, r: 0.1 } },
        ]}
        onValue={(value) => (latest = value)}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Region 1" }));
    expect(screen.getByRole("button", { name: "Region 1" })).toHaveAttribute("aria-pressed", "true");
    expect(stage()).toHaveFocus();

    await user.keyboard("{ArrowRight}{Shift>}{ArrowDown}{/Shift}");
    const moved = latest[0].shape;
    expect(moved.kind === "RECT" && moved.x).toBeCloseTo(0.11);
    expect(moved.kind === "RECT" && moved.y).toBeCloseTo(0.15);

    await user.keyboard("{Delete}");
    expect(latest.map((region) => region.id)).toEqual(["b"]);
  });

  it("draws a rectangle by dragging across the image", () => {
    let latest: Region[] = [];
    render(<Harness initial={[]} onValue={(value) => (latest = value)} />);
    const area = stage();

    fireEvent.pointerDown(area, { clientX: 50, clientY: 25, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 150, clientY: 75, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 150, clientY: 75, pointerId: 1 });

    expect(latest).toHaveLength(1);
    const drawn = latest[0].shape;
    expect(drawn.kind).toBe("RECT");
    if (drawn.kind === "RECT") {
      expect([drawn.x, drawn.y, drawn.w, drawn.h].map((value) => value.toFixed(6))).toEqual(
        ["0.100000", "0.100000", "0.200000", "0.200000"],
      );
    }
  });

  it("keeps the browser's own image drag from cancelling a single press-and-drag", () => {
    let latest: Region[] = [];
    render(<Harness initial={[]} onValue={(value) => (latest = value)} />);
    const area = stage();

    expect(fireEvent.pointerDown(area, { clientX: 50, clientY: 25, pointerId: 1, button: 0 })).toBe(false);
    expect(fireEvent.dragStart(area)).toBe(false);
    expect(area).toHaveFocus();
    fireEvent.pointerMove(area, { clientX: 150, clientY: 75, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 150, clientY: 75, pointerId: 1 });

    expect(latest).toHaveLength(1);
  });

  it("ignores a right-click on the image", () => {
    let latest: Region[] = [];
    render(<Harness initial={[]} onValue={(value) => (latest = value)} />);
    const area = stage();

    fireEvent.pointerDown(area, { clientX: 50, clientY: 25, pointerId: 1, button: 2 });
    fireEvent.pointerMove(area, { clientX: 150, clientY: 75, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 150, clientY: 75, pointerId: 1 });

    expect(latest).toHaveLength(0);
  });

  it("ignores a click that draws next to nothing", () => {
    const onValue = vi.fn();
    render(<Harness initial={[]} onValue={onValue} />);
    const area = stage();

    fireEvent.pointerDown(area, { clientX: 50, clientY: 25, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 50, clientY: 25, pointerId: 1 });

    expect(onValue).not.toHaveBeenCalled();
  });

  it("builds a free shape corner by corner", async () => {
    let latest: Region[] = [];
    render(<Harness initial={[]} onValue={(value) => (latest = value)} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Free shape" }));
    const area = stage();
    fireEvent.pointerDown(area, { clientX: 50, clientY: 25 });
    fireEvent.pointerDown(area, { clientX: 250, clientY: 25 });
    expect(screen.getByRole("button", { name: "Finish shape" })).toBeDisabled();
    fireEvent.pointerDown(area, { clientX: 150, clientY: 200 });
    await user.click(screen.getByRole("button", { name: "Finish shape" }));

    expect(latest).toHaveLength(1);
    expect(latest[0].shape).toEqual({
      kind: "POLYGON",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.1 },
        { x: 0.3, y: 0.8 },
      ],
    });
  });

  it("offers only the shapes a type allows", () => {
    render(<Harness initial={[]} allowedKinds={["RECT"]} onValue={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Circle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Free shape" })).not.toBeInTheDocument();
  });

  describe("resize handles", () => {
    function handles(): string[] {
      return Array.from(document.querySelectorAll("[data-handle]")).map((el) => el.getAttribute("data-handle")!);
    }

    function dragHandle(name: string, clientX: number, clientY: number, shiftKey = false) {
      const area = stage();
      const handle = document.querySelector(`[data-handle="${name}"]`)!;
      fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
      fireEvent.pointerMove(area, { clientX, clientY, pointerId: 1, shiftKey });
      fireEvent.pointerUp(area, { pointerId: 1 });
    }

    it("puts a square handle on each corner of a rectangle, the opposite corner held still", async () => {
      let latest: Region[] = [];
      render(<Harness initial={[{ id: "a", shape: { kind: "RECT", x: 0.2, y: 0.2, w: 0.4, h: 0.4 } }]} onValue={(v) => (latest = v)} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Region 1" }));

      expect(handles()).toEqual(["nw", "ne", "se", "sw"]);
      dragHandle("nw", 50, 25);
      const shape = latest[0].shape;
      expect(shape).toMatchObject({ kind: "RECT", x: 0.1, y: 0.1 });
      expect(shape.kind === "RECT" && shape.x + shape.w).toBeCloseTo(0.6);
      expect(shape.kind === "RECT" && shape.y + shape.h).toBeCloseTo(0.6);
    });

    it("keeps a rectangle's proportions while Shift is held", async () => {
      let latest: Region[] = [];
      render(<Harness initial={[{ id: "a", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.1 } }]} onValue={(v) => (latest = v)} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Region 1" }));

      dragHandle("se", 300, 50, true);
      const shape = latest[0].shape;
      expect(shape.kind === "RECT" && shape.w / shape.h).toBeCloseTo(2);
    });

    it("resizes a circle from its top, right, bottom or left without moving its centre", async () => {
      let latest: Region[] = [];
      render(<Harness initial={[{ id: "a", shape: { kind: "CIRCLE", cx: 0.5, cy: 0.5, r: 0.1 } }]} onValue={(v) => (latest = v)} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Region 1" }));

      expect(handles()).toEqual(["n", "e", "s", "w"]);
      // 0.2 of the image's height above the centre is 0.1 of its width, the image being twice as wide.
      dragHandle("n", 250, 75);
      expect(latest[0].shape).toEqual({ kind: "CIRCLE", cx: 0.5, cy: 0.5, r: expect.closeTo(0.1) });
      dragHandle("w", 50, 125);
      expect(latest[0].shape).toEqual({ kind: "CIRCLE", cx: 0.5, cy: 0.5, r: expect.closeTo(0.4) });
    });

    it("boxes a free shape with four handles that scale it, besides its own corners", async () => {
      let latest: Region[] = [];
      const triangle: Shape = {
        kind: "POLYGON",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.4, y: 0.2 },
          { x: 0.2, y: 0.4 },
        ],
      };
      render(<Harness initial={[{ id: "a", shape: triangle }]} onValue={(v) => (latest = v)} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Region 1" }));

      expect(handles()).toEqual(["nw", "ne", "se", "sw", "v0", "v1", "v2"]);
      dragHandle("se", 300, 150);
      const points = latest[0].shape.kind === "POLYGON" ? latest[0].shape.points : [];
      expect(points.map(({ x, y }) => [x, y])).toEqual([
        [expect.closeTo(0.2), expect.closeTo(0.2)],
        [expect.closeTo(0.6), expect.closeTo(0.2)],
        [expect.closeTo(0.2), expect.closeTo(0.6)],
      ]);
    });

    it("resizes the selected region with Alt and the arrow keys, and still moves it without", async () => {
      let latest: Region[] = [];
      render(<Harness initial={[{ id: "a", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }]} onValue={(v) => (latest = v)} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Region 1" }));

      await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
      expect(latest[0].shape).toEqual({ kind: "RECT", x: 0.1, y: 0.1, w: expect.closeTo(0.21), h: 0.2 });
      await user.keyboard("{ArrowRight}");
      expect(latest[0].shape).toEqual({ kind: "RECT", x: expect.closeTo(0.11), y: 0.1, w: expect.closeTo(0.21), h: 0.2 });
    });
  });
});

