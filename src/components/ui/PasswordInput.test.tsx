import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "@/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("defaults to masked with a Show password toggle", () => {
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </>,
    );

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("unmasks on click and re-masks on a second click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("does not submit the enclosing form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards id/autoComplete/enterKeyHint to the underlying input", () => {
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" autoComplete="new-password" enterKeyHint="go" value="secret" onChange={vi.fn()} />
      </>,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("autoComplete", "new-password");
    expect(input).toHaveAttribute("enterKeyHint", "go");
  });

  it("unmasks on a bare pointerdown, without waiting for a click (touch path)", () => {
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Show password" }), { pointerType: "touch" });
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("keeps the password input focused across a toggle (soft keyboard must not dismiss)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </>,
    );

    const input = screen.getByLabelText("Password");
    input.focus();
    expect(input).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveFocus();
  });

  it("still toggles via keyboard activation (Enter on the focused button)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" value="secret" onChange={vi.fn()} />
      </>,
    );

    const toggleButton = screen.getByRole("button", { name: "Show password" });
    toggleButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });
});
