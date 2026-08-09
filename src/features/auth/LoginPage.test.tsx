import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { routes } from "@/routes";
import { resetAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");

describe("LoginPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    // Anything the post-login destination page fetches on mount gets a benign empty page.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
        }),
      ),
    );
  });

  it("signs in and redirects to the user's role home", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "1",
        email: "admin@kdlms.com",
        firstName: "Sys",
        lastName: "Admin",
        role: "SYSTEM_ADMIN",
      },
    });

    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "admin@kdlms.com");
    await user.type(screen.getByLabelText("Password"), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Schools" })).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith("admin@kdlms.com", "ChangeMe123!");
  });

  it("redirects to /set-password instead of the role home when the account still must change a temporary password", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "1",
        email: "new-admin@kdlms.com",
        firstName: "New",
        lastName: "Admin",
        role: "SYSTEM_ADMIN",
        mustChangePassword: true,
      },
    });

    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "new-admin@kdlms.com");
    await user.type(screen.getByLabelText("Password"), "TempPass123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Set your password" })).toBeInTheDocument();
  });

  it("shows an error message on failed login and stays on the login page", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "Invalid email or password."));

    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "admin@kdlms.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the school-suspended message on a 403 and stays on the login page", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(403, "Your school's account is currently suspended. Contact your administrator or KDLMS support."),
    );

    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "admin@suspended-school.example");
    await user.type(screen.getByLabelText("Password"), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "Your school's account is currently suspended. Contact your administrator or KDLMS support.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("gives the password field a Go mobile keyboard hint, as the form's terminal field", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
    render(<RouterProvider router={router} />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("enterKeyHint", "go");
  });
});
