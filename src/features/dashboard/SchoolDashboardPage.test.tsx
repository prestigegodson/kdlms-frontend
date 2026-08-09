import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import * as dashboardApi from "@/api/dashboard";
import { SchoolDashboardPage } from "@/features/dashboard/SchoolDashboardPage";

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getSchoolDashboard: vi.fn() };
});

// AdminDashboard also renders AttendanceTodayCard, which fetches independently.
vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getDailyOverview: vi.fn() };
});

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <SchoolDashboardPage /> },
      { path: "/school/students", element: <div>Students page</div> },
      { path: "/school/academics/classes", element: <div>Classes page</div> },
      { path: "/school/attendance", element: <div>Attendance page</div> },
      { path: "/school/academics/classes/:classId", element: <div>Class detail page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("SchoolDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attendanceApi.getDailyOverview).mockResolvedValue({
      date: "2026-08-06",
      totalClasses: 0,
      classesMarked: 0,
      classes: [],
    });
  });

  it("renders the admin section's stats and current session/term", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      currentSessionName: "2026/2027",
      currentTermName: "Term 1",
      admin: {
        activeStudents: 120,
        activeClasses: 8,
        attendanceToday: { totalClasses: 8, classesMarked: 5, present: 100, absent: 10, late: 5, excused: 5 },
        publicationProgress: { totalClasses: 8, publishedClasses: 3 },
      },
    });

    renderPage();

    expect(await screen.findByText("2026/2027 · Term 1")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("5 / 8")).toBeInTheDocument();
    expect(screen.getByText("This term’s results published")).toBeInTheDocument();

    // Each admin stat tile is a tap target into its source screen (mobile-plan.md Phase D).
    expect(screen.getByText("Active students").closest("a")).toHaveAttribute("href", "/school/students");
    expect(screen.getByText("Active classes").closest("a")).toHaveAttribute(
      "href",
      "/school/academics/classes",
    );
    expect(screen.getByText("Present today").closest("a")).toHaveAttribute("href", "/school/attendance");
    expect(screen.getByText("Registers marked").closest("a")).toHaveAttribute("href", "/school/attendance");
  });

  it("renders the teacher section's classes with today's marked status", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      teacher: {
        classes: [
          { classId: "c1", className: "Primary 3", registerMarkedToday: true },
          { classId: "c2", className: "Primary 4", registerMarkedToday: false },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText("Primary 3")).toBeInTheDocument();
    expect(screen.getByText("Register marked today")).toBeInTheDocument();
    expect(screen.getByText("Primary 4")).toBeInTheDocument();
    expect(screen.getByText("Register not marked yet")).toBeInTheDocument();
  });

  it("navigates to a class's detail route when its whole row is tapped, not just the class name", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      teacher: { classes: [{ classId: "c1", className: "Primary 3", registerMarkedToday: true }] },
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Primary 3");

    await user.click(screen.getByRole("button", { name: /Primary 3/ }));

    expect(await screen.findByText("Class detail page")).toBeInTheDocument();
  });

  it("shows an empty state for a teacher with no assigned classes", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({ teacher: { classes: [] } });

    renderPage();

    expect(await screen.findByText("No classes assigned yet")).toBeInTheDocument();
  });
});
