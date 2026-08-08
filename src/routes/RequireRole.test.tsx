import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { Role } from "@/api/types";
import { RequireRole } from "@/routes/RequireRole";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

function renderGuarded(roles: Role[]) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      { path: "/admin", element: <div>Admin home</div> },
      { path: "/school", element: <div>School home</div> },
      { path: "/set-password", element: <div>Set password page</div> },
      {
        path: "/protected",
        element: (
          <RequireRole roles={roles}>
            <div>Protected content</div>
          </RequireRole>
        ),
      },
    ],
    { initialEntries: ["/protected"] },
  );
  render(<RouterProvider router={router} />);
}

describe("RequireRole", () => {
  beforeEach(() => {
    resetAuthStore();
  });

  it("redirects to /login when there is no session", async () => {
    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("redirects to the user's own home when their role isn't allowed here, not /login", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "SCHOOL_ADMIN" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("School home")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("renders the protected content when the role matches", async () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "SYSTEM_ADMIN" },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /set-password when the user still must change a temporary password, even though their role matches", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        role: "SYSTEM_ADMIN",
        mustChangePassword: true,
      },
      accessToken: "t",
      refreshToken: "r",
    });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(await screen.findByText("Set password page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders nothing until the persisted session has hydrated", () => {
    useAuthStore.setState({ hydrated: false });

    renderGuarded(["SYSTEM_ADMIN"]);

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
