import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import type { AttendanceRegisterView } from "@/api/attendance";
import * as meApi from "@/api/me";
import { TeacherRegisterPanel } from "@/features/attendance/components/TeacherRegisterPanel";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, getRegister: vi.fn(), clearRegister: vi.fn() };
});

function registerView(overrides: Partial<AttendanceRegisterView> = {}): AttendanceRegisterView {
  return {
    classId: "class-1",
    className: "Primary 1A",
    date: "2026-10-27",
    session: "MORNING",
    termId: "term-1",
    editable: true,
    rows: [
      {
        studentId: "student-1",
        studentName: "Ada Obi",
        admissionNumber: "SCH/0001",
        status: "PRESENT",
        recordedByName: "Tolu Teacher",
      },
    ],
    ...overrides,
  };
}

function renderPanel() {
  const router = createMemoryRouter([{ path: "/", element: <TeacherRegisterPanel /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("TeacherRegisterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      {
        classId: "class-1",
        branchId: "branch-1",
        levelId: "level-1",
        className: "Primary 1A",
        isClassTeacher: true,
        isAssistantTeacher: false,
        subjectIds: [],
      },
    ]);
  });

  it("unmarks a saved, editable register after confirmation and reloads it", async () => {
    const user = userEvent.setup();
    const unmarked = registerView({
      rows: [{ studentId: "student-1", studentName: "Ada Obi", admissionNumber: "SCH/0001" }],
    });
    vi.mocked(attendanceApi.getRegister)
      .mockResolvedValueOnce(registerView())
      .mockResolvedValueOnce(unmarked);
    vi.mocked(attendanceApi.clearRegister).mockResolvedValue(undefined);
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Unmark register" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Unmark register" }));

    expect(attendanceApi.clearRegister).toHaveBeenCalledWith("class-1", "2026-10-27", "MORNING");
    expect(await screen.findByText("Register unmarked")).toBeInTheDocument();
    await waitFor(() => expect(attendanceApi.getRegister).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Unmark register" })).not.toBeInTheDocument();
  });

  it("hides the unmark button on a register that isn't editable", async () => {
    vi.mocked(attendanceApi.getRegister).mockResolvedValue(registerView({ editable: false }));
    renderPanel();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unmark register" })).not.toBeInTheDocument();
  });

  it("hides the unmark button on a register that hasn't been saved yet", async () => {
    vi.mocked(attendanceApi.getRegister).mockResolvedValue(
      registerView({
        rows: [{ studentId: "student-1", studentName: "Ada Obi", admissionNumber: "SCH/0001" }],
      }),
    );
    renderPanel();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unmark register" })).not.toBeInTheDocument();
  });
});
