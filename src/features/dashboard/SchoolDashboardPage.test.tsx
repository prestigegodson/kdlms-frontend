import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import * as birthdaysApi from "@/api/birthdays";
import * as dashboardApi from "@/api/dashboard";
import { SchoolDashboardPage } from "@/features/dashboard/SchoolDashboardPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getSchoolDashboard: vi.fn() };
});

// AdminDashboard also renders AttendanceTodayCard, which fetches independently.
vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getDailyOverview: vi.fn() };
});

// Both AdminDashboard and TeacherDashboard render UpcomingBirthdaysCard, which
// self-fetches independently.
vi.mock("@/api/birthdays", async () => {
  const actual = await vi.importActual<typeof import("@/api/birthdays")>("@/api/birthdays");
  return { ...actual, listUpcomingBirthdays: vi.fn() };
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
    resetAuthStore();
    vi.mocked(attendanceApi.getDailyOverview).mockResolvedValue({
      date: "2026-08-06",
      totalClasses: 0,
      classesMarked: 0,
      classes: [],
    });
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([]);
  });

  it("renders the admin section's stats and current session/term", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      currentSessionName: "2026/2027",
      currentTermName: "Term 1",
      admin: {
        activeStudents: 120,
        activeGirls: 65,
        activeBoys: 55,
        activeStudentLimit: 500,
        activeClasses: 8,
        registersMarkable: true,
        attendanceToday: { totalClasses: 8, classesMarked: 5, present: 100, absent: 10, late: 5, excused: 5 },
        publicationProgress: { totalClasses: 8, publishedClasses: 3, unpublishedClasses: [] },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("2026/2027 · Term 1")).toBeInTheDocument();
    expect(screen.getByText("120 / 500")).toBeInTheDocument();
    expect(screen.getByText("65 girls · 55 boys")).toBeInTheDocument();
    expect(screen.getByText("5 / 8")).toBeInTheDocument();
    expect(screen.getByText("This term’s results published")).toBeInTheDocument();

    // Each admin stat tile is a tap target into its source screen (mobile-plan.md Phase D).
    expect(screen.getByText("Active students").closest("a")).toHaveAttribute("href", "/school/students");
    expect(screen.getByText("Active classes").closest("a")).toHaveAttribute(
      "href",
      "/school/academics/classes",
    );
    expect(screen.getByText("Attendance today").closest("a")).toHaveAttribute("href", "/school/attendance");
    expect(screen.getByText("Registers marked").closest("a")).toHaveAttribute("href", "/school/attendance");
  });

  it("shows the active students count bare, with no limit context, when the school has no active subscription", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 120,
        activeGirls: 70,
        activeBoys: 50,
        activeClasses: 8,
        registersMarkable: true,
        attendanceToday: { totalClasses: 8, classesMarked: 8, present: 100, absent: 10, late: 5, excused: 5 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.queryByText("120 / 500")).not.toBeInTheDocument();
  });

  it("shows a non-alarming state on the registers tile when the day isn't a marking day", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 3,
        registersMarkable: false,
        attendanceToday: { totalClasses: 3, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    await screen.findByText("Registers marked");
    expect(screen.getByText("Not a marking day")).toBeInTheDocument();
    expect(screen.queryByText("0 / 3")).not.toBeInTheDocument();
  });

  it("renders the term progress card only when a current term is set", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      currentTerm: { name: "Term 1", startDate: "2026-09-01", endDate: "2026-12-12", daysRemaining: 20 },
      nextTerm: { name: "Term 2", startDate: "2027-01-10" },
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 0,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("Ends in 20 days")).toBeInTheDocument();
    expect(screen.getByText("Term 2")).toBeInTheDocument();
    expect(screen.getByText(/10 January, 2027/)).toBeInTheDocument();
  });

  it("names classes with no class teacher and students with no guardian on the needs-attention card", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 1,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: {
          classesWithoutClassTeacher: [{ classId: "c1", className: "Primary 1", levelName: "Primary" }],
          studentsWithoutGuardian: 4,
        },
      },
    });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("1 class with no class teacher")).toBeInTheDocument();
    expect(screen.getByText("4 students with no linked guardian")).toBeInTheDocument();
    expect(screen.getByText("4 students with no linked guardian").closest("a")).toHaveAttribute(
      "href",
      "/school/students?hasGuardian=false",
    );

    await user.click(screen.getByText("4 students with no linked guardian"));
    expect(await screen.findByText("Students page")).toBeInTheDocument();
  });

  it("omits the needs-attention card entirely when there are no setup gaps", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 0,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    await screen.findByText("Active students");
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });

  it("names the classes still unpublished for the current term, with their level, linking to the class", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 2,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        publicationProgress: {
          totalClasses: 2,
          publishedClasses: 1,
          unpublishedClasses: [{ classId: "c2", className: "Primary 2", levelName: "Primary" }],
        },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    expect(screen.queryByText("All published")).not.toBeInTheDocument();
    expect(screen.getByText("Primary 2")).toBeInTheDocument();
    // The level name renders in its own nested span, separated by a middot.
    expect(screen.getByText("· Primary")).toBeInTheDocument();
    expect(screen.getByText("Not published")).toBeInTheDocument();
    expect(screen.getByText("Primary 2").closest("a")).toHaveAttribute(
      "href",
      "/school/academics/classes/c2",
    );
  });

  it("pluralizes the publication card's remaining-count line correctly for classes", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 3,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        publicationProgress: {
          totalClasses: 3,
          publishedClasses: 1,
          unpublishedClasses: [
            { classId: "c2", className: "Primary 2", levelName: "Primary" },
            { classId: "c3", className: "Primary 3", levelName: "Primary" },
          ],
        },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("2 classes still unpublished")).toBeInTheDocument();
  });

  it("shows the attendance-today percentage's coverage instead of a full breakdown while some registers are still unmarked", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 8,
        registersMarkable: true,
        attendanceToday: { totalClasses: 8, classesMarked: 1, present: 25, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Across 1 of 8 registers")).toBeInTheDocument();
  });

  it("includes excused students in the attendance-today breakdown once every register is in", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 1,
        registersMarkable: true,
        attendanceToday: { totalClasses: 1, classesMarked: 1, present: 100, absent: 10, late: 5, excused: 5 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    expect(await screen.findByText("100 present · 10 absent · 5 late · 5 excused")).toBeInTheDocument();
  });

  it("hides AttendanceTodayCard's second attendance panel when today isn't a marking day", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 3,
        registersMarkable: false,
        attendanceToday: { totalClasses: 3, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    await screen.findByText("Not a marking day");
    expect(attendanceApi.getDailyOverview).not.toHaveBeenCalled();
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

  it("shows the upcoming-birthdays card on the admin dashboard, linking a row to the student's detail page", async () => {
    useAuthStore.setState({
      user: {
        id: "admin-1",
        email: "admin@school.example",
        firstName: "Ada",
        lastName: "Obi",
        role: "SCHOOL_ADMIN",
        schoolId: "school-1",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 0,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([
      {
        studentId: "student-ada",
        fullName: "Ada Obi",
        admissionNumber: "BFA/2026/0001",
        classId: "class-1",
        className: "Primary 1",
        levelName: "Primary",
        dateOfBirth: "1990-08-17",
        daysUntil: 3,
        turningAge: 8,
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Upcoming birthdays")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi").closest("a")).toHaveAttribute("href", "/school/students/student-ada");
  });

  it("omits the upcoming-birthdays card on the admin dashboard when there are none in the window", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      admin: {
        activeStudents: 0,
        activeGirls: 0,
        activeBoys: 0,
        activeClasses: 0,
        registersMarkable: true,
        attendanceToday: { totalClasses: 0, classesMarked: 0, present: 0, absent: 0, late: 0, excused: 0 },
        setupGaps: { classesWithoutClassTeacher: [], studentsWithoutGuardian: 0 },
      },
    });

    renderPage();

    await screen.findByText("Active students");
    expect(screen.queryByText("Upcoming birthdays")).not.toBeInTheDocument();
  });

  it("shows the upcoming-birthdays card on the teacher dashboard without a link to student detail", async () => {
    vi.mocked(dashboardApi.getSchoolDashboard).mockResolvedValue({
      teacher: { classes: [{ classId: "c1", className: "Primary 3", registerMarkedToday: true }] },
    });
    vi.mocked(birthdaysApi.listUpcomingBirthdays).mockResolvedValue([
      {
        studentId: "student-ada",
        fullName: "Ada Obi",
        admissionNumber: "BFA/2026/0001",
        classId: "c1",
        className: "Primary 3",
        levelName: "Primary",
        dateOfBirth: "1990-08-17",
        daysUntil: 3,
        turningAge: 8,
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Upcoming birthdays")).toBeInTheDocument();
    expect(screen.getByText("Ada Obi").closest("a")).toBeNull();
  });
});
