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
});
