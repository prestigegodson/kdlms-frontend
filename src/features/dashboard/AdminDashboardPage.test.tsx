import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardApi from "@/api/dashboard";
import type { AdminDashboardPlatformImpact } from "@/api/dashboard";
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

function impact(overrides: Partial<AdminDashboardPlatformImpact> = {}): AdminDashboardPlatformImpact {
  return {
    students: 0,
    studentsWithLogin: 0,
    staff: 0,
    teachers: 0,
    guardians: 0,
    takeHomeQuizzes: 0,
    quizQuestions: 0,
    learningResources: 0,
    lessonNotes: 0,
    aiGenerations: 0,
    classes: 0,
    subjects: 0,
    billPublications: 0,
    stockIssues: 0,
    requisitions: 0,
    ...overrides,
  };
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
      expiringSchools: [],
      impact: impact(),
    });

    renderPage();

    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders platform impact tiles for people, content, and activity", async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue({
      totalSchools: 1,
      activeSchools: 1,
      suspendedSchools: 0,
      archivedSchools: 0,
      activeSubscriptions: 1,
      expiringSoonSubscriptions: 0,
      expiredSubscriptions: 0,
      expiringSchools: [],
      impact: impact({
        students: 1234,
        studentsWithLogin: 456,
        staff: 200,
        teachers: 150,
        guardians: 900,
        takeHomeQuizzes: 42,
        quizQuestions: 630,
        learningResources: 88,
        lessonNotes: 310,
        aiGenerations: 75,
        classes: 60,
        subjects: 25,
        billPublications: 18,
        stockIssues: 5,
        requisitions: 9,
      }),
    });

    renderPage();

    expect(await screen.findByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("456")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("150 teachers")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("630 questions")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("310")).toBeInTheDocument();
    expect(screen.getByText("75 AI generations")).toBeInTheDocument();
    expect(screen.getByText("60 / 25")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
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
        expiringSchools: [],
        impact: impact(),
      });

    renderPage();

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();

    await waitFor(() => expect(dashboardApi.getAdminDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Total schools")).toBeInTheDocument();
  });

  it("shows the empty state when no subscriptions are expiring soon", async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue({
      totalSchools: 1,
      activeSchools: 1,
      suspendedSchools: 0,
      archivedSchools: 0,
      activeSubscriptions: 1,
      expiringSoonSubscriptions: 0,
      expiredSubscriptions: 0,
      expiringSchools: [],
      impact: impact(),
    });

    renderPage();

    expect(await screen.findByText("Nothing expiring soon")).toBeInTheDocument();
  });

  it("renders the renewal worklist with a link into each school's detail page", async () => {
    vi.mocked(dashboardApi.getAdminDashboard).mockResolvedValue({
      totalSchools: 2,
      activeSchools: 2,
      suspendedSchools: 0,
      archivedSchools: 0,
      activeSubscriptions: 2,
      expiringSoonSubscriptions: 1,
      expiredSubscriptions: 0,
      expiringSchools: [
        {
          schoolId: "school-1",
          schoolName: "Greenwood Academy",
          packageName: "Growth",
          endDate: "2026-10-10",
          daysRemaining: 14,
        },
      ],
      impact: impact(),
    });

    renderPage();

    expect(await screen.findByText("Greenwood Academy")).toBeInTheDocument();
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText("14 days")).toBeInTheDocument();

    const link = screen.getByText("Greenwood Academy").closest("tr");
    expect(link).toHaveAttribute("tabindex", "0");
  });
});
