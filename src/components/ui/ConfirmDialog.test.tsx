import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("cancels without calling onConfirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        title="Suspend this school?"
        message="Are you sure?"
        confirmLabel="Suspend"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onConfirm when confirmed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        title="Suspend this school?"
        message="Are you sure?"
        confirmLabel="Suspend"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Suspend" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirm button disabled until the exact confirmation text is typed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        title="Archive this school?"
        message="This cannot be undone."
        confirmLabel="Archive"
        variant="danger"
        confirmationText="BSA"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Archive" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Type "BSA" to confirm'), "wrong");
    expect(confirmButton).toBeDisabled();

    await user.clear(screen.getByLabelText('Type "BSA" to confirm'));
    await user.type(screen.getByLabelText('Type "BSA" to confirm'), "BSA");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows an error and stays open when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new ApiError(422, "School is already archived."));
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        title="Archive this school?"
        message="This cannot be undone."
        confirmLabel="Archive"
        variant="danger"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByText("School is already archived.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
