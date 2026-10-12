import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HotspotPlayer } from "./Player";
import { HotspotReview } from "./Review";
import type { HotspotConfig, HotspotPlayerConfig, HotspotResponse } from "./types";

const shown: HotspotPlayerConfig = { imageFileId: "img", imageAspect: 2, maxPins: 2 };

const config: HotspotConfig = {
  schemaVersion: 1,
  imageFileId: "img",
  imageAspect: 1,
  maxPins: 3,
  regions: [
    { id: "lagos", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, target: true, label: "<p>Lagos</p>" },
    { id: "abuja", shape: { kind: "CIRCLE", cx: 0.6, cy: 0.6, r: 0.05 }, target: true, label: null },
    { id: "sea", shape: { kind: "RECT", x: 0, y: 0.8, w: 1, h: 0.2 }, target: false, label: "<p>The Atlantic</p>" },
  ],
};

function lastPins(onChange: ReturnType<typeof vi.fn>): HotspotResponse["pins"] {
  return (onChange.mock.lastCall?.[0] as HotspotResponse).pins;
}

describe("HotspotPlayer", () => {
  it("drops a pin where the image is tapped", () => {
    const onChange = vi.fn();
    render(<HotspotPlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const stage = screen.getByRole("application");
    stage.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON() {} }) as DOMRect;

    fireEvent.click(stage, { clientX: 200, clientY: 100 });

    expect(onChange).toHaveBeenCalledWith({ pins: [{ x: 0.25, y: 0.25 }] });
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Pin 1 placed.");
  });

  it("moves a cursor with the arrow keys and drops a pin with Enter", async () => {
    const onChange = vi.fn();
    render(<HotspotPlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole("application")).toHaveFocus();
    expect(screen.getByTestId("hotspot-cursor")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}{Enter}");

    const [pin] = lastPins(onChange);
    expect(pin.x).toBeCloseTo(0.54);
    expect(pin.y).toBeCloseTo(0.6);
  });

  it("removes a pin when it is tapped and stops at the pin allowance", async () => {
    const onChange = vi.fn();
    const value = { pins: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.7 }] };
    render(<HotspotPlayer config={shown} value={value} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    screen.getByRole("application").focus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("All 2 pins are placed.");

    await user.click(screen.getByRole("button", { name: "Remove pin 1" }));
    expect(onChange).toHaveBeenCalledWith({ pins: [{ x: 0.7, y: 0.7 }] });
  });

  it("drops nothing while disabled", async () => {
    const onChange = vi.fn();
    render(<HotspotPlayer config={shown} value={{ pins: [{ x: 0.2, y: 0.2 }] }} onChange={onChange} disabled />);

    fireEvent.keyDown(screen.getByRole("application"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove pin 1" })).toBeDisabled();
  });
});

describe("HotspotReview", () => {
  it("marks each target and says where a stray pin landed", () => {
    render(
      <HotspotReview
        config={config}
        response={{ pins: [{ x: 0.15, y: 0.15 }, { x: 0.5, y: 0.9 }] }}
        parts={[
          { partId: "lagos", correct: true, expectedRef: "lagos", givenRef: "0" },
          { partId: "abuja", correct: false, expectedRef: "abuja", givenRef: null },
        ]}
        perspective="self"
      />,
    );

    expect(screen.getByText("found by pin 1")).toBeInTheDocument();
    expect(screen.getByText("missed")).toBeInTheDocument();
    expect(screen.getByText(/Your pin 2 is not on a target/)).toBeInTheDocument();
    expect(screen.getByText("The Atlantic")).toBeInTheDocument();
  });
});
