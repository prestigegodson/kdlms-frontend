import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResourceCompletionsView } from "@/api/learning";
import { CompletionsPanel } from "@/features/learning/components/CompletionsPanel";

const COMPLETIONS: ResourceCompletionsView = {
  resourceId: "resource-1",
  title: "Fractions Explainer",
  totalStudents: 3,
  completedCount: 1,
  students: [
    {
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      completed: true,
      completedAt: "2026-09-02T10:00:00Z",
      positionSeconds: null,
      lastOpenedAt: "2026-09-02T10:00:00Z",
    },
    {
      studentId: "student-2",
      studentName: "Bola Musa",
      admissionNumber: "SCH/2026/0002",
      completed: false,
      completedAt: null,
      positionSeconds: 42,
      lastOpenedAt: "2026-09-04T09:00:00Z",
    },
    {
      studentId: "student-3",
      studentName: "Chi Eze",
      admissionNumber: "SCH/2026/0003",
      completed: false,
      completedAt: null,
      positionSeconds: null,
      lastOpenedAt: null,
    },
  ],
};

describe("CompletionsPanel", () => {
  it("shows the three-state badge for completed, opened-not-completed, and never-opened students", () => {
    render(<CompletionsPanel completions={COMPLETIONS} />);

    const adaRow = screen.getByText("Ada Obi").closest("tr");
    const bolaRow = screen.getByText("Bola Musa").closest("tr");
    const chiRow = screen.getByText("Chi Eze").closest("tr");
    expect(adaRow?.textContent).toContain("Completed");
    expect(bolaRow?.textContent).toContain("Opened");
    expect(chiRow?.textContent).toContain("Not opened");
  });

  it("shows the progress summary matching completedCount and totalStudents", () => {
    render(<CompletionsPanel completions={COMPLETIONS} />);

    expect(screen.getByText("1 of 3 completed")).toBeInTheDocument();
  });

  it("shows a dash for last-opened and completed columns on a never-opened student", () => {
    render(<CompletionsPanel completions={COMPLETIONS} />);

    const chiRow = screen.getByText("Chi Eze").closest("tr");
    expect(chiRow?.textContent).toContain("—");
  });
});
