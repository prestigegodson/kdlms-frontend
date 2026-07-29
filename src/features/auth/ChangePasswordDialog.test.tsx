import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { ChangePasswordDialog } from "@/features/auth/ChangePasswordDialog";

vi.mock("@/api/auth");

describe("ChangePasswordDialog", () => {
  it("renders nothing when closed", () => {
    render(<ChangePasswordDialog open={false} onClose={vi.fn()} />);

    expect(screen.queryByText("Change password")).not.toBeInTheDocument();
  });

  it("blocks submission without calling the API when new and confirm don't match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Current password"), "OldPass123");
    await user.type(screen.getByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "SomethingElse123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("New password and confirmation don't match.")).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("surfaces the API error message and stays open on a rejected call", async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(422, "Current password is incorrect."));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordDialog open onClose={onClose} />);

    await user.type(screen.getByLabelText("Current password"), "WrongPass123");
    await user.type(screen.getByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a success alert on a resolved call", async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ChangePasswordDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Current password"), "OldPass123");
    await user.type(screen.getByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Your password has been changed.")).toBeInTheDocument();
    expect(authApi.changePassword).toHaveBeenCalledWith("OldPass123", "NewPass123");
  });
});
