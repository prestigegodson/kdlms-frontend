import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { SetInitialPasswordPage } from "@/features/auth/SetInitialPasswordPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      { path: "/admin", element: <div>Admin home</div> },
      { path: "/set-password", element: <SetInitialPasswordPage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

const flaggedUser = {
  id: "1",
  email: "admin@school.example",
  firstName: "New",
  lastName: "Admin",
  role: "SYSTEM_ADMIN" as const,
  mustChangePassword: true,
};

describe("SetInitialPasswordPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
  });

  it("redirects to /login when there is no session", async () => {
    renderAt("/set-password");

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("redirects to the user's role home when they aren't flagged", async () => {
    useAuthStore.setState({
      user: { ...flaggedUser, mustChangePassword: false },
      accessToken: "t",
      refreshToken: "r",
    });

    renderAt("/set-password");

    expect(await screen.findByText("Admin home")).toBeInTheDocument();
  });

  it("blocks submission without calling the API when new and confirm don't match", async () => {
    useAuthStore.setState({ user: flaggedUser, accessToken: "t", refreshToken: "r" });
    const user = userEvent.setup();
    renderAt("/set-password");

    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "SomethingElse123");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("New password and confirmation don't match.")).toBeInTheDocument();
    expect(authApi.setInitialPassword).not.toHaveBeenCalled();
  });

  it("surfaces the API error message on a rejected call", async () => {
    useAuthStore.setState({ user: flaggedUser, accessToken: "t", refreshToken: "r" });
    vi.mocked(authApi.setInitialPassword).mockRejectedValue(
      new ApiError(422, "New password must differ from the current password."),
    );
    const user = userEvent.setup();
    renderAt("/set-password");

    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("New password must differ from the current password.")).toBeInTheDocument();
  });

  it("sets the session and navigates to the role home on success", async () => {
    useAuthStore.setState({ user: flaggedUser, accessToken: "t", refreshToken: "r" });
    vi.mocked(authApi.setInitialPassword).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      user: { ...flaggedUser, mustChangePassword: false },
    });
    const user = userEvent.setup();
    renderAt("/set-password");

    await user.type(await screen.findByLabelText("New password"), "NewPass123");
    await user.type(screen.getByLabelText("Confirm new password"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText("Admin home")).toBeInTheDocument();
    expect(authApi.setInitialPassword).toHaveBeenCalledWith("NewPass123");
    expect(useAuthStore.getState().accessToken).toBe("new-access");
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
  });

  it("signs out and returns to /login", async () => {
    useAuthStore.setState({ user: flaggedUser, accessToken: "t", refreshToken: "r" });
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt("/set-password");

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
