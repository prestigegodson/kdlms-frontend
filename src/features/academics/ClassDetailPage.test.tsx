import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@/api/auth";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as subjectsApi from "@/api/subjects";
import type { SubjectView } from "@/api/subjects";
import * as usersApi from "@/api/users";
import { ClassDetailPage } from "@/features/academics/ClassDetailPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return {
    ...actual,
    getClass: vi.fn(),
    assignClassTeacher: vi.fn(),
    unassignClassTeacher: vi.fn(),
    listSubjectTeachers: vi.fn(),
    getSubjectRegistrations: vi.fn(),
    setSubjectRegistrations: vi.fn(),
  };
});

vi.mock("@/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/api/users")>("@/api/users");
  return { ...actual, listTeachers: vi.fn() };
});

vi.mock("@/api/subjects", async () => {
  const actual = await vi.importActual<typeof import("@/api/subjects")>("@/api/subjects");
  return { ...actual, listSubjects: vi.fn() };
});

const TEACHER: UserSummary = {
  id: "teacher-1",
  email: "sonia@school.example",
  firstName: "Sonia",
  lastName: "B",
  role: "TEACHER",
  schoolId: "school-1",
  branchId: "branch-1",
};

const BASE_CLASS: SchoolClassView = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Little Star 1",
  classTeacherId: undefined,
  classTeacherName: undefined,
  status: "ACTIVE",
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
    [{ path: "/classes/:classId", element: <ClassDetailPage /> }],
    { initialEntries: ["/classes/class-1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ClassDetailPage - class teacher assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.listTeachers).mockResolvedValue({
      content: [TEACHER],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(subjectsApi.listSubjects).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 1,
      number: 0,
      size: 100,
    });
    vi.mocked(classesApi.listSubjectTeachers).mockResolvedValue([]);
  });

  it("renders a PageHeader with the back link while the class is still loading", async () => {
    vi.mocked(classesApi.getClass).mockReturnValue(new Promise(() => undefined));

    renderAsSchoolAdmin();

    expect(await screen.findByText("Class details")).toBeInTheDocument();
  });

  it("shows the assign dropdown when the class has no teacher yet", async () => {
    vi.mocked(classesApi.getClass).mockResolvedValue(BASE_CLASS);

    renderAsSchoolAdmin();

    expect(await screen.findByText("No class teacher assigned yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Assign a class teacher")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unassign" })).not.toBeInTheDocument();
  });

  it("hides the assign dropdown once a class teacher is assigned, showing Unassign instead", async () => {
    vi.mocked(classesApi.getClass).mockResolvedValue({
      ...BASE_CLASS,
      classTeacherId: "teacher-1",
      classTeacherName: "Sonia B",
    });

    renderAsSchoolAdmin();

    expect(await screen.findByText("Sonia B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unassign" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Assign a class teacher")).not.toBeInTheDocument();
  });

  it("badges a selective subject and lets an admin manage its registered students", async () => {
    const SELECTIVE_SUBJECT: SubjectView = {
      id: "subject-1",
      schoolId: "school-1",
      levelId: "level-1",
      name: "Further Maths",
      termNumbers: [1, 2, 3],
      selective: true,
      status: "ACTIVE",
    };
    vi.mocked(classesApi.getClass).mockResolvedValue(BASE_CLASS);
    vi.mocked(subjectsApi.listSubjects).mockResolvedValue({
      content: [SELECTIVE_SUBJECT],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 100,
    });
    vi.mocked(classesApi.getSubjectRegistrations).mockResolvedValue({
      classId: "class-1",
      subjectId: "subject-1",
      subjectName: "Further Maths",
      students: [
        { studentId: "student-1", studentName: "Ada Obi", admissionNumber: "BFA/2026/0001", registered: false },
      ],
    });
    vi.mocked(classesApi.setSubjectRegistrations).mockResolvedValue({
      outcomes: [{ studentId: "student-1", success: true }],
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    expect(await screen.findByText("Selective")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Manage" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByLabelText("Select Ada Obi"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(classesApi.setSubjectRegistrations).toHaveBeenCalledWith("class-1", "subject-1", ["student-1"]);
    expect(await within(dialog).findByText("1 of 1 succeeded.")).toBeInTheDocument();
  });
});
