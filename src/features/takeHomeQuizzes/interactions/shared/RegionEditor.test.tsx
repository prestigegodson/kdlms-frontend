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
});
