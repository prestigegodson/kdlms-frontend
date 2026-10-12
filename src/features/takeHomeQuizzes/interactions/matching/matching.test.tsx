import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toMatchingPlayerView } from "./defaults";
import { MatchingPlayer } from "./Player";
import { MatchingReview } from "./Review";
import type { MatchingConfig, MatchingPlayerConfig } from "./types";

const config: MatchingConfig = {
  schemaVersion: 1,
  lefts: [
    { id: "l1", html: "<p>Lagos</p>", rightId: "r1" },
    { id: "l2", html: "<p>Kano</p>", rightId: "r2" },
  ],
  rights: [
    { id: "r1", html: "<p>South-west</p>" },
    { id: "r2", html: "<p>North-west</p>" },
    { id: "rx", html: "<p>North-east</p>" },
  ],
  reuseRights: false,
};

const shown: MatchingPlayerConfig = {
  lefts: [
    { id: "l1", html: "<p>Lagos</p>" },
    { id: "l2", html: "<p>Kano</p>" },
  ],
  rights: [
    { id: "rx", html: "<p>North-east</p>" },
    { id: "r1", html: "<p>South-west</p>" },
    { id: "r2", html: "<p>North-west</p>" },
  ],
  reuseRights: false,
};

describe("MatchingPlayer", () => {
  it("pairs an answer with a prompt by tapping the answer, then the prompt's slot", async () => {
    const onChange = vi.fn();
    render(<MatchingPlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByText("South-west"));
    await user.click(screen.getByRole("button", { name: "Answer for Lagos" }));

    expect(onChange).toHaveBeenCalledWith({ pairs: { l1: "r1" } });
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("South-west placed in the answer for Lagos.");
  });

  it("pairs with the keyboard alone", async () => {
    const onChange = vi.fn();
    render(<MatchingPlayer config={shown} value={{ pairs: { l1: "r1" } }} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    screen.getByRole("button", { name: /North-east/ }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Answer for Kano" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ pairs: { l1: "r1", l2: "rx" } });
  });

  it("takes a placed answer out of the bank, and clears it again", async () => {
    const onChange = vi.fn();
    render(<MatchingPlayer config={shown} value={{ pairs: { l1: "r1" } }} onChange={onChange} disabled={false} />);

    expect(screen.getByRole("list", { name: "Answers" })).not.toHaveTextContent("South-west");

    await userEvent.setup().click(screen.getByRole("button", { name: "Clear the answer for Lagos" }));

    expect(onChange).toHaveBeenCalledWith({ pairs: {} });
  });
});

describe("MatchingReview", () => {
  it("shows the student's answer for every prompt and the correct one where it's wrong", () => {
    render(
      <MatchingReview
        config={config}
        response={{ pairs: { l1: "r1", l2: "rx" } }}
        parts={[
          { partId: "l1", correct: true, expectedRef: "r1", givenRef: "r1" },
          { partId: "l2", correct: false, expectedRef: "r2", givenRef: "rx" },
        ]}
        perspective="staff"
      />,
    );

    expect(screen.getByLabelText("Correct")).toBeInTheDocument();
    expect(screen.getByLabelText("Wrong")).toBeInTheDocument();
    expect(screen.getByText("North-east")).toBeInTheDocument();
    expect(screen.getByText("North-west")).toBeInTheDocument();
  });
});

describe("toMatchingPlayerView", () => {
  it("keeps prompts in order, shuffles answers and drops every pairing", () => {
    const view = toMatchingPlayerView(config);
    expect(view.lefts.map((left) => left.id)).toEqual(["l1", "l2"]);
    expect(view.rights.map((right) => right.id)).not.toEqual(["r1", "r2", "rx"]);
    expect(JSON.stringify(view)).not.toContain("rightId");
  });
});
