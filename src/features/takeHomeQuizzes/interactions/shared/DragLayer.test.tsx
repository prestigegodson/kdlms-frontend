import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DragLayer } from "./DragLayer";
import { placementOf } from "./dragLayerContext";
import { Draggable } from "./Draggable";
import { Droppable } from "./Droppable";
import { LiveAnnouncer } from "./LiveAnnouncer";

const NAMES: Record<string, string> = {
  copper: "Copper",
  oxygen: "Oxygen",
  metals: "Metals",
  gases: "Gases",
};

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  return (
    <LiveAnnouncer>
      <DragLayer
        disabled={disabled}
        describe={(id) => NAMES[id] ?? id}
        onPlace={(itemId, targetId) =>
          setPlacements((current) => ({ ...current, [itemId]: targetId }))
        }
      >
        <Draggable id="copper">Copper</Draggable>
        <Draggable id="oxygen">Oxygen</Draggable>
        <Droppable id="metals" label="Metals">
          Metals
        </Droppable>
        <Droppable id="gases" label="Gases">
          Gases
        </Droppable>
      </DragLayer>
      <output data-testid="placements">
        {Object.entries(placements)
          .map(([item, target]) => `${item}:${target}`)
          .join("|")}
      </output>
    </LiveAnnouncer>
  );
}

describe("DragLayer", () => {
  it("places an item by tapping it, then a target, and announces both steps", async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Copper"));
    expect(screen.getByText("Copper")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Copper picked up.");

    await user.click(screen.getByRole("button", { name: "Metals" }));

    expect(screen.getByTestId("placements")).toHaveTextContent("copper:metals");
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Copper placed in Metals.");
    expect(screen.getByText("Copper")).toHaveAttribute("aria-pressed", "false");
  });

  it("places an item with the keyboard alone", async () => {
    render(<Harness />);
    const user = userEvent.setup();

    screen.getByText("Oxygen").focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Gases" }).focus();
    await user.keyboard(" ");

    expect(screen.getByTestId("placements")).toHaveTextContent("oxygen:gases");
  });

  it("cancels a pick-up on Escape or a second tap", async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Copper"));
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Copper put back.");
    await user.click(screen.getByRole("button", { name: "Metals" }));

    await user.click(screen.getByText("Oxygen"));
    await user.click(screen.getByText("Oxygen"));
    await user.click(screen.getByRole("button", { name: "Gases" }));

    expect(screen.getByTestId("placements")).toBeEmptyDOMElement();
  });

  it("ignores taps while disabled", async () => {
    render(<Harness disabled />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Copper"));
    await user.click(screen.getByRole("button", { name: "Metals" }));

    expect(screen.getByTestId("placements")).toBeEmptyDOMElement();
    expect(screen.getByText("Copper")).toHaveAttribute("tabindex", "-1");
  });

  it("turns a finished drag into a placement, or none when dropped nowhere", () => {
    const active = { id: "copper" } as Parameters<typeof placementOf>[0]["active"];
    const over = { id: "metals" } as NonNullable<Parameters<typeof placementOf>[0]["over"]>;

    expect(placementOf({ active, over })).toEqual({ itemId: "copper", targetId: "metals" });
    expect(placementOf({ active, over: null })).toBeNull();
  });
});
