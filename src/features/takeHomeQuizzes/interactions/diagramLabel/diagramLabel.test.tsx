import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toDiagramLabelPlayerView } from "./defaults";
import { DiagramLabelPlayer } from "./Player";
import { DiagramLabelReview } from "./Review";
import type { DiagramLabelConfig, DiagramLabelPlayerConfig } from "./types";

const config: DiagramLabelConfig = {
  schemaVersion: 1,
  imageFileId: "img",
  imageAspect: 1.5,
  zones: [
    { id: "z1", shape: { kind: "RECT", x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, acceptedLabelIds: ["n"] },
    { id: "z2", shape: { kind: "RECT", x: 0.6, y: 0.6, w: 0.2, h: 0.1 }, acceptedLabelIds: ["w"] },
  ],
  labels: [
    { id: "n", html: "<p>Nucleus</p>" },
    { id: "w", html: "<p>Cell wall</p>" },
    { id: "r", html: "<p>Ribosome</p>" },
  ],
  reuseLabels: false,
};

const shown: DiagramLabelPlayerConfig = {
  imageFileId: "img",
  imageAspect: 1.5,
  zones: config.zones.map(({ id, shape }) => ({ id, shape })),
  labels: [config.labels[2], config.labels[0], config.labels[1]],
  reuseLabels: false,
};

describe("DiagramLabelPlayer", () => {
  it("places a label by tapping it, then a zone", async () => {
    const onChange = vi.fn();
    render(<DiagramLabelPlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Nucleus"));
    await user.click(screen.getByRole("button", { name: "Zone 1" }));

    expect(onChange).toHaveBeenCalledWith({ placements: { z1: "n" } });
    expect(screen.getByTestId("live-announcer")).toHaveTextContent("Nucleus placed in zone 1.");
  });

  it("places a label with the keyboard alone", async () => {
    const onChange = vi.fn();
    render(<DiagramLabelPlayer config={shown} value={null} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    screen.getByRole("button", { name: /Cell wall/ }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Zone 2" }).focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ placements: { z2: "w" } });
  });

  it("takes a placed label out of the bank and moves it rather than copying it", async () => {
    const onChange = vi.fn();
    render(<DiagramLabelPlayer config={shown} value={{ placements: { z1: "n" } }} onChange={onChange} disabled={false} />);
    const user = userEvent.setup();

    expect(screen.getByRole("list", { name: "Labels" })).not.toHaveTextContent("Nucleus");

    await user.click(screen.getByRole("button", { name: /Nucleus/ }));
    await user.click(screen.getByRole("button", { name: "Zone 2" }));
    expect(onChange).toHaveBeenLastCalledWith({ placements: { z2: "n" } });

    await user.click(screen.getByRole("button", { name: "Clear zone 1" }));
    expect(onChange).toHaveBeenLastCalledWith({ placements: {} });
  });

  it("keeps every label in the bank when labels may be reused", async () => {
    const onChange = vi.fn();
    render(
      <DiagramLabelPlayer
        config={{ ...shown, reuseLabels: true }}
        value={{ placements: { z1: "n" } }}
        onChange={onChange}
        disabled={false}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByRole("list", { name: "Labels" })).toHaveTextContent("Nucleus");
    await user.click(screen.getByRole("button", { name: /Nucleus/ }));
    await user.click(screen.getByRole("button", { name: "Zone 2" }));
    expect(onChange).toHaveBeenCalledWith({ placements: { z1: "n", z2: "n" } });
  });

  it("renders the diagram through the page's own image renderer", () => {
    render(
      <DiagramLabelPlayer
        config={shown}
        value={null}
        onChange={vi.fn()}
        disabled={false}
        renderImage={(fileId, alt) => <img src={`/img/${fileId}`} alt={alt} />}
      />,
    );

    expect(screen.getByAltText("The diagram to label")).toHaveAttribute("src", "/img/img");
  });
});

describe("DiagramLabelReview", () => {
  it("marks each zone and names the right label for a wrong one", () => {
    render(
      <DiagramLabelReview
        config={config}
        response={{ placements: { z1: "n", z2: "r" } }}
        parts={[
          { partId: "z1", correct: true, expectedRef: "n", givenRef: "n" },
          { partId: "z2", correct: false, expectedRef: "w", givenRef: "r" },
        ]}
        perspective="self"
      />,
    );

    expect(screen.getAllByLabelText("Correct")).toHaveLength(1);
    expect(screen.getAllByLabelText("Wrong")).toHaveLength(1);
    expect(screen.getByText("Ribosome")).toBeInTheDocument();
    expect(screen.getByText("Cell wall")).toBeInTheDocument();
    expect(screen.getAllByText("You put:", { exact: false })).toHaveLength(2);
  });
});

describe("toDiagramLabelPlayerView", () => {
  it("shuffles the labels and drops every zone's answer", () => {
    const view = toDiagramLabelPlayerView(config);
    expect(view.labels.map((label) => label.id)).not.toEqual(["n", "w", "r"]);
    expect(JSON.stringify(view)).not.toContain("acceptedLabelIds");
  });
});
