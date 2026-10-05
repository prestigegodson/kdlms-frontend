import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TooltipRenderProps } from "react-joyride";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TourCard } from "@/features/onboarding/components/TourCard";

function props(overrides: Partial<TooltipRenderProps> = {}) {
  const button = (action: string) => ({
    "aria-label": action,
    "data-action": action,
    onClick: vi.fn(),
    role: "button",
    title: action,
  });
  return {
    index: 1,
    size: 4,
    isLastStep: false,
    continuous: true,
    step: { title: "Your account", content: "Change your password here.", data: { guideTitle: "Welcome tour" } },
    backProps: button("back"),
    primaryProps: button("primary"),
    skipProps: button("skip"),
    closeProps: button("close"),
    tooltipProps: { "aria-modal": true, role: "alertdialog" },
    controls: { skip: vi.fn() },
    ...overrides,
  } as unknown as TooltipRenderProps;
}

function stubMobile(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

describe("TourCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the guide, step, progress and navigation", async () => {
    const cardProps = props();
    render(<TourCard {...cardProps} />);

    expect(screen.getByText("Welcome tour")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    expect(screen.getByTestId("tour-card")).toHaveAttribute("data-layout", "floating");
    expect(screen.getByTestId("tour-card")).toHaveClass("relative");

    await userEvent.click(screen.getByRole("button", { name: "primary" }));
    expect(cardProps.primaryProps.onClick).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "skip" }));
    expect(cardProps.skipProps.onClick).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "back" })).toBeInTheDocument();
  });

  it("offers Finish and no Back/Skip at the edges of the guide", () => {
    render(<TourCard {...props({ index: 0, size: 1, isLastStep: true })} />);

    expect(screen.getByRole("button", { name: "primary" })).toHaveTextContent("Finish");
    expect(screen.queryByRole("button", { name: "back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "skip" })).not.toBeInTheDocument();
  });

  it("skips the guide on Escape", async () => {
    const cardProps = props();
    render(<TourCard {...cardProps} />);

    await userEvent.keyboard("{Escape}");

    expect(cardProps.controls.skip).toHaveBeenCalledWith("button_close");
  });

  it("docks as a bottom sheet on a phone", () => {
    stubMobile(true);
    render(<TourCard {...props()} />);

    expect(screen.getByTestId("tour-card")).toHaveAttribute("data-layout", "sheet");
    // `.relative` is emitted after `.fixed`, so carrying both would put the sheet below the page.
    expect(screen.getByTestId("tour-card")).toHaveClass("fixed");
    expect(screen.getByTestId("tour-card")).not.toHaveClass("relative");
  });
});
