import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardApi from "@/api/dashboard";
import { ApiError } from "@/api/client";
import { AdminDashboardPage } from "@/features/dashboard/AdminDashboardPage";

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getAdminDashboard: vi.fn() };
});

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <AdminDashboardPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders platform-wide school and subscription counts", async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue({
      totalSchools: 13,
      activeSchools: 10,
      suspendedSchools: 2,
      archivedSchools: 1,
      activeSubscriptions: 8,
      expiringSoonSubscriptions: 3,
      expiredSubscriptions: 1,
    });

    renderPage();

    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a retryable error state on failure, which reloads on retry", async () => {
    vi.mocked(dashboardApi.getAdminDashboard)
      .mockRejectedValueOnce(new ApiError(500, "Server error"))
      .mockResolvedValueOnce({
        totalSchools: 1,
        activeSchools: 1,
        suspendedSchools: 0,
        archivedSchools: 0,
        activeSubscriptions: 1,
        expiringSoonSubscriptions: 0,
        expiredSubscriptions: 0,
      });

    renderPage();

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();

    await waitFor(() => expect(dashboardApi.getAdminDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Total schools")).toBeInTheDocument();
  });
});
