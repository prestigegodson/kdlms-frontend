import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BroadsheetView } from "@/api/assessments";
import { BroadsheetTable } from "@/features/assessments/components/BroadsheetTable";

const NUMERIC_BROADSHEET: BroadsheetView = {
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "NUMERIC",
  subjects: [{ subjectId: "subject-1", name: "Mathematics", code: "MTH" }],
  rows: [
    {
      enrollmentId: "enrollment-1",
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      subjectResults: [{ subjectId: "subject-1", finalScore: 90, grade: "A" }],
      total: 90,
      average: 90,
      position: 1,
    },
  ],
};

const QUALITATIVE_BROADSHEET: BroadsheetView = {
  classId: "class-2",
  termId: "term-1",
  assessmentMode: "QUALITATIVE",
  subjects: [{ subjectId: "subject-2", name: "Numeracy", code: "NUM" }],
  rows: [
    {
      enrollmentId: "enrollment-2",
      studentId: "student-2",
      studentName: "Zara Bello",
      admissionNumber: "SCH/2026/0002",
      subjectResults: [{ subjectId: "subject-2", ratingLabel: "Meets Expectation" }],
    },
  ],
};

describe("BroadsheetTable", () => {
  it("renders totals, averages, and positions for a numeric class", () => {
    render(<BroadsheetTable broadsheet={NUMERIC_BROADSHEET} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getAllByText("90").length).toBeGreaterThan(0);
  });

  it("renders neither totals nor positions for a qualitative class", () => {
    render(<BroadsheetTable broadsheet={QUALITATIVE_BROADSHEET} />);

    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(screen.queryByText("Average")).not.toBeInTheDocument();
    expect(screen.queryByText("Position")).not.toBeInTheDocument();
    expect(screen.getByText("Meets Expectation")).toBeInTheDocument();
  });

  it("hides Total/Average/Position on a mid-term numeric broadsheet - they're always null on MIDTERM", () => {
    render(<BroadsheetTable broadsheet={NUMERIC_BROADSHEET} scope="MIDTERM" />);

    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(screen.queryByText("Average")).not.toBeInTheDocument();
    expect(screen.queryByText("Position")).not.toBeInTheDocument();
  });

  it("renders a mid-term score as the raw mark over its snapshotted max, not a percentage", () => {
    const midtermBroadsheet: BroadsheetView = {
      ...NUMERIC_BROADSHEET,
      rows: [
        {
          ...NUMERIC_BROADSHEET.rows[0],
          subjectResults: [{ subjectId: "subject-1", finalScore: 18, scoreMax: 20 }],
          total: undefined,
          average: undefined,
          position: undefined,
        },
      ],
    };
    render(<BroadsheetTable broadsheet={midtermBroadsheet} scope="MIDTERM" />);

    expect(screen.getByText("18 / 20")).toBeInTheDocument();
    expect(screen.queryByText("90")).not.toBeInTheDocument();
  });

  it("keeps the scroll hint visible through the tablet width, hiding only from lg up", () => {
    render(<BroadsheetTable broadsheet={NUMERIC_BROADSHEET} />);

    expect(screen.getByText(/Scroll sideways/)).toHaveClass("lg:hidden");
  });

  it("gives the sticky student column a right-edge shadow, not a text-only affordance", () => {
    render(<BroadsheetTable broadsheet={NUMERIC_BROADSHEET} />);

    const studentHeader = screen.getByRole("columnheader", { name: "Student" });
    expect(studentHeader).toHaveClass("after:absolute", "after:bg-gradient-to-r");
  });
});
