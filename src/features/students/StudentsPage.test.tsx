import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as meApi from "@/api/me";
import type { RosterStudentView, TeacherClassView } from "@/api/me";
import * as studentsApi from "@/api/students";
import type { StudentMedicalView, StudentView } from "@/api/students";
import { StudentsPage } from "@/features/students/StudentsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, listStudents: vi.fn(), registerStudent: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn(), listClassRoster: vi.fn(), getStudentMedical: vi.fn() };
});

const MAIN_BRANCH: BranchView = { id: "branch-1", schoolId: "school-1", name: "Main Branch", main: true, status: "ACTIVE" };

const CLASS_VIEW: SchoolClassView = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 1",
  status: "ACTIVE",
};

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
};

function mockStudents(students: StudentView[]) {
  vi.mocked(studentsApi.listStudents).mockResolvedValue({
    content: students,
    totalElements: students.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

function renderAsSchoolAdmin(initialEntry = "/") {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "admin@school.example", firstName: "Ada", lastName: "Obi", role: "SCHOOL_ADMIN", schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [
      { path: "/", element: <StudentsPage /> },
      { path: "/school/students/:studentId", element: <div>Student detail page</div> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
}

function renderAsTeacher() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "teacher-1",
      email: "teacher@school.example",
      firstName: "Tara",
      lastName: "T",
      role: "TEACHER",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <StudentsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("StudentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [CLASS_VIEW],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
  });

  it("lists students with their class and status", async () => {
    mockStudents([STUDENT_VIEW]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("BFA/2026/0001")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("navigates to the student detail route when a row is tapped", async () => {
    mockStudents([STUDENT_VIEW]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Ada Obi");

    const row = screen.getByText("Ada Obi").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);

    expect(await screen.findByText("Student detail page")).toBeInTheDocument();
  });

  it("filters through the mobile Filters sheet and reflects the active count on its trigger", async () => {
    mockStudents([STUDENT_VIEW]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Ada Obi");

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });

    await user.selectOptions(within(sheet).getByLabelText("Status"), "WITHDRAWN");

    expect(studentsApi.listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ status: "WITHDRAWN" }),
      0,
      expect.any(Number),
    );

    await user.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("1");
  });

  it("initializes the guardian filter from the URL and reaches the API, backing the dashboard's deep link", async () => {
    mockStudents([]);

    renderAsSchoolAdmin("/?hasGuardian=false");
    await screen.findByText(/No students found/);

    expect(studentsApi.listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ hasGuardian: false }),
      0,
      expect.any(Number),
    );
    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("1");
    expect(screen.getByLabelText("Guardian")).toHaveValue("false");
  });

  it("filters by guardian linkage through the inline field", async () => {
    mockStudents([STUDENT_VIEW]);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("Ada Obi");

    await user.selectOptions(screen.getByLabelText("Guardian"), "true");

    expect(studentsApi.listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ hasGuardian: true }),
      0,
      expect.any(Number),
    );
  });

  it("registers a student into the selected class", async () => {
    mockStudents([]);
    vi.mocked(studentsApi.registerStudent).mockResolvedValue(STUDENT_VIEW);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No students found/);

    await user.click(screen.getByRole("button", { name: "Register student" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("First name"), "Ada");
    await user.type(within(dialog).getByLabelText("Last name"), "Obi");
    await user.click(within(dialog).getByRole("button", { name: "Register student" }));

    expect(studentsApi.registerStudent).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1", classId: "class-1", firstName: "Ada", lastName: "Obi" }),
    );
  });

  it("shows a read-only roster for a TEACHER instead of the admin registry", async () => {
    const myClass: TeacherClassView = {
      classId: "class-1",
      branchId: "branch-1",
      levelId: "level-1",
      className: "Primary 1",
      isClassTeacher: true,
      subjectIds: [],
    };
    const rosterStudent: RosterStudentView = {
      studentId: "student-1",
      firstName: "Ada",
      lastName: "Obi",
      fullName: "Ada Obi",
      admissionNumber: "BFA/2026/0001",
      gender: "FEMALE",
    };
    vi.mocked(meApi.listMyClasses).mockResolvedValue([myClass]);
    vi.mocked(meApi.listClassRoster).mockResolvedValue([rosterStudent]);

    renderAsTeacher();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register student" })).not.toBeInTheDocument();
  });

  it("opens a read-only medical panel for a roster student", async () => {
    const myClass: TeacherClassView = {
      classId: "class-1",
      branchId: "branch-1",
      levelId: "level-1",
      className: "Primary 1",
      isClassTeacher: true,
      subjectIds: [],
    };
    const rosterStudent: RosterStudentView = {
      studentId: "student-1",
      firstName: "Ada",
      lastName: "Obi",
      fullName: "Ada Obi",
      admissionNumber: "BFA/2026/0001",
      gender: "FEMALE",
    };
    const medical: StudentMedicalView = {
      studentId: "student-1",
      studentName: "Ada Obi",
      bloodGroup: "O_POSITIVE",
      allergies: "Peanuts",
    };
    vi.mocked(meApi.listMyClasses).mockResolvedValue([myClass]);
    vi.mocked(meApi.listClassRoster).mockResolvedValue([rosterStudent]);
    vi.mocked(meApi.getStudentMedical).mockResolvedValue(medical);
    const user = userEvent.setup();

    renderAsTeacher();
    await screen.findByText("Ada Obi");

    const row = screen.getByText("Ada Obi").closest("tr")!;
    expect(row).toHaveAttribute("tabindex", "0");

    await user.click(row);

    expect(meApi.getStudentMedical).toHaveBeenCalledWith("student-1");
    expect(await screen.findByText("O+")).toBeInTheDocument();
    expect(screen.getByText("Peanuts")).toBeInTheDocument();
  });
});
