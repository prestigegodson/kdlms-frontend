import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toSequencePlayerView } from "./defaults";
import { SequencePlayer } from "./Player";
import { SequenceReview } from "./Review";
import type { SequenceConfig, SequencePlayerConfig } from "./types";

const config: SequenceConfig = {
  schemaVersion: 1,
  presentation: "TIMELINE",
  items: [
    { id: "a", html: "<p>Amalgamation</p>", caption: "1914" },
    { id: "b", html: "<p>Independence</p>", caption: "1960" },
    { id: "c", html: "<p>Republic</p>", caption: "1963" },
  ],
};

const shown: SequencePlayerConfig = {
  presentation: "LIST",
  items: [
    { id: "c", html: "<p>Republic</p>" },
    { id: "a", html: "<p>Amalgamation</p>" },
    { id: "b", html: "<p>Independence</p>" },
  ],
};

describe("SequencePlayer", () => {
  it("stays unanswered until the student keeps the order they were shown", async () => {
    const onChange = vi.fn();
    render(<SequencePlayer config={shown} value={null} onChange={onChange} disabled={false} />);

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Republic"),
      expect.stringContaining("Amalgamation"),
      expect.stringContaining("Independence"),
    ]);
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Keep this order" }));

    expect(onChange).toHaveBeenCalledWith({ order: ["c", "a", "b"] });
  });

  it("moves an item with the keyboard alone and announces where it went", async () => {
    const onChange = vi.fn();
    render(<SequencePlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    screen.getByRole("button", { name: "Move Amalgamation up" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ order: ["a", "c", "b"] });
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Amalgamation moved to position 1 of 3.");
  });

  it("shows a saved order, with no keep button and the ends' arrows disabled", () => {
    render(
      <SequencePlayer config={shown} value={{ order: ["a", "b", "c"] }} onChange={vi.fn()} disabled={false} />,
    );

    expect(screen.queryByRole("button", { name: "Keep this order" })).toBeNull();
    expect(screen.getByRole("button", { name: "Move Amalgamation up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Republic down" })).toBeDisabled();
  });

  it("offers no controls once disabled", () => {
    render(<SequencePlayer config={shown} value={null} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SequenceReview", () => {
  it("marks each of the student's pairs and shows the correct order with its captions", () => {
    render(
      <SequenceReview
        config={config}
        response={{ order: ["a", "c", "b"] }}
        parts={[
          { partId: "a", correct: false, expectedRef: "b", givenRef: "c" },
          { partId: "b", correct: false, expectedRef: "c", givenRef: null },
        ]}
        perspective="self"
      />,
    );

    expect(screen.getByText("Your order")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Next item wrong")).toHaveLength(2);
    expect(screen.getByText("1960")).toBeInTheDocument();
  });

  it("says so when the question was left unanswered", () => {
    render(<SequenceReview config={config} response={null} parts={[]} perspective="staff" />);

    expect(screen.getByText("No answer")).toBeInTheDocument();
  });
});

describe("toSequencePlayerView", () => {
  it("drops captions and never returns the correct order", () => {
    for (let i = 0; i < 20; i++) {
      const view = toSequencePlayerView(config);
      expect(view.items.map((item) => item.id)).not.toEqual(["a", "b", "c"]);
      expect(JSON.stringify(view)).not.toContain("caption");
    }
  });
});
