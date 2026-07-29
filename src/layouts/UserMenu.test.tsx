import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { UserMenu } from "@/layouts/UserMenu";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import type { AuthenticatedUser } from "@/stores/authStore";

const USER: AuthenticatedUser = {
  id: "1",
  email: "godson@kdlms.com",
  firstName: "Godson",
  lastName: "Ositadinma",
  role: "SYSTEM_ADMIN",
};

function renderMenu(user: AuthenticatedUser = USER) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <div>Login page</div> },
      { path: "/menu", element: <UserMenu user={user} /> },
    ],
    { initialEntries: ["/menu"] },
  );
  render(<RouterProvider router={router} />);
}

describe("UserMenu", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
  });

  it("shows only the avatar until clicked", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("GO");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByText("Change password")).not.toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });

  it("reveals name, role, and both actions when opened", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Godson Ositadinma")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM_ADMIN")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the panel", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // The overlay sits behind the panel and covers the rest of the viewport;
    // clicking anywhere else in the app goes through it.
    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the change password dialog and closes the menu", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Change password" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("logs out, clears the session, and redirects to /login", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
