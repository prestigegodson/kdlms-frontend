import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schoolsApi from "@/api/schools";
import type { SchoolView } from "@/api/schools";
import * as usersApi from "@/api/users";
import type { SchoolUserView } from "@/api/users";
import { SchoolDetailPage } from "@/features/schools/SchoolDetailPage";

vi.mock("@/api/schools", async () => {
  const actual = await vi.importActual<typeof import("@/api/schools")>("@/api/schools");
  return {
    ...actual,
    getSchool: vi.fn(),
    activateSchool: vi.fn(),
    suspendSchool: vi.fn(),
    archiveSchool: vi.fn(),
    restoreSchool: vi.fn(),
  };
});

vi.mock("@/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/api/users")>("@/api/users");
  return {
    ...actual,
    listSchoolAdmins: vi.fn(),
    resetUserPassword: vi.fn(),
  };
});

function renderDetailPage(school: SchoolView, admins: SchoolUserView[] = []) {
  vi.mocked(schoolsApi.getSchool).mockResolvedValue(school);
  vi.mocked(usersApi.listSchoolAdmins).mockResolvedValue({
    content: admins,
    totalElements: admins.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });

  const router = createMemoryRouter(
    [{ path: "/admin/schools/:schoolId", element: <SchoolDetailPage /> }],
    { initialEntries: [`/admin/schools/${school.id}`] },
  );
  render(<RouterProvider router={router} />);
}

const BRANCH_ADMIN: SchoolUserView = {
  id: "user-1",
  email: "sam@bsa.example",
  firstName: "Sam",
  lastName: "Ade",
  role: "BRANCH_ADMIN",
  branchId: "branch-1",
  branchName: "Ikeja",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
};

const ARCHIVED_SCHOOL: SchoolView = {
  id: "school-1",
  name: "Bright Star Academy",
  code: "BSA",
  status: "ARCHIVED",
};

const ACTIVE_SCHOOL: SchoolView = {
  id: "school-1",
  name: "Bright Star Academy",
  code: "BSA",
  status: "ACTIVE",
};

describe("SchoolDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a School heading while loading, so the mobile app bar keeps a title and back chevron", () => {
    renderDetailPage(ACTIVE_SCHOOL);

    // Asserted synchronously, before the mocked getSchool() promise resolves -
    // this is the "loading" branch's PageHeader, not the loaded one.
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("shows Restore, not Activate, for an archived school", async () => {
    renderDetailPage(ARCHIVED_SCHOOL);

    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("does not archive until the confirmation dialog is confirmed", async () => {
    renderDetailPage(ACTIVE_SCHOOL);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Archive" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Archive this school\?/)).toBeInTheDocument();
    expect(schoolsApi.archiveSchool).not.toHaveBeenCalled();

    // Confirm button stays disabled until the school code is typed exactly.
    const dialogConfirm = within(dialog).getByRole("button", { name: "Archive" });
    await user.type(within(dialog).getByLabelText('Type "BSA" to confirm'), "BSA");
    await user.click(dialogConfirm);

    expect(schoolsApi.archiveSchool).toHaveBeenCalledWith("school-1");
  });

  it("cancelling the suspend dialog does not call suspendSchool", async () => {
    renderDetailPage(ACTIVE_SCHOOL);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Suspend this school\?/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(schoolsApi.suspendSchool).not.toHaveBeenCalled();
  });

  it("lists a school's admins", async () => {
    renderDetailPage(ACTIVE_SCHOOL, [BRANCH_ADMIN]);

    expect(await screen.findByText("sam@bsa.example")).toBeInTheDocument();
    expect(screen.getByText("Ikeja")).toBeInTheDocument();
  });

  it("confirming a password reset reveals the new temporary password behind the collapsed toggle", async () => {
    vi.mocked(usersApi.resetUserPassword).mockResolvedValue({
      user: BRANCH_ADMIN,
      temporaryPassword: "fresh-temp-pass",
    });

    renderDetailPage(ACTIVE_SCHOOL, [BRANCH_ADMIN]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Reset password" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Reset this admin's password\?/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Reset password" }));

    expect(usersApi.resetUserPassword).toHaveBeenCalledWith(ACTIVE_SCHOOL.id, BRANCH_ADMIN.id);
    expect(screen.queryByText("fresh-temp-pass")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Show credentials/ }));
    expect(await screen.findByText("fresh-temp-pass")).toBeInTheDocument();
  });
});
