import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as studentsApi from "@/api/students";
import type { StudentView } from "@/api/students";
import { StudentSearchField } from "@/features/students/components/StudentSearchField";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, listStudents: vi.fn() };
});

const GRACE: StudentView = {
  id: "student-1",
  schoolId: "school-1",
  branchId: "branch-1",
  admissionNumber: "KDL/2024/0031",
  firstName: "Grace",
  lastName: "Obi",
  fullName: "Grace Obi",
  gender: "FEMALE",
  admissionDate: "2020-09-01",
  status: "ACTIVE",
  currentClassName: "Primary 3 Gold",
};

const ADA: StudentView = {
  ...GRACE,
  id: "student-2",
  admissionNumber: "KDL/2024/0057",
  firstName: "Ada",
  lastName: "Obi",
  fullName: "Ada Obi",
};

function page(content: StudentView[]) {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 10 };
}

describe("StudentSearchField", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires no search for an empty query", () => {
    render(<StudentSearchField id="student" value={null} onChange={vi.fn()} branchId="branch-1" />);
    expect(studentsApi.listStudents).not.toHaveBeenCalled();
    expect(screen.getByText("Type a name or admission number.")).toBeInTheDocument();
  });

  it("debounces the search, then renders results scoped to the branch and ACTIVE status", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue(page([GRACE]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={vi.fn()} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "gra");
    expect(studentsApi.listStudents).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() =>
      expect(studentsApi.listStudents).toHaveBeenCalledWith({ branchId: "branch-1", status: "ACTIVE", q: "gra" }, 0, 10),
    );
    expect(await screen.findByRole("option", { name: /Grace Obi/ })).toBeInTheDocument();
  });

  it("clicking a result selects it", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue(page([GRACE]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={onChange} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "gra");
    await vi.advanceTimersByTimeAsync(300);
    await user.click(await screen.findByRole("option", { name: /Grace Obi/ }));

    expect(onChange).toHaveBeenCalledWith({ id: "student-1", name: "Grace Obi", admissionNumber: "KDL/2024/0031" });
  });

  it("Down then Enter selects the highlighted result via the keyboard", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue(page([GRACE, ADA]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={onChange} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "ob");
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByRole("option", { name: /Grace Obi/ });

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith({ id: "student-2", name: "Ada Obi", admissionNumber: "KDL/2024/0057" });
  });

  it("Escape closes the results without selecting anything", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue(page([GRACE]));
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={onChange} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "gra");
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByRole("option", { name: /Grace Obi/ });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows no matching students for an empty result page", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue(page([]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={vi.fn()} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "zzz");
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByText("No matching students.")).toBeInTheDocument();
  });

  it("surfaces a rejected search inline", async () => {
    vi.mocked(studentsApi.listStudents).mockRejectedValue(new ApiError(500, "Search failed"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StudentSearchField id="student" value={null} onChange={vi.fn()} branchId="branch-1" />);

    await user.type(screen.getByRole("combobox"), "gra");
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByText("Search failed")).toBeInTheDocument();
  });

  it("is disabled with no branch to search", () => {
    render(<StudentSearchField id="student" value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Select a branch first.")).toBeDisabled();
  });

  it("shows the selected student and clears it on demand", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <StudentSearchField
        id="student"
        value={{ id: "student-1", name: "Grace Obi", admissionNumber: "KDL/2024/0031" }}
        onChange={onChange}
        branchId="branch-1"
      />,
    );

    expect(screen.getByText("Grace Obi")).toBeInTheDocument();
    expect(screen.getByText("KDL/2024/0031")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear student" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
