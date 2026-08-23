import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";

vi.mock("@/api/auth");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      { path: "/forgot-password", element: <div>Forgot password page</div> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show a reset-token field and submits the token from the URL", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt("/reset-password?token=abc123");

    expect(screen.queryByLabelText("Reset token")).not.toBeInTheDocument();

    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Your password has been reset. You can now sign in.")).toBeInTheDocument();
    expect(authApi.confirmPasswordReset).toHaveBeenCalledWith("abc123", "NewPass123");
  });

  it("shows an invalid-link state and no form when the URL has no token", async () => {
    renderAt("/reset-password");

    expect(
      await screen.findByText("This reset link is invalid or incomplete. Request a new one."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Request a new link" }));

    expect(await screen.findByText("Forgot password page")).toBeInTheDocument();
  });

  it("surfaces the API error message on a rejected call", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValue(
      new ApiError(422, "That reset link is invalid or has expired."),
    );
    const user = userEvent.setup();
    renderAt("/reset-password?token=abc123");

    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("That reset link is invalid or has expired.")).toBeInTheDocument();
  });
});
