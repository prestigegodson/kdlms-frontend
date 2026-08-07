import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as guardiansApi from "@/api/guardians";
import type { GuardianView } from "@/api/guardians";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView } from "@/api/sessions";
import * as studentsApi from "@/api/students";
import type { EnrollmentView, StudentGuardianView, StudentView } from "@/api/students";
import { StudentDetailPage } from "@/features/students/StudentDetailPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return {
    ...actual,
    getStudent: vi.fn(),
    listStudentEnrollments: vi.fn(),
    listStudentGuardians: vi.fn(),
    graduateStudent: vi.fn(),
    transferStudentClass: vi.fn(),
  };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

vi.mock("@/api/guardians", async () => {
  const actual = await vi.importActual<typeof import("@/api/guardians")>("@/api/guardians");
  return { ...actual, listGuardians: vi.fn(), linkGuardianToStudent: vi.fn() };
});

const STUDENT_VIEW: StudentView = {
  id: "student-1",
  schoolId: "school-1",
  branchId: "branch-1",
  branchName: "Main Branch",
  admissionNumber: "BFA/2026/0001",
  firstName: "Ada",
  lastName: "Obi",
  fullName: "Ada Obi",
  gender: "FEMALE",
  status: "ACTIVE",
  currentClassId: "class-1",
  currentClassName: "Primary 1",
  currentLevelId: "level-primary",
  currentLevelName: "Primary",
  currentSessionId: "session-1",
};

const SESSION_VIEW: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const ENROLLMENT_VIEW: EnrollmentView = {
  id: "enrollment-1",
  studentId: "student-1",
  classId: "class-1",
  className: "Primary 1",
  sessionId: "session-1",
  enrollmentType: "NEW",
  enrolledAt: "2026-09-01",
  status: "ACTIVE",
};

const GUARDIAN_VIEW: StudentGuardianView = {
  guardianId: "guardian-1",
  guardianName: "Chidi Obi",
  email: "chidi@example.com",
  relationship: "FATHER",
};

const GUARDIAN_SEARCH_RESULT: GuardianView = {
  id: "guardian-2",
  schoolId: "school-1",
  firstName: "Ngozi",
  lastName: "Eze",
  fullName: "Ngozi Eze",
  email: "ngozi@example.com",
  active: true,
  communicationEmailsEnabled: true,
};

function renderAsSchoolAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [{ path: "/school/students/:studentId", element: <StudentDetailPage /> }],
    { initialEntries: ["/school/students/student-1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("StudentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION_VIEW],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    // Fetched by the new StudentAttendanceCard section - not under test here.
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([]);
  });

  it("shows bio, enrollment history, and linked guardians", async () => {
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(studentsApi.listStudentEnrollments).mockResolvedValue([ENROLLMENT_VIEW]);
    vi.mocked(studentsApi.listStudentGuardians).mockResolvedValue([GUARDIAN_VIEW]);

    renderAsSchoolAdmin();

    expect(await screen.findByRole("heading", { name: "Ada Obi" })).toBeInTheDocument();
    expect(screen.getByText("Main Branch")).toBeInTheDocument();
    expect(await screen.findByText("2026/2027")).toBeInTheDocument();
    expect(screen.getByText("Chidi Obi")).toBeInTheDocument();
  });

  it("graduates the student after confirming", async () => {
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(studentsApi.listStudentEnrollments).mockResolvedValue([ENROLLMENT_VIEW]);
    vi.mocked(studentsApi.listStudentGuardians).mockResolvedValue([]);
    vi.mocked(studentsApi.graduateStudent).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByRole("heading", { name: "Ada Obi" });

    await user.click(screen.getByRole("button", { name: "Graduate" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Graduate" }));

    expect(studentsApi.graduateStudent).toHaveBeenCalledWith("student-1");
  });

  it("only offers same-level classes when transferring", async () => {
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(studentsApi.listStudentEnrollments).mockResolvedValue([ENROLLMENT_VIEW]);
    vi.mocked(studentsApi.listStudentGuardians).mockResolvedValue([]);
    vi.mocked(studentsApi.transferStudentClass).mockResolvedValue(STUDENT_VIEW);
    const sameLevelClass: SchoolClassView = {
      id: "class-2",
      schoolId: "school-1",
      branchId: "branch-1",
      levelId: "level-primary",
      name: "Primary 2",
      status: "ACTIVE",
    };
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [sameLevelClass],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByRole("heading", { name: "Ada Obi" });

    await user.click(screen.getByRole("button", { name: "Transfer class" }));
    const dialog = await screen.findByRole("dialog");

    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", "level-primary", 0, 200);
    expect(within(dialog).getByText("Primary 2")).toBeInTheDocument();
    expect(within(dialog).queryByText("Primary 1")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Transfer" }));

    expect(studentsApi.transferStudentClass).toHaveBeenCalledWith("student-1", "class-2");
  });

  it("shows an empty state when no guardians are linked", async () => {
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(studentsApi.listStudentEnrollments).mockResolvedValue([]);
    vi.mocked(studentsApi.listStudentGuardians).mockResolvedValue([]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("No guardians linked")).toBeInTheDocument();
  });

  // Regression for the "Failed to link guardian" bug: POST /guardians/{id}/students
  // returns a 201 with an empty body, which used to make apiFetch call response.json()
  // on nothing and throw - reporting failure even though the link was persisted.
  it("links an existing guardian without showing an error, and refreshes the list", async () => {
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(studentsApi.listStudentEnrollments).mockResolvedValue([]);
    vi.mocked(studentsApi.listStudentGuardians)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([GUARDIAN_VIEW]);
    vi.mocked(guardiansApi.listGuardians).mockResolvedValue({
      content: [GUARDIAN_SEARCH_RESULT],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 5,
    });
    vi.mocked(guardiansApi.linkGuardianToStudent).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByRole("heading", { name: "Ada Obi" });
    await screen.findByText("No guardians linked");

    await user.click(screen.getByRole("button", { name: "Link guardian" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Search by name or email"), "Ngozi");
    await user.click(await within(dialog).findByText("Ngozi Eze"));
    await user.click(within(dialog).getByRole("button", { name: "Link guardian" }));

    expect(guardiansApi.linkGuardianToStudent).toHaveBeenCalledWith(
      "guardian-2",
      "student-1",
      "MOTHER",
    );
    expect(await screen.findByText("Chidi Obi")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed to link guardian")).not.toBeInTheDocument();
  });
});
