import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResultDialog } from "@/components/ui/ResultDialog";

describe("ResultDialog", () => {
  it("renders a success message with a default title and Done button", () => {
    render(<ResultDialog variant="success" message="Period grid saved." onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Period grid saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("renders an error message with a default title", () => {
    render(<ResultDialog variant="error" message="Failed to save period grid" onClose={vi.fn()} />);

    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(screen.getByText("Failed to save period grid")).toBeInTheDocument();
  });

  it("calls onClose when the action button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ResultDialog variant="success" message="Saved." onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ResultDialog variant="error" message="Something failed." onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports an explicit title and closeLabel override", () => {
    render(
      <ResultDialog
        variant="success"
        title="Period grid saved"
        message="Primary's period grid was updated."
        closeLabel="Got it"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Period grid saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
  });
});
