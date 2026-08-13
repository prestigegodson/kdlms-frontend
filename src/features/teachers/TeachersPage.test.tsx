import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@/api/auth";
import * as branchesApi from "@/api/branches";
import type { BranchView } from "@/api/branches";
import * as usersApi from "@/api/users";
import type { CreateUserResult } from "@/api/users";
import { TeachersPage } from "@/features/teachers/TeachersPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/api/users")>("@/api/users");
  return {
    ...actual,
    listTeachers: vi.fn(),
    createTeacher: vi.fn(),
    updateTeacher: vi.fn(),
    getTeacherRemovalImpact: vi.fn(),
    removeTeacher: vi.fn(),
  };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

const MAIN_BRANCH: BranchView = {
  id: "branch-1",
  schoolId: "school-1",
  name: "Main Branch",
  main: true,
  status: "ACTIVE",
};

const TEACHER: UserSummary = {
  id: "teacher-1",
  email: "sonia@school.example",
  firstName: "Sonia",
  lastName: "B",
  phone: "080",
  role: "TEACHER",
  schoolId: "school-1",
  branchId: "branch-1",
};

function mockTeachers(teachers: UserSummary[]) {
  vi.mocked(usersApi.listTeachers).mockResolvedValue({
    content: teachers,
    totalElements: teachers.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

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
  render(<TeachersPage />);
}

function renderAsBranchAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-2",
      email: "branch-admin@school.example",
      firstName: "Bea",
      lastName: "Admin",
      role: "BRANCH_ADMIN",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  render(<TeachersPage />);
}

describe("TeachersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [MAIN_BRANCH],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("lists teachers with their branch", async () => {
    mockTeachers([TEACHER]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("sonia@school.example")).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Main Branch")).toBeInTheDocument();
  });

  it("shows a Branch filter for a SCHOOL_ADMIN, narrowing listTeachers to the selected branch", async () => {
    mockTeachers([TEACHER]);

    renderAsSchoolAdmin();

    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();
    expect(usersApi.listTeachers).toHaveBeenCalledWith("branch-1");
  });

  it("shows no Branch filter for a BRANCH_ADMIN, and lists teachers unfiltered", async () => {
    mockTeachers([TEACHER]);

    renderAsBranchAdmin();

    await screen.findByText("sonia@school.example");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    expect(usersApi.listTeachers).toHaveBeenCalledWith(undefined);
  });

  it("creates a teacher and keeps the temporary password collapsed until revealed", async () => {
    mockTeachers([]);
    const created: CreateUserResult = { user: TEACHER, temporaryPassword: "Xk4p-9Fmz" };
    vi.mocked(usersApi.createTeacher).mockResolvedValue(created);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No teachers yet/);

    await user.click(screen.getByRole("button", { name: "Add teacher" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("First name"), "Sonia");
    await user.type(within(dialog).getByLabelText("Last name"), "B");
    await user.type(within(dialog).getByLabelText("Email"), "sonia@school.example");
    await user.click(within(dialog).getByRole("button", { name: "Create teacher" }));

    expect(usersApi.createTeacher).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Sonia",
        lastName: "B",
        email: "sonia@school.example",
        branchId: "branch-1",
      }),
    );

    const confirmDialog = await screen.findByRole("dialog");
    expect(within(confirmDialog).getByText(/welcome email has been sent/)).toBeInTheDocument();
    expect(within(confirmDialog).queryByText("Xk4p-9Fmz")).not.toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: /Show credentials/ }));
    expect(within(confirmDialog).getByText("Xk4p-9Fmz")).toBeInTheDocument();
  });

  it("edits a teacher with a prefilled form and no branch field, then refreshes the list", async () => {
    mockTeachers([TEACHER]);
    vi.mocked(usersApi.updateTeacher).mockResolvedValue({ ...TEACHER, lastName: "Balogun", phone: "081" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit teacher" });
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Sonia");
    expect(within(dialog).getByLabelText("Last name")).toHaveValue("B");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("sonia@school.example");
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("080");
    expect(within(dialog).queryByLabelText("Branch")).not.toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Last name"));
    await user.type(within(dialog).getByLabelText("Last name"), "Balogun");
    await user.clear(within(dialog).getByLabelText("Phone"));
    await user.type(within(dialog).getByLabelText("Phone"), "081");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(usersApi.updateTeacher).toHaveBeenCalledWith(
      "teacher-1",
      expect.objectContaining({
        firstName: "Sonia",
        lastName: "Balogun",
        email: "sonia@school.example",
        phone: "081",
      }),
    );
    expect(usersApi.listTeachers).toHaveBeenCalledTimes(2);
    await screen.findByRole("button", { name: "Add teacher" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes a teacher after confirming, showing the assignments that will be cleared", async () => {
    mockTeachers([TEACHER]);
    vi.mocked(usersApi.getTeacherRemovalImpact).mockResolvedValue({
      classTeacherOf: ["JSS 1A"],
      subjectAssignmentCount: 2,
    });
    vi.mocked(usersApi.removeTeacher).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove this teacher?" });
    expect(usersApi.getTeacherRemovalImpact).toHaveBeenCalledWith("teacher-1");
    expect(within(dialog).getByText(/Class teacher of JSS 1A/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 subject-teacher assignments/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Remove teacher" }));

    expect(usersApi.removeTeacher).toHaveBeenCalledWith("teacher-1");
    expect(usersApi.listTeachers).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
