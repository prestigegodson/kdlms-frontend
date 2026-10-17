import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EligibleStudentView } from "@/api/takeHomeQuizzes";
import { QuizAudienceField } from "@/features/takeHomeQuizzes/components/QuizAudienceField";

const STUDENTS: EligibleStudentView[] = [
  { studentId: "s1", fullName: "Ada Okoye", admissionNumber: "KDL001", classId: "c1", className: "JSS 1A", portalLogin: true },
  { studentId: "s2", fullName: "Bola Ade", admissionNumber: "KDL002", classId: "c1", className: "JSS 1A", portalLogin: false },
  { studentId: "s3", fullName: "Chidi Eze", admissionNumber: "KDL003", classId: "c2", className: "JSS 1B", portalLogin: true },
];

describe("QuizAudienceField", () => {
  it("hides the student list while the quiz goes to everyone", () => {
    render(<QuizAudienceField audience="ALL" selected={new Set()} onChange={vi.fn()} students={STUDENTS} />);
    expect(screen.getByLabelText("All students in these classrooms")).toBeChecked();
    expect(screen.queryByLabelText(/Ada Okoye/)).not.toBeInTheDocument();
  });

  it("switches to Selected students and ticks one", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <QuizAudienceField audience="ALL" selected={new Set()} onChange={onChange} students={STUDENTS} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Selected students"));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set());

    rerender(<QuizAudienceField audience="SELECTED" selected={new Set()} onChange={onChange} students={STUDENTS} />);
    expect(screen.getByText("JSS 1A")).toBeInTheDocument();
    expect(screen.getByText("JSS 1B")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Chidi Eze/));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set(["s3"]));
  });

  it("selects a whole classroom, filtered by the search", async () => {
    const onChange = vi.fn();
    render(<QuizAudienceField audience="SELECTED" selected={new Set()} onChange={onChange} students={STUDENTS} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith("SELECTED", new Set(["s1", "s2"]));

    await user.type(screen.getByLabelText("Search students"), "KDL003");
    expect(screen.queryByLabelText(/Ada Okoye/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Chidi Eze/)).toBeInTheDocument();
  });

  it("keeps a locked student ticked and refuses narrowing once submissions exist", () => {
    const { rerender } = render(
      <QuizAudienceField
        audience="SELECTED"
        selected={new Set(["s1"])}
        onChange={vi.fn()}
        students={STUDENTS}
        isLocked={(id) => id === "s1"}
      />,
    );
    expect(screen.getByLabelText(/Ada Okoye/)).toBeChecked();
    expect(screen.getByLabelText(/Ada Okoye/)).toBeDisabled();
    expect(screen.getByLabelText(/Bola Ade/)).toBeEnabled();

    rerender(
      <QuizAudienceField audience="ALL" selected={new Set()} onChange={vi.fn()} students={STUDENTS} narrowingLocked />,
    );
    expect(screen.getByLabelText("Selected students")).toBeDisabled();
    expect(screen.getByText(/can't be narrowed/)).toBeInTheDocument();
  });
});
