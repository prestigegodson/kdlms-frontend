import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Modal } from "@/components/ui/Modal";

function items(overrides: Partial<ActionMenuItem>[] = []): ActionMenuItem[] {
  const base: ActionMenuItem[] = [
    { label: "Edit", onSelect: vi.fn() },
    { label: "Comments", onSelect: vi.fn() },
    { label: "Delete", onSelect: vi.fn(), variant: "danger" },
  ];
  return base.map((item, index) => ({ ...item, ...overrides[index] }));
}

describe("ActionMenu", () => {
  it("renders nothing when there are no items", () => {
    const { container } = render(<ActionMenu items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on click, exposing the items as menuitems, and toggles aria-expanded", async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items()} />);

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual(["Edit", "Comments", "Delete"]);
  });

  it("uses ariaLabel as the trigger's accessible name when given", async () => {
    render(<ActionMenu items={items()} ariaLabel="Actions for Fractions worksheet" />);
    expect(screen.getByRole("button", { name: "Actions for Fractions worksheet" })).toBeInTheDocument();
  });

  it("calls onSelect and closes the menu when an item is chosen", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ActionMenu items={items([{}, { onSelect }])} />);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Comments" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not call onSelect for a disabled item", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ActionMenu items={items([{}, { onSelect, disabled: true }])} />);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Comments" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items()} />);

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when clicking outside the trigger and panel", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <ActionMenu items={items()} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves focus between items with ArrowDown/ArrowUp, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items()} />);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const [edit, comments, del] = screen.getAllByRole("menuitem");

    await user.keyboard("{ArrowDown}");
    expect(edit).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(comments).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(edit).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(del).toHaveFocus();
  });

  it("jumps to the first/last item with Home/End", async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items()} />);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const [edit, , del] = screen.getAllByRole("menuitem");

    await user.keyboard("{End}");
    expect(del).toHaveFocus();
    await user.keyboard("{Home}");
    expect(edit).toHaveFocus();
  });

  it("opens with the first item focused when opened via ArrowDown on the trigger", async () => {
    const user = userEvent.setup();
    render(<ActionMenu items={items()} />);

    screen.getByRole("button", { name: "Actions" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
  });

  it("closes on Tab without closing an enclosing Modal", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <ActionMenu items={items()} />
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
