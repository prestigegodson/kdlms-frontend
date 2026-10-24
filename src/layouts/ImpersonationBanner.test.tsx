import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { ImpersonationBanner } from "@/layouts/ImpersonationBanner";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");

function renderBanner() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <ImpersonationBanner /> },
      { path: "/guardian", element: <div>Guardian home</div> },
      { path: "/admin/schools/:schoolId", element: <div>School detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ImpersonationBanner", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.mocked(authApi.stopImpersonation).mockResolvedValue(undefined);
  });

  it("renders nothing outside an impersonation session", () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", role: "SCHOOL_ADMIN" },
    });

    renderBanner();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses Log in as wording for a guardian's ward session and returns to the guardian portal", async () => {
    useAuthStore.setState({
      user: { id: "ward-user-1", email: "grace-kdl24001", firstName: "Grace", lastName: "Obi", role: "STUDENT" },
      accessToken: "ward-access",
      refreshToken: null,
      impersonation: { sessionId: "session-w", expiresAt: "2026-01-01T01:00:00Z", kind: "GUARDIAN" },
      stashedSession: {
        user: { id: "guardian-1", email: "parent@example.com", firstName: "Pat", lastName: "Parent", role: "GUARDIAN" },
        accessToken: "guardian-access",
        refreshToken: "guardian-refresh",
      },
    });
    const user = userEvent.setup();

    renderBanner();

    expect(screen.getByText(/You're logged in as/)).toBeInTheDocument();
    expect(screen.queryByText(/impersonat/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to my account" }));

    expect(await screen.findByText("Guardian home")).toBeInTheDocument();
    expect(useAuthStore.getState().user?.role).toBe("GUARDIAN");
  });

  it("keeps the system admin wording for an admin impersonation session", () => {
    useAuthStore.setState({
      user: { id: "1", email: "a@b.com", firstName: "Ada", lastName: "Obi", role: "SCHOOL_ADMIN", schoolId: "school-1" },
      impersonation: { sessionId: "session-1", expiresAt: "2026-01-01T01:00:00Z" },
    });

    renderBanner();

    expect(screen.getByRole("button", { name: "Stop impersonating" })).toBeInTheDocument();
  });
});
