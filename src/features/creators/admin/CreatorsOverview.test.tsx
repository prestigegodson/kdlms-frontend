import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardApi from "@/api/dashboard";
import type { CreatorDashboardView } from "@/api/dashboard";
import { CreatorsOverview } from "@/features/creators/admin/CreatorsOverview";

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getCreatorDashboard: vi.fn() };
});

const VIEW: CreatorDashboardView = {
  creators: {
    total: 12,
    active: 9,
    suspended: 2,
    archived: 1,
    unverifiedEmail: 3,
    signupsByMonth: [
      { month: "2026-05", count: 0 },
      { month: "2026-06", count: 1 },
      { month: "2026-07", count: 2 },
      { month: "2026-08", count: 0 },
      { month: "2026-09", count: 4 },
      { month: "2026-10", count: 5 },
    ],
  },
  plans: {
    plans: [
      { packageId: "p-free", name: "Free", free: true, creators: 6 },
      { packageId: "p-pro", name: "Pro", free: false, creators: 4 },
    ],
    onPaidPlan: 4,
    withoutPlan: 1,
    autoRenewOn: 3,
    inGrace: 1,
  },
  classes: {
    total: 30,
    active: 25,
    archived: 5,
    sessionsHeld: 140,
    sessionsUpcoming: 18,
    sessionsCancelled: 6,
    sessionsLive: 2,
    hoursDelivered: 152.5,
    hoursUpcoming: 20,
  },
  learners: {
    total: 410,
    adults: 300,
    minors: 110,
    withLogin: 280,
    guardians: 90,
    pendingInvites: 15,
    activeEnrollments: 520,
    attendanceHours: 1200.5,
  },
  revenue: [
    {
      currency: "NGN",
      receivedMinor: 50_000_000,
      last30DaysMinor: 7_500_000,
      discountMinor: 250_000,
      successfulCharges: 40,
      failedCharges: 5,
      abandonedCharges: 5,
    },
    {
      currency: "USD",
      receivedMinor: 120_000,
      last30DaysMinor: 0,
      discountMinor: 0,
      successfulCharges: 3,
      failedCharges: 0,
      abandonedCharges: 0,
    },
  ],
  top: {
    byRevenue: [
      { schoolId: "c-1", name: "Ada Academy", currency: "NGN", amountMinor: 20_000_000 },
      { schoolId: "c-2", name: "Dollar Tutors", currency: "USD", amountMinor: 120_000 },
    ],
    byClasses: [{ schoolId: "c-1", name: "Ada Academy", count: 9 }],
    byLearners: [{ schoolId: "c-3", name: "Bola Lessons", count: 75 }],
  },
  generatedAt: "2026-10-19T12:00:00Z",
};

function renderOverview() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <CreatorsOverview /> },
      { path: "/admin/tutors/:schoolId", element: <div>Tutor detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("CreatorsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardApi.getCreatorDashboard).mockResolvedValue(VIEW);
  });

  it("shows the headline totals", async () => {
    renderOverview();

    expect(await screen.findByText("Total tutors")).toBeInTheDocument();
    expect(screen.getByText("Classes created")).toBeInTheDocument();
    expect(screen.getByText("410")).toBeInTheDocument();
    expect(screen.getByText("152.5 h")).toBeInTheDocument();
    expect(screen.getByText("36% on a paid plan")).toBeInTheDocument();
    expect(screen.getByText("Free (free)")).toBeInTheDocument();
    expect(screen.getByText("No plan")).toBeInTheDocument();
  });

  it("keeps revenue per currency and switches between them", async () => {
    const user = userEvent.setup();
    renderOverview();

    expect(await screen.findByText("₦500,000.00")).toBeInTheDocument();
    expect(screen.getByText("Top tutors by payments (NGN)")).toBeInTheDocument();
    expect(screen.queryByText("Dollar Tutors")).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("tablist", { name: "Currency" })).getByRole("tab", { name: "USD" }));

    expect(screen.getByText("Top tutors by payments (USD)")).toBeInTheDocument();
    expect(screen.getByText("Dollar Tutors")).toBeInTheDocument();
  });

  it("links a top tutor to their detail page", async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(await screen.findByRole("link", { name: /Bola Lessons/ }));

    expect(await screen.findByText("Tutor detail page")).toBeInTheDocument();
  });

  it("says so when no tutor has paid yet", async () => {
    vi.mocked(dashboardApi.getCreatorDashboard).mockResolvedValue({
      ...VIEW,
      revenue: [],
      top: { ...VIEW.top, byRevenue: [] },
    });
    renderOverview();

    expect(await screen.findByText("No tutor has paid for a plan yet.")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(dashboardApi.getCreatorDashboard).mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderOverview();

    expect(await screen.findByText("Failed to load the tutors overview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Total tutors")).toBeInTheDocument();
  });
});
