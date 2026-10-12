import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toCategorizePlayerView } from "./defaults";
import { CategorizePlayer } from "./Player";
import { CategorizeReview } from "./Review";
import type { CategorizeConfig, CategorizePlayerConfig } from "./types";

const config: CategorizeConfig = {
  schemaVersion: 1,
  groups: [
    { id: "gm", html: "<p>Metals</p>" },
    { id: "gn", html: "<p>Non-metals</p>" },
  ],
  items: [
    { id: "cu", html: "<p>Copper</p>", groupId: "gm" },
    { id: "fe", html: "<p>Iron</p>", groupId: "gm" },
    { id: "s", html: "<p>Sulfur</p>", groupId: "gn" },
    { id: "o", html: "<p>Oxygen</p>", groupId: "gn" },
  ],
};

const shown: CategorizePlayerConfig = {
  groups: [
    { id: "gn", html: "<p>Non-metals</p>" },
    { id: "gm", html: "<p>Metals</p>" },
  ],
  items: [
    { id: "o", html: "<p>Oxygen</p>" },
    { id: "cu", html: "<p>Copper</p>" },
    { id: "s", html: "<p>Sulfur</p>" },
    { id: "fe", html: "<p>Iron</p>" },
  ],
};

describe("CategorizePlayer", () => {
  it("sorts an item by tapping it, then the group", async () => {
    const onChange = vi.fn();
    render(<CategorizePlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Copper"));
    await user.click(screen.getByRole("button", { name: "Group Metals" }));

    expect(onChange).toHaveBeenCalledWith({ placements: { cu: "gm" } });
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Copper placed in Metals.");
  });

  it("sorts with the keyboard alone", async () => {
    const onChange = vi.fn();
    render(<CategorizePlayer config={shown} value={{ placements: { cu: "gm" } }} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    screen.getByRole("button", { name: /Sulfur/ }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Group Non-metals" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ placements: { cu: "gm", s: "gn" } });
  });

  it("takes a sorted item out of the bank, moves it to another group, and returns it", async () => {
    const onChange = vi.fn();
    render(<CategorizePlayer config={shown} value={{ placements: { cu: "gm" } }} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    expect(screen.getByRole("list", { name: "Items to sort" })).not.toHaveTextContent("Copper");
    expect(screen.getByRole("list", { name: "Sorted into Metals" })).toHaveTextContent("Copper");

    await user.click(screen.getByText("Copper"));
    await user.click(screen.getByRole("button", { name: "Group Non-metals" }));
    expect(onChange).toHaveBeenLastCalledWith({ placements: { cu: "gn" } });

    await user.click(screen.getByRole("button", { name: "Return Copper to the items to sort" }));
    expect(onChange).toHaveBeenLastCalledWith({ placements: {} });
  });

  it("doesn't drop a picked-up item into a group when a sorted item there is tapped or returned", async () => {
    const onChange = vi.fn();
    render(<CategorizePlayer config={shown} value={{ placements: { cu: "gm" } }} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Copper"));
    await user.click(screen.getByText("Copper"));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByText("Oxygen"));
    await user.click(screen.getByRole("button", { name: "Return Copper to the items to sort" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ placements: {} });
  });

  it("offers no return button while disabled", () => {
    render(<CategorizePlayer config={shown} value={{ placements: { cu: "gm" } }} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button", { name: /Return Copper/ })).not.toBeInTheDocument();
  });
});

describe("CategorizeReview", () => {
  it("marks every item and says where a wrong or unsorted one went", () => {
    render(
      <CategorizeReview
        config={config}
        response={{ placements: { cu: "gm", fe: "gn", s: "gn" } }}
        parts={[
          { partId: "cu", correct: true, expectedRef: "gm", givenRef: "gm" },
          { partId: "fe", correct: false, expectedRef: "gm", givenRef: "gn" },
          { partId: "s", correct: true, expectedRef: "gn", givenRef: "gn" },
          { partId: "o", correct: false, expectedRef: "gn", givenRef: null },
        ]}
        perspective="self"
      />,
    );

    expect(screen.getAllByLabelText("Correct")).toHaveLength(2);
    expect(screen.getAllByLabelText("Wrong")).toHaveLength(2);
    expect(screen.getByText("You put it in:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Not sorted")).toBeInTheDocument();
  });
});

describe("toCategorizePlayerView", () => {
  it("shuffles both lists and drops every item's group", () => {
    const view = toCategorizePlayerView(config);
    expect(view.items.map((item) => item.id)).not.toEqual(["cu", "fe", "s", "o"]);
    expect(view.items.map((item) => item.id).sort()).toEqual(["cu", "fe", "o", "s"]);
    expect(view.groups.map((group) => group.id).sort()).toEqual(["gm", "gn"]);
    expect(JSON.stringify(view)).not.toContain("groupId");
  });
});
