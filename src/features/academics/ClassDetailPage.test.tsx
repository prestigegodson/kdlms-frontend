import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@/api/auth";
import { listBranches } from "@/api/branches";
import * as classesApi from "@/api/classes";
import type { RosterStudentView, SchoolClassView } from "@/api/classes";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as meApi from "@/api/me";
import * as subjectsApi from "@/api/subjects";
import type { SubjectView } from "@/api/subjects";
import type { StudentMedicalView } from "@/api/students";
import * as usersApi from "@/api/users";
import { ClassDetailPage } from "@/features/academics/ClassDetailPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetLevelStore } from "@/stores/levelStore";
import { resetTeacherScopeStore } from "@/stores/teacherScopeStore";

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
    listClassStudents: vi.fn(),
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

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listRecordableSubjects: vi.fn(), getStudentMedical: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
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

const LEVEL: LevelView = {
  id: "level-1",
  baseLevel: "PRE_SCHOOL",
  displayName: "Little Star",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const STUDENT_ADA: RosterStudentView = {
  studentId: "student-1",
  firstName: "Ada",
  lastName: "Obi",
  fullName: "Ada Obi",
  admissionNumber: "BFA/2026/0001",
  gender: "FEMALE",
};

const STUDENT_BOLA: RosterStudentView = {
  studentId: "student-2",
  firstName: "Bola",
  lastName: "Eze",
  fullName: "Bola Eze",
  admissionNumber: "BFA/2026/0002",
  gender: "MALE",
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
    [
      { path: "/classes/:classId", element: <ClassDetailPage /> },
      { path: "/school/students/:studentId", element: <div>Student detail page</div> },
    ],
    { initialEntries: ["/classes/class-1"] },
  );
  render(<RouterProvider router={router} />);
}

function renderAsTeacher() {
  resetAuthStore();
  resetTeacherScopeStore();
  useAuthStore.setState({
    user: {
      id: "teacher-1",
      email: "sonia@school.example",
      firstName: "Sonia",
      lastName: "B",
      role: "TEACHER",
      schoolId: "school-1",
      branchId: "branch-1",
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
    resetLevelStore();
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
    vi.mocked(classesApi.listClassStudents).mockResolvedValue([]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([]);
    vi.mocked(listBranches).mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 50 });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([LEVEL]);
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

    // "Sonia B" appears both in the "Class teacher" summary tile and the
    // accordion body below it - assert at least one rendered rather than a
    // single unique match.
    expect((await screen.findAllByText("Sonia B")).length).toBeGreaterThanOrEqual(1);
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

describe("ClassDetailPage - enrolled students roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
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
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([]);
    vi.mocked(listBranches).mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 50 });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([LEVEL]);
    vi.mocked(classesApi.getClass).mockResolvedValue(BASE_CLASS);
  });

  it("shows a gender-split summary and lets an admin tap into a student's detail page", async () => {
    vi.mocked(classesApi.listClassStudents).mockResolvedValue([STUDENT_ADA, STUDENT_BOLA]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Bola Eze")).toBeInTheDocument();
    expect(screen.getByText("Enrolled students (2)")).toBeInTheDocument();
    expect(screen.getByText("1 boys · 1 girls")).toBeInTheDocument();

    const row = screen.getByText("Ada Obi").closest("tr")!;
    await user.click(row);

    expect(await screen.findByText("Student detail page")).toBeInTheDocument();
  });

  it("lets a TEACHER open the read-only medical modal instead of navigating", async () => {
    vi.mocked(classesApi.listClassStudents).mockResolvedValue([STUDENT_ADA]);
    const medical: StudentMedicalView = { studentId: "student-1", studentName: "Ada Obi" };
    vi.mocked(meApi.getStudentMedical).mockResolvedValue(medical);
    const user = userEvent.setup();

    renderAsTeacher();

    const row = await screen.findByText("Ada Obi");
    await user.click(row.closest("tr")!);

    expect(await screen.findByText("Ada Obi — Medical & emergency")).toBeInTheDocument();
    expect(screen.queryByLabelText("Assign a class teacher")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register student" })).not.toBeInTheDocument();
  });

  it("filters the roster by name or admission number once search appears", async () => {
    const manyStudents: RosterStudentView[] = [
      ...Array.from({ length: 9 }, (_, index) => ({
        studentId: `student-${index + 10}`,
        firstName: "Student",
        lastName: `${index + 1}`,
        fullName: `Student ${index + 1}`,
        admissionNumber: `BFA/2026/00${index + 10}`,
        gender: (index % 2 === 0 ? "FEMALE" : "MALE") as "FEMALE" | "MALE",
      })),
      STUDENT_ADA,
    ];
    vi.mocked(classesApi.listClassStudents).mockResolvedValue(manyStudents);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Ada Obi");
    expect(screen.getByText("Student 1")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search name or admission no." });
    await user.type(search, "Ada");

    await waitFor(() => expect(screen.queryByText("Student 1")).not.toBeInTheDocument());
    expect(screen.getByText("Ada Obi")).toBeInTheDocument();
  });

  it("renders an empty roster with a Register-student action for an admin", async () => {
    vi.mocked(classesApi.listClassStudents).mockResolvedValue([]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();

    expect(await screen.findByText("No students enrolled")).toBeInTheDocument();
    const registerButton = screen.getByRole("button", { name: "Register student" });

    await user.click(registerButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Little Star 1/)).toBeInTheDocument();
  });
});
