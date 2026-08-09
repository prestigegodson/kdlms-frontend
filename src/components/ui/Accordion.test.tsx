import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Accordion } from "@/components/ui/Accordion";

describe("Accordion", () => {
  it("renders its body in the DOM even when collapsed, since it's a CSS-gated collapse, not an unmount", () => {
    render(
      <Accordion title="Guardians">
        <p>Guardian list</p>
      </Accordion>,
    );

    expect(screen.getByText("Guardian list")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardians" })).toHaveAttribute("aria-expanded", "false");
  });

  it("respects defaultOpen", () => {
    render(
      <Accordion title="Bio" defaultOpen>
        <p>Bio content</p>
      </Accordion>,
    );

    expect(screen.getByRole("button", { name: "Bio" })).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles aria-expanded on click", async () => {
    const user = userEvent.setup();
    render(
      <Accordion title="Medical">
        <p>Medical content</p>
      </Accordion>,
    );

    const button = screen.getByRole("button", { name: "Medical" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("renders actions outside the toggle button so their clicks don't collapse the panel", async () => {
    const user = userEvent.setup();
    let actionClicks = 0;
    render(
      <Accordion title="Guardians" actions={<button onClick={() => actionClicks++}>Link guardian</button>}>
        <p>Guardian list</p>
      </Accordion>,
    );

    await user.click(screen.getByRole("button", { name: "Link guardian" }));
    expect(actionClicks).toBe(1);
    expect(screen.getByRole("button", { name: "Guardians" })).toHaveAttribute("aria-expanded", "false");
  });
});
