import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as attendanceApi from "@/api/attendance";
import type { AttendanceRegisterView } from "@/api/attendance";
import {
  AttendanceOutcomeList,
  AttendanceRegisterGrid,
} from "@/features/attendance/components/AttendanceRegisterGrid";

vi.mock("@/api/attendance", async () => {
  const actual = await vi.importActual<typeof import("@/api/attendance")>("@/api/attendance");
  return { ...actual, saveRegister: vi.fn() };
});

const EDITABLE_REGISTER: AttendanceRegisterView = {
  classId: "class-1",
  className: "Primary 1",
  date: "2026-09-14",
  termId: "term-1",
  editable: true,
  rows: [
    { studentId: "student-1", studentName: "Ada Obi", admissionNumber: "SCH/2026/0001" },
    { studentId: "student-2", studentName: "Bola Eze", admissionNumber: "SCH/2026/0002" },
  ],
};

function renderGrid(register: AttendanceRegisterView = EDITABLE_REGISTER, onSaved = vi.fn()) {
  const router = createMemoryRouter(
    [{ path: "/", element: <AttendanceRegisterGrid register={register} onSaved={onSaved} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return { onSaved };
}

describe("AttendanceRegisterGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows every student unmarked and the save control disabled until edits exist", () => {
    renderGrid();

    expect(screen.getByText("0 of 2 marked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark register" })).not.toBeInTheDocument();
  });

  it("keeps Mark register disabled while some students are still unmarked", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(screen.getAllByRole("radio", { name: /Present/ })[0]);

    expect(screen.getByText("1 of 2 marked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark register" })).toBeDisabled();
    expect(screen.getByText("Mark 1 more student to save")).toBeInTheDocument();
  });

  it("enables Mark register once every student has a status, and saves the full set", async () => {
    const user = userEvent.setup();
    vi.mocked(attendanceApi.saveRegister).mockResolvedValue({
      outcomes: [
        { studentId: "student-1", success: true },
        { studentId: "student-2", success: true },
      ],
    });
    const { onSaved } = renderGrid();

    await user.click(screen.getAllByRole("radio", { name: /Present/ })[0]);
    await user.click(screen.getAllByRole("radio", { name: /Absent/ })[1]);
    const saveButton = screen.getByRole("button", { name: "Mark register" });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(attendanceApi.saveRegister).toHaveBeenCalledWith("class-1", "2026-09-14", [
      { studentId: "student-1", status: "PRESENT" },
      { studentId: "student-2", status: "ABSENT" },
    ]);
    expect(onSaved).toHaveBeenCalledWith([
      { studentId: "student-1", success: true },
      { studentId: "student-2", success: true },
    ]);
  });

  it("renders a read-only badge, no segments or save bar, when the register isn't editable", () => {
    renderGrid({
      ...EDITABLE_REGISTER,
      editable: false,
      rows: [
        {
          studentId: "student-1",
          studentName: "Ada Obi",
          admissionNumber: "SCH/2026/0001",
          status: "PRESENT",
        },
      ],
    });

    expect(screen.getByText("PRESENT")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark register" })).not.toBeInTheDocument();
  });
});

describe("AttendanceOutcomeList", () => {
  const nameOf = (studentId: string) =>
    ({ "student-1": "Ada Obi", "student-2": "Bola Eze" })[studentId] ?? studentId;

  it("shows only the summary count, no student list, when every row succeeds", () => {
    render(
      <AttendanceOutcomeList
        outcomes={[
          { studentId: "student-1", success: true },
          { studentId: "student-2", success: true },
        ]}
        nameOf={nameOf}
      />,
    );

    expect(screen.getByText("Register saved")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 saved successfully.")).toBeInTheDocument();
    expect(screen.queryByText("Ada Obi")).not.toBeInTheDocument();
    expect(screen.queryByText("Bola Eze")).not.toBeInTheDocument();
  });

  it("lists only the failed student, with their reason, when some rows fail", () => {
    render(
      <AttendanceOutcomeList
        outcomes={[
          { studentId: "student-1", success: true },
          { studentId: "student-2", success: false, message: "Not on this class roster" },
        ]}
        nameOf={nameOf}
      />,
    );

    expect(screen.getByText("Register saved with 1 problem")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 saved successfully.")).toBeInTheDocument();
    expect(screen.queryByText("Ada Obi")).not.toBeInTheDocument();
    expect(screen.getByText("Bola Eze")).toBeInTheDocument();
    expect(screen.getByText(/Not on this class roster/)).toBeInTheDocument();
  });
});
