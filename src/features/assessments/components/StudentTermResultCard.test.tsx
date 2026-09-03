import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StudentTermResultView } from "@/api/assessments";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";

const TERM_RESULT: StudentTermResultView = {
  studentId: "student-1",
  enrollmentId: "enrollment-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "NUMERIC",
  subjects: [{ subjectId: "subject-1", name: "Mathematics" }],
  subjectResults: [{ subjectId: "subject-1", finalScore: 88, grade: "A" }],
  total: 88,
  average: 88,
  position: 1,
};

describe("StudentTermResultCard", () => {
  it("renders a TERM score as-is, with the total/average line and position badge", () => {
    render(<StudentTermResultCard result={TERM_RESULT} />);

    // The score cell, the Total value, and the Average value are all "88".
    expect(screen.getAllByText("88").length).toBe(3);
    expect(screen.getByText("Position 1")).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });

  it("renders a MIDTERM score as the raw mark over its snapshotted max, with no total/average line", () => {
    const midtermResult: StudentTermResultView = {
      ...TERM_RESULT,
      subjectResults: [{ subjectId: "subject-1", finalScore: 18, scoreMax: 20, grade: "A" }],
      total: undefined,
      average: undefined,
      position: undefined,
    };
    render(<StudentTermResultCard result={midtermResult} />);

    expect(screen.getByText("18 / 20")).toBeInTheDocument();
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Position/)).not.toBeInTheDocument();
  });
});
